import { chromium } from 'playwright';
import { BASE, SHOT_DIR } from './_env.mjs';

const pages = [
  ['/sample-receive.html', '收样 退回'],
  ['/sample-prepare.html', '编辑'],
  ['/sample-dispatch.html', '发样'],
  ['/sample-return-confirm.html', '还样记录'],
  ['/report-sign.html', '去签发'],
  ['/task-complete.html', '查看']
];

const out = [];
const err = [];
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.setViewportSize({ width: 1440, height: 900 });
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));

for (const [href, action] of pages) {
  await p.goto(BASE + href, { waitUntil: 'load' });
  await p.waitForTimeout(350);
  const info = await p.evaluate((actionText) => {
    const table = document.querySelector('.overflow-x-auto table, table');
    if (!table) return { ok: false, why: 'no table' };
    const wrap = table.closest('.overflow-x-auto') || table.parentElement;
    const wr = wrap.getBoundingClientRect();
    const lastTh = table.querySelector('thead th:last-child');
    const lastTd = table.querySelector('tbody tr td:last-child');
    if (!lastTh || !lastTd) return { ok: false, why: 'no last col' };
    const th = lastTh.getBoundingClientRect();
    const td = lastTd.getBoundingClientRect();
    const head = (lastTh.textContent || '').replace(/\s+/g, ' ').trim();
    const body = (lastTd.textContent || '').replace(/\s+/g, ' ').trim();
    const headOk = /操作|发放记录/.test(head);
    const bodyOk = body.indexOf(actionText) >= 0;
    const wideOk = lastTh.offsetWidth >= 100 && lastTd.offsetWidth >= 88;
    const visOk = td.right <= wr.right + 2 && td.left >= wr.left - 2 && lastTd.offsetWidth > 8;
    const gap = wr.right - th.right;
    const gapOk = gap < 48;
    const alignOk = Math.abs(th.left - td.left) < 8;
    return {
      ok: headOk && bodyOk && wideOk && visOk && gapOk && alignOk,
      head, body, w: lastTh.offsetWidth, gap: Math.round(gap),
      visOk, wideOk, gapOk, bodyOk, headOk, alignOk, tdN: table.tBodies[0] && table.tBodies[0].rows[0] && table.tBodies[0].rows[0].cells.length,
      thN: table.querySelectorAll('thead tr:first-child th').length
    };
  }, action);
  const name = href.replace(/^\//, '').replace('.html', '');
  out.push((info.ok ? '✅' : '❌') + ' ' + name + ' 操作列可见 ' + JSON.stringify(info));
  await p.screenshot({ path: SHOT_DIR + '/opcol-' + name + '.png', fullPage: false });
}

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
