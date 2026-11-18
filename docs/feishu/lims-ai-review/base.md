# 规则台账 Base

- base_token: `B2WHb25XVaCPinskfxKcr0J0npt`
- table_id: `tblwz7D6MQVvm3Da`（表名 审核规则）
- URL: https://bcng1log8i8v.feishu.cn/base/B2WHb25XVaCPinskfxKcr0J0npt
- 记录数: **50**（原 45 条电网检查项 + 5 条 L3-c/L3-d/L4 占位），状态全部「待审核员确认」
- **表设计**（对齐飞书 §2.3「审什么」，**已移除 A/B/C**）：
  - `级别`：L1 基础形式 / L2 数据逻辑 / L3 合规对齐 / L4 溯源验证
  - `规则组`：Ln-a/b/c/d（级别下的类别编码）
  - `类别`：审什么主题名，与规则组一一对应
    - L1：L1-a 编号 · L1-b 签名 · L1-c 字段齐全 · L1-d 单位与格式
    - L2：L2-a 日期链 · L2-b 委托项↔结果 · L2-c 设备校准覆盖 · L2-d 内部勾稽
    - L3：L3-a 标准现行有效 · L3-b 限值符合 · L3-c 方法完整性 · L3-d 项目完整性
    - L4：L4-a 原始记录哈希/时间戳 · L4-b 人员资质 · L4-c CMA 范围 · L4-d 透明度溯源码
- 视图: 表格（默认）· 按状态 · 待确认 · **按级别**（group 级别→规则组）
- 种子：`ledger_seed.json`；生成器 `make_records.py`；映射表 `level_map.json`
- 品类表 table_id: `tblv1BS7q0eMrAYu`（6 行）；绑定表 table_id: `tbldbfHOuYsh9dLn`（51 行 = 3 品类 × 17 专属规则）
- 3.3 时间轴画板 token（T10 重渲染后）: `MyxDwabVGhVXi0byjurcaDf5nvh`，源文件 `timeline.svg` / 生成器 `make_timeline.py`

> 说明：规则 ID（`A01-1` 等）仍作引擎/绑定稳定键；**浏览与分期只看级别 / 规则组 / 类别**。L3-c、L3-d、L4-a/b/d 为占位规则（ID `L3C-1` / `L3D-1` / `L4A-1` / `L4B-1` / `L4D-1`），MVP 默认不消费。
