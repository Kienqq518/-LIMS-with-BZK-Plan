import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {finishes} from './equipment-106.js?rev=106-seating-v2';
import {create105Model} from './equipment-105.js?rev=105-structure-v1';
const S=.05;
function box(p,w,h,d,x,y,z,m,r=.008){const v=new THREE.Mesh(new RoundedBoxGeometry(Math.max(w,.006),Math.max(h,.006),Math.max(d,.006),2,Math.min(r,w/5,h/5,d/5)),m);v.position.set(x,y,z);v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function polygon(p,points,m){const sh=new THREE.Shape(points.map(q=>new THREE.Vector2(q[0]*S,-q[1]*S)));const geom=new THREE.ShapeGeometry(sh);geom.rotateX(-Math.PI/2);const v=new THREE.Mesh(geom,m);v.receiveShadow=true;p.add(v);return v;}
function trace(p,g,ii,color,y=.024,opacity=1){const v=[];for(const i of ii){const a=g.trace[i],q=a.closed?[...a.points,a.points[0]]:a.points;for(let j=1;j<q.length;j++)v.push(q[j-1][0]*S,y,q[j-1][1]*S,q[j][0]*S,y,q[j][1]*S);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));const m=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color,toneMapped:false,transparent:opacity<1,opacity}));p.add(m);return m;}
function glassSegment(parent,a,b,H,glass,rail){const x=(a[0]+b[0])*.025,z=(a[1]+b[1])*.025,len=Math.hypot(a[0]-b[0],a[1]-b[1])*S,ang=-Math.atan2(b[1]-a[1],b[0]-a[0]),q=new THREE.Group();q.position.set(x,0,z);q.rotation.y=ang;parent.add(q);const panel=box(q,len,H-.16,.012,0,H/2,0,glass,.001);panel.castShadow=false;panel.renderOrder=4;for(const y of [.07,H-.035])box(q,len,.045,.045,0,y,0,rail,.004);for(const side of [-1,1])box(q,.035,H,.045,side*(len/2-.018),H/2,0,rail,.004);return q;}
function rectColumn(parent,q,H,mat){return box(parent,(q[2]-q[0])*S,H,(q[3]-q[1])*S,(q[0]+q[2])*.025,H/2,(q[1]+q[3])*.025,mat,.002);}

export function create105Scene(g,spec,host){
 const group=new THREE.Group();group.name=spec.revision;const models=new Map(),labels=[],audit=new THREE.Group(),a=spec.architecture,H=a.heightMeters,room=g.rooms.find(r=>r.id==='105');group.add(audit);audit.visible=false;
 polygon(group,room.points,new THREE.MeshPhysicalMaterial({color:'#c3c9cc',roughness:.51,metalness:.07})).position.y=.011;
 const wall=new THREE.MeshPhysicalMaterial({color:'#e4e7e5',roughness:.5,metalness:.05,transparent:true,opacity:.45,depthWrite:false,side:THREE.DoubleSide}),glass=new THREE.MeshPhysicalMaterial({color:'#d3e6e7',metalness:0,roughness:.09,transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide,clearcoat:1,ior:1.47}),rail=new THREE.MeshPhysicalMaterial({color:'#788c97',roughness:.3,metalness:.75});
 for(const q of a.northWallSegments)rectColumn(group,q,H,wall);rectColumn(group,a.westWallSegment,H,wall);rectColumn(group,a.eastWallSegment,H,wall);
 for(const q of [[358.8,724.8,370.8,741.6],[421.8,736.8,427.8,741.6],[481.8,736.8,487.8,741.6],[538.8,724.8,550.8,736.8]])rectColumn(group,q,H,finishes.white);
 for(const q of a.southGlassSegments)glassSegment(group,[q[0],q[1]],[q[2],q[3]],H,glass,rail);
 // 北侧两处原门洞：M1624双扇与M0924单扇。展示层只画透明门片，源门弧在核对层保留。
 const z=610.8;glassSegment(group,[372.66888,z],[388.66888,z],H,glass,rail);glassSegment(group,[388.66888,z],[404.66888,z],H,glass,rail);glassSegment(group,[424.58169,z],[442.58169,z],H,glass,rail);
 const doorPaths=a.northDoorIds.flatMap(id=>g.doors.find(d=>d.id===id).pathIndices),windowPaths=a.southWindowIds.flatMap(id=>g.windows.find(w=>w.id===id).pathIndices),arch=[...a.northWallPaths,...a.westWallPaths,...a.eastWallPaths,...a.southColumnPaths,...doorPaths,...windowPaths];trace(audit,g,[...new Set(arch)],'#91abba',.032,.94);
 for(const e of g.equipment.filter(e=>e.roomId==='105')){const v=spec.equipment.find(s=>s.id===e.id),m=create105Model(e,v);group.add(m);models.set(e.id,m);trace(audit,g,e.pathIndices,'#27a5c8',.04,1);const div=document.createElement('span');div.className='room-label device-105-label';div.textContent=e.id;div.title=e.nameIfReadable;host.append(div);labels.push({e,spec:v,div,p:new THREE.Vector3(m.position.x,v.heightMeters+.13,m.position.z)});}
 const entries=[];for(const[id,m]of models){const e=g.equipment.find(e=>e.id===id),v=spec.equipment.find(s=>s.id===id),b=e.rotatedBBox,bb=new THREE.Box3().setFromObject(m);entries.push({id,name:e.nameIfReadable,modelStatus:v.modelStatus,modeled:!bb.isEmpty(),pivot:[m.position.x,m.position.z],lockedBBox:b,sourcePathCount:e.pathIndices.length,actualHeightMeters:bb.isEmpty()?0:bb.max.y,overflowMeters:bb.isEmpty()?0:Math.max(0,b[0]*S-bb.min.x,bb.max.x-b[2]*S,b[1]*S-bb.min.z,bb.max.z-b[3]*S)});}
 let el=document.getElementById('105-audit');if(!el){el=document.createElement('script');el.type='application/json';el.id='105-audit';document.body.append(el);}el.textContent=JSON.stringify({revision:spec.revision,canonicalGeometrySHA256:spec.canonicalGeometrySHA256,sourceItems:entries.length,modeledItems:entries.filter(e=>e.modeled).length,addedIndependentDevices:0,unassignedIndependentEquipmentGroups:a.unassignedIndependentEquipmentGroups,architecture:a,entries});
 return{group,models,labels,audit};
}
