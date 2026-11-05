import * as THREE from './vendor/three.module.js';
import {TECH_BLUE_SURFACES} from './tech-blue-materials.js';
const nodes=(await (await fetch('data/iot-nodes.json')).json()).nodes;
window.roomTourNodes=nodes;
const CHANNEL='future-lab-tech-blue-spatial';
let ready=false,last=null;
const pan=new THREE.Vector2();
function announce(){
 if(!ready)return;const v=window.visual106;v.camera.updateMatrixWorld();
 const anchors=nodes.map(n=>{const original=new THREE.Vector3(n.position.x,n.position.y,n.position.z),p=(window.roomTourPosition?.(original,n.roomId)||original).project(v.camera);return{id:n.id,x:(p.x+1)/2,y:(1-p.y)/2,depth:p.z,occluded:!!window.roomTourOccluded?.(p,n.roomId)};});
 const payload={channel:CHANNEL,type:'anchors',...window.spaceNavigation.status(),anchors,modelCount:v.modelRoots.size,camera:{yaw:v.yaw,elev:v.elev,zoom:v.zoom,pan:pan.toArray()}};
 const encoded=JSON.stringify(payload);if(encoded!==last){parent.postMessage(payload,location.origin);last=encoded;}
 let audit=document.getElementById('tech-blue-spatial-audit');if(!audit){audit=document.createElement('script');audit.type='application/json';audit.id='tech-blue-spatial-audit';document.body.append(audit);}audit.textContent=encoded;
}
function sendEquipmentCatalog(){const equipment=window.visual106.g.equipment.map(e=>({id:e.id,roomId:e.roomId,footprint:[(e.rotatedBBox[2]-e.rotatedBBox[0])*.05,(e.rotatedBBox[3]-e.rotatedBBox[1])*.05]}));parent.postMessage({channel:CHANNEL,type:'equipment-catalog',equipment},location.origin);}
function start(){
 if(ready||document.documentElement?.dataset.spaceReady!=='true')return;ready=true;observer.disconnect();
 const v=window.visual106,r=window.realisticLab;
 for(const record of r.records){const list=Array.isArray(record.upgraded)?record.upgraded:[record.upgraded];for(let i=0;i<list.length;i++){const material=list[i],preset=TECH_BLUE_SURFACES[record.roles[i]];if(!preset)continue;const{color,...properties}=preset;Object.assign(material,properties);if(color)material.color.set(color);}}
 const controlRoom=new URLSearchParams(location.search).get('theme')==='control-room';document.body.dataset.controlRoom=String(controlRoom);v.scene.background=new THREE.Color(controlRoom?'#0a1d36':'#dce8f1');r.key.color.set('#fffdf7');r.key.intensity=2.2;r.fill.intensity=.58;r.hemi.intensity=.63;
 const fit=v.fitCamera.bind(v);v.fitCamera=(w,h)=>{const result=fit(w,h);const c=v.camera,units=c.isOrthographicCamera?(c.top-c.bottom)/h:2*Math.tan(THREE.MathUtils.degToRad(c.fov/2))*c.position.length()/h;const offset=new THREE.Vector3(-pan.x*units,pan.y*units,0).applyQuaternion(c.quaternion);c.position.add(offset);c.updateMatrixWorld();window.roomTourFrame?.(c,w,h);announce();return result;};
 const setView=v.setView.bind(v);v.setView=view=>{pan.set(0,0);setView(view);};
 // Left drag and wheel retain the original orbit/zoom handlers; Shift/right/middle drag pans the camera only.
 const canvas=v.renderer.domElement,original={down:canvas.onpointerdown,move:canvas.onpointermove,up:canvas.onpointerup};let dragging=null;
 canvas.onpointerdown=e=>{if(e.shiftKey||e.button===1||e.button===2){dragging={x:e.clientX,y:e.clientY,pan:pan.clone()};canvas.setPointerCapture(e.pointerId);e.preventDefault();}else original.down(e);};
 canvas.onpointermove=e=>{if(dragging){pan.set(dragging.pan.x+e.clientX-dragging.x,dragging.pan.y+e.clientY-dragging.y);v.render();}else original.move(e);};
 canvas.onpointerup=e=>{if(dragging){dragging=null;canvas.releasePointerCapture(e.pointerId);}else original.up(e);};canvas.onpointercancel=()=>{dragging=null;};canvas.oncontextmenu=e=>e.preventDefault();
 canvas.addEventListener('pointerdown',()=>parent.postMessage({channel:CHANNEL,type:'background'},location.origin));
 document.addEventListener('keydown',event=>{if(event.key==='Escape')parent.postMessage({channel:CHANNEL,type:'escape'},location.origin);});
 window.addEventListener('message',event=>{if(event.source!==parent||event.origin!==location.origin||event.data?.channel!==CHANNEL)return;if(event.data.type==='view')window.spaceNavigation.setView(event.data.view);if(event.data.type==='request-catalog')sendEquipmentCatalog();if(event.data.type==='equipment-highlight')window.roomTourEquipmentSelection?.(event.data.id);});
 window.addEventListener('space-view-change',announce);
 window.addEventListener('space-device-select',event=>{window.roomTourEquipmentSelection?.(event.detail.id);parent.postMessage({channel:CHANNEL,type:'device',device:event.detail},location.origin);});
 v.render();announce();sendEquipmentCatalog();parent.postMessage({channel:CHANNEL,type:'ready'},location.origin);
}
const observer=new MutationObserver(start);if(document.documentElement){observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-space-ready']});start();}
window.addEventListener('pagehide',()=>{observer.disconnect();window.visual106?.renderer.dispose();window.visual106?.renderer.forceContextLoss();},{once:true});
