
/* 106 无人化三相流程的线路生成器（2026-11-11）
   用法：node scripts/gen-106-flow.mjs [--write]
   ── 为什么这样做 ──
   RB-C-02 的路线是离线 grid-A* 跑出来的（seed.routeMethod），手写 70 个停靠点不现实，
   也不能随手连直线——106 里设备就压在巷道两侧，穿堂线一画就撞占地（routecheck 与场景自检都会抓）。
   所以这里把「已验证安全」的现有折线拆成图：顶点=原 routeNodes 的每个点，
   边=原折线里相邻两点的那一段（本身就是 Manhattan、且已被 CAD 占地验过无碰撞）。
   新路线只走这些边的并集 ⇒ 任何一段都是原路线的子段，墙体/门洞/占地判定天然成立。
   站点顺序按产品负责人给的 20 步流程（红/黄/绿三相 ×3）排，取样与还样都落在 102-01。
*/
import { readFileSync, writeFileSync } from 'node:fs';

const SEED = 'twin/api/seed.json';
const seed = JSON.parse(readFileSync(SEED, 'utf8'));
const rb = seed.zone106.robots.find(r => r.robotId === 'RB-C-02');
const old = rb.routeNodes;

/* ---------- 1. 由原折线建图 ---------- */
const key = p => p[0].toFixed(2) + ',' + p[1].toFixed(2);
const pts = old.map(n => n.at);
const closed = pts.concat([pts[0]]);            // 原路线是闭环
const edges = [];
for (let i = 0; i < closed.length - 1; i++) {
  const a = closed[i], b = closed[i + 1];
  if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) continue;
  edges.push([a, b]);
}
/* 顶点若落在某条边中间，把该边拆开——否则转弯点接不上（例如 (13.90,22.19) 在 106-13↔北开口 的线上） */
let split = true;
while (split) {
  split = false;
  for (let i = 0; i < edges.length && !split; i++) {
    const [a, b] = edges[i];
    for (const p of pts) {
      const k = key(p);
      if (k === key(a) || k === key(b)) continue;
      const onX = Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(p[0] - a[0]) < 1e-6
        && Math.min(a[1], b[1]) - 1e-6 < p[1] && p[1] < Math.max(a[1], b[1]) + 1e-6;
      const onZ = Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(p[1] - a[1]) < 1e-6
        && Math.min(a[0], b[0]) - 1e-6 < p[0] && p[0] < Math.max(a[0], b[0]) + 1e-6;
      if (onX || onZ) { edges.splice(i, 1, [a, p], [p, b]); split = true; break; }
    }
  }
}
const nodes = new Map();
edges.forEach(([a, b]) => { nodes.set(key(a), a); nodes.set(key(b), b); });
const adj = new Map();
edges.forEach(([a, b]) => {
  const ka = key(a), kb = key(b), w = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  (adj.get(ka) || adj.set(ka, []).get(ka)).push([kb, w]);
  (adj.get(kb) || adj.set(kb, []).get(kb)).push([ka, w]);
});
const stationAt = new Map();
old.filter(n => n.kind === 'station').forEach(n => stationAt.set(n.cad, n));

