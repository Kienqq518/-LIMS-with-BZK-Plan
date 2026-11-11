/**
 * 下钻画像与浮层间距（2026-11-06 产品负责人反馈）
 *  ① 106 下钻后：机器人仍在走、底栏任务队列仍在跑（不能一切房间就没任务信息了）
 *  ② 非 106 下钻：左栏四张表隐藏，只留右侧面板
 *  ③ 统计口径按房间分：106 任务四格 / 其他试验区检测项目数 / 102 样品台账 / 101 只有环境数据 / 104 无统计块
 *  ④ 所有浮层之间必须有间距，不许重叠（历史上 dock left:180 与左栏 238 重叠 58px）
 */
import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
const out=[],err=[];
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(16000);
const f=p.frames().find(x=>/tour-space/.test(x.url()));
const rects=()=>p.evaluate(()=>{
  const R=(sel)=>{const e=document.querySelector(sel); if(!e) return null;
    if(getComputedStyle(e).display==='none'||e.hidden) return 'hidden';
    const r=e.getBoundingClientRect(); return {x:Math.round(r.x),r:Math.round(r.right),y:Math.round(r.y),b:Math.round(r.bottom)};};
  /* 参与"互不重叠"的必须是同级浮层：.stream/.cctv 都住在 #rightCol 里，
     把容器 rcol 也放进去，量到的必然是"父子重叠 430px"——那是判据错，不是版式错。 */
  return {rail:R('.rail'),stream:R('.stream'),cctv:R('.cctv'),dock:R('.dock'),rcol:R('#rightCol')};
});
const noOverlap=(o)=>{const vis=Object.entries(o).filter(([k,v])=>v&&v!=='hidden'&&k!=='rcol');
  for(let i=0;i<vis.length;i++)for(let j=i+1;j<vis.length;j++){
    const a=vis[i][1],c=vis[j][1];
    const xOverlap=Math.min(a.r,c.r)-Math.max(a.x,c.x), yOverlap=Math.min(a.b,c.b)-Math.max(a.y,c.y);
    if(xOverlap>0&&yOverlap>0) return vis[i][0]+' × '+vis[j][0]+' 重叠 '+xOverlap+'px';
  } return '';};

// ④ S1 间距
let r=await rects();
out.push((!noOverlap(r)?'✅':'❌')+' S1 四块浮层互不重叠: '+JSON.stringify(r)+' '+noOverlap(r));
/* FR-45 之后底栏 left:14 铺到 right:16（整屏宽），它和左栏/告警流是**上下关系**而不是左右关系：
   旧的两条"水平沟槽"量的是 dock.x - rail.r，新布局下必然是负数（两块横向重叠但纵向分开）。
   口径跟着改成垂直间距——上下不许粘在一起，也不许互相压住（压住由上面 noOverlap 兜）。 */
out.push((r.dock.y-r.rail.b>=12?'✅':'❌')+` 底栏压在左栏下方且留出 ${r.dock.y-r.rail.b}px 垂直间距（旧口径：水平沟槽，FR-45 铺满整屏宽后失效）`);
out.push((r.dock.y-r.stream.b>=12?'✅':'❌')+` 底栏压在告警流下方且留出 ${r.dock.y-r.stream.b}px 垂直间距`);
const vw=await p.evaluate(()=>window.innerWidth);
out.push(((r.dock.x<=20&&r.dock.r>=vw-24)?'✅':'❌')+` 底栏确实铺满整屏宽：${r.dock.x}→${r.dock.r}（视口 ${vw}）`);
const inner=await p.evaluate(()=>[...document.querySelectorAll('.dock .dk')].map(e=>{const q=e.getBoundingClientRect();return {x:Math.round(q.x),w:q.width};}).filter(e=>e.w>2).map(e=>e.x));
out.push((inner[1]-inner[0]>0&&inner.every((x,i)=>i===0||x>inner[i-1])?'✅':'❌')+' 底栏四块之间也有间距: 起点 '+JSON.stringify(inner));

// ① 106 下钻（FR-80 三区接管后的画像：左栏两块 + 底栏 + 右列）
await gotoZone(p, '106'); await p.waitForTimeout(3200);
r=await rects();
out.push((!noOverlap(r)?'✅':'❌')+' 106 下钻后浮层仍互不重叠: '+noOverlap(r));
out.push(((r.dock&&r.dock!=='hidden')?'✅':'❌')+' 106 下钻后底栏仍在（任务队列继续走）: '+JSON.stringify(r.dock));
out.push(((r.rail&&r.rail!=='hidden')?'✅':'❌')+' 106 下钻后左栏仍在（接管为任务统计 + 设备/机器人两块）: '+JSON.stringify(r.rail));
out.push(((r.rcol&&r.rcol!=='hidden')?'✅':'❌')+' 106 下钻后右列不再整列让位（告警流留在原位）: '+JSON.stringify(r.rcol));
/* 观察窗必须覆盖「一次停靠 + 一段行走」：剧本最长 dwell 9s，原来只看 6s，
   整窗落进停靠段就报「机器人没走」——那是假失败（2026-11-07 全量踩到，位移 0.00m）。
   改成轮询到出现位移即早退，最长 24s（≈ 一圈里最长的停靠 + 跨站行走）。 */
