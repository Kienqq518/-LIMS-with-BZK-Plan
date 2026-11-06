/**
 * 点击与键盘入口（2026-11-06 反馈）
 *  ① 设备状态光点常驻且**可点**：光点不在 CAD 拾取集合里，必须按屏幕距离命中后转成设备选中
 *  ② 点设备本体仍然出信息卡（回归保护）
 *  ③ 物联节点：身份标签下线，点标记出详情卡（#iot-audit 的 cardVisible）
 *  ④ 告警行键盘可达：role/tabindex + Enter 打开详情 + 焦点在区内时该区滚动暂停
 *  ⑤ B 区瓶颈告警全部归 106（无人化区看本区）
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
/* 在画面安全区里找可点目标：左栏 x<300、右侧浮层 x>innerWidth-360、底栏 y>innerHeight-150 都不能点 */
const SAFE = `(x,y)=>x>300&&x<innerWidth-360&&y>90&&y<innerHeight-150`;
const out=[],err=[];
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(16000);
const f=p.frames().find(x=>/tour-space/.test(x.url()));
const card=()=>f.evaluate(()=>{const e=document.getElementById('twin-v2-card');return e?{open:!e.hidden&&getComputedStyle(e).display!=='none',txt:e.innerText.replace(/\s+/g,' ').slice(0,70)}:{open:false};});
const closeCard=()=>f.evaluate(()=>{const e=document.getElementById('twin-v2-card'); if(e) e.hidden=true; window.visual106.selected=null;});
/* 把 CAD 视口坐标换算到顶层页面坐标（iframe 只有一层，但要算上偏移） */
async function toTop(x,y){   /* CAD 视口坐标 → 顶层页面坐标：逐层加上 iframe 自身的偏移 */
  let fx=x, fy=y, cur=f;
  while(cur.parentFrame()){ const fe=await cur.frameElement(); const bb=await fe.boundingBox(); fx+=bb.x; fy+=bb.y; cur=cur.parentFrame(); }
  return {x:fx,y:fy};
}
/* 先进 106（光点与设备都在这个视角里） */
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(3500);

// ① 点状态光点
const dotPt=await f.evaluate(()=>{
  const v=window.visual106, dots=v.statusDots; if(!dots||!dots.size) return {err:'no-statusDots-hook'};
  const host=v.host.getBoundingClientRect(); let pick=null;
  dots.forEach((dot,id)=>{ if(pick) return; const s=new (dot.position.constructor)(); s.setFromMatrixPosition(dot.matrixWorld); s.project(v.camera);
    if(s.z>1) return; const x=host.left+(s.x*0.5+0.5)*host.width, y=host.top+(-s.y*0.5+0.5)*host.height;
    if(x>host.left+300&&x<host.right-360&&y>host.top+90&&y<host.bottom-150) pick={id,x,y}; });
  return pick || {err:'no-visible-dot-in-safe-area', total:dots.size};
});
out.push((!dotPt.err?'✅':'❌')+' 光点位置可取（statusDots 钩子 + 画面内可点）: '+JSON.stringify(dotPt).slice(0,110));
if(!dotPt.err){
  await closeCard();
  const t=await toTop(dotPt.x,dotPt.y);
  await p.mouse.click(t.x,t.y); await p.waitForTimeout(2200);
  const c=await card();
  out.push((c.open&&c.txt.includes(dotPt.id)?'✅':'❌')+` 点光点 → 弹出 ${dotPt.id} 的设备信息卡: ${JSON.stringify(c).slice(0,120)}`);
  T('点光点后相机切近（画面半高变小）', await f.evaluate(()=>{const v=window.visual106;return +( (v.camera.top-v.camera.bottom)/2 ).toFixed(2);}) < 12, 'true');
}

// ①b 拖视角后松手落在光点上，不能误开弹窗（与引擎同一 4px 阈值）
if(!dotPt.err){
  await closeCard();
  const t=await toTop(dotPt.x,dotPt.y);
  await p.mouse.move(t.x-120,t.y); await p.mouse.down(); await p.mouse.move(t.x+40,t.y+30,{steps:8}); await p.mouse.up();
  await p.waitForTimeout(1200);
  const c=await card();
  out.push((!c.open?'✅':'❌')+` 拖拽后松手在光点上不误触发: card.open=${c.open}`);
  const yawChanged=await f.evaluate(()=>Math.abs(window.visual106.yaw)>0);
  out.push((yawChanged?'✅':'❌')+' 该次拖拽确实转了视角（不是空操作）');
}

// ② 点设备本体（回归保护）：挑一个当前落在安全区的设备，别写死 106-06（切近后它可能已被浮层压住）
const devPt=await f.evaluate(()=>{
  const v=window.visual106; let pick=null;
  v.modelRoots.forEach((m,id)=>{ if(pick) return;
    const s=new (m.position.constructor)(); s.setFromMatrixPosition(m.matrixWorld); s.project(v.camera);
    if(s.z>1) return; const host=v.host.getBoundingClientRect();
    const x=host.left+(s.x*0.5+0.5)*host.width, y=host.top+(-s.y*0.5+0.5)*host.height;
    if(x>host.left+300&&x<host.right-360&&y>host.top+90&&y<host.bottom-150) pick={id,x,y}; });
  return pick || {err:'no-device-in-safe-area'};
});
if(!devPt.err){ await closeCard(); const t2=await toTop(devPt.x,devPt.y); await p.mouse.click(t2.x,t2.y); await p.waitForTimeout(2200);
  const c2=await card(); out.push((c2.open&&c2.txt.includes(devPt.id)?'✅':'❌')+` 点设备本体（${devPt.id}）仍出信息卡: ${JSON.stringify(c2).slice(0,110)}`); }
