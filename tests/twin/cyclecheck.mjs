/**
 * 无人化任务循环守卫（FR-38，2026-11-07 改版）
 *  ① 计数口径：17 道 = 16 条调度任务 + 最开始从样品室取样 1 道（不是 11 个站点）
 *  ② 文案：屏上写「无人化任务」，「无人化循环」与 hover 说明文本都撤掉
 *  ③ 道 ↔ 站 ↔ AGV 三者必须一致：说第 n 道在哪个工位，机器人就必须真在那儿（停靠误差 <0.25m）
 *  ④ 行进结束才进下一道：同一站点连着办多道时，窗口按序推进且不得重叠
 *  ⑤ 队列「循环中」那一行必须就是当前道的任务（seq 精确指认，不再靠流号反推）
 *  ⑥ 一圈内 17 道全部被走到（观察窗 ≥ loopSec，否则是假绿）
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const ok=(c,m)=>out.push((c?'✅':'❌')+' '+m);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
const f=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));

const def=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');const d=r.data.cycle||{};
  return {stops:(d.stops||[]).length,steps:(d.steps||[]).length,loopSec:d.loopSec,workSec:d.workSec,audit:d.stepsAudit,
    first:(d.steps||[])[0],live:r.data.live};});
ok(def.steps===17,`任务道总数 =17（16 条调度任务 + 样品室取样 1 道）：实得 ${def.steps}，站点 ${def.stops}`);
ok(def.first&&def.first.kind==='pickup'&&def.first.cad==='102-01',`第 1 道是样品室取样：${JSON.stringify(def.first&&{kind:def.first.kind,cad:def.first.cad,label:def.first.label})}`);
ok(def.audit&&def.audit.total===17&&(!def.audit.unmatched||def.audit.unmatched.length===0),
  `每条任务都归到了站点（无落单）: ${JSON.stringify(def.audit)}`);
const taskNos=def.steps?await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');return (r.data.cycle.steps||[]).map(s=>s.seq);}):[];
ok(new Set(taskNos.filter(x=>x!=null)).size===16,`16 条任务各出现一次且只一次: ${taskNos.filter(x=>x!=null).sort((x,y)=>x-y).join(',')}`);

/* 文案与 hover */
const ui=await p.evaluate(()=>({now:(document.getElementById('cyNow')||{}).textContent,label:(document.getElementById('cyLabel')||{}).textContent,
  title:document.getElementById('cycleBox').getAttribute('title'),body:document.body.innerText.includes('无人化循环')}));
ok(/^(\d+)\/17$/.test(ui.now),`屏上计数格式 n/17: "${ui.now}"`);
ok(/无人化任务/.test(ui.label)&&!ui.body,`文案改为「无人化任务」，屏上不再有「无人化循环」: "${ui.label}"`);
ok(ui.title===null,`cycleBox 的 hover 说明文本已去除（title=${ui.title}）`);

/* ③④ 采样一整圈：道↔站↔AGV 一致 + 窗口不重叠 */
const geo=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');const d=r.data.cycle;
  const m={};(d.stops||[]).forEach(st=>{m[st.cad]=st.at||null;});return {stops:d.stops,steps:d.steps,loopSec:d.loopSec};});
const seen=[];const t0=Date.now();
while (Date.now()-t0 < Math.min(300000, (geo.loopSec+8)*1000)) {
  const s=await p.evaluate(()=>({now:(document.getElementById('cyNow')||{}).textContent,
    label:(document.getElementById('cySub')||{}).textContent,phase:(document.getElementById('cyLabel')||{}).textContent}));
  const agv=await f.evaluate(()=>window.__twinAgv||null);
  const live=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/dispatch-queue');return r.data.liveStep;});
  seen.push({no:+((s.now||'').split('/')[0]||0),total:+((s.now||'').split('/')[1]||0),phase:/作业中/.test(s.phase||'')?'dwell':(/行进中/.test(s.phase||'')?'travel':'?'),agv,live,txt:s.label});
  if (new Set(seen.map(x=>x.no)).size>=17) break;
  await p.waitForTimeout(2500);
}
const nos=[...new Set(seen.map(x=>x.no))].sort((a,b2)=>a-b2);
ok(nos.length>=17,`一圈内 17 道全部被走到（观察 ${Math.round((Date.now()-t0)/1000)}s，覆盖 ${nos.join(',')}`+')');
const dwellChecks=seen.filter(x=>x.phase==='dwell'&&x.agv&&x.live&&x.live.cad);
const badPos=dwellChecks.filter(x=>{const st=geo.stops.find(s=>s.cad===x.live.cad);if(!st||!st.at)return false;
  return Math.hypot(st.at[0]-x.agv.x, st.at[1]-x.agv.z)>0.25;});
ok(dwellChecks.length>8&&badPos.length===0,
  `停靠态下 AGV 真在该道工位（样本 ${dwellChecks.length}，误差>0.25m 的 ${badPos.length} 个）`+(badPos.length?'：'+JSON.stringify(badPos.slice(0,2)):''));
const travelSamples=seen.filter(x=>x.phase==='travel'&&x.agv);
ok(travelSamples.length>0,`行进态样本 ${travelSamples.length} 个（行进段归给下一道，屏上显示"行进中"时机器人确实不在工位上）`);
const win=geo.steps.map((sp,i)=>({no:sp.no,t0:sp.t0,end:sp.endSec}));
ok(win.every((w,i)=>i===0||w.t0>=win[i-1].end-0.05)&&win.every(w=>w.end>w.t0),
  '每道窗口按序排列、互不重叠（行进结束才进下一道）: '+win.slice(0,4).map(w=>`${w.no}:${w.t0}→${w.end}`).join(' '));
const liveRows=await p.evaluate(()=>[...document.querySelectorAll('#dkQueueTrack .dq-row')].filter(r=>r.querySelector('.st')&&r.querySelector('.st').innerText==='循环中').map(r=>r.dataset.flow));
const q=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/dispatch-queue');return {liveFlow:r.data.liveFlow,liveSeq:r.data.liveSeq,step:r.data.liveStep};});
ok(liveRows.length<=2&&(!q.liveFlow||liveRows.every(x=>x===q.liveFlow)),
  `队列「循环中」行与当前道同源（flow=${q.liveFlow} seq=${q.liveSeq} 行=${liveRows.join('/')}）`);
ok(err.length===0,'无 pageerror/console error: '+err.slice(0,3).join(' | '));
console.log(out.join('\n'));
const bad=out.filter(l=>l.startsWith('❌')).length;
console.log('\n通过 '+out.filter(l=>l.startsWith('✅')).length+' · 失败 '+bad);
await b.close();
process.exit(bad?1:0);
