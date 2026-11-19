# 规则台账 Base

- base_token: `B2WHb25XVaCPinskfxKcr0J0npt`
- table_id: `tblwz7D6MQVvm3Da`（表名 审核规则）
- URL: https://bcng1log8i8v.feishu.cn/base/B2WHb25XVaCPinskfxKcr0J0npt
- 记录数: **50**（含 L3-c/d、L4-a/b/d 占位），状态全部「待审核员确认」；版本 **v0.5**
- **表设计**（对齐飞书 §2.3「审什么」，**已移除 A/B/C**）：
  - `级别`：L1 基础形式 / L2 数据逻辑 / L3 合规对齐 / L4 溯源验证
  - `规则组`：Ln-a/b/c/d（级别下的类别编码）
  - `类别`：审什么主题名，与规则组一一对应
  - `所需字段` / `判定式` / `标准依据` / `严重度` / `适用领域`：**按 §2.3「审什么」检查点重写**（字段词表见 `make_records.py` · FIELD_OPTS）
    - L1：L1-a 编号 · L1-b 签名 · L1-c 字段齐全 · L1-d 单位与格式
    - L2：L2-a 日期链 · L2-b 委托项↔结果 · L2-c 设备校准覆盖 · L2-d 内部勾稽
    - L3：L3-a 标准现行有效 · L3-b 限值符合 · L3-c 方法完整性 · L3-d 项目完整性
    - L4：L4-a 原始记录哈希/时间戳 · L4-b 人员资质 · L4-c CMA 范围 · L4-d 透明度溯源码
- 视图: 表格（默认）· 按状态 · 待确认 · **按级别**（group 级别→规则组）；统一按字段 **`排序号`** 升序（级别 L1→L4 → 规则组 a→d → 通用优先于品类专属 → 组内序号）
- 种子：`ledger_seed.json`；生成器 `make_records.py`；映射表 `level_map.json`
- 品类表 table_id: `tblv1BS7q0eMrAYu`（6 行）；绑定表 table_id: `tbldbfHOuYsh9dLn`（51 行 = 3 品类 × 17 专属规则）
- 3.3 时间轴画板 token（T10 重渲染后）: `MyxDwabVGhVXi0byjurcaDf5nvh`，源文件 `timeline.svg` / 生成器 `make_timeline.py`

> 说明：规则 ID 统一为 **`Ln-x-n`**（如 `L1-a-1`、`L2-b-1`），与规则组对齐；已废弃 `A01-1` / `B01-1` / `C02-5` 等旧编号（见 `level_map.json` → `legacy_id_map`）。L3-c、L3-d、L4-a/b/d 为占位规则（`L3-c-1` / `L3-d-1` / `L4-a-1` / `L4-b-1` / `L4-d-1`），MVP 默认不消费。
