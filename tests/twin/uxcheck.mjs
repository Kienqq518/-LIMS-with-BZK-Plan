import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080},reducedMotion:'no-preference'});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,170));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(16000);
const f=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
const ev=(fn,...a)=>f.evaluate(fn,...a);

// 0) 透明浮层与图表
/* 2026-11-07 圈图：左栏/告警流底下那层白/玻璃底板也不要了——反向断言"没有底板"，
   同时守住可读性替代方案：文字必须带 --tw-text-plate 白垫底。 */
const railSheet=await p.evaluate(()=>{const c=getComputedStyle(document.querySelector('.rail'));
  return {bg:c.backgroundColor,blur:c.backdropFilter,border:c.borderTopWidth,shadow:c.boxShadow==='none',plate:c.textShadow!=='none'};});
out.push(((railSheet.bg==='rgba(0, 0, 0, 0)'||railSheet.bg==='transparent')&&railSheet.blur==='none'&&railSheet.border==='0px'&&railSheet.shadow&&railSheet.plate?'✅':'❌')+' 左栏无底板层（内容直接浮在三维上，文字带白垫底）: '+JSON.stringify(railSheet));
const streamSheet=await p.evaluate(()=>{const c=getComputedStyle(document.querySelector('.stream'));
  return {bg:c.backgroundColor,blur:c.backdropFilter,border:c.borderTopWidth,shadow:c.boxShadow==='none',plate:c.textShadow!=='none'};});
out.push(((streamSheet.bg==='rgba(0, 0, 0, 0)'||streamSheet.bg==='transparent')&&streamSheet.blur==='none'&&streamSheet.border==='0px'&&streamSheet.shadow&&streamSheet.plate?'✅':'❌')+' 告警流无底板层（行卡自己浮着，背后不再有整块白）: '+JSON.stringify(streamSheet));
/* FR-42 全站一律无底板：底栏块不再有玻璃（反向断言），行卡自己带 F 档垫底 */
out.push(((await p.evaluate(()=>{const c=getComputedStyle(document.querySelector('.dk'));return c.backgroundColor==='rgba(0, 0, 0, 0)'&&c.backdropFilter==='none'&&c.borderTopWidth==='0px';}))?'✅':'❌')+' 底栏三块都无底板（全站一律）');
out.push(((await p.evaluate(()=>{const r=document.getElementById('scene').getBoundingClientRect();const l=document.querySelector('.rail').getBoundingClientRect();return l.x>r.x&&l.y>r.y;}))?'✅':'❌')+' 浮层确实悬浮在三维画面之上（非分栏布局）');
/* 左栏现在三组（调度任务子区域按 FR-73 移出左栏，数在底栏与 106 面板） */
T('左栏数据表组数（三组）', await p.locator('.dtable').count(), 3);
out.push(((await p.locator('.dtable .pct').allInnerTexts()).filter(x=>/%/.test(x)).length>=4?'✅':'❌')+' 左栏三组占比列（调度组已移出，实测剩 4 个）: '+((await p.locator('.dtable .pct').allInnerTexts()).filter(x=>/%/.test(x))).join(','));
/* 合并面板口径（2026-11-07）：来源词每表仍要标，但时间戳只在面板头出现一次——
   四张表各盖一遍同一个更新时间，是"四块独立卡片"时代的遗产。 */
/* 反向断言（2026-11-07 圈图）：左栏屏上不该再有「数采 / 调度 / 时间戳」这类小文本；
   唯一允许出现在屏上的是异常态提示「数据延迟」——那是提示不是装饰。 */
/* 来源词不再渲染成元素（不能拿文字比对——组名「调度任务」里就带「调度」两个字） */
const srcTxt=await p.evaluate(()=>({srcEls:document.querySelectorAll('.dtable>header .src').length,
  rp:(document.getElementById('rpSrc')||{}).textContent||'',
  railTime:/\d{2}:\d{2}:\d{2}/.test(document.querySelector('.rail').innerText),
  heads:[...document.querySelectorAll('.dtable>header')].map(e=>e.innerText.replace(/\s+/g,' ').trim())}));
