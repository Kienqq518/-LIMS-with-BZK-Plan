import { chromium } from 'playwright';
import { BASE } from './_env.mjs';

const out = [];
const err = [];

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));
p.on('dialog', (d) => d.accept());

// 报告编制：操作列含「去处理」/退回，表头表体列数一致
await p.goto(BASE + '/report-list.html', { waitUntil: 'load' });
await p.waitForTimeout(400);
const rlAlign = await p.evaluate(() => {
  const table = document.querySelector('#tableBody')?.closest('table');
  if (!table) return false;
  const thCount = table.querySelectorAll('thead th').length;
  const tr = document.querySelector('#tableBody tr');
  if (!tr || tr.cells.length !== thCount) return false;
  const ops = tr.cells[tr.cells.length - 1];
  const text = ops.textContent || '';
  return /去处理/.test(text) && /退回/.test(text) && !/报告生成/.test(text) && !/\b编制\b/.test(text);
});
out.push((rlAlign ? '✅' : '❌') + ' 报告编制列表列对齐与操作列');
const rlAi = await p.evaluate(() => {
  const scroll = document.getElementById('ai-returned-scroll');
  const row238 = [...document.querySelectorAll('#tableBody tr')].some((tr) => /SC2026\/0238/.test(tr.textContent || ''));
  return scroll && getComputedStyle(scroll).maxHeight !== 'none' && row238;
});
out.push((rlAi ? '✅' : '❌') + ' 报告编制 AI 退回区滚动且主表含退回委托');
const handleHref = await p.evaluate(() => {
  const a = document.querySelector('#tableBody a[href*="report-compile-edit.html"]');
  return a && /去处理/.test(a.textContent || '') && /entrust=/.test(a.getAttribute('href') || '');
});
out.push((handleHref ? '✅' : '❌') + ' 去处理进入编制工作台');
const noRecordCol = await p.evaluate(() => {
  const ths = [...document.querySelectorAll('table.report-list-table thead th')].map((th) => th.textContent.replace(/\s+/g, ' ').trim());
  return !ths.includes('报告记录');
});
out.push((noRecordCol ? '✅' : '❌') + ' 主列表不再单独列报告记录');

// 委托预览：独立「报告」+「操作」列，表头表体对齐
await p.goto(BASE + '/entrust-preview.html', { waitUntil: 'load' });
await p.waitForTimeout(400);
const pvCols = await p.evaluate(() => {
  const table = document.querySelector('#entrustTableBody')?.closest('table');
  if (!table) return false;
  const thTexts = [...table.querySelectorAll('thead th')].map((th) => th.textContent.replace(/\s+/g, ' ').trim());
  const tr = document.querySelector('#entrustTableBody tr');
  if (!tr || tr.cells.length !== thTexts.length) return false;
  const reportIdx = thTexts.indexOf('报告');
  const opsIdx = thTexts.indexOf('操作');
  if (reportIdx < 0 || opsIdx !== thTexts.length - 1) return false;
  const reportCell = tr.cells[reportIdx];
  const opsCell = tr.cells[opsIdx];
  return /报告/.test(reportCell.textContent || '') && /手机签署链接/.test(opsCell.textContent || '');
});
out.push((pvCols ? '✅' : '❌') + ' 委托预览报告/操作分列对齐');

// 委托登记：编辑/删除在操作列，表体列数与表头一致（sample-cat-filter 勿重复插列）
await p.goto(BASE + '/entrust-register.html', { waitUntil: 'load' });
await p.waitForTimeout(300);
const erAlign = await p.evaluate(() => {
  const tr = document.querySelector('#registerTableBody tr');
  if (!tr || tr.cells.length !== 10) return false;
  const ths = document.querySelectorAll('thead th').length;
  const ops = tr.cells[9];
  return ths === 10 && /编辑/.test(ops.textContent || '') && tr.cells[0].textContent.trim() === '1';
});
out.push((erAlign ? '✅' : '❌') + ' 委托登记列表列对齐（操作列含编辑删除）');

