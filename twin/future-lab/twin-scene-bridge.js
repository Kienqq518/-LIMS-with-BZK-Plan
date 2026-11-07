/**
 * 孪生 V2 场景桥（运行于 tour-space iframe 内，?v2=1 才激活）
 * 职责：机器人实体 + AMR 通道引导线 + 设备状态描色 + 性能上报。
 * 数据由宿主经 postMessage(channel 'twin-v2') 推送，本层不直连任何业务系统。
 */
import * as THREE from './vendor/three.module.js';
const CHANNEL = 'twin-v2';
if (new URLSearchParams(location.search).get('v2') === '1') boot();


/* ---------- 墙体/隔断/柱子/地面分区处理（V1 视觉语言 §3：看设备运行，不看房间布局） ---------- */
let wallMesh = null, wallBase = null, labCenter = null, wallOpacityBase = null;
/* 渲染层状态（决策 Q7/Q8）：图层开关 + 低配模式。图层语义=渲染可见性，与业务切片无关。 */
const LAYERS = { path: true, labels: true, heatmap: false };   /* 分区色块与剖墙开关已按 2026-11-06 反馈移除；墙体剖切=固定渲染行为（见 treatArchitecture） */
let LOW = false, frames = 0, heatGroup = null, lastDeviceStatus = [];
function findWalls() {
  visual.overview.children.forEach(c => {
    if (c.isMesh && c.material && c.material.transparent && c.material.color && c.material.color.getHex() === 0xbbcbd7) {
      wallMesh = c; wallBase = Float32Array.from(c.geometry.attributes.position.array);
      if (wallOpacityBase == null) wallOpacityBase = c.material.opacity;
    }
  });
  if (wallMesh && !labCenter) {
    const rooms = visual.g.rooms || [];
    let mx = 0, mz = 0, n = 0;
    rooms.forEach(r => r.points.forEach(q => { mx += q[0] * 0.05; mz += q[1] * 0.05; n++; }));
    labCenter = new THREE.Vector3(mx / n, 0, mz / n);
  }
}
const WALL_FADE_OP = 0.12;
function fadeFrontWalls() {
  if (!wallMesh) return;
  findWalls();
  const camDir = new THREE.Vector3(); visual.camera.getWorldDirection(camDir);
  const out = camDir.clone().negate(); out.y = 0; if (out.lengthSq() < 1e-6) return; out.normalize();
  const pos = wallMesh.geometry.attributes.position, arr = pos.array;
  for (let seg = 0; seg * 6 * 3 < arr.length; seg++) {
    const o = seg * 18;
    const ax = wallBase[o], az = wallBase[o + 2], bx = wallBase[o + 3], bz = wallBase[o + 5];
    const rel = new THREE.Vector3((ax + bx) / 2 - labCenter.x, 0, (az + bz) / 2 - labCenter.z);
    const facing = rel.lengthSq() > 0.01 && rel.clone().normalize().dot(out) > 0.30;
    /* 每段 18 floats：v0(x,0,z) v1(X,0,Z) v2(X,h,Z) v3(x,0,z) v4(X,h,Z) v5(x,h,z) —— 顶部 y 在 o+7/o+13/o+16 */
    const h = facing ? 0.10 : wallBase[o + 7];   /* 前侧外墙压成 10cm 地脚带，其余保留 */
    arr[o + 7] = h; arr[o + 13] = h; arr[o + 16] = h;
  }
  pos.needsUpdate = true;
  wallMesh.geometry.computeBoundingSphere();
  wallMesh.material.opacity = WALL_FADE_OP;
}
/* 剖墙开关已按 2026-11-06 反馈移除：fadeFrontWalls 作为固定渲染行为常开（相机变化时重算），restoreWalls 一并删除 */
function softenGlassAndColumns() {
  const seen = new Set();
  visual.detail.traverse(m => {
    if (!m.isMesh || !m.material || seen.has(m.material.uuid)) return;
    const hex = m.material.color ? m.material.color.getHex() : -1;
    if (hex === 0x788c97) { m.material.color.set(0xc9d4da); m.material.metalness = 0.18; m.material.roughness = 0.55; seen.add(m.material.uuid); }      /* 玻璃深色金属框 → 弱化 */
    else if (hex === 0xd3e6e7 && m.material.transparent) { m.material.opacity = 0.08; seen.add(m.material.uuid); }                                          /* 玻璃面板更透 */
  });
  (visual.columns || []).forEach(c => {                                                                                                                    /* 柱子保留、降对比 */
    c.material = c.material.clone(); c.material.color.set(0xdde3e6); c.material.metalness = 0; c.material.clearcoat = 0; c.material.transparent = true; c.material.opacity = 0.92;
  });
}
function paintZoneFloors() {
  const layer = new THREE.Group(); layer.name = 'twin-v2-zones';
  const tints = [0xeef3f8, 0xeaf0f6];
  (visual.g.rooms || []).forEach((r, i) => {
    const pts = r.points.map(q => new THREE.Vector2(q[0] * 0.05, -q[1] * 0.05));
    const shape = new THREE.Shape(pts);
    const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: tints[i % 2], transparent: true, opacity: 0.34, depthWrite: false, toneMapped: false }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = 0.006 + (i % 2) * 0.001; layer.add(fill);
    const loop = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map(v => new THREE.Vector3(v.x, 0.02, -v.y))),
      new THREE.LineBasicMaterial({ color: 0xc8d3dc, transparent: true, opacity: 0.8, toneMapped: false }));
    layer.add(loop);
  });
  visual.scene.add(layer);
}
function treatArchitecture() {
  findWalls(); softenGlassAndColumns(); paintZoneFloors(); fadeFrontWalls();
  addEventListener('space-view-change', fadeFrontWalls);
  addEventListener('lab-view-change', fadeFrontWalls);
  visual.renderer.domElement.addEventListener('pointerup', fadeFrontWalls);
}


/* ---------- 材质 pass：浅色工业产品展示（明度阶梯：背景 #F3F5F8 > 设备白 > 地面中性浅灰） ---------- */
function applyMaterialPass() {
  const seen = new Set();
  const retint = (mesh, from, to) => {
    const m = mesh.material; if (!m || !m.color || seen.has(m.uuid)) return;
    if (Math.abs(m.color.getHex() - from) < 0x010101) { m.color.set(to); seen.add(m.uuid); }
  };
  const walk = root => root.traverse(o => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    const hex = o.material.color.getHex();
    if (hex === 0xc2c9cd) { o.material.color.set(0xe4e9ee); o.material.opacity = Math.max(o.material.opacity, 0.9); }  /* 106 地面提亮 */
    else if (hex === 0xaebfcb) { o.material.color.set(0xd3dbe2); seen.add(o.material.uuid); }                            /* 房间侧壁 */
    else if (hex === 0xedf0ef) { o.material.color.set(0xf6f8f9); seen.add(o.material.uuid); }                            /* 设备主体更白 */
    else if (hex === 0xd7dee1) { o.material.color.set(0xe8edf1); seen.add(o.material.uuid); }                            /* 设备浅色件 */
    /* 面板深灰/近黑不动；玻璃 rail 已弱化 */
  });
  walk(visual.scene);
  if (visual.reflector && visual.reflector.color) visual.reflector.color.set(0xd7dde3);  /* 反射减淡，防灰雾 */
}

/* ---------- 视觉 token 的唯一事实源：twin-tokens.css ----------
   3D 侧（光点/描色/热力/线路）与 DOM 侧（信息气泡）过去各写各的十六进制，
   同一语义出现两个值（待机 0x94a3b8 vs 停止 0x64748b；描色 0x2878ff vs 品牌 #2878FF）。
   Chrome 会把自定义属性里的 var() 链解析成最终值，所以直接读 CSS 变量即可（实测 --tw-st-working → "#2878FF"）。 */
const TWIN_TOKEN = (() => {
  const cs = getComputedStyle(document.documentElement), g = n => (cs.getPropertyValue(n) || '').trim();
  const hex = (n, fb) => { const v = g(n); return /^#[0-9a-f]{6}$/i.test(v) ? parseInt(v.slice(1), 16) : fb; };
  return { working: hex('--tw-st-working', 0x2878ff), ready: hex('--tw-st-ready', 0x16a34a), alarm: hex('--tw-st-alarm', 0xe5484d),
    warn: hex('--tw-st-warn', 0xf59e0b), idle: hex('--tw-st-idle', 0x94a3b8), done: hex('--tw-st-done', 0x7e8c9b),
    na: hex('--tw-st-na', 0xc3ccd6), brand: hex('--tw-color-brand', 0x2878ff), route: hex('--tw-st-route', 0xe8d77a),
    glow: hex('--tw-color-brand-glow', 0x63a4ff) };
})();
window.__twinTokensForQA = TWIN_TOKEN;   /* QA：3D 侧实际吃到的值必须等于 CSS token */

/* ---------- 设备状态视觉分级：克制版 = 顶部小呼吸光点 + 既有描色 ---------- */
const STATUS_LIGHT = { working: [TWIN_TOKEN.working, 'pulse'], ready: [TWIN_TOKEN.ready, 'static'], standby: [TWIN_TOKEN.idle, 'dim'], stopped: [TWIN_TOKEN.done, 'dim'], alarm: [TWIN_TOKEN.alarm, 'fast'] };
const statusDots = new Map();
function ensureDot(devId, status) {
  const mesh = visual.modelRoots.get(devId); if (!mesh) return;
  let dot = statusDots.get(devId);
  if (!dot) {
    const box = new THREE.Box3().setFromObject(mesh);
    const mat = new THREE.MeshStandardMaterial({ color: 0x101010, emissive: TWIN_TOKEN.brand, emissiveIntensity: 2.2, roughness: 0.4 });
    dot = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 12), mat);
    dot.position.set((box.min.x + box.max.x) / 2, box.max.y + 0.18, (box.min.z + box.max.z) / 2);
    visual.detail.add(dot); statusDots.set(devId, dot);
  }
  const conf = STATUS_LIGHT[status] || STATUS_LIGHT.standby;
  dot.material.emissive.setHex(conf[0]); dot.userData.mode = conf[1];
}
function pulseDots(t) {
  statusDots.forEach(dot => {
    if (LOW) { dot.material.emissiveIntensity = dot.userData.mode === 'fast' ? 3.2 : dot.userData.mode === 'dim' ? 0.7 : 2.2; return; }
    const mode = dot.userData.mode;
    if (mode === 'pulse') dot.material.emissiveIntensity = 2.4 + Math.sin(t * 0.0035) * 1.1;
    else if (mode === 'fast') dot.material.emissiveIntensity = 3.2 + Math.sin(t * 0.010) * 1.8;
    else if (mode === 'dim') dot.material.emissiveIntensity = 0.7;
    else dot.material.emissiveIntensity = 2.2;
  });
}

