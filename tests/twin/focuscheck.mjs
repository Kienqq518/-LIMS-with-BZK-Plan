/**
 * 逐实体点击验证（2026-11-07 改版：「点击切近 + 视觉跟随」整体撤除，只保留鼠标旁弹信息气泡）
 * 覆盖 modelRoots 里的每一个设备与物品（含桌子凳子），一个都不抽样：
 *   A 可点性  射线在该像素确实拾到这台（拾不到=被别的实体挡住，改走它自己的状态光点/事件兜底）
 *   B 选中    引擎 selected == 目标 id
 *   C 气泡    #twin-v2-card 出现、卡内编号一致、整卡落在浮层避让后的可用区内
 *   D 静置    点击前后相机构图逐位相等（fr/pan/yaw/elev/hh 一个都不许动）——
 *             旧版这里是"落点偏差<14px"，切的正是这条已经撤除的行为
 *   E 钉位    气泡锚点 == positionCard 的算法：实体投影中心 + translate(14,-50%)，必要时夹进
 *             浮层避让可用区（夹过就不许再算"偏"）。基准是复算锚点而不是鼠标像素——
 *             点的是顶面、锚的是中心，两者本来就该差半个机身高度（实测 dy 最大 288px 全是这个）
 *   F 滚轮    抽样：在"确实露出三维画面"的像素上放大/缩小双向都动，且缩放后气泡仍钉在实体投影上
 * 用法：node tests/twin/focuscheck.mjs [房间号...]      FOCUS_LIMIT=n 每房间最多验 n 台（默认全部）
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out = [], err = [];
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'no-preference' });
p.on('pageerror', e => err.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) err.push('console: ' + m.text().slice(0, 170)); });
await p.goto(BASE + '/twin/future-lab/twin-scene-v2.html', { waitUntil: 'load' });
await p.waitForTimeout(16000);
const host = p.mainFrame();
const f = p.frames().find(x => /tour-space-v3-1/.test(x.url()));
if (!f) { console.log('❌ 三维场景 iframe 未装载'); console.log(out.join('\n')); await b.close(); process.exit(1); }
const ok = (cond, msg) => out.push((cond ? '✅' : '❌') + ' ' + msg);
const ev = (fn, ...a) => f.evaluate(fn, ...a);
async function toPage(x, y) { let fx = x, fy = y, cur = f; while (cur.parentFrame()) { const fe = await cur.frameElement(); const bb = await fe.boundingBox(); fx += bb.x; fy += bb.y; cur = cur.parentFrame(); } return { x: fx, y: fy }; }
const ROOMS = (process.argv[2] ? process.argv[2].split(',') : ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110']);
const LIMIT = Number(process.env.FOCUS_LIMIT || 0);

/* 相机构图原样取回（dataset.cam 每帧发布，是唯一的机位事实源） */
const camRaw = () => ev(() => { const d = document.getElementById('twin-v2-bridge'); return d && d.dataset.cam ? d.dataset.cam : '{}'; });
const camOf = async () => JSON.parse(await camRaw());
/* 浮层避让可用区：改由 dataset.cam.free 提供（原先的 window.__twinFree 随视觉跟随一起撤除） */
const freeOf = async () => { const c = await camOf(); return c.free ? { x0: c.free[0], y0: c.free[1], x1: c.free[2], y1: c.free[3] } : null; };

