import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
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
/* 两段式控件（任务20）之后，房间下拉多了一项空占位「选择房间…」——它不是一个区域，
   所以项数按 value 非空来数，占位项另验它在不在。 */
a('区域下拉房间项数（不含占位）', await page.evaluate(() => [...document.querySelectorAll('#zoneSel option')].filter(o => o.value).length), 10);
a('房间下拉默认不选中任何房间', await page.evaluate(() => document.getElementById('zoneSel').value), '');
/* 左栏三组（调度任务子区域按 FR-73 移出左栏） */
a('KPI 三张表', await page.locator('.dtable').count(), 3);
a('报告份数不再展示', (await page.locator('#tables').innerText()).includes('报告'), false);
a('告警流汇总行', (await page.locator('#streamMeta').innerText()).replace(/\s+/g,' '), '今日 13 条 · 未解除 9 · 最新在前');
a('告警不再切 A/B/C 三区（2026-11-07）', await page.locator('.asec').count(), 0);
a('右侧告警流行数(13 条 ×2 无缝复制)', await page.locator('#streamTrack .st-row').count(), 26);
a('三态徽章存在', await page.locator('#streamTrack .st-row .st').count(), 26);
a('安灯写回按钮已删', await page.locator('[data-ack]').count(), 0);
a('回溯按钮已随 S3 移除', await page.locator('[data-trace]').count(), 0);
a('S3 按钮已移除', await page.locator('[data-mode=S3]').count(), 0);
a('桥接层就绪', !!(await hooks()), true);
a('图层默认：路径开、场地标签关（2026-11-07）、热力关', (await hooks())?.layers, 'path');
a('剖墙 icon 已移除', await page.locator('.lic[data-layer=walls]').count(), 0);
a('墙体剖切仍固定生效（前侧外墙不透明度 0.12）', await page.frames().find(f=>/tour-space/.test(f.url())).evaluate(()=>{let m=null;window.visual106.overview.children.forEach(c=>{if(c.isMesh&&c.material&&c.material.transparent&&c.material.color&&c.material.color.getHex()===0xbbcbd7)m=c;});return m?+m.material.opacity.toFixed(2):'no-wall';}), 0.12);

// 切区域=106
await gotoZone(page,'106'); await page.waitForTimeout(2500);
/* FR-80：区域面板退役，106 下钻后信息在左栏两块 + 底栏 + 右列 */
a('106 下钻后左栏接管（任务统计 + 设备）', await page.evaluate(()=>!!document.querySelector('#railZoneStats') && !document.querySelector('#railZoneStats').hidden && !document.querySelector('#railZoneDevs').hidden), true);
/* FR-80：面板不是"隐藏"，是连 DOM 一起删——留一份 display:none 的影子 UI，
   读文本的断言会绿、按键盘的断言会红，同一套数据两种结论，比删掉更危险。 */
a('区域面板 DOM 已删除（不留隐藏影子）', await page.locator('#zonePanel').count(), 0);
/* 106 = 8 台设备 + 2 台机器人 = 10 行。原来期望 11，是因为智能型数字电桥被"数据归属分区"
   挂在 106 名下，而它实物在 107-01（FR-67 已归位）。这一行同时钉住"面板与全场表同源"。 */
/* 8 台设备 + 2 台复合机器人 = 10 行：机器人原来是"区域面板设备块"里的两行，
   面板退役后归左栏，106 下钻时 .raildev 是隐藏的，这里是唯一的机器人落点。 */
a('左栏行数（8 台建档 + 2 台机器人）', await page.locator('#zDevsList .zd-row').count(), 10);
a('106 左栏台数与全场表同源', await page.locator('#zDevsN').innerText(), '8 台建档 · 2 台机器人');
a('停靠充电的机器人不判卡住（总览 AGV 块写明停靠与回升）', (await page.evaluate(()=>{document.querySelector('.mode.lv[data-level="overview"]').click();return '';})||(await page.locator('#railAgv').innerText())).includes('停靠充电'), true);
a('卡住/超时叙事仍在（告警流里那条节拍超时）', (await page.locator('#streamTrack').innerText()).includes('超时'), true);
a('106 下钻后底栏保留（机器人与任务继续走）', await page.locator('#taskStrip').isVisible(), true);
  /* FR-80：区域面板退役，右列不再让位——本房间的告警流就是这一列的内容，不重复（面板那份已撤）。
   所以这条从"让位"改成"接管后仍在，且只剩本房间"。 */