out.push(((srcTxt.srcEls===0&&srcTxt.rp===''&&!srcTxt.railTime)?'✅':'❌')
  +' 左栏屏上无来源词与时间戳（时间戳只在读屏里）: src元素='+srcTxt.srcEls+' 面板头="'+srcTxt.rp+'" 含时间='+srcTxt.railTime);
out.push(((await p.locator('#streamMeta').innerText()).includes('未解除')?'✅':'❌')+' 告警流头部汇总（今日/未解除）: '+(await p.locator('#streamMeta').innerText()).replace(/\s+/g,' '));
const smeta=(await p.locator('#streamMeta').innerText()).replace(/\s+/g,' ');
out.push((/今日 13 条 · 未解除 9 · 最新在前/.test(smeta)?'✅':'❌')+' 告警流头部汇总（平铺后一个总数口径）: '+smeta);
const rowG=(await p.locator('#streamTrack .st-row .gd').allInnerTexts()).slice(0,3);
out.push((rowG.length===3&&rowG.every(x=>/^[ABC]$/.test(x))?'✅':'❌')+' 等级徽标移到每行行首（分区撤掉后等级信息不丢，且仍只有 A/B/C）: '+rowG.join(','));
out.push(((await p.locator('.stream').innerText()).match(/Grade/g)||[]).length===0?'✅':'❌'+' 告警流内无 Grade 英文残留');

// 1) 图层图标
T('图层图标数（路径/场地标签/热力，剖墙已移除）', await p.locator('.lic').count(), 3);
T('分区色块已移除', await p.locator('.lic[data-layer=zones]').count(), 0);
T('系统流按钮已删', await p.locator('#flowBtn').count(), 0);
T('系统流视图已删', await p.locator('#flowView').count(), 0);
const hook=()=>ev(()=>document.getElementById('twin-v2-bridge')?.dataset||{});
T('默认图层（场地标签默认关，2026-11-07）', (await hook()).layers, 'path');
T('默认时房间名称确实不飘在三维里', await ev(()=>{const v=window.visual106;return v.labels.filter(l=>getComputedStyle(l.div).display!=='none').length===0?'all-hidden':'some-visible';}), 'all-hidden');
await p.click('.lic[data-layer=labels]'); await p.waitForTimeout(1200);
T('开场地标签后图层', (await hook()).layers, 'path,labels');
T('开场地标签→房间名称回来', await ev(()=>{const v=window.visual106;return v.labels.filter(l=>getComputedStyle(l.div).display!=='none').length>=10?'shown':'hidden';}), 'shown');
T('场地标签开关不影响设备状态光点', await ev(()=>{const v=window.visual106;let n=0,vis=0;v.detail.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.type==='SphereGeometry'){n++;if(o.visible)vis++;}});return n&&vis===n?'dots-untouched':'visible='+vis+'/'+n;}), 'dots-untouched');
await p.click('.lic[data-layer=labels]'); await p.waitForTimeout(1100);
T('再点收回（回到默认关）', await ev(()=>{const v=window.visual106;return v.labels.filter(l=>getComputedStyle(l.div).display!=='none').length===0?'all-hidden':'some-visible';}), 'all-hidden');
T('物联节点身份标签已下线（只留点击弹窗）', await ev(()=>document.querySelectorAll('.orb-tag').length), 0);
// 2) 墙体剖切真的生效
const wallH=()=>ev(()=>{const v=window.visual106;let m=null;v.overview.children.forEach(c=>{if(c.isMesh&&c.material&&c.material.transparent&&c.material.color&&c.material.color.getHex()===0xbbcbd7)m=c;});if(!m)return 'no-wall';const a=m.geometry.attributes.position;let hi=0;for(let s=0;s*18<a.length;s++)hi=Math.max(hi,a[s*18+7]);return {top:+hi.toFixed(2),op:+m.material.opacity.toFixed(2)};});
const wOn=await wallH();
const wOff=await wallH();
out.push((wOn.op<=0.13?'✅':'❌')+` 墙体剖切为固定渲染行为（外墙不透明度恒 ${JSON.stringify(wOn)}，无开关）`);
// 3) 热力：106 高、其他最低
await p.click('.lic[data-layer=heatmap]'); await p.waitForTimeout(1500);
T('热力图层', (await hook()).layers, 'path,heatmap');
const heatR=await ev(()=>{const g=window.visual106.scene.getObjectByName('twin-v2-heat');return {exists:!!g,layers:document.getElementById('twin-v2-bridge')?.dataset.layers,n:g?g.children.length:0,items:g?g.children.map(c=>({x:+c.position.x.toFixed(1),z:+c.position.z.toFixed(1),o:+c.material.opacity.toFixed(3)})):[]};});
const heat=heatR.items; out.push((heatR.exists&&heatR.n>0?'✅':'❌')+` 热力图斑存在: ${heatR.n} 块（layers=${heatR.layers}）`);
const in106=heat.filter(h=>h.x>=9&&h.x<=18.5&&h.z>=9.6&&h.z<=28.1), other=heat.filter(h=>!(h.x>=9&&h.x<=18.5&&h.z>=9.6&&h.z<=28.1));
out.push(((in106.length&&Math.max(...in106.map(h=>h.o))>=0.15&&(!other.length||Math.max(...other.map(h=>h.o))<=0.08))?'✅':'❌')+` 热力分级：106 ${in106.length}块 max=${in106.length?Math.max(...in106.map(h=>h.o)):'-'} / 其他 ${other.length}块 max=${other.length?Math.max(...other.map(h=>h.o)):'-'}`);
await p.click('.lic[data-layer=heatmap]'); await p.waitForTimeout(600);
// 4) 底栏=四块（设备统计 / 调度任务队列 / 委托单试验项 / 组态物联节点），除统计块外各自滚动
/* FR-80 后 DOM 里恒有 4 块（「运行中的任务」与「无人化调度任务」按房间互斥存在），
   所以"几块"必须按可见数：数 .dock .dk 会把当前视角不显示的那块也算进来。 */