else out.push('❌ 点设备本体：画面安全区内找不到设备 '+JSON.stringify(devPt));

// ③ 物联节点：身份标签下线，点标记出详情卡（用 #iot-audit 的 worldAnchors 找画面内可点的节点）
T('身份标签（名称·类型）已下线', await f.evaluate(()=>document.querySelectorAll('.orb-tag').length), 0);
await p.keyboard.press('1'); await p.waitForTimeout(2500);
const nodeInfo=await f.evaluate(()=>{
  const a=document.getElementById('iot-audit'); if(!a) return {err:'no-iot-audit'};
  const j=JSON.parse(a.textContent); const host=window.visual106.host.getBoundingClientRect();
  const c=(j.worldAnchors||[]).filter(w=>w.visible&&w.screen&&w.screen.x>host.left+300&&w.screen.x<host.right-360&&w.screen.y>host.top+90&&w.screen.y<host.bottom-150);
  return {total:(j.worldAnchors||[]).length, visible:j.visibleCount, pick:c.length?{id:c[0].id,x:c[0].screen.x,y:c[0].screen.y}:null};
});
out.push((nodeInfo.total>0&&nodeInfo.visible>0?'✅':'❌')+` 节点标记仍在 ${nodeInfo.total} 个、画面内可见 ${nodeInfo.visible}、安全区内可点 ${nodeInfo.pick?1:0}`);
if(nodeInfo.pick){
  const t3=await toTop(nodeInfo.pick.x,nodeInfo.pick.y);
  await p.mouse.click(t3.x,t3.y); await p.waitForTimeout(1500);
  const audit=await f.evaluate(()=>{const a=document.getElementById('iot-audit'); return a?JSON.parse(a.textContent):null;});
  out.push((audit&&audit.cardVisible&&audit.selectedId===nodeInfo.pick.id?'✅':'❌')+` 点节点 → 详情卡（selectedId=${audit&&audit.selectedId}，期望 ${nodeInfo.pick.id}，cardVisible=${audit&&audit.cardVisible}）`);
  out.push((audit&&/更新时间|最后收到数据/.test(audit.cardText||'')?'✅':'❌')+' 卡内含读数与更新时间: '+(audit&&audit.cardText?audit.cardText.replace(/\s+/g,' ').slice(0,60):'-'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
}

// ④ 告警行键盘可达（回到总览，告警流在屏）
await p.keyboard.press('1'); await p.waitForTimeout(2500);
const rowAttrs=await p.evaluate(()=>{const r=document.querySelector('.st-row'); return r?{role:r.getAttribute('role'),tab:r.getAttribute('tabindex'),aria:(r.getAttribute('aria-label')||'').slice(0,40)}:null;});
out.push((rowAttrs&&rowAttrs.role==='button'&&rowAttrs.tab==='0'&&rowAttrs.aria?'✅':'❌')+' 告警行有 role=button + tabindex=0 + aria-label: '+JSON.stringify(rowAttrs));
await p.evaluate(()=>document.getElementById('detail').hidden=true);
await p.locator('.st-row').first().focus(); await p.waitForTimeout(400);
const paused=await p.evaluate(()=>{const r=document.activeElement.closest('.asec'); return r?getComputedStyle(r.querySelector('.asec-track')).animationPlayState:'no-asec';});
out.push((paused==='paused'?'✅':'❌')+' 键盘焦点落在区内 → 该区滚动暂停（focus-within）: '+paused);
await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
const kb=await p.evaluate(()=>({open:!document.getElementById('detail').hidden, txt:document.getElementById('detailBody').innerText.replace(/\s+/g,' ').slice(0,50)}));
out.push((kb.open&&/原因|闭环状态/.test(kb.txt)?'✅':'❌')+' Enter 打开告警详情（与点击同一入口）: '+JSON.stringify(kb).slice(0,110));
const spaceScroll=await p.evaluate(()=>{const y0=scrollY; return y0;});
await p.keyboard.press('Escape'); await p.waitForTimeout(600);
T('Esc 关详情', await p.evaluate(()=>document.getElementById('detail').hidden), 'true');

// ⑤ B 区瓶颈全部归 106
const bzones=await p.locator('.asec[data-sec=B] .st-row').evaluateAll(els=>[...new Set(els.map(e=>e.dataset.zone))]);
out.push((bzones.length===1&&bzones[0]==='106'?'✅':'❌')+' B 区（阻塞·瓶颈）告警区域归属: '+JSON.stringify(bzones));
const bcount=await p.locator('.asec[data-sec=B] .cnt').innerText();
out.push((/今日 4 · 未解除 3/.test(bcount)?'✅':'❌')+' B 区计数不变（只是归属收拢）: '+bcount);
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(3000);
const zB=await p.locator('#zpAlarms .zsec[data-sec=B] .zsec-hd .cnt').innerText();
out.push((/今日 4 · 未解除 3/.test(zB)?'✅':'❌')+' 106 面板 B 区今日 4（原 3）: '+zB);
T('106 面板告警合计', await p.evaluate(()=>document.getElementById('zpAlarmsN').textContent.replace(/\s+/g,'')), '今日11·未解除8');
await p.screenshot({path:'/tmp/twin-qa/pickcheck.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
