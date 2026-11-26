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
  var SHEETS = ['90_标称值', 'A1_判定条件'];
  var CN = { '90_标称值': '标称值', 'A1_判定条件': '判定条件' };
  var KEYCOL = { '90_标称值': '标称值键', 'A1_判定条件': '试验项键' };
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
  var DERIVED = { '90_标称值': [], 'A1_判定条件': ['报告展开式'] };
  var FRONT = {
    '90_标称值': ['标称值键', '试验项键', '标称值名称', '符号', '单位', '标称值类型', '多行映射', '单值',
      '最小值符号', '最小值', '最大值符号', '最大值', '负偏差', '正偏差', '公式', '修约方式', '修约精度', '原文说明'],
    'A1_判定条件': ['试验项键', '条件序号', '条件类型', '对比符号', '报告展开式', '被对比标称值键', '对比参数键',
      '被对比参数键', '自定义数值', '修饰符百分比', '修饰符符号', '修饰符常量', '子项结论来源', '子项键', '原文条件']
  };
  var ST = { sheet: SHEETS[0], sel: -1, edits: {}, hl: null };
  var SEED = null;

  function cols(sh) {
    var all = SEED[sh].cols, f = FRONT[sh] || [];
    return f.filter(function (c) { return all.indexOf(c) >= 0; })
      .concat(all.filter(function (c) { return f.indexOf(c) < 0; }));
  }
  function rows(sh) { return SEED[sh].rows; }
  function val(sh, r, c, ri) {
    var k = sh + '|' + ri + '|' + c;
    return ST.edits[k] !== undefined ? ST.edits[k] : (r[c] || '');
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
  var DOT = { '已验证': '#16a34a', '冲突': '#dc2626', '未验证': '#d97706', 'AI推断': '#2563eb', '无来源': '#94a3b8' };

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
          if (WB.say) {
            WB.say('me', '业务专家', '直接改格 <span class="tg">' + esc(sh) + '</span><span class="tg">' +
              esc(keyOf(sh, rows(sh)[ri])) + '</span><span class="tg">' + esc(col) + '</span> ' + esc(cur || '∅') + ' → <b>' + esc(v || '∅') + '</b>');
            WB.say('sys', '系统', '该格来源角标转「人工确认」；派生列（报告展开式）按新值重算。');
          }
        }
        setTimeout(render, 0);
      }
      inp.onblur = commit;
      inp.onkeydown = function (e) { if (e.key === 'Enter') inp.blur(); if (e.key === 'Escape') { done = true; setTimeout(render, 0); } };
    },
    finalize: function () {
      if (WB.say) WB.say('sys', '系统', '稿件转 <b>v-final</b> 定稿并锁定。定稿稿件不可变，再改需开新版本。');
      renderGate();
    },
    locate: function (sh, rowkey, col) {
      if (!SEED || SHEETS.indexOf(sh) < 0) return false;
      ST.sheet = sh; ST.hl = { row: rowkey, col: col };
      return true;
    },
    state: function () { return ST; }
  };
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
