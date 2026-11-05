import * as THREE from './vendor/three.module.js';import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';import {finishes as M} from './equipment-106.js?rev=106-seating-v2';
const copper=new THREE.MeshPhysicalMaterial({color:'#a8673c',roughness:.3,metalness:.75}),oil=new THREE.MeshPhysicalMaterial({color:'#273c49',roughness:.32,metalness:.38});function box(p,w,h,d,x,y,z,m=M.white,r=.008){const v=new THREE.Mesh(new RoundedBoxGeometry(Math.max(w,.006),Math.max(h,.006),Math.max(d,.006),2,Math.min(r,w/5,h/5,d/5)),m);v.position.set(x,y,z);v.castShadow=v.receiveShadow=true;p.add(v);return v;}function cyl(p,r,h,x,y,z,m=M.steel,axis='y'){const v=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),m);v.position.set(x,y,z);if(axis==='x')v.rotation.z=Math.PI/2;if(axis==='z')v.rotation.x=Math.PI/2;v.castShadow=v.receiveShadow=true;p.add(v);return v;}function torus(p,R,r,x,y,z,m=M.steel){const v=new THREE.Mesh(new THREE.TorusGeometry(R,r,12,44),m);v.rotation.x=Math.PI/2;v.position.set(x,y,z);v.castShadow=v.receiveShadow=true;p.add(v);return v;}function hmi(p,x,y,z){box(p,.20,.18,.035,x,y,z,M.dark,.005);box(p,.15,.12,.003,x,y+.006,z+.020,M.blue,.001);}
function multiBay(p,w,d){const bays=5,step=d/bays;box(p,w*.78,.10,d*.96,0,.10,0,M.steel,.006);for(const x of[-1,1])box(p,.055,.08,d*.94,x*w*.37,.20,0,M.dark,.003);for(let i=0;i<=bays;i++){const z=-d*.48+i*step;for(const x of[-1,1])box(p,.065,1.80,.065,x*w*.36,1.05,z,M.steel,.004);box(p,w*.76,.075,.07,0,1.91,z,M.steel,.004);}for(let i=0;i<bays;i++){const z=-d*.48+(i+.5)*step;box(p,w*.62,.065,step*.62,0,.38,z,M.white,.006);for(const x of[-1,1]){cyl(p,.036,.42,x*w*.20,.69,z,M.steel);box(p,.12,.12,.12,x*w*.20,.92,z,M.dark,.006);}box(p,w*.48,.07,.10,0,1.08,z,copper,.003);box(p,.10,.38,.10,0,1.33,z,M.steel,.004);hmi(p,-w*.47,.92,z);}}
function hydraulic(p,w,d){box(p,w*.74,.55,d*.68,0,.34,0,M.white,.015);cyl(p,w*.18,.58,-w*.20,.86,0,oil);cyl(p,w*.13,.42,w*.18,.78,-d*.12,M.steel);box(p,w*.56,.32,d*.12,0,.85,d*.28,M.dark,.006);for(let i=0;i<3;i++)cyl(p,.018,.01,(i-1)*w*.14,.88,d*.35,i===0?M.red:M.blue,'z');cyl(p,.022,w*.48,0,1.10,-d*.18,copper,'x');}
// 103-03 only: booklet PDF p16, printed p30, right-hand enclosed six-station machine.
// Keep the original radius, CAD pivot and root transform. No external console is added.
function ringRig(p,w,d){
 const r=Math.min(w,d)*.40, cageR=r*.94, top=2.08, sill=.43;
 const glass=new THREE.MeshPhysicalMaterial({color:'#b7d4dc',roughness:.13,metalness:.08,transparent:true,opacity:.19,depthWrite:false,side:THREE.DoubleSide,clearcoat:1,clearcoatRoughness:.10});
 const clamp=new THREE.MeshPhysicalMaterial({color:'#708591',roughness:.30,metalness:.68});
 const stationMat=new THREE.MeshPhysicalMaterial({color:'#417594',roughness:.33,metalness:.32});
 const machine=new THREE.Group();machine.name='103-03-six-station-mainframe';p.add(machine);
 // The base retains exactly the old 20-sided circular X/Z envelope, not the brochure dimensions.
 cyl(machine,r*.96,.04,0,.08,0,M.rubber);
 cyl(machine,r,.32,0,.24,0,M.white);
 cyl(machine,r*.965,.035,0,.4175,0,M.steel);
 torus(machine,r*.96,.010,0,.385,0,M.blue);
 cyl(machine,r*.86,.022,0,.446,0,M.inner);
 // Central core and six radial upper supports: abstract fixture structure, not an asserted mechanism.
 cyl(machine,r*.18,1.25,0,1.075,0,M.white);
 cyl(machine,r*.22,.07,0,.50,0,M.dark);
 cyl(machine,r*.20,.055,0,1.72,0,M.blue);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3, s=new THREE.Group();s.name='test-station-'+(i+1);
  s.position.set(Math.sin(a)*r*.51,0,Math.cos(a)*r*.51);s.rotation.y=a;machine.add(s);
  s.userData={station:i+1,role:'abstract-tool-clamping-test-module'};
  box(s,r*.36,.09,r*.34,0,.54,0,M.dark,.009);
  box(s,r*.31,.045,r*.31,0,.607,0,M.steel,.004);
  // Paired guide columns, travelling crosshead and opposed upper/lower clevis grips.
  for(const x of[-1,1]){
   cyl(s,.020,1.08,x*r*.125,1.17,-r*.075,M.silver);
   box(s,.055,.05,.09,x*r*.125,.66,-r*.075,clamp,.004);
  }
  box(s,r*.34,.09,.115,0,1.72,-r*.075,M.light,.006);
  cyl(s,.025,.36,0,1.485,-r*.075,M.steel);
  box(s,r*.28,.07,.105,0,1.295,-r*.075,stationMat,.005);
  box(s,.09,.10,.075,0,1.205,-r*.075,M.steel,.004);
  for(const x of[-1,1])box(s,.018,.10,.075,x*.045,1.125,-r*.075,clamp,.003);
  cyl(s,.018,.115,0,1.08,-r*.075,M.silver,'x');
  box(s,r*.23,.045,r*.22,0,.78,r*.025,stationMat,.005);
  for(const x of[-1,1])box(s,.022,.13,.065,x*.052,.86,r*.025,clamp,.003);
  cyl(s,.018,.14,0,.90,r*.025,M.silver,'x');
  // A slim test link conveys the load path; no detailed specimen or test dummy is asserted.
  cyl(s,.009,.17,0,.985,-r*.025,M.steel);
  const arm=box(machine,.055,.065,r*.60,Math.sin(a)*r*.40,1.78,Math.cos(a)*r*.40,M.light,.004);arm.rotation.y=a;
 }
 // Twelve transparent facets, metal mullions and a continuous upper/lower perimeter frame.
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6,b=(i+1)*Math.PI/6,mid=(a+b)/2;
  const x=Math.sin(a)*cageR,z=Math.cos(a)*cageR;
  const length=2*cageR*Math.sin(Math.PI/12), apothem=cageR*Math.cos(Math.PI/12);
  const bay=new THREE.Group();bay.name='guard-facet-'+(i+1);
  bay.position.set(Math.sin(mid)*apothem,0,Math.cos(mid)*apothem);bay.rotation.y=mid;machine.add(bay);
  box(machine,.038,top-sill,.038,x,(top+sill)/2,z,M.light,.004).rotation.y=a;
  box(bay,length-.036,top-sill-.18,.009,0,(top+sill)/2-.015,0,glass,.001).castShadow=false;
  box(bay,length,.085,.055,0,top-.0425,0,M.white,.005);
  box(bay,length,.045,.045,0,sill+.0225,0,M.light,.003);
  box(bay,length-.05,.012,.012,0,top-.093,.015,M.steel,.002);
  if(i%2===0){
   // Small integrated channel indicator, as visible above the brochure guard panels.
   box(bay,Math.min(.22,length*.70),.043,.012,0,top-.135,-.005,M.dark,.002);
   for(let n=0;n<3;n++)box(bay,.017,.009,.002,(n-1)*.034,top-.135,.002,n===2?M.blue:M.red,.001);
  }
  if(i===0||i===11){
   box(bay,.014,.17,.024,(i===0?-1:1)*(length/2-.055),1.14,.026,M.steel,.004);
  }
 }
 p.userData.appearanceRebuild={revision:'103-03-six-station-v1',reference:'booklet PDF16 / printed30 / right',stations:6,guardPanels:12,externalConsole:false,heightStatus:'photo-proportioned display height; confirm by measurement'};
}
function displayCabinet(p,w,d){box(p,w*.86,1.62,d*.76,0,.85,0,M.white,.018);box(p,w*.72,1.30,.018,0,.94,d*.39,M.window,.004);for(const y of[.50,.92,1.34])box(p,w*.68,.035,d*.60,0,y,0,M.steel,.003);for(const x of[-1,1])box(p,.025,1.26,.025,x*w*.23,.94,d*.405,M.steel,.002);}
function chair(p,z){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cyl(p,.017,.25,Math.cos(a)*.14,.09,z+Math.sin(a)*.14,M.steel,'x');}cyl(p,.035,.30,0,.28,z,M.steel);box(p,.38,.09,.38,0,.49,z,M.dark,.03);box(p,.38,.44,.09,0,.76,z+.15,M.dark,.04);}
function station(p,w,d){const z=-d*.19;box(p,w*.76,.55,d*.38,0,.35,z,M.white,.015);box(p,w*.82,.05,d*.42,0,.65,z,M.steel,.005);box(p,w*.40,.30,.04,0,.88,z-d*.08,M.dark,.006);box(p,w*.32,.23,.004,0,.89,z-d*.102,M.blue,.001);box(p,w*.34,.025,d*.13,0,.69,z+d*.10,M.dark,.004);chair(p,d*.28);}
function panel(p,w,d){box(p,w*.80,1.10,d*.62,0,.78,0,M.white,.014);box(p,w*.66,.55,.012,0,.84,d*.32,M.dark,.005);for(let y=0;y<3;y++)for(let x=0;x<3;x++)cyl(p,.017,.009,(x-1)*w*.16,.75+(y-1)*.13,d*.33,(x+y)%2?M.blue:M.red,'z');}
export function create103Model(e,spec){const b=e.rotatedBBox,w=(b[2]-b[0])*.05*.88,d=(b[3]-b[1])*.05*.88,root=new THREE.Group();root.name=e.id;root.position.set((b[0]+b[2])*.025,0,(b[1]+b[3])*.025);root.userData={id:e.id,name:spec.name,modelStatus:spec.modelStatus,operatingFace:{degrees:spec.appearanceFrontDegrees,status:spec.operatingFaceStatus}};if(spec.type==='multi-bay-mechanics')multiBay(root,w,d);else if(spec.type==='hydraulic-unit')hydraulic(root,w,d);else if(spec.type==='ring-test-rig')ringRig(root,w,d);else if(spec.type==='display-cabinet')displayCabinet(root,w,d);else if(spec.type==='operator-station'){station(root,w,d);root.scale.set(.68,1,.68);}else panel(root,w,d);root.updateMatrixWorld(true);return root;}
