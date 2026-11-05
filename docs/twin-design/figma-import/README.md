# 数字孪生关键页面 · Figma 原型交付包

日期：2026-11-05 ｜ 视觉基准：根目录《视觉语言提取 V1.md》 + `docs/twin-design/design-tokens.ts` ｜ 范围基准：`PRD-v1.md`（S1/S2/S3）

## 1. 四张关键页面

| # | 页面 | 对应场景 | 文件 |
|---|---|---|---|
| 01 | 实验室总览 | S1 | `01-overview.html` / `01-overview.png` |
| 02 | 106 无人化电缆试验区重点监控 | S2 | `02-zone-106.html` / `02-zone-106.png` |
| 03 | 设备详情弹层 | S1/S2 通用浮层 | `03-device-detail.html` / `03-device-detail.png` |
| 04 | 告警回溯（近 24h） | S3 | `04-alarm-review.html` / `04-alarm-review.png` |

`preview-4pages.png` 为四页合览图。四页均为 **1920×1080 自包含 HTML**（内联 CSS + 内联 SVG，无外部依赖、无运行时脚本），即 `html_to_figma` 的直接输入。
`gen_*.py` 为生成器（房间/设备轮廓直接读 `twin/future-lab/cad_geometry.json` 与 `visual_106.json`），改数据或改文案后重跑即可再生成。

> 说明：需求列了 3 张页面但要求「4 张关键页面」，第 4 张按 `PRD-v1.md` 的 S3「异常/告警回溯」补齐；若要换成设备列表/任务看板，改 `gen_p4.py` 重新生成即可。

## 2. 与视觉语言的对应

- **色彩**：品牌蓝 #2878FF、告警红 #E5484D、瓶颈橙 #F76B15、预警琥珀 #F59E0B、正常绿 #16A34A、地面引导线 #E8D77A、文字 #0F2740/#5B6B7D/#8A97A7、白卡 + `0 14px 40px rgba(15,40,80,.14)`、圆角 14–16。
- **版式**：顶部导航（总览/设备/任务/系统/告警）+ 主画面轴测 + 右侧指标栏 + 底部任务/告警流；5M1E 胶囊在场景右上；机位与来源胶囊在场景右下。
- **三维**：正交轴测（俯视 30°），10 个区域按真实房间轮廓与 `rotatedBBox` 设备轮廓绘制；S2 为 106 专属机位，相邻区域淡化出画。
- **交互元素**：告警设备 2px 描边 + 8% 填充 + 贴地色块；Beats 卡（26px 数字 + 迷你波形 + 锚定引线）；Grade 胶囊 + 引线；机器人蓝色光晕 + 白底胶囊；P 目标点绿色水滴；AMR 路径浅蓝垫底 + 蓝虚线流动。
- **诚实降级**：Beats 卡 valid / stale / missing / offline 四态；LIMS 深链为灰态「二期接入」，不伪造数据。

## 3. 数据口径（全部取自仓库现有 mock，未杜撰）

- 10 个房间名：`twin/mock/scene-data.js` ROOM_NAMES（101 接待大厅 … 110 数智化电气试验区）。
- 106 设备清单：`twin/future-lab/visual_106.json` + `equipment_inventory.csv`。
- 对象字段：《数字孪生对象模型与数据字典 V1.md》——Task.source=LIMS/WORKSTATION、deviceChain 四工位链路、DAQ-SUB 与检测设备 1:1、E9 上下料握手、Grade A→主任台+App / B→工位屏 / C→运维队列。

## 4. Figma 文件（两个）

**当前主文件（数字孪生 team）**：未来实验室数字孪生 · 关键页面原型 V1 — https://www.figma.com/design/vVKMD1ut298dww1CSUOPkb
页面 `01 · 关键页面原型` 内 4 个 1920×1080 frame（S1 总览 / S2 106 重点区 / 设备详情弹层 / S3 告警回溯），由本目录 HTML 经 `html_to_figma` 导入，已接好原型：

| 连线 | 触发 | 动作 |
|---|---|---|
| S1 区域卡「106 无人化电缆试验区」 | click | Navigate → S2（Smart Animate 300ms） |
| S1 区域告警行 / 导航「告警」 | click | Navigate → S3 告警回溯 |
| 导航「设备」 | click | Navigate → S2 |
| S2 andon 卡 / 设备状态条 / 任务号 | click | **Open overlay** → 设备详情弹层（Dissolve 250ms） |
| 弹层 ✕ / 关闭 | click | Back（回来源页，状态回落数据源） |
| S3 列表项 / 关联任务 / 查看原始记录 | click | Open overlay → 设备详情弹层 |
| 5M1E 胶囊（S1、S2） | click 任一维度 | **Change to** `维度=…` 变体（5 变体交互组件） |
| 底部「今日任务 / 告警流」 | click | Change to `页签=…` 变体 |
| 弹层「运行 / 告警 / 离线 / 维护」 | click | Change to `状态=…` 变体（4 变体） |

交互组件集：`Nav/5M1E`、`Nav/5M1E · S2`、`Segment/底部页签`、`Segment/弹层状态`（组件集放在画布外 x=-4200，实例已回原位）。
注：`Change to` 指向自身变体时 Figma 拒绝建连线（点当前已选中的胶囊无反应，符合预期）。

**已知瑕疵（1 次调用可修）**：S1 底部「今日任务 / 告警流」页签实例与表格表头重叠——原分组被隐藏后，卡片的 auto-layout 把表格上移了。修法：把实例插回原索引并交还给自动布局，再删掉隐藏的源分组：

