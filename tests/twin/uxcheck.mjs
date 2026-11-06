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
out.push(((await p.evaluate(()=>getComputedStyle(document.querySelector('.rail')).backdropFilter.includes('blur')))?'✅':'❌')+' 左栏=透明玻璃浮层（backdrop-filter blur）');
out.push(((await p.evaluate(()=>getComputedStyle(document.querySelector('.stream')).backdropFilter.includes('blur')))?'✅':'❌')+' 右侧=透明玻璃浮层');
out.push(((await p.evaluate(()=>getComputedStyle(document.querySelector('.tasktable')).backdropFilter.includes('blur')))?'✅':'❌')+' 底栏=透明玻璃浮层');
out.push(((await p.evaluate(()=>{const r=document.getElementById('scene').getBoundingClientRect();const l=document.querySelector('.rail').getBoundingClientRect();return l.x>r.x&&l.y>r.y;}))?'✅':'❌')+' 浮层确实悬浮在三维画面之上（非分栏布局）');
T('四张数据表', await p.locator('.dtable').count(), 4);
out.push(((await p.locator('.dtable .pct').allInnerTexts()).filter(x=>/%/.test(x)).length>=6?'✅':'❌')+' 表内占比列（替代原环形/条形图）: '+((await p.locator('.dtable .pct').allInnerTexts()).filter(x=>/%/.test(x))).join(','));
out.push(((await p.locator('.dtable>header .src').allInnerTexts()).every(x=>/数采|调度/.test(x)&&/\d{2}:\d{2}:\d{2}/.test(x))?'✅':'❌')+' 每表表头带来源+更新时间');
out.push(((await p.locator('#streamMeta').innerText()).includes('未解除')?'✅':'❌')+' 告警流头部汇总（今日/未解除）: '+(await p.locator('#streamMeta').innerText()).replace(/\s+/g,' '));
const secCnt=await p.locator('.asec>header .cnt').allInnerTexts();
out.push((secCnt.length===3&&secCnt.every(x=>/今日 \d+ · 未解除 \d+/.test(x))?'✅':'❌')+' 三分区各自今日计数: '+secCnt.join(' | '));
out.push(((await p.locator('.asec>header .gd').allInnerTexts()).join('')==='ABC'?'✅':'❌')+' 分区徽标只有 A/B/C（无 Grade 英文）: '+(await p.locator('.asec>header .gd').allInnerTexts()).join(','));
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
// 4) 底栏=今日任务滚动表格
T('底栏表头列数', await p.locator('.tt-head span').count(), 5);
T('底栏行数(2×任务数做无缝滚动)', await p.locator('.tt-row').count(), 10);
out.push(((await p.evaluate(()=>getComputedStyle(document.getElementById('ttTrack')).animationName))==='ttUp'?'✅':'❌')+' 底栏滚动动画: '+await p.evaluate(()=>getComputedStyle(document.getElementById('ttTrack')).animationName));
out.push(((await p.evaluate(()=>getComputedStyle(document.querySelector('.tasktable')).backgroundColor)).includes('255, 255, 255, 0.42')?'✅':'❌')+' 底栏透明底');
// 5) 右侧告警流滚动
T('告警流行数(三区各 3×2)', await p.locator('.st-row').count(), 18);
const asecAnim=await p.evaluate(()=>[...document.querySelectorAll('.asec-track')].map(t=>getComputedStyle(t).animationName));
out.push((asecAnim.length===3&&asecAnim.every(x=>x==='asecUp')?'✅':'❌')+' 每个分区独立滚动（非整块滚动）: '+asecAnim.join(','));
out.push(((await p.evaluate(()=>getComputedStyle(document.getElementById('streamTrack')).animationName))==='none'?'✅':'❌')+' 外层 .stream-board 不再整体滚动（分区表头不飘）');
// 6) 循环剧本
const cy=await p.locator('#cycleBox').innerText();
out.push((/\d\/11/.test(cy)&&/无人化循环/.test(cy)?'✅':'❌')+' 无人化循环指示: '+cy.replace(/\s+/g,' ').slice(0,90));
/* 剧本运动：先在场景内起 100ms 记录器（避免每 400ms 一次跨进程往返的抖动），
   并且**对齐到下一次停靠**再开窗——盲开 28s 窗口可能整段落在 26.5s 的 102→106 长行走段里，
   那样「出现停靠静止」就会假失败（animation-spec §16）。 */