const robPos=()=>f.evaluate(()=>{const m=window.visual106.modelRoots.get('106-08');return m?[+m.position.x.toFixed(3),+m.position.z.toFixed(3)]:null;});
const pos0=await robPos(); let pos1=pos0, moved=0; const tEnd=Date.now()+24000;
while (Date.now()<tEnd) { await p.waitForTimeout(2500); pos1=await robPos(); moved=Math.hypot(pos1[0]-pos0[0],pos1[1]-pos0[1]); if (moved>0.3) break; }
out.push((moved>0.3?'✅':'❌')+` 106 下钻后机器人仍在行进（≤24s 观察窗内位移 ${moved.toFixed(2)}m，含停靠段）`);
const live=await p.evaluate(async()=>{const x=await TwinApi.get('/api/zone/106/cycle');return x.data.live.order+'/'+x.data.live.total+' '+x.data.live.phase;});
out.push(((live.split(' ')[1]==='travel'||live.indexOf('dwell')>0)?'✅':'❌')+' 任务也在推进: '+live);
/* ②⑥⑩（2026-11-09 10 点清单）：设备环=本房间口径 / 调度任务三列有真内容 / 组态物联图=本房间均值。 */
{
  const A = await p.evaluate(async () => {
    const rd = document.getElementById('railDev'), rr = rd.getBoundingClientRect();
    const legend = [...document.querySelectorAll('#dkDevBody .dk-lg')].map(e => ({ k: e.querySelector('.nm').innerText, v: +(e.querySelector('.vv').innerText || 0) }));
    const sum = legend.reduce((a, x) => a + x.v, 0);
    const zc = (document.getElementById('zDevsN') || {}).innerText || '';
    const cols = [...document.querySelectorAll('.dq3 .dq-col')].map(c => ({ st: c.dataset.state, rows: c.querySelectorAll('.dq-row').length, head: c.querySelector('h4').innerText.trim() }));
    const cyNow = document.getElementById('cyNow').innerText.trim();
    /* 底栏滚动轨道是无缝轮播：每行都有一份克隆，按 data-node 去重后再比集合，
       否则 from=1 个点位永远打不平屏上 2 行（第一次跑就栽在这）。 */
    const rows = [...new Map([...document.querySelectorAll('#dkNodesTrack .nd-row')].map(e => [e.dataset.node, e])).values()].map(e => {
      const m = e.innerText.match(/(-?[\d.]+)℃\s*·\s*(-?[\d.]+)%RH/);
      return m ? { id: e.dataset.node, t: +m[1], h: +m[2] } : null; }).filter(Boolean);
    return { vis: rr.width > 2 && rr.height > 2, legend, sum, zc, cols, cyNow, rows };
  });
  const nRoom = parseInt((A.zc.match(/(\d+)\s*台建档/) || [])[1] || '-1', 10);
  out.push((A.vis && A.sum === nRoom && nRoom > 0 ? '✅' : '❌')
    + ` ② 106 左栏设备环回到房间视图且=本房间口径：五档相加 ${A.sum} == 左栏「${A.zc}」的建档数 ${nRoom}`);
  const headsOk = A.cols.length === 3 && A.cols.every(c => c.rows > 0);
  out.push((headsOk && A.cyNow !== '–' ? '✅' : '❌')
    + ` ⑥ 106 底栏「无人化调度任务」三列都有真内容（探针不再靠 .dq-grp——那行标题在 dq3 三列版式里已退役）: `
    + JSON.stringify(A.cols.map(c => c.head + '×' + c.rows)) + ` · 当前道「${A.cyNow}」`);
  /* ⑩（2026-11-10 改版）：房间视图的组态物联不再是「均值图+滚动行」——
     等分卡片就是本房间逐点真数（图与表同源的最终形态：卡即表）。
     断言：卡片集合 == 配置里本房间非视觉节点；每卡带 区·类型 与读数；均值图与轮播在房间视图不出现。 */
  {
    const cfg=await p.evaluate(async()=>(await (await fetch('data/iot-nodes.json')).json()));
    const want=cfg.nodes.filter(n=>String(n.roomId)==='106'&&n.type!=='camera').map(n=>n.name).sort();
    const got=await p.evaluate(()=>({
      names:[...document.querySelectorAll('#dkNodesZone .zi-card .zi-l b')].map(e=>e.innerText).sort(),
      typed:[...document.querySelectorAll('#dkNodesZone .zi-card')].every(e=>e.querySelector('.zi-tp')&&e.querySelector('.zi-st')&&e.querySelector('.zi-v').innerText!==''),
      marquee:(()=>{const e=document.querySelector('#iotPanel .np-view');return !e||e.hidden;})(),
      chart:(()=>{const e=document.querySelector('#iotPanel .th-wrap');return !e||e.hidden;})()}));
    out.push((got.names.join('|')===want.join('|')&&got.typed?'✅':'❌')+
      ` ⑩ 106 组态物联=本房间非视觉节点等分卡（${got.names.join('/')} == 配置 ${want.join('/')}），每卡带 名称/类型/状态/读数 四要素`);
    out.push((got.marquee&&got.chart?'✅':'❌')+' 106 房间视图撤掉全场均值图与无缝轮播（卡即表，不留两套）');
  }
}
/* ①②③（2026-11-09 四次圈图）：106 右下两列带 + 底栏让位左栏 + 告警流加高 */
{
  const g=await p.evaluate(()=>{const R=s=>{const e=document.querySelector(s);const qq=e.getBoundingClientRect();
    return{x:Math.round(qq.x),y:Math.round(qq.y),r:Math.round(qq.right),b:Math.round(qq.bottom),h:Math.round(qq.height)};};
    return {sc:R('#dkScenes'),cam:R('.cctv'),iot:R('#iotPanel'),dock:R('.dock'),rail:R('.rail'),stream:R('.stream')};});
  out.push((g.sc.b<=g.cam.y+1&&g.iot.x>=g.sc.r-1&&g.iot.y<=g.sc.y+2&&g.iot.b>=g.cam.b-1?'✅':'❌')+
    ` ③ 106 右下两列带：场景监测(上 ${g.sc.y}→${g.sc.b})＋实时画面(下 ${g.cam.y}→${g.cam.b})，组态物联在右侧同带（x ${g.iot.x}→${g.iot.r}，y ${g.iot.y}→${g.iot.b}）`);
  out.push((g.dock.x>=g.rail.r+12?'✅':'❌')+` ① 调度任务块让位左栏：底栏起于 x=${g.dock.x} ≥ 左栏右缘 ${g.rail.r}+12（不再压「设备运行状态」）`);
  out.push((g.stream.h>=420?'✅':'❌')+` ② 告警流加高：可视 ${g.stream.h}px（≥420——旧固定 279 的 1.5 倍，下方不再叠三块）`);
}
/* ①②③④⑤（2026-11-10 圈图）：106 五条版式的持久守卫 */
{
  const q=await p.evaluate(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height),r:Math.round(r.right),b:Math.round(r.bottom)};};
    const dk=document.getElementById('taskStrip');
    const tiles=[...document.querySelectorAll('#camGrid .cam-tile')].map(e=>{const r=e.getBoundingClientRect();return{w:Math.round(r.width),h:Math.round(r.height)};});
    const grid=document.querySelector('#camGrid').getBoundingClientRect();
    const cards=[...document.querySelectorAll('#dkNodesZone .zi-card')].map(e=>Math.round(e.getBoundingClientRect().height));
    return {rd:R('#railDev'),dkTop:Math.round(dk.getBoundingClientRect().top),dkInline:dk.style.top||'',sc:R('#dkScenes'),cam:R('.cctv'),iot:R('#iotPanel'),
      tiles,tileGridW:Math.round(grid.width),cards,
      camN:document.querySelectorAll('#camGrid .cam-tile').length,
      marquee:document.querySelector('#iotPanel .np-view')?.hidden,th:document.querySelector('#iotPanel .th-wrap')?.hidden};});
  out.push((q.dkTop===q.rd.y&&q.dkInline!==''?'✅':'❌')+` ① 底栏顶边与「设备运行状态」标题齐平：dock.top ${q.dkTop} == railDev.top ${q.rd.y}（inline ${q.dkInline||'无'}）`);
  out.push((Math.abs(q.sc.h-q.cam.h)<=4&&q.sc.y>=q.iot.y-2&&q.cam.b<=q.iot.b+2&&q.iot.x>=q.sc.r-1?'✅':'❌')+
    ` ③ 带左列场景/画面二分高度各占满（${q.sc.h} vs ${q.cam.h}），组态物联在右侧同带（x ${q.iot.x}→${q.iot.x+q.iot.w}）`);
  out.push((q.camN===1&&q.tiles.length===1&&q.tiles[0].w>=q.tileGridW-26?'✅':'❌')+
    ` ④ 单路画面占满整行：格宽 ${q.tiles[0]&&q.tiles[0].w} ≥ 网格内容宽 ${q.tileGridW-24}（网格左右各 12px 内衬；不再挤半列）`);
  out.push((q.cards.length===3&&new Set(q.cards).size===1&&q.marquee===true&&q.th===true?'✅':'❌')+
    ` ⑤ 组态物联=3 张等高卡（${JSON.stringify(q.cards)}），滚动与均值图撤下：np-view=${q.marquee} th-wrap=${q.th}`);
}

