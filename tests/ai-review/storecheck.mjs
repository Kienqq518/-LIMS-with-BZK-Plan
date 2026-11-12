import { chromium } from 'playwright';
import { BASE } from './_env.mjs';

const EXPECT_IDS = ['A01-1', 'A01-6', 'A02-1', 'B01-1', 'B01-2', 'B03-1', 'C02-5', 'C01-4'];
const out = [];
const err = [];

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));
p.on('console', (m) => {
  if (m.type() === 'error' && !/favicon/.test(m.text())) err.push('console: ' + m.text().slice(0, 150));
});

await p.goto(BASE + '/tests/ai-review/_fixture.html', { waitUntil: 'load' });

const data = await p.evaluate(() => {
  if (!window.AiReviewStore) return { ok: false, reason: 'no AiReviewStore' };
  window.AiReviewStore.reset();
  return {
    ok: true,
    rules: window.AiReviewStore.getRules(),
    categories: window.AiReviewStore.getCategories(),
    bindings: window.AiReviewStore.getBindings(),
    reports: window.AiReviewStore.getReports(),
    storageKey: typeof localStorage !== 'undefined' && localStorage.getItem('lims.aiReview.v1') ? 'lims.aiReview.v1' : null,
  };
});

if (!data.ok) {
  out.push('❌ AiReviewStore 可用: ' + data.reason);
} else {
  const ids = data.rules.map((r) => r.id).sort();
  const idSet = ids.join(',');
  const expectSet = EXPECT_IDS.slice().sort().join(',');
  out.push((data.rules.length === 8 && idSet === expectSet ? '✅' : '❌') + ' rules 8 条且 id 集合正确: ' + ids.join(' '));
  const allUniversal = data.rules.every((r) => r.is_universal === true);
  const allStatus = data.rules.every((r) => r.status === '待审核员确认');
  out.push((allUniversal && allStatus ? '✅' : '❌') + ' 全部 is_universal=true 且 status=待审核员确认');
  out.push((data.categories.length === 6 && data.categories.every((c) => c.is_bound === false) ? '✅' : '❌') + ' categories 6 条且 is_bound=false');
  out.push((data.bindings.length === 0 ? '✅' : '❌') + ' bindings 为空: ' + data.bindings.length);
  const bizTypes = [...new Set(data.reports.map((r) => r.biz_type))].sort();
  const hasNullCat = data.reports.some((r) => r.category_code === null);
  out.push((bizTypes.length === 5 ? '✅' : '❌') + ' reports 覆盖 5 种 biz_type: ' + bizTypes.join(' '));
  out.push((hasNullCat ? '✅' : '❌') + ' 至少一条 category_code=null');
  out.push((data.storageKey === 'lims.aiReview.v1' ? '✅' : '❌') + ' localStorage 键 lims.aiReview.v1');
}

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
