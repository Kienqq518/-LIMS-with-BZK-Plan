/**
 * 下钻画像与浮层间距（2026-11-06 产品负责人反馈）
 *  ① 106 下钻后：机器人仍在走、底栏任务队列仍在跑（不能一切房间就没任务信息了）
 *  ② 非 106 下钻：左栏四张表隐藏，只留右侧面板
 *  ③ 统计口径按房间分：106 任务四格 / 其他试验区检测项目数 / 102 样品台账 / 101 只有环境数据 / 104 无统计块
 *  ④ 所有浮层之间必须有间距，不许重叠（历史上 dock left:180 与左栏 238 重叠 58px）
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
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
  return {rail:R('.rail'),stream:R('.stream'),panel:R('#zonePanel'),dock:R('.dock')};
});
const noOverlap=(o)=>{const vis=Object.entries(o).filter(([,v])=>v&&v!=='hidden');
  for(let i=0;i<vis.length;i++)for(let j=i+1;j<vis.length;j++){
    const a=vis[i][1],c=vis[j][1];
    const xOverlap=Math.min(a.r,c.r)-Math.max(a.x,c.x), yOverlap=Math.min(a.b,c.b)-Math.max(a.y,c.y);
    if(xOverlap>0&&yOverlap>0) return vis[i][0]+' × '+vis[j][0]+' 重叠 '+xOverlap+'px';
  } return '';};

// ④ S1 间距
let r=await rects();
out.push((!noOverlap(r)?'✅':'❌')+' S1 四块浮层互不重叠: '+JSON.stringify(r)+' '+noOverlap(r));
out.push((r.dock.x-r.rail.r>=12?'✅':'❌')+` 底栏与左栏之间有 ${r.dock.x-r.rail.r}px 沟槽（旧值：底栏 left:180 压在左栏 238 上）`);
out.push((r.stream.x-r.dock.r>=12?'✅':'❌')+` 底栏与右侧告警流之间有 ${r.stream.x-r.dock.r}px 沟槽`);
const inner=await p.evaluate(()=>[...document.querySelectorAll('.dock .dk')].map(e=>Math.round(e.getBoundingClientRect().x)));
out.push((inner[1]-inner[0]>0&&inner.every((x,i)=>i===0||x>inner[i-1])?'✅':'❌')+' 底栏四块之间也有间距: 起点 '+JSON.stringify(inner));

// ① 106 下钻
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(3200);
r=await rects();
out.push((!noOverlap(r)?'✅':'❌')+' 106 下钻后浮层仍互不重叠: '+noOverlap(r));
out.push(((r.dock&&r.dock!=='hidden')?'✅':'❌')+' 106 下钻后底栏仍在（任务队列继续走）: '+JSON.stringify(r.dock));
/* FR-42 重排后 106 的左栏整块不再出现：AGV 与任务在底栏（dock:true），
   设备状态在区域面板里已有，左栏留着就是空壳。周期切换器搬进面板头部。 */
out.push(((r.rail==='hidden')?'✅':'❌')+' 106 下钻后左栏整块隐藏（不再留空壳；AGV 与任务在底栏）: '+JSON.stringify(r.rail));
const m106=await p.evaluate(()=>{const rp=document.querySelector('.railpanel'),cy=document.getElementById('cycleBox'),pp=document.getElementById('zpPeriod');
  const vis=e=>!!e&&e.offsetParent!==null&&getComputedStyle(e).display!=='none';
  return {panel:vis(rp),cycle:vis(cy),zpPeriod:vis(pp),flag:document.body.dataset.zoneMetrics};});
out.push((m106.panel===false&&m106.cycle===true&&m106.flag==='0'?'✅':'❌')+' 106 撤掉左侧指标面板、AGV 任务行仍在底栏（与右侧面板不重复）: '+JSON.stringify(m106));
out.push((m106.zpPeriod===true?'✅':'❌')+' 周期切换器随指标面板搬进区域面板（否则 106 的本日/本月/本年没人能点）');
/* 观察窗必须覆盖「一次停靠 + 一段行走」：剧本最长 dwell 9s，原来只看 6s，
   整窗落进停靠段就报「机器人没走」——那是假失败（2026-11-07 全量踩到，位移 0.00m）。
   改成轮询到出现位移即早退，最长 24s（≈ 一圈里最长的停靠 + 跨站行走）。 */