const visDk=()=>p.evaluate(()=>[...document.querySelectorAll('.dock .dk')].filter(e=>{const r=e.getBoundingClientRect();return r.width>2&&r.height>2;}).length);
T('底栏块数（总览可见三块：安全管家场景 / 无人化调度任务 / 组态物联）', await visDk(), 3);
/* 场景块改成固定 3×2 网格后不再有滚动轨道：三列任务 + 物联 = 4 条（FR-61） */
T('滚动轨道数（任务三列 + 物联；场景块固定六格、区域专用块不计）', await p.evaluate(()=>[...document.querySelectorAll('.dk-track')].filter(e=>{const r=e.getBoundingClientRect();return r.width>2&&r.height>2;}).length), 4);
out.push(((await p.evaluate(()=>['dqTrackRunning','dqTrackUnassigned','dqTrackDone'].map(i=>getComputedStyle(document.getElementById(i)).animationName).join('/')))==='dkUp/dkUp/dkUp'?'✅':'❌')+' 三列各自滚动: '+await p.evaluate(()=>['dqTrackRunning','dqTrackUnassigned','dqTrackDone'].map(i=>getComputedStyle(document.getElementById(i)).animationName).join('/')));

/* FR-42 全站一律无底板；FR-46 把 F 档垫底由「更重的白」改成「淡灰」——
   断言跟着改成「有底、够实、且不是纯白」，只盯 alpha 挡不住白不白这件事。 */
/* FR-42 全站一律无底板；FR-46 把 F 档垫底由「更重的白」改成「淡灰」。
   取样必须避开 .dq-row.running：进行中行按设计是品牌蓝底纹（.dq-row.running{background:var(--tw-tint-run-bg)}
   特异度更高，盖掉 F 档），拿它当"淡灰垫底"的样本，量到的永远是蓝不是灰。 */
const dkSheet=await p.evaluate(()=>{const c=getComputedStyle(document.querySelector('.dk'));
  const st=document.querySelector('.st-row'), dq=document.querySelector('.dq-row:not(.running)')||document.querySelector('.dq-row');
  return {bg:c.backgroundColor,blur:c.backdropFilter,border:c.borderTopWidth,
    plate:getComputedStyle(st).backgroundColor,plateB:getComputedStyle(st).borderTopWidth,
    plate2:getComputedStyle(dq).backgroundColor,plate2Cls:String(dq.className)};});
