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

  function createTemplate(opts) {
    opts = opts || {};
    var presetId = opts.layoutPreset || (opts.type === 'sample_label' ? 'label_style_1' : 'cert_style_3');
    var preset = PRESETS[presetId];
    return {
      id: opts.id || uid('tpl'),
      name: opts.name || (preset.name + '模版'),
      enabled: opts.enabled !== false,
      updatedAt: opts.updatedAt || formatNow(),
      layoutPreset: presetId,
      paper: clone(opts.paper || preset.paper),
      style: opts.style || { fontScale: 'normal', marginMm: 2 },
      brand: {
        orgName: (opts.brand && opts.brand.orgName) || DEFAULT_ORG,
        title: (opts.brand && opts.brand.title != null) ? opts.brand.title : preset.title,
        logoMode: (opts.brand && opts.brand.logoMode) || 'system',
        logoUrl: (opts.brand && opts.brand.logoUrl) || null,
        showWatermarkGe: opts.brand && opts.brand.showWatermarkGe != null ? opts.brand.showWatermarkGe : !!preset.showWatermarkGe,
        footerWarning: opts.brand && opts.brand.footerWarning != null ? opts.brand.footerWarning : preset.footerWarning
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

    // 安全工器具类预置
    var stick = createTemplate({
      id: 'tpl_aq_stick',
      name: '不粘胶纸合格证（默认粘贴类）',
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
    var lr = createTemplate({
      id: 'tpl_aq_lr',
      name: '左文右码合格证（回退）',
      layoutPreset: 'cert_style_3',
      bindSampleIds: []
    });
    var label = createTemplate({
      id: 'tpl_aq_label',
      name: '样品标签（默认）',
      type: 'sample_label',
      layoutPreset: 'label_style_1',
      bindSampleIds: []
    });

    cfg.aqgqj.certificate.templates = [stick, hang, lr];
    cfg.aqgqj.certificate.defaultTemplateId = 'tpl_aq_lr';
    cfg.aqgqj.sample_label.templates = [label];
    cfg.aqgqj.sample_label.defaultTemplateId = 'tpl_aq_label';

    // 其他大类给一套左文右码 + 标签默认
    ['dlwz', 'hjjc', 'gcjc'].forEach(function (k) {
      var c3 = createTemplate({ id: 'tpl_' + k + '_cert', name: '左文右码合格证（默认）', layoutPreset: 'cert_style_3' });
      var lb = createTemplate({ id: 'tpl_' + k + '_label', name: '样品标签（默认）', type: 'sample_label', layoutPreset: 'label_style_1' });
      cfg[k].certificate.templates = [c3];
      cfg[k].certificate.defaultTemplateId = c3.id;
      cfg[k].sample_label.templates = [lb];
      cfg[k].sample_label.defaultTemplateId = lb.id;
    });

    return cfg;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) { /* ignore */ }
    var cfg = buildDefaultConfig();
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
    var bucket = getBucket(cfg, catKey, type);
    var enabled = (bucket.templates || []).filter(function (t) { return t.enabled; });
    var hit = null;
    if (sampleMasterId) {
      for (var i = 0; i < enabled.length; i++) {
        if ((enabled[i].bindSampleIds || []).indexOf(sampleMasterId) !== -1) {
          hit = enabled[i];
          break;
        }
      }
    }
    if (hit) return hit;
    if (bucket.defaultTemplateId) {
      for (var j = 0; j < enabled.length; j++) {
        if (enabled[j].id === bucket.defaultTemplateId) return enabled[j];
      }
    }
    return enabled[0] || null;
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
    var bucket = getBucket(cfg, catKey, type);
    var conflicts = [];
    (bucket.templates || []).forEach(function (t) {
      if (!t.enabled || t.id === templateId) return;
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
    resolveTemplate: resolveTemplate,
    createTemplate: createTemplate,
    buildFieldsFromPreset: buildFieldsFromPreset,
    poolForType: poolForType,
    masterIdFromName: masterIdFromName,
    getInspectorMax: getInspectorMax,
    findBindConflicts: findBindConflicts,
    formatNow: formatNow,
    uid: uid,
    clone: clone
  };
})(window);