/* ---------- 剧本时钟：位置直接由 demoCycle + 墙上时钟算出 ----------
   之前靠宿主每 2s 推送的 progress 做插值：推送节奏一抖（setInterval 漂移、主线程忙）就会出现
   「走完再等一下」的微停顿，实测峰值只有 0.57m/s。改成场景内自算，速度恒等于剧本速度。 */
/* u 是「弧长比例」，必须按累计长度取位；此前按点序号比例取位（local*(n-1)）会让速度忽快忽慢、停靠点偏移 */
function posAt(pts, u) {
  if (!pts || !pts.length) return new THREE.Vector3();
  if (pts.length < 2) return pts[0].clone();
  if (!pts.__cum || pts.__rev !== pts.length) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    pts.__cum = cum; pts.__rev = pts.length;
  }
  const target = Math.max(0, Math.min(1, u)) * pts.__cum[pts.__cum.length - 1];
  let i = 1; while (i < pts.__cum.length - 1 && pts.__cum[i] < target) i++;
  const seg = pts.__cum[i] - pts.__cum[i - 1];
  const f = seg > 0 ? (target - pts.__cum[i - 1]) / seg : 0;
  return pts[i - 1].clone().lerp(pts[i], f);
}
function uFromCycle(c) {
  if (!c || !c.stops || !c.stops.length) return null;
  const S = c.stops, L = c.loopSec, t = (Date.now() / 1000) % L, last = S[S.length - 1];
  let cur = last, idx = S.length - 1, tail = false;
  for (let i = 0; i < S.length; i++) { if (t < S[i].t0 + S[i].dwellSec) { cur = S[i]; idx = i; break; } }
  if (t >= last.t0 + last.dwellSec) { tail = true; idx = S.length - 1; }
  if (tail) { const ts = L - (last.t0 + last.dwellSec); return last.u + (1 - last.u) * Math.min(1, (t - last.t0 - last.dwellSec) / (ts || 1)); }
  if (t < cur.t0) { const prevU = idx === 0 ? 0 : S[idx - 1].u; const f = cur.travelSec > 0 ? Math.max(0, Math.min(1, (t - (cur.t0 - cur.travelSec)) / cur.travelSec)) : 1; return prevU + (cur.u - prevU) * f; }
  return cur.u;
}

/* ---------- 平滑动画环：机器人插值 + 光点呼吸（15fps 足够，省电） ---------- */
let animStarted = false, robotTargets = {};
function startAnimLoop() {
  if (animStarted) return; animStarted = true;
  let last = 0;
  const loop = t => {
    if (t - last > (LOW ? 125 : 66)) {
      last = t; frames++;
      try {
      Object.entries(robotTargets).forEach(([id, tgt]) => {
        const g = robots[id]; if (!g) return;
        /* 光点先挂上：停靠的机器人也要有状态光点（暗色待机），否则「FR-25 光点是设备状态唯一入口」对停着的那台就失效了。
           路径单点（停靠）的机器人在下面早退，不参与插值。 */
        ensureDot(tgt.modelRoot, (tgt.parked || tgt.action === 'charging') ? 'standby' : 'working');
        if (!tgt.path || tgt.path.length < 2) return;
        const pts = tgt.mpts && tgt.mpts.length > 1 ? tgt.mpts : (tgt.mpts = manhattan(tgt.path).map(q => new THREE.Vector3(q[0], 0, q[1])));
        if (tgt.local == null) { tgt.local = tgt.progress || 0; tgt.animFrom = tgt.local; tgt.animTo = tgt.local; tgt.animT0 = t; }
        if (tgt.demoCycle) {
          const cu = uFromCycle(tgt.demoCycle);          // 剧本机器人：u 由场景内时钟直接给出，不做插值（插值会因推送节奏抖动产生微停顿，也会与弧长参数化打架）
          if (cu != null) tgt.local = cu;
        } else {
          const af = Math.max(300, tgt.animDur || 2000);
          const kk = Math.max(0, Math.min(1, (t - tgt.animT0) / af));
          const want = (tgt.animFrom == null ? tgt.local : tgt.animFrom) + ((tgt.animTo == null ? tgt.local : tgt.animTo) - (tgt.animFrom == null ? tgt.local : tgt.animFrom)) * kk;
          if (tgt.wrap && kk >= 1) { tgt.local = 0; tgt.animFrom = 0; tgt.animTo = tgt.progress; tgt.animT0 = t; tgt.wrap = false; }
          else if (Math.abs((tgt.progress == null ? want : tgt.progress) - want) > 0.12) { tgt.local = tgt.progress; tgt.animFrom = tgt.progress; tgt.animTo = tgt.progress; tgt.animT0 = t; }
          else tgt.local = want;
        }
        const p = posAt(pts, tgt.local);
        g.position.set(p.x, 0, p.z);
        /* QA 取证口：屏上「第 n 道任务」必须能和机器人真实位置对上（cyclecheck 用它证明道↔站↔AGV 一致） */
        if (id === 'RB-C-02') window.__twinAgv = { u: +tgt.local.toFixed(4), x: +p.x.toFixed(3), z: +p.z.toFixed(3), action: tgt.action || null, demo: !!tgt.demoCycle };
        const ahead = posAt(pts, Math.min(1, tgt.local + 0.004));
        const dx = ahead.x - p.x, dz = ahead.z - p.z;
        if (Math.abs(dx) + Math.abs(dz) > 1e-4) g.rotation.y = Math.atan2(dx, dz);   /* 原地掉头：方向由前进段决定，不做平滑摆动 */
        /* 换腿就重画当前航段（腿内不重建，避免每帧改几何） */
        if (tgt.legs && tgt.legs.length) liveLeg(tgt);
      });
      pulseDots(t);
      if (stepCam(t)) { /* 补间期间由 stepCam 决定相机输入 */ }
      visual.render();
      if (cardFor) positionCard(cardFor);
      publishCam();
      } catch (err) {                       // 兜底：动画环一旦抛错就会静默停摆（实测冻住过机器人与相机补间），记录后继续跑
        if (!window.__twinLoopErr) { window.__twinLoopErr = String(err && err.message || err);
          const el = document.createElement('div'); el.id = 'twin-v2-loop-error'; el.hidden = true; el.textContent = window.__twinLoopErr; document.body.append(el); }
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}


/* ---------- 设备状态光点：常驻 + 可点（2026-11-06 反馈） ----------
   光点是设备状态的唯一 3D 入口，但它不在 CAD 拾取集合（modelRoots）里，
   所以点光点原本什么都不发生。这里按屏幕距离做命中检测：点光点 = 点它对应的那台设备。
   半径 20px：光点按 2026-11-07 反馈放大到半径 0.10m（总览机位下直径也就十几像素），
  比可点中的热区还小，纯射线检测容易点偏，必须留像素热区。 */
const DOT_PICK_PX = 20;
/* 该像素上引擎会拾到的 CAD 实体（与 visual-106.bind() 的 pointerup 同一套射线，避免两套判定打架） */
function rayHitId(ev) {
  const r = visual.renderer.domElement.getBoundingClientRect();
  visual.raycaster.setFromCamera(new THREE.Vector2((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1), visual.camera);
  const hit = visual.raycaster.intersectObjects([...visual.modelRoots.values()], true)[0];
  if (!hit) return null; let m = hit.object; while (m && !m.userData.id) m = m.parent;
  return m ? m.userData.id : null;
}
function dotHitId(ev) {
  const host = visual.host.getBoundingClientRect();
  const px = ev.clientX - host.left, py = ev.clientY - host.top;
  let best = null, bestD = DOT_PICK_PX;
  statusDots.forEach((dot, devId) => {
    if (!dot.visible) return;
    const v = new THREE.Vector3(); v.setFromMatrixPosition(dot.matrixWorld); v.project(visual.camera);
    if (v.z > 1) return;                                     /* 相机背后 */
    const sx = (v.x * 0.5 + 0.5) * host.width, sy = (-v.y * 0.5 + 0.5) * host.height;
    const d = Math.hypot(sx - px, sy - py);
    if (d <= bestD) { bestD = d; best = devId; }
  });
  return best;
}
/* 滚轮缩放必须整套接管：引擎自己的 onwheel 改的是 visual.zoom，而 V2 的画面范围由我方 frScale 决定，
   两套缩放并存时「缩小」方向会被 visual.zoom 的下限 .55 卡死（实测推近后只能放大不能缩小）。
   这里直接顶掉 onwheel（不是 addEventListener，避免两个处理器叠加），单一事实源 = frScale，双向都能动。
   「点击切近 + 视觉跟随」撤除后（2026-11-07）缩放不再钉回锚点：机位只由用户自己决定，
   信息气泡靠实体自身投影跟随，缩放/平移都不会脱开。 */
function bindWheel() {
  const c = visual.renderer.domElement;
  c.onwheel = ev => { ev.preventDefault(); };            /* 顶掉引擎自己的 zoom 处理器，避免两套缩放叠加 */
  /* 绑在 document 而不是 canvas：场景帧里还有房间标签/节点标记等 DOM 盖在画面上，
     滚轮落在这些元素上时不会冒泡到 canvas 的处理器（实测 103 切近后滚轮完全失效）。 */
  document.addEventListener('wheel', ev => {
    if (ev.ctrlKey) return;
    /* 场景帧内部若有可滚动的小面板（物联读数等），滚轮优先给它，不吃掉用户的滚动 */
    let sc = ev.target;
    while (sc && sc !== document.body) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 4) return; sc = sc.parentElement; }
    ev.preventDefault();
    const k = ev.deltaY > 0 ? 1.14 : 1 / 1.14;
    frScale = clampFr(frScale * k);
    camTween = null; visual.zoom = 1;
    visual.render();
    if (cardFor) positionCard(cardFor);
    publishCam();
  }, { passive: false });
}
/* QA/宿主可读的相机构图：frScale 是我方唯一的缩放事实源，断言滚轮双向必须有它；
   顺带发布「浮层避让可用区」（freeRect 带 400ms 缓存）：信息气泡的夹取范围与 QA 都读它。 */
function publishCam() {
  const hk = document.getElementById('twin-v2-bridge'); if (!hk) return;
  const fq = freeRect();
  hk.dataset.cam = JSON.stringify({ fr: +frScale.toFixed(4), pan: [+myPan[0].toFixed(1), +myPan[1].toFixed(1)],
    yaw: +visual.yaw.toFixed(3), elev: +visual.elev.toFixed(3), zoom: +visual.zoom.toFixed(3),
    hh: +((visual.camera.top - visual.camera.bottom) / 2).toFixed(3),
    free: [+fq.x0.toFixed(0), +fq.y0.toFixed(0), +fq.x1.toFixed(0), +fq.y1.toFixed(0)] });
}

function bindDotPick() {
  const c = visual.renderer.domElement;
  let down = null;   /* 拖视角后松手不能算点击：与引擎自己的 moved>4px 判定同一阈值 */
  c.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY }; });
  c.addEventListener('pointerup', ev => {
    if (ev.button !== 0 || !down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y); down = null;
    if (moved > 4) return;
    /* 光点拾取只能是兜底：那个像素上真有 CAD 实体时，必须让实体本体赢。
       本处理器注册在引擎之后（引擎 onpointerup 先跑并已 selected），若这里再按 16px 半径抢一次，
       紧挨着别人光点的实体就会"点 A 出 B"（实测点 103-02 弹出 103-01 的卡、点 105-05 什么都不出）。 */
    if (rayHitId(ev)) return;
    const id = dotHitId(ev); if (!id) return;
    if (visual.selected === id) return;                      /* CAD 拾取已经选中同一台，别重复触发补间 */
    visual.selected = id;
    window.dispatchEvent(new CustomEvent('space-device-select', { detail: { id, name: id, roomId: id.slice(0, 3) } }));
  });
}

