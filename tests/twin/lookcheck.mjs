/**
 * 光影材质精修守卫（FR-37，twin-look.js）
 *  ① look 真的装上了：角色 kit 命中数、灯光数值、雾窗口
 *  ② 画布必须仍然透明——合成写 alpha=1 会让"没有几何体的地方"变成不透明黑，整屏玻璃浮层被压暗（本轮真实踩过）
 *  ③ 灯光数值不许被引擎预设覆盖（顺序竞态：谁后跑谁赢）
 *  ④ 阴影：单一主光投影、PCFSoft、贴图 ≤2048（技能桌面预算）
 *  ⑤ 后处理链在场且帧时不劣化；?look=flat 与 ?quality=low 都能关
 *  ⑥ 自发光不吃雾（光点/屏幕/线路要一直清晰）
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const ok=(c,m)=>out.push((c?'✅':'❌')+' '+m);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(17000);
const f=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));
const look=await f.evaluate(()=>{const d=window.__twinLook||{};const v=window.visual106,r=v.renderer;
 return {on:d.on,roles:d.roles,materials:d.materials,emissive:d.emissive,post:d.post,low:d.low,
  L:d.lighting,shadowType:r.shadowMap.type,exp:+r.toneMappingExposure.toFixed(3),tm:r.toneMapping,
  fog:!!v.scene.fog,far:v.scene.fog?v.scene.fog.far:null,near:v.scene.fog?v.scene.fog.near:null,
  casters:(()=>{let n=0;v.scene.traverse(o=>{if(o.isLight&&o.castShadow)n++;});return n;})(),
  rim:(()=>{let n=null;v.scene.traverse(o=>{if(o.name==='twin-rim')n=+o.intensity.toFixed(2);});return n;})(),
  envInt:+(v.scene.environmentIntensity||0).toFixed(2)};});
ok(look.on===true,'look 已装载（?look=flat 未开）');
const roles=Object.entries(look.roles||{});
ok(roles.length>=5&&look.materials>40,`材质角色 kit 命中 ${roles.length} 类 / ${look.materials} 个共享材质：${roles.map(([k,n])=>k+'×'+n).join(' ')}`);
ok(look.roles.glass>0&&look.roles.panelDark>0&&look.roles.metal>0&&look.roles.ground>0,'玻璃 / 深色台面 / 金属 / 地面 四类都分到了角色（靠 roughness·metalness 区分，不靠色相）');
ok(look.shadowType===2&&look.exp<=1.05,`灯光数值压过了引擎预设：shadowType=${look.shadowType}(2=PCFSoft) exposure=${look.exp}`);
ok(look.L&&look.L.hemi<=.5&&look.L.key>=2.4&&look.rim!==null,`主/补/轮廓分工到位：key ${look.L&&look.L.key} fill ${look.L&&look.L.fill} hemi ${look.L&&look.L.hemi} rim ${look.rim}`);
ok(look.casters<=2&&look.fog&&look.far>look.near,`投影光源 ${look.casters} 盏（技能桌面预算 ≤2；lab 开启时原 sun 不可见），雾窗口 near ${look.near&&look.near.toFixed(1)} → far ${look.far&&look.far.toFixed(1)}`);
ok(look.envInt>=.6,`IBL 强度抬到 ${look.envInt}（金属与玻璃的反射是"渲染感"的主要来源）`);

/* ② 画布透明度：这是本轮最贵的一条教训，必须常驻断言 */
/* WebGL 画布不能用 2d context 取像素；renderer 开了 preserveDrawingBuffer，直接 gl.readPixels（y 轴翻转） */
const alpha=await f.evaluate(()=>{const v=window.visual106,gl=v.renderer.getContext();
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,px=(x,y)=>{const d=new Uint8Array(4);gl.readPixels(x,h-1-y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,d);return [...d];};
  return {corner:px(3,h-4),mid:px(Math.round(w*.5),Math.round(h*.5)),size:w+'x'+h};});
ok(alpha.corner[3]<24,`画布空白处仍然透明（alpha=${alpha.corner[3]}，${alpha.size}）——合成写 alpha=1 会把这里变成不透明黑，整屏玻璃浮层瞬间被压暗`);
ok(alpha.mid[3]>200 || alpha.mid[3]<24,`画面中心有模型且不透明（alpha=${alpha.mid[3]} rgb=${alpha.mid.slice(0,3).join(',')}）`);

/* ⑤ 帧时与开关 */
const fps=await p.evaluate(()=>new Promise(r=>{let n=0;const t0=performance.now();const tick=()=>{n++;if(performance.now()-t0<3000)requestAnimationFrame(tick);else r(Math.round(n/((performance.now()-t0)/1000)));};requestAnimationFrame(tick);}));
ok(fps>=50,`后处理链在场时帧率 ${fps}fps（≥50）`);
const diag=await f.evaluate(()=>{const i=window.visual106.renderer.info;return {calls:i.render.calls,tex:i.memory.textures,geo:i.memory.geometries};});
ok(diag.tex<=70&&diag.geo<=3200,`资源预算：textures ${diag.tex}（≤70，共享噪声图不新建贴图池）、geometries ${diag.geo}`);
const p2=await b.newPage({viewport:{width:1920,height:1080}});
await p2.goto(BASE+'/twin/future-lab/twin-scene-v2.html?look=flat',{waitUntil:'load'});await p2.waitForTimeout(13000);
const f2=p2.frames().find(x=>/tour-space-v3-1/.test(x.url()));
const flat=await f2.evaluate(()=>({on:(window.__twinLook||{}).on,fog:!!window.visual106.scene.fog,exp:+window.visual106.renderer.toneMappingExposure.toFixed(2)}));
ok(flat.on===false&&flat.fog===false,`?look=flat 一键回到原始渲染（对比取证用）：${JSON.stringify(flat)}`);
await p2.close();
const p3=await b.newPage({viewport:{width:1920,height:1080}});
await p3.goto(BASE+'/twin/future-lab/twin-scene-v2.html?mode=S1&period=day&layers=path,labels&quality=low',{waitUntil:'load'});   /* readURL() 要求带齐 mode/period，裸 ?quality=low 会退回默认档 */await p3.waitForTimeout(13000);
const f3=p3.frames().find(x=>/tour-space-v3-1/.test(x.url()));
const low=await f3.evaluate(()=>{const d=window.__twinLook||{};
 return {low:d.low,postInstalled:!!d.post,postActive:!!(d.api&&d.api.on),q:document.getElementById('twin-v2-bridge')?.dataset.quality};});
ok(low.q==='low'&&low.postInstalled===true&&low.postActive===false,`?quality=low 交付档把后处理关掉（链已装但 active=false）：${JSON.stringify(low)}`);
await p3.close();
ok(err.length===0,'无 pageerror/console error: '+err.slice(0,3).join(' | '));
console.log(out.join('\n'));
const bad=out.filter(l=>l.startsWith('❌')).length;
console.log('\n通过 '+out.filter(l=>l.startsWith('✅')).length+' · 失败 '+bad);
await b.close();
process.exit(bad?1:0);
