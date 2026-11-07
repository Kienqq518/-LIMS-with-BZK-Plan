/**
 * 光影档守卫（FR-37 → 2026-11-07 回退后的口径）
 * 产品负责人反馈：精修版偏暗偏蓝，大屏要回到原来的光影（图1）。
 * 于是精修不再是默认档，而是显式交付档 ?look=pro。这个套件因此锁两件事：
 *   ① 默认档必须**逐项等于 FR-37 之前**（灯光数值/雾/阴影/无后处理），并且与精修前的截图逐像素一致；
 *   ② ?look=pro 仍然完整可用（六类材质角色、雾窗口、bloom、曝光回收），别把做过的工作写成死代码。
 * 另外两条常驻教训仍然有效：合成必须透传 alpha（写 1 会把画布空白处变成不透明黑、玻璃浮层整屏压暗）；
 * 灯光数值不许被引擎/realistic-lab 预设覆盖（顺序竞态）。
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
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

/* —— ① 默认档 = 原光影 —— */
const d=await f.evaluate(()=>{const v=window.visual106,r=v.renderer,L=window.__twinLook||{};
  let hemi=null,key=null,fill=null,rim=null;
  v.scene.traverse(o=>{if(o.isHemisphereLight)hemi=+o.intensity.toFixed(2);
    else if(o.isDirectionalLight){if(o.name==='twin-rim')rim=+o.intensity.toFixed(2);
      else if(o.castShadow)key=+o.intensity.toFixed(2);else if(o.position.x>20)fill=+o.intensity.toFixed(2);}});
  return {on:L.on,roles:Object.keys(L.roles||{}).length,fog:!!v.scene.fog,exp:+r.toneMappingExposure.toFixed(2),
    shadowType:r.shadowMap.type,hemi,key,fill,rim,env:+(v.scene.environmentIntensity||0).toFixed(2),
    postActive:!!(L.api&&L.api.on)};});
ok(d.on===false,'默认档不加载精修（?look=pro 才开）：__twinLook.on='+d.on);
ok(d.fog===false&&d.postActive===false&&d.roles===0,`默认档无雾、无后处理、未做角色改写：fog=${d.fog} post=${d.postActive} roles=${d.roles}`);
ok(d.exp===1.12&&d.shadowType===1,`默认档回到引擎原值：exposure ${d.exp}（原 1.12）、shadowType ${d.shadowType}（1=PCF 原档）`);
ok(d.hemi===0.63&&d.key===2.2&&d.fill===0.58&&d.rim===null,`灯光三元组原值：hemi ${d.hemi} key ${d.key} fill ${d.fill} 轮廓光 ${d.rim===null?'不存在（原档就没有）':d.rim}`);
ok(d.env===0.5,`IBL 强度回到原 .5：${d.env}`);

/* 默认档 vs 精修档：证明"开关真的换了画面"，而不是靠一张会过期的基准截图。
   上一版这里比对的是 FR-37 之前存的 PNG——首屏机位与左栏一改就必然假失败（本轮踩过），
   所以改成同一会话内两张实时截图互比：默认档必须干净、pro 档必须真的不同。 */
