/**
 * 数字孪生对象模型 V1 · 机器可读定义
 * 依据：根目录《数字孪生对象模型与数据字典 V1.md》（译自《无人化实验室技术架构分解.docx》）
 * 用途：codex 数据层实现基准 + 后端对接契约。改字段先改 md，再同步本文件。
 */

export type Vec3 = { x: number; y: number; z: number };
export type Bounds = { min: Vec3; max: Vec3 };
export type Placement = 'planned' | 'calibrated';

/** 1.1 空间 */
export type ZoneType = 'reception'|'sample'|'mechanics'|'control'|'highvoltage'|'unmanned'|'materials'|'environment'|'comprehensive'|'electrical';
export type AlarmState = 'none' | 'alarm' | 'ack';
export interface Zone {
  zoneId: string;              // Z-101..Z-110
  name: string;                // 与 venue-store 对齐
  type: ZoneType;
  anchor: Vec3;                // three-world-m
  bounds: Bounds;
  alarmState: AlarmState;
  sceneNode: string;           // room:106
  linkedVenueId?: string;      // venue-store id；101 无
  placement: Placement;
}
export type SubZoneType = 'process'|'sample_make'|'test'|'measure'|'buffer'|'passage';
export interface SubZone {
  subZoneId: string;           // Z-106-PREP | -SAMP | -TEST | -MEAS | -BUF | -AMR
  zoneId: 'Z-106';
  name: string;                // 预处理区/制样区/检测区/测量区/样品缓存区/AMR通道
  type: SubZoneType;
  anchor: Vec3;
  bounds: Bounds;
  pathPoints?: Vec3[];         // passage 专用
  placement: Placement;
}

/** 1.2 设备 */
export type DeviceType = 'pre_process'|'sample_make'|'env_monitor'|'detect'|'measure'|'instrument'|'third_party';
export type DeviceStatus = 'working'|'ready'|'standby'|'stopped'|'alarm';   // 前四个=文档状态同步枚举
export interface KeyParam { name: string; value: number | string | null; unit?: string }
export interface Device {
  deviceId: string;            // eq_qj36 / eq_ymwrh03 …（LIMS 台账主键）
  code: string;                // YM-WRH-03
  name: string;
  model: string;               // YWL-5D
  type: DeviceType;
  zoneId: string;
  subZoneId?: string;
  modelNode: string;           // dev:YM-WRH-03（OutlinePass/贴地色块挂载点）
  status: DeviceStatus;        // source: dispatch
  currentTaskId: string | null;
  currentSampleId: string | null;
  keyParams: KeyParam[];       // 1~3 个，source: daq
  components: { plc: boolean; hmi: boolean; controller: boolean; hostSoftware: boolean };
  daqUnitId?: string;          // detect 必填：DAQ-SUB-{code}（1:1）
  lastHeartbeat: string | null;
}

/** 1.3 机器人 */
export type CompositeAction = 'idle'|'moving'|'loading'|'unloading'|'charging';
export type AmrStatus = 'idle'|'moving'|'charging'|'error';
export interface CompositeRobot {
  robotId: string;             // RB-C-01
  position: Vec3; pose: { yaw: number };
  currentAction: CompositeAction;
  servingDeviceId: string | null;
  targetPoint?: Vec3;
  battery: number;             // 0-100
}
export interface Amr {
  robotId: string;             // RB-A-01
  position: Vec3; pose: { yaw: number };
  path: Vec3[];
  carriedSampleIds: string[];
  battery: number;
  status: AmrStatus;
}

/** 1.4 样品 */
export type SampleState = 'received'|'prepared'|'under_test'|'reviewed'|'retained'|'returned';
export interface SampleLocation { zoneId: string; subZoneId?: string; holder: 'device'|'shelf'|'robot'; holderId: string; slot?: string }
export interface Sample {
  sampleId: string;            // SPL-…
  barcode: string;             // 检测工位系统打印，扫码触发数采衔接
  type: string;
  currentLocation: SampleLocation;
  owningTaskId: string | null;
  state: SampleState;
  transferHistory: Array<{ from: string; to: string; at: string; by: string; system: string }>;
}

/** 1.5 任务 */
export type TaskSource = 'LIMS' | 'WORKSTATION';   // 文档：类型区分业务数据隔离
export type TaskResult = 'pending'|'passed'|'failed'|'alarm';
export interface Task {
  taskId: string;              // TK-…
  source: TaskSource;
  sampleId: string;
  deviceChain: Array<{ step: number; deviceId: string; subZoneId: string; status: DeviceStatus }>;
  progress: { stage: string; doneSteps: number; totalSteps: number; percent: number };
  result: TaskResult;
  createdAt: string; finishedAt: string | null;
}

/** 1.6 系统交互视图 */
export type Lane = '业务层'|'调度层'|'执行层'|'采集层'|'物联层'|'外部物联'|'展示层';
export type EdgeKind = 'command'|'data'|'sync'|'query';
export interface SystemNode { nodeId: string; name: string; lane: Lane; icon?: string }
export interface FlowEdge {
  edgeId: string;              // E1..E18
  from: string; to: string;
  kind: EdgeKind;              // command 蓝#2878FF / data 绿#16A34A / sync 灰虚线 / query 紫点线
  label: string;               // 文档原文摘要
  docRef: string;              // 架构分解文档章节
  msgRate5min?: number;        // 活跃度：流动速度映射；0=静止灰线
}

