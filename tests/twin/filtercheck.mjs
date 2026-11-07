/**
 * 告警筛选控件（2026-11-07 改版）：三区各自一套筛选 → 整个列表一个开关，且两处面板同步。
 * 这里守三件事：开关的几何位置没跑出去、两处 active 同步、URL 能恢复。
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push(e.message));
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(14000);
const geo=await p.evaluate(()=>{const s=document.querySelector('.stream').getBoundingClientRect();
  return [...document.querySelectorAll('#alarmStream [data-sfilter]')].map(b=>{const q=b.getBoundingClientRect();
    return {txt:b.innerText,inStream:q.x>=s.x-1&&q.right<=s.right+1&&q.y>=s.y-1&&q.bottom<=s.bottom+1};});});
out.push((geo.length===2&&geo.every(x=>x.inStream)?'✅':'❌')+' 筛选开关只有两个且都在告警流面板内: '+JSON.stringify(geo.map(x=>x.txt)));
const st=await p.evaluate(()=>({open:document.querySelector('#alarmStream [data-sfilter=open]').classList.contains('active'),all:document.querySelector('#alarmStream [data-sfilter=all]').classList.contains('active')}));
out.push((st.all&&!st.open?'✅':'❌')+' 默认态=全部: '+JSON.stringify(st));
await p.click('#alarmStream [data-sfilter=open]'); await p.waitForTimeout(800);
const st2=await p.evaluate(()=>({open:document.querySelector('#alarmStream [data-sfilter=open]').classList.contains('active'),all:document.querySelector('#alarmStream [data-sfilter=all]').classList.contains('active'),rows:document.querySelectorAll('#streamTrack .st-row').length}));
out.push((st2.open&&!st2.all&&st2.rows===18?'✅':'❌')+' 点击后 active 与列表同时变: '+JSON.stringify(st2));
await p.reload({waitUntil:'load'}); await p.waitForTimeout(14000);
const back=await p.evaluate(()=>({sf:new URLSearchParams(location.search).get('sf'),open:document.querySelector('#alarmStream [data-sfilter=open]').classList.contains('active')}));
out.push((back.sf==='open'&&back.open?'✅':'❌')+' 刷新后筛选态从 URL 恢复: '+JSON.stringify(back));
/* 区域视图：面板里的开关与右列同一个状态源 */
await p.click('#alarmStream [data-sfilter=all]'); await p.waitForTimeout(600);
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(4200);
const z=await p.evaluate(()=>({n:document.querySelectorAll('#zpAlarms [data-sfilter]').length,allAct:document.querySelector('#zpAlarms [data-sfilter=all]').classList.contains('active')}));
out.push((z.n===2&&z.allAct?'✅':'❌')+' 区域面板的告警开关与全局同一个状态源: '+JSON.stringify(z));
await p.click('#zpAlarms [data-sfilter=open]'); await p.waitForTimeout(900);
const sync=await p.evaluate(()=>({zrows:document.querySelectorAll('#zpAlarms .zp-row').length,url:new URLSearchParams(location.search).get('sf')}));
out.push((sync.url==='open'?'✅':'❌')+' 面板里切换也写回 URL（两处共用一个开关状态）: '+JSON.stringify(sync));
out.push((err.length===0?'✅':'❌')+' 无 pageerror: '+err.slice(0,2).join(' | '));
console.log(out.join('\n'));
const bad=out.filter(l=>l.startsWith('❌')).length;
console.log('\n通过 '+out.filter(l=>l.startsWith('✅')).length+' · 失败 '+bad);
await b.close();
process.exit(bad?1:0);
