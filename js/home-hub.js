import * as THREE from "../assets/brochure/vendor/three.module.js";

/**
 * Procedural reconstruction of the cover diorama (img2threejs method:
 * primitives and generated geometry only, no imported mesh).
 * The unnamed block on the left of the reference is omitted.
 * Model accents use #0B419A.
 */
const NAVY = 0x0b419a;
const PAGE = 0xf5f7fb;

const white = new THREE.MeshStandardMaterial({ color: 0xf7f9fc, roughness: 0.4, metalness: 0.05 });
const navy = new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.32, metalness: 0.08, emissive: NAVY, emissiveIntensity: 0.22 });
const navySoft = new THREE.MeshStandardMaterial({ color: 0x3d6ad4, roughness: 0.4, metalness: 0.05, emissive: NAVY, emissiveIntensity: 0.12 });
const glass = new THREE.MeshStandardMaterial({ color: 0xeef3fb, roughness: 0.08, metalness: 0.02, transparent: true, opacity: 0.38 });

function slab(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function platform(w = 1.2, d = 1.05) {
  const g = new THREE.Group();
  const base = slab(w, 0.1, d, white);
  base.position.y = 0.05;
  const rim = slab(w + 0.08, 0.035, d + 0.08, navy);
  rim.position.y = 0.015;
  g.add(rim, base);
  return g;
}

function screenTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const g = c.getContext("2d");
  g.fillStyle = "#f4f7fd";
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = "#0B419A";
  g.fillRect(0, 0, 512, 46);
  g.fillStyle = "#ffffff";
  g.font = "700 28px 'Noto Sans SC', sans-serif";
  g.fillText("Test OS", 24, 32);
  const tiles = [
    [28, 70], [150, 70], [272, 70], [394, 70],
    [28, 168], [150, 168], [272, 168], [394, 168]
  ];
  tiles.forEach(([x, y], i) => {
    g.fillStyle = i % 3 === 0 ? "#0B419A" : "#d9e3f8";
    g.fillRect(x, y, 96, 70);
    g.fillStyle = i % 3 === 0 ? "#ffffff" : "#0B419A";
    g.fillRect(x + 14, y + 18, 68, 8);
    g.fillRect(x + 14, y + 36, 46, 8);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function labelSprite(text) {
  const c = document.createElement("canvas");
  const probe = c.getContext("2d");
  const font = "600 54px 'Noto Sans SC', sans-serif";
  probe.font = font;
  const width = Math.ceil(probe.measureText(text).width) + 32;
  c.width = width;
  c.height = 80;
  const g = c.getContext("2d");
  g.font = font;
  g.fillStyle = "#1c2430";
  g.textBaseline = "middle";
  g.fillText(text, 16, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  const height = 0.28;
  sprite.scale.set(height * (width / 80), height, 1);
  return sprite;
}

function cable(from, to) {
  const mid = from.clone().lerp(to, 0.5);
  mid.y = 0.16;
  const curve = new THREE.CatmullRomCurve3([from, mid, to]);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 28, 0.028, 6, false),
    navy
  );
  mesh.castShadow = true;
  return mesh;
}

function buildCenter() {
  const g = new THREE.Group();
  const plinth = slab(1.7, 0.16, 1.25, white);
  plinth.position.y = 0.08;
  const step = slab(1.35, 0.1, 0.95, white);
  step.position.y = 0.2;
  const glow = slab(1.5, 0.03, 1.05, navy);
  glow.position.y = 0.16;
  const neck = slab(0.12, 0.42, 0.1, white);
  neck.position.set(0, 0.46, 0.02);
  const bezel = slab(1.55, 0.98, 0.07, white);
  bezel.position.set(0, 1.05, 0);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.38, 0.82),
    new THREE.MeshBasicMaterial({ map: screenTexture() })
  );
  screen.position.set(0, 1.05, 0.04);
  g.add(plinth, step, glow, neck, bezel, screen);
  g.rotation.y = Math.PI / 5;
  return g;
}

