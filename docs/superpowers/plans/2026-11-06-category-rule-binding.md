# 品类规则绑定 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把"规则 × 品类"的绑定模型落进飞书文档与规则台账：新增 3.9 章节、两张 Base 表、schema 变更，并把 3.2.1 里的品类数值移入绑定表。

**Architecture:** 规则本体（45 条）与品类绑定分离。本体只写判据与 `param_schema`，品类差异（启用与否、参数、依据、严重度覆盖）全部落在 `category_bindings`。运行时按 LIMS 分类编码解析规则集，未配置品类只跑通用集 28 条并输出可见提示。文档侧沿用既有校验脚手架，把"改对了没有"继续做成可跑断言。

**Tech Stack:** `lark-cli`（docs / base）、Python 3（校验器与种子生成）、`@larksuite/whiteboard-cli`（时间轴重渲染）。

**Spec:** `docs/superpowers/specs/2026-11-06-category-rule-binding-design.md`

## Global Constraints

- 文档 token `NmYVdjPO9oswaoxyHsDcQNu2nKh`；台账 Base `B2WHb25XVaCPinskfxKcr0J0npt`；`审核规则` 表 `tblwz7D6MQVvm3Da`。一律 `--as user`。
- **计数固定：通用集 28 ｜ 品类专属 17 ｜ 本体 45**。任何位置出现这三个数必须与此一致；新增品类专属规则只计入 17 一侧。
- **A03-4 属品类专属**，其可追溯载体由 `traceability_field: enum(heat_no | reel_no | batch_no | segment_no)` 按品类指定。
- 本体判据内**不得出现裸品类数值**；具体取值只允许出现在 3.9 绑定矩阵，或 3.2.1 中标注「示例」的位置。
- `CAT-UNCAT-01` 是引擎内置提示，不占规则编号，不计入 45 / ≥50。
- 绑定表**不得引用本体不存在的 rule_id**；每个已配置品类必须对全部 17 条专属规则各写一行（`enabled` 显式 true/false），通用 28 条不写绑定。
- Base 绑定表用 **text 字段**存 `category_code` 与 `rule_id`，不用 `link` 类型（避免双向关联维护成本；权威外键关系在 3.4 的 DB schema 里）。
- 所有新增参数值 `状态=待审核员确认`。
- 沿用既有文档铁律：rowspan 续行省略被合并格；单元格实体只转义一次；新增画板用 `<whiteboard type="svg" path="@x.svg">` 一步建；`block_replace` 后旧 block ID 失效需重新 fetch。
- **每任务统一收尾（Commit 步骤即执行此块）**：

```bash
git add -A && git commit -m "docs(lims-ai-review): <本任务改动>"
git fetch && git rebase origin/main && git push origin HEAD:main
```

## Review Focus

1. **计数漂移**——30 / 15 / 45 在 3.2.1、3.9、附录 B、Base 记录数四处不一致。期望：四处一致，脚本可校验。
2. **裸品类数值残留**——3.2.1 仍写"每批 8 套""6 个月"却没标「示例」，与"本体不含品类数值"直接矛盾。
3. **绑定表造出幽灵规则**——`rule_id` 指向本体不存在的编号，或某品类漏写若干专属规则行。
4. **未配置品类静默通过**——默认策略落地成"什么都不说"，审核员误以为审过了。
5. **LIMS 分类粒度不匹配无兜底**——只有精确码匹配，没有 `lims_parent_code` 前缀匹配或映射表路径。

---

## Task 1: 校验器扩展（labeled / section 模式）

**Files:**
- Modify: `docs/feishu/lims-ai-review/check_doc.py`
- Modify: `docs/feishu/lims-ai-review/checks.tsv`

**Interfaces:**
- Produces: `labeled` 模式，行格式 `case<TAB>labeled<TAB>pattern<TAB>marker<TAB>section_prefix`。语义：取 `section_prefix` 起始到下一个同级或更高标题之间的文本，`pattern` 的**每次出现**都必须在向前 40 字符内找到 `marker`，否则 FAIL。
- Produces: `countcheck` 模式，行格式 `case<TAB>countcheck<TAB>section_prefix<TAB>expected_rows`，用于校验 Base/表格行数与预期一致。
- Consumes: 既有 `forbid` / `require` / `tablecheck`。

- [ ] **Step 1: 实现两个新模式**

`labeled` 需要一个 section 切分函数：按 `<h1|h2|h3>` 边界切全文，取 `startswith(section_prefix)` 的那段。`countcheck` 调 `lark-cli base +record-list` 数行。

- [ ] **Step 2: 加本迭代断言（先红）**

