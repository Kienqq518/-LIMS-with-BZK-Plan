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
const LAYERS = { path: true, labels: true, zones: true, walls: true, heatmap: false };
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
/* 墙体图层关闭=不剖切：还原层高与不透明度 */
function restoreWalls() {
  if (!wallMesh) return;
  const pos = wallMesh.geometry.attributes.position;
  pos.array.set(wallBase); pos.needsUpdate = true; wallMesh.geometry.computeBoundingSphere();
  wallMesh.material.opacity = wallOpacityBase == null ? 0.12 : wallOpacityBase;
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
    if (LOW) { dot.material.emissiveIntensity = dot.userData.mode === 'fast' ? 2.0 : dot.userData.mode === 'dim' ? 0.35 : 1.2; return; }
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
    if (t - last > (LOW ? 125 : 66)) {
      last = t; frames++;
      Object.entries(robotTargets).forEach(([id, tgt]) => {
        const g = robots[id]; if (!g || !tgt.path) return;
        ensureDot(tgt.modelRoot, tgt.action === 'charging' ? 'standby' : 'working');
        tgt.local = tgt.local == null ? tgt.progress : tgt.local + Math.max(-0.02, Math.min(0.02, tgt.progress - tgt.local)) * 0.35;
        const pts = tgt.mpts || tgt.path.map(q => new THREE.Vector3(q[0], 0, q[2]));
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


/* ---------- IoT 节点标注：身份标签 + 点击详情卡（V2 门禁内） ---------- */
const NODE_TYPE_CN = { temperature: '温湿度', light: '光照', smoke: '烟感', water: '水浸', gas: '可燃气体', motion: '人体活动', switch: '开关量', camera: '视觉' };
let nodeMeta = null, popEl = null, popFor = null;
function injectNodeStyle() {
  if (document.getElementById('twin-v2-node-style')) return;
  const st = document.createElement('style'); st.id = 'twin-v2-node-style';
  st.textContent = `.orb-tag{position:absolute;right:calc(100% + 6px);top:50%;transform:translateY(-50%);white-space:nowrap;font-size:10px;line-height:1;padding:4px 8px;border-radius:8px;background:rgba(255,255,255,.92);border:1px solid #E3E9F2;color:#415063;box-shadow:0 4px 14px rgba(15,40,80,.08);pointer-events:none;font-family:"PingFang SC",system-ui,sans-serif}
  .orb-tag b{color:#0F2740;font-weight:600}
  .orb-pop{position:absolute;z-index:30;width:216px;background:#fff;border-radius:14px;box-shadow:0 14px 40px rgba(15,40,80,.14);padding:12px 14px;font-family:"PingFang SC",system-ui,sans-serif}
  .orb-pop h4{margin:0 0 2px;font-size:13px;color:#0F2740}
  .orb-pop .id{font-size:10px;color:#8A97A7;font-family:"Fira Code",monospace;margin-bottom:8px}
  .orb-pop .row{display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px dashed #EDF1F7;color:#5B6B7D}
  .orb-pop .row b{color:#0F2740;font-weight:500}
  .orb-pop .close{position:absolute;right:8px;top:8px;border:0;background:0;font-size:15px;color:#8A97A7;cursor:pointer}
  .orb-pop .honest{font-size:10px;color:#F59E0B;margin-top:6px}`;
  document.head.append(st);
}
function annotateNodes() {
  injectNodeStyle();
  const timer = setInterval(() => {
    const orbs = document.querySelectorAll('.node-marker[data-node-id], .node-orb[data-node-id]');
    if (!orbs.length) return;
    clearInterval(timer);
    if (!nodeMeta) fetch('./data/iot-nodes.json').then(r => r.json()).then(meta => { nodeMeta = meta; paint(); });
    function paint() {
      orbs.forEach(orb => {
        if (orb.querySelector('.orb-tag')) return;
        const n = nodeMeta && nodeMeta.nodes.find(x => x.id === orb.dataset.nodeId);
        const tag = document.createElement('span'); tag.className = 'orb-tag';
        tag.innerHTML = n ? '<b>' + n.name + '</b> · ' + (NODE_TYPE_CN[n.type] || n.type) : orb.dataset.nodeId;
        orb.style.position = orb.style.position || 'absolute';
        orb.append(tag);
        /* 点击详情交给 NodeLayer 自带 NodeDetail 卡（实时读数/离线态/时间戳），此处不重复挂卡避免双卡 */
      });
    }
    if (nodeMeta) paint();
  }, 800);
}
function showPop(orb, n) {
  if (!popEl) { popEl = document.createElement('div'); popEl.className = 'orb-pop'; document.body.append(popEl); }
  if (popFor === orb.dataset.nodeId && !popEl.hidden) { closePop(); return; }
  popFor = orb.dataset.nodeId;
  const r = orb.getBoundingClientRect();
  popEl.innerHTML = '<button class="close" aria-label="关闭">×</button><h4>' + (n ? n.name : orb.dataset.nodeId) + '</h4><div class="id">' + orb.dataset.nodeId + '</div>' +
    (n ? '<div class="row"><span>类型</span><b>' + (NODE_TYPE_CN[n.type] || n.type) + '</b></div>' +
         '<div class="row"><span>房间</span><b>' + n.roomId + '</b></div>' +
         '<div class="row"><span>数据来源</span><b>' + (n.dataSource === 'mock' ? 'mock（待接三源）' : n.dataSource) + '</b></div>' +
         (n.associatedDeviceId ? '<div class="row"><span>关联设备</span><b>' + n.associatedDeviceId + '</b></div>' : '') +
         (n.placement === 'planned' ? '<div class="honest">⚠ 位置为规划示意（' + (n.placementNote || '候选位置') + '），非施工坐标</div>' : '') : '') +
    '<div class="row"><span>状态</span><b>' + (orb.getAttribute('aria-label') || '').split('，').pop() + '</b></div>';
  popEl.style.left = Math.min(innerWidth - 230, r.right + 10) + 'px';
  popEl.style.top = Math.max(66, r.top - 40) + 'px';
  popEl.hidden = false;
  popEl.querySelector('.close').onclick = closePop;
}
function closePop() { if (popEl) popEl.hidden = true; popFor = null; }
document.addEventListener('click', e => { if (popEl && !popEl.hidden && !e.target.closest('.node-orb,.node-marker') && !e.target.closest('.orb-pop')) closePop(); });

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
  annotateNodes();
  /* QA 自检钩子（DOM 可被隔离世界读取） */
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

let robotPathsDrawn = false;
function applyState(d) {
  (d.robots || []).forEach(r => {
    robotTargets[r.robotId] = Object.assign(robotTargets[r.robotId] || {}, r);
    if (r.path) robotTargets[r.robotId].mpts = manhattan(r.path).map(q => new THREE.Vector3(q[0], 0, q[1]));
    const root = robots[r.robotId] || (r.modelRoot ? (robots[r.robotId] = visual.modelRoots.get(r.modelRoot) || null) : null);
    if (root && r.homeAnchor && root.userData.homeParked !== true) {   /* 家位=环线起点，避免开机时停在设备里 */
      root.position.set(r.homeAnchor[0], 0, r.homeAnchor[2]); root.userData.homeParked = true;
    }
    if (!robots[r.robotId] && r.modelRoot) robots[r.robotId] = visual.modelRoots.get(r.modelRoot) || null;
  });
  if (!robotPathsDrawn && (d.robots || []).length) {
    robotPathsDrawn = true;
    drawRoutes(d.robots);
    auditRoutes(d.robots);
  }
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
  if (name === 'labels') statusDots.forEach(d => { d.visible = on; });
  if (name === 'zones') { const g = visual.scene.getObjectByName('twin-v2-zones'); if (g) g.visible = on; }
  if (name === 'walls') { if (on) fadeFrontWalls(); else restoreWalls(); }
  if (name === 'heatmap') { if (on) drawHeatmap(); else if (heatGroup) heatGroup.visible = false; }
  const hook = document.getElementById('twin-v2-bridge'); if (hook) hook.dataset.layers = Object.keys(LAYERS).filter(k => LAYERS[k]).join(',');
  visual.render();
}
function drawHeatmap() {
  if (!heatGroup) { heatGroup = new THREE.Group(); heatGroup.name = 'twin-v2-heat'; visual.scene.add(heatGroup); }
  heatGroup.visible = true; heatGroup.clear();
  const COL = { working: 0x2878ff, ready: 0x16a34a, standby: 0x94a3b8, stopped: 0x64748b, alarm: 0xe5484d };
  (lastDeviceStatus || []).forEach(([id, status]) => {
    const mesh = visual.modelRoots.get(id); if (!mesh) return;
    const box = new THREE.Box3().setFromObject(mesh), c = box.getCenter(new THREE.Vector3());
    const r = Math.max(0.9, Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.85);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 28),
      new THREE.MeshBasicMaterial({ color: COL[status] || COL.standby, transparent: true, opacity: status === 'alarm' ? 0.3 : 0.16, depthWrite: false, toneMapped: false }));
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
function drawRoutes(list) {
  if (!lines) return;
  lines.clear();
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
function auditRoutes(list) {
  const obs = obstacleBoxes();
  const report = { checked: 0, violations: [], obstacles: obs.length, at: new Date().toISOString() };
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
        const o = obs.find(q => x + half > q.x0 && x - half < q.x1 && z + half > q.z0 && z - half < q.z1);
        if (o) report.violations.push({ robot: r.robotId, seg: i, at: [+x.toFixed(2), +z.toFixed(2)], type: '与实体重叠/穿越', obj: o.id, h: o.h });
      }
    }
  });
  report.violations = report.violations.slice(0, 40);
  let el = document.getElementById('twin-v2-route-audit');
  if (!el) { el = document.createElement('div'); el.id = 'twin-v2-route-audit'; el.hidden = true; document.body.append(el); }
  el.dataset.checked = String(report.checked); el.dataset.obstacles = String(report.obstacles);
  el.dataset.violations = String(report.violations.length);
  el.dataset.detail = JSON.stringify(report.violations.slice(0, 6));
  parent.postMessage({ channel: 'future-lab-tech-blue-spatial', type: 'route-audit', checked: report.checked, obstacles: report.obstacles, violations: report.violations.length, detail: report.violations.slice(0, 8) }, location.origin);
  return report;
}
