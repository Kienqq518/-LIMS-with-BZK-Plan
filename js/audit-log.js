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
      if (!ta && tb) return 1;
      if (ta && !tb) return -1;
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
        var back = /退回/.test(textOf(log));
        if (back) out.push({ hop: true, from: lastNode, to: to, at: timeOf(log), back: true });
        lastNode = to;
        return;
      }
      out.push(log);
      if (nodeOf(log)) lastNode = nodeOf(log);
    });
    return out;
  }

  var NEXT = {
    '报告生成': '报告编制',
    '报告编制': '报告审核',
    'AI审核': '报告审核',
    '报告审核': '报告签发',
    '报告签发': '报告处理',
    '报告处理': '收费审批',
    '收费审批': '报告发放',
    '报告发放': '任务归档',
    '任务归档': '任务完成',
    '任务完成': '任务完成'
  };

  function isCurrentMarker(log) {
    if (!log || log.hop) return false;
    if (log.current || log.pending) return true;
    var tone = log.tone || '';
    return tone === 'pending' && /等待|当前节点|编制中|审批中|审核中|排队|正在/.test(textOf(log));
  }

  function isAiLog(log) {
    if (!log || log.hop) return false;
    var who = actorOf(log);
    var node = nodeOf(log);
    var t = textOf(log) + String(log.opinionKicker || '');
    if (node === 'AI审核' || node.indexOf('AI') === 0) return true;
    if (/AI/.test(who)) return true;
    if (/预审结论|重审结论|预审通过|预审不通过/.test(t)) return true;
    return false;
  }

  function returnTarget(log) {
    if (!log) return '';
    if (log.hop && log.back) return log.to || '';
    var t = textOf(log) + ' ' + String(log.opinionKicker || '') + ' ' + String(log.target || '');
    var matched = t.match(/(?:退回至|自动退回至|自动退回|退回)\s*([^\s，,。；;（(]+)/);
    if (matched) return matched[1].replace(/节点$/, '').trim();
    if (/签发退回/.test(t)) return '报告审核';
    return log.target ? String(log.target) : '';
  }

  function isReturnLog(log) {
    if (!log || log.hop || isCurrentMarker(log)) return false;
    var t = textOf(log) + String(log.opinionKicker || '');
    if (isAiLog(log) && !/退回/.test(t)) return false;
    if (/退回至|自动退回|审批拒绝|签发退回|退回/.test(t)) return true;
    var tone = log.tone || log.statusTone || '';
    return (tone === 'danger' || tone === 'reject') && /退回|拒绝/.test(t);
  }

  function generationText() {
    return '报告生成';
  }

  function aiFace(log) {
    var t = textOf(log) + String(log.opinionKicker || '');
    if (/不通过|自动退回/.test(t) && !/需复核|需人工|待人工/.test(t)) {
      return { kind: 'reject', text: '不通过', icon: 'fa-minus-circle', rail: 'reject', statusTone: 'reject' };
    }
    if (/通过/.test(t) && !/不通过/.test(t)) {
      return { kind: 'forward', text: '通过', icon: 'fa-check-circle', rail: 'pass', statusTone: 'pass' };
    }
    if (/需复核|需人工|待人工|人工核查/.test(t)) {
      return { kind: 'warn', text: '待人工核查', icon: 'fa-exclamation-circle', rail: 'pass', statusTone: 'warn' };
    }
    if (/异常|超时/.test(t)) {
      return { kind: 'reject', text: '审核异常', icon: 'fa-times-circle', rail: 'reject', statusTone: 'reject' };
    }
    return null;
  }

  function forwardDest(log) {
    var t = textOf(log);
    var matched = t.match(/(?:提交至|再次提交至)\s*([^，,。；;（(\s]+)/);
    if (matched) return matched[1].replace(/节点$/, '').trim();
    if (/预审|需人工复核/.test(t)) return '报告审核';
    if (/生成报告/.test(t) || nodeOf(log) === '报告生成') return '报告编制';
    if (/已发放/.test(t)) return '任务归档';
    return NEXT[nodeOf(log)] || '';
  }

  function face(log) {
    if (isCurrentMarker(log)) return { kind: 'current', text: '当前节点', icon: 'fa-circle-o', rail: 'pending', statusTone: 'pending' };
    if (isAiLog(log)) {
      var ai = aiFace(log);
      if (ai) return ai;
    }
    var t = textOf(log);
    if ((nodeOf(log) === '报告生成' || /生成报告/.test(t)) && !isReturnLog(log)) {
      return { kind: 'forward', text: generationText(log), icon: 'fa-check-circle', rail: 'pass', statusTone: 'pass' };
    }
    if (isReturnLog(log) || (/异常|超时/.test(t) && !/预审/.test(t))) {
      return { kind: 'reject', text: '审批拒绝', icon: 'fa-minus-circle', rail: 'reject', statusTone: 'reject' };
    }
    var dest = forwardDest(log);
    return {
      kind: 'forward',
      text: dest ? ('推进到' + dest + '节点') : '推进到下一节点',
      icon: 'fa-check-circle',
      rail: 'pass',
      statusTone: 'pass'
    };
  }

  function sameReport(a, b) {
    var ra = a && (a.reportNo || a.reportId || '');
    var rb = b && (b.reportNo || b.reportId || '');
    if (!ra || !rb) return true;
    return String(ra) === String(rb);
  }

  function edgeIsReturn(newer, older) {
    if (!newer || !older) return false;
    if (newer.hop && newer.back) return true;
    if (older.hop && older.back) {
      var dest = older.to || '';
      return !!(newer.current || nodeOf(newer) === dest);
    }
    if (!older.hop && isReturnLog(older)) {
      var target = returnTarget(older);
      return !!(target && nodeOf(newer) === target);
    }
    return false;
  }

  function markRails(list, order) {
    var desc = order === 'desc';
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (!item) continue;
      item.returnedHere = false;
      var below = list[i + 1];
      if (!below || !sameReport(item, below)) { item.returnRail = false; continue; }
      var newer = desc ? item : below;
      var older = desc ? below : item;
      item.returnRail = edgeIsReturn(newer, older);
    }
  }

  function chrono(logs) {
    var indexed = logs.map(function (log, i) { return { log: log, i: i }; });
    indexed.sort(function (a, b) {
      var ta = timeOf(a.log);
      var tb = timeOf(b.log);
      if (!ta && tb) return 1;
      if (ta && !tb) return -1;
      if (ta === tb) return a.i - b.i;
      return ta < tb ? -1 : 1;
    });
    return indexed.map(function (row) { return row.log; });
  }

  function present(logs, order, currentNode) {
    var list = logs || [];
    var place = arguments.length >= 3 && currentNode != null && currentNode !== '';
    var source = place ? list.filter(function (log) { return !isCurrentMarker(log); }) : list;
    var hasPush = false;
    for (var i = 0; i < source.length; i++) {
      if (isPush(source[i])) { hasPush = true; break; }
    }
    var folded = (hasPush || place) ? (hasPush ? foldChrono(source) : chrono(source)) : source.slice();
    if (place) {
      folded.push({
        current: true, pending: true, hop: false,
        node: currentNode, by: '', actor: '',
        text: '当前节点', status: '当前节点',
        tone: 'pending', statusTone: 'pending', at: '', time: ''
      });
    }
    if ((hasPush || place) && order === 'desc') folded.reverse();
    markRails(folded, order);
    return folded;
  }

  function avatarColor(name) {
    if (!name) return '#94a3b8';
    if (name.indexOf('AI') === 0 || name === '系统') return '#6366f1';
    var palette = ['#fb923c', '#38bdf8', '#34d399', '#a78bfa', '#f472b6', '#3b82f6', '#f59e0b', '#14b8a6'];
    var n = 0;
    for (var i = 0; i < name.length; i++) n = (n * 33 + name.charCodeAt(i)) >>> 0;
    return palette[n % palette.length];
  }

  function avatarMark(name) {
    if (!name) return '';
    if (name.indexOf('AI') === 0 || name === '系统') return '<i class="fa fa-bolt"></i>';
    var ch = String(name).replace(/\./g, '').charAt(0) || '';
    if (ch && ch.charCodeAt(0) < 128) ch = ch.toUpperCase();
    return esc(ch);
  }

  function pickReason(log) {
    if (!log) return '';
    if (log.reason) return String(log.reason).trim();
    var opinion = String(log.opinion || '').trim();
    var blob = textOf(log) + String(log.opinionKicker || '');
    if (opinion && /退回|审批拒绝|签发退回|自动退回|拒绝/.test(blob)) return opinion;
    var matched = textOf(log).match(/原因\s*[:：]\s*([^。；;]+)/);
    return matched && matched[1] ? matched[1].trim() : '';
  }

  function reasonHtml(log) {
    if (!log || log.hop || isCurrentMarker(log)) return '';
    var reason = pickReason(log);
    if (reason && face(log).text === '审批拒绝') return '<div class="ret-log-reason">退回原因：' + esc(reason) + '</div>';
    var note = log.opinion || '';
    if (!note && /命中|仍剩|不通过|异常|超时|不一致/.test(textOf(log))) note = textOf(log);
    if (!note) return '';
    if (face(log).kind === 'forward' && note === textOf(log)) return '';
    return '<div class="audit-opinion"><div class="audit-opinion-text">' + esc(note) + '</div></div>';
  }

  function itemHtml(log, opts) {
    opts = opts || {};
    if (log && log.hop) return hopHtml(log);
    var view = face(log || {});
    var node = nodeOf(log) || '操作记录';
    var no = opts.no ? '<span class="audit-no">' + esc(opts.no) + '</span>' : '';
    if (view.kind === 'current') {
      return '<li class="audit-tl-item is-pending' + (log && log.returnRail ? ' is-return-rail' : '') + '" data-current="1">' +
        '<div class="audit-rail" aria-hidden="true"><span class="audit-dot"></span></div>' +
        '<div class="audit-main"><div class="audit-head"><div class="audit-title"><span>' + esc(node) + '</span>' + no + '</div>' +
        '<span class="audit-status is-pending"><i class="fa fa-circle-o" aria-hidden="true"></i>当前节点</span></div></div></li>';
    }
    var who = actorOf(log);
    var person = who
      ? '<span class="audit-person"><span class="audit-avatar" style="background:' + avatarColor(who) + '">' + avatarMark(who) + '</span>' + esc(who) + '</span>'
      : '<span></span>';
    var at = timeOf(log);
    if (at && at.length === 16) at += ':00';
    var statusTone = view.statusTone || (view.kind === 'reject' ? 'reject' : 'pass');
    var toneClass = view.rail === 'reject' || view.kind === 'reject' ? 'is-reject' : 'is-pass';
    if (log && log.returnRail) toneClass += ' is-return-rail';
    var status = '<span class="audit-status is-' + statusTone + '"><i class="fa ' + view.icon + '" aria-hidden="true"></i>' + esc(view.text) + '</span>';
    return '<li class="audit-tl-item ' + toneClass + '">' +
      '<div class="audit-rail" aria-hidden="true"><span class="audit-dot"></span></div>' +
      '<div class="audit-main">' +
        '<div class="audit-head"><div class="audit-title"><span>' + esc(node) + '</span>' + no + '</div>' +
        (at ? '<time class="audit-time">' + esc(at) + '</time>' : '') + '</div>' +
        '<div class="audit-row">' + person + status + '</div>' +
        reasonHtml(log) +
      '</div></li>';
  }

  function currentNodeForReview(rep) {
    if (!rep) return '报告审核';
    if (rep.aiRun === 'running' || rep.aiRun === 'error') return 'AI审核';
    if (rep.state === '自动退回编制') return '报告编制';
    if (rep.state === '签发退回待复核') return '报告审核';
    if (rep.signOff && rep.signOff.returned && !rep.disposition) return '报告审核';
    if (rep.disposition && /通过/.test(String(rep.disposition.final || ''))) return '报告签发';
    return '报告审核';
  }

  function hopHtml(item) {
    var from = item.from || '';
    var to = item.to || '';
    var label = from ? ('从' + from + '退回至' + to) : ('退回至' + to);
    var at = timeOf(item);
    if (at && at.length === 16) at += ':00';
    return '<li class="audit-hop is-return" data-audit-hop="' + esc(from) + '→' + esc(to) + '">' +
      '<div class="audit-rail" aria-hidden="true"></div>' +
      '<div class="audit-main">' +
        '<div class="audit-head"><span></span>' + (at ? '<time class="audit-time">' + esc(at) + '</time>' : '') + '</div>' +
        '<div class="audit-row"><span></span><span class="audit-status is-reject">' + esc(label) + '</span></div>' +
      '</div></li>';
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
    var css = [
      '.audit-tl{list-style:none;margin:0;padding:2px 2px 0 0}',
      '.audit-tl-item{display:grid;grid-template-columns:20px minmax(0,1fr);column-gap:12px}',
      '.audit-rail{position:relative}',
      '.audit-rail::after{content:"";position:absolute;left:50%;top:18px;bottom:0;width:2px;transform:translateX(-50%);background:var(--audit-rail,var(--rail,#3b82f6))}',
      '.audit-tl-item:last-child .audit-rail::after,.audit-hop:last-child .audit-rail::after{display:none}',
      '.audit-dot{position:relative;z-index:1;display:block;width:16px;height:16px;margin:2px auto 0;box-sizing:border-box;border-radius:999px;border:2px solid var(--audit-dot,var(--dot,#94a3b8));background:var(--audit-dot,var(--dot,#94a3b8))}',
      '.audit-main{min-width:0;padding:0 0 16px}',
      '.audit-tl-item:last-child .audit-main{padding-bottom:2px}',
      '.audit-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}',
      '.audit-title{font-size:14px;font-weight:500;color:#1e293b}',
      '.audit-time{flex-shrink:0;font-size:12px;color:#94a3b8}',
      '.audit-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:6px}',
      '.audit-person{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:#334155}',
      '.audit-avatar{display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:999px;color:#fff;font-size:11px}',
      '.audit-status{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:500}',
      '.audit-status.is-pass{color:#16a34a}',
      '.audit-status.is-warn{color:#d97706}',
      '.audit-status.is-reject{color:#dc2626}',
      '.audit-status.is-pending{color:#d97706}',
      '.audit-tl-item{--audit-rail:#3b82f6;--rail:#3b82f6}',
      '.audit-tl-item.is-pass{--audit-rail:#3b82f6;--audit-dot:#3b82f6;--rail:#3b82f6;--dot:#3b82f6}',
      '.audit-tl-item.is-reject{--audit-rail:#3b82f6;--audit-dot:#ef4444;--rail:#3b82f6;--dot:#ef4444}',
      '.audit-tl-item.is-pending{--audit-rail:#3b82f6;--audit-dot:#f59e0b;--rail:#3b82f6;--dot:#f59e0b}',
      '.audit-tl-item.is-return-rail{--audit-rail:#ef4444;--rail:#ef4444}',
      '.audit-tl-item.is-pending.is-return-rail{--audit-rail:#ef4444;--audit-dot:#f59e0b;--rail:#ef4444;--dot:#f59e0b}',
      '.audit-tl-item.is-pending .audit-dot,.audit-tl-item.is-pending.is-return-rail .audit-dot{background:#fff}',
      '.ret-log-reason{margin-top:8px;padding:8px 12px;border-radius:8px;background:#fef2f2;color:#991b1b;font-size:12px;line-height:1.55}',
      '.audit-opinion{margin-top:8px;border-radius:8px;background:#f8fafc;border:1px solid #eef2f7;padding:8px 12px}',
      '.audit-opinion-text{font-size:13px;line-height:1.55;color:#4b5563}'
    ].join('') + scopes.map(function (s) {
      return [
        s.scope + '.audit-hop{display:grid;grid-template-columns:' + s.col + ' minmax(0,1fr);column-gap:' + s.gap + ';align-items:stretch}',
        s.scope + '.audit-hop .audit-rail{position:relative}',
        s.scope + '.audit-hop .audit-rail::after{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;transform:translateX(-50%);background:#ef4444}',
        s.scope + '.audit-hop:last-child .audit-rail::after{display:none}',
        s.scope + '.audit-tl-item.is-reject{--audit-rail:#3b82f6;--audit-dot:#ef4444;--rail:#3b82f6;--dot:#ef4444}',
        s.scope + '.audit-tl-item.is-pending{--audit-rail:#3b82f6;--audit-dot:#f59e0b;--rail:#3b82f6;--dot:#f59e0b}',
        s.scope + '.audit-tl-item.is-return-rail{--audit-rail:#ef4444;--rail:#ef4444}',
        s.scope + '.audit-tl-item.is-pending.is-return-rail{--audit-rail:#ef4444;--audit-dot:#f59e0b;--rail:#ef4444;--dot:#f59e0b}'
      ].join('');
    }).join('');
    var style = document.createElement('style');
    style.id = 'audit-hop-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  injectCss();
  global.AuditLog = {
    present: present,
    hopHtml: hopHtml,
    itemHtml: itemHtml,
    face: face,
    isPush: isPush,
    isReturnLog: isReturnLog,
    currentNodeForReview: currentNodeForReview
  };
})(typeof window !== 'undefined' ? window : globalThis);
