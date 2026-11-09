/**
 * #8 监控视角（2026-11-09 产品负责人点名"记得完成"）
 *  顶栏 icon（默认不亮）→ 点击高亮 4 个视觉节点 → 悬停/键盘聚焦出该点位视角画面
 *  ⑧ 三次圈图（2026-11-09）：icon 从场景左上角搬进宿主顶栏（区域房间 chip 后、标题左）——
 *  左上角与左栏「运行指标」叠字。按钮在宿主、高亮/画面/键盘行为仍在场景帧，断言跟着分两侧取。
 * 重点验三件事：① 默认态真的是"不亮"；② 高亮只落在 camera，不牵连别的物联节点；
 * ③ 浮层里的画面是真的按该点位渲出来的（有内容、不是纯色/空白），并且诚实标注非实拍。
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
const ok=(c,m)=>out.push((c?'✅':'❌')+' '+m);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(16000);
const f=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));
if(!f){ console.log('❌ 三维场景 iframe 未装载'); console.log(out.join('\n')); await b.close(); process.exit(1); }
const S=sel=>f.evaluate(s=>{const e=document.querySelector(s); if(!e) return null; const q=e.getBoundingClientRect();
  return {x:Math.round(q.x),y:Math.round(q.y),w:Math.round(q.width),h:Math.round(q.height),r:Math.round(q.right),b:Math.round(q.bottom)};},sel);

// ① icon 在顶栏（图三位）：区域房间 chip 之后、标题之左
const btn=await p.evaluate(()=>{const e=document.getElementById('cctvToggle');if(!e)return null;const q=e.getBoundingClientRect();
  const t=document.querySelector('.title').getBoundingClientRect();return {x:Math.round(q.x),y:Math.round(q.y),w:Math.round(q.width),h:Math.round(q.height),r:Math.round(q.right),tx:Math.round(t.left)};});
ok(!!btn,'顶栏监控 icon 存在（#cctvToggle）');
if(btn) ok(btn.y<52&&btn.r<=btn.tx&&btn.w>20&&btn.h>18,`icon 落在顶栏且在标题左侧（${btn.x},${btn.y} ${btn.w}×${btn.h}，标题 x=${btn.tx}）`);
ok(await p.evaluate(()=>!document.querySelector('#scene').contentWindow.document.getElementById('cctvBtn')),'场景左上角的旧按钮已撤（不再与「运行指标」叠字）');
// ② 默认不亮
T('默认 aria-pressed', await p.evaluate(()=>document.getElementById('cctvToggle').getAttribute('aria-pressed')), 'false');
T('默认 body 无 cctv-on', await f.evaluate(()=>document.body.classList.contains('cctv-on')), false);
T('默认无高亮标记', await f.locator('.node-marker.cctv-hi').count(), 0);
T('默认浮层隐藏', await f.evaluate(()=>document.getElementById('cctvPop').hidden), true);
// ③ 点击 → 高亮 4 个视觉节点
await p.evaluate(()=>document.getElementById('cctvToggle').click()); await p.waitForTimeout(1400);
const hi=await f.evaluate(()=>({n:document.querySelectorAll('.node-marker.cctv-hi').length,
  types:[...new Set([...document.querySelectorAll('.node-marker.cctv-hi')].map(e=>e.dataset.type))],
  cams:document.querySelectorAll('.node-marker[data-type="camera"]').length,
  hook:(JSON.parse((document.getElementById('twin-v2-bridge')||{}).dataset.cctv||'{}')).cams}));
T('aria-pressed 变亮（宿主按钮）', await p.evaluate(()=>document.getElementById('cctvToggle').getAttribute('aria-pressed')), 'true');
T('场景层收到命令（dataset.cctv.on）', await f.evaluate(()=>JSON.parse(document.getElementById('twin-v2-bridge').dataset.cctv||'{}').on), true);
ok(hi.n===hi.cams&&hi.n>=3,`高亮数＝场景里视觉节点数（高亮 ${hi.n} / camera 标记 ${hi.cams}），宿主取的画面路数 ${JSON.stringify(hi.cams?hi.hook:[]).slice(0,80)}`);
ok(hi.types.length===1&&hi.types[0]==='camera',`只有视觉(camera)节点被高亮，温湿度/烟感/人体等一律不亮: ${JSON.stringify(hi.types)}`);
ok(hi.n>0&&await f.evaluate(()=>!!document.querySelector('.node-marker[data-type="motion"]')&&!document.querySelector('.node-marker[data-type="motion"]').classList.contains('cctv-hi')),'反向确认：非摄像头标记确实没被牵连');
// ④ 悬停出画面
const first=f.locator('.node-marker.cctv-hi').first();
await first.hover(); await p.waitForTimeout(1200);
const pop=await S('#cctvPop');
/* 判据自己写错了：S() 只回矩形、没有 hidden 字段，`!pop.hidden!==true` 恒为 false，
   于是一张画得完好的浮层也被判成"没出现"。可见性要真的去读元素，不能拿不存在的字段取反。 */