```
a03-8sets-labeled	labeled	8 套	示例	3.2.1
b01-6month-labeled	labeled	6 个月	示例	3.2.1
s39-exists	require	3\.9 品类规则绑定
count-bindings	countcheck	品类规则绑定	51
```

- [ ] **Step 3: 跑断言确认红灯来自预期原因**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case a03-8sets-labeled`
Expected: FAIL，且报错指出"8 套"出现在未标注处（不是脚本异常）

- [ ] **Step 4: Commit**

## Task 2: Base 两张新表 + 规则表加两列

**Files:**
- Create: `docs/feishu/lims-ai-review/make_category_tables.py`
- Create: `docs/feishu/lims-ai-review/binding_seed.json`
- Modify: `docs/feishu/lims-ai-review/base.md`

**Interfaces:**
- Produces: `CAT_TABLE_ID`、`BIND_TABLE_ID`，写入 `base.md`；T10 Step 3 的绑定完整性校验读取。
- Produces: 品类 6 行、绑定 **51 行**（3 品类 × 17 专属规则）。

- [ ] **Step 1: 读字段规范**

Run: `lark-cli skills read lark-base/references/lark-base-field-json.md`
Expected: 拿到 select / number 字段合法 JSON 形状

- [ ] **Step 2: 建「品类」表（6 行）**

`+table-create --name 品类 --fields` 字段：`category_code(text)`、`品类名称(text)`、`来源(select: LIMS)`、`父级编码(text)`、`是否已配绑定(select: 是|否)`、`同步时间(text)`、`备注(text)`。
6 行：高强度螺栓连接副、绝缘手套、电力电缆（这三行 `是否已配绑定=是`）；电缆保护管、安全带、导线/金具（`否`）。

- [ ] **Step 3: 建「品类规则绑定」表（45 行）**

字段：`category_code(text)`、`rule_id(text)`、`启用(select: 是|否)`、`参数覆盖(text)`、`严重度覆盖(select: 严重|一般|轻微|提示|不覆盖)`、`标准依据(text)`、`状态(select，默认 待审核员确认)`、`版本(text)`。
生成规则：对 3 个已配置品类，各为 17 条专属规则（A02-5、A03-2/3/4/5/6、B01-3、B02-1…9、C01-2）生成一行，`启用` 按 spec 的绑定矩阵取值，未覆盖处填 `否` + 依据留空。
Run: `+record-batch-create` → `+record-list` 计数 **51**

- [ ] **Step 4: 规则表加两列**

`+field-create` 到 `tblwz7D6MQVvm3Da`：`param_schema(text)`、`是否通用(select: 通用|品类专属)`。
`+record-batch-update` 回填：28 条标 `通用`，17 条标 `品类专属`（含 A02-5、A03-4、C01-2）。

- [ ] **Step 5: 建视图**

`+view-create` 两个：`按品类看启用`（group category_code）、`未配置品类`（filter 品类表 是否已配绑定=否）。

- [ ] **Step 6: 计数断言转绿 + Commit**

## Task 3: 新增 3.9 品类规则绑定章节

**Files:**
- Modify: 文档 3.8 之后插入 `3.9`
- Modify: `checks.tsv`

**Interfaces:**
- Produces: 3.9 内的绑定矩阵表（列：品类 / 启用 / 停用 / 关键参数覆盖），T4 的 `labeled` 断言以它为数值的唯一归属地。

- [ ] **Step 1: 写 3.9**

按 spec 落六段：① 为什么绑定（A03 那格的实例）；② 三张表数据模型（含 `param_schema`、`is_universal`、`traceability_field`）；③ 通用 28 / 专属 17 划分清单；④ 运行时解析四步 + `CAT-UNCAT-01`；⑤ 首批 3 品类绑定矩阵（数值集中在此）；⑥ 未配置品类的默认策略与残余风险。

- [ ] **Step 2: 加断言**

`require 通用集 28`、`require 品类专属 17`、`require CAT-UNCAT-01`、`require traceability_field`

- [ ] **Step 3: outline 校验层级不跳级 + Commit**

## Task 4: 3.2.1 判据去品类化

**Files:**
- Modify: 3.2.1 表 A03、B02、B01 三个单元格组
- Modify: 3.2.1 表前导语段

- [ ] **Step 1: 改写判据**

A03-2 → `平行试样 / 重复测定组数满足该品类标准规定（取值见 3.9 绑定矩阵，示例：螺栓连接副每批 8 套）`
A03-4 → `可追溯编号与取样部位记录完整，载体按品类为炉（批）号 / 盘号 / 制造批号 / 段号（见 3.9）`
B01-3 → `安全工器具上次预防性试验未超期，周期按品类取（示例：绝缘手套 6 个月；取值见 3.9）`
B02-3 → `扭矩系数平均值与标准偏差满足所引标准（示例：GB/T 1231 的 0.110–0.150 与 ≤ 0.0074）`
A02-5 → `对温湿度敏感的试验项目须记录环境温湿度，敏感项目清单按品类取（示例：拉伸、扭矩系数、工频耐压；取值见 3.9）`
C01-2 → `数值修约间隔与所引标准一致（示例：抗拉强度 1 MPa、扭矩系数 3 位小数；取值见 3.9）`

- [ ] **Step 2: 导语段补划分**

加一句：`45 条中 28 条为通用集（任何品类都跑），17 条为品类专属（须由 3.9 绑定启用；未启用不参与判定）。`

- [ ] **Step 3: labeled 断言转绿**

Run: `check_doc.py --case a03-8sets-labeled && --case b01-6month-labeled`
Expected: 均 exit 0

- [ ] **Step 4: tablecheck 复查 + Commit**

## Task 5: 3.4 schema 补齐与 3.8 变更控制延伸

**Files:**
- Modify: 3.4 表清单（新增两张表的字段行）、`ai_review_rules` 字段行
- Modify: 3.8 流程段

- [ ] **Step 1: 规则表加两字段行**

`param_schema JSONB`（声明可覆盖参数）、`is_universal BOOLEAN`（是否属通用集）

- [ ] **Step 2: 新增两张表的字段块**

`ai_review_categories`：category_code PK / category_name / source / lims_parent_code / sync_time / enabled
`ai_review_category_bindings`：binding_id PK / category_code FK / rule_id FK / enabled / overrides JSONB / severity_override / standard_ref / version / effective_from / effective_to / approved_by / change_ticket + 唯一约束 `(category_code, rule_id, version)`

- [ ] **Step 3: 3.8 补绑定变更控制**

写明绑定与参数覆盖的变更走同一套五步流程，并新增一条：灰度维度可按品类（先对 1 个品类全量生效，验证误报后再推广到其余品类）；`CAT-UNCAT-01` 命中数作为灰度期的观察指标。

- [ ] **Step 4: 3.4 表前导语补一句**

说明绑定表与 3.8 共用同一套版本字段，变更走同一流程。

- [ ] **Step 5: require 断言（含 `灰度维度可按品类`）+ tablecheck（该表用 rowspan，重点验列数）+ Commit**

## Task 6: 3.6 风险与 3.7 前置条件

**Files:**
- Modify: 3.6 风险表、3.7 字段依赖表

- [ ] **Step 1: 3.6 新增 2 行**

`LIMS 分类粒度粗于检测品类`｜高｜中｜镜像表支持 `lims_parent_code` 前缀匹配；仍不满足则补映射表（退化为自建字典）
`LIMS 改名 / 并码导致绑定失联`｜中｜高｜品类镜像带快照名与 sync_time，编码变更触发告警并阻断该品类自动匹配

- [ ] **Step 2: 改写原第 5 条**

`不同检测领域差异大，规则不通用` 的应对改为：`已由 3.9 品类绑定模型回答；残余风险：新品类接入仍需人工配 15 条绑定，计入品类覆盖度指标跟踪`

- [ ] **Step 3: 3.7 加一行前置条件**

`品类字典（全组依赖）`｜必需字段：LIMS 物料/样品分类编码、编码稳定性、粒度层级｜现状：待 Week 1 调研确认｜兜底：粒度不足则建映射表，映射缺失品类按未配置走通用集

- [ ] **Step 4: require 断言 + Commit**

## Task 7: 4.2 指标与 2.2 / 2.3 描述

**Files:**
- Modify: 4.2 产品指标表、2.2 表知识库层行、2.3 表 L1 行

- [ ] **Step 1: 4.2 加两行指标**

`品类覆盖度`｜已配置绑定的品类数 ÷ LIMS 活跃品类数｜测量方法：取 `ai_review_categories` 与绑定表 distinct category_code 相除；M1 目标 3/6
`未配置品类占比`｜命中 CAT-UNCAT-01 的报告数 ÷ 总报告数｜测量方法：按提示规则命中计数

- [ ] **Step 2: 2.2 知识库层补品类维度**

组成列追加"（规则库按品类绑定组织，见 3.9）"

- [ ] **Step 3: 2.3 L1 行补一句**

在 L1 检查要点后注明 A03 / B02 属品类专属，需绑定启用

- [ ] **Step 4: require 品类覆盖度 + Commit**

## Task 8: 附录 A 代码与附录 B 引用

**Files:**
- Modify: 文档附录 A 第 1、3 段代码块；附录 B 三段正文
- Modify: `docs/feishu/lims-ai-review/engine_v2.py`（新代码源，入仓）

**Interfaces:**
- Produces: `is_applicable(self, context: Dict) -> bool` 的新语义与 `context["overrides"]` 约定，T9 时间轴文案引用之。

- [ ] **Step 1: 改代码源并本地验证**

基线来源：把文档附录 A 现有三段代码合并为 `engine_v2.py`（与仓库 `docs/feishu/lims-ai-review/` 同目录），再在其上改，不从头写。

`BaseRule.is_applicable`：品类优先（查绑定）→ 领域兜底；`execute` 从 `context["overrides"]` 取参数；示例 `report_data` 补 `category_code`，`context` 补 `bindings`。
Run: `python3 docs/feishu/lims-ai-review/engine_v2.py`
Expected: 正常输出 summary，且未配置品类场景打印 CAT-UNCAT-01 提示

- [ ] **Step 2: 替换附录 A 代码块**

按既有 `<pre lang="python" caption=...>` 三段结构替换，caption 后缀改为「（品类绑定版 v0.2）」

- [ ] **Step 3: 附录 B 更新**

存量表述改为 `45 条（通用 28 / 品类专属 17）`；补一句"另有品类、品类规则绑定两张表"；差额来源写实：`≥50 的缺口由品类专属规则（电缆局部放电、保护管环刚度、金具握着力、安全带静态负荷等）补齐，预计 5–8 条`

- [ ] **Step 4: require 断言 + Commit**

## Task 9: 3.3 时间轴重渲染

**Files:**
- Modify: `docs/feishu/lims-ai-review/make_timeline.py`
- Modify: `docs/feishu/lims-ai-review/timeline.svg`（由 make_timeline.py 重新生成）

- [ ] **Step 1: 改 Week 1 / Week 2 卡片**

Day 3–4 增加一行 `品类字典镜像 + 首批 3 个品类绑定配置`；Day 8–9 增加一行 `绑定表与参数注入开发`。画布高度按最长列重算。

- [ ] **Step 2: 本地渲染与 lint**

Run: `npx -y @larksuite/whiteboard-cli@^0.2.11 -i timeline.svg -f svg --check`
Expected: errors 0 / warnings 0；`grep -c '<polygon'` = 0

- [ ] **Step 3: 一步替换画板块**

`block_replace` → `<whiteboard type="svg" path="@timeline.svg"></whiteboard>`（禁止先建 blank 再写节点）

- [ ] **Step 4: 线上图像复核 + Commit**

## Task 10: 全量回扫与交付

- [ ] **Step 1: 全部断言**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case all`
Expected: exit 0（含 Review Focus 1、2）

