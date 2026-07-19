# 记录单配置流整改 · 实现计划

**日期**: 2026-07-17  
**设计依据**: [`2026-07-17-record-sheet-config-flow-design.md`](../specs/2026-07-17-record-sheet-config-flow-design.md)  
**状态**: 已实现（原型）

## 目标

将记录单「配置 → 模版 → 导出」三处原型对齐为配置驱动 + 动态拼接，操作员在导出抽屉仅预览文件并确认导出。

## 实现顺序

```
Task 1  system-params.html  记录单设置（4 模式 + 新增/编辑弹窗）
Task 2  js/record-export.js  共享逻辑（规则匹配 + 文件预览生成 + 状态判定）
Task 3  test-detect-edit.html  导出抽屉重构
Task 4  template-config.html  说明条与批注澄清
Task 5  设计文档状态更新 + 原型批注
```

Task 2 可内联于 `test-detect-edit.html`（原型体量小）；若逻辑超过 ~150 行则抽离为 `js/record-export.js` 并在 `system-params.html` 复用演示数据常量。

---

## Task 1：记录单设置（`system-params.html`）

### 1.1 数据模型

```javascript
var RECORD_MODES = [
  { key: 'model-all',   label: '单种样品所有试验生成一份文件', dim: 'model', split: 'all' },
  { key: 'model-each',  label: '单种样品单种试验生成一份文件', dim: 'model', split: 'each' },
  { key: 'specimen-all', label: '单个样品所有试验生成一份文件', dim: 'specimen', split: 'all' },
  { key: 'specimen-each', label: '单个样品单种试验生成一份文件', dim: 'specimen', split: 'each' }
];

var RECORD_DATA = [
  { id: 1, bindType: 'category', bindTarget: '安全工器具', modeKey: 'model-all' },
  { id: 2, bindType: 'category', bindTarget: '电网物资', modeKey: 'model-each' },
  { id: 3, bindType: 'model', bindTarget: '电线电缆', modeKey: 'specimen-each' }
];
```

### 1.2 UI 变更

| 区域 | 变更 |
|------|------|
| 筛选栏 | 生成模式下拉改为 4 种；增加关联模式筛选（可选） |
| 表格列 | 序号 / 关联模式 / 绑定对象 / 生成模式 / 操作 |
| 新增/编辑弹窗 | 字段：关联模式（样品分类 \| 样品名称(型号)）、绑定对象（联动下拉）、生成模式（4 选 1） |
| 保存校验 | 绑定对象非空；同 `bindType + bindTarget` 不可重复；**不做模版预检** |

### 1.3 验收

- [ ] 列表展示 3 条示例数据，文案与 spec 一致
- [ ] 新增/编辑弹窗可演示保存（alert 或写入内存数组）
- [ ] 筛选按绑定对象、生成模式生效

---

## Task 2：共享导出逻辑

### 2.1 `resolveRecordRule(modelLabel, categoryPath, rules)`

匹配优先级：型号精确 > 分类最近祖先 > 默认 `model-each`（模式 2）。

原型可硬编码规则表 + 样品 metadata（`category`, `modelLabel`）。

### 2.2 `buildRecordFilePreview(entrust, samples, rules, templateIndex)`

输入：
- `samples[]`：`{ id, name, model, category, groups[] }`（groups 含试验项 title + rows 状态）
- `templateIndex`：`{ [modelTreeKey]: { [testName]: boolean } }` 是否有启用模版

输出：`files[]`：

```javascript
{
  id, fileName, sampleLabel, specimenId,  // specimenId 模式 1/2 为 null
  tests: [{ name, done }],                 // done = 是否已完成
  status: 'ready' | 'incomplete' | 'missing_template',
  statusDetail: string,
  modeKey, ruleId
}
```

### 2.3 状态判定

| 模式 | 条件 | status |
|------|------|--------|
| 1、3 合并 | 存在未完成试验项 | `incomplete` |
| 1、3 合并 | 全部完成但缺模版 | `missing_template` |
| 1、3 合并 | 全部完成且模版齐全 | `ready` |
| 2、4 切分 | 试验项未完成 | 不生成行 |
| 2、4 切分 | 完成但缺模版 | `missing_template` |
| 2、4 切分 | 完成且模版齐全 | `ready` |

### 2.4 试样完成判定（模式 3、4）

