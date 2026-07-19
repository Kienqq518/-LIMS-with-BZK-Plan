# 记录单组合模版 · 实现计划

**日期**: 2026-07-19  
**设计依据**: [`2026-07-19-record-combined-template-design.md`](../specs/2026-07-19-record-combined-template-design.md)  
**状态**: 待实现

## 目标

在记录单模版页增加 **样品层 / 型号层组合模版** 管理能力，并更新导出逻辑：合并类模式优先组合模版（运行时型号 → 样品继承），否则试验项拼接；切分类模式仍仅用试验项单模版。UI 不展示继承态，文件列仅 `xxx.docx` / `未上传`。

## 实现顺序

```
Task 1  template-config.html  数据 + 树 + 组合卡片 + 统一表格
Task 2  template-config.html  版本弹窗 / PageOffice / 清除 / 批注
Task 3  js/record-export.js   resolveCombinedTemplate + 合并类状态判定
Task 4  test-detect-edit.html  导出抽屉对接 + 演示数据
Task 5  system-params.html     模式 3/4 文案「单个样品…」（可选对齐）
Task 6  设计文档状态 + 手动验证
```

Task 3 先于 Task 4 可并行准备 mock 数据；Task 1、2 可同文件分批提交。

---

## Task 1：模版页结构与数据（`template-config.html`）

### 1.1 树节点标记

- 遍历 `REPORT_TREE_ALL`，对「直接子节点含 `model:true`」的节点加 `sample: true`（如 `ds-s`）
- `enrichRecordTreeWithTests` 保留 `sample` 属性传递
- **不增加**组合模版 badge / 继承角标

### 1.2 新增 `RECORD_COMBINED_DATA`

示例：

```javascript
var RECORD_COMBINED_DATA = [
  { id: 101, bindType: 'sample', bindTarget: 'ds-s', bindLabel: 'DS实壁类塑料电缆导管_直管',
    file: '实壁导管_全套记录单.docx', configured: true,
    templates: [{ name: '实壁导管_全套记录单.docx', time: '2026-03-01 10:00', enabled: true, uploader: 'admin' }] },
  { id: 102, bindType: 'model', bindTarget: 'glove', bindLabel: '01绝缘手套',
    file: null, configured: false, templates: [] }
];
```

辅助函数：

| 函数 | 作用 |
|------|------|
| `findSampleAncestor(nodeId)` | 向上找最近 `sample:true` 祖先 |
| `getCombinedRecord(bindType, bindTarget)` | 查本节点记录 |
| `getOrCreateCombinedRecord(bindType, bindTarget, label)` | 版本上传时创建 |
| `collectCombinedRowsInScope(treeId)` | 当前树节点范围内所有组合行 |
| `collectTableRowsInScope(treeId)` | 组合行 + 试验项行合并 |

### 1.3 HTML 布局

在 `.tpl-toolbar` 与 `.tpl-table-scroll` 之间插入：

```html
<div id="combinedTemplatePanel" class="px-4 pb-3 hidden"></div>
<div class="px-4 pb-2 section-head" id="recordTableSectionHead">
  <div class="font-medium text-slate-700">试验项模版</div>
  <div class="text-xs text-slate-500" id="recordTableSectionSub">…副标题…</div>
</div>
```

`renderCombinedPanel()` 按选中节点类型渲染四类 UI（分类说明 / 样品·型号编辑 / 试验项折叠条）。

### 1.4 筛选栏扩展

记录单 tab 增加：

```html
<label>模版类型</label>
<select id="f_rowType"><option value="">全部</option><option value="combined">组合模版</option><option value="test">试验项模版</option></select>
```

`getFilteredRows()` 重构为返回 `{ rowType, data }[]`：

- `rowType: 'combined'` → 来自 `RECORD_COMBINED_DATA`（scope 内）
- `rowType: 'test'` → 现有 `RECORD_DATA`

**是否已配置**：

- 组合行：`configured === true`（本节点实际上传；**不含**上级继承）
- 试验项行：现有 `r.configured`

### 1.5 统一表格

表头增加 **模版类型**、**绑定层级**（组合行显示 样品层/型号层）：

```html
<th>模版类型</th><th>绑定层级</th>…
```

- 组合行试验项列固定「全部试验项」
- 组合行操作：`combinedOps(r)` → 配置/版本/预览/清除（与 spec 一致，无复制）
- 点击组合行 → `selectTree(r.bindTarget)`

样品层选中时：在 tbody 按型号插入分组头行（`colspan`，不可选）。

### 1.6 验收

- [ ] `ds-s` 选中：组合卡片可编辑；表格含 4 个型号组合行 + 试验项行
- [ ] 分类节点选中：卡片为说明文案，无操作按钮
- [ ] 型号「未上传」、样品「已上传」：型号组合行筛选「未配置」命中
- [ ] 模版类型 / 是否已配置对两类行均生效

---

## Task 2：版本弹窗与 PageOffice（`template-config.html`）

### 2.1 状态扩展

```javascript
state.configContext = 'test-item' | 'combined';  // openConfig 时设置
state.combinedConfigId = null;
```

### 2.2 `openCombinedConfig(bindType, bindTarget)`

