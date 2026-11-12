import { chromium } from 'playwright';
import { BASE } from './_env.mjs';

const out = [];
const err = [];

const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));

await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(500);

const link = p.locator('a[href*="ai-review-workbench.html"]');
const visible = await link.count();
out.push((visible >= 1 ? '✅' : '❌') + ' index 入口链接: ' + visible);

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 3).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