/* ②③ 每个房间的画像由数据推导，不写死房间号：
   viewProfile.blocks 决定统计口径，unmanned 决定底栏出调度任务还是在制任务，
   有没有摄像头决定画面块，有没有资产决定标题写「设备」还是「资产」。
   同时把"切房间必须换数"钉死——上一轮实测过脏数据：102 挂着 107 的「4 条在制」。 */
const KIND={'task-stats':'任务统计','test-items':'检测项目数统计','samples':'样品台账'};
const ROOMS=['101','102','103','104','106','107'];
let prevGrid='';
for(const z of ROOMS){
  await gotoZone(p,z); await p.waitForTimeout(3400);
  const rr=await rects();
  const A=await p.evaluate(async(z)=>{
    const ts=(await TwinApi.get('/api/zone/'+z+'/task-stats')).data||{};
    const zs=(await TwinApi.get('/api/overview/zones')).data||[];
    const prof=(zs.filter(x=>x.zoneId==='Z-'+z)[0]||{}).viewProfile||{};
    return {blocks:prof.blocks||[],unmanned:prof.unmanned===true,period:'day',
      per:(ts.periods||{}).day||ts,ti:(ts.testItems||{}).day,samples:ts.samples||null,note:ts.note||null};},z);
  const D=await p.evaluate(()=>({
    kind:(document.getElementById('zsGrid')||{}).dataset?.kind||'',
    grid:(document.getElementById('zsGrid')||{}).innerText.replace(/\s+/g,' ').trim(),
    statsVis:(()=>{const e=document.getElementById('railZoneStats');if(!e)return 'absent';const q=e.getBoundingClientRect();return (q.width>2&&q.height>2)?'V':'H';})(),
    devsTitle:(document.getElementById('zDevsTitle')||{}).textContent||'',
    devsN:(document.getElementById('zDevsN')||{}).textContent||'',
    devRows:document.querySelectorAll('#zDevsList .zd-row').length,
    robots:document.querySelectorAll('#zDevsList [data-robot]').length,
    dkTitles:[...document.querySelectorAll('.dock .dk')].filter(e=>{const q=e.getBoundingClientRect();return q.width>2&&q.height>2;}).map(e=>e.querySelector('header b').innerText),
    camTiles:[...document.querySelectorAll('#camGrid .cam-tile')].filter(e=>{const q=e.getBoundingClientRect();return q.width>2&&q.height>2;}).length,
    camRooms:[...new Set([...document.querySelectorAll('#camGrid .cam-tile .rm')].map(e=>e.innerText.trim()))],
    stream:(document.querySelector('.stream-view')||{}).innerText?.replace(/\s+/g,' ').trim().slice(0,40)||'',
    nodesOut:[...document.querySelectorAll('#dkNodesTrack .nd-row')].filter(e=>e.getAttribute('aria-hidden')!=='true')
      .filter(e=>!e.innerText.replace(/\s+/g,'').startsWith(document.body.dataset.zone||'1')).map(e=>e.innerText.slice(0,10)),
  
    simpleFlag:document.body.dataset.zoneSimple||'0',
    cardN:document.querySelectorAll('.zn-card').length,
    cardsOk:[...document.querySelectorAll('.zn-card')].every(e=>e.querySelector('.zn-h b')&&e.querySelector('.tp')&&e.querySelector('.st')&&e.querySelector('.v')),
    railVis:(()=>{const e=document.querySelector('.rail');const q=e.getBoundingClientRect();return q.width>2&&q.height>2;})(),
    dockVis:(()=>{const e=document.querySelector('.dock');const q=e.getBoundingClientRect();return q.width>2&&q.height>2&&!e.hidden;})(),
    rcolVis:(()=>{const e=document.querySelector('#rightCol');const q=e.getBoundingClientRect();return q.width>2&&q.height>2&&!e.hidden;})(),
  }));
  /* ④（2026-11-09 四次圈图，101 接待厅）：极简房间（无统计口径 且 0 台建档设备）——
     左栏/底栏/右列整列收起，右下角只出节点卡（名称·类型/状态/数据）。空壳比没有更糟。
     判定在页面侧 zoneSimple() 数据驱动，测试侧独立复算同一条件并核对卡片集合。 */
  if(D.simpleFlag==='1'){
    const cfg=await p.evaluate(async()=>(await (await fetch('data/iot-nodes.json')).json()));
    const want=cfg.nodes.filter(n=>String(n.roomId)===z);
    out.push((!D.railVis&&!D.dockVis&&!D.rcolVis?'✅':'❌')+
      ` ${z} 极简房间：左栏/底栏/右列整列收起（rail=${D.railVis} dock=${D.dockVis} rcol=${D.rcolVis}）——红线撤掉的空壳一个不剩`);
    out.push((D.cardN===want.length&&D.cardsOk?'✅':'❌')+
      ` ${z} 右下角只留节点卡：${D.cardN} 张 == 配置里本房节点 ${want.length} 个，每张都有 名称/类型/状态/数据（合法=${D.cardsOk}）`);
    continue;
  }
  /* 期望口径 = blocks 里第一个带统计的块（顺序 task-stats > test-items > samples） */
  const wantKind = A.blocks.map(b=>KIND[b]).filter(Boolean)[0]||'';
  out.push((D.kind===wantKind?'✅':'❌')+` ${z} 统计口径随 viewProfile.blocks＝「${wantKind||'（无）'}」，屏上＝「${D.kind||'（无）'}」`);
  /* 数字必须与本区接口同源：把接口值按同一口径独立重算一遍再比 */
  if(wantKind==='任务统计'){
    /* ①（2026-11-09 10 点清单）：106 任务统计＝三子区域（委托/样品/试验项目），
       期望值不写死——从 /api/overview/entrust-list 用测试侧的独立实现重算（同源比对，
       文档 §3.3 的规矩：不接受写死的期望数字）。链条：本房间设备→state∈{done,testing} 的试验项→
       委托去重/样品去重；试验项目给「已完成+正在检测」两个数。 */
    const el=await p.evaluate(async()=>(await TwinApi.get('/api/overview/entrust-list')).data);
    const zz=z;
    const en={},sa={};let dn=0,ts=0;
    (el.records||[]).forEach(e=>{(e.items||[]).forEach(it=>{
      if(!it.cad||String(it.cad).slice(0,3)!==zz)return;
      if(it.state!=='done'&&it.state!=='testing')return;
      en[e.entrustNo]=1;
      const sid=it.sampleId||((e.samples||[e.sample])[0]||{}).id;
      if(sid)sa[sid]=1;
      it.state==='done'?dn++:ts++;});});
    /* ①（2026-11-10 圈图）：四块=委托/样品/试验项目/调度任务；样品拆「已完成检测·检测中」双色。
       重算按块对块，不扫全文数字。 */
    const saDone={},saTest={};
    (el.records||[]).forEach(e=>{(e.items||[]).forEach(it=>{
      if(!it.cad||String(it.cad).slice(0,3)!==zz)return;
      if(it.state!=='done'&&it.state!=='testing')return;
      const sid=it.sampleId||((e.samples||[e.sample])[0]||{}).id;
      if(!sid)return; (it.state==='done'?saDone:saTest)[sid]=1;});});
    const blocks=await p.evaluate(()=>[...document.querySelectorAll('#zsGrid .zs2-g')].map(e=>({
      t:(e.querySelector('.zs2-h span')||{}).innerText||'', v:(e.querySelector('.zs2-h b')||{}).innerText||'',
      d:(e.querySelector('.zs2-d')||e.querySelector('.zs2-p')||{}).innerText||'',
      bars:[...(e.querySelectorAll('.zs2-bar i')||[])].map(i=>Math.round(i.getBoundingClientRect().width))})));
    const expV=[String(Object.keys(en).length),String(Object.keys(sa).length),String(dn+ts)];   /* 试验项目头顶=合计（分解在下一行与分段条） */
    const gotV=blocks.slice(0,3).map(x=>x.v.replace(/\s+/g,''));
    out.push((blocks.length===4&&gotV.join('|')===expV.join('|')?'✅':'❌')+
      ` ${z} 前三块数值＝entrust-list 独立重算 ${expV.join('|')}（屏上 ${gotV.join('|')}），第四块=调度任务`);
    out.push((blocks[1]&&new RegExp('已完成检测\\s*'+Object.keys(saDone).length).test(blocks[1].d.replace(/\s+/g,m=>m))&&
      blocks[1].d.includes('检测中样品')&&blocks[1].bars.length===2?'✅':'❌')+
      ` ${z} 样品双色段：已完成检测 ${Object.keys(saDone).length} · 检测中样品 ${Object.keys(saTest).length}，条=${blocks[1]&&blocks[1].bars.length} 段`);
    out.push((blocks[3]&&blocks[3].t==='调度任务'?'✅':'❌')+' 第四块标题=调度任务（周期开关驱动的就是它）: '+blocks[3].d.replace(/\s+/g,' ').slice(0,44));
    out.push((/委托任务/.test(blocks[0].t)&&!/去重/.test(blocks.map(b=>b.d).join(''))?'✅':'❌')+' 「去重」文案已撤下屏（口径进 aria）');
    /* ⑥（2026-11-10 圈图，参考图二）：周期开关回到 106 标题行——它驱动「本周期」补充行（真数据），
       三子区域本身保持当前态不随周期动（动了就是编数）。 */
    {const per=await p.evaluate(async()=>{
      const segN=[...document.querySelectorAll('.period .seg')].filter(e=>{const q=e.getBoundingClientRect();return q.width>2&&q.height>2;}).length;
      const p0=document.querySelector('#zsGrid .zs2-p')?.innerText||'';
      const g0=[...document.querySelectorAll('#zsGrid .zs2-g')].slice(0,3).map(e=>(e.querySelector('.zs2-h b')||{}).innerText||'').join('|');
      document.querySelector('[data-period=month]').click();
      await new Promise(r=>setTimeout(r,1600));
      const p1=document.querySelector('#zsGrid .zs2-p')?.innerText||'';
      await new Promise(r=>setTimeout(r,200));const g1=[...document.querySelectorAll('#zsGrid .zs2-g')].slice(0,3).map(e=>(e.querySelector('.zs2-h b')||{}).innerText||'').join('|');
      document.querySelector('[data-period=day]').click();
      await new Promise(r=>setTimeout(r,1200));
      return {segN,p0,p1,g0,g1};});
      out.push((per.segN===3?'✅':'❌')+` ${z} 周期开关回到标题行（可见 ${per.segN} 个按钮，日/月/年一组）`);
      out.push((per.p0!==per.p1&&/已完成 \d+/.test(per.p0)?'✅':'❌')+` 开关驱动「调度任务」周期行：「${per.p0.slice(0,34)}」→「${per.p1.slice(0,34)}」`);
      out.push((per.g0===per.g1?'✅':'❌')+' 三子区域保持当前态、不随周期漂移（周期口径只进补充行）: '+per.g0);
    }
  } else if(wantKind==='检测项目数统计'){
    const exp=[A.ti.testing,A.ti.pending,A.ti.done,A.ti.overdue].join('/');
    const nums=(D.grid.match(/-?\d+/g)||[]).slice(0,4).join('/');
    out.push((nums===exp?'✅':'❌')+` ${z} 检测项目四格＝接口值（屏上 ${nums} vs API ${exp}）`);
    out.push((/逾期未完成/.test(D.grid)?'✅':'❌')+' '+z+' 逾期格写的是「逾期未完成」（出报告口径，2026-11-11 圈图改名），不是裸的「逾期」');
  } else if(wantKind==='样品台账'){
    const exp=[A.samples.stored,A.samples.receivedToday,A.samples.returnedToday,A.samples.pendingReturn].join('/');
    const nums=(D.grid.match(/-?\d+/g)||[]).slice(0,4).join('/');
    out.push((nums===exp?'✅':'❌')+` ${z} 样品台账四格＝接口值（屏上 ${nums} vs API ${exp}）`);
    const spSum=await p.evaluate(()=>[...document.querySelectorAll('#zsGrid .sp-nm')].reduce((a,e)=>a+(+((e.innerText.match(/(\d+) 支/)||[0,0])[1]||0)),0));
    out.push((spSum===A.samples.stored?'✅':'❌')+` ${z} 按名称分布合计＝在库存量（${spSum} vs ${A.samples.stored}）`);
  } else {
    out.push((/无任务与检测项目口径/.test(D.grid)?'✅':'❌')+` ${z} 没有统计口径就明说，不摆四个 0：「${D.grid.slice(0,32)}」`);
    out.push(((A.blocks.indexOf('env')>=0)===/环境数据见右列/.test(D.grid)?'✅':'❌')+` ${z} 空态文案与本区 blocks 一致（有 env 才指向右列）`);
  }
  out.push((!prevGrid||D.grid!==prevGrid||wantKind===''?'✅':'❌')+` ${z} 与上一个房间的统计不是同一份（脏数据回归防护）`);
  prevGrid=D.grid;
  /* 底栏：无人化区出调度任务，其他房间出在制任务，两者不得同时出现 */
  out.push(((A.unmanned?D.dkTitles.includes('无人化调度任务'):D.dkTitles.includes('运行中的任务'))?'✅':'❌')
    +` ${z} 底栏任务块按 unmanned=${A.unmanned} 出「${A.unmanned?'无人化调度任务':'运行中的任务'}」: ${JSON.stringify(D.dkTitles)}`);
  out.push((!(D.dkTitles.includes('无人化调度任务')&&D.dkTitles.includes('运行中的任务'))?'✅':'❌')
    +' '+z+' 同一批任务不会在底栏出现两遍: '+JSON.stringify(D.dkTitles));
  /* 设备/资产标题与条数、机器人只在 106、画面块只在有摄像头的房间 */
  const hasAsset=await p.evaluate(async(z)=>{const r=await TwinApi.get('/api/zone/'+z+'/devices');
    /* 资产不是第二份表：它就在 overview.devices 里带 asset:true，由 /api/zone/:z/devices 分成 devices/assets 两栏返回 */
    return ((r.data||{}).assets||[]).length>0;},z);
  out.push(((D.devsTitle==='资产')===hasAsset?'✅':'❌')+` ${z} 标题「${D.devsTitle}」与该区是否存在资产一致（assets=${hasAsset}）`);
  out.push((/^\d+ 台建档$/.test(D.devsN)||/ 台建档 · /.test(D.devsN)?'✅':'❌')+` ${z} 台数写法＝建档数（+机器人数）: ${D.devsN}`);
  out.push((D.robots===(z==='106'?2:0)?'✅':'❌')+` ${z} 左栏机器人行 ${D.robots} 行（只有 106 的复合机器人归本区，跨区不越界）`);
  out.push((D.camTiles===0||D.camRooms.every(x=>x.indexOf(z)>=0)?'✅':'❌')+` ${z} 画面块只列本房间摄像头: ${JSON.stringify(D.camRooms)}`);
  const emptyOk=!/无告警/.test(D.stream)||D.stream.indexOf(z+' 区今日无告警')>=0;
  out.push((emptyOk?'✅':'❌')+' '+z+' 无告警时空态说清是哪个区: 「'+D.stream+'」');
  out.push((!noOverlap(rr)?'✅':'❌')+` ${z} 浮层不重叠: ${noOverlap(rr)||'OK'}`);
}
/* ①②（2026-11-10 圈图，107/103）：非无人化房间版式守卫——
   底栏只剩「运行中的任务」钉最左；右列底部叠 场景监测→画面→组态物联（101 式等高卡）；
   没有非视觉节点的房间（103）组态物联整块消失，不挂空面板。 */
{
  await gotoZone(p,'107'); await p.waitForTimeout(3200);
  const a=await p.evaluate(()=>{const vis=id=>{const e=document.getElementById(id);return !!e&&!e.hidden&&e.getBoundingClientRect().width>2;};
    const inR=id=>{const e=document.getElementById(id);return vis(id)&&e.parentElement&&(e.parentElement.id==='rightCol'||e.parentElement.id==='zonePair');};
    const dk=document.querySelector('.dock').getBoundingClientRect();
    return {dkTitles:[...document.querySelectorAll('.dock .dk')].filter(e=>{const q=e.getBoundingClientRect();return q.width>2;}).map(e=>e.querySelector('header b').innerText),
      dkX:Math.round(dk.x),dkW:Math.round(dk.width),sc:inR('dkScenes'),iot:inR('iotPanel'),cam:inR('cctvBox'),
      cards:[...document.querySelectorAll('#dkNodesZone .zi-card')].map(e=>Math.round(e.getBoundingClientRect().height))};});
  out.push((a.dkTitles.join('|')==='运行中的任务'&&a.dkX<=16&&a.dkW>=290&&a.dkW<=310?'✅':'❌')+
    ` 107 底栏=运行中的任务钉最左（x${a.dkX} w${a.dkW}，与左栏同宽不叠影）: ${JSON.stringify(a.dkTitles)}`);
  out.push((a.sc&&a.iot&&!a.cam&&a.cards.length===1?'✅':'❌')+
    ` 107 右列底部上下叠：场景监测✓ 组态物联 101 式等高卡×${a.cards.length}（无摄像头画面块不出现）`);
  await gotoZone(p,'103'); await p.waitForTimeout(3200);
  const c=await p.evaluate(()=>{const vis=id=>{const e=document.getElementById(id);return !!e&&!e.hidden&&e.getBoundingClientRect().width>2;};
    const inR=id=>{const e=document.getElementById(id);return vis(id)&&e.parentElement&&(e.parentElement.id==='rightCol'||e.parentElement.id==='zonePair');};
    const tile=document.querySelector('#camGrid .cam-tile')?.getBoundingClientRect();
    const grid=document.querySelector('#camGrid')?.getBoundingClientRect();
    return {sc:inR('dkScenes'),cam:inR('cctvBox'),iot:vis('iotPanel'),
      tileW:tile?Math.round(tile.width):0,gridW:grid?Math.round(grid.width):0,
      camY:Math.round(document.querySelector('#cctvBox').getBoundingClientRect().y),scY:Math.round(document.querySelector('#dkScenes').getBoundingClientRect().y)};});
  out.push((c.sc&&c.cam&&!c.iot?'✅':'❌')+
    ` 103 右列底部上下叠：场景监测(上 y${c.scY}) → 画面(下 y${c.camY})；无非视觉节点 → 组态物联整块消失（不挂空面板）`);
  out.push((c.tileW>=c.gridW-26?'✅':'❌')+` 103 单路画面占满右列宽：格 ${c.tileW} ≥ 网格内容 ${c.gridW-24}`);

  /* ①②③（2026-11-10 圈图，102/105/108/109/110）：逐房间的卡集合 + 监控按钮按房间出没 +
     待布点场景=关闭 + 第二行左右分栏（105）+ 回总览构图不许缩（缓存键 bug 守卫）。 */
  const ROOMSET={'102':{iot:1,cam:0,mon:0,sc:1,scSt:'关闭'},'105':{iot:1,cam:1,mon:1,sc:1,pair:1},'108':{iot:2,cam:0,mon:0,sc:1},'109':{iot:0,cam:1,mon:1,sc:0},'110':{iot:1,cam:0,mon:0,sc:0}};
  /* 基线要钉稳：点 S1 按钮（键盘 '1' 会被聚焦控件吃掉——typeahead 抢键是真回归，
     但守卫不该依赖按键），再轮询到补间落定（fr 连续两次一致）才量。 */
  const s1fr=async()=>{
    await p.click('.mode[data-mode=S1]');
    let prev='',cur='';
    for(let k=0;k<14;k++){ await p.waitForTimeout(700);
      cur=await f.evaluate(()=>{const hk=document.getElementById('twin-v2-bridge');const c=JSON.parse((hk&&hk.dataset.cam)||'{}');
        const v=window.visual106,TH=v.overview.position.constructor,hh=v.renderer.domElement.getBoundingClientRect();
        let lx=1e9,rx=-1e9;for(const r of (v.g.rooms||[]))for(const pt of (r.points||[]))for(const y of [0,2.85]){const q=new TH(pt[0]*.05,y,pt[1]*.05).project(v.camera);if(q.z>1)continue;lx=Math.min(lx,(q.x*.5+.5)*hh.width);rx=Math.max(rx,(q.x*.5+.5)*hh.width);}
        return JSON.stringify({fr:c.fr,w:Math.round(rx-lx),view:v.view});});
      if(cur===prev)break; prev=cur; }
    return JSON.parse(cur);};
  const s0=await s1fr();
  for(const [z,exp] of Object.entries(ROOMSET)){
    await gotoZone(p,z); await p.waitForTimeout(3200);
    const r=await p.evaluate(()=>{const vis=id=>{const e=document.getElementById(id);return !!e&&!e.hidden&&e.getBoundingClientRect().width>2;};
      const cam=document.getElementById('cctvBox').getBoundingClientRect(), iot=document.getElementById('iotPanel').getBoundingClientRect();
      /* 2026-11-11 圈图两条：① 组态物联独占第二行时（本房间无摄像头画面块）必须铺满整行，
            卡宽＝头顶场景卡宽；② 「运行中的任务」空态那一行不许被 dkUp 无缝滚动顶出容器上沿。 */
      const scCard=document.querySelector('#dkScenesGrid > *')?.getBoundingClientRect();
      const card=document.querySelector('#dkNodesZone .zi-card')?.getBoundingClientRect();
      const trk=document.getElementById('dkRunningTrack'), v0=trk?.closest('.dk-view')?.getBoundingClientRect();
      const rowE=trk?.firstElementChild, row0=rowE?.getBoundingClientRect();
      return {iot:vis('iotPanel'),cam:vis('cctvBox'),mon:vis('cctvToggle'),sc:vis('dkScenes'),
        cards:document.querySelectorAll('#dkNodesZone .zi-card').length,
        scSt:(document.querySelector('#dkScenesGrid .st')||{}).innerText||'',
        sameRow:Math.abs(cam.y-iot.y)<4&&cam.x<iot.x,
        iotW:Math.round(iot.width),cardW:card?Math.round(card.width):0,scCardW:scCard?Math.round(scCard.width):0,
        rcW:Math.round(document.getElementById('rightCol').getBoundingClientRect().width),
        empty:!!(rowE&&/无在制任务/.test(rowE.innerText)),
        anim:trk?getComputedStyle(trk).animationName:'-',
        clipTop:row0&&v0?Math.round(v0.top-row0.top):-1};});
    out.push((r.iot===(exp.iot>0)&&r.cam===(exp.cam>0)&&r.mon===!!exp.mon&&r.sc===(exp.sc>0)&&(!exp.iot||r.cards===exp.iot)?'✅':'❌')+
      ` ${z} 块集合对圈图：物联${exp.iot}卡/画面${exp.cam?'现':'隐'}/监控按钮${exp.mon?'显':'隐'}/场景${exp.sc?'现':'隐'}（屏上 cards=${r.cards}）`);
    if(exp.scSt) out.push((r.scSt===exp.scSt?'✅':'❌')+` ${z} 待布点场景状态=「${exp.scSt}」（不是借绿点冒充正常）: 屏上「${r.scSt}」`);
    if(exp.pair) out.push((r.sameRow?'✅':'❌')+' 105 第二行左右挨着：画面与组态物联同行（cam 左 iot 右）');
    /* ① 组态物联宽度：画面块在场=二分一行；只剩它一个=独占整行，卡宽与头顶场景卡齐平。
       （从前 .rcol .nodepanel{flex:none} 在横排的 .zpair 里把宽度也钉成内容宽，102 只有 163px。） */
    if(exp.iot>0&&exp.sc>0){
      const wantW=exp.cam>0?Math.floor((r.rcW-16)/2):r.scCardW;
      out.push((Math.abs(r.cardW-wantW)<=Math.max(6,exp.cam>0?70:2)?'✅':'❌')+
        ` ${z} 组态物联卡宽 ${r.cardW}＝${exp.cam>0?'与画面二分一行':'独占整行、与场景卡同宽'}（场景卡 ${r.scCardW}，右列 ${r.rcW}）`);
    }
    /* ② 空态行不许上漂：animation 必须 none，行顶不得高于容器可视顶（负值=被裁） */
    if(r.empty) out.push((r.anim==='none'&&r.clipTop<=0&&r.clipTop>-2?'✅':'❌')+
      ` ${z} 「运行中的任务」空态钉在原位：animation=${r.anim}，行顶相对容器上沿 ${r.clipTop}px（>0 即被裁半截）`);
  }
  const backRaw=await s1fr();
  const diag=await p.evaluate(()=>({sw:getComputedStyle(document.documentElement).getPropertyValue('--tw-stream-w').trim(),
    rcw:Math.round(document.getElementById('rightCol').getBoundingClientRect().width),
    railW:Math.round(document.querySelector('.rail').getBoundingClientRect().width),
    dkHidden:document.getElementById('taskStrip').hidden,dkW:Math.round(document.getElementById('taskStrip').getBoundingClientRect().width),
    iotW:Math.round(document.getElementById('iotPanel').getBoundingClientRect().width),
    iotHidden:document.getElementById('iotPanel').hidden,
    simple:document.body.dataset.zoneSimple,zoneView:document.body.dataset.zoneView}));
  out.push((s0.view==='overall-101'&&backRaw.view==='overall-101'&&Math.abs(backRaw.w-s0.w)<=12&&Math.abs(backRaw.fr-s0.fr)<0.01?'✅':'❌')+
    ` 房间来回后回总览构图不缩（fitOverview 缓存键含视锥身份的守卫）：${s0.w}px/fr${s0.fr} → ${backRaw.w}px/fr${backRaw.fr} @ ${JSON.stringify(diag)}`);
}

