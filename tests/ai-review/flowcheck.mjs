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
const testMenu = await p.locator('.menu-group', { has: p.locator('.menu-toggle', { hasText: '试验管理' }) }).locator('.submenu a').allTextContents();
const detectMenu = await p.locator('.menu-group', { has: p.locator('.menu-toggle', { hasText: '检测管理' }) }).locator('.submenu a').allTextContents();
out.push((testMenu.map((s) => s.trim()).includes('原始记录') && /original-record-list\.html/.test(menu) ? '✅' : '❌') + ' 原始记录挂在试验管理 ' + testMenu.join('/'));
out.push((!detectMenu.map((s) => s.trim()).includes('原始记录') ? '✅' : '❌') + ' 检测管理不再挂原始记录');

await p.goto(BASE + '/report-sign.html', { waitUntil: 'load' });
await p.waitForTimeout(250);
const signN = await p.locator('#flow-root tbody tr').count();
out.push((signN >= 1 ? '✅' : '❌') + ' 签发名单有任务: ' + signN);
const sign0312 = await p.locator('#flow-root tbody tr', { hasText: 'SC2026/0312' }).textContent();
out.push((/退回/.test(sign0312 || '') ? '✅' : '❌') + ' 签发名单有退回委托');
out.push(((await p.locator('[data-ret-banner]').count()) === 0 ? '✅' : '❌') + ' 签发名单无顶部退回条幅');
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
out.push((/退回/.test(await p.locator('#roster-list [data-code="SC2026/0312"]').textContent() || '') ? '✅' : '❌') + ' 签发工作台名单有退回标签');
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
const rpFile = (await p.locator('#rp-file').textContent() || '');
out.push((/检测报告/.test(rpFile) ? '✅' : '❌') + ' 展示报告文件名');
out.push((/\.docx/.test(rpFile) && !/\.pdf/.test(rpFile) ? '✅' : '❌') + ' 签发前报告为 Word ' + rpFile.trim());
await p.screenshot({ path: SHOT_DIR + '/flow-sign-workbench.png' });
await p.locator('#btn-pass').click();
await p.waitForTimeout(200);
out.push((/report-sign\.html/.test(p.url()) ? '✅' : '❌') + ' 签发通过回到名单');

