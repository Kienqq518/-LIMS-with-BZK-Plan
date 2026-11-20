import { chromium } from 'playwright';
import { BASE } from './_env.mjs';

const out = [];
const err = [];

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));
p.on('dialog', (d) => d.accept());

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(400);

const liability = await p.locator('#ai-liability').count();
out.push((liability === 0 ? '✅' : '❌') + ' 不展示入口说明条');

const kpiN = await p.locator('#kpi-row .kpi').count();
out.push((kpiN === 7 ? '✅' : '❌') + ' 顶栏 7 项 KPI: ' + kpiN);

const processN = await p.locator('#process-list .row-card').count();
out.push((processN >= 1 ? '✅' : '❌') + ' 过程中列表有行: ' + processN);

const archiveN = await p.locator('#archive-list .row-card').count();
out.push((archiveN >= 1 ? '✅' : '❌') + ' 归档列表有行: ' + archiveN);

const deleted = await p.locator('#archive-list .row-card', { hasText: '已删除' }).count();
out.push((deleted >= 1 ? '✅' : '❌') + ' 归档含已删除报告: ' + deleted);

await p.locator('#archive-list .row-card', { hasText: '已删除' }).first().click();
await p.waitForTimeout(200);
const detailOpen = await p.locator('#detail-panel').isVisible();
const detailText = await p.locator('#detail-body').textContent();
out.push((detailOpen && /已删除报告归档/.test(detailText || '') && /不能重跑/.test(detailText || '') ? '✅' : '❌') + ' 已删除归档只读快照');

const noJump = await p.locator('#detail-body a[href*="report-review-detail.html"]').count();
out.push((noJump === 0 ? '✅' : '❌') + ' 归档行不提供去审核');

await p.locator('#range-seg button[data-range="全部"]').click();
await p.waitForTimeout(200);
const allArchive = await p.locator('#archive-list .row-card').count();
out.push((allArchive >= 3 ? '✅' : '❌') + ' 全部窗口归档行: ' + allArchive);

await p.selectOption('#f-concl', '需复核');
await p.waitForTimeout(150);
const visibleConcl = await p.locator('#process-list .row-card .ai-chip, #archive-list .row-card .ai-chip').allTextContents();
const allReview = visibleConcl.length > 0 && visibleConcl.every((t) => /需复核/.test(t));
out.push((allReview ? '✅' : '❌') + ' 筛选需复核后可见行均为需复核');

await p.selectOption('#f-concl', '全部');
await p.locator('#process-list .row-card').first().click();
await p.waitForTimeout(150);
const jump = await p.locator('#detail-body a[href*="report-review-detail.html"]').count();
out.push((jump >= 1 ? '✅' : '❌') + ' 过程行可跳转工作台');

const passRate = await p.locator('#kpi-row .kpi').nth(2).textContent();
out.push((/%/.test(passRate || '') ? '✅' : '❌') + ' 通过率 KPI 含百分比');

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