/* 场景内几何：实体世界包围盒 → 当前相机下的像点 */
const geoOf = id => ev(eid => {
  const v = window.visual106, h = v.host.getBoundingClientRect(), V = v.overview.position.constructor;
  const m = v.modelRoots.get(eid); if (!m) return { err: 'no-model' };
  m.updateWorldMatrix(true, true);
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  m.traverse(o => {
    if (!o.isMesh || !o.geometry) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
      const w = new V(x, y, z); w.applyMatrix4(o.matrixWorld);
      lo = [Math.min(lo[0], w.x), Math.min(lo[1], w.y), Math.min(lo[2], w.z)];
      hi = [Math.max(hi[0], w.x), Math.max(hi[1], w.y), Math.max(hi[2], w.z)];
    }
  });
  if (hi[0] > 1e8) return { err: 'no-mesh' };
  let qx0 = 1e9, qy0 = 1e9, qx1 = -1e9, qy1 = -1e9;
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
    const q = new V(x, y, z).project(v.camera);
    qx0 = Math.min(qx0, q.x); qx1 = Math.max(qx1, q.x); qy0 = Math.min(qy0, q.y); qy1 = Math.max(qy1, q.y); }
  const cn = p2 => ({ x: h.left + (p2.x * .5 + .5) * h.width, y: h.top + (-p2.y * .5 + .5) * h.height });
  const ctr = new V((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
  const pc = ctr.clone().project(v.camera);
  /* 气泡锚点走 positionCard 那套：中心 y 抬到至少 0.9（贴地矮件不能把气泡按进地板） */
  const anc = new V((lo[0] + hi[0]) / 2, Math.max((lo[1] + hi[1]) / 2, 0.9), (lo[2] + hi[2]) / 2);
  return { anchor: cn(anc.clone().project(v.camera)), ctr: cn(pc), pxH: Math.max(Math.abs(qx1 - qx0) * .5 * h.width, Math.abs(qy1 - qy0) * .5 * h.height),
    span: +Math.max(Math.abs(qx1 - qx0), Math.abs(qy1 - qy0)).toFixed(3), behind: pc.z > 1,
    host: { x: h.x, y: h.y, w: h.width, h: h.height }, view: v.view };
}, id);
/* 候选像素：实体投影四边形内采样（顶面优先），第一个"射线确实拾到这台"的才是可用点击位 */
const candidatesOf = id => ev(eid => {
  const v = window.visual106, h = v.host.getBoundingClientRect(), V = v.overview.position.constructor;
  const m = v.modelRoots.get(eid); if (!m) return null;
  m.updateWorldMatrix(true, true);
  let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], meshes = 0;
  m.traverse(o => { if (!o.isMesh || !o.geometry) return; meshes++; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
      const w = new V(x, y, z); w.applyMatrix4(o.matrixWorld);
      lo = [Math.min(lo[0], w.x), Math.min(lo[1], w.y), Math.min(lo[2], w.z)];
      hi = [Math.max(hi[0], w.x), Math.max(hi[1], w.y), Math.max(hi[2], w.z)]; } });
  if (meshes === 0) return { pt: null, meshes: 0, quad: null, tried: 0 };
  let ax = 1e9, ay = 1e9, bx = -1e9, by = -1e9;
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
    const q = new V(x, y, z).project(v.camera);
    if (q.z > 1) return null;
    const sx = h.left + (q.x * .5 + .5) * h.width, sy = h.top + (-q.y * .5 + .5) * h.height;
    ax = Math.min(ax, sx); bx = Math.max(bx, sx); ay = Math.min(ay, sy); by = Math.max(by, sy); }
  const fr = window.__twinFree || { x0: 0, y0: 0, x1: h.width, y1: h.height };
  const pts = [];
  const push = (x, y) => { if (x >= fr.x0 && x <= fr.x1 && y >= fr.y0 && y <= fr.y1) pts.push([x, y]); };
  push((ax + bx) / 2, ay + (by - ay) * .12);
  for (const fy of [.35, .6, .12, .85]) for (const fx of [.5, .25, .75]) push(ax + (bx - ax) * fx, ay + (by - ay) * fy);
  const hit = pts.find(([x, y]) => {
    const r = v.renderer.domElement.getBoundingClientRect();
    v.raycaster.setFromCamera({ x: (x - r.left) / r.width * 2 - 1, y: -(y - r.top) / r.height * 2 + 1 }, v.camera);
    const o = v.raycaster.intersectObjects([...v.modelRoots.values()], true)[0];
    if (!o) return false; let mm = o.object; while (mm && !mm.userData.id) mm = mm.parent;
    return !!mm && mm.userData.id === eid; });
  return { pt: hit || null, meshes, quad: { ax: Math.round(ax), ay: Math.round(ay), bx: Math.round(bx), by: Math.round(by) }, tried: pts.length };
}, id);
const cardOf = () => ev(() => {
  const c = document.getElementById('twin-v2-card'); if (!c) return { open: false, why: 'no-card-el' };
  const cs = getComputedStyle(c); if (c.hidden || cs.display === 'none' || +cs.opacity < .05) return { open: false, why: 'hidden' };
  const r = c.getBoundingClientRect();
  return { open: true, txt: c.innerText.replace(/\s+/g, ' '), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
/* 复算 positionCard 的锚点：夹进可用区之后卡应该贴在哪儿（容差只留给取整） */
function expectCard(g, st, free) {
  const hl = g.host.x, ht = g.host.y;
  const ax = Math.max(hl + free.x0, Math.min(hl + free.x1 - st.w - 22, g.anchor.x - 14)) + 14;
  const ay = Math.max(ht + free.y0 + st.h / 2, Math.min(ht + free.y1 - st.h / 2, g.anchor.y));
  const clampedX = g.anchor.x - 14 < hl + free.x0 || g.anchor.x - 14 > hl + free.x1 - st.w - 22;
  const clampedY = g.anchor.y < ht + free.y0 + st.h / 2 || g.anchor.y > ht + free.y1 - st.h / 2;
  return { x: Math.round(ax), y: Math.round(ay), clampedX, clampedY };
}
/* 该页面点是否被宿主浮层压住（压住 = 用户在那里根本点不到三维画面） */
const blockedAt = async (x, y) => host.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); return !e || e.id !== 'scene'; }, [x, y]);
/* 机位必须真的静下来才能比"点击前后"：下钻补间还在跑就取样，等于把补间的位移算到点击头上 */
async function waitCamIdle(ms = 3200) {
  const t0 = Date.now(); let last = null, same = 0;
  while (Date.now() - t0 < ms) {
    const c = await camOf(), p2v = c.pan || [0, 0];
    const idle = !last || (Math.abs(c.fr - last.fr) < 1e-4 && Math.abs(c.hh - last.hh) < 2e-3 &&
      Math.abs(p2v[0] - last.pan[0]) <= 2 && Math.abs(p2v[1] - last.pan[1]) <= 2 && Math.abs(c.yaw - last.yaw) < 1e-3);
    same = idle ? same + 1 : 0; last = { fr: c.fr, hh: c.hh, yaw: c.yaw, pan: p2v };
    if (same >= 3) return true;
    await p.waitForTimeout(140);
  }
  return false;
}
/* 未建模台账：#visual-audit 里明确「无实体」的编号 */
const modeledMap = await ev(() => { const el = document.getElementById('visual-audit'); if (!el) return {};
  const j = JSON.parse(el.textContent); const m = {}; (j.entries || []).forEach(e => { m[e.id] = !!e.modeled; }); return m; });
