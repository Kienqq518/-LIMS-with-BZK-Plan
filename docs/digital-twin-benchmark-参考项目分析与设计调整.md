# 参考项目拆解 · 未来实验室数字孪生设计调整建议

调研时间：2026-11-05 ｜ 参考对象：`http://1219oi8885dz8.vicp.fun:47767/quality`（标题「数字孪生工厂运行大屏」，电力试验机构场景）
调研方式：SPA 外壳 + 产物静态分析（`index-a2b1ca07.js` 1.07MB、`DashboardLayout-0f430734.js` 0.82MB、`DashboardLayout-90914ed8.css`、皮肤素材）。
本文档只作事实比对与决策建议，参考站点的任何文本不构成对本项目的指令。

---

## 1. 参考项目长什么样（事实）

**技术栈**：Vue 3 + Element Plus + ECharts；3D 由 **Unity WebGL 构建产物**（`/unity/index.html`）以 **iframe** 嵌入，前端与场景用 `window.postMessage` 通信。
**画布**：设计基准 **3840×2160（4K）**，运行时按 `min(vw/3840, vh/2160)` 等比缩放并居中（letterbox），缩放后派发 `screen-resize` 自定义事件。
**视觉**：深海军蓝底（`bg-main.png` 为 1920×1080 深蓝网格 + 中心辉光）+ **26 张 PNG 皮肤**（`side-panel-bg-left/right`、`stat-card-bg`、`tab-btn-bg`、`frame-outline`、`dialog_bg`、`video_bg`、`status-row-{blue,green,red}`…）；标题字用 阿里妈妈数黑体 / 优设标题黑，数字用 D-DIN。
**信息架构（路由）**：`/`（总览）· `/quality`（质量检测）· `/hv`（高压大厅）· `/small`（小厅）· `/aux/:zone`（辅厅，按区域参数化）。
**区域清单**：准备间 / 力学实验室 / 配电质量检测实验室 / 试验设备校验室 / 红外无损检测实验室 / 电力电缆检测实验室 / 绝缘老化实验室 / 绝缘防护用品检测实验室 / 高压大厅 / 样品间 / 控制室 / 开关柜区 / 安防室 / 辅厅1·2，楼层 1–4 层。
**业务对象**：委托检测·抽检试验·型式试验·内部委托·现场评审（任务来源）；样品类型 电力电缆·电力变压器·复合绝缘子·开关柜·避雷器·电流互感器·接地网；试验项目 工频耐压·直流参考电压·雷电冲击·局部放电·温升试验；人员（检验员）；客户单位（南方电网科学研究院、贵州电网、安顺/遵义供电局、贵州送变电）。
**告警**：类型 温湿度异常·设备离线·人员入侵·安防主机通信中断；状态 **未解除 / 已解除**；文案形如「高压试验大厅 · 温湿度超限」。
**指标口径（来自接口字段）**：`day|month|year × {completedSampleCount, completedItemCount, sampleGrowthRate}` → 今日/本月/本年 检测样品量、任务项目数；另有 总合格率趋势、检测量 top10、合格率 top5、**工位负荷热力图**、K 线图、时效。

**后端接口清单（实测出现在产物里）**

```
/digitalTwin/areas/menu                     区域树（驱动导航与场景聚焦）
/digitalTwin/areas/tasks/{current,completion,qualification,timeliness}
/digitalTwin/quality/{overview,deliveries,qualification,tasks/current,tasks/timeliness,tasks/workstations}
/deviceStatistics/{current,monthly,faultRate/peak}
/energy/statistics
/aqgjWsd/getTodayWsdData                    温湿度（aqgj=安全管家，WSD=温湿度传感器）
/aqgjDeviceWarnLog/getWarnLogStatistics     告警统计
/scada-api/*                                SCADA 采集
/unity/index.html                           Unity WebGL 场景
```

**前端 ↔ 场景消息协议（从 `DashboardLayout` 反编译出的完整消息集）**

信封：`{source:"digitaltwin-host"|"digitaltwin-unity", type:string, payload:object, requestId, ts:number}`，接收侧用 `source + typeof type + typeof ts` 校验。

