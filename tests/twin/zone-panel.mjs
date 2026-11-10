/**
 * 区域视图三区接管（FR-80，2026-11-08 重排）
 * 切到具体房间后，信息回到与总览同一套分区，右侧五段长面板退役：
 *   左＝任务统计（纯数字 + 本日/本月/本年，柱图撤掉）+ 本房间设备/资产
 *   下＝106 无人化调度任务 / 其他房间 运行中的任务（互斥，不重复出现）
 *   右＝本房间告警流 + 组态物联节点状态监测（本房间点位）+ 视觉节点实时画面（本房间有摄像头才出现）
 * 本套件从"验五段面板"重写为"验三区接管"。
 */
import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
const out=[],err=[];
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
const vis=sel=>p.evaluate(s=>{const e=document.querySelector(s); if(!e) return 'absent';
  const c=getComputedStyle(e), r=e.getBoundingClientRect();
  return (c.display==='none'||e.hidden||r.width<2||r.height<2)?'hidden':Math.round(r.x)+','+Math.round(r.y)+'→'+Math.round(r.right)+','+Math.round(r.bottom);},sel);

// ① 总览基线：区域专属块不得出现在总览
T('总览左栏是运行指标（非区域块）', await vis('#railZoneStats'), 'hidden');
/* 底栏在 DOM 里恒有 4 块（运行中的任务与调度任务互斥存在），"几块"必须按**可见**数，
   数 .dock .dk 会把隐藏的那块也算进去，于是总览被误报成 4 块。 */
T('总览底栏可见三块', await p.evaluate(()=>[...document.querySelectorAll('.dock .dk')].filter(e=>{const r=e.getBoundingClientRect();return r.width>2&&r.height>2;}).length), 3);
T('总览底栏无「运行中的任务」', await p.evaluate(()=>!document.querySelector('#dkRunning')||document.querySelector('#dkRunning').hidden), 'true');

// ② 106：无人化区
await gotoZone(p,'106'); await p.waitForTimeout(3000);
T('106 接管标记', await p.evaluate(()=>document.body.dataset.zoneView+'/'+document.body.dataset.unmanned), '1/1');
out.push(((await vis('.rail'))!=='hidden'?'✅':'❌')+' 106 左栏可见: '+await vis('.rail'));   /* T() 是字符串相等比较，不能拿函数当期望值 */
out.push(((await vis('#railZoneStats'))!=='hidden'?'✅':'❌')+' 106 左栏「任务统计」出现: '+await vis('#railZoneStats'));
out.push(((await vis('#railZoneDevs'))!=='hidden'?'✅':'❌')+' 106 左栏「设备」出现: '+await vis('#railZoneDevs'));
/* ①（2026-11-09）：四格升级为三子区域（委托任务/样品/试验项目），无柱图的原约束保留 */
T('106 任务统计＝三子区域+调度任务（图二样式：标题/大数/分段条/短语，无柱图）', await p.evaluate(()=>[...document.querySelectorAll('#zsGrid .zs2-g .zs2-h > span')].map(e=>e.innerText).join('/')), '委托任务/样品/试验项目/调度任务');
T('106 左栏任务统计无柱图容器', await p.locator('#railZoneStats .tw-chart').count(), 0);
T('106 设备标题=设备（无资产）', await p.locator('#zDevsTitle').innerText(), '设备');
T('106 设备台数与全场表同源', await p.locator('#zDevsN').innerText(), '8 台建档 · 2 台机器人');
/* 8 台设备 + 2 台复合机器人 = 10 行：机器人原来住在退役面板的设备块里，面板没了就必须在这块接住
   （下钻时总览的 AGV 块按 viewProfile 隐藏，左栏是机器人信息唯一落点）。 */
