// Shared prototype data adapter for the 2D dashboard and 3D node layer.
// No physical-device status, thresholds or live video source is created here.
export const ROOM_NAMES={'101':'接待大厅','102':'智能样品室','103':'智能力学室','104':'控制室','105':'智能高压室','106':'无人化电缆试验区','107':'材料试验区','108':'环境试验区','109':'综合试验区','110':'数智化电气试验区'};
export function normalValues(n){
 switch(n.type){
  case 'temperature':return {temperature:[23.6,24.2,23.8,23.3][['102','106','107','108'].indexOf(n.roomId)],humidity:[52,49,53,51][['102','106','107','108'].indexOf(n.roomId)]};
  case 'light':return {illuminance:320};
  case 'smoke':case 'water':return {detected:false};
  case 'gas':return {exceeded:false};
  case 'motion':return {activity:false};
  case 'switch':return {contact:'closed',channels:{IN1:false,IN2:false,OUT1:false,OUT2:false}};
  case 'camera':return {connection:'connected',videoSource:null};
  default:return {};
 }
}
// Shared minute-aligned sample time for equivalent demo views, never a device heartbeat.
export function sampleTime(now=Date.now()){return new Date(Math.floor(now/60000)*60000).toISOString();}
export function baselineSnapshots(nodes,now=Date.now()){
 return nodes.map(n=>({nodeId:n.id,status:'normal',updatedAt:sampleTime(now),values:normalValues(n)}));
}
