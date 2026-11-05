/* 孪生 V2 宿主：只认 TwinApi（/api/*），iframe 场景经 postMessage 驱动 */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var scene = $('#scene'), devices = [], robots = [], alarms = [], tasks = [], samples = [];
  var mode = 'S1', dim = 'machine', rtTimer = null, detailDev = null, dispatchTasks = [];
  var VIEWS = { S1: 'overall-101', S2: 'close', S3: 'close' };
  var KIND_STYLE = { command: ['#2878FF', '6 0'], data: ['#16A34A', '6 0'], sync: ['#94A3B8', '5 5'], query: ['#8B5CF6', '2 5'] };

  function sendScene(type, data) { if (scene.contentWindow) scene.contentWindow.postMessage(Object.assign({ channel: 'twin-v2', type: type }, data), location.origin); }
  function sceneCmd(type, data) { if (scene.contentWindow) scene.contentWindow.postMessage(Object.assign({ channel: 'future-lab-tech-blue-spatial', type: type }, data), location.origin); }

  function fail(msg) { $('#freshDot').className = 'dot stale'; $('#freshTxt').textContent = '数据源异常：' + msg; }

  /* ---------- 数据装载 ---------- */
  TwinApi.ready().then(function () {
    TwinApi.start(2000);
    return Promise.all([
      TwinApi.get('/api/overview/lab-status'), TwinApi.get('/api/overview/zones'),
      TwinApi.get('/api/overview/today-tasks'), TwinApi.get('/api/overview/alarms'),
      TwinApi.get('/api/zone/106/devices'), TwinApi.get('/api/zone/106/robots'),
      TwinApi.get('/api/zone/106/samples'),
      TwinApi.get('/api/zone/106/dispatch-tasks'),
      TwinApi.get('/api/zone/103/devices')
    ]);
  }).then(function (res) {
    renderStatus(res[0].data); renderZones(res[1].data); tasks = res[2].data; renderTasks();
    alarms = res[3].data; renderAlarms(); devices = (res[4].data || []).concat(res[8].data || []); robots = res[5].data; samples = res[6].data; dispatchTasks = res[7].data || [];
    renderRobots(); pushState(); renderTasks();
    TwinApi.ws(onEvent);
  }).catch(function (e) { fail(e.message); });

  function onEvent(ev) {
    if (ev.type === 'tick') {
      robots = ev.payload.robots.concat(robots.filter(function (r) { return !ev.payload.robots.some(function (x) { return x.robotId === r.robotId; }); }));
      devices.forEach(function (d) { var s = ev.payload.devices.filter(function (x) { return x.deviceId === d.deviceId; })[0]; if (s) d.status = s.status; });
      renderRobots(); pushState();
    } else if (ev.type === 'task.progress') {
      var t = tasks.filter(function (x) { return x.taskId === ev.payload.taskId; })[0];
      if (t) { t.progress.percent = ev.payload.percent; t.stage = ev.payload.stage; if (ev.payload.percent >= 100) t.result = 'passed'; renderTasks(); }
    } else if (ev.type === 'alarm.update') { renderAlarms(); }
  }

  /* ---------- 渲染 ---------- */
  function renderStatus(s) {
    $('#kDone').textContent = s.today.tasksDone; $('#kRun').textContent = s.today.tasksRunning;
    $('#kAb').textContent = s.today.tasksAbnormal; $('#kSp').textContent = s.today.samplesProcessed;
  }
  function renderZones(z) {
    var a = { A: 0, B: 0, C: 0 }; (alarms || []).forEach(function (x) { if (x.status === 'active') a[x.grade]++; });
  }
  function renderAlarms() {
    var a = { A: 0, B: 0, C: 0 };
    alarms.forEach(function (x) { if (x.status === 'active') a[x.grade]++; });
    $('#aA').textContent = 'A ' + a.A; $('#aB').textContent = 'B ' + a.B; $('#aC').textContent = 'C ' + a.C;
    $('#andonZone').innerHTML = alarms.filter(function (x) { return x.status === 'active'; }).slice(0, 3).map(function (x, i) {
      var gradeCls = x.grade === 'A' ? 'ga' : x.grade === 'B' ? 'gb' : 'gc';
      return '<div class="andon-card" data-alarm="' + x.alarmId + '" style="animation-delay:' + (i * 60) + 'ms">' +
        '<span class="grade ' + gradeCls + '">Grade ' + x.grade + ' · ' + x.zoneId.replace('Z-', '') + '</span>' +
        '<div class="ico">' + (x.deviceId.indexOf('RB') === 0 ? '🤖' : x.grade === 'B' ? '📈' : '🗄') + '</div>' +
        '<b>' + x.title + '</b><p><i></i>' + x.reason + '</p>' +
        '<button class="ghost" data-trace="' + x.alarmId + '">回溯</button><button data-ack="' + x.alarmId + '">安灯呼叫</button></div>';
    }).join('');
  }
  function renderTasks() {
    if (mode === 'S2') {  /* 调度任务流：真实流程配置（调度系统任务明细结构） */
      $('#taskStrip').innerHTML = dispatchTasks.slice().sort(function (a, b) { return (b.status === 'running') - (a.status === 'running'); }).slice(0, 10).map(function (t) {
        return '<div class="task-chip ' + (t.status === 'running' ? 'run' : 'ok') + '" data-devcode="' + t.deviceCode + '">' +
          '<b>' + t.flowName + '</b><small>' + t.time + ' · ' + t.deviceCode + ' · ' + (t.robotId || '') + '</small>' +
          '<div class="bar"><i style="width:' + (t.status === 'running' ? 55 : 100) + '%"></i></div></div>';
      }).join('');
      return;
    }
    $('#taskStrip').innerHTML = tasks.map(function (t) {
      var cls = t.result === 'alarm' ? 'abn' : t.source === 'WORKSTATION' ? 'ws' : '';
      return '<div class="task-chip ' + cls + '" data-task="' + t.taskId + '"><b>' + t.sampleId + ' · ' + t.type + '</b>' +
        '<small>' + (t.source === 'LIMS' ? 'LIMS 下发' : '工位手动录入') + ' · ' + t.stage + ' · ' + t.deviceChain.join('→') + '</small>' +
        '<div class="bar"><i style="width:' + t.progress.percent + '%"></i></div></div>';
    }).join('');
  }
  function renderRobots() {
    $('#robotZone').innerHTML = robots.map(function (r) {
      var act = r.action === 'charging' ? '充电中' : r.action === 'moving' ? '行进中' : (r.status === 'moving' ? '运输中' : '待机');
      return '<div class="robot-card ' + (r.action === 'charging' ? 'charging' : '') + '"><i></i>' + r.robotId + ' · ' + act +
        (r.servingDeviceId ? ' · 服务 ' + ((devices.filter(function (x) { return x.deviceId === r.servingDeviceId; })[0] || {}).code || r.servingDeviceId) : '') +
        (r.carriedSampleIds && r.carriedSampleIds.length ? ' · 载 ' + r.carriedSampleIds[0] : '') +
        ' <em>🔋' + Math.round(r.battery) + '%</em></div>';
    }).join('');
  }
  function pushState() {
    var alarmDevs = {}; alarms.forEach(function (x) { if (x.status === 'active' && x.deviceId && x.deviceId.indexOf('eq_') === 0) alarmDevs[x.deviceId] = 1; });
    sendScene('state', {
      robots: robots,
      deviceStatus: devices.reduce(function (m, d) { m[d.modelNode] = alarmDevs[d.deviceId] ? 'alarm' : d.status; return m; }, {})
    });
  }

  /* ---------- 视角与模式（gameplay-systems：视角切换/告警联动） ---------- */
  document.querySelectorAll('.mode').forEach(function (b) { b.onclick = function () {
    document.querySelectorAll('.mode').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active');
    mode = b.dataset.mode; $('#s3Drawer').hidden = mode !== 'S3'; renderTasks();
    if (mode === 'S3') renderS3();
    sceneCmd('view', { view: VIEWS[mode] });
  }; });
  document.querySelectorAll('.dims .pill:not(.flow)').forEach(function (b) { b.onclick = function () {
    document.querySelectorAll('.dims .pill').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active');
    dim = b.dataset.dim; document.body.dataset.dim = dim;
    $('#andonZone').hidden = !(dim === 'machine' || dim === 'env');
    $('#robotZone').hidden = !(dim === 'machine' || dim === 'man');
    $('#taskStrip').hidden = !(dim === 'method' || dim === 'material');
  }; });
  $('#flowBtn').onclick = function () { $('#flowView').hidden = !$('#flowView').hidden; this.classList.toggle('active'); if (!$('#flowView').hidden) buildFlow(); };
  $('#flowClose').onclick = function () { $('#flowView').hidden = true; $('#flowBtn').classList.remove('active'); };

  /* ---------- 拾取联动：iframe 设备点击 → 详情面板 + realtime 轮询 ---------- */
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || (d.channel !== 'room-tour-preview-v1' && d.channel !== 'future-lab-tech-blue-spatial')) return;
    if (d.type === 'perf') $('#perf').textContent = 'draw calls ' + d.calls + ' · tris ' + (d.tris / 1000).toFixed(0) + 'k';
    if (d.type === 'device') openDeviceByCad(d.device);
  });
  function openDeviceByCad(dev) {
    var match = devices.filter(function (x) { return x.modelNode === 'cad:' + dev.id; })[0];
    if (!match) { openDetail('<h3>' + escapeHtml(dev.name || dev.id) + '</h3><div class="sub">该设备未纳入孪生对象清单（诚实降级：无 mock 档案）</div>'); return; }
    detailDev = match; openDetail(deviceHtml(match)); pollRealtime();
  }
  function deviceHtml(d) {
    var stCls = d.status === 'alarm' ? 'ga' : d.status === 'working' ? '' : d.status === 'ready' ? 'okg' : 'gray';
    return '<h3>' + d.name + '</h3><div class="sub">' + d.code + ' · ' + d.subZone + ' · ' + d.type + '</div>' +
      '<div class="row"><span>状态</span><b class="st" style="background:' + (d.status === 'working' ? '#2878FF' : d.status === 'ready' ? '#16A34A' : d.status === 'alarm' ? '#E5484D' : '#94A3B8') + '">' + d.status + '</b></div>' +
      '<div class="row"><span>当前任务</span><b>' + (d.currentTaskId || '—') + '</b></div>' +
      '<div class="row"><span>当前样品</span><b>' + (d.currentSampleId || '—') + '</b></div>' +
      '<div class="row"><span>数采分系统</span><b>' + (d.daqUnitId || '—（非检测设备）') + '</b></div>' +
      '<div id="rt"><div class="row"><span>关键参数</span><b>加载中…</b></div></div>' +
      '<p style="font-size:11px;color:var(--tw-color-textMuted)">详情=台账投影；实时=GET /api/device/' + d.deviceId + '/realtime（3s 轮询，生产切 WS）</p>';
  }
  function pollRealtime() {
    clearInterval(rtTimer);
    if (!detailDev) return;
    var pull = function () { TwinApi.get('/api/device/' + detailDev.deviceId + '/realtime').then(function (r) {
      var el = $('#rt'); if (!el || !r.data) return;
      el.innerHTML = r.data.keyParams.map(function (p) { return '<div class="row"><span>' + p.name + '</span><b>' + p.value + (p.unit ? ' ' + p.unit : '') + '</b></div>'; }).join('') +
        '<div class="row"><span>更新时间</span><b>' + new Date(r.data.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) + '</b></div>';
    }); };
    pull(); rtTimer = setInterval(pull, 3000);
  }
  function openDetail(html) { $('#detailBody').innerHTML = html; $('#detail').hidden = false; }
  $('#detailClose').onclick = function () { $('#detail').hidden = true; clearInterval(rtTimer); detailDev = null; };

  $('#taskStrip').addEventListener('click', function (e) {
    var chip = e.target.closest('[data-devcode]'); if (!chip) return;
    var code = chip.dataset.devcode;
    var match = devices.filter(function (x) { return x.code === code; })[0];
    if (match) { detailDev = match; openDetail(deviceHtml(match)); pollRealtime(); }
  });

  /* ---------- S3 告警回溯（24h，PRD 非目标边界内） ---------- */
  $('#andonZone').addEventListener('click', function (e) {
    var ack = e.target.closest('[data-ack]'), tr = e.target.closest('[data-trace]');
    if (ack) TwinApi.alarmAck(ack.dataset.ack);
    if (tr) { $('#s3Drawer').hidden = false; renderS3(tr.dataset.trace); }
  });
  $('#s3Close').onclick = function () { $('#s3Drawer').hidden = true; };
  function renderS3(onlyId) {
    Promise.all(alarms.filter(function (a) { return !onlyId || a.alarmId === onlyId; }).map(function (a) { return TwinApi.get('/api/alarm/' + a.alarmId + '/trace'); }))
      .then(function (rs) {
        $('#s3Body').innerHTML = rs.map(function (r) { var d = r.data; if (!d) return '';
          return '<div class="s3-row"><span class="t">' + d.alarm.occurredAt + '</span>' +
            '<span class="grade ' + (d.alarm.grade === 'A' ? 'ga' : d.alarm.grade === 'B' ? 'gb' : 'gc') + '" style="color:#fff;border-radius:999px;padding:2px 8px;font-size:11px">Grade ' + d.alarm.grade + '</span>' +
            '<div class="trace"><b style="font-size:13px">' + d.alarm.title + '</b><ol>' + d.events.map(function (ev) { return '<li>' + ev.at + ' · <em>' + ev.system + '</em>：' + ev.text + '</li>'; }).join('') + '</ol></div></div>';
        }).join('');
      });
  }

  /* ---------- 系统交互视图（汇报武器） ---------- */
  var NODES = { 'SYS.LIMS': [1, 0], 'SYS.WORKSTATION': [1, 1], 'SYS.VISUAL': [0, 2], 'SYS.DISPATCH': [2, 0], 'SYS.ROBOT_SCHED': [2, 1], 'SYS.CENTRALCTRL': [2, 2], 'SYS.DEVICE': [3, 0], 'SYS.ROBOT': [3, 1], 'SYS.DAQ_MASTER': [4, 0], 'SYS.DAQ_SUB': [4, 1], 'SYS.DB': [4, 2], 'SYS.IOT': [5, 0], 'SYS.SAFETY': [6, 0], 'SYS.CCTV': [6, 1], 'SYS.HVAC': [6, 2], 'SYS.IMAGE': [6, 3], 'SYS.SENSOR': [6, 4] };
  var EDGES = [['E1', 'SYS.LIMS', 'SYS.DAQ_MASTER', 'command', '任务下发'], ['E2', 'SYS.DAQ_SUB', 'SYS.LIMS', 'data', '数据回传'], ['E3', 'SYS.WORKSTATION', 'SYS.DAQ_MASTER', 'command', '手动任务'], ['E4', 'SYS.DAQ_SUB', 'SYS.WORKSTATION', 'data', '报告回流'], ['E5', 'SYS.DISPATCH', 'SYS.DEVICE', 'command', '动作/编排'], ['E6', 'SYS.DEVICE', 'SYS.DISPATCH', 'sync', '状态同步'], ['E7', 'SYS.DEVICE', 'SYS.DAQ_SUB', 'query', '取任务/推数据 1:1'], ['E8', 'SYS.DISPATCH', 'SYS.DAQ_MASTER', 'query', '条码拉参数(重点)'], ['E9', 'SYS.ROBOT_SCHED', 'SYS.DEVICE', 'command', '上下料握手'], ['E10', 'SYS.DISPATCH', 'SYS.ROBOT_SCHED', 'command', '调度指令'], ['E11', 'SYS.ROBOT_SCHED', 'SYS.DISPATCH', 'sync', '完成反馈'], ['E12', 'SYS.ROBOT_SCHED', 'SYS.ROBOT', 'command', '动作指令'], ['E13', 'SYS.CENTRALCTRL', 'SYS.DEVICE', 'sync', '行为/数据同步'], ['E14', 'SYS.IOT', 'SYS.DISPATCH', 'command', '指令级操作'], ['E15', 'SYS.IOT', 'SYS.DAQ_MASTER', 'command', '下发/查询'], ['E16', 'SYS.IOT', 'SYS.SAFETY', 'data', '外部联动'], ['E17', 'SYS.IMAGE', 'SYS.DAQ_MASTER', 'data', '多端口汇聚'], ['E18', 'SYS.DAQ_MASTER', 'SYS.DB', 'data', '共用数据库']];
  var built = false;
  function buildFlow() {
    if (built) return; built = true;
    var pos = function (n) { var c = NODES[n]; return [90 + c[1] * 190, 60 + c[0] * 88]; };
    var svg = $('#flowSvg'), out = '';
    Object.keys(NODES).forEach(function (n) { var p = pos(n);
      out += '<g class="fn"><rect x="' + (p[0] - 74) + '" y="' + (p[1] - 20) + '" width="148" height="40" rx="10"/><text x="' + p[0] + '" y="' + (p[1] + 4) + '" text-anchor="middle">' + n.replace('SYS.', '') + '</text></g>'; });
    EDGES.forEach(function (e) { var a = pos(e[1]), b = pos(e[2]), st = KIND_STYLE[e[3]];
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 - 26;
      out += '<path class="fe" d="M' + a[0] + ' ' + a[1] + ' Q' + mx + ' ' + my + ' ' + b[0] + ' ' + b[1] + '" stroke="' + st[0] + '" stroke-dasharray="' + st[1] + '" data-e="' + e[0] + '"><title>' + e[0] + ' ' + e[4] + '</title></path>'; });
    svg.innerHTML = out;
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* 初始维度=机 */
  document.body.dataset.dim = dim;
})();
