import {ROOM_NAMES} from './iot/monitoring-data.js';
import {SCENARIOS} from './iot/demo-scenarios.js';
import {DashboardModel as M} from './shared/dashboard-model.js';
const $=id=>document.getElementById(id),ids=Object.keys(ROOM_NAMES),frame=$('lab-frame'),CHANNEL='room-tour-preview-v1';
const config=await (await fetch('data/iot-nodes.json')).json();
const equipmentNames=(await (await fetch('data/equipment-names.json')).json()).equipment;
let equipmentCatalog=[];
const escape=s=>window.LabIcons.escapeHTML(s),icon=type=>window.LabIcons.icon(type);
const typeNames={temperature:'温湿度',light:'光照',smoke:'烟雾',gas:'可燃气体',water:'水浸',motion:'人体',switch:'开关量',camera:'视觉'};
const shortNames={'101':'接待大厅','102':'智能样品','103':'智能力学','104':'控制室','105':'智能高压','106':'无人电缆','107':'材料试验','108':'环境试验','109':'综合试验','110':'数智电气'};
const state={room:'106',overviewRoom:'',pendingInspection:null,inspection:null,equipmentId:null,displayMode:'cruise',running:true,ready:false,initialized:false,pending:null,top:false,audit:null,mode:'normal',filter:'all',eventId:null,nextAt:Date.now()+5000,history:[],nextEventAt:Date.now()+3500,eventAnimating:false,eventCycles:0};
const reviewToken=new URLSearchParams(location.search).get('review-token'),reviewEmbedded=new URLSearchParams(location.search).get('review-embed')==='1';
const reviewSend=type=>{if(parent!==window&&reviewToken)parent.postMessage({channel:'safety-keeper-spatial-review-v1',token:reviewToken,type},location.origin);};
document.body.dataset.reviewEmbed=String(reviewEmbedded);
let disposed=false;
let global=M.createSnapshot('normal'),lastAudit='',lastRoom='';
function icons(){window.lucide.createIcons({attrs:{'stroke-width':1.7}});}
function send(type,data={}){frame.contentWindow?.postMessage({channel:CHANNEL,type,...data},location.origin);}
function nodeState(n){return state.audit?.nodes.find(q=>q.id===n.id)||{...n,status:'normal',values:{},updatedAt:new Date().toISOString()};}
function label(n,s){return s.status==='offline'?'离线':'在线';}
function nodeValues(n,s){
 if(s.status==='offline')return '<p class="node-phrase">节点离线</p>';
 const v=s.values;
 if(n.type==='temperature')return `<div class="node-values"><div><small>温度</small><strong>${v.temperature??'—'}<em>°C</em></strong></div><div><small>相对湿度</small><strong>${v.humidity??'—'}<em>%RH</em></strong></div></div>`;
 if(n.type==='light')return `<div class="node-values"><div><small>光照强度</small><strong>${v.illuminance??'—'}<em>Lux</em></strong></div></div>`;
 if(n.type==='switch')return `<div class="io-values">${['IN1','IN2','OUT1','OUT2'].map(c=>`<span>${c.replace(/(\D+)(\d)/,'$1-$2')}<b>${typeof v.channels?.[c]==='boolean'?(v.channels[c]?'开':'关'):'—'}</b></span>`).join('')}</div>`;
 if(n.type==='camera'&&state.displayMode==='overview')return '<p class="node-phrase camera-available">查看监控画面</p>';
 if(n.type==='camera')return `<div class="node-camera"><img data-camera="${n.roomId}" src="assets/camera-${n.roomId}.jpg" alt="${escape(n.name)} · ${escape(ROOM_NAMES[n.roomId])}"><span class="camera-caption"><i class="camera-dot"></i>三维巡航</span></div>`;
 const text={gas:v.exceeded?'检测到可燃气体':'未检测到可燃气体',smoke:v.detected?'检测到烟雾':'未检测到烟雾',water:v.detected?'检测到积水':'未检测到积水',motion:v.activity?'检测到人员活动':'未检测到人员活动'}[n.type];
 return `<p class="node-phrase">${text}</p>`;
}
function roomList(){const order=['camera',...Object.keys(typeNames).filter(t=>t!=='camera')];return (state.displayMode==='overview'&&!state.overviewRoom?[...config.nodes]:config.nodes.filter(n=>n.roomId===(state.displayMode==='overview'?state.overviewRoom:state.room))).sort((a,b)=>(state.displayMode==='overview'&&!state.overviewRoom?a.roomId.localeCompare(b.roomId):0)||order.indexOf(a.type)-order.indexOf(b.type));}
function renderLeft(){
 const nodes=roomList(),all=state.displayMode==='overview'&&!state.overviewRoom,room=state.displayMode==='overview'?state.overviewRoom:state.room;
 document.body.dataset.displayMode=state.displayMode;
 $('room-picker').value=room;$('room-picker').disabled=false;
 $('active-room-code').textContent=all?'ALL ROOMS':`ROOM ${room}`;
 $('left-room-name').textContent=all?'全区节点总览':`${room} ${ROOM_NAMES[room]}`;
 $('left-room-summary').textContent=all?'16 个节点 · 10 个房间':state.displayMode==='overview'?`${nodes.length} 个节点`:ROOM_NAMES[room];
 $('room-nodes').innerHTML=nodes.map((n,index)=>{const s=nodeState(n),heading=all&&(index===0||nodes[index-1].roomId!==n.roomId)?`<h3 class="node-room-heading">${n.roomId} ${escape(ROOM_NAMES[n.roomId])}</h3>`:'';return `${heading}`+ `<button class="node-card ${n.type==='camera'?'camera-card':''}${state.audit?.selectedId===n.id?' selected':''}" data-node="${n.id}" data-status="${s.status}"><div class="node-card-head"><span class="node-symbol">${icon(n.type)}</span><h4>${escape(n.name)}</h4><span class="node-status">${label(n,s)}</span></div>${nodeValues(n,s)}<span class="node-meta">${n.id}</span></button>`;}).join('')||'<div class="empty-room"><i data-lucide="map-pin"></i><div>本房间暂无规划节点</div></div>';
 const updated=nodes.length?nodeState(nodes[0]).updatedAt:null;$('node-updated').textContent=updated?M.clockText(Date.parse(updated)):'—';icons();
}
function renderRoom(){renderPlayer();renderLeft();renderInspection();audit();}
function renderPlayer(){
 $('tour-toggle').hidden=state.displayMode==='overview';
 document.querySelectorAll('[data-display-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.displayMode===state.displayMode)));

 $('tour-toggle').innerHTML=`<i data-lucide="${state.running?'pause':'play'}"></i><span>${state.running?'暂停':'继续'}</span>`;
 $('tour-toggle').setAttribute('aria-label',state.running?'暂停自动讲解':'继续自动讲解');send('playback',{playing:state.running&&!state.audit?.detailVisible&&!state.audit?.visionOpen&&!$('event-dialog').open&&!$('equipment-dialog').open});icons();
}
function switchRoom(room,manual=true){

 state.room=room;state.pending=room;state.top=false;state.nextAt=Date.now()+5000;
 state.pendingAt=Date.now();state.history.push({roomId:room,at:state.pendingAt,manual});if(state.history.length>50)state.history.shift();send('focus-room',{roomId:room});renderRoom();
}
function setDisplayMode(mode){
 if(!['cruise','overview'].includes(mode)||state.displayMode===mode)return;
 state.displayMode=mode;state.running=mode==='cruise';state.pending=null;state.pendingInspection=mode==='overview'?'':null;state.overviewRoom='';state.nextAt=Date.now()+5000;
 send('display-mode',{mode,roomId:state.room});renderRoom();
}
document.querySelector('.display-mode-switch').addEventListener('click',event=>{const b=event.target.closest('[data-display-mode]');if(b)setDisplayMode(b.dataset.displayMode);});
function inspectRoom(room){
 state.overviewRoom=room;state.pendingInspection=room;if(room)state.room=room;
 send('inspect-room',{roomId:room});renderRoom();
}
function renderInspection(){
 const shown=state.displayMode==='overview';$('inspection-tools').hidden=!shown;
 $('return-overview').hidden=!state.overviewRoom;
 const options=state.inspection?.options||[{value:'overall-101',label:'107方向斜俯视'},{value:'top',label:'正俯视'}];
 const select=$('inspection-view'),signature=JSON.stringify(options);
 if(select.dataset.options!==signature){select.replaceChildren(...options.map(o=>{const option=document.createElement('option');option.value=o.value;option.textContent=o.label;return option;}));select.dataset.options=signature;}
 if(options.some(o=>o.value===state.inspection?.view))select.value=state.inspection.view;
}
function showEquipment(id){
 if(state.displayMode!=='overview')return;
 const item=equipmentNames.find(e=>e.cadId===id);if(!item)return;
 state.equipmentId=id;
 $('equipment-room').textContent=`${item.roomId} ${ROOM_NAMES[item.roomId]}`;
 $('equipment-title').textContent=item.nameConfirmed?item.displayName:item.cadId;
 const cad=equipmentCatalog.find(e=>e.id===id);
 $('equipment-detail').innerHTML=`<dl><dt>设备编号</dt><dd>${id}</dd><dt>所属房间</dt><dd>${item.roomId} ${escape(ROOM_NAMES[item.roomId])}</dd>${cad?`<dt>CAD 占地尺寸</dt><dd>${cad.footprint.map(v=>v.toFixed(2)).join(' × ')} m</dd>`:''}</dl>`;
 send('equipment-select',{id});if(!$('equipment-dialog').open)$('equipment-dialog').showModal();renderRoom();
}
$('inspection-view').onchange=()=>send('inspect-view',{view:$('inspection-view').value});
$('return-overview').onclick=()=>inspectRoom('');
$('close-equipment').onclick=()=>$('equipment-dialog').close();
$('equipment-dialog').addEventListener('close',()=>{state.equipmentId=null;send('equipment-clear');renderPlayer();audit();});
function renderRight(){
 const events=M.eventsInRange(global.events,'today',global.now);
 $('event-count').textContent=`${events.length} 条`;
 state.eventAnimating=false;state.nextEventAt=Date.now()+3500;
 $('global-events').innerHTML='<div id="event-track">'+events.map(e=>{
 const kind=e.type==='设备离线'?'offline':e.type==='告警恢复'?'restored':e.type==='安全告警'?'alarm':'record';
 const tag={offline:'设备离线',restored:'已恢复',alarm:'安全告警',record:'状态记录'}[kind];
 const title=e.type==='告警恢复'?`${e.nodeName.replace(/\d+$/,'')}告警已恢复`:e.type==='设备离线'?`${e.nodeName.replace(/\d+$/,'')}节点离线`:e.type==='安全告警'?e.content.split('，')[0]:e.type==='人体感知事件'?'检测到人员活动':e.type==='开关量状态变化'?'开关量状态变化':'节点数据更新';
 return `<button class="event-card" data-event="${e.id}" data-kind="${kind}"><i class="event-dot"></i><div class="event-top"><span>${escape(e.area)} · ${escape(e.nodeName)}</span><time>今天 ${M.clockText(e.at)}</time></div><h4>${escape(title)}</h4><p class="event-desc">${escape(e.content)}</p><span class="event-state">${tag}</span></button>`;
 }).join('')+'</div>';icons();audit();
}
function rotateEvents(){
 const track=$('event-track');if(!track||track.children.length<2||state.eventAnimating)return;
 state.eventAnimating=true;const first=track.firstElementChild,distance=first.getBoundingClientRect().height+parseFloat(getComputedStyle(first).marginBottom);
 track.style.transition='transform 520ms cubic-bezier(.22,.7,.2,1)';track.style.transform=`translateY(-${distance}px)`;
 let done=false;
 const finish=()=>{if(done||track!==$('event-track'))return;done=true;track.style.transition='none';track.append(first);track.style.transform='translateY(0)';state.eventAnimating=false;state.eventCycles++;audit();};
 track.addEventListener('transitionend',event=>{if(event.target===track)finish();},{once:true});setTimeout(finish,650);
}
function setScenario(mode){
 state.mode=mode;state.nextAt=Date.now()+5000;
 global=M.createSnapshot(mode==='water'?'alarm':mode==='offline'?'offline':'normal');
 if(mode==='gas'){
  const scenario=SCENARIOS.find(s=>s.id==='gas'),node=global.nodes.find(n=>n.id===scenario.nodeId);
  Object.assign(node,{status:scenario.status,alarm:true,values:structuredClone(scenario.values),reading:structuredClone(scenario.values)});
  global.events.unshift({id:'current-gas',at:global.now,nodeId:node.id,nodeName:node.name,area:node.area,type:'安全告警',content:'检测到可燃气体',status:'正在告警',kind:'bad'});
 }

 frame.contentWindow.postMessage({channel:'safety-keeper-spatial-review-v1',token:'room-tour-preview',type:'set-state',mode},location.origin);renderRight();renderPlayer();
}
window.addEventListener('message',event=>{
 if(disposed||event.origin!==location.origin)return;
 if(event.source===parent&&event.data?.channel==='safety-keeper-spatial-review-v1'&&event.data.token===reviewToken){
  if(event.data.type==='hello'&&state.ready)reviewSend('ready');
  if(event.data.type==='preview-size'){fallbackFullscreen=!!event.data.expanded;syncFullscreenButton();}
  if(event.data.type==='set-state'&&['normal','gas','water','offline'].includes(event.data.mode))setScenario(event.data.mode);

  return;
 }
 if(event.source===frame.contentWindow&&event.data?.channel==='safety-keeper-spatial-review-v1'&&event.data.token==='room-tour-preview'){
  if(['close-expanded','expand-preview'].includes(event.data.type))reviewSend(event.data.type);
  if(event.data.type==='error')reviewSend('error');return;
 }
 if(event.source!==frame.contentWindow||event.data?.channel!==CHANNEL)return;
 if(event.data.type==='equipment-catalog'){equipmentCatalog=event.data.equipment;return;}
 if(event.data.type==='equipment-select'){showEquipment(event.data.id);return;}
 if(event.data.type==='camera-frame'){const image=document.querySelector(`[data-camera="${event.data.roomId}"]`);if(image&&state.displayMode==='cruise'&&event.data.roomId===state.room){image.src=event.data.image;image.dataset.frame=event.data.sequence;}return;}
 if(event.data.type!=='snapshot')return;
 const d=event.data;state.audit=d.audit;if(!state.ready){state.ready=true;reviewSend('ready');}
 if(!state.initialized){state.initialized=true;switchRoom('106',false);send('display-mode',{mode:state.displayMode,roomId:state.room});send('request-catalog');return;}
 if(state.displayMode==='overview'&&d.inspection){
  if(state.pendingInspection!==null&&d.inspection.room!==state.pendingInspection)return;
  state.pendingInspection=null;state.overviewRoom=d.inspection.room;state.inspection=d.inspection;
 }
 if(state.pending!==null&&d.roomId!==state.pending)return;
 state.pending=null;state.room=state.displayMode==='overview'&&state.overviewRoom?state.overviewRoom:d.roomId;
 const key=JSON.stringify([d.roomId,d.inspection,d.audit.selectedId,d.audit.detailVisible,d.audit.visionOpen,d.audit.scene,d.audit.nodes]);
 if(key!==lastAudit){lastAudit=key;renderRoom();}
});
$('room-picker').innerHTML='<option value="">101—110 全实验室</option>'+ids.map(room=>`<option value="${room}">${room} ${ROOM_NAMES[room]}</option>`).join('');
$('room-picker').onchange=()=>{const room=$('room-picker').value;if(state.displayMode==='overview')inspectRoom(room);else if(room)switchRoom(room);else setDisplayMode('overview');};
$('tour-toggle').onclick=()=>{state.running=!state.running;state.nextAt=Date.now()+5000;renderPlayer();audit();};
$('room-nodes').addEventListener('click',event=>{const b=event.target.closest('[data-node]');if(b){send('open-node',{id:b.dataset.node});renderPlayer();}});
$('global-events').addEventListener('click',event=>{const b=event.target.closest('[data-event]');if(!b)return;state.eventId=b.dataset.event;const e=global.events.find(x=>x.id===state.eventId);$('event-detail').innerHTML=`<p>${escape(e.content)}</p><dl><dt>事件类型</dt><dd>${escape(e.type)} · ${escape(e.status)}</dd><dt>所属区域</dt><dd>${escape(e.area)}</dd><dt>关联节点</dt><dd>${escape(e.nodeName)} · ${e.nodeId}</dd><dt>事件时间</dt><dd>${M.timestamp(e.at)}</dd></dl>`;$('event-dialog').showModal();renderPlayer();});
$('close-event').onclick=()=>$('event-dialog').close();$('event-dialog').addEventListener('close',()=>{state.nextAt=Date.now()+5000;renderPlayer();});
$('locate-event').onclick=()=>{const e=global.events.find(e=>e.id===state.eventId),n=config.nodes.find(n=>n.id===e.nodeId);$('event-dialog').close();if(state.displayMode==='overview')setDisplayMode('cruise');switchRoom(n.roomId);};
function audit(){if(!$('tour-audit'))return;$('tour-audit').textContent=JSON.stringify({roomId:state.room,overviewRoom:state.overviewRoom,equipmentId:state.equipmentId,equipmentCount:equipmentNames.filter(e=>e.roomId===state.overviewRoom).length,inspection:state.inspection,displayMode:state.displayMode,running:state.running,mode:state.mode,roomNodeIds:roomList().map(n=>n.id),globalEventIds:global.events.map(e=>e.id),nodeCount:config.nodes.length,currentAlarms:M.metrics(global.nodes).alarms.length,frameReady:state.ready,intervalMs:5000,eventIntervalMs:3500,eventCycles:state.eventCycles,eventOrder:[...document.querySelectorAll('#event-track [data-event]')].map(e=>e.dataset.event),history:state.history});}
function tick(){
 const now=Date.now();$('clock').textContent=new Date(now).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 if(state.pending!==null&&now-state.pendingAt>2500){send('focus-room',{roomId:state.pending});state.pendingAt=now;}
 const blocked=document.hidden||state.audit?.detailVisible||state.audit?.visionOpen||$('event-dialog').open;
 if(blocked)state.nextAt=now+5000;
 if(!document.hidden&&!$('event-dialog').open&&now>=state.nextEventAt&&!state.eventAnimating){state.nextEventAt=now+3500;rotateEvents();}
 if(state.displayMode==='cruise'&&state.running&&!blocked&&state.ready&&now>=state.nextAt){const next=ids[(Math.max(0,ids.indexOf(state.room))+1)%ids.length];switchRoom(next,false);}
}
renderRoom();renderRight();tick();const tickTimer=setInterval(tick,250);
window.__FUTURE_LAB_REVIEW__={dispose(){if(disposed)return;disposed=true;clearInterval(tickTimer);try{frame.contentWindow?.__FUTURE_LAB_REVIEW__?.dispose();}catch{}frame.src='about:blank';}};
window.addEventListener('pagehide',()=>window.__FUTURE_LAB_REVIEW__.dispose(),{once:true});



// Fullscreen changes presentation only; room, node state and camera remain intact.
let fallbackFullscreen=false;
function fullscreenElement(){return document.fullscreenElement||document.webkitFullscreenElement;}
function syncFullscreenButton(){
 const active=!!fullscreenElement()||fallbackFullscreen,button=$('fullscreen-toggle');
 button.setAttribute('aria-pressed',String(active));
 button.setAttribute('aria-label',active?'退出全屏':'全屏显示');
 button.title=active?'退出全屏':'全屏显示';
 button.innerHTML='<i data-lucide="'+(active?'minimize':'maximize')+'"></i><span>'+(active?'退出全屏':'全屏')+'</span>';icons();
}
$('fullscreen-toggle').onclick=async()=>{
 try{
  if(fallbackFullscreen){
   if(typeof reviewSend==='function')reviewSend('close-expanded');
   fallbackFullscreen=false;document.body.classList.remove('presentation-fullscreen');
  }else if(fullscreenElement()){
   const exit=document.exitFullscreen||document.webkitExitFullscreen;
   if(exit)await exit.call(document);
  }else{
   const enter=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
   if(enter)await enter.call(document.documentElement);
   else if(typeof reviewSend==='function'&&reviewEmbedded)reviewSend('expand-preview');
   else{fallbackFullscreen=true;document.body.classList.add('presentation-fullscreen');}
  }
 }catch{if(typeof reviewSend==='function'&&reviewEmbedded)reviewSend('expand-preview');else $('fullscreen-toggle').title='请允许浏览器全屏后重试';}
 syncFullscreenButton();
};
document.addEventListener('fullscreenchange',syncFullscreenButton);
document.addEventListener('webkitfullscreenchange',syncFullscreenButton);

document.addEventListener('keydown',event=>{if(event.key==='Escape'&&fallbackFullscreen){fallbackFullscreen=false;document.body.classList.remove('presentation-fullscreen');if(typeof reviewSend==='function')reviewSend('close-expanded');syncFullscreenButton();}});
