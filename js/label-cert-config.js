/**
 * 样品标签 / 合格证模版配置（原型）
 * localStorage key: lims.labelCertConfig
 */
(function (global) {
  var STORAGE_KEY = 'lims.labelCertConfig';
  var DEFAULT_ORG = '杭州数蚕智能科技有限公司';

  var CATEGORIES = [
    { key: 'aqgqj', name: '安全工器具类' },
    { key: 'dlwz', name: '电力物资类' },
    { key: 'hjjc', name: '环境检测' },
    { key: 'gcjc', name: '工程检测' }
  ];

  /** 系统 Logo（合格证品牌区，图1） */
  var SYSTEM_LOGO_URL = 'assets/label-cert/system-logo.png';
  /** 配置中上传的机构检测章（图8） */
  var SYSTEM_SEAL_URL = 'assets/label-cert/system-seal.svg';

  var FIELD_UNDERLINE_STYLES = [
    { id: 'none', name: '无' },
    { id: 'solid', name: '直线' },
    { id: 'dotted', name: '断点' },
    { id: 'dashed', name: '断线' }
  ];

  /**
   * 大类下样品树（分类层级 → 叶节点），绑定 UI 按层级展示
   */
  var SAMPLE_TREE = {
    aqgqj: [
      {
        id: 'std_976', name: 'DLT 976-2017',
        children: [
          { id: 'belt976', name: '安全带' },
          { id: 'rope1476', name: '安全绳' }
        ]
      },
      {
        id: 'std_1476', name: 'DLT 1476-2017',
        children: [
          { id: 'rod', name: '绝缘操作杆' },
          { id: 'ladder', name: '绝缘软梯' },
          { id: 'helmet', name: '安全帽' },
          { id: 'board1476', name: '登高板' },
          { id: 'spur', name: '登杆脚扣' },
          { id: 'sling', name: '吊装带' },
          { id: 'shackle', name: '卸扣' }
        ]
      }
    ],
    dlwz: [
      {
        id: 'dlwz_cable', name: '电缆类',
        children: [{ id: 'cable', name: '电力电缆' }]
      },
      {
        id: 'dlwz_eq', name: '设备类',
        children: [{ id: 'transformer', name: '变压器' }]
      }
    ],
    hjjc: [],
    gcjc: [
      {
        id: 'gcjc_cement', name: '通用硅酸盐水泥',
        children: [
          { id: 'p', name: '硅酸盐水泥' },
          { id: 'po', name: '普通硅酸盐水泥' }
        ]
      }
    ]
  };

  function flattenSampleLeaves(tree) {
    var out = [];
    (tree || []).forEach(function (group) {
      (group.children || []).forEach(function (leaf) {
        out.push({ id: leaf.id, name: leaf.name, groupId: group.id, groupName: group.name });
      });
    });
    return out;
  }

  var SAMPLE_LEAVES = {
    aqgqj: flattenSampleLeaves(SAMPLE_TREE.aqgqj),
    dlwz: flattenSampleLeaves(SAMPLE_TREE.dlwz),
    hjjc: flattenSampleLeaves(SAMPLE_TREE.hjjc),
    gcjc: flattenSampleLeaves(SAMPLE_TREE.gcjc)
  };

  var CERT_FIELD_POOL = [
    { id: 'sampleName', label: '试样名称' },
    { id: 'specModel', label: '规格型号' },
    { id: 'specimenNo', label: '试样编号' },
    { id: 'inspectors', label: '检查员' },
    { id: 'inspectDate', label: '本次检测日期' },
    { id: 'reinspectDate', label: '下次检测日期' },
    { id: 'validUntil', label: '检测有效期' }
  ];

  /** 样品标签检测状态枚举 */
  var LABEL_DETECT_STATUS = ['未检测', '检测中', '已检测'];

  var LABEL_FIELD_POOL = [
    { id: 'sampleNo', label: '样品编号' },
    { id: 'entrustNo', label: '委托编号' },
    { id: 'sampleName', label: '样品名称' },
    { id: 'specModel', label: '型号规格' },
    { id: 'receiveDate', label: '收样日期' },
    { id: 'clientName', label: '送检单位' },
    { id: 'detectStatus', label: '检测状态' }
  ];

  var PRESETS = {
    cert_style_1: {
      type: 'certificate',
      name: '不粘胶纸·字段表',
      paper: { wMm: 65, hMm: 45 },
      title: '安全工器具试验合格证',
      qr: { enabled: false, sizePx: 64, payloadType: 'cert_shortlink', placement: 'none' },
      showWatermarkGe: false,
      footerWarning: null,
      fieldIds: ['sampleName', 'specimenNo', 'inspectDate', 'reinspectDate', 'inspectors'],
      watermarkDefault: {
        enabled: true, type: 'seal', sealMode: 'system', text: '试验专用章',
        opacity: 0.42, angle: -12, position: 'center', size: 'lg', layout: 'single', color: '#dc2626'
      },
      styleDefault: {
        fieldAlign: 'left', fieldFontSize: 12, fieldColor: '#1e293b',
        fieldUnderline: true, fieldUnderlineStyle: 'solid',
        borderEnabled: true, borderColor: '#2e7d32', borderWidthPx: 2,
        titleBgColor: '#2e7d32', footerBgColor: '#f1f8e9'
      }
    },
    cert_style_2: {
      type: 'certificate',
      name: 'PVC·悬挂中置码',
      paper: { wMm: 50, hMm: 25 },
      title: '检验合格证',
      qr: { enabled: true, sizePx: 64, payloadType: 'cert_shortlink', placement: 'center' },
      showWatermarkGe: false,
      footerWarning: '无法扫码视为过期',
      fieldIds: ['validUntil', 'sampleName', 'specimenNo'],
      styleDefault: {
        fieldAlign: 'center', fieldFontSize: 11, fieldColor: '#1e293b',
        fieldUnderline: true, fieldUnderlineStyle: 'dotted',
        borderEnabled: true, borderColor: '#cbd5e1', borderWidthPx: 1,
        titleBgColor: '#ffffff', footerBgColor: '#fff8f6'
      }
    },
    cert_style_3: {
      type: 'certificate',
      name: '左文右码',
      paper: { wMm: 90, hMm: 50 },
      title: '合 格 证',
      qr: { enabled: true, sizePx: 100, payloadType: 'cert_shortlink', placement: 'right' },
      showWatermarkGe: false,
      footerWarning: null,
      fieldIds: ['specimenNo', 'sampleName', 'specModel', 'inspectDate', 'reinspectDate', 'inspectors'],
      styleDefault: {
        fieldAlign: 'left', fieldFontSize: 12, fieldColor: '#1e293b',
        fieldUnderline: true, fieldUnderlineStyle: 'dotted',
        borderEnabled: true, borderColor: '#cbd5e1', borderWidthPx: 1,
        titleBgColor: '#ffffff', footerBgColor: '#ffffff'
      }
    },
    label_style_1: {
      type: 'sample_label',
      name: '左文右码（流转）',
      paper: { wMm: 60, hMm: 40 },
      title: '',
      qr: { enabled: true, sizePx: 90, payloadType: 'sample_flow', placement: 'right' },
      showWatermarkGe: false,
      footerWarning: null,
      // 默认字段包对齐项目部约定（不含委托编号；可在字段池中自行勾选）
      fieldIds: ['sampleNo', 'sampleName', 'specModel', 'receiveDate', 'clientName', 'detectStatus']
    }
  };

  function uid(prefix) {
    return (prefix || 'tpl') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function poolForType(type) {
    return type === 'sample_label' ? LABEL_FIELD_POOL : CERT_FIELD_POOL;
  }

  function buildFieldsFromPreset(presetId) {
    var preset = PRESETS[presetId];
    var pool = poolForType(preset.type);
    var map = {};
    pool.forEach(function (f) { map[f.id] = f.label; });
    return preset.fieldIds.map(function (id) {
      return { id: id, label: map[id] || id, visible: true };
    });
  }

  var WATERMARK_POSITIONS = [
    { id: 'top_left', name: '左上' },
    { id: 'top', name: '上方' },
    { id: 'top_right', name: '右上' },
    { id: 'left', name: '左侧' },
    { id: 'center', name: '居中' },
    { id: 'right', name: '右侧' },
    { id: 'bottom_left', name: '左下' },
    { id: 'bottom', name: '下方' },
    { id: 'bottom_right', name: '右下' }
  ];

  function defaultStyle(presetId, preset) {
    preset = preset || (presetId && PRESETS[presetId]) || null;
    var isStick = presetId === 'cert_style_1';
    var from = (preset && preset.styleDefault) || {};
    return {
      marginMm: 2,
      fieldAlign: from.fieldAlign || 'left',
      fieldFontSize: from.fieldFontSize != null ? from.fieldFontSize : 12,
      fieldColor: from.fieldColor || '#1e293b',
      fieldUnderline: from.fieldUnderline !== false,
      fieldUnderlineStyle: from.fieldUnderlineStyle || 'dotted',
      borderEnabled: from.borderEnabled !== false,
      borderColor: from.borderColor || (isStick ? '#2e7d32' : '#cbd5e1'),
      borderWidthPx: from.borderWidthPx != null ? from.borderWidthPx : (isStick ? 2 : 1),
      titleBgColor: from.titleBgColor || (isStick ? '#2e7d32' : '#ffffff'),
      footerBgColor: from.footerBgColor || (isStick ? '#f1f8e9' : '#ffffff')
    };
  }

  function normalizeUnderlineStyle(v, fallback) {
    if (v === 'double') v = 'solid'; // 已移除双线，旧数据回落直线
    var ok = FIELD_UNDERLINE_STYLES.some(function (s) { return s.id === v; });
    return ok ? v : fallback;
  }

  function normalizeStyle(style, presetId) {
    var d = defaultStyle(presetId, PRESETS[presetId]);
    style = style || {};
    var underlineOn = style.fieldUnderline != null ? !!style.fieldUnderline : d.fieldUnderline;
    var uStyle = normalizeUnderlineStyle(style.fieldUnderlineStyle, d.fieldUnderlineStyle);
    if (!underlineOn) uStyle = 'none';
    if (uStyle === 'none') underlineOn = false;
    return {
      marginMm: clampInt(style.marginMm != null ? style.marginMm : d.marginMm, 0, 10, d.marginMm),
      fieldAlign: normalizeAlign(style.fieldAlign, d.fieldAlign),
      fieldFontSize: clampInt(style.fieldFontSize, 8, 22, d.fieldFontSize),
      fieldColor: normalizeColor(style.fieldColor, d.fieldColor),
      fieldUnderline: underlineOn,
      fieldUnderlineStyle: uStyle,
      borderEnabled: style.borderEnabled != null ? !!style.borderEnabled : d.borderEnabled,
      borderColor: normalizeColor(style.borderColor, d.borderColor),
      borderWidthPx: clampInt(style.borderWidthPx, 0, 8, d.borderWidthPx),
      titleBgColor: normalizeColor(style.titleBgColor || d.titleBgColor, d.titleBgColor || '#ffffff'),
      footerBgColor: normalizeColor(style.footerBgColor || d.footerBgColor, d.footerBgColor || '#ffffff')
    };
  }

  function defaultWatermark(preset) {
    var isLabel = !!(preset && preset.type === 'sample_label');
    if (preset && preset.watermarkDefault) {
      var wd = preset.watermarkDefault;
      return {
        enabled: wd.enabled !== false,
        type: wd.type === 'seal' ? 'seal' : 'text',
        text: wd.text || '试验专用章',
        color: wd.color || '#dc2626',
        sealMode: wd.sealMode === 'custom' ? 'custom' : 'system',
        sealUrl: wd.sealUrl || null,
        opacity: wd.opacity != null ? wd.opacity : 0.34,
        angle: wd.angle != null ? wd.angle : -8,
        position: wd.position || 'center',
        size: wd.size || 'lg',
        layout: wd.layout === 'tile' ? 'tile' : 'single'
      };
    }
    var fromGe = !!(preset && preset.showWatermarkGe);
    return {
      enabled: isLabel ? false : fromGe,
      type: 'text',           // text | seal
      text: isLabel ? '样品标签' : (fromGe ? '格' : '合格'),
      color: '#16a34a',
      sealMode: 'system',     // system | custom
      sealUrl: null,
      opacity: fromGe ? 0.18 : 0.22,
      angle: isLabel ? -28 : (fromGe ? 0 : -28),
      position: isLabel ? 'center' : (fromGe ? 'right' : 'center'),
      size: fromGe ? 'lg' : 'md', // sm | md | lg
      layout: 'single'        // single | tile
    };
  }

  function clampInt(n, min, max, fallback) {
    n = Number(n);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function normalizeColor(c, fallback) {
    c = String(c == null ? '' : c).trim();
    if (/^#[0-9a-fA-F]{6}$/.test(c) || /^#[0-9a-fA-F]{3}$/.test(c)) return c;
    return fallback;
  }

  function defaultBrandType() {
    return {
      orgFontSize: 12,
      orgColor: '#1e293b',
      orgAlign: 'center',
      titleFontSize: 14,
      titleColor: '#1e293b',
      titleAlign: 'center',
      logoSize: 28,
      warnFontSize: 10,
      warnColor: '#dc2626',
      warnAlign: 'center'
    };
  }

  function normalizeAlign(v, fallback) {
    return (v === 'left' || v === 'center' || v === 'right') ? v : fallback;
  }

  function normalizeBrandType(brand) {
    var d = defaultBrandType();
    brand = brand || {};
    return {
      orgFontSize: clampInt(brand.orgFontSize, 8, 28, d.orgFontSize),
      orgColor: normalizeColor(brand.orgColor, d.orgColor),
      orgAlign: normalizeAlign(brand.orgAlign, d.orgAlign),
      titleFontSize: clampInt(brand.titleFontSize, 10, 32, d.titleFontSize),
      titleColor: normalizeColor(brand.titleColor, d.titleColor),
      titleAlign: normalizeAlign(brand.titleAlign, d.titleAlign),
      logoSize: clampInt(brand.logoSize, 10, 40, d.logoSize),
      warnFontSize: clampInt(brand.warnFontSize, 8, 20, d.warnFontSize),
      warnColor: normalizeColor(brand.warnColor, d.warnColor),
      warnAlign: normalizeAlign(brand.warnAlign, d.warnAlign)
    };
  }

  function normalizeWatermark(wm, brand, preset) {
    var base = defaultWatermark(preset);
    // 兼容旧字段 showWatermarkGe
    if ((!wm || typeof wm !== 'object') && brand && brand.showWatermarkGe) {
      wm = { enabled: true, type: 'text', text: '格', color: '#16a34a', position: 'right', size: 'lg', angle: 0, opacity: 0.18, layout: 'single' };
    }
    wm = wm && typeof wm === 'object' ? wm : {};
    var hasType = wm.type === 'seal' || wm.type === 'text';
    var type = hasType ? wm.type : base.type;
    var pos = wm.position || base.position;
    var validPos = WATERMARK_POSITIONS.some(function (p) { return p.id === pos; });
    if (!validPos) pos = base.position || 'center';
    var size = (wm.size === 'sm' || wm.size === 'md' || wm.size === 'lg') ? wm.size : (base.size || 'md');
    var opacity = Number(wm.opacity);
    if (isNaN(opacity)) opacity = base.opacity;
    opacity = Math.max(0.05, Math.min(0.8, opacity));
    var angle = Number(wm.angle);
    if (isNaN(angle)) angle = base.angle;
    angle = Math.max(-90, Math.min(90, Math.round(angle)));
    var layout = wm.layout === 'tile' || wm.layout === 'single' ? wm.layout : (base.layout || 'single');
    return {
      enabled: wm.enabled != null ? !!wm.enabled : !!base.enabled,
      type: type === 'seal' ? 'seal' : 'text',
      text: (wm.text != null ? String(wm.text) : base.text).slice(0, 24),
      color: normalizeColor(wm.color, base.color || '#16a34a'),
      sealMode: wm.sealMode === 'custom' ? 'custom' : (wm.sealMode === 'system' ? 'system' : base.sealMode),
      sealUrl: wm.sealUrl || null,
      opacity: opacity,
      angle: angle,
      position: pos,
      size: size,
      layout: layout === 'tile' ? 'tile' : 'single'
    };
  }

  function createTemplate(opts) {
    opts = opts || {};
    var presetId = opts.layoutPreset || (opts.type === 'sample_label' ? 'label_style_1' : 'cert_style_3');
    var preset = PRESETS[presetId];
    var isLabel = preset.type === 'sample_label' || opts.type === 'sample_label';
    var brandIn = opts.brand || {};
    var watermark = normalizeWatermark(brandIn.watermark, brandIn, preset);
    var typeStyle = normalizeBrandType(brandIn);
    var orgName;
    if (brandIn.orgName != null) orgName = brandIn.orgName;
    else orgName = isLabel ? '' : DEFAULT_ORG;
    var title;
    if (brandIn.title != null) title = brandIn.title;
    else title = isLabel ? '' : preset.title;
    var logoMode = brandIn.logoMode || (isLabel ? 'hidden' : 'system');
    if (logoMode === 'custom') logoMode = 'system';
    return {
      id: opts.id || uid('tpl'),
      name: opts.name || (preset.name + '模版'),
      enabled: opts.enabled !== false,
      updatedAt: opts.updatedAt || formatNow(),
      layoutPreset: presetId,
      paper: clone(opts.paper || preset.paper),
      style: normalizeStyle(opts.style || {}, presetId),
      brand: {
        orgName: orgName,
        title: title,
        logoMode: logoMode,
        logoUrl: brandIn.logoUrl || null,
        showWatermarkGe: watermark.enabled && watermark.type === 'text' && watermark.text === '格',
        footerWarning: isLabel ? null : (brandIn.footerWarning != null ? brandIn.footerWarning : preset.footerWarning),
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
      },
      fields: opts.fields || buildFieldsFromPreset(presetId),
      qr: clone(opts.qr || preset.qr),
      meta: opts.meta || { material: '', mount: '', printMethod: '' },
      bindSampleIds: opts.bindSampleIds || []
    };
  }

  function formatNow() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function emptyBucket() {
    return { templates: [], defaultTemplateId: null };
  }

  function buildDefaultConfig() {
    var cfg = {};
    CATEGORIES.forEach(function (c) {
      cfg[c.key] = {
        sample_label: emptyBucket(),
        certificate: emptyBucket()
      };
    });

    // 安全工器具类：1 个默认兜底 + 若干个性化（绑样品）
    var lr = createTemplate({
      id: 'tpl_aq_lr',
      name: '左文右码合格证（默认）',
      layoutPreset: 'cert_style_3',
      enabled: true,
      bindSampleIds: []
    });
    var stick = createTemplate({
      id: 'tpl_aq_stick',
      name: '不粘胶纸合格证',
      layoutPreset: 'cert_style_1',
      bindSampleIds: ['rod', 'ladder', 'helmet', 'board1476', 'spur', 'sling', 'shackle'],
      meta: { material: '不粘胶纸', mount: '粘贴', printMethod: '喷墨' }
    });
    var hang = createTemplate({
      id: 'tpl_aq_hang',
      name: 'PVC悬挂合格证',
      layoutPreset: 'cert_style_2',
      bindSampleIds: ['belt976', 'rope1476'],
      meta: { material: 'PVC', mount: '悬挂', printMethod: '喷墨' }
    });
    var label = createTemplate({
      id: 'tpl_aq_label',
      name: '样品标签（默认）',
      type: 'sample_label',
      layoutPreset: 'label_style_1',
      enabled: true,
      bindSampleIds: []
    });

    cfg.aqgqj.certificate.templates = [lr, stick, hang];
    cfg.aqgqj.certificate.defaultTemplateId = 'tpl_aq_lr';
    cfg.aqgqj.sample_label.templates = [label];
    cfg.aqgqj.sample_label.defaultTemplateId = 'tpl_aq_label';

    // 其他大类仅默认模版（无个性化覆盖）
    ['dlwz', 'hjjc', 'gcjc'].forEach(function (k) {
      var c3 = createTemplate({
        id: 'tpl_' + k + '_cert',
        name: '左文右码合格证（默认）',
        layoutPreset: 'cert_style_3',
        enabled: true,
        bindSampleIds: []
      });
      var lb = createTemplate({
        id: 'tpl_' + k + '_label',
        name: '样品标签（默认）',
        type: 'sample_label',
        layoutPreset: 'label_style_1',
        enabled: true,
        bindSampleIds: []
      });
      cfg[k].certificate.templates = [c3];
      cfg[k].certificate.defaultTemplateId = c3.id;
      cfg[k].sample_label.templates = [lb];
      cfg[k].sample_label.defaultTemplateId = lb.id;
    });

    return cfg;
  }

  function findTemplate(bucket, id) {
    var rows = bucket.templates || [];
    for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
    return null;
  }

  function isDefaultTemplate(bucket, tplOrId) {
    if (!bucket || !bucket.defaultTemplateId) return false;
    var id = typeof tplOrId === 'string' ? tplOrId : (tplOrId && tplOrId.id);
    return !!id && bucket.defaultTemplateId === id;
  }

  function normalizeLabelFields(tpl) {
    if (!tpl) return tpl;
    var preset = PRESETS[tpl.layoutPreset];
    if (!preset || preset.type !== 'sample_label') return tpl;
    // 尊重模版配置中的字段槽位：不再强制回填委托编号等已移除字段
    tpl.fields = (tpl.fields || []).filter(function (f) { return f.id !== 'qrCode'; });
    if (!tpl.brand) tpl.brand = {};
    tpl.brand.footerWarning = null;
    // 旧默认「机构名+系统Logo」迁移为标签默认不展示品牌
    if ((tpl.brand.orgName === DEFAULT_ORG || tpl.brand.orgName == null) &&
        (!tpl.brand.logoMode || tpl.brand.logoMode === 'system') &&
        !tpl.brand.title) {
      tpl.brand.orgName = '';
      tpl.brand.title = '';
      tpl.brand.logoMode = 'hidden';
    }
    if (!tpl.brand.watermark || typeof tpl.brand.watermark !== 'object') {
      tpl.brand.watermark = defaultWatermark(preset);
    } else if (!tpl.brand.watermark.text || tpl.brand.watermark.text === '合格' || tpl.brand.watermark.text === '格') {
      if (!tpl.brand.watermark.enabled) tpl.brand.watermark.text = '样品标签';
    }
    return tpl;
  }

  function normalizeTemplateBrand(tpl) {
    if (!tpl) return tpl;
    if (!tpl.brand) tpl.brand = {};
    var preset = PRESETS[tpl.layoutPreset] || PRESETS.cert_style_3;
    tpl.brand.watermark = normalizeWatermark(tpl.brand.watermark, tpl.brand, preset);
    tpl.brand.showWatermarkGe = !!(tpl.brand.watermark.enabled && tpl.brand.watermark.type === 'text' && tpl.brand.watermark.text === '格');
    var ts = normalizeBrandType(tpl.brand);
    tpl.brand.orgFontSize = ts.orgFontSize;
    tpl.brand.orgColor = ts.orgColor;
    tpl.brand.orgAlign = ts.orgAlign;
    tpl.brand.titleFontSize = ts.titleFontSize;
    tpl.brand.titleColor = ts.titleColor;
    tpl.brand.titleAlign = ts.titleAlign;
    tpl.brand.logoSize = ts.logoSize;
    tpl.brand.warnFontSize = ts.warnFontSize;
    tpl.brand.warnColor = ts.warnColor;
    tpl.brand.warnAlign = ts.warnAlign;
    if (tpl.brand.logoMode === 'custom') tpl.brand.logoMode = 'system';
    tpl.style = normalizeStyle(tpl.style, tpl.layoutPreset);
    if (tpl.id === 'tpl_aq_stick' || /不粘胶纸合格证[（(]/.test(tpl.name || '')) {
      tpl.name = '不粘胶纸合格证';
    }
    normalizeLabelFields(tpl);
    normalizeCertFields(tpl);
    return tpl;
  }

  function normalizeCertFields(tpl) {
    if (!tpl) return tpl;
    var preset = PRESETS[tpl.layoutPreset];
    if (!preset || preset.type !== 'certificate') return tpl;
    tpl.fields = (tpl.fields || []).filter(function (f) { return f.id !== 'qrCode'; });
    // 不粘胶纸·字段表：旧默认文本水印迁移为圆形试验专用章
    if (tpl.layoutPreset === 'cert_style_1' && preset.watermarkDefault) {
      var wm = tpl.brand && tpl.brand.watermark;
      var legacyText = !wm || (wm.type === 'text' && (!wm.text || wm.text === '合格' || wm.text === '格'));
      if (legacyText) {
        var keep = wm && wm.sealUrl;
        tpl.brand.watermark = defaultWatermark(preset);
        if (keep) {
          tpl.brand.watermark.sealUrl = keep;
          tpl.brand.watermark.sealMode = 'custom';
        }
      }
    }
    return tpl;
  }

  /**
   * 保证每桶恰有 1 个默认：永启用、不绑样品。
   * 缺省时优先选无绑定行，否则新建。
   */
  function ensureBucketShape(bucket, type) {
    if (!bucket.templates) bucket.templates = [];
    var def = bucket.defaultTemplateId ? findTemplate(bucket, bucket.defaultTemplateId) : null;
    if (!def) {
      for (var i = 0; i < bucket.templates.length; i++) {
        if (!(bucket.templates[i].bindSampleIds || []).length) {
          def = bucket.templates[i];
          break;
        }
      }
    }
    if (!def && bucket.templates.length) def = bucket.templates[0];
    if (!def) {
      def = createTemplate({
        type: type,
        name: type === 'sample_label' ? '样品标签（默认）' : '合格证（默认）',
        layoutPreset: type === 'sample_label' ? 'label_style_1' : 'cert_style_3',
        enabled: true,
        bindSampleIds: []
      });
      bucket.templates.unshift(def);
    }
    bucket.defaultTemplateId = def.id;
    def.enabled = true;
    def.bindSampleIds = [];
    bucket.templates.forEach(normalizeTemplateBrand);
    return bucket;
  }

  function normalizeConfig(cfg) {
    CATEGORIES.forEach(function (c) {
      ['certificate', 'sample_label'].forEach(function (type) {
        ensureBucketShape(getBucket(cfg, c.key, type), type);
      });
    });
    return cfg;
  }

  /** 一次性：去掉历史上强制回填的「委托编号」，对齐默认字段包；需要时可在字段池重新勾选 */
  function migrateStripForcedEntrustNo(cfg) {
    if (!cfg || cfg._migrateLabelFieldsV2) return cfg;
    CATEGORIES.forEach(function (c) {
      var bucket = getBucket(cfg, c.key, 'sample_label');
      (bucket.templates || []).forEach(function (tpl) {
        if (!tpl || !tpl.fields) return;
        tpl.fields = tpl.fields.filter(function (f) { return f.id !== 'entrustNo'; });
      });
    });
    cfg._migrateLabelFieldsV2 = 1;
    return cfg;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          migrateStripForcedEntrustNo(parsed);
          normalizeConfig(parsed);
          save(parsed);
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }
    var cfg = buildDefaultConfig();
    cfg._migrateLabelFieldsV2 = 1;
    normalizeConfig(cfg);
    save(cfg);
    return cfg;
  }

  function save(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function resetDefaults() {
    var cfg = buildDefaultConfig();
    save(cfg);
    return cfg;
  }

  function getBucket(cfg, catKey, type) {
    if (!cfg[catKey]) cfg[catKey] = { sample_label: emptyBucket(), certificate: emptyBucket() };
    if (!cfg[catKey][type]) cfg[catKey][type] = emptyBucket();
    return cfg[catKey][type];
  }

  function resolveTemplate(catKey, type, sampleMasterId) {
    var cfg = load();
    var bucket = ensureBucketShape(getBucket(cfg, catKey, type), type);
    var defId = bucket.defaultTemplateId;
    // 个性化：启用且已绑样品
    if (sampleMasterId) {
      for (var i = 0; i < bucket.templates.length; i++) {
        var t = bucket.templates[i];
        if (!t.enabled || t.id === defId) continue;
        if ((t.bindSampleIds || []).indexOf(sampleMasterId) !== -1) return t;
      }
    }
    // 未命中 / 个性化停用 → 默认（始终可用）
    return findTemplate(bucket, defId) || null;
  }

  /** 名称 → 样品主数据 id（演示映射） */
  var NAME_TO_MASTER = {
    '绝缘操作杆': 'rod',
    '绝缘软梯': 'ladder',
    '安全带': 'belt976',
    '安全绳': 'rope1476',
    '安全帽': 'helmet',
    '登高板': 'board1476',
    '登杆脚扣': 'spur',
    '吊装带': 'sling',
    '卸扣': 'shackle',
    // 未绑个性化 → 走默认合格证版式（左文右码）演示
    '验电器': 'electroscope',
    '绝缘毯': 'blanket',
    '卡线器': 'shackle'
  };

  function masterIdFromName(name) {
    return NAME_TO_MASTER[name] || null;
  }

  function getInspectorMax() {
    try {
      var raw = localStorage.getItem('lims.paramOverrides');
      if (raw) {
        var map = JSON.parse(raw);
        if (map['cert.inspector.max']) return Math.max(1, parseInt(map['cert.inspector.max'], 10) || 2);
      }
    } catch (e) { /* ignore */ }
    return 2;
  }

  function findBindConflicts(catKey, type, templateId, bindSampleIds) {
    var cfg = load();
    var bucket = ensureBucketShape(getBucket(cfg, catKey, type), type);
    var conflicts = [];
    (bucket.templates || []).forEach(function (t) {
      // 默认不参与绑定冲突；仅与其他「启用的个性化」冲突
      if (!t.enabled || t.id === templateId || t.id === bucket.defaultTemplateId) return;
      (t.bindSampleIds || []).forEach(function (sid) {
        if (bindSampleIds.indexOf(sid) !== -1) {
          conflicts.push({ sampleId: sid, templateId: t.id, templateName: t.name });
        }
      });
    });
    return conflicts;
  }

  global.LabelCertConfig = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_ORG: DEFAULT_ORG,
    CATEGORIES: CATEGORIES,
    SAMPLE_LEAVES: SAMPLE_LEAVES,
    SAMPLE_TREE: SAMPLE_TREE,
    SYSTEM_LOGO_URL: SYSTEM_LOGO_URL,
    SYSTEM_SEAL_URL: SYSTEM_SEAL_URL,
    FIELD_UNDERLINE_STYLES: FIELD_UNDERLINE_STYLES,
    CERT_FIELD_POOL: CERT_FIELD_POOL,
    LABEL_FIELD_POOL: LABEL_FIELD_POOL,
    LABEL_DETECT_STATUS: LABEL_DETECT_STATUS,
    PRESETS: PRESETS,
    load: load,
    save: save,
    resetDefaults: resetDefaults,
    getBucket: getBucket,
    ensureBucketShape: ensureBucketShape,
    normalizeConfig: normalizeConfig,
    findTemplate: findTemplate,
    isDefaultTemplate: isDefaultTemplate,
    resolveTemplate: resolveTemplate,
    createTemplate: createTemplate,
    buildFieldsFromPreset: buildFieldsFromPreset,
    poolForType: poolForType,
    masterIdFromName: masterIdFromName,
    getInspectorMax: getInspectorMax,
    findBindConflicts: findBindConflicts,
    defaultWatermark: defaultWatermark,
    normalizeWatermark: normalizeWatermark,
    normalizeBrandType: normalizeBrandType,
    defaultBrandType: defaultBrandType,
    defaultStyle: defaultStyle,
    normalizeStyle: normalizeStyle,
    normalizeTemplateBrand: normalizeTemplateBrand,
    WATERMARK_POSITIONS: WATERMARK_POSITIONS,
    formatNow: formatNow,
    uid: uid,
    clone: clone
  };
})(window);
