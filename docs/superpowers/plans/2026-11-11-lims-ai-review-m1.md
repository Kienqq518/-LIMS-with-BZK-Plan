# LIMS-AI Review 第一期（M1）原型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在本静态原型仓内跑通「报告流转到审核 → 自动 AI 审查 → 问题清单＋通过/不通过结论 → 审核员逐条处置 → 案例沉淀」的最小闭环，并预留通用/品类绑定与 ML/LLM/历史案例结构。

**Architecture:** 纯前端原型（HTML + 原生 JS + Tailwind CDN），无构建步骤。新增一个 localStorage 种子 Store（7 张表的 mock）、一个纯函数规则引擎（8 条确定性通用规则）、一个独立「审核工作台」页、一个「报告审核」页（内嵌 AI 结果卡片、模拟自动触发）、一个「规则配置」页。回归用 Playwright 独立套件（仿 `tests/twin`）。

**Tech Stack:** HTML5 / 原生 ES5-风格 JS（IIFE 挂 `window`，与现有 `js/*-store.js` 一致）/ Tailwind CDN / font-awesome / Playwright（chromium channel chrome）。

**Spec:** `docs/superpowers/specs/2026-11-11-lims-ai-review-m1-design.md`（执行者需同时阅读）

## Global Constraints

- 新页面必须挂 `<link rel="stylesheet" href="css/ui-baseline.css">` + `<script src="js/ui-a11y.js" defer></script>`。
- localStorage 种子键为 `lims.aiReview.v1`；**改种子必须升版本号**（`v2`、`v3`…）。
- AI 只写自己的 `ai_review_*`（mock 表），**不回写** LIMS 其它数据。
- 8 条规则全部确定性，判定式内**不得出现品类专属数值**；规则 `is_universal` 全为 `true`，`status` 默认 `待审核员确认`。
- **B01-1 只校验 `receive_date ≤ test_date ≤ report_date`，不读取任何抽样日期字段。**
- 品类绑定表（`categories` 镜像 / `bindings`）M1 建好但 `bindings` 为空（空跑）；未配置品类绑定时产出提示 `CAT-UNCAT-01`（`提示`级，不影响通过/不通过）。
- AI 结论不自动改写报告状态；审核员人工覆盖结论必须填理由并写入 `feedback`。
- 责任边界文案在审核页/工作台可见：「AI 只输出预审意见与问题清单，最终签发由授权签字人确认」。

## Review Focus

- **核心日期缺失**（`receive_date`/`test_date`/`report_date` 任一为空）：B01-1 不得抛错或误判为先后违规，应跳过 B01-1 并由 A 类完整性产出「缺核心日期」提示。→ 测试在 Task 2。
- **未配置品类 / `category_code` 为 null**：引擎仍跑完 8 条通用规则，并附 `CAT-UNCAT-01` 提示、不阻断。→ 测试在 Task 2。
- **日期相等边界**（`receive_date == test_date == report_date`）：按 `≤` 判为通过，不判违规。→ 测试在 Task 2。
- **`entrust_items` 为空**：A02-1 判为通过（无委托项即无遗漏），不抛错。→ 测试在 Task 2。
- **标准号无年号**（如 `GB/T 1231`）：A01-6 判为命中（缺年号），`严重`。→ 测试在 Task 2。

---

## 共享数据形状（各任务引用，不在任务内重复）

**规则对象** `Rule`：`{ id, group, category('A'|'B'|'C'), name, expr, severity('严重'|'一般'), is_universal:true, param_schema:{}, enabled:true, status:'待审核员确认' }`。8 条：`A01-1 / A01-6 / A02-1 / B01-1 / B01-2 / B03-1 / C02-5 / C01-4`（口径见 spec §8）。

**报告对象** `Report`（mock 输入）：
`{ id, report_no, biz_type('型式试验'|'出厂试验'|'例行试验'|'委托检验'|'抽样检验'), category_code(string|null), category_name, sample_no, test_standard, cited_standard, entrust_items:string[], result_params:string[], receive_date, test_date, report_date, device_calib_from, device_calib_to, signatures:{tester,reviewer,approver}, units:[{param,unit}] }`。

