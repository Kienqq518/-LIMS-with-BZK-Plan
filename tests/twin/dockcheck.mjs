/**
 * 底栏四块（2026-11-06 产品负责人方案）
 *  ① 设备信息统计   ② 无人化调度任务队列（图3 流程配置 + 图1 三分类）
 *  ③ 正在检测委托单下的试验项（图4 名称与检测设备）  ④ 组态物联节点（按房间排序）
 * 另验：队列状态跟着循环剧本实时变；心跳刷新不能把无缝滚动重置；行的点击/键盘有落点。
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(16000);

// 结构
T('底栏块数', await p.locator('.dock .dk').count(), 4);
T('块标题', (await p.locator('.dk>header b').allInnerTexts()).join('|'), '设备信息统计|无人化调度任务|试验项完成情况|组态物联节点');

// ① 设备信息统计：六格 + 稼动率 + 机器人分工
const cells=await p.evaluate(()=>[...document.querySelectorAll('#dkDevBody .dk-cell')].map(e=>e.innerText.replace(/\s+/g,'')));
const nums=cells.map(c=>parseInt(c,10));
out.push((cells.length===6&&/^\d+在测$/.test(cells[0])?'✅':'❌')+' 块1 六格状态统计: '+cells.join(' '));
out.push((nums[0]+nums[1]+nums[2]+nums[3]+nums[4]===nums[5]?'✅':'❌')+` 块1 自洽：五档之和 ${nums.slice(0,5).reduce((a,x)=>a+x,0)} == 合计 ${nums[5]}`);
const rate=await p.evaluate(()=>document.querySelector('#dkDevBody .dk-rate').innerText.replace(/\s+/g,' '));
out.push((/稼动率 \d+%"?/.test(rate.replace(/"/g,''))?'✅':'❌')+' 块1 稼动率现算: '+rate);
const rb=await p.evaluate(()=>document.querySelectorAll('#dkDevBody .dk-rate')[1].innerText.replace(/\s+/g,' '));
out.push((/在跑 1 · 停靠充电 1/.test(rb)?'✅':'❌')+' 块1 机器人分工（一台跑 / 一台常驻充电位）: '+rb);

// ② 任务队列：三分类分组 + 与流程配置一致
const grp=await p.evaluate(()=>[...document.querySelectorAll('#dkQueueTrack .dq-grp')].slice(0,3).map(e=>e.innerText.replace(/\s+/g,' ')));
out.push((grp.length>=3&&/进行中/.test(grp[0])&&/未派单/.test(grp[1])&&/已完成/.test(grp[2])?'✅':'❌')+' 块2 三分类分组表头（图1）: '+JSON.stringify(grp));
const q=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/dispatch-queue');
  return {n:r.data.tasks.length, flows:[...new Set(r.data.tasks.map(t=>t.flowCode))].sort(), counts:r.data.counts};});
out.push((q.n===16&&q.flows.length===11?'✅':'❌')+` 块2 数据=图3 流程配置 16 条 / 11 种流（含图1 的热延伸取放 0161/0162）：${q.flows.join(',')}`);
out.push((q.counts.running+q.counts.unassigned+q.counts.done===16?'✅':'❌')+' 块2 三态合计=16: '+JSON.stringify(q.counts));
const names=await p.evaluate(()=>[...new Set([...document.querySelectorAll('#dkQueueTrack .dq-row .nm')].map(e=>e.innerText.trim()))].length);
out.push((names>=11?'✅':'❌')+' 块2 渲染出的任务名（流号+流名）覆盖全部 11 种流: '+names);

// ②b 队列状态跟着循环剧本走（进行中那一行 = 机器人当前停靠/正在前往的站）
/* 「循环中」的正确性只能在一次响应内校验：队列与剧本各自按墙上时钟取模，
   分两次调用（cycle 与 dispatch-queue）之间剧本会推进，跨响应比较必然出现"两个答案都对但不一致"。
   停在 102 家位/返航段时本来就没有流号（liveFlow=null 是对的），所以要重试到拿到一条流为止。 */
