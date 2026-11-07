import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
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
T('表数量', await p.locator('.dtable').count(), 4);
const titles=(await p.locator('.dtable>header b').allInnerTexts()).join('|');
T('表标题', titles, '委托任务|样品流转|试验项目|调度任务');
out.push(((await p.locator('#tables').innerText()).includes('报告')?'❌':'✅')+' 报告份数已不再出现');
const t1=(await p.locator('.dtable').nth(0).innerText()).replace(/\s+/g,' ');
out.push((/委托任务总数\s*14/.test(t1)&&/电力电缆类\s*9\s*64%/.test(t1)&&/安全工器具类\s*5\s*36%/.test(t1)?'✅':'❌')+' 委托表含分类与占比: '+t1);
const t2=(await p.locator('.dtable').nth(1).innerText()).replace(/\s+/g,' ');
out.push((/已收样\s*23/.test(t2)&&/正在检测\s*12\s*52%/.test(t2)&&/已完成\s*9\s*39%/.test(t2)&&!/样品总数/.test(t2)?'✅':'❌')+' 样品表三维度（不再有总数行）: '+t2);
const t3=(await p.locator('.dtable').nth(2).innerText()).replace(/\s+/g,' ');
out.push((/正在检测\s*12/.test(t3)&&/待检测\s*9/.test(t3)&&/已完成检测\s*16/.test(t3)&&/逾期(?:LIMS)?\s*2/.test(t3)&&/临期\(3天内\)(?:LIMS)?\s*3/.test(t3)?'✅':'❌')+' 试验项目表含逾期/临期标注: '+t3);
const t4=(await p.locator('.dtable').nth(3).innerText()).replace(/\s+/g,' ');
out.push((/已完成\s*88/.test(t4)&&/阻塞\s*8/.test(t4)&&/其中已解决\s*5/.test(t4)&&/其中未解决\s*3/.test(t4)?'✅':'❌')+' 调度表含阻塞拆分: '+t4);
// 每表都有来源与更新时间
const gsrc=(await p.locator('.dtable>header .src').allInnerTexts()).filter(Boolean);
const psrc=(await p.locator('#rpSrc').innerText()).replace(/\s+/g,' ');
out.push((gsrc.length===4&&gsrc.every(x=>/数采|调度/.test(x))&&/\d{2}:\d{2}:\d{2}/.test(psrc)?'✅':'❌')+' 来源在每组、更新时间在面板头（合并面板后时间戳不再重复四遍，诚实口径不丢）: 组='+gsrc.join('/')+' 头='+psrc);
// 周期切换联动四表
await p.locator('[data-period=month]:visible').first().click();  /* 周期按钮同屏可能有左右两组，只点可见那份 */ await p.waitForTimeout(800);
const m=(await p.locator('#tables').innerText()).replace(/\s+/g,' ');
out.push((/委托任务总数\s*268/.test(m)&&/电力电缆类\s*171/.test(m)&&/已收样\s*511/.test(m)&&/试验项目合计\s*842/.test(m)&&/调度任务已完成\s*2011/.test(m)?'✅':'❌')+' 本月切换四表联动: '+m.slice(0,60));
await p.locator('[data-period=day]:visible').first().click();  /* 周期按钮同屏可能有左右两组，只点可见那份 */ await p.waitForTimeout(600);
// 自洽：分类相加=总数、检测+完成≤收样、检测+待检+完成=合计
const calc=await p.evaluate(()=>{const t=document.querySelectorAll('.dtable');
 const g=(el,i)=>+t[el].querySelectorAll('tbody tr')[i].querySelector('.v').textContent;
 return {e:[g(0,0),g(0,1)+g(0,2)], s:[g(1,0),g(1,1)+g(1,2)], i:[g(2,0),g(2,1)+g(2,2)+g(2,3)], d:[g(3,1),g(3,2)+g(3,3)]};});
out.push((calc.e[0]===calc.e[1]&&calc.s[1]<=calc.s[0]&&calc.i[0]===calc.i[1]&&calc.d[0]===calc.d[1]?'✅':'❌')+' 数字自洽（分类和=总数、检测+完成≤收样、三项和=合计、拆分和=阻塞）: '+JSON.stringify(calc));
await p.screenshot({path:'/tmp/twin-qa/kpi-tables.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,6).join('\n'));
await b.close();
