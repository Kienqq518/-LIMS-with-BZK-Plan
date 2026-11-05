// 105 智能高压室。平面尺寸锁定原 CAD；高压构件只表达 CAD 细线可确认的类别结构。
import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {finishes as M} from './equipment-106.js?rev=106-seating-v2';

const copper=new THREE.MeshPhysicalMaterial({color:'#a9673b',roughness:.28,metalness:.76,clearcoat:.18});
const ceramic=new THREE.MeshPhysicalMaterial({color:'#eee9dc',roughness:.34,metalness:.03,clearcoat:.25});
const red=new THREE.MeshPhysicalMaterial({color:'#b84c45',roughness:.36,metalness:.18,clearcoat:.3});
const yellow=new THREE.MeshPhysicalMaterial({color:'#ddb33a',roughness:.42,metalness:.2});
const screen=new THREE.MeshBasicMaterial({color:'#1b2f37',toneMapped:false});
function box(p,w,h,d,x,y,z,m=M.white,r=.008){const v=new THREE.Mesh(new RoundedBoxGeometry(Math.max(w,.006),Math.max(h,.006),Math.max(d,.006),2,Math.min(r,w/5,h/5,d/5)),m);v.position.set(x,y,z);v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function cyl(p,r,h,x,y,z,m=M.steel,axis='y',segments=20){const v=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,segments),m);v.position.set(x,y,z);if(axis==='x')v.rotation.z=Math.PI/2;if(axis==='z')v.rotation.x=Math.PI/2;v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function torus(p,R,r,x,y,z,m=M.steel,axis='x'){const v=new THREE.Mesh(new THREE.TorusGeometry(R,r,12,36),m);v.position.set(x,y,z);if(axis==='x')v.rotation.x=Math.PI/2;if(axis==='z')v.rotation.z=Math.PI/2;v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function badge(p,id,x,y,z){const c=document.createElement('canvas');c.width=320;c.height=80;const a=c.getContext('2d');a.fillStyle='#f3f5f6';a.fillRect(0,0,320,80);a.fillStyle='#35576a';a.font='38px sans-serif';a.fillText(id,22,54);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;box(p,.27,.067,.004,x,y,z,new THREE.MeshBasicMaterial({map:t,toneMapped:false}),.001);}
function hmi(p,x,y,z,s=.18){box(p,s,.16,.035,x,y,z,M.dark,.006);box(p,s*.78,.105,.003,x,y+.008,z+.020,M.blue,.001);for(let i=0;i<3;i++)cyl(p,.008,.006,x+(i-1)*s*.25,y-.105,z+.021,i===1?red:M.dark,'z',12);}
function feet(p,w,d){for(const x of [-1,1])for(const z of [-1,1]){cyl(p,.025,.08,x*w*.41,.055,z*d*.36,M.steel);cyl(p,.037,.02,x*w*.41,.012,z*d*.36,M.rubber);}}

function waterBench(p,w,d){
 feet(p,w,d);box(p,w*.92,.48,d*.62,0,.31,-d*.04,M.white,.015);box(p,w*.94,.055,d*.72,0,.585,0,M.steel,.005);box(p,w*.91,.022,.018,0,.53,d*.37,M.blue,.002);
 for(let i=0;i<8;i++){const x=-w*.39+i*w*.78/7;cyl(p,d*.105,.15,x,.70,d*.08,ceramic);torus(p,d*.105,.014,x,.78,d*.08,copper,'x');cyl(p,.012,.28,x,.91,d*.08,M.steel);}
 for(const x of [-1,1])box(p,.035,.73,.035,x*w*.445,.95,-d*.12,M.steel,.003);box(p,w*.89,.035,.035,0,1.30,-d*.12,M.steel,.003);
 box(p,w*.19,.37,d*.18,w*.33,.88,-d*.20,M.white,.01);hmi(p,w*.33,1.00,-d*.295,.16);badge(p,'105-01',-w*.31,.34,d*.315);
}
function powerFrequency(p,w,d){
 box(p,w*.76,.09,d*.34,0,.13,0,M.steel,.008);for(const x of [-w*.33,w*.33])cyl(p,.035,.16,x,.09,0,M.rubber);
 // CAD 顶视图两端圆形单元及中部长段。
 cyl(p,d*.34,.52,w*.31,.37,0,M.white);cyl(p,d*.22,.055,w*.31,.66,0,copper);for(let i=0;i<4;i++)cyl(p,d*(.18-i*.025),.065,w*.31,.72+i*.065,0,ceramic);
 cyl(p,d*.22,.40,-w*.34,.31,0,M.white);for(const z of [-1,1])box(p,.10,.22,.055,-w*.34,.55,z*d*.25,red,.006);box(p,w*.48,.18,d*.23,-w*.02,.34,0,M.dark,.01);box(p,w*.42,.035,d*.20,-w*.02,.46,0,copper,.003);badge(p,'105-02',0,.27,d*.22);
}
function detectorRack(p,w,d){
 feet(p,w*.82,d*.62);for(const z of [-1,1])cyl(p,.018,w*.62,0,.63,z*d*.15,M.steel,'x');box(p,w*.58,.022,d*.04,0,.34,0,M.dark,.002);
 for(const x of [-w*.28,w*.20]){box(p,.10,.72,d*.38,x,.48,0,M.white,.008);cyl(p,.032,.50,x,.88,0,ceramic);torus(p,.065,.016,x,1.09,0,copper,'x');}
 cyl(p,.024,w*.72,0,.93,0,copper,'x');cyl(p,.045,.14,w*.36,.93,0,red);badge(p,'105-03',0,.28,d*.20);
}
function linearSupport(p,w,d){
 cyl(p,.018,w*.88,0,.50,0,M.steel,'x');cyl(p,.012,w*.88,0,.58,0,copper,'x');
 for(const x of [-w*.40,0,w*.40]){cyl(p,Math.min(d*.25,.045),.62,x,.34,0,M.steel);cyl(p,Math.min(d*.34,.06),.035,x,.66,0,ceramic);}
}
function multifunctionConsole(p,w,d){
 feet(p,w,d);box(p,w*.88,.48,d*.72,0,.31,0,M.white,.015);box(p,w*.92,.055,d*.78,0,.585,0,M.steel,.006);
 const leftW=w*.48,rightW=w*.30;box(p,leftW,.48,d*.47,-w*.16,.86,-d*.06,M.white,.012);box(p,rightW,.39,d*.45,w*.29,.82,-d*.05,M.white,.012);
 // 两块带斜面感的深色控制区，对应 CAD 的大/小双分区。
 const a=box(p,leftW*.84,.31,.035,-w*.16,1.04,d*.20,M.dark,.005);a.rotation.x=-.18;const b=box(p,rightW*.82,.25,.035,w*.29,.99,d*.19,M.dark,.005);b.rotation.x=-.18;
 for(let i=0;i<8;i++)cyl(p,.012,.012,-w*.35+i*w*.055,1.03,d*.225,i%3===0?red:i%3===1?yellow:M.blue,'z',12);
 hmi(p,w*.29,1.01,d*.225,.18);box(p,w*.84,.025,.022,0,.56,d*.40,M.blue,.002);badge(p,'105-05',-w*.29,.32,d*.38);
}
function circularPlatform(p,w,d){
 const r=Math.min(w,d)*.40;box(p,w*.80,.075,d*.14,0,.10,-r*.75,M.steel,.005);box(p,w*.80,.075,d*.14,0,.10,r*.75,M.steel,.005);
 cyl(p,r,.10,0,.18,0,M.steel);cyl(p,r*.82,.08,0,.25,0,M.white);torus(p,r*.72,.025,0,.34,0,M.steel,'x');torus(p,r*.54,.021,0,.37,0,copper,'x');
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*r*.35,z=Math.sin(a)*r*.35;const rail=box(p,r*.55,.035,.035,x,.40,z,M.steel,.002);rail.rotation.y=-a;}
 cyl(p,r*.27,.18,0,.47,0,M.dark);torus(p,r*.19,.018,0,.58,0,ceramic,'x');for(let i=0;i<4;i++){const a=i*Math.PI/2;cyl(p,.028,.20,Math.cos(a)*r*.16,.64,Math.sin(a)*r*.16,ceramic);}
 box(p,r*.52,.07,.07,0,.73,0,copper,.003);badge(p,'105-06',0,.30,r*.47);
}
function ledDisplay(p,w,d){
 for(const x of [-1,1])box(p,.055,1.35,.055,x*w*.42,.70,0,M.steel,.004);box(p,w*.90,.055,d*.52,0,.12,0,M.steel,.004);box(p,w*.87,1.02,d*.34,0,.92,0,M.dark,.012);box(p,w*.80,.86,.008,0,.94,d*.18,screen,.001);
 for(let i=0;i<9;i++)cyl(p,.007,.008,-w*.32+i*w*.08,1.08,d*.19,i%2?red:M.blue,'z',8);badge(p,'105-07',0,.30,d*.20);
}
function unknownAux(p,w,d){box(p,w*.88,.055,d*.72,0,.035,0,yellow,.004);box(p,w*.50,.012,.012,0,.07,0,M.dark,.001);box(p,.012,.013,d*.42,0,.071,0,M.dark,.001);}

