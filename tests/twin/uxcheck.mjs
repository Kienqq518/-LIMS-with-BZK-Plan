import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
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
out.push(((await p.evaluate(()=>getComputedStyle(document.querySelector('.dk')).backdropFilter.includes('blur')))?'✅':'❌')+' 底栏四块=透明玻璃浮层');
out.push(((await p.evaluate(()=>{const r=document.getElementById('scene').getBoundingClientRect();const l=document.querySelector('.rail').getBoundingClientRect();return l.x>r.x&&l.y>r.y;}))?'✅':'❌')+' 浮层确实悬浮在三维画面之上（非分栏布局）');
T('四张数据表', await p.locator('.dtable').count(), 4);
out.push(((await p.locator('.dtable .pct').allInnerTexts()).filter(x=>/%/.test(x)).length>=6?'✅':'❌')+' 表内占比列（替代原环形/条形图）: '+((await p.locator('.dtable .pct').allInnerTexts()).filter(x=>/%/.test(x))).join(','));
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
T('默认图层', (await hook()).layers, 'path,labels');
await p.click('.lic[data-layer=labels]'); await p.waitForTimeout(1200);
T('关场地标签后图层', (await hook()).layers, 'path');
T('关场地标签→设备状态光点不受影响', await ev(()=>{const v=window.visual106;let n=0,vis=0;v.detail.traverse(o=>{if(o.isMesh&&o.geometry&&o.geometry.type==='SphereGeometry'){n++;if(o.visible)vis++;}});return n&&vis===n?'dots-untouched':'visible='+vis+'/'+n;}), 'dots-untouched');
T('关场地标签→房间名称全部隐藏', await ev(()=>{const v=window.visual106;return v.labels.filter(l=>getComputedStyle(l.div).display!=='none').length===0?'all-hidden':'some-visible';}), 'all-hidden');
T('物联节点身份标签已下线（只留点击弹窗）', await ev(()=>document.querySelectorAll('.orb-tag').length), 0);
await p.click('.lic[data-layer=labels]'); await p.waitForTimeout(900);
// 2) 墙体剖切真的生效
const wallH=()=>ev(()=>{const v=window.visual106;let m=null;v.overview.children.forEach(c=>{if(c.isMesh&&c.material&&c.material.transparent&&c.material.color&&c.material.color.getHex()===0xbbcbd7)m=c;});if(!m)return 'no-wall';const a=m.geometry.attributes.position;let hi=0;for(let s=0;s*18<a.length;s++)hi=Math.max(hi,a[s*18+7]);return {top:+hi.toFixed(2),op:+m.material.opacity.toFixed(2)};});
const wOn=await wallH();
const wOff=await wallH();
out.push((wOn.op<=0.13?'✅':'❌')+` 墙体剖切为固定渲染行为（外墙不透明度恒 ${JSON.stringify(wOn)}，无开关）`);
// 3) 热力：106 高、其他最低
await p.click('.lic[data-layer=heatmap]'); await p.waitForTimeout(1500);
T('热力图层', (await hook()).layers, 'path,labels,heatmap');
const heatR=await ev(()=>{const g=window.visual106.scene.getObjectByName('twin-v2-heat');return {exists:!!g,layers:document.getElementById('twin-v2-bridge')?.dataset.layers,n:g?g.children.length:0,items:g?g.children.map(c=>({x:+c.position.x.toFixed(1),z:+c.position.z.toFixed(1),o:+c.material.opacity.toFixed(3)})):[]};});
const heat=heatR.items; out.push((heatR.exists&&heatR.n>0?'✅':'❌')+` 热力图斑存在: ${heatR.n} 块（layers=${heatR.layers}）`);
const in106=heat.filter(h=>h.x>=9&&h.x<=18.5&&h.z>=9.6&&h.z<=28.1), other=heat.filter(h=>!(h.x>=9&&h.x<=18.5&&h.z>=9.6&&h.z<=28.1));
out.push(((in106.length&&Math.max(...in106.map(h=>h.o))>=0.15&&(!other.length||Math.max(...other.map(h=>h.o))<=0.08))?'✅':'❌')+` 热力分级：106 ${in106.length}块 max=${in106.length?Math.max(...in106.map(h=>h.o)):'-'} / 其他 ${other.length}块 max=${other.length?Math.max(...other.map(h=>h.o)):'-'}`);
await p.click('.lic[data-layer=heatmap]'); await p.waitForTimeout(600);
// 4) 底栏=四块（设备统计 / 调度任务队列 / 委托单试验项 / 组态物联节点），除统计块外各自滚动
T('底栏块数（组态物联已挪到右列）', await p.locator('.dock .dk').count(), 3);
T('底栏滚动轨道数（块1 是统计格不滚）', await p.locator('.dk-track').count(), 3);
out.push(((await p.evaluate(()=>getComputedStyle(document.getElementById('dkQueueTrack')).animationName))==='dkUp'?'✅':'❌')+' 队列块滚动动画: '+await p.evaluate(()=>getComputedStyle(document.getElementById('dkQueueTrack')).animationName));