function injectLayerStyle() {
  if (document.getElementById('twin-v2-layer-style')) return;
  const st = document.createElement('style'); st.id = 'twin-v2-layer-style';
  /* 场地标签只控制房间名称。设备状态光点常驻（无开关）；物联节点身份标签已下线，节点信息只在点击后的详情卡里给（2026-11-06 反馈） */
  st.textContent = '.no-site-labels .room-label{display:none!important}';
  document.head.append(st);
}
function boot() {
  const wait = setInterval(async () => {
    const v = window.visual106;
    if (v && v.scene) { clearInterval(wait); build(v); }
  }, 300);
}

let visual, robots = {}, lines = null, tinted = new Map();
import { applyLook, setLookQuality } from './twin-look.js?v=2';
const COLORS = { alarm: TWIN_TOKEN.alarm, working: TWIN_TOKEN.working, ready: TWIN_TOKEN.ready, standby: TWIN_TOKEN.idle, guide: TWIN_TOKEN.route };

function build(v) {
  visual = v;
  /* 行进路线层：只画数据给的锚点（CAD 占地推导的曼哈顿折线），不再手绘——
     旧版硬编码的黄色环线/虚线没有任何数据依据，实测会压在试验桌与设备上（违反避让规则）。 */
  const guide = new THREE.Group(); guide.name = 'twin-v2-guide';
  v.scene.add(guide); lines = guide;

  /* 机器人：直接驱动 CAD 真实复合机器人模型（106-09→RB-C-01，106-08→RB-C-02），不再放程序化假机器人 */
  robots = {};

  treatArchitecture();
  applyMaterialPass();
  /* 光影材质精修（twin-look.js）：必须在 applyMaterialPass 之后——它在那套白蓝配色之上再分材质角色、
     重排灯光分工、加纵深雾与选择性 bloom。?look=flat 可关（对比取证），?quality=low 交付档自动关后处理。 */
  try { window.__twinLookDiag = applyLook(visual, { low: LOW }); } catch (e) { console.error('look 装载失败：' + e.message); }
  startAnimLoop();
  loadNames();
  hookSetViewReset();
  applyHome();          /* 首屏：引擎构造时的 setView 早于本 hook，这里补一次，保证第一帧就是参考图那版机位 */
  wrapFrame();
  bindWheel();
  injectLayerStyle();
  /* 点击任意实体（含桌子凳子）→ 只在鼠标旁弹信息卡，相机一步都不动。
     FR-34 的「切近 + 视觉跟随」按 2026-11-07 反馈整体撤除：售前投影里，讲的人不希望画面被点击牵着跑，
     要看细节用滚轮自己调，不靠系统替人决定机位。
     信息卡跟着实体自身的投影位置走（缩放、平移都不会脱开），所以视觉上就是"贴着鼠标旁那台设备"。 */
  addEventListener('space-device-select', ev => {
    const id = ev.detail && ev.detail.id; if (!id) return;
    /* 台账里有编号 ≠ 三维里有模型：这类实体没有可拾取的网格，弹卡也指不出东西。
       不给假动作也不静默，交宿主瞬时说明——与 FR-32「未绑定工位的行只给提示」同一条诚实口径。 */
    if (!boxOf(id)) {
      hideCard();
      parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'hint', text: id + '：三维未建模（CAD 台账号已登记，但场景里没有可拾取实体，不做假动作）' }, location.origin);
      return;
    }
    visual.selected = id;
    const c = centerOf(id); if (!c) return;
    showCard(id, c);
  });
  addEventListener('lab-view-change', hideCard);
  bindDotPick();
  /* QA 自检钩子（DOM 可被隔离世界读取） */
  visual.statusDots = statusDots;   /* QA/宿主可读：设备 → 光点映射（光点常驻，无开关） */
  const hook = document.createElement('div'); hook.id = 'twin-v2-bridge';
  hook.dataset.guide = String(guide.children.length); hook.dataset.robots = String(Object.keys(robots).length); hook.dataset.walls = wallMesh ? '1' : '0';
  hook.dataset.layers = Object.keys(LAYERS).filter(k => LAYERS[k]).join(','); hook.dataset.quality = 'high'; hook.dataset.route = 'manhattan';
  document.body.append(hook);
  parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'bridge-ready', guide: guide.children.length, robots: Object.keys(robots).length }, location.origin);

  /* 宿主状态推送 */
  addEventListener('message', async e => {
    const d = e.data; if (!d || d.channel !== CHANNEL) return;
    if (d.type === 'state') applyState(d);
    if (d.type === 'layer') applyLayer(d.layer, !!d.enabled);
    if (d.type === 'quality') setQuality(d.level === 'low' ? 'low' : 'high');
    if (d.type === 'camera') camCmd(d);
    if (d.type === 'objects') { objectInfo = d.objects || {}; if (cardFor) renderCard(cardFor); }
  });

  /* 焦点在三维场景里时，翻页笔按键交回宿主（决策 Q1：售前投影遥控翻页） */
  addEventListener('keydown', ev => {
    if (['PageUp', 'PageDown', 'Home', 'End', '1', '2', '3', 'Escape'].includes(ev.key)) {
      parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'remote', key: ev.key }, location.origin);
    }
  });

  /* 性能上报（debug-profiler） */
  setInterval(() => {
    const info = visual.renderer.info.render, mem = visual.renderer.info.memory;
    parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'perf', calls: info.calls, tris: info.triangles, geometries: mem.geometries, textures: mem.textures, fps: frames * 2, layers: Object.keys(LAYERS).filter(k => LAYERS[k]).join(','), quality: LOW ? 'low' : 'high' }, location.origin); frames = 0;
  }, 5000);
}

