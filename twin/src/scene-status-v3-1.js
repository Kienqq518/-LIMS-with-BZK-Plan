import {DEMO_RULES} from '../mock/scene-data.js';
import {normalizeSnapshot,validSnapshot,riskAlarm,sceneNodeIds} from './scene-monitoring.js';
import {describeBusinessScene,dayKey,eventTimestamp,clockText} from './scene-presentation-v2.js';
export function describeSceneV3(scene,nodes,snapshots,events,now=Date.now()){
 const base=describeBusinessScene(scene,nodes,snapshots,events,null,now),ids=new Set(sceneNodeIds(scene));
 const samples=nodes.filter(n=>ids.has(n.id)).map(n=>({n,s:normalizeSnapshot(n,snapshots.get(n.id),now)}));
 const valid=samples.filter(({s})=>validSnapshot(s)),unknown=samples.length-valid.length;
 const result={...base,metrics:[],rules:[],recent:null};
 const metric=(label,value,icon,tone='good',note='',gauge=null)=>({label,value,icon,tone,note,gauge});
 if(scene.id==='climate'){
  result.metrics=base.metrics.map(([label,value,note],i)=>{const key=i?'humidity':'temperature',max=i?DEMO_RULES.climate.humidityMax:DEMO_RULES.climate.temperatureMax;const readings=valid.map(({s})=>s.values[key]);return metric(label,value,i?'droplet':'thermometer',unknown?'pending':readings.some(v=>v>max)?'alert':'good',note.replace(/温度要求|湿度要求/,'上限'),readings.length?{value:Math.max(...readings),max}:null);});
  if(unknown)result.status='监测点待确认';
 }else if(scene.id==='safety'){
  result.metrics=[['smoke','烟雾','cloud-fog'],['motion','人员活动','person-standing'],['gas','可燃气体','flame'],['water','水浸','droplet']].map(([type,label,icon])=>{
   const group=samples.filter(({n})=>n.type===type),usable=group.filter(({s})=>validSnapshot(s)),alarm=usable.some(({n,s})=>riskAlarm(n,s)),active=usable.some(({s})=>s.values.activity===true),missing=usable.length<group.length||!group.length;
   return metric(label,alarm?'检测到异常':active?'检测到活动':missing?'状态未知':type==='motion'?'未检测到活动':'未触发',icon,alarm?'alert':missing?'pending':active?'activity':'good');
  });
  const alarms=valid.filter(({n,s})=>riskAlarm(n,s)).length;
  result.value=alarms?`${alarms} 项风险待关注`:unknown?'风险待确认':'无异常告警';result.label='当前安全状态';
 }else if(scene.id==='visitor'){
  const uniqueActivities=[...new Map(events.map(e=>[e.id||`${e.room}|${eventTimestamp(e,now)}|${e.title}`,e])).values()];
  const today=uniqueActivities.filter(e=>{const t=eventTimestamp(e,now);return Number.isFinite(t)&&t<=now&&dayKey(t)===dayKey(now);});
  const entry=samples.find(({n})=>n.type==='motion'),available=entry&&validSnapshot(entry.s),active=available&&entry.s.values.activity===true;
  const times=events.map(e=>eventTimestamp(e,now)).filter(t=>Number.isFinite(t)&&t<=now).sort((a,b)=>b-a);
  result.label='今日入口活动';result.value=String(today.length);result.unit='次';result.description='';
  result.metrics=[metric('入口活动',!available?'状态未知':active?'检测到活动':'未检测到活动','person-standing',!available?'pending':active?'activity':'good'),metric('最近活动',times.length?clockText(times[0]):'暂无记录','clock-3',times.length?'good':'pending')];
 }else{
  const receipts=events.filter(e=>{const t=eventTimestamp(e,now);return Number.isFinite(t)&&t<=now&&dayKey(t)===dayKey(now)&&['success','failed'].includes(e.execution)&&scene.rooms.some(r=>r.id===e.room);});
  const unique=[...new Map(receipts.map(e=>[e.id,e])).values()],done=unique.filter(e=>e.execution==='success').length,failed=unique.filter(e=>e.execution==='failed').length;
  const latest=unique.map(e=>eventTimestamp(e,now)).sort((a,b)=>b-a)[0];
  result.label='今日已完成巡视';result.value=`${done} / ${DEMO_RULES.inspector.plannedCount}`;result.unit='次任务';result.description='';
  const planTimes=DEMO_RULES.inspector.schedule.slice(0,DEMO_RULES.inspector.plannedCount).map(time=>Date.parse(dayKey(now)+'T'+time+':00+08:00'));
  const pending=Math.max(0,DEMO_RULES.inspector.plannedCount-unique.length),futureSlots=planTimes.filter(t=>t>now).length,notDue=Math.min(pending,futureSlots),overdue=Math.max(0,pending-notDue);
  result.plan={pending,notDue,overdue};
  result.metrics=[metric('最近巡视',latest?clockText(latest):'暂无记录','clock-3',latest?'good':'pending'),metric('拍照记录',`${done} 组`,'camera'),metric('执行异常',`${failed} 次`,'triangle-alert',failed?'alert':'good',overdue?`${overdue} 次已到计划，待执行` : notDue?`${notDue} 次尚未到计划时间`:'')];
  result.tone=failed?'alert':unknown||overdue?'pending':done?'good':'pending';result.status=failed?'存在执行异常':unknown?'视觉节点待确认':overdue?'有任务待执行':done?'巡视执行正常':'等待执行';
 }
 return result;
}
export function sceneMonitorNodes(scene,nodes){
 const ids=new Set(scene.rooms.flatMap(r=>r.nodeIds));return nodes.filter(n=>n.type==='camera'&&ids.has(n.id)).slice(0,4);
}
