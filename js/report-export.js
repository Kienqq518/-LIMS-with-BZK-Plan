/**
 * 报告生成 · 默认导出模式与文件预览（原型共享）
 * 设计依据：docs/superpowers/specs/2026-07-18-report-generation-flow-design.md
 */
(function (global) {
  var REPORT_EXPORT_MODES = [
    { key: 'model-batch', label: '单种样品一份报告' },
    { key: 'specimen-each', label: '单个样品一份报告' }
  ];

  var DEFAULT_EXPORT_MODE_KEY = 'model-batch';

  var BIND_TYPE_LABELS = {
    category: '样品分类',
    model: '样品名称(型号)'
  };

  function modeByKey(key) {
    for (var i = 0; i < REPORT_EXPORT_MODES.length; i++) {
      if (REPORT_EXPORT_MODES[i].key === key) return REPORT_EXPORT_MODES[i];
    }
    return REPORT_EXPORT_MODES[1];
  }

  function modeLabel(key) {
    return modeByKey(key).label;
  }

  function modelLabelFromSample(sample) {
    return (sample.name || '') + (sample.model ? ' - ' + sample.model : '');
  }

  function resolveReportExportMode(sample, rules) {
    rules = rules || [];
    var modelLabel = modelLabelFromSample(sample);
    var category = sample.category || '';
    var categoryPath = sample.categoryPath || (category ? [category] : []);
    var i;

    for (i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.bindType === 'model' && r.bindTarget === modelLabel) return r;
      if (r.bindType === 'model' && r.bindTarget === sample.name) return r;
    }
    for (i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (rule.bindType !== 'category') continue;
      var target = rule.bindTarget || '';
      if (category === target || category.indexOf(target) >= 0) return rule;
      for (var j = 0; j < categoryPath.length; j++) {
        if (categoryPath[j] === target || categoryPath[j].indexOf(target) >= 0) return rule;
      }
    }
    return { id: 0, bindType: 'default', bindTarget: '—', modeKey: DEFAULT_EXPORT_MODE_KEY };
  }

  function getVariantsForModel(templateIndex, templateKey) {
    if (!templateIndex || !templateIndex[templateKey]) return [];
    return templateIndex[templateKey].slice();
  }

  function getDefaultVariant(templateIndex, templateKey) {
    var list = getVariantsForModel(templateIndex, templateKey);
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i].isDefault) return list[i];
    }
    return list[0] || null;
  }

  function variantById(templateIndex, templateKey, variantId) {
    var list = getVariantsForModel(templateIndex, templateKey);
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(variantId)) return list[i];
    }
    return null;
  }

  function hasEnabledTemplate(variant) {
    if (!variant) return false;
    if (variant.hasEnabled === false) return false;
    if (variant.templates && variant.templates.length) {
      return variant.templates.some(function (t) { return t.enabled; });
    }
    return !!variant.file;
  }

  function safeFilePart(s) {
    return String(s).replace(/[/\\:*?"<>|]/g, '_');
  }

  function buildReportFileName(entrustCode, sample, specimenId, variant) {
    var label = sample.name + (sample.model ? '-' + sample.model : '');
    var base = variant && variant.file ? variant.file.replace(/\.docx?$/i, '') : label + '_报告';
    if (specimenId) return safeFilePart(specimenId) + '_' + base + '.docx';
    return safeFilePart(entrustCode + '_' + label + '_报告') + '.docx';
  }

  function evaluateTemplateStatus(sample, variant) {
    if (!variant || !hasEnabledTemplate(variant)) {
      return {
        status: 'missing-template',
        statusMessage: sample.name + (sample.model ? ' ' + sample.model : '') + ' 缺少报告模版！'
      };
    }
    return { status: 'ready', statusMessage: '就绪' };
  }

  /**
   * @param {string} entrustCode
   * @param {object[]} checkedSpecimens - 勾选的试样
   * @param {string} exportModeKey
   * @param {object} selectedVariants - { [templateKey]: variantId }
   * @param {object} templateIndex
   */
  function buildReportFilePreview(entrustCode, checkedSpecimens, exportModeKey, selectedVariants, templateIndex) {
    if (!checkedSpecimens.length) return [];

    selectedVariants = selectedVariants || {};
    var mode = modeByKey(exportModeKey);
    var files = [];
    var fileId = 0;

    if (mode.key === 'model-batch') {
      var sample = checkedSpecimens[0];
      var templateKey = sample.templateKey || sample.id;
      var variantId = selectedVariants[templateKey];
      var variant = variantId
        ? variantById(templateIndex, templateKey, variantId)
        : getDefaultVariant(templateIndex, templateKey);
      var evalResult = evaluateTemplateStatus(sample, variant);
      files.push({
        id: 'r' + (++fileId),
        fileName: buildReportFileName(entrustCode, sample, null, variant),
        specimenIds: checkedSpecimens.map(function (s) { return s.specimenId; }),
        sampleLabel: modelLabelFromSample(sample),
        templateKey: templateKey,
        templateVariantId: variant ? variant.id : null,
        templateVariantName: variant ? variant.name : '—',
        status: evalResult.status,
        statusMessage: evalResult.statusMessage,
        exportModeKey: mode.key
      });
      return files;
    }

    checkedSpecimens.forEach(function (specimen) {
      var tKey = specimen.templateKey || specimen.id;
      var vId = selectedVariants[tKey];
      var v = vId ? variantById(templateIndex, tKey, vId) : getDefaultVariant(templateIndex, tKey);
      var ev = evaluateTemplateStatus(specimen, v);
      files.push({
        id: 'r' + (++fileId),
        fileName: buildReportFileName(entrustCode, specimen, specimen.specimenId, v),
        specimenIds: [specimen.specimenId],
        sampleLabel: modelLabelFromSample(specimen),
        templateKey: tKey,
        templateVariantId: v ? v.id : null,
        templateVariantName: v ? v.name : '—',
        status: ev.status,
        statusMessage: ev.statusMessage,
        exportModeKey: mode.key
      });
    });

    return files;
  }

  function resolveDefaultExportModeForSpecimens(specimens, rules) {
    if (!specimens.length) return DEFAULT_EXPORT_MODE_KEY;
    return resolveReportExportMode(specimens[0], rules).modeKey;
  }

  global.ReportExport = {
    REPORT_EXPORT_MODES: REPORT_EXPORT_MODES,
    BIND_TYPE_LABELS: BIND_TYPE_LABELS,
    DEFAULT_EXPORT_MODE_KEY: DEFAULT_EXPORT_MODE_KEY,
    modeByKey: modeByKey,
    modeLabel: modeLabel,
    resolveReportExportMode: resolveReportExportMode,
    resolveDefaultExportModeForSpecimens: resolveDefaultExportModeForSpecimens,
    getVariantsForModel: getVariantsForModel,
    getDefaultVariant: getDefaultVariant,
    variantById: variantById,
    hasEnabledTemplate: hasEnabledTemplate,
    buildReportFilePreview: buildReportFilePreview
  };
})(typeof window !== 'undefined' ? window : this);