await p.goto(BASE + '/report-process.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
out.push(((await p.locator('[data-annotate="flow-open"]').count()) >= 1 ? '✅' : '❌') + ' 处理名单挂需求批注');
await p.locator('tr', { hasText: 'SC2026/0439' }).locator('[data-open]').click();
await p.waitForTimeout(150);
out.push((await p.locator('#flow-modal button[data-modal-pass]').textContent() === '处理通过' ? '✅' : '❌') + ' 处理弹窗处理通过');
out.push(((await p.locator('#flow-modal .rep-check').count()) >= 2 ? '✅' : '❌') + ' 处理弹窗多报告勾选 ' + (await p.locator('#flow-modal .rep-check').count()));
out.push(((await p.locator('#flow-modal #check-all').count()) === 1 ? '✅' : '❌') + ' 处理弹窗全选');
const processFiles = await p.locator('#flow-modal').textContent();
out.push((/\.pdf/.test(processFiles) && !/检测报告\.docx/.test(processFiles) ? '✅' : '❌') + ' 签发后处理弹窗报告为 PDF');
await p.locator('#flow-modal button[data-modal-pass]').click();
await p.waitForTimeout(200);

await p.goto(BASE + '/report-fee.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.locator('tr', { hasText: 'SC2026/0175' }).locator('[data-open]').click();
await p.waitForTimeout(150);
out.push((/审批通过/.test(await p.locator('#flow-modal').textContent()) ? '✅' : '❌') + ' 收费审批弹窗审批通过');
out.push(((await p.locator('#flow-modal .rep-check').count()) >= 2 ? '✅' : '❌') + ' 收费弹窗多报告勾选 ' + (await p.locator('#flow-modal .rep-check').count()));
await p.locator('#flow-cancel').click();

await p.goto(BASE + '/report-issue.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
await p.locator('tr', { hasText: 'SC2026/0166' }).locator('[data-open]').click();
await p.waitForTimeout(150);
const issueTxt = await p.locator('#flow-modal').textContent();
out.push((/勾选待发放报告/.test(issueTxt) && /填写发放信息/.test(issueTxt) && /发放通过/.test(issueTxt) ? '✅' : '❌') + ' 发放弹窗三步动线');
out.push(((await p.locator('#flow-modal .rep-check').count()) >= 2 ? '✅' : '❌') + ' 发放弹窗多报告勾选');
out.push((/\.pdf/.test(issueTxt) && !/检测报告\.docx/.test(issueTxt) ? '✅' : '❌') + ' 发放弹窗报告为 PDF');
const issueFoot = await p.locator('#flow-modal [data-annotate="flow-issue-foot"]').textContent();
out.push((/发放通过/.test(issueFoot) && !/填写发放信息/.test(issueFoot) && !/修改发放信息/.test(issueFoot) ? '✅' : '❌') + ' 发放底栏去掉填写/修改发放信息');
const filledAddr = /修改发放信息/.test(issueTxt);
out.push((filledAddr ? '❌' : '✅') + ' 已填地址后不再出现修改发放信息按钮');
await p.locator('#flow-modal [data-addr]').first().click();
await p.waitForTimeout(120);
out.push((/填写报告发放信息/.test(await p.locator('#flow-modal').textContent()) ? '✅' : '❌') + ' 填写发放信息');

await p.goto(BASE + '/task-archive.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
out.push(((await p.locator('[data-pass]').count()) >= 1 && (await p.locator('[data-back]').count()) >= 1 ? '✅' : '❌') + ' 任务归档有归档/退回');
out.push(((await p.locator('#flow-root .ret-tag').count()) === 0 ? '✅' : '❌') + ' 归档名单无退回标签');
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
out.push(((await p.locator('#body tr').count()) >= 1 ? '✅' : '❌') + ' 试验管理原始记录名单');
out.push((/样品大类/.test(await p.locator('thead').textContent() || '') ? '✅' : '❌') + ' 原始记录名单有样品大类列');
await p.goto(BASE + '/report-list.html', { waitUntil: 'load' });
await p.waitForTimeout(280);
const listHead = await p.locator('thead tr').first().locator('th').allTextContents();
const listCat = listHead.findIndex((t) => t.trim() === '样品大类');
const listName = listHead.findIndex((t) => t.trim() === '样品名称');
out.push((/样品大类/.test(listHead.join('')) ? '✅' : '❌') + ' 报告编制名单有样品大类列');
out.push((listName >= 0 && listCat === listName + 1 ? '✅' : '❌') + ' 报告编制样品大类在样品名称后 ' + JSON.stringify({ listName, listCat }));
out.push((await p.locator('[data-annotate="rv-col-cat"]').count() === 0 ? '✅' : '❌') + ' 编制页无样品大类批注卡片');

await p.goto(BASE + '/report-review.html', { waitUntil: 'load' });
await p.waitForTimeout(280);
out.push((await p.locator('[data-annotate="rv-col-cat"]').count() === 0 ? '✅' : '❌') + ' 审核页去掉样品大类批注卡片');
out.push((/退回/.test(await p.locator('tbody').first().textContent() || '') ? '✅' : '❌') + ' 审核名单有签发退回标签');
const rvHead = await p.locator('thead tr').first().locator('th').allTextContents();
const rvCat = rvHead.findIndex((t) => t.trim() === '样品大类');
const rvName = rvHead.findIndex((t) => t.trim() === '样品名称');
out.push((/样品大类/.test(rvHead.join('')) ? '✅' : '❌') + ' 报告审核名单有样品大类列');
out.push((rvName >= 0 && rvCat === rvName + 1 ? '✅' : '❌') + ' 报告审核样品大类在样品名称后 ' + JSON.stringify({ rvName, rvCat, first: rvHead[0] }));
out.push((/报告记录/.test(rvHead.join('')) && !/退回详情/.test(rvHead.join('')) ? '✅' : '❌') + ' 报告审核名单去掉退回详情列');
await p.evaluate(() => { var b = document.getElementById('cc-trigger'); if (b) b.click(); });
await p.waitForTimeout(200);
const panelTxt = await p.locator('#cc-panel').textContent();
out.push((/样品大类/.test(panelTxt || '') ? '✅' : '❌') + ' 报告审核列配置含样品大类');
await p.evaluate(() => { if (window.ColumnConfig) ColumnConfig._close(true); });
await p.waitForTimeout(120);
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

await p.goto(BASE + '/report-sign.html', { waitUntil: 'load' });
await p.waitForTimeout(250);
out.push(((await p.locator('[data-annotate="flow-open"]').count()) >= 1 ? '✅' : '❌') + ' 签发名单挂需求批注');
await p.evaluate(() => { var b = document.getElementById('cc-trigger'); if (b) b.click(); });
await p.waitForTimeout(180);
const beforeMove = await p.evaluate(() => {
  const keys = [...document.querySelectorAll('#flow-root thead th')].map((th) => th.getAttribute('data-col-key'));
  return { keys, unitIdx: keys.indexOf('客户单位'), catN: keys.filter((k) => k === '样品大类').length };
});
await p.evaluate(() => { if (window.ColumnConfig) ColumnConfig._move('客户单位', 1); });
await p.waitForTimeout(400);
const afterMove = await p.evaluate(() => {
  const keys = [...document.querySelectorAll('#flow-root thead th')].map((th) => th.getAttribute('data-col-key'));
  const labels = [...document.querySelectorAll('#flow-root thead th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim());
  return {
    keys,
    unique: new Set(keys).size === keys.length,
    first: labels[0].indexOf('序号') === 0,
    last: /操作/.test(labels[labels.length - 1]),
    catN: keys.filter((k) => k === '样品大类').length,
    unitIdx: keys.indexOf('客户单位')
  };
});
out.push((afterMove.unique && afterMove.first && afterMove.last && afterMove.keys.length === beforeMove.keys.length && afterMove.catN === 1 ? '✅' : '❌') + ' 移动列后不闪且列不乱 ' + JSON.stringify(afterMove));
out.push((afterMove.unitIdx === beforeMove.unitIdx + 1 ? '✅' : '❌') + ' 客户单位下移生效');
const href3 = await p.locator('#flow-root a[href*="report-sign-edit.html"]').first().getAttribute('href');
await p.goto(BASE + '/' + href3, { waitUntil: 'load' });
await p.waitForTimeout(200);
out.push(((await p.locator('[data-annotate="sg-action"]').count()) === 1 ? '✅' : '❌') + ' 签发工作台挂需求批注');

await p.goto(BASE + '/fee-audit-edit.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
const feeHead = await p.locator('.fee-table thead').first().textContent();
out.push((/样品单价/.test(feeHead) && /样品总价/.test(feeHead) ? '✅' : '❌') + ' 费用审核编辑有样品单价/总价列');

await p.goto(BASE + '/entrust-register.html', { waitUntil: 'load' });
await p.waitForTimeout(250);
out.push((/退回详情/.test(await p.locator('thead').textContent() || '') ? '✅' : '❌') + ' 委托登记有退回详情列');
out.push((/退回/.test(await p.locator('#registerTableBody').textContent() || '') ? '✅' : '❌') + ' 委托登记有退回标签');

await p.goto(BASE + '/test-detect-edit.html?code=SC2026/0052', { waitUntil: 'load' });
await p.waitForTimeout(280);
const detHead = await p.locator('.test-group-header').first().textContent();
out.push((/检测员/.test(detHead) && /检测时间/.test(detHead) ? '✅' : '❌') + ' 试验项表头有检测员和检测时间');
out.push(((await p.locator('.test-group-header .ret-tag').count()) === 0 ? '✅' : '❌') + ' 试验项名称后无退回标签');
const warnWrap = p.locator('#panel-rod tr.ret-row .st-status .ret-warn-wrap').first();
out.push(((await p.locator('#panel-rod tr.ret-row .st-tag.is-back').count()) >= 1 ? '✅' : '❌') + ' 退回行状态为黄色已退回');
out.push(((await warnWrap.count()) ? '✅' : '❌') + ' 已退回标签右侧有感叹号');
if (await warnWrap.count()) {
  await warnWrap.hover();
  await warnWrap.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 1, clientY: 1 }));
  });
  await p.waitForTimeout(80);
  const tipTxt = (await p.locator('#ret-warn-tip').textContent()) || '';
  const tipOn = await p.locator('#ret-warn-tip.is-on').count();
  out.push((tipOn && /交流耐压试验值低于标称值/.test(tipTxt) && /来源/.test(tipTxt) && /数据审核/.test(tipTxt) && /退回人/.test(tipTxt) && /李数据/.test(tipTxt) && /时间/.test(tipTxt) ? '✅' : '❌') + ' 感叹号与条幅最新一次的原因和来源一致');
  await p.screenshot({ path: SHOT_DIR + '/detect-warn-tip.png' });
}
const detHeads = await p.locator('.detect-table').first().locator('thead th').allTextContents();
const conclIdx = detHeads.indexOf('结论');
const statusIdx = detHeads.indexOf('状态');
out.push((conclIdx >= 0 && statusIdx === conclIdx + 1 ? '✅' : '❌') + ' 试验检测结论列在状态列前');
const detStrip = await p.locator('.ret-strip').evaluate((el) => {
  const s = getComputedStyle(el);
  const inner = el.querySelector('.ret-tl');
  const is = inner ? getComputedStyle(inner) : {};
  return { h: s.height, minH: s.minHeight, maxH: s.maxHeight, overflow: s.overflowY, inner: is.overflowY || '' };
}).catch(() => null);
out.push((detStrip && detStrip.h === '152px' && detStrip.maxH === '152px' && detStrip.inner === 'auto' ? '✅' : '❌') + ' 试验检测条幅定高可滚动 ' + JSON.stringify(detStrip));
const rodRet = await p.locator('#panel-rod .test-group').first().locator('tbody tr.ret-row').count();
out.push((rodRet === 2 ? '✅' : '❌') + ' 操作杆交流耐压单条退回 2 行 ' + rodRet);
await p.locator('.sample-tab', { hasText: '绝缘横担' }).click();
await p.waitForTimeout(150);
const armHeads = await p.locator('#panel-crossarm .test-group').nth(1).locator('thead th').allTextContents();
out.push((armHeads.indexOf('相别') === 1 ? '✅' : '❌') + ' 横担交流耐压有相别列 ' + armHeads.join('/'));
const armRet = await p.locator('#panel-crossarm .test-group').nth(1).locator('tbody tr.ret-row').count();
out.push((armRet === 0 ? '✅' : '❌') + ' 0052 操作杆无相别，横担不再整相退回 ' + armRet);
const d52Strip = (await p.locator('.ret-strip').textContent()) || '';
out.push((/第\s*2\s*次/.test(d52Strip) && /数据审核/.test(d52Strip) && /交流耐压试验值低于标称值/.test(d52Strip) && !/红相局部放电/.test(d52Strip) ? '✅' : '❌') + ' 0052 第二次退回来源为数据审核且原因不含相别');
const yellowHit = await p.evaluate(() => {
  const table = document.querySelectorAll('#panel-crossarm .test-group')[1];
  if (!table) return -1;
  return [...table.querySelectorAll('tbody tr')].filter((tr) => /黄/.test(tr.textContent || '') && tr.classList.contains('ret-row')).length;
});
out.push((yellowHit === 0 ? '✅' : '❌') + ' 横担黄相未整相退回 ' + yellowHit);

await p.goto(BASE + '/test-detect-edit.html?code=SC2026/0062', { waitUntil: 'load' });
await p.waitForTimeout(280);
const d62Strip = (await p.locator('.ret-strip').textContent()) || '';
out.push((/数据审核/.test(d62Strip) && /绝缘硬梯/.test(d62Strip) && /相别 红/.test(d62Strip) ? '✅' : '❌') + ' 0062检测条幅来自数据审核整相');
const ladderHeads = await p.locator('#panel-ladder .test-group').nth(1).locator('thead th').allTextContents();
out.push((ladderHeads.indexOf('相别') === 1 ? '✅' : '❌') + ' 硬梯交流耐压有相别列');
const ladderRet = await p.locator('#panel-ladder .test-group').nth(1).locator('tbody tr.ret-row').count();
out.push((ladderRet === 4 ? '✅' : '❌') + ' 硬梯红相整相退回 4 行 ' + ladderRet);
const g62Item = await p.locator('#panel-ladder .test-group').nth(1).locator('.group-title .ret-tag').count();
out.push((g62Item === 0 ? '✅' : '❌') + ' 硬梯交流耐压标题无退回标签');

await p.goto(BASE + '/test-detect-edit.html?code=SC2026/0060', { waitUntil: 'load' });
await p.waitForTimeout(250);
const d60Strip = (await p.locator('.ret-strip').textContent()) || '';
out.push((/数据审核/.test(d60Strip) && /抗弯/.test(d60Strip) ? '✅' : '❌') + ' 0060检测条幅来自数据审核单条');
const dynRet = await p.locator('#panel-rod .test-group').nth(2).locator('tbody tr.ret-row').count();
out.push((dynRet === 1 ? '✅' : '❌') + ' 操作杆抗弯无相别只退 1 行 ' + dynRet);

await p.goto(BASE + '/test-audit-edit.html?type=group&code=SC2026/0052', { waitUntil: 'load' });
await p.waitForTimeout(220);
const auditHeads = await p.locator('.audit-table').nth(1).locator('thead th').allTextContents();
const aConcl = auditHeads.indexOf('结论');
const aStatus = auditHeads.indexOf('状态');
out.push((aConcl >= 0 && aStatus === aConcl + 1 ? '✅' : '❌') + ' 组内审核结论列在状态列前');

await p.goto(BASE + '/test-audit-edit.html?type=group&code=SC2026/0062', { waitUntil: 'load' });
await p.waitForTimeout(250);
const g62Body = (await p.locator('body').textContent()) || '';
out.push(((await p.locator('.ret-strip').count()) === 0 ? '✅' : '❌') + ' 组内审核详情无退回条幅');
out.push(((await p.locator('.ret-row, .test-group-header .ret-tag').count()) === 0 ? '✅' : '❌') + ' 组内审核详情无试样/试验项退回标');
out.push((!/可查看退回原因/.test(g62Body) ? '✅' : '❌') + ' 组内审核详情无退回原因说明');

await p.goto(BASE + '/test-audit-edit.html?type=data&code=SC2026/0062', { waitUntil: 'load' });
await p.waitForTimeout(220);
const dataHeads = await p.locator('.audit-table').nth(1).locator('thead th').allTextContents();
const dConcl = dataHeads.indexOf('结论');
const dStatus = dataHeads.indexOf('状态');
out.push((dConcl >= 0 && dStatus === dConcl + 1 ? '✅' : '❌') + ' 数据审核结论列在状态列前');

await p.goto(BASE + '/test-audit-edit.html?type=data&code=SC2026/0055&sample=' + encodeURIComponent('绝缘毯') + '&tester=' + encodeURIComponent('张三'), { waitUntil: 'load' });
await p.waitForTimeout(280);
const d55 = (await p.locator('body').textContent()) || '';
out.push((/退回记录/.test(d55) && /绝缘毯外观结论/.test(d55) && /报告编制/.test(d55) ? '✅' : '❌') + ' 数据审核0055详情顶部有整单退回记录');
const d55Strip = await p.locator('.ret-strip').evaluate((el) => {
  const s = getComputedStyle(el);
  const inner = el.querySelector('.ret-tl');
  return { h: s.height, maxH: s.maxHeight, inner: inner ? getComputedStyle(inner).overflowY : '' };
}).catch(() => null);
out.push((d55Strip && d55Strip.h === '152px' && d55Strip.maxH === '152px' && d55Strip.inner === 'auto' ? '✅' : '❌') + ' 数据审核条幅定高可滚动 ' + JSON.stringify(d55Strip));
const d55ItemTag = await p.locator('.test-group-header .ret-tag, .test-group-header .ret-warn-wrap').count();
out.push((d55ItemTag === 0 ? '✅' : '❌') + ' 数据审核0055试验项名称后无退回标签 ' + d55ItemTag);
out.push((!/可查看退回原因/.test(d55) && /可查看不合格原因/.test(d55) ? '✅' : '❌') + ' 数据审核详情去掉悬停看退回原因说明');
const orHead = (await p.locator('[data-annotate="audit-or-table"] thead').textContent()) || '';
out.push((/覆盖样品/.test(orHead) && /生成模式/.test(orHead) && /状态/.test(orHead) && /操作/.test(orHead) ? '✅' : '❌') + ' 审核页原始记录表与委托详情列对齐');
out.push((/SC2026\/0055-外观及尺寸-原始记录/.test(d55) ? '✅' : '❌') + ' 0055原始记录按试验项出文件');

await p.goto(BASE + '/change-apply.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
out.push((/变更申请/.test(await p.locator('#tableBody').textContent() || '') && !/>\s*编辑\s*</.test(await p.locator('#tableBody').innerHTML()) ? '✅' : '❌') + ' 变更申请操作列改为变更申请');
out.push((/审批未通过/.test(await p.locator('#tableBody').textContent() || '') ? '✅' : '❌') + ' 变更申请有审批未通过标签');
const tabPos = await p.evaluate(() => {
  const el = document.getElementById('pageTabs');
  return el ? getComputedStyle(el).position : '';
});
out.push((tabPos === 'sticky' ? '✅' : '❌') + ' 页签栏 sticky 固定');
const pagerInScroll = await p.evaluate(() => {
  const pager = [...document.querySelectorAll('span,div')].find((n) => /^共\s*\d+\s*条/.test((n.textContent || '').trim()));
  if (!pager) return 'missing';
  const ox = pager.closest('.overflow-x-auto, .ui-table-scroll');
  return ox && ox.querySelector('table') ? 'inside' : 'outside';
});
out.push((pagerInScroll === 'outside' ? '✅' : '❌') + ' 分页不在表格横滚容器内 ' + pagerInScroll);

await p.evaluate(() => { try { localStorage.removeItem('lims.columnConfig.change-apply'); } catch (e) {} });
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(350);
await p.evaluate(() => {
  if (window.ColumnConfig) {
    window.ColumnConfig._toggle('合同编号', false);
    window.ColumnConfig._save();
  }
});
await p.reload({ waitUntil: 'load' });
await p.waitForTimeout(400);
const hiddenAfter = await p.evaluate(() => {
  const th = [...document.querySelectorAll('thead th')].find((n) => (n.getAttribute('data-col-key') || n.textContent || '').indexOf('合同编号') >= 0);
  return th ? (th.style.display || getComputedStyle(th).display) : 'missing';
});
out.push((hiddenAfter === 'none' ? '✅' : '❌') + ' 列配置保存后刷新仍隐藏合同编号 ' + hiddenAfter);

await p.goto(BASE + '/change-apply-edit.html?code=SC2026/0069', { waitUntil: 'load' });
await p.waitForTimeout(200);
const rejTxt = (await p.locator('body').textContent()) || '';
out.push((/审批未通过/.test(rejTxt) && /不通过/.test(rejTxt) && /客户要求完成日期早于合同约定/.test(rejTxt) ? '✅' : '❌') + ' 审批未通过详情展示驳回数据');

await p.goto(BASE + '/group-audit.html', { waitUntil: 'load' });
await p.waitForTimeout(250);
const gTxt = (await p.locator('#tableBody').textContent()) || '';
out.push((/SC2026\/0062/.test(gTxt) ? '✅' : '❌') + ' 组内审核名单仍有 0062 待审任务');
out.push(((await p.locator('#tableBody .ret-tag').count()) === 0 ? '✅' : '❌') + ' 组内审核名单无退回标签');

await p.goto(BASE + '/test-detect.html', { waitUntil: 'load' });
await p.waitForTimeout(250);
const detList = (await p.locator('#tableBody').textContent()) || '';
out.push((/SC2026\/0062/.test(detList) && /SC2026\/0060/.test(detList) ? '✅' : '❌') + ' 试验检测名单含数据审核退回委托');
out.push(((await p.locator('#tableBody .ret-tag').count()) >= 2 ? '✅' : '❌') + ' 试验检测名单有退回标签');

await p.goto(BASE + '/data-audit.html', { waitUntil: 'load' });
await p.waitForTimeout(250);
const daTxt = (await p.locator('#tableBody').textContent()) || '';
out.push((/SC2026\/0055/.test(daTxt) && /退回/.test(daTxt) && /查看/.test(daTxt) ? '✅' : '❌') + ' 数据审核名单有退回标签和详情');
const daWrap = await p.evaluate(() => {
  const row = [...document.querySelectorAll('#tableBody tr')].find((tr) => /SC2026\/0055/.test(tr.textContent || ''));
  if (!row) return 'missing';
  const stack = row.querySelector('.ret-code-stack');
  if (!stack) return 'no-stack';
  const wrap = getComputedStyle(stack).flexWrap;
  return (wrap === 'nowrap' && stack.scrollHeight < 40) ? 'nowrap' : wrap + ':' + stack.scrollHeight;
});
out.push((daWrap === 'nowrap' ? '✅' : '❌') + ' 数据审核退回标签与编号同一行 ' + daWrap);

await p.goto(BASE + '/report-issue.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
const beforeIssue = await p.locator('#flow-root tbody tr').count();
await p.locator('tr', { hasText: 'SC2026/0447' }).locator('[data-open]').click();
await p.waitForTimeout(150);
out.push(((await p.locator('#flow-modal tbody tr input[disabled]').count()) >= 1 ? '✅' : '❌') + ' 已发放行勾选框禁用');
out.push(((await p.locator('#flow-modal tbody td').filter({ hasText: /^已发放$/ }).count()) === 0 ? '✅' : '❌') + ' 已发放文字已去掉');
const issuedOp = ((await p.locator('#flow-modal tbody tr').filter({ has: p.locator('input[disabled]') }).first().locator('td').last().textContent()) || '').trim();
const unissuedOp = ((await p.locator('#flow-modal tbody tr').filter({ has: p.locator('.rep-check') }).first().locator('td').last().textContent()) || '').trim();
out.push((/查看发放记录/.test(issuedOp) && !/预览/.test(issuedOp) ? '✅' : '❌') + ' 已发放显示查看发放记录');
out.push((unissuedOp === '' && !/预览/.test(unissuedOp) && !/查看/.test(unissuedOp) ? '✅' : '❌') + ' 未发放不展示查看按钮');
await p.locator('#flow-modal [data-view-ship]').first().click();
await p.waitForTimeout(150);
const shipLayerTxt = (await p.locator('#flow-ship-layer').textContent()) || '';
out.push((await p.locator('#flow-ship-layer').isVisible() && /报告发放记录/.test(shipLayerTxt) && /SF456781111/.test(shipLayerTxt) ? '✅' : '❌') + ' 查看发放记录弹出独立弹窗');
out.push((/填写发放信息/.test(await p.locator('#flow-modal').textContent() || '') && await p.locator('#flow-modal [data-annotate="flow-issue-addr"]').isVisible() ? '✅' : '❌') + ' 发放记录弹窗不替代填写发放信息');
await p.locator('#flow-ship-layer [data-ship-close]').first().click();
await p.waitForTimeout(80);
await p.locator('#flow-modal-x').click();
await p.waitForTimeout(80);
await p.locator('tr', { hasText: 'SC2026/0166' }).locator('[data-open]').click();
await p.waitForTimeout(150);
const checks = p.locator('#flow-modal .rep-check');
if (await checks.count() >= 2) {
  await checks.nth(1).uncheck();
  await p.locator('#flow-modal [data-modal-pass]').click();
  await p.waitForTimeout(250);
}
const afterIssue = await p.locator('#flow-root tbody tr').count();
out.push((afterIssue >= beforeIssue ? '✅' : '❌') + ' 分批发后任务仍留在发放名单 ' + beforeIssue + '→' + afterIssue);

await p.goto(BASE + '/entrust-register.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
if (await p.locator('[data-ret-detail]').count()) {
  await p.locator('[data-ret-detail]').first().click();
  await p.waitForTimeout(150);
  const retHtml = (await p.locator('#ret-modal').innerHTML()) || '';
  out.push((/退回详情/.test(retHtml) && !/退回至 /.test(retHtml) && !/新到旧/.test(retHtml) ? '✅' : '❌') + ' 退回弹窗去掉退回至与新到旧');
  out.push((/来源 /.test(retHtml) ? '✅' : '❌') + ' 退回弹窗仍显示来源');
} else {
  out.push('❌ 委托登记没有退回详情入口');
}

await p.goto(BASE + '/test-distribute.html', { waitUntil: 'load' });
await p.waitForTimeout(220);
const distRow = p.locator('tr', { hasText: 'SC2026/0085' });
if (await distRow.count() && await distRow.locator('[data-ret-detail]').count()) {
  await distRow.locator('[data-ret-detail]').first().click();
  await p.waitForTimeout(150);
  const distHtml = (await p.locator('#ret-modal').innerHTML()) || '';
  const distTxt = (await p.locator('#ret-modal').textContent()) || '';
  const nodes = await p.locator('#ret-modal .ret-timeline > li').count();
  out.push((nodes >= 2 && /潘哲宁/.test(distTxt) && /李四/.test(distTxt) ? '✅' : '❌') + ' 试样分发 testers 各占一个时间轴节点');
  out.push((!/<table[\s\S]*检测员[\s\S]*退回时间/.test(distHtml) ? '✅' : '❌') + ' 试样分发退回详情不用检测员表格');
  await p.screenshot({ path: SHOT_DIR + '/distribute-return-nodes.png' });
} else {
  out.push('❌ 试样分发 SC2026/0085 没有退回详情入口');
}

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
