/* 样品大类 · 列表页统一增强
 * 给主查询页面一次性补上两件事（避免逐页手改表格导致不一致）：
 *   1) 查询条件区：在「样品名称」条件后插入「样品大类」下拉（选项来自样品大类清单）
 *   2) 主列表表格：在「样品名称」列后插入「样品大类」列，并按样品名推导大类
 * 点「查询」按大类过滤行（并同步重排序号、更新「共 N 条」），点「重置」清空条件。
 * 表格若由页面脚本重新渲染，MutationObserver 会自动为新行补上大类单元格。
 */
(function (global) {
  var doc = global.document;
  var state = { table: null, tbody: null, nameIdx: -1, rows: [], filling: false };

  function catList() {
    var st = global.SampleDataStore;
    if (st && st.CAT_LABELS) return Object.keys(st.CAT_LABELS).map(function (k) { return st.CAT_LABELS[k]; });
    return ['电力物资类', '安全工器具类', '环境检测', '工程检测'];
  }
  function catOfText(text) {
    var st = global.SampleDataStore;
    if (!st) return '';
    return st.catLabelOfNames(text) || '';
  }
  // 弹窗/抽屉里的表格不算主列表
  function inOverlay(el) {
    return !!(el.closest && (el.closest('.fixed') || el.closest('[id$="Modal"]') || el.closest('[class*="modal"]')));
  }
  function findNameHeader() {
    var ths = [].slice.call(doc.querySelectorAll('th'));
    for (var i = 0; i < ths.length; i++) {
      if (ths[i].textContent.trim() === '样品名称' && !inOverlay(ths[i])) return ths[i];
    }
    return null;
  }

  function fillRow(tr) {
    if (!state.table || !tr || !tr.cells) return;
    var cells = tr.cells;
    if (state.nameIdx < 0 || cells.length === 0) return;
    if (cells.length === 1 && cells[0].colSpan > 1) return;          // 空态行
    if (cells.length < state.nameIdx + 1) return;                     // 结构不同的嵌套行
    var nameCell = cells[state.nameIdx];
    var next = nameCell.nextElementSibling;
    if (next && next.hasAttribute('data-cat-col')) return;             // 已注入
    var td = doc.createElement('td');
    td.setAttribute('data-cat-col', '');
    td.className = nameCell.className;
    var cat = catOfText(nameCell.textContent);
    td.textContent = cat || '—';
    if (cat) td.setAttribute('data-cat', cat);
    tr.insertBefore(td, nameCell.nextSibling);
  }

  // 页面已有「样品大类」列/筛选时不重复注入（如委托登记页本就带该列）
  function hasOverlayText(tag, text) {
    return [].slice.call(doc.querySelectorAll(tag)).some(function (el) {
      return el.textContent.trim() === text && !inOverlay(el);
    });
  }

  function addColumn() {
    if (hasOverlayText('th', '样品大类')) return 'exists';
    var th = findNameHeader();
    if (!th) return false;
    var headRow = th.parentNode;
    state.nameIdx = [].slice.call(headRow.children).indexOf(th);
    state.table = th.closest('table');
    var newTh = th.cloneNode(true);
    newTh.textContent = '样品大类';
    newTh.setAttribute('data-cat-col', '');
    headRow.insertBefore(newTh, th.nextSibling);
    state.tbody = state.table.tBodies[0];
    if (!state.tbody) return true;
    state.rows = [].slice.call(state.tbody.rows);
    state.rows.forEach(fillRow);
    var obs = new MutationObserver(function () {
      if (state.filling) return;
      state.filling = true;
      state.rows = [].slice.call(state.tbody.rows);
      state.rows.forEach(fillRow);
      applyFilter();
      state.filling = false;
    });
    obs.observe(state.tbody, { childList: true });
    return true;
  }

  function addFilter() {
    if (hasOverlayText('label', '样品大类')) return 'exists';
    var labels = [].slice.call(doc.querySelectorAll('label')).filter(function (l) {
      return l.textContent.trim() === '样品名称' && !inOverlay(l);
    });
    var item = null;
    labels.forEach(function (l) {
      if (item) return;
      var box = l.closest('div');
      if (!box) return;
      // 只克隆「一个 label + 一个控件」的独立条件项；若 label 直接挂在整片筛选栅格下，
      // 克隆会复制整个筛选区，这种情况改为跳过（列仍会注入）
      var controls = box.querySelectorAll('input, select, textarea');
      if (controls.length === 1 && box.contains(l)) item = box;
    });
    if (!item) return false;
    var clone = item.cloneNode(true);
    var lab = clone.querySelector('label');
    if (lab) lab.textContent = '样品大类';
    var ctl = clone.querySelector('input, select, textarea');
    if (ctl) {
      var sel = doc.createElement('select');
      sel.id = 'qSampleCat';
      sel.className = ctl.className;
      sel.innerHTML = '<option value="">请选择样品大类</option>' + catList().map(function (c) {
        return '<option value="' + c + '">' + c + '</option>';
      }).join('');
      ctl.parentNode.replaceChild(sel, ctl);
    }
    item.parentNode.insertBefore(clone, item.nextSibling);
    return true;
  }

  function applyFilter() {
    if (!state.rows || !state.rows.length) return;
    var sel = doc.getElementById('qSampleCat');
    var want = sel ? sel.value : '';
    var visible = 0;
    state.rows.forEach(function (tr) {
      if (!tr.cells || !tr.cells.length) return;
      var cell = tr.querySelector('td[data-cat-col]');
      var cat = cell ? cell.textContent.trim() : '';
      var ok = !want || cat === want;
      tr.style.display = ok ? '' : 'none';
      if (ok) {
        visible++;
        var first = tr.cells[0];
        if (first && /^\d+$/.test(first.textContent.trim())) first.textContent = String(visible);
      }
    });
    var counters = [].slice.call(doc.querySelectorAll('#receiveTotalCount, #reportTotalCount, #totalText, [id*="TotalCount"]'));
    counters.forEach(function (el) {
      var m = el.textContent.match(/^共\s*\d+\s*条$/);
      if (m) el.textContent = '共 ' + visible + ' 条';
    });
  }

  function wireButtons() {
    var btns = [].slice.call(doc.querySelectorAll('button')).filter(function (b) { return !inOverlay(b); });
    var q = btns.filter(function (b) { return /查询/.test(b.textContent); })[0];
    var r = btns.filter(function (b) { return /重置/.test(b.textContent); })[0];
    if (q) q.addEventListener('click', function () { setTimeout(applyFilter, 0); });
    if (r) r.addEventListener('click', function () {
      var sel = doc.getElementById('qSampleCat');
      if (sel) sel.value = '';
      setTimeout(applyFilter, 0);
    });
    var sel = doc.getElementById('qSampleCat');
    if (sel) sel.addEventListener('change', applyFilter);
  }

  function init() {
    var hasCol = addColumn();
    var hasFilter = addFilter();
    if (hasCol || hasFilter) wireButtons();
    return { column: hasCol, filter: hasFilter };
  }

  global.SampleCatFilter = { init: init, apply: applyFilter };
  doc.addEventListener('DOMContentLoaded', init);
})(window);