export const SYSTEM_NODES: SystemNode[] = [
  { nodeId: 'SYS.LIMS', name: '实验室业务管理系统（南瑞/华云/应敏）', lane: '业务层' },
  { nodeId: 'SYS.WORKSTATION', name: '检测工位系统', lane: '业务层' },
  { nodeId: 'SYS.VISUAL', name: '数据可视化平台（大屏+数字孪生）', lane: '展示层' },
  { nodeId: 'SYS.DISPATCH', name: '无人检测调度系统', lane: '调度层' },
  { nodeId: 'SYS.ROBOT_SCHED', name: '机器人调度系统', lane: '调度层' },
  { nodeId: 'SYS.CENTRALCTRL', name: '实验设备集控系统', lane: '调度层' },
  { nodeId: 'SYS.IOT', name: '智慧实验室物联网系统', lane: '物联层' },
  { nodeId: 'SYS.DAQ_MASTER', name: '检测数据采集主系统', lane: '采集层' },
  { nodeId: 'SYS.DAQ_SUB', name: '检测数据采集分系统（1:1）', lane: '采集层' },
  { nodeId: 'SYS.DB', name: '数采共享数据库', lane: '采集层' },
  { nodeId: 'SYS.DEVICE', name: '设备群', lane: '执行层' },
  { nodeId: 'SYS.ROBOT', name: '机器人群', lane: '执行层' },
  { nodeId: 'SYS.SAFETY', name: '安全管家', lane: '外部物联' },
  { nodeId: 'SYS.CCTV', name: '监控系统', lane: '外部物联' },
  { nodeId: 'SYS.HVAC', name: '灯光空调控制', lane: '外部物联' },
  { nodeId: 'SYS.IMAGE', name: '图像识别App', lane: '外部物联' },
  { nodeId: 'SYS.SENSOR', name: '第三方传感器', lane: '外部物联' },
];

export const FLOW_EDGES: FlowEdge[] = [
  { edgeId: 'E1', from: 'SYS.LIMS', to: 'SYS.DAQ_MASTER', kind: 'command', label: '实验任务下发（source=LIMS）', docRef: '数采方案·交互详情' },
  { edgeId: 'E2', from: 'SYS.DAQ_SUB', to: 'SYS.LIMS', kind: 'data', label: '实验完成后完整数据接口回传', docRef: '数采方案·交互详情' },
  { edgeId: 'E3', from: 'SYS.WORKSTATION', to: 'SYS.DAQ_MASTER', kind: 'command', label: '手动录入任务，主/分可切换', docRef: '数采方案·交互详情' },
  { edgeId: 'E4', from: 'SYS.DAQ_SUB', to: 'SYS.WORKSTATION', kind: 'data', label: '无 LIMS 时数据回流生成报告', docRef: '系统间交互详情' },
  { edgeId: 'E5', from: 'SYS.DISPATCH', to: 'SYS.DEVICE', kind: 'command', label: '设备动作控制+任务编排', docRef: '系统间交互详情' },
  { edgeId: 'E6', from: 'SYS.DEVICE', to: 'SYS.DISPATCH', kind: 'sync', label: '状态同步：工作/就绪/待机/停止', docRef: '系统间交互详情' },
  { edgeId: 'E7', from: 'SYS.DEVICE', to: 'SYS.DAQ_SUB', kind: 'query', label: '上位机取任务/参数；推实验数据（1:1 不串门）', docRef: '数采方案·交互详情' },
  { edgeId: 'E8', from: 'SYS.DISPATCH', to: 'SYS.DAQ_MASTER', kind: 'query', label: '按样品条码拉任务/参数/数据（重点且可优化）', docRef: '系统间交互详情' },
  { edgeId: 'E9', from: 'SYS.ROBOT_SCHED', to: 'SYS.DEVICE', kind: 'command', label: '上下料握手：询问→应答→执行→放料通知', docRef: '系统间交互详情' },
  { edgeId: 'E10', from: 'SYS.DISPATCH', to: 'SYS.ROBOT_SCHED', kind: 'command', label: '调度指令分发复合机器人/AMR', docRef: '系统间交互详情' },
  { edgeId: 'E11', from: 'SYS.ROBOT_SCHED', to: 'SYS.DISPATCH', kind: 'sync', label: '动作完成反馈', docRef: '系统间交互详情' },
  { edgeId: 'E12', from: 'SYS.ROBOT_SCHED', to: 'SYS.ROBOT', kind: 'command', label: '机器人动作指令', docRef: '机器人调度系统' },
  { edgeId: 'E13', from: 'SYS.CENTRALCTRL', to: 'SYS.DEVICE', kind: 'sync', label: '实验行为/动作/数据实时同步+远程控制', docRef: '系统间交互详情' },
  { edgeId: 'E14', from: 'SYS.IOT', to: 'SYS.DISPATCH', kind: 'command', label: '设备/机器人/门禁/电梯/安全 指令级操作', docRef: '系统间交互详情' },
  { edgeId: 'E15', from: 'SYS.IOT', to: 'SYS.DAQ_MASTER', kind: 'command', label: '任务下发/数据查询', docRef: '系统间交互详情' },
  { edgeId: 'E16', from: 'SYS.IOT', to: 'SYS.SAFETY', kind: 'data', label: '安全管家/监控/灯光空调高效互动', docRef: '智慧实验室物联网系统' },
  { edgeId: 'E17', from: 'SYS.IMAGE', to: 'SYS.DAQ_MASTER', kind: 'data', label: '图像识别/安全管家/第三方传感器多端口汇聚', docRef: '检测数据采集系统' },
  { edgeId: 'E18', from: 'SYS.DAQ_MASTER', to: 'SYS.DB', kind: 'data', label: '主分共用数据库（免接口同步防错乱）', docRef: '数采方案介绍' },
];

/** 快照契约对齐：所有对象状态经 {nodeId,status,values,updatedAt,dataState,source} 进出，source 扩展枚举 */
export type TwinSource = 'daq' | 'dispatch' | 'iot' | 'lims' | 'workstation';
