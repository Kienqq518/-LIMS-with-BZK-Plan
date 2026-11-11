/**
 * 视觉一致性守卫（ui-ux-pro-max 校准，FR-35）——把"统一"变成可回归的断言，而不是口头承诺
 *  ① 玻璃配方一致：四块悬浮面板必须同一 bg / blur / radius / shadow
 *  ② 字号地板：屏上不许出现 <10.4px 的文字（库口径 dense dashboard 小字 12px 档，这里地板 10.5px）
 *  ③ 裸值纪律：twin-scene-v2.css 里除注释外不许再出现 hex / blur(Npx) / font-size:Npx / z-index:N
 *  ④ 状态色单一事实源：3D 侧与 DOM 侧必须读同一组 token（TWIN_TOKEN 与 CSS 变量同值）
 *  ⑤ 交互态：可点元素必须 cursor:pointer，且 CSS 里存在 focus-visible 规则
 *  ⑥ 场景内 DOM（房间标签 / 节点标记）在 V2 下必须并回宿主同一套 token
 *  ⑦ 数字等宽（tabular-nums），滚动刷新时不跳字
 */
import { chromium } from 'playwright';
import { BASE, gotoZone } from './_env.mjs';
const out=[],err=[];
const T=(k,v,e)=>out.push((String(v)===String(e)?'✅':'❌')+` ${k}: ${v} (期望 ${e})`);
const ok=(c,m)=>out.push((c?'✅':'❌')+' '+m);
const b=await chromium.launch({channel:'chrome'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
p.on('pageerror',e=>err.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error'&&!/favicon|404/.test(m.text()))err.push('console: '+m.text().slice(0,150));});
await p.goto(BASE+'/twin/future-lab/twin-scene-v2.html',{waitUntil:'load'});
await p.waitForTimeout(15000);
const f=p.frames().find(x=>/tour-space-v3-1/.test(x.url()));

// ① 玻璃配方
const glass=await p.evaluate(()=>{const g=s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);
  return [c.backgroundColor,c.backdropFilter,c.borderTopWidth+' '+c.borderTopColor,c.borderTopLeftRadius,c.boxShadow!== 'none'].join('|');};
  return {rail:g('.rail'),stream:g('.stream'),zone:g('.zonepanel'),dk:g('.dk')};});
await gotoZone(p, '106'); await p.waitForTimeout(2600);
const glass2=await p.evaluate(()=>{const g=s=>{const e=document.querySelector(s);if(!e)return null;const c=getComputedStyle(e);
  return [c.backgroundColor,c.backdropFilter,c.borderTopWidth+' '+c.borderTopColor,c.borderTopLeftRadius,c.boxShadow!=='none'].join('|');};
  return {rail:g('.rail'),stream:g('.stream'),zone:g('.zonepanel'),dk:g('.dk')};});
/* 2026-11-07 圈图后分两类，两类各自必须内部一致：
   · 侧栏（左栏 + 右列告警流）= 无底板层：bg transparent / blur none / 0 描边 / 无阴影
   · 底栏 + 区域面板 = 同一档玻璃配方（bg / blur / 描边 / 圆角 / 阴影五项逐位相同）
   曾经四块共用一档玻璃；侧栏撤底板后如果还按"四块一致"断言，就会把新口径判成回归。 */
const noSheet=s=>{const [bg,blur,border,radius,shadow]=String(s||'').split('|');
  return (bg==='rgba(0, 0, 0, 0)'||bg==='transparent')&&blur==='none'&&/^0px/.test(border)&&shadow==='false';};
ok(noSheet(glass2.rail)&&noSheet(glass2.stream),`侧栏无底板层（左栏 + 告警流：透明/无 blur/无描边/无阴影）: rail=${String(glass2.rail).slice(0,40)} stream=${String(glass2.stream).slice(0,40)}`);
/* FR-80 之后 .zonepanel 连 DOM 一起删了，glass2.zone 恒为 null：
   原来这行对未过滤 null 的集合做 x.slice()，整套 15 项当场蒸发（崩掉不等于通过）。
   判据改成"只剩底栏一处玻璃配方，且区域面板不再贡献第二处"——退役要留下痕迹，不能靠删断言蒙过去。 */
ok(glass2.zone===null&&!!glass2.dk,`底栏仍是唯一使用玻璃档的浮层，区域面板已无第二处：dk=${String(glass2.dk).slice(0,46)} zone=${String(glass2.zone)}`);
/* FR-42 把底栏与区域面板的底板也撤了，"玻璃那档"只剩两处仍在使用：顶栏 icon 组 .layers（宿主）
   与三维里的实体信息气泡 #twin-v2-card（场景文档）。断言原意不变——守住 --tw-blur 必须是完整函数：
   backdrop-filter 只吃 <filter-list>，裸 14px 会让整条声明静默失效变 none，那时 computed 里根本量不出来。 */
const blurLive=await p.evaluate(()=>{const g=s=>{const e=document.querySelector(s);return e?getComputedStyle(e).backdropFilter:'absent';};
  return {token:getComputedStyle(document.documentElement).getPropertyValue('--tw-blur').trim(),layers:g('.layers')};});
/* 实体气泡是首次选中时才建的（bridge 里 cardEl 懒创建），所以先走引擎自己的选中事件把它请出来，
   量完立刻按产品自己的 × 关掉，不给后面的断言留残留状态。 */
await f.evaluate(()=>{window.visual106.selected='106-12';
  window.dispatchEvent(new CustomEvent('space-device-select',{detail:{id:'106-12',name:'106-12',roomId:'106'}}));});
await p.waitForTimeout(500);
const cardBlur=await f.evaluate(()=>{const c=document.getElementById('twin-v2-card');
  const v=c?getComputedStyle(c).backdropFilter:'no-card-el'; if(c&&c.querySelector('.x')) c.querySelector('.x').click(); return v;});
ok(/^blur\(\d+(\.\d+)?px\)$/.test(blurLive.token)&&blurLive.layers.includes(blurLive.token)&&cardBlur.includes(blurLive.token),
  `玻璃那档 blur 真的生效（--tw-blur=${blurLive.token}，.layers 与实体气泡两处都解析得出来）: layers=${blurLive.layers} card=${cardBlur}`);
const plate=await p.evaluate(()=>{const c=getComputedStyle(document.querySelector('.rail'));
  return {ts:c.textShadow,token:getComputedStyle(document.documentElement).getPropertyValue('--tw-text-plate').trim()};});
ok(plate.ts!=='none'&&plate.ts.replace(/\s+/g,' ').includes('255, 255, 255'),`无底板后文字带白垫底（--tw-text-plate）: ${plate.ts.slice(0,64)}`);

// ② 字号地板
const tiny=await p.evaluate(()=>{const bad=[];const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT);
  let n;while((n=walk.nextNode())){const e=n;if(e.closest('svg')||e.tagName==='svg')continue;
    if(!e.textContent||!e.textContent.trim())continue;const fs=parseFloat(getComputedStyle(e).fontSize);
    if(fs<10.4)bad.push((e.className||e.tagName)+':'+fs);}
  return [...new Set(bad)].slice(0,8);});