```js
const inst=await figma.getNodeByIdAsync('10:190'), src=await figma.getNodeByIdAsync('1:562'), parent=src.parent;
inst.layoutPositioning='AUTO'; parent.insertChild(parent.children.indexOf(src),inst); src.remove();
```

其余三处实例（S1/S2 的 5M1E、弹层状态分段）父级为绝对定位，未受影响，位置已核对正确。HTML 源文件本身无此问题。

---

## 4b. 旧文件（个人 team，Starter 额度已用尽）

文件：**未来实验室数字孪生 · 关键页面原型 V1** — https://www.figma.com/design/KTfYjgOvvFcBopH15m0UV1

已完成（页面 `02 · 组件与令牌`）：

- **Twin Tokens 变量集合**：31 色 + 12 间距/圆角 + 自动派生的透明度色（如 `alert/red-a10`），值全部来自 `design-tokens.ts`。
- **13 个文字样式** + **3 个效果样式**（card / pill / modal 阴影）。
- **组件与变体**：`Nav/Top Bar`（页面=总览/设备/任务/系统/告警）、`Nav/Tab Item`、`Nav/5M1E`（维度=Man…Environment）、`Chip`（6 变体）、`Tag/Grade`、`Tag/Grade-Ground`（A/B/C 贴地标记）、`Tag/Zone`（正常/告警/聚焦）、`Tag/Robot`、`Tag/P-Point`、`Button`（主/幽灵/危险/次级）、`Status/Device`（6 态）、`Segment/时间范围`、`Card/KPI`（↑↓—）、`Card/Beats`（valid/stale/missing/offline）、`Card/Andon`（A/B/C）、`Panel`。

**未完成**：四个页面 frame 与原型连线（状态切换）。原因：Figma MCP 在 Starter 计划下每月 20 次调用额度已用尽，读写均被拒。

## 5b. 线上访问（Vercel）

四页已部署：入口 **https://lims-with-bzk-plan.vercel.app/proto/** （启动页含四页实时缩略图）。

- `proto/index.html` 启动页 ｜ `proto/01-overview.html` ｜ `proto/02-zone-106.html` ｜ `proto/03-device-detail.html` ｜ `proto/04-alarm-review.html`
- 画布固定 1920×1080，小屏自动等比缩放；追加 `?fit=0` 看原始尺寸（Figma 导入/导出原图用这个）。
- 同步方式：改完 `gen_*.py` 后跑 `./build.sh`（重新生成并拷到 `proto/`），或直接改 `proto/*.html`。push 到 `main` 即触发 Vercel 构建。

## 6. 现在直接在 HTML 上改设计（交互已内建）

四页已经做成**可点击的浏览器原型**，不依赖 Figma。双击 `01-overview.html` 即可，页面间跳转用相对路径，`file://` 下直接可用。

**交互钩子（改结构时保留这些属性就还能点）**

| 钩子 | 作用 |
|---|---|
| `data-goto="overview\|zone106\|device\|alarm"` | 跳到对应页面 |
| `data-back` | 返回上一页（弹层 ✕ / 关闭） |
| `data-todo="提示文案"` | 本期未覆盖入口 → 底部轻提示，不留死链 |
| `data-switch` | 容器：内部互斥选中（分段控件、胶囊组、筛选） |
| `data-view` + `data-panel-view` | 同页内容切换（S1 今日任务 / 告警流） |
| `data-sel` + `data-grade/value/unit/limit/window/time` | S4 列表项选中并联动回放面板 |
| `data-state` / `body[data-devstate]` | 弹层设备状态 running·alarm·offline·maintain（曲线与数采文案随之降级） |
| `data-dim` / `data-desc` | 5M1E 维度切换 → 更新「叠加层：…」说明 |
| `data-span` | 时间范围切换 → 更新曲线窗口说明 |
| `data-role="…"` | 被脚本写入的锚点：`replay-title/grade/val/unit/label/sub/time/window`、`dev-dot/dev-status/chart/chart-src/daq-heart/range-note/dim-hint` |

交互层集中在 `proto_layer.py`（`PROTO` 样式 + `JS` 行为 + `HOOKS` 注释），生成时注入每页 `<head>`/`<body>` 尾部，四页共用一份逻辑。

**已验证（17 项自动化点击用例全通过）**：`test_harness.html` 用三个 iframe 分别跑 S1 / 弹层 / S4，覆盖 5M1E 切换、今日任务↔告警流、未覆盖入口提示、区域卡跳转、弹层四态降级、时间范围说明、列表选中联动回放数值/Grade/时间轴、跨页跳转。复跑：

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --allow-file-access-from-files --virtual-time-budget=9000 --dump-dom \
  "file://$(pwd)/test_harness.html" | grep -o 'PASS\|FAIL' | sort | uniq -c
```

**注意**：`gen_*.py` 是这四页 HTML 的上游。你若直接改 HTML，别重跑 `gen_p1.py` 等脚本（会被覆盖）；改完把 HTML 丢回给我，我把变更同步回生成器即可。


## 5. 额度恢复后的收尾（约 6–8 次调用）

1. 四份 HTML 依次 `html_to_figma` 导入到页面 `01 · 关键页面`。
2. （可选）用已建组件替换导入产物中的等价件。
3. 写原型连线：区域块点击 → S2；设备块/状态芯片点击 → 设备详情 OVERLAY；导航 tab → 对应页面；底部「今日任务 / 告警流」、5M1E、时间范围分段 → `CHANGE_TO` 变体切换。
4. 截图复核 + 交付链接。
