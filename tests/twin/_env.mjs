/**
 * 数字孪生 QA 套件公共环境（每个 suite 第一行 import 它）
 * - BASE：被测地址。默认本地 http://127.0.0.1:8099；跑线上回归就 `TWIN_BASE=https://xxx.vercel.app node smoke.mjs`
 *   （注意：线上是已部署的 commit，本地改动要先 push 才能用线上地址验）
 * - 截图统一落 /tmp/twin-qa/，导入时自动建目录，避免 Playwright 因目录不存在报错、也避免污染仓库
 */
import { mkdirSync } from 'node:fs';
export const BASE = (process.env.TWIN_BASE || 'http://127.0.0.1:8099').replace(/\/+$/, '');
export const SHOT_DIR = process.env.TWIN_SHOT_DIR || '/tmp/twin-qa';
try { mkdirSync(SHOT_DIR, { recursive: true }); } catch (e) { /* 已存在 */ }
