import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
const out=[],err=[];
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,170));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(11000);
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
await p.keyboard.press('2'); await p.waitForTimeout(3000);
T('面板显示', await p.locator('#zonePanel').isVisible(), 'true');
T('106 出五块（DOM 里有 7 个块，画像决定显隐）', await p.locator('#zonePanel section:not([hidden])').count(), 5);
const heads=await p.locator('#zonePanel h4').allInnerTexts();
const em = async id => (await p.locator('#zonePanel '+id).innerText()).replace(/\s+/g,'');
T('五块标题', (await p.locator('#zonePanel section:not([hidden]) h4').evaluateAll(els=>els.map(e=>e.textContent.replace(e.querySelector('em').textContent,'').trim()))).join('|'), '设备|环境数据|任务统计|正在运行的任务|告警');
T('设备计数', await em('#zpDevicesN'), '9台建档·2台机器人');
T('环境计数', await em('#zpEnvN'), '4个点位·5s心跳');
T('统计周期', await em('#zpStatsPeriod'), '本日');
{ const rn = parseInt(await em('#zpRunningN'), 10); out.push((rn >= 1 && rn <= 5 ? '✅' : '❌') + ' 在制计数在合理区间(1–5，随 mock 进度浮动): ' + rn); }
T('告警计数（B 区瓶颈已全部收在 106）', await em('#zpAlarmsN'), '今日11·未解除8');
T('设备行数', await p.locator('#zpDevices .zp-row').count(), 11);
T('停靠机器人标注（不判卡住）', (await p.locator('#zpDevices').innerText()).includes('停靠充电'), 'true');
T('在制任务超时标注承载卡住叙事', (await p.locator('#zpRunning').innerText()).includes('超时'), 'true');
T('环境含读数', /℃.*%RH/.test(await p.locator('#zpEnv').innerText()), 'true');
T('统计四格', await p.locator('#zpStats .zp-stat').count(), 4);
T('统计数值=本日106', (await p.locator('#zpStats .zp-stat b').allInnerTexts()).join('/'), '3/2/1/0');
T('在制来源标签', (await p.locator('#zpRunning').innerText()).includes('调度')&&(await p.locator('#zpRunning').innerText()).includes('数采'), 'true');
T('告警只读三态', (await p.locator('#zpAlarms').innerText()).includes('未解除')&&(await p.locator('#zpAlarms').innerText()).includes('派至'), 'true');
T('区域视图时告警流让位给面板', await p.locator('#alarmStream').isVisible(), 'false');
T('机器人浮条已整体删除', await p.locator('#robotZone').count(), 0);
T('106 底栏保留（任务队列继续走）', await p.locator('#taskStrip').isVisible(), 'true');
// 周期联动
await p.locator('[data-period=month]:visible').first().click();  /* 周期按钮同屏可能有左右两组，只点可见那份 */ await p.waitForTimeout(600);
T('统计随周期', (await p.locator('#zpStats .zp-stat b').allInnerTexts()).join('/'), '60/2/1/32');
// 点击设备行 → 详情停靠（不遮挡面板），面板其余块仍可点
await p.locator('#zpDevices .zp-row').first().click(); await p.waitForTimeout(1500);
T('点设备出详情', await p.locator('#detail').isVisible(), 'true');
T('详情停靠不盖面板', await p.locator('#detail.docked').count(), 1);
const dv=await p.locator('#detail').boundingBox(), zpb=await p.locator('#zonePanel').boundingBox();
T('详情与面板几何不相交', (dv.x+dv.width<=zpb.x+1)?'true':'false', 'true');
// 点击本区告警「详情」→ 就地详情（回溯抽屉已随 S3 移除）
await p.locator('#zpAlarms [data-alarm]').first().click(); await p.waitForTimeout(1500);
T('本区告警详情打开', await p.locator('#detail').isVisible(), 'true');
T('回溯抽屉不存在', await p.locator('#s3Drawer').count(), 0);
// 切到 107（无档案/1个环境点位）与 101（非试验区）
await gotoZone(p, '107'); await p.waitForTimeout(2500);
T('107 设备未建档诚实', (await p.locator('#zpDevices .zp-body').innerText()).includes('未建设备档案'), 'true');
T('107 环境仍有点位', await p.locator('#zpEnv .zp-row').count(), 1);
await gotoZone(p, '101'); await p.waitForTimeout(2500);
T('101 只出环境数据块（画像：接待大厅不需要任务/告警/设备）', await p.locator('#zonePanel section:not([hidden])').count(), 1);
/* 101 的点位是光照/人体，不能拿"温湿度"当判据——按行数与头部计数验 */
out.push(((await p.locator('#zpEnv .zp-row').count())>0?'✅':'❌')+' 101 环境数据块有真实点位行: '+await p.locator('#zpEnv .zp-row').count()+' 行 · '+await p.locator('#zpEnv em').first().innerText());
out.push(((await p.locator('#zpStats').getAttribute('hidden'))!==null&&(await p.locator('#zpAlarms').getAttribute('hidden'))!==null?'✅':'❌')+' 101 的任务统计/告警块确实隐藏');
out.push(((await p.locator('#zpStats .zp-body').innerText())===''?'✅':'❌')+' 隐藏的块内容已清空（不残留上一个房间的脏数据）');
await p.keyboard.press('1'); await p.waitForTimeout(2000);
T('回总览面板收起', await p.locator('#zonePanel').isVisible(), 'false');
T('总览底栏仍在', await p.locator('#taskStrip').isVisible(), 'true');
await p.keyboard.press('2'); await p.waitForTimeout(3000); await p.screenshot({path:'/tmp/twin-qa/shot-zonepanel-106.png'});
await gotoZone(p, '101'); await p.waitForTimeout(2000); await p.screenshot({path:'/tmp/twin-qa/shot-zonepanel-101.png'});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,8).join('\n'));
await b.close();
