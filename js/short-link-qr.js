/**
 * 合格证短链 & 二维码 Mock 服务
 */
(function (global) {
  var BASE = 'https://lab.sc/';
  var VERIFY_BASE = 'cert-verify.html?code=';

  /** status: valid | expired | revoked */
  var registry = {
    Ab3K9: { sampleNo: 'SC2026/00790101', longUrl: 'https://lims.example.com/verify/cert/SC2026-00790101', status: 'valid', reinspectDate: '2027-07-08' },
    Xk7m2: { sampleNo: 'SC2026/00730101', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730101', status: 'valid', reinspectDate: '2027-06-09' },
    Pq4n8: { sampleNo: 'SC2026/00730201', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730201', status: 'valid', reinspectDate: '2027-06-09' },
    Rt5w1: { sampleNo: 'SC2026/00730301', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730301', status: 'valid', reinspectDate: '2027-06-08' },
    Yh6c3: { sampleNo: 'SC2026/00730401', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730401', status: 'valid', reinspectDate: '2027-06-07' },
    Jm8d4: { sampleNo: 'SC2026/00730501', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730501', status: 'valid', reinspectDate: '2027-06-07' },
    Ln2f6: { sampleNo: 'SC2026/00730601', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730601', status: 'valid', reinspectDate: '2027-06-06' },
    Bv9g7: { sampleNo: 'SC2026/00730701', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730701', status: 'valid', reinspectDate: '2027-06-06' },
    Cw3h5: { sampleNo: 'SC2026/00730801', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730801', status: 'valid', reinspectDate: '2027-06-05' },
    Dk1j9: { sampleNo: 'SC2026/00730901', longUrl: 'https://lims.example.com/verify/cert/SC2026-00730901', status: 'valid', reinspectDate: '2027-06-05' },
    Ef4k2: { sampleNo: 'SC2026/00731001', longUrl: 'https://lims.example.com/verify/cert/SC2026-00731001', status: 'valid', reinspectDate: '2027-06-04' },
    Gh7l8: { sampleNo: 'SC2026/00731101', longUrl: 'https://lims.example.com/verify/cert/SC2026-00731101', status: 'valid', reinspectDate: '2027-06-04' },
    Ex1p1: { sampleNo: 'SC2026/00990101', longUrl: 'https://lims.example.com/verify/cert/SC2026-00990101', status: 'expired', reinspectDate: '2025-06-01' },
    Rv0k1: { sampleNo: 'SC2026/00990201', longUrl: 'https://lims.example.com/verify/cert/SC2026-00990201', status: 'revoked', reinspectDate: '2027-12-31', revokeReason: 'rollback' },
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
      longUrl: 'https://lims.example.com/verify/cert/' + encodeURIComponent(sampleNo.replace(/\//g, '-')),
      status: 'valid',
      reinspectDate: '2027-12-31'
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

  function getEntry(code) {
    return registry[code] || null;
  }

  /**
   * 验真结果判定
   * @returns {{ ok: boolean, reason: string, message: string, entry: object|null }}
   */
  function getVerifyResult(code) {
    if (!code) {
      return { ok: false, reason: 'empty', message: '短链代码为空', entry: null };
    }
    var entry = registry[code];
    if (!entry) {
      return { ok: false, reason: 'not_found', message: '短链代码不存在或已失效', entry: null };
    }
    if (entry.status === 'revoked') {
      var revokeMsg = entry.revokeReason === 'rollback'
        ? '流程已从报告签发后续阶段退回到报告签发及之前，合格证自动作废'
        : '该合格证已被作废/撤回';
      return { ok: false, reason: 'revoked', message: revokeMsg, entry: entry };
    }
    if (entry.status === 'expired') {
      return { ok: false, reason: 'expired', message: '已超过再检日期，合格证已失效', entry: entry };
    }
    if (entry.reinspectDate) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var reDate = new Date(entry.reinspectDate.replace(/-/g, '/'));
      if (reDate < today) {
        return { ok: false, reason: 'expired', message: '已超过再检日期（' + entry.reinspectDate + '），无法验真', entry: entry };
      }
    }
    return { ok: true, reason: 'valid', message: '该合格证有效', entry: entry };
  }

  function qrImageUrl(text, size) {
    size = size || 120;
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(text);
  }

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

  function renderUrlQR(container, url, opts) {
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;
    opts = opts || {};
    var size = opts.size || 120;
    container.innerHTML =
      '<a href="' + url + '" target="_blank" title="扫码打开" class="block">' +
        '<img src="' + qrImageUrl(url, size) + '" alt="二维码" width="' + size + '" height="' + size + '" class="rounded border border-slate-200 bg-white" />' +
      '</a>';
  }

  global.ShortLinkQR = {
    BASE: BASE,
    registry: registry,
    getShortUrl: getShortUrl,
    getVerifyPageUrl: getVerifyPageUrl,
    getLongUrl: getLongUrl,
    getSampleNo: getSampleNo,
    getEntry: getEntry,
    getVerifyResult: getVerifyResult,
    qrImageUrl: qrImageUrl,
    renderQRBlock: renderQRBlock,
    renderUrlQR: renderUrlQR
  };
})(window);
