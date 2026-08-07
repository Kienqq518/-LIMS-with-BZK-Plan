# 合格证检测员/记录员/合并位 · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 合格证模版字段池提供「检测员 / 记录员 / 检测员·记录员」三元素，编辑器互斥与展示方式模版内同步，打印选人列由模版配置推导。

**Architecture:** 在现有 `fieldRow` + `fieldId` 模型上扩展三个人员 fieldId；纯逻辑集中在 `LabelCertConfig`（人员判定、互斥、角色需求、人数上限、合并拼接）；渲染与编辑器/打印页消费这些 API。不新增元件类型。

**Tech Stack:** 现有静态原型 — Vanilla JS（`js/label-cert-*.js`）、HTML 页面、`localStorage` 参数覆盖、浏览器手工验收。

**设计依据:** [`../specs/2026-08-07-cert-inspector-recorder-fields-design.md`](../specs/2026-08-07-cert-inspector-recorder-fields-design.md)

---

## File map

| 文件 | 职责 |
|------|------|
| `js/label-cert-config.js` | 字段池、人员 API、互斥、角色需求、上限、合并文本 |
| `js/label-cert-render.js` | 三字段文本/电子签渲染 |
| `js/label-cert-ui.js` | 元件库灰显、展示方式同步、demo 数据 |
| `param-config.html` | `cert.inspector.max` 文案 + 新增 `cert.recorder.max` |
| `label-print.html` | 打印前弹窗按模版显示角色列 |
| `cert-qualified-print.html` | 同上（合格打印入口） |
| `cert-print-batch.html` | 批打表列与载荷含 `recorders` |
| `cert-print-single.html` | 单打载荷含 `recorders` |
| `template-config.html` | 批注文案同步（若有人员相关批注） |

```
Task 1  label-cert-config.js     字段池 + 人员纯函数
Task 2  label-cert-render.js     渲染三字段
Task 3  label-cert-ui.js         编辑器互斥 / 展示同步 / demo
Task 4  param-config.html        参数
Task 5  打印入口 + 批打/单打     按模版推导选人
Task 6  批注 + 手工验收收尾
```

---

### Task 1: `LabelCertConfig` 人员字段 API

**Files:**
- Modify: `js/label-cert-config.js`
- Verify: 浏览器控制台挂载该脚本后调用下列函数

- [ ] **Step 1: 扩展字段池与人员常量**

将 `CERT_FIELD_POOL` 中 `{ id: 'inspectors', label: '检查员' }` 替换为：

```javascript
{ id: 'inspectors', label: '检测员' },
{ id: 'recorders', label: '记录员' },
{ id: 'inspectorsRecorders', label: '检测员/记录员' },
```

新增：

```javascript
var PERSONNEL_FIELD_IDS = ['inspectors', 'recorders', 'inspectorsRecorders'];

function isPersonnelFieldId(fieldId) {
  return PERSONNEL_FIELD_IDS.indexOf(fieldId) >= 0;
}

/** 兼容旧调用：检测员单项或合并位都算「检查员类」展示入口 */
function isInspectorFieldId(fieldId) {
  return isPersonnelFieldId(fieldId);
}
```

注意：`isInspectorFieldId` 扩为全体人员字段，以便现有「展示方式」UI 入口自动覆盖三元素；新增代码优先调用 `isPersonnelFieldId`。

- [ ] **Step 2: 互斥与角色需求**