function route(fromCad, toCad) {
  const s0 = stationAt.get(fromCad), t0 = stationAt.get(toCad);
  if (!s0 || !t0) throw new Error('未知站点 ' + fromCad + ' / ' + toCad);
  const src = key(s0.at), dst = key(t0.at);
  if (src === dst) return [];
  /* Dijkstra：dist 用 Map.has 判存在（写 dist.get(v)||Infinity 会把 0 当成无穷，源点一条边都松弛不动） */
  const dist = new Map([[src, 0]]), prev = new Map(), done = new Set(), q = [src];
  while (q.length) {
    q.sort((x, y) => dist.get(x) - dist.get(y));
    const u = q.shift();
    if (done.has(u)) continue;
    done.add(u);
    if (u === dst) break;
    for (const [v, w] of (adj.get(u) || [])) {
      const nd = dist.get(u) + w;
      if (!dist.has(v) || nd < dist.get(v)) { dist.set(v, nd); prev.set(v, u); if (!done.has(v)) q.push(v); }
    }
  }
  if (!dist.has(dst)) throw new Error('图上不可达：' + fromCad + ' → ' + toCad);
  const path = [dst]; let cur = dst;
  while (cur !== src) { cur = prev.get(cur); path.unshift(cur); }
  /* 折线化：只留转向点（三点共线就吃掉中间那个），并把连续同向段合并 */
  const xy = path.map(k2 => k2.split(',').map(Number));
  const simplify = xy.filter((p, i) => i === 0 || i === xy.length - 1 ||
    (Math.abs(xy[i - 1][0] - xy[i + 1][0]) > 1e-6 && Math.abs(xy[i - 1][1] - xy[i + 1][1]) > 1e-6));
  return simplify.slice(1, -1);            // 去掉两端站点，留中间拐点
}

console.log('图：顶点 ' + nodes.size + ' / 边 ' + edges.length);


/* ---------- 2. 三相流程规格（产品负责人 2026-11-11 给的 20 步，逐条转写，不改语义） ----------
   cad = 这道任务在哪个工位执行；also = 同一步里还要顺路停靠的工位（不另计任务，
   例如「取样」要先到 102 货架、再把三根线放上 AGV 上料试验桌）。
   相别 A/B/C = 同一相里的三根线缆：A 走热收缩、B 走哑铃机械性能（两盒各 5 件）、C 走径向+绝缘厚度。 */
const DEV = { '102-01': '102-01', '106-01': 'Y0302010102', '106-02': 'Y0301011103', '106-03': 'Y0301011102',
  '106-04': 'YM-WRH-05', '106-05': 'YM-WRH-03', '106-06': 'YM-WRH-02', '106-07': 'YM-WRH-04',
  '106-12': '106-12', '106-13': '106-13' };
const LABEL = {};
stationAt.forEach((n, cad) => LABEL[cad] = n.label);
const STEPS = [
  { code: '0101', act: '样品室取样', item: 'ABC', cad: '102-01', also: ['106-12'], min: 8, note: '取 {P} 相三芯电力电缆 A/B/C 各 1 根，放上 AGV 上料试验桌' },
  { code: '0152', act: '热收缩放料', item: 'A', cad: '106-03', min: 6, note: '放 A 根进入热收缩样制工位' },
  { code: '0142', act: '哑铃样放料', item: 'B', cad: '106-01', min: 6, note: '放 B 根进入哑铃样制工位' },
  { code: '0172', act: '径向放料', item: 'C', cad: '106-02', min: 6, note: '放 C 根进入径向样制工位' },
  { code: '0133', act: '热收缩取料', item: 'A', cad: '106-03', min: 6, note: '取制样完成的 A 根 1 段' },
  { code: '0132', act: '热收缩试验放料', item: 'A', cad: '106-04', min: 8, note: 'A 根放入热收缩检测工位' },
  { code: '0171', act: '径向取料', item: 'C', cad: '106-02', min: 6, note: '取 C 根切下的径向试样 1 片' },
  { code: '0115', act: '绝缘厚度试验上料', item: 'C', cad: '106-06', min: 8, note: 'C 的径向试样片放入绝缘层厚度检测工位' },
  { code: '0131', act: '热收缩试验取料', item: 'A', cad: '106-04', also: ['106-12'], min: 8, note: '取试验完成的 A 根放回 AGV 上料试验桌' },
  { code: '0141', act: '哑铃样取料', item: 'B', cad: '106-01', min: 8, note: '取 B 根制好的两盒哑铃试件（每盒 5 件）' },
  { code: '0122', act: '双工位机械性能放料', item: 'B', cad: '106-05', min: 8, note: '放 B 的一盒（5 件）进机械性能无人化检测工位' },
  { code: '0162', act: '热延伸试验放料', item: 'B', cad: '106-07', min: 8, note: '放 B 的另一盒（5 件）进热延伸试验智能检测系统' },
  { code: '0116', act: '绝缘厚度试验下料', item: 'C', cad: '106-06', min: 8, note: '取回 C 的那片绝缘厚度试样' },
  { code: '0143', act: '检测上下料桌放料', item: 'C', cad: '106-13', min: 6, note: 'C 的试样放到检测上下料试验桌' },
  { code: '0121', act: '双工位机械性能取料', item: 'B', cad: '106-05', min: 8, note: '取回 B 的一盒（5 件）已测试样' },
  { code: '0161', act: '热延伸试验取料', item: 'B', cad: '106-07', min: 8, note: '取回 B 的另一盒（5 件）已测试样' },
  { code: '0144', act: '检测上下料桌回料', item: 'B', cad: '106-13', min: 6, note: 'B 的两盒料放回检测上下料试验桌' },
  { code: '0173', act: '制样样品取料', item: 'BC', cad: '106-02', also: ['106-01'], min: 8, note: '在径向样制工位取 C 的样品线缆、在哑铃样制工位取 B 的样品线缆' },
  { code: '0151', act: '上料桌样品取料', item: 'A', cad: '106-12', min: 6, note: '捎回检测完成的 A 根样品线缆' },
  { code: '0102', act: '还样回样品室', item: 'ABC', cad: '102-01', min: 8, note: '三根检测完成的 {P} 相线缆送回 102 智能样品室' },
];
const PHASES = ['红', '黄', '绿'];
const HOME = '102-05';

