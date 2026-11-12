/**
 * AI 审查 Mock Store（M1 原型 · 7 张表 localStorage）
 */
(function (global) {
  var STORAGE_KEY = 'lims.aiReview.v1';

  var DEFAULT_RULES = [
    { id: 'A01-1', group: 'A01', category: 'A', name: '样品编号必填且符合编号规则', expr: 'nonempty(sample_no) && match(sample_no)', severity: '严重', is_universal: true, param_schema: {}, enabled: true, status: '待审核员确认' },
    { id: 'A01-6', group: 'A01', category: 'A', name: '检测标准号必须带年号', expr: 'has_year(test_standard)', severity: '严重', is_universal: true, param_schema: {}, enabled: true, status: '待审核员确认' },
    { id: 'A02-1', group: 'A02', category: 'A', name: '委托检测项目都有对应实测结果', expr: 'entrust ⊆ result_params', severity: '严重', is_universal: true, param_schema: {}, enabled: true, status: '待审核员确认' },
    { id: 'B01-1', group: 'B01', category: 'B', name: '关键日期先后', expr: 'receive <= test <= report', severity: '严重', is_universal: true, param_schema: {}, enabled: true, status: '待审核员确认' },
    { id: 'B01-2', group: 'B01', category: 'B', name: '设备校准有效期覆盖检测日期', expr: 'calib_from <= test <= calib_to', severity: '严重', is_universal: true, param_schema: {}, enabled: true, status: '待审核员确认' },
    { id: 'B03-1', group: 'B03', category: 'B', name: '报告引用标准号等于实际检测标准', expr: 'cited == test_standard', severity: '一般', is_universal: true, param_schema: {}, enabled: true, status: '待审核员确认' },
    { id: 'C02-5', group: 'C02', category: 'C', name: '检测/审核/批准签名位齐全', expr: 'signatures complete', severity: '严重', is_universal: true, param_schema: {}, enabled: true, status: '待审核员确认' },
    { id: 'C01-4', group: 'C01', category: 'C', name: '计量单位与参数匹配', expr: 'units allowed', severity: '一般', is_universal: true, param_schema: {}, enabled: true, status: '待审核员确认' },
  ];

  var DEFAULT_CATEGORIES = [
    { category_code: 'CAT-CABLE', category_name: '电力电缆', enabled: true, is_bound: false },
    { category_code: 'CAT-BOLT', category_name: '高强度螺栓连接副', enabled: true, is_bound: false },
    { category_code: 'CAT-GLOVE', category_name: '绝缘手套', enabled: true, is_bound: false },
    { category_code: 'CAT-PIPE', category_name: '电缆保护管', enabled: true, is_bound: false },
    { category_code: 'CAT-BELT', category_name: '安全带', enabled: true, is_bound: false },
    { category_code: 'CAT-FITTING', category_name: '导线金具', enabled: true, is_bound: false },
  ];

  function baseReport(overrides) {
    var r = {
      id: 'r-clean',
      report_no: 'Rpt2026-001',
      biz_type: '委托检验',
      category_code: 'CAT-CABLE',
      category_name: '电力电缆',
      sample_no: 'SC2026-0001',
      test_standard: 'GB/T 12706.1-2020',
      cited_standard: 'GB/T 12706.1-2020',
      entrust_items: ['绝缘厚度', '导体电阻'],
      result_params: ['绝缘厚度', '导体电阻'],
      receive_date: '2026-07-10',
      test_date: '2026-07-15',
      report_date: '2026-07-18',
      device_calib_from: '2026-01-01',
      device_calib_to: '2026-12-31',
      signatures: { tester: '张三', reviewer: '李四', approver: '王五' },
      units: [{ param: '绝缘厚度', unit: 'mm' }, { param: '导体电阻', unit: 'Ω' }],
    };
    for (var k in overrides) if (Object.prototype.hasOwnProperty.call(overrides, k)) r[k] = overrides[k];
    return r;
  }

  var DEFAULT_REPORTS = [
    baseReport({ id: 'r-clean', biz_type: '委托检验' }),
    baseReport({ id: 'r-type', report_no: 'Rpt2026-T01', biz_type: '型式试验', category_code: 'CAT-BOLT' }),
    baseReport({ id: 'r-factory', report_no: 'Rpt2026-F01', biz_type: '出厂试验', category_code: 'CAT-GLOVE' }),
    baseReport({ id: 'r-routine', report_no: 'Rpt2026-R01', biz_type: '例行试验', category_code: 'CAT-PIPE' }),
    baseReport({ id: 'r-sample', report_no: 'Rpt2026-S01', biz_type: '抽样检验', category_code: 'CAT-BELT' }),
    baseReport({
      id: 'r-uncat',
      report_no: 'Rpt2026-U01',
      biz_type: '委托检验',
      category_code: null,
      category_name: '',
    }),
    baseReport({ id: 'r-bad-no', sample_no: '', biz_type: '委托检验' }),
    baseReport({ id: 'r-bad-std', test_standard: 'GB/T 1231', biz_type: '型式试验' }),
    baseReport({
      id: 'r-bad-entrust',
      entrust_items: ['扭矩系数', '抗拉强度'],
      result_params: ['扭矩系数'],
      biz_type: '出厂试验',
    }),
    baseReport({
      id: 'r-bad-date',
      receive_date: '2026-07-20',
      test_date: '2026-07-15',
      report_date: '2026-07-18',
      biz_type: '例行试验',
    }),
    baseReport({
      id: 'r-bad-calib',
      device_calib_to: '2026-07-01',
      biz_type: '抽样检验',
    }),
    baseReport({
      id: 'r-bad-cited',
      cited_standard: 'GB/T 9999-2020',
      biz_type: '委托检验',
    }),
    baseReport({
      id: 'r-bad-sign',
      signatures: { tester: '张三', reviewer: '李四', approver: '' },
      biz_type: '型式试验',
    }),
    baseReport({
      id: 'r-bad-unit',
      units: [{ param: '抗拉强度', unit: 'invalid' }],
      biz_type: '出厂试验',
    }),
  ];

  var DEFAULT = {
    rules: DEFAULT_RULES,
    categories: DEFAULT_CATEGORIES,
    bindings: [],
    reports: DEFAULT_REPORTS,
    results: [],
    issues: [],
    feedback: [],
    cases: [],
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function readRoot() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT);
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return clone(DEFAULT);
      return parsed;
    } catch (e) {
      return clone(DEFAULT);
    }
  }

  function writeRoot(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  function load() {
    return readRoot();
  }

  function reset() {
    var s = clone(DEFAULT);
    writeRoot(s);
    return s;
  }

  function findReport(data, id) {
    for (var i = 0; i < data.reports.length; i++) {
      if (data.reports[i].id === id) return data.reports[i];
    }
    return null;
  }

  global.AiReviewStore = {
    STORAGE_KEY: STORAGE_KEY,
    reset: reset,
    getRules: function () { return clone(load().rules); },
    setRuleEnabled: function (id, enabled) {
      var data = load();
      for (var i = 0; i < data.rules.length; i++) {
        if (data.rules[i].id === id) {
          data.rules[i].enabled = !!enabled;
          writeRoot(data);
          return;
        }
      }
    },
    getCategories: function () { return clone(load().categories); },
    getBindings: function () { return clone(load().bindings); },
    getReports: function () { return clone(load().reports); },
    getReport: function (id) { return clone(findReport(load(), id)); },
    getResults: function () { return clone(load().results); },
    saveResult: function (result) {
      var data = load();
      data.results.push(clone(result));
      if (result.issues && result.issues.length) {
        result.issues.forEach(function (iss) {
          data.issues.push(Object.assign({ report_id: result.report_id }, iss));
        });
      }
      writeRoot(data);
    },
    getIssues: function () { return clone(load().issues); },
    getFeedback: function () { return clone(load().feedback); },
    saveFeedback: function (obj) {
      var data = load();
      data.feedback.push(clone(obj));
      writeRoot(data);
    },
    getCases: function () { return clone(load().cases); },
    appendCase: function (c) {
      var data = load();
      data.cases.push(clone(c));
      writeRoot(data);
    },
    clone: clone,
  };
})(window);
