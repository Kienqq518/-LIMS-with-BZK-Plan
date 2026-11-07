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
T('装载链无被吞异常', await p.evaluate(()=>document.getElementById('freshTxt').textContent), '');
await p.screenshot({path:'/tmp/twin-qa/site-labels-off.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,4).join('\n'));
await b.close();