```javascript
function usedPersonnelFieldIds(elements) {
  return usedFieldIds(elements).filter(isPersonnelFieldId);
}

/**
 * 元件库是否禁用某人员 fieldId
 * @returns {boolean} true=禁用
 */
function isPersonnelFieldBlocked(usedPersonnelIds, candidateId) {
  var used = usedPersonnelIds || [];
  if (used.indexOf(candidateId) >= 0) return false; // 已占用项本身可点移除，不在此禁用
  var hasCombined = used.indexOf('inspectorsRecorders') >= 0;
  var hasSingle = used.indexOf('inspectors') >= 0 || used.indexOf('recorders') >= 0;
  if (candidateId === 'inspectorsRecorders') return hasSingle;
  if (candidateId === 'inspectors' || candidateId === 'recorders') return hasCombined;
  return false;
}

/**
 * 由模版 elements 推导打印所需角色
 * @returns {{ needInspectors: boolean, needRecorders: boolean }}
 */
function personnelRolesNeeded(elements) {
  var used = usedPersonnelFieldIds(elements);
  var needInspectors = used.indexOf('inspectors') >= 0 || used.indexOf('inspectorsRecorders') >= 0;
  var needRecorders = used.indexOf('recorders') >= 0 || used.indexOf('inspectorsRecorders') >= 0;
  return { needInspectors: needInspectors, needRecorders: needRecorders };
}
```

- [ ] **Step 3: 人数上限与合并文本**

```javascript
function getRecorderMax() {
  try {
    var raw = localStorage.getItem('lims.paramOverrides');
    if (raw) {
      var map = JSON.parse(raw);
      if (map['cert.recorder.max']) return Math.max(1, parseInt(map['cert.recorder.max'], 10) || 1);
    }
  } catch (e) { /* ignore */ }
  return 1;
}

/**
 * 合并位姓名文本：先检测员后记录员；角色内「、」；角色间「 、」
 */
function formatInspectorsRecordersText(inspectors, recorders) {
  function joinNames(arr) {
    return (arr || []).map(function (n) { return String(n || '').trim(); }).filter(Boolean).join('、');
  }
  var a = joinNames(inspectors);
  var b = joinNames(recorders);
  if (a && b) return a + ' 、' + b;
  return a || b || '';
}

function personnelNameList(arr, fallback) {
  if (Array.isArray(arr) && arr.length) {
    return arr.map(function (n) { return String(n || '').trim(); }).filter(Boolean);
  }
  if (arr == null || arr === '') return fallback ? [fallback] : [];
  return String(arr).split(/[、,，]/).map(function (n) { return n.trim(); }).filter(Boolean);
}

/** 电子签顺序：先全部检测员，再全部记录员 */
function combinedPersonnelNames(data, opts) {
  opts = opts || {};
  var insp = personnelNameList(data && data.inspectors, opts.previewFallback ? '签名占位' : '');
  var rec = personnelNameList(data && data.recorders, opts.previewFallback ? '签名占位' : '');
  // 预览：若两侧都空则给一个占位；打印侧由门禁保证非空
  if (opts.previewFallback && !insp.length && !rec.length) return ['签名占位'];
  return insp.concat(rec);
}
```

在 `defaultProps` / `normalizeElement` 中：凡 `isPersonnelFieldId(fid)` 均保留 `inspectorDisplay`（与现 `isInspectorFieldId` 分支相同）。

- [ ] **Step 4: 导出到 `global.LabelCertConfig`**

增加导出：`PERSONNEL_FIELD_IDS`、`isPersonnelFieldId`、`usedPersonnelFieldIds`、`isPersonnelFieldBlocked`、`personnelRolesNeeded`、`getRecorderMax`、`formatInspectorsRecordersText`、`personnelNameList`、`combinedPersonnelNames`。保留 `isInspectorFieldId`（已扩为人员字段）。

- [ ] **Step 5: 控制台冒烟**

在任意已引入 `label-cert-config.js` 的页面 Console：

```javascript
LabelCertConfig.isPersonnelFieldBlocked(['inspectorsRecorders'], 'inspectors') === true
LabelCertConfig.isPersonnelFieldBlocked(['inspectors'], 'inspectorsRecorders') === true
LabelCertConfig.isPersonnelFieldBlocked(['inspectors'], 'recorders') === false
LabelCertConfig.personnelRolesNeeded([{type:'fieldRow',props:{fieldId:'inspectorsRecorders'}}])
// → { needInspectors: true, needRecorders: true }
LabelCertConfig.formatInspectorsRecordersText(['张三','李四'], ['王五']) === '张三、李四 、王五'
LabelCertConfig.getRecorderMax() === 1
```

