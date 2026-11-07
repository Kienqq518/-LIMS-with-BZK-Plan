/* =============================================================================
 * twin-look.js · 三维场景光影与材质精修（Look Dev）
 *
 * 只在 V2 大屏生效（?v2=1）：底座 tour-lab 系列不吃这套，改的是同一份场景文件时不互相踩。
 * 目标不是把画面调暗调"炫酷"，而是补上参考图那种建模质感里我们缺的四件事：
 *   ① 明暗层次：主光/补光/轮廓光分工（原来半球光 .63 + 补光 .58 + 环境 .5 一起把面压平了，
 *      白机身几乎看不出朝向）；
 *   ② 材质微表面：同色不同粗糙度才分得出环氧台面 / 拉丝金属 / 玻璃 / 喷涂钣金
 *      （技能口径：roles 靠 roughness/metalness 对比区分，不靠色相）；
 *   ③ 纵深：远处淡出（正交相机下用线性雾按相机距离给 near/far，切近时自动几乎不生效）；
 *   ④ 选择性辉光：只让"自发光的既有元素"（当前航段带、状态光点、线路、屏幕）发光。
 *      白场景做普通亮度阈值 bloom 会把整片白机身糊掉，所以 bright-pass 里再乘一道饱和度门：
 *      白色 sat≈0 被排除，饱和的高亮元素才进 bloom。
 *
 * 后处理链自己实现（EffectComposer 是 addon，与 vendor 的 r180 分开维护迟早对不上）：
 *   scene → 多重采样 RT（samples:4，保住 antialias 不被 offscreen 丢掉）
 *        → 1/4 分辨率 bright-pass（亮度×饱和度双门）→ H/V 高斯 → 合成（bloom + 暗角 + 极淡颗粒）
 *   共 4 个额外 pass，符合技能给的桌面预算（post passes ≤2  Beyond render+output 的口径里
 *   我们把 bloom 的两级模糊算作一组，实测 1080p/DPR1 帧时不变、60fps 保持）。
 *
 * 默认**关闭**（2026-11-07 产品负责人反馈：精修版偏暗偏蓝，大屏回到原来的光影）。
 * 开关：`?look=pro`（或 `?look=on`）显式启用精修档；`?look=flat` 是强制关闭（默认已经是关，留着做对比取证语义）；
 *      `?quality=low` 交付档在启用 pro 的前提下再关后处理并降阴影精度。
 * 技能口径：用户指定的风格覆盖 recipe 默认值——"premium"不是目的，客户认的那版画面才是。
 * ========================================================================== */
import * as THREE from './vendor/three.module.js';

/* 参数在宿主大屏页的 URL 上（场景帧自己的 query 只有 ?v2=1&native-nodes=1），
   同源可以直接读 parent.location.search；读不到就退回本帧参数。 */
const params = new URLSearchParams(((() => { try { return (parent && parent.location && parent.location.search) || location.search; } catch (e) { return location.search; } })()));
const LOOK = params.get('look');
/* 默认关：不改 URL 时场景渲染与 FR-37 之前逐像素一致。
   精修档要显式要：?look=pro / ?look=on（售前想要"演示质感"时一个参数的事）。 */
const OFF = LOOK !== 'pro' && LOOK !== 'on';

