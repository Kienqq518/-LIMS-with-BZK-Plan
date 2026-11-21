/**
 * 报告签发工作台：三栏仿审核（左待签发名单 + 日志，中报告与结论，右签发检查）。
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

  var state = { code: '', split: 'split', openGroups: {} };

  function list() { return ReportFlowStore.list('报告签发'); }

  function gateOf(task) { return ReportSignGate.evaluate(task); }

  function stampCls(stamp) {
    if (stamp === '不可签发') return 'fail';
    if (stamp === '核后可签') return 'warn';
    return 'pass';
  }
  function toneCls(st) {
    return st === 'block' ? 'r-sev' : (st === 'warn' ? 'r-warn' : 'r-pass');
  }
  function chip(st, label) {
    var cls = st === 'block' ? 'bg-red-50 text-red-700' : (st === 'warn' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700');
    var icon = st === 'block' ? 'fa-ban' : (st === 'warn' ? 'fa-exclamation-circle' : 'fa-check-circle');
    return '<span class="chip ' + cls + '"><i class="fa ' + icon + '"></i>' + esc(label) + '</span>';
  }

  function setCode(code, push) {
    state.code = code;
    if (push !== false) {
      var url = 'report-sign-edit.html?code=' + encodeURIComponent(code);
      if (location.search.indexOf('code=') >= 0) history.replaceState({}, '', url);
      else history.replaceState({}, '', url);
    }
  }

  function renderOverview(task, gate) {
    $('ov-code').textContent = task.code;
    $('ov-customer').textContent = task.customer;
    $('ov-sample').textContent = task.sample;
    $('ov-count').textContent = (task.reports || []).length;
    $('ov-accept').textContent = task.acceptDate || '—';
    $('ov-require').textContent = task.requireDate || '—';
    $('ov-status').textContent = task.status;
    $('ov-gate').innerHTML = chip(
      gate.locked ? 'block' : (gate.warn ? 'warn' : 'pass'),
      gate.stamp + ' · 通过 ' + gate.pass + ' / 待核 ' + gate.warn + ' / 阻断 ' + gate.block
    );
  }

  function rosterCard(task) {
    var g = gateOf(task);
    var active = task.code === state.code ? ' active' : '';
    return '<button type="button" class="roster-row' + active + ' mb-1 flex w-full flex-col gap-1 px-2.5 py-1.5 text-left" data-code="' + esc(task.code) + '">' +
      '<div class="flex items-center justify-between gap-2">' +
        '<span class="text-sm font-semibold text-slate-800 mono">' + esc(task.code) + '</span>' +
        chip(g.locked ? 'block' : (g.warn ? 'warn' : 'pass'), g.stamp) +
      '</div>' +
      '<div class="flex items-center justify-between gap-2 text-xs text-slate-400">' +
        '<span class="truncate">' + esc(task.sample) + '</span>' +
        '<span>阻断 ' + g.block + '</span>' +
      '</div>' +
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

  function renderCenter(task, gate) {
    var report = (task.reports && task.reports[0]) || { name: '检测报告', no: task.code, at: '' };
    $('sign-stamp').className = 'sum-stamp ' + stampCls(gate.stamp);
    $('sign-stamp').textContent = gate.stamp;
    var principle = gate.locked
      ? '一票否决：数据不可追溯、超资质或结论无依据，签发通过已锁定。'
      : (gate.warn
        ? '无阻断项。有待核项，签发人需过目后确认。'
        : '委托、样品、过程、结论与资质均通过系统预检，可签发。');
    $('sign-summary').innerHTML =
      '<p class="sum-body">' + esc(principle) + '</p>' +
      (gate.locked
        ? '<ul class="mt-2 space-y-1 text-xs text-red-700">' + gate.veto.map(function (v) {
          return '<li><i class="fa fa-ban mr-1"></i>' + esc(v.name) + ' — ' + esc(v.evidence) + '</li>';
        }).join('') + '</ul>'
        : '<p class="mt-2 text-xs text-slate-500">授权签字人核对报告结论后，在底栏执行签发。签发后进入报告处理。</p>');
    $('rp-file').innerHTML = '<i class="fa fa-file-word-o mr-1"></i>' + esc(report.name);
    $('rp-no').textContent = report.no || '';
    $('rp-at').textContent = report.at || '';
    $('rp-compiler').textContent = task.compiler || 'admin';
    var rec = (task.records && task.records[0]) || { name: '无原始记录', at: '' };
    $('raw-name').innerHTML = '<a class="hover:underline" style="color:var(--brand)" href="test-record.html?code=' + encodeURIComponent(task.code) + '">' + esc(rec.name) + '</a>';
    $('raw-at').textContent = rec.at || '—';
    $('spine-body').innerHTML = (gate.spine || []).map(function (row) {
      var bad = row.entrust !== row.record || row.sample !== row.report;
      return '<tr class="' + (bad ? 'bg-red-50' : '') + '">' +
        '<th class="border border-slate-200 bg-slate-50 px-2 py-1.5 text-left font-medium text-slate-500">' + esc(row.k) + '</th>' +
        '<td class="border border-slate-200 px-2 py-1.5">' + esc(row.entrust) + '</td>' +
        '<td class="border border-slate-200 px-2 py-1.5">' + esc(row.sample) + '</td>' +
        '<td class="border border-slate-200 px-2 py-1.5">' + esc(row.record) + '</td>' +
        '<td class="border border-slate-200 px-2 py-1.5">' + esc(row.report) + '</td></tr>';
    }).join('');
    var preview = $('report-preview');
    var src = 'transparent-demo/report-preview.html?code=' + encodeURIComponent(task.code) + '&embed=1';
    if (preview.getAttribute('src') !== src) preview.setAttribute('src', src);
  }

  function groupOpen(id, gate) {
    if (state.openGroups[id] != null) return state.openGroups[id];
    var g = gate.groups.filter(function (x) { return x.id === id; })[0];
    return !!(g && g.status !== 'pass');
  }

  function renderGate(gate) {
    $('gate-counts').innerHTML =
      chip('pass', '通过 ' + gate.pass) +
      chip('warn', '待核 ' + gate.warn) +
      chip('block', '阻断 ' + gate.block);
    $('gate-list').innerHTML = gate.groups.map(function (g) {
      var open = groupOpen(g.id, gate);
      return '<section class="gate-group mb-2" data-gid="' + g.id + '">' +
        '<button type="button" class="gate-toggle flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left ' + toneCls(g.status) + '">' +
          '<i class="fa ' + (open ? 'fa-angle-down' : 'fa-angle-right') + ' w-3 text-slate-400"></i>' +
          '<span class="flex-1 text-sm font-semibold text-slate-800">' + esc(g.title) + '</span>' +
          chip(g.status, (g.block ? ('阻断 ' + g.block) : (g.warn ? ('待核 ' + g.warn) : '通过'))) +
        '</button>' +
        '<p class="px-3 pt-1 text-[11px] text-slate-400">' + esc(g.hint) + '</p>' +
        '<div class="gate-body mt-1 space-y-1.5 px-1 ' + (open ? '' : 'hidden') + '">' +
          g.items.map(function (it) {
            return '<div class="rule-item ' + toneCls(it.status) + ' px-3 py-2">' +
              '<div class="flex items-start justify-between gap-2">' +
                '<div class="min-w-0 text-sm font-medium text-slate-800">' + esc(it.name) + '</div>' +
                chip(it.status, it.status === 'block' ? '阻断' : (it.status === 'warn' ? '待核' : '通过')) +
              '</div>' +
              '<div class="mt-1 text-xs text-slate-500">' + esc(it.evidence) + '</div>' +
              (it.advice ? '<div class="mt-1 text-xs" style="color:var(--brand)"><i class="fa fa-lightbulb-o mr-1"></i>' + esc(it.advice) + '</div>' : '') +
            '</div>';
          }).join('') +
        '</div></section>';
    }).join('');
    document.querySelectorAll('.gate-toggle').forEach(function (b) {
      b.addEventListener('click', function () {
        var sec = b.closest('.gate-group');
        var id = sec.getAttribute('data-gid');
        var body = sec.querySelector('.gate-body');
        var open = body.classList.toggle('hidden') === false;
        state.openGroups[id] = open;
        b.querySelector('i').className = 'fa ' + (open ? 'fa-angle-down' : 'fa-angle-right') + ' w-3 text-slate-400';
      });
    });
  }

  function renderActions(task, gate) {
    $('fb-report').textContent = task.code;
    $('fb-stamp').innerHTML = chip(gate.locked ? 'block' : (gate.warn ? 'warn' : 'pass'), gate.stamp);
    var passBtn = $('btn-pass');
    passBtn.disabled = !!gate.locked;
    passBtn.title = gate.locked ? '存在一票否决项，不能签发' : '签发通过，进入报告处理';
    $('lock-hint').classList.toggle('hidden', !gate.locked);
    $('lock-hint').textContent = gate.locked
      ? ('已锁定：' + gate.veto.map(function (v) { return v.name; }).join('；'))
      : '';
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
      $('sign-summary').innerHTML = '<p class="sum-body text-slate-400">没有待签发委托。</p>';
      $('btn-pass').disabled = true;
      $('btn-back').disabled = true;
      return;
    }
    setCode(code);
    state.openGroups = {};
    var gate = gateOf(task);
    renderOverview(task, gate);
    renderRoster();
    renderLog(task);
    renderCenter(task, gate);
    renderGate(gate);
    renderActions(task, gate);
    $('btn-back').disabled = false;
  }

  function bindChrome() {
    $('ov-toggle').addEventListener('click', function () {
      var open = $('ov-body').classList.toggle('hidden') === false;
      $('ov-toggle-text').textContent = open ? '收起' : '展开';
      $('ov-chevron').className = 'fa fa-angle-' + (open ? 'up' : 'down');
    });
    $('btn-expand-center').addEventListener('click', function () {
      state.split = state.split === 'center' ? 'split' : 'center';
      $('wb-main').classList.toggle('is-center-only', state.split === 'center');
      $('wb-main').classList.remove('is-right-only');
    });
    $('btn-expand-right').addEventListener('click', function () {
      state.split = state.split === 'right' ? 'split' : 'right';
      $('wb-main').classList.toggle('is-right-only', state.split === 'right');
      $('wb-main').classList.remove('is-center-only');
    });
    $('btn-back').addEventListener('click', function () {
      var task = ReportFlowStore.get(state.code);
      if (!task) return;
      var reason = ($('fb-reason').value || '').trim();
      if (!reason) { $('fb-reason').focus(); alert('退回须填写原因'); return; }
      ReportFlowStore.back(task.code, reason);
      location.href = 'report-sign.html';
    });
    var fileLink = $('rp-file');
    if (fileLink) fileLink.addEventListener('click', function (e) { e.preventDefault(); });
    $('btn-pass').addEventListener('click', function () {
      var task = ReportFlowStore.get(state.code);
      if (!task) return;
      var gate = gateOf(task);
      if (gate.locked) return;
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
