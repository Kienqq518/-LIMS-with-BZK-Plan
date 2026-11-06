# 实验室数字孪生 · 并入原型仓与真实数据对接设计

> 2026-11-05 · 源包：`产品/数字孪生/实验室三维图独立包`（安全管家未来实验室物联可视化 v1.1.0，2026-11-05 已站内更名「未来实验室数字孪生」）
> 本仓位置：`twin/`（`twin/future-lab` + `twin/src` + `twin/mock`，三包同级、相对路径不可拆）

## 1. 并入结果（T0，本次并入）

- 入口：`twin/future-lab/tour-lab-v3-1.html`（101—110 房间三维模型 + IoT 节点层，原生 ESM + 本地 Three.js，无 CDN、无构建）；纯模型版 `tour-space-v3-1.html` 保留，可直链访问。
- 挂接：`testos.html` 应用矩阵「实验室数字孪生」卡片已指向该入口。
- 规范：两个入口页均已按全站约定引用 `css/ui-baseline.css`（置于包样式之前，包内视觉保持最终话语权）与 `js/ui-a11y.js`。
- 体积：约 36 MB 静态资源，Vercel 单文件均远小于 100 MB 限制，构建无风险。
- 不要直接双击 HTML：ES Module 需要 http 源，本地预览用 `python3 -m http.server`。

实测（本机 Chromium 内核浏览器）：WebGL 正常、0 运行错误（包内 `src/runtime-audit.js` 会把 window error 记录进 `#req013-runtime-errors`，可作为验收探针）、旋转/缩放流畅。

## 2. 包内数据契约（已具备，直接复用）

### 2.1 节点配置 `future-lab/data/iot-nodes.json`
```
{ schemaVersion, coordinateSpace:'three-world-m', deployment:'planned-only',
  nodes:[ { id:'IOT-102-TH-01', name, type, roomId, position{x,y,z},
            associatedDeviceId, dataSource, placement:'planned',
            placementNote, positionSource } ] }
```
- 16 节点 / 8 类型：temperature×4、camera×4、motion×2、smoke×2、light、switch、gas、water。
- `deployment:'planned-only'`：坐标是原型世界坐标，**非施工安装坐标**；`associatedDeviceId` 目前为 null，是接设备台账的预留钩子。

### 2.2 快照 schema（`iot/status.js` validateSnapshot，强校验）
```
{ nodeId, status:'normal'|'alarm'|'offline', values:{...}, updatedAt:ISO,
  dataState:'valid'|'stale'|'missing', source:'live'|'mock' }
```
values 按类型：temperature`{temperature,humidity}`；light`{illuminance}`；smoke/water`{detected}`；gas`{exceeded}`；motion`{activity}`；switch`{contact:'open'|'closed',channels{IN1,IN2,OUT1,OUT2}}`；camera`{connection,videoSource}`。

### 2.3 状态机与新鲜度
- `NodeStore`：`replace()` 全量（必须覆盖全部节点）、`patch()` 增量、`subscribe()` 订阅渲染。
- `normalizeSnapshot()`（`src/scene-monitoring.js`）：无快照/时间无效/values 不合型 → `missing`；超 `maxReportAgeMs` → `stale`；离线保留最后时间戳、清空当前值。
- **告警铁律**（api-adapter.js 注释原文）：只有上游配置好的告警结果才映射为 `alarm`，前端绝不从活动/触点自行推断告警——与八维度「诚实降级」同源，接真实数据时必须保留。

### 2.4 替换点（唯一需要动的地方）
`scene-bootstrap-v3-1.js` 里 `SharedShowcaseService` 内部持有 `MockNodeService`。对外契约是：
```js
new LiveNodeAdapter({ loadInitial, subscribe, decode })  // iot/api-adapter.js 已写好
// connect(store): store.replace(decode(await loadInitial()))
//                 subscribe(p => store.patch(decode(p)))
```
即：**实现三个函数即可从 mock 切 live，骨架、渲染、详情卡、新鲜度逻辑零改动。**

### 2.5 演示参数（验收/评审可用，保留）
`?demo-state=offline|stale|missing` 注入异常态；`?review=1&sampleAt=<ISO>` 评审回放对齐时间；`?native-nodes=1` 在 tour-space 入口激活三维节点层（`tour-node-bridge.js`，注释限定 V4 host；本交接包内详情卡在总览机位不弹出，属包限制，对接 T1 时随 live 数据一并打通）。

