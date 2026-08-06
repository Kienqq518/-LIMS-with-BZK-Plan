/**
 * 样品标签 / 合格证 HTML 渲染（自由设计：paper + elements[]）
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
      case 'entrustNo':
        return data.entrustNo || data.orderNo || data.委托编号 || '';
      default:
        return data[id] || '';
    }
  }

  function visibleFields(tpl) {
    // 兼容：优先 elements；旧 fields 回退
    if (tpl && Array.isArray(tpl.elements) && tpl.elements.length) {
      return tpl.elements
        .filter(function (el) { return el.type === 'fieldRow' && el.props; })
        .slice()
        .sort(function (a, b) { return (a.yMm - b.yMm) || (a.xMm - b.xMm); })
        .map(function (el) {
          return { id: el.props.fieldId, label: el.props.label || el.props.fieldId, visible: true };
        });
    }
    return (tpl.fields || []).filter(function (f) {
      return f.visible !== false && f.id !== 'qrCode';
    });
  }

  function mmToPx(mm) {
    return Math.round(Number(mm) * 3.78);
  }

  function systemLogoUrl() {
    return (global.LabelCertConfig && LabelCertConfig.SYSTEM_LOGO_URL) || 'assets/label-cert/system-logo.png';
  }

  function systemSealUrl() {
    return (global.LabelCertConfig && LabelCertConfig.SYSTEM_SEAL_URL) || 'assets/label-cert/system-seal.svg';
  }

  function alignCss(align) {
    if (align === 'left') return 'text-align:left;justify-content:flex-start;';
    if (align === 'right') return 'text-align:right;justify-content:flex-end;';
    return 'text-align:center;justify-content:center;';
  }

  function underlineCss(style, color) {
    if (!style || style === 'none') return 'border-bottom:none;';
    return 'border-bottom:1px ' + style + ' ' + esc(color || '#1e293b') + ';';
  }

  function qrHostId(sampleNo, suffix) {
    return 'qr-' + String(sampleNo || 'x').replace(/[/\\]/g, '') + (suffix || '');
  }

  function ensureMigrated(tpl) {
    if (!tpl) return tpl;
    if (Array.isArray(tpl.elements) && tpl.elements.length) return tpl;
    if (global.LabelCertConfig && LabelCertConfig.migrateTemplateToFree) {
      return LabelCertConfig.migrateTemplateToFree(LabelCertConfig.clone(tpl));
    }
    return tpl;
  }

  function sortedElements(tpl) {
    return (tpl.elements || []).slice().sort(function (a, b) {
      return (a.zIndex - b.zIndex) || String(a.id).localeCompare(String(b.id));
    });
  }

  function elBoxStyle(el) {
    var rot = el.rotationDeg ? ('transform:rotate(' + el.rotationDeg + 'deg);') : '';
    return 'position:absolute;left:' + mmToPx(el.xMm) + 'px;top:' + mmToPx(el.yMm) +
      'px;width:' + mmToPx(el.wMm) + 'px;height:' + mmToPx(el.hMm) +
      'px;z-index:' + (el.zIndex || 0) + ';box-sizing:border-box;overflow:hidden;' + rot;
  }

  function fontFamilyCss(p) {
    var id = p && p.fontFamily;
    var css = (global.LabelCertConfig && LabelCertConfig.fontCssById)
      ? LabelCertConfig.fontCssById(id)
      : '';
    return css ? ('font-family:' + css + ';') : '';
  }

  function renderFieldRow(el, data) {
    var p = el.props || {};
    var color = p.color || '#1e293b';
    var fs = p.fontSize || 11;
    var align = p.valueAlign || 'left';
    var label = p.showLabel === false ? '' : ('<span class="lc-el-k">' + esc(p.label || '') + '：</span>');
    return '<div class="lc-el lc-el-field" style="' + elBoxStyle(el) + alignCss(align) +
      'display:flex;align-items:baseline;gap:2px;font-size:' + fs + 'px;color:' + esc(color) + ';' +
      fontFamilyCss(p) + '">' +
      label +
      '<span class="lc-el-v" style="flex:1;min-width:0;' + underlineCss(p.underline, color) + '">' +
      esc(fieldValue(p.fieldId, data)) + '</span></div>';
  }

  function renderTextLike(el, className) {
    var p = el.props || {};
    var opacity = p.opacity != null ? p.opacity : 1;
    return '<div class="lc-el ' + className + '" style="' + elBoxStyle(el) + alignCss(p.align) +
      'display:flex;align-items:center;font-size:' + (p.fontSize || 11) + 'px;color:' + esc(p.color || '#1e293b') +
      ';opacity:' + opacity + ';' + fontFamilyCss(p) + 'white-space:pre-wrap;word-break:break-all;">' +
      esc(p.text || '') + '</div>';
  }

  function renderLogo(el) {
    var p = el.props || {};
    if (p.source === 'hidden') return '';
    var src = (p.source === 'custom' && p.url) ? p.url : systemLogoUrl();
    return '<div class="lc-el lc-el-logo" style="' + elBoxStyle(el) + 'display:flex;align-items:center;justify-content:center;">' +
      '<img src="' + esc(src) + '" alt="logo" style="width:100%;height:100%;object-fit:contain;display:block;" /></div>';
  }

  function renderSeal(el) {
    var p = el.props || {};
    var src = (p.source === 'custom' && p.url) ? p.url : systemSealUrl();
    var opacity = p.opacity != null ? p.opacity : 0.42;
    return '<div class="lc-el lc-el-seal" style="' + elBoxStyle(el) + 'opacity:' + opacity +
      ';display:flex;align-items:center;justify-content:center;">' +
      '<img src="' + esc(src) + '" alt="seal" style="width:100%;height:100%;object-fit:contain;display:block;" /></div>';
  }

  function renderWatermarkText(el) {
    var p = el.props || {};
    if (p.tile) {
      var cell = '<div style="font-size:' + (p.fontSize || 28) + 'px;color:' + esc(p.color || '#16a34a') + ';' +
        fontFamilyCss(p) + 'transform:rotate(' + (el.rotationDeg || 0) + 'deg);">' + esc(p.text || '格') + '</div>';
      var tiles = '';
      for (var i = 0; i < 6; i++) tiles += '<div class="lc-wm-tile">' + cell + '</div>';
      return '<div class="lc-el lc-el-wm-tile" style="position:absolute;left:0;top:0;right:0;bottom:0;z-index:' +
        (el.zIndex || 0) + ';opacity:' + (p.opacity != null ? p.opacity : 0.18) +
        ';display:grid;grid-template-columns:1fr 1fr;align-items:center;justify-items:center;pointer-events:none;" aria-hidden="true">' +
        tiles + '</div>';
    }
    return renderTextLike(el, 'lc-el-wm');
  }

  function renderQr(el, data, opts) {
    var p = el.props || {};
    var id = qrHostId(data.sampleNo, opts.suffix || '');
    var size = Math.max(16, Math.min(mmToPx(el.wMm), mmToPx(el.hMm)));
    return '<div class="lc-el lc-el-qr" style="' + elBoxStyle(el) + 'display:flex;align-items:center;justify-content:center;">' +
      '<div class="lc-qr" id="' + id + '" data-qr-id="' + id + '" data-payload="' +
      esc(p.payloadType || 'cert_shortlink') + '" data-size="' + size +
      '" style="width:' + size + 'px;height:' + size + 'px"></div></div>';
  }

  function renderLine(el) {
    var p = el.props || {};
    var h = Math.max(1, p.widthPx || 1);
    return '<div class="lc-el lc-el-line" style="' + elBoxStyle(el) +
      'display:flex;align-items:center;"><div style="width:100%;border-top:' + h + 'px ' +
      (p.style || 'solid') + ' ' + esc(p.color || '#cbd5e1') + ';"></div></div>';
  }

  function renderHangHole(el) {
    return '<div class="lc-el lc-el-hole" style="' + elBoxStyle(el) +
      'display:flex;align-items:center;justify-content:center;">' +
      '<div style="width:70%;height:70%;border:1.5px solid #94a3b8;border-radius:50%;background:#fff;"></div></div>';
  }

  function renderElement(el, data, opts) {
    switch (el.type) {
      case 'fieldRow': return renderFieldRow(el, data);
      case 'orgName': return renderTextLike(el, 'lc-el-org');
      case 'title': return renderTextLike(el, 'lc-el-title');
      case 'staticText': return renderTextLike(el, 'lc-el-static');
      case 'logo': return renderLogo(el);
      case 'seal': return renderSeal(el);
      case 'watermarkText': return renderWatermarkText(el);
      case 'qr': return renderQr(el, data, opts);
      case 'line': return renderLine(el);
      case 'hangHole': return renderHangHole(el);
      default: return '';
    }
  }

  function sheetOuterStyle(tpl) {
    var paper = tpl.paper || { wMm: 90, hMm: 50, border: { enabled: true, color: '#cbd5e1', widthPx: 1 } };
    var w = mmToPx(paper.wMm);
    var h = mmToPx(paper.hMm);
    var border = paper.border || {};
    var borderCss = border.enabled
      ? ('border:' + (border.widthPx || 1) + 'px solid ' + esc(border.color || '#cbd5e1') + ';')
      : 'border:none;';
    return 'width:' + w + 'px;height:' + h + 'px;position:relative;background:#fff;box-sizing:border-box;overflow:hidden;' + borderCss;
  }

  function renderSheet(tpl, data, opts) {
    opts = opts || {};
    data = data || {};
    tpl = ensureMigrated(tpl);
    var inner = sortedElements(tpl).map(function (el) {
      return renderElement(el, data, opts);
    }).join('');
    return '<div class="lc-sheet lc-free" style="' + sheetOuterStyle(tpl) + '" data-sample="' + esc(data.sampleNo) + '">' +
      inner + '</div>';
  }

  function mountQrs(root) {
    root = root || document;
    var nodes = root.querySelectorAll ? root.querySelectorAll('.lc-qr[data-qr-id]') : [];
    Array.prototype.forEach.call(nodes, function (el) {
      var sampleNo = el.closest && el.closest('.lc-sheet') && el.closest('.lc-sheet').getAttribute('data-sample');
      var payload = el.getAttribute('data-payload') || 'cert_shortlink';
      var size = parseInt(el.getAttribute('data-size'), 10) || 90;
      var id = el.id;
      if (!sampleNo || !id) return;
      if (payload === 'sample_flow') {
        var url = 'label-scan.html?no=' + encodeURIComponent(sampleNo);
        if (global.ShortLinkQR && ShortLinkQR.renderUrlQR) {
          ShortLinkQR.renderUrlQR('#' + id, url, { size: size, showHint: false });
        } else {
          el.innerHTML = '<img alt="qr" width="' + size + '" height="' + size +
            '" src="https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size +
            '&data=' + encodeURIComponent(url) + '" />';
        }
      } else if (global.ShortLinkQR) {
        ShortLinkQR.renderQRBlock('#' + id, sampleNo, { size: size, showHint: false, showLabel: false });
      }
    });
  }

  function ensureStyles() {
    if (document.getElementById('label-cert-render-css')) return;
    var style = document.createElement('style');
    style.id = 'label-cert-render-css';
    style.textContent = [
      '.lc-sheet.lc-free{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;color:#1e293b;}',
      '.lc-sheet.lc-free .lc-el{line-height:1.15;}',
      '.lc-sheet.lc-free .lc-el-k{flex:0 0 auto;white-space:nowrap;}',
      '.lc-sheet.lc-free .lc-el-v{display:inline-block;}',
      '.lc-sheet.lc-free .lc-qr img,.lc-sheet.lc-free .lc-qr canvas{width:100%!important;height:100%!important;}',
      '.lc-wm-tile{display:flex;align-items:center;justify-content:center;}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // 兼容旧调用
  function normalizeQrPlacement(placement) {
    return placement || 'right';
  }

  global.LabelCertRender = {
    renderSheet: renderSheet,
    mountQrs: mountQrs,
    ensureStyles: ensureStyles,
    fieldValue: fieldValue,
    visibleFields: visibleFields,
    normalizeQrPlacement: normalizeQrPlacement,
    esc: esc,
    mmToPx: mmToPx
  };
})(window);