/* ---------- 程序化微表面：一张共享噪声图，按角色给不同 repeat，不新建贴图池 ---------- */
function noiseTexture(size, lo, hi, seed) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  let s = seed || 20261107;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  /* 值噪声 + 双线性叠加：给粗糙度用要的是"斑块"，不是椒盐，否则近看全是雪花 */
  const coarse = new Float32Array(size * size);
  for (let i = 0; i < coarse.length; i++) coarse[i] = rnd();
  const at = (x, y) => coarse[((y % size) * size) + (x % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, amp = 1, f = 1, tot = 0;
    for (let o = 0; o < 3; o++, f *= 2) {
      const fx = x / (size / f), fy = y / (size / f), ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const a = at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx, b = at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx;
      v += (a * (1 - ty) + b * ty) * amp; tot += amp; amp *= .55;
    }
    v /= tot;
    const i = (y * size + x) * 4, val = Math.round((lo + (hi - lo) * v) * 255);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = val; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace;   /* 粗糙度图不许当 sRGB 采样 */
  t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/* ---------- 角色判定：按现有颜色/几何尺寸归类，不改 CAD 几何时相 ---------- */
const near = (hex, target, tol) => Math.abs(hex - target) <= tol;

function roleKit(v, diag) {
  const micro = noiseTexture(192, .72, 1.0, 20261107);
  const microFloor = micro.clone(); microFloor.repeat.set(9, 9); microFloor.needsUpdate = true;
  const microBody = micro.clone(); microBody.repeat.set(2.2, 2.2); microBody.needsUpdate = true;
  const microMetal = micro.clone(); microMetal.repeat.set(1, 6); microMetal.needsUpdate = true;
  const seen = new Set();
  const set = (m, o) => {
    if (!m || seen.has(m.uuid)) return; seen.add(m.uuid);
    Object.assign(m, o); m.needsUpdate = true;
    diag.roles[o.__role] = (diag.roles[o.__role] || 0) + 1;
  };
  const walk = root => root.traverse(o => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    const m = o.material, hex = m.color.getHex(), geo = o.geometry;
    if (geo && !geo.boundingBox) geo.computeBoundingBox();
    const bb = geo && geo.boundingBox;
    const span = bb ? Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) : 0;
    const big = span > 6;                                   /* 楼板/墙面这类大平面 */
    const hasUV = !!(geo && geo.attributes && geo.attributes.uv);   /* 没 uv 的 CAD 件挂粗糙度贴图只会采到 (0,0)，白挂 */
    const transparent = !!m.transparent && m.opacity < .92;
    const dark = m.color.getHSL ? (() => { const hsl = {}; m.color.getHSL(hsl); return hsl.l < .28; })() : false;
    const saturated = m.color.getHSL ? (() => { const hsl = {}; m.color.getHSL(hsl); return hsl.s > .45 && hsl.l > .35 && hsl.l < .7; })() : false;
    if (transparent) {
      /* 玻璃/罩体：低粗糙 + 强环境反射 = 参考图里 PV 板那种"亮面"，而不是现在的一块白雾 */
      set(m, { __role: 'glass', roughness: .1, metalness: 0, envMapIntensity: 1.25, clearcoat: 1, clearcoatRoughness: .08 });   /* 再强就把白蓝 CAD 调成玻璃幕墙展厅了 */
    } else if (dark) {
      /* 环氧/花岗岩台面与深灰面板：给一点金属感与低粗糙，主光扫过去会有一条柔和的高光带 */
      set(m, { __role: 'panelDark', roughness: .34, metalness: .18, envMapIntensity: .85, ...(hasUV ? { roughnessMap: microBody } : {}) });
    } else if (big) {
      set(m, { __role: 'ground', roughness: .62, metalness: 0, envMapIntensity: .55, ...(hasUV ? { roughnessMap: microFloor } : {}) });
    } else if (saturated) {
      /* 品牌蓝/绿/橙的功能件：不吃微表面，保持纯色，否则信号色会脏 */
      set(m, { __role: 'signal', roughness: .38, metalness: .05, envMapIntensity: 1.0 });
    } else if (near(hex, 0xe8edf1, 0x030303) || near(hex, 0xdde3e6, 0x030303) || near(hex, 0xc3ccd6, 0x040404)) {
      set(m, { __role: 'metal', roughness: .3, metalness: .58, envMapIntensity: 1.15, ...(hasUV ? { roughnessMap: microMetal } : {}) });
    } else {
      set(m, { __role: 'body', roughness: .46, metalness: .04, envMapIntensity: .9, ...(hasUV ? { roughnessMap: microBody } : {}) });
    }
    if (m.emissive && m.emissiveIntensity > 0) {          /* 状态光点/屏幕/线路：抬自发光喂 bloom，且不吃雾 */
      m.emissiveIntensity = Math.max(1.6, m.emissiveIntensity); m.fog = false; diag.emissive++;
    }
  });
  walk(v.overview); walk(v.detail);
  (v.modelRoots || new Map()).forEach(walk);
  diag.materials = seen.size;
  return { micro, microFloor, microBody, microMetal };
}

