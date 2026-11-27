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

  var S = { answers: {}, collapsed: {}, chat: [], run: 0, task: 0, generated: 0, stage: 'f1', notified: 0, f1sub: 'inbox' };
  function mode(id) { var a = S.answers[id]; return a ? (a.mode || 'answer') : ''; }
  function cnt(f) { var n = 0; for (var k in S.answers) if (f(S.answers[k])) n++; return n; }
  function rawLeft() { var n = 0; RAW.forEach(function (q) { if (!S.answers[q.id]) n++; }); return n; }
  function skipCnt() { return RAW.filter(function (q) { return mode(q.id) === 'skip'; }).length; }
  function aiCnt() { return RAW.filter(function (q) { return mode(q.id) === 'ai'; }).length; }
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
    var fLeft = rawLeft(), sk = skipCnt(), ai = aiCnt(), ver = global.ORCver || 1;
    // 顶栏只报一个主状态，按流水线取最高位：已入库 > 已定稿 > 已生成 > 未生成
    var main = S.imported ? '<b style="color:#6d28d9">v' + ver + (S.imported === 2 ? ' 已重放' : ' 已入库') + (ai ? '（自决 ' + ai + ' 处已通知）' : '') + '</b>'
      : S.finalized ? '<b style="color:#15803d">v' + ver + '-final 已定稿</b>'
      : S.generated ? '<b style="color:#15803d">v' + ver + '-draft 已生成</b>'
      : '<b style="color:#1e293b">未生成</b>';
    var tail = S.imported
      ? (fLeft || sk ? ' · <span style="color:#b45309">仍有 ' + (fLeft + sk) + ' 处未闭环，下次入库会再拦</span>' : ' · 待定项已闭环')
      : (left ? ' · 范围级剩 ' + left + ' 处必答'
        : (fLeft ? ' · 未处置 ' + fLeft + ' 处' : (sk ? ' · 跳过 ' + sk + ' 处待 F3 再问' : ' · 待定项已清零')));
    el.innerHTML = '稿件 ' + main + tail;
    var dl = document.getElementById('btnDl'); if (dl) dl.disabled = !S.generated;
  }

  function render() {
    paintHeader();
    var scopeLeft = SCOPE.filter(function (q) { return !S.answers[q.id]; }).length;
    var skipN = skipCnt();
    var fieldAll = [], GROUPED = [];
    GROUPS.forEach(function (g) { g.members.forEach(function (m) { m.items.forEach(function (q) { fieldAll.push(q); }); }); });
    var fAns = answeredCount(fieldAll);

    document.getElementById('wbStats').innerHTML =
      stat('范围级已回答', (SCOPE.length - scopeLeft) + ' / ' + SCOPE.length, scopeLeft ? 'warn' : 'ok',
        SCOPE_G.length + ' 类问题' + (scopeLeft ? '，剩 ' + scopeLeft + ' 处必答' : '，不可跳过')) +
      stat('字段级已答', fAns + ' / ' + fieldAll.length, fAns === fieldAll.length ? 'ok' : '', GROUPS.length + ' 张 sheet') +
      stat('合并后卡片', GROUPS.reduce(function (a, g) { return a + g.members.length; }, 0), '',
        '原始 ' + fieldAll.length + ' 条，省 ' + (fieldAll.length - GROUPS.reduce(function (a, g) { return a + g.members.length; }, 0)) + ' 次点击') +
      stat('已跳过待 F3 再问', skipCnt(), skipCnt ? 'warn' : '', '延迟决策，不阻塞出稿') +
      stat('AI 自决落库', aiCnt(), '', '二次仍跳过，已通知客户');

    document.getElementById('wbBlock').innerHTML = scopeLeft
      ? '<i class="fa fa-exclamation-circle"></i><b>范围级还有 ' + scopeLeft + ' 条未处置，稿件不能生成。</b>' +
        '它们决定最终输出的结构（拆几个任务、型号归谁、试验项挂哪层），<b>必须回答，不能跳过</b>。'
      : '<i class="fa fa-check-circle"></i>范围级已全部回答，可以生成稿件 v1-draft。' +
        (skipN ? '其中 <b>' + skipN + ' 处字段级是跳过</b>，稿件里标灰占位，F3 入库前需二次确认。' : '');
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
      (a && a.mode !== 'skip'
        ? '<span class="wb-ans"><i class="fa fa-check"></i> ' + esc(a.other || a.choice) + '</span>' +
          (a.mode === 'ai' ? '<span class="wb-ai">AI 自决落库</span>' : '')
        : (a ? '<span class="wb-skip">已跳过 · F3 会再问一次</span>' : '<span style="color:#cbd5e1">未处置</span>')) +
      '<span class="wb-undo" onclick="WB.undo(\'' + esc(q.id) + '\')">撤销</span>' +
      (a || q.lv === '范围' ? '' : '<span class="wb-skipbtn" onclick="WB.skip(\'' + esc(q.id) + '\')">跳过</span>') +
      (q.lv === '范围' && !a ? '<span class="wb-must">必答 · 不可跳过</span>' : '') + '</div>';
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
  /* 拆解成果是复利来源：生成 / 定稿 / 入库都必须回写标准文件库，两边读写同一份数据 */
  function writeback(kind) {
    if (!global.STDLib) return;
    var code = (global.WBTasks && WBTasks[0] && WBTasks[0].code) || 'DL/T 802.3-2023';
    var st = (global.SHEET_SEED || {}), cnt = function (sh) { return (st[sh] && st[sh].rows.length) || 0; };
    var nparam = cnt('60_控制参数') + cnt('70_测量参数') + cnt('80_计算参数') + cnt('90_标称值');
    var cover = '2 个样品 / 8 个型号 / ' + (st.tests ? Object.keys(st.tests).length : 16) + ' 个试验项 / ' +
      nparam + ' 个参数 / ' + cnt('A1_判定条件') + ' 条判定条件';
    var qa = RAW.filter(function (q) { return q.lv === '范围' && S.answers[q.id]; })
      .map(function (q) { var a = S.answers[q.id]; return { q: q.q.slice(0, 40), a: a.other || a.choice }; });
    var ver = 'v' + (global.ORCver || 1) + '-' + (kind === 'draft' ? 'draft' : 'final');
    var rec = null;
    if (kind === 'draft') rec = STDLib.onDraft(code, { ver: ver, cover: cover, precheck: '真缺陷 0 · 阻断 0', open: RAW.length });
    else if (kind === 'final') rec = STDLib.onFinalize(code, { ver: ver, by: '李工（业务专家）', precheck: '真缺陷 0 · 阻断 0', qa: qa });
    else rec = STDLib.onImport(code, { tenant: '迈特诺技术股份有限公司检测中心', deploy: '云部署',
      ver: ver, blocks: 2, rows: nparam + cnt('A1_判定条件') + cnt('A2_结论映射') + cnt('61_映射明细'), how: '首次拆解' });
    if (rec) {
      say('sys', '系统', '已回写<b>标准文件库</b>：' + esc(code) + ' 的拆解成果更新为 <b>' + esc(ver) + '</b>' +
        (kind === 'import' ? '，复用记录与变更记录已追加' : kind === 'final' ? '，沉淀范围级问答 ' + qa.length + ' 条（下个客户直接跳过）' : '，待定项 ' + RAW.length + ' 条') +
        ' <span class="wb-loc" onclick="window.open(\'standard-library.html\')">打开标准文件库看</span>');
    }
  }
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
      box.classList.toggle('answered', !!a && a.mode !== 'skip');
      box.classList.toggle('clear', !!a && box.parentNode.id === 'wbScope');
      var f = box.querySelector('.wb-q-f'); if (f) f.innerHTML = qFoot(q);
      if (box) box.classList.toggle('skipped', !!a && a.mode === 'skip');
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
      ? '<i class="fa fa-exclamation-circle"></i><b>范围级还有 ' + left + ' 条未回答，稿件不能生成。</b>范围级决定输出结构，不允许跳过。'
      : '<i class="fa fa-check-circle"></i>范围级已全部回答，可以生成稿件 v1-draft 了。';
    document.getElementById('wbBlock').className = 'wb-block' + (left ? '' : ' clear');
    document.getElementById('btnRun').disabled = left > 0;
    document.getElementById('btnRun').title = left ? '先回答 ' + left + ' 条范围级问题（不可跳过）' : '';
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
    if (st[3]) st[3].innerHTML = '已跳过待 F3 再问<b class="' + (skipCnt() ? 'warn' : '') + '">' + skipCnt() +
      '</b><span style="font-size:11px">延迟决策，不阻塞出稿</span>';
    if (st[4]) st[4].innerHTML = 'AI 自决落库<b>' + aiCnt() + '</b><span style="font-size:11px">二次仍跳过，已通知客户</span>';
    paintHeader();
  }

  var WB = {
    toggle: function (sh) { S.collapsed[sh] = !S.collapsed[sh]; save(); render(); },
    rows: function (k) { var e = document.getElementById('rows_' + k); if (e) e.classList.toggle('show'); },
    pick: function (id, v) {
      var q = RAW.filter(function (x) { return x.id === id; })[0];
      groupOf(id).forEach(function (x) { S.answers[x] = { choice: v, other: '', mode: 'answer' }; });
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
    skip: function (id) {
      var q = RAW.filter(function (x) { return x.id === id; })[0];
      if (q && q.lv === '范围') {
        say('sys', '系统', '<b>范围级问题不能跳过。</b>它决定最终输出的结构（拆几个任务、型号归谁、试验项挂哪层），' +
          '交给 AI 自决等于把整块数据的层级押上去，回改要推翻已入库内容。请回答，或补料后再回答。<span class="tg">V24b</span>');
        render(); return;
      }
      var n = groupOf(id).length;
      groupOf(id).forEach(function (x) { S.answers[x] = { choice: '', other: '', mode: 'skip' }; });
      say('sys', '系统', '跳过 ' + n + ' 处（' + esc(q.q.slice(0, 26)) + '…）。' +
        '数据先按 AI 当前最优猜测 <b>' + esc((optsOf(q)[0] || '—')) + '</b> 占位，' +
        '<b>不阻塞出稿</b>，但 F3 入库前会再问你一次。<span class="tg">可撤销</span>');
      save(); render();
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
      if (global.F2 && F2.locate(sh, row, col)) {
        WB.stage('f2');
        say('sys', '系统', '已定位 <span class="tg">' + esc(sh) + '</span><span class="tg">' + esc(row) +
          '</span><span class="tg">' + esc(col) + '</span> 并高亮该格。');
        return;
      }
      say('sys', '系统', '该问题的目标数据不在已接入的两张 sheet（90_标称值 / A1_判定条件）里，' +
        '定位 <span class="tg">' + esc(sh) + '</span><span class="tg">' + esc(row) + '</span> 需等其余 sheet 接入。');
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
          S.generated = 1; writeback('draft'); render(); return;
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

  /* ══════════ F3：预检 · 跳过项二次确认 · AI 自决落库 ══════════ */
  function skippedMembers() {
    var out = [];
    SCOPE_G.concat(GROUPS.reduce(function (a, g) { return a.concat(g.members); }, []))
      .forEach(function (m) { if (mode(m.rep.id) === 'skip') out.push(m); });
    return out;
  }
  function aiPicks(m) {
    var q = m.rep, o = optsOf(q);
    return { value: o.length ? o[0] : '（无默认值，需人工）',
             basis: q.conf > 0 ? '同类先例 + 上下文推断' : '标准文件条款就近匹配' };
  }
  function renderF3() {
    var pend = skippedMembers().length, ai = aiCnt();
    document.getElementById('wbF3Sum').innerHTML =
      box('真缺陷', '0', 'good', '契约 / 转换层问题') +
      box('待答即消除', '2', '', '回答或跳过均可推进') +
      box('跳过待二次确认', String(pend), pend ? 'bad' : 'good', '本轮再问一次') +
      box('AI 自决落库', String(ai), '', ai ? '已通知客户' : '尚无');
    var el = document.getElementById('wbF3Skip');
    if (!pend && !ai) {
      el.innerHTML = '<h4>跳过项二次确认</h4><p>本次没有跳过的问题，直接预检入库。</p>';
    } else {
      el.innerHTML = '<h4>跳过项二次确认<span class="cn" style="margin-left:8px;font-size:11.5px;color:#b45309">' +
        pend + ' 类 / ' + RAW.filter(function (q) { return mode(q.id) === 'skip'; }).length + ' 处</span></h4>' +
        '<p>这些是你上一轮标记「跳过」的条目。现在再问一次：能答就答，' +
        '仍然跳过则<b>由 AI 按自己的理解拆解落库</b>，并把自决清单通知到客户。</p>' +
        skippedMembers().map(askCard).join('') +
        (ai ? '<h4 style="margin-top:16px">AI 自决清单（已通知客户）<span class="cn" style="margin-left:8px;font-size:11.5px;color:#6d28d9">' +
          aiMembers().length + ' 类 / ' + ai + ' 处</span></h4>' + aiMembers().map(noticeRow).join('') : '');
    }
    var gate = pend ? '还有 ' + pend + ' 类跳过项未二次处置，不能入库（V24）'
      : (ai ? '可入库：' + ai + ' 处将由 AI 自决落库，入库后推送自决清单' : '可入库：全部问题已人工确认');
    document.getElementById('wbF3Gate').innerHTML = '<i class="fa ' + (pend ? 'fa-lock' : 'fa-unlock') + '"></i> ' + gate;
    document.getElementById('btnImport').disabled = pend > 0;
    var bell = document.getElementById('wbBell');
    bell.style.display = ai ? '' : 'none';
    document.getElementById('wbBellN').textContent = ai;
  }
  function box(k, v, c, s) { return '<div><div class="k">' + k + '</div><div class="v ' + c + '">' + v + '</div><div class="s">' + s + '</div></div>'; }
  function askCard(m) {
    var q = m.rep, p = aiPicks(m), n = m.items.length;
    return '<div class="wb-ask"><div class="t">' + esc(q.q) +
      '<span class="wb-merge" style="margin-left:6px">涉及 ' + n + ' 处</span></div>' +
      '<div class="ai">AI 拟取值 <b>' + esc(p.value) + '</b>　依据：' + esc(p.basis) +
      '　出处：' + esc(q.src) + '</div>' +
      '<div class="ops">' + optsOf(q).slice(0, 3).map(function (x) {
        return '<button class="btn-outline" onclick="WB.pick(\'' + esc(q.id) + '\',\'' + esc(x).replace(/'/g, '') + '\',1)">' + esc(x) + '</button>';
      }).join('') +
      '<button class="btn-save" onclick="WB.decide(\'' + esc(q.id) + '\')">仍跳过，AI 自决落库</button>' +
      '<span class="wb-loc" onclick="WB.stage(\'f1\')">回原问题</span></div></div>';
  }
  function aiMembers() {
    return SCOPE_G.concat(GROUPS.reduce(function (a, g) { return a.concat(g.members); }, []))
      .filter(function (m) { return mode(m.rep.id) === 'ai'; });
  }
  function noticeRow(m) {
    var q = m.rep, n = m.items.length;
    var paths = m.items.slice(0, 3).map(function (x) {
      return '<code>' + esc(x.row) + ' · ' + esc(x.col) + '</code>';
    }).join(' ');
    return '<div class="wb-notice"><div class="r"><b>' + esc(q.q.slice(0, 46)) + '…</b>' +
      '<span class="wb-merge" style="margin-left:6px">涉及 ' + n + ' 处</span><br>' +
      'AI 落库取值 <code>' + esc((optsOf(q)[0] || '—')) + '</code>　依据 ' + esc(aiPicks(m).basis) + '<br>' +
      '回改路径 ' + paths + (n > 3 ? ' 等 ' + n + ' 处' : '') +
      '　通知 站内消息 + 自决清单</div></div>';
  }
  WB.decide = function (id) {
    var q = RAW.filter(function (x) { return x.id === id; })[0];
    var m = { rep: q }; var p = aiPicks(m);
    groupOf(id).forEach(function (x) {
      S.answers[x] = { choice: p.value, other: '', mode: 'ai', basis: p.basis };
    });
    say('sys', '系统', '二次仍跳过 → <b>AI 自决落库</b> ' + groupOf(id).length + ' 处，取值 <b>' + esc(p.value) +
      '</b>（依据 ' + esc(p.basis) + '）。已生成自决清单，入库后通知客户。<span class="tg">可撤销</span>');
    S.notified++; save(); render(); WBsyncTasks(); if (S.stage === 'f3') renderF3();
  };
  WB.stage = function (k, focusId) {
    S.stage = k;
    document.getElementById('wbInbox').style.display = k === 'f1' ? '' : 'none';
    document.getElementById('wbF3').style.display = k === 'f3' ? '' : 'none';
    var f2 = document.getElementById('wbF2');
    if (f2) f2.style.display = k === 'f2' ? '' : 'none';
    ['F1', 'F2', 'F3'].forEach(function (n) {
      var e = document.getElementById('seg' + n);
      if (e) e.className = 'wb-seg-i' + (k === n.toLowerCase() ? ' on' : '');
    });
    document.querySelector('.wb-batch').style.display = k === 'f1' ? '' : 'none';
    ['btnDl', 'btnRun'].forEach(function (id) { document.getElementById(id).style.display = k === 'f1' ? '' : 'none'; });
    if (k === 'f3') renderF3();
    else if (k === 'f2') { if (global.F2) F2.render(); }
    else { renderF1u(); render(); }
    if (k === 'f1' && focusId) {
      var c = document.getElementById('q_' + focusId) ||
        (function () { var g = groupOf(focusId)[0]; return document.getElementById('q_' + g); })();
      if (c) { c.scrollIntoView({ block: 'center' }); c.classList.add('flash'); setTimeout(function () { c.classList.remove('flash'); }, 1400); }
    }
  };
  WB.importRun = function () {
    if (skippedMembers().length) return;
    var el = document.getElementById('wbF3Run'); el.style.display = '';
    var blocks = ['S01 DS实壁类电缆导管_直管', 'S02 DS实壁类塑料电缆导管_带承口'];
    el.innerHTML = '<h4>分块入库（按样品，一块一事务）</h4>' +
      blocks.map(function (b, i) {
        return '<div class="wb-stage" id="imp' + i + '"><span class="dot"></span>' + esc(b) +
          '<span class="out"></span></div>';
      }).join('');
    var i = 0;
    (function step() {
      if (i > 0) { document.getElementById('imp' + (i - 1)).className = 'wb-stage done';
        document.getElementById('imp' + (i - 1)).querySelector('.out').textContent = '已入库 · 可回滚本块'; }
      if (i >= blocks.length) {
        say('sys', '系统', '入库完成：2 个样品块全部成功，未触发回滚。' +
          (aiCnt() ? '已推送 <b>AI 自决清单</b>（' + aiMembers().length + ' 类 / ' + aiCnt() + ' 处）到客户站内消息。' : '') +
          ' <span class="tg">跳转样品数据页</span>');
        S.imported = 1; writeback('import'); save(); renderF3(); return;
      }
      document.getElementById('imp' + i).className = 'wb-stage on'; i++; setTimeout(step, 900);
    })();
  };
  WB.pick = (function (orig) {
    return function (id, v, fromF3) {
      orig(id, v);
      if (fromF3 && S.stage === 'f3') renderF3();
    };
  })(WB.pick);

  WB.raws = function () { return RAW; };
  WB.raw = function (id) { return RAW.filter(function (x) { return x.id === id; })[0]; };
  WB.state = function () { return S.answers; };
  WB.say = function (w, n, t) { say(w, n, t); paintChat(); };
  WB.imported = function () { return !!S.imported; };
  WB.unanswered = function () { return RAW.filter(function (q) { return !S.answers[q.id]; }).length; };
  WB.scopeLeft = function () { return SCOPE.filter(function (q) { return !S.answers[q.id]; }).length; };
  WB.replaceChat = function (needle, text) {
    for (var i = S.chat.length - 1; i >= 0; i--) {
      if (S.chat[i].text.indexOf(needle) >= 0) { S.chat[i].text = text; S.chat[i].at = now(); break; }
    }
    save(); paintChat();
  };
  /* ═════ 编排留痕面板 ═════ */
  var TRC = [];
  WB.setTraces = function (t) { TRC = t; var e = document.getElementById('trcN'); if (e) e.textContent = t.length; };
  WB.openTrace = function (t) {
    WB.setTraces(t);
    document.getElementById('trcList').innerHTML = (t.length ? t.map(function (x, i) {
      return '<div class="trc-i' + (x.rolled ? ' rolled' : '') + '">' +
        '<div class="hd"><span class="tg">' + esc(x.id) + '</span><span class="at">' + esc(x.at) + '</span>' +
        '<span class="it">' + esc(x.intent) + '</span><span class="who">' + esc(x.who) + '</span></div>' +
        '<div class="say">「' + esc(x.text) + '」</div>' +
        '<div class="rl">' +
          '<span>补丁 <b>' + (x.patches ? x.patches.length : 0) + '</b> 处</span>' +
          '<span>稿件 <b>v' + x.ver + '</b></span>' +
          '<span>预检 <b>' + esc(x.d0) + '</b></span>' +
          (x.blocks && x.blocks.length ? '<span>重放块 <b>' + esc(x.blocks.join(' / ')) + '</b></span>' : '') +
          (x.rolled ? '<span class="bad">已回滚</span>' : '') +
        '</div>' +
        (x.patches && x.patches.length ? '<div class="pd">' + x.patches.slice(0, 4).map(function (y) {
          return '<code>' + esc(y.sheet) + ' · ' + esc(y.row) + ' · ' + esc(y.col) + '</code> ' +
            '<s>' + esc(y.from) + '</s>→<b>' + esc(y.to) + '</b>';
        }).join('<br>') + (x.patches.length > 4 ? '<br><span class="mo">…共 ' + x.patches.length + ' 处</span>' : '') + '</div>' : '') +
        (x.rolled ? '' : '<div class="op"><button class="btn-outline xs" onclick="WB.closeTrace();ORC.fast(\'' +
          (x.planId || 'P0') + '\')">重放这次编排</button></div>') + '</div>';
    }).join('') : '<div class="trc-e">还没有编排记录。在右下角对话里说一句「系统里 维卡软化温度下限 那条是错的，改成 95」并确认执行，这里就会留下第一条。</div>');
    document.getElementById('trcMask').classList.add('show');
  };
  WB.closeTrace = function () { document.getElementById('trcMask').classList.remove('show'); };

  /* ═════ F1 上传与拆解 ═════ */
  function renderF1u() {
    var el = document.getElementById('wbF1u'); if (!el) return;
    el.innerHTML =
      '<div class="up-slots">' +
        slot('检测能力范围表', '认可的检测能力范围(中文).pdf', '已解析 · 11 页 · 3 个检测对象大类', 'ok') +
        slot('检测依据标准文件', 'DL/T 802.3—2023.pdf', '已识别 DL/T 802.3—2023 · 命中库内 v3 成果', 'ok') +
        slot('检测报告 / 原始记录单', '数据线.docm · EN50264.docm', '已解析 · 用于补型号与参数命名', 'ok') +
      '</div>' +
      '<div class="f1-sec"><h4>任务发现<span class="sh">AI 先给清单，人确认后才开工；一个任务 = 一份标准文件</span></h4>' +
        '<table class="task-tbl"><tr><th>标准文件</th><th>层级角色</th><th>覆盖样品 / 型号</th><th>库状态</th><th>建议</th><th></th></tr>' +
        task('DL/T 802.3—2023', '子标准（802.1 点名的实壁类）', '2 个样品 / 8 个型号', '已存档 · 已拆解 v3', '独立成任务', 1) +
        task('DL/T 802.1—2023', '总标准（集合型，不直接产数据）', '电缆保护管全类型索引', '已存档 · 未拆解', '只建分类节点，不建任务', 0) +
        task('DL/T 802.4—2023', '子标准（波纹型，802.1 点名）', '能力表未覆盖', '未上传', '本次不拆', 0) +
        '</table><div class="f1-note">能力表只覆盖实壁类，所以只生成 1 个任务；' +
        '若你说「波纹型也要拆」，需要补传 DL/T 802.4—2023，我会另开一个任务。</div></div>' +
      '<div class="f1-sec"><h4>拆解进度</h4>' +
        '<div id="f1Stages">' + ['识别标准文件|DL/T 802.3—2023 · 规范化编号 + 年号',
          '命中库|元数据命中 · 文件本体按客户隔离 · 拆解成果可复用',
          '任务发现|1 个任务 · 2 个样品 / 8 个型号',
          '逐 sheet 生成|22 张 · 166 参数 / 42 判定条件'].map(function (x) {
            var a = x.split('|');
            return '<div class="wb-stage done"><span class="dot"></span>' + esc(a[0]) + '<span class="out">' + esc(a[1]) + '</span></div>';
          }).join('') + '</div>' +
        '<div class="f1-acts"><button class="btn-save" onclick="WB.f1sub(\'inbox\')">进入问题收件箱（89 条）</button>' +
        '<button class="btn-outline" onclick="WB.ask(\'命中库了，按库内成果拆还是按我上传的拆？\')">问：命中库怎么拆</button></div></div>';
  }
  function slot(t, f, st, cls) {
    return '<div class="slot ' + cls + '"><div class="st-t">' + esc(t) + '</div>' +
      '<div class="st-f"><i class="fa fa-file-pdf-o"></i> ' + esc(f) + '</div>' +
      '<div class="st-s">' + esc(st) + '</div></div>';
  }
  function task(code, role, cov, lib, sug, on) {
    return '<tr class="' + (on ? 'on' : '') + '"><td><b>' + esc(code) + '</b></td><td>' + esc(role) + '</td>' +
      '<td>' + esc(cov) + '</td><td>' + esc(lib) + '</td><td>' + esc(sug) + '</td>' +
      '<td>' + (on ? '<span class="ok2"><i class="fa fa-check-circle"></i> 已确认</span>'
                   : '<button class="btn-outline xs" onclick="this.parentNode.innerHTML=\'<span class=\'ok2\'>已确认</span>\'">加入</button>') + '</td></tr>';
  }
  WB.f1sub = function (k) {
    S.f1sub = k;
    if (k === 'upload') renderF1u();
    var bb = document.querySelector('.wb-batch');
    if (bb) bb.style.display = (k === 'inbox' && S.stage === 'f1') ? '' : 'none';
    document.getElementById('wbF1u').style.display = k === 'upload' ? '' : 'none';
    document.getElementById('wbInbox').style.display = k === 'inbox' ? '' : 'none';
    renderF1Sub();
  };
  function renderF1Sub() {
    var e = document.getElementById('f1Sub'); if (!e) return;
    var un = WB.unanswered();
    e.innerHTML = '<span class="' + (S.f1sub !== 'inbox' ? 'on' : '') + '" onclick="WB.f1sub(\'upload\')">上传与拆解</span>' +
      '<span class="' + (S.f1sub === 'inbox' ? 'on' : '') + '" onclick="WB.f1sub(\'inbox\')">问题收件箱<small>' + un + ' 条未答</small></span>';
  }
  var _render = render;
  render = function () { _render(); renderF1Sub(); };

  WB.markFinal = function () { S.finalized = 1; S.generated = 1; writeback('final'); save(); paintHeader(); };
  WB.markGenerated = function () { S.generated = 1; if (S.imported) S.imported = 2; save(); paintHeader(); };
  WB.ask = function (t) {
    if (!t || !t.trim()) return;
    if (global.ORC) ORC.ask(t.trim());
    else say('sys', '系统', '编排器未加载。');
    var i = document.getElementById('chatIn'); if (i) i.value = '';
  };
  global.WB = WB;
  global.WBInit = function (raw) {
    RAW = raw; build();
    var d = load(); S.answers = d.a || {}; S.collapsed = d.c || {}; S.chat = d.ch || [];
    render();
  };
  function renderTasks() {
    var el = document.getElementById('taskList'); if (!el) return;
    el.innerHTML = TASKS.map(function (t, i) {
      var bar = [0, 1, 2].map(function (k) {
        return '<i class="' + (k < t.stage - 1 ? 'done' : k === t.stage - 1 ? 'cur' : '') + '"></i>';
      }).join('');
      return '<div class="wb-task' + (i === S.task ? ' on' : '') + '" onclick="WB.pickTask(' + i + ')">' +
        '<div class="code">' + esc(t.code) + '</div><div class="nm">' + esc(t.nm) + '</div>' +
        '<div class="bar">' + bar + '</div>' +
        '<div class="meta"><span class="wb-badge" style="font-size:10.5px">' + esc(t.st) + '</span>' +
        '<span style="font-size:11px;color:#94a3b8">' + (t.q ? t.q + ' 条待定' : '—') + '</span></div></div>';
    }).join('');
  }
  WB.pickTask = function (i) { S.task = i; renderTasks(); };
  global.WBTasks = TASKS;
  global.WBsyncTasks = function () {
    TASKS[0].q = RAW.length;
    TASKS[0].st = S.imported ? '已入库' : (S.generated ? '校稿中' : '校稿中');
    renderTasks();
  };
})(window);