const robPos=()=>f.evaluate(()=>{const m=window.visual106.modelRoots.get('106-08');return m?[+m.position.x.toFixed(3),+m.position.z.toFixed(3)]:null;});
const pos0=await robPos(); let pos1=pos0, moved=0; const tEnd=Date.now()+24000;
while (Date.now()<tEnd) { await p.waitForTimeout(2500); pos1=await robPos(); moved=Math.hypot(pos1[0]-pos0[0],pos1[1]-pos0[1]); if (moved>0.3) break; }
out.push((moved>0.3?'✅':'❌')+` 106 下钻后机器人仍在行进（≤24s 观察窗内位移 ${moved.toFixed(2)}m，含停靠段）`);
const live=await p.evaluate(async()=>{const x=await TwinApi.get('/api/zone/106/cycle');return x.data.live.order+'/'+x.data.live.total+' '+x.data.live.phase;});
out.push(((live.split(' ')[1]==='travel'||live.indexOf('dwell')>0)?'✅':'❌')+' 任务也在推进: '+live);
const blocks106=await p.evaluate(()=>[...document.querySelectorAll('#zonePanel .zp-scroll > section')].filter(e=>!e.hidden).map(e=>e.querySelector('h4').innerText.split('\n')[0].trim()));
out.push((blocks106.join('|')==='设备|环境数据|任务统计|正在运行的任务|告警'?'✅':'❌')+' 106 五类信息齐全: '+blocks106.join(' / '));

// ② 非 106 房间
const CASES={
  '101':{blocks:['环境数据'],rail:false,dock:false},
  '102':{blocks:['设备','环境数据','样品台账','告警'],rail:false,dock:false},
  '103':{blocks:['设备','环境数据','检测项目数统计','告警'],rail:false,dock:false},
  '104':{blocks:['设备','环境数据','告警'],rail:false,dock:false},
  '107':{blocks:['设备','环境数据','检测项目数统计','告警'],rail:false,dock:false},
};
for(const z of Object.keys(CASES)){
  await p.selectOption('#zoneSel',z); await p.waitForTimeout(3000);
  const rr=await rects(); const c=CASES[z];
  out.push(((rr.rail==='hidden')===!c.rail?'✅':'❌')+` ${z} 左栏${c.rail?'保留':'隐藏'}（非 106 只看右侧面板）`);
  out.push(((rr.dock==='hidden')===!c.dock?'✅':'❌')+` ${z} 底栏${c.dock?'保留':'隐藏'}`);
  const bl=await p.evaluate(()=>[...document.querySelectorAll('#zonePanel .zp-scroll > section')].filter(e=>!e.hidden).map(e=>e.querySelector('h4').innerText.split('\n')[0].trim()));
  out.push((bl.join('|')===c.blocks.join('|')?'✅':'❌')+` ${z} 展示块=${JSON.stringify(bl)}（期望 ${JSON.stringify(c.blocks)}）`);
  out.push((!noOverlap(rr)?'✅':'❌')+` ${z} 浮层不重叠: ${noOverlap(rr)||'OK'}`);
  const stale=await p.evaluate(()=>{const h=document.querySelector('#zpSamples:not([hidden]) .zp-body, #zpTestItems:not([hidden]) .zp-body, #zpStats:not([hidden]) .zp-body');
    const hidden=[...document.querySelectorAll('#zonePanel .zp-scroll > section')].filter(e=>e.hidden);
    return hidden.every(e=>!e.querySelector('.zp-body').innerText.trim()) ? '' : hidden.map(e=>e.id).join(',');});
  out.push((!stale?'✅':'❌')+' 隐藏块不留脏数据（仍能看到内容：'+(stale||'无')+'）');
  if(z==='102'){
    const g=await p.evaluate(()=>document.querySelector('#zpSamples .zp-grid').innerText.replace(/\s+/g,' ').trim());
    out.push((/286 在库存量\(支\)/.test(g)&&/23 今日收样/.test(g)&&/17 今日还样/.test(g)?'✅':'❌')+' 102 样品台账四格: '+g);
    const names=await p.evaluate(()=>[...document.querySelectorAll('#zpSamples .sp-nm')].map(e=>e.innerText.replace(/\s+/g,' ').trim()));
    const sum=names.reduce((a,x)=>a+(parseInt((x.match(/(\d+) 支/)||[0,0])[1],10)||0),0);
    out.push((names.length===5&&sum===286?'✅':'❌')+` 102 按样品名称分布 5 类且合计=存量 286（实际 ${sum}）: ${names.join(' | ')}`);
  }
  if(z==='103'){
    const g=await p.evaluate(()=>document.querySelector('#zpTestItems .zp-grid').innerText.replace(/\s+/g,' ').trim());
    out.push((/检测中/.test(g)&&/待检测/.test(g)&&/逾期未出/.test(g)?'✅':'❌')+' 非 106 用检测项目数统计替代任务四格: '+g);
    const hasTask=await p.evaluate(()=>!document.querySelector('#zpStats').hidden);
    out.push((hasTask===false?'✅':'❌')+' 103 不再出现「任务统计」块');
  }
}
// ⑤ 周期切换器必须随左栏交接：左栏在→用左栏那组；左栏隐藏但该房间有按周期变的统计→面板这组顶上
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(2800);
/* 106 的左栏在，但「运行指标」面板已按 2026-11-07 反馈撤掉（与右侧区域面板同源重复）——
   `.rail>.period` 只是 display:none，仍在 DOM 里。周期切换器必须搬进面板，
   否则 106 的任务统计（按本日/本月/本年变）就没有任何入口能切。 */