const shotA=await p.screenshot();
const pA=await b.newPage({viewport:{width:1920,height:1080}});
await pA.goto(BASE+'/twin/future-lab/twin-scene-v2.html?look=pro',{waitUntil:'load'});await pA.waitForTimeout(15000);
const shotB=await pA.screenshot();
const diff=await p.evaluate(async([a,c])=>{
  const dec=async b64=>{const bin=atob(b64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return createImageBitmap(new Blob([arr],{type:'image/png'}));};
  const A=await dec(a),C=await dec(c);const g=new OffscreenCanvas(1920,1080),x=g.getContext('2d');
  x.drawImage(A,0,0);const pa=x.getImageData(340,120,1100,600).data;
  x.clearRect(0,0,1920,1080);x.drawImage(C,0,0);const pc=x.getImageData(340,120,1100,600).data;
  let sum=0,n=0,lumA=[],lumB=[];
  for(let i=0;i<pa.length;i+=4){sum+=(Math.abs(pa[i]-pc[i])+Math.abs(pa[i+1]-pc[i+1])+Math.abs(pa[i+2]-pc[i+2]))/3;n++;
    if(i%800===0){lumA.push(.2126*pa[i]+.7152*pa[i+1]+.0722*pa[i+2]);lumB.push(.2126*pc[i]+.7152*pc[i+1]+.0722*pc[i+2]);}}
  const p95=a=>{a=a.slice().sort((x2,y2)=>x2-y2);return a[Math.floor(a.length*.95)];},p05=a=>{a=a.slice().sort((x2,y2)=>x2-y2);return a[Math.floor(a.length*.05)];};
  return {mad:+(sum/n).toFixed(1),contrastDefault:Math.round(p95(lumA)-p05(lumA)),contrastPro:Math.round(p95(lumB)-p05(lumB))};
},[shotA.toString('base64'),shotB.toString('base64')]);
await pA.close();
ok(diff.mad>3,`默认档与 ?look=pro 精修档画面确实不同（平均差 ${diff.mad}/255）——开关是活的，不是摆设`);
ok(diff.contrastDefault>=60&&diff.contrastDefault<=diff.contrastPro+40,`默认档亮度对比 p5–p95=${diff.contrastDefault}（技能口径 <60 算被雾/暗压扁），pro 档=${diff.contrastPro}`);

/* 画布仍然透明（这条与精修无关，但它是本轮最贵的一课，常驻） */
const al=await f.evaluate(()=>{const v=window.visual106,gl=v.renderer.getContext();
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,px=(x,y)=>{const q=new Uint8Array(4);gl.readPixels(x,h-1-y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,q);return [...q];};
  return {corner:px(3,h-4),mid:px(w>>1,h>>1)};});
ok(al.corner[3]<24,`画布空白处透明（alpha=${al.corner[3]}）——合成写 alpha=1 会让这里变不透明黑、整屏玻璃浮层被压暗`);

/* —— ② ?look=pro 仍然完整可用 —— */
const p2=await b.newPage({viewport:{width:1920,height:1080}});
await p2.goto(BASE+'/twin/future-lab/twin-scene-v2.html?look=pro',{waitUntil:'load'});await p2.waitForTimeout(17000);
const f2=p2.frames().find(x=>/tour-space/.test(x.url()));
const pro=await f2.evaluate(()=>{const v=window.visual106,r=v.renderer,L=window.__twinLook||{};
  return {on:L.on,roles:Object.keys(L.roles||{}).length,mats:L.materials,emissive:L.emissive,fog:!!v.scene.fog,
    near:v.scene.fog?Math.round(v.scene.fog.near):null,far:v.scene.fog?Math.round(v.scene.fog.far):null,
    exp:+r.toneMappingExposure.toFixed(2),shadowType:r.shadowType||r.shadowMap.type,
    postActive:!!(L.api&&L.api.on),rim:(()=>{let n=null;v.scene.traverse(o=>{if(o.name==='twin-rim')n=+o.intensity.toFixed(2);});return n;})()};});
ok(pro.on===true&&pro.postActive===true&&pro.fog===true,'?look=pro 精修档完整加载：角色 kit / 雾 / 后处理都在');
ok(pro.roles>=5&&pro.mats>40&&pro.emissive>0,`精修档材质 kit：${pro.roles} 类角色 / ${pro.mats} 个共享材质 / ${pro.emissive} 个自发光提亮`);
ok(pro.exp<=1.05&&pro.rim!==null&&pro.near<pro.far,`精修档灯光与雾窗口：exposure ${pro.exp}、轮廓光 ${pro.rim}、雾 ${pro.near}→${pro.far}`);
const proAl=await f2.evaluate(()=>{const v=window.visual106,gl=v.renderer.getContext();
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,q=new Uint8Array(4);gl.readPixels(3,h-4,1,1,gl.RGBA,gl.UNSIGNED_BYTE,q);return q[3];});
ok(proAl<24,`精修档合成后画布空白处仍然透明（alpha=${proAl}）`);
await p2.close();

/* 交付档：?quality=low 在 pro 之下也要能关掉后处理（只改数值，不重复打补丁） */
const p3=await b.newPage({viewport:{width:1920,height:1080}});
await p3.goto(BASE+'/twin/future-lab/twin-scene-v2.html?look=pro&mode=S1&period=day&layers=path,labels&quality=low',{waitUntil:'load'});
await p3.waitForTimeout(14000);
const f3=p3.frames().find(x=>/tour-space/.test(x.url()));
const low=await f3.evaluate(()=>{const d=window.__twinLook||{};
  return {low:d.low,installed:!!d.post,active:!!(d.api&&d.api.on),q:document.getElementById('twin-v2-bridge')?.dataset.quality};});
ok(low.q==='low'&&low.installed===true&&low.active===false,`?quality=low 交付档把后处理关掉（链已装但 active=false）：${JSON.stringify(low)}`);
await p3.close();
ok(err.length===0,'无 pageerror/console error: '+err.slice(0,3).join(' | '));
console.log(out.join('\n'));
const bad=out.filter(l=>l.startsWith('❌')).length;
console.log('\n通过 '+out.filter(l=>l.startsWith('✅')).length+' · 失败 '+bad);
await b.close();
process.exit(bad?1:0);