let robotPathsDrawn = false, routeSig = null;
function applyState(d) {
  (d.robots || []).forEach(r => {
    const tn = performance.now(), slot = robotTargets[r.robotId];
    /* 必须先把旧值取出来：Object.assign 就地改写同一个对象，之后再读 prevTgt.progress 已经等于新值（实测回绕判定恒 false → 循环收尾直接窜 20m） */
    const prevProgress = slot && slot.progress, prevPush = slot && slot.lastPush;
    robotTargets[r.robotId] = Object.assign(slot || {}, r);
    const tgt = robotTargets[r.robotId];
    if (tgt.progress != null && tgt.local == null) { tgt.local = tgt.progress; tgt.animFrom = tgt.progress; tgt.animTo = tgt.progress; tgt.animT0 = tn; }
    if (prevProgress != null && tgt.progress != null) {
      if (tgt.progress + 0.5 < prevProgress) {                       // 一圈走完回绕：先把最后一段跑到终点，再从 u=0 起步
        tgt.animFrom = tgt.local; tgt.animTo = 1; tgt.animT0 = tn; tgt.wrap = true;
      } else if (!tgt.wrap && tgt.progress !== prevProgress) {        // 正常推进：以本次推送的目标匀速插值
        tgt.animFrom = tgt.local; tgt.animTo = tgt.progress; tgt.animT0 = tn;
      }
    }
    tgt.animDur = prevPush ? Math.max(600, Math.min(4000, tn - prevPush)) : 2000;
    if (r.demoCycle) tgt.demoCycle = r.demoCycle;
    robotTargets[r.robotId].lastPush = tn;
    if (r.path) robotTargets[r.robotId].mpts = manhattan(r.path).map(q => new THREE.Vector3(q[0], 0, q[1]));
    const root = robots[r.robotId] || (r.modelRoot ? (robots[r.robotId] = visual.modelRoots.get(r.modelRoot) || null) : null);
    if (root && r.homeAnchor && root.userData.homeParked !== true) {   /* 家位=环线起点，避免开机时停在设备里 */
      root.position.set(r.homeAnchor[0], 0, r.homeAnchor[2]); root.userData.homeParked = true;
    }
    if (!robots[r.robotId] && r.modelRoot) robots[r.robotId] = visual.modelRoots.get(r.modelRoot) || null;
  });
  /* 自检必须跟着数据走：路线或墙体一变就重画+重算（接入真实调度后路径会换，只跑首帧等于没校验） */
  if (d.walls) lastWalls = d.walls;
  const sig = JSON.stringify([(d.robots || []).map(r => [r.robotId, r.path]), lastWalls]);
  if (sig !== routeSig) {
    routeSig = sig; robotPathsDrawn = true;
    drawRoutes(d.robots || [], lastWalls);
    auditRoutes(d.robots || [], lastWalls);
  }
  if (d.objects) objectInfo = d.objects;
  if (d.layers) Object.entries(d.layers).forEach(([k, v]) => applyLayer(k, !!v));
  if (d.quality) setQuality(d.quality === 'low' ? 'low' : 'high');
  lastDeviceStatus = Object.entries(d.deviceStatus || {}).map(([node, st]) => [node.replace('cad:', ''), st]);
  lastDeviceStatus.forEach(([id, st]) => { tint('cad:' + id, st); ensureDot(id, st); });
  if (LAYERS.heatmap) drawHeatmap();   /* 热力随状态刷新 */
}

function tint(node, status) {
  const id = node.replace('cad:', '');
  const item = visual.g.equipment.find(e => e.id === id);
  if (!item || !item.group) return;
  const key = id;
  if (!tinted.has(key)) {
    const originals = [];
    item.group.traverse(o => { if (o.isMesh && o.material && 'emissive' in o.material) originals.push([o, o.material.emissive.getHex(), o.material.emissiveIntensity]); });
    tinted.set(key, originals);
  }
  const originals = tinted.get(key);
  const color = status === 'alarm' ? COLORS.alarm : status === 'working' ? COLORS.working : 0x000000;
  const inten = status === 'alarm' ? 0.55 : status === 'working' ? 0.18 : 0;
  originals.forEach(([mesh, ,]) => { mesh.material.emissive.setHex(color); mesh.material.emissiveIntensity = inten; });
}

/* ---------- 路径几何：直角折线（决策 Q5） ---------- */
function manhattan(pts) {
  const out = [];
  (pts || []).forEach(p => {
    const x = p[0], z = p[p.length - 1], last = out[out.length - 1];
    if (!last) { out.push([x, z]); return; }
    const dx = x - last[0], dz = z - last[1];
    if (Math.abs(dx) > 0.05 && Math.abs(dz) > 0.05) out.push(Math.abs(dx) > Math.abs(dz) ? [x, last[1]] : [last[0], z]);   /* 长边先走，再原地掉头 */
    if (Math.abs(x - last[0]) > 1e-3 || Math.abs(z - last[1]) > 1e-3) out.push([x, z]);
  });
  return out;
}

/* ---------- 图层开关（决策 Q7：图层=渲染可见性，与业务切片解耦） ---------- */
function applyLayer(name, on) {
  if (!(name in LAYERS)) return; LAYERS[name] = on;
  if (name === 'path' && lines) lines.visible = on;
  if (name === 'labels') {
    /* 「场地标签」= 只开关房间名称标签。房间标签的 hidden 由 render() 每帧重算，所以只能走 CSS 覆盖。
       设备状态光点（statusDots）常驻，不随本开关变化。 */
    visual.host.classList.toggle('no-site-labels', !on);
  }
  if (name === 'heatmap') { if (on) drawHeatmap(); else if (heatGroup) heatGroup.visible = false; }
  if (name === 'zones' || name === 'walls') { const g = visual.scene.getObjectByName('twin-v2-zones'); if (g) g.visible = false; }   /* 旧 URL 参数兼容：分区色块恒关，剖墙不再是开关 */
  const hook = document.getElementById('twin-v2-bridge'); if (hook) hook.dataset.layers = Object.keys(LAYERS).filter(k => LAYERS[k]).join(',');
  visual.render();
}
function drawHeatmap() {
  if (!heatGroup) { heatGroup = new THREE.Group(); heatGroup.name = 'twin-v2-heat'; visual.scene.add(heatGroup); }
  heatGroup.visible = true; heatGroup.clear();
  const COL = { working: TWIN_TOKEN.working, ready: TWIN_TOKEN.ready, standby: TWIN_TOKEN.idle, stopped: TWIN_TOKEN.done, alarm: TWIN_TOKEN.alarm };
  /* 负荷口径（2026-11-06 定稿）：106 无人化区设备=高负荷；其他区域降到最低（几乎不可见，保留存在性但不抢注意力） */
  (lastDeviceStatus || []).forEach(([id, status]) => {
    const mesh = visual.modelRoots.get(id); if (!mesh) return;
    const box = new THREE.Box3().setFromObject(mesh), c = box.getCenter(new THREE.Vector3());
    const unmanned = /^106-/.test(id);
    const r = Math.max(unmanned ? 1.15 : 0.7, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * (unmanned ? 1.0 : 0.7));
    const hot = status === 'alarm' ? 0.34 : status === 'working' ? (unmanned ? 0.30 : 0.07) : unmanned ? 0.15 : 0.045;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 28),
      new THREE.MeshBasicMaterial({ color: COL[status] || COL.standby, transparent: true, opacity: hot, depthWrite: false, toneMapped: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(c.x, 0.014, c.z); heatGroup.add(disc);
  });
}
/* ---------- 低配模式（决策 Q8 预留） ---------- */
let pixelRatioBase = null;
function setQuality(level) {
  const low = level === 'low'; if (low === LOW) return; LOW = low;
  if (visual && visual.renderer) {
    if (pixelRatioBase == null) pixelRatioBase = visual.renderer.getPixelRatio();
    visual.renderer.setPixelRatio(low ? 1 : pixelRatioBase);
    if (visual.reflector) visual.reflector.visible = !low;
  }
  setLookQuality(low);                                     /* 光影档同步：低配关 bloom 并把灯光收回保守值（不重新打补丁） */
  const hook = document.getElementById('twin-v2-bridge'); if (hook) hook.dataset.quality = low ? 'low' : 'high';
  if (visual) visual.render();
}

/* ---------- 行进路线层与避让校验（决策 2026-11-06：小机器人限 102↔106 及区间走廊，不得重叠或穿越他物） ---------- */
const ROUTE_COLORS = { 'RB-C-02': TWIN_TOKEN.route, 'RB-C-01': TWIN_TOKEN.brand };
function obstacleBoxes() {
  const skip = new Set(['106-08', '106-09']);                     // 两台机器人自身
  const out = [];
  visual.modelRoots.forEach((mesh, id) => {
    if (skip.has(id)) return;
    const b = new THREE.Box3().setFromObject(mesh);
    if (!isFinite(b.min.x) || b.max.y < 0.05) return;             // 贴地零高物体（地面/标线）不算障碍
    out.push({ id, x0: b.min.x, x1: b.max.x, z0: b.min.z, z1: b.max.z, h: +(b.max.y).toFixed(2) });
  });
  return out;
}
/* 扫掠正方形是否被「允许区并集」精确覆盖：坐标压缩后逐小格判定（单矩形判定会在 102↔走廊门口误判） */
function covered(x, z, half, rects) {
  const sx0 = x - half, sx1 = x + half, sz0 = z - half, sz1 = z + half;
  const xs = new Set([sx0, sx1]), zs = new Set([sz0, sz1]);
  rects.forEach(q => { [q.x0, q.x1].forEach(v => { if (v > sx0 && v < sx1) xs.add(v); }); [q.z0, q.z1].forEach(v => { if (v > sz0 && v < sz1) zs.add(v); }); });
  const X = [...xs].sort((a, b) => a - b), Z = [...zs].sort((a, b) => a - b);
  const inAny = (px, pz) => rects.some(q => px >= q.x0 && px <= q.x1 && pz >= q.z0 && pz <= q.z1);
  for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < Z.length - 1; j++) {
    if (!inAny((X[i] + X[i + 1]) / 2, (Z[j] + Z[j + 1]) / 2)) return false;
  }
  return true;
}
let lastWalls = [];
/* 玻璃墙=硬约束：扫掠方块与墙面相交时必须整块落在门洞跨度内；无门洞的墙一律禁止穿越 */
/* 一面墙可以有多个门洞（106 东墙：南端双开门 + 北端走廊西进口）。
   兼容旧数据：w.gates 优先，没有就退回单门洞 w.gate。 */