const live0=await p.evaluate(async()=>{const l=(await TwinApi.get('/api/zone/106/cycle')).data.live;return l&&{phase:l.phase,remainingSec:l.remainingSec};});
if(live0&&live0.phase==='travel') await p.waitForTimeout(Math.min(28000,(live0.remainingSec+0.6)*1000));
await ev(()=>{window.__rec=[];window.__recT=setInterval(()=>{const m=window.visual106.modelRoots.get('106-08');
  if(m) window.__rec.push([performance.now(),m.position.x,m.position.z]);},100);});
await p.waitForTimeout(26000);
const rec=await ev(()=>{clearInterval(window.__recT);return window.__rec;});
/* 速度按 0.5s 滑窗算：单帧间隔（动画环 66ms + 偶发长帧）会把 0.75m/s 的剧本速度抖成 1.0+，
   那是采样假象不是超速；滑窗既保留真实速度又抗抖。停靠判定仍用逐帧位移（停靠时逐帧就是 0）。 */
let moved=0, peak=0, dwellRun=0, maxDwellRun=0, speeds=[], stillMs=0, W=5;
for(let i=1;i<rec.length;i++){ const a=rec[i-1], b=rec[i]; const dt=(b[0]-a[0])/1000; if(dt<=0.02) continue;
  const d=Math.hypot(b[1]-a[1],b[2]-a[2]); moved+=d;
  if(d<0.004){ dwellRun+=dt; } else { maxDwellRun=Math.max(maxDwellRun,dwellRun); dwellRun=0; }
  if(i>=W){ const c=rec[i-W], dtw=(b[0]-c[0])/1000, dw=Math.hypot(b[1]-c[1],b[2]-c[2]);
    if(dtw>0.3){ const v=dw/dtw; if(v>1.0) speeds.push(+v.toFixed(2)); peak=Math.max(peak,v); } } }
maxDwellRun=Math.max(maxDwellRun,dwellRun); stillMs=maxDwellRun;
/* 位移总量取决于采样窗口落在剧本的哪一段（含 6–12s 停靠），所以按「速度」而非「距离」判定 */
out.push((moved>3&&peak<=1.0&&peak>=0.6&&stillMs>=1.5&&speeds.length===0?'✅':'❌')+` 小机器人按剧本行进：0.5s 滑窗速度峰值 ${peak.toFixed(2)}m/s（剧本 0.75）· 连续停靠静止 ${stillMs.toFixed(1)}s · 窗口内位移 ${moved.toFixed(2)}m · 超速样本 ${speeds.length}（采样 ${rec.length} 点/100ms）`);
// 停靠站与剧本一致：UI 报的站序必须等于端点 live.order
const both=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');return {live:r.data.live, ui:document.getElementById('cycleBox').innerText.replace(/\s+/g,' ')};});
const sa=both.live; const uiTxt=both.ui;
out.push((uiTxt.includes(sa.order+'/11')?'✅':'❌')+` 停靠站与剧本一致：UI「${uiTxt.slice(0,42)}」↔ 端点 order=${sa.order}(${sa.label})`);
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
// 8) 点击实体 → 切近补间 + 信息卡（含非数采的桌子）
const camBefore=await cam();
await ev(()=>{window.dispatchEvent(new CustomEvent('space-device-select',{detail:{id:'106-12'}}));});
const seq=[]; for(let i=0;i<7;i++){ await p.waitForTimeout(110); seq.push((await cam())[3]); }
out.push((new Set(seq).size>=3?'✅':'❌')+` 切近为补间动画（${camBefore[3]} → 序列 ${seq.join(' → ')}）`);
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
