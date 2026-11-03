/* 委托详情共享 mock（「点哪单看哪单」的数据源）
 * 数据来源：各列表页现有 mock 的并集（委托预览 / 样品收样 / 数据审核 / 组内审核 / 委托确认 /
 * 样品发样 / 样品制备 / 退样 / 试验检测 / 试样分发 / 标签打印 / 合同详情），共 67 个委托号；
 * 列表里没给出样品名的编号，按编号稳定轮转推导（同一编号每次刷新结果一致）。
 * 样品主数据能解析到的（绝缘操作杆/安全带/安全帽/电缆/导管…），型号、规格参数、试验项、
 * 产品标记全部走「样品数据」，解析不到的用候选值兜底。
 */
(function (global) {
  var DEFAULT_CODE = 'SC2026/0073';

  var CUSTOMERS = {
    '杭州数蚕智能科技有限公司': { addr: '杭州市西湖区文三路西溪银座E座', zip: '310000', contact: '安可', phone: '17835503262', place: '湖北' },
    '东集西造有限公司': { addr: '东莞市松山湖科技产业园工业南路12号', zip: '523808', contact: '陈默', phone: '13905710021', place: '广东' },
    '宇宙设想有限公司': { addr: '杭州市余杭区文一西路1218号', zip: '311100', contact: '孙倩', phone: '13600001234', place: '浙江' },
    '灵知益义有限公司': { addr: '合肥市蜀山区长江西路218号', zip: '230031', contact: '何宇', phone: '15800002345', place: '安徽' },
    '东莞西洁有限公司': { addr: '东莞市南城街道簪花路8号', zip: '523000', contact: '李伟', phone: '13798001122', place: '广东' },
    '南京远能电力工程有限公司监理分公司': { addr: '南京市经济技术开发区', zip: '610222', contact: '张华', phone: '13766664444', place: '江苏' }
  };
  var CUSTOMER_POOL = Object.keys(CUSTOMERS);
  var LAB = '应敏科技有限公司';

  /* 样品名 → 主数据叶节点（有则型号/规格/试验项/产品标记都取样品数据）、单位、规格候选 */
  var SAMPLE_META = {
    '绝缘操作杆': { leaf: 'rod', unit: '根', spec: ['300', '600'] },
    '绝缘软梯': { leaf: 'ladder', unit: '架', spec: ['20m'] },
    '绝缘硬梯': { leaf: 'hardladder', unit: '架', spec: ['10m'] },
    '安全带': { leaf: 'belt976', unit: '条', spec: ['围杆式'] },
    '安全绳': { leaf: 'rope1476', unit: '条', spec: ['16m'] },
    '安全帽': { leaf: 'helmet', unit: '顶', spec: ['ABS'] },
    '10kV3芯电力电缆': { leaf: 'cu6-3c', unit: '根', spec: [] },
    '10kV单芯电力电缆': { leaf: 'cu6-1c', unit: '根', spec: [] },
    'DS实壁类塑料电缆导管_直管': { leaf: 'ds-s', unit: '根', spec: [] },
    '实壁类塑料电缆导管_直管': { leaf: 'ds-s', unit: '根', spec: [] },
    '电缆保护管': { leaf: 'ds-s', unit: '根', spec: ['DN150'] },
    '电缆导管': { leaf: 'ds-s', unit: '根', spec: ['DN110'] },
    /* 以下样品已在「样品数据」补了主数据（试验项 / 产品标记 / 判定各自不同），
       这里只保留委托侧的规格候选文本（这些样品不分型号，无型号级规格参数） */
    '绝缘毯': { leaf: 'blanket', unit: '块', spec: ['10kV 二级'] },
    '遮蔽罩': { leaf: 'shield', unit: '件', spec: ['10kV'] },
    '验电器': { leaf: 'detector', unit: '支', spec: ['10kV'] },
    '绝缘杆': { leaf: 'pole', unit: '根', spec: ['35kV 2000'] },
    '吊钩（环）t': { leaf: 'hook', unit: '只', spec: ['20t'] },
    '绝缘斗臂车-t': { leaf: 'bucket', unit: '台', spec: ['10kV 12m'] },
    '10kV旁路作业设备': { leaf: 'bypass', unit: '套', spec: ['10kV'] },
    '10kV带电作业用绝缘服': { leaf: 'suit', unit: '套', spec: ['10kV'] },
    '电线电缆': { leaf: 'cu6-3c', unit: '米', spec: ['YJV22-8.7/15kV 3×95'] },
    '8.7/10kV·3芯': { leaf: 'cu6-3c', unit: '米', spec: ['3×95'] },
    '绝缘手套': { leaf: 'glove', unit: '副', spec: ['12kV'] },
    '导线飞车': { leaf: 'flyingcar', unit: '台', spec: ['10kV'] },
    '复合硅酸盐水泥': { leaf: 'pc', unit: '组', spec: ['P·C 32.5'] },
    '硅酸盐水泥': { leaf: 'p', unit: '组', spec: ['P·I 42.5'] },
    '普通硅酸盐水泥': { leaf: 'po', unit: '组', spec: ['P·O 42.5'] }
  };
  var DERIVE_POOL = ['绝缘操作杆', '安全带', '安全帽', '验电器', '绝缘毯', '10kV3芯电力电缆'];
  var FACTORIES = ['杭州华辰电力设备有限公司', '河北恒信安全器材厂', '江苏远缆电缆有限公司', '广东坚盾电力器材有限公司'];

  /* 编号 → [委托单位, 样品串 name|qty|unit;…, 受理日期, 客户要求完成日期, 编制人, 业务员, 任务状态] */
  var ROWS = {
    'SC2026/0213': ['杭州数蚕智能科技有限公司', '实壁类塑料电缆导管_直管|1|', '2026-07-14', '', 'admin', '梁倩', ''],
    'SC2026/0212': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|', '2026-07-08', '2026-07-10', 'admin', '业务员A', '报告审核'],
    'SC2026/0211': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|', '2026-07-07', '2026-07-09', 'admin', '梁倩', '试验检测'],
    'SC2026/0210': ['杭州数蚕智能科技有限公司', '绝缘毯|1|;安全带|1|', '2026-07-07', '2026-07-10', 'admin', '梁倩', '报告审核'],
    'SC2026/0208': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|;绝缘杆|1|', '2026-06-15', '2026-06-18', 'admin', '梁倩', '报告审核'],
    'SC2026/0207': ['杭州数蚕智能科技有限公司', '遮蔽罩|1|;安全带|1|', '2026-06-11', '2026-06-13', 'admin', '梁倩', '报告审核'],
    'SC2026/0206': ['杭州数蚕智能科技有限公司', '安全帽|1|', '2026-06-16', '', 'admin', '业务员A', '报告审核'],
    'SC2026/0205': ['东莞西洁有限公司', '绝缘操作杆|1|', '2026-06-11', '2026-06-22', 'admin', '梁倩', '报告审核'],
    'SC2026/0204': ['宇宙设想有限公司', '绝缘杆|1|', '2026-06-10', '2026-06-13', 'admin', '梁倩', '报告审核'],
    'SC2026/0203': ['灵知益义有限公司', '电线电缆|1|', '2026-06-10', '2026-06-20', 'admin', '梁倩', '报告审核'],
    'SC2026/0202': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|', '2026-06-10', '2026-06-19', 'admin', '梁倩', '试验检测'],
    'SC2026/0201': ['杭州数蚕智能科技有限公司', '绝缘毯|1|;安全带|1|', '2026-06-10', '2026-06-19', 'admin', '业务员A', '试验检测'],
    'SC2026/0200': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|', '2026-06-10', '2026-06-20', 'admin', '梁倩', '报告审核'],
    'SC2026/0167': ['杭州数蚕智能科技有限公司', '电缆导管|1|', '', '', 'admin', '', ''],
    'SC2026/0088': ['杭州数蚕智能科技有限公司', '安全绳|1|', '2026-07-14', '', 'admin', '梁倩', '样品发样'],
    'SC2026/0087': ['杭州数蚕智能科技有限公司', '安全带|1|', '2026-07-14', '', 'admin', '梁倩', ''],
    'SC2026/0086': ['杭州数蚕智能科技有限公司', '电缆保护管|1|', '2026-07-13', '', 'admin', '梁倩', '样品发样'],
    'SC2026/0085': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|', '2026-07-12', '', 'admin', '梁倩', ''],
    'SC2026/0084': ['东集西造有限公司', '绝缘操作杆|1|', '2026-07-12', '', 'admin', '业务员A', '样品发样'],
    'SC2026/0083': ['杭州数蚕智能科技有限公司', '吊钩（环）t|1|', '2026-07-10', '', 'admin', '梁倩', ''],
    'SC2026/0082': ['杭州数蚕智能科技有限公司', '安全带|1|;安全绳|1|', '', '', 'admin', '梁倩', '任务完成'],
    // 委托确认退回委托登记、变更后再往下流转的三张演示委托（样品清单=变更后）
    'SC2026/0033': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|根;绝缘杆|2|根', '2026-10-20', '2026-11-20', 'admin', '梁倩', '样品收样'],
    'SC2026/0031': ['东集西造有限公司', '遮蔽罩|1|件', '2026-10-18', '2026-11-18', 'admin', '业务员A', '委托确认'],
    'SC2026/0029': ['宇宙设想有限公司', '绝缘毯|2|块;10kV3芯电力电缆|1|根;验电器|2|支', '2026-10-16', '2026-11-16', 'admin', '梁倩', '样品收样'],
    'SC2026/0081': ['东集西造有限公司', '绝缘操作杆|1|', '2026-07-08', '', 'admin', '业务员A', ''],
    'SC2026/0080': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|根', '2026-07-03', '2026-07-30', 'admin', '梁倩', '样品收样'],
    'SC2026/0079': ['杭州数蚕智能科技有限公司', '', '', '2026-07-30', 'admin', '', '报告发放'],
    'SC2026/0078': ['杭州数蚕智能科技有限公司', '', '', '2026-07-28', 'admin', '', '委托登记'],
    'SC2026/0077': ['杭州数蚕智能科技有限公司', '', '', '2026-07-27', 'admin', '', '报告审核'],
    'SC2026/0076': ['杭州数蚕智能科技有限公司', '', '', '2026-07-26', 'admin', '', '报告审核'],
    'SC2026/0075': ['东集西造有限公司', '安全帽|1|', '', '2026-07-25', 'admin', '业务员A', '任务完成'],
    'SC2026/0074': ['杭州数蚕智能科技有限公司', '', '', '2026-07-24', 'admin', '', '任务完成'],
    'SC2026/0073': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|根', '2026-07-08', '', 'admin', '梁倩', '报告发放'],
    'SC2026/0072': ['杭州数蚕智能科技有限公司', '', '', '2026-07-22', 'admin', '', '收费审批'],
    'SC2026/0071': ['宇宙设想有限公司', '遮蔽罩|1|;安全带|1|', '2026-06-09', '2026-06-20', 'admin', '梁倩', '报告签发'],
    'SC2026/0070': ['杭州数蚕智能科技有限公司', '', '', '2026-07-20', 'admin', '', '任务归档'],
    'SC2026/0069': ['杭州数蚕智能科技有限公司', '', '', '2026-07-19', 'admin', '', '报告编制'],
    'SC2026/0068': ['杭州数蚕智能科技有限公司', '', '', '2026-07-18', 'admin', '', '数据审核'],
    'SC2026/0067': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|根', '2026-06-28', '2026-07-25', 'admin', '梁倩', '样品收样'],
    'SC2026/0065': ['东集西造有限公司', '10kV带电作业用绝缘服|2|套', '2026-06-26', '2026-07-20', 'admin', '业务员A', '样品收样'],
    'SC2026/0063': ['杭州数蚕智能科技有限公司', '绝缘斗臂车-t|1|台', '2026-06-24', '2026-07-18', 'admin', '梁倩', '样品收样'],
    'SC2026/0062': ['杭州数蚕智能科技有限公司', '绝缘硬梯|1|', '2026-06-01', '', 'admin', '', '已审核'],
    'SC2026/0061': ['宇宙设想有限公司', '10kV旁路作业设备|1|套', '2026-06-22', '2026-07-15', 'admin', '梁倩', '样品收样'],
    'SC2026/0060': ['东集西造有限公司', '绝缘操作杆|1|', '2026-05-28', '2026-06-10', 'admin', '', '已完成'],
    'SC2026/0059': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|根', '2026-06-20', '2026-07-12', 'admin', '业务员A', '样品收样'],
    'SC2026/0058': ['宇宙设想有限公司', '安全带|1|', '2026-05-20', '2026-06-05', 'admin', '', '待接收'],
    'SC2026/0057': ['东集西造有限公司', '安全帽|5|顶', '2026-06-18', '2026-07-10', 'admin', '梁倩', '样品收样'],
    'SC2026/0056': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|', '', '', 'admin', '', '待接收'],
    'SC2026/0055': ['杭州数蚕智能科技有限公司', '绝缘毯|3|块;安全带|1|条', '2026-06-16', '2026-07-08', 'admin', '梁倩', '样品收样'],
    'SC2026/0054': ['杭州数蚕智能科技有限公司', '吊钩（环）t|1|', '', '', 'admin', '', '未领样'],
    'SC2026/0053': ['灵知益义有限公司', '绝缘杆|2|根', '2026-06-14', '2026-07-05', 'admin', '业务员A', '样品收样'],
    'SC2026/0052': ['杭州数蚕智能科技有限公司', '安全带|1|', '', '', 'admin', '', '试验检测'],
    'SC2026/0051': ['杭州数蚕智能科技有限公司', '遮蔽罩|1|件;安全带|1|条', '2026-06-12', '2026-07-03', 'admin', '梁倩', '样品收样'],
    'SC2026/0049': ['杭州数蚕智能科技有限公司', '验电器|2|支', '2026-06-10', '2026-06-30', '潘哲宁', '梁倩', '样品收样'],
    'SC2026/0047': ['杭州数蚕智能科技有限公司', '10kV3芯电力电缆|3|根', '2026-06-08', '2026-06-28', 'admin', '梁倩', '样品收样'],
    'SC2026/0045': ['东集西造有限公司', 'DS实壁类塑料电缆导管_直管|4|根;10kV单芯电力电缆|1|根', '2026-06-05', '2026-06-25', 'admin', '业务员A', '样品收样'],
    'SC2026/0043': ['东集西造有限公司', '绝缘毯|2|块;安全带|1|条;安全帽|3|顶', '2026-06-03', '2026-07-02', 'admin', '梁倩', '样品收样'],
    'SC2026/0042': ['东集西造有限公司', '安全带|1|', '', '', 'admin', '', ''],
    'SC2026/0041': ['杭州数蚕智能科技有限公司', '10kV3芯电力电缆|3|根;DS实壁类塑料电缆导管_直管|4|根', '2026-06-02', '2026-06-30', 'admin', '业务员A', '样品收样'],
    'SC2026/0039': ['宇宙设想有限公司', '验电器|2|支;绝缘杆|1|根', '2026-06-01', '2026-06-28', '潘哲宁', '梁倩', '样品收样'],
    'SC2026/0037': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|', '', '', 'admin', '', ''],
    'SC2026/0030': ['东集西造有限公司', '安全带|1|', '', '', 'admin', '', '任务完成'],
    'SC2026/0024': ['杭州数蚕智能科技有限公司', '绝缘操作杆|1|', '', '', 'admin', '', '任务完成'],
    /* 框架合同 KJHT2025112001（南京远能）名下的 7 单：原先只存在于合同详情页，现收进同一数据源 */
    'SC2025/0003': ['南京远能电力工程有限公司监理分公司', '绝缘操作杆|1|根', '2025-11-20', '', 'admin', '梁倩', '试样分发'],
    'SC2025/0004': ['南京远能电力工程有限公司监理分公司', '导线飞车|1|台', '2025-11-21', '', 'admin', '梁倩', '报告编制'],
    'SC2025/0005': ['南京远能电力工程有限公司监理分公司', '8.7/10kV·3芯|1|米', '2025-11-22', '', 'admin', '业务员A', '试验检测'],
    'SC2025/0006': ['南京远能电力工程有限公司监理分公司', '复合硅酸盐水泥|1|组', '2025-11-23', '', 'admin', '梁倩', '试验检测'],
    'SC2025/0007': ['南京远能电力工程有限公司监理分公司', '电缆保护管|1|根', '2025-11-24', '', 'admin', '梁倩', '报告签发'],
    'SC2025/0008': ['南京远能电力工程有限公司监理分公司', '电线电缆|1|米', '2025-11-25', '', 'admin', '业务员A', '报告发放'],
    'SC2025/0009': ['南京远能电力工程有限公司监理分公司', '绝缘手套|1|副', '2025-11-26', '', 'admin', '梁倩', '试验检测'],
  };

  /* 页面里已人工写定的字段固化到这里（单一数据源）：
   * customerDate=客户要求完成日期、requireDate=要求检测完成时间、receiveDate=收样时间、
   * taskType/testType/priority/testCategory。没列出的编号走文件末尾的推导规则。 */
  var EXACT = {
    'SC2026/0212': { customerDate: '', requireDate: '2026-07-10', receiveDate: '2026-07-08', taskType: '电气（输配电类）', testType: '常规', priority: '常规' },
    'SC2026/0211': { customerDate: '', requireDate: '2026-07-09', receiveDate: '2026-07-07', taskType: '电气（输配电类）', testType: '常规', priority: '加急' },
    'SC2026/0210': { customerDate: '', requireDate: '2026-07-10', receiveDate: '2026-07-07', taskType: '材料（安全工器具类）', testType: '常规', priority: '常规' },
    'SC2026/0208': { customerDate: '', requireDate: '2026-06-18', receiveDate: '2026-06-15', taskType: '材料（安全工器具类）', testType: '常规', priority: '常规' },
    'SC2026/0207': { customerDate: '', requireDate: '2026-06-13', receiveDate: '2026-06-11', taskType: '材料（安全工器具类）', testType: '非常规', priority: '常规' },
    'SC2026/0206': { customerDate: '', requireDate: '', receiveDate: '2026-06-16', taskType: '材料（安全工器具类）', testType: '常规', priority: '常规' },
    'SC2026/0205': { customerDate: '2026-06-26', requireDate: '2026-06-22', receiveDate: '2026-06-11', taskType: '电气（输配电类）', testType: '常规', priority: '加急' },
    'SC2026/0204': { customerDate: '', requireDate: '2026-06-13', receiveDate: '2026-06-10', taskType: '电气（输配电类）', testType: '非常规', priority: '常规' },
    'SC2026/0203': { customerDate: '', requireDate: '2026-06-20', receiveDate: '2026-06-10', taskType: '材料（电线电缆、金具、金属材料类）', testType: '常规', priority: '常规' },
    'SC2026/0202': { customerDate: '', requireDate: '2026-06-19', receiveDate: '2026-06-10', taskType: '材料（安全工器具类）', testType: '常规', priority: '常规' },
    'SC2026/0201': { customerDate: '', requireDate: '2026-06-19', receiveDate: '2026-06-10', taskType: '电气（输配电类）', testType: '常规', priority: '常规' },
    'SC2026/0200': { customerDate: '', requireDate: '2026-06-20', receiveDate: '2026-06-10', taskType: '材料（安全工器具类）', testType: '常规', priority: '常规' },
    'SC2026/0073': {
      customerDate: '2026-07-23', requireDate: '2026-08-01', days: '2', receiveDate: '2026-07-09',
      taskType: '电气（输配电类）', priority: '常规', testType: '常规', testCategory: '委托检测',
      samples: { '绝缘操作杆': { spec: '300', qty: '1', unit: '根', needPrep: '否' } }
    }
  };

  function hash(s) {
    var h = 0; s = String(s || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
    return h;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toDay(str) { var p = String(str || '').split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
  function plusDays(str, n) { var d = toDay(str); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function diffDays(a, b) { return Math.round((toDay(b) - toDay(a)) / 86400000); }

  function parseSamples(str, code, h) {
    var out = [];
    String(str || '').split(';').forEach(function (part) {
      if (!part) return;
      var f = part.split('|');
      out.push({ name: f[0], qty: f[1] || '1', unit: f[2] || '' });
    });
    if (!out.length) {                       // 列表没给样品名：按编号稳定轮转 1~2 项
      var n = 1 + h % 2;
      for (var i = 0; i < n; i++) {
        var nm = DERIVE_POOL[(h + i * 3) % DERIVE_POOL.length];
        out.push({ name: nm, qty: String(1 + (h + i) % 4), unit: (SAMPLE_META[nm] || {}).unit || '件' });
      }
    }
    return out;
  }

  /** 能解析到主数据的样品：型号/规格参数/试验项/产品标记全部来自样品数据 */
  function enrichSample(s, code, h, idx) {
    var meta = SAMPLE_META[s.name] || {};
    var leafId = s.leafId || meta.leaf || '';
    var st = global.SampleDataStore, sample = (leafId && st) ? st.getSample(leafId) : null;
    var models = sample ? st.modelsOf(sample) : [];
    var modelCode = s.modelCode || (models.length ? models[h % models.length].code : '');
    var specs = (sample && modelCode) ? ((st.modelOf(sample, modelCode) || {}).specs || []) : [];
    var specValues = specs.map(function (sp, i) {
      var opts = sp.options || [];
      return opts.length ? opts[(h + i) % opts.length] : '';
    });
    var cand = meta.spec || [];
    var spec = s.spec || (specs.length ? '' : (cand.length ? cand[h % cand.length] : ''));
    return {
      no: code.replace('/', '') + pad(idx + 1) + '01',
      name: s.name, alias: s.alias || (sample ? sample.name : s.name), leafId: leafId,
      modelCode: modelCode, specs: specs, specValues: specValues, spec: spec,
      qty: s.qty, unit: s.unit || meta.unit || '件',
      needPrep: (h + idx) % 3 === 0 ? '是' : '否',   // EXACT 可覆盖
      factory: FACTORIES[(h + idx) % FACTORIES.length],
      factoryAddr: FACTORIES[(h + idx) % FACTORIES.length].slice(0, 2) + '市工业园区' + (1 + h % 9) + '号',
      manufacturer: FACTORIES[(h + idx + 1) % FACTORIES.length],
      manufacturerAddr: FACTORIES[(h + idx + 1) % FACTORIES.length].slice(0, 2) + '市制造基地' + (2 + h % 7) + '号',
      remark: s.remark || '备注',
      tests: (sample && st.testsOf(sample, modelCode).length) ? st.testsOf(sample, modelCode) : null
    };
  }

  /* 样品大类 → lims_task_type 字典项（字典就是委托登记里那 6 项，列表与详情页只能取其中的值，不新增项）
   * dlwz  电力物资类 → 材料（电线电缆、金具、金属材料类）
   * aqgqj 安全工器具类 → 材料（安全工器具类）
   * gcjc  工程检测 → 材料（电线电缆、金具、金属材料类）：6 项里没有建材专属项，
   *   按「材料」类最后一项归口（通用硅酸盐水泥等建材样品）。
   * hjjc  环境检测：6 项里没有可归靠的选项，且当前原型没有环境检测类委托，留空由页面显示「/」。 */
  var TASK_TYPE_BY_CAT = {
    dlwz: '材料（电线电缆、金具、金属材料类）',
    aqgqj: '材料（安全工器具类）',
    gcjc: '材料（电线电缆、金具、金属材料类）',
    hjjc: ''
  };

  /** 任务类型按样品大类推导；一个委托含多大类时按 dlwz > aqgqj > gcjc > hjjc 取先 */
  function taskTypeOf(samples) {
    var st = global.SampleDataStore;
    var cats = {};
    samples.forEach(function (sm) {
      var c = (st && st.catKeyOfName) ? st.catKeyOfName(sm.name) : '';
      // 名称不是树节点标签时（如「8.7/10kV·3芯」这种规格式写法），退回按已解析到的主数据判断
      if (!c && sm.leafId && st) {
        var master = st.getSample(sm.leafId);
        var cc = (master && master.category) || '';
        if (/电力电缆|电缆保护管|导管/.test(cc)) c = 'dlwz';
        else if (/安全工器具/.test(cc)) c = 'aqgqj';
        else if (/工程检测/.test(cc)) c = 'gcjc';
        else if (/环境/.test(cc)) c = 'hjjc';
      }
      if (!c && /电缆|导线|保护管|导管|金具/.test(sm.name)) c = 'dlwz';
      if (c) cats[c] = 1;
    });
    var order = ['dlwz', 'aqgqj', 'gcjc', 'hjjc'];
    for (var i = 0; i < order.length; i++) {
      if (cats[order[i]] && TASK_TYPE_BY_CAT[order[i]]) return TASK_TYPE_BY_CAT[order[i]];
    }
    return '';
  }

  function get(code) {
    code = String(code || '').trim() || DEFAULT_CODE;
    var r = ROWS[code], h = hash(code), ex = EXACT[code];
    var customer = (r && r[0]) || CUSTOMER_POOL[h % CUSTOMER_POOL.length];
    var cust = CUSTOMERS[customer] || CUSTOMERS[CUSTOMER_POOL[0]];
    var accept = (r && r[2]) || plusDays('2026-06-01', h % 45);
    var customerDate = (r && r[3]) || plusDays(accept, 18 + h % 12);
    var days = diffDays(accept, customerDate) - 2;
    if (!(days > 0)) days = 2 + h % 8;
    var ex = EXACT[code];
    var samples = parseSamples(r && r[1], code, h).map(function (s, i) {
      var e = enrichSample(s, code, h, i);
      if (ex && ex.samples && ex.samples[e.name]) {
        Object.keys(ex.samples[e.name]).forEach(function (k) { e[k] = ex.samples[e.name][k]; });
      }
      return e;
    });
    var total = samples.reduce(function (sum, s) {
      var price = (s.tests && s.tests.length) ? s.tests.reduce(function (a, t) { return a + (Number(t.price) || 0); }, 0) : 40;
      return sum + price * (Number(s.qty) || 1);
    }, 0);
    return {
      code: code, dash: code.replace('/', '-'), status: (r && r[6]) || '', known: !!r,
      taskType: (ex && ex.taskType) || taskTypeOf(samples),
      priority: (ex && ex.priority !== undefined) ? ex.priority : '常规',
      testType: (ex && ex.testType !== undefined) ? ex.testType : '常规',
      testCategory: (ex && ex.testCategory) || ['例行试验', '委托检测', '型式试验'][h % 3],
      customer: customer, addr: cust.addr, zip: cust.zip, contact: cust.contact, phone: cust.phone,
      signPlace: cust.place, lab: LAB,
      acceptDate: accept,
      customerDate: (ex && ex.customerDate !== undefined) ? ex.customerDate : customerDate,
      days: (ex && ex.days) || String(days),
      requireDate: (ex && ex.requireDate) || plusDays(accept, days),
      editor: (r && r[4]) || 'admin', salesman: (r && r[5]) || '梁倩',
      totalPrice: String(total), actualFee: String(total), discount: '0',
      payer: customer, payMethod: h % 2 ? '电汇' : '对公转账', feeRemark: '',
      samples: samples,
      sampleNames: samples.map(function (sm) { return sm.name; }).join('、'),
      receiveDate: (ex && ex.receiveDate !== undefined) ? ex.receiveDate : plusDays(accept, 1)
    };
  }

  /**
   * 让各列表页的公共字段以本 mock 为准：列表看到的客户 / 样品 / 日期 / 人员，
   * 与点进详情页看到的完全一致（各页只保留自己环节特有的字段：状态、进度、模版、勾选…）。
   * 只覆盖行对象里「已存在」的键，不给页面凭空加字段。
   * @param rows 列表数据数组
   * @param opts 覆盖默认列名映射，例如委托预览的「要求完成时间」列名是 requireDate、「客户要求完成日期」是 customerDate
   */
  function enrich(rows, opts) {
    if (!rows || !rows.forEach) return rows;
    var map = {
      customer: 'customer', sample: 'sample', samples: 'samples',
      accept: 'acceptDate', require: 'requireDate', finish: null, customerDate: null,
      editor: 'editor', salesman: 'salesman',
      taskType: 'taskType', testType: 'testType', priority: 'priority',
      receiveDate: 'receiveDate', arriveDate: 'arriveDate', payer: 'payer'
    };
    Object.keys(opts || {}).forEach(function (k) { map[k] = opts[k]; });
    rows.forEach(function (row) {
      if (!row || !row.code) return;
      // 不认识的编号（例如合同详情里的 SC2025/000x）保持页面原样，不拿推导值盖掉
      if (!ROWS[row.code]) return;
      var r = get(row.code);
      function set(key, val) { if (key && key in row && val !== undefined) row[key] = val; }
      set(map.customer, r.customer);
      set(map.sample, r.sampleNames);
      set(map.payer, r.payer);
      set(map.accept, r.acceptDate);
      set(map.require, r.customerDate);        // 多数页面 requireDate 列 = 客户要求完成日期
      set(map.finish, r.requireDate);          // 委托预览另有「要求检测完成时间」列
      set(map.customerDate, r.customerDate);
      set(map.receiveDate, r.receiveDate);
      set(map.arriveDate, r.receiveDate);
      set(map.editor, r.editor);
      set(map.salesman, r.salesman);
      set(map.taskType, r.taskType);
      set(map.testType, r.testType);
      set(map.priority, r.priority);
      if (map.samples && Array.isArray(row[map.samples])) {
        var old = {};
        row[map.samples].forEach(function (sm) { if (sm && sm.name) old[sm.name] = sm.modelCode || ''; });
        row[map.samples] = r.samples.map(function (sm) {
          return { name: sm.name, qty: sm.qty, unit: sm.unit, modelCode: old[sm.name] || sm.modelCode || '' };
        });
      }
    });
    return rows;
  }

  /** 节点是否已过「样品收样」：优先按任务状态在流程阶段里的位置判断，状态未知按已过处理 */
  function isPastReceive(code) {
    var r = ROWS[String(code || '').trim()];
    var st = r && r[6];
    var order = global.FlowStages && global.FlowStages.FLOW_ORDER;
    if (st && order) {
      var i = order.indexOf(st);
      if (i >= 0) return i > order.indexOf('样品收样');
    }
    return true;
  }

  global.EntrustMock = {
    DEFAULT_CODE: DEFAULT_CODE, ROWS: ROWS, CUSTOMERS: CUSTOMERS, SAMPLE_META: SAMPLE_META,
    get: get, enrich: enrich, isPastReceive: isPastReceive, plusDays: plusDays, diffDays: diffDays, hash: hash
  };
})(window);
