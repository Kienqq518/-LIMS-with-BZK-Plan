/* 列表页「列配置」：操作列表头的 ☰ 入口 → 拖拽排序 + 开关是否展示
 * - 关闭的列不渲染在主查询列表上（表头与单元格一起隐藏）
 * - 拖拽可调整列顺序
 * - 按页面分别持久化到 localStorage，刷新不还原
 * 说明：模块自动识别页面主列表表格，页面只需引入本脚本，无需改表格结构。
 */
(function (global) {
  var doc = global.document;
  var NS = 'lims.columnConfig.';
  var STYLE_ID = 'lims-column-config-styles';
  var css = [
    '.cc-trigger { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; padding: 1px 5px; border: 1px solid #cbd5e1; border-radius: 4px; background: #fff; color: #64748b; font-size: 12px; font-weight: 400; cursor: pointer; vertical-align: middle; }',
    '.cc-trigger:hover { border-color: #2563eb; color: #2563eb; }',
    '#cc-panel { position: fixed; z-index: 10005; width: 380px; max-width: calc(100vw - 24px); max-height: 78vh; display: none; flex-direction: column; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 12px 32px rgba(15,23,42,.18); font-size: 13px; color: #334155; }',
    '#cc-panel.open { display: flex; }',
    '.cc-head { display: flex; align-items: center; padding: 10px 14px; border-bottom: 1px solid #eef2f7; font-size: 14px; font-weight: 600; color: #1e293b; }',
    '.cc-close { margin-left: auto; border: none; background: none; color: #94a3b8; cursor: pointer; font-size: 14px; }',
    '.cc-close:hover { color: #475569; }',
    '.cc-search { padding: 8px 12px; border-bottom: 1px solid #eef2f7; }',
    '.cc-search input { width: 100%; border: 1px solid #e2e8f0; border-radius: 5px; background: #f8fafc; padding: 5px 9px; font-size: 12px; outline: none; }',
    '.cc-search input:focus { border-color: #60a5fa; background: #fff; }',
    '.cc-list { flex: 1; overflow-y: auto; padding: 4px 0; }',
    '.cc-row { display: flex; align-items: center; gap: 8px; padding: 7px 14px; cursor: default; }',
    '.cc-row:hover { background: #f8fafc; }',
    '.cc-row.dragging { opacity: .45; background: #eff6ff; }',
    '.cc-row.over { box-shadow: inset 0 2px 0 #2563eb; }',
    '.cc-row.is-hidden { display: none; }',
    '.cc-grip { color: #cbd5e1; cursor: grab; font-size: 13px; width: 12px; flex-shrink: 0; }',
    '.cc-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.cc-sw { position: relative; width: 34px; height: 18px; flex-shrink: 0; }',
    '.cc-sw input { opacity: 0; width: 0; height: 0; }',
    '.cc-sw span { position: absolute; inset: 0; background: #cbd5e1; border-radius: 9px; transition: .15s; cursor: pointer; }',
    '.cc-sw span::before { content: \'\'; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; background: #fff; border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,.2); transition: .15s; }',
    '.cc-sw input:checked + span { background: #2563eb; }',
    '.cc-sw input:checked + span::before { transform: translateX(16px); }',
    '.cc-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; border-top: 1px solid #eef2f7; }',
    '.cc-btn { border: 1px solid #cbd5e1; background: #fff; color: #475569; border-radius: 4px; padding: 4px 14px; font-size: 13px; cursor: pointer; }',
    '.cc-btn.primary { border-color: #2563eb; background: #2563eb; color: #fff; }',
    '.cc-empty { padding: 18px; text-align: center; color: #94a3b8; font-size: 12px; }',
    '.cc-mv { display: flex; gap: 2px; flex-shrink: 0; }',
    '.cc-mv button { border: 1px solid #e2e8f0; background: #fff; color: #94a3b8; border-radius: 3px; width: 20px; height: 20px; line-height: 1; font-size: 11px; cursor: pointer; padding: 0; }',
    '.cc-mv button:hover:not([disabled]) { border-color: #2563eb; color: #2563eb; }',
    '.cc-mv button[disabled] { opacity: .35; cursor: not-allowed; }',
    /* ===== 冻结列：前两列（序号、委托编号）与最后一列（操作）左右固定，中间列横向滚动 ===== */
    '.cc-fz { position: sticky; z-index: 2; background-clip: padding-box; }',
    'thead .cc-fz { z-index: 3; }',
    '.cc-fz-edge { box-shadow: inset -1px 0 0 #e5e7eb; }',
    '[data-cc-scroll="1"] .cc-fz-edge { box-shadow: inset -1px 0 0 #e5e7eb, 10px 0 10px -10px rgba(15,23,42,.28); }',
    '.cc-fz-r { box-shadow: inset 1px 0 0 #e5e7eb; }',
    '[data-cc-scroll="1"] .cc-fz-r { box-shadow: inset 1px 0 0 #e5e7eb, -10px 0 10px -10px rgba(15,23,42,.28); }',
    'tr:hover > .cc-fz { background-color: #f8fafc; }'
  ].join('\n');

  var table = null, cols = [], order = [], hidden = {}, panel = null, applying = false;
  var sourceOrder = null;   // 源码里的列顺序（首次收集时记录），供表体重绘后按位打标

  function pageKey() {
    return (global.location.pathname.split('/').pop() || 'index').replace(/\.html?$/i, '');
  }
  function storeKey() { return NS + pageKey(); }
  function loadCfg() {
    try { return JSON.parse(global.localStorage.getItem(storeKey()) || 'null'); } catch (e) { return null; }
  }
  function saveCfg(o) {
    try { global.localStorage.setItem(storeKey(), JSON.stringify(o)); } catch (e) {}
  }
  // 合并「已保存的列顺序」与「页面当前列」：新出现的列插回它在页面里的原始位置，
  // 而不是追加到末尾（否则后来新增的列会跑到「操作」列右边，看起来位置错了）
  function mergeOrder(savedOrder, all) {
    var known = (savedOrder || []).filter(function (k) { return all.indexOf(k) >= 0; });
    var idxOf = {};
    all.forEach(function (k, i) { idxOf[k] = i; });
    var result = known.slice();
    all.forEach(function (k) {
      if (known.indexOf(k) >= 0) return;
      var pos = result.length;
      for (var i = 0; i < result.length; i++) { if (idxOf[result[i]] > idxOf[k]) { pos = i; break; } }
      result.splice(pos, 0, k);
    });
    return result;
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // 主列表表格：不在弹窗/文档面板里，表头列数 >=4，且行数最多
  function findTable() {
    // 打印预览这类「列就是打印字段」的页面用 <body data-col-config="off"> 关掉列配置入口，
    // 单表 data-no-col-config 也支持（同一页里只想关某一张表时用它）
    if (doc.body && doc.body.getAttribute('data-col-config') === 'off') return null;
    var best = null, bestScore = -1;
    [].slice.call(doc.querySelectorAll('table')).forEach(function (t) {
      if (t.hasAttribute('data-no-col-config')) return;
      // closest() 会命中元素自身，嵌套判断要看父级
      if (t.closest('.fixed') || t.closest('#pa-doc')) return;
      if (t.parentElement && t.parentElement.closest('table')) return;
      var ths = t.querySelectorAll('thead th');
      if (ths.length < 4) return;
      var rows = t.querySelectorAll('tbody tr').length;
      var score = rows * 2 + ths.length;
      if (score > bestScore) { bestScore = score; best = t; }
    });
    return best;
  }

  function headRow() { return table.querySelector('thead tr') || table.querySelector('tr'); }

  function sameKeySet(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) { if (a.indexOf(b[i]) < 0) return false; }
    return true;
  }

  function collectCols() {
    var seen = {};
    var list = [].slice.call(headRow().children).map(function (th, i) {
      var label = (th.textContent || '').replace(/\s+/g, ' ').trim();
      var base = label || (th.querySelector('input[type=checkbox]') ? '勾选' : '列' + (i + 1));
      // 列身份优先取表头显式声明的 data-col-key：这样只改列名时，用户此前保存的
      // 列顺序与显隐（按 key 存）不会因改名而失效；面板里仍显示新的列名。
      var key = (th.getAttribute('data-col-key') || '').trim() || base;
      // 同名列加序号后缀，保证 key 唯一
      for (var n = 2; seen[key]; n++) key = base + '#' + n;
      seen[key] = 1;
      th.setAttribute('data-col-key', key);
      return { key: key, label: base, index: i };
    });
    var keys = list.map(function (c) { return c.key; });
    // 列集合没变时，cols 始终按源码顺序排：表体每次重绘出来的单元格都是源码顺序，
    // tagBodyCells 靠位置打标，若跟着已被重排的表头顺序打标会串列。
    if (sourceOrder && sameKeySet(sourceOrder, keys)) {
      var byKey = {};
      list.forEach(function (c) { byKey[c.key] = c; });
      cols = sourceOrder.map(function (k) { return byKey[k]; });
    } else {
      cols = list;
      sourceOrder = keys;
    }
  }

  function tagBodyCells() {
    [].slice.call(table.tBodies).forEach(function (tb) {
      [].slice.call(tb.rows).forEach(function (tr) {
        if (tr.cells.length === 1 && tr.cells[0].colSpan > 1) return;   // 空态行
        [].slice.call(tr.cells).forEach(function (td, i) {
          if (cols[i]) td.setAttribute('data-col-key', cols[i].key);
        });
      });
    });
  }

  function visibleKeys() {
    return order.filter(function (k) { return !hidden[k]; });
  }

  function apply() {
    if (!table || applying) return;
    applying = true;
    // 表头
    var hr = headRow();
    [].slice.call(hr.children).forEach(function (th) {
      var k = th.getAttribute('data-col-key');
      th.style.display = hidden[k] ? 'none' : '';
    });
    order.forEach(function (k) {
      var th = hr.querySelector('[data-col-key="' + cssEsc(k) + '"]');
      if (th) hr.appendChild(th);
    });
    // 表体
    var vis = visibleKeys().length;
    [].slice.call(table.tBodies).forEach(function (tb) {
      [].slice.call(tb.rows).forEach(function (tr) {
        var single = tr.cells.length === 1 && tr.cells[0].colSpan > 1;
        if (single) { tr.cells[0].colSpan = Math.max(1, vis); return; }
        [].slice.call(tr.cells).forEach(function (td) {
          td.style.display = hidden[td.getAttribute('data-col-key')] ? 'none' : '';
        });
        order.forEach(function (k) {
          var td = tr.querySelector('[data-col-key="' + cssEsc(k) + '"]');
          if (td) tr.appendChild(td);
        });
      });
    });
    moveTriggerIfHidden();
    applyStickyColumns();
    applying = false;
  }
  function cssEsc(v) { return String(v).replace(/"/g, '\\"'); }

  /* ===== 冻结列 ===== */
  function opaqueBg(el) {
    var node = el;
    while (node && node.nodeType === 1) {
      var bg = global.getComputedStyle(node).backgroundColor;
      if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;
      node = node.parentElement;
    }
    return '';
  }
  function stickySets() {
    var vis = order.filter(function (k) { return !hidden[k]; });
    return { leftKeys: vis.slice(0, 2), rightKey: vis.length > 2 ? vis[vis.length - 1] : null };
  }
  function applyStickyColumns() {
    if (!table) return;
    var hr = headRow();
    var sets = stickySets();
    // 表格列数太少就不冻结，避免左右两块叠在一起
    var enough = order.filter(function (k) { return !hidden[k]; }).length > 4;
    // 先算左侧偏移（按当前实际渲染宽度累加）
    var lefts = {}, acc = 0;
    sets.leftKeys.forEach(function (k) {
      var th = hr.querySelector('[data-col-key="' + cssEsc(k) + '"]');
      if (!th) return;
      lefts[k] = acc;
      acc += th.getBoundingClientRect().width;
    });
    var rows = [].slice.call(hr.parentNode.querySelectorAll('tr'));
    rows = rows.concat([].slice.call(table.tBodies).reduce(function (a, tb) { return a.concat([].slice.call(tb.rows)); }, []));
    rows.forEach(function (tr) {
      [].slice.call(tr.cells).forEach(function (cell) {
        var k = cell.getAttribute('data-col-key');
        cell.classList.remove('cc-fz', 'cc-fz-edge', 'cc-fz-r');
        cell.style.left = '';
        cell.style.right = '';
        cell.style.zIndex = '';
        if (!enough || !k) return;
        var bg = opaqueBg(cell) || (cell.tagName === 'TH' ? '#f8fafc' : '#fff');
        if (sets.leftKeys.indexOf(k) >= 0) {
          cell.classList.add('cc-fz');
          cell.style.left = lefts[k] + 'px';
          cell.style.backgroundColor = bg;
          if (k === sets.leftKeys[sets.leftKeys.length - 1]) cell.classList.add('cc-fz-edge');
        } else if (sets.rightKey && k === sets.rightKey) {
          cell.classList.add('cc-fz', 'cc-fz-r');
          cell.style.right = '0px';
          cell.style.backgroundColor = bg;
        }
      });
    });
    bindScrollMark();
  }
  function scrollHost() {
    var node = table && table.parentElement;
    while (node && node !== doc.body) {
      var ox = global.getComputedStyle(node).overflowX;
      if (ox === 'auto' || ox === 'scroll') return node;
      node = node.parentElement;
    }
    return global;
  }
  function bindScrollMark() {
    if (!table) return;
    var host = scrollHost();
    if (host === global) return;
    if (host._ccScrollBound) return;
    host._ccScrollBound = true;
    var onScroll = function () {
      host.setAttribute('data-cc-scroll', host.scrollLeft > 2 ? '1' : '0');
    };
    host.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function moveTriggerIfHidden() {
    var t = doc.getElementById('cc-trigger');
    if (!t) return;
    var host = t.parentElement;
    var hk = host && host.getAttribute('data-col-key');
    if (hk && hidden[hk]) {
      var last = visibleKeys().slice(-1)[0];
      var th = last && headRow().querySelector('[data-col-key="' + cssEsc(last) + '"]');
      if (th) th.appendChild(t);
    }
  }

  function injectTrigger() {
    if (doc.getElementById('cc-trigger')) return;
    var btn = doc.createElement('button');
    btn.type = 'button';
    btn.id = 'cc-trigger';
    btn.className = 'cc-trigger';
    btn.title = '列配置（排序 / 是否展示）';
    btn.innerHTML = '<i class="fa fa-bars"></i>';
    btn.onclick = function (e) { e.stopPropagation(); openPanel(btn); };
    var lastTh = headRow().children[headRow().children.length - 1];
    lastTh.appendChild(btn);
  }

  function draftFromCurrent() { return { order: order.slice(), hidden: JSON.parse(JSON.stringify(hidden)) }; }

  function renderList(kw) {
    var host = panel.querySelector('#cc-list');
    var q = (kw || '').trim().toLowerCase();
    var html = order.filter(function (k) {
      var c = colOf(k);
      return !q || (c && c.label.toLowerCase().indexOf(q) >= 0);
    }).map(function (k) {
      var c = colOf(k);
      var pos = order.indexOf(k);
      return '<div class="cc-row" draggable="true" data-key="' + esc(k) + '">' +
        '<i class="fa fa-ellipsis-h cc-grip" title="拖拽排序"></i>' +
        '<span class="cc-name">' + esc(c ? c.label : k) + '</span>' +
        '<span class="cc-mv">' +
          '<button type="button" title="上移" onclick="ColumnConfig._move(\'' + esc(k) + '\',-1)"' + (pos === 0 ? ' disabled' : '') + '><i class="fa fa-angle-up"></i></button>' +
          '<button type="button" title="下移" onclick="ColumnConfig._move(\'' + esc(k) + '\',1)"' + (pos === order.length - 1 ? ' disabled' : '') + '><i class="fa fa-angle-down"></i></button>' +
        '</span>' +
        '<label class="cc-sw"><input type="checkbox" data-toggle="' + esc(k) + '"' + (hidden[k] ? '' : ' checked') + ' onchange="ColumnConfig._toggle(this.getAttribute(\'data-toggle\'), this.checked)" /><span></span></label>' +
      '</div>';
    }).join('');
    host.innerHTML = html || '<div class="cc-empty">无匹配字段</div>';
    bindDrag(host);
  }
  function colOf(k) { for (var i = 0; i < cols.length; i++) { if (cols[i].key === k) return cols[i]; } return null; }

  function bindDrag(host) {
    var dragEl = null;
    [].slice.call(host.querySelectorAll('.cc-row')).forEach(function (row) {
      row.addEventListener('dragstart', function () { dragEl = row; row.classList.add('dragging'); });
      row.addEventListener('dragend', function () {
        row.classList.remove('dragging');
        [].slice.call(host.querySelectorAll('.cc-row.over')).forEach(function (r) { r.classList.remove('over'); });
        var next = [].slice.call(host.querySelectorAll('.cc-row')).map(function (r) { return r.getAttribute('data-key'); });
        // 只重排当前可见（未被搜索过滤掉）的部分，其余保持原序
        order = next.concat(order.filter(function (k) { return next.indexOf(k) < 0; }));
        apply();
      });
      row.addEventListener('dragover', function (e) { e.preventDefault(); if (row !== dragEl) row.classList.add('over'); });
      row.addEventListener('dragleave', function () { row.classList.remove('over'); });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        if (!dragEl || dragEl === row) return;
        var rows = [].slice.call(host.querySelectorAll('.cc-row'));
        if (rows.indexOf(dragEl) < rows.indexOf(row)) row.parentNode.insertBefore(dragEl, row.nextSibling);
        else row.parentNode.insertBefore(dragEl, row);
        row.classList.remove('over');
      });
    });
  }

  function openPanel(anchor) {
    if (!panel) return;
    var d = draftFromCurrent();
    order = d.order; hidden = d.hidden;
    var r = anchor.getBoundingClientRect();
    var inp = panel.querySelector('#cc-kw');
    inp.value = '';
    // 先渲染列表再定位：面板高度要等条目填充后才准，否则底部「保存」会被顶出视口
    panel.style.maxHeight = Math.max(280, global.innerHeight - 24) + 'px';
    panel.classList.add('open');
    renderList('');
    var w = panel.offsetWidth || 380;
    var h = panel.offsetHeight || 420;
    panel.style.top = Math.max(12, Math.min(r.bottom + 6, global.innerHeight - h - 12)) + 'px';
    panel.style.left = Math.max(12, Math.min(r.left - w + 20, global.innerWidth - w - 12)) + 'px';
    inp.focus();
  }
  function closePanel(revert) {
    if (!panel) return;
    panel.classList.remove('open');
    if (revert) {
      var saved = loadCfg();
      order = mergeOrder(saved && saved.order, cols.map(function (c) { return c.key; }));
      hidden = {};
      ((saved && saved.hidden) || []).forEach(function (k) { hidden[k] = 1; });
      apply();
    }
  }

  function buildPanel() {
    panel = doc.createElement('div');
    panel.id = 'cc-panel';
    panel.innerHTML =
      '<div class="cc-head"><i class="fa fa-cogs" style="color:#2563eb"></i><span style="margin-left:6px">列配置</span>' +
        '<button type="button" class="cc-close" onclick="ColumnConfig._close(true)"><i class="fa fa-times"></i></button></div>' +
      '<div class="cc-search"><input id="cc-kw" type="text" placeholder="搜索字段（拖拽字段进行排序）" oninput="ColumnConfig._search(this.value)" /></div>' +
      '<div class="cc-list" id="cc-list"></div>' +
      '<div class="cc-foot">' +
        '<button type="button" class="cc-btn" onclick="ColumnConfig._reset()">重 置</button>' +
        '<button type="button" class="cc-btn primary" onclick="ColumnConfig._save()">保 存</button>' +
      '</div>';
    doc.body.appendChild(panel);
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  function boot() {
    if (!doc.getElementById(STYLE_ID)) {
      var st = doc.createElement('style');
      st.id = STYLE_ID; st.textContent = css; doc.head.appendChild(st);
    }
    table = findTable();
    if (!table) return;
    collectCols();
    tagBodyCells();
    var all = cols.map(function (c) { return c.key; });
    var cfg = loadCfg();
    order = mergeOrder(cfg && cfg.order, all);
    hidden = {};
    (cfg && cfg.hidden ? cfg.hidden : []).forEach(function (k) { hidden[k] = 1; });
    buildPanel();
    injectTrigger();
    apply();
    // 入口注入后再刷一次批注，保证「列配置」这条内置批注能定位到 ☰ 入口
    if (global.PrototypeAnnotation && global.PrototypeAnnotation.refresh) global.PrototypeAnnotation.refresh();
    // 表格由页面脚本重绘时，重新打标并套用列配置
    if (global.MutationObserver && table.tBodies[0]) {
      new MutationObserver(function () {
        if (applying) return;
        collectCols(); tagBodyCells(); apply();
      }).observe(table.tBodies[0], { childList: true });
    }
    doc.addEventListener('click', function () { if (panel && panel.classList.contains('open')) closePanel(true); });
    global.addEventListener('resize', function () { applyStickyColumns(); });
  }

  global.ColumnConfig = {
    _mergeOrder: mergeOrder,
    init: boot,
    _toggle: function (k, on) { if (on) delete hidden[k]; else hidden[k] = 1; apply(); },
    _search: function (v) { renderList(v); },
    _reset: function () { order = cols.map(function (c) { return c.key; }); hidden = {}; apply(); renderList(panel.querySelector('#cc-kw').value); },
    _save: function () { saveCfg({ order: order, hidden: Object.keys(hidden) }); panel.classList.remove('open'); apply(); },
    _move: function (k, dir) {
      var i = order.indexOf(k), j = i + dir;
      if (i < 0 || j < 0 || j >= order.length) return;
      order.splice(j, 0, order.splice(i, 1)[0]);
      apply();
      renderList(panel.querySelector('#cc-kw').value);
    },
    _close: function () { closePanel(true); },
    refresh: function () { if (table) { collectCols(); tagBodyCells(); apply(); } },
    refreshSticky: function () { applyStickyColumns(); }
  };

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
