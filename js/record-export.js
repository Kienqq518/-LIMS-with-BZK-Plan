/**
 * 记录单导出 · 配置驱动预览逻辑（原型共享）
 * 设计依据：docs/superpowers/specs/2026-07-19-record-combined-template-design.md
 */
(function (global) {
  var RECORD_MODES = [
    { key: 'model-all', label: '单种样品所有试验生成一份文件', dim: 'model', split: 'all' },
    { key: 'model-each', label: '单种样品单种试验生成一份文件', dim: 'model', split: 'each' },
    { key: 'model-multi', label: '单种样品多试验项生成一份文件', dim: 'model', split: 'multi' },
    { key: 'specimen-all', label: '单个样品所有试验生成一份文件', dim: 'specimen', split: 'all' },
    { key: 'specimen-each', label: '单个样品单种试验生成一份文件', dim: 'specimen', split: 'each' },
    { key: 'specimen-multi', label: '单个样品多试验项生成一份文件', dim: 'specimen', split: 'multi' }
  ];

  var RULES_STORAGE_KEY = 'lims_record_sheet_rules_v4';

  var SEED_RULES = [
    { id: 1, bindType: 'category', bindTarget: '安全工器具', modeKey: 'model-all' },
    { id: 2, bindType: 'category', bindTarget: '电网物资', modeKey: 'model-each' },
    { id: 3, bindType: 'model', bindTarget: '绝缘横担 - 通用型', modeKey: 'specimen-each' },
    { id: 4, bindType: 'model', bindTarget: '绝缘操作杆 - 10kV', modeKey: 'model-multi', testGroups: [] }
  ];

  var SAMPLE_TESTS = {
    '绝缘操作杆 - 10kV': ['交流耐压试验', '外观及尺寸', '抗弯动负荷试验', '抗弯静负荷试验'],
    '绝缘硬梯 - 折叠式': ['外观及尺寸', '交流耐压试验', '水平强度试验', '横档强度试验', '连接装置强度试验', '抗压试验（折梯、人字梯）'],
    '绝缘横担 - 通用型': ['外观及尺寸', '交流耐压试验']
  };

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

  function isMultiMode(key) {
    return modeByKey(key).split === 'multi';
  }

  function sampleModelLabel(sample) {
    return (sample.name || '') + (sample.model ? ' - ' + sample.model : '');
  }

  function cloneGroups(groups) {
    return (groups || []).map(function (g) { return (g || []).slice(); });
  }

  function cloneRules(rules) {
    return (rules || []).map(function (r) {
      return {
        id: r.id,
        bindType: r.bindType,
        bindTarget: r.bindTarget,
        modeKey: r.modeKey,
        testGroups: cloneGroups(r.testGroups)
      };
    });
  }

  function loadRules() {
    try {
      var raw = global.localStorage && localStorage.getItem(RULES_STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return cloneRules(parsed);
      }
    } catch (e) { /* keep seed */ }
    var seeded = cloneRules(SEED_RULES);
    saveRules(seeded);
    return seeded;
  }

  function saveRules(rules) {
    try {
      if (global.localStorage) localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(cloneRules(rules)));
    } catch (e) { /* ignore quota */ }
    return rules;
  }

  function nextRuleId(rules) {
    var maxId = 0;
    (rules || []).forEach(function (r) { if (r.id > maxId) maxId = r.id; });
    return maxId + 1;
  }

  function saveModelDefault(modelLabel, modeKey, testGroups) {
    var rules = loadRules();
    var found = null;
    for (var i = 0; i < rules.length; i++) {
      if (rules[i].bindType === 'model' && rules[i].bindTarget === modelLabel) {
        found = rules[i];
        break;
      }
    }
    if (found) {
      found.modeKey = modeKey;
      found.testGroups = isMultiMode(modeKey) ? cloneGroups(testGroups) : [];
    } else {
      rules.push({
        id: nextRuleId(rules),
        bindType: 'model',
        bindTarget: modelLabel,
        modeKey: modeKey,
        testGroups: isMultiMode(modeKey) ? cloneGroups(testGroups) : []
      });
    }
    saveRules(rules);
    return rules;
  }

  function applySessionRules(rules, samples, sessionMap) {
    var next = cloneRules(rules);
    (samples || []).forEach(function (sample) {
      var sess = sessionMap && sessionMap[sample.id];
      if (!sess) return;
      var label = sampleModelLabel(sample);
      var found = null;
      for (var i = 0; i < next.length; i++) {
        if (next[i].bindType === 'model' && next[i].bindTarget === label) {
          found = next[i];
          break;
        }
      }
      if (found) {
        found.modeKey = sess.modeKey;
        found.testGroups = cloneGroups(sess.testGroups);
      } else {
        next.unshift({
          id: -1,
          bindType: 'model',
          bindTarget: label,
          modeKey: sess.modeKey,
          testGroups: cloneGroups(sess.testGroups)
        });
      }
    });
    return next;
  }

  function partitionTestGroups(allTests, testGroups) {
    var used = {};
    var groups = [];
    (testGroups || []).forEach(function (g) {
      var seen = {};
      var names = (g || []).filter(function (t) {
        if (allTests.indexOf(t) < 0 || seen[t]) return false;
        seen[t] = true;
        used[t] = true;
        return true;
      });
      groups.push(names);
    });
    var unassigned = allTests.filter(function (t) { return !used[t]; });
    return { groups: groups, unassigned: unassigned };
  }

  function defaultMultiGroups(fromKey, allTests, existingGroups) {
    var part = partitionTestGroups(allTests, existingGroups);
    if (part.groups.some(function (g) { return g.length; })) {
      return part.groups.length ? part.groups : [[]];
    }
    return [[]];
  }

  function initExportSession(sample, rule) {
    var mode = modeByKey(rule.modeKey);
    var allTests = (sample.groups || []).map(function (g) { return g.title; });
    var groups = cloneGroups(rule.testGroups);
    if (mode.split === 'multi') {
      groups = defaultMultiGroups(mode.key, allTests, groups);
    }
    return { modeKey: mode.key, testGroups: groups, dirty: false };
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

  function specimenIdForTest(sample, specimenIdx, testName) {
    var group = null;
    for (var i = 0; i < sample.groups.length; i++) {
      if (sample.groups[i].title === testName) {
        group = sample.groups[i];
        break;
      }
    }
    if (group && group.rows[specimenIdx]) return group.rows[specimenIdx][0];
    var fallback = specimenIdsFromSample(sample);
    return fallback[specimenIdx] || '';
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

  function resolveCombinedTemplate(modelTreeKey, combinedData, sampleAncestorId, publicData) {
    combinedData = combinedData || [];
    publicData = publicData || [];
    function resolveFile(row) {
      if (!row) return null;
      if (row.refPublicId) {
        for (var p = 0; p < publicData.length; p++) {
          if (publicData[p].id === row.refPublicId && publicData[p].file) return publicData[p].file;
        }
        return null;
      }
      return row.file || null;
    }
    function usable(row) {
      return !!(row && row.configured && resolveFile(row));
    }
    var i;
    for (i = 0; i < combinedData.length; i++) {
      var row = combinedData[i];
      if (row.bindType === 'model' && row.bindTarget === modelTreeKey && usable(row)) return row;
    }
    if (sampleAncestorId) {
      for (i = 0; i < combinedData.length; i++) {
        row = combinedData[i];
        if (row.bindType === 'sample' && row.bindTarget === sampleAncestorId && usable(row)) return row;
      }
    }
    return null;
  }

  function evaluateMergeExportStatus(allTestNames, completedTestNames, sample, templateIndex, combinedData, sampleAncestorId) {
    var incomplete = allTestNames.filter(function (t) {
      return completedTestNames.indexOf(t) < 0;
    });
    if (incomplete.length) {
      return {
        status: 'incomplete',
        statusDetail: '尚有 ' + incomplete.length + ' 项试验未完成：' + incomplete.join('、')
      };
    }
    var modelKey = sample.templateKey || sample.id;
    if (resolveCombinedTemplate(modelKey, combinedData, sampleAncestorId)) {
      return { status: 'ready', statusDetail: '就绪' };
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

  function evaluateMultiExportStatus(selectedNames, completedNames, sample, templateIndex, combinedData, sampleAncestorId) {
    var incomplete = selectedNames.filter(function (t) {
      return completedNames.indexOf(t) < 0;
    });
    if (incomplete.length) {
      return {
        status: 'incomplete',
        statusDetail: '尚有 ' + incomplete.length + ' 项试验未完成：' + incomplete.join('、')
      };
    }
    var modelKey = sample.templateKey || sample.id;
    if (resolveCombinedTemplate(modelKey, combinedData, sampleAncestorId)) {
      return { status: 'ready', statusDetail: '就绪' };
    }
    var missing = missingTemplates(selectedNames, sample, templateIndex);
    if (!missing.length) {
      return { status: 'ready', statusDetail: '就绪' };
    }
    if (missing.length === selectedNames.length) {
      return {
        status: 'missing_template',
        statusDetail: '组合模版和所选试验项单模版均缺少'
      };
    }
    return {
      status: 'missing_template',
      statusDetail: '缺少组合模版或' + missing.join('、') + '试验项单模版'
    };
  }

  function buildFileName(entrustCode, sample, tests, specimenId, mode) {
    var label = sample.name + (sample.model ? '-' + sample.model : '');
    var safe = function (s) { return String(s).replace(/[/\\:*?"<>|]/g, '_'); };
    if (mode.split === 'all') {
      if (mode.dim === 'specimen' && specimenId) {
        return safe(specimenId) + '_' + label + '_记录单.docx';
      }
      return safe(entrustCode + '_' + label + '_记录单.docx');
    }
    var testPart = tests.length === 1 ? tests[0] : tests.join('_');
    if (mode.dim === 'specimen' && specimenId) {
      return safe(specimenId) + '_' + testPart + '记录单.docx';
    }
    return safe(entrustCode + '_' + label + '_' + testPart + '记录单.docx');
  }

  function evaluateStatus(allTestNames, completedTestNames, sample, templateIndex, combinedData, sampleAncestorId) {
    return evaluateMergeExportStatus(allTestNames, completedTestNames, sample, templateIndex, combinedData, sampleAncestorId);
  }

  function buildTestsMeta(allNames, completedNames) {
    return allNames.map(function (name) {
      return { name: name, done: completedNames.indexOf(name) >= 0 };
    });
  }

  function buildRecordFilePreview(entrustCode, samples, rules, templateIndex, combinedData, sampleAncestorMap) {
    combinedData = combinedData || [];
    sampleAncestorMap = sampleAncestorMap || {};
    var files = [];
    var fileId = 0;

    samples.forEach(function (sample) {
      var rule = resolveRecordRule(sample, rules);
      var mode = modeByKey(rule.modeKey);
      var allTests = sample.groups.map(function (g) { return g.title; });
      var completedTests = sample.groups.filter(isGroupComplete).map(function (g) { return g.title; });
      var sampleLabel = sampleModelLabel(sample);
      var modelKey = sample.templateKey || sample.id;
      var sampleAncestorId = sampleAncestorMap[modelKey] || sample.sampleBindTarget || null;

      function emitFile(opts) {
        files.push({
          id: 'f' + (++fileId),
          fileName: opts.fileName,
          sampleId: sample.id,
          sampleLabel: sampleLabel,
          specimenId: opts.specimenId || null,
          tests: opts.tests,
          status: opts.status,
          statusDetail: opts.statusDetail,
          modeKey: mode.key,
          ruleId: rule.id,
          checked: opts.status === 'ready',
          groupIndex: typeof opts.groupIndex === 'number' ? opts.groupIndex : null
        });
      }

      function emitMultiGroup(names, groupIndex, specimenId, completedNames) {
        if (!names.length) return;
        var evalG = evaluateMultiExportStatus(
          names,
          completedNames,
          sample,
          templateIndex,
          combinedData,
          sampleAncestorId
        );
        emitFile({
          fileName: buildFileName(entrustCode, sample, names, specimenId, mode),
          specimenId: specimenId,
          tests: buildTestsMeta(names, completedNames),
          status: evalG.status,
          statusDetail: evalG.statusDetail,
          groupIndex: groupIndex
        });
      }

      if (mode.split === 'multi') {
        var part = partitionTestGroups(allTests, rule.testGroups);
        if (mode.dim === 'model') {
          part.groups.forEach(function (names, gi) {
            var completedInGroup = names.filter(function (t) { return completedTests.indexOf(t) >= 0; });
            emitMultiGroup(names, gi, null, completedInGroup);
          });
        } else {
          var specIdsMulti = specimenIdsFromSample(sample);
          specIdsMulti.forEach(function (specimenId, si) {
            var specimenCompleted = allTests.filter(function (_t, ti) {
              return isSpecimenTestComplete(sample, si, sample.groups[ti]);
            });
            part.groups.forEach(function (names, gi) {
              var completedInGroup = names.filter(function (t) { return specimenCompleted.indexOf(t) >= 0; });
              var rowSpecimenId = names.length ? specimenIdForTest(sample, si, names[0]) : specimenId;
              emitMultiGroup(names, gi, rowSpecimenId, completedInGroup);
            });
          });
        }
      } else if (mode.dim === 'model') {
        if (mode.split === 'all') {
          var evalAll = evaluateMergeExportStatus(allTests, completedTests, sample, templateIndex, combinedData, sampleAncestorId);
          emitFile({
            fileName: buildFileName(entrustCode, sample, allTests, null, mode),
            tests: buildTestsMeta(allTests, completedTests),
            status: evalAll.status,
            statusDetail: evalAll.statusDetail
          });
        } else {
          completedTests.forEach(function (testName) {
            var missing = missingTemplates([testName], sample, templateIndex);
            var st = missing.length
              ? { status: 'missing_template', statusDetail: '缺少「' + missing[0] + '」的模版' }
              : { status: 'ready', statusDetail: '就绪' };
            emitFile({
              fileName: buildFileName(entrustCode, sample, [testName], null, mode),
              tests: [{ name: testName, done: true }],
              status: st.status,
              statusDetail: st.statusDetail
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
            var evalSpec = evaluateMergeExportStatus(allTests, specimenCompleted, sample, templateIndex, combinedData, sampleAncestorId);
            emitFile({
              fileName: buildFileName(entrustCode, sample, allTests, specimenId, mode),
              specimenId: specimenId,
              tests: buildTestsMeta(allTests, specimenCompleted),
              status: evalSpec.status,
              statusDetail: evalSpec.statusDetail
            });
          } else {
            specimenCompleted.forEach(function (testName) {
              var miss = missingTemplates([testName], sample, templateIndex);
              var st2 = miss.length
                ? { status: 'missing_template', statusDetail: '缺少「' + miss[0] + '」的模版' }
                : { status: 'ready', statusDetail: '就绪' };
              var rowSpecimenId = specimenIdForTest(sample, si, testName);
              emitFile({
                fileName: buildFileName(entrustCode, sample, [testName], rowSpecimenId, mode),
                specimenId: rowSpecimenId,
                tests: [{ name: testName, done: true }],
                status: st2.status,
                statusDetail: st2.statusDetail
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
    SAMPLE_TESTS: SAMPLE_TESTS,
    SEED_RULES: SEED_RULES,
    modeByKey: modeByKey,
    modeLabel: modeLabel,
    isMultiMode: isMultiMode,
    sampleModelLabel: sampleModelLabel,
    cloneGroups: cloneGroups,
    loadRules: loadRules,
    saveRules: saveRules,
    saveModelDefault: saveModelDefault,
    applySessionRules: applySessionRules,
    partitionTestGroups: partitionTestGroups,
    defaultMultiGroups: defaultMultiGroups,
    evaluateMultiExportStatus: evaluateMultiExportStatus,
    initExportSession: initExportSession,
    resolveRecordRule: resolveRecordRule,
    resolveCombinedTemplate: resolveCombinedTemplate,
    buildRecordFilePreview: buildRecordFilePreview
  };
})(typeof window !== 'undefined' ? window : this);
