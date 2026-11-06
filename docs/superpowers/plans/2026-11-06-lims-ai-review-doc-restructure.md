# LIMS-AI Review 规划文档评审版重构 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把飞书文档 `NmYVdjPO9oswaoxyHsDcQNu2nKh` 从"规划说明"升级为可拍板的立项评审材料：消除 5 处领域化遗留矛盾、补齐 4 项未闭环要求、建立独立规则台账。

**Architecture:** 所有改动落在远端飞书文档 + 一个新 Base 上，本地只维护两类资产：一个**校验脚本**（把"文档是否改对"变成可跑断言，替代单元测试）和**台账种子数据 / 时间轴 SVG 源**。每个任务以"先跑失败断言 → 改文档 → 断言转绿 → 提交"闭环。

**Tech Stack:** `lark-cli`（docs / whiteboard / base）、`@larksuite/whiteboard-cli`（SVG→画板）、Python 3（校验脚本）、pdftoppm（视觉复核）。

**Spec:** `docs/superpowers/specs/2026-11-06-lims-ai-review-doc-restructure-design.md`

## Global Constraints

- 文档 token：`NmYVdjPO9oswaoxyHsDcQNu2nKh`，一律 `--as user`。
- 领域锁定**电网物资与安全工器具检测**，本计划不得改动该决策。
- 画板配色固定 Avocado Press：`#FFFFFF` / `#0055A4` / `#DCF4A2`；**不新增画板**，只重渲染 3.3 时间轴。
- 附录 A 代码块与 2.2 画板**不动**。
- 数字口径固定：**44 = 台账当前存量**，**≥50 = M1 出口目标**；任何提及必须带其中一个限定词。
- M1 目标唯一权威定义在 **3.1**；时间轴「M1 出口」四项数字必须与 3.1 **逐字一致**；4.2 的「M1 阶段目标」降级为一句引用。
- 负责人只写**角色**（产品 / 后端 / 领域顾问），不写人名；评审状态取值 `草稿｜评审中｜已批准`，本次初始 **评审中**。
- **Block ID 生命周期**：`block_replace` / `block_delete` 后受影响 ID 立即失效；后续定位一律重新 `docs +fetch --scope keyword --detail with-ids`，禁止复用旧 ID。
- **表格铁律**（本项目已踩两次）：带 `rowspan` 的续行必须**省略**被合并那一格；单元格文本里的 `< > &` **只转义一次**（写 `&gt;` 进 XML，勿先转义再交给转义器）。
- **画板铁律**（已踩一次）：新增画板必须用 `<whiteboard type="svg" path="@x.svg">` 一步建带内容的块；先建 `type="blank"` 再写节点会让导出长期显示"空白画板"占位。
- **每任务统一收尾（Commit 步骤即执行此块）**：

```bash
git add -A && git commit -m "docs(lims-ai-review): <本任务改动>"
git fetch && git rebase origin/main && git push origin HEAD:main
```

## Review Focus

1. **旧措辞残留**——"零误判率""可切入空间最大的一块""确定首批试点的检测领域""全面智能化"任一处漏改，评审版当场重新制造矛盾。期望：全文 0 命中（T11 断言）。
2. **M1 数字三处漂移**——3.1、时间轴、4.2 各写一套。期望：时间轴与 3.1 逐字一致，4.2 无数字。
3. **表格幻影列**——合并单元格续行多写一格，列数超过表头。期望：结构校验 0 张异常表。
4. **单元格双重转义**——`&amp;gt;` 渲染成字面文本。期望：结构校验 0 命中。
5. **台账与正文口径打架**——Base 记录数 ≠ 44，或正文写"已 50 条"。期望：`record-list` 计数 44 且正文含"44 条"限定词。

---

## Task 1: 校验脚手架

**Files:**
- Create: `docs/feishu/lims-ai-review/check_doc.py`
- Create: `docs/feishu/lims-ai-review/checks.tsv`