// 报告审核主查询页：操作列为「审核」，无旧 AI 链接
await p.goto(BASE + '/report-review.html', { waitUntil: 'load' });
await p.waitForTimeout(300);
const auditLinks = await p.locator('#tableBody a[href*="report-review-detail.html"]').count();
const auditBtnText = await p.locator('#tableBody a[href*="report-review-detail.html"]').first().textContent();
out.push((auditLinks >= 1 && /审核/.test(auditBtnText || '') ? '✅' : '❌') + ' 报告审核列表「审核」入口: ' + auditLinks);
const ccTrigger = await p.locator('#cc-trigger').count();
out.push((ccTrigger === 1 ? '✅' : '❌') + ' 报告审核列表列配置入口 #cc-trigger');
await p.locator('#tableBody a[data-record]').first().click();
await p.waitForTimeout(300);
const drawerOpen = await p.locator('#rvRecordDrawer.open').count();
const drawerCards = await p.locator('#rvRecordRoster .rv-rep-card').count();
const drawerLog = await p.locator('#rvRecordLog .audit-tl-item').count();
out.push((drawerOpen === 1 && drawerCards >= 4 && drawerLog >= 1 ? '✅' : '❌') + ` 报告记录抽屉: open=${drawerOpen} cards=${drawerCards} logs=${drawerLog}`);
await p.locator('#rvRecordDrawer button[aria-label="关闭"]').click();
await p.waitForTimeout(250);

// 审核工作台：SC2026/0238 — 委托概览默认折叠 + 4 份报告统观
await p.goto(BASE + '/report-review-detail.html?code=SC2026/0238', { waitUntil: 'load' });
await p.waitForTimeout(1000);
const ovCollapsed = await p.locator('#ov-body').evaluate((el) => el.classList.contains('hidden'));
out.push((ovCollapsed ? '✅' : '❌') + ' 委托概览默认折叠');
const rosterRows = await p.locator('.roster-row').count();
out.push((rosterRows === 6 ? '✅' : '❌') + ` 报告统观区 6 行: ${rosterRows}`);
const kaliberFooter = await p.locator('.sum-kaliber').count();
out.push((kaliberFooter === 0 ? '✅' : '❌') + ' 判定口径仅保留 tips、不在卡片底部重复');

// 默认选中第一份（01）→ AI 结论=通过
const firstConclusion = await p.locator('#ai-conclusion').getAttribute('data-conclusion');
out.push((firstConclusion === '通过' ? '✅' : '❌') + ` 默认选中报告 AI 结论: ${firstConclusion}`);

// 选中 02（需复核·第二轮）→ 结论=需复核 + 差异区可见 + 已解决含 L1-d-1
await p.locator('.roster-row[data-report-id="rr-0238-02"]').click();
await p.waitForTimeout(1000);
const c02 = await p.locator('#ai-conclusion').getAttribute('data-conclusion');
const diffVisible = await p.locator('#ai-diff').isVisible();
const resolvedText = await p.locator('#ai-diff .diff-resolved').textContent().catch(() => '');
const roundText = await p.locator('#ai-round').textContent();
out.push((c02 === '需复核' && diffVisible && /L1-d-1/.test(resolvedText || '') && /第 2 轮/.test(roundText || '') ? '✅' : '❌') + ` 02 需复核+多轮差异(已解决含L1-d-1): ${c02} round=${/第 2 轮/.test(roundText || '')}`);

// 问题清单同时含「通用」与「品类专属」规则
const scopeUniversal = await p.locator('.rule-item[data-scope="通用"]').count();
const scopeCategory = await p.locator('.rule-item[data-scope^="品类专属"]').count();
out.push((scopeUniversal > 0 && scopeCategory > 0 ? '✅' : '❌') + ` 规则项标通用/品类专属: 通用=${scopeUniversal} 品类=${scopeCategory}`);

