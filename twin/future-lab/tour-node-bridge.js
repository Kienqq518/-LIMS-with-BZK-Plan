import {NodeLayer} from './iot/node-layer.js';
import {NodeStore} from './iot/status.js';
import {normalizeSnapshot} from '../src/scene-monitoring.js';
import {ROOM_NAMES} from './iot/monitoring-data.js';

// Activate the existing world-coordinate node layer only for the V4 host.
const enabled=new URLSearchParams(location.search).get('native-nodes')==='1';
const CHANNEL='room-tour-node-v3';
let layer,store,observer,disposed=false;
const send=(type,data={})=>parent.postMessage({channel:CHANNEL,type,...data},location.origin);
let config=null;
window.addEventListener('pagehide',()=>{disposed=true;},{once:true});
if(enabled){try{config=await fetch('data/iot-nodes.json').then(r=>{if(!r.ok)throw Error('节点配置读取失败');return r.json();});}catch{if(!disposed)send('model-error',{reason:'load-failed'});}}
function start(){
 if(!enabled||disposed||layer||document.documentElement?.dataset.spaceReady!=='true')return;
 const visual=window.visual106;
 store=new NodeStore(config.nodes);
 layer=new NodeLayer(visual,config.nodes,store,ROOM_NAMES);layer.quality=normalizeSnapshot;layer.visible=false;
 layer.update();observer?.disconnect();
 const render=visual.render.bind(visual);
 visual.render=()=>{const result=render();layer.update();return result;};
 for(const label of visual.labels){
  label.div.setAttribute('role','button');label.div.tabIndex=0;label.div.style.pointerEvents='auto';
  label.div.setAttribute('aria-label','查看'+label.r.id+' '+ROOM_NAMES[label.r.id]);
  const choose=()=>send('room-selected',{roomId:label.r.id});
  label.div.addEventListener('click',choose);
  label.div.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
 }
 const canvas=visual.renderer.domElement;
 canvas.addEventListener('pointerdown',()=>send('interaction',{reason:'camera'}));
 canvas.addEventListener('wheel',()=>send('interaction',{reason:'camera'}),{passive:true});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();send('model-error',{reason:'context-lost'});});
 send('nodes-ready',{nodeIds:config.nodes.map(n=>n.id),modelCount:visual.modelRoots.size});
}
function receive(event){
 if(!enabled||event.origin!==location.origin||event.source!==parent||event.data?.channel!==CHANNEL)return;
 const d=event.data;
 if(d.type==='snapshots'&&store&&Array.isArray(d.nodes)){
  try{store.replace(d.nodes.map(n=>({...n,nodeId:n.id})));layer.visible=true;layer.paint();layer.update();}catch{/* Reject malformed/unknown/duplicate nodes without partially updating state. */}
 }
 if(d.type==='clear-selection')layer?.close();
 if(d.type==='select-node'&&config.nodes.some(n=>n.id===d.id)){
  layer.selectedId=d.id;layer.card.close();layer.paint();layer.update();
 }
}
if(enabled&&config&&!disposed&&document.documentElement){
 window.addEventListener('message',receive);
 window.addEventListener('keydown',e=>{if(e.key==='Escape'){layer?.close();send('node-cleared');}});
 observer=new MutationObserver(start);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-space-ready']});start();
 window.addEventListener('pagehide',()=>{disposed=true;observer.disconnect();window.removeEventListener('message',receive);layer?.dispose();},{once:true});
}
