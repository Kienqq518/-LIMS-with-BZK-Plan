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
  var status = null, devices = [], robots = [], alarms = [], tasks = [], samples = [], zones = [], dispatchTasks = [], routeNote = '', walls = [], planItems = [], queueData = null, safety = null, scSig = '', labDevices = [], labMeta = null, scView = [], scRoom = null;
  var rtTimer = null, detailDev = null, bridgeReady = false, pendingState = null;
  var thSeries = null, thLoading = false, chartsBooted = false;
  var dqSig = '', zstats = null, zrunning = [], zalarms = [], envNodes = [], sceneReady = false, routeAudit = null, cycleDef = null, cycTimer = null;
  var SRC_NAME = { daq: '数采', dispatch: '调度', iot: '物联', lims: 'LIMS', rule: '判定规则' };
  var ORDER = [];  /* 遥控翻页序列 */

  var LAYER_KEYS = ['path', 'labels', 'heatmap'];   /* 分区色块、剖墙开关均已按 2026-11-06 反馈移除；墙体剖切改为场景侧固定行为 */
  /* 分区 id 由数据（/api/overview/alarm-sections）给出；URL 与面板签名都用它，不再写死 A/B/C。
     readURL 在 SECTIONS 赋值之前执行，所以 secIds 兜底到内置三区的顺序。 */
  function secIds() { return (Array.isArray(SECTIONS) && SECTIONS.length ? SECTIONS : [{ id: 'A' }, { id: 'B' }, { id: 'C' }]).map(function (x) { return x.id; }); }   /* 仍供分级柱的轴标签用：等级标题来自 /api/overview/alarm-sections */
  /* 图层默认：路径开、场地标签关、热力关（产品负责人 2026-11-07：初始化时场地标签默认不开启）。
     房间名在区域面板与顶栏「区域」下拉里都有，三维里飘十个标签反而压住设备；要看得点顶栏「场地标签」。 */
  /* zone 初值改为 null：选中「区域」不等于已经选了房间，默认不选中任何房间（产品负责人 2026-11-08）。
     level 是组件1 的状态（overview / zone），mode 是三维真实视图——两者可以不一致：
     只点了「区域」还没挑房间时，level=zone 而 mode 仍是 S1（画面不跳）。 */
  var st = readURL() || { mode: 'S1', level: 'overview', zone: null, period: 'day', layers: { path: 1, labels: 0, heatmap: 0 }, streamFilter: 'all', quality: 'high', strip: 0 };

  function sendScene(type, data) { if (scene.contentWindow) scene.contentWindow.postMessage(Object.assign({ channel: 'twin-v2', type: type }, data), location.origin); }
  var pendingView = null;
  function sceneCmd(type, data) {
    if (type === 'equipment-highlight') document.body.dataset.lastHighlight = String((data && data.id) || '');   /* QA 可断言：告警主体到底描边了哪个 CAD 实体 */
    if (type === 'view' && !sceneReady) { pendingView = data; return; }   /* 场景未就绪时指令会被丢弃，先排队 */
    if (scene.contentWindow) scene.contentWindow.postMessage(Object.assign({ channel: 'future-lab-tech-blue-spatial', type: type }, data), location.origin);
  }
  function toScene(type, data) { if (bridgeReady) sendScene(type, data); else pendingState = { type: type, data: data }; }

  function readURL() {
    var p = new URLSearchParams(location.search); if (!p.get('mode')) return null;
    var lay = {}; (p.get('layers') || '').split(',').forEach(function (k) { if (k) lay[k] = 1; });
    /* URL 没写 zone 时不再默认 106：那是"切区域自动选中了 106"的另一半来源。
     层级是 overview 时本来就不该有房间；ZONE 却缺 zone 才回退到主叙事 106。 */
    var zoneParam = p.get('zone') || (p.get('mode') === 'ZONE' ? '106' : '');
    return { mode: p.get('mode'), zone: zoneParam, period: p.get('period') || 'day',
      layers: { path: lay.path == null ? 1 : lay.path, labels: lay.labels == null ? 0 : lay.labels, heatmap: lay.heatmap ? 1 : 0 },
      level: p.get('level') || (p.get('mode') === 'ZONE' ? 'zone' : 'overview'),
      streamFilter: p.get('sf') === 'open' ? 'open' : 'all', quality: p.get('quality') || 'high', strip: p.get('strip') ? 1 : 0 };
  }
  function writeURL() {
    /* 从当前参数起步、只覆盖我们托管的那几个键：外来开关（?look=flat 光影对比取证、以后可能还有）
       必须活着走过第一次 replaceState，否则场景帧读 parent URL 时它已经没了（本轮真实踩到）。 */
    var p = new URLSearchParams(location.search);
    ['mode','zone','period','alarmFilter','quality','strip','layers','sf'].forEach(function (k) { p.delete(k); });
    p.set('mode', st.mode); if (st.mode === 'ZONE' && st.zone) p.set('zone', st.zone);
    p.set('period', st.period); p.set('sf', st.streamFilter || 'all'); if (st.quality === 'low') p.set('quality', 'low'); if (st.strip) p.set('strip', '1');
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
      TwinApi.get('/api/overview/test-item-plan'), TwinApi.get('/api/overview/alarm-sections'),
      TwinApi.get('/api/overview/devices'),
      TwinApi.get('/api/overview/dispatch-queue'), TwinApi.get('/api/overview/safety-scenes')
    ]);
  }).then(function (r) {
    status = r[0].data; zones = r[1].data || []; tasks = r[2].data || []; alarms = r[3].data || [];
    /* 设备清单的唯一真相 = 全场功能设备表（33 台，含 105/107/108/109/110）。
       原来这里只把 106 + 103 两个区接口相加=11 台，于是 107 面板永远空、
       点 105/107 的设备也查无此人——区域面板读的是这张表，不是各区端点。
       全场表拿不到时退回两区相加，保证装载链不整片断掉。 */
    /* 资产（货架/充电位/显示屏）不产出检测数据：不进建档合计、不进运行状态环，
       但它们是房间里的东西，区域面板必须列出来（102 那一栏标题因此是「资产」）。 */
    labDevices = ((r[13] && r[13].data && r[13].data.devices) || []).concat((r[13] && r[13].data && r[13].data.assets) || []);
    devices = labDevices.length ? labDevices.map(function (d) { return Object.assign({}, d, { zone: d.roomId }); })
      : (r[4].data || []).map(stamp('106')).concat((r[8].data || []).map(stamp('103')));
    robots = r[5].data || []; samples = r[6].data || []; dispatchTasks = r[7].data || [];
    routeNote = (robots[0] && robots[0].routeBasis) ? '机器人位置基准：' + robots[0].routeBasis : '';
    walls = (r[10] && r[10].data) || [];
    planItems = (r[11] && r[11].data && r[11].data.items) || [];
    setSections(r[12] && r[12].data);   /* A/B/C 分区口径来自数据，不在 JS 里写死（FR-24 第 4 条） */
    /* ⚠ 这批下标是位置敏感的：装载数组里插入 /api/overview/devices 之后，调度队列与场景块整体后移一位。
       以前 r[13]/r[14] 就是它俩，现在必须跟着走——写错不会报错，只会让底栏两块静默空掉。 */
    labMeta = r[13] && r[13].data || null; labDevices = (r[13] && r[13].data && r[13].data.devices) || [];
    queueData = r[14] && r[14].data || null; safety = r[15] && r[15].data || null;   /* 底栏块2 调度任务 / 块1 安全管家场景 */
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
      renderZoneView(); renderTables(); renderCharts(); pushState(); renderScenes();
      /* 底栏：块1 统计与块2 的"循环中"要跟着心跳走，但只就地改文本（见 refreshDock） */
      renderDockStats();
      TwinApi.get('/api/overview/dispatch-queue').then(function (r) { queueData = r.data; refreshDock(); }).catch(function () { });
    } else if (ev.type === 'task.progress') {
      var t = tasks.filter(function (x) { return x.taskId === ev.payload.taskId; })[0];
      if (t) { t.progress.percent = ev.payload.percent; t.stage = ev.payload.stage; if (ev.payload.percent >= 100) t.result = 'passed'; renderDock(); }
    } else if (ev.type === 'device.status') { renderZoneView(); }
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
      /* ⑤（2026-11-10 圈图）：tone=数字颜色必须与它头顶的分段条同色（谁是谁一眼对上）；
         row:2=「未完成中」两项下移第二行，头顶配一条与「正在检测+待检测」等长的双线。 */
      { k: 'testing', label: '正在检测', of: 'all', tone: '--tw-st-working' },
      { k: 'pending', label: '待检测', of: 'all', tone: '--tw-st-warn' },
      { k: 'done', label: '已完成检测', cls: 'ok', of: 'all', tone: '--tw-st-ready' },
      { k: 'overdue', label: '未完成中·逾期', cls: 'warn', noPct: true, lims: true, pick: 'overdue', row: 2, tone: '--tw-st-alarm' },
      { k: 'dueSoon', label: '未完成中·临期(3天内)', cls: 'due', noPct: true, lims: true, pick: 'dueSoon', row: 2, tone: '--tw-st-warn' }
    ],
    dispatch: [
      { k: 'done', label: '调度任务已完成', head: true, cls: 'ok' },
      { k: 'blocked', label: '阻塞', cls: 'warn' },
      { k: 'blockedResolved', label: '其中已解决', sub: true, of: 'blocked', cls: 'ok' },
      { k: 'blockedUnresolved', label: '其中未解决', sub: true, of: 'blocked', cls: 'warn' }
    ]
  };
  /* ---------- 图型选型（口径写死在这里，避免下轮随手换图型把语义换掉）----------
     环形 = 少数类别的「构成占比」，各类相加必须等于总数；
     柱状 = 同一口径下的「量级比较」，类别之间可以不相加（88 vs 8 用环形会把 8 挤没，那是骗人）；
     折线带 = 时序趋势。逾期/临期不进环形：它们是「未完成」的子集，塞进同一个环会重复计数。 */
  /* 左栏压缩口径（FR-41，2026-11-07 产品负责人：这块占位太多）。
     一组两行：① 标题 + 大数 + 环比  ② 分解值（放不下自动换行）；
     ③ 只有「分解值相加 == 大数」的组才多一条 5px 分段条——不能相加的画条形就是骗人（FR-36 同一条纪律）。
     2×2 KPI 胶囊整块删除：那四个数就是四组表的第一行，同一批数字在屏上写两遍，
     白吃 ~150px 高度，还把该当主角的三维画面挤掉三分之一。 */
  var COMPACT_BAR = {
    entrust: { parts: ['power', 'safety'], colors: ['--tw-st-working', '--tw-st-cat'] },
    testItems: { parts: ['testing', 'pending', 'done'], colors: ['--tw-st-working', '--tw-st-warn', '--tw-st-ready'],
      parts2: ['overdue', 'dueSoon'], colors2: ['--tw-st-alarm', '--tw-st-warn'], basis2: ['testing', 'pending'] }
  };
  function renderTables() {
    if (!status || !status.panels) return;
    var per = status.panels, stamp = new Date(status.updatedAt || Date.now()).toLocaleTimeString('zh-CN', { hour12: false });
    /* 「调度任务」子区域从左栏撤掉（2026-11-08 圈图）：同一批数在底栏「无人化调度任务」三列与
       106 区域面板里都在，左栏再列一遍就是把一屏当两屏用。数据与接口都不动，只是不在这里出现。 */
    var keys = Object.keys(per).filter(function (k) { return k !== 'dispatch'; });
    var host = $('#tables');
    if (host.dataset.keys !== keys.join(',')) {                        /* 骨架：只在面板集合变化时重建 */
      host.dataset.keys = keys.join(',');
      host.innerHTML = keys.map(function (key) {
        return '<section class="dtable" data-key="' + key + '">' +
          '<header><b>' + escapeHtml(per[key].title) + '</b><span class="dt-q"></span><span class="dt-v">—</span><span class="dt-c"></span></header>' +
          '<div class="dt-bar" role="img" hidden></div>' +
          '<div class="dt-detail"></div>' +
          '<div class="dt-bar dt-bar2" role="img" hidden></div>' +
          '<div class="dt-detail dt-detail2"></div></section>';
      }).join('');
    }
    /* 面板头：来源词与更新时间从屏上撤掉（2026-11-07 圈图），但「数据延迟」必须留着——
       那是异常态提示不是装饰。来源与时间戳改走 aria-label（读屏与二期接口核对仍拿得到）。 */
    var srcs = []; keys.forEach(function (k) { var n = SRC_NAME2[per[k].source] || per[k].source; if (n && srcs.indexOf(n) < 0) srcs.push(n); });
    var rp = $('#rpSrc');
    rp.textContent = dataError ? '数据延迟' : '';
    rp.setAttribute('aria-label', '来源 ' + srcs.join(' · ') + ' · 更新 ' + stamp + (dataError ? ' · 数据延迟' : ''));
    keys.forEach(function (key) {
      var p = per[key], v = p.periods[st.period], rows = ROWS[key] || [];
      var sec = host.querySelector('.dtable[data-key="' + key + '"]'); if (!sec) return;
      var valOf = function (r) { return r.computed ? r.computed(v) : v[r.k]; };
      var head = rows.filter(function (r) { return r.head; })[0] || rows[0];
      var hv = head ? valOf(head) : null;
      /* 大数前面必须挂一个限定词（组名去掉后的那两三个字）：「调度任务 88」会被读成"共 88 个调度任务"，
         而 88 其实是「已完成」——压缩可以省字，不能省掉让数字说真话的那几个字。 */
      var qe = sec.querySelector('.dt-q');
      var q = head ? (head.label.indexOf(p.title) === 0 ? head.label.slice(p.title.length) : head.label) : '';
      qe.textContent = q || '';
      var ve = sec.querySelector('.dt-v');
      ve.textContent = hv == null ? '—' : hv;
      ve.className = 'dt-v' + (head && head.cls ? ' ' + head.cls : '');
      var c = v.compare, ce = sec.querySelector('.dt-c');
      ce.hidden = c == null;
      ce.innerHTML = c == null ? '' : '<i class="d ' + (c >= 0 ? 'up' : 'down') + '">' + (c >= 0 ? '▲' : '▼') + Math.abs(c) + '%</i>' +
        ({ day: '较上日', month: '较上月', year: '较去年' })[st.period];
      /* 分解行：head 那行的数字就是右侧大数，不再重复一遍标签文字 */
      var subs = rows.filter(function (r) { return r !== head && !r.row; });
      var subs2 = rows.filter(function (r) { return r !== head && r.row === 2; });
      /* FR-49（2026-11-08 圈图）：屏上的「LIMS」角标撤掉——左栏是运行镜像，不是数据字典，
         来源标记飘在数字前面反而成了噪声。口径本身不能丢：并进这一行的 aria-label，
         读屏与 QA 仍复核得到，与 FR-41/FR-43「来源与时间戳一律转 aria-label、不上屏」同一条纪律。
         ①（2026-11-10）：行一/行二共用同一个构造器——逾期/临期下移第二行时，
         明细清单与 LIMS 口径的 aria 一字不能丢（plancheck 抓到过一次只留口径不留明细）。 */
      function rowHTML(r) {
        var val = valOf(r);
        if (val == null) return '<span class="dt-i na"><span class="lb">' + escapeHtml(r.label) + '</span><b class="v">—</b></span>';
        var base = r.of ? v[r.of] : null;
        var pct = (!r.noPct && base) ? Math.round(val / base * 100) + '%' : '';
        var ariaBits = [];
        if (r.pick) {
          var list = planItems.filter(function (x) { return x[r.pick]; });
          /* 明细清单同样不上屏也不给 hover（产品负责人：连 hover 都不想要） */
          ariaBits.push(r.label + ' ' + val + '：' + (list.map(function (x) { return x.sampleId + ' ' + x.item + ' · 要求 ' + x.requiredAt; }).join('；') || '无'));
        }
        if (r.lims) ariaBits.push('口径来自 LIMS「要求检测完成时间」，当前为 Mock 数据，二期接口接入后自动变真值' + (p.note ? '。' + p.note : ''));
        var aria = ariaBits.length ? ' aria-label="' + escapeHtml(ariaBits.join('。')) + '"' : '';
        return '<span class="dt-i' + (r.cls ? ' ' + r.cls : '') + '"' + aria + (r.tone ? ' data-tone="' + r.tone + '"' : '') + '><span class="lb">' + escapeHtml(r.label) + '</span>' +
          '<b class="v"' + (r.tone ? ' style="color:var(' + r.tone + ')"' : '') + '>' + val + '</b>' + (pct ? '<span class="pct">' + pct + '</span>' : '') + '</span>';
      }
      sec.querySelector('.dt-detail').innerHTML = subs.map(rowHTML).join('');
      /* ⑤ 第二行（未完成中·逾期/临期）+ 头顶二级条：
         二级条总长 == 一级条「正在检测+待检测」两段合计的宽度（圈图原话），
         内部按 逾期:临期 的真实数量比例分色分段；数字颜色与所属分段同色。 */
      var bar2 = sec.querySelector('.dt-bar2'), d2 = sec.querySelector('.dt-detail2');
      /* 注意：一级条的 cfg 在下方才赋值（var 提升让它此刻是 undefined）——二级条必须自己取配置 */
      var cfg2 = COMPACT_BAR[key];
      if (cfg2 && cfg2.parts2 && subs2.length) {
        var seg2 = [], sum2 = 0, basis = 0;
        cfg2.basis2.forEach(function (k2) { basis += (v[k2] || 0); });
        cfg2.parts2.forEach(function (k2) {
          var r2 = rows.filter(function (x) { return x.k === k2; })[0]; if (!r2) return;
          var vv = valOf(r2) || 0; sum2 += vv; seg2.push({ r: r2, v: vv });
        });
        d2.innerHTML = subs2.map(rowHTML).join('');
        if (hv && basis > 0 && seg2.length) {
          bar2.hidden = false;
          bar2.innerHTML = '<span class="dt-bar2-inner" style="width:' + Math.min(100, basis / hv * 100).toFixed(2) + '%">' +
            seg2.map(function (x, i2) {
              return '<i style="width:' + (sum2 ? x.v / sum2 * 100 : 50).toFixed(2) + '%;background:var(' + cfg2.colors2[i2 % cfg2.colors2.length] + ')"></i>';
            }).join('') + '</span>';
          bar2.setAttribute('aria-label', '未完成中构成：' + seg2.map(function (x) { return x.r.label + ' ' + x.v; }).join(' · ') +
            '（条长与上方「正在检测＋待检测」等长）');
        } else { bar2.hidden = true; bar2.innerHTML = ''; }
      } else if (d2) { d2.innerHTML = ''; if (bar2) { bar2.hidden = true; bar2.innerHTML = ''; } }
      /* 分段条：各部分相加必须等于大数才画；宽度用真实比例（不是四舍五入后的百分比） */
      var bar = sec.querySelector('.dt-bar'), cfg = COMPACT_BAR[key], sum = 0, segs = [];
      if (cfg && hv) {
        cfg.parts.forEach(function (k2) { var r2 = rows.filter(function (x) { return x.k === k2; })[0]; if (!r2) return; var vv = valOf(r2) || 0; sum += vv; segs.push({ r: r2, v: vv }); });
      }
      if (cfg && hv && sum === hv && segs.length > 1) {
        bar.hidden = false;
        bar.innerHTML = segs.map(function (x, i2) {
          return '<i style="width:' + (x.v / hv * 100).toFixed(2) + '%;background:var(' + cfg.colors[i2 % cfg.colors.length] + ')"></i>';
        }).join('');
        bar.setAttribute('aria-label', p.title + ' 构成：' + segs.map(function (x) { return x.r.label + ' ' + x.v + '（' + Math.round(x.v / hv * 100) + '%）'; }).join(' · '));
      } else { bar.hidden = true; bar.innerHTML = ''; bar.removeAttribute('aria-label'); }
      sec.setAttribute('aria-label', p.title + ' ' + (hv == null ? '暂无' : hv) + ' · 来源 ' + (SRC_NAME2[p.source] || p.source || '—') + ' · 更新 ' + stamp +
        ' · ' + subs.map(function (r) { return r.label + ' ' + valOf(r); }).join('，'));
    });
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
      '<div class="row"><span>来源系统</span><b>' + (SRC_NAME[a.source] || a.source || '—') + '</b></div>');
    /* 「MVP 只呈现当前告警与闭环状态；事件序列回溯（原 S3）已移出本期范围…」这段按 2026-11-08 圈图撤除：
       那是我们内部的交付范围说明，客户在告警详情里要看的是这条告警本身。
       口径不丢——"孪生只读、处置由来源系统回传"写在 PRD 与 docs 里，屏上不占位置。 */
    /* 点告警不切视图（2026-11-08 产品负责人）：原来这里 sceneCmd('view') 把镜头飞到告警所在房间，
       等于"我在总览里点一条告警，整个页面把我拽进那个房间"——看告警是读，切视图是走，
       两件事被一次点击同时做掉，客户会以为页面自己乱跳。
       现在只描边 + 提示（下面几行原有逻辑保留），视图留在原地。 */
    var z = (a.zoneId || '').replace('Z-', '');
    /* 告警主体解析顺序：台账设备 → 机器人 → 只有 CAD 实体号的对象（如 106-12 AGV 上料试验桌，非数采、无台账号） */
    var d0 = a.deviceId ? devices.filter(function (x) { return x.deviceId === a.deviceId; })[0] : null;
    if (d0) { detailDev = d0; pollRealtime(); if (d0.modelNode) sceneCmd('equipment-highlight', { id: d0.modelNode.replace('cad:', '') }); }
    else if (a.deviceId && String(a.deviceId).indexOf('RB') === 0) {
      /* 机器人主体：告警详情必须留在屏上（原因/闭环状态/派至才是要点），只额外描边 + 提示，绝不覆盖成机器人详情 */
      var r0 = robots.filter(function (x) { return x.robotId === a.deviceId; })[0];
      if (r0) { sceneCmd('equipment-highlight', { id: r0.modelRoot }); flashHint('关联机器人 ' + r0.robotId + ' · ' + (r0.currentFlowName || '无在制任务')); }
    }
    else if (a.cadEntity) {
      sceneCmd('equipment-highlight', { id: a.cadEntity });   /* 描边照做——CAD 实体号是事实，不需要台账号 */
      flashHint('已描边 ' + a.cadEntity + '（数采对应，台账与实时通道待接入）');
    }
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
    if (st.mode === 'ZONE') renderZoneView();
  }
  function alarmRows(list, cls) {
    return list.map(function (x) {
      var attrs = ' class="' + cls + (x.status === 'resolved' ? ' is-resolved' : '') + '" data-alarm="' + x.alarmId + '" data-dev="' + (x.deviceId || '') + '"' +
        ' tabindex="0" role="button" aria-label="' + escapeHtml(x.grade + ' 级 ' + x.title + '，' + ST_AB(x.status) + '，回车查看详情') + '"' +
        ' data-zone="' + x.zoneId.replace('Z-', '') + '" data-grade="' + x.grade + '" data-status="' + x.status + '"' +
        ' data-to="' + escapeHtml(x.dispatchedTo || '') + '" data-title="' + escapeHtml(x.title) + '"';
      return '<div' + attrs + '>' +
        '<div class="l1"><span class="gd ' + x.grade.toLowerCase() + '">' + x.grade + '</span><span>' + escapeHtml(x.title) + '</span><span class="tm">' + x.occurredAt + '</span></div>' +
        '<div class="rs">' + escapeHtml(x.reason) + '</div>' +
        '<div class="l2"><span class="st ' + x.status + '">' + ST_AB(x.status) + '</span><span class="zn">' + x.zoneId.replace('Z-', '') + ' 区</span>' +
        '<span class="to" title="派至 ' + escapeHtml(x.dispatchedTo || '待派发') + '">派至 ' + escapeHtml(x.dispatchedTo || '待派发') + '</span>' + (cls === 'st-row' ? '<span class="tr">详情</span>' : '') + '</div></div>';
    }).join('');
  }

  /* 告警流（2026-11-07 改版）：不再切 A/B/C 三个分区，按发生时间倒序平铺——
     运维要的是"接下来处理哪条"，不是"哪一级有几条"；等级仍写在每行的徽标里，信息一项没丢。
     分级计数没有消失，交给上方那张 3D 分组柱（今日 / 未解除）。 */
  function renderAlarms() {
    /* 头部计数与下面的列表必须同一个范围（2026-11-08 pickcheck 同源比对抓到）：
       区域视图里列表已按本房间收窄成 11 条，头上还写全场 13 条——
       客户在 106 画面里数一遍就知道对不上。范围先算一次，头部/列表/筛选都从它出。 */
    var scope = alarms.filter(function (x) { return st.mode !== 'ZONE' || (x.zoneId || '') === 'Z-' + st.zone; });
    var openN = scope.filter(function (x) { return x.status !== 'resolved'; }).length;
    var mode = st.streamFilter || 'all';
    $('#streamMeta').textContent = '今日 ' + scope.length + ' 条 · 未解除 ' + openN + ' ·'
      + (st.mode === 'ZONE' ? ' ' + st.zone + ' 区 ·' : '') + ' 最新在前';
    var list = scope.slice().sort(function (a, b) { return String(b.occurredAt).localeCompare(String(a.occurredAt)); });
    if (mode === 'open') list = list.filter(function (a) { return a.status !== 'resolved'; });
    document.querySelectorAll('#alarmStream [data-sfilter]').forEach(function (x) { x.classList.toggle('active', x.dataset.sfilter === mode); });
    var track = $('#streamTrack');
    var rowsHtml = alarmRows(list, 'st-row');
    /* 无缝滚动靠 translateY(-50%)，所以内容必须原样复制一份——平铺后没人再做这件事，
       不复制就会滚到一半跳回顶部（回归当场抓到：行数 13 而不是 26）。aria-hidden 让读屏只念一遍。 */
    /* 区域视图下范围是本房间，空态措辞要说清"这个区今日无告警"，
       而不是让人以为整站没告警了（总览那条还在）。 */
    var emptyTxt = (st.mode === 'ZONE' ? (st.zone + ' 区今日') : '今日') + (mode === 'open' ? '无未解除告警' : '无告警');
    track.innerHTML = rowsHtml ? rowsHtml + '<div class="dup" aria-hidden="true">' + rowsHtml + '</div>'
                               : '<div class="zp-empty">' + emptyTxt + '</div>';
    track.classList.toggle('scroll', list.length > 4);   /* 只有真的溢出才滚动：四五条硬滚动反而读不完 */
    keyable(track);
  }

  /* ---------- ③ 106 主叙事：机器人卡住 / 当前调度任务 / 设备状态 / 异常（决策 Q4） ---------- */
  function stamp(z) { return function (d) { d.zoneId = d.zoneId || 'Z-' + z; return d; }; }   /* 区域归属=数据来源分区（删机器人浮条时曾被连带删掉，导致整条装载链中断） */
  /* 区域设备列表按**物理房间**取：全场表记录带 roomId（10 位数字），老的两区记录带 zoneId（Z-106）。
     之前只认 zoneId，换成全场表后每个区都筛成空列表——面板于是写「未建档」、108/109/110 一台都不出。 */
  function zoneDevices(z) {
    return devices.filter(function (d) {
      var rm = d.roomId || (d.zoneId || '').slice(2);
      return rm === z;
    });
  }
  /* 这一区有没有资产决定面板标题：102 样品室的货架/充电位/电视不是"设备"，
     但客户要在那一栏看到它们，所以标题写「资产」、列的是设备+资产。 */
  function zoneHasAssets(z) { return devices.some(function (d) { return d.asset && (d.roomId || '') === z; }); }

  /* ---------- 区域视图五类信息：设备 / 环境数据 / 任务统计 / 正在运行的任务 / 告警 ---------- */
  function loadZone() {
    var z = st.zone;
    /* 兜底：没有房间就一次请求都不发。上面的状态修好后本不该走到这里，
       但"给 null 拼 URL"这种请求一旦发出去就是脏数据 + 一条被吞掉的异常，宁可在这里挡死。 */
    if (!z) return;
    /* 换房间必须先把上一个区域的三份数据清空再取：
       renderZoneView 在 applyAll 里同步跑，而 loadZone 是异步的——不清就有半秒用 106 的在制任务
       画 107 的底栏（实测 2026-11-08：107 的空态行是被 106 的数据挤掉的）。
       退役面板当年靠"收尾把 hidden 块的内容清掉"防同一件事，接管后改成从源头清。 */
    zstats = null; zrunning = []; zalarms = []; zvrSig.stat = zvrSig.dev = '';
    Promise.all([TwinApi.get('/api/zone/' + z + '/task-stats'), TwinApi.get('/api/zone/' + z + '/running-tasks'), TwinApi.get('/api/zone/' + z + '/alarms')])
      .then(function (r) {
        if (st.mode !== 'ZONE' || st.zone !== z) return;
        zstats = r[0].data || null; zrunning = (r[1].data && r[1].data.tasks) || []; zalarms = (r[2].data && r[2].data.alarms) || [];
        renderZoneView(); renderCharts();
      }).catch(function (e) { fail('区域数据加载失败：' + e.message); });
  }
  /* 区域视图统一渲染入口（FR-80：五段长面板退役之后，左栏 + 底栏 + 右列就是全部落点）。
     原来这个位置叫 renderZonePanel，函数体一直往已 display:none 的旧面板里写数据。
     后果不是"难看"，是测试与真实行为分家：robotcheck 对着看不见的行按回车，焦点根本进不去，
     详情自然打不开；smoke/kpicheck 又能读到那份隐藏文本，于是全绿里混着假绿。
     面板的七块信息在这里一条都不能丢，所以逐块交接：
       设备（编号+名称+「型号」/有告警的排前面/本房间机器人）→ 左栏 #zDevsList
       任务统计、检测项目数、样品台账（含按名称分布）    → 左栏 #zsGrid
       环境数据（本房间点位）                              → 右列组态物联
       告警（本房间）                                      → 右列告警流
       正在运行的任务（来源/超时/进度）                    → 底栏 #dkRunningTrack */
  var zvrSig = { stat: '', dev: '', run: '' };
  /* 这个房间有哪些口径，唯一事实源是种子里的 viewProfile.blocks（106=task-stats、
     102=samples、其他试验区=test-items、101/104 只有 env）。
     上一版直接在 JS 里比"periods 有没有值"，结果 102 样品室被一份带零的 periods 顶成了「任务统计」，
     286 支在库存量整块不见了，101 接待大厅还摆了四个 0 —— 就是产品负责人反复批的那种假格子。 */
  function zoneBlocks(z) {
    var zo = zones.filter(function (x) { return x.zoneId === 'Z-' + z; })[0] || {};
    return (zo.viewProfile || {}).blocks || [];
  }
  /* ④（2026-11-09 四次圈图）「极简房间」判定，数据驱动不写死 101：
     没有任何按口径的统计（task-stats/test-items/samples 都不在 blocks）
     且本房间 0 台建档功能设备 → 左栏/底栏/告警流对它就是空壳。101 接待厅、104 控制室命中。 */
  function zoneSimple(z) {
    var bl = zoneBlocks(z);
    var hasStats = bl.indexOf('task-stats') >= 0 || bl.indexOf('test-items') >= 0 || bl.indexOf('samples') >= 0;
    var pool = zoneDevices(z).filter(function (d) { return !d.asset; });
    return !hasStats && pool.length === 0;
  }
  /* 极简房间右下角：每个节点一张小卡——名称＋类型、状态、数据（口径与底栏组态行完全同源：nodeReading）。 */
  function renderZoneNodes() {
    var box = $('#zoneNodes'); if (!box) return;
    if (!(st.mode === 'ZONE' && document.body.dataset.zoneSimple === '1')) { box.hidden = true; return; }
    var ns = (envNodes || []).filter(function (n) { return String(n.roomId) === String(st.zone); });
    box.hidden = false;
    box.innerHTML = ns.map(function (n) {
      var stt = n.status === 'normal' ? '正常' : (n.status === 'offline' ? '离线' : (n.status || '—'));
      var val = nodeReading(n) || '—';
      return '<div class="zn-card" data-node="' + escapeHtml(n.id) + '" role="listitem"'
        + ' aria-label="' + escapeHtml(n.name + '，类型 ' + (n.type || '') + '，状态 ' + stt + '，数据 ' + val) + '">'
        + '<div class="zn-h"><b>' + escapeHtml(n.name) + '</b><span class="tp">' + escapeHtml(NODE_CN(n.type) || '节点') + '</span></div>'
        + '<div class="zn-r"><span class="st ' + (n.status === 'normal' ? 'normal' : 'off') + '">' + escapeHtml(stt) + '</span>'
        + '<b class="v">' + escapeHtml(val) + '</b></div></div>';
    }).join('');
  }
  function renderZoneView() { if (st.mode !== 'ZONE') return; renderZoneRail(); renderZoneRunning(); renderZoneNodes(); renderZoneIotPanel(); }

  /* ⑤（2026-11-10 圈图）：房间视图带右列的组态物联块重排——
     除视觉外本房间有几个物联节点，就把整块等分成几行、一行一节点、行高一致；
     撤掉无缝轮播（节点本来就少，滚动是总览大清单的做法），全场均值图也不在房间视图出现
     （节点卡自己就是本房间逐点真数，均值图在这里没有增量信息）。 */
  function renderZoneIotPanel() {
    var pnl = $('#iotPanel'); if (!pnl) return;
    var inBand = pnl.parentElement && pnl.parentElement.classList.contains('zb-r');
    var thw = pnl.querySelector('.th-wrap'), npv = pnl.querySelector('.np-view');
    var zb = pnl.querySelector('#dkNodesZone');
    if (!inBand) {
      if (thw) thw.hidden = false; if (npv) npv.hidden = false;
      if (zb) { zb.hidden = true; zb.innerHTML = ''; }
      return;
    }
    if (!zb) {
      zb = document.createElement('div'); zb.id = 'dkNodesZone';
      zb.setAttribute('role', 'list'); zb.setAttribute('aria-label', '本房间物联节点（等分卡片，无滚动）');
      pnl.appendChild(zb);
    }
    if (thw) thw.hidden = true; if (npv) npv.hidden = true; zb.hidden = false;
    var ns = (envNodes || []).filter(function (n) { return String(n.roomId) === String(st.zone) && n.type !== 'camera'; })
      .sort(function (a, b) { return String(a.id).localeCompare(String(b.id)); });
    zb.style.gridTemplateRows = 'repeat(' + Math.max(1, ns.length) + ',minmax(0,1fr))';
    zb.innerHTML = ns.map(function (n) {
      var stw = n.status === 'normal' ? '正常' : (n.status === 'offline' ? '离线' : (n.status || '—'));
      var dot = n.status === 'offline' ? ' off' : (n.status === 'normal' ? '' : ' bad');
      var val = nodeReading(n) || '—';
      return '<div class="zi-card" role="listitem" data-node="' + escapeHtml(n.id) + '"'
        + ' aria-label="' + escapeHtml(n.name + '，' + NODE_CN(n.type) + '，状态 ' + stw + '，数据 ' + val) + '">'
        + '<div class="zi-l"><i class="zi-dot' + dot + '"></i><div class="zi-t"><b>' + escapeHtml(n.name) + '</b>'
        + '<span>' + escapeHtml(n.roomId + ' 区 · ' + NODE_CN(n.type)) + '</span></div></div>'
        + '<div class="zi-v">' + escapeHtml(val) + '</div></div>';
    }).join('');
  }
  /* ②（2026-11-10 圈图）：设备运行状态钉在左栏底部后，「无人化调度任务」块顶边跟着它的标题走——
     底栏 top 由 JS 按实测矩形对齐（CSS 猜不出内容高度），回总览/非无人化房间时清掉内联值。 */
  function syncZoneBandTop() {
    /* 圆环是异步出图的（TwinCharts pending 重试），首量时 rd-wrap 还是塌的——
       renderCharts 尾部会再叫一次本函数，底栏顶边永远跟着圆环的最终位置。 */
    var dk = $('#taskStrip'), rd = $('#railDev'); if (!dk || !rd) return;
    var on = st.mode === 'ZONE' && document.body.dataset.unmanned === '1';
    if (on && !dk.hidden) {
      var q = rd.getBoundingClientRect();
      /* .dock 住在 .stage 里（absolute，stage 从顶栏下 y=56 起算），
         railDev 的 rect 是视口坐标——直接写 top 会整体低一个顶栏高（zoneview ① 抓到 56px 偏差）。 */
      var sr = (document.querySelector('.stage') || dk.offsetParent || document.body).getBoundingClientRect();
      if (q.height > 2) { dk.style.top = Math.round(q.top - sr.top) + 'px'; dk.style.height = 'auto'; return; }
    }
    dk.style.top = ''; dk.style.height = '';
  }

  /* 样品按名称分布（原在退役面板的「样品台账」块里）：合计与存量不一致必须当场说出来，不静默。 */
  function sampleSpread(sp) {
    var sum = (sp.byName || []).reduce(function (a, x) { return a + x.count; }, 0);
    return '<div class="sp-names">' + (sp.byName || []).map(function (x) {
      var w = sp.stored ? Math.round(x.count / sp.stored * 100) : 0;
      return '<div class="sp-nm" title="' + esc0(x.name + ' ' + x.count + ' 支（占 ' + w + '%）') + '">'
        + '<span>' + esc0(x.name) + '</span><i><b style="width:' + w + '%"></b></i><em>' + x.count + ' 支</em></div>';
    }).join('') + '</div>'
      + (sum === sp.stored ? '' : '<div class="zs-i"><span>分布合计 ' + sum + ' 与存量 ' + sp.stored + ' 不一致，以台账为准。</span></div>');
  }
  /* 节点读数文案（物联节点唯一口径：区域面板「环境数据」与底栏块4 共用） */
  function nodeReading(n) {
    var v = (n && n.values) || {};
    if (v.temperature != null) return v.temperature + '℃ · ' + v.humidity + '%RH';
    if (v.illuminance != null) return v.illuminance + ' lx';
    if (v.detected != null) return v.detected ? '已触发' : '正常';
    if (v.exceeded != null) return v.exceeded ? '超限' : '正常';
    if (v.activity != null) return v.activity ? '有人活动' : '无人';
    if (v.contact != null) return '触点' + (v.contact === 'closed' ? '闭合' : '断开');
    if (v.connection != null) return v.videoSource ? '视频在线' : '画面未接入';
    return '—';
  }

  function ST_CN(x) { return { working: '运行', ready: '就绪', standby: '待机', stopped: '停机', alarm: '异常' }[x] || x; }
  function ST_AB(x) { return { active: '未解除', dispatched: '已派发', resolved: '已解除' }[x] || x; }
  function NODE_CN(t) { return { temperature: '温湿度', smoke: '烟感', gas: '气体', water: '水浸', motion: '人体', switch: '开关量', camera: '视觉', light: '照明' }[t] || t; }

  /* 与 mock/场景同一套时间轴公式：t0=停靠开始，travel 在其之前；按墙上时钟取模 */
  /* 与 mock/场景同一套 steps 时间轴（2026-11-07 改版）：
     屏上"第 n 道"取的是任务窗口，不再是站点序号——一个站点可能连着办 2~3 道任务。
     行进段归到"下一道的路上"，所以显示第 n 道时 AGV 一定正跑在第 n 道对应的线路上。 */
  function cycleAt(t) {
    if (!cycleDef || !cycleDef.stops) return null;
    var L = cycleDef.loopSec, ST = cycleDef.steps || [];
    if (!ST.length) return null;
    t = ((t % L) + L) % L;
    for (var i = 0; i < ST.length; i++) {
      if (t < ST[i].endSec) {
        var sp = ST[i], dwell = t >= sp.t0;
        return { order: sp.no, total: ST.length, label: sp.label,
          flow: sp.flowCode ? sp.flowCode + ' ' + sp.flowName : sp.flowName,
          phase: dwell ? 'dwell' : 'travel', remainingSec: Math.max(0, Math.round(dwell ? sp.endSec - t : sp.t0 - t)),
          taskNo: sp.taskNo, deviceCode: sp.deviceCode, seq: sp.seq, kind: sp.kind,
          visit: sp.visit, visits: cycleDef.stops.length };
      }
    }
    var last = ST[ST.length - 1];
    return { order: last.no, total: ST.length, label: '返回 102 家位/充电位', flow: '返航', phase: 'travel',
      remainingSec: Math.max(0, Math.round(L - t)), taskNo: null, deviceCode: null, seq: null, kind: 'return',
      visit: cycleDef.stops.length, visits: cycleDef.stops.length };
  }
  function tickCycle() { renderCycle(cycleAt(Date.now() / 1000)); }


  /* ---------- 底栏四块（2026-11-06 产品负责人方案，见 PRD §5.2A） ----------
     ① 设备运行状态（四档圆环）  ② 无人化调度任务队列（图3 流程配置 + 图1 三分类）
     ③ 正在检测委托单下的试验项完成情况（图4 名称与检测设备）  ④ 组态物联节点滚动 */
  function dkTrack(id, html, per) {
    var el = $(id); if (!el) return;
    el.innerHTML = html + html;                                  /* 复制一份做无缝滚动 */
    /* 后一半是「回声副本」，只为 translateY(-50%) 的无缝滚动存在，不是第二条任务：
       告警流那边用 .dup[aria-hidden] 包一层解决，这里 .dk-track 是 flex 列、行自带 margin，
       包一层会改行距（-50% 就对不齐，滚动会跳），所以逐行标注，口径一致。
       不标注的代价是实打实的：每条任务/试验项/物联点位被读屏念两遍、Tab 停点多一倍。
       副本仍可点击——点在副本与点在原件是同一件事，只是不再进无障碍树与 Tab 序。 */
    var nn = el.children.length;
    for (var ii = nn >> 1; ii < nn; ii++) { var cc = el.children[ii];
      cc.setAttribute('aria-hidden', 'true'); cc.tabIndex = -1; cc.removeAttribute('role'); }
    el.style.animation = per > 1 ? ('dkUp ' + Math.max(18, Math.round(per * 4.6)) + 's linear infinite') : 'none';
  }
  /* 心跳刷新：只就地改类名与文本。
     重建 innerHTML 会把 CSS 无缝滚动动画重置，底栏每 2s 弹回顶部——那比数据不更新更糟。 */
  function refreshDock() {
    var qt = (queueData && queueData.tasks) || [];
    /* 三列布局下，任务换状态=换列，就地改字改不了位置。重建会把 CSS 无缝滚动弹回顶部
       （FR-30b 那条教训），所以只在「列归属真的变了」时重建一次——一圈里这只会发生几次
       （AGV 每办完一道，那条任务从 进行中 挪进 已完成），而不是每 2s 一次。 */
    var sig = qt.map(function (t) { return t.seq + ':' + t.shown; }).join(',');
    if (dqSig && sig !== dqSig) { renderDock(); return; }
    qt.forEach(function (t) {
      document.querySelectorAll('.dq3 .dq-row[data-seq="' + t.seq + '"]').forEach(function (el) {
        el.classList.remove('running', 'unassigned', 'done'); el.classList.add(t.shown);
        var st = el.querySelector('.st'), tm = el.querySelector('.tm');
        if (st) st.textContent = t.live ? '循环中' : ((queueData.stateLabels || {})[t.shown] || t.shown);
        if (tm) tm.textContent = (t.shown === 'running' && t.elapsedMin) ? ('已 ' + t.elapsedMin + '/' + t.plannedMin + 'min') : (t.time || '—');
      });
    });
    queueAria(qt);
    renderCams();
    (envNodes || []).forEach(function (n) {
      document.querySelectorAll('#dkNodesTrack .nd-row[data-node="' + n.id + '"]').forEach(function (el) {
        var rd = el.querySelector('.rd'), ti = el.querySelectorAll('.ti')[1];
        if (rd) rd.textContent = nodeReading(n);
        if (ti) ti.textContent = new Date(n.updatedAt).toLocaleTimeString('zh-CN', { hour12: false });
      });
    });
  }
  /* 读一个 CSS 变量的计算值（图表与图例共用，避免在 JS 里再抄一遍色板） */
  function TOK(name) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || '#2878FF';
  }
  function renderDockStats() {
    /* 建档合计的唯一真相 = /api/overview/devices（全场功能设备 32 台，逐台可对）。
       原来这里用 devices（=106 接口 + 103 接口相加=11 台）当全场，那是"接口给了哪两个区"，
       不是"场里有几台设备"——产品负责人一句"你怎么写建档才 11 台"戳穿的就是这个。 */
    /* ②（2026-11-09 10 点清单）：圆环回到房间视图左栏，口径跟着「只统计本房间」——
       与左栏设备列表同一个 zoneDevices 池，两处数字必须互洽；总览仍是全场 32 台建档。 */
    var pool = (st.mode === 'ZONE' ? zoneDevices(st.zone) : (labDevices.length ? labDevices : devices)).filter(function (d) { return !d.asset; });
    var cnt = { working: 0, ready: 0, standby: 0, stopped: 0, alarm: 0 };
    pool.forEach(function (d) { cnt[d.status] = (cnt[d.status] || 0) + 1; });
    var total = pool.length;   /* 稼动率不再单列一行：它就是「运行」那档的台数与占比 */
    var el = $('#dkDevSrc'); if (el) el.textContent = total + ' 台建档';   /* 台数是内容不是装饰；来源词按 2026-11-07 圈图撤掉 */
    var body = $('#dkDevBody'); if (!body) return;
    /* 颜色一律读状态 token（FR-35：一个语义一个色，屏上任何角落不许漂移）——
       圆环、图例色点、三维状态光点、台账状态标签因此是同一族值，不是四份抄来的 hex。 */
    /* 五档（2026-11-08 产品负责人定色）：运行蓝 / 就绪绿 / 异常红 / 待机浅灰 / 停机深灰。
       上一轮把「就绪」折进「待机」只是为了凑"四档相加=总数"；现在五档各自有家，
       折档说明与 title 里的辩护一并撤除——口径不需要解释就是好口径。 */
    function listOf(st) {
      return pool.filter(function (d) { return d.status === st; })
        .map(function (d) { return { code: d.code, name: d.name, subZone: d.subZone, model: d.model || null, type: d.type }; });
    }
    var buckets = [
      { k: '运行', v: cnt.working, c: TOK('--tw-st-working'), list: listOf('working') },
      { k: '就绪', v: cnt.ready, c: TOK('--tw-st-ready'), list: listOf('ready') },
      { k: '异常', v: cnt.alarm, c: TOK('--tw-st-alarm'), list: listOf('alarm') },
      { k: '待机', v: cnt.standby, c: TOK('--tw-st-standby'), list: listOf('standby') },
      { k: '停机', v: cnt.stopped, c: TOK('--tw-st-stopped'), list: listOf('stopped') }
    ];
    body.innerHTML = '<div class="dk-legend">' + buckets.map(function (x) {
      var pc = total ? Math.round(x.v / total * 100) : 0;
      return '<div class="dk-lg' + (x.v ? '' : ' zero') + '" title="' + escapeHtml(x.k + ' ' + x.v + ' 台（' + pc + '%）· ' + (x.list.map(function (y) { return y.code; }).join('、') || '无')) + '">' +
        '<i style="background:' + x.c + '"></i><span class="nm">' + x.k + '</span>' +
        '<b class="vv">' + x.v + '</b><span class="pc">' + pc + '%</span></div>';
    }).join('') + '</div>';
    /* 机器人那一行文字已经升级成左栏独立的 AGV 块（renderAgv），这里不再重复写一遍 */
    renderAgv();
    /* 圆环只画非零档，中心数字是建档合计；精确数与占比走上面的 HTML 图例
       （字更清晰、可选中、可读屏，而且等轴挤出的扁洞里放不下两行字） */
    TwinCharts.donut($('#chartDevices'), 'devices', buckets.map(function (x) { return { k: x.k, v: x.v, c: x.c, list: x.list }; }),
      /* 环放大（rx .32→.355）、带子收薄（inner .6→.58）、挤出减浅（depth .16→.105）、档间留 5° 缝。
         产品负责人嫌原来「一坨蓝」，这几项合起来才读得出这是四档分布而不是一个蓝色圆盘。 */
      { height: 96, legend: false, cx: .5, cy: .52, rx: .355, flat: .86, inner: .58, depth: .105, padDeg: 5 });
    bindRingTip();
  }
  /* 环形图 hover（产品负责人：hover 到对应颜色环上应展示该档设备的名称/区域/编号/型号）。
     命中判定不猜几何——直接读指针下那一个像素的颜色，与各档的顶/前/侧三条色带比距离：
     换环径、换挤出深度、换 DPR 都不会失准（用角度反算就得跟着 ringFaces 的参数一起维护）。
     卡片跟随鼠标，与设备信息气泡同一套交互（不牵动相机，FR-40 的既定口径）。 */
  function bindRingTip() {
    var wrap = $('#chartDevices'); if (!wrap || wrap.__tipBound) return; wrap.__tipBound = true;
    var tip = document.createElement('div'); tip.className = 'ring-tip'; tip.hidden = true; tip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tip);
    function segAt(ev) {
      var segs = wrap.__ring; if (!segs || !segs.length) return null;
      var cv = wrap.querySelector('canvas'); if (!cv || !cv.width) return null;
      var r = cv.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return null;
      var x = Math.round((ev.clientX - r.left) * (cv.width / r.width)), y = Math.round((ev.clientY - r.top) * (cv.height / r.height));
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) return null;
      var d; try { d = cv.getContext('2d').getImageData(x, y, 1, 1).data; } catch (e) { return null; }
      if (d[3] < 120) return null;
      var best = null, bd = 1e9;
      segs.forEach(function (s) { s.colors.forEach(function (c) {
        var dd = Math.abs(d[0] - c[0]) + Math.abs(d[1] - c[1]) + Math.abs(d[2] - c[2]);
        if (dd < bd) { bd = dd; best = s; } }); });
      return bd <= 60 ? best : null;
    }
    wrap.addEventListener('pointermove', function (ev) {
      var s = segAt(ev);
      if (!s) { tip.hidden = true; return; }
      var rows = s.list.slice(0, 8).map(function (x) {
        return '<div class="rt-i"><b>' + escapeHtml(x.code) + '</b><span>' + escapeHtml(x.name) +
          '<em>' + escapeHtml(x.subZone || '') + (x.model ? ' · ' + escapeHtml(x.model) : '') + '</em></span></div>';
      }).join('');
      tip.innerHTML = '<div class="rt-h"><i style="background:' + s.c + '"></i>' + escapeHtml(s.k) + ' ' + s.v + ' 台 · ' + s.pc + '%</div>'
        + rows + (s.list.length > 8 ? '<div class="rt-m">…共 ' + s.list.length + ' 台，完整清单见设备台账</div>' : '');
      tip.hidden = false;
      var w = tip.offsetWidth || 212, h = tip.offsetHeight || 120;
      tip.style.left = Math.min(window.innerWidth - w - 12, ev.clientX + 14) + 'px';
      tip.style.top = Math.min(window.innerHeight - h - 12, Math.max(12, ev.clientY - 10)) + 'px';
    });
    wrap.addEventListener('pointerleave', function () { tip.hidden = true; });
  }
  /* AGV 机器人块（2026-11-08）：每台一行——编号 / 状态 + 正在办的任务 / 电量条 + 百分比。
     电量与状态全部来自调度心跳里的 robots（seed 有 battery，mock 每 tick 掉电/回充，低电自己回桩），
     屏上不编数：停靠桩的那台显示「停靠充电 · 回升中」，不写成故障。 */
  /* 4 路视觉节点画面：格位与归属先按真实节点表落好（103/105/106/109）。
     画面本身要场景离屏渲相机才能给，没渲之前写「画面待接入」，不放静态图冒充实时。 */
  var camList = [], camPull = null;
  function renderCams() {
    var el = $('#camGrid'); if (!el) return;
    /* 区域视图只看本房间的摄像头；一间都没有就整块不出现（FR-80） */
    var cams = (envNodes || []).filter(function (n) { return n.type === 'camera' && (st.mode !== 'ZONE' || String(n.roomId) === String(st.zone)); });
    var box = $('#cctvBox'); if (box) box.hidden = st.mode === 'ZONE' && cams.length === 0;
    el.innerHTML = cams.map(function (n) {
      return '<div class="cam-tile" data-node="' + n.id + '" tabindex="0" role="button" aria-label="'
        + escapeHtml(n.id + ' ' + n.name + '，位于 ' + n.roomId + ' 区，' + nodeReading(n) + '；当前画面是孪生场景按该点位坐标渲的色，非现场实拍；视频通道二期接入') + '">'
        + '<canvas width="320" height="180"></canvas>'
        + '<div class="cm"><i class="rec"></i><b>' + escapeHtml(n.name) + '</b><span class="rm">' + escapeHtml(n.roomId) + ' 区</span></div>'
        + '<div class="wait">画面待接入</div></div>';
    }).join('');
    /* ①（2026-11-10 圈图）：格子里的「渲染色 · 非现场实拍」文案撤下屏——口径不丢，
       已在每格的 aria-label 里（「当前画面是孪生场景按该点位坐标渲的色，非现场实拍；视频通道二期接入」）。
       ④（同日）：单路画面不再挤在 2 列网格的半列里——列数/行数随路数走，一格就占满整行。 */
    el.style.gridTemplateColumns = cams.length === 1 ? '1fr' : '1fr 1fr';
    el.style.gridTemplateRows = 'repeat(' + Math.max(1, Math.ceil(cams.length / 2)) + ',minmax(0,1fr))';
    var c = $('#cctvCnt'); if (c) c.textContent = cams.length + ' 路 · ' + cams.map(function (n) { return n.roomId; }).join('/');
    camList = cams.slice(0, 4);
    sendScene('feeds', { cams: camList.map(function (n) { return { id: n.id, roomId: n.roomId, position: n.position }; }) });
    if (!camPull) camPull = setInterval(pullCamFeeds, 460);
    pullCamFeeds();
  }
  /* 把场景离屏渲好的 strip 裁进四个格子。取不到（场景没渲/跨帧竞态）就保持「画面待接入」，
     不画半张图糊在格子上。 */
  function pullCamFeeds() {
    var strip = null;
    try { strip = scene.contentWindow && scene.contentWindow.document.getElementById('feedStrip'); } catch (e) { return; }
    if (!strip || !strip.width) return;
    document.querySelectorAll('#camGrid .cam-tile').forEach(function (tile, i) {
      var cv = tile.querySelector('canvas'); if (!cv) return;
      var ctx = cv.getContext('2d'); if (!ctx) return;
      try {
        ctx.drawImage(strip, i * 320, 0, 320, 180, 0, 0, cv.width, cv.height);
        var w = tile.querySelector('.wait'); if (w) w.remove();
      } catch (e) { /* 场景还没渲出来：留着"画面待接入" */ }
    });
  }

  function renderAgv() {
    var el = $('#agvList'); if (!el) return;
    el.innerHTML = robots.map(function (r) {
      var bat = Math.round(r.battery == null ? 0 : r.battery);
      var charging = !!r.parked || r.action === 'charging';
      var st = r.parked ? '停靠充电' : (r.action === 'charging' ? '充电中' : r.action === 'moving' ? '行进中' : '待机');
      var low = bat <= 20 && !charging;
      var cls = (charging ? 'charge' : (r.action === 'moving' ? 'moving' : '')) + (low ? ' low' : '');
      var what = r.parked ? ('停靠 ' + (r.chargingBay || '102-05') + ' 充电位 · 回升中')
        : ((r.currentFlowName || '无在制任务') + (r.taskElapsedMin != null ? ' 已 ' + r.taskElapsedMin + 'min' : ''));
      return '<div class="agv-row ' + cls + '" data-robot="' + r.robotId + '" tabindex="0" role="button"'
        + ' aria-label="' + escapeHtml(r.robotId + ' ' + st + '，' + what + '，电量 ' + bat + '%' + (low ? '（低电）' : '')) + '">'
        + '<i class="dot"></i><span class="id">' + r.robotId + '</span>'
        + '<span class="st">' + escapeHtml(st + ' · ' + what) + '</span>'
        + '<span class="bat"><i class="agv-barrow"><i style="width:' + bat + '%"></i></i><b class="pct">' + bat + '%</b></span></div>';
    }).join('');
    var c = $('#agvCnt');
    if (c) c.textContent = robots.length + ' 台 · 在跑 ' + robots.filter(function (r) { return !r.parked; }).length
      + ' · 充电 ' + robots.filter(function (r) { return r.parked; }).length;
  }

  /* 节点类型 icon：场景行要读的是"这个场景靠哪几类点位跑"，所以画类型不画编号
     （编号在组态物联列表与场景节点层里都有）。图形全部 currentColor，跟随 ink 层级。 */
  var NODE_ICON = {
    temperature: '<path d="M6 2a1.5 1.5 0 0 1 3 0v6.2a3 3 0 1 1-3 0z"/><path d="M7.5 11.5a1.5 1.5 0 1 0 0 .01"/>',
    smoke: '<path d="M4 10a4 4 0 0 1 8 0z"/><path d="M8 6V3"/><path d="M5.5 13h5"/>',
    gas: '<path d="M8 2c2 3 3.5 4.2 3.5 6.5a3.5 3.5 0 0 1-7 0C4.5 6.2 6 5 8 2z"/>',
    water: '<path d="M3 11h10"/><path d="M5 13.5h8"/><path d="M8 2c1.8 2.6 3 3.8 3 5.6A3 3 0 0 1 5 7.6C5 5.8 6.2 4.6 8 2z"/>',
    motion: '<circle cx="8" cy="4" r="1.8"/><path d="M4.5 13.5 6 9l2 1.5V13.5"/><path d="M9.5 10.5 11.5 9"/>',
    switch: '<circle cx="8" cy="4.5" r="1.6"/><circle cx="8" cy="11.5" r="1.6"/><path d="M8 6.1v3.8"/>',
    camera: '<rect x="2.5" y="5" width="8" height="6" rx="1.2"/><path d="M10.5 7.5 13.5 6v6l-3-1.5z"/>',
    light: '<path d="M8 2.5a3.5 3.5 0 0 1 2 6.3V11H6V8.8a3.5 3.5 0 0 1 2-6.3z"/><path d="M6.5 13h3"/>'
  };
  function nodeIcon(t) {
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + (NODE_ICON[t] || NODE_ICON.switch) + '</svg>';
  }

  /* 安全管家场景行：名称 + 标签 + 状态徽标 + 节点 icon 串 + 房间号。
     状态来自 mock 现算（未闭环告警归属 / 点位阈值），行内把"为什么是红的"的条数一起带出来，
     屏上可自证；点位没补齐的场景（如工器具微动开关）标 pending，不谎称已在跑。 */
  function renderScenes() {
    var el = $('#dkScenesGrid'); if (!el) return;
    var list = (safety && safety.scenes) || [];
    if (scRoom) list = list.filter(function (x) { return String(x.roomId) === String(scRoom); });
    /* ③（2026-11-10 圈图）：场景块占满分给它的高度——行数跟着场景数走（2 列 × ceil(n/2) 行），
       106 只有 1 套场景时不再让六格网格把内容挤成一小坨。 */
    el.style.gridTemplateRows = 'repeat(' + Math.max(1, Math.ceil(list.length / 2)) + ',minmax(0,1fr))';
    /* 场景状态 = 两半事实拼起来：所在房间未闭环告警（mock 给）+ 所辖点位当前读数越限（宿主 envNodes 给，
       与右列组态物联、场景节点层同一份读数，不另建第二套真相）。阈值取场景方案文档里的规则原值：
       温度 >28℃、湿度 >70%RH、气体 exceeded、烟感/水浸 detected。 */
    var byId = {}; (envNodes || []).forEach(function (n) { byId[n.id] = n; });
    scView = [];
    list = list.map(function (x) {
      var breach = [];
      (x.nodes || []).forEach(function (nd) {
        var n = byId[nd.id], v = (n && n.values) || {};
        if (nd.type === 'gas' && v.exceeded === true) breach.push('可燃气体超限');
        if (nd.type === 'smoke' && v.detected === true) breach.push('烟感报警');
        if (nd.type === 'water' && v.detected === true) breach.push('检测到浸水');
        if (nd.type === 'temperature' && v.temperature > 28) breach.push('温度 ' + v.temperature + '℃>28℃');
        if (nd.type === 'temperature' && v.humidity > 70) breach.push('湿度 ' + v.humidity + '%RH>70%');
      });
      var st = x.openAlarms ? 'alarm' : (breach.length ? 'abnormal' : 'normal');
      var c = Object.create(x);
      c.status = st; c.breach = breach;
      c.statusLabel = ((safety && safety.statusLabels) || {})[st] || st;
      return c;
    });
    var sig = list.map(function (x) { return x.sceneId + ':' + x.status + ':' + x.openAlarms + ':' + (x.breach || []).join('/'); }).join(',');
    /* scView 必须在提前 return 之前落定：它是点击处理（dockLocateScene）唯一的依据。
       上一版把它写在 return 之后，于是第一次心跳之后签名不再变化 → 直接 return → scView 永远是空数组
       → 点场景行毫无反应、body[data-last-scene] 也不写，屏上那句「回车定位」成了空承诺。 */
    scView = list;
    if (sig && sig === scSig) return;          /* 内容没变就不重建轨道（重建会把无缝滚动弹回顶部，见 FR-30b） */
    scSig = sig;
    document.body.dataset.sceneCount = String(list.length);
    var html = list.map(function (x) {
      /* 没有点位就直说"待布点"，不去借别的房间的节点凑一张 icon 串——
         场景已配置但点位没到位，本身就是现场要推进的事，屏上藏起来等于替现场撒了谎。 */
      var icons = (x.nodes || []).length
        ? (x.nodes || []).map(function (n) { return nodeIcon(n.type); }).join('')
        : '<span class="pend">待布点</span>';
      var aria = x.sceneId + ' ' + x.name + '，' + x.tag + '，' + x.statusLabel
        + (x.openAlarms ? '（本区未闭环告警 ' + x.openAlarms + ' 条）' : '')
        + ((x.breach || []).length ? '（越限：' + x.breach.join('、') + '）' : '')
        + '，位于 ' + x.roomId + ' 区，节点 ' + ((x.nodes || []).length ? (x.nodes || []).map(function (n) { return NODE_CN(n.type); }).join('/') : '待布点')
        + '，核心规则 ' + x.rule + (x.pending ? '。' + x.pending : '');
      return '<div class="sc-row' + (x.pending ? ' pending' : '') + ' ' + x.status + '" role="listitem" data-scene="' + x.sceneId + '"'
        + ' data-room="' + x.roomId + '" data-nodes="' + escapeHtml((x.nodes || []).map(function (n) { return n.id; }).join(',')) + '"'
        + ' tabindex="0" aria-label="' + escapeHtml(aria) + '">'
        + '<span class="nm">' + escapeHtml(x.name) + '</span>'
        + '<span class="meta"><span class="nodes">' + icons + '<span class="rm">' + x.roomId + '</span></span>'
        + '<span class="st ' + x.status + '"><i></i>' + escapeHtml(x.statusLabel) + (x.openAlarms ? ' ' + x.openAlarms : '') + '</span></span></div>';
    }).join('');
    el.innerHTML = html;   /* 固定六格，不再走 dkTrack：没有滚动就没有回声副本，也就没有"同一场景被念两遍"的问题 */
    keyable(el);
    var c = $('#scCnt');
    if (c) c.textContent = '已部署 ' + list.length + ' 套 · 告警 ' + list.filter(function (x) { return x.status === 'alarm'; }).length
      + ' · 异常 ' + list.filter(function (x) { return x.status === 'abnormal'; }).length;
  }

  /* 点场景行：把该场景所辖节点在场景里点选出来（复用物联节点那套 select-node 通道），
     并说一句这个场景的核心规则——屏上不常驻，只在提示里出现一次。 */
  function dockLocateScene(sceneId) {
    var x = (scView || []).filter(function (y) { return y.sceneId === sceneId; })[0];   /* 读算好的那份，不读原始表 */
    if (!x) return;
    var first = (x.nodes || [])[0];
    if (first) dockSelectNode(first.id);
    document.body.dataset.lastScene = sceneId;
    sceneTip(x);   /* 气泡改到「安全管家场景监测」块正上方（产品负责人：弹窗要在图表附近，别跑画面中间） */
  }

  /* 「流程配置 N 条 · 循环同步：xxxxx」不再上屏（2026-11-08 圈图），但口径必须还有人能看到：
     写进块级 aria-label，读屏与 QA 都取得到。函数只此一处，两处心跳路径共用，
     避免出现"元素删了、写入点还在"那种静默断链。 */
  function queueAria(qt) {
    var blk = $('#dkQueue'); if (!blk) return;
    var live = queueData && queueData.liveStep;
    var sync = live && live.flowCode ? '，循环同步 ' + live.flowCode
      : (live && live.kind === 'pickup' ? '，循环同步 样品室取样' : (live && live.kind === 'return' ? '，循环同步 返航' : ''));
    blk.setAttribute('aria-label', '无人化调度任务：流程配置 ' + (qt ? qt.length : 0) + ' 条' + sync
      + '，按进行中 / 未派单 / 已完成三列');
  }

  /* 场景说明气泡：锚在场景监测块上方，内容含 名称/标签/状态/所在房间/节点类型/核心规则/动作，
     待布点与越限也如实带出来。6s 自动收，点别处即换。 */
  function sceneTip(x) {
    var blk = $('#dkScenes'); if (!blk) { flashHint(x.name); return; }
    var tip = document.getElementById('scTip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'scTip'; tip.className = 'sc-tip'; document.body.appendChild(tip); }
    tip.innerHTML = '<div class="st-h"><b>' + esc0(x.name) + '</b><span class="st-t">' + esc0(x.tag) + '</span>'
      + '<span class="st-s ' + x.status + '">' + esc0(x.statusLabel) + (x.openAlarms ? ' ' + x.openAlarms : '') + '</span></div>'
      + '<div class="st-r">位于 ' + esc0(x.roomId) + ' 区 · 节点 '
      + esc0((x.nodes || []).length ? (x.nodes || []).map(function (n) { return NODE_CN(n.type); }).join('/') : '待布点') + '</div>'
      + '<div class="st-r">核心规则：' + esc0(x.rule) + '</div>'
      + '<div class="st-a">动作：' + esc0(x.actions || '—') + '</div>'
      + ((x.breach || []).length ? '<div class="st-b">越限：' + esc0(x.breach.join('、')) + '</div>' : '')
      + (x.pending ? '<div class="st-p">' + esc0(x.pending) + '</div>' : '');
    var r = blk.getBoundingClientRect();
    tip.style.left = Math.round(r.left) + 'px';
    tip.style.bottom = Math.round(window.innerHeight - r.top + 10) + 'px';
    tip.hidden = false;
    clearTimeout(tip.__t); tip.__t = setTimeout(function () { tip.hidden = true; }, 6000);
  }
  function esc0(v) { return escapeHtml(v == null ? '' : String(v)); }

  /* 左栏两块（FR-80 接管的左区）：① 口径四格 ② 本房间设备/资产 + 机器人。
     口径优先级：任务统计 → 检测项目数 → 样品台账 → 明说本区无口径（不摆四个 0 冒充数据）。
     样品台账是 102 智能样品室唯一的存量/收样/还样落点——面板退役时如果只搬"任务/检测项目"，
     整个样品室就什么都不剩了，所以这里补上第三档口径与按名称分布。 */
  function renderZoneRail() {
    if (st.mode !== 'ZONE') { zvrSig.stat = zvrSig.dev = ''; return; }
    var z = st.zone, g = $('#zsGrid');
    var sk = z + '/' + st.period;
    if (g && zvrSig.stat !== sk) {
      zvrSig.stat = sk;
      TwinApi.get('/api/zone/' + z + '/task-stats').then(function (r) {
        if (zvrSig.stat !== sk) return;                        /* 房间切得快时旧响应不许覆盖新房间 */
        var d = (r && r.data) || {}, per = (d.periods || {})[st.period] || d;
        var ti2 = (d.testItems || {})[st.period], sp = d.samples || null;
        var bl = zoneBlocks(z);
        var hasTask = bl.indexOf('task-stats') >= 0 && !!(per && (per.done != null || per.running != null));
        var hasItems = !hasTask && bl.indexOf('test-items') >= 0 && !!ti2;
        var hasSamples = !hasTask && !hasItems && bl.indexOf('samples') >= 0 && !!sp;
        var cells = hasTask ? [['已完成', per.done], ['执行中', per.running], ['异常挂起', per.abnormal], ['排队', per.queued]]
          : hasItems ? [['检测中', ti2.testing], ['待检测', ti2.pending], ['已完成', ti2.done], ['逾期未出', ti2.overdue]]
          : hasSamples ? [['在库存量(支)', sp.stored], ['今日收样', sp.receivedToday], ['今日还样', sp.returnedToday], ['待还样', sp.pendingReturn]] : null;
        var head = hasTask ? '任务统计' : hasItems ? '检测项目数统计' : hasSamples ? '样品台账' : '';
        var tt = document.querySelector('#railZoneStats .rp-head b');
        var perBtn = document.querySelector('#railZoneStats .period');
        if (!cells) { zvrSig.stat = ''; g.dataset.kind = '';
          g.innerHTML = '<div class="zs-i"><span>该区无任务与检测项目口径' + (bl.indexOf('env') >= 0 ? '，环境数据见右列' : '') + '</span></div>';
          if (tt) tt.textContent = '任务统计';
          /* 本区没有任何按周期变的口径（101 接待厅、104 控制室）→ 日/月/年开关必须消失。
             留着它，客户点了高亮换了、数字一个都不动——摆着切不动的控件比没有控件更糟。 */
          if (perBtn) perBtn.hidden = true; return; }
        if (perBtn) perBtn.hidden = false;
        if (tt) tt.textContent = head;
        /* ①（2026-11-09 10 点清单）：106 任务统计升级为三子区域——委托任务/样品/试验项目，
           口径由 mock 从 entrust-list 推导（本房间设备→已完成检测·正在检测的试验项→去重委托/样品），
           四格周期数不再出现：产品负责人说「不摆总数当结论」，试验项目就分开给两个数。 */
        if (hasTask && d.room) {
          var rm = d.room;
          /* ⑥（2026-11-10 圈图，参考图二）：任务统计改「指标组」样式——标题左/大数右/分段条在下/一行短语口径。
             日月年切换回到标题行：它不驱动三子区域（当前态口径，跟着周期动就是编数），
             驱动底部「本周期」行——task-stats periods 的真数（已完成/执行中/异常挂起/排队），
             开关有真活干，不是切了不动的死控件。 */
          var pv = ((d.periods || {})[st.period]) || {};
          var seg = function (w, tok) { return '<i style="width:' + (w > 0 ? w.toFixed(2) : 0) + '%;background:var(' + tok + ')"></i>'; };
          var tiSum = Math.max(1, rm.items.done + rm.items.testing);
          g.innerHTML = '<div class="zs2">'
            + '<div class="zs2-g"><div class="zs2-h"><span>委托任务</span><b style="color:var(--tw-st-working)">' + rm.entrusts + '</b></div>'
            + '<i class="zs2-bar">' + seg(100, '--tw-st-working') + '</i><div class="zs2-d">关联委托单 · 去重</div></div>'
            + '<div class="zs2-g"><div class="zs2-h"><span>样品</span><b style="color:var(--tw-st-cat)">' + rm.samples + '</b></div>'
            + '<i class="zs2-bar">' + seg(100, '--tw-st-cat') + '</i><div class="zs2-d">关联样品 · 去重（非收样/还样口径）</div></div>'
            + '<div class="zs2-g"><div class="zs2-h"><span>试验项目</span><b><span style="color:var(--tw-st-ready)">' + rm.items.done + '</span><em>+</em><span style="color:var(--tw-st-working)">' + rm.items.testing + '</span></b></div>'
            + '<i class="zs2-bar">' + seg(rm.items.done / tiSum * 100, '--tw-st-ready') + seg(rm.items.testing / tiSum * 100, '--tw-st-working') + '</i><div class="zs2-d">已完成 ＋ 正在检测 · 不给总数</div></div>'
            + '<div class="zs2-p" role="status">本' + ({ day: '日', month: '月', year: '年' })[st.period] + '：已完成 <b style="color:var(--tw-st-ready)">' + (pv.done == null ? '—' : pv.done) + '</b>'
            + ' · 执行中 <b style="color:var(--tw-st-working)">' + (pv.running == null ? '—' : pv.running) + '</b>'
            + ' · 异常挂起 <b style="color:var(--tw-st-alarm)">' + (pv.abnormal == null ? '—' : pv.abnormal) + '</b>'
            + ' · 排队 <b style="color:var(--tw-st-idle)">' + (pv.queued == null ? '—' : pv.queued) + '</b></div>'
            + '</div>';
          if (perBtn) perBtn.hidden = false;
          g.dataset.kind = head;
          g.setAttribute('aria-label', z + ' 区任务统计（本房间口径）：关联委托 ' + rm.entrusts + ' 个，关联样品 ' + rm.samples
            + ' 批，试验项目 已完成 ' + rm.items.done + ' 正在检测 ' + rm.items.testing
            + '；本周期 已完成 ' + pv.done + ' 执行中 ' + pv.running + ' 异常挂起 ' + pv.abnormal + ' 排队 ' + pv.queued);
          return;
        }
        g.innerHTML = cells.map(function (x) {
          return '<div class="zs-i"><b>' + (x[1] == null ? '—' : x[1]) + '</b><span>' + x[0] + '</span></div>';
        }).join('') + (hasSamples ? sampleSpread(sp) : '');
        g.dataset.kind = head;
        g.setAttribute('aria-label', z + ' 区' + head + '（' + ({ day: '本日', month: '本月', year: '本年' })[st.period] + '）：'
          + cells.map(function (x) { return x[0] + ' ' + (x[1] == null ? '无' : x[1]); }).join('，'));
      }).catch(function () { zvrSig.stat = ''; });
    }
    /* 设备/资产行把面板里那三样用户点名要过的东西一起搬过来：
       ① 编号 + 名称 +「型号」（售前一问「YM-WRH-04 是什么」就不能再让人翻台账）
       ② 有未解除告警的排前面（这块的主要用途就是异常定位）
       ③ 本房间拥有的复合机器人与电量——下钻时左栏 .raildev 是隐藏的，这里是唯一的机器人落点 */
    var li = $('#zDevsList'), pool = zoneDevices(z);
    var rb = robots.filter(function (r) { return String(r.modelRoot || '').slice(0, 3) === String(z); });
    var bad = {}; (zalarms || []).forEach(function (a) { if (a.status !== 'resolved' && a.deviceId) bad[a.deviceId] = 1; });
    var devSig = z + '#' + pool.map(function (d) { return d.deviceId + d.status; }).join('|')
      + '#' + rb.map(function (r) { return r.robotId + r.taskElapsedMin + Math.round(r.battery); }).join('|')
      + '#' + Object.keys(bad).join(',');
    if (li && zvrSig.dev !== devSig) {
      zvrSig.dev = devSig;
      var t = $('#zDevsTitle'), n = $('#zDevsN');
      if (t) t.textContent = zoneHasAssets(z) ? '资产' : '设备';
      if (n) n.textContent = pool.length + ' 台建档' + (rb.length ? ' · ' + rb.length + ' 台机器人' : '');
      var rows = pool.slice().sort(function (a, b) { return (bad[b.deviceId] ? 1 : 0) - (bad[a.deviceId] ? 1 : 0); }).map(function (d) {
        var cls = bad[d.deviceId] ? 'alarm' : (d.status || '');
        return '<div class="zd-row' + (d.asset ? ' as' : ' ' + cls) + '" data-cad="' + esc0((d.modelNode || '').replace('cad:', ''))
          + '" data-dev="' + esc0(d.deviceId || d.code) + '" tabindex="0" role="button"'
          + ' aria-label="' + esc0((d.code || '') + ' ' + (d.name || '') + (d.model ? ' ' + d.model : '') + '，'
            + (d.asset ? d.subZone : ST_CN(cls)) + '，回车查看详情') + '">'
          + '<i class="dot"></i><b>' + esc0(d.code || '') + '</b><span>' + esc0(d.name || '')
          + (d.model ? '<em class="mdl">' + esc0(d.model) + '</em>' : '') + '</span>'
          + '<em>' + esc0(d.asset ? d.subZone : ST_CN(cls)) + '</em></div>';
      }).join('');
      var rrows = rb.map(function (r) {
        var stall = (r.taskElapsedMin != null && r.stallLimitMin != null && r.taskElapsedMin > r.stallLimitMin && r.action !== 'charging' && !r.parked);
        var stt = stall ? '超节拍' : r.parked ? '停靠充电' : r.action === 'charging' ? '充电中' : r.action === 'moving' ? '行进中' : '待机';
        var sub = r.parked ? '停靠 ' + (r.chargingBay || '充电位') + ' 充电位' : (r.currentFlowName || '无在制任务');
        return '<div class="zd-row ' + (stall ? 'alarm' : 'working') + '" data-robot="' + esc0(r.robotId) + '" tabindex="0" role="button"'
          + ' aria-label="' + esc0(r.robotId + ' 复合机器人，' + stt + '，' + sub + '，电量 ' + Math.round(r.battery) + '%，回车查看详情') + '">'
          + '<i class="dot"></i><b>' + esc0(r.robotId) + '</b><span>复合机器人<em class="mdl">' + esc0(sub) + '</em></span>'
          + '<em>' + esc0(stt) + ' 🔋' + Math.round(r.battery) + '%</em></div>';
      }).join('');
      li.innerHTML = (rows + rrows) || '<div class="zd-row"><span>该区无建档设备</span></div>';
      keyable(li);
    }
  }

  /* 底栏「运行中的任务」：非无人化房间用；106 用无人化调度任务，两者不同时出现，
     否则同一批任务在底栏出现两遍。 */
  function renderZoneRunning() {
    var tr = $('#dkRunningTrack'); if (!tr) return;
    if (st.mode !== 'ZONE') {                              /* 总览没有这块：内容与计数一起清 */
      tr.innerHTML = ''; zvrSig.run = '';
      var nr = $('#dkRunningN'); if (nr) nr.textContent = '—'; return; }
    /* 数据改读 /api/zone/:z/running-tasks（zrunning）而不是自己从全场 tasks 里凑：
       面板那份口径带了来源（调度/数采）、超时判定、样品号与计划时长，
       其中「已用 > 计划 = 超时」是 Q4「机器人是不是卡住了」唯一的承载点——
       接管时若只留名称+进度，这条叙事就整条丢了。 */
    var rows = zrunning || [];
    /* 签名必须带房间号：不带的话，"上一个房间为空 → 本房间也为空"会被判成没变化，
       于是空态渲不出来、块头的「N 条在制」还留着上一个房间的数字（实测 102 挂着 107 的 4 条）。 */
    var sig = st.zone + '#' + rows.map(function (t) { return (t.taskId || t.name) + '/' + (t.percent || '') + '/' + (t.elapsedMin || ''); }).join('|');
    if (zvrSig.run === sig) return;
    zvrSig.run = sig;
    var n0 = $('#dkRunningN');
    if (!rows.length) {
      tr.innerHTML = '<div class="ti-row empty"><span class="nm">该区当前无在制任务</span></div>';
      if (n0) n0.textContent = '空闲';
      return;
    }
    var html = rows.map(function (t) {
      var over = !!(t.plannedMin && t.elapsedMin > t.plannedMin);
      var lb = (t.kind === 'dispatch' ? '调度' : '数采') + ' ' + t.name + '，' + (t.deviceCode || '无工位')
        + (t.robotId ? ' · ' + t.robotId : '') + '，' + (t.stage || '')
        + (t.sampleId ? '，样品 ' + t.sampleId : '')
        + (t.elapsedMin != null ? '，已 ' + t.elapsedMin + ' 分钟' + (t.plannedMin ? '（计划 ' + t.plannedMin + '）' : '') : '')
        + (over ? '，已超时' : '') + (t.percent != null ? '，进度 ' + t.percent + '%' : '') + '，回车定位工位';
      return '<div class="ti-row running' + (over ? ' over' : '') + '" tabindex="0" role="button"'
        + ' data-dev="' + esc0(t.deviceCode || '') + '" aria-label="' + esc0(lb) + '">'
        + '<i class="ti-dot"></i><span class="tag ' + (t.kind === 'dispatch' ? 'dis' : 'daq') + '">'
        + (t.kind === 'dispatch' ? '调度' : '数采') + '</span><span class="nm">' + esc0(t.name) + '</span>'
        + (over ? '<span class="tag stall">超时</span>' : '')
        + '<span class="dv">' + esc0(t.deviceCode || '—') + (t.robotId ? ' · ' + t.robotId : '') + '</span>'
        + '<span class="tm">' + (t.percent != null ? t.percent + '%' : (t.elapsedMin != null ? '已 ' + t.elapsedMin + 'min' : '—')) + '</span></div>';
    }).join('');
    dkTrack('#dkRunningTrack', html, rows.length);
    var n = $('#dkRunningN'); if (n) n.textContent = rows.length + ' 条在制';
    keyable(tr);
  }

  /* 底栏「安全管家场景监测」按房间过滤：这个房间没部署场景就整块不显示（空块比没有块更糟）。 */
  function renderZoneScenes() {
    var blk = $('#dkScenes'); if (!blk) return;
    if (st.mode !== 'ZONE') { blk.hidden = false; scRoom = null; }
    else { scRoom = st.zone; }
    var mine = ((safety && safety.scenes) || []).filter(function (x) { return !scRoom || String(x.roomId) === String(scRoom); });
    blk.hidden = mine.length === 0;
    renderScenes();
  }

  function renderDock() {
    /* ① 设备信息统计：状态分布 + 稼动率（在测/建档，现算不写死） */

    /* ② 调度任务队列（FR-42）：进行中 / 未派单 / 已完成 改成三列并排。
       状态已经是「列」，所以行内不再重复写状态字（只有 AGV 正在办的那道标「循环中」）。 */
    var qt = (queueData && queueData.tasks) || [];
    var groups = [['running', '进行中'], ['unassigned', '未派单'], ['done', '已完成']];
    groups.forEach(function (g) {
      var rows = qt.filter(function (t) { return t.shown === g[0]; });
      var n = document.getElementById('dqN' + g[0].charAt(0).toUpperCase() + g[0].slice(1));
      if (n) n.textContent = rows.length;
      dkTrack('#dqTrack' + g[0].charAt(0).toUpperCase() + g[0].slice(1), rows.map(function (t) {
        return '<div class="dq-row ' + g[0] + '" data-seq="' + t.seq + '" data-cad="' + (t.cad || '') + '" data-flow="' + t.flowCode + '" tabindex="0" role="button" aria-label="' + escapeHtml(t.flowCode + ' ' + t.flowName + '，' + g[1] + '，回车定位工位') + '">' +
          '<i class="dq-dot"></i><span class="nm">' + escapeHtml(t.flowCode + ' ' + t.flowName) + '</span>' +
          '<span class="st">' + (t.live ? '循环中' : '') + '</span>' +
          '<span class="tm">' + (g[0] === 'running' && t.elapsedMin ? '已 ' + t.elapsedMin + '/' + t.plannedMin + 'min' : (t.time || '—')) + '</span></div>';
      }).join(''), rows.length);
    });
    queueAria(qt);
    dqSig = qt.map(function (t) { return t.seq + ':' + t.shown; }).join(',');   /* 列归属指纹：只有换列才重建 */

    /* ③ 安全管家场景监测（2026-11-08 替换原「试验项完成情况」；委托单试验项接口仍在契约里，只是不再上屏——
       试验项目的数在左栏「试验项目」组与 106 区域面板里都有，同一批数字不在屏上写两遍） */
    renderScenes();

    /* ④ 组态物联节点：按房间排序滚动（101→110），读数用 nodeReading 唯一口径 */
    /* 区域视图：物联列表只列本房间的点位（FR-80 第 5 条），与总览的全量列表口径不同 */
    var ns = (envNodes || []).filter(function (n) { return st.mode !== 'ZONE' || String(n.roomId) === String(st.zone); }).slice().sort(function (a, b) {
      return String(a.roomId).localeCompare(String(b.roomId)) || String(a.name).localeCompare(String(b.name), 'zh');
    });
    var zn = {}; (zones || []).forEach(function (z) { zn[z.zoneId.slice(2)] = z.name; });
    var nhtml = ns.map(function (n) {
      var cam = n.type === 'camera';
      return '<div class="nd-row ' + (cam ? 'cam' : '') + '" data-node="' + n.id + '" tabindex="0" role="button" aria-label="' + escapeHtml(n.name + '，' + n.roomId + ' ' + (zn[n.roomId] || '') + '，回车查看节点详情') + '">' +
        '<i class="nd-dot"></i><span class="rm">' + n.roomId + '</span><span class="nm">' + escapeHtml(n.name) + '</span>' +
        '<span class="ti">' + NODE_CN(n.type) + '</span><span class="rd">' + nodeReading(n) + '</span>' +
        '<span class="ti">' + new Date(n.updatedAt).toLocaleTimeString('zh-CN', { hour12: false }) + '</span></div>';
    }).join('');
    $('#dkNodesCnt').textContent = '';   /* 「16 个点位 · 按房间排序 · 5s 心跳」按 2026-11-07 反馈撤掉：面板已经说明了自己是什么，这行只是重复 */
    dkTrack('#dkNodesTrack', nhtml, ns.length);
    /* 底栏可见性由 applyAll 里的 viewProfile 决定；这里只保证「未收起时」渲染完不会被隐藏状态卡住 */
    if (!st.strip && (st.mode === 'S1' || document.body.dataset.zoneDock === '1')) $('#taskStrip').hidden = false;
  }

  function renderCycle(c) {
    if (!c) return;
    /* 2026-11-07 反馈：这块展示「AGV 小机器人正处于的进行中任务」，不再显示 n/17。
       道次也不给 hover（产品负责人 2026-11-07 明确「连 hover 都不想要」）：
       大屏投影上没人悬停，浮层提示只会挡画面。口径没丢——写进 aria-label，读屏与 QA 仍拿得到。 */
    /* 名称一律取自剧本（返航段就用剧本自己写的「返航」），不在宿主里另造一句业务文案 */
    var name = c.flow || c.label || '—';
    var phaseTxt = c.phase === 'dwell' ? '作业中' : '行进中';
    var el = $('#cyNow');
    el.textContent = name;
    el.setAttribute('aria-label', 'AGV 正在执行 ' + name + '，' + phaseTxt + '，第 ' + c.order + '/' + c.total + ' 道，' + c.label);
    el.removeAttribute('title');                    /* 撤干净：不留任何悬停文案 */
    $('#cyLabel').textContent = 'AGV 任务 · ' + phaseTxt;
    $('#cySub').textContent = '@ ' + c.label + ' · 剩余 ' + c.remainingSec + 's' +
      (c.deviceCode ? ' · 服务 ' + c.deviceCode : '') + (c.visits ? ' · 第 ' + c.visit + '/' + c.visits + ' 站' : '');
    var done = (c.order - 1 + (c.phase === 'dwell' ? 0.5 : 0.2)) / c.total;
    $('#cyBar').style.width = Math.round(Math.min(1, done) * 100) + '%';
  }

  /* ---------- 场景状态推送 ---------- */
  function pushState() {
    if (!alarms.length) return;
    var bad = {}; alarms.forEach(function (x) { if (x.status !== 'resolved' && x.deviceId && x.deviceId.indexOf('eq_') === 0) bad[x.deviceId] = 1; });
    toScene('state', {
      robots: robots, routeNote: routeNote, layers: st.layers, quality: st.quality,
      /* 资产不进场景对象表也不进状态表：它们没有设备状态，画成光点会抢走拾取
         （102-05 充电位的光点压在停靠机器人上，点机器人就命中资产点了） */
      deviceStatus: devices.filter(function (d) { return !d.asset; }).reduce(function (m, d) { m[d.modelNode] = bad[d.deviceId] ? 'alarm' : d.status; return m; }, {}),
      walls: walls,
      /* 资产（货架/充电位/电视/支架）不进场景对象表：它们没有设备状态，
         进了就会被当成设备画状态光点——FR-76 把 4 条资产并进全场表后，
         102-05 充电位的光点正好压在停靠的机器人身上，"点机器人"命中资产点、
         出的是设备卡（pickcheck/robotcheck 那两条红的真根因，不是测试停在旧结构）。 */
      objects: (function () {
        var m = devices.filter(function (d) { return !d.asset; }).reduce(function (mm, d) { mm[(d.modelNode || '').replace('cad:', '')] = { code: d.code, name: d.name, type: d.type, subZone: d.subZone, status: bad[d.deviceId] ? 'alarm' : d.status, params: d.keyParams || [] }; return mm; }, {});
        /* 机器人本体（106-08/106-09）也要能在场景里点开：状态用真实 action/parked，别让它退化成「无实时数据」 */
        robots.forEach(function (r) { if (!r.modelRoot) return;
          m[r.modelRoot] = { code: r.robotId, name: '复合机器人 ' + r.robotId, type: '移动机器人',
            subZone: r.parked ? '停靠 ' + (r.chargingBay || '充电位') + ' 充电位' : (r.zoneId || '106 无人化电缆试验区'),
            status: r.parked ? 'charging' : (r.action === 'moving' ? 'working' : 'ready'),
            params: [{ name: '电量', value: Math.round(r.battery), unit: '%' }, { name: '当前任务', value: r.currentFlowName || (r.parked ? '不在循环演示' : '—'), unit: '' }] }; });
        return m;
      })()
    });
  }


  addEventListener('resize', function () { syncStreamW(); syncZoneBandTop(); });   /* ②③ 窗口一变：右列宽度跟物联块、底栏顶边跟左栏圆环 */
  /* ⑧（2026-11-09 三次圈图）监控视角开关：按钮在顶栏（图三位），命令进场景层；
     场景层 dataset.cctv 是唯一回显，宿主按钮态在装载与恢复时都跟它对齐。 */
  var cctvOn = false;
  var ctBtn = $('#cctvToggle');
  if (ctBtn) ctBtn.addEventListener('click', function () {
    cctvOn = !cctvOn;
    ctBtn.classList.toggle('on', cctvOn); ctBtn.setAttribute('aria-pressed', cctvOn ? 'true' : 'false');
    if (scene.contentWindow) scene.contentWindow.postMessage({ channel: 'twin-v2', type: 'cctv', on: cctvOn }, location.origin);
  });

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
      if (st.mode === 'ZONE') renderZoneView();
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
    if (d.type === 'hint') { flashHint(d.text); }   /* 场景内点不到的对象（如未建模的台账号）由场景回传说明，屏上不给假动作 */
    if (d.type === 'bridge-ready') {
      bridgeReady = true; sceneReady = true;
      if (pendingState) { sendScene(pendingState.type, pendingState.data); pendingState = null; }
      if (pendingView) { sceneCmd('view', pendingView); pendingView = null; }   /* 首屏机位/URL 恢复的视角补发 */
      pushState(); applyLayers();
    }
    if (d.type === 'device') { /* 场景内已弹出实体信息卡，宿主不再重复开右侧详情 */ }
    if (d.type === 'device-open') openDeviceByCad(d.device);
    if (d.type === 'remote') handleKey(d.key);
    if (d.type === 'route-audit') { routeAudit = d; renderAudit(); renderZoneView(); }
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
  /* ②（2026-11-09 三次圈图）：告警流/监控「还是太宽」——右列宽度与下方「组态物联节点状态监测」块
     保持一致。物联块是底栏全宽网格的 1fr 列（1455×868 下实测 389px），随视口宽变化，
     所以同步的是实测值而不是抄一个常数：只在总览同步（房间视图里物联块不在右列正下方，
     「与下方一致」不成立），底栏收起/隐藏时量到 0 宽就保持上一次值。
     fitOverview/fitDrillRoom 读的是运行时矩形，宽度一变构图自动跟着重解。 */
  function syncStreamW() {
    var root = document.documentElement.style;
    var cur = root.getPropertyValue('--tw-stream-w');
    if (st.mode !== 'S1') {
      /* 房间视图：右列要装下两列带（③），宽度回落到 :root 标定的 430——
         撤掉内联变量即可；带内组态物联块的宽度是列宽的结果，不再反过来定义右列。 */
      if (cur) { root.removeProperty('--tw-stream-w');
        if (scene.contentWindow) scene.contentWindow.postMessage({ channel: 'twin-v2', type: 'camera', action: 'reset' }, location.origin); }
      return;
    }
    var iot = document.querySelector('#iotPanel');
    if (!iot) return;
    var q = iot.getBoundingClientRect();
    if (q.width < 50) return;                        /* 底栏收起时量到 0 宽：保持上一次值 */
    var w = Math.round(q.width) + 'px';
    if (cur !== w) {
      root.setProperty('--tw-stream-w', w);
      /* 右列一变，建模带就变了：iframe 尺寸没变、场景层自己等不到 resize，
         必须主动发 reset 让 fitOverview 按新矩形重解——否则构图停在旧带上。 */
      if (scene.contentWindow) scene.contentWindow.postMessage({ channel: 'twin-v2', type: 'camera', action: 'reset' }, location.origin);
    }
  }
  /* 下钻动效：先让桥接层记录切换前构图，再切视角+分组抬升，最后由桥接层补间推近（不再生硬跳帧） */
  /* 下钻＝纯相机补间：begin 记录旧构图 → 切视角 → drill 平滑回落。
     不再发 focus-scene（分组抬升）：它会给 roomIds 里的每个房间描一圈蓝色轮廓，
     总览传全部房间＝满屏蓝框（2026-11-06 产品负责人反馈，已回退）。 */
  function drillTo(view) {
    toScene('camera', { action: 'begin' });
    sceneCmd('view', { view: view });
    toScene('camera', { action: 'drill' });
  }
  /* ---------- 图型选型（口径写死，避免下轮随手换图型把语义换掉）----------
     环形 = 少数类别的「构成占比」，各类相加必须等于总数；
     柱状 = 同口径下的「量级比较」，类别之间不必相加；
     折线带 = 时序趋势。逾期/临期不进环形：它们是「未完成」的子集，塞进同一个环会重复计数。 */
  /* 左栏不出图（2026-11-07 产品负责人：图表去掉、加宽、缩短、不要滚动条）。
     四张表的数字本来就是精确读数口径，柱状图只是把同一批数字再画一遍，还额外吃掉 4×88px 高度。 */
  var CHART_KIND = {};
  /* ---------- 3D 图表：所有输入都从「表格里已经在用的同一批变量」取，绝不另算一套 ---------- */
  function renderCharts() {
    if (!window.TwinCharts) return;
    if (!chartsBooted) { chartsBooted = true; TwinCharts.boot().then(function (ok) { if (!ok) { flashHint('图表引擎未加载（vendor/g2.min.js），读数仍以表格呈现'); return; } renderCharts(); }); }
    if (!globalThis.G2) return;
    var per = (status && status.panels) || {}, v = function (k) { return per[k] ? per[k].periods[st.period] : null; };
    var e = v('entrust'), sa = v('samples'), ti = v('testItems'), di = v('dispatch');   /* di 仍要算：环比与底栏同步用得上，只是不上左栏 */
    /* 左栏只有 176px 净宽：环形在这里放不下「环 + 指认标签」，实测百分比被裁。
       改用柱状（类别名落在柱底，宽度够用），构成关系靠柱高与表格里已有的百分比读。 */
    /* 左栏四张表：只出数字表，不出图（见上方 CHART_KIND 注释） */
    /* 告警流的分级柱已撤掉（2026-11-07 产品负责人：告警流只要列表）。
       等级信息不丢：每行行首的 A/B/C 徽标 + 头部「今日 N · 未解除 M」仍在。
       省出来的 104px 直接给列表多显示两行——告警是拿来读的，不是拿来比的。 */
    /* 底栏块2 不出图（2026-11-07 决定）：这块的主体是 16 条队列的滚动明细，
       三态计数已经在分组表头（进行中 · 3 / 未派单 · 4 / 已完成 · 9）。
       实测在 172px 高的块里塞 96px 环形会把列表压到只剩 40px，dockcheck 当场报"任务行找不到"——
       清单不该为图让位。环形改放到 102 的样品分布（各类相加=在库存量，且面板有纵向空间）。 */
    /* 底栏块1 的图归 renderDockStats 所有（2026-11-07 改「设备运行状态」四档圆环）。
       这里原来还留着一句旧的「五档柱 + 就绪/停止」——同一个容器、同一个图表名，
       两个主人每拍交替就把它 destroy+重建：画布先清空再画，屏上就是每 2s 闪一下白，
       而且交替的那一瞬间画的还是已被否掉的五档口径。删函数要 grep 调用点，改图型同理。 */
    /* 区面板任务统计 / 检测项目数统计：四格换柱（数字进标签，口径进 title）。
       出不出图跟着 viewProfile.blocks 走——与面板出不出这块同一判据；
       别用 statsKind 字符串硬比（种子里是 'task' / 'testItems'，写成 'tasks' / 'test-items' 就永远不出图，本轮真实踩过）。 */
    /* 区域面板的任务统计柱 / 检测项目数柱 / 样品分布环形随面板一起退役（FR-80）。
       判据是产品负责人 2026-11-08 那句话：左栏四格数字已经把结论说完，柱子在 300px 宽里
       只是把同一件事再画一遍。周期切换与下钻联动的断言因此改读 #zsGrid（屏上真数字），
       不再读隐藏面板里的图表签名——chartcheck 已同步迁移。 */
    /* 温湿度均值折线带的调用点必须留在这里。上一笔删区面板三块图表挂载时，
       我用"删到 drawTH(); 之前"的写法把 drawTH(); 自己一起删了：函数定义还在、它自己的取数回调还在，
       但再没有谁叫它画一次——S1 与区域视图里那条折线带整条不见（chartcheck 8 条 ❌ 同一个根因）。
       本文件里早就写着这条教训「删函数要 grep 调用点，改图型同理」，这次是我自己没执行。 */
    drawTH();
      syncZoneBandTop();
}
  /* 温湿度折线带 = 未来实验室平均温湿度（2026-11-07）：
     取全部温湿度点位的当前均值送进 /api/iot/temp-hum-series?node=lab-avg，
     参与均值的点位 id 一并传过去（数据源由节点层决定，mock 不自己维护第二套点位表）。
     标题画在图内左上角，不再在图下多加一行说明文本。 */
  function drawTH() {
    var thAll = (envNodes || []).filter(function (x) { return x.values && x.values.temperature != null && x.values.humidity != null; });
    /* ⑩（2026-11-09 10 点清单）：房间视图底栏的组态物联块——行已经只列本房间节点，
       图却还挂着「未来实验室平均温湿度（4 点位均值）」：同一块里行是房间口径、图是全场口径，
       两套数并排出现就是口径不一致。现在图跟着行走：本房间点位均值 + 标题带房间号；
       本房间没有温湿度点位就不画全场图顶替（宁可说明，不编数）。 */
    var zoneMode = st.mode === 'ZONE';
    var th = zoneMode ? thAll.filter(function (x) { return String(x.roomId) === String(st.zone); }) : thAll;
    var nid = zoneMode ? 'avg-' + st.zone : 'lab-avg';
    /* 空点位就安静退出，别往 #chartTH 里塞占位 div：G2 的 Chart 构造不清容器，
       首拍 envNodes 未到时塞进去的说明文字会永远和 canvas 并排躺着，tooltip 直接挂不出来
       （chartcheck ④c 两条当场变红——我这次的回归替它把这句话说了）。
       房间视图里这条分支实际不可见：组态物联块只在 106 底栏出现，而 106 有温湿度点位。 */
    if (!th.length) return;
    var sumT = 0, sumH = 0, ids = [];
    th.forEach(function (n) { sumT += n.values.temperature; sumH += n.values.humidity; ids.push(n.id); });
    var avgT = Math.round(sumT / th.length * 10) / 10, avgH = Math.round(sumH / th.length * 10) / 10;
    if (!thSeries || thSeries.nodeId !== nid) {
      if (!thLoading) {
        thLoading = true;
        TwinApi.get('/api/iot/temp-hum-series?node=' + nid + '&temp=' + avgT + '&hum=' + avgH + '&points=16&from=' + ids.join(','))
          .then(function (r) { thSeries = r && r.data ? r.data : null; thLoading = false; drawTH(); })
          .catch(function () { thLoading = false; });
      }
      return;
    }
    var a = thSeries.series.map(function (x) { return x.temperature; }), h = thSeries.series.map(function (x) { return x.humidity; });
    /* x 轴与 tooltip 的时刻：采样是整点粒度（mock 按 hour 生成，末点钉当前实时值），
       所以写 HH:00 而不是假装到分；末点前缀"现在"——它确实是当前均值，不是 15 小时前的历史值。 */
    var thTimes = thSeries.series.map(function (x, i) {
      var lbl = (x.hour < 10 ? '0' : '') + x.hour + ':00';
      /* 房间视图带右列只有 ~200px：末点标签再挂时刻就和图例叠字（16:32 目检抓的）。
         窄列只写「现在」，时刻语义由"近 16 点"标题与总览完整轴承担。 */
      return i === thSeries.series.length - 1 ? (zoneMode ? '现在' : '现在 ' + lbl) : lbl;
    });
    /* 末点钉住当前均值：图上最后一点和右列列表、区域面板的读数不许是两套数 */
    a[a.length - 1] = avgT; h[h.length - 1] = avgH;
    TwinCharts.ribbon($('#chartTH'), 'temp-hum', [
      { name: '温度', unit: '℃', values: a, c: '#2878FF' },
      { name: '湿度', unit: '%RH', values: h, c: '#16A34A' }
    ], { height: 64, times: thTimes, title: (zoneMode ? st.zone + ' 平均温湿度（' : '未来实验室平均温湿度（') + th.length + ' 个点位均值 · 近 ' + a.length + ' 点）' });
  }

  function applyAll() {
    /* 组件1：层级按钮的选中态跟 level 走（不是跟 mode）——只点「区域」没挑房间时，
       「区域」是亮的而画面仍在总览，这正是产品要的表达：意图已选，跳转待房间确认。
       组件2：房间下拉只在 level=zone 时出现；没挑房间时值为空占位。 */
    document.querySelectorAll('.mode.lv').forEach(function (b) {
      var on = b.dataset.level === st.level;
      b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var rw = $('#roomWrap'); if (rw) rw.hidden = st.level !== 'zone';
    if ($('#zoneSel').options.length) $('#zoneSel').value = st.zone || '';
    /* 区域视图=右侧五块面板；浮层（告警卡/机器人卡）与底栏让位，避免同一信息出现两次 */
    /* 下钻画像（seed.overview.zones[].viewProfile）决定左栏/底栏留不留：
       106 是主叙事（机器人还在跑，底栏任务队列必须跟着走）；其他房间只留右侧面板，别把小房间的画面挤没 */
    var vp = st.mode === 'ZONE' ? ((zones.filter(function (x) { return x.zoneId === 'Z-' + st.zone; })[0] || {}).viewProfile || {}) : { rail: true, dock: true, blocks: [] };
    document.body.dataset.zoneRail = vp.rail === true ? '1' : '0';
    /* 106 视图撤掉左侧「运行指标」面板（2026-11-07）：那四组数与右侧区域面板同源重复，
       而 106 的主叙事是三维里的 AGV 与工位，左栏只留「无人化任务」周期指示。
       判据走 viewProfile.metrics，不在 JS 里写死房间号。 */
    document.body.dataset.zoneMetrics = (vp.metrics === false) ? '0' : '1';
    document.body.dataset.zoneDock = (st.mode === 'ZONE' && vp.dock === true) ? '1' : '0';   /* S1 右侧是 296 告警流，不需要按 352 让位 */
    $('.rail').hidden = vp.rail !== true;
    /* 区域视图接管标记（FR-80）：左栏换成「任务统计 + 本房间设备」，右列不再整列让位，区域面板退役。
       是否"无人化区"由 seed 的 viewProfile.unmanned 决定，不在 JS 里写死 106。 */
    var zone = st.mode === 'ZONE';
    document.body.dataset.zoneView = zone ? '1' : '0';
    document.body.dataset.unmanned = (zone && vp.unmanned === true) ? '1' : '0';
    /* ④ 极简房间标记：CSS 据此收起左栏/底栏/右列，右下角只出节点卡 */
    document.body.dataset.zoneSimple = (zone && zoneSimple(st.zone)) ? '1' : '0';
    if ($('#railZoneStats')) $('#railZoneStats').hidden = !zone;
    if ($('#railZoneDevs')) $('#railZoneDevs').hidden = !zone;
    if ($('#dkRunning')) $('#dkRunning').hidden = !(zone && vp.unmanned !== true);
    /* ⑧→③（2026-11-09 四次圈图升级）：无人化房间右下两列带——
       左列＝安全管家场景监测（上）＋视觉节点实时画面（下），右列＝组态物联节点状态监测（高块）。
       三块 DOM 迁移（同一份节点，监听/气泡/滚动都跟着走），离开房间视图回总览时各回原位：
       场景监测→底栏最左、画面→右列告警流后、组态物联→底栏最右。 */
    var scEl = $('#dkScenes'), rcEl = $('#rightCol'), dkEl = $('#taskStrip');
    var camEl = $('#cctvBox'), iotEl = $('#iotPanel'), bandEl = $('#zoneBand');
    var zl = bandEl && bandEl.querySelector('.zb-l'), zr = bandEl && bandEl.querySelector('.zb-r');
    if (scEl && rcEl && dkEl && camEl && iotEl && bandEl && zl && zr) {
      var toBand = zone && vp.unmanned === true;
      if (bandEl.hidden === toBand) bandEl.hidden = !toBand;
      function mv(el, host, ref) { if (el.parentElement !== host) (ref ? host.insertBefore(el, ref) : host.appendChild(el)); }
      if (toBand) {
        mv(scEl, zl); mv(camEl, zl);
        /* 场景在上、画面在下：谁先到不重要，落位后把场景提到画面之前 */
        if (camEl.previousElementSibling !== scEl) zl.insertBefore(scEl, camEl);
        mv(iotEl, zr);
      } else {
        mv(scEl, dkEl, $('#dkQueue')); mv(camEl, rcEl, bandEl); mv(iotEl, dkEl);
      }
    }
    renderZoneRail(); renderZoneScenes(); renderZoneRunning(); renderCams();
    if (zone) renderDockStats();   /* ② 圆环进/出房间视图都要按当前口径重画（总览↔房间共用这一个渲染入口） */
    /* renderCams 必须在切房间时跑：它同时决定「视觉节点实时画面」整块要不要出现。
       上一版只在 renderDock 里调，于是 106 切到 107（无摄像头）后画面块还挂着 106 的那一路。 */
    /* 周期切换器随左栏一起交接：左栏在→用左栏那组；左栏隐藏但房间有按周期变的统计块→用面板这组 */
    var pp = document.getElementById('zpPeriod');
    if (pp) {
      var needs = (vp.blocks || []).some(function (k) { return k === 'task-stats' || k === 'test-items'; });
      /* 周期切换器跟着「指标面板实际在哪」走：左栏指标被 metrics:false 撤掉时，它必须搬到面板里，
         否则 106 的任务统计就没人能切本日/本月/本年（判据只认 vp.rail 会漏掉这种情况）。 */
      pp.hidden = !(((vp.rail !== true) || (vp.metrics === false)) && needs);
      document.querySelectorAll('#zpPeriod .seg').forEach(function (b) { b.classList.toggle('active', b.dataset.period === st.period); });
    }
    $('#taskStrip').hidden = (vp.dock !== true) || !!st.strip;
    /* 区域视图不再整列让位（FR-80）：右列就是本房间的告警流 + 组态物联 + 视觉画面，
       区域面板退役后它没有"重复"可言。 */
    $('#rightCol').hidden = false;
    /* 机器人状态条与底部说明条已整体删除（2026-11-06）。
       底栏显隐由上面的 viewProfile 决定（106 保留、其他房间隐藏），这里只处理「收起底栏」按钮本身的状态 */
    /* 详情面板随视图重新停靠：总览时覆盖右侧，区域视图时让位到面板左边，否则会挡住五类信息（实测缺陷） */
    var dEl = $('#detail'); if (dEl && !dEl.hidden) dEl.classList.toggle('docked', st.mode === 'ZONE');

    $('#stripBtn').textContent = st.strip ? '▴ 展开底栏' : '▾ 收起底栏'; $('#stripBtn').setAttribute('aria-pressed', !!st.strip);
    $('#stripBtn').disabled = st.mode !== 'S1';
    /* 右列宽度必须在 drillTo 之前定版：上一版把它排在补间起飞之后，进 106 时带内布局让右列
       从同步值回到标定 430——补间刚起步就被这条宽度变化的 reset 掐死（uxcheck「800ms 只采到 1 个机位」）。
       先定宽、再起跳，宽度变化自身的 reset 只会在没有补间在飞时发生。 */
    syncStreamW();
    syncZoneBandTop();
    drillTo(st.mode === 'ZONE' ? zoneView(st.zone) : 'overall-101');
    renderTables(); renderAlarms(); renderDock(); renderCharts(); pushState(); writeURL();
    syncStreamW();   /* ② 底栏网格刚重排完，右列宽度跟着组态物联块走 */
    syncZoneBandTop();
    if (st.mode === 'ZONE') { loadZone(); renderZoneView(); }
    renderCharts();
  }
  function setStreamFilter(v) {                          /* 右列一个开关，不再三区各一套 */
    if (!v || st.streamFilter === v) return;
    st.streamFilter = v; renderAlarms(); writeURL();
  }

  function setMode(m, zone) {
    st.level = (m === 'ZONE' || zone) ? 'zone' : 'overview';   /* 真正下钻了才算选中「区域」层级 */
    if (m === 'S1') st.zone = null;                            /* 回总览：房间选择复位，下次进「区域」仍是未选中 */
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
    /* 第一项是空占位：默认不选中任何房间（产品负责人：选中「区域」时第二个组件默认不选中） */
    $('#zoneSel').innerHTML = '<option value="">选择房间…</option>' + zones.map(function (z) {
      return '<option value="' + z.zoneId.slice(2) + '"' + (z.detailLevel !== 'device' ? ' data-lite="1"' : '') + '>' + z.zoneId.slice(2) + ' ' + escapeHtml(z.name) + (z.alarmState === 'alarm' ? ' ⚠' : '') + '</option>';
    }).join('');
    $('#zoneSel').value = st.zone || '';
  }

  /* ---------- 键盘可达（2026-11-06 反馈：告警行键盘点不到） ----------
     这些行是「容器 + 事件委托」，没有内联 onclick，所以 js/ui-a11y.js 的 fixClickable 抓不到它们；
     统一由 keyable() 在渲染后补 role/tabindex/aria-label，Enter 与空格触发同一入口（等价于点击）。 */
  var KEYABLE = '[data-alarm], [data-dev], [data-robot], [data-cad], [data-node]';   /* 底栏四块里可点的行：任务/试验项带 data-cad，节点行带 data-node */
  function keyable(root) {
    (root || document).querySelectorAll(KEYABLE).forEach(function (el) {
      if (el.getAttribute('aria-hidden') === 'true') return;   /* 无缝滚动的回声副本：不给它补回可点击语义 */
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
    /* 组件1 的两颗按钮语义不同（2026-11-08 产品负责人：切到「区域」时下方建模先不要变换）：
       「实验室总览」= 真的回总览构图；「区域」= 只把组件2（房间选择）展开，画面保持不动，
       挑了具体房间才跳转。原来这里无差别 setMode(b.dataset.mode)，点「区域」会连带把视图切一次。 */
    document.querySelectorAll('.mode').forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.level === 'zone') {
          /* 「区域」只是展开房间选择，默认必须未选中（产品负责人反复圈过这条）。
             上一版只切 level，没清 zone：从总览点进来时组件2 直接显示着 106，
             看起来就像"切区域自动选中了 106"——而画面其实没跳，两者对不上更迷惑。 */
          st.level = 'zone'; st.zone = null;
          /* 清空房间的同时必须退出「区域视图」：mode=ZONE + zone=null 指的是一个不存在的房间。
             所有按房间取数的链路立刻打成 /api/zone/null/task-stats，mock 报「未知端点」，
             fail() 点亮 #freshTxt 哨兵——focuscheck 整轮就红在这一条上
             （2026-11-08 插桩定位：102 区处理到 102-01 时首次置位，红之前 101 是干净的）。
             这里只改状态、不发相机指令：产品负责人要的是"点区域时画面不动，挑了房间才跳转"。 */
          if (st.mode === 'ZONE') st.mode = 'S1';
          applyAll(); flashHint('请选择房间后再跳转（画面保持当前视角）'); return; }
        setMode(b.dataset.mode);
      };
    });
    /* 组件2 的语义：空值=还没选房间 → 画面不动（回总览构图），选中任意房间才刷新跳转 */
    $('#zoneSel').onchange = function () {
      if (!this.value) { st.level = 'zone'; st.zone = null; setMode('S1'); return; }
      setMode('ZONE', this.value);
    };
    document.querySelectorAll('.seg').forEach(function (b) { b.onclick = function () {
      document.querySelectorAll('.seg').forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active');
      st.period = b.dataset.period;
      /* 区域视图接管后，左栏「任务统计」是新的按周期块：这里漏调它，开关就只是换了个高亮、
         数字一动不动——摆着切不动的控件比没有控件更糟（2026-11-08 实测抓到）。 */
      renderTables(); renderZoneView(); renderCharts(); renderZoneRail(); writeURL();
    }; });
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
    /* 底栏四块的点击/键盘落点（FR-30）：任务行与试验项行定位工位，节点行选中物联节点 */
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      var sf = e.target.closest('[data-sfilter]');      /* 右列与区域面板共用这一个开关 */
      if (sf) { setStreamFilter(sf.dataset.sfilter); return; }
      /* FR-42 把任务队列改成三列（#dqTrackRunning/Unassigned/Done）后，这里还指着已经不存在的
         #dkQueueTrack —— 结果三列任务行全都不响应点击与回车，"定位工位"整条链路静默断掉（dockcheck 抓到）。
         改按容器类匹配，列再多也不怕再漏一列。 */
      /* 区域视图接管后的三个落点（FR-80）。这三行原来全绑在已退役的 #zonePanel 上，
         面板一 hidden，左栏设备行、AGV 行、在制任务行就全成了"看着能点、点了没反应"的死行。
         绑到 document：以后容器改名或加列，不至于再静默断一次（同类事故：#dkQueueTrack）。 */
      var zd = e.target.closest('#zDevsList .zd-row');
      if (zd && (zd.dataset.robot || zd.dataset.dev || zd.dataset.cad)) {
        var rbz = zd.dataset.robot;
        if (rbz) { var rz = robots.filter(function (x) { return x.robotId === rbz; })[0]; if (rz) openRobot(rz); return; }
        var dvc = devices.filter(function (x) { return x.deviceId === zd.dataset.dev || x.code === zd.dataset.dev; })[0];
        if (dvc) selectDevice(dvc, (dvc.modelNode || '').replace('cad:', '') || zd.dataset.cad);
        else flashHint(zd.innerText.replace(/\s+/g, ' ') + '：该条目无台账记录，暂不定位');
        return;
      }
      var ag = e.target.closest('.agv-row[data-robot]');
      if (ag) { var agz = robots.filter(function (x) { return x.robotId === ag.dataset.robot; })[0]; if (agz) openRobot(agz); return; }
      var rn = e.target.closest('#dkRunningTrack .ti-row[data-dev]');
      if (rn && rn.dataset.dev) {
        var dnr = devices.filter(function (x) { return x.code === rn.dataset.dev || x.deviceId === rn.dataset.dev; })[0];
        if (dnr) { selectDevice(dnr, (dnr.modelNode || '').replace('cad:', '')); return; }
        flashHint('工位 ' + rn.dataset.dev + ' 无建档设备，暂不定位');
        return;
      }
      var q = e.target.closest('.dq3 .dq-row');
      if (q) { dockLocate(q.dataset.cad, q.querySelector('.nm').textContent); return; }
      var scEl = e.target.closest('#dkScenesGrid .sc-row');
      if (scEl) { dockLocateScene(scEl.dataset.scene); return; }
      var ndTh = e.target.closest('#dkNodesTrack .nd-row');
      if (ndTh) {
        var ndv = (envNodes || []).filter(function (x) { return x.id === ndTh.dataset.node; })[0];
        /* 折线带现在是全实验室均值，不再跟随单个节点切换（标题写着"平均"，图却跟着点击换点位，那就是撒谎）；
         点行仍然打开该节点的详情卡，读数在卡里看。 */
      }
      var nd = e.target.closest('#dkNodesTrack .nd-row');
      if (nd) { dockSelectNode(nd.dataset.node); }
    });
    $('#alarmStream').addEventListener('click', function (e) {
      var card = e.target.closest('[data-alarm]'); if (!card) return;
      var a0 = alarms.filter(function (x) { return x.alarmId === card.dataset.alarm; })[0];
      if (a0) openAlarm(a0);   /* 单一入口：告警流就是区域视图唯一的告警落点（面板退役后不再有第二处行表） */
    });
  }

  /* 机器人详情（2026-11-06 补：openRobot 此前被切片式删除后仍被调用，点/回车机器人行直接 ReferenceError）
     停靠充电位的机器人要说清「为什么没在跑」，不能报「无在制任务」让人以为它坏了。 */
  function openRobot(r) {
    var stall = (r.taskElapsedMin != null && r.stallLimitMin != null && r.taskElapsedMin > r.stallLimitMin && r.action !== 'charging' && !r.parked);
    var act = r.parked ? ['停靠充电', '#94A3B8'] : r.action === 'charging' ? ['充电中', '#94A3B8'] : r.action === 'moving' ? ['行进中', '#2878FF'] : ['待机', '#64748B'];
    openDetail('<h3>复合机器人 ' + escapeHtml(r.robotId) + '</h3><div class="sub">' + escapeHtml(r.kind || 'composite') + ' · CAD 本体 ' + escapeHtml(r.modelRoot || '—') + '</div>' +
      '<div class="row"><span>状态</span><b class="st" style="background:' + act[1] + '">' + act[0] + (stall ? '（超节拍）' : '') + '</b></div>' +
      '<div class="row"><span>当前调度任务</span><b>' + escapeHtml(r.currentFlowName || '—') + (r.currentTaskId ? '<br>' + escapeHtml(r.currentTaskId) : '') + '</b></div>' +
      '<div class="row"><span>已用 / 节拍上限</span><b>' + (r.taskElapsedMin || 0) + ' / ' + (r.stallLimitMin || '—') + ' min</b></div>' +
      '<div class="row"><span>电量</span><b>' + Math.round(r.battery) + '%' + (r.parked ? '（桩上回升中）' : '') + '</b></div>' +
      (r.parked ? '<div class="row"><span>停靠位置</span><b>' + escapeHtml(r.chargingBay || '充电位') + ' 充电位</b></div>' : '') +
      '<div class="row"><span>允许区域</span><b>' + escapeHtml((r.allowedZones || []).join(' · ')) + '</b></div>' +
      '<div class="row"><span>位置基准</span><b>' + escapeHtml(r.positionBasis || '—') + '</b></div>' +
      '<p style="font-size:11px;color:var(--tw-color-textMuted)">' + escapeHtml(r.routeBasis || '') + '</p>' +
      '<p style="font-size:11px;color:var(--tw-color-textMuted)">演示只跑一台循环机器人（RB-C-02）；' + escapeHtml(r.robotId) + (r.parked ? ' 停在充电位待命。' : ' 为当前在跑的那台。') + ' 孪生只读，不下发控制。</p>');
    if (r.modelRoot) sceneCmd('equipment-highlight', { id: r.modelRoot });
  }

  /* 场景信息卡 →「查看详情与实时参数」的落点（2026-11-06 补：openDeviceByCad 此前被切片删除却仍在调用，
     点这个按钮必抛 ReferenceError）。三条分支：有台账的设备 / 机器人本体 / 未建档实体（诚实降级，不编状态）。 */
  function openDeviceByCad(dev) {
    var id = dev && dev.id; if (!id) return;
    var d = devices.filter(function (x) { return (x.modelNode || '').replace('cad:', '') === id || x.deviceId === id; })[0];
    if (d) { selectDevice(d, (d.modelNode || '').replace('cad:', '')); return; }
    var r = robots.filter(function (x) { return x.modelRoot === id; })[0];
    if (r) { openRobot(r); return; }
    openDetail('<h3>' + escapeHtml(dev.name || id) + '</h3><div class="sub">' + id + ' · ' + id.slice(0, 3) + ' 区</div>' +
      '<div class="row"><span>台账</span><b>待建档</b></div><div class="row"><span>数采</span><b>数采对应</b></div>' +
      '<p style="font-size:11px;color:var(--tw-color-textMuted)">该实体只存在于 CAD（无设备台账号、无数采通道），所以没有实时参数可显示——屏上不编造状态。孪生只读，不下发控制。</p>');
  }

  /* 底栏行 → 场景：定位工位 / 选中节点（都留 body[data-*] 供 QA 断言） */
  function dockLocate(cad, label) {
    if (!cad) { flashHint((label || '该行') + '：尚未绑定 CAD 工位（调度侧未给点位）'); return; }
    sceneCmd('equipment-highlight', { id: cad });
    document.body.dataset.lastHighlight = cad;
    flashHint('已定位 ' + cad + ' · ' + (label || ''));
  }
  function dockSelectNode(id) {
    if (!id) return;
    var n = (envNodes || []).filter(function (x) { return x.id === id; })[0];
    scene.contentWindow.postMessage({ channel: 'room-tour-node-v3', type: 'select-node', id: id }, location.origin);
    document.body.dataset.lastNode = id;
    flashHint('已选中物联节点 ' + (n ? n.name + '（' + n.roomId + ' · ' + nodeReading(n) + '）' : id));
  }

  /* 面板 → 场景 双向拾取（P0-2） */
  function selectDevice(d, cadId) {
    detailDev = d; openDetail(deviceHtml(d)); pollRealtime();
    if (cadId) sceneCmd('equipment-highlight', { id: cadId });   /* 面板→场景：场景描边（决策 Q4 异常定位） */
  }

  var hintTimer = null;
  function flashHint(txt) {
    var el = $('#remoteHint'); if (!el) return;
    var where = (st.mode !== 'ZONE' || !st.zone) ? 'S1 实验室总览' : '区域下钻 · ' + st.zone + ' ' + ((zones.filter(function (z) { return z.zoneId === 'Z-' + st.zone; })[0] || {}).name || '');
    el.textContent = txt || ('翻页 PgUp/PgDn · 1 总览 · 2 无人化区 · F 全屏 · Esc 关闭   ｜   ' + where);
    el.hidden = false; clearTimeout(hintTimer); hintTimer = setTimeout(function () { el.hidden = true; }, 1400);
  }

  function syncLayerMenu() {
    document.querySelectorAll('.lic').forEach(function (b) { b.classList.toggle('on', !!st.layers[b.dataset.layer]); b.setAttribute('aria-pressed', !!st.layers[b.dataset.layer]); });
    syncFs();
    document.querySelectorAll('.seg').forEach(function (b) { b.classList.toggle('active', b.dataset.period === st.period); });
    document.querySelectorAll('[data-sfilter]').forEach(function (b) { b.classList.toggle('active', (st.streamFilter || 'all') === b.dataset.sfilter); });   /* 一个开关，右列与区域面板同步（三区筛选随分区退场） */
  }

  /* ---------- 详情与实时 ---------- */
  function deviceHtml(d) {
    /* 状态色不许在这里抄第四份 hex（FR-35：一个语义一个色，屏上任何角落不许漂移）——全部读 token */
    var stMap = { working: [TOK('--tw-st-working'), '运行'], ready: [TOK('--tw-st-ready'), '就绪'],
      standby: [TOK('--tw-st-standby'), '待机'], stopped: [TOK('--tw-st-stopped'), '停机'], alarm: [TOK('--tw-st-alarm'), '异常'] };
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
      /* 「无实时数据」这个词撤掉：没有实时值时设备就是停机，屏上说状态而不是说我们的接口缺口 */
      var el = $('#rt'); if (!el || !r.data) { if (el) el.innerHTML = '<div class="row"><span>关键参数</span><b>停机 · 暂无参数</b></div>'; return; }
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
