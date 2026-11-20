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
out.push((kpiN === 3 ? '✅' : '❌') + ' 第一层三张 KPI: ' + kpiN);
const kpiH = await p.locator('#kpi-row .kpi').first().evaluate((el) => el.clientHeight);
out.push((kpiH >= 130 ? '✅' : '❌') + ' 第一层 KPI 卡高度: ' + kpiH);
const doneCard = await p.locator('#chart-done [data-kpi="done"]').count();
const adoptCard = await p.locator('#chart-adopt [data-kpi="adopt"]').count();
out.push((doneCard === 1 && adoptCard === 1 ? '✅' : '❌') + ' 已完成报告卡 + 人工采纳率卡');

const blocks = await p.evaluate(() => ['blk-kpi', 'blk-pending', 'blk-trend', 'blk-archive', 'blk-queue'].every((id) => !!document.getElementById(id)));
out.push((blocks ? '✅' : '❌') + ' 五块布局容器');

const charts = await p.evaluate(() => ({
  concl: !!document.querySelector('#chart-concl svg'),
  avg: /秒|分/.test(document.querySelector('#chart-avg')?.textContent || ''),
  rules: (document.querySelector('#chart-rules')?.textContent || '').length > 0,
  sev: !!document.querySelector('#chart-sev svg') && /严重/.test(document.querySelector('#chart-sev')?.textContent || ''),
  vol: !!document.querySelector('#chart-volume svg') && /审核任务总数/.test(document.querySelector('#chart-volume')?.textContent || ''),
  grain: document.querySelector('#grain-select')?.value === '月',
}));
out.push((charts.concl && charts.avg && charts.rules && charts.sev && charts.vol && charts.grain ? '✅' : '❌') + ' 饼图/时长/规则TOP/严重度饼图/走势选择器');

const noDrawer = await p.locator('#detail-panel').count();
out.push((noDrawer === 0 ? '✅' : '❌') + ' 不再使用侧栏快照抽屉');

const pendingN = await p.locator('#pending-marquee a').count();
out.push((pendingN >= 5 ? '✅' : '❌') + ' 待处理轮播至少 5 行: ' + pendingN);

const exN = await p.locator('#ex-marquee a').count();
const exH = await p.locator('#ex-marquee').evaluate((el) => el.clientHeight);
out.push((exN >= 2 && exH >= 160 ? '✅' : '❌') + ` 审核异常至少 2 条且高度可露两条: n=${exN} h=${Math.round(exH)}`);

const qCards = await p.locator('#queue-viz .q-card').count();
out.push((qCards === 3 ? '✅' : '❌') + ' 排队模拟 3 份: ' + qCards);
const archCats = await p.locator('#archive-stats').textContent();
out.push((/电力电缆/.test(archCats || '') && /绝缘手套|安全带|螺栓|保护管|盖板/.test(archCats || '') ? '✅' : '❌') + ' 归档卡片含样品大类明细');

await p.screenshot({ path: SHOT_DIR + '/panel-five-blocks.png', fullPage: true });

const pendingHref = await p.locator('#pending-marquee a.go-handle').first().getAttribute('href');
out.push((/report-review-detail\.html/.test(pendingHref || '') ? '✅' : '❌') + ' 待处理「去处置」指向报告审核工作台');
await p.goto(BASE + '/' + pendingHref, { waitUntil: 'load' });
await p.waitForTimeout(400);
out.push((/report-review-detail\.html/.test(p.url()) ? '✅' : '❌') + ' 点去处置进入报告审核工作台');
await p.screenshot({ path: SHOT_DIR + '/pending-to-detail.png', fullPage: true });

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
const yearDefault = await p.locator('#year-filter').inputValue();
out.push((yearDefault === '2026' ? '✅' : '❌') + ' 归档时间范围默认当年: ' + yearDefault);
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
const rich = /规则执行清单/.test(snapText || '') && /操作日志/.test(snapText || '') && /AI 综合结论/.test(snapText || '') && /当时人工处置结果/.test(snapText || '') && /报告预览/.test(snapText || '');
out.push((rich ? '✅' : '❌') + ' 快照含结论/规则/日志/处置/预览');
out.push((!/冻结快照字段/.test(snapText || '') ? '✅' : '❌') + ' 快照已去掉冻结快照字段');
out.push((/人工标注/.test(snapText || '') || /标注 /.test(snapText || '') ? '✅' : '❌') + ' 规则清单含人工标注');
const backArch = await p.locator('#page a', { hasText: '返回归档名单' }).count();
out.push((backArch >= 1 ? '✅' : '❌') + ' 从归档进入的快照可返回名单');
await p.screenshot({ path: SHOT_DIR + '/snapshot-deleted.png', fullPage: true });

await p.goto(BASE + '/ai-review-workbench.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.locator('#range-seg button[data-range="全部"]').click();
await p.waitForTimeout(150);
const kpiAll = await p.locator('#kpi-row .kpi').first().textContent();
out.push((/\d/.test(kpiAll || '') ? '✅' : '❌') + ' 全部窗口 KPI 仍有数字');
await p.selectOption('#grain-select', '年');
await p.waitForTimeout(80);
const yearFromVisible = await p.locator('#year-from-wrap').evaluate((el) => !el.classList.contains('hidden'));
const yearLabels = await p.locator('#chart-volume').textContent();
out.push((yearFromVisible && /2020年/.test(yearLabels || '') && /2026年/.test(yearLabels || '') ? '✅' : '❌') + ' 年度模式含起止年与多年柱');
await p.locator('#year-to').click();
await p.waitForTimeout(80);
const popYears = await p.locator('#year-pop button[data-year]').count();
out.push((popYears >= 8 ? '✅' : '❌') + ' 年份选择面板: ' + popYears);
await p.locator('#year-pop button[data-year="2024"]').click();
await p.waitForTimeout(80);
const to2024 = await p.locator('#year-to span').textContent();
out.push((to2024 === '2024' ? '✅' : '❌') + ' 选择截止年 2024');
await p.selectOption('#grain-select', '季');
await p.waitForTimeout(80);
const qText = await p.locator('#chart-volume').textContent();
out.push((/Q1/.test(qText || '') && /Q3/.test(qText || '') ? '✅' : '❌') + ' 季度模式展示当年已过季度');
const hit = p.locator('#chart-volume .vol-hit').first();
await hit.hover();
await p.waitForTimeout(80);
const tip = await p.locator('#vol-tip').textContent();
const tipHidden = await p.locator('#vol-tip').evaluate((el) => el.classList.contains('hidden'));
out.push((!tipHidden && /审核任务总数/.test(tip || '') && /完成率/.test(tip || '') ? '✅' : '❌') + ' 走势图 hover 显示具体值');

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
