# 数字孪生 · 开发人员交接文档（索引 + 契约摘要）

> 2026-11-12 整理 · 用途：把散落在各文档中的开发要点汇总成一份上手材料。
> **本文是索引与摘要，不是事实源**——所有口径以下列权威文档为准，冲突时以权威文档原文为准。

---

## 1. 文档索引（按开发角色读）

| 文档 | 内容 | 谁必读 |
|---|---|---|
| `PRD-v1.md`（根目录） | **决策基准**：定位/用户优先级/S1–S2 范围/交付形态/数据来源/非目标。一切取舍回这里对照，偏离须先与产品负责人确认 | 全体 |
| `docs/digital-twin-integration.md` | 并入结果、包内数据契约、替换点、LIMS 数据源映射、网关设计、桥接指令、墙体/路径/画质/左栏四表契约、调度流程编码表 | 前端+后端 |
| `docs/twin-design/mock-api-spec.md` | **后端对接契约 V1**：端点/WS 事件/信封/适配层要求 | 后端 |
| `数字孪生对象模型与数据字典 V1.md`（根目录） | 对象与字段的唯一事实源：Zone/SubZone/Device/Robot/Sample/Task/告警/18 条系统流边；ID 规范 | 后端+数据层 |
| `docs/twin-design/twin-object-model.ts` | 对象模型的机器定义（可直接喂给数据层实现） | 后端 |
| `docs/digital-twin-overall-design.md` | 三源驱动总体架构（调度/数采/物联 → 孪生归一）、网关（BFF）、角色视图 | 架构/后端 |
| `docs/digital-twin-product-design.md` | LIMS 业务融合：双向深链（`?focus=` / 台账弹卡）、事件流驱动、分期 D0–D4 | 前端 |
| `docs/digital-twin-product-plan-v2.md` | V2 运行大屏产品计划（FR-13b/24/34–38 等功能需求，回归套件口径来源） | 前端 |
| `docs/twin-design/animation-spec.md` | 动效与下钻指令序列（§10–§17，§11 为下钻时序约束） | 前端 |
| `docs/twin-design/mock-api-spec.md` 之外：`3d-style-guide.md`/`look-dev.md`/`ui-tokens.md`/`chart-3d.md`/`ui-components-spec.md` | 视觉/材质/浮层/图表设计规范 | 前端（视觉向） |
| `视觉语言提取 V1.md`（根目录） | 视觉基准（视觉以此为准，对象字段以数据字典为准） | 前端 |
| `docs/digital-twin-room-view-2026-11-09.md` | 房间视图 10 点修整口径（产品负责人原话，不得自行改写） | 前端 |
| `docs/twin-106-door-finding-2026-11-08.md` | 106 门洞标定记录 | 前端/场景 |
| `docs/digital-twin-benchmark-参考项目分析与设计调整.md` | 参考项目分析与设计调整 | 背景阅读 |
| `tests/twin/README.md` | 回归套件清单（24 套）与写断言的四条硬约定 | 全体 |

**效力排序**：范围 = PRD-v1 → 对象与字段 = 数据字典 V1 → 视觉 = 视觉语言提取 V1 → 接口 = mock-api-spec + integration。

---

## 2. 产品边界（V1 锁定，摘自 PRD-v1）

- 定位：实验室检测中心的数字孪生**展示与监控系统**（对外售前展示 + 对内交付后监控）。
- 用户优先级：P0 实验室管理者 > P1 运维工程师 > P2 参观客户。
- MVP 场景：**S1 实验室总览、S2 106 无人化电缆试验区重点监控**。
- **S3 告警回溯已移出 MVP**（2026-11-06 决定）：只呈现当前告警 + 闭环状态（未解除/已派发/已解除、派至谁、来源）；`GET /api/alarm/{id}/trace` 契约保留但前端不调用，二期恢复时后端无需改动。
- 交付形态：Web（Chrome/Edge 最新版）、1920×1080 基准（支持 2560×1440、4K）、Docker 一键演示、演示版 Mock 数据 → 生产版切真实接口。
- 非目标：VR/AR、移动端、多实验室切换、历史深度分析、权限管理（演示版单账号）。

---

## 3. 代码结构与入口

