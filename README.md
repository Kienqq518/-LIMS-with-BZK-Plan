# 可判定 LIMS 原型（含物资类）· -LIMS with BZK-Plan

静态原型（纯 HTML/CSS/JS，无构建步骤）。

- 线上地址：<https://lims-with-bzk-plan.vercel.app>
- 合格证短链示例：<https://lims-with-bzk-plan.vercel.app/l/Ab3K9> → 验真页；报告溯源 <https://lims-with-bzk-plan.vercel.app/rl/Rpt001>
- 部署：Vercel Git 集成，push 到 `main` 自动构建（见 `vercel.json`，`docs/` 已在 `.vercelignore` 中排除）

> 注意：`lims-plan.vercel.app` 是另一个仓库（-LIMS-Plan）的站点，不是本原型的地址。

## 协作与部署约定

- **生产分支只有一个：`origin/main`**（remote `origin` = `Kienqq518/-LIMS-with-BZK-Plan`）。推 `main` 即触发 Vercel 集成构建，项目为 `kienqianliang-8292s-projects/lims-with-bzk-plan`。
- **不再与 `-LIMS-Plan` 仓库做跨仓同步**。本地 remote `lims-plan` 指向上面那个独立仓库，只是历史遗留；判断「远端领先多少」一律用 `origin/main`，不要按 `lims-plan/main` 量，否则会得出错误结论。透明实验室路线图页（`transparent-lab-roadmap.html`）已于 2026-11-03 一次性并入本仓，此后各走各的。
- **新页面必须引用 UI 基线**：`<link rel="stylesheet" href="css/ui-baseline.css">`（焦点环、对比度、最小字号、reduced-motion）+ `<script src="js/ui-a11y.js" defer></script>`（装饰图标 `aria-hidden`、纯图标按钮补可访问名、溢出表格包滚动容器、`onclick` 非按钮元素补 `role=button`）。全站 84 页已统一，漏掉新页会立刻成为体验孤岛。
- **视觉决策先读** `design-system/lims-prototype/MASTER.md`，尤其文末「本项目修正」——库生成的字体方案不含中文字形，中文走系统 CJK 栈，`Fira Code` 只用于编号/标准号/日期/金额等数据列。
- 走查与待办见 `docs/ui-audit-2026-11-03.md`（`docs/` 不在部署产物内）。
- **数字孪生**：`twin/` 为实验室三维图独立包（`future-lab`/`src`/`mock` 三目录同级，相对路径不可拆），入口 `twin/future-lab/tour-space-v3-1.html`，从 `testos.html` 应用卡片进入；数据契约与真实数据对接设计见 `docs/digital-twin-integration.md`。
