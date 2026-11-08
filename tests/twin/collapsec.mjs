import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(14000);
const vis=async sel=>{ try{ return await p.locator(sel).isVisible(); }catch(e){ return 'ERR'; } };
const cnt=async sel=>p.locator(sel).count();
const snap=async()=>({table:await vis('.dock'),robots:await vis('#robotZone'),wm:await vis('#watermark')});
const a=await snap();
out.push(((await cnt('#robotZone'))===0&&(await cnt('.watermark'))===0?'✅':'❌')+` 机器人状态条与底部说明条已整体删除：#robotZone=${await cnt('#robotZone')} .watermark=${await cnt('.watermark')}`);
out.push((a.table?'✅':'❌')+' 默认（总览）今日任务表在位: '+JSON.stringify(a));
await p.click('#stripBtn'); await p.waitForTimeout(1200);
const c=await snap();
out.push((!c.table?'✅':'❌')+' 点「收起底栏」只收底栏（FR-42 之后是两块：AGV+任务三列、试验项）: '+JSON.stringify(c));
/* FR-42 的连带后果，按实记录：AGV 任务行搬进了底栏，所以收起底栏会把它一起收掉。
   讲的人要"画面干净"就收，要盯 AGV 就别收——一个开关一件事，不再另设第二套状态。 */
out.push(((await p.evaluate(()=>{const e=document.getElementById('cycleBox');return !e||e.closest('.dock')!==null;}))?'✅':'❌')+' AGV 任务行确实在底栏内（收起时一起收，符合 FR-42 重排）');
out.push(((await p.locator('#stripBtn').innerText()).includes('展开')?'✅':'❌')+' 按钮文案切换: '+await p.locator('#stripBtn').innerText());
out.push(((await p.evaluate(()=>location.search.includes('strip=1')))?'✅':'❌')+' 状态进 URL: '+await p.evaluate(()=>location.search));
// 刷新后仍保持收起
await p.reload({waitUntil:'load'}); await p.waitForTimeout(13000);
const d=await snap();
out.push((!d.table?'✅':'❌')+' 刷新后仍是收起态（URL 恢复）: '+JSON.stringify(d));
await p.click('#stripBtn'); await p.waitForTimeout(1200);
const e2=await snap();
out.push((e2.table?'✅':'❌')+' 再点恢复: '+JSON.stringify(e2));
// 区域视图下机器人条本就归面板管
await gotoZone(p, '106'); await p.waitForTimeout(2000);
const f=await snap();
out.push(((await p.locator('#zDevsList [data-robot]').count())>=2?'✅':'❌')+' 区域视图机器人信息在左栏「设备」块内（面板退役后唯一落点）: '+JSON.stringify(f));
await p.screenshot({path:'/tmp/twin-qa/collapse.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