function wallGates(w) { return (w.gates && w.gates.length) ? w.gates : (w.gate ? [w.gate] : []); }
function inAnyGate(w, c, half) {
  const gs = wallGates(w);
  if (!gs.length) return false;
  return gs.some(g => c - half >= g[0] && c + half <= g[1]);
}
function wallHit(x, z, half, walls) {
  for (const w of walls || []) {
    if (w.axis === 'x') {
      if (z + half > w.a && z - half < w.b && x + half > w.at && x - half < w.at) {
        if (!inAnyGate(w, z, half)) return w.name;
      }
    } else {
      if (x + half > w.a && x - half < w.b && z + half > w.at && z - half < w.at) {
        if (!inAnyGate(w, x, half)) return w.name;
      }
    }
  }
  return null;
}
function allowedRects(r) {
  const rects = [];
  const roomRect = id => {
    const room = (visual.g.rooms || []).find(x => x.id === id); if (!room) return null;
    const xs = room.points.map(q => q[0] * 0.05), zs = room.points.map(q => q[1] * 0.05);
    return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), id };
  };
  (r.allowedZones || []).forEach(z => {
    const m = /Z-(\d{3})/.exec(z); if (!m) return;
    const q = roomRect(m[1]); if (q) rects.push(q);
  });
  if (r.corridor) rects.push({ x0: r.corridor.x[0], x1: r.corridor.x[1], z0: r.corridor.z[0], z1: r.corridor.z[1], id: 'corridor' });
  if (!rects.length) { const q = roomRect('106'); if (q) rects.push(q); }
  return rects;
}
function drawRoutes(list, walls) {
  if (!lines) return;
  lines.clear();
  const hook = document.getElementById('twin-v2-bridge');
  if (hook) {
    hook.dataset.guide = String(list.filter(r => r.path && r.path.length > 1).length);
    hook.dataset.robotsMoving = list.filter(r => !r.parked && r.path && r.path.length > 1).map(r => r.robotId).join(',');
    hook.dataset.robotsParked = list.filter(r => r.parked).map(r => r.robotId + '@' + (r.chargingBay || '')).join(',');
  }
  /* 停靠位也要验：停在充电位=与充电桩重叠（正常对接），但**必须落在它的允许区域内**，
     否则会出现「说好在 102 充电，实际摆在 106 过道里」这种演示穿帮。 */
  list.filter(r => r.parked).forEach(r => {
    const p0 = (r.path && r.path[0]) || r.homeAnchor; if (!p0) return;
    const half = (r.sweptEnvelope || Math.max(...(r.footprint || [0.9, 0.9]))) / 2 + (r.clearanceM || 0.2);
    if (!covered(p0[0], p0[2], half, allowedRects(r))) {
      const el0 = document.getElementById('twin-v2-route-audit');
      if (el0) el0.dataset.violations = String(+el0.dataset.violations + 1);
      console.warn('停靠位越出允许区域', r.robotId, p0);
    }
  });
  list.forEach(r => {
    if (!r.path || r.path.length < 2) return;
    /* —— 堆叠成完整线路：一条腿（上一站→下一站）一个对象，腿里再按顶点分直角段 ——
       这样「线路图」是可数的：11 条腿 = 11 个 leg 对象，不是原来一整条不可拆的折线。 */
    const route = new THREE.Group(); route.name = 'route-' + r.robotId; lines.add(route);
    const legs = r.legs || [];
    const baseColor = ROUTE_COLORS[r.robotId] || TWIN_TOKEN.route;
    if (legs.length) {
      legs.forEach((lg, i) => {
        const g = new THREE.Group(); g.name = 'leg-' + r.robotId + '-' + lg.from + '-' + lg.to; g.userData = { leg: i, from: lg.from, to: lg.to, u0: lg.u0, u1: lg.u1 };
        const lp = (lg.pts || []).map(q => new THREE.Vector3(q[0], 0.022, q[1]));
        if (lp.length > 1) {
          const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(lp),
            new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.62 }));
          ln.name = 'legline-' + i; g.add(ln);
        }
        route.add(g);
      });
    } else {                                  /* 没有腿数据（老 payload / 真实接入未给）也要画得出整条线 */
      const ptsAll = manhattan(r.path).map(q => new THREE.Vector3(q[0], 0.022, q[1]));
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsAll),
        new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.85 }));
      ln.name = 'route-line-' + r.robotId; route.add(ln);
    }
    /* 定位点（station）与直角拐点（transit）分开画：定位点=任务要到达的设备前那个点，是"站"；拐点是"路" */
    const knots = new THREE.Group(); knots.name = 'knots-' + r.robotId;
    const nodes = r.routeNodes || [];
    const mkDot = (x, z, rad, color, op, ring) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(rad, 20),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, toneMapped: false, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.026, z);
      if (ring) {
        const rg = new THREE.Mesh(new THREE.RingGeometry(rad + 0.055, rad + 0.10, 24),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op * 0.55, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
        rg.rotation.x = -Math.PI / 2; rg.position.set(x, 0.025, z); knots.add(rg);
      }
      knots.add(m);
    };
    if (nodes.length) {
      nodes.forEach(n => {
        if (n.kind === 'station') mkDot(n.at[0], n.at[1], n.order === 1 ? 0.15 : 0.115, n.order === 1 ? TWIN_TOKEN.ready : baseColor, 0.95, n.order !== 1);
        else mkDot(n.at[0], n.at[1], 0.062, baseColor, 0.75, false);
      });
    } else {
      manhattan(r.path).forEach((q, i) => mkDot(q[0], q[1], i === 0 ? 0.16 : 0.09, i === 0 ? TWIN_TOKEN.ready : baseColor, 0.9, false));
    }
    lines.add(knots);
    liveLeg(r);
    /* 门洞标记已按 2026-11-06 反馈取消：画在墙上的绿色小方块被认成「这里有个门」，
       而它只是我们把 gate 区间画出来的记号——门洞这件事由折线自己走位证明（只从 102 西门与 106 东门穿墙），
       不需要一个会误导的图例。审计规则照旧跑，只是不在屏上画记号。 */
    /* 行进范围带：走廊（仅运输机器人有） */
    if (r.corridor) {
      const c = r.corridor;
      const band = new THREE.Mesh(new THREE.PlaneGeometry(c.x[1] - c.x[0], c.z[1] - c.z[0]),
        new THREE.MeshBasicMaterial({ color: TWIN_TOKEN.route, transparent: true, opacity: 0.10, depthWrite: false, toneMapped: false }));
      band.rotation.x = -Math.PI / 2; band.position.set((c.x[0] + c.x[1]) / 2, 0.012, (c.z[0] + c.z[1]) / 2); band.name = 'corridor-' + r.robotId;
      lines.add(band);
    }
  });
}

/* ---------- 当前航段：上一个定位点 → 下一个定位点，画成"正在走的那条路" ----------
   样式按产品负责人给的参考图：浅蓝半透明带 + 带上等距圆点，比整线其余部分亮。
   只给"正在走的这一段"用这个样式，其余腿保持细黄线——高亮必须有信息量，不能全画面都是霓虹。 */