let sync=null, seenFlows=new Set();
for(let k=0;k<10;k++){
  sync=await p.evaluate(async()=>{
    const q2=await TwinApi.get('/api/overview/dispatch-queue');
    const run=q2.data.tasks.filter(t=>t.shown==='running');
    const liveRows=q2.data.tasks.filter(t=>t.live);
    return {liveFlow:q2.data.liveFlow, runFlows:[...new Set(run.map(t=>t.flowCode))],
      liveCount:liveRows.length, liveCad:(liveRows[0]||{}).cad, order:(q2.data.liveOrder||null)};
  });
  if(sync.liveFlow) seenFlows.add(sync.liveFlow);
  if(seenFlows.size>=2) break;
  await p.waitForTimeout(4000);
}
out.push((sync.liveFlow&&sync.runFlows.indexOf(sync.liveFlow)>=0&&sync.liveCount===1?'✅':'❌')
  +' 块2「循环中」在同一次响应内自洽（liveFlow 属于 running 且只标一行）: live='+sync.liveFlow+' running='+sync.runFlows.join(','));
out.push((seenFlows.size>=2?'✅':'❌')+' 随剧本推进换过 '+seenFlows.size+' 条流: '+[...seenFlows].join(' → '));
out.push((sync.liveCad&&/^\d{3}-\d{2}$/.test(sync.liveCad)?'✅':'❌')+' 「循环中」那行的工位由剧本反推: '+sync.liveCad);

const before=await p.evaluate(()=>({dur:getComputedStyle(document.getElementById('dkQueueTrack')).transform,pos:document.getElementById('dkQueueTrack').getBoundingClientRect().y}));
await p.waitForTimeout(7000);
const after=await p.evaluate(()=>({dur:getComputedStyle(document.getElementById('dkQueueTrack')).transform,pos:document.getElementById('dkQueueTrack').getBoundingClientRect().y,
  cnt:document.getElementById('dkQueueCnt').innerText}));
out.push((Math.abs(after.pos-before.pos)>0.5?'✅':'❌')+` 心跳刷新不重置无缝滚动（7s 内位移 ${(after.pos-before.pos).toFixed(1)}px；重建 innerHTML 会跳回原点）`);
out.push((/循环同步/.test(after.cnt)?'✅':'❌')+' 块2 头部显示与剧本同步: '+after.cnt.replace(/\s+/g,' '));

// ③ 试验项（图4 的名称与检测设备）
const items=await p.evaluate(()=>[...document.querySelectorAll('#dkItemsTrack .ti-row')].slice(0,5).map(e=>({t:e.innerText.replace(/\s+/g,' '),cls:e.className})));
const want=['哑铃样尺寸检查','绝缘厚度测量试验','老化前绝缘的机械性能试验','XLPE绝缘的热延伸试验','XLPE绝缘的收缩试验'];
out.push((items.length>=5&&want.every(w=>items.some(x=>x.t.includes(w)))?'✅':'❌')+' 块3 五个试验项名称与图4 一致: '+items.map(x=>x.t.split(' ')[0]).join(' | '));
out.push((items.every(x=>/砝码库|测试仪|测试系统|检测系统/.test(x.t))?'✅':'❌')+' 块3 每行带检测设备: '+items[1].t);
const states=await p.evaluate(()=>[...document.querySelectorAll('#dkItemsTrack .ti-row')].slice(0,5).map(e=>e.classList.contains('testing')||e.classList.contains('pending')||e.classList.contains('done')||e.classList.contains('redo')));
out.push((states.every(Boolean)?'✅':'❌')+' 块3 四态标注（未检测/检测中/已完成/退回复测）齐: '+states.join(','));
const head=await p.evaluate(()=>document.getElementById('dkItemsHead').innerText);
out.push((/SC2026-0422/.test(head)&&/时效/.test(head)?'✅':'❌')+' 块3 头部=正在检测的委托单: '+head);