**Interfaces:**
- Produces: `check_doc.py --doc <token> --case <name>` → 读 `checks.tsv`（列：`case<TAB>mode<TAB>pattern`，mode ∈ `forbid|require|tablecheck`），全部通过 exit 0，否则 exit 1 并逐条打印命中数。`--case all` 跑 `checks.tsv` 全部行；`--case <name>` 只跑指定行。后续每个任务用它做断言。
- Produces: 归一化函数 `normalize(xml) -> text`：画板→`[画板]`、代码块→`[代码块]`、标签剥离、实体还原。表格结构校验直接吃原始 XML。

- [ ] **Step 1: 写脚本**

`normalize` 之外只需三个 mode：`forbid`（正则命中数必须为 0）、`require`（必须 ≥1）、`tablecheck`（对每个 `<table>` 统计表头 `<th>` 数与各行 `<td>` 数，出现 `max(cells) > headers` 或空 `<th>` 即判失败；同时统计 `&amp;(gt|lt);` 命中）。

- [ ] **Step 2: 建 checks.tsv 基线条目**

先只放**当前应当失败**的 forbid，作为红灯：`zero-error-rate<TAB>forbid<TAB>零误判率` 与 `ch6-domain-todo<TAB>forbid<TAB>确定首批试点的检测领域`。

- [ ] **Step 3: 跑脚本确认红灯**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case all`
Expected: exit 1，两条 forbid 各命中 ≥1（证明脚本真的在读线上文档，不是空跑）

- [ ] **Step 4: 跑结构校验取现状基线**

Run: `python3 .../check_doc.py --doc ... --case tablecheck`
Expected: exit 0（当前 22 张表已在前几轮修好）；若非 0，先记录异常表 ID，交 T11 一并复核

- [ ] **Step 5: Commit**

```bash
git add docs/feishu/lims-ai-review/ && git commit -m "chore(lims-ai-review): 文档改造校验脚手架（forbid/require/tablecheck）"
```

## Task 2: 文档信息区与版本记录

**Files:**
- Modify: 文档标题块之后、`# 1. 行业趋势…` 之前（`block_insert_after` 锚到标题后的第一个块）
- Modify: `checks.tsv`（追加本任务断言）

**Interfaces:**
- Produces: 信息区表格首列固定字面量 `负责人` / `评审状态` / `最近更新` / `关联文档`，T11 的 require 断言依赖这些字符串。

- [ ] **Step 1: 追加断言到 checks.tsv**

`meta-review-status<TAB>require<TAB>评审状态` 与 `meta-v12<TAB>require<TAB>v1.2 评审版重构`

- [ ] **Step 2: 插入信息区**

两张表：① 元信息 2 列表，值依次 `产品 / 后端 / 领域顾问（角色，待点名）`、`评审中`、`2026-11-06`、`PRD-v1.md（待补链接）、电网物资抽检细则（待补）、安全工器具预防性试验规程 DL/T 976-2017（待补）`；② 版本记录 3 列表（版本 / 日期 / 变更）三行：v1.0 结构化整理、v1.1 领域化改造、v1.2 评审版重构，日期均 2026-11-06。

- [ ] **Step 3: 跑断言转绿**

Run: `python3 .../check_doc.py --doc ... --case meta-review-status && ... --case meta-v12`
Expected: 均 exit 0

- [ ] **Step 4: Commit**

## Task 3: 第 1–2 章领域口径

**Files:**
- Modify: 1.1 表、1.2 表与其后结论段、2.1 目标用户段
- Modify: `checks.tsv`

**Interfaces:**
- Consumes: T1 的 `forbid` / `require`
- Produces: 1.2 新增行的字面量 `电力物资 / 安全工器具`，T11 require 依赖它。

- [ ] **Step 1: 加断言（先红）**

forbid `可切入空间最大的一块`；require `电力物资 / 安全工器具`；require `国网 / 南网物资部`。

- [ ] **Step 2: 1.1 合列**

三列（应用方向 / 成熟度 / 状态）→ 两列（应用方向 / 成熟度与状态），值合并为 `高 · 已成熟`、`中 · 快速发展中`、`低 · 早期探索`、`萌芽 · 早期探索`，行数 8 不变。

