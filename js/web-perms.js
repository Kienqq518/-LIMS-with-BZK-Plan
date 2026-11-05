/**
 * Web 端「角色 › 菜单权限」Mock
 * 对应真系统（TestOS）角色管理里那张菜单勾选矩阵：一个角色勾了哪些页面，
 * 没有勾的页面，用户就看不到入口、也进不去。
 *
 * 原型里已接入的判定点：
 *   工作台 › 快讯中心 ›「更多」——需要「通知公告」权限；
 *   通知公告页本身——没有权限的人打开只能看到无权限提示。
 *
 * 数据落在 localStorage，改完刷新仍然保留（和列配置一个套路）。
 */
(function (global) {
  'use strict';

  var STORE_KEY = 'lims-web-perms-v1';   // { roleKey: ['页面名', ...] }
  var USER_KEY = 'lims-web-current-role';

  /** 菜单树，与 index.html 左侧菜单一一对应（新增菜单时这里也要加） */
  var MENU = [
    { group: '工作台', items: [] },
    { group: '合同管理', items: ['委托预览', '框架合同', '委托登记', '委托确认', '费用审核', '变更申请', '变更审批', '变更记录'] },
    { group: '样品管理', items: ['样品收样', '样品制备', '样品发样', '还样确认', '申请退样', '样品退样', '合格打印'] },
    { group: '试验管理', items: ['试样分发', '试验检测', '组内审核', '数据审核', '标签打印'] },
    { group: '报告管理', items: ['报告编制', '报告审核', '报告签发', '报告处理', '收费审批', '报告发放', '任务归档', '任务完成', '原始记录'] },
    { group: '检测管理', items: ['大类管理', '样品分类', '样品数据', '判定规则', '报告判定', '模板管理'] },
    { group: '基础数据', items: ['设备管理', '人员资质', '代理管理', '客户管理', '场地管理', '工程管理'] },
    { group: '文件管理', items: ['标准管理', '作业指导书', '质量手册', '程序文件', '制度文件'] },
    { group: '基础配置', items: ['业务流程配置', '微信设置', '参数设置', '通知公告', '角色管理', '字典管理'] },
    { group: '日志管理', items: ['登录日志', '操作日志', '浏览记录'] }
  ];

  function allPages() {
    var out = [];
    MENU.forEach(function (g) { out = out.concat(g.items); });
    return out;
  }

  /** 演示角色：默认权限按「谁该看什么」给，通知公告只给系统管理员 */
  var ROLES = [
    { key: 'admin', name: '系统管理员', desc: '全部菜单，含通知公告与角色管理', all: true },
    { key: 'sample', name: '样品库管理员', desc: '样品与合同受理相关页面', items: [
      '委托预览', '委托登记', '委托确认', '费用审核', '变更申请', '变更审批', '变更记录',
      '样品收样', '样品制备', '样品发样', '还样确认', '申请退样', '样品退样', '合格打印',
      '标签打印', '样品分类', '样品数据', '客户管理', '场地管理', '业务流程配置', '参数设置', '字典管理'
    ] },
    { key: 'tester', name: '检测员', desc: '只做试验与记录，不看公告', items: [
      '试样分发', '试验检测', '原始记录', '样品数据', '设备管理', '作业指导书', '标准管理'
    ] },
    { key: 'report', name: '报告审核员', desc: '报告链条 + 判定，不看公告', items: [
      '报告编制', '报告审核', '报告签发', '报告处理', '报告判定', '判定规则', '原始记录', '模板管理', '标准管理'
    ] }
  ];

  function defaults() {
    var map = {};
    ROLES.forEach(function (r) { map[r.key] = r.all ? allPages() : r.items.slice(); });
    return map;
  }

  function loadAll() {
    var base = defaults();
    try {
      var raw = global.localStorage.getItem(STORE_KEY);
      if (raw) {
        var saved = JSON.parse(raw) || {};
        Object.keys(saved).forEach(function (k) {
          if (Object.prototype.toString.call(saved[k]) === '[object Array]') base[k] = saved[k];
        });
      }
    } catch (e) { /* 隐私模式或脏数据：退回默认权限 */ }
    return base;
  }

  function saveAll(map) {
    try { global.localStorage.setItem(STORE_KEY, JSON.stringify(map)); } catch (e) { /* 存不下就用内存值 */ }
  }

  function currentKey() {
    var k = '';
    try { k = global.localStorage.getItem(USER_KEY) || ''; } catch (e) { /* 忽略 */ }
    for (var i = 0; i < ROLES.length; i++) { if (ROLES[i].key === k) return k; }
    return 'admin';                       // 原型默认以系统管理员登录
  }

  function roleByKey(key) {
    for (var i = 0; i < ROLES.length; i++) { if (ROLES[i].key === key) return ROLES[i]; }
    return ROLES[0];
  }

  /** 某角色当前勾选的页面集合（对象，便于 O(1) 判断） */
  function grantedOf(key) {
    var list = loadAll()[key] || [];
    var set = {};
    list.forEach(function (p) { set[p] = true; });
    return set;
  }

  global.WebPerms = {
    MENU: MENU,
    ROLES: ROLES,
    allPages: allPages,
    roles: function () { return ROLES; },
    role: roleByKey,
    currentKey: currentKey,
    current: function () { return roleByKey(currentKey()); },
    setCurrent: function (key) {
      try { global.localStorage.setItem(USER_KEY, roleByKey(key).key); } catch (e) { /* 忽略 */ }
    },
    granted: function (key) { return grantedOf(key || currentKey()); },
    /** 当前登录角色能不能进某个页面 */
    can: function (page) { return !!grantedOf(currentKey())[page]; },
    save: function (key, pages) {
      var map = loadAll();
      map[roleByKey(key).key] = (pages || []).slice();
      saveAll(map);
    },
    resetAll: function () {
      try { global.localStorage.removeItem(STORE_KEY); } catch (e) { /* 忽略 */ }
    }
  };
})(window);
