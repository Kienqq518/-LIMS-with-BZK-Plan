(()=>{
 const CHANNEL='room-tour-preview-v1',SPATIAL='future-lab-tech-blue-spatial',NODES='room-tour-node-v3',HIGHLIGHT='room-tour-highlight-v2';
 const nativeNodes=new URLSearchParams(location.search).get('node-layer')==='native';
 let sceneRoomIds=[],highlightRoom='106',displayMode='overview',playing=false,inspection=null,catalog=null;
 let previous='',lastHighlight='',lastSnapshots='',innerReady=false,nodesReady=false,readySent=false,latestAudit=null,modelCount=0;
 const inner=()=>document.getElementById('cad-space');
 const knownNode=id=>(window.LAB_DATA?.nodes||[]).some(n=>n.id===id);
 const knownRoom=id=>/^10[1-9]$|^110$/.test(id)&&(window.LAB_DATA?.nodes||[]).some(n=>n.roomId===id);
 const send=(type,data={})=>{if(parent!==window)parent.postMessage({channel:CHANNEL,type,...data},location.origin);};
 const spatial=(type,data={})=>inner()?.contentWindow?.postMessage({channel:SPATIAL,type,...data},location.origin);
 const nodeMessage=(type,data={})=>inner()?.contentWindow?.postMessage({channel:NODES,type,...data},location.origin);
 function highlight(force=false){
  const payload={channel:HIGHLIGHT,type:'highlight',roomId:highlightRoom,roomIds:sceneRoomIds,mode:displayMode,playing},encoded=JSON.stringify(payload);
  if(force||encoded!==lastHighlight){lastHighlight=encoded;inner()?.contentWindow?.postMessage(payload,location.origin);}
 }
 function ready(){
  if(!innerReady||(nativeNodes&&!nodesReady)||!latestAudit)return;
  if(!readySent){readySent=true;send('model-ready',{modelCount,nodeCount:latestAudit.nodes.length,renderer:'WebGL'});highlight(true);}
 }
 function read(){
  const raw=document.getElementById('showcase-audit')?.textContent;if(!raw||raw==='{}')return;
  try{
   const audit=JSON.parse(raw);if(!Array.isArray(audit.nodes)||audit.nodes.length!==window.LAB_DATA?.nodes.length||audit.nodes.some(n=>!knownNode(n.id)))return;
   latestAudit=audit;
   const snapshots=JSON.stringify(audit.nodes);
   if(nativeNodes&&nodesReady&&snapshots!==lastSnapshots){lastSnapshots=snapshots;nodeMessage('snapshots',{nodes:audit.nodes});}
   const data={roomId:highlightRoom,displayMode,inspection,audit,viewLabel:document.getElementById('context-view').textContent},encoded=JSON.stringify(data);
   if(encoded!==previous){previous=encoded;send('snapshot',data);}
   ready();
  }catch{/* The host ignores incomplete audit writes. */}
 }
 function navigate(room){const select=document.getElementById('room-select');if(!select)return;select.value=room;select.dispatchEvent(new Event('change'));}
 function closePopups(){document.getElementById('close-detail')?.click();const vision=document.getElementById('vision');if(vision?.open)vision.close();}
 function receive(event){
  if(event.origin!==location.origin)return;
  const d=event.data;if(!d||typeof d!=='object')return;
  if(event.source===inner()?.contentWindow){
   if(d.channel===SPATIAL){
    if(d.type==='ready'){innerReady=true;ready();}
    if(d.type==='error'){innerReady=false;send('model-error',{reason:'load-failed'});}
    if(d.type==='anchors'){inspection={room:d.room||'',view:d.view,options:d.options||[]};read();}
    if(d.type==='equipment-catalog'){catalog=d.equipment;send('equipment-catalog',{equipment:catalog});}
    if(d.type==='device'&&displayMode==='overview')send('equipment-select',{id:d.device?.id});
   }
   if(d.channel===NODES){
    if(d.type==='nodes-ready'&&Array.isArray(d.nodeIds)&&d.nodeIds.length===window.LAB_DATA?.nodes.length&&new Set(d.nodeIds).size===d.nodeIds.length&&d.nodeIds.every(knownNode)){
     nodesReady=true;modelCount=d.modelCount||0;lastSnapshots='';read();ready();
    }
    if(d.type==='node-selected'&&knownNode(d.id))send('node-selected',{id:d.id});
    if(d.type==='room-selected'&&knownRoom(d.roomId))send('room-selected',{roomId:d.roomId});
    if(d.type==='interaction')send('interaction',{reason:'camera'});
    if(d.type==='node-cleared')send('node-cleared');
    if(d.type==='model-error'){innerReady=false;send('model-error',{reason:d.reason==='context-lost'?'context-lost':'load-failed'});}
   }
   if(d.channel===HIGHLIGHT&&d.type==='ready')highlight(true);
   return;
  }
  if(event.source!==parent||d.channel!==CHANNEL)return;
  if(d.type==='hello'){if(readySent)send('model-ready',{modelCount,nodeCount:latestAudit.nodes.length,renderer:'WebGL'});else ready();read();return;}
  if(d.type==='scene-rooms'){
   const next=Array.isArray(d.roomIds)?[...new Set(d.roomIds.filter(knownRoom))]:[];
   if(JSON.stringify(next)!==JSON.stringify(sceneRoomIds)){sceneRoomIds=next;highlight();}return;
  }
  if(d.type==='display-mode'&&['cruise','overview'].includes(d.mode)){
   displayMode=d.mode;if(knownRoom(d.roomId))highlightRoom=d.roomId;
   spatial('equipment-highlight',{id:null});
   if(inspection?.view!=='overall-101')navigate('');highlight();read();return;
  }
  if(d.type==='focus-room'&&knownRoom(d.roomId)){closePopups();highlightRoom=d.roomId;highlight();read();return;}
  if(d.type==='inspect-room'&&displayMode==='overview'&&(!d.roomId||knownRoom(d.roomId))){closePopups();spatial('equipment-highlight',{id:null});if(d.roomId)highlightRoom=d.roomId;navigate(d.roomId||'');highlight();read();return;}
  if(d.type==='inspect-view'&&displayMode==='overview'){const select=document.getElementById('view-select');if([...select.options].some(o=>o.value===d.view)){select.value=d.view;select.dispatchEvent(new Event('change'));}return;}
  if(d.type==='equipment-select'&&displayMode==='overview'&&catalog?.some(e=>e.id===d.id)){closePopups();spatial('equipment-highlight',{id:d.id});return;}
  if(d.type==='equipment-clear'){spatial('equipment-highlight',{id:null});return;}
  if(d.type==='playback'){
   playing=d.playing===true;highlight();return;
  }
  if(d.type==='clear-node'){nodeMessage('clear-selection');return;}
  if(d.type==='open-node'&&knownNode(d.id)){
   if(nativeNodes)nodeMessage('select-node',{id:d.id});
   else document.querySelector(`.node-orb[data-node-id="${d.id}"]`)?.click();
  }
  if(d.type==='request-catalog'){if(catalog)send('equipment-catalog',{equipment:catalog});else spatial('request-catalog');}
 }
 window.addEventListener('message',receive);
 // Legacy projected markers remain available in the original non-V4 entrance only.
 document.addEventListener('click',event=>{if(nativeNodes)return;const b=event.target.closest?.('.node-orb[data-node-id]');if(!b||!knownNode(b.dataset.nodeId))return;event.preventDefault();event.stopImmediatePropagation();send('node-selected',{id:b.dataset.nodeId});},true);
 const observe=()=>{const el=document.getElementById('showcase-audit');if(!el)return;const observer=new MutationObserver(read);observer.observe(el,{childList:true,subtree:true,characterData:true});read();window.addEventListener('pagehide',()=>{observer.disconnect();window.removeEventListener('message',receive);},{once:true});};
 if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',observe,{once:true});else observe();
})();
