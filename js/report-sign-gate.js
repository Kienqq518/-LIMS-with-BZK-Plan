/**
 * 报告签发门禁：数据可追溯、结论有依据、资质不越界。
 * 系统预检为 通过 / 待核 / 阻断；任一阻断即锁定签发（一票否决）。
 */
(function (global) {
  var GROUPS = [
    { id: 'contract', title: '委托与合同', hint: '客户、项目、变更、分包是否与合同一致' },
    { id: 'sample', title: '样品信息', hint: '样品与委托单、原始记录、报告三者一致' },
    { id: 'process', title: '检测过程与原始记录', hint: '方法、设备、人员、质控可追溯且在有效期内' },
    { id: 'result', title: '结果与判定', hint: '结论基于限值与判定规则，不超出检测范围' },
    { id: 'report', title: '报告文本与合规性', hint: '编号、标志、授权签字人、归档闭环' }
  ];

  function item(id, name, status, evidence, advice) {
    return { id: id, name: name, status: status, evidence: evidence || '', advice: advice || '' };
  }
  function pass(id, name, evidence) { return item(id, name, 'pass', evidence, ''); }
  function warn(id, name, evidence, advice) { return item(id, name, 'warn', evidence, advice); }
  function block(id, name, evidence, advice) { return item(id, name, 'block', evidence, advice); }

  function defaultGroups(task) {
    var rec = (task.records && task.records[0] && task.records[0].name) || '—';
    var report = (task.reports && task.reports[0] && task.reports[0].no) || (task.code.replace('/', '-') + '-01');
    var method = 'GB/T 12706.3-2020';
    return [
      {
        id: 'contract', title: GROUPS[0].title, hint: GROUPS[0].hint, items: [
          pass('c1', '委托单位与合同客户一致', task.customer + ' · 合同 ' + (task.contract || '—')),
          pass('c2', '检测项目、方法、判定依据已明确', '方法 ' + method + '；判定依据与委托项目匹配'),
          pass('c3', '合同评审已完成，无未确认口头变更', '评审完成于受理当日，无加急/偏离未闭环'),
          pass('c4', '分包已获客户同意并具备资质（或无分包）', '本单无分包'),
          pass('c5', '保密、报告语言、版本要求已确认', '中文 / CMA 标识 / 一式两份')
        ]
      },
      {
        id: 'sample', title: GROUPS[1].title, hint: GROUPS[1].hint, items: [
          pass('s1', '样品编号唯一，名称规格状态数量清楚', task.sample + ' · 接收 ' + task.acceptDate),
          pass('s2', '样品在有效期内，存储条件符合', '常温干燥；接收后未超方法时限'),
          pass('s3', '留样 / 备样 / 退样要求已满足', '留样 1 份，退样按合同'),
          pass('s4', '样品与委托单、原始记录、报告三者一致', '委托 / 记录 / 报告样品名称均为「' + task.sample + '」；记录 ' + rec)
        ]
      },
      {
        id: 'process', title: GROUPS[2].title, hint: GROUPS[2].hint, items: [
          pass('p1', '检测方法及版本在资质 / 认可范围内', method + ' 在 CMA 授权目录'),
          pass('p2', '设备校准 / 检定覆盖检测日期', '电阻测试仪 EQ-R-118 有效期至 2027-03-31'),
          pass('p3', '标准物质、试剂在有效期', '标准电阻 2026-12 到期'),
          pass('p4', '环境条件符合方法要求', '检测间 23.1℃ / 48%RH'),
          pass('p5', '检测人员与签发人在授权领域内', '检测 王工；签发 周签发 · 电力电缆'),
          pass('p6', '原始记录完整、及时、可追溯', rec + ' · ' + ((task.records && task.records[0] && task.records[0].at) || task.acceptDate)),
          pass('p7', '质控数据合格', '平行样 / 校准曲线 / 质控样均在控'),
          pass('p8', '无未批准的方法偏离或异常复测', '无偏离，无离群值')
        ]
      },
      {
        id: 'result', title: GROUPS[3].title, hint: GROUPS[3].hint, items: [
          pass('r1', '数据转录准确，单位与有效数字正确', '与原始记录逐项核对一致'),
          pass('r2', '判定规则明确，符合性声明有限值依据', '采用简单合格判定；实测值未贴边'),
          pass('r3', '结论未超出检测结果支持范围', '仅对已检项目下结论'),
          pass('r4', '分包结果 / 客户提供数据已标识（或无）', '全部为本实验室数据')
        ]
      },
      {
        id: 'report', title: GROUPS[4].title, hint: GROUPS[4].hint, items: [
          pass('t1', '报告编号唯一、页码完整、附件齐全', report),
          pass('t2', 'CMA 标志使用在资质范围内', '电力电缆 · 导体电阻 在授权范围'),
          pass('t3', '授权签字人匹配该领域和报告类型', '周签发 · 电缆类授权签字人'),
          pass('t4', '审核 / 批准 / 签发日期与电子签名位齐全', '审核 李审核；待本节点签发'),
          pass('t5', '声明、作废规则、投诉渠道完整', '报告末页已载明'),
          pass('t6', '原始记录已关联，LIMS 流程可闭环', '编制 → 审核 → 待签发')
        ]
      }
    ];
  }

  function applyOverrides(groups, patches) {
    if (!patches) return groups;
    var map = {};
    patches.forEach(function (p) { map[p.id] = p; });
    groups.forEach(function (g) {
      g.items = g.items.map(function (it) { return map[it.id] ? map[it.id] : it; });
    });
    return groups;
  }

  var PATCHES = {
    'SC2026/0238': [
      warn('r2', '临界值已与客户书面确认（扫描件待归档）',
        '导体电阻贴近限值 90%，已邮件确认仍按合格判定',
        '签发后把客户确认函挂到报告附件')
    ],
    'SC2026/0256': [
      block('s4', '样品与原始记录不一致',
        '委托 / 报告为「8.7/10kV 电力电缆」，原始记录为「吊装带-静负荷试验记录单」',
        '退回编制核对样品与记录，禁止带着错误记录签发'),
      block('p2', '设备校准有效期未覆盖检测日期',
        '电阻测试仪 EQ-R-077 检定有效期 2026-07-01，检测日 2026-07-17 已超期',
        '更换有效设备复测或补做期间核查并经质量负责人批准'),
      block('p5', '签发人不在该领域授权范围',
        '周签发授权领域为低压电缆；本单为 8.7/10kV 中压电缆',
        '改由中压电缆授权签字人签发'),
      block('r3', '结论超出检测结果支持范围',
        '报告对未检的「绝缘偏心」给出合格结论',
        '删除未检项目结论，或补测后再签发'),
      block('t2', '超资质范围使用 CMA 标志',
        '8.7/10kV 电力电缆不在本实验室现行 CMA 授权目录',
        '去掉 CMA 标志改出检测报告，或退回后按非资质报告处理')
    ]
  };

  function summarize(groups) {
    var passN = 0, warnN = 0, blockN = 0, veto = [];
    groups.forEach(function (g) {
      var gp = 0, gw = 0, gb = 0;
      g.items.forEach(function (it) {
        if (it.status === 'block') { blockN++; gb++; veto.push(it); }
        else if (it.status === 'warn') { warnN++; gw++; }
        else { passN++; gp++; }
      });
      g.pass = gp; g.warn = gw; g.block = gb;
      g.status = gb ? 'block' : (gw ? 'warn' : 'pass');
    });
    return {
      groups: groups,
      pass: passN,
      warn: warnN,
      block: blockN,
      locked: blockN > 0,
      stamp: blockN > 0 ? '不可签发' : (warnN > 0 ? '核后可签' : '可签发'),
      veto: veto
    };
  }

  function evaluate(task) {
    if (!task) {
      return summarize([]);
    }
    var groups = applyOverrides(defaultGroups(task), PATCHES[task.code]);
    var result = summarize(groups);
    result.spine = spine(task, result);
    return result;
  }

  function spine(task, result) {
    var rec = (task.records && task.records[0]) || { name: '—', at: '' };
    var report = (task.reports && task.reports[0]) || { no: '—', name: '—', at: '' };
    var mismatch = result.veto.some(function (v) { return v.id === 's4'; });
    var recSample = mismatch ? '吊装带' : task.sample;
    return [
      { k: '样品名称', entrust: task.sample, sample: task.sample, record: recSample, report: task.sample },
      { k: '委托编号', entrust: task.code, sample: task.code, record: task.code, report: report.no },
      { k: '客户单位', entrust: task.customer, sample: task.customer, record: task.customer, report: task.customer },
      { k: '原始记录', entrust: rec.name, sample: rec.name, record: rec.name, report: rec.name },
      { k: '生成时间', entrust: task.acceptDate, sample: task.acceptDate, record: rec.at || '—', report: report.at || '—' }
    ];
  }

  global.ReportSignGate = { GROUPS: GROUPS, evaluate: evaluate };
})(window);
