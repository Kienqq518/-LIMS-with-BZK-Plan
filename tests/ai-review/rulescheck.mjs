import { chromium } from 'playwright';
import { BASE } from './_env.mjs';

const out = [];
const err = [];

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));

await p.goto(BASE + '/ai-review-rules.html', { waitUntil: 'load' });
await p.waitForTimeout(300);

const ruleRows = await p.locator('#rule-table tr[data-rule-id]').count();
out.push((ruleRows === 8 ? '✅' : '❌') + ' 规则表 8 行');

const universalCol = await p.evaluate(() => {
  var cells = Array.from(document.querySelectorAll('#rule-table tr[data-rule-id] td.col-universal'));
  return cells.every((c) => c.textContent.trim() === '通用');
});
out.push((universalCol ? '✅' : '❌') + ' 是否通用列均为通用');

const catRows = await p.locator('#cat-body tr').count();
const bindRows = await p.locator('#binding-table tr[data-binding-id]').count();
const emptyMsg = await p.locator('#binding-empty').textContent();
out.push((catRows === 6 && bindRows === 0 && /CAT-UNCAT-01/.test(emptyMsg || '') ? '✅' : '❌') + ' 品类6行绑定空态');

await p.locator('#rule-table tr[data-rule-id="C01-4"] .rule-enabled').click();
await p.waitForTimeout(200);
const disabledRun = await p.evaluate(() => {
  var rep = window.AiReviewStore.getReport('r-bad-unit');
  var rules = window.AiReviewStore.getRules();
  var res = window.AiReviewEngine.run(rep, rules, window.AiReviewStore.getCategories(), window.AiReviewStore.getBindings());
  return !res.issues.some((i) => i.rule_id === 'C01-4');
});
out.push((disabledRun ? '✅' : '❌') + ' 禁用 C01-4 后不再命中');

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 3).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
