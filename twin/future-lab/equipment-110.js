// 110 数智化电气试验区。外形只表达 CAD 可确认的工位类别；坐标与占地由 cad_geometry.json 锁定。
import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {finishes as M} from './equipment-106.js?rev=106-seating-v2';

const copper=new THREE.MeshPhysicalMaterial({color:'#a85f32',roughness:.28,metalness:.82,clearcoat:.18});
const ceramic=new THREE.MeshPhysicalMaterial({color:'#ece9df',roughness:.38,metalness:.02});
function box(p,w,h,d,x,y,z,m=M.white,r=.008){const v=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/5,h/5,d/5)),m);v.position.set(x,y,z);v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function cyl(p,r,h,x,y,z,m=M.steel,axis='y'){const v=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),m);v.position.set(x,y,z);if(axis==='x')v.rotation.z=Math.PI/2;if(axis==='z')v.rotation.x=Math.PI/2;v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function badge(p,id,x,y,z){const c=document.createElement('canvas');c.width=320;c.height=80;const a=c.getContext('2d');a.fillStyle='#f3f5f6';a.fillRect(0,0,320,80);a.fillStyle='#35576a';a.font='38px sans-serif';a.fillText(id,22,54);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;box(p,.25,.063,.003,x,y,z,new THREE.MeshBasicMaterial({map:t,toneMapped:false}),.001);}
function hmi(p,x,y,z){box(p,.22,.20,.035,x,y,z,M.dark,.008);box(p,.182,.145,.003,x,y+.009,z+.020,M.blue,.001);for(let i=0;i<3;i++)cyl(p,.009,.006,x+(i-1)*.045,y-.13,z+.021,i===1?M.blue:M.dark,'z');}
function feet(p,w,d){for(const x of [-1,1])for(const z of [-1,1]){cyl(p,.028,.11,x*w*.43,.075,z*d*.38,M.steel);cyl(p,.041,.024,x*w*.43,.018,z*d*.38,M.rubber);}}
function fixture(p,x,z,type){
 box(p,.27,.055,.24,x,.82,z,M.steel,.006);box(p,.235,.025,.205,x,.862,z,ceramic,.004);
 for(const q of [-1,1]){cyl(p,.035,.19,x+q*.07,.97,z,ceramic);cyl(p,.028,.055,x+q*.07,1.09,z,copper);}
 if(type==='fitting-rise'){
  box(p,.19,.038,.045,x,1.10,z,copper,.004);for(const q of [-1,1])cyl(p,.018,.12,x+q*.07,1.16,z,M.steel);
 }else{
  for(const q of [-1,1])box(p,.044,.19,.07,x+q*.065,1.14,z,M.dark,.004);box(p,.20,.035,.06,x,1.25,z,copper,.003);
 }
}
function workstation(p,w,d,H,spec){
 feet(p,w,d);box(p,w*.97,.60,d*.84,0,.42,0,M.white,.018);box(p,w*.94,.055,d*.80,0,.75,0,M.steel,.006);
 box(p,w*.94,.023,.018,0,.68,d*.41,M.blue,.002);
 // 原 CAD 的四纵向分区和两排、每排四个夹具位。
 for(let i=1;i<4;i++)box(p,.012,.012,d*.78,-w*.47+i*w*.235,.785,0,M.dark,.001);
 const controlW=w*.20,workW=w*.70,controlX=w*.35;
 for(const z of [-.225,.225])for(let i=0;i<4;i++)fixture(p,-w*.36+i*workW/3,z*d,spec.type);
 // 端部控制区与台面上的测温/接线架，均保持在原工位轮廓内。
 box(p,controlW,.65,d*.72,controlX,1.015,0,M.white,.015);box(p,controlW*.92,.42,.025,controlX,1.02,d*.37,M.window,.003);
 hmi(p,controlX,1.28,d*.395);box(p,controlW*.86,.026,d*.66,controlX,1.355,0,M.blue,.003);
 for(const z of [-1,1]){box(p,.026,.37,.026,-w*.02,1.02,z*d*.28,M.steel,.003);cyl(p,.014,w*.61,-w*.02,1.20,z*d*.28,copper,'x');}
 for(let i=0;i<4;i++)cyl(p,.012,.17,-w*.36+i*workW/3,1.31,0,copper);
 badge(p,spec.id,-w*.32,.49,d*.425);
}

export function create110Model(e,spec){
 const b=e.rotatedBBox,sx=(b[2]-b[0])*.05,sz=(b[3]-b[1])*.05,root=new THREE.Group();root.name=e.id;root.position.set((b[0]+b[2])*.025,0,(b[1]+b[3])*.025);
 root.userData={id:e.id,name:spec.name,sourceBBox:[...b],modelStatus:spec.modelStatus,operatingFace:{degrees:spec.appearanceFrontDegrees,status:spec.operatingFaceStatus}};
 const body=new THREE.Group();body.rotation.y=-spec.appearanceFrontDegrees*Math.PI/180;root.add(body);
 const swap=Math.abs(Math.sin(body.rotation.y))>.7,w=(swap?sz:sx)*.92,d=(swap?sx:sz)*.82;
 workstation(body,w,d,spec.heightMeters,spec);root.updateMatrixWorld(true);return root;
}