const LIVE = { band: TWIN_TOKEN.brand, bandW: 0.42, glowW: 1.0, dotR: 0.062, step: 0.9, y: 0.03 };
let liveState = {};
function legIndexOf(r, u) {
  /* 高亮用 displayLegs（按门洞/折返点切开的渲染分段）；业务航段 legs 仍是 9 条「上一站→下一站」 */
  const legs = r.displayLegs || r.legs || []; if (!legs.length) return -1;
  for (let i = 0; i < legs.length; i++) if (u >= legs[i].u0 - 1e-6 && u <= legs[i].u1 + 1e-6) return i;
  return legs.length - 1;
}
function liveLeg(r) {
  if (!lines) return;
  const old = lines.getObjectByName('live-leg-' + r.robotId);
  const tgt = robotTargets[r.robotId] || {};
  const u = tgt.local != null ? tgt.local : (tgt.progress || 0);
  const idx = legIndexOf(r, u);
  const leg = idx >= 0 ? ((r.displayLegs || r.legs) || [])[idx] : null;
  const sig = leg ? (idx + ':' + leg.from + '→' + leg.to + '/' + (leg.part || 1)) : 'none';
  if (liveState[r.robotId] === sig && old) return;              /* 腿没换就不重建几何（每帧重建会抖） */
  liveState[r.robotId] = sig;
  if (old) old.parent.remove(old);
  if (!leg || !leg.pts || leg.pts.length < 2) return;
  const g = new THREE.Group(); g.name = 'live-leg-' + r.robotId;
  const pts = leg.pts.map(q => [q[0], q[1]]);
  const dotPlan = []; let totalDots = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1); if (len < 1e-3) continue;
    const ang = Math.atan2(z2 - z1, x2 - x1);
    [[LIVE.glowW, 0.10, LIVE.y], [LIVE.bandW, 0.34, LIVE.y + 0.002]].forEach(([w, op, y]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len + w * 0.55, w),
        new THREE.MeshBasicMaterial({ color: LIVE.band, transparent: true, opacity: op, toneMapped: false, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = -ang; m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      g.add(m);
    });
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1, LIVE.y + 0.004, z1), new THREE.Vector3(x2, LIVE.y + 0.004, z2)]),
      new THREE.LineBasicMaterial({ color: TWIN_TOKEN.glow, transparent: true, opacity: 0.95, toneMapped: false }));
    g.add(ln);
    /* 等距圆点用 InstancedMesh：整条腿一个 draw call（几十个独立 Mesh 会把大屏 draw call 吃掉一大块） */
    const nd = Math.max(1, Math.floor(len / LIVE.step) + 1); totalDots += nd;
    dotPlan.push({ x1, z1, x2, z2, len, nd });
  }
  if (totalDots) {
    const im = new THREE.InstancedMesh(new THREE.CircleGeometry(LIVE.dotR, 18),
      new THREE.MeshBasicMaterial({ color: TWIN_TOKEN.brand, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false }), totalDots);
    const m4 = new THREE.Matrix4(), qq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), sc = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
    let ki = 0;
    dotPlan.forEach(dp => {
      for (let i = 0; i < dp.nd; i++) {
        const t = Math.min(1, (i * LIVE.step) / dp.len);
        pv.set(dp.x1 + (dp.x2 - dp.x1) * t, LIVE.y + 0.006, dp.z1 + (dp.z2 - dp.z1) * t);
        m4.compose(pv, qq, sc); im.setMatrixAt(ki++, m4);
      }
    });
    im.instanceMatrix.needsUpdate = true; im.name = 'live-dots'; g.add(im);
  }
  /* 下一站的定位点用蓝环强调：视线自然落到「要去哪儿」 */
  const e = pts[pts.length - 1];
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.22, 28),
    new THREE.MeshBasicMaterial({ color: TWIN_TOKEN.brand, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(e[0], LIVE.y + 0.007, e[1]); g.add(ring);
  lines.add(g);
}

function auditRoutes(list, walls) {
  const obs = obstacleBoxes();
  const report = { checked: 0, violations: [], transits: [], obstacles: obs.length, walls: (walls || []).length, at: new Date().toISOString() };
  list.forEach(r => {
    const half = (r.sweptEnvelope || Math.max(...(r.footprint || [0.9, 0.9]))) / 2 + (r.clearanceM || 0.2);
    const rects = allowedRects(r);
    const pts = r.path || [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const n = Math.max(1, Math.round(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[2] - a[2])) / 0.02));
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
        report.checked++;
        if (!covered(x, z, half, rects)) { report.violations.push({ robot: r.robotId, seg: i, at: [+x.toFixed(2), +z.toFixed(2)], type: '越出允许范围', rect: rects.map(q => q.id).join('/') }); continue; }
        const wl = wallHit(x, z, half, walls);
        if (wl) { report.violations.push({ robot: r.robotId, seg: i, at: [+x.toFixed(2), +z.toFixed(2)], type: '穿墙未走门洞', obj: wl }); continue; }
        const o = obs.find(q => x + half > q.x0 && x - half < q.x1 && z + half > q.z0 && z - half < q.z1);
        if (o) report.violations.push({ robot: r.robotId, seg: i, at: [+x.toFixed(2), +z.toFixed(2)], type: '与实体重叠/穿越', obj: o.id, h: o.h });
      }
    }
  });
  /* 合法穿门统计：按顶点在墙面两侧的**符号变化**判定。
     顶点正好压在墙面上（我们的路径会在门洞处显式落一个顶点）时不能重复计数——
     所以遇到 0 保持上一条的侧向，等下一个非零侧向再判定穿越。 */
  list.forEach(r => {
    const half = (r.sweptEnvelope || Math.max(...(r.footprint || [0.9, 0.9]))) / 2 + (r.clearanceM || 0.2);
    const pts = r.path || [];
    (walls || []).forEach(w => {
      const coord = w.axis === 'x' ? 0 : 2;                 // 穿越 x=at 的墙看 x 侧向；穿越 z=at 的墙看 z 侧向
      let side = 0, segIdx = 0;
      for (let i = 0; i < pts.length; i++) {
        const d = pts[i][coord] - w.at, s2 = d > 1e-6 ? 1 : (d < -1e-6 ? -1 : 0);
        if (s2 === 0) continue;
        if (side !== 0 && s2 !== side) {
          const c = pts[i][coord === 0 ? 2 : 0];               // 穿越点横向坐标（穿 x 墙看 z，穿 z 墙看 x；顶点是 [x,y,z]）
          if (inAnyGate(w, c, half)) {
            const crossSeg = (i > 0 && Math.abs(pts[i - 1][coord] - w.at) < 1e-6) ? i - 1 : i;
            report.transits.push({ robot: r.robotId, wall: w.name, at: w.at, [w.axis === 'x' ? 'z' : 'x']: +c.toFixed(2), seg: crossSeg, dir: s2 > side ? 1 : -1 });
          }
        }
        side = s2;
      }
    });
  });
  report.transitCount = report.transits.length;
  report.violations = report.violations.slice(0, 40);
  let el = document.getElementById('twin-v2-route-audit');
  if (!el) { el = document.createElement('div'); el.id = 'twin-v2-route-audit'; el.hidden = true; document.body.append(el); }
  el.dataset.checked = String(report.checked); el.dataset.obstacles = String(report.obstacles); el.dataset.walls = String(report.walls);
  el.dataset.violations = String(report.violations.length);
  el.dataset.detail = JSON.stringify(report.violations.slice(0, 6));
  el.dataset.transits = JSON.stringify(report.transits);   /* 合法穿门清单：门名 + 穿越坐标 + 方向（去/返） */
  parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'route-audit', checked: report.checked, obstacles: report.obstacles, walls: report.walls, violations: report.violations.length, transits: report.transits, transitCount: report.transitCount, detail: report.violations.slice(0, 8) }, location.origin);
  return report;
}

/* ================= 相机引擎：下钻 / 回总览（补间，不再生硬跳视角） =================
   只用 visual 的 yaw/elev/zoom + 引擎的 pan 作为输入，因此不接管 fitCamera，不与
   whiteblue-spatial-engine / scene-group-highlight 的相机计算打架。 */
const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
const REF = { x: 14, y: 0.6, z: 19 };                       // 参考世界点：用它度量切换前后的画面位移与比例
let camSnap = null, camTween = null, myPan = [0, 0], objectInfo = {}, cardFor = null, cardEl = null, namesMap = null, frScale = 1;
/* 首屏机位（2026-11-07 参考图：比原来小一号、整体往上移）。
   frScale>1 = 画面范围变大（模型缩小）；pan 的单位就是屏幕像素，pan[1] 为负 = 模型往上走。
   它必须同时是「回总览」的标定构图：只写在一处、drill 补间终点与 reset 都取它，
   否则第一次回 S1 就把 HOME 冲回 1/0（camcheck 的 FR-10 断言正是守这条）。 */
/* 2026-11-07 参考图一再缩小一号：fr 1.16→1.32（画面范围变大=模型缩小约 14%），
   上移量跟着收到 -64（模型小了就不需要那么高的偏移，否则下方留白过大）。
   这张标定值同时是「回总览」的构图基准，camcheck 的房间标签中心就是按它重标定的。 */
const HOME = { fr: 1.32, pan: [0, -64] };
function homeFraming(view) { return /^overall/.test(view || visual.view) ? { fr: HOME.fr, pan: HOME.pan.slice() } : { fr: 1, pan: [0, 0] }; }
function applyHome(view) { const hm = homeFraming(view); frScale = hm.fr; setPan(hm.pan[0], hm.pan[1]); return hm; }
/* 视锥补间：scene-group-highlight 的 fitFrame 每帧重算 camera.left/right/top/bottom 且不看 visual.zoom，
   所以只能在它「之后」按比例缩放视锥——这是下钻能平滑的唯一正确接法。 */
/* 视角切换必须回到「标定构图」：任何推近（下钻、当年的切近）都会把 frScale 压到 0.1~0.3，
   而引擎的 setView 只重置 zoom、不管我方 frScale → 点「S1 总览」回来后画面仍停在特写缩放上（违反 FR-10「回到同一机位」，实测 camHH 14.2→10.5）。
   所以任何 setView 都先把 frScale/pan 归位；随后 drill 再按需设自己的缩放，顺序上安全。 */
