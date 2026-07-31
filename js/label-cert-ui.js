/**
 * 标签与合格证模版 UI（挂到模板管理第四类型）
 */
(function (global) {
  var cfg = null;
  var state = { cat: 'aqgqj', type: 'certificate', editingId: null, draft: null };
  var dragFrom = -1;
  var boundPreview = false;

  function $(id) { return document.getElementById(id); }

  function sampleName(id) {
    var leaves = LabelCertConfig.SAMPLE_LEAVES[state.cat] || [];
    for (var i = 0; i < leaves.length; i++) if (leaves[i].id === id) return leaves[i].name;
    return id;
  }

  function renderList() {
    var bucket = LabelCertConfig.getBucket(cfg, state.cat, state.type);
    var rows = bucket.templates || [];
    var body = $('lc_tplBody');
    if (!body) return;
    body.innerHTML = rows.length ? rows.map(function (t) {
      var preset = LabelCertConfig.PRESETS[t.layoutPreset] || {};
      var binds = (t.bindSampleIds || []).map(sampleName).join('、') || '—';
      var isDef = bucket.defaultTemplateId === t.id;
      return '<tr class="hover:bg-slate-50">' +
        '<td class="border-b border-slate-100 px-3 py-2">' + t.name + '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2">' + (preset.name || t.layoutPreset) + '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2">' + (t.paper.wMm + '×' + t.paper.hMm) + '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2 max-w-[220px] truncate" title="' + binds + '">' + binds +
        ' <span class="text-slate-400">(' + (t.bindSampleIds || []).length + ')</span></td>' +
        '<td class="border-b border-slate-100 px-3 py-2">' + (isDef
          ? '<span class="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">默认</span>'
          : '<button type="button" class="text-xs text-blue-600 hover:underline" data-lc-act="default" data-id="' + t.id + '">设为默认</button>') + '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2">' + (t.enabled ? '<span class="text-green-600">启用</span>' : '<span class="text-slate-400">停用</span>') + '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2 whitespace-nowrap">' +
          '<button type="button" class="text-blue-600 hover:underline mr-2" data-lc-act="edit" data-id="' + t.id + '">编辑</button>' +
          '<button type="button" class="text-blue-600 hover:underline mr-2" data-lc-act="edit" data-id="' + t.id + '">预览</button>' +
          '<button type="button" class="text-red-500 hover:underline" data-lc-act="del" data-id="' + t.id + '">删除</button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="px-3 py-10 text-center text-slate-400">暂无模版，请新建</td></tr>';

    $('lc_listTitle').textContent = state.type === 'certificate' ? '合格证模版' : '样品标签模版';
    document.querySelectorAll('#labelCertView .lc-type-nav').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-type') === state.type);
    });
  }

  function setDefault(id) {
    var bucket = LabelCertConfig.getBucket(cfg, state.cat, state.type);
    bucket.defaultTemplateId = id;
    LabelCertConfig.save(cfg);
    renderList();
  }

  function removeTpl(id) {
    if (!confirm('确认删除该模版？')) return;
    var bucket = LabelCertConfig.getBucket(cfg, state.cat, state.type);
    bucket.templates = bucket.templates.filter(function (t) { return t.id !== id; });
    if (bucket.defaultTemplateId === id) bucket.defaultTemplateId = (bucket.templates[0] && bucket.templates[0].id) || null;
    LabelCertConfig.save(cfg);
    renderList();
  }

  function openEditor(id) {
    state.editingId = id || null;
    var bucket = LabelCertConfig.getBucket(cfg, state.cat, state.type);
    var tpl = null;
    if (id) {
      for (var i = 0; i < bucket.templates.length; i++) if (bucket.templates[i].id === id) tpl = LabelCertConfig.clone(bucket.templates[i]);
    }
    if (!tpl) {
      var defaultPreset = state.type === 'sample_label' ? 'label_style_1' : 'cert_style_3';
      tpl = LabelCertConfig.createTemplate({
        type: state.type,
        layoutPreset: defaultPreset,
        name: state.type === 'sample_label' ? '新样品标签模版' : '新合格证模版'
      });
    }
    state.draft = tpl;
    $('lc_editTitle').textContent = id ? '编辑模版' : '新建模版';
    fillEditor(tpl);
    $('lc_editModal').classList.add('open');
    refreshPreview();
  }

  function closeEditor() {
    $('lc_editModal').classList.remove('open');
    state.draft = null;
  }

  function fillEditor(tpl) {
    var presetSel = $('lc_e_preset');
    presetSel.innerHTML = Object.keys(LabelCertConfig.PRESETS).filter(function (k) {
      return LabelCertConfig.PRESETS[k].type === state.type;
    }).map(function (k) {
      return '<option value="' + k + '">' + LabelCertConfig.PRESETS[k].name + '</option>';
    }).join('');
    presetSel.value = tpl.layoutPreset;
    $('lc_e_name').value = tpl.name;
    $('lc_e_w').value = tpl.paper.wMm;
    $('lc_e_h').value = tpl.paper.hMm;
    $('lc_e_font').value = (tpl.style && tpl.style.fontScale) || 'normal';
    $('lc_e_enabled').checked = !!tpl.enabled;
    $('lc_e_org').value = tpl.brand.orgName || '';
    $('lc_e_title').value = tpl.brand.title || '';
    $('lc_e_logo').value = tpl.brand.logoMode || 'system';
    $('lc_e_wm').checked = !!tpl.brand.showWatermarkGe;
    $('lc_e_warn').value = tpl.brand.footerWarning || '';
    $('lc_e_qr').checked = !tpl.qr || tpl.qr.enabled !== false;
    $('lc_e_qrSize').value = (tpl.qr && tpl.qr.sizePx) || 90;
    $('lc_e_qrPlace').value = (tpl.qr && tpl.qr.placement) || 'right';
    $('lc_e_mat').value = (tpl.meta && tpl.meta.material) || '';
    $('lc_e_mount').value = (tpl.meta && tpl.meta.mount) || '';
    $('lc_e_print').value = (tpl.meta && tpl.meta.printMethod) || '';
    renderFieldUI(tpl);
    renderBindUI(tpl);
  }

  function renderFieldUI(tpl) {
    var pool = LabelCertConfig.poolForType(state.type);
    var selectedMap = {};
    (tpl.fields || []).forEach(function (f) { if (f.visible !== false) selectedMap[f.id] = f; });
    $('lc_fieldPool').innerHTML = pool.map(function (f) {
      var on = !!selectedMap[f.id];
      return '<span class="lc-chip ' + (on ? 'on' : '') + '" data-lc-field="' + f.id + '">' + f.label + '</span>';
    }).join('');
    var ordered = (tpl.fields || []).filter(function (f) { return f.visible !== false; });
    $('lc_fieldList').innerHTML = ordered.map(function (f, idx) {
      return '<div class="lc-field-item" draggable="true" data-idx="' + idx + '">' +
        '<i class="fa fa-bars text-slate-300"></i>' +
        '<span class="w-28 text-xs text-slate-400">' + f.id + '</span>' +
        '<input class="flex-1 rounded border border-slate-200 px-2 py-1 text-sm" value="' + f.label.replace(/"/g, '&quot;') + '" data-lc-rename="' + idx + '" />' +
        '<button type="button" class="text-slate-400 hover:text-red-500" data-lc-field="' + f.id + '"><i class="fa fa-times"></i></button></div>';
    }).join('') || '<p class="text-sm text-slate-400">请从上方字段池勾选</p>';
  }

  function toggleField(id) {
    var tpl = collectDraft(false);
    var pool = LabelCertConfig.poolForType(state.type);
    var label = id;
    pool.forEach(function (f) { if (f.id === id) label = f.label; });
    var idx = -1;
    for (var i = 0; i < tpl.fields.length; i++) if (tpl.fields[i].id === id) { idx = i; break; }
    if (idx >= 0) tpl.fields.splice(idx, 1);
    else tpl.fields.push({ id: id, label: label, visible: true });
    state.draft = tpl;
    renderFieldUI(tpl);
    refreshPreview();
  }

  function renameField(idx, val) {
    state.draft = collectDraft(false);
    if (state.draft.fields[idx]) state.draft.fields[idx].label = val;
    refreshPreview();
  }

  function renderBindUI(tpl) {
    var leaves = LabelCertConfig.SAMPLE_LEAVES[state.cat] || [];
    var set = {};
    (tpl.bindSampleIds || []).forEach(function (id) { set[id] = true; });
    $('lc_bindSamples').innerHTML = leaves.length ? leaves.map(function (s) {
      return '<span class="lc-chip ' + (set[s.id] ? 'on' : '') + '" data-lc-bind="' + s.id + '">' + s.name + '</span>';
    }).join('') : '<span class="text-sm text-slate-400">该大类暂无样品叶节点</span>';
    var conflicts = LabelCertConfig.findBindConflicts(state.cat, state.type, tpl.id, tpl.bindSampleIds || []);
    $('lc_bindHint').textContent = conflicts.length
      ? ('冲突：' + conflicts.map(function (c) { return sampleName(c.sampleId) + ' 已绑定「' + c.templateName + '」'; }).join('；'))
      : '';
  }

  function toggleBind(id) {
    var tpl = collectDraft(false);
    var arr = tpl.bindSampleIds || [];
    var i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    tpl.bindSampleIds = arr;
    state.draft = tpl;
    renderBindUI(tpl);
  }

  function onPresetChange() {
    var presetId = $('lc_e_preset').value;
    var preset = LabelCertConfig.PRESETS[presetId];
    $('lc_e_w').value = preset.paper.wMm;
    $('lc_e_h').value = preset.paper.hMm;
    $('lc_e_title').value = preset.title;
    $('lc_e_wm').checked = !!preset.showWatermarkGe;
    $('lc_e_warn').value = preset.footerWarning || '';
    $('lc_e_qr').checked = preset.qr.enabled !== false;
    $('lc_e_qrSize').value = preset.qr.sizePx;
    $('lc_e_qrPlace').value = preset.qr.placement;
    var tpl = collectDraft(false);
    tpl.layoutPreset = presetId;
    tpl.fields = LabelCertConfig.buildFieldsFromPreset(presetId);
    tpl.qr = LabelCertConfig.clone(preset.qr);
    state.draft = tpl;
    renderFieldUI(tpl);
    refreshPreview();
  }

  function collectDraft(fromDom) {
    var base = state.draft || LabelCertConfig.createTemplate({ type: state.type });
    if (!fromDom) return base;
    base.name = $('lc_e_name').value.trim() || base.name;
    base.layoutPreset = $('lc_e_preset').value;
    base.paper = { wMm: Number($('lc_e_w').value) || 90, hMm: Number($('lc_e_h').value) || 50 };
    base.style = { fontScale: $('lc_e_font').value, marginMm: 2 };
    base.enabled = $('lc_e_enabled').checked;
    base.brand = {
      orgName: $('lc_e_org').value.trim() || LabelCertConfig.DEFAULT_ORG,
      title: $('lc_e_title').value,
      logoMode: $('lc_e_logo').value,
      logoUrl: null,
      showWatermarkGe: $('lc_e_wm').checked,
      footerWarning: $('lc_e_warn').value || null
    };
    var preset = LabelCertConfig.PRESETS[base.layoutPreset];
    base.qr = {
      enabled: $('lc_e_qr').checked,
      sizePx: Number($('lc_e_qrSize').value) || 90,
      payloadType: (preset && preset.qr.payloadType) || (state.type === 'sample_label' ? 'sample_flow' : 'cert_shortlink'),
      placement: $('lc_e_qrPlace').value
    };
    if (base.layoutPreset === 'cert_style_2') {
      base.qr.enabled = true;
      base.qr.placement = 'center';
    }
    base.meta = {
      material: $('lc_e_mat').value,
      mount: $('lc_e_mount').value,
      printMethod: $('lc_e_print').value
    };
    base.updatedAt = LabelCertConfig.formatNow();
    return base;
  }

  function demoData() {
    return {
      sampleNo: 'SC2026/00790101',
      name: '绝缘操作杆',
      spec: '',
      model: '10kV',
      inspectDate: '2026-07-09',
      reinspectDate: '2027-07-08',
      inspectors: ['张三', '李四'],
      receiveDate: '2026-07-09',
      clientName: '杭州数蚕智能科技有限公司',
      detectStatus: '报告发放'
    };
  }

  function refreshPreview() {
    if (!$('lc_previewBox')) return;
    var tpl = collectDraft(true);
    state.draft = tpl;
    var box = $('lc_previewBox');
    box.innerHTML = LabelCertRender.renderSheet(tpl, demoData(), { suffix: '-pv' });
    LabelCertRender.mountQrs(box);
  }

  function saveEditor() {
    var tpl = collectDraft(true);
    if (!tpl.name) { alert('请填写模版名称'); return; }
    var conflicts = LabelCertConfig.findBindConflicts(state.cat, state.type, tpl.id, tpl.bindSampleIds || []);
    if (conflicts.length) {
      alert('样品绑定冲突：\n' + conflicts.map(function (c) { return sampleName(c.sampleId) + ' → ' + c.templateName; }).join('\n'));
      return;
    }
    var bucket = LabelCertConfig.getBucket(cfg, state.cat, state.type);
    var idx = -1;
    for (var i = 0; i < bucket.templates.length; i++) if (bucket.templates[i].id === tpl.id) idx = i;
    if (idx >= 0) bucket.templates[idx] = tpl;
    else bucket.templates.push(tpl);
    if (!bucket.defaultTemplateId) bucket.defaultTemplateId = tpl.id;
    LabelCertConfig.save(cfg);
    closeEditor();
    renderList();
  }

  function bindEvents() {
    var root = $('labelCertView');
    if (!root || root.getAttribute('data-bound') === '1') return;
    root.setAttribute('data-bound', '1');

    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-type]');
      if (t && t.classList.contains('lc-type-nav')) {
        state.type = t.getAttribute('data-type');
        renderList();
        return;
      }
      var act = e.target.closest('[data-lc-act]');
      if (act) {
        var id = act.getAttribute('data-id');
        var a = act.getAttribute('data-lc-act');
        if (a === 'edit') openEditor(id);
        else if (a === 'default') setDefault(id);
        else if (a === 'del') removeTpl(id);
        return;
      }
      if (e.target.closest('[data-lc-new]')) { openEditor(); return; }
      var field = e.target.closest('[data-lc-field]');
      if (field) { toggleField(field.getAttribute('data-lc-field')); return; }
      var bind = e.target.closest('[data-lc-bind]');
      if (bind) { toggleBind(bind.getAttribute('data-lc-bind')); return; }
      if (e.target.closest('[data-lc-close]')) { closeEditor(); return; }
      if (e.target.closest('[data-lc-save]')) { saveEditor(); return; }
      if (e.target.closest('[data-lc-refresh]')) { refreshPreview(); return; }
    });

    root.addEventListener('change', function (e) {
      if (e.target.id === 'lc_e_preset') onPresetChange();
      var rename = e.target.getAttribute('data-lc-rename');
      if (rename != null) renameField(parseInt(rename, 10), e.target.value);
      if (/^lc_e_/.test(e.target.id)) refreshPreview();
    });
    root.addEventListener('input', function (e) {
      if (e.target.id === 'lc_e_org' || e.target.id === 'lc_e_title' || e.target.id === 'lc_e_warn') refreshPreview();
    });

    root.addEventListener('dragstart', function (e) {
      var item = e.target.closest('.lc-field-item');
      if (item) dragFrom = parseInt(item.getAttribute('data-idx'), 10);
    });
    root.addEventListener('dragover', function (e) {
      if (e.target.closest('.lc-field-item')) e.preventDefault();
    });
    root.addEventListener('drop', function (e) {
      var item = e.target.closest('.lc-field-item');
      if (!item) return;
      e.preventDefault();
      var to = parseInt(item.getAttribute('data-idx'), 10);
      var tpl = collectDraft(false);
      if (dragFrom < 0 || to < 0 || dragFrom === to) return;
      var moved = tpl.fields.splice(dragFrom, 1)[0];
      tpl.fields.splice(to, 0, moved);
      state.draft = tpl;
      renderFieldUI(tpl);
      refreshPreview();
    });
  }

  function setCat(cat) {
    if (!cat) return;
    state.cat = cat;
    if (cfg) renderList();
  }

  function setType(type) {
    if (type === 'sample_label' || type === 'certificate') {
      state.type = type;
      if (cfg) renderList();
    }
  }

  function init(opts) {
    opts = opts || {};
    LabelCertRender.ensureStyles();
    cfg = LabelCertConfig.load();
    if (opts.cat) state.cat = opts.cat;
    if (opts.type) state.type = opts.type;
    bindEvents();
    renderList();
  }

  function show() {
    var el = $('labelCertView');
    if (el) el.classList.remove('hidden');
    if (!cfg) init();
    else renderList();
  }

  function hide() {
    var el = $('labelCertView');
    if (el) el.classList.add('hidden');
    closeEditor();
  }

  global.LabelCertUI = {
    init: init,
    setCat: setCat,
    setType: setType,
    show: show,
    hide: hide,
    renderList: renderList,
    openEditor: openEditor
  };
})(window);
