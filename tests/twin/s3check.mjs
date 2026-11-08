import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
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
/* FR-60 顶栏两段式：组件1 就是「实验室总览 / 区域」两颗层级按钮（S3 告警回溯入口仍然不许回来）。
   原来期望 1 颗，是因为那时"区域"是下拉、只有总览一颗按钮。 */
T('顶栏层级按钮数（总览 / 区域，无 S3 入口）', await p.locator('.topbar .mode.lv').count(), 2);
out.push(((await p.locator('.modes').innerText()).includes('告警回溯')?'❌':'✅')+' 顶栏无「告警回溯」字样: '+p.locator('.modes').innerText());
T('装载链无被吞异常', await p.evaluate(()=>document.getElementById('freshTxt').textContent), '');
T('告警流行数（13 条 ×2 无缝复制）', await p.locator('#streamTrack .st-row').count(), 26);
out.push(((await p.locator('#streamMeta').innerText()).includes('今日')?'✅':'❌')+' 告警流头部显示今日计数: '+await p.locator('#streamMeta').innerText());
// 点告警行 → 就地详情（不再开抽屉）
/* 滚动列表在自动化里永远"不稳定"；先按 CSS 的暂停开关停住（等价于真机悬停暂停），再点 */
await p.evaluate(()=>{const t=document.getElementById('streamTrack');t.style.animation='none';});   /* 完全停住=回到 translateY(0)，首行必然完整可见 */
await p.waitForTimeout(300);
/* 滚动列表里被裁掉的行仍参与几何计算：必须挑「完整落在本区可见框内」的行，否则点击点会落到相邻表头上被拦截 */
const rows=p.locator('#streamTrack .st-row'); const n=await rows.count(); let idx=-1;
for(let i=0;i<n;i++){
  const r=await rows.nth(i).boundingBox();
  const body=await p.evaluate(()=>document.querySelector('.stream-view').getBoundingClientRect());
  if(r&&r.y>=body.y-1&&r.y+r.height<=body.bottom+1){idx=i;break;}
}
if(idx<0) throw new Error('告警流没有完整可见的行');

await rows.nth(idx).click(); await p.waitForTimeout(1500);
await p.evaluate(()=>{document.getElementById('streamTrack').style.animationPlayState='';});
T('点告警行出详情面板', await p.locator('#detail').isVisible(), 'true');
const dt=(await p.locator('#detailBody').innerText()).replace(/\s+/g,' ');
/* 「MVP 只呈现当前告警…孪生只读…」这句按 2026-11-08 反馈从屏上撤了（口径留在 PRD/docs），
   所以这里改成反向断言：屏上不许再出现这句免责声明，但闭环状态/派至/来源系统三格必须还在。 */
out.push((/闭环状态/.test(dt)&&/派至/.test(dt)&&/来源系统/.test(dt)&&!/MVP 只呈现当前告警/.test(dt)?'✅':'❌')+' 告警详情内容（撤免责声明、留三格口径）: '+dt.slice(0,120));
// 区域面板告警块的「详情」按钮可用
/* FR-80：本区告警行的唯一入口就是右列告警流（面板退役）。
   滚动列表在自动化里永远"不稳定"，所以同样先停动画、再挑完整落在本区可见框内的一行，
   用 DOM click 而不是 mouse.click——居中详情弹窗会盖住场景，但盖不住流内的行本身。 */
await gotoZone(p, '106'); await p.waitForTimeout(2500);
await p.evaluate(()=>{const t=document.getElementById('streamTrack'); if(t) t.style.animation='none';});
await p.waitForTimeout(400);
const zClicked=await p.evaluate(()=>{const vb=document.querySelector('.stream-view'); if(!vb) return 'no-stream-view';
  const b=vb.getBoundingClientRect();
  const rows=[...document.querySelectorAll('#streamTrack .st-row[data-alarm]')].filter(r=>{const q=r.getBoundingClientRect();return q.top>=b.y-1&&q.bottom<=b.bottom+1;});
  if(!rows.length) return 'no-fully-visible-alarm-row';
  rows[0].click(); return (rows[0].getAttribute('aria-label')||'').slice(0,36);});
await p.waitForTimeout(1200);
out.push(((await p.locator('#detail').isVisible())?'✅':'❌')+' 区域视图右列告警行可点出详情（'+zClicked+'）: '+await p.locator('#detailBody h3').innerText());
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
