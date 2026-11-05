import {DEMO_RULES,ROOM_NAMES} from '../mock/scene-data.js';
import {normalizeSnapshot,validSnapshot,riskAlarm,statusText,sceneNodeIds,describeScene} from './scene-monitoring.js';

export const SCENE_COPY={
 climate:{name:'实验室恒温恒湿保障',short:'恒温恒湿',purpose:'监测各试验区温湿度，超限及时提醒。'},
 safety:{name:'智能安全防护',short:'智能安全防护',purpose:'关注重点区域活动与环境风险，异常及时提醒。'},
 visitor:{name:'访客来访记录',short:'访客来访',purpose:'记录入口活动情况，辅助管理来访过程。'},
 inspector:{name:'虚拟巡视员',short:'虚拟巡视员',purpose:'按计划巡视重点房间，自动留痕并提醒异常。'}
};
const pad=n=>String(n).padStart(2,'0');
export function dayKey(now=Date.now()){return new Date(now+8*3600e3).toISOString().slice(0,10);}
export function clockText(ms){if(!Number.isFinite(ms))return '—';const d=new Date(ms+8*3600e3);return pad(d.getUTCHours())+':'+pad(d.getUTCMinutes());}
export function eventTimestamp(event,now=Date.now()){
 if(event.occurredAt){const stamp=Date.parse(event.occurredAt);if(Number.isFinite(stamp))return stamp;}
 const raw=String(event.time||'');const match=raw.match(/(?:(\d{2})-(\d{2})\s+|今天\s+)?(\d{2}):(\d{2})/);if(!match)return NaN;
 const date=match[1]?dayKey(now).slice(0,4)+'-'+match[1]+'-'+match[2]:dayKey(now);
 return Date.parse(date+'T'+match[3]+':'+match[4]+':00+08:00');
}
export function seedBusinessEvents(scenes,sample,now=Date.now()){
 const start=Date.parse(dayKey(now)+'T00:00:00+08:00');
 return Object.fromEntries(scenes.map(s=>[s.id,(sample==='empty'?[]:s.history).map((original,i)=>{
  const e={...original,id:`${s.id}-${i}`,simulated:true};
  if(s.id==='visitor'||s.id==='inspector'||s.id==='safety'&&i===0){
   const age=s.id==='inspector'?[30,90,150][i]||180:s.id==='visitor'?[25,85][i]||120:15;
   const timestamp=Math.max(start,now-age*60000);e.sourceTime=original.time;e.occurredAt=new Date(timestamp).toISOString();e.time=dayKey(timestamp).slice(5)+' '+clockText(timestamp);
  }
  return e;
 })]));
}
function latestEvent(events,now){return events.filter(e=>{const t=eventTimestamp(e,now);return Number.isFinite(t)&&t<=now;}).sort((a,b)=>eventTimestamp(b,now)-eventTimestamp(a,now))[0];}
function displayTime(event,now){if(!event)return '暂无记录';const t=eventTimestamp(event,now);return Number.isFinite(t)&&dayKey(t)===dayKey(now)?clockText(t):event.time||'—';}
export function businessEvent(card){
 const records=card.records||[card],first=records.find(e=>e.type==='warning')||records[0];
 const recovery=records.find(e=>e.type==='recovered');
 const visitor=String(card.id||'').startsWith('visitor'),inspector=String(card.id||'').startsWith('inspector');
 let observation=first.detail||first.title||'';
 let result='已记录';
 if(visitor){observation='入口检测到人员活动';result='活动已记录';}
 else if(first.execution==='success'){observation=inspector?'定时抓拍完成':'关联动作已执行';result=inspector?'巡视记录已留存':'执行成功';}
 else if(first.execution==='failed'){observation='计划任务执行失败';result=first.failureReason||'执行失败';}
 else if(card.linkedRecovery&&recovery){const value=(recovery.summary||recovery.detail||'').match(/\d+(?:\.\d+)?℃/);result=value?'已恢复至 '+value[0]:'已恢复';}
 else if(first.type==='recovered'){const value=(first.summary||first.detail||'').match(/\d+(?:\.\d+)?(?:℃|%RH)/);observation=first.summary||'监测状态已恢复';result=value?'已恢复至 '+value[0]:'已恢复';}
 else if(/人员活动/.test(first.title||'')){observation='检测到重点区域人员活动';result='活动已记录';}
 else if(first.type==='warning'){result='已生成提醒记录';}
 observation=observation.replace(/超过示例上限/g,'超过设定上限').replace(/演示触发[：:]?/g,'').replace(/演示/g,'').replace(/模拟[：:]?/g,'').replace(/；不代表.*$/,'').replace(/，无人员身份信息.*$/,'');
 return {title:card.title||first.displayTitle||first.title,observation,result,status:first.execution==='failed'?'执行失败':first.execution==='success'?'执行成功':card.linkedRecovery||first.type==='recovered'?'已恢复':first.type==='warning'?'异常提醒':'已记录'};
}
export function describeBusinessScene(scene,nodes,snapshots,events,alert=null,now=Date.now()){
 const base=describeScene(scene,nodes,snapshots,events,null,now),copy=SCENE_COPY[scene.id];
 const ids=new Set(sceneNodeIds(scene)),related=nodes.filter(n=>ids.has(n.id));const samples=related.map(n=>({n,s:normalizeSnapshot(n,snapshots.get(n.id),now)}));
 const usable=samples.filter(({s})=>validSnapshot(s)),unavailable=samples.length-usable.length;
 const recent=latestEvent(events,now);const today=events.filter(e=>{const t=eventTimestamp(e,now);return Number.isFinite(t)&&t<=now&&dayKey(t)===dayKey(now);});
 let result;
 if(scene.id==='climate'){
  result={...base,...copy,unit:'',description:unavailable?`${unavailable} 个监测点数据待更新`:'',metrics:base.metrics.map(([label,value,note],i)=>[label,value,(i?'湿度要求':'温度要求')+note.replace('要求','')]),rules:[['超限响应','异常提醒 / 事件记录']],recent:null};
 }else if(scene.id==='safety'){
  const alarms=usable.filter(({n,s})=>riskAlarm(n,s)).length;const active=usable.filter(({n,s})=>n.type==='motion'&&s.values.activity===true).length;
  result={...base,...copy,label:'当前风险状态',value:alarms?`${alarms} 条异常告警`:unavailable?'风险待确认':active?'有人员活动提醒':'无异常告警',unit:'',status:alarms?'存在异常':unavailable?'状态待确认':active?'检测到活动':'监测正常',tone:alarms?'alert':unavailable?'pending':'good',description:unavailable?`${unavailable} 个点位状态待更新`:'',
   metrics:[['监测区域',`${scene.rooms.length} 个`,''],['当前异常',`${alarms} 条`,'']],rules:[['监测对象','人员活动 / 烟雾 / 可燃气体 / 水浸'],['响应方式','异常提醒 / 事件记录 / 关联抓拍']],recent:recent?{label:'最近事件',time:recent.time,title:`${recent.room} ${recent.title}`,result:businessEvent({...recent,records:[recent]}).result}:null};
 }else if(scene.id==='visitor'){
  const entry=samples.find(({n})=>n.type==='motion'),valid=entry&&validSnapshot(entry.s),active=valid&&entry.s.values.activity===true;
  result={...base,...copy,label:'当前入口活动',value:!valid?'状态待确认':active?'检测到活动':'活动正常',unit:'',status:valid?'监测正常':'数据待更新',tone:valid?'good':'pending',description:'',
   metrics:[['今日活动',`${today.length} 条`,''],['最新活动',displayTime(recent,now),'']],rules:[['关注区域','101 接待大厅 / 入口区域'],['记录内容','活动感知 / 发生时间 / 记录留存']],recent:null};
 }else{
  const done=today.filter(e=>e.execution==='success').length,failed=today.filter(e=>e.execution==='failed').length,planned=DEMO_RULES.inspector.plannedCount;
  const executions=today.filter(e=>['success','failed'].includes(e.execution)),latest=latestEvent(executions,now),remaining=Math.max(0,planned-done-failed);
  result={...base,...copy,label:'今日已完成巡视',value:`${done} / ${planned}`,unit:'次',tone:failed?'alert':unavailable?'pending':done?'good':'pending',status:failed?'巡视有失败':unavailable?'点位状态待确认':done?'巡视执行正常':'等待巡视',description:failed?`${failed} 次执行失败`:unavailable?`${unavailable} 个视觉点位状态待更新`:'',
   metrics:[['最近巡视',displayTime(latest,now),''],['成功执行',`${done} 次`,''],['待执行',`${remaining} 次`,'']],rules:[['巡视范围',`${scene.rooms.length} 个重点房间`],['巡视方式','定时抓拍 / 状态留痕 / 异常提醒']],recent:null};
 }
 if(alert)result={...result,tone:'alert',status:'需要关注',label:'当前异常',value:'存在异常',description:`${alert.room} · ${alert.title}`};
 return result;
}
export function monitorTiles(scene,nodes,snapshots,currentRoom=null,now=Date.now()){
 const rooms=new Set(scene.rooms.map(r=>r.id));const cameras=nodes.filter(n=>n.type==='camera'&&rooms.has(n.roomId));let selected=cameras.map(n=>({roomId:n.roomId,node:n}));
 if(selected.length===1){const missing=currentRoom&&currentRoom!==selected[0].roomId&&rooms.has(currentRoom)?currentRoom:scene.rooms.find(r=>r.id!==selected[0].roomId)?.id;if(missing)selected.push({roomId:missing,node:null});}
 if(!selected.length)selected=scene.rooms.slice(0,2).map(r=>({roomId:r.id,node:null}));
 return selected.slice(0,4).map(({roomId,node})=>{const snap=node&&normalizeSnapshot(node,snapshots.get(node.id),now);return {roomId,roomName:ROOM_NAMES[roomId],nodeId:node?.id||null,image:node?`future-lab/assets/camera-${roomId}.jpg`:null,status:!node?'暂无画面':!validSnapshot(snap)?statusText(snap):snap.values.connection==='connected'?'已连接':'未连接',updatedAt:snap?.updatedAt||null,time:snap?.updatedAt?clockText(Date.parse(snap.updatedAt)):'—',valid:!!snap&&validSnapshot(snap),focused:roomId===currentRoom};});
}
