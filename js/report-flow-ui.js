/**
 * 报告签发 → 任务完成 列表 / 弹窗
 */
(function (global) {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  }); }

  var META = {
    '报告签发': { action: '去签发', pass: '签发通过', kind: 'edit', href: 'report-sign-edit.html' },
    '报告处理': { action: '处理', pass: '处理通过', kind: 'modal' },
    '收费审批': { action: '审批', pass: '审批通过', kind: 'modal' },
    '报告发放': { action: '发放', pass: '发放通过', kind: 'issue' },
    '任务归档': { action: '归档', pass: '归档', kind: 'archive' },
    '任务完成': { action: '查看', pass: '', kind: 'view' }
  };

  function catOf(sample) {
    var st = global.SampleDataStore;
    if (!st || !st.catLabelOfNames) return '—';
    return st.catLabelOfNames(sample) || '—';
  }
  function catOptions() {
    var st = global.SampleDataStore;
    var labels = st && st.CAT_LABELS
      ? Object.keys(st.CAT_LABELS).map(function (k) { return st.CAT_LABELS[k]; })
      : ['电力物资类', '安全工器具类', '环境检测', '工程检测'];
    return '<option value="">请选择样品大类</option>' + labels.map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + '</option>';
    }).join('');
  }
  function searchHtml() {
    return '<div class="rounded bg-white p-4 shadow-sm">' +
      '<div class="ui-search-grid grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-4">' +
      field('委托编号', '<input id="f_code" type="text" placeholder="请输入委托编号" class="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />') +
      field('是否关联框架合同', '<select id="f_frame" class="flex-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500"><option value="">请选择是否关联</option><option>是</option><option>否</option></select>') +
      field('合同编号', '<input id="f_contract" type="text" placeholder="请输入框架合同编号" class="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />') +
      field('客户单位', '<input id="f_unit" type="text" placeholder="请输入委托单位" class="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />') +
      field('样品名称', '<input id="f_sample" type="text" placeholder="请输入样品名称" class="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />') +
      field('样品大类', '<select id="f_cat" class="flex-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500">' + catOptions() + '</select>') +
      '<div class="flex items-center gap-2"><label class="w-28 flex-shrink-0 text-right text-sm text-slate-600">委托受理日期</label>' +
      '<div class="flex flex-1 items-center gap-1"><input id="f_from" type="text" placeholder="开始日期" class="w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" /><span class="text-slate-400">—</span>' +
      '<input id="f_to" type="text" placeholder="结束日期" class="w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" /></div></div>' +
      '<div class="flex items-center gap-2 ui-search-actions">' +
      '<button type="button" id="btn-search" class="flex items-center gap-1 rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"><i class="fa fa-search"></i>查询</button>' +
      '<button type="button" id="btn-reset" class="flex items-center gap-1 rounded border border-slate-300 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><i class="fa fa-refresh"></i>重置</button>' +
      '</div></div></div>';
  }
  function field(label, control) {
    return '<div class="flex items-center gap-2"><label class="w-28 flex-shrink-0 text-right text-sm text-slate-600">' + label + '</label>' + control + '</div>';
  }

  function recLink(code) {
    return '<a href="#" class="text-blue-600 hover:underline whitespace-nowrap" data-record="' + esc(code) + '"><i class="fa fa-file-text-o mr-1"></i>报告记录</a>';
  }
  function opsHtml(stage, row) {
    var m = META[stage];
    if (m.kind === 'edit') {
      return '<a class="text-blue-600 hover:underline" data-annotate="flow-open" href="' + m.href + '?code=' + encodeURIComponent(row.code) + '"><i class="fa fa-pencil mr-1"></i>' + m.action + '</a>';
    }
    if (m.kind === 'view') {
      return '<a class="text-blue-600 hover:underline" data-annotate="flow-open" href="#" data-ship="' + esc(row.code) + '"><i class="fa fa-eye mr-1"></i>查看</a>';
    }
    if (m.kind === 'archive') {
      return '<span data-annotate="flow-open"><button type="button" class="text-emerald-600 hover:underline" data-pass="' + esc(row.code) + '"><i class="fa fa-check-circle-o mr-1"></i>归档</button>' +
        ' <button type="button" class="ml-1 text-orange-500 hover:underline" data-back="' + esc(row.code) + '"><i class="fa fa-undo mr-1"></i>退回</button></span>';
    }
    return '<button type="button" class="text-blue-600 hover:underline" data-annotate="flow-open" data-open="' + esc(row.code) + '"><i class="fa fa-list-alt mr-1"></i>' + m.action + '</button>';
  }

  function tableHtml(stage, list) {
    var colN = 15;
    var body = list.map(function (r, i) {
      return '<tr class="hover:bg-slate-50">' +
        '<td class="border border-slate-200 px-3 py-2">' + (i + 1) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' +
        (global.ReturnUI && stage !== '任务归档' && stage !== '任务完成'
          ? ReturnUI.codeWithTag(r.code, stage, '<a class="text-blue-600 hover:underline" href="entrust-detail.html?code=' + encodeURIComponent(r.code) + '">' + esc(r.code) + '</a>')
          : '<a class="text-blue-600 hover:underline" href="entrust-detail.html?code=' + encodeURIComponent(r.code) + '">' + esc(r.code) + '</a>') +
        '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.contract) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.customer) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.sample) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(catOf(r.sample)) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.sendDate) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.requireDate) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.acceptDate) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2"><span class="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-600">' + esc(r.prepaid) + '</span></td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.priority) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(stageLabel(stage, r)) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.compiler) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + recLink(r.code) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2 whitespace-nowrap">' + opsHtml(stage, r) + '</td></tr>';
    }).join('');
    if (!list.length) body = '<tr><td colspan="' + colN + '" class="border border-slate-200 px-3 py-10 text-center text-sm text-slate-400">当前节点暂无任务</td></tr>';
    var opsHead = stage === '任务完成' ? '发放记录' : '操作';
    return '<div class="mt-4 rounded bg-white p-4 shadow-sm"><div class="overflow-x-auto"><table class="w-full border-collapse text-left text-sm" style="min-width:1680px">' +
      '<thead><tr class="bg-slate-100 text-slate-600">' +
      '<th class="border border-slate-200 px-3 py-2 font-medium w-[72px]" style="white-space:nowrap">序号</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">委托编号</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">合同编号</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">客户单位</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">样品名称</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">样品大类</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">送样时间</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">客户要求完成日期</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">委托受理日期</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">先收费</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">优先等级</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">任务状态</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">编制人</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">报告记录</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap;width:1%">' + opsHead + '</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="mt-4 flex items-center justify-end gap-2 text-sm text-slate-500"><span>共 ' + list.length + ' 条</span>' +
      '<button type="button" class="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-300" disabled><i class="fa fa-angle-left"></i></button>' +
      '<button type="button" class="flex h-7 w-7 items-center justify-center rounded bg-blue-600 text-white">1</button>' +
      '<button type="button" class="flex h-7 w-7 items-center justify-center rounded border border-slate-200" disabled><i class="fa fa-angle-right"></i></button>' +
      '<span>50条/页</span></div></div>';
  }

  function modalShell() {
    var el = document.getElementById('flow-modal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'flow-modal';
    el.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-slate-900/45 p-4';
    el.innerHTML = '<div class="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl" id="flow-modal-panel"></div>';
    el.addEventListener('click', function (e) { if (e.target === el) closeModal(); });
    document.body.appendChild(el);
    return el;
  }
  function openModal(html) {
    closeShipLayer();
    var el = modalShell();
    document.getElementById('flow-modal-panel').innerHTML = html;
    el.classList.remove('hidden');
    el.classList.add('flex');
  }
  function closeModal() {
    closeShipLayer();
    var el = document.getElementById('flow-modal');
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
  }

  function closeShipLayer() {
    var el = document.getElementById('flow-ship-layer');
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
  }
  function shipLayer() {
    var el = document.getElementById('flow-ship-layer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'flow-ship-layer';
      el.className = 'fixed inset-0 z-[80] hidden items-center justify-center bg-slate-900/45 p-4';
      el.addEventListener('click', function (e) {
        if (e.target === el || e.target.closest('[data-ship-close]')) closeShipLayer();
      });
      document.body.appendChild(el);
    }
    return el;
  }
  function openReportShip(code, reportId) {
    var task = ReportFlowStore.get(code); if (!task) return;
    var r = (task.reports || []).filter(function (x) { return String(x.id) === String(reportId); })[0];
    var ship = (r && r.ship) || (task && task.ship) || null;
    var title = '报告发放记录' + (r && r.no ? ' · ' + esc(r.no) : '');
    var body = ship
      ? '<table class="w-full min-w-[820px] border-collapse text-left text-sm" data-no-col-config><thead><tr class="bg-slate-50 text-slate-600">' +
        '<th class="whitespace-nowrap border border-slate-200 px-3 py-2">快递公司</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">快递单号</th>' +
        '<th class="whitespace-nowrap border border-slate-200 px-3 py-2">地址</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">联系人</th>' +
        '<th class="whitespace-nowrap border border-slate-200 px-3 py-2">联系方式</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">发放日期</th>' +
        '<th class="whitespace-nowrap border border-slate-200 px-3 py-2">备注</th></tr></thead><tbody><tr>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(ship.company) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(ship.tracking) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(ship.address) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(ship.contact) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(ship.phone) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(ship.date) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(ship.note || '') + '</td></tr></tbody></table>'
      : '<div class="py-8 text-center text-sm text-slate-400">暂无该报告的发放记录</div>';
    var el = shipLayer();
    el.innerHTML = '<div class="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">' +
      '<div class="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h3 class="text-base font-medium text-slate-800">' + title + '</h3>' +
      '<button type="button" class="text-slate-400 hover:text-slate-600" data-ship-close><i class="fa fa-times"></i></button></div>' +
      '<div class="flex-1 overflow-auto p-5">' + body + '</div>' +
      '<div class="flex justify-end border-t border-slate-100 px-5 py-3">' +
      '<button type="button" class="rounded border border-slate-300 px-4 py-1.5 text-sm" data-ship-close>关闭</button></div></div>';
    el.classList.remove('hidden');
    el.classList.add('flex');
  }

  function stageLabel(stage, task) {
    if (!global.ReportFlowStore || !ReportFlowStore.reportsAt) return task.status;
    var total = (task.reports || []).length;
    var here = ReportFlowStore.reportsAt(task, stage).length;
    if (total > 1 && here > 0 && here < total) return stage + '（' + here + '/' + total + '）';
    return stage || task.status;
  }
  function reportsOnStage(task, stage) {
    if (!stage || !global.ReportFlowStore || !ReportFlowStore.reportsAt) return task.reports || [];
    if (stage !== '报告处理' && stage !== '收费审批' && stage !== '报告发放') return task.reports || [];
    var at = ReportFlowStore.reportsAt(task, stage);
    if (stage === '报告发放') {
      var issued = (task.reports || []).filter(function (r) { return r.issued; });
      return issued.concat(at);
    }
    return at;
  }
  function fileIcon(name) {
    return /\.pdf$/i.test(name || '') ? 'fa-file-pdf-o' : 'fa-file-word-o';
  }
  function displayReportName(task, r) {
    if (global.ReportFlowStore && ReportFlowStore.isSigned && ReportFlowStore.isSigned(task.status)) {
      return r.pdf || (r.name || '').replace(/\.docx$/i, '.pdf') || r.name;
    }
    return r.word || r.name;
  }
  function reportRows(task, withCheck, issueMode, stage) {
    var list = reportsOnStage(task, stage);
    return list.map(function (r, i) {
      var fname = displayReportName(task, r);
      var issued = !!r.issued;
      var hits = (task.returns || []).filter(function (x) {
        var mine = !x.reportNo || x.reportNo === r.no || x.reportNo === r.id;
        if (!mine) return false;
        if (stage && x.to && x.to !== stage) return false;
        return true;
      });
      var retTag = (global.ReturnUI && hits.length)
        ? ReturnUI.tagHtml({ title: '从「' + (hits[0].from || '') + '」退回' + (hits[0].reportNo ? ' · ' + hits[0].reportNo : '') + ' · ' + (hits[0].reason || '') })
        : '';
      var checkCell = '';
      if (withCheck) {
        checkCell = issued
          ? '<td class="border border-slate-200 px-3 py-2 text-center"><input type="checkbox" checked disabled title="已发放，不可再勾选" class="cursor-not-allowed opacity-50" /></td>'
          : '<td class="border border-slate-200 px-3 py-2 text-center"><input type="checkbox" class="rep-check" checked data-id="' + esc(r.id) + '" data-no="' + esc(r.no || r.id) + '" /></td>';
      }
      var opCell = issueMode
        ? (issued
          ? '<td class="border border-slate-200 px-3 py-2"><a class="text-blue-600 hover:underline" href="#" data-view-ship data-code="' + esc(task.code) + '" data-id="' + esc(r.id) + '">查看发放记录</a></td>'
          : '<td class="border border-slate-200 px-3 py-2"></td>')
        : '<td class="border border-slate-200 px-3 py-2"><a class="text-blue-600 hover:underline" href="transparent-demo/report-preview.html?code=' + encodeURIComponent(task.code) + '" target="_blank">预览</a></td>';
      return '<tr class="' + (issued ? 'bg-slate-50 text-slate-400' : '') + '">' +
        checkCell +
        '<td class="border border-slate-200 px-3 py-2">' + (i + 1) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.no) + retTag + '</td>' +
        '<td class="border border-slate-200 px-3 py-2"><a class="text-blue-600 hover:underline" href="transparent-demo/report-preview.html?code=' + encodeURIComponent(task.code) + '" target="_blank"><i class="fa ' + fileIcon(fname) + ' mr-1"></i>' + esc(fname) + '</a></td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.at) + '</td>' +
        opCell + '</tr>';
    }).join('');
  }

  function reportsTable(task, withCheck, issueMode, stage) {
    return '<table class="w-full border-collapse text-left text-sm" data-no-col-config data-annotate="flow-rep-table"><thead><tr class="bg-slate-50 text-slate-600">' +
      (withCheck ? '<th class="border border-slate-200 px-3 py-2 w-10 text-center"><input type="checkbox" id="check-all" checked /></th>' : '') +
      '<th class="border border-slate-200 px-3 py-2">序号</th><th class="border border-slate-200 px-3 py-2">报告编号</th><th class="border border-slate-200 px-3 py-2">报告名称</th>' +
      '<th class="border border-slate-200 px-3 py-2">生成时间</th><th class="border border-slate-200 px-3 py-2">操作</th></tr></thead><tbody>' +
      reportRows(task, withCheck, issueMode, stage) + '</tbody></table>';
  }

  function checkedCount() {
    return document.querySelectorAll('#flow-modal .rep-check:checked').length;
  }

  function syncModalPass() {
    var btn = document.querySelector('#flow-modal [data-modal-pass]');
    if (!btn) return;
    var boxes = document.querySelectorAll('#flow-modal .rep-check');
    if (!boxes.length) return;
    var n = checkedCount();
    var needShip = btn.getAttribute('data-need-ship') === '1';
    var hasShip = btn.getAttribute('data-has-ship') === '1';
    var ok = n > 0 && (!needShip || hasShip);
    btn.disabled = !ok;
    btn.classList.toggle('opacity-50', !ok);
    btn.classList.toggle('cursor-not-allowed', !ok);
    btn.title = n < 1 ? '请勾选至少一份报告' : (needShip && !hasShip ? '请先填写发放信息' : '');
    var all = document.getElementById('check-all');
    if (all) all.checked = n === boxes.length && n > 0;
  }

  function bindChecks() {
    var all = document.getElementById('check-all');
    var boxes = document.querySelectorAll('#flow-modal .rep-check');
    if (all) {
      all.addEventListener('change', function () {
        [].forEach.call(boxes, function (c) { c.checked = all.checked; });
        syncModalPass();
      });
    }
    [].forEach.call(boxes, function (c) {
      c.addEventListener('change', syncModalPass);
    });
    syncModalPass();
  }

  function stepChip(n, label, on) {
    return '<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs ' +
      (on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500') + '">' + n + ' ' + label + '</span>';
  }

  function shipRecordsHtml(task, opts) {
    opts = opts || {};
    var readonly = !!opts.readonly;
    var code = task.code;
    var ship = task.ship;
    var opCell = readonly
      ? '<td class="border border-slate-200 px-3 py-2 text-slate-400">—</td>'
      : '<td class="border border-slate-200 px-3 py-2 whitespace-nowrap"><button type="button" class="text-blue-600" data-addr="' + esc(code) + '">编辑</button> <button type="button" class="ml-2 text-red-500" data-del-ship="' + esc(code) + '">删除</button></td>';
    var title = opts.hideTitle ? '' : '<div class="text-sm font-medium text-slate-700">报告发放记录</div>';
    return title +
      '<div class="' + (opts.hideTitle ? '' : 'mt-2 ') + 'overflow-x-auto"><table class="w-full min-w-[920px] border-collapse text-left text-sm" data-no-col-config><thead><tr class="bg-slate-50 text-slate-600">' +
      '<th class="whitespace-nowrap border border-slate-200 px-3 py-2">序号</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">快递公司</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">快递单号</th>' +
      '<th class="whitespace-nowrap border border-slate-200 px-3 py-2">地址</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">联系人</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">联系方式</th>' +
      '<th class="whitespace-nowrap border border-slate-200 px-3 py-2">发放日期</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">备注</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">操作</th></tr></thead><tbody>' +
      (ship
        ? '<tr><td class="border border-slate-200 px-3 py-2">1</td><td class="border border-slate-200 px-3 py-2">' + esc(ship.company) + '</td><td class="border border-slate-200 px-3 py-2">' + esc(ship.tracking) + '</td>' +
          '<td class="border border-slate-200 px-3 py-2">' + esc(ship.address) + '</td><td class="border border-slate-200 px-3 py-2">' + esc(ship.contact) + '</td><td class="border border-slate-200 px-3 py-2">' + esc(ship.phone) + '</td>' +
          '<td class="border border-slate-200 px-3 py-2">' + esc(ship.date) + '</td><td class="border border-slate-200 px-3 py-2">' + esc(ship.note || '') + '</td>' +
          opCell + '</tr>'
        : '<tr><td colspan="9" class="border border-slate-200 px-3 py-6 text-center text-slate-400">尚未填写发放信息</td></tr>') +
      '</tbody></table></div>';
  }

  function openShipRecord(code) {
    var task = ReportFlowStore.get(code); if (!task) return;
    openModal(
      '<div class="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h3 class="text-base font-medium text-slate-800">报告发放记录</h3>' +
      '<button type="button" class="text-slate-400 hover:text-slate-600" id="flow-modal-x"><i class="fa fa-times"></i></button></div>' +
      '<div class="flex-1 overflow-auto p-5">' + shipRecordsHtml(task, { readonly: true, hideTitle: true }) + '</div>' +
      '<div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">' +
      '<button type="button" class="rounded border border-slate-300 px-4 py-1.5 text-sm" id="flow-cancel">关闭</button></div>'
    );
  }

  function openHandleModal(stage, code) {
    var task = ReportFlowStore.get(code); if (!task) return;
    var m = META[stage];
    var isIssue = stage === '报告发放';
    var withCheck = m.kind === 'modal' || isIssue;
    var title = isIssue ? '报告发放' : (m.kind === 'modal' ? stage : '报告列表');
    var onStage = reportsOnStage(task, stage).filter(function (r) { return !r.issued; });
    var nRep = onStage.length || (task.reports || []).length;
    var head =
      '<div class="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h3 class="text-base font-medium text-slate-800">' + esc(title) + '</h3>' +
      '<button type="button" class="text-slate-400 hover:text-slate-600" id="flow-modal-x"><i class="fa fa-times"></i></button></div>';
    var footCancel = '<button type="button" class="rounded border border-slate-300 px-4 py-1.5 text-sm" id="flow-cancel">取消</button>' +
      '<button type="button" class="rounded border border-slate-300 px-4 py-1.5 text-sm" data-modal-back="' + esc(code) + '">退回</button>';
    if (isIssue) {
      var hasShip = !!task.ship;
      openModal(head +
        '<div class="flex-1 overflow-auto p-5">' +
        (global.ReturnUI ? ReturnUI.stripHtml(code, '报告发放') : '') +
        '<div class="mb-4 flex flex-wrap items-center gap-2" data-annotate="flow-issue-steps">' +
        stepChip('1', '勾选待发放报告', true) +
        '<i class="fa fa-angle-right text-slate-300"></i>' +
        stepChip('2', '填写发放信息', hasShip) +
        '<i class="fa fa-angle-right text-slate-300"></i>' +
        stepChip('3', '发放通过', false) +
        '</div>' +
        '<div class="mb-1 flex items-center justify-between" data-annotate="flow-issue-check">' +
        '<div class="text-sm font-medium text-slate-700">一、勾选待发放报告 <span class="font-normal text-slate-400">共 ' + nRep + ' 份</span></div>' +
        '<div class="text-xs text-slate-500">退回只退勾选的报告到收费审批，未勾选的仍留在发放。</div></div>' +
        reportsTable(task, true, true, stage) +
        '<div class="mt-5" data-annotate="flow-issue-addr">' +
        '<div class="mb-2 flex items-center justify-between">' +
        '<div class="text-sm font-medium text-slate-700">二、填写发放信息</div>' +
        (hasShip
          ? ''
          : '<button type="button" class="rounded bg-blue-600 px-3 py-1 text-sm text-white" data-addr="' + esc(code) + '">填写发放信息</button>') +
        '</div>' +
        shipRecordsHtml(task, { readonly: false, hideTitle: true }) +
        '</div></div>' +
        '<div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3" data-annotate="flow-issue-foot">' +
        footCancel +
        '<button type="button" class="rounded bg-blue-600 px-4 py-1.5 text-sm text-white" data-modal-pass="' + esc(code) + '" data-need-ship="1" data-has-ship="' + (hasShip ? '1' : '0') + '">发放通过</button>' +
        '</div>'
      );
      bindChecks();
      return;
    }
    openModal(head +
      '<div class="flex-1 overflow-auto p-5">' +
      (global.ReturnUI ? ReturnUI.stripHtml(code, stage) : '') +
      '<div class="mb-2 text-sm text-slate-500">' + (stage === '收费审批'
        ? '本节点 <b class="text-slate-700">' + nRep + '</b> 份报告。审批通过只带走当前仍在收费审批的报告。退回按勾选的报告逐份退回报告处理，未勾选的留在本节点。'
        : '本任务共 <b class="text-slate-700">' + nRep + '</b> 份报告，勾选后处理。可分批勾选，不必一次全部通过。退回仍按整单退回报告签发。') + '</div>' +
      reportsTable(task, withCheck, false, stage) +
      '</div>' +
      '<div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">' +
      footCancel +
      (m.pass ? '<button type="button" class="rounded bg-blue-600 px-4 py-1.5 text-sm text-white" data-modal-pass="' + esc(code) + '">' + m.pass + '</button>' : '') +
      '</div>'
    );
    if (withCheck) bindChecks();
  }

  function openAddr(code) {
    var task = ReportFlowStore.get(code); if (!task) return;
    var s = task.ship || { company: '', tracking: '', address: task.address, contact: task.contact, phone: task.phone, date: '2026-11-21', note: '' };
    openModal(
      '<div class="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h3 class="text-base font-medium text-slate-800">填写报告发放信息</h3>' +
      '<button type="button" class="text-slate-400" id="flow-modal-x"><i class="fa fa-times"></i></button></div>' +
      '<form id="ship-form" class="grid grid-cols-2 gap-4 p-5 text-sm">' +
      '<label class="flex flex-col gap-1">快递公司<select name="company" class="rounded border border-slate-300 px-3 py-1.5"><option value="">请选择快递公司</option>' +
      ['顺丰快递', '中通快递', '圆通速递', 'EMS'].map(function (n) {
        return '<option' + (s.company === n ? ' selected' : '') + '>' + n + '</option>';
      }).join('') + '</select></label>' +
      '<label class="flex flex-col gap-1">快递单号<input name="tracking" class="rounded border border-slate-300 px-3 py-1.5" placeholder="请输入快递单号" value="' + esc(s.tracking) + '" /></label>' +
      '<label class="flex flex-col gap-1">地址<input name="address" class="rounded border border-slate-300 px-3 py-1.5" value="' + esc(s.address) + '" /></label>' +
      '<label class="flex flex-col gap-1"><span><span class="text-red-500">*</span> 联系人</span><input name="contact" required class="rounded border border-slate-300 px-3 py-1.5" value="' + esc(s.contact) + '" /></label>' +
      '<label class="flex flex-col gap-1"><span><span class="text-red-500">*</span> 联系方式</span><input name="phone" required class="rounded border border-slate-300 px-3 py-1.5" value="' + esc(s.phone) + '" /></label>' +
      '<label class="flex flex-col gap-1"><span><span class="text-red-500">*</span> 发放日期</span><input name="date" type="date" required class="rounded border border-slate-300 px-3 py-1.5" value="' + esc(s.date) + '" /></label>' +
      '<label class="col-span-2 flex flex-col gap-1">备注<input name="note" class="rounded border border-slate-300 px-3 py-1.5" placeholder="请输入备注信息" value="' + esc(s.note || '') + '" /></label>' +
      '</form>' +
      '<div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">' +
      '<button type="button" class="rounded border border-slate-300 px-4 py-1.5 text-sm" data-addr-back="' + esc(code) + '">取消</button>' +
      '<button type="button" class="rounded bg-blue-600 px-4 py-1.5 text-sm text-white" data-save-ship="' + esc(code) + '">确认</button></div>'
    );
  }

  function toast(msg) {
    var t = document.getElementById('flow-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'flow-toast';
      t.className = 'fixed right-6 top-6 z-[60] hidden rounded bg-emerald-600 px-4 py-2 text-sm text-white shadow';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(function () { t.classList.add('hidden'); }, 1600);
  }

  function flowAnnotations(stage) {
    var list = [
      {
        id: 'flow-search', selector: '.ui-search-grid', position: 'bottom', title: '查询条件（样品大类在样品名称后）',
        content: '<strong>需求逻辑：</strong>签发到任务完成各名单字段口径与报告审核对齐，按委托 / 合同 / 客户 / 样品 / 样品大类筛任务，避免各节点各做一套条件。<br>' +
          '<strong>展示规则：</strong>样品大类下拉跟在样品名称后面；查询、重置钉在第二行最右。<br>' +
          '<strong>交互逻辑：</strong>查询按当前节点过滤；重置清空条件并刷新本节点名单。',
        tag: stage
      },
      {
        id: 'flow-record', selector: '#flow-root thead th:nth-last-child(2), #flow-root [data-record]', position: 'top', title: '报告记录',
        content: '<strong>需求逻辑：</strong>签发之后仍要能看该委托下各份报告的流转留痕，不必退回编制或审核页。<br>' +
          '<strong>展示规则：</strong>名单「报告记录」列；任务完成右侧冻结「报告记录 + 发放记录」。<br>' +
          '<strong>交互逻辑：</strong>点击打开右侧抽屉（节点进度 + 操作日志），与编制 / 审核同一套。',
        tag: stage
      },
      {
        id: 'flow-open', selector: '[data-annotate="flow-open"]', position: 'left', title: META[stage].action,
        content: stage === '报告签发'
          ? '<strong>需求逻辑：</strong>授权签字人必须进工作台看报告文件、收样与检测信息后再签发，不能在名单上直接点通过。<br><strong>展示规则：</strong>操作列「去签发」。签发前报告文件为 Word（.docx）；签发通过后系统才生成 PDF，后续处理 / 收费 / 发放 / 归档 / 完成都只展示 PDF。<br><strong>交互逻辑：</strong>进入签发工作台（report-sign-edit.html?code=委托编号），默认选中本单待签发报告。签发通过进入报告处理并生成 PDF；退回须填原因，打回报告审核（仍为 Word，便于修订）。'
          : stage === '报告处理'
            ? '<strong>需求逻辑：</strong>一份委托常对应多份报告，处理时要先勾选本批要过的报告再点处理通过。<br><strong>展示规则：</strong>操作列「处理」，弹窗标题「报告处理」，报告列表带勾选（默认全选）。<br><strong>交互逻辑：</strong>至少勾选一份才能处理通过；退回须填原因，整单退回上一节点（报告签发）。'
            : stage === '收费审批'
              ? '<strong>需求逻辑：</strong>财务按报告收费，一张委托多份报告时要能勾选本批审批范围。退回也按报告，不能把同一委托下其余报告一并打回。<br><strong>展示规则：</strong>操作列「审批」，弹窗标题「收费审批」，只列出仍在收费审批的报告。<br><strong>交互逻辑：</strong>至少勾选一份才能审批通过；退回须填原因，只把勾选的报告退回报告处理，未勾选的留在收费审批。'
              : stage === '报告发放'
                ? '<strong>需求逻辑：</strong>发放必须按「勾选报告 → 填写发放信息 → 发放通过」走，先过再填地址会丢件。<br><strong>展示规则：</strong>操作列「发放」。<br><strong>交互逻辑：</strong>打开发放弹窗，见弹窗内三步动线批注。'
                : stage === '任务归档'
                  ? '<strong>需求逻辑：</strong>发放完成后归档入库，异常单可退回发放。任务完成是终点，不能再退回归档，所以归档名单没有退回标签。<br><strong>展示规则：</strong>操作列同时提供「归档」「退回」，不再单列「任务归档」字段；委托编号旁不挂退回标签。<br><strong>交互逻辑：</strong>归档进任务完成；退回须填原因，退回报告发放。'
                  : '<strong>需求逻辑：</strong>任务完成后名单只读，发放记录要能回看快递信息。<br><strong>展示规则：</strong>末列改为「发放记录」，与报告记录一起右侧冻结。<br><strong>交互逻辑：</strong>「查看」打开发放记录弹窗（只读）；「报告记录」仍开抽屉。',
        tag: stage
      }
    ];
    if (stage === '报告处理' || stage === '收费审批') {
      list.push({
        id: 'flow-rep-table', selector: '#flow-modal [data-annotate="flow-rep-table"]', position: 'top', title: '多报告勾选',
        content: '<strong>需求逻辑：</strong>一张委托任务常有多份报告，处理 / 收费不能默认只出一份，否则会漏单。签发后正式文件已是 PDF，本节点不再给 Word。<br>' +
          '<strong>展示规则：</strong>弹窗内报告列表带勾选列、表头全选；报告名称带 PDF 图标与 .pdf 后缀；演示任务 mock 2～3 份报告。<br>' +
          '<strong>交互逻辑：</strong>默认全选；取消到 0 份时通过按钮置灰。收费审批、报告发放的退回按勾选报告逐份退回，未勾选的留在本节点。',
        tag: stage
      });
    }
    if (stage === '报告发放') {
      list.push(
        {
          id: 'flow-issue-steps', selector: '[data-annotate="flow-issue-steps"]', position: 'bottom', title: '发放三步动线',
          content: '<strong>需求逻辑：</strong>先确认发哪些报告，再写快递信息，最后发放通过；顺序反了会把没填地址的报告发出去。<br>' +
            '<strong>展示规则：</strong>顶部步骤条：①勾选待发放报告 → ②填写发放信息 → ③发放通过。已填地址时第 2 步点亮。<br>' +
            '<strong>交互逻辑：</strong>未勾选或未填发放信息时「发放通过」置灰；填完地址返回本弹窗后再点通过。',
          tag: '报告发放'
        },
        {
          id: 'flow-issue-check', selector: '[data-annotate="flow-issue-check"]', position: 'top', title: '勾选待发放报告',
          content: '<strong>需求逻辑：</strong>一份委托可能分批发，必须能勾选本批要寄出的报告；已发放的不能再勾，只能回看当时的发放记录。<br>' +
            '<strong>展示规则：</strong>已发放行勾选框勾上但禁用；操作列「查看发放记录」。未发放可勾选，不展示查看按钮。<br>' +
            '<strong>交互逻辑：</strong>点「查看发放记录」弹出只读发放记录，不改动下方本次待发地址。',
          tag: '报告发放'
        },
        {
          id: 'flow-issue-addr', selector: '[data-annotate="flow-issue-addr"]', position: 'top', title: '填写发放信息',
          content: '<strong>需求逻辑：</strong>下方地址是「本批还要再发」时关联的寄送信息，和已发报告的历史记录分开。<br>' +
            '<strong>展示规则：</strong>未填时空表 + 蓝色「填写发放信息」；已填可编辑 / 删除后重新添加。<br>' +
            '<strong>交互逻辑：</strong>发放通过时把当前地址快照到本批勾选的报告上；删的是待发地址，不影响已发报告的查看记录。',
          tag: '报告发放'
        },
        {
          id: 'flow-issue-foot', selector: '[data-annotate="flow-issue-foot"]', position: 'top', title: '发放通过',
          content: '<strong>需求逻辑：</strong>可分批发：只把勾选的报告发放；未勾选的仍留在本节点。<br>' +
            '<strong>展示规则：</strong>底栏只有取消 / 退回 / 发放通过。未填地址时表格上方保留蓝色「填写发放信息」；填完后改用表格内编辑 / 删除，不再出现「修改发放信息」。<br>' +
            '<strong>交互逻辑：</strong>未勾选或未填发放信息时通过按钮置灰；勾选子集点通过后，未发报告仍在发放名单。退回须填原因，只把勾选的报告退回收费审批，未勾选的仍留在发放。',
          tag: '报告发放'
        }
      );
    }
    return list;
  }

  function mount(opts) {
    var stage = opts.stage;
    var root = document.getElementById('flow-root');
    function paint(list) {
      list = list || ReportFlowStore.list(stage);
      root.innerHTML = searchHtml() + tableHtml(stage, list);
      document.getElementById('btn-search').onclick = function () {
        var code = document.getElementById('f_code').value.trim();
        var unit = document.getElementById('f_unit').value.trim();
        var sample = document.getElementById('f_sample').value.trim();
        var contract = document.getElementById('f_contract').value.trim();
        var cat = (document.getElementById('f_cat') && document.getElementById('f_cat').value) || '';
        paint(ReportFlowStore.list(stage).filter(function (r) {
          if (code && r.code.indexOf(code) < 0) return false;
          if (unit && r.customer.indexOf(unit) < 0) return false;
          if (sample && r.sample.indexOf(sample) < 0) return false;
          if (contract && (r.contract || '').indexOf(contract) < 0) return false;
          if (cat && catOf(r.sample) !== cat) return false;
          return true;
        }));
      };
      document.getElementById('btn-reset').onclick = function () { paint(); };
      if (global.ColumnConfig && typeof ColumnConfig.refresh === 'function') ColumnConfig.refresh();
      if (global.PrototypeAnnotation && PrototypeAnnotation.refresh) PrototypeAnnotation.refresh();
    }
    paint();
    if (global.PrototypeAnnotation && PrototypeAnnotation.init) {
      PrototypeAnnotation.init({ annotations: flowAnnotations(stage) });
    }
    document.addEventListener('click', function (e) {
      var open = e.target.closest('[data-open]');
      var passBtn = e.target.closest('[data-pass]');
      var backBtn = e.target.closest('[data-back]');
      var rec = e.target.closest('[data-record]');
      var shipBtn = e.target.closest('[data-ship]');
      if (open) { e.preventDefault(); openHandleModal(stage, open.getAttribute('data-open')); }
      if (passBtn) {
        e.preventDefault();
        if (confirm('确认将该任务归档并进入任务完成？')) {
          ReportFlowStore.pass(passBtn.getAttribute('data-pass'), '任务已归档');
          toast('已归档'); paint();
        }
      }
      if (backBtn) {
        e.preventDefault();
        var backCode = backBtn.getAttribute('data-back');
        var toNode = ReportFlowStore.prevOf(stage) || '报告审核';
        if (global.ReturnUI) {
          ReturnUI.openCollect({
            from: stage, to: toNode, code: backCode, persist: false,
            onOk: function (_rec, reason) {
              ReportFlowStore.back(backCode, reason, { to: toNode });
              toast('已退回上一节点'); paint();
            }
          });
        } else {
          ReportFlowStore.back(backCode, '退回');
          toast('已退回上一节点'); paint();
        }
      }
      if (shipBtn) {
        e.preventDefault();
        openShipRecord(shipBtn.getAttribute('data-ship'));
      }
      if (rec && !e.target.closest('[data-open],[data-pass],[data-back],[data-ship]')) {
        e.preventDefault();
        var code = rec.getAttribute('data-record');
        if (global.ReportRecordDrawer && ReportRecordDrawer.open(code)) return;
        var t = ReportFlowStore.get(code);
        alert((t && t.logs && t.logs.length)
          ? t.logs.map(function (l) { return l.at + '  ' + l.node + '  ' + l.by + '  ' + l.text; }).join('\n')
          : '暂无流转记录');
      }
    });
    modalShell().addEventListener('click', function (e) {
      if (e.target.id === 'flow-modal-x' || e.target.id === 'flow-cancel' || e.target.closest('#flow-modal-x')) closeModal();
      var p = e.target.closest('[data-modal-pass]');
      var b = e.target.closest('[data-modal-back]');
      var a = e.target.closest('[data-addr]');
      var ab = e.target.closest('[data-addr-back]');
      var s = e.target.closest('[data-save-ship]');
      var d = e.target.closest('[data-del-ship]');
      var vs = e.target.closest('[data-view-ship]');
      if (vs) {
        e.preventDefault();
        e.stopPropagation();
        openReportShip(vs.getAttribute('data-code'), vs.getAttribute('data-id'));
      }
      if (p) {
        var code = p.getAttribute('data-modal-pass');
        var task = ReportFlowStore.get(code);
        var boxes = document.querySelectorAll('#flow-modal .rep-check');
        if (boxes.length && checkedCount() < 1) { alert('请勾选至少一份报告'); return; }
        if (stage === '报告发放' && task && !task.ship) { alert('请先填写发放信息'); return; }
        if (stage === '报告发放' && ReportFlowStore.issue) {
          var ids = [].map.call(document.querySelectorAll('#flow-modal .rep-check:checked'), function (c) { return c.getAttribute('data-id'); });
          var res = ReportFlowStore.issue(code, ids);
          toast(res && res.remaining
            ? '已发放 ' + ids.length + ' 份，仍有 ' + res.remaining + ' 份待发放'
            : (META[stage].pass + '，已进入「' + ReportFlowStore.nextOf(stage) + '」'));
        } else {
          ReportFlowStore.pass(code, undefined, { from: stage });
          toast(META[stage].pass + '，已进入「' + ReportFlowStore.nextOf(stage) + '」');
        }
        closeModal(); paint();
      }
      if (b) {
        var backCode = b.getAttribute('data-modal-back');
        var toNode = ReportFlowStore.prevOf(stage) || '报告审核';
        var ids = [];
        var nos = [];
        var perReport = stage === '收费审批' || stage === '报告发放';
        if (perReport) {
          var picked = document.querySelectorAll('#flow-modal .rep-check:checked');
          if (!picked.length) { alert('请勾选要退回的报告'); return; }
          [].forEach.call(picked, function (c) {
            ids.push(c.getAttribute('data-id'));
            nos.push(c.getAttribute('data-no') || c.getAttribute('data-id'));
          });
        }
        if (global.ReturnUI) {
          ReturnUI.openCollect({
            from: stage, to: toNode, code: backCode, persist: false,
            reportNos: nos,
            onOk: function (_rec, reason) {
              var res = ReportFlowStore.back(backCode, reason, { from: stage, to: toNode, reportIds: ids });
              toast(res && res.count ? ('已退回 ' + res.count + ' 份报告至「' + toNode + '」') : '已退回');
              closeModal(); paint();
            }
          });
        } else {
          ReportFlowStore.back(backCode, '退回', { from: stage, to: toNode, reportIds: ids });
          toast('已退回'); closeModal(); paint();
        }
      }
      if (a) openAddr(a.getAttribute('data-addr'));
      if (ab) openHandleModal(stage, ab.getAttribute('data-addr-back'));
      if (d) {
        if (!confirm('确认删除该发放信息？删除后需重新填写才能继续发放，已发出报告的发放记录不受影响。')) return;
        ReportFlowStore.removeShip(d.getAttribute('data-del-ship'));
        toast('已删除发放信息');
        openHandleModal(stage, d.getAttribute('data-del-ship'));
      }
      if (s) {
        var form = document.getElementById('ship-form');
        if (!form.contact.value || !form.phone.value || !form.date.value) { alert('请填写必填项'); return; }
        ReportFlowStore.setShip(s.getAttribute('data-save-ship'), {
          company: form.company.value, tracking: form.tracking.value, address: form.address.value,
          contact: form.contact.value, phone: form.phone.value, date: form.date.value, note: form.note.value
        });
        toast('发放信息已保存');
        openHandleModal(stage, s.getAttribute('data-save-ship'));
      }
    });
  }

  global.ReportFlowUI = { mount: mount, closeModal: closeModal, openHandleModal: openHandleModal };
})(window);