function buildShare() {
  const g = platform(1.15, 1.05);
  const nodes = [[0, 0.55, 0.18], [-0.22, 0.32, -0.08], [0.22, 0.32, -0.08]];
  nodes.forEach(([x, y, z]) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), navy);
    s.position.set(x, y, z);
    s.castShadow = true;
    g.add(s);
  });
  for (let i = 1; i < nodes.length; i += 1) {
    const a = new THREE.Vector3(...nodes[0]);
    const b = new THREE.Vector3(...nodes[i]);
    const dir = b.clone().sub(a);
    const link = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, dir.length(), 8), navy);
    link.position.copy(a).add(b).multiplyScalar(0.5);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    g.add(link);
  }
  return g;
}

function buildLab() {
  const g = platform(1.35, 1.05);
  const block = slab(0.62, 0.55, 0.48, white);
  block.position.set(-0.12, 0.38, 0);
  const roof = slab(0.7, 0.08, 0.54, navySoft);
  roof.position.set(-0.12, 0.68, 0);
  g.add(block, roof);
  [[0.28, 0.16], [0.46, 0.28]].forEach(([x, z], i) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.28, 16), glass);
    cup.position.set(x, 0.26, z - 0.2);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.12, 16), navy);
    liquid.position.set(x, 0.18, z - 0.2);
    g.add(cup, liquid);
  });
  return g;
}

function buildChart() {
  const g = platform(1.2, 0.95);
  const board = slab(0.78, 0.5, 0.04, white);
  board.position.set(0, 0.48, 0);
  board.rotation.x = -0.35;
  g.add(board);
  [0.12, 0.22, 0.34, 0.46].forEach((h, i) => {
    const bar = slab(0.08, h, 0.04, navy);
    bar.position.set(-0.24 + i * 0.16, 0.22 + h / 2, 0.06);
    g.add(bar);
  });
  return g;
}

function buildPeople() {
  const g = platform(1.15, 1.05);
  const pts = [[0, 0.48, 0.05], [-0.24, 0.3, -0.08], [0.24, 0.3, -0.08]];
  pts.forEach(([x, y, z], i) => {
    const head = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.1 : 0.08, 20, 14), navy);
    head.position.set(x, y, z);
    head.castShadow = true;
    g.add(head);
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.012, 8, 24), navySoft);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.28;
  g.add(ring);
  return g;
}

function buildSearch() {
  const g = platform(1.05, 1.05);
  const cube = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), glass);
  cube.position.y = 0.48;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.62, 0.62, 0.62)),
    new THREE.LineBasicMaterial({ color: NAVY })
  );
  edges.position.y = 0.48;
  const lens = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 10, 24), navy);
  lens.position.set(0.02, 0.52, 0.08);
  const handle = slab(0.05, 0.22, 0.05, navy);
  handle.position.set(0.16, 0.34, 0.08);
  handle.rotation.z = -0.6;
  g.add(cube, edges, lens, handle);
  return g;
}

function buildLims() {
  const g = platform(1.25, 1.0);
  const book = slab(0.28, 0.42, 0.08, white);
  book.position.set(-0.22, 0.32, 0);
  const spine = slab(0.06, 0.42, 0.09, navy);
  spine.position.set(-0.34, 0.32, 0);
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.08, 16), navy);
  scope.position.set(0.22, 0.16, 0.05);
  const arm = slab(0.05, 0.28, 0.05, white);
  arm.position.set(0.22, 0.32, 0.05);
  const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16), navy);
  eye.rotation.z = Math.PI / 2;
  eye.position.set(0.22, 0.48, 0.12);
  g.add(book, spine, scope, arm, eye);
  return g;
}

function buildGlobe() {
  const g = platform(1.05, 1.05);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 20), navySoft);
  ball.position.y = 0.46;
  ball.castShadow = true;
  const wire = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 16, 12),
    new THREE.MeshBasicMaterial({ color: NAVY, wireframe: true })
  );
  wire.position.y = 0.46;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.02, 8, 28), navy);
  ring.rotation.x = Math.PI / 2.4;
  ring.position.y = 0.46;
  g.add(ball, wire, ring);
  return g;
}

