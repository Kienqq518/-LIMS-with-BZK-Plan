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

  var state = { code: '', panel: 'preview', ovTab: 'entrust', order: 'desc' };

  function list() { return ReportFlowStore.list('报告签发'); }

  function setCode(code) {
    state.code = code;
    var url = 'report-sign-edit.html?code=' + encodeURIComponent(code);
    history.replaceState({}, '', url);
  }

  function ovRow(label, val) {
    return '<div><span class="text-slate-400">' + label + '：</span><span class="text-slate-700">' + esc(val) + '</span></div>';
  }
  function ovFileIcon(type) { return type === 'word' ? 'fa-file-word-o' : 'fa-file-pdf-o'; }
  function ovAttach(title, files, extraHead) {
    extraHead = extraHead || '';
    return '<div class="mt-3 border-t border-white/50 pt-2">' +
      '<div class="mb-1.5 text-xs font-medium text-slate-500"><i class="fa fa-paperclip mr-1"></i>' + esc(title) + '</div>' +
      '<div class="overflow-x-auto"><table class="w-full min-w-[480px] border-collapse text-left text-xs">' +
      '<thead><tr class="text-slate-400">' +
      '<th class="w-10 py-1 font-medium">序号</th><th class="py-1 font-medium">' + esc(title) + '</th>' + extraHead +
      '<th class="py-1 font-medium">生成时间</th><th class="w-14 py-1 font-medium">操作</th></tr></thead><tbody>' +
      files.map(function (f, i) {
        return '<tr class="text-slate-600">' +
          '<td class="py-1">' + (i + 1) + '</td>' +
          '<td class="py-1"><a href="#" class="ov-file hover:underline" style="color:var(--brand)" data-file="' + esc(f.name) + '"><i class="fa ' + ovFileIcon(f.type) + ' mr-1"></i>' + esc(f.name) + '</a></td>' +
          (f.amount != null ? '<td class="py-1">' + esc(f.amount) + '</td>' : '') +
          '<td class="py-1 mono">' + esc(f.at) + '</td>' +
          '<td class="py-1"><button type="button" class="ov-file text-blue-600 hover:underline" data-file="' + esc(f.name) + '">查看</button></td></tr>';
      }).join('') +
      '</tbody></table></div></div>';
  }
  function overviewSrc(task) {
    var e = null;
    try { e = global.ReportReviewMock && ReportReviewMock.getEntrust(task.code); } catch (err) { e = null; }
    if (e) return e;
    return {
      code: task.code, customer: task.customer, sample: task.sample,
      acceptDate: task.acceptDate, requireDate: task.requireDate, sendDate: task.sendDate,
      compiler: task.compiler, status: task.status, priority: task.priority,
      contractInfo: {
        frame: (task.contract && task.contract !== '/') ? '是' : '否',
        contractNo: task.contract || '/', signPlace: '—', signDate: task.acceptDate || '—', center: '应敏科技有限公司'
      },
      payInfo: { total: '—', actual: '—', discount: '—', way: '—', payer: task.customer || '—', note: '/' },
      reportInfo: { send: '—', qualify: '—', desc: '—', resultMode: '—', lang: '中文', copies: (task.reports || []).length }
    };
  }
  function ovPanel(task, tab) {
    var e = overviewSrc(task);
    var html;
    if (tab === 'contract') {
      var c = e.contractInfo || {};
      var cNo = (c.contractNo && c.contractNo !== '/') ? c.contractNo : e.code.replace('/', '-');
      html = '<div class="grid grid-cols-2 gap-x-6 gap-y-1.5 md:grid-cols-3">' + ovRow('是否框架合同', c.frame) + ovRow('合同编号', c.contractNo) + ovRow('签约地点', c.signPlace) + ovRow('签约日期', c.signDate) + ovRow('检测中心', c.center) + '</div>';
      html += ovAttach('合同附件', [{ name: cNo + '-合同.pdf', type: 'pdf', at: (c.signDate || e.acceptDate || '') + ' 10:00' }]);
      return html;
    }
    if (tab === 'pay') {
      var p = e.payInfo || {};
      html = '<div class="grid grid-cols-2 gap-x-6 gap-y-1.5 md:grid-cols-3">' + ovRow('样品检测总价(元)', p.total) + ovRow('实际费用(元)', p.actual) + ovRow('折扣率(%)', p.discount) + ovRow('付款方式', p.way) + ovRow('付款单位', p.payer) + ovRow('业务备注', p.note) + '</div>';
      html += ovAttach('收费通知单', [{ name: e.code + '-收费通知单.pdf', type: 'pdf', at: (e.acceptDate || '') + ' 09:20', amount: p.actual }], '<th class="py-1 font-medium">金额(元)</th>');
      return html;
    }
    if (tab === 'report') {
      var r = e.reportInfo || {};
      return '<div class="grid grid-cols-2 gap-x-6 gap-y-1.5 md:grid-cols-3">' + ovRow('报告传送方式', r.send) + ovRow('报告资质', r.qualify) + ovRow('结果方式', r.resultMode) + ovRow('报告语言', r.lang) + ovRow('份数', r.copies) + ovRow('报告描述', r.desc) + '</div>';
    }
    html = '<div class="grid grid-cols-2 gap-x-6 gap-y-1.5 md:grid-cols-3">' + ovRow('委托编号', task.code || e.code) + ovRow('客户单位', task.customer || e.customer) + ovRow('样品名称', task.sample || e.sample) + ovRow('优先等级', task.priority || e.priority) + ovRow('送样时间', task.sendDate || e.sendDate) + ovRow('要求完成', task.requireDate || e.requireDate) + ovRow('受理日期', task.acceptDate || e.acceptDate) + ovRow('编制人', task.compiler || e.compiler) + ovRow('任务状态', task.status || e.status) + '</div>';
    html += ovAttach('检测委托书', [
      { name: e.code + '-检测委托书.docx', type: 'word', at: (e.acceptDate || '') + ' 09:12' },
      { name: e.code + '-检测委托书.pdf', type: 'pdf', at: (e.acceptDate || '') + ' 09:12' }
    ]);
    return html;
  }
  function renderOverview(task) {
    $('ov-code').textContent = task.code;
    $('ov-customer').textContent = task.customer;
    $('ov-sample').textContent = task.sample;
    $('ov-count').textContent = (task.reports || []).length;
    $('ov-accept').textContent = task.acceptDate || '—';
    $('ov-require').textContent = task.requireDate || '—';
    $('ov-status').textContent = task.status;
    if ($('ov-panel')) $('ov-panel').innerHTML = ovPanel(task, state.ovTab);
  }

  function rosterCard(task) {
    var active = task.code === state.code ? ' active' : '';
    var rec = global.ReturnStore ? ReturnStore.latestFor(task.code, '报告签发') : null;
    var tag = rec && global.ReturnUI ? ReturnUI.tagHtml({ title: rec.reason || '' }) : '';
    return '<button type="button" class="roster-row' + active + ' mb-1 flex w-full flex-col gap-1 px-2.5 py-1.5 text-left" data-code="' + esc(task.code) + '">' +
      '<div class="flex items-center justify-between gap-2">' +
        '<span class="flex min-w-0 items-center text-sm font-semibold text-slate-800 mono">' + esc(task.code) + tag + '</span>' +
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
    var btn = $('wbLogOrderBtn');
    if (btn) btn.textContent = state.order === 'desc' ? '时间倒序' : '时间正序';
    var logs = global.AuditLog ? AuditLog.present(task.logs || [], state.order, task.status || '') : (task.logs || []);
    $('log-list').innerHTML = logs.length
      ? '<ol class="audit-tl">' + logs.map(function (e) { return AuditLog.itemHtml(e); }).join('') + '</ol>'
      : '<p class="py-6 text-center text-sm text-slate-400">暂无操作日志</p>';
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
    document.querySelectorAll('.ov-tab').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        document.querySelectorAll('.ov-tab').forEach(function (x) {
          x.className = 'ov-tab rounded-lg px-3 py-1 text-slate-500';
          x.removeAttribute('style');
        });
        b.className = 'ov-tab rounded-lg px-3 py-1';
        b.setAttribute('style', 'background:rgba(20,60,154,.08);color:var(--brand)');
        state.ovTab = b.getAttribute('data-tab');
        var task = ReportFlowStore.get(state.code);
        if (task && $('ov-panel')) $('ov-panel').innerHTML = ovPanel(task, state.ovTab);
      });
    });
    if ($('ov-panel')) {
      $('ov-panel').addEventListener('click', function (ev) {
        var a = ev.target.closest('.ov-file');
        if (!a) return;
        ev.preventDefault();
        if (global.ReportInfoPanel && ReportInfoPanel.openPageOffice) ReportInfoPanel.openPageOffice(a.getAttribute('data-file'));
        else alert('PageOffice 插件预览：' + a.getAttribute('data-file') + '（原型占位）');
      });
    }
    document.querySelectorAll('.info-tab').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.info-tab').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        state.panel = b.getAttribute('data-panel');
        var task = ReportFlowStore.get(state.code);
        if (task) renderInfo(task);
      });
    });
    if ($('wbLogOrderBtn')) {
      $('wbLogOrderBtn').addEventListener('click', function () {
        state.order = state.order === 'desc' ? 'asc' : 'desc';
        var task = ReportFlowStore.get(state.code);
        if (task) renderLog(task);
      });
    }
    $('btn-back').addEventListener('click', function () {
      var task = ReportFlowStore.get(state.code);
      if (!task) return;
      var reason = ($('fb-reason').value || '').trim();
      if (!reason) { $('fb-reason').focus(); return; }
      ReportFlowStore.back(task.code, reason, { to: '报告审核' });
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