T('106 左栏行数=设备+机器人', await p.locator('#zDevsList .zd-row').count(), 10);
T('106 左栏机器人两行（在跑 + 停靠）', await p.locator('#zDevsList [data-robot]').count(), 2);
out.push((/停靠 102-05 充电位/.test(await p.locator('#zDevsList [data-robot=\"RB-C-01\"]').innerText())?'✅':'❌')+' 左栏说清 RB-C-01 停在哪个桩: '+await p.locator('#zDevsList [data-robot=\"RB-C-01\"]').innerText());
/* ⑧（2026-11-09 10 点清单）：安全管家场景监测搬进右列（画面块下方），底栏让位成两块。 */
/* ③（2026-11-09 四次圈图）：组态物联也进了右下带（右列高块），底栏只剩无人化调度任务，且从左栏右侧起排 */
T('106 底栏=只剩无人化调度任务', await p.evaluate(()=>[...document.querySelectorAll('.dock .dk')].filter(e=>{const r=e.getBoundingClientRect();return r.width>2&&r.height>2;}).map(e=>e.querySelector('header b').innerText).join('|')), '无人化调度任务');
T('106 组态物联在右列两列带的右列里', await p.evaluate(()=>{const e=document.querySelector('#rightCol .zb-r #iotPanel');if(!e)return 'missing';const r=e.getBoundingClientRect();return r.width>2&&r.height>2?'present':'zero';}), 'present');
T('106 右列含安全管家场景监测块', await p.evaluate(()=>{const e=document.querySelector('#rightCol #dkScenes');if(!e)return 'missing';const r=e.getBoundingClientRect();return r.width>2&&r.height>2?'present':'zero';}), 'present');
T('106 底栏无「运行中的任务」（同一批任务不出现两遍）', await p.evaluate(()=>document.querySelector('#dkRunning').hidden), 'true');
T('106 场景监测只列本房间场景', await p.locator('#dkScenesGrid .sc-row, #dkScenesGrid .sc-row').count(), 1);
/* 数"完整可见的行"之前必须先停掉无缝滚动：告警流现在是 3 行高（279px＝标题 57+3×74），
   动画平移中随时可能只剩 2 行完整落在可视区里，于是这条判据 2/3 交替——
   与本仓其它套件既有做法一致（先 style.animation='none'，等价真机悬停暂停）。 */
await p.evaluate(()=>{['#streamTrack','.stream-board','.stream-board.scroll'].forEach(s=>document.querySelectorAll(s)
  .forEach(e=>{e.style.animation='none';e.style.animationPlayState='paused';}));});
await p.waitForTimeout(400);
/* ⑦（2026-11-09 10 点清单）：房间视图告警流不再固定 279px——按画面/场景块实际占位拉高。
   旧断言「完整可见=3 行」是 279px 时代的产物；现在量两件事：
   · 可视高度确实超过旧固定高（拉高是真的，不是换个数字糊弄）；
   · 完整可见行数 ≥4（279px 只装得下 3 行）。本房间口径由下一条「全部属于 106 区」守住。 */
{
  const g=await p.evaluate(()=>{const v=document.querySelector('.stream-view'); if(!v) return null;
    const bb=v.getBoundingClientRect(); return {h:Math.round(bb.height),
      rows:[...document.querySelectorAll('#streamTrack .st-row')].filter(r=>{const q=r.getBoundingClientRect();
        return q.top>=bb.top-1&&q.bottom<=bb.bottom+1;}).length};});
  out.push((g&&g.h>279+40&&g.rows>=4?'✅':'❌')+` ⑦ 106 告警流按占位拉高：可视 ${g&&g.h}px（旧固定 279）· 完整可见 ${g&&g.rows} 行（≥4）`);
  T('106 右列告警流只看本房间（完整可见行数计入上行）', g&&g.rows>0?'有':'无', '有');
}
T('106 告警全部属于 106 区', await p.evaluate(()=>[...document.querySelectorAll('#streamTrack .st-row')].every(r=>/106 区/.test(r.innerText))), 'true');
T('106 视觉画面=1 格（本房间只有视觉03）', await p.locator('#camGrid .cam-tile').count(), 1);
T('106 组态物联只列本房间点位', await p.evaluate(()=>[...document.querySelectorAll('#dkNodesTrack .nd-row')].filter(r=>r.getAttribute('aria-hidden')!=='true').every(r=>/^106/.test(r.innerText.replace(/\s+/g,'')))), 'true');
/* 退役 = 连 DOM 一起删，不是 hidden：留一份读得到、点不到的影子 UI，
   就会出现"读文本的断言全绿、按键盘的断言全红"的分裂状态（本轮 robotcheck 正是这样红了一轮）。 */
T('区域面板 DOM 已删除', await vis('#zonePanel'), 'absent');

// ③ 107：非无人化区 + 无摄像头
await gotoZone(p,'107'); await p.waitForTimeout(3000);
T('107 接管标记', await p.evaluate(()=>document.body.dataset.zoneView+'/'+document.body.dataset.unmanned), '1/0');
/* ①②（2026-11-10 圈图，107）：底栏只剩「运行中的任务」钉最左（与左栏同宽）；
   场景监测与组态物联搬进右列底部上下叠放；空告警要有体面的底框卡。 */
