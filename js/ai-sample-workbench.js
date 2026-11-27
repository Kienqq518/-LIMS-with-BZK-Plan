/**
 * 建模工作台 · F1/F2/F3 一体
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
    '05_系统对齐': '系统对齐', '20_样品': '样品', '50_试验项': '试验项', '61_映射明细': '映射明细', '70_测量参数': '测量参数',
    '80_计算参数': '计算参数', 'A1_判定条件': '判定条件', '41_型号规格赋值': '型号规格赋值',
    '90_标称值': '标称值', '60_控制参数': '控制参数', 'B0_采集配置': '采集配置'
  };
  var TASKS = [
    { code: 'DL/T 802.3—2023', nm: '实壁类塑料电缆导管', stage: 2, q: 112, done: 0, st: '校稿中' },
    { code: 'GB/T 12706.2—2020', nm: '中压电力电缆（6kV~30kV）', stage: 1, q: 0, done: 0, st: '待补料' },
    { code: 'EN 50306-2:2020', nm: '铁路机车车辆电缆', stage: 3, q: 0, done: 0, st: '已定稿' }
  ];

  var S = { answers: {}, collapsed: {}, chat: [], run: 0, task: 0, generated: 0, stage: 'f1', notified: 0, auth: 0 };
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
  /* 顶栏 / 进度条 / 产物卡都跟着「当前选中的任务」走：
     演示任务读实时流水线，其余任务读它自己的存档，互不串台。 */
  /* 两层权限取交集：角色 + 单独授予。没权限就给一句"为什么"，不静默禁用 */
  function ok(act) { return global.SH ? SH.can(act) : true; }
  function noPerm(act) {
    if (!global.SH) return false;
    say('sys', '系统', '<span class="np"><i class="fa fa-user-times"></i>' + SH.why(act) + '</span>' +
      (act === 'import' || act === 'import.auth'
        ? '<div class="rc-a"><button class="ra" onclick="WB.askImport()">申请入库权</button></div>' : ''));
    paintChat(); return true;
  }

  function taskView() {
    if (!global.TS) return null;
    var t = TS.sel(); if (!t || t.cur) return null;
    var o = t.outputs[0] || {}, imp = t.stage >= 4 || !!o.imported;
    return { t: t, o: o, imp: imp, done: t.stage >= 3,
      lab: imp ? (o.ver || '稿件') + ' 已入库'
        : t.stage >= 3 ? (o.ver || '稿件') + ' 已定稿'
        : t.stage === 2 ? 'v1-draft 校稿中' : '未生成',
      col: imp ? '#6d28d9' : t.stage >= 3 ? '#15803d' : '#94a3b8',
      prog: imp ? 100 : t.stage >= 3 ? 82 : t.stage === 2 ? 45 : t.files.length ? 18 : 0,
      tail: ' · 输入 ' + t.files.length + ' 份' +
        (t.outputs.length ? ' · 产出 ' + t.outputs.length + ' 份' : ' · 待补料') };
  }
  function archStats(tv) {
    var t = tv.t;
    return '<div class="wb-prog"><i style="width:' + tv.prog + '%"></i></div>' +
      '<span class="wb-prog-lab"><b>' + tv.prog + '%</b></span>' +
      '<span class="wb-stat"><i class="fa fa-folder-o"></i>' + esc(t.status) + '</span>' +
      '<span class="wb-stat"><i class="fa fa-upload"></i><b>' + t.files.length + '</b> 份输入</span>' +
      (t.outputs.length ? '<span class="wb-stat"><i class="fa fa-file-excel-o"></i><b>' + t.outputs.length + '</b> 份产出</span>' : '') +
      (tv.imp ? '<span class="wb-stat alert"><i class="fa fa-database"></i>已入库</span>'
        : tv.done ? '<span class="wb-stat alert"><i class="fa fa-clock-o"></i>待入库</span>'
        : '<span class="wb-stat alert"><i class="fa fa-exclamation-triangle"></i>缺料</span>');
  }
  function archBox(ic, ti, sub, body) {
    return '<div class="arch"><div class="arch-h"><i class="fa ' + ic + '"></i><b>' + esc(ti) + '</b>' +
      '<span>' + esc(sub) + '</span></div>' + body + '</div>';
  }
  function archRow(k, v, cls) {
    return '<div class="arch-r"><span>' + esc(k) + '</span><b class="' + (cls || '') + '">' + esc(v) + '</b></div>';
  }
  function archRows(list) {
    return '<div class="arch-b">' + list.map(function (x) { return archRow(x[0], x[1], x[2]); }).join('') + '</div>';
  }
  function archUpload(tv) {
    var t = tv.t, SL = (global.TS && TS.SLOT_TI) || {};
    var slots = t.files.map(function (f) {
      return '<div class="slot ok"><div class="st-t">' + esc(SL[f.slot] || '输入') + '</div>' +
        '<div class="st-f"><i class="fa fa-file-pdf-o"></i> ' + esc(f.name) + '</div>' +
        '<span class="st-ic"><i class="fa fa-check-circle"></i></span></div>';
    }).join('');
    if (t.files.length < 3) slots += '<div class="slot warn"><div class="st-t">还缺的料</div>' +
      '<div class="st-f">' + (t.files.length ? '检测依据标准文件 / 原始记录单' : '检测能力范围表 + 检测依据标准文件') + '</div></div>';
    document.getElementById('wbF1u').innerHTML =
      '<div class="up-slots">' + (slots || '<div class="pe">还没有上传文件</div>') + '</div>' +
      (t.hits && t.hits.length
        ? archBox('fa-cube', '标准成果库', '', t.hits.map(function (h) {
            return '<div class="arch-li"><i class="fa fa-cube"></i>' + esc(h) + '</div>'; }).join(''))
        : '');
    syncSlots();
  }
  function archInbox(tv) {
    var t = tv.t, qa = t.qa || [];
    var cards = qa.map(function (x) {
      return '<div class="qa-i"><div class="q">' + esc(x.q) + '</div>' +
        '<div class="a"><i class="fa fa-check"></i>' + esc(x.a) +
        '<span>' + esc(x.src) + '</span></div></div>';
    }).join('');
    document.getElementById('wbBlock').innerHTML = qa.length
      ? '范围级 ' + qa.length + ' 条 · 已沉淀，同类任务可直接复用' : '待补料 · 问题清单未生成';
    document.getElementById('wbBlock').className = 'wb-block' + (qa.length ? ' clear' : '');
    var rn = document.getElementById('wbRun'); if (rn) rn.classList.remove('show');
    document.getElementById('wbScope').innerHTML = cards ||
      archBox('fa-inbox', '问题收件箱', t.files.length ? '缺检测依据标准文件' : '还没有上传文件', '');
    document.getElementById('wbGroups').innerHTML = '';
    var b = document.getElementById('btnRun');
    if (b) { b.disabled = true; b.textContent = qa.length ? '去预检入库' : '补齐输入后可生成'; }
    var g = document.getElementById('wbGateTxt');
    if (g) g.textContent = qa.length ? '稿件已定稿，可直接入库' : '缺输入';
    syncSlots();
  }
  function archSheet(tv) {
    var t = tv.t, o = tv.o;
    document.getElementById('f2Tabs').innerHTML = '';
    document.getElementById('f2Cnt').innerHTML = o.ver
      ? '<span>稿件 <b>' + esc(o.ver) + '</b></span><span>' + esc(o.state) + '</span>' +
        '<span><b>' + o.sheets + '</b> 张 sheet</span><span class="lg">' + esc(o.at || '') + '</span>'
      : '<span>稿件 <b class="warn">未生成</b></span><span class="lg">' + esc(t.status) + '</span>';
    document.getElementById('f2Body').innerHTML = o.ver
      ? archBox('fa-table', '稿件存档', esc(o.state) + (o.imported ? ' · 已入库' : ''), archRows([
          ['版本', o.ver], ['状态', o.state + (o.imported ? ' · 已入库' : '')],
          ['结构', o.sheets + ' 张 sheet'], ['内容', o.rows || '—'], ['定稿', o.at || '—']
        ]) + '<div class="arch-act"><span class="ra" onclick="TS.dl(0)"><i class="fa fa-download"></i> 下载稿件</span>' +
          '<a class="ra" href="sample-data-detail.html?cat=dlwz" target="_blank"><i class="fa fa-external-link"></i> 样品数据页</a>' +
          '<a class="ra" href="standard-library.html" target="_blank"><i class="fa fa-book"></i> 标准成果库</a></div>')
      : archBox('fa-table', '稿件存档', '', archRows([['稿件', '未生成'], ['状态', t.status]]));
    document.getElementById('f2Gate').innerHTML = '';
    var dr = document.getElementById('f2Drawer'); if (dr) dr.innerHTML = '';
    syncSlots();
  }
  function archF3(tv) {
    var t = tv.t, o = tv.o, blocks = t.samples || [];
    document.getElementById('wbF3Sum').innerHTML =
      box('真缺陷', tv.done ? '0' : '—', 'good') +
      box('必答清零', tv.done ? '是' : '—', tv.done ? 'good' : '') +
      box('跳过项', tv.done ? String(o.skips || 0) : '—', '') +
      box('样品块', String(tv.imp ? blocks.length : (tv.done ? blocks.length : 0)), '');
    var el = document.getElementById('wbF3Skip');
    var li = function (mark, list) {
      return list.map(function (b) {
        return '<div class="arch-li"><i class="fa ' + mark + '"></i>' + esc(b) + '</div>'; }).join('');
    };
    el.innerHTML = tv.imp
      ? '<h4>入库凭据<span class="cn">' + esc(o.ver) + ' · ' + esc(o.impAt || '') + '</span></h4>' + li('fa-check-circle', blocks)
      : (tv.done
        ? '<h4>待入库<span class="cn">' + esc(o.ver) + ' · 按样品分块，一块一事务</span></h4>' + li('fa-hourglass-half', blocks)
        : '<h4>暂不可入库<span class="cn">' + esc(t.status) + '</span></h4>' +
          archRows([['缺输入', t.files.length ? '检测依据标准文件' : '检测能力范围表 + 标准文件'], ['稿件', '未生成']]));
    document.getElementById('wbF3Run').style.display = 'none';
    document.getElementById('wbF3Gate').innerHTML = '<i class="fa ' + (tv.done && !tv.imp ? 'fa-unlock' : 'fa-lock') + '"></i> ' +
      (tv.imp ? '已入库，再改请走 F2 改版重放' : tv.done ? '可入库：' + esc(o.ver) + ' 定稿无缺口' : '缺输入，不能入库');
    var bi = document.getElementById('btnImport');
    if (bi) { bi.disabled = !tv.done || tv.imp; bi.textContent = tv.imp ? '已入库' : '拆解入库'; }
    var bl = document.getElementById('wbBell'); if (bl) bl.style.display = 'none';
    syncSlots();
  }
  function archNote(ask) {
    var tv = taskView(); if (!tv) return false;
    var t = tv.t, acts = '<button class="ra" onclick="TS.tab(\'files\')"><i class="fa fa-folder-o"></i>看文件</button>';
    if (tv.done) acts += '<button class="ra" onclick="WB.openArt(\'f3\')">去预检入库</button>';
    if (tv.o.ver) acts += '<span class="dl" onclick="TS.dl(0)"><i class="fa fa-download"></i> 下载 ' + esc(tv.o.ver) + '</span>';
    WB.say('ai', 'AI 助手', (ask ? '这个任务是 <b>' + esc(t.status) + '</b>，' : '已挂到 <b>' + esc(t.code) + '</b>，') +
      (tv.done ? '稿件 ' + esc(tv.o.ver) + ' 可直接入库。' : '还缺检测依据标准文件，补齐才能往下拆。') +
      '<div class="rc-a">' + acts + '</div>');
    WB.paintChatNow();
    return true;
  }
  function arch(kind) {
    var tv = taskView(); if (!tv) return false;
    if (kind === 'upload' && !tv.t.files.length) return false;   // 还没料：留拖拽上传区
    var st = document.getElementById('wbStats'); if (st) st.innerHTML = archStats(tv);
    if (kind === 'inbox') archInbox(tv);
    else if (kind === 'sheet') archSheet(tv);
    else if (kind === 'f3') archF3(tv);
    else archUpload(tv);
    return true;
  }

  function paintHeader() {
    var el = document.getElementById('wbDoc'); if (!el) return;
    var tvh = taskView();
    if (tvh) { el.innerHTML = '稿件 <b style="color:' + tvh.col + '">' + esc(tvh.lab) + '</b>' + tvh.tail; return; }
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

  function renderInbox() {
    paintHeader();
    if (arch('inbox')) return;
    var br = document.getElementById('btnRun'); if (br) br.textContent = '生成稿件 v1-draft';
    var scopeLeft = SCOPE.filter(function (q) { return !S.answers[q.id]; }).length;
    var skipN = skipCnt();
    var fieldAll = [], GROUPED = [];
    GROUPS.forEach(function (g) { g.members.forEach(function (m) { m.items.forEach(function (q) { fieldAll.push(q); }); }); });
    var fAns = answeredCount(fieldAll);

    var done = SCOPE.length - scopeLeft + fAns;
    var total = SCOPE.length + fieldAll.length;
    document.getElementById('wbStats').innerHTML =
      '<div class="wb-prog"><i style="width:' + (total ? Math.round(done * 100 / total) : 0) + '%"></i></div>' +
      '<span class="wb-prog-lab"><b>' + done + '</b> / ' + total + ' 已处置</span>' +
      (scopeLeft ? '<span class="wb-stat alert"><i class="fa fa-lock"></i><b>' + scopeLeft + '</b> 条必答</span>' : '') +
      (skipCnt() ? '<span class="wb-stat alert"><i class="fa fa-clock-o"></i><b>' + skipCnt() + '</b> 条待 F3</span>' : '') +
      (aiCnt() ? '<span class="wb-stat alert"><i class="fa fa-magic"></i><b>' + aiCnt() + '</b> 处 AI 自决</span>' : '') +
      (S.generated ? '<span class="wb-stat alert" style="color:var(--ok);background:var(--ok-soft)"><i class="fa fa-check"></i><b style="color:var(--ok)">v' + (global.ORCver || 1) + '</b> 稿件</span>' : '') +
      (S.imported ? '<span class="wb-stat alert" style="color:var(--acc);background:var(--acc-soft)"><i class="fa fa-database"></i><b style="color:var(--acc)">已入库</b></span>' : '');

    document.getElementById('wbBlock').innerHTML = scopeLeft
      ? '范围级 ' + scopeLeft + ' 条必答' : '范围级已答完';
    document.getElementById('wbBlock').className = 'wb-block' + (scopeLeft ? '' : ' clear');
    gate(scopeLeft, '先答完 ' + scopeLeft + ' 条必答');

    document.getElementById('wbScope').innerHTML =
      (global.SH ? SH.bar() : '') +
      (SCOPE_G.map(scopeCard).join('') || '<div class="wb-hint">本次没有范围级问题。</div>');
    document.getElementById('wbGroups').innerHTML = GROUPS.map(groupCard).join('');
  }
  function render() { renderInbox(); paintChat(); }
  function stat(lab, val, cls, sub) {
    return '<div class="wb-stat">' + lab + '<b class="' + cls + '">' + esc(val) + '</b>' +
      '<span style="font-size:11px">' + esc(sub) + '</span></div>';
  }
  function scopeCard(m) {
    var q = m.rep, a = S.answers[q.id], o = optsOf(q), multi = m.items.length > 1;
    return '<div class="wb-group wb-scope' + (a ? ' clear' : '') + (hidden(q) ? ' fo' : '') + '" style="margin-bottom:8px">' +
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
    var vis = 0; g.members.forEach(function (m) { m.items.forEach(function (q) { if (!hidden(q)) vis++; }); });
    return '<div class="wb-group' + (col ? ' collapsed' : '') + (vis ? '' : ' fo') + '">' +
      '<div class="wb-gh" onclick="WB.toggle(\'' + esc(g.sheet) + '\')">' +
      '<i class="fa fa-caret-down caret"></i><span class="sh">' + esc(g.sheet) + '</span>' +
      '<span class="cn">' + (SHEET_CN[g.sheet] || '') + ' · ' + g.members.length + ' 类问题 / ' + total + ' 处</span>' +
      '<div class="prog"><i style="width:' + (total ? Math.round(ans * 100 / total) : 0) + '%"></i></div>' +
      '<span class="cn" id="gn_' + esc(g.sheet) + '">' + ans + '/' + total + '</span>' +
      '<button class="btn-outline" style="font-size:11.5px;padding:2px 9px" onclick="WB.adoptGroup(event,\'' + esc(g.sheet) + '\')">整组采纳默认值</button>' +
      '</div><div class="wb-gb">' + g.members.map(memberCard).join('') + '</div></div>';
  }
  function hidden(q) { return global.SH && !SH.shown(q.id); }
  function memberCard(m) {
    var q = m.rep, multi = m.items.length > 1, a = S.answers[q.id];
    var o = optsOf(q);
    return '<div class="wb-q' + (a ? ' answered' : '') + (hidden(q) ? ' fo' : '') + '" id="q_' + esc(q.id) + '">' +
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
      '<input placeholder="补充说明：" value="' + esc(a ? a.other : '') + '" oninput="WB.other(\'' + esc(q.id) + '\',this.value)" /></div></div>';
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
      (q.lv === '范围' && !a ? '<span class="wb-must">必答 · 不可跳过</span>' : '') +
      (global.SH ? '<span class="wb-asg' + (SH.mine(q.id) ? ' me' : (SH.who(q.id) ? ' set' : '')) +
        '" onclick="SH.assignUI(\'' + esc(q.id) + '\',event)" title="' +
        (SH.who(q.id) ? '当前负责人：' + esc(SH.who(q.id)) + '，点击改派' : '指派给任务里的某个人') + '">' +
        (SH.who(q.id) ? '<i class="av xs">' + esc(SH.ini(q.id)) + '</i>' + esc(SH.mine(q.id) ? '我' : SH.who(q.id))
          : '<i class="fa fa-user-plus"></i>指派') + '</span>' : '') + '</div>';
  }
  function paintChat() {
    var el = document.getElementById('wbChat');
    el.innerHTML = S.chat.map(chatRow).join('');
    remount(); renderArtNav();
    var b = document.querySelector('.wb-body'); if (b) b.scrollTop = b.scrollHeight;
  }
  var AV = { ai: '<i class="fa fa-magic"></i>', sys: '<i class="fa fa-circle-notch"></i>' };
  function chatRow(c) {
    var av = c.who === 'me' ? '<span class="av who">' + esc(c.ini || (c.name || '我').slice(0, 1)) + '</span>'
      : '<span class="av">' + (AV[c.who] || 'AI') + '</span>';
    var head = c.who === 'ai' ? '' : '<div class="who">' + esc(c.name) + ' · ' + esc(c.at) + '</div>';
    return '<div class="wb-msg ' + c.who + '">' + av + '<div class="col">' + head +
      '<div class="bd">' + c.text + '</div></div></div>';
  }

  /* ── 交互 ── */
  function idsOf(m) { return m.items.map(function (x) { return x.id; }); }
  function groupOf(id) { return MERGE[id] || [id]; }
  function allMembers() { var a = []; GROUPS.forEach(function (g) { a = a.concat(g.members); }); return a; }
  function now() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  /* 拆解成果是复利来源：生成 / 定稿 / 入库都必须回写标准成果库，两边读写同一份数据 */
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
      say('sys', '系统', '已回写<b>标准成果库</b>：' + esc(code) + ' 的拆解成果更新为 <b>' + esc(ver) + '</b>' +
        (kind === 'import' ? '，复用记录与变更记录已追加' : kind === 'final' ? '，沉淀范围级问答 ' + qa.length + ' 条（下个客户直接跳过）' : '，待定项 ' + RAW.length + ' 条') +
        ' <span class="wb-loc" onclick="window.open(\'standard-library.html\')">打开标准成果库看</span>');
    }
  }
  function whoMe() { return global.SH ? SH.who() : { nm: '你', ini: '我' }; }
  function say(who, name, text) {
    var m = { who: who, name: who === 'me' ? whoMe().nm : name, text: text, at: now() };
    if (who === 'me') m.ini = whoMe().ini;
    S.chat.push(m); return m;
  }

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
    gate(left, '先回答 ' + left + ' 条必答');
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

  /* ════════ 产物卡：F1/F2/F3 变成对话里可展开的对象 ════════ */
  var ARTS = {
    upload: { ic: 'fa-upload', ti: '上传与拆解', stage: 'wbF1u', sum: function () {
        var tv = taskView(); return tv ? tv.t.files.length + ' 份输入' : '3 份料 · 1 个任务'; } },
    inbox:  { ic: 'fa-inbox', ti: '问题收件箱', stage: 'wbInbox', sum: function () {
        var tv = taskView();
        if (tv) return tv.t.qa && tv.t.qa.length ? tv.t.qa.length + ' 条已沉淀' : '待补料';
        var l = WB.unanswered ? WB.unanswered() : 0, s = WB.scopeLeft ? WB.scopeLeft() : 0;
        return l ? l + ' 条待处置' + (s ? ' · 其中 ' + s + ' 条必答' : '') : '已全部处置'; } },
    sheet:  { ic: 'fa-table', ti: '稿件表格', stage: 'wbF2', sum: function () {
        var tv = taskView(); return tv ? (tv.o.ver ? tv.o.sheets + ' 张 sheet · ' + tv.o.state : '未生成') : '23 张 sheet · 10 张可编辑'; } },
    f3:     { ic: 'fa-database', ti: '预检与入库', stage: 'wbF3', sum: function () {
        var tv = taskView(); return tv ? (tv.imp ? '已入库' : tv.done ? '待入库' : '不可入库') : '真缺陷 0 · 阻断 0'; } }
  };
  var OPEN = {};
  function artShell(kind, opt, open) {
    var a = ARTS[kind]; if (!a) return '';
    opt = opt || {}; if (open) OPEN[kind] = 1;
    return '<div class="wb-art' + (OPEN[kind] ? ' open' : '') + (opt.cls ? ' ' + opt.cls : '') + '" id="art_' + kind + '">' +
      '<div class="wb-art-h" onclick="WB.toggleArt(\'' + kind + '\')">' +
      '<span class="ic"><i class="fa ' + a.ic + '"></i></span><span class="ti">' + esc(opt.ti || a.ti) + '</span>' +
      '<span class="su">' + esc(opt.su != null ? opt.su : a.sum()) + '</span><span class="sp"></span>' +
      (opt.pin ? '<span class="pin">' + esc(opt.pin) + '</span>' : '') +
      '<button class="go" onclick="event.stopPropagation();WB.openSide(\'' + kind + '\')">放大</button>' +
      '<i class="fa fa-chevron-right caret"></i></div>' +
      '<div class="wb-art-b"><div data-mount="' + kind + '"></div></div></div>';
  }
  /* 产物内容不搬节点：真实节点常驻 #dock，展开位只放副本。
     搬进对话消息会被下一次 paintChat 连根销毁 —— 这个坑踩过两次。 */
  function syncSlots() {
    var hosts = [];
    Object.keys(ARTS).forEach(function (k) {
      var card = document.getElementById('art_' + k);
      if (card && card.classList.contains('open')) {
        var slot = card.querySelector('[data-mount="' + k + '"]');
        if (slot) hosts.push([slot, k]);
      }
    });
    var side = document.getElementById('side');
    if (side && side.classList.contains('show') && S.side) {
      var sb = document.getElementById('sideBody');
      if (sb) hosts.push([sb, S.side]);
    }
    hosts.forEach(function (h) {
      var stage = document.getElementById(ARTS[h[1]].stage);
      if (!stage) return;
      /* 副本剥掉 id：否则 getElementById 会命中对话里的那份，写入全跑偏 */
      h[0].innerHTML = stage.innerHTML.replace(/\s+id="[^"]*"/g, '');
    });
  }
  var BUSY = false;
  function remount() { if (BUSY) return; BUSY = true; try { syncSlots(); } finally { BUSY = false; } }
  function renderStage(k) {
    if (k === 'inbox') renderInbox();
    else if (k === 'sheet') { if (!arch('sheet') && global.F2) F2.render(); }
    else if (k === 'f3') renderF3();
    else if (k === 'upload') renderF1u();
    syncSlots();
  }
  /* 左下只有一套：进度节点。产物卡该不该展开，由节点状态自己说 */
  function renderArtNav() { if (global.TS && TS.progress) TS.progress(); }
  var _wb = {
    toggleArt: function (k) { OPEN[k] = !OPEN[k]; var c = document.getElementById('art_' + k);
      if (c) c.classList.toggle('open', !!OPEN[k]); renderStage(k); renderArtNav(); },
    openArt: function (k) {
      OPEN[k] = 1;                       // 先置展开，否则新生成的卡片是折叠态、副本不会同步
      var c = document.getElementById('art_' + k);
      if (!c) { say('ai', 'AI 助手', artShell(k, {})); paintChat(); renderStage(k); }
      else { c.classList.add('open'); renderStage(k); c.scrollIntoView({ block: 'nearest' }); }
      renderArtNav();
    },
    jumpArt: function (k) { WB.openArt(k); },
    openSide: function (k) {
      S.side = k; S.sideTitle = ARTS[k].ti;
      if (global.TS) { TS.tab('view'); TS.render(); } else { syncSlots(); }
      renderArtNav();
    },
    closeSide: function () {
      S.side = null;
      if (global.TS) TS.tab('files');
      syncSlots();
    }
  };
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
      mini('skip', n, { v: (optsOf(q)[0] || '—'), c: n });
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
      if (taskView()) { archNote(true); return; }
      if (SCOPE.some(function (q) { return !S.answers[q.id]; })) return;
      var el = document.getElementById('wbRun'); el.classList.add('show');
      var stages = [['识别标准文件', 'DL/T 802.3—2023 · 命中库内 v3 成果'],
      ['任务发现', '1 个任务 · 2 个样品 / 8 个型号'],
      ['逐 sheet 生成', '23 张 · 200 参数 / 16 试验项'],
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
    reset: function () { S = { answers: {}, collapsed: {}, chat: [], run: 0, task: 0, generated: 0, stage: 'f1', notified: 0 };
      OPEN = {}; global.ORCver = 1; if (global.DEMO) DEMO.reset && DEMO.reset();
      try { localStorage.removeItem('lims.stdlib.v2'); } catch (e) { }
      save(); WB.boot(); },
    boot: function () {
      S.chat = []; OPEN = { upload: 1 };
      say('ai', 'AI 助手', '把检测能力范围表、检测依据标准文件放进来。我拆成可下载的 Excel 稿件，再落进样品数据。' +
        artShell('upload', { su: '拖拽或点击上传' }, 1));
      paintChat(); render();
      if (global.DEMO) { DEMO.mountQuick(); renderChipsSafe(); }
    },
    /* 恢复会话：展开状态与 demo 产物都要跟着回来 */
    restore: function (d) {
      OPEN = d.o || {};
      if (global.DEMO && d.d) DEMO.load(d.d);
      if (global.DEMO) { DEMO.mountQuick(); renderChipsSafe(); }
    }
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
    try { localStorage.setItem(KEY, JSON.stringify({ a: S.answers, c: S.collapsed, ch: S.chat.slice(-40), o: OPEN, d: global.DEMO ? DEMO.state() : null })); } catch (e) { }
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
  /* ── 系统对齐：F1 的产出不是"新建"，是"对齐"。
     每个实体最终落到哪个写操作动词，由对齐基准 + 人工答案共同决定。 ── */
  var VERB = {
    新建: { ic: 'fa-plus', c: '', ti: '新建', d: '系统里没有，按稿件创建' },
    挂载: { ic: 'fa-paper-plane-o', c: '', ti: '挂载', d: '父节点已存在，只挂新子节点' },
    复用: { ic: 'fa-link', c: 'good', ti: '复用', d: '命中系统已有编码，不写、不重编' },
    变更: { ic: 'fa-exchange', c: 'bad', ti: '变更', d: '改已有配置，作用到在流转的检测任务' },
    停用: { ic: 'fa-pause', c: 'bad', ti: '停用', d: '不删除，标注不在能力范围' },
    待确认: { ic: 'fa-question-circle', c: 'bad', ti: '待确认', d: '对齐不确定，必须先答' }
  };
  /* 人工答案 → 写操作动词。答完才定得下来，所以动词是算出来的不是存出来的 */
  function verbOf(r) {
    var v = r['对齐动词'];
    var a = function (id) { var x = S.answers[id]; return x ? String(x.other || x.choice || '') : ''; };
    var q96 = a('Q096'), q97 = a('Q097'), q98 = a('Q098'), q99 = a('Q099'), q100 = a('Q100');
    if (v === '待确认') {
      if (r['实体类型'] === '型号') return /^不是/.test(q96) ? '新建' : (q96 ? '复用' : '待确认');
      if (r['实体键'] === 'S01-M01-T02') return /^型号层新建/.test(q98) ? '新建' : (/^按基线挂型号层/.test(q98) ? '变更' : (q98 ? '复用' : '待确认'));
      return /^不是/.test(q97) ? '新建' : (/^同一个，把方法标准号/.test(q97) ? '变更' : (q97 ? '复用' : '待确认'));
    }
    if (v === '变更') return /^保留/.test(q99) ? '复用' : (q99 ? '变更' : '待确认');
    if (v === '停用') return /^保留启用/.test(q100) ? '复用' : (q100 ? '停用' : '待确认');
    return v;
  }
  function alignPlan() {
    var blk = (global.SHEET_SEED || {})['05_系统对齐'];
    if (!blk) return { n: 0, by: {}, risky: [] };
    var by = {}, risky = [];
    blk.rows.forEach(function (r) {
      var v = verbOf(r);
      (by[v] = by[v] || { n: 0, rows: [] }); by[v].n++; by[v].rows.push([r, v]);
      if (v === '变更' || v === '停用' || v === '待确认') risky.push([r, v]);
    });
    return { n: blk.rows.length, by: by, risky: risky };
  }
  function riskyRow(r, v) {
    var verb = VERB[v];
    return '<div class="wrow"><span class="wv ' + verb.c + '"><i class="fa ' + verb.ic + '"></i>' + v + '</span>' +
      '<span class="wn">' + esc(r['实体类型']) + ' · ' + esc(r['实体名称']) + '</span>' +
      '<span class="wb">' + esc(r['对齐目标编码'] || '—') + '</span>' +
      '<span class="wz">' + esc(r['对齐依据']) + '</span></div>';
  }
  function renderAlign() {
    var el = document.getElementById('wbF3W'); if (!el) return;
    var pl = alignPlan(), ks = ['新建', '挂载', '复用', '变更', '停用', '待确认'];
    var dist = ks.filter(function (k) { return pl.by[k]; }).map(function (k) {
      return '<span class="wchip ' + VERB[k].c + '"><i class="fa ' + VERB[k].ic + '"></i>' + k + '<b>' + pl.by[k].n + '</b></span>';
    }).join('');
    el.innerHTML = '<h4>写操作计划<span class="cn">' + pl.n + ' 个实体 · 对齐基准：' +
      (S.answers['Q095'] ? esc(S.answers['Q095'].other || S.answers['Q095'].choice) : '未选') + '</span></h4>' +
      '<div class="wdist">' + dist + '</div>' +
      (pl.risky.length ? '<div class="wsec">动到已有数据的条目（' + pl.risky.length + '）——这些不会静默执行</div>' +
        pl.risky.map(function (x) { return riskyRow(x[0], x[1]); }).join('') +
        (S.answers['Q095'] && !pl.by['待确认']
          ? '<label class="wauth' + (ok('import.auth') ? '' : ' off') + '"><input type="checkbox" id="cbAuth" ' +
            (S.auth ? 'checked' : '') + (ok('import.auth') ? '' : ' disabled') +
            ' onchange="WB.authorize(this.checked)" /> 我已逐条确认以上 ' +
            ((pl.by['变更'] || {}).n || 0) + ' 处变更与 ' + ((pl.by['停用'] || {}).n || 0) + ' 处停用会影响在流转的检测任务</label>'
          : '')
        : '<div class="wsec">本次只新建与复用，不改系统已有配置</div>');
  }

  function renderF3() {
    if (arch('f3')) return;
    renderAlign();
    var pend = skippedMembers().length, ai = aiCnt();
    var pl = alignPlan(), g = function (k) { return (pl.by[k] || {}).n || 0; };
    var risky = g('变更') + g('停用'), hold = g('待确认');
    document.getElementById('wbF3Sum').innerHTML =
      box('真缺陷', '0', 'good', '契约 / 转换层问题') +
      box('新建 / 挂载', String(g('新建') + g('挂载')), '', '系统里没有的，按稿件创建') +
      box('复用 / 变更 / 停用', g('复用') + ' / ' + g('变更') + ' / ' + g('停用'), risky && !S.auth ? 'bad' : '',
        '复用不动系统 · 变更停用需授权') +
      box('跳过待二次确认', String(pend + hold), (pend + hold) ? 'bad' : 'good', '本轮再问一次');
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
    var why = !S.answers['Q095'] ? '先答范围级「对齐基准」'
      : hold ? '还有 ' + hold + ' 处系统对齐没定，写操作动词算不出来'
      : (risky && !S.auth) ? risky + ' 处变更/停用动到在流转的数据，需逐条授权'
      : pend ? '还有 ' + pend + ' 类跳过项未二次处置（V24）' : '';
    var gate = why || (ai ? '可入库：' + ai + ' 处将由 AI 自决落库，入库后推送自决清单'
      : '可入库：新建 ' + (g('新建') + g('挂载')) + ' · 复用 ' + g('复用') + ' · 变更 ' + g('变更') + ' · 停用 ' + g('停用'));
    document.getElementById('wbF3Gate').innerHTML = '<i class="fa ' + (why ? 'fa-lock' : 'fa-unlock') + '"></i> ' + gate;
    document.getElementById('btnImport').disabled = !!why;
    var bell = document.getElementById('wbBell');
    bell.style.display = ai ? '' : 'none';
    document.getElementById('wbBellN').textContent = ai;
    syncSlots();
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
    /* 同类动作合并成一条累计回执，不是一旦就刷一屏长句 */
    mini('ai-decide', groupOf(id).length, { v: p.value, c: groupOf(id).length });
    S.notified++; save(); render(); WBsyncTasks(); renderF3();
  };
  /* 旧三 tab 时代的 stage 语义保留为别名：F1→收件箱，F2→表格，F3→预检 */
  WB.stage = function (k, focusId) {
    S.stage = k;
    var map = { f1: 'inbox', f2: 'sheet', f3: 'f3', upload: 'upload' };
    WB.openArt(map[k] || 'inbox');
    if (focusId) setTimeout(function () {
      var g = groupOf(focusId)[0], c = document.getElementById('q_' + g);
      if (c) { c.scrollIntoView({ block: 'center' }); c.classList.add('flash'); setTimeout(function () { c.classList.remove('flash'); }, 1400); }
    }, 260);
  };
  WB.authorize = function (v) {
    if (v && !ok('import.auth')) { noPerm('import.auth'); renderF3(); return; }
    S.auth = v ? 1 : 0; save(); renderF3();
  };
  function importBlock() {
    var pl = alignPlan(), g = function (k) { return (pl.by[k] || {}).n || 0; };
    if (!S.answers['Q095']) return '先答范围级「对齐基准」';
    if (g('待确认')) return g('待确认') + ' 处系统对齐没定';
    if ((g('变更') + g('停用')) && !S.auth) return '变更/停用未逐条授权';
    if (skippedMembers().length) return '跳过项未二次处置';
    return '';
  }
  WB.importRun = function () {
    if (!ok('import')) { noPerm('import'); return; }
    var tv = taskView();
    if (tv) { if (!tv.done || tv.imp) return; }
    else if (importBlock()) { renderF3(); return; }
    var el = document.getElementById('wbF3Run'); el.style.display = '';
    var ver = tv ? (tv.o.ver || 'v1-final')
      : 'v' + (global.ORCver || 1) + (S.finalized ? '-final' : '-draft');
    var rows = tv ? (tv.o.rows || tv.o.sheets + ' 张 sheet') : 0;
    if (!tv && global.SHEET_SEED) {
      var sd = SHEET_SEED, gc = function (k) { return ((sd[k] || {}).rows || []).length; };
      rows = gc('20_样品') + ' 样品 · ' + gc('40_型号') + ' 型号 · ' + gc('50_试验项') + ' 试验项 · ' +
        (gc('60_控制参数') + gc('70_测量参数') + gc('80_计算参数') + gc('90_标称值')) + ' 参数 · ' +
        gc('A1_判定条件') + ' 判定条件';
    }
    var blocks = tv ? (tv.t.samples || [])
      : ['S01 DS实壁类电缆导管_直管', 'S02 DS实壁类塑料电缆导管_带承口'];
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
        if (!tv) { S.imported = 1; writeback('import'); save(); }
        renderF3(); renderArtNav();
        if (global.TS) TS.markImported();
        if (tv) { renderF3(); paintHeader(); renderArtNav(); }   // 存档任务：入库完顶栏/进度要跟着翻篇
        var f = global.DEMO ? (tv ? DEMO.forTask(tv.t, tv.o) : DEMO.download()) : null;
        receipt('<div class="rc-t"><i class="fa fa-database"></i>入库完成 <b>' + blocks.length + ' 个样品块</b>' +
          '<span class="rc-m">' + ver + '</span></div>' +
          '<div class="rc-l">写入 ' + rows + '。按样品分块，一块一事务，本次未触发回滚。' +
          (tv ? '' : (function () { var p = alignPlan(), q = function (k) { return (p.by[k] || {}).n || 0; };
            return '新建 ' + (q('新建') + q('挂载')) + ' · 复用 ' + q('复用') +
              ' · 变更 ' + q('变更') + ' · 停用 ' + q('停用') + '。'; })()) +
          (tv ? '该任务的 ' + ((tv.o.skips || 0)) + ' 处跳过项已在定稿前闭环。'
            : (aiCnt() ? '<b>' + aiCnt() + '</b> 处由 AI 自决落库，自决清单已推送到站内消息，' +
              '每条写明落库取值、依据与回改路径。' : '全部数据来自人工确认的稿件。')) +
            '拆解成果已回写标准成果库。</div>',
          '<a class="ra" href="sample-data-detail.html?cat=dlwz" target="_blank"><i class="fa fa-external-link"></i> 打开样品数据页</a>' +
          (f ? '<a class="dl" download="' + f.name + '" href="' + f.url + '"><i class="fa fa-download"></i> 下载稿件</a>' : '') +
          '<button class="ra" onclick="ORC.panel()">看编排留痕</button>');
        if (global.DEMO) DEMO.mountQuick();
        return;
      }
      document.getElementById('imp' + i).className = 'wb-stage on'; i++; setTimeout(step, 900);
    })();
  };
  WB.pick = (function (orig) {
    return function (id, v, fromF3) {
      orig(id, v);
      renderF3();          // 写操作计划跟着答案实时重算
    };
  })(WB.pick);

  Object.keys(_wb).forEach(function (f) { WB[f] = _wb[f]; });
  WB.raws = function () { return RAW; };
  WB.raw = function (id) { return RAW.filter(function (x) { return x.id === id; })[0]; };
  WB.state = function () { return S.answers; };
  WB.edits = function () { return global.F2 ? F2.state().edits : {}; };
  WB.sync = function () { syncSlots(); };
  WB.paintChatNow = function () { paintChat(); };
  WB.pushMsg = function (who, name, text) {
    var m = say(who, name, text); paintChat(); return m;
  };
  WB.replaceMsg = function (m, html) {
    for (var i = S.chat.length - 1; i >= 0; i--) { if (S.chat[i] === m) { m.text = html; break; } }
    var bd = document.querySelector('#wbChat .wb-msg:last-child .bd');
    if (bd && S.chat[S.chat.length - 1] === m) bd.innerHTML = html; else paintChat();
  };
  WB.paintLast = function () {
    var el = document.getElementById('wbChat');
    if (el && S.chat.length) el.lastElementChild.querySelector('.bd').innerHTML = S.chat[S.chat.length - 1].text;
  };
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
    if (arch('upload')) return;
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
          '逐 sheet 生成|23 张 · 166 参数 / 42 判定条件'].map(function (x) {
            var a = x.split('|');
            return '<div class="wb-stage done"><span class="dot"></span>' + esc(a[0]) + '<span class="out">' + esc(a[1]) + '</span></div>';
          }).join('') + '</div>' +
        '<div class="f1-acts"><button class="btn-save" onclick="WB.openArt(\'inbox\')">进入问题收件箱</button>' +
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


  WB.markFinal = function () { S.finalized = 1; S.generated = 1; writeback('final'); save(); paintHeader(); };
  /* 回执：写动作必须在对话里留下可点的凭据，而不是只弹一句系统提示 */
  function receipt(html, acts) {
    say('ai', 'AI 助手', '<div class="rc">' + html + (acts ? '<div class="rc-a">' + acts + '</div>' : '') + '</div>');
    paintChat();
  }
  WB.receipt = receipt;
  function counts4() {
    var un = 0, sk = 0;
    RAW.forEach(function (q) { var a = S.answers[q.id]; if (!a) un++; else if (a.mode === 'skip') sk++; });
    return { un: un, sk: sk, ai: aiCnt(), scope: SCOPE.filter(function (q) { return !S.answers[q.id]; }).length };
  }
  /* 同类动作合并成一行累计，避免一次批量操作刷出满屏长句 */
  function mini(tag, n, item) {
    var last = S.chat[S.chat.length - 1];
    if (last && last.tag === tag) {
      last.n += n; last.items.push(item); last.text = tag === 'skip' ? skipLine(last) : decideLine(last);
      return last;
    }
    var m = { who: 'sys', name: '系统', at: now(), tag: tag, n: n, items: [item] };
    m.text = tag === 'skip' ? skipLine(m) : decideLine(m);
    S.chat.push(m); return m;
  }
  function skipLine(m) {
    return '<span class="mini"><i class="fa fa-clock-o"></i><b>跳过 ' + m.n + ' 处</b>' +
      (m.items.length > 2 ? '<span>· ' + m.items.length + ' 类</span>'
        : '<span>· 占位 ' + esc(m.items[0].v) + '</span>') +
      '<span class="u">不阻塞出稿 · F3 入库前再问 · 可撤销</span></span>';
  }
  function decideLine(m) {
    var top = m.items.slice(0, 2).map(function (x) { return esc(x.v) + ' ×' + x.c; }).join('、');
    return '<span class="mini"><i class="fa fa-magic"></i><b>AI 自决落库 ' + m.n + ' 处</b>' +
      (m.items.length > 2 ? ' · ' + m.items.length + ' 类' : ' · ' + top) +
      '<span class="u">入库后推送自决清单 · 可撤销</span></span>';
  }
  WB.counts = counts4;
  WB.sideKey = function () { return S.side || ''; };
  WB.demo = function () { return global.TS ? !!TS.sel().cur : true; };
  WB.refreshInbox = function () { renderInbox(); paintChat(); };
  WB.askImport = function () { SH.askImport(); paintChat(); };
  WB.archNote = function (ask) { return archNote(ask); };
  WB.renderF3 = function () { renderF3(); };
  WB.status = function () { return { generated: !!S.generated, finalized: !!S.finalized, imported: !!S.imported, ver: global.ORCver || 1 }; };
  WB.finalize = function () {
    if (!ok('finalize')) { noPerm('finalize'); return; }
    var c = counts4();
    if (c.un) {
      say('ai', 'AI 助手', '还有 <b>' + c.un + '</b> 条没处置，不能定稿。' + artShell('inbox', { su: c.un + ' 条未处置' }, 1));
      paintChat(); return;
    }
    var ver = 'v' + (global.ORCver = (global.ORCver || 1) + 1) + '-final';
    WB.markFinal();
    var f = global.DEMO ? DEMO.emit(ver) : null;
    if (global.TS && f) TS.addOutput({ ver: ver, state: '定稿', sheets: f.sheets, size: f.size,
      rows: counts4().sk + ' 处待 F3 再问', at: now(), hits: [] });
    if (global.F2) F2.render();
    renderF3(); renderArtNav();
    receipt('<div class="rc-t"><i class="fa fa-lock"></i>稿件已定稿 <b>' + ver + '</b>' +
      (f ? '<span class="rc-m">' + f.sheets + ' sheet · ' + Math.round(f.size / 1024) + ' KB</span>' : '') + '</div>' +
      '<div class="rc-l">定稿不可变，再改会自动开新版本。' +
      (c.sk ? '其中 <b>' + c.sk + '</b> 处是跳过——按口径不阻塞定稿，F3 入库前会再问一次。' : '全部问题均已人工确认。') +
      (c.ai ? ' 已有 <b>' + c.ai + '</b> 处 AI 自决落库。' : '') + '拆解成果已回写标准成果库。</div>',
      (f ? '<a class="dl" download="' + f.name + '" href="' + f.url + '"><i class="fa fa-download"></i> 下载定稿</a>' : '') +
      '<button class="ra" onclick="WB.openArt(\'f3\')">去预检入库</button>' +
      '<button class="ra" onclick="WB.openArt(\'sheet\')">看稿件表格</button>');
    if (global.DEMO) DEMO.mountQuick();
  };
  WB.markGenerated = function () { S.generated = 1; if (S.imported) S.imported = 2; save(); paintHeader(); };
  WB.ask = function (t) {
    t = String(t || '').trim();
    var atts = global.DEMO ? DEMO.attachments() : [];
    if (!t && !atts.length) return;
    var inp = document.getElementById('wbBatch');
    if (atts.length) {
      say('me', '你', (t ? esc(t) : '（只发了附件）') + '<div class="sent-att">' + atts.map(function (a) {
        return '<span><i class="fa ' + (a.slot === 'img' ? 'fa-image' : 'fa-paperclip') + '"></i> ' + esc(a.name) + '</span>';
      }).join('') + '</div>');
      DEMO.clearAttachments();
      if (inp) inp.value = '';
      if (taskView()) { archNote(!!t); return; }
      if (!t) { say('ai', 'AI 助手', '附件收到了。说一句要我做什么都行——比对判定条件、补参数、改可选项都可以。'); paintChat(); return; }
      if (global.ORC) ORC.ask(t, 1);
      paintChat(); return;
    }
    if (taskView()) { archNote(true); return; }
    if (global.DEMO && DEMO.ask(t)) { if (inp) inp.value = ''; return; }
    if (global.ORC) ORC.ask(t); else say('sys', '系统', '编排器未加载。');
    if (inp) inp.value = '';
  };
  global.WB = WB;
  function gate(left, why) {
    var b = document.getElementById('btnRun'), t = document.getElementById('wbGateTxt');
    if (b) { b.disabled = left > 0; b.title = left ? why : ''; }
    if (t) t.textContent = left ? why : '';
  }

  global.WBInit = function (raw) {
    RAW = raw; build();
    var d = load(); S.answers = d.a || {}; S.collapsed = d.c || {}; S.chat = d.ch || [];
    if (!S.chat.length) { WB.boot(); return; }
    WB.restore(d); render();
  };
  function renderTasks() { if (global.TS) TS.render(); }
  WB.pickTask = function (i) { if (global.TS) TS.pick(i); };
  function renderChipsSafe() { var e = document.getElementById('attChips'); if (e && global.DEMO) e.innerHTML = ''; }
  WB.archive = function () {
    if (global.TS) TS.saveSession(S.chat, S.answers,
      { gen: S.generated, fin: S.finalized, imp: S.imported, ver: global.ORCver || 1 });
  };
  WB.switchTask = function (i) {
    var t = TS.all()[i];
    document.getElementById('wbTaskName').textContent = t.code;
    var st = t.st || {};
    S.generated = st.gen || 0; S.finalized = st.fin || 0; S.imported = st.imp || 0;
    global.ORCver = st.ver || 1;
    S.chat = []; OPEN = { upload: 1 };
    if (t.chat && t.chat.length) {                 // 回来时恢复原对话与处置
      S.chat = t.chat; S.answers = t.answers || {};
      paintChat(); render(); paintArts();
      if (global.DEMO) DEMO.mountQuick(); return;
    }
    if (t.cur) { S.answers = t.answers || {}; WB.boot(); paintArts(); return; }
    S.answers = {};
    var cards = artShell('upload', { su: t.files.length + ' 份输入' }, 1) +
      artShell('inbox', { su: (t.qa && t.qa.length) ? t.qa.length + ' 条已沉淀' : '待补料' });
    if (t.outputs.length) cards += artShell('sheet', { su: t.outputs[0].ver + ' · ' + t.outputs[0].state }) +
      artShell('f3', { su: t.stage >= 4 ? '已入库' : '待入库' });
    say('ai', 'AI 助手', '<b>' + esc(t.code) + '</b> · ' + esc(t.nm) + ' · <b>' + esc(t.status) + '</b>。' +
      (t.hits.length ? esc(t.hits[0]) + '。' : '尚未命中库内成果。') +
      (t.outputs.length ? '稿件可直接入库，或下载后线下改。' : '补齐检测依据标准文件，我按 F1 拆。') + cards);
    paintChat(); render(); paintArts();
  };
  function paintArts() { ['upload', 'inbox', 'sheet', 'f3'].forEach(renderStage); }
  WB.newTask = function () {
    if (!ok('task.create')) { noPerm('task.create'); return; }
    S.answers = {};
    S.chat = []; S.answers = {}; OPEN = { upload: 1 }; S.generated = 0; S.finalized = 0; S.imported = 0;
    say('ai', 'AI 助手', '新任务已建。先上传<b>检测能力范围表</b>和<b>检测依据标准文件</b>，' +
      '我从正文识别标准号并判断该拆几个任务。' + artShell('upload', { su: '拖拽或点击上传' }, 1));
    paintChat(); render();
    if (global.DEMO) { DEMO.resetState(); DEMO.mountQuick(); }
  };
  global.WBTasks = TASKS;
  global.WBsyncTasks = function () {
    TASKS[0].q = RAW.length;
    TASKS[0].st = S.imported ? '已入库' : (S.generated ? '校稿中' : '校稿中');
    renderTasks();
  };
})(window);