// ④ 组态物联节点：按房间排序 + 读数 + 心跳
const nd=await p.evaluate(()=>[...document.querySelectorAll('#dkNodesTrack .nd-row')].slice(0,16).map(e=>({rm:e.querySelector('.rm').innerText,nm:e.querySelector('.nm').innerText,rd:e.querySelector('.rd').innerText})));
out.push((nd.length>=16&&nd.every((x,i)=>i===0||x.rm>=nd[i-1].rm)?'✅':'❌')+' 块4 按房间 101→110 排序滚动: '+nd.slice(0,6).map(x=>x.rm+x.nm).join(' '));
out.push((nd.filter(x=>/画面未接入/.test(x.rd)).length===4?'✅':'❌')+' 块4 视觉点位诚实标注「画面未接入」（4 个摄像头）: '+nd.filter(x=>/画面未接入/.test(x.rd)).length);
out.push((nd.filter(x=>/℃|lx|正常|无人|有人|触点|已触发|超限/.test(x.rd)).length>=12?'✅':'❌')+' 块4 其余点位显示实时读数（与场景节点层同源）');
const cnt=await p.evaluate(()=>document.getElementById('dkNodesCnt').innerText);
out.push((/16 个点位 · 按房间排序/.test(cnt)?'✅':'❌')+' 块4 头部计数: '+cnt);

// 点击与键盘落点（冻结滚动后挑窗口内的行）
const land=await p.evaluate(()=>{
  document.querySelectorAll('.dk-track').forEach(t=>t.style.animation='none');
  const pick=(sel)=>{const tr=document.querySelector(sel); const v=tr.closest('.dk').querySelector('.dk-view').getBoundingClientRect();
    return [...tr.children].filter(e=>e.dataset.cad||e.dataset.node).map(e=>({e,r:e.getBoundingClientRect()})).filter(x=>x.r.top>=v.top-1&&x.r.bottom<=v.bottom+1)[0];};
  const q=pick('#dkQueueTrack'), ti=pick('#dkItemsTrack'), nd=pick('#dkNodesTrack');
  return {qCad:q&&q.e.dataset.cad, qRole:q&&q.e.getAttribute('role'), tiCad:ti&&ti.e.dataset.cad, ndNode:nd&&nd.e.dataset.node, ndTab:nd&&nd.e.getAttribute('tabindex')};
});
out.push((land.qCad&&land.qRole==='button'?'✅':'❌')+' 块2 任务行可点/可聚焦（role=button + data-cad）: '+land.qCad);
if(land.qCad){ await p.evaluate((cad)=>document.querySelector('#dkQueueTrack .dq-row[data-cad="'+cad+'"]').click(), land.qCad); await p.waitForTimeout(900);
  out.push((await p.evaluate(()=>document.body.dataset.lastHighlight)===land.qCad?'✅':'❌')+' 点任务行 → 场景描边对应工位: '+await p.evaluate(()=>document.body.dataset.lastHighlight)); }
if(land.tiCad){ await p.evaluate((cad)=>document.querySelector('#dkItemsTrack .ti-row[data-cad="'+cad+'"]').click(), land.tiCad); await p.waitForTimeout(900);
  out.push((await p.evaluate(()=>document.body.dataset.lastHighlight)===land.tiCad?'✅':'❌')+' 点试验项行 → 描边其检测设备: '+await p.evaluate(()=>document.body.dataset.lastHighlight)); }
if(land.ndNode){ const f=p.frames().find(x=>/tour-space/.test(x.url()));
  await p.evaluate((id)=>document.querySelector('#dkNodesTrack .nd-row[data-node="'+id+'"]').click(), land.ndNode); await p.waitForTimeout(1400);
  const card=await f.evaluate(()=>{const a=document.getElementById('iot-audit');return a?JSON.parse(a.textContent):null;});
  out.push((card&&card.cardVisible&&card.selectedId===land.ndNode?'✅':'❌')+' 点节点行 → 场景选中该节点并出详情卡: '+JSON.stringify(card&&{s:card.selectedId,v:card.cardVisible})); }
await p.screenshot({path:'/tmp/twin-qa/dock-check.png', clip:{x:150,y:700,width:1500,height:380}});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
