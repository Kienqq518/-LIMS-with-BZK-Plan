import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const T={'110':[940,360],'109':[645,435],'108':[315,585],'107':[465,725],'105':[565,845],'104':[805,845],'103':[1055,785],'102':[1355,700],'101':[1520,505],'106':[965,600]};
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(13000);   // 首屏：无任何交互
const f=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));
const cam=await f.evaluate(()=>{const v=window.visual106;const host=document.getElementById('visual-render').getBoundingClientRect();
 const o={};for(const l of v.labels){const r=l.div.getBoundingClientRect();o[l.r.id]=[Math.round(r.left+r.width/2-host.left),Math.round(r.top+r.height/2-host.top)];}
 return {yaw:+v.yaw.toFixed(3),elev:+v.elev.toFixed(3),zoom:+v.zoom.toFixed(3),view:v.view,labels:o};});
let sx=0,sy=0,n=0;for(const k in T){if(!cam.labels[k])continue;sx+=cam.labels[k][0]-T[k][0];sy+=cam.labels[k][1]-T[k][1];n++;}
const mx=sx/n,my=sy/n;
const rmse=Math.sqrt(Object.keys(T).reduce((a,k)=>{if(!cam.labels[k])return a;const dx=cam.labels[k][0]-T[k][0]-mx,dy=cam.labels[k][1]-T[k][1]-my;return a+dx*dx+dy*dy;},0)/n);
out.push((rmse<60?'✅':'❌')+` 首屏机位与截图拟合残差 RMSE=${rmse.toFixed(1)}px（${n}/10 标签，平移偏移 ${mx.toFixed(0)},${my.toFixed(0)}）`);
out.push((cam.yaw<-1.0&&cam.yaw>-1.1&&Math.abs(cam.elev-0.6)<0.02?'✅':'❌')+` 首屏相机参数 yaw=${cam.yaw} elev=${cam.elev} zoom=${cam.zoom} view=${cam.view}`);
await p.screenshot({path:'/tmp/twin-qa/cam-final.png'});
// 统计四格新口径
await p.keyboard.press('2'); await p.waitForTimeout(3000);
const cells=await p.locator('#zpStats .zp-stat span').allInnerTexts();
const vals=await p.locator('#zpStats .zp-stat b').allInnerTexts();
out.push((cells.join('|')==='已完成|执行中|异常挂起|排队'?'✅':'❌')+' 四格标题: '+cells.join('|'));
out.push((vals.join('/')==='3/2/1/0'?'✅':'❌')+' 本日106 四格值: '+vals.join('/'));
await p.click('[data-period=month]'); await p.waitForTimeout(700);
out.push(((await p.locator('#zpStats .zp-stat b').allInnerTexts()).join('/')==='60/2/1/32'?'✅':'❌')+' 本月106 四格值: '+((await p.locator('#zpStats .zp-stat b').allInnerTexts()).join('/')));
// URL 恢复的视角不再被丢弃
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html?mode=ZONE&zone=107&period=day&layers=path,labels,zones,walls#v2=1&native-nodes=1',{waitUntil:'load'});
await p.waitForTimeout(13000);
const f2=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));
const v2=await f2.evaluate(()=>window.visual106.view);
out.push((v2==='107-close'?'✅':'❌')+' 首屏 URL 视角恢复生效（sceneCmd 排队）: 场景 view='+v2);
await p.screenshot({path:'/tmp/twin-qa/cam-url-restore.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,6).join('\n'));
await b.close();
