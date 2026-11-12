/**
 * AI 审查规则引擎（M1 · 8 条确定性通用规则）
 */
(function (global) {
  var ALLOWED_UNITS = ['MPa', 'kN', 'HRC', 'μm', 'kV', 'mA', 'mm', '%', 'N·m', 'Ω'];
  var SAMPLE_NO_RE = /^[A-Za-z]{1,6}\d{4}-\d{2,}$/;
  var YEAR_RE = /-\d{4}$/;

  function ruleMeta(id) {
    var map = {
      'A01-1': { group: 'A01', category: 'A 数据完整性', severity: '严重' },
      'A01-6': { group: 'A01', category: 'A 数据完整性', severity: '严重' },
      'A02-1': { group: 'A02', category: 'A 数据完整性', severity: '严重' },
      'B01-1': { group: 'B01', category: 'B 逻辑一致性', severity: '严重' },
      'B01-2': { group: 'B01', category: 'B 逻辑一致性', severity: '严重' },
      'B03-1': { group: 'B03', category: 'B 逻辑一致性', severity: '一般' },
      'C02-5': { group: 'C02', category: 'C 格式规范性', severity: '严重' },
      'C01-4': { group: 'C01', category: 'C 格式规范性', severity: '一般' },
    };
    return map[id] || { group: '', category: '', severity: '一般' };
  }

  function nonempty(s) {
    return s != null && String(s).trim() !== '';
  }

  function evalRule(ruleId, report) {
    var meta = ruleMeta(ruleId);
    var passed = true;
    var message = '通过';
    var evidence = {};

    if (ruleId === 'A01-1') {
      passed = nonempty(report.sample_no) && SAMPLE_NO_RE.test(String(report.sample_no).trim());
      if (!passed) message = '样品编号为空或不符合编号规则';
    } else if (ruleId === 'A01-6') {
      passed = nonempty(report.test_standard) && YEAR_RE.test(String(report.test_standard).trim());
      if (!passed) message = '检测标准号必须带年号';
    } else if (ruleId === 'A02-1') {
      var ent = report.entrust_items || [];
      var res = report.result_params || [];
      if (!ent.length) {
        passed = true;
      } else {
        passed = ent.every(function (item) {
          return res.indexOf(item) !== -1;
        });
      }
      if (!passed) message = '存在委托检测项目无对应实测结果';
    } else if (ruleId === 'B01-1') {
      var rd = report.receive_date;
      var td = report.test_date;
      var rpd = report.report_date;
      if (!nonempty(rd) || !nonempty(td) || !nonempty(rpd)) {
        passed = true;
        evidence.skipped = '缺核心日期';
        message = '跳过（缺核心日期）';
      } else if (rd <= td && td <= rpd) {
        passed = true;
      } else {
        passed = false;
        message = '关键日期先后错误：应收样 ≤ 检测 ≤ 报告';
        evidence = { receive_date: rd, test_date: td, report_date: rpd };
      }
    } else if (ruleId === 'B01-2') {
      var cf = report.device_calib_from;
      var ct = report.device_calib_to;
      var tdt = report.test_date;
      passed = nonempty(cf) && nonempty(ct) && nonempty(tdt) && cf <= tdt && tdt <= ct;
      if (!passed) message = '设备校准有效期未覆盖检测日期';
    } else if (ruleId === 'B03-1') {
      passed = String(report.cited_standard) === String(report.test_standard);
      if (!passed) message = '报告引用标准号与实际检测标准不一致';
    } else if (ruleId === 'C02-5') {
      var sig = report.signatures || {};
      passed = nonempty(sig.tester) && nonempty(sig.reviewer) && nonempty(sig.approver);
      if (!passed) message = '检测/审核/批准签名位不完整';
    } else if (ruleId === 'C01-4') {
      var units = report.units || [];
      if (!units.length) {
        passed = true;
      } else {
        passed = units.every(function (u) {
          return u && nonempty(u.unit) && ALLOWED_UNITS.indexOf(u.unit) !== -1;
        });
      }
      if (!passed) message = '存在计量单位与参数不匹配';
    } else {
      passed = false;
      message = '未知规则';
    }

    return { passed: passed, message: message, evidence: evidence, severity: meta.severity, rule_id: ruleId, group: meta.group, category: meta.category };
  }

  function hasCategoryBinding(categoryCode, bindings) {
    if (!categoryCode || !bindings || !bindings.length) return false;
    return bindings.some(function (b) {
      return b.category_code === categoryCode && b.enabled;
    });
  }

  function run(report, rules, categories, bindings) {
    rules = rules || [];
    bindings = bindings || [];
    var issues = [];
    var notices = [];
    var total = 0;
    var failed = 0;
    var bySeverity = { 严重: 0, 一般: 0 };

    rules.forEach(function (rule) {
      if (!rule.enabled) return;
      total++;
      var er = evalRule(rule.id, report);
      if (!er.passed) {
        failed++;
        if (er.severity === '严重' || er.severity === '一般') bySeverity[er.severity] = (bySeverity[er.severity] || 0) + 1;
        issues.push({
          rule_id: rule.id,
          group: er.group,
          category: er.category,
          severity: er.severity,
          passed: false,
          message: er.message,
          evidence: er.evidence,
        });
      }
    });

    var rd = report.receive_date;
    var td = report.test_date;
    var rpd = report.report_date;
    if (!nonempty(rd) || !nonempty(td) || !nonempty(rpd)) {
      notices.push({
        code: 'DATE-MISSING',
        severity: '提示',
        message: '缺核心日期（收样/检测/报告），请先补全数据完整性',
      });
    }

    if (!hasCategoryBinding(report.category_code, bindings)) {
      notices.push({
        code: 'CAT-UNCAT-01',
        severity: '提示',
        message: '该品类未配置专属规则，仅执行通用检查',
      });
    }

    var conclusion = '通过';
    if (bySeverity['严重'] > 0) conclusion = '不通过';
    else if (bySeverity['一般'] > 0) conclusion = '通过待确认';

    return {
      report_id: report.id,
      conclusion: conclusion,
      issues: issues,
      notices: notices,
      summary: { total: total, failed: failed, by_severity: bySeverity },
    };
  }

  global.AiReviewEngine = {
    evalRule: evalRule,
    run: run,
  };
})(window);