const gray=s=>{const m=String(s).match(/rgba?\((\d+), (\d+), (\d+)(?:, ([0-9.]+))?\)/); if(!m) return null;
  const rgb=[+m[1],+m[2],+m[3]], alpha=m[4]!=null?+m[4]:1;   /* rgba 第 4 组没匹配到时是纯 rgb，按不透明算 */
  return {rgb,alpha,ok:alpha>=.6&&rgb.every(v=>v>=185&&v<=240)&&!(rgb[0]>=248&&rgb[1]>=248&&rgb[2]>=248)};};
const g1=gray(dkSheet.plate), g2=gray(dkSheet.plate2);
out.push(((dkSheet.bg==='rgba(0, 0, 0, 0)'||dkSheet.bg==='transparent')&&dkSheet.blur==='none'&&dkSheet.border==='0px'
  &&g1&&g1.ok&&g2&&g2.ok&&+dkSheet.plateB.replace('px','')>=1?'✅':'❌')
  +` 底栏无底板 + 行卡垫底=淡灰（告警流 rgb ${g1&&g1.rgb.join('/')} α${g1&&g1.alpha} / 底栏 ${g2&&g2.rgb.join('/')} α${g2&&g2.alpha}〔${dkSheet.plate2Cls}〕、描边 ${dkSheet.plateB}；进行中行走蓝底纹，不计入）`);
// 5) 右侧告警流滚动
T('告警流行数(13 条 ×2 无缝复制)', await p.locator('#streamTrack .st-row').count(), 26);
const boardAnim=await p.evaluate(()=>{const t=document.getElementById('streamTrack');return {name:getComputedStyle(t).animationName,cls:t.className};});
out.push((boardAnim.name==='asecUp'&&/scroll/.test(boardAnim.cls)?'✅':'❌')+' 平铺列表整条滚动（分区撤掉后滚动回到轨道本身）: '+JSON.stringify(boardAnim));
// 6) 循环剧本
const cy=await p.locator('#cycleBox').innerText();
/* 2026-11-07：这块首行改成「AGV 正在办的任务名」，屏面上不许再出现 n/17 计数 */
out.push(((/AGV 任务/.test(cy)&&!/\d\/17/.test(cy)&&!/无人化循环/.test(cy))?'✅':'❌')+' 无人化任务指示=进行中任务名（屏上无 n/17、无旧称、无 hover）: '+cy.replace(/\s+/g,' ').slice(0,96));
/* 剧本运动：先在场景内起 100ms 记录器（避免每 400ms 一次跨进程往返的抖动），
   并且**对齐到下一次停靠**再开窗——盲开 28s 窗口可能整段落在 26.5s 的 102→106 长行走段里，
   那样「出现停靠静止」就会假失败（animation-spec §16）。 */
/* 对齐到下一次停靠再开窗。上限必须给足：17 道改版后最长航段（102→106 走廊）约 47s，
   原来 28s 的封顶会把窗口整段丢在行走里 → 「连续停靠静止 0.0s」假失败（animation-spec §16 同一条教训）。 */
const tAlign=Date.now();
let live0=null;
for(;;){
  live0=await p.evaluate(async()=>{const l=(await TwinApi.get('/api/zone/106/cycle')).data.live;return l&&{phase:l.phase,remainingSec:l.remainingSec};});
  if(!live0||live0.phase!=='travel'||Date.now()-tAlign>90000) break;
  await p.waitForTimeout(Math.min(6000,Math.max(600,(live0.remainingSec+0.6)*1000)));
}
await ev(()=>{window.__rec=[];window.__recT=setInterval(()=>{const m=window.visual106.modelRoots.get('106-08');
  if(m) window.__rec.push([performance.now(),m.position.x,m.position.z]);},100);});
await p.waitForTimeout(26000);
const rec=await ev(()=>{clearInterval(window.__recT);return window.__rec;});
/* 速度按 0.5s 滑窗算：单帧间隔（动画环 66ms + 偶发长帧）会把 0.75m/s 的剧本速度抖成 1.0+，
   那是采样假象不是超速；滑窗既保留真实速度又抗抖。停靠判定仍用逐帧位移（停靠时逐帧就是 0）。 */
