/**
 * 机器人编排（2026-11-06 反馈：一台停充电位、只留一台跑）
 * 守的是三件事：① 停靠位真的是 102-05 充电桩中心 ② 全场只有一台在动 ③ 停靠的那台不参与卡住判定、电量只回升
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
const ev=(fn,...a)=>f.evaluate(fn,...a);

// ① 数据口径：RB-C-01 停靠、RB-C-02 在跑
const seed=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/robots');return r.data.map(x=>({id:x.robotId,action:x.action,parked:!!x.parked,bay:x.chargingBay,path:(x.path||[]).length,zones:x.allowedZones,task:x.currentFlowName,elapsed:x.taskElapsedMin}));});
const r1=seed.find(x=>x.id==='RB-C-01'), r2=seed.find(x=>x.id==='RB-C-02');
out.push((r1&&r1.parked&&r1.action==='charging'&&r1.path===1&&r1.bay==='102-05'?'✅':'❌')+' RB-C-01 停靠充电（单点路径、无任务、桩号 102-05）: '+JSON.stringify(r1));
out.push((r2&&!r2.parked&&r2.path>1?'✅':'❌')+' RB-C-02 是唯一在跑的循环机器人（多段路径）: '+JSON.stringify({path:r2.path,action:r2.action}));
T('停靠机器人允许区域=102', JSON.stringify(r1.zones), '["Z-102"]');

// ② 场景里真的停在桩中心（102-05 实测占地 x 26.04–26.84 / z 13.07–13.88）
const pos=await ev(()=>{const v=window.visual106,m=v.modelRoots.get('106-09');return m?{x:+m.position.x.toFixed(2),z:+m.position.z.toFixed(2)}:null;});
out.push((pos&&Math.abs(pos.x-26.44)<0.06&&Math.abs(pos.z-13.48)<0.06?'✅':'❌')+' 106-09 本体停在充电位中心 (26.44,13.48): '+JSON.stringify(pos));
const hook=await ev(()=>document.getElementById('twin-v2-bridge')?.dataset||{});
T('桥接层在跑/停靠划分', [hook.robotsMoving,hook.robotsParked].join(' | '), 'RB-C-02 | RB-C-01@102-05');

/* ③ 事件驱动的采样窗（≤40s，两种相位都见到就收）：停靠的不动、在跑的既推进剧本也真的走路。
   窗口太短会整段落在 dwell 里 → 位移接近 0，那是剧本相位不是 bug（animation-spec §16 的老坑）。 */
const sample=async()=>ev(()=>{const v=window.visual106,a=v.modelRoots.get('106-09'),c=v.modelRoots.get('106-08');
  return [a.position.x,a.position.z,c.position.x,c.position.z];});
const cyc=async()=>p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/cycle');const l=r.data.live;return l&&{order:l.order,u:l.u,phase:l.phase,remainingSec:l.remainingSec};});
const s0=await sample(), c0=await cyc();
/* 先对齐到「下一次停靠」再采样：盲开 30s 窗口可能整段落在 26.5s 的 102→106 长行走段里，
   那样位移/停靠断言就会假失败（animation-spec §16：观察窗要么 ≥ 一圈，要么对齐到目标事件） */
if(c0&&c0.phase==='travel'&&c0.remainingSec) await p.waitForTimeout(Math.min(28000,(c0.remainingSec+0.6)*1000));
/* 采样窗按「事件」收，不按固定 26 次收：连跑多套时主线程变慢，对齐等待落点会漂，
   固定窗可能整段卡在长航段里看不到停靠（实测全量跑就是这样假失败一次，单跑必绿）。
   上限 40 次（≈60s）兜底，两种相位都见到就提前收工。 */