```
twin/
├── future-lab/     # 三维包（101–110 房间模型 + IoT 节点层），约 36MB 静态资源
│   ├── tour-lab-v3-1.html      # 底座入口（10 房间三维 + IoT 节点，原生 ESM + 本地 Three.js，无 CDN 无构建）
│   ├── tour-space-v3-1.html    # 纯模型版（可直链）
│   ├── twin-scene-v2.html/.js/.css  # V2 运行大屏宿主（回归被测页，三维场景在 iframe 内）
│   ├── twin-scene-bridge.js    # 宿主 ↔ 场景桥
│   ├── scene-bootstrap-v3-1.js # 唯一数据替换点所在（SharedShowcaseService 持有 MockNodeService）
│   ├── tour-bridge.js / tour-node-bridge.js  # postMessage 通道 / 三维节点层桥
│   ├── data/iot-nodes.json     # 16 个 IoT 节点配置
│   └── iot/                    # status.js（快照强校验）、api-adapter.js（LiveNodeAdapter）
├── src/            # 场景运行时模块（scene-monitoring.js、runtime-audit.js、cruise/status/group 等）
├── mock/scene-data.js  # 对象模型种子扩展（mock 事件序列）
├── api/seed.json   # Mock API 种子（overview/zone106/traces/zone103/zoneStats/testItemPlan/entrust-list）
└── js/twin-api-mock.js  # Mock API 层——前端唯一数据入口
```

- **三目录同级不可拆**（`future-lab`/`src`/`mock` 相对路径耦合）。
- 全站入口：`testos.html` 应用矩阵「实验室数字孪生」卡片 → `tour-lab-v3-1.html`。
- 新页面必须挂 `css/ui-baseline.css` + `js/ui-a11y.js`（包内样式保持最终话语权）。

---

## 4. 本地运行与验收探针

- **不要双击 HTML**——ES Module 需要 http 源：`python3 -m http.server`（在仓根，访问 `/twin/future-lab/tour-lab-v3-1.html`）。
- 验收探针：`src/runtime-audit.js` 把 window error 记进 `#req013-runtime-errors`，**必须为空数组**、console 无 error。
- 演示/评审参数：
  - `?demo-state=offline|stale|missing` 注入异常态；
  - `?review=1&sampleAt=<ISO>` 评审回放对齐时间；
  - `?v2=1` 走 V2 运行大屏首屏机位（`overall-101` yaw -1.05/elev 0.6/zoom 1）；
  - `?quality=low` 低画质交付参数（画质事实源是宿主 2s 状态推送，不要用单独 quality 指令验证）；
  - `?look=flat` 关闭光影材质精修；
  - `?focus=<type>:<id>` 深链飞行（type ∈ sample/equip/entrust/report/room/person，统一小写）；
  - `?mode=&zone=&layers=` 首屏状态恢复。

---

## 5. 前端数据契约（已具备，直接复用）

### 5.1 快照 schema（`iot/status.js` validateSnapshot 强校验）
```
{ nodeId, status:'normal'|'alarm'|'offline', values:{...}, updatedAt:ISO,
  dataState:'valid'|'stale'|'missing', source:'live'|'mock'（扩展枚举见 §7） }
```
values 按类型：temperature `{temperature,humidity}`；light `{illuminance}`；smoke/water `{detected}`；gas `{exceeded}`；motion `{activity}`；switch `{contact,channels{IN1,IN2,OUT1,OUT2}}`；camera `{connection,videoSource}`。

### 5.2 节点配置 `future-lab/data/iot-nodes.json`
16 节点 / 8 类型（temperature×4、camera×4、motion×2、smoke×2、light、switch、gas、water）。`deployment:'planned-only'` = 原型世界坐标（three-world-m），**非施工安装坐标**；`associatedDeviceId` 是接设备台账的钩子（首挂已做 6 台，见 integration §3）。

### 5.3 状态机与新鲜度
- `NodeStore`：`replace()` 全量（必须覆盖全部节点）/ `patch()` 增量 / `subscribe()` 渲染订阅。
- `normalizeSnapshot()`：无快照/时间无效/values 不合型 → `missing`；超 `maxReportAgeMs` → `stale`；离线保留最后时间戳、清空当前值。

### 5.4 替换点（从 mock 切 live 唯一要动的地方）
`scene-bootstrap-v3-1.js` 中 `SharedShowcaseService` 内部持有 `MockNodeService`。实现三个函数即可切换，骨架/渲染/详情卡/新鲜度逻辑**零改动**：
```js
new LiveNodeAdapter({ loadInitial, subscribe, decode })
// connect(store): store.replace(decode(await loadInitial()))
//                 subscribe(p => store.patch(decode(p)))
```

---

## 6. 后端 API 契约（Mock 先行，同路径替换即无缝）

- 统一信封：`{ code:0, message:"ok", data:…, updatedAt:ISO }`；**全部响应必须带 updatedAt**（缺失视为事故级 bug）。
- 实现现状：`twin/js/twin-api-mock.js` + `twin/api/seed.json`（JSON + 定时器 2s tick）。后端按同路径实现，替换 `TwinApi.get/ws` 内部实现即可，**路由与事件名不变**。

