import {DEMO_RULES} from '../mock/scene-data.js';

export function validValues(node,v){
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 switch(node.type){
 case 'temperature':return Number.isFinite(v.temperature)&&Number.isFinite(v.humidity);
 case 'light':return Number.isFinite(v.illuminance);
 case 'motion':return typeof v.activity==='boolean';
 case 'smoke':case 'water':return typeof v.detected==='boolean';
 case 'gas':return typeof v.exceeded==='boolean';
 case 'switch':return ['IN1','IN2','OUT1','OUT2'].every(k=>typeof v.channels?.[k]==='boolean');
 case 'camera':return ['connected','disconnected'].includes(v.connection);
 default:return false;
 }
}
export function normalizeSnapshot(node,raw,now=Date.now()){
 if(!raw)return {id:node.id,status:'unknown',dataState:'missing',values:{},updatedAt:null,source:'mock'};
 const time=Date.parse(raw.updatedAt);
 const missing=raw.dataState==='missing'||!Number.isFinite(time)||!validValues(node,raw.values);
 const stale=!missing&&(raw.dataState==='stale'||now-time>DEMO_RULES.maxReportAgeMs);
 return {...raw,id:node.id,values:raw.values||{},dataState:missing?'missing':stale?'stale':'valid',source:raw.source==='live'?'live':'mock'};
}
export function validSnapshot(s){return !['offline','unknown'].includes(s.status)&&s.dataState==='valid';}
export function statusText(s){return s.status==='offline'?'离线':s.dataState==='missing'?'无有效数据':s.dataState==='stale'?'数据未更新':s.status==='alarm'?'告警':'正常';}
export function riskAlarm(node,s){
 if(!validSnapshot(s))return false;
 if(s.status==='alarm')return true;
 return node.type==='gas'?s.values.exceeded===true:['smoke','water'].includes(node.type)?s.values.detected===true:false;
}
export function sceneNodeIds(scene){return [...new Set(scene.rooms.flatMap(r=>r.nodeIds))];}
function temperaturePass(node,s){return validSnapshot(s)&&!riskAlarm(node,s)&&s.values.temperature<=DEMO_RULES.climate.temperatureMax&&s.values.humidity<=DEMO_RULES.climate.humidityMax;}
export function describeScene(scene,nodes,snapshots,events,alert=null,now=Date.now()){
 const ids=new Set(sceneNodeIds(scene)),related=nodes.filter(n=>ids.has(n.id));
 const samples=related.map(n=>({n,s:normalizeSnapshot(n,snapshots.get(n.id),now)}));
 const usable=samples.filter(({s})=>validSnapshot(s)),total=related.length,unavailable=total-usable.length;
 const base={purpose:scene.purpose,tone:unavailable?'pending':'good',status:unavailable?'数据不完整':'监测正常'};
 const present=result=>alert?{...result,tone:'alert',status:'模拟演示异常',label:'异常响应演示',value:'演示已触发',unit:'非设备当前值',description:`${alert.room} · ${alert.title}`,overviewTitle:'模拟异常演示已触发',overviewDetail:'已暂停巡航，响应动作以演示记录为准。'}:result;
 if(scene.id==='climate'){
  const pass=usable.filter(({n,s})=>temperaturePass(n,s)),failed=usable.length-pass.length;
  const max=(key,suffix)=>usable.length?Math.max(...usable.map(({s})=>s.values[key]))+suffix:'—';
  const description=unavailable?`${unavailable} 个点位无有效数据，无法判断全部达标。`:failed?`${failed} 个监测点超出要求，请查看提醒记录。`:'各监测点的当前读数均在设定范围内。';
  return present({...base,tone:failed?'alert':base.tone,status:failed?'存在超限':unavailable?'数据不完整':'当前达标',label:'监测点符合要求',value:`${pass.length} / ${total}`,unit:'个监测点',description,
   metrics:[['最高温度',max('temperature','℃'),`要求 ≤ ${DEMO_RULES.climate.temperatureMax}℃`],['最高湿度',max('humidity','%RH'),`要求 ≤ ${DEMO_RULES.climate.humidityMax}%RH`]],
   rules:[['触发条件','温度或湿度超出本场景阈值'],['响应要求','触发提醒规则，生成异常记录']],footnote:'演示配置 · 仅监测与提醒，未接入自动调温。',
   overviewTitle:unavailable?'数据不完整，不能确认全部达标':`${pass.length}/${total} 个监测点符合要求`,overviewDetail:unavailable?description:`最高温度 ${max('temperature','℃')} · 最高湿度 ${max('humidity','%RH')}`});
 }
 if(scene.id==='safety'){
  const alarms=samples.filter(({n,s})=>riskAlarm(n,s)).length;
  const description=unavailable?`${unavailable} 个点位状态不可用，当前风险不能全部确认。`:alarms?'已检出异常，请结合节点数据与事件记录查看。':'有效监测点未检出烟雾、气体或水浸异常。';
  return present({...base,tone:alarms?'alert':base.tone,status:alarms?'检出异常':base.status,label:'当前待关注风险',value:unavailable&&!alarms?'待确认':String(alarms),unit:unavailable&&!alarms?'数据不完整':'项',description,
   metrics:[['有效安全监测点',`${usable.length} / ${total}`,'有效状态 / 关联点位'],['当前异常点',`${alarms} 个`,'仅统计有效监测数据']],
   rules:[['危险源','烟雾 / 气体 / 水浸异常提醒'],['人员活动','重点区域感应到活动时提醒'],['按配置响应','拍照 / 通知，结果以执行记录为准']],footnote:'人体活动不等于非法入侵，不识别人员身份。',
   overviewTitle:unavailable?'监测覆盖不完整，风险待确认':alarms?`当前检出 ${alarms} 项风险`:'当前未检出危险源异常',overviewDetail:description});
 }
 if(scene.id==='visitor'){
  const sample=samples[0]?.s,available=!!sample&&validSnapshot(sample),active=available&&sample.values.activity===true;
  const description=!available?'入口点位无有效当前数据，不能判断现场活动。':active?'当前检测到人员移动；活动信号不等于访客人数。':events.length?'当前未检测到活动，已有活动时间记录可追溯。':'当前未检测到活动，暂无历史活动记录。';
  return present({...base,tone:available?'good':'pending',status:available?'感应正常':'数据不完整',label:'接待区入口',value:!available?statusText(sample||{dataState:'missing'}):active?'检测到活动':'感应正常',unit:'人体活动感应',description,
   metrics:[['入口活动记录',`${events.length} 条`,'不作为访客人数'],['人体感应点位',available?'正常':statusText(sample||{dataState:'missing'}),'101 接待大厅']],
   rules:[['记录条件','检测到人员活动时记录发生时间'],['提醒要求','按已有配置触发活动提醒规则']],footnote:'门禁开门 / 身份识别：待接入。',
   overviewTitle:!available?'入口状态暂时无法判断':active?'接待区检测到人员活动':'接待区入口感应正常',overviewDetail:events.length?`已有 ${events.length} 条入口活动记录，不包含身份或开门结果。`:'暂无入口活动历史记录。'});
 }
 const done=events.filter(e=>e.execution==='success').length,failed=events.filter(e=>e.execution==='failed').length;
 const latest=events.find(e=>['success','failed'].includes(e.execution));
 const remaining=Math.max(0,DEMO_RULES.inspector.plannedCount-done-failed);
 const description=failed?`${failed} 次任务有失败记录，请查看对应执行结果。`:unavailable?`${unavailable} 个视觉点位当前状态不可用；历史执行结果仍可查。`:!latest?'暂无计划任务执行记录，请等待实际执行结果。':remaining?`${remaining} 次计划任务暂无执行记录，可查看已有抓拍结果。`:'已有抓拍执行结果可查。';
 return present({...base,tone:failed?'alert':unavailable||!latest?'pending':'good',status:failed?'执行有失败':unavailable?'点位状态不完整':done?'有成功执行记录':'暂无执行记录',label:'计划任务执行结果',value:`${done} / ${DEMO_RULES.inspector.plannedCount}`,unit:'次计划任务已成功执行',description,
  metrics:[['最近执行时间',latest?.time||'暂无','来自抓拍执行记录'],['执行失败',`${failed} 次`,'来自演示执行日志']],
  rules:[['计划时间',DEMO_RULES.inspector.schedule.join(' / ')],['记录方式','现场照片 / 执行日志'],['失败提醒','仅按已配置的异常提醒规则触发']],footnote:`${total} 个视觉点位 · 不含 AI 识别或摄像头物理巡航。`,
  overviewTitle:latest?`${done}/${DEMO_RULES.inspector.plannedCount} 次计划任务已成功执行`:'暂无计划任务执行记录',overviewDetail:description});
}
export function roomSummary(room,nodes,snapshots,scene=null,events=[],now=Date.now()){
 const list=nodes.filter(n=>room.nodeIds.includes(n.id));
 if(scene?.id==='inspector'){
  const node=list[0],s=node&&normalizeSnapshot(node,snapshots.get(node.id),now);
  if(!s||!validSnapshot(s))return '视觉点位：'+(s?statusText(s):'无有效数据');
  const latest=events.find(e=>e.room===room.id&&['success','failed'].includes(e.execution));
  return latest?`${latest.time} · 抓拍执行${latest.execution==='success'?'成功':'失败'}（演示）`:'视觉点位已连接 · 暂无抓拍执行记录';
 }
 return list.map(n=>{
  const s=normalizeSnapshot(n,snapshots.get(n.id),now),v=s.values;
  if(!validSnapshot(s))return `${n.name}：${statusText(s)}`;
  if(n.type==='temperature')return `温度 ${v.temperature}℃ · 湿度 ${v.humidity}%RH · ${temperaturePass(n,s)?'当前达标':'当前超限'}`;
  if(riskAlarm(n,s))return `${n.name}：检出异常`;
  if(n.type==='motion')return v.activity?'检测到人员活动':'当前未检测到人员活动';
  if(n.type==='camera')return '视觉点位已连接';
  return {smoke:'未检测到烟雾',gas:'未检测到可燃气体异常',water:'未检测到水浸'}[n.type]||`${n.name}：状态正常`;
 }).join(' · ');
}

// Future live adapters must explicitly mark their source; mock alarms never enter this path.
export function liveRiskNode(nodes,snapshots,now=Date.now()){
 return nodes.find(n=>{const s=normalizeSnapshot(n,snapshots.get(n.id),now);return s.source==='live'&&riskAlarm(n,s);})||null;
}
