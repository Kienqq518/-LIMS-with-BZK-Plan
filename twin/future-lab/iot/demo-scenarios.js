import {sampleTime} from './monitoring-data.js';
// Demo scripts only; none of these functions actuates laboratory equipment.
export const SCENARIOS=[
 {id:'gas',label:'可燃气体告警',nodeId:'IOT-106-GAS-01',status:'alarm',values:{exceeded:true}},
 {id:'smoke',label:'烟雾告警',nodeId:'IOT-110-SMOKE-02',status:'alarm',values:{detected:true}},
 {id:'water',label:'水浸告警',nodeId:'IOT-108-WATER-01',status:'alarm',values:{detected:true}},
 {id:'motion',label:'人体活动',nodeId:'IOT-101-PIR-01',status:'normal',values:{activity:true}},
 {id:'switch',label:'开关量变化',nodeId:'IOT-106-IO-01',status:'normal',values:{contact:'open'}},
 {id:'offline',label:'节点离线',nodeId:'IOT-102-TH-01',status:'offline',values:{}},
 {id:'reset',label:'恢复正常'}
];
export function applyScenario(id,service,store){
 const scenario=SCENARIOS.find(s=>s.id===id);if(!scenario)throw new Error('未知演示场景');
 // Offline preserves the last received timestamp and removes current values.
 const last=scenario.nodeId?store.get(scenario.nodeId):null;service.reset();
 if(scenario.nodeId)store.patch([{nodeId:scenario.nodeId,status:scenario.status,values:scenario.values,updatedAt:scenario.status==='offline'?last.updatedAt:sampleTime()}]);
 return scenario;
}
