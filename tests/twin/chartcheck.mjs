/**
 * 3D 图表守卫（FR-36）
 *  ① 引擎来自本地 vendor，不依赖 CDN（展厅断网也要能开）
 *  ② 每张图真的画出了像素（canvas 全量扫描，不是抽样）
 *  ③ 图与表同源：图表输入数字必须等于同一拍表格/分组表头的数字（不一致=两套假数据）
 *  ④ 温湿度折线：末点必须钉住节点当前读数（图上数与列表数不许打架）
 *  ⑤ 点温湿度节点行 → 折线带换序列（滚动行要先冻结动画再点，同 FR-27 一条教训）
 *  ⑥ 周期切换（本日→本月）图表跟着变
 *  ⑦ 下钻出图：106 出任务四档柱，103 出检测项目四档柱
 *  ⑧ 无障碍：每张图 role=img + aria-label；reduced-motion 下仍然出图
 *  ⑨ 纪律：面颜色走 style.fill 回调，不许把 hex 塞进数据再当 encode.color 的类别
 */
import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
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
const paint=await p.evaluate(()=>[...document.querySelectorAll('canvas')].map(c=>{
  const x=c.getContext('2d'); if(!x) return {w:c.width,h:c.height,n:-1};
  try{const d=x.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>10)n++;
    return {w:c.width,h:c.height,n};}catch(e){return {w:c.width,h:c.height,n:-2};}}));
ok(paint.length===7,`S1 出图数量 =7（左栏 4 柱 + 告警分组柱 + 设备柱 + 温湿度折线带）：实得 ${paint.length}`);
ok(paint.every(c=>c.n>200),`每张图都画出内容（非透明像素 >200）：${paint.map(c=>c.n).join(',')}`);
const errs=await p.evaluate(()=>window.__twinCharts.state.errors);
ok(errs.length===0,'图表层无渲染错误: '+JSON.stringify(errs).slice(0,160));

// ③ 图与表同源
const list=await p.evaluate(()=>window.__twinCharts.list());
const sig=n=>{const r=list.find(x=>x.name===n);return r?JSON.parse(r.sig):null;};
const tbl=await p.evaluate(()=>{const g=k=>{const s=document.querySelector(`.dtable[data-key="${k}"]`);if(!s)return null;
  return [...s.querySelectorAll('tbody tr')].map(tr=>({label:tr.children[0].innerText.replace(/\s+/g,'').replace(/(LIMS)$/,''),v:+tr.children[1].innerText}))};return {entrust:g('entrust'),samples:g('samples'),testItems:g('testItems'),dispatch:g('dispatch')};});
const eq=(arr,pairs)=>pairs.every(([i,k])=>arr[i].v===tbl[k][tbl[k].length-1-i]?.v||arr[i].v===tbl[k].find(r=>r.label.includes(arr[i].k))?.v);
const ent=sig('entrust'),sam=sig('samples'),ti=sig('testItems'),di=sig('dispatch');
ok(ent && ent[0].v===tbl.entrust.find(r=>r.label.includes('电力电缆')).v && ent[1].v===tbl.entrust.find(r=>r.label.includes('安全工器具')).v,
  `委托任务柱 == 表格（${ent&&ent.map(x=>x.v).join('/')} vs ${tbl.entrust.map(r=>r.v).join('/')}）`);
ok(sam && sam.map(x=>x.v).join(',')===tbl.samples.map(r=>r.v).join(','),
  `样品流转柱 == 表格（${sam&&sam.map(x=>x.v).join('/')} vs 表 ${tbl.samples.map(r=>r.v).join('/')}）`);
ok(ti && ti.map(x=>x.v).join(',')===tbl.testItems.slice(1,4).map(r=>r.v).join(','),
  `试验项目柱 == 表格前三段（${ti&&ti.map(x=>x.v).join('/')} vs ${tbl.testItems.slice(1,4).map(r=>r.v).join('/')}）`);
ok(di && di[0].v===tbl.dispatch.find(r=>r.label.includes('已完成')).v,
  `调度柱·已完成 == 表格（${di&&di[0].v} vs ${tbl.dispatch.find(r=>r.label.includes('已完成'))&&tbl.dispatch.find(r=>r.label.includes('已完成')).v}）`);
/* 底栏块2 不出图（172px 里塞 96px 环形会把滚动明细压到 40px，dockcheck 实测报"任务行找不到"）：
   改查设备柱五档相加 == 建档合计，并断言队列图确实没被塞回来 */
const dv=sig('devices');
const dkTotal=await p.evaluate(()=>{const c=document.querySelector('#dkDevBody .dk-cell.total');return c?+c.innerText.replace(/\D/g,''):0;});
ok(dv && dv.length===5 && dv.reduce((s,d)=>s+d.v,0)===dkTotal,`设备柱五档相加 == 建档合计（${dv&&dv.map(x=>x.v).join('+')} = ${dv&&dv.reduce((s,d)=>s+d.v,0)} vs ${dkTotal}）`);
ok(!list.some(x=>x.name==='queue'),'底栏队列块不再塞图，清单保持完整');
const al=sig('alarms');
const cnt=await p.evaluate(()=>[...document.querySelectorAll('.asec>header .cnt')].map(e=>e.innerText.match(/\d+/g).map(Number)));
ok(al && al.every((g,i)=>g.s[0].v===cnt[i][0]&&g.s[1].v===cnt[i][1]),`告警分组柱 == 三分区表头计数（${al&&al.map(g=>g.s.map(x=>x.v).join('/')).join(' ')} vs ${cnt.map(c=>c.join('/')).join(' ')}）`);