export function create105Model(e,spec){
 const b=e.rotatedBBox,sx=(b[2]-b[0])*.05,sz=(b[3]-b[1])*.05,root=new THREE.Group();root.name=e.id;root.position.set((b[0]+b[2])*.025,0,(b[1]+b[3])*.025);
 root.userData={id:e.id,name:spec.name,sourceBBox:[...b],modelStatus:spec.modelStatus,operatingFace:{degrees:spec.appearanceFrontDegrees,status:spec.operatingFaceStatus}};
 const body=new THREE.Group();body.rotation.y=-spec.appearanceFrontDegrees*Math.PI/180;root.add(body);const swap=Math.abs(Math.sin(body.rotation.y))>.7,w=(swap?sz:sx)*.90,d=(swap?sx:sz)*.82;
 if(spec.type==='boot-glove-water-test')waterBench(body,w,d);else if(spec.type==='power-frequency-system')powerFrequency(body,w,d);else if(spec.type==='voltage-detector-rack')detectorRack(body,w,d);else if(spec.type==='linear-support')linearSupport(body,w,d);else if(spec.type==='multifunction-console')multifunctionConsole(body,w,d);else if(spec.type==='circular-rod-platform')circularPlatform(body,w,d);else if(spec.type==='led-display-frame')ledDisplay(body,w,d);else unknownAux(body,w,d);
 root.updateMatrixWorld(true);return root;
}
