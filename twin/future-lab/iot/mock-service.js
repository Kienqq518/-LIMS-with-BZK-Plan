import {baselineSnapshots,normalValues} from './monitoring-data.js';
// Fixed, labelled demonstration readings. No polling, no invented threshold rules.
export class MockNodeService{
 constructor(nodes,{initialStates=[]}={}){this.initialStates=initialStates;this.nodes=nodes;this.kind='mock';this.createdAt=new Date().toISOString();}
 baseline(){return baselineSnapshots(this.nodes);}
 normalValues(n){return normalValues(n);}
 async connect(store){this.store=store;store.replace(this.baseline());if(this.initialStates.length)store.patch(this.initialStates.map(s=>({...s,updatedAt:store.get(s.nodeId)?.updatedAt||this.createdAt})));return()=>{this.store=null;};}
 reset(){this.store.replace(this.baseline());}
}
