import { chromium } from 'playwright';
import { BASE, SHOT_DIR } from './_env.mjs';

const out = [];
const err = [];

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.setViewportSize({ width: 1440, height: 960 });
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));
p.on('dialog', (d) => d.accept());

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(400);

const liability = await p.locator('#ai-liability').count();
out.push((liability === 0 ? '✅' : '❌') + ' 不展示入口说明条');

const kpiN = await p.locator('#kpi-row .kpi').count();
out.push((kpiN === 7 ? '✅' : '❌') + ' 顶栏 7 项 KPI: ' + kpiN);

const charts = await p.evaluate(() => ({
  concl: !!document.querySelector('#chart-concl svg, #chart-concl .chart-legend, #chart-concl'),
  trend: (document.querySelector('#chart-trend')?.textContent || '').length > 0,
  rules: (document.querySelector('#chart-rules')?.textContent || '').length > 0,
}));
out.push((charts.concl && charts.trend && charts.rules ? '✅' : '❌') + ' 三张图表已渲染');

const tabs = await p.locator('#list-tabs .list-tab').count();
out.push((tabs === 3 ? '✅' : '❌') + ' 三类名单 Tab: ' + tabs);

const noDrawer = await p.locator('#detail-panel').count();
out.push((noDrawer === 0 ? '✅' : '❌') + ' 不再使用侧栏快照抽屉');

const queueN = await p.locator('#roster-body tr.row-card').count();
out.push((queueN >= 1 ? '✅' : '❌') + ' 默认排队序列有行: ' + queueN);

await p.screenshot({ path: SHOT_DIR + '/panel-queue.png', fullPage: true });

await p.locator('#list-tabs .list-tab[data-tab="process"]').click();
await p.waitForTimeout(150);
const processN = await p.locator('#roster-body tr.row-card').count();
out.push((processN >= 1 ? '✅' : '❌') + ' 过程中列表有行: ' + processN);
await p.screenshot({ path: SHOT_DIR + '/panel-process.png', fullPage: true });

await p.locator('#list-tabs .list-tab[data-tab="archive"]').click();
await p.waitForTimeout(150);
const archiveN = await p.locator('#roster-body tr.row-card').count();
out.push((archiveN >= 1 ? '✅' : '❌') + ' 归档列表有行: ' + archiveN);
const deleted = await p.locator('#roster-body tr.row-card', { hasText: '已删除' }).count();
out.push((deleted >= 1 ? '✅' : '❌') + ' 归档含已删除报告: ' + deleted);
await p.screenshot({ path: SHOT_DIR + '/panel-archive.png', fullPage: true });

await p.locator('#roster-body tr.row-card', { hasText: '已删除' }).first().click();
await p.waitForTimeout(400);
out.push((/ai-review-snapshot\.html/.test(p.url()) ? '✅' : '❌') + ' 点归档行进入独立快照页');
const snapText = await p.locator('#page').textContent();
out.push((/已删除报告归档/.test(snapText || '') && /不能重跑/.test(snapText || '') ? '✅' : '❌') + ' 已删除归档只读快照');
const noJump = await p.locator('#page a[href*="report-review-detail.html"]').count();
out.push((noJump === 0 ? '✅' : '❌') + ' 归档行不提供去审核');
const rich = /规则执行清单/.test(snapText || '') && /冻结快照字段/.test(snapText || '') && /操作日志/.test(snapText || '') && /AI 综合结论/.test(snapText || '');
out.push((rich ? '✅' : '❌') + ' 快照含结论/规则/字段/日志');
await p.screenshot({ path: SHOT_DIR + '/snapshot-deleted.png', fullPage: true });

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(300);
await p.locator('#range-seg button[data-range="全部"]').click();
await p.waitForTimeout(200);
await p.locator('#list-tabs .list-tab[data-tab="archive"]').click();
await p.waitForTimeout(150);
const allArchive = await p.locator('#roster-body tr.row-card').count();
out.push((allArchive >= 3 ? '✅' : '❌') + ' 全部窗口归档行: ' + allArchive);

await p.selectOption('#f-concl', '需复核');
await p.waitForTimeout(150);
await p.locator('#list-tabs .list-tab[data-tab="process"]').click();
await p.waitForTimeout(100);
const visibleConcl = await p.locator('#roster-body .ai-chip').allTextContents();
const allReview = visibleConcl.length > 0 && visibleConcl.every((t) => /需复核/.test(t));
out.push((allReview ? '✅' : '❌') + ' 筛选需复核后可见行均为需复核');

await p.selectOption('#f-concl', '全部');
await p.locator('#list-tabs .list-tab[data-tab="process"]').click();
await p.waitForTimeout(100);
await p.locator('#roster-body tr.row-card').first().click();
await p.waitForTimeout(400);
out.push((/ai-review-snapshot\.html/.test(p.url()) ? '✅' : '❌') + ' 点过程行进入独立快照页');
const jump = await p.locator('#page a[href*="report-review-detail.html"]').count();
out.push((jump >= 1 ? '✅' : '❌') + ' 过程行可跳转工作台');
const procText = await p.locator('#page').textContent();
out.push((/V1\.1/.test(procText || '') && /与上一版差异/.test(procText || '') ? '✅' : '❌') + ' 多轮快照默认最新一轮并展示差异');
await p.screenshot({ path: SHOT_DIR + '/snapshot-process.png', fullPage: true });

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(250);
await p.locator('#roster-body tr.row-card').first().click();
await p.waitForTimeout(400);
const qText = await p.locator('#page').textContent();
out.push((/排队|审核中|正在审核/.test(qText || '') ? '✅' : '❌') + ' 排队/执行中快照');
await p.screenshot({ path: SHOT_DIR + '/snapshot-queue.png', fullPage: true });

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
const passRate = await p.locator('#kpi-row .kpi').nth(2).textContent();
out.push((/%/.test(passRate || '') ? '✅' : '❌') + ' 通过率 KPI 含百分比');

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
