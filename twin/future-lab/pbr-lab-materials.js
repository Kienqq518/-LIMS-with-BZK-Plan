import * as THREE from './vendor/three.module.js';
import {finishes} from './equipment-106.js?rev=106-seating-v2';

// The validated 106 V2 finish values, shared by every room. This file never edits source materials.
export const PBR_PRESETS=Object.freeze({
 paint:{roughness:.26,metalness:.035,clearcoat:.48,clearcoatRoughness:.19,envMapIntensity:.65},
 aluminium:{roughness:.29,metalness:.75,envMapIntensity:1.25},
 steel:{roughness:.24,metalness:.95,clearcoat:.15,envMapIntensity:1.5},
 silver:{roughness:.19,metalness:.95,clearcoat:.15,envMapIntensity:1.5},
 copper:{roughness:.23,metalness:.92,clearcoat:.18,envMapIntensity:1.25},
 panel:{roughness:.31,metalness:.18,clearcoat:.26,clearcoatRoughness:.21,envMapIntensity:.75},
 plastic:{roughness:.48,metalness:.02,clearcoat:.10,envMapIntensity:.45},
 rubber:{roughness:.82,metalness:0,clearcoat:0,envMapIntensity:.2},
 blue:{roughness:.25,metalness:.3,clearcoat:.4,envMapIntensity:.85},
 ceramic:{roughness:.27,metalness:.02,clearcoat:.35,clearcoatRoughness:.23,envMapIntensity:.7},
 inner:{roughness:.30,metalness:.72,envMapIntensity:1.1},
 wall:{roughness:.49,metalness:.025,clearcoat:.10,envMapIntensity:.45},
 floor:{roughness:.32,metalness:.06,clearcoat:.32,clearcoatRoughness:.28,envMapIntensity:.3},
 glass:{roughness:.045,metalness:0,ior:1.5,clearcoat:1,clearcoatRoughness:.035,envMapIntensity:1.65},
 screen:{roughness:.13,metalness:0,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:.65}
});

export const RENDER_TIERS=Object.freeze({
 panorama:{shadowSize:2048,reflectionSize:0,shadowRefresh:'view-change',reflection:'environment only'},
 room:{shadowSize:2048,reflectionSize:512,shadowRefresh:'view-change',reflection:'single shared planar pass'},
 inspection:{shadowSize:2048,reflectionSize:768,shadowRefresh:'view-change',reflection:'single shared planar pass'}
});

export function createMicroFinish(){
 const data=new Uint8Array(128*128*4);let seed=106;
 for(let i=0;i<data.length;i+=4){seed=(1664525*seed+1013904223)>>>0;data[i]=data[i+1]=data[i+2]=190+seed%48;data[i+3]=255;}
 const t=new THREE.DataTexture(data,128,128,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(10,10);t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t;
}

export function createLabEnvironment(renderer){
 // The 106 V2 lighting probe is offscreen only: it adds no fixture or ceiling to the lab.
 const scene=new THREE.Scene();scene.background=new THREE.Color().setRGB(.045,.055,.07);
 const owned=[];
 const panel=(w,h,x,y,z,rotation,intensity)=>{
  const g=new THREE.PlaneGeometry(w,h),m=new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(intensity,intensity*.99,intensity*.96),side:THREE.DoubleSide}),p=new THREE.Mesh(g,m);
  p.position.set(x,y,z);p.rotation.set(...rotation);scene.add(p);owned.push(g,m);
 };
 panel(14,22,0,4,0,[-Math.PI/2,0,0],.12);
 for(const x of[-3,0,3])panel(.35,14,x,3.98,0,[-Math.PI/2,0,0],10);
 panel(12,2.4,0,1,-7,[0,0,0],.3);panel(3,2.8,-6,1.2,0,[0,Math.PI/2,0],1.8);panel(2,2.8,6,1.2,0,[0,-Math.PI/2,0],.2);
 const pmrem=new THREE.PMREMGenerator(renderer),target=pmrem.fromScene(scene,.025,.1,60);pmrem.dispose();for(const o of owned)o.dispose();return target.texture;
}

export function classifySurface(original,{floor=false,architecture=false}={}){
 if(floor)return 'floor';
 // Keep all exhibition graphics, paper artwork and badges unlit and pixel-identical.
 if(original?.isMeshBasicMaterial)return original.map?.image?.width===512&&original.map?.image?.height===320?'screen':'graphic';
 if(!original?.isMeshPhysicalMaterial&&!original?.isMeshStandardMaterial)return 'unchanged';
 const key=Object.keys(finishes).find(k=>finishes[k]===original);
 const known={white:'paint',light:'aluminium',steel:'steel',silver:'silver',dark:'panel',black:'plastic',blue:'blue',rubber:'rubber',window:'glass',inner:'inner',red:'plastic'};
 if(known[key])return known[key];
 if(original.transparent&&original.opacity<.295)return 'glass';
 if(architecture&&original.transparent)return 'wall';
 const hsl={};original.color.getHSL(hsl);
 if(original.metalness>.6)return hsl.h<.13&&hsl.s>.2?'copper':'steel';
 if(hsl.l<.09)return 'panel';
 const rgb=original.color;
 if(hsl.l>.45&&rgb.r>rgb.b*1.05&&rgb.g>rgb.b*1.025&&original.metalness<.08)return 'ceramic';
 if(hsl.s>.18)return hsl.h>.48&&hsl.h<.68?'blue':'plastic';
 return architecture?'wall':'paint';
}

export class LabMaterialLibrary{
 constructor(renderer){this.environment=createLabEnvironment(renderer);this.micro=createMicroFinish();this.cache=new Map();this.counts={};}
 get(original,role){
  if(role==='graphic'||role==='unchanged')return original;
  let byRole=this.cache.get(original);if(!byRole){byRole=new Map();this.cache.set(original,byRole);}if(byRole.has(role))return byRole.get(role);
  const m=original.isMeshBasicMaterial?new THREE.MeshPhysicalMaterial({color:original.color,map:original.map,side:original.side}):original.clone();
  Object.assign(m,PBR_PRESETS[role]);m.name='lab-pbr-v1/'+role;m.envMap=this.environment;
  m.userData={...original.userData,labSurface:role};
  if(role==='paint'){m.color.set('#e3e7e4');m.bumpMap=this.micro;m.bumpScale=.00016;m.roughnessMap=this.micro;}
  if(role==='aluminium')m.color.set('#bfcbd0');
  if(role==='panel')m.color.set('#18212a');
  if(role==='inner')m.color.set('#778a96');
  if(role==='screen'){m.emissiveMap=original.map;m.emissive.set('#ffffff');m.emissiveIntensity=.16;}
  if(role==='floor'){m.color.set('#aeb9bf');m.transparent=false;m.opacity=1;m.depthWrite=true;m.bumpMap=this.micro;m.bumpScale=.0007;}
  if(role==='glass'){
   const observation=original===finishes.window,face=observation?.32:.15,edge=observation?.72:.52;
   m.color.set(observation?'#aecbd0':'#c1dbdf');m.transparent=true;m.opacity=face;m.depthWrite=false;m.forceSinglePass=true;
   m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>\nfloat labEdge=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),4.);\ngl_FragColor.a=mix(${face},${edge},labEdge);`);};
   m.customProgramCacheKey=()=> 'lab-glass-v1-'+face;
  }
  byRole.set(role,m);this.counts[role]=(this.counts[role]||0)+1;return m;
 }
}
