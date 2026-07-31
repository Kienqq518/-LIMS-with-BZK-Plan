/**
 * 样品标签 / 合格证 HTML 渲染（按布局预设）
 */
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fieldValue(id, data) {
    switch (id) {
      case 'sampleNo':
      case 'specimenNo':
        return data.sampleNo || data.specimenNo || '';
      case 'sampleName':
        return data.name || data.sampleName || '';
      case 'specModel':
        return data.specModel || [data.spec, data.model].filter(Boolean).join(' ') || '';
      case 'inspectors':
        return Array.isArray(data.inspectors) ? data.inspectors.join('、') : (data.inspectors || '');
      case 'inspectDate':
        return data.inspectDate || '';
      case 'reinspectDate':
      case 'validUntil':
        return data.reinspectDate || data.validUntil || '';
      case 'receiveDate':
        return data.receiveDate || data.sendDate || '';
      case 'clientName':
        return data.clientName || data.customer || '';
      case 'detectStatus':
        return data.detectStatus || data.status || '';
      default:
        return data[id] || '';
    }
  }

  function visibleFields(tpl) {
    return (tpl.fields || []).filter(function (f) {
      return f.visible !== false && f.id !== 'qrCode';
    });
  }

  function mmToPx(mm) {
    return Math.round(mm * 3.78);
  }

  function logoHtml(brand) {
    if (!brand || brand.logoMode === 'hidden') return '';
    if (brand.logoMode === 'custom' && brand.logoUrl) {
      return '<img class="lc-logo" src="' + esc(brand.logoUrl) + '" alt="logo" />';
    }
    return '<i class="fa fa-building lc-logo-ico"></i>';
  }

  function qrHostId(sampleNo, suffix) {
    return 'qr-' + String(sampleNo || 'x').replace(/[/\\]/g, '') + (suffix || '');
  }

  function renderQrSlot(tpl, data, opts) {
    opts = opts || {};
    if (!tpl.qr || tpl.qr.enabled === false) return '';
    var id = qrHostId(data.sampleNo, opts.suffix || '');
    var size = tpl.qr.sizePx || 90;
    return '<div class="lc-qr" id="' + id + '" data-qr-id="' + id + '" data-payload="' + esc(tpl.qr.payloadType || 'cert_shortlink') + '" data-size="' + size + '" style="width:' + size + 'px;height:' + size + 'px"></div>';
  }

  function sheetStyle(tpl) {
    var w = mmToPx((tpl.paper && tpl.paper.wMm) || 90);
    var h = mmToPx((tpl.paper && tpl.paper.hMm) || 50);
    var compact = tpl.style && tpl.style.fontScale === 'compact';
    return 'width:' + w + 'px;min-height:' + h + 'px;font-size:' + (compact ? '11px' : '12px') + ';';
  }

  function renderStyle1(tpl, data, opts) {
    var brand = tpl.brand || {};
    var rows = visibleFields(tpl).map(function (f) {
      return '<div class="lc-row"><span class="lc-k">' + esc(f.label) + '：</span><span class="lc-v">' + esc(fieldValue(f.id, data)) + '</span></div>';
    }).join('');
    var qr = (tpl.qr && tpl.qr.enabled !== false) ? ('<div class="lc-qr-corner">' + renderQrSlot(tpl, data, opts) + '</div>') : '';
    var wm = brand.showWatermarkGe ? '<div class="lc-wm">格</div>' : '';
    return '<div class="lc-sheet lc-s1" style="' + sheetStyle(tpl) + '" data-sample="' + esc(data.sampleNo) + '">' +
      wm +
      '<div class="lc-brand">' + logoHtml(brand) +
      '<div><div class="lc-org">' + esc(brand.orgName || '') + '</div>' +
      '<div class="lc-title">' + esc(brand.title || '检验合格证') + '</div></div></div>' +
      '<div class="lc-body">' + rows + '</div>' + qr +
      '</div>';
  }

  function renderStyle2(tpl, data, opts) {
    var brand = tpl.brand || {};
    var until = fieldValue('validUntil', data) || fieldValue('reinspectDate', data);
    var warn = brand.footerWarning || '无法扫码视为过期';
    return '<div class="lc-sheet lc-s2" style="' + sheetStyle(tpl) + '" data-sample="' + esc(data.sampleNo) + '">' +
      '<div class="lc-hole"></div>' +
      '<div class="lc-brand center">' +
      '<div class="lc-org">' + esc(brand.orgName || '') + '</div>' +
      '<div class="lc-title">' + esc(brand.title || '检验合格证') + '</div></div>' +
      '<div class="lc-center-pass">' +
      '<span class="lc-pass-char">合</span>' +
      '<div class="lc-center-qr"><div class="lc-scan-tip">扫一扫</div>' + renderQrSlot(tpl, data, opts) + '<div class="lc-scan-tip">查信息</div></div>' +
      '<span class="lc-pass-char">格</span></div>' +
      '<div class="lc-valid">检测有效期：' + esc(until) + ' 止</div>' +
      '<div class="lc-warn">' + esc(warn) + '</div></div>';
  }

  function renderStyle3(tpl, data, opts) {
    var brand = tpl.brand || {};
    var rows = visibleFields(tpl).map(function (f) {
      return '<div class="lc-row"><span class="lc-k">' + esc(f.label) + '：</span><span class="lc-v">' + esc(fieldValue(f.id, data)) + '</span></div>';
    }).join('');
    return '<div class="lc-sheet lc-s3" style="' + sheetStyle(tpl) + '" data-sample="' + esc(data.sampleNo) + '">' +
      '<div class="lc-brand">' + logoHtml(brand) +
      '<div><div class="lc-org">' + esc(brand.orgName || '') + '</div>' +
      '<div class="lc-title">' + esc(brand.title || '合 格 证') + '</div></div></div>' +
      '<div class="lc-split">' +
      '<div class="lc-fields">' + rows + '</div>' +
      ((tpl.qr && tpl.qr.enabled !== false) ? ('<div class="lc-qr-side">' + renderQrSlot(tpl, data, opts) + '</div>') : '') +
      '</div></div>';
  }

  function renderLabel(tpl, data, opts) {
    var brand = tpl.brand || {};
    var rows = visibleFields(tpl).map(function (f) {
      return '<div class="lc-row"><span class="lc-k">' + esc(f.label) + '：</span><span class="lc-v">' + esc(fieldValue(f.id, data)) + '</span></div>';
    }).join('');
    var head = (brand.orgName || brand.title)
      ? ('<div class="lc-brand compact">' + logoHtml(brand) + '<div class="lc-org">' + esc(brand.orgName || brand.title || '') + '</div></div>')
      : '';
    return '<div class="lc-sheet lc-label" style="' + sheetStyle(tpl) + '" data-sample="' + esc(data.sampleNo) + '">' +
      head +
      '<div class="lc-split">' +
      '<div class="lc-fields">' + rows + '</div>' +
      ((tpl.qr && tpl.qr.enabled !== false) ? ('<div class="lc-qr-side">' + renderQrSlot(tpl, data, opts) + '</div>') : '') +
      '</div></div>';
  }

  function renderSheet(tpl, data, opts) {
    if (!tpl) return '<div class="lc-missing">未配置模版</div>';
    var preset = tpl.layoutPreset || 'cert_style_3';
    if (preset === 'cert_style_1') return renderStyle1(tpl, data, opts);
    if (preset === 'cert_style_2') return renderStyle2(tpl, data, opts);
    if (preset === 'label_style_1') return renderLabel(tpl, data, opts);
    return renderStyle3(tpl, data, opts);
  }

  /**
   * 渲染后填充二维码 DOM
   */
  function mountQrs(root) {
    root = root || document;
    var nodes = root.querySelectorAll ? root.querySelectorAll('.lc-qr[data-qr-id]') : [];
    Array.prototype.forEach.call(nodes, function (el) {
      var sampleNo = el.closest('.lc-sheet') && el.closest('.lc-sheet').getAttribute('data-sample');
      var payload = el.getAttribute('data-payload') || 'cert_shortlink';
      var size = parseInt(el.getAttribute('data-size'), 10) || 90;
      var id = el.id;
      if (!sampleNo || !id) return;
      if (payload === 'sample_flow') {
        var url = 'label-scan.html?no=' + encodeURIComponent(sampleNo);
        if (global.ShortLinkQR && ShortLinkQR.renderUrlQR) {
          ShortLinkQR.renderUrlQR('#' + id, url, { size: size, showHint: false });
        } else {
          el.innerHTML = '<img alt="qr" width="' + size + '" height="' + size + '" src="https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(url) + '" />';
        }
      } else if (global.ShortLinkQR) {
        ShortLinkQR.renderQRBlock('#' + id, sampleNo, { size: size, showHint: false, showLabel: false });
      }
    });
  }

  var CSS_TEXT = [
    '.lc-sheet{position:relative;background:#fff;border:1px solid #cbd5e1;box-sizing:border-box;padding:8px 10px;overflow:hidden;page-break-after:always;color:#1e293b;font-family:SimSun,"Songti SC",serif}',
    '.lc-brand{display:flex;align-items:center;gap:6px;margin-bottom:6px}',
    '.lc-brand.center{flex-direction:column;text-align:center;gap:2px}',
    '.lc-brand.compact{margin-bottom:4px}',
    '.lc-org{font-size:12px;font-weight:600;line-height:1.3}',
    '.lc-title{font-size:14px;font-weight:700;letter-spacing:.2em;text-align:center}',
    '.lc-logo-ico{color:#2563eb;font-size:16px}',
    '.lc-logo{width:22px;height:22px;object-fit:contain}',
    '.lc-row{line-height:1.55;display:flex;gap:2px}',
    '.lc-k{color:#475569;white-space:nowrap}',
    '.lc-v{flex:1;border-bottom:1px dotted #cbd5e1;min-height:1.2em}',
    '.lc-split{display:flex;gap:8px;align-items:stretch}',
    '.lc-fields{flex:1;min-width:0}',
    '.lc-qr-side{flex-shrink:0;display:flex;align-items:center;justify-content:center}',
    '.lc-qr{display:flex;align-items:center;justify-content:center;background:#fff}',
    '.lc-qr img{display:block;width:100%;height:100%}',
    '.lc-s1{border-color:#2563eb}',
    '.lc-s1 .lc-wm{position:absolute;right:18%;top:42%;font-size:64px;color:rgba(34,197,94,.18);font-weight:700;pointer-events:none;z-index:0}',
    '.lc-s1 .lc-body,.lc-s1 .lc-brand,.lc-s1 .lc-qr-corner{position:relative;z-index:1}',
    '.lc-qr-corner{position:absolute;right:6px;bottom:6px}',
    '.lc-s2{border-radius:6px;padding-top:14px}',
    '.lc-hole{position:absolute;left:8px;top:8px;width:10px;height:10px;border-radius:50%;border:1px solid #94a3b8;background:#f8fafc}',
    '.lc-center-pass{display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0}',
    '.lc-pass-char{font-size:28px;font-weight:800;color:#16a34a;line-height:1}',
    '.lc-center-qr{display:flex;flex-direction:column;align-items:center;gap:2px}',
    '.lc-scan-tip{font-size:10px;color:#64748b}',
    '.lc-valid{text-align:center;font-size:11px;margin-top:2px}',
    '.lc-warn{text-align:center;font-size:10px;color:#dc2626;margin-top:2px}',
    '.lc-label{border-style:dashed}',
    '.lc-missing{padding:24px;color:#94a3b8;text-align:center}',
    '@media print{.lc-sheet{box-shadow:none;border-color:#94a3b8}}'
  ].join('');

  function ensureStyles() {
    if (document.getElementById('label-cert-render-css')) return;
    var style = document.createElement('style');
    style.id = 'label-cert-render-css';
    style.textContent = CSS_TEXT;
    document.head.appendChild(style);
  }

  global.LabelCertRender = {
    renderSheet: renderSheet,
    mountQrs: mountQrs,
    ensureStyles: ensureStyles,
    fieldValue: fieldValue,
    visibleFields: visibleFields,
    esc: esc
  };
})(window);
