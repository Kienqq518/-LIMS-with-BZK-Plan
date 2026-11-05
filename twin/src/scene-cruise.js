import {SCENES,ROOM_NAMES,NODE_TYPES} from '../mock/scene-data.js';
import {DEMO_RULES} from '../mock/scene-data.js';
import {buildSceneEvents,eventRecordView} from './scene-events.js';
import {normalizeSnapshot,validSnapshot,statusText,riskAlarm,describeScene,roomSummary,liveRiskNode} from './scene-monitoring.js';

const $=id=>document.getElementById(id);
const CHANNEL='room-tour-preview-v1';
const FRAME=$('model-frame');
const icon=()=>window.lucide?.createIcons({attrs:{'stroke-width':1.85}});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nodes=(await (await fetch('future-lab/data/iot-nodes.json')).json()).nodes;
const nodeLookup=Object.fromEntries(nodes.map(n=>[n.id,n]));
const sample=new URLSearchParams(location.search).get('sample');
const seededEvents=()=>Object.fromEntries(SCENES.map(s=>[s.id,(sample==='empty'?[]:s.history).map((e,i)=>({...e,id:`${s.id}-${i}`,simulated:true}))]));
const state={sceneIndex:0,roomIndex:-1,autoplay:true,paused:false,sceneStarted:performance.now(),elapsed:0,frameReady:false,events:seededEvents(),alerts:{},modalEvent:null,modalScene:null,selectedNodeId:null,nodeScope:'scene',nodeListOpen:false,nodeSearch:'',manualRoomId:null,snapshots:new Map(),lastTick:performance.now(),modelError:null,selectionCount:0,realAlarmId:null};
const contentTrace=[];let lastContentKey='';
const scene=()=>SCENES[state.sceneIndex];
const room=()=>state.manualRoomId?(scene().rooms.find(r=>r.id===state.manualRoomId)||{id:state.manualRoomId,nodeIds:nodes.filter(n=>n.roomId===state.manualRoomId).map(n=>n.id),result:'手动定位：查看该房间节点数据'}):state.roomIndex>=0?scene().rooms[state.roomIndex]:null;
const alertFor=()=>state.alerts[scene().id]||null;
const nodeNames=r=>(r?.nodeIds||[]).map(id=>nodeLookup[id]?.name).filter(Boolean);
const emit=(type,options={})=>{try{FRAME.contentWindow?.postMessage({channel:CHANNEL,type,...options},location.origin);}catch{}};
const roomTitle=r=>r?`${r.id} ${ROOM_NAMES[r.id]}`:'全景场景覆盖';
function setPlaybackStatus(){
 if(state.realAlarmId){$('dock-hint').textContent='真实节点告警 · 已暂停';$('autoplay').innerHTML='<i data-lucide="alert-triangle"></i><span>告警优先处理中</span>';return;}
 if(!state.frameReady){$('dock-hint').textContent=state.modelError?'三维不可用 · 巡航已暂停':'正在加载真实三维';$('autoplay').innerHTML='<i data-lucide="play"></i><span>继续自动巡航</span>';return;}
 $('dock-hint').textContent=state.autoplay&&!state.paused?'自动巡航中':state.autoplay?'自动巡航已暂停':'手动查看中';
 $('autoplay').innerHTML=`<i data-lucide="${state.autoplay&&!state.paused?'pause':'play'}"></i><span>${state.autoplay&&!state.paused?'暂停巡航':'继续自动巡航'}</span>`;
}
function renderLeft(){
 const s=scene(),result=describeScene(s,nodes,state.snapshots,state.events[s.id],alertFor());
 $('left-title').textContent=s.name;$('scene-purpose').textContent=result.purpose;
 const status=$('left-status');status.className=`status-pill ${result.tone}`;
 status.innerHTML=`<i class="dot"></i>${esc(result.status)}`;
 $('hero-label').textContent=result.label;$('hero-value').textContent=result.value;
 $('hero-value').dataset.wide=String(result.value.length>5||/[\u3400-\u9fff]/.test(result.value));
 $('hero-unit').textContent=result.unit;$('hero-desc').textContent=result.description;
 $('metric-grid').innerHTML=result.metrics.map(([label,value,note])=>`<div class="metric"><small>${esc(label)}</small><strong class="${String(value).length>8?'compact':''}">${esc(value)}</strong>${note?`<span class="metric-note">${esc(note)}</span>`:''}</div>`).join('');
 $('rule-list').innerHTML=result.rules.map(([label,value])=>`<div class="rule"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
 $('left-footnote').textContent=result.footnote;
}
function renderStage(){
 const s=scene(),r=room(),a=alertFor(),result=describeScene(s,nodes,state.snapshots,state.events[s.id],a);
 $('model-context').textContent=r?roomTitle(r):'全景场景覆盖';
 $('model-scene-name').textContent=s.name;
 $('floating-title').textContent=r?roomTitle(r):result.overviewTitle;
 $('floating-detail').textContent=r?roomSummary(r,nodes,state.snapshots,s,state.events[s.id]):result.overviewDetail;
 $('view-state').textContent=r?(state.autoplay&&!state.paused?`场景巡航 ${state.roomIndex+1}/${s.rooms.length}`:'房间定位查看'):(state.autoplay&&!state.paused?'关联房间高亮':'全景展示');
 if(state.realAlarmId){const n=nodeLookup[state.realAlarmId];document.querySelector('.model-info').style.borderColor='#ff867e';$('floating-detail').textContent=`真实节点告警：${n.name} · ${n.roomId} ${ROOM_NAMES[n.roomId]} · 自动巡航已暂停`;return;}
 if(a&&r&&a.room===r.id){document.querySelector('.model-info').style.borderColor='#f0c9b6';$('floating-detail').textContent=`模拟异常：${a.title} · 动作以演示记录为准`;}
 else document.querySelector('.model-info').style.borderColor='';
}
function renderEvents(){
 const s=scene(),list=state.events[s.id],cards=buildSceneEvents(s.id,list);
 const previousScope=$('event-list').dataset.eventScene,expanded=previousScope===s.id&&!!$('event-list').querySelector('.more-events[open]');
 $('event-count').textContent=cards.length===list.length?`${list.length} 项`:`${cards.length} 项 · ${list.length} 条记录`;
 $('event-scope').textContent='本场景所有关联房间 · 点击查看原始记录';
 const cardHTML=c=>`<button class="event-item ${room()?.id===c.room?'highlight':''}" type="button" data-event="${esc(c.id)}"><span class="event-icon ${esc(c.tone)}"><i data-lucide="${c.tone==='warning'?'alert-circle':c.tone==='recovered'?'check-check':'history'}"></i></span><span class="event-copy"><span class="event-title-row"><strong>${esc(c.title)}</strong><span class="event-type ${esc(c.tone)}">${esc(c.status)}</span></span><span class="event-top"><span>${esc(c.room)} ${esc(ROOM_NAMES[c.room])}</span><time>${esc(c.time)}</time></span><p class="event-observation">${esc(c.observation)}</p><p class="event-response"><b>响应 / 结果</b>${esc(c.response)}</p>${c.records.length>1?`<small class="event-origin">异常与恢复记录可一并查看</small>`:''}</span></button>`;
 $('event-list').innerHTML=cards.length?cards.slice(0,2).map(cardHTML).join('')+(cards.length>2?`<details class="more-events" ${expanded?'open':''}><summary data-more-events>其余 ${cards.length-2} 项历史记录</summary>${cards.slice(2).map(cardHTML).join('')}</details>`:''):'<div class="event-empty"><i data-lucide="history"></i><strong>该场景暂无历史事件</strong><p>当前没有可展示的异常或执行记录。</p></div>';
 $('event-list').dataset.eventScene=s.id;
 // Read-only evidence of automatic scene/content synchronization; no playback state is changed.
 const contentKey=JSON.stringify([s.id,room()?.id||null,$('hero-value').textContent]);
 if(contentKey!==lastContentKey){
  lastContentKey=contentKey;contentTrace.push({at:Math.round(performance.now()),scene:s.id,room:room()?.id||null,purpose:$('scene-purpose').textContent,result:$('hero-value').textContent,eventScene:$('event-list').dataset.eventScene,cardCount:cards.length});
  if(contentTrace.length>100)contentTrace.shift();
  let audit=document.getElementById('req013-v5-content-audit');if(!audit){audit=document.createElement('script');audit.id='req013-v5-content-audit';audit.type='application/json';document.body.append(audit);}audit.textContent=JSON.stringify(contentTrace);
 }
}
function renderDock(){
 $('scene-dock-items').innerHTML=SCENES.map((s,i)=>`<button type="button" class="scene-tab ${state.sceneIndex===i?'active':''} ${!state.autoplay?'manual':''}" data-scene="${s.id}" aria-current="${state.sceneIndex===i}"><span class="tab-icon"><i data-lucide="${s.icon}"></i></span><span class="tab-details"><span class="tab-num">SCENE ${String(i+1).padStart(2,'0')}</span><strong>${esc(s.short)}</strong><small>${esc(s.subtitle)}</small></span><span class="progress-track"><span class="progress-bar" id="tab-progress-${i}"></span></span></button>`).join('');
 setPlaybackStatus();renderProgress();
}
function renderProgress(){
 const bar=$(`tab-progress-${state.sceneIndex}`);
 if(bar)bar.style.width=`${Math.min(100,state.elapsed/scene().duration*100)}%`;
}
function renderAll(){renderLeft();renderStage();renderEvents();renderDock();renderNodeList();renderNodeDetail();icon();audit();}
function apply3D(){
 const s=scene(),r=room();
 emit('scene-rooms',{roomIds:[...new Set([...s.rooms.map(x=>x.id),...(state.manualRoomId?[state.manualRoomId]:[])])]});
 emit('display-mode',{mode:r?'cruise':'overview',roomId:r?.id||s.rooms[0].id});
 if(r)emit('focus-room',{roomId:r.id});
 emit('playback',{playing:state.autoplay&&!state.paused&&!!r});
}
function changeScene(index,{manual=false}={}){
 state.sceneIndex=(index+SCENES.length)%SCENES.length;
 state.roomIndex=-1;state.manualRoomId=null;state.selectedNodeId=null;emit('clear-node');state.nodeListOpen=false;state.sceneStarted=performance.now();state.elapsed=0;state.lastTick=performance.now();
 if(manual){state.autoplay=false;state.paused=true;}
 renderAll();if(state.frameReady)apply3D();
}
function setRoom(index,{manual=false}={}){
 const list=scene().rooms;
 state.roomIndex=index<0?-1:((index+list.length)%list.length);state.manualRoomId=null;state.selectedNodeId=null;state.nodeListOpen=false;
 if(manual){state.autoplay=false;state.paused=true;}
 emit('clear-node');renderAll();if(state.frameReady)apply3D();
}
function toggleAutoplay(){
 if(!state.frameReady||state.realAlarmId)return;
 if(state.autoplay&&!state.paused)pauseForInspection();
 else {state.autoplay=true;state.paused=false;state.lastTick=performance.now();state.selectedNodeId=null;state.manualRoomId=null;state.nodeListOpen=false;emit('clear-node');}
 renderAll();apply3D();
}
function tick(now=performance.now()){
 const delta=Math.max(0,now-state.lastTick);state.lastTick=now;
 if(document.hidden||$('event-dialog').open||!state.frameReady||!state.autoplay||state.paused)return;
 state.elapsed+=Math.min(delta,1500);
 if(state.elapsed>=scene().duration){changeScene(state.sceneIndex+1);return;}
 const introMs=3600;
 const next=state.elapsed<introMs?-1:Math.min(scene().rooms.length-1,Math.floor((state.elapsed-introMs)/((scene().duration-introMs)/scene().rooms.length)));
 if(next!==state.roomIndex){state.roomIndex=next;renderStage();renderEvents();icon();apply3D();}
 renderProgress();audit();
}
function getEvent(id){return state.events[scene().id].find(e=>e.id===id);}
function openEvent(id){
 const e=getEvent(id);if(!e)return;
 const s=scene(),card=buildSceneEvents(s.id,state.events[s.id]).find(c=>c.id===id||c.records.some(r=>r.id===id));
 state.modalEvent=e;state.modalScene=s.id;
 pauseForInspection();state.selectedNodeId=null;state.nodeListOpen=false;renderNodeDetail();renderNodeList();
 $('dialog-title').textContent=card.title;
 const row=(k,v)=>`<div class="dialog-row"><label>${esc(k)}</label><span>${esc(v)}</span></div>`;
 $('dialog-body').innerHTML=[['所属场景',s.name],['发生位置',roomTitle({id:e.room})],['数据来源','本地演示历史，未连接真实设备或发送服务'],...(card.records.length>1?[['显式演示关联',card.incidentId]]:[])].map(([k,v])=>row(k,v)).join('')+card.records.map(record=>{const view=eventRecordView(record);return `<section class="event-source-record"><h3>${esc(record.time)} · ${esc(view.status)}</h3>${[['原始记录 ID',record.id],['原始标题',record.title],['发现情况',view.observation],['动作记录',cleanAction(record.action)],['执行结果',view.outcome]].map(([k,v])=>row(k,v)).join('')}</section>`;}).join('');
 $('event-dialog').showModal();
}
function cleanAction(action){return action||'未提供动作记录';}
function simulate(){
 const s=scene();const r=room()||s.rooms[0];
 const stamp=new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'});
 const alert={room:r.id,title:s.id==='inspector'?'定时抓拍执行失败':r.eventTitle,action:s.id==='inspector'?'模拟：记录失败并提醒':r.action};state.alerts[s.id]=alert;
 state.events[s.id].unshift({id:`simulation-${s.id}-${Date.now()}`,room:r.id,time:`今天 ${stamp}`,title:alert.title,execution:s.id==='inspector'?'failed':undefined,detail:`演示触发：${alert.title}；${alert.action}`,type:'simulated',simulated:true,action:alert.action});
 state.autoplay=false;state.paused=true;
 state.roomIndex=s.rooms.findIndex(x=>x.id===r.id);state.manualRoomId=null;state.selectedNodeId=null;state.nodeListOpen=false;
 renderAll();if(state.frameReady)apply3D();
}
function reset(){
 pauseForInspection();const s=scene();delete state.alerts[s.id];
 state.events[s.id]=(sample==='empty'?[]:s.history).map((e,i)=>({...e,id:`${s.id}-${i}`,simulated:true}));
 state.sceneStarted=performance.now();state.elapsed=0;state.lastTick=performance.now();state.autoplay=false;state.paused=true;state.roomIndex=-1;state.selectedNodeId=null;state.manualRoomId=null;state.nodeListOpen=false;
 renderAll();if(state.frameReady)apply3D();
}

// 013 V3 — node lookup + real (mock) values extracted from the existing model.
function pauseForInspection(){
 state.autoplay=false;state.paused=true;
 setPlaybackStatus();renderProgress();
 emit('playback',{playing:false});audit();
}
function nodeSnapshot(node){
 return normalizeSnapshot(node,state.snapshots.get(node.id));
}
function metricRows(node,snapshot){
 const v=snapshot.values||{};
 if(!validSnapshot(snapshot))return [['当前数据','—',statusText(snapshot)],['最后记录时间',snapshot.updatedAt?'见下方时间':'暂无','不作为当前监测证据']];
 switch(node.type){
 case 'temperature':return [['当前温度',v.temperature??'—','℃'],['当前湿度',v.humidity??'—','%RH']];
 case 'light':return [['光照强度',v.illuminance??'—','lux']];
 case 'gas':return [['可燃气体',v.exceeded===undefined?'—':v.exceeded?'检测到异常':'未检测到异常','状态判断']];
 case 'smoke':return [['烟雾检测',v.detected===undefined?'—':v.detected?'检测到烟雾':'未检测到烟雾','状态判断']];
 case 'water':return [['水浸检测',v.detected===undefined?'—':v.detected?'检测到积水':'未检测到积水','状态判断']];
 case 'motion':return [['人员活动',v.activity===undefined?'—':v.activity?'检测到活动':'未检测到活动','不识别身份']];
 case 'switch':return ['IN1','IN2','OUT1','OUT2'].map(ch=>[ch,typeof v.channels?.[ch]==='boolean'?(v.channels[ch]?'开':'关'):'—','通道状态']);
 case 'camera':return [['设备连接',v.connection==='connected'?'已连接':'状态未知','视觉点位']];
 default:return [['状态','—','无模拟监测值']];
 }
}
function renderNodeDetail(){
 const node=state.selectedNodeId?nodeLookup[state.selectedNodeId]:null;
 const detail=$('node-detail-pane');
 const panel=$('event-panel')||document.querySelector('.event-panel');
 const open=!!node;
 detail.hidden=!open;
 panel.classList.toggle('node-detail-mode',open);
 if(!open)return;
 const snap=nodeSnapshot(node),status=statusText(snap);
 $('detail-node-title').textContent=`${node.name} · ${NODE_TYPES[node.type]||'物联节点'}`;
 $('detail-node-room').textContent=`${node.roomId} ${ROOM_NAMES[node.roomId]} · ${node.id}`;
 const rows=metricRows(node,snap),shownTime=snap.updatedAt?new Date(snap.updatedAt).toLocaleString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'}):'暂无有效上报时间';
 const info=rows.map(([label,value,unit])=>`<div class="reading-cell"><small>${esc(label)}</small><strong>${esc(value)}${typeof value==='number'?` <em>${esc(unit)}</em>`:''}</strong>${typeof value==='number'?'':`<span>${esc(unit)}</span>`}</div>`).join('');
 const image=node.type==='camera'&&validSnapshot(snap)?`<div class="detail-camera"><img src="future-lab/assets/camera-${esc(node.roomId)}.jpg" alt="${esc(node.name)} 静态演示画面"/><span>静态演示画面 · 非实时视频</span></div>`:'';
 const limits=scene().id==='climate'&&node.type==='temperature'?`<div class="node-threshold"><b>本场景示例阈值</b><span>温度 ≤ ${DEMO_RULES.climate.temperatureMax}℃ · 湿度 ≤ ${DEMO_RULES.climate.humidityMax}%RH</span></div>`:'';
 $('detail-node-body').innerHTML=`<div class="node-status-row"><span class="reading-status ${esc(snap.status)} ${esc(snap.dataState)}"><i></i>${esc(status)}</span><span class="demo-label">演示数据 · 非实时</span></div><div class="reading-grid ${node.type==='switch'?'four':''}">${info}</div>${image}${limits}<div class="node-extra"><div><span>数据来源</span><strong>${state.snapshots.has(node.id)?'三维模型本地模拟数据':'本地演示样本'}</strong></div><div><span>${validSnapshot(snap)?'演示上报时间':'最后样本时间'}</span><strong>${esc(shownTime)}</strong></div><div><span>场景关联</span><strong>${scene().rooms.some(r=>r.nodeIds.includes(node.id))?esc(scene().short):'非当前场景的点位'}</strong></div></div>${!validSnapshot(snap)&&snap.updatedAt&&Object.keys(snap.values).length?`<div class="last-sample">最后样本（非当前值）：${esc(JSON.stringify(snap.values))}</div>`:''}<p class="detail-disclaimer">本原型不连接真实设备；本面板只读，不支持控制设备或修改规则。实际状态需接入正式数据源。</p>`;
}
function renderNodeList(){
 const pane=$('node-list-panel');pane.hidden=!state.nodeListOpen;
 $('node-list-toggle').setAttribute('aria-expanded',String(state.nodeListOpen));
 $('node-list-toggle').classList.toggle('is-active',state.nodeListOpen);
 if(!state.nodeListOpen)return;
 for(const b of pane.querySelectorAll('[data-scope]'))b.classList.toggle('active',b.dataset.scope===state.nodeScope);
 const list=state.nodeScope==='scene'?scene().rooms.flatMap(r=>r.nodeIds.map(id=>nodeLookup[id]).filter(Boolean)):nodes;
 const query=state.nodeSearch.trim().toLowerCase();
 const filtered=list.filter(n=>!query||[n.name,n.id,n.roomId,ROOM_NAMES[n.roomId],NODE_TYPES[n.type]].some(x=>String(x||'').toLowerCase().includes(query)));
 const groups=[];
 for(const n of filtered){let g=groups.find(g=>g.id===n.roomId);if(!g){g={id:n.roomId,items:[]};groups.push(g);}g.items.push(n);}
 $('node-list-content').innerHTML=groups.length?groups.map(g=>`<div class="node-group"><div class="node-group-title">${esc(g.id)} ${esc(ROOM_NAMES[g.id])}<small>${g.items.length} 个</small></div>${g.items.map(n=>{const s=nodeSnapshot(n);return `<button type="button" class="node-list-item ${state.selectedNodeId===n.id?'selected':''}" data-select-node="${esc(n.id)}"><span class="node-type-mark"></span><span><b>${esc(n.name)}</b><small>${esc(NODE_TYPES[n.type])}</small></span><span class="node-inline-state ${esc(s.status)}">${statusText(s)}</span><i data-lucide="chevron-right"></i></button>`;}).join('')}</div>`).join(''):'<div class="node-empty">没有符合条件的节点</div>';
 icon();
}
function selectNode(id,source='list'){
 const n=nodeLookup[id];if(!n)return;
 pauseForInspection();state.selectionCount++;state.selectedNodeId=id;state.nodeListOpen=false;
 state.roomIndex=scene().rooms.findIndex(r=>r.id===n.roomId);
 state.manualRoomId=n.roomId;
 renderAll();if(state.frameReady){apply3D();emit('open-node',{id});}
}
function closeNodeDetail(){state.selectedNodeId=null;emit('clear-node');renderNodeDetail();renderNodeList();icon();audit();}
$('node-list-toggle').addEventListener('click',()=>{pauseForInspection();state.nodeListOpen=!state.nodeListOpen;renderAll();});
$('node-list-close').addEventListener('click',()=>{state.nodeListOpen=false;renderAll();});
$('node-list-panel').addEventListener('click',ev=>{
 const scope=ev.target.closest('[data-scope]');if(scope){state.nodeScope=scope.dataset.scope;renderNodeList();return;}
 const item=ev.target.closest('[data-select-node]');if(item)selectNode(item.dataset.selectNode,'list');
});
$('node-search').addEventListener('input',ev=>{state.nodeSearch=ev.target.value;renderNodeList();});
$('back-events').addEventListener('click',closeNodeDetail);
window.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!$('event-dialog').open){if(state.selectedNodeId)closeNodeDetail();else if(state.nodeListOpen){state.nodeListOpen=false;renderNodeList();}}});

$('scene-dock-items').addEventListener('click',ev=>{const b=ev.target.closest('[data-scene]');if(b)changeScene(SCENES.findIndex(s=>s.id===b.dataset.scene),{manual:true});});
$('autoplay').addEventListener('click',toggleAutoplay);
$('overview').addEventListener('click',()=>setRoom(-1,{manual:true}));
$('previous').addEventListener('click',()=>setRoom(state.roomIndex<0?scene().rooms.length-1:state.roomIndex-1,{manual:true}));
$('next').addEventListener('click',()=>setRoom(state.roomIndex+1,{manual:true}));
$('event-list').addEventListener('click',ev=>{if(ev.target.closest('[data-more-events]')){pauseForInspection();icon();return;}const b=ev.target.closest('[data-event]');if(b)openEvent(b.dataset.event);});
$('dialog-close').addEventListener('click',()=>$('event-dialog').close());
$('dialog-locate').addEventListener('click',()=>{const e=state.modalEvent;const s=state.modalScene;$('event-dialog').close();if(!e)return;const ix=SCENES.findIndex(x=>x.id===s);if(ix!==state.sceneIndex)changeScene(ix,{manual:true});setRoom(scene().rooms.findIndex(x=>x.id===e.room),{manual:true});});
$('simulate').addEventListener('click',simulate);$('reset').addEventListener('click',reset);
$('fullscreen').addEventListener('click',async()=>{const entering=!document.fullscreenElement;try{if(!entering)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}$('fullscreen-tip').hidden=!entering||!!document.fullscreenElement;});
document.addEventListener('fullscreenchange',()=>{$('fullscreen').innerHTML=document.fullscreenElement?'<i data-lucide="minimize"></i>退出全屏':'<i data-lucide="maximize"></i>全屏';icon();});
let loadTimer,lastQuality='',lastTraceKey='';const trace=[];
function prioritizeLiveRisk(){
 const n=liveRiskNode(nodes,state.snapshots),previous=state.realAlarmId;
 state.realAlarmId=n?.id||null;
 if(!n){if(previous){renderDock();icon();audit();}return;}
 if(previous===n.id)return;
 const index=SCENES.findIndex(s=>s.rooms.some(r=>r.nodeIds.includes(n.id)));
 if($('event-dialog').open)$('event-dialog').close();
 if(index>=0&&index!==state.sceneIndex)changeScene(index,{manual:true});
 pauseForInspection();state.selectedNodeId=null;state.manualRoomId=n.roomId;
 state.roomIndex=scene().rooms.findIndex(r=>r.id===n.roomId);renderAll();if(state.frameReady)apply3D();
}
function refreshQuality(){const quality=JSON.stringify(nodes.map(n=>{const s=nodeSnapshot(n);return[s.status,s.dataState];}));if(quality===lastQuality)return;lastQuality=quality;renderLeft();renderStage();if(state.selectedNodeId)renderNodeDetail();if(state.nodeListOpen)renderNodeList();}
function audit(){
 let el=$('req013-audit');if(!el){el=document.createElement('script');el.id='req013-audit';el.type='application/json';document.body.append(el);}
 const traceKey=JSON.stringify([scene().id,room()?.id||null,state.autoplay,state.paused,state.selectedNodeId,state.frameReady]);if(traceKey!==lastTraceKey){lastTraceKey=traceKey;trace.push({at:Math.round(performance.now()),scene:scene().id,room:room()?.id||null,autoplay:state.autoplay,paused:state.paused,selected:state.selectedNodeId,ready:state.frameReady});if(trace.length>150)trace.shift();}
 let timeline=$('req013-timeline-audit');if(!timeline){timeline=document.createElement('script');timeline.id='req013-timeline-audit';timeline.type='application/json';document.body.append(timeline);}timeline.textContent=JSON.stringify(trace);
 el.textContent=JSON.stringify({scene:scene().id,room:room()?.id||null,roomIds:scene().rooms.map(r=>r.id),autoplay:state.autoplay,paused:state.paused,elapsed:Math.round(state.elapsed),frameReady:state.frameReady,modelError:state.modelError,selectedNodeId:state.selectedNodeId,selectionCount:state.selectionCount,nodeListOpen:state.nodeListOpen,events:state.events[scene().id].length,realAlarmId:state.realAlarmId});
 $('autoplay').disabled=!state.frameReady||!!state.realAlarmId;
}
function modelFailed(reason){
 state.frameReady=false;state.modelError=reason;pauseForInspection();
 $('model-placeholder').classList.remove('hidden');$('model-placeholder').classList.add('failed');
 $('model-load-label').textContent=reason==='context-lost'?'三维渲染已中断，请重新加载':'三维模型未能加载。当前仅显示静态预览，不可交互。';
 $('retry-model').hidden=false;clearTimeout(loadTimer);audit();
}
function retryModel(){
 clearTimeout(loadTimer);state.frameReady=false;state.modelError=null;state.lastTick=performance.now();
 $('model-placeholder').classList.remove('hidden','failed');$('model-load-label').textContent='正在加载真实三维模型…';$('retry-model').hidden=true;
 const url=new URL(FRAME.getAttribute('src'),location.href);url.searchParams.set('reload',String(Date.now()));FRAME.src=url.href;
 loadTimer=setTimeout(()=>modelFailed('timeout'),20000);audit();
}
$('retry-model').addEventListener('click',retryModel);
FRAME.addEventListener('load',()=>emit('hello'));
window.addEventListener('message',ev=>{
 if(ev.origin!==location.origin||ev.source!==FRAME.contentWindow||ev.data?.channel!==CHANNEL)return;
 const d=ev.data;
 if(d.type==='snapshot'&&Array.isArray(d.audit?.nodes)){
  const accepted=d.audit.nodes.filter(n=>nodeLookup[n.id]);
  if(d.audit.nodes.length===nodes.length&&accepted.length===nodes.length&&accepted.every(n=>['normal','alarm','offline'].includes(n.status)&&n.values&&typeof n.values==='object'&&!Array.isArray(n.values)&&Number.isFinite(Date.parse(n.updatedAt)))&&new Set(accepted.map(n=>n.id)).size===nodes.length){state.snapshots=new Map(accepted.map(n=>[n.id,n]));prioritizeLiveRisk();renderLeft();renderStage();if(state.selectedNodeId)renderNodeDetail();if(state.nodeListOpen)renderNodeList();}
 }
 if(d.type==='model-ready'&&d.renderer==='WebGL'&&d.nodeCount===nodes.length&&d.modelCount>0){
  clearTimeout(loadTimer);const first=!state.frameReady;state.frameReady=true;state.modelError=null;$('model-placeholder').classList.add('hidden');setPlaybackStatus();icon();state.lastTick=performance.now();if(first)apply3D();audit();
 }
 if(d.type==='model-error')modelFailed(d.reason);
 if(d.type==='node-selected'&&nodeLookup[d.id])selectNode(d.id,'3d');
 if(d.type==='room-selected'&&ROOM_NAMES[d.roomId]){pauseForInspection();state.manualRoomId=d.roomId;state.roomIndex=scene().rooms.findIndex(r=>r.id===d.roomId);state.selectedNodeId=null;emit('clear-node');renderAll();if(state.frameReady)apply3D();}
 if(d.type==='interaction'){pauseForInspection();renderDock();icon();}
 if(d.type==='node-cleared')closeNodeDetail();
});
// Diagnostic output is DOM-readable; all acceptance clicks use real marker buttons.
renderAll();
const initialURL=new URL(FRAME.getAttribute('src'),location.href);if(['offline','stale','missing'].includes(sample)){initialURL.searchParams.set('demo-state',sample);FRAME.src=initialURL.href;document.querySelector('.sim-tag').title='演示状态：'+sample;}
loadTimer=setTimeout(()=>modelFailed('timeout'),20000);
const timer=setInterval(()=>{$('clock').textContent=new Date().toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Shanghai'});tick();refreshQuality();},220);
window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(loadTimer);},{once:true});