/* 展开成「停靠序列」：每一步 = 执行站 + 顺路站；同一站连续出现则合并成一个停靠、挂多道任务 */
const visits = [];   // {cad, tasks:[{stepIdx, phaseIdx}]}
let seq = 0;
const tasks = [];
PHASES.forEach((ph, pi) => {
  STEPS.forEach((sp, si) => {
    const t = { seq: ++seq, phase: ph, phaseNo: pi + 1, stepNo: si + 1, code: sp.code,
      name: sp.act + '（' + ph + '相' + (sp.item === 'ABC' ? ' 三根' : sp.item.length > 1 ? ' ' + sp.item.split('').join('/') : ' ' + sp.item) + '）',
      cad: sp.cad, min: sp.min, note: sp.note.replace('{P}', ph) };
    tasks.push(t);
    /* 执行站挂任务；顺路站只留停靠（同一道任务的搬运落点），否则同一 seq 会被算两遍 */
    const push = (cad, mine) => {
      const last = visits[visits.length - 1];
      if (last && last.cad === cad) { if (mine) last.tasks.push(t); }
      else visits.push({ cad, tasks: mine ? [t] : [] });
    };
    push(sp.cad, true);
    (sp.also || []).forEach(cad => push(cad, false));
  });
});
/* 一圈 = 家位起步 → 68 个停靠 → 回家位闭合 */
const stopList = [{ cad: HOME, tasks: [] }].concat(visits, []);
const backHome = () => ({ cad: HOME, tasks: [] });
/* 最后一站是 102-01（还样），回 102-05 家位收圈 */
const legsPlan = [];
let prev = HOME;
stopList.forEach(st => { if (st.cad !== prev) { legsPlan.push([prev, st.cad]); prev = st.cad; } });
legsPlan.push([prev, HOME]);

