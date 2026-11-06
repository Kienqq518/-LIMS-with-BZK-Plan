/**
 * 数字孪生 Mock API 层 V1 —— 前端唯一数据入口（不直连三个异构系统）
 * 契约：《数字孪生对象模型与数据字典 V1.md》§2；后端按同路径实现即插即用。
 * 端点：/api/overview/{lab-status|zones|today-tasks|alarms}
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

  /* ---- 定时器模拟三源变化（Mock 阶段：JSON + 定时器即可） ---- */
  function tick() {
    if (!state) return;
    state.zone106.robots.forEach(function (rb) {
      if (!rb.demoCycle) {            // 无剧本的机器人（RB-C-01）保留匀速环线；有剧本的由 applyCycle 精确给 u，不能再随机推
        rb.progress += rb.kind === 'amr' ? 0.045 : 0.012;
        if (rb.progress > 1) rb.progress = 0;
      }
      rb.battery = Math.max(12, +(rb.battery - 0.08).toFixed(2));
      if (rb.battery <= 15 && rb.action !== 'charging' && rb.status !== 'charging') {
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
        return resolve(envelope(clone(state.overview[m[1]] || null)));
      }
      if ((m = path.match(/^\/api\/zone\/(\d{3})\/task-stats$/))) {
        var zstat = state.zoneStats['Z-' + m[1]];
        return resolve(envelope(zstat ? { zoneId: 'Z-' + m[1], periods: zstat, note: zstat.note || null } : { unsupported: true, zoneId: m[1], note: '该区无任务口径' }));
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
