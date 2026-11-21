/**
 * 报告签发 → 任务完成 流转 Mock
 * 编制 / 审核通过后进入本链；状态落 localStorage，刷新不丢。
 */
(function (global) {
  var STORAGE_KEY = 'lims-report-flow-v1';
  var ORDER = ['报告签发', '报告处理', '收费审批', '报告发放', '任务归档', '任务完成'];

  function reports(code, n, at) {
    n = n || 1;
    var out = [];
    for (var i = 1; i <= n; i++) {
      var no = code.replace('/', '-') + '-' + String(i).padStart(2, '0');
      out.push({
        id: no, no: no, name: no + '检测报告.docx', pdf: no + '检测报告.pdf', at: at
      });
    }
    return out;
  }
  function recs(code, names, at) {
    return names.map(function (n, i) {
      return { name: (n.indexOf('.docx') > 0 ? n : code.replace(/\D/g, '') + n + '.docx'), at: at };
    });
  }
  function row(o) {
    return {
      code: o.code, contract: o.contract || '/', customer: o.customer, sample: o.sample,
      sendDate: o.sendDate, requireDate: o.requireDate, acceptDate: o.acceptDate,
      prepaid: o.prepaid || '否', priority: o.priority || '常规', compiler: o.compiler || 'admin',
      status: o.status, contact: o.contact || '张三', phone: o.phone || '18888888888',
      address: o.address || '杭州市西湖区文三路159号东部软件园2号楼402室',
      reports: o.reports || reports(o.code, 1, o.at || (o.acceptDate + ' 13:30:00')),
      records: o.records || recs(o.code, [o.sample + '试验记录单.docx'], o.at || (o.acceptDate + ' 13:30:00')),
      ship: o.ship || null,
      logs: o.logs || []
    };
  }

  var SEED = [
    row({ code: 'SC2026/0238', customer: '杭州数蚕智能科技有限公司', sample: '10kV3芯电力电缆',
      sendDate: '2026-09-01', requireDate: '2026-09-10', acceptDate: '2026-09-01',
      status: '报告签发', at: '2026-09-03 10:20:00',
      reports: reports('SC2026/0238', 1, '2026-09-03 10:20:11'),
      records: [{ name: 'SC2026023801导体电阻试验记录单.docx', at: '2026-09-01 15:20:08' }],
      logs: [{ at: '2026-09-03 10:20', node: '报告审核', by: '李审核', text: '审核通过，提交报告签发' }] }),
    row({ code: 'SC2026/0256', customer: '远东电缆股份有限公司', sample: '8.7/10kV 电力电缆',
      sendDate: '2026-07-17', requireDate: '2026-07-28', acceptDate: '2026-07-17',
      status: '报告签发', at: '2026-07-17 13:33:21',
      reports: reports('SC2026/0256', 1, '2026-07-17 13:33:21'),
      records: [{ name: 'SC202607001吊装带-静负荷试验记录单.docx', at: '2026-07-17 13:30:28' }] }),
    row({ code: 'SC2026/0439', customer: '贵州送变电有限公司', sample: '绝缘手套 10kV',
      sendDate: '2026-11-09', requireDate: '2026-11-18', acceptDate: '2026-11-09',
      status: '报告处理', at: '2026-11-09 14:46:45',
      reports: reports('SC2026/0439', 1, '2026-11-09 14:46:45') }),
    row({ code: 'SC2026/0190', customer: '远东电缆股份有限公司', sample: '8.7/10kV 电力电缆',
      sendDate: '2026-09-02', requireDate: '2026-09-12', acceptDate: '2026-09-02',
      status: '报告处理', at: '2026-09-02 16:40:00' }),
    row({ code: 'SC2026/0175', customer: '贵州送变电有限公司', sample: '绝缘手套 10kV',
      sendDate: '2026-09-03', requireDate: '2026-09-12', acceptDate: '2026-09-03',
      status: '收费审批', at: '2026-09-04 09:40:00' }),
    row({ code: 'SC2026/0285', customer: '安顺供电局', sample: '高强度螺栓连接副',
      sendDate: '2026-08-27', requireDate: '2026-09-05', acceptDate: '2026-08-27',
      status: '收费审批', at: '2026-08-27 16:10:00' }),
    row({ code: 'SC2026/0447', customer: '杭州数蚕智能科技有限公司', sample: '安全带',
      sendDate: '2026-11-12', requireDate: '2026-11-20', acceptDate: '2026-11-12',
      status: '报告发放', at: '2026-11-12 13:27:35',
      reports: reports('SC2026/0447', 1, '2026-11-12 13:27:35'),
      ship: { company: '顺丰快递', tracking: 'SF456781111', address: '杭州市西湖区文三路159号东部软件园2号楼402室', contact: '张三', phone: '18888888888', date: '2026-11-21', note: '' } }),
    row({ code: 'SC2026/0166', customer: '遵义供电局', sample: '全身式安全带',
      sendDate: '2026-09-01', requireDate: '2026-09-10', acceptDate: '2026-09-01',
      status: '报告发放', at: '2026-09-05 10:00:00' }),
    row({ code: 'SC2026/0390', customer: '杭州数蚕智能科技有限公司', sample: '绝缘操作杆',
      sendDate: '2026-10-15', requireDate: '2026-10-25', acceptDate: '2026-10-15',
      status: '任务归档' }),
    row({ code: 'SC2026/0242', customer: '贵州送变电有限公司', sample: '绝缘手套 10kV',
      sendDate: '2026-09-07', requireDate: '2026-09-14', acceptDate: '2026-09-07',
      status: '任务归档' }),
    row({ code: 'SC2026/0235', customer: '安顺供电局', sample: '混凝土抗压试块',
      sendDate: '2026-07-14', requireDate: '2026-07-22', acceptDate: '2026-07-14',
      status: '任务归档' }),
    row({ code: 'SC2026/0228', customer: '远东电缆股份有限公司', sample: '电缆保护管',
      sendDate: '2026-07-08', requireDate: '2026-07-18', acceptDate: '2026-07-08',
      status: '任务归档' }),
    row({ code: 'SC2026/0284', customer: '杭州数蚕智能科技有限公司', sample: '绝缘操作杆',
      sendDate: '2026-08-27', requireDate: '2026-09-05', acceptDate: '2026-08-27',
      status: '任务完成' }),
    row({ code: 'SC2026/0280', customer: '遵义供电局', sample: '安全帽',
      sendDate: '2026-08-17', requireDate: '2026-08-27', acceptDate: '2026-08-17',
      status: '任务完成' }),
    row({ code: 'SC2026/0073', customer: '杭州数蚕智能科技有限公司', sample: '绝缘操作杆',
      sendDate: '2026-06-10', requireDate: '2026-07-23', acceptDate: '2026-06-10',
      status: '任务完成' })
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.rows && saved.rows.length) return saved.rows;
      }
    } catch (e) { /* ignore */ }
    return clone(SEED);
  }
  function save(rows) {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows: rows })); } catch (e) { /* ignore */ }
  }

  var rows = load();

  function list(stage) {
    return rows.filter(function (r) { return r.status === stage; });
  }
  function get(code) {
    for (var i = 0; i < rows.length; i++) if (rows[i].code === code) return rows[i];
    return null;
  }
  function nextOf(stage) {
    var i = ORDER.indexOf(stage);
    return i >= 0 && i < ORDER.length - 1 ? ORDER[i + 1] : null;
  }
  function prevOf(stage) {
    var i = ORDER.indexOf(stage);
    return i > 0 ? ORDER[i - 1] : null;
  }
  function stamp() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function pass(code, note) {
    var t = get(code); if (!t) return false;
    var nx = nextOf(t.status); if (!nx) return false;
    t.logs.push({ at: stamp(), node: t.status, by: 'admin', text: note || ('已' + t.status.replace('报告', '').replace('任务', '') + '通过') });
    t.status = nx;
    save(rows);
    return true;
  }
  function back(code, reason) {
    var t = get(code); if (!t) return false;
    var pv = prevOf(t.status);
    t.logs.push({ at: stamp(), node: t.status, by: 'admin', text: '退回' + (reason ? '：' + reason : '') });
    if (!pv) {
      t.status = '已退回审核';
    } else {
      t.status = pv;
    }
    save(rows);
    return true;
  }
  function setShip(code, ship) {
    var t = get(code); if (!t) return false;
    t.ship = ship;
    save(rows);
    return true;
  }
  function removeShip(code) {
    var t = get(code); if (!t) return false;
    t.ship = null;
    save(rows);
    return true;
  }
  function acceptFromReview(info) {
    if (!info || !info.code) return null;
    var t = get(info.code);
    if (!t) {
      t = row({
        code: info.code,
        customer: info.customer || '—',
        sample: info.sample || '—',
        sendDate: info.sendDate || '',
        requireDate: info.requireDate || '',
        acceptDate: info.acceptDate || '',
        compiler: info.compiler || 'admin',
        status: '报告签发',
        reports: info.reports,
        records: info.records,
        logs: []
      });
      rows.unshift(t);
    } else if (ORDER.indexOf(t.status) < 0) {
      t.status = '报告签发';
    }
    if (info.reports) t.reports = info.reports;
    if (info.records) t.records = info.records;
    t.logs.push({ at: stamp(), node: '报告审核', by: '李审核', text: '审核通过，提交报告签发' });
    save(rows);
    return t;
  }
  function reset() {
    rows = clone(SEED);
    save(rows);
    return rows;
  }

  global.ReportFlowStore = {
    ORDER: ORDER, STORAGE_KEY: STORAGE_KEY,
    list: list, get: get, pass: pass, back: back, setShip: setShip, removeShip: removeShip,
    acceptFromReview: acceptFromReview, reset: reset,
    all: function () { return rows; },
    nextOf: nextOf, prevOf: prevOf
  };
})(window);
