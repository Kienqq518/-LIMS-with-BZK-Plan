import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,160));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
let f=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));
const A=await f.evaluate(()=>{const e=document.getElementById('twin-v2-route-audit');return e?{checked:+e.dataset.checked,obstacles:+e.dataset.obstacles,violations:+e.dataset.violations,detail:e.dataset.detail}:null;});
out.push((A&&A.violations===0?'✅':'❌')+` 场景内避让校验（独立复算）: 采样 ${A&&A.checked} 点 / 障碍 ${A&&A.obstacles} 个 / 违规 ${A&&A.violations} ${A&&A.violations?A.detail:''}`);
out.push((A&&A.checked>3000?'✅':'❌')+' 采样密度足够: '+A.checked);
out.push(((await p.locator('#auditBadge').count())===0?'✅':'❌')+' 避让校验常驻徽标已移除（界面不再显示）');
const ra=await p.evaluate(()=>document.body.dataset.routeAudit||'');
out.push((ra && ra.split('/')[0]==='0'?'✅':'❌')+' 自检结果改为 body[data-route-audit] 留痕（QA 可断言）: 违规/采样/障碍/墙 = '+ra);
/* —— 2026-11-06 反馈：黄线穿墙、只能走 102/106 两道门、走廊里要有线、墙上的绿色小方块不是门 —— */
const wallSet=await f.evaluate(()=>{const e=document.getElementById('twin-v2-route-audit');return e?{walls:+e.dataset.walls,checked:+e.dataset.checked,violations:+e.dataset.violations}:null;});
out.push((wallSet&&wallSet.walls>=4?'✅':'❌')+' 自检墙体已从 2 面扩到实测 '+wallSet.walls+' 面（102 西/106 东/106 南/走廊北端）: '+JSON.stringify(wallSet));
const geo=await f.evaluate(()=>{
  const v=window.visual106, g=v.scene.getObjectByName('twin-v2-guide'); if(!g) return {err:'no guide'};
  /* 线路现在是「堆叠的腿」：route-RB-C-02 是组，里面每条 leg-RB-C-02-A-B 各含一条 legline。
     按腿顺序拼回整条折线（腿与腿共享端点，拼接时去掉重复点）。 */
  const route=g.getObjectByName('route-RB-C-02'); if(!route) return {err:'no route group'};
  const legNames=route.children.filter(c=>c.name&&c.name.startsWith('leg-')).map(c=>c.name);
  const poly=[];
  legNames.forEach(nm=>{
    const lg=route.getObjectByName(nm); const ln=lg&&lg.getObjectByName(/legline-/.test('')?'':null);
    const lineObj=lg?lg.children.find(c=>c.isLine):null; if(!lineObj) return;
    const a=lineObj.geometry.attributes.position.array;
    for(let i=0;i<a.length;i+=3){ const q=[+a[i].toFixed(2),+a[i+2].toFixed(2)];
      if(!poly.length||Math.abs(poly[poly.length-1][0]-q[0])>0.005||Math.abs(poly[poly.length-1][1]-q[1])>0.005) poly.push(q); }
  });
  /* 穿墙计数：路径会在门洞处显式落一个「正好压在墙面上」的顶点，所以不能按线段两端点异号判定（乘积=0 会漏），
     要按侧向符号变化判定——与场景自检 auditRoutes 的 transits 同一套口径。 */
  const cross=(at)=>{const hits=[];let side=0;
    for(const q of poly){ const d=q[0]-at, s2=d>1e-6?1:(d<-1e-6?-1:0);
      if(s2===0) continue;
      if(side!==0&&s2!==side) hits.push(+q[1].toFixed(2));
      side=s2; }
    return hits;};
  const gate102=cross(20.84), gate106=cross(18.44);
  /* ── #11 判据（2026-11-09 按产品负责人圈图重写）──
     判据不再"信 seed 声明"，而是"信渲染实测"：
       · 声明有墙片的范围内不许穿越（东玻璃墙实测连续 z[9.64,28.04]，原来在这里穿了两回＝穿玻璃）；
       · 穿越只许发生在实测没有墙片的位置（南墙两根角柱之间 x[9.54,17.94] 无墙片＝106 的唯一出入口）。 */
  const crossAt=(axis, at, lo, hi)=>{const hits=[];let side=0,last=null;
    for(const q of poly){
      const a=axis==='x'?q[0]:q[1], c=axis==='x'?q[1]:q[0];
      const s2=a-at>1e-9?1:(a-at<-1e-9?-1:0);
      if(s2===0) continue;
      if(side!==0&&s2!==side&&last){
        const t=(at-last[0])/(a-last[0]), cc=last[1]+t*(c-last[1]);
        if(cc>=lo-0.001&&cc<=hi+0.001) hits.push(+cc.toFixed(2));
      }
      side=s2; last=[a,c];
    }
    return hits;};
  const eastCross=crossAt('x',18.44,9.64,28.04);      /* 东玻璃墙范围内：必须 0 次 */
  const southCross=crossAt('z',9.84,9.54,17.94);      /* 南墙开口：进出各一次 */
  const southAny=crossAt('z',9.84,8.94,18.54);        /* 整条南墙线（含两根角柱，按声明跨度） */
  function covered(axis, at, lo, hi) {
    const out=[];
    v.scene.updateMatrixWorld(true);
    v.scene.traverse(o=>{
      if(!o.isMesh||!o.geometry) return;
      let vis=true; for(let q=o;q;q=q.parent) if(q.visible===false){vis=false;break;}
      if(!vis) return;
      if(!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const P=o.position.constructor;
      const a=new P().copy(o.geometry.boundingBox.min).applyMatrix4(o.matrixWorld);
      const b=new P().copy(o.geometry.boundingBox.max).applyMatrix4(o.matrixWorld);
      const along=axis==='x'?[a.z,b.z]:[a.x,b.x];
      const cx=axis==='x'?(a.x+b.x)/2:(a.z+b.z)/2;
      const th=axis==='x'?b.x-a.x:b.z-a.z;
      if(Math.abs(cx-at)>0.45||th>0.72||b.y-a.y<1.2||along[1]-along[0]<0.3) return;
      const i0=Math.max(along[0],lo), i1=Math.min(along[1],hi);
      if(i1>i0) out.push([+i0.toFixed(2),+i1.toFixed(2)]);
    });
    out.sort((m,n)=>m[0]-n[0]);
    const merged=[]; out.forEach(q=>{const last=merged[merged.length-1];
      if(last&&q[0]<=last[1]+0.06) last[1]=Math.max(last[1],q[1]); else merged.push(q.slice());});
    return merged;
  }
  const covEast=covered('x',18.44,9.64,28.04), covSouthIn=covered('z',9.84,10.10,17.40),
        covSouthPost=covered('z',9.84,8.90,9.60);
  const clip=(a,lo,hi)=>Math.max(lo,Math.min(hi,a));
  /* 折线落在走廊带 x[18.44,20.84] 内的长度（去+返）：
     东西向只算带内那一截；南北向必须整段 x 在带内才算——否则带外的南北段会被误计成带内长度 */
  let inCorridor=0;
  for(let i=0;i<poly.length-1;i++){const[x1,z1]=poly[i],[x2,z2]=poly[i+1];
    if(Math.abs(x1-x2)<0.01){ if(x1>18.44&&x1<20.84) inCorridor+=Math.abs(z2-z1); }
    else { const a=clip(x1,18.44,20.84), b=clip(x2,18.44,20.84); inCorridor+=Math.abs(b-a); } }   /* 向西走的段 b<a，必须取绝对值 */
  inCorridor=+inCorridor.toFixed(2);
  const inb=poly.filter(q=>q[0]>18.44&&q[0]<20.84);
  const corridorEnd=inb.length?+Math.max(...inb.map(q=>q[0])).toFixed(2):null;
  const corridorZSpan=inb.length?[+Math.min(...inb.map(q=>q[1])).toFixed(2),+Math.max(...inb.map(q=>q[1])).toFixed(2)]:null;
  const markers=[]; g.traverse(o=>{ if(o.isMesh&&o.geometry&&o.geometry.type==='PlaneGeometry'&&o.material&&o.material.color&&o.material.color.getHex()===0x16a34a) markers.push('gate'); });
  const band=g.getObjectByName('corridor-RB-C-02');
  return {polyN:poly.length, legsDrawn:legNames.length, legNames, gate102, gate106, eastCross, southCross, southAny, covEast, covSouthIn, covSouthPost, inCorridor, markers:markers.length, band:!!band, corridorEnd, corridorZSpan};
});
out.push((geo.gate102.length===2&&geo.gate102.every(z=>z>=10.69+0.651&&z<=12.49-0.651)?'✅':'❌')+' 102 西门：折线只在门洞内穿越 x=20.84 共 '+geo.gate102.length+' 次（去+返）@ z='+JSON.stringify(geo.gate102));
out.push((geo.corridorEnd!==null&&geo.corridorEnd<=20.84-0.651?'✅':'❌')+' 走廊内最东点 '+geo.corridorEnd+'m ≤ 20.189m（贴 102 西墙前折返，留 0.651m 扫掠半宽）');
out.push((geo.eastCross.length===0?'✅':'❌')
  +' 106 东玻璃墙（实测连续 z[9.64,28.04]）范围内穿越＝0 次：'+JSON.stringify(geo.eastCross)
  +'（原来蓝色线就是从这里穿玻璃进来的）');
out.push((geo.southCross.length===2&&geo.southCross.every(x=>x>=9.54+0.651&&x<=17.94-0.651)?'✅':'❌')
  +' 进出 106 只走南墙开口：穿越 z≈9.84 落在开口 x[9.54,17.94] 内共 '+geo.southCross.length+' 次 @ x='
  +JSON.stringify(geo.southCross)+'（距角柱须 ≥0.651m 扫掠半宽）');
out.push((geo.southAny.length===geo.southCross.length?'✅':'❌')
  +' 没有从角柱上硬穿：整条南墙线穿越 '+geo.southAny.length+' 次，全部落在开口内（'+JSON.stringify(geo.southAny)+'）');
out.push((geo.covSouthIn.length===0?'✅':'❌')
  +' 开口是实测出来的：x[10.10,17.40] · z≈9.84 内可见墙片 '+JSON.stringify(geo.covSouthIn)+' 段（应 0 段）');
out.push((geo.covSouthPost.length>=1?'✅':'❌')
  +' 对照：同一条线西南角柱确有墙片 '+JSON.stringify(geo.covSouthPost)+'（所以那里不许穿）');
out.push((geo.covEast.length>=1&&(geo.covEast[geo.covEast.length-1][1]-geo.covEast[0][0])>=17.5?'✅':'❌')
  +' 对照：东玻璃墙实测连续覆盖 '+JSON.stringify(geo.covEast)+'（无洞口＝线路不许走这里）');
/* 走廊使用长度随门的位置变：门从"读图估值的北端入口"改成实测南开口后，
   走廊只被用作 102 西门↔南走廊这一段（z 8.60–11.59 往返 + 进出带内的横穿），
   期望从 ≥25m 改成 ≥6m——判据要跟着真实几何走，不能拿一个错门洞换来的长数字当标准。 */
out.push((geo.inCorridor>=6&&geo.band?'✅':'❌')+' 走廊里画得出折线：落在走廊带内 '+geo.inCorridor+'m（102 西门↔106 南开口，去+返）+ 范围带='+(geo.band?'有':'无'));
out.push((geo.corridorZSpan&&geo.corridorZSpan[0]<=8.61&&geo.corridorZSpan[1]>=11.59&&geo.southCross.length===2?'✅':'❌')
  +' 走廊是"通过式"通道而不是原地折返的盲端：折线在走廊带内覆盖 z '+JSON.stringify(geo.corridorZSpan)
  +'（南端要探到 8.60 才能进 106 南开口），并在南走廊与东走廊之间真的走了个 L 形');
out.push((geo.markers===0?'✅':'❌')+' 墙上绿色门洞小方块已取消（路径层内 Plane 记号 '+geo.markers+' 个；起点圆点保留）');

/* 改路径必须重算 demoCycle 的 u/travelSec/t0：停靠点一个都不许挪位。
   这里逐个停靠站把剧本 u 换算回场景坐标，与它服务的 CAD 设备中心比对。 */
const seedStops=await p.evaluate(async()=>{const r=await TwinApi.get('/api/zone/106/robots');
  const rb=r.data.filter(x=>x.robotId==='RB-C-02')[0];
  return {stops:rb.demoCycle.stops, nodes:rb.routeNodes, path:rb.path.map(q=>[q[0],q[2]]),
    meta:{loopSec:rb.demoCycle.loopSec,pathLengthM:rb.demoCycle.pathLengthM,
          unmapped:(rb.demoCycle.unmappedStops||[]).length,
          stations:rb.routeNodes.filter(n=>n.kind==='station').length, firstTwoCad:rb.demoCycle.stops.slice(0,2).map(x=>x.cad), mission:rb.mission||null}};});
out.push((seedStops.meta.firstTwoCad.join(',')==='102-05,102-01'?'✅':'❌')+' 剧本前两站=102 家位/充电 + 102 取料（AGV 先去 102 取样再进 106）: '+seedStops.meta.firstTwoCad.join(','));
out.push(((seedStops.meta.mission||[]).length===3?'✅':'❌')+' AGV 职责三段写在数据里（102 取样 / 跨区送样进 106 / 106 内部取送放）: '+JSON.stringify(seedStops.meta.mission));
const geom=await f.evaluate((d)=>{
  const P=d.path, C=[0]; for(let i=0;i<P.length-1;i++) C.push(C[i]+Math.abs(P[i+1][0]-P[i][0])+Math.abs(P[i+1][1]-P[i][1]));
  const stationNodes=d.nodes.filter(n=>n.kind==='station');
  const L=C[C.length-1];
  const at=(dist)=>{dist=Math.max(0,Math.min(L,dist));for(let i=0;i<P.length-1;i++){if(dist<=C[i+1]){const seg=C[i+1]-C[i],f=seg?((dist-C[i])/seg):0;
    return [P[i][0]+(P[i+1][0]-P[i][0])*f,P[i][1]+(P[i+1][1]-P[i][1])*f];}}return P[P.length-1];};
  const out=[];
  stationNodes.forEach(st=>{const q=st.at; const m=window.visual106.modelRoots.get(st.cad);
    if(!m){out.push({order:st.order,label:st.label,cad:st.cad,pos:[+q[0].toFixed(2),+q[1].toFixed(2)],dev:null});return;}
    m.updateWorldMatrix(true,true); const V=m.position.constructor; let lo=[1e9,1e9],hi=[-1e9,-1e9];
    m.traverse(o=>{if(!o.isMesh||!o.geometry)return; if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
      const bb=o.geometry.boundingBox; [[bb.min.x,bb.min.z],[bb.max.x,bb.max.z]].forEach(a=>{const w=new V(a[0],0,a[1]);w.applyMatrix4(o.matrixWorld);
        lo[0]=Math.min(lo[0],w.x);lo[1]=Math.min(lo[1],w.z);hi[0]=Math.max(hi[0],w.x);hi[1]=Math.max(hi[1],w.z);});});
    out.push({order:st.order,label:st.label,cad:st.cad,pos:[+q[0].toFixed(2),+q[1].toFixed(2)],
      dev:[+((lo[0]+hi[0])/2).toFixed(2),+((lo[1]+hi[1])/2).toFixed(2)],
      box:[+lo[0].toFixed(2),+lo[1].toFixed(2),+hi[0].toFixed(2),+hi[1].toFixed(2)]});});
  return {L:+L.toFixed(2),out};
}, seedStops);
/* 容差取「设备外扩 2.0m」：机器人不能站进设备里（0.902m 包络 + 0.20m 净空），
   取料点本来就必须在货架外侧——用户定的 102 取料位 (23.19,10.99) 距货架 102-01 西边 1.24m、北边 1.03m */
const worst=geom.out.map(q=>q.dev?+Math.hypot(q.pos[0]-q.dev[0],q.pos[1]-q.dev[1]).toFixed(2):99);
const bad=geom.out.filter((q,i)=>{ if(!q.dev) return true;
  const [x,z]=q.pos,[dx,dz]=q.dev,[x0,z0,x1,z1]=q.box;
  const inside=x>=x0-2.0&&x<=x1+2.0&&z>=z0-2.0&&z<=z1+2.0;
  return !inside||worst[i]>3.2; });
out.push((bad.length===0&&seedStops.meta.stations===11?'✅':'❌')+` 11 个定位点仍贴着各自 CAD 设备（弧长重算后没挪位；最远 ${Math.max(...worst)}m，场景弧长 ${geom.L}m vs seed ${seedStops.meta.pathLengthM}m）`+
  (bad.length?' 跑偏：'+JSON.stringify(bad.slice(0,3)):''));
out.push((Math.abs(geom.L-seedStops.meta.pathLengthM)<=0.3?'✅':'❌')+` 剧本元数据与路径一致：pathLengthM ${seedStops.meta.pathLengthM} / 实测 ${geom.L}，loopSec ${seedStops.meta.loopSec}`);
/* 合法穿门清单：自检按顶点侧向变化统计，去/返各一次 */
const tr=await f.evaluate(()=>{const e=document.getElementById('twin-v2-route-audit');return e?JSON.parse(e.dataset.transits||'[]'):[];});
out.push((tr.length===4&&tr.filter(t=>t.wall.startsWith('102')).length===2&&tr.filter(t=>t.wall.startsWith('106')).length===2?'✅':'❌')+' 自检记录的穿门=4 次（102 西门去/返 + 106 南开口去/返）: '+JSON.stringify(tr.map(t=>t.wall.slice(0,7)+'@'+(t.z??t.x))));
out.push((tr.every(t=>t.wall.startsWith('102 西墙')||t.wall.startsWith('106 南墙'))?'✅':'❌')+' 穿门只发生在这两道门（102 西门 + 106 南开口），没有第三处: '+JSON.stringify([...new Set(tr.map(t=>t.wall))]));

/* 反向验证：注入一条「在 z=12.39 直接穿 106 东墙」的坏路径，自检必须抓到——否则上面的 0 违规是空转 */
const inject=await f.evaluate(async()=>{
  const v=window.visual106;
  let walls=[{name:'102 西墙',axis:'x',at:20.84,a:7.54,b:15.14,gate:[10.69,12.49]},
               {name:'106 东玻璃墙',axis:'x',at:18.44,a:9.64,b:28.04,gate:[10.2,11.8]},
               {name:'106 南玻璃墙',axis:'z',at:9.59,a:8.99,b:18.54,gate:null}];
  /* 假墙 x=16.0 完全落在 106 允许区域内，门洞 z[12,13]；路径在 z=15（门洞外）横穿它 →
     范围判定不会先抢跑，才能单独证明「穿墙未走门洞」这条规则真的在生效 */
  walls=walls.concat([{name:'QA 假墙（测试注入）',axis:'x',at:16.0,a:9.64,b:28.04,gate:[12,13]}]);
  const bad=[{robotId:'RB-C-02',modelRoot:'106-08',path:[[14.0,0.05,15.0],[18.0,0.05,15.0],[18.0,0.05,20.0],[14.0,0.05,20.0]],
    allowedZones:['Z-106'],footprint:[0.9,0.9],sweptEnvelope:0.902,clearanceM:0.2,progress:0}];
  let max=0, sample=null;
  for(let i=0;i<16;i++){
    window.postMessage({channel:'twin-v2',type:'state',robots:bad,deviceStatus:{},layers:{path:1,labels:1,heatmap:0},quality:'high',walls:walls,routeNote:''},location.origin);
    await new Promise(r=>setTimeout(r,180));
    const e=document.getElementById('twin-v2-route-audit'); const n=e?+e.dataset.violations:0;
    if(n>max){max=n;sample=e.dataset.detail;}
  }
  return {max, sample:(sample||'').slice(0,140)};
});
out.push((inject.max>0&&/穿墙未走门洞/.test(inject.sample)?'✅':'❌')+' 反向注入「门洞外穿墙」被抓到：违规 '+inject.max+' 处 · '+inject.sample);
/* 注入过坏路径就把页面还原：重新取 frame（旧引用已 detach），后面的实体交叠检查才准 */
await p.reload({waitUntil:'load'}); await p.waitForTimeout(14000);
f=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));

