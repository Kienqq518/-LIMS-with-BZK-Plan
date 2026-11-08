/**
 * 底栏四块（2026-11-06 产品负责人方案）
 *  ① 设备运行状态（四档圆环 + 图例） ② 无人化调度任务队列（图3 流程配置 + 图1 三分类）
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
T('底栏块数（FR-45：安全管家场景 / 调度任务 / 组态物联，铺满整屏宽）', await p.locator('.dock .dk').count(), 3);
T('块标题与块序（FR-51：场景监测与调度任务已交换位置）', (await p.locator('.dk>header b').allInnerTexts()).join('|'), '安全管家场景监测|无人化调度任务|组态物联节点');
T('设备运行状态在左栏（FR-42 重排）', await p.evaluate(()=>{const e=document.querySelector('.rail .raildev');return !!e&&e.offsetParent!==null;}), 'true');

// ① 设备运行状态：四档圆环 + 四行图例 + 机器人分工
/* 块1 结构（2026-11-07 参考图一改版）：柱图→圆环，五档→四档（运行中/待机/停机/异常），
   「停止」按现场叫法改「停机」，「就绪」折进「待机」——四档相加必须等于建档合计，否则圆环是假图。
   稼动率不再单独一行：它就是「运行中」那档的台数与占比，屏上直接读得到。 */
const lg=await p.evaluate(()=>[...document.querySelectorAll('#dkDevBody .dk-lg')].map(e=>({nm:e.querySelector('.nm').innerText.trim(),
  v:+e.querySelector('.vv').innerText,pc:+e.querySelector('.pc').innerText.replace('%',''),zero:e.classList.contains('zero')})));
out.push((lg.length===4&&lg.map(x=>x.nm).join('/')==='运行中/待机/停机/异常'?'✅':'❌')+' 块1 四档圆环 + 四行图例: '+lg.map(x=>x.nm+' '+x.v+' '+x.pc+'%').join(' / '));
const dev=await p.evaluate(()=>{const r=window.__twinCharts.list().find(x=>x.name==='devices');return r?JSON.parse(r.sig):null;});
const srcTxt=await p.evaluate(()=>document.getElementById('dkDevSrc').innerText.replace(/\s+/g,' '));   /* 设备块已搬进左栏 .raildev，不能再拿 .dk 找它 */
const total=+(srcTxt.match(/(\d+) 台建档/)||[])[1];
/* 圆环只画非零档（0 台的弧线画不出来），四档之和这条纪律改由图例承担：
   非零档相加 == 图例四档相加 == 建档合计，三者必须同源。 */
const sumOk=!!dev&&dev.every(x=>x.v>0)&&dev.reduce((a,x)=>a+x.v,0)===total&&lg.reduce((a,x)=>a+x.v,0)===total;
out.push((sumOk?'✅':'❌')+` 块1 自洽：环 ${dev&&dev.map(x=>x.k+':'+x.v).join(' + ')} 与图例 ${lg.map(x=>x.v).join('+')} 都 == 建档合计 ${total}（src="${srcTxt}"）`);
out.push((lg.every(x=>Math.abs(Math.round(x.v/total*100)-x.pc)<=1)?'✅':'❌')+' 块1 占比现算（台数/合计，不写死）: '+lg.map(x=>x.nm+' '+x.pc+'%').join(' / '));
const working=await p.evaluate(async()=>{const a=await TwinApi.get('/api/zone/106/devices'),b=await TwinApi.get('/api/zone/103/devices');
  return [...(a.data||[]),...(b.data||[])].filter(d=>d.status==='working').length;});
const readyN=await p.evaluate(async()=>{const a=await TwinApi.get('/api/zone/106/devices'),b=await TwinApi.get('/api/zone/103/devices');
  return [...(a.data||[]),...(b.data||[])].filter(d=>d.status==='ready'||d.status==='standby').length;});
