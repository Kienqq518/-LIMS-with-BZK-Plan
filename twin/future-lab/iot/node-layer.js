import * as THREE from '../vendor/three.module.js';
import {icon} from './icons.js';
import {NodeDetail} from './detail-card.js';
export class NodeLayer{
 constructor(v,nodes,store,rooms){
  this.v=v;this.nodes=nodes;this.store=store;this.selectedId=null;this.quality=null;this.external=new URLSearchParams(location.search).get('external-node-details')==='1';this.points=new Map();this.visible=true;
  this.el=document.createElement('div');this.el.id='iot-layer';this.el.setAttribute('aria-label','物联节点');v.host.append(this.el);
  this.card=new NodeDetail(this.el,rooms,()=>this.close(),id=>window.dispatchEvent(new CustomEvent('iot-video-request',{detail:{nodeId:id}})));
  for(const n of nodes){const el=document.createElement('button');el.type='button';el.className='node-marker';el.dataset.nodeId=n.id;el.dataset.type=n.type;el.title=n.name+' · '+n.roomId+' '+rooms[n.roomId];el.innerHTML=icon(n.type)+'<span class="node-reading" aria-hidden="true" hidden></span><span class="disconnect" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M4 7 2.5 8.5a2 2 0 0 0 3 3L7 10M8 5l1.5-1.5a2 2 0 0 0-3-3L5 2M1 1l10 10"/></svg></span>';el.addEventListener('click',()=>this.select(n.id));this.el.append(el);this.points.set(n.id,{el,world:new THREE.Vector3(n.position.x,n.position.y,n.position.z),screen:null,visible:false});}
  this.unsubscribe=store.subscribe(()=>{this.paint();this.update();});this.paint();
  // Hook camera fitting: includes normal redraw, resize, PNG export and 1080p benchmark.
  const fit=v.fitCamera.bind(v);v.fitCamera=(...args)=>{const out=fit(...args);this.update();return out;};
  this.onMode=()=>{this.close();this.update();};window.addEventListener('lab-mode-change',this.onMode);window.addEventListener('lab-view-change',()=>this.close());
  window.addEventListener('visual-device-select',()=>this.close());
  let down=null;const canvas=v.renderer.domElement;
  canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<5)this.close();down=null;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')this.close();});
  new ResizeObserver(()=>this.update()).observe(v.host);
 }
 room(){return window.realisticLab?.roomId()||null;}
 reading(n,s,q){if(s.status==='offline'||q.dataState!=='valid')return '';const v=s.values||{};if(n.type==='temperature'&&Number.isFinite(v.temperature)&&Number.isFinite(v.humidity))return `${v.temperature.toFixed(1)}℃ · ${Math.round(v.humidity)}%RH`;if(n.type==='light'&&Number.isFinite(v.illuminance))return `${Math.round(v.illuminance)} lx`;return '';}
 present(n,s,q){
  const {el}=this.points.get(n.id),reading=el.querySelector('.node-reading'),value=this.reading(n,s,q),v=s.values||{};
  const dataState=q.dataState||'valid';
  const triggered=s.status!=='offline'&&dataState==='valid'&&(
   n.type==='motion'?v.activity===true:
   n.type==='gas'?v.exceeded===true:
   ['smoke','water'].includes(n.type)?v.detected===true:false
  );
  const state=s.status==='offline'?'离线':dataState==='stale'?'数据未更新':dataState==='missing'?'无有效数据':triggered?'存在':s.status==='alarm'?'告警':'正常';
  const label=`${n.roomId} ${n.name}，${value?value+'，':''}${state}`;
  if(reading.textContent!==value)reading.textContent=value;
  if(reading.hidden!==!value)reading.hidden=!value;
  if(el.dataset.status!==s.status)el.dataset.status=s.status;
  if(el.dataset.dataState!==dataState)el.dataset.dataState=dataState;
  if(el.dataset.triggered!==String(triggered))el.dataset.triggered=String(triggered);
  if(el.getAttribute('aria-label')!==label)el.setAttribute('aria-label',label);
 }
 paint(){for(const n of this.nodes){const s=this.store.get(n.id);if(!s)continue;this.present(n,s,this.quality?.(n,s)||s);}if(this.selectedId&&!this.external)this.card.show(this.nodes.find(n=>n.id===this.selectedId),this.store.get(this.selectedId));}
 select(id){
  if(!this.points.has(id))return;
  if(this.external){
    this.selectedId=id;this.card.close();this.paint();this.update();
    try{parent.postMessage({channel:'room-tour-node-v3',type:'node-selected',id},location.origin);}catch{}
    return;
  }
  if(this.selectedId===id){this.close();return;}this.selectedId=id;this.paint();this.update();
 }
 close(){this.selectedId=null;this.card.close();for(const {el}of this.points.values()){el.classList.remove('selected');el.setAttribute('aria-pressed','false');}this.audit();}
 update(){
  const v=this.v,w=v.host.clientWidth,h=v.host.clientHeight;if(!w||!h)return;
  const room=this.room();this.el.hidden=!this.visible||!document.body.classList.contains('presentation');this.el.classList.toggle('room-focus',!!room);
  v.camera.updateMatrixWorld();
  for(const n of this.nodes){const p=this.points.get(n.id),world=window.roomTourPosition?.(p.world,n.roomId)||p.world,q=world.clone().project(v.camera),x=(q.x+1)*w/2,y=(1-q.y)*h/2;p.screen={x,y};const sample=this.store.get(n.id);if(sample)this.present(n,sample,this.quality?.(n,sample)||sample);p.el.dataset.readingSide=x>w-160?'left':'right';p.el.dataset.roomActive=String(!document.body.dataset.focusRoom||document.body.dataset.focusRoom===n.roomId);p.visible=!this.el.hidden&&!window.roomTourOccluded?.(q,n.roomId)&&(!room||n.roomId===room)&&q.z>=-1&&q.z<=1&&x>16&&x<w-16&&y>(this.external?20:65)&&y<h-18;p.el.hidden=!p.visible;p.el.style.left=x+'px';p.el.style.top=y+'px';p.el.classList.toggle('selected',this.selectedId===n.id);p.el.setAttribute('aria-pressed',String(this.selectedId===n.id));}
  if(this.selectedId&&!this.external){const p=this.points.get(this.selectedId);if(p.visible)this.card.place(p.screen.x,p.screen.y,w,h);else this.close();}
  this.audit();
 }
 audit(){let el=document.getElementById('iot-audit');if(!el){el=document.createElement('script');el.type='application/json';el.id='iot-audit';document.body.append(el);}el.textContent=JSON.stringify({view:this.v.view,room:this.room(),selectedId:this.selectedId,nodeCount:this.nodes.length,typeCount:new Set(this.nodes.map(n=>n.type)).size,visibleCount:[...this.points.values()].filter(p=>p.visible).length,worldAnchors:this.nodes.map(n=>({id:n.id,roomId:n.roomId,type:n.type,position:n.position,screen:this.points.get(n.id)?.screen,visible:this.points.get(n.id)?.visible,status:this.store.get(n.id)?.status})),cardVisible:!this.card.element.hidden,cardText:this.card.element.hidden?'':this.card.element.textContent,models:this.v.modelRoots.size,camera:{matrixWorld:this.v.camera.matrixWorld.toArray(),matrixWorldInverse:this.v.camera.matrixWorldInverse.toArray(),projectionMatrix:this.v.camera.projectionMatrix.toArray()},hostSize:[this.v.host.clientWidth,this.v.host.clientHeight]});}
 async drawToCanvas(ctx,w,h){
  if(!this.visible||!document.body.classList.contains('presentation'))return;
  const room=this.room();
  for(const n of this.nodes){if(room&&n.roomId!==room)continue;const q=this.points.get(n.id).world.clone().project(this.v.camera),x=(q.x+1)*w/2,y=(1-q.y)*h/2;if(q.z<-1||q.z>1||x<16||x>w-16||y<30||y>h-18)continue;
   const s=this.store.get(n.id),selected=n.id===this.selectedId;const color=s.status==='offline'?'#ffffff':s.status==='alarm'?'#d44949':selected?'#075fcc':'#647f92',fill=s.status==='offline'?'#343d45':s.status==='alarm'?'#fff0f0':selected?'#e7f0ff':'#fcfdff';
   ctx.save();ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.fillStyle=fill;ctx.strokeStyle=s.status==='offline'?fill:color;ctx.lineWidth=1.4;ctx.fill();ctx.stroke();
   const svg=icon(n.type,color,20),img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();ctx.drawImage(img,x-10,y-10,20,20);if(s.status==='offline'){ctx.fillStyle='#343d45';ctx.fillRect(x+6,y+7,12,10);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+7,y+8);ctx.lineTo(x+15,y+14);ctx.stroke();}ctx.restore();
  }
  ctx.save();ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(20,20,350,56);ctx.fillStyle='#153b55';ctx.font='600 20px "PingFang SC",sans-serif';ctx.textAlign='left';ctx.fillText('未来实验室物联空间可视化',34,44);ctx.font='12px sans-serif';ctx.fillStyle='#768696';ctx.fillText('安全管家',34,64);ctx.restore();
 }
 dispose(){this.unsubscribe?.();window.removeEventListener('lab-mode-change',this.onMode);this.el.remove();}
}
