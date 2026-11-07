import { chromium } from 'playwright';
import { BASE } from './_env.mjs';
const B=BASE;
const out=[], err=[];
const a=(k,v,exp)=>out.push(`${String(v).toUpperCase().startsWith(String(exp).toUpperCase())?'✅':'❌'} ${k}: ${v} (期望 ${exp})`);
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--enable-unsafe-swiftshader']});
const results=[];
const page=await browser.newPage({viewport:{width:1920,height:1080}});
page.on('pageerror',e=>err.push('pageerror: '+e.message));
page.on('console',m=>{ if(m.type()==='error') err.push('console: '+m.text().slice(0,200)+(m.location?JSON.stringify(m.location()):'')); });
page.on('requestfailed',r=>err.push('REQFAIL: '+r.url()+' '+r.failure()?.errorText));
page.on('response',r=>{ if(r.status()>=400) err.push('HTTP '+r.status()+' '+r.url()); });
try{
await page.goto(B+'/twin/future-lab/twin-scene-v2.html', {waitUntil:'load'});
await page.waitForTimeout(9000);

const hooks=async()=>page.evaluate(()=>{try{return document.getElementById('scene').contentDocument.getElementById('twin-v2-bridge')?.dataset||null}catch(e){return null}});
a('区域下拉项数', await page.locator('#zoneSel option').count(), 10);
a('KPI 四张表', await page.locator('.dtable').count(), 4);
a('报告份数不再展示', (await page.locator('#tables').innerText()).includes('报告'), false);
a('告警流汇总行', (await page.locator('#streamMeta').innerText()).replace(/\s+/g,' '), '今日 13 条 · 未解除 9 · 最新在前');
a('告警不再切 A/B/C 三区（2026-11-07）', await page.locator('.asec').count(), 0);
a('右侧告警流行数(13 条 ×2 无缝复制)', await page.locator('#streamTrack .st-row').count(), 26);
a('三态徽章存在', await page.locator('#streamTrack .st-row .st').count(), 26);
a('安灯写回按钮已删', await page.locator('[data-ack]').count(), 0);
a('回溯按钮已随 S3 移除', await page.locator('[data-trace]').count(), 0);
a('S3 按钮已移除', await page.locator('[data-mode=S3]').count(), 0);
a('桥接层就绪', !!(await hooks()), true);
a('图层默认（剖墙已不是图层）', (await hooks())?.layers, 'path,labels');
a('剖墙 icon 已移除', await page.locator('.lic[data-layer=walls]').count(), 0);
a('墙体剖切仍固定生效（前侧外墙不透明度 0.12）', await page.frames().find(f=>/tour-space/.test(f.url())).evaluate(()=>{let m=null;window.visual106.overview.children.forEach(c=>{if(c.isMesh&&c.material&&c.material.transparent&&c.material.color&&c.material.color.getHex()===0xbbcbd7)m=c;});return m?+m.material.opacity.toFixed(2):'no-wall';}), 0.12);

// 切区域=106
await page.selectOption('#zoneSel','106'); await page.waitForTimeout(2500);
a('106 区域面板显示（五类信息）', await page.locator('#zonePanel').isVisible(), true);
a('面板设备行含机器人', await page.locator('#zpDevices .zp-row').count(), 11);
a('停靠充电的机器人不判卡住（RB-C-01 在 102-05 桩上）', (await page.locator('#zpDevices').innerText()).includes('停靠充电'), true);
a('卡住/超时叙事仍在（在制任务超时标注）', (await page.locator('#zpRunning').innerText()).includes('超时'), true);
a('106 下钻后底栏保留（机器人与任务继续走）', await page.locator('#taskStrip').isVisible(), true);
  a('106 下钻后告警流让位给区域面板（信息不重复）', await page.locator('#alarmStream').isHidden(), true);

// 非 106 诚实降级
await page.selectOption('#zoneSel','107'); await page.waitForTimeout(1800);
a('非106 面板诚实降级', (await page.locator('#zpDevices .zp-body').innerText()).includes('未建设备档案'), true);
a('非106 机器人不越区', (await page.locator('#zpDevices').innerText()).includes('RB-C-01'), false);

// 周期切换：月→报告份数置灰
/* 左栏隐藏时周期按钮在区域面板里，两处都可能有：点当前可见的那一个 */
await page.locator('[data-period=month]:visible').first().click(); await page.waitForTimeout(400);
a('本月四表联动', await page.evaluate(()=>document.querySelectorAll('.dtable').length===4 && document.querySelector('.dtable tbody tr .v').textContent==='268'), true);
a('本月委托总数', (await page.evaluate(()=>document.querySelector('.dtable tbody tr .v').textContent)),'268');

// 图层：关路径
await page.click('.lic[data-layer=path]'); await page.waitForTimeout(1500);
a('关路径后图层状态', (await hooks())?.layers, 'labels');
await page.click('.lic[data-layer=heatmap]'); await page.waitForTimeout(1500);
a('开热力后图层', (await hooks())?.layers, 'labels,heatmap');
await page.click('.lic[data-layer=heatmap]'); await page.click('.lic[data-layer=path]'); await page.waitForTimeout(1200);

// 低配：按钮已按 2026-11-06 反馈移除，能力保留为交付参数 ?quality=low（由 fscheck 端到端验证）。
// 注意：宿主每 2s 的 state 推送会把 quality 覆盖回自己的状态（宿主=事实源），因此这里不做瞬态指令断言。
a('低配按钮已从顶栏移除', await page.locator('#lowBtn').count(), 0);
a('顶栏不再出现「低配」字样', (await page.locator('.acts').innerText()).includes('低配'), false);
a('全屏按钮已就位（图标+文案）', (await page.locator('#fsBtn').innerText()).trim(), '全屏');

// 遥控翻页
await page.keyboard.press('3'); await page.waitForTimeout(1000); await page.keyboard.press('1'); await page.waitForTimeout(1200);
a('按键1=总览', await page.evaluate(()=>new URLSearchParams(location.search).get('mode')), 'S1');
await page.keyboard.press('PageDown'); await page.waitForTimeout(1500);
a('PgDn=下一屏(讲解顺序: 总览→106)', await page.evaluate(()=>new URLSearchParams(location.search).get('zone')), '106');
/* 焦点进入三维场景后仍能翻页（桥接层转发 remote） */
await page.frameLocator('#scene').locator('body').click({position:{x:5,y:5}, force:true}); await page.waitForTimeout(400);
await page.keyboard.press('1'); await page.waitForTimeout(1200);
a('场景内按键1=总览(桥接转发)', await page.evaluate(()=>new URLSearchParams(location.search).get('mode')), 'S1');
await page.keyboard.press('3'); await page.waitForTimeout(1200);
a('按键3 已无回溯屏', await page.locator('#s3Drawer').count(), 0);
a('告警行点击出闭环详情', await (async()=>{ await page.evaluate(()=>{document.getElementById('streamTrack').style.animation='none';}); const rows=page.locator('.st-row'); const n=await rows.count(); let idx=0; for(let i=0;i<n;i++){const bb=await rows.nth(i).boundingBox(); if(bb&&bb.y>150&&bb.y<900){idx=i;break;} } await rows.nth(idx).click(); await page.waitForTimeout(1200); const t=(await page.locator('#detailBody').innerText()).replace(/\s+/g,' '); return /闭环状态/.test(t)&&/派至/.test(t)&&/来源系统/.test(t); })(), true);


// 面板→场景高亮（发得出消息）
/* 用下拉而不是按键 2：上一步刚在场景里点过，焦点在 iframe 内，按键要靠桥接层转发；
   这里要验的是面板行的点击链路，不该被焦点归属影响（实测这样会因面板尚未出现而行不可点导致超时） */
await page.selectOption('#zoneSel','106'); await page.waitForTimeout(3000);
const devRow=await page.evaluate(()=>{const el=document.querySelector('#zpDevices:not([hidden]) .zp-row'); if(!el) return null; el.click(); return el.dataset.dev||el.dataset.robot||'row';});
out.push((devRow?'✅':'❌')+' 面板设备行存在且可点（106 画像保留设备块）: '+devRow);
await page.waitForTimeout(1200);
a('详情面板弹出', await page.locator('#detail').isVisible(), true);
a('详情停靠不遮面板', await page.locator('#detail.docked').count(), 1);
a('详情含只读说明', (await page.locator('#detailBody').innerText()).includes('不下发控制'), true);

// 错误检查
const ra=await page.evaluate(()=>document.getElementById('req013-runtime-errors')?.textContent||'');
a('主页面运行时错误', ra||'空', '空');
const raf=await page.evaluate(()=>{try{return document.getElementById('scene').contentDocument.getElementById('req013-runtime-errors')?.textContent||''}catch(e){return 'n/a'}});
a('场景内运行时错误', raf||'空', '空'); if(raf==='n/a') out.push('ℹ️ 场景内无审计节点');
await page.screenshot({path:'/tmp/twin-qa/twin-v2-106.png'});
await page.keyboard.press('1'); await page.waitForTimeout(2500); await page.screenshot({path:'/tmp/twin-qa/twin-v2-s1.png'});


} catch(e){ out.push('❌ 中断：'+String(e.message).split('\n')[0]); }
try{ console.log(out.join('\n')); console.log('\n---- 控制台/页面错误 '+err.length+' 条 ----'); console.log(err.slice(0,12).join('\n')); }catch(_){}
await browser.close();
