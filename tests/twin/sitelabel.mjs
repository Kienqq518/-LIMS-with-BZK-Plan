import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,160));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
const f=p.frames().find(x=>/tour-space/.test(x.url()));
const probe=()=>f.evaluate(()=>{
  const v=window.visual106;
  const room=[...v.labels].filter(l=>getComputedStyle(l.div).display!=='none').length;
  const orb=document.querySelectorAll('.orb-tag').length;                       /* 身份标签（名称·类型）已下线 */
  const markers=document.querySelectorAll('.node-marker[data-node-id]').length;  /* 节点标记保留，点击出详情卡 */
  let dots=0,vis=0; v.detail.traverse(o=>{ if(o.isMesh&&o.geometry&&o.geometry.type==='SphereGeometry'){dots++; if(o.visible)vis++;} });
  return {roomTotal:v.labels.length, roomVisible:room, orbTags:orb, markers:markers, dotsTotal:dots, dotsVisible:vis, cls:v.host.className};
});
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
T('按钮文案', (await p.locator('.lic[data-layer=labels]').innerText()).trim(), '场地标签');
out.push(((await p.locator('.acts').innerText()).includes('设备状态标签')?'❌':'✅')+' 顶栏不再出现「设备状态标签」字样');
const a=await probe();
/* 默认改为「场地标签不开启」（2026-11-07 产品负责人）：房间名在区域面板与顶栏下拉里都有，
   三维里飘十个标签反而压住设备；要看的人点顶栏 icon 就回来。 */
out.push((a.roomVisible===0?'✅':'❌')+' 默认：场地标签不开启（房间名 0 可见），设备状态光点仍常驻 '+a.dotsVisible+'/'+a.dotsTotal+': '+JSON.stringify(a));
out.push((a.orbTags===0&&a.markers>0?'✅':'❌')+' 物联节点身份标签已下线（.orb-tag=0），节点标记仍在 '+a.markers+' 个: orbTags='+a.orbTags);
await p.click('.lic[data-layer=labels]'); await p.waitForTimeout(1500);
const c=await probe();
out.push((c.roomVisible>=10&&c.dotsVisible===c.dotsTotal&&c.orbTags===0?'✅':'❌')+' 点开后：房间名称回来 '+c.roomVisible+'/'+c.roomTotal+'（非房间位仍隐藏）、光点仍常驻、节点标签仍为 0: '+JSON.stringify(c));
T('图层状态写入 URL（labels 已加入）', await p.evaluate(()=>new URLSearchParams(location.search).get('layers')), 'path,labels');
await p.click('.lic[data-layer=labels]'); await p.waitForTimeout(1200);
const d=await probe();
out.push((d.roomVisible===0?'✅':'❌')+' 再点收回（回到默认关）: '+d.roomVisible);
/* ⑩（2026-11-09 产品负责人：「场地标签关闭时点房间下钻」）：房间名药丸下线后，
   点房间本体的兜底链路=射线→地平面→CAD 多边形→room-selected，与点标签同一宿主通道。 */
{
  const off=await p.evaluate(()=>{const i=document.getElementById('scene')||document.querySelector('iframe');const r=i.getBoundingClientRect();return [Math.round(r.left),Math.round(r.top)];});
  const proj=async(x,z,y)=>{const q=await f.evaluate(([x,z,y])=>{const v=window.visual106,TH=v.overview.position.constructor,h=v.renderer.domElement.getBoundingClientRect();
    const s=new TH(x,y||0,z).project(v.camera);
    return [Math.round(h.left+(s.x*.5+.5)*h.width), Math.round(h.top+(-s.y*.5+.5)*h.height)];},[x,z,y]);
    return [q[0]+off[0], q[1]+off[1]];};
  const zoneNow=()=>p.evaluate(()=>document.getElementById('zoneSel').value);
  let [cx,cy]=await proj(13.9,25.5);
  await p.mouse.click(cx,cy); await p.waitForTimeout(3000);
  T('⑩ 标签关：点 106 空地面 → 下钻', await zoneNow(), '106');
  await p.keyboard.press('1'); await p.waitForTimeout(2600);
  [cx,cy]=await proj(16.5,23.6,0.9);
  await p.mouse.click(cx,cy); await p.waitForTimeout(1500);
  const cardOn=await f.evaluate(()=>{const e=document.getElementById('twin-v2-card');return e&&!e.hidden;});
  const zAfter=await zoneNow();
  out.push((cardOn&&zAfter===''?'✅':'❌')+' ⑩ 点设备本体：出卡片且不下钻（卡片优先于房间本体）: card='+cardOn+' zone='+JSON.stringify(zAfter));
  await p.keyboard.press('1'); await p.waitForTimeout(2600);
  [cx,cy]=await proj(-5,-5);
  await p.mouse.click(cx,cy); await p.waitForTimeout(1500);
  T('⑩ 点房间外（墙外空地）：什么都不发生', await zoneNow(), '');
}
T('装载链无被吞异常', await p.evaluate(()=>document.getElementById('freshTxt').textContent), '');
await p.screenshot({path:'/tmp/twin-qa/site-labels-off.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,4).join('\n'));
await b.close();
