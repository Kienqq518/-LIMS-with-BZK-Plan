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
    drag: null
  };

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
    $('lc_e_borderOn').value = tpl.paper.border && tpl.paper.border.enabled ? '1' : '0';
    $('lc_e_borderColor').value = (tpl.paper.border && tpl.paper.border.color) || '#cbd5e1';
    syncBorderColorUi();
    $('lc_e_borderWidth').value = (tpl.paper.border && tpl.paper.border.widthPx) || 1;
    $('lc_e_mat').value = (tpl.meta && tpl.meta.material) || '';
    $('lc_e_mount').value = (tpl.meta && tpl.meta.mount) || '';
    $('lc_e_print').value = (tpl.meta && tpl.meta.printMethod) || '';
    $('lc_e_roleHint').textContent = state.editingIsDefault
      ? '默认模版：自由设计版式；不可删除 / 停用 / 绑定样品。'
      : '个性化模版：保存并启用前须绑定 ≥1 个样品叶节点。可从空白或复制已有模版而来。';
    var bindSec = $('lc_bindSection');
    if (bindSec) bindSec.classList.toggle('hidden', state.editingIsDefault);
    renderPalette();
    renderCanvas();
    renderPropPanel();
    renderBind();
    refreshPreview();
    syncPropTabs();
  }

  function syncPaperFromDom() {
    if (!state.draft) return;
    state.draft.name = ($('lc_e_name').value || '').trim();
    state.draft.paper.wMm = parseFloat($('lc_e_w').value) || state.draft.paper.wMm;
    state.draft.paper.hMm = parseFloat($('lc_e_h').value) || state.draft.paper.hMm;
    if (!state.draft.paper.border) state.draft.paper.border = { enabled: true, color: '#cbd5e1', widthPx: 1 };
    state.draft.paper.border.enabled = $('lc_e_borderOn').value !== '0';
    state.draft.paper.border.color = $('lc_e_borderColor').value || '#cbd5e1';
    state.draft.paper.border.widthPx = parseInt($('lc_e_borderWidth').value, 10) || 1;
    state.draft.meta = {
      material: $('lc_e_mat').value || '',
      mount: $('lc_e_mount').value || '',
      printMethod: $('lc_e_print').value || ''
    };
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
      var on = findPaletteMatch(t).length > 0;
      // 检测章/文本水印可多枚：点击始终新增；二维码仍为开关
      if (t === 'seal' || t === 'watermarkText') {
        var n = findPaletteMatch(t).length;
        return typeBtn(t, '', n > 0, n > 0 ? ('已添加 ' + n + ' 个，点击继续添加') : '点击添加（可重复）');
      }
      return typeBtn(t, '', on, on ? '再次点击移除' : '');
    }).join('');

    var decor = ['staticText', 'line', 'hangHole'].map(function (t) {
      var n = findPaletteMatch(t).length;
      return typeBtn(t, '', n > 0, n > 0 ? ('已添加 ' + n + ' 个，点击继续添加') : '点击添加（可重复）');
    }).join('');

    box.innerHTML =
      '<div class="lc-pal-group"><div class="lc-pal-title">品牌标识</div><div class="lc-pal-items">' + brand + '</div></div>' +
      '<div class="lc-pal-group"><div class="lc-pal-title">业务字段</div><div class="lc-pal-items">' + fields + '</div></div>' +
      '<div class="lc-pal-group"><div class="lc-pal-title">码与章</div><div class="lc-pal-items">' + code + '</div></div>' +
      '<div class="lc-pal-group"><div class="lc-pal-title">装饰辅助 <span class="font-normal text-slate-400">可重复</span></div><div class="lc-pal-items">' + decor + '</div></div>';
  }

  function isRepeatableType(type) {
    return type === 'staticText' || type === 'line' || type === 'hangHole' ||
      type === 'seal' || type === 'watermarkText';
  }

  /** 元件库：唯一类开关；装饰辅助等可重复类型每次点击新增 */
  function toggleElement(type, fieldId) {
    if (!state.draft) return;
    if (isRepeatableType(type)) {
      addElement(type, fieldId);
      return;
    }
    var hits = findPaletteMatch(type, fieldId);
    if (hits.length) {
      var target = hits[hits.length - 1];
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
        '<p class="text-[10px] text-slate-400 mb-2 leading-relaxed">叠放顺序（非图层数量）：数字越大越靠上。当前约第 ' +
          rank.index + ' / 共 ' + rank.total + '。水印/章可用置底/置顶。</p>' +
        '<div class="lc-prop-actions">' +
          '<label class="text-xs text-slate-600 flex items-center gap-1"><input type="checkbox" data-lc-prop="locked"' +
            (el.locked ? ' checked' : '') + ' /> 锁定</label>' +
          '<button type="button" class="lc-mini-btn" data-lc-layer="up">上移一层</button>' +
          '<button type="button" class="lc-mini-btn" data-lc-layer="down">下移一层</button>' +
          ((el.type === 'seal' || el.type === 'watermarkText')
            ? '<button type="button" class="lc-mini-btn" data-lc-layer="bottom">置于底层</button>' +
              '<button type="button" class="lc-mini-btn" data-lc-layer="top">置于顶层</button>'
            : '') +
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
        colorField('颜色', 'color', p.color || '#1e293b') +
        '<p class="text-xs text-slate-400 mt-2">绑定字段：' + LabelCertRender.esc(p.fieldId) + '（不可改；删除后可重新添加）</p>';
    } else if (el.type === 'orgName' || el.type === 'title' || el.type === 'staticText' || el.type === 'watermarkText') {
      html +=
        '<label class="text-xs text-slate-600 block mb-2">文案<textarea data-lc-c="text" rows="2" class="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-sm">' +
        LabelCertRender.esc(p.text || '') + '</textarea></label>' +
        numContent('字号', 'fontSize', p.fontSize || 11) +
        colorField('颜色', 'color', p.color || '#1e293b') +
        selectField('对齐', 'align', p.align || 'center', [['left', '居左'], ['center', '居中'], ['right', '居右']]);
      if (el.type === 'watermarkText') {
        html += numContent('透明度', 'opacity', Math.round((p.opacity != null ? p.opacity : 0.18) * 100)) +
          '<p class="text-[10px] text-slate-400 -mt-1 mb-2">透明度输入 5–80（百分比）</p>' +
          '<label class="text-xs text-slate-600 flex items-center gap-1 mb-2"><input type="checkbox" data-lc-c="tile"' +
          (p.tile ? ' checked' : '') + ' /> 平铺</label>';
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
        numContent('透明度', 'opacity', Math.round((p.opacity != null ? p.opacity : 0.42) * 100)) +
        '<p class="text-[10px] text-slate-400 -mt-1 mb-2">透明度输入 5–100（百分比）</p>';
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
        '<button type="button" class="lc-mini-btn" data-lc-rgb-copy="' + key + '" title="复制 RGB">复制</button>' +
        '<button type="button" class="lc-mini-btn" data-lc-rgb-paste="' + key + '" title="从剪贴板粘贴">粘贴</button>' +
      '</div></div>';
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
    document.querySelectorAll('#lc_propContent [data-lc-c]').forEach(function (input) {
      var key = input.getAttribute('data-lc-c');
      if (input.type === 'checkbox') {
        el.props[key] = input.checked;
        return;
      }
      if (key === 'opacity') {
        var pct = parseFloat(input.value);
        if (!isNaN(pct)) el.props.opacity = Math.max(0.05, Math.min(1, pct / 100));
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

  function onCanvasPointerDown(e) {
    var handle = e.target.closest('[data-resize]');
    var node = e.target.closest('[data-el-id]');
    var paper = e.target.closest('[data-lc-paper]');
    if (node) {
      var id = node.getAttribute('data-el-id');
      state.selectedId = id;
      var el = selectedEl();
      if (!el) return;
      renderCanvas();
      renderPropPanel();
      if (el.locked && !handle) return;
      var rect = node.getBoundingClientRect();
      state.drag = {
        id: id,
        mode: handle ? 'resize' : 'move',
        startX: e.clientX,
        startY: e.clientY,
        origX: el.xMm,
        origY: el.yMm,
        origW: el.wMm,
        origH: el.hMm,
        rect: rect
      };
      e.preventDefault();
      return;
    }
    if (paper) {
      state.selectedId = null;
      renderCanvas();
      renderPropPanel();
    }
  }

  function onCanvasPointerMove(e) {
    if (!state.drag || !state.draft) return;
    var el = null;
    for (var i = 0; i < state.draft.elements.length; i++) {
      if (state.draft.elements[i].id === state.drag.id) el = state.draft.elements[i];
    }
    if (!el || el.locked) return;
    var dx = (e.clientX - state.drag.startX) / state.scale;
    var dy = (e.clientY - state.drag.startY) / state.scale;
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

      var addBtn = e.target.closest('[data-lc-add]');
      if (addBtn) {
        toggleElement(addBtn.getAttribute('data-lc-add'), addBtn.getAttribute('data-field'));
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
          rgbCopy.textContent = '已复制';
          setTimeout(function () { rgbCopy.textContent = '复制'; }, 1000);
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
        }).catch(function () {
          var manual = window.prompt('粘贴 RGB 或十六进制颜色', '');
          var hex2 = parseColorText(manual);
          if (!hex2) { alert('无法识别颜色'); return; }
          applyColorKey(pKey, hex2);
        });
        return;
      }
      if (e.target.closest('[data-lc-border-rgb-copy]')) {
        var bRgb = $('lc_e_borderRgb');
        copyText(bRgb ? bRgb.value : '').then(function () {
          e.target.textContent = '已复制';
          setTimeout(function () { e.target.textContent = '复制'; }, 1000);
        }).catch(function () { alert('复制失败'); });
        return;
      }
      if (e.target.closest('[data-lc-border-rgb-paste]')) {
        readClipboardText().then(function (txt) {
          var hex = parseColorText(txt);
          if (!hex) { alert('无法识别颜色'); return; }
          $('lc_e_borderColor').value = hex;
          syncBorderColorUi();
          syncPaperFromDom();
          renderCanvas();
          refreshPreview();
        }).catch(function () {
          var manual = window.prompt('粘贴 RGB 或十六进制颜色', '');
          var hex2 = parseColorText(manual);
          if (!hex2) return;
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
        var list = state.draft.bindSampleIds || (state.draft.bindSampleIds = []);
        var ix = list.indexOf(sid);
        if (e.target.checked && ix < 0) list.push(sid);
        if (!e.target.checked && ix >= 0) list.splice(ix, 1);
        renderBind();
        return;
      }
      if (e.target.getAttribute('data-lc-prop') === 'locked') {
        var el = selectedEl();
        if (el) { el.locked = e.target.checked; renderCanvas(); }
        return;
      }
      if (e.target.getAttribute('data-lc-logo-file') != null) {
        var file = e.target.files && e.target.files[0];
        var logoTarget = selectedEl();
        if (!file || !logoTarget || logoTarget.type !== 'logo') return;
        readFileAsDataUrl(file, function (url) {
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
        // 切换 Logo 来源时刷新内容区（显示/隐藏上传）
        if (e.target.getAttribute('data-lc-c') === 'source') renderPropPanel();
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
        syncBorderColorUi();
        syncPaperFromDom();
        renderCanvas();
        refreshPreview();
        return;
      }
      if (e.target.id === 'lc_e_w' || e.target.id === 'lc_e_h' || e.target.id === 'lc_e_borderOn' ||
          e.target.id === 'lc_e_borderWidth') {
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
          $('lc_e_borderColor').value = bHex;
          syncPaperFromDom();
          renderCanvas();
          refreshPreview();
        }
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
        renderCanvas();
        refreshPreview();
      }
    });

    root.addEventListener('mousedown', function (e) {
      if (e.target.closest('#lc_canvas')) onCanvasPointerDown(e);
    });
    document.addEventListener('mousemove', onCanvasPointerMove);
    document.addEventListener('mouseup', onCanvasPointerUp);
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
