/**
 * 标签与合格证模版 UI — 自由设计编辑器
 * 左：元件库 / 中：画布 / 右：布局|内容双面板
 */
(function (global) {
  var cfg = null;
  var state = {
    cat: 'aqgqj',
    type: 'certificate',
    editingId: null,
    draft: null,
    editingIsDefault: false,
    previewId: null,
    bindOpen: false,
    bindKw: '',
    selectedId: null,
    propTab: 'layout', // layout | content
    scale: 3.78, // px per mm，与 LabelCertRender.mmToPx 对齐，便于预览叠层
    zoom: 1, // 画布视觉缩放（CSS transform），不影响 mm 坐标
    drag: null,
    lastPaper: null, // { wMm, hMm } 用于纸张变更时等比缩放元素
    history: { past: [], future: [], coalesceKey: null, max: 40 }
  };

  var ZOOM_MIN = 0.5;
  var ZOOM_MAX = 2;
  var ZOOM_STEP = 0.1;

  function $(id) { return document.getElementById(id); }

  function sampleName(id) {
    var leaves = LabelCertConfig.SAMPLE_LEAVES[state.cat] || [];
    for (var i = 0; i < leaves.length; i++) if (leaves[i].id === id) return leaves[i].name;
    return id;
  }

  function currentBucket() {
    var bucket = LabelCertConfig.getBucket(cfg, state.cat, state.type);
    return LabelCertConfig.ensureBucketShape(bucket, state.type);
  }

  function refreshAnnotations() {
    if (window.PrototypeAnnotation && PrototypeAnnotation.refresh) PrototypeAnnotation.refresh();
  }

  function elCount(tpl) {
    return (tpl.elements || []).length;
  }

  function renderList() {
    var bucket = currentBucket();
    LabelCertConfig.save(cfg);

    var def = LabelCertConfig.findTemplate(bucket, bucket.defaultTemplateId);
    var personal = (bucket.templates || []).filter(function (t) { return t.id !== bucket.defaultTemplateId; });

    var card = $('lc_defaultCard');
    if (card && def) {
      card.innerHTML =
        '<div class="meta">' +
          '<div class="name">' + LabelCertRender.esc(def.name) +
            '<span class="lc-default-badge"><i class="fa fa-lock"></i> 默认 · 兜底</span>' +
          '</div>' +
          '<div class="sub">自由设计 · ' + def.paper.wMm + '×' + def.paper.hMm + ' mm · ' +
            elCount(def) + ' 个元素 · 覆盖全部未单独配置的样品</div>' +
        '</div>' +
        '<div class="flex items-center gap-3 flex-shrink-0">' +
          '<button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white" data-lc-act="edit" data-id="' + def.id + '" data-annotate="label-cert-default-edit">编辑版式</button>' +
          '<button type="button" class="text-sm text-blue-600 hover:underline" data-lc-act="preview" data-id="' + def.id + '">预览</button>' +
        '</div>';
    }

    var body = $('lc_tplBody');
    if (!body) return;
    body.innerHTML = personal.length ? personal.map(function (t, idx) {
      var binds = (t.bindSampleIds || []).map(sampleName).join('、') || '—';
      var n = (t.bindSampleIds || []).length;
      var enableAnno = idx === 0 ? ' data-annotate="label-cert-enable"' : '';
      var opsAnno = idx === 0 ? ' data-annotate="label-cert-ops"' : '';
      return '<tr class="hover:bg-slate-50">' +
        '<td class="border-b border-slate-100 px-3 py-2">' + LabelCertRender.esc(t.name) + '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2">' + elCount(t) + ' 个元素</td>' +
        '<td class="border-b border-slate-100 px-3 py-2">' + (t.paper.wMm + '×' + t.paper.hMm) + '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2 max-w-[240px] truncate" title="' + LabelCertRender.esc(binds) + '">' +
          LabelCertRender.esc(binds) + ' <span class="text-slate-400">(' + n + ')</span></td>' +
        '<td class="border-b border-slate-100 px-3 py-2">' +
          '<label class="lc-switch"' + enableAnno + ' title="' + (t.enabled ? '启用中，停用后回退默认' : '已停用，使用默认模版') + '">' +
            '<input type="checkbox" data-lc-enable="' + t.id + '"' + (t.enabled ? ' checked' : '') + ' />' +
            '<span class="slider"></span>' +
          '</label>' +
        '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2 whitespace-nowrap"' + opsAnno + '>' +
          '<button type="button" class="text-blue-600 hover:underline mr-2" data-lc-act="edit" data-id="' + t.id + '">编辑</button>' +
          '<button type="button" class="text-blue-600 hover:underline mr-2" data-lc-act="preview" data-id="' + t.id + '">预览</button>' +
          '<button type="button" class="text-red-500 hover:underline" data-lc-act="del" data-id="' + t.id + '">删除</button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="px-3 py-10 text-center text-slate-400">尚未配置个性化模版，全部样品使用上方默认模版</td></tr>';

    $('lc_listTitle').textContent = state.type === 'certificate' ? '合格证模版' : '样品标签模版';
    document.querySelectorAll('#labelCertView .lc-type-nav').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-type') === state.type);
    });
    refreshAnnotations();
  }

  function setEnabled(id, enabled) {
    var bucket = currentBucket();
    if (LabelCertConfig.isDefaultTemplate(bucket, id)) {
      alert('默认模版不可停用');
      renderList();
      return;
    }
    var tpl = LabelCertConfig.findTemplate(bucket, id);
    if (!tpl) return;
    if (enabled && !(tpl.bindSampleIds || []).length) {
      alert('个性化模版需先绑定至少一个样品才能启用');
      renderList();
      return;
    }
    if (enabled) {
      var conflicts = LabelCertConfig.findBindConflicts(state.cat, state.type, tpl.id, tpl.bindSampleIds || []);
      if (conflicts.length) {
        alert('无法启用：样品绑定冲突\n' + conflicts.map(function (c) {
          return sampleName(c.sampleId) + ' → ' + c.templateName;
        }).join('\n'));
        renderList();
        return;
      }
    }
    tpl.enabled = !!enabled;
    tpl.updatedAt = LabelCertConfig.formatNow();
    LabelCertConfig.save(cfg);
    renderList();
  }

  function removeTpl(id) {
    var bucket = currentBucket();
    if (LabelCertConfig.isDefaultTemplate(bucket, id)) {
      alert('默认模版不可删除');
      return;
    }
    if (!confirm('确定删除该个性化模版？相关样品将回退默认模版。')) return;
    bucket.templates = bucket.templates.filter(function (t) { return t.id !== id; });
    LabelCertConfig.save(cfg);
    renderList();
  }

  /* ---------- 新建：空白 / 复制 ---------- */

  function openCreateChooser() {
    var modal = $('lc_createModal');
    if (!modal) {
      openEditorBlank();
      return;
    }
    var sizeSel = $('lc_c_size');
    if (sizeSel) {
      var presets = LabelCertConfig.PAPER_SIZE_PRESETS || [];
      var filtered = presets.filter(function (p) {
        if (state.type === 'sample_label') return p.id === 'label' || p.id === 'lr';
        return p.id !== 'label';
      });
      sizeSel.innerHTML = filtered.map(function (p) {
        return '<option value="' + p.id + '">' + p.name + '（' + p.wMm + '×' + p.hMm + '）</option>';
      }).join('') + '<option value="custom">自定义…</option>';
    }
    var srcSel = $('lc_c_source');
    if (srcSel) {
      var bucket = currentBucket();
      srcSel.innerHTML = (bucket.templates || []).map(function (t) {
        var tag = LabelCertConfig.isDefaultTemplate(bucket, t) ? '（默认）' : '';
        return '<option value="' + t.id + '">' + LabelCertRender.esc(t.name) + tag +
          ' · ' + t.paper.wMm + '×' + t.paper.hMm + '</option>';
      }).join('');
    }
    setCreateMode('blank');
    modal.classList.add('open');
  }

  function setCreateMode(mode) {
    var blank = $('lc_c_blankPane');
    var copy = $('lc_c_copyPane');
    var tabs = document.querySelectorAll('[data-lc-create-mode]');
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-lc-create-mode') === mode);
    });
    if (blank) blank.classList.toggle('hidden', mode !== 'blank');
    if (copy) copy.classList.toggle('hidden', mode !== 'copy');
    var confirm = $('lc_c_confirm');
    if (confirm) confirm.setAttribute('data-mode', mode);
  }

  function closeCreateChooser() {
    var modal = $('lc_createModal');
    if (modal) modal.classList.remove('open');
  }

  function confirmCreate() {
    var mode = ($('lc_c_confirm') && $('lc_c_confirm').getAttribute('data-mode')) || 'blank';
    if (mode === 'copy') {
      var sid = $('lc_c_source') && $('lc_c_source').value;
      var bucket = currentBucket();
      var src = LabelCertConfig.findTemplate(bucket, sid);
      if (!src) { alert('请选择源模版'); return; }
      var name = (($('lc_c_copyName') && $('lc_c_copyName').value) || '').trim() || ((src.name || '模版') + ' 副本');
      var draft = LabelCertConfig.cloneTemplateAsPersonal(src, { type: state.type, name: name });
      closeCreateChooser();
      openEditorWithDraft(draft, false);
      return;
    }
    openEditorBlank();
    closeCreateChooser();
  }

  function openEditorBlank() {
    var sizeId = $('lc_c_size') && $('lc_c_size').value;
    var paper;
    if (sizeId === 'custom') {
      paper = {
        wMm: parseFloat($('lc_c_w') && $('lc_c_w').value) || 90,
        hMm: parseFloat($('lc_c_h') && $('lc_c_h').value) || 50
      };
    } else {
      var presets = LabelCertConfig.PAPER_SIZE_PRESETS || [];
      var hit = null;
      for (var i = 0; i < presets.length; i++) if (presets[i].id === sizeId) hit = presets[i];
      if (!hit) {
        hit = state.type === 'sample_label'
          ? { wMm: 60, hMm: 40 }
          : { wMm: 90, hMm: 50 };
      }
      paper = { wMm: hit.wMm, hMm: hit.hMm };
    }
    var name = (($('lc_c_name') && $('lc_c_name').value) || '').trim() ||
      (state.type === 'sample_label' ? '新样品标签模版' : '新合格证模版');
    var draft = LabelCertConfig.createBlankTemplate({
      type: state.type,
      name: name,
      paper: paper,
      enabled: false
    });
    openEditorWithDraft(draft, false);
  }

  /* ---------- 编辑器 ---------- */

  function openEditor(id) {
    var bucket = currentBucket();
    var tpl = LabelCertConfig.findTemplate(bucket, id);
    if (!tpl) return;
    var isDef = LabelCertConfig.isDefaultTemplate(bucket, tpl);
    openEditorWithDraft(LabelCertConfig.clone(tpl), isDef);
  }

  function openEditorWithDraft(draft, isDefault) {
    state.draft = draft;
    state.editingId = draft.id;
    state.editingIsDefault = !!isDefault;
    state.selectedId = null;
    state.propTab = 'layout';
    state.zoom = 1;
    resetHistory();
    if (isDefault) {
      draft.enabled = true;
      draft.bindSampleIds = [];
    }
    fillEditor();
    $('lc_editModal').classList.add('open');
    refreshAnnotations();
  }

  function closeEditor() {
    $('lc_editModal').classList.remove('open');
    state.draft = null;
    state.editingId = null;
    state.selectedId = null;
    state.drag = null;
    resetHistory();
  }

  /* ---------- 撤销 / 重做 ---------- */

  function resetHistory() {
    state.history = { past: [], future: [], coalesceKey: null, max: 40 };
    syncHistoryButtons();
  }

  function editorSnapshot() {
    if (!state.draft) return null;
    syncPaperFromDom();
    return {
      name: state.draft.name || '',
      paper: LabelCertConfig.clone(state.draft.paper),
      elements: LabelCertConfig.clone(state.draft.elements || []),
      meta: LabelCertConfig.clone(state.draft.meta || {}),
      bindSampleIds: LabelCertConfig.clone(state.draft.bindSampleIds || []),
      selectedId: state.selectedId,
      lastPaper: state.lastPaper ? { wMm: state.lastPaper.wMm, hMm: state.lastPaper.hMm } : null,
      propTab: state.propTab
    };
  }

  function applyEditorSnapshot(snap) {
    if (!state.draft || !snap) return;
    state.draft.name = snap.name || '';
    state.draft.paper = LabelCertConfig.clone(snap.paper);
    state.draft.elements = LabelCertConfig.clone(snap.elements || []);
    state.draft.meta = LabelCertConfig.clone(snap.meta || {});
    state.draft.bindSampleIds = LabelCertConfig.clone(snap.bindSampleIds || []);
    state.selectedId = snap.selectedId || null;
    state.lastPaper = snap.lastPaper ? { wMm: snap.lastPaper.wMm, hMm: snap.lastPaper.hMm } : {
      wMm: state.draft.paper.wMm,
      hMm: state.draft.paper.hMm
    };
    if (snap.propTab) state.propTab = snap.propTab;
    state.history.coalesceKey = null;
    fillEditor();
    syncHistoryButtons();
  }

  /** 在变更前调用；同一 coalesceKey 的连续操作只记一次（如拖动滑块） */
  function markHistory(coalesceKey) {
    if (!state.draft) return;
    if (coalesceKey && state.history.coalesceKey === coalesceKey) return;
    var snap = editorSnapshot();
    if (!snap) return;
    var json = JSON.stringify(snap);
    var last = state.history.past.length ? state.history.past[state.history.past.length - 1] : null;
    if (last === json) {
      state.history.coalesceKey = coalesceKey || null;
      return;
    }
    state.history.past.push(json);
    if (state.history.past.length > state.history.max) state.history.past.shift();
    state.history.future = [];
    state.history.coalesceKey = coalesceKey || null;
    syncHistoryButtons();
  }

  function endHistoryCoalesce() {
    state.history.coalesceKey = null;
  }

  function undoEditor() {
    if (!state.draft || !state.history.past.length) return;
    var current = editorSnapshot();
    if (!current) return;
    state.history.future.push(JSON.stringify(current));
    var prev = state.history.past.pop();
    applyEditorSnapshot(JSON.parse(prev));
  }

  function redoEditor() {
    if (!state.draft || !state.history.future.length) return;
    var current = editorSnapshot();
    if (!current) return;
    state.history.past.push(JSON.stringify(current));
    var next = state.history.future.pop();
    applyEditorSnapshot(JSON.parse(next));
  }

  function syncHistoryButtons() {
    var undoBtn = document.querySelector('[data-lc-undo]');
    var redoBtn = document.querySelector('[data-lc-redo]');
    if (undoBtn) {
      undoBtn.disabled = !(state.history.past && state.history.past.length);
      undoBtn.classList.toggle('disabled', undoBtn.disabled);
    }
    if (redoBtn) {
      redoBtn.disabled = !(state.history.future && state.history.future.length);
      redoBtn.classList.toggle('disabled', redoBtn.disabled);
    }
  }

  function selectedEl() {
    if (!state.draft || !state.selectedId) return null;
    var els = state.draft.elements || [];
    for (var i = 0; i < els.length; i++) if (els[i].id === state.selectedId) return els[i];
    return null;
  }

  function fillEditor() {
    var tpl = state.draft;
    if (!tpl) return;
    $('lc_editTitle').textContent = state.editingIsDefault
      ? '编辑默认模版'
      : (LabelCertConfig.findTemplate(currentBucket(), tpl.id) ? '编辑个性化模版' : '新增个性化模版');
    $('lc_e_name').value = tpl.name || '';
    $('lc_e_w').value = tpl.paper.wMm;
    $('lc_e_h').value = tpl.paper.hMm;
    state.lastPaper = { wMm: tpl.paper.wMm, hMm: tpl.paper.hMm };
    $('lc_e_borderOn').value = tpl.paper.border && tpl.paper.border.enabled ? '1' : '0';
    $('lc_e_borderColor').value = (tpl.paper.border && tpl.paper.border.color) || '#cbd5e1';
    syncBorderColorUi();
    $('lc_e_borderWidth').value = (tpl.paper.border && tpl.paper.border.widthPx) || 1;
    $('lc_e_mat').value = (tpl.meta && tpl.meta.material) || '';
    $('lc_e_mount').value = (tpl.meta && tpl.meta.mount) || '';
    $('lc_e_print').value = (tpl.meta && tpl.meta.printMethod) || '';
    $('lc_e_roleHint').textContent = state.editingIsDefault
      ? '默认模版：自由设计版式；不可删除 / 停用 / 绑定样品。修改纸张宽高时元素等比缩放。'
      : '个性化模版：保存并启用前须绑定 ≥1 个样品叶节点。修改纸张宽高时元素等比缩放。';
    var bindSec = $('lc_bindSection');
    if (bindSec) bindSec.classList.toggle('hidden', state.editingIsDefault);
    renderPaperSizeChips();
    renderPalette();
    renderCanvas();
    renderPropPanel();
    renderBind();
    refreshPreview();
    syncPropTabs();
  }

  function renderPaperSizeChips() {
    var host = $('lc_paperSizeChips');
    if (!host) return;
    var presets = LabelCertConfig.PAPER_SIZE_PRESETS || [];
    var curW = state.draft && state.draft.paper ? state.draft.paper.wMm : 0;
    var curH = state.draft && state.draft.paper ? state.draft.paper.hMm : 0;
    host.innerHTML = presets.map(function (p) {
      var on = Math.abs(p.wMm - curW) < 0.05 && Math.abs(p.hMm - curH) < 0.05;
      return '<button type="button" class="lc-mini-btn' + (on ? ' on' : '') + '" data-lc-paper-size="' + p.id + '" title="应用到纸张并等比缩放元素">' +
        LabelCertRender.esc(p.name) + ' ' + p.wMm + '×' + p.hMm + '</button>';
    }).join('');
  }

  function applyPaperSize(wMm, hMm, scaleElements) {
    if (!state.draft) return;
    wMm = Math.max(20, Math.min(200, Number(wMm)));
    hMm = Math.max(15, Math.min(200, Number(hMm)));
    if (!isFinite(wMm) || !isFinite(hMm)) return;
    var curW = state.lastPaper ? state.lastPaper.wMm : state.draft.paper.wMm;
    var curH = state.lastPaper ? state.lastPaper.hMm : state.draft.paper.hMm;
    if (Math.abs(curW - wMm) < 0.001 && Math.abs(curH - hMm) < 0.001) return;
    markHistory('paper-size');
    endHistoryCoalesce();
    var from = state.lastPaper || { wMm: state.draft.paper.wMm, hMm: state.draft.paper.hMm };
    if (scaleElements !== false && from.wMm > 0 && from.hMm > 0) {
      LabelCertConfig.scaleElementsToPaper(state.draft.elements, from, { wMm: wMm, hMm: hMm });
    }
    state.draft.paper.wMm = wMm;
    state.draft.paper.hMm = hMm;
    state.lastPaper = { wMm: wMm, hMm: hMm };
    $('lc_e_w').value = wMm;
    $('lc_e_h').value = hMm;
    renderPaperSizeChips();
    renderCanvas();
    renderPropPanel();
    refreshPreview();
  }

  function syncPaperFromDom() {
    if (!state.draft) return;
    state.draft.name = ($('lc_e_name').value || '').trim();
    if (!state.draft.paper.border) state.draft.paper.border = { enabled: true, color: '#cbd5e1', widthPx: 1 };
    state.draft.paper.border.enabled = $('lc_e_borderOn').value !== '0';
    state.draft.paper.border.color = $('lc_e_borderColor').value || '#cbd5e1';
    state.draft.paper.border.widthPx = parseInt($('lc_e_borderWidth').value, 10) || 1;
    state.draft.meta = {
      material: $('lc_e_mat').value || '',
      mount: $('lc_e_mount').value || '',
      printMethod: $('lc_e_print').value || ''
    };
    // 宽高由 applyPaperSize / 尺寸快捷管理，避免无缩放地覆盖
    if (state.lastPaper) {
      state.draft.paper.wMm = state.lastPaper.wMm;
      state.draft.paper.hMm = state.lastPaper.hMm;
    }
  }

  function syncPaperSizeFromInputs(scaleElements) {
    if (!state.draft) return;
    var w = parseFloat($('lc_e_w').value);
    var h = parseFloat($('lc_e_h').value);
    if (!(w >= 20 && w <= 200 && h >= 15 && h <= 200)) return;
    applyPaperSize(w, h, scaleElements !== false);
  }

  function findPaletteMatch(type, fieldId) {
    var els = (state.draft && state.draft.elements) || [];
    var hits = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.type !== type) continue;
      if (type === 'fieldRow' && fieldId && !(el.props && el.props.fieldId === fieldId)) continue;
      hits.push(el);
    }
    return hits;
  }

  function renderPalette() {
    var box = $('lc_palette');
    if (!box || !state.draft) return;
    var usedFields = LabelCertConfig.usedFieldIds(state.draft.elements);
    var pool = LabelCertConfig.poolForType(state.type);
    var types = LabelCertConfig.ELEMENT_TYPES;

    function typeBtn(type, extra, on, tip) {
      var meta = types[type];
      return '<button type="button" class="lc-pal-item' + (on ? ' on' : '') + '" data-lc-add="' + type + '"' +
        (extra || '') + ' title="' + LabelCertRender.esc(tip || (on ? '再次点击移除' : '点击添加到画布')) + '">' +
        LabelCertRender.esc(meta.name) + '</button>';
    }

    /** 可重复：左侧点击循环选中，右侧 + 新增 */
    function multiRow(type) {
      var meta = types[type];
      var n = findPaletteMatch(type).length;
      var on = n > 0;
      var selectedHere = on && findPaletteMatch(type).some(function (el) { return el.id === state.selectedId; });
      return '<div class="lc-pal-row">' +
        '<button type="button" class="lc-pal-item' + (on ? ' on' : '') + (selectedHere ? ' selected' : '') +
          '" data-lc-cycle="' + type + '" title="' +
          (on ? ('点击循环选中已添加的 ' + n + ' 个') : '尚未添加，请点右侧 +') + '">' +
          LabelCertRender.esc(meta.name) +
          (n > 0 ? '<span class="lc-pal-count">×' + n + '</span>' : '') +
        '</button>' +
        '<button type="button" class="lc-pal-add" data-lc-add="' + type + '" title="添加一个' +
          LabelCertRender.esc(meta.name) + '"><i class="fa fa-plus"></i></button>' +
        '</div>';
    }

    var brand = ['orgName', 'title', 'logo'].map(function (t) {
      var on = LabelCertConfig.hasElementType(state.draft.elements, t);
      return typeBtn(t, '', on, on ? '再次点击移除' : '');
    }).join('');

    var fields = pool.map(function (f) {
      var on = usedFields.indexOf(f.id) >= 0;
      return '<button type="button" class="lc-pal-item' + (on ? ' on' : '') + '" data-lc-add="fieldRow" data-field="' +
        f.id + '" title="' + (on ? '再次点击移除' : '点击添加到画布') + '">' +
        LabelCertRender.esc(f.label) + '</button>';
    }).join('');

    var code = ['qr', 'seal', 'watermarkText'].map(function (t) {
      if (t === 'seal' || t === 'watermarkText') return multiRow(t);
      var on = findPaletteMatch(t).length > 0;
      return typeBtn(t, '', on, on ? '再次点击移除' : '');
    }).join('');

    var decor = ['staticText', 'line', 'hangHole'].map(multiRow).join('');

    box.innerHTML =
      '<div class="lc-pal-group"><div class="lc-pal-title">品牌标识</div><div class="lc-pal-items">' + brand + '</div></div>' +
      '<div class="lc-pal-group"><div class="lc-pal-title">业务字段</div><div class="lc-pal-items">' + fields + '</div></div>' +
      '<div class="lc-pal-group"><div class="lc-pal-title">码与章</div><div class="lc-pal-items">' + code + '</div></div>' +
      '<div class="lc-pal-group"><div class="lc-pal-title">装饰辅助 <span class="font-normal text-slate-400">可重复 · 点名循环选中 / + 添加</span></div><div class="lc-pal-items">' + decor + '</div></div>';
  }

  function isRepeatableType(type) {
    return type === 'staticText' || type === 'line' || type === 'hangHole' ||
      type === 'seal' || type === 'watermarkText';
  }

  /** 在可重复类型中循环选中已有元素（元件库单击水印/章时使用） */
  function selectExistingOfType(type, fieldId) {
    var hits = findPaletteMatch(type, fieldId);
    if (!hits.length) return false;
    // 按叠放顺序从底到顶循环，便于先点到底层水印
    hits = hits.slice().sort(function (a, b) {
      return (a.zIndex - b.zIndex) || String(a.id).localeCompare(String(b.id));
    });
    var ids = hits.map(function (e) { return e.id; });
    var ix = ids.indexOf(state.selectedId);
    state.selectedId = ids[(ix + 1) % ids.length];
    state.propTab = 'layout';
    renderPalette();
    renderCanvas();
    renderPropPanel();
    syncPropTabs();
    return true;
  }

  /** 元件库：唯一类开关；可重复类型由 + 新增 / 名称循环选中 */
  function toggleElement(type, fieldId, opts) {
    opts = opts || {};
    if (!state.draft) return;
    if (isRepeatableType(type)) {
      // 右侧 + 或 forceAdd：始终新增
      if (opts.forceAdd) {
        addElement(type, fieldId);
        return;
      }
      // 兼容：无已有则添加，有则循环选中
      if (selectExistingOfType(type, fieldId)) return;
      addElement(type, fieldId);
      return;
    }
    var hits = findPaletteMatch(type, fieldId);
    if (hits.length) {
      var target = hits[hits.length - 1];
      markHistory();
      state.draft.elements = state.draft.elements.filter(function (e) { return e.id !== target.id; });
      if (state.selectedId === target.id) state.selectedId = null;
      renderPalette();
      renderCanvas();
      renderPropPanel();
      refreshPreview();
      return;
    }
    addElement(type, fieldId);
  }

  function addElement(type, fieldId) {
    if (!state.draft) return;
    var check = LabelCertConfig.canAddElement(state.draft.elements, type, fieldId);
    if (!check.ok) { alert(check.reason); return; }
    markHistory();
    var opts = { paper: state.draft.paper, tplType: state.type };
    if (type === 'fieldRow') {
      opts.fieldId = fieldId;
      opts.label = LabelCertConfig.fieldLabel(state.type, fieldId);
      opts.index = LabelCertConfig.usedFieldIds(state.draft.elements).length;
      opts.props = { fieldId: fieldId, label: opts.label };
    }
    var el = LabelCertConfig.createElement(type, opts);
    // 简单错位避免完全重叠
    var n = state.draft.elements.length;
    el.xMm = Math.min(el.xMm + (n % 3) * 1.5, Math.max(0, state.draft.paper.wMm - el.wMm));
    el.yMm = Math.min(el.yMm + (n % 4) * 1.2, Math.max(0, state.draft.paper.hMm - el.hMm));
    state.draft.elements.push(el);
    state.selectedId = el.id;
    renderPalette();
    renderCanvas();
    renderPropPanel();
    refreshPreview();
  }

  function deleteSelected() {
    if (!state.draft || !state.selectedId) return;
    var el = selectedEl();
    if (el && el.locked) { alert('元素已锁定，请先解锁'); return; }
    markHistory();
    state.draft.elements = state.draft.elements.filter(function (e) { return e.id !== state.selectedId; });
    state.selectedId = null;
    renderPalette();
    renderCanvas();
    renderPropPanel();
    refreshPreview();
  }

  function stagePixelSize() {
    var paper = state.draft && state.draft.paper;
    if (!paper) return { w: 0, h: 0 };
    var s = state.scale;
    return {
      w: Math.round(paper.wMm * s),
      h: Math.round(paper.hMm * s),
      s: s
    };
  }

  function applyStageZoom() {
    var stack = $('lc_stageStack');
    var pad = $('lc_zoomPad');
    var z = state.zoom || 1;
    var size = stagePixelSize();
    if (stack) stack.style.transform = z === 1 ? '' : ('scale(' + z + ')');
    if (pad && size.w && size.h) {
      pad.style.width = Math.round(size.w * z) + 'px';
      pad.style.height = Math.round(size.h * z) + 'px';
    }
    var label = $('lc_zoomVal');
    if (label) label.textContent = Math.round(z * 100) + '%';
  }

  function setZoom(next) {
    var z = Math.round(Number(next) * 100) / 100;
    if (!isFinite(z)) z = 1;
    state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    applyStageZoom();
  }

  function nudgeZoom(dir) {
    if (dir === 0) { setZoom(1); return; }
    setZoom((state.zoom || 1) + (dir > 0 ? ZOOM_STEP : -ZOOM_STEP));
  }

  function clearSelection() {
    if (!state.selectedId) return;
    state.selectedId = null;
    renderCanvas();
    renderPropPanel();
  }

  function renderCanvas() {
    var host = $('lc_canvas');
    if (!host || !state.draft) return;
    syncPaperFromDom();
    var paper = state.draft.paper;
    var size = stagePixelSize();
    var w = size.w;
    var h = size.h;
    var s = size.s;
    var border = paper.border || {};
    // 边框由底层实时预览绘制，覆盖层仅保留定位框
    var borderCss = border.enabled ? 'border:1px solid transparent;' : 'border:1px dashed transparent;';

    var stack = $('lc_stageStack');
    if (stack) {
      stack.style.width = w + 'px';
      stack.style.height = h + 'px';
    }
    applyStageZoom();

    var els = (state.draft.elements || []).slice().sort(function (a, b) {
      return (a.zIndex - b.zIndex) || String(a.id).localeCompare(String(b.id));
    });

    var html = '<div class="lc-canvas-paper" style="width:' + w + 'px;height:' + h + 'px;' + borderCss + '" data-lc-paper="1">';
    els.forEach(function (el) {
      var sel = el.id === state.selectedId ? ' selected' : '';
      var lock = el.locked ? ' locked' : '';
      var label = elementShortLabel(el);
      html += '<div class="lc-canvas-el' + sel + lock + '" data-el-id="' + el.id + '" style="' +
        'left:' + (el.xMm * s) + 'px;top:' + (el.yMm * s) + 'px;width:' + (el.wMm * s) +
        'px;height:' + (el.hMm * s) + 'px;z-index:' + (el.zIndex || 0) + ';' +
        (el.rotationDeg ? 'transform:rotate(' + el.rotationDeg + 'deg);' : '') +
        '">' +
        '<div class="lc-canvas-el-inner">' + LabelCertRender.esc(label) + '</div>' +
        (el.id === state.selectedId ? '<div class="lc-canvas-handle" data-resize="1"></div>' : '') +
        '</div>';
    });
    html += '</div>';
    host.innerHTML = html;
  }

  function elementShortLabel(el) {
    var meta = LabelCertConfig.ELEMENT_TYPES[el.type] || { name: el.type };
    if (el.type === 'fieldRow') return (el.props && el.props.label) || meta.name;
    if (el.type === 'orgName' || el.type === 'title' || el.type === 'staticText' || el.type === 'watermarkText') {
      var t = (el.props && el.props.text) || meta.name;
      return t.length > 10 ? t.slice(0, 10) + '…' : t;
    }
    return meta.name;
  }

  function syncPropTabs() {
    document.querySelectorAll('[data-lc-prop-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lc-prop-tab') === state.propTab);
    });
    var layout = $('lc_propLayout');
    var content = $('lc_propContent');
    if (layout) layout.classList.toggle('hidden', state.propTab !== 'layout');
    if (content) content.classList.toggle('hidden', state.propTab !== 'content');
  }

  function renderPropPanel() {
    var el = selectedEl();
    var empty = $('lc_propEmpty');
    var layout = $('lc_propLayout');
    var content = $('lc_propContent');
    if (!el) {
      if (empty) empty.classList.remove('hidden');
      if (layout) layout.innerHTML = '';
      if (content) content.innerHTML = '';
      return;
    }
    if (empty) empty.classList.add('hidden');

    if (layout) {
      var rank = stackRank(el);
      layout.innerHTML =
        '<div class="lc-prop-grid">' +
          numField('X(mm)', 'xMm', el.xMm) + numField('Y(mm)', 'yMm', el.yMm) +
          numField('宽(mm)', 'wMm', el.wMm) + numField('高(mm)', 'hMm', el.hMm) +
          numField('层级', 'zIndex', el.zIndex) +
          numField('旋转°', 'rotationDeg', el.rotationDeg || 0) +
        '</div>' +
        '<p class="text-[10px] text-slate-400 mb-2 leading-relaxed">叠放顺序：数字越大越靠上。当前约第 ' +
          rank.index + ' / 共 ' + rank.total + '。被挡住时可用 Alt+点击切换，或点「选中下层」。</p>' +
        '<div class="lc-prop-actions">' +
          '<label class="text-xs text-slate-600 flex items-center gap-1"><input type="checkbox" data-lc-prop="locked"' +
            (el.locked ? ' checked' : '') + ' /> 锁定</label>' +
          '<button type="button" class="lc-mini-btn" data-lc-select-below title="选中当前元素正下方被挡住的元素">选中下层</button>' +
          '<button type="button" class="lc-mini-btn" data-lc-layer="up">上移一层</button>' +
          '<button type="button" class="lc-mini-btn" data-lc-layer="down">下移一层</button>' +
          '<button type="button" class="lc-mini-btn" data-lc-layer="bottom">置于底层</button>' +
          '<button type="button" class="lc-mini-btn" data-lc-layer="top">置于顶层</button>' +
          '<button type="button" class="lc-mini-btn danger" data-lc-del-el>删除元素</button>' +
        '</div>';
    }

    if (content) content.innerHTML = contentFieldsHtml(el);
  }

  function numField(label, key, val) {
    return '<label class="text-xs text-slate-600">' + label +
      '<input type="number" step="0.1" class="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" data-lc-geom="' +
      key + '" value="' + val + '" /></label>';
  }

  function contentFieldsHtml(el) {
    var p = el.props || {};
    var html = '';
    if (el.type === 'fieldRow') {
      html +=
        '<label class="text-xs text-slate-600 block mb-2">显示名<input data-lc-c="label" class="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" value="' +
        LabelCertRender.esc(p.label || '') + '" /></label>' +
        '<label class="text-xs text-slate-600 flex items-center gap-1 mb-2"><input type="checkbox" data-lc-c="showLabel"' +
        (p.showLabel !== false ? ' checked' : '') + ' /> 显示标签</label>' +
        selectField('值对齐', 'valueAlign', p.valueAlign || 'left', [['left', '居左'], ['center', '居中'], ['right', '居右']]) +
        selectField('下划线', 'underline', p.underline || 'dotted', [['none', '无'], ['solid', '直线'], ['dotted', '断点'], ['dashed', '断线']]) +
        numContent('字号', 'fontSize', p.fontSize || 11) +
        fontFamilyField(p.fontFamily) +
        colorField('颜色', 'color', p.color || '#1e293b') +
        '<p class="text-xs text-slate-400 mt-2">绑定字段：' + LabelCertRender.esc(p.fieldId) + '（不可改；删除后可重新添加）</p>';
    } else if (el.type === 'orgName' || el.type === 'title' || el.type === 'staticText' || el.type === 'watermarkText') {
      html +=
        '<label class="text-xs text-slate-600 block mb-2">文案<textarea data-lc-c="text" rows="2" class="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">' +
        LabelCertRender.esc(p.text || '') + '</textarea></label>';
      if (el.type === 'watermarkText') {
        html += opacityField(Math.round((p.opacity != null ? p.opacity : 0.18) * 100),
          '拖动调整水印浓淡（0%–100%，可设为 100%）');
      } else if (el.type === 'staticText') {
        html += opacityField(Math.round((p.opacity != null ? p.opacity : 1) * 100),
          '拖动调整文本浓淡（0%–100%；静态文本不支持平铺）');
      }
      html +=
        numContent('字号', 'fontSize', p.fontSize || 11) +
        fontFamilyField(p.fontFamily) +
        colorField('颜色', 'color', p.color || '#1e293b') +
        selectField('对齐', 'align', p.align || 'center', [['left', '居左'], ['center', '居中'], ['right', '居右']]);
      if (el.type === 'watermarkText') {
        html += '<label class="text-xs text-slate-600 flex items-center gap-1 mb-2"><input type="checkbox" data-lc-c="tile"' +
          (p.tile ? ' checked' : '') + ' /> 平铺（仅水印）</label>';
      }
    } else if (el.type === 'logo') {
      var src = p.source || 'system';
      html += selectField('来源', 'source', src, [
        ['system', '系统 Logo'],
        ['custom', '上传自定义'],
        ['hidden', '隐藏']
      ]);
      if (src === 'system') {
        html += '<p class="text-xs text-slate-400 mb-1">使用系统默认 Logo</p>' +
          '<img class="lc-logo-thumb" src="' + LabelCertRender.esc(LabelCertConfig.SYSTEM_LOGO_URL) + '" alt="system logo" />';
      } else if (src === 'custom') {
        html += '<label class="text-xs text-slate-600 block mb-2">上传 Logo 图片' +
          '<input type="file" accept="image/*" data-lc-logo-file class="mt-1 block w-full text-xs text-slate-500" />' +
          '</label>';
        if (p.url) {
          html += '<img class="lc-logo-thumb" src="' + LabelCertRender.esc(p.url) + '" alt="custom logo" />' +
            '<button type="button" class="lc-mini-btn mt-1" data-lc-logo-clear>清除上传</button>';
        } else {
          html += '<p class="text-xs text-amber-600">请上传图片后才会显示在预览中</p>';
        }
      } else {
        html += '<p class="text-xs text-slate-400">Logo 不显示</p>';
      }
    } else if (el.type === 'seal') {
      html += selectField('来源', 'source', p.source || 'system', [['system', '系统检测章'], ['custom', '自定义（需 url）']]) +
        opacityField(Math.round((p.opacity != null ? p.opacity : 0.42) * 100),
          '拖动调整检测章浓淡（0%–100%）');
    } else if (el.type === 'qr') {
      html += '<p class="text-xs text-slate-500 mb-2">载荷类型（只读）：<b>' +
        (p.payloadType === 'sample_flow' ? '样品流转' : '合格证短链') + '</b></p>' +
        '<p class="text-xs text-slate-400">尺寸由布局宽高决定。</p>';
    } else if (el.type === 'line') {
      html += colorField('颜色', 'color', p.color || '#cbd5e1') +
        numContent('粗细(px)', 'widthPx', p.widthPx || 1) +
        selectField('线型', 'style', p.style || 'solid', [['solid', '实线'], ['dashed', '虚线'], ['dotted', '点线']]);
    } else if (el.type === 'hangHole') {
      html += '<p class="text-xs text-slate-400">悬挂孔仅几何示意，无业务内容。</p>';
    }
    return html || '<p class="text-xs text-slate-400">无可编辑内容</p>';
  }

  function selectField(label, key, val, options) {
    return '<label class="text-xs text-slate-600 block mb-2">' + label +
      '<select data-lc-c="' + key + '" class="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">' +
      options.map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>';
  }

  function numContent(label, key, val) {
    return '<label class="text-xs text-slate-600 block mb-2">' + label +
      '<input type="number" data-lc-c="' + key + '" class="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm" value="' +
      val + '" /></label>';
  }

  function opacityField(pct, hint) {
    pct = Math.round(Math.max(0, Math.min(100, Number(pct) || 0)));
    return '<div class="lc-opacity-field mb-2">' +
      '<div class="lc-opacity-head">' +
        '<span>透明度</span>' +
        '<span data-lc-opacity-label>' + pct + '%</span>' +
      '</div>' +
      '<input type="range" min="0" max="100" step="1" data-lc-c="opacity" class="lc-opacity-range" value="' + pct + '" />' +
      '<p class="lc-opacity-hint">' + (hint || '拖动调整浓淡（0%–100%，100% 为完全不透明）') + '</p>' +
      '</div>';
  }

  function fontFamilyField(val) {
    var presets = LabelCertConfig.FONT_PRESETS || [];
    var cur = LabelCertConfig.normalizeFontFamily(val);
    return selectField('字体', 'fontFamily', cur, presets.map(function (f) {
      return [f.id, f.name];
    }));
  }

  function syncOpacityLabel() {
    var el = selectedEl();
    var lab = document.querySelector('#lc_propContent [data-lc-opacity-label]');
    var range = document.querySelector('#lc_propContent [data-lc-c="opacity"]');
    if (!el || !el.props || el.props.opacity == null) return;
    var pct = Math.round(el.props.opacity * 100);
    if (lab) lab.textContent = pct + '%';
    if (range && String(range.value) !== String(pct)) range.value = String(pct);
  }

  function hexToRgb(hex) {
    var m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || '').trim());
    if (!m) return { r: 30, g: 41, b: 59 };
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHex(r, g, b) {
    function h(x) {
      var s = Math.max(0, Math.min(255, Math.round(Number(x) || 0))).toString(16);
      return s.length === 1 ? '0' + s : s;
    }
    return '#' + h(r) + h(g) + h(b);
  }

  function parseColorText(str) {
    str = String(str || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(str)) return str.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(str)) {
      return ('#' + str[1] + str[1] + str[2] + str[2] + str[3] + str[3]).toLowerCase();
    }
    var m = str.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i) ||
      str.match(/^(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*$/);
    if (m) return rgbToHex(m[1], m[2], m[3]);
    return null;
  }

  function rgbTextFromHex(hex) {
    var rgb = hexToRgb(hex);
    return rgb.r + ', ' + rgb.g + ', ' + rgb.b;
  }

  function stackRank(el) {
    var sorted = ((state.draft && state.draft.elements) || []).slice().sort(function (a, b) {
      return (a.zIndex - b.zIndex) || String(a.id).localeCompare(String(b.id));
    });
    var idx = 0;
    for (var i = 0; i < sorted.length; i++) if (sorted[i].id === el.id) idx = i + 1;
    return { index: idx || 1, total: sorted.length || 1 };
  }

  function colorField(label, key, val) {
    var hex = parseColorText(val) || '#1e293b';
    return '<div class="lc-color-field mb-2">' +
      '<div class="text-xs text-slate-600 mb-0.5">' + label + '</div>' +
      '<div class="lc-color-row">' +
        '<input type="color" data-lc-c="' + key + '" value="' + hex + '" title="取色" />' +
        '<input type="text" data-lc-rgb="' + key + '" class="lc-rgb-input" value="' + rgbTextFromHex(hex) +
          '" placeholder="R, G, B 或 #hex" title="支持 44,221,74 / rgb(44,221,74) / #2cdd4a" />' +
        '<button type="button" class="lc-icon-btn" data-lc-rgb-copy="' + key + '" title="复制 RGB" aria-label="复制 RGB"><i class="fa fa-files-o"></i></button>' +
        '<button type="button" class="lc-icon-btn" data-lc-rgb-paste="' + key + '" title="从剪贴板粘贴" aria-label="粘贴 RGB"><i class="fa fa-clipboard"></i></button>' +
      '</div></div>';
  }

  function flashIconBtn(btn, okIcon) {
    if (!btn) return;
    var prev = btn.getAttribute('data-icon-html') || btn.innerHTML;
    btn.setAttribute('data-icon-html', prev);
    btn.classList.add('ok');
    btn.innerHTML = '<i class="fa ' + (okIcon || 'fa-check') + '"></i>';
    setTimeout(function () {
      btn.classList.remove('ok');
      btn.innerHTML = btn.getAttribute('data-icon-html') || prev;
    }, 900);
  }

  function syncColorPair(root, key, hex) {
    root = root || document;
    var colorInput = root.querySelector('[data-lc-c="' + key + '"]');
    var rgbInput = root.querySelector('[data-lc-rgb="' + key + '"]');
    if (colorInput) colorInput.value = hex;
    if (rgbInput) rgbInput.value = rgbTextFromHex(hex);
  }

  function applyColorKey(key, hex) {
    var el = selectedEl();
    if (!el) return;
    if (!el.props) el.props = {};
    if (el.props[key] === hex) return;
    markHistory('content-color:' + el.id + ':' + key);
    el.props[key] = hex;
    syncColorPair($('lc_propContent'), key, hex);
    renderCanvas();
    refreshPreview();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  function readClipboardText() {
    if (navigator.clipboard && navigator.clipboard.readText) return navigator.clipboard.readText();
    return Promise.reject(new Error('clipboard unavailable'));
  }

  function syncBorderColorUi() {
    var hex = ($('lc_e_borderColor') && $('lc_e_borderColor').value) || '#cbd5e1';
    var rgb = $('lc_e_borderRgb');
    if (rgb) rgb.value = rgbTextFromHex(hex);
  }

  function applyGeomFromInputs() {
    var el = selectedEl();
    if (!el) return;
    markHistory('geom:' + el.id);
    document.querySelectorAll('#lc_propLayout [data-lc-geom]').forEach(function (input) {
      var key = input.getAttribute('data-lc-geom');
      var v = parseFloat(input.value);
      if (isNaN(v)) return;
      el[key] = v;
    });
    clampElToPaper(el);
  }

  function clampElToPaper(el) {
    var paper = state.draft.paper;
    el.wMm = Math.max(0.5, Math.min(el.wMm, paper.wMm));
    el.hMm = Math.max(0.5, Math.min(el.hMm, paper.hMm));
    el.xMm = Math.max(0, Math.min(el.xMm, paper.wMm - el.wMm));
    el.yMm = Math.max(0, Math.min(el.yMm, paper.hMm - el.hMm));
  }

  function applyContentFromInputs() {
    var el = selectedEl();
    if (!el) return;
    if (!el.props) el.props = {};
    markHistory('content:' + el.id);
    document.querySelectorAll('#lc_propContent [data-lc-c]').forEach(function (input) {
      var key = input.getAttribute('data-lc-c');
      if (input.type === 'checkbox') {
        el.props[key] = input.checked;
        return;
      }
      if (key === 'opacity') {
        var pct = parseFloat(input.value);
        if (!isNaN(pct)) el.props.opacity = Math.max(0, Math.min(1, pct / 100));
        return;
      }
      if (key === 'fontSize' || key === 'widthPx') {
        el.props[key] = parseFloat(input.value) || el.props[key];
        return;
      }
      if (input.type === 'color') {
        el.props[key] = input.value;
        syncColorPair($('lc_propContent'), key, input.value);
        return;
      }
      el.props[key] = input.value;
    });
  }

  function readFileAsDataUrl(file, done) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { done(String(reader.result || '')); };
    reader.onerror = function () { alert('读取图片失败'); };
    reader.readAsDataURL(file);
  }

  function demoData() {
    return {
      sampleNo: 'YP-2026-001',
      specimenNo: 'YP-2026-001',
      name: '绝缘操作杆',
      sampleName: '绝缘操作杆',
      specModel: '10m',
      inspectors: ['张三', '李四'],
      inspectDate: '2026-07-01',
      reinspectDate: '2027-07-01',
      validUntil: '2027-07-01',
      receiveDate: '2026-06-20',
      clientName: '某某供电公司',
      detectStatus: '已检测',
      entrustNo: 'WT-2026-088'
    };
  }

  function refreshPreview() {
    if (!state.draft) return;
    syncPaperFromDom();
    var box = $('lc_previewBox');
    if (!box) return;
    LabelCertRender.ensureStyles();
    var size = stagePixelSize();
    box.innerHTML = LabelCertRender.renderSheet(state.draft, demoData(), { suffix: '-pv' });
    var sheet = box.querySelector('.lc-sheet');
    if (sheet && size.w && size.h) {
      sheet.style.width = size.w + 'px';
      sheet.style.height = size.h + 'px';
    }
    LabelCertRender.mountQrs(box, [demoData()]);
  }

  function renderBind() {
    var host = $('lc_bindSamples');
    if (!host || state.editingIsDefault) return;
    var tree = LabelCertConfig.SAMPLE_TREE[state.cat] || [];
    var selected = state.draft.bindSampleIds || [];
    var kw = (state.bindKw || '').trim();

    function checked(id) { return selected.indexOf(id) >= 0; }

    var html = '<div class="lc-ms' + (state.bindOpen ? ' open' : '') + '">' +
      '<button type="button" class="lc-ms-trigger" data-lc-bind-toggle>' +
        '<span>' + (selected.length ? ('已选 ' + selected.length + ' 项') : '<span class="ph">请选择样品叶节点</span>') + '</span>' +
        '<i class="fa fa-angle-down"></i></button>' +
      '<div class="lc-ms-panel">' +
        '<input class="lc-ms-search" placeholder="搜索样品" value="' + LabelCertRender.esc(state.bindKw) + '" data-lc-bind-kw />' +
        '<div class="lc-ms-list">';

    var any = false;
    tree.forEach(function (group) {
      var leaves = (group.children || []).filter(function (leaf) {
        if (!kw) return true;
        return (leaf.name + group.name).indexOf(kw) >= 0;
      });
      if (!leaves.length) return;
      any = true;
      html += '<div class="lc-ms-group">' + LabelCertRender.esc(group.name) + '</div>';
      leaves.forEach(function (leaf) {
        html += '<label class="lc-ms-item indent"><input type="checkbox" data-lc-bind="' + leaf.id + '"' +
          (checked(leaf.id) ? ' checked' : '') + ' /> ' + LabelCertRender.esc(leaf.name) + '</label>';
      });
    });
    if (!any) html += '<div class="lc-ms-empty">无匹配样品</div>';
    html += '</div><div class="lc-ms-foot"><span>叶节点多选</span><button type="button" class="text-blue-600" data-lc-bind-toggle>收起</button></div></div></div>';
    host.innerHTML = html;
    var hint = $('lc_bindHint');
    if (hint) {
      hint.textContent = selected.length ? '' : '请至少选择一个样品';
    }
  }

  function saveEditor() {
    if (!state.draft) return;
    syncPaperFromDom();
    applyGeomFromInputs();
    applyContentFromInputs();
    state.draft.elements = LabelCertConfig.enforceUniqueness(
      (state.draft.elements || []).map(function (el) {
        return LabelCertConfig.normalizeElement(el, state.type);
      }).filter(Boolean)
    );
    state.draft.updatedAt = LabelCertConfig.formatNow();
    if (state.editingIsDefault) {
      state.draft.enabled = true;
      state.draft.bindSampleIds = [];
    }

    var errors = LabelCertConfig.validateTemplate(state.draft, {
      type: state.type,
      requireBind: !state.editingIsDefault
    });
    if (errors.length) {
      alert(errors.join('\n'));
      return;
    }

    if (!state.editingIsDefault) {
      var conflicts = LabelCertConfig.findBindConflicts(
        state.cat, state.type, state.draft.id, state.draft.bindSampleIds || []
      );
      if (conflicts.length) {
        alert('样品绑定冲突：\n' + conflicts.map(function (c) {
          return sampleName(c.sampleId) + ' → ' + c.templateName;
        }).join('\n'));
        return;
      }
    }

    var bucket = currentBucket();
    var idx = -1;
    for (var i = 0; i < bucket.templates.length; i++) {
      if (bucket.templates[i].id === state.draft.id) { idx = i; break; }
    }
    // 新建个性化：绑定样品后默认启用
    if (!state.editingIsDefault && idx < 0 && (state.draft.bindSampleIds || []).length) {
      state.draft.enabled = true;
    }
    var saved = LabelCertConfig.clone(state.draft);
    if (idx >= 0) bucket.templates[idx] = saved;
    else bucket.templates.push(saved);

    if (state.editingIsDefault) {
      bucket.defaultTemplateId = saved.id;
      saved.enabled = true;
      saved.bindSampleIds = [];
    }

    LabelCertConfig.ensureBucketShape(bucket, state.type);
    LabelCertConfig.save(cfg);
    closeEditor();
    renderList();
  }

  function openPreview(id) {
    var bucket = currentBucket();
    var tpl = LabelCertConfig.findTemplate(bucket, id);
    if (!tpl) return;
    state.previewId = id;
    $('lc_pvTitle').textContent = tpl.name;
    $('lc_pvSub').textContent = tpl.paper.wMm + '×' + tpl.paper.hMm + ' mm · ' + elCount(tpl) + ' 个元素';
    LabelCertRender.ensureStyles();
    var box = $('lc_pvBox');
    box.innerHTML = LabelCertRender.renderSheet(tpl, demoData(), { suffix: '-ro' });
    LabelCertRender.mountQrs(box, [demoData()]);
    $('lc_previewModal').classList.add('open');
    refreshAnnotations();
  }

  function closePreview() {
    $('lc_previewModal').classList.remove('open');
    state.previewId = null;
  }

  /* ---------- 事件 ---------- */

  /** 按画布坐标命中所有元素，zIndex 从高到低 */
  function hitElementsAtClient(clientX, clientY) {
    var stack = $('lc_stageStack');
    if (!stack || !state.draft) return [];
    var rect = stack.getBoundingClientRect();
    var unit = state.scale * (state.zoom || 1);
    if (!(unit > 0)) return [];
    var xMm = (clientX - rect.left) / unit;
    var yMm = (clientY - rect.top) / unit;
    var hits = (state.draft.elements || []).filter(function (el) {
      return xMm >= el.xMm && yMm >= el.yMm &&
        xMm <= el.xMm + el.wMm && yMm <= el.yMm + el.hMm;
    }).slice().sort(function (a, b) {
      return (b.zIndex - a.zIndex) || String(b.id).localeCompare(String(a.id));
    });
    return hits;
  }

  function selectElementById(id, opts) {
    opts = opts || {};
    state.selectedId = id || null;
    if (opts.propTab) state.propTab = opts.propTab;
    renderCanvas();
    renderPropPanel();
    syncPropTabs();
  }

  /** 在重叠命中中切换到下一层（用于 Alt+点击 / 选中下层） */
  function cycleHitSelection(hits, fromId) {
    if (!hits || !hits.length) return null;
    var ids = hits.map(function (e) { return e.id; });
    var ix = fromId ? ids.indexOf(fromId) : -1;
    return ids[(ix + 1) % ids.length];
  }

  function selectBelowCurrent() {
    var el = selectedEl();
    if (!el || !state.draft) return;
    var cx = el.xMm + el.wMm / 2;
    var cy = el.yMm + el.hMm / 2;
    var hits = (state.draft.elements || []).filter(function (e) {
      return cx >= e.xMm && cy >= e.yMm &&
        cx <= e.xMm + e.wMm && cy <= e.yMm + e.hMm;
    }).slice().sort(function (a, b) {
      return (b.zIndex - a.zIndex) || String(b.id).localeCompare(String(a.id));
    });
    var next = cycleHitSelection(hits, state.selectedId);
    if (next && next !== state.selectedId) selectElementById(next);
  }

  function onCanvasPointerDown(e) {
    var handle = e.target.closest('[data-resize]');
    var node = e.target.closest('[data-el-id]');
    var paper = e.target.closest('[data-lc-paper]');
    var hits = hitElementsAtClient(e.clientX, e.clientY);

    // Alt+点击：在重叠元素中穿透切换（解决底层水印点不到）
    if (e.altKey && hits.length) {
      var nextId = cycleHitSelection(hits, state.selectedId);
      selectElementById(nextId);
      e.preventDefault();
      return;
    }

    if (node || hits.length) {
      var id = node ? node.getAttribute('data-el-id') : hits[0].id;
      // 若 DOM 命中与几何顶层不一致，以几何顶层为准（旋转等近似）
      if (hits.length && hits[0].id !== id && !handle) id = hits[0].id;
      state.selectedId = id;
      var el = selectedEl();
      if (!el) return;
      renderCanvas();
      renderPropPanel();
      if (el.locked && !handle) return;
      state.drag = {
        id: id,
        mode: handle ? 'resize' : 'move',
        startX: e.clientX,
        startY: e.clientY,
        origX: el.xMm,
        origY: el.yMm,
        origW: el.wMm,
        origH: el.hMm,
        historyMarked: false
      };
      e.preventDefault();
      return;
    }
    if (paper) clearSelection();
  }

  function onCanvasPointerMove(e) {
    if (!state.drag || !state.draft) return;
    var el = null;
    for (var i = 0; i < state.draft.elements.length; i++) {
      if (state.draft.elements[i].id === state.drag.id) el = state.draft.elements[i];
    }
    if (!el || el.locked) return;
    var unit = state.scale * (state.zoom || 1);
    var dx = (e.clientX - state.drag.startX) / unit;
    var dy = (e.clientY - state.drag.startY) / unit;
    if (!state.drag.historyMarked && (Math.abs(dx) > 0.02 || Math.abs(dy) > 0.02)) {
      markHistory('drag:' + state.drag.id);
      state.drag.historyMarked = true;
    }
    if (state.drag.mode === 'move') {
      el.xMm = state.drag.origX + dx;
      el.yMm = state.drag.origY + dy;
    } else {
      el.wMm = state.drag.origW + dx;
      el.hMm = state.drag.origH + dy;
    }
    clampElToPaper(el);
    renderCanvas();
  }

  function onCanvasPointerUp() {
    if (!state.drag) return;
    if (state.drag.historyMarked) endHistoryCoalesce();
    state.drag = null;
    renderPropPanel();
    refreshPreview();
  }

  function bindEvents() {
    var root = $('labelCertView');
    if (!root || root._lcBound) return;
    root._lcBound = true;

    root.addEventListener('click', function (e) {
      var typeNav = e.target.closest('.lc-type-nav');
      if (typeNav) {
        state.type = typeNav.getAttribute('data-type');
        renderList();
        return;
      }
      if (e.target.closest('[data-lc-new]')) {
        openCreateChooser();
        return;
      }
      var act = e.target.closest('[data-lc-act]');
      if (act) {
        var id = act.getAttribute('data-id');
        var a = act.getAttribute('data-lc-act');
        if (a === 'edit') openEditor(id);
        else if (a === 'preview') openPreview(id);
        else if (a === 'del') removeTpl(id);
        return;
      }
      if (e.target.closest('[data-lc-close]')) { closeEditor(); return; }
      if (e.target.closest('[data-lc-save]')) { saveEditor(); return; }
      if (e.target.closest('[data-lc-refresh]')) { refreshPreview(); return; }
      if (e.target.closest('[data-lc-undo]')) { undoEditor(); return; }
      if (e.target.closest('[data-lc-redo]')) { redoEditor(); return; }
      var zoomBtn = e.target.closest('[data-lc-zoom]');
      if (zoomBtn) {
        nudgeZoom(parseInt(zoomBtn.getAttribute('data-lc-zoom'), 10) || 0);
        return;
      }
      if (e.target.closest('[data-lc-pv-close]')) { closePreview(); return; }
      if (e.target.closest('[data-lc-pv-edit]')) {
        var pid = state.previewId;
        closePreview();
        if (pid) openEditor(pid);
        return;
      }

      // create modal
      var modeBtn = e.target.closest('[data-lc-create-mode]');
      if (modeBtn) { setCreateMode(modeBtn.getAttribute('data-lc-create-mode')); return; }
      if (e.target.closest('[data-lc-create-close]')) { closeCreateChooser(); return; }
      if (e.target.closest('#lc_c_confirm')) { confirmCreate(); return; }

      var paperSizeBtn = e.target.closest('[data-lc-paper-size]');
      if (paperSizeBtn) {
        var pid = paperSizeBtn.getAttribute('data-lc-paper-size');
        var presets = LabelCertConfig.PAPER_SIZE_PRESETS || [];
        var hit = null;
        for (var pi = 0; pi < presets.length; pi++) if (presets[pi].id === pid) hit = presets[pi];
        if (hit) applyPaperSize(hit.wMm, hit.hMm, true);
        return;
      }

      var cycleBtn = e.target.closest('[data-lc-cycle]');
      if (cycleBtn) {
        var ctype = cycleBtn.getAttribute('data-lc-cycle');
        if (!selectExistingOfType(ctype)) {
          // 尚未添加时，点击名称也先添加一枚
          addElement(ctype);
        }
        return;
      }
      var addBtn = e.target.closest('[data-lc-add]');
      if (addBtn) {
        toggleElement(
          addBtn.getAttribute('data-lc-add'),
          addBtn.getAttribute('data-field'),
          { forceAdd: isRepeatableType(addBtn.getAttribute('data-lc-add')) || !!e.shiftKey }
        );
        return;
      }
      if (e.target.closest('[data-lc-select-below]')) {
        selectBelowCurrent();
        return;
      }

      var tab = e.target.closest('[data-lc-prop-tab]');
      if (tab) {
        state.propTab = tab.getAttribute('data-lc-prop-tab');
        syncPropTabs();
        return;
      }

      var rgbCopy = e.target.closest('[data-lc-rgb-copy]');
      if (rgbCopy) {
        var cKey = rgbCopy.getAttribute('data-lc-rgb-copy');
        var rgbEl = document.querySelector('#lc_propContent [data-lc-rgb="' + cKey + '"]');
        var text = rgbEl ? rgbEl.value : '';
        copyText(text).then(function () {
          flashIconBtn(rgbCopy);
        }).catch(function () { alert('复制失败，请手动选中复制'); });
        return;
      }
      var rgbPaste = e.target.closest('[data-lc-rgb-paste]');
      if (rgbPaste) {
        var pKey = rgbPaste.getAttribute('data-lc-rgb-paste');
        readClipboardText().then(function (txt) {
          var hex = parseColorText(txt);
          if (!hex) { alert('无法识别颜色，请粘贴如 44,221,74 或 #2cdd4a'); return; }
          applyColorKey(pKey, hex);
          flashIconBtn(rgbPaste, 'fa-check');
        }).catch(function () {
          var manual = window.prompt('粘贴 RGB 或十六进制颜色', '');
          var hex2 = parseColorText(manual);
          if (!hex2) { alert('无法识别颜色'); return; }
          applyColorKey(pKey, hex2);
        });
        return;
      }
      var borderCopyBtn = e.target.closest('[data-lc-border-rgb-copy]');
      if (borderCopyBtn) {
        var bRgb = $('lc_e_borderRgb');
        copyText(bRgb ? bRgb.value : '').then(function () {
          flashIconBtn(borderCopyBtn);
        }).catch(function () { alert('复制失败'); });
        return;
      }
      if (e.target.closest('[data-lc-border-rgb-paste]')) {
        readClipboardText().then(function (txt) {
          var hex = parseColorText(txt);
          if (!hex) { alert('无法识别颜色'); return; }
          markHistory('border-color');
          endHistoryCoalesce();
          $('lc_e_borderColor').value = hex;
          syncBorderColorUi();
          syncPaperFromDom();
          renderCanvas();
          refreshPreview();
        }).catch(function () {
          var manual = window.prompt('粘贴 RGB 或十六进制颜色', '');
          var hex2 = parseColorText(manual);
          if (!hex2) return;
          markHistory('border-color');
          endHistoryCoalesce();
          $('lc_e_borderColor').value = hex2;
          syncBorderColorUi();
          syncPaperFromDom();
          renderCanvas();
          refreshPreview();
        });
        return;
      }
      if (e.target.closest('[data-lc-logo-clear]')) {
        var logoEl = selectedEl();
        if (logoEl && logoEl.type === 'logo') {
          markHistory();
          logoEl.props = logoEl.props || {};
          logoEl.props.url = null;
          renderPropPanel();
          renderCanvas();
          refreshPreview();
        }
        return;
      }

      var layer = e.target.closest('[data-lc-layer]');
      if (layer && state.selectedId) {
        markHistory();
        LabelCertConfig.bringToLayer(state.draft.elements, state.selectedId, layer.getAttribute('data-lc-layer'));
        renderCanvas();
        renderPropPanel();
        refreshPreview();
        return;
      }
      if (e.target.closest('[data-lc-del-el]')) { deleteSelected(); return; }

      if (e.target.closest('[data-lc-bind-toggle]')) {
        state.bindOpen = !state.bindOpen;
        renderBind();
        return;
      }
    });

    root.addEventListener('change', function (e) {
      var en = e.target.getAttribute('data-lc-enable');
      if (en) { setEnabled(en, e.target.checked); return; }
      if (e.target.getAttribute('data-lc-bind')) {
        var sid = e.target.getAttribute('data-lc-bind');
        markHistory('bind');
        endHistoryCoalesce();
        var list = state.draft.bindSampleIds || (state.draft.bindSampleIds = []);
        var ix = list.indexOf(sid);
        if (e.target.checked && ix < 0) list.push(sid);
        if (!e.target.checked && ix >= 0) list.splice(ix, 1);
        renderBind();
        return;
      }
      if (e.target.getAttribute('data-lc-prop') === 'locked') {
        var el = selectedEl();
        if (el) {
          markHistory();
          el.locked = e.target.checked;
          renderCanvas();
        }
        return;
      }
      if (e.target.getAttribute('data-lc-logo-file') != null) {
        var file = e.target.files && e.target.files[0];
        var logoTarget = selectedEl();
        if (!file || !logoTarget || logoTarget.type !== 'logo') return;
        readFileAsDataUrl(file, function (url) {
          markHistory();
          logoTarget.props = logoTarget.props || {};
          logoTarget.props.source = 'custom';
          logoTarget.props.url = url;
          renderPropPanel();
          renderCanvas();
          refreshPreview();
        });
        return;
      }
      if (e.target.closest('#lc_propContent') && e.target.getAttribute('data-lc-c')) {
        applyContentFromInputs();
        endHistoryCoalesce();
        // 切换 Logo 来源时刷新内容区（显示/隐藏上传）
        if (e.target.getAttribute('data-lc-c') === 'source') renderPropPanel();
        if (e.target.getAttribute('data-lc-c') === 'opacity') syncOpacityLabel();
        renderCanvas();
        refreshPreview();
        return;
      }
      if (e.target.id === 'lc_c_size') {
        var custom = e.target.value === 'custom';
        var wrap = $('lc_c_customSize');
        if (wrap) wrap.classList.toggle('hidden', !custom);
        return;
      }
      if (e.target.id === 'lc_e_borderColor') {
        markHistory('border-color');
        endHistoryCoalesce();
        syncBorderColorUi();
        syncPaperFromDom();
        renderCanvas();
        refreshPreview();
        return;
      }
      if (e.target.id === 'lc_e_w' || e.target.id === 'lc_e_h') {
        syncPaperSizeFromInputs(true);
        endHistoryCoalesce();
        return;
      }
      if (e.target.id === 'lc_e_borderOn' || e.target.id === 'lc_e_borderWidth' ||
          e.target.id === 'lc_e_mat' || e.target.id === 'lc_e_mount' || e.target.id === 'lc_e_print' ||
          e.target.id === 'lc_e_name') {
        markHistory('meta:' + e.target.id);
        endHistoryCoalesce();
        syncPaperFromDom();
        renderCanvas();
        refreshPreview();
      }
    });

    root.addEventListener('input', function (e) {
      if (e.target.getAttribute('data-lc-bind-kw') != null) {
        state.bindKw = e.target.value || '';
        renderBind();
        return;
      }
      if (e.target.closest('#lc_propLayout') && e.target.getAttribute('data-lc-geom')) {
        applyGeomFromInputs();
        renderCanvas();
        refreshPreview();
        return;
      }
      if (e.target.id === 'lc_e_borderRgb') {
        var bHex = parseColorText(e.target.value);
        if (bHex) {
          markHistory('border-color');
          $('lc_e_borderColor').value = bHex;
          syncPaperFromDom();
          renderCanvas();
          refreshPreview();
        }
        return;
      }
      if (e.target.id === 'lc_e_name' || e.target.id === 'lc_e_mat' ||
          e.target.id === 'lc_e_mount' || e.target.id === 'lc_e_print') {
        markHistory('meta:' + e.target.id);
        syncPaperFromDom();
        return;
      }
      if (e.target.closest('#lc_propContent') && e.target.getAttribute('data-lc-rgb')) {
        var key = e.target.getAttribute('data-lc-rgb');
        var hex = parseColorText(e.target.value);
        if (hex) applyColorKey(key, hex);
        return;
      }
      if (e.target.closest('#lc_propContent') && e.target.getAttribute('data-lc-c')) {
        applyContentFromInputs();
        if (e.target.getAttribute('data-lc-c') === 'opacity') syncOpacityLabel();
        renderCanvas();
        refreshPreview();
      }
    });

    document.addEventListener('keydown', function (e) {
      var modal = $('lc_editModal');
      if (!modal || !modal.classList.contains('open') || !state.draft) return;
      var tag = (e.target && e.target.tagName) || '';
      var typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);
      if (!(e.ctrlKey || e.metaKey)) return;
      var key = String(e.key || '').toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        if (typing) return;
        e.preventDefault();
        undoEditor();
        return;
      }
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        if (typing) return;
        e.preventDefault();
        redoEditor();
      }
    });

    root.addEventListener('mousedown', function (e) {
      if (e.target.closest('#lc_canvas')) {
        onCanvasPointerDown(e);
        return;
      }
      // 点击画布网格空白处：取消选中，恢复纯预览样式
      if (e.target.closest('.lc-center-body') && !e.target.closest('.lc-canvas-el')) {
        clearSelection();
      }
    });
    document.addEventListener('mousemove', onCanvasPointerMove);
    document.addEventListener('mouseup', onCanvasPointerUp);

    root.addEventListener('wheel', function (e) {
      if (!e.target.closest('.lc-center-body')) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      nudgeZoom(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
  }

  function init(cat) {
    cfg = LabelCertConfig.load();
    if (cat) state.cat = cat;
    bindEvents();
    renderList();
  }

  function setCat(cat) {
    state.cat = cat || state.cat;
    if (cfg) renderList();
  }

  function setType(type) {
    state.type = type === 'sample_label' ? 'sample_label' : 'certificate';
    if (cfg) renderList();
  }

  function show() {
    var view = $('labelCertView');
    if (view) view.classList.remove('hidden');
    if (!cfg) init(state.cat);
    else renderList();
  }

  function hide() {
    var view = $('labelCertView');
    if (view) view.classList.add('hidden');
    closeEditor();
    closePreview();
    closeCreateChooser();
  }

  global.LabelCertUI = {
    init: init,
    setCat: setCat,
    setType: setType,
    show: show,
    hide: hide,
    renderList: renderList,
    openEditor: openEditor,
    openPreview: openPreview
  };
})(window);