## 3. LIMS 真实数据源映射（T1 目标态）

| 孪生节点 | 类型 | 数据源 | 现状 |
|---|---|---|---|
| 102/106/107/108 TH | temperature | 实验室数据采集系统（组态物联终端→数采回传） | **已打通**（路线图「环」维度），P1 连续曲线一并接入 |
| 103/106/109/110 CAM | camera | 视觉节点 + 视频时间锚（P1 已预留结构） | 硬件就绪后 `videoSource` 填回源地址；P3 解锁 |
| 104/110 SMOKE、108 WATER、106 GAS | 安全物联 | 数采系统安全采集 | 路线图「环境监测」后续项；告警判定归上游（判定规则模块），孪生只呈现 |
| 101/105 PIR | motion | 无人化试验区活动检测 | P4 无人化叙事位；未部署前保持 `missing`，不造假 |
| 106 IO | switch | 复合机器人充电桩/门禁触点 | 组态物联下发任务/消费回传 |
| 全部节点 `associatedDeviceId` | — | `equip-mgmt.html` 设备台账（校准/维护状态角标） | 台账 ID 对齐后即可挂接 |

> 2026-11-05 台账首挂（种子存储键已升 v5 强制重播）：
> - 107 材料试验区箭头点名设备 = 智能型数字电桥（2411020108 / QJ-36 / 数蚕智能 / 无人化试验室 / 精度全量程优于 0.1uΩ或0.1%），T1 时对应节点 `associatedDeviceId` 填 `eq_qj36`。
> - 106 无人化电缆试验区红框设备（输送带末端储物位）= 砝码库（YM-WRH-06 / YM-FMK / 应敏科技 / 无人化试验室），T1 时对应节点 `associatedDeviceId` 填 `eq_ymwrh06`。
> - 107 材料试验区红箭头设备（2026-11-05 补挂，键升 v7）：箭头1=数显千分尺（DL-27 / (0~25)mm/0.001mm / 未来实验室）`eq_dl27`、箭头2=电子天平（YH-04 / HZK-FA110 / 应敏科技）`eq_yh04`；所在区域/设备精度/证书编号截图未露出留空，待补后回填。
> - 106 无人化电缆试验区标号 1–4 设备（2026-11-05 补挂，键升 v6）：1=绝缘层机械性能智能测试系统-无人化版（YM-WRH-03/YWL-5D）、2=全自动绝缘厚度测试仪（无人化版）（YM-WRH-02/YWD-11F）、3=电缆热延伸全自动检测系统-无人化版（YM-WRH-04/YWH-6D）、4=电缆热收缩试验智能检测系统-无人化版（YM-WRH-05/YRSC-200I）；均 应敏科技/无人化试验室，T1 时对应节点 `associatedDeviceId` 填 `eq_ym_wrh_02`～`eq_ym_wrh_05`。
| `roomId` 101—110 | — | `venue-mgmt.html` 场地主数据 | 已按真系统对齐 9 个场地（位置=房间号 102—110），键升 `lims.venues.v2`；101 接待大厅真系统未列场地，孪生侧保留 |

## 4. 对接架构（建议）

```
数采系统/组态物联 ─┐
LIMS 事件（流程节点/台账/资质）─┤→ 孪生只读网关（新建，BFF）
判定规则（告警结论）─────┘   ├─ GET /twin/nodes      节点配置+台账关联
                            ├─ GET /twin/snapshot   全量快照（replace 语义）
                            └─ SSE  /twin/stream    增量 patch（断流→客户端标 stale/offline）
```
- 网关只读、只吐快照 schema 字段；`decode()` 在网关侧做上游 payload→快照归一化。
- 鉴权分两圈：**内网全量视角**（主任/试验员，token）；**对外视角**复用分级公开引擎——报告码进入的孪生回放只放等级允许字段（三级=轨迹+照片位、二级=时间锚视频、一级=实时），与 `report-verify` 同一套门禁，公网暴露面规则不变（只读、隔离内网主数据）。
- 频率：模拟量分钟级对齐 `sampleTime()`，开关量/告警即时推；`updatedAt` 缺失视为事故级 bug。

## 5. 分期路线（与透明实验室 P0–P4 合流）

