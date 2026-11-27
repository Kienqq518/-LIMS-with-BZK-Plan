/**
 * 可交互 demo：上传 → 流式思考 → 生成真实 xlsx（可下载）→ F1/F2/F3 快捷功能
 * 页面不再是写死的展示：每个按钮都真的推动状态。
 */
(function (global) {
  'use strict';
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var D = { files: [], parsed: 0, manuscript: null, ver: 'v1-draft' };
  var ATT = [];                       // 输入框里挂着的附件/图片
  function renderChips() {
    var el = document.getElementById('attChips'); if (!el) return;
    el.innerHTML = ATT.map(function (a, i) {
      return '<span class="ac' + (a.slot === 'img' ? ' img' : '') + '">' +
        (a.slot === 'img' ? '<i class="fa fa-image"></i>' : '<i class="fa fa-paperclip"></i>') +
        esc(a.name.length > 18 ? a.name.slice(0, 17) + '…' : a.name) +
        '<i class="fa fa-times" onclick="DEMO.unattach(' + i + ')"></i></span>';
    }).join('');
  }
  /* 判断顺序即优先级：记录单/报告里也带标准号，先认它，否则会被归成标准文件 */
  var SLOT_OF = [
    { k: 'rec', re: /记录|报告|原始|试验单|\.docm?$/i, ti: '检测报告 / 原始记录单', must: 0 },
    { k: 'cap', re: /能力|范围|CNAS/, ti: '检测能力范围表', must: 1 },
    { k: 'std', re: /标准|技术条件|GB|DL|IEC|EN/, ti: '检测依据标准文件', must: 1 }
  ];
  function slotOf(name) {
    for (var i = 0; i < SLOT_OF.length; i++) if (SLOT_OF[i].re.test(name)) return SLOT_OF[i].k;
    return 'std';
  }
  function counts() {
    var sd = global.SHEET_SEED || {}, g = function (k) { return ((sd[k] || {}).rows || []).length; };
    return g('20_样品') + ' 个样品 / ' + g('40_型号') + ' 个型号 / ' + g('50_试验项') + ' 个试验项 / ' +
      (g('60_控制参数') + g('70_测量参数') + g('80_计算参数') + g('90_标称值')) + ' 个参数';
  }
  function sheetCount() { return Object.keys(global.SHEET_SEED || {}).filter(function (k) {
    return k !== 'tests' && k !== 'conf' && SHEET_ORDER.indexOf(k) >= 0; }).length + 1; }
  var SHEET_ORDER = ['00_包信息', '05_系统对齐', '10_分类路径', '20_样品', '30_规格参数', '40_型号', '41_型号规格赋值', '50_试验项',
    '51_试验依据', '52_试验子项', '60_控制参数', '61_映射明细', '62_条件规则', '70_测量参数', '71_参数可选项',
    '80_计算参数', '90_标称值', 'A0_判定配置', 'A1_判定条件', 'A2_结论映射', 'B0_采集配置', 'C0_待定项', 'D0_校验规则'];

  function kb(n) { return n > 1024 * 1024 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  /* ── 上传区 ── */
  function dropzone() {
    var have = {};
    D.files.forEach(function (f) { have[f.slot] = 1; });
    var rows = D.files.map(function (f, i) {
      return '<div class="fz-f"><span class="ic"><i class="fa ' + (f.slot === 'cap' ? 'fa-file-excel-o' : f.slot === 'rec' ? 'fa-file-text-o' : 'fa-file-pdf-o') + '"></i></span>' +
        '<span class="nm">' + esc(f.name) + '</span><span class="sz">' + kb(f.size) + '</span>' +
        '<span class="sl">' + esc((SLOT_OF.filter(function (s) { return s.k === f.slot; })[0] || {}).ti || '') + '</span>' +
        '<i class="fa fa-times" data-del="' + i + '"></i></div>';
    }).join('');
    var miss = SLOT_OF.filter(function (s) { return s.must && !have[s.k]; }).map(function (s) { return s.ti; });
    return '<div class="fz' + (D.files.length ? ' filled' : '') + '" id="fz">' +
      '<i class="fa fa-cloud-upload"></i><div class="t">拖进来，或点击选择</div>' +
      '<div class="s">能力范围表 · 检测依据标准文件 · 报告或原始记录单</div>' +
      (rows ? '<div class="fz-list">' + rows + '</div>' : '') + '</div>' +
      '<div class="fz-foot"><span class="ms">' + (miss.length ? '还缺 ' + miss.join(' / ') : '料齐了') + '</span>' +
      '<button class="btn-save" data-run="f1"' + (miss.length ? ' disabled' : '') + '>生成初版 Excel</button></div>';
  }
  /* 展开位是副本、没有监听器，事件一律走 document 委托 */
  document.addEventListener('click', function (e) {
    var del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); DEMO.del(+del.getAttribute('data-del')); return; }
    var run = e.target.closest('[data-run]');
    if (run && !run.disabled) { e.stopPropagation(); DEMO[run.getAttribute('data-run')](); return; }
    if (e.target.closest('#fz') && !e.target.closest('.fz-foot')) document.getElementById('fileIn').click();
  });
  document.addEventListener('dragover', function (e) {
    var fz = e.target.closest && e.target.closest('#fz');
    if (fz) { e.preventDefault(); fz.classList.add('over'); }
  });
  document.addEventListener('dragleave', function (e) {
    var fz = e.target.closest && e.target.closest('#fz'); if (fz) fz.classList.remove('over');
  });
  document.addEventListener('drop', function (e) {
    var fz = e.target.closest && e.target.closest('#fz');
    if (fz) { e.preventDefault(); fz.classList.remove('over'); DEMO.pick(e.dataTransfer.files); }
  });

  function render() {
    var el = document.getElementById('fzHost');
    if (!el) { if (D.files.length && global.WB) WB.openArt('upload'); el = document.getElementById('fzHost'); }
    if (!el) return;
    el.innerHTML = dropzone();
    if (global.WB && WB.sync) WB.sync();
    var q = document.getElementById('quickBar');
    if (q) q.innerHTML = quick();
  }
  function quick() {
    var b = function (k, ic, ti, on) {
      return '<button class="qk" data-run="' + k + '"' + (on ? '' : ' disabled') + '>' +
        '<i class="fa ' + ic + '"></i>' + ti + '</button>';
    };
    return '<button class="qk" data-run="f1"><i class="fa fa-magic"></i>生成初版稿件</button>' +
      '<button class="qk" data-run="f2"><i class="fa fa-table"></i>' +
      (global.WB && WB.status().finalized ? '已定稿 · 下载定稿' : '校稿与定稿') + '</button>' +
      '<button class="qk" data-run="f3"><i class="fa fa-database"></i>' +
      (global.WB && WB.status().imported ? '已入库 · 看回执' : '预检入库') + '</button>';
  }

  /* ── 流式思考：以对话记录为唯一真源，每一步回写消息文本再局部重绘。
      早先只往 DOM 里追加，任何一次 paintChat 都会把已打出的行清空。── */
  function think(lines, done) {
    var st = { done: false, lines: [], cur: '' };
    var msg = WB.pushMsg('ai', 'AI 助手', '');
    function shell() {
      return '<div class="th' + (st.done ? ' ok' : '') + '"><div class="th-h">' +
        (st.done ? '<i class="fa fa-check"></i>已完成 · ' + lines.length + ' 步'
                 : '<i class="fa fa-circle-o-notch fa-spin"></i>思考中') + '</div><div class="th-b">' +
        st.lines.map(function (l) { return '<div class="th-l">' + l + '</div>'; }).join('') +
        (st.done ? '' : '<div class="th-l">' + st.cur + '<span class="cur">▍</span></div>') + '</div></div>';
    }
    function flush() {
      WB.replaceMsg(msg, shell());
      var b = document.querySelector('.wb-body'); if (b) b.scrollTop = b.scrollHeight;
    }
    flush();
    var i = 0;
    (function step() {
      if (i >= lines.length) {
        st.done = true; st.cur = ''; flush();
        setTimeout(function () { done && done(); }, 260); return;
      }
      var txt = lines[i], j = 0;
      (function type() {
        st.cur = txt.slice(0, j);
        if (j >= txt.length) { st.lines.push(txt); st.cur = ''; i++; flush(); setTimeout(step, 150); return; }
        j += Math.max(3, Math.round(txt.length / 18));
        if (j > txt.length) j = txt.length;
        if (j % 6 < 3) flush();                 // 每几步刷一次，避免每个字符都重排
        setTimeout(type, 26);
      })();
    })();
  }

  /* ── 生成真实 xlsx ── */
  var WIDE_RE = /问题文本|原文|说明|备注|要求|过程|条件|候选|依据|表达式|标签|名称$/;
  var KEYCOL = { '90_标称值': '标称值键', 'A1_判定条件': '试验项键', '61_映射明细': '归属键',
    '70_测量参数': '参数键', '80_计算参数': '参数键', '60_控制参数': '参数键', 'B0_采集配置': '参数键',
    'A2_结论映射': '试验项键', '50_试验项': '试验项键', '20_样品': '样品键', '40_型号': '型号键',
    '30_规格参数': '规格键', '52_试验子项': '子项键', '71_参数可选项': '参数键', '51_试验依据': '试验项键',
    'A0_判定配置': '试验项键', '10_分类路径': '分类路径键', '41_型号规格赋值': '型号键' };
  /* 与界面上同一套色标：C0 命中的格子在 Excel 里也是彩色的，专家线下才知道哪里不确定 */
  function cellState(sh, rowObj, c) {
    var list = ((global.SHEET_SEED || {}).conf || {})[sh] || [], k = String(rowObj[KEYCOL[sh] || ''] || '');
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!(e.row === k || e.row.indexOf(k) === 0 || k.indexOf(e.row) === 0)) continue;
      var cs = String(e.col).split('/');
      if (e.col === '*' || cs.indexOf(c) >= 0) return e.state;
    }
    return '';
  }
  function manuscript() {
    var seed = global.SHEET_SEED || {}, st = WB.state ? WB.state() : {}, rows = [];
    rows.push(['项', '值', '备注']);
    rows.push(['契约版本', 'v0.3', 'v0.3 新增 05_系统对齐：拆解前先对齐系统已有数据']);
    rows.push(['稿件版本', D.ver, 'F1 产出，待专家复核']);
    rows.push(['生成时间', new Date().toLocaleString('zh-CN', { hour12: false }), '']);
    rows.push(['上传文件', D.files.map(function (f) { return f.name; }).join(' | '), '']);
    rows.push(['待定项', (global.INBOX_SEED || []).length + ' 条', '已处置 ' + Object.keys(st).length + ' 条']);
    rows.push(['']);
    rows.push([{ v: '色标说明', s: 9 }]);
    [['已验证', '值已在检测依据标准文件里核对通过', 3],
     ['冲突', '报告值与标准条款不一致，必须人工裁决', 4],
     ['未验证', '有来源但没回到标准文件核对（人工拆解稿的默认态）', 5],
     ['AI推断', '输入里没有，由 AI 推导', 6],
     ['无来源', '空，挂在收件箱里待问', 7]].forEach(function (x) {
      rows.push([{ v: x[0], s: x[2] }, { v: x[1], s: XLSX.styleFor(x[0], true) }]);
    });
    var sheets = [{ name: '00_包信息', rows: rows }];
    var ORDER = SHEET_ORDER.slice(1);
    Object.keys(seed).forEach(function (k) {
      if (k === 'tests' || k === 'conf' || !seed[k].cols) return;
      if (ORDER.indexOf(k) < 0 && k !== 'tests' && k !== 'conf') ORDER.push(k);
    });
    ORDER.forEach(function (name) {
      var blk = seed[name]; if (!blk || !blk.cols) return;
      var ed = (WB.edits ? WB.edits() : {}), out = [blk.cols.slice()];
      blk.rows.forEach(function (r, ri) {
        out.push(blk.cols.map(function (c) {
          var v = ed[name + '|' + ri + '|' + c];
          v = v !== undefined ? v : (r[c] == null ? '' : r[c]);
          var st = cellState(name, r, c);
          if (!st) return v;
          return { v: v, s: XLSX.styleFor(st, WIDE_RE.test(c)) };
        }));
      });
      sheets.push({ name: name, rows: out });
    });
    var inbox = global.INBOX_SEED || [];
    if (inbox.length && !sheets.some(function (s) { return s.name === 'C0_待定项'; })) {
      var cr = [['问题ID', '任务键', '问题层级', '目标sheet', '目标行键', '目标列', '置信度', '问题文本', '候选项', '人工回答', '处置状态']];
      inbox.forEach(function (q) {
        var a = st[q.id];
        cr.push([q.id, 'DLT 802.3-2023', q.lv, q.sheet, q.row, q.col, q.conf, q.q, q.cand,
          a ? (a.other || a.choice) : '', a ? (a.mode === 'skip' ? '已跳过' : a.mode === 'ai' ? 'AI自决落库' : '已答') : '待答']);
      });
      sheets.push({ name: 'C0_待定项', rows: cr });
    }
    return sheets;
  }

  var DEMO = {
    pick: function (fl) {
      var added = [];
      var demo = !global.WB || WB.demo();
      Array.prototype.forEach.call(fl, function (f) {
        var it = { name: f.name, size: f.size, slot: slotOf(f.name) };
        if (demo) D.files.push(it);
        added.push(it);
      });
      if (global.TS) TS.addFiles(added);
      if (!demo && added.length) WB.archNote(false);
      render();
    },
    pickImages: function (fl) {
      var added = [];
      Array.prototype.forEach.call(fl, function (f) {
        added.push({ name: f.name, size: f.size, slot: 'img' });
      });
      if (!added.length) return;
      if (global.TS) TS.addFiles(added);
      ATT.push.apply(ATT, added);
      renderChips();
      WB.say('ai', 'AI 助手', '已挂上 ' + added.length + ' 张图。说一句要我做什么都行，随消息一起发出。');
    },
    drop: function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var el = document.getElementById('fz'); if (el) el.classList.remove('over');
      DEMO.pick(ev.dataTransfer.files);
    },
    del: function (i) { D.files.splice(i, 1); if (global.TS) TS.delFile(i); render(); },
    unattach: function (i) { ATT.splice(i, 1); renderChips(); },
    resetState: function () { D.files = []; D.manuscript = null; D.ver = 'v1-draft'; ATT = []; renderChips(); render(); },
    attachments: function () { return ATT.slice(); },
    clearAttachments: function () { ATT = []; renderChips(); },
    /* F1：流式思考 → 产出真实 xlsx */
    f1: function () {
      if (global.WB && !WB.demo()) return WB.openArt('upload');
      if (!D.files.length) {
        WB.say('ai', 'AI 助手', '还没有料。先把<b>检测能力范围表</b>和<b>检测依据标准文件</b>放进来——可以拖进上面的区域，也可以点输入框左边的回形针。');
        WB.openArt('upload'); return;
      }
      var cap = D.files.filter(function (f) { return f.slot === 'cap'; })[0];
      var std = D.files.filter(function (f) { return f.slot === 'std'; })[0];
      var lines = [
        '读取 ' + D.files.length + ' 份文件：' + (cap ? cap.name : '—'),
        '正文识别标准号：' + (std ? std.name.replace(/\.[a-z]+$/i, '') : 'DL/T 802.3—2023') + ' → 规范化 DL/T 802.3-2023',
        '命中标准文件库：已有该标准，拆解成果 v3-final 可复用',
        '任务发现：802.1 是总标准只建分类节点，802.3 独立成 1 个任务',
        '系统对齐：公司基线 v3-final 取骨架 → 本客户环境逐实体比对 · 33 个实体',
        '按能力范围裁剪：' + counts(),
        '逐 sheet 生成 ' + sheetCount() + ' 张，不确定项转成 ' + (global.INBOX_SEED || []).length + ' 条待处置问题'
      ];
      think(lines, function () {
        var sheets = manuscript();
        D.manuscript = sheets;
        var bytes = XLSX.build(sheets), blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        D.url = URL.createObjectURL(blob); D.size = blob.size;
        WB.say('ai', 'AI 助手',
          '<div class="file" id="fileCard"><span class="ic"><i class="fa fa-file-excel-o"></i></span>' +
          '<span class="fn">DLT-802.3-2023_' + D.ver + '.xlsx</span>' +
          '<span class="fs">' + sheets.length + ' sheet · ' + kb(D.size) + '</span>' +
          '<a class="dl" download="DLT-802.3-2023_' + D.ver + '.xlsx" href="' + D.url + '"><i class="fa fa-download"></i> 下载</a>' +
          '<button class="pv" onclick="DEMO.preview()">看内容</button></div>' +
          '范围级 ' + (WB.scopeLeft ? WB.scopeLeft() : 0) + ' 条必答，答完才能定稿入库。');
        WB.openArt('inbox');
        if (global.TS) TS.addOutput({ ver: D.ver, state: '初稿', sheets: sheets.length, size: D.size,
          rows: counts(), at: new Date().toLocaleString('zh-CN', { hour12: false }).slice(0, 16),
          hits: ['命中库内成果 v3-final'] });
        render();
      });
    },
    preview: function () {
      if (!D.manuscript) return;
      var s = D.manuscript[1] || D.manuscript[0];
      var html = D.manuscript.map(function (x) {
        return '<div class="pv-s"><b>' + esc(x.name) + '</b><span>' + (x.rows.length - 1) + ' 行 × ' + (x.rows[0] || []).length + ' 列</span></div>';
      }).join('');
      WB.say('ai', 'AI 助手', '<div class="pv-box"><div class="pv-t">稿件内 sheet</div>' + html + '</div>');
    },
    /* F2：打开表格编辑，改完可下载新稿件 */
    f2: function () {
      if (global.WB && !WB.demo()) return WB.openArt('sheet');
      if (!D.manuscript) {
        WB.say('ai', 'AI 助手', '这个任务还没有稿件可校。先生成初版稿件，或者上传线下改完的稿件直接做三方对比。');
        WB.openArt('upload'); return;
      }
      WB.openArt('sheet');
      if (D.manuscript) DEMO.rebuild();            // 带上人工改动，下载拿到的才是最新的
      WB.say('ai', 'AI 助手', '表格已展开，点任意单元格直接改。改完再点 F2 重新出稿件，下载拿到的就是最新的那份。');
    },
    /* F3：预检 → 分块入库 */
    f3: function () {
      if (global.WB && !WB.demo()) return WB.openArt('f3');
      if (!D.manuscript) {
        WB.say('ai', 'AI 助手', '没有稿件可以入库。先生成初版稿件。');
        WB.openArt('upload'); return;
      }
      var left = WB.unanswered ? WB.unanswered() : 0, sl = WB.scopeLeft ? WB.scopeLeft() : 0;
      if (sl) { WB.openArt('inbox'); WB.say('ai', 'AI 助手', '范围级还有 <b>' + sl + '</b> 条必答，先答完才能入库。'); return; }
      think(['整包预检：38 条规则', '真缺陷 0 · 阻断 ' + (left ? left + ' 条待处置' : '0'),
        '按样品分块写入：S01 直管', 'S02 带承口', '回写标准文件库：拆解成果更新'], function () {
        WB.openArt('f3');
        if (WB.importRun) WB.importRun();
        render();
      });
    },
    ask: function (t) {
      if (!t) return;
      var low = String(t).toLowerCase();
      if (/上传|拆一下|生成|能力表|开始/.test(low) && !D.files.length) {
        WB.say('me', '你', esc(t));
        WB.say('ai', 'AI 助手', '先把文件放进来——拖到上面的区域，或者点下面的 F1 按钮旁边选择文件。');
        return 1;
      }
      if (/下载|导出|给我文件/.test(low)) {
        if (!D.manuscript) DEMO.f1(); else { WB.say('me', '你', esc(t)); WB.say('ai', 'AI 助手', '点这个就能拿：<a class="dl in" download="DLT-802.3-2023_' + D.ver + '.xlsx" href="' + D.url + '"><i class="fa fa-download"></i> DLT-802.3-2023_' + D.ver + '.xlsx</a>'); }
        return 1;
      }
      if (/入库|落到系统/.test(low)) { WB.say('me', '你', esc(t)); DEMO.f3(); return 1; }
      if (/校稿|改表格|看表格/.test(low)) { WB.say('me', '你', esc(t)); DEMO.f2(); return 1; }
      return 0;
    },
    forTask: function (t, o) {
      var sheets = manuscript();
      sheets[0].rows.push(['所属任务', t.code, '']);
      var bl = new Blob([XLSX.build(sheets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      return { url: URL.createObjectURL(bl), name: t.code.replace(/[—–\s]/g, '').replace(/[\/:]/g, '-') + '_' + o.ver + '.xlsx', size: bl.size };
    },
    state: function () { return { files: D.files, ver: D.ver, has: !!D.manuscript }; },
    load: function (st) {
      if (!st) return;
      D.files = st.files || []; D.ver = st.ver || 'v1-draft';
      if (st.has) DEMO.rebuild();
      render();
    },
    rebuild: function () {
      D.manuscript = manuscript();
      var bl = new Blob([XLSX.build(D.manuscript)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      D.url = URL.createObjectURL(bl); D.size = bl.size;
      return { url: D.url, name: 'DLT-802.3-2023_' + D.ver + '.xlsx', size: D.size, sheets: D.manuscript.length };
    },
    emit: function (ver) {
      D.ver = ver; DEMO.rebuild();
      return { url: D.url, name: 'DLT-802.3-2023_' + ver + '.xlsx', size: D.size, sheets: D.manuscript.length };
    },
    download: function () { return D.manuscript ? { url: D.url, name: 'DLT-802.3-2023_' + D.ver + '.xlsx', size: D.size, sheets: D.manuscript.length } : DEMO.rebuild(); }
  };
  global.DEMO = DEMO;
  global.DEMO.mountQuick = function () {
    var q = document.getElementById('quickBar'); if (q) q.innerHTML = quick();
  };
})(window);