**引擎结果** `ReviewResult`：
`{ report_id, conclusion('通过'|'通过待确认'|'不通过'), issues:Issue[], notices:Notice[], summary:{total,failed,by_severity:{严重,一般}} }`
`Issue = { rule_id, group, category, severity, passed:false, message, evidence }`
`Notice = { code:'CAT-UNCAT-01', severity:'提示', message }`

**案例对象** `Case`（append-only）：`{ case_id, report_id, report_snapshot, biz_type, ai_conclusion, ai_issues, dispositions:[{rule_id, action('接受'|'覆盖'), reason}], final_conclusion, label('误报'|'漏报'|'正常'|null), created_at }`。

**文件职责**
- `js/ai-review-store.js`：种子 7 张表 + 读写 API（`window.AiReviewStore`）。
- `js/ai-review-engine.js`：纯函数引擎（`window.AiReviewEngine`）。
- `ai-review-workbench.html`：审核工作台（列表/筛选/详情/处置/统计/问题看板）。
- `report-audit.html`：报告审核页（内嵌 AI 卡片 + 模拟自动触发 + 处置 + 案例沉淀）。
- `ai-review-rules.html`：规则配置 + 预留绑定结构可视。
- `tests/ai-review/`：Playwright 套件 + `_env.mjs` + `run-all.mjs`。

---

## Task 1: Store 种子与读写 API + 测试骨架

**Files:**
- Create: `js/ai-review-store.js`
- Create: `tests/ai-review/_env.mjs`
- Create: `tests/ai-review/run-all.mjs`
- Create: `tests/ai-review/storecheck.mjs`
- Create: `tests/ai-review/_fixture.html`（最小页面：仅 `<script src=...ai-review-store.js>`，供测试 `page.evaluate` 读取 `window.AiReviewStore`；挂 UI 基线非必需，但保持与仓一致）

**Interfaces:**
- Produces（`window.AiReviewStore`）：
  - `reset() -> void`（写入全部默认种子，设置键 `lims.aiReview.v1`）
  - `getRules() -> Rule[]`（8 条）、`setRuleEnabled(id, bool)`
  - `getCategories() -> {category_code,category_name,enabled,is_bound}[]`（6 条镜像，`is_bound=false`）
  - `getBindings() -> []`（空）
  - `getReports() -> Report[]`（见下，含 5 种 biz_type）
  - `getResults()/saveResult(ReviewResult)`、`getIssues()`、`getFeedback()/saveFeedback(obj)`
  - `getCases()/appendCase(Case)`（append-only）

- [ ] **Step 1: 写失败测试 `tests/ai-review/storecheck.mjs`**

套件打开 `_fixture.html`，`await page.evaluate(() => { window.AiReviewStore.reset(); return {...} })` 取出各表计数，断言（✅/❌ 行，console.log）：
- `rules.length === 8` 且 id 集合 == `['A01-1','A01-6','A02-1','B01-1','B01-2','B03-1','C02-5','C01-4']`，全部 `is_universal===true`、`status==='待审核员确认'`
- `categories.length === 6` 且全部 `is_bound===false`
- `bindings.length === 0`
- `reports` 覆盖 5 种 `biz_type`（去重后等于 5 种），且至少含 1 条 `category_code===null`
- `localStorage` 存在键 `lims.aiReview.v1`

- [ ] **Step 2: 建 `_env.mjs` 与 `run-all.mjs`，运行测试确认失败**

`_env.mjs` 导出 `BASE`（默认 `http://127.0.0.1:8097`，env `AIR_BASE` 覆盖）、`SHOT_DIR`（`/tmp/air-qa`，`mkdirSync` recursive）。`run-all.mjs` 仿 `tests/twin/run-all.mjs`：若端口 8097 未监听则 `spawn` 一个静态服务（`npx serve`/`python3 -m http.server 8097` 二选一，根目录为仓根），`SUITES=[['storecheck','种子 7 表与版本键']]`，顺序跑、汇总。
Run: `node tests/ai-review/run-all.mjs --only storecheck`
Expected: FAIL（`window.AiReviewStore` undefined）

- [ ] **Step 3: 实现 `js/ai-review-store.js`**