ok(tiny.length===0,'屏上没有 <10.4px 的文字（8/9/9.5px 三档已并掉）: '+JSON.stringify(tiny));

// ③ 裸值纪律（源文件扫描）
const src=await p.evaluate(async()=>{const t=await (await fetch('twin-scene-v2.css?v=8')).text();
  const noComment=t.replace(/\/\*[\s\S]*?\*\//g,'');
  return {hex:(noComment.match(/#[0-9a-fA-F]{3,6}\b/g)||[]).filter(x=>x!=='#000'&&x!=='#fff'),
    blur:(noComment.match(/blur\(\d/g)||[]).length,fs:(noComment.match(/font-size:\d/g)||[]).length,
    z:(noComment.match(/z-index:\d/g)||[]).length,radius:(noComment.match(/border-radius:[0-9]+px/g)||[]).length};});
ok(src.hex.length===0&&!src.blur&&!src.fs&&!src.z&&!src.radius,
  `宿主样式无裸值：hex=${src.hex.length} blur=${src.blur} font-size=${src.fs} z-index=${src.z} border-radius=${src.radius}（全部走 var）`);

// ④ 3D 与 DOM 同一组状态色
const st=await f.evaluate(()=>{const c=getComputedStyle(document.documentElement);
  return {cssWorking:c.getPropertyValue('--tw-st-working').trim(),cssAlarm:c.getPropertyValue('--tw-st-alarm').trim(),
    js:(window.__twinTokensForQA&&window.__twinTokensForQA.working!=null)?window.__twinTokensForQA.working.toString(16):null};});
ok(st.cssWorking.toLowerCase()==='#2878ff'&&st.cssAlarm.toLowerCase()==='#e5484d','状态色 token 就位（working #2878FF / alarm #E5484D）: '+JSON.stringify(st));

// ⑤ 交互态
const inter=await p.evaluate(()=>{const sel='button,.zp-row,.st-row,.dq-row,.ti-row,.nd-row,.mode,.pill,.lic,.seg,.mini';
  const bad=[...document.querySelectorAll(sel)].filter(e=>{const c=getComputedStyle(e);
    return (c.display==='none'||e.offsetParent===null||e.disabled||e.getAttribute('aria-disabled')==='true')?false:c.cursor!=='pointer';}).map(e=>(e.className||e.tagName)+':'+getComputedStyle(e).cursor);
  const hasFocus=[...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch(e){return[]}}).some(r=>/focus-visible/.test(r.cssText||''));
  return {bad:[...new Set(bad)].slice(0,6),hasFocus};});
ok(inter.bad.length===0,'可点元素一律 cursor:pointer: '+JSON.stringify(inter.bad));
ok(inter.hasFocus,'存在 :focus-visible 规则（键盘停在哪儿看得见）');

// ⑥ 场景内 DOM 并回同一套 token
const scene=await f.evaluate(()=>{const rl=document.querySelector('.room-label'),nm=document.querySelector('.node-marker');
  const a=rl&&getComputedStyle(rl),c=nm&&getComputedStyle(nm);
  return {v2:document.documentElement.dataset.v2||'-',
    label:a?[a.backgroundColor,a.borderTopLeftRadius,a.fontSize].join('|'):null,
    marker:c?[c.backgroundColor,c.color,c.borderTopColor].join('|'):null,
    size:c?[c.width,c.height].join('|'):null};});
ok(scene.v2==='1','场景页在 V2 宿主下打了 data-v2 标记: '+scene.v2);
ok(scene.label==='rgba(255, 255, 255, 0.9)|8px|12.5px','房间标签=宿主同一档玻璃/chip 圆角/body 字号: '+scene.label);
ok(/rgb\(40, 120, 255\)/.test(scene.marker||''),'节点标记用宿主品牌蓝（不再是底座那族 #096bff）: '+scene.marker);
ok((scene.size||'').split('|')[0]==='26px','V2 大屏节点标记收到 26px（底座 40px 只留给笔记本鼠标）: '+scene.size);

// ⑦ 数字等宽
/* FR-80：统计数字搬到左栏 #zsGrid；①（2026-11-09）106 又升级为三子区域 .zs3-c——
   两代版式都可能在屏上（102/103 仍是 .zs-i 四格，106 是 .zs3-c），逐个槽位取「存在的那个」，
   都不存在才算 missing，等宽判据本身不放宽。 */
const nums=await p.evaluate(()=>{const pick=sels=>{for(const s of [].concat(sels)){const e=document.querySelector(s);if(e)return getComputedStyle(e).fontVariantNumeric;}return 'missing';};
  return ['.dk-lg .vv',['.zs-i b','.zs2-h b'],'.dq-row .tm'].map(pick);});
ok(nums.every(x=>x==='tabular-nums'),'读数等宽（滚动不跳字）: '+JSON.stringify(nums));

ok(err.length===0,'无 pageerror/console error: '+err.slice(0,3).join(' | '));
console.log(out.join('\n'));
const bad=out.filter(l=>l.startsWith('❌')).length;
console.log('\n通过 '+out.filter(l=>l.startsWith('✅')).length+' · 失败 '+bad);
await b.close();
process.exit(bad?1:0);