T('107 底栏=只剩运行中的任务（钉最左，与左栏同宽）', await p.evaluate(()=>{
  const vis=[...document.querySelectorAll('.dock .dk')].filter(e=>{const r=e.getBoundingClientRect();return r.width>2&&r.height>2;}).map(e=>e.querySelector('header b').innerText).join('|');
  const dk=document.querySelector('.dock').getBoundingClientRect();
  const rail=document.querySelector('.rail').getBoundingClientRect();
  return vis+' @x'+Math.round(dk.x)+'w'+Math.round(dk.width)+' railR'+Math.round(rail.right);}), '运行中的任务 @x14w300 railR314');
{const rc=await p.evaluate(()=>{const inRcol=id=>{const e=document.getElementById(id);return e&&e.parentElement&&(e.parentElement.id==='rightCol'||e.parentElement.id==='zonePair')&&!e.hidden&&e.getBoundingClientRect().width>2;};
  const cards=[...document.querySelectorAll('#dkNodesZone .zi-card')].map(e=>Math.round(e.getBoundingClientRect().height));
  const empty=document.querySelector('.stream-view .zp-empty');
  return {sc:inRcol('dkScenes'),iot:inRcol('iotPanel'),cards,
    empty:empty?{w:Math.round(empty.getBoundingClientRect().width),border:getComputedStyle(empty).borderTopWidth,radius:getComputedStyle(empty).borderRadius}:null};});
  out.push((rc.sc&&rc.iot?'✅':'❌')+' 107 右列底部上下叠：安全管家场景监测 → 组态物联（101 式等高卡 '+JSON.stringify(rc.cards)+'）');
  out.push((rc.empty&&rc.empty.w>200&&rc.empty.border!=='0px'&&parseFloat(rc.empty.radius)>=8?'✅':'❌')+' 107 空告警提示有底框卡：'+JSON.stringify(rc.empty));
}
T('107 调度任务块不可见（非无人化区）', await p.evaluate(()=>{const r=document.querySelector('#dkQueue').getBoundingClientRect();return r.width>2&&r.height>2;}), 'false');
T('107 设备标题=设备', await p.locator('#zDevsTitle').innerText(), '设备');
T('107 设备台数与全场表同源', await p.locator('#zDevsN').innerText(), '6 台建档');
T('107 无摄像头 → 视觉画面整块不显示', await vis('#cctvBox'), 'hidden');
T('107 本区今日无告警 → 空态说清是哪个区', await p.locator('.stream-view').innerText(), '107 区今日无告警');
/* 107 有部署场景（恒温恒湿环境自动调节 · 107），所以这块必须显示——上一版我按"107 没场景"写期望，
   是期望错，不是产品错。真正要验的是"只显示本房间那一套"。 */
T('107 场景监测只显示本房间场景', await p.locator('#dkScenesGrid .sc-row').count(), 1);
out.push((/恒温恒湿/.test(await p.locator('#dkScenesGrid .sc-row').first().innerText())?'✅':'❌')+' 107 那套场景是「恒温恒湿环境自动调节」: '+await p.locator('#dkScenesGrid .sc-row').first().innerText());

// ④ 102：资产口径 + 有摄像头
await gotoZone(p,'102'); await p.waitForTimeout(3000);
T('102 标题改「资产」（货架/充电位/电视不是检测设备）', await p.locator('#zDevsTitle').innerText(), '资产');
T('102 资产条数=5（收样登记台+2 货架+充电位+电视）', await p.locator('#zDevsList .zd-row').count(), 5);
T('102 有视觉节点? 无 → 画面块不显示', await vis('#cctvBox'), 'hidden');

/* ⑤⑥（2026-11-10 圈图）：周期开关回到 106——驱动「本周期」行；三子区域保持当前态。 */
await gotoZone(p,'106'); await p.waitForTimeout(3000);
const day=await p.locator('#zsGrid').innerText();
const segVis=await p.evaluate(()=>[...document.querySelectorAll('#railZoneStats .period .seg')].filter(e=>{const q=e.getBoundingClientRect();return q.width>2&&q.height>2;}).length);
out.push((segVis===3?'✅':'❌')+' 106 左栏周期开关回归（日/月/年 3 个，驱动本周期行）: 可见 '+segVis+' 个');
await p.locator('#railZoneStats [data-period=year]').click(); await p.waitForTimeout(1600);
const year=await p.locator('#zsGrid').innerText();
out.push((year!==day&&/本年/.test(year)?'✅':'❌')+' 切「本年」调度任务块真的变（前三块数字不动）: '+year.replace(/\s+/g,' ').match(/调度任务[^]*?排队 \d+/)?.[0]?.slice(0,60));
await p.locator('#railZoneStats [data-period=day]').click(); await p.waitForTimeout(1000);
out.push((/委托任务/.test(day)&&/试验项目/.test(day)?'✅':'❌')+' 106 左栏仍是三子区域: '+day.replace(/\s+/g,' ').trim().slice(0,52));
const url=await p.evaluate(()=>new URLSearchParams(location.search).toString());
out.push((/mode=ZONE&zone=106/.test(url)?'✅':'❌')+' 区域视图 URL 可复现: '+url.slice(0,60));
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,4).join('\n'));
await b.close();
process.exit(out.filter(l=>l.startsWith('❌')).length?1:0);