原型简化：试验项「已完成」= 该 group 下所有 rows 状态均为「已完成」。  
模式 3 下单个试样「全部完成」= 每个试验项 group 中该试样编号对应 row 已完成（原型可按 group 级完成近似，或取第一个未完成 row 演示）。

### 2.5 验收

- [ ] 绝缘操作杆 · 模式 1 · 1 项未完成 → 1 行 `incomplete`
- [ ] 绝缘操作杆 · 模式 1 · 全完成 · 缺抗弯静负荷模版 → 1 行 `missing_template`
- [ ] 绝缘操作杆 · 模式 4 · 试样 0101 → 每已完成试验项 1 行
- [ ] 默认规则（无匹配）→ 模式 2 行为

---

## Task 3：导出抽屉（`test-detect-edit.html`）

### 3.1 HTML 结构

移除：
- `#collapseSingle` / `#collapseMulti` 双折叠区
- `#singleExportMode` / `#multiExportMode` 单选
- `#singleExportWarn` / `#multiExportWarn`（改为表格内行状态 + 底部汇总条）

替换为单表：

```html
<table class="export-table">
  <thead>
    <tr>
      <th>勾选</th>
      <th>文件名（预览）</th>
      <th>样品名称(型号)</th>
      <th>试样编号</th>
      <th>包含试验项</th>
      <th>状态</th>
      <th>操作</th>
    </tr>
  </thead>
  <tbody id="exportPreviewBody"></tbody>
</table>
<div class="export-warn" id="exportSummaryWarn"></div>
```

### 3.2 样式

- 试验项标签：完成 `.test-tag-done`；未完成 `.test-tag-pending`（灰色）
- 状态列：就绪（绿）/ 试验未完成（橙）/ 缺模版（红）
- 未就绪行：checkbox disabled、导出按钮 disabled

### 3.3 JS 重构

删除：`buildExportDrawerData` 旧结构、`renderTestCheckList`、`exportSingleRow`/`exportMultiRow`/`batchExportRecords` 中多分区逻辑、`multiTemplates` 相关。

新增：
- `openExportDrawer()` → `renderExportPreview()`
- `exportPreviewRow(idx)` / `batchExportRecords()` → 仅 `status === 'ready'` 可导出
- 底部汇总：统计不可导出行数

### 3.4 演示数据

| 样品 | 规则 | 演示场景 |
|------|------|---------|
| 绝缘操作杆 | 模式 1（安全工器具） | 抗弯静负荷未完成 + 缺模版 |
| 绝缘硬梯 | 模式 2（默认或电网物资） | 多项就绪 |
| 绝缘横担 | 模式 4 | 缺某试验项模版 |

### 3.5 验收

- [ ] 打开抽屉见文件预览列表，无策略单选/组合模版列
- [ ] 合并模式行在试验未完成时不可导出
- [ ] 缺模版行展示具体试验项名称
- [ ] 批量导出跳过未就绪行；全不可导出时 toast/alert
- [ ] 单行导出 alert 含文件名、包含试验项

---

## Task 4：记录单模版（`template-config.html`）

### 4.1 说明条 `#infoBar`

更新文案（record tab 可见时）：

> 每个试验项单独绑定模板。导出时系统按**记录单设置**中的生成模式切分文件；合并模式下须全部试验项完成后，自动拉取各试验项启用模板**动态拼接**为一个 Word 文件。

### 4.2 批注 `record-export-logic`

同步上述逻辑；删除「组合模版」相关表述。

### 4.3 验收

- [ ] 记录单 tab 下 infoBar 文案正确
- [ ] 无新增 UI 入口

---

## Task 5：文档与批注

- [ ] 设计 spec 状态改为「已确认，实现中/已实现」
- [ ] `system-params.html` 记录单 tab 增加 PrototypeAnnotation（关联模式、4 种生成模式）
- [ ] `test-detect-edit.html` 导出抽屉批注更新

---

## 不在本次实现

- 真实 Word 拼接 / PageOffice 调用
- 跨页面 localStorage 共享配置（原型可用各页硬编码 + 注释说明生产环境 API）
- 受理/分配阶段预检

## 手动验证清单

1. 业务流程配置 › 记录单设置：查看/新增/编辑 4 种模式  
2. 模板管理 › 记录单模版：阅读 infoBar 说明  
3. 试验检测编辑 › 导出管理：预览列表、三种状态、批量/单行导出  
