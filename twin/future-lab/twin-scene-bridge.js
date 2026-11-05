/**
 * 孪生 V2 场景桥（运行于 tour-space iframe 内，?v2=1 才激活）
 * 职责：机器人实体 + AMR 通道引导线 + 设备状态描色 + 性能上报。
 * 数据由宿主经 postMessage(channel 'twin-v2') 推送，本层不直连任何业务系统。
 */
import * as THREE from './vendor/three.module.js';
const CHANNEL = 'twin-v2';
if (new URLSearchParams(location.search).get('v2') === '1') boot();


/* ---------- 墙体/隔断/柱子/地面分区处理（V1 视觉语言 §3：看设备运行，不看房间布局） ---------- */
let wallMesh = null, wallBase = null, labCenter = null;
function findWalls() {
  visual.overview.children.forEach(c => {
    if (c.isMesh && c.material && c.material.transparent && c.material.color && c.material.color.getHex() === 0xbbcbd7) {
      wallMesh = c; wallBase = Float32Array.from(c.geometry.attributes.position.array);
    }
  });
  if (wallMesh && !labCenter) {
    const rooms = visual.g.rooms || [];
    let mx = 0, mz = 0, n = 0;
    rooms.forEach(r => r.points.forEach(q => { mx += q[0] * 0.05; mz += q[1] * 0.05; n++; }));
    labCenter = new THREE.Vector3(mx / n, 0, mz / n);
  }
}
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
  wallMesh.material.opacity = 0.12;
}
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
    const mode = dot.userData.mode;
    if (mode === 'pulse') dot.material.emissiveIntensity = 1.5 + Math.sin(t * 0.0035) * 0.7;
    else if (mode === 'fast') dot.material.emissiveIntensity = 2.0 + Math.sin(t * 0.010) * 1.4;
    else if (mode === 'dim') dot.material.emissiveIntensity = 0.35;
    else dot.material.emissiveIntensity = 1.2;
  });
}

/* ---------- 平滑动画环：机器人插值 + 光点呼吸（15fps 足够，省电） ---------- */
let animStarted = false, robotTargets = {};
function startAnimLoop() {
  if (animStarted) return; animStarted = true;
  let last = 0;
  const loop = t => {
    if (t - last > 66) {
      last = t;
      Object.entries(robotTargets).forEach(([id, tgt]) => {
        const g = robots[id]; if (!g || !tgt.path) return;
        ensureDot(tgt.modelRoot, tgt.action === 'charging' ? 'standby' : 'working');
        tgt.local = tgt.local == null ? tgt.progress : tgt.local + Math.max(-0.02, Math.min(0.02, tgt.progress - tgt.local)) * 0.35;
        const pts = tgt.path.map(q => new THREE.Vector3(q[0], 0, q[2]));
        const tt = Math.max(0, Math.min(1, tgt.local)) * (pts.length - 1);
        const i = Math.min(pts.length - 2, Math.floor(tt)), f = tt - i;
        const p = pts[i].clone().lerp(pts[i + 1], f);
        g.position.set(p.x, 0, p.z);
        const dir = pts[i + 1].clone().sub(pts[i]); g.rotation.y = Math.atan2(dir.x, dir.z);
      });
      pulseDots(t);
      visual.render();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
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
  /* AMR 通道引导线（#E8D77A，planned 坐标，待现场标定） */
  const guide = new THREE.Group(); guide.name = 'twin-v2-guide';
  const mk = (pts) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0], 0.02, p[1]))),
    new THREE.LineBasicMaterial({ color: COLORS.guide, transparent: true, opacity: 0.9 }));
  guide.add(mk([[11.0, 25.0], [13.6, 25.6], [16.4, 24.8], [17.6, 21.0], [17.6, 15.5], [16.2, 12.4], [13.2, 11.8], [11.0, 13.2], [11.0, 20.0], [11.0, 25.0]]));
  const dash = mk([[11.2, 25.0], [17.2, 19.6]]); dash.material.color.set(0x2878ff); dash.material.opacity = 0.5; guide.add(dash);
  v.scene.add(guide); lines = guide;

  /* 机器人：直接驱动 CAD 真实复合机器人模型（106-09→RB-C-01，106-08→RB-C-02），不再放程序化假机器人 */
  robots = {};

  treatArchitecture();
  applyMaterialPass();
  startAnimLoop();
  /* QA 自检钩子（DOM 可被隔离世界读取） */
  const hook = document.createElement('div'); hook.id = 'twin-v2-bridge';
  hook.dataset.guide = String(guide.children.length); hook.dataset.robots = String(Object.keys(robots).length); hook.dataset.walls = wallMesh ? '1' : '0';
  document.body.append(hook);
  parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'bridge-ready', guide: guide.children.length, robots: Object.keys(robots).length }, location.origin);

  /* 宿主状态推送 */
  addEventListener('message', async e => {
    const d = e.data; if (!d || d.channel !== CHANNEL) return;
    if (d.type === 'state') applyState(d);
  });

  /* 性能上报（debug-profiler） */
  setInterval(() => {
    const info = visual.renderer.info.render, mem = visual.renderer.info.memory;
    parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'perf', calls: info.calls, tris: info.triangles, geometries: mem.geometries, textures: mem.textures }, location.origin);
  }, 5000);
}

let robotPathsDrawn = false;
function applyState(d) {
  (d.robots || []).forEach(r => {
    robotTargets[r.robotId] = Object.assign(robotTargets[r.robotId] || {}, r);
    if (!robots[r.robotId] && r.modelRoot) robots[r.robotId] = visual.modelRoots.get(r.modelRoot) || null;
  });
  if (!robotPathsDrawn && (d.robots || []).length) {   /* 蓝色虚线按真实路径重画 */
    robotPathsDrawn = true;
    const dash = lines && lines.children[1];
    if (dash && d.robots[0]) {
      const pts = d.robots[0].path.map(q => new THREE.Vector3(q[0], 0.021, q[2]));
      dash.geometry.setFromPoints(pts);
    }
  }
  Object.entries(d.deviceStatus || {}).forEach(([node, st]) => { tint(node, st); ensureDot(node.replace('cad:', ''), st); });
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
