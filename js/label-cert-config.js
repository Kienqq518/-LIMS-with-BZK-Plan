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

  /** 大类下可选样品叶节点（与样品数据树对齐的演示子集） */
  var SAMPLE_LEAVES = {
    aqgqj: [
      { id: 'rod', name: '绝缘操作杆' },
      { id: 'ladder', name: '绝缘软梯' },
      { id: 'belt976', name: '安全带' },
      { id: 'rope1476', name: '安全绳' },
      { id: 'helmet', name: '安全帽' },
      { id: 'board1476', name: '登高板' },
      { id: 'spur', name: '登杆脚扣' },
      { id: 'sling', name: '吊装带' },
      { id: 'shackle', name: '卸扣' }
    ],
    dlwz: [
      { id: 'cable', name: '电力电缆' },
      { id: 'transformer', name: '变压器' }
    ],
    hjjc: [],
    gcjc: [
      { id: 'p', name: '硅酸盐水泥' },
      { id: 'po', name: '普通硅酸盐水泥' }
    ]
  };

  var CERT_FIELD_POOL = [
    { id: 'sampleName', label: '试样名称' },
    { id: 'specModel', label: '规格型号' },
    { id: 'specimenNo', label: '试样编号' },
    { id: 'inspectors', label: '检查员' },
    { id: 'inspectDate', label: '本次检测日期' },
    { id: 'reinspectDate', label: '下次检测日期' },
    { id: 'validUntil', label: '检测有效期' },
    { id: 'qrCode', label: '二维码' }
  ];

  var LABEL_FIELD_POOL = [
    { id: 'sampleNo', label: '样品编号' },
    { id: 'sampleName', label: '样品名称' },
    { id: 'specModel', label: '型号规格' },
    { id: 'receiveDate', label: '收样日期' },
    { id: 'clientName', label: '送检单位' },
    { id: 'detectStatus', label: '检测状态' },
    { id: 'qrCode', label: '二维码' }
  ];

  var PRESETS = {
    cert_style_1: {
      type: 'certificate',
      name: '不粘胶纸·字段表',
      paper: { wMm: 65, hMm: 30 },
      title: '检验合格证',
      qr: { enabled: true, sizePx: 72, payloadType: 'cert_shortlink', placement: 'corner' },
      showWatermarkGe: true,
      footerWarning: null,
      fieldIds: ['sampleName', 'specModel', 'specimenNo', 'inspectors', 'inspectDate', 'reinspectDate']
    },
    cert_style_2: {
      type: 'certificate',
      name: 'PVC·悬挂中置码',
      paper: { wMm: 50, hMm: 25 },
      title: '检验合格证',
      qr: { enabled: true, sizePx: 64, payloadType: 'cert_shortlink', placement: 'center' },
      showWatermarkGe: false,
      footerWarning: '无法扫码视为过期',
      fieldIds: ['validUntil', 'qrCode']
    },
    cert_style_3: {
      type: 'certificate',
      name: '左文右码',
      paper: { wMm: 90, hMm: 50 },
      title: '合 格 证',
      qr: { enabled: true, sizePx: 100, payloadType: 'cert_shortlink', placement: 'right' },
      showWatermarkGe: false,
      footerWarning: null,
      fieldIds: ['specimenNo', 'sampleName', 'specModel', 'inspectDate', 'reinspectDate', 'inspectors', 'qrCode']
    },
    label_style_1: {
      type: 'sample_label',
      name: '左文右码（流转）',
      paper: { wMm: 60, hMm: 40 },
      title: '',
      qr: { enabled: true, sizePx: 90, payloadType: 'sample_flow', placement: 'right' },
      showWatermarkGe: false,
      footerWarning: null,
      fieldIds: ['sampleNo', 'sampleName', 'specModel', 'receiveDate', 'clientName', 'detectStatus', 'qrCode']
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

  function defaultWatermark(preset) {
    var fromGe = !!(preset && preset.showWatermarkGe);
    return {
      enabled: fromGe,
      type: 'text',           // text | seal
      text: fromGe ? '格' : '合格',
      sealMode: 'system',     // system | custom
      sealUrl: null,
      opacity: fromGe ? 0.18 : 0.22,
      angle: fromGe ? 0 : -28,
      position: fromGe ? 'right' : 'center',
      size: fromGe ? 'lg' : 'md', // sm | md | lg
      layout: 'single'        // single | tile
    };
  }

  function normalizeWatermark(wm, brand, preset) {
    var base = defaultWatermark(preset);
    // 兼容旧字段 showWatermarkGe
    if ((!wm || typeof wm !== 'object') && brand && brand.showWatermarkGe) {
      wm = { enabled: true, type: 'text', text: '格', position: 'right', size: 'lg', angle: 0, opacity: 0.18, layout: 'single' };
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
    var brandIn = opts.brand || {};
    var watermark = normalizeWatermark(brandIn.watermark, brandIn, preset);
    return {
      id: opts.id || uid('tpl'),
      name: opts.name || (preset.name + '模版'),
      enabled: opts.enabled !== false,
      updatedAt: opts.updatedAt || formatNow(),
      layoutPreset: presetId,
      paper: clone(opts.paper || preset.paper),
      style: opts.style || { fontScale: 'normal', marginMm: 2 },
      brand: {
        orgName: brandIn.orgName || DEFAULT_ORG,
        title: brandIn.title != null ? brandIn.title : preset.title,
        logoMode: brandIn.logoMode || 'system',
        logoUrl: brandIn.logoUrl || null,
        showWatermarkGe: watermark.enabled && watermark.type === 'text' && watermark.text === '格',
        footerWarning: brandIn.footerWarning != null ? brandIn.footerWarning : preset.footerWarning,
        watermark: watermark
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
      name: '不粘胶纸合格证（粘贴类）',
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

  function normalizeTemplateBrand(tpl) {
    if (!tpl) return tpl;
    if (!tpl.brand) tpl.brand = {};
    var preset = PRESETS[tpl.layoutPreset] || PRESETS.cert_style_3;
    tpl.brand.watermark = normalizeWatermark(tpl.brand.watermark, tpl.brand, preset);
    tpl.brand.showWatermarkGe = !!(tpl.brand.watermark.enabled && tpl.brand.watermark.type === 'text' && tpl.brand.watermark.text === '格');
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

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          normalizeConfig(parsed);
          save(parsed);
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }
    var cfg = buildDefaultConfig();
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
    '验电器': 'rod',
    '绝缘毯': 'rod',
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
    CERT_FIELD_POOL: CERT_FIELD_POOL,
    LABEL_FIELD_POOL: LABEL_FIELD_POOL,
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
    normalizeTemplateBrand: normalizeTemplateBrand,
    WATERMARK_POSITIONS: WATERMARK_POSITIONS,
    formatNow: formatNow,
    uid: uid,
    clone: clone
  };
})(window);
