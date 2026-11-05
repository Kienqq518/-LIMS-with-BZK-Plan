import * as THREE from './vendor/three.module.js';
import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
import {finishes as M} from './equipment-106.js?rev=106-seating-v2';

const cyan=new THREE.MeshBasicMaterial({color:'#45c8e7',toneMapped:false});
const navy=new THREE.MeshBasicMaterial({color:'#102f46',toneMapped:false});
const pale=new THREE.MeshPhysicalMaterial({color:'#dce8ec',roughness:.34,metalness:.08});
const paper=[0x49b9dd,0x8ecfe3,0xf0f4f6,0x3f7192,0xaadbe8].map(color=>new THREE.MeshBasicMaterial({color,toneMapped:false}));
function box(p,w,h,d,x,y,z,m=M.white,r=.008){const v=new THREE.Mesh(new RoundedBoxGeometry(Math.max(w,.006),Math.max(h,.006),Math.max(d,.006),2,Math.min(r,w/5,h/5,d/5)),m);v.position.set(x,y,z);v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function cyl(p,r,h,x,y,z,m=M.steel){const v=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,18),m);v.position.set(x,y,z);v.castShadow=v.receiveShadow=true;p.add(v);return v;}
function texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function plane(p,w,h,x,y,z,material){const v=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);v.position.set(x,y,z);v.rotation.y=Math.PI;v.castShadow=false;p.add(v);return v;}

