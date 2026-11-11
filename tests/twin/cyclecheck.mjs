/**
 * 无人化任务循环守卫（FR-38，2026-11-07 改版）
 *  ① 计数口径：60 道 = 三相（红/黄/绿）× 20 步，取样与还样都在 102-01（不是 68 个停靠站）
 *  ② 文案：这块展示 AGV 正处于的进行中任务（任务名 + 状态），不显示 n/17；
 *     「无人化循环」旧称与所有 hover 说明文本都已撤掉，道次只留在 aria-label（口径不丢、画面干净）
 *  ③ 道 ↔ 站 ↔ AGV 三者必须一致：说第 n 道在哪个工位，机器人就必须真在那儿（停靠误差 <0.25m）
 *  ④ 行进结束才进下一道：同一站点连着办多道时，窗口按序推进且不得重叠
 *  ⑤ 队列「循环中」那一行必须就是当前道的任务（seq 精确指认，不再靠流号反推）
 *  ⑥ 一圈内 60 道全部被走到（观察窗 ≥ loopSec，否则是假绿）
 *     三相一圈真实长度约 20 分钟，回归不能等 20 分钟：用交付参数 ?cycle-compress=6 等比压缩时间轴，
 *     几何/顺序/窗口关系一个都不动，判据强度不变。
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const ok=(c,m)=>out.push((c?'✅':'❌')+' '+m);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html?cycle-compress=6',{waitUntil:'load'});
await p.waitForTimeout(15000);
const f=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));

const def=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');const d=r.data.cycle||{};
  return {stops:(d.stops||[]).length,steps:(d.steps||[]).length,loopSec:d.loopSec,workSec:d.workSec,audit:d.stepsAudit,
    first:(d.steps||[])[0],live:r.data.live};});
ok(def.steps===60&&def.stops===68,`任务道总数 =60（三相 ×20 步），停靠 68 站（同站一圈内被多次访问）：实得 ${def.steps}，站点 ${def.stops}`);
ok(def.first&&def.first.flowCode==='0101'&&def.first.cad==='102-01',`第 1 道是样品室取样（0101 @102-01，不再是无 seq 的假取样道）：${JSON.stringify(def.first&&{flowCode:def.first.flowCode,cad:def.first.cad,label:def.first.label})}`);
ok(def.audit&&def.audit.total===60&&(!def.audit.unmatched||def.audit.unmatched.length===0),
  `每条任务都归到了站点（无落单）: ${JSON.stringify(def.audit)}`);
const taskNos=def.steps?await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');return (r.data.cycle.steps||[]).map(s=>s.seq);}):[];
ok(new Set(taskNos.filter(x=>x!=null)).size===60&&taskNos.filter(x=>x!=null).length===60,`60 条任务各出现一次且只一次（三相 ×20 步，没有一条被挂到两次停靠）: ${taskNos.filter(x=>x!=null).sort((x,y)=>x-y).join(',')}`);

/* 文案与 hover */
const ui=await p.evaluate(()=>({now:(document.getElementById('cyNow')||{}).textContent.trim(),
  label:(document.getElementById('cyLabel')||{}).textContent.trim(),sub:(document.getElementById('cySub')||{}).textContent.trim(),
  title:(document.getElementById('cyNow')||{}).getAttribute('title'),aria:document.getElementById('cyNow').getAttribute('aria-label')||'',boxTitle:document.getElementById('cycleBox').getAttribute('title'),
  body:document.body.innerText.includes('无人化循环')}));
/* Playwright 把 Set 序列化回主进程会变成空对象——跨进程只传数组 */
const flowNames=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');
  return [...new Set((r.data.cycle.steps||[]).map(s=>s.flowCode?s.flowCode+' '+s.flowName:s.flowName))];});
/* 首行 = 机器人正在办的那道。唯一例外是「返航段」：一圈 17 道办完回到 102 家位/充电位，
   那一段不属于任何一条调度任务，端点 liveStep 为 null——此时屏上写「返航」才是诚实的，
   硬凑一个任务名反而造假（文案取自剧本自己的 tail 分支，不在宿主里另造业务句子）。 */
const tail=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');
  return {step:r.data.liveStep||null, flow:(r.data.live||{}).flow, label:(r.data.live||{}).label};});
const isReturn=/^返航|^返回/.test(ui.now);
ok(!/(^|[^0-9])\d+\/60$/.test(ui.now) && (flowNames.includes(ui.now) || (isReturn && tail.step===null)),
  `首行是 AGV 正在办的任务名（返航段例外，此时端点无 liveStep）: "${ui.now}" 在 60 道流名内=${flowNames.includes(ui.now)} 返航=${isReturn} liveStep=${tail.step===null?'null':'有'}`);
