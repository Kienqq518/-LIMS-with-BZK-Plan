// Present existing history without upgrading a rule/action record into an execution receipt.
const clean=value=>String(value||'').replace(/^模拟[：:]?\s*/, '');
export function eventRecordView(event){
 const success=event.execution==='success',failed=event.execution==='failed';
 const status=failed?'执行失败':success?'执行成功':event.type==='recovered'?'恢复记录':event.type==='warning'?'异常记录':event.type==='simulated'?'模拟触发':'已记录';
 const tone=failed||event.type==='warning'||event.type==='simulated'?'warning':success||event.type==='recovered'?'recovered':'record';
 let action=clean(event.action)||'未提供动作记录';
 let outcome=success?'执行日志记为成功（演示）':failed?`执行日志记为失败${event.failureReason?'：'+event.failureReason:'；未提供失败原因'}（演示）`:'未提供执行回执';
 if(!success&&!failed){
  if(event.type==='recovered'){action='记录监测值恢复';outcome='恢复记录不代表通知或设备动作成功';}
  else if(/入口活动|触发时间/.test(action)){action='生成活动时间记录';outcome='不包含人员身份或实际开门结果';}
  else if(/通知.*已记录|提醒.*已记录/.test(action)){action='已生成提醒记录';outcome='未提供通知送达回执';}
  else if(event.type==='warning'&&/通知|提醒/.test(action)){action='触发提醒规则并记录';outcome='未提供通知送达回执';}
  else if(event.type==='simulated'){action='生成本次模拟触发记录';outcome='规则动作仅作演示，未控制设备';}
  else if(/拍照|通知|提醒/.test(action)){action='动作记录：'+action;outcome='未提供执行回执';}
 }
 return {title:event.displayTitle||event.title,observation:event.detail||'未提供发现详情',action,outcome,status,tone,success,failed};
}
export function buildSceneEvents(sceneId,events){
 const cards=[],groups=new Map();
 for(const event of events){
  const incident=typeof(event.incidentId||event.chainId)==='string'?(event.incidentId||event.chainId).trim():'';
  const key=incident?JSON.stringify([sceneId,event.room,incident]):null;
  let card=key?groups.get(key):null;
  if(!card){card={id:event.id,room:event.room,incidentId:incident||null,records:[]};cards.push(card);if(key)groups.set(key,card);}
  card.records.push(event);
 }
 return cards.map(card=>{
  const records=[...card.records].sort((a,b)=>(a.incidentStep??0)-(b.incidentStep??0));
  const trigger=records.find(e=>e.type==='warning')||records[0];
  const recovery=records.find(e=>e.type==='recovered');
  const view=eventRecordView(trigger);
  const linkedRecovery=records.length>1&&!!card.incidentId&&!!recovery&&records.some(e=>e.type==='warning');
  return {...card,id:trigger.id,records,title:trigger.title,time:trigger.time,...view,
   status:linkedRecovery?'已恢复':view.status,tone:linkedRecovery?'recovered':view.tone,
   response:linkedRecovery?`${view.action}；${recovery.time} ${recovery.summary||recovery.detail}`:(view.success||view.failed?view.outcome:view.action),
   linkedRecovery};
 });
}
