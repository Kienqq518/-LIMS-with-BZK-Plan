import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const T={'110':[924,269],'109':[678,348],'108':[454,483],'107':[566,593],'105':[618,686],'104':[842,709],'103':[1046,643],'102':[1317,555],'101':[1488,467],'106':[958,466]};   /* 2026-11-07 重标：首屏改走 HOME 机位（frScale 1.16、上移 78px）后实测的标签中心 */
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
/* 周期切换器同屏可能有两份（左栏 .rail>.period 与面板 #zpPeriod），必须点可见的那一份：
   106 撤掉左栏指标后 .rail>.period 只是 display:none，仍在 DOM 里，直接写属性选择器会撞 strict mode。 */
await p.locator('[data-period=month]:visible').first().click(); await p.waitForTimeout(700);
out.push(((await p.locator('#zpStats .zp-stat b').allInnerTexts()).join('/')==='60/2/1/32'?'✅':'❌')+' 本月106 四格值: '+((await p.locator('#zpStats .zp-stat b').allInnerTexts()).join('/')));
// URL 恢复的视角不再被丢弃
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html?mode=ZONE&zone=107&period=day&layers=path,labels,zones,walls#v2=1&native-nodes=1',{waitUntil:'load'});
await p.waitForTimeout(13000);
const f2=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));
const v2=await f2.evaluate(()=>window.visual106.view);
out.push((v2==='107-close'?'✅':'❌')+' 首屏 URL 视角恢复生效（sceneCmd 排队）: 场景 view='+v2);
/* FR-10 的真正含义是「S1 按钮回到同一机位」。2026-11-07「点击切近 + 视觉跟随」撤除后，
   点击设备本身不再动 frScale（以前会被压到 0.1~0.3），所以这里两条断言换成：
   ① 点击后构图逐位不变；② 点过设备再回 S1，仍然是标定构图（这条以前是缺的）。 */
await p.click('.mode[data-mode=S1]'); await p.waitForTimeout(3000);
const f3=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));   /* 上面 goto 过一次，旧 frame 已 detach */
const base=await f3.evaluate(()=>{const v=window.visual106;return {hh:+(((v.camera.top-v.camera.bottom)/2)).toFixed(2),view:v.view};});
await f3.evaluate(()=>window.dispatchEvent(new CustomEvent('space-device-select',{detail:{id:'106-01',name:'x',roomId:'106'}})));
await p.waitForTimeout(3000);
const zoom=await f3.evaluate(()=>+((window.visual106.camera.top-window.visual106.camera.bottom)/2).toFixed(2));
const camJ=await f3.evaluate(()=>document.getElementById('twin-v2-bridge').dataset.cam);
await p.click('.mode[data-mode=S1]'); await p.waitForTimeout(3500);
const back=await f3.evaluate(()=>{const v=window.visual106;return {hh:+(((v.camera.top-v.camera.bottom)/2)).toFixed(2),view:v.view};});
out.push((Math.abs(zoom-base.hh)<=0.05?'✅':'❌')+` 点击设备不改构图（切近已撤除）：标定 hh ${base.hh} → 点击后 ${zoom}`);
out.push((/"anchor"/.test(camJ)===false?'✅':'❌')+` 机位发布口不再带 anchor（跟随机制下线）: ${camJ.slice(0,88)}`);
out.push((Math.abs(back.hh-base.hh)<=0.3?'✅':'❌')+` 点过设备后回 S1 仍是标定构图：hh ${base.hh} → ${back.hh}（容差 0.3）`);
await p.screenshot({path:'/tmp/twin-qa/cam-url-restore.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,6).join('\n'));
await b.close();
