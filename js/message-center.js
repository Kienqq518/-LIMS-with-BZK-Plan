/**
 * 消息中心（顶栏铃铛）
 *
 * 顶栏外壳由 index.html 提供、由 prototype-annotation.js 克隆进每一页的画布，
 * 所以这里不认 id（克隆时 id 会被剥掉），只认 class：.pa-msg-bell / .pa-msg-badge。
 * 面板样式自带一段 CSS，不依赖 Tailwind 的即时生成，缩放画布里也不会错位。
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'pa-msg-style';
  var PAGE = 'message-center.html';
  var panels = [];

  var CSS = [
    '.pa-msg-wrap { position: relative; display: inline-flex; align-items: center; }',
    '.pa-msg-panel { position: absolute; right: 0; top: calc(100% + 10px); width: 384px; display: none;',
    '  flex-direction: column; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;',
    '  box-shadow: 0 14px 36px rgba(15,23,42,.18); font-size: 13px; color: #334155; z-index: 120; text-align: left; }',
    '.pa-msg-panel.open { display: flex; }',
    '.pa-msg-panel::before { content: ""; position: absolute; right: 12px; top: -6px; width: 12px; height: 12px;',
    '  background: #fff; border-left: 1px solid #e2e8f0; border-top: 1px solid #e2e8f0; transform: rotate(45deg); }',
    '.pa-msg-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }',
    '.pa-msg-head b { font-size: 14px; color: #0f172a; }',
    '.pa-msg-head .pa-msg-unread { color: #dc2626; font-weight: 600; }',
    '.pa-msg-link { margin-left: auto; color: #2563eb; cursor: pointer; background: none; border: 0; font-size: 12px; padding: 2px 4px; }',
    '.pa-msg-link:hover { text-decoration: underline; }',
    '.pa-msg-tabs { display: flex; gap: 4px; padding: 8px 10px; border-bottom: 1px solid #f1f5f9; flex-wrap: wrap; }',
    '.pa-msg-tab { border: 1px solid #e2e8f0; background: #f8fafc; color: #475569; border-radius: 999px; padding: 3px 10px; font-size: 12px; cursor: pointer; }',
    '.pa-msg-tab:hover { background: #eff6ff; }',
    '.pa-msg-tab.on { background: #2563eb; border-color: #2563eb; color: #fff; }',
    '.pa-msg-tab i { font-style: normal; opacity: .75; margin-left: 3px; }',
    '.pa-msg-list { max-height: 322px; overflow-y: auto; }',
    '.pa-msg-item { display: flex; gap: 9px; padding: 10px 12px; border-bottom: 1px solid #f8fafc; cursor: pointer; position: relative; }',
    '.pa-msg-item:hover { background: #f8fafc; }',
    '.pa-msg-ico { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }',
    '.pa-msg-main { min-width: 0; flex: 1; }',
    '.pa-msg-title { display: flex; align-items: center; gap: 6px; color: #0f172a; font-weight: 600; }',
    '.pa-msg-title .pa-msg-dot { width: 6px; height: 6px; border-radius: 50%; background: #ef4444; flex-shrink: 0; }',
    '.pa-msg-read .pa-msg-title { color: #64748b; font-weight: 500; }',
    '.pa-msg-read .pa-msg-ico { opacity: .45; }',
    '.pa-msg-body { margin-top: 2px; color: #64748b; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }',
    '.pa-msg-foot { margin-top: 4px; color: #94a3b8; font-size: 12px; display: flex; gap: 8px; }',
    '.pa-msg-tag { border-radius: 3px; padding: 0 5px; font-size: 11px; }',
    '.pa-msg-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-top: 1px solid #f1f5f9; color: #64748b; }',
    '.pa-msg-empty { padding: 26px 12px; text-align: center; color: #94a3b8; }',
    '.pa-msg-badge { min-width: 16px; padding: 0 3px; }',
    '.pa-msg-badge.zero { display: none; }'
  ].join('\n');

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function injectStyle() {
    var doc = global.document;
    if (doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    doc.head.appendChild(st);
  }

  function relTime(iso) {
    var s = String(iso || '').replace(' ', 'T');
    var d = new Date(s);
    if (isNaN(d.getTime())) return iso || '/';
    var diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    var today = new Date(); 
    if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()) {
      return d.getDate() + ' 日 ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    }
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /* ---------------- 面板状态 ---------------- */
  function makePanel(bell) {
    var MS = global.MessageStore;
    var state = { tab: 'all' };
    var wrap = document.createElement('div');
    wrap.className = 'pa-msg-wrap';
    bell.parentNode.insertBefore(wrap, bell);
    wrap.appendChild(bell);

    var panel = document.createElement('div');
    panel.className = 'pa-msg-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '消息中心');
    wrap.appendChild(panel);

    function items() { return MS ? MS.byType(state.tab) : []; }
    function unread() { return MS ? MS.unreadByType() : { all: 0 }; }

    function render() {
      if (!MS) { panel.innerHTML = '<div class="pa-msg-empty">消息数据加载中…</div>'; return; }
      var u = unread(), list = items();
      var tabs = [{ k: 'all', n: '全部' }].concat(MS.TYPE_ORDER.map(function (k) { return { k: k, n: MS.TYPES[k].label }; }));
      panel.innerHTML =
        '<div class="pa-msg-head"><b>消息中心</b><span class="pa-msg-unread">未读 ' + u.all + '</span>' +
          '<button type="button" class="pa-msg-link" data-act="allread">全部标记已读</button></div>' +
        '<div class="pa-msg-tabs">' + tabs.map(function (t) {
          var c = u[t.k] || 0;
          return '<button type="button" class="pa-msg-tab' + (state.tab === t.k ? ' on' : '') + '" data-tab="' + t.k + '">' +
            t.n + (c ? '<i>' + c + '</i>' : '') + '</button>';
        }).join('') + '</div>' +
        '<div class="pa-msg-list">' + (list.length ? list.map(function (m) {
          var ty = MS.TYPES[m.type] || MS.TYPES.todo;
          var read = MS.isRead(m.id);
          return '<div class="pa-msg-item' + (read ? ' pa-msg-read' : '') + '" data-id="' + esc(m.id) + '" data-href="' + esc(m.href) + '">' +
            '<span class="pa-msg-ico" style="background:' + ty.color + '1a;color:' + ty.color + '"><i class="fa ' + ty.icon + '"></i></span>' +
            '<span class="pa-msg-main"><span class="pa-msg-title">' + (read ? '' : '<span class="pa-msg-dot"></span>') +
              esc(m.title) + '</span>' +
              '<span class="pa-msg-body">' + esc(m.body) + '</span>' +
              '<span class="pa-msg-foot"><span class="pa-msg-tag" style="background:' + ty.color + '14;color:' + ty.color + '">' + ty.label + '</span>' +
              '<span>' + relTime(m.time) + '</span></span></span></div>';
        }).join('') : '<div class="pa-msg-empty">这个分类下暂时没有消息</div>') + '</div>' +
        '<div class="pa-msg-bar"><span>共 ' + list.length + ' 条 · 未读 ' + (state.tab === 'all' ? u.all : (u[state.tab] || 0)) + ' 条</span>' +
          '<button type="button" class="pa-msg-link" data-act="page">查看全部消息 →</button></div>';
    }

    function open() {
      panels.forEach(function (p) { if (p !== api) p.close(); });
      render();
      panel.classList.add('open');
      bell.setAttribute('aria-expanded', 'true');
    }
    function close() { panel.classList.remove('open'); bell.setAttribute('aria-expanded', 'false'); }

    panel.addEventListener('click', function (e) {
      var MS2 = global.MessageStore;
      var tab = e.target.closest ? e.target.closest('[data-tab]') : null;
      if (tab) { state.tab = tab.getAttribute('data-tab'); render(); return; }
      var act = e.target.closest ? e.target.closest('[data-act]') : null;
      if (act) {
        var kind = act.getAttribute('data-act');
        if (kind === 'allread') { if (MS2) { MS2.markAll(); syncBadge(); render(); } return; }
        if (kind === 'page') { location.href = PAGE; return; }
      }
      var it = e.target.closest ? e.target.closest('.pa-msg-item') : null;
      if (it) {
        if (MS2) { MS2.markRead(it.getAttribute('data-id')); syncBadge(); }
        location.href = it.getAttribute('data-href') || PAGE;
      }
    });

    var api = { open: open, close: close, sync: syncBadge, render: render };
    bell.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panel.classList.contains('open')) close(); else open();
    });
    panels.push(api);
    syncBadge();
    return api;
  }

  function syncBadge() {
    var n = global.MessageStore ? MessageStore.unreadCount() : 0;
    document.querySelectorAll('.pa-msg-badge').forEach(function (b) {
      b.textContent = n > 99 ? '99+' : String(n);
      b.classList.toggle('zero', n === 0);
    });
  }

  function bindAll() {
    injectStyle();
    document.querySelectorAll('.pa-msg-bell').forEach(function (bell) {
      if (bell.getAttribute('data-msg-bound')) return;
      bell.setAttribute('data-msg-bound', '1');
      makePanel(bell);
    });
  }

  document.addEventListener('click', function () { panels.forEach(function (p) { p.close(); }); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') panels.forEach(function (p) { p.close(); });
  });
  if (global.MessageStore) MessageStore.ready().then(function () { MessageStore.refresh(); bindAll(); syncBadge(); });

  document.addEventListener('DOMContentLoaded', function () { bindAll(); syncBadge(); });
  // 外壳是异步克隆进来的（切换画布比例、重绘时会再来一次），用观察器补绑
  if (document.body) {
    new MutationObserver(function () { bindAll(); }).observe(document.documentElement, { childList: true, subtree: true });
  }
  global.LimsMessageCenter = { bind: bindAll, syncBadge: syncBadge };
})(window);
