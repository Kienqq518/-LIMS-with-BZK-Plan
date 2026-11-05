(function(){
'use strict';
const data=window.LAB_DATA,service=new window.ShowcaseService(data),$=id=>document.getElementById(id),icon=window.LabIcons.icon,esc=window.LabIcons.escapeHTML;
const types={temperature:'温湿度',light:'光照',smoke:'烟雾',gas:'可燃气体',water:'水浸',motion:'人体',switch:'开关量',camera:'视觉'};
const typeOrder=Object.keys(types),byId=new Map(data.nodes.map(n=>[n.id,n])),cameraNodes=data.nodes.filter(n=>n.type==='camera');
const state={selectedId:null,group:'type',view:'cad',spatialReady:false,roomId:null,pendingView:'overall-101',pendingNodeId:null,cameraId:'IOT-106-CAM-03',anchors:data.anchors,expanded:false};
const markers=new Map();
const nativeNodes=new URLSearchParams(location.search).get('node-layer')==='native';
document.documentElement.dataset.nativeNodes=String(nativeNodes);
function paintIcons(){window.lucide.createIcons({attrs:{'stroke-width':1.7}});}
function statusLabel(n,s){return s.status==='offline'?'离线':s.status==='alarm'?'告警':n.type==='camera'?'在线':n.type==='switch'?'四路关闭':n.type==='motion'?(s.values.activity?'有人':'无人'):'正常';}
function reading(n,s){
 if(s.status==='offline')return '<div class="reading-phrase"><small>当前监测值</small><strong>—</strong></div>';
 const v=s.values;
 if(n.type==='temperature')return `<div class="readings"><div class="reading"><small>环境温度</small><strong>${v.temperature}<em> °C</em></strong></div><div class="reading"><small>相对湿度</small><strong>${v.humidity}<em> %</em></strong></div></div>`;
 if(n.type==='light')return `<div class="readings"><div class="reading"><small>光照强度</small><strong>${v.illuminance}<em> Lux</em></strong></div></div>`;
 if(n.type==='switch')return `<div class="readings switch-readings">${['IN-1','IN-2','OUT-1','OUT-2'].map(channel=>`<div class="reading"><small>${channel}</small><strong>关</strong></div>`).join('')}</div>`;
 const values={smoke:v.detected?'检测到烟雾':'未检测到烟雾',gas:v.exceeded?'气体浓度异常':'未检测到可燃气体',water:v.detected?'检测到积水':'未检测到积水',motion:v.activity?'检测到人员活动':'未检测到人员活动',camera:'在线'};
 return `<div class="reading-phrase"><small>监测数据</small><strong>${values[n.type]}</strong></div>`;
}
function timeText(iso){return new Date(iso).toLocaleTimeString('zh-CN',{hour12:false});}
function createMarkers(){
 if(nativeNodes)return;
 for(const n of data.nodes){const host=document.createElement('div');host.className='hotspot';host.dataset.id=n.id;
 host.innerHTML=`<span class="node-stem"></span><span class="node-anchor"></span><button class="node-orb" type="button" data-node-id="${n.id}">${icon(n.type)}<span class="disconnect">${window.lucide.icons.Unlink?'<i data-lucide="unlink"></i>':'<i data-lucide="wifi-off"></i>'}</span></button>`;
 host.querySelector('button').addEventListener('click',()=>openNode(n.id));$('markers').append(host);markers.set(n.id,host);}
 paintIcons();renderMarkers();
}
function bounds(){const stage=$('stage');return{x:0,y:0,w:stage.clientWidth,h:stage.clientHeight};}
function renderMarkers(){
 const b=bounds();
 for(const n of data.nodes){const p=state.anchors.find(a=>a.id===n.id),el=markers.get(n.id),s=service.get(n.id);if(!p||!el)continue;
 el.hidden=p.occluded===true||(state.view==='cad'&&!state.spatialReady)||p.x<0||p.x>1||p.y<0||p.y>1||(p.depth!==undefined&&(p.depth< -1||p.depth>1))||(state.view==='cad'&&state.roomId&&n.roomId!==state.roomId);el.style.left=b.x+p.x*b.w+'px';el.style.top=b.y+p.y*b.h+'px';el.dataset.status=s.status;
 const button=el.querySelector('button');button.classList.toggle('selected',state.selectedId===n.id);button.setAttribute('aria-pressed',String(state.selectedId===n.id));button.setAttribute('aria-label',`${n.roomId} ${n.name}，${statusLabel(n,s)}`);}
 if(state.selectedId&&!$('node-detail').hidden)placeCard();audit();
}
function placeCard(){
 const n=state.selectedId,p=state.anchors.find(a=>a.id===n),card=$('node-detail');if(!p||card.hidden)return;const b=bounds(),x=b.x+p.x*b.w,y=b.y+p.y*b.h,w=$('stage').clientWidth,h=$('stage').clientHeight,cw=card.offsetWidth,ch=card.offsetHeight;
 let left=x+30+cw<w-16?x+30:x-cw-30;card.style.left=Math.max(12,Math.min(w-cw-12,left))+'px';card.style.top=Math.max(75,Math.min(h-ch-92,y-ch*.55))+'px';
}
function openNode(id){
 const n=byId.get(id);if(!n)return;
 if(state.selectedId===id&&!$('node-detail').hidden){closeDetail();return;}
 state.selectedId=id;
 if(n.type==='camera'){closeDetail(false);openVision(id);renderMarkers();return;}
 const s=service.get(id),card=$('node-detail');card.dataset.status=s.status;card.dataset.nodeId=id;
 card.innerHTML=`<div class="detail-heading"><span class="detail-symbol">${icon(n.type)}</span><div class="detail-title"><h2>${esc(n.name)}</h2><p>${n.roomId} ${esc(n.roomName)}</p></div><button class="icon-button" id="close-detail" aria-label="关闭节点详情"><i data-lucide="x"></i></button></div><div class="detail-meta">${n.type==='switch'&&s.status==='normal'?'':`<span class="status ${s.status}">${statusLabel(n,s)}</span>`}<code>${n.id}</code></div>${reading(n,s)}<div class="detail-time"><span>${s.status==='offline'?'最后收到数据':'更新时间'}</span><time datetime="${s.updatedAt}">${timeText(s.updatedAt)}</time></div>`;
 card.hidden=false;$('close-detail').onclick=()=>closeDetail();paintIcons();renderMarkers();
}
function closeDetail(reset=true){$('node-detail').hidden=true;if(reset)state.selectedId=null;for(const[id,el]of markers){const b=el.querySelector('button');b.classList.toggle('selected',id===state.selectedId);b.setAttribute('aria-pressed',String(id===state.selectedId));}audit();}
function setScene(scene){const scenario=service.setScene(scene),shown=scenario.status==='alarm'?'alarm':scene==='offline'?'offline':'normal';document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===shown)));
 const summary=document.querySelector('.space-summary');summary.dataset.status=shown;$('summary-status').textContent=shown==='alarm'?'1 个节点告警':shown==='offline'?'1 个节点离线':'运行正常';
 closeDetail();renderMarkers();state.pendingNodeId=null;if(scenario.nodeId){const n=byId.get(scenario.nodeId);if(state.view==='cad'&&(!state.spatialReady||(state.roomId&&state.roomId!==n.roomId))){state.pendingNodeId=n.id;if(state.roomId&&state.roomId!==n.roomId){$('room-select').value=n.roomId;$('room-select').onchange();}}else openNode(n.id);}audit();}

