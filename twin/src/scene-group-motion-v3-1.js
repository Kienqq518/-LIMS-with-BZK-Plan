export const GROUP_MOTION={lift:2.6,lowerMs:700,riseMs:1300,highlightMs:180,staggerMs:110};
export class SceneGroupMotion{
 constructor(ids,config={}){this.config={...GROUP_MOTION,...config};this.mode=config.mode==='stagger'?'stagger':'sync';this.known=new Set(ids);this.offsets=new Map(ids.map(id=>[id,0]));this.active=[];this.target=[];this.phase='stable';this.serial=0;this.key='';this.pausedAt=null;}
 request(ids,now=0,key=ids.join(',')){
  const next=[...new Set(ids.filter(id=>this.known.has(id)))];if(key===this.key)return false;
  this.update(now);this.key=key;this.target=next;this.serial++;this.start=now;this.from=new Map(this.offsets);
  if([...this.offsets.values()].some(y=>y>.00001))this.phase='lowering';else this.enter(now);
  return true;
 }
 enter(now){this.active=[...this.target];this.start=now;this.phase=this.mode==='stagger'&&this.config.highlightMs>0?'highlighting':'rising';}
 update(now){
  if(this.pausedAt!==null||this.phase==='stable')return false;
  for(let step=0;step<3;step++){
   const elapsed=Math.max(0,now-this.start),lower=this.phase==='lowering';
   if(this.phase==='highlighting'){if(elapsed<this.config.highlightMs)return true;this.phase='rising';this.start+=this.config.highlightMs;continue;}
   const duration=lower?this.config.lowerMs:this.config.riseMs;
   for(const id of this.known){
    const i=this.active.indexOf(id),delay=this.mode==='stagger'&&!lower?Math.min(this.config.staggerMs*Math.max(0,i),duration*.6):0;
    const t=duration?Math.min(1,Math.max(0,(elapsed-delay)/(duration-delay))):1,ease=t*t*(3-2*t);
    this.offsets.set(id,lower?(this.from.get(id)||0)*(1-ease):i>=0?this.config.lift*ease:0);
   }
   if(elapsed<duration)return true;
   if(lower){this.enter(this.start+duration);continue;}
   this.phase='stable';return true;
  }
  return true;
 }
 pause(now){if(this.pausedAt===null)this.pausedAt=now;}
 resume(now){if(this.pausedAt!==null){this.start+=Math.max(0,now-this.pausedAt);this.pausedAt=null;}}
 get(id){return this.offsets.get(id)||0;}
 snapshot(){return{mode:this.mode,phase:this.phase,serial:this.serial,active:[...this.active],target:[...this.target],offsets:Object.fromEntries(this.offsets),config:this.config};}
}