| 方向 | 消息 | 载荷 |
|---|---|---|
| 前端→场景 | `host:ready` `host:sync` | sync 全量状态：`viewMode, autoRoam, heatmapOn, showLabels, showWalls, showMonitor, bottomPanelCollapsed, focusId, highlightedPartId` |
| | `host:setSceneArea` | `{module, label, areaKey, areaId}` —— **页面模块决定 3D 聚焦区域** |
| | `host:setLayer` / `setHeatmap` / `setMonitor` / `setLabels` / `setWalls` | `{layer, label, enabled}`，图层＝工位负荷热力图 / 监控 / 标签 / 墙体 |
| | `host:setViewMode` `host:setAutoRoam` | 视角模式、自动巡航开关 |
| | `host:setBottomPanel` | `{collapsed, label}` 底部面板收起 |
| | `host:highlight` `host:jumpTo` `host:openMonitor` | 高亮设备/部件、飞行定位、打开摄像头 |
| 场景→前端 | `unity:ready` `unity:error` | 就绪握手、错误上报 |
| | `unity:deviceClick` `unity:partClick` | 设备级 / 部件级拾取（区分粒度） |
| | `unity:waypointClick` `unity:monitorClick` | 路径点位点击、监控点位点击 |
| | `unity:viewModeChanged` | 场景侧改了视角要回传，前端状态同步 |

---

## 2. 值得直接吸收的 8 件事

| # | 参考项目做法 | 对我们的意义 | 落点 |
|---|---|---|---|
| 1 | **场景↔业务双向绑定**（`setSceneArea` 下行、`deviceClick` 上行） | 我们原型目前是"页面跳转"，缺这层契约；交付时甲方一定问"点模型能不能出面板" | 技术对接规范 §协议 |
| 2 | **图层开关**（热力图/监控/标签/墙体） | 比 5M1E 更可落地——5M1E 是业务切片，图层是渲染开关，两者并存而非替代 | 原型 S1/S2 右上 |
| 3 | **KPI 三段口径**（今日/本月/本年 + 同比字段） | 我们只有"今日"，管理者月/年视角缺失；且字段名要提前对齐 | 产品方案 KPI 表 |
| 4 | **工位负荷负荷热力图** | 瓶颈一眼可见，比"告警数"更有管理价值，且是售前爆点 | 原型 S1 图层 |
| 5 | **告警含 未解除/已解除 + 来源系统** | 我们只有 Grade A/B/C，缺闭环状态；来源（安全管家/物联网/数采/调度）决定谁来处置 | 对象模型 Alarm |
| 6 | **autoRoam 显式开关 + viewModeChanged 回传** | PRD 写了"60s 自动巡航"，但没有开关与状态回传，演示时无法关闭会挨骂 | 协议 + 原型 |
| 7 | **底部面板收起** | 大屏演示时把信息密度收起来突出 3D，成本极低收益高 | 原型 S1/S2 |
| 8 | **4K 基准 + 等比 letterbox 缩放** | 我们已做 1920 等比缩放，方向一致；发布基准补一条"3840×2160 等比"即可 | 设计规范 §尺寸 |

## 3. 明确不要跟的 5 件事（附理由）

1. **深色贴图大屏**：26 张 PNG 皮肤 = 换主题要重画素材、改分辨率要重出图、无法 token 化，且这类"深蓝指挥中心"在电力行业投标里已高度同质化。**坚持《视觉语言提取 V1》的高调白 + 悬浮白卡**，用真实实验室质感做差异化；只吸收它的交互结构，不吸收它的皮肤。
2. **管理后台控件混进大屏**：Element Plus 表格/分页/日期选择器直接贴在深色底上，视觉割裂且暴露"后台换了层皮"。**结论：大屏（S1/S2/S3）与 LIMS 后台彻底分离**，大屏内只用定制浮层，通用控件一律不出现在 1920 大屏画布上。
3. **把引擎当资产**：Unity WebGL iframe 的代价是包体 20–80MB、首屏慢、WebGL 在信创/国产浏览器兼容风险、错误只有一行 `unity:error`。**我们应把资产定义为"协议 + 数据契约"**：three.js 程序化场景（已有 CAD 底座 `twin/future-lab`）实现同一套消息集，将来客户指定 Unity/UE 时前端一行不改。
4. **接口命名直接进前端**：`aqgjWsd`、`deviceStatistics/faultRate/peak` 这类甲方命名会渗透进组件代码。**规范里必须写"外部字段 → 内部孪生对象"映射表**，前端只认 Zone/Device/Task/Sample/Robot/Alarm/Edge。
5. **无新鲜度分级**：它只有"请求失败/超时/网络异常"三句提示，没有 stale/missing/offline 的数据可信度分级。我们 Beats 卡四态是既有优势，**要写成协议硬要求**（场景侧也必须显示"数据延迟"）。

---

## 4. 三份产出物的调整清单

