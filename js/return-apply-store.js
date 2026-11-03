/* 退样申请共享存储（申请退样页写入 → 样品退样页消费 → 退样完成置 returned）
 * 一条申请 = 一次「确认」提交，可含多件样品；每件样品各自记录退样结果。
 * 本地 key：lims.returnApply
 */
(function (global) {
  var KEY = 'lims.returnApply';
  var doc = global.document;

  function load() {
    try { return JSON.parse(global.localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function save(list) {
    try { global.localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 原型忽略 */ }
  }

  /* 演示种子：只补不覆盖（按 委托编号 + 样品名 去重），保证两页开箱即有数据 */
  function seedDemo(applies) {
    var list = load();
    var have = {};
    list.forEach(function (rec) {
      (rec.lines || []).forEach(function (l) { have[rec.code + '|' + l.name] = 1; });
    });
    var added = 0;
    (applies || []).forEach(function (rec) {
      var lines = (rec.lines || []).filter(function (l) { return !have[rec.code + '|' + l.name]; });
      if (!lines.length) return;
      lines.forEach(function (l) { have[rec.code + '|' + l.name] = 1; l.returned = !!l.returned; });
      var copy = JSON.parse(JSON.stringify(rec));
      copy.lines = lines;
      copy.id = 'DEMO' + Date.now() + '-' + added;
      copy.appliedAt = copy.appliedAt || (lines[0] && lines[0].returnDate) || '2026-10-08 08:48:07';
      copy.demo = true;
      list.push(copy); added++;
    });
    if (added) save(list);
    return added;
  }

  /* 样品退样页的演示申请：0024 绝缘操作杆、0030 安全带 */
  function seedDemoIfEmpty() {
    return seedDemo([
      { code: 'SC2026/0024', customer: '杭州数蚕智能科技有限公司', operator: 'admin',
        lines: [{ name: '绝缘操作杆--(1)个', qty: '1', unit: '个', deleted: false, images: [],
                  returner: 'admin', returnDate: '2026-10-08 08:48:07', doc: 'SC2026-0024退样申请表.docx', returned: false }] },
      { code: 'SC2026/0030', customer: '东集西造有限公司', operator: 'admin',
        lines: [{ name: '安全带--(1)个', qty: '1', unit: '个', deleted: false, images: [],
                  returner: 'admin', returnDate: '2026-10-09 10:05:12', doc: 'SC2026-0030退样申请表.docx', returned: false }] }
    ]);
  }

  function addApply(payload) {
    var list = load();
    var rec = JSON.parse(JSON.stringify(payload));
    rec.id = 'RA' + Date.now();
    rec.appliedAt = now();
    rec.lines.forEach(function (l) { l.returned = false; });
    list.push(rec);
    save(list);
    return rec;
  }

  function now() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* 待退样行：未 returned 的都算，可按委托编号过滤 */
  function pendingLines(code) {
    var out = [];
    load().forEach(function (rec) {
      if (code && rec.code !== code) return;
      (rec.lines || []).forEach(function (l) {
        if (!l.returned) out.push({ code: rec.code, customer: rec.customer, operator: rec.operator, apply: rec, line: l });
      });
    });
    return out;
  }

  function pendingCount(code) { return pendingLines(code).length; }

  /* 已申请过的样品名 → 状态（applied 待退样 / returned 已退样），用于禁止重复申请 */
  function appliedMap(code) {
    var map = {};
    load().forEach(function (rec) {
      if (rec.code !== code) return;
      (rec.lines || []).forEach(function (l) { map[l.name] = l.returned ? 'returned' : 'applied'; });
    });
    return map;
  }

  function markReturned(code, name, info) {
    var list = load(), n = 0;
    list.forEach(function (rec) {
      if (rec.code !== code) return;
      (rec.lines || []).forEach(function (l) {
        if (l.name === name && !l.returned) { l.returned = true; l.returnInfo = info; l.returnedAt = now(); n++; }
      });
    });
    save(list);
    return n;
  }

  global.ReturnApplyStore = {
    KEY: KEY, load: load, save: save, seedDemo: seedDemo, seedDemoIfEmpty: seedDemoIfEmpty,
    addApply: addApply, pendingLines: pendingLines, pendingCount: pendingCount,
    appliedMap: appliedMap, markReturned: markReturned, now: now
  };
})(window);
