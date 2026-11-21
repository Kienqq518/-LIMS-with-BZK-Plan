/**
 * 报告签发工作台：左待签发名单 + 日志，中看报告文件 / 预览 / 收样 / 检测，底签发处置。
 * 签发人只核对报告内容，不再跑 AI 检测项门禁。
 */
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function qp(name) {
    var m = new RegExp('[?&]' + name + '=([^&]+)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  var state = { code: '', panel: 'preview', expand: false };

  function list() { return ReportFlowStore.list('报告签发'); }

  function setCode(code) {
    state.code = code;
    var url = 'report-sign-edit.html?code=' + encodeURIComponent(code);
    history.replaceState({}, '', url);
  }

  function renderOverview(task) {
    $('ov-code').textContent = task.code;
    $('ov-customer').textContent = task.customer;
    $('ov-sample').textContent = task.sample;
    $('ov-count').textContent = (task.reports || []).length;
    $('ov-accept').textContent = task.acceptDate || '—';
    $('ov-require').textContent = task.requireDate || '—';
    $('ov-status').textContent = task.status;
  }

  function rosterCard(task) {
    var active = task.code === state.code ? ' active' : '';
    return '<button type="button" class="roster-row' + active + ' mb-1 flex w-full flex-col gap-1 px-2.5 py-1.5 text-left" data-code="' + esc(task.code) + '">' +
      '<div class="flex items-center justify-between gap-2">' +
        '<span class="text-sm font-semibold text-slate-800 mono">' + esc(task.code) + '</span>' +
        '<span class="chip bg-blue-50 text-blue-700">待签发</span>' +
      '</div>' +
      '<div class="truncate text-xs text-slate-400">' + esc(task.sample) + '</div>' +
    '</button>';
  }

  function renderRoster() {
    var rows = list();
    $('tab-need-n').textContent = String(rows.length);
    $('roster-list').innerHTML = rows.length
      ? rows.map(rosterCard).join('')
      : '<div class="px-2 py-6 text-center text-xs text-slate-400">当前没有待签发任务</div>';
    $('roster-summary').textContent = rows.length ? ('本节点 ' + rows.length + ' 份委托待签发') : '本节点已清空';
    document.querySelectorAll('#roster-list .roster-row').forEach(function (b) {
      b.addEventListener('click', function () { select(b.getAttribute('data-code')); });
    });
  }

  function renderLog(task) {
    $('log-report').textContent = '· ' + task.code;
    var logs = task.logs || [];
    $('log-list').innerHTML = logs.length
      ? '<ul class="audit-tl">' + logs.map(function (e) {
        var tone = e.tone === 'success' ? 'tone-success' : (e.tone === 'danger' ? 'tone-danger' : (e.tone === 'pending' ? 'tone-pending' : 'tone-warn'));
        return '<li class="audit-tl-item ' + tone + '"><div class="audit-rail"><span class="audit-dot"></span></div>' +
          '<div class="audit-main"><div class="flex items-baseline justify-between gap-2">' +
            '<span class="font-medium text-slate-700">' + esc(e.node) + '</span>' +
            '<time class="text-[11px] text-slate-400">' + esc(e.at) + '</time></div>' +
            '<div class="mt-1 text-slate-500">' + esc(e.by) + ' · ' + esc(e.text) + '</div></div></li>';
      }).join('') + '</ul>'
      : '<p class="text-slate-400">暂无操作日志</p>';
  }

  function renderInfo(task) {
    if (global.ReportInfoPanel) ReportInfoPanel.render(task, state.panel);
  }

  function renderActions(task) {
    $('fb-report').textContent = task.code;
    $('btn-pass').disabled = false;
    $('btn-back').disabled = false;
  }

  function select(code) {
    var rows = list();
    var task = ReportFlowStore.get(code);
    if (!task || task.status !== '报告签发') {
      task = rows[0] || null;
      code = task ? task.code : '';
    }
    if (!task) {
      state.code = '';
      $('ov-code').textContent = '—';
      $('ov-customer').textContent = '';
      $('ov-sample').textContent = '';
      $('roster-list').innerHTML = '<div class="px-2 py-6 text-center text-xs text-slate-400">当前没有待签发任务</div>';
      $('btn-pass').disabled = true;
      $('btn-back').disabled = true;
      return;
    }
    setCode(code);
    renderOverview(task);
    renderRoster();
    renderLog(task);
    renderInfo(task);
    renderActions(task);
  }

  function bindChrome() {
    $('ov-toggle').addEventListener('click', function () {
      var open = $('ov-body').classList.toggle('hidden') === false;
      $('ov-toggle-text').textContent = open ? '收起' : '展开';
      $('ov-chevron').className = 'fa fa-angle-' + (open ? 'up' : 'down');
    });
    $('btn-expand-info').addEventListener('click', function () {
      state.expand = !state.expand;
      document.querySelector('.wb-left').classList.toggle('hidden', state.expand);
      var lab = $('btn-expand-info').querySelector('[data-split-label]');
      if (lab) lab.textContent = state.expand ? '还原' : '展开';
      var ic = $('btn-expand-info').querySelector('i');
      if (ic) ic.className = 'fa ' + (state.expand ? 'fa-compress' : 'fa-expand') + ' mr-1';
    });
    document.querySelectorAll('.info-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.info-tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        state.panel = b.getAttribute('data-panel');
        var task = ReportFlowStore.get(state.code);
        if (task) renderInfo(task);
      });
    });
    $('btn-back').addEventListener('click', function () {
      var task = ReportFlowStore.get(state.code);
      if (!task) return;
      var reason = ($('fb-reason').value || '').trim();
      if (!reason) { $('fb-reason').focus(); alert('退回须填写原因'); return; }
      ReportFlowStore.back(task.code, reason);
      location.href = 'report-sign.html';
    });
    $('btn-pass').addEventListener('click', function () {
      var task = ReportFlowStore.get(state.code);
      if (!task) return;
      ReportFlowStore.pass(task.code, '签发通过');
      location.href = 'report-sign.html';
    });
  }

  function boot() {
    bindChrome();
    var code = qp('code');
    var rows = list();
    if (!code && rows[0]) code = rows[0].code;
    select(code);
  }

  global.ReportSignWorkbench = { boot: boot, select: select };
})(window);
