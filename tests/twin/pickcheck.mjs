/**
 * 点击与键盘入口（2026-11-06 反馈）
 *  ① 设备状态光点常驻且**可点**：光点不在 CAD 拾取集合里，必须按屏幕距离命中后转成设备选中
 *  ② 点设备本体仍然出信息卡（回归保护）
 *  ③ 物联节点：身份标签下线，点标记出详情卡（#iot-audit 的 cardVisible）
 *  ④ 告警行键盘可达：role/tabindex + Enter 打开详情 + 焦点在区内时该区滚动暂停
 *  ⑤ B 区瓶颈告警全部归 106（无人化区看本区）
 */
import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
/* 在画面安全区里找可点目标：左栏 x<300、右侧浮层 x>innerWidth-360、底栏 y>innerHeight-150 都不能点 */
const SAFE = `(x,y)=>x>300&&x<innerWidth-360&&y>90&&y<innerHeight-200`;
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
await gotoZone(p, '106'); await p.waitForTimeout(3500);

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
  const hh0=await f.evaluate(()=>{const v=window.visual106;return +( (v.camera.top-v.camera.bottom)/2 ).toFixed(2);});
  const t=await toTop(dotPt.x,dotPt.y);
  await p.mouse.click(t.x,t.y); await p.waitForTimeout(1600);
  const c=await card();
  out.push((c.open&&c.txt.includes(dotPt.id)?'✅':'❌')+` 点光点 → 弹出 ${dotPt.id} 的设备信息卡: ${JSON.stringify(c).slice(0,120)}`);
  /* 2026-11-07：点光点只出卡，不再切近（原断言「画面半高变小」测的正是被撤除的这条行为） */
  T('点光点后相机一动不动（画面半高不变）', await f.evaluate(()=>{const v=window.visual106;return +( (v.camera.top-v.camera.bottom)/2 ).toFixed(2);}), hh0);
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

// ②b 卡里的「查看详情与实时参数」按钮：三条分支都要有落点（openDeviceByCad 此前被删却仍被调用 → 点了必崩）
const goBtn=()=>f.evaluate(()=>{const c=document.getElementById('twin-v2-card'); if(!c||c.hidden||getComputedStyle(c).display==='none') return null;
  const e=c.querySelector('[data-go]'); return e?e.textContent.trim():null;});
const go=async()=>{ await f.evaluate(()=>{const c=document.getElementById('twin-v2-card'); const e=c&&!c.hidden&&c.querySelector('[data-go]'); if(e) e.click();}); await p.waitForTimeout(1300);
  return p.evaluate(()=>({open:!document.getElementById('detail').hidden,txt:document.getElementById('detailBody').innerText.replace(/\s+/g,' ')})); };
let g=await goBtn();
if(g){ const r=await go(); out.push((r.open&&/数采分系统/.test(r.txt)?'✅':'❌')+` 设备卡「查看详情」打开台账详情（${devPt&&devPt.id}）: ${r.txt.slice(0,70)}`); }
else out.push('❌ 设备卡里没有「查看详情」按钮（应有台账落点）');
/* 机器人本体：点它应给真状态（停靠充电），不是「无实时数据」。
   注意：106-09 属 106 模型组，在 102-close 视角里 worldVisible=false，所以只能在总览点它；
   本体在 CAD 里被货架挡住时点不中，因此点它的**状态光点**（屏幕距离命中，专为这种小目标做的入口）。 */
/* 用按钮而不是按键回总览：上一步刚点过场景内部，焦点还在 iframe 里，键盘 '1' 会被桥接层转发而不可靠 */
await p.click('.mode[data-mode=S1]'); await p.waitForTimeout(3500);
const robPt=await f.evaluate(()=>{const v=window.visual106,d=v.statusDots&&v.statusDots.get('106-09'); if(!d) return {err:'停靠的机器人没有光点'};
  if(v.view!=='overall-101') return {err:'相机没回总览，view='+v.view};
  const s=new(d.position.constructor)(); s.setFromMatrixPosition(d.matrixWorld); s.project(v.camera); const h=v.host.getBoundingClientRect();
  const x=h.left+(s.x*.5+.5)*h.width, y=h.top+(-s.y*.5+.5)*h.height;
  if(!(x>h.left+300&&x<h.right-360&&y>h.top+90&&y<h.bottom-200)) return {err:'光点不在可点区域 '+Math.round(x)+','+Math.round(y)};
  return {x,y};});