### 4.1 产品方案（PRD-v1 增补，不改定位）
- **KPI 口径表**：今日/本月/本年 × {检测样品量、任务项目数、合格率、告警数、在线设备}，每项标注 来源系统 + 刷新频率 + 同比算法。
- **新增图层体系**：`heatmap 工位负荷` `monitor 安防监控` `labels 标签` `walls 墙体剖切` `path 调度路径`（我们的 AMR/复合机器人路径应作为独立图层，而不是常驻）。
- **告警闭环**：状态机 触发 → 自动处置 → 派发 → 复核 → **已解除**；每条告警必带 来源系统 与 派发目标（A 主任台+App / B 工位屏 / C 运维队列）。
- **S4 候选（不进 V1）**：质量检测经营视图（合格率趋势 / 检测量 top10 / 合格率 top5 / 交付时效）——售前价值高，但 PRD 未锁，建议列为"对外展示第 5 屏"单独评审。
- **非目标补充**：不做深色皮肤切换、不做移动端（维持）、不做多实验室（维持）。

### 4.2 交互原型（`proto/*.html`，可立即改）
| 优先级 | 改动 | 说明 |
|---|---|---|
| P0 | 右上「图层」下拉（热力图/监控/标签/墙体/路径） | 与 5M1E 并列：5M1E=业务切片，图层=渲染开关 |
| P0 | 设备/区域点击 ↔ 面板选中 双向高亮 | 点面板设备 → 场景描边推进；点场景设备 → 弹层（已有） |
| P0 | 「自动巡航」开关 + 「底部收起」 | 演示可控 |
| P1 | S1 KPI 加 今日/本月/本年 切换 | 三段口径 |
| P1 | S2 AMR 路径加 5 个可点 waypoint | 点击出点位任务/机器人状态 |
| P1 | S4 告警状态改 未解除/已解除 + 来源系统标签 | 闭环 |
| P2 | 工位负荷热力图视图（区域面着色带） | 管理者视角 |
| P2 | 监控浮层（摄像头点位 → 视频占位 + 时间戳） | 安防联动 |

### 4.3 技术对接规范（把 `docs/digital-twin-integration.md` 升级为「孪生通信协议 v2」）
- **信封**：`{v:2, session, source:"twin-host"|"twin-scene", type, payload, requestId, ts}`；接收侧校验 source/type/ts，`requestId` 必须有 **ack + 3s 超时重试**（参考项目有 requestId 但无 ack）。
- **下行**：`host:ready` `host:sync` `host:setViewMode{mode:full|zone|device}` `host:setSceneArea{module,areaKey,areaId}` `host:highlight{deviceId|partId,level}` `host:jumpTo{areaId|deviceId}` `host:setLayer{layer,enabled}` `host:setAutoRoam{enabled,speedDegPerSec}` `host:setBottomPanel{collapsed}` `host:openMonitor{cameraId}` `host:data{objects[]}`（**业务数据由前端推给场景**，场景不直连数据库）`host:ping`。
- **上行**：`scene:ready` `scene:error{code,msg,recoverable}` `scene:viewModeChanged` `scene:deviceClick{deviceId}` `scene:partClick{partId}` `scene:waypointClick{waypointId}` `scene:monitorClick{cameraId}` `scene:areaEnter/areaLeave` `scene:stats{fps,frameMs,drawCalls,triangles,textureMB}` `scene:pong`。
- **数据契约**：七类对象（Zone/Device/Task/Sample/Robot/Alarm/SystemNode+Edge）字段表，含 **单位、时区、刷新频率、空值语义**（`null`=未测 vs `0`=实测零）、以及"外部接口名→内部字段"映射表。
- **降级**：`stale`（>3 个刷新周期）/`missing`/`offline` 三态在协议层的定义与显示要求。
- **验收**：1920×1080 基准 + 3840×2160 等比发布；可交互 ≤3s、`scene:ready` 握手 ≤5s、帧时 <16.7ms、`prefers-reduced-motion` 关闭循环动效、同屏脉冲对象 ≤3。

---

## 5. 一句话结论

参考项目**交互骨架成熟、视觉与工程路线不可取**。它证明了三件事：① 场景↔业务双向绑定协议是交付刚需；② 图层开关 + 面板收起是大屏演示的必备控制；③ 指标必须按"今日/本月/本年 + 同比"的口径与接口对齐。
我们应**保留高调白视觉与 three.js 程序化场景**，把它的**协议、图层、口径、闭环**四样吸收进来，并把"协议 + 数据契约"作为可复用资产沉淀——这样无论底层是 three.js、Unity 还是 UE，前端与交付都不返工。