Expected: 全部为 `true` / 符合注释。

- [ ] **Step 6: Commit**

```bash
git add js/label-cert-config.js
git commit -m "$(cat <<'EOF'
feat(label-cert): 合格证人员字段池与互斥/角色 API

新增检测员、记录员、合并位 fieldId，以及打印角色推导与合并文本辅助函数。
EOF
)"
```

---

### Task 2: 渲染三人员字段

**Files:**
- Modify: `js/label-cert-render.js`

- [ ] **Step 1: 扩展 `fieldValue`**

```javascript
case 'inspectors':
  return Array.isArray(data.inspectors) ? data.inspectors.join('、') : (data.inspectors || '');
case 'recorders':
  return Array.isArray(data.recorders) ? data.recorders.join('、') : (data.recorders || '');
case 'inspectorsRecorders':
  if (global.LabelCertConfig && LabelCertConfig.formatInspectorsRecordersText) {
    return LabelCertConfig.formatInspectorsRecordersText(data.inspectors, data.recorders);
  }
  return '';
```

- [ ] **Step 2: 改写 `renderFieldRow` 电子签分支**

将 `isEsign` 判定改为人员字段通用：

```javascript
var isPersonnel = global.LabelCertConfig && LabelCertConfig.isPersonnelFieldId
  ? LabelCertConfig.isPersonnelFieldId(p.fieldId)
  : (p.fieldId === 'inspectors' || p.fieldId === 'recorders' || p.fieldId === 'inspectorsRecorders');
var isEsign = isPersonnel &&
  ((global.LabelCertConfig && LabelCertConfig.normalizeInspectorDisplay)
    ? LabelCertConfig.normalizeInspectorDisplay(p.inspectorDisplay) === 'esign'
    : p.inspectorDisplay === 'esign');
```

电子签取名：

```javascript
var names;
if (p.fieldId === 'recorders') {
  names = (LabelCertConfig.personnelNameList || function (a) {
    return Array.isArray(a) ? a : [];
  })(data && data.recorders, '签名占位');
} else if (p.fieldId === 'inspectorsRecorders') {
  names = LabelCertConfig.combinedPersonnelNames(data, { previewFallback: true });
} else {
  names = (LabelCertConfig.personnelNameList || inspectorNameList)(data && data.inspectors, '签名占位');
  if (!names.length) names = ['签名占位'];
}
```

文本模式走现有 `displayFieldValue`（已含合并拼接）。

- [ ] **Step 3: 浏览器验收**

打开 `template-config.html?type=labelCert`，编辑合格证模版，临时在 Console：

```javascript
// 假设已有 draft 含 inspectorsRecorders
// 刷新预览后画布应显示：张三、李四 、王五（待 Task 3 补 demo recorders）
```

本 Task 可先用打印页或临时 `LabelCertRender.render(...)` 自测；若 demo 尚无 `recorders`，先传：

```javascript
{ inspectors: ['张三','李四'], recorders: ['王五'] }
```

Expected: 文本合并正确；`inspectorDisplay:'esign'` 时三枚签名依次排列、无顿号。

- [ ] **Step 4: Commit**

```bash
git add js/label-cert-render.js
git commit -m "$(cat <<'EOF'
feat(label-cert): 渲染检测员/记录员/合并位文本与电子签
EOF
)"
```

---

### Task 3: 编辑器互斥、展示同步、demo

**Files:**
- Modify: `js/label-cert-ui.js`

- [ ] **Step 1: `renderPalette` 人员字段灰显**

在 `fields = pool.map(...)` 中，对人员字段应用互斥：