IIFE 挂 `window.AiReviewStore`，结构仿 `js/venue-store.js`：`STORAGE_KEY='lims.aiReview.v1'`、`DEFAULT = {rules, categories, bindings, reports, results:[], issues:[], feedback:[], cases:[]}`、`readJson/writeJson/clone`。默认种子：
- 8 条 `Rule`（字段见共享形状、口径见 spec §8）。
- 6 条 `categories`：电力电缆 / 高强度螺栓连接副 / 绝缘手套 / 电缆保护管 / 安全带 / 导线金具（`is_bound=false`）。
- `bindings: []`。
- `reports`：≥6 条，覆盖 5 种 `biz_type`；其中若干条**干净**（全通过），若干条**各自注入一类问题**（空/非法 `sample_no`、`test_standard` 无年号、`entrust_items` 有项不在 `result_params`、`report_date < test_date`、`device_calib_to < test_date`、`cited_standard != test_standard`、缺 `signatures.approver`、`units` 某项单位非法）；至少 1 条 `category_code=null`。
- API 按 Interfaces 实现；`saveResult/saveFeedback/appendCase` 为追加写。

- [ ] **Step 4: 运行测试确认通过**

Run: `node tests/ai-review/run-all.mjs --only storecheck`
Expected: PASS（全 ✅）

- [ ] **Step 5: Commit**

```bash
git add js/ai-review-store.js tests/ai-review/_env.mjs tests/ai-review/run-all.mjs tests/ai-review/storecheck.mjs tests/ai-review/_fixture.html
git commit -m "feat(ai-review): M1 mock store 种子与读写 API + 测试骨架"
```

---

## Task 2: 规则引擎（8 条规则 + 聚合 + CAT-UNCAT-01）

**Files:**
- Create: `js/ai-review-engine.js`
- Create: `tests/ai-review/enginecheck.mjs`
- Modify: `tests/ai-review/_fixture.html`（追加 `<script src="../../js/ai-review-engine.js">`，使 `window.AiReviewEngine` 可用）
- Modify: `tests/ai-review/run-all.mjs`（SUITES 追加 `['enginecheck', ...]`）

**Interfaces:**
- Consumes: `AiReviewStore.getRules()/getCategories()/getBindings()`（Task 1）
- Produces（`window.AiReviewEngine`）：
  - `run(report:Report, rules:Rule[], categories, bindings) -> ReviewResult`
  - `evalRule(ruleId:string, report:Report) -> {passed:boolean, message:string, evidence:any}`（单条判据）

- [ ] **Step 1: 写失败测试 `tests/ai-review/enginecheck.mjs`**

打开 `_fixture.html`，`page.evaluate` 调 `AiReviewEngine`。断言（Review Focus 全部在此）：
- 干净报告 → `conclusion==='通过'`、`issues.length===0`
- 注入「缺 approver 签名」报告 → 命中 `C02-5`（`严重`）→ `conclusion==='不通过'`
- 注入「`cited_standard!=test_standard`」(一般) 且无严重命中 → `conclusion==='通过待确认'`
- **B01-1 五类业务**：对 5 种 `biz_type` 各造 1 条 `receive≤test≤report` 的报告 → 全部 `evalRule('B01-1',r).passed===true`（证明不依赖抽样日期）
- **日期相等边界**：`receive==test==report` → `B01-1` passed
- **核心日期缺失**：`test_date=''` → `evalRule('B01-1')` 不抛错且 `passed===true`（跳过），另有 A 类完整性提示（`notices` 含缺日期提示或对应 issue）
- **空 `entrust_items`** → `A02-1` passed
- **标准号无年号** `GB/T 1231` → `A01-6` 命中、`severity==='严重'`
- **未配置品类**（`category_code=null` 或无 enabled binding）→ `notices` 含 `{code:'CAT-UNCAT-01', severity:'提示'}`，且 `conclusion` 不因该提示变为不通过

Run: `node tests/ai-review/run-all.mjs --only enginecheck` → Expected: FAIL（`AiReviewEngine` undefined）

- [ ] **Step 2: 运行确认失败**（同上命令，确认 ❌）

- [ ] **Step 3: 实现 `js/ai-review-engine.js`**

