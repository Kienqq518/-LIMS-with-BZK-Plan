/* 详情页数据行状态标签，以及委托编号行的样品信息。 */
(function (global) {
  var PROFILES = {
    '绝缘操作杆': {
      alias: '10kV操作杆',
      mark: '绝缘操作杆 DLT 976-2017',
      model: '10kV',
      spec: '标称电压 10 kV；有效绝缘长度 1.2 m'
    },
    '绝缘硬梯': {
      alias: '折叠式硬梯',
      mark: '绝缘硬梯 DLT 976-2017',
      model: '折叠式',
      spec: '标称高度 10 m；额定负荷 1000 N'
    },
    '绝缘横担': {
      alias: '通用型横担',
      mark: '绝缘横担 DLT 976-2017',
      model: '通用型',
      spec: '标称电压 10 kV；有效绝缘长度 1.8 m'
    },
    '绝缘毯': {
      alias: '10kV二级毯',
      mark: '绝缘毯 DLT 976-2017',
      model: '10kV 二级',
      spec: '电压等级 10 kV；级别 二级'
    }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function profile(name) {
    var key = String(name || '').split(/[、,，]/)[0].trim();
    return PROFILES[key] || { alias: key || '—', mark: '—', model: '—', spec: '—' };
  }

  function statusTag(status, extra) {
    var text = status || '';
    var back = text === '已退回';
    return '<span class="st-status"><span class="st-tag' + (back ? ' is-back' : '') + '">' +
      esc(text) + '</span>' + (extra || '') + '</span>';
  }

  function metaInner(code, sampleName) {
    var p = profile(sampleName);
    var items = [
      ['委托编号', code || '—'],
      ['样品别名', p.alias],
      ['产品标记', p.mark],
      ['型号/分类', p.model],
      ['规格参数', p.spec]
    ];
    return items.map(function (pair, i) {
      return (i ? '<span class="sample-meta-dot" aria-hidden="true"></span>' : '') +
        '<span class="sample-meta-item"><em>' + esc(pair[0]) + '</em><strong>' + esc(pair[1]) + '</strong></span>';
    }).join('');
  }

  global.DetectStatus = {
    statusTag: statusTag,
    metaInner: metaInner,
    profile: profile
  };
})(window);
