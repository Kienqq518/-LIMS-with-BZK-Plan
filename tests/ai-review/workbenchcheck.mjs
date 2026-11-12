import { chromium } from 'playwright';
import { BASE } from './_env.mjs';

const out = [];
const err = [];

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(300);

const liability = await p.locator('#ai-liability').textContent();
out.push((/授权签字人/.test(liability || '') ? '✅' : '❌') + ' 责任边界文案');

await p.click('#btn-run-all');
await p.waitForTimeout(800);

const reportCount = await p.evaluate(() => window.AiReviewStore.getReports().length);
const rowCount = await p.locator('#result-table tr[data-report-id]').count();
out.push((rowCount === reportCount ? '✅' : '❌') + ' 结果表行数=' + rowCount + ' 报告数=' + reportCount);

const failRows = await p.locator('#result-table tr[data-report-id] .concl', { hasText: '不通过' }).count();
out.push((failRows >= 1 ? '✅' : '❌') + ' 存在不通过结论行: ' + failRows);

await p.selectOption('#filter-conclusion', '不通过');
await p.waitForTimeout(200);
const visibleConcl = await p.locator('#result-table tr[data-report-id]:visible .concl').allTextContents();
const allFail = visibleConcl.length > 0 && visibleConcl.every((t) => t.trim() === '不通过');
out.push((allFail ? '✅' : '❌') + ' 筛选不通过后可见行均为不通过');

await p.selectOption('#filter-conclusion', '全部');
await p.waitForTimeout(200);

const failRow = p.locator('#result-table tr[data-report-id]').filter({ has: p.locator('.concl', { hasText: '不通过' }) }).first();
await failRow.click();
await p.waitForTimeout(300);

const panelVisible = await p.locator('#detail-panel').isVisible();
const issueCount = await p.locator('#issue-list .issue[data-rule-id]').count();
const hitFromRow = await failRow.locator('.hit-count').getAttribute('data-count');
out.push((panelVisible && issueCount === Number(hitFromRow) ? '✅' : '❌') + ' 详情问题数=' + issueCount + ' 命中=' + hitFromRow);

const firstIssue = p.locator('#issue-list .issue[data-rule-id]').first();
await firstIssue.locator('.override-reason').fill('领域顾问确认可接受');
await firstIssue.locator('button[data-action="覆盖"]').click();
await p.click('#btn-settle');
await p.waitForTimeout(200);

const settled = await p.evaluate(() => ({
  fb: window.AiReviewStore.getFeedback().length,
  cases: window.AiReviewStore.getCases().length,
  lastCase: window.AiReviewStore.getCases().slice(-1)[0],
}));
out.push((settled.fb >= 1 && settled.cases >= 1 && settled.lastCase?.dispositions?.some((d) => d.action === '覆盖') ? '✅' : '❌') + ' feedback/cases 沉淀');

await p.click('#tab-stats');
await p.waitForTimeout(200);
const passRateText = await p.locator('#stat-pass-rate').textContent();
const stats = await p.evaluate(() => {
  var rows = document.querySelectorAll('#result-table tr[data-report-id]');
  var pass = 0;
  rows.forEach(function (tr) {
    if (tr.querySelector('.concl') && tr.querySelector('.concl').textContent.trim() === '通过') pass++;
  });
  return { pass, total: rows.length };
});
const rateOk = passRateText && stats.total > 0 && passRateText.includes(String(Math.round((stats.pass / stats.total) * 100)));
out.push((rateOk ? '✅' : '❌') + ' 统计通过率');

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
