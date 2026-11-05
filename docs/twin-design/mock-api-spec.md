# 孪生 Mock API 接口规范 V1（后端对接契约）

> 实现：`twin/js/twin-api-mock.js` + `twin/api/seed.json`（JSON+定时器，2s tick）。
> 原则：**前端只认本规范，不直连三个异构系统**；后端按同路径实现适配层即可无缝替换（替换 `TwinApi.get/ws` 内部实现，路由与事件名不变）。
> 响应统一信封：`{ code:0, message:"ok", data:…, updatedAt:ISO }`；对象字段与枚举以《数字孪生对象模型与数据字典 V1》为准。

## 1. 总览组（S1）
| 端点 | data | 源 |
|---|---|---|
| `GET /api/overview/lab-status` | 今日任务(完成/在制/异常)/样品数/告警计数/数据源健康 | 聚合①② |
| `GET /api/overview/zones` | 10 区域：status(running/idle/alarm)+deviceCount+alarmState；106 含 subZones[6] | ①调度 |
| `GET /api/overview/today-tasks` | Task[]：source(LIMS/WORKSTATION)、deviceChain、progress、result | ①+LIMS(二期) |
| `GET /api/overview/alarms` | Alarm[]：grade A/B/C、zoneId、deviceId、status(active/ack/resolved) | 判定规则结论，前端不推断 |

## 2. 106 组（S2）
| 端点 | data | 源 | 频率 |
|---|---|---|---|
| `GET /api/zone/106/devices` | Device[]（七分法类型、modelNode=`cad:*`、status 五枚举、keyParams 1~3、daqUnitId 1:1） | ②数采+①调度 | 10s |
| `GET /api/zone/106/robots` | RB-C-01/RB-C-02（CAD 复合机器人 106-09/106-08 本体驱动）：path、progress、battery、action、routeBasis。**原三维包无路径数据**（route/waypoint 字段 0 命中），现路线为工位图推导环线（visual_106.json sourceBBox×0.05 换算：家位/充电位1·2/AGV上料桌/检测上下料桌/7个工位），接入调度系统后由真实路径规划替换 | ①经机器人调度 | 1–5s |
| `GET /api/zone/106/samples` | Sample[]：barcode、location(holder=device/shelf/robot)、transferHistory | ①调度 | 事件驱动 |
| `GET /api/zone/106/current-tasks` | 在制 taskId 列表 | ①调度 | 10s |
| `GET /api/zone/106/dispatch-tasks` | DispatchTask[]（真实任务号/流程配置/绑定设备/执行机器人，见对象模型 §1.5b） | ①调度 | 事件驱动 |

## 3. 详情与回溯组（S3/P1）
| 端点 | 说明 |
|---|---|
| `GET /api/alarm/{alarmId}/trace` | 24h 窗口时间轴（PRD 边界）：[{at,system,text}]，system∈LIMS/判定规则/调度/机器人调度/数采/孪生/运维 |
| `GET /api/device/{deviceId}/detail` | 台账投影（deviceId 支持 eq_* 与编号 code 双查） |
| `GET /api/device/{deviceId}/realtime` | keyParams 现值 + daqUnitId + updatedAt（Mock=轮询 3s，生产切 WS） |

## 4. WS `/ws/realtime`（Mock 为同文件事件总线）
事件：`tick`(机器人/设备增量,2s) · `task.progress` · `device.status` · `robot.action` · `alarm.update`。
断流策略：>3 周期无 tick → 前端标 stale（黄点），机器人停走保留最后位置——**诚实降级为前端行为，后端只需带 updatedAt**。

## 5. 后端适配层要求
1. 三源归一在**后端**完成（协议各异：调度 API/MQTT、数采回传、物联平台），出口只有本规范；
2. 告警只透传上游判定结果，禁止在网关或前端造阈值；
3. 机器人坐标必须经现场 3 点标定后输出 three-world-m；未标定输出 `placement:'planned'`；
4. 全部响应带 updatedAt；模拟量分钟级、开关量/告警即时。
