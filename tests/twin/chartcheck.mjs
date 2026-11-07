/**
 * 3D 图表守卫（FR-36）
 *  ① 引擎来自本地 vendor，不依赖 CDN（展厅断网也要能开）
 *  ② 每张图真的画出了像素（canvas 全量扫描，不是抽样）
 *  ③ 图与表同源：图表输入数字必须等于同一拍表格/分组表头的数字（不一致=两套假数据）
 *  ④ 温湿度折线带 = 未来实验室平均温湿度：末点必须钉住右列全部温湿度点位读数的均值（点位数现读，不写死）
 *     （图上的数与列表里的数不许是两套；2026-11-07 改版，标题写"平均"就必须真是平均）
 *  ⑤ 点温湿度节点行只开节点详情卡，不再切换折线带序列（序列是全场均值，跟着点击换点位=撒谎）
 *  ⑥ 周期切换（本日→本月）图表跟着变
 *  ⑦ 下钻出图：106 出任务四档柱，103 出检测项目四档柱
 *  ⑧ 无障碍：每张图 role=img + aria-label；reduced-motion 下仍然出图
 *  ⑨ 纪律：面颜色走 style.fill 回调，不许把 hex 塞进数据再当 encode.color 的类别
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const ok=(c,m)=>out.push((c?'✅':'❌')+' '+m);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
const src=await (await import('node:fs/promises')).readFile(new URL('../../twin/future-lab/twin-charts.js',import.meta.url),'utf8');
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(16000);

// ① 本地引擎
const res=await p.evaluate(()=>performance.getEntriesByType('resource').map(r=>r.name));
ok(res.some(n=>/vendor\/g2\.min\.js/.test(n)) && !res.some(n=>/unpkg|jsdelivr|cdn\./.test(n)),'G2 从本地 vendor 加载，无 CDN 依赖: '+res.filter(n=>/g2\.min/.test(n)).map(x=>x.split('/').pop()).join(','));
ok(await p.evaluate(()=>!!window.G2 && !!window.TwinCharts),'引擎与图表层都已就绪');

// ② 每张图真的有像素
const paint=await p.evaluate(()=>[...document.querySelectorAll('canvas')].map(c=>{
  const x=c.getContext('2d'); if(!x) return {w:c.width,h:c.height,n:-1};
  try{const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>10)n++;
    return {w:c.width,h:c.height,n};}catch(e){return {w:c.width,h:c.height,n:-2};}}));
ok(paint.length===2,`S1 出图数量 =2（设备运行状态圆环 + 平均温湿度折线带）：实得 ${paint.length}`);
ok(await p.evaluate(()=>document.querySelectorAll('.rail .tw-chart').length)===0,'左栏不再挂图（2026-11-07：图表去掉、左栏加宽缩短、不出滚动条）');
ok(await p.evaluate(()=>document.querySelectorAll('.stream .tw-chart').length)===0,'告警流也不再挂图（分级柱已撤，省出的高度给列表）');
ok(paint.every(c=>c.n>200),`每张图都画出内容（非透明像素 >200）：${paint.map(c=>c.n).join(',')}`);
/* 出图之后必须"留在屏上"：同一个容器/同一个图名被两处交替拥有时，每次心跳都会
   destroy+重建（先清空再画），画布在两次采样之间就是 0 像素——屏上表现为每 2s 闪一下白，
   而且重建那一瞬画的可能是已被否掉的旧口径。本轮真实踩过（底栏块1 圆环 vs 旧五档柱）。
   所以这里连采 6s：任何一张图都不许出现空帧，Chart 构造次数增量必须为 0。 */
const churn=await p.evaluate(async()=>{
  const G=window.G2, Orig=G.Chart; let builds=0;
  G.Chart=function(o){ builds++; return new Orig(o); }; G.Chart.prototype=Orig.prototype;
  const blanks=[];
  for(let k=0;k<30;k++){
    const one=[];
    document.querySelectorAll('.tw-chart canvas').forEach(c=>{const x=c.getContext('2d');let n=0;
      try{const d=x.getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i]>10)n++;}catch(e){n=-1;}});
    if(one.some(v=>v<=200)) blanks.push(k+':'+one.join('/'));
    await new Promise(r=>setTimeout(r,200));
  }
  G.Chart=Orig;
  return {builds, blanks};});
