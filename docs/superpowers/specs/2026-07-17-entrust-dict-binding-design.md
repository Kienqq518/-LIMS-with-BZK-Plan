# 委托信息字段与字典绑定设计

**日期**: 2026-07-17  
**范围**: 委托信息设置页下拉字段与字典管理绑定，别名同步字典名称，委托登记表单动态加载字典选项  
**状态**: 已实现（原型）

## 背景与目标

「业务流程配置 › 委托信息设置」允许用户勾选启用字段、修改字段别名。委托登记/编辑页存在多类下拉字段（任务类型、优先等级、付款方式等），其选项应由字典管理维护。

业务诉求：

- 仅下拉类型字段可绑定字典；绑定关系一对一
- 字段别名为主数据源；保存设置时自动同步关联字典的「字典名称」
- 可解绑；解绑后字典名称保留，不再随别名同步
- 委托登记表单按配置显隐字段、显示别名，并从已绑定字典加载下拉选项
- 字典管理新增 LIMS 业务字典 mock，形成端到端演示闭环

## 已确认决策

| 议题 | 决策 |
|------|------|
| 绑定方式 | 从字典管理已有字典中选择 |
| 字段更名 | `detectNature` 标签由「检测性质」改为「检测类别」 |
| 名称同步 | 保存时别名自动覆盖字典名称 |
| 绑定关系 | 一对一；已占用字典在弹窗置灰 |
| 解绑 | 允许；解绑后字典名保留、不再同步 |
| 实现范围 | 设置页 + 字典页 + 登记表单完整闭环 |

## 架构

### 模块

| 文件 | 职责 |
|------|------|
| `js/mock-dict.js` | LIMS + 系统字典 mock 数据；localStorage 读写 |
| `js/entrust-field-config.js` | 字段配置、绑定状态、表单映射；localStorage 读写 |
| `system-params.html` | 绑定 UI、别名编辑、保存同步 |
| `dict-mgmt.html` | 共用字典数据；反映名称变更 |
| `entrust-create.html` | 按配置显隐、别名、动态下拉 |

### 数据流

```
委托信息设置 ──保存──► localStorage ◄──读写── 字典管理
                              │
                              └──只读── 委托登记
```

## 数据模型

### 字段配置 (`FIELD_SECTIONS.fields[]`)

| 属性 | 说明 |
|------|------|
| `id` | 稳定键 |
| `label` | 系统原始标签（左侧，不可改） |
| `placeholder` | 别名（可编辑，主数据源） |
| `fieldType` | `text` 或 `select` |
| `dictType` | 绑定字典 type；`null` 未绑定 |
| `checked` / `locked` | 沿用现有语义 |

### 字典 (`dictTypes[]`)

沿用 RuoYi 风格：`name`（字典名称）、`type`（稳定键）、`items[]`（`label`/`value`/`sort`/`status`）。

## 可绑定字段（9 个）

| id | 系统标签 | dictType | 表单 id |
|----|----------|----------|---------|
| taskType | 任务类型 | lims_task_type | f_taskType |
| priority | 优先等级 | lims_priority | f_priority |
| detectType | 检测类型 | lims_detect_type | f_testType |
| detectNature | 检测类别 | lims_detect_category | f_testCategory |
| payMethod | 付款方式 | lims_pay_method | f_payMethod |
| reportDelivery | 报告交付方式 | lims_report_delivery | f_reportDelivery |
| reportQual | 报告资质 | lims_report_qual | f_reportQual |
| reportDesc | 报告说明 | lims_report_desc | f_reportDesc |
| resultFormat | 结果格式 | lims_result_format | f_resultType |

主数据下拉（客户单位、业务员、合同编号等）不参与绑定。

默认预绑定上述 9 个 LIMS 字典。

## UI：委托信息设置

栅格单元：

```
[系统标签] [别名输入] [⚙️] [checkbox]
                 已绑: xxx（灰色小字，仅已绑定时）
```

- 仅 `fieldType: 'select'` 显示齿轮图标
- 点击齿轮打开弹窗：搜索框 + 字典列表 + 确认/取消/解除绑定
- 已被其他字段占用的字典置灰，标注「已绑定: 字段名」

## 保存逻辑

1. 校验别名非空
2. 对每个 `dictType != null` 的字段：更新对应字典 `name = placeholder`
3. 写入 localStorage（字段配置 + 字典数据）
4. 提示成功

## 解绑逻辑

弹窗「解除绑定」→ 清空 `dictType`；字典 `name` 不变；后续保存不再同步该字典。

## 委托登记表单

加载时：

1. 按 `checked` 控制 `.form-item` 显隐
2. 标签文字替换为别名（`placeholder`）
3. 已绑定字典的下拉：从 `items`（status=正常）渲染 `<option>`

未绑定字典的下拉保留页面内硬编码选项。

## 字典管理

从 `js/mock-dict.js` 加载；含 9 条 LIMS 业务字典及原有系统字典。CRUD 写回 localStorage。

## 边界处理

| 场景 | 处理 |
|------|------|
| 绑定字典被删 | 设置页提示失效；表单降级空下拉 |
| 字典无 items | 仅「请选择」 |
| 别名为空 | 阻止保存 |
| 恢复默认 | 重置别名、绑定、字典名为初始值 |

## 演示验收

1. 设置页 9 个下拉字段显示绑定状态
2. 改别名保存 → 字典管理名称同步
3. 委托编辑标签与下拉选项来自字典
4. 解绑后别名改动不再影响字典名
5. 取消勾选 → 委托编辑隐藏字段