// 机器人不再停在设备里：检查模型 AABB 与障碍 AABB 无交叠
const overlap=await f.evaluate(()=>{
  const v=window.visual106, T=v.constructor.__proto__;
  const three=window.__t||null;
  const boxes=[];
  v.modelRoots.forEach((m,id)=>{ if(id==='106-08'||id==='106-09')return;
    const g=m.geometry; let minx=1e9,minz=1e9,maxx=-1e9,maxz=-1e9;
    m.updateWorldMatrix(true,true);
    m.traverse(o=>{ if(!o.isMesh||!o.geometry)return; if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
      const bb=o.geometry.boundingBox;
      for(const x of[bb.min.x,bb.max.x])for(const z of[bb.min.z,bb.max.z]){
        const p=new (Object.getPrototypeOf(o.position).constructor)().set(x,o.geometry.boundingBox.min.y,z).applyMatrix4(o.matrixWorld);
        minx=Math.min(minx,p.x);maxx=Math.max(maxx,p.x);minz=Math.min(minz,p.z);maxz=Math.max(maxz,p.z);} });
    boxes.push([id,minx,minz,maxx,maxz]); });
  const res={};
  ['106-08','106-09'].forEach(rid=>{
    const m=v.modelRoots.get(rid); if(!m){res[rid]='no model';return;}
    const c=m.position; res[rid]=boxes.filter(q=>c.x+0.451>q[1]&&c.x-0.451<q[3]&&c.z+0.451>q[2]&&c.z-0.451<q[4]).map(q=>q[0]);
  });
  return res;});