- **T0（本次并入）**：静态并入 + 入口挂接 + UI 基线。演示口径：三维空间 + mock 状态。
- **T1（随 P1）**：`LiveNodeAdapter` 三函数落地，温湿度真实数据 + 相机连接状态上线；`source:'live'` 徽标；缺数据诚实标注。
- **T2（随 P2–P3）**：业务事件层——样品流转事件驱动场景高亮（扫样品码→所在台位脉冲+全旅程轨迹），设备校准到期/维护提醒角标，视频时间锚→节点回看。
- **T3（随 P4）**：报告码↔孪生回放视图互跳、防篡改校验徽标（哈希/TSA 通过态）、无人区实时活动，即一级「玻璃房」完整形态。

## 6. 验收清单（每期必查）

1. `#req013-runtime-errors` 为空数组；console 无 error。
2. 每个节点 `source/updatedAt/dataState` 三件套齐全，UI 可见新鲜度。
3. 未部署/断流节点显式 `missing/stale/offline`，**无占位数据、无假动画**（诚实降级）。
4. `associatedDeviceId` 与设备台账匹配率 100%，`roomId` 与场地主数据一致。
5. 告警仅来自上游判定结果，前端无自造阈值。
6. 对外视角字段集 = 该报告等级公开矩阵，无越级泄露。

## 7. 已知限制（来自包内 `unresolved-items.md`，勿当已确认项验收）

- CAD 来源几何：部分构件名称/高度待核对（101-04/05/06、103-01/03、105-04/08、106 系列、109 块名冲突等），三维仅作外包络。
- `INSUNITS=4` 声明毫米但无权威标尺，比例还原不可用于施工。
- 详情卡/V4 host 模式在本交接包未完全激活；大屏导航、图表、场景事件不含（包说明原文）。

> 2026-11-05 场地/区域对齐（`lims.venues.v2` + `lims-equip-store-v8`）：场地管理按真系统改为 9 场地（控制室104/智能力学室103/材料试验区107/智能高压室105/智能样品室102/数智化电气试验区110/无人化电缆试验区106/环境试验区108/综合试验区109）；设备 AREAS 字典同步替换，设备区域重映射——无人化系列 6 台→无人化电缆试验区，DL-27/YH-04/LX-05/数显卡尺×2→材料试验区，DL-09→环境试验区，YFG-150A→智能高压室，OFF-01→综合试验区。LX-05 真系统弹窗还显示部门=应敏科技、下次校准=2027-07-29，与原型演示数据（力学检测组/已过期）不同，本轮按指令只改所在区域，其余保留（过期态是校准预警功能的演示样本）。

---

## 附：调度系统「流程配置」编码表与任务号规律（孪生侧枚举）

来源：无人化区域调度系统「任务明细」实测截图（2026-11-05，106 无人化电缆试验区）。孪生侧 `Task.flowCode` / `Task.deviceChain[].step` 取此枚举，**不得自造节点名**（此前原型里的「预处理/制样/检测/测量 + Z-106-xxx」为杜撰，已按本表替换）。

| 流程配置 | 名称 | 动作类型 | 关联 106 设备（`visual_106.json`） | 任务号前缀 |
|---|---|---|---|---|
| 0115 | 绝缘厚度试验循环上下料 | 循环上下料 | 106-06 绝缘层厚度检测工位 | 11511 |
| 0121 | 双工位机械性能取料 | 取料 | 106-05 机械性能无人化检测工位 | 12122 |
| 0122 | 双工位机械性能放料 | 放料 | 106-05 机械性能无人化检测工位 | 12222 |
| 0131 | 热收缩试验取料 | 取料 | 106-04 热收缩检测工位 | 13133 |
| 0132 | 热收缩试验放料 | 放料 | 106-04 热收缩检测工位 | 13233 |
| 0141 | 哑铃样取料 | 取料 | 106-01 哑铃样制工位 | 14144 |
| 0142 | 哑铃样放料 | 放料 | 106-01 哑铃样制工位 | 14244 |
| 0152 | 热收缩放料 | 放料 | 106-03 热收缩样制工位 | 15255 |
| 0172 | 径向放料 | 放料 | 106-02 径向样制工位 | 17277 |

**任务号编码规律**：`任务号 = 前缀(5) + 日期(8, yyyyMMdd) + 时刻(4, HHmm)`；`任务备注` 在早期数据里等于前缀，在新数据里等于完整任务号（对接时按字符串原样展示，不要拆分推断）。
示例：`14144202611051004` → 前缀 14144（流程配置 0141 哑铃样取料）· 2026-11-05 · 10:04。

**孪生侧字段映射（外部 → 内部对象）**

