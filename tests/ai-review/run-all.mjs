/**
 * AI Review QA 总入口
 *   node tests/ai-review/run-all.mjs
 *   node tests/ai-review/run-all.mjs --only storecheck
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const argv = process.argv.slice(2);
const noServe = argv.includes('--no-serve');
const only = (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1]
  || (argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : '');

const SUITES = [
  ['storecheck', '种子 7 表与版本键'],
  ['enginecheck', '8 条规则引擎 + 聚合 + CAT-UNCAT-01'],
  ['workbenchcheck', '审核工作台'],
  ['auditcheck', '报告审核页自动触发'],
  ['rulescheck', '规则配置页'],
  ['navcheck', '入口挂载'],
];
const list = only ? SUITES.filter(([n]) => only.split(',').includes(n)) : SUITES;

function portOpen(p) {
  return new Promise((res) => {
    fetch('http://127.0.0.1:' + p + '/index.html', { signal: AbortSignal.timeout(1500) })
      .then((r) => res(r.ok || r.status > 0))
      .catch(() => res(false));
  });
}

async function serve(root, port) {
  const py = ['/usr/bin/python3', 'python3'].find(existsSync) || 'python3';
  const child = spawn(py, ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: root,
    stdio: 'ignore',
  });
  for (let i = 0; i < 40; i++) {
    if (await portOpen(port)) return child;
    await new Promise((r) => setTimeout(r, 250));
  }
  return child;
}

function runSuite(name) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [path.join(HERE, name + '.mjs')], { cwd: HERE, env: process.env });
    let buf = '';
    child.stdout.on('data', (d) => { buf += d.toString(); });
    child.stderr.on('data', (d) => { buf += d.toString(); });
    child.on('close', (code) => {
      const pass = (buf.match(/✅/g) || []).length;
      const fail = (buf.match(/❌/g) || []).length;
      resolve({ name, code, pass, fail, ms: Date.now() - t0, buf });
    });
  });
}

const PORT = 8097;
let server = null;
if (!noServe && !process.env.AIR_BASE) {
  if (!(await portOpen(PORT))) server = await serve(ROOT, PORT);
}

const results = [];
for (const [name, what] of list) {
  process.stdout.write(`· ${name} … `);
  const r = await runSuite(name);
  results.push({ ...r, what });
  console.log(`${r.fail === 0 && r.code === 0 ? '✅' : '❌'} ${r.pass} 项通过 / ${r.fail} 项失败（${(r.ms / 1000).toFixed(1)}s）`);
  if (r.fail) console.log(r.buf.split('\n').filter((l) => l.startsWith('❌')).map((l) => '    ' + l).join('\n'));
}

const tp = results.reduce((a, r) => a + r.pass, 0);
const tf = results.reduce((a, r) => a + r.fail, 0);
console.log('\n合计 ' + tp + ' ✅ / ' + tf + ' ❌，套件 ' + results.length + '/' + list.length);
if (server) server.kill();
process.exit(tf === 0 && results.every((r) => r.code === 0) ? 0 : 1);
