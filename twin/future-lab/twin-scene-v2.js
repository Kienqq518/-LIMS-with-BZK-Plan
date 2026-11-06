/* 孪生 V2 宿主：只认 TwinApi（/api/*），iframe 场景经 postMessage 驱动
 * 控制三层（决策 Q7：5M1E 切片移除；S2 不再是按钮，改为区域下拉）
 *   ① 叙事：S1 总览 / 区域下钻（106 为完整视图）/ S3 告警回溯
 *   ② 渲染：图层菜单（path/labels/zones/walls/heatmap）
 *   ③ 动作：系统流、底栏收起、低配模式（决策 Q8 预留）
 * 只读红线（决策 Q2）：无告警写回，闭环状态由来源系统推送，屏上不出现「演示回执」字样。
 */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var scene = $('#scene');
  var status = null, devices = [], robots = [], alarms = [], tasks = [], samples = [], zones = [], dispatchTasks = [], routeNote = '', walls = [];
  var rtTimer = null, detailDev = null, bridgeReady = false, pendingState = null;
  var zstats = null, zrunning = [], zalarms = [], envNodes = [], zpSig = { dev: '', env: '', run: '', ab: '' }, sceneReady = false, routeAudit = null, cycleDef = null, cycTimer = null;
  var SRC_NAME = { daq: '数采', dispatch: '调度', iot: '物联', lims: 'LIMS', rule: '判定规则' };
  var ORDER = [];  /* 遥控翻页序列 */

  var st = readURL() || { mode: 'S1', zone: '106', period: 'day', layers: { path: 1, labels: 1, zones: 1, walls: 1, heatmap: 0 }, alarmFilter: 'open', quality: 'high', strip: 0 };

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
      layers: { path: lay.path == null ? 1 : lay.path, labels: lay.labels == null ? 1 : lay.labels, zones: lay.zones == null ? 1 : lay.zones, walls: lay.walls == null ? 1 : lay.walls, heatmap: lay.heatmap ? 1 : 0 },
      alarmFilter: p.get('alarmFilter') || 'open', quality: p.get('quality') || 'high', strip: p.get('strip') ? 1 : 0 };
  }
  function writeURL() {
    var p = new URLSearchParams(); p.set('mode', st.mode); if (st.mode === 'ZONE') p.set('zone', st.zone);
    p.set('period', st.period); p.set('alarmFilter', st.alarmFilter); if (st.quality === 'low') p.set('quality', 'low'); if (st.strip) p.set('strip', '1');
    p.set('layers', Object.keys(st.layers).filter(function (k) { return st.layers[k]; }).join(','));
    history.replaceState(null, '', location.pathname + '?' + p.toString() + '#v2=1&native-nodes=1');
  }

  function fail(msg) { $('#freshDot').className = 'dot stale'; $('#freshTxt').textContent = '数据源异常：' + msg; }

  /* ---------- 装载 ---------- */
  TwinApi.ready().then(function () {
    TwinApi.start(2000);
    return Promise.all([
      TwinApi.get('/api/overview/lab-status'), TwinApi.get('/api/overview/zones'), TwinApi.get('/api/overview/today-tasks'),
      TwinApi.get('/api/overview/alarms'), TwinApi.get('/api/zone/106/devices'), TwinApi.get('/api/zone/106/robots'),
      TwinApi.get('/api/zone/106/samples'), TwinApi.get('/api/zone/106/dispatch-tasks'),
      TwinApi.get('/api/zone/103/devices'), TwinApi.get('/api/zone/106/cycle'), TwinApi.get('/api/zone/106/walls')
    ]);
  }).then(function (r) {
    status = r[0].data; zones = r[1].data || []; tasks = r[2].data || []; alarms = r[3].data || [];
    devices = (r[4].data || []).map(stamp('106')).concat((r[8].data || []).map(stamp('103')));   /* 106 全量 + 103 已建档；归属=数据来源分区 */
    robots = r[5].data || []; samples = r[6].data || []; dispatchTasks = r[7].data || [];
    routeNote = (robots[0] && robots[0].routeBasis) ? '机器人位置基准：' + robots[0].routeBasis : '';
    walls = (r[10] && r[10].data) || [];
    /* 讲解顺序（决策 Q1 售前投影）：总览 → 106 无人化区（主叙事）→ 其余区域 → 告警回溯 */
    ORDER = ['S1', 'Z106'].concat(zones.map(function (z) { return 'Z' + z.zoneId.slice(2); }).filter(function (z) { return z !== 'Z106'; })).concat(['S3']);
    if (r[9] && r[9].data && r[9].data.cycle) { cycleDef = r[9].data.cycle; if (!cycTimer) cycTimer = setInterval(tickCycle, 1000); tickCycle(); }
    buildZoneSelect(); bindControls(); syncLayerMenu(); applyAll();
    TwinApi.ws(onEvent);
  }).catch(function (e) { fail(e.message); });

  function onEvent(ev) {
    if (ev.type === 'tick') {
      robots = (ev.payload.robots && ev.payload.robots.length ? ev.payload.robots : robots);
      devices.forEach(function (d) { var s = ev.payload.devices.filter(function (x) { return x.deviceId === d.deviceId; })[0]; if (s) d.status = s.status; });
      renderRobots(); renderZonePanel(); renderCharts(); pushState();
    } else if (ev.type === 'task.progress') {
      var t = tasks.filter(function (x) { return x.taskId === ev.payload.taskId; })[0];
      if (t) { t.progress.percent = ev.payload.percent; t.stage = ev.payload.stage; if (ev.payload.percent >= 100) t.result = 'passed'; renderStrip(); }
    } else if (ev.type === 'device.status') { renderZonePanel(); }
    else if (ev.type === 'cycle') { renderCycle(ev.payload); }
    else if (ev.type === 'alarm.update') { renderAlarms(); pushState(); }
  }

  /* ---------- ① 指标：五数 × 三周期（决策 Q3） ---------- */
  var ST_COLOR = { working: '#2878FF', ready: '#16A34A', standby: '#94A3B8', stopped: '#64748B', alarm: '#E5484D' };
  var ST_LABEL = { working: '在测', ready: '就绪', standby: '待机', stopped: '停止', alarm: '异常' };
  function renderCharts() {
    var pool = st.mode === 'ZONE' && zoneDevices(st.zone).length ? zoneDevices(st.zone) : devices;
    var bad = {}; alarms.forEach(function (a) { if (a.status !== 'resolved' && a.deviceId) bad[a.deviceId] = 1; });
    var cnt = { working: 0, ready: 0, standby: 0, stopped: 0, alarm: 0 };
    pool.forEach(function (d) { cnt[bad[d.deviceId] ? 'alarm' : d.status] = (cnt[bad[d.deviceId] ? 'alarm' : d.status] || 0) + 1; });
    var total = pool.length || 1, max = Math.max(1, cnt.working, cnt.ready, cnt.standby, cnt.alarm, cnt.stopped);
    $('#devBars').innerHTML = ['working', 'ready', 'alarm', 'standby'].map(function (k) {
      return '<div class="bar"><span class="k">' + ST_LABEL[k] + '</span><i><b style="width:' + Math.round(cnt[k] / max * 100) + '%;background:' + ST_COLOR[k] + '"></b></i><em>' + cnt[k] + '</em></div>';
    }).join('');
    var open = alarmOpen(), gmax = Math.max(1, open.filter(function (a) { return a.grade === 'A'; }).length, open.filter(function (a) { return a.grade === 'B'; }).length, open.filter(function (a) { return a.grade === 'C'; }).length);
    $('#gradeBars').innerHTML = ['A', 'B', 'C'].map(function (g) {
      var n = open.filter(function (a) { return a.grade === g; }).length;
      var col = g === 'A' ? '#E5484D' : g === 'B' ? '#F76B15' : '#F59E0B';
      return '<div class="bar"><span class="k">Grade ' + g + '</span><i><b style="width:' + Math.round(n / gmax * 100) + '%;background:' + col + '"></b></i><em>' + n + '</em></div>';
    }).join('');
    var rate = Math.round((cnt.working / total) * 100);
    $('#ringFg').style.strokeDashoffset = (188.5 * (1 - rate / 100)).toFixed(1);
    $('#ringVal').textContent = rate + '%';
    $('#ringSub').textContent = '在测 ' + cnt.working + '/' + total;
  }

  function renderMetrics() {
    var m = status.metrics[st.period], meta = status.metricMeta;
    $('#metrics').innerHTML = Object.keys(meta).map(function (k) {
      var v = m[k].value, src = SRC_NAME[meta[k].source] || meta[k].source, c = m[k].compare;
      var tip = '来源：' + src + (meta[k].note ? ' · ' + meta[k].note : '') + ' · 刷新 ' + meta[k].refresh;
      if (v == null) return '<div class="metric na" title="' + tip + '"><b>—</b><span class="lab">' + meta[k].label + '<small>（' + meta[k].unit + '）</small></span><span class="src">' + src + ' 未接入</span></div>';
      var delta = c == null ? '' : '<span class="delta ' + (c >= 0 ? 'up' : 'down') + '">' + (c >= 0 ? '▲' : '▼') + Math.abs(c) + '%</span>';
      return '<div class="metric" title="' + tip + '"><b>' + v + '</b><span class="lab">' + meta[k].label + '<small>（' + meta[k].unit + '）</small></span>' + delta + '<span class="src">' + src + '</span></div>';
    }).join('');
    $('#freshTxt').textContent = '数据源 live-mock · 最近更新 ' + new Date(status.updatedAt || Date.now()).toLocaleTimeString('zh-CN', { hour12: false });
  }

  /* ---------- ② 告警：闭环三态只读（决策 Q2） ---------- */
  function alarmOpen() { return alarms.filter(function (a) { return a.status !== 'resolved'; }); }
  function renderAlarms() {
    var open = alarmOpen(), list = st.alarmFilter === 'open' ? open : alarms.slice();
    list = open.concat(alarms.filter(function (a) { return a.status === 'resolved'; })).filter(function (a) { return st.alarmFilter === 'all' ? true : a.status !== 'resolved'; });
    $('#alarmSum').innerHTML = '<span class="open">未解除 ' + open.length + '</span><span class="done">已解除 ' + alarms.filter(function (a) { return a.status === 'resolved'; }).length + '</span>' +
      ['A', 'B', 'C'].map(function (g) { return '<span class="g' + g.toLowerCase() + '">' + g + ' ' + open.filter(function (a) { return a.grade === g; }).length + '</span>'; }).join('');
    $('#streamMeta').textContent = '近 24h · ' + list.length + ' 条 · 悬停暂停';
    var rows = list.map(function (x) {
      return '<div class="st-row' + (x.status === 'resolved' ? ' is-resolved' : '') + '" data-alarm="' + x.alarmId + '" data-dev="' + (x.deviceId || '') + '" data-zone="' + x.zoneId.replace('Z-', '') + '" data-grade="' + x.grade + '" data-status="' + x.status + '" data-to="' + escapeHtml(x.dispatchedTo || '') + '" data-title="' + escapeHtml(x.title) + '">' +
        '<div class="l1"><span class="gd ' + x.grade.toLowerCase() + '">Grade ' + x.grade + '</span><span>' + escapeHtml(x.title) + '</span><span class="tm">' + x.occurredAt + '</span></div>' +
        '<div class="rs">' + escapeHtml(x.reason) + '</div>' +
        '<div class="l2"><span class="st ' + x.status + '">' + ST_AB(x.status) + '</span>' +
        '<span>' + x.zoneId.replace('Z-', '') + '</span><span>派至 ' + escapeHtml(x.dispatchedTo || '待派发') + '</span>' +
        '<button class="tr" data-trace="' + x.alarmId + '">回溯</button></div></div>';
    }).join('');
    $('#streamTrack').innerHTML = rows + rows;   /* 复制一份做无缝滚动 */
    $('#streamTrack').style.animationDuration = Math.max(18, list.length * 6) + 's';
  }

  /* ---------- ③ 106 主叙事：机器人卡住 / 当前调度任务 / 设备状态 / 异常（决策 Q4） ---------- */
  function renderRobots() {
    var el = $('#robotZone');
    if (el.dataset.sig !== robots.map(function (r) { return r.robotId; }).join('|')) {
      el.dataset.sig = robots.map(function (r) { return r.robotId; }).join('|');
      el.innerHTML = robots.map(function (r) { return '<div class="robot-card" data-robot="' + r.robotId + '"><span class="rbt"></span></div>'; }).join('');
    }
    robots.forEach(function (r, i) {
      var card = el.children[i]; if (!card || card.dataset.robot !== r.robotId) return;
      var stall = (r.taskElapsedMin != null && r.stallLimitMin != null && r.taskElapsedMin > r.stallLimitMin && r.action !== 'charging');
      card.className = 'robot-card' + (stall ? ' is-stall' : '') + (r.action === 'charging' ? ' charging' : '');
      var act = r.action === 'charging' ? '充电中' : stall ? '疑似卡住' : r.action === 'moving' ? '行进中' : '待机';
      var dev = devices.filter(function (x) { return x.deviceId === r.servingDeviceId; })[0];
      card.firstChild.innerHTML = '<i></i>' + r.robotId + ' · ' + act +
        '<span class="tk">｜' + escapeHtml(r.currentFlowName || '无在制任务') + ' ' + (r.currentTaskId || '') + (r.taskElapsedMin != null ? ' · 已 ' + r.taskElapsedMin + 'min（限 ' + r.stallLimitMin + '）' : '') + '</span>' +
        (dev ? ' <span class="tk">服务 ' + dev.code + '</span>' : '') +
        (r.carriedSampleIds && r.carriedSampleIds.length ? ' · 载 ' + r.carriedSampleIds[0] : '') +
        (r.routeBasis ? ' <span class="tk" title="' + escapeHtml(r.routeBasis) + '">相对轨迹</span>' : '') +
        ' <em>🔋' + Math.round(r.battery) + '%</em>' + (stall ? '<span class="stall">卡住判定</span>' : '');
    });
  }
  function stamp(z) { return function (d) { d.zoneId = d.zoneId || 'Z-' + z; return d; }; }
  /* 区域归属以数据分区为准（部分设备的 CAD 模型号在邻区，如 2411020108 借 107-01 建模却属 106 分区） */
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
    var abSig = zalarms.map(function (a) { return a.alarmId + a.status; }).join('|');
    if (zpSig.ab !== abSig) {
      zpSig.ab = abSig;
      zp('#zpAlarms .zp-body').innerHTML = zalarms.map(function (a) {
        return '<div class="zp-row ' + (a.status === 'resolved' ? 'ready' : 'alarm') + '" data-alarm="' + a.alarmId + '"><i class="dot"></i><span class="nm">Grade ' + a.grade + ' ' + escapeHtml(a.title) + '</span><span class="sub">' + ST_AB(a.status) + ' · ' + a.occurredAt + '</span></div>' +
          '<div class="l2" style="font-size:10px;color:var(--tw-color-textMuted);margin:-2px 0 6px 15px">派至 ' + escapeHtml(a.dispatchedTo || '—') + ' · 来源 ' + (SRC_NAME[a.source] || a.source || '—') + ' · <button data-trace="' + a.alarmId + '" style="border:0;background:none;color:var(--tw-color-brand);cursor:pointer;padding:0;font-size:10px">回溯</button></div>';
      }).join('') || '<div class="zp-empty">近 24h 该区域无告警。</div>';
      zp('#zpAlarmsN').textContent = zalarms.filter(function (a) { return a.status !== 'resolved'; }).length + ' 未解除 / 共 ' + zalarms.length;
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
    if (d.type === 'perf') $('#perf').textContent = 'draw calls ' + d.calls + ' · tris ' + (d.tris / 1000).toFixed(0) + 'k' + (d.fps ? ' · ' + d.fps + 'fps' : '');
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
  function renderAudit() {
    var el = $('#auditBadge'); if (!el || !routeAudit) return;
    var bad = routeAudit.violations > 0;
    el.className = 'audit' + (bad ? ' bad' : '');
    el.innerHTML = '<span class="zh">避让校验 ' + (bad ? '未通过' : '通过') + '</span><br>' + routeAudit.checked + ' 个采样点 · ' + routeAudit.obstacles + ' 个障碍实体 · 违规 ' + routeAudit.violations +
      (bad ? '<br>' + routeAudit.detail.slice(0, 2).map(function (x) { return x.robot + ' ' + x.type + ' @' + x.at.join(','); }).join('<br>') : '');
  }
  function applyLayers() { Object.keys(st.layers).forEach(function (k) { toScene('layer', { layer: k, enabled: !!st.layers[k] }); }); toScene('quality', { level: st.quality }); }
  function openDeviceByCad(dev) {
    var match = devices.filter(function (x) { return x.modelNode === 'cad:' + dev.id; })[0];
    if (!match) { openDetail('<h3>' + escapeHtml(dev.name || dev.id) + '</h3><div class="sub">该实体未纳入孪生对象清单（诚实降级：无实时档案）</div>'); return; }
    detailDev = match; openDetail(deviceHtml(match)); pollRealtime();
  }

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
    $('#alarmStream').hidden = st.mode === 'ZONE';
    $('#robotZone').hidden = st.mode === 'ZONE';
    $('#taskStrip').hidden = st.mode !== 'S1'; $('#taskStrip').classList.toggle('collapsed', !!st.strip);
    $('#stripBtn').textContent = st.strip ? '▴ 展开底栏' : '▾ 收起底栏'; $('#stripBtn').setAttribute('aria-pressed', !!st.strip);
    $('#stripBtn').disabled = st.mode !== 'S1';
    $('#s3Drawer').hidden = st.mode !== 'S3'; if (st.mode === 'S3') renderS3();
    var h = document.querySelector('.s3drawer b'); if (h) h.textContent = '告警回溯 · 最近 24h（未解除 ' + alarmOpen().length + ' / 共 ' + alarms.length + '）';
    drillTo(st.mode === 'ZONE' ? zoneView(st.zone) : 'overall-101');
    renderMetrics(); renderCharts(); renderAlarms(); renderRobots(); renderStrip(); pushState(); writeURL();
    if (st.mode === 'ZONE') { loadZone(); renderZonePanel(); }

  }
  function setMode(m, zone) {
    st.mode = m;
    if (zone && zone !== st.zone) { st.zone = zone; $('#detail').hidden = true; clearInterval(rtTimer); detailDev = null; }  /* 换区域即收起上一区域的详情，避免串区 */
    applyAll(); flashHint();
  }
  function handleKey(k) {
    if (k === 'PageDown') step(1);
    else if (k === 'PageUp') step(-1);
    else if (k === 'Home' || k === '1') setMode('S1');
    else if (k === 'End' || k === '3') setMode('S3');
    else if (k === '2') setMode('ZONE', '106');
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

  function bindControls() {
    document.querySelectorAll('.mode').forEach(function (b) { b.onclick = function () { setMode(b.dataset.mode); }; });
    $('#zoneSel').onchange = function () { setMode('ZONE', this.value); };
    document.querySelectorAll('.seg').forEach(function (b) { b.onclick = function () {
      document.querySelectorAll('.seg').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); st.period = b.dataset.period; renderMetrics(); renderZonePanel(); writeURL();
    }; });
    document.querySelectorAll('.mini').forEach(function (b) { b.onclick = function () {
      document.querySelectorAll('.mini').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); st.alarmFilter = b.dataset.alarmfilter; renderAlarms(); writeURL();
    }; });
    document.querySelectorAll('.lic').forEach(function (b) { b.onclick = function () {
      var k = b.dataset.layer; st.layers[k] = st.layers[k] ? 0 : 1;
      b.classList.toggle('on', !!st.layers[k]); b.setAttribute('aria-pressed', !!st.layers[k]);
      toScene('layer', { layer: k, enabled: !!st.layers[k] }); pushState(); writeURL();
      flashHint(b.getAttribute('desc') + '：' + (st.layers[k] ? '开' : '关'));
    }; });
    $('#stripBtn').onclick = function () { st.strip = st.strip ? 0 : 1; applyAll(); };
    $('#lowBtn').onclick = function () {
      st.quality = st.quality === 'low' ? 'high' : 'low'; this.classList.toggle('active', st.quality === 'low'); this.setAttribute('aria-pressed', st.quality === 'low');
      toScene('quality', { level: st.quality }); pushState(); writeURL(); flashHint('低配模式：' + (st.quality === 'low' ? '开（关反射·降材质·降帧）' : '关'));
    };
    $('#detailClose').onclick = function () { $('#detail').hidden = true; clearInterval(rtTimer); detailDev = null; };
    /* 遥控翻页（决策 Q1：售前投影 + 翻页笔）。只吃 PgUp/PgDn/Home/End/1·2·3/Esc；
       方向键留给场景相机，避免与三维漫游打架。焦点在 iframe 内时由桥接层转发 remote 消息。 */
    document.addEventListener('keydown', function (e) { if (handleKey(e.key)) e.preventDefault(); });
    $('#alarmStream').addEventListener('click', function (e) {
      var tr = e.target.closest('[data-trace]'), card = e.target.closest('[data-alarm]');
      if (tr) { $('#s3Drawer').hidden = false; renderS3(tr.dataset.trace); return; }
      if (!card) return;
      var d = devices.filter(function (x) { return x.deviceId === card.dataset.dev; })[0];
      if (d) { selectDevice(d, (d.modelNode || '').replace('cad:', '')); return; }
      /* 非 106 设备/机器人：镜头飞到该区域 + 只读说明（决策 Q4：30 秒定位） */
      var zc = card.dataset.zone;
      sceneCmd('view', { view: zc === '106' ? 'close' : zc + '-close' });
      openDetail('<h3>' + escapeHtml(card.dataset.title || '告警') + '</h3><div class="sub">' + zc + ' 区 · Grade ' + card.dataset.grade + '</div>' +
        '<div class="row"><span>闭环状态</span><b>' + ({ active: '未解除', dispatched: '已派发', resolved: '已解除' }[card.dataset.status]) + '</b></div>' +
        '<div class="row"><span>派至</span><b>' + escapeHtml(card.dataset.to || '—') + '</b></div>' +
        '<div class="row"><span>关联对象</span><b>' + escapeHtml(card.dataset.dev || '—') + '</b></div>' +
        '<p style="font-size:11px;color:var(--tw-color-textMuted)">镜头已定位到 ' + zc + '。孪生只读：处置与解除由来源系统回传，不在大屏操作。</p>');
    });
    $('#robotZone').addEventListener('click', function (e) {
      var c = e.target.closest('[data-robot]'); if (!c) return;
      var r = robots.filter(function (x) { return x.robotId === c.dataset.robot; })[0]; if (!r) return; openRobot(r);
    });
    function openRobot(r) {
      openDetail('<h3>' + r.robotId + ' · 复合机器人</h3><div class="sub">' + escapeHtml(r.routeBasis || '') + '</div>' +
        '<div class="row"><span>当前调度任务</span><b>' + escapeHtml(r.currentFlowName || '—') + '</b></div>' +
        '<div class="row"><span>任务号</span><b>' + (r.currentTaskId || '—') + '</b></div>' +
        '<div class="row"><span>已耗时 / 上限</span><b>' + (r.taskElapsedMin || 0) + ' / ' + (r.stallLimitMin || '—') + ' min</b></div>' +
        '<div class="row"><span>服务设备</span><b>' + ((devices.filter(function (x) { return x.deviceId === r.servingDeviceId; })[0] || {}).code || r.servingDeviceId || '—') + '</b></div>' +
        '<div class="row"><span>电量</span><b>' + Math.round(r.battery) + '%</b></div>' +
        '<div class="row"><span>行进范围</span><b>' + (r.allowedZones || ['Z-106']).join(' ↔ ').replace(/Z-/g, '') + '</b></div>' +
        '<div class="row"><span>净空要求</span><b>≥' + (r.clearanceM || 0.2) + 'm（包络 ' + (r.sweptEnvelope || 0.9) + 'm 含原地掉头）</b></div>' +
        '<div class="row"><span>门洞</span><b>' + ((r.serves || []).filter(function (x) { return x.indexOf('门洞') >= 0; })[0] || '区内环线，不穿墙') + '</b></div>' +
        '<div class="row"><span>避让校验</span><b>' + (routeAudit ? (routeAudit.violations ? routeAudit.violations + ' 处违规' : '0 重叠 / ' + routeAudit.checked + ' 采样点') : '待场景就绪') + '</b></div>' +
        '<div style="font-size:11px;color:var(--tw-color-textSecondary);margin-top:8px">途经：' + (r.serves || []).map(escapeHtml).join(' → ') + '</div>' +
        '<p style="font-size:11px;color:var(--tw-color-textMuted)">位置基准：' + (r.positionBasis === 'derived' ? '调度未标定，按 CAD 占地推导折线（相对轨迹）' : '调度系统实时点位') + ' · ' + escapeHtml(r.routeMethod || '') + '</p>');
    }
    $('#taskStrip').addEventListener('click', function (e) {
      var al = e.target.closest('[data-alarm]');
      if (al) { $('#s3Drawer').hidden = false; renderS3(al.dataset.alarm); return; }
      var chip = e.target.closest('[data-devcode]'); if (!chip) return;
      var match = devices.filter(function (x) { return x.code === chip.dataset.devcode; })[0];
      if (match) selectDevice(match, (match.modelNode || '').replace('cad:', ''));
    });
    $('#s3Close').onclick = function () { setMode('S1'); };
    $('#zpClose').onclick = function () { setMode('S1'); };
    $('#zonePanel').addEventListener('click', function (e) {
      var tr = e.target.closest('[data-trace]');
      if (tr) { $('#s3Drawer').hidden = false; renderS3(tr.dataset.trace); return; }
      var ab = e.target.closest('[data-alarm]');
      if (ab) { $('#s3Drawer').hidden = false; renderS3(ab.dataset.alarm); return; }
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
    el.textContent = txt || (st.mode === 'S1' ? 'S1 实验室总览' : st.mode === 'S3' ? 'S3 告警回溯' : '区域下钻 · ' + st.zone + ' ' + ((zones.filter(function (z) { return z.zoneId === 'Z-' + st.zone; })[0] || {}).name || ''));
    el.hidden = false; clearTimeout(hintTimer); hintTimer = setTimeout(function () { el.hidden = true; }, 1400);
  }

  function syncLayerMenu() {
    document.querySelectorAll('.lic').forEach(function (b) { b.classList.toggle('on', !!st.layers[b.dataset.layer]); b.setAttribute('aria-pressed', !!st.layers[b.dataset.layer]); });
    if (st.quality === 'low') { $('#lowBtn').classList.add('active'); $('#lowBtn').setAttribute('aria-pressed', 'true'); }
    document.querySelectorAll('.seg').forEach(function (b) { b.classList.toggle('active', b.dataset.period === st.period); });
    document.querySelectorAll('.mini').forEach(function (b) { b.classList.toggle('active', b.dataset.alarmfilter === st.alarmFilter); });
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

  /* ---------- S3 告警回溯（只读闭环） ---------- */
  function renderS3(onlyId) {
    var base = st.alarmFilter === 'open' ? alarmOpen() : alarms;
    Promise.all(base.filter(function (a) { return !onlyId || a.alarmId === onlyId; }).map(function (a) { return TwinApi.get('/api/alarm/' + a.alarmId + '/trace'); }))
      .then(function (rs) {
        $('#s3Body').innerHTML = rs.map(function (r) {
          var d = r.data; if (!d) return '';
          var ev = (d.events || []);
          return '<div class="s3-row"><span class="t">' + d.alarm.occurredAt + '</span>' +
            '<span class="grade ' + (d.alarm.grade === 'A' ? 'ga' : d.alarm.grade === 'B' ? 'gb' : 'gc') + '" style="color:#fff;border-radius:999px;padding:2px 8px;font-size:11px">Grade ' + d.alarm.grade + '</span>' +
            '<span class="grade ' + d.alarm.status + '" style="color:#fff;border-radius:999px;padding:2px 8px;font-size:11px;background:' + (d.alarm.status === 'resolved' ? '#7E8C9B' : d.alarm.status === 'dispatched' ? '#F59E0B' : '#E5484D') + '">' + ({ active: '未解除', dispatched: '已派发', resolved: '已解除' }[d.alarm.status]) + '</span>' +
            '<div class="trace"><b style="font-size:13px">' + escapeHtml(d.alarm.title) + '</b>' +
            '<div style="font-size:11px;color:var(--tw-color-textMuted);margin:3px 0">派至 ' + (d.alarm.dispatchedTo || '—') + (d.alarm.resolvedAt ? ' · ' + d.alarm.resolvedAt + ' ' + (d.alarm.resolvedBy || '') + ' 解除' : '') + '</div>' +
            (ev.length ? '<ol>' + ev.map(function (x) { return '<li>' + x.at + ' · <em>' + escapeHtml(x.system) + '</em>：' + escapeHtml(x.text) + '</li>'; }).join('') + '</ol>' : '<p style="font-size:12px;color:var(--tw-color-textMuted);margin:4px 0">未留存事件序列</p>') +
            '</div></div>';
        }).join('') || '<div class="degrade">当前筛选下无告警。</div>';
      });
  }

  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
})();
