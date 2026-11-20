/**
 * 报告审核工作台 Mock 基座
 *
 * 口径：三态结论复用 js/ai-review-engine.js（8 条通用确定性规则）+ 本模块的
 *   「品类专属规则」层（演示 电力电缆 限值），对外统一为 通过 / 需复核 / 不通过。
 *
 * 版本（revision）：一份报告可经历多轮 AI 审核（编制退回重审 / 签发退回重跑），
 *   每轮绑定一个报告版本号 Vx.y，AI 结果以 report_id + revision 为键（幂等键）。
 *   多轮时提供「与上一版差异」（已解决 / 新命中 / 仍存在）。
 *
 * 策略（policy.autoReturnOnSevere）：严重项是否「自动退回编制」。开→不通过报告自动退回、
 *   无人工覆盖入口；关→不通过报告保留人工覆盖入口（原型演示切换）。
 *
 * 标注（label）：仅用于 AI 模型持续学习，不对上下游展示；正常 / 误报 / 漏报。
 */
(function (global) {
  // ---- 原型演示策略（可在页面底部开关切换）----
  var POLICY = { autoReturnOnSevere: true };

  // ---- 每条规则的「处置建议」（证据之外再给一句可执行建议）----
  var ADVICE = {
    'L1-a-1': '核对样品编号是否按编号规则填写（前缀+年号-序号）。',
    'L3-a-1': '检测标准号需带年号且现行有效，核对标准版本。',
    'L2-b-1': '逐项核对委托检测项目是否都有对应实测结果。',
    'L2-a-1': '核对收样 / 检测 / 报告日期先后，应满足 收样 ≤ 检测 ≤ 报告。',
    'L2-c-1': '核对设备校准有效期是否覆盖检测日期，必要时换证或补校。',
    'L3-a-2': '核对报告引用标准号与实际检测标准一致（含年号）。',
    'L1-b-1': '补齐检测 / 审核 / 批准三处签名位。',
    'L1-d-1': '核对计量单位是否与参数匹配（在允许单位集合内）。',
    'PG-CABLE-01': '复核导体直流电阻测量值 / 温度修正，或退回编制修订限值判定。',
  };

  function scopeOf(ruleId) {
    return ruleId.indexOf('PG-') === 0 ? '品类专属·电力电缆' : '通用';
  }

  // ---- 品类专属规则层（演示：电力电缆 导体直流电阻限值）----
  var CATEGORY_RULES = {
    'CAT-CABLE': [
      {
        rule_id: 'PG-CABLE-01', group: 'L3-b', level: 'L3', category: '限值符合',
        name: '导体直流电阻 ≤ 标准限值', severity: '一般',
        evalFn: function (snap) {
          if (snap.conductor_resistance == null) return { passed: true, message: '通过（无电阻实测值，跳过）', evidence: {} };
          var ok = Number(snap.conductor_resistance) <= Number(snap.conductor_resistance_limit);
          return {
            passed: ok,
            message: ok ? '通过' : ('导体直流电阻 ' + snap.conductor_resistance + ' Ω/km 超过限值 ' + snap.conductor_resistance_limit + ' Ω/km'),
            evidence: { value: snap.conductor_resistance, limit: snap.conductor_resistance_limit, unit: 'Ω/km' },
          };
        },
      },
    ],
  };

  function ruleName(id, rules) {
    for (var i = 0; i < rules.length; i++) if (rules[i].id === id) return rules[i].name;
    return id;
  }
  function ruleLevel(id, rules) {
    for (var i = 0; i < rules.length; i++) if (rules[i].id === id) return rules[i].level || '';
    return '';
  }

  /**
   * 评估一轮快照：通用 8 条（引擎）+ 品类专属层 → 三态结论 + 分项清单。
   * item: { rule_id, name, level, category, severity, scope, passed, message, evidence, advice }
   */
  function evalSnapshot(snap, categoryBound) {
    var rules = global.AiReviewStore.getRules();
    var cats = global.AiReviewStore.getCategories();
    var binds = global.AiReviewStore.getBindings();
    var run = global.AiReviewEngine.run(snap, rules, cats, binds);

    var items = [];

    rules.forEach(function (rule) {
      if (!rule.enabled) return;
      var er = global.AiReviewEngine.evalRule(rule.id, snap);
      items.push({
        rule_id: rule.id, name: ruleName(rule.id, rules), level: ruleLevel(rule.id, rules),
        category: er.category, severity: er.severity, scope: scopeOf(rule.id),
        passed: er.passed, message: er.message, evidence: er.evidence, advice: ADVICE[rule.id] || '',
      });
    });

    if (categoryBound && CATEGORY_RULES[snap.category_code]) {
      CATEGORY_RULES[snap.category_code].forEach(function (cr) {
        var res = cr.evalFn(snap);
        items.push({
          rule_id: cr.rule_id, name: cr.name, level: cr.level, category: cr.category,
          severity: cr.severity, scope: scopeOf(cr.rule_id), passed: res.passed,
          message: res.message, evidence: res.evidence, advice: ADVICE[cr.rule_id] || '',
        });
      });
    }

    var failed = items.filter(function (i) { return !i.passed; });
    var severe = failed.filter(function (i) { return i.severity === '严重'; });
    var review = failed.filter(function (i) { return i.severity === '一般'; });
    var passed = items.filter(function (i) { return i.passed; });

    var conclusion = '通过';
    if (severe.length) conclusion = '不通过';
    else if (review.length) conclusion = '需复核';

    // 品类已绑定则抑制「未配置品类」提示
    var notices = (run.notices || []).filter(function (n) {
      return !(categoryBound && n.code === 'CAT-UNCAT-01');
    });

    return {
      conclusion: conclusion, items: items, passed: passed, failed: failed,
      severe: severe, review: review, notices: notices,
      summary: { total: items.length, universal: items.filter(function (i) { return i.scope === '通用'; }).length,
        category: items.filter(function (i) { return i.scope !== '通用'; }).length, failed: failed.length },
    };
  }

  // 与上一版差异：已解决 / 新命中 / 仍存在（按 rule_id 比对失败项）
  function diffRounds(prevResult, currResult) {
    if (!prevResult) return null;
    var prevFail = {}; prevResult.failed.forEach(function (i) { prevFail[i.rule_id] = i; });
    var currFail = {}; currResult.failed.forEach(function (i) { currFail[i.rule_id] = i; });
    var resolved = prevResult.failed.filter(function (i) { return !currFail[i.rule_id]; });
    var added = currResult.failed.filter(function (i) { return !prevFail[i.rule_id]; });
    var persisted = currResult.failed.filter(function (i) { return prevFail[i.rule_id]; });
    return { resolved: resolved, added: added, persisted: persisted };
  }

  // 整份报告的「当前轮」= 最后一轮快照
  function currentRound(report) { return report.rounds[report.rounds.length - 1]; }
  function evalRound(report, round) { return evalSnapshot(round.snapshot, report.categoryBound); }
  function evalReport(report) { return evalRound(report, currentRound(report)); }

  // ============ 数据种子 ============
  function cableSnap(overrides) {
    var s = {
      category_code: 'CAT-CABLE', category_name: '电力电缆',
      sample_no: 'SC2026-0238', entrust_items: ['导体直流电阻', '绝缘厚度'],
      result_params: ['导体直流电阻', '绝缘厚度'],
      receive_date: '2026-08-28', test_date: '2026-09-01', report_date: '2026-09-03',
      device_calib_from: '2026-01-01', device_calib_to: '2026-12-31',
      signatures: { tester: '李明', reviewer: '王芳', approver: '赵强' },
      units: [{ param: '绝缘厚度', unit: 'mm' }],
      test_standard: 'GB/T 12706.1-2020', cited_standard: 'GB/T 12706.1-2020',
      conductor_resistance: 0.520, conductor_resistance_limit: 0.524,
    };
    for (var k in overrides) if (Object.prototype.hasOwnProperty.call(overrides, k)) s[k] = overrides[k];
    return s;
  }

  // 导体直流电阻 挂 2 个标准（演示一项多标准）
  var STD_DCR = [
    { no: 'GB/T 3048.4-2007', name: '电线电缆电性能试验方法 第4部分：导体直流电阻试验', file: 'GB_T_3048.4-2007.pdf' },
    { no: 'GB/T 12706.1-2020', name: '额定电压1kV到35kV挤包绝缘电力电缆 第1部分（限值依据）', file: 'GB_T_12706.1-2020.pdf' },
  ];
  var STD_INS = [{ no: 'GB/T 2951.11-2008', name: '电缆绝缘和护套材料通用试验方法 第11部分：厚度测量', file: 'GB_T_2951.11-2008.pdf' }];

  // 收样信息：以「单次收样」为单位（支持多次）；每次含样品规格 / 数量 / 图片 / 送样信息
  var CABLE_RECEIVE = {
    times: [
      {
        no: 1, date: '2026-08-28 10:05', receiver: '赵工', status: '完好', sender: '王工', sendWay: '自送', senderPhone: '13867120018',
        note: '客户要求优先安排导体电阻；样品附合格证复印件。',
        images: [{ label: '样品全貌' }, { label: '规格标签' }],
        samples: [{
          sampleNo: 'SC2026/0238-0101', productMark: 'YJV-8.7/10 1×120', model: 'YJV', category: '委托试验', qty: '1 根', factory: '远东电缆',
          specs: [{ k: '导体标称截面积(mm²)', v: '120' }, { k: '额定电压(kV)', v: '8.7/10' }, { k: '芯数', v: '单芯' }, { k: '绝缘', v: 'XLPE' }],
        }],
      },
      {
        no: 2, date: '2026-08-29 09:20', receiver: '赵工', status: '完好', sender: '王工', sendWay: '快递', senderPhone: '13867120018',
        note: '补样一段用于绝缘厚度复测。',
        images: [{ label: '样品全貌' }],
        samples: [{
          sampleNo: 'SC2026/0238-0101-B', productMark: 'YJV-8.7/10 1×120', model: 'YJV', category: '委托试验', qty: '1 段', factory: '远东电缆',
          specs: [{ k: '导体标称截面积(mm²)', v: '120' }, { k: '额定电压(kV)', v: '8.7/10' }],
        }],
      },
    ],
  };

  // 检测信息：以「样品」为单位，列每个样品的试验项及结论；每个试验项挂 原始记录 / 标准 / 作业指导书
  var CABLE_DETECT = {
    samples: [{
      sampleNo: 'SC2026/0238-0101', productMark: 'YJV-8.7/10 1×120', model: 'YJV', category: '委托试验', qty: '1 组', factory: '远东电缆',
      items: [
        {
          name: '导体直流电阻', std: 'GB/T 3048.4-2007', review: '已复审', result: '合格', method: '电桥法', tester: '李明', date: '2026-09-01',
          process: '试样在 20℃ 恒温后，采用双臂电桥测量导体直流电阻，读取三次取平均。',
          requirement: '导体直流电阻 ≤ 0.524 Ω/km（GB/T 12706.1-2020）。',
          recorder: '李明', recordedAt: '2026-09-01 15:20',
          device: 'QJ36 直流电桥', calib: '2026-01-01 ~ 2026-12-31',
          standards: STD_DCR, sops: [{ no: 'SOP-DL-012', name: '导体直流电阻测量作业指导书', file: 'SOP-DL-012.docx' }],
          raws: [{ name: 'SC2026-0238-0101导体电阻原始记录.docx', at: '2026-09-01 15:20' }],
          rawDetail: { condition: '20.0℃ / 相对湿度 52%', rows: [{ k: '第1次', v: '0.519 Ω/km' }, { k: '第2次', v: '0.521 Ω/km' }, { k: '第3次', v: '0.520 Ω/km' }, { k: '平均值', v: '0.520 Ω/km' }, { k: '限值', v: '≤ 0.524 Ω/km' }] },
        },
        {
          name: '绝缘厚度', std: 'GB/T 2951.11-2008', review: '已完成', result: '合格', method: '投影仪测量', tester: '李明', date: '2026-09-01',
          process: '沿绝缘圆周均布 6 点，投影仪读取厚度，取最小点判定。',
          requirement: '绝缘最薄点 ≥ 标称厚度的 90%，且平均值 ≥ 标称厚度。',
          recorder: '李明', recordedAt: '2026-09-01 16:02',
          device: 'JX-200 投影仪', calib: '2026-01-01 ~ 2026-12-31',
          standards: STD_INS, sops: [{ no: 'SOP-DL-003', name: '绝缘厚度投影测量作业指导书', file: 'SOP-DL-003.docx' }],
          raws: [{ name: 'SC2026-0238-0101绝缘厚度原始记录.docx', at: '2026-09-01 16:02' }],
          rawDetail: { condition: '室温 23℃', rows: [{ k: '点1–6 最小', v: '3.42 mm' }, { k: '平均值', v: '3.58 mm' }, { k: '标称厚度', v: '3.4 mm' }] },
        },
        {
          name: '老化前绝缘机械性能', std: 'GB/T 2951.11-2008', review: '已复审', result: '合格', method: '拉力试验', tester: '周敏', date: '2026-09-01',
          process: '哑铃试样拉伸至断裂，记录抗张强度与断裂伸长率。',
          requirement: '抗张强度 ≥ 12.5 MPa，断裂伸长率 ≥ 200%。',
          recorder: '周敏', recordedAt: '2026-09-01 16:40',
          device: 'LD26504 力学试验机', calib: '2026-02-01 ~ 2027-01-31',
          standards: STD_INS, sops: [{ no: 'SOP-DL-021', name: '绝缘机械性能试验作业指导书', file: 'SOP-DL-021.docx' }],
          raws: [{ name: 'SC2026-0238-0101机械性能原始记录.docx', at: '2026-09-01 16:40' }],
          rawDetail: { condition: '拉伸速度 250 mm/min', rows: [{ k: '抗张强度', v: '14.8 MPa' }, { k: '断裂伸长率', v: '280 %' }] },
        },
      ],
    }],
  };

  function cableInfo(extra) {
    var o = { receive: CABLE_RECEIVE, detect: CABLE_DETECT, traceCode: 'R3a2K' };
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    return o;
  }

  var ENTRUSTS = [
    {
      code: 'SC2026/0238', contract: '/', customer: '杭州数蚕智能科技有限公司', sample: '10kV3芯电力电缆',
      sendDate: '2026-09-03', requireDate: '2026-09-08', acceptDate: '2026-09-03',
      priority: '常规', status: '报告审核', compiler: 'admin',
      contractInfo: { frame: '否', contractNo: '/', signPlace: '杭州', signDate: '2026-09-01', center: '应敏科技有限公司' },
      payInfo: { total: 3600, actual: 3600, discount: 0, way: '对公转账', payer: '杭州数蚕智能科技有限公司', note: '费用随报告一起结算' },
      reportInfo: { send: '邮寄', qualify: 'CNAS CMA', desc: '按试样各出一份', resultMode: '判定', lang: '中文', copies: 4 },
      reports: [
        // 01：AI 通过 → 人工已通过（展示已处置结果）
        {
          id: 'rr-0238-01', reportNo: 'SC2026/0238-01', reportName: 'SC2026-0238-01检测报告.docx',
          sampleNos: ['SC2026/0238-0101'], categoryBound: true, state: '通过',
          snapshotHash: 'a1b2c3', file: { word: 'SC2026-0238-01检测报告.docx', pdf: 'SC2026-0238-01检测报告.pdf', at: '2026-09-03 09:05' },
          info: cableInfo(),
          rounds: [{ revision: 'V1.0', trigger: '进入报告审核', at: '2026-09-03 09:10', snapshot: cableSnap({ sample_no: 'SC2026-0238' }) }],
          disposition: { final: '通过', agreeAi: true, at: '2026-09-03 10:20', by: '李审核', note: '同意 AI（通过），标注均为正常' },
          log: [
            { at: '2026-09-02 17:30', node: '报告生成', by: '系统', text: '生成报告 SC2026/0238-01', tone: 'default' },
            { at: '2026-09-03 08:50', node: '报告编制', by: 'admin', text: '提交至报告审核', tone: 'default' },
            { at: '2026-09-03 09:10', node: 'AI审核', by: '系统', text: '预审结论：通过（V1.0）', tone: 'success' },
            { at: '2026-09-03 10:20', node: '报告审核', by: '李审核', text: '人工审核通过，提交至报告签发', tone: 'success' },
            { at: '2026-09-03 10:20', node: '报告签发', by: '系统', text: '等待授权签字人签发', tone: 'pending' },
          ],
        },
        // 02：AI 需复核，编制退回后重审（两轮，带差异）
        {
          id: 'rr-0238-02', reportNo: 'SC2026/0238-02', reportName: 'SC2026-0238-02检测报告.docx',
          sampleNos: ['SC2026/0238-0102'], categoryBound: true, state: '待处置',
          snapshotHash: 'd4e5f6', file: { word: 'SC2026-0238-02检测报告.docx', pdf: 'SC2026-0238-02检测报告.pdf', at: '2026-09-04 14:10' },
          info: cableInfo(),
          rounds: [
            {
              revision: 'V1.0', trigger: '进入报告审核', at: '2026-09-03 11:00',
              snapshot: cableSnap({
                sample_no: 'SC2026-0239',
                cited_standard: 'GB/T 12706.1-2008', // L3-a-2 一般
                units: [{ param: '导体直流电阻', unit: 'kgf·m' }], // L1-d-1 一般
                conductor_resistance: 0.531, conductor_resistance_limit: 0.524, // PG-CABLE-01 一般
              }),
            },
            {
              revision: 'V1.1', trigger: '编制修改后重审', at: '2026-09-04 14:20',
              snapshot: cableSnap({
                sample_no: 'SC2026-0239',
                cited_standard: 'GB/T 12706.1-2008', // 仍存在 L3-a-2
                units: [{ param: '导体直流电阻', unit: 'Ω' }], // 已解决 L1-d-1
                conductor_resistance: 0.519, conductor_resistance_limit: 0.524, // 已解决 PG-CABLE-01
              }),
            },
          ],
          disposition: null,
          log: [
            { at: '2026-09-02 17:30', node: '报告生成', by: '系统', text: '生成报告 SC2026/0238-02', tone: 'default' },
            { at: '2026-09-03 10:40', node: '报告编制', by: 'admin', text: '提交至报告审核', tone: 'default' },
            { at: '2026-09-03 11:00', node: 'AI审核', by: '系统', text: '预审结论：需复核（V1.0，命中 3 项一般）', tone: 'warn' },
            { at: '2026-09-03 15:30', node: '报告审核', by: '李审核', text: '退回报告编制。原因：引用标准/单位/电阻限值需核', tone: 'danger' },
            { at: '2026-09-04 14:10', node: '报告编制', by: 'admin', text: '修订后重新提交（版本 V1.1）', tone: 'default' },
            { at: '2026-09-04 14:20', node: 'AI审核', by: '系统', text: '重审结论：需复核（V1.1，仍剩 1 项一般）', tone: 'warn' },
          ],
        },
        // 03：AI 不通过（缺批准签名·严重）→ 自动退回编制（可被策略开关切换为人工覆盖）
        {
          id: 'rr-0238-03', reportNo: 'SC2026/0238-03', reportName: 'SC2026-0238-03检测报告.docx',
          sampleNos: ['SC2026/0238-0103'], categoryBound: true, state: '自动退回编制',
          snapshotHash: 'g7h8i9', file: { word: 'SC2026-0238-03检测报告.docx', pdf: 'SC2026-0238-03检测报告.pdf', at: '2026-09-03 11:30' },
          info: cableInfo(),
          rounds: [{
            revision: 'V1.0', trigger: '进入报告审核', at: '2026-09-03 11:35',
            snapshot: cableSnap({ sample_no: 'SC2026-0240', signatures: { tester: '李明', reviewer: '王芳', approver: '' } }),
          }],
          disposition: null,
          log: [
            { at: '2026-09-02 17:30', node: '报告生成', by: '系统', text: '生成报告 SC2026/0238-03', tone: 'default' },
            { at: '2026-09-03 11:20', node: '报告编制', by: 'admin', text: '提交至报告审核', tone: 'default' },
            { at: '2026-09-03 11:35', node: 'AI审核', by: '系统', text: '预审结论：不通过（V1.0，命中严重项 L1-b-1）', tone: 'danger' },
            { at: '2026-09-03 11:35', node: '报告编制', by: '系统', text: '按策略自动退回报告编制', tone: 'danger' },
          ],
        },
        // 04：签发退回 → 直接回报告审核（不自动重跑，保留上次结果与标注，提供重跑）
        {
          id: 'rr-0238-04', reportNo: 'SC2026/0238-04', reportName: 'SC2026-0238-04检测报告.docx',
          sampleNos: ['SC2026/0238-0104'], categoryBound: true, state: '签发退回待复核',
          snapshotHash: 'j1k2l3', file: { word: 'SC2026-0238-04检测报告.docx', pdf: 'SC2026-0238-04检测报告.pdf', at: '2026-09-03 09:40' },
          info: cableInfo(),
          signOff: { returned: true, by: '周签发', at: '2026-09-05 09:15', opinion: '结论页检测结论措辞与检测数据口径不一致，退回报告审核核实后再签发。' },
          lastDisposition: { final: '通过', agreeAi: true, by: '李审核', at: '2026-09-03 10:05', note: '同意 AI（通过），各通过项标注=正常' },
          rounds: [{ revision: 'V1.0', trigger: '进入报告审核', at: '2026-09-03 09:45', snapshot: cableSnap({ sample_no: 'SC2026-0241' }) }],
          disposition: null,
          log: [
            { at: '2026-09-02 17:30', node: '报告生成', by: '系统', text: '生成报告 SC2026/0238-04', tone: 'default' },
            { at: '2026-09-03 09:30', node: '报告编制', by: 'admin', text: '提交至报告审核', tone: 'default' },
            { at: '2026-09-03 09:45', node: 'AI审核', by: '系统', text: '预审结论：通过（V1.0）', tone: 'success' },
            { at: '2026-09-03 10:05', node: '报告审核', by: '李审核', text: '人工审核通过', tone: 'success' },
            { at: '2026-09-03 16:00', node: '报告签发', by: '系统', text: '提交至报告签发', tone: 'default' },
            { at: '2026-09-05 09:15', node: '报告签发', by: '周签发', text: '签发退回。意见：结论措辞与数据口径不一致', tone: 'danger' },
            { at: '2026-09-05 09:16', node: '报告审核', by: '系统', text: '退回至报告审核，待复核（不自动重跑 AI）', tone: 'warn' },
          ],
        },
      ],
    },
    {
      code: 'SC2026/0231', contract: '/', customer: '杭州数蚕智能科技有限公司', sample: '10kV3芯电力电缆',
      sendDate: '2026-09-01', requireDate: '2026-09-02', acceptDate: '2026-09-01',
      priority: '常规', status: '报告审核', compiler: 'admin',
      contractInfo: { frame: '否', contractNo: '/', signPlace: '杭州', signDate: '2026-08-30', center: '应敏科技有限公司' },
      payInfo: { total: 1200, actual: 1200, discount: 0, way: '对公转账', payer: '杭州数蚕智能科技有限公司', note: '/' },
      reportInfo: { send: '自取', qualify: 'CNAS CMA', desc: '按试样各出一份', resultMode: '判定', lang: '中文', copies: 1 },
      reports: [{
        id: 'rr-0231-01', reportNo: 'SC2026/0231-01', reportName: 'SC2026-0231-01检测报告.docx',
        sampleNos: ['SC2026/0231-0101'], categoryBound: true, state: '待处置',
        snapshotHash: 'm4n5o6', file: { word: 'SC2026-0231-01检测报告.docx', pdf: 'SC2026-0231-01检测报告.pdf', at: '2026-09-01 16:00' },
        info: cableInfo(),
        rounds: [{ revision: 'V1.0', trigger: '进入报告审核', at: '2026-09-01 16:10', snapshot: cableSnap({ sample_no: 'SC2026-0231' }) }],
        disposition: null,
        log: [
          { at: '2026-09-01 15:40', node: '报告生成', by: '系统', text: '生成报告 SC2026/0231-01', tone: 'default' },
          { at: '2026-09-01 16:10', node: 'AI审核', by: '系统', text: '预审结论：通过（V1.0）', tone: 'success' },
        ],
      }],
    },
    {
      code: 'SC2026/0200', contract: '/', customer: '智载科技', sample: '复合绝缘盖板',
      sendDate: '2026-06-10', requireDate: '2026-06-20', acceptDate: '2026-06-10',
      priority: '常规', status: '报告审核', compiler: 'admin',
      contractInfo: { frame: '否', contractNo: '/', signPlace: '杭州', signDate: '2026-06-08', center: '应敏科技有限公司' },
      payInfo: { total: 800, actual: 800, discount: 0, way: '对公转账', payer: '智载科技', note: '/' },
      reportInfo: { send: '邮寄', qualify: 'CMA', desc: '按试样各出一份', resultMode: '判定', lang: '中文', copies: 1 },
      reports: [{
        id: 'rr-0200-01', reportNo: 'SC2026/0200-01', reportName: 'SC2026-0200-01检测报告.docx',
        sampleNos: ['SC2026/0200-0101'], categoryBound: false, state: '待处置',
        snapshotHash: 'p7q8r9', file: { word: 'SC2026-0200-01检测报告.docx', pdf: 'SC2026-0200-01检测报告.pdf', at: '2026-06-10 16:00' },
        info: cableInfo({ packVersion: '未配置行业包' }),
        rounds: [{
          revision: 'V1.0', trigger: '进入报告审核', at: '2026-06-10 16:10',
          snapshot: cableSnap({ sample_no: 'SC2026-0200', category_code: null, category_name: '', units: [{ param: '绝缘电阻', unit: 'GΩ' }] }),
        }],
        disposition: null,
        log: [
          { at: '2026-06-10 15:40', node: '报告生成', by: '系统', text: '生成报告 SC2026/0200-01', tone: 'default' },
          { at: '2026-06-10 16:10', node: 'AI审核', by: '系统', text: '预审结论：需复核（V1.0，未配置品类仅跑通用集）', tone: 'warn' },
        ],
      }],
    },
  ];

  function getEntrust(code) {
    for (var i = 0; i < ENTRUSTS.length; i++) if (ENTRUSTS[i].code === code) return ENTRUSTS[i];
    return null;
  }

  // 供「报告编制」页展示：被 AI 判不通过（严重）的报告（跨页同源）
  function aiReturnedReports() {
    var out = [];
    ENTRUSTS.forEach(function (ent) {
      ent.reports.forEach(function (rep) {
        var r = evalReport(rep);
        if (r.conclusion === '不通过') {
          out.push({ entrustCode: ent.code, customer: ent.customer, sample: ent.sample, reportNo: rep.reportNo, reasons: r.severe });
        }
      });
    });
    return out;
  }

  global.ReportReviewMock = {
    ENTRUSTS: ENTRUSTS,
    getEntrust: getEntrust,
    evalReport: evalReport,
    evalRound: evalRound,
    evalSnapshot: evalSnapshot,
    diffRounds: diffRounds,
    currentRound: currentRound,
    aiReturnedReports: aiReturnedReports,
    getPolicy: function () { return POLICY; },
    setAutoReturn: function (v) { POLICY.autoReturnOnSevere = !!v; },
    CONCLUSION_META: {
      '通过': { cls: 'bg-emerald-100 text-emerald-700', icon: 'fa-check-circle' },
      '需复核': { cls: 'bg-amber-100 text-amber-700', icon: 'fa-exclamation-circle' },
      '不通过': { cls: 'bg-red-100 text-red-700', icon: 'fa-times-circle' },
    },
    LABEL_NOTE: '标注仅用于 AI 模型持续学习优化，不对上下游人员展示',
  };
})(window);
