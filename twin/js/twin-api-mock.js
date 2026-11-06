/**
 * 数字孪生 Mock API 层 V1 —— 前端唯一数据入口（不直连三个异构系统）
 * 契约：《数字孪生对象模型与数据字典 V1.md》§2；后端按同路径实现即插即用。
 * 端点：/api/overview/{lab-status|zones|today-tasks|alarms|test-item-plan|alarm-sections}
 *       /api/zone/106/{devices|robots|samples|current-tasks}
 * 只读：无任何写回端点——告警处置由来源系统闭环（PRD-v1 §6 + 决策 Q2）。
 *       /api/zone/{z}/{task-stats|running-tasks|alarms}   ← 区域视图五类信息（环境数据走 V4 节点协议）
 *       /api/alarm/{id}/trace   /api/device/{id}/detail   /api/device/{id}/realtime
 *       ws('/ws/realtime') 事件：tick / task.progress / device.status / robot.action / alarm.update
 * 真实接入：替换本文件为 fetch 实现，路由与事件名不变。
 */
(function (global) {
  var state = null, subs = [], timer = null;
  function now() { return new Date().toISOString(); }
  function envelope(data) { return { code: 0, message: 'ok', data: data, updatedAt: now() }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    return fetch('../api/seed.json').then(function (r) { return r.json(); }).then(function (seed) {
      state = seed;
      (state.zone106.robots || []).forEach(deriveRoute);   /* 线路与时间轴由定位点推导（见 deriveRoute） */
      /* 告警等级不落两份事实源：grade 由 category + alarm-sections 推导（PRD FR-24），
         seed 里保留的 grade 只作交叉校验，不一致时以推导值为准并打标记。 */
      (function deriveGrades() {
        var map = {};
        (state.overview['alarm-sections'] || []).forEach(function (sec) { map[sec.key] = sec.id; });
        (state.overview.alarms || []).forEach(function (a) {
          var g = map[a.category];
          if (!g) { a.gradeError = 'category 不在分区定义内：' + a.category; return; }
          if (a.grade && a.grade !== g) a.gradeError = 'seed 写的 ' + a.grade + ' 与推导 ' + g + ' 不一致';
          a.grade = g;
        });
      })();
      state.overview['lab-status'].updatedAt = now();
      return true;
    });
  }

  function emit(type, payload) { subs.forEach(function (fn) { try { fn({ type: type, payload: payload, at: now() }); } catch (e) { /* 订阅者异常隔离 */ } }); }

  /* ---------- 无人化任务循环剧本（2026-11-06）----------
     时间轴来自 seed：zone106.robots[RB-C-02].demoCycle.stops[{u,travelSec,dwellSec,t0}]，按墙上时钟取模，
     所以刷新页面、多人同时看、挂机演示都处在同一相位；接入调度后由真实任务队列替换本函数即可。 */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* 逾期/临期是「现在时」指标：由在办清单 + LIMS 要求完成时间推导，不随周期变化 */
  function planCounts() {
    var it = (state.testItemPlan || {}).items || [];
    var f = function (st) { return it.filter(function (x) { return x.status === st; }).length; };
    var un = it.filter(function (x) { return x.status !== 'done'; });
    return { testing: f('testing'), pending: f('pending'), done: f('done'),
      overdue: un.filter(function (x) { return x.dueInHours < 0; }).length,
      dueSoon: un.filter(function (x) { return x.dueInHours >= 0 && x.dueInHours <= 72; }).length };
  }
  function withPlanDerive(ls) {
    if (!ls || !ls.panels || !ls.panels.testItems) return ls;
    var c = planCounts(), ti = ls.panels.testItems;
    ti.periods.day.testing = c.testing; ti.periods.day.pending = c.pending; ti.periods.day.done = c.done;
    ['day', 'month', 'year'].forEach(function (pk) {
      ti.periods[pk].overdue = c.overdue; ti.periods[pk].dueSoon = c.dueSoon;
      ti.periods[pk].overdueSource = 'lims'; ti.periods[pk].dueSoonSource = 'lims';
    });
    ti.derivedFrom = 'testItemPlan（Mock；接入 LIMS「要求检测完成时间」后为真值）';
    return ls;
  }

  /* ---------- 线路推导：定位点 + 拐点 → 逐段相连 → 堆叠成完整线路 ----------
     种子里 RB-C-02 只给「节点序列」routeNodes：
       kind:'station' = 无人化任务要到达的设备前的定位点（带 cad/label/任务号与 dwellSec）
       kind:'transit' = 其间的直角拐点（含门洞穿越侧的走廊拐点）
     path、每站 u、travelSec、t0、loopSec、pathLengthM、legs、gateCrossings 全部在这里按弧长推导。
     为什么必须推导：上一轮改了路径没重算 u，11 个站会全部停错位置——时间轴绝不允许手填。 */
  function manhattanChain(pts) {
    var out = [];
    pts.forEach(function (q) {
      var x = q[0], z = q[1], last = out[out.length - 1];
      if (!last) { out.push([x, z]); return; }
      var dx = x - last[0], dz = z - last[1];
      if (Math.abs(dx) > 0.05 && Math.abs(dz) > 0.05) out.push(Math.abs(dx) > Math.abs(dz) ? [x, last[1]] : [last[0], z]);   /* 长边先走，再原地掉头 */
      if (Math.abs(x - last[0]) > 1e-3 || Math.abs(z - last[1]) > 1e-3) out.push([x, z]);
    });
    return out;
  }
  function deriveRoute(rb) {
    if (!rb || !rb.routeNodes || rb.routeNodes.length < 2) return;
    var pts = manhattanChain(rb.routeNodes.map(function (n) { return [n.at[0], n.at[1]]; }));
    var C = [0];
    for (var i = 0; i < pts.length - 1; i++) C.push(C[i] + Math.abs(pts[i + 1][0] - pts[i][0]) + Math.abs(pts[i + 1][1] - pts[i][1]));
    var L = C[C.length - 1];
    var arcOf = function (q) {          /* 节点坐标 → 折线上的弧长 */
      /* 必须用「点到线段的真实距离」而不是垂距：同一条直路上有多个定位点时（例如 106 中巷几个工位都在 x=15.49 上），
         只比垂距会全部并列 0、取第一段，三个站就算出同一个 u（实测 u 出现 0.061,0.061,0.061）。 */
      var best = 1e9, bd = 0;
      for (var j = 0; j < pts.length - 1; j++) {
        var x1 = pts[j][0], z1 = pts[j][1], x2 = pts[j + 1][0], z2 = pts[j + 1][1];
        var seg = (x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1);
        var t = seg ? Math.max(0, Math.min(1, ((q[0] - x1) * (x2 - x1) + (q[1] - z1) * (z2 - z1)) / seg)) : 0;
        var px = x1 + (x2 - x1) * t, pz = z1 + (z2 - z1) * t;
        var dd = Math.hypot(px - q[0], pz - q[1]);
        if (dd < best - 1e-9) { best = dd; bd = C[j] + t * (C[j + 1] - C[j]); }
      }
      return bd;
    };
    rb.path = pts.map(function (q) { return [q[0], 0.05, q[1]]; });
    var stations = rb.routeNodes.filter(function (n) { return n.kind === 'station'; });
    var speed = (rb.demoCycle && rb.demoCycle.speedMs) || 0.75;
    /* 弧长区间 → 该段折线顶点（含端点插值），场景侧据此画「上一站→下一站」这一条腿 */
    var slice = function (a0, a1) {
      var at = function (dist) {
        dist = Math.max(0, Math.min(L, dist));
        for (var j = 0; j < pts.length - 1; j++) {
          if (dist <= C[j + 1] + 1e-9) {
            var seg = C[j + 1] - C[j], f = seg ? (dist - C[j]) / seg : 0;
            return [+(pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f).toFixed(2), +(pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f).toFixed(2)];
          }
        }
        return [pts[pts.length - 1][0], pts[pts.length - 1][1]];
      };
      var out = [at(a0)];
      for (var j = 0; j < pts.length; j++) { if (C[j] > a0 + 0.01 && C[j] < a1 - 0.01) out.push([pts[j][0], pts[j][1]]); }
      out.push(at(a1));
      return { at: at, pts: out };
    };
    var legs = [], prevArc = 0, prevSt = null;
    stations.forEach(function (st, k) {
      var a = arcOf(st.at);
      if (prevSt) {
        var sl = slice(prevArc, a);
        legs.push({ from: prevSt.order, to: st.order, fromLabel: prevSt.label, toLabel: st.label,
          u0: +(prevArc / L).toFixed(4), u1: +(a / L).toFixed(4), lengthM: +(a - prevArc).toFixed(2),
          travelSec: +((a - prevArc) / speed).toFixed(1), cad: st.cad, flow: st.flow || null, taskNo: st.taskNo || null, pts: sl.pts });
      }
      prevArc = a; prevSt = st;
    });
    var tailArc = L - prevArc;
    legs.push({ from: prevSt.order, to: stations[0].order, fromLabel: prevSt.label, toLabel: '回到 ' + stations[0].label,
      u0: +(prevArc / L).toFixed(4), u1: 1, lengthM: +tailArc.toFixed(2), travelSec: +(tailArc / speed).toFixed(1), tail: true, pts: slice(prevArc, L).pts });
    slice = null;
    rb.legs = legs;
    /* displayLegs：只给场景高亮用的分段——业务航段（legs）保持"上一站→下一站"不变，
       但像「9 站→走廊巡逻→1 站」这种 30m 长腿整条高亮会把画面铺满，所以按门洞/折返点切开。 */
    var dlegs = [];
    legs.forEach(function (lg) {
      var cuts = [0];
      for (var j = 1; j < lg.pts.length - 1; j++) {
        var p0 = lg.pts[j - 1], p1 = lg.pts[j];
        var isDoor = (p0[0] < 18.44) !== (p1[0] < 18.44);                 /* 跨东门 */
        var isTurn = (j + 1 < lg.pts.length) &&
          Math.abs(lg.pts[j + 1][0] - p1[0]) > 1e-6 ? false :
          (Math.abs(p1[1] - p0[1]) > 1e-6 && Math.abs(lg.pts[j + 1][1] - p1[1]) > 1e-6 && Math.abs(p1[0] - lg.pts[j + 1][0]) < 1e-6 && (p1[1] - p0[1]) * (lg.pts[j + 1][1] - p1[1]) < 0);  /* 折返 */
        if (isDoor || isTurn) cuts.push(j);
      }
      cuts.push(lg.pts.length - 1);
      var acc = 0;
      for (var c = 0; c < cuts.length - 1; c++) {
        var seg = lg.pts.slice(cuts[c], cuts[c + 1] + 1);
        var len = 0; for (var k = 0; k < seg.length - 1; k++) len += Math.abs(seg[k + 1][0] - seg[k][0]) + Math.abs(seg[k + 1][1] - seg[k][1]);
        var u0 = lg.u0 + (lg.u1 - lg.u0) * (acc / lg.lengthM);
        var u1 = lg.u0 + (lg.u1 - lg.u0) * ((acc + len) / lg.lengthM);
        dlegs.push({ from: lg.from, to: lg.to, part: c + 1, parts: cuts.length - 1, u0: +u0.toFixed(4), u1: +u1.toFixed(4),
          lengthM: +len.toFixed(2), pts: seg, cad: c === cuts.length - 2 ? lg.cad : null, flow: c === cuts.length - 2 ? lg.flow : null, taskNo: c === cuts.length - 2 ? lg.taskNo : null });
        acc += len;
      }
    });
    rb.displayLegs = dlegs;
    rb.pathLengthM = +L.toFixed(2);
    /* 时间轴：t0=停靠开始，travel 段在 [t0-travelSec, t0)；u 与 travelSec 都由弧长推导 */
    if (rb.demoCycle && rb.demoCycle.stops) {
      var stops = rb.demoCycle.stops;
      stops.forEach(function (st, k) {
        var sn = stations[Math.min(k, stations.length - 1)];
        var a = arcOf(sn.at);
        st.u = +(a / L).toFixed(4);
        st.travelSec = k === 0 ? 0 : legs[k - 1].travelSec;
        st.t0 = k === 0 ? 0 : +(stops[k - 1].t0 + stops[k - 1].dwellSec + legs[k - 1].travelSec).toFixed(1);
      });
      var last = stops[stops.length - 1];
      rb.demoCycle.loopSec = +((last.t0 + last.dwellSec + tailArc / speed)).toFixed(1);
      rb.demoCycle.pathLengthM = +L.toFixed(1);
      rb.demoCycle.legs = legs;
    }
    rb.routeDerived = { nodes: rb.routeNodes.length, vertices: pts.length, stations: stations.length, legs: legs.length, lengthM: +L.toFixed(2), loopSec: rb.demoCycle && rb.demoCycle.loopSec };
  }

  function cycleNow() {
    var rb = (state.zone106.robots || []).filter(function (r) { return r.robotId === 'RB-C-02'; })[0];
    var c = rb && rb.demoCycle;
    if (!c || !c.stops || !c.stops.length) return null;
    /* 约定：stop.t0 = 停靠（dwell）开始时刻，travel 段在 [t0-travelSec, t0) */
    var t = (Date.now() / 1000) % c.loopSec, last = c.stops[c.stops.length - 1], cur = last, idx = c.stops.length - 1, tail = false;
    for (var i = 0; i < c.stops.length; i++) { if (t < c.stops[i].t0 + c.stops[i].dwellSec) { cur = c.stops[i]; idx = i; break; } }
    if (t >= last.t0 + last.dwellSec) { tail = true; idx = c.stops.length - 1; }
    var dwellStart = cur.t0, phase = tail ? 'travel' : (t < dwellStart ? 'travel' : 'dwell');
    var next = c.stops[(idx + 1) % c.stops.length];
    var f = phase === 'travel' ? (cur.travelSec > 0 ? Math.min(1, Math.max(0, (t - (cur.t0 - cur.travelSec)) / cur.travelSec)) : 1) : Math.min(1, (t - dwellStart) / cur.dwellSec);
    var prevU = idx === 0 ? 0 : c.stops[idx - 1].u, u;
    if (tail) { var tailSec = c.loopSec - (last.t0 + last.dwellSec); u = last.u + (1 - last.u) * Math.min(1, (t - last.t0 - last.dwellSec) / (tailSec || 1)); }
    else if (phase === 'travel') u = prevU + (cur.u - prevU) * f;
    else u = cur.u;
    return { cycle: c, robot: rb, index: idx, stop: cur, next: next, phase: phase, f: f, tail: tail, u: Math.max(0, Math.min(1, u)),
      remaining: Math.max(0, Math.round(tail ? c.loopSec - t : (phase === 'dwell' ? cur.t0 + cur.dwellSec - t : dwellStart - t))) };
  }
  function applyCycle() {
    var cy = cycleNow(); if (!cy) return null;
    var rb = cy.robot, st = cy.stop, dwell = cy.phase === 'dwell';
    rb.progress = cy.u; rb.action = dwell ? 'servicing' : 'moving';
    rb.currentFlowName = cy.tail ? '返回 102 家位/充电' : (st.flow || rb.currentFlowName);
    rb.currentTaskId = cy.tail ? null : (st.taskNo || rb.currentTaskId);
    rb.taskElapsedMin = dwell ? Math.round(cy.f * st.dwellSec / 60 * 10) / 10 : 0; rb.stallLimitMin = 15;
    var served = state.zone106.devices.filter(function (x) { return x.code === st.deviceCode; })[0];
    rb.servingDeviceId = served ? served.deviceId : rb.servingDeviceId;
    rb.cycle = { order: cy.tail ? cy.cycle.stops.length : st.order, total: cy.cycle.stops.length,
      label: cy.tail ? '返回 102 家位/充电位' : st.label, phase: cy.phase, remainingSec: cy.remaining, taskNo: st.taskNo, flow: st.flow, deviceCode: st.deviceCode };
    /* 设备运行态由剧本驱动：正在停靠的设备=在测 */
    state.zone106.devices.forEach(function (x) {
      if (x.code === st.deviceCode && dwell) { x.status = 'working'; x.currentTaskId = st.taskNo || x.currentTaskId; }
      else if (x.status === 'working' && !x.currentSampleId) { x.status = 'ready'; }
    });
    return { order: cy.tail ? cy.cycle.stops.length : st.order, total: cy.cycle.stops.length,
      label: cy.tail ? '返回 102 家位/充电位' : st.label, phase: cy.phase, remainingSec: cy.remaining,
      taskNo: cy.tail ? null : st.taskNo, flow: cy.tail ? '返航' : st.flow, deviceCode: cy.tail ? null : st.deviceCode,
      u: +cy.u.toFixed(3), loopSec: cy.cycle.loopSec };
  }

  /* ---------- 底栏块2：调度任务队列的状态现算 ----------
     队列本身是种子数据（流程配置，图3 的 16 条 + 图1 的三分类），但「进行中」必须跟着循环剧本实时变：
     机器人正在服务哪个工位、跑的是哪条流，那条就标进行中——这样"无人化循环=循环这些任务"在屏上是可验证的，
     而不是底栏一套、三维一套各说各话。 */
  function queueView(q) {
    if (!q || !q.tasks) return q;
    var cy = cycleNow();
    var live = cy && cy.stop ? { flow: cy.stop.flowCode, cad: cy.stop.cad || null, order: cy.stop.order } : null;
    /* 流号 → 工位：由循环剧本反推，不在队列里手填（手填过一次对不上，「循环中」就永远标不出来） */
    var cadOf = {};
    if (cy && cy.cycle && cy.cycle.stops) cy.cycle.stops.forEach(function (st) { if (st.flowCode && st.cad) cadOf[st.flowCode] = st.cad; });
    var taken = {};
    q.tasks.forEach(function (t) {
      if (cadOf[t.flowCode]) t.cad = cadOf[t.flowCode];
      t.live = false;
      if (live && t.flowCode === live.flow && !taken[t.flowCode]) { t.live = true; taken[t.flowCode] = 1; }
      t.shown = t.live ? 'running' : t.state;
    });
    q.counts = { running: q.tasks.filter(function (t) { return t.shown === 'running'; }).length,
                 unassigned: q.tasks.filter(function (t) { return t.shown === 'unassigned'; }).length,
                 done: q.tasks.filter(function (t) { return t.shown === 'done'; }).length };
    q.liveFlow = live ? live.flow : null;
    q.liveOrder = live ? live.order : null;   /* 顺带给出剧本站序，测试可核对「循环中」确实对应机器人当前所在站 */
    return q;
  }

  /* ---- 定时器模拟三源变化（Mock 阶段：JSON + 定时器即可） ---- */
  function tick() {
    if (!state) return;
    state.zone106.robots.forEach(function (rb) {
      /* 停靠充电位的机器人（parked）：不推进度、不掉电——它没有任务，电量只回升（演示只跑一台） */
      if (rb.parked || rb.action === 'charging' || rb.status === 'charging') {
        rb.progress = 0;
        if (rb.battery < 96) { rb.battery = +(rb.battery + 0.35).toFixed(2); }
        rb.action = 'charging'; rb.status = 'charging';
        return;
      }
      if (!rb.demoCycle) {            // 无剧本且不在跑的机器人保留匀速环线；有剧本的由 applyCycle 精确给 u，不能再随机推
        rb.progress += rb.kind === 'amr' ? 0.045 : 0.012;
        if (rb.progress > 1) rb.progress = 0;
      }
      rb.battery = Math.max(12, +(rb.battery - 0.08).toFixed(2));
      if (rb.battery <= 15) {         // 跑到低电自己回桩：状态转充电中，下一 tick 起按上面的分支回升
        rb.action = 'charging'; rb.status = 'charging';
        emit('robot.action', { robotId: rb.robotId, action: 'charging' });
      }
    });
    state.overview['today-tasks'].forEach(function (t) {
      if (t.result !== 'pending') return;
      if (Math.random() < 0.25 && t.progress.doneSteps < t.progress.totalSteps) {
        t.progress.doneSteps++;
        t.progress.percent = Math.round(t.progress.doneSteps / t.progress.totalSteps * 100);
        if (t.progress.percent >= 100) { t.result = 'passed'; t.stage = '已完成'; t.progress.percent = 100; }
        emit('task.progress', { taskId: t.taskId, percent: t.progress.percent, stage: t.stage });
      }
    });
    /* 演示保活：今日任务全部完成后重置一条，避免挂机投影时「当前无在制任务」空屏 */
    if (!state.overview['today-tasks'].some(function (t) { return t.result === 'pending'; })) {
      var rst = state.overview['today-tasks'][0];
      rst.result = 'pending'; rst.stage = '检测中'; rst.progress.doneSteps = 1; rst.progress.percent = 20; rst.elapsedMin = 4;
      emit('task.progress', { taskId: rst.taskId, percent: rst.progress.percent, stage: rst.stage });
    }
    var devs = state.zone106.devices;
    var d = devs[Math.floor(Math.random() * devs.length)];
    if (d.status === 'ready' && Math.random() < 0.3) { d.status = 'working'; emit('device.status', { deviceId: d.deviceId, status: 'working' }); }
    else if (d.status === 'working' && !d.currentTaskId && Math.random() < 0.2) { d.status = 'standby'; emit('device.status', { deviceId: d.deviceId, status: 'standby' }); }
    state.overview['lab-status'].updatedAt = now();
    var cyc = applyCycle();
    emit('tick', { robots: clone(state.zone106.robots), devices: devs.map(function (x) { return { deviceId: x.deviceId, status: x.status }; }), cycle: cyc });
    if (cyc) emit('cycle', cyc);
  }

  function get(path) {
    return new Promise(function (resolve, reject) {
      if (!state) return reject(new Error('TwinApi 未就绪'));
      var m;
      if (path === '/api/overview/test-item-plan') {
        var pl = (state.testItemPlan || {}).items || [];
        return resolve(envelope({ note: state.testItemPlan.note, overdueRule: state.testItemPlan.overdueRule, dueSoonRule: state.testItemPlan.dueSoonRule,
          items: pl.map(function (x) {
            var req = new Date(Date.now() + x.dueInHours * 3600000);
            return { sampleId: x.sampleId, item: x.item, zone: x.zone, status: x.status, dueInHours: x.dueInHours,
              requiredAt: req.getFullYear() + '-' + pad(req.getMonth() + 1) + '-' + pad(req.getDate()) + ' ' + pad(req.getHours()) + ':' + pad(req.getMinutes()),
              overdue: x.status !== 'done' && x.dueInHours < 0, dueSoon: x.status !== 'done' && x.dueInHours >= 0 && x.dueInHours <= 72 };
          }) }));
      }
      /* 区域视图五类信息（2026-11-05 信息模型）：设备（下面通用 zone 路由）/ 任务统计 / 正在运行 / 告警。
         必须排在通用 /api/zone/{z}/{key} 之前，否则 task-stats 等会被当分区字段返回 null。环境数据走 V4 节点协议，不在此处。 */
      if ((m = path.match(/^\/api\/overview\/([\w-]+)$/))) {
        if (m[1] === 'lab-status') return resolve(envelope(withPlanDerive(clone(state.overview['lab-status']))));
        if (m[1] === 'dispatch-queue') return resolve(envelope(queueView(clone(state.overview['dispatch-queue']))));
        return resolve(envelope(clone(state.overview[m[1]] || null)));
      }
      /* 区域统计端点：一个请求把「该房间该显示哪种统计」也带出来（口径来自 seed 的 viewProfile，不在 JS 里写死）
         - 106：任务四格（完成/执行中/异常/排队）
         - 其他试验区：检测项目数四格（检测中/待检测/已完成/逾期）
         - 102：样品台账（存量/今日收样/今日还样/按名称分布）
         - 101、104：不统计任务与检测项目 */
      if ((m = path.match(/^\/api\/zone\/(\d{3})\/task-stats$/))) {
        var zk = 'Z-' + m[1], zstat = state.zoneStats[zk];
        var zone = (state.overview.zones || []).filter(function (z) { return z.zoneId === zk; })[0] || {};
        var prof = zone.viewProfile || { rail: false, dock: false, blocks: ['devices', 'env', 'alarms'], statsKind: 'none' };
        if (!zstat) return resolve(envelope({ unsupported: true, zoneId: m[1], viewProfile: prof, note: '该区无统计口径' }));
        return resolve(envelope({
          zoneId: zk, viewProfile: prof, statsKind: prof.statsKind,
          periods: zstat, note: zstat.note || null,
          testItems: zstat.testItems || null, samples: zstat.samples || null
        }));
      }
      if ((m = path.match(/^\/api\/zone\/(\d{3})\/running-tasks$/))) {
        var codes = {}; ((state['zone' + m[1]] || {}).devices || []).forEach(function (x) { codes[x.code] = 1; });
        var out = [];
        if (m[1] === '106') (state.zone106['dispatch-tasks'] || []).forEach(function (t) {
          if (t.status !== 'running') return;
          out.push({ kind: 'dispatch', taskId: t.taskId, name: t.flowName, deviceCode: t.deviceCode, robotId: t.robotId || null, startedAt: t.time, elapsedMin: t.elapsedMin || null, plannedMin: t.plannedMin || null, stage: '执行中', percent: null });
        });
        (state.overview['today-tasks'] || []).forEach(function (t) {
          if (t.result === 'passed') return;
          if (!(t.deviceChain || []).some(function (c) { return codes[c]; })) return;
          out.push({ kind: 'daq', taskId: t.taskId, name: t.type, deviceCode: (t.deviceChain || [])[0] || null, robotId: null, startedAt: null,
            elapsedMin: t.elapsedMin || 0, plannedMin: t.plannedMin || null, stage: t.stage, percent: t.progress ? t.progress.percent : null, result: t.result, sampleId: t.sampleId });
        });
        return resolve(envelope({ zoneId: 'Z-' + m[1], tasks: out }));
      }
      if ((m = path.match(/^\/api\/zone\/(\d{3})\/cycle$/))) {
        var rb = (state.zone106.robots || []).filter(function (x) { return x.robotId === 'RB-C-02'; })[0];
        return resolve(envelope(rb && rb.demoCycle ? { robotId: 'RB-C-02', cycle: rb.demoCycle, live: (function () { var c = cycleNow(); return c ? { order: c.stop.order, label: c.stop.label, phase: c.phase, remainingSec: c.remaining, u: c.u, loopSec: c.cycle.loopSec } : null; })() } : { unsupported: true }));
      }
      if ((m = path.match(/^\/api\/zone\/(\d{3})\/alarms$/))) {
        return resolve(envelope({ zoneId: 'Z-' + m[1], alarms: clone((state.overview.alarms || []).filter(function (a) { return a.zoneId === 'Z-' + m[1]; })) }));
      }
      if ((m = path.match(/^\/api\/zone\/(\d{3})\/([\w-]+)$/))) {
        var zone = state['zone' + m[1]];
        if (!zone) return resolve(envelope({ unsupported: true, zoneId: m[1], note: '该区未建 mock 分区数据（V1 监控细分仅 106，PRD S2）' }));
        return resolve(envelope(clone(zone[m[2]] || null)));
      }
      /* 事件序列回溯（原 S3）已移出 MVP 范围：端点保留、前端不再调用，二期恢复时可直接用 */
      if ((m = path.match(/^\/api\/alarm\/([\w-]+)\/trace$/))) {
        var alarm = state.overview.alarms.filter(function (a) { return a.alarmId === m[1]; })[0];
        return resolve(envelope(alarm ? { alarm: clone(alarm), window: '24h', events: clone(state.traces[m[1]] || []) } : null));
      }
      if ((m = path.match(/^\/api\/device\/([\w-]+)\/(detail|realtime)$/))) {
        var dev = null;
        Object.keys(state).filter(function (k) { return /^zone\d+$/.test(k); }).forEach(function (k) { (state[k].devices || []).forEach(function (x) { if (x.deviceId === m[1] || x.code === m[1]) dev = x; }); });   /* 跨区查找：106/103… */
        if (!dev && m[2] === 'detail' && global.EquipStore) {
          var rec = global.EquipStore.listAll().filter(function (x) { return x.id === m[1]; })[0];
          return resolve(envelope(rec ? { ledger: clone(rec), source: 'LIMS' } : null));
        }
        if (!dev) return resolve(envelope(null));
        if (m[2] === 'realtime') {
          var vals = clone(dev.keyParams || []).map(function (p) {
            if (typeof p.value === 'number') p.value = +(p.value * (0.97 + Math.random() * 0.06)).toFixed(4);
            return p;
          });
          return resolve(envelope({ deviceId: dev.deviceId, code: dev.code, status: dev.status, keyParams: vals, daqUnitId: dev.daqUnitId || null, updatedAt: now() }));
        }
        return resolve(envelope(clone(dev)));
      }
      reject(new Error('未知端点 ' + path));
    });
  }

  global.TwinApi = {
    ready: load,
    get: get,
    ws: function (handler) { subs.push(handler); return function () { subs = subs.filter(function (f) { return f !== handler; }); }; },
    /* 【PRD-v1 §6 红线 · 决策 Q2（2026-11-05）】孪生只读：不提供告警写回（原 alarmAck 已删除）。
       闭环状态（active/dispatched/resolved）只由来源系统经网关推送，前端仅显示 派至 / 解除人 / 解除时间。 */
    start: function (ms) { if (!timer) timer = setInterval(tick, ms || 2000); },
    stop: function () { clearInterval(timer); timer = null; }
  };
})(window);