function controller(p,x,z,w=.19,h=.16,d=.18,index=0){
 const body=box(p,w,h,d,x,.88+h/2,z,index%3===0?M.dark:index%3===1?pale:M.white,.012);
 box(p,w*.72,.035,.008,x,.91+h*.55,z+d/2+.005,index%2?cyan:navy,.003);
 for(let i=0;i<4;i++)box(p,.018,.018,.006,x-w*.28+i*w*.18,.91+h*.15,z+d/2+.007,i===0?M.red:cyan,.002);
 if(index%2===0)for(const sx of[-1,1])box(p,.022,.06,.018,x+sx*w*.43,.91+h*.20,z+d/2+.012,M.steel,.002);
 body.userData.component='industrial-control-module';
}
function exhibitionTable(p,w,d,variant){
 box(p,w,.09,d,0,.78,0,M.white,.018);
 box(p,w*.96,.045,d*.88,0,.84,0,pale,.012);
 box(p,w*.94,.12,.045,0,.70,d*.46,navy,.008);
 box(p,w*.28,.65,d*.72,-w*.31,.405,0,M.white,.025);
 box(p,w*.28,.65,d*.72,w*.31,.405,0,M.white,.025);
 for(const x of[-w*.43,w*.43])for(const z of[-d*.36,d*.36])cyl(p,.025,.70,x,.38,z,M.steel);
 const xs=[-.36,-.12,.12,.36].map(v=>v*w),zs=[-.22,.18].map(v=>v*d);
 let k=variant*8;for(const z of zs)for(const x of xs){controller(p,x,z,.16+(k%3)*.025,.11+(k%4)*.025,.14+(k%2)*.035,k);k++;}
 box(p,w*.30,.075,.14,-w*.28,.93,-d*.33,M.dark,.008);
 box(p,w*.26,.075,.14,w*.30,.93,-d*.33,M.blue,.008);
}
function brochureRack(p,w){
 const depth=.22;
 box(p,w*.94,1.46,.055,0,.76,-.005,M.white,.018);
 box(p,w,.12,.28,0,.07,.10,M.steel,.018);
 box(p,w*.96,.055,.06,0,1.49,.02,navy,.006);
 for(let row=0;row<4;row++){
  const y=.34+row*.29;
  const shelf=box(p,w*.90,.035,depth,0,y,.075,M.steel,.005);shelf.rotation.x=-.18;
  box(p,w*.90,.07,.025,0,y-.04,.185,cyan,.003);
  for(let col=0;col<5;col++){
   const px=(col-2)*w*.17,leaf=box(p,w*.135,.205,.012,px,y+.105,.16,paper[(row+col)%paper.length],.002);
   leaf.rotation.x=-.18;
   box(p,w*.08,.012,.014,px,y+.13,.17,navy,.002);
  }
 }
 box(p,w*.72,.09,.018,0,1.36,.045,navy,.004);
 for(let i=0;i<5;i++)box(p,.04,.018,.02,(i-2)*w*.12,1.36,.058,cyan,.002);
}
function mainScreenTexture(){return texture(2048,1024,(x,w,h)=>{
 const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'#06283f');g.addColorStop(.52,'#0a5c7d');g.addColorStop(1,'#071f35');x.fillStyle=g;x.fillRect(0,0,w,h);
 x.strokeStyle='rgba(91,222,246,.34)';x.lineWidth=3;for(let i=0;i<14;i++){x.beginPath();x.moveTo(i*170,0);x.lineTo(i*120+250,h);x.stroke();}
 x.fillStyle='#ecfbff';x.font='700 92px "PingFang SC",sans-serif';x.fillText('未来实验室体验中心',92,130);
 x.fillStyle='#84e5f6';x.font='34px sans-serif';x.fillText('FUTURE LAB EXPERIENCE CENTER',96,182);
 x.fillStyle='#d9f7fb';x.font='32px "PingFang SC",sans-serif';x.fillText('全流程试验能力 · 数智化协同 · 无人化检测',96,245);
 const cards=[['智能样品','样品登记 / 追溯'],['无人化电缆','自动上下料 / 检测'],['环境试验','温湿度 / 老化'],['综合试验','多专业协同']];
 cards.forEach((c,i)=>{const px=94+i*455;x.fillStyle='rgba(220,248,252,.10)';x.strokeStyle='#48c8e2';x.lineWidth=2;x.beginPath();x.roundRect(px,292,410,165,20);x.fill();x.stroke();x.fillStyle='#eafcff';x.font='600 34px "PingFang SC",sans-serif';x.fillText(c[0],px+28,350);x.fillStyle='#9bdceb';x.font='26px "PingFang SC",sans-serif';x.fillText(c[1],px+28,405);});
 x.fillStyle='#f4fcff';x.font='600 34px "PingFang SC",sans-serif';x.fillText('101—110 功能区域',96,535);
 const rooms=['101 展厅','102 样品','103 力学','104 控制','105 高压','106 电缆','107 材料','108 环境','109 综合','110 电气'];
 rooms.forEach((r,i)=>{const col=i%5,row=Math.floor(i/5),px=96+col*365,py=575+row*116;x.fillStyle=i===5?'#41bdd8':'rgba(255,255,255,.12)';x.beginPath();x.roundRect(px,py,325,78,12);x.fill();x.fillStyle='#f1fcff';x.font='28px "PingFang SC",sans-serif';x.fillText(r,px+24,py+50);});
 x.strokeStyle='#62d8ee';x.lineWidth=5;x.beginPath();x.moveTo(96,870);x.lineTo(1890,870);x.stroke();
 x.fillStyle='#bfeef6';x.font='27px "PingFang SC",sans-serif';x.fillText('技术路线：数据贯通  →  自动执行  →  智能分析  →  质量闭环',96,932);
});}
function infoTexture(title,items){return texture(640,1024,(x,w,h)=>{
 x.fillStyle='#edf5f7';x.fillRect(0,0,w,h);x.fillStyle='#16465d';x.font='700 54px "PingFang SC",sans-serif';x.fillText(title,48,100);x.fillStyle='#39a9c4';x.fillRect(48,132,w-96,8);
 items.forEach((s,i)=>{const y=230+i*180;x.fillStyle='#d6e9ee';x.beginPath();x.roundRect(44,y-62,w-88,122,16);x.fill();x.fillStyle='#1c5369';x.font='600 31px "PingFang SC",sans-serif';x.fillText(('0'+(i+1)).slice(-2)+'  '+s,72,y+10);});
 x.fillStyle='#5d8797';x.font='24px "PingFang SC",sans-serif';x.fillText('FUTURE LAB · TECHNOLOGY EXHIBITION',48,h-54);
});}
function mediaWall(p,w,d){
 box(p,w*.99,2.34,Math.max(d,.07),0,1.18,0,M.white,.016);
 box(p,w*.96,2.20,.035,0,1.20,-.055,pale,.004);
 const sw=w*.66,sh=1.62,screenMat=new THREE.MeshBasicMaterial({map:mainScreenTexture(),toneMapped:false,side:THREE.DoubleSide});
 box(p,sw+.10,sh+.10,.065,0,1.24,-.09,M.dark,.018);plane(p,sw,sh,0,1.24,-.128,screenMat);
 const sideW=w*.125,sideH=1.82;
 const leftMat=new THREE.MeshBasicMaterial({map:infoTexture('企业能力',['模块化试验','数字化管理','无人化执行','智能化分析']),toneMapped:false,side:THREE.DoubleSide});
 const rightMat=new THREE.MeshBasicMaterial({map:infoTexture('技术路线',['感知互联','过程协同','智能决策','质量闭环']),toneMapped:false,side:THREE.DoubleSide});
 const sx=sw/2+sideW/2+.12;box(p,sideW+.05,sideH+.06,.045,-sx,1.23,-.08,M.steel,.008);plane(p,sideW,sideH,-sx,1.23,-.108,leftMat);
 box(p,sideW+.05,sideH+.06,.045,sx,1.23,-.08,M.steel,.008);plane(p,sideW,sideH,sx,1.23,-.108,rightMat);
 box(p,w*.94,.035,.10,0,.18,-.08,cyan,.003);
}
function panel(p,w,d){box(p,w*.80,1.10,d*.62,0,.78,0,M.white,.014);box(p,w*.66,.55,.012,0,.84,d*.32,M.dark,.005);for(let y=0;y<3;y++)for(let x=0;x<3;x++)cyl(p,.017,.009,(x-1)*w*.16,.75+(y-1)*.13,d*.33,(x+y)%2?M.blue:M.red);}

export function create101Model(e,spec){
 const b=e.rotatedBBox,w=(b[2]-b[0])*.05*.94,d=(b[3]-b[1])*.05*.94,root=new THREE.Group();
 root.name=e.id;root.position.set((b[0]+b[2])*.025,0,(b[1]+b[3])*.025);root.userData={id:e.id,name:spec.displayName,cadName:spec.cadName,modelStatus:spec.modelStatus,operatingFace:{degrees:spec.appearanceFrontDegrees,status:spec.operatingFaceStatus}};
 if(spec.type==='exhibition-table-section')exhibitionTable(root,w,d,e.id==='101-01'?0:1);
 else if(spec.type==='brochure-rack')brochureRack(root,w);
 else if(spec.type==='media-display-wall')mediaWall(root,w,d);
 else if(spec.type==='power-panel')panel(root,w,d);
 else{box(root,w,.05,d,0,.026,0,navy,.003);box(root,w*.72,.012,d*.55,0,.058,0,cyan,.002);}
 root.updateMatrixWorld(true);return root;
}
