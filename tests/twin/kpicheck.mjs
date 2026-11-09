import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,160));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
// 图1 的东西是否已去除
T('数据源胶囊已删', await p.locator('.src-chips').count(), 0);
T('draw calls 读数已删', await p.locator('.perf').count(), 0);
T('风格预览链接已删', await p.locator('.back').count(), 0);
T('数据源行已隐藏', await p.locator('.fresh').count(), 0);
// 时钟
const c1=await p.locator('#clock').innerText(); await p.waitForTimeout(2100); const c2=await p.locator('#clock').innerText();
out.push(((/\d{4}-\d{2}-\d{2}/.test(c1)&&/\d{2}:\d{2}:\d{2}/.test(c1)&&/周[日一二三四五六]/.test(c1)&&c1!==c2)?'✅':'❌')+` 右上角时钟在走且含年月日+星期: ${c1} → ${c2}`);
out.push(((await p.evaluate(()=>{const r=document.querySelector('.clock').getBoundingClientRect();const b=document.querySelector('.topbar').getBoundingClientRect();return r.right<=b.right&&r.left>b.width*0.6;}))?'✅':'❌')+' 时钟位于顶栏右侧');
// 四张表
/* 左栏三组（FR-73 撤掉调度任务子区域） */
T('表数量', await p.locator('.dtable').count(), 3);
const titles=(await p.locator('.dtable>header b').allInnerTexts()).join('|');
/* 「调度任务」子区域按 2026-11-08 圈图从左栏撤掉：同一批数在底栏三列与 106 区域面板里都在，
   左栏不该把一屏当两屏用。数据与接口都不动，所以这里只验"左栏只剩三组"。 */
T('表标题（左栏三组，调度任务已移出左栏）', titles, '委托任务|样品流转|试验项目');
T('左栏不再出现「调度任务」子区域', await p.evaluate(()=>[...document.querySelectorAll('#tables .dtable')].some(e=>e.innerText.includes('调度任务'))), 'false');
out.push(((await p.locator('#tables').innerText()).includes('报告')?'❌':'✅')+' 报告份数已不再出现');
const t1=(await p.locator('.dtable').nth(0).innerText()).replace(/\s+/g,' ');
out.push((/委托任务\s*总数\s*14/.test(t1)&&/电力电缆类\s*9\s*64%/.test(t1)&&/安全工器具类\s*5\s*36%/.test(t1)?'✅':'❌')+' 委托组含限定词、分类与占比: '+t1);
const t2=(await p.locator('.dtable').nth(1).innerText()).replace(/\s+/g,' ');
out.push((/已收样\s*23/.test(t2)&&/正在检测\s*12\s*52%/.test(t2)&&/已完成\s*9\s*39%/.test(t2)&&!/样品总数/.test(t2)?'✅':'❌')+' 样品表三维度（不再有总数行）: '+t2);
const t3=(await p.locator('.dtable').nth(2).innerText()).replace(/\s+/g,' ');
out.push((/正在检测\s*12/.test(t3)&&/待检测\s*9/.test(t3)&&/已完成检测\s*16/.test(t3)&&/逾期\s*(?:LIMS)?\s*2/.test(t3)&&/临期\(3天内\)\s*(?:LIMS)?\s*3/.test(t3)?'✅':'❌')+' 试验项目组含逾期/临期标注: '+t3);
/* 「调度任务」子区域按 2026-11-08 圈图移出左栏（FR-73），所以这里不再读第 4 组，
   而是钉两件事：① 左栏确实没有它；② 它的数没有丢——106 区域面板的「任务统计」四格仍在，
   且「88 已完成」必须带限定词（88 不是调度任务总数，裸放会被读成总数）。 */
