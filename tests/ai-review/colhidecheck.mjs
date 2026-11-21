import { chromium } from 'playwright';
import { BASE, SHOT_DIR } from './_env.mjs';

const out = [];
const err = [];
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.setViewportSize({ width: 1440, height: 900 });
await p.addInitScript(() => {
  try { localStorage.setItem('lims-prototype-annotation-enabled', '0'); } catch (e) { /* ignore */ }
});
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));

await p.goto(BASE + '/report-sign.html', { waitUntil: 'domcontentloaded' });
await p.evaluate(() => { try { localStorage.removeItem('lims.columnConfig.report-sign'); } catch (e) { /* ignore */ } });

function dumpCols() {
  return p.evaluate(() => {
    const table = document.querySelector('#flow-root table');
    if (!table) return { ok: false, why: 'no table' };
    const wrap = table.closest('.overflow-x-auto') || table.parentElement;
    const ths = [...table.querySelectorAll('thead th')].map((th) => ({
      key: th.getAttribute('data-col-key'),
      display: th.style.display || getComputedStyle(th).display,
      w: Math.round(th.getBoundingClientRect().width),
      left: Math.round(th.getBoundingClientRect().left)
    }));
    const tds = [...(table.querySelector('tbody tr')?.querySelectorAll('td') || [])].map((td) => ({
      key: td.getAttribute('data-col-key'),
      display: td.style.display || getComputedStyle(td).display,
      w: Math.round(td.getBoundingClientRect().width),
      text: (td.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24)
    }));
    const vis = ths.filter((c) => c.display !== 'none');
    const op = vis.find((c) => c.key === '操作');
    const wrapR = wrap.getBoundingClientRect();
    const overlap = vis.filter((c) => {
      if (!op || !/^(序号|委托编号|样品名称)$/.test(c.key) || c.w < 1) return false;
      return c.left < op.left + op.w - 8 && c.left + c.w > op.left + 8;
    }).map((c) => c.key);
    const named = (k) => vis.find((c) => c.key === k);
    const collapsed = vis.filter((c) => c.key !== '操作' && c.w < 24).map((c) => c.key + ':' + c.w);
    return {
      tableW: table.offsetWidth,
      wrapW: Math.round(wrapR.width),
      opW: op ? op.w : 0,
      opLeft: op ? op.left : -1,
      visKeys: vis.map((c) => c.key),
      hiddenKeys: ths.filter((c) => c.display === 'none').map((c) => c.key),
      seq: named('序号') && named('序号').w,
      code: named('委托编号') && named('委托编号').w,
      cust: named('客户单位') && named('客户单位').w,
      sample: named('样品名称') && named('样品名称').w,
      rec: named('报告记录') && named('报告记录').w,
      goSign: (tds.find((c) => c.key === '操作') || {}).text,
      overlap,
      collapsed
    };
  });
}

function judge(label, info, expectHidden) {
  const hidden = new Set(expectHidden);
  const hiddenOk = (info.hiddenKeys || []).join() === expectHidden.join();
  const visOk = (info.seq || 0) >= 48 && (info.code || 0) >= 80
    && (hidden.has('客户单位') || (info.cust || 0) >= 80)
    && (hidden.has('样品名称') || (info.sample || 0) >= 80)
    && info.opW >= 100;
  const opNotHuge = info.opW > 0 && info.opW <= 240;
  const noCollapse = (info.collapsed || []).length === 0;
  const noOverlap = (info.overlap || []).length === 0;
  const actionOk = /去签发/.test(info.goSign || '');
  const ok = hiddenOk && visOk && opNotHuge && noCollapse && noOverlap && actionOk;
  out.push((ok ? '✅' : '❌') + ' ' + label + ' ' + JSON.stringify({
    hidden: info.hiddenKeys, seq: info.seq, code: info.code, cust: info.cust,
    sample: info.sample, rec: info.rec, opW: info.opW, overlap: info.overlap,
    collapsed: info.collapsed, goSign: info.goSign
  }));
}

await p.goto(BASE + '/report-sign.html', { waitUntil: 'load' });
await p.waitForTimeout(350);
await p.evaluate(() => { var b = document.getElementById('cc-trigger'); if (b) b.click(); });
await p.waitForTimeout(150);
await p.evaluate(() => window.ColumnConfig._toggle('合同编号', false));
await p.waitForTimeout(250);
const afterHide = await dumpCols();
judge('隐藏合同编号后名单列仍在', afterHide, ['合同编号']);
await p.screenshot({ path: SHOT_DIR + '/colhide-sign-contract.png', fullPage: false });

await p.evaluate(() => window.ColumnConfig._save());
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(350);
const afterReload = await dumpCols();
judge('保存刷新后隐藏仍不塌列', afterReload, ['合同编号']);

await p.evaluate(() => {
  window.ColumnConfig._toggle('客户单位', false);
  window.ColumnConfig._toggle('编制人', false);
});
await p.waitForTimeout(250);
const afterMore = await dumpCols();
judge('再藏客户单位/编制人仍不塌列', afterMore, ['合同编号', '客户单位', '编制人']);
await p.screenshot({ path: SHOT_DIR + '/colhide-sign-more.png', fullPage: false });

await p.evaluate(() => window.ColumnConfig._reset());
await p.waitForTimeout(200);
const afterReset = await dumpCols();
judge('重置后合同编号回来', afterReset, []);

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
