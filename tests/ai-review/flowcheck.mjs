import { chromium } from 'playwright';
import { BASE, SHOT_DIR } from './_env.mjs';

const out = [];
const err = [];
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage();
p.setViewportSize({ width: 1440, height: 900 });
p.on('pageerror', (e) => err.push('pageerror: ' + e.message));
const dialogs = [];
p.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

await p.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(200);
const menu = await p.locator('#sidebar, aside, .sidebar, body').first().evaluate(() => document.body.innerHTML);
out.push((/report-sign\.html/.test(menu) && /report-process\.html/.test(menu) && /report-fee\.html/.test(menu) && /report-issue\.html/.test(menu) && /task-archive\.html/.test(menu) && /task-complete\.html/.test(menu) ? '✅' : '❌') + ' 报告管理菜单挂签发到完成');
out.push((/original-record-list\.html/.test(menu) && !/data-placeholder\.html\?name=原始记录/.test(menu) ? '✅' : '❌') + ' 原始记录改挂检测管理');

await p.goto(BASE + '/report-sign.html', { waitUntil: 'load' });
await p.waitForTimeout(250);
const signN = await p.locator('#flow-root tbody tr').count();
out.push((signN >= 1 ? '✅' : '❌') + ' 签发名单有任务: ' + signN);
const signHead = await p.locator('#flow-root thead').textContent();
out.push((/合同编号/.test(signHead) && /客户单位/.test(signHead) && /样品名称/.test(signHead) && /样品大类/.test(signHead) && /报告记录/.test(signHead) && !/要求完成日期/.test(signHead.replace('客户要求完成日期', '')) ? '✅' : '❌') + ' 名单列与审核对齐');
const recBefore = dialogs.length;
await p.locator('#flow-root [data-record]').first().click();
await p.waitForTimeout(280);
const drawerOpen = await p.locator('#flowRecordDrawer').evaluate((el) => el && el.classList.contains('open') && !el.classList.contains('hidden'));
const drawerText = await p.locator('#flowRecordDrawer').textContent();
out.push((drawerOpen ? '✅' : '❌') + ' 报告记录打开抽屉');
out.push((/操作日志/.test(drawerText) && /报告编制/.test(drawerText) && /报告审核/.test(drawerText) ? '✅' : '❌') + ' 抽屉含节点时间线');
out.push((dialogs.length === recBefore ? '✅' : '❌') + ' 报告记录不再弹 alert');
await p.screenshot({ path: SHOT_DIR + '/flow-record-drawer.png' });
await p.locator('#flowRecordClose').click();
await p.waitForTimeout(250);
const signHref = await p.locator('#flow-root a[href*="report-sign-edit.html"]').first().getAttribute('href');
out.push((/report-sign-edit\.html/.test(signHref || '') ? '✅' : '❌') + ' 去签发进入编辑页');
await p.goto(BASE + '/' + signHref, { waitUntil: 'load' });
await p.waitForTimeout(250);
const signBody = await p.locator('body').textContent();
out.push((/签发工作台/.test(signBody) && /报告预览/.test(signBody) && /收样信息/.test(signBody) ? '✅' : '❌') + ' 去签发进入签发工作台');
out.push(((await p.locator('#roster-list [data-code]').count()) >= 2 ? '✅' : '❌') + ' 左侧待签发名单');
out.push((/报告文件/.test(signBody) && /检测信息/.test(signBody) && !/签发检查/.test(signBody) ? '✅' : '❌') + ' 中间为报告预览非 AI 检查');
out.push(((await p.locator('#btn-expand-info').count()) === 0 ? '✅' : '❌') + ' 报告文件区无展开按钮');
await p.locator('#ov-toggle').click();
await p.waitForTimeout(150);
out.push(((await p.locator('.ov-tab').count()) === 4 && /合同信息/.test(signBody) && /付款信息/.test(signBody) && /报告信息/.test(signBody) ? '✅' : '❌') + ' 概览含合同/委托/付款/报告 Tab');
await p.locator('.ov-tab[data-tab="contract"]').click();
await p.waitForTimeout(120);
out.push((/合同附件/.test(await p.locator('#ov-panel').textContent() || '') ? '✅' : '❌') + ' 合同信息 Tab 含附件');
await p.locator('.ov-tab[data-tab="pay"]').click();
await p.waitForTimeout(120);
out.push((/收费通知单/.test(await p.locator('#ov-panel').textContent() || '') ? '✅' : '❌') + ' 付款信息 Tab 含通知单');
out.push((await p.locator('#btn-pass').isEnabled() ? '✅' : '❌') + ' 可签发任务按钮可用');
await p.locator('#roster-list [data-code="SC2026/0256"]').click();
await p.waitForTimeout(220);
out.push((await p.locator('#btn-pass').isEnabled() ? '✅' : '❌') + ' 切换任务仍可签发');
await p.locator('#roster-list [data-code="SC2026/0238"]').click();
await p.waitForTimeout(200);
out.push(((await p.locator('#rp-file').textContent() || '').indexOf('检测报告') >= 0 ? '✅' : '❌') + ' 展示报告文件名');
await p.screenshot({ path: SHOT_DIR + '/flow-sign-workbench.png' });
await p.locator('#btn-pass').click();
await p.waitForTimeout(200);
out.push((/report-sign\.html/.test(p.url()) ? '✅' : '❌') + ' 签发通过回到名单');

