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
  tags:[...t.querySelectorAll('.limstag')].length, tips:[...t.querySelectorAll('tr[title]')].map(r=>r.getAttribute('title').slice(0,60))};});
out.push(((/逾期(?:LIMS)? 2/.test(ui.txt)&&/临期\(3天内\)(?:LIMS)? 3/.test(ui.txt))?'✅':'❌')+' 屏上数值正确: '+ui.txt.slice(0,110));
out.push((ui.tags===2?'✅':'❌')+` LIMS 角标数量=${ui.tags}（逾期/临期两行各一个）`);
out.push((ui.tips.length===2&&/SPL-2611/.test(ui.tips[0])&&/要求 /.test(ui.tips[0])?'✅':'❌')+' 明细 title 可追到具体项目: '+String(ui.tips[0]).slice(0,70));
// 周期切换：逾期/临期保持现在时口径
await p.click('[data-period=year]'); await p.waitForTimeout(700);
const y=await p.evaluate(()=>[...document.querySelectorAll('.dtable')][2].innerText.replace(/\s+/g,' '));
out.push(((/逾期(?:LIMS)? 2/.test(y)&&/临期\(3天内\)(?:LIMS)? 3/.test(y)&&/8890/.test(y))?'✅':'❌')+' 切本年：合计随周期(8890)、逾期/临期保持现在时: '+y.slice(0,80));
// 自洽：在测+待检+完成=合计
const calc=await p.evaluate(()=>{const t=[...document.querySelectorAll('.dtable')][2];const v=[...t.querySelectorAll('tbody tr .v')].map(x=>+x.textContent);return v;});
out.push((calc[0]===calc[1]+calc[2]+calc[3]?'✅':'❌')+` 三项相加=合计: ${calc.join('/')}`);
await p.screenshot({path:'/tmp/twin-qa/plan-lims.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
