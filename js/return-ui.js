/**
 * 统一「退回记录」展示与采集。
 * 挂载：待办页顶部条 / 工作台当前任务旁 / 报告记录时间轴。
 */
(function (global) {
  var CSS = [
    '.ret-tag{display:inline-flex;align-items:center;gap:3px;margin-left:6px;padding:1px 6px;border-radius:3px;font-size:11px;font-weight:600;line-height:1.4;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;vertical-align:middle;white-space:nowrap}',
    '.ret-tag-fail{background:#fff7ed;color:#c2410c;border-color:#fed7aa}',
    '.ret-warn{margin-left:0;color:#f97316;font-size:14px;vertical-align:middle}',
    '.ret-warn-wrap{display:inline-flex;align-items:center;margin-left:6px;cursor:help;vertical-align:middle;outline:none}',
    '.ret-warn-wrap:focus{outline:2px solid #fdba74;outline-offset:2px;border-radius:9999px}',
    '#ret-warn-tip{position:fixed;z-index:10050;display:none;max-width:320px;padding:8px 10px;border-radius:6px;background:#1e293b;color:#fff;font-size:12px;line-height:1.55;box-shadow:0 8px 24px rgba(15,23,42,.28);pointer-events:none;white-space:pre-wrap;word-break:break-word}',
    '#ret-warn-tip.is-on{display:block}',
    '#ret-warn-tip::after{content:"";position:absolute;left:var(--arrow-left,50%);bottom:-6px;width:0;height:0;margin-left:-6px;border:6px solid transparent;border-top-color:#1e293b;border-bottom-width:0}',
    '#ret-warn-tip.is-below::after{bottom:auto;top:-6px;border-top-width:0;border-top-color:transparent;border-bottom-width:6px;border-bottom-color:#1e293b}',
    '.ret-code-stack{display:flex;flex-wrap:wrap;align-items:center;gap:4px}',
    '.ret-banner{margin-top:1rem;border:1px solid #f3c4c4;background:#fff7f7;border-radius:8px;box-shadow:0 1px 2px rgba(15,23,42,.04)}',
    '.ret-banner-head{padding:9px 16px;border-bottom:1px solid #f3c4c4;font-size:13px;font-weight:600;color:#b91c1c;background:#fdecec}',
    '.ret-banner-body{max-height:11.5rem;overflow-y:auto;padding:12px 16px 14px;font-size:13px;color:#7f1d1d}',
    '.ret-banner-group{padding:0}',
    '.ret-banner-code{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:#9f1239}',
    '.ret-banner-count{font-size:12px;font-weight:500;color:#be123c}',
    '.ret-banner-go{margin-left:auto;flex-shrink:0;color:#2563eb;font-size:13px;white-space:nowrap}',
    '.ret-banner-go:hover{text-decoration:underline}',
    '.ret-banner-card{background:#fff;border:1px solid #f3c4c4;border-left:3px solid #e11d48;border-radius:6px;padding:10px 12px}',
    '.ret-banner-card.is-ai{border-color:#f3c4c4;border-left-color:#e11d48;background:#fff}',
    '.ret-banner-card+.ret-banner-card{margin-top:8px}',
    '.ret-banner-card-head{display:flex;align-items:center;gap:8px;min-width:0}',
    '.ret-banner-report{font-weight:700;color:#9f1239;font-size:13px;white-space:nowrap}',
    '.ret-banner-meta{font-size:12px;font-weight:400;color:#9f1239;line-height:1.5;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ret-banner-reason{margin-top:4px;font-size:12px;line-height:1.55;color:#7f1d1d}',
    '.ret-ai-pill{display:inline-flex;align-items:center;gap:3px;margin-right:6px;padding:1px 7px;border-radius:9999px;border:1px solid #fda4af;background:#fff1f2;font-size:10px;font-weight:600;letter-spacing:.02em;color:#be123c;vertical-align:middle;white-space:nowrap}',
    '.ret-strip{margin-bottom:12px;border:1px solid #fecaca;background:#fff7f7;border-radius:8px;padding:10px 14px}',
    '.ret-tl{border:1px dashed #e2e8f0;background:#f8fafc;padding:.75rem 1rem .9rem;border-radius:8px}',
    '.ret-tl-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem;margin-bottom:.65rem}',
    '.ret-timeline{position:relative;margin:0;padding:0;list-style:none}',
    '.ret-timeline>li{position:relative;padding:0 0 .85rem 1.15rem;border-left:2px solid #e2e8f0;margin-left:.35rem}',
    '.ret-timeline>li:last-child{padding-bottom:0;border-left-color:transparent}',
    '.ret-timeline>li::before{content:"";position:absolute;left:-5px;top:.35rem;width:8px;height:8px;border-radius:9999px;background:#fff;border:2px solid #94a3b8}',
    '.ret-timeline>li.is-latest::before{border-color:#ef4444;background:#fecaca}',
    '.ret-timeline>li.is-ai::before{border-color:#f97316;background:#ffedd5}',
    '.ret-chip{display:inline-flex;align-items:center;gap:4px;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;background:#fff;border:1px solid #e2e8f0;color:#475569}',
    '.ret-chip.is-latest{border-color:#fca5a5;color:#b91c1c;background:#fef2f2}',
    '.ret-chip.is-ai{border-color:#fdba74;color:#c2410c;background:#fff7ed}',
    '.ret-log-reason{margin-top:4px;padding:6px 8px;border-radius:6px;background:#fef2f2;color:#991b1b;font-size:12px;line-height:1.5}',
    '#ret-modal.ret-mask{position:fixed;inset:0;z-index:70;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;padding:16px}',
    '#ret-modal.hidden{display:none}',
    '#ret-modal .ret-panel{width:560px;max-width:100%;max-height:90vh;overflow:auto;background:#fff;border-radius:10px;box-shadow:0 20px 50px rgba(15,23,42,.2)}'
  ].join('\n');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function store() { return global.ReturnStore; }
  function ensureCss() {
    if (document.getElementById('return-ui-css')) return;
    var st = document.createElement('style');
    st.id = 'return-ui-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function tagHtml(opt) {
    opt = opt || {};
    var label = opt.label || '退回';
    var title = opt.title || '';
    return '<span class="ret-tag' + (opt.fail ? ' ret-tag-fail' : '') + '"' +
      (title ? ' title="' + esc(title) + '"' : '') + '><i class="fa fa-undo"></i>' + esc(label) + '</span>';
  }
  function aiPillHtml(title) {
    return '<span class="ret-ai-pill"' +
      (title ? ' title="' + esc(title) + '"' : ' title="报告审核 AI 预审命中严重项，已自动退回编制"') +
      '><i class="fa fa-bolt"></i>AI 自动退回</span>';
  }
  function warnIcon(reason) {
    if (!reason) return '';
    return '<span class="ret-warn-wrap" tabindex="0" data-reason="' + esc(reason) + '" aria-label="退回原因">' +
      '<i class="fa fa-exclamation-circle ret-warn" aria-hidden="true"></i></span>';
  }
  function warnTipEl() {
    var el = document.getElementById('ret-warn-tip');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'ret-warn-tip';
    el.setAttribute('role', 'tooltip');
    document.body.appendChild(el);
    return el;
  }
  function hideWarnTip() {
    var el = document.getElementById('ret-warn-tip');
    if (el) el.classList.remove('is-on', 'is-below');
  }
  function showWarnTip(wrap) {
    if (!wrap) return;
    ensureCss();
    var el = warnTipEl();
    el.textContent = wrap.getAttribute('data-reason') || '';
    el.classList.add('is-on');
    el.classList.remove('is-below');
    var r = wrap.getBoundingClientRect();
    var tw = el.offsetWidth;
    var th = el.offsetHeight;
    var left = r.left + r.width / 2 - tw / 2;
    var top = r.top - th - 8;
    var below = false;
    if (top < 8) {
      top = r.bottom + 8;
      below = true;
    }
    if (left < 8) left = 8;
    if (left + tw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - tw - 8);
    if (top + th > window.innerHeight - 8 && !below) top = Math.max(8, window.innerHeight - th - 8);
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
    el.classList.toggle('is-below', below);
    var arrow = r.left + r.width / 2 - left;
    el.style.setProperty('--arrow-left', Math.max(12, Math.min(tw - 12, arrow)) + 'px');
  }
  function bindWarnTips() {
    if (document.documentElement.getAttribute('data-ret-warn-bound')) return;
    document.documentElement.setAttribute('data-ret-warn-bound', '1');
    var current = null;
    function enter(e) {
      var wrap = e.target.closest && e.target.closest('.ret-warn-wrap');
      if (!wrap || wrap === current) return;
      current = wrap;
      showWarnTip(wrap);
    }
    function leave(e) {
      var wrap = e.target.closest && e.target.closest('.ret-warn-wrap');
      if (!wrap) return;
      var rel = e.relatedTarget;
      if (rel && wrap.contains(rel)) return;
      if (current === wrap) current = null;
      hideWarnTip();
    }
    document.addEventListener('pointerover', enter);
    document.addEventListener('mouseover', enter);
    document.addEventListener('pointerout', leave);
    document.addEventListener('mouseout', leave);
    document.addEventListener('focusin', function (e) {
      var wrap = e.target.closest && e.target.closest('.ret-warn-wrap');
      if (wrap) { current = wrap; showWarnTip(wrap); }
    });
    document.addEventListener('focusout', function (e) {
      var wrap = e.target.closest && e.target.closest('.ret-warn-wrap');
      if (wrap) { current = null; hideWarnTip(); }
    });
    window.addEventListener('scroll', hideWarnTip, true);
    window.addEventListener('resize', hideWarnTip);
  }
  function latest(code, node) {
    var st = store();
    if (!st || !code) return null;
    return node ? st.latestFor(code, node) : (st.listByCode(code)[0] || null);
  }
  function list(code, node) {
    var st = store();
    if (!st || !code) return [];
    return node ? st.listByTo(node, code) : st.listByCode(code);
  }
  function codeWithTag(code, node, innerHtml) {
    var rec = latest(code, node);
    var tag = rec ? tagHtml({ title: '从「' + rec.from + '」退回 · ' + rec.reason }) : '';
    return '<div class="ret-code-stack">' + innerHtml + tag + '</div>';
  }
  function detailTd(code, node) {
    var recs = list(code, node);
    if (!recs.length) {
      return '<td class="border border-slate-200 px-3 py-2.5 text-slate-400">—</td>';
    }
    return '<td class="border border-slate-200 px-3 py-2.5 whitespace-nowrap">' +
      '<button type="button" class="text-blue-600 hover:underline" data-ret-detail="' + esc(code) + '" data-ret-node="' + esc(node || '') + '">查看</button></td>';
  }
  function detailTh() {
    return '<th class="border border-slate-200 px-3 py-2 font-medium whitespace-nowrap">退回详情</th>';
  }

  function expandTimeline(returns) {
    var out = [];
    (returns || []).forEach(function (r) {
      var testers = r.testers;
      if (testers && testers.length) {
        testers.slice().sort(function (a, b) {
          return String(b.time || '').localeCompare(String(a.time || ''));
        }).forEach(function (t) {
          out.push({
            from: r.from,
            to: r.to,
            kind: r.kind,
            by: t.tester || r.by,
            time: t.time || r.time,
            reason: t.reason || r.reason,
            tester: t.tester || r.tester
          });
        });
      } else {
        out.push(r);
      }
    });
    return out;
  }

  function timelineHtml(returns) {
    returns = expandTimeline(returns);
    if (!returns.length) {
      return '<div class="ret-tl"><div class="text-xs text-slate-400">暂无退回记录</div></div>';
    }
    var total = returns.length;
    var items = returns.map(function (r, idx) {
      var n = total - idx;
      var kind = store() ? store().normKind(r.kind) : (r.kind || '人工');
      var isAi = kind === 'AI';
      var liCls = (idx === 0 ? 'is-latest ' : '') + (isAi ? 'is-ai' : '');
      var from = r.from || r.node || '';
      var chips = '<span class="ret-chip' + (idx === 0 ? ' is-latest' : '') + '">第 ' + n + ' 次</span> ' +
        (from ? '<span class="ret-chip">来源 ' + esc(from) + '</span> ' : '') +
        (r.tester ? '<span class="ret-chip">检测员 ' + esc(r.tester) + '</span> ' : '') +
        '<span class="ret-chip' + (isAi ? ' is-ai' : '') + '">' + esc(kind) + '</span>';
      return '<li class="' + liCls + '">' +
        '<div class="mb-1 flex flex-wrap items-center gap-1.5">' + chips + '</div>' +
        '<div class="text-sm leading-6 text-slate-800"><span class="text-slate-500">原因</span> · ' + esc(r.reason || '—') + '</div>' +
        '<div class="mt-0.5 text-xs text-slate-500">' +
        '<span>退回人 ' + esc(r.by || '—') + '</span>' +
        '<span class="mx-1.5 text-slate-300">·</span>' +
        '<span>' + esc(r.time || '') + '</span></div></li>';
    }).join('');
    return '<div class="ret-tl" data-annotate="compile-returns">' +
      '<div class="ret-tl-head">' +
      '<div class="text-sm font-medium text-slate-700">退回记录 <span class="font-normal text-slate-500">· 共 ' + total + ' 次</span></div></div>' +
      '<ul class="ret-timeline">' + items + '</ul></div>';
  }

  function detailBody(code, node) {
    var recs = list(code, node);
    if (!recs.length) return '<p class="px-6 py-8 text-center text-sm text-slate-400">暂无退回记录</p>';
    return '<div class="px-6 py-4">' + timelineHtml(recs) + '</div>';
  }

  function closeModal() {
    var el = document.getElementById('ret-modal');
    if (el) { el.classList.add('hidden'); el.innerHTML = ''; }
  }
  function modalShell() {
    var el = document.getElementById('ret-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ret-modal';
      el.className = 'ret-mask hidden';
      el.addEventListener('click', function (e) { if (e.target === el) closeModal(); });
      document.body.appendChild(el);
    }
    return el;
  }
  function openPanel(html) {
    ensureCss();
    var el = modalShell();
    el.innerHTML = '<div class="ret-panel">' + html + '</div>';
    el.classList.remove('hidden');
  }

  function openDetail(code, node) {
    openPanel(
      '<div class="flex items-center justify-between border-b border-slate-100 px-6 py-3">' +
      '<h3 class="text-base font-medium text-slate-800">退回详情 · ' + esc(code) + '</h3>' +
      '<button type="button" class="text-slate-400 hover:text-slate-600" id="ret-x"><i class="fa fa-times"></i></button></div>' +
      detailBody(code, node) +
      '<div class="flex justify-end border-t border-slate-100 px-6 py-3">' +
      '<button type="button" class="rounded border border-slate-300 px-4 py-1.5 text-sm" id="ret-close">关闭</button></div>'
    );
    document.getElementById('ret-x').onclick = closeModal;
    document.getElementById('ret-close').onclick = closeModal;
  }

  function openCollect(opts) {
    opts = opts || {};
    var from = opts.from || '';
    var to = opts.to || '';
    var code = opts.code || '';
    openPanel(
      '<div class="flex items-center justify-between border-b border-slate-100 px-6 py-3">' +
      '<h3 class="text-base font-medium text-slate-800">退回</h3>' +
      '<button type="button" class="text-slate-400 hover:text-slate-600" id="ret-x"><i class="fa fa-times"></i></button></div>' +
      '<div class="space-y-3 px-6 py-5 text-sm">' +
      (code ? '<p class="text-slate-600">确认退回委托 <b>' + esc(code) + '</b>？</p>' : '') +
      '<div class="flex items-center gap-3"><label class="w-20 text-right text-slate-600">退回节点</label>' +
      '<input readonly class="flex-1 rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600" value="' + esc(from) + ' → ' + esc(to) + '" /></div>' +
      '<div class="flex items-start gap-3"><label class="mt-2 w-20 text-right text-slate-600"><span class="text-red-500">*</span> 原因</label>' +
      '<textarea id="ret-reason" rows="4" placeholder="请输入退回原因" class="flex-1 rounded border border-slate-300 px-3 py-2 outline-none focus:border-blue-500"></textarea></div>' +
      '</div>' +
      '<div class="flex justify-end gap-2 border-t border-slate-100 px-6 py-3">' +
      '<button type="button" class="rounded border border-slate-300 px-4 py-1.5 text-sm" id="ret-cancel">取消</button>' +
      '<button type="button" class="rounded bg-blue-600 px-4 py-1.5 text-sm text-white" id="ret-ok">确认退回</button></div>'
    );
    document.getElementById('ret-x').onclick = closeModal;
    document.getElementById('ret-cancel').onclick = closeModal;
    document.getElementById('ret-ok').onclick = function () {
      var reason = (document.getElementById('ret-reason').value || '').trim();
      if (!reason) {
        var ta = document.getElementById('ret-reason');
        ta.focus();
        ta.classList.add('border-red-400');
        return;
      }
      var rec = {
        code: code, from: from, to: to, reason: reason, kind: opts.kind || '人工',
        testers: opts.testers, item: opts.item, tester: opts.tester, reportNo: opts.reportNo
      };
      if (opts.persist !== false && store()) rec = store().push(rec);
      closeModal();
      if (typeof opts.onOk === 'function') opts.onOk(rec, reason);
    };
    setTimeout(function () {
      var ta = document.getElementById('ret-reason');
      if (ta) ta.focus();
    }, 30);
  }

  function bannerHtml(node) {
    var st = store();
    if (!st || node !== '报告编制') return '';
    var recs = st.listByTo(node).filter(function (r) { return st.normKind(r.kind) === 'AI'; });
    if (!recs.length) return '';
    var grouped = [];
    var index = {};
    recs.forEach(function (r) {
      if (!index[r.code]) {
        index[r.code] = { code: r.code, recs: [] };
        grouped.push(index[r.code]);
      }
      index[r.code].recs.push(r);
    });
    return '<div class="ret-banner" data-ret-banner="' + esc(node) + '" data-annotate="ai-returned">' +
      '<div class="ret-banner-head"><i class="fa fa-bolt mr-1"></i>有 ' + grouped.length + ' 条委托存在 AI 自动退回</div>' +
      '<div class="ret-banner-body">' + grouped.map(function (g) {
        var items = g.recs.map(function (r) {
          var report = r.reportNo ? '<span class="ret-banner-report">' + esc(r.reportNo) + '</span>' : '<span class="ret-banner-report">' + esc(g.code) + '</span>';
          var handle = '<a class="ret-banner-go" href="report-compile-edit.html?entrust=' + encodeURIComponent(g.code) + '">去处理</a>';
          return '<div class="ret-banner-card is-ai">' +
            '<div class="ret-banner-card-head">' + report + aiPillHtml() +
            '<span class="ret-banner-meta">从「' + esc(r.from) + '」退回 · ' + esc(r.time) + '</span>' +
            handle + '</div>' +
            '<div class="ret-banner-reason">原因：' + esc(r.reason) + '</div></div>';
        }).join('');
        var nRep = g.recs.length;
        var count = nRep > 1 ? '<span class="ret-banner-count">' + nRep + ' 份 AI 自动退回</span>' : '';
        return '<div class="ret-banner-group">' +
          '<div class="ret-banner-code"><b>' + esc(g.code) + '</b>' + count + '</div>' +
          items + '</div>';
      }).join('') + '</div></div>';
  }
  function mountBanner(node, afterEl) {
    ensureCss();
    var old = document.querySelector('[data-ret-banner]');
    if (old) old.remove();
    var html = bannerHtml(node);
    if (!html) return;
    var host = afterEl;
    if (!host) {
      host = document.querySelector('.p-4 > .rounded.bg-white.p-4.shadow-sm');
    }
    if (!host) return;
    host.insertAdjacentHTML('afterend', html);
  }
  function stripHtml(code, node) {
    var recs = list(code, node);
    if (!recs.length) return '';
    return '<div class="ret-strip">' + timelineHtml(recs) + '</div>';
  }

  function itemMark(code, item) {
    var st = store();
    if (!st) return '';
    var recs = st.listByItem(code, item);
    if (!recs.length) return '';
    var r = recs[0];
    return tagHtml({ title: r.reason }) + warnIcon(r.reason + '（' + r.by + ' · ' + r.time + '）');
  }
  function testerMeta(code, item, fallbackTester, fallbackTime) {
    var st = store();
    var rec = st ? (st.listByItem(code, item)[0] || st.latestFor(code, '试验检测')) : null;
    var tester = (rec && rec.tester) || fallbackTester || '潘哲宁';
    var time = (rec && rec.detectTime) || fallbackTime || '2026-11-12 15:40';
    return '<span class="whitespace-nowrap">检测员 ' + esc(tester) + '</span>' +
      '<span class="mx-2 text-slate-300">|</span>' +
      '<span class="whitespace-nowrap">检测时间 ' + esc(time) + '</span>';
  }

  function logLine(log) {
    var isRet = log.tone === 'danger' || /退回/.test(log.text || '');
    var reason = log.reason || '';
    var text = log.text || '';
    if (isRet && reason && text.indexOf(reason) >= 0) {
      text = text.replace('：' + reason, '').replace(reason, '').replace(/[：:]\s*$/, '');
    }
    var extra = (isRet && reason) ? '<div class="ret-log-reason">退回原因：' + esc(reason) + '</div>' : '';
    return { text: text, extra: extra, isRet: isRet };
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-ret-detail]');
    if (!btn) return;
    e.preventDefault();
    openDetail(btn.getAttribute('data-ret-detail'), btn.getAttribute('data-ret-node') || '');
  });

  ensureCss();
  bindWarnTips();

  global.ReturnUI = {
    tagHtml: tagHtml,
    aiPillHtml: aiPillHtml,
    warnIcon: warnIcon,
    codeWithTag: codeWithTag,
    detailTd: detailTd,
    detailTh: detailTh,
    timelineHtml: timelineHtml,
    openDetail: openDetail,
    openCollect: openCollect,
    closeModal: closeModal,
    mountBanner: mountBanner,
    bannerHtml: bannerHtml,
    stripHtml: stripHtml,
    itemMark: itemMark,
    testerMeta: testerMeta,
    logLine: logLine,
    latest: latest,
    list: list
  };
})(window);
