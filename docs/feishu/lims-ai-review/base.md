# 规则台账 Base

- base_token: `B2WHb25XVaCPinskfxKcr0J0npt`
- table_id: `tblwz7D6MQVvm3Da`（表名 审核规则）
- URL: https://bcng1log8i8v.feishu.cn/base/B2WHb25XVaCPinskfxKcr0J0npt
- 记录数: **50**（含 L3-c/d、L4-a/b/d 占位），状态全部「待审核员确认」；版本 **v0.5.4**
- **表设计**（按级别/规则组组织，**已移除 A/B/C**；检查意图以规范为准，不以内部 §2.3 为权威）：
  - `级别`：L1 基础形式 / L2 数据逻辑 / L3 合规对齐 / L4 溯源验证
  - `规则组`：Ln-a/b/c/d（级别下的类别编码）
  - `类别`：主题名，与规则组一一对应
  - `所需字段` / `判定式` / `严重度` / `适用领域`：可执行检查点；**`标准依据`** 以 CNAS-CL01 / 17025 条款为主，**末尾统一附** `CMA：RB/T 214-2017 对应章；《检验检测机构资质认定管理办法》（范围/标志）`（详见附录）；`备注` 为检查意图
    - L1：L1-a 编号 · L1-b 签名 · L1-c 字段齐全 · L1-d 单位与格式
    - L2：L2-a 日期链 · L2-b 委托项↔结果 · L2-c 设备校准覆盖 · L2-d 内部勾稽
    - L3：L3-a 标准现行有效 · L3-b 限值符合 · L3-c 方法完整性 · L3-d 项目完整性
    - L4：L4-a 原始记录哈希/时间戳 · L4-b 人员资质 · L4-c CMA 范围 · L4-d 透明度溯源码
- 视图: 表格（默认）· 按状态 · 待确认 · **按级别**（group 级别→规则组）；统一按字段 **`排序号`** 升序（级别 L1→L4 → 规则组 a→d → 通用优先于品类专属 → 组内序号）
- 种子：`ledger_seed.json`；生成器 `make_records.py`；映射表 `level_map.json`
- 品类表 table_id: `tblv1BS7q0eMrAYu`（6 行，均已配绑定）；绑定表 table_id: `tbldbfHOuYsh9dLn`（**12 行** = 6 品类 × 适用领域匹配的「品类专属」规则；见 `binding_seed.json` / `rebuild_bindings.py`）
  - 绑定口径：只挂主表「是否通用=品类专属」；**通用规则不进绑定表**。无「严重度覆盖」（严重度以主表为准）。「启用」默认「是」，由实验室/客户按项目实际确认。
  - 「参数覆盖」「标准依据」已按品类灌入 MVP 草案（`fill_binding_params.py`），状态仍为待审核员确认；主表标准依据管 CNAS/CMA 通则，绑定表标准依据管品类方法/产品标准。
  - 关联展示列：`品类名称`（Lookup←品类）、`级别`/`类别`（Lookup←审核规则）、`所需字段`/`备注`（Formula←审核规则）；`enrich_bind_lookups.py`
- 3.3 时间轴画板 token（T10 重渲染后）: `MyxDwabVGhVXi0byjurcaDf5nvh`，源文件 `timeline.svg` / 生成器 `make_timeline.py`

> 说明：规则 ID 统一为 **`Ln-x-n`**（如 `L1-a-1`、`L2-b-1`），与规则组对齐；已废弃 `A01-1` / `B01-1` / `C02-5` 等旧编号（见 `level_map.json` → `legacy_id_map`）。L3-c、L3-d、L4-a/b/d 为占位规则（`L3-c-1` / `L3-d-1` / `L4-a-1` / `L4-b-1` / `L4-d-1`），MVP 默认不消费。

- 标准对照附录：[`appendix-rule-standard-basis.md`](./appendix-rule-standard-basis.md)（检查意图/所需字段/出处/原文，对齐 v0.5.4）
  - 飞书云文档：https://bcng1log8i8v.feishu.cn/docx/CKf8dNcAJoptCpxyImFcsd9wnmc
  - 亦已作为 **附录 B** 插入产品规划文：https://bcng1log8i8v.feishu.cn/docx/NmYVdjPO9oswaoxyHsDcQNu2nKh （`lark-cli docs +create` 自本地 md 导入）
