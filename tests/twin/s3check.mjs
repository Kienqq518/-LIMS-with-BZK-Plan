import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080},reducedMotion:'no-preference'});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,160));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
T('S3 按钮已移除', await p.locator('[data-mode=S3]').count(), 0);
T('回溯抽屉已移除', await p.locator('#s3Drawer').count(), 0);
T('回溯按钮已移除', await p.locator('[data-trace]').count(), 0);
T('顶栏只剩两个叙事入口', await p.locator('.modes .mode').count(), 1);
out.push(((await p.locator('.modes').innerText()).includes('告警回溯')?'❌':'✅')+' 顶栏无「告警回溯」字样: '+p.locator('.modes').innerText());
T('装载链无被吞异常', await p.evaluate(()=>document.getElementById('freshTxt').textContent), '');
T('告警流行数（三分区各 3×2）', await p.locator('.st-row').count(), 18);
out.push(((await p.locator('#streamMeta').innerText()).includes('今日')?'✅':'❌')+' 告警流头部显示今日计数: '+await p.locator('#streamMeta').innerText());
// 点告警行 → 就地详情（不再开抽屉）
/* 滚动列表在自动化里永远"不稳定"；先按 CSS 的暂停开关停住（等价于真机悬停暂停），再点 */
await p.evaluate(()=>{document.querySelectorAll('.asec-track').forEach(t=>{t.style.animation='none';});});   /* 完全停住=回到 translateY(0)，首行必然完整可见 */
await p.waitForTimeout(300);
/* 滚动列表里被裁掉的行仍参与几何计算：必须挑「完整落在本区可见框内」的行，否则点击点会落到相邻表头上被拦截 */
const rows=p.locator('.asec[data-sec=A] .st-row'); const n=await rows.count(); let idx=-1;
for(let i=0;i<n;i++){
  const ok=await p.evaluate(({sec,i})=>{
    const body=document.querySelector('.asec[data-sec='+sec+'] .asec-body').getBoundingClientRect();
    const r=document.querySelectorAll('.asec[data-sec='+sec+'] .st-row')[i].getBoundingClientRect();
    return r.top>=body.top-0.5 && r.bottom<=body.bottom+0.5;
  },{sec:'A',i});
  if(ok){ idx=i; break; }
}
if(idx<0) throw new Error('A 区没有完整可见的告警行');
await rows.nth(idx).click(); await p.waitForTimeout(1500);
await p.evaluate(()=>{document.getElementById('streamTrack').style.animationPlayState='';});
T('点告警行出详情面板', await p.locator('#detail').isVisible(), 'true');
const dt=(await p.locator('#detailBody').innerText()).replace(/\s+/g,' ');
out.push((/闭环状态/.test(dt)&&/派至/.test(dt)&&/来源系统/.test(dt)&&/MVP 只呈现当前告警/.test(dt)?'✅':'❌')+' 告警详情内容: '+dt.slice(0,120));
// 区域面板告警块的「详情」按钮可用
await p.selectOption('#zoneSel','106'); await p.waitForTimeout(2500);
await p.locator('#zpAlarms .zsec[data-sec=A] .zp-row[data-alarm]').first().click(); await p.waitForTimeout(1200);   /* 区域面板的告警行本身可点（无滚动动画，不会被相邻元素遮挡） */
out.push(((await p.locator('#detail').isVisible())?'✅':'❌')+' 区域面板告警「详情」可点: '+await p.locator('#detailBody h3').innerText());
// 遥控序列不再包含 S3
await p.keyboard.press('1'); await p.waitForTimeout(2000);
const seq=[]; for(let i=0;i<12;i++){ await p.keyboard.press('PageDown'); await p.waitForTimeout(700); seq.push(await p.evaluate(()=>new URLSearchParams(location.search).get('mode')+'/'+ (new URLSearchParams(location.search).get('zone')||''))); }
out.push((seq.every(s=>!s.includes('S3'))?'✅':'❌')+' 翻页序列不含 S3: '+[...new Set(seq)].join(' → '));
await p.keyboard.press('1'); await p.waitForTimeout(1200);
await p.keyboard.press('3'); await p.waitForTimeout(1200);
out.push(((await p.evaluate(()=>new URLSearchParams(location.search).get('mode')))==='S1'?'✅':'❌')+' 按键 3 已无回溯屏（停在 S1）: mode='+await p.evaluate(()=>new URLSearchParams(location.search).get('mode')));
await p.keyboard.press('1'); await p.waitForTimeout(2500); await p.screenshot({path:'/tmp/twin-qa/no-s3.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
