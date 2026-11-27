/**
 * F2 校稿表格视图（先做 90_标称值 / A1_判定条件 两张真实 sheet）
 * 设计依据 docs/ai-workbench-page-design-v0.1.md 第五节。
 * 数据 = scripts/excel-contract/contract.py 对 DS 实壁类塑料电缆导管的真实转换产物（对象行，按列名取值）。
 */
(function (global) {
  'use strict';
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var SHEETS = ['90_标称值', 'A1_判定条件', '61_映射明细', '70_测量参数', '80_计算参数', '60_控制参数', 'B0_采集配置'];
  var CN = { '90_标称值': '标称值', 'A1_判定条件': '判定条件', '61_映射明细': '映射数据行',
    '70_测量参数': '实测值', '80_计算参数': '计算值', '60_控制参数': '预设值', 'B0_采集配置': '采集顺序' };
  var KEYCOL = { '90_标称值': '标称值键', 'A1_判定条件': '试验项键', '61_映射明细': '归属键',
    '70_测量参数': '参数键', '80_计算参数': '参数键', '60_控制参数': '参数键', 'B0_采集配置': '参数键' };
  /* 空值语义化：留空往往不是"没填"，而是"现在还不能填"——不说清楚就会被当成丢数据 */
  var EMPTY_HINT = {
    '对比符号': '待推导', '报告展开式': '待生成', '被对比标称值键': '未指定', '对比参数键': '未指定',
    '单值': '—', '最小值': '—', '最大值': '—', '公式': '—', '修约方式': '未配', '多行映射': '否'
  };
  function hint(sh, c, v) {
    if (String(v).trim()) return null;
    if (sh === 'A1_判定条件' && c === '对比符号') return '待推导';
    return EMPTY_HINT[c] || null;
  }
  var DERIVED = { '90_标称值': ['报告展开式'], 'A1_判定条件': ['报告展开式'], '61_映射明细': [],
    '70_测量参数': [], '80_计算参数': ['规范公式', '符号对照'], '60_控制参数': [], 'B0_采集配置': ['计算顺序'] };
  var FRONT = {
    '61_映射明细': ['归属键', '行号', '自变量序号', '自变量类型', '自变量键', '自变量形态', '自变量值',
      '自变量下限', '自变量上限', '区间下限符号', '区间上限符号', '因变量1', '因变量2', '因变量3',
      '因变量1符号', '因变量2符号'],
    '70_测量参数': ['参数键', '试验项键', '名称', '编码', '符号', '类型', '单位', '测量次数', '修约方式', '修约精度', '条件修约', '排序'],
    '80_计算参数': ['参数键', '试验项键', '名称', '编码', '符号', '单位', '计算类型', '公式原文', '符号对照', '规范公式', '公式库键', '修约方式', '修约精度', '排序'],
    '60_控制参数': ['参数键', '试验项键', '名称', '符号', '单位', '是否开启映射', '映射类型', '固定值', '超出范围处理', '试验检测显示', '排序', '备注'],
    'B0_采集配置': ['参数键', '类型', '参数编码', '计算顺序', '是否覆盖LIMS参数'],
    '90_标称值': ['标称值键', '试验项键', '标称值名称', '符号', '单位', '标称值类型', '多行映射', '单值',
      '最小值符号', '最小值', '最大值符号', '最大值', '负偏差', '正偏差', '公式', '修约方式', '修约精度', '原文说明'],
    'A1_判定条件': ['试验项键', '条件序号', '条件类型', '对比符号', '报告展开式', '被对比标称值键', '对比参数键',
      '被对比参数键', '自定义数值', '修饰符百分比', '修饰符符号', '修饰符常量', '子项结论来源', '子项键', '原文条件']
  };
  var ST = { sheet: SHEETS[0], sel: -1, edits: {}, hl: null, derived: 0, dFilter: '全部' };
  var EXTRA = { '90_标称值': ['报告展开式'] };   // 界面派生列，契约里不落存储列

  function cleanUnit(u) {
    u = String(u || '').trim();
    return (!u || /^[\s\u2014\u2013\-/、.,·—–]+$/.test(u)) ? '' : u;
  }
  function cellOf(sh, ri, col) {
    var k = sh + '|' + ri + '|' + col;
    if (ST.edits[k] !== undefined) return String(ST.edits[k]);
    var r = SEED[sh] && SEED[sh].rows[ri];
    return r ? String(r[col] == null ? '' : r[col]) : '';
  }
  function valExpr(type, v1, v2, v3, sym1, u) {
    var sfx = u ? ' ' + u : '';
    if (type === '最小值') return (sym1 || '≥') + (v1 || '…') + sfx;
    if (type === '最大值') return (sym1 || '≤') + (v1 || '…') + sfx;
    if (type === '范围') return '∈[' + (v1 || '…') + ', ' + (v2 || '…') + ']' + sfx;
    if (type === '公差') {
      if (v1 && v2 && v2 === v3) return v1 + '±' + v2 + sfx;
      if (v1 && (v2 || v3)) return v1 + (v2 ? '+' + v2 : '') + (v3 ? '-' + v3 : '') + sfx;
      return (v1 || '…') + sfx;
    }
    if (type === '公式') return '按公式计算' + sfx;
    return (v1 || '…') + sfx;
  }
  /* 一条标称值 → 报告展开式（多行映射逐行列出） */
  function nominalExpr(nomRi) {
    var sh = '90_标称值';
    var type = cellOf(sh, nomRi, '标称值类型') || '单值';
    var u = cleanUnit(cellOf(sh, nomRi, '单位'));
    if (cellOf(sh, nomRi, '多行映射') === '是') {
      var key = cellOf(sh, nomRi, '标称值键');
      var m = (SEED['61_映射明细'] || {}).rows || [], by = {}, order = [];
      m.forEach(function (x, i) {
        if (x['归属键'] !== key) return;
        var rn = String(x['行号'] || i + 1);
        if (!by[rn]) { by[rn] = []; order.push(rn); }
        by[rn].push(i);
      });
      if (!order.length) return '多行映射=是 但 61 无数据行（缺映射，见收件箱）';
      var su = {};
      ((SEED['30_规格参数'] || {}).rows || []).forEach(function (x) { su[x['规格键']] = cleanUnit(x['单位']); });
      return order.map(function (rn) {
        var idxs = by[rn], d = SEED['61_映射明细'].rows[idxs[0]], lhs = [], seen = {};
        idxs.forEach(function (i2) {
          var x = SEED['61_映射明细'].rows[i2];
          var v = cellOf('61_映射明细', i2, '自变量值');
          if (!v) {
            var lo = cellOf('61_映射明细', i2, '自变量下限'), hi = cellOf('61_映射明细', i2, '自变量上限');
            if (!lo && !hi) return;
            v = (cellOf('61_映射明细', i2, '区间下限符号') || '≥') + (lo || '…') + ' ~ ' +
                (cellOf('61_映射明细', i2, '区间上限符号') || '≤') + (hi || '…');
          }
          var un = su[x['自变量键'] || ''];
          if (un && v.indexOf('~') < 0 && v.slice(-un.length) !== un) v += un;
          if (!seen[v]) { seen[v] = 1; lhs.push(v); }
        });
        var rhs = valExpr(type, cellOf('61_映射明细', idxs[0], '因变量1'), cellOf('61_映射明细', idxs[0], '因变量2'),
                          cellOf('61_映射明细', idxs[0], '因变量3'), cellOf('61_映射明细', idxs[0], '因变量1符号'), u);
        return (lhs.length ? lhs.join('且') + '→' : '') + rhs;
      }).join('、');
    }
    if (type === '公式') return '按公式 ' + (cellOf(sh, nomRi, '公式') || '…') + ' 计算后判定';
    if (type === '单值') return (cellOf(sh, nomRi, '单值') || '…') + (u ? ' ' + u : '');
    if (type === '公差') {
      var pos = cellOf(sh, nomRi, '正偏差'), neg = cellOf(sh, nomRi, '负偏差'), base = cellOf(sh, nomRi, '单值') || '…';
      return base + (pos && neg ? (pos === neg ? '±' + pos : '+' + pos + '/-' + neg)
                    : (pos ? '+' + pos : (neg ? '-' + neg : '…'))) + (u ? ' ' + u : '');
    }
    if (type === '最小值') return (cellOf(sh, nomRi, '最小值符号') || '≥') + (cellOf(sh, nomRi, '最小值') || '…') + (u ? ' ' + u : '');
    if (type === '最大值') return (cellOf(sh, nomRi, '最大值符号') || '≤') + (cellOf(sh, nomRi, '最大值') || '…') + (u ? ' ' + u : '');
    if (type === '范围') {
      var lb = (cellOf(sh, nomRi, '最小值符号') || '≥') === '>' ? '(' : '[';
      var rb = (cellOf(sh, nomRi, '最大值符号') || '≤') === '<' ? ')' : ']';
      return '∈' + lb + (cellOf(sh, nomRi, '最小值') || '…') + ', ' + (cellOf(sh, nomRi, '最大值') || '…') + rb + (u ? ' ' + u : '');
    }
    return '';
  }
  /* A1 的报告展开式 = 被对比标称值的展开式；没定标称值就是「待生成」 */
  function a1Expr(ri) {
    var key = cellOf('A1_判定条件', ri, '被对比标称值键');
    if (!key) return '待生成';
    var rs = SEED['90_标称值'].rows;
    for (var i = 0; i < rs.length; i++) if (rs[i]['标称值键'] === key) return nominalExpr(i);
    return '待生成';
  }
  function derivedVal(sh, ri, col) {
    if (col !== '报告展开式') return null;
    if (sh === '90_标称值') return nominalExpr(ri);
    if (sh === 'A1_判定条件') return a1Expr(ri);
    if (sh === '80_计算参数') {
      var f = cellOf(sh, ri, '公式原文');
      return f ? '待转译' : '';
    }
    return null;
  }
  function recomputeAll() {
    var before = ST.derived;
    var n = 0;
    (SEED['90_标称值'].rows || []).forEach(function (r, i) { derivedVal('90_标称值', i, '报告展开式'); n++; });
    (SEED['A1_判定条件'].rows || []).forEach(function (r, i) { derivedVal('A1_判定条件', i, '报告展开式'); n++; });
    ST.derived = n; return n - before;
  }
  var SEED = null;

  function applyExternalAt(sh, ri, col, v) {
    ST.edits[sh + '|' + ri + '|' + col] = v;
    ST.ext = ST.ext || {}; ST.ext[sh + '|' + ri + '|' + col] = v;
  }

  function cols(sh) {
    var all = SEED[sh].cols.slice(), ex = EXTRA[sh] || [];
    ex.forEach(function (c) { if (all.indexOf(c) < 0) all.push(c); });
    var f = (FRONT[sh] || []).slice();
    ex.forEach(function (c) { if (f.indexOf(c) < 0) f.splice(Math.max(0, f.length - 1), 0, c); });
    return f.filter(function (c) { return all.indexOf(c) >= 0; })
      .concat(all.filter(function (c) { return f.indexOf(c) < 0; }));
  }
  function rows(sh) { return SEED[sh].rows; }
  function val(sh, r, c, ri) {
    var k = sh + '|' + ri + '|' + c;
    if (ST.edits[k] !== undefined) return ST.edits[k];
    if (DERIVED[sh].indexOf(c) >= 0 || (EXTRA[sh] || []).indexOf(c) >= 0) {
      var d = derivedVal(sh, ri, c);
      if (d !== null) return d;
    }
    return r[c] || '';
  }
  function keyOf(sh, r) { return r[KEYCOL[sh]] || ''; }

  /* ── 单元格置信度：默认「未验证」（Word 拆解值未经检测依据标准文件验证），C0 命中则降级 ── */
  function confOf(sh, r, col) {
    var list = (SEED.conf || {})[sh] || [], k = keyOf(sh, r);
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!(e.row === k || String(e.row).indexOf(k) === 0 || k.indexOf(e.row) === 0)) continue;
      var hit = String(e.col).split('/');
      if (e.col === '*' || hit.indexOf(col) >= 0) return e;
    }
    return null;
  }
  var DOT = { '已验证': '#16a34a', '冲突': '#dc2626', '未验证': '#d97706', 'AI推断': '#143C9A', '无来源': '#94a3b8' };

  function render() {
    var el = document.getElementById('f2Body'); if (!el || !SEED) return;
    var sh = ST.sheet, cs = cols(sh), rs = rows(sh);
    document.getElementById('f2Tabs').innerHTML = SHEETS.map(function (s) {
      return '<span class="f2-tab' + (s === sh ? ' on' : '') + '" onclick="F2.sheet(\'' + s + '\')">' +
        esc(s) + '<small>' + (CN[s] || '') + ' · ' + (SEED[s].rows || []).length + ' 行</small></span>';
    }).join('');
    var mine = Object.keys(ST.edits).filter(function (k) { return k.indexOf(sh + '|') === 0; }).length;
    document.getElementById('f2Cnt').innerHTML =
      '<span>共 <b>' + rs.length + '</b> 行</span>' +
      '<span>本页挂起问题 <b class="' + (pageIssues(sh) ? 'warn' : 'ok') + '">' + pageIssues(sh) + '</b> 条</span>' +
      '<span>已人工修改 <b class="' + (mine ? 'ok' : '') + '">' + mine + '</b> 格</span>' +
      '<span class="lg"><i style="background:#d97706"></i>未验证<i style="background:#2563eb"></i>AI推断<i style="background:#dc2626"></i>冲突<i style="background:#94a3b8"></i>无来源</span>';

    var head = '<tr><th class="stick">' + esc(cs[0]) + '</th>' + cs.slice(1).map(function (c) {
      return '<th>' + esc(c) + (DERIVED[sh].indexOf(c) >= 0 ? '<i class="fa fa-lock ro" title="派生列，改源列自动重算"></i>' : '') + '</th>';
    }).join('') + '<th class="stickr">操作</th></tr>';

    var body = rs.map(function (r, ri) {
      var skipped = issueMode(sh, r) === 'skip';
      return '<tr class="' + (ri === ST.sel ? 'sel ' : '') + (skipped ? 'skipped' : '') + '" data-ri="' + ri + '" onclick="F2.sel(' + ri + ')">' +
        r2cells(sh, r, ri, cs) + '<td class="stickr"><span class="wb-loc" onclick="F2.trace(event,' + ri + ')">溯源</span></td></tr>';
    }).join('');
    el.innerHTML = '<table class="f2-tbl"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
    if (ST.hl) applyHl();
    renderGate();
    if (global.WB && WB.sync) WB.sync();
  }
  function r2cells(sh, r, ri, cs) {
    return cs.map(function (c, ci) {
      var v = val(sh, r, c, ri), e = confOf(sh, r, c), ro = DERIVED[sh].indexOf(c) >= 0;
      var edited = ST.edits[sh + '|' + ri + '|' + c] !== undefined;
      return '<td' + (ci === 0 ? ' class="stick"' : '') + ' data-c="' + esc(c) + '" onclick="F2.edit(event,this)"' +
        (e ? ' title="' + esc(e.q) + '"' : '') + '>' +
        (e ? '<i class="cf" style="background:' + (DOT[e.state] || '#94a3b8') + '"></i>' : '') +
        (ro ? '<span class="ro-v">' + esc(v || (hint(sh, c, v) || '—')) + '</span>'
            : (hint(sh, c, v) && !String(v).trim()
              ? '<span class="ev" title="' + esc(hintTitle(c)) + '">' + esc(hint(sh, c, v)) + '</span>'
              : '<span class="cv">' + esc(v) + '</span>')) +
        (edited ? '<i class="ed" title="人工修改"></i>' : '') + '</td>';
    }).join('');
  }
  function hintTitle(c) {
    if (c === '对比符号') return '被对比标称值还没定，符号区是禁选态；选定标称值后由类型自动推导（V19b）';
    if (c === '报告展开式') return '派生列：符号定为「满足」后按标称值类型逐行展开';
    if (c === '被对比标称值键' || c === '对比参数键') return '判定条件仍是自然语言，键未解析——这是挂在收件箱里的问题';
    return '本行不适用该列';
  }
  /* 改了哪些列会影响多少处展开式：61 的因变量/自变量 → 该标称值 + 引用它的 A1 */
  function affected(sh, col) {
    if (sh === 'A1_判定条件') return 0;   // A1 的展开式是终端，不再向下游传导
    var keys = {};
    if (sh === '61_映射明细') {
      var m = SEED['61_映射明细'].rows, hit = null;
      // 定位被改的那一行归属哪个标称值：用 edits 反查
      for (var i = 0; i < m.length; i++) if (ST.edits[sh + '|' + i + '|' + col] !== undefined) keys[m[i]['归属键']] = 1;
    } else if (sh === '90_标称值') {
      var r90 = SEED['90_标称值'].rows;
      for (var j = 0; j < r90.length; j++) if (ST.edits[sh + '|' + j + '|' + col] !== undefined) keys[r90[j]['标称值键']] = 1;
    }
    var n = 0, a1 = SEED['A1_判定条件'].rows || [];
    a1.forEach(function (x) { if (keys[x['被对比标称值键']]) n++; });
    return { nom: Object.keys(keys).length, a1: n };
  }
  function pageIssues(sh) { return ((SEED.conf || {})[sh] || []).length; }
  function issueMode(sh, r) {
    var k = keyOf(sh, r), st = WB.state ? WB.state() : {};
    var list = (SEED.conf || {})[sh] || [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!(e.row === k || String(e.row).indexOf(k) === 0 || k.indexOf(e.row) === 0)) continue;
      var a = st[e.id];
      if (a && a.mode === 'skip') return 'skip';
    }
    return '';
  }

  /* ── 定稿门控 ── */
  function renderGate() {
    var g = document.getElementById('f2Gate'); if (!g) return;
    var st = WB.state ? WB.state() : {}, un = 0, sk = 0;
    (WB.raws() || []).forEach(function (q) {
      var a = st[q.id]; if (!a) un++; else if (a.mode === 'skip') sk++;
    });
    var ok = un === 0 && sk === 0;
    g.innerHTML = '<span>未答<b class="' + (un ? 'warn' : 'ok') + '">' + un + '</b></span>' +
      '<span>已跳过<b class="' + (sk ? 'warn' : 'ok') + '">' + sk + '</b><small>F3 二次确认</small></span>' +
      '<span>阻断<b class="warn">2</b><small>待答即消除</small></span>' +
      '<span>真缺陷<b class="ok">0</b></span>' +
      '<button class="btn-save" ' + (ok ? '' : 'disabled title="还有未答或跳过的待定项，不能定稿"') +
      ' onclick="F2.finalize()">定 稿</button>';
  }

  /* ── 溯源抽屉 ── */
  function trace(ri) {
    var sh = ST.sheet, r = rows(sh)[ri], k = keyOf(sh, r);
    var list = (SEED.conf || {})[sh] || [];
    var qs = list.filter(function (e) { return e.row === k || String(e.row).indexOf(k) === 0 || k.indexOf(e.row) === 0; });
    document.getElementById('f2Drawer').innerHTML =
      '<div class="f2-dh"><b>' + esc(k) + '</b><span class="cn">' + esc(CN[sh]) + ' · ' + esc(r['标称值名称'] || r['条件类型'] || '') + '</span>' +
      '<i class="fa fa-times" onclick="F2.closeDrawer()"></i></div>' +
      '<div class="f2-src"><h5>这行从哪来</h5>' +
      '<div class="r">来源文件 <code>DS实壁类塑料电缆导管_参数配置文档_V1.2.docx</code></div>' +
      '<div class="r">解析路径 <code>' + esc(sh === '90_标称值' ? '4.5 标称值配置' : 'x.6 结果判定') + '</code></div>' +
      '<div class="r">权威校验 <b>未做</b>——值来自人工拆解稿，尚未回到检测依据标准文件验证，默认置信度「未验证」</div>' +
      (r['试验项键'] && SEED.tests[sh === 'A1_判定条件' ? r['试验项键'] : r['试验项键']] ?
        '<div class="r">所属试验项 <code>' + esc(r['试验项键']) + '</code> ' + esc(SEED.tests[r['试验项键']] || '') + '</div>' : '') +
      '</div>' +
      '<div class="f2-fields"><h5>全字段</h5>' + cols(sh).map(function (c) {
        var v = val(sh, r, c, ri);
        return '<div class="fr"><span>' + esc(c) + '</span><b title="' + esc(v) + '">' + esc(v || '—') + '</b></div>';
      }).join('') + '</div>' +
      '<div class="f2-q"><h5>相关问题 ' + qs.length + ' 条</h5>' + (qs.length ? qs.map(function (e) {
        var a = (WB.state() || {})[e.id];
        return '<div class="qr"><div>' + esc(e.q) + '</div><div class="m">' +
          (a ? (a.mode === 'skip' ? '<span class="wb-skip">已跳过 · F3 再问</span>'
                              : '<span class="wb-ans">已答：' + esc(a.other || a.choice) + '</span>')
             : '<span class="wb-must">未答</span>') +
          '<span class="wb-loc" onclick="WB.stage(\'f1\',\'' + esc(e.id) + '\')">去回答</span></div></div>';
      }).join('') : '<div class="r" style="color:#16a34a">本行没有挂起的问题。</div>') + '</div>';
    document.getElementById('f2Drawer').classList.add('show');
  }

  /* ── 交互 ── */
  var F2 = {
    render: function () { render(); },
    init: function (seed) { SEED = seed; render(); },
    sheet: function (s) { ST.sheet = s; ST.sel = -1; ST.hl = null; render(); },
    dfilter: function (v) { ST.dFilter = v; renderDiff(); },
    sel: function (ri) { ST.sel = ri; render(); trace(ri); },
    trace: function (ev, ri) { ev.stopPropagation(); ST.sel = ri; render(); trace(ri); },
    closeDrawer: function () { document.getElementById('f2Drawer').classList.remove('show'); },
    edit: function (ev, td) {
      ev.stopPropagation();
      if (td.querySelector('input')) return;
      var tr = td.parentNode, ri = +tr.getAttribute('data-ri'), sh = ST.sheet, col = td.getAttribute('data-c');
      if (DERIVED[sh].indexOf(col) >= 0) return;
      var cur = val(sh, rows(sh)[ri], col, ri);
      td.innerHTML = '<input value="' + esc(cur) + '" />';
      var inp = td.querySelector('input'); inp.focus(); inp.select();
      var done = false;
      function commit() {
        if (done) return; done = true;
        var v = inp.value.trim();
        if (v !== cur) {
          ST.edits[sh + '|' + ri + '|' + col] = v;
          recomputeAll();
          if (WB.say) {
            var aff = affected(sh, col);
            if (aff.nom) {
              WB.say('sys', '系统', '联动重算报告展开式：本条标称值 <b>1</b> 处' +
                (aff.a1 ? '，引用它的判定条件 <b>' + aff.a1 + '</b> 处'
                        : '，引用它的判定条件 <b>0</b> 处（被对比标称值键还没解析，' +
                          '解析后会自动跟着变；见收件箱 A1 那批问题）') +
                '。<span class="tg">配置显示「满足」，报告打印按类型展开</span>');
            }
            WB.say('me', '业务专家', '直接改格 <span class="tg">' + esc(sh) + '</span><span class="tg">' +
              esc(keyOf(sh, rows(sh)[ri])) + '</span><span class="tg">' + esc(col) + '</span> ' + esc(cur || '∅') + ' → <b>' + esc(v || '∅') + '</b>');
            WB.say('sys', '系统', '该格来源角标转「人工确认」。');
          }
        }
        setTimeout(render, 0);
      }
      inp.onblur = commit;
      inp.onkeydown = function (e) { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { done = true; setTimeout(render, 0); } };
    },
    applyExternal: function (ri, col, v) { applyExternalAt(ST.sheet, ri, col, v); },
    applyExternalAt: function (sh, ri, col, v) { applyExternalAt(sh, ri, col, v); },
    showExternalDiff: function (patches) {
      ST.sheet = patches[0].sheet; ST.extList = patches.slice(); render();
    },
    /* ── 三方对比：库内基线 ↔ 本次上传 ↔ AI 原稿 ── */
    openDiff: function () { ST.diff = buildDiff(); renderDiff(); },
    closeDiff: function () { ST.diff = null; ST.dFilter = '全部'; document.getElementById('f2Diff').classList.remove('show'); render(); },
    accept: function (i) { var d = ST.diff.list[i]; d.verdict = 'accept'; applyVerdict(d); renderDiff(); },
    revert: function (i) { var d = ST.diff.list[i]; d.verdict = 'revert'; renderDiff(); },
    toIssue: function (i) { var d = ST.diff.list[i]; d.verdict = 'issue'; renderDiff(); },
    acceptAll: function () {
      // 尊重已经明确「回退」的行，一键接受不覆盖人的显式决定
      ST.diff.list.forEach(function (d) {
        if (d.verdict !== 'issue' && d.verdict !== 'revert') { d.verdict = 'accept'; applyVerdict(d); }
      });
      renderDiff();
    },
    mergeUpload: function () { mergeUpload(); },
    finalize: function () {
      if (WB.markFinal) WB.markFinal();
      if (WB.say) WB.say('sys', '系统', '稿件转 <b>v' + (global.ORCver || 1) + '-final</b> 定稿并锁定。定稿稿件不可变，再改需开新版本。');
      renderGate();
    },
    locate: function (sh, rowkey, col) {
      if (!SEED || SHEETS.indexOf(sh) < 0) return false;
      ST.sheet = sh; ST.hl = { row: rowkey, col: col };
      return true;
    },
    state: function () { return ST; }
  };
  function applyVerdict(d) {
    var k = d.sheet + '|' + d.ri + '|' + d.col;
    if (d.verdict === 'accept') {
      ST.edits[k] = d.upload;
      recomputeAll();
      if (WB.say) WB.say('sys', '系统', '接受线下改动 <span class="tg">' + esc(d.sheet) + '</span><span class="tg">' +
        esc(d.row) + '</span><span class="tg">' + esc(d.col) + '</span> ' + esc(d.baseline || '∅') + ' → <b>' + esc(d.upload) + '</b>');
    } else if (d.verdict === 'revert') {
      if (ST.edits[k] !== undefined && String(ST.edits[k]) === String(d.upload)) delete ST.edits[k];
      recomputeAll();
    }
  }
  /* ── 三方对比：跨全部 sheet 逐格比对 库内基线 ↔ 本次上传 ↔ AI 原稿 ──
   * 差异不是随手编的：每个 sheet 的"人改"与"冲突"都对应真实校验规则，
   * 冲突项必须处置掉才能合并，否则等于把线下 Excel 的错直接灌进稿件。 */
  var MUT = [
    { sh: '90_标称值', col: '最小值', kind: '人改', dlt: 1, why: '专家按标准表3 复核后微调' },
    { sh: '90_标称值', col: '修约精度', kind: 'AI 重算', dlt: 1, why: '修约方式改动后派生值重算' },
    { sh: '61_映射明细', col: '因变量1', kind: '人改', dlt: 1, why: '档位对应值按新版标准表更正' },
    { sh: '61_映射明细', col: '自变量值', kind: '冲突', fixed: 'SN24-99', why: '改成非档位写法，61 与 30 规格参数对不上（V04/V15）' },
    { sh: '70_测量参数', col: '修约精度', kind: '人改', dlt: 1, why: '按记录单小数位统一' },
    { sh: '70_测量参数', col: '测量次数', kind: '冲突', fixed: '0', why: '测量次数=0，采集配置与公式数组运算都会崩（V14）' },
    { sh: '80_计算参数', col: '修约精度', kind: '人改', dlt: 1, why: '结果位数按报告模板调整' },
    { sh: '80_计算参数', col: '公式原文', kind: '冲突', fixed: '(A + B', why: '括号不闭合，规范公式无法计算（V13）' },
    { sh: '60_控制参数', col: '固定值', kind: '人改', dlt: 1, why: '预设值按设备量程修正' },
    { sh: '60_控制参数', col: '映射类型', kind: '冲突', fixed: '组合映射', why: '改成组合映射但 61 里不足 2 个自变量（V07）' },
    { sh: 'B0_采集配置', col: '计算顺序', kind: '冲突', fixed: '1', why: '顺序改成 1，与已有序号重复，拓扑序断裂（V23）' },
    { sh: 'B0_采集配置', col: '是否覆盖LIMS参数', kind: '人改', flip: true, why: '该参数改由 LIMS 侧维护' },
    { sh: 'A1_判定条件', col: '修饰符常量', kind: '人改', dlt: 1, why: '判定容差按新版标准收紧' },
    { sh: 'A1_判定条件', col: '对比符号', kind: '冲突', fixed: '≥', why: '被对比标称值是非单值，符号由类型推导为「满足」，不能手填（V19）' },
    { sh: 'A2_结论映射', col: '阈值', kind: '冲突', fixed: '11', why: '阈值 11 超过计数对象总条数 10（V28b）' },
    { sh: 'A2_结论映射', col: '目标结论值', kind: '人改', fixed: '未破裂', why: '按系统可选项字面统一，避免统计一个不存在的值' },
    { sh: 'A1_判定条件', col: '被对比标称值键', kind: '人改', fill: 'S01-T02-N02', why: '线下把自然语言条件补成了具体标称值键' }
  ];
  function bump(v, n) {
    var x = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
    if (isNaN(x)) return String(v) + '·改';
    return String(Math.round((x + n) * 1000) / 1000);
  }
  function buildDiff() {
    var list = [];
    MUT.forEach(function (mu) {
      var blk = SEED[mu.sh]; if (!blk) return;
      var kc = KEYCOL[mu.sh], pick = null, ri = -1;
      for (var i = 0; i < blk.rows.length; i++) {
        var r = blk.rows[i], cur = String(r[mu.col] == null ? '' : r[mu.col]).trim();
        var empty = (!cur || cur === '—' || cur === '∅');
        if (empty && !mu.fill) continue;            // 只有明确要"补空值"的才挑空格子
        if (!empty && mu.fill) continue;
        if (empty) cur = '∅';
        if (mu.col === '计算顺序' && i % 7 !== 3) continue;
        if (mu.kind === '冲突' && i % 5 !== 2) continue;
        if (mu.kind !== '冲突' && i % 5 === 2) continue;
        pick = r; ri = i; break;
      }
      if (!pick) return;
      var base = String(pick[mu.col] || '').trim() || '∅';
      var up = mu.fixed ? mu.fixed : (mu.flip ? (base === '开' ? '关' : '开') : bump(base, mu.dlt || 1));
      list.push({ sheet: mu.sh, ri: ri, row: String(pick[kc]), name: pick['标称值名称'] || pick['名称'] ||
        pick['参数编码'] || pick['归属键'] || pick[kc], col: mu.col,
        baseline: base, ai: mu.kind === 'AI 重算' ? bump(base, 1) : base, upload: up,
        kind: mu.kind, why: mu.why, verdict: mu.kind === '冲突' ? 'issue' : '' });
    });
    return { list: list, file: 'DS实壁类塑料电缆导管_稿件_专家线下.xlsx',
      at: new Date().toLocaleString('zh-CN', { hour12: false }) };
  }
  function renderDiff() {
    var el = document.getElementById('f2Diff'); if (!el) return;
    var d = ST.diff;
    el.classList.add('show');
    var sheets = []; d.list.forEach(function (x) { if (sheets.indexOf(x.sheet) < 0) sheets.push(x.sheet); });
    var nAcc = d.list.filter(function (x) { return x.verdict === 'accept'; }).length;
    var nIss = d.list.filter(function (x) { return x.verdict === 'issue'; }).length;
    var nRev = d.list.filter(function (x) { return x.verdict === 'revert'; }).length;
    var shown = d.list.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) {
      if (ST.dFilter === '冲突') return o.x.kind === '冲突';
      if (ST.dFilter && ST.dFilter !== '全部') return o.x.sheet === ST.dFilter;
      return true;
    });
    el.innerHTML = '<div class="dh"><b>三方对比</b><span>' + esc(d.file) + ' · ' + esc(d.at) + '</span>' +
      '<span class="sp">库内基线（上次定稿 / 已入库） ↔ 本次上传 ↔ AI 原稿</span>' +
      '<select onchange="F2.dfilter(this.value)">' +
      ['全部'].concat(sheets).map(function (o) {
        return '<option' + (ST.dFilter === o ? ' selected' : '') + '>' + esc(o) + '</option>';
      }).join('') + '</select>' +
      '<button class="btn-outline" onclick="F2.closeDiff()">收起</button></div>' +
      '<table class="df-tbl"><tr><th>数据</th><th>列</th><th class="b">库内基线</th><th class="a">AI 原稿</th>' +
      '<th class="u">本次上传</th><th>性质</th><th>处置</th></tr>' +
      shown.map(function (o) {
        var x = o.x, i = o.i;
        return '<tr class="' + (x.verdict || '') + (x.kind === '冲突' ? ' conf' : '') + '">' +
          '<td><b>' + esc(x.name) + '</b><code>' + esc(x.sheet) + ' · ' + esc(x.row) + '</code></td>' +
          '<td>' + esc(x.col) + '</td><td class="b">' + esc(x.baseline || '∅') + '</td>' +
          '<td class="a">' + esc(x.ai || '∅') + '</td><td class="u"><b>' + esc(x.upload) + '</b></td>' +
          '<td><span class="kd ' + (x.kind === '冲突' ? 'c' : x.kind === '人改' ? 'h' : 'r') + '">' + esc(x.kind) + '</span>' +
          '<div class="why">' + esc(x.why) + '</div></td>' +
          '<td>' + opBtns(x, i) + '</td></tr>';
      }).join('') + '</table>' +
      '<div class="df-foot"><span>接受 <b class="ok">' + nAcc + '</b> · 回退 <b>' + nRev + '</b> · 转问题 <b class="warn">' + nIss + '</b></span>' +
      '<button class="btn-outline" onclick="F2.acceptAll()">接受全部非冲突项</button>' +
      '<button class="btn-save" ' + (nIss ? 'disabled title="还有 ' + nIss + ' 条冲突没处置"' : '') +
      ' onclick="F2.mergeUpload()">合并进稿件新版本</button>' +
      '<span class="tip">规则：人改的优先；人改的与校验规则冲突时不覆盖，转为收件箱问题。</span></div>';
  }
  function opBtns(x, i) {
    if (x.verdict === 'accept') return '<span class="ok">已接受</span><button class="btn-outline xs" onclick="F2.revert(' + i + ')">撤回</button>';
    if (x.verdict === 'revert') return '<span class="ok">已回退到基线</span><button class="btn-outline xs" onclick="F2.accept(' + i + ')">改接受</button>';
    if (x.verdict === 'issue') return '<span class="warn">已转问题</span>' +
      '<button class="btn-outline xs" onclick="F2.accept(' + i + ')">按上传改</button>' +
      '<button class="btn-outline xs" onclick="F2.revert(' + i + ')">按基线改</button>';
    return '<button class="btn-save xs" onclick="F2.accept(' + i + ')">接受</button>' +
      '<button class="btn-outline xs" onclick="F2.revert(' + i + ')">回退</button>';
  }
  function mergeUpload() {
    var acc = ST.diff.list.filter(function (x) { return x.verdict === 'accept'; });
    if (!acc.length) { if (WB.toast) WB.toast('没有接受任何改动'); return; }
    var bySh = {};
    acc.forEach(function (x) { applyExternalAt(x.sheet, x.ri, x.col, x.upload); bySh[x.sheet] = (bySh[x.sheet] || 0) + 1; });
    var scope = Object.keys(bySh).map(function (k) { return k + ' ' + bySh[k] + ' 处'; }).join('、');
    ST.diff = null; ST.dFilter = '全部';
    document.getElementById('f2Diff').classList.remove('show');
    if (WB.say) {
      WB.say('sys', '系统', '线下稿件已合并进新版本：接受 <b>' + acc.length + '</b> 处（' + esc(scope) + '）；' +
        '派生列已联动重算。');
      WB.say('ai', 'AI 助手', '合并后重跑 D0 校验：真缺陷 0。要入库就说「可以入库了」，或切到 F3。');
    }
    render();
  }

  function applyHl() {
    var sh = ST.sheet, rs = rows(sh), hit = -1;
    for (var i = 0; i < rs.length; i++) {
      var k = keyOf(sh, rs[i]);
      if (k === ST.hl.row || String(k).indexOf(ST.hl.row) === 0 || ST.hl.row.indexOf(k) === 0) { hit = i; break; }
    }
    ST.hl = null;
    if (hit < 0) return;
    var tr = document.querySelector('.f2-tbl tr[data-ri="' + hit + '"]'); if (!tr) return;
    tr.classList.add('hl'); ST.sel = hit;
    var want = String(ST.hl_col || '').split('/');
    var td = tr.querySelector('td[data-c="' + want[0] + '"]');
    if (!td) {
      var tds = tr.querySelectorAll('td[data-c]');
      for (var j = 0; j < tds.length; j++) {
        var c = tds[j].getAttribute('data-c');
        if (c.indexOf('键') > 0 || c.indexOf('参数') > 0) { td = tds[j]; break; }
      }
    }
    if (td) td.classList.add('hlc');
    tr.scrollIntoView({ block: 'center' });
  }
  WB_loc_hook();
  function WB_loc_hook() {
    // 收件箱「定位到表格」把目标列也带进来
    var orig = F2.locate;
    F2.locate = function (sh, rowkey, col) { ST.hl_col = col; return orig(sh, rowkey, col); };
  }
  global.F2 = F2;
})(window);
