/**
 * 数字孪生 QA 总入口：顺序跑完全部套件并汇总 ✅/❌
 *   node tests/twin/run-all.mjs                 # 自动起本地静态服务（若 8099 未监听）
 *   node tests/twin/run-all.mjs --only smoke,alarmlvl
 *   TWIN_BASE=https://xxx.vercel.app node tests/twin/run-all.mjs --no-serve   # 打线上
 * 为什么顺序跑：套件里有按墙上时钟对齐的循环剧本断言（机器人速度/停靠/门洞穿越），并发会互相抢 CPU 造成假失败。
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const argv = process.argv.slice(2);
const noServe = argv.includes('--no-serve');
const only = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1]
  || (argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : '');

const SUITES = [
  ['topbarcheck', '顶栏去导航栏化：无底色/无边框/无毛玻璃条、标题=未来实验室数字孪生、logo 左上角、区域切换在标题左侧、icon 组在右侧、无 S1/S2/S3 前缀，且功能未被打断'],
  ['smoke', '装载链与主叙事：四张表/三分区/图层/遥控按键/区域面板 + 常驻断言「fail() 未被触发」'],
  ['zone-panel', '区域视图五类信息（设备/环境/任务统计/在制任务/告警）与浮层让位'],
  ['filtercheck', '告警三分区的筛选控件位置与互不影响（几何上必须在右侧告警流内）'],
  ['alarmlvl', 'A/B/C 三分区口径：标题与计数来自接口、每区只含本级、URL 三区态、无 Grade 英文'],
  ['pickcheck', '点击与键盘入口：光点可点出设备卡、设备本体可点、节点身份标签下线但点击出卡、告警行 Tab/Enter 可达、B 区瓶颈归 106'],
  ['sitelabel', '「场地标签」只控房间名：光点与物联节点标签不受影响'],
  ['kpicheck', '四张数据表数字自洽（委托占比、样品/试验项目、逾期临期、阻塞拆分）'],
  ['plancheck', '逾期/临期由在办清单推导（接口值 == 独立重算值）'],
  ['robotcheck', '机器人编排：RB-C-01 停靠 102-05 充电位（本体位置/单点路径/电量回升/不判卡住/详情可读），RB-C-02 是唯一在跑的机器人'],
  ['dockcheck', '底栏四块：设备信息统计自洽 / 调度任务队列三分类且与循环剧本同步 / 委托单试验项（图4 名称与设备）/ 组态物联节点按房间排序，行点击与键盘有落点'],
  ['zoneview', '下钻画像：106 保留左栏+底栏且机器人继续跑；非 106 只留右侧面板；统计口径按房间分（任务四格/检测项目数/样品台账/仅环境数据）；浮层间距'],
  ['routecheck', '行进范围与避让：CAD 占地 A* 与逐段校验'],
  ['camcheck', '首屏机位固定 + 视角指令排队 + URL 恢复'],
  ['fscheck', '全屏进入/退出/文案/aria/浮层贴边/F 键 + ?quality=low 交付参数'],
  ['bluecheck', '下钻不再画满屏蓝框（分组轮廓已回退）'],
  ['collapsec', '「收起底栏」只作用底栏四块；机器人状态条与说明条已整体删除'],
  ['s3check', 'S3 告警回溯已移出 MVP：抽屉/按钮/按键映射都不存在，告警只呈现当前闭环'],
  ['uxcheck', '透明浮层 + 下钻/切近补间 + 信息卡 + 循环剧本 + 避让自检（44 项）'],
  ['uiconcheck', '视觉一致性守卫（FR-35）：四块面板同一玻璃配方、字号地板 10.4px、宿主样式零裸值、3D 与 DOM 同一组状态色、可点元素三态齐、场景内标签/节点标记并回 token、读数等宽'],
  ['lookcheck', '光影材质精修守卫（FR-37）：材质角色 kit 命中数、灯光数值压过引擎预设、雾窗口跟机位、画布空白处必须仍透明（写 alpha=1 会把整屏压黑）、单一预算内投影灯与贴图上限、后处理在场仍 ≥50fps、?look=flat 与 ?quality=low 两个开关真生效'],
  ['chartcheck', '3D 图表（FR-36）：本地 vendor 无 CDN、每张图真有像素、图与表同源、环形三片相加=分组之和、温湿度末点钉住当前读数、点节点行换序列、周期与下钻跟着变、role=img、reduced-motion 仍出图'],
  ['focuscheck', '**89 个设备/物品逐个验**：点击→选中→气泡→落点偏差<14px→构图占比→滚轮双向且钉住；未建模 11 个只给说明不动相机（约 4 分钟，FR-34）'],
];
const list = only ? SUITES.filter(([n]) => only.split(',').includes(n)) : SUITES;

function portOpen(p) {
  return new Promise(res => {
    const req = fetch('http://127.0.0.1:' + p + '/twin/future-lab/twin-scene-v2.html', { signal: AbortSignal.timeout(1500) });
    req.then(r => res(r.ok || r.status > 0)).catch(() => res(false));
  });
}

async function serve(root, port) {
  const py = ['/usr/bin/python3', 'python3'].find(existsSync) || 'python3';
  const child = spawn(py, ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { if (await portOpen(port)) return child; await new Promise(r => setTimeout(r, 250)); }
  return child;
}

function runSuite(name) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(HERE, name + '.mjs')], { cwd: HERE, env: process.env });
    let buf = '';
    child.stdout.on('data', d => { buf += d.toString(); });
    child.stderr.on('data', d => { buf += d.toString(); });
    child.on('close', code => {
      const pass = (buf.match(/✅/g) || []).length;
      const fail = (buf.match(/❌/g) || []).length;
      resolve({ name, code, pass, fail, ms: Date.now() - t0, buf });
    });
  });
}

let server = null;
if (!noServe && !process.env.TWIN_BASE) {
  const port = Number(new URL(process.env.TWIN_BASE || 'http://127.0.0.1:8099').port || 8099);
  if (!(await portOpen(port))) server = await serve(ROOT, port);
}

const results = [];
for (const [name, what] of list) {
  process.stdout.write(`· ${name} … `);
  const r = await runSuite(name);
  results.push({ ...r, what });
  console.log(`${r.fail === 0 && r.code === 0 ? '✅' : '❌'} ${r.pass} 项通过 / ${r.fail} 项失败（${(r.ms / 1000).toFixed(0)}s）`);
  if (r.fail) console.log(r.buf.split('\n').filter(l => l.startsWith('❌')).map(l => '    ' + l).join('\n'));
  if (r.code !== 0) console.log('    进程退出码 ' + r.code + '：' + r.buf.split('\n').filter(l => /Error|error:/.test(l)).slice(0, 3).join(' | '));
}

const tp = results.reduce((a, r) => a + r.pass, 0), tf = results.reduce((a, r) => a + r.fail, 0);
console.log('\n合计 ' + tp + ' ✅ / ' + tf + ' ❌，套件 ' + results.length + '/' + list.length + (server ? '（本地服务已关）' : ''));
if (server) server.kill();
process.exit(tf === 0 && results.every(r => r.code === 0) ? 0 : 1);
