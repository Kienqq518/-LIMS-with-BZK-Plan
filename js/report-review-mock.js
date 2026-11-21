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
          device: '直流电阻测试装置系统（无人化）', calib: '2026-01-01 ~ 2026-12-31',
          standards: STD_DCR, sops: [{ no: 'SOP-DL-012', name: '导体直流电阻测量作业指导书', file: 'SOP-DL-012.docx' }],
          raws: [{ name: 'SC2026-0238-0101导体电阻原始记录.docx', at: '2026-09-01 15:20' }],
          equipment: {
            name: '直流电阻测试装置系统（无人化）', no: 'YM-MYH-01', model: 'YWZLG-100',
            collect: '无人化直连采集', calibStatus: '正常', lastCalib: '2026-01-08',
            calibFrom: '2026-01-01', calibTo: '2026-12-31', precision: '±0.05%',
          },
          groups: [
            { key: 'nom', title: '标称值', cols: ['导体直流电阻限值 R₂₀,max(Ω/km)'] },
            { key: 'mea', title: '测量值', cols: ['试样长度 L(mm)', '正向电阻 Rfwd(μΩ)', '反向电阻 Rrev(μΩ)', '平均电阻 Ravg(μΩ)', '温度(℃)', '湿度(%RH)', '气压(kPa)', '设备试验前状态', '设备试验后状态'] },
            { key: 'calc', title: '计算值', cols: ['20℃导体直流电阻 R₂₀(Ω/km)'] },
          ],
          phases: [
            { name: '红', conclusion: '合格', rows: [{ '试样编号': 'SC2026-0238-0101-01', '导体直流电阻限值 R₂₀,max(Ω/km)': '≤ 0.524', '试样长度 L(mm)': '1000', '正向电阻 Rfwd(μΩ)': '519.2', '反向电阻 Rrev(μΩ)': '520.8', '平均电阻 Ravg(μΩ)': '520.0', '温度(℃)': '20.0', '湿度(%RH)': '52', '气压(kPa)': '101.2', '设备试验前状态': '正常', '设备试验后状态': '正常', '20℃导体直流电阻 R₂₀(Ω/km)': '0.520' }] },
            { name: '黄', conclusion: '合格', rows: [{ '试样编号': 'SC2026-0238-0101-02', '导体直流电阻限值 R₂₀,max(Ω/km)': '≤ 0.524', '试样长度 L(mm)': '1000', '正向电阻 Rfwd(μΩ)': '517.4', '反向电阻 Rrev(μΩ)': '518.6', '平均电阻 Ravg(μΩ)': '518.0', '温度(℃)': '20.1', '湿度(%RH)': '52', '气压(kPa)': '101.2', '设备试验前状态': '正常', '设备试验后状态': '正常', '20℃导体直流电阻 R₂₀(Ω/km)': '0.518' }] },
            { name: '绿', conclusion: '合格', rows: [{ '试样编号': 'SC2026-0238-0101-03', '导体直流电阻限值 R₂₀,max(Ω/km)': '≤ 0.524', '试样长度 L(mm)': '1000', '正向电阻 Rfwd(μΩ)': '521.0', '反向电阻 Rrev(μΩ)': '521.8', '平均电阻 Ravg(μΩ)': '521.4', '温度(℃)': '20.0', '湿度(%RH)': '52', '气压(kPa)': '101.2', '设备试验前状态': '正常', '设备试验后状态': '正常', '20℃导体直流电阻 R₂₀(Ω/km)': '0.521' }] },
          ],
        },
        {
          name: '绝缘厚度', std: 'GB/T 2951.11-2008', review: '已完成', result: '合格', method: '投影仪测量', tester: '李明', date: '2026-09-01',
          process: '沿绝缘圆周均布 6 点，投影仪读取厚度，取最小点判定。',
          requirement: '绝缘最薄点 ≥ 标称厚度的 90%，且平均值 ≥ 标称厚度。',
          recorder: '李明', recordedAt: '2026-09-01 16:02',
          device: '全自动绝缘厚度测试仪（无人化）', calib: '2026-01-01 ~ 2026-12-31',
          standards: STD_INS, sops: [{ no: 'SOP-DL-003', name: '绝缘厚度投影测量作业指导书', file: 'SOP-DL-003.docx' }],
          raws: [{ name: 'SC2026-0238-0101绝缘厚度原始记录.docx', at: '2026-09-01 16:02' }],
          equipment: {
            name: '全自动绝缘厚度测试仪（无人化）', no: 'YM-MYH-02', model: 'YWG-1F',
            collect: '无人化直连采集', calibStatus: '正常', lastCalib: '2026-01-10',
            calibFrom: '2026-01-01', calibTo: '2026-12-31', precision: '±0.01 mm',
          },
          groups: [
            { key: 'nom', title: '标称值', cols: ['标称绝缘厚度(mm)', '最小厚度标称值 90%(mm)', '偏心率标称值(%)'] },
            { key: 'mea', title: '测量值', cols: ['测点1(mm)', '测点2(mm)', '测点3(mm)', '测点4(mm)', '测点5(mm)', '测点6(mm)', '温度(℃)', '湿度(%RH)', '设备试验前状态', '设备试验后状态'] },
            { key: 'calc', title: '计算值', cols: ['绝缘最小厚度(mm)', '绝缘平均厚度(mm)', '偏心(mm)'] },
          ],
          phases: [
            { name: '红', conclusion: '合格', rows: [{ '试样编号': 'SC2026-0238-0101-25', '标称绝缘厚度(mm)': '≥ 4.5', '最小厚度标称值 90%(mm)': '≥ 3.95', '偏心率标称值(%)': '< 10', '测点1(mm)': '4.62', '测点2(mm)': '4.58', '测点3(mm)': '4.71', '测点4(mm)': '4.55', '测点5(mm)': '4.66', '测点6(mm)': '4.60', '温度(℃)': '23.0', '湿度(%RH)': '51', '设备试验前状态': '正常', '设备试验后状态': '正常', '绝缘最小厚度(mm)': '4.55', '绝缘平均厚度(mm)': '4.62', '偏心(mm)': '0.08' }] },
            { name: '黄', conclusion: '合格', rows: [{ '试样编号': 'SC2026-0238-0101-26', '标称绝缘厚度(mm)': '≥ 4.5', '最小厚度标称值 90%(mm)': '≥ 3.95', '偏心率标称值(%)': '< 10', '测点1(mm)': '4.70', '测点2(mm)': '4.64', '测点3(mm)': '4.68', '测点4(mm)': '4.59', '测点5(mm)': '4.73', '测点6(mm)': '4.61', '温度(℃)': '23.0', '湿度(%RH)': '51', '设备试验前状态': '正常', '设备试验后状态': '正常', '绝缘最小厚度(mm)': '4.59', '绝缘平均厚度(mm)': '4.66', '偏心(mm)': '0.07' }] },
            { name: '绿', conclusion: '合格', rows: [{ '试样编号': 'SC2026-0238-0101-27', '标称绝缘厚度(mm)': '≥ 4.5', '最小厚度标称值 90%(mm)': '≥ 3.95', '偏心率标称值(%)': '< 10', '测点1(mm)': '4.57', '测点2(mm)': '4.63', '测点3(mm)': '4.69', '测点4(mm)': '4.54', '测点5(mm)': '4.60', '测点6(mm)': '4.66', '温度(℃)': '23.1', '湿度(%RH)': '51', '设备试验前状态': '正常', '设备试验后状态': '正常', '绝缘最小厚度(mm)': '4.54', '绝缘平均厚度(mm)': '4.61', '偏心(mm)': '0.08' }] },
          ],
        },
        {
          name: '老化前绝缘机械性能', std: 'GB/T 2951.11-2008', review: '已复审', result: '合格', method: '拉力试验', tester: '周敏', date: '2026-09-01',
          process: '哑铃试样拉伸至断裂，记录抗张强度与断裂伸长率。',
          requirement: '抗张强度 ≥ 12.5 MPa，断裂伸长率 ≥ 200%。',
          recorder: '周敏', recordedAt: '2026-09-01 16:40',
          device: 'LD26504 力学试验机', calib: '2026-02-01 ~ 2027-01-31',
          standards: STD_INS, sops: [{ no: 'SOP-DL-021', name: '绝缘机械性能试验作业指导书', file: 'SOP-DL-021.docx' }],
          raws: [{ name: 'SC2026-0238-0101机械性能原始记录.docx', at: '2026-09-01 16:40' }],
          equipment: {
            name: '微机控制电子万能试验机', no: 'YM-LD-04', model: 'LD26504',
            collect: '设备直连采集', calibStatus: '正常', lastCalib: '2026-02-03',
            calibFrom: '2026-02-01', calibTo: '2027-01-31', precision: '±0.5%',
          },
          groups: [
            { key: 'nom', title: '标称值', cols: ['抗张强度最小值 σ_min(N/mm²)', '断裂伸长率最小值 ε_min(%)'] },
            { key: 'mea', title: '测量值', cols: ['码码', '试样原始标距 L₀(mm)', '试样最小宽度 W(mm)', '试样最小厚度 t(mm)', '试样截面积 A₀(mm²)', '断裂最大力 F(N)', '断裂时标距 L(mm)', '温度(℃)', '湿度(%RH)', '设备试验前状态', '设备试验后状态'] },
            { key: 'calc', title: '计算值', cols: ['抗张强度 σ(MPa)', '抗张强度中间值 σ_med(MPa)', '断裂伸长率 ε(%)', '断裂伸长率中间值 ε_med(%)'] },
          ],
          phases: [
            {
              name: '红', conclusion: '合格', rows: [
                { '试样编号': 'SC2026-0238-0101-28', '码码': '0264A1', '抗张强度最小值 σ_min(N/mm²)': '≥ 12.5', '断裂伸长率最小值 ε_min(%)': '≥ 200', '试样原始标距 L₀(mm)': '20', '试样最小宽度 W(mm)': '4', '试样最小厚度 t(mm)': '1', '试样截面积 A₀(mm²)': '4.00', '断裂最大力 F(N)': '99.399', '断裂时标距 L(mm)': '170.24', '温度(℃)': '23.0', '湿度(%RH)': '50', '设备试验前状态': '正常', '设备试验后状态': '正常', '抗张强度 σ(MPa)': '24.8', '抗张强度中间值 σ_med(MPa)': '21.5', '断裂伸长率 ε(%)': '851.2', '断裂伸长率中间值 ε_med(%)': '808.7' },
                { '试样编号': 'SC2026-0238-0101-29', '码码': '0264A2', '抗张强度最小值 σ_min(N/mm²)': '≥ 12.5', '断裂伸长率最小值 ε_min(%)': '≥ 200', '试样原始标距 L₀(mm)': '20', '试样最小宽度 W(mm)': '4', '试样最小厚度 t(mm)': '1', '试样截面积 A₀(mm²)': '4.00', '断裂最大力 F(N)': '85.835', '断裂时标距 L(mm)': '161.74', '温度(℃)': '23.0', '湿度(%RH)': '50', '设备试验前状态': '正常', '设备试验后状态': '正常', '抗张强度 σ(MPa)': '21.5', '抗张强度中间值 σ_med(MPa)': '21.5', '断裂伸长率 ε(%)': '808.7', '断裂伸长率中间值 ε_med(%)': '808.7' },
                { '试样编号': 'SC2026-0238-0101-30', '码码': '0264A3', '抗张强度最小值 σ_min(N/mm²)': '≥ 12.5', '断裂伸长率最小值 ε_min(%)': '≥ 200', '试样原始标距 L₀(mm)': '20', '试样最小宽度 W(mm)': '4', '试样最小厚度 t(mm)': '1', '试样截面积 A₀(mm²)': '4.00', '断裂最大力 F(N)': '83.640', '断裂时标距 L(mm)': '173.34', '温度(℃)': '23.0', '湿度(%RH)': '50', '设备试验前状态': '正常', '设备试验后状态': '正常', '抗张强度 σ(MPa)': '20.9', '抗张强度中间值 σ_med(MPa)': '21.5', '断裂伸长率 ε(%)': '866.7', '断裂伸长率中间值 ε_med(%)': '808.7' },
              ],
            },
            {
              name: '黄', conclusion: '合格', rows: [
                { '试样编号': 'SC2026-0238-0101-33', '码码': '/', '抗张强度最小值 σ_min(N/mm²)': '≥ 12.5', '断裂伸长率最小值 ε_min(%)': '≥ 200', '试样原始标距 L₀(mm)': '/', '试样最小宽度 W(mm)': '/', '试样最小厚度 t(mm)': '/', '试样截面积 A₀(mm²)': '/', '断裂最大力 F(N)': '/', '断裂时标距 L(mm)': '/', '温度(℃)': '/', '湿度(%RH)': '/', '设备试验前状态': '/', '设备试验后状态': '/', '抗张强度 σ(MPa)': '/', '抗张强度中间值 σ_med(MPa)': '/', '断裂伸长率 ε(%)': '/', '断裂伸长率中间值 ε_med(%)': '/' },
                { '试样编号': 'SC2026-0238-0101-34', '码码': '/', '抗张强度最小值 σ_min(N/mm²)': '≥ 12.5', '断裂伸长率最小值 ε_min(%)': '≥ 200', '试样原始标距 L₀(mm)': '/', '试样最小宽度 W(mm)': '/', '试样最小厚度 t(mm)': '/', '试样截面积 A₀(mm²)': '/', '断裂最大力 F(N)': '/', '断裂时标距 L(mm)': '/', '温度(℃)': '/', '湿度(%RH)': '/', '设备试验前状态': '/', '设备试验后状态': '/', '抗张强度 σ(MPa)': '/', '抗张强度中间值 σ_med(MPa)': '/', '断裂伸长率 ε(%)': '/', '断裂伸长率中间值 ε_med(%)': '/' },
                { '试样编号': 'SC2026-0238-0101-35', '码码': '/', '抗张强度最小值 σ_min(N/mm²)': '≥ 12.5', '断裂伸长率最小值 ε_min(%)': '≥ 200', '试样原始标距 L₀(mm)': '/', '试样最小宽度 W(mm)': '/', '试样最小厚度 t(mm)': '/', '试样截面积 A₀(mm²)': '/', '断裂最大力 F(N)': '/', '断裂时标距 L(mm)': '/', '温度(℃)': '/', '湿度(%RH)': '/', '设备试验前状态': '/', '设备试验后状态': '/', '抗张强度 σ(MPa)': '/', '抗张强度中间值 σ_med(MPa)': '/', '断裂伸长率 ε(%)': '/', '断裂伸长率中间值 ε_med(%)': '/' },
              ],
            },
            {
              name: '绿', conclusion: '合格', rows: [
                { '试样编号': 'SC2026-0238-0101-38', '码码': '/', '抗张强度最小值 σ_min(N/mm²)': '≥ 12.5', '断裂伸长率最小值 ε_min(%)': '≥ 200', '试样原始标距 L₀(mm)': '/', '试样最小宽度 W(mm)': '/', '试样最小厚度 t(mm)': '/', '试样截面积 A₀(mm²)': '/', '断裂最大力 F(N)': '/', '断裂时标距 L(mm)': '/', '温度(℃)': '/', '湿度(%RH)': '/', '设备试验前状态': '/', '设备试验后状态': '/', '抗张强度 σ(MPa)': '/', '抗张强度中间值 σ_med(MPa)': '/', '断裂伸长率 ε(%)': '/', '断裂伸长率中间值 ε_med(%)': '/' },
                { '试样编号': 'SC2026-0238-0101-39', '码码': '/', '抗张强度最小值 σ_min(N/mm²)': '≥ 12.5', '断裂伸长率最小值 ε_min(%)': '≥ 200', '试样原始标距 L₀(mm)': '/', '试样最小宽度 W(mm)': '/', '试样最小厚度 t(mm)': '/', '试样截面积 A₀(mm²)': '/', '断裂最大力 F(N)': '/', '断裂时标距 L(mm)': '/', '温度(℃)': '/', '湿度(%RH)': '/', '设备试验前状态': '/', '设备试验后状态': '/', '抗张强度 σ(MPa)': '/', '抗张强度中间值 σ_med(MPa)': '/', '断裂伸长率 ε(%)': '/', '断裂伸长率中间值 ε_med(%)': '/' },
                { '试样编号': 'SC2026-0238-0101-40', '码码': '/', '抗张强度最小值 σ_min(N/mm²)': '≥ 12.5', '断裂伸长率最小值 ε_min(%)': '≥ 200', '试样原始标距 L₀(mm)': '/', '试样最小宽度 W(mm)': '/', '试样最小厚度 t(mm)': '/', '试样截面积 A₀(mm²)': '/', '断裂最大力 F(N)': '/', '断裂时标距 L(mm)': '/', '温度(℃)': '/', '湿度(%RH)': '/', '设备试验前状态': '/', '设备试验后状态': '/', '抗张强度 σ(MPa)': '/', '抗张强度中间值 σ_med(MPa)': '/', '断裂伸长率 ε(%)': '/', '断裂伸长率中间值 ε_med(%)': '/' },
              ],
            },
          ],
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
          labels: {
            'L1-a-1': { label: '正常', note: '', submitted: true },
            'L1-b-1': { label: '正常', note: '', submitted: true },
            'L1-d-1': { label: '正常', note: '', submitted: true },
            'L2-a-1': { label: '正常', note: '', submitted: true },
            'L2-b-1': { label: '正常', note: '', submitted: true },
            'L2-c-1': { label: '正常', note: '', submitted: true },
            'L3-a-1': { label: '正常', note: '', submitted: true },
            'L3-a-2': { label: '正常', note: '', submitted: true },
            'PG-CABLE-01': { label: '正常', note: '', submitted: true },
          },
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
          labels: {
            'L3-a-2': { label: '正常', note: '引用标准年号仍待编制核，暂标正常。', submitted: true },
            'L1-d-1': { label: '误报', note: '单位已改为 Ω，上一轮误报已关闭。', submitted: true },
          },
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
          labels: {
            'L1-a-1': { label: '正常', note: '', submitted: true },
            'L3-a-2': { label: '正常', note: '', submitted: true },
            'PG-CABLE-01': { label: '正常', note: '', submitted: true },
          },
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
        // 05：AI 正在审核 → 超时后落入异常暂停（原 05/06 合并到同一份报告）
        {
          id: 'rr-0238-05', reportNo: 'SC2026/0238-05', reportName: 'SC2026-0238-05检测报告.docx',
          sampleNos: ['SC2026/0238-0105'], categoryBound: true, state: 'AI审核中',
          aiRun: 'running',
          snapshotHash: 'n5p6q7', file: { word: 'SC2026-0238-05检测报告.docx', pdf: 'SC2026-0238-05检测报告.pdf', at: '2026-09-06 09:10' },
          info: cableInfo(),
          rounds: [{ revision: 'V1.0', trigger: '进入报告审核', at: '2026-09-06 09:12', snapshot: cableSnap({ sample_no: 'SC2026-0242' }) }],
          disposition: null,
          log: [
            { at: '2026-09-06 08:40', node: '报告生成', by: '系统', text: '生成报告 SC2026/0238-05', tone: 'default' },
            { at: '2026-09-06 09:10', node: '报告编制', by: 'admin', text: '提交至报告审核', tone: 'default' },
            { at: '2026-09-06 09:12', node: 'AI审核', by: '系统', text: '正在逐条执行审核规则…', tone: 'pending' },
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
    {
      code: 'SC2026/0242', contract: '/', customer: '贵州送变电有限公司', sample: '绝缘手套 10kV',
      sendDate: '2026-09-04', requireDate: '2026-09-09', acceptDate: '2026-09-04',
      priority: '常规', status: '报告审核', compiler: 'admin',
      contractInfo: { frame: '否', contractNo: '/', signPlace: '贵阳', signDate: '2026-09-03', center: '应敏科技有限公司' },
      payInfo: { total: 960, actual: 960, discount: 0, way: '对公转账', payer: '贵州送变电有限公司', note: '/' },
      reportInfo: { send: '邮寄', qualify: 'CNAS CMA', desc: '按试样各出一份', resultMode: '判定', lang: '中文', copies: 2 },
      reports: [{
        id: 'rr-0242-01', reportNo: 'SC2026/0242-01', reportName: 'SC2026-0242-01检测报告.docx',
        sampleNos: ['SC2026/0242-0101'], categoryBound: false, state: '待处置',
        snapshotHash: 't0242a', file: { word: 'SC2026-0242-01检测报告.docx', pdf: 'SC2026-0242-01检测报告.pdf', at: '2026-09-05 10:20' },
        info: cableInfo({ packVersion: '未配置行业包' }),
        rounds: [{
          revision: 'V1.0', trigger: '进入报告审核', at: '2026-09-05 10:28',
          snapshot: cableSnap({ sample_no: 'SC2026-0242', category_code: 'CAT-GLOVE', category_name: '绝缘手套' }),
        }],
        disposition: null,
        log: [
          { at: '2026-09-05 09:50', node: '报告生成', by: '系统', text: '生成报告 SC2026/0242-01', tone: 'default' },
          { at: '2026-09-05 10:28', node: 'AI审核', by: '系统', text: '预审结论：通过（V1.0）', tone: 'success' },
        ],
      }],
    },
    {
      code: 'SC2026/0243', contract: '/', customer: '遵义供电局', sample: '全身式安全带',
      sendDate: '2026-09-05', requireDate: '2026-09-10', acceptDate: '2026-09-05',
      priority: '加急', status: '报告审核', compiler: 'admin',
      contractInfo: { frame: '否', contractNo: '/', signPlace: '遵义', signDate: '2026-09-04', center: '应敏科技有限公司' },
      payInfo: { total: 1280, actual: 1280, discount: 0, way: '对公转账', payer: '遵义供电局', note: '/' },
      reportInfo: { send: '自取', qualify: 'CMA', desc: '按试样各出一份', resultMode: '判定', lang: '中文', copies: 1 },
      reports: [{
        id: 'rr-0243-01', reportNo: 'SC2026/0243-01', reportName: 'SC2026-0243-01检测报告.docx',
        sampleNos: ['SC2026/0243-0101'], categoryBound: false, state: '待处置',
        snapshotHash: 't0243a', file: { word: 'SC2026-0243-01检测报告.docx', pdf: 'SC2026-0243-01检测报告.pdf', at: '2026-09-06 11:05' },
        info: cableInfo({ packVersion: '未配置行业包' }),
        rounds: [{
          revision: 'V1.0', trigger: '进入报告审核', at: '2026-09-06 11:12',
          snapshot: cableSnap({
            sample_no: 'SC2026-0243', category_code: 'CAT-BELT', category_name: '安全带',
            cited_standard: 'GB/T 6095-2021',
          }),
        }],
        disposition: null,
        log: [
          { at: '2026-09-06 10:40', node: '报告生成', by: '系统', text: '生成报告 SC2026/0243-01', tone: 'default' },
          { at: '2026-09-06 11:12', node: 'AI审核', by: '系统', text: '预审结论：需复核（V1.0，引用标准需核）', tone: 'warn' },
        ],
      }],
    },
    {
      code: 'SC2026/0244', contract: '/', customer: '安顺供电局', sample: '高强度螺栓连接副',
      sendDate: '2026-09-06', requireDate: '2026-09-11', acceptDate: '2026-09-06',
      priority: '常规', status: '报告审核', compiler: 'admin',
      contractInfo: { frame: '否', contractNo: '/', signPlace: '安顺', signDate: '2026-09-05', center: '应敏科技有限公司' },
      payInfo: { total: 2100, actual: 2100, discount: 0, way: '对公转账', payer: '安顺供电局', note: '/' },
      reportInfo: { send: '邮寄', qualify: 'CNAS CMA', desc: '按试样各出一份', resultMode: '判定', lang: '中文', copies: 2 },
      reports: [{
        id: 'rr-0244-01', reportNo: 'SC2026/0244-01', reportName: 'SC2026-0244-01检测报告.docx',
        sampleNos: ['SC2026/0244-0101'], categoryBound: false, state: '待处置',
        snapshotHash: 't0244a', file: { word: 'SC2026-0244-01检测报告.docx', pdf: 'SC2026-0244-01检测报告.pdf', at: '2026-09-07 08:50' },
        info: cableInfo({ packVersion: '未配置行业包' }),
        rounds: [{
          revision: 'V1.0', trigger: '进入报告审核', at: '2026-09-07 09:02',
          snapshot: cableSnap({
            sample_no: 'SC2026-0244', category_code: 'CAT-BOLT', category_name: '高强度螺栓连接副',
            units: [{ param: '扭矩系数', unit: 'N·m' }],
          }),
        }],
        disposition: null,
        log: [
          { at: '2026-09-07 08:20', node: '报告生成', by: '系统', text: '生成报告 SC2026/0244-01', tone: 'default' },
          { at: '2026-09-07 09:02', node: 'AI审核', by: '系统', text: '预审结论：需复核（V1.0，计量单位需核）', tone: 'warn' },
        ],
      }],
    },
  ];

  function getEntrust(code) {
    for (var i = 0; i < ENTRUSTS.length; i++) if (ENTRUSTS[i].code === code) return ENTRUSTS[i];
    return null;
  }

  // 本节点仍需出现在「待审核」组：未离开报告审核（含审核中/异常、签发退回）。
  // 自动退回开启时，已退回编制的报告归入「已离开本节点」。
  function needsHuman(rep) {
    if (!rep) return false;
    if (rep.disposition) return false;
    if (rep.state === '自动退回编制' && POLICY.autoReturnOnSevere) return false;
    return true;
  }

  function failRunningReport(rep, at) {
    if (!rep || rep.aiRun !== 'running') return false;
    rep.aiRun = 'error';
    rep.state = 'AI审核异常';
    rep.aiError = { code: 'ENGINE_TIMEOUT', message: '规则引擎在 L2 数据逻辑阶段超时，任务已暂停。可重试 AI，或转人工审核。' };
    (rep.log || (rep.log = [])).push({
      at: at || '2026-09-06 09:16', node: 'AI审核', by: '系统',
      text: '审核异常暂停：ENGINE_TIMEOUT（L2 数据逻辑超时）', tone: 'danger',
    });
    return true;
  }

  // 面板业务日：让默认「近 7 天」能罩住 0238 演示簇
  var PANEL_TODAY = '2026-09-08';

  // 归档留档（含「退回编制后删除、重新出报告」的旧版 AI 结果）
  var ARCHIVES = [
    {
      id: 'arch-0238-02-v1', reportNo: 'SC2026/0238-02', revision: 'V1.0',
      deleted: true, deletedAt: '2026-09-03 16:10',
      deletedReason: '退回报告编制后删除本份报告，重新生成 V1.1 再提交审核。',
      entrust: 'SC2026/0238', customer: '杭州数蚕智能科技有限公司', sample: '10kV3芯电力电缆',
      pack: '电力电缆', majorCat: '电力物资类', bizNode: '已删除', aiTask: '成功', conclusion: '需复核',
      human: '已退回编制', agreeAi: true, caseSettled: true,
      at: '2026-09-03 11:00', archivedAt: '2026-09-03 16:10', signedAt: '',
      durationSec: 18, round: 1,
      snapshot: cableSnap({
        sample_no: 'SC2026-0239',
        cited_standard: 'GB/T 12706.1-2008',
        units: [{ param: '导体直流电阻', unit: 'kgf·m' }],
        conductor_resistance: 0.531, conductor_resistance_limit: 0.524,
      }),
      hits: '一般 3 项（引用标准年号 / 计量单位 / 电阻限值）',
      trigger: '进入报告审核', snapshotHash: 'd4e5f6-v1', compiler: 'admin',
      sampleNos: ['SC2026/0238-0102'],
      file: { word: 'SC2026-0238-02检测报告.docx', pdf: 'SC2026-0238-02检测报告.pdf', at: '2026-09-03 10:50' },
      labels: {
        'L3-a-2': { label: '正常', note: '', submitted: true },
        'L1-d-1': { label: '误报', note: '单位写 kgf·m 为录入笔误，实测单位为 Ω。', submitted: true },
        'PG-CABLE-01': { label: '正常', note: '', submitted: true },
      },
      log: [
        { at: '2026-09-02 17:30', node: '报告生成', by: '系统', text: '生成报告 SC2026/0238-02', tone: 'default' },
        { at: '2026-09-03 10:40', node: '报告编制', by: 'admin', text: '提交至报告审核', tone: 'default' },
        { at: '2026-09-03 11:00', node: 'AI审核', by: '系统', text: '预审结论：需复核（V1.0，命中 3 项一般）', tone: 'warn' },
        { at: '2026-09-03 15:30', node: '报告审核', by: '李审核', text: '退回报告编制。原因：引用标准/单位/电阻限值需核', tone: 'danger' },
        { at: '2026-09-03 16:10', node: '报告编制', by: 'admin', text: '删除本份报告，准备重新生成', tone: 'danger' },
      ],
    },
    {
      id: 'arch-0190-01', reportNo: 'SC2026/0190-01', revision: 'V1.0',
      deleted: false,
      entrust: 'SC2026/0190', customer: '远东电缆股份有限公司', sample: '8.7/10kV 电力电缆',
      pack: '电力电缆', majorCat: '电力物资类', bizNode: '已签发', aiTask: '成功', conclusion: '通过',
      human: '已同意', agreeAi: true, caseSettled: true,
      at: '2026-09-02 14:20', archivedAt: '2026-09-02 16:40', signedAt: '2026-09-02 16:40',
      durationSec: 12, round: 1,
      snapshot: cableSnap({ sample_no: 'SC2026-0190' }),
      hits: '未命中',
      trigger: '进入报告审核', snapshotHash: 's0190a', compiler: 'admin',
      sampleNos: ['SC2026/0190-0101'],
      file: { word: 'SC2026-0190-01检测报告.docx', pdf: 'SC2026-0190-01检测报告.pdf', at: '2026-09-02 14:10' },
      labels: {},
      log: [
        { at: '2026-09-02 13:40', node: '报告生成', by: '系统', text: '生成报告 SC2026/0190-01', tone: 'default' },
        { at: '2026-09-02 14:20', node: 'AI审核', by: '系统', text: '预审结论：通过（V1.0）', tone: 'success' },
        { at: '2026-09-02 15:10', node: '报告审核', by: '李审核', text: '同意 AI，提交签发', tone: 'success' },
        { at: '2026-09-02 16:40', node: '报告签发', by: '周签发', text: '已签发', tone: 'success' },
      ],
    },
    {
      id: 'arch-0188-01', reportNo: 'SC2026/0188-01', revision: 'V1.2',
      deleted: false,
      entrust: 'SC2026/0188', customer: '智载科技', sample: '复合绝缘盖板',
      pack: '复合绝缘盖板', majorCat: '电力物资类', bizNode: '已发放', aiTask: '成功', conclusion: '需复核',
      human: '已覆盖', agreeAi: false, caseSettled: true,
      at: '2026-09-01 09:40', archivedAt: '2026-09-04 11:00', signedAt: '2026-09-03 18:20',
      durationSec: 26, round: 2,
      snapshot: cableSnap({ sample_no: 'SC2026-0188', category_code: null, category_name: '' }),
      hits: '一般 1 项（未配置品类仅跑通用集）',
      trigger: '编制修改后重审', snapshotHash: 's0188c', compiler: 'admin',
      sampleNos: ['SC2026/0188-0101'],
      file: { word: 'SC2026-0188-01检测报告.docx', pdf: 'SC2026-0188-01检测报告.pdf', at: '2026-09-01 09:20' },
      labels: { 'L3-a-2': { label: '漏报', note: '未配置品类，通用集未覆盖盖板专属限值。', submitted: true } },
      log: [
        { at: '2026-09-01 09:00', node: '报告生成', by: '系统', text: '生成报告 SC2026/0188-01', tone: 'default' },
        { at: '2026-09-01 09:40', node: 'AI审核', by: '系统', text: '预审结论：需复核（未配置品类）', tone: 'warn' },
        { at: '2026-09-03 18:00', node: '报告审核', by: '李审核', text: '覆盖 AI，人工通过', tone: 'success' },
        { at: '2026-09-03 18:20', node: '报告签发', by: '周签发', text: '已签发', tone: 'success' },
        { at: '2026-09-04 11:00', node: '报告发放', by: '系统', text: '报告已发放给委托方', tone: 'success' },
      ],
    },
    {
      id: 'arch-0175-01', reportNo: 'SC2026/0175-01', revision: 'V1.0',
      deleted: false,
      entrust: 'SC2026/0175', customer: '贵州送变电有限公司', sample: '绝缘手套 10kV',
      pack: '绝缘手套', majorCat: '安全工器具类', bizNode: '已签发', aiTask: '成功', conclusion: '通过',
      human: '已同意', agreeAi: true, caseSettled: true,
      at: '2026-09-03 13:10', archivedAt: '2026-09-04 09:40', signedAt: '2026-09-04 09:40',
      durationSec: 11, round: 1,
      snapshot: cableSnap({ sample_no: 'SC2026-0175', category_code: 'CAT-GLOVE', category_name: '绝缘手套' }),
      hits: '未命中', trigger: '进入报告审核', snapshotHash: 's0175a', compiler: 'admin',
      sampleNos: ['SC2026/0175-0101'],
      file: { word: 'SC2026-0175-01检测报告.docx', pdf: 'SC2026-0175-01检测报告.pdf', at: '2026-09-03 13:00' },
      labels: {},
      log: [
        { at: '2026-09-03 12:40', node: '报告生成', by: '系统', text: '生成报告 SC2026/0175-01', tone: 'default' },
        { at: '2026-09-03 13:10', node: 'AI审核', by: '系统', text: '预审结论：通过（V1.0）', tone: 'success' },
        { at: '2026-09-04 09:40', node: '报告签发', by: '周签发', text: '已签发', tone: 'success' },
      ],
    },
    {
      id: 'arch-0166-01', reportNo: 'SC2026/0166-01', revision: 'V1.0',
      deleted: false,
      entrust: 'SC2026/0166', customer: '遵义供电局', sample: '全身式安全带',
      pack: '安全带', majorCat: '安全工器具类', bizNode: '已发放', aiTask: '成功', conclusion: '通过',
      human: '已同意', agreeAi: true, caseSettled: true,
      at: '2026-09-01 15:20', archivedAt: '2026-09-05 10:00', signedAt: '2026-09-04 17:10',
      durationSec: 9, round: 1,
      snapshot: cableSnap({ sample_no: 'SC2026-0166', category_code: 'CAT-BELT', category_name: '安全带' }),
      hits: '未命中', trigger: '进入报告审核', snapshotHash: 's0166a', compiler: 'admin',
      sampleNos: ['SC2026/0166-0101'],
      file: { word: 'SC2026-0166-01检测报告.docx', pdf: 'SC2026-0166-01检测报告.pdf', at: '2026-09-01 15:10' },
      labels: {},
      log: [
        { at: '2026-09-01 14:50', node: '报告生成', by: '系统', text: '生成报告 SC2026/0166-01', tone: 'default' },
        { at: '2026-09-01 15:20', node: 'AI审核', by: '系统', text: '预审结论：通过（V1.0）', tone: 'success' },
        { at: '2026-09-04 17:10', node: '报告签发', by: '周签发', text: '已签发', tone: 'success' },
        { at: '2026-09-05 10:00', node: '报告发放', by: '系统', text: '报告已发放给委托方', tone: 'success' },
      ],
    },
    {
      id: 'arch-0150-01', reportNo: 'SC2026/0150-01', revision: 'V1.1',
      deleted: false,
      entrust: 'SC2026/0150', customer: '安顺供电局', sample: '高强度螺栓连接副',
      pack: '高强度螺栓连接副', majorCat: '电力物资类', bizNode: '已签发', aiTask: '成功', conclusion: '需复核',
      human: '已覆盖', agreeAi: false, caseSettled: true,
      at: '2026-08-28 11:00', archivedAt: '2026-09-03 16:20', signedAt: '2026-09-03 16:20',
      durationSec: 22, round: 2,
      snapshot: cableSnap({ sample_no: 'SC2026-0150', category_code: 'CAT-BOLT', category_name: '高强度螺栓连接副' }),
      hits: '一般 1 项（计量单位）', trigger: '编制修改后重审', snapshotHash: 's0150b', compiler: 'admin',
      sampleNos: ['SC2026/0150-0101'],
      file: { word: 'SC2026-0150-01检测报告.docx', pdf: 'SC2026-0150-01检测报告.pdf', at: '2026-08-28 10:50' },
      labels: { 'L1-d-1': { label: '误报', note: '扭矩单位写法与字典别名一致。', submitted: true } },
      log: [
        { at: '2026-08-28 10:30', node: '报告生成', by: '系统', text: '生成报告 SC2026/0150-01', tone: 'default' },
        { at: '2026-08-28 11:00', node: 'AI审核', by: '系统', text: '预审结论：需复核', tone: 'warn' },
        { at: '2026-09-03 16:00', node: '报告审核', by: '李审核', text: '覆盖 AI，人工通过', tone: 'success' },
        { at: '2026-09-03 16:20', node: '报告签发', by: '周签发', text: '已签发', tone: 'success' },
      ],
    },
    {
      id: 'arch-0142-01', reportNo: 'SC2026/0142-01', revision: 'V1.0',
      deleted: true, deletedAt: '2026-09-06 14:30',
      deletedReason: '委托方撤回本份样品，删除已生成报告。',
      entrust: 'SC2026/0142', customer: '远东电缆股份有限公司', sample: 'MPP 电缆保护管',
      pack: '电缆保护管', majorCat: '电力物资类', bizNode: '已删除', aiTask: '成功', conclusion: '需复核',
      human: '已退回编制', agreeAi: true, caseSettled: true,
      at: '2026-09-05 09:30', archivedAt: '2026-09-06 14:30', signedAt: '',
      durationSec: 15, round: 1,
      snapshot: cableSnap({ sample_no: 'SC2026-0142', category_code: 'CAT-PIPE', category_name: '电缆保护管' }),
      hits: '一般 1 项（未配置品类专属限值）', trigger: '进入报告审核', snapshotHash: 's0142a', compiler: 'admin',
      sampleNos: ['SC2026/0142-0101'],
      file: { word: 'SC2026-0142-01检测报告.docx', pdf: 'SC2026-0142-01检测报告.pdf', at: '2026-09-05 09:20' },
      labels: {},
      log: [
        { at: '2026-09-05 09:00', node: '报告生成', by: '系统', text: '生成报告 SC2026/0142-01', tone: 'default' },
        { at: '2026-09-05 09:30', node: 'AI审核', by: '系统', text: '预审结论：需复核', tone: 'warn' },
        { at: '2026-09-06 14:30', node: '报告编制', by: 'admin', text: '委托方撤回，删除本份报告', tone: 'danger' },
      ],
    },
    {
      id: 'arch-0128-01', reportNo: 'SC2026/0128-01', revision: 'V1.0',
      deleted: false,
      entrust: 'SC2026/0128', customer: '杭州数蚕智能科技有限公司', sample: '厂界噪声',
      pack: '厂界噪声', majorCat: '环境检测', bizNode: '已签发', aiTask: '成功', conclusion: '通过',
      human: '已同意', agreeAi: true, caseSettled: true,
      at: '2026-08-16 10:20', archivedAt: '2026-08-18 15:00', signedAt: '2026-08-18 15:00',
      durationSec: 10, round: 1,
      snapshot: cableSnap({ sample_no: 'SC2026-0128', category_code: null, category_name: '' }),
      hits: '未命中', trigger: '进入报告审核', snapshotHash: 's0128a', compiler: 'admin',
      sampleNos: ['SC2026/0128-0101'],
      file: { word: 'SC2026-0128-01检测报告.docx', pdf: 'SC2026-0128-01检测报告.pdf', at: '2026-08-16 10:10' },
      labels: {},
      log: [
        { at: '2026-08-16 10:00', node: '报告生成', by: '系统', text: '生成报告 SC2026/0128-01', tone: 'default' },
        { at: '2026-08-16 10:20', node: 'AI审核', by: '系统', text: '预审结论：通过（V1.0）', tone: 'success' },
        { at: '2026-08-18 15:00', node: '报告签发', by: '周签发', text: '已签发', tone: 'success' },
      ],
    },
    {
      id: 'arch-0136-01', reportNo: 'SC2026/0136-01', revision: 'V1.0',
      deleted: false,
      entrust: 'SC2026/0136', customer: '安顺供电局', sample: '混凝土抗压试块',
      pack: '混凝土试块', majorCat: '工程检测', bizNode: '已发放', aiTask: '成功', conclusion: '通过',
      human: '已同意', agreeAi: true, caseSettled: true,
      at: '2026-09-06 11:10', archivedAt: '2026-09-07 11:20', signedAt: '2026-09-07 09:40',
      durationSec: 14, round: 1,
      snapshot: cableSnap({ sample_no: 'SC2026-0136', category_code: null, category_name: '' }),
      hits: '未命中', trigger: '进入报告审核', snapshotHash: 's0136a', compiler: 'admin',
      sampleNos: ['SC2026/0136-0101'],
      file: { word: 'SC2026-0136-01检测报告.docx', pdf: 'SC2026-0136-01检测报告.pdf', at: '2026-09-06 11:00' },
      labels: {},
      log: [
        { at: '2026-09-06 10:40', node: '报告生成', by: '系统', text: '生成报告 SC2026/0136-01', tone: 'default' },
        { at: '2026-09-06 11:10', node: 'AI审核', by: '系统', text: '预审结论：通过（V1.0）', tone: 'success' },
        { at: '2026-09-07 09:40', node: '报告签发', by: '周签发', text: '已签发', tone: 'success' },
        { at: '2026-09-07 11:20', node: '报告发放', by: '系统', text: '报告已发放给委托方', tone: 'success' },
      ],
    },
  ];

  // 排队序列：尚未领取 / 正在执行的 AI 任务（与过程中已出结论的报告分开）
  var QUEUE = [
    {
      id: 'q-0240-01', reportNo: 'SC2026/0240-01', revision: 'V1.0', deleted: false,
      entrust: 'SC2026/0240', customer: '远东电缆股份有限公司', sample: '8.7/10kV 电力电缆',
      pack: '电力电缆', bizNode: '报告审核', aiTask: '排队', conclusion: '审核中',
      human: '待处置', agreeAi: null, caseSettled: false,
      at: '2026-09-08 09:40', archivedAt: '', signedAt: '',
      durationSec: 0, round: 1, live: false, queuePos: 1, waitSec: 25, etaSec: 40,
      trigger: '进入报告审核', snapshotHash: 'q0240a', compiler: 'admin',
      sampleNos: ['SC2026/0240-0101'],
      file: { word: 'SC2026-0240-01检测报告.docx', pdf: 'SC2026-0240-01检测报告.pdf', at: '2026-09-08 09:38' },
      snapshot: cableSnap({ sample_no: 'SC2026-0240' }),
      hits: '排队中，尚未出结论',
      log: [
        { at: '2026-09-08 09:20', node: '报告生成', by: '系统', text: '生成报告 SC2026/0240-01', tone: 'default' },
        { at: '2026-09-08 09:38', node: '报告编制', by: 'admin', text: '提交至报告审核', tone: 'default' },
        { at: '2026-09-08 09:40', node: 'AI审核', by: '系统', text: '已进入排队序列，前方 1 份任务', tone: 'pending' },
      ],
    },
    {
      id: 'q-0241-01', reportNo: 'SC2026/0241-01', revision: 'V1.0', deleted: false,
      entrust: 'SC2026/0241', customer: '杭州数蚕智能科技有限公司', sample: '10kV3芯电力电缆',
      pack: '电力电缆', bizNode: '报告审核', aiTask: '排队', conclusion: '审核中',
      human: '待处置', agreeAi: null, caseSettled: false,
      at: '2026-09-08 09:48', archivedAt: '', signedAt: '',
      durationSec: 0, round: 1, live: false, queuePos: 2, waitSec: 8, etaSec: 95,
      trigger: '进入报告审核', snapshotHash: 'q0241a', compiler: 'admin',
      sampleNos: ['SC2026/0241-0101'],
      file: { word: 'SC2026-0241-01检测报告.docx', pdf: 'SC2026-0241-01检测报告.pdf', at: '2026-09-08 09:47' },
      snapshot: cableSnap({ sample_no: 'SC2026-0241' }),
      hits: '排队中，尚未出结论',
      log: [
        { at: '2026-09-08 09:30', node: '报告生成', by: '系统', text: '生成报告 SC2026/0241-01', tone: 'default' },
        { at: '2026-09-08 09:47', node: '报告编制', by: 'admin', text: '提交至报告审核', tone: 'default' },
        { at: '2026-09-08 09:48', node: 'AI审核', by: '系统', text: '已进入排队序列，前方 2 份任务', tone: 'pending' },
      ],
    },
  ];

  function bizBucket(rep) {
    if (rep.disposition) return '签发中';
    if (rep.state === '自动退回编制' && POLICY.autoReturnOnSevere) return '已退回编制';
    if (rep.signOff && rep.signOff.returned) return '报告审核';
    if (rep.aiRun === 'running') return '报告审核';
    if (rep.aiRun === 'error') return '报告审核';
    return '报告审核';
  }
  function taskState(rep) {
    if (rep.aiRun === 'running') return '审核中';
    if (rep.aiRun === 'error') return '异常暂停';
    return '成功';
  }
  function humanState(rep, conclusion) {
    if (rep.disposition) return rep.disposition.agreeAi === false ? '已覆盖' : '已同意';
    if (rep.state === '自动退回编制' && POLICY.autoReturnOnSevere) return '自动退回编制';
    if (rep.aiRun) return '待处置';
    return '待处置';
  }

  function livePanelRows() {
    var rows = [];
    ENTRUSTS.forEach(function (ent) {
      ent.reports.forEach(function (rep) {
        var r = (rep.aiRun === 'running') ? { conclusion: '审核中' } : (rep.aiRun === 'error' ? { conclusion: '异常' } : evalReport(rep));
        var cur = currentRound(rep);
        var running = rep.aiRun === 'running';
        rows.push({
          id: rep.id, reportNo: rep.reportNo, revision: cur.revision, deleted: false,
          entrust: ent.code, customer: ent.customer, sample: ent.sample,
          pack: (cur.snapshot && cur.snapshot.category_name) || (rep.categoryBound ? '电力电缆' : '未配置行业包'),
          bizNode: bizBucket(rep), aiTask: taskState(rep), conclusion: r.conclusion,
          human: humanState(rep, r.conclusion), agreeAi: rep.disposition ? !!rep.disposition.agreeAi : null,
          caseSettled: !!rep.disposition, at: cur.at, archivedAt: '', signedAt: '',
          durationSec: running ? 48 : 14, round: rep.rounds.length, live: true, report: rep, entrustObj: ent,
          hits: r.failed && r.failed.length ? (r.severe.length ? '严重 ' + r.severe.length + ' 项' : '一般 ' + r.review.length + ' 项') : (running ? '正在执行规则' : '未命中'),
          snapshot: cur.snapshot, trigger: cur.trigger, snapshotHash: rep.snapshotHash,
          file: rep.file, compiler: ent.compiler, sampleNos: rep.sampleNos, log: rep.log || [],
          labels: rep.labels || {},
          info: rep.info || null,
          disposition: rep.disposition || null,
          lastDisposition: rep.lastDisposition || null,
          queuePos: running ? 0 : null, waitSec: running ? 48 : 0, etaSec: running ? 12 : 0,
        });
      });
    });
    return rows;
  }

  function inWindow(isoDate, range) {
    var day = String(isoDate || '').slice(0, 10);
    if (!day) return false;
    if (range === '全部') return true;
    var t = new Date(PANEL_TODAY + 'T00:00:00');
    var d = new Date(day + 'T00:00:00');
    if (range === '本月') return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth();
    var days = range === '30天' ? 30 : 7;
    var from = new Date(t.getTime() - (days - 1) * 86400000);
    return d >= from && d <= t;
  }

  function ymd(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function md(d) {
    var m = d.getMonth() + 1, day = d.getDate();
    return (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function tagKind(row, kind) {
    row.kind = kind;
    return row;
  }
  var EXCEPTIONS = [
    {
      id: 'ex-0239-01', reportNo: 'SC2026/0239-01', revision: 'V1.0', deleted: false,
      entrust: 'SC2026/0238', customer: '杭州数蚕智能科技有限公司', sample: '10kV3芯电力电缆',
      pack: '电力电缆', bizNode: '报告审核', aiTask: '异常暂停', conclusion: '异常',
      human: '待处置', agreeAi: null, caseSettled: false,
      at: '2026-09-07 16:22', live: true, kind: 'exception',
      error: { code: 'ENGINE_TIMEOUT', message: '规则引擎在 L2 数据逻辑阶段超时，任务已暂停。' },
    },
    {
      id: 'ex-0237-01', reportNo: 'SC2026/0237-01', revision: 'V1.0', deleted: false,
      entrust: 'SC2026/0238', customer: '远东电缆股份有限公司', sample: '8.7/10kV 电力电缆',
      pack: '电力电缆', bizNode: '报告审核', aiTask: '异常暂停', conclusion: '异常',
      human: '待处置', agreeAi: null, caseSettled: false,
      at: '2026-09-06 11:08', live: true, kind: 'exception',
      error: { code: 'RULE_PACK_LOAD', message: '行业包规则加载失败，任务已暂停。' },
    },
    {
      id: 'ex-0235-01', reportNo: 'SC2026/0235-01', revision: 'V1.0', deleted: false,
      entrust: 'SC2026/0238', customer: '杭州数蚕智能科技有限公司', sample: '10kV3芯电力电缆',
      pack: '电力电缆', bizNode: '报告审核', aiTask: '异常暂停', conclusion: '异常',
      human: '待处置', agreeAi: null, caseSettled: false,
      at: '2026-09-08 08:16', live: true, kind: 'exception',
      error: { code: 'SNAPSHOT_HASH', message: '报告快照哈希校验失败，任务已暂停。' },
    },
  ];

  function buildVolumeSeed() {
    var out = [];
    for (var y = 2020; y <= 2026; y++) {
      var lastM = y === 2026 ? 9 : 12;
      for (var m = 1; m <= lastM; m++) {
        var season = [0, -8, -18, 6, 14, 28, 42, 58, 72, 88, 40, -6][m - 1];
        var n = 36 + (y - 2020) * 22 + m * 9 + season + ((y * 3 + m * 5) % 11);
        var maturity = Math.min(0.93, 0.05 + (y - 2020) * 0.12 + m * 0.018);
        if (y <= 2022) maturity = Math.min(0.16, 0.02 + (y - 2020) * 0.05);
        var done = Math.round(n * maturity);
        var day = 8 + ((m * 3) % 17);
        out.push({
          at: y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day,
          n: n,
          done: done,
        });
      }
    }
    return out;
  }
  var VOLUME_SEED = buildVolumeSeed();
  var VOLUME_YEARS = { min: 2020, max: 2029 };

  function grainKey(iso, grain) {
    var d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    if (grain === '年') return String(y);
    if (grain === '季') return y + '-Q' + (Math.floor((m - 1) / 3) + 1);
    return y + '-' + (m < 10 ? '0' : '') + m;
  }
  function volumeLabel(key, grain) {
    if (grain === '年') return key + '年';
    if (grain === '季') {
      var q = key.split('-Q')[1];
      return 'Q' + q;
    }
    var m = Number(String(key).slice(5, 7));
    return m + '月';
  }
  function emptyBuckets(grain, yearFrom, yearTo, year) {
    var keys = [];
    var today = new Date(PANEL_TODAY + 'T00:00:00');
    var ty = today.getFullYear();
    var tm = today.getMonth() + 1;
    if (grain === '年') {
      var a = Math.min(yearFrom, yearTo), b = Math.max(yearFrom, yearTo);
      for (var y = a; y <= b; y++) keys.push(String(y));
    } else if (grain === '季') {
      var lastQ = year < ty ? 4 : (year > ty ? 0 : Math.ceil(tm / 3));
      for (var q = 1; q <= lastQ; q++) keys.push(year + '-Q' + q);
    } else {
      var lastM = year < ty ? 12 : (year > ty ? 0 : tm);
      for (var m = 1; m <= lastM; m++) keys.push(year + '-' + (m < 10 ? '0' : '') + m);
    }
    return keys;
  }
  function bucketVolume(points, grain, yearFrom, yearTo, year) {
    var keys = emptyBuckets(grain, yearFrom, yearTo, year);
    var map = {};
    keys.forEach(function (k) { map[k] = { n: 0, done: 0 }; });
    points.forEach(function (p) {
      var k = grainKey(p.at, grain);
      if (!map[k]) return;
      map[k].n += Number(p.n) || 0;
      map[k].done += Number(p.done != null ? p.done : p.n) || 0;
    });
    return keys.map(function (k) {
      var n = map[k].n, done = map[k].done;
      return {
        key: k,
        label: volumeLabel(k, grain),
        n: n,
        done: done,
        rate: n ? Math.round((done / n) * 100) : 0,
      };
    });
  }
  function getVolumeSeries(opts) {
    opts = opts || {};
    var grain = opts.grain || '月';
    var year = Number(opts.year) || 2026;
    var yearFrom = Number(opts.yearFrom) || 2020;
    var yearTo = Number(opts.yearTo) || 2026;
    if (yearFrom > yearTo) { var tmp = yearFrom; yearFrom = yearTo; yearTo = tmp; }
    return bucketVolume(VOLUME_SEED, grain, yearFrom, yearTo, year);
  }
  function chartSeries(all, pass, review, fail) {
    var sliceTotal = pass.length + review.length + fail.length;
    function spct(n) { return sliceTotal ? Math.round((n / sliceTotal) * 100) + '%' : '0%'; }
    var slices = [
      { key: '通过', n: pass.length, pct: spct(pass.length), color: '#059669' },
      { key: '需复核', n: review.length, pct: spct(review.length), color: '#d97706' },
      { key: '不通过', n: fail.length, pct: spct(fail.length), color: '#dc2626' },
    ];
    var t = new Date(PANEL_TODAY + 'T00:00:00');
    var trend = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(t.getTime() - i * 86400000);
      var key = ymd(d);
      var n = all.filter(function (r) { return String(r.at).slice(0, 10) === key; }).length;
      trend.push({ day: key, label: md(d), n: n });
    }
    var hits = {};
    var sev = { 严重: 0, 一般: 0, 轻微: 0 };
    all.forEach(function (row) {
      if (row.aiTask === '排队' || row.aiTask === '审核中') return;
      var snap = row.snapshot;
      if (!snap && row.report) snap = currentRound(row.report).snapshot;
      if (!snap) return;
      var res = evalSnapshot(snap, !!snap.category_code);
      (res.failed || []).forEach(function (it) {
        hits[it.name] = (hits[it.name] || 0) + 1;
        if (it.severity === '严重') sev['严重']++;
        else if (it.severity === '轻微' || it.severity === '提示') sev['轻微']++;
        else sev['一般']++;
      });
    });
    var sevTotal = sev['严重'] + sev['一般'] + sev['轻微'];
    function svp(k) { return sevTotal ? Math.round((sev[k] / sevTotal) * 100) + '%' : '0%'; }
    var sevColors = { 严重: '#dc2626', 一般: '#d97706', 轻微: '#94a3b8' };
    var rules = Object.keys(hits).map(function (k) { return { name: k, n: hits[k] }; })
      .sort(function (a, b) { return b.n - a.n; }).slice(0, 5);
    return {
      slices: slices, trend: trend, rules: rules,
      failSev: {
        n: sev, pct: { 严重: svp('严重'), 一般: svp('一般'), 轻微: svp('轻微') }, total: sevTotal,
        slices: ['严重', '一般', '轻微'].map(function (k) {
          return { key: k, n: sev[k] || 0, pct: svp(k), color: sevColors[k] };
        }),
      },
    };
  }

  function getPanelDataset(range) {
    range = range || '7天';
    var live = livePanelRows();
    var queueLive = live.filter(function (row) {
      return (row.aiTask === '审核中' || row.aiTask === '排队') && inWindow(row.at, range);
    }).map(function (row) { return tagKind(row, 'queue'); });
    var process = live.filter(function (row) {
      return row.aiTask !== '审核中' && row.aiTask !== '排队' && inWindow(row.at, range);
    }).map(function (row) { return tagKind(row, 'process'); });
    var queueSeed = QUEUE.filter(function (row) {
      return inWindow(row.at, range);
    }).map(function (row) { return tagKind(row, 'queue'); });
    var queue = queueSeed.concat(queueLive).sort(function (a, b) {
      var pa = a.queuePos == null ? 99 : a.queuePos;
      var pb = b.queuePos == null ? 99 : b.queuePos;
      return pa - pb;
    });
    var archive = ARCHIVES.filter(function (row) {
      return inWindow(row.archivedAt || row.at, range);
    }).map(function (row) { return tagKind(row, 'archive'); });
    var all = queue.concat(process, archive);
    var triggered = all.length;
    var concluded = all.filter(function (r) { return r.conclusion === '通过' || r.conclusion === '需复核' || r.conclusion === '不通过'; });
    var success = all.filter(function (r) { return r.aiTask === '成功'; });
    var pass = concluded.filter(function (r) { return r.conclusion === '通过'; });
    var review = concluded.filter(function (r) { return r.conclusion === '需复核'; });
    var fail = concluded.filter(function (r) { return r.conclusion === '不通过'; });
    var decided = all.filter(function (r) { return r.human === '已同意' || r.human === '已覆盖'; });
    var agree = decided.filter(function (r) { return r.human === '已同意' || r.agreeAi === true; });
    var abnormal = all.filter(function (r) { return r.aiTask === '异常暂停' || r.conclusion === '异常'; });
    var queued = all.filter(function (r) { return r.aiTask === '排队'; });
    var running = all.filter(function (r) { return r.aiTask === '审核中'; });
    var exceptions = EXCEPTIONS.filter(function (row) {
      return inWindow(row.at, range);
    }).map(function (row) { return tagKind(row, 'exception'); });
    var pending = process.filter(function (r) {
      return r.human === '待处置';
    });
    var signed = archive.filter(function (r) { return !r.deleted; });
    var deleted = archive.filter(function (r) { return r.deleted; });
    function byCat(rows) {
      var map = {};
      rows.forEach(function (r) {
        var k = r.pack || (r.snapshot && r.snapshot.category_name) || '未分类';
        map[k] = (map[k] || 0) + 1;
      });
      return Object.keys(map).sort(function (a, b) { return map[b] - map[a]; })
        .map(function (k) { return { name: k, n: map[k] }; });
    }
    var durRows = success.filter(function (r) { return r.durationSec > 0; });
    var avgDurationSec = durRows.length
      ? Math.round(durRows.reduce(function (s, r) { return s + r.durationSec; }, 0) / durRows.length)
      : 0;
    function pct(n, d) { return d ? Math.round((n / d) * 100) + '%' : '—'; }
    var charts = chartSeries(all, pass, review, fail);
    charts.volume = {
      年: getVolumeSeries({ grain: '年', yearFrom: 2020, yearTo: 2026 }),
      季: getVolumeSeries({ grain: '季', year: 2026 }),
      月: getVolumeSeries({ grain: '月', year: 2026 }),
    };
    return {
      today: PANEL_TODAY, range: range,
      queue: queue, process: process, archive: archive,
      pending: pending, exceptions: exceptions,
      kpi: {
        reports: triggered,
        audits: triggered + exceptions.length,
        closeRate: pct(success.length, triggered + exceptions.length),
        passRate: pct(pass.length, concluded.length),
        reviewRate: pct(review.length, concluded.length),
        failRate: pct(fail.length, concluded.length),
        adoptRate: pct(agree.length, decided.length),
        errorRate: pct(abnormal.length + exceptions.length, triggered + exceptions.length),
        auditN: triggered + exceptions.length,
        avgDurationSec: avgDurationSec,
        counts: {
          success: success.length, pass: pass.length, review: review.length, fail: fail.length,
          decided: decided.length, agree: agree.length,
          abnormal: abnormal.length + exceptions.length, concluded: concluded.length,
          queue: queued.length, running: running.length, done: concluded.length,
        },
      },
      charts: charts,
      archiveStats: {
        total: archive.length, signed: signed.length, deleted: deleted.length,
        signedCats: byCat(signed), deletedCats: byCat(deleted),
      },
    };
  }

  function findPanelRow(id) {
    var ds = getPanelDataset('全部');
    var lists = [ds.queue, ds.process, ds.archive, ds.exceptions];
    for (var i = 0; i < lists.length; i++) {
      for (var j = 0; j < lists[i].length; j++) if (lists[i][j].id === id) return lists[i][j];
    }
    return null;
  }

  // 供「报告编制」页展示：被 AI 判不通过（严重）的报告（跨页同源）
  function aiReturnedReports() {
    var out = [];
    ENTRUSTS.forEach(function (ent) {
      ent.reports.forEach(function (rep) {
        if (rep.aiRun) return;
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
    ARCHIVES: ARCHIVES,
    QUEUE: QUEUE,
    EXCEPTIONS: EXCEPTIONS,
    PANEL_TODAY: PANEL_TODAY,
    SAMPLE_MAJOR_CATS: ['电力物资类', '安全工器具类', '环境检测', '工程检测'],
    getEntrust: getEntrust,
    evalReport: evalReport,
    evalRound: evalRound,
    evalSnapshot: evalSnapshot,
    diffRounds: diffRounds,
    currentRound: currentRound,
    aiReturnedReports: aiReturnedReports,
    needsHuman: needsHuman,
    failRunningReport: failRunningReport,
    getPanelDataset: getPanelDataset,
    getVolumeSeries: getVolumeSeries,
    VOLUME_YEARS: VOLUME_YEARS,
    findPanelRow: findPanelRow,
    getPolicy: function () { return POLICY; },
    setAutoReturn: function (v) { POLICY.autoReturnOnSevere = !!v; },
    CONCLUSION_META: {
      '通过': { cls: 'bg-emerald-100 text-emerald-700', icon: 'fa-check-circle' },
      '需复核': { cls: 'bg-amber-100 text-amber-700', icon: 'fa-exclamation-circle' },
      '不通过': { cls: 'bg-red-100 text-red-700', icon: 'fa-times-circle' },
      '审核中': { cls: 'bg-blue-100 text-blue-700', icon: 'fa-spinner' },
      '异常': { cls: 'bg-red-100 text-red-700', icon: 'fa-exclamation-triangle' },
    },
    LABEL_NOTE: '标注仅用于 AI 模型持续学习优化，不对上下游人员展示',
  };
})(window);
