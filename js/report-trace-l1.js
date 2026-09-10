/**
 * 一级 · 全要素透明报告 Demo
 * 电缆保护管无人化试验线（实壁类塑料电缆导管_直管-PVC-C）
 * 依赖：须在 js/report-trace.js 之后加载，向 ReportTrace.registry / snapshots 注入演示码 R1u8P
 */
(function (global) {
  var RT = global.ReportTrace;
  if (!RT || !RT.snapshots) return;

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

  var POSTERS = [
    'assets/report-trace/video-l1-prep.png',
    'assets/report-trace/video-l1-transfer.png',
    'assets/report-trace/video-l1-load.png',
    'assets/report-trace/video-l1-test.png'
  ];
  var posterIdx = 0;
  function nextPoster() {
    var p = POSTERS[posterIdx % POSTERS.length];
    posterIdx += 1;
    return p;
  }
  function clip(id, node, label, start, end, extra) {
    extra = extra || {};
    var o = {
      id: id,
      node: node,
      label: label,
      poster: extra.poster || nextPoster(),
      startTime: start,
      endTime: end,
      durationSec: extra.durationSec || 18,
      kind: extra.kind || 'process'
    };
    if (extra.testName) o.testName = extra.testName;
    if (extra.cam) o.cam = extra.cam;
    return o;
  }

  var SN = 'SC2026/02240101';
  function spec(n) {
    var s = String(n);
    return SN + '-' + (s.length < 2 ? '0' + s : s);
  }

  var ALL_SPECS = [];
  for (var i = 1; i <= 22; i++) ALL_SPECS.push(spec(i));

  var videos = [
    clip('full-run', '全程', '试验全程连续视频', '2026-02-24 09:40:00', '2026-02-24 16:00:00', {
      kind: 'continuous', durationSec: 180, poster: POSTERS[0]
    }),
    clip('live-lab', '实时监控', '实验室实时监控', '2026-02-24 09:40:00', '2026-02-24 16:00:00', {
      kind: 'live', durationSec: 60, poster: POSTERS[3], cam: 'CAM-LINE'
    }),

    clip('reg-cctv', '委托登记', '业务大厅监控', '2026-02-23 16:20:02', '2026-02-23 16:22:40', { kind: 'cctv', cam: 'CAM-HALL' }),
    clip('recv-cctv', '收样', '收样区监控', '2026-02-24 08:40:05', '2026-02-24 08:43:20', { kind: 'cctv', cam: 'CAM-RECV' }),
    clip('recv-proc', '收样', '开箱验样', '2026-02-24 08:40:10', '2026-02-24 08:43:00', { kind: 'process' }),
    clip('confirm-cctv', '委托确认', '收样区监控', '2026-02-24 09:10:00', '2026-02-24 09:12:10', { kind: 'cctv', cam: 'CAM-RECV' }),

    clip('prep-proc', '制样', '机械臂切割制样', '2026-02-24 09:40:02', '2026-02-24 10:02:30', {
      kind: 'process', poster: POSTERS[0], durationSec: 24
    }),
    clip('prep-cctv', '制样', '制样工位监控', '2026-02-24 09:40:00', '2026-02-24 10:04:00', {
      kind: 'cctv', cam: 'CAM-PREP', poster: POSTERS[0]
    }),
    clip('disp-cctv', '样品发样', '机械臂轨道监控', '2026-02-24 10:05:00', '2026-02-24 10:07:40', {
      kind: 'cctv', cam: 'CAM-TRACK', poster: POSTERS[1]
    }),
    clip('dist-proc', '试样分发', '机械臂自动分发', '2026-02-24 10:08:00', '2026-02-24 10:12:20', {
      kind: 'process', poster: POSTERS[1]
    }),
    clip('dist-cctv', '试样分发', '分发工位监控', '2026-02-24 10:08:00', '2026-02-24 10:12:40', {
      kind: 'cctv', cam: 'CAM-TRACK', poster: POSTERS[1]
    }),

    clip('app-proc', '检测', '外观工位机械臂', '2026-02-24 10:15:10', '2026-02-24 10:34:40', {
      kind: 'process', testName: '颜色外观检查', poster: POSTERS[2]
    }),
    clip('app-cctv', '检测', '外观工位监控', '2026-02-24 10:15:00', '2026-02-24 10:35:00', {
      kind: 'cctv', testName: '颜色外观检查', cam: 'CAM-APP', poster: POSTERS[2]
    }),
    clip('dim-proc', '检测', '尺寸工位机械臂', '2026-02-24 10:40:08', '2026-02-24 11:08:50', {
      kind: 'process', testName: '尺寸检查', poster: POSTERS[3]
    }),
    clip('dim-cctv', '检测', '尺寸工位监控', '2026-02-24 10:40:00', '2026-02-24 11:10:00', {
      kind: 'cctv', testName: '尺寸检查', cam: 'CAM-DIM', poster: POSTERS[3]
    }),
    clip('den-proc', '检测', '密度工位机械臂', '2026-02-24 11:20:05', '2026-02-24 12:08:30', {
      kind: 'process', testName: '密度测量', poster: POSTERS[2]
    }),
    clip('den-cctv', '检测', '密度工位监控', '2026-02-24 11:20:00', '2026-02-24 12:10:00', {
      kind: 'cctv', testName: '密度测量', cam: 'CAM-DEN', poster: POSTERS[2]
    }),
    clip('stiff-proc', '检测', '环刚度工位机械臂', '2026-02-24 13:00:12', '2026-02-24 13:48:40', {
      kind: 'process', testName: '环刚度', poster: POSTERS[3]
    }),
    clip('stiff-cctv', '检测', '环刚度工位监控', '2026-02-24 13:00:00', '2026-02-24 13:50:00', {
      kind: 'cctv', testName: '环刚度', cam: 'CAM-STIFF', poster: POSTERS[3]
    }),
    clip('flat-proc', '检测', '压扁工位机械臂', '2026-02-24 14:00:08', '2026-02-24 14:24:20', {
      kind: 'process', testName: '30%压扁试验', poster: POSTERS[2]
    }),
    clip('flat-cctv', '检测', '压扁工位监控', '2026-02-24 14:00:00', '2026-02-24 14:25:00', {
      kind: 'cctv', testName: '30%压扁试验', cam: 'CAM-FLAT', poster: POSTERS[2]
    }),
    clip('drop-proc', '检测', '落锤工位机械臂', '2026-02-24 14:30:06', '2026-02-24 15:18:40', {
      kind: 'process', testName: '落锤冲击', poster: POSTERS[1]
    }),
    clip('drop-cctv', '检测', '落锤工位监控', '2026-02-24 14:30:00', '2026-02-24 15:20:00', {
      kind: 'cctv', testName: '落锤冲击', cam: 'CAM-DROP', poster: POSTERS[1]
    }),
    clip('vicat-proc', '检测', '维卡工位机械臂', '2026-02-24 15:25:10', '2026-02-24 15:48:50', {
      kind: 'process', testName: '维卡软化温度', poster: POSTERS[3]
    }),
    clip('vicat-cctv', '检测', '维卡工位监控', '2026-02-24 15:25:00', '2026-02-24 15:50:00', {
      kind: 'cctv', testName: '维卡软化温度', cam: 'CAM-VICAT', poster: POSTERS[3]
    }),

    clip('ret-proc', '还样', '机械臂自动还样', '2026-02-24 16:00:02', '2026-02-24 16:06:30', {
      kind: 'process', poster: POSTERS[1]
    }),
    clip('ret-cctv', '还样', '还样工位监控', '2026-02-24 16:00:00', '2026-02-24 16:08:00', {
      kind: 'cctv', cam: 'CAM-TRACK', poster: POSTERS[1]
    }),
    clip('gaudit-cctv', '组内审核', '中控室监控', '2026-02-25 09:00:00', '2026-02-25 09:08:20', { kind: 'cctv', cam: 'CAM-CTRL' }),
    clip('daudit-cctv', '数据审核', '中控室监控', '2026-02-25 09:10:00', '2026-02-25 09:16:40', { kind: 'cctv', cam: 'CAM-CTRL', poster: 'assets/report-trace/video-l1-data-audit.png' }),
    clip('review-cctv', '报告审核', '中控室监控', '2026-02-25 09:30:00', '2026-02-25 09:36:00', { kind: 'cctv', cam: 'CAM-CTRL', poster: 'assets/report-trace/video-l1-report-review.png' }),
    clip('sign-cctv', '报告签发', '中控室监控', '2026-02-25 09:40:00', '2026-02-25 09:42:20', { kind: 'cctv', cam: 'CAM-CTRL', poster: 'assets/report-trace/video-l1-report-sign.png' }),
    clip('handle-cctv', '报告处理', '业务大厅监控', '2026-02-25 10:00:00', '2026-02-25 10:03:40', { kind: 'cctv', cam: 'CAM-HALL', poster: 'assets/report-trace/video-l1-report-handle.png' }),
    clip('issue-cctv', '报告发放', '业务大厅监控', '2026-02-25 11:00:00', '2026-02-25 11:04:20', { kind: 'cctv', cam: 'CAM-HALL', poster: 'assets/report-trace/video-l1-report-issue.png' }),
    clip('arch-cctv', '任务归档', '中控室监控', '2026-02-25 11:30:00', '2026-02-25 11:32:00', { kind: 'cctv', cam: 'CAM-CTRL', poster: 'assets/report-trace/video-l1-report-archive.png' })
  ];

  function autoSpec(no, start, end, values) {
    return {
      specimenNo: spec(no),
      inspector: '机械臂 ARM-01',
      monitor: '周强',
      startAt: start,
      endAt: end,
      recorder: '系统自动记录',
      recordAt: end,
      values: values
    };
  }

  var snap = {
    reportNo: SN + '-01',
    testItemNo: 'TI-0224-01',
    frozenAt: '2026-02-25 09:40',
    unmanned: true,
    unmannedFrom: '样品制备',
    meta: {
      sampleName: '实壁类塑料电缆导管_直管-PVC-C',
      spec: 'PVC-C 直管 SN8 Φ100×4.0×6000',
      clientName: '国网某某供电公司',
      org: '杭州应敏科技有限公司',
      conclusion: '合格',
      testCategory: '型式试验',
      sampleParams: {
        sampleNo: SN,
        ringGrade: 'SN8',
        nominalLength: '6000 mm',
        innerDia: '100 mm',
        wall: '4.0 mm'
      },
      testItems: ['颜色外观检查', '尺寸检查', '密度测量', '环刚度', '30%压扁试验', '落锤冲击', '维卡软化温度']
    },
    person: {
      name: '周强',
      role: '值班监控员',
      certNo: 'ZQ-2025-006',
      authorization: '无人化试验线值守授权（仅设备启动与现场监控，不接触原始数据）',
      training: '2026-01-18 无人化实验室安全与应急培训 · 考核合格',
      qualCert: { name: '高分子材料试验员资格证', no: 'ZJ-PL-2025-006', validTo: '2027-12-31', image: 'assets/report-trace/qual-cert.svg' },
      equipOpCert: { name: '无人化试验线值守操作证', no: 'OP-LINE-U1-2026-01', validTo: '2027-06-30', image: 'assets/report-trace/equip-op-cert.svg' }
    },
    persons: [
      {
        name: '周强',
        certNo: 'ZQ-2025-006',
        qualCert: { name: '高分子材料试验员资格证', no: 'ZJ-PL-2025-006', validTo: '2027-12-31', image: 'assets/report-trace/qual-cert.svg' },
        equipOpCert: { name: '无人化试验线值守操作证', no: 'OP-LINE-U1-2026-01', validTo: '2027-06-30', image: 'assets/report-trace/equip-op-cert.svg' }
      },
      {
        name: '机械臂 ARM-01',
        certNo: 'ARM-01',
        qualCert: { name: '无人化试验线工位标定记录', no: 'CAL-ARM-01-2026', validTo: '2026-08-31', image: 'assets/report-trace/qual-cert.svg' },
        equipOpCert: { name: '六轴机械臂安全联锁确认', no: 'SIL-ARM-01-2026', validTo: '2026-12-31', image: 'assets/report-trace/equip-op-cert.svg' }
      }
    ],
    equipment: {
      code: 'LINE-U1',
      name: '电缆保护管无人化试验线',
      model: 'YM-AUTO-PIPE-01',
      calibCertNo: 'JD2026-0220',
      calibCertImage: 'assets/report-trace/calib-cert-jd2026-0512.jpg',
      nextCalib: '2027-02-19',
      calibOrg: '浙江省计量科学研究院',
      maintainRecords: [
        { date: '2026-01-12', type: '定期保养', item: '机械臂夹爪 / 轨道润滑 / 急停联锁', result: '正常', by: '系统工单' },
        { date: '2026-02-08', type: '校准后确认', item: '天平、卡尺、力学机示值比对', result: '合格', by: '系统自动确认' },
        { date: '2026-02-20', type: '点检', item: '视觉节点与工位监控回源', result: '正常', by: '系统自动巡检' }
      ],
      runtime: {
        source: '设备自动采集',
        equipment: 'YWDW-100',
        testName: '环刚度',
        series: [
          { name: '压缩力', unit: 'kN', points: mockRuntime(1.82, 0.12) },
          { name: '径向变形', unit: 'mm', points: mockRuntime(3.0, 0.08) }
        ]
      }
    },
    material: {
      sampleNo: SN,
      source: '客户送样',
      flow: ['收样 02-24', '制样 02-24', '检测 02-24', '自动审核 02-25', '自动出报 02-25'],
      flowNodes: [
        { key: 'receive', title: '样品收样', timeLabel: '收样时间', people: [{ role: '收样人', name: '李敏', time: '2026-02-24 08:40' }] },
        { key: 'prepare', title: '样品制备', timeLabel: '制备时间', people: [{ role: '执行工位', name: '机械臂 ARM-01', time: '2026-02-24 09:40' }] },
        { key: 'distribute', title: '试样分发', timeLabel: '分发时间', people: [{ role: '执行工位', name: '机械臂 ARM-01', time: '2026-02-24 10:08' }] },
        { key: 'returnLab', title: '样品还样', timeLabel: '还样时间', people: [{ role: '执行工位', name: '机械臂 ARM-01', time: '2026-02-24 16:00' }] }
      ],
      consumables: [
        { name: '浸渍液（蒸馏水）', usage: '密度测量浸渍介质', spec: '实验室自制蒸馏水', batch: 'W-2026-0224', certNo: 'AUTO-BATCH-W0224', supplier: '试验线自动配液', validTo: '2026-02-25', conclusion: '合格', usedIn: ['密度测量'] },
        { name: '密度重锤', usage: '试样浸没配重', spec: '不锈钢重锤', batch: 'SK-2025-11', certNo: 'HGZ-2025-1188', supplier: '某某计量', validTo: '2027-11-30', conclusion: '合格', usedIn: ['密度测量'] },
        { name: '落锤冲头', usage: '落锤冲击试验', spec: 'd90 型锤', batch: 'HM-2026-01', certNo: 'HGZ-2026-0190', supplier: '试验机原厂', validTo: '2028-01-31', conclusion: '合格', usedIn: ['落锤冲击'] },
        { name: '导热硅脂', usage: '维卡软化温度传热', spec: '导热硅脂 2.0 W/m·K', batch: 'GS-2026-0210', certNo: 'HGZ-2026-0210', supplier: '某某化工', validTo: '2027-02-10', conclusion: '合格', usedIn: ['维卡软化温度'] },
        { name: '试样标识标签', usage: '机械臂自动贴标', spec: '耐温不干胶 20×40 mm', batch: 'BQ-2026-0224', certNo: 'AUTO-BATCH-BQ0224', supplier: '试验线自动出标', validTo: '2028-02-24', conclusion: '合格', usedIn: ['颜色外观检查', '尺寸检查', '密度测量', '环刚度', '30%压扁试验', '落锤冲击', '维卡软化温度'] }
      ],
      distribution: [
        {
          picker: '机械臂 ARM-01',
          time: '2026-02-24 10:08',
          specimens: ALL_SPECS,
          photos: [],
          clips: videos.filter(function (v) { return v.id === 'dist-proc' || v.id === 'dist-cctv'; })
        }
      ],
      returns: [
        {
          returner: '机械臂 ARM-01',
          time: '2026-02-24 16:00',
          specimens: ALL_SPECS,
          dest: '样品库 · 待留样',
          photos: [],
          clips: videos.filter(function (v) { return v.id === 'ret-proc' || v.id === 'ret-cctv'; })
        }
      ]
    },
    method: {
      stdCode: 'DL/T 802.3-2023',
      stdName: '电力电缆用导管技术条件 第3部分：实壁塑料电缆导管',
      dataSummary: '颜色外观与尺寸合格；密度 1.412 g/cm³；环刚度 9.01 kN/m²（SN8）；30%压扁无裂纹；落锤冲击无破裂；维卡软化温度 97.9 ℃，均合格',
      sop: '实壁塑料电缆导管无人化型式试验作业指导书 SOP-PIPE-01',
      sopCode: 'SOP-PIPE-01',
      calcLocked: true,
      judgments: [
        {
          testName: '颜色外观检查', specimenNo: spec(1), sampleName: '实壁类塑料电缆导管_直管-PVC-C',
          stdFile: 'DL/T 802.3-2023',
          process: '机械臂将试样送入外观工位 → 工业相机自动采集内外壁与端面 → 算法比对标准要求 → 系统出具结论',
          judgeDesc: '颜色应均匀；内外壁无裂纹、气泡、凹陷等缺陷；内壁光滑平整；端面切割平整。',
          formula: '缺陷像素占比 ≤ 阈值且端面垂直度合格 → 合格（算法固化，人员无权修改）',
          measured: '颜色均匀；内外壁无缺陷；内壁光滑平整；端面切割平整',
          calculated: '系统判定 = 合格',
          nominal: '颜色均匀、无缺陷、内壁光滑、端面平整',
          condition: '四项外观指标均满足 → 合格',
          conclusion: '合格'
        },
        {
          testName: '尺寸检查', specimenNo: spec(2), sampleName: '实壁类塑料电缆导管_直管-PVC-C',
          stdFile: 'DL/T 802.3-2023',
          process: '机械臂装夹 → 数显卡尺自动读取内径/壁厚/长度 → 系统计算不圆度与弯曲度 → 自动判定',
          judgeDesc: '平均内径 100(+0.7,0) mm；壁厚 4.0(+0.7,0) mm；长度 ≥ 6000 mm；不圆度 ≤ 2.0 mm；弯曲度 ≤ 0.5%。',
          formula: '不圆度 = Dmax − Dmin；弯曲度 = 最大间隙 / 长度 × 100%',
          measured: '平均内径 100.32 mm；壁厚 4.18~4.06 mm；长度 6012 mm；不圆度 0.82 mm；弯曲度 0.21%',
          calculated: '不圆度 = 0.82 mm；弯曲度 = 0.21%',
          nominal: '内径 100(+0.7,0)；壁厚 4.0(+0.7,0)；长度 ≥ 6000；不圆度 ≤ 2.0；弯曲度 ≤ 0.5%',
          condition: '五项尺寸均在限值内 → 合格',
          conclusion: '合格'
        },
        {
          testName: '密度测量', specimenNo: spec(3), sampleName: '实壁类塑料电缆导管_直管-PVC-C',
          stdFile: 'GB/T 1033.1-2008 / DL/T 802.3-2023',
          process: '机械臂浸没试样 → 电子天平自动回传 mS,A / mS,IL / mK,IL / mS+K,IL → 固化公式计算密度 → 三试样取平均',
          judgeDesc: '试样密度应符合产品规定上限。',
          formula: 'ρs = [mS,A × ρIL] / [(mS,A − mS,IL) − (mS+K,IL − mK,IL − mS,IL)]（算法固化）',
          measured: 'ρs = 1.411 / 1.409 / 1.415 g/cm³',
          calculated: '平均密度 = 1.412 g/cm³',
          nominal: '密度 ≤ 1.50 g/cm³',
          condition: '平均密度不超过上限 → 合格',
          conclusion: '合格'
        },
        {
          testName: '环刚度', specimenNo: spec(6), sampleName: '实壁类塑料电缆导管_直管-PVC-C',
          stdFile: 'GB/T 9647-2015 / DL/T 802.3-2023',
          process: '机械臂装样 → 力学性能试验机自动加载至 3% 变形 → 力值与变形直采 → 固化公式计算 Sn',
          judgeDesc: 'SN8 环刚度下限 8.0 kN/m²。',
          formula: 'Sn = (0.0186 + 0.025 × y/d) × F / (L × y)',
          measured: 'Sn = 9.12 / 8.86 / 9.05 kN/m²',
          calculated: '平均环刚度 S = 9.01 kN/m²',
          nominal: 'S ≥ 8.0 kN/m²（SN8）',
          condition: '平均环刚度不低于 SN8 下限 → 合格',
          conclusion: '合格'
        },
        {
          testName: '30%压扁试验', specimenNo: spec(9), sampleName: '实壁类塑料电缆导管_直管-PVC-C',
          stdFile: 'DL/T 802.3-2023',
          process: '机械臂装样 → 试验机压至径向变形 30% → 工业相机观察裂纹/断裂/穿孔 → 系统判定',
          judgeDesc: '压至 30% 变形时试样应无裂纹、无断裂、无穿孔。',
          formula: '径向压缩变形率 = Δd / d0 × 100% = 30%（位移闭环控制）',
          measured: '三试样均无裂纹、无断裂、无穿孔',
          calculated: '变形率 = 30.0%',
          nominal: '压至 30% 无裂纹、断裂、穿孔',
          condition: '三试样均无损伤 → 合格',
          conclusion: '合格'
        },
        {
          testName: '落锤冲击', specimenNo: spec(12), sampleName: '实壁类塑料电缆导管_直管-PVC-C',
          stdFile: 'DL/T 802.3-2023',
          process: '试样 0 ℃ 预处理 24 h → 机械臂上料 → 落锤冲击机自动释放 → 相机判定破裂',
          judgeDesc: '规定锤型与高度下试样不应破裂。',
          formula: 'TIR 按 9 试样统计；本批 0/9 破裂 → 通过',
          measured: '9 试样均无开裂、无破裂',
          calculated: 'TIR = 0%',
          nominal: '无破裂',
          condition: '全部试样无破裂 → 合格',
          conclusion: '合格'
        },
        {
          testName: '维卡软化温度', specimenNo: spec(21), sampleName: '实壁类塑料电缆导管_直管-PVC-C',
          stdFile: 'DL/T 802.3-2023',
          process: '机械臂装样 → 维卡仪自动加载并升温 → 针入 1 mm 时记录温度 → 两试样取平均',
          judgeDesc: '维卡软化温度应不低于规定下限。',
          formula: 'Tv = 针入深度达 1 mm 时的温度；平均 Tv ≥ 90 ℃',
          measured: '98.2 ℃ / 97.6 ℃',
          calculated: '平均 Tv = 97.9 ℃',
          nominal: 'Tv ≥ 90 ℃',
          condition: '平均维卡软化温度不低于下限 → 合格',
          conclusion: '合格'
        }
      ]
    },
    env: {
      boundHumidityNode: { nodeId: 'ENV-LINE-01' },
      independentSensor: { model: 'RS-WS-WIFI-6' },
      source: 'sensor', nodeId: 'ENV-LINE-01',
      avgTempHumidity: '23.0℃ / 50%RH / 101.3 hPa',
      curve: mockCurve(23.0, 50),
      layout: '无人化试验线平面：制样 CNC 工位 → 机械臂轨道 → 外观/尺寸/密度/环刚度/压扁/落锤/维卡工位；安全围栏、光幕与急停连锁已启用。环境监测点 ENV-LINE-01 覆盖全线。',
      specimenCurves: [
        { testName: '颜色外观检查', specimenNo: spec(1), avg: '23.0℃ / 50%RH', points: mockCurve(23.0, 50) },
        { testName: '尺寸检查', specimenNo: spec(2), avg: '23.1℃ / 50%RH', points: mockCurve(23.1, 50) },
        { testName: '密度测量', specimenNo: spec(3), avg: '23.0℃ / 49%RH', points: mockCurve(23.0, 49) },
        { testName: '环刚度', specimenNo: spec(6), avg: '23.2℃ / 51%RH', points: mockCurve(23.2, 51) },
        { testName: '30%压扁试验', specimenNo: spec(9), avg: '23.1℃ / 50%RH', points: mockCurve(23.1, 50) },
        { testName: '落锤冲击', specimenNo: spec(12), avg: '0.2℃ / 48%RH（预处理箱）', points: mockCurve(0.2, 48) },
        { testName: '维卡软化温度', specimenNo: spec(21), avg: '23.0℃ / 50%RH', points: mockCurve(23.0, 50) }
      ]
    },
    flow: {
      startEnd: '2026-02-24 ~ 2026-02-25',
      receive: { person: '李敏', time: '2026-02-24 08:40' },
      tests: [
        {
          name: '颜色外观检查', equipment: 'CAM-APP',
          inspector: '机械臂 ARM-01', startAt: '2026-02-24 10:15', endAt: '2026-02-24 10:35',
          recorder: '系统自动记录', recordAt: '2026-02-24 10:35',
          basis: ['DL/T 802.3-2023 第 5.4、6.3 条', 'DL/T 802.1-2023 第 8.2 条'],
          envDetail: { temp: '23.0', humidity: '50', pressure: '101.3' },
          equipTable: [
            { name: '工业相机工位', model: 'VM-APP-01', id: 'CAM-APP', precision: '5 μm/px', before: '正常', after: '正常' }
          ],
          columns: ['试样编号', '颜色均匀性', '内外壁缺陷', '内壁光滑平整', '端面切割', '结论'],
          rows: [[spec(1), '均匀', '无裂纹/气泡/凹陷', '光滑平整', '切割平整', '合格']],
          specimens: [autoSpec(1, '2026-02-24 10:15', '2026-02-24 10:35', ['均匀', '无裂纹/气泡/凹陷', '光滑平整', '切割平整', '合格'])]
        },
        {
          name: '尺寸检查', equipment: 'YBKC-02',
          inspector: '机械臂 ARM-01', startAt: '2026-02-24 10:40', endAt: '2026-02-24 11:10',
          recorder: '系统自动记录', recordAt: '2026-02-24 11:10',
          basis: ['DL/T 802.3-2023 第 5.4、6.3 条'],
          envDetail: { temp: '23.1', humidity: '50', pressure: '101.3' },
          equipTable: [
            { name: '数显卡尺', model: '(0~300)mm/0.01mm', id: 'YBKC-02', precision: '0.01 mm', before: '正常', after: '正常' }
          ],
          columns: ['试样编号', '平均内径/mm', '壁厚max/mm', '壁厚min/mm', '长度/mm', '不圆度/mm', '弯曲度/%', '结论'],
          rows: [[spec(2), '100.32', '4.18', '4.06', '6012', '0.82', '0.21', '合格']],
          specimens: [autoSpec(2, '2026-02-24 10:40', '2026-02-24 11:10', ['100.32', '4.18', '4.06', '6012', '0.82', '0.21', '合格'])]
        },
        {
          name: '密度测量', equipment: 'YH-04',
          inspector: '机械臂 ARM-01', startAt: '2026-02-24 11:20', endAt: '2026-02-24 12:10',
          recorder: '系统自动记录', recordAt: '2026-02-24 12:10',
          basis: [
            'DL/T 802.3-2023 第 5.5、6.4 条',
            'DL/T 802.1-2023 第 8.3.1 条',
            'GB/T 1033.1-2008 第 5.1、5.1.4.4 条'
          ],
          envDetail: { temp: '23.0', humidity: '49', pressure: '101.3' },
          equipTable: [
            { name: '电子天平', model: 'HZK-FA110', id: 'YH-04', precision: '0.0001 g', before: '正常', after: '正常' },
            { name: '水银温度计', model: '(0~100)℃', id: '3236', precision: '0.1 ℃', before: '正常', after: '正常' }
          ],
          columns: ['试样编号', 'mS,A/g', 'mS,IL/g', 'mK,IL/g', 'mS+K,IL/g', 'ρs/(g/cm³)', '平均值/(g/cm³)', '结论'],
          rows: [
            [spec(3), '12.4521', '1.1840', '8.2205', '9.3921', '1.411', '1.412', '合格'],
            [spec(4), '12.3810', '1.1762', '8.2205', '9.3858', '1.409', '1.412', '合格'],
            [spec(5), '12.5102', '1.1918', '8.2205', '9.4010', '1.415', '1.412', '合格']
          ],
          specimens: [
            autoSpec(3, '2026-02-24 11:20', '2026-02-24 11:35', ['12.4521', '1.1840', '8.2205', '9.3921', '1.411', '1.412', '合格']),
            autoSpec(4, '2026-02-24 11:36', '2026-02-24 11:52', ['12.3810', '1.1762', '8.2205', '9.3858', '1.409', '1.412', '合格']),
            autoSpec(5, '2026-02-24 11:53', '2026-02-24 12:10', ['12.5102', '1.1918', '8.2205', '9.4010', '1.415', '1.412', '合格'])
          ]
        },
        {
          name: '环刚度', equipment: 'YWDW-100',
          inspector: '机械臂 ARM-01', startAt: '2026-02-24 13:00', endAt: '2026-02-24 13:50',
          recorder: '系统自动记录', recordAt: '2026-02-24 13:50',
          basis: [
            'DL/T 802.3-2023 第 5.5、6.5.2 条',
            'GB/T 9647-2015',
            'DL/T 802.1-2023 第 8.3.2 条'
          ],
          envDetail: { temp: '23.2', humidity: '51', pressure: '101.3' },
          equipTable: [
            { name: '数显卡尺', model: '(0~300)mm/0.01mm', id: 'YBKC-03', precision: '0.01 mm', before: '正常', after: '正常' },
            { name: '高低温试验箱', model: 'YRD-150A', id: '2412060102', precision: '0.01 ℃', before: '正常', after: '正常' },
            { name: '电缆保护管力学性能试验机', model: 'YWDW-100', id: '2412030104', precision: '0.01 kN', before: '正常', after: '正常' }
          ],
          columns: ['试样编号', '平均长度/mm', '线荷载F/(kN/m)', '3%变形荷载/kN', '预负荷F0/N', 'Sn/(kN/m²)', '平均S/(kN/m²)', '结论'],
          rows: [
            [spec(6), '300.2', '2.738', '0.821', '20', '9.12', '9.01', '合格'],
            [spec(7), '299.8', '2.655', '0.796', '20', '8.86', '9.01', '合格'],
            [spec(8), '300.5', '2.721', '0.818', '20', '9.05', '9.01', '合格']
          ],
          specimens: [
            autoSpec(6, '2026-02-24 13:00', '2026-02-24 13:16', ['300.2', '2.738', '0.821', '20', '9.12', '9.01', '合格']),
            autoSpec(7, '2026-02-24 13:17', '2026-02-24 13:33', ['299.8', '2.655', '0.796', '20', '8.86', '9.01', '合格']),
            autoSpec(8, '2026-02-24 13:34', '2026-02-24 13:50', ['300.5', '2.721', '0.818', '20', '9.05', '9.01', '合格'])
          ]
        },
        {
          name: '30%压扁试验', equipment: 'YAW-W-300',
          inspector: '机械臂 ARM-01', startAt: '2026-02-24 14:00', endAt: '2026-02-24 14:25',
          recorder: '系统自动记录', recordAt: '2026-02-24 14:25',
          basis: ['DL/T 802.3-2023 第 5.5、6.5.3 条'],
          envDetail: { temp: '23.1', humidity: '50', pressure: '101.3' },
          equipTable: [
            { name: '数显卡尺', model: '(0~300)mm/0.01mm', id: 'YBKC-03', precision: '0.01 mm', before: '正常', after: '正常' },
            { name: '微机控制电子试验机', model: 'YAW-W-300', id: 'YAW-W-300', precision: '0.01 kN', before: '正常', after: '正常' }
          ],
          columns: ['试样编号', '径向压缩变形率/%', '裂纹', '断裂', '穿孔', '结论'],
          rows: [
            [spec(9), '30.0', '无', '无', '无', '合格'],
            [spec(10), '30.0', '无', '无', '无', '合格'],
            [spec(11), '30.0', '无', '无', '无', '合格']
          ],
          specimens: [
            autoSpec(9, '2026-02-24 14:00', '2026-02-24 14:08', ['30.0', '无', '无', '无', '合格']),
            autoSpec(10, '2026-02-24 14:09', '2026-02-24 14:16', ['30.0', '无', '无', '无', '合格']),
            autoSpec(11, '2026-02-24 14:17', '2026-02-24 14:25', ['30.0', '无', '无', '无', '合格'])
          ]
        },
        {
          name: '落锤冲击', equipment: 'YBD-322A',
          inspector: '机械臂 ARM-01', startAt: '2026-02-24 14:30', endAt: '2026-02-24 15:20',
          recorder: '系统自动记录', recordAt: '2026-02-24 15:20',
          basis: ['DL/T 802.3-2023 第 5.5、6.5.4 条'],
          envDetail: { temp: '0.2', humidity: '48', pressure: '101.3' },
          equipTable: [
            { name: '数显卡尺', model: '(0~300)mm/0.01mm', id: 'YBKC-03', precision: '0.01 mm', before: '正常', after: '正常' },
            { name: '落锤冲击试验机', model: 'YBD-322A', id: 'YBD-322A', precision: '锤高 0.1 m', before: '正常', after: '正常' }
          ],
          columns: ['试样编号', '预处理时间/h', '锤型', '破坏现象', '结论'],
          rows: [12, 13, 14, 15, 16, 17, 18, 19, 20].map(function (n) {
            return [spec(n), '24', 'd90', '无开裂、无破裂', '合格'];
          }),
          specimens: [12, 13, 14, 15, 16, 17, 18, 19, 20].map(function (n, idx) {
            var start = '2026-02-24 14:' + (30 + idx * 5);
            var endMin = 35 + idx * 5;
            var end = endMin >= 60 ? ('2026-02-24 15:' + (endMin - 60 < 10 ? '0' : '') + (endMin - 60)) : start.replace(/14:\d+/, '14:' + endMin);
            if (n === 12) { start = '2026-02-24 14:30'; end = '2026-02-24 14:35'; }
            if (n === 20) { start = '2026-02-24 15:15'; end = '2026-02-24 15:20'; }
            return autoSpec(n, start, end, ['24', 'd90', '无开裂、无破裂', '合格']);
          })
        },
        {
          name: '维卡软化温度', equipment: 'ZWY-300',
          inspector: '机械臂 ARM-01', startAt: '2026-02-24 15:25', endAt: '2026-02-24 15:50',
          recorder: '系统自动记录', recordAt: '2026-02-24 15:50',
          basis: ['DL/T 802.3-2023 第 5.5、6.6 条'],
          envDetail: { temp: '23.0', humidity: '50', pressure: '101.3' },
          equipTable: [
            { name: '维卡软化温度测定仪', model: 'ZWY-300', id: 'ZWY-300', precision: '0.1 ℃', before: '正常', after: '正常' },
            { name: '数显卡尺', model: '(0~300)mm/0.01mm', id: 'YBKC-03', precision: '0.01 mm', before: '正常', after: '正常' }
          ],
          columns: ['试样编号', '载荷/N', '针入深度/mm', '维卡软化温度/℃', '平均值/℃', '结论'],
          rows: [
            [spec(21), '50', '1.00', '98.2', '97.9', '合格'],
            [spec(22), '50', '1.00', '97.6', '97.9', '合格']
          ],
          specimens: [
            autoSpec(21, '2026-02-24 15:25', '2026-02-24 15:37', ['50', '1.00', '98.2', '97.9', '合格']),
            autoSpec(22, '2026-02-24 15:38', '2026-02-24 15:50', ['50', '1.00', '97.6', '97.9', '合格'])
          ]
        }
      ],
      report: {
        compiler: { name: 'LIMS 自动出报引擎', time: '2026-02-25 09:20' },
        reviewer: { name: 'LIMS 自动审核引擎', time: '2026-02-25 09:30' },
        reviewers: [
          {
            name: 'LIMS 自动审核引擎', role: '自动主审', time: '2026-02-25 09:30',
            cert: { name: '算法固化版本', no: 'ALG-PIPE-2026.02', validTo: '2027-02-28', image: 'assets/report-trace/qual-cert.svg' }
          },
          {
            name: '陈建国', role: '授权签字人电子签章', time: '2026-02-25 09:40',
            cert: { name: '授权签字人资格证', no: 'QS-CJG-2024-001', validTo: '2027-12-31', image: 'assets/report-trace/qual-cert.svg' }
          }
        ],
        approver: { name: '电子签章（陈建国）', time: '2026-02-25 09:40' }
      },
      nodes: [
        { node: '收样', time: '2026-02-24 08:40', owner: '李敏', photos: [] },
        { node: '制样', time: '2026-02-24 09:40', owner: '机械臂 ARM-01', photos: [] },
        { node: '检测', time: '2026-02-24 15:50', owner: '机械臂 ARM-01', photos: [] },
        { node: '复核', time: '2026-02-25 09:10', owner: 'LIMS 自动审核引擎', photos: [] },
        { node: '报告', time: '2026-02-25 09:40', owner: 'LIMS 自动出报引擎', photos: [] }
      ],
      fullNodes: [
        { node: '委托登记', owner: '梁倩', time: '2026-02-23 16:20' },
        { node: '样品收样', owner: '李敏', time: '2026-02-24 08:40' },
        { node: '委托确认', owner: '李敏', time: '2026-02-24 09:10' },
        { node: '样品制备', owner: '机械臂 ARM-01', time: '2026-02-24 09:40' },
        { node: '样品发样', owner: '无人化调度', time: '2026-02-24 10:05' },
        { node: '试样分发', owner: '机械臂 ARM-01', time: '2026-02-24 10:08' },
        { node: '试验检测', owner: '机械臂 ARM-01', time: '2026-02-24 10:15 ~ 15:50' },
        { node: '样品还样', owner: '机械臂 ARM-01', time: '2026-02-24 16:00' },
        { node: '组内审核', owner: 'LIMS 自动审核引擎', time: '2026-02-25 09:00' },
        { node: '数据审核', owner: 'LIMS 自动审核引擎', time: '2026-02-25 09:10' },
        { node: '报告编制', owner: 'LIMS 自动出报引擎', time: '2026-02-25 09:20' },
        { node: '报告审核', owner: 'LIMS 自动审核引擎', time: '2026-02-25 09:30' },
        { node: '报告签发', owner: '电子签章（陈建国）', time: '2026-02-25 09:40' },
        { node: '报告处理', owner: '李敏', time: '2026-02-25 10:00' },
        { node: '报告发放', owner: '李敏', time: '2026-02-25 11:00' },
        { node: '任务归档', owner: '系统自动归档', time: '2026-02-25 11:30' }
      ]
    },
    image: {
      photos: [],
      videos: videos,
      liveMonitorUrl: 'video-play.html?code=R1u8P&id=live-lab',
      continuous: videos[0],
      live: videos[1]
    },
    dataflow: {
      mode: '设备自动采集 → 系统自动传输 → 自动存储 → 自动计算 → 自动审核 → 自动出报告；人员无修改、录入、干预权限',
      editable: '人员无修改 / 录入 / 干预权限，原始数据只读',
      chain: {
        alg: 'SHA-256',
        hash: 'a7f3c91e4b2d80c6e15f44aa908b3c1d77e2a0b9c4d6f8123e5a90b1c2d3e4f5',
        tsa: '联合信任时间戳服务中心',
        tsaAt: '2026-02-25 09:40:02',
        chain: '联盟链存证',
        tx: '0x7c3a9f2e18d04b55c8a1e0f6b29d4471'
      },
      collectItems: [
        { testName: '颜色外观检查', equipment: 'CAM-APP', collectMode: '机械臂自动采集' },
        { testName: '尺寸检查', equipment: 'YBKC-02', collectMode: '机械臂自动采集' },
        { testName: '密度测量', equipment: 'YH-04', collectMode: '机械臂自动采集' },
        { testName: '环刚度', equipment: 'YWDW-100', collectMode: '机械臂自动采集' },
        { testName: '30%压扁试验', equipment: 'YAW-W-300', collectMode: '机械臂自动采集' },
        { testName: '落锤冲击', equipment: 'YBD-322A', collectMode: '机械臂自动采集' },
        { testName: '维卡软化温度', equipment: 'ZWY-300', collectMode: '机械臂自动采集' }
      ]
    }
  };

  RT.registry.R1u8P = { reportNo: SN + '-01', level: 1, status: 'valid', createdAt: '2026-02-25 09:40' };
  RT.snapshots[SN + '-01'] = snap;
  // 二级报告检测样品与一级相同：PVC-C 导管（报告号仍走二级码）
  RT.snapshots['SCZN202508/0007-01'] = (function () {
    var copy = JSON.parse(JSON.stringify(snap));
    copy.reportNo = 'SCZN202508/0007-01';
    copy.testItemNo = 'TI-0007-01';
    copy.frozenAt = '2026-07-16 09:40';
    return copy;
  })();

  if (RT.EQUIP_CATALOG) {
    var extra = {
      'LINE-U1': { code: 'LINE-U1', name: '电缆保护管无人化试验线', model: 'YM-AUTO-PIPE-01' },
      'ARM-01': { code: 'ARM-01', name: '六轴机械臂', model: 'IRB-6700' },
      'YBKC-02': { code: 'YBKC-02', name: '数显卡尺', model: '(0~300)mm/0.01mm' },
      'YBKC-03': { code: 'YBKC-03', name: '数显卡尺', model: '(0~300)mm/0.01mm' },
      'YH-04': { code: 'YH-04', name: '电子天平', model: 'HZK-FA110' },
      '3236': { code: '3236', name: '水银温度计', model: '(0~100)℃' },
      'YWDW-100': { code: '2412030104', name: '电缆保护管力学性能试验机', model: 'YWDW-100' },
      '2412030104': { code: '2412030104', name: '电缆保护管力学性能试验机', model: 'YWDW-100' },
      'YRD-150A': { code: '2412060102', name: '高低温试验箱', model: 'YRD-150A' },
      'YAW-W-300': { code: 'YAW-W-300', name: '微机控制电子试验机', model: 'YAW-W-300' },
      'YBD-322A': { code: 'YBD-322A', name: '落锤冲击试验机', model: 'YBD-322A' },
      'ZWY-300': { code: 'ZWY-300', name: '维卡软化温度测定仪', model: 'ZWY-300' },
      'CAM-APP': { code: 'CAM-APP', name: '工业相机外观工位', model: 'VM-APP-01' }
    };
    Object.keys(extra).forEach(function (k) { RT.EQUIP_CATALOG[k] = extra[k]; });
  }
})(window);