| 调度系统字段 | 孪生字段 | 说明 |
|---|---|---|
| 任务号 | `Task.dispatchTaskNo` | 主键，直接展示（等宽字体） |
| 任务备注 | `Task.dispatchRemark` | 原样展示，不参与逻辑 |
| 流程配置 | `Task.flowCode` + `Task.flowName` | 枚举见上表；驱动场景高亮设备与 AMR 路径点位 |
| 时刻（任务号尾 4 位） | `Task.plannedAt` | 待执行节点显示「计划 HH:mm」，不得显示为已完成 |

**握手语义（架构分解文档原文）**：机器人调度系统先向设备发上料询问 → 设备回复可上料 → 机器人才执行动作 → 退出后通知设备「物料已放好」并同步给无人检测调度系统。因此 `放料/取料` 节点在孪生侧必须能呈现三态：**等待设备应答 / 执行中 / 已同步调度**，只有 `flowCode` 不足以判断进度。

**待补**：本表只覆盖 106 出现的 9 个编码。其余区域（107/108/109/110/105）的流程配置需向调度系统方索取完整字典后再扩表，**不要按命名规律外推**。


---

## 附录 · 协议增补 v2.1（2026-11-05，随 `docs/digital-twin-product-plan-v2.md` 决策定稿）

**通道**：宿主 → 场景 `channel:'twin-v2'`；宿主 → 空间引擎 `channel:'future-lab-tech-blue-spatial'`；场景 → 宿主同 spatial 通道。

| 方向 | 消息 | 载荷 | 说明 |
|---|---|---|---|
| 宿主→网关（REST） | `GET /api/zone/{z}/task-stats` | 区域任务统计四格：`{periods{day,month,year}{done,running,abnormal,queued,total}, note}`；屏上只显示 完成/执行中/异常/排队，`total` 仅 title 备注；非试验区 note 说明「无任务口径」 |
| 宿主→网关（REST） | `GET /api/zone/{z}/running-tasks` | 在制任务合并流：`{tasks[{kind:'dispatch'\|'daq', taskId, name, deviceCode, robotId, startedAt, elapsedMin, plannedMin, stage, percent}]}`；`elapsedMin>plannedMin` → 前端标「超时」 |
| 宿主→网关（REST） | `GET /api/zone/{z}/alarms` | 本区告警（只读三态 + 派至 + 来源） |
| 宿主→场景 | `state` | `{robots[], deviceStatus{}, layers{}, quality, routeNote}` | 幂等全量推，场景侧收到即应用图层与画质（避免 ready 竞态） |
| 宿主→场景 | `layer` | `{layer:'path\|labels\|zones\|walls\|heatmap', enabled:bool}` | 图层=渲染可见性，与业务无关；`walls` 关=还原墙体不剖切 |
| 宿主→场景 | `quality` | `{level:'high'\|'low'}` | 低配：关 Reflector、pixelRatio→1、动画环 66→125ms、光点静态 |
| 空间 | `equipment-highlight` | `{id:'106-06'}` | 面板→场景描边；id 为 CAD 节点号（宿主 `modelNode` 去 `cad:` 前缀） |
| 场景→宿主 | `bridge-ready` | `{guide, robots}` | 就绪握手；宿主在此之前缓存最后一次状态并在就绪后重放 |
| 场景→宿主 | `perf` | `{calls, tris, geometries, textures, fps, layers, quality}` | fps=layers 之间的平均帧率（5s 窗口） |

**几何约束（决策 Q5）**：调度系统机器人只直线行走、原地掉头。场景侧对工位锚点做**曼哈顿折线推导**（长边先走→掉头），引导线与机器人轨迹、插值均走折线段；转向为瞬时角度切换。未做现场标定时 `positionBasis='derived'`，UI 标注「相对轨迹」，不显示绝对坐标。

**只读约束（决策 Q2 + PRD-v1 §6）**：孪生前端**无任何写回端点**。原 `TwinApi.alarmAck()` 已删除；告警三态 `active/dispatched/resolved` 只能由来源系统经网关推送，屏上不出现「演示回执」类标注。