- [ ] **Step 3: 1.2 补行 + 改结论**

新行：`电力物资 / 安全工器具 | 各省电科院、CTQC、平高/西电系实验室 | 报告模板化生成、标准限值自动判定 | ★★☆☆`，插在"建材检测"之后。结论段改写为：医学检验领先；电力物资与安全工器具检测的报告审核环节仍以人工为主、且判定依据高度标准化（GB/T 1231、GB/T 3098.1、DL/T 976），确定性规则可覆盖度高，故 M1 选定该领域。

- [ ] **Step 4: 2.1 目标用户改写**

替换为：`国网 / 南网物资部与省物资公司（甲方抽检）、电科院与第三方电力物资检测机构、安全工器具管理与使用单位、工器具与金具生产企业`。

- [ ] **Step 5: 跑本任务断言转绿**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case all`
Expected: exit 0

- [ ] **Step 6: Commit**（见 Global Constraints 的统一收尾命令）

## Task 4: 2.3 能力分层 ↔ 规则类别映射

**Files:**
- Modify: 2.3 表（3 列 → 4 列）、2.3 表后段落
- Modify: `checks.tsv`

**Interfaces:**
- Produces: 映射字面量 `L1 → A / B / C`，T6 的 3.8 与 T9 的台账 `类别` 字段取值需与之一致。

- [ ] **Step 1: 加断言**

require `对应规则类别`；forbid `图谱识别、图片判读、PDF 解析、手写识别`（旧理化口径行，将被替换）。

- [ ] **Step 2: 加第四列并填映射**

`L1 1.1 数据完整性 → A 类`；`L1 1.2 格式规范性 → C 类`；`L1 1.3 逻辑一致性 → B 类`；`L2 2.1/2.2 → D 标准限值`；`L2 2.3 方法符合性 → D + B03`；`L3 全部 → B（ML 扩展）`；`L4 4.1/4.2/4.3 → E 多模态 / 预测 / 自进化`。

- [ ] **Step 3: L2/L3/L4 检查要点领域化**

L2 2.3：`方法适用性验证、检出限 / 定量限、不确定度评估` → `试验方法适用性（GB/T 228.1 拉伸、GB/T 1231 扭矩系数）、设备量程与分辨力、不确定度与数据修约`。
L3 3.1：`统计异常值、离群检测、Grubbs / Dixon 检验、趋势异常` → `同批平行试样离群、强度-硬度换算偏离、扭矩系数离散度异常、历史批次趋势偏移`。
L4 4.1：`图谱识别、图片判读、PDF 解析、手写识别` → `金相 / 断口显微图像判读、镀锌层截面测量、铭牌与试验记录拍照识别、原始记录手写识别`。

- [ ] **Step 4: 表后段落补一句映射说明**

说明 2.3 是能力分层、3.2.1 是规则分类，二者经第四列对应，避免读者以为两套体系。

- [ ] **Step 5: 跑本任务断言转绿**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case all`
Expected: exit 0

- [ ] **Step 6: Commit**（见 Global Constraints 的统一收尾命令）

## Task 5: 3.4 / 3.2.1 / 5.1 一致性

**Files:**
- Modify: 3.4 表 Data Layer 行、3.2.1 B02 单元格、5.1 表两处
- Modify: `checks.tsv`

- [ ] **Step 1: 加断言**

forbid `零误判率`；forbid `LIMS DB（只读）、规则配置表、审核结果表`（旧三表值）；forbid `全面智能化`；require `问题明细表、反馈表`。

- [ ] **Step 2: 3.4 补齐四张表**

Data Layer 行组成列改为 `LIMS DB（只读）、规则配置表、审核结果表、问题明细表、反馈表`。

- [ ] **Step 3: 3.2.1 B02 体例统一**

首格 `实测抗拉强度 ≥ 标准规定最小值，且 Rm > Rp0.2（强度指标自洽）；断后伸长率、断面收缩率与强度等级匹配，无异常高值；` 拆为两格（每行一判据），与同列其余行一致。