// AI 综合结论存在
const summaryText = await p.locator('#ai-summary').textContent();
out.push((/AI 综合结论/.test(summaryText || '') ? '✅' : '❌') + ' AI 归纳综合结论');

// 需复核退回：一键填入 AI 结论 → 执行 → 写入 feedback
await p.locator('#manual-feedback input[value="return"]').check();
await p.waitForTimeout(150);
await p.locator('#btn-oneclick-reason').click();
const reasonVal = await p.locator('#return-reason').inputValue();
out.push((reasonVal && reasonVal.length > 0 ? '✅' : '❌') + ' 退回原因一键填入 AI 结论');
await p.locator('#manual-feedback button.btn-exec').click();
await p.waitForTimeout(200);
const fb = await p.evaluate(() => window.AiReviewStore.getFeedback());
const retFb = fb.find((f) => f.final_conclusion === '退回报告编制');
out.push((retFb && retFb.agree_ai === true && Array.isArray(retFb.item_labels) ? '✅' : '❌') + ' 退回处置写入 feedback(含标注)');

// 03 不通过：默认策略=自动退回 → 无人工处置按钮
await p.locator('.roster-row[data-report-id="rr-0238-03"]').click();
await p.waitForTimeout(1000);
const c03 = await p.locator('#ai-conclusion').getAttribute('data-conclusion');
const autoNoBtn = await p.locator('#manual-feedback button.btn-exec').count();
out.push((c03 === '不通过' && autoNoBtn === 0 ? '✅' : '❌') + ` 03 不通过自动退回(无处置按钮): ${c03} btn=${autoNoBtn}`);

// 切换策略开关 → 不通过出现人工覆盖入口
await p.locator('#policy-toggle').click();
await p.waitForTimeout(200);
const policyAuto = await p.locator('#policy-toggle').getAttribute('data-auto');
const overrideBtn = await p.locator('#manual-feedback button.btn-exec').count();
out.push((policyAuto === '0' && overrideBtn >= 1 ? '✅' : '❌') + ` 策略开关切换出现人工覆盖: auto=${policyAuto} btn=${overrideBtn}`);
await p.locator('#policy-toggle').click(); // 复位

// 04 签发退回：提示条可见 + 重跑追加一轮
await p.locator('.roster-row[data-report-id="rr-0238-04"]').click();
await p.waitForTimeout(1000);
const signoffVisible = await p.locator('#signoff-banner').isVisible();
await p.locator('#btn-rerun').click();
await p.waitForTimeout(1000);
const rerunRound = await p.locator('#ai-round').textContent();
out.push((signoffVisible && /第 2 轮/.test(rerunRound || '') ? '✅' : '❌') + ` 04 签发退回提示+重跑追加轮次: signoff=${signoffVisible} ${/第 2 轮/.test(rerunRound || '')}`);

await p.locator('.roster-row[data-report-id="rr-0238-05"]').click();
await p.waitForTimeout(400);
const run05 = await p.locator('#ai-round').textContent();
const prog05 = await p.locator('#ai-progress').isVisible();
out.push((/AI 正在审核/.test(run05 || '') && prog05 ? '✅' : '❌') + ' 05 AI 审核中加载态');
await p.locator('.roster-row[data-report-id="rr-0238-06"]').click();
await p.waitForTimeout(400);
const err06 = await p.locator('#ai-summary').textContent();
out.push((/AI 审核异常暂停/.test(err06 || '') && /ENGINE_TIMEOUT/.test(err06 || '') ? '✅' : '❌') + ' 06 AI 审核异常暂停');

// 报告编制页：AI 不通过自动退回横幅可见
await p.goto(BASE + '/report-list.html', { waitUntil: 'load' });
await p.waitForTimeout(300);
const bannerVisible = await p.locator('#ai-returned-banner').isVisible();
const bannerText = await p.locator('#ai-returned-banner').textContent();
out.push((bannerVisible && /SC2026\/0238-03/.test(bannerText || '') ? '✅' : '❌') + ' 报告编制页 AI 退回横幅');

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
