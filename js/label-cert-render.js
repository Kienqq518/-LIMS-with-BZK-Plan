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
      case 'entrustNo':
        return data.entrustNo || data.orderNo || data.委托编号 || '';
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

  function brandType(brand) {
    if (global.LabelCertConfig && LabelCertConfig.normalizeBrandType) {
      return LabelCertConfig.normalizeBrandType(brand || {});
    }
    return {
      orgFontSize: 12, orgColor: '#1e293b', orgAlign: 'center',
      titleFontSize: 14, titleColor: '#1e293b', titleAlign: 'center',
      logoSize: 18, warnFontSize: 10, warnColor: '#dc2626', warnAlign: 'center'
    };
  }

  function alignCss(align) {
    if (align === 'left') return 'text-align:left;justify-content:flex-start;';
    if (align === 'right') return 'text-align:right;justify-content:flex-end;';
    return 'text-align:center;justify-content:center;';
  }

  function systemLogoUrl() {
    return (global.LabelCertConfig && LabelCertConfig.SYSTEM_LOGO_URL) || 'assets/label-cert/system-logo.png';
  }

  function systemSealUrl() {
    return (global.LabelCertConfig && LabelCertConfig.SYSTEM_SEAL_URL) || 'assets/label-cert/system-seal.svg';
  }

  function styleOf(tpl) {
    if (global.LabelCertConfig && LabelCertConfig.normalizeStyle) {
      return LabelCertConfig.normalizeStyle((tpl && tpl.style) || {}, tpl && tpl.layoutPreset);
    }
    return {
      fieldAlign: 'left', fieldFontSize: 12, fieldColor: '#1e293b',
      fieldUnderline: true, fieldUnderlineStyle: 'dotted',
      borderEnabled: true, borderColor: '#cbd5e1', borderWidthPx: 1, titleBgColor: '', footerBgColor: ''
    };
  }

  function logoHtml(brand) {
    if (!brand || brand.logoMode === 'hidden') return '';
    var bt = brandType(brand);
    var size = bt.logoSize;
    var src = (brand.logoMode === 'custom' && brand.logoUrl) ? brand.logoUrl : systemLogoUrl();
    return '<img class="lc-logo" src="' + esc(src) + '" alt="logo" width="' + size + '" height="' + size +
      '" style="width:' + size + 'px;height:' + size + 'px;background:#000;object-fit:cover;display:block;flex-shrink:0" />';
  }

  function brandHeadHtml(brand, opts) {
    opts = opts || {};
    var bt = brandType(brand);
    var st = opts.style || {};
    var orgStyle = 'font-size:' + bt.orgFontSize + 'px;color:' + esc(bt.orgColor) + ';' + alignCss(bt.orgAlign);
    var titleStyle = 'font-size:' + bt.titleFontSize + 'px;color:' + esc(bt.titleColor) + ';' + alignCss(bt.titleAlign);
    var title = brand.title || opts.defaultTitle || '';
    var center = opts.center ? ' center' : (opts.compact ? ' compact' : '');
    if (opts.compact && !(brand.orgName || brand.title)) return '';
    var titleBlock = title
      ? ('<div class="lc-title" style="' + titleStyle + '">' + esc(title) + '</div>')
      : '';
    var titleBg = st.titleBgColor ? ('background:' + esc(st.titleBgColor) + ';') : '';
    if (opts.compact) {
      return '<div class="lc-brand' + center + '" style="' + titleBg + '">' + logoHtml(brand) +
        '<div class="lc-org" style="' + orgStyle + '">' + esc(brand.orgName || brand.title || '') + '</div></div>';
    }
    if (opts.titleOnly) {
      var barTitle = title || '检验合格证';
      var barColor = bt.titleColor || '#ffffff';
      var barFg = (barColor === '#1e293b' || barColor === '#000000' || barColor === '#111111')
        ? '#ffffff' : barColor;
      var bg = st.titleBgColor || '#2e7d32';
      var logo = logoHtml(brand);
      var justify = bt.titleAlign === 'left' ? 'flex-start' : (bt.titleAlign === 'right' ? 'flex-end' : 'center');
      return '<div class="lc-s1-titlebar" style="background:' + esc(bg) + ';font-size:' + bt.titleFontSize +
        'px;color:' + esc(barFg) + ';justify-content:' + justify + '">' +
        (logo ? ('<span class="lc-s1-logo-inline">' + logo + '</span>') : '') +
        '<span class="lc-s1-title-text">' + esc(barTitle) + '</span></div>';
    }
    return '<div class="lc-brand' + center + '" style="' + titleBg + 'padding:4px 6px;margin:0 -2px 6px;">' + logoHtml(brand) +
      '<div style="flex:1;min-width:0">' +
      '<div class="lc-org" style="' + orgStyle + '">' + esc(brand.orgName || '') + '</div>' +
      titleBlock + '</div></div>';
  }

  function orgFootHtml(brand, st) {
    var name = brand.orgName || '';
    if (!name) return '';
    var bt = brandType(brand);
    var style = 'font-size:' + bt.orgFontSize + 'px;color:' + esc(bt.orgColor) + ';' + alignCss(bt.orgAlign);
    if (st && st.footerBgColor) style += 'background:' + esc(st.footerBgColor) + ';';
    return '<div class="lc-org-foot" style="' + style + '">检测单位：' + esc(name) + '</div>';
  }

  function underlineCss(st) {
    if (!st.fieldUnderline || st.fieldUnderlineStyle === 'none') return 'border-bottom:none;';
    return 'border-bottom:1px ' + st.fieldUnderlineStyle + ' ' + esc(st.fieldColor) + ';';
  }

  function fieldRowsHtml(tpl, data, extraClass) {
    var st = styleOf(tpl);
    var align = st.fieldAlign || 'left';
    // 居中/居右时标签与值成组排布，避免 .lc-v flex:1 把间距拉得过宽
    var rowAlign = align === 'right'
      ? 'justify-content:flex-end;text-align:right;'
      : (align === 'center' ? 'justify-content:center;text-align:center;' : 'justify-content:flex-start;text-align:left;');
    var vFlex = (align === 'center' || align === 'right')
      ? 'flex:0 1 auto;width:auto;max-width:70%;'
      : 'flex:1;min-width:0;';
    var base = 'display:flex;align-items:baseline;gap:2px;font-size:' + st.fieldFontSize +
      'px;color:' + esc(st.fieldColor) + ';' + rowAlign;
    return visibleFields(tpl).map(function (f) {
      return '<div class="lc-row ' + (extraClass || '') + '" style="' + base + '">' +
        '<span class="lc-k" style="flex:0 0 auto;">' + esc(f.label) + '：</span>' +
        '<span class="lc-v" style="' + vFlex + underlineCss(st) + '">' + esc(fieldValue(f.id, data)) + '</span></div>';
    }).join('');
  }

  function warnHtml(brand, opts) {
    opts = opts || {};
    var text = brand.footerWarning;
    if (text == null || text === '') {
      if (!opts.fallback) return '';
      text = opts.fallback;
    }
    var bt = brandType(brand);
    var st = opts.style || {};
    var bg = st.footerBgColor ? ('background:' + esc(st.footerBgColor) + ';') : '';
    return '<div class="lc-warn" style="font-size:' + bt.warnFontSize + 'px;color:' + esc(bt.warnColor) + ';' +
      alignCss(bt.warnAlign) + bg + 'padding:4px 6px;">' + esc(text) + '</div>';
  }

  function normalizeQrPlacement(placement, preset) {
    var p = placement || '';
    if (preset === 'cert_style_2') return 'center';
    if (p === 'none') return 'none';
    if (p === 'center') return 'center';
    if (p === 'right') return 'right';
    if (p === 'corner') return 'bottom_right';
    if (p === 'top_left' || p === 'top_right' || p === 'bottom_left' || p === 'bottom_right') return p;
    if (preset === 'cert_style_1') return 'bottom_right';
    return 'right';
  }

  function qrPlacementHtml(tpl, data, opts) {
    if (!tpl.qr || tpl.qr.enabled === false) return { side: '', overlay: '' };
    var place = normalizeQrPlacement(tpl.qr.placement, tpl.layoutPreset);
    if (place === 'none') return { side: '', overlay: '' };
    var slot = renderQrSlot(tpl, data, opts);
    if (place === 'right') return { side: '<div class="lc-qr-side">' + slot + '</div>', overlay: '' };
    if (place === 'center') return { side: '', overlay: '<div class="lc-qr-abs lc-qr-abs-center">' + slot + '</div>' };
    return { side: '', overlay: '<div class="lc-qr-abs lc-qr-abs-' + place + '">' + slot + '</div>' };
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
    var st = styleOf(tpl);
    var border = st.borderEnabled
      ? ('border-color:' + esc(st.borderColor) + ';border-width:' + st.borderWidthPx + 'px;border-style:solid;')
      : 'border:none;';
    return 'width:' + w + 'px;min-height:' + h + 'px;font-size:' + st.fieldFontSize + 'px;' + border;
  }

  function watermarkConfig(brand) {
    brand = brand || {};
    if (global.LabelCertConfig && LabelCertConfig.normalizeWatermark) {
      return LabelCertConfig.normalizeWatermark(brand.watermark, brand, null);
    }
    if (brand.showWatermarkGe) {
      return { enabled: true, type: 'text', text: '格', opacity: 0.18, angle: 0, position: 'right', size: 'lg', layout: 'single', sealMode: 'system', sealUrl: null };
    }
    return { enabled: false };
  }

  function sealMarkHtml(brand, wm) {
    // custom=自定义上传章图；system/配置中上传=使用图8资源
    var src = (wm.sealMode === 'custom' && wm.sealUrl) ? wm.sealUrl : systemSealUrl();
    return '<div class="lc-wm-seal"><img class="lc-wm-seal-img" src="' + esc(src) + '" alt="seal" /></div>';
  }

  function watermarkMarkHtml(brand, wm) {
    if (wm.type === 'seal') return sealMarkHtml(brand, wm);
    var color = wm.color || '#16a34a';
    return '<div class="lc-wm-text" style="color:' + esc(color) + '">' + esc(wm.text || '合格') + '</div>';
  }

  function renderWatermark(brand) {
    var wm = watermarkConfig(brand);
    if (!wm.enabled) return '';
    var sizeClass = 'lc-wm-size-' + (wm.size || 'md');
    var posClass = 'lc-wm-pos-' + (wm.position || 'center');
    var style = 'opacity:' + wm.opacity + ';--lc-wm-angle:' + wm.angle + 'deg;';
    if (wm.layout === 'tile') {
      var cell = watermarkMarkHtml(brand, wm);
      var tiles = '';
      for (var i = 0; i < 6; i++) tiles += '<div class="lc-wm-tile">' + cell + '</div>';
      return '<div class="lc-wm-layer lc-wm-tile-layer ' + sizeClass + '" style="' + style + '" aria-hidden="true">' + tiles + '</div>';
    }
    return '<div class="lc-wm-layer ' + sizeClass + ' ' + posClass + '" style="' + style + '" aria-hidden="true">' +
      '<div class="lc-wm-rot">' + watermarkMarkHtml(brand, wm) + '</div></div>';
  }

  function wrapSheet(className, tpl, data, innerHtml) {
    return '<div class="lc-sheet ' + className + '" style="' + sheetStyle(tpl) + '" data-sample="' + esc(data.sampleNo) + '">' +
      '<div class="lc-sheet-content">' + innerHtml + '</div>' +
      renderWatermark(tpl.brand || {}) +
      '</div>';
  }

  function renderStyle1(tpl, data, opts) {
    var brand = tpl.brand || {};
    var st = styleOf(tpl);
    var rows = fieldRowsHtml(tpl, data, 'lc-s1-row');
    var qr = qrPlacementHtml(tpl, data, opts);
    // 右侧二维码需与字段区并排，不能直接追加在底部
    var body = qr.side
      ? ('<div class="lc-split lc-s1-split"><div class="lc-fields">' + rows + '</div>' + qr.side + '</div>')
      : rows;
    return wrapSheet('lc-s1', tpl, data,
      brandHeadHtml(brand, { titleOnly: true, defaultTitle: '检验合格证', style: st }) +
      '<div class="lc-body lc-s1-body">' + body + '</div>' +
      orgFootHtml(brand, st) +
      warnHtml(brand, { style: st }) +
      qr.overlay);
  }

  function renderStyle2(tpl, data, opts) {
    var brand = tpl.brand || {};
    var st = styleOf(tpl);
    var until = fieldValue('validUntil', data) || fieldValue('reinspectDate', data);
    var untilField = null;
    var fields = visibleFields(tpl).filter(function (f) {
      if (f.id === 'validUntil') { untilField = f; return false; }
      return true;
    });
    var tmp = { fields: fields, style: tpl.style, layoutPreset: tpl.layoutPreset };
    var rows = fieldRowsHtml(tmp, data, 'lc-s2-row');
    var untilRow = '';
    if (untilField) {
      var untilData = {};
      for (var k in data) if (Object.prototype.hasOwnProperty.call(data, k)) untilData[k] = data[k];
      untilData.validUntil = until ? (until + ' 止') : '';
      untilData.reinspectDate = untilData.validUntil;
      untilRow = fieldRowsHtml(
        { fields: [untilField], style: tpl.style, layoutPreset: tpl.layoutPreset },
        untilData,
        'lc-s2-row'
      );
    }
    var footBg = st.footerBgColor ? ('background:' + esc(st.footerBgColor) + ';') : '';
    return wrapSheet('lc-s2', tpl, data,
      '<div class="lc-hole"></div>' +
      brandHeadHtml(brand, { center: true, defaultTitle: '检验合格证', style: st }) +
      '<div class="lc-center-pass">' +
      '<span class="lc-pass-char">合</span>' +
      '<div class="lc-center-qr">' +
        '<div class="lc-scan-tip lc-scan-tip-v">扫一扫</div>' +
        renderQrSlot(tpl, data, opts) +
        '<div class="lc-scan-tip lc-scan-tip-v">查信息</div>' +
      '</div>' +
      '<span class="lc-pass-char">格</span></div>' +
      (rows ? ('<div class="lc-s2-fields">' + rows + '</div>') : '') +
      '<div class="lc-s2-foot" style="' + footBg + 'padding:4px 6px;margin:2px -2px 0;">' +
        untilRow +
        warnHtml(brand, { fallback: '无法扫码视为过期', style: {} }) +
      '</div>');
  }

  function footerBarHtml(st) {
    if (!st || !st.footerBgColor) return '';
    // 字段区下方一条底色边，用于体现「底部栏背景色」
    return '<div class="lc-footer-bar" style="height:5px;margin-top:8px;background:' +
      esc(st.footerBgColor) + ';"></div>';
  }

  function renderStyle3(tpl, data, opts) {
    var brand = tpl.brand || {};
    var st = styleOf(tpl);
    var rows = fieldRowsHtml(tpl, data, '');
    var qr = qrPlacementHtml(tpl, data, opts);
    var body = qr.side
      ? ('<div class="lc-split"><div class="lc-fields">' + rows + '</div>' + qr.side + '</div>')
      : ('<div class="lc-fields">' + rows + '</div>');
    var foot = warnHtml(brand, { style: st });
    // 无警示文案时仍渲染底色条，保证「底部栏背景色」实时预览可见
    if (!foot) foot = footerBarHtml(st);
    return wrapSheet('lc-s3', tpl, data,
      brandHeadHtml(brand, { defaultTitle: '合 格 证', style: st }) +
      body + foot + qr.overlay);
  }

  function renderLabel(tpl, data, opts) {
    var brand = tpl.brand || {};
    var rows = fieldRowsHtml(tpl, data, '');
    var qr = qrPlacementHtml(tpl, data, opts);
    var body = qr.side
      ? ('<div class="lc-split"><div class="lc-fields">' + rows + '</div>' + qr.side + '</div>')
      : ('<div class="lc-fields">' + rows + '</div>');
    return wrapSheet('lc-label', tpl, data,
      brandHeadHtml(brand, { compact: true, style: styleOf(tpl) }) +
      body + warnHtml(brand) + qr.overlay);
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
    '.lc-sheet-content{position:relative;z-index:1;min-height:100%}',
    '.lc-brand{display:flex;align-items:center;gap:6px;margin-bottom:6px}',
    '.lc-brand.center{flex-direction:column;text-align:center;gap:2px}',
    '.lc-brand.compact{margin-bottom:4px}',
    '.lc-org{font-weight:600;line-height:1.3}',
    '.lc-title{font-weight:700;letter-spacing:.2em;text-align:center}',
    '.lc-logo-ico{line-height:1}',
    '.lc-logo{object-fit:cover;display:block;background:#000}',
    '.lc-row{line-height:1.55;display:flex;gap:2px}',
    '.lc-k{white-space:nowrap}',
    '.lc-v{flex:1;min-height:1.2em}',
    '.lc-split{display:flex;gap:8px;align-items:stretch}',
    '.lc-fields{flex:1;min-width:0}',
    '.lc-qr-side{flex-shrink:0;display:flex;align-items:center;justify-content:center}',
    '.lc-qr{display:flex;align-items:center;justify-content:center;background:#fff}',
    '.lc-qr img{display:block;width:100%;height:100%}',
    '.lc-s1{padding:0;display:flex;flex-direction:column}',
    '.lc-s1 .lc-sheet-content{display:flex;flex-direction:column;min-height:100%;padding:0}',
    '.lc-s1-titlebar{display:flex;align-items:center;gap:8px;background:#2e7d32;color:#fff;font-weight:800;letter-spacing:.15em;padding:8px 10px;line-height:1.25}',
    '.lc-s1-logo-inline{display:inline-flex;align-items:center;flex-shrink:0}',
    '.lc-s1-logo-inline .lc-logo{border-radius:2px}',
    '.lc-s1-title-text{min-width:0}',
    '.lc-s1-body{flex:1;padding:8px 10px;background:#fff}',
    '.lc-s1-row{padding:3px 0;min-height:18px}',
    '.lc-s1 .lc-k{color:inherit}',
    '.lc-org-foot{margin-top:auto;padding:7px 10px;font-weight:600;line-height:1.35;border-top:none;background:#f1f8e9;color:#1b5e20}',
    '.lc-s1 .lc-org-foot{border-top:1px solid rgba(0,0,0,.06)}',
    '.lc-s1 .lc-warn{padding:4px 10px 8px;margin:0}',
    '.lc-s1-split{align-items:flex-start;margin-top:2px}',
    '.lc-s1-split .lc-qr-side{padding-top:2px}',
    '.lc-s2-fields{margin:4px 0 2px;font-size:10px}',
    '.lc-s2-row{line-height:1.35}',
    '.lc-wm-seal-svg{width:100%;height:100%;display:block}',
    '.lc-wm-size-sm .lc-wm-seal-svg{width:52px;height:52px}',
    '.lc-wm-size-md .lc-wm-seal-svg{width:72px;height:72px}',
    '.lc-wm-size-lg .lc-wm-seal-svg{width:96px;height:96px}',
    '.lc-qr-abs{position:absolute;z-index:2}',
    '.lc-qr-abs-top_left{left:6px;top:6px}',
    '.lc-qr-abs-top_right{right:6px;top:6px}',
    '.lc-qr-abs-bottom_left{left:6px;bottom:6px}',
    '.lc-qr-abs-bottom_right{right:6px;bottom:6px}',
    '.lc-qr-abs-center{left:50%;top:50%;transform:translate(-50%,-50%)}',
    '.lc-s2{border-radius:6px;padding-top:14px;padding-bottom:10px}',
    '.lc-hole{position:absolute;left:8px;top:8px;width:10px;height:10px;border-radius:50%;border:1px solid #94a3b8;background:#f8fafc;z-index:2}',
    '.lc-center-pass{display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0}',
    '.lc-pass-char{font-size:28px;font-weight:800;color:#16a34a;line-height:1}',
    '.lc-center-qr{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:4px}',
    '.lc-scan-tip{font-size:10px;color:#64748b;line-height:1.1}',
    '.lc-scan-tip-v{writing-mode:vertical-rl;text-orientation:upright;letter-spacing:.12em;white-space:nowrap}',
    '.lc-valid{text-align:center;font-size:11px;margin-top:2px}',
    '.lc-warn{text-align:center;margin-top:4px;line-height:1.35;word-break:break-all;padding:0 2px}',
    '.lc-label{border-style:dashed}',
    '.lc-missing{padding:24px;color:#94a3b8;text-align:center}',
    /* 水印层 */
    '.lc-wm-layer{position:absolute;inset:0;z-index:20;pointer-events:none;overflow:hidden}',
    '.lc-qr-abs{z-index:2}',
    '.lc-wm-rot{display:inline-flex;align-items:center;justify-content:center;transform:rotate(var(--lc-wm-angle,0deg));transform-origin:center center}',
    '.lc-wm-text{font-weight:700;line-height:1;white-space:nowrap;font-family:SimSun,"Songti SC",serif}',
    '.lc-wm-size-sm .lc-wm-text{font-size:28px}',
    '.lc-wm-size-md .lc-wm-text{font-size:42px}',
    '.lc-wm-size-lg .lc-wm-text{font-size:64px}',
    '.lc-wm-seal{display:flex;align-items:center;justify-content:center}',
    '.lc-wm-seal-ring{border:2px solid #dc2626;border-radius:50%;color:#dc2626;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;background:rgba(255,255,255,.08)}',
    '.lc-wm-size-sm .lc-wm-seal-ring{width:52px;height:52px}',
    '.lc-wm-size-md .lc-wm-seal-ring{width:72px;height:72px}',
    '.lc-wm-size-lg .lc-wm-seal-ring{width:92px;height:92px}',
    '.lc-wm-seal-org{font-size:8px;line-height:1.15;padding:0 4px;font-weight:600;max-width:90%;overflow:hidden}',
    '.lc-wm-size-lg .lc-wm-seal-org{font-size:9px}',
    '.lc-wm-seal-star{font-size:12px;line-height:1;margin:1px 0}',
    '.lc-wm-size-lg .lc-wm-seal-star{font-size:14px}',
    '.lc-wm-seal-sub{font-size:9px;font-weight:700;letter-spacing:.05em}',
    '.lc-wm-size-lg .lc-wm-seal-sub{font-size:10px}',
    '.lc-wm-seal-img{object-fit:contain;display:block}',
    '.lc-wm-size-sm .lc-wm-seal-img{width:52px;height:52px}',
    '.lc-wm-size-md .lc-wm-seal-img{width:72px;height:72px}',
    '.lc-wm-size-lg .lc-wm-seal-img{width:92px;height:92px}',
    '.lc-wm-pos-top_left,.lc-wm-pos-top,.lc-wm-pos-top_right,.lc-wm-pos-left,.lc-wm-pos-center,.lc-wm-pos-right,.lc-wm-pos-bottom_left,.lc-wm-pos-bottom,.lc-wm-pos-bottom_right{display:flex;padding:6px}',
    '.lc-wm-pos-top_left{align-items:flex-start;justify-content:flex-start}',
    '.lc-wm-pos-top{align-items:flex-start;justify-content:center}',
    '.lc-wm-pos-top_right{align-items:flex-start;justify-content:flex-end}',
    '.lc-wm-pos-left{align-items:center;justify-content:flex-start}',
    '.lc-wm-pos-center{align-items:center;justify-content:center}',
    '.lc-wm-pos-right{align-items:center;justify-content:flex-end}',
    '.lc-wm-pos-bottom_left{align-items:flex-end;justify-content:flex-start}',
    '.lc-wm-pos-bottom{align-items:flex-end;justify-content:center}',
    '.lc-wm-pos-bottom_right{align-items:flex-end;justify-content:flex-end}',
    '.lc-wm-tile-layer{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);align-items:center;justify-items:center;padding:4px}',
    '.lc-wm-tile .lc-wm-text,.lc-wm-tile .lc-wm-seal,.lc-wm-tile .lc-wm-seal-img{transform:rotate(var(--lc-wm-angle,0deg))}',
    '@media print{.lc-sheet{box-shadow:none;border-color:#94a3b8}}'
  ].join('');

  function ensureStyles() {
    var style = document.getElementById('label-cert-render-css');
    if (!style) {
      style = document.createElement('style');
      style.id = 'label-cert-render-css';
      document.head.appendChild(style);
    }
    style.textContent = CSS_TEXT;
  }

  global.LabelCertRender = {
    renderSheet: renderSheet,
    mountQrs: mountQrs,
    ensureStyles: ensureStyles,
    fieldValue: fieldValue,
    visibleFields: visibleFields,
    normalizeQrPlacement: normalizeQrPlacement,
    esc: esc
  };
})(window);
