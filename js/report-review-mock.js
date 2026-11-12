/**
 * 报告审核模块 Mock 基座（报告审核主查询页 / 审核详情页 / 报告编制页共用）
 *
 * 设计目标：把「报告审核」这条链路的数据底打好，AI 审查结论直接复用已建的
 *   js/ai-review-engine.js + js/ai-review-store.js（8 条确定性通用规则），
 *   后续 AI 审核工作台直接读同一份数据，避免各页自带一套互相对不上的 mock。
 *
 * 结论口径（本模块对外统一为三态）：
 *   命中「严重」→ 不通过（进入审核即由 AI 自动回退到「报告编制」）
 *   仅命中「一般」→ 需复核（交人工：同意退回 / 不同意直接人工通过）
 *   全通过      → 通过（交人工：同意执行通过 / 不同意但仍执行通过）
 *
 * 标注（label）：仅用于 AI 模型持续学习，不对上下游人员展示；取值 正常 / 误报 / 漏报。
 */
(function (global) {
  function baseReport(overrides) {
    var r = {
      sample_no: 'SC2026-0001',
      test_standard: 'GB/T 13685-2017',
      cited_standard: 'GB/T 13685-2017',
      entrust_items: ['密封性', '壁厚'],
      result_params: ['密封性', '壁厚'],
      receive_date: '2026-08-28',
      test_date: '2026-09-01',
      report_date: '2026-09-03',
      device_calib_from: '2026-01-01',
      device_calib_to: '2026-12-31',
      signatures: { tester: '李明', reviewer: '王芳', approver: '赵强' },
      units: [{ param: '壁厚', unit: 'mm' }],
      category_code: 'CAT-FITTING',
    };
    for (var k in overrides) if (Object.prototype.hasOwnProperty.call(overrides, k)) r[k] = overrides[k];
    return r;
  }

  // 一张委托可生成多份报告；每份报告都带 AI 审查所需字段 + 展示字段。
  var ENTRUSTS = [
    {
      code: 'SC2026/0238', contract: '/', customer: '铁流技术', sample: '压盖总成',
      sendDate: '2026-09-03', requireDate: '2026-09-08', acceptDate: '2026-09-03',
      priority: '常规', status: '报告审核', compiler: 'admin',
      reports: [
        baseReport({
          id: 'rr-0238-01', reportNo: 'SC2026/0238-01', reportName: 'SC2026-0238-01检测报告.docx',
          sampleNos: ['SC2026/0238-0101'], sample_no: 'SC2026-0238',
        }),
        baseReport({
          id: 'rr-0238-02', reportNo: 'SC2026/0238-02', reportName: 'SC2026-0238-02检测报告.docx',
          sampleNos: ['SC2026/0238-0102'], sample_no: 'SC2026-0239',
          // 命中「一般」：引用标准号与实检标准不一致(B03-1) + 计量单位越界(C01-4) → 需复核
          cited_standard: 'GB/T 13685-2011',
          units: [{ param: '扭矩', unit: 'kgf·m' }],
        }),
        baseReport({
          id: 'rr-0238-03', reportNo: 'SC2026/0238-03', reportName: 'SC2026-0238-03检测报告.docx',
          sampleNos: ['SC2026/0238-0103'], sample_no: 'SC2026-0240',
          // 命中「严重」：批准签名缺失(C02-5) → 不通过 → 自动回退报告编制
          signatures: { tester: '李明', reviewer: '王芳', approver: '' },
        }),
      ],
    },
    {
      code: 'SC2026/0231', contract: '/', customer: '铁流技术', sample: '压盖总成',
      sendDate: '2026-09-01', requireDate: '2026-09-02', acceptDate: '2026-09-01',
      priority: '常规', status: '报告审核', compiler: 'admin',
      reports: [
        baseReport({
          id: 'rr-0231-01', reportNo: 'SC2026/0231-01', reportName: 'SC2026-0231-01检测报告.docx',
          sampleNos: ['SC2026/0231-0101'], sample_no: 'SC2026-0231',
        }),
      ],
    },
    {
      code: 'SC2026/0200', contract: '/', customer: '智载科技', sample: '复合绝缘盖板',
      sendDate: '2026-06-10', requireDate: '2026-06-20', acceptDate: '2026-06-10',
      priority: '常规', status: '报告审核', compiler: 'admin',
      reports: [
        baseReport({
          id: 'rr-0200-01', reportNo: 'SC2026/0200-01', reportName: 'SC2026-0200-01检测报告.docx',
          sampleNos: ['SC2026/0200-0101'], sample_no: 'SC2026-0200',
          category_code: null,
          // 命中「一般」：计量单位越界(C01-4) → 需复核（同时演示未配置品类提示）
          units: [{ param: '绝缘电阻', unit: 'GΩ' }],
        }),
      ],
    },
  ];

  function ruleName(id, rules) {
    for (var i = 0; i < rules.length; i++) if (rules[i].id === id) return rules[i].name;
    return id;
  }

  /**
   * 评估单份报告：返回三态结论 + 通过项 / 需复核项 / 不通过项（均带规则详情）。
   * 复用 AiReviewEngine：run() 给失败清单+notices，evalRule() 逐条拿通过项详情。
   */
  function evalReport(report) {
    var rules = global.AiReviewStore.getRules();
    var cats = global.AiReviewStore.getCategories();
    var binds = global.AiReviewStore.getBindings();
    var run = global.AiReviewEngine.run(report, rules, cats, binds);

    var passed = [];
    rules.forEach(function (rule) {
      if (!rule.enabled) return;
      var er = global.AiReviewEngine.evalRule(rule.id, report);
      if (er.passed) {
        passed.push({
          rule_id: rule.id, name: ruleName(rule.id, rules), category: er.category,
          severity: er.severity, message: er.message, evidence: er.evidence,
        });
      }
    });

    var failed = run.issues.map(function (iss) {
      return {
        rule_id: iss.rule_id, name: ruleName(iss.rule_id, rules), category: iss.category,
        severity: iss.severity, message: iss.message, evidence: iss.evidence,
      };
    });

    var conclusion = '通过';
    if (run.conclusion === '不通过') conclusion = '不通过';
    else if (run.conclusion === '通过待确认') conclusion = '需复核';

    return {
      report_id: report.id,
      conclusion: conclusion,
      passed: passed,
      failed: failed,
      review: failed.filter(function (f) { return f.severity === '一般'; }),
      severe: failed.filter(function (f) { return f.severity === '严重'; }),
      notices: run.notices || [],
      raw: run,
    };
  }

  function getEntrust(code) {
    for (var i = 0; i < ENTRUSTS.length; i++) if (ENTRUSTS[i].code === code) return ENTRUSTS[i];
    return null;
  }

  // 供「报告编制」页展示：AI 审核不通过被自动回退的报告（跨页同源）。
  function aiReturnedReports() {
    var out = [];
    ENTRUSTS.forEach(function (ent) {
      ent.reports.forEach(function (rep) {
        var r = evalReport(rep);
        if (r.conclusion === '不通过') {
          out.push({
            entrustCode: ent.code, customer: ent.customer, sample: ent.sample,
            reportNo: rep.reportNo, reasons: r.severe,
          });
        }
      });
    });
    return out;
  }

  global.ReportReviewMock = {
    ENTRUSTS: ENTRUSTS,
    getEntrust: getEntrust,
    evalReport: evalReport,
    aiReturnedReports: aiReturnedReports,
    CONCLUSION_META: {
      '通过': { cls: 'bg-emerald-100 text-emerald-700', icon: 'fa-check-circle' },
      '需复核': { cls: 'bg-amber-100 text-amber-700', icon: 'fa-exclamation-circle' },
      '不通过': { cls: 'bg-red-100 text-red-700', icon: 'fa-times-circle' },
    },
    LABEL_NOTE: '标注仅用于 AI 模型持续学习优化，不对上下游人员展示',
  };
})(window);
