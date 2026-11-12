import { chromium } from 'playwright';
import { BASE } from './_env.mjs';

const out = [];
const err = [];

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));

const badId = 'r-bad-sign';
await p.goto(BASE + '/report-audit.html?report=' + badId, { waitUntil: 'load' });
await p.waitForTimeout(500);

const cardVisible = await p.locator('#ai-card').isVisible();
const concl = (await p.locator('#ai-conclusion').textContent())?.trim();
const issueCount = await p.locator('#ai-issues .issue[data-rule-id]').count();
const hitCount = await p.evaluate((id) => {
  var rep = window.AiReviewStore.getReport(id);
  var res = window.__lastAuditResult;
  return res ? res.issues.length : -1;
}, badId);

out.push((cardVisible && concl === '不通过' && issueCount === hitCount && hitCount > 0 ? '✅' : '❌') + ' 自动触发不通过 命中=' + issueCount);

const issueBtn = p.locator('#ai-issues .issue').first().locator('button[data-action="接受"]');
if (await issueBtn.count()) await issueBtn.click();
await p.click('#btn-audit-settle');
await p.waitForTimeout(200);
let cases = await p.evaluate(() => window.AiReviewStore.getCases());
let matchedBad = cases.some((c) => c.report_id === badId);
out.push((matchedBad ? '✅' : '❌') + ' 审核处置沉淀案例');

await p.goto(BASE + '/report-audit.html?report=r-uncat', { waitUntil: 'load' });
await p.waitForTimeout(400);
const notice = await p.locator('#ai-notices').textContent();
out.push((/CAT-UNCAT-01/.test(notice || '') ? '✅' : '❌') + ' 未配置品类提示');

await p.goto(BASE + '/report-list.html', { waitUntil: 'domcontentloaded' });
const linkCount = await p.locator('a[href*="report-audit.html"]').count();
out.push((linkCount >= 1 ? '✅' : '❌') + ' report-list 审核入口: ' + linkCount);

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