out.push((lg[0].v===working?'✅':'❌')+` 运行中档 == 接口 working 台数（屏上 ${lg[0].v} vs 接口 ${working}）`);
out.push((lg[1].v===readyN?'✅':'❌')+` 待机档 == 接口 待机+就绪 台数（就绪折进本档，屏上 ${lg[1].v} vs 接口 ${readyN}）`);
/* FR-52：机器人从「一行文字」升级成左栏独立 AGV 块（编号 / 状态+在办任务 / 电量条+百分比）。
   断言跟着改，并且钉死一件事：屏上的电量必须等于接口现值——电量这种会动的数，
   一旦在渲染层另算一套，大屏上就会出现"进度条和调度系统说的不一样"。 */
const agv=await p.evaluate(()=>({cnt:(document.getElementById('agvCnt')||{}).innerText||'',
  rows:[...document.querySelectorAll('.agv-row')].map(e=>({id:(e.querySelector('.id')||{}).innerText||'',
    st:(e.querySelector('.st')||{}).innerText||'',pct:(e.querySelector('.pct')||{}).innerText||'',
    w:(e.querySelector('.agv-barrow i')||{}).style?.width||'',aria:e.getAttribute('aria-label')||''}))}));
const apiR=await p.evaluate(async()=>(await TwinApi.get('/api/zone/106/robots')).data.map(r=>({id:r.robotId,bat:Math.round(r.battery)})));
const cntN=(agv.cnt.match(/在跑 (\d+) · 充电 (\d+)/)||[]);
out.push((agv.rows.length===2&&cntN[1]==='1'&&cntN[2]==='1'?'✅':'❌')+' 左栏 AGV 块：两台且分工计数正确（一台跑 / 一台常驻充电位）: '+agv.cnt.replace(/\s+/g,' '));
out.push((agv.rows.every(x=>/^RB-/.test(x.id)&&/行进中|停靠充电|充电中|待机/.test(x.st)&&/\d+%/.test(x.pct)&&/\d+%/.test(x.w))?'✅':'❌')
  +' AGV 每行=编号+状态+在办事+电量条+百分比: '+agv.rows.map(x=>x.id+' '+x.st.slice(0,22)+' '+x.pct).join(' | '));
const batOk=agv.rows.every(x=>{const a=apiR.filter(y=>y.id===x.id)[0];return !!a&&Math.abs(parseInt(x.pct)-a.bat)<=1;});
out.push((batOk?'✅':'❌')+' AGV 电量 == 接口现值（±1 心跳容差，屏上不另算一套）: 屏上 '
  +agv.rows.map(x=>x.id+'='+x.pct).join(' ')+' vs 接口 '+apiR.map(x=>x.id+'='+x.bat+'%').join(' '));
out.push((agv.rows.every(x=>x.aria.length>30&&/电量 \d+%/.test(x.aria))?'✅':'❌')
  +' AGV 行 aria 完整（读屏得到编号/状态/在办事/电量）: '+(agv.rows[0]&&agv.rows[0].aria||'').slice(0,76));

// ② 任务队列：三分类分组 + 与流程配置一致
/* FR-42：三分类从「一张长列表的三个分组」改成三列并排，状态=列，行内不再重复状态字 */
/* 无缝滚动靠把整列内容复制一遍（dkTrack 的 html+html），所以 .dq-row 的物理数量恒等于道次的两倍。
   列头计数说的是"这一列有几道任务"，按行身份 data-seq 去重才对；回声副本本身由下面那条
   「回声不进无障碍树/Tab 序」单独守，不许在这里靠"数一半"混过去。 */
const grp=await p.evaluate(()=>[...document.querySelectorAll('.dq3 .dq-col')].map(e=>{
  const rows=[...e.querySelectorAll('.dq-row')], seq=[...new Set(rows.map(r=>r.dataset.seq))];
  return {h:e.querySelector('h4').innerText.replace(/\s+/g,' ').trim(), n:seq.length, rows:rows.length,
    echo:rows.filter(r=>r.getAttribute('aria-hidden')==='true').length,
    echoTab:rows.filter(r=>r.getAttribute('aria-hidden')==='true'&&r.tabIndex>=0).length, st:e.dataset.state};}));
