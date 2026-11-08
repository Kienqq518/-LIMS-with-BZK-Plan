/**
 * 告警分级口径（2026-11-07 改版：告警流不再切 A/B/C 三个区域，按发生时间平铺）
 * 这条套件因此从"验三区"改成"验等级信息在平铺后一项没丢"：
 *  ① 行内等级徽标只有 A/B/C，且与接口 alarm-sections 的分级计数一致；
 *  ② 排序口径可验证（最新在前）；
 *  ③ 一个筛选开关（只看未解除 / 全部）在两处面板同步，URL 可恢复；
 *  ④ 屏上不出现 Grade 英文；详情卡同；
 *  ⑤ 区域视图的告警块同样平铺（两套分区模型并存的坑已拆掉）。
 */
import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
const out=[],err=[];
const ok=(c,m)=>out.push((c?'✅':'❌')+' '+m);
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);

T('页面不含 Grade 英文', await p.evaluate(()=>document.body.innerText.includes('Grade')), false);
T('A/B/C 分区已撤（.asec 数）', await p.locator('.asec').count(), 0);
T('告警流是平铺列表（13 条 ×2 无缝复制）', await p.locator('#streamTrack .st-row').count(), 26);
const meta=(await p.locator('#streamMeta').innerText()).replace(/\s+/g,' ');
out.push((/今日 13 条 · 未解除 9 · 最新在前/.test(meta)?'✅':'❌')+' 头部汇总口径: '+meta);

const rows=await p.evaluate(()=>[...document.querySelectorAll('#streamTrack .st-row')].slice(0,13).map(r=>({g:r.dataset.grade,t:r.querySelector('.tm').innerText,badge:(r.querySelector('.gd')||{}).innerText})));
out.push((rows.every(r=>['A','B','C'].includes(r.g)&&r.badge===r.g)?'✅':'❌')+' 每行行首徽标只有 A/B/C 且等于该行等级: '+rows.slice(0,5).map(r=>r.badge).join(','));
const times=rows.map(r=>r.t);
out.push((times.slice().sort().reverse().join('|')===times.join('|')?'✅':'❌')+' 排序=按发生时间倒序（最新在前）: '+times.slice(0,4).join(' → '));
const secApi=await p.evaluate(async()=>(await TwinApi.get('/api/overview/alarm-sections')).data);
const dist=['A','B','C'].map(g=>rows.filter(r=>r.g===g).length);
const apiCnt=await p.evaluate(async()=>{const r=await TwinApi.get('/api/overview/alarms');const A=r.data.alarms||r.data;
  return ['A','B','C'].map(g=>A.filter(x=>x.grade===g).length);});
out.push((apiCnt.every((v,i)=>v===dist[i])?'✅':'❌')+` 分级计数与告警接口一致（分区撤了，数据层口径没动）: 屏上 ${dist.join('/')} vs 接口 ${apiCnt.join('/')}`);
out.push((secApi.length===3&&['A','B','C'].every((g,i)=>secApi[i].id===g&&secApi[i].title&&secApi[i].key)?'✅':'❌')
  +' 等级标题/key 仍来自 /api/overview/alarm-sections（分区撤了但分级词表没写死在 JS）: '+secApi.map(x=>x.id+'='+x.title).join(' / '));

/* 一个筛选开关 */
const before=await p.locator('#streamTrack .st-row').count();
await p.click('#alarmStream [data-sfilter=open]'); await p.waitForTimeout(900);
const after=await p.locator('#streamTrack .st-row').count();
out.push((after<before&&after===18?'✅':'❌')+` 「只看未解除」= 9 条 ×2 复制: ${before}→${after}`);
T('URL 记录筛选态', await p.evaluate(()=>new URLSearchParams(location.search).get('sf')), 'open');
await p.click('#alarmStream [data-sfilter=all]'); await p.waitForTimeout(700);
out.push(((await p.locator('#streamTrack .st-row').count())===26?'✅':'❌')+' 切回全部恢复 26 行');

/* 详情卡 */
await p.evaluate(()=>{const t=document.getElementById('streamTrack');t.style.animation='none';});
const first=p.locator('#streamTrack .st-row').first();
await first.click(); await p.waitForTimeout(1300);
const card=(await p.locator('#detail').innerText().catch(()=>''));
out.push((card&&!/Grade/.test(card)?'✅':'❌')+' 点行出详情卡且卡内无 Grade 英文: '+card.replace(/\s+/g,' ').slice(0,44));
await p.keyboard.press('Escape'); await p.waitForTimeout(600);

/* 区域视图同样平铺 */
await gotoZone(p, '106'); await p.waitForTimeout(4200);
T('区域视图告警块也无分区（.zsec 数）', await p.locator('.zsec').count(), 0);
/* FR-80：不再另有一份"面板告警"，右列告警流就是本区告警的唯一落点（也只剩这一套分区模型） */
const zrows=await p.evaluate(()=>[...document.querySelectorAll('#streamTrack .st-row[data-alarm]')].map(r=>({g:r.dataset.grade,badge:(r.querySelector('.gd')||{}).innerText})));
out.push((zrows.length>0&&zrows.every(r=>r.badge===r.g)?'✅':'❌')+' 区域告警行同样带等级徽标: '+zrows.length+' 行');
out.push(((await p.locator('#rightCol [data-sfilter]').count())===2?'✅':'❌')+' 区域视图里筛选开关在右列告警流上（面板退役，右列不再整列让位）');

ok(err.length===0,'无 pageerror/console error: '+err.slice(0,3).join(' | '));
console.log(out.join('\n'));
const bad=out.filter(l=>l.startsWith('❌')).length;
console.log('\n通过 '+out.filter(l=>l.startsWith('✅')).length+' · 失败 '+bad);
await b.close();
process.exit(bad?1:0);