IIFE 挂 `window.AiReviewEngine`。`evalRule(id, r)` 对每条规则实现确定性判据：
- `A01-1`：`r.sample_no` 非空且匹配编号正则 `/^[A-Za-z]{1,6}\d{4}-\d{2,}$/`
- `A01-6`：`r.test_standard` 以 `-YYYY` 结尾（`/-\d{4}$/`）
- `A02-1`：`r.entrust_items` 每项 ∈ `r.result_params`（空数组视为通过）
- `B01-1`：仅当三日期都存在时校验 `receive_date <= test_date <= report_date`（字符串 ISO 可直接比较）；任一缺失 → `passed:true` 且 `evidence.skipped='缺核心日期'`
- `B01-2`：`calib_from <= test_date <= calib_to`
- `B03-1`：`r.cited_standard === r.test_standard`
- `C02-5`：`signatures.tester && reviewer && approver` 均非空
- `C01-4`：每个 `units[].unit` ∈ 允许集合 `['MPa','kN','HRC','μm','kV','mA','mm','%','N·m','Ω']` 且非空
`run()`：对 `rules` 中 `enabled` 的逐条 `evalRule`，收集未通过为 `issues`（带 severity）；聚合 `conclusion`：有 `严重` 未过→`不通过`；否则有 `一般` 未过→`通过待确认`；否则→`通过`。核心日期缺失额外产出一条 A 类 `提示`（进 `notices` 或 issue，`提示`级不影响结论）。品类：查 `bindings` 是否有该 `category_code` 的 enabled 行，无（M1 恒无）→ 追加 `CAT-UNCAT-01` 到 `notices`。

- [ ] **Step 4: 运行确认通过**

Run: `node tests/ai-review/run-all.mjs --only enginecheck` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/ai-review-engine.js tests/ai-review/enginecheck.mjs tests/ai-review/_fixture.html tests/ai-review/run-all.mjs
git commit -m "feat(ai-review): 8 条确定性规则引擎 + 结论聚合 + CAT-UNCAT-01"
```

---

## Task 3: 审核工作台页（统览 / 筛选 / 详情 / 处置 / 案例沉淀）

**Files:**
- Create: `ai-review-workbench.html`
- Create: `tests/ai-review/workbenchcheck.mjs`
- Modify: `tests/ai-review/run-all.mjs`（SUITES 追加）

**Interfaces:**
- Consumes: `AiReviewStore`（Task 1）、`AiReviewEngine.run`（Task 2）
- Produces（页面 DOM 契约，供测试与其它页复用约定）：
  - 顶部责任边界条 `#ai-liability`
  - 「全部跑一遍」按钮 `#btn-run-all`（对所有 `reports` 跑 `run()` 并 `saveResult`）
  - 结果表 `#result-table`，行 `tr[data-report-id]`，列含 结论徽标 `.concl`、命中数 `.hit-count`、业务类型、品类（未配置显示 `未配置品类` + CAT-UNCAT-01 角标）
  - 筛选 `#filter-conclusion`（全部/通过/通过待确认/不通过）、`#filter-severity`
  - 点击行打开详情面板 `#detail-panel`：问题清单 `#issue-list`（每条 `.issue[data-rule-id]` 带 `接受`/`覆盖` 按钮与覆盖理由输入 `.override-reason`）、总结论覆盖 `#override-conclusion`、`#btn-settle`（完成处置→写 `feedback` + `appendCase`）
  - 次级标签：`#tab-board`（问题看板：按规则/严重度聚合计数）、`#tab-stats`（统计：通过率、各结论计数）

- [ ] **Step 1: 写失败测试 `tests/ai-review/workbenchcheck.mjs`**

打开 `/ai-review-workbench.html`，断言：
- 存在 `#ai-liability` 且文本含「授权签字人」
- 点 `#btn-run-all` 后 `#result-table tr[data-report-id]` 行数 == reports 数；存在至少一行 `.concl` 文本为 `不通过`
- `#filter-conclusion` 选 `不通过` 后，可见行的 `.concl` 全为 `不通过`
- 点一行不通过 → `#detail-panel` 显示、`#issue-list .issue` 数 == 该报告命中数
- 在一条 `.issue` 填 `.override-reason` 点覆盖 → 点 `#btn-settle` → `AiReviewStore.getFeedback()` 新增该记录、`getCases()` 新增 1 条（`dispositions` 含该覆盖、`label`/`final_conclusion` 已写）
- `#tab-stats` 显示的通过率 == 通过行数/总行数
- 控制台无 pageerror