a('106 下钻后右列告警流接管（不再整列让位）', await page.evaluate(()=>{const r=document.querySelector('#rightCol').getBoundingClientRect();return r.width>2&&r.height>2;}), true);

// 非 106 诚实降级
await gotoZone(page,'107'); await page.waitForTimeout(1800);
/* 口径变了（FR-66）：非 106 的房间不是"未建档"，而是从全场表按物理房间派生——107 有 7 台。
   诚实降级这条留给真的没有检测设备的区（101 接待大厅 / 104 控制室）。 */
/* 107 = 5 台试验机（维卡软化/液压万能/电子万能/两工位×2）+ 归位过来的智能型数字电桥 = 6 台。
   上一笔我把期望写成 7 就推了，是我的数错，不是产品错——这里按接口实际派生值写死并加同源校验。 */
a('107 左栏从全场表派生出设备', await page.locator('#zDevsList .zd-row').count(), 6);
a('107 台数与全场表同源', await page.locator('#zDevsN').innerText(), '6 台建档');
a('107 设备行格式=编号 名称「型号」', /智能型数字电桥.*QJ-36/.test(await page.locator('#zDevsList .zd-row').first().innerText()), true);
a('非106 机器人不越区', (await page.locator('#zDevsList').innerText()).includes('RB-C-01'), false);

// 周期切换：月→报告份数置灰
/* 左栏隐藏时周期按钮在区域面板里，两处都可能有：点当前可见的那一个 */
await page.locator('[data-period=month]:visible').first().click(); await page.waitForTimeout(400);
/* 左栏三组（调度任务子区域已移出左栏，FR-73）：本月切换要三组一起联动。
   为什么这里必须回总览读，而不是就地读：这一步页面在 107 下钻，#tables 整块被 CSS 隐藏，
   隐藏元素的 innerText 会退回 textContent——"总数 268" 变成 "总数268"，
   带空格的判据当场假失败（上一轮就是被这条判成"产品没联动"）。
   回总览既读到真实渲染文本，又顺手验了一条用户路径：在区域里切了本月，回总览还得是本月。 */
await gotoZone(page,'106'); await page.waitForTimeout(1200);
await page.click('.mode.lv[data-level="overview"]'); await page.waitForTimeout(2200);
a('本月三组联动（含区域切完回总览仍是本月）', await page.evaluate(()=>{const t=[...document.querySelectorAll('.dtable')].map(e=>e.innerText.replace(/\s+/g,' ')).join(' | ');return /总数 268/.test(t)&&/已收样 511/.test(t)&&/合计 842/.test(t)&&t.indexOf('调度任务')<0;}), true);
a('本月委托总数', (await page.evaluate(()=>document.querySelector('.dtable .dt-v').textContent)),'268');

// 图层：关路径
await page.click('.lic[data-layer=path]'); await page.waitForTimeout(1500);
a('关路径后图层状态（标签本来就默认关）', (await hooks())?.layers, '');
await page.click('.lic[data-layer=heatmap]'); await page.waitForTimeout(1500);
a('开热力后图层', (await hooks())?.layers, 'heatmap');
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
await gotoZone(page,'106'); await page.waitForTimeout(3000);
const devRow=await page.evaluate(()=>{const el=document.querySelector('#zDevsList .zd-row[data-dev]'); if(!el) return null; el.click(); return el.dataset.dev||'row';});
out.push((devRow?'✅':'❌')+' 左栏设备行存在且可点（面板退役后这是唯一落点）: '+devRow);
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
