import {NodeStore} from './iot/status.js';
import {MockNodeService} from './iot/mock-service.js?rev=iot-v1.1';
import {applyScenario} from './iot/demo-scenarios.js';
import {ROOM_NAMES,normalValues} from './iot/monitoring-data.js';
// The existing shared adapter remains the only source of IDs, readings and scenario rules.
try {
 if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
 const response=await fetch('./data/iot-nodes.json');if(!response.ok)throw new Error('节点配置加载失败');
 const config=await response.json();
 window.LAB_DATA={...window.LAB_DATA,rooms:ROOM_NAMES,nodes:config.nodes.map(n=>({...n,roomName:ROOM_NAMES[n.roomId],normalValues:normalValues(n)}))};
 class SharedShowcaseService {
  constructor(data){this.kind='mock';this.nodes=data.nodes;this.store=new NodeStore(this.nodes);this.source=new MockNodeService(this.nodes);this.source.connect(this.store);const sample=new URLSearchParams(location.search).get('demo-state');const q=new URLSearchParams(location.search),stamp=Date.parse(q.get('sampleAt'));if(q.get('review')==='1'&&Math.abs(Date.now()-stamp)<240000)this.store.patch(this.nodes.map(n=>({...this.store.get(n.id),nodeId:n.id,updatedAt:new Date(stamp).toISOString()})));const target=this.store.get('IOT-102-TH-01');if(['offline','stale','missing'].includes(sample)&&target)this.store.patch([{...target,status:sample==='offline'?'offline':'normal',dataState:sample==='stale'?'stale':sample==='missing'?'missing':'valid',values:sample==='missing'?{}:target.values,updatedAt:new Date(Date.now()-30*60*1000).toISOString()}]);if(['safety-offline','inspector-offline'].includes(sample)){const id=sample==='safety-offline'?'IOT-104-SMOKE-01':'IOT-103-CAM-01';const n=this.store.get(id);this.store.patch([{...n,nodeId:id,status:'offline',values:{},updatedAt:n.updatedAt}]);}
   if(sample==='gas'){const n=this.store.get('IOT-106-GAS-01');this.store.patch([{...n,nodeId:'IOT-106-GAS-01',status:'alarm',values:{exceeded:true}}]);}
   if(sample==='motion')for(const id of ['IOT-101-PIR-01','IOT-105-PIR-02']){const n=this.store.get(id);this.store.patch([{...n,nodeId:id,values:{activity:true}}]);}
   this.scene='normal';}
  get(id){return this.store.get(id);}
  setScene(mode){const id=mode==='normal'?'reset':mode==='alarm'?'gas':mode;const scenario=applyScenario(id,this.source,this.store);this.scene=mode;return scenario;}
 }
 window.ShowcaseService=SharedShowcaseService;
 await import('./scene-app-v3-1.js');
} catch(error){console.error('未来实验室启动失败',error);const el=document.createElement('p');el.setAttribute('role','alert');el.className='startup-error';el.textContent='空间加载失败，请刷新页面。';document.getElementById('stage').append(el);}