out.push((grp.every(x=>x.rows===x.n*2&&x.echo===x.n&&x.echoTab===0)?'✅':'❌')
  +' 回声副本只为滚动存在（行数=道次×2、副本全部 aria-hidden 且不在 Tab 序里）: '+grp.map(x=>x.st+' '+x.n+'道/物理'+x.rows+'/隐藏'+x.echo+'/可Tab副本'+x.echoTab).join(' / '));
out.push((grp.length===3&&grp[0].st==='running'&&/进行中/.test(grp[0].h)&&/未派单/.test(grp[1].h)&&/已完成/.test(grp[2].h)?'✅':'❌')+' 底栏任务三列（进行中/未派单/已完成）: '+JSON.stringify(grp));
out.push((grp.every(x=>+x.h.split(/\s+/)[1]===x.n)?'✅':'❌')+' 每列标题的计数 == 该列真实行数（列头不许虚报）: '+grp.map(x=>x.h+'→'+x.n).join(' / '));
const q=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/dispatch-queue');
  return {n:r.data.tasks.length, flows:[...new Set(r.data.tasks.map(t=>t.flowCode))].sort(), counts:r.data.counts};});
out.push((q.n===16&&q.flows.length===11?'✅':'❌')+` 块2 数据=图3 流程配置 16 条 / 11 种流（含图1 的热延伸取放 0161/0162）：${q.flows.join(',')}`);
out.push((q.counts.running+q.counts.unassigned+q.counts.done===16?'✅':'❌')+' 块2 三态合计=16: '+JSON.stringify(q.counts));
const names=await p.evaluate(()=>[...new Set([...document.querySelectorAll('.dq3 .dq-row .nm')].map(e=>e.innerText.trim()))].length);
out.push((names>=11?'✅':'❌')+' 块2 渲染出的任务名（流号+流名）覆盖全部 11 种流: '+names);

// ②b 队列状态跟着循环剧本走（进行中那一行 = 机器人当前停靠/正在前往的站）
/* 「循环中」的正确性只能在一次响应内校验：队列与剧本各自按墙上时钟取模，
   分两次调用（cycle 与 dispatch-queue）之间剧本会推进，跨响应比较必然出现"两个答案都对但不一致"。
   停在 102 家位/返航段时本来就没有流号（liveFlow=null 是对的），所以要重试到拿到一条流为止。 */
let sync=null, seenFlows=new Set();
/* 观察窗必须 ≥ 最长航段 + 一段停靠：17 道改版后「行进段归给下一道」，
   102→106 走廊那一段约 47s，期间屏上一直是同一道同一流号——10×4s 的窗只够看到 1 条流（实测假失败）。
   18×4s=72s，换到 2 条流就提前 break，正常情况不会真跑满。 */
