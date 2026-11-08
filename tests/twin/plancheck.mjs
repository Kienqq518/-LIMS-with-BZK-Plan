import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,160));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
const api=await p.evaluate(async()=>({ls:(await TwinApi.get('/api/overview/lab-status')).data, plan:(await TwinApi.get('/api/overview/test-item-plan')).data}));
// 独立重算（不复用被测代码）
const it=api.plan.items, un=it.filter(x=>x.status!=='done');
const exp={overdue:un.filter(x=>x.dueInHours<0).length, dueSoon:un.filter(x=>x.dueInHours>=0&&x.dueInHours<=72).length,
  testing:it.filter(x=>x.status==='testing').length, pending:it.filter(x=>x.status==='pending').length, done:it.filter(x=>x.status==='done').length};
const got=api.ls.panels.testItems.periods.day;
out.push((exp.overdue===2&&exp.dueSoon===3?'✅':'❌')+` 清单推导：逾期 ${exp.overdue} 临期 ${exp.dueSoon}（预期 2/3）`);
out.push((got.overdue===exp.overdue&&got.dueSoon===exp.dueSoon&&got.testing===exp.testing&&got.pending===exp.pending&&got.done===exp.done?'✅':'❌')
  +` 接口值与清单一致：接口 逾期${got.overdue}/临期${got.dueSoon}/在测${got.testing}/待检${got.pending}/完成${got.done}`);
const ui=await p.evaluate(()=>{const t=[...document.querySelectorAll('.dtable')][2];return {txt:t.innerText.replace(/\s+/g,' '),
  tags:[...t.querySelectorAll('.limstag')].length,
  /* 明细清单从 title 挪进 aria-label（2026-11-07：连 hover 都不想要），读屏与 QA 仍能追到具体项目。
     截长一点：FR-49 之后 LIMS 口径也并进了同一条 aria-label，排在明细之后。 */
  tips:[...t.querySelectorAll('.dt-i[aria-label]')].map(r=>r.getAttribute('aria-label').slice(0,240)).filter(x=>/要求 /.test(x))};});
/* FR-49（2026-11-08 圈图）：屏上的 LIMS 角标撤除，口径并进 aria-label。
   这两条合起来才是完整口径——「屏上干净」与「口径没丢」必须同时成立，缺一个就是回归。 */
out.push(((/逾期\s*2/.test(ui.txt)&&/临期\(3天内\)\s*3/.test(ui.txt)&&!/LIMS/.test(ui.txt)&&ui.tags===0)?'✅':'❌')
  +' 屏上数值正确且不再出现 LIMS 角标: '+ui.txt.slice(0,110));
out.push((ui.tips.length===2&&/SPL-2611/.test(ui.tips[0])&&ui.tips.every(x=>/LIMS「要求检测完成时间」/.test(x))?'✅':'❌')
  +' 明细与 LIMS 口径都在 aria-label（读屏/QA 可追）: '+String(ui.tips[0]).slice(0,150));
// 周期切换：逾期/临期保持现在时口径
await p.locator('[data-period=year]:visible').first().click();  /* 周期按钮同屏可能有左右两组，只点可见那份 */ await p.waitForTimeout(700);
const y=await p.evaluate(()=>[...document.querySelectorAll('.dtable')][2].innerText.replace(/\s+/g,' '));
/* 本年：合计 9127（=96 在测 + 141 待检 + 8890 完成）随周期变；逾期 2 / 临期 3 是现在时口径，不随周期变 */
out.push(((/逾期\s*2/.test(y)&&/临期\(3天内\)\s*3/.test(y)&&!/LIMS/.test(y)&&/合计\s*9127/.test(y)&&/已完成检测\s*8890/.test(y))?'✅':'❌')+' 切本年：合计随周期(9127=96+141+8890)、逾期/临期保持现在时: '+y.slice(0,96));
// 自洽：在测+待检+完成=合计
const calc=await p.evaluate(()=>{const t=[...document.querySelectorAll('.dtable')][2];
 return [+t.querySelector('.dt-v').textContent, ...[...t.querySelectorAll('.dt-detail .v')].map(x=>+x.textContent)];});
out.push((calc[0]===calc[1]+calc[2]+calc[3]?'✅':'❌')+` 三项相加=合计: ${calc.join('/')}`);
await p.screenshot({path:'/tmp/twin-qa/plan-lims.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
