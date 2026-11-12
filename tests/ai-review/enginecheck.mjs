import { chromium } from 'playwright';
import { BASE } from './_env.mjs';

const out = [];
const err = [];

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));

await p.goto(BASE + '/tests/ai-review/_fixture.html', { waitUntil: 'load' });

const R = await p.evaluate(() => {
  if (!window.AiReviewEngine || !window.AiReviewStore) return { ok: false };
  var Store = window.AiReviewStore;
  var Eng = window.AiReviewEngine;
  Store.reset();
  var rules = Store.getRules();
  var cats = Store.getCategories();
  var binds = Store.getBindings();

  function cleanReport() {
    return {
      id: 't-clean',
      report_no: 'Rpt-T',
      biz_type: '委托检验',
      category_code: 'CAT-CABLE',
      sample_no: 'SC2026-0099',
      test_standard: 'GB/T 12706.1-2020',
      cited_standard: 'GB/T 12706.1-2020',
      entrust_items: ['a'],
      result_params: ['a'],
      receive_date: '2026-07-10',
      test_date: '2026-07-15',
      report_date: '2026-07-18',
      device_calib_from: '2026-01-01',
      device_calib_to: '2026-12-31',
      signatures: { tester: 'a', reviewer: 'b', approver: 'c' },
      units: [{ param: 'x', unit: 'mm' }],
    };
  }

  var checks = [];
  var clean = cleanReport();
  var runClean = Eng.run(clean, rules, cats, binds);
  checks.push({
    name: '干净报告通过',
    pass: runClean.conclusion === '通过' && runClean.issues.length === 0,
  });

  var badSign = Object.assign({}, clean, {
    signatures: { tester: 'a', reviewer: 'b', approver: '' },
  });
  var runSign = Eng.run(badSign, rules, cats, binds);
  var hitC025 = runSign.issues.some((i) => i.rule_id === 'C02-5' && i.severity === '严重');
  checks.push({
    name: '缺 approver → 不通过',
    pass: hitC025 && runSign.conclusion === '不通过',
  });

  var badCited = Object.assign({}, clean, { cited_standard: 'GB/T 9999-2020' });
  var runCited = Eng.run(badCited, rules, cats, binds);
  checks.push({
    name: '仅一般问题 → 通过待确认',
    pass: runCited.conclusion === '通过待确认',
  });

  var bizTypes = ['型式试验', '出厂试验', '例行试验', '委托检验', '抽样检验'];
  var b01All = bizTypes.every((bt) => {
    var r = Object.assign({}, clean, { biz_type: bt });
    return Eng.evalRule('B01-1', r).passed === true;
  });
  checks.push({ name: 'B01-1 五业务类型', pass: b01All });

  var sameDay = Object.assign({}, clean, {
    receive_date: '2026-07-15',
    test_date: '2026-07-15',
    report_date: '2026-07-15',
  });
  checks.push({
    name: '日期相等边界',
    pass: Eng.evalRule('B01-1', sameDay).passed === true,
  });

  var missDate = Object.assign({}, clean, { test_date: '' });
  var b01Miss = Eng.evalRule('B01-1', missDate);
  var runMiss = Eng.run(missDate, rules, cats, binds);
  var hasDateHint =
    runMiss.notices.some((n) => /缺.*日期|核心日期/.test(n.message || '')) ||
    runMiss.issues.some((i) => /日期/.test(i.message || ''));
  checks.push({
    name: '缺 test_date B01-1 跳过',
    pass: b01Miss.passed === true && !b01Miss.evidence?.error && hasDateHint,
  });

  var emptyEntrust = Object.assign({}, clean, { entrust_items: [] });
  checks.push({
    name: '空 entrust_items',
    pass: Eng.evalRule('A02-1', emptyEntrust).passed === true,
  });

  var noYear = Object.assign({}, clean, { test_standard: 'GB/T 1231' });
  var a016 = Eng.evalRule('A01-6', noYear);
  checks.push({
    name: 'A01-6 无年号严重',
    pass: a016.passed === false,
  });

  var uncat = Object.assign({}, clean, { category_code: null });
  var runUncat = Eng.run(uncat, rules, cats, binds);
  var hasCatNotice = runUncat.notices.some((n) => n.code === 'CAT-UNCAT-01' && n.severity === '提示');
  checks.push({
    name: 'CAT-UNCAT-01',
    pass: hasCatNotice && runUncat.conclusion !== '不通过',
  });

  return { ok: true, checks };
});

if (!R.ok) {
  out.push('❌ AiReviewEngine 不可用');
} else {
  R.checks.forEach((c) => out.push((c.pass ? '✅' : '❌') + ' ' + c.name));
}

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 3).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
