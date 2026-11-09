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
  /* ⑩ 图的口径：切走再切回，抓 temp-hum-series 的请求参数——
     from= 的点位集合必须 == 底栏本房间温湿度行的节点 id；temp/hum 参数 == 那些读数的均值。
     「图与表同源」在房间视图的同一条断言，不接受 lab-avg 混进来顶替。 */
  /* TwinApi 是进程内 mock——/api/... 根本不走网络，page.on('request') 抓不到任何东西。
     直接挂钩 TwinApi.get：回总览一次（lab-avg）+ 进 106 一次（avg-106），最后一条必是房间口径。 */
  await p.evaluate(()=>{ if(!window.__thHook){ window.__thReq=[]; const g=window.TwinApi.get.bind(window.TwinApi);
    window.TwinApi.get=u=>{ if(String(u).includes('temp-hum-series')) window.__thReq.push(String(u)); return g(u); }; } return 'hooked'; });
  await p.keyboard.press('1'); await p.waitForTimeout(2800);
  await gotoZone(p, '106'); await p.waitForTimeout(3400);
  const reqs = await p.evaluate(()=>window.__thReq||[]);
  const last = reqs[reqs.length - 1] || '';
  const q = new URLSearchParams((last.split('?')[1] || ''));
  const ids = (q.get('from') || '').split(',').filter(Boolean);
  const wantIds = A.rows.map(r => r.id).sort().join(',');
  const meanT = A.rows.length ? Math.round(A.rows.reduce((a, r) => a + r.t, 0) / A.rows.length * 10) / 10 : NaN;
  const meanH = A.rows.length ? Math.round(A.rows.reduce((a, r) => a + r.h, 0) / A.rows.length * 10) / 10 : NaN;
  /* 快照每 5s 重抖一次（±0.3/点位）：请求发出与行读数分属两拍，均值最大可差 0.6——
     容差按这个物理量给（0.65），集合与 node= 的判据不放宽。 */
  const thOk = q.get('node') === 'avg-106' && ids.sort().join(',') === wantIds
    && Math.abs(+q.get('temp') - meanT) <= 0.65 && Math.abs(+q.get('hum') - meanH) <= 0.65;
  out.push((thOk ? '✅' : '❌')
    + ` ⑩ 106 组态物联图=本房间点位均值（不再挂全场 lab-avg）：node=${q.get('node')} · from=${ids.length} 点位与底栏行同集合 · temp ${q.get('temp')}==均值 ${meanT} · hum ${q.get('hum')}==${meanH}`);
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
    const exp=[Object.keys(en).length,Object.keys(sa).length,dn,ts].join('/');
    const nums=(D.grid.match(/-?\d+/g)||[]).slice(0,4).join('/');
    out.push((nums===exp?'✅':'❌')+` ${z} 三子区域＝entrust-list 独立重算（屏上 ${nums} vs 复算 ${exp}=委托/样品/已完成/正在检测）`);
    out.push((/委托任务/.test(D.grid)&&/关联/.test(D.grid)&&/样品/.test(D.grid)&&/试验项目/.test(D.grid)?'✅':'❌')+
      ` ${z} 三子区域标题与口径说明在屏上（不是四个裸数字）: ${D.grid.replace(/\s+/g,' ').slice(0,64)}`);
    out.push((await p.evaluate(()=>{const b=[...document.querySelectorAll('.period .seg')].filter(e=>{const q=e.getBoundingClientRect();return q.width>2&&q.height>2;});return b.length;}))===0?
      '✅':'❌'+' '+z+' 三子区域是当前态口径，周期开关必须隐身（点了不动数的控件比没有控件更糟）');
  } else if(wantKind==='检测项目数统计'){
    const exp=[A.ti.testing,A.ti.pending,A.ti.done,A.ti.overdue].join('/');
    const nums=(D.grid.match(/-?\d+/g)||[]).slice(0,4).join('/');
    out.push((nums===exp?'✅':'❌')+` ${z} 检测项目四格＝接口值（屏上 ${nums} vs API ${exp}）`);
    out.push((/逾期未出/.test(D.grid)?'✅':'❌')+' '+z+' 逾期格写的是「逾期未出」（出报告口径），不是裸的「逾期」');
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
/* ⑤ 周期切换器（2026-11-09 #1 后）：106 三子区域是当前态口径，左栏周期开关在 106 隐身；
   开关本体仍由 103（检测项目数按周期变）验证驱动与 URL 写入。 */
await gotoZone(p, '106'); await p.waitForTimeout(3000);
const segN=await p.evaluate(()=>[...document.querySelectorAll('.period .seg')].filter(e=>{const q=e.getBoundingClientRect();return q.width>2&&q.height>2;}).length);
out.push((segN===0?'✅':'❌')+` 106 三子区域不挂周期开关（可见按钮 ${segN} 个，应为 0——旧「≤3」是四格时代的口径）`);
const stDay=await p.evaluate(()=>document.getElementById('zsGrid').innerText.replace(/\s+/g,' ').trim());
out.push((/委托任务/.test(stDay)?'✅':'❌')+' 106 左栏统计仍是三子区域: '+stDay.slice(0,42));
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
await gotoZone(p, '106'); await p.waitForTimeout(3000);
await p.screenshot({path:'/tmp/twin-qa/zoneview-106.png'});
await p.keyboard.press('1'); await p.waitForTimeout(3000); await p.screenshot({path:'/tmp/twin-qa/zoneview-s1.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
