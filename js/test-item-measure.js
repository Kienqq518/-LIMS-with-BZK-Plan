/**
 * 试验项抽屉 · 试验参数 Tab 的「测量参数（实测值）」与「计算参数（计算值）」
 *
 * 对齐真实系统截图：行内编辑表格 + 拖拽排序 + 子项折叠分组 +
 * 修约规则编辑器（含条件映射）+ 计算公式编辑器（汇总统计型 / 算术表达式型）。
 *
 * 依赖 test-item-drawer.js（window.TID）与 test-item-params.js（window.TIDPU 共用工具）。
 */
(function (global) {
  'use strict';
  var TID = global.TID, U = global.TIDPU;
  var esc = U.esc, $ = U.$, clone = U.clone;

  var TYPES = ['数值', '文字', '下拉选项'];
  var BIND_DEFAULT = ['试验', '试样'];
  var STAT_TYPES = ['算术平均值', '最大值', '最小值', '中位数', '标准差'];
  var OPS_NUM = U.OPS_NUM, OPS_ENUM = U.OPS_ENUM, OPS_TEXT = U.OPS_TEXT, VAR_KINDS = U.VAR_KINDS, LOGIC = U.LOGIC;

  /* ── 种子数据：取自参数配置文档与截图 ─────────────────────────── */
  function mkRound(mode, digits) {
    return { condOn: false, base: { mode: mode || '四舍六入五成双', digits: digits == null ? 2 : digits, interval: '0.01', direct: '' }, rules: [] };
  }
  function P1(name, code, o) {
    var r = { name: name, code: code, symbol: '', type: '数值', options: [], defVal: '', unit: '', times: 1, round: mkRound('四舍六入五成双') };
    Object.keys(o || {}).forEach(function (k) { r[k] = o[k]; });
    return r;
  }
  var SEED_M = {
    '导体直流电阻': [{ sub: '', params: [
      P1('试样长度', 'dcdz_L', { symbol: 'L', unit: 'm' }),
      P1('试验温度', 'dcdz_T', { unit: '℃' }),
      P1('正向测量', 'dcdz_F', { unit: 'μΩ' }),
      P1('反向测量', 'dcdz_F', { unit: 'μΩ' }),
      P1('导体类型', 'dcdz_c', { type: '下拉选项', options: ['不镀金属退火铜线', '镀金属退火铜线'], defVal: '不镀金属退火铜线', unit: '' })
    ] }],
    '结构尺寸检查': [
      { sub: '导体', params: [
        P1('导体结构', 'jgcc1_cdtj', { type: '下拉选项', options: ['实心导体', '非紧压绞合圆形', '紧压绞合圆形', '绞合成型'], defVal: '紧压绞合圆形' }),
        P1('导体单丝根数', 'jgcc1_nwire', { unit: '根' }),
        P1('导体直径', 'jgcc1_d', { unit: 'mm' })
      ] },
      { sub: '绝缘厚度测量', params: [ P1('绝缘各测量点厚度', 'jgcc1_t', { unit: 'mm', times: 6 }) ] },
      { sub: '金属屏蔽', params: [ P1('铜带厚度', 'jgcc1_tb', { unit: 'mm', times: 3 }) ].concat(
        [1, 2, 3, 4, 5].reduce(function (a, n) { return a.concat([
          P1('铜带宽度 ' + n, 'jgcc1_bw' + n, { unit: 'mm' }),
          P1('搭盖宽度 ' + n, 'jgcc1_ov' + n, { unit: 'mm' })]); }, [])) }
    ]
  };
  var SEED_C = {
    '结构尺寸检查': [{ sub: '导体', params: [] }, { sub: '绝缘厚度测量', params: [
      C1('绝缘厚度最小值', 'jgcc1_tmin', { unit: 'mm', bind: '线芯', calcType: '汇总统计型', stat: { source: '绝缘各测量点厚度(mm)', kind: '最小值' } }),
      C1('绝缘厚度最大值', 'jgcc1_tmax', { unit: 'mm', bind: '线芯', calcType: '汇总统计型', stat: { source: '绝缘各测量点厚度(mm)', kind: '最大值' } }),
      C1('偏心率', 'jgcc1_ecc', { bind: '线芯', calcType: '算术表达式型', expr: { binding: '计算参数层级', formula: '(t_max(mm)-t_min(mm))/t_max(mm)*100' } })
    ] }, { sub: '金属屏蔽', params: [] }]
  };
  function C1(name, code, o) {
    var r = { name: name, code: code, symbol: '', unit: '', bind: '试验', calcType: '汇总统计型',
      stat: { source: '', kind: '算术平均值' }, expr: { binding: '计算参数层级', formula: '' },
      round: mkRound('四舍六入五成双'), show: true };
    if (o) Object.keys(o).forEach(function (k) { r[k] = o[k]; });
    return r;
  }

  var M = { in: '7.325', out: '', openSubs: {}, drag: -1 };
  global.TIDM = M;

  function groups(kind) {
    var st = TID.state;
    var key = kind === 'm' ? 'measures' : 'calcs';
    if (!st[key]) {
      var nm = st.name, seed = (kind === 'm' ? SEED_M : SEED_C)[nm];
      st[key] = seed ? clone(seed) : (subNames().length
        ? subNames().map(function (s) { return { sub: s, params: [] }; })
        : [{ sub: '', params: [] }]);
    }
    return st[key];
  }
  function subNames() { return ((TID.state || {}).subItems || []).map(function (s) { return s.name; }).filter(Boolean); }
  function measuredNames() {
    var out = [];
    groups('m').forEach(function (g) { g.params.forEach(function (p) { out.push(p.name + (p.unit ? '(' + p.unit + ')' : '')); }); });
    return out;
  }
  function bindOptions() {
    var s = (TID.ctx && TID.ctx.sample) || {}, out = ['试验', '试样'];
    if (s.isCable) out.splice(1, 0, TID.state.wholeCable ? '整缆' : '线芯');
    if (TID.state.segFlag) out.push('样段');
    return out;
  }
  function roundSummary(rc) {
    if (rc.condOn) return '条件映射 ' + rc.rules.length + ' 条';
    var b = rc.base;
    if (b.mode === '直接取值') return '直接取值 ' + (b.direct || '');
    if (b.mode === '指定间隔修约') return '指定间隔 ' + b.interval;
    return b.mode + '，保留 ' + b.digits + ' 位';
  }

  /* ══════════ 挂载：接管 TIDP 的测量 / 计算子 Tab ══════════ */
  function renderInto(kind) {
    var body = $('tidBody');
    var title = kind === 'm' ? '测量参数（实测值）' : '计算参数（计算值）';
    var desc = kind === 'm'
      ? '试验过程中通过仪器或人工测量获取的实际数值，用于验证样品是否符合标准要求。请确保测量方法符合相关标准规范，并记录原始数据以支持结果追溯与复核。'
      : '本区域参数数值由系统将测量参数代入标准公式自动计算得出，不可手动修改。';
    body.innerHTML = '<div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:8px">' + title + '</div>' +
      '<p style="font-size:12px;color:#94a3b8;line-height:1.8;margin:0 0 16px">' + desc + '</p>' +
      subsBar(kind) + groups(kind).map(function (g, gi) { return panel(kind, g, gi); }).join('');
  }
  function subsBar(kind) {
    var cur = kind === 'm' ? 'meas' : 'calc';
    return '<div class="pm-subs">' + [['ctrl', '控制参数'], ['meas', '测量参数'], ['calc', '计算参数']].map(function (s) {
      return '<span class="pm-sub' + (cur === s[0] ? ' active' : '') + '" onclick="TIDM.setSub(\'' + s[0] + '\')">' + s[1] + '</span>';
    }).join('') + '</div>';
  }
  M.setSub = function (s) { global.TIDP.setSub(s); };
  M.groups = groups;

  function panel(kind, g, gi) {
    var hasSub = !!g.sub;
    // 默认全部收起（图13 初始态），点标题展开；无子项时始终展开
    var open = !hasSub || M.openSubs[gi] === true;
    var head = '<div class="ms-panel-h" onclick="TIDM.toggle(' + gi + ')">' +
      (hasSub ? '<span class="ms-lab">试验子项：</span><b>' + esc(g.sub) + '</b>' : '') +
      '<i class="fa fa-angle-' + (open ? 'down' : 'right') + ' ms-caret"></i></div>';
    if (!open) return '<div class="ms-panel">' + head + '</div>';
    return '<div class="ms-panel">' + head + '<div class="ms-panel-b">' + table(kind, g, gi) +
      '<div class="ms-save"><button class="btn-save" onclick="TIDM.save(\'' + kind + '\',' + gi + ')">保 存</button></div></div></div>';
  }
  M.toggle = function (gi) { M.openSubs[gi] = M.openSubs[gi] !== true; reRender(); };

  function table(kind, g, gi) {
    var cols = kind === 'm'
      ? ['h', '*名称', '*编码', '符号', '*类型', '可选项', '默认值', '单位', '*测量次数', '修约规则', 'op']
      : ['h', '*名称', '*编码', '符号', '单位', '*绑定层级', '*计算方式', '*修约规则', '试验检测显示', 'op'];
    var th = cols.map(function (c) {
      if (c === 'h') return '<th class="ms-h"></th>';
      if (c === 'op') return '<th class="ms-op">操作<span class="op-add" onclick="TIDM.addRow(\'' + kind + '\',' + gi + ')">＋</span></th>';
      return '<th>' + (c.charAt(0) === '*' ? '<span class="req">*</span> ' + c.slice(1) : c) + '</th>';
    }).join('');
    var body = g.params.length ? g.params.map(function (p, pi) { return row(kind, g, gi, p, pi); }).join('')
      : '<tr><td colspan="' + cols.length + '"><div class="empty-table"><i class="fa fa-inbox"></i>暂无数据，点右上 ＋ 添加</div></td></tr>';
    return '<table class="data-table ms-table"><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function inp(key, gi, pi, val, ph, w) {
    return '<input type="text" value="' + esc(val) + '" placeholder="' + (ph || '请输入') + '"' +
      (w ? ' style="width:' + w + '"' : '') + ' oninput="TIDM.set(\'' + key + '",' + gi + ',' + pi + ',this.value)" />';
  }
  function dd(key, gi, pi, val, opts) {
    return '<select onchange="TIDM.set(\'' + key + '",' + gi + ',' + pi + ',this.value)">' +
      opts.map(function (o) { return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
  }
  function row(kind, g, gi, p, pi) {
    var grip = '<td class="ms-h" draggable="true" ondragstart="TIDM.rowDrag(' + gi + ',' + pi + ',event)" ondragover="event.preventDefault()" ondrop="TIDM.rowDrop(' + gi + ',' + pi + ',event)"><i class="pm-grip"></i></td>';
    var cells;
    if (kind === 'm') {
      var isEnum = p.type === '下拉选项';
      cells = '<td>' + inp('name', gi, pi, p.name) + '</td>' +
        '<td>' + inp('code', gi, pi, p.code) + '</td>' +
        '<td>' + inp('symbol', gi, pi, p.symbol) + '</td>' +
        '<td class="ms-type">' + dd('type', gi, pi, p.type, TYPES) + '</td>' +
        '<td class="ms-opts">' + (isEnum ? tags(gi, pi, p) : '') + '</td>' +
        '<td class="ms-def">' + (isEnum ? dd('defVal', gi, pi, p.defVal, p.options.length ? p.options : ['（先加可选项）']) : '') + '</td>' +
        '<td>' + inp('unit', gi, pi, p.unit) + '</td>' +
        '<td>' + inp('times', gi, pi, p.times, '1', '54px') + '</td>' +
        '<td class="ms-round">' + roundCell('m', gi, pi, p) + '</td>';
    } else {
      cells = '<td>' + inp('name', gi, pi, p.name) + '</td>' +
        '<td>' + inp('code', gi, pi, p.code) + '</td>' +
        '<td>' + inp('symbol', gi, pi, p.symbol) + '</td>' +
        '<td>' + inp('unit', gi, pi, p.unit) + '</td>' +
        '<td class="ms-bind">' + dd('bind', gi, pi, p.bind, bindOptions()) + '</td>' +
        '<td class="ms-calc">' + calcCell(gi, pi, p) + '</td>' +
        '<td class="ms-round">' + roundCell('c', gi, pi, p) + '</td>' +
        '<td><label class="toggle"><input type="checkbox" ' + (p.show ? 'checked' : '') + ' onchange="TIDM.set(\'show\',' + gi + ',' + pi + ',this.checked)" /><span class="toggle-slider"></span></label></td>';
    }
    return '<tr>' + grip + cells + '<td class="ms-op"><span class="op-del" onclick="TIDM.delRow(\'' + kind + '\',' + gi + ',' + pi + ')">−</span></td></tr>';
  }
  function tags(gi, pi, p) {
    return '<div class="ms-tagbox">' + p.options.map(function (o, oi) {
      return '<span class="tid-tag"><span>' + esc(o) + '</span><i class="fa fa-times" onclick="TIDM.delOpt(' + gi + ',' + pi + ',' + oi + ',event)"></i></span>';
    }).join('') + '<input type="text" class="ms-opt-add" placeholder="回车添加" onkeydown="TIDM.addOpt(event,' + gi + ',' + pi + ')" /></div>';
  }
  function roundCell(kind, gi, pi, p) {
    return '<input type="text" value="' + esc(roundSummary(p.round)) + '" disabled />' +
      '<a class="link ms-ed" onclick="TIDM.openRound(\'' + kind + '\',' + gi + ',' + pi + ')"><i class="fa fa-pencil"></i></a>';
  }
  function calcCell(gi, pi, p) {
    var sum = p.calcType === '汇总统计型'
      ? '取' + (p.stat.source || '（未选数据源）') + '的' + p.stat.kind
      : (p.expr.formula || '（未配置公式）');
    return '<input type="text" value="' + esc(sum) + '" disabled />' +
      '<a class="link ms-ed" onclick="TIDM.openCalc(' + gi + ',' + pi + ')"><i class="fa fa-pencil"></i></a>';
  }

  function reRender() {
    var st = TID.state;
    renderInto(st._lastKind || 'm');
  }

  /* ── 行内编辑动作 ─────────────────────────────────────────── */
  M.set = function (k, gi, pi, v) {
    var kind = TID.state._lastKind;
    var p = groups(kind)[gi].params[pi];
    p[k] = v;
    if (k === 'type') {
      if (v === '下拉选项') { if (!p.options) p.options = []; }
      else { p.options = []; p.defVal = ''; p.unit = p.unit || ''; }
      reRender();
    }
    if (k === 'show' || k === 'bind') return;
  };
  M.addOpt = function (ev, gi, pi) {
    if (ev.key !== 'Enter') return;
    var v = ev.target.value.trim(); if (!v) return;
    var p = groups(TID.state._lastKind)[gi].params[pi];
    if (p.options.indexOf(v) < 0) p.options.push(v);
    if (!p.defVal) p.defVal = v;
    reRender();
    setTimeout(function () { var b = document.querySelectorAll('.ms-opt-add'); if (b.length) b[b.length - 1].focus(); }, 0);
  };
  M.delOpt = function (ev, gi, pi, oi) {
    ev.stopPropagation();
    var p = groups(TID.state._lastKind)[gi].params[pi];
    p.options.splice(oi, 1);
    if (p.defVal && p.options.indexOf(p.defVal) < 0) p.defVal = p.options[0] || '';
    reRender();
  };
  M.addRow = function (kind, gi) {
    var g = groups(kind)[gi];
    var base = (TID.state.code || 'px') + '_';
    g.params.push(kind === 'm'
      ? P1('', base + (g.params.length + 1))
      : C1('', base + (g.params.length + 1)));
    reRender();
  };
  M.delRow = function (kind, gi, pi) { groups(kind)[gi].params.splice(pi, 1); reRender(); };
  M.save = function (kind, gi) {
    var g = groups(kind)[gi], miss = [];
    g.params.forEach(function (p, i) {
      if (!p.name) miss.push('第 ' + (i + 1) + ' 行名称');
      if (!p.code) miss.push('第 ' + (i + 1) + ' 行编码');
      if (kind === 'm' && p.type === '下拉选项' && !p.options.length) miss.push('第 ' + (i + 1) + ' 行可选项');
      if (kind === 'c' && p.calcType === '汇总统计型' && !p.stat.source) miss.push('第 ' + (i + 1) + ' 行数据源');
      if (kind === 'c' && p.calcType === '算术表达式型' && !p.expr.formula) miss.push('第 ' + (i + 1) + ' 行计算公式');
    });
    if (miss.length) { U.toast('缺少必填项：' + miss.join('、')); return; }
    U.toast('已保存（原型）：' + (g.sub || '本页') + ' ' + g.params.length + ' 个' + (kind === 'm' ? '实测值' : '计算值') + '参数');
  };
  M.rowDrag = function (gi, pi, ev) { M.drag = [gi, pi]; ev.dataTransfer.effectAllowed = 'move'; };
  M.rowDrop = function (gi, pi, ev) {
    ev.preventDefault();
    if (!M.drag || M.drag[0] !== gi || M.drag[1] === pi) return;
    var kind = TID.state._lastKind, arr = groups(kind)[gi].params;
    var x = arr.splice(M.drag[1], 1)[0]; arr.splice(pi, 0, x);
    M.drag = -1; reRender();
  };

  /* ══════════ 修约规则编辑器（开启条件映射） ══════════ */
  var R = null, RC = null;
  M.openRound = function (kind, gi, pi) {
    RC = { kind: kind, gi: gi, pi: pi }; M._rdone = null;
    R = clone(groups(kind)[gi].params[pi].round);
    roundOuter();
  };
  /* 供标称值等其它模块复用：传入持有 round 的对象与保存回调 */
  M.editRound = function (holder, done) {
    RC = null; M._rdone = function () { holder.round = clone(R); done(); };
    R = clone(holder.round || mkRound());
    roundOuter();
  };
  function roundOuter() {
    var inner = '<div class="pm-grid"><div class="pm-fi pm-wide">' +
      '<span class="pm-lab">开启条件映射：</span><span class="pm-ctl"><label class="toggle"><input type="checkbox" ' + (R.condOn ? 'checked' : '') +
      ' onchange="TIDM.roundCond(this.checked)" /><span class="toggle-slider"></span></label></span></div></div>' +
      (R.condOn
        ? '<div class="pm-rules"><span class="pm-lab req">规则：</span><a class="link" onclick="TIDM.ruleAdd()"><i class="fa fa-plus"></i> 规则</a></div>' +
          (R.rules.length ? '<div class="pm-rulelist">' + R.rules.map(function (r, i) {
            return '<div class="pm-rule"><div class="pm-rule-h"><b>规则 ' + (i + 1) + '</b>' +
              '<a class="link mr-2" onclick="TIDM.ruleEdit(' + i + ')"><i class="fa fa-pencil"></i> 编辑</a>' +
              '<a class="link danger" onclick="TIDM.ruleDel(' + i + ')"><i class="fa fa-trash"></i> 删除</a></div>' +
              '<div class="pm-rule-b"><span class="pm-k">如果</span>' + esc(r.logic) + '：' +
              r.ifs.map(function (c) { return '[' + [c.kind, c.varName, c.op, c.target].filter(Boolean).join(' ') + ']'; }).join(' 且 ') +
              '<br><span class="pm-k">则</span>' + esc(roundSummary({ condOn: false, base: r.then })) + '</div></div>';
          }).join('') + '</div>' : '')
        : '<div class="pm-then" style="margin-top:6px"><input type="text" value="' + esc(roundSummary({ condOn: false, base: R.base })) + '" disabled />' +
          '<a class="link ms-ed" onclick="TIDM.roundBase()"><i class="fa fa-pencil"></i> 编辑</a></div>');
    U.modalShell('编辑修约规则', inner, 'TIDM.roundOk()', '确 定', 0);
  }
  M.roundCond = function (v) { R.condOn = v; roundOuter(); };
  M.roundOk = function () {
    if (R.condOn && !R.rules.length) { U.toast('开启条件映射后至少配置一条规则'); return; }
    if (RC) { groups(RC.kind)[RC.gi].params[RC.pi].round = clone(R); reRender(); }
    else if (M._rdone) { M._rdone(); }
    U.host().innerHTML = '';
  };
  M.roundBase = function () { roundBaseModal(R.base, function (b) { R.base = b; roundOuter(); }); };
  M.ruleAdd = function () { M._ri = -1; ruleModal(); };
  M.ruleEdit = function (i) { M._ri = i; ruleModal(); };
  M.ruleDel = function (i) { R.rules.splice(i, 1); roundOuter(); };

  function basePanel(cfg, prefix) {
    var isInt = cfg.mode === '指定间隔修约', isDirect = cfg.mode === '直接取值';
    return '<div class="pm-round">' +
      '<div class="pm-divide">修约配置</div>' +
      '<div class="pm-rrow"><span class="pm-lab">修约方式：</span><select onchange="' + prefix + '(\'mode\',this.value)">' +
      U.ROUND_MODES.map(function (m) { return '<option' + (m === cfg.mode ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>' +
      '<div class="pm-rhelp">' + U.ROUND_HELP[cfg.mode] + '</div>' +
      (isDirect
        ? '<div class="pm-rrow"><span class="pm-lab">直接取值为：</span><input type="text" value="' + esc(cfg.direct) + '" oninput="' + prefix + '(\'direct\',this.value)" /></div>'
        : isInt
        ? '<div class="pm-rrow"><span class="pm-lab">精度设置：</span><span class="pm-mut">修约间隔</span><select onchange="' + prefix + '(\'interval\',this.value)">' +
          U.INTERVALS.map(function (v) { return '<option' + (v === cfg.interval ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>'
        : '<div class="pm-rrow"><span class="pm-lab">精度设置：</span><span class="pm-mut">保留小数位数</span>' +
          '<span class="tid-step"><button onclick="' + prefix + '(\'digits\',' + (Number(cfg.digits) - 1) + ')">−</button>' +
          '<input type="text" value="' + esc(cfg.digits) + '" oninput="' + prefix + '(\'digits\',this.value)" />' +
          '<button onclick="' + prefix + '(\'digits\',' + (Number(cfg.digits) + 1) + ')">＋</button></span> 位</div>') +
      // PRD §3.4.2.3.3：选「直接取值」时整个边界条件处理模块隐藏
      (isDirect ? '' : '<div class="pm-rrow"><span class="pm-lab">边界条件处理：</span>负数按绝对值修约（对称修约）<input type="checkbox" checked disabled /></div>') +
      '<div class="pm-divide" style="margin-top:14px">预览效果</div>' +
      '<div class="pm-rrow"><span class="pm-lab">输入值：</span><input type="text" id="mrIn" value="' + esc(M.in) + '" oninput="' + prefix + '(\'__in\',this.value)" /></div>' +
      '<div class="pm-rrow"><span class="pm-lab">修约后：</span><input type="text" id="mrOut" value="' + esc(M.out) + '" disabled /></div>' +
      '</div>';
  }
  function previewInto(cfg) {
    M.out = String(U.roundBy(M.in, { mode: cfg.mode, digits: cfg.digits, interval: Number(cfg.interval), direct: cfg.direct }) || '');
  }
  function roundBaseModal(cfg, done) {
    M._cb = function (k, v) {
      if (k === 'digits') { cfg.digits = Math.max(0, Math.min(10, typeof v === 'number' ? v : (parseInt(v, 10) || 0))); if (typeof v === 'number') roundBaseModal(cfg, done); else { previewInto(cfg); paint(); } return; }
      if (k === '__in') { M.in = v; previewInto(cfg); paint(); return; }
      cfg[k] = v;
      if (k === 'mode') roundBaseModal(cfg, done); else { previewInto(cfg); paint(); }
    };
    global.TIDM._cb = M._cb;
    previewInto(cfg);
    U.modalShell('编辑修约规则', basePanel(cfg, 'TIDM._cb'), 'TIDM._roundBaseOk()', '确 定', 1);
    M._baseDone = done; M._baseCfg = cfg;
    function paint() { var i = $('mrIn'), o = $('mrOut'); if (i && o) { i.value = M.in; o.value = M.out; } }
    M._paint = paint;
  }
  M._cb = function () {};
  M._roundBaseOk = function () {
    var h = U.host(); if (h.children.length > 1) h.removeChild(h.lastChild);
    M._baseDone(M._baseCfg);
  };

  /* 条件映射的规则：如果（变量→符号→目标值）则（完整修约配置面板） */
  function ruleModal() {
    // 新建规则也要复用已编辑的草稿，否则每次重绘都会把用户刚填的条件冲掉
    var r = M._ri >= 0 ? R.rules[M._ri]
      : (M._rule || (M._rule = { logic: LOGIC[0], ifs: [{ kind: '规格参数' }], then: clone(R.base) }));
    M._rule = r;
    M._cb2 = function (i, k, v) {
      var c = r.ifs[i]; c[k] = v;
      if (k === 'target') return;
      if (k === 'kind') { c.varName = ''; c.op = ''; }
      ruleModal();
    };
    M._cb3 = function (k, v) { r.then[k] = v; if (k === 'mode' || k === 'digits') ruleModal(); };
    var inner = '<div class="pm-sec"><span class="pm-lab req">如果：</span></div>' +
      '<div class="pm-ifbar"><select onchange="TIDM._rl(this.value)">' + LOGIC.map(function (l) {
        return '<option' + (l === r.logic ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select>' +
      '<button class="btn-save" onclick="TIDM._addIf()"><i class="fa fa-plus"></i> 条件</button></div>' +
      '<div class="pm-iflist">' + r.ifs.map(function (c, i) { return ifRow(c, i); }).join('') + '</div>' +
      '<div class="pm-sec" style="margin-top:18px"><span class="pm-lab req">则：</span></div>' +
      basePanel(r.then, 'TIDM._cb3');
    U.modalShell('添加规则', inner, 'TIDM._ruleOk()', '确 定', 2);
    M._rl = function (v) { r.logic = v; ruleModal(); };
    M._addIf = function () { r.ifs.push({ kind: '规格参数' }); ruleModal(); };
    M._delIf = function (i) { if (r.ifs.length === 1) { U.toast('至少保留一个条件'); return; } r.ifs.splice(i, 1); ruleModal(); };
    M._ruleOk = function () {
      if (r.ifs.some(function (c) { return !c.kind || !c.varName || !c.op; })) { U.toast('请补全「如果」里的类型、变量与对比符号'); return; }
      if (M._ri >= 0) R.rules[M._ri] = r; else R.rules.push(r);
      M._rule = null;
      var h = U.host(); while (h.children.length > 1) h.removeChild(h.lastChild);
      roundOuter();
    };
  }
  function varPool(kind) {
    if (kind === '规格参数') return U.specList().map(function (s) { return s.name; });
    if (kind === '标称值') return ['（来自标称值 Tab，待补）'];
    var pool = U.poolFor(TID.state.name);
    return kind === '预设值' ? pool.preset : kind === '实测值' ? measuredNames() : pool.computed;
  }
  function norm(s2) { return String(s2 || '').replace(/\s+/g, ''); }
  function varType(kind, name) {
    if (kind === '规格参数') {
      var sp = U.specList().filter(function (x) { return norm(x.name) === norm(name); })[0];
      return sp && sp.options && sp.options.length ? 'enum' : 'num';
    }
    if (kind === '实测值') {
      var hit = null;
      groups('m').forEach(function (g) { g.params.forEach(function (q) {
        if (norm(q.name + (q.unit ? '(' + q.unit + ')' : '')) === norm(name)) hit = q; }); });
      if (hit) return hit.type === '下拉选项' ? 'enum' : (hit.type === '文字' ? 'text' : 'num');
    }
    return 'num';
  }
  function ifRow(c, i) {
    var names = varPool(c.kind);
    var vt = varType(c.kind, c.varName);
    var ops = vt === 'enum' ? OPS_ENUM : vt === 'text' ? OPS_TEXT : OPS_NUM;
    var target = (c.op === 'is null' || c.op === 'is not null') ? '<span class="pm-none"></span>'
      : vt === 'enum' ? '<select onchange="TIDM._cb2(' + i + ',\'target\',this.value)"><option value="">请选择</option>' +
        ((U.specList().filter(function (x) { return norm(x.name) === norm(c.varName); })[0] || {}).options || []).map(function (o) {
          return '<option' + (o === c.target ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'
      : '<input type="text" value="' + esc(c.target || '') + '" placeholder="请输入" oninput="TIDM._cb2(' + i + ',\'target\',this.value)" />';
    return '<div class="pm-ifrow">' +
      '<select onchange="TIDM._cb2(' + i + ',\'kind\',this.value)">' + VAR_KINDS.map(function (k) {
        return '<option' + (k === c.kind ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>' +
      '<select onchange="TIDM._cb2(' + i + ',\'varName\',this.value)"><option value="">请选择</option>' +
      names.map(function (n) { return '<option' + (n === c.varName ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
      '<select onchange="TIDM._cb2(' + i + ',\'op\',this.value)"><option value="">请选择</option>' +
      ops.map(function (o) { return '<option' + (o === c.op ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>' +
      target + '<a class="link danger pm-ed" onclick="TIDM._delIf(' + i + ')"><i class="fa fa-trash"></i> 删除</a></div>';
  }

  M._varType = varType;

  /* ══════════ 计算公式编辑器 ══════════ */
  var CC = null;
  M.openCalc = function (gi, pi) {
    CC = { gi: gi, pi: pi };
    M._cf = clone(groups('c')[gi].params[pi]);
    calcModal();
  };
  function calcModal() {
    var p = M._cf;
    var inner = '<div class="pm-grid" style="grid-template-columns:1fr">' +
      '<div class="pm-fi"><span class="pm-lab">计算类型：</span><span class="pm-ctl"><span class="tid-radios">' +
      ['汇总统计型', '算术表达式型'].map(function (t) {
        return '<label><input type="radio" name="mcT" value="' + t + '"' + (p.calcType === t ? ' checked' : '') +
          ' onchange="TIDM.cfType(this.value)" />' + t + '</label>'; }).join('') + '</span></span></div></div>' +
      (p.calcType === '汇总统计型' ? statPanel(p) : exprPanel(p));
    U.modalShell('编辑计算公式', inner, 'TIDM.cfOk()', '确 定', 1);
  }
  function statPanel(p) {
    return '<div class="pm-divide">对多次测量值进行统计汇总</div>' +
      '<div class="pm-grid" style="grid-template-columns:1fr">' +
      '<div class="pm-fi"><span class="pm-lab req">数据源：</span><span class="pm-ctl">' +
      '<select onchange="TIDM.cfStat(\'source\',this.value)"><option value="">请选择</option>' +
      measuredNames().map(function (n) { return '<option' + (n === p.stat.source ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></span></div>' +
      '<div class="pm-fi"><span class="pm-lab req">统计类型：</span><span class="pm-ctl">' +
      '<select onchange="TIDM.cfStat(\'kind\',this.value)">' + STAT_TYPES.map(function (k) {
        return '<option' + (k === p.stat.kind ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></span></div></div>';
  }
  function exprPanel(p) {
    var tests = U.testList();
    return '<div class="pm-grid" style="grid-template-columns:1fr">' +
      '<div class="pm-fi"><span class="pm-lab">绑定：</span><span class="pm-ctl"><span class="tid-radios">' +
      ['计算参数层级', '实测值测量次数'].map(function (t) {
        return '<label><input type="radio" name="mcB" value="' + t + '"' + (p.expr.binding === t ? ' checked' : '') +
          ' onchange="TIDM.cfBind(this.value)" />' + t + '</label>'; }).join('') + '</span></span></div>' +
      '<div class="pm-fi"><span class="pm-lab">计算公式：</span><span class="pm-ctl"><div class="ms-fbox">' +
      '<input type="text" id="mcF" value="' + esc(p.expr.formula) + '" placeholder="请输入计算公式" disabled />' +
      '<button class="btn-outline" onclick="TIDM.cfBack()">退 回</button><button class="btn-outline" onclick="TIDM.cfClear()">清 除</button></div></span></div>' +
      '<div class="pm-fi"><span class="pm-lab">请选择试验：</span><span class="pm-ctl">' +
      '<select onchange="TIDM.cfTest(this.value)"><option value="">请选择</option>' +
      tests.map(function (t) { return '<option' + (t === M._cftest ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></span></div>' +
      '<div class="pm-fi"><span class="pm-lab">请选择参数：</span><span class="pm-ctl"><div class="ms-frow">' +
      '<select id="mcP" ' + (M._cftest ? '' : 'disabled') + '><option value="">请选择参数</option>' +
      (M._cftest ? U.poolFor(M._cftest).measured.concat(U.poolFor(M._cftest).computed) : []).map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') +
      '</select><button class="btn-outline" ' + (M._cftest ? '' : 'disabled') + ' onclick="TIDM.cfIns(\'#mcP\')">插 入</button></div></span></div>' +
      '<div class="pm-fi"><span class="pm-lab">插入数值：</span><span class="pm-ctl"><div class="ms-frow">' +
      '<input type="text" id="mcN" placeholder="请输入" /><button class="btn-outline" onclick="TIDM.cfInsRaw(\'#mcN\')">插 入</button></div></span></div>' +
      '<div class="pm-fi"><span class="pm-lab">规格参数：</span><span class="pm-ctl"><div class="ms-frow">' +
      '<select id="mcS"><option value="">请选择规格参数</option>' + U.specList().map(function (s) { return '<option>' + esc(s.name) + '</option>'; }).join('') +
      '</select><button class="btn-outline" onclick="TIDM.cfIns(\'#mcS\')">插 入</button></div></span></div>' +
      '<div class="pm-fi"><span class="pm-lab">数学常数：</span><span class="pm-ctl"><span class="ms-ops">' +
      ['e', 'π'].map(function (k) { return '<button onclick="TIDM.cfRaw(\'' + k + '\')">' + k + '</button>'; }).join('') + '</span></span></div>' +
      '<div class="pm-fi"><span class="pm-lab">插入次方：</span><span class="pm-ctl"><div class="ms-frow">' +
      '<input type="text" id="mcE" placeholder="请输入" /><button class="btn-outline" onclick="TIDM.cfExp()">插 入</button></div></span></div>' +
      '<div class="pm-fi"><span class="pm-lab">运算符快捷按钮：</span><span class="pm-ctl"><span class="ms-ops">' +
      ['+', '-', '*', '/', '(', ')', '^', '.', '√', 'ln', 'lg', '%'].map(function (k) {
        return '<button onclick="TIDM.cfRaw(\'' + k.replace(/'/g, "\\'") + '\')">' + k + '</button>'; }).join('') + '</span></span></div></div>';
  }
  function setFormula(v) { M._cf.expr.formula = v; var f = $('mcF'); if (f) f.value = v; }
  M.cfType = function (v) { M._cf.calcType = v; calcModal(); };
  M.cfBind = function (v) { M._cf.expr.binding = v; calcModal(); };
  M.cfStat = function (k, v) { M._cf.stat[k] = v; };
  M.cfTest = function (v) { M._cftest = v; calcModal(); };
  M.cfIns = function (sel) { var e = $(sel.slice(1)); if (e && e.value) setFormula((M._cf.expr.formula || '') + e.value); };
  M.cfInsRaw = function (sel) { var e = $(sel.slice(1)); if (e && e.value.trim()) setFormula((M._cf.expr.formula || '') + e.value.trim()); };
  M.cfRaw = function (k) { setFormula((M._cf.expr.formula || '') + k); };
  M.cfExp = function () { var e = $('mcE'); if (e && e.value.trim()) setFormula((M._cf.expr.formula || '') + '^(' + e.value.trim() + ')'); };
  M.cfBack = function () { setFormula(String(M._cf.expr.formula || '').slice(0, -1)); };
  M.cfClear = function () { setFormula(''); };
  M.cfOk = function () {
    var p = M._cf;
    if (p.calcType === '汇总统计型' && !p.stat.source) { U.toast('请选择数据源'); return; }
    if (p.calcType === '算术表达式型' && !p.expr.formula) { U.toast('计算公式不能为空'); return; }
    if (p.calcType === '算术表达式型' && p.expr.binding === '实测值测量次数') {
      U.toast('数组运算要求参与计算的实测值测量次数一致，本原型未做跨参数校验（真实系统会阻断保存）');
    }
    var tgt = groups('c')[CC.gi].params[CC.pi];
    ['calcType', 'stat', 'expr'].forEach(function (k) { tgt[k] = clone(p[k]); });
    var h = U.host(); while (h.children.length > 1) h.removeChild(h.lastChild);
    reRender();
  };

  /* ── 接管：子 Tab 切换与抽屉打开 ── */
  var _switch = TID.switchTab;
  TID.switchTab = function (t) {
    if (t === 'param' && (global.TIDP.sub === 'meas' || global.TIDP.sub === 'calc')) {
      TID.state._lastKind = global.TIDP.sub === 'meas' ? 'm' : 'c';
      _switch.call(TID, t); renderInto(TID.state._lastKind); return;
    }
    _switch.call(TID, t);
  };
  var _open = TID.open;
  TID.open = function (i) {
    _open.call(TID, i);
    TID.state._lastKind = 'm'; M.openSubs = {}; M._cftest = '';
  };
  // 让控制/测量/计算三个子 Tab 在抽屉里互通
  var _setSub = global.TIDP.setSub;
  global.TIDP.setSub = function (s) {
    if (s === 'ctrl') { global.TIDP.sub = 'ctrl'; _setSub(s); return; }
    global.TIDP.sub = s; TID.state._lastKind = s === 'meas' ? 'm' : 'c'; renderInto(TID.state._lastKind);
  };
})(typeof window !== 'undefined' ? window : globalThis);
