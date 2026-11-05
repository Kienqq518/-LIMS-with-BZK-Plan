// Independent 108 V1 module; frozen 106/107 factories and materials are imported, never edited.
import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {finishes as M,create106Model} from './equipment-106.js?rev=106-seating-v2';
import {create107Model} from './equipment-107.js?rev=107-structure-v1c';
function box(p,w,h,d,x,y,z,m=M.white,r=.009){const v=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/5,h/5,d/5)),m);v.position.set(x,y,z);v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function cyl(p,r,h,x,y,z,m=M.steel,axis='y'){const v=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),m);v.position.set(x,y,z);if(axis==='x')v.rotation.z=Math.PI/2;if(axis==='z')v.rotation.x=Math.PI/2;v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function feet(p,w,d){for(const x of [-1,1])for(const z of [-1,1]){cyl(p,.025,.09,x*w*.37,.06,z*d*.36);cyl(p,.035,.025,x*w*.37,.014,z*d*.36,M.rubber);}}
function screen(p,w,x,y,z){box(p,w,.13,.025,x,y,z,M.dark);box(p,w*.84,.1,.003,x,y,z+.015,M.blue,.002);}
function badge(p,id,w,d,h){const c=document.createElement('canvas');c.width=400;c.height=110;const ctx=c.getContext('2d');ctx.fillStyle='#eef1f1';ctx.fillRect(0,0,400,110);ctx.fillStyle='#315469';ctx.font='35px sans-serif';ctx.fillText(id,20,46);ctx.font='21px sans-serif';ctx.fillText('V1 / SIMPLIFIED',20,86);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;box(p,Math.min(.32,w*.6),.088,.002,0,h,d/2+.002,new THREE.MeshBasicMaterial({map:t,toneMapped:false}),.001);}
function aging(p,w,d,H,id){feet(p,w,d);box(p,w,H-.13,d,0,(H+.13)/2,0,M.white,.035);box(p,w*.83,H*.77,.018,0,H*.49,d/2+.004,M.dark,.015);box(p,w*.77,H*.72,.025,0,H*.49,d/2+.018,M.white,.014);box(p,.021,.23,.028,w*.29,H*.46,d/2+.042,M.steel);for(const y of [.32,H*.72])box(p,.038,.07,.024,-w*.36,y,d/2+.028,M.steel);
 box(p,w*.94,.025,.015,0,.24,d/2+.026,M.blue,.002);screen(p,Math.min(.19,w*.26),w*.20,H-.24,d/2+.036);for(let i=0;i<5;i++)box(p,w*.30,.008,.004,-w*.19,.16+i*.015,d/2+.025,M.inner,.001);badge(p,id,w,d,.72);}