```javascript
var usedPersonnel = LabelCertConfig.usedPersonnelFieldIds(state.draft.elements);
var fields = pool.map(function (f) {
  var on = usedFields.indexOf(f.id) >= 0;
  var blocked = LabelCertConfig.isPersonnelFieldId(f.id) &&
    !on &&
    LabelCertConfig.isPersonnelFieldBlocked(usedPersonnel, f.id);
  var tip = blocked
    ? (f.id === 'inspectorsRecorders'
      ? '已添加检测员或记录员，不能再添加合并位'
      : '已添加「检测员/记录员」合并位，不能再单独添加')
    : (on ? '再次点击移除' : '点击添加到画布');
  return '<button type="button" class="lc-pal-item' + (on ? ' on' : '') + (blocked ? ' opacity-40 cursor-not-allowed' : '') +
    '" data-lc-add="fieldRow" data-field="' + f.id + '"' +
    (blocked ? ' disabled' : '') +
    ' title="' + LabelCertRender.esc(tip) + '">' +
    LabelCertRender.esc(f.label) + '</button>';
}).join('');
```

若现有点击逻辑忽略 `disabled`，在 add 处理器开头加：

```javascript
if (fieldId && LabelCertConfig.isPersonnelFieldId(fieldId)) {
  var usedP = LabelCertConfig.usedPersonnelFieldIds(state.draft.elements);
  if (usedFields.indexOf(fieldId) < 0 && LabelCertConfig.isPersonnelFieldBlocked(usedP, fieldId)) {
    return;
  }
}
```

- [ ] **Step 2: 展示方式同步**

在 `applyContentFromInputs` 末尾，当当前元素是人员字段且改了 `inspectorDisplay` 时：

```javascript
if (el.type === 'fieldRow' && LabelCertConfig.isPersonnelFieldId(el.props.fieldId)) {
  var mode = LabelCertConfig.normalizeInspectorDisplay(el.props.inspectorDisplay);
  el.props.inspectorDisplay = mode;
  if (mode === 'esign') el.props.underline = 'none';
  (state.draft.elements || []).forEach(function (other) {
    if (other === el) return;
    if (other.type !== 'fieldRow' || !LabelCertConfig.isPersonnelFieldId(other.props && other.props.fieldId)) return;
    other.props.inspectorDisplay = mode;
    if (mode === 'esign') other.props.underline = 'none';
  });
}
```

内容面板提示文案：将「各检测员」改为「各人员」；姓名文本说明可写「检测员与记录员按模版字段分别或合并展示」。

- [ ] **Step 3: `demoData` 增加 recorders**

```javascript
inspectors: ['张三', '李四'],
recorders: ['王五'],
```

- [ ] **Step 4: 手工验收（模版编辑器）**

1. 打开合格证自由设计 → 业务字段可见「检测员」「记录员」「检测员/记录员」。
2. 添加合并位 → 两单项禁用；预览 `检测员/记录员：张三、李四 、王五`。
3. 删合并位，添加检测员+记录员 → 合并位禁用；两行分别显示。
4. 任一人员字段改「电子签名」→ 另一人员字段同步为电子签，下划线锁「无」。

- [ ] **Step 5: Commit**

```bash
git add js/label-cert-ui.js
git commit -m "$(cat <<'EOF'
feat(label-cert): 编辑器人员字段互斥与展示方式模版内同步
EOF
)"
```

---

### Task 4: 系统参数

**Files:**
- Modify: `param-config.html`

- [ ] **Step 1: 调整 / 新增参数行**

将 id 15 改为：

```javascript
{ id: 15, name: '合格证检测员上限', key: 'cert.inspector.max', value: '2', type: 'Y', remark: '打印合格证时最多可选检测员数', time: '2026-07-31 09:00:00' },
```

在其后插入（注意勿与现有 id 16/17/18 冲突，用新 id 19）：

