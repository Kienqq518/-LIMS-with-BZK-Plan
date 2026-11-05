# -*- coding: utf-8 -*-
"""四页 HTML 原型共享交互层：跳转 + 状态切换。改设计时只认 data-* 钩子。"""

HOOKS = """<!--
  交互钩子（改设计时保留这些属性即可继续可点）：
  data-goto="overview|zone106|device|alarm"   跳转到对应页面
  data-back                                   返回上一页（弹层关闭）
  data-todo="提示文案"                         本期未覆盖入口 → 轻提示
  data-switch                                 容器：内部互斥选中（分段/胶囊/筛选）
  data-view="task|alarm"                      可切换的内容页签
  data-panel-view="task|alarm"                被切换的内容块
  data-sel                                    列表项（S4 告警列表，点击换回放对象）
  body[data-devstate] / [data-state]          弹层设备状态 running|alarm|offline|maintain
  data-dim / data-desc                        5M1E 维度切换 → 更新叠加层说明
  data-span                                   时间范围切换 → 更新窗口说明
  data-role="replay-*|dev-*|chart|daq-*|dim-hint|range-note"  被脚本更新的锚点
-->"""

PROTO = """
[data-goto],[data-back],[data-switch],[data-view],[data-sel]{cursor:pointer}
[hidden]{display:none!important}
.proto-toast{position:fixed;left:50%;bottom:44px;transform:translate(-50%,12px);background:#0F2740;color:#fff;
  font-size:12px;padding:9px 16px;border-radius:999px;box-shadow:0 14px 40px rgba(15,40,80,.3);
  opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:99;letter-spacing:.2px}
.proto-toast.on{opacity:1;transform:translate(-50%,0)}
[data-role=chart][data-state=offline] svg,[data-role=chart][data-state=offline] .legend2{filter:grayscale(1);opacity:.45}
[data-role=chart][data-state=maintain] svg{opacity:.4}
body[data-devstate=offline] [data-role=dev-cta]{opacity:.45;pointer-events:none}
body[data-devstate=offline] [data-role=daq-online]{color:var(--t3)}
.al.sel{background:#F5F9FF;border-color:var(--blue);box-shadow:0 0 0 3px rgba(40,120,255,.10)}
"""

JS = r"""
(function(){
  var PAGES={overview:'01-overview.html',zone106:'02-zone-106.html',device:'03-device-detail.html',alarm:'04-alarm-review.html'};
  var toast;
  function say(t){ if(!toast){toast=document.createElement('div');toast.className='proto-toast';document.body.appendChild(toast);}
    toast.textContent=t; toast.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(function(){toast.classList.remove('on');},2000); }
  function pick(group,el){ Array.prototype.forEach.call(group.querySelectorAll('.on'),function(k){ if(k!==el&&k.closest('[data-switch]')===group) k.classList.remove('on'); });
    el.classList.add('on'); }
  function applyView(name){ var any=false;
    Array.prototype.forEach.call(document.querySelectorAll('[data-panel-view]'),function(p){ var m=(p.getAttribute('data-panel-view')===name); p.hidden=!m; if(m) any=true; });
    if(!any) say('该内容块本期未展开'); }
  var DEV={running:['运行中','g','采控主系统 · 2s 采样','心跳 1.4s · 数据连续'],
           alarm:['告警','r','采控主系统 · 2s 采样','心跳 1.4s · 上料已暂停'],
           offline:['离线','m','连接恢复后更新','分系统离线 · 最近上报 10:12:44'],
           maintain:['维护','a','保养模式 · 数据不入库','联锁开启 · 仅演示不动作']};
  function applyDevState(st){ document.body.setAttribute('data-devstate',st);
    var m=DEV[st]||DEV.running, ch=document.querySelector('[data-role=chart]');
    var d=document.querySelector('[data-role=dev-dot]'); if(d) d.className='dot '+m[1];
    var s=document.querySelector('[data-role=dev-status]'); if(s) s.textContent=m[0];
    var c=document.querySelector('[data-role=chart-src]'); if(c) c.textContent=m[2];
    var q=document.querySelector('[data-role=daq-heart]'); if(q) q.textContent=m[3];
    if(ch) ch.setAttribute('data-state',st); }
  function applyReplay(el){
    Array.prototype.forEach.call(document.querySelectorAll('[data-sel]'),function(x){x.classList.remove('sel')}); el.classList.add('sel');
    var g=el.getAttribute('data-grade'), title=el.querySelector('.b b');
    var badge=document.querySelector('[data-role=replay-grade]'), head=document.querySelector('[data-role=replay-title]'),
        val=document.querySelector('[data-role=replay-val]'), sub=document.querySelector('[data-role=replay-sub]'),
        tm=document.querySelector('[data-role=replay-time]'), win=document.querySelector('[data-role=replay-window]');
    if(badge){ badge.textContent='Grade '+g; badge.className='pill '+({A:'red',B:'org',C:'amb'}[g]||'ghost'); }
    if(head&&title) head.innerHTML=title.textContent+' <span style="font-weight:400;color:var(--t3);font-size:11px">· 回放 '+el.getAttribute('data-window')+'</span>';
    if(win) win.textContent='回放 '+el.getAttribute('data-window');
    var unit=document.querySelector('[data-role=replay-unit]'), lab=document.querySelector('[data-role=replay-label]');
    if(val){ val.textContent=el.getAttribute('data-value'); val.style.color=el.getAttribute('data-vcolor')||'var(--red)'; }
    if(unit) unit.textContent=el.getAttribute('data-unit')||'';
    if(lab) lab.textContent=el.getAttribute('data-label')||'';
    if(sub) sub.textContent=el.getAttribute('data-limit');
    if(tm) tm.textContent=el.getAttribute('data-time')+':04'; }
  document.addEventListener('click',function(e){
    var el=e.target.closest('[data-back],[data-todo],[data-goto],[data-view],[data-sel],[data-switch]');
    if(!el) return;
    if(el.hasAttribute('data-back')){ if(history.length>1) history.back(); else location.href=PAGES.zone106; return; }
    if(el.hasAttribute('data-todo')){ say(el.getAttribute('data-todo')||'本期未覆盖'); return; }
    if(el.hasAttribute('data-goto')){ var k=el.getAttribute('data-goto'); if(PAGES[k]){ location.href=PAGES[k]; return; } }
    if(el.hasAttribute('data-view')){ var g=el.closest('[data-switch]')||el.parentNode; if(g) pick(g,el); applyView(el.getAttribute('data-view')); return; }
    if(el.hasAttribute('data-sel')){ applyReplay(el); return; }
    if(el.hasAttribute('data-switch')){ var it=e.target.closest('[data-on],i,b,.pill,.seg i,.btn,[data-state],[data-dim],[data-span]');
      if(it&&el.contains(it)){ pick(el,it);
        if(it.hasAttribute('data-state')) applyDevState(it.getAttribute('data-state'));
        var hint=document.querySelector('[data-role=dim-hint]');
        if(it.hasAttribute('data-dim')&&hint) hint.textContent='叠加层：'+it.textContent.trim()+' · '+(it.getAttribute('data-desc')||'');
        var note=document.querySelector('[data-role=range-note]');
        if(it.hasAttribute('data-span')&&note) note.textContent='窗口 '+it.getAttribute('data-span'); } }
  });
  applyView(document.body.getAttribute('data-view-start')||'task');
  var st0=document.body.getAttribute('data-devstate'); if(st0) applyDevState(st0);
})();
"""
