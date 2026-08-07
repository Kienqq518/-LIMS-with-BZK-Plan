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
    R2c9X: { reportNo: 'SCZN202508/0007-01', level: 2, status: 'valid', createdAt: '2026-07-16 09:40', preview: true },
    R3rev: { reportNo: 'SCZN202508/0005-01', level: 3, status: 'revoked', createdAt: '2026-07-14 10:00', revokeReason: '出具后发现引用标准版本有误，报告召回' },
    R3old: { reportNo: 'SC2026/0099-00', level: 3, status: 'superseded', supersededBy: 'R3a2K', createdAt: '2026-07-16 18:00' }
  };

  /** 连续型温湿度曲线 mock（P1 硬目标：数采回传） */
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
      meta: { sampleName: '绝缘操作杆', spec: '10kV', clientName: '杭州数蚕智能科技有限公司', org: '杭州应敏科技有限公司', conclusion: '合格' },
      person: { name: '张伟', certNo: 'ZW-2024-018', authorization: null, training: null },
      equipment: { code: 'YQ-035', calibCertNo: 'JD2026-0512', nextCalib: '2027-05-11', calibOrg: '浙江省计量科学研究院', runtimeData: null, runtimeCurve: null },
      material: { sampleNo: 'SCZN202508/0009-0101', source: '客户送样', flow: ['收样 07-10', '制样 07-11', '检测 07-12', '复核 07-13'], consumable: null },
      method: { stdCode: 'GB/T 7113.2', stdName: '绝缘软管试验方法', dataSummary: '工频耐压 45kV/1min 通过；泄漏电流 0.8mA', sop: null, calcLocked: true },
      env: { source: 'iot', nodeId: '温湿度01', avgTempHumidity: '23.4℃ / 51%RH', curve: mockCurve(23.4, 51), layout: null },
      flow: {
        startEnd: '2026-07-10 ~ 2026-07-13',
        nodes: [
          { node: '收样', time: '2026-07-10 09:12', owner: '李敏', photos: [{ node: '收样', label: '样品外观照', takenAt: '07-10 09:15' }] },
          { node: '制样', time: '2026-07-11 10:30', owner: '张伟', photos: [{ node: '制样', label: '制样过程照', takenAt: '07-11 10:35' }] },
          { node: '检测', time: '2026-07-12 14:00', owner: '张伟', photos: [{ node: '检测', label: '加载读数照', takenAt: '07-12 14:20' }] },
          { node: '复核', time: '2026-07-13 09:00', owner: '王芳', photos: [] },
          { node: '报告', time: '2026-07-13 15:00', owner: '王芳', photos: [] }
        ]
      },
      image: {
        photos: [
          { node: '收样', label: '样品外观照', takenAt: '07-10 09:15' },
          { node: '制样', label: '制样过程照', takenAt: '07-11 10:35' },
          { node: '检测', label: '加载读数照', takenAt: '07-12 14:20' }
        ],
        videos: null,          // 视觉节点硬件即将就绪
        liveMonitorUrl: null
      },
      dataflow: {
        mode: '半自动（温湿度自动采集，其余人工录入）',
        editable: '原始采集数据不可修改，仅可添加备注',
        changeLog: [
          { at: '2026-07-12 14:35', who: '张伟', field: '泄漏电流', note: '补录备注：读数稳定后取值' }
        ]
      }
    },
    'SCZN202508/0006-01': {
      reportNo: 'SCZN202508/0006-01', testItemNo: 'TI-0006-01', frozenAt: '2026-07-15 11:05',
      meta: { sampleName: '废水', spec: '—', clientName: '某某化工厂', org: '杭州应敏科技有限公司', conclusion: '合格' },
      person: { name: '赵强', certNo: null, authorization: null, training: null },
      equipment: { code: 'YQ-102', calibCertNo: null, nextCalib: null, calibOrg: null, runtimeData: null, runtimeCurve: null },
      material: { sampleNo: 'SCZN202508/0006-0101', source: '客户送样', flow: null, consumable: null },
      method: { stdCode: 'HJ 828', stdName: '水质 化学需氧量的测定', dataSummary: null, sop: null, calcLocked: false },
      env: { source: 'manual', nodeId: null, avgTempHumidity: null, curve: null, layout: null },
      flow: { startEnd: '2026-07-14 ~ 2026-07-15', nodes: null },
      image: { photos: null, videos: null, liveMonitorUrl: null },
      dataflow: { mode: '人工录入、简单存储', editable: '无强制防篡改机制', changeLog: null }
    },
    'SCZN202508/0007-01': {
      reportNo: 'SCZN202508/0007-01', testItemNo: 'TI-0007-01', frozenAt: '2026-07-16 09:40',
      meta: { sampleName: '绝缘手套', spec: '12kV', clientName: '浙江某某供电所', org: '杭州应敏科技有限公司', conclusion: '合格' },
      person: { name: '孙丽', certNo: 'SL-2023-041', authorization: '高压试验授权', training: null },
      equipment: { code: 'YQ-078', calibCertNo: 'JD2026-0330', nextCalib: '2027-03-29', calibOrg: '浙江省计量科学研究院', runtimeData: null, runtimeCurve: null },
      material: { sampleNo: 'SCZN202508/0007-0101', source: '客户送样', flow: ['收样 07-14', '制样 07-15', '检测 07-15', '复核 07-16'], consumable: null },
      method: { stdCode: 'GB/T 17622', stdName: '带电作业用绝缘手套', dataSummary: '交流耐压 12kV 通过', sop: null, calcLocked: true },
      env: { source: 'iot', nodeId: '温湿度02', avgTempHumidity: '22.8℃ / 49%RH', curve: mockCurve(22.8, 49), layout: null },
      flow: {
        startEnd: '2026-07-14 ~ 2026-07-16',
        nodes: [
          { node: '收样', time: '2026-07-14 08:40', owner: '李敏', photos: [] },
          { node: '制样', time: '2026-07-15 09:10', owner: '孙丽', photos: [] },
          { node: '检测', time: '2026-07-15 15:30', owner: '孙丽', photos: [] },
          { node: '复核', time: '2026-07-16 09:00', owner: '王芳', photos: [] }
        ]
      },
      image: {
        photos: [{ node: '检测', label: '加载读数照', takenAt: '07-15 15:35' }],
        videos: null,   // 关键节点视频：视觉节点硬件即将就绪 → 暂未采集
        liveMonitorUrl: null
      },
      dataflow: { mode: '大部分自动（目标）；当前温湿度自动、其余人工', editable: '原始采集数据不可修改', changeLog: [] }
    }
  };
  // 换版旧报告复用新版内容以便演示
  snapshots['SC2026/0099-00'] = snapshots['SC2026/0099-01'];
  snapshots['SCZN202508/0005-01'] = snapshots['SC2026/0099-01'];

  /** 状态徽标类型 */
  // 'ok' 正常公开 | 'partial' 部分/待接入 | 'none' 暂未采集 | 'na' 该等级不公开

  function txt(v, fallbackType) {
    if (v === null || v === undefined || v === '') {
      return { type: fallbackType || 'none', value: null };
    }
    return { type: 'ok', value: v };
  }

  /**
   * 分级公开引擎：按 level × 八维度公开矩阵，产出用于渲染的 sections
   * 缺失一律显式标注（诚实告知，不伪造）
   */
  function buildPublicView(reportNo, level) {
    var s = snapshots[reportNo];
    if (!s) return null;
    var sections = [];

    function sec(key, label, statusType, statusText, rows, media, note) {
      sections.push({ key: key, label: label, statusType: statusType, statusText: statusText, rows: rows || [], media: media || null, note: note || null });
    }

    // 人
    (function () {
      if (level === 4) return sec('person', '人 · 人员', 'ok', '公开', [['操作人员', s.person.name]]);
      if (level === 3) {
        var cert = txt(s.person.certNo);
        return sec('person', '人 · 人员', cert.type === 'ok' ? 'ok' : 'none', cert.type === 'ok' ? '公开' : '资质编号暂未采集',
          [['操作人员', s.person.name], ['资质编号', cert.value || '暂未采集']]);
      }
      // 2 / 1：需资质证书/授权/培训考核（人员资质模块）
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
          [['设备编号', s.equipment.code], ['校准证书', c.value || '暂未采集'], ['下次校准', s.equipment.nextCalib || '—'], ['校准机构', s.equipment.calibOrg || '—']]);
      }
      // 2 / 1：关键运行数据 / 实时参数曲线（设备自动采集）
      var rows = [['设备编号', s.equipment.code], ['校准证书', s.equipment.calibCertNo || '暂未采集'], ['维护记录', '见设备台账'], ['关键运行数据', s.equipment.runtimeData || '暂未采集（设备自动采集待接入）']];
      if (level === 1) rows.push(['实时参数曲线', s.equipment.runtimeCurve || '暂未采集（设备自动采集待接入）']);
      return sec('equipment', '机 · 设备', 'none', '设备自动采集待接入', rows);
    })();

    // 料
    (function () {
      if (level === 4) return sec('material', '料 · 样品', 'ok', '公开', [['样品编号', s.material.sampleNo]]);
      var flow = s.material.flow ? s.material.flow.join('　→　') : null;
      if (level === 3) return sec('material', '料 · 样品', flow ? 'ok' : 'none', flow ? '公开' : '流转节点暂未采集',
        [['样品编号', s.material.sampleNo], ['关键流转节点', flow || '暂未采集']]);
      // 2 / 1：耗材合格证明 / 批次
      return sec('material', '料 · 样品', 'partial', '耗材信息待接入',
        [['样品来源', s.material.source], ['样品编号', s.material.sampleNo], ['流转记录', flow || '暂未采集'], ['耗材合格证明', s.material.consumable || '暂未采集（耗材模块待建）']]);
    })();

    // 法
    (function () {
      if (level === 4) return sec('method', '法 · 方法', 'ok', '公开', [['执行标准', s.method.stdName + '（' + s.method.stdCode + '）']]);
      if (level === 3) return sec('method', '法 · 方法', 'ok', '公开',
        [['执行标准编号', s.method.stdCode], ['原始数据摘要', s.method.dataSummary || '—']]);
      var rows = [['执行标准', s.method.stdName + '（' + s.method.stdCode + '）'], ['作业流程/记录摘要', s.method.dataSummary || '—'], ['作业指导书', s.method.sop || '暂未采集（SOP 模块占位）']];
      if (level === 1) rows.push(['算法固化', s.method.calcLocked ? '计算逻辑固化、人工不可改' : '暂未固化']);
      return sec('method', '法 · 方法', s.method.sop ? 'ok' : 'partial', s.method.sop ? '公开' : '作业指导书待接入', rows);
    })();

    // 环
    (function () {
      if (level === 4) return sec('env', '环 · 环境', 'na', '该等级不公开', []);
      var isIot = s.env.source === 'iot' && s.env.avgTempHumidity;
      if (level === 3) return sec('env', '环 · 环境', isIot ? 'ok' : 'none', isIot ? '温湿度自动采集' : '暂未采集',
        [['平均温湿度', s.env.avgTempHumidity || '暂未采集'], ['采集来源', isIot ? '组态物联终端 · ' + s.env.nodeId + '（数采回传）' : '人工/其他']]);
      // 2 / 1：温湿度汇总 + 连续曲线
      var media = s.env.curve ? { type: 'curve', points: s.env.curve, node: s.env.nodeId } : null;
      var rows = [['平均温湿度', s.env.avgTempHumidity || '暂未采集']];
      if (level === 1) rows.push(['环境布局/安全环保', s.env.layout || '暂未采集']);
      return sec('env', '环 · 环境', isIot ? 'ok' : 'none', isIot ? '连续型温湿度（数采回传）' : '暂未采集', rows, media,
        '连续型温湿度曲线由数采系统回传（P1 硬目标已可用）。');
    })();

    // 试验流程
    (function () {
      if (level === 4) return sec('flow', '试验流程', 'ok', '公开', [['试验起止时间', s.flow.startEnd]]);
      var nodes = s.flow.nodes || [];
      if (level === 3) {
        var pick = ['收样', '检测', '报告'];
        var rows = nodes.filter(function (n) { return pick.indexOf(n.node) >= 0; }).map(function (n) { return [n.node, n.time]; });
        if (!rows.length) rows = [['试验起止时间', s.flow.startEnd]];
        return sec('flow', '试验流程', 'ok', '核心节点公开', rows);
      }
      var full = nodes.map(function (n) { return [n.node, n.time + '　·　' + (n.owner || '—')]; });
      if (!full.length) full = [['试验起止时间', s.flow.startEnd]];
      return sec('flow', '试验流程', 'ok', '全流程节点公开', full);
    })();

    // 过程影像
    (function () {
      if (level === 4) return sec('image', '过程影像', 'na', '该等级无影像', []);
      var photos = (s.image.photos || []);
      if (level === 3) return sec('image', '过程影像', photos.length ? 'ok' : 'none', photos.length ? (photos.length + ' 张关键照片') : '关键照片暂未上传',
        [], photos.length ? { type: 'photos', items: photos } : null,
        '三级公开 2~5 张关键节点照片（各流程环节即拍即传），无视频。');
      // 2：关键节点视频；1：全程连续视频 + 实时监控
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
        var rows = [['流转方式', s.dataflow.mode], ['原始数据', s.dataflow.editable]];
        var log = s.dataflow.changeLog || [];
        if (log.length) rows.push(['修改留痕', log.map(function (l) { return l.at + ' ' + l.who + '：' + l.note; }).join('；')]);
        return sec('dataflow', '数据流转', 'ok', '半自动 · 修改留痕', rows);
      }
      var st = (level === 2) ? 'partial' : 'none';
      var note = (level === 2) ? '目标：大部分环节自动流转、仅复核人工；当前温湿度已自动，其余待设备自动采集接入。'
        : '一级目标：全链路无人化、人员不可篡改；待自动采集 + 区块链存证接入。';
      return sec('dataflow', '数据流转', st, (level === 2 ? '自动化提升中' : '无人化待建'), [['流转方式', s.dataflow.mode], ['防篡改', s.dataflow.editable]], null, note);
    })();

    return { reportNo: reportNo, level: level, levelName: levelName(level), meta: s.meta, frozenAt: s.frozenAt, testItemNo: s.testItemNo, sections: sections };
  }

  /** 扫码验真主入口 */
  function getVerify(code) {
    if (!code) return { ok: false, reason: 'empty', message: '未识别到报告溯源码', entry: null };
    var entry = registry[code];
    if (!entry) return { ok: false, reason: 'not_found', message: '报告溯源码不存在或已失效', entry: null };
    var view = buildPublicView(entry.reportNo, entry.level);
    return { ok: true, code: code, status: entry.status, entry: entry, view: view };
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
    canIssue: canIssue,
    buildPublicView: buildPublicView,
    getVerify: getVerify,
    reportShortUrl: reportShortUrl,
    verifyPageUrl: verifyPageUrl,
    qrImageUrl: qrImageUrl
  };
})(window);