- [ ] **Step 4: 5.1 两处改写**

`确定性 if-then 逻辑；零误判率的基础检查；累积审核反馈数据` → `确定性 if-then 逻辑；误报目标 < 1% 的基础检查；累积审核反馈数据`。M7–M9 行"进入下一阶段前提"`全面智能化` → `多模态判读在两个以上品类通过盲测（判读一致率 ≥ 90%）`。

- [ ] **Step 5: 跑本任务断言转绿**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case all`
Expected: exit 0

- [ ] **Step 6: Commit**（见 Global Constraints 的统一收尾命令）

## Task 6: 新增 3.7 字段依赖清单与 3.8 规则变更控制

**Files:**
- Modify: 3.6 之后插入两个新章节
- Modify: `checks.tsv`

**Interfaces:**
- Produces: 3.7 表字段名清单（`抽样单号 / 炉（批）号 / 设备校准有效期 / 上次预防性试验日期 / 8 套平行测定值 / 封样照片 / 资质认定范围表`），T9 台账 `所需字段` 列取值必须与之同名。

- [ ] **Step 1: 加断言**

require `3.7 M1 数据前置条件`；require `3.8 规则台账与变更控制`；require `上次预防性试验日期`；require `effective_from`。

- [ ] **Step 2: 写 3.7**

表四列 `规则组 / 必需字段 / LIMS 现状 / 缺字段兜底`，7 行覆盖上述字段；`LIMS 现状` 全部填 `待 Week 1 调研确认`；兜底给可执行动作（如"台账补录""Excel 导入""规则降级为提示不阻断"）。收尾一句：任一必需字段缺失，对应规则组在 M1 只能以「提示」级上线，不得判「严重」——与 1.4 红线一致。

- [ ] **Step 3: 写 3.8**

闭环 1.4 的"算法变更须走变更控制"。① `ai_review_rules` 需补字段表：`version TEXT / effective_from TIMESTAMP / effective_to TIMESTAMP / approved_by VARCHAR(50) / change_ticket VARCHAR(50)`；② 流程五步：编辑 → 领域顾问评审 → 灰度（按领域或按报告抽样 10%）→ 全量 → 回滚；③ 审计要求：每次审核结果记录 `engine_version` + 生效规则版本，可复现当时判定；④ 与台账（附录 B）互为引用。

- [ ] **Step 4: 跑本任务断言转绿**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case all`
Expected: exit 0

- [ ] **Step 5: Commit**（见 Global Constraints 的统一收尾命令）

## Task 7: 4.2 测量方法 + 新增 4.3 成本与回收期

**Files:**
- Modify: 4.2 产品指标表（2 列 → 3 列）、4.2 末尾
- Modify: 4.2 之后插入 4.3

- [ ] **Step 1: 加断言**

require `测量方法`；require `4.3 投入成本与回收期`；require `人工全量复核`；require `假设`。

- [ ] **Step 2: 4.2 加测量列**

`规则检出率` → 分母来自**人工全量复核抽样**：试运行期每周抽 20 份报告由资深审核员盲审，其问题集作 ground truth；`审核员采纳率` → 直接取 `ai_review_feedback.is_correct` 聚合；`误报率` → 审核员点「不同意」计数；`审核覆盖率` → 生效规则组数 ÷ 3.2.1 应覆盖组数；`满意度` → 5 题 5 分制问卷换算为 /10，样本 ≥ 6 名审核员。

- [ ] **Step 3: 写 4.3 假设表 + 计算式**

表 `项 / 取值 / 来源`：M1 人月 4.5、后续 11 个月人月（假设表，留空可填）、人月成本 X 万、服务器与存储 Y 万/年、标准库与规则梳理 Z 人日。计算式写明 `回收期(月) = 总投入 ÷ (年度节省 ÷ 12)`，并标注"数字待财务口径确认，本表只给式与参数位"。不得写死具体回收期。