await p.goto(BASE + '/report-process.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.locator('[data-open]').first().click();
await p.waitForTimeout(150);
out.push((await p.locator('#flow-modal button[data-modal-pass]').textContent() === '处理通过' ? '✅' : '❌') + ' 处理弹窗处理通过');
await p.locator('#flow-modal button[data-modal-pass]').click();
await p.waitForTimeout(200);

await p.goto(BASE + '/report-fee.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.locator('[data-open]').first().click();
await p.waitForTimeout(150);
out.push((/审批通过/.test(await p.locator('#flow-modal').textContent()) ? '✅' : '❌') + ' 收费审批弹窗审批通过');
await p.locator('#flow-cancel').click();

await p.goto(BASE + '/report-issue.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.locator('[data-open]').first().click();
await p.waitForTimeout(150);
out.push((/填写地址/.test(await p.locator('#flow-modal').textContent()) && /发放通过/.test(await p.locator('#flow-modal').textContent()) ? '✅' : '❌') + ' 发放弹窗含地址与发放通过');
await p.locator('#flow-modal [data-addr]').first().click();
await p.waitForTimeout(120);
out.push((/填写报告发放信息/.test(await p.locator('#flow-modal').textContent()) ? '✅' : '❌') + ' 填写发放信息');

await p.goto(BASE + '/task-archive.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
out.push(((await p.locator('[data-pass]').count()) >= 1 && (await p.locator('[data-back]').count()) >= 1 ? '✅' : '❌') + ' 任务归档有归档/退回');
out.push((/报告记录/.test(await p.locator('#flow-root thead').textContent()) && /样品大类/.test(await p.locator('#flow-root thead').textContent()) && !/任务归档/.test(await p.locator('#flow-root thead').textContent()) ? '✅' : '❌') + ' 归档名单去掉任务归档列');
await p.locator('#flow-root a[data-record]').first().click();
await p.waitForTimeout(280);
out.push((await p.locator('#flowRecordDrawer').evaluate((el) => el && el.classList.contains('open')) ? '✅' : '❌') + ' 归档查看打开报告记录抽屉');
await p.locator('#flowRecordClose').click();
await p.waitForTimeout(200);

await p.goto(BASE + '/task-complete.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
out.push((/发放记录/.test(await p.locator('#flow-root thead').textContent()) ? '✅' : '❌') + ' 任务完成末列发放记录');
const stickyRight = await p.evaluate(() => {
  const rec = document.querySelector('#flow-root thead th[data-col-key="报告记录"]');
  const ship = document.querySelector('#flow-root thead th[data-col-key="发放记录"]');
  if (!rec || !ship) return { ok: false };
  const rs = getComputedStyle(rec).position;
  const ss = getComputedStyle(ship).position;
  return { ok: rec.classList.contains('cc-fz') && ship.classList.contains('cc-fz') && rs === 'sticky' && ss === 'sticky', recW: Math.round(rec.getBoundingClientRect().width), shipW: Math.round(ship.getBoundingClientRect().width) };
});
out.push((stickyRight.ok ? '✅' : '❌') + ' 任务完成报告记录与发放记录冻结 ' + JSON.stringify(stickyRight));
const viewN = await p.locator('#flow-root a[data-ship]').filter({ hasText: '查看' }).count();
out.push((viewN >= 1 ? '✅' : '❌') + ' 任务完成发放记录查看');
await p.locator('#flow-root a[data-ship]').filter({ hasText: '查看' }).first().click();
await p.waitForTimeout(280);
const shipModal = await p.locator('#flow-modal').textContent();
out.push((/报告发放记录/.test(shipModal) && /快递公司/.test(shipModal) && /快递单号/.test(shipModal) && /联系人/.test(shipModal) ? '✅' : '❌') + ' 查看打开发放阶段发放记录');
out.push((await p.evaluate(() => {
  var el = document.getElementById('flowRecordDrawer');
  return !!(el && el.classList.contains('open') && !el.classList.contains('hidden'));
}) ? '❌' : '✅') + ' 查看不打开报告记录抽屉');
await p.screenshot({ path: SHOT_DIR + '/flow-complete-ship.png' });
await p.locator('#flow-cancel').click();
await p.waitForTimeout(150);
await p.locator('#flow-root [data-record]').first().click();
await p.waitForTimeout(250);
out.push((await p.locator('#flowRecordDrawer').evaluate((el) => el && el.classList.contains('open')) ? '✅' : '❌') + ' 报告记录仍开抽屉');
await p.locator('#flowRecordClose').click();
await p.waitForTimeout(200);

const reportLists = [
  ['/report-list.html', '报告编制'],
  ['/report-review.html', '报告审核'],
  ['/report-sign.html', '报告签发'],
  ['/report-process.html', '报告处理'],
  ['/report-fee.html', '收费审批'],
  ['/report-issue.html', '报告发放'],
  ['/task-archive.html', '任务归档'],
  ['/task-complete.html', '任务完成']
];
for (const [href, name] of reportLists) {
  await p.goto(BASE + href, { waitUntil: 'load' });
  await p.waitForTimeout(280);
  const n = await p.locator('#cc-trigger').count();
  out.push((n === 1 ? '✅' : '❌') + ' ' + name + ' 操作列配置入口');
}
await p.goto(BASE + '/report-sign.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.locator('#btn-search').click();
await p.waitForTimeout(250);
out.push((await p.locator('#cc-trigger').count() === 1 ? '✅' : '❌') + ' 查询后列配置仍在');

async function searchOnRow2Right(href) {
  await p.goto(BASE + href, { waitUntil: 'load' });
  await p.waitForTimeout(280);
  return p.evaluate(() => {
    const wrap = document.querySelector('.ui-search-actions')
      || [...document.querySelectorAll('button')].find((b) => /查询/.test(b.textContent || ''))?.parentElement;
    if (!wrap) return { ok: false, why: 'missing' };
    const host = wrap.closest('.ui-search-grid') || wrap.parentElement;
    const box = host.getBoundingClientRect();
    const w = wrap.getBoundingClientRect();
    const fields = [...host.children].filter((el) => el !== wrap && !el.classList.contains('ui-search-actions'));
    const row1 = fields.length ? Math.min(...fields.map((el) => el.getBoundingClientRect().top)) : box.top;
    return {
      ok: w.top > row1 + 6 && w.right > box.right - 56,
      top: Math.round(w.top), row1: Math.round(row1), rightGap: Math.round(box.right - w.right)
    };
  });
}
const searchPages = [
  ['/entrust-confirm.html', '委托确认'],
  ['/report-sign.html', '报告签发'],
  ['/report-review.html', '报告审核'],
  ['/task-complete.html', '任务完成'],
  ['/entrust-register.html', '委托登记'],
  ['/category-mgmt.html', '样品大类']
];
for (const [href, name] of searchPages) {
  const pos = await searchOnRow2Right(href);
  out.push((pos.ok ? '✅' : '❌') + ' ' + name + '查询按钮在筛选右侧 ' + JSON.stringify(pos));
}

await p.goto(BASE + '/original-record-list.html', { waitUntil: 'load' });
await p.waitForTimeout(280);
out.push(((await p.locator('#body tr').count()) >= 1 ? '✅' : '❌') + ' 检测管理原始记录名单');
out.push((/样品大类/.test(await p.locator('thead').textContent() || '') ? '✅' : '❌') + ' 原始记录名单有样品大类列');
await p.goto(BASE + '/report-review.html', { waitUntil: 'load' });
await p.waitForTimeout(280);
out.push((/样品大类/.test(await p.locator('thead').textContent() || '') ? '✅' : '❌') + ' 报告审核名单有样品大类列');
await p.goto(BASE + '/task-complete.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
out.push((/样品大类/.test(await p.locator('#flow-root thead').textContent() || '') ? '✅' : '❌') + ' 任务完成名单有样品大类列');

const shots = [
  ['/report-sign.html', 'flow-sign.png'],
  ['/report-process.html', 'flow-process.png'],
  ['/report-fee.html', 'flow-fee.png'],
  ['/report-issue.html', 'flow-issue.png'],
  ['/task-archive.html', 'flow-archive.png'],
  ['/task-complete.html', 'flow-complete.png'],
  ['/original-record-list.html', 'flow-original.png']
];
for (const [href, name] of shots) {
  await p.goto(BASE + href, { waitUntil: 'load' });
  await p.waitForTimeout(180);
  await p.screenshot({ path: SHOT_DIR + '/' + name, fullPage: true });
}
await p.goto(BASE + '/report-sign.html', { waitUntil: 'load' });
await p.waitForTimeout(150);
const href2 = await p.locator('#flow-root a[href*="report-sign-edit.html"]').first().getAttribute('href');
await p.goto(BASE + '/' + href2, { waitUntil: 'load' });
await p.waitForTimeout(200);
const wbBody = await p.locator('body').textContent();
out.push((/报告预览/.test(wbBody) && /签发处置/.test(wbBody) ? '✅' : '❌') + ' 签发工作台含报告预览');
out.push((await p.locator('#btn-pass').isEnabled() ? '✅' : '❌') + ' 签发按钮可用');
await p.screenshot({ path: SHOT_DIR + '/flow-sign-edit.png', fullPage: false });
await p.screenshot({ path: SHOT_DIR + '/flow-sign-blocked.png', fullPage: false });
await p.goto(BASE + '/report-issue.html', { waitUntil: 'load' });
await p.waitForTimeout(180);
await p.locator('[data-open]').first().click();
await p.waitForTimeout(150);
await p.screenshot({ path: SHOT_DIR + '/flow-issue-modal.png' });

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