/* ⑤ 周期切换器（2026-11-10 ⑥ 后）：106 标题行重新挂上日/月/年——驱动「本周期」行；
   同屏仍只有一份可见开关（≤3 个按钮）。 */
await gotoZone(p, '106'); await p.waitForTimeout(3000);
const segN=await p.evaluate(()=>[...document.querySelectorAll('.period .seg')].filter(e=>{const q=e.getBoundingClientRect();return q.width>2&&q.height>2;}).length);
out.push((segN<=3?'✅':'❌')+` 同屏最多一份可见周期开关（当前 ${segN} 个按钮）`);
const stDay=await p.evaluate(()=>document.getElementById('zsGrid').innerText.replace(/\s+/g,' ').trim());
out.push((/委托任务/.test(stDay)&&/调度任务/.test(stDay)&&/已完成 \d+/.test(stDay)?'✅':'❌')+' 106 左栏统计＝三子区域＋调度任务块: '+stDay.slice(0,58));
/* 非 106 房间也一样：检测项目数统计是按周期变的，开关不能只对着 106 生效 */
await gotoZone(p, '103'); await p.waitForTimeout(3000);
const g1=await p.evaluate(()=>document.getElementById('zsGrid').innerText.replace(/\s+/g,' ').trim());
await p.locator('[data-period=year]:visible').first().click(); await p.waitForTimeout(1800);
const g2=await p.evaluate(()=>({grid:document.getElementById('zsGrid').innerText.replace(/\s+/g,' ').trim(),
  per:new URLSearchParams(location.search).get('period')}));