- [ ] **Step 4: 跑本任务断言转绿**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case all`
Expected: exit 0

- [ ] **Step 5: Commit**（见 Global Constraints 的统一收尾命令）

## Task 8: M1 目标单点化与第 6 章状态化

**Files:**
- Modify: 3.1 表、4.2 末段、第 6 章清单
- Modify: `checks.tsv`

**Interfaces:**
- Produces: 权威数字串 `≥ 50 条`、`≥ 99%`、`< 5 秒`、`≥ 7 / 10`，T10 时间轴出口必须逐字复用。

- [ ] **Step 1: 加断言**

forbid `确定首批试点的检测领域`；forbid `建议选报告量最大的 1 个领域`；require `已定：电网物资与安全工器具检测`。

- [ ] **Step 2: 3.1 标记为权威定义**

成功指标表前加一句：`M1 目标以本表为唯一定义，3.3 时间轴出口与 4.2 阶段目标均引用此处。` 表值保持 Global Constraints 列出的四项 + 领域行。

- [ ] **Step 3: 4.2 末段降级为引用**

`M1 阶段目标：规则精确率 ≥ 99%…覆盖核心检查维度 ≥ 60%。` → `M1 阶段目标见 3.1 成功指标表（唯一定义处）；本节仅约定其测量方法。` 删除全部重复数字。

- [ ] **Step 4: 第 6 章清单状态化**

六条改为 `状态 / 事项 / owner（角色）/ 截止`：第 1 条 `已完成` 且文案改 `已定：电网物资与安全工器具检测`；第 2–4 条 `进行中`（产品 + 领域顾问，Week 1）；第 5 条 `待办`（后端，Week 1 Day 5，方案 A 已推荐待确认）；第 6 条 `待办`（产品，Week 1 末）。

- [ ] **Step 5: 跑本任务断言转绿**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case all`
Expected: exit 0

- [ ] **Step 6: Commit**（见 Global Constraints 的统一收尾命令）

## Task 9: 规则台账 Base 与附录 B 引用

**Files:**
- Create: `docs/feishu/lims-ai-review/ledger_seed.json`（44 条）
- Modify: 附录 A 之前插入 `附录 B` 标题 + 引用卡片
- Modify: `checks.tsv`

**Interfaces:**
- Produces: `BASE_APP_TOKEN` / `TABLE_ID` / 12 字段名，写入 `docs/feishu/lims-ai-review/base.md` 供 T11 复核。

- [ ] **Step 1: 读字段规范**

Run: `lark-cli skills read lark-base/references/lark-base-field-json.md`
Expected: 拿到 select / multi-select 字段的合法 JSON 形状（禁止臆造属性）

- [ ] **Step 2: 建 Base 与表结构**

`lark-cli base +base-create --name "LIMS-AI Review 规则台账" --time-zone Asia/Shanghai --table-name "审核规则" --fields '[…12 字段…]'`，字段按 spec 的 schema 表：`规则ID(text) 规则组(select A01…C02) 类别(select A/B/C) 判定式(text) 所需字段(multi-select，取值与 T6 的 3.7 字段名同名) 标准依据(text) 严重度(select 严重/一般/轻微/提示) 适用领域(multi-select 电网物资/安全工器具/通用) 状态(select 待审核员确认/已确认/已上线/停用) 版本(text) 负责人(text) 备注(text)`。

- [ ] **Step 3: 生成 44 条种子并批量写入**

`ledger_seed.json` 按 3.2.1 逐条拆：A01 6 + A02 5 + A03 6 = 17；B01 5 + B02 8 + B03 4 = 17；C01 5 + C02 5 = 10。`状态` 全部 `待审核员确认`，`版本` `v0.1`。
Run: `lark-cli base +record-batch-create …`
Expected: `+record-list` 计数 **44**

- [ ] **Step 4: 建筛选视图**

`+view-create` 两个视图：`按状态`（group 状态）、`待确认`（filter 状态=待审核员确认）。

- [ ] **Step 5: 文档插附录 B**