const t4=await p.evaluate(()=>[...document.querySelectorAll('#tables .dtable')].map(e=>e.innerText.replace(/\s+/g,' ')).join(' | '));
out.push((!/调度任务/.test(t4)?'✅':'❌')+' 左栏已无「调度任务」子区域（三组收尾）: '+t4.slice(-56));
await gotoZone(p,'106'); await p.waitForTimeout(2600);
const zt=(await p.locator('#zsGrid').innerText()).replace(/\s+/g,' ');   /* ①（2026-11-09）：四格升级为三子区域 */
out.push((/委托任务/.test(zt)&&/样品/.test(zt)&&/试验项目/.test(zt)?'✅':'❌')+' 106 左栏统计＝三子区域（旧「已完成/执行中/异常挂起/排队」四格按①口径退役，委托/样品/试验项目接棒）: '+zt.slice(0,80));
const dq=await p.evaluate(()=>[...document.querySelectorAll('.dq3 .dq-col')].map(c=>({h:c.querySelector('h4').innerText.replace(/\s+/g,' ').trim(),n:c.querySelectorAll('.dq-row').length})));
out.push((dq.length===3&&dq.every(c=>c.n>0&&/\d+/.test(c.h))?'✅':'❌')+' 调度数没丢：底栏调度队列三列各带计数（执行中/未派单/已完成由队列块继续承载）—— '+JSON.stringify(dq.map(c=>c.h+'×'+c.n)));
await p.keyboard.press('1'); await p.waitForTimeout(2400);
/* 来源词与更新时间从屏上撤除（2026-11-07 圈图），但口径不许跟着丢：
   每组与面板头都必须在 aria-label 里带「来源 + 更新时间」，读屏与二期接口核对仍拿得到。 */
const srcOnScreen=await p.evaluate(()=>({
  tableSrc:document.querySelectorAll('.dtable>header .src').length,
  rpSrc:(document.getElementById('rpSrc')||{}).textContent||'',
  rpAria:(document.getElementById('rpSrc')||{}).getAttribute('aria-label')||'',
  tableAria:[...document.querySelectorAll('.dtable')].map(e=>e.getAttribute('aria-label')||'')}));
const clean=srcOnScreen.tableSrc===0&&!/数采|调度|\d{2}:\d{2}:\d{2}/.test(srcOnScreen.rpSrc)&&srcOnScreen.tableAria.length===3
  &&srcOnScreen.tableAria.every(a=>/来源 /.test(a)&&/更新 \d{2}:\d{2}:\d{2}/.test(a))
  &&/来源 /.test(srcOnScreen.rpAria)&&/更新 \d{2}:\d{2}:\d{2}/.test(srcOnScreen.rpAria);
out.push((clean?'✅':'❌')+` 屏上无来源词/时间戳，口径全部转 aria-label（撤字不许撤口径）: 屏上rpSrc="${srcOnScreen.rpSrc}" 表头src元素=${srcOnScreen.tableSrc} aria样例="${(srcOnScreen.tableAria[0]||'').slice(0,44)}"`);
// 周期切换联动四表
await p.locator('[data-period=month]:visible').first().click();  /* 周期按钮同屏可能有左右两组，只点可见那份 */ await p.waitForTimeout(800);
const m=(await p.locator('#tables').innerText()).replace(/\s+/g,' ');
/* 本月联动：左栏三组都要跟着周期变；调度任务的周期数改在底栏与 106 面板看（FR-73） */
out.push((/委托任务\s*总数\s*268/.test(m)&&/电力电缆类\s*171/.test(m)&&/已收样\s*511/.test(m)&&/试验项目\s*合计\s*842/.test(m)&&!/调度任务/.test(m)?'✅':'❌')+' 本月切换三组联动（调度组已移出左栏）: '+m.slice(0,72));
await p.locator('[data-period=day]:visible').first().click();  /* 周期按钮同屏可能有左右两组，只点可见那份 */ await p.waitForTimeout(600);
// 自洽：分类相加=总数、检测+完成≤收样、检测+待检+完成=合计
/* 新 DOM（FR-41 压缩版）：大数在 .dt-v，分解值按顺序在 .dt-detail .v */
const calc=await p.evaluate(()=>{const t=document.querySelectorAll('.dtable');
 const vs=i=>[+t[i].querySelector('.dt-v').textContent,...[...t[i].querySelectorAll('.dt-detail .v')].map(e=>+e.textContent)];
 /* 只剩三组：调度任务子区域按 FR-73 移出左栏。
   原来这里读 vs(3)（第 4 组），组数变 3 之后 t[3] 是 undefined，整套直接崩在这行——
   阻塞拆分（已解决+未解决=阻塞）的自洽改到 106 面板那侧验。 */
 const e=vs(0),s=vs(1),ii=vs(2);
 return {e:[e[0],e[1]+e[2]], s:[s[0],s[1]+s[2]], i:[ii[0],ii[1]+ii[2]+ii[3]]};});
out.push((calc.e[0]===calc.e[1]&&calc.s[1]<=calc.s[0]&&calc.i[0]===calc.i[1]?'✅':'❌')+' 数字自洽（分类和=总数、检测+完成≤收样、三项和=合计）: '+JSON.stringify(calc));
await p.screenshot({path:'/tmp/twin-qa/kpi-tables.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,6).join('\n'));
await b.close();