```javascript
{ id: 19, name: '合格证记录员上限', key: 'cert.recorder.max', value: '1', type: 'Y', remark: '打印合格证时最多可选记录员数', time: '2026-08-07 09:00:00' },
```

- [ ] **Step 2: 验收**

打开参数配置页，能看到两项；改 `cert.recorder.max` 为 `2` 并写入 `lims.paramOverrides` 后，`LabelCertConfig.getRecorderMax()` 返回 2。

- [ ] **Step 3: Commit**

```bash
git add param-config.html
git commit -m "$(cat <<'EOF'
feat(system-params): 合格证记录员上限参数 cert.recorder.max
EOF
)"
```

---

### Task 5: 打印选人与批打/单打

**Files:**
- Modify: `label-print.html`
- Modify: `cert-qualified-print.html`
- Modify: `cert-print-batch.html`
- Modify: `cert-print-single.html`（若存在 inspectors 查询参数）

- [ ] **Step 1: 共享推导逻辑（各页内联或抽小函数）**

打印前先 `resolveTemplate` 得到模版，再：

```javascript
var roles = LabelCertConfig.personnelRolesNeeded(tpl.elements || []);
var MAX_INSPECTORS = LabelCertConfig.getInspectorMax();
var MAX_RECORDERS = LabelCertConfig.getRecorderMax();
```

- [ ] **Step 2: 改造选人弹窗 DOM**

`label-print.html` / `cert-qualified-print.html` 弹窗结构改为两行（按需显示）：

```html
<div id="inspectorRow" class="flex items-start gap-3">
  <label class="w-[72px] ...">检测员</label>
  <div id="inspectorSelectHost" class="flex-1"></div>
</div>
<div id="recorderRow" class="flex items-start gap-3 mt-2 hidden">
  <label class="w-[72px] ...">记录员</label>
  <div id="recorderSelectHost" class="flex-1"></div>
</div>
<p id="personnelTip" class="mt-2 pl-[84px] text-xs text-slate-400"></p>
```

打开弹窗前根据 `roles`：

- `needInspectors` → 显示 `inspectorRow`，绑定 `InspectorSelect`，`maxCount: MAX_INSPECTORS`
- `needRecorders` → 显示 `recorderRow`，同样复用 `InspectorSelect`（或同组件换 host），`maxCount: MAX_RECORDERS`
- 两者皆 false → 不弹窗，直接 `goPrint`

文案：`最多选择 N 名检测员` / `最多选择 M 名记录员`（可拼在 tip 里）。

校验：

```javascript
if (roles.needInspectors && !modalInspectors.length) { alert('请至少选择 1 名检测员'); return; }
if (roles.needRecorders && !modalRecorders.length) { alert('请至少选择 1 名记录员'); return; }
```

- [ ] **Step 3: localStorage 分 key**

```javascript
var STORAGE_INSPECTORS = 'lims_label_print_last_inspectors';
var STORAGE_RECORDERS = 'lims_label_print_last_recorders';
```

记忆/恢复逻辑与现有一致；首次仍强制弹窗（可沿用 `STORAGE_INIT` 或按角色分别 init）。

- [ ] **Step 4: URL 载荷**

```javascript
function goPrint(inspectors, recorders) {
  var q = 'nos=' + encodeURIComponent(pendingNos.join(',')) +
    '&inspectors=' + encodeURIComponent((inspectors || []).join(',')) +
    '&recorders=' + encodeURIComponent((recorders || []).join(',')) +
    '&from=qualified'; // 按页面调整
  location.href = 'cert-print-batch.html?' + q; // 或 single
}
```

`label-print.html` 的 `goSingleCert` / `goBatchCert` 同步加 `recorders`。

- [ ] **Step 5: `cert-print-batch.html`**

