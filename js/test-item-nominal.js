/**
 * 试验项抽屉 · 标称值 / 结果判定 / 采集配置 三个 Tab
 * 对齐真实系统截图；依赖 TID（drawer）、TIDPU（共用工具）、TIDM（修约与公式编辑器）。
 */
(function (global) {
  'use strict';
  var TID = global.TID, U = global.TIDPU, TIDM = global.TIDM;
  var esc = U.esc, $ = U.$, clone = U.clone;

  var NOM_TYPES = ['单值', '公差', '范围', '最大值', '最小值', '公式'];
  var MIN_OPS = ['>', '≥'], MAX_OPS = ['<', '≤'];
  var CMP_OPS_NUM = ['=', '!=', '<', '≤', '>', '≥'];
  var CMP_OPS_CONFORM = ['符合'];
  /* 标称值对比：被对比标称值不是「单值」⇒ 不配修饰符且对比符号只能「符合」；
   * 是「单值」⇒ 放开 = != < ≤ > ≥，且不得选「符合」 */
  function cmpOpsFor(nomType) { return nomType === '单值' ? CMP_OPS_NUM : CMP_OPS_CONFORM; }
  var CONCL_LOGIC = ['当满足所有条件时', '当满足任一条件时', '不满足任一条件时', '不满足所有条件时'];
  var LEVELS = ['试样', '样段', '线芯', '试验'];
  /* 层级可用性由样品属性决定：样段要求「是否制样=是」，线芯要求「是否电缆=是」 */
  function levelBlock(m) {
    var st = TID.state || {};
    if (m === '样段' && !st.makeSample) return '样品「是否制样=否」，不存在样段';
    if (m === '线芯' && !(TID.ctx && TID.ctx.sample && TID.ctx.sample.isCable)) return '样品「是否电缆=否」，不存在线芯';
    return '';
  }
  var LEVEL_HINT = {
    '线芯': '每个相别各判一个结论（合格/不合格），3 芯即产出 3 条结论',
    '试验': '整个试验项只判一个结论',
    '试样': '按试样逐个判结论', '样段': '按样段逐个判结论'
  };

  function norm() { return (TID.state.subItems || []).map(function (s) { return s.name; }).filter(Boolean); }
  function hasSubs() { return norm().length > 0; }

  /* ══════════════ 一、标称值 ══════════════ */
  var SEED_N = {
    '结构尺寸检查': [
      { sub: '导体', items: [
        { name: '导体最少单线数量', symbol: '', unit: '根', remark: '', multi: true, type: '最小值',
          vars: [{ kind: '规格参数', label: '导体结构', mode: 'fixed' }, { kind: '规格参数', label: '导体标称截面积S(mm²)', mode: 'interval' }],
          rows: [['非紧压绞合圆形', { a: '25', b: '35' }, '7'], ['非紧压绞合圆形', { a: '50', b: '95' }, '19'],
                 ['非紧压绞合圆形', { a: '120', b: '240' }, '37'], ['非紧压绞合圆形', { a: '630', b: '1000' }, '91'],
                 ['紧压绞合圆形', { a: '25', b: '50' }, '6'], ['紧压绞合圆形', { a: '70', b: '95' }, '15'],
                 ['紧压绞合圆形', { a: '120', b: '150' }, '18'], ['紧压绞合圆形', { a: '150', b: '185' }, '30'],
                 ['紧压绞合圆形', { a: '240', b: '300' }, '34']] },
        { name: '导体最大直径（铜芯，实心/非紧压绞合）', symbol: '', unit: 'mm', remark: '', multi: true, type: '最大值',
          vars: [{ kind: '规格参数', label: '导体结构', mode: 'fixed' }, { kind: '规格参数', label: '导体标称截面积S(mm²)', mode: 'fixed' }],
          rows: ['实心导体|25|5.7|实心导体|35|6.7|实心导体|50|7.8|实心导体|70|9.4|实心导体|95|11.0|实心导体|120|12.4|实心导体|150|13.8|实心导体|185|15.4|实心导体|240|17.6|实心导体|300|19.8']
            .map(function (x) { return x.split('|'); }) }
      ] },
      { sub: '绝缘厚度测量', items: [
        { name: '绝缘标称厚度', symbol: '', unit: 'mm', remark: '', multi: false, type: '最小值', v: { minOp: '≥', min: '4.5' } },
        { name: '偏心率标称最大值', symbol: '', unit: '', remark: '', multi: false, type: '最大值', v: { maxOp: '≤', max: '0.15' } }
      ] },
      { sub: '金属屏蔽', items: [
        { name: '铜带标称厚度', symbol: '', unit: 'mm', remark: '', multi: false, type: '单值', v: { single: '0.10' } },
        { name: '铜带最小搭盖率', symbol: '', unit: '%', remark: '', multi: false, type: '最小值', v: { minOp: '≥', min: '5' } }
      ] }
    ]
  };

  function nomGroups() {
    var st = TID.state;
    if (!st.nominals) {
      var seed = SEED_N[st.name];
      st.nominals = seed ? clone(seed) : (hasSubs() ? norm().map(function (s) { return { sub: s, items: [] }; }) : [{ sub: '', items: [] }]);
    }
    return st.nominals;
  }
  var N = { rail: 0 };

  function railHtml(active, onChange, items) {
    if (!hasSubs()) return '';
    var root = (TID.state.name || '').slice(0, 7) + '…';
    return '<div class="nv-rail"><div class="nv-rail-t"><i class="nv-bar"></i>试验子项</div>' +
      '<div class="nv-root">' + esc(root) + '</div>' +
      norm().map(function (s, i) {
        return '<div class="nv-item' + (i === active ? ' on' : '') + '" onclick="' + onChange + '(' + i + ')">' + esc(s) + '</div>';
      }).join('') + '</div>';
  }

  /* 区间形态的自变量按国标写法渲染：25≤S≤35，中间取该规格的符号（取名称里最后一段拉丁字母） */
  function varSymbol(v) {
    var m = String((v && v.label) || '').match(/([A-Za-z]+)(?:\(|（|$)/);
    return m ? m[1] : 'X';
  }
  function cellText(c, varDef) {
    if (c && typeof c === 'object') return (c.a || '') + '≤' + varSymbol(varDef) + '≤' + (c.b || '');
    return c == null ? '' : String(c);
  }
  /* 图1-图6：多行映射下因变量列随标称值类型变化
   *  单值 → 一列（列头留空）；公差 → 基准单值 / (-) 负偏差 / (+) 正偏差；
   *  范围 → 最小值 + 最大值（各带比较符号）；最大值 / 最小值 → 一列（带比较符号）；
   *  公式 → 系统明确禁止开启多行映射 */
  var DEP_COLS = {
    '单值': [{ k: 'v', h: '' }],
    '公差': [{ k: 'v', h: '基准单值' }, { k: 'v', h: '(-) 负偏差' }, { k: 'v', h: '(+) 正偏差' }],
    '范围': [{ k: 'op', h: '最小值', ops: MIN_OPS }, { k: 'op', h: '最大值', ops: MAX_OPS }],
    '最大值': [{ k: 'op', h: '最大值', ops: MAX_OPS }],
    '最小值': [{ k: 'op', h: '最小值', ops: MIN_OPS }]
  };
  function depCols(type) { return (DEP_COLS[type] || [{ k: 'v', h: type }]).map(function (c) { return c.h; }); }

  function nomCard(it, gi, ii) {
    var head = '<div class="nv-card-h"><b>' + (ii + 1) + '.' + esc(it.name) + '（' + esc(it.unit || '') + '）</b>' +
      '<span class="nv-tag">' + esc(it.type) + '</span><span class="nv-ops">' +
      '<a class="link" onclick="TIDN.editNom(' + gi + ',' + ii + ')"><i class="fa fa-pencil"></i></a>' +
      '<a class="link danger" onclick="TIDN.delNom(' + gi + ',' + ii + ')"><i class="fa fa-trash"></i></a></span></div>';
    var body;
    if (!it.multi) {
      body = '<div class="nv-line">' + nomSummary(it) + '</div>';
    } else {
      var cols = (it.vars || []).map(function (v) { return '<th>' + esc(v.label) + '</th>'; }).join('') +
        depCols(it.type).map(function (c) { return '<th>' + (c || '&nbsp;') + '</th>'; }).join('');
      var off = (it.vars || []).length, cols2 = DEP_COLS[it.type] || [{ k: 'v', h: it.type }];
      var rows = (it.rows || []).map(function (r) {
        return '<tr>' + (it.vars || []).map(function (v, vi) { return '<td>' + esc(cellText(r[vi], v)) + '</td>'; }).join('') +
          cols2.map(function (c, ci) {
            var x = r[off + ci];
            return '<td>' + esc(c.k === 'op' && x && typeof x === 'object' ? (x.op || '') + (x.val || '') : (x == null ? '' : String(x))) + '</td>';
          }).join('') + '</tr>';
      }).join('');
      body = '<div class="nv-map"><table class="data-table"><thead><tr>' + cols + '</tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div class="pager"><span class="pg">‹</span><span class="pg active">1</span><span class="pg">›</span></div></div>';
    }
    return '<div class="nv-card">' + head + body + '</div>';
  }
  function fmtDep(it, r, off) {
    if (it.type === '范围') return (r[off] || '') + ' / ' + (r[off + 1] || '');
    var v = r[off];
    if (it.type === '最大值') return '≤' + (v == null ? '' : v);
    if (it.type === '最小值') return '≥' + (v == null ? '' : v);
    return v == null ? '' : String(v);
  }
  function nomSummary(it) {
    var v = it.v || {}, p1 = '';
    if (it.type === '单值') p1 = '1.单值：' + (v.single || '');
    else if (it.type === '最小值') p1 = '1.最小值：' + (v.minOp || '≥') + (v.min || '');
    else if (it.type === '最大值') p1 = '1.最大值：' + (v.maxOp || '≤') + (v.max || '');
    else if (it.type === '范围') p1 = '1.最小值：' + (v.minOp || '>') + (v.min || '') + '　2.最大值：' + (v.maxOp || '<') + (v.max || '');
    else if (it.type === '公差') p1 = '1.单值：' + (v.single || '') + '　2.偏差：' + (v.negOn ? '-' + v.neg : '') + ' / ' + (v.posOn ? '+' + v.pos : '');
    else if (it.type === '公式') p1 = '1.公式：' + (v.formula || '') + (v.round && v.round.base ? '　2.修约：' + esc(roundSum(v.round)) : '');
    return p1 + '　' + (it.type === '范围' || it.type === '公差' || it.type === '公式' ? '' : '2.') + '备注：' + (it.remark || '/');
  }
  function roundSum(rc) { return rc.condOn ? '条件映射 ' + rc.rules.length + ' 条' : rc.base.mode + '，保留 ' + rc.base.digits + ' 位'; }

  function renderNom() {
    var body = $('tidBody'), gs = nomGroups();
    var gi = N.rail = Math.min(N.rail, gs.length - 1);
    body.innerHTML = '<div class="nv-wrap">' + railHtml(gi, 'TIDN.pickRail') +
      '<div class="nv-main"><div class="nv-bar">' +
      '<button class="btn-outline" onclick="TIDN.copyDlg()"><i class="fa fa-copy"></i> 复制标称值</button>' +
      '<button class="btn-primary" onclick="TIDN.editNom(' + gi + ',-1)"><i class="fa fa-plus"></i> 试验项标称值</button>' +
      '<button class="btn-outline nv-del" onclick="TIDN.clearAll()">删 除</button></div>' +
      (gs[gi].items.length ? gs[gi].items.map(function (it, ii) { return nomCard(it, gi, ii); }).join('')
        : '<div class="empty-table"><i class="fa fa-inbox"></i>该试验子项下暂无标称值</div>') +
      '</div></div>';
  }
  N.pickRail = function (i) { N.rail = i; renderNom(); };
  N.clearAll = function () {
    var gs = nomGroups(), g = gs[N.rail];
    if (!g.items.length) { U.toast('当前试验子项下没有标称值'); return; }
    if (!confirm('确认清空「' + (g.sub || '本试验项') + '」下全部 ' + g.items.length + ' 条标称值？')) return;
    g.items = []; renderNom();
  };
  N.delNom = function (gi, ii) {
    var it = nomGroups()[gi].items[ii];
    if (!confirm('删除标称值「' + it.name + '」？')) return;
    // PRD 高危联动阻断：被结果判定引用的标称值不允许删除
    var used = (TID.state.judges && TID.state.judges.conditions || []).some(function (c) { return c.right === it.name; });
    if (used) { U.toast('删除失败！该标称值已被结果判定规则引用，请先解除绑定。'); return; }
    nomGroups()[gi].items.splice(ii, 1); renderNom();
  };

  var ND = null;
  N.editNom = function (gi, ii) {
    ND = { gi: gi, ii: ii, d: ii >= 0 ? clone(nomGroups()[gi].items[ii]) : blankNom(gi) };
    nomModal();
  };
  function blankNom(gi) {
    return { name: '', symbol: '', unit: '', remark: '', sub: norm()[N.rail] || '', multi: false, type: '单值',
      v: { single: '', minOp: '≥', min: '', maxOp: '≤', max: '', negOn: false, neg: '', posOn: false, pos: '', formula: '', round: null },
      vars: [], rows: [] };
  }
  function nomModal() {
    var d = ND.d;
    if (!d.v) d.v = { single: '', minOp: '≥', min: '', maxOp: '≤', max: '', negOn: false, neg: '', posOn: false, pos: '', formula: '', round: null };
    if (!d.rows) d.rows = [];
    if (!d.vars) d.vars = [];
    var inner = '<div class="pm-context"><span class="pm-ctx-ttl"><i class="fa fa-info-circle"></i>基本信息</span>' +
      '<span class="kv">样品：<b>' + esc((TID.ctx && TID.ctx.sampleName) || '') + '</b></span>' +
      '<span class="kv">试验项：<b>' + esc(TID.state.name || '新增试验') + '</b></span>' +
      '<span class="kv">型号：<b>' + esc((TID.ctx && TID.ctx.modelName) || '') + '</b></span></div>' +
      '<div class="pm-grid">' +
      f('标称值名称', true, ti('name', d.name)) + f('符号', false, ti('symbol', d.symbol)) + f('单位', true, ti('unit', d.unit)) +
      (hasSubs() ? f('试验子项', true, '<select onchange="TIDN.setN(\'sub\',this.value)">' + norm().map(function (s) {
        return '<option' + (s === d.sub ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') + '</select>') : '') +
      f('备注', false, ti('remark', d.remark)) +
      '</div>' +
      '<div class="pm-grid pm-mapsw"><div class="pm-fi pm-wide">' +
      '<span class="pm-lab req">多行映射：</span><span class="pm-ctl"><label class="toggle"><input type="checkbox" ' + (d.multi ? 'checked' : '') +
      ' onchange="TIDN.setMulti(this.checked)" /><span class="toggle-slider"></span></label></span></div></div>' +
      '<div class="pm-grid"><div class="pm-fi">' +
      '<span class="pm-lab req">标称值类型：</span><span class="pm-ctl"><select onchange="TIDN.setN(\'type\',this.value)">' +
      NOM_TYPES.map(function (t) { return '<option' + (t === d.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></span></div></div>' +
      (d.multi ? nomVarsPanel(d) : nomTypeFields(d));
    U.modalShell(ND.ii >= 0 ? '编辑试验项标称值' : '新增试验项标称值', inner, 'TIDN.saveNom()', '确 定', 0);
  }
  function f(lab, req, ctl) { return '<div class="pm-fi"><span class="pm-lab' + (req ? ' req' : '') + '">' + lab + '：</span><span class="pm-ctl">' + ctl + '</span></div>'; }
  function ti(k, v) { return '<input type="text" value="' + esc(v) + '" placeholder="请输入" oninput="TIDN.setN(\'' + k + '\',this.value)" />'; }

  function nomTypeFields(d) {
    var v = d.v;
    if (d.type === '单值') return '<div class="pm-grid">' + f('单值', true, '<input type="text" value="' + esc(v.single) + '" placeholder="请输入" oninput="TIDN.setV(\'single\',this.value)" />') + '</div>';
    if (d.type === '最小值') return '<div class="pm-grid">' + f('最小值', true, opPair('minOp', v.minOp, MIN_OPS, 'min', v.min)) + '</div>';
    if (d.type === '最大值') return '<div class="pm-grid">' + f('最大值', true, opPair('maxOp', v.maxOp, MAX_OPS, 'max', v.max)) + '</div>';
    if (d.type === '范围') return '<div class="pm-grid">' + f('最小值', true, opPair('minOp', v.minOp, MIN_OPS, 'min', v.min)) + f('最大值', true, opPair('maxOp', v.maxOp, MAX_OPS, 'max', v.max)) + '</div>';
    if (d.type === '公差') return '<div class="pm-grid">' + f('单值', true, '<input type="text" value="' + esc(v.single) + '" placeholder="请输入" oninput="TIDN.setV(\'single\',this.value)" />') +
      '</div><div class="pm-grid"><div class="pm-fi pm-wide"><span class="pm-lab req">偏差：</span><span class="pm-ctl"><div class="nv-tol">' +
      '<label><input type="checkbox" ' + (v.negOn ? 'checked' : '') + ' onchange="TIDN.setV(\'negOn\',this.checked)" />(-) 负偏差</label><input type="text" value="' + esc(v.neg) + '" placeholder="请输入" oninput="TIDN.setV(\'neg\',this.value)" /></div>' +
      '<div class="nv-tol"><label><input type="checkbox" ' + (v.posOn ? 'checked' : '') + ' onchange="TIDN.setV(\'posOn\',this.checked)" />(+) 正偏差</label><input type="text" value="' + esc(v.pos) + '" placeholder="请输入" oninput="TIDN.setV(\'pos\',this.value)" /></div></span></div></div>';
    return '<div class="pm-grid">' +
      f('公式', true, '<div class="ms-fbox"><input type="text" value="' + esc(v.formula) + '" placeholder="请输入" disabled /><a class="link ms-ed" onclick="TIDN.formula()"><i class="fa fa-pencil"></i></a></div>') +
      f('修约规则', false, '<div class="ms-fbox"><input type="text" value="' + esc(v.round ? roundSum(v.round) : '') + '" placeholder="请输入" disabled /><a class="link ms-ed" onclick="TIDN.round()"><i class="fa fa-pencil"></i></a></div>') +
      '</div>';
  }
  function opPair(opK, opV, ops, valK, valV) {
    return '<span class="nv-pair"><select onchange="TIDN.setV(\'' + opK + '\',this.value)">' +
      '<option value="">请选择</option>' + ops.map(function (o) { return '<option' + (o === opV ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>' +
      '<input type="text" value="' + esc(valV) + '" placeholder="请输入" oninput="TIDN.setV(\'' + valK + '\',this.value)" /></span>';
  }
  function nomVarsPanel(d) {
    var specs = U.specList();
    if (d.type === '公式') return '';
    d.varsByKind = d.varsByKind || {};
    var pick = '<div class="pm-vars"><div class="pm-vhead"><span class="req">*</span> 请勾选自变量：</div>' +
      '<div class="pm-vrow"><span class="pm-vlab">规格参数：</span><span class="pm-vbox">' +
      specs.map(function (sp) {
        var on = d.vars.some(function (x) { return x.label === sp.name; });
        return '<label class="pm-ck"><input type="checkbox" ' + (on ? 'checked' : '') +
          ' onchange="TIDN.pickVar(\'' + esc(sp.name) + '\',this.checked)" />' + esc(sp.name) + '</label>';
      }).join('') + '</span></div>' +
      ['preset|预设值', 'measured|实测值', 'computed|计算值'].map(function (t) {
        var k = t.split('|')[0], lab = t.split('|')[1], sel = d.varsByKind[k] || { test: '', param: '' };
        return '<div class="pm-vrow"><span class="pm-vlab">' + lab + '：</span><span class="pm-vbox">' +
          '<select class="pm-vtest" onchange="TIDN.varTest(\'' + k + '\',this.value)"><option value="">请选择试验项</option>' +
          U.testList().map(function (x) { return '<option' + (x === sel.test ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' +
          '<select class="pm-vpick" ' + (sel.test ? '' : 'disabled') + ' onchange="TIDN.varPick(\'' + k + '\',this.value)"><option value="">请选择</option>' +
          (sel.test ? U.poolFor(sel.test)[k].map(function (n) { return '<option' + (n === sel.param ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') : '') +
          '</select></span></div>';
      }).join('') + '</div>';
    if (!d.vars.length) return pick + '<div class="pm-need">请先勾选至少一个自变量</div>';
    var off = d.vars.length, cols = DEP_COLS[d.type] || [{ k: 'v', h: d.type }];
    var head = d.vars.map(function (v, vi) {
      return '<th class="nv-vh"><i class="pm-grip"></i><span>' + esc(v.label) + '</span>' +
        '<button class="nv-toggle' + (v.mode === '区间' ? ' on' : '') + '" title="切换 固定值 / 区间" onclick="TIDN.varMode(' + vi +
        ',\'' + (v.mode === '区间' ? '固定值' : '区间') + '\')"><i class="fa fa-angle-double-down"></i></button></th>';
    }).join('') + cols.map(function (c) { return '<th>' + (c.h ? esc(c.h) : '&nbsp;') + '</th>'; }).join('') +
      '<th class="ms-op">操作<span class="op-add" onclick="TIDN.addNRow()">＋</span></th>';
    var body = d.rows.map(function (r, ri) {
      var cells = d.vars.map(function (v, vi) {
        if (v.mode === '区间') {
          var c = (r[vi] && typeof r[vi] === 'object') ? r[vi] : { a: '', b: '' };
          return '<td><span class="nv-int"><input type="text" value="' + esc(c.a) + '" placeholder="下限" oninput="TIDN.setNRow(' + ri + ',' + vi + ',\'a\',this.value)" />' +
            '<span>≤' + esc(varSymbol(v)) + '≤</span><input type="text" value="' + esc(c.b) + '" placeholder="上限" oninput="TIDP_setB(' + ri + ',' + vi + ',this.value)" /></span></td>';
        }
        var opts = (specs.filter(function (x) { return x.name === v.label; })[0] || {}).options || [];
        return '<td><select onchange="TIDN.setNRow(' + ri + ',' + vi + ',\'v\',this.value)"><option value="">请选择</option>' +
          opts.map(function (o) { return '<option' + (o === r[vi] ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></td>';
      }).join('');
      cells += cols.map(function (c, ci) {
        var x = r[off + ci], p = off + ci;
        if (c.k === 'op') {
          var o = (x && typeof x === 'object') ? x : { op: '', val: '' };
          return '<td><span class="nv-pair"><select onchange="TIDN.setNOp(' + ri + ',' + p + ',this.value)"><option value="">符..</option>' +
            c.ops.map(function (q) { return '<option' + (q === o.op ? ' selected' : '') + '>' + q + '</option>'; }).join('') + '</select>' +
            '<input type="text" value="' + esc(o.val) + '" placeholder="请输入" oninput="TIDN.setNVal(' + ri + ',' + p + ',this.value)" /></span></td>';
        }
        return '<td><input type="text" value="' + esc(x == null ? '' : x) + '" placeholder="请输入" oninput="TIDN.setNRow(' + ri + ',' + p + ',\'v\',this.value)" /></td>';
      }).join('');
      return '<tr>' + cells + '<td class="ms-op"><span class="op-del" onclick="TIDN.delNRow(' + ri + ')">−</span></td></tr>';
    }).join('');
    return pick + '<table class="data-table nv-edit"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }
  N.varTest = function (k, v) { ND.d.varsByKind[k] = { test: v, param: '' }; nomModal(); };
  N.varPick = function (k, v) {
    var d = ND.d; d.varsByKind[k] = { test: d.varsByKind[k].test, param: v };
    if (v && !d.vars.some(function (x) { return x.label === v; })) d.vars.push({ kind: k, label: v, mode: 'fixed' });
    nomModal();
  };
  N.setNOp = function (ri, ci, v) { var r = ND.d.rows[ri]; if (typeof r[ci] !== 'object') r[ci] = { op: '', val: '' }; r[ci].op = v; };
  N.setNVal = function (ri, ci, v) { var r = ND.d.rows[ri]; if (typeof r[ci] !== 'object') r[ci] = { op: '', val: '' }; r[ci].val = v; };

  global.TIDP_setB = function (ri, vi, v) { var r = ND.d.rows[ri]; if (typeof r[vi] !== 'object') r[vi] = { a: '', b: '' }; r[vi].b = v; };
  N.setN = function (k, v) {
    ND.d[k] = v;
    if (k === 'type') {
      // 图6：公式类型与多行映射互斥
      if (v === '公式' && ND.d.multi) { ND.d.multi = false; U.toast('标称值类型为公式时，不允许开启多行映射'); }
      ND.d.rows = [];
      if (ND.d.multi) N.addNRow(true);
      nomModal();
    }
  };
  N.setV = function (k, v) { ND.d.v[k] = v; if (k === 'negOn' || k === 'posOn') nomModal(); };
  N.setMulti = function (v) {
    if (v && ND.d.type === '公式') { U.toast('标称值类型为公式时，不允许开启多行映射'); ND.d.multi = false; nomModal(); return; }
    ND.d.multi = v;
    if (v && !ND.d.rows.length) N.addNRow(true);
    if (!v) ND.d.rows = [];
    nomModal();
  };
  N.pickVar = function (name, on) {
    var d = ND.d;
    if (on) { if (!d.vars.some(function (x) { return x.label === name; })) d.vars.push({ kind: '规格参数', label: name, mode: 'fixed' }); }
    else d.vars = d.vars.filter(function (x) { return x.label !== name; });
    d.rows = d.rows.map(function (r) { return r.slice(0, d.vars.length + 1); });
    nomModal();
  };
  N.varMode = function (vi, m) {
    var d = ND.d; d.vars[vi].mode = m;
    d.rows.forEach(function (r, ri) {
      if (m === '区间') { if (typeof r[vi] !== 'object') r[vi] = { a: r[vi] || '', b: '' }; }
      else if (typeof r[vi] === 'object') r[vi] = r[vi].a || '';
    });
    nomModal();
  };
  N.addNRow = function (quiet) {
    var d = ND.d, cols = DEP_COLS[d.type] || [{ k: 'v', h: d.type }];
    d.rows.push(new Array(d.vars.length + cols.length).fill('').map(function (x, i) {
      if (d.vars[i] && d.vars[i].mode === '区间') return { a: '', b: '' };
      if (i >= d.vars.length && cols[i - d.vars.length] && cols[i - d.vars.length].k === 'op') return { op: '', val: '' };
      return x;
    }));
    if (!quiet) nomModal();
  };
  N.delNRow = function (ri) { ND.d.rows.splice(ri, 1); nomModal(); };
  N.setNRow = function (ri, ci, which, v) {
    var r = ND.d.rows[ri];
    if (which === 'a') { if (typeof r[ci] !== 'object') r[ci] = { a: '', b: '' }; r[ci].a = v; }
    else r[ci] = v;
  };
  N.formula = function () {
    TIDM.editFormula({ binding: '计算参数层级', formula: ND.d.v.formula || '' }, function (f2) { ND.d.v.formula = f2.formula; nomModal(); });
  };
  N.round = function () {
    ND.d.v.round = ND.d.v.round || { condOn: false, base: { mode: '四舍五入', digits: 2, interval: '0.01', direct: '' }, rules: [] };
    TIDM.editRound(ND.d.v.round, function () { nomModal(); });
  };
  N.saveNom = function () {
    var d = ND.d, miss = [];
    if (!d.name) miss.push('标称值名称');
    if (!d.unit) miss.push('单位');
    if (hasSubs() && !d.sub) miss.push('试验子项');
    if (!d.multi) {
      var v = d.v;
      if (d.type === '单值' && !v.single) miss.push('单值');
      if (d.type === '公差' && !v.single) miss.push('单值');
      if (d.type === '最小值' && (!v.minOp || !v.min)) miss.push('最小值符号与数值');
      if (d.type === '最大值' && (!v.maxOp || !v.max)) miss.push('最大值符号与数值');
      if (d.type === '范围' && (!v.min || !v.max)) miss.push('范围的最小值与最大值（必须成对）');
      if (d.type === '公式' && !v.formula) miss.push('公式');
    } else if (!d.vars.length) miss.push('自变量');
    if (d.multi && !d.rows.length) miss.push('映射数据行');
    if (miss.length) { U.toast('缺少必填项：' + miss.join('、')); return; }
    var g = nomGroups()[ND.gi];
    // 多行映射时把当前子项写进 sub；单行保留原值
    var out = clone(d);
    if (ND.ii >= 0) g.items[ND.ii] = out; else g.items.push(out);
    U.host().innerHTML = ''; renderNom();
  };
  /* 图4 只是示意：真实粒度是「单条标称值」。下拉按左侧样品树的层级展示
   *  大类 → 样品 → 型号 → 试验项 → 标称值，分组节点置灰不可选。 */
  N.copyDlg = function () {
    var rows = [];
    function push(d, label, sel) { rows.push({ d: d, t: label, sel: sel || null }); }
    Object.keys(global.SampleDataStore.TREES).forEach(function (cat) {
      var leaves = [];
      (function walk(ns) { (ns || []).forEach(function (n) { if (n.leaf) leaves.push(n); walk(n.children); }); })(global.SampleDataStore.TREES[cat]);
      leaves.forEach(function (lf) {
        var sm = global.SampleDataStore.SAMPLE_MOCK[lf.id]; if (!sm) return;
        push(0, CAT_META[cat] ? CAT_META[cat].name : cat);
        push(1, sm.name);
        var models = (sm.models && sm.models.length) ? sm.models : [{ code: '（不区分型号）', tests: sm.tests || [] }];
        models.forEach(function (md) {
          push(2, md.code);
          (md.tests || []).forEach(function (t) {
            (SEED_N[t.name] || []).forEach(function (g) {
              if (!g.items.length) return;
              push(3, t.name + (g.sub ? ' — ' + g.sub : ''));
              g.items.forEach(function (it) {
                push(4, it.name + '（' + (it.unit || '无单位') + '）',
                  { test: t.name, sub: g.sub, item: it.name });
              });
            });
          });
        });
      });
    });
    N._copyRows = rows;
    var inner = '<div class="pm-grid" style="grid-template-columns:1fr"><div class="pm-fi">' +
      '<span class="pm-lab req">请选择要复制的标称值：</span><span class="pm-ctl">' +
      '<select size="14" id="nvCopy" style="height:auto">' + rows.map(function (n, i) {
        return '<option value="' + i + '"' + (n.sel ? '' : ' disabled') + '>' + Array(n.d + 1).join('　') + (n.sel ? '' : '▾ ') + esc(n.t) + '</option>';
      }).join('') + '</select>' +
      '<span class="nv-hint">层级：大类 → 样品 → 型号 → 试验项（试验子项）→ 标称值；灰色为分组节点，只可复制单条标称值。</span></span></div></div>';
    U.modalShell('复制标称值', inner, 'TIDN.copyOk()', '确 定', 1);
  };
  N.copyOk = function () {
    var s = $('nvCopy');
    if (!s || !s.value) { U.toast('请选择一条标称值'); return; }
    var hit = N._copyRows[Number(s.value)];
    if (!hit || !hit.sel) { U.toast('分组节点不可复制，请选择到具体标称值'); return; }
    var src = hit.sel, found = null;
    (SEED_N[src.test] || []).forEach(function (g) {
      if (g.sub !== src.sub) return;
      g.items.forEach(function (it) { if (it.name === src.item) found = clone(it); });
    });
    if (!found) { U.toast('原型内仅预置了「结构尺寸检查」的标称值数据'); return; }
    found.sub = norm()[N.rail] || found.sub;
    nomGroups()[N.rail].items.push(found);
    U.host().innerHTML = ''; renderNom();
    U.toast('已复制「' + src.test + ' / ' + found.name + '」到当前试验子项');
  };

  /* ══════════════ 二、结果判定 ══════════════ */
  function judge() {
    var st = TID.state;
    if (!st.judges) {
      st.judges = { param: '结论', paramType: '下拉选项', options: ['合格', '不合格'], method: '系统判定', level: '线芯',
        ruleMode: hasSubs() ? '判定对比' : '试验参数对比', conditions: [], conclusions: [] };
      var seed = SEED_J[st.name];
      if (seed) { st.judges.conditions = clone(seed.conditions); st.judges.conclusions = clone(seed.conclusions); }
      else if (hasSubs()) {
        st.judges.conditions = norm().map(function (s) { return { source: s + '-结论', op: '包含', values: ['合格'] }; });
        st.judges.conclusions = [{ value: '合格', logic: '当满足所有条件时' }, { value: '不合格', logic: '不满足任一条件时' }];
      }
    }
    return st.judges;
  }
  var SEED_J = {
    '结构尺寸检查': {
      conditions: [
        { branch: true, _side: '标称值对比', branches: [
          { kind: 'IF', ifs: [{ type: '实测值', v: '导体结构', op: '不包含', values: ['实心导体'], join: 'and' }],
            thens: [{ side: '标称值对比', leftType: '实测值', left: '导体单丝根数(根)', cmp: '≥',
                      rightType: '最小值', right: '导体最少单线数量(根)', join: 'and' }] },
          { kind: 'ELSE IF', ifs: [{ type: '实测值', v: '导体结构', op: '包含', values: ['紧压绞合圆形'], join: 'and' }],
            thens: [{ side: '标称值对比', leftType: '实测值', left: '导体直径(mm)', cmp: '符合',
                      rightType: '范围', right: '导体最大最小直径（紧压绞合圆型）(mm)', join: 'and' }] }
        ] },
        { _side: '标称值对比', leftType: '实测值', left: '导体直径(mm)', cmp: '符合',
          rightType: '最大值', right: '导体最大直径（铜芯，实心/非紧压绞合）(mm)' }
      ],
      conclusions: [{ value: '合格', logic: '当满足所有条件时' }, { value: '不合格', logic: '不满足任一条件时' }]
    },
    '老化前绝缘的机械性能': {
      conditions: [
        { side: '标称值对比', leftType: '计算值', left: '抗张强度中间值(N/mm²)', cmp: '符合', right: '抗张强度最小值（老化前）(N/mm²)', rightKind: '最小值' },
        { side: '标称值对比', leftType: '计算值', left: '断裂伸长率中间值(%)', cmp: '符合', right: '断裂伸长率最小值（老化前）(%)', rightKind: '最小值' }
      ],
      conclusions: [{ value: '合格', logic: '当满足所有条件时' }, { value: '不合格', logic: '不满足任一条件时' }]
    }
  };
  var J = { rail: 0 };

  function renderJudge() {
    var j = judge(), body = $('tidBody');
    var manual = j.method === '人工判定';
    var inner = '<div class="pm-grid" style="grid-template-columns:1fr">' +
      '<div class="pm-fi"><span class="pm-lab req">判定参数：</span><span class="pm-ctl"><div class="tid-clearable">' +
      '<input type="text" value="' + esc(j.param) + '" oninput="TIDJ.set(\'param\',this.value)" />' +
      '<button class="clr" onclick="TIDJ.set(\'param\',\'\')">✕</button></div></span></div>' +
      '<div class="pm-fi"><span class="pm-lab req">判定参数类型：</span><span class="pm-ctl">' +
      '<select onchange="TIDJ.set(\'paramType\',this.value)"><option>文本</option><option' + (j.paramType === '下拉选项' ? ' selected' : '') + '>下拉选项</option></select></span></div>' +
      (j.paramType === '下拉选项' ? '<div class="pm-fi"><span class="pm-lab">可选项：</span><span class="pm-ctl">' + tagbox(j) + '</span></div>' : '') +
      '<div class="pm-fi"><span class="pm-lab req">判定方式：</span><span class="pm-ctl"><span class="tid-radios">' +
      ['人工判定', '系统判定'].map(function (m) { return '<label><input type="radio" name="jdM" value="' + m + '"' + (j.method === m ? ' checked' : '') + ' onchange="TIDJ.set(\'method\',this.value)" />' + m + '</label>'; }).join('') + '</span></span></div>' +
      '<div class="pm-fi"><span class="pm-lab req">判断层级：</span><span class="pm-ctl"><span class="tid-radios">' +
      LEVELS.map(function (m) {
        var why = levelBlock(m);
        return '<label' + (why ? ' class="disabled" title="' + esc(why) + '"' : '') + '><input type="radio" name="jdL" value="' + m + '"' +
          (j.level === m ? ' checked' : '') + (why ? ' disabled' : '') + ' onchange="TIDJ.set(\'level\',this.value)" />' + m + '</label>';
      }).join('') +
      '</span><span class="nv-hint">' + esc(LEVEL_HINT[j.level] || '') + '</span></div>' +
      '</div>';
    if (manual) {
      inner += '<div class="pm-need" style="margin-top:16px">判定方式=人工判定：检测员手工录入结论，系统不执行逻辑校验，下方判定规则面板整体隐藏。</div>';
    } else {
      inner += '<div class="jd-rules"><div class="jd-rules-h"><span class="pm-lab req">判定规则：</span>' +
        (hasSubs() ? '<span class="jd-cap"><i class="nv-bar"></i>判定条件</span>' +
          ['判定对比', '试验参数对比'].map(function (m) {
            return '<label><input type="radio" name="jdR" value="' + m + '"' + (j.ruleMode === m ? ' checked' : '') + ' onchange="TIDJ.set(\'ruleMode\',this.value)" />' + m + '</label>';
          }).join('') : '<span class="jd-cap"><i class="nv-bar"></i>判定条件</span><span class="nv-hint">该试验项无试验子项，只提供「试验参数对比」</span>') +
        '<button class="btn-save jd-add" onclick="TIDJ.addCond()"><i class="fa fa-plus"></i> 条件</button></div>' +
        j.conditions.map(function (c, i) { return condCard(c, i); }).join('') +
        '<div class="jd-rules-h" style="margin-top:18px"><span class="jd-cap"><i class="nv-bar"></i>结论</span>' +
        '<button class="btn-save jd-add" onclick="TIDJ.addConcl()"><i class="fa fa-plus"></i> 结论</button></div>' +
        j.conclusions.map(function (c, i) {
          return '<div class="jd-concl"><b>结论' + (i + 1) + '</b>' +
            '<a class="link danger" onclick="TIDJ.delConcl(' + i + ')"><i class="fa fa-trash"></i> 删除</a>' +
            '<div class="jd-concl-b"><select onchange="TIDJ.setConcl(' + i + ',\'value\',this.value)">' +
            j.options.map(function (o) { return '<option' + (o === c.value ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>' +
            '<select onchange="TIDJ.setConcl(' + i + ',\'logic\',this.value)">' +
            CONCL_LOGIC.map(function (o) { return '<option' + (o === c.logic ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div></div>';
        }).join('') + '</div>';
    }
    body.innerHTML = '<div class="nv-wrap">' + railHtml(J.rail, 'TIDJ.pickRail') +
      '<div class="nv-main"><div class="nv-bar"><button class="btn-outline nv-del" onclick="TIDJ.clearAll()">删 除</button></div>' + inner + '</div></div>';
  }
  function tagbox(j) {
    return '<div class="ms-tagbox">' + j.options.map(function (o, i) {
      return '<span class="tid-tag"><span>' + esc(o) + '</span><i class="fa fa-times" onclick="TIDJ.delOpt(' + i + ',event)"></i></span>';
    }).join('') + '<input type="text" class="ms-opt-add" placeholder="回车添加" onkeydown="TIDJ.addOpt(event)" /></div>';
  }
  function tag(t) { return '<span class="jd-tag">' + esc(t) + '</span>'; }
  function cmpSym(c) {
    var m = { '≥': '>=', '≤': '<=', '>': '>', '<': '<', '=': '=', '!=': '!=' };
    return m[c] || c;
  }
  function branchCard(c, i) {
    return '<div class="jd-cond jd-branch"><b>条件' + (i + 1) + '</b><span class="jd-side">判断条件</span>' +
      '<span class="nv-ops"><a class="link" onclick="TIDJ.editCond(' + i + ')"><i class="fa fa-pencil"></i> 编辑</a>' +
      '<a class="link danger" onclick="TIDJ.delCond(' + i + ')"><i class="fa fa-trash"></i> 删除</a></span>' +
      (c.branches || []).map(function (b) {
        return '<div class="jd-brow"><span class="jd-bkey">' + b.kind + '</span>' +
          (b.ifs || []).map(function (f) {
            return '<div class="jd-bline">' +
              '<div><b>' + esc(f.v) + '</b>' + tag(f.type) + (isEnumVar(f) ? tag('下拉选项') : '') + '</div>' +
              '<span class="jd-bop">' + esc(f.op) + '</span>' +
              '<div><b>' + esc((f.values || []).join('、')) + '</b></div></div>';
          }).join('') +
          '<span class="jd-bkey">THEN</span>' +
          (b.thens || []).map(function (t, ti) {
            return '<div class="jd-bline">' +
              '<div><b>' + esc(t.left) + '</b>' + tag('标称值对比') + tag(t.leftType === '实测值' ? '实测参数' : '计算参数') + '</div>' +
              '<span class="jd-bop">' + cmpSym(t.cmp) + '</span>' +
              '<div><b>' + esc(t.right) + '</b>' + tag(t.rightType || '标称值') + '</div>' +
              (ti > 0 ? '<span class="jd-bjoin">' + (t.join || 'and') + '</span>' : '') + '</div>';
          }).join('') + '</div>';
      }).join('') + '</div>';
  }
  function isEnumVar(f) {
    var hit = null;
    (TID.state.measures || []).forEach(function (g) { g.params.forEach(function (p) { if (p.name === f.v) hit = p; }); });
    return !!(hit && hit.type === '下拉选项');
  }
  function condCard(c, i) {
    if (c.branch) return branchCard(c, i);
    var left = c.source ? '<div class="jd-c"><b>' + esc(c.source) + '</b><span class="jd-cmp">' + esc(c.op) + '</span><span>' + esc((c.values || []).join('、')) + '</span><span class="nv-tag">下拉选项</span></div>'
      : '<div class="jd-c"><b>' + esc(c.left) + '</b><span class="nv-tag">' + esc(c.leftType) + '</span><span class="jd-cmp">' + esc(c.cmp) + '</span>' +
        '<span>' + esc(c.right || '') + '</span><span class="nv-tag">' + esc(c.rightKind || '标称值') + '</span></div>';
    return '<div class="jd-cond"><b>条件' + (i + 1) + '</b><span class="nv-ops">' +
      '<a class="link" onclick="TIDJ.editCond(' + i + ')"><i class="fa fa-pencil"></i> 编辑</a>' +
      '<a class="link danger" onclick="TIDJ.delCond(' + i + ')"><i class="fa fa-trash"></i> 删除</a></span>' +
      (c.source ? '' : '<span class="jd-side">' + esc(c.side) + '</span>') + left + '</div>';
  }
  J.pickRail = function (i) { J.rail = i; renderJudge(); };
  J.set = function (k, v) { judge()[k] = v; renderJudge(); };
  J.addOpt = function (ev) { if (ev.key !== 'Enter') return; var v = ev.target.value.trim(); if (v && judge().options.indexOf(v) < 0) judge().options.push(v); renderJudge(); };
  J.delOpt = function (i, ev) { ev.stopPropagation(); judge().options.splice(i, 1); renderJudge(); };
  J.addCond = function () { J._ci = -1; condModal(); };
  J.editCond = function (i) { J._ci = i; condModal(); };
  J.delCond = function (i) { judge().conditions.splice(i, 1); renderJudge(); };
  J.addConcl = function () { judge().conclusions.push({ value: judge().options[0] || '合格', logic: CONCL_LOGIC[0] }); renderJudge(); };
  J.delConcl = function (i) { judge().conclusions.splice(i, 1); renderJudge(); };
  J.setConcl = function (i, k, v) { judge().conclusions[i][k] = v; };
  J.clearAll = function () {
    var j = judge();
    if (!j.conditions.length && !j.conclusions.length) { U.toast('当前没有可清除的判定规则'); return; }
    if (!confirm('确认清除本试验项的全部判定条件与结论？')) return;
    j.conditions = []; j.conclusions = []; renderJudge();
  };

  var CD = null;
  function condModal() {
    var j = judge();
    CD = J._ci >= 0 ? clone(j.conditions[J._ci]) : (j.ruleMode === '判定对比'
      ? { source: (norm()[0] || '') + '-结论', op: '包含', values: ['合格'] }
      : { side: '标称值对比', leftType: '计算值', left: '', leftPct: { on: false, sign: '+', val: '' }, cmp: '符合', rightKind: '标称值', right: '', rightPct: { on: false, sign: '+', val: '' }, branch: false });
    CD._side = CD.side || '标称值对比';
    CD._bi = 0;
    condRender();
  }
  function condRender() {
    var j = judge(), isConcl = j.ruleMode === '判定对比';
    if (CD.branch) return branchCondRender();
    var inner = '<div class="pm-grid pm-mapsw"><div class="pm-fi pm-wide">' +
      '<span class="pm-lab">切换为判断条件：</span><span class="pm-ctl"><label class="toggle"><input type="checkbox" ' + (CD.branch ? 'checked' : '') +
      ' onchange="TIDJ.setC(\'branch\',this.checked)" /><span class="toggle-slider"></span></label>' +
      '<span class="nv-hint">开启后本条条件升级为 IF-THEN-ELSE 判断逻辑树</span></span></div></div>';
    if (isConcl) {
      inner += '<div class="jd-cmpbox"><div class="pm-grid" style="grid-template-columns:1.2fr .6fr 1fr">' +
        '<div class="pm-fi"><span class="pm-mut">判定参数：</span><span class="pm-ctl"><select onchange="TIDJ.setC(\'source\',this.value)">' +
        norm().map(function (s) { return '<option' + (s + '-结论' === CD.source ? ' selected' : '') + '>' + esc(s) + '-结论</option>'; }).join('') + '</select></span></div>' +
        '<div class="pm-fi"><span class="pm-ctl"><select onchange="TIDJ.setC(\'op\',this.value)"><option>包含</option><option>不包含</option></select></span></div>' +
        '<div class="pm-fi"><span class="pm-ctl">' + tagboxOf(CD) + '</span></div></div></div>';
    } else {
      var side = CD._side;
      inner += '<div class="jd-cmpbox"><div class="jd-sides">' +
        ['标称值对比', '非标称值对比'].map(function (s) {
          return '<span class="jd-side-tab' + (s === side ? ' on' : '') + '" onclick="TIDJ.side(\'' + s + '\')">' + s + '</span>'; }).join('') + '</div>' +
        '<div class="jd-cmpgrid"><div><span class="pm-mut">参数：</span><div class="jd-row">' +
        '<select onchange="TIDJ.setC(\'leftType\',this.value)"><option' + (CD.leftType === '计算值' ? ' selected' : '') + '>计算值</option><option' + (CD.leftType === '实测值' ? ' selected' : '') + '>实测值</option></select>' +
        '<select onchange="TIDJ.setC(\'left\',this.value)"><option value="">请选择</option>' + paramNames(CD.leftType).map(function (n) {
          return '<option' + (n === CD.left ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
        '<span class="jd-star">*</span><span class="jd-pct">百分比 %</span>' +
        '<select onchange="TIDJ.setC(\'leftPct.sign\',this.value)"><option>+</option><option>-</option></select>' +
        '<input type="text" value="' + esc(CD.leftPct.val) + '" placeholder="输入数值" oninput="TIDJ.setC(\'leftPct.val\',this.value)" /></div></div>' +
        '<div class="jd-sep"><select onchange="TIDJ.setC(\'cmp\',this.value)"><option value="">请选择</option>' +
        cmpOpsFor(side === '标称值对比' ? nomTypeOf(CD.right) : '单值').map(function (o) {
          return '<option' + (o === CD.cmp ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>' +
        '<div><span class="pm-mut">' + (side === '标称值对比' ? '标称值：' : '') + '</span><div class="jd-row">' +
        (side === '标称值对比'
          ? '<select onchange="TIDJ.setC(\'right\',this.value)"><option value="">请选择</option>' + nomNames().map(function (n) {
            return '<option' + (n === CD.right ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
            (nomTypeOf(CD.right) === '单值'
              ? '<span class="jd-star">*</span><span class="jd-pct">百分比 %</span><select><option>+</option><option>-</option></select><input type="text" placeholder="输入数值" />'
              : '<span class="jd-lock"><i class="fa fa-lock"></i> 非单值标称值不配修饰符，对比符号锁定为「符合」</span>')
          : '<select onchange="TIDJ.setC(\'rightWhat\',this.value)"><option>参数</option><option>自定义数值</option></select>' +
            (CD.rightWhat === '自定义数值' ? '<input type="text" value="' + esc(CD.rightVal || '') + '" placeholder="请输入" oninput="TIDJ.setC(\'rightVal\',this.value)" />'
              : '<select onchange="TIDJ.setC(\'right\',this.value)"><option value="">请选择</option>' + paramNames('实测值').map(function (n) {
                return '<option' + (n === CD.right ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
                '<span class="jd-star">*</span><span class="jd-pct">百分比 %</span><select><option>+</option><option>-</option></select><input type="text" placeholder="输入数值" />')) +
        '</div></div></div></div>';
    }
    U.modalShell(J._ci >= 0 ? '编辑条件' : '添加条件', inner, 'TIDJ.condOk()', '确 定', 1);
  }
  function tagboxOf(c) {
    return '<div class="ms-tagbox">' + (c.values || []).map(function (v, i) {
      return '<span class="tid-tag"><span>' + esc(v) + '</span><i class="fa fa-times" onclick="TIDJ.delVal(' + i + ',event)"></i></span>'; }).join('') +
      '<select onchange="TIDJ.addVal(this.value)"><option value="">合格</option>' + judge().options.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select></div>';
  }
  function paramNames(t) {
    var pool = U.poolFor(TID.state.name);
    return t === '实测值' ? pool.measured : pool.computed;
  }
  /* PRD §3.4.4：标称值除「单值」外均不配置动态修饰符引擎，对比符号强制「符合」 */
  function nomTypeOf(name) {
    var hit = null;
    nomGroups().forEach(function (g) { g.items.forEach(function (it) {
      if (it.name + (it.unit ? '（' + it.unit + '）' : '') === name) hit = it; }); });
    return hit ? hit.type : '单值';
  }
  function nomNames() {
    var out = [];
    nomGroups().forEach(function (g) { g.items.forEach(function (it) { out.push(it.name + (it.unit ? '（' + it.unit + '）' : '')); }); });
    return out;
  }
  /* ══ 判断条件：IF / ELSE IF / ELSE 树编辑器（图4-图6）══ */
  function varPool(kind) {
    if (kind === '规格参数') return U.specList().map(function (x) { return x.name; });
    if (kind === '标称值') return nomNames();
    var pool = U.poolFor(TID.state.name);
    if (kind === '实测值') return pool.measured.concat(measuredAll());
    if (kind === '预设值') return pool.preset;
    return pool.computed;
  }
  function measuredAll() {
    var out = [];
    ((TID.state || {}).measures || []).forEach(function (g) { g.params.forEach(function (p) {
      out.push(p.name + (p.unit ? '(' + p.unit + ')' : '')); }); });
    return out.length ? out : U.poolFor(TID.state.name).measured;
  }
  function newCond() { return { type: '实测值', v: '', op: '包含', values: [], join: 'and' }; }
  function newThen() { return { side: '标称值对比', leftType: '实测值', left: '', leftPct: { sign: '+', val: '' },
    cmp: '符合', rightType: '', right: '', rightPct: { sign: '+', val: '' }, join: 'and' }; }
  function blankBranch(kind) { return { kind: kind, ifs: [newCond()], thens: [newThen()] }; }
  function toBranches() {
    var b = blankBranch('IF');
    b.thens = [{ side: CD._side || '标称值对比', leftType: CD.leftType || '实测值', left: CD.left || '',
      leftPct: CD.leftPct || { sign: '+', val: '' }, cmp: CD.cmp || '符合', rightType: CD.rightType || '',
      right: CD.right || '', rightPct: CD.rightPct || { sign: '+', val: '' }, join: 'and' }];
    if (CD.source) { b.ifs = [{ type: '下拉选项', v: CD.source, op: CD.op || '包含', values: (CD.values || []).slice(), join: 'and' }]; }
    return [b];
  }
  function branchCondRender() {
    var bi = CD._bi = Math.min(CD._bi || 0, CD.branches.length - 1);
    var b = CD.branches[bi];
    (b.thens || []).forEach(function (t) {
      t.leftPct = t.leftPct || { sign: '+', val: '' };
      t.rightPct = t.rightPct || { sign: '+', val: '' };
    });
    (b.ifs || []).forEach(function (f) { f.values = f.values || []; });
    var tabs = CD.branches.map(function (x, i) {
      return '<span class="jd-btab' + (i === bi ? ' on' : '') + '" onclick="TIDJ.pickBranch(' + i + ')">' + x.kind +
        (x.kind === 'IF' ? '' : '<i class="fa fa-times" onclick="event.stopPropagation();TIDJ.delBranch(' + i + ')"></i>') + '</span>';
    }).join('');
    var hasElse = CD.branches.some(function (x) { return x.kind === 'ELSE'; });
    var btns = '<button class="btn-save" onclick="TIDJ.addBranch(\'ELSE IF\')"><i class="fa fa-plus"></i> ELSE IF</button>' +
      (hasElse ? '' : '<button class="btn-save" onclick="TIDJ.addBranch(\'ELSE\')"><i class="fa fa-plus"></i> ELSE</button>');
    var inner = '<div class="pm-grid pm-mapsw"><div class="pm-fi pm-wide">' +
      '<span class="pm-lab">切换为判断条件：</span><span class="pm-ctl"><label class="toggle"><input type="checkbox" checked ' +
      'onchange="TIDJ.setC(\'branch\',this.checked)" /><span class="toggle-slider"></span></label></span></div></div>' +
      '<div class="jd-btabs">' + tabs + '<span class="jd-btabs-r">' + btns + '</span></div>' +
      (b.kind === 'ELSE' ? '' :
        '<div class="jd-cmpbox">' + b.ifs.map(function (f, i) { return ifBranchRow(f, i, b.ifs.length); }).join('') +
        '<div class="jd-joins"><button onclick="TIDJ.addIf(\'and\')">＋ and</button><button onclick="TIDJ.addIf(\'or\')">＋ or</button></div></div>') +
      '<div class="pm-sec" style="margin:16px 0 8px">THEN：</div>' +
      b.thens.map(function (t, i) { return thenBlock(t, i, b.thens.length); }).join('') +
      '<div class="jd-joins"><button onclick="TIDJ.addThen(\'and\')">＋ and</button><button onclick="TIDJ.addThen(\'or\')">＋ or</button></div>';
    U.modalShell(J._ci >= 0 ? '编辑条件' : '添加条件', inner, 'TIDJ.condOk()', '确 定', 1);
  }
  function ifBranchRow(f, i, n) {
    var pool = varPool(f.type);
    var enumish = f.type === '规格参数' || /结构|类型/.test(f.v || '');
    return '<div class="jd-brow1"><select onchange="TIDJ.setIf(' + i + ',\'type\',this.value)">' +
      ['实测值', '计算值', '规格参数', '预设值', '标称值'].map(function (t) { return '<option' + (t === f.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
      '<select onchange="TIDJ.setIf(' + i + ',\'v\',this.value)"><option value="">请选择</option>' +
      pool.map(function (x) { return '<option' + (x === f.v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' +
      '<select onchange="TIDJ.setIf(' + i + ',\'op\',this.value)">' +
      (enumish ? ['包含', '不包含'] : ['=', '!=', '<', '≤', '>', '≥', 'in', 'not in', 'between', 'is null', 'is not null'])
        .map(function (o) { return '<option' + (o === f.op ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select>' +
      (enumish ? '<span class="ms-tagbox">' + (f.values || []).map(function (v, vi) {
        return '<span class="tid-tag"><span>' + esc(v) + '</span><i class="fa fa-times" onclick="TIDJ.delIfVal(' + i + ',' + vi + ')"></i></span>'; }).join('') +
        '<select onchange="TIDJ.addIfVal(' + i + ',this.value)"><option value="">请选择</option>' +
        enumVals(f.v).map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('') + '</select></span>'
        : '<input type="text" value="' + esc(f.target || '') + '" placeholder="请输入" oninput="TIDJ.setIf(' + i + ',\'target\',this.value)" />') +
      (n > 1 ? '<a class="link danger" onclick="TIDJ.delIf2(' + i + ')"><i class="fa fa-trash"></i></a>' : '') +
      (f.join && i > 0 ? '<span class="jd-bjoin">' + f.join + '</span>' : '') + '</div>';
  }
  function enumVals(v) {
    var hit = null;
    (TID.state.measures || []).forEach(function (g) { g.params.forEach(function (p) { if (p.name === v) hit = p; }); });
    if (hit && hit.options) return hit.options;
    var sp = U.specList().filter(function (x) { return x.name === v; })[0];
    return sp ? sp.options : [];
  }
  function thenBlock(t, i, n) {
    var nt = nomTypeOf(t.right);
    return '<div class="jd-cmpbox"><div class="jd-sides">' +
      ['标称值对比', '非标称值对比'].map(function (sd) {
        return '<span class="jd-side-tab' + (sd === t.side ? ' on' : '') + '" onclick="TIDJ.setThen(' + i + ',\'_side\',\'' + sd + '\')">' + sd + '</span>'; }).join('') +
      (n > 1 ? '<span class="jd-bjoin-r"><span class="jd-bjoin">' + (t.join || 'and') + '</span>' +
        '<a class="link danger" onclick="TIDJ.delThen(' + i + ')"><i class="fa fa-trash"></i> 删除</a></span>' : '') + '</div>' +
      '<div class="jd-cmpgrid"><div><span class="pm-mut">参数：</span><div class="jd-row">' +
      '<select onchange="TIDJ.setThen(' + i + ',\'leftType\',this.value)"><option>实测值</option><option>计算值</option></select>' +
      '<select onchange="TIDJ.setThen(' + i + ',\'left\',this.value)"><option value="">请选择</option>' +
      varPool(t.leftType).map(function (x) { return '<option' + (x === t.left ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' +
      '<span class="jd-star">*</span><span class="jd-pct">百分比 %</span>' +
      '<select onchange="TIDJ.setThen(' + i + ',\'leftPct.sign\',this.value)"><option>+</option><option>-</option></select>' +
      '<input type="text" value="' + esc((t.leftPct||{}).val) + '" placeholder="输入数值" oninput="TIDJ.setThen(' + i + ',\'leftPct.val\',this.value)" /></div></div>' +
      '<div class="jd-sep"><select onchange="TIDJ.setThen(' + i + ',\'cmp\',this.value)"><option value="">请选择</option>' +
      cmpOpsFor(t.side === '标称值对比' ? nt : '单值').map(function (o) { return '<option' + (o === t.cmp ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>' +
      '<div><span class="pm-mut">标称值：</span>' + (t.side === '标称值对比' && t.right ? tag(nt) : '') +
      '<div class="jd-row"><select onchange="TIDJ.setThen(' + i + ',\'right\',this.value)"><option value="">请选择</option>' +
      nomNames().map(function (x) { return '<option' + (x === t.right ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' +
      (t.side === '标称值对比' && nt !== '单值'
        ? '<span class="jd-lock"><i class="fa fa-lock"></i> 非单值不配修饰符，符号锁定「符合」</span>'
        : '<span class="jd-star">*</span><span class="jd-pct">百分比 %</span>' +
          '<select onchange="TIDJ.setThen(' + i + ',\'rightPct.sign\',this.value)"><option>+</option><option>-</option></select>' +
          '<input type="text" value="' + esc((t.rightPct||{}).val) + '" placeholder="输入数值" oninput="TIDJ.setThen(' + i + ',\'rightPct.val\',this.value)" />') +
      '</div></div></div></div>';
  }
  J.pickBranch = function (i) { CD._bi = i; branchCondRender(); };
  J.addBranch = function (kind) {
    CD.branches.push(blankBranch(kind)); CD._bi = CD.branches.length - 1; branchCondRender();
  };
  J.delBranch = function (i) {
    if (CD.branches.length <= 1) { U.toast('至少保留一个 IF 分支'); return; }
    CD.branches.splice(i, 1); CD._bi = 0; branchCondRender();
  };
  J.setIf = function (i, k, v) {
    var f = CD.branches[CD._bi].ifs[i]; f[k] = v;
    if (k === 'type' || k === 'v') { f.values = []; f.target = ''; }
    branchCondRender();
  };
  J.addIf = function (j) { var n = newCond(); n.join = j; CD.branches[CD._bi].ifs.push(n); branchCondRender(); };
  J.delIf2 = function (i) { CD.branches[CD._bi].ifs.splice(i, 1); branchCondRender(); };
  J.addIfVal = function (i, v) { if (v) { CD.branches[CD._bi].ifs[i].values.push(v); branchCondRender(); } };
  J.delIfVal = function (i, vi) { CD.branches[CD._bi].ifs[i].values.splice(vi, 1); branchCondRender(); };
  J.setThen = function (i, k, v) {
    var t = CD.branches[CD._bi].thens[i], ps = k.split('.');
    if (ps.length > 1) { t[ps[0]] = t[ps[0]] || {}; t[ps[0]][ps[1]] = v; } else t[k] = v;
    if (k === 'right' || k === 'side' || k === 'leftType' || k === '_side') {
      if (k === '_side') t.side = v;
      if (t.side === '标称值对比' && nomTypeOf(t.right) !== '单值') t.cmp = '符合';
      if (t.side === '标称值对比' && nomTypeOf(t.right) === '单值' && t.cmp === '符合') t.cmp = '';
    }
    branchCondRender();
  };
  J.addThen = function (j) { var n = newThen(); n.join = j; CD.branches[CD._bi].thens.push(n); branchCondRender(); };
  J.delThen = function (i) { CD.branches[CD._bi].thens.splice(i, 1); branchCondRender(); };

  J.setC = function (k, v) {
    var parts = k.split('.'), o = CD;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = v;
    if (k === 'branch') {
      if (v) { CD.branches = toBranches(); CD._bi = 0; branchCondRender(); }
      else {
        var b = CD.branches[0], t = (b.thens || [])[0] || {};
        CD.branch = false; delete CD.branches;
        CD.side = t.side; CD._side = t.side; CD.leftType = t.leftType; CD.left = t.left;
        CD.cmp = t.cmp; CD.right = t.right; CD.rightType = t.rightType;
        CD.leftPct = t.leftPct; CD.rightPct = t.rightPct;
        condRender();
      }
      return;
    }
    if (k === 'leftType' || k === 'rightWhat' || k === 'right') condRender();
  };
  J.side = function (s) { CD._side = s; CD.side = s; condRender(); };
  J.addVal = function (v) { if (v && CD.values.indexOf(v) < 0) CD.values.push(v); condRender(); };
  J.delVal = function (i, ev) { ev.stopPropagation(); CD.values.splice(i, 1); condRender(); };
  J.condOk = function () {
    var j = judge();
    if (CD.branch) {
      for (var bi = 0; bi < CD.branches.length; bi++) {
        var b = CD.branches[bi];
        if (b.kind !== 'ELSE' && (!b.ifs.length || b.ifs.some(function (f) { return !f.v || !f.op || (!(f.values || []).length && !f.target); }))) {
          U.toast('分支「' + b.kind + '」的条件没填全（变量、对比符号、目标值都必填）'); return;
        }
        if (!b.thens.length || b.thens.some(function (t) { return !t.left || !t.cmp || !t.right; })) {
          U.toast('分支「' + b.kind + '」的 THEN 判定没填全（参数、对比符号、标称值都必填）'); return;
        }
      }
      var out = { branch: true, branches: clone(CD.branches) };
      if (J._ci >= 0) j.conditions[J._ci] = out; else j.conditions.push(out);
      U.host().innerHTML = ''; renderJudge(); return;
    }
    if (j.ruleMode === '判定对比') { if (!CD.source || !CD.op || !CD.values.length) { U.toast('请补全判定参数、对比符号与目标结论'); return; } }
    else {
      if (CD._side === '标称值对比' && CD.right) {
        var nt = nomTypeOf(CD.right);
        if (nt !== '单值' && CD.cmp !== '符合') { U.toast('被对比标称值类型为「' + nt + '」，不配置修饰符，对比符号只能选「符合」'); return; }
        if (nt === '单值' && CD.cmp === '符合') { U.toast('被对比标称值为单值时，对比符号请用 = != < ≤ > ≥，不可选「符合」'); return; }
      }
      var rightOk = CD.right || (CD.rightWhat === '自定义数值' && CD.rightVal);
      if (!CD.left || !CD.cmp || !rightOk) { U.toast('请补全参数、对比符号与被对比值'); return; }
    }
    var out = clone(CD); delete out._side;
    if (J._ci >= 0) j.conditions[J._ci] = out; else j.conditions.push(out);
    var h = U.host(); while (h.children.length > 1) h.removeChild(h.lastChild);
    renderJudge();
  };

  /* ══════════════ 三、采集配置 ══════════════ */
  function collectRows() {
    var st = TID.state, cfg = st.collectCfg || (st.collectCfg = {}), rows = [];
    (st.controls || []).forEach(function (c) { rows.push(mk('预设值', c.name, c.code, c.unit, '', cfg, null, c.symbol)); });
    if (global.TIDM && TIDM.groups) { TIDM.groups('m'); TIDM.groups('c'); }   // 统一视图：先把两个子 Tab 的参数装载出来
    (st.measures || []).forEach(function (g) { g.params.forEach(function (p) {
      rows.push(mk('测量参数', p.name, p.code, p.unit, '', cfg, p.type !== '文字', p.symbol)); }); });
    (st.calcs || []).forEach(function (g) { g.params.forEach(function (p) { rows.push(mk('计算参数', p.name, p.code, p.unit, p.bind, cfg, true, p.symbol)); }); });
    nomGroups().forEach(function (g) { g.items.forEach(function (it) { rows.push(mk('标称值', it.name, it.symbol || codeOf(it), it.unit, '', cfg, false, it.symbol)); }); });
    function mk(type, name, code, unit, bind, o, coverDefault, symbol) {
      var key = type + '|' + name;
      var hit = o[key] || (o[key] = {});
      return { type: type, name: name, code: code || '—', bind: bind || '—', unit: unit || '', symbol: symbol || '',
        order: hit.order != null ? hit.order : rows.length + 1, cover: hit.cover != null ? hit.cover : (coverDefault === false ? false : type === '测量参数'), key: key };
    }
    function codeOf(it) { return (TID.state.code || 'bcz') + '_' + (it.name || '').slice(0, 4); }
    rows.sort(function (a, b) { return a.order - b.order; });
    return rows;
  }
  var C = { page: 1, q: { type: '', name: '', code: '', symbol: '', cover: '' } };
  function renderCollect() {
    var all = collectRows();
    var rows = all.filter(function (r) {
      return (!C.q.type || r.type === C.q.type) && (!C.q.name || r.name.indexOf(C.q.name) >= 0) &&
        (!C.q.code || String(r.code).indexOf(C.q.code) >= 0) && (!C.q.symbol || String(r.bind).indexOf(C.q.symbol) >= 0) &&
        (!C.q.cover || (C.q.cover === '开启') === r.cover);
    });
    var per = 10, total = Math.max(1, Math.ceil(rows.length / per));
    if (C.page > total) C.page = total;
    var page = rows.slice((C.page - 1) * per, C.page * per);
    $('tidBody').innerHTML =
      '<div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:8px">采集配置</div>' +
      '<p class="nv-desc"><b>计算顺序：</b>请在该页面对应试验项内试验参数的计算顺序，LIMS系统试验检测页面在完成计算值上传或者输入后按该页面配置顺序进行其他预设值/计算值/标称值的计算。<br>' +
      '<b>是否覆盖LIMS参数：</b>请在该页面进行LIMS系统跟数据采集系统直连模式下，数采系统回传给LIMS系统试验数据时的参数配置。如果开启覆盖，则数采回传的试验参数将覆盖LIMS系统内该参数原有配置值。如果不开启覆盖，则该值不会被数采回传数据覆盖。</p>' +
      '<div class="pm-bar nv-filt">' +
      '<label>类型：</label><select id="cqT"><option value="">请选择</option>' + ['预设值', '测量参数', '计算参数', '标称值'].map(function (t) { return '<option' + (t === C.q.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
      '<label>参数名称：</label><input id="cqN" value="' + esc(C.q.name) + '" placeholder="请输入" />' +
      '<label>参数编码：</label><input id="cqC" value="' + esc(C.q.code) + '" placeholder="请输入" />' +
      '<label>符号：</label><input id="cqS" value="' + esc(C.q.symbol) + '" placeholder="请输入" />' +
      '<label>是否覆盖：</label><select id="cqV"><option value="">请选择</option><option' + (C.q.cover === '开启' ? ' selected' : '') + '>开启</option><option' + (C.q.cover === '关闭' ? ' selected' : '') + '>关闭</option></select>' +
      '<button class="btn-save" onclick="TIDC.query()">查 询</button><button class="btn-outline" onclick="TIDC.reset()">重 置</button></div>' +
      '<table class="data-table"><thead><tr><th>序号</th><th>类型</th><th>参数名称</th><th>参数编码</th><th>绑定层级</th><th>符号</th><th>单位</th><th>计算顺序</th><th>是否覆盖LIMS参数</th><th>操作</th></tr></thead><tbody>' +
      (page.length ? page.map(function (r, i) {
        return '<tr><td>' + ((C.page - 1) * per + i + 1) + '</td><td>' + esc(r.type) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.code) + '</td>' +
          '<td>' + esc(r.bind) + '</td><td>' + esc(r.symbol) + '</td><td>' + esc(r.unit) + '</td>' +
          '<td><input type="text" class="nv-ord" value="' + r.order + '" oninput="TIDC.setOrder(\'' + esc(r.key) + '\',this.value)" /></td>' +
          '<td><label class="toggle"><input type="checkbox" ' + (r.cover ? 'checked' : '') + ' onchange="TIDC.setCover(\'' + esc(r.key) + '\',this.checked)" /><span class="toggle-slider"></span></label></td>' +
          '<td><a class="link" onclick="TIDC.sortDlg(\'' + esc(r.key) + '\')"><i class="fa fa-pencil"></i> 排序</a></td></tr>';
      }).join('') : '<tr><td colspan="10"><div class="empty-table"><i class="fa fa-inbox"></i>暂无数据</div></td></tr>') +
      '</tbody></table>' +
      '<div class="pager"><span>共' + rows.length + '条</span><span class="pg" onclick="TIDC.page(-1)">‹</span>' +
      Array.apply(null, Array(total)).map(function (_, i) { return '<span class="pg' + (C.page === i + 1 ? ' active' : '') + '" onclick="TIDC.goto(' + (i + 1) + ')">' + (i + 1) + '</span>'; }).join('') +
      '<span class="pg" onclick="TIDC.page(1)">›</span><select><option>10条/页</option></select><span>跳至</span><input class="nv-jump" /><span>页</span></div>';
  }
  C.query = function () { C.q = { type: $('cqT').value, name: $('cqN').value.trim(), code: $('cqC').value.trim(), symbol: $('cqS').value.trim(), cover: $('cqV').value }; C.page = 1; renderCollect(); };
  C.reset = function () { C.q = { type: '', name: '', code: '', symbol: '', cover: '' }; C.page = 1; renderCollect(); };
  C.page = function (d) { C.page += d; renderCollect(); };
  C.goto = function (n) { C.page = n; renderCollect(); };
  C.setOrder = function (k, v) { cfg(k).order = parseInt(v, 10) || 1; };
  C.setCover = function (k, v) { cfg(k).cover = v; };
  function cfg(k) { var st = TID.state; return (st.collectCfg || (st.collectCfg = {}))[k] || (st.collectCfg[k] = {}); }
  C.sortDlg = function (k) {
    var rows = collectRows(), cur = 0;
    rows.forEach(function (r, i) { if (r.key === k) cur = i; });
    var inner = '<div class="pm-grid" style="grid-template-columns:1fr"><div class="pm-fi">' +
      '<span class="pm-lab">目标序号：</span><span class="pm-ctl"><input type="text" id="csN" value="' + (cur + 1) + '" /></span></div></div>' +
      '<p class="nv-desc">调整计算顺序：运算引擎按序号升序依次解析预设值映射、计算公式与判定规则，被依赖的参数必须排在前面。</p>';
    U.modalShell('调整计算顺序', inner, 'TIDC.sortOk(\'' + k + '\')', '确 定', 0);
  };
  C.sortOk = function (k) {
    var n = Math.max(1, parseInt($('csN').value, 10) || 1), rows = collectRows();
    var hit = null; rows.forEach(function (r) { if (r.key === k) hit = r; });
    if (!hit) { U.host().innerHTML = ''; renderCollect(); return; }
    rows.splice(rows.indexOf(hit), 1);
    rows.splice(Math.min(n - 1, rows.length), 0, hit);
    rows.forEach(function (r, i) { cfg(r.key).order = i + 1; });
    U.host().innerHTML = '';
    renderCollect();
  };

  /* ══════════════ 通用：公式编辑器（供标称值复用） ══════════════ */
  TIDM.editFormula = function (expr, done) {
    var e = clone(expr);
    function render() {
      var inner = '<div class="pm-grid" style="grid-template-columns:1fr">' +
        '<div class="pm-fi"><span class="pm-lab">绑定：</span><span class="pm-ctl"><span class="tid-radios">' +
        ['计算参数层级', '实测值测量次数'].map(function (t) {
          return '<label><input type="radio" name="efB" value="' + t + '"' + (e.binding === t ? ' checked' : '') + ' onchange="TIDN._ef(\'binding\',this.value)" />' + t + '</label>';
        }).join('') + '</span></span></div>' +
        '<div class="pm-fi"><span class="pm-lab">计算公式：</span><span class="pm-ctl"><div class="ms-fbox">' +
        '<input type="text" id="efF" value="' + esc(e.formula) + '" placeholder="请输入计算公式" disabled />' +
        '<button class="btn-outline" onclick="TIDN._efBack()">退 回</button><button class="btn-outline" onclick="TIDN._efClear()">清 除</button></div></span></div>' +
        '<div class="pm-fi"><span class="pm-lab">请选择试验：</span><span class="pm-ctl"><select onchange="TIDN._efT(this.value)"><option value="">请选择</option>' +
        U.testList().map(function (t) { return '<option' + (t === (TID.state.name) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></span></div>' +
        '<div class="pm-fi"><span class="pm-lab">请选择参数：</span><span class="pm-ctl"><div class="ms-frow">' +
        '<select id="efP"><option value="">请选择参数</option>' + paramNames('实测值').concat(paramNames('计算值')).map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('') +
        '</select><button class="btn-outline" onclick="TIDN._efIns(\'#efP\')">插 入</button></div></span></div>' +
        '<div class="pm-fi"><span class="pm-lab">插入数值：</span><span class="pm-ctl"><div class="ms-frow"><input id="efN" placeholder="请输入" /><button class="btn-outline" onclick="TIDN._efIns(\'#efN\')">插 入</button></div></span></div>' +
        '<div class="pm-fi"><span class="pm-lab">规格参数：</span><span class="pm-ctl"><div class="ms-frow"><select id="efS"><option value="">请选择规格参数</option>' +
        U.specList().map(function (s) { return '<option>' + esc(s.name) + '</option>'; }).join('') + '</select><button class="btn-outline" onclick="TIDN._efIns(\'#efS\')">插 入</button></div></span></div>' +
        '<div class="pm-fi"><span class="pm-lab">数学常数：</span><span class="pm-ctl"><span class="ms-ops">' +
        ['e', 'π'].map(function (k) { return '<button onclick="TIDN._efRaw(\'' + k + '\')">' + k + '</button>'; }).join('') + '</span></span></div>' +
        '<div class="pm-fi"><span class="pm-lab">插入次方：</span><span class="pm-ctl"><div class="ms-frow"><input id="efE" placeholder="请输入" /><button class="btn-outline" onclick="TIDN._efExp()">插 入</button></div></span></div>' +
        '<div class="pm-fi"><span class="pm-lab">运算符快捷按钮：</span><span class="pm-ctl"><span class="ms-ops">' +
        ['+', '-', '*', '/', '(', ')', '^', '.', '√', 'ln', 'lg', '%'].map(function (k) {
          return '<button onclick="TIDN._efRaw(\'' + k + '\')">' + k + '</button>'; }).join('') + '</span></span></div></div>';
      U.modalShell('编辑计算公式', inner, 'TIDN._efOk()', '确 定', 1);
    }
    N._ef = function (k, v) { e[k] = v; render(); };
    N._efT = function () {};
    N._efIns = function (sel) { var x = $(sel.slice(1)); if (x && x.value) e.formula = (e.formula || '') + x.value; paint(); };
    N._efRaw = function (k) { e.formula = (e.formula || '') + k; paint(); };
    N._efExp = function () { var x = $('efE'); if (x && x.value.trim()) { e.formula = (e.formula || '') + '^(' + x.value.trim() + ')'; paint(); } };
    N._efBack = function () { e.formula = String(e.formula || '').slice(0, -1); paint(); };
    N._efClear = function () { e.formula = ''; paint(); };
    N._efOk = function () {
      if (!e.formula) { U.toast('计算公式不能为空'); return; }
      var h = U.host(); while (h.children.length > 1) h.removeChild(h.lastChild);
      done(e);
    };
    function paint() { var f2 = $('efF'); if (f2) f2.value = e.formula; }
    render();
  };

  /* ══════════════ 接管抽屉 Tab ══════════════ */
  var RENDERERS = { nominal: renderNom, judge: renderJudge, collect: renderCollect };
  var _switch = TID.switchTab;
  TID.switchTab = function (t) {
    _switch.call(TID, t);
    if (RENDERERS[t]) RENDERERS[t]();
  };
  var _open = TID.open;
  TID.open = function (i) { _open.call(TID, i); N.rail = 0; J.rail = 0; C.page = 1; };
  global.TIDN = N; global.TIDJ = J; global.TIDC = C;
})(typeof window !== 'undefined' ? window : globalThis);