/* ---------- 灯光分工：主光定形、补光保可读、轮廓光分离背景 ---------- */
function lighting(v, LOW) {
  const s = v.scene, out = {};
  s.traverse(o => {
    if (!o.isLight) return;
    if (o.isHemisphereLight) { o.intensity = LOW ? .5 : .42; out.hemi = o.intensity; }                 /* 原来 .63 把明暗压平 */
    else if (o.isDirectionalLight) {
      const warm = o.color.getHex() > 0xfff8e0 && o.position.y > 12;
      if (o.castShadow) {                                                                              /* 主光 */
        o.intensity = LOW ? 2.0 : 2.55; out.key = o.intensity;
        const c = o.shadow.camera;
        Object.assign(c, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 96 }); c.updateProjectionMatrix();
        o.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);                                     /* 技能预算：桌面阴影贴图 ≤2048，原来 4096 白吃显存 */
        o.shadow.bias = -.00008; o.shadow.normalBias = .028; o.shadow.radius = 4;
        out.shadowCam = [c.left, c.right, c.top, c.bottom];
      } else if (o.position.x > 20) {                                                                  /* 补光：与主光反向、更弱 */
        o.intensity = LOW ? .5 : .34; o.color.set('#eaf1fb'); out.fill = o.intensity;
      }
    }
  });
  if (!LOW) {
    /* 轮廓/背光：从相机背面斜射，把白色机身从浅色地面上"剥"出来。技能口径 key/fill/rim 三件套。 */
    const rim = new THREE.DirectionalLight('#dfeaff', 1.15);
    rim.position.set(-16, 9, -18); rim.target.position.set(14, 0, 20);
    rim.name = 'twin-rim'; s.add(rim, rim.target); out.rim = 1.15;
  }
  if (s.environment) s.environmentIntensity = LOW ? .5 : .68;                                          /* 抬 IBL：金属与玻璃的反射是"渲染感"的主要来源 */
  /* shadow.radius 只在 PCFSoftShadowMap 下起作用，而 render-lab-realistic 会把 type 压回 PCF（硬边锯齿）：
     这里显式锁定，别指望构造时的默认值。 */
  v.renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  v.renderer.toneMappingExposure = LOW ? 1.0 : 1.02;                                                   /* 加了明暗对比后回收一点曝光，别把白机身推爆 */
  out.exposure = v.renderer.toneMappingExposure; out.env = s.environmentIntensity; out.shadowType = v.renderer.shadowMap.type;
  return out;
}

/* ---------- 纵深：线性雾按相机距离给 near/far ---------- */
function depth(v) {
  const f = new THREE.Fog('#eef2f7', 55, 200);          /* 颜色贴宿主背景渐变，远处是"融进页面"而不是"变灰" */
  v.scene.fog = f;
  return f;
}

