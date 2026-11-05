# 实验室数字孪生 · 并入原型仓与真实数据对接设计

> 2026-11-05 · 源包：`产品/数字孪生/实验室三维图独立包`（安全管家未来实验室物联可视化 v1.1.0）
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
> - 106 无人化电缆试验区标号 1–4 设备（2026-11-05 补挂，键升 v6）：1=绝缘层机械性能智能测试系统-无人化版（YM-WRH-03/YWL-5D）、2=全自动绝缘厚度测试仪（无人化版）（YM-WRH-02/YWD-11F）、3=电缆热延伸全自动检测系统-无人化版（YM-WRH-04/YWH-6D）、4=电缆热收缩试验智能检测系统-无人化版（YM-WRH-05/YRSC-200I）；均 应敏科技/无人化试验室，T1 时对应节点 `associatedDeviceId` 填 `eq_ym_wrh_02`～`eq_ym_wrh_05`。
| `roomId` 101—110 | — | `venue-mgmt.html` 场地主数据 | 命名已一致，建映射表落库 |

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
