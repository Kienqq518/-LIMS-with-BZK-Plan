/**
 * 透明检测报告 · 报告级溯源二维码 Mock 服务（原型）
 *
 * 职责（对应设计文档 docs/superpowers/specs/2026-08-07-transparent-report-qr-design.md）：
 *  1. 报告码映射（独立命名空间，复用短链 QR 基建）
 *  2. 八维度信息聚合快照（mock）
 *  3. 分级公开引擎：按「等级 × 八维度公开矩阵」过滤字段
 *  4. 能力门禁 + 实验室授权等级上限（B 可选走预留）
 */
(function (global) {
  /** 报告溯源码公网 Base（部署形态：公网可扫） */
  var REPORT_BASE = 'https://lims-plan.vercel.app/rl/';
  /** 扫码落地公开页 */
  var VERIFY_PAGE = 'report-verify.html?code=';

  /** 实验室授权透明等级（§12.1-A）：单报告可选等级 ≤ min(能力门禁, 授权等级) */
  var AUTHORIZED_LEVEL = 3;
  /** 当前能力可真实出具的等级（一/二级依赖尚未就绪的模块） */
  var CAPABILITY_ISSUABLE = [3, 4];

  /** 四级等级定义 */
  var LEVELS = [
    { level: 1, name: '一级 · 全要素透明报告', brief: '无人化试验 + 全程连续视频 + 实时监控 + 全自动闭环、人员不可篡改' },
    { level: 2, name: '二级 · 可视化透明报告', brief: '八维度完整 + 关键节点视频；高自动化、少量人工复核' },
    { level: 3, name: '三级 · 可追溯透明报告', brief: '八维度核心信息 + 2~5 张关键照片、无视频；修改留痕' },
    { level: 4, name: '四级 · 可公示透明报告', brief: '最低合规信息、无影像、人工录入为主' }
  ];

  /**
   * 判断某等级能否真实出具（能力门禁 + 授权上限）
   * @returns {{ ok:boolean, blockedBy:('capability'|'authorized'|null), missing:string[], reason:string }}
   */
  function canIssue(level) {
    // 说明：等级数字越小透明度越高（一级最高）。授权上限 = 不得比授权等级更透明。
    var missing = MISSING_BY_LEVEL[level] || [];
    if (CAPABILITY_ISSUABLE.indexOf(level) < 0) {
      return { ok: false, blockedBy: 'capability', missing: missing, note: '', reason: '能力未就绪：' + missing.join('、') };
    }
    if (level < AUTHORIZED_LEVEL) {
      // 比授权更透明 → 超出授权，需重新评定
      return { ok: false, blockedBy: 'authorized', missing: [], note: '', reason: '超出实验室授权等级（当前授权 ' + levelName(AUTHORIZED_LEVEL) + '），须重新评定授权后方可出具' };
    }
    var note = (level > AUTHORIZED_LEVEL) ? '低于实验室授权等级（选低，业务确认即可，不属降级出具）' : '';
    return { ok: true, blockedBy: null, missing: [], note: note, reason: '可出具' };
  }

  /** 各等级当前缺失能力（用于门禁提示与"可选走预留"登记） */
  var MISSING_BY_LEVEL = {
    1: ['无人化试验', '全程连续视频', '实时监控', '全链路自动闭环', '区块链存证'],
    2: ['关键节点视频（视觉节点硬件即将就绪）', '设备运行参数自动采集', '数据自动流转'],
    3: [],
    4: []
  };

  function levelName(level) {
    for (var i = 0; i < LEVELS.length; i++) if (LEVELS[i].level === level) return LEVELS[i].name;
    return '未知等级';
  }

  /** 报告码映射（独立命名空间）；status: valid | revoked | superseded（§12.1-B） */
  var registry = {
    R3a2K: { reportNo: 'SC2026/0099-01', level: 3, status: 'valid', createdAt: '2026-07-17 16:20' },
    R4b7M: { reportNo: 'SCZN202508/0006-01', level: 4, status: 'valid', createdAt: '2026-07-15 11:05' },
    R2c9X: { reportNo: 'SCZN202508/0007-01', level: 2, status: 'valid', createdAt: '2026-07-16 09:40' },
    R3rev: { reportNo: 'SCZN202508/0005-01', level: 3, status: 'revoked', createdAt: '2026-07-14 10:00', revokedAt: '2026-07-18 14:22', revokeReason: '出具后发现引用标准版本有误，报告召回' },
    R3old: { reportNo: 'SC2026/0099-00', level: 3, status: 'superseded', supersededBy: 'R3a2K', createdAt: '2026-07-16 18:00', supersededAt: '2026-07-17 16:20' },
    /** 四级 · 已作废 / 已换版演示码（扫码永久可查，醒目标注状态） */
    R4rev: { reportNo: 'SCZN202508/0008-01', level: 4, status: 'revoked', createdAt: '2026-07-15 11:05', revokedAt: '2026-07-20 09:18', revokeReason: '出具后委托方撤回委托，本报告作废召回' },
    R4old: { reportNo: 'SCZN202508/0006-00', level: 4, status: 'superseded', supersededBy: 'R4b7M', createdAt: '2026-07-14 16:40', supersededAt: '2026-07-15 11:05' }
  };

  /** 连续型温湿度曲线 mock（P1 硬目标：数采回传） */
  function mockRuntime(base, amp) {
    var pts = [];
    for (var i = 0; i < 24; i++) {
      pts.push({ t: (i * 5) + 's', v: +(base + Math.sin(i / 3) * amp).toFixed(2) });
    }
    return pts;
  }

  function mockCurve(baseT, baseH) {
    var pts = [];
    for (var i = 0; i < 12; i++) {
      pts.push({
        t: (9 + i) + ':00',
        temp: +(baseT + Math.sin(i / 2) * 0.8).toFixed(1),
        humidity: +(baseH + Math.cos(i / 3) * 2).toFixed(0)
      });
    }
    return pts;
  }

  /** 八维度快照（签发时冻结）；此处为 mock，真实由聚合器归集 */
  var snapshots = {
    'SC2026/0099-01': {
      reportNo: 'SC2026/0099-01', testItemNo: 'TI-0099-01', frozenAt: '2026-07-17 16:20',
      meta: {
        sampleName: '绝缘操作杆', spec: '10kV', clientName: '杭州数蚕智能科技有限公司', org: '杭州应敏科技有限公司', conclusion: '合格',
        testCategory: '例行试验',
        testItems: ['外观及尺寸', '交流耐压试验', '抗弯动负荷试验', '抗弯静负荷试验']
      },
      person: {
        name: '张伟', certNo: 'ZW-2024-018', authorization: '高压试验授权', training: null,
        qualCert: { name: '高压电气试验员资格证', no: 'ZJ-HV-2024-018', validTo: '2026-12-31', image: 'assets/report-trace/qual-cert.svg' },
        equipOpCert: { name: '工频耐压试验装置操作能力证', no: 'OP-YQ035-2025-06', validTo: '2027-06-30', image: 'assets/report-trace/equip-op-cert.svg' }
      },
      persons: [
        {
          name: '张伟', certNo: 'ZW-2024-018',
          qualCert: { name: '高压电气试验员资格证', no: 'ZJ-HV-2024-018', validTo: '2026-12-31', image: 'assets/report-trace/qual-cert.svg' },
          equipOpCert: { name: '工频耐压试验装置操作能力证', no: 'OP-YQ035-2025-06', validTo: '2027-06-30', image: 'assets/report-trace/equip-op-cert.svg' }
        },
        {
          name: '孙丽', certNo: 'SL-2023-041',
          qualCert: { name: '高压电气试验员资格证', no: 'ZJ-HV-2023-0418', validTo: '2026-12-31', image: 'assets/report-trace/qual-cert.svg' },
          equipOpCert: { name: '工频耐压试验装置操作能力证', no: 'OP-YQ035-2025-06', validTo: '2027-06-30', image: 'assets/report-trace/equip-op-cert.svg' }
        }
      ],
      equipment: {
        code: 'YQ-035', name: '工频耐压试验装置', model: 'YFG-150A',
        calibCertNo: 'JD2026-0512', calibCertImage: 'assets/report-trace/calib-cert-jd2026-0512.jpg',
        nextCalib: '2027-05-11', calibOrg: '浙江省计量科学研究院',
        maintainRecords: [
          { date: '2026-03-12', type: '定期保养', item: '电极清洁 / 接地检查', result: '正常', by: '周强' },
          { date: '2026-06-08', type: '故障维修', item: '高压输出接触不良', result: '已更换接头', by: '浙江省计量科学研究院' }
        ],
        runtime: {
          source: '上位机采集',
          equipment: 'YQ-035',
          testName: '交流耐压试验',
          series: [
            { name: '试验电压', unit: 'kV', points: mockRuntime(45, 0.4) },
            { name: '泄漏电流', unit: 'mA', points: mockRuntime(0.32, 0.04) }
          ]
        }
      },
      material: {
        sampleNo: 'SCZN202508/0009-0101', source: '客户送样',
        consumables: [
          { name: '铜电极', spec: 'Φ25 mm', batch: 'DJ-2026-0312', certNo: 'HGZ-2026-0881', supplier: '杭州某某金属', validTo: '2027-03-11', conclusion: '合格' },
          { name: '绝缘垫', spec: '10 mm', batch: 'JD-2026-0201', certNo: 'HGZ-2026-0440', supplier: '宁波某某橡塑', validTo: '2027-02-01', conclusion: '合格' }
        ],
        flow: ['样品收样', '样品制备', '样品发样', '试样分发', '样品还样', '样品退样'],
        flowNodes: [
          { key: 'receive', title: '样品收样', timeLabel: '收样时间', people: [{ role: '收样人', name: '李敏', time: '2026-07-10 09:12' }] },
          { key: 'prepare', title: '样品制备', timeLabel: '制备时间', people: [{ role: '制备人', name: '张伟', time: '2026-07-11 10:30' }] },
          { key: 'dispatch', title: '样品发样', timeLabel: '领样时间', people: [{ role: '领样人', name: '张伟', time: '2026-07-11 14:05' }] },
          { key: 'distribute', title: '试样分发', timeLabel: '领样时间', people: [
            { role: '检测员', name: '张伟', time: '2026-07-12 08:30' },
            { role: '检测员', name: '孙丽', time: '2026-07-12 08:32' }
          ] },
          { key: 'returnLab', title: '样品还样', timeLabel: '还样时间', people: [
            { role: '检测员', name: '张伟', time: '2026-07-13 10:00' },
            { role: '检测员', name: '孙丽', time: '2026-07-13 10:18' }
          ] },
          { key: 'returnOut', title: '样品退样', mode: 'client', method: 'express', timeLabel: '发快递时间', tracking: '顺丰 SF3142891760',
            people: [{ role: '经办人', name: '李敏', time: '2026-07-14 16:20' }] }
        ],
        distribution: [
          {
            picker: '张伟', time: '2026-07-12 08:30', specimens: ['SCZN202508/0009-0101-01', 'SCZN202508/0009-0101-03']
          },
          {
            picker: '孙丽', time: '2026-07-12 08:32', specimens: ['SCZN202508/0009-0101-02', 'SCZN202508/0009-0101-04']
          }
        ],
        returns: [
          {
            returner: '张伟', time: '2026-07-13 10:00', specimens: ['SCZN202508/0009-0101-01', 'SCZN202508/0009-0101-03'],
            dest: '样品库 · 待处置',
            photos: [
              { label: '还样交接单', src: 'assets/report-trace/photo-07-sign.jpg', uploadedAt: '2026-07-13 10:00' }
            ]
          },
          {
            returner: '孙丽', time: '2026-07-13 10:18', specimens: ['SCZN202508/0009-0101-02', 'SCZN202508/0009-0101-04'],
            dest: '样品库 · 待处置',
            photos: [
              { label: '还样交接单', src: 'assets/report-trace/photo-07-sign.jpg', uploadedAt: '2026-07-13 10:18' }
            ]
          }
        ]
      },
      method: {
        stdCode: 'DL/T 878', stdName: '带电作业用绝缘工具试验导则',
        dataSummary: '外观及尺寸合格；交流耐压 45kV/1min 通过；抗弯动负荷 500N、抗弯静负荷 350N 均合格',
        sop: '绝缘操作杆型式试验作业指导书 SOP-ROD-01', sopCode: 'SOP-ROD-01', calcLocked: false,
        judgments: [
          {
            testName: '外观及尺寸', specimenNo: 'SCZN202508/0009-0101-01', sampleName: '绝缘操作杆',
            stdFile: 'DL/T 878-2004',
            process: '目视检查表面 → 测量有效绝缘长度与直径 → 比对标准要求',
            judgeDesc: '表面应光洁、无裂纹、无气泡、无划伤；有效绝缘长度与直径应符合规定。',
            formula: '有效绝缘长度 ≥ 700 mm（10~35kV 级）；直径符合产品规定',
            measured: '外观光洁无缺陷；有效绝缘长度 1200 mm；直径 30 mm',
            calculated: '有效绝缘长度 = 1200 mm',
            nominal: '有效绝缘长度 ≥ 700 mm；直径 30 mm',
            condition: '外观无缺陷且尺寸符合要求 → 合格',
            conclusion: '合格'
          },
          {
            testName: '交流耐压试验', specimenNo: 'SCZN202508/0009-0101-02', sampleName: '绝缘操作杆',
            stdFile: 'DL/T 878-2004',
            process: '预处理 → 装夹 → 升压至 45 kV → 保持 1 min → 观察击穿/闪络、读取泄漏电流 → 人工录入系统 → 降压',
            judgeDesc: '绝缘操作杆应能承受规定工频耐压，保持期间无击穿、无闪络；泄漏电流在电压稳定后取值，由检测员录入系统。',
            formula: '判定：U实测 ≥ 45 kV 且 t ≥ 1 min 且无击穿/闪络',
            measured: '45.0 kV / 1 min / 0.32 mA / 无击穿、无闪络',
            calculated: 'I泄漏 = 0.32 mA',
            nominal: 'U试验 = 45 kV，保持 1 min',
            condition: '达到规定试验电压且保持规定时间，无击穿、无闪络 → 合格',
            conclusion: '合格'
          },
          {
            testName: '抗弯动负荷试验', specimenNo: 'SCZN202508/0009-0101-03', sampleName: '绝缘操作杆',
            stdFile: 'DL/T 878-2004',
            process: '两端支撑固定 → 施加规定动负荷 → 保持规定时间 → 卸载后检查永久变形与损伤',
            judgeDesc: '在规定动负荷下保持规定时间，卸载后应无永久变形、无开裂或损伤。',
            formula: '动负荷 F动 = 规定值（本级 500 N）；保持时间 t ≥ 1 min',
            measured: '500 N / 1 min / 最大挠度 18 mm / 无永久变形、无损伤',
            calculated: '最大挠度 = 18 mm',
            nominal: 'F动 = 500 N，保持 1 min',
            condition: '保持规定动负荷与时间，卸载后无永久变形、无损伤 → 合格',
            conclusion: '合格'
          },
          {
            testName: '抗弯静负荷试验', specimenNo: 'SCZN202508/0009-0101-04', sampleName: '绝缘操作杆',
            stdFile: 'DL/T 878-2004',
            process: '两端支撑 → 施加规定静负荷 → 保持规定时间 → 检查挠度与损伤',
            judgeDesc: '在规定静负荷下保持规定时间，挠度在允许范围内、无损伤。',
            formula: '静负荷 F静 = 规定值（本级 350 N）；保持时间 t ≥ 5 min',
            measured: '350 N / 5 min / 挠度 12 mm / 无损伤',
            calculated: '挠度 = 12 mm',
            nominal: 'F静 = 350 N，保持 5 min',
            condition: '保持规定静负荷与时间，挠度合格、无损伤 → 合格',
            conclusion: '合格'
          }
        ]
      },
      env: {
        // 数采「设备配置 → 安全管家配置」已为该设备试验项绑定温湿度节点 → 走组态物联终端
        boundHumidityNode: { terminalName: '温湿度RK1A', nodeId: 'D1XQ912MK88T' },
        independentSensor: null,
        source: 'iot', nodeId: 'D1XQ912MK88T',
        avgTempHumidity: '23.4℃ / 51%RH', curve: mockCurve(23.4, 51), layout: null,
        specimenCurves: [
          { testName: '外观及尺寸', specimenNo: 'SCZN202508/0009-0101-01', avg: '23.1℃ / 50%RH' },
          { testName: '交流耐压试验', specimenNo: 'SCZN202508/0009-0101-02', avg: '23.4℃ / 51%RH' },
          { testName: '抗弯动负荷试验', specimenNo: 'SCZN202508/0009-0101-03', avg: '23.5℃ / 52%RH' },
          { testName: '抗弯静负荷试验', specimenNo: 'SCZN202508/0009-0101-04', avg: '23.6℃ / 51%RH' }
        ]
      },
      flow: {
        startEnd: '2026-07-10 ~ 2026-07-13',
        receive: { person: '李敏', time: '2026-07-10 09:12' },
        tests: [
          {
            name: '外观及尺寸', equipment: 'KC-05',
            inspector: '张伟', startAt: '2026-07-12 08:30', endAt: '2026-07-12 09:10',
            recorder: '张伟', recordAt: '2026-07-12 09:12',
            columns: ['试样编号', '外观', '有效绝缘长度/mm', '直径/mm', '结论'],
            rows: [
              ['SCZN202508/0009-0101-01', '光洁、无裂纹气泡', '1200', '30', '合格']
            ],
            specimens: [
              { specimenNo: 'SCZN202508/0009-0101-01', inspector: '张伟', startAt: '2026-07-12 08:30', endAt: '2026-07-12 09:10', recorder: '张伟', recordAt: '2026-07-12 09:12', values: ['光洁、无裂纹气泡', '1200', '30', '合格'] }
            ]
          },
          {
            name: '交流耐压试验', equipment: 'YQ-035',
            inspector: '孙丽', startAt: '2026-07-12 09:20', endAt: '2026-07-12 11:35',
            recorder: '孙丽', recordAt: '2026-07-12 11:40',
            columns: ['试样编号', '试验电压/kV', '持续时间/min', '泄漏电流/mA', '现象', '结论'],
            rows: [
              ['SCZN202508/0009-0101-02', '45', '1', '0.32', '无击穿、无闪络', '合格']
            ],
            specimens: [
              { specimenNo: 'SCZN202508/0009-0101-02', inspector: '孙丽', startAt: '2026-07-12 09:20', endAt: '2026-07-12 11:30', recorder: '孙丽', recordAt: '2026-07-12 11:40', values: ['45', '1', '0.32', '无击穿、无闪络', '合格'] }
            ]
          },
          {
            name: '抗弯动负荷试验', equipment: 'LJ-03',
            inspector: '张伟', startAt: '2026-07-12 13:10', endAt: '2026-07-12 13:48',
            recorder: '张伟', recordAt: '2026-07-12 13:48',
            columns: ['试样编号', '施加动负荷/N', '保持时间/min', '最大挠度/mm', '现象', '结论'],
            rows: [
              ['SCZN202508/0009-0101-03', '500', '1', '18', '无永久变形、无损伤', '合格']
            ],
            specimens: [
              { specimenNo: 'SCZN202508/0009-0101-03', inspector: '张伟', startAt: '2026-07-12 13:10', endAt: '2026-07-12 13:45', recorder: '张伟', recordAt: '2026-07-12 13:48', values: ['500', '1', '18', '无永久变形、无损伤', '合格'] }
            ]
          },
          {
            name: '抗弯静负荷试验', equipment: 'LJ-03',
            inspector: '孙丽', startAt: '2026-07-12 14:00', endAt: '2026-07-12 14:35',
            recorder: '孙丽', recordAt: '2026-07-12 14:35',
            columns: ['试样编号', '施加静负荷/N', '保持时间/min', '挠度/mm', '现象', '结论'],
            rows: [
              ['SCZN202508/0009-0101-04', '350', '5', '12', '无损伤', '合格']
            ],
            specimens: [
              { specimenNo: 'SCZN202508/0009-0101-04', inspector: '孙丽', startAt: '2026-07-12 14:00', endAt: '2026-07-12 14:30', recorder: '孙丽', recordAt: '2026-07-12 14:35', values: ['350', '5', '12', '无损伤', '合格'] }
            ]
          }
        ],
        report: {
          compiler: { name: '王芳', time: '2026-07-13 15:00' },
          reviewer: { name: '刘洋', time: '2026-07-16 10:30' },
          approver: { name: '陈建国', time: '2026-07-17 16:20' }
        },
        nodes: [
          { node: '收样', time: '2026-07-10 09:12', owner: '李敏', photos: [{ node: '收样', label: '样品外观照', takenAt: '07-10 09:15' }] },
          { node: '制样', time: '2026-07-11 10:30', owner: '张伟', photos: [{ node: '制样', label: '制样过程照', takenAt: '07-11 10:35' }] },
          { node: '检测', time: '2026-07-12 14:00', owner: '张伟', photos: [{ node: '检测', label: '加载读数照', takenAt: '07-12 14:20' }] },
          { node: '复核', time: '2026-07-13 09:00', owner: '王芳', photos: [] },
          { node: '报告', time: '2026-07-13 15:00', owner: '王芳', photos: [] }
        ],
        fullNodes: [
          { node: '委托登记', owner: '梁倩', time: '2026-07-09 16:20' },
          { node: '样品收样', owner: '李敏', time: '2026-07-10 09:12' },
          { node: '委托确认', owner: '李敏', time: '2026-07-10 09:40' },
          { node: '样品制备', owner: '张伟', time: '2026-07-11 10:30' },
          { node: '样品发样', owner: '张伟', time: '2026-07-11 14:05' },
          { node: '试样分发', owner: '张伟', time: '2026-07-12 08:30' },
          { node: '试验检测', owner: '张伟', time: '2026-07-12 08:30 ~ 14:35' },
          { node: '样品还样', owner: '张伟', time: '2026-07-13 10:00' },
          { node: '组内审核', owner: '王芳', time: '2026-07-13 09:00 ~ 09:20' },
          { node: '数据审核', owner: '刘洋', time: '2026-07-16 10:00' },
          { node: '报告编制', owner: '王芳', time: '2026-07-13 15:00' },
          { node: '报告审核', owner: '刘洋', time: '2026-07-16 10:30' },
          { node: '报告签发', owner: '陈建国', time: '2026-07-17 16:20' },
          { node: '报告处理', owner: '李敏', time: '2026-07-17 17:00' },
          { node: '收费审批', owner: '赵敏', time: '2026-07-18 09:00' },
          { node: '报告发放', owner: '李敏', time: '2026-07-18 10:00' },
          { node: '任务归档', owner: '王芳', time: '2026-07-18 11:00' }
        ]
      },
      image: {
        photos: [
          { node: '收样', label: '样品外观正面', src: 'assets/report-trace/photo-receive-1.svg', uploadedAt: '2026-07-10 09:16' },
          { node: '收样', label: '样品外观侧面', src: 'assets/report-trace/photo-receive-2.svg', uploadedAt: '2026-07-10 09:17' },
          { node: '制样', label: '制样过程照', src: 'assets/report-trace/photo-prepare-1.svg', uploadedAt: '2026-07-11 10:36' },
          { node: '检测', testName: '外观及尺寸', label: '外观检查照', src: 'assets/report-trace/photo-02-studio.jpg', uploadedAt: '2026-07-12 08:42' },
          { node: '检测', testName: '交流耐压试验', label: '装样照', src: 'assets/report-trace/photo-04-ac.jpg', uploadedAt: '2026-07-12 09:28' },
          { node: '检测', testName: '交流耐压试验', label: '加载读数照', src: 'assets/report-trace/photo-06-robot.jpg', uploadedAt: '2026-07-12 11:22' },
          { node: '检测', testName: '抗弯动负荷试验', label: '加载照', src: 'assets/report-trace/photo-05-bend.jpg', uploadedAt: '2026-07-12 13:22' },
          { node: '检测', testName: '抗弯静负荷试验', label: '加载照', src: 'assets/report-trace/photo-01-bench.jpg', uploadedAt: '2026-07-12 14:08' },
          { node: '还样', label: '还样交接单-张伟', src: 'assets/report-trace/photo-07-sign.jpg', uploadedAt: '2026-07-13 10:00' },
          { node: '还样', label: '还样交接单-孙丽', src: 'assets/report-trace/photo-07-sign.jpg', uploadedAt: '2026-07-13 10:18' }
        ],
        videos: null,          // 三级仅关键照片，无视频
        liveMonitorUrl: null
      },
      dataflow: {
        mode: '部分环节人工录入：设备采集后需人工录入系统，计算过程有人工参与，修改全程留痕可追溯',
        editable: '允许修改并全程留痕可追溯',
        collectItems: [
          { testName: '外观及尺寸', equipment: 'KC-05', collectMode: '人工录入' },
          { testName: '交流耐压试验', equipment: 'YQ-035', collectMode: '人工录入' },
          { testName: '抗弯动负荷试验', equipment: 'LJ-03', collectMode: '设备直采' },
          { testName: '抗弯静负荷试验', equipment: 'LJ-03', collectMode: '设备直采' }
        ],
        reworks: [
          {
            testName: '交流耐压试验', specimenNo: 'SCZN202508/0009-0101-02', field: '泄漏电流',
            returnedBy: '王芳', returnedRole: '组内审核', returnedAt: '2026-07-13 09:00',
            reason: '泄漏电流读数与曲线不符，疑似记录笔误，退回检测员复核',
            reworkBy: '孙丽', before: '0.52 mA', after: '0.32 mA', reworkAt: '2026-07-13 09:12',
            reReviewedBy: '王芳', reReviewedRole: '组内审核', reReviewedAt: '2026-07-13 09:20'
          }
        ],
        changeLog: [
          {
            testName: '外观及尺寸',
            specimenNo: 'SCZN202508/0009-0101-01',
            field: '有效绝缘长度',
            who: '张伟',
            at: '2026-07-12 09:12',
            reason: '人工录入笔误，按卡尺读数更正',
            before: '1198 mm',
            after: '1200 mm',
            approver: '王芳',
            approvedAt: '2026-07-13 09:20'
          },
          {
            testName: '交流耐压试验',
            specimenNo: 'SCZN202508/0009-0101-02',
            field: '泄漏电流',
            who: '孙丽',
            at: '2026-07-13 09:12',
            reason: '组内审核退回复核，按仪器读数更正',
            before: '0.52 mA',
            after: '0.32 mA',
            approver: '王芳',
            approvedAt: '2026-07-13 09:20'
          }
        ]
      }
    },
    'SCZN202508/0006-01': {
      reportNo: 'SCZN202508/0006-01', testItemNo: 'TI-0006-01', frozenAt: '2026-07-15 11:05',
      meta: { sampleName: '废水', spec: '—', clientName: '某某化工厂', org: '杭州应敏科技有限公司', conclusion: '合格', testCategory: '委托检验' },
      person: { name: '赵强', certNo: null, authorization: null, training: null },
      equipment: { code: 'YQ-102', name: 'COD消解仪', model: 'HCA-102', calibCertNo: null, nextCalib: null, calibOrg: null, runtimeData: null, runtimeCurve: null },
      material: { sampleNo: 'SCZN202508/0006-0101', source: '客户送样', flow: null, consumable: null },
      method: { stdCode: 'HJ 828', stdName: '水质 化学需氧量的测定', dataSummary: null, sop: null, calcLocked: false },
      env: { boundHumidityNode: null, independentSensor: null, source: 'manual', nodeId: null, avgTempHumidity: null, curve: null, layout: null },
      flow: {
        startEnd: '2026-07-14 ~ 2026-07-15', nodes: null,
        fullNodes: [
          { node: '委托登记', owner: '梁倩', time: '2026-07-13 15:00' },
          { node: '样品收样', owner: '李敏', time: '2026-07-14 09:00' },
          { node: '委托确认', owner: '李敏', time: '2026-07-14 09:20' },
          { node: '样品制备', owner: '赵强', time: '2026-07-14 13:00' },
          { node: '样品发样', owner: '赵强', time: '2026-07-14 13:30' },
          { node: '试样分发', owner: '赵强', time: '2026-07-14 14:00' },
          { node: '试验检测', owner: '赵强', time: '2026-07-14 14:00 ~ 2026-07-15 09:00' },
          { node: '样品还样', owner: '赵强', time: '2026-07-15 09:10' },
          { node: '组内审核', owner: '王芳', time: '2026-07-15 09:30' },
          { node: '数据审核', owner: '刘洋', time: '2026-07-15 10:00' },
          { node: '报告编制', owner: '王芳', time: '2026-07-15 10:20' },
          { node: '报告审核', owner: '刘洋', time: '2026-07-15 10:40' },
          { node: '报告签发', owner: '陈建国', time: '2026-07-15 11:05' },
          { node: '报告处理', owner: '李敏', time: '2026-07-15 13:00' },
          { node: '收费审批', owner: '赵敏', time: '2026-07-15 14:00' },
          { node: '报告发放', owner: '李敏', time: '2026-07-15 15:00' },
          { node: '任务归档', owner: '王芳', time: '2026-07-15 16:00' }
        ]
      },
      image: { photos: null, videos: null, liveMonitorUrl: null },
      dataflow: { mode: '人工录入、简单存储', editable: '无强制防篡改机制', changeLog: null }
    },
    'SCZN202508/0007-01': {
      reportNo: 'SCZN202508/0007-01', testItemNo: 'TI-0007-01', frozenAt: '2026-07-16 09:40',
      meta: {
        sampleName: '绝缘操作杆', spec: '12kV', clientName: '浙江某某供电所', org: '杭州应敏科技有限公司', conclusion: '合格',
        testCategory: '抽样检验',
        testItems: ['外观及尺寸', '交流耐压试验', '抗弯动负荷试验', '抗弯静负荷试验']
      },
      person: {
        name: '孙丽', certNo: 'SL-2023-041', authorization: '高压试验授权', training: null,
        qualCert: { name: '高压电气试验员资格证', no: 'ZJ-HV-2023-0418', validTo: '2026-12-31', image: 'assets/report-trace/qual-cert.svg' },
        equipOpCert: { name: '工频耐压试验装置操作能力证', no: 'OP-YQ078-2025-06', validTo: '2027-06-30', image: 'assets/report-trace/equip-op-cert.svg' }
      },
      persons: [
        {
          name: '孙丽', certNo: 'SL-2023-041',
          qualCert: { name: '高压电气试验员资格证', no: 'ZJ-HV-2023-0418', validTo: '2026-12-31', image: 'assets/report-trace/qual-cert.svg' },
          equipOpCert: { name: '工频耐压试验装置操作能力证', no: 'OP-YQ078-2025-06', validTo: '2027-06-30', image: 'assets/report-trace/equip-op-cert.svg' }
        },
        {
          name: '陈昊', certNo: 'CH-2024-018',
          qualCert: { name: '高压电气试验员资格证', no: 'ZJ-HV-2024-0662', validTo: '2027-05-31', image: 'assets/report-trace/qual-cert.svg' },
          equipOpCert: { name: '工频耐压试验装置操作能力证', no: 'OP-YQ078-2025-11', validTo: '2027-06-30', image: 'assets/report-trace/equip-op-cert.svg' }
        }
      ],
      equipment: {
        code: 'YQ-078', name: '工频耐压试验装置', model: 'YFG-150A',
        calibCertNo: 'JD2026-0330', calibCertImage: 'assets/report-trace/calib-cert-jd2026-0512.jpg',
        nextCalib: '2027-03-29', calibOrg: '浙江省计量科学研究院',
        maintainRecords: [
          { date: '2026-02-18', type: '定期保养', item: '电极清洗 / 绝缘检查', result: '正常', by: '周强' },
          { date: '2026-05-20', type: '定期保养', item: '水槽密封与接地复测', result: '正常', by: '周强' },
          { date: '2026-07-02', type: '校准后确认', item: '输出电压比对', result: '合格', by: '孙丽' }
        ],
        runtime: {
          source: '上位机采集',
          equipment: 'YQ-078',
          testName: '交流耐压试验',
          series: [
            { name: '试验电压', unit: 'kV', points: mockRuntime(12, 0.15) },
            { name: '泄漏电流', unit: 'mA', points: mockRuntime(0.35, 0.04) }
          ]
        }
      },
      material: {
        sampleNo: 'SCZN202508/0007-037', source: '客户送样',
        flow: ['收样 07-14', '制样 07-15', '检测 07-15', '复核 07-16'],
        flowNodes: [
          { key: 'receive', title: '样品收样', timeLabel: '收样时间', people: [{ role: '收样人', name: '李敏', time: '2026-07-14 08:40' }] },
          { key: 'prepare', title: '样品制备', timeLabel: '制备时间', people: [{ role: '制备人', name: '孙丽', time: '2026-07-15 09:10' }] },
          { key: 'distribute', title: '试样分发', timeLabel: '领样时间', people: [{ role: '检测员', name: '孙丽', time: '2026-07-15 10:00' }] },
          { key: 'returnLab', title: '样品还样', timeLabel: '还样时间', people: [{ role: '检测员', name: '孙丽', time: '2026-07-15 16:00' }] }
        ],
        consumables: [
          { name: '铝箔纸 / 导电胶带', usage: '分段耐压时缠绕/贴合作电极', spec: '导电铝箔胶带 50mm', batch: 'DT-2026-0701', certNo: 'HGZ-2026-0701', supplier: '3M 中国', validTo: '2028-07-01', conclusion: '合格', usedIn: ['交流耐压试验'] },
          { name: '细裸铜线', usage: '缠绕作电极或连接高压/接地端', spec: 'TR 0.8mm 裸铜线', batch: 'TL-2026-0620', certNo: 'HGZ-2026-0620', supplier: '浙江某某电工', validTo: '2029-06-20', conclusion: '合格', usedIn: ['交流耐压试验'] },
          { name: '无水乙醇', usage: '打压前清洁绝缘杆表面', spec: '分析纯 AR 99.9%', batch: 'YC-2026-0705', certNo: 'HGZ-2026-0705', supplier: '国药集团化学试剂', validTo: '2027-07-05', conclusion: '合格', usedIn: ['交流耐压试验'] },
          { name: '无尘布', usage: '配合乙醇擦拭、不掉毛', spec: '无尘布 100×100 mm', batch: 'CB-2026-0611', certNo: 'HGZ-2026-0611', supplier: '苏州某某耗材', validTo: '2028-06-11', conclusion: '合格', usedIn: ['交流耐压试验'] },
          { name: '绝缘胶带（电工胶布）', usage: '固定测试线、临时绝缘隔离', spec: 'PVC 电工胶带 18mm', batch: 'JD-2026-0509', certNo: 'HGZ-2026-0509', supplier: '正泰电工', validTo: '2029-05-09', conclusion: '合格', usedIn: ['交流耐压试验'] },
          { name: '橡胶垫片 / 绝缘橡胶板', usage: '夹具与绝缘杆间保护垫，防止压碎', spec: '耐压绝缘橡胶板 5mm', batch: 'XJ-2026-0418', certNo: 'HGZ-2026-0418', supplier: '某某橡塑', validTo: '2028-04-18', conclusion: '合格', usedIn: ['抗弯动负荷试验', '抗弯静负荷试验'] },
          { name: '滑石粉', usage: '支撑点微量涂抹防机械刮伤', spec: '工业滑石粉 800 目', batch: 'HS-2026-0322', certNo: 'HGZ-2026-0322', supplier: '某某矿产', validTo: '2029-03-22', conclusion: '合格', usedIn: ['抗弯动负荷试验', '抗弯静负荷试验'] },
          { name: '不干胶标签（合格证签）', usage: '测试后即时粘贴状态标签防混淆', spec: '热敏不干胶 40×60 mm', batch: 'BQ-2026-0705', certNo: 'HGZ-2026-0705B', supplier: '某某标签', validTo: '2028-07-05', conclusion: '合格', usedIn: ['外观及尺寸', '交流耐压试验', '抗弯动负荷试验', '抗弯静负荷试验'] }
        ],
        distribution: [
          {
            picker: '孙丽', time: '2026-07-15 09:40', specimens: ['SCZN202508/0007-03701', 'SCZN202508/0007-03702'],
            photos: [
              { label: '领样签字单', src: 'assets/report-trace/photo-07-sign.jpg', uploadedAt: '2026-07-15 09:40' }
            ],
            clips: [
              { id: 'pick-sun', node: '领样-孙丽', label: '领样确认', poster: 'assets/report-trace/video-pickup-sun.png', startTime: '2026-07-15 09:40:05', endTime: '2026-07-15 09:41:20', durationSec: 12 }
            ]
          },
          {
            picker: '陈昊', time: '2026-07-15 09:42', specimens: ['SCZN202508/0007-03703', 'SCZN202508/0007-03704'],
            photos: [
              { label: '领样签字单', src: 'assets/report-trace/photo-07-sign.jpg', uploadedAt: '2026-07-15 09:42' },
              { label: '试样外观核对', src: 'assets/report-trace/photo-test-1.svg', uploadedAt: '2026-07-15 09:43' }
            ],
            clips: [
              { id: 'pick-chen', node: '领样-陈昊', label: '领样确认', poster: 'assets/report-trace/video-pickup-chen.png', startTime: '2026-07-15 09:42:03', endTime: '2026-07-15 09:43:10', durationSec: 11 },
              { id: 'pick-chen-check', node: '领样-陈昊-2', label: '试样核对', poster: 'assets/report-trace/video-pickup-check.png', startTime: '2026-07-15 09:43:20', endTime: '2026-07-15 09:44:30', durationSec: 10 }
            ]
          }
        ],
        returns: [
          {
            returner: '孙丽', time: '2026-07-15 15:50', specimens: ['SCZN202508/0007-03701', 'SCZN202508/0007-03702'],
            dest: '样品库 · 待处置',
            photos: [
              { label: '还样交接单', src: 'assets/report-trace/photo-07-sign.jpg', uploadedAt: '2026-07-15 15:50' }
            ]
          },
          {
            returner: '陈昊', time: '2026-07-15 16:00', specimens: ['SCZN202508/0007-03703', 'SCZN202508/0007-03704'],
            dest: '样品库 · 待处置',
            photos: [
              { label: '还样交接单', src: 'assets/report-trace/photo-07-sign.jpg', uploadedAt: '2026-07-15 16:00' }
            ]
          }
        ]
      },
      method: {
        stdCode: 'DL/T 878', stdName: '带电作业用绝缘工具试验导则',
        dataSummary: '外观及尺寸合格；交流耐压 45kV/1min 通过；抗弯动负荷 500N、抗弯静负荷 350N 均合格',
        sop: '绝缘操作杆型式试验作业指导书 SOP-ROD-01', sopCode: 'SOP-ROD-01', calcLocked: true,
        judgments: [
          {
            testName: '外观及尺寸', specimenNo: 'SCZN202508/0007-03701', sampleName: '绝缘操作杆',
            stdFile: 'DL/T 878-2004',
            process: '目视检查表面 → 测量有效绝缘长度与直径 → 比对标准要求',
            judgeDesc: '表面应光洁、无裂纹、无气泡、无划伤；有效绝缘长度与直径应符合规定。',
            formula: '有效绝缘长度 ≥ 700 mm（10~35kV 级）；直径符合产品规定',
            measured: '外观光洁无缺陷；有效绝缘长度 1200 mm；直径 30 mm',
            calculated: '有效绝缘长度 = 1200 mm',
            nominal: '有效绝缘长度 ≥ 700 mm；直径 30 mm',
            condition: '外观无缺陷且尺寸符合要求 → 合格',
            conclusion: '合格'
          },
          {
            testName: '交流耐压试验', specimenNo: 'SCZN202508/0007-03702', sampleName: '绝缘操作杆',
            stdFile: 'DL/T 878-2004',
            process: '预处理 → 装夹 → 升压至 45 kV → 保持 1 min → 观察击穿/闪络、读取泄漏电流 → 降压',
            judgeDesc: '绝缘操作杆应能承受规定工频耐压，保持期间无击穿、无闪络；泄漏电流在电压稳定后取值。',
            formula: '判定：U实测 ≥ 45 kV 且 t ≥ 1 min 且无击穿/闪络',
            measured: '45.0 kV / 1 min / 0.32 mA / 无击穿、无闪络',
            calculated: 'I泄漏 = 0.32 mA',
            nominal: 'U试验 = 45 kV，保持 1 min',
            condition: '达到规定试验电压且保持规定时间，无击穿、无闪络 → 合格',
            conclusion: '合格'
          },
          {
            testName: '抗弯动负荷试验', specimenNo: 'SCZN202508/0007-03703', sampleName: '绝缘操作杆',
            stdFile: 'DL/T 878-2004',
            process: '两端支撑固定 → 施加规定动负荷 → 保持规定时间 → 卸载后检查永久变形与损伤',
            judgeDesc: '在规定动负荷下保持规定时间，卸载后应无永久变形、无开裂或损伤。',
            formula: '动负荷 F动 = 规定值（本级 500 N）；保持时间 t ≥ 1 min',
            measured: '500 N / 1 min / 最大挠度 18 mm / 无永久变形、无损伤',
            calculated: '最大挠度 = 18 mm',
            nominal: 'F动 = 500 N，保持 1 min',
            condition: '保持规定动负荷与时间，卸载后无永久变形、无损伤 → 合格',
            conclusion: '合格'
          },
          {
            testName: '抗弯静负荷试验', specimenNo: 'SCZN202508/0007-03704', sampleName: '绝缘操作杆',
            stdFile: 'DL/T 878-2004',
            process: '两端支撑 → 施加规定静负荷 → 保持规定时间 → 检查挠度与损伤',
            judgeDesc: '在规定静负荷下保持规定时间，挠度在允许范围内、无损伤。',
            formula: '静负荷 F静 = 规定值（本级 350 N）；保持时间 t ≥ 5 min',
            measured: '350 N / 5 min / 挠度 12 mm / 无损伤',
            calculated: '挠度 = 12 mm',
            nominal: 'F静 = 350 N，保持 5 min',
            condition: '保持规定静负荷与时间，挠度合格、无损伤 → 合格',
            conclusion: '合格'
          }
        ]
      },
      env: {
        boundHumidityNode: null,
        independentSensor: { model: 'RS-WS-WIFI-6' },
        source: 'sensor', nodeId: null,
        avgTempHumidity: '22.8℃ / 49%RH', curve: mockCurve(22.8, 49), layout: null,
        specimenCurves: [
          { testName: '外观及尺寸', specimenNo: 'SCZN202508/0007-03701', avg: '22.5℃ / 49%RH', points: mockCurve(22.5, 49) },
          { testName: '交流耐压试验', specimenNo: 'SCZN202508/0007-03702', avg: '23.0℃ / 50%RH', points: mockCurve(23.0, 50) },
          { testName: '抗弯动负荷试验', specimenNo: 'SCZN202508/0007-03703', avg: '23.1℃ / 51%RH', points: mockCurve(23.1, 51) },
          { testName: '抗弯静负荷试验', specimenNo: 'SCZN202508/0007-03704', avg: '23.2℃ / 50%RH', points: mockCurve(23.2, 50) }
        ]
      },
      flow: {
        startEnd: '2026-07-14 ~ 2026-07-16',
        receive: { person: '李敏', time: '2026-07-14 08:40' },
        tests: [
          {
            name: '外观及尺寸', equipment: 'KC-05',
            inspector: '孙丽', startAt: '2026-07-15 09:50', endAt: '2026-07-15 10:10',
            recorder: '孙丽', recordAt: '2026-07-15 10:12',
            columns: ['试样编号', '外观', '有效绝缘长度/mm', '直径/mm', '结论'],
            rows: [
              ['SCZN202508/0007-03701', '光洁、无裂纹气泡', '1200', '30', '合格']
            ],
            specimens: [
              { specimenNo: 'SCZN202508/0007-03701', inspector: '孙丽', startAt: '2026-07-15 09:50', endAt: '2026-07-15 10:10', recorder: '孙丽', recordAt: '2026-07-15 10:12', values: ['光洁、无裂纹气泡', '1200', '30', '合格'] }
            ]
          },
          {
            name: '交流耐压试验', equipment: 'YQ-078',
            inspector: '孙丽', startAt: '2026-07-15 10:20', endAt: '2026-07-15 11:35',
            recorder: '孙丽', recordAt: '2026-07-15 11:35',
            columns: ['试样编号', '试验电压/kV', '持续时间/min', '泄漏电流/mA', '现象', '结论'],
            rows: [
              ['SCZN202508/0007-03702', '45', '1', '0.32', '无击穿、无闪络', '合格']
            ],
            specimens: [
              { specimenNo: 'SCZN202508/0007-03702', inspector: '孙丽', startAt: '2026-07-15 10:20', endAt: '2026-07-15 11:30', recorder: '孙丽', recordAt: '2026-07-15 11:35', values: ['45', '1', '0.32', '无击穿、无闪络', '合格'] }
            ]
          },
          {
            name: '抗弯动负荷试验', equipment: 'LJ-03',
            inspector: '陈昊', startAt: '2026-07-15 13:10', endAt: '2026-07-15 13:48',
            recorder: '陈昊', recordAt: '2026-07-15 13:48',
            columns: ['试样编号', '施加动负荷/N', '保持时间/min', '最大挠度/mm', '现象', '结论'],
            rows: [
              ['SCZN202508/0007-03703', '500', '1', '18', '无永久变形、无损伤', '合格']
            ],
            specimens: [
              { specimenNo: 'SCZN202508/0007-03703', inspector: '陈昊', startAt: '2026-07-15 13:10', endAt: '2026-07-15 13:45', recorder: '陈昊', recordAt: '2026-07-15 13:48', values: ['500', '1', '18', '无永久变形、无损伤', '合格'] }
            ]
          },
          {
            name: '抗弯静负荷试验', equipment: 'LJ-03',
            inspector: '陈昊', startAt: '2026-07-15 14:40', endAt: '2026-07-15 15:08',
            recorder: '陈昊', recordAt: '2026-07-15 15:08',
            columns: ['试样编号', '施加静负荷/N', '保持时间/min', '挠度/mm', '现象', '结论'],
            rows: [
              ['SCZN202508/0007-03704', '350', '5', '12', '无损伤', '合格']
            ],
            specimens: [
              { specimenNo: 'SCZN202508/0007-03704', inspector: '陈昊', startAt: '2026-07-15 14:40', endAt: '2026-07-15 15:05', recorder: '陈昊', recordAt: '2026-07-15 15:08', values: ['350', '5', '12', '无损伤', '合格'] }
            ]
          }
        ],
        report: {
          compiler: { name: '王芳', time: '2026-07-16 09:10' },
          reviewer: { name: '刘洋', time: '2026-07-16 09:30' },
          reviewers: [
            {
              name: '刘洋', role: '主审', time: '2026-07-16 09:30',
              cert: { name: '授权签字人资格证', no: 'QS-LY-2024-012', validTo: '2027-12-31', image: 'assets/report-trace/qual-cert.svg' }
            },
            {
              name: '周梅', role: '会审', time: '2026-07-16 09:36',
              cert: { name: '授权签字人资格证', no: 'QS-ZM-2025-008', validTo: '2027-12-31', image: 'assets/report-trace/qual-cert.svg' }
            }
          ],
          approver: { name: '陈建国', time: '2026-07-16 09:40' }
        },
        nodes: [
          { node: '收样', time: '2026-07-14 08:40', owner: '李敏', photos: [] },
          { node: '制样', time: '2026-07-15 09:10', owner: '孙丽', photos: [] },
          { node: '检测', time: '2026-07-15 15:30', owner: '孙丽', photos: [] },
          { node: '复核', time: '2026-07-16 09:00', owner: '王芳', photos: [] },
          { node: '报告', time: '2026-07-16 09:40', owner: '王芳', photos: [] }
        ],
        fullNodes: [
          { node: '委托登记', owner: '梁倩', time: '2026-07-13 16:20' },
          { node: '样品收样', owner: '李敏', time: '2026-07-14 08:40' },
          { node: '委托确认', owner: '李敏', time: '2026-07-14 09:10' },
          { node: '样品制备', owner: '孙丽', time: '2026-07-15 09:10' },
          { node: '样品发样', owner: '孙丽', time: '2026-07-15 09:40' },
          { node: '试样分发', owner: '孙丽', time: '2026-07-15 09:40' },
          { node: '试验检测', owner: '孙丽', time: '2026-07-15 09:50 ~ 15:30' },
          { node: '样品还样', owner: '孙丽', time: '2026-07-15 16:00' },
          { node: '组内审核', owner: '王芳', time: '2026-07-16 09:00' },
          { node: '数据审核', owner: '刘洋', time: '2026-07-16 09:20' },
          { node: '报告编制', owner: '王芳', time: '2026-07-16 09:10' },
          { node: '报告审核', owner: '刘洋', time: '2026-07-16 09:30' },
          { node: '报告签发', owner: '陈建国', time: '2026-07-16 09:40' },
          { node: '报告处理', owner: '李敏', time: '2026-07-16 10:00' },
          { node: '收费审批', owner: '赵敏', time: '2026-07-16 10:20' },
          { node: '报告发放', owner: '李敏', time: '2026-07-16 11:00' },
          { node: '任务归档', owner: '王芳', time: '2026-07-16 11:30' }
        ]
      },
      image: {
        photos: [
          { node: '收样', label: '样品外观正面', src: 'assets/report-trace/photo-receive-front.png', uploadedAt: '2026-07-14 08:42' },
          { node: '收样', label: '样品外观侧面', src: 'assets/report-trace/photo-receive-side.png', uploadedAt: '2026-07-14 08:43' },
          { node: '检测', testName: '外观及尺寸', label: '外观检查照', src: 'assets/report-trace/photo-test-1.svg', uploadedAt: '2026-07-15 10:05' },
          { node: '还样', label: '还样交接单-孙丽', src: 'assets/report-trace/photo-07-sign.jpg', uploadedAt: '2026-07-15 15:50' },
          { node: '还样', label: '还样交接单-陈昊', src: 'assets/report-trace/photo-07-sign.jpg', uploadedAt: '2026-07-15 16:00' }
        ],
        videos: [
          { id: 'recv-unbox', node: '收样', label: '开箱验样', poster: 'assets/report-trace/video-prepare.svg', startTime: '2026-07-14 08:40:10', endTime: '2026-07-14 08:43:20', durationSec: 15 },
          { id: 'prep-process', node: '制样', label: '制样过程', poster: 'assets/report-trace/video-prepare-process.png', startTime: '2026-07-15 09:10:02', endTime: '2026-07-15 09:18:40', durationSec: 18 },
          { id: 'prep-mark', node: '制样', label: '试样标识', poster: 'assets/report-trace/video-prepare-mark.png', startTime: '2026-07-15 09:19:00', endTime: '2026-07-15 09:22:30', durationSec: 12 },
          { id: 'pick-sun', node: '领样-孙丽', label: '领样确认', poster: 'assets/report-trace/video-pickup-sun.png', startTime: '2026-07-15 09:40:05', endTime: '2026-07-15 09:41:20', durationSec: 12 },
          { id: 'pick-chen', node: '领样-陈昊', label: '领样确认', poster: 'assets/report-trace/video-pickup-chen.png', startTime: '2026-07-15 09:42:03', endTime: '2026-07-15 09:43:10', durationSec: 11 },
          { id: 'pick-chen-check', node: '领样-陈昊-2', label: '试样核对', poster: 'assets/report-trace/video-pickup-check.png', startTime: '2026-07-15 09:43:20', endTime: '2026-07-15 09:44:30', durationSec: 10 },
          { id: 'ac-mount', node: '装样', label: '装样', testName: '交流耐压试验', poster: 'assets/report-trace/video-stage-mount.png', startTime: '2026-07-15 10:22:11', endTime: '2026-07-15 10:29:05', durationSec: 16 },
          { id: 'ac-load', node: '加载', label: '加载', testName: '交流耐压试验', poster: 'assets/report-trace/video-stage-load.png', startTime: '2026-07-15 11:08:00', endTime: '2026-07-15 11:20:30', durationSec: 22 },
          { id: 'ac-read', node: '读数', label: '读数', testName: '交流耐压试验', poster: 'assets/report-trace/video-stage-read.png', startTime: '2026-07-15 11:20:08', endTime: '2026-07-15 11:28:44', durationSec: 20 },
          { id: 'ac-end', node: '结束阶段', label: '结束阶段', testName: '交流耐压试验', poster: 'assets/report-trace/video-stage-end.png', startTime: '2026-07-15 11:30:00', endTime: '2026-07-15 11:34:20', durationSec: 18 },
          { id: 'bend-dyn-load', node: '加载2', label: '加载', testName: '抗弯动负荷试验', poster: 'assets/report-trace/video-bend-dynamic.png', startTime: '2026-07-15 13:20:00', endTime: '2026-07-15 13:40:30', durationSec: 22 },
          { id: 'bend-stat-load', node: '加载3', label: '加载', testName: '抗弯静负荷试验', poster: 'assets/report-trace/video-bend-static.png', startTime: '2026-07-15 14:45:00', endTime: '2026-07-15 15:05:30', durationSec: 22 }
        ],
        liveMonitorUrl: null
      },
      dataflow: {
        mode: '设备自动采集 → 系统自动存储 → 自动计算；仅复核环节人工确认，原始采集数据不可修改，仅可添加备注说明',
        editable: '原始采集数据不可修改，仅可添加备注说明',
        collectItems: [
          { testName: '外观及尺寸', equipment: 'KC-05', collectMode: '人工录入' },
          { testName: '交流耐压试验', equipment: 'YQ-078', collectMode: '串口自动读取' },
          { testName: '抗弯动负荷试验', equipment: 'LJ-03', collectMode: '设备直采' },
          { testName: '抗弯静负荷试验', equipment: 'LJ-03', collectMode: '设备直采' }
        ]
      }
    }
  };
  // 换版旧报告复用新版内容以便演示
  snapshots['SC2026/0099-00'] = snapshots['SC2026/0099-01'];
  snapshots['SCZN202508/0005-01'] = snapshots['SC2026/0099-01'];
  // 四级报告检测样品与三级相同：绝缘操作杆（报告号仍走四级码）
  snapshots['SCZN202508/0006-01'] = (function () {
    var copy = JSON.parse(JSON.stringify(snapshots['SC2026/0099-01']));
    copy.reportNo = 'SCZN202508/0006-01';
    copy.testItemNo = 'TI-0006-01';
    copy.frozenAt = '2026-07-15 11:05';
    return copy;
  })();
  snapshots['SCZN202508/0006-00'] = snapshots['SCZN202508/0006-01'];
  snapshots['SCZN202508/0008-01'] = snapshots['SCZN202508/0006-01'];

  /** 过程影像实拍图（图3–8）循环替换占位 SVG，保证缩略图与灯箱可读 */
  var PROCESS_PHOTOS = [
    'assets/report-trace/photo-01-bench.jpg',
    'assets/report-trace/photo-02-studio.jpg',
    'assets/report-trace/photo-03-field.jpg',
    'assets/report-trace/photo-04-ac.jpg',
    'assets/report-trace/photo-05-bend.jpg',
    'assets/report-trace/photo-06-robot.jpg'
  ];
  (function applyProcessPhotos() {
    var seen = [];
    function walk(obj, idx) {
      if (!obj || typeof obj !== 'object') return;
      if (seen.indexOf(obj) >= 0) return;
      seen.push(obj);
      if (Array.isArray(obj)) { obj.forEach(function (x) { walk(x, idx); }); return; }
      ['src', 'poster'].forEach(function (k) {
        if (typeof obj[k] === 'string' && /assets\/report-trace\/(photo|video)-.+\.svg$/.test(obj[k])) {
          obj[k] = PROCESS_PHOTOS[idx.n % PROCESS_PHOTOS.length];
          idx.n++;
        }
      });
      Object.keys(obj).forEach(function (k) {
        if (k === 'src' || k === 'poster') return;
        walk(obj[k], idx);
      });
    }
    var idx = { n: 0 };
    Object.keys(snapshots).forEach(function (k) { walk(snapshots[k], idx); });
  })();

  /** 状态徽标类型 */
  // 'ok' 正常公开 | 'partial' 部分/待接入 | 'none' 暂未采集 | 'na' 该等级不公开

  function txt(v, fallbackType) {
    if (v === null || v === undefined || v === '') {
      return { type: fallbackType || 'none', value: null };
    }
    return { type: 'ok', value: v };
  }

  /** 三级「机」：校准证书编号做成可点链接，公开页弹出证书照片 */
  function calibCertCell(eq) {
    if (!eq.calibCertNo) return '暂未采集';
    if (!eq.calibCertImage) return eq.calibCertNo;
    return '<a href="' + eq.calibCertImage + '" class="js-calib-cert inline-flex items-center gap-1 text-blue-600 hover:underline" data-src="' + eq.calibCertImage + '" data-title="校准证书 ' + eq.calibCertNo + '">' +
      eq.calibCertNo + ' <i class="fa fa-file-image-o"></i> 查看</a>';
  }

  /** 三级「料」：样品维流转摘要 + 详情链接 */
  function materialFlowCell(mat) {
    var labels = (mat.flowNodes && mat.flowNodes.length)
      ? mat.flowNodes.map(function (n) { return n.title; }).join('　→　')
      : (mat.flow ? mat.flow.join('　→　') : null);
    if (!labels) return '暂未采集';
    if (!mat.flowNodes || !mat.flowNodes.length) return labels;
    return labels + ' <a href="#" class="js-material-flow ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-blue-600 hover:underline"><i class="fa fa-list-ul"></i> 详情</a>';
  }

  function sameDayEnd(startAt, endAt) {
    if (!startAt || !endAt) return endAt || '—';
    var sd = String(startAt).split(' ')[0];
    var parts = String(endAt).split(' ');
    return (parts[0] === sd && parts[1]) ? parts[1] : endAt;
  }

  function testRecordHref(traceCode, testName) {
    var q = [];
    if (traceCode) q.push('code=' + encodeURIComponent(traceCode));
    if (testName) q.push('item=' + encodeURIComponent(testName));
    return 'test-record-view.html' + (q.length ? '?' + q.join('&') : '');
  }

  /** 三级「试验流程」：收样 / 每个试验项 / 报告编制·审核·签发 */
  function l3FlowRows(flow, traceCode) {
    flow = flow || {};
    var recv = flow.receive || {};
    var tests = flow.tests || [];
    var rp = flow.report || {};
    var rows = [];
    rows.push(['收样',
      '<p>收样人 ' + (recv.person || '—') + '</p>' +
      '<p>收样时间 ' + (recv.time || '—') + '</p>'
    ]);
    if (!tests.length) {
      rows.push(['试验', '暂未采集']);
    } else {
      rows.push(['试验', l2TestBlock(flow, traceCode)]);
    }
    var c = rp.compiler || {}, v = rp.reviewer || {}, a = rp.approver || {};
    rows.push(['报告',
      '<p>编制人 ' + (c.name || '—') + '　' + (c.time || '—') + '</p>' +
      '<p>审核人 ' + (v.name || '—') + '　' + (v.time || '—') + '</p>' +
      '<p>批准人 ' + (a.name || '—') + '　' + (a.time || '—') + '</p>'
    ]);
    return rows;
  }

  var L2_FLOW_GROUPS = {
    收样: ['委托登记', '样品收样', '委托确认', '样品制备', '样品发样', '试样分发'],
    试验: ['试验检测', '样品还样', '组内审核', '数据审核'],
    报告: ['报告编制', '报告审核', '报告签发', '报告处理', '收费审批', '报告发放', '任务归档']
  };
  var L2_FLOW_ROLES = {
    '委托登记': '登记人', '样品收样': '收样人', '委托确认': '确认人',
    '样品制备': '制备人', '样品发样': '领样人', '试样分发': '领样人',
    '试验检测': '检测员', '样品还样': '还样人', '组内审核': '审核人', '数据审核': '审核人',
    '报告编制': '编制人', '报告审核': '审核人', '报告签发': '批准人',
    '报告处理': '处理人', '收费审批': '审批人', '报告发放': '发放人',
    '任务归档': '归档人'
  };
  var L1_UNMANNED_ROLES = {
    '样品制备': '机械臂工位', '样品发样': '系统自动调度', '试样分发': '机械臂工位',
    '试验检测': '机械臂工位', '样品还样': '机械臂工位',
    '组内审核': '自动审核', '数据审核': '自动审核',
    '报告编制': '自动编制', '报告审核': '自动审核', '报告签发': '电子签章',
    '任务归档': '系统自动归档'
  };
  var L1_NODE_VIDEO_ALIAS = {
    '样品收样': ['收样', '样品收样'],
    '样品制备': ['制样', '样品制备'],
    '样品还样': ['还样', '样品还样'],
    '试样分发': ['试样分发']
  };

  /** 设备台账摘要：试验节点「机」与检测记录页统一写成 编号 名称「型号」 */
  var EQUIP_CATALOG = {
    'YQ-078': { code: 'YQ-078', name: '工频耐压试验装置', model: 'YFG-150A' },
    'YQ-035': { code: 'YQ-035', name: '工频耐压试验装置', model: 'YFG-150A' },
    'LJ-03': { code: 'LJ-03', name: '力学试验机', model: 'LD26504' },
    'KC-05': { code: 'KC-05', name: '数显卡尺', model: '(0~300)mm/0.01mm' },
    'YQ-102': { code: 'YQ-102', name: 'COD消解仪', model: 'HCA-102' },
    'YMWJ-XL2': { code: 'YMWJ-XL2', name: '直流电阻测试仪', model: 'XL2' },
    'LINE-U1': { code: 'LINE-U1', name: '电缆保护管无人化试验线', model: 'YM-AUTO-PIPE-01' },
    'ARM-01': { code: 'ARM-01', name: '六轴机械臂', model: 'IRB-6700' },
    'YBKC-02': { code: 'YBKC-02', name: '数显卡尺', model: '(0~300)mm/0.01mm' },
    'YBKC-03': { code: 'YBKC-03', name: '数显卡尺', model: '(0~300)mm/0.01mm' },
    'YH-04': { code: 'YH-04', name: '电子天平', model: 'HZK-FA110' },
    'YWDW-100': { code: '2412030104', name: '电缆保护管力学性能试验机', model: 'YWDW-100' },
    '2412030104': { code: '2412030104', name: '电缆保护管力学性能试验机', model: 'YWDW-100' },
    'YAW-W-300': { code: 'YAW-W-300', name: '微机控制电子试验机', model: 'YAW-W-300' },
    'YBD-322A': { code: 'YBD-322A', name: '落锤冲击试验机', model: 'YBD-322A' },
    'ZWY-300': { code: 'ZWY-300', name: '维卡软化温度测定仪', model: 'ZWY-300' },
    'CAM-APP': { code: 'CAM-APP', name: '工业相机外观工位', model: 'VM-APP-01' }
  };

  function resolveEquip(ref) {
    if (!ref) return null;
    if (typeof ref === 'object') {
      var fromCat = (ref.code && EQUIP_CATALOG[ref.code]) || null;
      return {
        code: ref.code || (fromCat && fromCat.code) || '',
        name: ref.name || (fromCat && fromCat.name) || '',
        model: ref.model || (fromCat && fromCat.model) || ''
      };
    }
    var key = String(ref).trim();
    if (EQUIP_CATALOG[key]) return EQUIP_CATALOG[key];
    var tokens = key.split(/[\s/]+/);
    var last = tokens[tokens.length - 1];
    if (last && EQUIP_CATALOG[last]) return EQUIP_CATALOG[last];
    return { code: key, name: '', model: '' };
  }

  function formatEquipLabel(ref) {
    var eq = resolveEquip(ref);
    if (!eq || !eq.code) return '—';
    if (eq.name && eq.model) return eq.code + ' ' + eq.name + '「' + eq.model + '」';
    if (eq.name) return eq.code + ' ' + eq.name;
    return eq.code;
  }

  function l2NodeBlock(n) {
    var role = L2_FLOW_ROLES[n.node] || '经办人';
    if (n.node === '样品收样') {
      return '<div class="mb-1.5 last:mb-0">' +
        '<p class="text-slate-600">样品收样</p>' +
        '<p>收样人 ' + (n.owner || '—') + '</p>' +
        '<p>收样时间 ' + (n.time || '—') + '</p>' +
        '</div>';
    }
    return '<div class="mb-1.5 last:mb-0">' +
      '<p class="text-slate-600">' + (n.node || '—') + '</p>' +
      '<p>' + role + ' ' + (n.owner || '—') + '　' + (n.time || '—') + '</p>' +
      '</div>';
  }

  function l2TestBlock(flow, traceCode) {
    var tests = (flow && flow.tests) || [];
    var href = testRecordHref(traceCode);
    var html = '<div class="mb-1.5 last:mb-0">' +
      '<p class="text-slate-600">试验检测' +
      ' <a href="' + href + '" class="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-blue-600 hover:underline"><i class="fa fa-list-alt"></i> 详情</a></p>';
    if (tests.length) {
      html += '<p class="text-slate-500">' + tests.length + ' 个试验项</p>';
    } else {
      html += '<p class="text-slate-500">暂未采集</p>';
    }
    return html + '</div>';
  }

  function l2FlowRows(flow, traceCode) {
    flow = flow || {};
    var byName = {};
    (flow.fullNodes || []).forEach(function (n) { byName[n.node] = n; });
    var testsHtml = l2TestBlock(flow, traceCode);
    var order = [].concat(L2_FLOW_GROUPS['收样'], L2_FLOW_GROUPS['试验'], L2_FLOW_GROUPS['报告']);
    var blocks = [];
    order.forEach(function (name) {
      if (name === '试验检测' && testsHtml) { blocks.push(testsHtml); return; }
      var n = byName[name];
      if (n) blocks.push(l2NodeBlock(n));
    });
    if (!blocks.length) return [['', '暂未采集']];
    var html =
      '<button type="button" class="js-flow-fold flex w-full items-center justify-between text-xs text-blue-600">' +
        '<span>共 ' + blocks.length + ' 个节点</span>' +
        '<span class="js-flow-fold-lab">展开 <i class="fa fa-angle-down"></i></span>' +
      '</button>' +
      '<div class="js-flow-fold-panel mt-2 hidden">' + blocks.join('') + '</div>';
    return [['', html]];
  }

  function collectVideos(s) {
    var list = ((s && s.image && s.image.videos) || []).slice();
    ((s && s.material && s.material.distribution) || []).forEach(function (d) {
      (d.clips || []).forEach(function (c) { list.push(c); });
    });
    return list;
  }

  function clipTitle(v) {
    var t = (v && (v.label || v.node)) || '节点视频';
    if (v && v.kind === 'cctv' && v.cam) return t + '（' + v.cam + '）';
    if (v && v.kind === 'live') return t + ' · 可拖拽回看';
    if (v && v.kind === 'continuous') return t + ' · 全程不间断';
    return t;
  }

  function videoPlayHref(traceCode, v) {
    var q = [];
    if (traceCode) q.push('code=' + encodeURIComponent(traceCode));
    if (v && v.node) q.push('node=' + encodeURIComponent(v.node));
    var id = v && (v.id || v.label);
    if (id) q.push('id=' + encodeURIComponent(id));
    return 'video-play.html' + (q.length ? '?' + q.join('&') : '');
  }

  function getVideoClip(reportNo, node, clipId) {
    var s = snapshots[reportNo];
    var list = collectVideos(s);
    if (clipId) {
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].id || '') === String(clipId) || String(list[i].label || '') === String(clipId)) return list[i];
      }
    }
    if (!node) return list[0] || null;
    for (var i = 0; i < list.length; i++) if (list[i].node === node) return list[i];
    return null;
  }

  var AUTO_COLLECT_MODES = ['设备直采', '图像识别', '蓝牙读取', '串口读取', '机械臂自动采集'];

  function resolveCollectMode(mode) {
    return mode || '人工采集';
  }

  function collectModeCell(items) {
    if (!items || !items.length) return '人工采集';
    return items.map(function (it) {
      return '<p>' + (it.testName || '试验项') + '</p>' +
        '<p class="text-slate-500">' + (it.equipment ? it.equipment + '　' : '') + resolveCollectMode(it.collectMode) + '</p>';
    }).join('');
  }

  function changeLogCell(log, traceCode) {
    if (!log || !log.length) return '无';
    var href = 'changelog-view.html' + (traceCode ? '?code=' + encodeURIComponent(traceCode) : '');
    return log.length + ' 条 <a href="' + href + '" class="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-blue-600 hover:underline"><i class="fa fa-list-alt"></i> 详情</a>';
  }

  function getChangeLog(reportNo) {
    var s = snapshots[reportNo];
    return (s && s.dataflow && s.dataflow.changeLog) || [];
  }

  function getReworks(reportNo) {
    var s = snapshots[reportNo];
    return (s && s.dataflow && s.dataflow.reworks) || [];
  }

  function returnOutCaption(node) {
    if (!node) return '';
    if (node.mode === 'dispose') return '自行处置';
    if (node.method === 'pickup') return '退回客户 · 上门自取';
    if (node.method === 'express') return '退回客户 · 快递' + (node.tracking ? '（' + node.tracking + '）' : '');
    if (node.mode === 'client') return '退回客户';
    return '';
  }

  /**
   * 温湿度采集来源（与数采 Web「设备配置 → 安全管家配置」一致）：
   * 该设备试验项已绑定温湿度节点 → 组态物联终端名称 + 节点编号；
   * 否则若配置了独立传感器 → 「独立传感器」+ 型号；
   * 两者均未配置 → 「手动录入」。
   */
  function resolveEnvSource(env) {
    env = env || {};
    var node = env.boundHumidityNode;
    if (node && (node.nodeId || node.terminalName)) {
      return {
        kind: 'iot',
        auto: true,
        text: (node.terminalName || '组态物联终端') + ' (' + (node.nodeId || '—') + ')'
      };
    }
    var sensor = env.independentSensor;
    if (sensor && sensor.model) {
      return { kind: 'sensor', auto: true, text: '独立传感器 · ' + sensor.model };
    }
    return { kind: 'manual', auto: false, text: '手动录入' };
  }

  /** 公开阅览用的标准文件摘要（原型） */
  var STD_DOCS = {
    'GB/T 7113.2': {
      code: 'GB/T 7113.2',
      fullCode: 'GB/T 7113.2-2014',
      name: '绝缘软管试验方法',
      enName: 'Flexible insulating sleeving — Test methods',
      status: '现行',
      publisher: '中华人民共和国国家质量监督检验检疫总局 / 中国国家标准化管理委员会',
      publishDate: '2014-12-05',
      implementDate: '2015-07-01',
      ics: '29.035.20',
      pages: [
        { title: '封面', body: '' },
        { title: '1 范围', body: '本部分规定了绝缘软管的试验方法，包括外观检查、尺寸测量、工频耐压及泄漏电流等。本文件适用于额定电压相应等级的绝缘软管及同类绝缘工器具的型式试验与出厂检验。' },
        { title: '5.4 工频耐压试验', body: '试样应在规定大气条件下预处理后进行工频耐压试验。试验电压按产品额定电压选取，升压至规定值后保持 1 min，期间应无击穿、无闪络。试验过程记录泄漏电流，读数应在电压稳定后取值。本报告对应工况：试验电压 45 kV，持续时间 1 min。' }
      ]
    },
    'GB/T 17622': {
      code: 'GB/T 17622',
      fullCode: 'GB/T 17622-2008',
      name: '带电作业用绝缘手套',
      enName: 'Live working — Gloves of insulating material',
      status: '现行',
      publisher: '中华人民共和国国家质量监督检验检疫总局 / 中国国家标准化管理委员会',
      publishDate: '2008-09-27',
      implementDate: '2009-08-01',
      ics: '13.260',
      pages: [
        { title: '封面', body: '' },
        { title: '1 范围', body: '本标准规定了带电作业用绝缘手套的技术要求、试验方法、检验规则及标志、包装。' },
        { title: '6.3 交流耐压试验', body: '绝缘手套应能承受规定的交流耐压，试验过程无击穿、无闪络。本报告对应工况：交流耐压 12 kV。' }
      ]
    },
    'DL/T 878': {
      code: 'DL/T 878',
      fullCode: 'DL/T 878-2004',
      name: '带电作业用绝缘工具试验导则',
      enName: 'Guide for testing of insulating tools for live working',
      status: '现行',
      publisher: '国家发展和改革委员会',
      category: '电力行业标准（DL）',
      publishDate: '2004-03-09',
      implementDate: '2004-06-01',
      expireDate: '长期有效',
      onlineUrl: 'https://std.samr.gov.cn/',
      ics: '29.260.99',
      pages: [
        { title: '封面', body: '' },
        { title: '1 范围', body: '本标准规定了带电作业用绝缘工具（含绝缘操作杆、绝缘承力工具等）的电气与机械试验方法、判定要求。适用于绝缘工具的型式试验、出厂试验及预防性试验。' },
        { title: '5 外观及尺寸检查', body: '绝缘工具表面应光洁，无裂纹、无气泡、无划伤、无变形；有效绝缘长度与直径应符合产品规定。10~35kV 级绝缘操作杆有效绝缘长度不小于 700 mm。' },
        { title: '6 交流耐压试验', body: '在规定大气条件下预处理后进行工频耐压试验，升压至规定值后保持 1 min，期间应无击穿、无闪络，泄漏电流在电压稳定后读取。本报告对应工况：试验电压 45 kV，持续 1 min。' },
        { title: '7 机械试验（抗弯负荷）', body: '抗弯动负荷：两端支撑固定后施加规定动负荷并保持规定时间，卸载后应无永久变形、无损伤（本报告 500 N / 1 min）。抗弯静负荷：施加规定静负荷并保持规定时间，挠度应在允许范围内且无损伤（本报告 350 N / 5 min）。' }
      ]
    },
    'HJ 828': {
      code: 'HJ 828',
      fullCode: 'HJ 828-2017',
      name: '水质 化学需氧量的测定 重铬酸盐法',
      enName: 'Water quality — Determination of the chemical oxygen demand — Dichromate method',
      status: '现行',
      publisher: '环境保护部',
      publishDate: '2017-05-01',
      implementDate: '2017-11-01',
      ics: '13.060.50',
      pages: [
        { title: '封面', body: '' },
        { title: '1 适用范围', body: '本标准规定了水质中化学需氧量的重铬酸盐测定方法。' }
      ]
    },
    'DL/T 802.3': {
      code: 'DL/T 802.3',
      fullCode: 'DL/T 802.3-2023',
      name: '电力电缆用导管技术条件 第3部分：实壁塑料电缆导管',
      enName: 'Technical requirements for electric power cable conduits — Part 3: Solid wall plastic cable conduits',
      status: '现行',
      publisher: '国家能源局',
      category: '电力行业标准（DL）',
      publishDate: '2023-05-26',
      implementDate: '2023-11-26',
      ics: '29.240.20',
      pages: [
        { title: '封面', body: '' },
        { title: '1 范围', body: '本文件规定了实壁塑料电缆导管的分类、技术要求、试验方法、检验规则及标志、包装、运输与贮存。适用于电力电缆线路保护用实壁塑料导管。' },
        { title: '5.4 外观与尺寸', body: '导管内外壁应光滑、平整，颜色均匀，无气泡、裂口、分解变色线及明显的痕纹、凹陷。平均内径、壁厚、长度、不圆度与弯曲度应符合产品规定。' },
        { title: '5.5 / 6.4 密度', body: '按 GB/T 1033.1 浸渍法测定密度，结果应符合产品规定上限。' },
        { title: '6.5.2 环刚度', body: '按 GB/T 9647 测定环刚度。SN8 级环刚度应不小于 8.0 kN/m²。' },
        { title: '6.5.3 压扁', body: '试样压至径向变形 30% 时，应无裂纹、无断裂、无穿孔。' },
        { title: '6.5.4 落锤冲击', body: '经规定温度预处理后，以规定锤型冲击，试样不应破裂。' },
        { title: '6.6 维卡软化温度', body: '维卡软化温度应不低于规定下限。' }
      ]
    },
    'DL/T 802.1': {
      code: 'DL/T 802.1',
      fullCode: 'DL/T 802.1-2023',
      name: '电力电缆用导管技术条件 第1部分：总则',
      enName: 'Technical requirements for electric power cable conduits — Part 1: General',
      status: '现行',
      publisher: '国家能源局',
      publishDate: '2023-05-26',
      implementDate: '2023-11-26',
      ics: '29.240.20',
      pages: [
        { title: '封面', body: '' },
        { title: '8.3 试验', body: '密度、环刚度等项目的试验条件与判定按各部分产品标准执行。' }
      ]
    },
    'GB/T 1033.1': {
      code: 'GB/T 1033.1',
      fullCode: 'GB/T 1033.1-2008',
      name: '塑料 非泡沫塑料密度的测定 第1部分：浸渍法、液体比重瓶法和滴定法',
      status: '现行',
      publisher: '中华人民共和国国家质量监督检验检疫总局 / 中国国家标准化管理委员会',
      publishDate: '2008-08-04',
      implementDate: '2009-04-01',
      ics: '83.080.01',
      pages: [
        { title: '封面', body: '' },
        { title: '5.1 浸渍法', body: '测定试样在空气中的质量及在浸渍液中的表观质量，按固化公式计算密度。人员不得改写计算逻辑。' }
      ]
    },
    'GB/T 9647': {
      code: 'GB/T 9647',
      fullCode: 'GB/T 9647-2015',
      name: '热塑性塑料管材 环刚度的测定',
      status: '现行',
      publisher: '中华人民共和国国家质量监督检验检疫总局 / 中国国家标准化管理委员会',
      publishDate: '2015-10-09',
      implementDate: '2016-09-01',
      ics: '23.040.20',
      pages: [
        { title: '封面', body: '' },
        { title: '方法', body: '以恒速压缩试样至 3% 变形，记录力值，按标准公式计算环刚度 Sn。' }
      ]
    }
  };

  function getStdDoc(stdCode) {
    if (!stdCode) return null;
    if (STD_DOCS[stdCode]) return STD_DOCS[stdCode];
    var keys = Object.keys(STD_DOCS);
    for (var i = 0; i < keys.length; i++) {
      if (stdCode.indexOf(keys[i]) === 0 || keys[i].indexOf(stdCode) === 0) return STD_DOCS[keys[i]];
    }
    return {
      code: stdCode, fullCode: stdCode, name: stdCode, enName: '', status: '现行',
      publisher: '—', publishDate: '—', implementDate: '—', ics: '—',
      pages: [{ title: '封面', body: '' }]
    };
  }

  /** 公开阅览用的作业指导书摘要（原型） */
  var SOP_DOCS = {
    'SOP-ROD-01': {
      code: 'SOP-ROD-01',
      name: '绝缘操作杆型式试验作业指导书',
      version: 'A/1',
      status: '受控现行',
      org: '杭州应敏科技有限公司',
      dept: '电气试验室',
      relatedStd: 'DL/T 878-2004',
      effectiveDate: '2026-02-10',
      pages: [
        { title: '封面', body: '' },
        { title: '1 目的与适用范围', body: '规范绝缘操作杆型式试验（外观及尺寸、交流耐压、抗弯动负荷、抗弯静负荷）的操作步骤、安全要求与判定记录，保证试验过程可重复、可追溯。适用于 10~35kV 级带电作业用绝缘操作杆。' },
        { title: '2 引用文件与人员设备', body: '引用 DL/T 878-2004。检测员须持有效高压电气试验资质及相应装置操作能力证。交流耐压装置、机械负荷试验机须在校准有效期内。试验前用无水乙醇与无尘布清洁绝缘表面。' },
        { title: '3 外观及尺寸', body: '目视检查表面应光洁、无裂纹、无气泡、无划伤；用游标卡尺/卷尺测量有效绝缘长度与直径，比对产品规定（有效绝缘长度 ≥ 700 mm）。' },
        { title: '4 交流耐压试验', body: '预处理 → 装夹 → 以均匀速率升压至 45 kV → 保持 1 min → 观察有无击穿/闪络并读取泄漏电流 → 均匀降压至零。保持期间应无击穿、无闪络。' },
        { title: '5 抗弯动负荷试验', body: '两端支撑固定，施加规定动负荷 500 N 并保持 1 min，卸载后检查有无永久变形、开裂或损伤。' },
        { title: '6 抗弯静负荷试验', body: '两端支撑，施加规定静负荷 350 N 并保持 5 min，测量挠度并检查有无损伤。挠度应在允许范围内。' },
        { title: '7 判定与记录', body: '各项均满足标准要求即判为合格。检测员记录原始数据，记录员核对后入系统；计算逻辑按标准固化，人工不得改写判定公式。' }
      ]
    },
    'SOP-GLV-03': {
      code: 'SOP-GLV-03',
      name: '绝缘手套交流耐压作业指导书',
      version: 'A/1',
      status: '受控现行',
      org: '杭州应敏科技有限公司',
      dept: '电气试验室',
      relatedStd: 'GB/T 17622-2008',
      effectiveDate: '2026-01-08',
      pages: [
        { title: '封面', body: '' },
        { title: '1 目的与适用范围', body: '规范带电作业用绝缘手套交流耐压试验的操作步骤、安全要求与判定记录，保证试验过程可重复、可追溯。本指导书适用于额定电压对应试验电压为 12 kV 的绝缘手套出厂检验与定期试验。' },
        { title: '2 引用文件与人员设备', body: '引用 GB/T 17622。检测员须持有效高压电气试验资质及本装置操作能力证。试验装置须在校准有效期内。试验用水电阻率 ≥ 100 Ω·m，手套内衬使用合格导电海绵。' },
        { title: '3 试验步骤', body: '① 预处理：试样在规定环境条件下静置。② 充水：手套内注入试验用水，液面距卷边约 50 mm，内衬导电海绵。③ 升压：以均匀速率升至 12 kV。④ 保持：在规定电压下保持 1 min，观察有无击穿、闪络。⑤ 降压：试验结束均匀降压至零，拆除试样并记录。' },
        { title: '4 判定与记录', body: '达到规定试验电压且保持规定时间，无击穿、无闪络即为合格。检测员记录电压、保持时间与现象；记录员核对原始数据后入系统。计算逻辑按标准固化，人工不得改写判定公式。' }
      ]
    },
    'SOP-HV-01': {
      code: 'SOP-HV-01',
      name: '工频耐压作业指导书',
      version: 'A/2',
      status: '受控现行',
      org: '杭州应敏科技有限公司',
      dept: '电气试验室',
      relatedStd: 'GB/T 7113.2-2014',
      effectiveDate: '2025-11-20',
      pages: [
        { title: '封面', body: '' },
        { title: '1 目的与适用范围', body: '规范绝缘操作杆等工器具工频耐压试验的操作与记录。本指导书适用于试验电压 45 kV、保持 1 min 的工频耐压工况。' },
        { title: '2 试验步骤', body: '预处理 → 装样 → 升压至 45 kV → 保持 1 min → 读取泄漏电流 → 降压。保持期间应无击穿、无闪络；泄漏电流在电压稳定后取值，限值 1.0 mA。' }
      ]
    },
    'SOP-PIPE-01': {
      code: 'SOP-PIPE-01',
      name: '实壁塑料电缆导管无人化型式试验作业指导书',
      version: 'A/0',
      status: '受控现行',
      org: '杭州应敏科技有限公司',
      dept: '无人化材料试验线',
      relatedStd: 'DL/T 802.3-2023',
      effectiveDate: '2026-02-01',
      pages: [
        { title: '封面', body: '' },
        { title: '1 目的与适用范围', body: '规范实壁塑料电缆导管（PVC-C 直管）在无人化试验线上的型式试验流程。自样品制备起由机械臂执行，数据全链路自动流转，人员仅负责设备启动与监控，不得录入或修改原始数据。' },
        { title: '2 引用文件与工位', body: '引用 DL/T 802.3、DL/T 802.1、GB/T 1033.1、GB/T 9647。工位：制样 CNC、外观相机、数显卡尺、密度天平、环刚度/压扁力学机、落锤冲击机、维卡仪。各设备须在校准有效期内。' },
        { title: '3 无人化流程', body: '机械臂取管 → CNC 切割制样 → 自动贴标 → 按任务单依次送入外观、尺寸、密度、环刚度、压扁、落锤、维卡工位 → 设备直采写入 LIMS → 固化算法自动计算与判定 → 自动审核 → 自动出报告。' },
        { title: '4 判定与权限', body: '计算与判定公式固化在系统中，人员无权修改。原始数据只读。异常时仅允许停机与复测申请，不得手工改数。' }
      ]
    }
  };

  function getSopDoc(sopKey) {
    if (!sopKey) return null;
    if (SOP_DOCS[sopKey]) return SOP_DOCS[sopKey];
    var keys = Object.keys(SOP_DOCS);
    for (var i = 0; i < keys.length; i++) {
      if (sopKey.indexOf(keys[i]) >= 0 || keys[i].indexOf(sopKey) >= 0) return SOP_DOCS[keys[i]];
    }
    return {
      code: sopKey, name: sopKey, version: '—', status: '现行',
      org: '—', dept: '—', relatedStd: '—', effectiveDate: '—',
      pages: [{ title: '封面', body: '' }]
    };
  }

  function methodStdCell(method, traceCode) {
    if (!method.stdCode) return '—';
    var doc = getStdDoc(method.stdCode);
    var label = (doc.fullCode || method.stdCode) + ' ' + (method.stdName || doc.name || '');
    var href = 'std-detail.html?std=' + encodeURIComponent(method.stdCode) + (traceCode ? '&code=' + encodeURIComponent(traceCode) : '');
    return '<a href="' + href + '" class="inline-flex items-center gap-1 text-blue-600 hover:underline">' + label.trim() + ' <i class="fa fa-file-text-o"></i></a>';
  }

  function methodSopCell(method, traceCode) {
    if (!method.sop) return '见判定详情中的试验流程';
    var sopKey = method.sopCode || method.sop;
    var href = 'sop-view.html?sop=' + encodeURIComponent(sopKey) + (traceCode ? '&code=' + encodeURIComponent(traceCode) : '');
    return '<a href="' + href + '" class="inline-flex items-center gap-1 text-blue-600 hover:underline">' + method.sop + ' <i class="fa fa-file-text-o"></i></a>';
  }

  function detailHref(page, traceCode) {
    return page + (traceCode ? '?code=' + encodeURIComponent(traceCode) : '');
  }

  function detailLink(page, traceCode, label) {
    return '<a href="' + detailHref(page, traceCode) + '" class="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-blue-600 hover:underline"><i class="fa fa-list-alt"></i> ' + (label || '详情') + '</a>';
  }

  function personCertCell(cert, fallback) {
    if (!cert || !cert.name) return fallback || '暂未采集';
    var text = cert.name + (cert.no ? '（' + cert.no + '）' : '');
    if (!cert.image) return text;
    return '<a href="' + cert.image + '" class="js-calib-cert inline-flex items-center gap-1 text-blue-600 hover:underline" data-src="' + cert.image + '" data-title="' + cert.name + '">' + text + ' <i class="fa fa-file-image-o"></i></a>';
  }

  function maintainCell(eq, traceCode) {
    var recs = (eq && eq.maintainRecords) || [];
    if (!recs.length) return '暂未采集';
    return recs.length + ' 条' + detailLink('maintain-view.html', traceCode);
  }

  function runtimeCell(eq, traceCode) {
    var rt = eq && eq.runtime;
    if (!rt) return '暂未采集';
    return (rt.source || '上位机采集') + detailLink('runtime-view.html', traceCode);
  }

  function consumableCell(mat, traceCode, testName) {
    var list = (mat && mat.consumables) || [];
    if (testName) {
      list = list.filter(function (c) { return !c.usedIn || c.usedIn.indexOf(testName) >= 0; });
      if (!list.length) return '—';
      var href2 = 'consumable-view.html' + (traceCode ? '?code=' + encodeURIComponent(traceCode) : '?') + (testName ? '&item=' + encodeURIComponent(testName) : '');
      return list.length + ' 份 <a href="' + href2 + '" class="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-blue-600 hover:underline"><i class="fa fa-list-alt"></i> 合格证明</a>';
    }
    if (!list.length) return '暂未采集';
    return list.length + ' 份' + detailLink('consumable-view.html', traceCode);
  }

  function methodJudgeCell(method, traceCode) {
    if (!method.stdCode) return '—';
    return '<a href="' + detailHref('method-judge-view.html', traceCode) + '" class="inline-flex items-center gap-1 text-blue-600 hover:underline">' + method.stdCode + ' <i class="fa fa-file-text-o"></i></a>';
  }

  function getMaintainRecords(reportNo) {
    var s = snapshots[reportNo];
    return (s && s.equipment && s.equipment.maintainRecords) || [];
  }

  function getRuntime(reportNo) {
    var s = snapshots[reportNo];
    return (s && s.equipment && s.equipment.runtime) || null;
  }

  function getConsumables(reportNo) {
    var s = snapshots[reportNo];
    return (s && s.material && s.material.consumables) || [];
  }

  function getMethodJudgments(reportNo) {
    var s = snapshots[reportNo];
    return (s && s.method && s.method.judgments) || [];
  }

  function getSpecimenCurves(reportNo) {
    var s = snapshots[reportNo];
    return (s && s.env && s.env.specimenCurves) || [];
  }

  function methodSummaryCell(method, traceCode) {
    if (!method.dataSummary) return '—';
    var href = 'record-view.html' + (traceCode ? '?code=' + encodeURIComponent(traceCode) : '');
    return method.dataSummary + ' <a href="' + href + '" class="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-blue-600 hover:underline"><i class="fa fa-list-alt"></i> 详情</a>';
  }

  /* ============================================================
   * 试验流程时间轴（瀑布流）视图
   * 以 18 个试验流程节点为主线，将「人 / 机 / 料 / 法 / 环 / 过程影像 /
   * 数据流转」按节点归并展示；每个节点含时间、人员、维度详情与影像。
   * 各等级仍严格遵循「等级 × 维度公开矩阵」，仅改变呈现结构。
   * ============================================================ */

  function levelShort(level) {
    return ['一级', '二级', '三级', '四级'][level - 1] || ('第' + level + '级');
  }
  /** 从「二级 · 可视化透明报告」中取出「可视化透明报告」 */
  function levelDesc(level) {
    var n = levelName(level);
    var i = n.indexOf('·');
    return i >= 0 ? n.slice(i + 1).trim() : n;
  }

  function photosForNode(s, names) {
    return ((s.image && s.image.photos) || []).filter(function (p) { return names.indexOf(p.node) >= 0; });
  }
  function videosForNode(s, names) {
    return ((s.image && s.image.videos) || []).filter(function (v) { return names.indexOf(v.node) >= 0; });
  }

  /* --- 分组 / 分区模型：每个节点由若干「组」构成，组内由若干「维度区」构成 ---
   * group   = { title, titleRight, sections:[section] }
   * section = { tag(维度标签,如 人/机/料/法/环/影像/数据流转), rows:[row], media, html(自定义块) }
   * row     = { label, html }
   * 渲染时维度标签「前置」在每个区块之前，避免标签堆叠成一坨。 */
  function tlRow(label, html) { return { label: label, html: html }; }
  function tlSec(tag, rows, media, html) { return { tag: tag || '', rows: rows || [], media: media || null, html: html || '' }; }
  function tlGrp(title, titleRight, sections) {
    return { title: title || '', titleRight: titleRight || '', sections: (sections || []).filter(Boolean) };
  }

  function mediaPhotos(s, nodeNames, testName) {
    return ((s.image && s.image.photos) || []).filter(function (p) {
      if (nodeNames && nodeNames.indexOf(p.node) < 0) return false;
      if (testName != null) return p.testName === testName;
      return true;
    });
  }
  function mediaVideos(s, nodeNames, testName) {
    return ((s.image && s.image.videos) || []).filter(function (v) {
      if (nodeNames && nodeNames.indexOf(v.node) < 0) return false;
      if (testName != null) return v.testName === testName;
      return true;
    });
  }

  function personByName(s, name) {
    var list = (s.persons || []);
    for (var i = 0; i < list.length; i++) if (list[i].name === name) return list[i];
    if (s.person && s.person.name === name) return s.person;
    return s.person || { name: name };
  }

  function shortSpec(no) {
    if (!no) return '试样';
    // 试样编号 = 样品编号 + 2 位自增，取末 2 位作为试样序号
    return '试样' + String(no).slice(-2);
  }

  function testConclusion(t) {
    var sps = t.specimens || [];
    if (!sps.length) return t.conclusion || '合格';
    var pass = sps.every(function (sp) {
      var v = sp.values || []; var last = String(v[v.length - 1] || '');
      return last.indexOf('合格') >= 0 || last.indexOf('通过') >= 0;
    });
    return pass ? '合格' : '见明细';
  }

  function addMinutes(base, mins) {
    var raw = String(base || '').split('~')[0].trim();
    var m = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (!m) return base;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5] + mins);
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return m[1] + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function testRecordLink(traceCode, testName, label) {
    return '<a href="' + testRecordHref(traceCode, testName) + '" class="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-blue-600 hover:underline"><i class="fa fa-list-alt"></i> ' + (label || '试验记录') + '</a>';
  }

  function judgeLink(traceCode, testName, label) {
    var q = [];
    if (traceCode) q.push('code=' + encodeURIComponent(traceCode));
    if (testName) q.push('item=' + encodeURIComponent(testName));
    var href = 'method-judge-view.html' + (q.length ? '?' + q.join('&') : '');
    return '<a href="' + href + '" class="ml-1 inline-flex items-center gap-0.5 whitespace-nowrap text-blue-600 hover:underline"><i class="fa fa-list-alt"></i> ' + (label || '详情') + '</a>';
  }

  /** 样品收样：料（样品编号/来源）+ 过程影像（收样照片）；不再展示样品流转链接 */
  function tlReceive(node, s, level, traceCode) {
    var matRows = [tlRow('样品编号', s.material.sampleNo || '—')];
    if (level !== 4) matRows.push(tlRow('样品来源', s.material.source || '—'));
    var sections = [tlSec('料', matRows)];
    if (level !== 4) {
      var ph = (level === 1) ? [] : mediaPhotos(s, ['收样']);
      var vd = (level <= 2) ? mediaVideos(s, ['收样']) : [];
      if (ph.length || vd.length) sections.push(tlSec('影像', [], { photos: ph, videos: vd }));
    }
    node.groups = [tlGrp('', '', sections)];
  }

  /** 样品制备：过程影像（制样照片/视频） */
  function tlPrepare(node, s, level, traceCode) {
    if (level === 4) { node.groups = []; return; }
    var ph = (level === 1) ? [] : mediaPhotos(s, ['制样']);
    var vd = (level <= 2) ? mediaVideos(s, ['制样']) : [];
    var secs = [];
    if (level === 1 && s.unmanned) {
      secs.push(tlSec('人', [
        tlRow('执行工位', '机械臂 ARM-01'),
        tlRow('人员权限', '人员不接触试样与原始数据，仅现场值守')
      ]));
    }
    if (ph.length || vd.length) secs.push(tlSec('影像', [], { photos: ph, videos: vd }));
    node.groups = secs.length ? [tlGrp(level === 1 ? '无人化制样' : '', '', secs)] : [];
  }

  /** 样品发样：仅展示领样人 + 时间（如有领取影像可补入） */
  function tlDispatch(node, s, level, traceCode) {
    node.groups = [];
  }

  /** 试样分发：按领样人展示各自领取的试样编号 + 领取过程影像（可多片段） */
  function tlDistribute(node, s, level, traceCode) {
    var dist = s.material.distribution || [];
    if (!dist.length) {
      node.groups = [tlGrp('', '', [tlSec('料', [tlRow('试样编号', s.material.sampleNo || '—')])])];
      return;
    }
    node.hidePeople = true;
    node.groups = dist.map(function (d) {
      var sections = [tlSec('料', [tlRow('领取试样', (d.specimens || []).join('、') || '—')])];
      var ph = (level === 1) ? [] : ((level <= 3) ? (d.photos || []) : []);
      var vd = (level <= 2) ? (d.clips || []) : [];
      if (ph.length || vd.length) sections.push(tlSec('影像', [], { photos: ph, videos: vd }));
      return tlGrp(level === 1 ? '机械臂自动分发' : ('领样人 ' + d.picker), d.time || '', sections);
    });
  }

  /** 试验检测：按试验项分组，组内按 人 / 机 / 料 / 法 / 环 / 影像 / 数据流转 分区，标签前置 */
  function tlTest(node, s, level, traceCode) {
    var tests = s.flow.tests || [];
    // 无逐项记录（如四级·可公示）：给出最低合规的检测概览
    if (!tests.length) {
      var items = (s.meta && s.meta.testItems) || [];
      var personRows = [tlRow('操作人员', (s.person && s.person.name) || node.owner || '—')];
      var eqRows = [tlRow('设备编号', formatEquipLabel(s.equipment) || '—'), tlRow('设备状态', '设备合格')];
      var matRows = [tlRow('试样编号', s.material.sampleNo || '—')];
      var mtdRows = [tlRow('执行标准', (s.method.stdName || '') + (s.method.stdCode ? '（' + s.method.stdCode + '）' : ''))];
      if (items.length) mtdRows.push(tlRow('试验项', items.join('、')));
      node.hidePeople = true;
      node.groups = [tlGrp('', '', [tlSec('人', personRows), tlSec('机', eqRows), tlSec('料', matRows), tlSec('法', mtdRows)])];
      return;
    }
    node.hidePeople = true;
    var reworks = (s.dataflow && s.dataflow.reworks) || [];
    node.groups = tests.map(function (t) {
      var sections = [];
      // 人（按检测员归并其负责的试样）
      var byName = {}, order = [];
      (t.specimens || []).forEach(function (sp) {
        if (!byName[sp.inspector]) { byName[sp.inspector] = []; order.push(sp.inspector); }
        byName[sp.inspector].push(sp.specimenNo);
      });
      if (!order.length && t.inspector) { order = [t.inspector]; byName[t.inspector] = []; }
      var personRows = [];
      if (level === 1 && s.unmanned) {
        var monitor = personByName(s, (s.person && s.person.name) || '');
        personRows.push(tlRow('执行工位', '机械臂 ARM-01（无人化试验线）'));
        personRows.push(tlRow('值班监控', (monitor.name || s.person.name || '—') + '（仅启动与值守，不接触原始数据）'));
        personRows.push(tlRow('操作授权', s.person.authorization || '无人化试验线值守授权'));
        personRows.push(tlRow('培训考核', s.person.training || '—'));
        personRows.push(tlRow('资质证书', personCertCell(monitor.qualCert || s.person.qualCert)));
        personRows.push(tlRow('操作能力证', personCertCell(monitor.equipOpCert || s.person.equipOpCert)));
      } else {
        order.forEach(function (nm) {
          var p = personByName(s, nm);
          var specs = byName[nm] || [];
          var suffix = specs.length ? '（' + specs.map(shortSpec).join('、') + '）' : '';
          personRows.push(tlRow('检测员', nm + suffix));
          if (level === 3) personRows.push(tlRow('资质编号', p.certNo || '暂未采集'));
          if (level <= 2) {
            personRows.push(tlRow('资质编号', p.certNo || '暂未采集'));
            personRows.push(tlRow('资质证书', personCertCell(p.qualCert)));
            personRows.push(tlRow('操作能力证', personCertCell(p.equipOpCert)));
          }
        });
      }
      sections.push(tlSec('人', personRows));
      // 机
      var eqRows = [tlRow('设备编号', formatEquipLabel(t.equipment || s.equipment) || '—')];
      if (level === 4) {
        eqRows.push(tlRow('设备状态', '设备合格'));
      } else {
        eqRows.push(tlRow('校准证书', calibCertCell(s.equipment)));
        eqRows.push(tlRow('下次校准', s.equipment.nextCalib || '—'));
        if (level <= 2) eqRows.push(tlRow('维护记录', maintainCell(s.equipment, traceCode)));
        if (level === 1) eqRows.push(tlRow('运行参数曲线', runtimeCell(s.equipment, traceCode)));
        if (t.equipTable && t.equipTable.length) {
          eqRows.push(tlRow('本项设备', t.equipTable.map(function (e) {
            return (e.id || '') + ' ' + (e.name || '');
          }).join('、')));
        }
      }
      sections.push(tlSec('机', eqRows));
      // 料（试样 / 耗材）—— 放在「法」前面
      var specNos = (t.specimens || []).map(function (sp) { return sp.specimenNo; });
      var matRows = [tlRow('试样编号', specNos.join('、') || s.material.sampleNo || '—')];
      if (level <= 2) matRows.push(tlRow('耗材合格证明', consumableCell(s.material, traceCode, t.name)));
      sections.push(tlSec('料', matRows));
      // 法
      var methodRows = [];
      if (level === 4) {
        methodRows.push(tlRow('执行标准', s.method.stdName + '（' + s.method.stdCode + '）'));
      } else if (level === 3) {
        methodRows.push(tlRow('执行标准', methodStdCell(s.method, traceCode)));
      } else {
        methodRows.push(tlRow('执行标准', methodStdCell(s.method, traceCode)));
        methodRows.push(tlRow('作业指导书', methodSopCell(s.method, traceCode)));
        methodRows.push(tlRow('判定依据', '按 ' + (s.method.stdCode || '标准') + ' 判定' + judgeLink(traceCode, t.name)));
        if (level === 1) methodRows.push(tlRow('算法固化', s.method.calcLocked ? '计算逻辑固化，人员无权修改' : '暂未固化'));
      }
      sections.push(tlSec('法', methodRows));
      // 环：三级仅公开试验期间平均温湿度，不展示曲线图
      if (level !== 4) {
        var curves = (s.env.specimenCurves || []).filter(function (c) { return c.testName === t.name; });
        var envRows = [];
        if (level === 3) {
          envRows.push(tlRow('平均温湿度', curves.length ? curves[0].avg : (s.env.avgTempHumidity || '—')));
          sections.push(tlSec('环', envRows));
        } else {
          envRows.push(tlRow('温湿度图', curves.length ? ('本试验项共 ' + curves.length + ' 张，见下方') : '暂未采集'));
          sections.push(tlSec('环', envRows, curves.length ? { curves: curves } : null));
        }
      }
      // 影像
      if (level !== 4) {
        var ph = (level === 1) ? [] : mediaPhotos(s, ['检测'], t.name);
        var vd = (level <= 2) ? mediaVideos(s, null, t.name) : [];
        if (ph.length || vd.length) sections.push(tlSec('影像', [], { photos: ph, videos: vd }));
      }
      // 数据流转（采集方式 + 试验记录 + 退回更正标记）
      if (level !== 4) {
        var ci = ((s.dataflow && s.dataflow.collectItems) || []).filter(function (x) { return x.testName === t.name; })[0];
        var dfRows = [];
        if (ci) dfRows.push(tlRow('采集方式', resolveCollectMode(ci.collectMode) + (ci.equipment ? '（' + ci.equipment + '）' : '')));
        if (level === 1) {
          dfRows.push(tlRow('全链路', '自动采集 → 自动传输 → 自动存储 → 自动计算 → 自动审核 → 自动出报告'));
          dfRows.push(tlRow('人员权限', '无修改 / 录入 / 干预权限'));
        }
        if (level <= 3) dfRows.push(tlRow('试验数据', (t.specimens ? t.specimens.length + ' 个试样' : '见记录') + testRecordLink(traceCode, t.name)));
        var rw = reworks.filter(function (r) { return r.testName === t.name; });
        if (level === 3 && rw.length) dfRows.push(tlRow('退回更正', '<span class="text-amber-600"><i class="fa fa-undo"></i> ' + rw.length + ' 处（见「组内审核」）</span>'));
        if (dfRows.length) sections.push(tlSec('数据流转', dfRows));
      }
      return tlGrp(t.name, testConclusion(t), sections);
    });
  }

  /** 退回修改留痕块（仅组内审核展示；数据审核审的是更正后的终稿，不再复述退回历史） */
  function reworkCallout(r) {
    return '<div class="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] leading-relaxed text-amber-800">' +
      '<span class="font-medium"><i class="fa fa-undo"></i> 退回修改</span>　' +
      shortSpec(r.specimenNo) + ' · ' + esc0(r.field) +
      '，由 ' + esc0(r.returnedBy) + '（' + esc0(r.returnedRole) + '）' + esc0(r.returnedAt) + ' 退回。' +
      '<br>原因：' + esc0(r.reason) +
      '<br>检测员 ' + esc0(r.reworkBy) + ' 于 ' + esc0(r.reworkAt) + ' 将 ' + esc0(r.before) + ' 更正为 ' + esc0(r.after) + '。' +
      (r.reReviewedAt
        ? '<br>' + esc0(r.reReviewedBy) + '（' + esc0(r.reReviewedRole) + '）于 ' + esc0(r.reReviewedAt) + ' 二次审核通过。'
        : '') +
      '</div>';
  }
  function esc0(v) { return (v == null ? '' : String(v)); }

  /** 组内审核 / 数据审核：按试验项(试样)展示每单元审核人 / 审核时间 */
  function tlAudit(node, s, level, traceCode, kind) {
    if (level >= 4) { node.groups = []; return; }
    var tests = s.flow.tests || [];
    node.hidePeople = true;
    var reviewer = node.owner;
    var reworks = (s.dataflow && s.dataflow.reworks) || [];
    var k = 0;
    node.groups = tests.map(function (t) {
      var rows = [];
      (t.specimens || []).forEach(function (sp) {
        var rw = reworks.filter(function (r) { return r.testName === t.name && r.specimenNo === sp.specimenNo; })[0];
        if (kind === 'group' && level === 3 && rw) {
          rows.push(tlRow(shortSpec(sp.specimenNo), reviewer + ' · ' + rw.returnedAt + '　<span class="text-amber-600 font-medium">退回修改</span>'));
          rows.push(tlRow(shortSpec(sp.specimenNo), (rw.reReviewedBy || reviewer) + ' · ' + (rw.reReviewedAt || '') + '　<span class="text-emerald-600">二次审核通过</span>'));
        } else if (level === 1 && s.unmanned) {
          var at1 = addMinutes(node.time, k * 2); k++;
          rows.push(tlRow(shortSpec(sp.specimenNo), 'LIMS 自动审核引擎 · ' + at1 + '　<span class="text-emerald-600">自动通过</span>'));
        } else {
          var at = addMinutes(node.time, k * 2); k++;
          rows.push(tlRow(shortSpec(sp.specimenNo), reviewer + ' · ' + at + '　<span class="text-emerald-600">通过</span>'));
        }
      });
      var sections = [tlSec('', rows)];
      if (kind === 'group' && level === 3) {
        reworks.filter(function (r) { return r.testName === t.name; }).forEach(function (r) {
          sections.push(tlSec('', [], null, reworkCallout(r)));
        });
      }
      return tlGrp(t.name, '', sections);
    });
  }

  /** 样品还样：检测完成后按还样人归还试样至样品库 */
  function tlReturn(node, s, level, traceCode) {
    if (level === 4) { node.groups = []; return; }
    var returns = s.material.returns || [];
    if (returns.length) {
      node.hidePeople = true;
      node.groups = returns.map(function (d) {
        var sections = [tlSec('料', [
          tlRow('还样试样', (d.specimens || []).join('、') || '—'),
          tlRow('样品去向', d.dest || '样品库')
        ])];
        var ph = (level === 1) ? [] : ((level <= 3) ? (d.photos || []) : []);
        var vd = (level <= 2) ? (d.clips || []) : [];
        if (ph.length || vd.length) sections.push(tlSec('影像', [], { photos: ph, videos: vd }));
        return tlGrp(level === 1 ? '机械臂自动还样' : ('还样人 ' + d.returner), d.time || '', sections);
      });
      return;
    }
    var ph = (level <= 3) ? mediaPhotos(s, ['还样']) : [];
    var sections = [tlSec('料', [tlRow('样品去向', '样品库 · 待处置')])];
    if (ph.length) sections.push(tlSec('影像', [], { photos: ph }));
    node.groups = [tlGrp('', '', sections)];
  }

  /** 报告审核：支持双人审核，并展示授权签字人资质证明 */
  function tlReview(node, s, level, traceCode) {
    var revs = (s.flow.report && s.flow.report.reviewers) || [];
    if (!revs.length) { node.groups = []; return; }
    node.hidePeople = true;
    var rows = revs.map(function (r) {
      var html = r.name + ' · ' + (r.time || '');
      if (level <= 2 && r.cert) {
        html += '<div class="mt-0.5 text-[11px] text-slate-500">资质证明　' + personCertCell(r.cert) + '</div>';
      }
      return tlRow(r.role || '审核人', html);
    });
    node.groups = [tlGrp('', '', [tlSec('人', rows)])];
  }

  /** 任务归档：展示检测完成后样品的最终去向（留样 / 退样 / 销毁） */
  function tlArchive(node, s, level, traceCode) {
    if (level >= 4) { node.groups = []; return; }
    node.groups = [tlGrp('', '', [tlSec('料', [
      tlRow('样品去向', '样品库留样 · 自签发日起留样 6 个月，到期后按客户要求退样或销毁'),
      tlRow('留样编号', s.material.sampleNo || '—')
    ])])];
  }

  /** 报告签发：一级 / 二级为防篡改等级，展示存证 */
  function tlSign(node, s, level, traceCode) {
    if (level === 1 || level === 2) {
      var chain = s.dataflow && s.dataflow.chain;
      var rows = [tlRow('防篡改存证',
        '签发时对试验流程快照做哈希 + 可信时间戳（TSA）固化' + (level === 1 ? '，并叠加区块链存证' : '') + '，公开核验通过')];
      if (level === 1 && chain) {
        rows.push(tlRow('快照哈希', chain.hash || '—'));
        rows.push(tlRow('可信时间戳', (chain.tsa || '') + '　' + (chain.tsaAt || '')));
        rows.push(tlRow('链上交易', chain.tx || '—'));
      }
      node.groups = [tlGrp('', '', [tlSec('存证', rows)])];
    } else {
      node.groups = [];
    }
  }

  function videosAlreadyInNode(node) {
    var ids = {};
    (node.groups || []).forEach(function (g) {
      (g.sections || []).forEach(function (sec) {
        ((sec.media && sec.media.videos) || []).forEach(function (v) {
          if (v && v.id) ids[v.id] = true;
        });
      });
    });
    return ids;
  }

  /** 一级：每个流程节点补齐对应工位实验室监控视频（过程影像不用照片） */
  function ensureL1NodeMedia(node, s) {
    if (node.key === '试验检测' || node.key === '报告编制') return;
    var names = L1_NODE_VIDEO_ALIAS[node.key] || [node.key];
    var have = videosAlreadyInNode(node);
    var extra = ((s.image && s.image.videos) || []).filter(function (v) {
      if (!v) return false;
      if (v.kind === 'continuous' || v.kind === 'live') return false;
      if (names.indexOf(v.node) < 0) return false;
      return !have[v.id];
    });
    if (!extra.length) return;
    var sec = tlSec('影像', [], { photos: [], videos: extra });
    if (!node.groups || !node.groups.length) {
      node.groups = [tlGrp('', '', [sec])];
      return;
    }
    node.groups[0].sections = (node.groups[0].sections || []).concat([sec]);
  }

  function attachNodeDetail(node, s, level, traceCode) {
    switch (node.key) {
      case '样品收样': tlReceive(node, s, level, traceCode); break;
      case '样品制备': tlPrepare(node, s, level, traceCode); break;
      case '样品发样': tlDispatch(node, s, level, traceCode); break;
      case '试样分发': tlDistribute(node, s, level, traceCode); break;
      case '试验检测': tlTest(node, s, level, traceCode); break;
      case '样品还样': tlReturn(node, s, level, traceCode); break;
      case '组内审核': tlAudit(node, s, level, traceCode, 'group'); break;
      case '数据审核': tlAudit(node, s, level, traceCode, 'data'); break;
      case '报告审核': tlReview(node, s, level, traceCode); break;
      case '报告签发': tlSign(node, s, level, traceCode); break;
      case '任务归档': tlArchive(node, s, level, traceCode); break;
      default: break;
    }
  }

  /** 构建试验流程时间轴视图（替代八维度卡片） */
  function buildTimeline(reportNo, level, traceCode) {
    var s = snapshots[reportNo];
    if (!s) return null;
    var full = (s.flow && s.flow.fullNodes) || [];
    var nodes = full.map(function (n, i) {
      var node = {
        key: n.node, idx: i + 1, name: n.node, time: n.time || '—',
        role: (level === 1 && L1_UNMANNED_ROLES[n.node]) || L2_FLOW_ROLES[n.node] || '经办人', owner: n.owner || '—',
        groups: [], hidePeople: false
      };
      attachNodeDetail(node, s, level, traceCode);
      if (level === 1) ensureL1NodeMedia(node, s);
      return node;
    });
    return {
      reportNo: reportNo, level: level, levelName: levelName(level),
      levelShort: levelShort(level), levelDesc: levelDesc(level),
      meta: s.meta, frozenAt: s.frozenAt, testItemNo: s.testItemNo,
      nodes: nodes, dataDefense: (level === 1 || level === 2),
      unmanned: !!s.unmanned, unmannedFrom: s.unmannedFrom || '',
      continuous: (s.image && s.image.continuous) || null,
      live: (s.image && s.image.live) || null,
      materialFlow: null
    };
  }

  /**
   * 分级公开引擎：按 level × 八维度公开矩阵，产出用于渲染的 sections
   * 缺失一律显式标注（诚实告知，不伪造）
   */
  function buildPublicView(reportNo, level, traceCode) {
    var s = snapshots[reportNo];
    if (!s) return null;
    var sections = [];

    function sec(key, label, statusType, statusText, rows, media, note) {
      var item = { key: key, label: label, statusType: statusType, statusText: statusText, rows: rows || [], media: media || null, note: note || null };
      sections.push(item);
      return item;
    }

    // 人
    (function () {
      if (level === 4) return sec('person', '人 · 人员', 'ok', '公开', [['操作人员', s.person.name]]);
      if (level === 3) {
        var cert = txt(s.person.certNo);
        return sec('person', '人 · 人员', cert.type === 'ok' ? 'ok' : 'none', cert.type === 'ok' ? '公开' : '资质编号暂未采集',
          [['操作人员', s.person.name], ['资质编号', cert.value || '暂未采集']]);
      }
      if (level === 2 || level === 1) {
        var personRows2 = [['操作人员', s.person.name], ['资质编号', s.person.certNo || '暂未采集'],
           ['有效资质证书', personCertCell(s.person.qualCert)],
           ['设备操作能力证书', personCertCell(s.person.equipOpCert)]];
        if (level === 1) {
          personRows2.splice(1, 0, ['岗位', s.person.role || '值班监控员（不接触原始数据）']);
          personRows2.push(['操作授权', s.person.authorization || '—']);
          personRows2.push(['培训考核', s.person.training || '—']);
        }
        return sec('person', '人 · 人员', 'ok', '公开', personRows2);
      }
      // fallback
      var auth = txt(s.person.authorization), tr = txt(s.person.training);
      var st = (auth.type === 'ok') ? 'partial' : 'none';
      return sec('person', '人 · 人员', st, '资质模块待建，部分暂未采集',
        [['操作人员', s.person.name], ['有效资质', s.person.certNo || '暂未采集'], ['操作授权', auth.value || '暂未采集'], ['培训考核', tr.value || '暂未采集']]);
    })();

    // 机
    (function () {
      if (level === 4) return sec('equipment', '机 · 设备', 'ok', '公开', [['设备编号', s.equipment.code], ['状态', '设备合格']]);
      if (level === 3) {
        var c = txt(s.equipment.calibCertNo);
        return sec('equipment', '机 · 设备', c.type === 'ok' ? 'ok' : 'none', c.type === 'ok' ? '公开' : '校准证书暂未采集',
          [['设备编号', s.equipment.code], ['校准证书', calibCertCell(s.equipment)], ['下次校准', s.equipment.nextCalib || '—'], ['校准机构', s.equipment.calibOrg || '—']]);
      }
      if (level === 2 || level === 1) {
        return sec('equipment', '机 · 设备', 'ok', '公开',
          [['设备编号', s.equipment.code], ['校准证书', calibCertCell(s.equipment)],
           ['下次校准', s.equipment.nextCalib || '—'], ['校准机构', s.equipment.calibOrg || '—'],
           ['维护记录', maintainCell(s.equipment, traceCode)],
           ['关键运行数据', runtimeCell(s.equipment, traceCode)]]);
      }
      var rows = [['设备编号', s.equipment.code], ['校准证书', s.equipment.calibCertNo || '暂未采集'], ['维护记录', '见设备台账'], ['关键运行数据', s.equipment.runtimeData || '暂未采集（设备自动采集待接入）']];
      rows.push(['实时参数曲线', s.equipment.runtimeCurve || '暂未采集（设备自动采集待接入）']);
      return sec('equipment', '机 · 设备', 'none', '设备自动采集待接入', rows);
    })();

    // 料
    (function () {
      if (level === 4) return sec('material', '料 · 样品', 'ok', '公开', [['样品编号', s.material.sampleNo]]);
      var flow = s.material.flow ? s.material.flow.join('　→　') : null;
      if (level === 3) {
        var hasFlow = !!(s.material.flowNodes && s.material.flowNodes.length) || !!flow;
        var matSec = sec('material', '料 · 样品', hasFlow ? 'ok' : 'none', hasFlow ? '公开' : '流转节点暂未采集',
          [['样品编号', s.material.sampleNo], ['关键流转节点', materialFlowCell(s.material)]]);
        matSec.flowDetail = s.material.flowNodes || null;
        matSec.sampleNo = s.material.sampleNo;
        return matSec;
      }
      if (level === 2 || level === 1) {
        var l2mat = sec('material', '料 · 样品', 'ok', '公开',
          [['样品编号', s.material.sampleNo], ['关键流转节点', materialFlowCell(s.material)],
           ['耗材合格证明', consumableCell(s.material, traceCode)]]);
        l2mat.flowDetail = s.material.flowNodes || null;
        l2mat.sampleNo = s.material.sampleNo;
        return l2mat;
      }
      return sec('material', '料 · 样品', 'partial', '耗材信息待接入',
        [['样品来源', s.material.source], ['样品编号', s.material.sampleNo], ['流转记录', flow || '暂未采集'], ['耗材合格证明', s.material.consumable || '暂未采集（耗材模块待建）']]);
    })();

    // 法
    (function () {
      if (level === 4) return sec('method', '法 · 方法', 'ok', '公开', [['执行标准', s.method.stdName + '（' + s.method.stdCode + '）']]);
      if (level === 3) return sec('method', '法 · 方法', 'ok', '公开',
        [['执行标准编号', methodStdCell(s.method, traceCode)], ['原始数据摘要', methodSummaryCell(s.method, traceCode)]]);
      if (level === 2 || level === 1) {
        return sec('method', '法 · 方法', 'ok', '公开',
          [['执行标准编号', methodJudgeCell(s.method, traceCode)],
           ['作业流程/判定', (s.method.dataSummary || '—') + detailLink('method-judge-view.html', traceCode)],
           ['作业指导书', methodSopCell(s.method, traceCode)],
           ['算法固化', s.method.calcLocked ? '计算逻辑固化、人工不可改' : '暂未固化']]);
      }
      var rows = [['执行标准', s.method.stdName + '（' + s.method.stdCode + '）'], ['作业流程/记录摘要', s.method.dataSummary || '—'], ['作业指导书', s.method.sop || '暂未采集（SOP 模块占位）']];
      rows.push(['算法固化', s.method.calcLocked ? '计算逻辑固化、人工不可改' : '暂未固化']);
      return sec('method', '法 · 方法', s.method.sop ? 'ok' : 'partial', s.method.sop ? '公开' : '作业指导书待接入', rows);
    })();

    // 环
    (function () {
      if (level === 4) return sec('env', '环 · 环境', 'na', '该等级不公开', []);
      var src = resolveEnvSource(s.env);
      var hasReading = !!s.env.avgTempHumidity;
      if (level === 3) {
        var st = hasReading ? 'ok' : (src.kind === 'manual' ? 'none' : 'partial');
        var stText = !hasReading && src.kind === 'manual' ? '暂未采集'
          : (src.auto ? '温湿度自动采集' : '手动录入');
        return sec('env', '环 · 环境', st, stText,
          [['平均温湿度', s.env.avgTempHumidity || (src.kind === 'manual' ? '手动录入' : '暂未采集')], ['采集来源', src.text]]);
      }
      if (level === 2 || level === 1) {
        var curves = s.env.specimenCurves || [];
        return sec('env', '环 · 环境', curves.length ? 'ok' : (hasReading ? 'ok' : 'none'),
          curves.length ? (curves.length + ' 张温湿度图') : (src.auto ? '温湿度自动采集' : '手动录入'),
          [['采集来源', src.text], ['温湿度图', curves.length ? ('按试验项 / 试样共 ' + curves.length + ' 张') : '暂未采集'],
           ['环境布局/安全', s.env.layout || (level === 1 ? '见试验线平面' : '—')]],
          curves.length ? { type: 'curves', items: curves } : (s.env.curve ? { type: 'curve', points: s.env.curve } : null));
      }
      // fallback
      var media = s.env.curve ? { type: 'curve', points: s.env.curve, node: (s.env.boundHumidityNode && s.env.boundHumidityNode.nodeId) || s.env.nodeId } : null;
      var rows = [['平均温湿度', s.env.avgTempHumidity || '暂未采集'], ['采集来源', src.text], ['环境布局/安全环保', s.env.layout || '暂未采集']];
      return sec('env', '环 · 环境', hasReading ? 'ok' : 'none', src.auto ? '连续型温湿度（数采回传）' : '手动录入', rows, media,
        '连续型温湿度曲线由数采系统回传（P1 硬目标已可用）。');
    })();

    // 试验流程
    (function () {
      if (level === 4) return sec('flow', '试验流程', 'ok', '公开', [['试验起止时间', s.flow.startEnd]]);
      var nodes = s.flow.nodes || [];
      if (level === 3) {
        var hasProcess = !!(s.flow.receive || (s.flow.tests && s.flow.tests.length) || s.flow.report);
        if (hasProcess) return sec('flow', '试验流程', 'ok', '收样 / 试验 / 报告', l3FlowRows(s.flow, traceCode));
        var pick = ['收样', '检测', '试验', '报告'];
        var rows = nodes.filter(function (n) { return pick.indexOf(n.node) >= 0; }).map(function (n) { return [n.node, n.time]; });
        if (!rows.length) rows = [['试验起止时间', s.flow.startEnd]];
        return sec('flow', '试验流程', 'ok', '核心节点公开', rows);
      }
      if (level === 2) {
        var hasProcess2 = !!(s.flow.receive || (s.flow.tests && s.flow.tests.length) || s.flow.report || (s.flow.fullNodes && s.flow.fullNodes.length));
        if (hasProcess2) return sec('flow', '试验流程', 'ok', '全流程节点', l2FlowRows(s.flow, traceCode));
      }
      var full = nodes.map(function (n) { return [n.node, n.time + '　·　' + (n.owner || '—')]; });
      if (!full.length) full = [['试验起止时间', s.flow.startEnd]];
      return sec('flow', '试验流程', 'ok', '全流程节点公开', full);
    })();

    // 过程影像
    (function () {
      if (level === 4) return sec('image', '过程影像', 'na', '该等级无影像', []);
      var photos = (s.image.photos || []);
      if (level === 3) {
        var nodeSet = {};
        photos.forEach(function (p) { if (p.node) nodeSet[p.node] = true; });
        var nodeCount = Object.keys(nodeSet).length;
        return sec('image', '过程影像', photos.length ? 'ok' : 'none',
          photos.length ? (nodeCount + ' 个节点 · ' + photos.length + ' 张') : '关键照片暂未上传',
          [], photos.length ? { type: 'photos', items: photos } : null);
      }
      if ((level === 2 || level === 1) && s.image.videos && s.image.videos.length) {
        var thumbs = s.image.videos.filter(function (v) { return v.kind !== 'continuous' && v.kind !== 'live'; }).map(function (v) {
          return { node: v.node, label: v.label, poster: v.poster, startTime: v.startTime, endTime: v.endTime, href: videoPlayHref(traceCode, v), kind: v.kind };
        });
        var imgNote = level === 1 ? '全程连续视频 + 各工位实验室监控；过程影像全部为视频，可拖拽回看。' : '';
        return sec('image', '过程影像', 'ok', thumbs.length + ' 段视频', [], { type: 'video-thumbs', items: thumbs }, imgNote);
      }
      // 1：全程连续视频 + 实时监控
      if (s.image.videos && s.image.videos.length) {
        return sec('image', '过程影像', 'ok', '关键节点视频', [], { type: 'video', items: s.image.videos }, '视频凭开始/结束时间锚向组态物联终端后台回源。');
      }
      return sec('image', '过程影像', 'partial', '视频待接入', [], { type: 'video-pending' },
        '视觉节点硬件即将就绪；届时凭上位机「开始/结束」时间锚，向组态物联终端后台按时间区间回源拉取视频（视频不落 LIMS）。' + (level === 1 ? '一级还需全程连续视频 + 实时监控。' : ''));
    })();

    // 数据流转
    (function () {
      if (level === 4) return sec('dataflow', '数据流转', 'ok', '公开', [['流转方式', s.dataflow.mode], ['防篡改', s.dataflow.editable]]);
      if (level === 3) {
        var log = s.dataflow.changeLog || [];
        var rows = [
          ['流转方式', collectModeCell(s.dataflow.collectItems)],
          ['修改留痕', changeLogCell(log, traceCode)]
        ];
        return sec('dataflow', '数据流转', 'ok', '半自动 · 修改留痕', rows);
      }
      if (level === 2 || level === 1) {
        return sec('dataflow', '数据流转', 'ok', level === 1 ? '全链路无人化 · 不可篡改' : '大部分自动 · 仅复核人工',
          [['流转方式', s.dataflow.mode || '设备自动采集→系统自动存储→自动计算'],
           ['设备自动采集', collectModeCell(s.dataflow.collectItems)],
           ['人员权限', s.dataflow.editable || (level === 1 ? '无修改/录入/干预权限' : '原始采集数据不可修改')]]);
      }
      return sec('dataflow', '数据流转', 'none', '无人化待建', [['流转方式', s.dataflow.mode], ['防篡改', s.dataflow.editable]], null,
        '一级目标：全链路无人化、人员不可篡改；待自动采集 + 区块链存证接入。');
    })();

    return { reportNo: reportNo, level: level, levelName: levelName(level), meta: s.meta, frozenAt: s.frozenAt, testItemNo: s.testItemNo, sections: sections };
  }

  /** 扫码验真主入口 */
  function getVerify(code) {
    if (!code) return { ok: false, reason: 'empty', message: '未识别到报告溯源码', entry: null };
    var entry = registry[code];
    if (!entry) return { ok: false, reason: 'not_found', message: '报告溯源码不存在或已失效', entry: null };
    var view = buildTimeline(entry.reportNo, entry.level, code);
    return { ok: true, code: code, status: entry.status, entry: entry, view: view };
  }

  function getRecordSheet(reportNo) {
    var s = snapshots[reportNo];
    if (!s) return null;
    var sample = s.meta.sampleName || '';
    var sheet = {
      title: sample + ' 原始记录单',
      org: s.meta.org || '杭州应敏科技有限公司',
      reportNo: s.reportNo,
      sampleName: sample,
      spec: s.meta.spec || '—',
      clientName: s.meta.clientName || '—',
      sampleNo: s.material.sampleNo,
      stdCode: s.method.stdCode,
      stdName: s.method.stdName,
      inspector: s.person.name,
      equipment: formatEquipLabel(s.equipment),
      env: s.env.avgTempHumidity || '—',
      summary: s.method.dataSummary || '—',
      frozenAt: s.frozenAt,
      testName: '工频耐压试验',
      columns: ['试样编号', '试验电压/kV', '持续时间/min', '泄漏电流/mA', '结论'],
      rows: []
    };
    if (sample.indexOf('手套') >= 0) {
      sheet.testName = '交流耐压试验';
      sheet.columns = ['试样编号', '试验电压/kV', '持续时间/min', '现象', '结论'];
      sheet.rows = [[s.material.sampleNo, '12', '1', '无击穿、无闪络', '合格']];
    } else if (sample.indexOf('废水') >= 0 || (s.method.stdCode || '').indexOf('HJ') === 0) {
      sheet.testName = '化学需氧量测定';
      sheet.columns = ['试样编号', '测定值/(mg/L)', '空白', '结论'];
      sheet.rows = [[s.material.sampleNo, '—', '—', s.meta.conclusion || '合格']];
    } else {
      sheet.rows = [
        [s.material.sampleNo + '-01', '45', '1', '0.8', '合格'],
        [s.material.sampleNo + '-02', '45', '1', '0.7', '合格']
      ];
    }
    return sheet;
  }

  function specimensFromTest(t) {
    if (t.specimens && t.specimens.length) return t.specimens;
    return (t.rows || []).map(function (r) {
      return {
        specimenNo: r[0],
        inspector: t.inspector || '',
        startAt: t.startAt || '',
        endAt: t.endAt || '',
        recorder: t.recorder || '',
        recordAt: t.recordAt || '',
        values: r.slice(1)
      };
    });
  }

  function getTestItemRecords(reportNo) {
    var s = snapshots[reportNo];
    if (!s) return [];
    var tests = (s.flow && s.flow.tests) || [];
    var sheet = getRecordSheet(reportNo);
    if (!tests.length && sheet) {
      return [{
        name: sheet.testName,
        inspector: sheet.inspector,
        recorder: '',
        recordAt: '',
        startAt: '',
        endAt: '',
        equipment: sheet.equipment,
        env: sheet.env,
        stdCode: sheet.stdCode,
        stdName: sheet.stdName,
        sampleNo: sheet.sampleNo,
        columns: sheet.columns,
        rows: sheet.rows,
        specimens: specimensFromTest({ rows: sheet.rows, inspector: sheet.inspector })
      }];
    }
    return tests.map(function (t) {
      return {
        name: t.name || (sheet && sheet.testName) || '试验项',
        inspector: t.inspector || s.person.name,
        recorder: t.recorder || '',
        recordAt: t.recordAt || '',
        startAt: t.startAt || '',
        endAt: t.endAt || '',
        equipment: formatEquipLabel(t.equipment || s.equipment),
        env: (function () {
          var avgs = (s.env.specimenCurves || []).filter(function (c) { return c.testName === t.name; });
          return (avgs[0] && avgs[0].avg) || s.env.avgTempHumidity || '—';
        })(),
        stdCode: s.method.stdCode,
        stdName: s.method.stdName,
        sampleNo: s.material.sampleNo,
        columns: t.columns || (sheet && sheet.columns) || [],
        rows: t.rows || (sheet && sheet.rows) || [],
        specimens: specimensFromTest(t),
        unmanned: !!s.unmanned,
        basis: t.basis || [],
        envDetail: t.envDetail || null,
        equipTable: t.equipTable || [],
        sampleParams: (s.meta && s.meta.sampleParams) || null
      };
    });
  }

  function reportShortUrl(code) { return REPORT_BASE + code; }
  function verifyPageUrl(code) { return VERIFY_PAGE + code; }
  function qrImageUrl(text, size) {
    if (global.ShortLinkQR && global.ShortLinkQR.qrImageUrl) return global.ShortLinkQR.qrImageUrl(text, size);
    size = size || 120;
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text);
  }

  global.ReportTrace = {
    REPORT_BASE: REPORT_BASE,
    AUTHORIZED_LEVEL: AUTHORIZED_LEVEL,
    CAPABILITY_ISSUABLE: CAPABILITY_ISSUABLE,
    LEVELS: LEVELS,
    registry: registry,
    snapshots: snapshots,
    levelName: levelName,
    levelShort: levelShort,
    levelDesc: levelDesc,
    canIssue: canIssue,
    buildPublicView: buildPublicView,
    buildTimeline: buildTimeline,
    getVerify: getVerify,
    returnOutCaption: returnOutCaption,
    getStdDoc: getStdDoc,
    STD_DOCS: STD_DOCS,
    getSopDoc: getSopDoc,
    SOP_DOCS: SOP_DOCS,
    getRecordSheet: getRecordSheet,
    getTestItemRecords: getTestItemRecords,
    getChangeLog: getChangeLog,
    getReworks: getReworks,
    getMaintainRecords: getMaintainRecords,
    getRuntime: getRuntime,
    getConsumables: getConsumables,
    getMethodJudgments: getMethodJudgments,
    getSpecimenCurves: getSpecimenCurves,
    getVideoClip: getVideoClip,
    videoPlayHref: videoPlayHref,
    clipTitle: clipTitle,
    AUTO_COLLECT_MODES: AUTO_COLLECT_MODES,
    EQUIP_CATALOG: EQUIP_CATALOG,
    reportShortUrl: reportShortUrl,
    verifyPageUrl: verifyPageUrl,
    qrImageUrl: qrImageUrl
  };
})(window);