out.push((g1!==g2.grid&&g2.per==='year'?'✅':'❌')+' 103（非 106）周期切换真的换数并写进 URL: '+g1.slice(0,24)+' → '+g2.grid.slice(0,24));
await p.locator('[data-period=day]:visible').first().click(); await p.waitForTimeout(1000);
await gotoZone(p, '101'); await p.waitForTimeout(2600);
out.push(((await p.evaluate(()=>{const e=document.querySelector('#railZoneStats .period');if(!e)return true;
  const q=e.getBoundingClientRect();return !(q.width>2&&q.height>2);}))?'✅':'❌')+' 101 没有按周期变的块，周期开关不占位');
await gotoZone(p, '106'); await p.waitForTimeout(3000);

// 画像来自数据而非写死：改 seed 里的 blocks 应立刻反映（用 API 校验一致性）
const prof=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/zones');
  return r.data.map(z=>z.zoneId+':'+(z.viewProfile?z.viewProfile.blocks.join('+'):'none')).join(' | ');});
out.push((prof.indexOf('Z-101:env')>=0&&prof.indexOf('Z-102:devices+samples+env+alarms')>=0?'✅':'❌')+' 画像是数据（seed.overview.zones[].viewProfile）: '+prof.slice(0,120));
/* ⑥⑦⑧⑨（2026-11-11 圈图）：106 指标组与线段拉满整栏 + 调度任务补条 + 逾期>0 标红 +
   没有场景块的房间（109/110）第二行照样沉底 + 换视图不泄漏节点卡 + 刷新回到实验室总览。 */
{
  await gotoZone(p,'106'); await p.waitForTimeout(3200);
  const q=await p.evaluate(()=>{const W=e=>e?Math.round(e.getBoundingClientRect().width):0;
    const gs=[...document.querySelectorAll('#zsGrid .zs2-g')];
    return {gW:gs.map(g=>W(g)),bar:gs.map(g=>W(g.querySelector('.zs2-bar'))),
      segN:gs.map(g=>g.querySelectorAll('.zs2-bar i').length),dev:W(document.querySelector('#zDevsList .zd-row'))};});
  out.push((q.gW.length===4&&q.gW.every(v=>Math.abs(v-q.dev)<=2)?'✅':'❌')+
    ` 106 任务统计四组与「设备」同宽（组=${JSON.stringify(q.gW)} 设备行=${q.dev}）`);
  out.push((q.bar.every(v=>Math.abs(v-q.dev)<=2)?'✅':'❌')+` 106 四条线段铺满整栏（条=${JSON.stringify(q.bar)}）`);
  out.push((q.segN[3]>=1?'✅':'❌')+` 106 调度任务补了分段条（段数 ${q.segN[3]}：已完成/执行中/异常挂起/排队）`);
  await gotoZone(p,'109'); await p.waitForTimeout(3200);
  const sn=await p.evaluate(()=>{const vis=e=>e&&!e.hidden&&e.getBoundingClientRect().width>2;
    const kids=[...document.getElementById('rightCol').children].filter(vis);
    return {n:kids.length,bottom:Math.round(kids[kids.length-1].getBoundingClientRect().bottom),vh:innerHeight};});
  out.push((Math.abs(sn.vh-sn.bottom-16)<=3?'✅':'❌')+
    ` 109 无场景块也沉到屏底（最后一块底边 ${sn.bottom} vs 视口 ${sn.vh}-16，右列可见 ${sn.n} 块）`);
  const ov=async(z)=>{await gotoZone(p,z);await p.waitForTimeout(3000);return p.evaluate(()=>{
    const c=[...document.querySelectorAll('#zsGrid .zs-i')].find(e=>/逾期未完成/.test(e.innerText));
    if(!c)return null;return {txt:c.innerText.replace(/\s+/g,''),bad:c.classList.contains('bad'),
      color:getComputedStyle(c.querySelector('b')).color};});};
  const o103=await ov('103'), o109=await ov('109');
  out.push((o103&&o103.bad&&o103.color!==o109.color?'✅':'❌')+` 103 逾期未完成 >0 标红: ${JSON.stringify(o103)}`);
  out.push((o109&&!o109.bad?'✅':'❌')+` 109 逾期=0 不染告警色（0 不是坏消息）: ${JSON.stringify(o109)}`);
  /* 弹窗 ×：卡片不许压住宿主浮层，压住以后 × 归宿主管、点它没反应（1680 宽实测复现） */
  await p.setViewportSize({width:1680,height:1000}); await p.waitForTimeout(1200);
  await gotoZone(p,'107'); await p.waitForTimeout(3200);
  {
    const fr=p.frames().find(x=>/tour-space/.test(x.url()));
    await fr.evaluate(()=>{const m=[...document.querySelectorAll('.node-marker')].find(x=>!x.hidden&&x.getBoundingClientRect().width>2);m.click();});
    await p.waitForTimeout(1300);
    const g=await fr.evaluate(()=>{const c=document.querySelector('#iot-layer .node-card'),x=c.querySelector('.card-close');
      const r=x.getBoundingClientRect(),cr=c.getBoundingClientRect();
      return {cx:Math.round(r.x+r.width/2),cy:Math.round(r.y+r.height/2),
        card:[Math.round(cr.x),Math.round(cr.y),Math.round(cr.right),Math.round(cr.bottom)]};});
    const hit=await p.evaluate(({cx,cy})=>{const fe=document.getElementById('scene').getBoundingClientRect();
      const t=document.elementFromPoint(fe.x+cx,fe.y+cy);return t?t.tagName+'.'+(t.className||''):null;},g);
    const fe=await p.locator('#scene').boundingBox();
    await p.mouse.click(fe.x+g.cx,fe.y+g.cy); await p.waitForTimeout(1500);
    const closed=await fr.evaluate(()=>document.querySelector('#iot-layer .node-card').hidden);
    out.push((closed&&/IFRAME/.test(hit)?'✅':'❌')+
      ` 1680 宽 107 点 × 真能关掉：卡位 ${JSON.stringify(g.card)}，× 命中 ${hit}，关=${closed}`);
    /* 回总览：房间专属的节点卡（宿主 101 那组 + 场景里那张）都不许留在屏上 */
    await p.setViewportSize({width:1920,height:1080}); await p.waitForTimeout(1500);
  }
  await gotoZone(p,'101'); await p.waitForTimeout(3200);
  const znIn=await p.evaluate(()=>!document.getElementById('zoneNodes').hidden);
  await p.click('.mode[data-mode=S1]'); await p.waitForTimeout(3500);
  const znBack=await p.evaluate(()=>({hidden:document.getElementById('zoneNodes').hidden,n:document.querySelectorAll('#zoneNodes .zn-card').length}));
  out.push((znIn&&znBack.hidden?'✅':'❌')+` 101 回总览收掉右下角节点卡（房内出卡=${znIn}，回总览 hidden=${znBack.hidden}，残留 ${znBack.n} 张）`);
  await gotoZone(p,'104'); await p.waitForTimeout(3200);
  {
    const fr=p.frames().find(x=>/tour-space/.test(x.url()));
    await fr.evaluate(()=>{const m=[...document.querySelectorAll('.node-marker')].find(x=>!x.hidden&&x.getBoundingClientRect().width>2);if(m)m.click();});
    await p.waitForTimeout(1300);
    const opened=await fr.evaluate(()=>!document.querySelector('#iot-layer .node-card').hidden);
    await p.click('.mode[data-mode=S1]'); await p.waitForTimeout(3500);
    const shut=await fr.evaluate(()=>document.querySelector('#iot-layer .node-card').hidden);
    out.push((opened&&shut?'✅':'❌')+` 换视图把场景里的节点卡一起收（104 开=${opened} → 回总览关=${shut}）`);
  }
  /* 刷新 = 实验室总览（周期/图层这些演示设置仍从 URL 恢复，见 collapsec/filtercheck） */
  await gotoZone(p,'107'); await p.waitForTimeout(3000);
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(14000);
  const rl=await p.evaluate(()=>({active:[...document.querySelectorAll('.mode')].filter(e=>e.classList.contains('active')).map(e=>e.dataset.mode||e.dataset.level),
    roomWrapHidden:document.getElementById('roomWrap').hidden,mode:new URLSearchParams(location.search).get('mode')}));
  out.push((rl.active.includes('S1')&&rl.roomWrapHidden&&rl.mode==='S1'?'✅':'❌')+
    ` 刷新后回到「实验室总览」选中态: ${JSON.stringify(rl)}`);
}
/* ⑦⑧⑨⑩（2026-11-11 二次圈图）：极简房间块标题 / 106 画面标题不折行 /
   下钻只留本房间的设备光点与航路点 / 全屏不再多一层板 */
{
  for (const z of ['101', '104']) {
    await gotoZone(p, z); await p.waitForTimeout(3200);
    const a = await p.evaluate(() => {
      const t = document.querySelector('#zoneNodes .zn-title'), c0 = document.querySelector('#zoneNodes .zn-card');
      if (!t || !c0) return { t: null };
      const tr = t.getBoundingClientRect(), cr = c0.getBoundingClientRect();
      return { t: t.innerText.replace(/\s+/g, ' '), gap: Math.round(cr.top - tr.bottom),
        w: Math.round(tr.width), cw: Math.round(cr.width), cards: document.querySelectorAll('#zoneNodes .zn-card').length };
    });
    out.push((a.t && /^组态物联节点状态监测 \d+ 个点位$/.test(a.t) && a.gap > 0 && a.gap <= 16 && Math.abs(a.w - a.cw) <= 2 ? '✅' : '❌') +
      ` ${z} 右下角有块标题「组态物联节点状态监测 · N 个点位」，卡片在标题下方且同宽: ${JSON.stringify(a)}`);
  }
  await gotoZone(p, '106'); await p.waitForTimeout(3600);
  const c = await p.evaluate(() => {
    const h = document.querySelector('#cctvBox > header'); if (!h) return null;
    const b = h.querySelector('b').getBoundingClientRect(), s2 = h.querySelector('.src').getBoundingClientRect();
    return { title: h.querySelector('b').innerText, src: h.querySelector('.src').innerText,
      sameLine: Math.abs(b.top - s2.top) < 6, h: Math.round(h.getBoundingClientRect().height) };
  });
  out.push((c && c.sameLine && c.h <= 24 ? '✅' : '❌') +
    ` 106 画面块标题与「N 路 · 房间」各占一行不折断: ${JSON.stringify(c)}`);
  {
    const fr = p.frames().find(x => /tour-space/.test(x.url()));
    const d = await fr.evaluate(() => {
      const v = window.visual106, V3 = v.camera.position.constructor, w = new V3();
      const rooms = (v.g.rooms || []).filter(r => /^\d{3}$/.test(String(r.id || r.name)))
        .map(r => ({ id: String(r.id || r.name), pts: r.points.map(q => [q[0] * .05, q[1] * .05]) }));
      const pip = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const x1 = pts[i][0], z1 = pts[i][1], x2 = pts[j][0], z2 = pts[j][1]; if ((z1 > z) !== (z2 > z) && x < (x2 - x1) * (z - z1) / (z2 - z1) + x1) c = !c; } return c; };
      const own = (x, z) => { const r = rooms.find(q => pip(x, z, q.pts)); return r ? r.id : ''; };
      const dots = []; let knOut = 0, knVis = 0, knHid = 0;
      v.scene.traverse(o => {
        const g = o.geometry; if (!g) return;
        if (o.visible && /Sphere/.test(g.type)) { o.getWorldPosition(w); dots.push(own(w.x, w.z)); }
        if (g && /^Circle/.test(g.type) && o.userData && o.userData.knotRoom !== undefined) {
          if (o.visible) { knVis++; if (o.userData.knotRoom && o.userData.knotRoom !== '106') knOut++; } else knHid++; }
      });
      return { view: v.view, dots, knVis, knOut, knHid };
    });
    const stray = d.dots.filter(r => r && r !== '106').length;
    out.push((/^close|^106/.test(d.view) && d.dots.length > 0 && stray === 0 ? '✅' : '❌') +
      ` 106 画面里的设备光点全部落在 106 地界（可见 ${d.dots.length} 个，飘在别房间的 ${stray} 个——含停在 102-05 充电位的那台机器人）`);
    out.push((d.knOut === 0 && d.knHid > 0 ? '✅' : '❌') +
      ` 106 画面里的 AGV 航路点只留本房间的（可见 ${d.knVis}、别房间 0、收起 ${d.knHid}）`);
    /* 回总览必须全部还原：收起来是为了房间画面干净，不是把全场数据弄丢 */
    await p.click('.mode[data-mode=S1]'); await p.waitForTimeout(4000);
    const back = await fr.evaluate(() => {
      const v = window.visual106; let dots = 0, kn = 0, knHid = 0;
      v.scene.traverse(o => { const g = o.geometry; if (!g) return;
        if (o.visible && /Sphere/.test(g.type)) dots++;
        if (/^Circle/.test(g.type) && o.userData && o.userData.knotRoom !== undefined) { if (o.visible) kn++; else knHid++; } });
      return { dots, kn, knHid };
    });
    out.push((back.dots > d.dots.length && back.knHid === 0 ? '✅' : '❌') +
      ` 回总览光点与航路点全部还原（光点 ${back.dots} > 房内 ${d.dots.length}，航路点收起 ${back.knHid}）`);
  }
  /* 全屏：透明浮层配大投影=中间多一层板。全屏只改尺寸，不改层。 */
  await p.evaluate(() => { document.body.dataset.full = '1'; }); await p.waitForTimeout(700);
  const sh = await p.evaluate(() => ['.rail', '.stream', '.tasktable'].map(sel => {
    const e = document.querySelector(sel); return e ? getComputedStyle(e).boxShadow : 'no-el'; }));
  await p.evaluate(() => { document.body.dataset.full = '0'; }); await p.waitForTimeout(400);
  /* .tasktable 在这张页面上本来就没有（旧版遗留选择器），缺元素不算违规 */
  out.push((sh.filter(v => v !== 'no-el').every(v => v === 'none') ? '✅' : '❌') + ` 全屏态左栏/告警流/任务表都没有多出来的一层板: ${JSON.stringify(sh)}`);
}
await gotoZone(p, '106'); await p.waitForTimeout(3000);
await p.screenshot({path:'/tmp/twin-qa/zoneview-106.png'});
await p.keyboard.press('1'); await p.waitForTimeout(3000); await p.screenshot({path:'/tmp/twin-qa/zoneview-s1.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