function hookSetViewReset() {
  if (visual.__twinViewReset) return; visual.__twinViewReset = true;
  const orig = visual.setView.bind(visual);
  visual.setView = v => { camTween = null; applyHome(v); return orig(v); };   /* 总览=HOME 机位，房间特写=引擎自然构图 */
}

function wrapFrame() {
  if (visual.__twinFrameHooked) return; visual.__twinFrameHooked = true;
  /* 用 getter/setter 包住 window.roomTourFrame：scene-group-highlight 会在自己 start() 里赋值，
     一次性 wrap 会被它覆盖掉（实测导致下钻动画偶发退化成瞬移），这样后赋值也会被组合进来。 */
  let real = window.roomTourFrame;
  Object.defineProperty(window, 'roomTourFrame', {
    configurable: true,
    get() {
      return (c, w, h) => {
        if (real) real(c, w, h);
        if (!c.isOrthographicCamera) return;
        const scaled = frScale !== 1, moved = myPan[0] !== 0 || myPan[1] !== 0;
        if (!scaled && !moved) return;
        const hw = (c.right - c.left) / 2 * frScale, hhv = (c.top - c.bottom) / 2 * frScale;
        /* 先按 frScale 缩放，再把视锥中心平移 pan 个屏幕像素：
           NDC.x=(X-cx)/hw → 想让像点右移 panX px（NDC +2panX/w），中心就要左移 hw·2panX/w；y 轴屏幕向下为正，方向相反。 */
        const mx = (c.left + c.right) / 2 - hw * (2 * myPan[0] / w), my = (c.top + c.bottom) / 2 + hhv * (2 * myPan[1] / h);
        c.left = mx - hw; c.right = mx + hw; c.top = my + hhv; c.bottom = my - hhv; c.updateProjectionMatrix();
      };
    },
    set(fn) { real = fn; }
  });
}
function natHH() { const c = visual.camera; return (c.top - c.bottom) / 2 / frScale; }
/* —— pan 的真相：原来 setPan 把位移 postMessage 给宿主，宿主并不转发 type:'pan'，
   引擎里的 pan 恒为 0 → 特写落点永远停在画面正中（当年做切近时实测 dx 恒 +189~198px，看着就是"跟随不准"）。
   改成在**我方视锥钩子里直接平移视锥**：单位就是屏幕像素，pan 与位移 1:1，标定/除法全部退出这条链路。 */
function setPan(x, y) { myPan = [x, y]; }
/* 画面可用区：三维画面被顶栏/左列/告警流/区面板/底栏压住，信息气泡的锚点必须躲开这些浮层，
   否则设备会被推到面板底下甚至画面外（实测 106-18 落在画面外 691px → 用户看到"点了没弹窗"）。 */
const OVERLAY_SEL = '.topbar,.rail,.stream,.zonepanel,.dock,.detail';
let freeCache = { t: 0, r: null };
function freeRect() {
  const host = visual.host.getBoundingClientRect();
  let off = { left: 0, top: 0 };
  try { const fe = window.frameElement; if (fe) { const fb = fe.getBoundingClientRect(); off = { left: fb.left, top: fb.top }; } } catch (e) { }
  const now = performance.now();
  if (freeCache.r && now - freeCache.t < 400) return freeCache.r;
  /* 全部换算到「场景帧客户端坐标」，与 proj() 同一坐标系 */
  const W = host.width, H = host.height, cx = W / 2, cy = H / 2;
  let x0 = 8, x1 = W - 8, y0 = 8, y1 = H - 8, seen = false;
  try {
    const doc = parent && parent.document;
    if (doc) for (const el of doc.querySelectorAll(OVERLAY_SEL)) {
      const cs = getComputedStyle(el);
      if (el.hidden || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .05) continue;
      const r = el.getBoundingClientRect();
      const L = r.left - off.left, T = r.top - off.top, R = r.right - off.left, B = r.bottom - off.top;
      if (R < 0 || B < 0 || L > W || T > H) continue;
      if (r.height > H * .45 && r.width < W * .5) {           /* 竖着的侧栏（左列指标 / 右列告警流 / 区域面板）：按中心在哪半边归类 */
        if ((L + R) / 2 < cx) { x0 = Math.max(x0, R + 20); seen = true; } else { x1 = Math.min(x1, L - 20); seen = true; }
      } else if (r.width > W * .45 && r.height < H * .5) {     /* 横着的顶栏 / 底栏 */
        if ((T + B) / 2 < cy) { y0 = Math.max(y0, B + 14); seen = true; } else { y1 = Math.min(y1, T - 14); seen = true; }
      }
    }
  } catch (e) { /* 读不到宿主（跨域嵌入）就用中央安全区 */ }
  if (!seen || x1 - x0 < W * .28 || y1 - y0 < H * .28) { x0 = W * .22; x1 = W * .78; y0 = H * .2; y1 = H * .8; }
  freeCache = { t: now, r: { x0, y0, x1, y1 } };
  return freeCache.r;
}
function centerOf(id) { const b = boxOf(id); return b ? b.getCenter(new THREE.Vector3()) : null; }
/* 视觉跟随机制（follow / reanchor / trackFollow / releaseFollow / anchorPoint）已随「点击切近」整体撤除（2026-11-07）。
   留一句为什么当初要做、又为什么撤：
   · 当初：补间只保证终点构图，房间分离动画还在改自然视锥、滚轮还会改倍率，开环解算一次必然残留误差，
     所以每帧量一次真实屏幕位置、把残差 1:1 加回 pan（一步收敛不振荡）。
   · 现在：售前投影里讲的人不希望画面被点击牵着跑，点击只弹信息卡；
     气泡靠实体自身投影每帧定位（positionCard），缩放平移都不会脱开——不再需要钉相机。
   教训常驻：删这套机制时必须 grep 调用点，bindWheel 里残留过一次 follow.want=null，每次滚轮都抛 ReferenceError。 */
/* 缩放边界必须相对「本视角自然构图」：frScale 的上界是绝对数时，跨房间点击后构图本来就在 3~4 倍，
   滚轮第一格就被拍回上限，看起来像「滚轮没反应」（当年在 103 推近后实测 4.31→1.8）。
   下界改成物理量：画面半高不小于 26cm，再近就没有信息量了。 */
function clampFr(v) {
  const base = natHH() || 1;
  return Math.max(0.012, Math.min(4, Math.max(0.26 / base, v)));
}
/* 世界坐标 → 屏幕像素。必须走 camera.project()：视锥中心（midX/midY）不是 0——
   fitFrame 按房间角点求包围盒时中心就会偏，平移 pan 之后更偏；
   旧实现按 (X-c.left)/(c.right-c.left) 少算了中心偏移，等于「量不到自己刚推出去的位移」，
   解算器以为没动就继续加 pan，实测把实体推出画面 2169px。这是跟随不准的真正根因。 */
function proj(wx, wy, wz) {
  const host = visual.host.getBoundingClientRect();
  const p = new THREE.Vector3(wx, wy, wz).project(visual.camera);
  return { x: host.left + (p.x * .5 + .5) * host.width, y: host.top + (-p.y * .5 + .5) * host.height, z: p.z };
}
function hh() { return Math.abs(natHH()); }
function snapCam() { wrapFrame(); visual.render(); visual.camera.updateMatrixWorld(); camSnap = { p: proj(REF.x, REF.y, REF.z), hh: hh(), scale: frScale }; }
/* panSens / calibPan 这条标定链已整体退役：平移在视锥钩子里按屏幕像素直接做，
   1 pan 单位 ≡ 1 像素，任何「先量一次灵敏度再除」的写法都是在给未来的构图变化埋雷。 */
