# 单据模版字段分流绑定设计

**日期**: 2026-07-28  
**范围**: 单据模版去除「产品检测预通知书」；其余 6 类单据支持按委托登记字段选项分流配置模版  
**状态**: 已实现（原型）

## 背景与目标

当前单据模版按「业务大类 × 固定单据类型」维护，每种单据一张卡片、卡片内多版本单选启用。业务需要：

1. 从单据模版中移除「产品检测预通知书」
2. 其余 6 类单据可绑定委托登记中的某个字段；按该字段不同选项配置不同模版，且每个选项下仍保留多版本、单选启用

## 已确认决策

| 议题 | 决策 |
|------|------|
| 单据种类 | 固定 6 类：检测委托书、收费通知单、检测任务单、检测任务及流转单、还样退库确认表、退样申请表 |
| 可绑定字段 | 仅委托登记中的 **下拉（select）** 字段；文本字段无离散选项，不参与分流 |
| 绑定粒度 | 每个「大类 × 单据类型」独立绑定字段；六种单据互不影响 |
| 未绑定时 | 等同现有行为：单一模版列表（内部落在 `__default__` 桶） |
| 绑定时 | 自动按字段选项生成分流桶 + 始终保留「默认」桶 |
| 版本语义 | 每个选项桶内独立维护 `templates[]`，单选启用一个版本 |
| 运行时匹配 | 取委托单该字段当前值 → 命中对应桶；未命中或桶内无启用版 → 回退「默认」桶 |
| 选项变更 | 字典/主数据新增选项 → 出现空桶（生成时回退默认）；删除选项 → 孤儿桶保留文件但标「已失效」，可迁移或清空 |
| 保存校验 | 卡片开启时：至少「默认」桶须有模版；已配置的选项桶若为空不强制（生成走默认） |
| 页眉页脚 | `pre_notice` 同步移除，与单据种类对齐 |

## 信息架构与 UI

卡片结构（相对原设计增量）：

```
┌──────────────────────────────────────────┐
│ 检测委托书                      [开关]    │
├──────────────────────────────────────────┤
│ 按字段分流  [不分流 / 任务类型 / … ▼]     │
│ （可选）选项 Tab：默认 | 电气… | 委托检测  │
│ ○ V1.docx  …  配置 预览 删除              │
│ ● V2.docx  …  配置 预览 删除              │
│                           [上传模版]      │
└──────────────────────────────────────────┘
```

- **不分流**：隐藏选项 Tab，直接编辑默认桶（兼容旧交互）
- **选择字段后**：展示「默认」+ 各选项 Tab；上传/启用/删除只作用于当前 Tab
- 卡片开关语义不变：关闭=系统不生成该单据，仍可维护模版

## 数据模型

```javascript
DOC_CONFIG[catKey][docType] = {
  cardEnabled: boolean,
  bindFieldId: null | string,   // EntrustFieldConfig 字段 id，如 'taskType'
  uiOptionKey: string,          // 当前选中的选项 Tab（仅前端记忆，可不持久化）
  buckets: {
    '__default__': [{ name, time, enabled }],
    '<optionValue>': [{ name, time, enabled }],
    // ...
  }
}
```

| 字段 | 说明 |
|------|------|
| `bindFieldId` | `null` 表示不分流 |
| `buckets.__default__` | 未绑定时的唯一列表；绑定时作为回退 |
| `buckets[value]` | 选项值 → 版本列表；启用规则同现网（桶内唯一 `enabled: true`） |

### 可绑定字段来源

读取 `EntrustFieldConfig` 中 `fieldType === 'select'` 的字段（含字典绑定与主数据下拉）。

| 来源 | 选项获取 |
|------|----------|
| 已绑字典 (`dictType`) | `MockDictStore.getActiveItems` |
| 未绑字典的主数据 select | 原型内置 mock 选项（合同编号、委托单位等） |

显示名优先用字段别名 `placeholder`，否则 `label`。

### 运行时解析（生成单据时）

```
resolveDocTemplate(cat, docType, entrust):
  card = DOC_CONFIG[cat][docType]
  if !card.cardEnabled → 不生成
  key = card.bindFieldId
    ? (entrust[card.bindFieldId] 命中的桶 || '__default__')
    : '__default__'
  list = card.buckets[key] || card.buckets['__default__']
  return list 中 enabled 的版本；若无则再回退默认桶
```

## 与旧模型兼容

旧结构 `{ cardEnabled, templates }` 读入时迁移为：

```javascript
{
  cardEnabled,
  bindFieldId: null,
  buckets: { '__default__': templates }
}
```

保存一律写新结构。

## 交互规则补充

| 规则 | 行为 |
|------|------|
| 切换绑定字段 | 确认后：保留默认桶文件；按新字段重建选项桶（空列表）；清空旧选项桶 |
| 清空绑定（改回不分流） | 仅保留默认桶；其它桶文件丢弃（原型 confirm） |
| 上传 | 写入当前 Tab 对应桶，并启用新版本 |
| 大类切换 / 返回 | 沿用未保存脏检查 |

## Seed 演示数据（电力物资类 · 检测委托书）

- 绑定字段：`taskType`（任务类型）
- `electrical`（电气·输配电类）：DLWZ V1（停用）+ V2（启用）
- 其余任务类型选项：空桶（演示回退默认）
- `__default__`：保留一份通用委托书（可选）

其余单据默认 `bindFieldId: null`，行为与改造前一致。

## 实现文件

| 文件 | 变更 |
|------|------|
| `template-config.html` | 去除预通知书；DOC_CONFIG 桶模型；绑定/选项 Tab UI；解析与校验 |
| `js/entrust-field-config.js` / `js/mock-dict.js` | 只读引用，提供字段与选项 |
| `system-params.html` | `HF_FILE_TYPES` 去掉 `pre_notice` |
| `docs/.../2026-07-16-document-template-redesign-design.md` | 种类数由 7→6，模型指向本文 |

## 不在本次范围

- 真实后端 API / 数据库表
- `entrust-detail.html`「查看更多」中的预通知书弹窗（非模版管理入口；可另开清理）
- 报告/记录单模版逻辑
- 文本字段精确匹配或表达式分流
