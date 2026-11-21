/* 报告文件 + 预览 / 收样信息 / 检测信息（签发工作台只看这些，不跑 AI 核对） */
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function openPageOffice(name) { alert('PageOffice 插件预览：' + name + '（原型占位）'); }

  function pickReport(task) {
    var mock = global.ReportReviewMock && ReportReviewMock.getEntrust(task.code);
    var reps = mock && mock.reports;
    if (reps && reps.length) {
      var byRounds = reps.slice().sort(function (a, b) {
        return (b.rounds || []).length - (a.rounds || []).length;
      });
      return byRounds[0];
    }
    var f = (task.reports && task.reports[0]) || { name: (task.code || '').replace('/', '-') + '检测报告.docx', at: task.acceptDate || '', no: task.code };
    return {
      reportNo: f.no || task.code,
      reportName: f.name,
      compiler: task.compiler || 'admin',
      file: { word: f.name, at: f.at || '' },
      rounds: [{ revision: 'V1.0' }, { revision: 'V1.1' }],
      info: { traceCode: task.code, receive: { times: [] }, detect: { samples: [] } }
    };
  }

  function equipmentCard(eq) {
    if (!eq) return '';
    function cell(k, v) { return '<div><div class="eq-k">' + esc(k) + '</div><div class="eq-v">' + esc(v || '—') + '</div></div>'; }
    return '<div class="eq-card mt-2">' +
      '<div class="mb-1.5 flex items-center justify-between gap-2"><span class="text-xs font-semibold text-slate-600"><i class="fa fa-cogs mr-1" style="color:var(--brand)"></i>试验设备</span>' +
        '<span class="chip ' + (eq.calibStatus === '正常' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700') + '">' + esc(eq.calibStatus || '—') + '</span></div>' +
      '<div class="mb-2 text-sm font-semibold text-slate-800">' + esc(eq.name) + '</div>' +
      '<div class="eq-grid">' +
        cell('设备编号', eq.no) + cell('型号', eq.model) + cell('采集方式', eq.collect) + cell('设备精度', eq.precision) +
        cell('上次校准', eq.lastCalib) + cell('校准有效期', (eq.calibFrom || '') + ' ~ ' + (eq.calibTo || '')) +
      '</div></div>';
  }
  function groupedTable(it, phase) {
    var groups = it.groups || [];
    var rows = (phase && phase.rows) || [];
    var gCls = { nom: 'g-nom', mea: 'g-mea', calc: 'g-calc' };
    var head1 = '<th rowspan="2" class="bg-slate-50 text-slate-500">试样编号</th>';
    var head2 = '';
    groups.forEach(function (g) {
      head1 += '<th class="' + gCls[g.key] + '" colspan="' + g.cols.length + '">' + esc(g.title) + '</th>';
      g.cols.forEach(function (c) { head2 += '<th class="' + gCls[g.key] + '">' + esc(c) + '</th>'; });
    });
    head1 += '<th rowspan="2" class="bg-slate-50 text-slate-500">结论</th>';
    var body = rows.map(function (row, i) {
      var tds = '<td class="mono">' + esc(row['试样编号'] || '—') + '</td>';
      groups.forEach(function (g) {
        g.cols.forEach(function (c) { tds += '<td>' + esc(row[c] == null || row[c] === '' ? '/' : row[c]) + '</td>'; });
      });
      if (i === 0) tds += '<td class="conc-ok" rowspan="' + Math.max(rows.length, 1) + '">' + esc(phase.conclusion || '—') + '</td>';
      return '<tr>' + tds + '</tr>';
    }).join('');
    return '<div class="overflow-x-auto"><table class="fg-table"><thead><tr>' + head1 + '</tr><tr>' + head2 + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }
  function phaseBlock(it) {
    if (!it.phases || !it.phases.length) return '';
    var tabs = it.phases.map(function (ph, i) {
      return '<button type="button" class="phase-tab' + (i === 0 ? ' is-on' : '') + '" data-phase="' + i + '">' + esc(ph.name) +
        '<span class="ph-conc">' + esc(ph.conclusion || '') + '</span></button>';
    }).join('');
    var panes = it.phases.map(function (ph, i) {
      return '<div class="phase-pane mt-2' + (i === 0 ? '' : ' hidden') + '" data-phase="' + i + '">' + groupedTable(it, ph) + '</div>';
    }).join('');
    return '<div class="mt-2"><div class="phase-tabs">' + tabs + '</div>' + panes + '</div>';
  }
  function rawRecordCard(it) {
    return '<div class="raw-card mt-2">' +
      '<div class="flex items-start justify-between gap-2 px-3 py-2">' +
        '<div class="min-w-0"><div class="text-[11px] text-slate-400">原始记录单</div>' +
          (it.raws || []).map(function (s) {
            return '<a href="#" class="mt-0.5 inline-block truncate underline rp-office" style="color:var(--brand)" data-file="' + esc(s.name) + '"><i class="fa fa-file-word-o mr-0.5"></i>' + esc(s.name) + '</a>';
          }).join('') +
        '</div>' +
        '<div class="flex-shrink-0 text-right text-[11px] text-slate-500"><div>记录人员 <b class="text-slate-700">' + esc(it.recorder || it.tester) + '</b></div>' +
          '<div class="mono">记录时间 ' + esc(it.recordedAt || (it.raws && it.raws[0] && it.raws[0].at) || it.date) + '</div></div>' +
      '</div>' +
      '<div class="border-t border-slate-100 px-3 py-2">' +
        '<button type="button" class="raw-toggle text-xs hover:underline" style="color:var(--brand)">展开原始记录详情 <i class="fa fa-angle-down"></i></button>' +
        '<div class="raw-detail mt-2 hidden">' + phaseBlock(it) + '</div>' +
      '</div></div>';
  }

  function panelHtml(report, panel) {
    var info = report.info || {};
    if (panel === 'recv') {
      var rc = info.receive || { times: [] };
      return rc.times.map(function (t, idx) {
        return '<div class="recv-panel glass-sm mb-3">' +
          '<button type="button" class="recv-toggle flex w-full items-center justify-between gap-2 px-3 py-2 text-left">' +
            '<span class="font-semibold text-slate-700">第 ' + t.no + ' 次收样</span>' +
            '<span class="flex items-center gap-2"><span class="chip bg-emerald-100 text-emerald-700">' + esc(t.status) + '</span><i class="fa ' + (idx === 0 ? 'fa-angle-up' : 'fa-angle-down') + ' text-slate-400"></i></span>' +
          '</button>' +
          '<div class="recv-body border-t border-slate-100 px-3 pb-3 pt-2' + (idx === 0 ? '' : ' hidden') + '">' +
          '<div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500"><div>本次收样 <span class="mono text-slate-700">' + esc(t.date) + '</span></div><div>收样人 <b class="text-slate-700">' + esc(t.receiver) + '</b></div><div>送样人 <b class="text-slate-700">' + esc(t.sender) + '</b></div><div>送样方式 ' + esc(t.sendWay) + '</div><div>送样人电话 <span class="mono">' + esc(t.senderPhone) + '</span></div></div>' +
          '<div class="mt-1 text-xs text-slate-500">备注：' + esc(t.note) + '</div>' +
          (t.samples || []).map(function (sp) {
            return '<div class="mt-2 rounded-lg border border-slate-100 bg-white/60 p-2">' +
              '<div class="flex items-center justify-between"><span class="font-medium text-slate-700 mono">' + esc(sp.sampleNo) + '</span><span class="chip bg-blue-50 text-blue-700">' + esc(sp.qty) + '</span></div>' +
              '<div class="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-500"><div>产品标记 <b class="text-slate-700">' + esc(sp.productMark) + '</b></div><div>型号/分类 ' + esc(sp.model) + '</div><div>检测类别 ' + esc(sp.category) + '</div><div>生产厂 ' + esc(sp.factory) + '</div>' +
                (sp.specs || []).map(function (s) { return '<div>' + esc(s.k) + ' <b class="text-slate-700">' + esc(s.v) + '</b></div>'; }).join('') + '</div></div>';
          }).join('') +
          '<div class="mt-2 flex gap-2">' + (t.images || []).map(function (im) { return '<div class="flex h-16 w-20 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400"><i class="fa fa-image mb-0.5"></i>' + esc(im.label) + '</div>'; }).join('') + '</div>' +
          '</div></div>';
      }).join('') || '<div class="text-slate-400">无收样信息</div>';
    }
    if (panel === 'detect') {
      var d = info.detect || { samples: [] };
      return d.samples.map(function (sp) {
        return '<div class="glass-sm mb-3 p-3">' +
          '<div class="mb-2 flex items-center justify-between"><span class="font-semibold text-slate-700 mono">' + esc(sp.sampleNo) + '</span><span class="chip bg-blue-50 text-blue-700">' + esc(sp.qty) + '</span></div>' +
          '<div class="mb-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-slate-500"><div>产品标记 <b class="text-slate-700">' + esc(sp.productMark) + '</b></div><div>型号/分类 ' + esc(sp.model) + '</div><div>检测类别 ' + esc(sp.category) + '</div><div>生产厂 ' + esc(sp.factory) + '</div></div>' +
          '<div class="text-xs font-medium text-slate-500 mb-1">试验项</div>' +
          (sp.items || []).map(function (it) {
            var rc = it.result === '合格' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
            return '<div class="mb-1.5 rounded-lg border border-slate-100 bg-white/70">' +
              '<button type="button" class="detect-item flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left">' +
                '<span class="flex min-w-0 flex-wrap items-center gap-1.5"><span class="text-sm text-slate-700">' + esc(it.name) + '</span>' +
                  '<span class="chip bg-slate-100 text-slate-600">检测员 ' + esc(it.tester) + '</span>' +
                  '<span class="chip bg-slate-100 text-slate-600 mono">检测时间 ' + esc(it.date) + '</span></span>' +
                '<span class="flex flex-shrink-0 items-center gap-1"><span class="chip bg-slate-100 text-slate-500">' + esc(it.review) + '</span><span class="chip ' + rc + '">' + esc(it.result) + '</span><i class="fa fa-angle-down text-slate-400"></i></span>' +
              '</button>' +
              '<div class="detect-body hidden border-t border-slate-100 px-2.5 py-2 text-xs text-slate-500">' +
                '<div>试验过程 ' + esc(it.process || it.method) + '</div>' +
                '<div class="mt-0.5">标准要求 ' + esc(it.requirement || it.std) + '</div>' +
                '<div class="mt-2"><span class="text-slate-400">标准文件：</span>' + (it.standards || []).map(function (s) { return '<a href="#" class="ml-1 underline rp-office" style="color:var(--brand)" data-file="' + esc(s.no) + '">' + esc(s.no) + '</a>'; }).join('') + '</div>' +
                equipmentCard(it.equipment) +
                rawRecordCard(it) +
              '</div></div>';
          }).join('') + '</div>';
      }).join('') || '<div class="text-slate-400">无检测信息</div>';
    }
    var code = info.traceCode || (report.reportNo || '');
    return '<div class="flex h-full min-h-0 flex-col"><iframe src="transparent-demo/report-preview.html?code=' + encodeURIComponent(code) + '&embed=1" class="preview-frame" title="报告预览"></iframe></div>';
  }

  function bindToggles(root) {
    root.querySelectorAll('.detect-item').forEach(function (b) {
      b.addEventListener('click', function () {
        var body = b.nextElementSibling;
        body.classList.toggle('hidden');
        var ic = b.querySelector('.fa-angle-down,.fa-angle-up');
        if (ic) ic.className = 'fa ' + (body.classList.contains('hidden') ? 'fa-angle-down' : 'fa-angle-up') + ' text-slate-400';
      });
    });
    root.querySelectorAll('.recv-toggle').forEach(function (b) {
      b.addEventListener('click', function () {
        var body = b.parentNode.querySelector('.recv-body');
        var open = body.classList.toggle('hidden') === false;
        var ic = b.querySelector('.fa-angle-down,.fa-angle-up');
        if (ic) ic.className = 'fa ' + (open ? 'fa-angle-up' : 'fa-angle-down') + ' text-slate-400';
      });
    });
    root.querySelectorAll('.raw-toggle').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var detail = b.closest('.raw-card').querySelector('.raw-detail');
        var open = detail.classList.toggle('hidden') === false;
        var ic = b.querySelector('i');
        if (ic) ic.className = 'fa ' + (open ? 'fa-angle-up' : 'fa-angle-down');
        b.childNodes[0].textContent = open ? '收起原始记录详情 ' : '展开原始记录详情 ';
      });
    });
    root.querySelectorAll('.phase-tab').forEach(function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var card = b.closest('.raw-card') || b.closest('.detect-body');
        var i = b.getAttribute('data-phase');
        card.querySelectorAll('.phase-tab').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        card.querySelectorAll('.phase-pane').forEach(function (p) { p.classList.toggle('hidden', p.getAttribute('data-phase') !== i); });
      });
    });
    root.querySelectorAll('.rp-office').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); openPageOffice(a.getAttribute('data-file') || a.textContent); });
    });
  }

  function render(task, panel) {
    var report = pickReport(task);
    var rounds = report.rounds || [{ revision: 'V1.0' }];
    var cur = rounds[rounds.length - 1] || rounds[0];
    var prev = rounds.length > 1 ? rounds[rounds.length - 2] : null;
    var fileEl = document.getElementById('rp-file');
    var verEl = document.getElementById('rp-version');
    var compEl = document.getElementById('rp-compiler');
    var atEl = document.getElementById('rp-compiletime');
    var prevEl = document.getElementById('rp-version-prev');
    var body = document.getElementById('info-body');
    if (fileEl) {
      var signed = task && global.ReportFlowStore && ReportFlowStore.isSigned && ReportFlowStore.isSigned(task.status);
      var fname = signed
        ? ((report.file && report.file.pdf) || String((report.file && report.file.word) || report.reportName || '检测报告.docx').replace(/\.docx$/i, '.pdf'))
        : ((report.file && report.file.word) || report.reportName || '检测报告.docx');
      fileEl.innerHTML = '<i class="fa ' + (signed ? 'fa-file-pdf-o' : 'fa-file-word-o') + ' mr-1"></i>' + esc(fname);
      fileEl.onclick = function (e) { e.preventDefault(); openPageOffice(fname); };
    }
    if (verEl) verEl.textContent = cur.revision || 'V1.0';
    if (compEl) compEl.textContent = report.compiler || task.compiler || 'admin';
    if (atEl) atEl.textContent = (report.file && report.file.at) || '';
    if (prevEl) prevEl.textContent = prev ? ('上一版 ' + prev.revision) : '首版';
    if (body) {
      body.innerHTML = panelHtml(report, panel || 'preview');
      bindToggles(body);
    }
    return report;
  }

  global.ReportInfoPanel = { pickReport: pickReport, render: render, openPageOffice: openPageOffice };
})(window);
