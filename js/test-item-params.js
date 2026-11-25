/**
 * 试验项抽屉 · 第二个 Tab「试验参数」——控制参数（预设值）
 *
 * 严格对齐真实系统截图：列表 + 筛选 + 新增/编辑预设值弹窗 + 5 种映射类型
 * （离散 / 区间 / 连续 / 组合 / 条件）+ 添加规则弹窗 + 编辑修约规则弹窗。
 * 测量参数 / 计算参数 两个子 Tab 本轮未做，留占位（等下一批截图）。
 *
 * 依赖 js/test-item-drawer.js 暴露的 window.TID。
 */
(function (global) {
  'use strict';
  var TID = global.TID;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ── 枚举 ───────────────────────────────────────────────────────── */
  var MAP_TYPES = ['离散映射', '区间映射', '连续映射', '条件映射', '组合映射'];
  var ROUND_MODES = ['四舍五入', '四舍六入五成双', '全进位（向上取整）', '全舍弃（向零取整/截断）', '指定间隔修约', '直接取值'];
  var ROUND_HELP = {
    '四舍五入': '传统算法：拟舍数字&lt;5舍去，≥5进一',
    '四舍六入五成双': '国标推荐算法：拟舍数字&lt;5舍去，&gt;5进一，=5时看保留末尾奇偶（奇进偶舍）',
    '全进位（向上取整）': '向正无穷方向取整：只要舍弃部分有非零数字即进位',
    '全舍弃（向零取整/截断）': '向零方向取整（截断）：直接舍去所有多余数字',
    '指定间隔修约': '按指定间隔修约：结果为间隔值的整数倍',
    '直接取值': '直接取值：直接取值为指定数字'
  };
  var INTERVALS = ['0.01', '0.02', '0.05', '0.1', '0.2', '0.5', '1', '5'];
  var OPS_NUM = ['=', '!=', '<', '≤', '>', '≥', 'in', 'not in', 'between', 'is null', 'is not null'];
  var OPS_TEXT = ['包含', '不包含', '是', '不是'];
  var OPS_ENUM = ['包含', '不包含'];
  var VAR_KINDS = ['规格参数', '预设值', '实测值', '计算值', '标称值'];
  var LOGIC = ['当满足所有条件时', '当满足任一条件时'];

  /* ── 参数池：自变量候选（真实系统来自各试验项已保存的参数） ───────── */
  var PARAM_POOL = {
    '结构尺寸检查': {
      measured: ['导体单丝根数(根)', '导体直径(mm)', '搭盖宽度 3(mm)', '铜带宽度 2(mm)', '绝缘各测量点厚度(mm)', '导体结构', '铜带厚度(mm)', '铜带宽度 1(mm)'],
      computed: ['导体单丝平均直径(mm)', '绝缘厚度最小值(mm)', '绝缘厚度平均值(mm)', '偏心率(%)', '搭盖率平均值(%)'],
      preset: ['导体假设直径(mm)', '线缆成缆系数', '屏蔽总厚度(mm)', '金属屏蔽层直径增量(mm)']
    },
    '导体直流电阻': {
      measured: ['导体直流电阻实测值(Ω/km)', '试验温度(℃)', '试样长度(m)'],
      computed: ['20℃换算电阻值(Ω/km)', '电阻温度修正系数'],
      preset: ['电阻温度系数 α(1/℃)', '20℃标准电阻值(Ω/km)']
    }
  };
  function poolFor(testName) {
    return PARAM_POOL[testName] || { measured: ['实测参数 1(mm)', '实测参数 2(mm)'], computed: ['计算参数 1(%)'], preset: ['预设参数 1'] };
  }

  /* ── 演示种子：与真实系统截图 / 参数配置文档一致 ─────────────────── */
  var SEED = {
    '结构尺寸检查': [
      { name: '导体假设直径', subItem: '导体', symbol: 'd_L', unit: 'mm', show: true, sort: 3, remark: '',
        mappingOn: true, mappingType: '离散映射',
        vars: { spec: ['导体标称截面积S(mm²)'], preset: { test: '', params: [] }, measured: { test: '', params: [] }, computed: { test: '', params: [] } },
        rows: [['25', '5.6'], ['35', '6.7'], ['50', '8.0'], ['70', '9.4'], ['95', '11.0'], ['120', '12.4'],
               ['150', '13.8'], ['185', '15.3'], ['240', '17.5'], ['300', '19.5']] },
      { name: '线缆成缆系数', subItem: '导体', symbol: 'K', unit: '', show: true, sort: 4, remark: '',
        mappingOn: false, fixedValue: '2.16', rows: [] },
      { name: '屏蔽总厚度', subItem: '金属屏蔽', symbol: 't_s_total', unit: 'mm', show: true, sort: 5, remark: '',
        mappingOn: false, fixedValue: '1', rows: [] },
      { name: '金属屏蔽层直径增量', subItem: '金属屏蔽', symbol: 'Δd_S', unit: 'mm', show: true, sort: 7, remark: '',
        mappingOn: true, mappingType: '离散映射',
        vars: { spec: ['导体标称截面积S(mm²)'], preset: { test: '', params: [] }, measured: { test: '', params: [] }, computed: { test: '', params: [] } },
        rows: [['25', '0.2'], ['35', '0.2'], ['50', '0.3']] }
    ],
    '导体直流电阻': [
      { name: '电阻温度系数 α', symbol: 'α', unit: '1/℃', show: true, sort: 1, remark: '铜 0.00393 / 铝 0.00403',
        mappingOn: false, fixedValue: '0.00393', rows: [] }
    ]
  };

  function blank() {
    return { name: '', unit: '', symbol: '', subItem: '', show: true,
      mappingOn: true, mappingType: '离散映射', outOfRange: '返回边界值', remark: '', sort: '',
      fixedValue: '', rules: [],
      vars: { spec: [], preset: { test: '', params: [] }, measured: { test: '', params: [] }, computed: { test: '', params: [] } },
      rows: [] };
  }

  /* ── 修约引擎（十进制安全，结果与截图一致） ─────────────────────── */
  function shift(n, d) { return Number(n + 'e' + d); }
  function roundBy(v, cfg) {
    if (v === '' || v == null || isNaN(Number(v))) return '';
    var neg = Number(v) < 0, n = Math.abs(Number(v));
    var mode = cfg.mode, out;
    if (mode === '直接取值') {
      out = cfg.direct === '' || cfg.direct == null ? '' : Number(cfg.direct);
      if (out === '') return '';
    } else if (mode === '指定间隔修约') {
      var iv = Number(cfg.interval || 0.01);
      out = Number((Math.round(n / iv) * iv).toPrecision(12));
    } else {
      var d = Number(cfg.digits == null ? 2 : cfg.digits);
      var s = shift(n, d), fl = Math.floor(s), fr = s - fl;
      if (mode === '四舍五入') out = Math.round(s);
      else if (mode === '全进位（向上取整）') out = Math.ceil(s);
      else if (mode === '全舍弃（向零取整/截断）') out = fl;
      else { // 四舍六入五成双：=5 且 5 后无数字 → 看奇偶；5 后有非 0 数字 → 进一
        var tail = String(shift(n, d)).split('.')[1] || '';
        var isHalf = fr === 0.5 && /^50*$/.test(tail);
        if (isHalf) out = (fl % 2 === 0) ? fl : fl + 1;
        else out = fr > 0.5 ? fl + 1 : fl;
      }
      out = Number(shift(out, -d));
    }
    return neg ? -out : out;
  }

  /* ── 规格参数：从当前型号 / 样品解析出可选项 ─────────────────────── */
  function specList() {
    var ctx = TID.ctx, s = ctx.sample || {}, out = [];
    var src = (ctx.model && ctx.model.specs) ? ctx.model.specs : (s.sampleSpecs || []);
    (src || []).forEach(function (sp) {
      var title = sp.title || (sp.name ? sp.name + (sp.symbol ? sp.symbol : '') : '');
      var name = title.replace(/^规格参数\d+:/, '').replace(/\s+/g, '');
      if (!name) return;
      out.push({ name: name, options: sp.options || [] });
    });
    if (!out.length) {
      out = [{ name: '导体标称截面积S(mm²)', options: ['25', '35', '50', '70', '95', '120', '150', '185', '240', '300', '400', '500', '630', '800', '1000'] },
             { name: '额定电压Uo/U(Um)(kV)', options: ['8.7/10'] }];
    }
    return out;
  }
  function testList() {
    var t = (TID.ctx && TID.ctx.model ? TID.ctx.model.tests : (TID.ctx && TID.ctx.sample ? TID.ctx.sample.tests : [])) || [];
    return t.map(function (x) { return x.name; }).filter(Boolean);
  }
  function subItemList() {
    var st = TID.state || {};
    return (st.subItems || []).map(function (s) { return s.name; }).filter(Boolean);
  }
  function allVars() {
    var v = cur().vars, out = [];
    v.spec.forEach(function (n) { out.push({ kind: '规格参数', label: n }); });
    [['preset', '预设值'], ['measured', '实测值'], ['computed', '计算值']].forEach(function (p) {
      (v[p[0]].params || []).forEach(function (n) { out.push({ kind: p[1], label: n }); });
    });
    return out;
  }

  var P = { list: [], idx: -1, draft: null, sub: 'ctrl', page: 1, mpage: 1, _rin: '7.325', _rout: '', q: { name: '', symbol: '' } };
  global.TIDP = P;

  function normalize(r) {
    var d = blank();
    Object.keys(d).forEach(function (k) { if (r[k] === undefined) r[k] = d[k]; });
    if (!r.vars) r.vars = d.vars;
    ['preset', 'measured', 'computed'].forEach(function (k) {
      if (!r.vars[k]) r.vars[k] = { test: '', params: [] };
      if (!r.vars[k].params) r.vars[k].params = [];
    });
    if (!r.spec) r.spec = [];
    if (!r.rules) r.rules = [];
    if (!r.rows) r.rows = [];
    if (r.mappingType === undefined) r.mappingType = d.mappingType;
    return r;
  }

  function cur() { return P.draft; }
  function store() {
    var t = TID.state;
    if (!t.controls) t.controls = null;
    return t.controls || (t.controls = []);
  }

  /* ══════════════ Tab：试验参数 ══════════════ */
  function renderTab() {
    var body = $('tidBody');
    var subs = [['ctrl', '控制参数'], ['meas', '测量参数'], ['calc', '计算参数']];
    var head =
      '<div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:8px">试验项控制参数（预设值）</div>' +
      '<p style="font-size:12px;color:#94a3b8;line-height:1.8;margin:0 0 16px">在试验开始前需预先设定与该试验项有关的关键样品参数或试验参数（一般用于计算参数的计算），' +
      '用于确保试验条件符合标准要求，并保障结果的可重复性与有效性。请根据对应产品标准或试验规程准确配置。</p>' +
      '<div class="pm-subs">' + subs.map(function (s) {
        return '<span class="pm-sub' + (P.sub === s[0] ? ' active' : '') + '" onclick="TIDP.setSub(\'' + s[0] + '\')">' + s[1] + '</span>';
      }).join('') + '</div>';
    if (P.sub !== 'ctrl') {
      body.innerHTML = head + '<div class="tid-soon"><i class="fa fa-flask"></i><b>' +
        (P.sub === 'meas' ? '测量参数（实测值）' : '计算参数（计算值）') + ' 待补</b>' +
        '类型 / 可选项 / 测量次数 / 修约规则 / 计算公式 / 绑定层级——等下一批截图后按同一套弹窗实现。</div>';
      return;
    }
    var list = store();
    var rows = list.filter(function (r) {
      return (!P.q.name || (r.name || '').indexOf(P.q.name) >= 0) && (!P.q.symbol || (r.symbol || '').indexOf(P.q.symbol) >= 0);
    });
    var hasSub = subItemList().length > 0;
    var cols = ['名称', hasSub ? '试验子项' : null, '符号', '值', '试验检测显示', '排序', '备注', '操作'].filter(Boolean);
    body.innerHTML = head +
      '<div class="pm-bar">' +
      '<label>预设值名称：</label><input type="text" id="pmQ1" value="' + esc(P.q.name) + '" placeholder="请输入" />' +
      '<label>预设值符号：</label><input type="text" id="pmQ2" value="' + esc(P.q.symbol) + '" placeholder="请输入" />' +
      '<button class="btn-save" onclick="TIDP.query()">查 询</button>' +
      '<button class="btn-outline" onclick="TIDP.reset()">重 置</button>' +
      '<button class="btn-primary pm-add" onclick="TIDP.openEdit(-1)"><i class="fa fa-plus"></i> 试验项预设值</button>' +
      '</div>' +
      '<table class="data-table pm-table"><thead><tr>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (r, i) {
        var real = list.indexOf(r);
        var valCell = r.mappingOn
          ? '<span class="pm-map" onmouseenter="TIDP.peek(event,' + real + ')" onmouseleave="TIDP.peekOut()">' + esc(r.mappingType) + '</span>'
          : esc(r.fixedValue);
        return '<tr>' +
          '<td>' + esc(r.name) + '</td>' +
          (hasSub ? '<td>' + esc(r.subItem) + '</td>' : '') +
          '<td>' + esc(r.symbol) + '</td>' +
          '<td>' + valCell + '</td>' +
          '<td><label class="toggle"><input type="checkbox" ' + (r.show ? 'checked' : '') + ' onchange="TIDP.toggleShow(' + real + ',this.checked)" /><span class="toggle-slider"></span></label></td>' +
          '<td>' + esc(r.sort) + '</td>' +
          '<td>' + esc(r.remark) + '</td>' +
          '<td class="whitespace-nowrap"><a class="link mr-2" onclick="TIDP.openEdit(' + real + ')"><i class="fa fa-pencil"></i> 编辑</a>' +
          '<a class="link danger" onclick="TIDP.del(' + real + ')"><i class="fa fa-trash"></i> 删除</a></td></tr>';
      }).join('') : '<tr><td colspan="' + cols.length + '"><div class="empty-table"><i class="fa fa-inbox"></i>暂无数据</div></td></tr>') +
      '</tbody></table>' +
      (rows.length ? '<div class="pager"><span>共' + rows.length + '条</span><span class="pg active">1</span><select class="rounded border border-slate-200 px-2 py-1 text-xs"><option>10条/页</option></select></div>' : '');
  }
  TID.renderParams = renderTab;

  P.setSub = function (s) { P.sub = s; renderTab(); };
  P.query = function () { P.q.name = $('pmQ1').value.trim(); P.q.symbol = $('pmQ2').value.trim(); renderTab(); };
  P.reset = function () { P.q = { name: '', symbol: '' }; renderTab(); };
  P.toggleShow = function (i, v) { store()[i].show = v; };
  P.del = function (i) {
    if (!confirm('确认删除预设值「' + store()[i].name + '」？')) return;
    store().splice(i, 1); renderTab();
  };
  P.peek = function (ev, i) {
    var r = store()[i], box = document.createElement('div');
    box.className = 'pm-pop'; box.id = 'pmPeek';
    var head = allVarsOf(r).map(function (v) { return '<th>' + esc(v.label) + '</th>'; }).join('');
    box.innerHTML = '<div class="pm-pop-t">' + esc(r.mappingType) + ' · ' + esc(r.name) + '</div>' +
      '<table><thead><tr>' + head + '<th>' + esc(r.name + (r.symbol || '')) + (r.unit ? '(' + r.unit + ')' : '') + '</th></tr></thead><tbody>' +
      (r.rows || []).slice(0, 8).map(function (row) {
        return '<tr>' + row.slice(0, -1).map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') +
          '<td><b>' + esc(row[row.length - 1]) + '</b></td></tr>';
      }).join('') + '</tbody></table>' +
      ((r.rows || []).length > 8 ? '<div class="pm-pop-m">仅预览前 8 行，共 ' + r.rows.length + ' 行</div>' : '');
    document.body.appendChild(box);
    var b = ev.target.getBoundingClientRect();
    box.style.left = Math.max(8, b.left) + 'px';
    box.style.top = (b.bottom + 6) + 'px';
  };
  P.peekOut = function () { var e = $('pmPeek'); if (e) e.remove(); };
  function allVarsOf(r) {
    var out = [];
    r.vars.spec.forEach(function (n) { out.push({ kind: '规格参数', label: n }); });
    ['preset', 'measured', 'computed'].forEach(function (k) {
      (r.vars[k].params || []).forEach(function (n) { out.push({ kind: k, label: n }); });
    });
    return out;
  }

  /* ══════════════ 新增 / 编辑 试验预设值 ══════════════ */
  P.openEdit = function (i) {
    var list = store();
    P.idx = i;
    P.draft = normalize(i >= 0 ? clone(list[i]) : blank());
    if (i < 0) { var subs = subItemList(); if (subs.length) P.draft.subItem = subs[0]; }
    P.mpage = 1;
    P.ensureRowWidth();
    renderModal();
  };
  P.closeEdit = function () { var h = host(); while (h.firstChild) h.removeChild(h.firstChild); P.draft = null; };

  P.ensureRowWidth = function () {
    var d = cur();
    if (d.mappingType === '条件映射') return;
    var n = allVarsOf(d).length + 1;   // 自变量列 + 因变量列
    if (!d.rows.length) d.rows = [new Array(n).fill('')];
    d.rows = d.rows.map(function (r) {
      var out = r.slice(0, n);
      while (out.length < n) out.push('');
      return out;
    });
  };

  /* 三层弹窗统一挂在 #pmLayers 容器里，按位置（而非 id）分层，
   * 重绘某层时只清掉它自己及更上层——连点或 alert 打断都不会叠出两层。 */
  var Z = [90, 100, 110];
  function host() {
    var h = $('pmLayers');
    if (!h) { h = document.createElement('div'); h.id = 'pmLayers'; document.body.appendChild(h); }
    return h;
  }
  function topMask() { var h = host(); return h.lastElementChild; }
  function modalShell(title, inner, onOk, okLabel, layer) {
    var h = host(), li = layer || 0;
    while (h.children.length > li) h.removeChild(h.lastChild);
    var wrap = document.createElement('div');
    wrap.className = 'pm-mask'; wrap.setAttribute('data-layer', String(li));
    wrap.style.zIndex = String(Z[li]);
    wrap.innerHTML = '<div class="pm-box" role="dialog" aria-modal="true">' +
      '<div class="pm-h"><h4>' + title + '</h4><button class="tid-close" onclick="TIDP.closeTop()">✕</button></div>' +
      '<div class="pm-b">' + inner + '</div>' +
      '<div class="pm-f"><button class="btn-outline" onclick="TIDP.closeTop()">取 消</button>' +
      '<button class="btn-save" onclick="' + (onOk || 'TIDP.saveEdit()') + '">' + (okLabel || '确 定') + '</button></div></div>';
    h.appendChild(wrap);
  }
  P.closeTop = function () {
    var h = host(), top = h.lastElementChild;
    if (!top) return;
    var li = Number(top.getAttribute('data-layer'));
    h.removeChild(top);
    if (li <= 0) { P.draft = null; return; }          // 关的是预设值弹窗本体
    if (li === 2 && h.children.length === 2) openRuleModal(TIDP._rule);
  };

  function fitem(lab, req, ctl, w) {
    return '<div class="pm-fi' + (w ? ' ' + w : '') + '"><span class="pm-lab' + (req ? ' req' : '') + '">' + lab + '：</span><span class="pm-ctl">' + ctl + '</span></div>';
  }
  function txt(key, val, ph) {
    return '<input type="text" value="' + esc(val) + '" placeholder="' + (ph || '请输入') + '" oninput="TIDP.setD(\'' + key + '\',this.value)" />';
  }
  function sw(key, val) {
    return '<label class="toggle"><input type="checkbox" ' + (val ? 'checked' : '') + ' onchange="TIDP.setD(\'' + key + '\',this.checked)" /><span class="toggle-slider"></span></label>';
  }
  function sel(key, val, opts, ph, onchange) {
    return '<select ' + (onchange ? 'onchange="' + onchange + '"' : 'onchange="TIDP.setD(\'' + key + '\',this.value)"') + '>' +
      '<option value="">' + (ph || '请选择') + '</option>' +
      opts.map(function (o) { var v = typeof o === 'string' ? o : o.v, l = typeof o === 'string' ? o : o.l;
        return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
  }

  function varPanel() {
    var d = cur(), specs = specList();
    var single = d.mappingType !== '组合映射';
    var rows =
      '<div class="pm-vrow"><span class="pm-vlab">规格参数：</span><span class="pm-vbox">' +
      specs.map(function (sp) {
        var on = d.vars.spec.indexOf(sp.name) >= 0;
        return '<label class="pm-ck"><input type="' + (single ? 'radio' : 'checkbox') + '" name="pmVar" ' + (on ? 'checked' : '') +
          ' onchange="TIDP.pickSpec(\'' + esc(sp.name) + '\',this.checked)" />' + esc(sp.name) + '</label>';
      }).join('') + '</span></div>';
    [['preset', '预设值'], ['measured', '实测值'], ['computed', '计算值']].forEach(function (p) {
      var v = d.vars[p[0]];
      rows += '<div class="pm-vrow"><span class="pm-vlab">' + p[1] + '：</span><span class="pm-vbox">' +
        '<select class="pm-vtest" onchange="TIDP.varTest(\'' + p[0] + '\',this.value)">' +
        '<option value="">' + (v.test ? esc(v.test) : '请选择试验项') + '</option>' +
        testList().map(function (t) { return '<option' + (t === v.test ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') +
        '</select>' +
        '<select class="pm-vpick" ' + (v.test ? '' : 'disabled') + ' onchange="TIDP.varPick(\'' + p[0] + '\',this.value)">' +
        '<option value="">请选择</option>' +
        (v.test ? poolFor(v.test)[p[0]].map(function (n) {
          return '<option value="' + esc(n) + '"' + ((v.params || []).indexOf(n) >= 0 ? ' selected' : '') + '>' + esc(n) + '</option>';
        }).join('') : '') + '</select>' +
        '<span class="pm-vtags">' + (v.params || []).map(function (n) {
          return '<span class="tid-tag"><span>' + esc(n) + '</span><i class="fa fa-times" onclick="TIDP.varUnpick(\'' + p[0] + '\',\'' + esc(n) + '\')"></i></span>';
        }).join('') + '</span></span></div>';
    });
    return '<div class="pm-vars"><div class="pm-vhead"><span class="req">*</span> 请勾选自变量：</div>' + rows + '</div>';
  }

  function mapTable() {
    var d = cur(), vars = allVarsOf(d);
    if (!vars.length) return '<div class="pm-need">请先勾选至少一个自变量</div>';
    var varCols = d.mappingType === '组合映射' ? vars : vars.slice(0, 1);
    var head = d.mappingType === '区间映射'
      ? '<th>范围下限（闭区间）</th><th>范围上限（闭区间）</th>'
      : varCols.map(function (v) { return '<th><span class="req">*</span> ' + esc(v.label) + '</th>'; }).join('');
    var dep = '<th id="pmDepTh">' + esc((d.name || '') + (d.symbol || '')) + (d.unit ? '(' + esc(d.unit) + ')' : '') + '</th>';
    var per = 10, total = Math.max(1, Math.ceil(d.rows.length / per));
    if (P.mpage > total) P.mpage = total;
    var page = d.rows.slice((P.mpage - 1) * per, P.mpage * per);
    var specFirst = varCols[0] && varCols[0].kind === '规格参数' ? specOptions(varCols[0].label) : null;

    function cell(v, ri, ci, opts) {
      var call = 'TIDP.setRow(' + ri + ',' + ci + ',this.value)';
      if (opts) {
        return '<td><select onchange="' + call + '"><option value="">请选择</option>' +
          opts.map(function (o) { return '<option' + (String(o) === String(v) ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></td>';
      }
      return '<td><input type="text" value="' + esc(v) + '" placeholder="请输入" oninput="' + call + '" /></td>';
    }
    var rows = page.map(function (r, rpi) {
      var ri = (P.mpage - 1) * per + rpi, cells = '';
      if (d.mappingType === '区间映射') {
        cells = cell(r[0], ri, 0) + cell(r[1], ri, 1) + cell(r[2], ri, 2);
      } else {
        var n = varCols.length;
        for (var ci = 0; ci < n; ci++) cells += cell(r[ci], ri, ci, (ci === 0 && specFirst) ? specFirst : null);
        cells += cell(r[n], ri, n);
      }
      return '<tr>' + cells + '<td class="pm-op"><span class="op-del" onclick="TIDP.delRow(' + ri + ')">\u2212</span></td></tr>';
    }).join('');
    var span = (d.mappingType === '区间映射' ? 3 : varCols.length + 1) + 1;
    var pg = '<div class="pager" style="margin-top:8px">' +
      '<span class="pg" onclick="TIDP.page(-1)">\u2039</span>' +
      Array.apply(null, Array(total)).map(function (_, i) {
        return '<span class="pg' + (P.mpage === i + 1 ? ' active' : '') + '" onclick="TIDP.goto(' + (i + 1) + ')">' + (i + 1) + '</span>';
      }).join('') +
      '<span class="pg" onclick="TIDP.page(1)">\u203a</span></div>';
    return '<div class="pm-mapwrap"><table class="data-table pm-maptable"><thead><tr>' + head + dep +
      '<th class="pm-op">操作<span class="op-add" onclick="TIDP.addRow()">\uff0b</span></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="' + span + '"><div class="tid-locked" style="padding:14px;text-align:center">请至少配置一行映射数据</div></td></tr>') +
      '</tbody></table>' + pg + '</div>';
  }

  function specOptions(name) {
    var hit = specList().filter(function (s) { return s.name === name; })[0];
    return hit && hit.options.length ? hit.options : null;
  }

  function ruleBlock() {
    var d = cur();
    if (!d.rules.length) return '<div class="pm-rules"><span class="pm-lab req">规则：</span><a class="link" onclick="TIDP.addRule()"><i class="fa fa-plus"></i> 规则</a></div>';
    return '<div class="pm-rules"><span class="pm-lab req">规则：</span><a class="link" onclick="TIDP.addRule()"><i class="fa fa-plus"></i> 规则</a></div>' +
      '<div class="pm-rulelist">' + d.rules.map(function (r, i) {
        return '<div class="pm-rule"><div class="pm-rule-h"><b>规则 ' + (i + 1) + '</b>' +
          '<a class="link mr-2" onclick="TIDP.editRule(' + i + ')"><i class="fa fa-pencil"></i> 编辑</a>' +
          '<a class="link danger" onclick="TIDP.delRule(' + i + ')"><i class="fa fa-trash"></i> 删除</a></div>' +
          '<div class="pm-rule-b"><span class="pm-k">如果</span>' + esc(r.logic) + '：' +
          r.ifs.map(function (c) { return '[' + [c.test, c.kind, c.varName, c.op, c.target].filter(Boolean).join(' ') + ']'; }).join(' 且 ') +
          '<br><span class="pm-k">则</span>' + esc(r.thenVar) + ' = ' + esc(r.thenMode) + (r.thenMode === '固定值' ? ' ' + esc(r.thenValue) : '') +
          (r.round && r.round.mode ? '（修约：' + esc(r.round.mode) + '）' : '') + '</div></div>';
      }).join('') + '</div>';
  }

  function renderModal() {
    var d = cur(); if (!d) return;
    var subs = subItemList();
    var inner =
      '<div class="pm-grid">' +
      fitem('名称', true, txt('name', d.name)) + fitem('单位', false, txt('unit', d.unit)) + fitem('符号', false, txt('symbol', d.symbol)) +
      fitem('试验检测显示', false, sw('show', d.show)) +
      (subs.length ? fitem('试验子项', true, '<select onchange="TIDP.setD(\'subItem\',this.value)"><option value="">请选择</option>' +
        subs.map(function (s) { return '<option' + (s === d.subItem ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>') : '') +
      '</div>' +
      '<div class="pm-divide">试验预设值配置区域</div>' +
      '<div class="pm-grid"><div class="pm-fi pm-wide">' + fitemInline('是否开启映射配置', false, sw('mappingOn', d.mappingOn)) + '</div></div>' +
      (d.mappingOn ? renderMapping() : '<div class="pm-grid">' + fitem('固定值', true, txt('fixedValue', d.fixedValue)) +
        fitem('备注', false, txt('remark', d.remark)) + fitem('排序', false, txt('sort', d.sort)) + '</div>');
    modalShell(P.idx >= 0 ? '编辑试验预设值' : '新增试验预设值', inner, 'TIDP.saveEdit()', '确 定', 0);
  }

  function fitemInline(lab, req, ctl) {
    return '<span class="pm-lab' + (req ? ' req' : '') + '">' + lab + '：</span><span class="pm-ctl">' + ctl + '</span>';
  }

  function renderMapping() {
    var d = cur();
    var row1 = '<div class="pm-grid">' +
      fitem('映射类型', true, '<select onchange="TIDP.setMap(this.value)">' + MAP_TYPES.map(function (m) {
        return '<option' + (m === d.mappingType ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>') +
      (d.mappingType === '连续映射' ? fitem('超出范围处理', true, '<span class="pm-rr">' +
        ['返回边界值', '报错'].map(function (o) { return '<label><input type="radio" name="pmOOR" value="' + o + '"' +
          (o === d.outOfRange ? ' checked' : '') + ' onchange="TIDP.setD(\'outOfRange\',this.value)" />' + o + '</label>'; }).join('') + '</span>') : '') +
      fitem('备注', false, txt('remark', d.remark)) +
      fitem('排序', false, txt('sort', d.sort)) +
      '</div>';
    if (d.mappingType === '条件映射') {
      return row1.replace('</div>', '</div>') + ruleBlock();
    }
    var tip = d.mappingType === '连续映射'
      ? '<div class="pm-tip"><i class="fa fa-info-circle"></i> <b>线性插值：</b>它通过连接两个相邻的数据点形成一条直线，并在这条直线上找到所需的估计值。适用于变化相对平稳的数据集，不需要考虑复杂的曲线拟合。</div>'
      : '';
    return row1 + tip + varPanel() + mapTable();
  }

  function depHeader() {
    var d = cur(), th = $('pmDepTh');
    if (th) th.textContent = (d.name || '') + (d.symbol || '') + (d.unit ? '(' + d.unit + ')' : '');
  }
  P.setD = function (k, v) {
    var d = cur(); d[k] = v;
    if (k === 'mappingOn') { P.ensureRowWidth(); renderModal(); }
    else if (k === 'name' || k === 'symbol' || k === 'unit') depHeader();
  };
  P.setMap = function (m) {
    var d = cur(); d.mappingType = m;
    if (m === '组合映射') {
      var n = allVarsOf(d).length;
      if (n < 2) { (global.toast || alert)('组合映射需勾选 2 个及以上自变量'); }
    } else if (allVarsOf(d).length > 1) {
      d.vars.spec = d.vars.spec.slice(0, 1);
      ['preset', 'measured', 'computed'].forEach(function (k) { d.vars[k].params = d.vars[k].params.slice(0, 1); });
    }
    P.ensureRowWidth(); renderModal();
  };
  P.pickSpec = function (name, on) {
    var d = cur();
    if (d.mappingType !== '组合映射') {
      d.vars.spec = on ? [name] : [];
      ['preset', 'measured', 'computed'].forEach(function (k) { d.vars[k].params = []; });
    } else {
      var i = d.vars.spec.indexOf(name);
      if (on && i < 0) d.vars.spec.push(name); else if (!on) d.vars.spec.splice(i, 1);
    }
    P.ensureRowWidth(); renderModal();
  };
  P.varTest = function (k, v) { var d = cur(); d.vars[k].test = v; d.vars[k].params = []; P.ensureRowWidth(); renderModal(); };
  P.varPick = function (k, v) {
    if (!v) return;
    var d = cur(), arr = d.vars[k];
    if (d.mappingType !== '组合映射') { arr.test = arr.test; arr.params = [v]; }
    else if (arr.params.indexOf(v) < 0) arr.params.push(v);
    P.ensureRowWidth(); renderModal();
  };
  P.varUnpick = function (k, v) {
    var d = cur(); d.vars[k].params = d.vars[k].params.filter(function (x) { return x !== v; });
    P.ensureRowWidth(); renderModal();
  };
  P.setRow = function (ri, ci, v) { cur().rows[ri][ci] = v; };
  P.addRow = function () {
    var d = cur(), n = d.mappingType === '区间映射' ? 3 : allVarsOf(d).length + 1;
    d.rows.push(new Array(n).fill(''));
    var total = Math.ceil(d.rows.length / 10); P.mpage = total; renderModal();
  };
  P.delRow = function (ri) {
    var d = cur(); if (d.rows.length === 1) { (global.toast || alert)('至少保留一行'); return; }
    d.rows.splice(ri, 1); renderModal();
  };
  P.page = function (dv) {
    var total = Math.max(1, Math.ceil(cur().rows.length / 10));
    P.mpage = Math.min(total, Math.max(1, P.mpage + dv)); renderModal();
  };
  P.goto = function (n) { P.mpage = n; renderModal(); };
  P.delRule = function (i) { cur().rules.splice(i, 1); renderModal(); };
  P.editRule = function (i) { P.ruleIdx = i; openRuleModal(cur().rules[i]); };
  P.addRule = function () { P.ruleIdx = -1; openRuleModal({ logic: '当满足所有条件时', ifs: [{ test: (TID.state && TID.state.name) || '' }], thenVar: cur().name, thenMode: '固定值', thenValue: '', round: { mode: '四舍五入', digits: 2, interval: '0.01', direct: '' } }); };

  P.saveEdit = function () {
    var d = cur(), miss = [];
    if (!d.name) miss.push('名称');
    if (subItemList().length && !d.subItem) miss.push('试验子项');
    if (d.mappingOn) {
      if (!allVarsOf(d).length) miss.push('自变量');
      if (d.mappingType === '组合映射' && allVarsOf(d).length < 2) miss.push('组合映射需 ≥2 个自变量');
      if (d.mappingType === '条件映射' && !d.rules.length) miss.push('规则');
    } else if (!d.fixedValue) miss.push('固定值');
    if (miss.length) { (global.toast || alert)('缺少必填项：' + miss.join('、')); return; }
    var list = store();
    if (P.idx >= 0) list[P.idx] = clone(d); else list.push(clone(d));
    P.closeEdit(); renderTab();
  };

  /* ══════════════ 添加规则（条件映射） ══════════════ */
  function openRuleModal(r) {
    var rr = clone(r);
    TIDP._rule = rr;
    var inner =
      '<div class="pm-sec"><span class="pm-lab req">如果：</span></div>' +
      '<div class="pm-ifbar"><select onchange="TIDP.ruleLogic(this.value)">' + LOGIC.map(function (l) {
        return '<option' + (l === rr.logic ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select>' +
      '<button class="btn-save" onclick="TIDP.ruleAddIf()"><i class="fa fa-plus"></i> 条件</button></div>' +
      '<div class="pm-iflist">' + rr.ifs.map(function (c, i) { return ifRow(c, i); }).join('') + '</div>' +
      '<div class="pm-sec" style="margin-top:18px"><span class="pm-lab req">则：</span></div>' +
      '<div class="pm-then">' +
      '<select onchange="TIDP.ruleSet(\'thenVar\',this.value)">' +
      '<option value="">请选择</option>' +
      [cur().name].concat(allVarsOf(cur()).map(function (v) { return v.label; })).map(function (n) {
        return '<option' + (n === rr.thenVar ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
      '<span class="pm-eq">=</span>' +
      '<select onchange="TIDP.ruleThenMode(this.value)"><option' + (rr.thenMode === '固定值' ? ' selected' : '') + '>固定值</option><option' + (rr.thenMode === '公式计算' ? ' selected' : '') + '>公式计算</option></select>' +
      (rr.thenMode === '固定值'
        ? '<input type="text" value="' + esc(rr.thenValue) + '" placeholder="请输入" oninput="TIDP.ruleSet(\'thenValue\',this.value)" />' +
          '<a class="link pm-ed" onclick="TIDP.ruleDelIf(-1)"><i class="fa fa-trash"></i> 删除</a>'
        : '<input type="text" value="' + esc(rr.formula || '') + '" placeholder="请输入" disabled />' +
          '<a class="link pm-ed" onclick="TIDP.toast(\'公式编辑器（算术表达式 / 汇总统计型）待下一批截图后补\')"><i class="fa fa-pencil"></i> 编辑</a>') +
      '</div>' +
      (rr.thenMode === '公式计算'
        ? '<div class="pm-then" style="margin-top:10px"><span class="pm-lab">修约规则：</span>' +
          '<input type="text" value="' + esc(rr.round && rr.round.mode ? rr.round.mode : '') + '" placeholder="" disabled />' +
          '<a class="link pm-ed" onclick="TIDP.openRound()"><i class="fa fa-pencil"></i> 编辑</a></div>'
        : '');
    modalShell('添加规则', inner, 'TIDP.ruleOk()', '确 定', 1);
  }
  function ifRow(c, i) {
    c.kind = c.kind || '';
    var pool = poolFor(c.test);
    var names = c.kind === '规格参数' ? specList().map(function (s) { return s.name; })
      : c.kind === '预设值' ? pool.preset : c.kind === '实测值' ? pool.measured
      : c.kind === '计算值' ? pool.computed : ['（先选类型）'];
    var ops = c.kind === '规格参数' || c.kind === '实测值' ? OPS_NUM : c.kind === '预设值' || c.kind === '计算值' ? OPS_ENUM : OPS_TEXT;
    return '<div class="pm-ifrow">' +
      '<select onchange="TIDP.ruleIf(' + i + ',\'test\',this.value)">' +
      testList().map(function (t) { return '<option' + (t === c.test ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<select onchange="TIDP.ruleIf(' + i + ',\'kind\',this.value)"><option value="">请选择类型</option>' +
      VAR_KINDS.map(function (k) { return '<option' + (k === c.kind ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>' +
      '<select onchange="TIDP.ruleIf(' + i + ',\'varName\',this.value)"><option value="">请选择</option>' +
      names.map(function (n) { return '<option' + (n === c.varName ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
      '<select onchange="TIDP.ruleIf(' + i + ',\'op\',this.value)"><option value="">请选择</option>' +
      ops.map(function (o) { return '<option' + (o === c.op ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>' +
      (c.op === 'is null' || c.op === 'is not null' ? '<span class="pm-none"></span>'
        : '<input type="text" value="' + esc(c.target || '') + '" placeholder="请输入" oninput="TIDP.ruleIf(' + i + ',\'target\',this.value)" />') +
      '<a class="link danger pm-ed" onclick="TIDP.ruleDelIf(' + i + ')"><i class="fa fa-trash"></i> 删除</a></div>';
  }
  TIDP.ruleSet = function (k, v) { TIDP._rule[k] = v; openRuleModal(TIDP._rule); };
  P.ruleLogic = function (v) { TIDP._rule.logic = v; openRuleModal(TIDP._rule); };
  function refreshRuleLayer() { openRuleModal(TIDP._rule); }
  P.ruleThenMode = function (v) { TIDP._rule.thenMode = v; openRuleModal(TIDP._rule); };
  P.ruleAddIf = function () { TIDP._rule.ifs.push({ test: (TID.state && TID.state.name) || '' }); openRuleModal(TIDP._rule); };
  P.ruleDelIf = function (i) {
    if (i < 0) { (global.toast || alert)('规则本身删除请在列表里操作'); return; }
    if (TIDP._rule.ifs.length === 1) { (global.toast || alert)('至少保留一个条件'); return; }
    TIDP._rule.ifs.splice(i, 1); openRuleModal(TIDP._rule);
  };
  P.ruleIf = function (i, k, v) {
    var c = TIDP._rule.ifs[i]; c[k] = v;
    if (k === 'target') return;                 // 文本输入：就地记录，不重绘
    if (k === 'op') { openRuleModal(TIDP._rule); return; }
    if (k === 'kind' || k === 'test') { c.varName = ''; c.op = ''; }
    openRuleModal(TIDP._rule);
  };
  P.ruleOk = function () {
    var r = TIDP._rule, bad = r.ifs.some(function (c) { return !c.kind || !c.varName || !c.op; });
    if (bad) { (global.toast || alert)('请补全「如果」里的类型、变量与对比符号'); return; }
    var d = cur();
    if (P.ruleIdx >= 0) d.rules[P.ruleIdx] = r; else d.rules.push(r);
    while (host().children.length > 1) host().removeChild(host().lastChild);
    renderModal();
  };

  /* ══════════════ 编辑修约规则 ══════════════ */
  P.openRound = function () {
    var r = TIDP._rule.round || (TIDP._rule.round = { mode: '四舍五入', digits: 2, interval: '0.01', direct: '' });
    var isInterval = r.mode === '指定间隔修约', isDirect = r.mode === '直接取值';
    var inner =
      '<div class="pm-divide">修约配置</div>' +
      '<div class="pm-round">' +
      '<div class="pm-rrow"><span class="pm-lab">修约方式：</span><select onchange="TIDP.setRound(\'mode\',this.value)">' +
      ROUND_MODES.map(function (m) { return '<option' + (m === r.mode ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>' +
      '<div class="pm-rhelp">' + ROUND_HELP[r.mode] + '</div>' +
      (isDirect
        ? '<div class="pm-rrow"><span class="pm-lab">直接取值为：</span><input type="text" value="' + esc(r.direct) + '" oninput="TIDP.setRound(\'direct\',this.value)" /></div>'
        : isInterval
        ? '<div class="pm-rrow"><span class="pm-lab">精度设置：</span><span class="pm-mut">修约间隔</span><select onchange="TIDP.setRound(\'interval\',this.value)">' +
          INTERVALS.map(function (v) { return '<option' + (v === r.interval ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></div>'
        : '<div class="pm-rrow"><span class="pm-lab">精度设置：</span><span class="pm-mut">保留小数位数</span>' +
          '<span class="tid-step"><button onclick="TIDP.setRound(\'digits\',' + (Number(r.digits) - 1) + ')">−</button>' +
          '<input type="text" value="' + esc(r.digits) + '" oninput="TIDP.setRound(\'digits\',this.value)" />' +
          '<button onclick="TIDP.setRound(\'digits\',' + (Number(r.digits) + 1) + ')">＋</button></span> 位</div>') +
      (isDirect ? '' : '<div class="pm-rrow"><span class="pm-lab">边界条件处理：</span>负数按绝对值修约（对称修约）' +
        '<input type="checkbox" class="flag" checked disabled title="系统强制，不可取消" /></div>') +
      '<div class="pm-divide" style="margin-top:14px">预览效果</div>' +
      '<div class="pm-rrow"><span class="pm-lab">输入值：</span><input type="text" id="pmRin" value="' + esc(P._rin) + '" oninput="TIDP.previewRound()" /></div>' +
      '<div class="pm-rrow"><span class="pm-lab">修约后：</span><input type="text" id="pmRout" value="' + esc(P._rout) + '" disabled /></div>' +
      '</div>';
    modalShell('编辑修约规则', inner, 'TIDP.roundOk()', '确 定', 2);
    P.previewRound();
  };
  P.setRound = function (k, v) {
    var r = TIDP._rule.round;
    if (k === 'digits') {
      // 步进按钮传数字（需要重绘数字框），手工输入传字符串（只刷新预览，避免丢焦点）
      r.digits = Math.max(0, Math.min(10, parseInt(v, 10) || 0));
      if (typeof v === 'number') { P.openRound(); return; }
    } else r[k] = v;
    if (k === 'mode') P.openRound(); else P.previewRound();
  };
  P.previewRound = function () {
    var i = $('pmRin'), o = $('pmRout'); if (!i || !o) return;
    P._rin = i.value;
    var v = roundBy(i.value, { mode: TIDP._rule.round.mode, digits: TIDP._rule.round.digits, interval: Number(TIDP._rule.round.interval), direct: TIDP._rule.round.direct });
    P._rout = v === '' ? '' : String(v);
    o.value = P._rout;
  };
  P.roundOk = function () {
    while (host().children.length > 2) host().removeChild(host().lastChild);
    openRuleModal(TIDP._rule);
  };
  P.toast = function (m) { (global.toast || alert)(m); };

  /* ── 挂到抽屉：Tab 切换时渲染；打开抽屉时按试验项装载 controls ── */
  var _switch = TID.switchTab, _open = TID.open;
  TID.switchTab = function (t) { _switch.call(TID, t); if (t === 'param') renderTab(); };
  TID.open = function (idx) {
    _open.call(TID, idx);
    var name = TID.state && TID.state.name;
    if (!TID.state.controls) TID.state.controls = name && SEED[name] ? clone(SEED[name]) : [];
    TID.state.controls.forEach(normalize);
    P.sub = 'ctrl'; P.q = { name: '', symbol: '' }; P._rin = '7.325'; P._rout = '';
    if (TID.tab === 'param') renderTab();
  };
})(typeof window !== 'undefined' ? window : globalThis);
