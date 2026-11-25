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
  var CMP_OPS = ['=', '!=', '<', '≤', '>', '≥', '符合'];
  var CONCL_LOGIC = ['当满足所有条件时', '当满足任一条件时', '不满足任一条件时', '不满足所有条件时'];
  var LEVELS = ['试样', '样段', '线芯', '试验'];
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
  function depCols(type) { return type === '范围' ? ['最小值', '最大值'] : type === '公差' ? ['基准值', '负偏差', '正偏差'] : [type === '单值' ? '单值' : type]; }

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
        depCols(it.type).map(function (c) { return '<th>' + c + '</th>'; }).join('');
      var rows = (it.rows || []).map(function (r) {
        return '<tr>' + (it.vars || []).map(function (v, vi) { return '<td>' + esc(cellText(r[vi], v)) + '</td>'; }).join('') +
          '<td>' + esc(fmtDep(it, r, it.vars ? it.vars.length : 0)) + '</td></tr>';
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
    return '<div class="pm-vars"><div class="pm-vhead"><span class="req">*</span> 请勾选自变量：</div>' +
      '<div class="pm-vrow"><span class="pm-vlab">规格参数：</span><span class="pm-vbox">' +
      specs.map(function (sp) {
        var hit = d.vars.filter(function (x) { return x.label === sp.name; })[0];
        return '<label class="pm-ck"><input type="checkbox" ' + (hit ? 'checked' : '') + ' onchange="TIDN.pickVar(\'' + esc(sp.name) + '\',this.checked)" />' + esc(sp.name) + '</label>';
      }).join('') + '</span></div></div>' +
      (d.vars.length ? '<table class="data-table nv-edit"><thead><tr>' +
        d.vars.map(function (v, vi) {
          return '<th>' + esc(v.label) + '<select class="nv-mode" onchange="TIDN.varMode(' + vi + ',this.value)">' +
            ['固定值', '区间'].map(function (m) { return '<option' + (m === v.mode ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></th>';
        }).join('') + '<th>标称值</th><th class="ms-op">操作<span class="op-add" onclick="TIDN.addNRow()">＋</span></th></tr></thead><tbody>' +
        d.rows.map(function (r, ri) {
          return '<tr>' + d.vars.map(function (v, vi) {
            if (v.mode === 'interval') {
              var c = r[vi] && typeof r[vi] === 'object' ? r[vi] : { a: '', b: '' };
              return '<td><span class="nv-int"><input type="text" value="' + esc(c.a) + '" placeholder="下限" oninput="TIDN.setNRow(' + ri + ',' + vi + ',\'a\',this.value)" />' +
                '<span>≤S≤</span><input type="text" value="' + esc(c.b) + '" placeholder="上限" oninput="TIDP_setB(' + ri + ',' + vi + ',this.value)" /></span></td>';
            }
            var opts = (specs.filter(function (x) { return x.name === v.label; })[0] || {}).options || [];
            return '<td><select onchange="TIDN.setNRow(' + ri + ',' + vi + ',\'v\',this.value)"><option value="">请选择</option>' +
              opts.map(function (o) { return '<option' + (o === r[vi] ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></td>';
          }).join('') + '<td><input type="text" value="' + esc(r[d.vars.length]) + '" placeholder="请输入" oninput="TIDN.setNRow(' + ri + ',' + d.vars.length + ',\'v\',this.value)" /></td>' +
            '<td class="ms-op"><span class="op-del" onclick="TIDP.delNRow(' + ri + ')">−</span></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="pm-need">请先勾选至少一个自变量</div>');
  }
  global.TIDP_setB = function (ri, vi, v) { var r = ND.d.rows[ri]; if (typeof r[vi] !== 'object') r[vi] = { a: '', b: '' }; r[vi].b = v; };
  N.setN = function (k, v) { ND.d[k] = v; if (k === 'type') nomModal(); };
  N.setV = function (k, v) { ND.d.v[k] = v; if (k === 'negOn' || k === 'posOn') nomModal(); };
  N.setMulti = function (v) {
    ND.d.multi = v;
    if (v && !ND.d.rows.length) ND.d.rows = [];
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
  N.addNRow = function () {
    var d = ND.d, n = d.vars.length + 1;
    d.rows.push(new Array(n).fill('').map(function (x, i) { return d.vars[i] && d.vars[i].mode === '区间' ? { a: '', b: '' } : x; }));
    nomModal();
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
    if (miss.length) { U.toast('缺少必填项：' + miss.join('、')); return; }
    var g = nomGroups()[ND.gi];
    // 多行映射时把当前子项写进 sub；单行保留原值
    var out = clone(d);
    if (ND.ii >= 0) g.items[ND.ii] = out; else g.items.push(out);
    U.host().innerHTML = ''; renderNom();
  };
  N.copyDlg = function () {
    var tree = [];
    (TID.ctx && TID.ctx.path ? TID.ctx.path.split('/') : []).forEach(function (p, i) { tree.push({ d: i, t: p }); });
    U.testList().forEach(function (tn) {
      tree.push({ d: 3, t: tn });
      var seed = SEED_N[tn];
      (seed || []).forEach(function (g) { g.items.forEach(function (it) { tree.push({ d: 4, t: it.name }); }); });
    });
    var inner = '<div class="pm-grid" style="grid-template-columns:1fr"><div class="pm-fi">' +
      '<span class="pm-lab req">请选择要复制的标称值：</span><span class="pm-ctl">' +
      '<select size="12" id="nvCopy" style="height:auto">' + tree.map(function (n) {
        return '<option' + (n.d > 2 ? ' disabled' : '') + '>' + Array(n.d + 1).join('　') + (n.d ? '▾ ' : '') + esc(n.t) + '</option>';
      }).join('') + '</select></span></div></div>';
    U.modalShell('复制标称值', inner, 'TIDN.copyOk()', '确 定', 1);
  };
  N.copyOk = function () {
    var s = $('nvCopy');
    if (!s || s.selectedIndex < 0) { U.toast('请选择一个标称值'); return; }
    var label = s.options[s.selectedIndex].textContent.replace(/[▾　]/g, '').trim();
    var found = null;
    Object.keys(SEED_N).forEach(function (k) {
      SEED_N[k].forEach(function (g) { g.items.forEach(function (it) { if (it.name === label) found = clone(it); }); });
    });
    if (!found) { U.toast('原型内仅预置了「结构尺寸检查」的标称值可复制'); return; }
    found.sub = norm()[N.rail] || found.sub;
    nomGroups()[N.rail].items.push(found);
    U.host().innerHTML = ''; renderNom();
    U.toast('已复制标称值「' + found.name + '」到当前试验子项');
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
      LEVELS.map(function (m) { return '<label><input type="radio" name="jdL" value="' + m + '"' + (j.level === m ? ' checked' : '') + ' onchange="TIDJ.set(\'level\',this.value)" />' + m + '</label>'; }).join('') +
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
  function condCard(c, i) {
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
    condRender();
  }
  function condRender() {
    var j = judge(), isConcl = j.ruleMode === '判定对比';
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
        CMP_OPS.map(function (o) { return '<option' + (o === CD.cmp ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></div>' +
        '<div><span class="pm-mut">' + (side === '标称值对比' ? '标称值：' : '') + '</span><div class="jd-row">' +
        (side === '标称值对比'
          ? '<select onchange="TIDJ.setC(\'right\',this.value)"><option value="">请选择</option>' + nomNames().map(function (n) {
            return '<option' + (n === CD.right ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>' +
            '<span class="jd-star">*</span><span class="jd-pct">百分比 %</span><select><option>+</option><option>-</option></select>' +
            '<input type="text" placeholder="输入数值" />'
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
  function nomNames() {
    var out = [];
    nomGroups().forEach(function (g) { g.items.forEach(function (it) { out.push(it.name + (it.unit ? '（' + it.unit + '）' : '')); }); });
    return out;
  }
  J.setC = function (k, v) {
    var parts = k.split('.'), o = CD;
    for (var i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = v;
    if (k === 'leftType' || k === 'branch' || k === 'rightWhat') condRender();
  };
  J.side = function (s) { CD._side = s; CD.side = s; condRender(); };
  J.addVal = function (v) { if (v && CD.values.indexOf(v) < 0) CD.values.push(v); condRender(); };
  J.delVal = function (i, ev) { ev.stopPropagation(); CD.values.splice(i, 1); condRender(); };
  J.condOk = function () {
    var j = judge();
    if (j.ruleMode === '判定对比') { if (!CD.source || !CD.op || !CD.values.length) { U.toast('请补全判定参数、对比符号与目标结论'); return; } }
    else {
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
    (st.controls || []).forEach(function (c) { rows.push(mk('预设值', c.name, c.code || c.symbol, c.unit, '', cfg)); });
    if (global.TIDM && TIDM.groups) { TIDM.groups('m'); TIDM.groups('c'); }   // 统一视图：先把两个子 Tab 的参数装载出来
    (st.measures || []).forEach(function (g) { g.params.forEach(function (p) {
      rows.push(mk('测量参数', p.name, p.code, p.unit, '', cfg, p.type !== '文字')); }); });
    (st.calcs || []).forEach(function (g) { g.params.forEach(function (p) { rows.push(mk('计算参数', p.name, p.code, p.unit, p.bind, cfg)); }); });
    nomGroups().forEach(function (g) { g.items.forEach(function (it) { rows.push(mk('标称值', it.name, it.symbol || codeOf(it), it.unit, '', cfg)); }); });
    function mk(type, name, code, unit, bind, o, coverDefault) {
      var key = type + '|' + name;
      var hit = o[key] || (o[key] = {});
      return { type: type, name: name, code: code || '—', bind: bind || '—', unit: unit || '',
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
          '<td>' + esc(r.bind) + '</td><td></td><td>' + esc(r.unit) + '</td>' +
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
