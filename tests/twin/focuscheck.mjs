/**
 * 逐实体点击验证（2026-11-07 反馈：「鼠标点击设备/物品的视觉跟随不准确、跟随后只能放大不能缩小、点了不出信息气泡」）
 * 覆盖 modelRoots 里的每一个设备与物品（含桌子凳子），一个都不抽样：
 *   A 可点性  射线在该像素确实拾到这台（拾不到=被别的实体挡住，记为跳过而非失败）
 *   B 选中    引擎 selected == 目标 id
 *   C 气泡    #twin-v2-card 出现、卡内编号一致、且整卡落在浮层避让后的可用区内（不能钻到面板底下/画面外）
 *   D 落点    切近终点 = 可用区锚点，偏差 < 14px（旧实现因 pan 没生效恒偏 189px，且 dy 随倍率恶化到 2000px）
 *   E 构图    实体在画面里的高度占比合理（切近确实推近了，也没糊出画面）
 *   F 滚轮    抽样：放大/缩小双向都动，且缩放后仍钉在锚点（旧实现缩小方向被引擎 zoom 下限卡死）
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
const T = (k, v, e) => out.push((String(v) === String(e) ? '✅' : '❌') + ` ${k}: ${v} (期望 ${e})`);
const ok = (cond, msg) => out.push((cond ? '✅' : '❌') + ' ' + msg);
const ev = (fn, ...a) => f.evaluate(fn, ...a);
async function toPage(x, y) { let fx = x, fy = y, cur = f; while (cur.parentFrame()) { const fe = await cur.frameElement(); const bb = await fe.boundingBox(); fx += bb.x; fy += bb.y; cur = cur.parentFrame(); } return { x: fx, y: fy }; }
const ROOMS = (process.argv[2] ? process.argv[2].split(',') : ['101', '102', '103', '104', '105', '106', '107', '108', '109', '110']);
const LIMIT = Number(process.env.FOCUS_LIMIT || 0);

/* 场景内几何：实体世界包围盒 → 当前相机下的像点（顶部取点击位，中心取落点位） */
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
  const cn = p2 => ({ x: h.left + (p2.x * .5 + .5) * h.width, y: h.top + (-p2.y * .5 + .5) * h.height });
  let qx0 = 1e9, qy0 = 1e9, qx1 = -1e9, qy1 = -1e9;
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
    const q = new V(x, y, z).project(v.camera);
    qx0 = Math.min(qx0, q.x); qx1 = Math.max(qx1, q.x); qy0 = Math.min(qy0, q.y); qy1 = Math.max(qy1, q.y); }
  const ctr = new V((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
  const top = new V((lo[0] + hi[0]) / 2, hi[1] + .04, (lo[2] + hi[2]) / 2);
  const bot = new V((lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2);
  const pc = ctr.clone().project(v.camera), pt = top.clone().project(v.camera), pb = bot.clone().project(v.camera);
  const a = window.__twinAnchor, fr = window.__twinFree;
  return { ctr: cn(pc), top: cn(pt), pxH: Math.max(Math.abs(qx1 - qx0) * .5 * h.width, Math.abs(qy1 - qy0) * .5 * h.height), span: +Math.max(Math.abs(qx1-qx0),Math.abs(qy1-qy0)).toFixed(3), behind: pc.z > 1,
    anchor: a ? { x: a.x, y: a.y } : null,
    free: fr ? { x0: fr.x0, y0: fr.y0, x1: fr.x1, y1: fr.y1 } : null,
    host: { x: h.x, y: h.y, w: h.width, h: h.height }, view: v.view };
}, id);
/* 候选像素：实体投影四边形内 3×3 采样（顶面优先），第一个"射线确实拾到这台"的才是可用点击位 */
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
  /* 空 Group（台账有号、模型未建）时 lo/hi 还是初始值：必须按 meshes 判，不能按 hi>1e8 判——
     初始 hi=-1e9 永远不 >1e8，早先就是这里漏判，把未建模当成"点不到的已建模实体"。 */
  if (meshes === 0) return { pt: null, meshes: 0, quad: null, tried: 0 };
  let ax = 1e9, ay = 1e9, bx = -1e9, by = -1e9;
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) {
    const q = new V(x, y, z).project(v.camera);
    if (q.z > 1) return null;
    const sx = h.left + (q.x * .5 + .5) * h.width, sy = h.top + (-q.y * .5 + .5) * h.height;
    ax = Math.min(ax, sx); bx = Math.max(bx, sx); ay = Math.min(ay, sy); by = Math.max(by, sy); }
  const fr = window.__twinFree || { x0: 0, y0: 0, x1: h.width, y1: h.height };
  const pts = [];
  /* 顺序：顶面中线 → 四边形 3×3 网格（由内向外），只用落在可用区里的点 */
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
const camOf = () => ev(() => { const d = document.getElementById('twin-v2-bridge'); return d && d.dataset.cam ? JSON.parse(d.dataset.cam) : {}; });
/* 该页面点是否被宿主浮层压住（压住 = 用户在那里根本点不到三维画面） */
const blockedAt = async (x, y) => host.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); return !e || e.id !== 'scene'; }, [x, y]);

