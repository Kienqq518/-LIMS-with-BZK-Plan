import {icon,escapeHTML as e} from './icons.js';
import {STATUS} from './status.js';
export function monitorContent(n,s){
 const v=s.values;
 if(s.status==='offline')return '<div class="offline-reading"><b>当前数据不可用</b><span>连接恢复后更新监测信息</span></div>';
 const number=x=>typeof x==='number'&&Number.isFinite(x)?x:'—';
 if(n.type==='temperature')return `<div class="readings"><div><small>温度</small><strong>${number(v.temperature)}<em> °C</em></strong></div><div><small>相对湿度</small><strong>${number(v.humidity)}<em> %</em></strong></div></div>`;
 if(n.type==='light')return `<div class="readings"><div><small>光照强度</small><strong>${number(v.illuminance)}<em> Lux</em></strong></div></div>`;
 if(n.type==='camera')return `<div class="detection"><small>节点连接</small><b>${v.connection==='connected'?'已连接':'未连接'}</b></div><button class="video-entry" type="button" ${v.videoSource?'':'disabled'}>查看画面${v.videoSource?'':' · 视频源未接入'}</button>`;
 const values={smoke:[v.detected,'检测到烟雾','未检测到烟雾'],water:[v.detected,'检测到水浸','未检测到水浸'],gas:[v.exceeded,'浓度超限','浓度正常'],motion:[v.activity,'检测到活动','未检测到活动'],switch:[v.contact==='closed','闭合','断开']};
 const a=values[n.type];const key={smoke:'detected',water:'detected',gas:'exceeded',motion:'activity',switch:'contact'}[n.type];const valid=n.type==='switch'?['open','closed'].includes(v.contact):typeof v[key]==='boolean';return `<div class="detection"><small>${n.type==='switch'?'开关量状态':'检测状态'}</small><b>${a&&valid?e(a[0]?a[1]:a[2]):'暂无数据'}</b></div>`;
}
export class NodeDetail{
 constructor(host,rooms,onClose,onVideo){
 this.rooms=rooms;this.onClose=onClose;this.onVideo=onVideo;this.element=document.createElement('section');this.element.className='node-card';this.element.hidden=true;this.element.setAttribute('role','dialog');this.element.setAttribute('aria-label','节点详情');host.append(this.element);
 this.element.addEventListener('click',ev=>{if(ev.target.closest('.card-close'))this.onClose();if(ev.target.closest('.video-entry'))this.onVideo?.(this.nodeId);});
 }
 show(n,s){this.nodeId=n.id;const date=new Date(s.updatedAt),time=date.toLocaleTimeString('zh-CN',{hour12:false});
 this.element.innerHTML=`<div class="node-card-heading"><span class="card-symbol">${icon(n.type)}</span><div><h2>${e(n.name)}</h2><p>${e(n.roomId+' '+this.rooms[n.roomId])}</p></div><button class="card-close" type="button" aria-label="关闭节点详情">×</button></div><div class="card-meta"><span class="status-chip" data-status="${s.status}"><i></i>${STATUS[s.status].text}</span><code>${e(n.id)}</code></div>${monitorContent(n,s)}<div class="card-time">${s.status==='offline'?'最后收到数据':'更新时间'}<time datetime="${e(s.updatedAt)}">${time}</time></div>`;
 this.element.hidden=false;this.element.dataset.cardNodeId=n.id;this.element.dataset.status=s.status;
 }

 /* 卡片不许压住宿主的浮层（同源可读）：压上去以后 × 就归宿主管，点它没反应
    （2026-11-11 圈图：1680 宽的窗口里 × 正好落在告警流底下，节点卡关不掉）。
    做法：把宿主浮层当成禁停区，依次试「节点右/左/上/下/居中」六个落点，
    取第一个不与任何浮层相交的；实在躲不开就取相交面积最小的，绝不推出视口。
    独立打开场景页（读不到宿主 DOM）时禁停区为空，行为与从前一致。 */
 hostBoxes(w,h){const out=[];try{const d=parent.document,fr=window.frameElement;if(!d||!fr)return out;
  const o=fr.getBoundingClientRect();
  for(const sel of ['.rail','.dock','#rightCol','.detail','.znodes','.stream','.cctv','.scpanel','.nodepanel']){
   const e=d.querySelector(sel);if(!e||e.hidden)continue;const r=e.getBoundingClientRect();
   if(r.width<4||r.height<4)continue;const k={l:r.left-o.left,t:r.top-o.top,r:r.right-o.left,b:r.bottom-o.top};
   if(k.r<0||k.l>w||k.b<0||k.t>h)continue;out.push(k);}
  return out;}catch(e){return out;}}
 place(x,y,w,h){const c=this.element,cw=Math.min(292,w-24),ch=c.offsetHeight||230;c.style.width=cw+'px';
  const boxes=this.hostBoxes(w,h);
  const over=(l,t)=>boxes.reduce((a,k)=>a+Math.max(0,Math.min(l+cw,k.r)-Math.max(l,k.l))*Math.max(0,Math.min(t+ch,k.b)-Math.max(t,k.t)),0);
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const cand=[[x+24,y-ch*.45],[x-cw-24,y-ch*.45],[x+24,y-ch+10],[x-cw-24,y-ch+10],[x-cw/2,y-ch-14],[x-cw/2,y+22]];
  let best=null,bad=Infinity;
  for(const [l0,t0] of cand){const l=clamp(l0,12,w-cw-12),t=clamp(t0,76,h-ch-16),o=over(l,t);
   if(o===0){best=[l,t];break;} if(o<bad){bad=o;best=[l,t];}}
  c.style.left=best[0]+'px';c.style.top=best[1]+'px';}
 close(){this.element.hidden=true;delete this.element.dataset.cardNodeId;}
}
