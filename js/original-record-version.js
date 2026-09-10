/**
 * 原始记录单 · 文件身份 / 失效 / 版本链（原型共享）
 * 设计：docs/superpowers/specs/2026-08-18-original-record-versioning-design.md
 */
(function (global) {
  var STORAGE_KEY = 'lims_original_records_v3';
  var ENTRUST = 'SC2026/0073';

  var MODE_LABELS = {
    'model-all': '单种样品所有试验生成一份文件',
    'model-each': '单种样品单种试验生成一份文件',
    'model-multi': '单种样品多试验项生成一份文件',
    'specimen-all': '单个样品所有试验生成一份文件',
    'specimen-each': '单个样品单种试验生成一份文件',
    'specimen-multi': '单个样品多试验项生成一份文件'
  };

  var SPEC_A = 'SC2026/00730101-01';
  var SPEC_B = 'SC2026/00730101-02';
  var SPEC_C = 'SC2026/00730101-03';

  function sortCopy(arr) {
    return (arr || []).slice().sort();
  }

  function identityKey(modeKey, specimenIds, testNames) {
    return [modeKey || '', sortCopy(specimenIds).join(','), sortCopy(testNames).join(',')].join('|');
  }

  /** 历史「说明」列固定文案 */
  function formatChangeNote(kind, extra) {
    extra = extra || {};
    var names = extra.names || extra.name;
    if (typeof names === 'string') names = [names];
    names = names || [];
    if (kind === 'retest') return '退回-更改检测结果';
    if (kind === 'data_edit') return '退回-更改检测结果';
    if (kind === 'delete_sample') return '变更-删除样品';
    if (kind === 'delete_test') return '变更-删除试验项：' + names.join('、');
    if (kind === 'change_test') {
      var bits = [];
      if (extra.added && extra.added.length) bits.push('变更-增加试验项：' + extra.added.join('、'));
      if (extra.removed && extra.removed.length) bits.push('变更-删除试验项：' + extra.removed.join('、'));
      return bits.join('；') || '变更-增加试验项';
    }
    if (kind === 'reviewer') return '退回-重新分配试验员';
    if (kind === 'entrust_info') return '变更-变更基本委托信息：' + (extra.detail || extra.text || '');
    if (kind === 'sample_info') return '变更-样品修改变更：' + (extra.detail || extra.text || names.join('、'));
    return extra.text || '';
  }

  function historyNote(v) {
    if (!v) return '';
    if (v.current && v.invalid && v.invalidReason) return v.invalidReason;
    return v.note || '';
  }

  function nowStamp() {
    function p(n) { return n < 10 ? '0' + n : String(n); }
    var d = new Date();
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function fileName(testName) {
    return ENTRUST + '-' + testName + '-原始记录.docx';
  }

  function makeVersion(opts) {
    var specIds = sortCopy(opts.specimenIds);
    var tests = sortCopy(opts.testNames);
    var modeKey = opts.modeKey || 'model-each';
    return {
      id: opts.id,
      identityKey: identityKey(modeKey, specIds, tests),
      modeKey: modeKey,
      specimenIds: specIds,
      testNames: tests,
      fileName: opts.fileName || fileName(tests[0] || '记录单'),
      major: opts.major || 1,
      minor: 0,
      label: 'V' + (opts.major || 1) + '.0',
      source: 'SYSTEM',
      origin: opts.origin || 'generate',
      note: opts.note || '',
      invalid: !!opts.invalid,
      invalidReason: opts.invalidReason || '',
      invalidAt: opts.invalidAt || '',
      current: opts.current !== false,
      operator: opts.operator || 'admin',
      createdAt: opts.createdAt || '2026-07-08 13:54:02'
    };
  }

  function seed() {
    return {
      entrustCode: ENTRUST,
      liveSpecimenIds: [SPEC_A, SPEC_B],
      deletedSpecimenIds: [SPEC_C],
      files: [
        makeVersion({
          id: 'hist-ac-v1',
          specimenIds: [SPEC_A, SPEC_B],
          testNames: ['交流耐压'],
          major: 1,
          current: false,
          origin: 'generate',
          note: '',
          createdAt: '2026-07-08 09:12:00'
        }),
        makeVersion({
          id: 'cur-ac',
          specimenIds: [SPEC_A, SPEC_B],
          testNames: ['交流耐压'],
          major: 2,
          current: true,
          origin: 'regenerate',
          note: '退回-更改检测结果',
          invalid: true,
          invalidReason: '退回-更改检测结果',
          invalidAt: '2026-08-18 10:20:00',
          createdAt: '2026-07-09 11:08:33'
        }),
        makeVersion({
          id: 'cur-dim',
          specimenIds: [SPEC_A, SPEC_B],
          testNames: ['外观尺寸'],
          major: 1,
          current: true,
          createdAt: '2026-07-08 13:54:02'
        }),
        makeVersion({
          id: 'cur-bend',
          specimenIds: [SPEC_A, SPEC_B, SPEC_C],
          testNames: ['抗弯静负荷'],
          major: 1,
          current: true,
          note: '',
          invalid: true,
          invalidReason: '变更-删除样品',
          invalidAt: '2026-08-18 09:40:00',
          createdAt: '2026-07-08 15:02:18'
        })
      ]
    };
  }

  var state = null;
  var listeners = [];

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { /* ignore */ }
    });
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function load() {
    if (state) return state;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = JSON.parse(raw);
        if (state && state.files && state.files.length) return state;
      }
    } catch (e) { /* ignore */ }
    state = seed();
    persist();
    return state;
  }

  function save() {
    persist();
    emit();
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function listCurrent() {
    return load().files.filter(function (f) { return f.current; });
  }

  function listValidCurrent() {
    return listCurrent().filter(function (f) { return !f.invalid; });
  }

  function findById(id) {
    var files = load().files;
    for (var i = 0; i < files.length; i++) {
      if (files[i].id === id) return files[i];
    }
    return null;
  }

  function historyOf(key) {
    return load().files.filter(function (f) { return f.identityKey === key; })
      .sort(function (a, b) {
        if (a.major !== b.major) return a.major - b.major;
        return String(a.createdAt).localeCompare(String(b.createdAt));
      });
  }

  function covers(file, specimenIds, testNames) {
    var hitSpec = !(specimenIds && specimenIds.length) || specimenIds.some(function (id) {
      return file.specimenIds.indexOf(id) >= 0;
    });
    var hitTest = !(testNames && testNames.length) || testNames.some(function (t) {
      return file.testNames.indexOf(t) >= 0;
    });
    return hitSpec && hitTest;
  }

  function invalidateByCoverage(opts) {
    opts = opts || {};
    load();
    var reason = opts.reason || '覆盖范围内的数据已变更';
    var stamped = nowStamp();
    var n = 0;
    state.files.forEach(function (f) {
      if (!f.current || f.invalid) return;
      if (!covers(f, opts.specimenIds, opts.testNames)) return;
      f.invalid = true;
      f.invalidReason = reason;
      f.invalidAt = stamped;
      n += 1;
    });
    save();
    return n;
  }

  function deleteSpecimen(specId, reason) {
    load();
    if (state.liveSpecimenIds.indexOf(specId) >= 0) {
      state.liveSpecimenIds = state.liveSpecimenIds.filter(function (id) { return id !== specId; });
    }
    if (state.deletedSpecimenIds.indexOf(specId) < 0) state.deletedSpecimenIds.push(specId);
    return invalidateByCoverage({
      specimenIds: [specId],
      reason: reason || formatChangeNote('delete_sample')
    });
  }

  function remainingSpecimens(file) {
    var live = load().liveSpecimenIds;
    return (file.specimenIds || []).filter(function (id) { return live.indexOf(id) >= 0; });
  }

  function missingCoverage(file) {
    var live = load().liveSpecimenIds;
    var missingSpecs = (file.specimenIds || []).filter(function (id) { return live.indexOf(id) < 0; });
    return { specimens: missingSpecs, tests: [] };
  }

  function canKeepIdentity(file) {
    return missingCoverage(file).specimens.length === 0;
  }

  function nextId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1000);
  }

  function exportFile(preview) {
    load();
    var specIds = sortCopy(preview.specimenIds);
    var tests = sortCopy(preview.testNames);
    var modeKey = preview.modeKey || 'model-each';
    var key = identityKey(modeKey, specIds, tests);
    var current = null;
    state.files.forEach(function (f) {
      if (f.identityKey === key && f.current) current = f;
    });
    var major = 1;
    if (current) {
      current.current = false;
      major = (current.major || 1) + 1;
    }
    var row = makeVersion({
      id: nextId('exp'),
      specimenIds: specIds,
      testNames: tests,
      modeKey: modeKey,
      fileName: preview.fileName || fileName(tests[0] || '记录单'),
      major: major,
      current: true,
      origin: current ? 'regenerate' : 'generate',
      note: current && current.invalid ? (current.invalidReason || '') : (preview.note || ''),
      operator: 'admin',
      createdAt: nowStamp()
    });
    state.files.push(row);
    save();
    return row;
  }

  function exportRemaining(fileId) {
    var file = findById(fileId);
    if (!file) return { ok: false, error: '文件不存在' };
    var remain = remainingSpecimens(file);
    if (!remain.length) return { ok: false, error: 'empty' };
    var row = exportFile({
      specimenIds: remain,
      testNames: file.testNames,
      modeKey: file.modeKey,
      fileName: fileName(file.testNames[0] || '记录单'),
      note: file.invalidReason || formatChangeNote('delete_sample')
    });
    row.origin = 'export_remaining';
    save();
    return { ok: true, file: row };
  }

  function hintForPreview(preview) {
    var key = identityKey(preview.modeKey || 'model-each', preview.specimenIds, preview.testNames);
    var current = null;
    listCurrent().forEach(function (f) {
      if (f.identityKey === key) current = f;
    });
    if (!current) return { code: 'new', text: '将生成新文件' };
    if (current.invalid) return { code: 'revalid', text: '将重新生成并解除失效' };
    return { code: 'version', text: '将生成新版本' };
  }

  function resetDemo() {
    state = seed();
    persist();
    emit();
    return state;
  }

  function modeLabel(key) {
    return MODE_LABELS[key] || key;
  }

  global.OriginalRecordVersion = {
    ENTRUST: ENTRUST,
    SPEC_A: SPEC_A,
    SPEC_B: SPEC_B,
    SPEC_C: SPEC_C,
    MODE_LABELS: MODE_LABELS,
    identityKey: identityKey,
    formatChangeNote: formatChangeNote,
    historyNote: historyNote,
    modeLabel: modeLabel,
    load: load,
    onChange: onChange,
    listCurrent: listCurrent,
    listValidCurrent: listValidCurrent,
    findById: findById,
    historyOf: historyOf,
    invalidateByCoverage: invalidateByCoverage,
    deleteSpecimen: deleteSpecimen,
    remainingSpecimens: remainingSpecimens,
    missingCoverage: missingCoverage,
    canKeepIdentity: canKeepIdentity,
    exportFile: exportFile,
    exportRemaining: exportRemaining,
    hintForPreview: hintForPreview,
    resetDemo: resetDemo,
    nowStamp: nowStamp
  };
})(typeof window !== 'undefined' ? window : this);
