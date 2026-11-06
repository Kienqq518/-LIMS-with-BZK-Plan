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
  ['smoke', '装载链与主叙事：四张表/三分区/图层/遥控按键/区域面板 + 常驻断言「fail() 未被触发」'],
  ['zone-panel', '区域视图五类信息（设备/环境/任务统计/在制任务/告警）与浮层让位'],
  ['filtercheck', '告警三分区的筛选控件位置与互不影响（几何上必须在右侧告警流内）'],
  ['alarmlvl', 'A/B/C 三分区口径：标题与计数来自接口、每区只含本级、URL 三区态、无 Grade 英文'],
  ['sitelabel', '「场地标签」只控房间名：光点与物联节点标签不受影响'],
  ['kpicheck', '四张数据表数字自洽（委托占比、样品/试验项目、逾期临期、阻塞拆分）'],
  ['plancheck', '逾期/临期由在办清单推导（接口值 == 独立重算值）'],
  ['routecheck', '行进范围与避让：CAD 占地 A* 与逐段校验'],
  ['camcheck', '首屏机位固定 + 视角指令排队 + URL 恢复'],
  ['fscheck', '全屏进入/退出/文案/aria/浮层贴边/F 键 + ?quality=low 交付参数'],
  ['bluecheck', '下钻不再画满屏蓝框（分组轮廓已回退）'],
  ['collapsec', '「收起底栏」只作用今日任务表；机器人状态条与说明条已整体删除'],
  ['s3check', 'S3 告警回溯已移出 MVP：抽屉/按钮/按键映射都不存在，告警只呈现当前闭环'],
  ['uxcheck', '透明浮层 + 下钻/切近补间 + 信息卡 + 循环剧本 + 避让自检（44 项）'],
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
