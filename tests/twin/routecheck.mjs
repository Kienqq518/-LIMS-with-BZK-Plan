import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,160));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
const f=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));
const A=await f.evaluate(()=>{const e=document.getElementById('twin-v2-route-audit');return e?{checked:+e.dataset.checked,obstacles:+e.dataset.obstacles,violations:+e.dataset.violations,detail:e.dataset.detail}:null;});
out.push((A&&A.violations===0?'✅':'❌')+` 场景内避让校验（独立复算）: 采样 ${A&&A.checked} 点 / 障碍 ${A&&A.obstacles} 个 / 违规 ${A&&A.violations} ${A&&A.violations?A.detail:''}`);
out.push((A&&A.checked>3000?'✅':'❌')+' 采样密度足够: '+A.checked);
out.push(((await p.locator('#auditBadge').count())===0?'✅':'❌')+' 避让校验常驻徽标已移除（界面不再显示）');
const ra=await p.evaluate(()=>document.body.dataset.routeAudit||'');
out.push((ra && ra.split('/')[0]==='0'?'✅':'❌')+' 自检结果改为 body[data-route-audit] 留痕（QA 可断言）: 违规/采样/障碍/墙 = '+ra);
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
out.push(((overlap['106-09']||[]).length===0?'✅':'❌')+' RB-C-01 家位不压任何实体: '+JSON.stringify(overlap['106-09']));
// 路线层可见性与开关
const rl=await f.evaluate(()=>{const g=window.visual106.scene.getObjectByName('twin-v2-guide');return g?{children:g.children.length,names:g.children.map(c=>c.name)}:null;});
out.push((rl&&rl.names.includes('route-RB-C-02')&&rl.names.includes('route-RB-C-01')?'✅':'❌')+' 路线层含两条数据驱动折线+走廊带: '+JSON.stringify(rl&&rl.names));
await p.keyboard.press('2'); await p.waitForTimeout(2500);
await p.screenshot({path:'/tmp/twin-qa/route-106.png'});
await p.click('.lic[data-layer=path]'); await p.waitForTimeout(1200);
const hidden=await f.evaluate(()=>{const g=window.visual106.scene.getObjectByName('twin-v2-guide');return g?g.visible:null;});
out.push((hidden===false?'✅':'❌')+' 关闭路径图层后折线消失: visible='+hidden);
await p.click('.lic[data-layer=path]'); await p.waitForTimeout(1000);
await p.keyboard.press('1'); await p.waitForTimeout(3000); await p.screenshot({path:'/tmp/twin-qa/route-s1.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,6).join('\n'));
await b.close();
