# 规则台账 Base

- base_token: `B2WHb25XVaCPinskfxKcr0J0npt`
- URL: https://bcng1log8i8v.feishu.cn/base/B2WHb25XVaCPinskfxKcr0J0npt
- 版本 **v0.7.0**

## 表分工（v0.7）

| 表 | table_id | 内容 |
| --- | --- | --- |
| **审核规则** | `tblwz7D6MQVvm3Da` | **仅通用领域**规则（40 行）：`是否通用=通用`，`适用领域=通用` |
| **品类** | `tblv1BS7q0eMrAYu` | 6 个 MVP 品类 |
| **品类规则绑定** | `tbldbfHOuYsh9dLn` | **特定领域专属规则定义 + 品类绑定**（42 行）；含「领域」列 |

### 审核规则

- 级别 / 规则组 / 类别 / 所需字段 / 判定式 / 严重度 / 适用领域(=通用) / 标准依据(CNAS+CMA 尾注) / 备注
- 视图按 `排序号`；种子：`universal_seed.json`（全量仍见 `ledger_seed.json`）
- 生成器：`make_records.py` / `sync_rules_basis.py`（`--push-feishu` 只更新通用行）

### 品类规则绑定

- **列序（表格视图）**：`绑定ID` → `category_code` → **`领域`** → `品类名称` → `rule_id` → `启用` → `级别` → `类别` → `所需字段` → `参数覆盖` → `备注` → `标准依据` → `状态` → `版本` → `判定式` → `严重度`
  - 「领域」插在「品类名称」前；其余相对顺序未改；`判定式`/`严重度` 追加在末尾（专属规则定义落本表）
- `品类名称`：Lookup←品类；其余专属规则字段为**存储列**（不再回指审核规则）
- `标准依据`：品类方法/产品标准；`参数覆盖`：品类参数草案（`fill_binding_params.py`）
- 「启用」默认「是」，由实验室/客户确认
- 种子：`specialty_seed.json`（定义）+ `binding_seed.json`（绑定行）
- 迁移/重建：`migrate_specialty_to_binding.py` / `rebuild_bindings.py`
- 审计：`audit-universal-vs-specialty.md`

> L2-d-9（LOD/LOQ）适用领域为空，MVP 不建绑定行，仅留在 `specialty_seed.json`。

## 其它

- 规则 ID：`Ln-x-n`；旧 A/B/C 编号见 `level_map.json`
- 标准对照附录：[`appendix-rule-standard-basis.md`](./appendix-rule-standard-basis.md)
  - 飞书云文档：https://bcng1log8i8v.feishu.cn/docx/CKf8dNcAJoptCpxyImFcsd9wnmc
  - 附录 B：https://bcng1log8i8v.feishu.cn/docx/NmYVdjPO9oswaoxyHsDcQNu2nKh
- 3.3 时间轴画板：`MyxDwabVGhVXi0byjurcaDf5nvh`（`timeline.svg` / `make_timeline.py`）