- 设置 context，打开 `#configModal`
- 标题：`组合记录单模版 · {bindLabel}`
- `renderConfigTable()` 分支读写 `RECORD_COMBINED_DATA`
- 保留弹窗内「复制其他项」（源列表含已配置的组合记录）

### 2.3 `clearCombined(id)` / `combinedOps`

- 清除：清空 `file`、`templates`、`configured=false`；不删 bind 行（可选删行或保留空壳，推荐删行）
- 配置：`openPageOffice('record-combined', id)`，未上传时 disabled

### 2.4 PageOffice

- `renderPoDocument('record-combined')`：展示组合模版预览
- `renderPoFields()`：按绑定范围列出全部试验项分组（可复用 `testsForModel` / 样品下聚合）

### 2.5 `renderInfoBar()` 与批注

- 更新 `#infoBar` 文案（完整模式名称，见 spec 2.6）
- 更新 / 新增 PrototypeAnnotation：
  - `record-export-logic`
  - `record-combined-panel`（组合卡片）
  - `record-table`（含模版类型列）

### 2.6 验收

- [ ] 样品层版本上传 → 文件显示 `xxx.docx`，`configured=true`
- [ ] 型号层版本上传覆盖本节点记录
- [ ] 清除后显示「未上传」
- [ ] 版本弹窗内可复制其他组合模版
- [ ] 卡片无「复制 / 恢复继承 / 上传独立模版」按钮

---

## Task 3：导出逻辑（`js/record-export.js`）

### 3.1 模式文案对齐

```javascript
{ key: 'specimen-all', label: '单个样品所有试验生成一份文件', ... },
{ key: 'specimen-each', label: '单个样品单种试验生成一份文件', ... }
```

### 3.2 新增 API

```javascript
function resolveCombinedTemplate(modelTreeKey, combinedData, findSampleAncestorFn) {
  // 1. model 绑定 + configured
  // 2. sample 祖先绑定 + configured
  // 3. null
}

function hasMergeTemplate(modelTreeKey, combinedData, ...) {
  return !!resolveCombinedTemplate(...);
}

function mergeTemplateReady(modelTreeKey, sample, templateIndex, combinedData, ...) {
  var combined = resolveCombinedTemplate(...);
  if (combined) return { ready: true, missing: [] };
  return { ready: missingTemplates(allTests, sample, templateIndex).length === 0,
            missing: missingTemplates(...) };
}
```

### 3.3 修改 `buildRecordFilePreview`

合并类（`split === 'all'`）分支：

```
IF resolveCombinedTemplate → status 仅看试验是否全部完成（模版视为就绪）
ELSE → 现有 missingTemplates 拼接逻辑
```

切分类（`split === 'each'`）分支：**不调用** `resolveCombinedTemplate`，仍用 `hasTemplate`。

### 3.4 导出

```javascript
global.RecordExport.resolveCombinedTemplate = resolveCombinedTemplate;
```

### 3.5 验收

- [ ] PVC-C + 样品有组合、型号无 → 合并类 `ready`（UI 型号仍「未上传」）
- [ ] 无组合 + 缺环刚度单模版 → `missing_template`：`缺少「环刚度」的模版`
- [ ] 切分类模式 + 有组合无单模版 → `missing_template`
- [ ] 切分类 + 单模版齐全 → `ready`

---

## Task 4：导出抽屉（`test-detect-edit.html`）

### 4.1 演示数据

- 传入 `RECORD_COMBINED_DATA`（或与 template-config 同结构的常量）
- 绝缘操作杆场景：样品层组合 / 仅拼接 / 缺模版 各一种

### 4.2 调用更新

```javascript
RecordExport.buildRecordFilePreview(entrust, samples, rules, templateIndex, combinedData, treeHelpers);
```

### 4.3 验收

- [ ] 合并类有组合模版时，缺单试验项模版仍显示就绪
- [ ] 合并类无组合且拼接缺项 → 缺模版
- [ ] 抽屉不展示继承来源文案

---

## Task 5：记录单设置文案对齐（`system-params.html`，可选）

- `RECORD_MODES` 与 `record-export.js` 同步为「单个样品…」
- 列表/弹窗下拉文案一致

### 验收

- [ ] 记录单设置 tab 模式 3/4 显示「单个样品…」

---

## Task 6：文档

- [ ] `2026-07-19-record-combined-template-design.md` 状态 → **已实现（原型）**
- [ ] 本 plan 状态同步

---

## 不在本次实现

- 分类层组合模版上传
- `#recordCopyModal` 独立改造（组合复制走版本弹窗）
- 真实 Word 合并 / 后端 API
- localStorage 跨页同步（各页硬编码 + 注释说明生产环境）

---

## 手动验证清单

1. **模版管理 › 记录单**：样品层上传组合；型号层未上传显示「未上传」；表格筛选  
2. **模版管理 › 记录单**：分类节点见说明卡片；试验项节点见折叠条  
3. **试验检测 › 导出抽屉**：合并类 + 样品组合 → 就绪  
4. **试验检测 › 导出抽屉**：合并类 + 无组合 + 缺试验项模版 → 缺模版  
5. **试验检测 › 导出抽屉**：切分类 + 仅有组合无单模版 → 缺模版  
6. **底部说明条**：完整模式名称，无「模式 1/2/3/4」
