/**
 * 客户管理主数据（原型）：单位档案 + 单位编码规则。
 * 客户管理页与委托登记共用，写入 localStorage。
 */
(function (global) {
  var CUSTOMER_KEY = 'lims.customers.v1';
  var RULE_KEY = 'lims.customerUnitCodeRule.v1';

  var DEFAULT_RULE = { tokens: [{ type: 'seq', digits: 6 }] };

  var DEFAULT_CUSTOMERS = [
    { id: 'c1', name: '杭州数蚕智能科技有限公司', code: '121001', type: '委托单位', region: '浙江省 / 杭州市 / 西湖区', address: '杭州市西湖区文三路西溪银座E层', zip: '310000', protocol: '', discount: '', remark: '', contacts: [
      { id: 'p11', name: '安可', dept: '市场营销部', phone: '17835503262', mobile: '17835503262', fax: '', email: '', remark: '' },
      { id: 'p12', name: '测试', dept: '市场营销部', phone: '15555555555', mobile: '15555555555', fax: '', email: '', remark: '' },
      { id: 'p13', name: '管理', dept: '', phone: '18888888888', mobile: '18888888888', fax: '', email: '', remark: '' }
    ] },
    { id: 'c2', name: '杭州微智能科技有限公司', code: '121002', type: '委托单位', region: '浙江省 / 杭州市 / 西湖区', address: '杭州市西湖区文三路', zip: '310012', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c3', name: '国网浙江省电力有限公司杭州供电公司', code: '121003', type: '委托单位', region: '浙江省 / 杭州市 / 上城区', address: '杭州市上城区建国中路', zip: '310009', protocol: '是', discount: '95', remark: '', contacts: [] },
    { id: 'c4', name: '合肥电力工程有限公司', code: '121004', type: '委托单位', region: '安徽省 / 合肥市 / 蜀山区', address: '合肥市蜀山区长江西路', zip: '230031', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c5', name: '福州送变电工程有限公司', code: '121005', type: '委托单位', region: '福建省 / 福州市 / 鼓楼区', address: '福州市鼓楼区五四路', zip: '350001', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c6', name: '浙江送变电工程有限公司', code: '121006', type: '委托单位', region: '浙江省 / 杭州市 / 滨江区', address: '杭州市滨江区网商路', zip: '310052', protocol: '是', discount: '90', remark: '', contacts: [] },
    { id: 'c7', name: '宁波电业局物资公司', code: '121007', type: '委托单位', region: '浙江省 / 宁波市 / 海曙区', address: '宁波市海曙区药行街', zip: '315000', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c8', name: '温州电力建设有限公司', code: '121008', type: '委托单位', region: '浙江省 / 温州市 / 鹿城区', address: '温州市鹿城区府前街', zip: '325000', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c9', name: '嘉兴供电公司', code: '121009', type: '委托单位', region: '浙江省 / 嘉兴市 / 南湖区', address: '嘉兴市南湖区中山东路', zip: '314000', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c10', name: '绍兴电力设备检测中心', code: '121010', type: '委托单位', region: '浙江省 / 绍兴市 / 越城区', address: '绍兴市越城区胜利路', zip: '312000', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c11', name: '湖州电力工程有限公司', code: '121011', type: '委托单位', region: '浙江省 / 湖州市 / 吴兴区', address: '湖州市吴兴区凤凰路', zip: '313000', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c12', name: '金华送变电工程公司', code: '121012', type: '委托单位', region: '浙江省 / 金华市 / 婺城区', address: '金华市婺城区双溪西路', zip: '321000', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c13', name: '台州电力安装有限公司', code: '121013', type: '委托单位', region: '浙江省 / 台州市 / 椒江区', address: '台州市椒江区市府大道', zip: '318000', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c14', name: '丽水供电公司', code: '121014', type: '委托单位', region: '浙江省 / 丽水市 / 莲都区', address: '丽水市莲都区解放街', zip: '323000', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c15', name: '舟山电力修造厂', code: '121015', type: '委托单位', region: '浙江省 / 舟山市 / 定海区', address: '舟山市定海区环城南路', zip: '316000', protocol: '', discount: '', remark: '', contacts: [] },
    { id: 'c16', name: '宇宙设想有限公司', code: '121016', type: '委托单位', region: '浙江省 / 杭州市 / 余杭区', address: '杭州市余杭区文一西路', zip: '311100', protocol: '', discount: '', remark: '', contacts: [] }
  ];

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return clone(fallback);
      return JSON.parse(raw);
    } catch (e) {
      return clone(fallback);
    }
  }

  function writeJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }

  function loadRule() {
    var rule = readJson(RULE_KEY, DEFAULT_RULE);
    if (!rule || !Array.isArray(rule.tokens) || !rule.tokens.length) return clone(DEFAULT_RULE);
    return rule;
  }

  function saveRule(rule) {
    writeJson(RULE_KEY, rule);
  }

  function loadCustomers() {
    var list = readJson(CUSTOMER_KEY, DEFAULT_CUSTOMERS);
    if (!Array.isArray(list) || !list.length) return clone(DEFAULT_CUSTOMERS);
    return list;
  }

  function saveCustomers(list) {
    writeJson(CUSTOMER_KEY, list);
  }

  function resetToDefault() {
    writeJson(CUSTOMER_KEY, DEFAULT_CUSTOMERS);
    writeJson(RULE_KEY, DEFAULT_RULE);
  }

  function displayLabel(c) {
    if (!c) return '';
    return (c.name || '') + '（' + (c.code || '') + '）';
  }

  function getPrefix(rule) {
    var p = '';
    (rule && rule.tokens || []).forEach(function (t) {
      if (t.type === 'seq') return;
      p += (t.value || '');
    });
    return p;
  }

  function getDigits(rule) {
    var t = (rule && rule.tokens || []).filter(function (x) { return x.type === 'seq'; })[0];
    return (t && Number(t.digits)) || 6;
  }

  function padNum(num, digits) {
    var s = String(num);
    while (s.length < digits) s = '0' + s;
    return s;
  }

  function matchesRule(code, rule) {
    var prefix = getPrefix(rule);
    if (!code) return false;
    if (prefix) {
      if (code.indexOf(prefix) !== 0) return false;
      return /^\d+$/.test(code.slice(prefix.length));
    }
    return /^\d+$/.test(code);
  }

  function extractSeq(code, rule) {
    var prefix = getPrefix(rule);
    var rest = prefix ? code.slice(prefix.length) : code;
    return parseInt(rest, 10);
  }

  function nextCode(customers, rule) {
    var prefix = getPrefix(rule);
    var digits = getDigits(rule);
    var maxN = 0;
    var found = false;
    (customers || []).forEach(function (c) {
      if (!matchesRule(c.code, rule)) return;
      found = true;
      var n = extractSeq(c.code, rule);
      if (!isNaN(n)) maxN = Math.max(maxN, n);
    });
    var n = found ? maxN + 1 : 1;
    var occupied = {};
    (customers || []).forEach(function (c) { if (c.code) occupied[c.code] = true; });
    var code = prefix + padNum(n, digits);
    while (occupied[code]) {
      n += 1;
      code = prefix + padNum(n, digits);
    }
    return code;
  }

  function previewByRule(customers, rule) {
    try { return nextCode(customers, rule); } catch (e) { return '—'; }
  }

  function isCodeTaken(customers, code, excludeId) {
    return (customers || []).some(function (c) {
      return c.code === code && c.id !== excludeId;
    });
  }

  function findNameRegionDups(customers, name, region, excludeId) {
    var n = (name || '').replace(/^\s+|\s+$/g, '');
    var r = region || '';
    if (!n || !r) return [];
    return (customers || []).filter(function (c) {
      if (excludeId && c.id === excludeId) return false;
      return (c.name || '').replace(/^\s+|\s+$/g, '') === n && c.region === r;
    });
  }

  function validateRule(rule) {
    var tokens = (rule && rule.tokens) || [];
    if (!tokens.length) return '至少添加一段令牌';
    var seqIdx = -1;
    var seqCount = 0;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type === 'seq') {
        seqCount += 1;
        seqIdx = i;
        var d = Number(t.digits);
        if ([2, 3, 4, 5, 6].indexOf(d) < 0) return '自增序号位数须为 2 / 3 / 4 / 5 / 6';
      } else {
        var v = (t.value || '').replace(/^\s+|\s+$/g, '');
        if (!v) return '指定字符不能为空';
        if (v.length > 20) return '指定字符不超过 20 个字符';
        if (/\s/.test(v)) return '指定字符不允许空格';
      }
    }
    if (seqCount !== 1) return '必须且仅能有一段自增序号';
    if (seqIdx !== tokens.length - 1) return '自增序号必须是最后一段';
    return '';
  }

  function newId(prefix) {
    return (prefix || 'c') + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  }

  global.CustomerStore = {
    DEFAULT_RULE: DEFAULT_RULE,
    loadRule: loadRule,
    saveRule: saveRule,
    loadCustomers: loadCustomers,
    saveCustomers: saveCustomers,
    resetToDefault: resetToDefault,
    displayLabel: displayLabel,
    getPrefix: getPrefix,
    getDigits: getDigits,
    nextCode: nextCode,
    previewByRule: previewByRule,
    isCodeTaken: isCodeTaken,
    findNameRegionDups: findNameRegionDups,
    validateRule: validateRule,
    matchesRule: matchesRule,
    newId: newId
  };
})(window);
