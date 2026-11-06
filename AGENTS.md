# 项目协作约定（-LIMS with BZK-Plan 原型仓）

- **改完直接上线，不用询问**：每轮改动验证通过后，提交 → 变基到最新 `origin/main`（如有新提交）→ `git push origin HEAD:main`（触发 Vercel 构建），无需再向用户确认是否 push。用户 2026-11-05 明确指示。
- **决策基准**：数字孪生相关的一切取舍以根目录 `PRD-v1.md` 为准（定位/用户优先级/S1–S3 场景/交付形态/数据来源/非目标），偏离前必须先与用户对照确认。
- 生产分支只有 `origin/main`；push 前一律 `git fetch` 用 `origin/main` 量领先，不要看遗留 remote `lims-plan`。
- 新页面必须挂 `css/ui-baseline.css` + `js/ui-a11y.js`（`twin/` 数字孪生包入口已同样处理）。
- 台账/主数据 mock 走 localStorage 种子（`js/equip-store.js`、`js/venue-store.js`）：**改种子必须同步升 `STORAGE_KEY` 版本号**，否则浏览器里看不到变化。
- 数字孪生回归：`cd tests/twin && node run-all.mjs`（14 套 Playwright 断言，自动起/关本地静态服务）。改 `twin/future-lab/twin-scene-v2.*`、`twin/js/twin-api-mock.js`、`twin/api/seed.json`、`twin/future-lab/twin-scene-bridge.js` 后必须跑；套件里的期望值与 mock 种子绑定，**改种子要同步改期望**。
- 数字孪生：`twin/` 三目录（`future-lab`/`src`/`mock`）同级不可拆；底座入口 `twin/future-lab/tour-lab-v3-1.html`；数据契约与 T1 对接设计见 `docs/digital-twin-integration.md`。
