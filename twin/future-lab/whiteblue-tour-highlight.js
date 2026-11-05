import * as THREE from './vendor/three.module.js';
const CHANNEL='room-tour-highlight-v2',CAMERA_ROOMS=['103','105','106','109'];
let groupRooms=new Set(),visual=null,layer=null,focus=null,selected='106',displayMode='cruise',baseline='',applied='',preview=null,frame=0,lastFrame=0,transition=null,labelsHost=null,frameCache=null,playing=true,interacting=false,lastRotationRender=0,lastPoseAudit=0,equipmentHelper=null,equipmentSelection=null;
const pose={lift:0,scale:1,x:13.8,z:18.9,angle:0},surfaces=[],mutedCache=new Map(),rooms=new Map(),cloneMaterials=[],focusGeometries=[],deviceLabels=[];
const transformSignature=()=>JSON.stringify([...visual.modelRoots].map(([id,m])=>[id,m.position.toArray(),m.quaternion.toArray(),m.scale.toArray()]));
const contains=(x,z,points)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
function muted(material){
 if(mutedCache.has(material))return mutedCache.get(material);
 const m=material.clone();
 if(m.color){const l=THREE.MathUtils.clamp(m.color.r*.2126+m.color.g*.7152+m.color.b*.0722,.2,.88);m.color.setRGB(l*.64+.30,l*.64+.33,l*.64+.36);}
 if(m.emissive)m.emissive.setRGB(0,0,0);
 if('metalness'in m)m.metalness=Math.min(m.metalness,.18);
 if('roughness'in m)m.roughness=Math.max(m.roughness,.68);
 if(m.map){m.map=null;m.needsUpdate=true;}
 mutedCache.set(material,m);return m;
}
function position(point,roomId){
 if(displayMode!=='cruise'||roomId!==selected||!rooms.has(selected))return point;
 const {center}=rooms.get(selected);
 const dx=(point.x-center.x)*pose.scale,dz=(point.z-center.z)*pose.scale,c=Math.cos(pose.angle),s=Math.sin(pose.angle);
 return new THREE.Vector3(pose.x+c*dx+s*dz,point.y*pose.scale+pose.lift,pose.z-s*dx+c*dz);
}
function occluded(point,roomId){
 if(displayMode!=='cruise'||roomId===selected||pose.lift<1||!rooms.has(selected))return false;
 const polygon=rooms.get(selected).points.map(([x,z])=>{const q=position(new THREE.Vector3(x,0,z),selected).project(visual.camera);return[q.x,q.y];});
 return contains(point.x,point.y,polygon);
}
function updatePose(lift,scale,amount=1){
 pose.lift=lift;pose.scale=scale;
 if(focus&&rooms.has(selected)){
  const c=rooms.get(selected).center;pose.x=THREE.MathUtils.lerp(c.x,13.8,amount);pose.z=THREE.MathUtils.lerp(c.z,18.9,amount);
  focus.position.set(pose.x,lift,pose.z);focus.rotation.y=pose.angle;focus.scale.setScalar(scale);focus.updateMatrixWorld(true);
 }
}
function clearFocus(){
 focus?.clear();for(const m of cloneMaterials)m.dispose();cloneMaterials.length=0;
 for(const g of focusGeometries)g.dispose();focusGeometries.length=0;
 for(const l of deviceLabels){l.div.remove();l.line.remove();l.dot.remove();}deviceLabels.length=0;
}
function createPlatform(room){
 const points=room.points.map(([x,z])=>new THREE.Vector2(x-room.center.x,z-room.center.z));
 const top=new THREE.BufferGeometry();top.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>[p.x,-.045,p.y]),3));top.setIndex(THREE.ShapeUtils.triangulateShape(points,[]).flat());top.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:'#e5f2fc',roughness:.43,metalness:.16,side:THREE.DoubleSide});
 focus.add(new THREE.Mesh(top,material));focusGeometries.push(top);cloneMaterials.push(material);
 const vertices=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];vertices.push(a.x,-.05,a.y,b.x,-.05,b.y,b.x,-.3,b.y,a.x,-.05,a.y,b.x,-.3,b.y,a.x,-.3,a.y);}
 const sides=new THREE.BufferGeometry();sides.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));sides.computeVertexNormals();
 const sideMaterial=new THREE.MeshStandardMaterial({color:'#a7cde5',roughness:.38,metalness:.22,side:THREE.DoubleSide});
 focus.add(new THREE.Mesh(sides,sideMaterial));focusGeometries.push(sides);cloneMaterials.push(sideMaterial);
}
function renderLabels(){if(labelsHost)labelsHost.hidden=true;}
function selectEquipment(id,render=true){
 if(id&&displayMode!=='overview')return;
 if(equipmentSelection===id&&equipmentHelper)return;
 if(equipmentHelper){visual.scene.remove(equipmentHelper);equipmentHelper.geometry.dispose();equipmentHelper.material.dispose();equipmentHelper=null;}
 equipmentSelection=id||null;
 if(id){
  const root=visual.modelRoots.get(id),item=visual.g.equipment.find(e=>e.id===id);
  if(root&&item){
   let bounds=new THREE.Box3().setFromObject(root);
   if(bounds.isEmpty()){const b=item.rotatedBBox;bounds=new THREE.Box3(new THREE.Vector3(b[0]*.05,.02,b[1]*.05),new THREE.Vector3(b[2]*.05,.055,b[3]*.05));}
   bounds.expandByScalar(.025);equipmentHelper=new THREE.Box3Helper(bounds,0x268fff);equipmentHelper.material.depthTest=false;equipmentHelper.material.transparent=true;equipmentHelper.material.opacity=.85;equipmentHelper.renderOrder=30;visual.scene.add(equipmentHelper);
  }
 }
 if(render){visual.render();audit();}
}
function fitFrame(camera,w,h){
 if(displayMode!=='cruise'||!focus.visible||!camera.isOrthographicCamera)return;
 const bw=camera.right-camera.left,bh=camera.top-camera.bottom,bx=(camera.right+camera.left)/2,by=(camera.top+camera.bottom)/2;
 if(!frameCache||transition||frameCache.w!==w||frameCache.h!==h){
  const box=new THREE.Box3().setFromObject(focus),corners=[];
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
  const left=Math.min(camera.left,...corners.map(p=>p.x-1.6)),right=Math.max(camera.right,...corners.map(p=>p.x+1.6));
  const bottom=Math.min(camera.bottom,...corners.map(p=>p.y-1.5)),top=Math.max(camera.top,...corners.map(p=>p.y+1.8));
  const half=Math.max((top-bottom)/2,(right-left)/2/(w/h));
  frameCache={w,h,scale:half/(bh/2),dx:((left+right)/2-bx)/bw,dy:((bottom+top)/2-by)/bh};
 }
 const cx=bx+frameCache.dx*bw,cy=by+frameCache.dy*bh;
 camera.left=cx-bw*frameCache.scale/2;camera.right=cx+bw*frameCache.scale/2;camera.top=cy+bh*frameCache.scale/2;camera.bottom=cy-bh*frameCache.scale/2;camera.updateProjectionMatrix();
}
function createFocus(){
 clearFocus();const room=rooms.get(selected),translation=new THREE.Matrix4().makeTranslation(-room.center.x,0,-room.center.z);
 for(const entry of surfaces.filter(e=>e.roomId===selected&&e.liftable)){
  const clone=entry.mesh.clone(false);
  clone.material=entry.original;
  if(entry.floor){const copy=m=>{const c=m.clone();cloneMaterials.push(c);return c;};clone.material=Array.isArray(entry.original)?entry.original.map(copy):copy(entry.original);}
  clone.matrixAutoUpdate=false;clone.matrix.copy(translation.clone().multiply(entry.mesh.matrixWorld));
  clone.visible=true;clone.userData.tourDeviceId=entry.deviceId;clone.userData.id=entry.deviceId;
  focus.add(clone);
 }
 createPlatform(room);
 const outline=layer.children.find(g=>g.userData.roomId===selected).clone(true);
 outline.matrixAutoUpdate=false;outline.matrix.copy(translation);outline.visible=true;focus.add(outline);
}
function audit(){
 let el=document.getElementById('tour-highlight-audit');if(!el){el=document.createElement('script');el.id='tour-highlight-audit';el.type='application/json';document.body.append(el);}
 el.dataset.room=selected;el.dataset.mode=displayMode;el.dataset.settled=String(!transition);
 const box=new THREE.Box3().setFromObject(focus),projected=[];
 if(displayMode==='cruise')for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])projected.push(new THREE.Vector3(x,y,z).project(visual.camera));
 const screenBounds=projected.length?{left:Math.min(...projected.map(p=>p.x)),right:Math.max(...projected.map(p=>p.x)),bottom:Math.min(...projected.map(p=>p.y)),top:Math.max(...projected.map(p=>p.y))}:null;
 el.textContent=JSON.stringify({roomId:selected,equipmentLabelsVisible:displayMode==='cruise'?0:document.querySelectorAll('.room-label[class*=device-]:not([hidden])').length,playing,selectedEquipment:equipmentSelection,screenBounds,displayMode,view:visual.view,models:visual.modelRoots.size,modelTransformsUnchanged:baseline===transformSignature(),displayOnly:true,inactiveRooms:displayMode==='cruise'?'gray':'original-color',pose:{...pose},floorClearance:pose.lift-Math.max(...surfaces.map(e=>e.top)),guideCount:0,liftedDeviceIds:[...new Set(focus.children.map(c=>c.userData.tourDeviceId).filter(Boolean))],originalMaterialsRestored:displayMode==='overview'?surfaces.every(e=>e.mesh.material===e.original&&e.mesh.visible===e.visible):null,previewRoom:displayMode==='cruise'&&CAMERA_ROOMS.includes(selected)?selected:null});
}
function selectRoom(id,mode=displayMode){
 selected=id;displayMode=mode;document.body.dataset.tourMode=mode;document.body.dataset.focusRoom=mode==='cruise'?id:'';if(!visual||applied===id+mode)return;applied=id+mode;
 const cruise=mode==='cruise';transition=null;frameCache=null;pose.angle=0;selectEquipment(null,false);
 for(const group of layer.children)group.visible=(cruise&&group.userData.roomId===id)||(!cruise&&groupRooms.has(group.userData.roomId));
 for(const entry of surfaces){
  entry.mesh.material=(!cruise&&groupRooms.has(entry.roomId))||entry.brand?entry.original:entry.gray;
  entry.mesh.visible=entry.visible&&!(cruise&&entry.roomId===id&&entry.liftable);
 }
 focus.visible=cruise;
 for(const entry of visual.labels){entry.div.classList.toggle('tour-active-room',cruise&&entry.r.id===id);entry.div.classList.toggle('tour-muted-room',cruise&&entry.r.id!==id);}
 if(cruise){
  createFocus();updatePose(0,1,0);
  const size=rooms.get(id).bounds.getSize(new THREE.Vector3()),scale=id==='101'?1.3:id==='106'?1.55:THREE.MathUtils.clamp(26/Math.max(size.x,size.z),1.8,2.8);
  transition={start:performance.now(),lift:20,scale};
 }else{clearFocus();updatePose(0,1,0);}
 visual.render();audit();
}
function buildPreview(){
 const target=new THREE.WebGLRenderTarget(384,216);target.texture.colorSpace=THREE.SRGBColorSpace;
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=216;
 preview={target,canvas,context:canvas.getContext('2d'),pixels:new Uint8Array(384*216*4),camera:new THREE.OrthographicCamera(-6,6,3.375,-3.375,.1,150)};
}
function animate(now){
 frame=requestAnimationFrame(animate);
 if(document.hidden){lastRotationRender=now;return;}
 if(transition){
  const t=Math.min(1,(now-transition.start)/850),ease=t*t*(3-2*t);
  pose.angle=-.14*ease;updatePose(transition.lift*ease,1+(transition.scale-1)*ease,ease);visual.render();if(t===1){transition=null;audit();}
 }
 const rotate=displayMode==='cruise'&&playing&&!interacting&&!transition&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(!rotate)lastRotationRender=now;
 else if(now-lastRotationRender>=42){
  const next=Math.min(.22,pose.angle+Math.min(100,now-lastRotationRender)*.00009);lastRotationRender=now;
  if(next!==pose.angle){pose.angle=next;updatePose(pose.lift,pose.scale);visual.render();if(now-lastPoseAudit>450){lastPoseAudit=now;audit();}}
 }
 if(!preview||displayMode!=='cruise'||!CAMERA_ROOMS.includes(selected)||now-lastFrame<125)return;lastFrame=now;
 const room=rooms.get(selected),b=room.bounds,cx=pose.x,cz=pose.z;
 const half=(Math.max(b.max.x-b.min.x,b.max.z-b.min.z)*.54+1.3)*pose.scale,cam=preview.camera,angle=now/18000;
 cam.left=-half;cam.right=half;cam.top=half*216/384;cam.bottom=-cam.top;cam.updateProjectionMatrix();
 cam.position.set(cx+Math.sin(angle)*25,23+pose.lift,cz+Math.cos(angle)*25);cam.lookAt(cx,pose.lift+.8,cz);cam.updateMatrixWorld();
 const renderer=visual.renderer,oldTarget=renderer.getRenderTarget(),visible=layer.visible;layer.visible=false;
 try{
  renderer.setRenderTarget(preview.target);window.realisticLab.nativeRender(visual.scene,cam);
  renderer.readRenderTargetPixels(preview.target,0,0,384,216,preview.pixels);
  const image=preview.context.createImageData(384,216),row=384*4;
  for(let y=0;y<216;y++)image.data.set(preview.pixels.subarray((215-y)*row,(216-y)*row),y*row);
  preview.context.putImageData(image,0,0);
  parent.postMessage({channel:CHANNEL,type:'camera-frame',roomId:selected,image:preview.canvas.toDataURL('image/jpeg',.74),sequence:Math.round(now)},location.origin);
 }finally{renderer.setRenderTarget(oldTarget);layer.visible=visible;}
}
function start(){
 if(visual||document.documentElement?.dataset.spaceReady!=='true')return;
 visual=window.visual106;baseline=transformSignature();const owners=new Map();
 for(const [id,m]of visual.modelRoots)owners.set(m,id.slice(0,3));
 for(const id of ['101','102','103','104','105','107','108','109','110'])if(visual['room'+id])owners.set(visual['room'+id].group,id);
 owners.set(visual.detail,'106');
 for(const r of visual.g.rooms.filter(r=>/^10[1-9]$|^110$/.test(r.id))){const points=r.points.map(([x,z])=>[x*.05,z*.05]),bounds=new THREE.Box3().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,0,z)));rooms.set(r.id,{...r,points,bounds,center:bounds.getCenter(new THREE.Vector3())});}
 visual.scene.updateMatrixWorld(true);
 visual.scene.traverse(mesh=>{
  if((!mesh.isMesh&&!mesh.isLine)||!mesh.material||mesh===visual.reflector)return;
  let owner=null,deviceId=null,effective=true,explicitOwner=false;
  for(let p=mesh;p;p=p.parent){if(owners.has(p)&&!owner){owner=owners.get(p);explicitOwner=true;}if(p.userData.id&&!deviceId)deviceId=p.userData.id;if(!p.visible)effective=false;}
  const box=new THREE.Box3().setFromObject(mesh),size=box.getSize(new THREE.Vector3());
  if(!owner){const c=box.getCenter(new THREE.Vector3());owner=[...rooms.values()].find(r=>contains(c.x,c.z,r.points))?.id;}
  if(!owner)return;
  const original=mesh.material,materials=Array.isArray(original)?original:[original],bounds=rooms.get(owner).bounds;
  const brand=owner==='101'&&materials.some(m=>m.map&&m.map.image?.width>500);
  const fits=size.x<=bounds.max.x-bounds.min.x+.4&&size.z<=bounds.max.z-bounds.min.z+.4;
  surfaces.push({mesh,roomId:owner,original,gray:Array.isArray(original)?original.map(muted):muted(original),brand,visible:mesh.visible,liftable:effective&&(!!deviceId||explicitOwner||fits),deviceId,top:box.max.y,floor:mesh.isMesh&&size.y<.035&&size.x>.8&&size.z>.8&&!deviceId});
 });
 layer=new THREE.Group();layer.name='room-tour-boundary-layer';visual.scene.add(layer);
 focus=new THREE.Group();focus.name='room-tour-lifted-display-copy';visual.scene.add(focus);
 for(const room of rooms.values()){
  const group=new THREE.Group();group.userData.roomId=room.id;layer.add(group);
  const points=room.points.map(([x,z])=>new THREE.Vector2(x,z)),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>[p.x,.035,p.y]),3));geometry.setIndex(THREE.ShapeUtils.triangulateShape(points,[]).flat());geometry.computeVertexNormals();
  group.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#48b8ff',transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide,toneMapped:false})));
  for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length];
   for(const [radius,opacity,color]of[[.115,.15,'#28aeff'],[.043,1,'#008bff']]){const path=new THREE.LineCurve3(new THREE.Vector3(a.x,.08,a.y),new THREE.Vector3(b.x,.08,b.y)),line=new THREE.Mesh(new THREE.TubeGeometry(path,1,radius,6,false),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,depthTest:false,toneMapped:false}));line.renderOrder=25;group.add(line);}
  }
 }
 labelsHost=document.createElement('div');labelsHost.id='tour-device-labels';labelsHost.innerHTML='<svg aria-hidden="true"></svg>';visual.host.append(labelsHost);
 window.roomTourPosition=position;window.roomTourFrame=fitFrame;window.roomTourOccluded=occluded;window.roomTourEquipmentSelection=selectEquipment;
 visual.renderer.domElement.addEventListener('pointerdown',()=>{interacting=true;});for(const type of['pointerup','pointercancel'])visual.renderer.domElement.addEventListener(type,()=>{interacting=false;});
 const render=visual.render.bind(visual);
 visual.render=()=>{render();renderLabels();for(const l of visual.labels)l.div.style.visibility=occluded(l.p.clone().project(visual.camera),l.r.id)?'hidden':'';if(displayMode!=='cruise')return;const entry=visual.labels.find(l=>l.r.id===selected);if(entry&&!entry.div.hidden){const r=rooms.get(selected),point=new THREE.Vector3(r.center.x,.15,r.bounds.max.z+.4),q=position(point,selected).project(visual.camera);entry.div.style.left=((q.x+1)*visual.host.clientWidth/2)+'px';entry.div.style.top=((-q.y+1)*visual.host.clientHeight/2)+'px';}};
 // Cruise is a presentation layer; manual overview retains native equipment picking.
 const raycast=visual.raycaster.intersectObjects.bind(visual.raycaster),roots=new Set(visual.modelRoots.values());
 visual.raycaster.intersectObjects=(objects,recursive=true,optional=[])=>{
  if(!objects.some(o=>roots.has(o)))return raycast(objects,recursive,optional);
  if(displayMode==='cruise')return [];
  return raycast(objects,recursive,optional);

 };
 buildPreview();selectRoom(selected,displayMode);animate(0);parent.postMessage({channel:CHANNEL,type:'ready'},location.origin);
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==parent||event.data?.channel!==CHANNEL)return;
 if(event.data.type==='playback'){const next=!!event.data.playing;if(playing!==next){playing=next;if(visual)audit();}return;}
 if(event.data.type!=='highlight')return;
 if(typeof event.data.playing==='boolean')playing=event.data.playing;
 if(Array.isArray(event.data.roomIds)){const next=new Set(event.data.roomIds.filter(id=>rooms.has(id)));const changed=JSON.stringify([...next].sort())!==JSON.stringify([...groupRooms].sort());groupRooms=next;if(changed&&displayMode==='overview')applied='';}
 if(/^10[1-9]$|^110$/.test(event.data.roomId))selectRoom(event.data.roomId,['cruise','overview'].includes(event.data.mode)?event.data.mode:displayMode);
});
const observer=new MutationObserver(start);if(document.documentElement){observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-space-ready']});start();}
window.addEventListener('pagehide',()=>{observer.disconnect();cancelAnimationFrame(frame);for(const e of surfaces){e.mesh.material=e.original;e.mesh.visible=e.visible;}clearFocus();for(const m of mutedCache.values())m.dispose();preview?.target.dispose();labelsHost?.remove();selectEquipment(null,false);layer?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});});
