# 报告生成流 · 实现计划

**日期**: 2026-07-18  
**设计依据**: [`2026-07-18-report-generation-flow-design.md`](../specs/2026-07-18-report-generation-flow-design.md)  
**状态**: 已实现（原型）

## 目标

1. 在「业务流程配置 › 报告设置」新增**默认导出模式**绑定规则（2 选 1）
2. 新建报告编制列表 + 报告生成编辑页原型
3. 生成时弹出确认弹窗：预填默认导出模式 + 默认模版变体，编制员可改后确认导出

## 实现顺序

```
Task 1  js/report-export.js          共享逻辑（默认模式解析 + 文件预览）
Task 2  system-params.html           报告设置 panel 新增绑定规则表
Task 3  report-list.html             报告编制列表（图 2）
Task 4  report-compile-edit.html     报告生成编辑页（图 1）+ 生成确认弹窗
Task 5  index.html                   导航链接修复
Task 6  设计/计划文档状态 + 原型批注
```

Task 1 先于 Task 2，便于 `system-params.html` 与 `report-compile-edit.html` 共用常量与 `resolveReportExportMode()`。

---

## Task 1：共享逻辑（`js/report-export.js`）

### 1.1 导出模式常量

```javascript
var REPORT_EXPORT_MODES = [
  { key: 'model-batch',  label: '单种样品一份报告' },
  { key: 'specimen-each', label: '单个样品一份报告' }
];
var DEFAULT_EXPORT_MODE_KEY = 'model-batch';
```

### 1.2 `resolveReportExportMode(sample, rules)`

匹配优先级：型号精确 > 分类最近 > 默认 `specimen-each`。

入参 `sample`: `{ name, model, category, categoryPath[] }`  
入参 `rules`: `{ bindType, bindTarget, modeKey }[]`

### 1.3 `buildReportFilePreview(checkedSpecimens, exportModeKey, templateVariants)`

输入勾选试样列表 + 导出模式 + 各型号选中变体，输出将生成的文件行预览：

```javascript
{
  id, fileName, specimenIds[], sampleLabel,
  templateVariantName,
  status: 'ready' | 'missing-template',
  statusMessage
}
```

### 1.4 模版校验

`hasEnabledTemplate(modelKey, variantId, templateIndex)` — 无变体或无启用版本 → `missing-template`。

### 1.5 验收

- [ ] 单元演示：`resolveReportExportMode` 三条规则 + 默认兜底
- [ ] `buildReportFilePreview` 合并/独立两种模式输出正确文件数

---

## Task 2：报告设置（`system-params.html`）

### 2.1 UI 结构

参照 `panel-record`（记录单设置），在 `panel-report` 内：

1. **保留**现有「报告生成规则」4 项全局配置
2. **新增** infoBar：说明默认导出模式在生成时预填、编制员可改
3. **新增**绑定规则表：筛选栏 + 表格 + 新增/编辑弹窗

### 2.2 数据模型

```javascript
var REPORT_EXPORT_DATA = [
  { id: 1, bindType: 'category', bindTarget: '电力物资类', modeKey: 'model-batch' },
  { id: 2, bindType: 'category', bindTarget: '安全工器具类', modeKey: 'model-batch' },
  { id: 3, bindType: 'category', bindTarget: '环境检测', modeKey: 'model-batch' },
  { id: 4, bindType: 'category', bindTarget: '工程检测', modeKey: 'model-batch' },
  { id: 5, bindType: 'model', bindTarget: '实壁塑料电缆导管 - PVC-C', modeKey: 'model-batch' }
];
```

### 2.3 弹窗字段

| 字段 | 控件 |
|------|------|
| 关联模式 | 样品分类 / 样品名称(型号) |
| 绑定对象 | 联动下拉 |
| 默认导出模式 | 2 选 1 单选 |

保存校验：绑定对象非空；同 `bindType + bindTarget` 不重复；不做模版预检。

### 2.4 验收

- [ ] 全局 4 项 + 绑定规则表同屏展示
- [ ] CRUD 演示可用（内存数组）
- [ ] 文案与设计 spec 一致

---

## Task 3：报告编制列表（`report-list.html`）

### 3.1 页面要素（对齐图 2）

- 筛选：委托编号、样品名称、框架合同、委托单位、受理日期
- 表格列：序号、委托编号、合同编号、委托单位、样品名称、样品进度、受理日期、客户要求完成日期、优先等级、业务员、编制人、报告记录、操作
- 操作：**报告生成**（链到编辑页）、**编制**
- 分页

### 3.2 验收

- [ ] `index.html` 侧边栏「报告管理 › 报告编制」可打开
- [ ] 「报告生成」跳转 `report-compile-edit.html?entrust=…`

---

## Task 4：报告生成编辑页（`report-compile-edit.html`）

### 4.1 页面要素（对齐图 1）

**检测信息 tab：**

1. 样品信息只读区（含产品标识真实值）
2. 检测项目勾选表（试样编号 + 试验项列表）
3. 导出方式单选（页面级，点击生成前可见；打开确认弹窗时同步预填）
4. 「生成报告」按钮
5. 报告文件区（序号、报告编号、试样编号、报告、生成时间、修改时间、操作）

### 4.2 生成确认弹窗

触发：点击「生成报告」且至少勾选 1 行。

| 区块 | 行为 |
|------|------|
| 导出方式 | 预填 `resolveReportExportMode()` 结果；单选可改 |
| 模版变体 | 按涉及型号列出；各预填 `isDefault` 变体；下拉可改 |
| 预览摘要 | 将生成 N 份报告（按当前导出方式实时计算） |
| 按钮 | 取消 / 确认生成 |

确认后：
- 缺模版 → alert/toast 阻断（含型号名）
- 成功 → 追加报告文件行 + 关闭弹窗

### 4.3 Demo 数据

- 委托 `SCZN202508/0009`，样品「实壁塑料电缆导管 PVC-C」
- 模版变体引用 `template-config.html` 中 PVC-C 示例（标准版 default）
- 缺模版场景：可切换至无模版型号演示报错

### 4.4 报告文件操作

- **添加报告图片**：alert 演示 PageOffice
- **导出 PDF**：alert 演示
- 添加图片后更新「修改时间」

### 4.5 验收

- [ ] 勾选 + 生成确认 + 缺模版报错 + 成功生成全流程可演示
- [ ] 默认导出模式来自报告设置；默认变体来自模版 isDefault
- [ ] 两项均在确认弹窗可修改

---

## Task 5：导航（`index.html`）

- [ ] `report-list.html` 链接有效（当前指向不存在文件）
- [ ] 面包屑/标签页与现有原型风格一致

---

## Task 6：文档与批注

- [ ] 设计 spec 状态「已确认」
- [ ] 本计划状态随实现更新
- [ ] `system-params.html` / `report-compile-edit.html` 关键交互加 `data-annotate` 批注（可选）

---

## 依赖与复用

| 来源 | 复用 |
|------|------|
| `js/record-export.js` | `resolveRecordRule` 匹配优先级模式 |
| `system-params.html` `panel-record` | 绑定规则表 UI 结构 |
| `template-config.html` `BODY_DATA` | PVC-C 变体 demo 数据（编辑页可内联 subset） |
| `test-detect-edit.html` | 抽屉/弹窗样式 |

## 不在本次范围

- 真实 Word/PDF 生成、PageOffice 集成
- 报告「编制」Word 在线编辑页
- 后端 API
