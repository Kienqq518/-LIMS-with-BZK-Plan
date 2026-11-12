# Handoff · LIMS-AI Review 第一期（M1）原型实现

> 交接给下一个模型，按 **Native / 内联执行** 把 M1 原型做出来。读完本文件后，直接从 Task 1 开始。

## 0. 一句话目标

在本**静态原型仓**里做出「报告流转到审核 → 自动 AI 审查 → 问题清单＋通过/不通过结论 → 审核员逐条处置 → 案例沉淀」的最小闭环，并预留通用/品类绑定、ML/LLM、历史案例结构。**纯前端原型，无后端、无构建步骤。**

## 1. 权威文档（必须先读）

| 文档 | 路径 | 作用 |
| --- | --- | --- |
| 需求设计（Spec，权威） | `docs/superpowers/specs/2026-11-11-lims-ai-review-m1-design.md` | 冲突时以它为准 |
| 实现 Plan（逐任务） | `docs/superpowers/plans/2026-11-11-lims-ai-review-m1.md` | 6 个任务、TDD 步骤、DOM/接口契约、测试断言 |
| 架构图（可交互） | Cursor Canvas「LIMS-AI Review · M1 架构层（第一期）」 | 分层蓝图 |

Plan 与 Spec **一起读**：Plan 是对 Spec 的论证，Plan 里拿不准的、冲突的，回到 Spec 判。

## 2. 执行方式：Native / 内联（已由产品负责人选定）

- 用 **`superpowers:executing-plans`** 技能逐任务自己实现：不派 per-task subagent、不派 per-task reviewer；**最后对整分支做一次全新上下文的 review**，再收尾。
- 执行时同时遵守 **`superpowers:test-driven-development`**（每步先写失败测试→看红→实现→看绿→提交）。
- 获取这些技能：`git clone --depth 1 https://github.com/obra/superpowers.git`，技能在 `skills/executing-plans/`、`skills/test-driven-development/`、`skills/writing-plans/`。若环境已有则直接读。
- **连续执行**：任务之间不要停下来问「要不要继续」，一口气做完 6 个任务。遇到 plan 与 spec 冲突/缺陷，自己裁决并在 ledger 记 `Ruling: <决定> — <理由> — <错了的代价>`，继续。
- 只有四类情况才停下来问人：不可逆/破坏性操作、涉安全操作、worktree 之外的副作用（合并/推共享分支/发布）、plan 彻底没法走。

## 3. 当前状态

- 分支：**`cursor/lims-ai-review-m1-design-bf8b`**（已在此分支，**继续用它，不要切换/新建**）。
- PR：**#6** `https://github.com/Kienqq518/-LIMS-with-BZK-Plan/pull/6`（push 到本分支会自动更新；PR 描述被人手改过，**不要覆盖**）。
- 已提交：Spec、Plan、本 Handoff、**M1 原型代码与 6 套 Playwright 回归**。
- Plan **Task 1 → Task 6 已全部完成**（见 §7 勾选）；交付见 PR #6。

## 4. Git / 提交规范

- 留在分支 `cursor/lims-ai-review-m1-design-bf8b`；**不要** push 到 `main`，**不要** amend/force-push。
- 每个任务按 Plan 里该任务 Step 5 的 commit 信息提交（一任务一（或多）提交）。
- 做完一个任务就 `git push`（会触发 PR 更新 / 可能触发 Vercel 构建）。
- 全部做完后，PR #6 即为交付；不要自行合并 PR。

## 5. 本仓硬约束（照抄，违反即返工）

- 新页面必须挂 `<link rel="stylesheet" href="css/ui-baseline.css">` + `<script src="js/ui-a11y.js" defer></script>`，并沿用现有 `js/tab-bar.js` 标签栏风格（参考任一现有页，如 `judgment-rules.html`）。
- localStorage 种子键 **`lims.aiReview.v1`**；**改种子必须升版本号**（`v2`…），否则浏览器里看不到变化。
- 不用构建工具：原生 JS（IIFE 挂 `window`，风格对齐 `js/venue-store.js`）、Tailwind CDN、font-awesome。
- Playwright 回归：套件放 `tests/ai-review/`，风格对齐 `tests/twin/`（`chromium.launch({channel:'chrome'})`、`_env.mjs` 给 `BASE`、`run-all.mjs` 顺序跑并汇总 ✅/❌）。本地静态服务端口用 **8097**（twin 占用 8099）。
- 跑测试：`node tests/ai-review/run-all.mjs`（可 `--only enginecheck` 单跑）。期望全 ✅、错误计数 0。

## 6. 不可动摇的产品决策（Spec 要点，务必在代码里体现）

- **责任边界**：页面可见「AI 只输出预审意见与问题清单，最终签发由授权签字人确认」；AI 结论**不自动改写报告状态**。
- **8 条规则**（全部 `is_universal=true`、`status='待审核员确认'`、确定性、无品类专属数值）：`A01-1 / A01-6 / A02-1 / B01-1 / B01-2 / B03-1 / C02-5 / C01-4`，口径见 Spec §8。
- **B01-1 只校验 `收样 ≤ 检测 ≤ 报告`，绝不读取任何抽样日期字段**；核心日期缺失则跳过 B01-1 并转 A 类完整性提示，不得报错。
- **结论聚合**：命中任一「严重」→ 不通过；否则命中「一般」→ 通过待确认；否则 → 通过。人工覆盖结论必须填理由、写入 `feedback`。
- **预留结构**：`categories`（6 条镜像）/`bindings`（空）两表、`is_universal`/`param_schema` 字段 M1 建好空跑；未配置品类绑定时产出 `CAT-UNCAT-01`（`提示`级，不影响结论、不占规则编号）。
- **历史案例库 `cases`**：审核员处置完成后 append 一条（报告快照＋AI结论＋逐条处置＋误报/漏报标注），M1 **只写不消费**。
- AI 只写自己的 `ai_review_*`（mock），不回写其它数据。

