/**
 * 全链路退回记录：returns[] 追加不覆盖。
 * { from, to, by, time, reason, kind }  kind = 人工 / AI / 系统
 */
(function (global) {
  var STORAGE_KEY = 'lims-returns-v11';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function now() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function actor() {
    var u = global.LimsCurrentUser || global.CURRENT_USER;
    return (u && (u.name || u.displayName)) || 'admin';
  }
  function normKind(k) {
    if (!k) return '人工';
    var s = String(k);
    if (s === 'ai' || s === 'AI' || /AI/.test(s)) return 'AI';
    if (s === 'system' || s === '系统') return '系统';
    if (s === 'manual' || s === '人工') return '人工';
    return s;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var SEED = [
    { code: 'SC2026/0209', from: '委托确认', to: '委托登记', by: '梁倩', time: '2026-11-18 09:12', reason: '客户单位与合同主体不一致，请更正后重新提交。', kind: '人工' },
    { code: 'SC2026/0208', from: '样品收样', to: '委托登记', by: '王样品', time: '2026-11-17 16:40', reason: '规格填写不完整，收样无法核对型号。', kind: '人工' },
    { code: 'SC2026/0059', from: '费用审核', to: '委托确认', by: '赵财务', time: '2026-11-16 11:08', reason: '检测项目收费与委托项目不一致，请确认后再审。', kind: '人工' },
    { code: 'SC2026/0057', from: '样品制备', to: '费用审核', by: '张三', time: '2026-11-15 14:22', reason: '制样发现收费项目漏项，退回费用审核补录。', kind: '人工' },
    { code: 'SC2026/0167', from: '样品发样', to: '样品制备', by: '孙发样', time: '2026-11-14 10:05', reason: '试样标识与制备记录对不上，请重新制备贴标。', kind: '人工' },
    {
      code: 'SC2026/0088', from: '试样分发', to: '样品发样', by: '李四', time: '2026-11-13 16:05',
      reason: '安全绳实到数量少 1 条，无法按任务领样。', kind: '人工',
      testers: [
        { tester: '潘哲宁', time: '2026-11-13 15:30', reason: '领样人与发样记录不符，请重新发样。' },
        { tester: '李四', time: '2026-11-13 16:05', reason: '安全绳实到数量少 1 条，无法按任务领样。' }
      ]
    },
    {
      code: 'SC2026/0085', from: '试验检测', to: '试样分发', by: '潘哲宁', time: '2026-11-18 10:20',
      reason: '试样编号与任务单不符，请重新分发。', kind: '人工',
      testers: [
        { tester: '潘哲宁', time: '2026-11-18 10:20', reason: '试样编号与任务单不符，请重新分发。' },
        { tester: '李四', time: '2026-11-18 11:05', reason: '领样数量不足，缺 2 件。' }
      ]
    },
    {
      code: 'SC2026/0052', from: '组内审核', to: '试验检测', by: '王审核', time: '2026-11-12 16:10',
      reason: '交流耐压试验值与原始记录不一致，请复核后重填。', kind: '人工',
      item: '交流耐压试验', sample: '绝缘操作杆', tester: '潘哲宁', detectTime: '2026-11-12 15:40',
      rows: [
        { specimen: 'SC2026/00520102-01', phase: '' },
        { specimen: 'SC2026/00520107-01', phase: '' }
      ]
    },
    {
      code: 'SC2026/0052', from: '数据审核', to: '试验检测', by: '李数据', time: '2026-11-12 16:28',
      reason: '交流耐压试验值低于标称值，请复核后重填。', kind: '人工',
      item: '交流耐压试验', sample: '绝缘操作杆', tester: '潘哲宁', detectTime: '2026-11-12 15:40',
      rows: [
        { specimen: 'SC2026/00520102-01', phase: '' },
        { specimen: 'SC2026/00520107-01', phase: '' }
      ]
    },
    {
      code: 'SC2026/0062', from: '数据审核', to: '试验检测', by: '李数据', time: '2026-11-11 09:40',
      reason: '交流耐压原始记录结论与审核意见不一致。', kind: '人工',
      item: '交流耐压试验', sample: '绝缘硬梯', tester: '潘哲宁', detectTime: '2026-11-11 09:10',
      rows: [
        { specimen: 'SC2026/00620202-02', phase: '红' }
      ]
    },
    {
      code: 'SC2026/0060', from: '数据审核', to: '试验检测', by: '李数据', time: '2026-11-19 15:22',
      reason: '抗弯试验原始记录缺检测员签字，退回试验检测复核补签。', kind: '人工',
      item: '抗弯动负荷试验', sample: '绝缘操作杆', tester: '李四', detectTime: '2026-11-19 14:50',
      rows: [
        { specimen: 'SC2026/00600104-03', phase: '' }
      ]
    },
    {
      code: 'SC2026/0055', from: '报告编制', to: '数据审核', by: '王编制', time: '2026-11-20 10:08',
      reason: '绝缘毯外观结论与数据审核意见不一致，请数据审核复核后重新出具。', kind: '人工'
    },
    { code: 'SC2026/0238', from: '报告审核', to: '报告编制', by: '李审核', time: '2026-09-03 11:05', reason: '签名页签章位置不符模板，需按机构模板重排。', kind: '人工', reportNo: 'SC2026/0238-02' },
    { code: 'SC2026/0238', from: '报告审核', to: '报告编制', by: 'AI 审核引擎', time: '2026-09-03 10:15', reason: 'L1-b-1 检测/审核/批准签名位不完整', kind: 'AI', reportNo: 'SC2026/0238-03' },
    { code: 'SC2026/0238', from: '报告签发', to: '报告审核', by: '周签发', time: '2026-09-05 09:15', reason: '结论页检测结论措辞与检测数据口径不一致，退回报告审核核实后再签发。', kind: '人工', reportNo: 'SC2026/0238-04' },
    { code: 'SC2026/0312', from: '报告处理', to: '报告签发', by: '王处理', time: '2026-11-20 14:30', reason: '签发章位置与机构授权范围不符，退回签发重新核验。', kind: '人工', reportNo: 'SC2026/0312-01' },
    { code: 'SC2026/0190', from: '收费审批', to: '报告处理', by: '赵财务', time: '2026-11-10 09:40', reason: '处理范围与收费清单不一致，请重新勾选后再收费。', kind: '人工', reportNo: 'SC2026-0190-01' },
    { code: 'SC2026/0285', from: '报告发放', to: '收费审批', by: '孙发放', time: '2026-11-09 14:18', reason: '收费未结清，暂不能发放，退回收费审批。', kind: '人工', reportNo: 'SC2026-0285-01' },
    { code: 'SC2026/0166', from: '任务归档', to: '报告发放', by: 'admin', time: '2026-11-08 11:02', reason: '快递单号填写错误，退回发放更正。', kind: '人工' }
  ];

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.items && saved.items.length) return saved.items;
      }
    } catch (e) { /* ignore */ }
    return clone(SEED);
  }
  function save(items) {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: items })); } catch (e) { /* ignore */ }
  }

  var items = load();

  function normalizeRows(rows) {
    if (!rows || !rows.length) return null;
    return rows.map(function (row) {
      if (typeof row === 'string') return { specimen: row, phase: '' };
      return { specimen: (row && row.specimen) || '', phase: (row && row.phase) || '' };
    });
  }
  function rowsOf(rec) {
    if (!rec) return [];
    if (rec.rows && rec.rows.length) return rec.rows;
    if (rec.specimen) return [{ specimen: rec.specimen, phase: rec.phase || '' }];
    return [];
  }
  function normalize(entry) {
    if (!entry) return null;
    return {
      id: entry.id || ('ret-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
      code: entry.code || '',
      from: entry.from || '',
      to: entry.to || '',
      by: entry.by || actor(),
      time: entry.time || now(),
      reason: entry.reason || '',
      kind: normKind(entry.kind),
      testers: entry.testers || null,
      item: entry.item || '',
      sample: entry.sample || '',
      tester: entry.tester || '',
      detectTime: entry.detectTime || '',
      reportNo: entry.reportNo || '',
      specimen: entry.specimen || '',
      phase: entry.phase || '',
      rows: normalizeRows(entry.rows)
    };
  }

  function push(entry) {
    var rec = normalize(entry);
    if (!rec || !rec.code) return null;
    items.push(rec);
    save(items);
    return rec;
  }

  function listByTo(to, code) {
    return items.filter(function (r) {
      if (to && r.to !== to) return false;
      if (code && r.code !== code) return false;
      return true;
    }).sort(function (a, b) { return a.time < b.time ? 1 : -1; });
  }
  function listByCode(code) {
    return items.filter(function (r) { return r.code === code; })
      .sort(function (a, b) { return a.time < b.time ? 1 : -1; });
  }
  function latestFor(code, to) {
    var list = listByTo(to, code);
    return list[0] || null;
  }
  function listByItem(code, item, sample) {
    return items.filter(function (r) {
      if (r.code !== code || !r.item) return false;
      if (sample && r.sample && r.sample !== sample) return false;
      if (!item) return true;
      return r.item === item || String(item).indexOf(r.item) >= 0 || String(r.item).indexOf(item) >= 0;
    }).sort(function (a, b) { return a.time < b.time ? 1 : -1; });
  }
  function rowAffected(code, opts) {
    opts = opts || {};
    return listByItem(code, opts.item || '', opts.sample || '').some(function (r) {
      var rows = rowsOf(r);
      if (!rows.length) return false;
      return rows.some(function (row) {
        if (row.phase) return !!opts.phase && row.phase === opts.phase;
        return !!opts.specimen && row.specimen === opts.specimen;
      });
    });
  }
  function codesAt(to) {
    var map = {};
    listByTo(to).forEach(function (r) { map[r.code] = true; });
    return Object.keys(map);
  }

  global.ReturnStore = {
    STORAGE_KEY: STORAGE_KEY,
    now: now,
    actor: actor,
    normKind: normKind,
    push: push,
    listByTo: listByTo,
    listByCode: listByCode,
    latestFor: latestFor,
    listByItem: listByItem,
    rowsOf: rowsOf,
    rowAffected: rowAffected,
    codesAt: codesAt,
    all: function () { return items; },
    reset: function () { items = clone(SEED); save(items); return items; }
  };
})(window);
