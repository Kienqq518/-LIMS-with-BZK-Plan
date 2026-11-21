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
out.push((/合同编号/.test(signHead) && /客户单位/.test(signHead) && /样品名称/.test(signHead) && /报告记录/.test(signHead) && !/要求完成日期/.test(signHead.replace('客户要求完成日期', '')) ? '✅' : '❌') + ' 名单列与审核对齐');
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
out.push((/签发通过/.test(await p.locator('body').textContent()) && /原始记录表/.test(await p.locator('body').textContent()) ? '✅' : '❌') + ' 签发编辑含报告文件与原始记录');
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
out.push((/任务归档/.test(await p.locator('#flow-root thead').textContent()) ? '✅' : '❌') + ' 归档名单含任务归档列');
await p.locator('#flow-root a[data-record]').filter({ hasText: '查看' }).first().click();
await p.waitForTimeout(280);
out.push((await p.locator('#flowRecordDrawer').evaluate((el) => el && el.classList.contains('open')) ? '✅' : '❌') + ' 归档查看打开报告记录抽屉');
await p.locator('#flowRecordClose').click();
await p.waitForTimeout(200);

await p.goto(BASE + '/task-complete.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
const viewN = await p.locator('#flow-root a[data-record]').filter({ hasText: '查看' }).count();
out.push((viewN >= 1 ? '✅' : '❌') + ' 任务完成只读查看');
await p.locator('#flow-root a[data-record]').filter({ hasText: '查看' }).first().click();
await p.waitForTimeout(280);
out.push((await p.locator('#flowRecordDrawer').evaluate((el) => el && el.classList.contains('open')) ? '✅' : '❌') + ' 完成查看打开报告记录抽屉');
await p.locator('#flowRecordClose').click();
await p.waitForTimeout(200);

await p.goto(BASE + '/original-record-list.html', { waitUntil: 'load' });
await p.waitForTimeout(200);
out.push(((await p.locator('#body tr').count()) >= 1 ? '✅' : '❌') + ' 检测管理原始记录名单');

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
out.push((/样品及对应检测信息/.test(await p.locator('body').textContent()) ? '✅' : '❌') + ' 签发编辑含样品信息');
await p.screenshot({ path: SHOT_DIR + '/flow-sign-edit.png', fullPage: true });
await p.goto(BASE + '/report-issue.html', { waitUntil: 'load' });
await p.waitForTimeout(180);
await p.locator('[data-open]').first().click();
await p.waitForTimeout(150);
await p.screenshot({ path: SHOT_DIR + '/flow-issue-modal.png' });

console.log(out.join('\n'));
console.log('errors(' + err.length + '):\n' + err.slice(0, 5).join('\n'));
await b.close();
process.exit(out.some((l) => l.startsWith('❌')) ? 1 : 0);