/* ---------- 3. 生成 routeNodes / stops / tasks ---------- */
const speed = rb.demoCycle.speedMs || 0.75;
const routeNodes = [];
const stops = [];
let order = 0, nodeSeq = 0, totalM = 0;
function addStation(cad, st) {
  const src = stationAt.get(cad);
  const first = st.tasks[0];
  order++;
  routeNodes.push({ kind: 'station', order, cad, label: src.label, at: src.at.slice(),
    dwellSec: Math.max(6, st.tasks.length * 6),
    flowCode: first ? first.code : null, flow: first ? (first.code + ' ' + first.name) : '',
    taskNo: null, deviceCode: first ? (DEV[first.cad] || null) : null, seq: nodeSeq++ });
  stops.push({ order, cad, label: src.label, dwellSec: Math.max(6, st.tasks.length * 6),
    flowCode: first ? first.code : null, flow: first ? (first.code + ' ' + first.name) : '',
    deviceCode: first ? (DEV[first.cad] || null) : null,
    taskSeqs: st.tasks.map(t => t.seq), tasks: st.tasks.length });
}
function addTransits(fromCad, toCad) {
  const mid = route(fromCad, toCad);
  const a = stationAt.get(fromCad).at, b = stationAt.get(toCad).at;
  const chain = [a].concat(mid, [b]);
  for (let i = 1; i < chain.length - 1; i++) {
    routeNodes.push({ kind: 'transit', at: chain[i].slice(), label: '航路拐点（' + fromCad + '→' + toCad + '）', seq: nodeSeq++ });
  }
  totalM += chain.reduce((acc, p, i) => i ? acc + Math.abs(p[0] - chain[i - 1][0]) + Math.abs(p[1] - chain[i - 1][1]) : acc, 0);
}
addStation(HOME, stopList[0]);
let cursor = HOME;
stopList.slice(1).forEach(st => { addTransits(cursor, st.cad); addStation(st.cad, st); cursor = st.cad; });
addTransits(cursor, HOME);
const dwellSecTotal = stops.reduce((a, s) => a + s.dwellSec, 0);
const loopSec = Math.round((totalM / speed + dwellSecTotal));

const queueTasks = tasks.map(t => ({ seq: t.seq, flowCode: t.code, flowName: t.name, state: 'unassigned',
  cad: t.cad, robotId: null, elapsedMin: 0, plannedMin: t.min, time: '—', taskNo: null,
  phase: t.phase + '相', step: t.stepNo, note: t.note }));

console.log('停靠 ' + stops.length + '（有任务 ' + stops.filter(s => s.taskSeqs.length).length + '）'
  + ' · routeNodes ' + routeNodes.length + ' · 任务 ' + queueTasks.length
  + ' · 线路 ' + totalM.toFixed(1) + 'm · 一圈约 ' + loopSec + 's（' + (loopSec / 60).toFixed(1) + ' 分钟）');
console.log('样例停靠 1-6:', JSON.stringify(stops.slice(1, 4), null, 1));
console.log('样例任务 1-3:', JSON.stringify(queueTasks.slice(0, 3), null, 1));

if (process.argv.includes('--write')) {
  rb.routeNodes = routeNodes;
  rb.demoCycle.stops = stops;
  rb.demoCycle.note = '时间轴由 routeNodes 推导；三相（红/黄/绿）×20 步 = 60 道任务，取样与还样都落在 102-01；进出 106 走北墙开口、进出 102 走西门门洞。';
  rb.routeBasis = 'routeNodes 由 scripts/gen-106-flow.mjs 在「已验证安全的原折线」上建图后按停靠序列生成：每一段都是原路线的子段，墙体/门洞/CAD 占地判定天然成立。';
  rb.serves = ['102 家位/充电', '102 取样（粗制样电缆货架）', 'AGV 上料试验桌', '热收缩样制工位', '哑铃样制工位', '径向样制工位',
    '热收缩检测工位', '绝缘层厚度检测工位', '机械性能无人化检测工位', '热延伸试验智能检测系统', '检测上下料试验桌', '102 还样'];
  rb.mission = ['102 取样（三相各一圈内 20 步）', '跨区送样进 106（红线路线）', '106 内按 20 步取/送/放样', '102 还样', '回家位充电'];
  seed.overview['dispatch-queue'].tasks = queueTasks;
  seed.overview['dispatch-queue'].note = '流程配置（调度系统里的取/送/放样任务流）· 三相（红/黄/绿）×20 步 = 60 道；状态三分类按 AGV 当前步实时推导：进行中=正在执行的这一道，已完成=本轮已走完的，未派单=还没轮到的。';
  writeFileSync(SEED, JSON.stringify(seed, null, 2) + '\n');
  console.log('已写入 ' + SEED);
}