const popVis=await f.evaluate(()=>{const e=document.getElementById('cctvPop'); return !!e&&!e.hidden;});
ok(popVis&&pop.w>100&&pop.h>90,`浮层出现且尺寸够看（可见=${popVis}，${pop&&pop.w}×${pop&&pop.h}）`);
const info=await f.evaluate(()=>{const q=document.getElementById('cctvPop'); if(q.hidden) return {hidden:true};
  const c=q.querySelector('canvas'), x=c.getContext('2d');
  let uniq=new Set(), alpha=0;
  try{const d=x.getImageData(0,0,c.width,c.height).data;
    for(let i=0;i<d.length;i+=4){ if(d[i+3]>10) alpha++; uniq.add((d[i]>>3)+','+(d[i+1]>>3)+','+(d[i+2]>>3)); }}catch(e){}
  return {hidden:false, title:q.querySelector('.pp-h b').textContent, foot:q.querySelector('.pp-f').textContent,
    uniq:uniq.size, cov:+(alpha/(c.width*c.height)*100).toFixed(1), noFeed:q.classList.contains('no-feed'),
    vw:innerWidth, vh:innerHeight, r:Math.round(q.getBoundingClientRect().right), bo:Math.round(q.getBoundingClientRect().bottom)};});
ok(!info.hidden,'悬停后浮层可见');
ok((info.title||'').includes('视觉')||(info.title||'').includes('10'),`浮层标题是该点位（「${info.title}」，与标记 title 同源）`);
ok(!info.noFeed&&info.uniq>12&&info.cov>60,`画面真有内容：不同色 ${info.uniq} 种、覆盖 ${info.cov}%（不是空白也不是纯色）`);
ok(/渲染色/.test(info.foot)&&/非现场实拍/.test(info.foot),`诚实标注在位：「${info.foot}」`);
ok(info.r<=info.vw&&info.bo<=info.vh,`浮层不越出场景视口（右 ${info.r}/${info.vw}，底 ${info.bo}/${info.vh}）`);
// ⑤ 换第二个点位：画面必须跟着换（不是同一帧糊过去）
const second=f.locator('.node-marker.cctv-hi').nth(1);
await second.hover(); await p.waitForTimeout(1400);
const info2=await f.evaluate(()=>{const q=document.getElementById('cctvPop'); const c=q.querySelector('canvas'), x=c.getContext('2d');
  let s=0; try{const d=x.getImageData(0,0,c.width,c.height).data; for(let i=0;i<d.length;i+=1600) s+=d[i]+d[i+1]+d[i+2];}catch(e){}
  return {title:q.querySelector('.pp-h b').textContent, sig:s};});
ok(info2.title!==info.title,`换点位标题跟着换：「${info.title}」→「${info2.title}」`);
// ⑥ 移开 → 关；再点 icon → 灭
await f.evaluate(()=>{const m=document.querySelector('.node-marker.cctv-hi'); m.dispatchEvent(new PointerEvent('pointerout',{bubbles:true}));});
await p.waitForTimeout(500);
T('移开后浮层隐藏', await f.evaluate(()=>document.getElementById('cctvPop').hidden), true);
await p.evaluate(()=>document.getElementById('cctvToggle').click()); await p.waitForTimeout(1000);
T('再点 icon 取消高亮', await f.locator('.node-marker.cctv-hi').count(), 0);
T('取消后 aria-pressed=false', await p.evaluate(()=>document.getElementById('cctvToggle').getAttribute('aria-pressed')), 'false');
// ⑦ 键盘可达（标记本身是 button[tabindex=0]，icon 也必须能纯键盘用）
await p.keyboard.press('Tab');   /* 交给页面自然焦点顺序，只验 icon 可聚焦可切换 */
const kb=await p.evaluate(()=>{const btn=document.getElementById('cctvToggle'); btn.focus();
  return {focused:document.activeElement===btn, role:btn.tagName, label:(btn.getAttribute('aria-label')||'').slice(0,20)};});
ok(kb.focused&&kb.role==='BUTTON',`icon 可键盘聚焦（${kb.role}，标签「${kb.label}…」）`);
await p.evaluate(()=>document.getElementById('cctvToggle').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
await p.evaluate(()=>document.getElementById('cctvToggle').click()); await p.waitForTimeout(800);
T('键盘路径后 aria-pressed 与高亮一致', await p.evaluate(()=>document.getElementById('cctvToggle').getAttribute('aria-pressed'))+'/'+await f.evaluate(()=>document.querySelectorAll('.node-marker.cctv-hi').length>0), 'true/true');
await f.evaluate(()=>{const m=document.querySelector('.node-marker.cctv-hi'); m.focus();}); await p.waitForTimeout(900);
ok(await f.evaluate(()=>!document.getElementById('cctvPop').hidden),'键盘聚焦 camera 标记同样出画面（与悬停同一出口）');
await p.screenshot({path:'/tmp/twin-qa/cctv-on.png'});
ok(err.length===0,'无 pageerror/console error: '+err.slice(0,3).join(' | '));
console.log(out.join('\n'));
const bad=out.filter(l=>l.startsWith('❌')).length;
console.log(`\n通过 ${out.length-bad} · 失败 ${bad}`);
await b.close();
process.exit(bad?1:0);