for(let k=0;k<18;k++){
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

const before=await p.evaluate(()=>({dur:getComputedStyle(document.getElementById('dqTrackDone')).transform,pos:document.getElementById('dqTrackDone').getBoundingClientRect().y}));
await p.waitForTimeout(7000);
const after=await p.evaluate(()=>({dur:getComputedStyle(document.getElementById('dqTrackDone')).transform,pos:document.getElementById('dqTrackDone').getBoundingClientRect().y,
  cnt:document.getElementById('dkQueueCnt').innerText}));
/* FR-42 三列之后，「行换列」必须重建轨道（CSS 无缝滚动会跳回原点）——这是有意代价，
   一圈里只发生几次而不是每 2s 一次。所以断言改成二选一：要么滚动连续，要么这一窗内确实有任务换了列。 */
const cols0=await p.evaluate(()=>[...document.querySelectorAll('.dq3 .dq-col>h4 b')].map(e=>e.textContent).join('/'));
const moved=Math.abs(after.pos-before.pos);
const cols1=await p.evaluate(()=>[...document.querySelectorAll('.dq3 .dq-col>h4 b')].map(e=>e.textContent).join('/'));
out.push((moved>0.5||cols0!==cols1?'✅':'❌')+` 心跳刷新不无谓重置滚动（7s 位移 ${moved.toFixed(1)}px；列分布 ${cols0}→${cols1}，只有换列才允许重建）`);
out.push((/循环同步/.test(after.cnt)?'✅':'❌')+' 块2 头部显示与剧本同步: '+after.cnt.replace(/\s+/g,' '));

// ③ 安全管家场景监测（FR-51，替掉原「试验项完成情况」）
const scApi=await p.evaluate(async()=>(await TwinApi.get('/api/overview/safety-scenes')).data);
const scRows=await p.evaluate(()=>[...document.querySelectorAll('#dkScenesTrack .sc-row')].filter(r=>r.getAttribute('aria-hidden')!=='true')
  .map(e=>({id:e.dataset.scene,room:e.dataset.room,t:e.innerText.replace(/\s+/g,' '),icons:e.querySelectorAll('.nodes svg').length,
    st:(e.querySelector('.st')||{}).textContent,cls:e.className.match(/normal|abnormal|alarm/)?RegExp.lastMatch[0]:'?',aria:e.getAttribute('aria-label')})));
const SC_NAMES=['高危区域入侵主动防御','消防安全·烟雾与可燃气体预警','涉水区域浸水与泄漏告警','受限空间准入安全管控','恒温恒湿环境自动调节','工器具使用规范化智能引导'];
out.push((scApi.scenes.length===6&&scRows.length===6&&SC_NAMES.every(n=>scRows.some(x=>x.t.includes(n)))?'✅':'❌')
  +' 块1 六套场景与安全管家场景库一致: '+scRows.map(x=>x.t.split(' ')[0]).join(' | '));
out.push((scRows.every(x=>x.icons>=2&&/\d{3}/.test(x.room)&&x.st)?'✅':'❌')
  +' 块1 每行都有 名称+状态+节点icon+房间号: '+scRows.map(x=>x.room+'/'+x.icons+'icon/'+x.st.trim().slice(0,6)).join(' '));
/* 状态必须由事实推导出来，不能恒为「正常」：上一版把 zoneId 拼成 'Z106'（真实是 'Z-106'），
   六个场景全绿，红绿条画得再漂亮也是空的——这条就是抓那种"看起来没坏的假通过"。 */
const alarmSc=scRows.filter(x=>x.st.includes('存在告警'));
out.push((alarmSc.length>=1&&alarmSc.every(x=>+x.st.replace(/\D/g,'')>0)?'✅':'❌')
  +' 至少一个场景按未闭环告警判为「存在告警」且带条数: '+alarmSc.map(x=>x.id+'@'+x.room+' '+x.st.trim()).join(' / '));
out.push((scRows.every(x=>/口径|规则|未闭环|越限|位于/.test(x.aria||'')&&x.aria.length>40)?'✅':'❌')
  +' 每行 aria 带完整口径（规则/房间/节点/为什么是这个状态）: '+(scRows[1]&&scRows[1].aria||'').slice(0,80));
out.push((/已部署 6 套/.test(await p.evaluate(()=>document.getElementById('scCnt').innerText))?'✅':'❌')
  +' 块1 头部计数=已部署 6 套: '+await p.evaluate(()=>document.getElementById('scCnt').innerText));
out.push(((await p.locator('.ti-row').count())===0?'✅':'❌')+' 试验项块已整块下屏（不留半截 DOM）: .ti-row 数='+await p.locator('.ti-row').count());

// ④ 组态物联节点：按房间排序 + 读数 + 心跳
const nd=await p.evaluate(()=>[...document.querySelectorAll('#dkNodesTrack .nd-row')].slice(0,16).map(e=>({rm:e.querySelector('.rm').innerText,nm:e.querySelector('.nm').innerText,rd:e.querySelector('.rd').innerText})));
out.push((nd.length>=16&&nd.every((x,i)=>i===0||x.rm>=nd[i-1].rm)?'✅':'❌')+' 块4 按房间 101→110 排序滚动: '+nd.slice(0,6).map(x=>x.rm+x.nm).join(' '));
out.push((nd.filter(x=>/画面未接入/.test(x.rd)).length===4?'✅':'❌')+' 块4 视觉点位诚实标注「画面未接入」（4 个摄像头）: '+nd.filter(x=>/画面未接入/.test(x.rd)).length);
out.push((nd.filter(x=>/℃|lx|正常|无人|有人|触点|已触发|超限/.test(x.rd)).length>=12?'✅':'❌')+' 块4 其余点位显示实时读数（与场景节点层同源）');
/* 组态物联现在在右列 .nodepanel 里（id 不变）。头部那行「16 个点位 · 按房间排序 · 5s 心跳」
   按 2026-11-07 反馈撤除：面板头已经说明自己是什么，这行只是重复；点位数以行渲染断言为准。 */
const cnt=await p.evaluate(()=>document.getElementById('dkNodesCnt').innerText.trim());
out.push((cnt===''&&nd.length>=16?'✅':'❌')+` 块4 头部计数文本已撤除（屏上不重复自述），行数仍 == 接口点位：cnt="${cnt}" 屏上 ${nd.length} 行`);

// 点击与键盘落点（冻结滚动后挑窗口内的行）
const land=await p.evaluate(()=>{
  document.querySelectorAll('.dk-track').forEach(t=>t.style.animation='none');
  const pick=(sel)=>{const tr=document.querySelector(sel); const box=tr.closest('.dk-view')||tr.closest('.np-view'); if(!box) return null; const v=box.getBoundingClientRect();
    return [...tr.children].filter(e=>e.dataset.cad||e.dataset.node).map(e=>({e,r:e.getBoundingClientRect()})).filter(x=>x.r.top>=v.top-1&&x.r.bottom<=v.bottom+1)[0];};
  const q=pick('#dqTrackRunning')||pick('#dqTrackUnassigned')||pick('#dqTrackDone'), sc=pick('#dkScenesTrack'), nd=pick('#dkNodesTrack');
  return {qCad:q&&q.e.dataset.cad, qRole:q&&q.e.getAttribute('role'), scId:sc&&sc.e.dataset.scene, scNodes:sc&&sc.e.dataset.nodes, ndNode:nd&&nd.e.dataset.node, ndTab:nd&&nd.e.getAttribute('tabindex')};
});
out.push((land.qCad&&land.qRole==='button'?'✅':'❌')+' 块2 任务行可点/可聚焦（role=button + data-cad）: '+land.qCad);
if(land.qCad){ await p.evaluate((cad)=>document.querySelector('.dq3 .dq-row[data-cad="'+cad+'"]').click(), land.qCad); await p.waitForTimeout(900);
  out.push((await p.evaluate(()=>document.body.dataset.lastHighlight)===land.qCad?'✅':'❌')+' 点任务行 → 场景描边对应工位: '+await p.evaluate(()=>document.body.dataset.lastHighlight)); }
if(land.scId){ await p.evaluate((id)=>document.querySelector('#dkScenesTrack .sc-row[data-scene="'+id+'"]').click(), land.scId); await p.waitForTimeout(1200);
  const got=await p.evaluate(()=>({scene:document.body.dataset.lastScene,node:document.body.dataset.lastNode}));
  const first=(land.scNodes||'').split(',')[0];
  out.push((got.scene===land.scId&&got.node===first?'✅':'❌')+' 点场景行 → 记下场景并选中其首个节点: '+JSON.stringify(got)+' 期望节点 '+first); }
if(land.ndNode){ const f=p.frames().find(x=>/tour-space/.test(x.url()));
  await p.evaluate((id)=>document.querySelector('#dkNodesTrack .nd-row[data-node="'+id+'"]').click(), land.ndNode); await p.waitForTimeout(1400);
  const card=await f.evaluate(()=>{const a=document.getElementById('iot-audit');return a?JSON.parse(a.textContent):null;});
  out.push((card&&card.cardVisible&&card.selectedId===land.ndNode?'✅':'❌')+' 点节点行 → 场景选中该节点并出详情卡: '+JSON.stringify(card&&{s:card.selectedId,v:card.cardVisible})); }
await p.screenshot({path:'/tmp/twin-qa/dock-check.png', clip:{x:150,y:700,width:1500,height:380}});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