**首屏与视角**：V2 运行大屏首屏机位（`?v2=1` 条件生效，其余 tour-space-* 页面保持 `[-.18,.94]`）=`overall-101`  `yaw -1.05 / elev 0.6 / zoom 1`（2026-11-06 按产品负责人截图标定，10 个房间标签屏幕位置拟合 RMSE≈37px）；`scene-group-highlight-v3-1.js` 的 `CAMERA` 常量必须与之一致，否则分组高亮复位会覆盖机位。宿主在场景 `bridge-ready` 之前不得直接发 `view` 指令——需入队，就绪后补发，保证 `?mode=&zone=&layers=` 的首屏恢复。

**行进约束（2026-11-06）**：机器人 `path` 为曼哈顿折线锚点（0.05m 栅格 A* 推导），并带 `homeAnchor / allowedZones / corridor / footprint / sweptEnvelope(0.902) / clearanceM(0.20) / serves / routeMethod`。场景侧 `auditRoutes()` 每次装载逐段 0.02m 采样校验「越出允许范围」与「与实体重叠/穿越」，结果经 `{type:'route-audit', checked, obstacles, violations, detail}` 回传宿主并常驻左栏显示；违规>0 视为不可上线。真实调度接入后仅替换 `path/homeAnchor`，校验规则不变。

**相机与浮层（2026-11-06）**：宿主 → 场景新增 `twin-v2/camera{action:'begin'|'drill'|'device'|'reset', deviceId?, zoneId?}` 与 `future-lab-tech-blue-spatial/pan{x,y}`（像素）；场景 → 宿主新增 `route-audit{checked,obstacles,violations,detail}`。下钻指令序列与时序约束见 `docs/twin-design/animation-spec.md` §11。
`GET /api/zone/106/cycle` → `{robotId, cycle{loopSec,speedMs,pathLengthM,stops[{order,cad,label,flowCode,flow,taskNo,deviceCode,u,travelSec,dwellSec,t0}]}, live{order,label,phase:'travel'|'dwell',remainingSec,u,loopSec}}`；`live` 由墙上时钟取模计算，前端只读不写。

**墙体与门洞（2026-11-06）**：新增 `GET /api/zone/{z}/walls` → `[{name,axis:'x'|'z',at,a,b,gate:[lo,hi]|null}]`（实测：106 东玻璃墙 x=18.49 门洞 z[10.2,11.8]，中心 11.0；106 南墙 z=9.59 无门洞）。宿主把 `walls` 随 `state` 推给场景，场景侧 `auditRoutes()` 按「扫掠方块与墙面相交则必须整块落入 gate」判定 `穿墙未走门洞`；**自检随 path/walls 签名变化重算**（只跑首帧等于没校验）。真实接入后若调度系统给出门洞通行事件，应以事件为准复核本规则。

**左栏四表契约（2026-11-06）**：`GET /api/overview/lab-status` → `panels{entrust,samples,testItems,dispatch}`，每个面板 `{title,source:'daq'|'dispatch',unit,note,periods{day,month,year}{<指标键>,compare}}`；指标键：entrust `total/power/safety`、samples `received/testing/done`、testItems `testing/pending/done/overdue/dueSoon`、dispatch `done/blocked/blockedResolved/blockedUnresolved`。
**自洽硬约束**（后端实现必须满足，前端有自动化断言）：`power+safety=total`；`testing+pending+done=合计`；`blockedResolved+blockedUnresolved=blocked`；`done+blocked=调度总量`；`testing+done ≤ received`。报告份数（LIMS）已从大屏下线，接口无需提供。

**逾期/临期口径（2026-11-06）**：字段来自 **LIMS 的「要求检测完成时间」**（二期接入，现阶段 Mock）。新增 `GET /api/overview/test-item-plan` →
`{note, overdueRule, dueSoonRule, items[{sampleId, item, zone, status:'testing'|'pending'|'done', dueInHours, requiredAt, overdue, dueSoon}]}`；
`GET /api/overview/lab-status` 的 `panels.testItems` 中 **本日** 的 `testing/pending/done` 与 **全部周期** 的 `overdue/dueSoon` 均由该清单现算（`overdue = 未完成 && dueInHours<0`，`dueSoon = 未完成 && 0≤dueInHours≤72`），逾期/临期为现在时指标、不随周期变化。
**路由顺序坑（第二次踩）**：具名端点必须排在通用 `/api/overview/([\w-]+)` 之前，否则 `test-item-plan` 会被当成分区字段返回 null。

**待补（下一步）**：`host:setAutoRoam`（讲解用自动巡航，默认关）、`scene:waypointClick{waypointId}`（折线拐点拾取，标记已渲染）、`requestId + ack + 3s 超时重试` 信封。
