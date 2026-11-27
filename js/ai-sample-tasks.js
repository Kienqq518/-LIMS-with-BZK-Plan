/**
 * 任务与文件：左栏任务列表 + 右侧「文件 / 预览」面板
 * 每个任务都有输入（上传的料）与产出（稿件版本），看得见也下得走。
 */
(function (global) {
  'use strict';
  var KEY = 'lims.wb.tasks.v3';
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var SLOT_TI = { cap: '检测能力范围表', std: '检测依据标准文件', rec: '检测报告 / 原始记录单', img: '截图 / 图片' };
  var SEED = [
    { code: 'DL/T 802.3—2023', nm: '实壁类塑料电缆导管', status: '校稿中', stage: 2, cur: 1,
      files: [], outputs: [], hits: [] },
    { code: 'GB/T 12706.2—2020', nm: '中压电力电缆（6kV~30kV）', status: '待补料', stage: 1, cur: 0,
      files: [{ name: '认可的检测能力范围(中文).pdf', size: 533504, slot: 'cap' }],
      outputs: [], hits: ['库里已有该标准，未拆解'], qa: [], samples: [] },
    { code: 'IEC 61156-5:2012', nm: '铁路机车用通讯电缆（数据线）', status: '已入库', stage: 4, cur: 0,
      files: [{ name: '认可的检测能力范围(中文).pdf', size: 533504, slot: 'cap' },
        { name: 'IEC 61156-5-2012.pdf', size: 2129920, slot: 'std' },
        { name: '数据线.docm', size: 118784, slot: 'rec' }],
      outputs: [{ ver: 'v2-final', state: '定稿', sheets: 23, size: 651264, skips: 0, imported: 1,
        impAt: '2026-05-09 09:12', rows: '1 样品 · 5 型号 · 6 试验项 · 58 参数 · 54 判定条件', at: '2026-05-08 17:26' }],
      hits: ['命中库内成果 v2-final', '沉淀范围级问答 4 条', '报告 RC20260500101 已回读比对'],
      samples: ['S01 铁路机车用通讯电缆'],
      qa: [{ q: '特性阻抗技术要求写 100±15，系统里怎么落？', a: '标称值类型=区间 [85,115]', src: '报告 §7.1.2 · IEC 61156-5 表 3' },
        { q: '衰减与串音按 9 个频率档逐一判定，用多行映射还是拆成 9 个参数？', a: '多行映射，自变量=频率', src: 'IEC 61156-5 表 2' },
        { q: '线对1 / 线对2 各出一个结论，判断层级选哪个？', a: '线芯（每线对各判）', src: '报告 §7.1.1' },
        { q: '报告符号「-」表示不要求判定，结论映射怎么表达？', a: '补一档「不判定」，不参与合格判定', src: '报告 §5 符号说明' }],
    },
    { code: 'EN 50306-2:2020', nm: '铁路机车车辆电缆', status: '已定稿', stage: 3, cur: 0,
      files: [{ name: '认可的检测能力范围(中文).pdf', size: 533504, slot: 'cap' },
        { name: 'EN 50306-2.pdf', size: 1845760, slot: 'std' },
        { name: 'EN50306.docm', size: 96256, slot: 'rec' }],
      outputs: [{ ver: 'v3-final', state: '定稿', sheets: 22, size: 604160, skips: 0,
        rows: '3 样品 · 11 型号 · 24 试验项 · 208 参数', at: '2026-11-18 16:02' }],
      hits: ['命中库内成果 v3-final', '沉淀范围级问答 5 条'],
      samples: ['S01 EN 50306-2 · 无卤低烟聚烯烃绝缘电缆', 'S02 EN 50306-2 · 交联聚烯烃绝缘电缆', 'S03 EN 50306-2 · 乙丙橡胶绝缘软电缆'],
      qa: [{ q: '成束燃烧试验按哪个供火类别入库？能力表只写「单根/成束」未分档。', a: 'B2', src: '能力表 P7 · EN 50306-2 表 3' },
        { q: '绝缘电阻的试验温度是否随型号变化？', a: '统一 20 ℃', src: 'EN 50306-2 §7.3.2' },
        { q: '弯曲半径倍数对软结构导体是否放宽？', a: '按 4D', src: '原始记录单 EN50306.docm' },
        { q: '臭氧老化能力表未覆盖，是否入库？', a: '不入库', src: '能力表 P7 未列' },
        { q: '热冲击的取样芯数规则？', a: '三芯取 A/C 相', src: 'EN 50306-2 §8.2.1' }] }
  ];

  var T = load();
  function load() {
    try { var r = localStorage.getItem(KEY); if (r) { var d = JSON.parse(r); if (d && d.list && d.list.length) return d; } } catch (e) { }
    return { list: JSON.parse(JSON.stringify(SEED)), sel: 0 };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { } }
  function kb(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  function stamp() {
    var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  var TS = {
    all: function () { return T.list; },
    sel: function () { return T.list[T.sel]; },
    idx: function () { return T.sel; },
    pick: function (i) {
      if (global.WB) WB.archive();                 // 先把当前对话与处置存回原任务
      T.sel = i; save(); TS.render();
      if (global.WB) WB.switchTask(i);
    },
    addFiles: function (files) {
      var t = T.list[T.sel];
      files.forEach(function (f) { t.files.push({ name: f.name, size: f.size, slot: f.slot || 'std' }); });
      save(); TS.render();
    },
    delFile: function (i) { T.list[T.sel].files.splice(i, 1); save(); TS.render(); },
    addOutput: function (o) {
      var t = T.list[T.sel];
      t.outputs.unshift(o); t.status = o.state === '定稿' ? '已定稿' : '校稿中'; t.stage = o.state === '定稿' ? 3 : 2;
      save(); TS.render();
    },
    markImported: function () {
      var t = T.list[T.sel];
      t.status = '已入库'; t.stage = 4;
      if (t.outputs[0]) { t.outputs[0].imported = 1; t.outputs[0].impAt = stamp(); }
      save(); TS.render();
    },
    saveSession: function (chat, answers, st) {
      var t = T.list[T.sel]; t.chat = chat; t.answers = answers; if (st) t.st = st; save();
    },
    create: function () {
      T.list.push({ code: '新任务 · 待识别标准号', nm: '尚未上传标准文件', status: '待补料', stage: 1, cur: 0,
        files: [], outputs: [], hits: [], qa: [], samples: [] });
      T.sel = T.list.length - 1; save(); TS.render();
      if (global.WB) WB.newTask();
    },
    kb: kb, SLOT_TI: SLOT_TI,

    render: function () {
      var list = document.getElementById('taskList');
      if (list) list.innerHTML = T.list.map(function (t, i) {
        var bar = [1, 2, 3].map(function (k) {
          return '<i class="' + (k < t.stage ? 'done' : k === t.stage ? 'cur' : '') + '"></i>';
        }).join('');
        var td = global.SH ? SH.todo(i) : 0;
        return '<div class="wb-task' + (i === T.sel ? ' on' : '') + '" onclick="TS.pick(' + i + ')">' +
          '<div class="code">' + esc(t.code) +
          '<span class="tmore" title="更多" onclick="SH.menu(' + i + ',event)"><i class="fa fa-ellipsis-h"></i></span></div>' +
          '<div class="nm">' + esc(t.nm) + '</div>' +
          '<div class="bar">' + bar + '</div>' +
          '<div class="meta"><span class="st">' + esc(t.status) + '</span>' +
          '<span class="rf">' + (t.files.length ? t.files.length + ' 份料' : '—') +
          (t.outputs.length ? ' · ' + t.outputs.length + ' 产出' : '') + '</span>' +
          (td ? '<span class="todo">待我 ' + td + '</span>' : '') + '</div></div>';
      }).join('');
      panel();
      progress();
      if (global.SH) SH.paint();
    }
  };

  /* ── 右侧面板：文件 / 预览 ── */
  var PTAB = 'files';
  function panel() {
    var el = document.getElementById('side'); if (!el) return;
    el.classList.add('show');
    document.querySelector('.wb-conv').classList.add('wide');
    var t = TS.sel();
    document.getElementById('sideTabs').innerHTML =
      '<span class="' + (PTAB === 'files' ? 'on' : '') + '" onclick="TS.tab(\'files\')">文件</span>' +
      '<span class="' + (PTAB === 'view' ? 'on' : '') + '" onclick="TS.tab(\'view\')">预览</span>';
    var body = document.getElementById('sideBody');
    var sk = global.WB ? WB.sideKey() : '';
    document.getElementById('sideTabs').children[1].style.display = sk ? '' : 'none';
    if (PTAB === 'view') {
      body.innerHTML = sk ? '<div data-mount="' + sk + '"></div>' : viewHtml();
      if (sk && global.WB && WB.renderStage) WB.renderStage(sk);
      if (global.WB && WB.sync) WB.sync();
      return;
    }
    var files = t.files.length ? t.files.map(function (f, i) {
      return '<div class="pf"><span class="ic"><i class="fa ' + icon(f.slot) + '"></i></span>' +
        '<span class="nm" title="' + esc(f.name) + '">' + esc(f.name) + '</span>' +
        '<span class="sz">' + kb(f.size) + '</span>' +
        '<span class="sl">' + esc(SLOT_TI[f.slot] || '输入') + '</span>' +
        '<i class="fa fa-times" onclick="TS.delFile(' + i + ')"></i></div>';
    }).join('') : '<div class="pe">还没有上传文件</div>';
    var outs = t.outputs.length ? t.outputs.map(function (o, i) {
      return '<div class="po' + (o.imported ? ' imp' : '') + '">' +
        '<span class="ic"><i class="fa fa-file-excel-o"></i></span>' +
        '<span class="nm">' + esc(codeFile(t.code) + '_' + o.ver + '.xlsx') + '</span>' +
        '<span class="sz">' + o.sheets + ' sheet · ' + kb(o.size) + '</span>' +
        '<span class="sl">' + esc(o.state) + (o.imported ? ' · 已入库' : '') + '</span>' +
        '<button class="odl" onclick="TS.dl(' + i + ')">下载</button></div>' +
        (o.rows ? '<div class="po-sub">' + esc(o.rows) + '</div>' : '') +
        '<div class="po-sub">' + esc(o.at || '') + (o.hits && o.hits.length ? ' · ' + esc(o.hits.join(' · ')) : '') + '</div>';
    }).join('') : '<div class="pe">还没有产出</div>';
    body.innerHTML =
      '<div class="ph2"><b>' + esc(t.code) + '</b><span class="st">' + esc(t.status) + '</span></div>' +
      '<div class="psec"><h5>上传的料<span class="n">' + t.files.length + '</span></h5>' +
      '<button class="padd" onclick="document.getElementById(\'fileIn\').click()"><i class="fa fa-plus"></i> 添加文件</button>' +
      files + '</div>' +
      '<div class="psec"><h5>产出<span class="n">' + t.outputs.length + '</span></h5>' + outs + '</div>' +
      (t.hits && t.hits.length ? '<div class="psec"><h5>标准成果库</h5>' +
        t.hits.map(function (h) { return '<div class="ph3"><i class="fa fa-cube"></i>' + esc(h) + '</div>'; }).join('') + '</div>' : '') +
      (t.outputs.length ? '<div class="psec"><a class="plink" href="sample-data-detail.html?cat=dlwz" target="_blank">' +
        '<i class="fa fa-external-link"></i> 打开样品数据页</a>' +
        '<a class="plink" href="standard-library.html" target="_blank"><i class="fa fa-book"></i> 打开标准成果库</a></div>' : '');
  }
  /* 流程节点按实际执行顺序排，问题箱只在它该出现的地方插进来：
     上传料 → 拆解生成 →（问题箱 · 拆解）→ 校稿 → 定稿 → 入库检查 →（问题箱 · 入库）→ 入库完成 */
  function steps(t) {
    var live = !!t.cur && global.WB;
    var st = live ? WB.status() : { generated: t.stage >= 2, finalized: t.stage >= 3, imported: t.stage >= 4 };
    var c = live && WB.counts ? WB.counts() : null;
    var o = t.outputs[0] || {};
    var imp = t.stage >= 4 || !!o.imported;
    var nf = live && global.DEMO ? DEMO.list().length : t.files.length;
    var ver = live ? 'v' + (global.ORCver || 1) : (o.ver || '');
    var out = [];
    var P = function (ti, ic, k, s, note) { out.push({ ti: ti, ic: ic, k: k, s: s, note: note }); };

    P('上传料', 'fa-upload', 'upload',
      nf >= 3 ? ['done', nf + ' 份料已齐'] : (nf ? ['blocked', '还缺 ' + (3 - nf) + ' 份料'] : ['todo', '未上传']));
    P('拆解生成', 'fa-magic', 'upload',
      st.generated ? ['done', live ? 'v1-draft 已出' : '已出稿 ' + (t.outputs.length || 1) + ' 版']
        : (nf >= 3 ? ['cur', '可以开始拆解'] : ['todo', '未生成']));
    if (st.generated) {
      var un = c ? c.un : 0, sc = c ? c.scope : 0;
      var qa = (!live && t.qa) ? t.qa.length : 0;
      P('问题箱 · 拆解', 'fa-inbox', 'inbox',
        live ? (un ? (sc ? ['blocked', sc + ' 条必答 · 共剩 ' + un] : ['cur', un + ' 条待处置']) : ['done', '全部处置完'])
          : (qa ? ['done', qa + ' 条已沉淀'] : ['todo', '没有问题']));
      P('校稿', 'fa-table', 'sheet',
        st.finalized ? ['done', '稿件已锁定'] : (live && un ? ['blocked', '还有 ' + un + ' 条没答'] : ['cur', '在线改或下载线下改']));
      P('定稿生成', 'fa-lock', 'sheet',
        st.finalized ? ['done', (live ? ver + '-final' : ver) + ' 已定稿'] : ['todo', '未定稿']);
    }
    if (st.finalized || imp) {
      var pend = c ? c.sk : (o.skips || 0);
      P('入库检查', 'fa-check-circle', 'f3',
        imp ? ['done', '真缺陷 0 · 已放行'] : ['cur', '按动词算写操作计划']);
      if (pend) P('问题箱 · 入库', 'fa-question-circle', 'f3', ['blocked', pend + ' 处跳过要再问一次']);
      P('入库完成', 'fa-database', 'f3',
        imp ? ['done', (t.samples ? t.samples.length : 2) + ' 块已入库'] : ['cur', '待入库']);
    }
    return out;
  }
  function progress() {
    var el = document.getElementById('artNav'); if (!el) return;
    var ns = steps(TS.sel());
    el.innerHTML = ns.map(function (n, i) {
      return '<div class="pg-i s-' + n.s[0] + '" onclick="WB.openArt(\'' + n.k + '\')">' +
        '<span class="dot"><i class="fa ' + (n.s[0] === 'done' ? 'fa-check' : n.s[0] === 'blocked'
          ? 'fa-exclamation' : n.s[0] === 'cur' ? 'fa-play' : '') + '"></i></span>' +
        '<span class="ti"><i class="fa ' + n.ic + '"></i>' + esc(n.ti) + '</span>' +
        '<em>' + esc(n.s[1]) + '</em></div>' + (i < ns.length - 1 ? '<div class="pg-l s-' + n.s[0] + '"></div>' : '');
    }).join('');
  }
  function icon(slot) {
    return slot === 'cap' ? 'fa-file-excel-o' : slot === 'rec' ? 'fa-file-text-o' : slot === 'img' ? 'fa-file-image-o' : 'fa-file-pdf-o';
  }
  function codeFile(code) {   // DL/T 802.3—2023 → DLT-802.3-2023
    return String(code).replace(/[—–]/g, '-').replace(/\s*\/\s*/g, '').replace(/\s+/g, '-').replace(/:/g, '-');
  }
  function viewHtml() {
    var t = TS.sel();
    if (!t.outputs.length) return '<div class="pe">这个任务还没有稿件可预览。生成后这里会显示 23 张 sheet 的结构与色标。</div>';
    var sd = global.SHEET_SEED;
    if (!sd) return '<div class="pe">预览数据未加载。</div>';
    return '<div class="pv-list">' + Object.keys(sd).filter(function (k) {
      return k !== 'tests' && k !== 'conf' && sd[k].cols;
    }).map(function (k) {
      return '<div class="pv-i"><b>' + esc(k) + '</b><span>' + sd[k].rows.length + ' 行 × ' + sd[k].cols.length + ' 列</span></div>';
    }).join('') + '</div>';
  }
  TS.tab = function (t) { PTAB = t; panel(); };
  TS.progress = progress;
  TS.sideTitle = function () { return (global.WB && WB.sideKey()) ? (TS.sel().code + ' · 稿件预览') : '文件'; };
  TS.dl = function (i) {
    var t = TS.sel(), o = t.outputs[i];
    if (i === 0 && t.cur && global.DEMO) { var f = DEMO.download(); trigger(f.url, f.name); return; }
    if (global.DEMO && DEMO.forTask) { var g = DEMO.forTask(t, o); trigger(g.url, g.name); }
  };
  function trigger(url, name) {
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 300);
  }
  TS.panel = panel;
  global.TS = TS;
})(window);
