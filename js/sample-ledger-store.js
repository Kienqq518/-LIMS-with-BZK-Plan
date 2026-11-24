/**
 * 样品台账：一行一件样品。还样之后留样 / 退样二选一。
 * STORAGE_KEY 升版本后浏览器才会吃到新种子。
 */
(function (global) {
  var STORAGE_KEY = 'lims-sample-ledger-v4';
  var QUERY_KEY = 'lims-sample-ledger-query-v4';

  var TASK_STEPS = [
    '委托登记', '样品收样', '委托确认', '费用审核', '样品制备', '样品发样',
    '试样分发', '试验检测', '组内审核', '数据审核', '报告编制', '报告审核',
    '报告签发', '报告处理', '收费审批', '报告发放', '任务归档', '任务完成'
  ];
  var SPINE = ['委托登记', '收样', '制备', '发样', '领样', '检测', '还样'];
  var LIST_FILTERS = ['待接收', '待检', '在检', '待审核', '已完成', '留样', '已处置', '退回'];
  var RESULT_FILTERS = ['合格', '不合格', '已过期', '/'];
  var PHASES = ['委托登记', '收样', '发样', '领样', '检测中', '检测完成', '待退样', '留库', '退回客户'];
  var FLOW_NODES = TASK_STEPS.slice();
  var SIGN_STEP = 13;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function step(name, state, who, time, place, note, extra) {
    var row = { name: name, direction: 'forward', state: state, who: who, time: time, place: place, note: note };
    if (extra) Object.keys(extra).forEach(function (k) { row[k] = extra[k]; });
    return row;
  }
  function done(name, who, time, place, note) { return step(name, '已完成', who, time, place, note); }
  function doing(name, who, time, place, note) { return step(name, '进行中', who, time, place, note); }
  function pending(name) { return step(name, '未开始', '—', '', '—', '未发生'); }
  function back(name, who, time, place, note) {
    return { name: name, direction: 'back', state: '已完成', who: who, time: time, place: place, note: note };
  }

  function buildLedger(happened, afterReturn) {
    var byName = {};
    happened.forEach(function (row) {
      if (!byName[row.name]) byName[row.name] = [];
      byName[row.name].push(row);
    });
    var spine = [];
    SPINE.forEach(function (name) {
      if (name === '制备' && !byName[name]) return;
      var list = byName[name];
      if (list && list.length) spine = spine.concat(list);
      else spine.push(pending(name));
    });
    var returned = (byName['还样'] || []).some(function (r) { return r.state === '已完成'; });
    if (returned && afterReturn === 'keep') {
      spine = spine.concat(byName['留样'] && byName['留样'].length ? byName['留样'] : [pending('留样')]);
    } else if (returned && afterReturn === 'client') {
      spine = spine.concat(byName['退样'] && byName['退样'].length ? byName['退样'] : [pending('退样')]);
    }
    var pendingRows = spine.filter(function (r) { return r.state === '未开始'; });
    var live = spine.filter(function (r) { return r.state !== '未开始'; }).concat(
      happened.filter(function (r) { return r.direction === 'back'; })
    );
    live.sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
    return live.concat(pendingRows);
  }

  function tPass(name, owner, at) { return { name: name, owner: owner, state: '已完成', result: '合格', finishedAt: at, remark: '' }; }
  function tFail(name, owner, at, remark) { return { name: name, owner: owner, state: '已完成', result: '不合格', finishedAt: at, remark: remark }; }
  function tWait(name, owner, state) { return { name: name, owner: owner, state: state || '未开始', result: null, finishedAt: '', remark: '' }; }

  var RES = '交流耐压试验';
  var BEND = '抗弯动负荷试验';
  var APP = '外观检查';

  var SEED = [
    {
      sampleNo: 'SC2026/0356-01', code: 'SC2026/0356', name: '绝缘操作杆',
      customer: '杭州应敏科技有限公司', spec: '10kV', model: '绝缘操作杆', mark: '10kV',
      status: '合格', taskStep: 18, taskType: '材料（安全工具器类）',
      recheckAt: '2027-04-18', returnApplied: false, afterReturn: 'keep',
      receiver: '赵工', receivedAt: '2026-10-16', orderDate: '2026-10-16', due: '2026-10-20',
      qty: '2 根', category: '委托试验', plant: '远东工器具', plantAddr: '江苏省宜兴市远东大道 1 号',
      manufacturer: '远东工器具', manufacturerAddr: '江苏省宜兴市远东大道 1 号',
      place: '留样室', resultAt: '2026-10-18 16:20',
      sender: '王客户', senderPhone: '13800003601', sendWay: '送样', receiveStatus: '完好',
      photos: ['外观正面', '铭牌'],
      reportNo: 'SC2026/0356-01', reportStatus: '已签发', signedAt: '2026-10-18',
      tests: [tPass(RES, '王工', '2026-10-18 11:20'), tPass(BEND, '陈工', '2026-10-18 16:20')],
      ledger: buildLedger([
        done('委托登记', '李工', '2026-10-16 09:12', '业务室', '委托已受理'),
        done('收样', '赵工', '2026-10-16 10:40', '收样台', '到样完好'),
        done('制备', '张三', '2026-10-16 11:20', '制备间', '按任务单制样'),
        done('发样', '赵工', '2026-10-16 13:05', '样品库 A-03', '已发样'),
        done('领样', '王工', '2026-10-17 08:30', '检测室 2', '领取交流耐压试样', { specimen: 'SC2026/0356-01-01' }),
        done('领样', '陈工', '2026-10-17 09:15', '检测室 1', '领取抗弯试样', { specimen: 'SC2026/0356-01-02' }),
        done('检测', '王工', '2026-10-18 13:40', '检测室 2', '交流耐压已完成'),
        done('检测', '陈工', '2026-10-18 16:20', '检测室 1', '抗弯已完成'),
        done('还样', '王工', '2026-10-18 16:40', '样品库 A-03', '剩余样品已还回样品库'),
        done('留样', '赵工', '2026-10-18 17:00', '留样室', '留样 90 天')
      ], 'keep')
    },
    {
      sampleNo: 'SC2026/0356-02', code: 'SC2026/0356', name: '绝缘硬梯',
      customer: '杭州应敏科技有限公司', spec: '10kV', model: '绝缘硬梯', mark: '10kV',
      status: '检测中', taskStep: 8, taskType: '材料（安全工具器类）',
      recheckAt: '', returnApplied: false, afterReturn: '',
      receiver: '赵工', receivedAt: '2026-10-16', orderDate: '2026-10-16', due: '2026-11-25',
      qty: '1 架', category: '委托试验', plant: '远东工器具', plantAddr: '江苏省宜兴市远东大道 1 号',
      manufacturer: '远东工器具', manufacturerAddr: '江苏省宜兴市远东大道 1 号',
      place: '检测室 2', resultAt: '',
      sender: '王客户', senderPhone: '13800003601', sendWay: '送样', receiveStatus: '完好',
      photos: ['外观正面'],
      reportNo: '', reportStatus: '',
      tests: [tPass(RES, '王工', '2026-11-19 11:40'), tWait(BEND, '王工', '检测中')],
      ledger: buildLedger([
        done('委托登记', '李工', '2026-10-16 09:12', '业务室', '与 01 同一委托'),
        done('收样', '赵工', '2026-10-16 10:46', '收样台', '到样完好'),
        done('发样', '赵工', '2026-10-16 11:12', '样品库 A-04', '无需制备，直接发样'),
        done('领样', '王工', '2026-11-19 08:20', '检测室 2', '领取交流耐压、抗弯试样'),
        doing('检测', '王工', '2026-11-19 09:00', '检测室 2', '交流耐压已完成，抗弯检测中')
      ], '')
    },
    {
      sampleNo: 'SC2026/0368-01', code: 'SC2026/0368', name: '安全带',
      customer: '宇宙设想有限公司', spec: '围杆式', model: '安全带', mark: '',
      status: '待收样', taskStep: 2, taskType: '材料（安全工具器类）',
      recheckAt: '', returnApplied: false, afterReturn: '',
      receiver: '尚未收样', receivedAt: '—', orderDate: '2026-11-18', due: '2026-11-30',
      qty: '1 条', category: '例行试验', plant: '杭工', plantAddr: '杭州市余杭区工一路 8 号',
      manufacturer: '杭工', manufacturerAddr: '杭州市余杭区工一路 8 号',
      place: '—', resultAt: '',
      sender: '', senderPhone: '', sendWay: '', receiveStatus: '',
      photos: [],
      reportNo: '', reportStatus: '',
      tests: [tWait(APP, '待分配'), tWait(RES, '待分配')],
      ledger: buildLedger([
        done('委托登记', '李工', '2026-11-18 14:08', '业务室', '委托已受理')
      ], '')
    },
    {
      sampleNo: 'SC2026/0341-01', code: 'SC2026/0341', name: '绝缘操作杆',
      customer: '东集西造有限公司', spec: '10kV', model: '绝缘操作杆', mark: '10kV',
      status: '不合格', taskStep: 12, taskType: '材料（安全工具器类）',
      recheckAt: '', returnApplied: false, afterReturn: 'client',
      receiver: '赵工', receivedAt: '2026-10-08', orderDate: '2026-10-08', due: '2026-10-18',
      qty: '1 根', category: '委托试验', plant: '杭工', plantAddr: '杭州市余杭区工一路 8 号',
      manufacturer: '杭工', manufacturerAddr: '杭州市余杭区工一路 8 号',
      place: '已退回客户', resultAt: '2026-10-17 15:10',
      sender: '刘工', senderPhone: '13700003410', sendWay: '送样', receiveStatus: '完好',
      photos: ['外观正面', '端部'],
      reportNo: 'SC2026/0341-01', reportStatus: '审核中',
      tests: [tFail(RES, '王工', '2026-10-17 11:00', '泄漏电流超标'), tPass(BEND, '陈工', '2026-10-17 15:10')],
      ledger: buildLedger([
        done('委托登记', '李工', '2026-10-08 09:00', '业务室', '委托已受理'),
        done('收样', '赵工', '2026-10-08 10:20', '收样台', '到样完好'),
        done('制备', '张三', '2026-10-08 11:00', '制备间', '按任务单制样'),
        done('发样', '赵工', '2026-10-08 13:30', '样品库 B-01', '已发样'),
        done('领样', '王工', '2026-10-09 08:40', '检测室 2', '领取全部试样'),
        done('检测', '王工', '2026-10-17 15:10', '检测室 2', '交流耐压不合格'),
        done('还样', '王工', '2026-10-17 16:00', '样品库 B-01', '余样还库'),
        done('退样', '赵工', '2026-10-20 10:30', '收样台', '退回客户，快递 SF20261020001')
      ], 'client')
    },
    {
      sampleNo: 'SC2026/0088-01', code: 'SC2026/0088', name: '10kV3芯电力电缆',
      customer: '杭州应敏科技有限公司', spec: 'YJV-8.7/10 3×35', model: 'YJV-交联聚乙烯绝缘聚氯乙烯护套电力电缆', mark: 'YJV-8.7/10 3×35',
      status: '已过期', taskStep: 8, taskType: '材料（电线电缆、金具、金属材料类）',
      recheckAt: '', returnApplied: false, afterReturn: '',
      receiver: '李工', receivedAt: '2026-09-20', orderDate: '2026-09-20', due: '2026-09-28',
      qty: '1 根', category: '抽样试验', plant: '远东电缆', plantAddr: '江苏省宜兴市电缆工业园',
      manufacturer: '远东电缆', manufacturerAddr: '江苏省宜兴市电缆工业园',
      place: '检测室 2', resultAt: '',
      sender: '李客户', senderPhone: '13600000880', sendWay: '上门', receiveStatus: '完好',
      photos: ['电缆盘', '截面'],
      reportNo: '', reportStatus: '',
      tests: [tWait(RES, '王工', '检测中'), tWait(APP, '王工')],
      ledger: buildLedger([
        done('委托登记', '李工', '2026-09-20 09:05', '业务室', '委托已受理'),
        done('收样', '李工', '2026-09-20 10:18', '收样台', '到样完好'),
        done('发样', '李工', '2026-09-20 10:40', '样品库 B-02', '已发样'),
        done('领样', '王工', '2026-09-26 08:30', '检测室 2', '已领样'),
        doing('检测', '王工', '2026-09-27 10:30', '检测室 2', '超过要求检测日期仍未完成')
      ], '')
    },
    {
      sampleNo: 'SC2026/0320-01', code: 'SC2026/0320', name: '绝缘操作杆',
      customer: '杭州数蚕智能科技有限公司', spec: '10kV', model: '绝缘操作杆', mark: '10kV',
      status: '检测中', taskStep: 8, taskType: '材料（安全工具器类）',
      recheckAt: '', returnApplied: false, afterReturn: '',
      receiver: '李工', receivedAt: '2026-11-10', orderDate: '2026-11-10', due: '2026-11-20',
      qty: '1 根', category: '委托试验', plant: '杭工', plantAddr: '杭州市余杭区工一路 8 号',
      manufacturer: '杭工', manufacturerAddr: '杭州市余杭区工一路 8 号',
      place: '检测室 2', resultAt: '',
      sender: '陈工', senderPhone: '13900003200', sendWay: '送样', receiveStatus: '完好',
      photos: ['外观正面'],
      reportNo: '', reportStatus: '',
      tests: [tWait(RES, '王工', '检测中'), tWait(BEND, '陈工')],
      ledger: buildLedger([
        done('委托登记', '李工', '2026-11-10 09:05', '业务室', '委托已受理'),
        done('收样', '李工', '2026-11-10 10:18', '收样台', '到样完好'),
        done('发样', '李工', '2026-11-10 10:40', '样品库 B-02', '已发样'),
        done('领样', '王工', '2026-11-12 08:30', '检测室 2', '已领样'),
        back('退回发样', '王工', '2026-11-12 15:40', '样品库 B-02', '试样与委托规格不符，退回样品库'),
        done('发样', '李工', '2026-11-13 09:20', '样品库 B-02', '核对后重新发样'),
        done('领样', '王工', '2026-11-13 10:05', '检测室 2', '重新领样'),
        doing('检测', '王工', '2026-11-13 10:30', '检测室 2', '复测中')
      ], '')
    }
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

  function get(sampleNo) {
    var compact = String(sampleNo || '').replace(/\s/g, '');
    for (var i = 0; i < items.length; i++) {
      if (items[i].sampleNo === compact) return items[i];
    }
    return null;
  }

  function isReceived(s) { return s.receivedAt && s.receivedAt !== '—'; }
  function testsDone(s) { return s.tests.length > 0 && s.tests.every(function (t) { return t.state === '已完成'; }); }

  function dueOffset(due, day) {
    day = day || today();
    var a = day.split('-').map(Number);
    var b = due.split('-').map(Number);
    return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
  }
  function dueUrgency(due, status) {
    if (status === '合格' || status === '不合格') return { tone: 'normal', days: 0, text: '' };
    var left = dueOffset(due);
    if (left < 0) return { tone: 'overdue', days: Math.max(1, -left), text: '' };
    if (left <= 2) return { tone: 'soon', days: left, text: '' };
    return { tone: 'normal', days: left, text: '' };
  }

  function taskNode(s) {
    return TASK_STEPS[(s.taskStep || 1) - 1] || '—';
  }
  function isSigned(s) {
    return (s.taskStep || 0) >= SIGN_STEP;
  }
  function signOverdue(s) {
    if (isSigned(s)) {
      var at = String(s.signedAt || '').slice(0, 10);
      if (!at) return { overdue: false, days: 0, text: '' };
      var late = dueOffset(s.due, at);
      if (late >= 0) return { overdue: false, days: 0, text: '' };
      var n = Math.max(1, -late);
      return { overdue: true, days: n, text: '逾期' + n + '天' };
    }
    var left = dueOffset(s.due);
    if (left >= 0) return { overdue: false, days: 0, text: '' };
    var days = Math.max(1, -left);
    return { overdue: true, days: days, text: '逾期' + days + '天' };
  }
  function resultLabel(s) {
    if (s.status === '合格') return '合格';
    if (s.status === '不合格') return '不合格';
    if (s.status === '已过期') return '已过期';
    return '/';
  }
  function flowStatus(s) {
    if (s.afterReturn === 'keep') return '留样';
    if (s.afterReturn === 'client') return '已处置';
    var cur = currentFlow(s);
    if (cur && cur.direction === 'back') return '退回';
    if (!isReceived(s)) return '待接收';
    if (s.taskStep >= SIGN_STEP) return '已完成';
    if (s.taskStep >= 9) return '待审核';
    var testing = (s.tests || []).some(function (t) { return t.state === '检测中' || t.state === '已完成'; });
    if (testing || s.taskStep >= 8) return '在检';
    return '待检';
  }
  function receiveNote(s) {
    var rows = (s.ledger || []).filter(function (r) { return r.name === '收样' && r.state === '已完成'; });
    return rows.length ? rows[rows.length - 1].note : '';
  }
  function receiveTime(s) {
    var rows = (s.ledger || []).filter(function (r) { return r.name === '收样' && r.state === '已完成'; });
    if (rows.length && rows[rows.length - 1].time) return rows[rows.length - 1].time;
    return s.receivedAt && s.receivedAt !== '—' ? s.receivedAt : '—';
  }
  function labelDetectStatus(s) {
    var flow = flowStatus(s);
    if (flow === '待接收') return '未收样';
    if (flow === '待检') return '未检测';
    if (flow === '已完成' || flow === '留样' || flow === '已处置') return '已检测';
    return '检测中';
  }

  function currentFlow(s) {
    var active = (s.ledger || []).filter(function (r) { return r.state === '进行中'; });
    if (active.length) return active[active.length - 1];
    var doneRows = (s.ledger || []).filter(function (r) { return r.state === '已完成'; });
    if (doneRows.length) return doneRows[doneRows.length - 1];
    return (s.ledger || [])[0] || { name: '—', state: '未开始', who: '—', place: '—', direction: 'forward' };
  }
  function flowLabel(stepRow) {
    if (stepRow.name === '检测' && stepRow.state === '进行中') return '检测中';
    return stepRow.name;
  }
  function flowActor(stepRow) {
    var who = stepRow.who === '—' ? '' : stepRow.who;
    var place = stepRow.place === '—' ? '' : stepRow.place;
    if (who && place) return who + '·' + place;
    return who || place || stepRow.note || '暂无';
  }

  function resultCopy(s) {
    if (s.status === '合格') return '检测结论为合格。出具时间 ' + s.resultAt + '。还样后走留样。';
    if (s.status === '不合格') {
      var names = s.tests.filter(function (t) { return t.result === '不合格'; }).map(function (t) { return t.name; }).join('、');
      return '检测结论为不合格。不合格项：' + names + '。出具时间 ' + s.resultAt + '。还样后走退样。';
    }
    if (s.status === '检测中') {
      var doneN = s.tests.filter(function (t) { return t.state === '已完成'; }).length;
      return '检测尚未完成，暂不出具合格或不合格结论。已完成 ' + doneN + '/' + s.tests.length + ' 项。';
    }
    if (s.status === '已过期') return '已超过要求检测日期 ' + s.due + '，检测未完成，不能出具结论。';
    return '样品尚未收样，暂无检测结果。';
  }

  function matchesListFilter(s, filter) {
    if (!filter || filter === '全部') return true;
    if (filter === '待收样') return flowStatus(s) === '待接收';
    return flowStatus(s) === filter;
  }

  function inRange(date, from, to) {
    if (!date || date === '—') return !from && !to;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  }

  function matchesPhase(s, phase) {
    if (phase === '委托登记') return !isReceived(s);
    if (phase === '收样') return isReceived(s);
    if (phase === '发样') return s.taskStep > 6;
    if (phase === '领样') {
      var picks = (s.ledger || []).filter(function (r) { return r.name === '领样'; });
      return picks.length > 0 && picks.every(function (r) { return r.state === '已完成'; });
    }
    if (phase === '检测中') return s.status === '检测中' || s.tests.some(function (t) { return t.state === '检测中'; });
    if (phase === '检测完成') return testsDone(s);
    if (phase === '待退样') return !!s.returnApplied;
    if (phase === '留库') return s.place === '留样室';
    return s.place === '已退回客户';
  }

  function matchesQuery(s, q) {
    q = q || {};
    var keyword = (q.keyword || '').trim().toLowerCase().replace(/-/g, '');
    if (keyword) {
      var hay = (s.sampleNo + ' ' + s.code + ' ' + s.name + ' ' + s.customer).toLowerCase().replace(/-/g, '');
      if (hay.indexOf(keyword) < 0) return false;
    }
    if (q.code && s.code.indexOf(q.code.trim()) < 0) return false;
    if (q.sampleNo && s.sampleNo.indexOf(q.sampleNo.trim()) < 0) return false;
    if (q.name && s.name.indexOf(q.name.trim()) < 0) return false;
    if (q.customer && s.customer.indexOf(q.customer.trim()) < 0) return false;
    var date = q.dateKind === 'receive' ? s.receivedAt : s.orderDate;
    if (!inRange(date, q.from || '', q.to || '')) return false;
    var nodes = q.nodes;
    if (!nodes && q.node) nodes = Array.isArray(q.node) ? q.node : [q.node];
    if (nodes && nodes.length) {
      var cur = taskNode(s);
      var hit = false;
      for (var i = 0; i < nodes.length; i++) { if (nodes[i] && nodes[i] === cur) { hit = true; break; } }
      if (!hit) return false;
    }
    if (q.result) {
      if (resultLabel(s) !== q.result) return false;
    }
    var overdue = signOverdue(s).overdue;
    if (q.timeliness === '逾期' && !overdue) return false;
    if (q.timeliness === '未逾期' && overdue) return false;
    if (q.phase && !matchesPhase(s, q.phase)) return false;
    if (!matchesListFilter(s, q.status || q.chip)) return false;
    return true;
  }

  function compareDate(a, b, desc) {
    var emptyA = !a || a === '—';
    var emptyB = !b || b === '—';
    if (emptyA !== emptyB) return emptyA ? 1 : -1;
    if (a === b) return 0;
    var order = a < b ? -1 : 1;
    return desc ? -order : order;
  }
  function queryList(q) {
    q = q || {};
    return items.filter(function (s) { return matchesQuery(s, q); }).sort(function (a, b) {
      return compareDate(a.sampleNo, b.sampleNo, true);
    });
  }

  function persistQuery(q) {
    try { global.sessionStorage.setItem(QUERY_KEY, JSON.stringify(q || {})); } catch (e) { /* ignore */ }
  }
  function loadQuery() {
    try {
      var raw = global.sessionStorage.getItem(QUERY_KEY);
      if (raw) return JSON.parse(raw) || {};
    } catch (e) { /* ignore */ }
    return {};
  }

  function recordsOf(s) {
    return (s.tests || []).filter(function (t) { return t.state === '已完成'; }).map(function (t, i) {
      return {
        id: 'ledger-' + s.sampleNo + '-' + i,
        fileName: s.sampleNo + ' ' + s.name + ' ' + t.name + '记录单',
        specimenIds: [s.sampleNo],
        modeKey: 'specimen-each',
        createdAt: t.finishedAt,
        invalid: false
      };
    });
  }

  function progressText(s) {
    var done = (s.tests || []).filter(function (t) { return t.state === '已完成'; }).length;
    var fail = (s.tests || []).filter(function (t) { return t.result === '不合格'; }).length;
    var txt = done + '/' + (s.tests || []).length;
    if (fail) txt += '（不合格 ' + fail + ' 项）';
    return txt;
  }

  function hasBack(s) {
    return (s.ledger || []).some(function (r) { return r.direction === 'back'; });
  }

  global.SampleLedger = {
    STORAGE_KEY: STORAGE_KEY,
    TASK_STEPS: TASK_STEPS,
    LIST_FILTERS: LIST_FILTERS,
    RESULT_FILTERS: RESULT_FILTERS,
    PHASES: PHASES,
    FLOW_NODES: FLOW_NODES,
    items: function () { return items; },
    get: get,
    query: queryList,
    currentFlow: currentFlow,
    flowLabel: flowLabel,
    flowActor: flowActor,
    dueUrgency: dueUrgency,
    signOverdue: signOverdue,
    taskNode: taskNode,
    flowStatus: flowStatus,
    resultLabel: resultLabel,
    receiveNote: receiveNote,
    receiveTime: receiveTime,
    labelDetectStatus: labelDetectStatus,
    isSigned: isSigned,
    testsDone: testsDone,
    resultCopy: resultCopy,
    recordsOf: recordsOf,
    progressText: progressText,
    hasBack: hasBack,
    persistQuery: persistQuery,
    loadQuery: loadQuery,
    today: today
  };
})(window);