Run: `node tests/ai-review/run-all.mjs --only workbenchcheck` → Expected: FAIL（页面 404）

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `ai-review-workbench.html`**

仿现有页（tab-bar、`css/ui-baseline.css`、`js/ui-a11y.js`、Tailwind CDN）。引 `js/ai-review-store.js` + `js/ai-review-engine.js`。实现上述 DOM 契约与交互：加载即 `AiReviewStore.reset()`（原型演示幂等）→ 渲染；`#btn-run-all` 跑全量并存结果；筛选过滤行；详情面板逐条处置；`#btn-settle` 组装 `Case` 调 `appendCase` + `saveFeedback`；`#tab-board`/`#tab-stats` 聚合展示。

- [ ] **Step 4: 运行确认通过**

Run: `node tests/ai-review/run-all.mjs --only workbenchcheck` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ai-review-workbench.html tests/ai-review/workbenchcheck.mjs tests/ai-review/run-all.mjs
git commit -m "feat(ai-review): 审核工作台（统览/筛选/逐条处置/案例沉淀）"
```

---

## Task 4: 报告审核页（内嵌 AI 卡片 + 模拟自动触发 + 处置 + 案例）

**Files:**
- Create: `report-audit.html`
- Modify: `report-list.html`（在报告记录「审核」节点加入口链接到 `report-audit.html?report=<id>`；最小改动，仅加链接）
- Create: `tests/ai-review/auditcheck.mjs`
- Modify: `tests/ai-review/run-all.mjs`（SUITES 追加）

**Interfaces:**
- Consumes: `AiReviewStore`、`AiReviewEngine.run`
- Produces（DOM 契约）：
  - 页面 `report-audit.html?report=<id>`，加载即**自动触发**（模拟「流转到审核」）：对该报告 `run()` 并渲染卡片，无需点按
  - AI 结果卡片 `#ai-card`：总结论 `#ai-conclusion`、问题清单 `#ai-issues .issue[data-rule-id]`、提示区含 `CAT-UNCAT-01`（若有）
  - 审核员区：逐条 `接受`/`覆盖`+理由、`#btn-audit-settle`（写 `feedback` + `appendCase`）
  - 责任边界条 `#ai-liability`

- [ ] **Step 1: 写失败测试 `tests/ai-review/auditcheck.mjs`**

- 打开 `/report-audit.html?report=<一个注入严重问题的 report id>`，**不点任何按钮**，断言 `#ai-card` 可见、`#ai-conclusion` 文本为 `不通过`、`#ai-issues .issue` 数 == 命中数（证明自动触发）
- 打开一个 `category_code=null` 的报告 → 卡片提示区含 `CAT-UNCAT-01`
- 逐条处置 + `#btn-audit-settle` → `getCases()` 新增 1 条且 `report_id` 匹配
- `report-list.html` 存在指向 `report-audit.html` 的链接（`a[href*="report-audit.html"]` count ≥ 1）
- 无 pageerror

Run: `node tests/ai-review/run-all.mjs --only auditcheck` → Expected: FAIL

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `report-audit.html` 并在 `report-list.html` 加入口**

`report-audit.html`：读 URL `report` 参数 → 加载报告 → `onload` 即 `AiReviewEngine.run` 渲染 `#ai-card`（这步即「自动触发」的原型表达）→ 审核员逐条处置 → `#btn-audit-settle` 写 `feedback`+`appendCase`。挂 UI 基线。`report-list.html`：在报告记录行/详情的「审核」处新增一个链接 `审核(AI)` 指向 `report-audit.html?report=<id>`（不改其它逻辑）。

- [ ] **Step 4: 运行确认通过**

