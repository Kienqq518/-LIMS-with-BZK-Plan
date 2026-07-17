/**
 * 记录单导出 · 配置驱动预览逻辑（原型共享）
 * 设计依据：docs/superpowers/specs/2026-07-17-record-sheet-config-flow-design.md
 */
(function (global) {
  var RECORD_MODES = [
    { key: 'model-all', label: '单种样品所有试验生成一份文件', dim: 'model', split: 'all' },
    { key: 'model-each', label: '单种样品单种试验生成一份文件', dim: 'model', split: 'each' },
    { key: 'specimen-all', label: '单个试样所有试验生成一份文件', dim: 'specimen', split: 'all' },
    { key: 'specimen-each', label: '单个试样单种试验生成一份文件', dim: 'specimen', split: 'each' }
  ];

  var DEFAULT_MODE_KEY = 'model-each';

  var BIND_TYPE_LABELS = {
    category: '样品分类',
    model: '样品名称(型号)'
  };

  function modeByKey(key) {
    for (var i = 0; i < RECORD_MODES.length; i++) {
      if (RECORD_MODES[i].key === key) return RECORD_MODES[i];
    }
    return RECORD_MODES[1];
  }

  function modeLabel(key) {
    return modeByKey(key).label;
  }

  function resolveRecordRule(sample, rules) {
    rules = rules || [];
    var modelLabel = (sample.name || '') + (sample.model ? ' - ' + sample.model : '');
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
    return { id: 0, bindType: 'default', bindTarget: '—', modeKey: DEFAULT_MODE_KEY };
  }

  function groupStatusColumn(groups) {
    if (!groups.length) return -1;
    return groups[0].columns.indexOf('状态');
  }

  function isGroupComplete(group) {
    var statusIdx = group.columns.indexOf('状态');
    if (statusIdx < 0) return true;
    return group.rows.every(function (row) { return row[statusIdx] === '已完成'; });
  }

  function specimenIdsFromSample(sample) {
    if (!sample.groups.length || !sample.groups[0].rows.length) return [];
    var idCol = 0;
    return sample.groups[0].rows.map(function (row) { return row[idCol]; });
  }

  function isSpecimenTestComplete(sample, specimenIdx, group) {
    var statusIdx = group.columns.indexOf('状态');
    if (statusIdx < 0 || !group.rows[specimenIdx]) return true;
    return group.rows[specimenIdx][statusIdx] === '已完成';
  }

  function isSpecimenAllComplete(sample, specimenIdx) {
    return sample.groups.every(function (g) {
      return isSpecimenTestComplete(sample, specimenIdx, g);
    });
  }

  function hasTemplate(templateIndex, sample, testName) {
    var key = sample.templateKey || sample.id;
    if (!templateIndex || !templateIndex[key]) return true;
    if (templateIndex[key][testName] === false) return false;
    return true;
  }

  function missingTemplates(testNames, sample, templateIndex) {
    return testNames.filter(function (t) { return !hasTemplate(templateIndex, sample, t); });
  }

  function buildFileName(entrustCode, sample, tests, specimenId, mode) {
    var label = sample.name + (sample.model ? '-' + sample.model : '');
    var safe = function (s) { return String(s).replace(/[/\\:*?"<>|]/g, '_'); };
    if (mode.split === 'all') {
      if (mode.dim === 'specimen' && specimenId) {
        return safe(entrustCode + '_' + specimenId + '_' + label + '_记录单.docx');
      }
      return safe(entrustCode + '_' + label + '_记录单.docx');
    }
    var testPart = tests.length === 1 ? tests[0] : tests.join('_');
    if (mode.dim === 'specimen' && specimenId) {
      return safe(entrustCode + '_' + specimenId + '_' + testPart + '记录单.docx');
    }
    return safe(entrustCode + '_' + label + '_' + testPart + '记录单.docx');
  }

  function evaluateStatus(allTestNames, completedTestNames, sample, templateIndex) {
    var incomplete = allTestNames.filter(function (t) {
      return completedTestNames.indexOf(t) < 0;
    });
    if (incomplete.length) {
      return {
        status: 'incomplete',
        statusDetail: '尚有 ' + incomplete.length + ' 项试验未完成：' + incomplete.join('、')
      };
    }
    var missing = missingTemplates(allTestNames, sample, templateIndex);
    if (missing.length) {
      return {
        status: 'missing_template',
        statusDetail: '缺少「' + missing.join('」「') + '」的模版'
      };
    }
    return { status: 'ready', statusDetail: '就绪' };
  }

  function buildTestsMeta(allNames, completedNames) {
    return allNames.map(function (name) {
      return { name: name, done: completedNames.indexOf(name) >= 0 };
    });
  }

  function buildRecordFilePreview(entrustCode, samples, rules, templateIndex) {
    var files = [];
    var fileId = 0;

    samples.forEach(function (sample) {
      var rule = resolveRecordRule(sample, rules);
      var mode = modeByKey(rule.modeKey);
      var allTests = sample.groups.map(function (g) { return g.title; });
      var completedTests = sample.groups.filter(isGroupComplete).map(function (g) { return g.title; });
      var sampleLabel = sample.name + (sample.model ? ' - ' + sample.model : '');

      if (mode.dim === 'model') {
        if (mode.split === 'all') {
          var evalAll = evaluateStatus(allTests, completedTests, sample, templateIndex);
          files.push({
            id: 'f' + (++fileId),
            fileName: buildFileName(entrustCode, sample, allTests, null, mode),
            sampleId: sample.id,
            sampleLabel: sampleLabel,
            specimenId: null,
            tests: buildTestsMeta(allTests, completedTests),
            status: evalAll.status,
            statusDetail: evalAll.statusDetail,
            modeKey: mode.key,
            ruleId: rule.id,
            checked: evalAll.status === 'ready'
          });
        } else {
          completedTests.forEach(function (testName) {
            var missing = missingTemplates([testName], sample, templateIndex);
            var st = missing.length
              ? { status: 'missing_template', statusDetail: '缺少「' + missing[0] + '」的模版' }
              : { status: 'ready', statusDetail: '就绪' };
            files.push({
              id: 'f' + (++fileId),
              fileName: buildFileName(entrustCode, sample, [testName], null, mode),
              sampleId: sample.id,
              sampleLabel: sampleLabel,
              specimenId: null,
              tests: [{ name: testName, done: true }],
              status: st.status,
              statusDetail: st.statusDetail,
              modeKey: mode.key,
              ruleId: rule.id,
              checked: st.status === 'ready'
            });
          });
        }
      } else {
        var specimenIds = specimenIdsFromSample(sample);
        specimenIds.forEach(function (specimenId, si) {
          var specimenCompleted = allTests.filter(function (_t, ti) {
            return isSpecimenTestComplete(sample, si, sample.groups[ti]);
          });

          if (mode.split === 'all') {
            var evalSpec = evaluateStatus(allTests, specimenCompleted, sample, templateIndex);
            files.push({
              id: 'f' + (++fileId),
              fileName: buildFileName(entrustCode, sample, allTests, specimenId, mode),
              sampleId: sample.id,
              sampleLabel: sampleLabel,
              specimenId: specimenId,
              tests: buildTestsMeta(allTests, specimenCompleted),
              status: evalSpec.status,
              statusDetail: evalSpec.statusDetail,
              modeKey: mode.key,
              ruleId: rule.id,
              checked: evalSpec.status === 'ready'
            });
          } else {
            specimenCompleted.forEach(function (testName) {
              var miss = missingTemplates([testName], sample, templateIndex);
              var st2 = miss.length
                ? { status: 'missing_template', statusDetail: '缺少「' + miss[0] + '」的模版' }
                : { status: 'ready', statusDetail: '就绪' };
              files.push({
                id: 'f' + (++fileId),
                fileName: buildFileName(entrustCode, sample, [testName], specimenId, mode),
                sampleId: sample.id,
                sampleLabel: sampleLabel,
                specimenId: specimenId,
                tests: [{ name: testName, done: true }],
                status: st2.status,
                statusDetail: st2.statusDetail,
                modeKey: mode.key,
                ruleId: rule.id,
                checked: st2.status === 'ready'
              });
            });
          }
        });
      }
    });

    return files;
  }

  global.RecordExport = {
    RECORD_MODES: RECORD_MODES,
    BIND_TYPE_LABELS: BIND_TYPE_LABELS,
    DEFAULT_MODE_KEY: DEFAULT_MODE_KEY,
    modeByKey: modeByKey,
    modeLabel: modeLabel,
    resolveRecordRule: resolveRecordRule,
    buildRecordFilePreview: buildRecordFilePreview
  };
})(typeof window !== 'undefined' ? window : this);