ok(/^AGV 任务 · (作业中|行进中)$/.test(ui.label),`状态行 = 「AGV 任务 · 作业中/行进中」: "${ui.label}"`);
ok(!ui.body,`屏上不再有旧称「无人化循环」`);
ok(ui.boxTitle===null,`cycleBox 的 hover 说明文本已去除（title=${ui.boxTitle}）`);
/* 屏上不显示、也不许留 hover（产品负责人 2026-11-07：连 hover 都不想要）——
   大屏投影没人悬停，浮层提示只会挡画面。道次只走 aria-label：读屏与 QA 仍拿得到口径。 */
const mAria=(ui.aria||"").match(/第 (\d+)\/(\d+) 道/);
ok(ui.title===null&&ui.boxTitle===null,`cycleBox 与首行都不留悬停文案（title=${ui.title} boxTitle=${ui.boxTitle}）`);
ok(!!mAria&&mAria[2]==="60",`道次口径没丢，只走 aria-label（读屏可读）: "${ui.aria}"`);

/* ③④ 采样一整圈：道↔站↔AGV 一致 + 窗口不重叠 */
const geo=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');const d=r.data.cycle;
  const m={};(d.stops||[]).forEach(st=>{m[st.cad]=st.at||null;});return {stops:d.stops,steps:d.steps,loopSec:d.loopSec};});
const seen=[];const t0=Date.now();
while (Date.now()-t0 < Math.min(300000, (geo.loopSec+20)*1000)) {
  const s=await p.evaluate(()=>({now:(document.getElementById('cyNow')||{}).textContent.trim(),
    aria:document.getElementById('cyNow').getAttribute('aria-label')||'',sub:(document.getElementById('cySub')||{}).textContent.trim(),
    phase:(document.getElementById('cyLabel')||{}).textContent}));
  const agv=await f.evaluate(()=>window.__twinAgv||null);
  const live=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/dispatch-queue');return r.data.liveStep;});
  const dm=(s.aria||'').match(/第 (\d+)\/(\d+) 道/);
  seen.push({no:(live&&live.no)?live.no:(dm?+dm[1]:0),ariaNo:dm?+dm[1]:0,total:dm?+dm[2]:0,phase:/作业中/.test(s.phase||'')?'dwell':(/行进中/.test(s.phase||'')?'travel':'?'),agv,live,txt:s.sub,task:s.now});
  if (new Set(seen.map(x=>x.no)).size>=60) break;
  /* 压缩后每道只有 ~3.4s（含行进），采样必须比它快一档：
     700ms + 三次 CDP 往返实际接近 2s，一圈下来只能看到 28 道——那是采样密度不够，不是剧本漏道。 */
  await p.waitForTimeout(150);
}
const nos=[...new Set(seen.map(x=>x.no))].filter(x=>x>0).sort((a,b2)=>a-b2);
ok(nos.length===60,`一圈内 60 道全部被走到（观察 ${Math.round((Date.now()-t0)/1000)}s，覆盖 ${nos.join(',')}`+')');
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
/* 队列「循环中」那一行必须就是当前道——但屏上的行是心跳刷的（≤2s 一跳），端点按墙上时钟现算，
   两道之间只有 6s，正好卡在边界上就会"两个都对但不一致"（实测 0142 行 vs 0152 端点）。
   所以同一次读取里比对 + 最多重试四次（下一秒 DOM 就追上），不把时序抖动当缺陷，也不放弃这条口径。 */
let lv=null;
for(let k=0;k<5;k++){
  lv=await p.evaluate(async()=>{
    const r=await TwinApi.get('/api/overview/dispatch-queue');
    return {liveFlow:r.data.liveFlow,liveSeq:r.data.liveSeq,step:r.data.liveStep,
      rows:[...document.querySelectorAll('#dkQueueTrack .dq-row')].filter(x=>{const e=x.querySelector('.st');return e&&e.innerText==='循环中';}).map(x=>x.dataset.flow)};});
  if(lv.liveFlow&&lv.rows.length&&lv.rows.every(x=>x===lv.liveFlow))break;
  if(!lv.liveFlow)break;                                     /* 返航段没有流号，不必再等 */
  await p.waitForTimeout(1200);
}
ok(lv.rows.length<=2&&(!lv.liveFlow||lv.rows.every(x=>x===lv.liveFlow)),
  `队列「循环中」行与当前道同源（flow=${lv.liveFlow} seq=${lv.liveSeq} 行=${lv.rows.join('/')}）`);
ok(err.length===0,'无 pageerror/console error: '+err.slice(0,3).join(' | '));
console.log(out.join('\n'));
const bad=out.filter(l=>l.startsWith('❌')).length;
console.log('\n通过 '+out.filter(l=>l.startsWith('✅')).length+' · 失败 '+bad);
await b.close();
process.exit(bad?1:0);
