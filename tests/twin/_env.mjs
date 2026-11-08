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

/** 顶栏两段式（2026-11-08）：房间下拉只在「区域」层级出现，直接 selectOption 会因元素隐藏超时。
    所有套件统一走这里——它同时也是在验"组件1 切区域 → 组件2 出现"这条交互。 */
export async function gotoZone(page, zone) {
  const lv = page.locator('.mode.lv[data-level="zone"]');
  if (await lv.count()) { await lv.first().click({ timeout: 3000 }); await page.waitForTimeout(300); }
  await page.selectOption('#zoneSel', zone);
}
export async function gotoOverview(page) {
  const lv = page.locator('.mode.lv[data-level="overview"]');
  if (await lv.count()) { await lv.first().click({ timeout: 3000 }); return; }
  await page.click('.mode[data-mode=S1]');
}
