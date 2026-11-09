/**
 * 顶栏（2026-11-07 反馈：不要"web 系统导航栏"的感觉）
 *  ① 无底色/无下边框/无毛玻璃条，文字直接浮在三维画面上（靠 text-shadow 保可读）
 *  ② 标题＝「未来实验室数字孪生」，公司名只留左上角 logo
 *  ③ 区域切换在标题左侧；动作 icon 组在标题右侧
 *  ④ 顶栏不再出现 S1/S2/S3 这类编号前缀；S3 告警回溯按既定范围决定保持缺席
 */
import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
const out=[],err=[];
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
const st=await p.evaluate(()=>{
  const cs=(sel,pseudo)=>getComputedStyle(document.querySelector(sel),pseudo||null);   /* 第二个参数取伪元素：标题的立体厚度在 ::before 上 */
  const R=(sel)=>{const e=document.querySelector(sel);if(!e)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x),r:Math.round(r.right),y:Math.round(r.y),b:Math.round(r.bottom)};};
  const tb=cs('.topbar');
  return {
    bg:tb.backgroundColor, borderBottom:tb.borderBottomWidth, borderTop:tb.borderTopWidth,
    shadow:tb.boxShadow, blur:tb.backdropFilter,
    title:(document.querySelector('.title')||{}).innerText,
    brandSpan:(document.querySelector('.brand span')||{innerText:''}).innerText,
    brandSpanShown:(document.querySelector('.brand span')?cs('.brand span').display:'absent'),
    logo:R('.brand img'), logoAlt:(document.querySelector('.brand img')||{}).alt,
    zone:R('.zsel'), zoneSelBg:cs('#zoneSel').backgroundColor, zoneSelBorder:cs('#zoneSel').borderTopWidth,
    /* 两段式控件（任务20）：组件1 两颗层级按钮的矩形 + 组件2 是否隐藏 */
    lv:R('.lv[data-level="overview"]'), lv2:R('.lv[data-level="zone"]'),
    roomHidden:!!document.getElementById('roomWrap').hidden,
    mode:(document.querySelector('.mode')||{}).innerText,
    titleBox:R('.title'), acts:R('.acts'), clock:R('.clock'),
    clockBg:cs('.clock').backgroundColor, clockBorder:cs('.clock').borderTopWidth,
    railTop:R('.rail').y, topbarB:R('.topbar').b,
    shadows:{title:cs('.title','::before').textShadow!=='none'||cs('.title').textShadow!=='none', mode:cs('.mode').textShadow!=='none', zsel:cs('.zsel').textShadow!=='none', clock:cs('.clock').textShadow!=='none'},
    licCount:document.querySelectorAll('.acts .lic').length,   /* ⑧ 起按组计数：右上=图层三件套；监控 icon 在左侧 nav.modes（图三位），不混进这一档 */
    licAll:document.querySelectorAll('.lic').length, cctvInModes:!!document.querySelector('.modes #cctvToggle'), licOnBg:cs('.lic.on').backgroundColor,
    topbarText:document.querySelector('.topbar').innerText.replace(/\s+/g,' ')
  };
});
out.push(((st.bg==='rgba(0, 0, 0, 0)'||st.bg==='transparent')&&st.borderBottom==='0px'&&st.borderTop==='0px'&&st.shadow==='none'&&(st.blur==='none'))?'✅':'❌'
  +` 顶栏不再是导航栏：底色=${st.bg} 边框=${st.borderBottom}/${st.borderTop} 阴影=${st.shadow} 毛玻璃=${st.blur}`);
T('标题文案', st.title, '未来实验室数字孪生');
out.push(((st.brandSpanShown==='none'||st.brandSpanShown==='absent')&&!st.topbarText.includes('应敏科技')?'✅':'❌')+' 「应敏科技 · 」不再作为文字出现（公司名只留 logo）: display='+st.brandSpanShown);
out.push(((st.logoAlt==='应敏科技')&&!!st.logo&&st.logo.x<120?'✅':'❌')+(' logo 在左上角: alt='+st.logoAlt+' x='+st.logo.x+'（<120）'));
out.push((st.zone&&st.titleBox&&st.zone.r<=st.titleBox.x?'✅':'❌')+` 区域切换在标题左侧（区域右缘 ${st.zone&&st.zone.r} ≤ 标题左缘 ${st.titleBox&&st.titleBox.x}）`);
out.push((st.acts.x>st.titleBox.r?'✅':'❌')+` 动作 icon 组在标题右侧（${st.titleBox.r} → ${st.acts.x}）`);
/* 两段式控件（任务20）：组件1 是「实验室总览 / 区域」两颗层级按钮，组件2「区域房间」只在选区域时出现。
   总览态下 .zsel 是 hidden，拿它的 rect 会量到 0,0——上一版就是这么误判成"区域跑到 logo 左边"。
   顺序断言因此改在**层级按钮**上，并另外验一次"组件2 默认隐藏、切区域后出现"。 */
