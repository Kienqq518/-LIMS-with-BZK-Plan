/**
 * 合同流程弹窗：委托 18 步只读时间轴。
 * 与委托预览「委托进度」、工作台顶栏搜索、样品台账详情「当前节点」共用同一套交互。
 */
(function (global) {
  var MODAL_ID = 'contractFlowModal';
  var STEPS = (global.FlowStages && global.FlowStages.FLOW_ORDER) || [
    '委托登记', '样品收样', '委托确认', '费用审核', '样品制备', '样品发样', '试样分发',
    '试验检测', '组内审核', '数据审核', '报告编制', '报告审核', '报告签发',
    '报告处理', '收费审批', '报告发放', '任务归档', '任务完成'
  ];
  var STATUS_ALIAS = {
    '': 0, '待接收': 7, '未领样': 7, '已审核': 7, '检测中': 7,
    '已复审': 11, '已完成': 17, '样品准备': 4, '样品入库': 5, '样品发放': 5,
    '检测检验': 7
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c];
    });
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function stampMs(raw) {
    var t = String(raw || '').replace('T', ' ').trim();
    var m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return 0;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }

  function formatStamp(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()) +
      ' ' + pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
  }

  function normalizeQuery(q) {
    return String(q || '')
      .replace(/[\uFF0F\u2215]/g, '/')
      .replace(/\s+/g, '')
      .trim();
  }

  function stepIndexOf(status) {
    var i = STEPS.indexOf(status);
    if (i >= 0) return i;
    if (STATUS_ALIAS[status] != null) return STATUS_ALIAS[status];
    return 0;
  }

  function synthSteps(curIndex, allDone, startDate, editor) {
    var startMs = stampMs(startDate || '2026-01-01') || stampMs('2026-01-01 09:00:00');
    var who = editor || 'admin';
    var prev = 0;
    return STEPS.map(function (name, i) {
      var done = i < curIndex || allDone;
      if (!done) return { name: name, user: '', time: '' };
      var ms = prev ? prev + 12 * 60 * 1000 + 30 * 1000 : startMs;
      prev = ms;
      return { name: name, user: who, time: formatStamp(ms) };
    });
  }

  function payloadFromSample(s) {
    if (!s || !global.SampleLedger) return null;
    return {
      code: s.code,
      sample: global.SampleLedger.titleName ? global.SampleLedger.titleName(s) : (s.alias || s.name || ''),
      steps: global.SampleLedger.taskFlowOf(s)
    };
  }

  function payloadFromEntrust(code) {
    if (!global.EntrustMock || !EntrustMock.ROWS || !EntrustMock.ROWS[code]) return null;
    var m = EntrustMock.get(code);
    var status = m.status || '';
    var idx = stepIndexOf(status);
    var allDone = idx >= STEPS.length - 1;
    return {
      code: m.code,
      sample: m.sampleNames || '—',
      steps: synthSteps(idx, allDone, m.acceptDate, m.editor)
    };
  }

  function resolveQuery(q) {
    var key = normalizeQuery(q);
    if (!key) return null;
    var L = global.SampleLedger;
    if (L) {
      var sample = L.get(key);
      if (sample) return payloadFromSample(sample);
      var rows = L.byCode ? L.byCode(key) : [];
      if (rows.length) {
        rows = rows.slice().sort(function (a, b) { return (a.taskStep || 1) - (b.taskStep || 1); });
        var names = [];
        rows.forEach(function (s) {
          var n = L.titleName ? L.titleName(s) : s.name;
          if (n && names.indexOf(n) < 0) names.push(n);
        });
        var payload = payloadFromSample(rows[0]);
        if (payload) {
          payload.code = key;
          payload.sample = names.join('、') || payload.sample;
        }
        return payload;
      }
    }
    return payloadFromEntrust(key);
  }

  function timelineHtml(steps) {
    var list = steps && steps.length ? steps : STEPS.map(function (name) {
      return { name: name, user: '', time: '' };
    });
    var current = -1;
    list.forEach(function (s, i) { if (!s.time && current < 0) current = i; });
    return list.map(function (s, i) {
      var isDone = !!s.time;
      var isCurrent = i === current;
      var isLast = i === list.length - 1;
      var dot;
      if (isDone) {
        dot = '<span class="flex h-6 w-6 items-center justify-center rounded-full bg-green-500 text-xs text-white"><i class="fa fa-check"></i></span>';
      } else if (isCurrent) {
        dot = '<span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs text-white">' + (i + 1) + '</span>';
      } else {
        dot = '<span class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">' + (i + 1) + '</span>';
      }
      var line = isLast ? '' : '<span style="width:2px;flex:1;margin-top:4px;background:' + (isDone ? '#4ade80' : '#e2e8f0') + '"></span>';
      var text;
      if (isDone) {
        text = '<div class="text-sm text-slate-700">' + esc(s.name) + '(' + esc(s.user || 'admin') + ')</div>' +
          '<div class="text-xs text-slate-400">' + esc(s.time) + '</div>';
      } else {
        var tag = isLast ? '' : '(暂无)';
        text = '<div class="text-sm ' + (isCurrent ? 'font-medium text-blue-600' : 'text-slate-500') + '">' +
          esc(s.name) + tag + '</div>';
      }
      return '<div class="flex gap-3">' +
        '<div class="flex flex-col items-center">' + dot + line + '</div>' +
        '<div class="pb-4">' + text + '</div>' +
        '</div>';
    }).join('');
  }

  function ensure() {
    var doc = global.document;
    var el = doc.getElementById(MODAL_ID);
    if (el) return el;
    el = doc.createElement('div');
    el.id = MODAL_ID;
    el.className = 'fixed inset-0 z-[80] hidden items-center justify-center bg-black/40';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'contractFlowTitle');
    el.innerHTML =
      '<div class="flex max-h-[86vh] w-[440px] max-w-[92vw] flex-col rounded-lg bg-white shadow-xl">' +
        '<div class="flex items-center justify-between border-b border-slate-100 px-6 py-3">' +
          '<h3 id="contractFlowTitle" class="text-base font-medium text-slate-800">合同流程</h3>' +
          '<button type="button" data-cf-close class="text-slate-400 hover:text-slate-600" aria-label="关闭"><i class="fa fa-times"></i></button>' +
        '</div>' +
        '<div class="border-b border-slate-100 px-6 py-3 text-sm text-slate-600">' +
          '<div>委托编号：<span data-cf-code class="text-slate-800"></span></div>' +
          '<div class="mt-1">样品名称：<span data-cf-sample class="text-slate-800"></span></div>' +
        '</div>' +
        '<div data-cf-list class="flex-1 overflow-y-auto px-6 py-4"></div>' +
      '</div>';
    el.addEventListener('click', function (e) {
      if (e.target === el) close();
    });
    el.querySelector('[data-cf-close]').addEventListener('click', close);
    doc.body.appendChild(el);
    return el;
  }

  function host() {
    try {
      if (global.parent && global.parent !== global && global.parent.ContractFlowModal &&
          global.parent.ContractFlowModal !== api) {
        return global.parent.ContractFlowModal;
      }
    } catch (e) { /* iframe 跨域时留在本页 */ }
    return null;
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  function open(payload) {
    var other = host();
    if (other) return other.open(payload);
    payload = payload || {};
    var el = ensure();
    el.querySelector('[data-cf-code]').textContent = payload.code || '—';
    el.querySelector('[data-cf-sample]').textContent = payload.sample || '—';
    el.querySelector('[data-cf-list]').innerHTML = timelineHtml(payload.steps);
    el.classList.remove('hidden');
    el.classList.add('flex');
    global.document.addEventListener('keydown', onKey);
  }

  function close() {
    var other = host();
    if (other) return other.close();
    var el = global.document.getElementById(MODAL_ID);
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('flex');
    global.document.removeEventListener('keydown', onKey);
  }

  function openByQuery(q) {
    var other = host();
    if (other) return other.openByQuery(q);
    var payload = resolveQuery(q);
    if (!payload) return false;
    open(payload);
    return true;
  }

  function bindSearch(input) {
    if (!input || input.getAttribute('data-cf-bound')) return;
    input.setAttribute('data-cf-bound', '1');
    input.setAttribute('placeholder', input.getAttribute('placeholder') || '搜索委托编号');
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var q = input.value;
      if (!openByQuery(q)) {
        alert('未找到委托「' + normalizeQuery(q) + '」。请输入委托编号（如 SC2026/0356）后回车。');
      }
    });
  }

  var api = {
    open: open,
    close: close,
    openByQuery: openByQuery,
    resolveQuery: resolveQuery,
    bindSearch: bindSearch
  };
  global.ContractFlowModal = api;
})(window);