out.push((!robPt.err?'✅':'❌')+' 停靠的机器人也有状态光点（暗色待机，且在总览里可点）: '+JSON.stringify(robPt).slice(0,90));
if(!robPt.err){ await closeCard(); const t4=await toTop(robPt.x,robPt.y); await p.mouse.click(t4.x,t4.y); await p.waitForTimeout(2400);
  const c4=await card();
  out.push((c4.open&&/RB-C-01/.test(c4.txt)&&/停靠充电/.test(c4.txt)&&!/无实时数据/.test(c4.txt)?'✅':'❌')+' 点停靠的机器人 → 卡内是机器人真状态（停靠充电，非「无实时数据」）: '+c4.txt.slice(0,100));
  const g4=await goBtn();
  if(g4){ const r4=await go(); out.push((r4.open&&/复合机器人 RB-C-01/.test(r4.txt)&&/停靠位置 102-05 充电位/.test(r4.txt)?'✅':'❌')+' 机器人卡「查看详情」→ 机器人详情（openRobot 分支）: '+r4.txt.slice(0,110)); }
  else out.push('❌ 机器人卡里没有「查看详情」按钮');
  await p.keyboard.press('Escape');
}
/* 未建档实体：诚实降级，不编状态（回 106 视角，台桌在那儿） */
await gotoZone(p, '106'); await p.waitForTimeout(3500);
const tabPt=await f.evaluate(()=>{const v=window.visual106,m=v.modelRoots.get('106-18'); if(!m) return null;
  const s=new(m.position.constructor)(); s.setFromMatrixPosition(m.matrixWorld); s.project(v.camera); const h=v.host.getBoundingClientRect();
  return {x:h.left+(s.x*.5+.5)*h.width,y:h.top+(-s.y*.5+.5)*h.height};});
if(tabPt){ await closeCard(); const t5=await toTop(tabPt.x,tabPt.y); await p.mouse.click(t5.x,t5.y); await p.waitForTimeout(2200);
  const g5=await goBtn();
  /* 数采口径更正（任务9）：除了凳子椅子，制样/检测/测量设备都是数采对应。
     所以无台账记录的 CAD 实体不再写「非数采对象」，状态也不再写「无实时数据」而是按设备状态「停机」显示；
     诚实降级仍然降级——不给可点的空「查看详情」入口，也不许编一个运行/就绪出来。 */
  if(g5){ const r5=await go(); out.push((r5.open&&/数采对应/.test(r5.txt)&&/停机/.test(r5.txt)&&!/运行|就绪/.test(r5.txt)?'✅':'❌')+' 未建档实体 → 数采对应·台账待接入 + 状态停机（不编实时态）: '+r5.txt.slice(0,86)); }
  else out.push((g5===null?'✅':'❌')+' 未建档实体的卡里没有「查看详情」按钮（只有「数采对应·台账待接入」标注，不给可点的空入口）');
}

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
/* 分区撤掉后滚动轨道就是 #streamTrack 本身：键盘焦点必须能暂停它（悬停暂停已验过，键盘同理） */
const paused=await p.evaluate(()=>{const on=document.activeElement.closest('#streamTrack'); return on?getComputedStyle(document.getElementById('streamTrack')).animationPlayState:'不在轨道内';});
out.push((paused==='paused'?'✅':'❌')+' 键盘焦点落在区内 → 该区滚动暂停（focus-within）: '+paused);
await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
const kb=await p.evaluate(()=>({open:!document.getElementById('detail').hidden, txt:document.getElementById('detailBody').innerText.replace(/\s+/g,' ').slice(0,50)}));
out.push((kb.open&&/原因|闭环状态/.test(kb.txt)?'✅':'❌')+' Enter 打开告警详情（与点击同一入口）: '+JSON.stringify(kb).slice(0,110));
const spaceScroll=await p.evaluate(()=>{const y0=scrollY; return y0;});
await p.keyboard.press('Escape'); await p.waitForTimeout(600);
T('Esc 关详情', await p.evaluate(()=>document.getElementById('detail').hidden), 'true');

// ⑤ B 区瓶颈全部归 106
const bzones=await p.locator('#streamTrack .st-row[data-grade=B]').evaluateAll(els=>[...new Set(els.map(e=>e.dataset.zone))]);
out.push((bzones.length===1&&bzones[0]==='106'?'✅':'❌')+' B 区（阻塞·瓶颈）告警区域归属: '+JSON.stringify(bzones));
const bcount=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/alarms');const A=r.data.alarms||r.data;const B=A.filter(x=>x.grade==='B');return '今日 '+B.length+' · 未解除 '+B.filter(x=>x.status!=='resolved').length;});
out.push((/今日 4 · 未解除 3/.test(bcount)?'✅':'❌')+' B 区计数不变（只是归属收拢）: '+bcount);
await gotoZone(p, '106'); await p.waitForTimeout(3000);
const zB=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/alarms');const A=(r.data&&r.data.alarms)||[];const B=A.filter(x=>x.grade==='B');return '今日 '+B.length+' · 未解除 '+B.filter(x=>x.status!=='resolved').length;});
out.push((/今日 4 · 未解除 3/.test(zB)?'✅':'❌')+' 106 面板 B 区今日 4（原 3）: '+zB);
T('106 面板告警合计', await p.evaluate(()=>document.getElementById('zpAlarmsN').textContent.replace(/\s+/g,'')), '今日11·未解除8');
await p.screenshot({path:'/tmp/twin-qa/pickcheck.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