out.push((st.logo.r<=st.lv.x&&st.lv.x<st.lv2.x&&st.lv2.r<=st.titleBox.x?'✅':'❌')
  +` 顺序＝logo → 实验室总览 → 区域 → 标题：logo右${st.logo.r} / 层级组${st.lv.x}→${st.lv2.r} / 标题左${st.titleBox.x}`);
out.push((st.roomHidden===true?'✅':'❌')+` 总览态下组件2（区域房间）默认隐藏: hidden=${st.roomHidden}`);
out.push((!/S[123]/.test(st.mode)&&!/S[123]/.test(st.topbarText)?'✅':'❌')+' 顶栏没有任何 S1/S2/S3 编号前缀: '+st.topbarText.slice(0,64));
out.push((st.topbarText.indexOf('告警回溯')<0?'✅':'❌')+' S3 告警回溯仍不在屏上（按 2026-11-06 范围决定，未复活）');
out.push(((st.clockBg==='rgba(0, 0, 0, 0)'||st.clockBg==='transparent')&&st.clockBorder==='0px'?'✅':'❌')+` 时钟也去掉胶囊框，只做悬浮文字：bg=${st.clockBg} border=${st.clockBorder}`);
out.push(((st.zoneSelBg==='rgba(0, 0, 0, 0)'||st.zoneSelBg==='transparent')&&st.zoneSelBorder==='0px'?'✅':'❌')+` 区域下拉同样无框无底：bg=${st.zoneSelBg}`);
out.push((st.shadows.title&&st.shadows.mode&&st.shadows.zsel&&st.shadows.clock?'✅':'❌')+' 悬浮文字都带投影保证在三维画面上可读: '+JSON.stringify(st.shadows));
out.push((st.railTop>=st.topbarB?'✅':'❌')+` 顶栏与左栏不重叠（顶栏底 ${st.topbarB} ≤ 左栏顶 ${st.railTop}）`);
T('图层 icon 数（右上组：路径/场地标签/热力）', st.licCount, 3);
out.push((st.licAll===4&&st.cctvInModes?'✅':'❌')+' 第 4 个 .lic 是监控视角开关，且落在左侧视图层级组里（区域房间 chip 后、标题左）: 全部 '+st.licAll+' 个，位置='+st.cctvInModes);
out.push((st.licOnBg!=='rgb(40, 120, 255)'?'✅':'❌')+' 开启态不再是实心蓝底按钮（改为淡底+描边）: '+st.licOnBg);

// 功能没被视觉改动打断
/* FR-42 把「场地标签」初始化改成默认关，这条期望还是旧的"点一下就关"，于是把一次成功的开启判成失败。
   这条的本意是"顶栏悬浮化没打断功能"，那就该验**两次点击把开关原样翻回去**，比只验一个方向更严。 */
const licOn=()=>p.evaluate(()=>!!document.querySelector('.lic[data-layer=labels]').classList.contains('on'));
const licPressed=()=>p.evaluate(()=>document.querySelector('.lic[data-layer=labels]').getAttribute('aria-pressed'));
const l0=await licOn();                                   /* 初始态：默认关 */
await p.click('.lic[data-layer=labels]'); await p.waitForTimeout(1000);
const l1=await licOn(), a1=await licPressed();
await p.click('.lic[data-layer=labels]'); await p.waitForTimeout(800);
const l2=await licOn();
out.push(((l0===false&&l1===true&&l2===false&&a1==='true')?'✅':'❌')
  +` 悬浮化后 icon 仍可点：场地标签默认关→点开→再点关（aria-pressed 跟着走，实测 ${l0}/${l1}/${l2} pressed=${a1}）`);
await gotoZone(p, '106'); await p.waitForTimeout(2600);
out.push(((await p.evaluate(()=>new URLSearchParams(location.search).get('mode')))==='ZONE'?'✅':'❌')+' 悬浮化后区域切换仍下钻');
await p.click('.mode[data-mode=S1]'); await p.waitForTimeout(2200);
out.push(((await p.evaluate(()=>new URLSearchParams(location.search).get('mode')))==='S1'?'✅':'❌')+' 「实验室总览」文字按钮仍回总览');
await p.screenshot({path:'/tmp/twin-qa/topbar-check.png', clip:{x:0,y:0,width:1920,height:130}});
console.log(out.join('\n')); console.log('errors('+err.length+'):\n'+err.slice(0,5).join('\n'));
await b.close();
