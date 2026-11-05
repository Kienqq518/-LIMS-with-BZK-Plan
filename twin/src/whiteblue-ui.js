/* Presentation only: scale the exhibition artboard; annotate metrics with supplied icons.
 * All state changes are routed through the original V5 controls. */
(()=>{
 const shell=document.getElementById('screen-shell');
 function fit(){const scale=Math.min(innerWidth/1920,innerHeight/1080);shell.style.transform=`scale(${scale})`;shell.style.left=`${Math.max(0,(innerWidth-1920*scale)/2)}px`;shell.style.top=`${Math.max(0,(innerHeight-1080*scale)/2)}px`;document.documentElement.style.setProperty('--display-scale',String(scale));}
 fit();addEventListener('resize',fit);
 const metrics=document.getElementById('metric-grid');
 function decorate(){let changed=false;for(const metric of metrics.children){if(metric.querySelector('.metric-symbol'))continue;const label=metric.querySelector('small')?.textContent||'';const icon=label.includes('温度')?'thermometer':label.includes('湿度')?'droplet':label.includes('时间')?'clock-3':label.includes('失败')?'circle-alert':label.includes('异常')?'shield-alert':label.includes('记录')?'history':label.includes('感应')?'radio':'shield-check';const holder=document.createElement('span');holder.className='metric-symbol';holder.setAttribute('aria-hidden','true');const i=document.createElement('i');i.dataset.lucide=icon;holder.append(i);metric.prepend(holder);changed=true;}if(changed)window.lucide?.createIcons();}
 const metricsObserver=new MutationObserver(decorate);metricsObserver.observe(metrics,{childList:true});decorate();
 const auditObserver=new MutationObserver(()=>{const el=document.getElementById('req013-audit');if(!el)return;try{const audit=JSON.parse(el.textContent);shell.dataset.mode=audit.room?'room':'overview';shell.dataset.scene=audit.scene;shell.dataset.nodeDetail=String(!!audit.selectedNodeId);const purpose=document.getElementById('scene-purpose');const concise={climate:'监测各试验区温湿度，超限及时提醒。',safety:'关注人员活动及烟雾、气体、水浸异常。',visitor:'感知接待区人员活动，记录发生时间。',inspector:'按计划抓拍重点区域，保留巡查记录。'}[audit.scene];if(concise&&purpose.textContent!==concise){purpose.title=purpose.textContent;purpose.textContent=concise;}}catch{}});
 const mountObserver=new MutationObserver(()=>{const el=document.getElementById('req013-audit');if(el){mountObserver.disconnect();auditObserver.observe(el,{childList:true,characterData:true,subtree:true});}});mountObserver.observe(document.body,{childList:true,subtree:true});
 const management=document.querySelector('.management-details');management.addEventListener('toggle',()=>{if(!management.open)return;try{const state=JSON.parse(document.getElementById('req013-audit')?.textContent||'{}');if(state.autoplay&&!state.paused)document.getElementById('autoplay').click();}catch{}});
 addEventListener('keydown',e=>{if(e.key==='Escape'){management.open=false;const demo=document.querySelector('.demo-tools');if(demo)demo.open=false;}});
 addEventListener('pagehide',()=>{metricsObserver.disconnect();auditObserver.disconnect();mountObserver.disconnect();removeEventListener('resize',fit);},{once:true});
})();