function renderCatalog(){
 const grid=$('catalog-grid');grid.replaceChildren();grid.classList.toggle('by-room',state.group==='room');
 const groups=state.group==='type'?typeOrder.map(type=>({key:type,title:types[type],symbol:icon(type),nodes:data.nodes.filter(n=>n.type===type)})):Object.keys(data.rooms).map(room=>({key:room,title:room+' '+data.rooms[room],symbol:room,nodes:data.nodes.filter(n=>n.roomId===room)}));
 for(const g of groups){const card=document.createElement('section');card.className='type-card';card.innerHTML=`<div class="type-card-heading"><span>${g.symbol}</span><h3>${esc(g.title)}</h3><b>${g.nodes.length}</b></div>`;
 for(const n of g.nodes){const s=service.get(n.id),b=document.createElement('button');b.type='button';b.className='catalog-node';b.dataset.nodeId=n.id;b.dataset.status=s.status;b.innerHTML=`<i></i><span>${esc(n.name)}</span><small>${state.group==='type'?n.roomId:types[n.type]}</small>`;b.title=n.id;b.onclick=()=>{$('catalog').close();openNode(n.id);};card.append(b);}grid.append(card);}
 audit();
}
function openCatalog(){closeDetail();renderCatalog();$('catalog').showModal();audit();}
function renderCamera(){
 const n=byId.get(state.cameraId),s=service.get(n.id),image=$('camera-image');image.src=data.cameraImages[n.roomId];image.alt=n.name+' · '+n.roomId+' '+n.roomName;
 $('camera-name').textContent=n.name;$('camera-room').textContent=n.roomId+' '+n.roomName;$('camera-time').textContent=timeText(s.updatedAt);$('camera-id').textContent=n.id;$('camera-error').hidden=s.status!=='offline';
 if(s.status==='offline'){$('camera-error').querySelector('strong').textContent='节点离线';}else{$('camera-error').querySelector('strong').textContent='画面加载失败';}
 const rail=$('camera-rail');rail.replaceChildren();for(const c of cameraNodes){const b=document.createElement('button');b.type='button';b.className='camera-thumb';b.dataset.cameraId=c.id;b.setAttribute('aria-pressed',String(c.id===n.id));b.setAttribute('aria-label','查看'+c.name+' · '+c.roomId);b.innerHTML=`<img src="${data.cameraImages[c.roomId]}" alt=""><span><b>${esc(c.name)}</b><small>${c.roomId} ${esc(c.roomName)}</small><em>${service.get(c.id).status==='offline'?'离线':'在线'}</em></span>`;b.onclick=()=>{state.cameraId=c.id;state.selectedId=c.id;renderCamera();renderMarkers();};rail.append(b);}audit();
}
function openVision(id){state.cameraId=id;renderCamera();if(!$('vision').open)$('vision').showModal();audit();}
function showSpatialView(){
 closeDetail();$('stage').classList.add('is-3d');
 if(!$('cad-space').src)$('cad-space').src='./tour-space-whiteblue.html?rev=whiteblue-v1'+(nativeNodes?'&external-node-details=1&native-nodes=1&theme=whiteblue':'');
 renderMarkers();
}
function audit(){
 const nodes=data.nodes.map(n=>({id:n.id,name:n.name,type:n.type,roomId:n.roomId,position:n.position,status:service.get(n.id).status,values:service.get(n.id).values,updatedAt:service.get(n.id).updatedAt,dataState:service.get(n.id).dataState||'valid',source:service.kind||'mock'}));
 $('showcase-audit').textContent=JSON.stringify({spatialReady:state.spatialReady,scene:service.scene,view:state.view,nodeCount:data.nodes.length,typeCount:typeOrder.length,roomCount:Object.keys(data.rooms).length,cameraCount:cameraNodes.length,selectedId:state.selectedId,cameraId:state.cameraId,catalogOpen:$('catalog').open,visionOpen:$('vision').open,catalogGroups:$('catalog-grid').children.length,detailVisible:!$('node-detail').hidden,nodes});
}
document.querySelector('.brand').onclick=e=>{e.preventDefault();restoreOverview();};
if($('catalog-open'))$('catalog-open').onclick=openCatalog;document.querySelectorAll('[data-scene]').forEach(b=>b.onclick=()=>setScene(b.dataset.scene));document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{state.group=b.dataset.group;document.querySelectorAll('[data-group]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));renderCatalog();});
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>$(b.dataset.close).close();
for(const dialog of [$('catalog'),$('vision')]){dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});dialog.addEventListener('close',()=>{if(dialog.id==='vision'){state.selectedId=null;state.expanded=false;dialog.classList.remove('expanded');$('vision-expand').querySelector('span').textContent='放大画面';renderMarkers();}audit();});}
$('vision-expand').onclick=()=>{state.expanded=!state.expanded;$('vision').classList.toggle('expanded',state.expanded);$('vision-expand').querySelector('span').textContent=state.expanded?'还原画面':'放大画面';};
$('camera-image').onerror=()=>{$('camera-error').hidden=false;};
$('preview-expand').onclick=async()=>{if(parent!==window){reviewSend('expand-preview');return;}try{if(document.fullscreenElement)await document.exitFullscreen?.();else await document.documentElement.requestFullscreen?.();}catch{}};
$('stage').addEventListener('click',e=>{if(!e.target.closest('button,.detail-card'))closeDetail();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('vision').open&&!$('catalog').open)closeDetail();});
const viewRequest=()=>{if($('cad-space').contentWindow)$('cad-space').contentWindow.postMessage({channel:'future-lab-tech-blue-spatial',type:'view',view:state.pendingView},location.origin);};
$('room-select').onchange=()=>{const room=$('room-select').value;state.pendingView=room?(room==='106'?'close':room+'-close'):'overall-101';showSpatialView();viewRequest();};
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;
 if(event.source===$('cad-space').contentWindow&&event.data?.channel==='future-lab-tech-blue-spatial'){
 if(event.data.type==='ready'){state.spatialReady=true;renderMarkers();viewRequest();}if(event.data.type==='anchors'&&state.view==='cad'){state.anchors=event.data.anchors;state.roomId=event.data.room;$('room-select').value=state.roomId||'';syncViewOptions(event.data);$('context-room').textContent=event.data.roomLabel;$('context-view').textContent=event.data.viewLabel;renderMarkers();if(state.pendingNodeId&&(!state.roomId||byId.get(state.pendingNodeId).roomId===state.roomId)){const id=state.pendingNodeId;state.pendingNodeId=null;openNode(id);}}if(event.data.type==='background')closeDetail();if(event.data.type==='escape'){closeDetail();reviewSend('close-expanded');}if(event.data.type==='error')reviewSend('error');if(event.data.type==='device'){$('context-view').textContent=event.data.device.id+' · '+event.data.device.name;}return;}
 if(event.source!==parent||event.data?.channel!=='safety-keeper-spatial-review-v1'||event.data.token!==reviewToken)return;
 if(event.data.type==='hello')reviewSend('ready');if(event.data.type==='preview-size')$('preview-expand').querySelector('span').textContent=event.data.expanded?'还原预览':'放大预览';if(event.data.type==='set-state')setScene(event.data.mode);
});
const reviewToken=new URLSearchParams(location.search).get('review-token');
const reviewSend=type=>{if(parent!==window)parent.postMessage({channel:'safety-keeper-spatial-review-v1',token:reviewToken,type},location.origin);};
document.addEventListener('keydown',event=>{if(event.key==='Escape')reviewSend('close-expanded');});
window.__FUTURE_LAB_REVIEW__={dispose(){const frame=$('cad-space');frame.src='about:blank';}};
reviewSend('ready');
function syncViewOptions(payload){const select=$('view-select'),options=payload.options||[];if(JSON.stringify([...select.options].map(o=>({value:o.value,label:o.textContent})))!==JSON.stringify(options)){select.replaceChildren(...options.map(o=>{const option=document.createElement('option');option.value=o.value;option.textContent=o.label;return option;}));}select.value=payload.view;}
function restoreOverview(){state.pendingView='overall-101';showSpatialView();viewRequest();}
$('panorama-home').onclick=restoreOverview;$('view-reset').onclick=restoreOverview;$('view-select').onchange=()=>{state.pendingView=$('view-select').value;showSpatialView();viewRequest();};
new ResizeObserver(renderMarkers).observe($('stage'));createMarkers();paintIcons();$('node-count').textContent=data.nodes.length;$('room-count').textContent=Object.keys(data.rooms).length;$('type-count').textContent=new Set(data.nodes.map(n=>n.type)).size;$('camera-count').textContent=cameraNodes.length;showSpatialView();audit();
})();