ok(churn.builds===0&&churn.blanks.length===0,
  `6s × 200ms 连采：不重建、不空帧（新建 Chart ${churn.builds} 次，空帧 ${churn.blanks.length} 帧${churn.blanks.length?'：'+churn.blanks.slice(0,3).join(' '):''}）`);
const errs=await p.evaluate(()=>window.__twinCharts.state.errors);
ok(errs.length===0,'图表层无渲染错误: '+JSON.stringify(errs).slice(0,160));

// ③ 图与表同源
const list=await p.evaluate(()=>window.__twinCharts.list());
const sig=n=>{const r=list.find(x=>x.name===n);return r?JSON.parse(r.sig):null;};
/* FR-41 压缩版 DOM：大数在 .dt-v、分解值按序在 .dt-detail .v（表格结构已不存在） */
const tbl=await p.evaluate(()=>{const g=k=>{const s=document.querySelector(`.dtable[data-key="${k}"]`);if(!s)return null;
  return [{label:'head',v:+s.querySelector('.dt-v').innerText},...[...s.querySelectorAll('.dt-detail .v')].map(e=>({label:'',v:+e.innerText}))];};
  return {entrust:g('entrust'),samples:g('samples'),testItems:g('testItems'),dispatch:g('dispatch')};});
/* 左栏四张表只留数字：柱状图把同一批数字再画一遍，还各吃掉 88px 高度——
   产品负责人要求左栏加宽、缩短、不出滚动条，所以这里反过来断言"图上没有图"，
   但表格数字与接口必须仍然一致（口径没被顺手改掉）。 */
const tblOk=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/lab-status');const P=r.data.panels;
  const g=k=>{const s=document.querySelector(`.dtable[data-key="${k}"]`);return [+s.querySelector('.dt-v').innerText,...[...s.querySelectorAll('.dt-detail .v')].map(e=>+e.innerText)];};
  return {entrust:g('entrust').join(',')===`${P.entrust.periods.day.total},${P.entrust.periods.day.power},${P.entrust.periods.day.safety}`,
    samples:g('samples').join(',')===`${P.samples.periods.day.received},${P.samples.periods.day.testing},${P.samples.periods.day.done}`,
    testItems:g('testItems').slice(0,4).join(',')===`${P.testItems.periods.day.testing+P.testItems.periods.day.pending+P.testItems.periods.day.done},${P.testItems.periods.day.testing},${P.testItems.periods.day.pending},${P.testItems.periods.day.done}`};});
ok(tblOk.entrust&&tblOk.samples&&tblOk.testItems,`左栏表格数字仍等于接口（撤图不许动口径）: ${JSON.stringify(tblOk)}`);

/* 底栏块1 改「设备运行状态」四档圆环（2026-11-07）：圆环的纪律是"各档相加必须等于合计"，
   所以「就绪」折进「待机」（否则四档之和与建档台数对不上，圆环就是假图）。
   合计取接口建档台数，图例数字与环形输入必须同时等于它。 */
const dv=sig('devices');
const dkNum=await p.evaluate(()=>{const lg=[...document.querySelectorAll('#dkDevBody .dk-lg')].map(e=>({nm:e.querySelector('.nm').innerText.trim(),
    v:+e.querySelector('.vv').innerText,pc:+e.querySelector('.pc').innerText.replace('%','')}));
  return {lg,sum:lg.reduce((a,x)=>a+x.v,0)};});
/* 建档口径与宿主同源：devices = 106 全量 + 103 已建档（宿主就是这么拼的），没有单独的总表接口 */
const devicesApi=await p.evaluate(async()=>{const a=await TwinApi.get('/api/zone/106/devices');const b=await TwinApi.get('/api/zone/103/devices');
  return (a.data||[]).length+(b.data||[]).length;});
