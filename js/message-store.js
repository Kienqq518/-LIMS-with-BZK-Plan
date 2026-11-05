/**
 * 消息中心数据层
 *
 * 原则一：消息不写死。全部从原型里已有的真实数据现算——
 *   待办 / 超期 ← js/entrust-mock.js + js/flow-stages.js（与工作台数据概览、任务总览、委托统计同一口径）
 *   公告       ← js/notice-store.js（与快讯中心、通知公告同一份）
 *   设备校准    ← js/equip-store.js（与设备管理同一份）
 * 原则二：时间不写死。相对「现在」生成并落一次盘，之后复用，刷新不会看到消息时间越放越旧。
 * 原则三：已读状态是个人视图，落 localStorage，和列配置一样互不影响。
 *
 * 依赖按需注入：某个页面没引上面那几个 store 时，这里自动补载，保证
 * 在任何一页点铃铛，未读数和消息列表都一样。
 */
(function (global) {
  'use strict';

  var READ_KEY = 'lims-message-read-v1';
  var TIME_KEY = 'lims-message-time-v1';

  var TYPES = {
    todo:   { label: '待办提醒', icon: 'fa-file-text-o', color: '#0284c7' },
    warn:   { label: '超期预警', icon: 'fa-exclamation-triangle', color: '#dc2626' },
    notice: { label: '公告通知', icon: 'fa-bullhorn', color: '#d97706' },
    system: { label: '系统消息', icon: 'fa-wrench', color: '#7c3aed' }
  };
  var TYPE_ORDER = ['todo', 'warn', 'notice', 'system'];

  var POST_SIGN = ['报告签发', '报告处理', '收费审批', '报告发放', '任务归档', '任务完成'];
  var STAGE_ALIAS = { '': '委托登记', '待接收': '试验检测', '未领样': '试验检测', '已审核': '试验检测', '已完成': '任务完成' };

  /* ---------------- 依赖按需补载 ---------------- */
  var NEED = [
    { file: 'js/flow-stages.js', flag: 'FlowStages' },
    { file: 'js/entrust-mock.js', flag: 'EntrustMock' },
    { file: 'js/notice-store.js', flag: 'NoticeStore' },
    { file: 'js/equip-store.js', flag: 'EquipStore' },
    { file: 'js/web-perms.js', flag: 'WebPerms' }
  ];
  var loading = null;

  function loadOne(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { resolve(); };   // 拿不到就少这一类消息，不阻塞铃铛
      document.head.appendChild(s);
    });
  }
  function ensureDeps() {
    if (loading) return loading;
    var jobs = NEED.filter(function (n) { return !global[n.flag]; })
      .map(function (n) { return loadOne(n.file); });
    loading = Promise.all(jobs);
    return loading;
  }

  /* ---------------- 时间戳：首次生成后固定 ---------------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(offsetMin) {
    var d = new Date(Date.now() - offsetMin * 60000);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function timeMap() {
    var m = {};
    try { m = JSON.parse(global.localStorage.getItem(TIME_KEY) || '{}') || {}; } catch (e) { m = {}; }
    return m;
  }
  function saveTimeMap(m) {
    try { global.localStorage.setItem(TIME_KEY, JSON.stringify(m)); } catch (e) { /* 忽略 */ }
  }

  /* ---------------- 读状态 ---------------- */
  function readMap() {
    var m = {};
    try { m = JSON.parse(global.localStorage.getItem(READ_KEY) || '{}') || {}; } catch (e) { m = {}; }
    return m;
  }
  function saveReadMap(m) {
    try { global.localStorage.setItem(READ_KEY, JSON.stringify(m)); } catch (e) { /* 忽略 */ }
  }

  function stageOf(m) {
    var st = (m && m.status) || '';
    if (global.FlowStages && FlowStages.FLOW_ORDER.indexOf(st) >= 0) return st;
    if (POST_SIGN.indexOf(st) >= 0) return st;
    return STAGE_ALIAS[st] || '';
  }
  function isOverdue(m) {
    var st = stageOf(m);
    if (POST_SIGN.indexOf(st) >= 0) return false;      // 报告已签发及之后不算
    var d = String(m.requireDate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    var p = d.split('-');
    var today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(+p[0], +p[1] - 1, +p[2]) < today;
  }

  /* ---------------- 生成消息 ---------------- */
  function build() {
    var out = [];
    var times = timeMap(), timeDirty = false;
    function t(id, offsetMin) {
      if (!times[id]) { times[id] = stamp(offsetMin); timeDirty = true; }
      return times[id];
    }

    // ① 待办 / 超期：来自委托数据
    if (global.EntrustMock) {
      var list = Object.keys(EntrustMock.ROWS).map(function (code) {
        var m = EntrustMock.get(code);
        return { code: code, stage: stageOf(m), requireDate: m.requireDate || '', acceptDate: m.acceptDate || '', customer: m.customer || '/' };
      });
      var open = list.filter(function (r) { return POST_SIGN.indexOf(r.stage) < 0; });
      var lateAll = open.filter(isOverdue).sort(function (a, b) { return a.requireDate < b.requireDate ? -1 : 1; });
      /* 明细条与工作台「待办事项」同一条筛选：只排当年受理的委托；
       * 更早年份的只算进聚合条的总数，不占明细位 */
      var yNow = String(new Date().getFullYear());
      var inYear = function (r) { return String(r.acceptDate || '').slice(0, 4) === yNow; };
      var late = lateAll.filter(inYear);
      var soon = open.filter(inYear).sort(function (a, b) { return a.requireDate < b.requireDate ? -1 : 1; }).slice(0, 3);

      out.push({ id: 'todo-sum', type: 'todo', time: t('todo-sum', 18), href: 'entrust-preview.html',
        title: '待处理委托 ' + open.length + ' 张',
        body: '报告尚未全部签发完成的委托共 ' + open.length + ' 张，按期限升序在委托预览里可直接筛。' });
      soon.forEach(function (r, i) {
        out.push({ id: 'todo-' + r.code, type: 'todo', time: t('todo-' + r.code, 42 + i * 37), href: 'entrust-detail.html?code=' + encodeURIComponent(r.code),
          title: r.code + ' 停在「' + (r.stage || '/') + '」',
          body: r.customer + '，要求检测完成日期 ' + (r.requireDate || '/') + '，请推进到下一环节。' });
      });

      out.push({ id: 'warn-sum', type: 'warn', time: t('warn-sum', 96), href: 'entrust-preview.html',
        title: '超期委托 ' + lateAll.length + ' 张',
        body: '已过客户要求完成日期但报告还没签发完的委托共 ' + lateAll.length + ' 张（其中 ' + late.length +
          ' 张是 ' + yNow + ' 年受理、' + (lateAll.length - late.length) + ' 张更早年份受理），逾期最久的一张期限是 ' +
          (lateAll.length ? lateAll[0].requireDate : '/') + '。' });
      late.slice(0, 2).forEach(function (r, i) {
        out.push({ id: 'warn-' + r.code, type: 'warn', time: t('warn-' + r.code, 150 + i * 64), href: 'entrust-detail.html?code=' + encodeURIComponent(r.code),
          title: r.code + ' 已超期（期限 ' + r.requireDate + '）',
          body: r.customer + '，当前停在「' + (r.stage || '/') + '」，需要给出说明或加急处理。' });
      });
    }

    // ② 公告：与快讯中心、通知公告同一份数据；
    //    公告的查看权限 = 「通知公告」页面权限，和快讯中心「更多」同一份判定
    var canNotice = !global.WebPerms || WebPerms.can('通知公告');
    if (global.NoticeStore && canNotice) {
      NoticeStore.latest(4).forEach(function (n) {
        out.push({ id: 'notice-' + n.id, type: 'notice', time: n.createTime, href: 'notice-mgmt.html',
          title: n.title, body: String(n.body || '').split('\n')[0] + '（' + n.type + ' · ' + (n.operator || '/') + '）' });
      });
    }

    // ③ 设备校准：与设备管理同一份数据
    if (global.EquipStore) {
      var today = new Date(); today.setHours(0, 0, 0, 0);
      var due = EquipStore.listAll().filter(function (eq) {
        if (!eq.enabled || !eq.nextCalib) return false;
        var p = String(eq.nextCalib).split('-');
        return Math.round((new Date(+p[0], +p[1] - 1, +p[2]) - today) / 86400000) <= (Number(eq.warnDays) || 30);
      });
      if (due.length) {
        out.push({ id: 'equip-sum', type: 'system', time: t('equip-sum', 210), href: 'equip-mgmt.html',
          title: '设备校准到期 ' + due.length + ' 台',
          body: '下次校准日期已过期或进入预警期的在用设备共 ' + due.length + ' 台，请在设备管理里安排送检并回填校准报告。' });
        due.slice(0, 2).forEach(function (eq, i) {
          out.push({ id: 'equip-' + (eq.code || eq.id), type: 'system', time: t('equip-' + (eq.code || eq.id), 260 + i * 55), href: 'equip-mgmt.html',
            title: (eq.code || '') + ' ' + (eq.name || '') + ' 校准到期',
            body: '下次校准日期 ' + eq.nextCalib + '，预警提前 ' + (eq.warnDays || 30) + ' 天，当前状态「' + (eq.calibStatus || '/') + '」。' });
        });
      }
    }

    if (timeDirty) saveTimeMap(times);
    out.sort(function (a, b) { return a.time < b.time ? 1 : (a.time > b.time ? -1 : 0); });
    return out;
  }

  var cache = null;
  function list() { if (!cache) cache = build(); return cache; }

  global.MessageStore = {
    TYPES: TYPES,
    TYPE_ORDER: TYPE_ORDER,
    ready: ensureDeps,
    list: list,
    byType: function (type) { return type === 'all' ? list() : list().filter(function (m) { return m.type === type; }); },
    isRead: function (id) { return !!readMap()[id]; },
    unreadCount: function () { var r = readMap(); return list().filter(function (m) { return !r[m.id]; }).length; },
    unreadByType: function () {
      var r = readMap(), out = { all: 0 };
      TYPE_ORDER.forEach(function (k) { out[k] = 0; });
      list().forEach(function (m) { if (!r[m.id]) { out.all++; out[m.type] = (out[m.type] || 0) + 1; } });
      return out;
    },
    markRead: function (id) { var m = readMap(); m[id] = stamp(0); saveReadMap(m); },
    markAll: function () {
      var m = readMap(), ts = stamp(0);
      list().forEach(function (r) { m[r.id] = ts; });
      saveReadMap(m);
    },
    clearReadState: function () {
      try { global.localStorage.removeItem(READ_KEY); } catch (e) { /* 忽略 */ }
    },
    /** 数据变了（比如公告新增/委托状态推进）时重算 */
    refresh: function () { cache = null; return list(); }
  };

  ensureDeps().then(function () {
    // 依赖到齐后重算一次，保证首次打开铃铛看到的就是全量
    cache = null;
    list();
    if (global.document && document.dispatchEvent) {
      try { document.dispatchEvent(new CustomEvent('lims-message-ready')); } catch (e) { /* 忽略 */ }
    }
  });
})(window);