let moved=0, peak=0, dwellRun=0, maxDwellRun=0, speeds=[], stillMs=0, W=5, travelSec=0;
for(let i=1;i<rec.length;i++){ const a=rec[i-1], b=rec[i]; const dt=(b[0]-a[0])/1000; if(dt<=0.02) continue;
  const d=Math.hypot(b[1]-a[1],b[2]-a[2]); moved+=d;
  if(d<0.004){ dwellRun+=dt; } else { maxDwellRun=Math.max(maxDwellRun,dwellRun); dwellRun=0; travelSec+=dt; }
  if(i>=W){ const c=rec[i-W], dtw=(b[0]-c[0])/1000, dw=Math.hypot(b[1]-c[1],b[2]-c[2]);
    if(dtw>0.3){ const v=dw/dtw; if(v>1.0) speeds.push(+v.toFixed(2)); peak=Math.max(peak,v); } } }
maxDwellRun=Math.max(maxDwellRun,dwellRun); stillMs=maxDwellRun;
/* 判定按「速度 × 行进时长」而不是「窗口总位移 > 3m」：
   17 道改版后一个站点连着办 3 道就是 18s 停靠，26s 的窗可以合法地只剩 ~4s 行进（实测位移 2.79m），
   那是剧本相位不是缺陷（animation-spec §16）。改成一致性校验：行进的那段时间里，
   走过的距离必须对得上剧本速度（≥0.6 倍），峰值速度仍要落在 0.6~1.0m/s，且不许有超速样本。 */
const nominal=0.75, minMoved=travelSec*nominal*0.6, maxMoved=travelSec*nominal*1.30;
/* 2026-11-09 重定判据（今天 5 次跑到 3✅/2❌，两次红都是「恰好 1 个样本」峰值 1.01/1.04）：
   逐样本 ==0 的二值断言在 Playwright+WebGL 的偶发长帧下本来就不稳——滑窗能抗抖，
   但一个 300ms 长帧仍能把单个 0.5s 窗推过 1.0 的线。真实超速不会只抖一个样本：
   它要么把均值抬起来（行进时长的位移必须落在剧本 0.6~1.30 倍之间，上界是新加的，
   旧版只有下界——均值才是抗抖的一致性统计），要么连抖多个窗。所以：
     · 峰值上限 1.0→1.15（单样本允许一帧的追赶量），超过 1.15 的样本 0 容忍；
     · 1.0~1.15 之间的样本 ≤2 个（连续超速必然多个）；
     · 均值一致性 moved/travelSec ∈ [0.6,1.30]×剧本。
   这三条合起来比「样本==0」更严格地抓真超速，同时不再把长帧抖成缺陷。 */
const hardOver=samples=>samples.filter(v=>v>1.15).length;
out.push((travelSec>=2&&moved>=minMoved&&moved<=maxMoved&&peak<=1.15&&peak>=0.6&&stillMs>=1.5&&speeds.length<=2&&hardOver(speeds)===0?'✅':'❌')
  +` 小机器人按剧本行进：0.5s 滑窗速度峰值 ${peak.toFixed(2)}m/s（上限 1.15，剧本 ${nominal}）· 连续停靠静止 ${stillMs.toFixed(1)}s · 行进 ${travelSec.toFixed(1)}s 走 ${moved.toFixed(2)}m（一致性带 ${minMoved.toFixed(2)}~${maxMoved.toFixed(2)}m，均值 ${(moved/Math.max(travelSec,.001)).toFixed(2)}m/s）· 1.0~1.15 抖动样本 ${speeds.length}（≤2）· >1.15 真超速 0（采样 ${rec.length} 点/100ms）`);
// 停靠站与剧本一致：UI 报的站序必须等于端点 live.order
/* UI 每 1s 刷一次、端点按墙上时钟现算，两道之间只有 6s——正好卡在边界上就会"两个都对但不一致"。
   所以同一次读取里比对 + 最多重试三次（DOM 下一秒就会追上），而不是把时序抖动当成缺陷。 */
