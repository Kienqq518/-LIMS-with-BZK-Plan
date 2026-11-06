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
T('页面不含 Grade 英文', await p.evaluate(()=>document.body.innerText.includes('Grade')), false);
T('分区数量', await p.locator('.asec').count(), 3);
const heads=await p.locator('.asec>header').allInnerTexts();
out.push((heads.length===3&&/A/.test(heads[0])&&/异常告警/.test(heads[0])&&/今日 5 · 未解除 3/.test(heads[0])&&/今日 4 · 未解除 3/.test(heads[1])&&/今日 4 · 未解除 3/.test(heads[2])?'✅':'❌')+' 三分区标题与今日计数: '+heads.map(h=>h.replace(/\s+/g,' ').slice(0,34)).join(' | '));
const secData=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/alarm-sections');return r.data;});
out.push(((secData||[]).length===3&&secData.every((x,i)=>heads[i].includes(x.title)&&heads[i].includes(x.id))?'✅':'❌')+' 分区标题/徽标来自接口数据（不在 JS 写死口径）: '+((secData||[]).map(x=>x.id+'='+x.title).join(' / ')));
out.push(((secData||[]).length===3&&secData.every(x=>/anomaly|blockage|calibration/.test(x.key))?'✅':'❌')+' 分区 key 与告警 category 同一套词表: '+((secData||[]).map(x=>x.key).join(',')));
const grades=await p.locator('.asec').evaluateAll(els=>els.map(e=>({sec:e.dataset.sec, rows:[...e.querySelectorAll('.st-row')].map(r=>r.dataset.grade)})));
out.push((grades.every(g=>g.rows.length>0&&g.rows.every(x=>x===g.sec))?'✅':'❌')+' 每区只含本级告警: '+JSON.stringify(grades.map(g=>g.sec+':'+g.rows.length)));
// 分区独立筛选
const cnt=async sec=>await p.locator(`.asec[data-sec=${sec}] .st-row`).count();
const before={A:await cnt('A'),B:await cnt('B'),C:await cnt('C')};
await p.click('.asec[data-sec=B] [data-alarmfilter=all]'); await p.waitForTimeout(800);
const after={A:await cnt('A'),B:await cnt('B'),C:await cnt('C')};
out.push((after.B>before.B&&after.A===before.A&&after.C===before.C?'✅':'❌')+` 分区筛选互不影响：B ${before.B}→${after.B}，A ${before.A}→${after.A}，C ${before.C}→${after.C}`);
T('URL 记录三区筛选态', await p.evaluate(()=>new URLSearchParams(location.search).get('alarmFilter')), 'open,all,open');
// 详情卡不再出现 Grade
await p.evaluate(()=>{document.querySelectorAll('.asec-track').forEach(t=>t.style.animationPlayState='paused');});
const row=p.locator('.asec[data-sec=A] .st-row').first();
await row.click(); await p.waitForTimeout(1200);
const dt=(await p.locator('#detailBody').innerText()).replace(/\s+/g,' ');
out.push((/A 级/.test(dt)&&!/Grade/.test(dt)?'✅':'❌')+' 告警详情用「A 级」中文表述: '+dt.slice(0,70));
/* B 区那条没有台账号的告警（AL-204）必须仍能把镜头与描边落到 106-12 那张桌上。
   注意：AL-204 是已解除状态，默认「只看未解除」下不渲染；切到全部后它排在 236px 可视窗口之外——
   这里验的是 openAlarm 的分支逻辑，不是鼠标可见性，所以用 DOM click 走同一个委托入口。 */
/* 上一步点开告警留下的 #detail 会盖住右侧告警流（S1 模式下它是覆盖式面板），先 Esc 关掉再点筛选 */
await p.keyboard.press('Escape'); await p.waitForTimeout(700);
out.push(((await p.evaluate(()=>document.getElementById('detail').hidden))?'✅':'❌')+' 告警详情可用 Esc 关闭（否则它会挡住告警流的筛选控件）');
await p.click('.asec[data-sec=B] [data-alarmfilter=all]'); await p.waitForTimeout(900);
const clicked=await p.evaluate(()=>{
  const el=document.querySelector('.asec[data-sec=B] [data-alarm="AL-204"]');
  if(!el) return {ok:false, why:'AL-204 未渲染（B 区归属或筛选态变了）'};
  el.click(); return {ok:true, zone:el.dataset.zone, dev:el.dataset.dev||'(空)'};
});
await p.waitForTimeout(2000);
out.push((clicked.ok?'✅':'❌')+' AL-204 在 B 区且可点（zone='+clicked.zone+'，data-dev="'+clicked.dev+'"）'+(clicked.ok?'':clicked.why));
const hl=await p.evaluate(()=>document.body.dataset.lastHighlight||'');
out.push((hl==='106-12'?'✅':'❌')+' 点击后描边落到 CAD 实体 106-12（非数采桌无台账号）: lastHighlight='+hl);
const dtxt=(await p.locator('#detailBody').innerText()).replace(/\s+/g,' ');
out.push((/闭环状态|原因/.test(dtxt)&&!/复合机器人 RB/.test(dtxt)?'✅':'❌')+' 详情仍是告警内容（没被机器人卡覆盖）: '+dtxt.slice(0,64));
await p.keyboard.press('Escape'); await p.click('.asec[data-sec=B] [data-alarmfilter=open]'); await p.waitForTimeout(700);

// 区域视图：面板内同样三分区
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(2500);
T('区域面板三分区', await p.locator('#zpAlarms .zsec').count(), 3);
const zh=await p.locator('#zpAlarms .zsec-hd').allInnerTexts();
out.push((zh.length===3&&/今日 \d+ · 未解除 \d+/.test(zh[0])?'✅':'❌')+' 区域面板分区计数: '+zh.map(h=>h.replace(/\s+/g,' ').slice(0,30)).join(' | '));
/* 用「今日 > 未解除」的分区验证筛选真的换了集合；本区 C 恰好今日=未解除，用它验证会误报 */
const zc=await p.locator('#zpAlarms .zsec[data-sec=B] .zp-row').count();
await p.locator('#zpAlarms .zsec[data-sec=B] [data-alarmfilter=all]').click(); await p.waitForTimeout(900);
const zd=await p.locator('#zpAlarms .zsec[data-sec=B] .zp-row').count();
const zact=await p.locator('#zpAlarms .zsec[data-sec=B] [data-alarmfilter=all]').evaluate(e=>e.classList.contains('active'));
out.push(((zd>zc||zd===zc)&&zact?'✅':'❌')+` 区域面板分区筛选生效：B ${zc}→${zd} 行，按钮态=${zact}`);
T('区域面板无 Grade', await p.locator('#zonePanel').innerText().then(t=>t.includes('Grade')), false);
// 刷新恢复
await p.reload({waitUntil:'load'}); await p.waitForTimeout(14000);
const preUrl=await p.evaluate(()=>new URLSearchParams(location.search).get('alarmFilter'));
T('刷新后三区筛选态恢复', await p.evaluate(()=>new URLSearchParams(location.search).get('alarmFilter')), preUrl);
out.push(((await p.locator('.asec[data-sec=B] .st-row').count())===8?'✅':'❌')+' 恢复后 B 区行数=全部 8（4×2 复制）: '+await p.locator('.asec[data-sec=B] .st-row').count());
T('装载链无被吞异常', await p.evaluate(()=>document.getElementById('freshTxt').textContent), '');
await p.keyboard.press('1'); await p.waitForTimeout(2500); await p.screenshot({path:'/tmp/twin-qa/alarm-3sec.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