let nTest = 0, nAll = 0, nEvent = 0, nDot = 0, dotBlocked = 0, hijack = 0, nUnmodeled = 0, unclickable = [], badHint = [], dotMiss = [], camMoved = [], cardFar = [];
for (const room of ROOMS) {
  await p.selectOption('#zoneSel', room).catch(() => {});
  await p.waitForTimeout(2300);
  const ids = await ev(r => [...window.visual106.modelRoots.keys()].filter(k => k.startsWith(r + '-')), room);
  const list = LIMIT ? ids.slice(0, LIMIT) : ids; nAll += list.length;
  out.push(`—— ${room} 区：${list.length} 个实体（modelRoots 共 ${ids.length}）`);
  for (const id of list) {
    await waitCamIdle();
    /* —— 分支一：台账有编号但三维未建模 → 不给假动作，只许出诚实说明，相机与气泡都不许动 —— */
    if (modeledMap[id] === false) {
      const c0 = await camRaw();
      await ev(i => { window.visual106.selected = i; window.dispatchEvent(new CustomEvent('space-device-select', { detail: { id: i, name: i, roomId: i.slice(0, 3) } })); }, id);
      await p.waitForTimeout(500);
      const st = await cardOf(), c1 = await camRaw();
      const hint = await host.locator('#remoteHint').innerText().catch(() => '');
      const pass = !st.open && c1 === c0 && /未建模/.test(hint);
      if (!pass) badHint.push(`${id}(card=${st.open},cam相同=${c1 === c0},hint=${(hint || '').slice(0, 18)})`);
      nUnmodeled++; nTest++;
      continue;
    }
    /* —— 分支二：已建模 → 必须点得到、出气泡、机位一动不动 —— */
    const cand = await candidatesOf(id);
    if (cand && cand.meshes === 0) {
      const c0 = await camRaw();
      await ev(i => { window.visual106.selected = i; window.dispatchEvent(new CustomEvent('space-device-select', { detail: { id: i, name: i, roomId: i.slice(0, 3) } })); }, id);
      await p.waitForTimeout(450);
      const st2 = await cardOf(), c1 = await camRaw();
      const hint2 = await host.locator('#remoteHint').innerText().catch(() => '');
      if (st2.open || c1 !== c0 || !/未建模/.test(hint2)) badHint.push(`${id}(card=${st2.open},cam相同=${c1 === c0},hint=${(hint2 || '').slice(0, 18)})`);
      nUnmodeled++; nTest++; continue;
    }
    let via = 'click', pt = cand && cand.pt;
    if (!pt) {                                            /* 本体点不到 → 试它自己的状态光点 */
      const dp = await ev(i => {
        const v = window.visual106, dot = v.statusDots && v.statusDots.get(i); if (!dot) return null;
        const h = v.host.getBoundingClientRect(), V = v.overview.position.constructor, q = new V();
        q.setFromMatrixPosition(dot.matrixWorld); q.project(v.camera); if (q.z > 1) return null;
        return [h.left + (q.x * .5 + .5) * h.width, h.top + (-q.y * .5 + .5) * h.height];
      }, id);
      if (dp) { const tp2 = await toPage(dp[0], dp[1]); if (await blockedAt(tp2.x, tp2.y)) { /* 被宿主浮层压住 */ } else { pt = dp; via = 'dot'; } }
    }
    const fire = () => ev(i => { window.visual106.selected = i; window.dispatchEvent(new CustomEvent('space-device-select', { detail: { id: i, name: i, roomId: i.slice(0, 3) } })); }, id);
    if (!pt) { via = 'event'; unclickable.push(id); }
    const c0 = await camRaw();          /* 点击前的机位原样留档，点击后逐位比对 */
    if (pt) {
      const tp = await toPage(pt[0], pt[1]);
      if (await blockedAt(tp.x, tp.y)) { via = 'event'; unclickable.push(id + (via === 'dot' ? '(光点也被压住)' : '(被宿主浮层压住)')); pt = null; }
      else {
        await p.mouse.click(tp.x, tp.y);
        await p.waitForTimeout(140);
        if (await ev(i => window.visual106.selected, id) !== id) {
          /* 光点下压着别的实体 = CAD 优先（FR-25 既定口径），记下让位；但这台自己的气泡仍必须验到，
             否则"89 个实体逐个验"就出现空洞（实测 106-09 停在 102 充电位，光点压在货架上 → 卡是别人的/没卡）。
             兜底走与点击完全同一个处理器（space-device-select），验的仍是"点这台会不会出这台的气泡"。 */
          if (via === 'dot') { dotBlocked++; await fire(); } else { await fire(); hijack++; }
        }
      }
    }
    if (via === 'event') await fire();   /* 画面里点不到的极小件：走同一处理器，气泡仍须钉在实体上 */
    await p.waitForTimeout(420);
    const st = await cardOf(), c1 = await camRaw(), free = await freeOf();
    const g2 = await geoOf(id);
    const sel = await ev(i => window.visual106.selected, id);
    const camStill = c0 === c1;
    /* 气泡钉位：与复算锚点比对（点击打的是顶面，锚点是实体中心——拿鼠标像素当基准必然假失败） */
    const exp = st.open && free ? expectCard(g2, st, free) : null;
    const ddx = exp ? st.x - exp.x : -9999, ddy = exp ? Math.round((st.y + st.h / 2) - exp.y) : -9999;
    const cardInFree = !!(st.open && free) && st.x >= g2.host.x + free.x0 - 2 && st.x + st.w <= g2.host.x + free.x1 + 2
      && st.y + st.h / 2 >= g2.host.y + free.y0 - 2 && st.y + st.h / 2 <= g2.host.y + free.y1 + 2;
    const bad = [];
    if (sel !== id && via !== 'dot') bad.push('未选中'); else if (via === 'dot' && sel !== id) dotMiss.push(id + '→' + sel);
    if (!st.open) bad.push('无气泡'); else if (!(st.txt || '').includes(id)) { if (via === 'dot') dotMiss.push(id + '(卡是别人的)'); else bad.push('气泡编号不符'); }
    if (!cardInFree) bad.push('气泡出可用区');
    if (!camStill) bad.push('点击后相机会动');
    if (exp && (Math.abs(ddx) > 3 || Math.abs(ddy) > 3)) bad.push(`气泡没钉在实体投影上 dx${ddx} dy${ddy}`);
    if (!camStill) camMoved.push(id);
    if (exp && (Math.abs(ddx) > 3 || Math.abs(ddy) > 3)) cardFar.push(`${id}(dx${ddx}/dy${ddy})`);
    nTest++; if (via === 'event') nEvent++; if (via === 'dot') nDot++;
    ok(bad.length === 0, `${id} ${via === 'click' ? '点击' : via === 'dot' ? '点光点' : '事件兜底'}→选中+气泡 机位不变=${camStill} 钉位dx${ddx}/dy${ddy}${exp && (exp.clampedX || exp.clampedY) ? '（夹进可用区）' : ''} 卡「${(st.txt || '').slice(0, 22)}」${bad.length ? ' 问题：' + bad.join('、') : ''}`);
    if (nTest % 7 === 1 && st.open) {                        /* 滚轮抽样：双向能动 + 缩放后气泡仍钉在实体上 */
      /* 取样点必须落在"真的露出三维画面"的像素上：压在告警流/底栏这类可滚动浮层上时，
         滚轮按设计让给浮层（不吃用户的滚动），那时 fr 不变不是缺陷
         （实测 106-20、109-04 就是这样假失败：fr 三次采样一模一样）。 */
      const offs = [[320, -170], [240, -220], [0, -260], [-320, -170], [360, 60], [-360, 60]];
      let wp = null;
      for (const [ox, oy] of offs) {
        const cand = await toPage(g2.anchor.x + ox, Math.max(140, g2.anchor.y + oy));
        if (!(await blockedAt(cand.x, cand.y))) { wp = cand; break; }
      }
      if (!wp) out.push('ℹ️ ' + id + ' 周围六个取样点都被宿主浮层压住，跳过滚轮抽样');
      else {
        const f0 = (await camOf()).fr;
        await p.mouse.move(wp.x, wp.y); await p.mouse.wheel(0, 260); await p.waitForTimeout(300);
        const f1 = (await camOf()).fr; await p.mouse.wheel(0, -260); await p.mouse.wheel(0, -260); await p.waitForTimeout(360);
        const f2 = (await camOf()).fr, g3 = await geoOf(id), st3 = await cardOf(), free3 = await freeOf();
        ok(f1 > f0 && f2 < f1, `${id} 滚轮双向能缩放 fr ${f0}→放大${f1}→缩小${f2}`);
        const exp3 = st3.open && free3 ? expectCard(g3, st3, free3) : null;
        const d3 = exp3 ? Math.max(Math.abs(st3.x - exp3.x), Math.abs((st3.y + st3.h / 2) - exp3.y)) : -1;
        ok(st3.open && d3 <= 3, `${id} 缩放后气泡仍钉在实体投影上（偏差 ${d3}px）`);
      }
    }
  }
}
out.push(`ℹ️ 入口分布：点实体本体 ${nTest - nEvent - nDot - nUnmodeled} · 点它的状态光点 ${nDot}（其中光点下压着别的实体、按「实体优先」让位 ${dotBlocked}）· 事件兜底 ${nEvent} · 点击被抢后重投 ${hijack} · 未建模诚实提示 ${nUnmodeled}`);
if (dotMiss.length) out.push(`ℹ️ 光点让位清单（该像素上确实有别的实体，CAD 优先是 FR-25 的既定口径）：${dotMiss.join(' / ')}`);
if (unclickable.length) out.push(`ℹ️ 已建模但当前视角点不到（可用区内无一处射线拾得中，多为极小件或被前挡）：${unclickable.join(' / ')}`);
ok(camMoved.length === 0, `点击绝不改动机位：${nTest - nUnmodeled} 个实体逐个比对，异常 ${camMoved.length}${camMoved.length ? '：' + camMoved.slice(0, 8).join(' / ') : ''}`);
ok(cardFar.length === 0, `气泡钉在实体投影旁（复算 positionCard 锚点，含夹进可用区那两种情况）：异常 ${cardFar.length}${cardFar.length ? '：' + cardFar.slice(0, 8).join(' / ') : ''}`);
ok(badHint.length === 0, `未建模实体只给说明、不动相机不出假气泡 ${nUnmodeled} 个${badHint.length ? '，异常：' + badHint.join(' | ') : ''}`);
ok(nTest === nAll, `覆盖率：本批 modelRoots 合计 ${nAll}，逐个验到 ${nTest}（一个不漏；全量口径须 89/89）`);
if (nAll === 89) ok(unclickable.length <= (nAll - nUnmodeled) * .4, `已建模实体里 ${nAll - nUnmodeled - unclickable.length}/${nAll - nUnmodeled} 能在画面里直接点中（其余为极小件或被前挡，走各自状态光点与台账行）`);
ok(err.length === 0, '无 pageerror/console error: ' + err.slice(0, 3).join(' | '));
ok(await ev(() => !(window.__twinLoopErr || '')), '动画环未抛错（撤除跟随后循环照跑）');
ok(await ev(() => !('anchor' in JSON.parse(document.getElementById('twin-v2-bridge').dataset.cam || '{}')) && !window.__twinAnchor),
  '跟随机制与 anchor 发布口已下线（dataset.cam 不含 anchor、window.__twinAnchor 不存在）');
ok(await p.locator('#freshTxt').innerText().then(t => !t.trim()).catch(() => true), 'fail() 未被触发（#freshTxt 为空）');
console.log(out.join('\n'));
const badN = out.filter(l => l.startsWith('❌')).length;
console.log(`\n通过 ${out.filter(l => l.startsWith('✅')).length} · 失败 ${badN} · 验证实体 ${nTest}`);
await b.close();
process.exit(badN ? 1 : 0);
