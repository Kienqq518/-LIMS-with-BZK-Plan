// Selection is deliberately independent of these three operational states.
export const STATUS={normal:{text:'正常',color:'#647f92'},alarm:{text:'告警',color:'#d44949'},offline:{text:'离线',color:'#343d45'}};
export function validateSnapshot(raw,knownIds){
 if(!raw||!knownIds.has(raw.nodeId))throw new Error('未知节点 ID');
 if(!STATUS[raw.status])throw new Error('不支持的运行状态');
 if(!Number.isFinite(Date.parse(raw.updatedAt)))throw new Error('更新时间必须是有效 ISO 时间');
 if(!raw.values||typeof raw.values!=='object'||Array.isArray(raw.values))throw new Error('values 必须为对象');
 return structuredClone({nodeId:raw.nodeId,status:raw.status,values:raw.values,updatedAt:raw.updatedAt,dataState:['stale','missing'].includes(raw.dataState)?raw.dataState:'valid',source:raw.source==='live'?'live':'mock'});
}
export class NodeStore{
 constructor(nodes){this.ids=new Set(nodes.map(n=>n.id));this.snapshots=new Map();this.listeners=new Set();}
 replace(snapshots){const next=new Map();for(const raw of snapshots){const v=validateSnapshot(raw,this.ids);if(next.has(v.nodeId))throw new Error('节点快照重复');next.set(v.nodeId,v);}if(next.size!==this.ids.size)throw new Error('初始快照须覆盖全部节点');this.snapshots=next;this.emit();}
 patch(snapshots){const valid=snapshots.map(raw=>validateSnapshot(raw,this.ids));for(const v of valid)this.snapshots.set(v.nodeId,v);this.emit();}
 get(id){return this.snapshots.get(id);}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn);}
 emit(){for(const fn of this.listeners)fn();}
}
