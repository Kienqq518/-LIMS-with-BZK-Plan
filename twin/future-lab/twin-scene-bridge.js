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

/* ---------- 设备状态视觉分级：克制版 = 顶部小呼吸光点 + 既有描色 ---------- */
const STATUS_LIGHT = { working: [0x2878ff, 'pulse'], ready: [0x16a34a, 'static'], standby: [0x94a3b8, 'dim'], stopped: [0x64748b, 'dim'], alarm: [0xe5484d, 'fast'] };
const statusDots = new Map();
function ensureDot(devId, status) {
  const mesh = visual.modelRoots.get(devId); if (!mesh) return;
  let dot = statusDots.get(devId);
  if (!dot) {
    const box = new THREE.Box3().setFromObject(mesh);
    const mat = new THREE.MeshStandardMaterial({ color: 0x101010, emissive: 0x2878ff, emissiveIntensity: 1.4, roughness: 0.4 });
    dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mat);
    dot.position.set((box.min.x + box.max.x) / 2, box.max.y + 0.09, (box.min.z + box.max.z) / 2);
    visual.detail.add(dot); statusDots.set(devId, dot);
  }
  const conf = STATUS_LIGHT[status] || STATUS_LIGHT.standby;
  dot.material.emissive.setHex(conf[0]); dot.userData.mode = conf[1];
}
function pulseDots(t) {
  statusDots.forEach(dot => {
    if (LOW) { dot.material.emissiveIntensity = dot.userData.mode === 'fast' ? 2.0 : dot.userData.mode === 'dim' ? 0.35 : 1.2; return; }
    const mode = dot.userData.mode;
    if (mode === 'pulse') dot.material.emissiveIntensity = 1.5 + Math.sin(t * 0.0035) * 0.7;
    else if (mode === 'fast') dot.material.emissiveIntensity = 2.0 + Math.sin(t * 0.010) * 1.4;
    else if (mode === 'dim') dot.material.emissiveIntensity = 0.35;
    else dot.material.emissiveIntensity = 1.2;
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
        const g = robots[id]; if (!g || !tgt.path || tgt.path.length < 2) return;
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
        const ahead = posAt(pts, Math.min(1, tgt.local + 0.004));
        const dx = ahead.x - p.x, dz = ahead.z - p.z;
        if (Math.abs(dx) + Math.abs(dz) > 1e-4) g.rotation.y = Math.atan2(dx, dz);   /* 原地掉头：方向由前进段决定，不做平滑摆动 */
        ensureDot(tgt.modelRoot, tgt.action === 'charging' ? 'standby' : 'working');
      });
      pulseDots(t);
      if (stepCam(t)) { /* 补间期间由 stepCam 决定相机输入 */ }
      visual.render();
      if (cardFor) positionCard(cardFor);
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
   半径 16px：光点本身只有 0.045m，在总览机位下约 8px，纯射线检测基本点不中。 */
const DOT_PICK_PX = 16;
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
function bindDotPick() {
  const c = visual.renderer.domElement;
  let down = null;   /* 拖视角后松手不能算点击：与引擎自己的 moved>4px 判定同一阈值 */
  c.addEventListener('pointerdown', ev => { down = { x: ev.clientX, y: ev.clientY }; });
  c.addEventListener('pointerup', ev => {
    if (ev.button !== 0 || !down) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y); down = null;
    if (moved > 4) return;
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
const COLORS = { alarm: 0xe5484d, working: 0x2878ff, ready: 0x16a34a, standby: 0x94a3b8, guide: 0xe8d77a };

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
  startAnimLoop();
  calibPan();
  loadNames();
  wrapFrame();
  injectLayerStyle();
  /* 点击任意实体（含桌子凳子）→ 先平滑换到它所在房间，再切近 + 弹信息卡 */
  addEventListener('space-device-select', ev => {
    const id = ev.detail && ev.detail.id; if (!id) return;
    const zone = /^(\d{3})-/.test(id) ? RegExp.$1 : null;
    const want = zone === '106' ? 'close' : (zone ? zone + '-close' : visual.view);
    if (want !== visual.view) { snapCam(); window.spaceNavigation && window.spaceNavigation.setView(want); camCmd({ action: 'drill' }); }
    camCmd({ action: 'device', deviceId: id, zoneId: zone });
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
  const COL = { working: 0x2878ff, ready: 0x16a34a, standby: 0x94a3b8, stopped: 0x64748b, alarm: 0xe5484d };
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
  const hook = document.getElementById('twin-v2-bridge'); if (hook) hook.dataset.quality = low ? 'low' : 'high';
  if (visual) visual.render();
}

/* ---------- 行进路线层与避让校验（决策 2026-11-06：小机器人限 102↔106 及区间走廊，不得重叠或穿越他物） ---------- */
const ROUTE_COLORS = { 'RB-C-02': 0xe8d77a, 'RB-C-01': 0x2878ff };
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
function wallHit(x, z, half, walls) {
  for (const w of walls || []) {
    if (w.axis === 'x') {
      if (z + half > w.a && z - half < w.b && x + half > w.at && x - half < w.at) {
        if (!w.gate || !(z - half >= w.gate[0] && z + half <= w.gate[1])) return w.name;
      }
    } else {
      if (x + half > w.a && x - half < w.b && z + half > w.at && z - half < w.at) {
        if (!w.gate || !(x - half >= w.gate[0] && x + half <= w.gate[1])) return w.name;
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
  if (hook) hook.dataset.guide = String(list.filter(r => r.path && r.path.length > 1).length);
  list.forEach(r => {
    if (!r.path || r.path.length < 2) return;
    const pts = manhattan(r.path).map(q => new THREE.Vector3(q[0], 0.022, q[1]));
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: ROUTE_COLORS[r.robotId] || 0xe8d77a, transparent: true, opacity: 0.85 }));
    line.name = 'route-' + r.robotId; lines.add(line);
    /* 掉头拐点（原地掉头=直角拐点） */
    const knots = new THREE.Group(); knots.name = 'knots-' + r.robotId;
    pts.forEach((p, i) => {
      const dot = new THREE.Mesh(new THREE.CircleGeometry(i === 0 ? 0.16 : 0.09, 16),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0x16a34a : (ROUTE_COLORS[r.robotId] || 0xe8d77a), transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }));
      dot.rotation.x = -Math.PI / 2; dot.position.set(p.x, 0.024, p.z); knots.add(dot);
    });
    lines.add(knots);
    /* 门洞标记：画在墙上的绿色门槛（属路径图层，让「走门洞」这件事看得见） */
    (walls || []).filter(function (w) { return w.gate; }).forEach(function (w) {
      const len = w.gate[1] - w.gate[0];
      const cx = w.axis === 'x' ? w.at : (w.gate[0] + w.gate[1]) / 2;
      const cz = w.axis === 'x' ? (w.gate[0] + w.gate[1]) / 2 : w.at;
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w.axis === 'x' ? 0.14 : len, w.axis === 'x' ? len : 0.14),
        new THREE.MeshBasicMaterial({ color: 0x16a34a, transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false }));
      g.rotation.x = -Math.PI / 2; g.position.set(cx, 0.028, cz); lines.add(g);
    });
    /* 行进范围带：走廊（仅运输机器人有） */
    if (r.corridor) {
      const c = r.corridor;
      const band = new THREE.Mesh(new THREE.PlaneGeometry(c.x[1] - c.x[0], c.z[1] - c.z[0]),
        new THREE.MeshBasicMaterial({ color: 0xe8d77a, transparent: true, opacity: 0.10, depthWrite: false, toneMapped: false }));
      band.rotation.x = -Math.PI / 2; band.position.set((c.x[0] + c.x[1]) / 2, 0.012, (c.z[0] + c.z[1]) / 2); band.name = 'corridor-' + r.robotId;
      lines.add(band);
    }
  });
}
function auditRoutes(list, walls) {
  const obs = obstacleBoxes();
  const report = { checked: 0, violations: [], obstacles: obs.length, walls: (walls || []).length, at: new Date().toISOString() };
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
  report.violations = report.violations.slice(0, 40);
  let el = document.getElementById('twin-v2-route-audit');
  if (!el) { el = document.createElement('div'); el.id = 'twin-v2-route-audit'; el.hidden = true; document.body.append(el); }
  el.dataset.checked = String(report.checked); el.dataset.obstacles = String(report.obstacles); el.dataset.walls = String(report.walls);
  el.dataset.violations = String(report.violations.length);
  el.dataset.detail = JSON.stringify(report.violations.slice(0, 6));
  parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'route-audit', checked: report.checked, obstacles: report.obstacles, walls: report.walls, violations: report.violations.length, detail: report.violations.slice(0, 8) }, location.origin);
  return report;
}