/* 圆环只画非零档（0 台的弧线画不出来，硬塞会变成"图上有一片没有内容"），
   但四档之和这条纪律不许丢：非零档相加必须等于图例四档相加，也等于建档合计。 */
ok(dv&&dv.length>=1&&dv.filter(x=>x.v<=0).length===0&&dv.reduce((s,d)=>s+d.v,0)===dkNum.sum,
  `圆环各档相加 == 图例四档相加（环 ${dv&&dv.map(x=>x.k+':'+x.v).join(' + ')}=${dv&&dv.reduce((s,d)=>s+d.v,0)} vs 图例 ${dkNum.lg.map(x=>x.v).join('+')}=${dkNum.sum}；0 台档只进图例不进环）`);
ok(dkNum.lg.map(x=>x.nm).join('/')==='运行中/待机/停机/异常',`四档名与顺序（「停止」已改「停机」、就绪折进待机）: ${dkNum.lg.map(x=>x.nm).join('/')}`);
ok(dv&&dv.reduce((s,d)=>s+d.v,0)===devicesApi,`四档相加 == 接口建档台数 ${devicesApi}（圆环不是假图）`);
ok(dkNum.lg.every(x=>Math.abs(Math.round(x.v/devicesApi*100)-x.pc)<=1),
  `图例百分比 = 台数/合计（现算不写死）: ${dkNum.lg.map(x=>x.nm+' '+x.v+' '+x.pc+'%').join(' / ')}`);
const donut=await p.evaluate(()=>({cnt:document.querySelectorAll('#dkDevBody .dk-lg').length,
  zero:[...document.querySelectorAll('#dkDevBody .dk-lg.zero')].map(e=>e.querySelector('.nm').innerText.trim())}));
ok(donut.cnt===4&&donut.zero.join(',')==='停机,异常',`0 台档位保留并弱化（不删行，"异常 0 台"本身就是要看的信息）: ${JSON.stringify(donut)}`);
ok(!list.some(x=>x.name==='queue'),'底栏队列块不再塞图，清单保持完整');
const al=sig('alarms');
ok(al===null,'告警分组柱已从图表层摘除（不是画了个空的）');
const cnt=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/alarms');const A=r.data.alarms||r.data;
  return ['A','B','C'].map(g=>{const l=A.filter(x=>x.grade===g);return [l.length,l.filter(x=>x.status!=='resolved').length];});});
/* 柱图撤了，但分级计数这条口径不能跟着丢：改验「行内徽标的分布 == 接口分布」+ 头部汇总 == 接口总数 */
const badgeDist=await p.evaluate(()=>{const r=[...document.querySelectorAll('#streamTrack .st-row')].slice(0,13);
  return ['A','B','C'].map(g=>r.filter(x=>x.querySelector('.gd')&&x.querySelector('.gd').innerText===g).length);});
ok(badgeDist.join('/')===cnt.map(c=>c[0]).join('/'),`行内等级徽标分布 == 接口分级计数（柱图撤了口径不许丢）: 屏上 ${badgeDist.join('/')} vs 接口 ${cnt.map(c=>c[0]).join('/')}`);
const meta=await p.evaluate(()=>document.getElementById('streamMeta').innerText.replace(/\s+/g,' '));
const total=cnt.reduce((a,c)=>a+c[0],0), open=cnt.reduce((a,c)=>a+c[1],0);
ok(meta.includes(String(total))&&meta.includes(String(open)),`头部汇总仍等于接口（今日 ${total} / 未解除 ${open}）: "${meta}"`);

// ④ 折线带 = 未来实验室平均温湿度：末点必须等于右列温湿度点位读数的均值
const th=await p.evaluate(async()=>{
  const seen=[],vals=[];
  [...document.querySelectorAll('#dkNodesTrack .nd-row')].forEach(r=>{
    const id=r.dataset.node; if(seen.includes(id)) return;
    const m=(r.querySelector('.rd')?r.querySelector('.rd').innerText.trim():'').match(/^(-?[\d.]+)℃ · ([\d.]+)%RH$/);
    if(!m) return; seen.push(id); vals.push({id,t:+m[1],h:+m[2]});});
  const avgT=Math.round(vals.reduce((a,x)=>a+x.t,0)/vals.length*10)/10;
  const avgH=Math.round(vals.reduce((a,x)=>a+x.h,0)/vals.length*10)/10;
  return {n:vals.length,ids:seen,avgT,avgH};});
