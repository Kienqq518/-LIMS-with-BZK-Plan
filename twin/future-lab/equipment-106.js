/* Appearance only. CAD placement and footprint remain locked; reviewed operating-face corrections are separate. */
import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
const mat=(color,roughness=.36,metalness=.05,extra={})=>new THREE.MeshPhysicalMaterial({color,roughness,metalness,...extra});
export const finishes={white:mat('#edf0ef',.3,.09,{clearcoat:.3,clearcoatRoughness:.28}),light:mat('#d7dee1',.4,.18),steel:mat('#aab7bf',.25,.82),dark:mat('#25323c',.43,.35),black:mat('#1a242d',.46,.1),blue:mat('#246b9c',.28,.3),rubber:mat('#252d32',.82,0),window:mat('#204653',.12,.3,{transparent:true,opacity:.52,depthWrite:false,clearcoat:1}),inner:mat('#8d9ba2',.58,.4),red:mat('#ba4d39',.48,.05),silver:mat('#d0d9dd',.22,.9)};
function box(p,w,h,d,x,y,z,m,r=.012){const geo=r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/5,h/5,d/5)):new THREE.BoxGeometry(w,h,d);const mesh=new THREE.Mesh(geo,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;p.add(mesh);return mesh;}
function cyl(p,r,h,x,y,z,m,axis='y'){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24),m);mesh.position.set(x,y,z);if(axis==='x')mesh.rotation.z=Math.PI/2;if(axis==='z')mesh.rotation.x=Math.PI/2;mesh.castShadow=true;mesh.receiveShadow=true;p.add(mesh);return mesh;}
function rod(p,a,b,r,m){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),o=cyl(p,r,A.distanceTo(B),...(A.clone().add(B).multiplyScalar(.5).toArray()),m);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),B.clone().sub(A).normalize());return o;}
function controlTexture(id){const c=document.createElement('canvas');c.width=512;c.height=320;const t=c.getContext('2d');t.fillStyle='#132a3a';t.fillRect(0,0,512,320);t.fillStyle='#739cad';t.fillRect(28,38,52,5);t.font='22px sans-serif';t.fillStyle='#d8e5e8';t.fillText('LOCAL CONTROL',28,24);t.font='18px sans-serif';t.fillText(id,355,24);t.fillStyle='#27495b';t.fillRect(28,65,456,1);t.fillStyle='#4b819c';for(let y=94;y<250;y+=38){t.fillRect(28,y,122,5);t.fillStyle='#365b6d';t.fillRect(28,y+12,82,3);t.fillStyle='#4b819c';}t.strokeStyle='#6cabc1';t.lineWidth=2;t.beginPath();for(let i=0;i<13;i++){let x=195+i*22,y=168+Math.sin(i*.6)*35;i?t.lineTo(x,y):t.moveTo(x,y);}t.stroke();t.fillStyle='#96afba';t.font='14px sans-serif';t.fillText('LOCAL / MANUAL',28,294);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;}
function screen(p,w,h,x,y,z,id){box(p,w,h,.035,x,y,z,finishes.dark,.016);const m=new THREE.MeshBasicMaterial({map:controlTexture(id),toneMapped:false});box(p,w*.86,h*.8,.003,x,y,z+.019,m,.001);}
function feet(p,w,d,h=.12){for(const x of [-1,1])for(const z of [-1,1]){cyl(p,.032,h,x*(w/2-.065),h/2,z*(d/2-.065),finishes.steel);cyl(p,.045,.024,x*(w/2-.065),.012,z*(d/2-.065),finishes.rubber);}}
function handle(p,x,y,z,h=.15){box(p,.017,h,.018,x,y,z,finishes.steel,.005);}
function badge(p,id,x,y,z,w=.2){const c=document.createElement('canvas');c.width=384;c.height=90;const a=c.getContext('2d');a.fillStyle='#f0f2f2';a.fillRect(0,0,384,90);a.fillStyle='#27658b';a.fillRect(0,0,16,90);a.fillStyle='#314955';a.font='34px sans-serif';a.fillText(id,34,57);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;box(p,w,w*.234,.002,x,y,z,new THREE.MeshBasicMaterial({map:tex,toneMapped:false}),0);}
function vent(p,w,x,y,z){for(let i=0;i<6;i++)box(p,w,.006,.003,x,y+i*.018,z,finishes.inner,.001);}
function baseCabinet(p,w,d,H,id){feet(p,w,d);box(p,w*.98,.1,d*.98,0,.16,0,finishes.dark);box(p,w,.62,d,0,.51,0,finishes.white,.025);box(p,w*.99,.045,d,0,.84,0,finishes.steel,.009);box(p,w,.035,d*.018,0,.68,d/2+.016,finishes.blue,.003);for(let k=-1;k<=1;k+=2){box(p,w*.46,.46,.012,k*w*.245,.5,d/2+.001,finishes.white,.01);handle(p,k*w*.07,.55,d/2+.011);}vent(p,w*.25,-w*.23,.3,d/2+.011);badge(p,id,w*.22,.73,d/2+.012,Math.min(.24,w*.26));}
function cabinet(p,w,d,H,id,variant){baseCabinet(p,w,d,H,id);const top=.89,hood=H-top,fw=.036;
 // Open metal frame around a visible mechanism, closed with observation glazing.
 for(const x of [-1,1])for(const z of [-1,1])box(p,fw,hood,fw,x*(w/2-fw/2),top+hood/2,z*(d/2-fw/2),finishes.white,.006);
 box(p,w,.045,d,0,H-.025,0,finishes.white,.01);box(p,w*.94,hood*.87,.018,0,top+hood*.5,-d/2+.012,finishes.white,.003);
 for(const x of [-1,1])box(p,.013,hood*.84,d*.88,x*(w/2-.012),top+hood*.5,0,finishes.window,.002);
 box(p,w*.73,hood*.78,.013,-w*.075,top+hood*.48,d/2-.011,finishes.window,.006);handle(p,w*.245,top+hood*.46,d/2+.002,.19);
 box(p,w*.2,hood*.91,.025,w*.384,top+hood*.5,d/2-.004,finishes.white,.006);
 const sw=Math.min(.19,w*.16);screen(p,sw,sw*.72,w*.382,top+hood*.68,d/2+.023,id);
 cyl(p,.019,.014,w*.382,top+hood*.3,d/2+.024,finishes.red,'z');
 // Generic fixtures stay inside the original footprint; no claim of OEM mechanical identity.
 box(p,w*.72,.025,d*.68,0,top+.02,0,finishes.inner,.003);
 if(variant==='mechanical'){for(const x of [-1,1])cyl(p,.023,hood*.7,x*w*.22,top+hood*.39,0,finishes.silver);box(p,w*.6,.09,d*.18,0,top+hood*.68,0,finishes.light,.009);cyl(p,.025,hood*.42,0,top+hood*.36,0,finishes.steel);box(p,w*.16,.035,d*.23,0,top+.1,0,finishes.dark,.003);}
 else if(variant==='optical'){cyl(p,.023,hood*.56,-w*.18,top+hood*.33,-d*.1,finishes.silver);box(p,w*.23,.12,d*.24,-w*.04,top+hood*.57,-d*.1,finishes.dark,.01);box(p,w*.4,.04,d*.43,0,top+.08,d*.08,finishes.light,.006);}
 else {for(const x of [-1,1])rod(p,[x*w*.26,top+.08,-d*.23],[x*w*.26,top+.08,d*.23],.016,finishes.steel);box(p,w*.57,.09,d*.25,0,top+.08,-d*.05,finishes.dark,.006);cyl(p,.05,.1,w*.18,top+.15,d*.12,finishes.steel,'x');box(p,w*.3,.2,d*.22,-w*.11,top+.16,d*.05,finishes.blue,.01);}
}
function openBench(p,w,d,id,agv){const H=.89;feet(p,w,d);for(const x of [-1,1])for(const z of [-1,1])box(p,.055,.66,.055,x*(w/2-.06),.45,z*(d/2-.06),finishes.light,.007);box(p,w*.96,.075,.055,0,.25,-d/2+.06,finishes.light);box(p,w,.06,d,0,H,0,finishes.silver,.014);box(p,w,.08,.035,0,H-.07,d/2-.025,finishes.white,.005);badge(p,id,0,H-.065,d/2-.004,.24);
 if(agv){for(let k=0;k<2;k++){const cx=(k?1:-1)*w*.25;box(p,w*.43,.018,d*.72,cx,H+.037,0,finishes.dark,.015);for(const x of [-1,1])box(p,.018,.035,d*.72,cx+x*w*.2,H+.055,0,finishes.light,.004);for(const z of [-1,1])box(p,w*.4,.035,.018,cx,H+.055,z*d*.34,finishes.light,.004);}}
 else{box(p,w*.86,.014,d*.65,0,H+.037,0,finishes.dark,.006);for(const side of [-1,1])box(p,.018,.035,d*.7,side*w*.43,H+.05,0,finishes.steel,.002);}
}
function storage(p,w,d,id){const H=1.8;for(const x of [-1,1])for(const z of [-1,1])box(p,.036,H,.036,x*(w/2-.022),H/2,z*(d/2-.022),finishes.steel,.005);for(let i=0;i<5;i++)box(p,w,.035,d,0,.1+i*(H-.15)/4,0,finishes.light,.005);box(p,w,.12,.024,0,H-.04,d/2-.014,finishes.white,.005);badge(p,id,0,H-.04,d/2+.001,Math.min(.25,w*.6));}
function robot(p,w,d,id){const r=Math.min(w,d);box(p,w*.84,.25,d*.88,0,.2,0,finishes.white,.065);box(p,w*.86,.045,d*.88,0,.065,0,finishes.dark,.016);for(const x of [-1,1])for(const z of [-1,1])cyl(p,r*.075,.06,x*w*.36,.075,z*d*.35,finishes.rubber,'x');box(p,w*.65,.11,d*.6,0,.365,0,finishes.light,.025);const y=.46;const a=[0,y,0],b=[-w*.16,y+.24,-d*.12],c=[w*.11,y+.42,-d*.14],q=[w*.24,y+.32,d*.05];cyl(p,r*.115,.1,...a,finishes.dark);rod(p,a,b,r*.07,finishes.white);rod(p,b,c,r*.058,finishes.white);rod(p,c,q,r*.045,finishes.light);for(const v of [b,c])cyl(p,r*.075,r*.16,...v,finishes.dark,'x');box(p,r*.12,.06,r*.12,...q,finishes.dark,.004);screen(p,Math.min(w*.35,.2),.09,0,.22,d*.445,id);}
function desk(p,w,d,id){feet(p,w,d,.08);box(p,w,.04,d,0,.75,0,finishes.white,.02);for(const x of [-1,1])box(p,.035,.68,d*.82,x*(w/2-.05),.375,0,finishes.light,.006);box(p,w*.92,.18,.025,0,.57,-d*.36,finishes.white,.005);badge(p,id,0,.71,d/2+.002,.18);}
function chair(p,w,d){const r=Math.min(w,d);cyl(p,r*.38,.024,0,.06,0,finishes.dark);cyl(p,.024,.35,0,.24,0,finishes.steel);const swivel=new THREE.Group();swivel.name='seat-swivel';p.add(swivel);box(swivel,w*.86,.075,d*.53,0,.45,d*.1,finishes.dark,.035);box(swivel,w*.8,.44,.065,0,.68,-d*.18,finishes.dark,.035);for(const x of [-1,1])box(swivel,.035,.12,d*.32,x*w*.43,.57,d*.07,finishes.dark,.012);}
function small(p,w,d,id,measuring){feet(p,w,d,.07);box(p,w,.68,d,0,.41,0,finishes.white,.022);box(p,w,.035,d,0,.77,0,finishes.silver,.008);if(measuring){box(p,w*.6,.025,d*.56,0,.8,0,finishes.dark,.004);rod(p,[-w*.25,.82,-d*.2],[-w*.25,1.02,-d*.2],.015,finishes.steel);box(p,w*.32,.08,d*.19,-w*.09,1,-d*.19,finishes.dark,.005);}else{box(p,w*.78,.48,.014,0,.42,d/2+.002,finishes.window,.008);handle(p,w*.28,.44,d/2+.015);}badge(p,id,0,.7,d/2+.011,Math.min(w*.6,.23));}
export function create106Model(e,spec){const b=e.rotatedBBox;const spanX=(b[2]-b[0])*.05,spanZ=(b[3]-b[1])*.05;const root=new THREE.Group();root.name=e.id;root.position.set((b[0]+b[2])*.025,0,(b[1]+b[3])*.025);root.userData={id:e.id,sourceBBox:[...b],appearance:spec.type};const body=new THREE.Group();const theta=-e.orientation.rotatedViewDegrees*Math.PI/180;body.rotation.y=theta;root.add(body);const swap=Math.abs(Math.sin(theta))>.7;let w=swap?spanZ:spanX,d=swap?spanX:spanZ;w*=.994;d*=.994;
 if(spec.type==='outline')return root;
 if(spec.type==='agv-table'||spec.type==='loading-table')openBench(body,w,d,e.id,spec.type==='agv-table');
 else if(spec.type==='rack')storage(body,w,d,e.id);
 else if(spec.type==='robot')robot(body,w,d,e.id);
 else if(spec.type==='desk')desk(body,w,d,e.id);
 else if(spec.type==='chair')chair(body,w,d);
 else if(spec.type==='small-cabinet'||spec.type==='measurement')small(body,w,d,e.id,spec.type==='measurement');
 else cabinet(body,w,d,spec.height,e.id,spec.type);
 // A final fit only reduces modeled details to the exact locked X/Z rectangle. It never moves a source item.
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root);const actual=bounds.getSize(new THREE.Vector3());const sx=Math.min(1,spanX/2/Math.max(Math.abs(bounds.min.x-root.position.x),Math.abs(bounds.max.x-root.position.x))),sz=Math.min(1,spanZ/2/Math.max(Math.abs(bounds.min.z-root.position.z),Math.abs(bounds.max.z-root.position.z)));root.scale.set(sx,1,sz);root.updateMatrixWorld(true);
 applySeatFacing(root,spec);
 return applyOperatingFace(root,e,spec);
}