/* ================= 相机引擎：下钻 / 切近 / 回总览（补间，不再生硬跳视角） =================
   只用 visual 的 yaw/elev/zoom + 引擎的 pan 作为输入，因此不接管 fitCamera，不与
   whiteblue-spatial-engine / scene-group-highlight 的相机计算打架。 */
const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
const REF = { x: 14, y: 0.6, z: 19 };                       // 参考世界点：用它度量切换前后的画面位移与比例
let camSnap = null, camTween = null, myPan = [0, 0], panSens = { x: 1, y: 1 }, objectInfo = {}, cardFor = null, cardEl = null, namesMap = null, frScale = 1;
/* 视锥补间：scene-group-highlight 的 fitFrame 每帧重算 camera.left/right/top/bottom 且不看 visual.zoom，
   所以只能在它「之后」按比例缩放视锥——这是下钻/切近能平滑的唯一正确接法。 */
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
        if (c.isOrthographicCamera && frScale !== 1) {
          const mx = (c.left + c.right) / 2, my = (c.top + c.bottom) / 2;
          const hw = (c.right - c.left) / 2 * frScale, hhv = (c.top - c.bottom) / 2 * frScale;
          c.left = mx - hw; c.right = mx + hw; c.top = my + hhv; c.bottom = my - hhv; c.updateProjectionMatrix();
        }
      };
    },
    set(fn) { real = fn; }
  });
}
function natHH() { const c = visual.camera; return (c.top - c.bottom) / 2 / frScale; }
function setPan(x, y) { myPan = [x, y]; if (!parent || parent === window) return; parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'pan', x: x, y: y }, location.origin); }
function proj(wx, wy, wz) {
  const v = new THREE.Vector3(wx, wy, wz).applyMatrix4(visual.camera.matrixWorldInverse);
  const c = visual.camera, host = visual.host.getBoundingClientRect();
  return { x: host.left + (v.x / (c.right - c.left) + 0.5) * host.width, y: host.top + (0.5 - v.y / (c.top - c.bottom)) * host.height };
}
function hh() { return Math.abs(natHH()); }
function snapCam() { wrapFrame(); visual.render(); visual.camera.updateMatrixWorld(); camSnap = { p: proj(REF.x, REF.y, REF.z), hh: hh(), scale: frScale }; }
function calibPan() {
  const a = proj(REF.x, REF.y, REF.z);
  setPan(myPan[0] + 40, myPan[1]); visual.render(); const bx = proj(REF.x, REF.y, REF.z);
  setPan(myPan[0], myPan[1] + 40); visual.render(); const by = proj(REF.x, REF.y, REF.z);
  panSens = { x: (bx.x - a.x) / 40 || 1, y: (by.y - a.y) / 40 || 1 };
  setPan(myPan[0], myPan[1]); visual.render();
}
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
    const pan0 = [myPan[0] + dx / panSens.x, myPan[1] + dy / panSens.y];
    frScale = s0; setPan(pan0[0], pan0[1]); visual.render();
    tween({ yaw: visual.yaw, elev: visual.elev, scale: s0, pan: pan0 }, { yaw: visual.yaw, elev: visual.elev, scale: camSnap ? camSnap.scale : 1, pan: [0, 0] }, 760);
    return;
  }
  if (d.action === 'device') { focusDevice(d.deviceId, d.zoneId); return; }
  if (d.action === 'reset') { camTween = null; frScale = 1; setPan(0, 0); hideCard(); visual.render(); return; }
}
function boxOf(id) { const m = visual.modelRoots.get(id); if (!m) return null; const b = new THREE.Box3().setFromObject(m); return b.isEmpty() ? null : b; }
function focusDevice(id, zoneId) {
  const b = boxOf(id); if (!b) return;
  const c = b.getCenter(new THREE.Vector3());
  const room = (visual.g.rooms || []).find(r => r.id === (zoneId || (id.slice(0, 3))));
  let rc = null;
  if (room) { const xs = room.points.map(q => q[0] * 0.05), zs = room.points.map(q => q[1] * 0.05); rc = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2); }
  const dir = rc ? new THREE.Vector3(c.x - rc.x, 0, c.z - rc.z) : new THREE.Vector3(-1, 0, 0);
  if (dir.lengthSq() < 0.04) dir.set(-1, 0, 0);
  dir.normalize();
  const yaw = Math.atan2(-dir.x, dir.z);                       // 相机站到「房间中心→设备」的反方向一侧，正对设备操作面
  const size = Math.max(b.max.x - b.min.x, b.max.z - b.min.z, b.max.y);
  const want = Math.max(2.4, size * 1.9);                      // 目标半高（米）：设备占画面约一半
  wrapFrame();
  const base = hh();                                   /* 当前视角的自然半高（米） */
  const sTarget = Math.max(0.12, Math.min(3, want / base));
  const from = { yaw: visual.yaw, elev: visual.elev, scale: frScale, pan: myPan.slice() };
  const to = { yaw: from.yaw + ((((yaw - from.yaw) % 6.2832) + 9.42) % 6.2832) - 3.1416, elev: 0.62, scale: frScale * sTarget, pan: [0, 0] };
  visual.yaw = to.yaw; visual.elev = to.elev; frScale = to.scale; setPan(0, 0); visual.render();
  const p = proj(c.x, c.y, c.z), host = visual.host.getBoundingClientRect();
  to.pan = [(p.x - (host.left + host.width * 0.40)) / panSens.x, (p.y - (host.top + host.height * 0.52)) / panSens.y];
  visual.yaw = from.yaw; visual.elev = from.elev; frScale = from.scale; setPan(from.pan[0], from.pan[1]);
  tween(from, to, 720);
  showCard(id, c);
}
/* ---------- 实体信息卡（任何有名字的 CAD 实体，含桌子凳子） ---------- */
function ensureCard() {
  if (cardEl) return cardEl;
  cardEl = document.createElement('div'); cardEl.id = 'twin-v2-card'; cardEl.hidden = true;
  const st = document.createElement('style'); st.id = 'twin-v2-card-style';
  st.textContent = `#twin-v2-card{position:absolute;z-index:34;min-width:216px;max-width:262px;background:rgba(255,255,255,.82);backdrop-filter:blur(12px) saturate(1.25);
 border:1px solid rgba(255,255,255,.95);box-shadow:0 16px 44px rgba(15,40,80,.16);border-radius:14px;padding:11px 13px;font-size:12px;color:#0F2740;
 transform:translate(14px,-50%);transition:opacity .25s var(--tw-motion-easeOut),transform .25s var(--tw-motion-easeOut)}
#twin-v2-card.enter{opacity:0;transform:translate(2px,-50%)}
#twin-v2-card h4{margin:0 0 2px;font-size:13px;font-weight:700}
#twin-v2-card .cid{font-size:10px;color:#8A97A7;font-variant-numeric:tabular-nums;letter-spacing:.2px}
#twin-v2-card .row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px dashed #E9EEF4;margin-top:6px}
#twin-v2-card .row span{color:#5B6B7D}#twin-v2-card .row b{font-variant-numeric:tabular-nums;text-align:right}
#twin-v2-card .st{display:inline-flex;align-items:center;gap:5px;font-weight:700}#twin-v2-card .st i{width:7px;height:7px;border-radius:50%;background:#94A3B8}
#twin-v2-card .st.working i{background:#2878FF}#twin-v2-card .st.ready i{background:#16A34A}#twin-v2-card .st.alarm i{background:#E5484D}#twin-v2-card .st.na i{background:#C3CCD6}
#twin-v2-card .go{margin-top:9px;width:100%;font:inherit;font-size:11px;color:#2878FF;background:#F2F7FF;border:1px solid #D7E4FF;border-radius:999px;padding:5px 10px;cursor:pointer}
#twin-v2-card .x{position:absolute;right:8px;top:6px;border:0;background:0;font-size:15px;color:#8A97A7;cursor:pointer;line-height:1}`;
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
const ROOM_CN = { '101': '接待大厅', '102': '智能样品室', '103': '智能力学室', '104': '控制室', '105': '智能高压室', '106': '无人化电缆试验区', '107': '材料试验区', '108': '环境试验区', '109': '综合试验区', '110': '数智化电气试验区' };
const ST_CN = { working: '在测', ready: '就绪', standby: '待机', stopped: '停止', alarm: '异常' };
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
    '<div class="row"><span>' + (o ? '类型' : '归档') + '</span><b>' + esc(o ? (o.type || '—') : (n.nameConfirmed ? 'CAD 已确认名称' : 'CAD 原始名称')) + '</b></div>' +
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
  const p = proj(c.x, Math.max(c.y, 0.9), c.z);
  cardEl.style.left = p.x + 'px'; cardEl.style.top = p.y + 'px';
}
function hideCard() { if (cardEl) cardEl.hidden = true; cardFor = null; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