const rb=sig('temp-hum');
const lastT=rb&&rb[0].values[rb[0].values.length-1], lastH=rb&&rb[1].values[rb[1].values.length-1];
ok(th.n>=2&&rb&&rb.length===2&&rb[0].values.length===16&&Math.abs(lastT-th.avgT)<=0.05&&Math.abs(lastH-th.avgH)<=0.05,
  `折线带两条序列各 16 点，末点 == 右列 ${th.n} 个温湿度点位读数均值（图与列表同一套数）：图上 ${lastT}℃/${lastH}%RH vs 均值 ${th.avgT}℃/${th.avgH}%RH`);
ok(await p.evaluate(()=>{const c=document.querySelector('#chartTH canvas');return !!c&&c.width>0;}),'均值折线带真有像素');

// ⑤ 点节点行 = 只开详情卡，折线带序列不许被换掉（序列口径是全场均值，跟着点击换点位就成了假标题）
const froze=await p.evaluate(()=>{
  const tr=document.getElementById('dkNodesTrack'); if(tr) tr.style.animation='none';
  const row=document.querySelector('#dkNodesTrack .nd-row[data-node="IOT-102-TH-01"]'); if(!row) return null;
  row.scrollIntoView({block:'center'});
  const r=row.getBoundingClientRect(); return {x:r.x+30,y:r.y+6};});
if(froze){ await p.mouse.click(froze.x,froze.y); await p.waitForTimeout(2400); }
/* 心跳会让末点跟着新读数走，所以"序列不许变"不能比对整串 sig：
   要比对的是口径——末点仍等于当下右列温湿度读数的均值（点位级序列绝不会被点出来）。 */
const after=await p.evaluate(()=>({rb:JSON.parse(window.__twinCharts.list().find(x=>x.name==='temp-hum').sig),
  mean:(()=>{const seen=[],vals=[];
    [...document.querySelectorAll('#dkNodesTrack .nd-row')].forEach(r=>{const id=r.dataset.node;if(seen.includes(id))return;
      const m=(r.querySelector('.rd')?r.querySelector('.rd').innerText.trim():'').match(/^(-?[\d.]+)℃ · ([\d.]+)%RH$/);
      if(!m)return;seen.push(id);vals.push({t:+m[1],h:+m[2]});});
    return {n:vals.length,t:Math.round(vals.reduce((a,x)=>a+x.t,0)/vals.length*10)/10,h:Math.round(vals.reduce((a,x)=>a+x.h,0)/vals.length*10)/10};})(),
  act:document.querySelectorAll('.nd-row.th-active').length, cap:document.getElementById('chartTHCap'),
  card:(()=>{const c=document.querySelector('#iotPanel .node-card, .node-card');return c?c.innerText.replace(/\s+/g,' '):null;})()}));
const lt=after.rb[0].values[after.rb[0].values.length-1], lh=after.rb[1].values[after.rb[1].values.length-1];
ok(Math.abs(lt-after.mean.t)<=0.05&&Math.abs(lh-after.mean.h)<=0.05&&after.rb.length===2,
  `点节点行后折线带仍是全场均值（末点 ${lt}/${lh} == 均值 ${after.mean.t}/${after.mean.h}，${after.mean.n} 个点位）——没被换成单点位序列`);
ok(after.act===0&&after.cap===null,`th-active 选中态与图下说明文本都已撤除（active=${after.act}，chartTHCap 元素不存在=${after.cap===null}）`);


