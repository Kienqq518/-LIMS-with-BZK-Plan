import * as THREE from './vendor/three.module.js';
import {SceneGroupMotion,GROUP_MOTION} from '../src/scene-group-motion.js';
const CHANNEL='room-tour-highlight-v2';
let visual=null,motion=null,pending=null,frame=0,lastAudit=0,currentNodes=new Set(),sceneRooms=[],manualRoom=null,baseline='';
const rooms=new Map(),surfaces=[],groups=new Map(),boundaries=new Map(),mutedCache=new Map(),ownedGeometry=[],ownedMaterials=[],history=[];
const contains=(x,z,pts)=>{let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
const signature=()=>JSON.stringify([...visual.modelRoots].map(([id,m])=>[id,m.position.toArray(),m.quaternion.toArray(),m.scale.toArray()]));
function muted(material){
 if(mutedCache.has(material))return mutedCache.get(material);
 const m=material.clone();if(m.color){const l=THREE.MathUtils.clamp(m.color.r*.2126+m.color.g*.7152+m.color.b*.0722,.2,.88);m.color.setRGB(l*.58+.29,l*.58+.33,l*.58+.38);}if(m.emissive)m.emissive.setRGB(0,0,0);if('metalness'in m)m.metalness=Math.min(m.metalness,.18);if('roughness'in m)m.roughness=Math.max(m.roughness,.62);
 mutedCache.set(material,m);return m;
}
function platform(room,group){
 const vertices=room.points.flatMap(([x,z])=>[x,-.04,z]),points=room.points.map(([x,z])=>new THREE.Vector2(x,z));
 const top=new THREE.BufferGeometry();top.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));top.setIndex(THREE.ShapeUtils.triangulateShape(points,[]).flat());top.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:'#dfefff',roughness:.55,metalness:.12,side:THREE.DoubleSide});group.add(new THREE.Mesh(top,material));ownedGeometry.push(top);ownedMaterials.push(material);
 const sides=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sides.push(a.x,-.05,a.y,b.x,-.05,b.y,b.x,-.28,b.y,a.x,-.05,a.y,b.x,-.28,b.y,a.x,-.28,a.y);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(sides,3));geo.computeVertexNormals();const mat=material.clone();mat.color.set('#72b2df');group.add(new THREE.Mesh(geo,mat));ownedGeometry.push(geo);ownedMaterials.push(mat);
 const outline=new THREE.Group();outline.userData.roomId=room.id;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],curve=new THREE.LineCurve3(new THREE.Vector3(a.x,.04,a.y),new THREE.Vector3(b.x,.04,b.y));
  const g=new THREE.TubeGeometry(curve,1,.045,5,false),m=new THREE.MeshBasicMaterial({color:'#098bff',transparent:true,opacity:.95,depthTest:false,depthWrite:false,toneMapped:false});const edge=new THREE.Mesh(g,m);edge.renderOrder=26;outline.add(edge);ownedGeometry.push(g);ownedMaterials.push(m);
 }
 group.add(outline);boundaries.set(room.id,outline);
}
function styleSurfaces(){
 if(!motion)return;
 const active=new Set(motion.active);
 for(const e of surfaces){const lifted=motion.get(e.roomId)>.00001;e.mesh.visible=e.visible&&!(lifted&&e.liftable);e.mesh.material=active.has(e.roomId)||e.brand?e.original:e.gray;}
 for(const [id,g]of groups){g.position.y=motion.get(id);g.visible=g.position.y>.00001;g.updateMatrixWorld(true);}
}
function position(point,roomId){return point.clone().add(new THREE.Vector3(0,motion?.get(roomId)||0,0));}
function fitFrame(camera,w,h){
 if(!motion||!camera.isOrthographicCamera)return;
 styleSurfaces();
 const manual=manualRoom&&rooms.has(manualRoom),ids=manual?[manualRoom]:[...new Set([...motion.active,...motion.target])];
 const corners=[];
 for(const id of ids){const r=rooms.get(id),lift=GROUP_MOTION.lift;for(const [x,z]of r.points)for(const y of[-.3,Math.max(3,r.top)+lift])corners.push(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));}
 if(!corners.length)return;
 let left=Math.min(...corners.map(p=>p.x))-.8,right=Math.max(...corners.map(p=>p.x))+.8,bottom=Math.min(...corners.map(p=>p.y))-.8,top=Math.max(...corners.map(p=>p.y))+.8;
 if(!manual){left=Math.min(left,camera.left);right=Math.max(right,camera.right);bottom=Math.min(bottom,camera.bottom);top=Math.max(top,camera.top);}
 const aspect=w/h,half=Math.max((top-bottom)/2,(right-left)/(2*aspect)),cx=(left+right)/2,cy=(top+bottom)/2;
 camera.left=cx-half*aspect;camera.right=cx+half*aspect;camera.bottom=cy-half;camera.top=cy+half;camera.updateProjectionMatrix();
}
function decorate(){
 if(!visual)return;
 for(const n of window.roomTourNodes||[]){const el=document.querySelector(`.node-marker[data-node-id="${n.id}"]`);if(el)el.dataset.sceneActive=String(currentNodes.has(n.id));}
 const active=new Set(motion.active);
 for(const l of visual.labels){l.div.classList.toggle('scene-room-active',active.has(l.r.id));l.div.classList.toggle('scene-room-muted',!active.has(l.r.id));if(l.div.hidden)continue;const p=position(l.p,l.r.id).project(visual.camera);l.div.style.left=((p.x+1)*visual.host.clientWidth/2)+'px';l.div.style.top=((1-p.y)*visual.host.clientHeight/2)+'px';}
}
function audit(now=performance.now()){
 if(!visual)return;
 const state=motion.snapshot(),active=state.active.filter(id=>state.offsets[id]>.001),bounds={};
 for(const id of state.active){const g=groups.get(id),box=new THREE.Box3().setFromObject(g),pts=[];if(box.isEmpty())continue;for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])pts.push(new THREE.Vector3(x,y,z).project(visual.camera));bounds[id]={left:Math.min(...pts.map(p=>p.x)),right:Math.max(...pts.map(p=>p.x)),bottom:Math.min(...pts.map(p=>p.y)),top:Math.max(...pts.map(p=>p.y))};}
 const data={at:Math.round(now),...state,sceneRoomIds:sceneRooms,nodeIds:[...currentNodes],manualRoom,liftedRoomIds:active,meshCounts:Object.fromEntries([...groups].map(([id,g])=>[id,g.children.length-2])),modelTransformsUnchanged:signature()===baseline,modelCount:visual.modelRoots.size,screenBounds:bounds,renderer:'WebGL',lift:GROUP_MOTION.lift};
 let el=document.getElementById('scene-group-audit');if(!el){el=document.createElement('script');el.id='scene-group-audit';el.type='application/json';document.body.append(el);}el.dataset.phase=state.phase;el.textContent=JSON.stringify(data);
 history.push({at:data.at,phase:state.phase,serial:state.serial,active:state.active,target:state.target,offsets:state.offsets});if(history.length>400)history.shift();
 let trace=document.getElementById('scene-group-trace');if(!trace){trace=document.createElement('script');trace.id='scene-group-trace';trace.type='application/json';document.body.append(trace);}trace.textContent=JSON.stringify(history);
}
function apply(data){
 pending=data;if(!visual)return;
 const ids=[...new Set((data.roomIds||[]).filter(id=>rooms.has(id)))];if(!ids.length)return;
 sceneRooms=ids;currentNodes=new Set((data.nodeIds||[]).filter(id=>(window.roomTourNodes||[]).some(n=>n.id===id)));
 manualRoom=rooms.has(data.manualRoom)?data.manualRoom:null;
 document.body.dataset.sceneGroup='true';document.body.dataset.focusRoom='';
 const selected=manualRoom?[manualRoom]:ids;
 const changed=motion.request(selected,performance.now(),JSON.stringify([selected,manualRoom]));
 if(changed||data.resetView===true){visual.setView('overall-101');visual.zoom=1;}visual.render();decorate();audit();
}
function animate(now){
 frame=requestAnimationFrame(animate);if(document.hidden)return;
 const changed=motion.update(now);if(changed){styleSurfaces();visual.render();decorate();}
 if(now-lastAudit>160||changed&&motion.phase==='stable'){lastAudit=now;audit(now);}
}
function start(){
 if(visual||document.documentElement?.dataset.spaceReady!=='true')return;
 visual=window.visual106;baseline=signature();const owners=new Map();
 for(const [id,m]of visual.modelRoots)owners.set(m,id.slice(0,3));
 for(const id of['101','102','103','104','105','107','108','109','110'])if(visual['room'+id])owners.set(visual['room'+id].group,id);owners.set(visual.detail,'106');
 for(const r of visual.g.rooms.filter(r=>/^10[1-9]$|^110$/.test(r.id))){const points=r.points.map(([x,z])=>[x*.05,z*.05]);rooms.set(r.id,{...r,points,top:3});}
 visual.scene.updateMatrixWorld(true);
 visual.scene.traverse(mesh=>{
  if((!mesh.isMesh&&!mesh.isLine)||!mesh.material||mesh===visual.reflector)return;
  let owner=null,deviceId=null,effective=true,explicitOwner=false;
  for(let p=mesh;p;p=p.parent){if(owners.has(p)&&!owner){owner=owners.get(p);explicitOwner=true;}if(p.userData.id&&!deviceId)deviceId=p.userData.id;if(!p.visible)effective=false;}
  const box=new THREE.Box3().setFromObject(mesh),size=box.getSize(new THREE.Vector3());
  if(!owner){const c=box.getCenter(new THREE.Vector3());owner=[...rooms.values()].find(r=>contains(c.x,c.z,r.points))?.id;}if(!owner||!rooms.has(owner))return;
  const room=rooms.get(owner),xs=room.points.map(p=>p[0]),zs=room.points.map(p=>p[1]),fits=size.x<=Math.max(...xs)-Math.min(...xs)+.4&&size.z<=Math.max(...zs)-Math.min(...zs)+.4;
  const original=mesh.material,mats=Array.isArray(original)?original:[original],brand=owner==='101'&&mats.some(m=>m.map&&m.map.image?.width>500);
  const liftable=effective&&(!!deviceId||explicitOwner||fits);if(liftable)room.top=Math.max(room.top,box.max.y);
  surfaces.push({mesh,roomId:owner,original,gray:Array.isArray(original)?original.map(muted):muted(original),brand,visible:mesh.visible,liftable,deviceId});
 });
 for(const room of rooms.values()){
  const group=new THREE.Group();group.name='scene-group-room-'+room.id;group.userData.roomId=room.id;
  for(const e of surfaces.filter(e=>e.roomId===room.id&&e.liftable)){const clone=e.mesh.clone(false);clone.material=e.original;clone.matrixAutoUpdate=false;clone.matrix.copy(e.mesh.matrixWorld);clone.userData.sceneDeviceId=e.deviceId;group.add(clone);}
  platform(room,group);group.visible=false;visual.scene.add(group);groups.set(room.id,group);
 }
 motion=new SceneGroupMotion([...rooms.keys()],matchMedia('(prefers-reduced-motion:reduce)').matches?{lowerMs:0,riseMs:0}:{});
 window.roomTourPosition=position;window.roomTourFrame=fitFrame;window.roomTourOccluded=()=>false;
 const render=visual.render.bind(visual);visual.render=()=>{styleSurfaces();const result=render();decorate();return result;};
 // Keep the existing NodeLayer and its click handlers. Only add scene emphasis on its existing markers.
 const observer=new MutationObserver(decorate);observer.observe(visual.host,{childList:true,subtree:true});
 if(pending)apply(pending);animate(performance.now());parent.postMessage({channel:CHANNEL,type:'ready'},location.origin);
 window.addEventListener('pagehide',()=>{observer.disconnect();cancelAnimationFrame(frame);for(const e of surfaces){e.mesh.material=e.original;e.mesh.visible=e.visible;}for(const g of groups.values())visual.scene.remove(g);for(const m of mutedCache.values())m.dispose();for(const m of ownedMaterials)m.dispose();for(const g of ownedGeometry)g.dispose();},{once:true});
}
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.channel!==CHANNEL||event.data.type!=='focus-scene')return;apply(event.data);});
const observer=new MutationObserver(start);if(document.documentElement){observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-space-ready']});start();}
window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
