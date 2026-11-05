// 107 V1: appearance only. Every pivot/footprint comes from the immutable DWG JSON.
import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {finishes as M,create106Model} from './equipment-106.js?rev=106-seating-v2';
function box(p,w,h,d,x,y,z,m=M.white,r=.012){const a=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/5,h/5,d/5)),m);a.position.set(x,y,z);a.castShadow=a.receiveShadow=true;p.add(a);return a;}
function cylinder(p,r,h,x,y,z,m=M.steel){const a=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,20),m);a.position.set(x,y,z);a.castShadow=a.receiveShadow=true;p.add(a);return a;}
function label(p,id,w,d,H){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#edf0ef';ctx.fillRect(0,0,512,128);ctx.fillStyle='#246b9c';ctx.fillRect(0,0,14,128);ctx.font='bold 40px sans-serif';ctx.fillStyle='#29414f';ctx.fillText(id,32,52);ctx.font='25px sans-serif';ctx.fillText('V1 / SIMPLIFIED',32,98);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;box(p,Math.min(w*.52,.4),.1,.002,0,H,d/2-.02,new THREE.MeshBasicMaterial({map:t,toneMapped:false}),.001);}
function screen(p,x,y,z,w=.19){box(p,w,.14,.028,x,y,z,M.dark,.012);box(p,w*.85,.11,.004,x,y,z+.016,M.blue,.003);for(let i=0;i<3;i++)box(p,w*.5,.005,.005,x-.01,y+.025-i*.023,z+.019,M.light,.001);}
function feet(p,w,d){for(const x of [-1,1])for(const z of [-1,1]){cylinder(p,.027,.10,x*w*.39,.07,z*d*.38);cylinder(p,.04,.025,x*w*.39,.015,z*d*.38,M.rubber);}}
function plinth(p,w,d,h=.30){feet(p,w,d);box(p,w*.92,h,d*.9,0,.12+h/2,0,M.white,.035);box(p,w*.91,.045,d*.89,0,.12+h,0,M.blue,.006);}
function grip(p,x,y,z,w){box(p,w,.10,.08,x,y,z,M.dark,.009);box(p,w*.72,.04,.05,x,y+.045,z+.025,M.steel,.003);}
function tensile(p,w,d,H,hydraulic){const base=.42;plinth(p,w,d,.28);const top=H-.08,half=w*.31;
 for(const x of [-half,half]){cylinder(p,hydraulic?.032:.023,top-base,x,(base+top)/2,-d*.04);box(p,.065,.065,d*.25,x,base,-d*.04,M.light);}
 box(p,w*.83,.12,d*.43,0,top,-d*.04,M.white,.025);box(p,w*.77,.09,d*.33,0,H*.61,-d*.04,M.light);box(p,w*.72,.06,d*.38,0,base+.04,-d*.04,M.steel);
 grip(p,0,H*.59,-d*.04,w*.18);grip(p,0,base+.16,-d*.04,w*.18);cylinder(p,.015,H*.25,0,H*.43,-d*.04,M.steel);
 if(hydraulic){cylinder(p,.085,.25,0,base+.025,-d*.04,M.dark);cylinder(p,.035,.22,0,base+.19,-d*.04,M.silver);box(p,w*.3,.18,d*.4,-w*.22,.23,0,M.blue);}
 else{for(const x of [-1,1])box(p,.025,.68,.025,x*w*.34,H*.45,d*.06,M.dark,.003);}
 box(p,w*.28,.25,.08,w*.27,.56,d*.25,M.white);screen(p,w*.27,.61,d*.25+.05,Math.min(.17,w*.24));
}
function dual(p,w,d,H,measuring){plinth(p,w,d,.48);const low=.65,span=H-low;
 box(p,w*.96,.06,d*.92,0,H-.02,0,M.white,.02);box(p,w*.96,span,d*.06,0,low+span/2,-d*.42,M.white);
 for(const x of [-1,1])box(p,.055,span,d*.9,x*w*.45,low+span/2,0,M.white,.009);
 const pane=box(p,w*.73,span*.79,.013,-w*.06,low+span*.48,d*.45,M.window,.007);pane.castShadow=false;
 box(p,w*.18,span,.035,w*.38,low+span/2,d*.43,M.white);screen(p,w*.38,low+span*.75,d*.45+.013,Math.min(.15,w*.15));
 box(p,w*.83,.04,d*.7,0,low+.04,0,M.steel);
 for(const x of [-w*.23,w*.13]){for(const side of [-1,1])cylinder(p,.013,span*.64,x+side*w*.095,low+span*.4,0,M.steel);box(p,w*.25,.055,d*.2,x,low+span*.65,0,M.light);grip(p,x,low+span*.54,.015,w*.12);grip(p,x,low+.13,.015,w*.12);}
 if(measuring){box(p,w*.17,.12,d*.15,-w*.21,low+span*.38,d*.12,M.dark);cylinder(p,.012,span*.5,-w*.33,low+span*.3,d*.12);}
 box(p,w*.86,.025,.012,0,.59,d*.45+.002,M.blue,.002);
}
function vicat(p,w,d,H){plinth(p,w,d,.48);const top=.65;box(p,w*.93,.045,d*.88,0,top,0,M.steel,.02);box(p,w*.75,.018,d*.65,0,top+.032,0,M.light,.008);box(p,w*.39,.035,d*.2,-w*.12,top+.045,0,M.dark);
 for(const x of [-w*.18,w*.13]){cylinder(p,.012,H-top-.08,x,(H+top)/2,-d*.1);cylinder(p,.028,.028,x,H-.03,-d*.1,M.dark);box(p,.06,.055,.05,x,H-.10,-d*.1,M.light,.005);}
 box(p,w*.31,.2,d*.26,w*.28,.76,d*.25,M.white);screen(p,w*.28,.78,d*.38,Math.min(.15,w*.27));}
export function create107Model(e,spec){
 // Existing 106 bench component is reused unchanged; no added tabletop instruments.
 if(spec.type==='bench'){const root=create106Model(e,{type:'desk'});root.name=e.id;root.userData={...root.userData,modelStatus:spec.modelStatus,reference:spec.match,heightMeters:.77};return root;}
 const b=e.rotatedBBox,sx=(b[2]-b[0])*.05,sz=(b[3]-b[1])*.05,root=new THREE.Group();root.name=e.id;root.position.set((b[0]+b[2])*.025,0,(b[1]+b[3])*.025);
 root.userData={id:e.id,sourceBBox:[...b],modelStatus:spec.modelStatus,reference:spec.match,heightMeters:spec.heightMeters};
 const body=new THREE.Group(),theta=-spec.appearanceFrontDegrees*Math.PI/180;body.rotation.y=theta;root.add(body);const swap=Math.abs(Math.sin(theta))>.7,w=(swap?sz:sx)*.94,d=(swap?sx:sz)*.94;
 if(spec.type==='vicat')vicat(body,w,d,spec.heightMeters);
 else if(spec.type==='hydraulic'||spec.type==='tensile')tensile(body,w,d,spec.heightMeters,spec.type==='hydraulic');
 else dual(body,w,d,spec.heightMeters,spec.type==='dual-measure');
 label(body,e.id,w,d,spec.type==='vicat'?.41:.30);
 root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root);if(bounds.min.x<b[0]*.05-1e-7||bounds.max.x>b[2]*.05+1e-7||bounds.min.z<b[1]*.05-1e-7||bounds.max.z>b[3]*.05+1e-7)throw new Error(e.id+' exceeds locked footprint');
 return root;
}
