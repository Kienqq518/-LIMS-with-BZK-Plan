import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {finishes} from './equipment-106.js?rev=106-seating-v2';
import {create110Model} from './equipment-110.js?rev=110-structure-v1';
const S=.05;
function box(p,w,h,d,x,y,z,m,r=.008){const v=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/5,h/5,d/5)),m);v.position.set(x,y,z);v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function polygon(p,points,m,H=0){const sh=new THREE.Shape(points.map(q=>new THREE.Vector2(q[0]*S,-q[1]*S)));const geom=H?new THREE.ExtrudeGeometry(sh,{depth:H,bevelEnabled:false}):new THREE.ShapeGeometry(sh);geom.rotateX(-Math.PI/2);const v=new THREE.Mesh(geom,m);v.receiveShadow=true;p.add(v);return v;}
function trace(p,g,ii,color,y=.024,opacity=1){const v=[];for(const i of ii){const a=g.trace[i],q=a.closed?[...a.points,a.points[0]]:a.points;for(let j=1;j<q.length;j++)v.push(q[j-1][0]*S,y,q[j-1][1]*S,q[j][0]*S,y,q[j][1]*S);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));const m=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color,toneMapped:false,transparent:opacity<1,opacity}));p.add(m);return m;}
function glassSegment(parent,a,b,H,glass,rail){const x=(a[0]+b[0])*.025,z=(a[1]+b[1])*.025,len=Math.hypot(a[0]-b[0],a[1]-b[1])*S,ang=-Math.atan2(b[1]-a[1],b[0]-a[0]),q=new THREE.Group();q.position.set(x,0,z);q.rotation.y=ang;parent.add(q);const panel=box(q,len,H-.16,.012,0,H/2,0,glass,.001);panel.castShadow=false;panel.renderOrder=4;for(const y of [.07,H-.035])box(q,len,.045,.045,0,y,0,rail,.004);for(const side of [-1,1])box(q,.035,H,.045,side*(len/2-.018),H/2,0,rail,.004);return q;}
function column(parent,g,i,H){const q=g.trace[i].points,x=q.map(p=>p[0]),z=q.map(p=>p[1]);return box(parent,(Math.max(...x)-Math.min(...x))*S,H,(Math.max(...z)-Math.min(...z))*S,(Math.max(...x)+Math.min(...x))*.025,H/2,(Math.max(...z)+Math.min(...z))*.025,finishes.white);}

export function create110Scene(g,spec,host){
 const group=new THREE.Group();group.name=spec.revision;const models=new Map(),labels=[],audit=new THREE.Group(),sharedWith109=new THREE.Group(),a=spec.architecture,H=a.heightMeters,room=g.rooms.find(r=>r.id==='110');group.add(audit,sharedWith109);audit.visible=false;sharedWith109.visible=false;
 polygon(group,room.points,new THREE.MeshPhysicalMaterial({color:'#c2c9cd',roughness:.52,metalness:.08})).position.y=.01;
 const wall=new THREE.MeshPhysicalMaterial({color:'#e4e7e5',roughness:.5,metalness:.05,transparent:true,opacity:.40,depthWrite:false,side:THREE.DoubleSide}),glass=new THREE.MeshPhysicalMaterial({color:'#d3e6e7',metalness:0,roughness:.09,transparent:true,opacity:.17,depthWrite:false,side:THREE.DoubleSide,clearcoat:1,ior:1.47}),rail=new THREE.MeshPhysicalMaterial({color:'#788c97',roughness:.3,metalness:.75});
 for(const q of a.westWallSegments)box(group,(q[2]-q[0])*S,H,(q[3]-q[1])*S,(q[0]+q[2])*.025,H/2,(q[1]+q[3])*.025,wall,.001);
 for(const i of a.columnPaths)column(group,g,i,H);for(const i of a.sharedSouthColumnPaths)column(sharedWith109,g,i,H);
 for(const q of a.westWindowSegments)glassSegment(group,[q[0],q[1]],[q[2],q[3]],H,glass,rail);
 for(const q of a.northGlassSegments)glassSegment(group,[q[0],q[1]],[q[2],q[3]],H,glass,rail);
 for(const q of a.eastGlassSegments)glassSegment(group,[q[0],q[1]],[q[2],q[3]],H,glass,rail);
 // 东侧 M1813 双扇门位于两个固定玻璃段之间；面板保持在源墙洞内。
 const dz0=270.53378,dz1=306.53378,mid=(dz0+dz1)/2;glassSegment(group,[133.8,dz0],[133.8,mid],H,glass,rail);glassSegment(group,[133.8,mid],[133.8,dz1],H,glass,rail);
 const q=a.sharedSouthSegment;glassSegment(sharedWith109,[q[0],q[1]],[q[2],q[3]],H,glass,rail);
 const door=g.doors.find(d=>d.id===a.eastDoorId);trace(audit,g,door.pathIndices,'#8aa4b3',.034,.92);
 const arch=[...a.columnPaths,...a.sharedSouthColumnPaths,...a.northGlassPaths,...a.eastGlassPaths,...a.westWindowPaths,...a.westWallPaths,...a.sharedSouthPaths,...door.pathIndices];trace(audit,g,[...new Set(arch)],'#859ead',.032,.92);
 for(const e of g.equipment.filter(e=>e.roomId==='110')){const v=spec.equipment.find(s=>s.id===e.id),m=create110Model(e,v);group.add(m);models.set(e.id,m);trace(audit,g,e.pathIndices,'#2c9fc2',.038,1);const div=document.createElement('span');div.className='room-label device-110-label';div.textContent=e.id;div.title=e.nameIfReadable;host.append(div);labels.push({e,spec:v,div,p:new THREE.Vector3(m.position.x,v.heightMeters+.12,m.position.z)});}
 const entries=[];for(const[id,m]of models){const e=g.equipment.find(e=>e.id===id),b=e.rotatedBBox,bb=new THREE.Box3().setFromObject(m);entries.push({id,name:e.nameIfReadable,modelStatus:spec.equipment.find(s=>s.id===id).modelStatus,modeled:!bb.isEmpty(),pivot:[m.position.x,m.position.z],lockedBBox:b,sourcePathCount:e.pathIndices.length,actualHeightMeters:bb.isEmpty()?0:bb.max.y,overflowMeters:bb.isEmpty()?0:Math.max(0,b[0]*S-bb.min.x,bb.max.x-b[2]*S,b[1]*S-bb.min.z,bb.max.z-b[3]*S)});}
 let el=document.getElementById('110-audit');if(!el){el=document.createElement('script');el.type='application/json';el.id='110-audit';document.body.append(el);}el.textContent=JSON.stringify({revision:spec.revision,canonicalGeometrySHA256:spec.canonicalGeometrySHA256,sourceItems:entries.length,modeledItems:entries.filter(e=>e.modeled).length,addedIndependentDevices:0,unassignedIndependentEquipmentGroups:a.unassignedIndependentEquipmentGroups,architecture:a,entries});
 return{group,models,labels,audit,sharedWith109};
}