- [ ] **Step 2: 计数一致性专项**

校验四处 28 / 17 / 45 一致：3.2.1 导语、3.9 划分清单、附录 B、Base `是否通用` 分组计数（28 + 17）。
Expected: 四处一致，Base 分组计数 28 / 17

- [ ] **Step 3: 绑定完整性**

校验 3 个品类各 17 行、`rule_id` 全部存在于本体、无重复 `(category_code, rule_id)`。
Expected: 45 行、幽灵 rule_id 0、重复 0

- [ ] **Step 4: outline / 画板 / 表格结构**

`--scope outline` 无跳级（3.9 在列）；`<whiteboard` 计数 5；`tablecheck` OK

- [ ] **Step 5: PDF 视觉复核**

导出 PDF 渲染 3.9、3.2.1、3.4、时间轴所在页，确认无溢出、无空白画板占位

- [ ] **Step 6: 标记计划完成并推送**

```bash
sed -i '' 's/- \[ \] \*\*Step/- [x] **Step/g' docs/superpowers/plans/2026-11-06-category-rule-binding.md
git add -A && git commit -m "docs(lims-ai-review): 品类规则绑定落地完成（T1-T10 全绿）"
git fetch && git rebase origin/main && git push origin HEAD:main
```

---

## 交付物清单

| 类型 | 位置 |
| --- | --- |
| 文档 | `NmYVdjPO9oswaoxyHsDcQNu2nKh`：新增 3.9，改动 3.2.1 / 3.3 / 3.4 / 3.6 / 3.7 / 4.2 / 2.2 / 2.3 / 附录 A / 附录 B |
| Base | 新增「品类」（6 行）、「品类规则绑定」（51 行）两张表 + 规则表两列 + 两个视图 |
| 脚本 | `check_doc.py`（新增 labeled / countcheck）、`make_category_tables.py`、`binding_seed.json`、`engine_v2.py`、`make_timeline.py` |
