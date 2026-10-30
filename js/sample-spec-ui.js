/* 规格参数编辑器（样品收样 / 委托确认 共用）
 * 规格参数在委托登记时可能没填，允许在「样品收样」和「委托确认」阶段补填；
 * 委托确认时必须填写完整（由调用方用 missing() 做拦截）。
 */
(function (global) {
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  // 规格定义：优先用 {name, unit, options}，兼容样品数据里的「规格参数1:导体标称截面积S (mm²)」写法
  function parseTitle(title) {
    var t = String(title || '').replace(/^规格参数\d+:/, '');
    var m = t.match(/^(.*?)\s*[\(（]([^\)）]+)[\)）]\s*$/);
    var name = (m ? m[1] : t).replace(/[A-Za-z]\s*$/, '').trim();
    return { name: name, unit: m ? m[2] : '' };
  }
  function specsOf(sample, modelCode) {
    var st = global.SampleDataStore; if (!st || !sample) return [];
    var model = modelCode ? st.modelOf(sample, modelCode) : null;
    var raw = (model && model.specs) || [];
    return raw.map(function (sp) {
      var parsed = sp.name ? { name: sp.name, unit: sp.unit || '' } : parseTitle(sp.title);
      return { name: parsed.name, unit: parsed.unit, options: sp.options || [] };
    });
  }
  function label(sp) { return sp.name + (sp.unit ? '（' + sp.unit + '）' : ''); }

  // 行内控件：有候选值用下拉，无候选值用文本输入
  function renderCells(sample, modelCode, values, idPrefix, editable) {
    var list = specsOf(sample, modelCode);
    if (!list.length) return '<span class="spec-none">无规格参数</span>';
    return list.map(function (sp, i) {
      var val = (values && values[i]) || (sp.options.length === 1 ? sp.options[0] : '');
      var id = idPrefix + '_' + i;
      var ctrl;
      if (!editable) {
        ctrl = '<span class="spec-readonly">' + esc(val || '—') + '</span>';
      } else if (sp.options.length) {
        ctrl = '<select id="' + id + '" class="spec-input">' +
          '<option value="">' + (val ? '' : '请选择') + '</option>' +
          sp.options.map(function (o) {
            return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') + '</select>';
      } else {
        ctrl = '<input id="' + id + '" class="spec-input" type="text" value="' + esc(val) + '" placeholder="请输入" />';
      }
      return '<div class="spec-line"><span class="spec-name">' + esc(label(sp)) + '</span>' + ctrl + '</div>';
    }).join('');
  }
  function readValues(sample, modelCode, idPrefix) {
    return specsOf(sample, modelCode).map(function (_, i) {
      var el = document.getElementById(idPrefix + '_' + i);
      return el ? el.value.trim() : '';
    });
  }
  // 返回未填写的规格名（委托确认阶段用于强校验）
  function missing(sample, modelCode, values) {
    return specsOf(sample, modelCode).map(function (sp, i) {
      return (!values || !values[i]) ? label(sp) : null;
    }).filter(Boolean);
  }
  function summary(sample, modelCode, values) {
    return specsOf(sample, modelCode).map(function (sp, i) {
      var v = (values && values[i]) || '';
      return v ? label(sp) + ' ' + v : '';
    }).filter(Boolean).join('；');
  }

  global.SampleSpecUI = {
    esc: esc, specsOf: specsOf, label: label, renderCells: renderCells,
    readValues: readValues, missing: missing, summary: summary
  };
})(window);