### 6.1 端点组（详见 mock-api-spec.md 与 integration 各节）
| 组 | 端点 |
|---|---|
| 总览 S1 | `/api/overview/{lab-status|zones|today-tasks|alarms|alarm-sections|test-item-plan|devices|entrust-list|safety-scenes}` |
| 区域 | `/api/zone/{z}/{task-stats|running-tasks|alarms|devices|walls}`（106 之外仅设备清单） |
| 106 专属 | `/api/zone/106/{devices|robots|samples|current-tasks|dispatch-tasks|cycle}` |
| 详情/回溯 | `/api/alarm/{id}/trace`（保留不调用）· `/api/device/{id}/{detail|realtime}` |
| 物联 | `/api/iot/temp-hum-series?node=&temp=&hum=&points=&from=` |
| WS | `/ws/realtime` 事件：`tick`（2s 增量）· `task.progress` · `device.status` · `robot.action` · `alarm.update` |

网关（BFF）目标态聚合面：`GET /twin/nodes` · `GET /twin/snapshot`（replace 语义）· `SSE /twin/stream`（patch+事件）。

### 6.2 硬约束（后端实现必须满足，前端有自动化断言）
1. **左栏四表自洽**：`power+safety=total`；`testing+pending+done=合计`；`blockedResolved+blockedUnresolved=blocked`；`done+blocked=调度总量`；`testing+done ≤ received`。
2. **逾期/临期现算**：`overdue=未完成&&dueInHours<0`，`dueSoon=未完成&&0≤dueInHours≤72`；字段源为 LIMS「要求检测完成时间」。
3. **路由顺序坑（已踩两次）**：具名端点必须排在通用 `/api/overview/([\w-]+)` 之前。
4. **报告份数已下线**，接口无需提供。
5. 频率：模拟量分钟级对齐 sampleTime()，开关量/告警即时推；`/api/zone/106/cycle` 的 `live` 由墙上时钟取模，前端只读不写。

### 6.3 适配层要求
- 三源（调度/数采/物联）归一在**后端**完成，出口只有本规范；adapter 只做「下发任务/消费回传 → 归一化快照」。
- 机器人坐标须经现场 3 点标定后输出 three-world-m；未标定输出 `placement:'planned'`、`positionBasis:'derived'`（UI 标「相对轨迹」，不显示绝对坐标）。
- 断流为**前端诚实降级**：>3 周期无 tick → stale（黄点）、机器人停走保留最后位置；后端只需带 updatedAt。

---

## 7. 宿主 ↔ 场景桥接协议（`twin-scene-bridge.js`）

- 三源 `source` 归一枚举：`'daq'|'dispatch'|'iot'|'lims'|'workstation'`；移动实体加 `position{x,y,z}` + `path[]`。
- 首屏恢复：宿主在场景 `bridge-ready` **之前不得直接发 `view` 指令**——必须入队，就绪后补发（保证 `?mode=&zone=&layers=` 生效）。
- 指令清单：
  - 宿主→场景：`twin-v2/camera{action:'begin'|'drill'|'device'|'reset', deviceId?, zoneId?}`、`future-lab-tech-blue-spatial/pan{x,y}`（像素）、画质随 2s `state` 推送覆盖、`walls` 随 state 推给场景。
  - 场景→宿主：`route-audit{checked,obstacles,violations,detail}`。
  - 下钻指令序列与时序：见 `docs/twin-design/animation-spec.md` §11。
- **机位常量**：`scene-group-highlight-v3-1.js` 的 `CAMERA` 必须与 V2 首屏机位一致，否则分组高亮复位会覆盖机位。
- 行进校验：`auditRoutes()` 逐段 0.02m 采样，检查「越出允许范围」与「与实体重叠/穿越」；墙体规则=扫掠方块与墙面相交必须整块落入 gate 门洞；**自检随 path/walls 签名变化重算**（只跑首帧等于没校验）；violations>0 不可上线。真实调度接入后仅替换 `path/homeAnchor`，校验规则不变。
- 待补：`host:setAutoRoam`、`scene:waypointClick{waypointId}`、`requestId+ack+3s 超时重试`信封。

---

## 8. 对象模型要点与 ID 规范（详见数据字典 V1）

- 空间：Zone `Z-101`…`Z-110` 与 `lims.venues` 双对齐（101=接待大厅不在场地台账）；SubZone 仅 106 六分区（PREP/SAMP/TEST/MEAS/BUF/AMR）。
- ID 前缀：`Z- / SZ- / eq_（沿用台账）/ dev: / RB-C- / RB-A- / SPL- / TK- / DAQ-SUB-{code} / SYS. / E{序号}`。
- **调度流程编码枚举（106 的 9 个 flowCode）与任务号规律**（`前缀5+日期8+时刻4`）见 integration 附录表：`Task.flowCode` 取此枚举**不得自造节点名**；任务备注原样展示不拆分；取/放料须呈现三态（等待设备应答/执行中/已同步调度）。其余区域流程配置需向调度系统方索取完整字典，**不要按命名规律外推**。

---