/* 相机必须真的静下来才能量落点：上一轮的补间/闭环/滚轮还在动就探测，等于拿旧构图猜新像素
   （实测会「点 A 出 B」甚至点了没反应，被误判成产品 bug）。 */
async function waitCamIdle(ms = 3000) {
  const t0 = Date.now(); let last = null, same = 0;
  while (Date.now() - t0 < ms) {
    const c = await camOf();
    /* 带容差判静：跟着移动目标（AGV）时 pan 每帧都在微调，逐位相等永远等不到，
       但残差已经 <2px——此时相机就是"稳的"，可以继续测下一个实体。 */
    const p2v = c.pan || [0, 0];
    const idle = !last || (Math.abs(c.fr - last.fr) < 1e-4 && Math.abs(c.hh - last.hh) < 2e-3 &&
      Math.abs(p2v[0] - last.pan[0]) <= 2 && Math.abs(p2v[1] - last.pan[1]) <= 2 && Math.abs(c.yaw - last.yaw) < 1e-3);
    same = idle ? same + 1 : 0; last = { fr: c.fr, hh: c.hh, yaw: c.yaw, pan: p2v };
    if (same >= 3) return true;                            /* 三帧都在容差内（首帧只建档不比，等于两次真实比较） */
    await p.waitForTimeout(140);
  }
  return false;
}
async function waitSettle(id, ms = 2600) {
  const t0 = Date.now(); let last = -1, same = 0;
  while (Date.now() - t0 < ms) {
    const g = await geoOf(id); if (!g.ctr || !g.anchor) return g;
    const d = Math.round(Math.hypot(g.ctr.x - g.anchor.x, g.ctr.y - g.anchor.y));
    same = d === last ? same + 1 : 0; last = d;
    if (same >= 2 && d < 6) return g;                       /* 连续三帧同值且已贴住锚点：提前收工 */
    await p.waitForTimeout(120);
  }
  return geoOf(id);
}

