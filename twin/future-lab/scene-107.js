import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {finishes} from './equipment-106.js?rev=106-seating-v2';
import {create107Model} from './equipment-107.js?rev=107-structure-v1c';
const S=.05;
function box(parent,w,h,d,x,y,z,material){const a=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(.009,w/5,h/5,d/5)),material);a.position.set(x,y,z);a.castShadow=a.receiveShadow=true;parent.add(a);return a;}
function trace(parent,g,indices,color,y=.018){const a=[];for(const i of indices){const p=g.trace[i],pts=p.closed?[...p.points,p.points[0]]:p.points;for(let j=1;j<pts.length;j++)a.push(pts[j-1][0]*S,y,pts[j-1][1]*S,pts[j][0]*S,y,pts[j][1]*S);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(a,3));const m=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color,toneMapped:false}));parent.add(m);return m;}
export function create107Scene(g,spec,host){
 const group=new THREE.Group();group.name='107-structure-v1';const models=new Map(),labels=[];const room=g.rooms.find(r=>r.id==='107'),a=spec.architecture;
 const sh=new THREE.Shape(room.points.map(p=>new THREE.Vector2(p[0]*S,-p[1]*S))),fg=new THREE.ShapeGeometry(sh);fg.rotateX(-Math.PI/2);const floor=new THREE.Mesh(fg,new THREE.MeshPhysicalMaterial({color:'#c2c9cd',roughness:.52,metalness:.08}));floor.position.y=.01;floor.receiveShadow=true;group.add(floor);
 const wall=new THREE.MeshPhysicalMaterial({color:'#e4e7e5',roughness:.5,metalness:.05,transparent:true,opacity:.30,depthWrite:false,side:THREE.DoubleSide});
 const glass=new THREE.MeshPhysicalMaterial({color:'#d3e6e7',metalness:0,roughness:.09,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide,clearcoat:1,ior:1.47});
 const rail=new THREE.MeshPhysicalMaterial({color:'#788c97',roughness:.3,metalness:.75});
 const H=a.heightMeters;
 // Wall faces and gaps are derived from original paired DWG lines, never from the room polygon.
 for(const pair of a.northWallPairs){const p=g.trace[pair[0]],q=g.trace[pair[1]],xs=p.points.map(x=>x[0]),zs=[p.points[0][1],q.points[0][1]],lo=Math.max(Math.min(...xs),a.northClipX[0]),hi=Math.min(Math.max(...xs),a.northClipX[1]);box(group,(hi-lo)*S,H,Math.abs(zs[1]-zs[0])*S,(hi+lo)*S/2,H/2,(zs[0]+zs[1])*S/2,wall);}
 for(const pair of [a.eastWallPair,a.westPartitionPair]){const p=g.trace[pair[0]],q=g.trace[pair[1]],xs=[p.points[0][0],q.points[0][0]],zs=p.points.map(p=>p[1]);box(group,Math.abs(xs[1]-xs[0])*S,H,(Math.max(...zs)-Math.min(...zs))*S,(xs[0]+xs[1])*S/2,H/2,(Math.max(...zs)+Math.min(...zs))*S/2,wall);}
 for(const i of a.columnPathIndices){const p=g.trace[i],xs=p.points.map(q=>q[0]),zs=p.points.map(q=>q[1]);box(group,(Math.max(...xs)-Math.min(...xs))*S,H,(Math.max(...zs)-Math.min(...zs))*S,(Math.max(...xs)+Math.min(...xs))*S/2,H/2,(Math.max(...zs)+Math.min(...zs))*S/2,finishes.white);}
 const win=g.windows.find(w=>w.id===a.windowId),b=win.rotatedBBox;for(const index of [178,179]){const p=g.trace[index];const x=(p.points[0][0]+p.points[1][0])*S/2,z=p.points[0][1]*S;const pane=box(group,(b[2]-b[0])*S,H-.16,.008,x,H/2,z,glass);pane.castShadow=false;pane.renderOrder=4;}
 const z=(b[1]+b[3])*S/2;for(const y of [.08,H-.04])box(group,(b[2]-b[0])*S,.045,(b[3]-b[1])*S,(b[0]+b[2])*S/2,y,z,rail);
 for(const x of [b[0],b[2]])box(group,.035,H,(b[3]-b[1])*S,x*S,H/2,z,rail);
 trace(group,g,win.pathIndices,'#849aa6');const door=g.doors.find(d=>d.id===a.doorId);trace(group,g,door.pathIndices,'#7897a8',.023);
 // Retain original CAD device contours as an independent footprint check beneath the 3D parts.
 for(const e of g.equipment.filter(e=>e.roomId==='107')){const v=spec.equipment.find(s=>s.id===e.id),m=create107Model(e,v);group.add(m);models.set(e.id,m);trace(group,g,e.pathIndices,'#407e9e',.024);const div=document.createElement('span');div.className='room-label device-107-label';div.textContent=e.id+' · 简模';div.title=e.nameIfReadable+'；'+v.note;host.append(div);labels.push({e,spec:v,div,p:new THREE.Vector3(m.position.x,v.heightMeters+.08,m.position.z)});}
 const entries=[];for(const [id,m]of models){const e=g.equipment.find(e=>e.id===id),b=e.rotatedBBox,bb=new THREE.Box3().setFromObject(m);entries.push({id,sourceRootHandles:e.sourceRootHandles,sourcePathIndices:e.pathIndices,pivot:[m.position.x,m.position.z],lockedBBox:b,actualHeightMeters:bb.max.y,overflowMeters:Math.max(0,b[0]*S-bb.min.x,bb.max.x-b[2]*S,b[1]*S-bb.min.z,bb.max.z-b[3]*S),status:spec.equipment.find(v=>v.id===id).modelStatus});}
 let el=document.getElementById('107-audit');if(!el){el=document.createElement('script');el.type='application/json';el.id='107-audit';document.body.append(el);}el.textContent=JSON.stringify({revision:spec.revision,canonicalGeometrySHA256:spec.canonicalGeometrySHA256,sourceItems:entries.length,addedIndependentDevices:0,architecture:spec.architecture,entries});
 return {group,models,labels};
}
