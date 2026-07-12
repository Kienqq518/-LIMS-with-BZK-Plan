/**
 * 合格证短链 & 二维码 Mock 服务
 * 整改：QR 编码短链（如 https://lab.sc/Ab3K9），扫码后 302 跳转验真页，提升识别率
 */
(function (global) {
  var BASE = 'https://lab.sc/';
  var VERIFY_BASE = 'cert-verify.html?code=';

  /** @type {Record<string, { sampleNo: string, longUrl: string }>} */
  var registry = {
    Ab3K9: { sampleNo: 'SC2026/00790101', longUrl: 'https://lims.example.com/verify/cert/SC2026-00790101' },
    Xk7m2: { sampleNo: 'SC2026/00730101', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730101' },
    Pq4n8: { sampleNo: 'SC2026/00730201', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730201' },
    Rt5w1: { sampleNo: 'SC2026/00730301', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730301' },
    Yh6c3: { sampleNo: 'SC2026/00730401', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730401' },
    Jm8d4: { sampleNo: 'SC2026/00730501', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730501' },
    Ln2f6: { sampleNo: 'SC2026/00730601', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730601' },
    Bv9g7: { sampleNo: 'SC2026/00730701', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730701' },
    Cw3h5: { sampleNo: 'SC2026/00730801', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730801' },
    Dk1j9: { sampleNo: 'SC2026/00730901', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730901' },
    Ef4k2: { sampleNo: 'SC2026/00731001', longUrl: 'https://lims.example.com/verify/cert/SC2026-00731001' },
    Gh7l8: { sampleNo: 'SC2026/00731101', longUrl: 'https://lims.example.com/verify/cert/SC2026-00731101' }
  };

  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

  function randomCode(len) {
    var out = '';
    for (var i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function findBySampleNo(sampleNo) {
    var keys = Object.keys(registry);
    for (var i = 0; i < keys.length; i++) {
      if (registry[keys[i]].sampleNo === sampleNo) return keys[i];
    }
    return null;
  }

  function ensureEntry(sampleNo) {
    var existing = findBySampleNo(sampleNo);
    if (existing) return existing;
    var code;
    do { code = randomCode(5); } while (registry[code]);
    registry[code] = {
      sampleNo: sampleNo,
      longUrl: 'https://lims.example.com/verify/cert/' + encodeURIComponent(sampleNo.replace(/\//g, '-'))
    };
    return code;
  }

  function getShortUrl(sampleNo) {
    return BASE + ensureEntry(sampleNo);
  }

  function getVerifyPageUrl(sampleNo) {
    return VERIFY_BASE + ensureEntry(sampleNo);
  }

  function getLongUrl(code) {
    return registry[code] ? registry[code].longUrl : null;
  }

  function getSampleNo(code) {
    return registry[code] ? registry[code].sampleNo : null;
  }

  function qrImageUrl(text, size) {
    size = size || 120;
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text);
  }

  /**
   * 渲染 QR 区域：短链二维码 + 短链文字 + 验真跳转说明
   */
  function renderQRBlock(container, sampleNo, opts) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;
    opts = opts || {};
    var size = opts.size || 120;
    var shortUrl = getShortUrl(sampleNo);
    var code = shortUrl.replace(BASE, '');
    var verifyUrl = getVerifyPageUrl(sampleNo);

    container.innerHTML =
      '<div class="cert-qr-block flex flex-col items-center gap-1">' +
        '<a href="' + verifyUrl + '" target="_blank" title="模拟扫码跳转验真页" class="block">' +
          '<img src="' + qrImageUrl(shortUrl, size) + '" alt="合格证短链二维码" width="' + size + '" height="' + size + '" class="rounded border border-slate-200 bg-white" />' +
        '</a>' +
        (opts.showLabel !== false
          ? '<p class="text-[10px] text-slate-500 leading-tight text-center max-w-[140px] break-all">' +
              '<span class="text-slate-400">短链：</span>' + shortUrl +
            '</p>'
          : '') +
        (opts.showHint
          ? '<p class="text-[9px] text-slate-400 text-center">微信/支付宝/相机扫码 → 验真页</p>'
          : '') +
      '</div>';

    container.setAttribute('data-short-code', code);
    container.setAttribute('data-sample-no', sampleNo);
  }

  global.ShortLinkQR = {
    BASE: BASE,
    registry: registry,
    getShortUrl: getShortUrl,
    getVerifyPageUrl: getVerifyPageUrl,
    getLongUrl: getLongUrl,
    getSampleNo: getSampleNo,
    qrImageUrl: qrImageUrl,
    renderQRBlock: renderQRBlock
  };
})(window);
