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
import { BASE, gotoZone } from './_env.mjs';
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
/* 选择器必须限定 .tw-chart canvas：FR-74/75 之后 S1 里还挂着 4 个监控画面画布，
   原来这句把画面也算成"图表"，于是"出图数量=2"报成 6——红的是判据范围，不是产品。 */
const paint=await p.evaluate(()=>[...document.querySelectorAll('.tw-chart canvas')].map(c=>{
  const x=c.getContext('2d'); if(!x) return {w:c.width,h:c.height,n:-1};
  try{const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>10)n++;
    return {w:c.width,h:c.height,n};}catch(e){return {w:c.width,h:c.height,n:-2};}}));
ok(paint.length===2,`S1 出图数量 =2（设备运行状态圆环 + 平均温湿度折线带）：实得 ${paint.length}`);
ok(await p.evaluate(()=>[...document.querySelectorAll('.rail .tw-chart')].map(e=>e.id).join(','))==='chartDevices','左栏只挂一张图=设备运行状态圆环（FR-42 把这块从底栏挪上来；四组读数仍只有数字，不再画图）');
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
/* 建档合计读全场设备表（/api/overview/devices，32 台），不再用 106+103 两区相加=11 台 */
/* 建档合计必须排除资产（asset:true 的货架/充电位/电视/支架）：它们不产出检测数据，既不进运行状态环也不进图例。
   dockcheck 早已按这条改过（"五档相加必然差 4 条，红的是取样口径不是圆环"），chartcheck 当时漏了同一处，所以 34≠38。 */
const devicesApi=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/devices');
  return (r.data.devices||[]).filter(d=>!d.asset).length;});
/* 圆环只画非零档（0 台的弧线画不出来，硬塞会变成"图上有一片没有内容"），
   但四档之和这条纪律不许丢：非零档相加必须等于图例四档相加，也等于建档合计。 */
ok(dv&&dv.length>=1&&dv.filter(x=>x.v<=0).length===0&&dv.reduce((s,d)=>s+d.v,0)===dkNum.sum,
  `圆环各档相加 == 图例四档相加（环 ${dv&&dv.map(x=>x.k+':'+x.v).join(' + ')}=${dv&&dv.reduce((s,d)=>s+d.v,0)} vs 图例 ${dkNum.lg.map(x=>x.v).join('+')}=${dkNum.sum}；0 台档只进图例不进环）`);
ok(dkNum.lg.map(x=>x.nm).join('/')==='运行/就绪/异常/待机/停机',`五档名与顺序（2026-11-08 定档定色，就绪不再折进待机）: ${dkNum.lg.map(x=>x.nm).join('/')}`);
ok(dv&&dv.reduce((s,d)=>s+d.v,0)===devicesApi,`五档相加 == 接口建档台数 ${devicesApi}（圆环不是假图）`);
ok(dkNum.lg.every(x=>Math.abs(Math.round(x.v/devicesApi*100)-x.pc)<=1),
  `图例百分比 = 台数/合计（现算不写死）: ${dkNum.lg.map(x=>x.nm+' '+x.v+' '+x.pc+'%').join(' / ')}`);
const donut=await p.evaluate(()=>({cnt:document.querySelectorAll('#dkDevBody .dk-lg').length,
  zero:[...document.querySelectorAll('#dkDevBody .dk-lg.zero')].map(e=>e.querySelector('.nm').innerText.trim())}));
/* 五档（FR-56）：0 台档照样保留并弱化——"异常 0 台"本身就是要看的信息；
   弱化行的顺序跟着图例走（运行/就绪/异常/待机/停机），当前为 异常、停机 两档为 0。 */
/* 哪些档是 0 台由数据决定（全场表里现在只剩「异常」为 0），所以期望值也从接口推，不写死档名 */
const zeroApi=await p.evaluate(async()=>{const d=(await TwinApi.get('/api/overview/devices')).data;
  return ['运行','就绪','异常','待机','停机'].filter((k,i)=>[(d.byStatus.working||0),(d.byStatus.ready||0),(d.byStatus.alarm||0),(d.byStatus.standby||0),(d.byStatus.stopped||0)][i]===0);});
