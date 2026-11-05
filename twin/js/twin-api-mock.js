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

  /* ---- 定时器模拟三源变化（Mock 阶段：JSON + 定时器即可） ---- */
  function tick() {
    if (!state) return;
    state.zone106.robots.forEach(function (rb) {
      rb.progress += rb.kind === 'amr' ? 0.045 : 0.03;
      if (rb.progress > 1) rb.progress = 0;
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
    emit('tick', { robots: clone(state.zone106.robots), devices: devs.map(function (x) { return { deviceId: x.deviceId, status: x.status }; }) });
  }

  function get(path) {
    return new Promise(function (resolve, reject) {
      if (!state) return reject(new Error('TwinApi 未就绪'));
      var m;
      if ((m = path.match(/^\/api\/overview\/([\w-]+)$/))) return resolve(envelope(clone(state.overview[m[1]] || null)));
      /* 区域视图五类信息（2026-11-05 信息模型）：设备（下面通用 zone 路由）/ 任务统计 / 正在运行 / 告警。
         必须排在通用 /api/zone/{z}/{key} 之前，否则 task-stats 等会被当分区字段返回 null。环境数据走 V4 节点协议，不在此处。 */
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
