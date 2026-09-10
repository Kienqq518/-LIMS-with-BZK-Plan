/**
 * 原始记录单表格 / 历史 / 重导 / 导出抽屉（原型共享）
 */
(function (global) {
  var V = function () { return global.OriginalRecordVersion; };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function specimenHtml(ids) {
    return (ids || []).map(function (id) {
      return '<div class="or-spec">' + esc(id) + '</div>';
    }).join('');
  }

  function statusHtml(file) {
    if (file.invalid) {
      return '<span class="or-stale" title="' + esc(file.invalidReason || '已失效') + '">已失效</span>';
    }
    return '<span class="or-ok">有效</span>';
  }

  function nameHtml(file) {
    var tag = file.invalid
      ? ' <span class="or-badge" title="' + esc(file.invalidReason || '') + '">已失效</span>'
      : '';
    return '<a href="#" class="text-blue-600 hover:underline" onclick="OriginalRecordUI.viewFile(\'' +
      esc(file.id) + '\');return false;"><i class="fa fa-file-word-o"></i> ' +
      esc(file.fileName) + '</a>' + tag;
  }

  function opsHtml(file) {
    var html = '<button type="button" class="or-btn or-btn-primary" onclick="OriginalRecordUI.viewFile(\'' +
      esc(file.id) + '\')">查看</button>';
    html += '<button type="button" class="or-btn" onclick="OriginalRecordUI.openHistory(\'' +
      esc(file.identityKey) + '\')">查看历史</button>';
    if (file.invalid) {
      html += '<button type="button" class="or-btn or-btn-warn" data-annotate="or-regen" onclick="OriginalRecordUI.regenerate(\'' +
        esc(file.id) + '\')">重新生成</button>';
    }
    return html;
  }

  function rowHtml(file, index) {
    var staleClass = file.invalid ? ' class="or-row-stale"' : '';
    return '<tr data-file-row="raw" data-or-id="' + esc(file.id) + '"' + staleClass + '>' +
      '<td>' + (index + 1) + '</td>' +
      '<td class="text-left">' + nameHtml(file) + '</td>' +
      '<td class="text-left text-xs leading-5">' + specimenHtml(file.specimenIds) + '</td>' +
      '<td class="text-left text-xs">' + esc(V().modeLabel(file.modeKey)) + '</td>' +
      '<td>' + esc(file.createdAt) + '</td>' +
      '<td>' + statusHtml(file) + '</td>' +
      '<td class="whitespace-nowrap or-ops">' + opsHtml(file) + '</td>' +
      '</tr>';
  }

  function renderTable(tbody) {
    if (typeof tbody === 'string') tbody = document.getElementById(tbody);
    if (!tbody) return;
    var rows = V().listCurrent();
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-box" style="padding:20px 0;text-align:center;color:#94a3b8">暂无原始记录单</div></td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(rowHtml).join('');
    if (global.PrototypeAnnotation && PrototypeAnnotation.refresh) PrototypeAnnotation.refresh();
  }

  function renderAll() {
    document.querySelectorAll('[data-or-table]').forEach(function (tb) {
      renderTable(tb);
    });
    var rawBtn = document.getElementById('btnBatchDlRaw');
    if (rawBtn) {
      var valid = V().listValidCurrent().length;
      var total = V().listCurrent().length;
      rawBtn.classList.toggle('is-visible', total >= 2);
      rawBtn.setAttribute('data-valid-count', String(valid));
    }
  }

  function viewFile(id) {
    var f = V().findById(id);
    if (!f) return;
    var extra = f.invalid ? '\n状态：已失效\n原因：' + (f.invalidReason || '') : '\n状态：有效';
    alert('在线查看「' + f.fileName + '」' + extra + '\n版本 ' + f.label + '（原型）');
  }

  function openHistory(identityKey) {
    ensureModals();
    var list = V().historyOf(identityKey);
    var title = (list.filter(function (v) { return v.current; })[0] || list[list.length - 1] || {}).fileName || '原始记录单';
    document.getElementById('orHistoryTitle').textContent = title;
    document.getElementById('orHistoryMeta').textContent =
      '共展示 ' + list.length + ' 条（全员一致，含全部系统主版本；历史仅在线查看）';
    var body = document.getElementById('orHistoryBody');
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="5" class="text-center text-slate-400 py-8">暂无可见历史</td></tr>';
    } else {
      body.innerHTML = list.slice().reverse().map(function (v) {
        var note = V().historyNote(v);
        var ops = '<button type="button" class="text-blue-600 hover:underline text-xs" onclick="alert(\'在线查看 ' +
          esc(v.label) + '（不可下载）\')">在线查看</button>';
        return '<tr class="' + (v.current ? 'bg-blue-50/40' : '') + '">' +
          '<td>' + esc(v.label) + (v.current ? ' <span class="text-xs text-blue-600">当前</span>' : '') + '</td>' +
          '<td>' + esc(v.operator) + '</td>' +
          '<td>' + esc(v.createdAt) + '</td>' +
          '<td class="text-xs" data-annotate="or-history-note-cell">' + (note ? esc(note) : '—') + '</td>' +
          '<td>' + ops + '</td></tr>';
      }).join('');
    }
    showModal('orHistoryModal');
    if (global.PrototypeAnnotation && PrototypeAnnotation.refresh) PrototypeAnnotation.refresh();
  }

  function showModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.remove('hidden');
    m.classList.add('flex');
  }

  function closeModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.classList.add('hidden');
    m.classList.remove('flex');
  }

  var pendingRegenId = null;

  function regenerate(id) {
    var file = V().findById(id);
    if (!file) return;
    if (V().canKeepIdentity(file)) {
      V().exportFile({
        specimenIds: file.specimenIds,
        testNames: file.testNames,
        modeKey: file.modeKey,
        fileName: file.fileName
      });
      alert('已按原范围重新生成「' + file.fileName + '」，旧版已进入查看历史，当前版有效。');
      return;
    }
    pendingRegenId = id;
    var missing = V().missingCoverage(file);
    var remain = V().remainingSpecimens(file);
    var names = missing.specimens.join('、') || '覆盖对象';
    var msg = names + ' 已删除，无法按原范围重导。';
    var confirmBtn = document.getElementById('orRegenConfirm');
    if (!remain.length) {
      msg += '且没有剩余对象可导出。';
      confirmBtn.disabled = true;
      confirmBtn.className = 'cursor-not-allowed rounded bg-slate-200 px-4 py-1.5 text-sm text-slate-400';
    } else {
      msg += '是否将剩余未删除对象直接重新导出？';
      confirmBtn.disabled = false;
      confirmBtn.className = 'rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700';
    }
    document.getElementById('orRegenMsg').textContent = msg;
    ensureModals();
    showModal('orRegenModal');
  }

  function confirmRemaining() {
    if (!pendingRegenId) return;
    var res = V().exportRemaining(pendingRegenId);
    closeModal('orRegenModal');
    pendingRegenId = null;
    if (!res.ok) {
      alert(res.error === 'empty' ? '没有剩余对象可导出' : (res.error || '导出失败'));
      return;
    }
    alert('已将剩余对象导出为新文件「' + res.file.fileName + '」。旧文件保持已失效，不进入新文件历史。');
  }

  function jumpToRecordPage() {
    closeModal('orRegenModal');
    if (!/test-record\.html/.test(location.pathname)) {
      location.href = 'test-record.html';
      return;
    }
    openExportDrawer();
  }

  var exportPreviewFiles = [];

  function candidates() {
    var live = V().load().liveSpecimenIds.slice();
    var sample = '绝缘操作杆';
    return [
      { id: 'p-ac', fileName: 'SC2026/0073-交流耐压-原始记录.docx', sampleLabel: sample, specimenIds: live.slice(), testNames: ['交流耐压'], modeKey: 'model-each', ready: true },
      { id: 'p-dim', fileName: 'SC2026/0073-外观尺寸-原始记录.docx', sampleLabel: sample, specimenIds: live.slice(), testNames: ['外观尺寸'], modeKey: 'model-each', ready: true },
      { id: 'p-bend', fileName: 'SC2026/0073-抗弯静负荷-原始记录.docx', sampleLabel: sample, specimenIds: live.slice(), testNames: ['抗弯静负荷'], modeKey: 'model-each', ready: live.length > 0 },
      { id: 'p-dyn', fileName: 'SC2026/0073-抗弯动负荷-原始记录.docx', sampleLabel: sample, specimenIds: live.slice(), testNames: ['抗弯动负荷'], modeKey: 'model-each', ready: true }
    ];
  }

  function buildExportPreview() {
    var prevChecked = {};
    exportPreviewFiles.forEach(function (f) { prevChecked[f.id] = f.checked; });
    exportPreviewFiles = candidates().map(function (p) {
      var hint = V().hintForPreview(p);
      var ready = !!p.ready;
      var checked = prevChecked[p.id];
      if (checked === undefined) checked = ready;
      return {
        id: p.id,
        fileName: p.fileName,
        sampleLabel: p.sampleLabel,
        specimenIds: p.specimenIds,
        specimenId: p.modeKey && p.modeKey.indexOf('specimen') === 0 ? (p.specimenIds[0] || '') : '',
        testNames: p.testNames,
        tests: (p.testNames || []).map(function (name) { return { name: name, done: ready }; }),
        modeKey: p.modeKey,
        ready: ready,
        status: ready ? 'ready' : 'incomplete',
        statusDetail: ready ? '' : '覆盖对象不完整',
        hint: hint,
        checked: ready ? !!checked : false
      };
    });
  }

  function exportStatusLabel(status) {
    if (status === 'ready') return '就绪';
    if (status === 'incomplete') return '试验未完成';
    if (status === 'missing_template') return '缺模版';
    return status;
  }

  function renderExportTestTags(tests) {
    return '<div class="export-test-tags">' + (tests || []).map(function (t) {
      var cls = t.done ? 'done' : 'pending';
      var suffix = t.done ? '' : '（未完成）';
      return '<span class="export-test-tag ' + cls + '">' + esc(t.name) + suffix + '</span>';
    }).join('') + '</div>';
  }

  var exportAnnotateStatus = false;

  function renderExportFileRow(file, idx, showSpecimen) {
    var ready = file.status === 'ready';
    var hint = file.hint || {};
    var annotateStatus = '';
    if (!exportAnnotateStatus && ready) {
      exportAnnotateStatus = true;
      annotateStatus = ' data-annotate="export-status"';
    }
    var html = '<tr data-idx="' + idx + '">';
    html += '<td class="col-check"><input type="checkbox" class="export-row-check" data-idx="' + idx + '"' +
      (ready && file.checked ? ' checked' : '') + (ready ? '' : ' disabled') +
      ' onchange="OriginalRecordUI.onExportRowCheck(' + idx + ', this.checked)" /></td>';
    html += '<td class="col-filename">' + esc(file.fileName) + '</td>';
    if (showSpecimen) {
      html += '<td class="col-specimen">' + esc(file.specimenId || '—') + '</td>';
    }
    html += '<td>' + renderExportTestTags(file.tests) + '</td>';
    html += '<td class="col-status"' + annotateStatus + '><span class="export-status ' + file.status + '">' +
      exportStatusLabel(file.status) + '</span>';
    if (ready && hint.text) {
      html += '<span class="export-status-detail ' + esc(hint.code || '') + '">' + esc(hint.text) + '</span>';
    } else if (!ready && file.statusDetail) {
      html += '<span class="export-status-detail">' + esc(file.statusDetail) + '</span>';
    }
    html += '</td>';
    html += '<td class="col-op"><button type="button" class="export-op-btn" title="导出"' +
      (ready ? '' : ' disabled') +
      ' onclick="OriginalRecordUI.exportPreviewRow(' + idx + ')"><i class="fa fa-cloud-download"></i></button></td>';
    html += '</tr>';
    return html;
  }

  function groupExportFiles(files) {
    var modeOrder = ['model-all', 'model-each', 'model-multi', 'specimen-all', 'specimen-each', 'specimen-multi'];
    var byMode = {};
    files.forEach(function (file, idx) {
      file._idx = idx;
      var mk = file.modeKey || 'model-each';
      if (!byMode[mk]) byMode[mk] = {};
      var sampleKey = file.sampleLabel || '样品';
      if (!byMode[mk][sampleKey]) {
        byMode[mk][sampleKey] = { sampleLabel: sampleKey, files: [] };
      }
      byMode[mk][sampleKey].files.push(file);
    });
    return modeOrder.filter(function (k) { return byMode[k]; }).map(function (modeKey) {
      var sampleMap = byMode[modeKey];
      var samples = Object.keys(sampleMap).map(function (k) { return sampleMap[k]; });
      var totalFiles = samples.reduce(function (n, s) { return n + s.files.length; }, 0);
      return {
        modeKey: modeKey,
        modeLabel: V().modeLabel(modeKey),
        dim: modeKey.indexOf('specimen') === 0 ? 'specimen' : 'model',
        samples: samples,
        totalFiles: totalFiles
      };
    });
  }

  function renderExportPreview() {
    buildExportPreview();
    exportAnnotateStatus = false;
    var groups = groupExportFiles(exportPreviewFiles);
    var html = '';
    if (!groups.length) {
      html = '<div class="py-10 text-center text-slate-400">暂无可预览的导出文件</div>';
    } else {
      groups.forEach(function (group) {
        var modeId = 'orExportMode-' + group.modeKey;
        var showSpecimen = group.dim === 'specimen';
        html += '<div class="export-mode-group export-collapse" id="' + modeId + '" data-annotate="export-mode-group">';
        html += '<div class="export-collapse-head" onclick="OriginalRecordUI.toggleExportCollapse(\'' + modeId + '\')">';
        html += '<i class="fa fa-chevron-down chev"></i>';
        html += '<span>' + esc(group.modeLabel) + '</span>';
        html += '<span class="export-mode-count">' + group.samples.length + ' 个样品 · ' + group.totalFiles + ' 个文件</span>';
        html += '</div>';
        html += '<div class="export-collapse-body">';
        group.samples.forEach(function (sampleBlock) {
          html += '<div class="export-sample-block" data-annotate="export-sample-block">';
          html += '<div class="export-sample-head">' + esc(sampleBlock.sampleLabel) + '</div>';
          html += '<div class="overflow-x-auto"><table class="export-table min-w-full"><thead><tr>';
          html += '<th class="col-check"></th>';
          html += '<th class="col-filename">文件名（预览）</th>';
          if (showSpecimen) html += '<th class="col-specimen">试样编号</th>';
          html += '<th>包含试验项</th><th class="col-status">状态</th><th class="col-op">操作</th>';
          html += '</tr></thead><tbody>';
          sampleBlock.files.forEach(function (file) {
            html += renderExportFileRow(file, file._idx, showSpecimen);
          });
          html += '</tbody></table></div></div>';
        });
        html += '</div></div>';
      });
    }

    var groupsEl = document.getElementById('orExportPreviewGroups');
    if (groupsEl) groupsEl.innerHTML = html;

    var readyFiles = exportPreviewFiles.filter(function (f) { return f.status === 'ready'; });
    var checkAll = document.getElementById('orExportCheckAll');
    if (checkAll) {
      checkAll.checked = readyFiles.length > 0 && readyFiles.every(function (f) { return f.checked; });
      checkAll.disabled = !readyFiles.length;
    }
    syncExportSummary();
    if (global.PrototypeAnnotation && PrototypeAnnotation.refresh) PrototypeAnnotation.refresh();
  }

  function syncExportSummary() {
    var warn = document.getElementById('orExportSummaryWarn');
    if (!warn) return;
    if (!exportPreviewFiles.length) {
      warn.classList.remove('show');
      warn.textContent = '';
      return;
    }
    var blocked = exportPreviewFiles.filter(function (f) { return f.status !== 'ready'; });
    if (!blocked.length) {
      warn.classList.remove('show');
      warn.textContent = '';
      return;
    }
    warn.textContent = '共 ' + blocked.length + ' 个文件暂不可导出：' +
      blocked.map(function (f) { return f.fileName + '（' + exportStatusLabel(f.status) + '）'; }).join('；');
    warn.classList.add('show');
  }

  function toggleExportCollapse(id) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle('collapsed');
  }

  function onExportRowCheck(idx, checked) {
    if (!exportPreviewFiles[idx] || exportPreviewFiles[idx].status !== 'ready') return;
    exportPreviewFiles[idx].checked = checked;
    var readyFiles = exportPreviewFiles.filter(function (f) { return f.status === 'ready'; });
    var checkAll = document.getElementById('orExportCheckAll');
    if (checkAll) checkAll.checked = readyFiles.length > 0 && readyFiles.every(function (f) { return f.checked; });
  }

  function toggleExportCheckAll(checked) {
    exportPreviewFiles.forEach(function (file, i) {
      if (file.status !== 'ready') return;
      file.checked = checked;
      var el = document.querySelector('#orExportMask .export-row-check[data-idx="' + i + '"]');
      if (el && !el.disabled) el.checked = checked;
    });
  }

  function openExportDrawer() {
    ensureModals();
    exportPreviewFiles = [];
    renderExportPreview();
    document.getElementById('orExportMask').classList.add('open');
    if (global.PrototypeAnnotation && PrototypeAnnotation.refresh) PrototypeAnnotation.refresh();
  }

  function closeExportDrawer() {
    var m = document.getElementById('orExportMask');
    if (m) m.classList.remove('open');
    if (global.PrototypeAnnotation && PrototypeAnnotation.refresh) PrototypeAnnotation.refresh();
  }

  function exportPreviewRow(idx) {
    var file = exportPreviewFiles[idx];
    if (!file || file.status !== 'ready') return;
    V().exportFile(file);
    alert('导出记录单（原型演示）\n文件：' + file.fileName +
      '\n生成模式：' + V().modeLabel(file.modeKey) +
      '\n包含试验项：' + (file.testNames || []).join('、'));
    renderExportPreview();
  }

  function confirmExport() {
    var selected = exportPreviewFiles.filter(function (f) {
      return f.status === 'ready' && f.checked;
    });
    if (!selected.length) {
      var anyReady = exportPreviewFiles.some(function (f) { return f.status === 'ready'; });
      alert(anyReady ? '请至少勾选一条可导出的文件' : '当前没有可导出的文件，请完成试验或配置模版后再试');
      return;
    }
    selected.forEach(function (f) { V().exportFile(f); });
    alert('批量导出（原型演示）\n共 ' + selected.length + ' 个文件：\n' +
      selected.map(function (f) { return f.fileName; }).join('\n'));
    renderExportPreview();
  }

  function batchDownloadValid() {
    var list = V().listValidCurrent();
    if (!list.length) {
      alert('没有状态为有效的原始记录单可下载（已失效与历史不纳入）。');
      return;
    }
    alert('【原型演示】批量下载有效原始记录单 ' + list.length + ' 个（不含已失效与历史）：\n' +
      list.map(function (f) { return f.fileName; }).join('\n'));
  }

  function simulateKind(kind, extra, coverage) {
    coverage = coverage || {};
    var reason = V().formatChangeNote(kind, extra);
    var n = V().invalidateByCoverage({
      specimenIds: coverage.specimenIds,
      testNames: coverage.testNames,
      reason: reason
    });
    alert(n ? ('已立刻打失效，说明将记为「' + reason + '」。') : '没有仍有效且覆盖该范围的记录单（可能已经失效）。');
  }

  function simulateRetest() {
    simulateKind('retest', {}, { specimenIds: [V().SPEC_A], testNames: ['交流耐压'] });
  }

  function simulateDataEdit() {
    simulateKind('data_edit', {}, { testNames: ['外观尺寸'] });
  }

  function simulateDeleteB() {
    var reason = V().formatChangeNote('delete_sample');
    var n = V().deleteSpecimen(V().SPEC_B, reason);
    alert(n ? ('试样已删除，立刻打失效，说明记为「' + reason + '」。') : '试样已不在在线列表，或覆盖文件均已失效。');
  }

  function simulateDeleteTest() {
    simulateKind('delete_test', { names: ['抗弯动负荷'] }, { testNames: ['外观尺寸'] });
  }

  function simulateChangeTest() {
    simulateKind('change_test', { added: ['泄漏电流'], removed: ['外观尺寸'] }, { testNames: ['外观尺寸'] });
  }

  function simulateReviewer() {
    simulateKind('reviewer', {}, {});
  }

  function simulateEntrustInfo() {
    simulateKind('entrust_info', { detail: '检测类别' }, {});
  }

  function ensureStyles() {
    if (document.getElementById('or-ui-styles')) return;
    var css = [
      '.or-badge{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:3px;background:#fef2f2;color:#b91c1c;font-size:11px;font-weight:500;vertical-align:middle}',
      '.or-stale{color:#b91c1c;font-weight:500}',
      '.or-ok{color:#15803d;font-weight:500}',
      '.or-row-stale td{background:#fff7ed}',
      '.or-spec{white-space:nowrap}',
      '.or-ops .or-btn{margin-right:4px;margin-bottom:2px}',
      '.or-btn{border-radius:4px;border:1px solid #cbd5e1;background:#fff;color:#475569;font-size:12px;padding:4px 8px;cursor:pointer}',
      '.or-btn:hover{background:#f8fafc}',
      '.or-btn-primary{background:#2563eb;border-color:#2563eb;color:#fff}',
      '.or-btn-primary:hover{background:#1d4ed8}',
      '.or-btn-warn{background:#fff7ed;border-color:#fdba74;color:#c2410c}',
      '.or-btn-warn:hover{background:#ffedd5}',
      '.or-jump{display:inline-flex;align-items:center;gap:4px;border-radius:4px;border:1px solid #2563eb;color:#2563eb;background:#fff;font-size:12px;padding:6px 12px}',
      '.or-jump:hover{background:#eff6ff}'
    ].join('');
    var s = document.createElement('style');
    s.id = 'or-ui-styles';
    s.textContent = css;
    document.head.appendChild(s);
    if (!document.getElementById('record-export-drawer-css') &&
        !document.querySelector('link[href="css/record-export-drawer.css"]')) {
      var link = document.createElement('link');
      link.id = 'record-export-drawer-css';
      link.rel = 'stylesheet';
      link.href = 'css/record-export-drawer.css';
      document.head.appendChild(link);
    }
  }

  function ensureModals() {
    ensureStyles();
    if (document.getElementById('orHistoryModal')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div id="orHistoryModal" class="fixed inset-0 z-[80] hidden items-center justify-center bg-black/40 p-4">' +
        '<div class="flex max-h-[86vh] w-[860px] max-w-full flex-col rounded-lg bg-white shadow-xl">' +
          '<div class="flex items-center justify-between border-b border-slate-100 px-6 py-3">' +
            '<div><h3 class="text-base font-medium text-slate-800">查看历史 · <span id="orHistoryTitle">—</span></h3>' +
            '<p id="orHistoryMeta" class="mt-0.5 text-xs text-slate-400"></p></div>' +
            '<button type="button" onclick="OriginalRecordUI.closeModal(\'orHistoryModal\')" class="text-slate-400 hover:text-slate-600"><i class="fa fa-times"></i></button>' +
          '</div>' +
          '<div class="flex-1 overflow-y-auto px-6 py-4">' +
            '<table class="w-full border-collapse text-sm"><thead><tr>' +
            '<th class="border border-slate-200 bg-slate-50 px-3 py-2 text-left">版本</th>' +
            '<th class="border border-slate-200 bg-slate-50 px-3 py-2 text-left">操作人</th>' +
            '<th class="border border-slate-200 bg-slate-50 px-3 py-2 text-left">时间</th>' +
            '<th class="border border-slate-200 bg-slate-50 px-3 py-2 text-left" data-annotate="or-history-note">说明</th>' +
            '<th class="border border-slate-200 bg-slate-50 px-3 py-2 text-left">操作</th>' +
            '</tr></thead><tbody id="orHistoryBody"></tbody></table>' +
            '<p class="mt-3 text-xs text-slate-400">历史版仅支持在线查看；不可下载/编辑/回滚。</p>' +
          '</div></div></div>' +
      '<div id="orRegenModal" class="fixed inset-0 z-[80] hidden items-center justify-center bg-black/40 p-4" data-annotate="or-regen-dialog">' +
        '<div class="w-[520px] max-w-full rounded-lg bg-white shadow-xl">' +
          '<div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">' +
            '<h3 class="text-base font-medium text-slate-800">无法按原范围重导</h3>' +
            '<button type="button" onclick="OriginalRecordUI.closeModal(\'orRegenModal\')" class="text-slate-400"><i class="fa fa-times"></i></button>' +
          '</div>' +
          '<p id="orRegenMsg" class="px-5 py-4 text-sm leading-6 text-slate-600"></p>' +
          '<div class="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">' +
            '<button type="button" class="rounded border border-slate-300 px-4 py-1.5 text-sm" onclick="OriginalRecordUI.closeModal(\'orRegenModal\')">取消</button>' +
            '<button type="button" class="rounded border border-blue-300 px-4 py-1.5 text-sm text-blue-600 hover:bg-blue-50" onclick="OriginalRecordUI.jumpToRecordPage()">跳转原始记录页面</button>' +
            '<button type="button" id="orRegenConfirm" class="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700" onclick="OriginalRecordUI.confirmRemaining()">确认</button>' +
          '</div></div></div>' +
      '<div id="orExportMask" class="drawer-mask" data-annotate="export-drawer">' +
        '<div class="export-drawer" onclick="event.stopPropagation()">' +
          '<div class="export-drawer-header">' +
            '<h3 class="text-base font-medium text-slate-800">记录单导出详情</h3>' +
            '<button type="button" onclick="OriginalRecordUI.closeExportDrawer()" class="export-drawer-close" title="关闭" aria-label="关闭"><i class="fa fa-times"></i></button>' +
          '</div>' +
          '<div class="export-drawer-body">' +
            '<div id="orExportPreviewGroups"></div>' +
            '<div class="export-warn" id="orExportSummaryWarn" data-annotate="export-summary-warn"></div>' +
          '</div>' +
          '<div class="export-drawer-footer">' +
            '<label class="export-select-all" data-annotate="export-select-all">' +
              '<input type="checkbox" id="orExportCheckAll" onchange="OriginalRecordUI.toggleExportCheckAll(this.checked)" />全选可导出项</label>' +
            '<button type="button" onclick="OriginalRecordUI.confirmExport()" data-annotate="export-batch" class="rounded bg-blue-600 px-5 py-1.5 text-sm text-white hover:bg-blue-700">批量导出</button>' +
          '</div></div></div>';
    document.body.appendChild(wrap);
    document.getElementById('orHistoryModal').addEventListener('click', function (e) {
      if (e.target === this) closeModal('orHistoryModal');
    });
    document.getElementById('orRegenModal').addEventListener('click', function (e) {
      if (e.target === this) closeModal('orRegenModal');
    });
    document.getElementById('orExportMask').addEventListener('click', function (e) {
      if (e.target === this) closeExportDrawer();
    });
  }

  function mount() {
    ensureModals();
    V().load();
    V().onChange(renderAll);
    renderAll();
  }

  global.OriginalRecordUI = {
    mount: mount,
    renderTable: renderTable,
    renderAll: renderAll,
    viewFile: viewFile,
    openHistory: openHistory,
    regenerate: regenerate,
    confirmRemaining: confirmRemaining,
    jumpToRecordPage: jumpToRecordPage,
    openExportDrawer: openExportDrawer,
    closeExportDrawer: closeExportDrawer,
    confirmExport: confirmExport,
    toggleExportCollapse: toggleExportCollapse,
    onExportRowCheck: onExportRowCheck,
    toggleExportCheckAll: toggleExportCheckAll,
    exportPreviewRow: exportPreviewRow,
    batchDownloadValid: batchDownloadValid,
    simulateRetest: simulateRetest,
    simulateDataEdit: simulateDataEdit,
    simulateDeleteB: simulateDeleteB,
    simulateDeleteTest: simulateDeleteTest,
    simulateChangeTest: simulateChangeTest,
    simulateReviewer: simulateReviewer,
    simulateEntrustInfo: simulateEntrustInfo,
    resetDemo: function () { V().resetDemo(); },
    closeModal: closeModal,
    ensureModals: ensureModals
  };
})(typeof window !== 'undefined' ? window : this);