## 9. 八条铁律（对接真实数据时逐条保持）

1. **告警铁律**：只有上游配置好的告警结果才映射为 `alarm`，前端/网关绝不自行推断告警、不造阈值。
2. **诚实降级**：未部署/断流节点显式 `missing/stale/offline`，无占位数据、无假动画、不用曲线循环动画填充。
3. **只读无写回**：孪生前端无任何写回端点（`TwinApi.alarmAck()` 已删除）；告警三态只能由来源系统经网关推送；屏上不出「演示回执」类标注。
4. 每个节点 `source/updatedAt/dataState` 三件套齐全，UI 可见新鲜度。
5. `associatedDeviceId` 与设备台账匹配率 100%，`roomId` 与场地主数据一致。
6. 对外视角复用报告分级公开引擎（三级=轨迹+照片位，二级=时间锚视频，一级=实时），无越级泄露。
7. 改 mock 种子（`equip-store.js`/`venue-store.js` 等 localStorage 种子）必须同步升 `STORAGE_KEY` 版本号；改孪生种子必须同步改回归期望。
8. 坐标一律 three-world-m，沿用 CAD 空间，标定前 `placement:'planned'`。

---

## 10. 回归测试（改动后必跑）

```bash
cd tests/twin
npm i                # 只装 playwright（用系统 Chrome）
node run-all.mjs     # 全量 24 套，自动起/关本地静态服务；任一 ❌ 整体退出码 1（可挂 CI）
node run-all.mjs --only smoke,alarmlvl   # 子集
TWIN_BASE=https://<域名> node run-all.mjs --no-serve   # 打线上（只验已 push 的 commit）
```

- **改以下文件必跑全量**：`twin/future-lab/twin-scene-v2.*`、`twin/js/twin-api-mock.js`、`twin/api/seed.json`、`twin/future-lab/twin-scene-bridge.js`。
- 断言期望值与当前 mock 种子绑定（例：13 条告警=A5/3+B4/3+C4/3；37 条在办试验项目），改种子要同步改期望。
- 写/改断言四条硬约定：① 顺序跑不并发（循环按墙上时钟对齐，一圈 202.3s）；② 观察窗 ≥ 一圈；③ 点告警行前先冻结无缝滚动；④ 装载链必须有常驻断言（`fail() 未被触发` 等）。
- 套件清单与各套守的口径：见 `tests/twin/README.md`（smoke/zone-panel/dockcheck/routecheck/focuscheck/uiconcheck 等 24 套）。

---

## 11. 分期路线与现状

| 期 | 内容 | 状态 |
|---|---|---|
| T0 | 静态并入 + 入口挂接 + UI 基线（mock 状态） | ✅ 已完成 |
| T1 | `LiveNodeAdapter` 三函数落地：温湿度真实数据 + 相机连接状态上线，`source:'live'` 徽标 | 目标态（随 P1） |
| T2 | 业务事件层：样品流转高亮/轨迹、校准到期角标、视频时间锚回看 | 随 P2–P3 |
| T3 | 报告码↔孪生回放互跳、防篡改徽标、无人区实时活动 | 随 P4 |
| D0–D4（LIMS 融合线） | D0 入口/台账挂接 ✅ → D1 孪生→LIMS 弹档案深链 → D2 `?focus=` 镜头飞行 → D3 事件流 → D4 真实数据 | D0 已完成 |

数据源映射现状（integration §3）：102/106/107/108 温湿度**已打通**（数采回传）；相机待硬件+P3；安全物联告警判定归上游；101/105 PIR 未部署前保持 `missing` 不造假；106 IO 触点=充电桩/门禁；`associatedDeviceId` 挂 `equip-mgmt.html` 台账。

---

## 12. 已知限制（勿当已确认项验收）

- CAD 来源几何：部分构件名称/高度待核对（101-04/05/06、103-01/03、105-04/08、106 系列、109 块名冲突等），三维仅作外包络；`INSUNITS=4` 声明毫米但无权威标尺，比例还原不可用于施工。
- 详情卡/V4 host 模式在交接包未完全激活；大屏导航/图表/场景事件不含（包说明原文，V2 大屏已在 `twin-scene-v2` 独立实现）。
- 待标定：106 六分区坐标、设备 keyParams 现场核定表、机器人数量与编号（均 `placement:'planned'`）。
- `requestId+ack` 重试信封、其余区域流程配置字典——尚未落实的对接项。

---

## 13. 协作约定（仓库根 AGENTS.md）

- 改完验证通过即提交 → 变基到最新 `origin/main` → `git push origin HEAD:main`（触发 Vercel 构建），无需再确认。
- 生产分支只有 `origin/main`；push 前 `git fetch` 用 `origin/main` 量领先。
- 数字孪生相关的一切取舍以 `PRD-v1.md` 为准，偏离先与产品负责人对照确认。

（完）