```javascript
var MAX_RECORDERS = LabelCertConfig.getRecorderMax();
var defaultRecorders = (params.get('recorders') || '').split(',').filter(Boolean).slice(0, MAX_RECORDERS);
// pushSample 时：
recorders: defaultRecorders.slice(),
```

列表列：根据**当前页第一条（或每行自己的）模版** `personnelRolesNeeded` 决定是否渲染「检测员」「记录员」列；原型可按每行 `resolveTemplate` 后取 roles（批量样品若模版不一致，以该行模版为准）。

行内 `InspectorSelect`：检测员 `maxCount: MAX_INSPECTORS`；记录员 `maxCount: MAX_RECORDERS`。

`buildCertHtml` 传入：

```javascript
inspectors: item.inspectors,
recorders: item.recorders || [],
```

- [ ] **Step 6: `cert-print-single.html`**

同样解析 `recorders` query，并传入渲染 data。

- [ ] **Step 7: 手工验收**

| 模版配置 | 期望 |
|----------|------|
| 仅检测员 | 弹窗只有检测员；URL 可无 recorders |
| 仅记录员 | 弹窗只有记录员；须选 ≥1 记录员 |
| 合并位或两单项 | 两列都出现；上限 2 / 1 |
| 无人人员字段 | 不弹窗，直接打印 |

批打预览：合并位文本 `张三、李四 、王五`；电子签三枚无顿号。

- [ ] **Step 8: Commit**

```bash
git add label-print.html cert-qualified-print.html cert-print-batch.html cert-print-single.html
git commit -m "$(cat <<'EOF'
feat(label-cert): 打印选人列按模版检测员/记录员配置推导
EOF
)"
```

---

### Task 6: 批注与收尾

**Files:**
- Modify: `template-config.html`（人员相关 annotation 文案）
- Modify: `label-print.html` / `cert-qualified-print.html` 内嵌批注（若有「检验人员」字样）
- Modify: `docs/superpowers/specs/2026-08-07-cert-inspector-recorder-fields-design.md`（状态改为「原型已实现」——仅改状态行）

- [ ] **Step 1: 批注文案**

将「检查员」「检验人员」相关说明更新为：

- 字段池三项与互斥规则
- 展示方式模版内同步
- 打印列取决于模版是否配置对应人员字段

- [ ] **Step 2: 对照 spec §7 验收清单逐条勾选**

走完设计文档第 7 节 8 条；任一条失败则回到对应 Task 修复。

- [ ] **Step 3: Commit**

```bash
git add template-config.html label-print.html cert-qualified-print.html \
  docs/superpowers/specs/2026-08-07-cert-inspector-recorder-fields-design.md
git commit -m "$(cat <<'EOF'
docs(label-cert): 同步检测员/记录员批注并标记设计已落地
EOF
)"
```

---

## Spec coverage checklist

| Spec 要求 | Task |
|-----------|------|
| 字段池三元素 + 默认显示名 | Task 1 |
| `cert.inspector.max` / `cert.recorder.max` | Task 1 + 4 |
| 编辑器互斥 | Task 1 API + Task 3 UI |
| 展示方式模版内同步 | Task 3 |
| 合并文本 / 电子签顺序 | Task 1 + 2 |
| demo 数据 | Task 3 |
| 打印列由模版推导 | Task 5 |
| 记忆分 key、URL `recorders` | Task 5 |
| 批打行列 | Task 5 |
| 兼容旧 `inspectors` | Task 1（保留 fieldId） |
| 门禁不变 | 不改 `flow-stages.js` |
| 批注 / 验收 | Task 6 |

## Self-review notes

- 无 TBD；函数名前后一致：`isPersonnelFieldBlocked`、`personnelRolesNeeded`、`formatInspectorsRecordersText`。
- `isInspectorFieldId` 刻意扩为全体人员字段，避免遗漏旧 UI 分支；新代码用 `isPersonnelFieldId`。
- 本仓库无单元测试框架，Task 1 用 Console 断言，其余用页面手工验收。
