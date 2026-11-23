/**
 * 报告签发 → 任务完成 流转 Mock
 * 编制 / 审核通过后进入本链；状态落 localStorage，刷新不丢。
 */
(function (global) {
  var STORAGE_KEY = 'lims-report-flow-v11';
  var ORDER = ['报告签发', '报告处理', '收费审批', '报告发放', '任务归档', '任务完成'];
  var SIGNED = ['报告处理', '收费审批', '报告发放', '任务归档', '任务完成'];
  function isSigned(status) { return SIGNED.indexOf(status) >= 0; }
  function stemOf(r) {
    var no = r && (r.no || r.id);
    if (no) return String(no).replace(/\//g, '-');
    return String((r && r.name) || '检测报告').replace(/检测报告\.(docx|pdf)$/i, '').replace(/\.(docx|pdf)$/i, '') || '检测报告';
  }
  function syncReportFiles(t) {
    if (!t || !t.reports) return t;
    var signed = isSigned(t.status);
    t.reports.forEach(function (r) {
      var stem = stemOf(r);
      r.word = r.word || (stem + '检测报告.docx');
      r.pdf = r.pdf || (stem + '检测报告.pdf');
      r.name = signed ? r.pdf : r.word;
    });
    return t;
  }
  var ACTOR = {
    '报告编制': 'admin', '报告审核': '李审核', '报告签发': '周签发',
    '报告处理': '王处理', '收费审批': '赵财务', '报告发放': '孙发放',
    '任务归档': 'admin', '任务完成': '系统'
  };
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function addDays(iso, n) {
    var p = String(iso || '2026-09-01').split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function historyLogs(status, acceptDate) {
    var d = acceptDate || '2026-09-01';
    var logs = [
      { at: d + ' 15:40', node: '报告编制', by: 'admin', text: '提交至报告审核', tone: 'default' },
      { at: d + ' 15:52', node: '报告审核', by: 'AI 审核引擎', text: '预审结论：通过', tone: 'success' },
      { at: d + ' 16:20', node: '报告审核', by: '李审核', text: '人工审核通过，提交至报告签发', tone: 'success' }
    ];
    var idx = ORDER.indexOf(status);
    for (var i = 0; i < ORDER.length; i++) {
      var st = ORDER[i];
      var at = addDays(d, i + 1) + ' 09:10';
      if (i < idx) {
        logs.push({ at: at, node: st, by: ACTOR[st], text: st.replace('报告', '').replace('任务', '') + '通过', tone: 'success' });
      } else if (i === idx) {
        logs.push({
          at: at, node: st, by: '系统',
          text: st === '任务完成' ? '任务完成' : ('等待' + st),
          tone: st === '任务完成' ? 'success' : 'pending'
        });
      }
    }
    return logs;
  }

  function reports(code, n, at) {
    n = n || 1;
    var out = [];
    for (var i = 1; i <= n; i++) {
      var no = code.replace('/', '-') + '-' + String(i).padStart(2, '0');
      out.push({
        id: no, no: no,
        word: no + '检测报告.docx',
        pdf: no + '检测报告.pdf',
        name: no + '检测报告.docx',
        at: at
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
    var out = syncReportFiles({
      code: o.code, contract: o.contract || '/', customer: o.customer, sample: o.sample,
      sendDate: o.sendDate, requireDate: o.requireDate, acceptDate: o.acceptDate,
      prepaid: o.prepaid || '否', priority: o.priority || '常规', compiler: o.compiler || 'admin',
      status: o.status, contact: o.contact || '张三', phone: o.phone || '18888888888',
      address: o.address || '杭州市西湖区文三路159号东部软件园2号楼402室',
      reports: o.reports || reports(o.code, 1, o.at || (o.acceptDate + ' 13:30:00')),
      records: o.records || recs(o.code, [o.sample + '试验记录单.docx'], o.at || (o.acceptDate + ' 13:30:00')),
      ship: o.ship || null,
      returns: o.returns || [],
      logs: (o.logs && o.logs.length) ? o.logs : historyLogs(o.status, o.acceptDate)
    });
    (out.returns || []).forEach(function (rec) {
      var hit = (out.logs || []).filter(function (l) {
        if (rec.reason && l.reason && l.reason === rec.reason && (l.by === rec.by || l.node === rec.from)) return true;
        return rec.time && l.at === rec.time && l.by === rec.by && l.node === rec.from;
      })[0];
      if (hit) {
        if (!hit.reportNo && rec.reportNo) hit.reportNo = rec.reportNo;
        if (!hit.target && rec.to) hit.target = rec.to;
        return;
      }
      out.logs.push({
        at: rec.time, node: rec.from, by: rec.by,
        text: '退回至' + rec.to + (rec.reportNo ? ' · ' + rec.reportNo : ''),
        tone: 'danger', reason: rec.reason, target: rec.to, reportNo: rec.reportNo || ''
      });
    });
    return out;
  }

  var SEED = [
    row({ code: 'SC2026/0312', contract: 'HT2026-0312', customer: '杭州数蚕智能科技有限公司', sample: '10kV3芯电力电缆',
      sendDate: '2026-10-08', requireDate: '2026-10-18', acceptDate: '2026-10-08',
      status: '报告签发', at: '2026-10-12 09:20:00',
      reports: reports('SC2026/0312', 2, '2026-10-12 09:20:00'),
      returns: [{ from: '报告处理', to: '报告签发', by: '王处理', time: '2026-11-20 14:30', reason: '签发章位置与机构授权范围不符，退回签发重新核验。', kind: '人工', reportNo: 'SC2026/0312-01' }],
      logs: [
        { at: '2026-10-08 15:40', node: '报告编制', by: 'admin', text: '提交至报告审核', tone: 'default' },
        { at: '2026-10-08 15:52', node: '报告审核', by: 'AI 审核引擎', text: '预审结论：通过', tone: 'success' },
        { at: '2026-10-08 16:20', node: '报告审核', by: '李审核', text: '人工审核通过，提交至报告签发', tone: 'success' },
        { at: '2026-10-09 09:10', node: '报告签发', by: '周签发', text: '签发通过，已生成 PDF 报告', tone: 'success' },
        { at: '2026-11-20 14:30', node: '报告签发', by: '系统', text: '等待报告签发', tone: 'pending' }
      ] }),
    row({ code: 'SC2026/0238', contract: 'HT2026-0118', customer: '杭州数蚕智能科技有限公司', sample: '10kV3芯电力电缆',
      sendDate: '2026-09-01', requireDate: '2026-09-10', acceptDate: '2026-09-01',
      status: '报告签发', at: '2026-09-03 10:20:00',
      reports: reports('SC2026/0238', 2, '2026-09-03 10:20:11'),
      records: [{ name: 'SC2026023801导体电阻试验记录单.docx', at: '2026-09-01 15:20:08' }] }),
    row({ code: 'SC2026/0256', customer: '远东电缆股份有限公司', sample: '8.7/10kV 电力电缆',
      sendDate: '2026-07-17', requireDate: '2026-07-28', acceptDate: '2026-07-17',
      status: '报告签发', at: '2026-07-17 13:33:21',
      reports: reports('SC2026/0256', 2, '2026-07-17 13:33:21'),
      records: [{ name: 'SC202607001吊装带-静负荷试验记录单.docx', at: '2026-07-17 13:30:28' }] }),
    row({ code: 'SC2026/0439', customer: '贵州送变电有限公司', sample: '绝缘手套 10kV',
      sendDate: '2026-11-09', requireDate: '2026-11-18', acceptDate: '2026-11-09',
      status: '报告处理', at: '2026-11-09 14:46:45',
      reports: reports('SC2026/0439', 3, '2026-11-09 14:46:45') }),
    row({ code: 'SC2026/0190', customer: '远东电缆股份有限公司', sample: '8.7/10kV 电力电缆',
      sendDate: '2026-09-02', requireDate: '2026-09-12', acceptDate: '2026-09-02',
      status: '收费审批', at: '2026-09-02 16:40:00',
      reports: (function () {
        var reps = reports('SC2026/0190', 3, '2026-09-02 16:40:00');
        reps[0].stage = '报告处理';
        reps[2].stage = '报告处理';
        return reps;
      })(),
      returns: [
        { from: '收费审批', to: '报告处理', by: '赵财务', time: '2026-11-10 09:40', reason: '处理范围与收费清单不一致，请重新勾选后再收费。', kind: '人工', reportNo: 'SC2026-0190-01' },
        { from: '收费审批', to: '报告处理', by: '赵财务', time: '2026-11-10 11:15', reason: '检测项目收费漏计导体电阻，请补勾后再提交。', kind: '人工', reportNo: 'SC2026-0190-03' }
      ] }),
    row({ code: 'SC2026/0175', customer: '贵州送变电有限公司', sample: '绝缘手套 10kV',
      sendDate: '2026-09-03', requireDate: '2026-09-12', acceptDate: '2026-09-03',
      status: '收费审批', at: '2026-09-04 09:40:00',
      reports: reports('SC2026/0175', 3, '2026-09-04 09:40:00') }),
    row({ code: 'SC2026/0285', customer: '安顺供电局', sample: '高强度螺栓连接副',
      sendDate: '2026-08-27', requireDate: '2026-09-05', acceptDate: '2026-08-27',
      status: '报告发放', at: '2026-08-27 16:10:00',
      reports: (function () {
        var reps = reports('SC2026/0285', 3, '2026-08-27 16:10:00');
        reps[0].stage = '收费审批';
        reps[2].stage = '收费审批';
        return reps;
      })(),
      returns: [
        { from: '报告发放', to: '收费审批', by: '孙发放', time: '2026-11-09 14:18', reason: '收费未结清，暂不能发放，退回收费审批。', kind: '人工', reportNo: 'SC2026-0285-01' },
        { from: '报告发放', to: '收费审批', by: '孙发放', time: '2026-11-09 15:02', reason: '发票抬头与委托单位不一致，请复核后再发放。', kind: '人工', reportNo: 'SC2026-0285-03' }
      ] }),
    row({ code: 'SC2026/0447', contract: 'HT2026-0447', customer: '杭州数蚕智能科技有限公司', sample: '安全带',
      sendDate: '2026-11-12', requireDate: '2026-11-20', acceptDate: '2026-11-12',
      status: '报告发放', at: '2026-11-12 13:27:35',
      reports: (function () {
        var reps = reports('SC2026/0447', 2, '2026-11-12 13:27:35');
        reps[0].issued = true;
        reps[0].ship = { company: '顺丰快递', tracking: 'SF456781111', address: '杭州市西湖区文三路159号东部软件园2号楼402室', contact: '张三', phone: '18888888888', date: '2026-11-21', note: '' };
        return reps;
      })(),
      ship: { company: '顺丰快递', tracking: 'SF456781111', address: '杭州市西湖区文三路159号东部软件园2号楼402室', contact: '张三', phone: '18888888888', date: '2026-11-21', note: '' } }),
    row({ code: 'SC2026/0166', customer: '遵义供电局', sample: '全身式安全带',
      sendDate: '2026-09-01', requireDate: '2026-09-10', acceptDate: '2026-09-01',
      status: '报告发放', at: '2026-09-05 10:00:00',
      reports: reports('SC2026/0166', 3, '2026-09-05 10:00:00'),
      ship: { company: '中通快递', tracking: 'ZT16600991', address: '遵义市汇川区南京路18号', contact: '李四', phone: '13900001111', date: '2026-11-21', note: '' },
      returns: [{ from: '任务归档', to: '报告发放', by: 'admin', time: '2026-11-08 11:02', reason: '快递单号填写错误，退回发放更正。', kind: '人工' }] }),
    row({ code: 'SC2026/0390', contract: 'HT2026-0390', customer: '杭州数蚕智能科技有限公司', sample: '绝缘操作杆',
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
    row({ code: 'SC2026/0284', contract: 'HT2026-0284', customer: '杭州数蚕智能科技有限公司', sample: '绝缘操作杆',
      sendDate: '2026-08-27', requireDate: '2026-09-05', acceptDate: '2026-08-27',
      status: '任务完成',
      ship: { company: '顺丰快递', tracking: 'SF284019283', address: '杭州市西湖区文三路159号东部软件园2号楼402室', contact: '张三', phone: '18888888888', date: '2026-09-06', note: '' } }),
    row({ code: 'SC2026/0280', customer: '遵义供电局', sample: '安全帽',
      sendDate: '2026-08-17', requireDate: '2026-08-27', acceptDate: '2026-08-17',
      status: '任务完成',
      ship: { company: '中通快递', tracking: 'ZT280118822', address: '遵义市汇川区南京路18号', contact: '李四', phone: '13900001111', date: '2026-08-28', note: '工作日送达' } }),
    row({ code: 'SC2026/0073', customer: '杭州数蚕智能科技有限公司', sample: '绝缘操作杆',
      sendDate: '2026-06-10', requireDate: '2026-07-23', acceptDate: '2026-06-10',
      status: '任务完成',
      ship: { company: 'EMS', tracking: 'EMS07300991', address: '杭州市西湖区文三路159号东部软件园2号楼402室', contact: '张三', phone: '18888888888', date: '2026-07-24', note: '' } })
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        if (saved && saved.rows && saved.rows.length) {
          saved.rows.forEach(syncReportFiles);
          return saved.rows;
        }
      }
    } catch (e) { /* ignore */ }
    return clone(SEED);
  }
  function save(rows) {
    try { global.localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows: rows })); } catch (e) { /* ignore */ }
  }

  var rows = load();

  var SPLIT_STAGES = { '报告处理': 1, '收费审批': 1, '报告发放': 1 };
  var PER_REPORT_BACK = { '收费审批': 1, '报告发放': 1 };
  function stageOf(task, report) {
    if (!report) return task.status;
    return report.stage || task.status;
  }
  function reportsAt(task, stage) {
    return (task.reports || []).filter(function (r) {
      if (stage === '报告发放' && r.issued) return false;
      return stageOf(task, r) === stage;
    });
  }
  function pinOpen(task) {
    (task.reports || []).forEach(function (r) {
      if (r.issued) return;
      if (!r.stage) r.stage = task.status;
    });
  }
  function recomputeStatus(task) {
    var open = (task.reports || []).filter(function (r) { return !r.issued; });
    if (!open.length) {
      if ((task.reports || []).some(function (r) { return r.issued; }) && ORDER.indexOf(task.status) <= ORDER.indexOf('报告发放')) {
        task.status = '任务归档';
      }
      return;
    }
    var best = -1;
    var name = task.status;
    open.forEach(function (r) {
      var s = r.stage || task.status;
      var i = ORDER.indexOf(s);
      if (i > best) { best = i; name = s; }
    });
    if (best >= 0) task.status = name;
    (task.reports || []).forEach(function (r) {
      if (r.stage && r.stage === task.status) r.stage = '';
    });
  }
  function list(stage) {
    return rows.filter(function (task) {
      if (SPLIT_STAGES[stage] && task.reports && task.reports.length) return reportsAt(task, stage).length > 0;
      return task.status === stage;
    });
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
  function pass(code, note, extra) {
    extra = extra || {};
    var t = get(code); if (!t) return false;
    var from = extra.from || t.status;
    if (from === '任务完成') return false;
    var nx = nextOf(from); if (!nx) return false;
    var text = note || (from.replace('报告', '').replace('任务', '') + '通过');
    if (from === '报告签发' && !note) text = '签发通过，已生成 PDF 报告';
    if ((from === '报告处理' || from === '收费审批') && extra.from) {
      pinOpen(t);
      var moving = reportsAt(t, from);
      if (!moving.length) return false;
      t.logs.push({
        at: stamp(), node: from, by: ACTOR[from] || 'admin',
        text: text + ' ' + moving.length + ' 份报告', tone: 'success'
      });
      moving.forEach(function (r) { r.stage = nx; });
      recomputeStatus(t);
      syncReportFiles(t);
      save(rows);
      return true;
    }
    if (from !== t.status) return false;
    t.logs.push({ at: stamp(), node: from, by: ACTOR[from] || 'admin', text: text, tone: 'success' });
    t.status = nx;
    (t.reports || []).forEach(function (r) { if (!r.issued) r.stage = ''; });
    syncReportFiles(t);
    save(rows);
    return true;
  }
  function pushReturn(t, from, to, reason, extra, reportNo) {
    var rec = {
      from: from, to: to, by: extra.by || ACTOR[from] || 'admin',
      time: stamp(), reason: reason || '', kind: extra.kind || '人工',
      reportNo: reportNo || ''
    };
    t.returns = t.returns || [];
    t.logs = t.logs || [];
    t.returns.push(rec);
    t.logs.push({
      at: rec.time, node: from, by: rec.by,
      text: '退回至' + to + (reportNo ? ' · ' + reportNo : ''),
      tone: 'danger', reason: rec.reason, target: to, reportNo: reportNo || ''
    });
    if (global.ReturnStore) {
      global.ReturnStore.push({
        code: t.code, from: rec.from, to: rec.to, by: rec.by,
        time: rec.time, reason: rec.reason, kind: rec.kind, reportNo: rec.reportNo
      });
    }
    return rec;
  }
  function back(code, reason, extra) {
    extra = extra || {};
    var t = get(code); if (!t) return false;
    var from = extra.from || t.status;
    if (from === '任务完成') return false;
    var prev = prevOf(from);
    var to = extra.to || prev || '报告审核';
    if (PER_REPORT_BACK[from]) {
      var ids = (extra.reportIds || []).map(String);
      if (!ids.length) return false;
      pinOpen(t);
      var targets = (t.reports || []).filter(function (r) {
        if (r.issued || stageOf(t, r) !== from) return false;
        return ids.indexOf(String(r.id)) >= 0 || ids.indexOf(String(r.no)) >= 0;
      });
      if (!targets.length) return false;
      targets.forEach(function (r) {
        r.stage = to;
        pushReturn(t, from, to, reason, extra, r.no || r.id);
      });
      recomputeStatus(t);
      syncReportFiles(t);
      save(rows);
      return { count: targets.length, reports: targets.map(function (r) { return r.no || r.id; }) };
    }
    pushReturn(t, from, to, reason, extra, extra.reportNo || '');
    t.status = prev ? to : '已退回审核';
    (t.reports || []).forEach(function (r) { if (!r.issued) r.stage = ''; });
    syncReportFiles(t);
    save(rows);
    return true;
  }
  function issue(code, ids) {
    var t = get(code); if (!t) return false;
    ids = (ids || []).map(String);
    var snap = t.ship ? clone(t.ship) : null;
    (t.reports || []).forEach(function (r) {
      if (ids.indexOf(String(r.id)) >= 0) {
        r.issued = true;
        if (snap) r.ship = clone(snap);
      }
    });
    var left = (t.reports || []).filter(function (r) { return !r.issued && stageOf(t, r) === '报告发放'; });
    t.logs.push({
      at: stamp(), node: t.status, by: ACTOR[t.status] || 'admin',
      text: '发放通过 ' + ids.length + ' 份报告' + (left.length ? '（本单仍有 ' + left.length + ' 份待发放）' : '，进入任务归档'),
      tone: 'success', issuedIds: ids
    });
    if (!left.length) {
      var nx = nextOf(t.status);
      if (nx) t.status = nx;
    }
    save(rows);
    return { remaining: left.length };
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
        records: info.records
      });
      rows.unshift(t);
    } else {
      if (ORDER.indexOf(t.status) < 0) t.status = '报告签发';
      t.logs.push({ at: stamp(), node: '报告审核', by: '李审核', text: '审核通过，提交报告签发', tone: 'success' });
      t.logs.push({ at: stamp(), node: '报告签发', by: '系统', text: '等待报告签发', tone: 'pending' });
    }
    if (info.reports) t.reports = info.reports;
    if (info.records) t.records = info.records;
    save(rows);
    return t;
  }
  function reset() {
    rows = clone(SEED);
    save(rows);
    return rows;
  }

  global.ReportFlowStore = {
    ORDER: ORDER, STORAGE_KEY: STORAGE_KEY, SIGNED: SIGNED,
    isSigned: isSigned, syncReportFiles: syncReportFiles,
    list: list, get: get, pass: pass, back: back, issue: issue, setShip: setShip, removeShip: removeShip,
    reportsAt: reportsAt, stageOf: stageOf,
    acceptFromReview: acceptFromReview, reset: reset,
    all: function () { return rows; },
    nextOf: nextOf, prevOf: prevOf
  };
})(window);
