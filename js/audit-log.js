/**
 * 操作日志：系统在节点之间的自动推进不单独占一个点，
 * 只在相邻真实节点之间标出「从哪一节点到哪一节点」。
 * AI 预审、报告生成、当前「等待」仍是事件点。
 */
(function (global) {
  function actorOf(log) { return String((log && (log.by || log.actor)) || ''); }
  function textOf(log) { return String((log && (log.text || log.status)) || ''); }
  function timeOf(log) { return String((log && (log.at || log.time)) || ''); }
  function nodeOf(log) { return String((log && log.node) || ''); }

  function isPush(log) {
    if (!log || log.hop) return false;
    if (actorOf(log) !== '系统') return false;
    var text = textOf(log);
    if (!text) return false;
    if (/预审|生成报告|正在|等待|排队|已发放|异常|超时|任务完成/.test(text)) return false;
    return /提交至|退回至|自动退回/.test(text);
  }

  function destOf(log) {
    var text = textOf(log);
    var matched = text.match(/(?:提交至|退回至|自动退回)\s*([^，,。；;（(]+)/);
    return ((matched && matched[1]) || nodeOf(log)).trim();
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function foldChrono(logs) {
    var indexed = logs.map(function (log, i) { return { log: log, i: i }; });
    indexed.sort(function (a, b) {
      var ta = timeOf(a.log);
      var tb = timeOf(b.log);
      if (ta === tb) return a.i - b.i;
      return ta < tb ? -1 : 1;
    });
    var out = [];
    var lastNode = '';
    indexed.forEach(function (row) {
      var log = row.log;
      if (isPush(log)) {
        var to = destOf(log);
        if (!to || to === lastNode) return;
        out.push({ hop: true, from: lastNode, to: to, at: timeOf(log) });
        lastNode = to;
        return;
      }
      out.push(log);
      if (nodeOf(log)) lastNode = nodeOf(log);
    });
    return out;
  }

  function present(logs, order) {
    var list = logs || [];
    var found = false;
    for (var i = 0; i < list.length; i++) {
      if (isPush(list[i])) { found = true; break; }
    }
    if (!found) return list.slice();
    var folded = foldChrono(list);
    if (order === 'desc') folded.reverse();
    return folded;
  }

  function hopHtml(item) {
    var from = item.from || '';
    var to = item.to || '';
    var label = from ? ('从' + esc(from) + '推进至' + esc(to)) : ('推进至' + esc(to));
    return '<li class="audit-hop" data-audit-hop="' + esc(from) + '→' + esc(to) + '">' +
      '<div class="audit-rail" aria-hidden="true"></div>' +
      '<div class="audit-hop-label">' + label + '</div></li>';
  }

  function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('audit-hop-css')) return;
    var scopes = [
      { scope: '', col: '18px', gap: '12px' },
      { scope: '#rvRecordDrawer ', col: '20px', gap: '12px' },
      { scope: '#flowRecordDrawer ', col: '20px', gap: '12px' },
      { scope: '#reportRecordModal ', col: '20px', gap: '14px' },
      { scope: '#wbRecordDrawer ', col: '20px', gap: '12px' }
    ];
    var css = scopes.map(function (s) {
      return [
        s.scope + '.audit-hop{display:grid;grid-template-columns:' + s.col + ' minmax(0,1fr);column-gap:' + s.gap + ';align-items:stretch}',
        s.scope + '.audit-hop .audit-rail{position:relative;min-height:22px}',
        s.scope + '.audit-hop .audit-rail::after{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;transform:translateX(-50%);background:#cbd5e1}',
        s.scope + '.audit-hop:last-child .audit-rail::after{display:none}',
        s.scope + '.audit-hop-label{padding:2px 0 12px;font-size:12px;line-height:1.45;color:#64748b}'
      ].join('');
    }).join('');
    var style = document.createElement('style');
    style.id = 'audit-hop-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  injectCss();
  global.AuditLog = { present: present, hopHtml: hopHtml, isPush: isPush };
})(typeof window !== 'undefined' ? window : globalThis);