## 7. 任务清单（逐个过，细节在 Plan 里）

- [x] Task 1：`js/ai-review-store.js`（7 表种子 + API）+ 测试骨架（`_env.mjs`/`run-all.mjs`/`storecheck.mjs`/`_fixture.html`）
- [x] Task 2：`js/ai-review-engine.js`（8 规则 + 聚合 + CAT-UNCAT-01）+ `enginecheck.mjs`（Review Focus 五个易踩点全在此）
- [x] Task 3：`ai-review-workbench.html`（统览/筛选/逐条处置/案例沉淀 + 问题看板 + 统计）+ `workbenchcheck.mjs`
- [x] Task 4：`report-audit.html`（自动触发卡片 + 处置 + 案例）+ `report-list.html` 加入口 + `auditcheck.mjs`
- [x] Task 5：`ai-review-rules.html`（规则配置 + 预留绑定结构可视）+ `rulescheck.mjs`
- [x] Task 6：入口挂载（`index.html` 等）+ `navcheck.mjs` + 全量 6 套回归全绿

## 8. 收尾（Task 6 之后）

1. 对整分支做**一次全新上下文的 code review**（有 subagent 工具就派最强模型；没有就自己按 reviewer 清单过一遍，并在 ledger 注明是自审）。重点看 Plan 的 **Review Focus** 五项。
2. Critical/Important 当场修（每个修复先写失败测试→修→全套绿）；Minor 记入 ledger 延后。
3. 用 `superpowers:finishing-a-development-branch` 收尾。
4. 最终回报里列出：做了哪些 `Ruling:`、哪些延后的 Minor、全套测试结果、PR #6 链接。

## 8bis. 整分支 review 结论（2026-11-12）

全新上下文 reviewer 过完整分支 `e3b9664..HEAD`，Review Focus 五项全绿、34/34 测试通过。处置如下：

- **[已修 · Important]** 工作台总结论覆盖（`#override-conclusion`）此前可无理由翻盘且不留痕，违反「人工覆盖结论必须填理由并写入 feedback」。已改为：覆盖且与 AI 结论不同则强制填理由、否则拦截；`feedback`/`cases` 均落 `override_conclusion`+`override_reason`。新增 2 条 `workbenchcheck` 断言。
- **[已修 · 顺带]** 案例 `label` 原按「是否覆盖」自动推 `误报/正常`、audit 页恒为 `正常`，会污染案例库核心标注。两入口均改为显式 `误报/漏报/正常` 选择器，默认 `正常`。
- **[已修 · 清理]** 删除 `passesFilter` 中的空死分支。

延后（M2 跟进，非缺陷）：

- **Ruling（保留）**：各页加载即 `reset()`（Plan 明确的原型演示幂等），导致跨页导航不累积 `feedback/cases`。M2 可改为仅在 store 缺失/版本不符时 reset，让沉淀跨页存活。
- **校准项**：`A01-1`/`A01-6`/`B01-1` 的正则与字典序日期比较为确定性占位口径（仅适配 ISO 种子；如 `ASTM D638-14` 两位年号会被 `A01-6` 命中）。规则 `status='待审核员确认'`，Week-1 校准时复核。

## 8ter. 报告审核模块重构（2026-11-12，产品迭代）

旧 `report-audit.html`（单报告内嵌 AI 卡片）被推翻，改为「报告审核」标准两页式，AI 结论复用同一引擎：

- `report-review.html`：报告审核主查询页（筛选 + 列表），操作列由「编辑」改为「审核」。
- `report-review-detail.html`：按委托打开，页内每份报告下方一块 AI 审查结果区（通过 / 需复核 / 不通过）：
  - 通过：列通过规则项，默认折叠，点展开看详情；
  - 需复核：命中「一般」项默认展开详情；
  - 不通过：命中「严重」项 → AI 自动回退「报告编制」，无人工处置区。
  - 人工处置两路：通过→同意执行通过 / 不同意仍执行通过；需复核→同意退回编制 / 不同意直接人工通过。退回路径旁「退回原因」**默认按 AI 命中项预填、可改**（设计结论）。
  - 逐条「标注」（正常/误报/漏报）仅用于 AI 学习，页首明示不对上下游展示；写入 `feedback` + `cases`。
- `report-list.html`：顶部新增「AI 审核不通过自动退回」横幅（与审核页同源 `js/report-review-mock.js`）。
- 基座 `js/report-review-mock.js`：委托→多报告，`evalReport()` 复用 `ai-review-engine`，三态结论对外统一。
- 回归：`auditcheck.mjs` 改测新两页 + 编制页横幅；全套 37/37 绿。AI 审核工作台（`ai-review-workbench.html`）留待后续重构。

## 9. 验收对照（Spec §10）

自动触发(Task4) · 两入口(Task3+4) · 逐条处置/人工覆盖写 feedback(Task3/4) · 案例沉淀 cases(Task3/4) · 8 规则可运行且 B01-1 五业务类型零误报(Task2) · 7 表/品类两表空跑/cases 只写/CAT-UNCAT-01(Task1/2/5) · 规则确定性且 is_universal 全真(Task1/5)。
