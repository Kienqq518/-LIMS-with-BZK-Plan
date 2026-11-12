import { chromium } from 'playwright';
import { BASE } from './_env.mjs';

const out = [];
const err = [];

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));
p.on('dialog', (d) => d.accept());

// 报告审核主查询页：操作列为「审核」，无旧 AI 链接
await p.goto(BASE + '/report-review.html', { waitUntil: 'load' });
await p.waitForTimeout(300);
const auditLinks = await p.locator('#tableBody a[href*="report-review-detail.html"]').count();
const auditBtnText = await p.locator('#tableBody a[href*="report-review-detail.html"]').first().textContent();
out.push((auditLinks >= 1 && /审核/.test(auditBtnText || '') ? '✅' : '❌') + ' 报告审核列表「审核」入口: ' + auditLinks);
const ccTrigger = await p.locator('#cc-trigger').count();
out.push((ccTrigger === 1 ? '✅' : '❌') + ' 报告审核列表列配置入口 #cc-trigger');

// 审核详情页：SC2026/0238 三份报告命中 通过 / 需复核 / 不通过
await p.goto(BASE + '/report-review-detail.html?code=SC2026/0238', { waitUntil: 'load' });
await p.waitForTimeout(400);
const cards = await p.locator('.report-card').count();
const pass = await p.locator('.report-card[data-conclusion="通过"]').count();
const review = await p.locator('.report-card[data-conclusion="需复核"]').count();
const fail = await p.locator('.report-card[data-conclusion="不通过"]').count();
out.push((cards === 3 && pass === 1 && review === 1 && fail === 1 ? '✅' : '❌') + ` 三态结论 卡片=${cards} 通过=${pass} 需复核=${review} 不通过=${fail}`);

// 不通过卡片无人工处置区（已被 AI 自动退回）
const failCard = p.locator('.report-card[data-conclusion="不通过"]');
const failHasManual = await failCard.locator('button.btn-exec').count();
out.push((failHasManual === 0 ? '✅' : '❌') + ' 不通过卡片无人工处置按钮');

// 需复核：选「同意退回」出现退回原因且已预填
const reviewCard = p.locator('.report-card[data-conclusion="需复核"]');
await reviewCard.locator('input[value="return"]').check();
await p.waitForTimeout(150);
const reasonVisible = await reviewCard.locator('.return-reason-wrap').isVisible();
const reasonVal = await reviewCard.locator('.return-reason').inputValue();
out.push((reasonVisible && /AI 预审命中/.test(reasonVal) ? '✅' : '❌') + ' 需复核退回原因预填');

// 执行退回 → 写入 feedback（含标注）
await reviewCard.locator('button.btn-exec').click();
await p.waitForTimeout(200);
const fb = await p.evaluate(() => window.AiReviewStore.getFeedback());
const retFb = fb.find((f) => f.final_conclusion === '退回报告编制');
out.push((retFb && retFb.agree_ai === true && Array.isArray(retFb.item_labels) ? '✅' : '❌') + ' 退回处置写入 feedback(含标注)');

// 通过卡片：执行通过
const passCard = p.locator('.report-card[data-conclusion="通过"]');
await passCard.locator('input[value="agree"]').check();
await passCard.locator('button.btn-exec').click();
await p.waitForTimeout(200);
const cases = await p.evaluate(() => window.AiReviewStore.getCases());
out.push((cases.some((c) => c.final_conclusion === '通过') ? '✅' : '❌') + ' 通过处置沉淀案例');

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
