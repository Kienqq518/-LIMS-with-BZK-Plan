/**
 * 报告记录抽屉：编制 / 审核同款名单 + 时间线，供签发→任务完成列表共用。
 */
(function (global) {
  var CSS = [
    '#flowRecordDrawer.rr-mask { position: fixed; inset: 0; z-index: 60; background: rgba(15, 23, 42, .45); }',
    '#flowRecordDrawer.rr-mask.hidden { display: none; }',
    '#flowRecordDrawer .rr-panel { position: fixed; top: 0; right: 0; bottom: 0; z-index: 61;',
    '  width: min(680px, 96vw); background: #fff; box-shadow: -8px 0 28px rgba(15, 23, 42, .16);',
    '  display: flex; flex-direction: column; transform: translateX(100%); transition: transform .22s ease; }',
    '#flowRecordDrawer.open .rr-panel { transform: translateX(0); }',
    '#flowRecordDrawer .rr-body { flex: 1; overflow: auto; padding: 16px 24px; }',
    '#flowRecordDrawer .audit-tl { list-style: none; margin: 0; padding: 2px 2px 0 0; }',
    '#flowRecordDrawer .audit-tl-item { display: grid; grid-template-columns: 20px 1fr; gap: 12px; }',
    '#flowRecordDrawer .audit-rail { position: relative; }',
    '#flowRecordDrawer .audit-rail::after { content: ""; position: absolute; left: 50%; top: 20px; bottom: 0; width: 2px;',
    '  transform: translateX(-50%); background: var(--audit-rail, #3b82f6); }',
    '#flowRecordDrawer .audit-tl-item:last-child .audit-rail::after { display: none; }',
    '#flowRecordDrawer .audit-dot { position: relative; z-index: 1; display: block; width: 16px; height: 16px;',
    '  margin: 2px auto 0; box-sizing: border-box; border-radius: 999px; border: 2px solid var(--audit-dot, #3b82f6);',
    '  background: var(--audit-dot, #3b82f6); }',
    '#flowRecordDrawer .audit-tl-item.is-pending .audit-dot { background: #fff; }',
    '#flowRecordDrawer .audit-tl-item.is-pass { --audit-rail: #3b82f6; --audit-dot: #3b82f6; }',
    '#flowRecordDrawer .audit-tl-item.is-reject { --audit-rail: #ef4444; --audit-dot: #ef4444; }',
    '#flowRecordDrawer .audit-tl-item.is-pending { --audit-rail: #f59e0b; --audit-dot: #f59e0b; }',
    '#flowRecordDrawer .audit-main { min-width: 0; padding: 0 0 20px; }',
    '#flowRecordDrawer .audit-tl-item:last-child .audit-main { padding-bottom: 2px; }',
    '#flowRecordDrawer .audit-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }',
    '#flowRecordDrawer .audit-title { font-size: 14px; font-weight: 500; color: #1e293b; }',
    '#flowRecordDrawer .audit-time { flex-shrink: 0; font-size: 12px; color: #94a3b8; }',
    '#flowRecordDrawer .audit-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 6px; }',
    '#flowRecordDrawer .audit-person { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; color: #334155; }',
    '#flowRecordDrawer .audit-avatar { display: inline-flex; width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 999px; color: #fff; font-size: 11px; }',
    '#flowRecordDrawer .audit-status { flex-shrink: 0; display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 500; }',
    '#flowRecordDrawer .audit-status.is-muted { color: #64748b; }',
    '#flowRecordDrawer .audit-status.is-pass { color: #16a34a; }',
    '#flowRecordDrawer .audit-status.is-reject { color: #dc2626; }',
    '#flowRecordDrawer .audit-status.is-pending { color: #d97706; }',
    '#flowRecordDrawer .audit-legend { display: flex; gap: 14px; font-size: 12px; color: #94a3b8; }',
    '#flowRecordDrawer .audit-legend span { display: inline-flex; align-items: center; gap: 4px; }',
    '#flowRecordDrawer .lg-dot { display: inline-block; width: 10px; height: 10px; border-radius: 999px; border: 2px solid #3b82f6; box-sizing: border-box; }',
    '#flowRecordDrawer .lg-pass { border-color: #3b82f6; background: #3b82f6; }',
    '#flowRecordDrawer .lg-reject { border-color: #ef4444; background: #ef4444; }',
    '#flowRecordDrawer .lg-pending { border-color: #f59e0b; background: #fff; }',
    '#flowRecordDrawer .rr-rep-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; text-align: left; background: #fff; width: 100%; }',
    '#flowRecordDrawer .rr-rep-card.is-on { border-color: #143C9A; box-shadow: inset 3px 0 0 #143C9A; background: linear-gradient(90deg, rgba(20,60,154,.08), #fff); }',
    '@media (prefers-reduced-motion: reduce) { #flowRecordDrawer .rr-panel { transition: none; } }'
  ].join('\n');

  var HTML = '<div id="flowRecordDrawer" class="rr-mask hidden" data-annotate="flow-record-drawer">' +
    '<aside class="rr-panel">' +
    '<div class="flex items-center justify-between border-b border-slate-100 px-6 py-3">' +
    '<div><h3 class="text-base font-medium text-slate-800">报告记录</h3>' +
    '<p id="flowRecordSubtitle" class="mt-0.5 text-xs text-slate-500"></p></div>' +
    '<button type="button" id="flowRecordClose" class="text-slate-400 hover:text-slate-600" aria-label="关闭"><i class="fa fa-times"></i></button></div>' +
    '<div class="rr-body">' +
    '<div class="mb-4"><div class="mb-2 flex items-center justify-between text-sm">' +
    '<span class="font-medium text-slate-700"><i class="fa fa-files-o mr-1 text-blue-600"></i>报告列表 <span id="flowRecordCount" class="font-normal text-slate-400"></span></span>' +
    '<span id="flowRecordSummary" class="text-xs text-slate-400"></span></div>' +
    '<div id="flowRecordRoster" class="space-y-2"></div></div>' +
    '<div class="border-t border-slate-100 pt-4">' +
    '<div class="mb-3 flex flex-wrap items-center justify-between gap-2">' +
    '<div class="flex flex-wrap items-center gap-x-3 gap-y-1">' +
    '<h4 class="text-sm font-medium text-slate-700">操作日志 <span id="flowLogReport" class="font-normal text-slate-400"></span></h4>' +
    '<span class="audit-legend"><span><i class="lg-dot lg-pass"></i>流转</span>' +
    '<span><i class="lg-dot lg-reject"></i>退回</span>' +
    '<span><i class="lg-dot lg-pending"></i>当前</span></span></div>' +
    '<button type="button" id="flowLogOrderBtn" class="text-xs text-blue-600 hover:underline">时间倒序</button></div>' +
    '<div id="flowRecordLog"></div></div></div></aside></div>';

  var state = { code: '', reportId: '', order: 'desc' };
  var hideTimer = null;
  var bound = false;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function avatarColor(name) {
    if (!name) return '#94a3b8';
    if (name.indexOf('AI') === 0 || name === '系统') return '#6366f1';
    var palette = ['#0d9488', '#38bdf8', '#34d399', '#a78bfa', '#f472b6', '#3b82f6', '#f59e0b', '#14b8a6'];
    var n = 0; for (var i = 0; i < name.length; i++) n = (n * 33 + name.charCodeAt(i)) >>> 0;
    return palette[n % palette.length];
  }
  function avatarMark(name) {
    if (!name) return '';
    if (name.indexOf('AI') === 0 || name === '系统') return '<i class="fa fa-bolt"></i>';
    return esc(String(name).charAt(0));
  }
  function toneOf(log) {
    if (log.tone === 'danger') return 'reject';
    if (log.tone === 'pending' || log.tone === 'warn') return 'pending';
    if (log.tone === 'default') return 'pass';
    return 'pass';
  }
  function logStatus(log) {
    var t = log.text || '';
    if (/退回/.test(t)) return { text: '退回', icon: 'fa-undo', tone: 'reject' };
    if (/预审结论：通过/.test(t)) return { text: '预审通过', icon: 'fa-check-circle', tone: 'pass' };
    if (/人工审核通过|审核通过/.test(t)) return { text: '审批通过', icon: 'fa-check-circle', tone: 'pass' };
    if (/提交至报告审核/.test(t)) return { text: '提交至报告审核', icon: 'fa-check-square-o', tone: 'muted' };
    if (/等待/.test(t)) return { text: '当前节点', icon: 'fa-clock-o', tone: 'pending' };
    if (/任务完成/.test(t)) return { text: '任务完成', icon: 'fa-check-circle', tone: 'pass' };
    if (/通过|归档/.test(t)) return { text: t, icon: 'fa-check-circle', tone: 'pass' };
    return { text: t, icon: 'fa-circle-o', tone: 'muted' };
  }
  function stateChip(task) {
    if (task.status === '已退回审核') return '<span class="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">已退回审核</span>';
    if (task.status === '任务完成') return '<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">已完成</span>';
    return '<span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">当前：' + esc(task.status) + '</span>';
  }
  function ensure() {
    if (!document.getElementById('flowRecordDrawerStyle')) {
      var st = document.createElement('style');
      st.id = 'flowRecordDrawerStyle';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    if (!document.getElementById('flowRecordDrawer')) {
      document.body.insertAdjacentHTML('beforeend', HTML);
    }
    if (bound) return;
    bound = true;
    var drawer = document.getElementById('flowRecordDrawer');
    drawer.addEventListener('click', function (e) {
      if (e.target === drawer) close();
    });
    drawer.querySelector('.rr-panel').addEventListener('click', function (e) { e.stopPropagation(); });
    document.getElementById('flowRecordClose').addEventListener('click', close);
    document.getElementById('flowLogOrderBtn').addEventListener('click', function () {
      state.order = state.order === 'desc' ? 'asc' : 'desc';
      paintLog();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) close();
    });
  }
  function paintRoster(task) {
    var reps = task.reports || [];
    document.getElementById('flowRecordCount').textContent = '· ' + reps.length + ' 份';
    document.getElementById('flowRecordSummary').textContent = task.customer || '';
    document.getElementById('flowRecordRoster').innerHTML = reps.map(function (rep) {
      return '<button type="button" class="rr-rep-card' + (rep.id === state.reportId ? ' is-on' : '') + '" data-rid="' + esc(rep.id) + '">' +
        '<div class="flex items-center justify-between gap-2"><span class="font-semibold text-slate-800">' + esc(rep.no || rep.id) + '</span>' + stateChip(task) + '</div>' +
        '<div class="mt-1 flex items-center justify-between text-xs text-slate-400"><span><i class="fa ' + (/\.pdf$/i.test(rep.name || '') ? 'fa-file-pdf-o' : 'fa-file-word-o') + ' mr-1"></i>' + esc(rep.name || '') + '</span><span>' + esc(rep.at || '') + '</span></div>' +
        '</button>';
    }).join('') || '<p class="py-4 text-center text-sm text-slate-400">暂无报告文件</p>';
    document.querySelectorAll('#flowRecordRoster .rr-rep-card').forEach(function (b) {
      b.addEventListener('click', function () {
        state.reportId = b.getAttribute('data-rid');
        paintRoster(task);
        paintLog();
      });
    });
  }
  function paintLog() {
    var task = global.ReportFlowStore && ReportFlowStore.get(state.code);
    if (!task) {
      document.getElementById('flowRecordLog').innerHTML = '<p class="py-6 text-center text-sm text-slate-400">暂无流转记录</p>';
      return;
    }
    var rep = (task.reports || []).filter(function (r) { return r.id === state.reportId; })[0] || (task.reports || [])[0];
    document.getElementById('flowLogReport').textContent = rep ? '· ' + (rep.no || rep.id) : '';
    document.getElementById('flowRecordSubtitle').textContent = (rep ? (rep.no || '') + ' · ' : '') + (task.code || '');
    var logs = (task.logs || []).slice();
    logs.sort(function (a, b) { return state.order === 'desc' ? (a.at < b.at ? 1 : -1) : (a.at < b.at ? -1 : 1); });
    document.getElementById('flowLogOrderBtn').textContent = state.order === 'desc' ? '时间倒序' : '时间正序';
    if (!logs.length) {
      document.getElementById('flowRecordLog').innerHTML = '<p class="py-6 text-center text-sm text-slate-400">暂无流转记录</p>';
      return;
    }
    document.getElementById('flowRecordLog').innerHTML = '<ol class="audit-tl">' + logs.map(function (log) {
      var tone = toneOf(log);
      var st = logStatus(log);
      var pending = tone === 'pending';
      var person = '<span class="audit-person"><span class="audit-avatar" style="background:' + avatarColor(log.by) + '">' + avatarMark(log.by) + '</span>' + esc(log.by || '系统') + '</span>';
      var status = '<span class="audit-status is-' + st.tone + '"><i class="fa ' + st.icon + '"></i>' + esc(st.text) + '</span>';
      var time = log.at ? '<time class="audit-time">' + esc(log.at) + (log.at.length < 19 ? ':00' : '') + '</time>' : '';
      var headRight = (pending && log.tone === 'pending') ? status : time;
      var second = (pending && log.tone === 'pending') ? '' : ('<div class="audit-row">' + person + status + '</div>');
      return '<li class="audit-tl-item is-' + tone + (pending ? ' is-pending' : '') + '"><div class="audit-rail" aria-hidden="true"><span class="audit-dot"></span></div>' +
        '<div class="audit-main"><div class="audit-head"><div class="audit-title">' + esc(log.node) + '</div>' + headRight + '</div>' + second + '</div></li>';
    }).join('') + '</ol>';
  }
  function open(code) {
    ensure();
    var task = global.ReportFlowStore && ReportFlowStore.get(code);
    if (!task) return false;
    state.code = code;
    state.reportId = (task.reports && task.reports[0]) ? task.reports[0].id : '';
    paintRoster(task);
    paintLog();
    var drawer = document.getElementById('flowRecordDrawer');
    clearTimeout(hideTimer);
    drawer.classList.remove('hidden');
    requestAnimationFrame(function () { drawer.classList.add('open'); });
    return true;
  }
  function close() {
    var drawer = document.getElementById('flowRecordDrawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { drawer.classList.add('hidden'); }, 220);
  }

  global.ReportRecordDrawer = { open: open, close: close };
})(window);
