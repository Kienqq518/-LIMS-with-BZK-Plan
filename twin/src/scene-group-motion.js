// Pure motion state: one shared progress for the whole group, always lower before changing membership.
export const GROUP_MOTION={lift:2.6,lowerMs:700,riseMs:1300};
export class SceneGroupMotion{
 constructor(ids,config={}){this.config={...GROUP_MOTION,...config};this.known=new Set(ids);this.offsets=new Map(ids.map(id=>[id,0]));this.active=[];this.target=[];this.phase='stable';this.serial=0;this.key='';}
 request(ids,now=0,key=ids.join(',')){
  const next=[...new Set(ids.filter(id=>this.known.has(id)))];
  if(key===this.key)return false;
  this.update(now);this.key=key;this.target=next;this.serial++;this.start=now;this.from=new Map(this.offsets);
  if([...this.offsets.values()].some(y=>y>.00001))this.phase='lowering';
  else{this.active=[...next];this.phase='rising';}
  return true;
 }
 update(now){
  if(this.phase==='stable')return false;
  const lower=this.phase==='lowering',duration=lower?this.config.lowerMs:this.config.riseMs;
  const t=duration?Math.min(1,Math.max(0,(now-this.start)/duration)):1,ease=t*t*(3-2*t);
  for(const id of this.known)this.offsets.set(id,lower?(this.from.get(id)||0)*(1-ease):this.active.includes(id)?this.config.lift*ease:0);
  if(t===1){if(lower){this.active=[...this.target];this.phase='rising';this.start=now;}else this.phase='stable';}
  return true;
 }
 get(id){return this.offsets.get(id)||0;}
 snapshot(){return {phase:this.phase,serial:this.serial,active:[...this.active],target:[...this.target],offsets:Object.fromEntries(this.offsets)};}
}
