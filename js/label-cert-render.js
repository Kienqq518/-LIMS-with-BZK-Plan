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
    return (global.LabelCertConfig && LabelCertConfig.SYSTEM_LOGO_URL) || 'assets/label-cert/system-logo.svg';
  }

  function logoHtml(brand) {
    if (!brand || brand.logoMode === 'hidden') return '';
    var bt = brandType(brand);
    var size = bt.logoSize;
    var src = (brand.logoMode === 'custom' && brand.logoUrl) ? brand.logoUrl : systemLogoUrl();
    return '<img class="lc-logo" src="' + esc(src) + '" alt="logo" style="width:' + size + 'px;height:' + size + 'px" />';
  }

  function brandHeadHtml(brand, opts) {
    opts = opts || {};
    var bt = brandType(brand);
    var orgStyle = 'font-size:' + bt.orgFontSize + 'px;color:' + esc(bt.orgColor) + ';' + alignCss(bt.orgAlign);
    var titleStyle = 'font-size:' + bt.titleFontSize + 'px;color:' + esc(bt.titleColor) + ';' + alignCss(bt.titleAlign);
    var title = brand.title || opts.defaultTitle || '';
    var center = opts.center ? ' center' : (opts.compact ? ' compact' : '');
    if (opts.compact && !(brand.orgName || brand.title)) return '';
    var titleBlock = title
      ? ('<div class="lc-title" style="' + titleStyle + '">' + esc(title) + '</div>')
      : '';
    if (opts.compact) {
      return '<div class="lc-brand' + center + '">' + logoHtml(brand) +
        '<div class="lc-org" style="' + orgStyle + '">' + esc(brand.orgName || brand.title || '') + '</div></div>';
    }
    if (opts.titleOnly) {
      var barTitle = title || '检验合格证';
      var barColor = bt.titleColor || '#ffffff';
      // 标题色默认偏深时，顶栏用白字；用户显式浅色则保留
      var barFg = (barColor === '#1e293b' || barColor === '#000000' || barColor === '#111111')
        ? '#ffffff' : barColor;
      return (logoHtml(brand) ? ('<div class="lc-s1-logo">' + logoHtml(brand) + '</div>') : '') +
        '<div class="lc-s1-titlebar" style="font-size:' + bt.titleFontSize + 'px;color:' + esc(barFg) + ';' +
          alignCss(bt.titleAlign) + '">' + esc(barTitle) + '</div>';
    }
    return '<div class="lc-brand' + center + '">' + logoHtml(brand) +
      '<div style="flex:1;min-width:0">' +
      '<div class="lc-org" style="' + orgStyle + '">' + esc(brand.orgName || '') + '</div>' +
      titleBlock + '</div></div>';
  }

  function orgFootHtml(brand) {
    var name = brand.orgName || '';
    if (!name) return '';
    var bt = brandType(brand);
    var style = 'font-size:' + bt.orgFontSize + 'px;color:' + esc(bt.orgColor) + ';' + alignCss(bt.orgAlign);
    return '<div class="lc-org-foot" style="' + style + '">检测单位：' + esc(name) + '</div>';
  }

  function warnHtml(brand, opts) {
    opts = opts || {};
    var text = brand.footerWarning;
    if (text == null || text === '') {
      if (!opts.fallback) return '';
      text = opts.fallback;
    }
    var bt = brandType(brand);
    return '<div class="lc-warn" style="font-size:' + bt.warnFontSize + 'px;color:' + esc(bt.warnColor) + ';' +
      alignCss(bt.warnAlign) + '">' + esc(text) + '</div>';
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
    var compact = tpl.style && tpl.style.fontScale === 'compact';
    return 'width:' + w + 'px;min-height:' + h + 'px;font-size:' + (compact ? '11px' : '12px') + ';';
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
    if (wm.sealMode === 'custom' && wm.sealUrl) {
      return '<img class="lc-wm-seal-img" src="' + esc(wm.sealUrl) + '" alt="seal" />';
    }
    // 图5：圆形双环 + 上弧单位名 + 中心★ + 「试验专用章」
    var org = String(brand.orgName || '某某某有限责任公司').slice(0, 16);
    var sub = wm.text || '试验专用章';
    var chars = org.split('');
    var arc = '';
    var n = chars.length;
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0 : (i / (n - 1) - 0.5) * 2.0;
      var ang = -Math.PI / 2 + t;
      var x = 60 + 40 * Math.cos(ang);
      var y = 60 + 40 * Math.sin(ang);
      var deg = (ang * 180) / Math.PI + 90;
      arc +=
        '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
        '" fill="#dc2626" font-size="8" font-weight="700" text-anchor="middle" dominant-baseline="middle" transform="rotate(' +
        deg.toFixed(1) + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')">' + esc(chars[i]) + '</text>';
    }
    return '<div class="lc-wm-seal">' +
      '<svg class="lc-wm-seal-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<circle cx="60" cy="60" r="56" fill="none" stroke="#dc2626" stroke-width="3.5"/>' +
        '<circle cx="60" cy="60" r="50" fill="none" stroke="#dc2626" stroke-width="1.5"/>' +
        arc +
        '<polygon points="60,42 64,54 76,54 66,62 70,74 60,67 50,74 54,62 44,54 56,54" fill="#dc2626"/>' +
        '<text x="60" y="88" text-anchor="middle" fill="#dc2626" font-size="9" font-weight="700">' + esc(sub) + '</text>' +
      '</svg></div>';
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
      renderWatermark(tpl.brand || {}) +
      '<div class="lc-sheet-content">' + innerHtml + '</div></div>';
  }

  function renderStyle1(tpl, data, opts) {
    var brand = tpl.brand || {};
    // 图4骨架：上标题 → 中字段 → 下检测单位；水印为圆形试验专用章
    var rows = visibleFields(tpl).map(function (f) {
      return '<div class="lc-row lc-s1-row"><span class="lc-k">' + esc(f.label) + '：</span><span class="lc-v">' + esc(fieldValue(f.id, data)) + '</span></div>';
    }).join('');
    var qr = qrPlacementHtml(tpl, data, opts);
    return wrapSheet('lc-s1', tpl, data,
      brandHeadHtml(brand, { titleOnly: true, defaultTitle: '检验合格证' }) +
      '<div class="lc-body lc-s1-body">' + rows + '</div>' +
      orgFootHtml(brand) +
      warnHtml(brand) +
      qr.side + qr.overlay);
  }

  function renderStyle2(tpl, data, opts) {
    var brand = tpl.brand || {};
    var until = fieldValue('validUntil', data) || fieldValue('reinspectDate', data);
    var rows = visibleFields(tpl).filter(function (f) {
      return f.id !== 'validUntil';
    }).map(function (f) {
      return '<div class="lc-row lc-s2-row"><span class="lc-k">' + esc(f.label) + '：</span><span class="lc-v">' + esc(fieldValue(f.id, data)) + '</span></div>';
    }).join('');
    return wrapSheet('lc-s2', tpl, data,
      '<div class="lc-hole"></div>' +
      brandHeadHtml(brand, { center: true, defaultTitle: '检验合格证' }) +
      '<div class="lc-center-pass">' +
      '<span class="lc-pass-char">合</span>' +
      '<div class="lc-center-qr">' +
        '<div class="lc-scan-tip lc-scan-tip-v">扫一扫</div>' +
        renderQrSlot(tpl, data, opts) +
        '<div class="lc-scan-tip lc-scan-tip-v">查信息</div>' +
      '</div>' +
      '<span class="lc-pass-char">格</span></div>' +
      (rows ? ('<div class="lc-s2-fields">' + rows + '</div>') : '') +
      '<div class="lc-valid">检测有效期：' + esc(until) + ' 止</div>' +
      warnHtml(brand, { fallback: '无法扫码视为过期' }));
  }

  function renderStyle3(tpl, data, opts) {
    var brand = tpl.brand || {};
    var rows = visibleFields(tpl).map(function (f) {
      return '<div class="lc-row"><span class="lc-k">' + esc(f.label) + '：</span><span class="lc-v">' + esc(fieldValue(f.id, data)) + '</span></div>';
    }).join('');
    var qr = qrPlacementHtml(tpl, data, opts);
    var body = qr.side
      ? ('<div class="lc-split"><div class="lc-fields">' + rows + '</div>' + qr.side + '</div>')
      : ('<div class="lc-fields">' + rows + '</div>');
    return wrapSheet('lc-s3', tpl, data,
      brandHeadHtml(brand, { defaultTitle: '合 格 证' }) +
      body + warnHtml(brand) + qr.overlay);
  }

  function renderLabel(tpl, data, opts) {
    var brand = tpl.brand || {};
    var rows = visibleFields(tpl).map(function (f) {
      return '<div class="lc-row"><span class="lc-k">' + esc(f.label) + '：</span><span class="lc-v">' + esc(fieldValue(f.id, data)) + '</span></div>';
    }).join('');
    var qr = qrPlacementHtml(tpl, data, opts);
    var body = qr.side
      ? ('<div class="lc-split"><div class="lc-fields">' + rows + '</div>' + qr.side + '</div>')
      : ('<div class="lc-fields">' + rows + '</div>');
    return wrapSheet('lc-label', tpl, data,
      brandHeadHtml(brand, { compact: true }) +
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
    '.lc-logo{object-fit:contain;display:block}',
    '.lc-row{line-height:1.55;display:flex;gap:2px}',
    '.lc-k{color:#475569;white-space:nowrap}',
    '.lc-v{flex:1;border-bottom:1px dotted #cbd5e1;min-height:1.2em}',
    '.lc-split{display:flex;gap:8px;align-items:stretch}',
    '.lc-fields{flex:1;min-width:0}',
    '.lc-qr-side{flex-shrink:0;display:flex;align-items:center;justify-content:center}',
    '.lc-qr{display:flex;align-items:center;justify-content:center;background:#fff}',
    '.lc-qr img{display:block;width:100%;height:100%}',
    '.lc-s1{border:2px solid #2e7d32;padding:0;display:flex;flex-direction:column}',
    '.lc-s1 .lc-sheet-content{display:flex;flex-direction:column;min-height:100%;padding:0}',
    '.lc-s1-logo{display:flex;justify-content:center;padding:4px 0 2px;background:#fff}',
    '.lc-s1-logo .lc-logo{background:#000}',
    '.lc-s1-titlebar{background:#2e7d32;color:#fff;font-weight:800;letter-spacing:.2em;padding:8px 10px;line-height:1.25}',
    '.lc-s1-body{flex:1;padding:8px 10px;background:#fff}',
    '.lc-s1-row{border-bottom:1px solid #e2e8f0;padding:3px 0;min-height:18px}',
    '.lc-s1 .lc-k{color:#334155}',
    '.lc-org-foot{margin-top:auto;padding:7px 10px;font-weight:600;line-height:1.35;border-top:1px solid #c8e6c9;background:#f1f8e9;color:#1b5e20}',
    '.lc-s1 .lc-warn{padding:4px 10px 8px;margin:0}',
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
    '.lc-wm-layer{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}',
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
