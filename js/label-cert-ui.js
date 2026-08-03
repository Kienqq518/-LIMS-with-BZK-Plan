/**
 * 标签与合格证模版 UI（挂到模板管理第四类型）
 * 布局：默认固定区 + 个性化列表
 */
(function (global) {
  var cfg = null;
  var state = {
    cat: 'aqgqj', type: 'certificate', editingId: null, draft: null,
    editingIsDefault: false, previewId: null, bindOpen: false, bindKw: ''
  };
  var dragFrom = -1;

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

  function renderList() {
    var bucket = currentBucket();
    LabelCertConfig.save(cfg);

    var def = LabelCertConfig.findTemplate(bucket, bucket.defaultTemplateId);
    var personal = (bucket.templates || []).filter(function (t) { return t.id !== bucket.defaultTemplateId; });

    var card = $('lc_defaultCard');
    if (card && def) {
      var preset = LabelCertConfig.PRESETS[def.layoutPreset] || {};
      card.innerHTML =
        '<div class="meta">' +
          '<div class="name">' + def.name +
            '<span class="lc-default-badge"><i class="fa fa-lock"></i> 默认 · 兜底</span>' +
          '</div>' +
          '<div class="sub">' + (preset.name || def.layoutPreset) +
            ' · ' + def.paper.wMm + '×' + def.paper.hMm + ' mm' +
            ' · 覆盖全部未单独配置的样品' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-3 flex-shrink-0">' +
          '<button type="button" class="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white" data-lc-act="edit" data-id="' + def.id + '">编辑版式</button>' +
          '<button type="button" class="text-sm text-blue-600 hover:underline" data-lc-act="preview" data-id="' + def.id + '">预览</button>' +
        '</div>';
    }

    var body = $('lc_tplBody');
    if (!body) return;
    body.innerHTML = personal.length ? personal.map(function (t) {
      var p = LabelCertConfig.PRESETS[t.layoutPreset] || {};
      var binds = (t.bindSampleIds || []).map(sampleName).join('、') || '—';
      var n = (t.bindSampleIds || []).length;
      return '<tr class="hover:bg-slate-50">' +
        '<td class="border-b border-slate-100 px-3 py-2">' + t.name + '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2">' + (p.name || t.layoutPreset) + '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2">' + (t.paper.wMm + '×' + t.paper.hMm) + '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2 max-w-[240px] truncate" title="' + binds + '">' + binds +
          ' <span class="text-slate-400">(' + n + ')</span></td>' +
        '<td class="border-b border-slate-100 px-3 py-2">' +
          '<label class="lc-switch" title="' + (t.enabled ? '启用中，停用后回退默认' : '已停用，使用默认模版') + '">' +
            '<input type="checkbox" data-lc-enable="' + t.id + '"' + (t.enabled ? ' checked' : '') + ' />' +
            '<span class="slider"></span>' +
          '</label>' +
        '</td>' +
        '<td class="border-b border-slate-100 px-3 py-2 whitespace-nowrap">' +
          '<button type="button" class="text-blue-600 hover:underline mr-2" data-lc-act="edit" data-id="' + t.id + '">编辑</button>' +
          '<button type="button" class="text-blue-600 hover:underline mr-2" data-lc-act="preview" data-id="' + t.id + '">预览</button>' +
          '<button type="button" class="text-red-500 hover:underline" data-lc-act="del" data-id="' + t.id + '">删除</button>' +
        '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="px-3 py-10 text-center text-slate-400">尚未配置个性化模版，全部样品使用上方默认模版</td></tr>';

    $('lc_listTitle').textContent = state.type === 'certificate' ? '合格证模版' : '样品标签模版';
    document.querySelectorAll('#labelCertView .lc-type-nav').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-type') === state.type);
    });
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
    if (!confirm('删除后，已绑样品将回退使用默认模版。确认删除？')) return;
    bucket.templates = bucket.templates.filter(function (t) { return t.id !== id; });
    LabelCertConfig.save(cfg);
    renderList();
  }

  function openEditor(id) {
    var bucket = currentBucket();
    state.editingId = id || null;
    state.bindOpen = false;
    state.bindKw = '';
    var tpl = null;
    if (id) {
      tpl = LabelCertConfig.findTemplate(bucket, id);
      if (tpl) tpl = LabelCertConfig.clone(tpl);
    }
    var isDefault = !!(tpl && LabelCertConfig.isDefaultTemplate(bucket, tpl));
    if (!tpl) {
      var defaultPreset = state.type === 'sample_label' ? 'label_style_1' : 'cert_style_3';
      tpl = LabelCertConfig.createTemplate({
        type: state.type,
        layoutPreset: defaultPreset,
        name: state.type === 'sample_label' ? '新个性化样品标签' : '新个性化合格证',
        enabled: true,
        bindSampleIds: []
      });
      isDefault = false;
    }
    state.editingIsDefault = isDefault;
    state.draft = tpl;
    $('lc_editTitle').textContent = isDefault
      ? '编辑默认模版'
      : (id ? '编辑个性化模版' : '新增个性化模版');
    fillEditor(tpl, isDefault);
    $('lc_editModal').classList.add('open');
    refreshPreview();
  }

  function closeEditor() {
    $('lc_editModal').classList.remove('open');
    state.draft = null;
    state.editingIsDefault = false;
  }

  function openPreview(id) {
    if (!id) return;
    var bucket = currentBucket();
    var tpl = LabelCertConfig.findTemplate(bucket, id);
    if (!tpl) { alert('模版不存在'); return; }
    state.previewId = id;
    var preset = LabelCertConfig.PRESETS[tpl.layoutPreset] || {};
    var isDef = LabelCertConfig.isDefaultTemplate(bucket, tpl);
    $('lc_pvTitle').textContent = '预览 · ' + tpl.name;
    $('lc_pvSub').textContent = (isDef ? '默认模版 · ' : '个性化模版 · ') +
      (preset.name || tpl.layoutPreset) + ' · ' + tpl.paper.wMm + '×' + tpl.paper.hMm + ' mm';
    var box = $('lc_pvBox');
    box.innerHTML = LabelCertRender.renderSheet(tpl, demoData(), { suffix: '-ro' });
    LabelCertRender.mountQrs(box);
    $('lc_previewModal').classList.add('open');
  }

  function closePreview() {
    var modal = $('lc_previewModal');
    if (modal) modal.classList.remove('open');
    var box = $('lc_pvBox');
    if (box) box.innerHTML = '';
    state.previewId = null;
  }

  function fillEditor(tpl, isDefault) {
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
    $('lc_e_org').value = tpl.brand.orgName || '';
    $('lc_e_title').value = tpl.brand.title || '';
    $('lc_e_logo').value = tpl.brand.logoMode || 'system';
    $('lc_e_warn').value = tpl.brand.footerWarning || '';
    var bt = LabelCertConfig.normalizeBrandType(tpl.brand);
    $('lc_e_orgSize').value = bt.orgFontSize;
    $('lc_e_orgColor').value = bt.orgColor;
    if ($('lc_e_orgAlign')) $('lc_e_orgAlign').value = bt.orgAlign;
    $('lc_e_titleSize').value = bt.titleFontSize;
    $('lc_e_titleColor').value = bt.titleColor;
    if ($('lc_e_titleAlign')) $('lc_e_titleAlign').value = bt.titleAlign;
    $('lc_e_logoSize').value = bt.logoSize;
    $('lc_e_warnSize').value = bt.warnFontSize;
    $('lc_e_warnColor').value = bt.warnColor;
    if ($('lc_e_warnAlign')) $('lc_e_warnAlign').value = bt.warnAlign;
    if ($('lc_e_logo') && ($('lc_e_logo').value === 'custom' || !tpl.brand.logoMode)) {
      $('lc_e_logo').value = tpl.brand.logoMode === 'hidden' ? 'hidden' : 'system';
    }
    $('lc_e_qr').checked = !tpl.qr || tpl.qr.enabled !== false;
    $('lc_e_qrSize').value = (tpl.qr && tpl.qr.sizePx) || 90;
    var place = LabelCertRender.normalizeQrPlacement((tpl.qr && tpl.qr.placement) || 'right', tpl.layoutPreset);
    if (place === 'none') $('lc_e_qrPlace').value = 'none';
    else if (place === 'center') $('lc_e_qrPlace').value = 'center';
    else if (place === 'right') $('lc_e_qrPlace').value = 'right';
    else $('lc_e_qrPlace').value = place;
    $('lc_e_mat').value = (tpl.meta && tpl.meta.material) || '';
    $('lc_e_mount').value = (tpl.meta && tpl.meta.mount) || '';
    $('lc_e_print').value = (tpl.meta && tpl.meta.printMethod) || '';
    fillWatermarkUI(tpl.brand);
    syncQrPlaceUi(tpl.layoutPreset);
    syncLabelBrandUi();

    var role = $('lc_e_roleHint');
    if (role) {
      role.innerHTML = isDefault
        ? '<span class="lc-role-tag">默认模版</span> 可改版式与字段；身份锁定为兜底，不绑定样品，不可停用/删除。'
        : '<span class="lc-role-tag">个性化模版</span> 必须绑定至少一个样品；停用后相关样品使用默认模版。';
    }
    var bindSec = $('lc_bindSection');
    if (bindSec) bindSec.style.display = isDefault ? 'none' : '';

    renderFieldUI(tpl);
    if (!isDefault) renderBindUI(tpl);
  }

  function syncLabelBrandUi() {
    var isLabel = state.type === 'sample_label';
    var warnWrap = $('lc_e_warnWrap');
    if (warnWrap) warnWrap.style.display = isLabel ? 'none' : '';
    var orgLabel = $('lc_e_org') && $('lc_e_org').closest('label');
    if (orgLabel && orgLabel.firstChild) {
      // keep structure; hint via placeholder
    }
    if ($('lc_e_org')) {
      $('lc_e_org').placeholder = isLabel ? '留空则预览不显示单位名称' : '默认检测机构';
    }
    if ($('lc_e_title')) {
      $('lc_e_title').placeholder = isLabel ? '留空则预览不显示标题' : '';
    }
  }

  function fillWatermarkUI(brand) {
    var preset = null;
    var wm = LabelCertConfig.normalizeWatermark(brand && brand.watermark, brand || {}, preset);
    if (state.draft && !state.draft.brand) state.draft.brand = {};
    if (state.draft) state.draft.brand.watermark = wm;
    $('lc_e_wmOn').checked = !!wm.enabled;
    $('lc_e_wmType').value = wm.type;
    $('lc_e_wmLayout').value = wm.layout;
    $('lc_e_wmText').value = wm.text || '';
    if ($('lc_e_wmColor')) $('lc_e_wmColor').value = wm.color || '#16a34a';
    $('lc_e_wmSealMode').value = wm.sealMode;
    $('lc_e_wmPos').value = wm.position;
    $('lc_e_wmSize').value = wm.size;
    $('lc_e_wmAngle').value = wm.angle;
    var pct = Math.round(wm.opacity * 100);
    $('lc_e_wmOpacity').value = pct;
    $('lc_e_wmOpacityVal').textContent = pct + '%';
    $('lc_e_wmSealHint').textContent = wm.sealUrl ? '已上传自定义章图' : '未上传时使用系统章';
    syncWatermarkTypeUI();
  }

  function syncWatermarkTypeUI() {
    var isSeal = $('lc_e_wmType').value === 'seal';
    var textWrap = $('lc_e_wmTextWrap');
    var sealWrap = $('lc_e_wmSealWrap');
    if (textWrap) textWrap.classList.toggle('hidden', isSeal);
    if (sealWrap) sealWrap.classList.toggle('hidden', !isSeal);
    var custom = $('lc_e_wmSealMode').value === 'custom';
    var file = $('lc_e_wmSealFile');
    if (file) file.disabled = !custom;
  }

  function syncQrPlaceUi(presetId) {
    var place = $('lc_e_qrPlace');
    var hint = $('lc_e_qrPlaceHint');
    var isHang = presetId === 'cert_style_2';
    if (place) {
      place.disabled = isHang;
      if (isHang) place.value = 'center';
    }
    if (hint) {
      hint.textContent = isHang
        ? 'PVC 悬挂样式二维码固定中置'
        : '切换位置后右侧预览即时更新';
    }
  }

  function collectWatermarkFromDom(brand) {
    var opacityPct = Number($('lc_e_wmOpacity').value);
    if (isNaN(opacityPct)) opacityPct = 22;
    var sealUrl = (brand && brand.watermark && brand.watermark.sealUrl) || null;
    return LabelCertConfig.normalizeWatermark({
      enabled: $('lc_e_wmOn').checked,
      type: $('lc_e_wmType').value,
      text: $('lc_e_wmText').value.trim(),
      color: $('lc_e_wmColor') ? $('lc_e_wmColor').value : '#16a34a',
      sealMode: $('lc_e_wmSealMode').value,
      sealUrl: sealUrl,
      opacity: opacityPct / 100,
      angle: Number($('lc_e_wmAngle').value),
      position: $('lc_e_wmPos').value,
      size: $('lc_e_wmSize').value,
      layout: $('lc_e_wmLayout').value
    }, brand || {}, null);
  }

  function renderFieldUI(tpl) {
    var pool = LabelCertConfig.poolForType(state.type);
    var selectedMap = {};
    (tpl.fields || []).forEach(function (f) { if (f.visible !== false) selectedMap[f.id] = f; });
    $('lc_fieldPool').innerHTML = pool.map(function (f) {
      var on = !!selectedMap[f.id];
      return '<span class="lc-chip ' + (on ? 'on' : '') + '" data-lc-field="' + f.id + '">' + f.label + '</span>';
    }).join('');
    var ordered = (tpl.fields || []).filter(function (f) { return f.visible !== false && f.id !== 'qrCode'; });
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
    var root = $('lc_bindSamples');
    if (!root) return;
    var tree = (LabelCertConfig.SAMPLE_TREE && LabelCertConfig.SAMPLE_TREE[state.cat]) || [];
    var leaves = LabelCertConfig.SAMPLE_LEAVES[state.cat] || [];
    var selected = tpl.bindSampleIds || [];
    var set = {};
    selected.forEach(function (id) { set[id] = true; });
    var kw = (state.bindKw || '').trim().toLowerCase();

    function leafMatch(leaf, group) {
      if (!kw) return true;
      return String(leaf.name).toLowerCase().indexOf(kw) !== -1 ||
        String(leaf.id).toLowerCase().indexOf(kw) !== -1 ||
        String(group.name).toLowerCase().indexOf(kw) !== -1;
    }

    if (!leaves.length) {
      root.innerHTML = '<span class="text-sm text-slate-400">该大类暂无样品叶节点</span>';
    } else {
      var triggerText = selected.length
        ? ('已选 ' + selected.length + ' 项：' + selected.map(sampleName).slice(0, 3).join('、') + (selected.length > 3 ? ' 等' : ''))
        : '<span class="ph">请选择要绑定的样品</span>';
      var listHtml = '';
      var matchCount = 0;
      tree.forEach(function (group) {
        var kids = (group.children || []).filter(function (leaf) { return leafMatch(leaf, group); });
        if (!kids.length) return;
        listHtml += '<div class="lc-ms-group">' + group.name + '</div>';
        kids.forEach(function (leaf) {
          matchCount++;
          listHtml += '<label class="lc-ms-item indent">' +
            '<input type="checkbox" data-lc-bind="' + leaf.id + '" ' + (set[leaf.id] ? 'checked' : '') + ' />' +
            '<span>' + leaf.name + '</span></label>';
        });
      });
      if (!listHtml) listHtml = '<div class="lc-ms-empty">无匹配样品</div>';
      root.innerHTML =
        '<div class="lc-ms' + (state.bindOpen ? ' open' : '') + '" id="lc_msRoot">' +
          '<button type="button" class="lc-ms-trigger" data-lc-ms-toggle>' +
            '<span class="truncate">' + triggerText + '</span><i class="fa fa-angle-down"></i>' +
          '</button>' +
          '<div class="lc-ms-panel">' +
            '<input type="text" class="lc-ms-search" id="lc_msSearch" placeholder="搜索分类或样品名称" value="' +
              String(state.bindKw || '').replace(/"/g, '&quot;') + '" />' +
            '<div class="lc-ms-list">' + listHtml + '</div>' +
            '<div class="lc-ms-foot">' +
              '<span>共 ' + leaves.length + ' 项 · 已选 ' + selected.length + (kw ? (' · 匹配 ' + matchCount) : '') + '</span>' +
              '<button type="button" class="text-blue-600 hover:underline" data-lc-ms-clear>清空</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      var search = $('lc_msSearch');
      if (search && state.bindOpen) {
        search.focus();
        try { search.setSelectionRange(search.value.length, search.value.length); } catch (e) { /* ignore */ }
      }
    }

    var conflicts = LabelCertConfig.findBindConflicts(state.cat, state.type, tpl.id, selected);
    var hint = '';
    if (!selected.length) hint = '请至少选择 1 个样品';
    else if (conflicts.length) {
      hint = '冲突：' + conflicts.map(function (c) {
        return sampleName(c.sampleId) + ' 已绑定「' + c.templateName + '」';
      }).join('；');
    }
    $('lc_bindHint').textContent = hint;
  }

  function toggleBind(id) {
    if (state.editingIsDefault) return;
    var tpl = collectDraft(false);
    var arr = tpl.bindSampleIds || [];
    var i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    tpl.bindSampleIds = arr;
    state.draft = tpl;
    renderBindUI(tpl);
  }

  function clearBind() {
    if (state.editingIsDefault) return;
    var tpl = collectDraft(false);
    tpl.bindSampleIds = [];
    state.draft = tpl;
    renderBindUI(tpl);
  }

  function onPresetChange() {
    var presetId = $('lc_e_preset').value;
    var preset = LabelCertConfig.PRESETS[presetId];
    $('lc_e_w').value = preset.paper.wMm;
    $('lc_e_h').value = preset.paper.hMm;
    $('lc_e_title').value = preset.title;
    $('lc_e_warn').value = preset.footerWarning || '';
    $('lc_e_qr').checked = preset.qr.enabled !== false;
    $('lc_e_qrSize').value = preset.qr.sizePx;
    var place = LabelCertRender.normalizeQrPlacement(preset.qr.placement, presetId);
    $('lc_e_qrPlace').value = place === 'corner' ? 'bottom_right' : place;
    syncQrPlaceUi(presetId);
    var tpl = collectDraft(false);
    tpl.layoutPreset = presetId;
    tpl.fields = LabelCertConfig.buildFieldsFromPreset(presetId);
    tpl.qr = LabelCertConfig.clone(preset.qr);
    // 切换预设时同步默认水印（保留已上传章图）
    var keepSeal = tpl.brand && tpl.brand.watermark && tpl.brand.watermark.sealUrl;
    tpl.brand.watermark = LabelCertConfig.defaultWatermark(preset);
    if (keepSeal) {
      tpl.brand.watermark.sealUrl = keepSeal;
      tpl.brand.watermark.sealMode = 'custom';
    }
    if (preset.type === 'sample_label') {
      tpl.brand.orgName = '';
      tpl.brand.title = '';
      tpl.brand.logoMode = 'hidden';
      tpl.brand.footerWarning = null;
      $('lc_e_org').value = '';
      $('lc_e_title').value = '';
      $('lc_e_logo').value = 'hidden';
      $('lc_e_warn').value = '';
    }
    state.draft = tpl;
    fillWatermarkUI(tpl.brand);
    syncLabelBrandUi();
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
    var watermark = collectWatermarkFromDom(base.brand);
    var typeStyle = LabelCertConfig.normalizeBrandType({
      orgFontSize: $('lc_e_orgSize').value,
      orgColor: $('lc_e_orgColor').value,
      orgAlign: $('lc_e_orgAlign') ? $('lc_e_orgAlign').value : 'center',
      titleFontSize: $('lc_e_titleSize').value,
      titleColor: $('lc_e_titleColor').value,
      titleAlign: $('lc_e_titleAlign') ? $('lc_e_titleAlign').value : 'center',
      logoSize: $('lc_e_logoSize').value,
      warnFontSize: $('lc_e_warnSize').value,
      warnColor: $('lc_e_warnColor').value,
      warnAlign: $('lc_e_warnAlign') ? $('lc_e_warnAlign').value : 'center'
    });
    var isLabel = state.type === 'sample_label' || base.layoutPreset === 'label_style_1';
    var orgVal = $('lc_e_org').value.trim();
    var logoMode = $('lc_e_logo').value;
    if (logoMode !== 'hidden') logoMode = 'system';
    base.brand = {
      orgName: isLabel ? orgVal : (orgVal || LabelCertConfig.DEFAULT_ORG),
      title: $('lc_e_title').value,
      logoMode: logoMode,
      logoUrl: null,
      showWatermarkGe: watermark.enabled && watermark.type === 'text' && watermark.text === '格',
      footerWarning: isLabel ? null : $('lc_e_warn').value,
      watermark: watermark,
      orgFontSize: typeStyle.orgFontSize,
      orgColor: typeStyle.orgColor,
      orgAlign: typeStyle.orgAlign,
      titleFontSize: typeStyle.titleFontSize,
      titleColor: typeStyle.titleColor,
      titleAlign: typeStyle.titleAlign,
      logoSize: typeStyle.logoSize,
      warnFontSize: typeStyle.warnFontSize,
      warnColor: typeStyle.warnColor,
      warnAlign: typeStyle.warnAlign
    };
    var preset = LabelCertConfig.PRESETS[base.layoutPreset];
    var place = LabelCertRender.normalizeQrPlacement($('lc_e_qrPlace').value, base.layoutPreset);
    base.qr = {
      enabled: $('lc_e_qr').checked,
      sizePx: Number($('lc_e_qrSize').value) || 90,
      payloadType: (preset && preset.qr.payloadType) || (state.type === 'sample_label' ? 'sample_flow' : 'cert_shortlink'),
      placement: place
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
    if (state.editingIsDefault) {
      base.enabled = true;
      base.bindSampleIds = [];
    }
    base.updatedAt = LabelCertConfig.formatNow();
    return base;
  }

  function demoData() {
    var isLabel = state.type === 'sample_label';
    return {
      sampleNo: 'SC2026/00790101',
      entrustNo: 'WT2026/007901',
      name: '绝缘操作杆',
      spec: '',
      model: '10kV',
      inspectDate: '2026-07-09',
      reinspectDate: '2027-07-08',
      inspectors: ['张三', '李四'],
      receiveDate: '2026-07-09',
      clientName: '杭州数蚕智能科技有限公司',
      detectStatus: isLabel ? '检测中' : '报告发放'
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

    if (state.editingIsDefault) {
      tpl.enabled = true;
      tpl.bindSampleIds = [];
    } else {
      if (!(tpl.bindSampleIds || []).length) {
        alert('个性化模版必须至少绑定 1 个样品');
        return;
      }
      var conflicts = LabelCertConfig.findBindConflicts(state.cat, state.type, tpl.id, tpl.bindSampleIds || []);
      if (conflicts.length) {
        alert('样品绑定冲突：\n' + conflicts.map(function (c) {
          return sampleName(c.sampleId) + ' → ' + c.templateName;
        }).join('\n'));
        return;
      }
    }

    var bucket = currentBucket();
    var idx = -1;
    for (var i = 0; i < bucket.templates.length; i++) if (bucket.templates[i].id === tpl.id) idx = i;
    if (idx >= 0) bucket.templates[idx] = tpl;
    else bucket.templates.push(tpl);

    // 默认身份不可被新建个性化顶替
    if (state.editingIsDefault) {
      bucket.defaultTemplateId = tpl.id;
      tpl.enabled = true;
      tpl.bindSampleIds = [];
    }
    LabelCertConfig.ensureBucketShape(bucket, state.type);
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
        else if (a === 'preview') openPreview(id);
        else if (a === 'del') removeTpl(id);
        return;
      }
      if (e.target.closest('[data-lc-new]')) { openEditor(); return; }
      var field = e.target.closest('[data-lc-field]');
      if (field) { toggleField(field.getAttribute('data-lc-field')); return; }
      if (e.target.closest('[data-lc-ms-toggle]')) {
        e.stopPropagation();
        state.bindOpen = !state.bindOpen;
        renderBindUI(collectDraft(false));
        return;
      }
      if (e.target.closest('[data-lc-ms-clear]')) {
        e.stopPropagation();
        clearBind();
        return;
      }
      if (e.target.closest('#lc_msRoot')) e.stopPropagation();
      if (e.target.closest('[data-lc-pv-close]')) { closePreview(); return; }
      if (e.target.closest('[data-lc-pv-edit]')) {
        var pid = state.previewId;
        closePreview();
        if (pid) openEditor(pid);
        return;
      }
      if (e.target.closest('[data-lc-close]')) { state.bindOpen = false; closeEditor(); return; }
      if (e.target.closest('[data-lc-save]')) { state.bindOpen = false; saveEditor(); return; }
      if (e.target.closest('[data-lc-refresh]')) { refreshPreview(); return; }
    });

    root.addEventListener('change', function (e) {
      var enableId = e.target.getAttribute('data-lc-enable');
      if (enableId) {
        setEnabled(enableId, e.target.checked);
        return;
      }
      if (e.target.getAttribute('data-lc-bind')) {
        toggleBind(e.target.getAttribute('data-lc-bind'));
        return;
      }
      if (e.target.id === 'lc_e_preset') { onPresetChange(); return; }
      if (e.target.id === 'lc_e_wmType' || e.target.id === 'lc_e_wmSealMode') {
        syncWatermarkTypeUI();
        refreshPreview();
        return;
      }
      if (e.target.id === 'lc_e_wmSealFile') {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          var draft = collectDraft(false);
          if (!draft.brand) draft.brand = {};
          if (!draft.brand.watermark) draft.brand.watermark = LabelCertConfig.defaultWatermark(null);
          draft.brand.watermark.sealUrl = reader.result;
          draft.brand.watermark.sealMode = 'custom';
          draft.brand.watermark.type = 'seal';
          state.draft = draft;
          $('lc_e_wmSealMode').value = 'custom';
          $('lc_e_wmType').value = 'seal';
          $('lc_e_wmSealHint').textContent = '已上传自定义章图';
          syncWatermarkTypeUI();
          refreshPreview();
        };
        reader.readAsDataURL(file);
        return;
      }
      var rename = e.target.getAttribute('data-lc-rename');
      if (rename != null) renameField(parseInt(rename, 10), e.target.value);
      if (/^lc_e_/.test(e.target.id)) {
        if (e.target.id === 'lc_e_qrPlace') syncQrPlaceUi($('lc_e_preset').value);
        refreshPreview();
      }
    });
    root.addEventListener('input', function (e) {
      if (e.target.id === 'lc_msSearch') {
        state.bindKw = e.target.value;
        renderBindUI(collectDraft(false));
        return;
      }
      if (e.target.id === 'lc_e_wmOpacity') {
        $('lc_e_wmOpacityVal').textContent = e.target.value + '%';
        refreshPreview();
        return;
      }
      if (e.target.id === 'lc_e_org' || e.target.id === 'lc_e_title' || e.target.id === 'lc_e_warn' ||
          e.target.id === 'lc_e_wmText' || e.target.id === 'lc_e_wmAngle' ||
          e.target.id === 'lc_e_orgSize' || e.target.id === 'lc_e_titleSize' ||
          e.target.id === 'lc_e_logoSize' || e.target.id === 'lc_e_warnSize' ||
          e.target.id === 'lc_e_orgColor' || e.target.id === 'lc_e_titleColor' ||
          e.target.id === 'lc_e_warnColor' || e.target.id === 'lc_e_wmColor' ||
          e.target.id === 'lc_e_qrSize') {
        refreshPreview();
      }
    });

    document.addEventListener('mousedown', function (e) {
      if (!state.bindOpen) return;
      if (e.target.closest('#lc_msRoot') || e.target.closest('#lc_bindSamples')) return;
      state.bindOpen = false;
      if (state.draft) renderBindUI(state.draft);
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
    closePreview();
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
