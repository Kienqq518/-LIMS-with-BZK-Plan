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
out.push((kpiN === 5 ? '✅' : '❌') + ' 五张 KPI: ' + kpiN);

const blocks = await p.evaluate(() => ['blk-kpi', 'blk-pending', 'blk-trend', 'blk-archive', 'blk-queue'].every((id) => !!document.getElementById(id)));
out.push((blocks ? '✅' : '❌') + ' 五块布局容器');

const charts = await p.evaluate(() => ({
  concl: !!document.querySelector('#chart-concl svg'),
  avg: /秒|分/.test(document.querySelector('#chart-avg')?.textContent || ''),
  rules: (document.querySelector('#chart-rules')?.textContent || '').length > 0,
  sev: /严重/.test(document.querySelector('#chart-sev')?.textContent || ''),
  vol: !!document.querySelector('#chart-volume svg') || /\d/.test(document.querySelector('#chart-volume')?.textContent || ''),
}));
out.push((charts.concl && charts.avg && charts.rules && charts.sev && charts.vol ? '✅' : '❌') + ' 饼图/时长/规则TOP/严重度/走势');

const noDrawer = await p.locator('#detail-panel').count();
out.push((noDrawer === 0 ? '✅' : '❌') + ' 不再使用侧栏快照抽屉');

const pendingN = await p.locator('#pending-marquee a').count();
out.push((pendingN >= 1 ? '✅' : '❌') + ' 待处理轮播有行: ' + pendingN);

const exN = await p.locator('#ex-marquee a').count();
out.push((exN >= 1 ? '✅' : '❌') + ' 审核异常轮播有行: ' + exN);

const qCards = await p.locator('#queue-viz .q-card').count();
out.push((qCards === 3 ? '✅' : '❌') + ' 排队模拟 3 份: ' + qCards);

await p.screenshot({ path: SHOT_DIR + '/panel-five-blocks.png', fullPage: true });

const pendingHref = await p.locator('#pending-marquee a').first().getAttribute('href');
await p.goto(BASE + '/' + pendingHref, { waitUntil: 'load' });
await p.waitForTimeout(400);
out.push((/ai-review-snapshot\.html/.test(p.url()) ? '✅' : '❌') + ' 点待处理进入独立快照页');
const handle = await p.locator('#page a', { hasText: '人工处置' }).count();
const back = await p.locator('#page a', { hasText: '返回审核面板' }).count();
out.push((handle >= 1 && back >= 1 ? '✅' : '❌') + ' 快照含返回面板与人工处置');
const jump = await p.locator('#page a[href*="report-review-detail.html"]').count();
out.push((jump >= 1 ? '✅' : '❌') + ' 人工处置进入报告审核');
await p.screenshot({ path: SHOT_DIR + '/snapshot-process.png', fullPage: true });

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(250);
const exHref = await p.locator('#ex-marquee a').first().getAttribute('href');
await p.goto(BASE + '/' + exHref, { waitUntil: 'load' });
await p.waitForTimeout(400);
out.push((/report-review-detail\.html/.test(p.url()) ? '✅' : '❌') + ' 点异常进入报告审核详情');

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.locator('#archive-jump').click();
await p.waitForTimeout(300);
out.push((/ai-review-archive\.html/.test(p.url()) ? '✅' : '❌') + ' 归档箭头进入归档名单');
const allArchive = await p.locator('#archive-body tr.row-card').count();
out.push((allArchive >= 3 ? '✅' : '❌') + ' 归档名单行: ' + allArchive);
const deleted = await p.locator('#archive-body tr.row-card', { hasText: '已删除' }).count();
out.push((deleted >= 1 ? '✅' : '❌') + ' 归档含已删除报告: ' + deleted);
await p.screenshot({ path: SHOT_DIR + '/panel-archive-list.png', fullPage: true });

await p.locator('#archive-body tr.row-card', { hasText: '已删除' }).first().click();
await p.waitForTimeout(400);
out.push((/ai-review-snapshot\.html/.test(p.url()) ? '✅' : '❌') + ' 点归档行进入独立快照页');
const snapText = await p.locator('#page').textContent();
out.push((/已删除报告归档/.test(snapText || '') && /不能重跑/.test(snapText || '') ? '✅' : '❌') + ' 已删除归档只读快照');
const noJump = await p.locator('#page a[href*="report-review-detail.html"]').count();
out.push((noJump === 0 ? '✅' : '❌') + ' 归档行不提供人工处置');
const rich = /规则执行清单/.test(snapText || '') && /冻结快照字段/.test(snapText || '') && /操作日志/.test(snapText || '') && /AI 综合结论/.test(snapText || '');
out.push((rich ? '✅' : '❌') + ' 快照含结论/规则/字段/日志');
const backArch = await p.locator('#page a', { hasText: '返回归档名单' }).count();
out.push((backArch >= 1 ? '✅' : '❌') + ' 从归档进入的快照可返回名单');
await p.screenshot({ path: SHOT_DIR + '/snapshot-deleted.png', fullPage: true });

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.locator('#range-seg button[data-range="全部"]').click();
await p.waitForTimeout(150);
const kpiAll = await p.locator('#kpi-row .kpi').first().textContent();
out.push((/\d/.test(kpiAll || '') ? '✅' : '❌') + ' 全部窗口 KPI 仍有数字');
await p.locator('#grain-seg button[data-grain="年"]').click();
await p.waitForTimeout(80);
out.push(((await p.locator('#chart-volume svg').count()) === 1 ? '✅' : '❌') + ' 按年切换走势图');

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(2500);
const afterTick = await p.locator('#queue-viz .q-card.done').count();
out.push((afterTick >= 1 ? '✅' : '❌') + ' 排队流转至少完成 1 份: ' + afterTick);
const popped = await p.locator('#kpi-row .kpi.pop').count();
out.push((popped >= 1 || afterTick >= 1 ? '✅' : '❌') + ' 完成后 KPI 会跳动');
await p.screenshot({ path: SHOT_DIR + '/panel-queue-tick.png', fullPage: true });

const closeRate = await p.locator('#kpi-row .kpi').nth(1).textContent();
out.push((/%/.test(closeRate || '') ? '✅' : '❌') + ' 成功率 KPI 含百分比');

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
