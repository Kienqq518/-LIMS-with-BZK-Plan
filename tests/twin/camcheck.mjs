import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
/* 2026-11-08 重标：HOME 按产品负责人红框改为 fr 2.13 / pan [12,-20]（建模外框投影 756×417px，
   整体落进红框）后实测的十个房间名中心。重算方法：~/twin-qa/labels.mjs（打开场地标签→量中心），
   改一次 HOME 就要跟着重跑一次，否则这条断言拿旧截图判新构图。 */
/* 2026-11-08 FR-73 重标定：HOME pan 上移到 [-78,-92] 后实测的十个房间名中心。
   重算方法：~/twin-qa/labels.mjs（打开场地标签→量中心），改一次 HOME 就要重跑一次。 */
const T={'101':[1291,429],'102':[1160,496],'103':[952,563],'104':[795,614],'105':[624,596],'106':[885,428],'107':[584,525],'108':[498,440],'109':[670,337],'110':[859,276],'E':[0,0],'WC':[0,0]};   /* 2026-11-09 三次重标定（~/twin-qa/labels.mjs 实测）：fit 解算的 band 换算到 canvas 坐标系（iframe 顶栏 56px 偏移），十个房间名 y 整体上移 56——不是构图玄学变了，是之前解算一直把建模往顶栏底下多压 56px 没被发现 */
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(13000);   // 首屏：无任何交互
/* 场地标签默认不开启（2026-11-07），量标签基准前必须先把它打开——这同时验了开关真的能开 */
await p.click('.lic[data-layer=labels]'); await p.waitForTimeout(2200);
out.push(((await p.evaluate(()=>[...document.getElementById('scene').contentWindow.visual106.labels].filter(l=>getComputedStyle(l.div).display!=='none').length))===10?'✅':'❌')+' 场地标签开关打开后十个房间名全回来');
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
/* ①（2026-11-09）：106 统计升级为三子区域——旧「四格 + 点周期切月值」整段退役：
   周期开关在 106 已隐身，`[data-period=month]:visible` 点不到，30s 后 TimeoutError
   把整套 camcheck 带走（全量里那个 0 项的 ❌ 就是它）。周期驱动改由 103 承担（zoneview ⑤），
   三子区域的数不写死——从 /api/overview/entrust-list 独立重算（文档 §3.3）。 */
await p.keyboard.press('2'); await p.waitForTimeout(3000);
const zs3=await p.evaluate(()=>[...document.querySelectorAll('#zsGrid .zs3-c')].map(e=>({t:e.querySelector('span').innerText,v:e.querySelector('b').innerText.replace(/\s+/g,'')})));
out.push((zs3.map(x=>x.t).join('|')==='委托任务|样品|试验项目'?'✅':'❌')+' 三子区域标题: '+zs3.map(x=>x.t).join('|'));
const el=await p.evaluate(async()=>(await TwinApi.get('/api/overview/entrust-list')).data);
const en={},sa={};let dn=0,ts=0;
(el.records||[]).forEach(e=>{(e.items||[]).forEach(it=>{if(!it.cad||it.cad.slice(0,3)!=='106')return;
  if(it.state!=='done'&&it.state!=='testing')return; en[e.entrustNo]=1;
  const sid=it.sampleId||((e.samples||[e.sample])[0]||{}).id; if(sid)sa[sid]=1;
  it.state==='done'?dn++:ts++;});});
const exp=[String(Object.keys(en).length),String(Object.keys(sa).length),(dn+'+'+ts)];
out.push((zs3.length===3&&zs3.map(x=>x.v).join('|')===exp.join('|')?'✅':'❌')+' 106 三子区域值＝entrust-list 独立重算 '+exp.join('|')+'（屏上 '+zs3.map(x=>x.v).join('|')+'）');
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