let movedParked=0, movedRun=0, phaseSeen=new Set();
for(let i=0;i<40;i++){ await p.waitForTimeout(1000); const q=await sample();
  movedParked=Math.max(movedParked,Math.hypot(q[0]-s0[0],q[1]-s0[1]));
  movedRun=Math.max(movedRun,Math.hypot(q[2]-s0[2],q[3]-s0[3]));
  const cc=await cyc(); if(cc) phaseSeen.add(cc.phase);
  if(phaseSeen.has('dwell')&&phaseSeen.has('travel')&&movedRun>0.5) break; }
const c1=await cyc();
out.push((movedParked<0.02?'✅':'❌')+` 停靠的 RB-C-01 全程没动（窗内最大位移 ${movedParked.toFixed(3)}m）`);
out.push((movedRun>0.5?'✅':'❌')+` 在跑的 RB-C-02 真的在走路（对齐停靠后按事件收窗，最大位移 ${movedRun.toFixed(2)}m）`);
out.push(((c1&&(c1.order!==c0.order||c1.u>c0.u))?'✅':'❌')+` 循环剧本相位推进：${JSON.stringify(c0)} → ${JSON.stringify(c1)}`);
out.push((phaseSeen.has('dwell')?'✅':'❌')+' 窗口内至少覆盖一次停靠相位: '+[...phaseSeen].join(','));

// ④ 电量只回升（不掉电）
const bat=await p.evaluate(async()=>{const a=await TwinApi.get('/api/zone/106/robots');const b1=a.data.find(x=>x.robotId==='RB-C-01').battery;
  await new Promise(r=>setTimeout(r,5000)); const c=await TwinApi.get('/api/zone/106/robots');return [b1,c.data.find(x=>x.robotId==='RB-C-01').battery];});
out.push((bat[1]>=bat[0]?'✅':'❌')+` 桩上电量回升不掉的：${bat[0]}% → ${bat[1]}%`);

// ⑤ 面板：停靠行说清停在哪、不判卡住；机器人行键盘可达（FR-27 复用）
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(3000);
const dev=await p.locator('#zpDevices').innerText();
out.push((/RB-C-01[\s\S]{0,80}停靠充电/.test(dev)&&/102-05 充电位/.test(dev)?'✅':'❌')+' 面板 RB-C-01 行=停靠充电 + 桩号: '+dev.replace(/\s+/g,' ').match(/RB-C-01[\s\S]{0,70}/)[0]);
out.push((!dev.includes('疑似卡住')?'✅':'❌')+' 停靠不再被误判卡住（全场无「疑似卡住」）');
out.push(((await p.locator('#zpRunning').innerText()).includes('超时')?'✅':'❌')+' 卡住叙事改由在制任务超时承载（Q4 仍可答）');
const rbRow=p.locator('#zpDevices [data-robot="RB-C-01"]');
T('机器人行键盘可达（role/tabindex）', await rbRow.evaluate(e=>[e.getAttribute('role'),e.getAttribute('tabindex')].join('/')), 'button/0');
await rbRow.focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(1200);
const det=await p.evaluate(()=>({open:!document.getElementById('detail').hidden,txt:document.getElementById('detailBody').innerText.replace(/\s+/g,' ')}));
out.push((det.open&&/停靠充电/.test(det.txt)&&/停靠位置 102-05 充电位/.test(det.txt)&&/演示只跑一台/.test(det.txt)?'✅':'❌')+' 回车打开机器人详情（openRobot 补齐，此前被删后仍被调用）: '+det.txt.slice(0,150));

// ⑥ 告警主体必须是在跑的那台
const bad=await p.evaluate(async()=>{const a=await TwinApi.get('/api/overview/alarms');const r=await TwinApi.get('/api/zone/106/robots');
  const parked=r.data.filter(x=>x.parked).map(x=>x.robotId);
  return a.data.filter(x=>x.deviceId&&String(x.deviceId).indexOf('RB')===0&&parked.includes(x.deviceId)).map(x=>x.alarmId+'→'+x.deviceId);});
out.push((bad.length===0?'✅':'❌')+' 没有告警挂在停靠的机器人上: '+JSON.stringify(bad));
await p.screenshot({path:'/tmp/twin-qa/robot-parked.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