out.push(((overlap['106-08']||[]).length===0?'✅':'❌')+' RB-C-02 家位不压任何实体: '+JSON.stringify(overlap['106-08']));
out.push((JSON.stringify(overlap['106-09'])==='["102-05"]'?'✅':'❌')+' RB-C-01 停靠位只压在 102-05 充电位上（对接=应有重叠，不压其他实体）: '+JSON.stringify(overlap['106-09']));
// 路线层可见性与开关
const rl=await f.evaluate(()=>{const g=window.visual106.scene.getObjectByName('twin-v2-guide');return g?{children:g.children.length,names:g.children.map(c=>c.name)}:null;});
out.push((rl&&rl.names.includes('route-RB-C-02')&&!rl.names.includes('route-RB-C-01')?'✅':'❌')+' 路线层只有 RB-C-02 一条折线（RB-C-01 已停靠，无路径）: '+JSON.stringify(rl&&rl.names));
await p.keyboard.press('2'); await p.waitForTimeout(2500);
await p.screenshot({path:'/tmp/twin-qa/route-106.png'});
await p.click('.lic[data-layer=path]'); await p.waitForTimeout(1200);
const hidden=await f.evaluate(()=>{const g=window.visual106.scene.getObjectByName('twin-v2-guide');return g?g.visible:null;});
out.push((hidden===false?'✅':'❌')+' 关闭路径图层后折线消失: visible='+hidden);
await p.click('.lic[data-layer=path]'); await p.waitForTimeout(1000);
await p.keyboard.press('1'); await p.waitForTimeout(3000); await p.screenshot({path:'/tmp/twin-qa/route-s1.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,6).join('\n'));
await b.close();