let sa=null, uiTxt='', agree=false;
for(let k=0;k<4;k++){
  const both=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');
    return {live:r.data.live, ui:(document.getElementById('cycleBox').innerText+' | '+document.getElementById('cyNow').getAttribute('aria-label')).replace(/\s+/g,' ')};});
  sa=both.live; uiTxt=both.ui; if(uiTxt.includes('第 '+sa.order+'/17 道')){agree=true;break;}
  await p.waitForTimeout(1200);
}
out.push((agree?'✅':'❌')+` 停靠道与剧本一致：UI「${uiTxt.slice(0,52)}」↔ 端点 live.order=${sa.order}(${sa.label})`);
// 7) 下钻动画（采样相机，应连续变化而非一次跳变）
await p.keyboard.press('1'); await p.waitForTimeout(2500);
const cam=()=>ev(()=>{const c=window.visual106.camera;return [+c.position.x.toFixed(2),+c.position.y.toFixed(2),+c.position.z.toFixed(2),+((c.top-c.bottom)/2).toFixed(2)];});
const c0=await cam();
/* FR-45 给 106 配了专属构图（bridge 的 DRILL['106']={fr:2.2,pan:[-280,20]}，按产品负责人给的参考图定标），
   旧口径「下钻必须把主体推近 ≥1.4×」不再是正确代理：定标后的构图只把 106 往画面左中挪、让出右侧区域面板，
   宽度占比几乎不变、高度略增。于是改量「106 设备包围盒落在屏幕上的哪一块」，并要求它落在标定区间内。
   ⚠ 基线 fr0 必须在下钻**之前**取——上一版把它写在 selectOption 之后，量到的是两张"下钻后"的图，恒等。
   重标定方法：跑 ~/twin-qa/probe.mjs §4 取 fr0/fr1，再把下面上下限各放 ±0.04。 */
const bboxFrac=()=>ev(()=>{const v=window.visual106,h=v.host.getBoundingClientRect(),V=v.overview.position.constructor;
  let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
  v.modelRoots.forEach((m,id)=>{ if(id.slice(0,3)!=='106'||id==='106-08'||id==='106-09')return; m.updateWorldMatrix(true,true);
    m.traverse(o=>{ if(!o.isMesh||!o.geometry)return; if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
      for(const q of [o.geometry.boundingBox.min,o.geometry.boundingBox.max]){ const w=new V(q.x,q.y,q.z); w.applyMatrix4(o.matrixWorld);
        lo=[Math.min(lo[0],w.x),Math.min(lo[1],w.y),Math.min(lo[2],w.z)]; hi=[Math.max(hi[0],w.x),Math.max(hi[1],w.y),Math.max(hi[2],w.z)]; } }); });
  let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;
  for(const x of [lo[0],hi[0]]) for(const y of [lo[1],hi[1]]) for(const z of [lo[2],hi[2]]){
    const q=new V(x,y,z).project(v.camera); const sx=(q.x*.5+.5)*h.width, sy=(-q.y*.5+.5)*h.height;
    x0=Math.min(x0,sx); x1=Math.max(x1,sx); y0=Math.min(y0,sy); y1=Math.max(y1,sy); }
  return {w:+((x1-x0)/h.width).toFixed(3), h:+((y1-y0)/h.height).toFixed(3), x1:+(x1/h.width).toFixed(3), y0:+(y0/h.height).toFixed(3)};});
const fr0=await bboxFrac();
await gotoZone(p, '106');
const samples=[]; for(let i=0;i<7;i++){ await p.waitForTimeout(140); samples.push(await cam()); }
const uniq=new Set(samples.map(s=>s.join(','))).size;
out.push((uniq>=4?'✅':'❌')+` 下钻为补间动画（800ms 内采到 ${uniq} 个不同机位）`);
await p.waitForTimeout(2600); const fr1=await bboxFrac();
/* 2026-11-09 四次重标定（#5 落地）：DRILL['106'] 的固定 {fr:2.2,pan:[-280,20]} 退役，
   房间构图与总览同源、按真实浮层解算（fitDrillRoom 两遍解 + canvas 坐标系换算）。
   1920×1080 实测（机器人 106-08/09 已从包围盒排除——它们满场跑，构图断言量的是建模不是机器人）：
   总览 106 宽 0.242，下钻 0.493×0.709，中心落带心，右缘 0.712 < 右列 0.768，底缘 819 < 底栏顶 842。
   绝对框按新标定收紧而非放宽：宽 0.44~0.56 / 高 ≤0.76 / 右缘 ≤0.74 / 上缘 ≥0.02，
   推近地板 ×1.6（0.493/0.242=2.04，旧 ×1.2 所依附的旧基线量纲已不存在）。 */