function weights(p,w,d,H,id){feet(p,w,d);box(p,w,.62,d,0,.43,0,M.white,.03);box(p,w*.94,.025,.014,0,.69,d/2+.012,M.blue);box(p,w,.04,d,0,.77,0,M.steel);for(const x of [-1,1])box(p,w*.085,H-.79,d,x*w*.457,.79+(H-.79)/2,0,M.white);box(p,w*.84,H-.79,.035,0,.79+(H-.79)/2,-d/2+.018,M.white);box(p,w,.31,d,0,H-.155,0,M.white,.025);screen(p,Math.min(.22,w*.29),w*.08,H-.18,d/2+.015);box(p,w*.67,.025,d*.6,0,.80,d*.07,M.light);box(p,w*.48,.012,d*.28,0,.82,d*.10,M.dark);box(p,.018,.17,.02,w*.31,.42,d/2+.014,M.steel);badge(p,id,w,d,.57);}
function display(p,w,d,H){const sw=Math.min(1.44,w*.92),sh=sw*9/16;for(const x of [-1,1]){box(p,.045,H-sh-.08,.04,x*sw*.25,(H-sh-.08)/2+.08,0,M.steel);box(p,w*.35,.045,d*.8,x*w*.22,.06,0,M.dark);}box(p,sw+.035,sh+.035,.045,0,H-sh/2,0,M.dark,.014);box(p,sw,sh,.005,0,H-sh/2,.026,M.black,.002);}
function dimension(p,w,d,H,id){feet(p,w,d);box(p,w,.60,d,0,.4,0,M.white,.02);box(p,w*.97,.03,d*.97,0,.72,0,M.steel);box(p,w*.66,.02,d*.57,0,.75,d*.06,M.dark);box(p,.055,H-.77,.07,-w*.27,(H+.77)/2,-d*.25,M.steel);box(p,w*.30,.10,d*.22,-w*.12,H-.09,-d*.23,M.dark);screen(p,Math.min(.16,w*.3),w*.20,.51,d/2+.016);badge(p,id,w,d,.30);}
function sourceBBox(g,ii){const ps=ii.flatMap(i=>g.trace[i].points);return [Math.min(...ps.map(p=>p[0])),Math.min(...ps.map(p=>p[1])),Math.max(...ps.map(p=>p[0])),Math.max(...ps.map(p=>p[1]))];}
export function create108Model(e,spec,g){const b=e.rotatedBBox,X=(b[0]+b[2])*.025,Z=(b[1]+b[3])*.025,sx=(b[2]-b[0])*.05,sz=(b[3]-b[1])*.05;
 if(spec.type==='workbench'){
  const root=new THREE.Group();root.name=e.id;root.position.set(X,0,Z);root.userData={id:e.id,modelStatus:spec.modelStatus};
  const widthX=spec.desktopWidthPathIndices.map(i=>g.trace[i].points[0][0]),deskBBox=[Math.min(...widthX),b[1],Math.max(...widthX),b[3]];
  const desk=create107Model({...e,rotatedBBox:deskBBox,orientation:{...e.orientation,rotatedViewDegrees:270}},{type:'bench',modelStatus:spec.modelStatus,match:spec.match});desk.position.sub(root.position);for(const child of desk.children){child.scale.x*=.96;child.scale.z*=.96;}root.add(desk);
  for(const v of spec.subassemblies){const q=sourceBBox(g,v.pathIndices),w=(q[2]-q[0])*.05*.84,d=(q[3]-q[1])*.05*.84,x=(q[0]+q[2])*.025-X,z=(q[1]+q[3])*.025-Z;
   if(v.componentIndex===17){box(root,w,.018,d,x,.79,z,M.dark);box(root,.02,.15,.025,x,.87,z,M.steel);box(root,.022,.30,d*.95,x,1.09,z,M.dark);box(root,.003,.27,d*.88,x+.013,1.09,z,M.black,.001);}
   else if(v.componentIndex===23)box(root,w,.028,d,x,.799,z,M.dark,.02);
   else if(v.componentIndex===18)box(root,w,.014,d,x,.794,z,M.dark);
   else if(v.componentIndex===19)box(root,w,.005,d,x,.804,z,M.inner,.002);
   else{box(root,w,.10,d,x,.83,z,M.light);for(let k=0;k<4;k++)box(root,w*.65,.003,d*.05,x,.882,z+(k-1.5)*d*.14,M.dark,.001);}
  }
  const cb=sourceBBox(g,spec.seatPathIndices),seat=create106Model({...e,rotatedBBox:cb,orientation:{...e.orientation,rotatedViewDegrees:90}},{type:'chair'});seat.userData.id=e.id;seat.position.sub(root.position);root.add(seat);root.updateMatrixWorld(true);return root;
 }
 if(spec.type==='rack'){const m=create106Model({...e,orientation:{...e.orientation,rotatedViewDegrees:spec.appearanceFrontDegrees}},{type:'rack'});for(const child of m.children){child.scale.x*=.94;child.scale.z*=.94;}m.updateMatrixWorld(true);m.userData.modelStatus=spec.modelStatus;return m;}
 const root=new THREE.Group();root.name=e.id;root.position.set(X,0,Z);root.userData={id:e.id,sourceBBox:[...b],modelStatus:spec.modelStatus};if(spec.type==='outline')return root;
 const body=new THREE.Group();body.rotation.y=-spec.appearanceFrontDegrees*Math.PI/180;root.add(body);const swap=Math.abs(Math.sin(body.rotation.y))>.7,w=(swap?sz:sx)*.84,d=(swap?sx:sz)*.82,H=spec.heightMeters;
 if(spec.type==='aging')aging(body,w,d,H,e.id);else if(spec.type==='weights')weights(body,w,d,H,e.id);else if(spec.type==='display')display(body,w,d,H);else if(spec.type==='dimension')dimension(body,w,d,H,e.id);
 else if(spec.type==='platform'){
  // Deck follows the CAD convex outline, with conservative inset; no robot/AGV inferred.
  const sh=new THREE.Shape(e.envelope.map(p=>new THREE.Vector2((p[0]*.05-X)*.82,-(p[1]*.05-Z)*.82))),geo=new THREE.ExtrudeGeometry(sh,{depth:.065,bevelEnabled:false});geo.rotateX(-Math.PI/2);const deck=new THREE.Mesh(geo,M.light);deck.position.y=.20;deck.castShadow=deck.receiveShadow=true;root.add(deck);for(const x of [-1,1])for(const z of [-1,1])cyl(root,.035,.035,x*sx*.24,.06,z*sz*.24,M.rubber,'x');box(root,sx*.48,.09,sz*.48,0,.15,0,M.white);box(root,sx*.50,.025,sz*.50,0,.29,0,M.steel);
 }
 root.updateMatrixWorld(true);return root;
}