function buildProject() {
  const g = platform(1.35, 0.9);
  const body = slab(0.95, 0.58, 0.05, white);
  body.position.set(0, 0.46, 0);
  const head = slab(0.95, 0.1, 0.05, navy);
  head.position.set(0, 0.7, 0.01);
  g.add(body, head);
  [0.2, 0.08, -0.04].forEach((y) => {
    const row = slab(0.7, 0.045, 0.02, navySoft);
    row.position.set(0, 0.32 + y, 0.04);
    g.add(row);
  });
  return g;
}

const STATIONS = [
  { name: "实验室数据采集系统", at: [0.15, 0, -3.35], build: buildShare, label: [0.55, 0.72, -0.15] },
  { name: "实验室业务管理系统", at: [-2.85, 0, -2.15], build: buildLab, label: [0, 1.2, -0.05] },
  { name: "智慧运营与决策平台", at: [2.35, 0, -2.15], build: buildChart, label: [0.95, 0.62, 0.05] },
  { name: "客户管理系统", at: [3.35, 0, 0.15], build: buildPeople, label: [0.15, 0.95, 0.55] },
  { name: "透明检测系统", at: [2.15, 0, 2.35], build: buildSearch, label: [0.15, 0.12, 0.95] },
  { name: "LIMS检测标准库", at: [0.15, 0, 3.15], build: buildLims, label: [0, 0.12, 0.95] },
  { name: "数字孪生", at: [-1.85, 0, 2.45], build: buildGlobe, label: [-1.05, 0.48, 0.05] },
  { name: "项目管理系统", at: [-3.15, 0, 0.85], build: buildProject, label: [-1.05, 0.62, 0] }
];

function buildHub() {
  const root = new THREE.Group();
  root.add(buildCenter());
  const hub = new THREE.Vector3(0, 0.12, 0.2);
  STATIONS.forEach((station) => {
    const node = station.build();
    node.position.set(station.at[0], station.at[1], station.at[2]);
    const tag = labelSprite(station.name);
    tag.position.set(station.label[0], station.label[1], station.label[2]);
    node.add(tag);
    root.add(node);
    const from = new THREE.Vector3(station.at[0], 0.08, station.at[2]);
    root.add(cable(from, hub));
  });
  return root;
}

function mount(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(PAGE, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAGE);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  camera.position.set(12.6, 10.2, 13.4);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xe7edf6, 1.05));
  const key = new THREE.DirectionalLight(0xffffff, 1.15);
  key.position.set(6, 10, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdbe6ff, 0.45);
  fill.position.set(-4, 3, -2);
  scene.add(fill);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ opacity: 0.16 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  ground.receiveShadow = true;
  scene.add(ground);
  const hubGroup = buildHub();
  hubGroup.scale.setScalar(1.08);
  hubGroup.position.x = -0.35;
  scene.add(hubGroup);

  const target = new THREE.Vector3(0, 0.35, 0);
  camera.lookAt(target);

  function resize() {
    const w = host.clientWidth || 640;
    const h = host.clientHeight || 480;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  let running = true;
  const clock = new THREE.Clock();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    navy.emissiveIntensity = 0.18 + Math.sin(t * 1.6) * 0.06;
    renderer.render(scene, camera);
  }
  frame();

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) {
      clock.start();
      frame();
    }
  });
}

const host = document.querySelector("#home-hub");
if (host) {
  const start = () => {
    try {
      mount(host);
    } catch (error) {
      const fallback = host.querySelector(".hub-fallback");
      if (fallback) fallback.hidden = false;
      console.error(error);
    }
  };
  if (document.fonts && document.fonts.load) {
    document.fonts.load("600 54px 'Noto Sans SC'").then(start, start);
  } else {
    start();
  }
}