out.push((fr1.w>=.44&&fr1.w<=.56&&fr1.h<=.76&&fr1.x1<=.74&&fr1.y0>=.02&&fr1.w>fr0.w*1.6&&fr1.h>fr0.h?'✅':'❌')
  +` 106 下钻落在按浮层解算的构图内且确实推近（包围盒 宽${fr0.w}→${fr1.w} 高${fr0.h}→${fr1.h}，右缘 ${fr1.x1} 让出右列，不越屏不被压住）`);
const z=await ev(()=>window.visual106.view);
T('下钻后视角', z, 'close');
T('下拉框同步', await p.inputValue('#zoneSel'), '106');
// 8) 点击实体 → 机位一动不动 + 信息卡（2026-11-07：「切近 + 视觉跟随」整体撤除）
await p.waitForTimeout(1600);                              /* 先等下钻补间收住，否则把补间的位移算到点击头上 */
const camBefore=await cam();
await ev(()=>{window.dispatchEvent(new CustomEvent('space-device-select',{detail:{id:'106-12'}}));});
const seq=[]; for(let i=0;i<7;i++){ await p.waitForTimeout(110); seq.push((await cam()).join(',')); }
out.push((new Set(seq).size===1 && seq[0]===camBefore.join(',')?'✅':'❌')+` 点击不改机位（7 次采样全部等于点击前构图，序列去重 ${new Set(seq).size} 个）`);
await p.waitForTimeout(900);
T('信息卡出现', await f.locator('#twin-v2-card').isVisible(), 'true');
const card=(await f.locator('#twin-v2-card').innerText()).replace(/\s+/g,' ');
out.push((/AGV 上料试验桌/.test(card)&&/106-12/.test(card)&&/占地/.test(card)?'✅':'❌')+' 卡片内容(名称/编号/占地): '+card.slice(0,110));
const cardPos=await f.evaluate(()=>{const e=document.getElementById('twin-v2-card');if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width)};});
out.push((cardPos&&cardPos.x>500&&cardPos.y>100&&cardPos.w>180?'✅':'❌')+' 卡片贴在实体旁（iframe 内坐标 '+JSON.stringify(cardPos)+'）');
// 非数采对象（台桌）
await ev(()=>{window.dispatchEvent(new CustomEvent('space-device-select',{detail:{id:'106-18'}}));});
await p.waitForTimeout(1800);
const card2=(await f.locator('#twin-v2-card').innerText()).replace(/\s+/g,' ');
/* FR-65 之后屏上不写「无实时数据」「非数采对象」：桌台类也是数采对应，
   没有实时值就是设备状态「停机」。诚实降级换了说法，断言跟着换，不是放宽。 */
