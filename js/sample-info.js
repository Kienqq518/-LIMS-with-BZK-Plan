/* 样品信息单元格：产品标记 / 型号分类 / 规格
 * 取值优先级：该委托的收样记录（lims.receiveRecords）→ 样品数据主数据按名称匹配，
 * 与「样品收样」弹窗、委托详情收样信息同一口径：没有值统一显示「/」；
 * 产品标记按样品数据的规则实时拼装，整表没有一样品开启产品标记开关时该列整列隐藏。
 * 依赖：js/sample-data-store.js、js/sample-spec-ui.js、js/receive-store.js（缺失时自动降级）
 */
(function (global) {
  var NONE = '/';

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 行标签里的样品名：去掉「(2)」「--(1)个」这类数量后缀 */
  function baseName(label) {
    // 兼容三种写法：绝缘毯(2)、绝缘操作杆--(1)个、安全帽（3）顶
    return String(label || '')
      .replace(/\s*[-－]{0,2}\s*[（(]\s*\d+\s*[）)]\s*[^（()）]*$/g, '')
      .trim();
  }

  function leafByName(name) {
    var st = global.SampleDataStore;
    if (!st || !st.TREES) return '';
    var hit = '';
    Object.keys(st.TREES).forEach(function (cat) {
      (function walk(nodes) {
        (nodes || []).forEach(function (n) {
          if (!hit && n.leaf && n.label === name) hit = n.id;
          walk(n.children);
        });
      })(st.getTree(cat));
    });
    return hit;
  }

  function lineOf(code, name) {
    var RS = global.ReceiveStore;
    if (!RS || !code) return null;
    var got = RS.receivedMap(code);
    var hit = got[code + '|' + name];
    return hit ? hit.line : null;
  }

  /** 返回一行的样品信息：{ name, qty, unit, markEnabled, mark, model, spec } */
  function row(code, label) {
    var name = baseName(label);
    var line = lineOf(code, name);
    var st = global.SampleDataStore;
    var leafId = (line && line.leafId) || leafByName(name);
    var modelCode = line ? (line.modelCode || '') : '';
    var specValues = line ? (line.specValues || []) : [];
    var sample = leafId && st ? st.getSample(leafId) : null;
    var markEnabled = !!(st && st.isMarkEnabled && st.isMarkEnabled(leafId));
    var mark = '';
    if (markEnabled) {
      mark = st.markOf(leafId, modelCode, specValues) || (line && line.mark) || '';
      if (!mark && !modelCode && st.modelsOf(sample).length) mark = '选择型号后生成';
    }
    var model = NONE;
    if (modelCode && st && st.modelOf) {
      var m = st.modelOf(sample, modelCode);
      model = m ? esc((m.code || '') + (m.name ? '-' + m.name : '')) : esc(modelCode);
    }
    var spec = '';
    if (global.SampleSpecUI && sample) spec = SampleSpecUI.summary(sample, modelCode, specValues);
    if (!spec && line && line.spec) spec = line.spec;
    return {
      name: name,
      qty: line ? line.qty : '',
      unit: line ? line.unit : '',
      markEnabled: markEnabled,
      mark: mark || NONE,
      model: model,
      spec: spec || NONE
    };
  }

  /* 三个 <td>：markCol 为 false 时产品标记列保留但由表格上的 hide-mark-col 统一隐藏 */
  function cells(r) {
    return '<td class="col-mark">' + esc(r.mark) + '</td>' +
      '<td>' + r.model + '</td>' +
      '<td>' + esc(r.spec) + '</td>';
  }

  function anyMarkOn(rows) {
    return rows.some(function (r) { return r.markEnabled; });
  }

  global.SampleInfo = { row: row, cells: cells, baseName: baseName, anyMarkOn: anyMarkOn, NONE: NONE };
})(window);