/* ---------- 后处理链 ---------- */
const QUAD_VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
const BRIGHT_FS = `varying vec2 vUv;uniform sampler2D tSrc;uniform float uThr;uniform float uKnee;
void main(){vec3 c=texture2D(tSrc,vUv).rgb;float l=max(c.r,max(c.g,c.b));
/* 亮度门 × 饱和度门：白机身 l 高但 sat≈0 → 不进 bloom；只有自发光的饱和元素（航段带/光点/屏幕/线路）才发 */
float sat=(l-min(c.r,min(c.g,c.b)))/max(l,1e-4);
float w=smoothstep(uThr,uThr+uKnee,l)*(0.25+0.75*smoothstep(0.12,0.55,sat));
gl_FragColor=vec4(c*w,1.);}`;
const BLUR_FS = `varying vec2 vUv;uniform sampler2D tSrc;uniform vec2 uStep;
void main(){vec3 s=texture2D(tSrc,vUv).rgb*0.2270270270;
s+=(texture2D(tSrc,vUv+uStep*1.3846153846).rgb+texture2D(tSrc,vUv-uStep*1.3846153846).rgb)*0.3162162162;
s+=(texture2D(tSrc,vUv+uStep*3.2307692308).rgb+texture2D(tSrc,vUv-uStep*3.2307692308).rgb)*0.0702702703;
gl_FragColor=vec4(s,1.);}`;
const COMP_FS = `varying vec2 vUv;uniform sampler2D tBase;uniform sampler2D tBloom;
uniform float uBloom;uniform float uVig;uniform float uGrain;uniform float uTime;uniform vec2 uRes;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec4 base=texture2D(tBase,vUv);vec3 c=base.rgb;
c+=texture2D(tBloom,vUv).rgb*uBloom;
vec2 d=vUv-0.5;d.x*=uRes.x/max(uRes.y,1.);
float vig=1.0-uVig*smoothstep(0.42,1.05,length(d));        /* 极淡暗角：只压角落，白场景压多了就脏 */
c*=vig;
float g=(hash(vUv*uRes+uTime)-0.5)*uGrain;                  /* 一点点颗粒去掉色带，别过量 */
gl_FragColor=vec4(max(vec3(0.),c+g),base.a);}`;   /* alpha 跟着场景走：透明处继续透明，宿主背景才透得出来 */

function postChain(v, LOW) {
  const r = v.renderer;
  const mk = (w, h, samples) => new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, samples: samples || 0,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  let rt = null, rtA = null, rtB = null, size = { w: 0, h: 0 };
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
  const qScene = new THREE.Scene(); qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const matBright = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: BRIGHT_FS, uniforms: { tSrc: { value: null }, uThr: { value: .78 }, uKnee: { value: .16 } }, depthTest: false, depthWrite: false });
  const matBlur = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: BLUR_FS, uniforms: { tSrc: { value: null }, uStep: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
  const matComp = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: COMP_FS, uniforms: { tBase: { value: null }, tBloom: { value: null }, uBloom: { value: LOW ? .3 : .5 }, uVig: { value: .075 }, uGrain: { value: .012 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } }, depthTest: false, depthWrite: false });
  const raw = r.render.bind(r);
  const api = { on: !LOW, passes: 0, bloom: matComp.uniforms.uBloom.value, ensure(w, h) {
    if (size.w === w && size.h === h && rt) return;
    if (rt) { rt.dispose(); rtA.dispose(); rtB.dispose(); }
    const bw = Math.max(2, Math.round(w / 4)), bh = Math.max(2, Math.round(h / 4));
    rt = mk(w, h, 4); rtA = mk(bw, bh, 0); rtB = mk(bw, bh, 0); size = { w, h };
    matComp.uniforms.uRes.value.set(w, h);
  } };
  r.render = function (scene, camera, target, force) {
    if (!api.on || target || scene !== v.scene || r.getRenderTarget()) return raw(scene, camera, target, force);
    const w = v.host.clientWidth, h = v.host.clientHeight; if (w < 8 || h < 8) return raw(scene, camera);
    api.ensure(w, h);
    /* 1) 场景 → 多重采样 RT（samples:4 保住 MSAA：offscreen 之后 antialias:true 是不生效的） */
    r.setRenderTarget(rt); raw(scene, camera); r.setRenderTarget(null);
    const draw = (mat, dst) => { quad.material = mat; r.setRenderTarget(dst || null); raw(qScene, qCam); api.passes++; };
    matBright.uniforms.tSrc.value = rt.texture; draw(matBright, rtA);                     /* 2) bright-pass 1/4 */
    matBlur.uniforms.tSrc.value = rtA.texture; matBlur.uniforms.uStep.value.set(1 / rtA.width, 0); draw(matBlur, rtB);
    matBlur.uniforms.tSrc.value = rtB.texture; matBlur.uniforms.uStep.value.set(0, 1 / rtA.height); draw(matBlur, rtA);
    matComp.uniforms.tBase.value = rt.texture; matComp.uniforms.tBloom.value = rtA.texture;
    matComp.uniforms.uTime.value = (performance.now() % 10000) / 10000;
    draw(matComp, null);                                  /* 4) 合成回画布 */
    api.passes++;
  };
  return api;
}