// 不钉死具体 alpha（玻璃透明度是 token，改一档就假失败）：验语义——半透明白 + 真模糊
const dkGlass=await p.evaluate(()=>{const e=getComputedStyle(document.querySelector('.dk'));return {bg:e.backgroundColor,blur:e.backdropFilter};});
const dkAlpha=(dkGlass.bg.match(/rgba\(255, 255, 255, ([0-9.]+)\)/)||[])[1];
out.push((+dkAlpha>=.3&&+dkAlpha<=.7&&/blur\(\d+px\)/.test(dkGlass.blur)?'✅':'❌')+` 底栏块=半透明玻璃底（alpha ${dkAlpha} + ${dkGlass.blur}）`);
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
const nominal=0.75, minMoved=travelSec*nominal*0.6;
out.push((travelSec>=2&&moved>=minMoved&&peak<=1.0&&peak>=0.6&&stillMs>=1.5&&speeds.length===0?'✅':'❌')
  +` 小机器人按剧本行进：0.5s 滑窗速度峰值 ${peak.toFixed(2)}m/s（剧本 ${nominal}）· 连续停靠静止 ${stillMs.toFixed(1)}s · 行进 ${travelSec.toFixed(1)}s 走 ${moved.toFixed(2)}m（下限 ${minMoved.toFixed(2)}m）· 超速样本 ${speeds.length}（采样 ${rec.length} 点/100ms）`);
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
await p.selectOption('#zoneSel','106'); 
const samples=[]; for(let i=0;i<7;i++){ await p.waitForTimeout(140); samples.push(await cam()); }
const uniq=new Set(samples.map(s=>s.join(','))).size;
out.push((uniq>=4?'✅':'❌')+` 下钻为补间动画（800ms 内采到 ${uniq} 个不同机位）`);
out.push(((samples[6][3]<c0[3]-1)?'✅':'❌')+` 下钻是推近（画面半高 ${c0[3]} → ${samples[6][3]}）`);
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
out.push(((/无实时数据|非数采对象/.test(card2))?'✅':'❌')+' 桌子/凳子也有信息卡（诚实显示无实时数据）: '+card2.slice(0,110));
// 9) 场景内避让自检仍然 0 违规（新路线）
const A=await ev(()=>{const e=document.getElementById('twin-v2-route-audit');return e?{v:+e.dataset.violations,c:+e.dataset.checked,d:e.dataset.detail}:null;});
out.push((A&&A.v===0?'✅':'❌')+` 新循环路线避让校验: ${A&&A.c} 采样点 违规 ${A&&A.v} ${A&&A.v?A.d:''}`);
await p.screenshot({path:'/tmp/twin-qa/ux-device.png'});
await p.keyboard.press('1'); await p.waitForTimeout(3000); await p.screenshot({path:'/tmp/twin-qa/ux-s1.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,8).join('\n'));
await b.close();
