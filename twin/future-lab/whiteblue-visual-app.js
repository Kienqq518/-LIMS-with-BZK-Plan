import {Visual106} from './visual-106-whiteblue.js';
import {RealisticLab} from './render-lab-realistic.js?rev=lab-realistic-v1c';
import {installBrand101} from './iot/brand-101.js?rev=iot-v1.1';
let visual,last='overall-101';
const $=selector=>document.querySelector(selector);
const roomIds=['101','102','103','104','105','106','107','108','109','110'];
const visualRoomIds=roomIds.filter(id=>id!=='106');
const roomNames={
  101:'接待大厅',
  102:'智能样品室',
  103:'智能力学室',
  104:'控制室',
  105:'智能高压室',
  106:'无人化电缆试验区',
  107:'材料试验区',
  108:'环境试验区',
  109:'综合试验区',
  110:'数智化电气试验区'
};

const roomViews={
  101:[
    ['101-close','斜俯视'],
    ['101-top','正俯视'],
    ['101-entry','入口视角'],
    ['101-wall','宣传展示墙']
  ],
  102:[['102-close','斜俯视'],['102-top','正俯视']],
  103:[['103-close','斜俯视'],['103-top','正俯视']],
  104:[['104-close','斜俯视'],['104-top','正俯视']],
  105:[['105-close','斜俯视'],['105-top','正俯视']],
  106:[
    ['close','斜俯视'],
    ['local-top','正俯视'],
    ['detail','设备近景'],
    ['seating','座椅近景'],
    ['render-device','检测设备材质近景'],
    ['render-glass','玻璃与地面近景']
  ],
  107:[['107-close','斜俯视'],['107-top','正俯视']],
  108:[['108-close','斜俯视'],['108-top','正俯视']],
  109:[['109-close','斜俯视'],['109-top','正俯视']],
  110:[['110-close','斜俯视'],['110-top','正俯视']]
};

function currentRoom(view=last){
  if(['close','detail','seating','local-top','render-device','render-glass'].includes(view))return '106';
  return visualRoomIds.find(id=>view.startsWith(id+'-'))||'';
}

function viewTitle(view=last){
  if(view==='overall-101')return '107方向斜俯视';
  if(view==='top')return '正俯视';
  const rid=currentRoom(view);
  return (roomViews[rid]||[]).find(([id])=>id===view)?.[1]||'斜俯视';
}

function isConfirmedName(item,spec){
  const evidence=[spec?.match,spec?.modelStatus,spec?.evidence,spec?.note].filter(Boolean).join(' ');
  const candidate=spec?.displayName||item?.nameIfReadable||'';
  if(!candidate||candidate===item?.id)return false;
  if(item?.roomId==='101')return /本轮.*确认|CAD明确|原CAD设备名称/.test(evidence);
  return !/待核|待确认|无法确认|同类参考|类别简模|简模|原\s*CAD|辅助构件|原图\s*[A-Z]|轮廓|独立设备|未命名|位置\s*[A-Z]/i.test(evidence+' '+candidate);
}

function devicePresentationName(item){
  if(!item)return '';
  if(window.labEquipmentNames?.has(item.id))return window.labEquipmentNames.get(item.id);
  const room=visual?.['room'+item.roomId];
  const label=room?.labels?.find(entry=>entry.e?.id===item.id);
  const spec=label?.spec;
  const name=(spec?.displayName||item.nameIfReadable||'').replace(/^原图\s*/,'');
  return isConfirmedName(item,spec)&&name?name:item.id;
}

function applyPresentationLabels(){
  if(!visual)return;
  for(const rid of roomIds){
    for(const label of visual['room'+rid]?.labels||[]){
      const name=devicePresentationName(label.e);
      label.div.textContent=name===label.e.id?label.e.id:label.e.id+' · '+name;
      label.div.title=name;
    }
  }
}

function syncSelectors(){
  const rid=currentRoom();
  $('#room-focus').value=rid;
  const options=rid?roomViews[rid]:[['overall-101','107方向斜俯视'],['top','正俯视']];
  const select=$('#view-focus');
  select.replaceChildren(...options.map(([value,label])=>{
    const option=document.createElement('option');
    option.value=value;
    option.textContent=label;
    return option;
  }));
  if(options.some(([value])=>value===last))select.value=last;
}


// Render-only adapter: keep the existing PBR implementation and inspection cameras,
// without installing material comparison, export or engineering controls on this page.
class DisplayRealisticLab extends RealisticLab{
 installControl(){const native=this.v.setView.bind(this.v);this.v.setView=view=>{this.inspection=view.startsWith('render-')?view:null;native(view==='render-device'?'detail':view==='render-glass'?'seating':view);if(view==='render-device'){this.v.yaw=-.78;this.v.elev=.43;this.v.render();}this.audit();};}
}
function statusForView(){const rid=currentRoom();return{room:rid,roomLabel:rid?rid+' '+roomNames[rid]:'101—110 全实验室',viewLabel:viewTitle(),view:last,options:[...$('#view-focus').options].map(o=>({value:o.value,label:o.textContent}))};}
function setView(view){last=view;window.dispatchEvent(new CustomEvent('lab-view-change',{detail:view}));visual?.setView(view);syncSelectors();window.dispatchEvent(new CustomEvent('space-view-change',{detail:statusForView()}));}
window.spaceNavigation={setView,status:statusForView};
$('#panorama-home').onclick=()=>setView('overall-101');
$('#room-focus').onchange=event=>{const rid=event.target.value;setView(rid?(rid==='106'?'close':rid+'-close'):'overall-101');};
$('#view-focus').onchange=event=>setView(event.target.value);
$('#reset').onclick=()=>setView('overall-101');
window.addEventListener('cad-view',event=>setView(event.detail));
window.addEventListener('visual-device-select',event=>{const item=visual.g.equipment.find(e=>e.id===event.detail);if(item)window.dispatchEvent(new CustomEvent('space-device-select',{detail:{id:item.id,name:devicePresentationName(item),roomId:item.roomId}}));});
const read=async file=>{const response=await fetch(file);if(!response.ok)throw new Error(file+' 读取失败');return response.json();};
try{
 const [geometry,names,...specs]=await Promise.all(['cad_geometry.json','data/equipment-names.json','visual_106.json','visual_101.json','visual_102.json','visual_103.json','visual_104.json','visual_105.json','visual_107.json','visual_108.json','visual_109.json','visual_110.json'].map(read));
 window.labEquipmentNames=new Map(names.equipment.map(e=>[e.cadId,e.displayName]));
 visual=new Visual106(geometry,specs[0],$('#visual-render'),...specs.slice(1));window.visual106=visual;
 window.realisticLab=new DisplayRealisticLab(visual);window.realistic106=window.realisticLab;visual.exportPng=undefined;visual.exportPngLegacy=undefined;window.realisticLab.exportPng=undefined;
 await installBrand101(visual);applyPresentationLabels();setView('overall-101');
 $('#load').hidden=true;document.documentElement.dataset.spaceReady='true';
}catch(error){console.error('三维空间加载失败',error);$('#load').textContent='三维空间加载失败，请刷新页面';parent.postMessage({channel:'future-lab-tech-blue-spatial',type:'error'},location.origin);}
