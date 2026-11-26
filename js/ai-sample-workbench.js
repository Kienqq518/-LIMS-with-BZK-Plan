/**
 * 样品配置工作台 · 问题收件箱
 * 数据 = scripts/excel-contract/contract.py 对 DS 实壁类塑料电缆导管真实转换产出的 C0 待定项（112 条）。
 * 设计依据 docs/ai-workbench-page-design-v0.1.md 第四、五节。
 */
(function (global) {
  'use strict';
  var KEY = 'lims.wb.inbox.v1';
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var SHEET_CN = {
    '20_样品': '样品', '50_试验项': '试验项', '61_映射明细': '映射明细', '70_测量参数': '测量参数',
    '80_计算参数': '计算参数', 'A1_判定条件': '判定条件', '41_型号规格赋值': '型号规格赋值',
    '90_标称值': '标称值', '60_控制参数': '控制参数', 'B0_采集配置': '采集配置'
  };
  var TASKS = [
    { code: 'DL/T 802.3—2023', nm: '实壁类塑料电缆导管', stage: 2, q: 112, done: 0, st: '校稿中' },
    { code: 'GB/T 12706.2—2020', nm: '中压电力电缆（6kV~30kV）', stage: 1, q: 0, done: 0, st: '待补料' },
    { code: 'EN 50306-2:2020', nm: '铁路机车车辆电缆', stage: 3, q: 0, done: 0, st: '已定稿' }
  ];

  var S = { answers: {}, collapsed: {}, chat: [], run: 0, task: 0, generated: 0 };
  var RAW = [], GROUPS = [], SCOPE = [], SCOPE_G = [], MERGE = {};

  /* ── 同因合并：把「某某」这类实例名抹掉后同形的问题并成一条 ── */
  function causeKey(q) { return String(q || '').replace(/「[^」]*」/g, '◎').replace(/\d+/g, 'n').slice(0, 90); }
  function build() {
    var by = {}, order = [];
    RAW.forEach(function (q) {
      var k = q.sheet + '|' + q.col + '|' + causeKey(q.q);
      if (q.lv === '范围') {
        if (!by[k]) { by[k] = { key: k, sheet: q.sheet, col: q.col, rep: q, items: [], scope: 1 }; SCOPE_G.push(by[k]); }
        by[k].items.push(q); SCOPE.push(q); return;
      }
      if (!by[k]) { by[k] = { key: k, sheet: q.sheet, col: q.col, rep: q, items: [] }; order.push(k); }
      by[k].items.push(q);
    });
    SCOPE_G.forEach(function (m) { MERGE[m.rep.id] = idsOf(m); });
    GROUPS = [];
    var gs = {};
    order.forEach(function (k) {
      var m = by[k];
      MERGE[m.rep.id] = idsOf(m);
      if (!gs[m.sheet]) { gs[m.sheet] = { sheet: m.sheet, members: [] }; GROUPS.push(gs[m.sheet]); }
      gs[m.sheet].members.push(m);
    });
  }
  function optsOf(q) {
    var raw = String(q.cand || '').split('、').map(function (s) { return s.trim(); }).filter(Boolean);
    return raw.length ? raw : [];
  }
  function confCls(c) { c = Number(c || 0); return c <= 0 ? 'c0' : c < 0.35 ? 'c1' : c < 0.6 ? 'c2' : 'c3'; }
  function confTxt(c) { c = Number(c || 0); return c <= 0 ? '无来源' : c < 0.35 ? 'AI推断' : c < 0.6 ? '未验证' : '冲突'; }

  function answeredCount(list) { return list.filter(function (q) { return S.answers[q.id]; }).length; }
  function memberAnswered(m) { return answeredCount(m.items); }

  /* ── 渲染 ── */
  function paintHeader() {
    var el = document.getElementById('wbDoc'); if (!el) return;
    var left = SCOPE.filter(function (q) { return !S.answers[q.id]; }).length;
    var fLeft = (function () { var n = 0; allMembers().forEach(function (m) { m.items.forEach(function (q) { if (!S.answers[q.id]) n++; }); }); return n; })();
    el.innerHTML = '稿件 <b style="color:' + (S.generated ? '#15803d' : '#1e293b') + '">' +
      (S.generated ? 'v1-draft 已生成' : '未生成') + '</b> · ' +
      (left ? '范围级未答完' : (fLeft ? '字段级剩 ' + fLeft + ' 条' : '待定项已清零')) +
      (S.generated && fLeft ? ' · <span style="color:#b45309">定稿前需清零或显式忽略</span>' : '');
    var dl = document.getElementById('btnDl'); if (dl) dl.disabled = !S.generated;
  }

  function render() {
    paintHeader();
    var scopeLeft = SCOPE.filter(function (q) { return !S.answers[q.id]; }).length;
    var fieldAll = [], GROUPED = [];
    GROUPS.forEach(function (g) { g.members.forEach(function (m) { m.items.forEach(function (q) { fieldAll.push(q); }); }); });
    var fAns = answeredCount(fieldAll);

    document.getElementById('wbStats').innerHTML =
      stat(scopeLeft ? '范围级待答' : '范围级已答', (SCOPE.length - scopeLeft) + ' / ' + SCOPE.length, scopeLeft ? 'warn' : 'ok', SCOPE_G.length + ' 类问题') +
      stat('字段级已答', fAns + ' / ' + fieldAll.length, fAns === fieldAll.length ? 'ok' : '', GROUPS.length + ' 张 sheet') +
      stat('合并后卡片', GROUPS.reduce(function (a, g) { return a + g.members.length; }, 0), '',
        '原始 ' + fieldAll.length + ' 条，省 ' + (fieldAll.length - GROUPS.reduce(function (a, g) { return a + g.members.length; }, 0)) + ' 次点击') +
      stat('未决阻断', scopeLeft ? scopeLeft + 2 : 2, scopeLeft ? 'warn' : '', '含 2 项待答即消除');

    document.getElementById('wbBlock').innerHTML = scopeLeft
      ? '<i class="fa fa-exclamation-circle"></i><b>范围级问题没答完，稿件不能生成。</b>' +
        '这 ' + scopeLeft + ' 条决定「拆成什么结构」，必须先定；下面的字段级问题可以边生成边答。'
      : '<i class="fa fa-check-circle"></i>范围级已全部确认，可以生成稿件 v1-draft 了。';
    document.getElementById('wbBlock').className = 'wb-block' + (scopeLeft ? '' : ' clear');
    document.getElementById('btnRun').disabled = scopeLeft > 0;
    document.getElementById('btnRun').title = scopeLeft ? '先答完 ' + scopeLeft + ' 条范围级问题' : '';

    document.getElementById('wbScope').innerHTML = SCOPE_G.map(scopeCard).join('') || '<div class="wb-hint">本次没有范围级问题。</div>';
    document.getElementById('wbGroups').innerHTML = GROUPS.map(groupCard).join('');
    document.getElementById('wbChat').innerHTML = S.chat.map(chatRow).join('') ||
      '<div class="wb-hint">对话区记录 AI 的提问、你的回答和系统动作，全程可回溯。</div>';
    document.getElementById('wbChat').scrollTop = 9e5;
  }
  function stat(lab, val, cls, sub) {
    return '<div class="wb-stat">' + lab + '<b class="' + cls + '">' + esc(val) + '</b>' +
      '<span style="font-size:11px">' + esc(sub) + '</span></div>';
  }
  function scopeCard(m) {
    var q = m.rep, a = S.answers[q.id], o = optsOf(q), multi = m.items.length > 1;
    return '<div class="wb-group wb-scope' + (a ? ' clear' : '') + '" style="margin-bottom:8px">' +
      '<div class="wb-gb" style="padding-top:10px">' +
      '<div class="wb-q-h"><div class="wb-q-t">' + esc(q.q) + '</div>' +
      (multi ? '<span class="wb-merge" onclick="WB.rows(\'' + esc(m.key) + '\')">同因合并 ' + m.items.length + ' 条 ▾</span>' : '') +
      '<span class="wb-conf ' + confCls(q.conf) + '">' + confTxt(q.conf) + '</span></div>' +
      (multi ? '<div class="wb-rows" id="rows_' + esc(m.key) + '">' +
        m.items.map(function (x) { return '<code>' + esc(x.row) + ' · ' + esc(x.col) + '</code>'; }).join('') + '</div>' : '') +
      optRow(q, o) + qFoot(q) + '</div></div>';
  }
  function groupCard(g) {
    var total = 0, ans = 0;
    g.members.forEach(function (m) { total += m.items.length; ans += memberAnswered(m); });
    var col = S.collapsed[g.sheet];
    return '<div class="wb-group' + (col ? ' collapsed' : '') + '">' +
      '<div class="wb-gh" onclick="WB.toggle(\'' + esc(g.sheet) + '\')">' +
      '<i class="fa fa-caret-down caret"></i><span class="sh">' + esc(g.sheet) + '</span>' +
      '<span class="cn">' + (SHEET_CN[g.sheet] || '') + ' · ' + g.members.length + ' 类问题 / ' + total + ' 处</span>' +
      '<div class="prog"><i style="width:' + (total ? Math.round(ans * 100 / total) : 0) + '%"></i></div>' +
      '<span class="cn" id="gn_' + esc(g.sheet) + '">' + ans + '/' + total + '</span>' +
      '<button class="btn-outline" style="font-size:11.5px;padding:2px 9px" onclick="WB.adoptGroup(event,\'' + esc(g.sheet) + '\')">整组采纳默认值</button>' +
      '</div><div class="wb-gb">' + g.members.map(memberCard).join('') + '</div></div>';
  }
  function memberCard(m) {
    var q = m.rep, multi = m.items.length > 1, a = S.answers[q.id];
    var o = optsOf(q);
    return '<div class="wb-q' + (a ? ' answered' : '') + '" id="q_' + esc(q.id) + '">' +
      '<div class="wb-q-h"><div class="wb-q-t">' + esc(q.q) + '</div>' +
      (multi ? '<span class="wb-merge" onclick="WB.rows(\'' + esc(m.key) + '\')">涉及 ' + m.items.length + ' 处 ▾</span>' : '') +
      '<span class="wb-conf ' + confCls(q.conf) + '">' + confTxt(q.conf) + '</span></div>' +
      (multi ? '<div class="wb-rows" id="rows_' + esc(m.key) + '">' +
        m.items.map(function (x) { return '<code>' + esc(x.row) + ' · ' + esc(x.col) + '</code>'; }).join('') + '</div>' : '') +
      optRow(q, o) + qFoot(q) + '</div>';
  }
  function optInner(q, o) {
    var a = S.answers[q.id];
    if (!o.length) {
      return '<div class="wb-other show" style="margin-top:9px"><input placeholder="无候选项，直接回答：" value="' +
        esc(a ? a.other : '') + '" oninput="WB.other(\'' + esc(q.id) + '\',this.value)" /></div>';
    }
    return '<div class="wb-opts">' + o.map(function (x, i) {
      var chk = a ? (a.choice === x && !a.other) : false;
      return '<label class="wb-opt"><input type="radio" name="o_' + esc(q.id) + '" ' + (chk ? 'checked' : '') +
        ' onchange="WB.pick(\'' + esc(q.id) + '\',\'' + esc(x).replace(/'/g, '') + '\')" />' + esc(x) +
        (i === 0 ? '<span class="def">默认</span>' : '') + '</label>';
    }).join('') +
      '<label class="wb-opt"><input type="radio" name="o_' + esc(q.id) + '" ' + (a && a.other ? 'checked' : '') +
      ' onchange="WB.otherOn(\'' + esc(q.id) + '\')" />其他</label>' +
      '<div class="wb-other' + (a && (a.other || a.open) ? ' show' : '') + '" id="oth_' + esc(q.id) + '">' +
      '<input placeholder="补充说明：" value="' + esc(a ? a.other : '') + '" oninput="WB.other(\'' + esc(q.id) + '\',this.value)" /></div>';
  }
  function optRow(q, o) { return optInner(q, o); }
  function qFoot(q) {
    var a = S.answers[q.id];
    return '<div class="wb-q-f"><span class="src">' + esc(q.src) + '</span>' +
      '<span class="wb-loc" onclick="WB.loc(\'' + esc(q.sheet) + '\',\'' + esc(q.row) + '\',\'' + esc(q.col) + '\')">定位到表格</span>' +
      (a ? '<span class="wb-ans"><i class="fa fa-check"></i> ' + esc(a.other || a.choice) + '</span>' +
        '<span class="wb-undo" onclick="WB.undo(\'' + esc(q.id) + '\')">撤销</span>'
        : '<span style="color:#cbd5e1">未回答</span>') + '</div>';
  }
  function paintChat() {
    var el = document.getElementById('wbChat');
    el.innerHTML = S.chat.map(chatRow).join('') ||
      '<div class="wb-hint">对话区记录 AI 的提问、你的回答和系统动作，全程可回溯。</div>';
    el.scrollTop = 9e5;
  }
  function chatRow(c) {
    return '<div class="wb-msg ' + c.who + '"><div class="who">' + esc(c.name) + ' · ' + esc(c.at) + '</div>' +
      '<div class="bd">' + c.text + '</div></div>';
  }

  /* ── 交互 ── */
  function idsOf(m) { return m.items.map(function (x) { return x.id; }); }
  function groupOf(id) { return MERGE[id] || [id]; }
  function allMembers() { var a = []; GROUPS.forEach(function (g) { a = a.concat(g.members); }); return a; }
  function now() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function say(who, name, text) { S.chat.push({ who: who, name: name, text: text, at: now() }); }

  /* 只重画一张卡与相关计数，避免整树重渲染丢滚动位置与焦点（112 条规模下必须） */
  function paintCard(id) {
    var q = RAW.filter(function (x) { return x.id === id; })[0];
    var card = document.getElementById('q_' + id), box = card;
    if (!card) {  // 范围级卡没有 id，退化为找它所在容器
      var sc = document.querySelectorAll('#wbScope .wb-group');
      for (var i = 0; i < sc.length; i++) {
        if (sc[i].innerText.indexOf(q.q.slice(0, 18)) >= 0) { box = sc[i]; card = sc[i]; break; }
      }
    }
    if (box) {
      var a = S.answers[id];
      box.classList.toggle('answered', !!a);
      box.classList.toggle('clear', !!a && box.parentNode.id === 'wbScope');
      var f = box.querySelector('.wb-q-f'); if (f) f.innerHTML = qFoot(q);
      var wrap = box.querySelector('.wb-opts') || box.querySelector('.wb-other');
      if (wrap) { var tmp = document.createElement('div'); tmp.innerHTML = optInner(q, optsOf(q));
        wrap.parentNode.replaceChild(tmp.firstChild, wrap); }
      var inp = box.querySelector('.wb-other input'); if (inp) inp.value = a ? (a.other || '') : '';
    }
    if (q.lv === '范围') { renderScopeMeta(); return; }
    // 组进度
    var grp = card && card.closest ? card.closest('.wb-group') : null;
    if (grp) {
      var sh = grp.querySelector('.sh'), sheet = sh ? sh.textContent : '';
      var g2 = GROUPS.filter(function (x) { return x.sheet === sheet; })[0];
      if (g2) {
        var t = 0, an = 0;
        g2.members.forEach(function (m) { t += m.items.length; an += memberAnswered(m); });
        var prog = grp.querySelector('.prog i'); if (prog) prog.style.width = (t ? Math.round(an * 100 / t) : 0) + '%';
        var num = document.getElementById('gn_' + sheet); if (num) num.textContent = an + '/' + t;
      }
    }
    refreshMeta();
  }
  function renderScopeMeta() {
    var left = SCOPE.filter(function (q) { return !S.answers[q.id]; }).length;
    document.getElementById('wbBlock').innerHTML = left
      ? '<i class="fa fa-exclamation-circle"></i><b>范围级问题没答完，稿件不能生成。</b>这 ' + left +
        ' 条决定「拆成什么结构」，必须先定；下面的字段级问题可以边生成边答。'
      : '<i class="fa fa-check-circle"></i>范围级已全部确认，可以生成稿件 v1-draft 了。';
    document.getElementById('wbBlock').className = 'wb-block' + (left ? '' : ' clear');
    document.getElementById('btnRun').disabled = left > 0;
    document.getElementById('btnRun').title = left ? '先答完 ' + left + ' 条范围级问题' : '';
    var st = document.querySelectorAll('#wbStats .wb-stat');
    if (st[0]) st[0].innerHTML = (left ? '范围级待答' : '范围级已答') + '<b class="' + (left ? 'warn' : 'ok') + '">' +
      (SCOPE.length - left) + ' / ' + SCOPE.length + '</b><span style="font-size:11px">' +
      SCOPE_G.length + ' 类问题</span>';
    refreshMeta();
  }
  function refreshMeta() {
    var fieldAll = []; GROUPS.forEach(function (g) { g.members.forEach(function (m) { m.items.forEach(function (q) { fieldAll.push(q); }); }); });
    var fAns = answeredCount(fieldAll), cards = GROUPS.reduce(function (a, g) { return a + g.members.length; }, 0);
    var st = document.querySelectorAll('#wbStats .wb-stat');
    if (st[1]) st[1].innerHTML = '字段级已答<b class="' + (fAns === fieldAll.length ? 'ok' : '') + '">' + fAns + ' / ' + fieldAll.length +
      '</b><span style="font-size:11px">' + GROUPS.length + ' 张 sheet</span>';
    if (st[3]) { var sl = SCOPE.filter(function (q) { return !S.answers[q.id]; }).length;
      st[3].innerHTML = '未决阻断<b class="' + (sl ? 'warn' : '') + '">' + (2 + sl) + '</b><span style="font-size:11px">含 2 项待答即消除</span>'; }
    paintHeader();
  }

  var WB = {
    toggle: function (sh) { S.collapsed[sh] = !S.collapsed[sh]; save(); render(); },
    rows: function (k) { var e = document.getElementById('rows_' + k); if (e) e.classList.toggle('show'); },
    pick: function (id, v) {
      var q = RAW.filter(function (x) { return x.id === id; })[0];
      groupOf(id).forEach(function (x) { S.answers[x] = { choice: v, other: '' }; });
      say('me', '业务专家', esc(q ? q.q.slice(0, 34) : id) + '… → <b>' + esc(v) + '</b>');
      save(); paintCard(id); paintChat();
    },
    otherOn: function (id) {
      groupOf(id).forEach(function (x) { S.answers[x] = { choice: '', other: '', open: 1 }; });
      save(); render();
      var e = document.getElementById('oth_' + id);
      if (e) e.querySelector('input').focus();
    },
    other: function (id, v) {
      groupOf(id).forEach(function (x) {
        S.answers[x] = S.answers[x] || { choice: '', other: '', open: 1 };
        S.answers[x].other = v; S.answers[x].open = 1;
      });
      save();
      var f = document.getElementById('q_' + id);
      if (f) { var b = f.querySelector('.wb-q-f'); if (b) b.innerHTML = qFoot(RAW.filter(function (x) { return x.id === id; })[0]); }
    },
    undo: function (id) {
      groupOf(id).forEach(function (x) { delete S.answers[x]; });
      say('sys', '系统', '撤销了这一类问题的回答（共 ' + groupOf(id).length + ' 处）'); save();
      var q = RAW.filter(function (x) { return x.id === id; })[0];
      if (q && q.lv === '范围') { render(); } else { paintCard(id); }
      paintChat();
    },
    adoptGroup: function (ev, sh) {
      ev.stopPropagation();
      var g = GROUPS.filter(function (x) { return x.sheet === sh; })[0], n = 0;
      g.members.forEach(function (m) {
        var o = optsOf(m.rep); if (!o.length) return;
        idsOf(m).forEach(function (id) { S.answers[id] = { choice: o[0], other: '', batch: 1 }; n++; });
      });
      say('sys', '系统', '<b>整组采纳</b>「' + esc(sh) + '」默认值，落定 ' + n + ' 条（' + g.members.length + ' 类问题合并处理）' +
        '<span class="tg">可撤销</span>');
      save(); render();
    },
    adoptAll: function () {
      var n = 0;
      allMembers().forEach(function (m) {
        var o = optsOf(m.rep); if (!o.length) return;
        idsOf(m).forEach(function (id) { if (!S.answers[id]) { S.answers[id] = { choice: o[0], other: '', batch: 1 }; n++; } });
      });
      SCOPE.forEach(function (q) { var o = optsOf(q); if (o.length && !S.answers[q.id]) { S.answers[q.id] = { choice: o[0], batch: 1 }; n++; } });
      say('sys', '系统', '<b>全部采纳默认值</b>，落定 ' + n + ' 条。低置信度的条目已在卡片上标红，建议抽查后再定稿。');
      save(); render();
    },
    loc: function (sh, row, col) {
      say('sys', '系统', '已请求定位 <span class="tg">' + esc(sh) + '</span><span class="tg">' + esc(row) + '</span>' +
        '<span class="tg">' + esc(col) + '</span> —— F2 表格视图尚未接入，接入后此处直接跳到该行该列并高亮。');
      render();
    },
    batch: function (val) {
      var p = parseBatch(val);
      if (!p) { document.getElementById('wbPreview').classList.remove('show'); return; }
      var el = document.getElementById('wbPreview');
      el.innerHTML = '命中 <b>' + p.ids.length + '</b> 处（' + p.members.length + ' 类问题）：' + esc(p.desc) +
        '<br>将统一填为 <b>' + esc(p.value) + '</b>' +
        '<div style="margin-top:7px"><button class="btn-save" onclick="WB.batchApply()">应 用</button>' +
        '<button class="btn-outline" onclick="document.getElementById(\'wbPreview\').classList.remove(\'show\')">取 消</button></div>';
      el.classList.add('show');
      S.pending = p;
    },
    batchApply: function () {
      var p = S.pending; if (!p) return;
      p.ids.forEach(function (id) { S.answers[id] = { choice: p.value, other: '', batch: 1 }; });
      say('me', '业务专家', '批量指令：' + esc(p.raw));
      say('sys', '系统', '批量落定 ' + p.ids.length + ' 处 → <b>' + esc(p.value) + '</b>（' + esc(p.desc) + '）' +
        '<span class="tg">可撤销</span>');
      document.getElementById('wbPreview').classList.remove('show');
      document.getElementById('wbBatch').value = '';
      S.pending = null; save(); render();
    },
    run: function () {
      if (SCOPE.some(function (q) { return !S.answers[q.id]; })) return;
      var el = document.getElementById('wbRun'); el.classList.add('show');
      var stages = [['识别标准文件', 'DL/T 802.3—2023 · 命中库内 v3 成果'],
      ['任务发现', '1 个任务 · 2 个样品 / 8 个型号'],
      ['逐 sheet 生成', '22 张 · 200 参数 / 16 试验项'],
      ['跑 D0 校验', '真缺陷 0 · 阻断 2（待答即消除）']];
      var i = 0;
      document.getElementById('wbStages').innerHTML = stages.map(function (s) {
        return '<div class="wb-stage"><span class="dot"></span>' + esc(s[0]) + '<span class="out"></span></div>';
      }).join('');
      var nodes = document.querySelectorAll('#wbStages .wb-stage');
      (function step() {
        if (i > 0) { nodes[i - 1].className = 'wb-stage done'; nodes[i - 1].querySelector('.out').textContent = stages[i - 1][1]; }
        if (i >= nodes.length) {
          say('sys', '系统', '稿件 <b>v1-draft</b> 已生成，可下载给专家线下改。剩余字段级未答 ' +
            left() + ' 条；定稿前需清零或显式忽略。');
          S.generated = 1; render(); return;
        }
        nodes[i].className = 'wb-stage on'; i++; setTimeout(step, 780);
      })();
    },
    answers: function () { return S.answers; },
    reset: function () { S = { answers: {}, collapsed: {}, chat: [], run: 0, task: 0, generated: 0 }; save(); boot(); }
  };
  function left() {
    var n = 0; allMembers().forEach(function (m) { m.items.forEach(function (q) { if (!S.answers[q.id]) n++; }); });
    return n;
  }
  function parseBatch(v) {
    v = String(v || '').trim(); if (v.length < 2) return null;
    var kw = v.match(/下拉选项|可选项/), rnd = v.match(/修约/), cat = v.match(/检测类别/), nom = v.match(/判定条件|自然语言/);
    var value = (v.match(/按[是为:：]?\s*([^，,。]+)$/) || [])[1] || '';
    var members = allMembers().filter(function (m) {
      if (kw) return m.rep.col === '可选项';
      if (rnd) return m.rep.col === '修约方式';
      if (cat) return m.rep.col === '检测类别';
      if (nom) return m.rep.col.indexOf('键') > 0 && m.rep.sheet === 'A1_判定条件';
      return m.rep.q.indexOf(v) >= 0;
    });
    if (!members.length) return null;
    var ids = []; members.forEach(function (m) { ids = ids.concat(idsOf(m)); });
    return {
      ids: ids, members: members, raw: v, value: value || (optsOf(members[0].rep)[0] || ''),
      desc: kw ? '下拉选项型参数的可选项' : rnd ? '修约方式映射' : cat ? '检测类别字典命中' : nom ? '判定条件的键匹配' : '文本匹配'
    };
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ a: S.answers, c: S.collapsed, ch: S.chat.slice(-40) })); } catch (e) { }
  }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }

  function boot() {
    var d = load();
    S.answers = d.a || {}; S.collapsed = d.c || {}; S.chat = d.ch || [];
    var un = 0; allMembers().forEach(function (m) { m.items.forEach(function (q) { if (S.answers[q.id]) un++; }); });
    render();
  }

  global.WB = WB;
  global.WBInit = function (raw) {
    RAW = raw; build();
    var d = load(); S.answers = d.a || {}; S.collapsed = d.c || {}; S.chat = d.ch || [];
    render();
  };
  global.WBTasks = TASKS;
})(window);