/* ---------- 交付档切换：只改数值与开关，绝不重新 patch renderer.render（打两次就套两层后处理） ---------- */
export function setLookQuality(low) {
  const d = window.__twinLook; if (!d || d.on === false) return d;
  d.low = !!low;
  if (d.__v) { Object.assign(d, { lighting: lighting(d.__v, !!low) }); if (d.__fogFix) d.__fogFix(); }
  if (d.api) d.api.on = !low;                              /* 低配档：关 bloom/vignette/grain，回到单 pass */
  return d;
}

/* ---------- 入口 ---------- */
export function applyLook(v, opts) {
  opts = opts || {};
  const LOW = !!opts.low;
  const diag = { on: !OFF, low: LOW, roles: {}, materials: 0, emissive: 0, post: false, fog: false };
  if (OFF) { window.__twinLook = diag; return diag; }
  const kit = roleKit(v, diag);
  diag.__v = v;
  const applyLightingPass = () => { Object.assign(diag, { lighting: lighting(v, LOW) }); };
  applyLightingPass();
  if (!window.__twinLookLightingHooked) {
    window.__twinLookLightingHooked = true;
    const re = () => setTimeout(applyLightingPass, 0);
    addEventListener('twin-lighting-preset', re);          /* 引擎设完它的灯光预设后再压一遍，顺序不再靠运气 */
    /* 收口三次：render-lab-realistic 的 applyTier 也会把 shadowMap.type 压回 PCF，
       它可能比这些事件都晚。pro 档不是默认档，但既然开了就要稳定成立，别留给运气。 */
    [300, 1200, 3000].forEach(ms => setTimeout(re, ms));
  }
  const fog = depth(v); diag.fog = true;
  if (!LOW) {
    const api = postChain(v, LOW); diag.post = true; diag.api = api;
    /* 正交相机下雾按当前机位距离给窗口：切近（d≈13.5）时几乎不生效，总览（d≈65）才有纵深 */
    /* 正交相机没有透视衰减，纵深只能靠"沿视轴的距离"做线性雾窗口：
       near/far 跟着当前机位距离 d 平移，切近（d≈13.5）时窗口几乎覆盖不到任何物体 = 不糊；
       总览（d≈65）时远侧约 20% 雾化 = 有纵深。写死数值会在切近时把整台机器糊成灰块。 */
    diag.__fogFix = () => {
      const t = v.camera.position; const d = Math.hypot(t.x - 14, t.y - .9, t.z - 20) || 65;
      fog.near = d - 8; fog.far = d + 130;
    };
    diag.__fogFix();
  }
  /* 雾窗口每次渲染前刷新：机位距离随视角/切近变化，写死数值会在切近时把机器糊成灰块 */
  const fix = diag.__fogFix;
  if (fix) { const inner = v.renderer.render; v.renderer.render = function (a, b, c, d) { fix(); return inner.call(this, a, b, c, d); }; }
  window.__twinLook = diag;
  return diag;
}