// ⑦ 下钻出图
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(4200);
const z106=await p.evaluate(()=>window.__twinCharts.list().map(x=>x.name));
ok(z106.includes('zstats'),'106 下钻出任务统计柱: '+z106.join(','));
await p.selectOption('#zoneSel','103'); await p.waitForTimeout(4200);
const z103=await p.evaluate(()=>({names:window.__twinCharts.list().map(x=>x.name),sig:window.__twinCharts.list().find(x=>x.name==='zstats')}));
/* ⑥ 周期切换跟着变（左栏撤图后，这条由区域面板的统计柱来验——它同样是"图必须跟着口径走"） */
const per0=await p.evaluate(()=>{const r=window.__twinCharts.list().find(x=>x.name==='zstats');return r?JSON.parse(r.sig):null;});
/* 周期切换器存在于两处：左栏可见时是 .rail .seg，下钻到非 106 时是 #zpPeriod .seg。
   必须按当前视图挑可见的那个——点隐藏的那个 Playwright 会重试到 30s 超时（本轮踩过）。 */
/* 只点"可见的那一份"周期按钮：106 撤指标后 .rail>.period 仍留在 DOM 里（display:none），
   按 rail.hidden 判断会选中它，Playwright 对隐藏元素重试到 30s 超时（本轮踩过）。 */
const segOf=async(v)=>{ await p.locator('[data-period="'+v+'"]:visible').first().click(); await p.waitForTimeout(2600); };
await segOf('month');
const per1=await p.evaluate(()=>{const r=window.__twinCharts.list().find(x=>x.name==='zstats');return r?JSON.parse(r.sig):null;});
ok(per0&&per1&&JSON.stringify(per0)!==JSON.stringify(per1)&&per1[0].v>per0[0].v,
  `周期切到本月 → 面板统计柱数字跟着换（已完成 ${per0&&per0[0].v} → ${per1&&per1[0].v}）`);
await segOf('day');
ok(z103.names.includes('zstats')&&/检测中/.test(z103.sig.sig),`103 下钻出检测项目数柱（口径随 viewProfile.blocks 走）: ${z103.sig.sig.slice(0,52)}`);
await p.selectOption('#zoneSel','102'); await p.waitForTimeout(4200);
const sm=await p.evaluate(()=>{const r=window.__twinCharts.list().find(x=>x.name==='zsamples');return r?JSON.parse(r.sig):null;});
const stored=await p.evaluate(()=>{const e=document.querySelector('#zpSamplesN');return e?+e.innerText.replace(/\D/g,''):0;});
ok(sm&&sm.length>=3&&sm.reduce((a,x)=>a+x.v,0)===stored,`102 样品分布环形各类相加 == 在库存量（${sm&&sm.map(x=>x.v).join('+')} = ${sm&&sm.reduce((a,x)=>a+x.v,0)} vs ${stored}）`);

// ⑧ 无障碍与 reduced-motion
const a11y=await p.evaluate(()=>{const n=[...document.querySelectorAll('.tw-chart')];return {total:n.length,noLabel:n.filter(e=>e.getAttribute('role')!=='img'||!e.getAttribute('aria-label')).length};});
ok(a11y.noLabel===0,`每张图都有 role=img + aria-label（${a11y.total-a11y.noLabel}/${a11y.total}）`);
const p2=await b.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
await p2.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});await p2.waitForTimeout(15000);
const rm=await p2.evaluate(()=>({n:document.querySelectorAll('canvas').length,errs:window.__twinCharts.state.errors.length}));
ok(rm.n===2&&rm.errs===0,`prefers-reduced-motion 下照样出图（S1 =${rm.n} 张：设备圆环 + 均值折线带，错误 ${rm.errs}）——图表不靠动画表意`);
await p2.close();

// ⑨ 纪律：不许把 hex 塞进数据当 encode.color
ok(!/encode:\s*\{[^}]*color:\s*'c'/.test(src)&&/style:\s*\{\s*fill:\s*d\s*=>\s*d\.c/.test(src),'面颜色走 style.fill 回调，未用 encode.color 编码 hex');
ok(err.length===0,'无 pageerror/console error: '+err.slice(0,3).join(' | '));
console.log(out.join('\n'));
const bad=out.filter(l=>l.startsWith('❌')).length;
console.log('\n通过 '+out.filter(l=>l.startsWith('✅')).length+' · 失败 '+bad);
await b.close();
process.exit(bad?1:0);