// Rotate the finished existing model, including its original fit, as one rigid object.
// Never regenerate width/depth, change scale, move the CAD pivot, or rotate CAD outlines.
function applyOperatingFace(model,e,spec){
 const review=spec.operatingFaceReview;
 if(!review)return model;
 const delta=review.appliedDeltaDegrees||0;
 model.userData.operatingFace={...review};
 if(!delta)return model;
 if(spec.type==='robot')throw new Error('Robot orientation is locked: '+e.id);
 const pivot=new THREE.Group();pivot.name=model.name;pivot.position.copy(model.position);
 pivot.userData={...model.userData};model.position.set(0,0,0);pivot.add(model);
 pivot.rotation.y=THREE.MathUtils.degToRad(delta);pivot.updateMatrixWorld(true);
 const bb=new THREE.Box3().setFromObject(pivot),b=e.rotatedBBox;
 const overflow=Math.max(0,b[0]*.05-bb.min.x,bb.max.x-b[2]*.05,b[1]*.05-bb.min.z,bb.max.z-b[3]*.05);
 if(overflow>1e-8){
  // A configuration mistake must preserve the original model instead of cropping/refitting it.
  pivot.remove(model);model.position.copy(pivot.position);model.updateMatrixWorld(true);
  model.userData.operatingFace={...review,appliedDeltaDegrees:0,status:'blocked-by-footprint',overflowMeters:overflow};
  return model;
 }
 return pivot;
}

// Seat articulation is independent of equipment orientation. The finished chair's
// base/post remain fixed; rotate only existing seat, backrest and armrests.
function applySeatFacing(model,spec){
 const review=spec.seatingFaceReview;if(!review)return;
 if(spec.type!=='chair')throw new Error('Seat correction on a non-chair: '+spec.id);
 const swivel=model.getObjectByName('seat-swivel');
 if(!swivel)throw new Error('Missing swivel group: '+spec.id);
 swivel.rotation.y=THREE.MathUtils.degToRad(review.appliedDeltaDegrees);
 model.userData.seatingFace={...review};model.updateMatrixWorld(true);
}
