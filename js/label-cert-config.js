/**
 * 样品标签 / 合格证模版配置（原型）
 * 自由设计：paper + elements[]
 * localStorage key: lims.labelCertConfig
 */
(function (global) {
  var STORAGE_KEY = 'lims.labelCertConfig';
  var DEFAULT_ORG = '杭州数蚕智能科技有限公司';
  var SYSTEM_LOGO_URL = 'assets/label-cert/system-logo.png?v=transparent';
  var SYSTEM_SEAL_URL = 'assets/label-cert/system-seal.png';

  var CATEGORIES = [
    { key: 'aqgqj', name: '安全工器具类' },
    { key: 'dlwz', name: '电力物资类' },
    { key: 'hjjc', name: '环境检测' },
    { key: 'gcjc', name: '工程检测' }
  ];

  var FIELD_UNDERLINE_STYLES = [
    { id: 'none', name: '无' },
    { id: 'solid', name: '直线' },
    { id: 'dotted', name: '断点' },
    { id: 'dashed', name: '断线' }
  ];

  var PAPER_SIZE_PRESETS = [
    { id: 'stick_compact', name: '粘贴证（紧凑）', wMm: 65, hMm: 30 },
    { id: 'stick', name: '粘贴证', wMm: 65, hMm: 45 },
    { id: 'hang', name: '悬挂牌', wMm: 50, hMm: 25 },
    { id: 'lr', name: '左文右码', wMm: 90, hMm: 50 },
    { id: 'label', name: '样品标签', wMm: 80, hMm: 35 }
  ];

  /** 内置开源字体（Google Fonts / SIL OFL 等，无版权争议） */
  var FONT_PRESETS = [
    { id: 'default', name: '系统默认', css: '' },
    { id: 'noto-sans', name: 'Noto 黑体', css: '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif' },
    { id: 'noto-serif', name: 'Noto 宋体', css: '"Noto Serif SC","Songti SC","SimSun",serif' },
    { id: 'xiaowei', name: '站酷小薇', css: '"ZCOOL XiaoWei","PingFang SC","Microsoft YaHei",sans-serif' },
    { id: 'mashan', name: '马善政楷书', css: '"Ma Shan Zheng","KaiTi","STKaiti",cursive' }
  ];

  function fontCssById(id) {
    for (var i = 0; i < FONT_PRESETS.length; i++) {
      if (FONT_PRESETS[i].id === id) return FONT_PRESETS[i].css || '';
    }
    return '';
  }

  function normalizeFontFamily(id) {
    if (!id) return 'default';
    for (var i = 0; i < FONT_PRESETS.length; i++) {
      if (FONT_PRESETS[i].id === id) return id;
    }
    return 'default';
  }

  var ELEMENT_TYPES = {
    orgName: { category: 'brand', name: '单位名称', unique: true },
    title: { category: 'brand', name: '标题', unique: true },
    logo: { category: 'brand', name: 'Logo', unique: true },
    fieldRow: { category: 'field', name: '字段行', uniqueField: true },
    qr: { category: 'code', name: '二维码', unique: true },
    seal: { category: 'code', name: '检测章' },
    watermarkText: { category: 'code', name: '文本水印' },
    staticText: { category: 'decor', name: '静态文本' },
    line: { category: 'decor', name: '分割线' },
    hangHole: { category: 'decor', name: '悬挂孔' }
  };

  /** 逻辑分区：背景层 / 内容层 / 水印层（编辑器元件库与显隐用） */
  function inferLayerByType(type) {
    if (type === 'staticText') return 'bg';
    if (type === 'seal' || type === 'watermarkText') return 'wm';
    return 'content';
  }

  function normalizeLayer(layer, type) {
    if (type === 'seal' || type === 'watermarkText') return 'wm';
    if (type === 'staticText') {
      return layer === 'content' ? 'content' : 'bg';
    }
    return 'content';
  }

  function elementLayer(elOrType) {
    if (elOrType && typeof elOrType !== 'string') {
      return normalizeLayer(elOrType.layer, elOrType.type);
    }
    return inferLayerByType(elOrType);
  }

  var DATE_FIELD_IDS = ['inspectDate', 'reinspectDate', 'validUntil', 'receiveDate'];

  var DATE_FORMAT_PRESETS = [
    { id: 'YYYY-MM-DD', name: '2026-07-01' },
    { id: 'YYYY/MM/DD', name: '2026/07/01' },
    { id: 'YYYY.MM.DD', name: '2026.07.01' },
    { id: 'YYYY年MM月DD日', name: '2026年07月01日' },
    { id: 'YYYY年M月D日', name: '2026年7月1日' },
    { id: 'YY.MM.DD', name: '26.07.01' },
    { id: 'MM/DD/YYYY', name: '07/01/2026' },
    { id: 'DD-MM-YYYY', name: '01-07-2026' }
  ];

  function isDateFieldId(fieldId) {
    return DATE_FIELD_IDS.indexOf(fieldId) >= 0;
  }

  function normalizeDateFormat(fmt) {
    var id = String(fmt || 'YYYY-MM-DD');
    for (var i = 0; i < DATE_FORMAT_PRESETS.length; i++) {
      if (DATE_FORMAT_PRESETS[i].id === id) return id;
    }
    return 'YYYY-MM-DD';
  }

  var PERSONNEL_FIELD_IDS = ['inspectors', 'recorders', 'inspectorsRecorders'];

  function isPersonnelFieldId(fieldId) {
    return PERSONNEL_FIELD_IDS.indexOf(fieldId) >= 0;
  }

  /** 兼容旧调用：检测员单项或合并位都算「检查员类」展示入口 */
  function isInspectorFieldId(fieldId) {
    return isPersonnelFieldId(fieldId);
  }

  /** 检查员展示：text=姓名文本，esign=电子签名占位 */
  function normalizeInspectorDisplay(mode) {
    return mode === 'esign' ? 'esign' : 'text';
  }

  function defaultZIndexForLayer(layer) {
    if (layer === 'bg') return 0;
    if (layer === 'wm') return 20;
    return 10;
  }

  function defaultZIndexForType(type) {
    return defaultZIndexForLayer(inferLayerByType(type));
  }

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
      { id: 'dlwz_cable', name: '电缆类', children: [{ id: 'cable', name: '电力电缆' }] },
      { id: 'dlwz_eq', name: '设备类', children: [{ id: 'transformer', name: '变压器' }] }
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

  var SPECMODEL_LABEL = '型号规格';

  var CERT_FIELD_POOL = [
    { id: 'sampleName', label: '试样名称' },
    // 与样品标签字段池同名：同一个 fieldId 在两个类型里都叫「型号规格」，不再一边「规格型号」
    { id: 'specModel', label: SPECMODEL_LABEL },
    { id: 'specimenNo', label: '试样编号' },
    { id: 'inspectors', label: '检测员' },
    { id: 'recorders', label: '记录员' },
    { id: 'inspectorsRecorders', label: '检测员/记录员' },
    { id: 'inspectDate', label: '本次检测日期' },
    { id: 'reinspectDate', label: '下次检测日期' },
    { id: 'validUntil', label: '检测有效期' },
    { id: 'clientName', label: '送检单位' }
  ];

  var LABEL_DETECT_STATUS = ['未检测', '检测中', '已检测'];

  var LABEL_FIELD_POOL = [
    { id: 'sampleNo', label: '样品编号' },
    { id: 'entrustNo', label: '委托编号' },
    { id: 'sampleName', label: '样品名称' },
    { id: 'specModel', label: SPECMODEL_LABEL },
    { id: 'receiveDate', label: '收样日期' },
    { id: 'clientName', label: '送检单位' },
    { id: 'detectStatus', label: '检测状态' }
  ];

  /** 旧布局预设 → 展开参考（仅迁移用，非 UI 选项） */
  var LEGACY_PRESETS = {
    cert_style_1: {
      type: 'certificate', name: '不粘胶纸·字段表', paper: { wMm: 65, hMm: 45 },
      title: '安全工器具试验合格证',
      fieldIds: ['sampleName', 'specimenNo', 'inspectDate', 'reinspectDate', 'inspectors'],
      qr: false, border: { enabled: true, color: '#2e7d32', widthPx: 2 }
    },
    cert_style_2: {
      type: 'certificate', name: 'PVC·悬挂中置码', paper: { wMm: 50, hMm: 25 },
      title: '检验合格证',
      fieldIds: ['validUntil'],
      qr: true, warn: '无法扫码视为过期', hangHole: true,
      border: { enabled: true, color: '#cbd5e1', widthPx: 1 }
    },
    cert_style_3: {
      type: 'certificate', name: '左文右码', paper: { wMm: 90, hMm: 50 },
      title: '合 格 证',
      fieldIds: ['specimenNo', 'sampleName', 'specModel', 'inspectDate', 'reinspectDate', 'inspectors'],
      qr: true, border: { enabled: true, color: '#cbd5e1', widthPx: 1 }
    },
    label_style_1: {
      type: 'sample_label', name: '左文右码（流转）', paper: { wMm: 80, hMm: 35 },
      title: '',
      fieldIds: ['sampleNo', 'sampleName', 'specModel', 'receiveDate', 'clientName', 'detectStatus'],
      qr: true, border: { enabled: true, color: '#cbd5e1', widthPx: 1 }
    }
  };

  function uid(prefix) {
    return (prefix || 'tpl') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function elUid() {
    return 'el_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function formatNow() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function clamp(n, min, max, fallback) {
    n = Number(n);
    if (isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function normalizeColor(v, fallback) {
    if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
    return fallback || '#1e293b';
  }

  function normalizeAlign(v, fallback) {
    if (v === 'left' || v === 'center' || v === 'right') return v;
    return fallback || 'left';
  }

  function poolForType(type) {
    return type === 'sample_label' ? LABEL_FIELD_POOL : CERT_FIELD_POOL;
  }

  function payloadTypeFor(type) {
    return type === 'sample_label' ? 'sample_flow' : 'cert_shortlink';
  }

  function templateTypeOf(tpl) {
    if (!tpl) return 'certificate';
    if (tpl._type === 'sample_label' || tpl._type === 'certificate') return tpl._type;
    if (tpl.layoutPreset && LEGACY_PRESETS[tpl.layoutPreset]) return LEGACY_PRESETS[tpl.layoutPreset].type;
    var els = tpl.elements || [];
    for (var i = 0; i < els.length; i++) {
      if (els[i].type === 'qr' && els[i].props && els[i].props.payloadType === 'sample_flow') return 'sample_label';
    }
    return 'certificate';
  }

  function defaultProps(type, opts) {
    opts = opts || {};
    var tplType = opts.tplType || 'certificate';
    switch (type) {
      case 'orgName':
        return { text: tplType === 'sample_label' ? '' : DEFAULT_ORG, fontSize: 11, fontFamily: 'default', color: '#1e293b', align: 'center' };
      case 'title':
        return { text: tplType === 'sample_label' ? '' : '检验合格证', fontSize: 13, fontFamily: 'default', color: '#1e293b', align: 'center' };
      case 'logo':
        return { source: 'system', url: null };
      case 'fieldRow': {
        var fid = opts.fieldId || 'sampleName';
        var base = {
          fieldId: fid,
          label: opts.label || '试样名称',
          showLabel: true,
          valueAlign: 'left',
          underline: 'dotted',
          fontSize: 11,
          fontFamily: 'default',
          color: '#1e293b'
        };
        if (isDateFieldId(fid)) base.dateFormat = 'YYYY-MM-DD';
        if (isInspectorFieldId(fid)) base.inspectorDisplay = 'text';
        return base;
      }
      case 'qr':
        return { payloadType: payloadTypeFor(tplType) };
      case 'seal':
        return { source: 'system', url: null, opacity: 0.42 };
      case 'watermarkText':
        return { text: '格', fontSize: 28, fontFamily: 'default', color: '#16a34a', opacity: 0.18, tile: false, align: 'center' };
      case 'staticText':
        return { text: '无法扫码视为过期', fontSize: 9, fontFamily: 'default', color: '#dc2626', opacity: 1, align: 'center' };
      case 'line':
        return { color: '#cbd5e1', widthPx: 1, style: 'solid' };
      case 'hangHole':
        return {};
      default:
        return {};
    }
  }

  function defaultBox(type, paper, opts) {
    opts = opts || {};
    var w = (paper && paper.wMm) || 90;
    var h = (paper && paper.hMm) || 50;
    switch (type) {
      case 'orgName': return { xMm: 2, yMm: 2, wMm: Math.max(20, w - 4), hMm: 5 };
      case 'title': return { xMm: 2, yMm: 7, wMm: Math.max(20, w - 4), hMm: 6 };
      case 'logo': return { xMm: 2, yMm: 2, wMm: 8, hMm: 8 };
      case 'fieldRow': {
        var idx = opts.index || 0;
        return { xMm: 2, yMm: 14 + idx * 4.5, wMm: Math.max(24, w * 0.55), hMm: 4 };
      }
      case 'qr': {
        var size = Math.min(18, h - 4, w * 0.35);
        return { xMm: Math.max(2, w - size - 2), yMm: Math.max(2, (h - size) / 2), wMm: size, hMm: size };
      }
      case 'seal': return { xMm: w * 0.55, yMm: h * 0.35, wMm: 16, hMm: 16 };
      case 'watermarkText': return { xMm: w * 0.35, yMm: h * 0.3, wMm: 20, hMm: 16 };
      case 'staticText': return { xMm: 2, yMm: h - 6, wMm: w - 4, hMm: 4 };
      case 'line': return { xMm: 2, yMm: 12, wMm: w - 4, hMm: 1 };
      case 'hangHole': return { xMm: w - 5, yMm: 1.5, wMm: 3.5, hMm: 3.5 };
      default: return { xMm: 2, yMm: 2, wMm: 20, hMm: 6 };
    }
  }

  function createElement(type, opts) {
    opts = opts || {};
    var paper = opts.paper || { wMm: 90, hMm: 50 };
    var meta = ELEMENT_TYPES[type];
    if (!meta) throw new Error('unknown element type: ' + type);
    var box = opts.box || defaultBox(type, paper, opts);
    var layer = normalizeLayer(opts.layer, type);
    var z = opts.zIndex != null ? opts.zIndex : defaultZIndexForLayer(layer);
    return {
      id: opts.id || elUid(),
      category: meta.category,
      type: type,
      layer: layer,
      xMm: clamp(box.xMm, 0, 200, 0),
      yMm: clamp(box.yMm, 0, 200, 0),
      wMm: clamp(box.wMm, 1, 200, 10),
      hMm: clamp(box.hMm, 0.5, 200, 4),
      zIndex: clamp(z, -999, 999, 1),
      locked: !!opts.locked,
      rotationDeg: clamp(opts.rotationDeg != null ? opts.rotationDeg : (type === 'seal' || type === 'watermarkText' ? -12 : 0), -90, 90, 0),
      props: Object.assign(defaultProps(type, opts), opts.props || {})
    };
  }

  function fieldLabel(type, fieldId) {
    var pool = poolForType(type);
    for (var i = 0; i < pool.length; i++) if (pool[i].id === fieldId) return pool[i].label;
    return fieldId;
  }

  /** 从旧 layoutPreset 模版展开为 elements[] */
  function expandLegacyToElements(tpl, tplType) {
    var legacyId = tpl.layoutPreset || (tplType === 'sample_label' ? 'label_style_1' : 'cert_style_3');
    var legacy = LEGACY_PRESETS[legacyId] || LEGACY_PRESETS.cert_style_3;
    var paper = tpl.paper || clone(legacy.paper);
    var w = paper.wMm;
    var h = paper.hMm;
    var els = [];
    var brand = tpl.brand || {};
    var fields = (tpl.fields || []).filter(function (f) { return f.visible !== false && f.id !== 'qrCode'; });
    if (!fields.length) {
      fields = (legacy.fieldIds || []).map(function (id) {
        return { id: id, label: fieldLabel(tplType, id), visible: true };
      });
    }
    var z = 1;

    if (legacyId === 'cert_style_1') {
      if (brand.logoMode !== 'hidden') {
        els.push(createElement('logo', { paper: paper, box: { xMm: 2, yMm: 1.5, wMm: 7, hMm: 7 }, zIndex: z++, props: { source: 'system' } }));
      }
      els.push(createElement('title', {
        paper: paper, tplType: tplType, zIndex: z++,
        box: { xMm: 10, yMm: 1.5, wMm: w - 12, hMm: 7 },
        props: { text: brand.title || legacy.title, fontSize: 12, color: '#ffffff', align: 'center' }
      }));
      els.push(createElement('line', { paper: paper, box: { xMm: 0, yMm: 9.5, wMm: w, hMm: 0.8 }, zIndex: z++, props: { color: '#2e7d32', widthPx: 8, style: 'solid' } }));
      fields.forEach(function (f, i) {
        els.push(createElement('fieldRow', {
          paper: paper, tplType: tplType, fieldId: f.id, label: f.label, index: i, zIndex: z++,
          box: { xMm: 3, yMm: 12 + i * 4.8, wMm: w - 6, hMm: 4.2 },
          props: { fieldId: f.id, label: f.label || fieldLabel(tplType, f.id), showLabel: true, valueAlign: 'left', underline: 'solid', fontSize: 11, color: '#1e293b' }
        }));
      });
      if (brand.orgName) {
        els.push(createElement('orgName', {
          paper: paper, tplType: tplType, zIndex: z++,
          box: { xMm: 2, yMm: h - 6, wMm: w - 4, hMm: 4 },
          props: { text: brand.orgName, fontSize: 9, color: '#334155', align: 'center' }
        }));
      }
      var wm = brand.watermark;
      if (!wm || wm.enabled !== false) {
        els.push(createElement('seal', {
          paper: paper, zIndex: 0, rotationDeg: -12,
          box: { xMm: w * 0.55, yMm: h * 0.4, wMm: 14, hMm: 14 },
          props: { source: (wm && wm.sealMode === 'custom') ? 'custom' : 'system', url: (wm && wm.sealUrl) || null, opacity: (wm && wm.opacity) || 0.42 }
        }));
      }
      if (tpl.qr && tpl.qr.enabled) {
        var q = Math.min(12, h * 0.35);
        els.push(createElement('qr', {
          paper: paper, tplType: tplType, zIndex: z++,
          box: { xMm: w - q - 2, yMm: h - q - 2, wMm: q, hMm: q }
        }));
      }
    } else if (legacyId === 'cert_style_2') {
      els.push(createElement('hangHole', { paper: paper, box: { xMm: w - 5, yMm: 1.2, wMm: 3.2, hMm: 3.2 }, zIndex: z++ }));
      els.push(createElement('orgName', {
        paper: paper, tplType: tplType, zIndex: z++,
        box: { xMm: 2, yMm: 1.5, wMm: w - 8, hMm: 3.5 },
        props: { text: brand.orgName || DEFAULT_ORG, fontSize: 9, color: '#1e293b', align: 'center' }
      }));
      els.push(createElement('title', {
        paper: paper, tplType: tplType, zIndex: z++,
        box: { xMm: 2, yMm: 5, wMm: w - 4, hMm: 3.5 },
        props: { text: brand.title || legacy.title, fontSize: 11, color: '#1e293b', align: 'center' }
      }));
      var qrSize = Math.min(12, h * 0.45);
      els.push(createElement('qr', {
        paper: paper, tplType: tplType, zIndex: z++,
        box: { xMm: (w - qrSize) / 2, yMm: 9, wMm: qrSize, hMm: qrSize }
      }));
      fields.forEach(function (f, i) {
        els.push(createElement('fieldRow', {
          paper: paper, tplType: tplType, fieldId: f.id, label: f.label, zIndex: z++,
          box: { xMm: 2, yMm: 9 + qrSize + 1 + i * 3.5, wMm: w - 4, hMm: 3.2 },
          props: { fieldId: f.id, label: f.label || fieldLabel(tplType, f.id), showLabel: true, valueAlign: 'center', underline: 'dotted', fontSize: 9, color: '#1e293b' }
        }));
      });
      var warn = brand.footerWarning != null ? brand.footerWarning : legacy.warn;
      if (warn) {
        els.push(createElement('staticText', {
          paper: paper, zIndex: z++,
          box: { xMm: 1, yMm: h - 4, wMm: w - 2, hMm: 3.2 },
          props: { text: warn, fontSize: 8, color: '#dc2626', align: 'center' }
        }));
      }
    } else if (legacyId === 'label_style_1') {
      var fieldW = w * 0.58;
      fields.forEach(function (f, i) {
        els.push(createElement('fieldRow', {
          paper: paper, tplType: tplType, fieldId: f.id, label: f.label, zIndex: z++,
          box: { xMm: 2, yMm: 2 + i * 5.2, wMm: fieldW, hMm: 4.5 },
          props: { fieldId: f.id, label: f.label || fieldLabel(tplType, f.id), showLabel: true, valueAlign: 'left', underline: 'dotted', fontSize: 10, color: '#1e293b' }
        }));
      });
      var lq = Math.min(18, h - 4);
      els.push(createElement('qr', {
        paper: paper, tplType: tplType, zIndex: z++,
        box: { xMm: w - lq - 2, yMm: (h - lq) / 2, wMm: lq, hMm: lq }
      }));
    } else {
      // cert_style_3 / fallback：左文右码
      els.push(createElement('orgName', {
        paper: paper, tplType: tplType, zIndex: z++,
        box: { xMm: 2, yMm: 1.5, wMm: w - 4, hMm: 4 },
        props: { text: brand.orgName || DEFAULT_ORG, fontSize: 10, color: '#1e293b', align: 'center' }
      }));
      els.push(createElement('title', {
        paper: paper, tplType: tplType, zIndex: z++,
        box: { xMm: 2, yMm: 5.5, wMm: w - 4, hMm: 5 },
        props: { text: brand.title || legacy.title, fontSize: 14, color: '#1e293b', align: 'center' }
      }));
      if (brand.logoMode !== 'hidden') {
        els.push(createElement('logo', { paper: paper, box: { xMm: 2, yMm: 1.5, wMm: 7, hMm: 7 }, zIndex: z++, props: { source: 'system' } }));
      }
      var fw = w * 0.55;
      fields.forEach(function (f, i) {
        els.push(createElement('fieldRow', {
          paper: paper, tplType: tplType, fieldId: f.id, label: f.label, zIndex: z++,
          box: { xMm: 3, yMm: 12 + i * 5, wMm: fw, hMm: 4.5 },
          props: { fieldId: f.id, label: f.label || fieldLabel(tplType, f.id), showLabel: true, valueAlign: 'left', underline: 'dotted', fontSize: 11, color: '#1e293b' }
        }));
      });
      var cq = Math.min(22, h - 8);
      els.push(createElement('qr', {
        paper: paper, tplType: tplType, zIndex: z++,
        box: { xMm: w - cq - 3, yMm: 14, wMm: cq, hMm: cq }
      }));
    }
    return els;
  }

  function normalizePaper(paper, fallback) {
    fallback = fallback || { wMm: 90, hMm: 50 };
    paper = paper || {};
    var borderIn = paper.border || {};
    return {
      wMm: clamp(paper.wMm, 20, 200, fallback.wMm),
      hMm: clamp(paper.hMm, 15, 200, fallback.hMm),
      border: {
        enabled: borderIn.enabled !== false,
        color: normalizeColor(borderIn.color, '#cbd5e1'),
        widthPx: clamp(borderIn.widthPx, 0, 8, 1)
      }
    };
  }

  function normalizeElement(el, tplType) {
    if (!el || !ELEMENT_TYPES[el.type]) return null;
    var meta = ELEMENT_TYPES[el.type];
    var props = Object.assign(defaultProps(el.type, { tplType: tplType, fieldId: el.props && el.props.fieldId }), el.props || {});
    if (el.type === 'qr') props.payloadType = payloadTypeFor(tplType);
    if (el.type === 'fieldRow') {
      props.fieldId = props.fieldId || 'sampleName';
      props.label = props.label || fieldLabel(tplType, props.fieldId);
      props.underline = ['none', 'solid', 'dotted', 'dashed'].indexOf(props.underline) >= 0 ? props.underline : 'dotted';
      props.valueAlign = normalizeAlign(props.valueAlign, 'left');
      props.fontSize = clamp(props.fontSize, 7, 22, 11);
      props.fontFamily = normalizeFontFamily(props.fontFamily);
      props.color = normalizeColor(props.color, '#1e293b');
      props.showLabel = props.showLabel !== false;
      if (isDateFieldId(props.fieldId)) {
        props.dateFormat = normalizeDateFormat(props.dateFormat);
      } else {
        delete props.dateFormat;
      }
      if (isInspectorFieldId(props.fieldId)) {
        props.inspectorDisplay = normalizeInspectorDisplay(props.inspectorDisplay);
        if (props.inspectorDisplay === 'esign') props.underline = 'none';
      } else {
        delete props.inspectorDisplay;
      }
    }
    if (el.type === 'orgName' || el.type === 'title' || el.type === 'staticText' || el.type === 'watermarkText') {
      props.text = props.text != null ? String(props.text) : '';
      props.fontSize = clamp(props.fontSize, 7, 48, props.fontSize || 11);
      props.fontFamily = normalizeFontFamily(props.fontFamily);
      props.color = normalizeColor(props.color, '#1e293b');
      props.align = normalizeAlign(props.align, 'center');
    }
    if (el.type === 'staticText') {
      props.opacity = clamp(props.opacity, 0, 1, 1);
    }
    if (el.type === 'logo' || el.type === 'seal') {
      props.source = props.source === 'custom' || props.source === 'hidden' ? props.source : 'system';
      if (el.type === 'seal' && props.source === 'hidden') props.source = 'system';
      props.opacity = clamp(props.opacity, 0, 1, el.type === 'seal' ? 0.42 : 1);
    }
    if (el.type === 'watermarkText') {
      props.opacity = clamp(props.opacity, 0, 1, 0.18);
      props.tile = !!props.tile;
    }
    if (el.type === 'line') {
      props.color = normalizeColor(props.color, '#cbd5e1');
      props.widthPx = clamp(props.widthPx, 1, 8, 1);
      props.style = props.style === 'dashed' || props.style === 'dotted' ? props.style : 'solid';
    }
    return {
      id: el.id || elUid(),
      category: meta.category,
      type: el.type,
      layer: normalizeLayer(el.layer, el.type),
      xMm: clamp(el.xMm, 0, 200, 0),
      yMm: clamp(el.yMm, 0, 200, 0),
      wMm: clamp(el.wMm, 0.5, 200, 10),
      hMm: clamp(el.hMm, 0.5, 200, 4),
      zIndex: clamp(el.zIndex, -999, 999, 1),
      locked: !!el.locked,
      rotationDeg: clamp(el.rotationDeg, -90, 90, 0),
      props: props
    };
  }

  function enforceUniqueness(elements) {
    var seenType = {};
    var seenField = {};
    var out = [];
    (elements || []).forEach(function (el) {
      var meta = ELEMENT_TYPES[el.type];
      if (!meta) return;
      if (meta.unique) {
        if (seenType[el.type]) return;
        seenType[el.type] = true;
      }
      if (el.type === 'fieldRow') {
        var fid = el.props && el.props.fieldId;
        if (!fid || seenField[fid]) return;
        seenField[fid] = true;
      }
      out.push(el);
    });
    return out;
  }

  function canAddElement(elements, type, fieldId) {
    var meta = ELEMENT_TYPES[type];
    if (!meta) return { ok: false, reason: '未知元素类型' };
    if (meta.unique) {
      for (var i = 0; i < elements.length; i++) if (elements[i].type === type) {
        return { ok: false, reason: meta.name + '已存在（最多 1 个）' };
      }
    }
    if (type === 'fieldRow') {
      if (!fieldId) return { ok: false, reason: '请选择字段' };
      for (var j = 0; j < elements.length; j++) {
        if (elements[j].type === 'fieldRow' && elements[j].props && elements[j].props.fieldId === fieldId) {
          return { ok: false, reason: '该业务字段已在画布上' };
        }
      }
    }
    return { ok: true };
  }

  function migrateTemplateToFree(tpl, typeHint) {
    if (!tpl) return tpl;
    var tplType = typeHint || templateTypeOf(tpl);
    tpl._type = tplType;

    var legacy = LEGACY_PRESETS[tpl.layoutPreset] || null;
    var paperFallback = (legacy && legacy.paper) || { wMm: 90, hMm: 50 };
    var paper = normalizePaper(tpl.paper, paperFallback);
    if (!tpl.paper || !tpl.paper.border) {
      if (legacy && legacy.border) paper.border = clone(legacy.border);
      else if (tpl.style) {
        paper.border = {
          enabled: tpl.style.borderEnabled !== false,
          color: tpl.style.borderColor || '#cbd5e1',
          widthPx: tpl.style.borderWidthPx != null ? tpl.style.borderWidthPx : 1
        };
      }
    }
    tpl.paper = normalizePaper(paper, paperFallback);

    // 仅旧版 layoutPreset/brand/fields 结构才展开；空白自由设计（elements: []）必须保持空白
    var isLegacyShape = !!(tpl.layoutPreset || tpl.brand || tpl.fields || tpl.qr || tpl.style);
    if (!Array.isArray(tpl.elements)) tpl.elements = [];
    if (!tpl.elements.length && isLegacyShape) {
      tpl.elements = expandLegacyToElements(tpl, tplType);
    }
    tpl.elements = enforceUniqueness(
      tpl.elements.map(function (el) { return normalizeElement(el, tplType); }).filter(Boolean)
    );

    if (!tpl.meta) tpl.meta = { material: '', mount: '', printMethod: '' };
    if (!Array.isArray(tpl.bindSampleIds)) tpl.bindSampleIds = [];
    if (tpl.enabled == null) tpl.enabled = true;
    if (!tpl.updatedAt) tpl.updatedAt = formatNow();

    // 清理旧主路径字段（保留 layoutPreset 仅作溯源可选）
    delete tpl.fields;
    delete tpl.brand;
    delete tpl.qr;
    delete tpl.style;
    return tpl;
  }

  function createBlankTemplate(opts) {
    opts = opts || {};
    var type = opts.type === 'sample_label' ? 'sample_label' : 'certificate';
    var size = opts.paper || { wMm: type === 'sample_label' ? 60 : 90, hMm: type === 'sample_label' ? 40 : 50 };
    var paper = normalizePaper(size, size);
    return {
      id: opts.id || uid('tpl'),
      name: opts.name || (type === 'sample_label' ? '新样品标签模版' : '新合格证模版'),
      enabled: opts.enabled === true, // 个性化默认未启用，需绑样品
      updatedAt: formatNow(),
      _type: type,
      paper: paper,
      meta: opts.meta || { material: '', mount: '', printMethod: '' },
      bindSampleIds: [],
      elements: []
    };
  }

  /** 兼容旧 createTemplate 调用：空白或按旧预设展开 */
  function createTemplate(opts) {
    opts = opts || {};
    var type = opts.type === 'sample_label' ? 'sample_label' : 'certificate';
    if (opts.layoutPreset && LEGACY_PRESETS[opts.layoutPreset]) {
      var legacy = LEGACY_PRESETS[opts.layoutPreset];
      type = legacy.type;
      var tpl = {
        id: opts.id || uid('tpl'),
        name: opts.name || (legacy.name + '模版'),
        enabled: opts.enabled !== false,
        updatedAt: opts.updatedAt || formatNow(),
        layoutPreset: opts.layoutPreset,
        paper: clone(opts.paper || legacy.paper),
        brand: opts.brand || {
          orgName: type === 'sample_label' ? '' : DEFAULT_ORG,
          title: legacy.title,
          logoMode: type === 'sample_label' ? 'hidden' : 'system',
          footerWarning: legacy.warn || null
        },
        fields: (opts.fields) || (legacy.fieldIds || []).map(function (id) {
          return { id: id, label: fieldLabel(type, id), visible: true };
        }),
        qr: opts.qr || { enabled: !!legacy.qr, sizePx: 90, payloadType: payloadTypeFor(type), placement: legacy.qr ? 'right' : 'none' },
        meta: opts.meta || { material: '', mount: '', printMethod: '' },
        bindSampleIds: opts.bindSampleIds || []
      };
      return migrateTemplateToFree(tpl, type);
    }
    var blank = createBlankTemplate({
      id: opts.id,
      name: opts.name,
      type: type,
      paper: opts.paper,
      enabled: opts.enabled !== false,
      meta: opts.meta
    });
    if (opts.bindSampleIds) blank.bindSampleIds = opts.bindSampleIds.slice();
    if (opts.elements) {
      blank.elements = enforceUniqueness(
        opts.elements.map(function (el) { return normalizeElement(el, type); }).filter(Boolean)
      );
    }
    return blank;
  }

  function cloneTemplateAsPersonal(source, opts) {
    opts = opts || {};
    if (!source) throw new Error('source required');
    var type = opts.type || templateTypeOf(source);
    var copy = clone(source);
    copy.id = opts.id || uid('tpl');
    copy.name = opts.name || ((source.name || '模版') + ' 副本');
    copy.enabled = false;
    copy.updatedAt = formatNow();
    copy.bindSampleIds = [];
    copy._type = type;
    delete copy.layoutPreset;
    return migrateTemplateToFree(copy, type);
  }

  function emptyBucket() {
    return { templates: [], defaultTemplateId: null };
  }

  function buildDefaultConfig() {
    var cfg = {};
    CATEGORIES.forEach(function (c) {
      cfg[c.key] = { sample_label: emptyBucket(), certificate: emptyBucket() };
    });

    var lr = createTemplate({
      id: 'tpl_aq_lr', name: '左文右码合格证（默认）', layoutPreset: 'cert_style_3',
      enabled: true, bindSampleIds: []
    });
    var stick = createTemplate({
      id: 'tpl_aq_stick', name: '不粘胶纸合格证', layoutPreset: 'cert_style_1',
      bindSampleIds: ['rod', 'ladder', 'helmet', 'board1476', 'spur', 'sling', 'shackle'],
      meta: { material: '不粘胶纸', mount: '粘贴', printMethod: '喷墨' }
    });
    var hang = createTemplate({
      id: 'tpl_aq_hang', name: 'PVC悬挂合格证', layoutPreset: 'cert_style_2',
      bindSampleIds: ['belt976', 'rope1476'],
      meta: { material: 'PVC', mount: '悬挂', printMethod: '喷墨' }
    });
    var label = createTemplate({
      id: 'tpl_aq_label', name: '样品标签（默认）', type: 'sample_label',
      layoutPreset: 'label_style_1', enabled: true, bindSampleIds: []
    });

    cfg.aqgqj.certificate.templates = [lr, stick, hang];
    cfg.aqgqj.certificate.defaultTemplateId = 'tpl_aq_lr';
    cfg.aqgqj.sample_label.templates = [label];
    cfg.aqgqj.sample_label.defaultTemplateId = 'tpl_aq_label';

    ['dlwz', 'hjjc', 'gcjc'].forEach(function (k) {
      var c3 = createTemplate({
        id: 'tpl_' + k + '_cert', name: '左文右码合格证（默认）',
        layoutPreset: 'cert_style_3', enabled: true, bindSampleIds: []
      });
      var lb = createTemplate({
        id: 'tpl_' + k + '_label', name: '样品标签（默认）', type: 'sample_label',
        layoutPreset: 'label_style_1', enabled: true, bindSampleIds: []
      });
      cfg[k].certificate.templates = [c3];
      cfg[k].certificate.defaultTemplateId = c3.id;
      cfg[k].sample_label.templates = [lb];
      cfg[k].sample_label.defaultTemplateId = lb.id;
    });

    cfg._migrateFreeLayoutV1 = 1;
    cfg._migrateLabelFieldsV2 = 1;
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
    bucket.templates.forEach(function (t) { migrateTemplateToFree(t, type); });
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

  function migrateFreeLayout(cfg) {
    if (!cfg || cfg._migrateFreeLayoutV1) return cfg;
    CATEGORIES.forEach(function (c) {
      ['certificate', 'sample_label'].forEach(function (type) {
        var bucket = getBucket(cfg, c.key, type);
        (bucket.templates || []).forEach(function (t) { migrateTemplateToFree(t, type); });
      });
    });
    cfg._migrateFreeLayoutV1 = 1;
    return cfg;
  }

  /** 含悬挂孔的合格证统一到样例尺寸 50×25，并等比缩放元素 */
  function migrateHangPaper50x25(cfg) {
    if (!cfg || cfg._migrateHangPaper50x25) return cfg;
    CATEGORIES.forEach(function (c) {
      var bucket = getBucket(cfg, c.key, 'certificate');
      (bucket.templates || []).forEach(function (t) {
        if (!t || !Array.isArray(t.elements)) return;
        var hasHole = t.elements.some(function (el) { return el.type === 'hangHole'; });
        if (!hasHole || !t.paper) return;
        var tw = 50;
        var th = 25;
        if (Math.abs(t.paper.wMm - tw) < 0.05 && Math.abs(t.paper.hMm - th) < 0.05) return;
        scaleElementsToPaper(t.elements, { wMm: t.paper.wMm, hMm: t.paper.hMm }, { wMm: tw, hMm: th });
        t.paper.wMm = tw;
        t.paper.hMm = th;
      });
    });
    cfg._migrateHangPaper50x25 = 1;
    return cfg;
  }

  /** 历史配置里合格证该字段叫「规格型号」，统一到「型号规格」 */
  function migrateSpecModelLabel(cfg) {
    if (!cfg || cfg._migrateSpecModelLabelV1) return cfg;
    CATEGORIES.forEach(function (c) {
      ['certificate', 'sample_label'].forEach(function (type) {
        var bucket = getBucket(cfg, c.key, type);
        (bucket.templates || []).forEach(function (t) {
          (t && t.elements || []).forEach(function (el) {
            var pp = el && el.props;
            if (pp && pp.fieldId === 'specModel' && pp.label !== SPECMODEL_LABEL) pp.label = SPECMODEL_LABEL;
          });
        });
      });
    });
    cfg._migrateSpecModelLabelV1 = 1;
    return cfg;
  }

  /** 样品标签默认纸张 60×40 → 80×35（模板管理里存过的老配置一并跟上，元素等比缩放） */
  function migrateLabelPaper80x35(cfg) {
    if (!cfg || cfg._migrateLabelPaper80x35) return cfg;
    CATEGORIES.forEach(function (c) {
      var bucket = getBucket(cfg, c.key, 'sample_label');
      (bucket.templates || []).forEach(function (t) {
        if (!t || !t.paper) return;
        if (Math.abs(t.paper.wMm - 60) > 0.01 || Math.abs(t.paper.hMm - 40) > 0.01) return;
        var from = { wMm: t.paper.wMm, hMm: t.paper.hMm };
        t.paper.wMm = 80; t.paper.hMm = 35;
        if (Array.isArray(t.elements)) scaleElementsToPaper(t.elements, from, { wMm: 80, hMm: 35 });
      });
    });
    cfg._migrateLabelPaper80x35 = 1;
    return cfg;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          migrateFreeLayout(parsed);
          migrateHangPaper50x25(parsed);
          migrateSpecModelLabel(parsed);
          migrateLabelPaper80x35(parsed);
          normalizeConfig(parsed);
          save(parsed);
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }
    var cfg = buildDefaultConfig();
    cfg._migrateHangPaper50x25 = 1;
    cfg._migrateSpecModelLabelV1 = 1;
    cfg._migrateLabelPaper80x35 = 1;
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
    if (sampleMasterId) {
      for (var i = 0; i < bucket.templates.length; i++) {
        var t = bucket.templates[i];
        if (!t.enabled || t.id === defId) continue;
        if ((t.bindSampleIds || []).indexOf(sampleMasterId) !== -1) return t;
      }
    }
    return findTemplate(bucket, defId) || null;
  }

  var NAME_TO_MASTER = {
    '绝缘操作杆': 'rod', '绝缘软梯': 'ladder', '安全带': 'belt976', '安全绳': 'rope1476',
    '安全帽': 'helmet', '登高板': 'board1476', '登杆脚扣': 'spur', '吊装带': 'sling', '卸扣': 'shackle',
    '验电器': 'electroscope', '绝缘毯': 'blanket', '卡线器': 'shackle'
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

  function getRecorderMax() {
    try {
      var raw = localStorage.getItem('lims.paramOverrides');
      if (raw) {
        var map = JSON.parse(raw);
        if (map['cert.recorder.max']) return Math.max(1, parseInt(map['cert.recorder.max'], 10) || 1);
      }
    } catch (e) { /* ignore */ }
    return 1;
  }

  /**
   * 合并位姓名文本：先检测员后记录员；角色内「、」；角色间「 、」
   */
  function formatInspectorsRecordersText(inspectors, recorders) {
    function joinNames(arr) {
      return (arr || []).map(function (n) { return String(n || '').trim(); }).filter(Boolean).join('、');
    }
    var a = joinNames(inspectors);
    var b = joinNames(recorders);
    if (a && b) return a + ' 、' + b;
    return a || b || '';
  }

  function personnelNameList(arr, fallback) {
    if (Array.isArray(arr) && arr.length) {
      return arr.map(function (n) { return String(n || '').trim(); }).filter(Boolean);
    }
    if (arr == null || arr === '') return fallback ? [fallback] : [];
    return String(arr).split(/[、,，]/).map(function (n) { return n.trim(); }).filter(Boolean);
  }

  /** 电子签顺序：先全部检测员，再全部记录员 */
  function combinedPersonnelNames(data, opts) {
    opts = opts || {};
    var insp = personnelNameList(data && data.inspectors, opts.previewFallback ? '签名占位' : '');
    var rec = personnelNameList(data && data.recorders, opts.previewFallback ? '签名占位' : '');
    // 预览：若两侧都空则给一个占位；打印侧由门禁保证非空
    if (opts.previewFallback && !insp.length && !rec.length) return ['签名占位'];
    return insp.concat(rec);
  }

  function findBindConflicts(catKey, type, templateId, bindSampleIds) {
    var cfg = load();
    var bucket = ensureBucketShape(getBucket(cfg, catKey, type), type);
    var conflicts = [];
    (bucket.templates || []).forEach(function (t) {
      if (!t.enabled || t.id === templateId || t.id === bucket.defaultTemplateId) return;
      (t.bindSampleIds || []).forEach(function (sid) {
        if (bindSampleIds.indexOf(sid) !== -1) {
          conflicts.push({ sampleId: sid, templateId: t.id, templateName: t.name });
        }
      });
    });
    return conflicts;
  }

  function validateTemplate(tpl, opts) {
    opts = opts || {};
    var errors = [];
    var type = opts.type || templateTypeOf(tpl);
    if (!tpl || !String(tpl.name || '').trim()) errors.push('请填写模版名称');
    var paper = tpl.paper || {};
    if (!(paper.wMm >= 20 && paper.wMm <= 200 && paper.hMm >= 15 && paper.hMm <= 200)) {
      errors.push('纸张尺寸需在 20–200 × 15–200 mm');
    }
    (tpl.elements || []).forEach(function (el) {
      if (el.xMm < 0 || el.yMm < 0 || el.xMm + el.wMm > paper.wMm + 0.05 || el.yMm + el.hMm > paper.hMm + 0.05) {
        errors.push('元素越界：' + ((ELEMENT_TYPES[el.type] && ELEMENT_TYPES[el.type].name) || el.type));
      }
    });
    if (opts.requireBind && !(tpl.bindSampleIds || []).length) {
      errors.push('个性化模版须至少绑定 1 个样品');
    }
    return errors;
  }

  function usedFieldIds(elements) {
    return (elements || []).filter(function (e) { return e.type === 'fieldRow'; })
      .map(function (e) { return e.props.fieldId; });
  }

  function usedPersonnelFieldIds(elements) {
    return usedFieldIds(elements).filter(isPersonnelFieldId);
  }

  /**
   * 元件库是否禁用某人员 fieldId
   * @returns {boolean} true=禁用
   */
  function isPersonnelFieldBlocked(usedPersonnelIds, candidateId) {
    var used = usedPersonnelIds || [];
    if (used.indexOf(candidateId) >= 0) return false; // 已占用项本身可点移除，不在此禁用
    var hasCombined = used.indexOf('inspectorsRecorders') >= 0;
    var hasSingle = used.indexOf('inspectors') >= 0 || used.indexOf('recorders') >= 0;
    if (candidateId === 'inspectorsRecorders') return hasSingle;
    if (candidateId === 'inspectors' || candidateId === 'recorders') return hasCombined;
    return false;
  }

  /**
   * 由模版 elements 推导打印所需角色
   * @returns {{ needInspectors: boolean, needRecorders: boolean }}
   */
  function personnelRolesNeeded(elements) {
    var used = usedPersonnelFieldIds(elements);
    var needInspectors = used.indexOf('inspectors') >= 0 || used.indexOf('inspectorsRecorders') >= 0;
    var needRecorders = used.indexOf('recorders') >= 0 || used.indexOf('inspectorsRecorders') >= 0;
    return { needInspectors: needInspectors, needRecorders: needRecorders };
  }

  function hasElementType(elements, type) {
    return (elements || []).some(function (e) { return e.type === type; });
  }

  function bringToLayer(elements, id, mode) {
    var list = elements || [];
    var target = null;
    list.forEach(function (e) { if (e.id === id) target = e; });
    if (!target) return list;
    var zs = list.map(function (e) { return e.zIndex; });
    if (mode === 'bottom') target.zIndex = Math.min.apply(null, zs.concat([0])) - 1;
    else if (mode === 'top') target.zIndex = Math.max.apply(null, zs.concat([0])) + 1;
    else if (mode === 'up') target.zIndex += 1;
    else if (mode === 'down') target.zIndex -= 1;
    return list;
  }

  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  }

  /** 纸张尺寸变化时，按宽/高比例缩放全部元素（位置、尺寸、字号） */
  function scaleElementsToPaper(elements, fromPaper, toPaper) {
    fromPaper = fromPaper || {};
    toPaper = toPaper || {};
    var ox = Number(fromPaper.wMm);
    var oy = Number(fromPaper.hMm);
    var nx = Number(toPaper.wMm);
    var ny = Number(toPaper.hMm);
    if (!(ox > 0 && oy > 0 && nx > 0 && ny > 0)) return elements;
    var sx = nx / ox;
    var sy = ny / oy;
    if (Math.abs(sx - 1) < 1e-6 && Math.abs(sy - 1) < 1e-6) return elements;
    var sf = Math.sqrt(Math.abs(sx * sy));
    (elements || []).forEach(function (el) {
      el.xMm = round2(el.xMm * sx);
      el.yMm = round2(el.yMm * sy);
      el.wMm = Math.max(0.5, round2(el.wMm * sx));
      el.hMm = Math.max(0.5, round2(el.hMm * sy));
      if (el.xMm + el.wMm > nx) el.xMm = Math.max(0, round2(nx - el.wMm));
      if (el.yMm + el.hMm > ny) el.yMm = Math.max(0, round2(ny - el.hMm));
      if (el.props) {
        if (el.props.fontSize != null) {
          el.props.fontSize = Math.max(6, Math.min(48, Math.round(Number(el.props.fontSize) * sf)));
        }
        if (el.props.widthPx != null) {
          el.props.widthPx = Math.max(1, Math.round(Number(el.props.widthPx) * sf));
        }
      }
    });
    return elements;
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
    PAPER_SIZE_PRESETS: PAPER_SIZE_PRESETS,
    FONT_PRESETS: FONT_PRESETS,
    fontCssById: fontCssById,
    normalizeFontFamily: normalizeFontFamily,
    ELEMENT_TYPES: ELEMENT_TYPES,
    elementLayer: elementLayer,
    DATE_FIELD_IDS: DATE_FIELD_IDS,
    DATE_FORMAT_PRESETS: DATE_FORMAT_PRESETS,
    isDateFieldId: isDateFieldId,
    normalizeDateFormat: normalizeDateFormat,
    PERSONNEL_FIELD_IDS: PERSONNEL_FIELD_IDS,
    isPersonnelFieldId: isPersonnelFieldId,
    isInspectorFieldId: isInspectorFieldId,
    normalizeInspectorDisplay: normalizeInspectorDisplay,
    CERT_FIELD_POOL: CERT_FIELD_POOL,
    LABEL_FIELD_POOL: LABEL_FIELD_POOL,
    LABEL_DETECT_STATUS: LABEL_DETECT_STATUS,
    LEGACY_PRESETS: LEGACY_PRESETS,
    PRESETS: LEGACY_PRESETS,
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
    createBlankTemplate: createBlankTemplate,
    cloneTemplateAsPersonal: cloneTemplateAsPersonal,
    createElement: createElement,
    normalizeElement: normalizeElement,
    migrateTemplateToFree: migrateTemplateToFree,
    canAddElement: canAddElement,
    enforceUniqueness: enforceUniqueness,
    validateTemplate: validateTemplate,
    usedFieldIds: usedFieldIds,
    usedPersonnelFieldIds: usedPersonnelFieldIds,
    isPersonnelFieldBlocked: isPersonnelFieldBlocked,
    personnelRolesNeeded: personnelRolesNeeded,
    hasElementType: hasElementType,
    bringToLayer: bringToLayer,
    scaleElementsToPaper: scaleElementsToPaper,
    poolForType: poolForType,
    payloadTypeFor: payloadTypeFor,
    templateTypeOf: templateTypeOf,
    fieldLabel: fieldLabel,
    masterIdFromName: masterIdFromName,
    getInspectorMax: getInspectorMax,
    getRecorderMax: getRecorderMax,
    formatInspectorsRecordersText: formatInspectorsRecordersText,
    personnelNameList: personnelNameList,
    combinedPersonnelNames: combinedPersonnelNames,
    findBindConflicts: findBindConflicts,
    formatNow: formatNow,
    uid: uid,
    elUid: elUid,
    clone: clone
  };
})(window);
