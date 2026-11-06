/* 孪生 V2 宿主：只认 TwinApi（/api/*），iframe 场景经 postMessage 驱动
 * 控制三层（决策 Q7：5M1E 切片移除；S2 不再是按钮，改为区域下拉）
 *   ① 叙事：S1 总览 / 区域下钻（106 为完整视图）——S3 告警回溯已按 MVP 范围决定移除（二期再评估）
 *   ② 渲染：图层 icon（path/labels/heatmap）——剖墙不再是开关，改为场景固定渲染行为
 *   ③ 动作：系统流、底栏收起、低配模式（决策 Q8 预留）
 * 只读红线（决策 Q2）：无告警写回，闭环状态由来源系统推送，屏上不出现「演示回执」字样。
 */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var scene = $('#scene');
  var status = null, devices = [], robots = [], alarms = [], tasks = [], samples = [], zones = [], dispatchTasks = [], routeNote = '', walls = [], planItems = [];
  var rtTimer = null, detailDev = null, bridgeReady = false, pendingState = null;
  var zstats = null, zrunning = [], zalarms = [], envNodes = [], zpSig = { dev: '', env: '', run: '', ab: '' }, sceneReady = false, routeAudit = null, cycleDef = null, cycTimer = null;
  var SRC_NAME = { daq: '数采', dispatch: '调度', iot: '物联', lims: 'LIMS', rule: '判定规则' };
  var ORDER = [];  /* 遥控翻页序列 */

  var LAYER_KEYS = ['path', 'labels', 'heatmap'];   /* 分区色块、剖墙开关均已按 2026-11-06 反馈移除；墙体剖切改为场景侧固定行为 */
  /* 分区 id 由数据（/api/overview/alarm-sections）给出；URL 与面板签名都用它，不再写死 A/B/C。
     readURL 在 SECTIONS 赋值之前执行，所以 secIds 兜底到内置三区的顺序。 */
  function secIds() { return (Array.isArray(SECTIONS) && SECTIONS.length ? SECTIONS : [{ id: 'A' }, { id: 'B' }, { id: 'C' }]).map(function (x) { return x.id; }); }
  function readFilter(v) { var a = (v || '').split(','); var o = {}; secIds().forEach(function (k, i) { o[k] = a[i] === 'all' ? 'all' : 'open'; }); return o; }
  var st = readURL() || { mode: 'S1', zone: '106', period: 'day', layers: { path: 1, labels: 1, heatmap: 0 }, alarmFilter: { A: 'open', B: 'open', C: 'open' }, quality: 'high', strip: 0 };

  function sendScene(type, data) { if (scene.contentWindow) scene.contentWindow.postMessage(Object.assign({ channel: 'twin-v2', type: type }, data), location.origin); }
  var pendingView = null;
  function sceneCmd(type, data) {
    if (type === 'view' && !sceneReady) { pendingView = data; return; }   /* 场景未就绪时指令会被丢弃，先排队 */
    if (scene.contentWindow) scene.contentWindow.postMessage(Object.assign({ channel: 'future-lab-tech-blue-spatial', type: type }, data), location.origin);
  }
  function toScene(type, data) { if (bridgeReady) sendScene(type, data); else pendingState = { type: type, data: data }; }

  function readURL() {
    var p = new URLSearchParams(location.search); if (!p.get('mode')) return null;
    var lay = {}; (p.get('layers') || '').split(',').forEach(function (k) { if (k) lay[k] = 1; });
    return { mode: p.get('mode'), zone: p.get('zone') || '106', period: p.get('period') || 'day',
      layers: { path: lay.path == null ? 1 : lay.path, labels: lay.labels == null ? 1 : lay.labels, heatmap: lay.heatmap ? 1 : 0 },
      alarmFilter: readFilter(p.get('alarmFilter')), quality: p.get('quality') || 'high', strip: p.get('strip') ? 1 : 0 };
  }
  function writeURL() {
    var p = new URLSearchParams(); p.set('mode', st.mode); if (st.mode === 'ZONE') p.set('zone', st.zone);
    p.set('period', st.period); p.set('alarmFilter', secIds().map(function (k) { return st.alarmFilter[k] || 'open'; }).join(',')); if (st.quality === 'low') p.set('quality', 'low'); if (st.strip) p.set('strip', '1');
    p.set('layers', LAYER_KEYS.filter(function (k) { return st.layers[k]; }).join(','));
    history.replaceState(null, '', location.pathname + '?' + p.toString() + '#v2=1&native-nodes=1');
  }

  var dataError = null;
  function fail(msg) { dataError = msg;
    var fd = $('#freshDot'), ft = $('#freshTxt');
    if (fd) fd.className = 'dot stale'; if (ft) ft.textContent = '数据源异常：' + msg;
    renderTables();
  }

  /* ---------- 装载 ---------- */
  TwinApi.ready().then(function () {
    TwinApi.start(2000);
    return Promise.all([
      TwinApi.get('/api/overview/lab-status'), TwinApi.get('/api/overview/zones'), TwinApi.get('/api/overview/today-tasks'),
      TwinApi.get('/api/overview/alarms'), TwinApi.get('/api/zone/106/devices'), TwinApi.get('/api/zone/106/robots'),
      TwinApi.get('/api/zone/106/samples'), TwinApi.get('/api/zone/106/dispatch-tasks'),
      TwinApi.get('/api/zone/103/devices'), TwinApi.get('/api/zone/106/cycle'), TwinApi.get('/api/zone/106/walls'),
      TwinApi.get('/api/overview/test-item-plan'), TwinApi.get('/api/overview/alarm-sections')
    ]);
  }).then(function (r) {
    status = r[0].data; zones = r[1].data || []; tasks = r[2].data || []; alarms = r[3].data || [];
    devices = (r[4].data || []).map(stamp('106')).concat((r[8].data || []).map(stamp('103')));   /* 106 全量 + 103 已建档；归属=数据来源分区 */
    robots = r[5].data || []; samples = r[6].data || []; dispatchTasks = r[7].data || [];
    routeNote = (robots[0] && robots[0].routeBasis) ? '机器人位置基准：' + robots[0].routeBasis : '';
    walls = (r[10] && r[10].data) || [];
    planItems = (r[11] && r[11].data && r[11].data.items) || [];
    setSections(r[12] && r[12].data);   /* A/B/C 分区口径来自数据，不在 JS 里写死（FR-24 第 4 条） */
    /* 讲解顺序（决策 Q1 售前投影）：总览 → 106 无人化区（主叙事）→ 其余区域 */
    ORDER = ['S1', 'Z106'].concat(zones.map(function (z) { return 'Z' + z.zoneId.slice(2); }).filter(function (z) { return z !== 'Z106'; }));   /* 讲解序列不再包含告警回溯屏 */
    if (r[9] && r[9].data && r[9].data.cycle) { cycleDef = r[9].data.cycle; if (!cycTimer) cycTimer = setInterval(tickCycle, 1000); tickCycle(); }
    buildZoneSelect(); bindControls(); syncLayerMenu(); applyAll();
    TwinApi.ws(onEvent);
  }).catch(function (e) { fail(e.message); });

  function onEvent(ev) {
    if (ev.type === 'tick') {
      robots = (ev.payload.robots && ev.payload.robots.length ? ev.payload.robots : robots);
      devices.forEach(function (d) { var s = ev.payload.devices.filter(function (x) { return x.deviceId === d.deviceId; })[0]; if (s) d.status = s.status; });
      renderZonePanel(); renderTables(); pushState();
    } else if (ev.type === 'task.progress') {
      var t = tasks.filter(function (x) { return x.taskId === ev.payload.taskId; })[0];
      if (t) { t.progress.percent = ev.payload.percent; t.stage = ev.payload.stage; if (ev.payload.percent >= 100) t.result = 'passed'; renderStrip(); }
    } else if (ev.type === 'device.status') { renderZonePanel(); }
    else if (ev.type === 'cycle') { renderCycle(ev.payload); }
    else if (ev.type === 'alarm.update') { renderAlarms(); pushState(); }
  }

  /* ---------- ① 指标：五数 × 三周期（决策 Q3） ---------- */
  /* ---------- ① 四张数据表（2026-11-06 定稿：委托/样品/试验项目/调度，报告份数不再展示） ---------- */
  var SRC_NAME2 = { daq: '数采', dispatch: '调度', iot: '物联', rule: '判定规则' };
  var ROWS = {
    entrust: [
      { k: 'total', label: '委托任务总数', head: true },
      { k: 'power', label: '电力电缆类', sub: true, of: 'total' },
      { k: 'safety', label: '安全工器具类', sub: true, of: 'total' }
    ],
    samples: [
      { k: 'received', label: '已收样', head: true },
      { k: 'testing', label: '正在检测', of: 'received' },
      { k: 'done', label: '已完成', cls: 'ok', of: 'received' }
    ],
    testItems: [
      { k: 'all', label: '试验项目合计', head: true, computed: function (v) { return v.testing + v.pending + v.done; } },
      { k: 'testing', label: '正在检测', of: 'all' },
      { k: 'pending', label: '待检测', of: 'all' },
      { k: 'done', label: '已完成检测', cls: 'ok', of: 'all' },
      { k: 'overdue', label: '未完成中·逾期', cls: 'warn', noPct: true, lims: true, pick: 'overdue' },
      { k: 'dueSoon', label: '未完成中·临期(3天内)', cls: 'due', noPct: true, lims: true, pick: 'dueSoon' }
    ],
    dispatch: [
      { k: 'done', label: '调度任务已完成', head: true, cls: 'ok' },
      { k: 'blocked', label: '阻塞', cls: 'warn' },
      { k: 'blockedResolved', label: '其中已解决', sub: true, of: 'blocked', cls: 'ok' },
      { k: 'blockedUnresolved', label: '其中未解决', sub: true, of: 'blocked', cls: 'warn' }
    ]
  };
  function renderTables() {
    if (!status || !status.panels) return;
    var per = status.panels, stamp = new Date(status.updatedAt || Date.now()).toLocaleTimeString('zh-CN', { hour12: false });
    $('#tables').innerHTML = Object.keys(per).map(function (key) {
      var p = per[key], v = p.periods[st.period], rows = ROWS[key] || [];
      var body = rows.map(function (r) {
        var val = r.computed ? r.computed(v) : v[r.k];
        if (val == null) return '<tr><td>' + r.label + '</td><td class="v na">—</td><td class="pct"></td></tr>';
        var base = r.of ? (r.computed ? r.computed(v) : v[r.of]) : null;
        var pct = (!r.noPct && base) ? Math.round(val / base * 100) + '%' : '';
        var tag = r.lims ? '<span class="limstag" title="口径来自 LIMS「要求检测完成时间」，当前为 Mock 数据">LIMS</span>' : '';
        var tip = '';
        if (r.pick) {
          var list = planItems.filter(function (x) { return x[r.pick]; });
          tip = ' title="' + escapeHtml(list.map(function (x) { return x.sampleId + ' ' + x.item + ' · 要求 ' + x.requiredAt; }).join('\n') || '无') + '"';
        }
        return '<tr class="' + (r.head ? 'head ' : 'sub ') + (r.cls || '') + '"' + tip + '><td>' + r.label + tag + '</td><td class="v">' + val + '</td><td class="pct">' + pct + '</td></tr>';
      }).join('');
      var c = v.compare;
      var foot = c == null ? '' : '<span class="d ' + (c >= 0 ? 'up' : 'down') + '">' + (c >= 0 ? '▲' : '▼') + Math.abs(c) + '%</span><span>' + ({ day: '较上日', month: '较上月', year: '较去年' })[st.period] + '</span>';
      return '<section class="dtable"><header><b>' + p.title + '</b><span class="src' + (dataError ? ' err' : '') + '">' +
        (dataError ? '数据延迟' : (SRC_NAME2[p.source] || p.source) + ' · ' + stamp) + '</span></header>' +
        '<table><tbody>' + body + '</tbody></table>' + (foot ? '<footer>' + foot + '</footer>' : '') +
        (p.note ? '<footer>' + p.note + '</footer>' : '') + '</section>';
    }).join('');
  }
  /* 时钟：大屏右上角常驻，秒级走动 */
  function tickClock() {
    var el = $('#clock'); if (!el) return;
    var WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      var n = new Date(), z = function (x) { return (x < 10 ? '0' : '') + x; };
    var ds = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    el.setAttribute('datetime', n.toISOString());
    el.innerHTML = ds + ' <b>' + z(n.getHours()) + ':' + z(n.getMinutes()) + ':' + z(n.getSeconds()) + '</b><span class="wd">' + WD[n.getDay()] + '</span>';
  }

  /* ---------- ② 告警：闭环三态只读（决策 Q2） ---------- */
  function alarmOpen() { return alarms.filter(function (a) { return a.status !== 'resolved'; }); }
  function openAlarm(a) {
    openDetail('<h3>' + escapeHtml(a.title) + '</h3><div class="sub">' + a.zoneId.replace('Z-', '') + ' 区 · ' + a.grade + ' 级 · ' + a.occurredAt + '</div>' +
      '<div class="row"><span>原因</span><b style="max-width:200px;text-align:right">' + escapeHtml(a.reason) + '</b></div>' +
      '<div class="row"><span>闭环状态</span><b>' + ST_AB(a.status) + '</b></div>' +
      '<div class="row"><span>派至</span><b>' + escapeHtml(a.dispatchedTo || '待派发') + (a.dispatchedAt ? ' · ' + a.dispatchedAt : '') + '</b></div>' +
      (a.resolvedAt ? '<div class="row"><span>解除</span><b>' + a.resolvedAt + ' ' + escapeHtml(a.resolvedBy || '') + '</b></div>' : '') +
      '<div class="row"><span>来源系统</span><b>' + (SRC_NAME[a.source] || a.source || '—') + '</b></div>' +
      '<p style="font-size:11px;color:var(--tw-color-textMuted)">MVP 只呈现当前告警与闭环状态；事件序列回溯（原 S3）已移出本期范围。孪生只读，处置与解除由来源系统回传。</p>');
    var z = (a.zoneId || '').replace('Z-', '');
    if (z) sceneCmd('view', { view: z === '106' ? 'close' : z + '-close' });   /* 30 秒定位：镜头飞到告警所在区域 */
    if (a.deviceId) { var d = devices.filter(function (x) { return x.deviceId === a.deviceId; })[0]; if (d) { detailDev = d; pollRealtime(); if (d.modelNode) sceneCmd('equipment-highlight', { id: d.modelNode.replace('cad:', '') }); } }
    else if (String(a.deviceId).indexOf('RB') === 0) { var r0 = robots.filter(function (x) { return x.robotId === a.deviceId; })[0]; if (r0) flashHint('关联机器人 ' + r0.robotId + ' · ' + (r0.currentFlowName || '无在制任务')); }
  }

  /* 告警分区口径以数据为准（seed.overview['alarm-sections'] → /api/overview/alarm-sections）。
     下面三条只是接口缺数据时的兜底，避免装载失败后右栏整块空掉。 */
  var SECTIONS = [
    { id: 'A', key: 'anomaly', title: '异常告警', desc: '调度任务卡住 / 机器人未到位 / 设备工作状态异常 / 环境越限' },
    { id: 'B', key: 'blockage', title: '阻塞 · 瓶颈告警', desc: '工位积压 / 储位紧张 / 节拍与等待超阈' },
    { id: 'C', key: 'calibration', title: '校准期限告警', desc: '校准已过期 / 3 天内到期预警 / 维护到期' }
  ];
  function setSections(list) {
    if (!Array.isArray(list) || !list.length) return;
    if (!list.every(function (x) { return x && x.id && x.title && x.key; })) return;   /* 数据不合规→保持兜底，界面不能空 */
    SECTIONS = list.slice();
    renderAlarms();
    if (st.mode === 'ZONE') renderZonePanel();
  }
  function alarmRows(list, cls) {
    return list.map(function (x) {
      var attrs = ' class="' + cls + (x.status === 'resolved' ? ' is-resolved' : '') + '" data-alarm="' + x.alarmId + '" data-dev="' + (x.deviceId || '') + '"' +
        ' tabindex="0" role="button" aria-label="' + escapeHtml(x.grade + ' 级 ' + x.title + '，' + ST_AB(x.status) + '，回车查看详情') + '"' +
        ' data-zone="' + x.zoneId.replace('Z-', '') + '" data-grade="' + x.grade + '" data-status="' + x.status + '"' +
        ' data-to="' + escapeHtml(x.dispatchedTo || '') + '" data-title="' + escapeHtml(x.title) + '"';
      return '<div' + attrs + '>' +
        '<div class="l1"><span>' + escapeHtml(x.title) + '</span><span class="tm">' + x.occurredAt + '</span></div>' +
        '<div class="rs">' + escapeHtml(x.reason) + '</div>' +
        '<div class="l2"><span class="st ' + x.status + '">' + ST_AB(x.status) + '</span><span class="zn">' + x.zoneId.replace('Z-', '') + ' 区</span>' +
        '<span class="to" title="派至 ' + escapeHtml(x.dispatchedTo || '待派发') + '">派至 ' + escapeHtml(x.dispatchedTo || '待派发') + '</span>' + (cls === 'st-row' ? '<span class="tr">详情</span>' : '') + '</div></div>';
    }).join('');
  }
  function secBlock(sec, pool) {
    var all = pool.filter(function (x) { return x.grade === sec.id; });
    var open = all.filter(function (x) { return x.status !== 'resolved'; });
    var mode = st.alarmFilter[sec.id] || 'open';
    var shown = mode === 'all' ? all : open;
    var rows = alarmRows(shown, 'st-row');
    return '<section class="asec" data-sec="' + sec.id + '">' +
      '<header><span class="gd ' + sec.id.toLowerCase() + '">' + sec.id + '</span><b>' + sec.title + '</b>' +
      '<span class="cnt">今日 ' + all.length + ' · 未解除 ' + open.length + '</span>' +
      '<span class="toggle" role="group" aria-label="' + sec.title + '筛选">' +
      '<button class="mini' + (mode === 'open' ? ' active' : '') + '" data-alarmfilter="open" data-sec="' + sec.id + '">只看未解除</button>' +
      '<button class="mini' + (mode === 'all' ? ' active' : '') + '" data-alarmfilter="all" data-sec="' + sec.id + '">全部</button></span></header>' +
      '<div class="asec-body"><div class="asec-track' + (rows ? ' scroll' : '') + '">' + (rows || '<div class="zp-empty">今日无' + sec.title + '</div>') + (rows ? rows : '') + '</div></div>' +
      '</section>';
  }
  function renderAlarms() {
    var openN = alarmOpen().length;
    $('#streamMeta').textContent = '今日 ' + alarms.length + ' 条 · 未解除 ' + openN + ' · 悬停暂停';
    $('#streamTrack').innerHTML = SECTIONS.map(function (sec) { return secBlock(sec, alarms); }).join('');
    keyable($('#streamTrack'));
  }

  /* ---------- ③ 106 主叙事：机器人卡住 / 当前调度任务 / 设备状态 / 异常（决策 Q4） ---------- */
  function stamp(z) { return function (d) { d.zoneId = d.zoneId || 'Z-' + z; return d; }; }   /* 区域归属=数据来源分区（删机器人浮条时曾被连带删掉，导致整条装载链中断） */
  function zoneDevices(z) { return devices.filter(function (d) { return (d.zoneId || '').slice(2) === z; }); }

  /* ---------- 区域视图五类信息：设备 / 环境数据 / 任务统计 / 正在运行的任务 / 告警 ---------- */
  function loadZone() {
    var z = st.zone;
    Promise.all([TwinApi.get('/api/zone/' + z + '/task-stats'), TwinApi.get('/api/zone/' + z + '/running-tasks'), TwinApi.get('/api/zone/' + z + '/alarms')])
      .then(function (r) {
        if (st.mode !== 'ZONE' || st.zone !== z) return;
        zstats = r[0].data || null; zrunning = (r[1].data && r[1].data.tasks) || []; zalarms = (r[2].data && r[2].data.alarms) || [];
        renderZonePanel();
      }).catch(function (e) { fail('区域数据加载失败：' + e.message); });
  }
  function zp(sel) { return document.querySelector('#zonePanel ' + sel); }
  function renderZonePanel() {
    if (st.mode !== 'ZONE') return;
    var z = st.zone, zn = (zones.filter(function (x) { return x.zoneId === 'Z-' + z; })[0] || {}), pool = zoneDevices(z);
    $('#zpName').textContent = z + ' ' + (zn.name || '');
    $('#zpMeta').textContent = (zn.deviceCount || 0) + ' 台建档 · 状态 ' + (zn.status === 'alarm' ? '异常' : zn.status === 'running' ? '运行中' : '空闲') + ' · 数据 ' + (zn.detailLevel === 'device' ? '分区明细' : '台账投影');

    /* ① 设备（106 含复合机器人与卡住判定） */
    var devSig = pool.map(function (d) { return d.deviceId + d.status; }).join('|') + robots.map(function (r) { return r.robotId + r.taskElapsedMin; }).join('|');
    if (zpSig.dev !== devSig) {
      zpSig.dev = devSig;
      var bad = {}; zalarms.forEach(function (a) { if (a.status !== 'resolved' && a.deviceId) bad[a.deviceId] = 1; });
      var rows = pool.slice().sort(function (a, b) { return (bad[b.deviceId] ? 1 : 0) - (bad[a.deviceId] ? 1 : 0); }).map(function (d) {
        var cls = bad[d.deviceId] ? 'alarm' : d.status;
        return '<div class="zp-row ' + cls + '" data-dev="' + d.deviceId + '" data-cad="' + (d.modelNode || '').replace('cad:', '') + '"><i class="dot"></i><span class="nm">' + d.code + '</span><span class="sub">' + escapeHtml(d.subZone) + ' · ' + ST_CN(cls) + '</span></div>';
      }).join('');
      if (z === '106') rows += robots.map(function (r) {
        var stall = (r.taskElapsedMin != null && r.stallLimitMin != null && r.taskElapsedMin > r.stallLimitMin && r.action !== 'charging');
        return '<div class="zp-row ' + (stall ? 'alarm' : 'working') + '" data-robot="' + r.robotId + '"><i class="dot"></i><span class="nm">' + r.robotId + '</span>' +
          (stall ? '<span class="tag stall">疑似卡住</span>' : '<span class="tag">' + (r.action === 'charging' ? '充电中' : r.action === 'moving' ? '行进中' : '待机') + '</span>') +
          '<span class="sub">' + escapeHtml(r.currentFlowName || '无在制任务') + ' · 已 ' + (r.taskElapsedMin || 0) + '/' + (r.stallLimitMin || '—') + 'min · 🔋' + Math.round(r.battery) + '%</span></div>';
      }).join('');
      zp('#zpDevices .zp-body').innerHTML = rows || '<div class="zp-empty">该区 V1 未建设备档案（台账投影：' + (zn.deviceCount || 0) + ' 台）。接入数采分区数据后自动出现。</div>';
      zp('#zpDevicesN').textContent = pool.length ? pool.length + ' 台建档' + (z === '106' ? ' · ' + robots.length + ' 台机器人' : '') : '未建档';
    }

    /* ② 环境数据（与场景节点层同源：V4 节点协议快照） */
    var env = envNodes.filter(function (n) { return String(n.roomId) === z; });
    var envSig = env.map(function (n) { return n.id + JSON.stringify(n.values) + n.status; }).join('|');
    if (zpSig.env !== envSig) {
      zpSig.env = envSig;
      zp('#zpEnv .zp-body').innerHTML = env.map(function (n) {
        var v = n.values || {}, txt;
        if (v.temperature != null) txt = v.temperature + '℃ · ' + v.humidity + '%RH';
        else if (v.illuminance != null) txt = v.illuminance + ' lx';
        else if (v.detected != null) txt = v.detected ? '已触发' : '正常';
        else if (v.exceeded != null) txt = v.exceeded ? '超限' : '正常';
        else if (v.activity != null) txt = v.activity ? '有人活动' : '无人';
        else if (v.contact != null) txt = '触点' + (v.contact === 'closed' ? '闭合' : '断开');
        else if (v.connection != null) txt = v.videoSource ? '视频在线' : '画面未接入';
        else txt = '—';
        return '<div class="zp-row ' + (n.status === 'normal' ? 'ready' : 'alarm') + '" data-node="' + n.id + '"><i class="dot"></i><span class="nm">' + escapeHtml(n.name) + '</span><span class="tag">' + NODE_CN(n.type) + '</span><span class="sub">' + txt + ' · ' + new Date(n.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) + '</span></div>';
      }).join('') || '<div class="zp-empty">该区无环境监测点位（物联系统未部署）。</div>';
      zp('#zpEnvN').textContent = env.length ? env.length + ' 个点位 · 5s 心跳' : '无点位';
    }

    /* ③ 任务统计（跟随顶部周期切换） */
    var per = zstats && zstats.periods ? zstats.periods[st.period] : null;
    zp('#zpStatsPeriod').textContent = ({ day: '本日', month: '本月', year: '本年' })[st.period];
    if (per) {
      /* 四格口径（2026-11-06 定稿）：完成 / 执行中 / 异常 / 排队，不含总数——总数只做 title 备注，避免与三源总数对不上时被质疑 */
      zp('#zpStats .zp-body').innerHTML = '<div class="zp-grid" title="任务总数 ' + per.total + '（含排队未开始）· 口径：数采">' +
        '<div class="zp-stat ok"><b>' + per.done + '</b><span>已完成</span></div>' +
        '<div class="zp-stat run"><b>' + per.running + '</b><span>执行中</span></div>' +
        '<div class="zp-stat warn"><b>' + per.abnormal + '</b><span>异常挂起</span></div>' +
        '<div class="zp-stat wait"><b>' + per.queued + '</b><span>排队</span></div></div>' +
        (zstats.note ? '<div class="zp-empty" style="margin-top:7px">' + escapeHtml(zstats.note) + '</div>' : '');
    } else {
      zp('#zpStats .zp-body').innerHTML = '<div class="zp-empty">该区无任务口径' + (zstats && zstats.note ? '：' + escapeHtml(zstats.note) : '') + '。</div>';
    }

    /* ④ 正在运行的任务（调度 + 数采两路合并，标来源） */
    var runSig = zrunning.map(function (t) { return t.taskId + (t.percent || '') + (t.elapsedMin || ''); }).join('|');
    if (zpSig.run !== runSig) {
      zpSig.run = runSig;
      zp('#zpRunning .zp-body').innerHTML = zrunning.map(function (t) {
        var over = t.plannedMin && t.elapsedMin > t.plannedMin;
        return '<div class="zp-run" data-dev="' + (t.deviceCode || '') + '">' +
          '<div class="l1"><span class="tag ' + (t.kind === 'dispatch' ? 'dis' : 'daq') + '">' + (t.kind === 'dispatch' ? '调度' : '数采') + '</span><b>' + escapeHtml(t.name) + '</b>' +
          (over ? '<span class="tag stall">超时</span>' : '') + '<span class="sub">' + (t.deviceCode || '—') + (t.robotId ? ' · ' + t.robotId : '') + '</span></div>' +
          '<div class="l2">' + (t.sampleId ? t.sampleId + ' · ' : '') + escapeHtml(t.stage || '') + ' · ' + (t.startedAt ? '起 ' + t.startedAt + ' · ' : '') + '已 ' + (t.elapsedMin || 0) + 'min' + (t.plannedMin ? '（计划 ' + t.plannedMin + '）' : '') + (t.percent != null ? ' · ' + t.percent + '%' : '') + '</div>' +
          (t.percent != null ? '<div class="zp-bar"><i style="width:' + t.percent + '%"></i></div>' : '') + '</div>';
      }).join('') || '<div class="zp-empty">当前无在制任务。</div>';
      zp('#zpRunningN').textContent = zrunning.length ? zrunning.length + ' 条在制' : '空闲';
    }

    /* ⑤ 告警（本区域，只读三态） */
    var abSig = secIds().map(function (k) { return k + ':' + (st.alarmFilter[k] || 'open'); }).join(',') + '|' + zalarms.map(function (a) { return a.alarmId + a.status; }).join('|');
    if (zpSig.ab !== abSig) {
      zpSig.ab = abSig;
      var zopen = zalarms.filter(function (a) { return a.status !== 'resolved'; });
      zp('#zpAlarms .zp-body').innerHTML = SECTIONS.map(function (sec) {
        var all = zalarms.filter(function (a) { return a.grade === sec.id; });
        var op = all.filter(function (a) { return a.status !== 'resolved'; });
        var shown = st.alarmFilter[sec.id] === 'all' ? all : op;
        var rows = alarmRows(shown, 'zp-row');
        return '<div class="zsec" data-sec="' + sec.id + '"><div class="zsec-hd"><span class="gd ' + sec.id.toLowerCase() + '">' + sec.id + '</span>' +
          '<b>' + sec.title + '</b><span class="cnt">今日 ' + all.length + ' · 未解除 ' + op.length + '</span>' +
          '<span class="toggle"><button class="mini' + (st.alarmFilter[sec.id] !== 'all' ? ' active' : '') + '" data-alarmfilter="open" data-sec="' + sec.id + '">只看未解除</button>' +
          '<button class="mini' + (st.alarmFilter[sec.id] === 'all' ? ' active' : '') + '" data-alarmfilter="all" data-sec="' + sec.id + '">全部</button></span></div>' +
          (rows || '<div class="zp-empty">本区今日无' + sec.title + '</div>') + '</div>';
      }).join('');
      zp('#zpAlarmsN').textContent = '今日 ' + zalarms.length + ' · 未解除 ' + zopen.length;
      keyable(zp('#zpAlarms'));
    }
  }
  function ST_CN(x) { return { working: '在测', ready: '就绪', standby: '待机', stopped: '停止', alarm: '异常' }[x] || x; }
  function ST_AB(x) { return { active: '未解除', dispatched: '已派发', resolved: '已解除' }[x] || x; }
  function NODE_CN(t) { return { temperature: '温湿度', smoke: '烟感', gas: '气体', water: '水浸', motion: '人体', switch: '开关量', camera: '视觉', light: '照明' }[t] || t; }

  /* ---------- ④ 底栏：只展示今日任务（滚动表格，透明底） ---------- */
  function renderStrip() {
    var el = $('#ttTrack'), rows = tasks.map(function (t) {
      var cls = t.result === 'alarm' ? 'abn' : t.result === 'passed' ? 'ok' : (t.stage || '').indexOf('中') > 0 ? 'run' : 'wait';
      return '<div class="tt-row" data-task="' + t.taskId + '" data-devcode="' + (t.deviceChain[0] || '') + '">' +
        '<span class="no">' + t.taskId + '</span>' +
        '<span class="nm">' + t.sampleId + ' · ' + escapeHtml(t.type) + '</span>' +
        '<span class="st ' + cls + '">' + escapeHtml(t.stage) + '</span>' +
        '<span class="chain">' + (t.deviceChain || []).join(' → ') + (t.source === 'WORKSTATION' ? ' · 工位手动录入' : ' · LIMS 下发') + '</span>' +
        '<span class="pg"><i><b style="width:' + t.progress.percent + '%;background:' + (t.result === 'alarm' ? 'var(--tw-color-alertRed)' : 'var(--tw-color-brand)') + '"></b>' + t.progress.percent + '%</span></div>';
    }).join('');
    el.innerHTML = rows + rows;
    el.style.animationDuration = Math.max(16, tasks.length * 5) + 's';
  }

  /* 与 mock/场景同一套时间轴公式：t0=停靠开始，travel 在其之前；按墙上时钟取模 */
  function cycleAt(t) {
    if (!cycleDef || !cycleDef.stops) return null;
    var S = cycleDef.stops, L = cycleDef.loopSec; t = (t % L);
    var cur = S[S.length - 1], idx = S.length - 1, tail = false;
    for (var i = 0; i < S.length; i++) { if (t < S[i].t0 + S[i].dwellSec) { cur = S[i]; idx = i; break; } }
    if (t >= S[S.length - 1].t0 + S[S.length - 1].dwellSec) tail = true;
    if (tail) return { order: S.length, label: '返回 102 家位/充电位', flow: '返航', phase: 'travel', remainingSec: Math.max(0, Math.round(L - t)), taskNo: null, deviceCode: null, total: S.length };
    var dwell = t >= cur.t0;
    return { order: cur.order, label: cur.label, flow: cur.flow, taskNo: cur.taskNo, deviceCode: cur.deviceCode, total: S.length,
      phase: dwell ? 'dwell' : 'travel', remainingSec: Math.max(0, Math.round(dwell ? cur.t0 + cur.dwellSec - t : cur.t0 - t)) };
  }
  function tickCycle() { renderCycle(cycleAt(Date.now() / 1000)); }

  /* ---------- 无人化任务循环剧本指示 ---------- */
  function renderCycle(c) {
    if (!c) return;
    $('#cyNow').textContent = c.order + '/' + c.total;
    $('#cyLabel').textContent = '无人化循环 · ' + (c.phase === 'dwell' ? '停靠作业' : '行走中');
    $('#cySub').textContent = c.label + (c.flow ? ' · ' + c.flow : '') + ' · 剩余 ' + c.remainingSec + 's' + (c.deviceCode ? ' · 服务 ' + c.deviceCode : '');
    var done = (c.order - 1 + (c.phase === 'dwell' ? 0.5 : 0.2)) / c.total;
    $('#cyBar').style.width = Math.round(Math.min(1, done) * 100) + '%';
  }

  /* ---------- 场景状态推送 ---------- */
  function pushState() {
    if (!alarms.length) return;
    var bad = {}; alarms.forEach(function (x) { if (x.status !== 'resolved' && x.deviceId && x.deviceId.indexOf('eq_') === 0) bad[x.deviceId] = 1; });
    toScene('state', {
      robots: robots, routeNote: routeNote, layers: st.layers, quality: st.quality,
      deviceStatus: devices.reduce(function (m, d) { m[d.modelNode] = bad[d.deviceId] ? 'alarm' : d.status; return m; }, {}),
      walls: walls,
      objects: devices.reduce(function (m, d) { m[(d.modelNode || '').replace('cad:', '')] = { code: d.code, name: d.name, type: d.type, subZone: d.subZone, status: bad[d.deviceId] ? 'alarm' : d.status, params: d.keyParams || [] }; return m; }, {})
    });
  }


  /* ---------- V4 节点协议：nodes-ready → 推送快照点亮 IoT 层；room-selected → 切特写 ---------- */
  let nodeConfigs = null;
  fetch('data/iot-nodes.json').then(function (r) { return r.json(); }).then(function (c) { nodeConfigs = c.nodes; });
  function sendSnapshots() {
    if (!nodeConfigs || !scene.contentWindow) return;
    import('./iot/monitoring-data.js').then(function (m) {
      var now = new Date().toISOString();
      var nodes = nodeConfigs.map(function (n) {
        var v = m.normalValues(n);
        Object.keys(v).forEach(function (k) { if (typeof v[k] === 'number') v[k] = Math.round((v[k] + (Math.random() - 0.5) * 0.6) * 10) / 10; });
        return { id: n.id, roomId: n.roomId, name: n.name, type: n.type, position: n.position, status: 'normal', values: v, updatedAt: now };
      });
      envNodes = nodes;   /* 面板「环境数据」与场景节点层同源，避免两处各算一套 */
      scene.contentWindow.postMessage({ channel: 'room-tour-node-v3', type: 'snapshots', nodes: nodes }, location.origin);
      if (st.mode === 'ZONE') renderZonePanel();
    });
  }
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || d.channel !== 'room-tour-node-v3') return;
    if (d.type === 'nodes-ready') { sendSnapshots(); setInterval(sendSnapshots, 5000); }
    /* 场景内点房间标签 → 宿主叙事同步（决策 Q7：区域下钻与场景双向绑定） */
    if (d.type === 'room-selected' && d.roomId) { if (st.mode !== 'ZONE' || st.zone !== d.roomId) setMode('ZONE', d.roomId); }
  });



  /* ---------- 场景上行：就绪握手、性能、拾取、遥控、避让自检 ---------- */
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || (d.channel !== 'room-tour-preview-v1' && d.channel !== 'future-lab-tech-blue-spatial')) return;
    if (d.type === 'perf') { var pf = $('#perf'); if (pf) pf.textContent = 'draw calls ' + d.calls; }   /* 性能读数按 2026-11-06 反馈不再常驻显示 */
    if (d.type === 'bridge-ready') {
      bridgeReady = true; sceneReady = true;
      if (pendingState) { sendScene(pendingState.type, pendingState.data); pendingState = null; }
      if (pendingView) { sceneCmd('view', pendingView); pendingView = null; }   /* 首屏机位/URL 恢复的视角补发 */
      pushState(); applyLayers();
    }
    if (d.type === 'device') { /* 场景内已弹出实体信息卡，宿主不再重复开右侧详情 */ }
    if (d.type === 'device-open') openDeviceByCad(d.device);
    if (d.type === 'remote') handleKey(d.key);
    if (d.type === 'route-audit') { routeAudit = d; renderAudit(); renderZonePanel(); }
  });
  /* 自检结果不再常驻显示（2026-11-06 反馈）：
     · 通过 → 界面上什么都不出现
     · 未通过 → 瞬时提示条报出来 + body[data-route-audit] 留痕，QA/交付可断言，红线「违规>0 不上线」仍然成立 */
  function renderAudit() {
    if (!routeAudit) return;
    document.body.dataset.routeAudit = routeAudit.violations + '/' + routeAudit.checked + '/' + (routeAudit.obstacles || 0) + '/' + (routeAudit.walls || 0);
    if (routeAudit.violations > 0) flashHint('避让校验未通过：' + routeAudit.violations + ' 处（' +
      (routeAudit.detail || []).slice(0, 2).map(function (x) { return x.robot + ' ' + x.type; }).join('、') + '）');
  }
  function applyLayers() { Object.keys(st.layers).forEach(function (k) { toScene('layer', { layer: k, enabled: !!st.layers[k] }); }); toScene('quality', { level: st.quality }); }

  /* ---------- 三层控制 ---------- */
  function zoneView(z) { return z === '106' ? 'close' : z + '-close'; }
  /* 下钻动效：先让桥接层记录切换前构图，再切视角+分组抬升，最后由桥接层补间推近（不再生硬跳帧） */
  /* 下钻＝纯相机补间：begin 记录旧构图 → 切视角 → drill 平滑回落。
     不再发 focus-scene（分组抬升）：它会给 roomIds 里的每个房间描一圈蓝色轮廓，
     总览传全部房间＝满屏蓝框（2026-11-06 产品负责人反馈，已回退）。 */
  function drillTo(view) {
    toScene('camera', { action: 'begin' });
    sceneCmd('view', { view: view });
    toScene('camera', { action: 'drill' });
  }
  function applyAll() {
    document.querySelectorAll('.mode').forEach(function (b) { b.classList.toggle('active', (st.mode === 'S1' && b.dataset.mode === 'S1') || (st.mode === 'S3' && b.dataset.mode === 'S3')); });
    if ($('#zoneSel').options.length) $('#zoneSel').value = st.zone;
    /* 区域视图=右侧五块面板；浮层（告警卡/机器人卡）与底栏让位，避免同一信息出现两次 */
    $('#zonePanel').hidden = st.mode !== 'ZONE';
    $('#alarmStream').hidden = st.mode === 'ZONE';   /* 区域视图时让位给右侧面板（面板内的告警块已按 A/B/C 三分区呈现，控件不丢） */
    /* 机器人状态条与底部说明条已整体删除（2026-11-06）；「收起底栏」只作用于今日任务表 */
    $('#taskStrip').hidden = st.mode !== 'S1' || !!st.strip;
    /* 详情面板随视图重新停靠：总览时覆盖右侧，区域视图时让位到面板左边，否则会挡住五类信息（实测缺陷） */
    var dEl = $('#detail'); if (dEl && !dEl.hidden) dEl.classList.toggle('docked', st.mode === 'ZONE');

    $('#stripBtn').textContent = st.strip ? '▴ 展开底栏' : '▾ 收起底栏'; $('#stripBtn').setAttribute('aria-pressed', !!st.strip);
    $('#stripBtn').disabled = st.mode !== 'S1';
    drillTo(st.mode === 'ZONE' ? zoneView(st.zone) : 'overall-101');
    renderTables(); renderAlarms(); renderStrip(); pushState(); writeURL();
    if (st.mode === 'ZONE') { loadZone(); renderZonePanel(); }

  }
  function setAlarmFilter(sec, v) {
    if (!sec || !v || st.alarmFilter[sec] === v) return;
    st.alarmFilter[sec] = v;                       /* 三个分区各自独立筛选，互不影响 */
    document.querySelectorAll('[data-sec="' + sec + '"][data-alarmfilter]').forEach(function (x) { x.classList.toggle('active', x.dataset.alarmfilter === v); });
    renderAlarms(); renderZonePanel(); writeURL();
  }

  function setMode(m, zone) {
    st.mode = m;
    if (zone && zone !== st.zone) { st.zone = zone; $('#detail').hidden = true; clearInterval(rtTimer); detailDev = null; }  /* 换区域即收起上一区域的详情，避免串区 */
    applyAll(); flashHint();
  }
  var FS = ['requestFullscreen', 'webkitRequestFullscreen', 'webkitEnterFullscreen'];
  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFullscreen() {
    var el = document.documentElement;
    if (isFull()) { var x = document.exitFullscreen || document.webkitExitFullscreen; if (x) x.call(document); }
    else { for (var i = 0; i < FS.length; i++) { if (typeof el[FS[i]] === 'function') { var q = el[FS[i]](); if (q && q.catch) q.catch(function () { flashHint('浏览器拒绝了全屏请求'); }); break; } } }
  }
  function syncFs() {
    var b = $('#fsBtn'); if (!b) return;
    var on = isFull();
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.classList.toggle('active', on);
    var t = b.querySelector('.fs-t'); if (t) t.textContent = on ? '退出全屏' : '全屏';
    document.body.dataset.full = on ? '1' : '0';
  }
  function handleKey(k) {
    if (k === 'PageDown') step(1);
    else if (k === 'PageUp') step(-1);
    else if (k === 'Home' || k === '1') setMode('S1');
    else if (k === 'End') setMode('ZONE', zones.length ? zones[zones.length - 1].zoneId.slice(2) : '106');
    else if (k === '2') setMode('ZONE', '106');
    else if (k === 'f' || k === 'F') toggleFullscreen();
    else if (k === 'Escape') { $('#detail').hidden = true; clearInterval(rtTimer); toScene('camera', { action: 'reset' }); }
    else return false;
    flashHint(); return true;
  }
  function step(dir) {
    var cur = st.mode === 'ZONE' ? 'Z' + st.zone : st.mode, i = ORDER.indexOf(cur);
    var next = ORDER[(i + (dir > 0 ? 1 : -1) + ORDER.length) % ORDER.length];
    if (next.charAt(0) === 'Z') setMode('ZONE', next.slice(1)); else setMode(next);
  }

  function buildZoneSelect() {
    $('#zoneSel').innerHTML = zones.map(function (z) {
      return '<option value="' + z.zoneId.slice(2) + '"' + (z.detailLevel !== 'device' ? ' data-lite="1"' : '') + '>' + z.zoneId.slice(2) + ' ' + escapeHtml(z.name) + (z.alarmState === 'alarm' ? ' ⚠' : '') + '</option>';
    }).join('');
    $('#zoneSel').value = st.zone;
  }

  /* ---------- 键盘可达（2026-11-06 反馈：告警行键盘点不到） ----------
     这些行是「容器 + 事件委托」，没有内联 onclick，所以 js/ui-a11y.js 的 fixClickable 抓不到它们；
     统一由 keyable() 在渲染后补 role/tabindex/aria-label，Enter 与空格触发同一入口（等价于点击）。 */
  var KEYABLE = '[data-alarm], [data-dev], [data-robot], [data-task]';
  function keyable(root) {
    (root || document).querySelectorAll(KEYABLE).forEach(function (el) {
      if (el.tagName === 'BUTTON' || el.tagName === 'A') return;
      if (el.hasAttribute('role') && el.hasAttribute('tabindex')) return;
      var label = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (!label) return;
      el.setAttribute('role', 'button'); el.tabIndex = 0;
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', label + '，回车查看');
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var el = e.target && e.target.closest ? e.target.closest(KEYABLE) : null;
    if (!el || el === document.body) return;
    e.preventDefault(); e.stopPropagation();      /* 空格不能被遥控翻页/页面滚动抢走 */
    el.click();
  });

  function bindControls() {
    document.querySelectorAll('.mode').forEach(function (b) { b.onclick = function () { setMode(b.dataset.mode); }; });
    $('#zoneSel').onchange = function () { setMode('ZONE', this.value); };
    document.querySelectorAll('.seg').forEach(function (b) { b.onclick = function () {
      document.querySelectorAll('.seg').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); st.period = b.dataset.period; renderTables(); renderZonePanel(); writeURL();
    }; });
    /* 筛选控件改为事件委托：同一套按钮现在渲染在两处（右侧告警流头部、区域视图的告警块），必须统一响应 */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-alarmfilter]'); if (!btn) return;
      setAlarmFilter((btn.closest('[data-sec]') || { dataset: {} }).dataset.sec || btn.dataset.sec, btn.dataset.alarmfilter);
    });
    document.querySelectorAll('.lic').forEach(function (b) { b.onclick = function () {
      var k = b.dataset.layer; st.layers[k] = st.layers[k] ? 0 : 1;
      b.classList.toggle('on', !!st.layers[k]); b.setAttribute('aria-pressed', !!st.layers[k]);
      toScene('layer', { layer: k, enabled: !!st.layers[k] }); pushState(); writeURL();
      flashHint(b.getAttribute('desc') + '：' + (st.layers[k] ? '开' : '关'));
    }; });
    $('#stripBtn').onclick = function () { st.strip = st.strip ? 0 : 1; applyAll(); };
    /* 低配按钮按 2026-11-06 反馈从大屏移除；能力保留为交付参数 ?quality=low（场景侧 setQuality 仍生效），
       现场要降配时用链接或部署配置，不占演示界面。 */
    $('#fsBtn').onclick = toggleFullscreen;
    document.addEventListener('fullscreenchange', syncFs);
    $('#detailClose').onclick = function () { $('#detail').hidden = true; clearInterval(rtTimer); detailDev = null; };
    /* 遥控翻页（决策 Q1：售前投影 + 翻页笔）。只吃 PgUp/PgDn/Home/End/1·2·3/Esc；
       方向键留给场景相机，避免与三维漫游打架。焦点在 iframe 内时由桥接层转发 remote 消息。 */
    document.addEventListener('keydown', function (e) { if (handleKey(e.key)) e.preventDefault(); });
    $('#alarmStream').addEventListener('click', function (e) {
      var card = e.target.closest('[data-alarm]'); if (!card) return;
      var a0 = alarms.filter(function (x) { return x.alarmId === card.dataset.alarm; })[0];
      if (a0) openAlarm(a0);   /* 单一入口：告警流与区域面板告警行共用同一套详情，不再两处各写一份 */
    });
    $('#zonePanel').addEventListener('click', function (e) {
      var ab = e.target.closest('[data-alarm]');
      if (ab) { var a0 = alarms.filter(function (x) { return x.alarmId === ab.dataset.alarm; })[0]; if (a0) openAlarm(a0); return; }
      var rb = e.target.closest('[data-robot]');
      if (rb) { var r0 = robots.filter(function (x) { return x.robotId === rb.dataset.robot; })[0]; if (r0) openRobot(r0); return; }
      var row = e.target.closest('[data-dev]'); if (!row) return;
      var d = devices.filter(function (x) { return x.deviceId === row.dataset.dev || x.code === row.dataset.dev; })[0];
      if (d) selectDevice(d, (d.modelNode || '').replace('cad:', ''));
    });
  }

  /* 面板 → 场景 双向拾取（P0-2） */
  function selectDevice(d, cadId) {
    detailDev = d; openDetail(deviceHtml(d)); pollRealtime();
    if (cadId) sceneCmd('equipment-highlight', { id: cadId });   /* 面板→场景：场景描边（决策 Q4 异常定位） */
  }

  var hintTimer = null;
  function flashHint(txt) {
    var el = $('#remoteHint'); if (!el) return;
    var where = st.mode === 'S1' ? 'S1 实验室总览' : '区域下钻 · ' + st.zone + ' ' + ((zones.filter(function (z) { return z.zoneId === 'Z-' + st.zone; })[0] || {}).name || '');
    el.textContent = txt || ('翻页 PgUp/PgDn · 1 总览 · 2 无人化区 · F 全屏 · Esc 关闭   ｜   ' + where);
    el.hidden = false; clearTimeout(hintTimer); hintTimer = setTimeout(function () { el.hidden = true; }, 1400);
  }

  function syncLayerMenu() {
    document.querySelectorAll('.lic').forEach(function (b) { b.classList.toggle('on', !!st.layers[b.dataset.layer]); b.setAttribute('aria-pressed', !!st.layers[b.dataset.layer]); });
    syncFs();
    document.querySelectorAll('.seg').forEach(function (b) { b.classList.toggle('active', b.dataset.period === st.period); });
    document.querySelectorAll('[data-alarmfilter]').forEach(function (b) { var sec = b.dataset.sec; if (sec) b.classList.toggle('active', st.alarmFilter[sec] === b.dataset.alarmfilter); });
  }

  /* ---------- 详情与实时 ---------- */
  function deviceHtml(d) {
    var stMap = { working: ['#2878FF', '在测'], ready: ['#16A34A', '就绪'], standby: ['#94A3B8', '待机'], stopped: ['#64748B', '停止'], alarm: ['#E5484D', '异常'] };
    var a = stMap[d.status] || stMap.standby;
    return '<h3>' + escapeHtml(d.name) + '</h3><div class="sub">' + d.code + ' · ' + escapeHtml(d.subZone) + ' · ' + d.type + '</div>' +
      '<div class="row"><span>状态</span><b class="st" style="background:' + a[0] + '">' + a[1] + '</b></div>' +
      '<div class="row"><span>当前任务</span><b>' + (d.currentTaskId || '—') + '</b></div><div class="row"><span>当前样品</span><b>' + (d.currentSampleId || '—') + '</b></div>' +
      '<div class="row"><span>数采分系统</span><b>' + (d.daqUnitId || '—（非检测设备）') + '</b></div>' +
      '<div id="rt"><div class="row"><span>关键参数</span><b>加载中…</b></div></div>' +
      '<p style="font-size:11px;color:var(--tw-color-textMuted)">详情=台账投影；实时=GET /api/device/' + d.deviceId + '/realtime（3s 轮询，生产切 WS）· 孪生只读，不下发控制</p>';
  }
  function pollRealtime() {
    clearInterval(rtTimer); if (!detailDev) return;
    var pull = function () { TwinApi.get('/api/device/' + detailDev.deviceId + '/realtime').then(function (r) {
      var el = $('#rt'); if (!el || !r.data) { if (el) el.innerHTML = '<div class="row"><span>关键参数</span><b>无实时数据</b></div>'; return; }
      el.innerHTML = r.data.keyParams.map(function (p) { return '<div class="row"><span>' + escapeHtml(p.name) + '</span><b>' + p.value + (p.unit ? ' ' + p.unit : '') + '</b></div>'; }).join('') +
        '<div class="row"><span>更新时间</span><b>' + new Date(r.data.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) + '</b></div>';
    }, function () { var el = $('#rt'); if (el) el.innerHTML = '<div class="row"><span>关键参数</span><b>数据延迟 · 请重试</b></div>'; }); };
    pull(); rtTimer = setInterval(pull, 3000);
  }
  function openDetail(html) {
    var el = $('#detail'); el.querySelector('#detailBody').innerHTML = html; el.hidden = false;
    /* 区域视图：详情停靠到面板左侧，两块同时可用（覆盖式会把五类信息全挡住） */
    el.classList.toggle('docked', st.mode === 'ZONE');
  }


  tickClock(); setInterval(tickClock, 1000);   /* 时钟不依赖数据；放在末尾启动，避免 var 提升期调用拿到 undefined */

  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
})();
