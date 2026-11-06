import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,160));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
const geo=await p.evaluate(()=>{
  const s=document.getElementById('alarmStream').getBoundingClientRect(), r=document.querySelector('.rail').getBoundingClientRect();
  const secs=[...document.querySelectorAll('.asec>header')].map(h=>{const q=h.getBoundingClientRect();return {x:Math.round(q.x),inStream:q.x>=s.x-1&&q.right<=s.right+1, inRail:q.x<=r.right};});
  return {secs, toggles:document.querySelectorAll('.asec [data-alarmfilter]').length,
    allInStream:secs.every(x=>x.inStream), noneInRail:secs.every(x=>!x.inRail)};
});
out.push((geo.allInStream&&geo.noneInRail?'✅':'❌')+' 三分区的标题/计数/筛选都在右侧告警流内、不在左栏: '+JSON.stringify(geo.secs));
out.push((geo.toggles===6?'✅':'❌')+' 每个分区各有一组「只看未解除/全部」（3×2=6）: '+geo.toggles);
out.push(((await p.locator('.rail .alarm-sum, .rail .filter').count())===0?'✅':'❌')+' 左栏已无告警汇总与筛选控件');
const cnt=async sec=>await p.locator(`.asec[data-sec=${sec}] .st-row`).count();
const A0=await cnt('A'), B0=await cnt('B');
await p.click('.asec[data-sec=B] [data-alarmfilter=all]'); await p.waitForTimeout(900);
const A1=await cnt('A'), B1=await cnt('B');
out.push((B1>B0&&A1===A0?'✅':'❌')+` 只影响本分区：B ${B0}→${B1}，A ${A0}→${A1}`);
out.push(((await p.locator('.asec[data-sec=A] [data-alarmfilter=open]').evaluate(e=>e.classList.contains('active')))?'✅':'❌')+' A 区筛选态未被改动');
out.push(((await p.evaluate(()=>document.getElementById('freshTxt').textContent))===''?'✅':'❌')+' 装载链无被吞异常');
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,4).join('\n'));
await b.close();