`附录 B. 规则台账（44 条，持续补齐至 ≥50 条出口目标）` + 一句说明 + `<bookmark name="AI 审核规则台账" href="<BASE_URL>">`。正文写明 44 为存量、≥50 为出口目标、差额 6 条 Week 1 补齐。

- [ ] **Step 6: 跑本任务断言转绿**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case all`
Expected: exit 0

- [ ] **Step 7: Commit**（见 Global Constraints 的统一收尾命令）

## Task 10: 重渲染 3.3 时间轴

**Files:**
- Create: `docs/feishu/lims-ai-review/b33_timeline.svg`（从 `/tmp/limsdoc/arch/b33.py` 迁入并改造）
- Modify: 文档 3.3 时间轴画板块

- [ ] **Step 1: 迁移 SVG 源入仓**

把生成脚本与 SVG 放进仓库，避免 `/tmp` 丢失；本地渲染基线：
Run: `npx -y @larksuite/whiteboard-cli@^0.2.11 -i b33_timeline.svg -f svg --check`
Expected: `errors: 0, warnings: 0`

- [ ] **Step 2: Week 4 卡片补 UAT 门槛**

在 `Day 16–17 UAT 测试` 组下加一行 `通过线：误报 0 条、漏报 ≤ 2 条`；卡片高度按最长列重算，画布高度同步。

- [ ] **Step 3: 出口条件与 3.1 逐字对齐**

底部「M1 出口」四项改为复用 T8 产出的权威串：`≥ 50 条确定性规则上线 · 审核员看到 AI 预审结果 · 规则精确率 ≥ 99% · 单份审核 < 5 秒`。

- [ ] **Step 4: 替换文档中的画板**

`block_replace` 旧时间轴块 → `<whiteboard type="svg" path="@b33_timeline.svg"></whiteboard>`（**必须一步建带内容**，见 Global Constraints）。

- [ ] **Step 5: 渲染复核**

Run: `lark-cli whiteboard +query --whiteboard-token <新token> --output_as image …` 并 view
Expected: 四列卡片无溢出、出口条文字完整

- [ ] **Step 6: Commit**

## Task 11: 全量回扫与交付

**Files:**
- Modify: `checks.tsv`（汇总全部 forbid/require）

- [ ] **Step 1: 汇总断言全跑**

Run: `python3 docs/feishu/lims-ai-review/check_doc.py --doc NmYVdjPO9oswaoxyHsDcQNu2nKh --case all`
Expected: exit 0（Review Focus 1、2、5 全覆盖）

- [ ] **Step 2: 结构与转义全表校验**

Run: `python3 .../check_doc.py --doc ... --case tablecheck`
Expected: exit 0（Review Focus 3、4）

- [ ] **Step 3: outline 与画板清点**

Run: `lark-cli docs +fetch --doc … --scope outline`
Expected: 层级连续（1…6 + 附录 A/B，新增 3.7/3.8/4.3 在列，无跳级）；`grep -c '<whiteboard'` = 5

- [ ] **Step 4: PDF 视觉复核**

Run: `lark-cli drive +export --url … --file-extension pdf --output-dir /tmp/review` 后 `pdftoppm` 渲染含画板的页
Expected: 无「空白画板」占位（Review Focus 5 的画板面）、新章节排版正常

- [ ] **Step 5: 提交并推送**

```bash
git add -A && git commit -m "docs(lims-ai-review): 评审版重构落地（P0 矛盾清零 + 3.7/3.8/4.3 + 规则台账 Base）"
git fetch && git rebase origin/main && git push origin HEAD:main
```

---

## 交付物清单

| 类型 | 位置 |
| --- | --- |
| 飞书文档 | `NmYVdjPO9oswaoxyHsDcQNu2nKh`（新增 4 个单元 + 17 处改动） |
| 规则台账 Base | `docs/feishu/lims-ai-review/base.md` 记录 app_token / table_id / URL |
| 校验脚本 | `docs/feishu/lims-ai-review/check_doc.py` + `checks.tsv`（可复跑） |
| 时间轴源 | `docs/feishu/lims-ai-review/b33_timeline.svg` |