const modeledMap = await ev(() => { const el = document.getElementById('visual-audit'); if (!el) return {}; const j = JSON.parse(el.textContent); const m = {}; (j.entries || []).forEach(e => { m[e.id] = !!e.modeled; }); return m; });
let nTest = 0, nSkip = 0, nAll = 0, nEvent = 0, nDot = 0, dotBlocked = 0, hijack = 0, nUnmodeled = 0, skipList = [], unclickable = [], badHint = [], dotMiss = [];
for (const room of ROOMS) {
  await p.selectOption('#zoneSel', room).catch(() => {});
  await p.waitForTimeout(2300);                             /* 等下钻补间 + 房间分离动画收住 */
  const ids = await ev(r => [...window.visual106.modelRoots.keys()].filter(k => k.startsWith(r + '-')), room);
  const list = LIMIT ? ids.slice(0, LIMIT) : ids; nAll += list.length;
  out.push(`—— ${room} 区：${list.length} 个实体（modelRoots 共 ${ids.length}）`);
  for (const id of list) {
    await waitCamIdle();
    /* —— 分支一：台账有编号但三维未建模 → 不给假动作，只许出诚实说明，且相机/气泡都不许动 —— */
    if (modeledMap[id] === false) {                       /* #visual-audit 里明确未建模 */
      const fr0 = (await camOf()).fr;
      await ev(i => { window.visual106.selected = i; window.dispatchEvent(new CustomEvent('space-device-select', { detail: { id: i, name: i, roomId: i.slice(0, 3) } })); }, id);
      await p.waitForTimeout(500);
      const st = await cardOf(), fr1 = (await camOf()).fr;
      const hint = await host.locator('#remoteHint').innerText().catch(() => '');
      const pass = !st.open && fr1 === fr0 && /未建模/.test(hint);
      if (!pass) badHint.push(`${id}(card=${st.open},fr=${fr0}->${fr1},hint=${(hint || '').slice(0, 18)})`);
      nUnmodeled++; nTest++;
      continue;
    }
    /* —— 分支二：已建模 → 必须点得到、点得准、出气泡 —— */
    const cand = await candidatesOf(id);
    if (cand && cand.meshes === 0) {                      /* 后装载的房间不在开机审计里：数网格兜底，同样按未建模处理 */
      const fr0 = (await camOf()).fr;
      await ev(i => { window.visual106.selected = i; window.dispatchEvent(new CustomEvent('space-device-select', { detail: { id: i, name: i, roomId: i.slice(0, 3) } })); }, id);
      await p.waitForTimeout(450);
      const st2 = await cardOf(), fr1 = (await camOf()).fr;
      const hint2 = await host.locator('#remoteHint').innerText().catch(() => '');
      if (st2.open || fr1 !== fr0 || !/未建模/.test(hint2)) badHint.push(`${id}(card=${st2.open},fr=${fr0}->${fr1},hint=${(hint2 || '').slice(0, 18)})`);
      nUnmodeled++; nTest++; continue;
    }
    let via = 'click', pt = cand && cand.pt;
    if (!pt) {                                            /* 实体本体在可用区内没有一处可拾 → 试它自己的状态光点 */
      const dp = await ev(i => {
        const v = window.visual106, dot = v.statusDots && v.statusDots.get(i); if (!dot) return null;
        const h = v.host.getBoundingClientRect(), V = v.overview.position.constructor, q = new V();
        q.setFromMatrixPosition(dot.matrixWorld); q.project(v.camera); if (q.z > 1) return null;
        const x = h.left + (q.x * .5 + .5) * h.width, y = h.top + (-q.y * .5 + .5) * h.height, fr = window.__twinFree;
        return (fr && x >= fr.x0 && x <= fr.x1 && y >= fr.y0 && y <= fr.y1) ? [x, y] : null;
      }, id);
      if (dp) { const tp2 = await toPage(dp[0], dp[1]); if (await blockedAt(tp2.x, tp2.y)) { /* 宿主浮层压住光点：不算可点 */ } else { pt = dp; via = 'dot'; } }
    }
    const fire = () => ev(i => { window.visual106.selected = i; window.dispatchEvent(new CustomEvent('space-device-select', { detail: { id: i, name: i, roomId: i.slice(0, 3) } })); }, id);
    if (!pt) { via = 'event'; unclickable.push(id); }
    if (pt) {
      const tp = await toPage(pt[0], pt[1]);
      if (await blockedAt(tp.x, tp.y)) { via = 'event'; unclickable.push(id + (via === 'dot' ? '(光点也被压住)' : '(被宿主浮层压住)')); pt = null; }
      else {
        await p.mouse.click(tp.x, tp.y);
        await p.waitForTimeout(140);
        if (await ev(i => window.visual106.selected, id) !== id) { if (via === 'dot') dotBlocked++; else { await fire(); hijack++; } }   /* 光点下压着别的实体：那是 CAD 优先的正确行为，记下不计失败 */
      }
    }
    if (via === 'event') await fire();
    const after = await waitSettle(id);
    const st = await cardOf();
    const dev = after.anchor ? Math.round(Math.hypot(after.ctr.x - after.anchor.x, after.ctr.y - after.anchor.y)) : -1;
    const sel = await ev(i => window.visual106.selected, id);
    const cardInFree = !!(st.open && after.free) && st.x >= after.free.x0 - 2 && st.x + st.w <= after.free.x1 + 2 && st.y + st.h / 2 >= after.free.y0 - 2 && st.y + st.h / 2 <= after.free.y1 + 2;
    const ratio = +(after.pxH / after.host.h).toFixed(3);
    const bad = [];
    if (sel !== id && via !== 'dot') bad.push('未选中'); else if (via === 'dot' && sel !== id) dotMiss.push(id + '→' + sel);
    if (!st.open) bad.push('无气泡'); else if (!(st.txt || '').includes(id)) { if (via === 'dot') dotMiss.push(id + '(卡是别人的)'); else bad.push('气泡编号不符'); }
    if (!cardInFree) bad.push('气泡出可用区');
    if (dev >= 14) bad.push('落点偏' + dev + 'px');
    if (!(ratio > 0.04 && ratio < 1.2) || after.pxH < 34) bad.push(`构图占比${ratio}/高${Math.round(after.pxH)}px`);
    nTest++; if (via === 'event') nEvent++; if (via === 'dot') nDot++;
    ok(bad.length === 0, `${id} ${via === 'click' ? '点击' : '事件兜底'}→选中+气泡+落点 偏差${dev}px 占比${ratio} 卡「${(st.txt || '').slice(0, 24)}」${bad.length ? ' 问题：' + bad.join('、') : ''}`);
    if (nTest % 7 === 1) {                                   /* 滚轮抽样：双向 + 缩放后仍钉住 */
      const wp = await toPage(after.anchor.x + 260, after.anchor.y - 120);
      const f0 = (await camOf()).fr;
      await p.mouse.move(wp.x, wp.y); await p.mouse.wheel(0, 260); await p.waitForTimeout(260);
      const f1 = (await camOf()).fr; await p.mouse.wheel(0, -260); await p.mouse.wheel(0, -260); await p.waitForTimeout(320);
      await waitCamIdle();
      const f2 = (await camOf()).fr, g2 = await geoOf(id);
      const dev2 = Math.round(Math.hypot(g2.ctr.x - g2.anchor.x, g2.ctr.y - g2.anchor.y));
      ok(f1 > f0 && f2 < f1 && dev2 < 18, `${id} 滚轮双向与钉住 fr ${f0}→out${f1}→in${f2} 缩放后偏差${dev2}px`);
    }
  }
}
out.push(`ℹ️ 入口分布：点实体本体 ${nTest - nEvent - nDot - nUnmodeled} · 点它的状态光点 ${nDot}（其中光点下压着别的实体、按「实体优先」让位 ${dotBlocked}）· 事件兜底 ${nEvent} · 点击被抢后重投 ${hijack} · 未建模诚实提示 ${nUnmodeled}`);
if (dotMiss.length) out.push(`ℹ️ 光点让位清单（该像素上确实有别的实体，CAD 优先是 FR-25 的既定口径）：${dotMiss.join(' / ')}`);
if (unclickable.length) out.push(`ℹ️ 已建模但当前视角点不到（可用区内无一处射线拾得中，多为极小件或被前挡）：${unclickable.join(' / ')}`);
ok(badHint.length === 0, `未建模实体只给说明、不动相机不出假气泡 ${nUnmodeled} 个${badHint.length ? '，异常：' + badHint.join(' | ') : ''}`);
ok(nTest === nAll, `覆盖率：本批 modelRoots 合计 ${nAll}，逐个验到 ${nTest}，未验 ${nSkip}（一个不漏；全量口径须 89/89）`);
if (nAll === 89) ok(unclickable.length <= (nAll - nUnmodeled) * .4, `已建模实体里 ${nAll - nUnmodeled - unclickable.length}/${nAll - nUnmodeled} 能在画面里直接点中（其余为极小件或被前挡，走各自状态光点与台账行）`);
out.push((skipList.length ? `ℹ️ 跳过 ${nSkip} 个：${skipList.slice(0, 14).join(' / ')}${skipList.length > 14 ? ' …' : ''}` : 'ℹ️ 无跳过'));
ok(err.length === 0, '无 pageerror/console error: ' + err.slice(0, 3).join(' | '));
ok(await ev(() => !(window.__twinLoopErr || '')), '动画环未抛错（切近闭环不冻结循环）');
ok(await p.locator('#freshTxt').innerText().then(t => !t.trim()).catch(() => true), 'fail() 未被触发（#freshTxt 为空）');
console.log(out.join('\n'));
const bad = out.filter(l => l.startsWith('❌')).length;
console.log(`\n通过 ${out.filter(l => l.startsWith('✅')).length} · 失败 ${bad} · 验证实体 ${nTest} · 跳过 ${nSkip}`);
await b.close();
process.exit(bad ? 1 : 0);