Run: `node tests/ai-review/run-all.mjs --only auditcheck` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add report-audit.html report-list.html tests/ai-review/auditcheck.mjs tests/ai-review/run-all.mjs
git commit -m "feat(ai-review): 报告审核页内嵌 AI 卡片+自动触发+处置+案例沉淀"
```

---

## Task 5: 规则配置页 + 预留绑定结构可视

**Files:**
- Create: `ai-review-rules.html`
- Create: `tests/ai-review/rulescheck.mjs`
- Modify: `tests/ai-review/run-all.mjs`（SUITES 追加）

**Interfaces:**
- Consumes: `AiReviewStore.getRules()/setRuleEnabled()/getCategories()/getBindings()`、`AiReviewEngine`
- Produces（DOM 契约）：
  - 规则表 `#rule-table`，8 行 `tr[data-rule-id]`，列：编号 / 维度(A/B/C) / 判定式 / 严重度 / `是否通用`(全 通用) / 启用开关 `.rule-enabled`
  - 预留结构区 `#binding-section`：品类镜像表 `#cat-table`（6 行）、绑定表 `#binding-table`（0 行，空态文案「M1 未配置品类专属规则，默认只跑通用集，输出 CAT-UNCAT-01」）

- [ ] **Step 1: 写失败测试 `tests/ai-review/rulescheck.mjs`**

- `#rule-table tr[data-rule-id]` 行数 == 8，`是否通用` 列全部为 `通用`
- `#cat-table` 6 行、`#binding-table` 0 行且空态文案含 `CAT-UNCAT-01`
- 关闭某条规则的 `.rule-enabled` → `AiReviewStore.getRules()` 该条 `enabled===false`，且随后 `AiReviewEngine.run` 不再产出该规则的 issue
- 无 pageerror

Run: `node tests/ai-review/run-all.mjs --only rulescheck` → Expected: FAIL

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `ai-review-rules.html`**

仿现有页（含 UI 基线、tab-bar）。渲染 8 条规则表 + 启用开关（调 `setRuleEnabled`）；渲染品类镜像与空绑定表及空态文案。

- [ ] **Step 4: 运行确认通过**

Run: `node tests/ai-review/run-all.mjs --only rulescheck` → Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ai-review-rules.html tests/ai-review/rulescheck.mjs tests/ai-review/run-all.mjs
git commit -m "feat(ai-review): 规则配置页 + 预留品类绑定结构可视"
```

---

## Task 6: 入口挂载 + 全量回归

**Files:**
- Modify: `index.html`（或 `dashboard.html`/`testos.html` 应用入口，择一）：新增「AI 审查工作台」入口链接到 `ai-review-workbench.html`
- Modify: `tests/ai-review/run-all.mjs`（确认 SUITES 为全部 6 套；`--only` 省略时顺序全跑）
- Create: `tests/ai-review/navcheck.mjs`

**Interfaces:**
- Consumes: 以上全部

- [ ] **Step 1: 写失败测试 `tests/ai-review/navcheck.mjs`**

打开承载入口的页面（如 `/index.html`），断言存在 `a[href*="ai-review-workbench.html"]` 且可见；无 pageerror。

Run: `node tests/ai-review/run-all.mjs --only navcheck` → Expected: FAIL

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 在入口页加链接**（最小改动，仅加一个可达入口）

- [ ] **Step 4: 全量回归通过**

Run: `node tests/ai-review/run-all.mjs`
Expected: 6 套（storecheck / enginecheck / workbenchcheck / auditcheck / rulescheck / navcheck）全 ✅，错误计数为 0

- [ ] **Step 5: Commit**

```bash
git add index.html tests/ai-review/navcheck.mjs tests/ai-review/run-all.mjs
git commit -m "feat(ai-review): 挂载工作台入口 + 全量回归通过"
```

---

## 验收对照（spec §10）
- 自动触发：Task 4 `auditcheck`（加载即出卡片，不点按）。
- 两入口：工作台（Task 3）+ 报告审核节点卡片（Task 4）。
- 逐条处置 + 人工覆盖写 `feedback`：Task 3 / Task 4。
- 案例沉淀 `ai_review_cases`：Task 3 / Task 4（`appendCase`）。
- 8 条可运行、B01-1 无抽样且五业务类型零误报：Task 2 `enginecheck`。
- 7 张表、品类两表空跑、`cases` 只写、CAT-UNCAT-01：Task 1 + Task 2 + Task 5。
- 规则确定性、`is_universal` 全真、状态默认待确认：Task 1 + Task 5。
