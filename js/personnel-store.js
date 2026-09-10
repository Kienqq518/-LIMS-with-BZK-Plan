/**
 * 人员资质 Mock Store（基础数据 · 人员资质）
 *
 * 数据来源说明：
 *  - 人员基本信息（姓名 / 账号 / 部门 / 联系方式）来自底座「角色管理 → 试验员 → 分配用户」，
 *    本页只读同步，不在此维护；
 *  - 底座角色中已删除的试验员：本页保留资质台账并标「已离岗」，台账只读；
 *    检测流程选人只出在岗人员（active !== false）。
 *  - 资质证书 / 操作授权 / 培训考核记录 由实验室在本页维护，直接支撑透明报告「人」维度公开内容。
 *  - 操作授权按「人 → 设备」绑定；试验项只读取自设备管理的关联试验。
 *    级别：可独立操作 / 协助操作（两档都可被派检测任务）。
 */
(function (global) {
  var STORAGE_KEY = 'lims-personnel-store-v3';
  var AUTH_LEVELS = ['可独立操作', '协助操作'];

  var DEPTS = ['电气检测组', '材料检测组', '力学检测组', '综合检测组'];

  function defaultSeed() {
    return [
      {
        id: 'p_sunli', name: '孙丽', account: 'sunli', dept: '电气检测组',
        phone: '18800001112', email: 'sunli@lims.com', roleFrom: '底座·试验员', certNo: 'SL-2023-041', active: true,
        certs: [
          { id: 'c1', name: '高压电气试验员资格证', no: 'ZJ-HV-2023-0418', category: '高压电气试验', org: '浙江省电力行业协会', issueAt: '2023-04-18', validTo: '2026-12-31', file: '高压电气试验员资格证.pdf' },
          { id: 'c2', name: '工频耐压试验装置操作能力证', no: 'OP-YQ078-2025-06', category: '设备操作能力', org: '本实验室内部授权', issueAt: '2025-06-01', validTo: '2027-06-30', file: '工频耐压装置操作能力证.pdf' }
        ],
        auths: [
          { id: 'a1', equipId: 'eq_yfg150', equip: '[YFG-150A] 绝缘安全工器具试验装置', level: '可独立操作', by: '陈建国', at: '2025-06-05', validTo: '2027-06-30' },
          { id: 'a2', equipId: 'eq_lx05', equip: '[LX-05] 微机控制电子万能试验机', level: '可独立操作', by: '陈建国', at: '2025-06-05', validTo: '2027-06-30' },
          { id: 'a3', equipId: 'eq_ybkc02', equip: '[YBKC-02] 数显卡尺', level: '可独立操作', by: '陈建国', at: '2025-06-05', validTo: '2027-06-30' }
        ],
        trainings: [
          { id: 't1', name: '高压试验安全操作培训', type: '培训', at: '2023-03-20', result: '合格', score: '95', validTo: '', file: '培训签到与考核.pdf' },
          { id: 't2', name: '2025 年度检测能力验证', type: '考核', at: '2025-11-12', result: '通过', score: '优秀', validTo: '2026-11-30', file: '能力验证报告.pdf' }
        ]
      },
      {
        id: 'p_chenhao', name: '陈昊', account: 'chenhao', dept: '电气检测组',
        phone: '13800002221', email: '', roleFrom: '底座·试验员', certNo: 'CH-2024-018', active: true,
        certs: [
          { id: 'c1', name: '高压电气试验员资格证', no: 'ZJ-HV-2024-0662', category: '高压电气试验', org: '浙江省电力行业协会', issueAt: '2024-06-01', validTo: '2027-05-31', file: '高压电气试验员资格证.pdf' },
          { id: 'c2', name: '工频耐压试验装置操作能力证', no: 'OP-YQ078-2025-11', category: '设备操作能力', org: '本实验室内部授权', issueAt: '2025-11-01', validTo: '2027-06-30', file: '操作能力证.pdf' }
        ],
        auths: [
          { id: 'a1', equipId: 'eq_yfg150', equip: '[YFG-150A] 绝缘安全工器具试验装置', level: '可独立操作', by: '陈建国', at: '2025-11-05', validTo: '2027-06-30' },
          { id: 'a2', equipId: 'eq_ybkc03', equip: '[YBKC-03] 数显卡尺', level: '协助操作', by: '陈建国', at: '2025-11-05', validTo: '2027-06-30' }
        ],
        trainings: [
          { id: 't1', name: '高压试验安全操作培训', type: '培训', at: '2024-04-15', result: '合格', score: '90', validTo: '', file: '培训记录.pdf' }
        ]
      },
      {
        id: 'p_zhangwei', name: '张伟', account: 'zhangwei', dept: '电气检测组',
        phone: '18812345678', email: 'zw@lims.com', roleFrom: '底座·试验员', certNo: 'ZW-2024-018', active: true,
        certs: [
          { id: 'c1', name: '高压电气试验员资格证', no: 'ZJ-HV-2024-018', category: '高压电气试验', org: '浙江省电力行业协会', issueAt: '2024-01-10', validTo: '2026-12-31', file: '资格证.pdf' },
          { id: 'c2', name: '工频耐压试验装置操作能力证', no: 'OP-YQ035-2025-06', category: '设备操作能力', org: '本实验室内部授权', issueAt: '2025-06-01', validTo: '2027-06-30', file: '操作能力证.pdf' }
        ],
        auths: [
          { id: 'a1', equipId: 'eq_yfg150', equip: '[YFG-150A] 绝缘安全工器具试验装置', level: '协助操作', by: '陈建国', at: '2025-06-10', validTo: '2027-06-30' }
        ],
        trainings: [
          { id: 't1', name: '年度复训与考核', type: '考核', at: '2025-09-01', result: '通过', score: '合格', validTo: '2026-09-30', file: '' }
        ]
      },
      {
        id: 'p_liqiang', name: '李强', account: 'liqiang', dept: '力学检测组',
        phone: '15855556966', email: '', roleFrom: '底座·试验员', certNo: 'LQ-2022-006', active: true,
        certs: [
          { id: 'c1', name: '力学检测员资格证', no: 'ML-2022-0106', category: '力学检测', org: '浙江省质量技术协会', issueAt: '2022-05-01', validTo: '2026-10-20', file: '力学检测员资格证.pdf' }
        ],
        auths: [
          { id: 'a1', equipId: 'eq_lx05', equip: '[LX-05] 微机控制电子万能试验机', level: '可独立操作', by: '陈建国', at: '2024-05-01', validTo: '2026-10-20' }
        ],
        trainings: [
          { id: 't1', name: '力学试验机操作培训', type: '培训', at: '2022-04-20', result: '合格', score: '88', validTo: '', file: '' }
        ]
      },
      {
        id: 'p_zhoumei', name: '周梅', account: 'zhoumei', dept: '综合检测组',
        phone: '13052536314', email: '', roleFrom: '底座·试验员', certNo: '', active: true,
        certs: [],
        auths: [
          { id: 'a1', equipId: 'eq_ybkc03', equip: '[YBKC-03] 数显卡尺', level: '协助操作', by: '陈建国', at: '2026-07-08', validTo: '2027-07-08' }
        ],
        trainings: [
          { id: 't1', name: '新员工入职培训', type: '培训', at: '2026-07-01', result: '合格', score: '', validTo: '', file: '' }
        ]
      },
      {
        id: 'p_liuyang', name: '刘洋', account: 'liuyang', dept: '电气检测组',
        phone: '13700008881', email: '', roleFrom: '底座·试验员', certNo: 'LY-2021-012', active: false,
        certs: [
          { id: 'c1', name: '高压电气试验员资格证', no: 'ZJ-HV-2021-012', category: '高压电气试验', org: '浙江省电力行业协会', issueAt: '2021-03-01', validTo: '2026-12-31', file: '资格证-刘洋.pdf' }
        ],
        auths: [
          { id: 'a1', equipId: 'eq_yfg150', equip: '[YFG-150A] 绝缘安全工器具试验装置', level: '可独立操作', by: '陈建国', at: '2021-06-01', validTo: '2026-12-31' }
        ],
        trainings: [
          { id: 't1', name: '高压试验安全操作培训', type: '培训', at: '2021-02-15', result: '合格', score: '92', validTo: '', file: '' }
        ]
      }
    ];
  }

  /** 底座当前「试验员」角色用户（原型：刘洋已从角色中移除） */
  var BASE_ROSTER = [
    { account: 'sunli', name: '孙丽', dept: '电气检测组', phone: '18800001112' },
    { account: 'chenhao', name: '陈昊', dept: '电气检测组', phone: '13800002221' },
    { account: 'zhangwei', name: '张伟', dept: '电气检测组', phone: '18812345678' },
    { account: 'liqiang', name: '李强', dept: '力学检测组', phone: '15855556966' },
    { account: 'zhoumei', name: '周梅', dept: '综合检测组', phone: '13052536314' }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) { /* ignore */ }
    var seed = defaultSeed();
    save(seed);
    return seed;
  }
  function save(list) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ } }
  function listAll() { return load(); }
  function findById(id) { return load().find(function (p) { return p.id === id; }) || null; }
  function upsert(row) {
    var list = load();
    var idx = list.findIndex(function (p) { return p.id === row.id; });
    if (idx >= 0) list[idx] = row; else list.push(row);
    save(list);
    return row;
  }

  /** 资质/授权状态：有效 / 临期(≤60天) / 已过期 */
  function statusOf(validTo, warnDays) {
    if (!validTo) return { key: 'none', text: '长期有效' };
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var d = new Date(validTo);
    var diff = Math.round((d - today) / 86400000);
    if (diff < 0) return { key: 'expired', text: '已过期' };
    if (diff <= (warnDays || 60)) return { key: 'warn', text: '临期 ' + diff + ' 天' };
    return { key: 'valid', text: '有效' };
  }

  /** 汇总一个人的资质总体状态：缺失 > 过期 > 临期 > 有效 */
  function overallStatus(p) {
    if (!p.certs || !p.certs.length) return { key: 'missing', text: '资质缺失' };
    var worst = 'valid';
    var order = { valid: 0, warn: 1, expired: 2 };
    p.certs.forEach(function (c) {
      var s = statusOf(c.validTo).key;
      if (s !== 'none' && order[s] > order[worst]) worst = s;
    });
    return worst === 'expired' ? { key: 'expired', text: '证书过期' }
      : worst === 'warn' ? { key: 'warn', text: '证书临期' }
        : { key: 'valid', text: '正常' };
  }

  function isOnRoster(p) { return !!(p && p.active !== false); }
  function listOnRoster() { return load().filter(isOnRoster); }

  /**
   * 按底座试验员角色同步：新增、覆盖基本信息、恢复在岗；
   * 角色中已不存在的人保留台账并标已离岗。不删三类资质。
   */
  function syncFromBase() {
    var list = load();
    var byAcc = {};
    list.forEach(function (p) { if (p.account) byAcc[p.account] = p; });
    var seen = {};
    var added = 0;
    BASE_ROSTER.forEach(function (b) {
      seen[b.account] = true;
      var p = byAcc[b.account];
      if (!p) {
        list.push({
          id: 'p_' + b.account, name: b.name, account: b.account, dept: b.dept,
          phone: b.phone || '', email: '', roleFrom: '底座·试验员', certNo: '', active: true,
          certs: [], auths: [], trainings: []
        });
        added++;
      } else {
        p.name = b.name;
        p.dept = b.dept;
        p.phone = b.phone || '';
        p.active = true;
      }
    });
    var markedOff = 0;
    list.forEach(function (p) {
      if (p.account && !seen[p.account] && p.active !== false) markedOff++;
      if (p.account && !seen[p.account]) p.active = false;
    });
    save(list);
    var on = list.filter(isOnRoster).length;
    var off = list.length - on;
    return { added: added, markedOff: markedOff, on: on, off: off, total: list.length };
  }

  function rosterNames() {
    return listOnRoster().map(function (p) { return p.name; });
  }

  /** 从候选姓名中只保留在岗；若一个都不在岗则取在岗名单前 max 个 */
  function pickRosterNames(preferred, max) {
    var allowed = rosterNames();
    var cap = max > 0 ? max : allowed.length;
    var out = (preferred || []).filter(function (name) { return allowed.indexOf(name) !== -1; });
    if (!out.length && allowed.length) return allowed.slice(0, cap);
    return out.slice(0, cap);
  }

  function equipLabelOf(equipId, fallback) {
    if (global.EquipStore && equipId) {
      var d = global.EquipStore.findById(equipId);
      if (d) return global.EquipStore.displayLabel(d);
    }
    return fallback || '';
  }

  function linkedTestsOf(equipId) {
    if (!global.EquipStore || !equipId) return [];
    var d = global.EquipStore.findById(equipId);
    return (d && d.linkedTests) ? d.linkedTests.slice() : [];
  }

  global.PersonnelStore = {
    DEPTS: DEPTS,
    AUTH_LEVELS: AUTH_LEVELS,
    load: load, save: save, listAll: listAll, findById: findById, upsert: upsert,
    statusOf: statusOf, overallStatus: overallStatus, isOnRoster: isOnRoster,
    listOnRoster: listOnRoster, rosterNames: rosterNames, pickRosterNames: pickRosterNames,
    syncFromBase: syncFromBase, clone: clone,
    equipLabelOf: equipLabelOf, linkedTestsOf: linkedTestsOf,
    reset: function () { var s = defaultSeed(); save(s); return s; }
  };
})(window);