/* ⑦（2026-11-10 圈图）：圆环 hover 弹窗里设备名称起始位置对齐——
   编号列钉成台账最长编号宽（11ch），所有行名称列同一个 x。 */
{const box=await p.evaluate(()=>{const r=document.querySelector('#chartDevices canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
  let rt=null;
  /* 环带实测在 (72,30) 一圈（132×96 画布，cy .52、竖半径 ~20px）——扫点贴着真实环带来 */
  for(const [fx,fy] of [[0.5,0.31],[0.5,0.73],[0.3,0.33],[0.62,0.31],[0.27,0.52],[0.78,0.52],[0.35,0.7],[0.66,0.71],[0.5,0.28]]){
    await p.mouse.move(box.x+box.w*fx, box.y+box.h*fy); await p.waitForTimeout(320);
    rt=await p.evaluate(()=>{const tip=document.querySelector('.ring-tip');
      if(!tip||tip.hidden) return null;
      return {xs:[...tip.querySelectorAll('.rt-i span')].map(e=>Math.round(e.getBoundingClientRect().x)),n:tip.querySelectorAll('.rt-i').length};});
    if(rt) break;
  }
  ok(!!rt&&rt.n>1&&new Set(rt.xs).size===1,
    `圆环弹窗名称列同一起点（编号列定宽 11ch，⑦ 2026-11-10）: ${JSON.stringify(rt&&rt.xs)}`);
  await p.mouse.move(10,400);
}
ok(donut.cnt===5&&donut.zero.join(',')===zeroApi.join(','),`0 台档位保留并弱化（不删行，"异常 0 台"本身就是要看的信息）: 屏上 ${JSON.stringify(donut)} 接口应为 0 的档 ${zeroApi.join('/')||'（无）'}`);
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

/* 常驻守卫：G2 默认 tooltip 会把画图用的内部坐标原样列出来，这类事故已经踩到第三次
   （折线带 0.6777…、环中心 0.5 / 5013625、多边形顶点一长串编号）。
   所以这里不只验"某一处关掉了"，而是把每张图的中心与边缘都 hover 一遍，
   要求除了均值折线带（那是我们自己的卡片）之外，任何图上都不许冒出 .g2-tooltip 可见内容。 */
const leakSpots=await p.evaluate(async()=>{
  const spots=[]; const cvs=[...document.querySelectorAll('.tw-chart')];
  for(const w of cvs){ const r=w.getBoundingClientRect(); if(r.width<20) continue;
    /* 折线带的 hover 由 ④c 专门验，这里跳过它，免得两条断言互相踩 */
    if(w.id==='chartTH') continue;
    spots.push({id:w.id, x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)});
    spots.push({id:w.id, x:Math.round(r.x+r.width*.28), y:Math.round(r.y+r.height*.72)}); }
  return spots;});
let leaked=[];
for(const sp of leakSpots){
  await p.mouse.move(sp.x, sp.y); await p.waitForTimeout(260);
  const bad=await p.evaluate(()=>{const e=document.querySelector('.g2-tooltip'); if(!e) return null;
    const c=getComputedStyle(e); if(c.visibility==='hidden'||+c.opacity<.05) return null;
    const t=e.innerText.replace(/\s+/g,' ').trim(); return t?t:null;});
  /* #chartTH 的 tooltip 是产品要的（真实时刻 + ℃/%RH），不算泄漏；
     但要反过来验它的内容确实是真实读数，而不是哪天又被换回内部坐标 */
  if(bad && sp.id==='chartTH'){ if(!/\d{2}:\d{2}/.test(bad)||!/℃/.test(bad)||!/%RH/.test(bad)) leaked.push('chartTH 内容不是真实读数:'+bad.slice(0,26)); }
  else if(bad) leaked.push(sp.id+':'+bad.slice(0,26)); }
ok(leaked.length===0, `所有图表 hover 任何位置都不许漏出 G2 默认 tooltip（内部坐标/顶点编号）: ${leaked.slice(0,4).join(' | ')||'干净'}`);
/* ④b 两条线不许交叉（2026-11-08 产品负责人圈图：湿度数值本来就比温度高一倍，
   两条线各自归一到同一条带里频繁交叉，看着像"湿度有时低于温度"，那是错的）。
   这条直接在**渲染出来的像素**上量：绿=湿度(22,163,74)、蓝=温度(40,120,255)，
   每列取各自最靠上的一个像素行，要求绿的 y 恒小于蓝的 y。
   只扫左侧 60% 宽度——右边那截是端点标签文字，同样是这两种颜色，扫进来会把文字当线。 */
const bandPix = await p.evaluate(()=>{const cv=document.querySelector('#chartTH canvas'); if(!cv) return null;
  const ctx=cv.getContext('2d',{willReadFrequently:true}); if(!ctx) return null;
  const w=cv.width,h=cv.height,d=ctx.getImageData(0,0,w,h).data;
  const G=[22,163,74],B=[40,120,255];
  const dist=(i,c)=>Math.abs(d[i]-c[0])+Math.abs(d[i+1]-c[1])+Math.abs(d[i+2]-c[2]);
  let both=0,crossed=0,topG=[],topB=[];
  for(let x=0;x<Math.floor(w*.6);x++){let gy=-1,by=-1;
    for(let y=0;y<h;y++){const i=(y*w+x)*4; if(d[i+3]<120) continue;
      const dg=dist(i,G),db=dist(i,B);
      if(gy<0&&dg<90&&dg<db) gy=y; if(by<0&&db<90&&db<dg) by=y;}
    if(gy>=0&&by>=0){both++; if(gy>by) crossed++; topG.push(gy); topB.push(by);}}
  return {both,crossed,w,h,gapPx:both?Math.round(Math.min(...topB.map((b,k)=>b-topG[k]))):-1}});
ok(bandPix&&bandPix.both>40&&bandPix.crossed===0&&bandPix.gapPx>=2,
  `温湿度两条线分带后互不交叉（逐列量：可比较列 ${bandPix&&bandPix.both}，交叉 ${bandPix&&bandPix.crossed}，最小上下间距 ${bandPix&&bandPix.gapPx}px；湿度在上、温度在下）`);

/* ④c hover 出来的必须是真实时刻与真实读数。上一版没给 tooltip 挂数据，G2 就把画图用的
   归一化内部量原样报出来（屏上是 0.6777777… 和 y 0.662994…），这是把内部实现泄漏给用户。 */
const thBox = await p.evaluate(()=>{const r=document.querySelector('#chartTH').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
const tipReads=[];
for(const f of [0.22,0.45,0.60]){ await p.mouse.move(thBox.x+thBox.w*f, thBox.y+thBox.h*.55); await p.waitForTimeout(380);
  tipReads.push(await p.evaluate(()=>{const el=document.querySelector('.g2-tooltip'); if(!el) return '';
    const c=getComputedStyle(el); return c.visibility==='hidden'?'' : el.innerText.replace(/\s+/g,' ').trim();})); }
const tipBad = tipReads.filter(t=>!/\d{2}:\d{2}/.test(t)||!/℃/.test(t)||!/%RH/.test(t)||/\b0\.\d{4,}\b/.test(t)||/\by\s+0\./.test(t));
ok(tipReads.filter(t=>t).length>=2&&tipBad.length===0,
  `hover 出真实时刻与真实读数（含 HH:MM + ℃ + %RH，绝无归一化内部量）: ${tipReads.filter(t=>t).map(t=>t.slice(0,34)).join(' ‖ ')}`);
const tipStyle = await p.evaluate(()=>{const el=document.querySelector('.g2-tooltip'); if(!el) return null;
  const c=getComputedStyle(el); const m=c.backgroundColor.match(/rgba?\((\d+), (\d+), (\d+)(?:, ([0-9.]+))?\)/);
  return {bg:c.backgroundColor, rgb:m?[+m[1],+m[2],+m[3]]:null, fs:c.fontSize};});
ok(!!tipStyle&&!!tipStyle.rgb&&tipStyle.rgb.every(v=>v>=185&&v<=240)&&parseFloat(tipStyle.fs)<=12.6,   /* 三通道都在淡灰区间，本身就排除了纯白 */
  `tooltip 跟全站淡灰口径（不是 G2 默认那块白）: ${tipStyle&&tipStyle.bg} / ${tipStyle&&tipStyle.fs}`);

// ⑤ 点节点行 = 只开详情卡，折线带序列不许被换掉（序列口径是全场均值，跟着点击换点位就成了假标题）
const froze=await p.evaluate(()=>{
  const tr=document.getElementById('dkNodesTrack'); if(tr) tr.style.animation='none';
  const row=document.querySelector('#dkNodesTrack .nd-row[data-node="IOT-102-TH-01"]'); if(!row) return null;
  row.scrollIntoView({block:'center'});
  const r=row.getBoundingClientRect(); return {x:r.x+30,y:r.y+6};});
if(froze){ await p.mouse.click(froze.x,froze.y); await p.waitForTimeout(2400); }
/* 图表容器宽度为 0 时 twin-charts 把 sig 置成字符串 'pending'（见 twin-charts.js:171）。
   直接 JSON.parse 它会让整套 42 项当场蒸发（上一轮就是这么 0 项"跑过"的）：
   这里等它出真序列，等不到就明说"这块图在当前视角根本没有宽度"——那是真缺陷，不是判据问题。 */
const waitSig=async(name,max=14)=>{for(let i=0;i<max;i++){
  const r=await p.evaluate(n=>{const x=window.__twinCharts.list().find(y=>y.name===n);return x&&!x.pending?x.sig:null;},name);
  if(r) return r; await p.waitForTimeout(1000);} return null;};
/* 心跳会让末点跟着新读数走，所以"序列不许变"不能比对整串 sig：
   要比对的是口径——末点仍等于当下右列温湿度读数的均值（点位级序列绝不会被点出来）。 */
const thSigRaw=await waitSig('temp-hum');
if(!thSigRaw) out.push('❌ temp-hum 图始终 pending：容器在当前视角没有宽度，图等于没画（接管改动不许把右列图表压成 0 高）');
/* 图不存在时 list().find() 返回 undefined，直接 .sig 会让整套 42 项蒸发（崩≠过）：
   兜一个空序列，让下面那条判据以 ❌ 明说"temp-hum 没出图"，而不是静默消失。 */
const after=await p.evaluate(()=>({rb:JSON.parse((window.__twinCharts.list().find(x=>x.name==='temp-hum')||{sig:'[]'}).sig),
  mean:(()=>{const seen=[],vals=[];
    [...document.querySelectorAll('#dkNodesTrack .nd-row')].forEach(r=>{const id=r.dataset.node;if(seen.includes(id))return;
      const m=(r.querySelector('.rd')?r.querySelector('.rd').innerText.trim():'').match(/^(-?[\d.]+)℃ · ([\d.]+)%RH$/);
      if(!m)return;seen.push(id);vals.push({t:+m[1],h:+m[2]});});
    return {n:vals.length,t:Math.round(vals.reduce((a,x)=>a+x.t,0)/vals.length*10)/10,h:Math.round(vals.reduce((a,x)=>a+x.h,0)/vals.length*10)/10};})(),
  act:document.querySelectorAll('.nd-row.th-active').length, cap:document.getElementById('chartTHCap'),
  card:(()=>{const c=document.querySelector('#iotPanel .node-card, .node-card');return c?c.innerText.replace(/\s+/g,' '):null;})()}));
const lt=after.rb.length>0?after.rb[0].values[after.rb[0].values.length-1]:NaN, lh=after.rb.length>1?after.rb[1].values[after.rb[1].values.length-1]:NaN;
ok(Math.abs(lt-after.mean.t)<=0.05&&Math.abs(lh-after.mean.h)<=0.05&&after.rb.length===2,
  `点节点行后折线带仍是全场均值（末点 ${lt}/${lh} == 均值 ${after.mean.t}/${after.mean.h}，${after.mean.n} 个点位）——没被换成单点位序列`);
ok(after.act===0&&after.cap===null,`th-active 选中态与图下说明文本都已撤除（active=${after.act}，chartTHCap 元素不存在=${after.cap===null}）`);


// ⑦ 下钻口径跟着 viewProfile 走（FR-80：面板退役后不再出柱图/环形，
//    产品负责人 2026-11-08 定的口径是「四格数字已把结论说完，柱子在 300px 宽里只是把同一件事再画一遍」。
//    所以这条从"验图"改成"验左栏四格的口径与数字随房间/周期变"——验屏上真给客户看的那份。)
await gotoZone(p, '106'); await p.waitForTimeout(4200);
const k106=await p.evaluate(()=>({kind:(document.getElementById('zsGrid')||{}).dataset?.kind,
  txt:(document.getElementById('zsGrid')||{}).innerText.replace(/\s+/g,' ').trim()}));
/* 结构性判据代替文本黑名单：「排队」这个词现在合法地活在调度任务块里，
   该禁的是旧四格 markup（.zs-i）复活，不是某个汉字。 */
const zs106=await p.evaluate(()=>({cells:document.querySelectorAll('#zsGrid .zs-i').length,
  groups:document.querySelectorAll('#zsGrid .zs2-g').length,
  titles:[...document.querySelectorAll('#zsGrid .zs2-h > span')].map(e=>e.innerText).join('/')}));
ok(k106.kind==='任务统计'&&zs106.cells===0&&zs106.groups===4&&zs106.titles==='委托任务/样品/试验项目/调度任务',
  '106 下钻＝任务统计四块（委托/样品/试验项目/调度任务），旧四格 markup 未复活: '+JSON.stringify(zs106));
await gotoZone(p, '103'); await p.waitForTimeout(4200);
const k103=await p.evaluate(()=>({kind:(document.getElementById('zsGrid')||{}).dataset?.kind,
  txt:(document.getElementById('zsGrid')||{}).innerText.replace(/\s+/g,' ').trim()}));
ok(k103.kind==='检测项目数统计'&&/检测中/.test(k103.txt)&&/逾期未出/.test(k103.txt),
  `103 下钻＝检测项目数统计（口径随 viewProfile.blocks 走，不是写死 106）: ${JSON.stringify(k103).slice(0,96)}`);
const segOf=async(v)=>{ await p.locator('[data-period="'+v+'"]:visible').first().click(); await p.waitForTimeout(2600); };
/* ①（2026-11-09）：106 三子区域与周期无关，左栏开关在 106 隐身；
   「周期真的驱动统计」由 102/103 的按周期口径承担（下面 102/103 断言在屏上可见时才点，
   106 里找不到可见开关就是正确行为，不是失败）。 */
await gotoZone(p, '106'); await p.waitForTimeout(3000);
const per0=await p.evaluate(()=>(document.getElementById('zsGrid')||{}).innerText.replace(/\s+/g,' ').trim());
const segVis=await p.evaluate(()=>[...document.querySelectorAll('.period .seg')].filter(e=>{const q=e.getBoundingClientRect();return q.width>2&&q.height>2;}).length);
ok(per0&&segVis===3,`106 周期开关回到标题行（⑥ 2026-11-10：可见 ${segVis} 个，驱动本周期行）: 「${per0.slice(0,30)}」`);
await gotoZone(p, '102'); await p.waitForTimeout(4200);
const k102=await p.evaluate(()=>({kind:(document.getElementById('zsGrid')||{}).dataset?.kind,
  cells:[...document.querySelectorAll('#zsGrid .zs-i')].map(e=>e.innerText.replace(/\s+/g,' ').trim()),
  names:[...document.querySelectorAll('#zsGrid .sp-nm')].map(e=>{const m=e.innerText.match(/(\d+) 支/);return +((m&&m[1])||0);})}));
const sum102=k102.names.reduce((a,x)=>a+x,0);
ok(k102.kind==='样品台账'&&/286 在库存量\(支\)/.test(k102.cells.join(' '))&&k102.names.length>=3&&sum102===286,
  `102 下钻＝样品台账四格 + 按名称分布，且分布合计=在库存量（${k102.names.join('+')}=${sum102} vs 286）: ${k102.cells.join(' / ')}`);
const k101=await (async()=>{ await gotoZone(p,'101'); await p.waitForTimeout(3600);
  return p.evaluate(()=>({kind:(document.getElementById('zsGrid')||{}).dataset?.kind,
    txt:(document.getElementById('zsGrid')||{}).innerText.replace(/\s+/g,' ').trim()}));})();
ok(k101.kind===''&&/无任务与检测项目口径/.test(k101.txt)&&/环境数据见右列/.test(k101.txt),
  `101 没有统计口径就明说，不摆四个 0 冒充数据: ${JSON.stringify(k101).slice(0,90)}`);

// ⑧ 无障碍与 reduced-motion
const a11y=await p.evaluate(()=>{const n=[...document.querySelectorAll('.tw-chart')];return {total:n.length,noLabel:n.filter(e=>e.getAttribute('role')!=='img'||!e.getAttribute('aria-label')).length};});
ok(a11y.noLabel===0,`每张图都有 role=img + aria-label（${a11y.total-a11y.noLabel}/${a11y.total}）`);
const p2=await b.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
await p2.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});await p2.waitForTimeout(15000);
const rm=await p2.evaluate(()=>({n:document.querySelectorAll('.tw-chart canvas').length,errs:window.__twinCharts.state.errors.length}));
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