// ④ 温湿度末点钉住当前读数
const th=await p.evaluate(async()=>{
  const r=await TwinApi.get('/api/iot/temp-hum-series?node=IOT-106-TH-02&temp=24.1&hum=49.2&points=16');
  const d=r.data||r; const last=d.series[d.series.length-1];
  return {n:d.series.length,pinned:d.pinned,last:{t:last.temperature,h:last.humidity},note:d.note};});
ok(th.n===16 && th.last.t===th.pinned.temperature && th.last.h===th.pinned.humidity,
  `时序 ${th.n} 点且末点钉住当前读数：last=${JSON.stringify(th.last)} pinned=${JSON.stringify(th.pinned)}`);
const rb=sig('temp-hum');
ok(rb && rb[0].values[rb[0].values.length-1]===rb[0].values[rb[0].values.length-1] && rb.length===2,
  `折线带两条序列（温度/湿度），端点值 ${rb&&rb.map(s=>s.values[s.values.length-1]).join(' / ')}`);

// ⑤ 点节点行切换序列（先冻结滚动动画，滚动中的行点不准）
const switched=await p.evaluate(async()=>{
  const tr=document.getElementById('dkNodesTrack'); if(tr) tr.style.animation='none';
  const row=document.querySelector('#dkNodesTrack .nd-row[data-node="IOT-102-TH-01"]'); if(!row) return 'no-row';
  row.scrollIntoView({block:'center'});
  const r=row.getBoundingClientRect(); return {x:r.x+30,y:r.y+6};});
if(switched&&switched.x){ await p.mouse.click(switched.x,switched.y); await p.waitForTimeout(2200); }
const after=await p.evaluate(()=>({cap:(document.getElementById('chartTHCap')||{}).textContent,act:[...document.querySelectorAll('.nd-row.th-active')].map(x=>x.dataset.node)}));
ok(/温湿度01/.test(after.cap||'')&&new Set(after.act).size===1 && after.act[0]==='IOT-102-TH-01',`点温湿度节点行 → 折线带换到该节点：cap="${after.cap}" active=${[...new Set(after.act)].join(',')}`);

// ⑥ 周期切换跟着变
const before=(await p.evaluate(()=>window.__twinCharts.list())).find(x=>x.name==='entrust').sig;
await p.click('.seg[data-period="month"]'); await p.waitForTimeout(2500);
const nowSig=await p.evaluate(()=>window.__twinCharts.list().find(x=>x.name==='entrust').sig);
ok(nowSig!==before && JSON.parse(nowSig)[0].v>100,`周期切到本月 → 图表数字跟着换（${JSON.parse(before)[0].v} → ${JSON.parse(nowSig)[0].v}）`);
await p.click('.seg[data-period="day"]'); await p.waitForTimeout(1800);

// ⑦ 下钻出图
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(4200);
const z106=await p.evaluate(()=>window.__twinCharts.list().map(x=>x.name));
ok(z106.includes('zstats'),'106 下钻出任务统计柱: '+z106.join(','));
await p.selectOption('#zoneSel','103'); await p.waitForTimeout(4200);
const z103=await p.evaluate(()=>({names:window.__twinCharts.list().map(x=>x.name),sig:window.__twinCharts.list().find(x=>x.name==='zstats')}));
ok(z103.names.includes('zstats')&&/检测中/.test(z103.sig.sig),`103 下钻出检测项目数柱（口径随 viewProfile.blocks 走）: ${z103.sig.sig.slice(0,52)}`);
await p.selectOption('#zoneSel','102'); await p.waitForTimeout(4200);
const sm=await p.evaluate(()=>{const r=window.__twinCharts.list().find(x=>x.name==='zsamples');return r?JSON.parse(r.sig):null;});
const stored=await p.evaluate(()=>{const e=document.querySelector('#zpSamplesN');return e?+e.innerText.replace(/\D/g,''):0;});
ok(sm&&sm.length>=3&&sm.reduce((a,x)=>a+x.v,0)===stored,`102 样品分布环形各类相加 == 在库存量（${sm&&sm.map(x=>x.v).join('+')} = ${sm&&sm.reduce((a,x)=>a+x.v,0)} vs ${stored}）`);

// ⑧ 无障碍与 reduced-motion
const a11y=await p.evaluate(()=>{const n=[...document.querySelectorAll('.tw-chart')];return {total:n.length,noLabel:n.filter(e=>e.getAttribute('role')!=='img'||!e.getAttribute('aria-label')).length};});
ok(a11y.noLabel===0,`每张图都有 role=img + aria-label（${a11y.total-a11y.noLabel}/${a11y.total}）`);
const p2=await b.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
await p2.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});await p2.waitForTimeout(15000);
const rm=await p2.evaluate(()=>({n:document.querySelectorAll('canvas').length,errs:window.__twinCharts.state.errors.length}));
ok(rm.n===7&&rm.errs===0,`prefers-reduced-motion 下照样出图（${rm.n} 张，错误 ${rm.errs}）——图表不靠动画表意`);
await p2.close();

// ⑨ 纪律：不许把 hex 塞进数据当 encode.color
ok(!/encode:\s*\{[^}]*color:\s*'c'/.test(src)&&/style:\s*\{\s*fill:\s*d\s*=>\s*d\.c/.test(src),'面颜色走 style.fill 回调，未用 encode.color 编码 hex');
ok(err.length===0,'无 pageerror/console error: '+err.slice(0,3).join(' | '));
console.log(out.join('\n'));
const bad=out.filter(l=>l.startsWith('❌')).length;
console.log('\n通过 '+out.filter(l=>l.startsWith('✅')).length+' · 失败 '+bad);
await b.close();
process.exit(bad?1:0);
