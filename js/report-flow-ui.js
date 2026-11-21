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

  function searchHtml() {
    return '<div class="rounded bg-white p-4 shadow-sm">' +
      '<div class="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-4">' +
      field('委托编号', '<input id="f_code" type="text" placeholder="请输入委托编号" class="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />') +
      field('是否关联框架合同', '<select id="f_frame" class="flex-1 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500"><option value="">请选择是否关联</option><option>是</option><option>否</option></select>') +
      field('合同编号', '<input id="f_contract" type="text" placeholder="请输入框架合同编号" class="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />') +
      field('客户单位', '<input id="f_unit" type="text" placeholder="请输入委托单位" class="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />') +
      field('样品名称', '<input id="f_sample" type="text" placeholder="请输入样品名称" class="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />') +
      '<div class="flex items-center gap-2"><label class="w-28 flex-shrink-0 text-right text-sm text-slate-600">委托受理日期</label>' +
      '<div class="flex flex-1 items-center gap-1"><input id="f_from" type="text" placeholder="开始日期" class="w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" /><span class="text-slate-400">—</span>' +
      '<input id="f_to" type="text" placeholder="结束日期" class="w-full rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500" /></div></div>' +
      '<div class="flex items-center gap-2 xl:col-span-2 xl:justify-end">' +
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
      return '<a class="text-blue-600 hover:underline" href="' + m.href + '?code=' + encodeURIComponent(row.code) + '"><i class="fa fa-pencil mr-1"></i>' + m.action + '</a>';
    }
    if (m.kind === 'view') {
      return '<a class="text-blue-600 hover:underline" href="#" data-record="' + esc(row.code) + '"><i class="fa fa-eye mr-1"></i>查看</a>';
    }
    if (m.kind === 'archive') {
      return '<button type="button" class="text-emerald-600 hover:underline" data-pass="' + esc(row.code) + '"><i class="fa fa-check-circle-o mr-1"></i>归档</button>' +
        ' <button type="button" class="ml-1 text-orange-500 hover:underline" data-back="' + esc(row.code) + '"><i class="fa fa-undo mr-1"></i>退回</button>';
    }
    return '<button type="button" class="text-blue-600 hover:underline" data-open="' + esc(row.code) + '"><i class="fa fa-list-alt mr-1"></i>' + m.action + '</button>';
  }

  function tableHtml(stage, list) {
    var colN = stage === '任务归档' ? 15 : 14;
    var body = list.map(function (r, i) {
      var extra = stage === '任务归档'
        ? '<td class="border border-slate-200 px-3 py-2"><a href="#" class="text-blue-600 hover:underline" data-record="' + esc(r.code) + '">查看</a></td>'
        : '';
      return '<tr class="hover:bg-slate-50">' +
        '<td class="border border-slate-200 px-3 py-2">' + (i + 1) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2"><a class="text-blue-600 hover:underline" href="entrust-detail.html?code=' + encodeURIComponent(r.code) + '">' + esc(r.code) + '</a></td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.contract) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.customer) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.sample) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.sendDate) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.requireDate) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.acceptDate) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2"><span class="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-600">' + esc(r.prepaid) + '</span></td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.priority) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.status) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.compiler) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + recLink(r.code) + '</td>' + extra +
        '<td class="border border-slate-200 px-3 py-2 whitespace-nowrap">' + opsHtml(stage, r) + '</td></tr>';
    }).join('');
    if (!list.length) body = '<tr><td colspan="' + colN + '" class="border border-slate-200 px-3 py-10 text-center text-sm text-slate-400">当前节点暂无任务</td></tr>';
    var extraHead = stage === '任务归档'
      ? '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">任务归档</th>' : '';
    return '<div class="mt-4 rounded bg-white p-4 shadow-sm"><div class="overflow-x-auto"><table class="w-full border-collapse text-left text-sm" style="min-width:' + (stage === '任务归档' ? '1680' : '1540') + 'px">' +
      '<thead><tr class="bg-slate-100 text-slate-600">' +
      '<th class="border border-slate-200 px-3 py-2 font-medium w-[72px]" style="white-space:nowrap">序号</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">委托编号</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">合同编号</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">客户单位</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">样品名称</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">送样时间</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">客户要求完成日期</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">委托受理日期</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">先收费</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">优先等级</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">任务状态</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">编制人</th>' +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">报告记录</th>' + extraHead +
      '<th class="border border-slate-200 px-3 py-2 font-medium" style="white-space:nowrap">操作</th></tr></thead><tbody>' + body + '</tbody></table></div>' +
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
    var el = modalShell();
    document.getElementById('flow-modal-panel').innerHTML = html;
    el.classList.remove('hidden');
    el.classList.add('flex');
  }
  function closeModal() {
    var el = document.getElementById('flow-modal');
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
  }

  function reportRows(task, withCheck) {
    return (task.reports || []).map(function (r, i) {
      return '<tr>' +
        (withCheck ? '<td class="border border-slate-200 px-3 py-2 text-center"><input type="checkbox" class="rep-check" checked data-id="' + esc(r.id) + '" /></td>' : '') +
        '<td class="border border-slate-200 px-3 py-2">' + (i + 1) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.no) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2"><a class="text-blue-600 hover:underline" href="transparent-demo/report-preview.html?code=' + encodeURIComponent(task.code) + '" target="_blank">' + esc(r.name) + '</a></td>' +
        '<td class="border border-slate-200 px-3 py-2">' + esc(r.at) + '</td>' +
        '<td class="border border-slate-200 px-3 py-2 text-slate-400">—</td></tr>';
    }).join('');
  }

  function openHandleModal(stage, code) {
    var task = ReportFlowStore.get(code); if (!task) return;
    var m = META[stage];
    var isIssue = stage === '报告发放';
    var ship = task.ship;
    var shipHtml = '';
    if (isIssue) {
      shipHtml = '<div class="mt-4 text-sm font-medium text-slate-700">报告发放记录</div>' +
        '<div class="mt-2 overflow-x-auto"><table class="w-full min-w-[920px] border-collapse text-left text-sm"><thead><tr class="bg-slate-50 text-slate-600">' +
        '<th class="whitespace-nowrap border border-slate-200 px-3 py-2">序号</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">快递公司</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">快递单号</th>' +
        '<th class="whitespace-nowrap border border-slate-200 px-3 py-2">地址</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">联系人</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">联系方式</th>' +
        '<th class="whitespace-nowrap border border-slate-200 px-3 py-2">发放日期</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">备注</th><th class="whitespace-nowrap border border-slate-200 px-3 py-2">操作</th></tr></thead><tbody>' +
        (ship
          ? '<tr><td class="border border-slate-200 px-3 py-2">1</td><td class="border border-slate-200 px-3 py-2">' + esc(ship.company) + '</td><td class="border border-slate-200 px-3 py-2">' + esc(ship.tracking) + '</td>' +
            '<td class="border border-slate-200 px-3 py-2">' + esc(ship.address) + '</td><td class="border border-slate-200 px-3 py-2">' + esc(ship.contact) + '</td><td class="border border-slate-200 px-3 py-2">' + esc(ship.phone) + '</td>' +
            '<td class="border border-slate-200 px-3 py-2">' + esc(ship.date) + '</td><td class="border border-slate-200 px-3 py-2">' + esc(ship.note || '') + '</td>' +
            '<td class="border border-slate-200 px-3 py-2 whitespace-nowrap"><button type="button" class="text-blue-600" data-addr="' + esc(code) + '">编辑</button> <button type="button" class="ml-2 text-red-500" data-del-ship="' + esc(code) + '">删除</button></td></tr>'
          : '<tr><td colspan="9" class="border border-slate-200 px-3 py-6 text-center text-slate-400">尚未填写发放地址</td></tr>') +
        '</tbody></table></div>';
    }
    openModal(
      '<div class="flex items-center justify-between border-b border-slate-100 px-5 py-3"><h3 class="text-base font-medium text-slate-800">报告列表</h3>' +
      '<button type="button" class="text-slate-400 hover:text-slate-600" id="flow-modal-x"><i class="fa fa-times"></i></button></div>' +
      '<div class="flex-1 overflow-auto p-5">' +
      '<table class="w-full border-collapse text-left text-sm"><thead><tr class="bg-slate-50 text-slate-600">' +
      (isIssue ? '<th class="border border-slate-200 px-3 py-2 w-10"><input type="checkbox" id="check-all" checked /></th>' : '') +
      '<th class="border border-slate-200 px-3 py-2">序号</th><th class="border border-slate-200 px-3 py-2">报告编号</th><th class="border border-slate-200 px-3 py-2">报告名称</th>' +
      '<th class="border border-slate-200 px-3 py-2">生成时间</th><th class="border border-slate-200 px-3 py-2">操作</th></tr></thead><tbody>' +
      reportRows(task, isIssue) + '</tbody></table>' + shipHtml + '</div>' +
      '<div class="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">' +
      '<button type="button" class="rounded border border-slate-300 px-4 py-1.5 text-sm" id="flow-cancel">' + (stage === '任务完成' ? '关闭' : '取消') + '</button>' +
      (stage === '任务完成' ? '' : '<button type="button" class="rounded border border-slate-300 px-4 py-1.5 text-sm" data-modal-back="' + esc(code) + '">退回</button>') +
      (m.pass ? '<button type="button" class="rounded bg-blue-600 px-4 py-1.5 text-sm text-white" data-modal-pass="' + esc(code) + '">' + m.pass + '</button>' : '') +
      (isIssue ? '<button type="button" class="rounded bg-blue-600 px-4 py-1.5 text-sm text-white" data-addr="' + esc(code) + '">填写地址</button>' : '') +
      '</div>'
    );
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
        paint(ReportFlowStore.list(stage).filter(function (r) {
          if (code && r.code.indexOf(code) < 0) return false;
          if (unit && r.customer.indexOf(unit) < 0) return false;
          if (sample && r.sample.indexOf(sample) < 0) return false;
          if (contract && (r.contract || '').indexOf(contract) < 0) return false;
          return true;
        }));
      };
      document.getElementById('btn-reset').onclick = function () { paint(); };
    }
    paint();
    document.addEventListener('click', function (e) {
      var open = e.target.closest('[data-open]');
      var passBtn = e.target.closest('[data-pass]');
      var backBtn = e.target.closest('[data-back]');
      var rec = e.target.closest('[data-record]');
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
        var reason = prompt('请填写退回原因', '');
        if (reason == null) return;
        ReportFlowStore.back(backBtn.getAttribute('data-back'), reason);
        toast('已退回上一节点'); paint();
      }
      if (rec && !e.target.closest('[data-open],[data-pass],[data-back]')) {
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
      if (p) {
        var code = p.getAttribute('data-modal-pass');
        var task = ReportFlowStore.get(code);
        if (stage === '报告发放' && task && !task.ship) { alert('请先填写发放地址'); return; }
        ReportFlowStore.pass(code);
        toast(META[stage].pass + '，已进入「' + ReportFlowStore.nextOf(stage) + '」');
        closeModal(); paint();
      }
      if (b) {
        var reason = prompt('请填写退回原因', '');
        if (reason == null) return;
        ReportFlowStore.back(b.getAttribute('data-modal-back'), reason);
        toast('已退回'); closeModal(); paint();
      }
      if (a) openAddr(a.getAttribute('data-addr'));
      if (ab) openHandleModal(stage, ab.getAttribute('data-addr-back'));
      if (d) {
        if (!confirm('确认删除该发放记录？')) return;
        ReportFlowStore.removeShip(d.getAttribute('data-del-ship'));
        toast('已删除发放记录');
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