function ease(t) { return t * t * (3 - 2 * t); }
function stepCam(now) {
  if (!camTween) return false;
  const t = Math.min(1, (now - camTween.t0) / camTween.dur), e = ease(t), f = camTween.from, g = camTween.to;
  visual.yaw = f.yaw + (g.yaw - f.yaw) * e;
  visual.elev = f.elev + (g.elev - f.elev) * e;
  frScale = f.scale + (g.scale - f.scale) * e;
  setPan(f.pan[0] + (g.pan[0] - f.pan[0]) * e, f.pan[1] + (g.pan[1] - f.pan[1]) * e);
  if (t >= 1) { camTween = null; frScale = g.scale; }
  return true;
}
function tween(from, to, dur) {
  wrapFrame();
  const hook = document.getElementById('twin-v2-bridge');
  if (hook) hook.dataset.tween = JSON.stringify({ reduced: REDUCED, low: LOW, dur: dur || 820, from: +from.scale.toFixed(3), to: +to.scale.toFixed(3) });
  if (REDUCED || LOW) { visual.yaw = to.yaw; visual.elev = to.elev; frScale = to.scale; setPan(to.pan[0], to.pan[1]); visual.render(); return; }
  camTween = { t0: performance.now(), dur: dur || 820, from: from, to: to };
}
function camCmd(d) {
  if (!visual) return;
  if (d.action === 'begin') { snapCam(); return; }
  if (d.action === 'drill') {                       /* 视角切换后的补位：画面先停在旧构图，再平滑推近 */
    frScale = camSnap ? camSnap.scale : 1;
    visual.render(); visual.camera.updateMatrixWorld();
    const q = proj(REF.x, REF.y, REF.z), hNew = hh();
    const s0 = camSnap ? Math.max(0.35, Math.min(4, (camSnap.hh || hNew) / hNew)) * (camSnap ? camSnap.scale : 1) : 1;
    const dx = camSnap ? camSnap.p.x - q.x : 0, dy = camSnap ? camSnap.p.y - q.y : 0;
    const pan0 = [myPan[0] + dx, myPan[1] + dy];                              /* 像素即 pan，无需换算 */
    frScale = s0; setPan(pan0[0], pan0[1]); visual.render();
    /* 终点缩放恒为 1：新视角的构图由引擎 fitFrame 自己算（下钻=自然特写、回总览=标定机位）。
       原来收在 camSnap.scale（=切换前的缩放），于是切近设备后回 S1 会停在特写上，违反 FR-10「回到同一机位」。 */
    const hm = homeFraming();   /* 终点构图：回总览要落在 HOME 机位，进房间才用该视角的自然构图 */
    tween({ yaw: visual.yaw, elev: visual.elev, scale: s0, pan: pan0 }, { yaw: visual.yaw, elev: visual.elev, scale: hm.fr, pan: hm.pan }, 760);
    return;
  }
  if (d.action === 'reset') { camTween = null; applyHome(); hideCard(); visual.render(); return; }
}
function boxOf(id) { const m = visual.modelRoots.get(id); if (!m) return null; const b = new THREE.Box3().setFromObject(m); return b.isEmpty() ? null : b; }
/* ---------- 实体信息卡（任何有名字的 CAD 实体，含桌子凳子） ---------- */
function ensureCard() {
  if (cardEl) return cardEl;
  cardEl = document.createElement('div'); cardEl.id = 'twin-v2-card'; cardEl.hidden = true;
  const st = document.createElement('style'); st.id = 'twin-v2-card-style';
  st.textContent = `#twin-v2-card{position:absolute;z-index:var(--tw-z-card);min-width:216px;max-width:262px;
 background:var(--tw-glass-float);backdrop-filter:var(--tw-blur) var(--tw-sat);-webkit-backdrop-filter:var(--tw-blur) var(--tw-sat);
 border:1px solid var(--tw-glass-border);box-shadow:var(--tw-shadow-card);border-radius:var(--tw-radius-card);
 padding:11px 13px;font-size:var(--tw-fs-body);line-height:var(--tw-lh-body);color:var(--tw-ink-1);font-family:var(--tw-font-familyUI);
 transform:translate(14px,-50%);transition:opacity var(--tw-dur-2) var(--tw-motion-easeOut),transform var(--tw-dur-2) var(--tw-motion-easeOut)}
#twin-v2-card.enter{opacity:0;transform:translate(2px,-50%)}
#twin-v2-card h4{margin:0 0 2px;font-size:var(--tw-fs-strong);font-weight:700}
#twin-v2-card .cid{font-size:var(--tw-fs-micro);color:var(--tw-ink-4);font-variant-numeric:tabular-nums;letter-spacing:.2px}
#twin-v2-card .row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px dashed var(--tw-hairline);margin-top:6px}
#twin-v2-card .row span{color:var(--tw-ink-3)}#twin-v2-card .row b{font-variant-numeric:tabular-nums;text-align:right}
#twin-v2-card .st{display:inline-flex;align-items:center;gap:5px;font-weight:700}#twin-v2-card .st i{width:7px;height:7px;border-radius:50%;background:var(--tw-st-na)}
#twin-v2-card .st.working i{background:var(--tw-st-working)}#twin-v2-card .st.ready i{background:var(--tw-st-ready)}#twin-v2-card .st.alarm i{background:var(--tw-st-alarm)}#twin-v2-card .st.na i{background:var(--tw-st-na)}#twin-v2-card .st.charging i{background:var(--tw-st-idle)}
#twin-v2-card .go{margin-top:9px;width:100%;font:inherit;font-size:var(--tw-fs-label);color:var(--tw-color-brand-strong);background:var(--tw-color-brand-soft);border:1px solid var(--tw-color-brand-line);border-radius:var(--tw-radius-pill);padding:5px 10px;cursor:pointer;transition:background var(--tw-dur-1) var(--tw-motion-easeOut)}
#twin-v2-card .go:hover{background:var(--tw-tint-run-bg)}
#twin-v2-card .x{position:absolute;right:8px;top:6px;border:0;background:0;font-size:var(--tw-fs-num);color:var(--tw-ink-4);cursor:pointer;line-height:1}
#twin-v2-card .x:hover{color:var(--tw-ink-1)}`;
  (visual.host.parentElement || document.body).append(st, cardEl);
  cardEl.style.position = 'fixed';
  cardEl.querySelector('.x')?.addEventListener('click', hideCard);
  visual.host.addEventListener('pointerdown', e => { if (cardEl && !cardEl.contains(e.target)) hideCard(); }, true);
  return cardEl;
}
function loadNames() {
  if (namesMap) return Promise.resolve(namesMap);
  return fetch('data/equipment-names.json').then(r => r.json()).then(j => { namesMap = {}; (j.equipment || []).forEach(e => { namesMap[e.cadId] = e; }); return namesMap; });
}
/* 屏上只出现运维与客户的语言，不出现我们内部的英文枚举（与撤掉 S1/S2/S3 前缀同一条口径） */
const TYPE_CN = { detect: '检测', unmanned: '无人化', sample: '制样', reception: '接待', mechanics: '力学', measure: '测量',
  materials: '材料', highvoltage: '高压', environment: '环境', electrical: '电气', control: '控制', comprehensive: '综合' };
const ROOM_CN = { '101': '接待大厅', '102': '智能样品室', '103': '智能力学室', '104': '控制室', '105': '智能高压室', '106': '无人化电缆试验区', '107': '材料试验区', '108': '环境试验区', '109': '综合试验区', '110': '数智化电气试验区' };
const ST_CN = { working: '在测', ready: '就绪', standby: '待机', stopped: '停止', alarm: '异常', charging: '停靠充电' };
function showCard(id, center) {
  ensureCard(); cardFor = id;
  loadNames().then(() => renderCard(id, center));
}
function renderCard(id, center) {
  if (!cardEl || !cardFor) return;
  const n = (namesMap || {})[id] || {}, o = objectInfo[id] || null;
  const status = o ? o.status : null;
  const b = boxOf(id);
  const fp = b ? (Math.round((b.max.x - b.min.x) * 100) / 100) + '×' + (Math.round((b.max.z - b.min.z) * 100) / 100) + ' m' : '—';
  const room = id.slice(0, 3);
  const params = (o && o.params || []).slice(0, 2).map(p => p.name + ' ' + p.value + (p.unit || '')).join(' · ');
  cardEl.innerHTML = '<button class="x" aria-label="关闭">×</button><h4>' + esc(n.displayName || n.cadName || (o && o.name) || id) + '</h4>' +
    '<div class="cid">' + id + (o && o.code ? ' · ' + o.code : '') + ' · ' + room + ' ' + (ROOM_CN[room] || '') + '</div>' +
    '<div class="row"><span>状态</span><b class="st ' + (status || 'na') + '"><i></i>' + (status ? ST_CN[status] : '无实时数据') + '</b></div>' +
    '<div class="row"><span>' + (o ? '类型' : '归档') + '</span><b>' + esc(o ? (TYPE_CN[o.type] || o.type || '—') : (n.nameConfirmed ? 'CAD 已确认名称' : 'CAD 原始名称')) + '</b></div>' +
    (o && o.subZone ? '<div class="row"><span>分区</span><b>' + esc(o.subZone) + '</b></div>' : '') +
    (params ? '<div class="row"><span>关键参数</span><b>' + esc(params) + '</b></div>' : '') +
    '<div class="row"><span>占地</span><b>' + fp + '</b></div>' +
    (o ? '<button class="go" data-go="' + id + '">查看详情与实时参数</button>' : '<div class="row"><span>数采</span><b>非数采对象</b></div>');
  cardEl.querySelector('.x').onclick = hideCard;
  cardEl.querySelector('[data-go]') && (cardEl.querySelector('[data-go]').onclick = () => parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'device-open', device: { id: id, name: (namesMap[id] || {}).displayName || id } }, location.origin));
  cardEl.hidden = false;
  cardEl.classList.add('enter'); requestAnimationFrame(() => cardEl.classList.remove('enter'));
  positionCard(id, center);
}
function positionCard(id, center) {
  if (!cardEl || cardEl.hidden) return;
  const b = center ? null : boxOf(id); const c = center || (b && b.getCenter(new THREE.Vector3()));
  if (!c) return;
  visual.camera.updateMatrixWorld();
  const p = proj(c.x, Math.max(c.y, 0.9), c.z), host = visual.host.getBoundingClientRect(), f = freeRect();
  /* 卡片用 translate(14px,-50%) 贴在实体右侧：把锚点夹进可用区，保证气泡一定看得见（宽度按实测，未渲染给 246 兜底） */
  const cw = cardEl.offsetWidth || 246, chh = (cardEl.offsetHeight || 150) / 2;
  const ax = Math.max(host.left + f.x0, Math.min(host.left + f.x1 - cw - 22, p.x - 14));
  const ay = Math.max(host.top + f.y0 + chh, Math.min(host.top + f.y1 - chh, p.y));
  cardEl.style.left = ax + 'px'; cardEl.style.top = ay + 'px';
}
function hideCard() { if (cardEl) cardEl.hidden = true; cardFor = null; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