const pp106 = await p.evaluate(() => ({panelHidden: document.getElementById('zpPeriod').hidden,
  railVisible: (() => { const e = document.querySelector('.rail>.period'); const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()}));
out.push((!pp106.panelHidden ? '✅' : '❌') + ` 106 撤左栏指标后周期切换器搬进面板（否则任务统计没人能切）: panel.hidden=${pp106.panelHidden}`);
out.push((!pp106.railVisible ? '✅' : '❌') + ' 同屏只留一份可见（左栏那组在 106 已收起）: rail>.period 可见=' + pp106.railVisible);
const stDay = await p.evaluate(() => document.querySelector('#zpStats .zp-grid').innerText.replace(/\s+/g, ' ').trim());
await p.locator('[data-period=month]:visible').first().click(); await p.waitForTimeout(1800);
const stMon = await p.evaluate(() => document.querySelector('#zpStats .zp-grid').innerText.replace(/\s+/g, ' ').trim());
await p.locator('[data-period=day]:visible').first().click(); await p.waitForTimeout(1200);
out.push((stDay !== stMon ? '✅' : '❌') + ` 面板这组切换器真能驱动 106 任务统计: 本日「${stDay.slice(0, 34)}」→ 本月「${stMon.slice(0, 34)}」`);
await p.selectOption('#zoneSel','107'); await p.waitForTimeout(2800);
const pp=await p.evaluate(()=>{const e=document.getElementById('zpPeriod');
  return {hidden:e.hidden, btns:e.querySelectorAll('.seg').length, active:(e.querySelector('.seg.active')||{}).dataset};});
out.push((!pp.hidden&&pp.btns===3?'✅':'❌')+' 107（左栏隐藏）周期切换器出现在面板头部: hidden='+pp.hidden+' 按钮 '+pp.btns+' 个');
const g1=await p.evaluate(()=>document.querySelector('#zpTestItems .zp-grid').innerText.replace(/\s+/g,' ').trim());
await p.locator('#zpPeriod [data-period=year]').click(); await p.waitForTimeout(1600);
const g2=await p.evaluate(()=>({grid:document.querySelector('#zpTestItems .zp-grid').innerText.replace(/\s+/g,' ').trim(),
  per:document.getElementById('zpTestItemsPeriod').innerText, url:new URLSearchParams(location.search).get('period')}));
out.push((g1!==g2.grid&&g2.per==='本年'&&g2.url==='year'?'✅':'❌')+' 面板里的周期切换真的换数并写进 URL: '+g1.slice(0,26)+' → '+g2.grid.slice(0,26));
await p.locator('#zpPeriod [data-period=day]').click(); await p.waitForTimeout(1000);
await p.selectOption('#zoneSel','101'); await p.waitForTimeout(2600);
out.push(((await p.evaluate(()=>document.getElementById('zpPeriod').hidden))?'✅':'❌')+' 101（无按周期变的块）周期切换器不出现');

// 画像来自数据而非写死：改 seed 里的 blocks 应立刻反映（用 API 校验一致性）
const prof=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/zones');
  return r.data.map(z=>z.zoneId+':'+(z.viewProfile?z.viewProfile.blocks.join('+'):'none')).join(' | ');});
out.push((prof.indexOf('Z-101:env')>=0&&prof.indexOf('Z-102:devices+samples+env+alarms')>=0?'✅':'❌')+' 画像是数据（seed.overview.zones[].viewProfile）: '+prof.slice(0,120));
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(3000);
await p.screenshot({path:'/tmp/twin-qa/zoneview-106.png'});
await p.keyboard.press('1'); await p.waitForTimeout(3000); await p.screenshot({path:'/tmp/twin-qa/zoneview-s1.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