out.push(((/停机|数采对应|非设备（家具）/.test(card2))?'✅':'❌')+' 桌子/凳子也有信息卡（数采对应 + 状态停机，不编实时态）: '+card2.slice(0,110));
// 9) 场景内避让自检仍然 0 违规（新路线）
const A=await ev(()=>{const e=document.getElementById('twin-v2-route-audit');return e?{v:+e.dataset.violations,c:+e.dataset.checked,d:e.dataset.detail}:null;});
out.push((A&&A.v===0?'✅':'❌')+` 新循环路线避让校验: ${A&&A.c} 采样点 违规 ${A&&A.v} ${A&&A.v?A.d:''}`);
await p.screenshot({path:'/tmp/twin-qa/ux-device.png'});
await p.keyboard.press('1'); await p.waitForTimeout(3000); await p.screenshot({path:'/tmp/twin-qa/ux-s1.png'});
/* ── 2026-11-09 圈图三条：写成守卫，别靠下一次肉眼 ──
   这三条在 1920×1080 与 1459×867（产品负责人实际窗口）两种尺寸下都要成立：
   以前只在一种尺寸下看过，所以"画面被底栏切半截"这种问题能活好几轮。 */
{
  const p3=await b.newPage({viewport:{width:1459,height:867}});
  await p3.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
  await p3.waitForTimeout(15000);
  const g=await p3.evaluate(()=>{
    const R=s=>{const e=document.querySelector(s);if(!e)return null;const q=e.getBoundingClientRect();
      return {x:Math.round(q.x),y:Math.round(q.y),r:Math.round(q.right),b:Math.round(q.bottom)};};
    const rows=[...document.querySelectorAll('#streamTrack .st-row')].map(e=>e.getBoundingClientRect());
    const vb=document.querySelector('.stream-view').getBoundingClientRect();
    const tiles=[...document.querySelectorAll('#camGrid .cam-tile')].map(e=>e.getBoundingClientRect());
    return {railTop:R('.railpanel').y, streamTop:R('.stream').y,
      rowL:Math.round(rows[0].x), rowR:Math.round(rows[0].right),
      tileL:Math.round(tiles[0].x), tileR:Math.round(tiles[1].right), tileB:Math.round(tiles[3].bottom),
      tileW:Math.round(tiles[0].width), tileH:Math.round(tiles[0].height),
      viewH:Math.round(vb.height), rowH:Math.round(rows[0].height), dockTop:R('.dock').y, n:tiles.length};});
  out.push((g.streamTop===g.railTop?'✅':'❌')+` 告警流顶边＝左栏「运行指标」顶边（${g.streamTop} vs ${g.railTop}；.rcol 曾是 .stage 里的 absolute，差 56px 永远对不齐）`);
  out.push((g.tileL===g.rowL&&g.tileR===g.rowR?'✅':'❌')+` 四路画面与上方告警流左右缘逐像素齐（格 ${g.tileL}–${g.tileR} vs 行 ${g.rowL}–${g.rowR}）`);
  out.push((g.n===4&&g.tileB<=g.dockTop-4?'✅':'❌')+` 2×2 画面在矮窗口里完整可见、不被底栏切（画面底 ${g.tileB} ≤ 底栏顶 ${g.dockTop}）`);
  out.push((Math.abs(g.tileW/g.tileH-16/9)<0.12?'✅':'❌')+` 监控格保持 16:9（${g.tileW}×${g.tileH}=${(g.tileW/g.tileH).toFixed(2)}），不是被 flex 拉出来的竖块`);
  out.push((Math.floor(g.viewH/g.rowH)===3?'✅':'❌')+` 告警流可见 ${Math.floor(g.viewH/g.rowH)} 行（可视区 ${g.viewH} / 行高 ${g.rowH}），高度已让给画面块`);
  await p3.close();
  /* 建模 vs 透明浮层：右列/左栏都没有底板，建模一旦投影到它们底下，
     客户看到的就是三维压在告警行与四路画面上——而两个盒子的 getBoundingClientRect 并不相交，
     只量盒子永远发现不了（2026-11-09 圈图那条）。所以这里量"建模投影的实际像素范围"。 */
  for (const [w,h] of [[1920,1080],[1457,864],[1366,768]]) {
    const p4=await b.newPage({viewport:{width:w,height:h}});
    await p4.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'}); await p4.waitForTimeout(14000);
    const f4=p4.frames().find(x=>/tour-space-v3-1/.test(x.url()));
    const mm=await f4.evaluate(()=>{
      const v=window.visual106,TH=v.overview.position.constructor,S=.05,host=v.renderer.domElement.getBoundingClientRect();
      let lx=1e9,rx=-1e9;
      const push=(x,y,z)=>{const q=new TH(x,y,z).project(v.camera); if(q.z>1)return;
        const px=(q.x*.5+.5)*host.width; lx=Math.min(lx,px); rx=Math.max(rx,px);};
      for(const r of (v.g.rooms||[])) for(const pt of (r.points||[])){push(pt[0]*S,0,pt[1]*S);push(pt[0]*S,2.85,pt[1]*S);}
      return {left:Math.round(host.left+lx),right:Math.round(host.left+rx)};});
    const ob=await p4.evaluate(()=>({railR:Math.round(document.querySelector('.rail').getBoundingClientRect().right),
      colL:Math.round(document.querySelector('.rcol').getBoundingClientRect().left)}));
    out.push((mm.left>=ob.railR&&mm.right<=ob.colL?'✅':'❌')
      +` ${w}×${h}：建模投影 ${mm.left}→${mm.right} 完全落在左栏(${ob.railR})与右列(${ob.colL})之间，不伸到透明浮层底下`);
    await p4.close();
  }
}
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,8).join('\n'));
await b.close();
