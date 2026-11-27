/**
 * 任务级协作与共享（invite 思路）
 *
 * 两层权限取交集：
 *   RBAC（TestOS 角色）= 你能不能做这类事
 *   任务邀请（这里）    = 在这一个任务里你是什么身份
 * 只在同租户内共享：私有化部署与云部署都不做跨租户，外部链接不在本版范围。
 */
(function (global) {
  'use strict';
  var KEY = 'lims.wb.share.v1';
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var ROLE = {
    owner:    { ti: '负责人', d: '全部动作 · 可邀请、转交、入库、回滚' },
    editor:   { ti: '拆解执行', d: '传料、答问题、改稿件 · 入库需单独授予' },
    reviewer: { ti: '校稿专家', d: '答问题、批注、定稿 · 不改稿件单元格' },
    viewer:   { ti: '只读', d: '查看与下载' }
  };
  /* 动作 → 允许的角色。入库/授权/回滚只给负责人，其他人靠 canImport 单独授予 */
  var ACT = {
    'task.create': ['owner', 'editor'],
    'file.upload': ['owner', 'editor', 'reviewer'],
    'q.answer': ['owner', 'editor', 'reviewer'],
    'q.skip': ['owner', 'editor'],
    'cell.edit': ['owner', 'editor'],
    'finalize': ['owner', 'reviewer'],
    'import': ['owner'],
    'import.auth': ['owner'],
    'rollback': ['owner'],
    'share.manage': ['owner'],
    'asset.push': ['owner']
  };
  var USERS = [
    { id: 'u_li', nm: '李工', ini: '李', dept: '我方 · 实施工程师', tenant: 'ours' },
    { id: 'u_zhang', nm: '张工', ini: '张', dept: '迈特诺 · 业务专家', tenant: 'cust' },
    { id: 'u_wang', nm: '王工', ini: '王', dept: '迈特诺 · 检测员', tenant: 'cust' },
    { id: 'u_chen', nm: '陈主任', ini: '陈', dept: '迈特诺 · 实验室主任', tenant: 'cust' }
  ];
  var SEED = {
    me: 'u_li',
    tasks: {
      0: { members: [{ id: 'u_li', role: 'owner', canImport: 1 },
                     { id: 'u_zhang', role: 'reviewer', canImport: 1 },
                     { id: 'u_wang', role: 'editor', canImport: 0 }],
           assign: { Q001: 'u_wang', Q002: 'u_wang', Q024: 'u_zhang' }, req: [] },
      1: { members: [{ id: 'u_li', role: 'owner', canImport: 1 }, { id: 'u_zhang', role: 'viewer', canImport: 0 }],
           assign: {}, req: [] },
      2: { members: [{ id: 'u_zhang', role: 'owner', canImport: 1 }, { id: 'u_li', role: 'editor', canImport: 0 }],
           assign: {}, req: [] }
    }
  };
  var D = load();
  var FIL = '';                       // 收件箱筛选：'' 全部 | '__none__' 未指派 | 成员 id
  function load() {
    try { var r = localStorage.getItem(KEY); if (r) { var d = JSON.parse(r); if (d && d.tasks) return d; } } catch (e) { }
    return JSON.parse(JSON.stringify(SEED));
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) { } }
  function tk() {
    var i = global.TS ? TS.idx() : 0;
    if (!D.tasks[i]) D.tasks[i] = { members: [{ id: D.me, role: 'owner', canImport: 1 }], assign: {}, req: [] };
    return D.tasks[i];
  }
  function user(id) { return USERS.filter(function (u) { return u.id === id; })[0] || { id: id, nm: id, ini: '?' }; }
  function mem(id) { return tk().members.filter(function (m) { return m.id === id; })[0]; }
  function userRole(id) { var m = mem(id); return m ? m.role : 'viewer'; }
  function S_ans(qid) { var st = global.WB && WB.state ? WB.state() : {}; return !!st[qid]; }
  function myRole() { var m = mem(D.me); return m ? m.role : 'viewer'; }

  var SH = {
    users: USERS, ROLE: ROLE,
    me: function () { return D.me; },
    who: function () { return user(D.me); },
    members: function () { return tk().members; },

    /* 权限判定：角色 ∩ 单独授予。不给布尔，给"为什么不行"，UI 才能解释 */
    can: function (act) {
      var m = mem(D.me); if (!m) return false;
      if ((ACT[act] || []).indexOf(m.role) >= 0) return true;
      if ((act === 'import' || act === 'import.auth') && m.canImport) return true;
      return false;
    },
    why: function (act) {
      var r = myRole();
      if (act === 'import' || act === 'import.auth') return '当前身份「' + ROLE[r].ti + '」无入库权，可向负责人申请';
      if (act === 'cell.edit') return '「' + ROLE[r].ti + '」不改稿件单元格，需要改动请批注或让执行角色处理';
      if (act === 'finalize') return '定稿由负责人或校稿专家操作';
      if (act === 'share.manage') return '只有负责人能管理成员';
      return '当前身份没有该权限';
    },
    switchMe: function (id) {
      D.me = id; save();
      if (global.TS) TS.render(); else paint();
      if (global.WB) { WB.paintChatNow(); WB.renderF3(); }
    },

    invite: function (id, role, canImport) {
      var t = tk();
      if (mem(id)) { SH.setRole(id, role, canImport); return; }
      t.members.push({ id: id, role: role || 'editor', canImport: canImport ? 1 : 0 });
      save(); paint();
      if (global.WB) WB.say('sys', '系统', '已邀请 <b>' + esc(user(id).nm) + '</b>（同租户内）加入本任务，身份 <b>' +
        ROLE[role || 'editor'].ti + '</b>' + (canImport ? ' · 含入库权' : '') + '。' +
        '<span class="tg">TA 的待办与留痕按任务隔离</span>');
    },
    setRole: function (id, role) {
      var m = mem(id); if (m) { m.role = role; if (role === 'owner') m.canImport = 1; }
      save(); paint();
    },
    setImport: function (id, v) { var m = mem(id); if (m) m.canImport = v ? 1 : 0; save(); paint(); },
    remove: function (id) {
      var t = tk();
      t.members = t.members.filter(function (m) { return m.id !== id; });
      Object.keys(t.assign).forEach(function (k) { if (t.assign[k] === id) delete t.assign[k]; });
      save(); paint();
    },
    handover: function (id) {
      var t = tk(), old = mem(D.me);
      if (old) old.role = 'editor';
      var m = mem(id); if (m) m.role = 'owner', m.canImport = 1;
      save(); paint();
    },
    assign: function (qid, uid) {
      var t = tk(), q = global.WB && WB.raw ? WB.raw(qid) : null;
      if (uid) t.assign[qid] = uid; else delete t.assign[qid];
      save();
      if (global.WB && WB.refreshInbox) WB.refreshInbox();
      if (global.WB && q) {
        var txt = uid === D.me
          ? '已挂到<b>你名下</b>，收件箱顶部可以用「只看指派给我的」筛出来。'
          : (uid ? '已把这条指派给 <b>' + esc(user(uid).nm) + '</b>（' + ROLE[userRole(uid)].ti + '），' +
            'TA 的任务列表会出现「待我 N」。' : '已取消这条的指派，回到谁都能处置。');
        txt += '<span class="tg">' + esc((q.q || '').slice(0, 22)) + '…</span>';
        WB.say('sys', '系统', txt);
      }
      if (global.TS) TS.render();
    },
    /* 收件箱顶部：按人分堆 + 只看我的 */
    bar: function () {
      if (!global.WB || !WB.raws) return '';
      var t = tk(), all = WB.raws(), by = {};
      all.forEach(function (q) { if (!S_ans(q.id)) { var u = t.assign[q.id] || ''; by[u] = (by[u] || 0) + 1; } });
      var chips = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (k) {
        var nm = k ? user(k).nm : '未指派';
        return '<span class="pg-chip' + (FIL === k ? ' on' : '') + '" onclick="SH.filter(\'' + k + '\')">' +
          (k ? '<i class="av sm">' + esc(user(k).ini) + '</i>' : '') + esc(nm) + '<b>' + by[k] + '</b></span>';
      }).join('');
      var mine = by[D.me] || 0;
      var on = FIL === D.me;
      return '<div class="pg-bar">' + chips +
        '<span class="pg-end' + (on ? ' on' : '') + '" onclick="SH.filter(\'' + D.me + '\')" ' +
        'title="只看待处置且挂在你名下的问题">' +
        '<i class="fa fa-' + (on ? 'times' : 'filter') + '"></i>' +
        (on ? '看全部待处置 ' + all.length + ' 条' : '只看指派给我的 ' + mine + ' 条') + '</span>';
    },
    filter: function (k) { FIL = (FIL === k ? '' : k); if (global.WB) WB.refreshInbox(); paint(); },
    filtering: function () { return FIL; },
    shown: function (id) {
      if (!FIL) return true;
      var t = tk();
      if (FIL === '__none__') return !t.assign[id];
      return t.assign[id] === FIL;
    },
    assignedToMe: function () { return SH.todo(global.TS ? TS.idx() : 0); },
    todo: function (i) {
      var t = D.tasks[i] || { assign: {} }, n = 0;
      Object.keys(t.assign).forEach(function (k) { if (t.assign[k] === D.me && !S_ans(k)) n++; });
      return n;
    },
    /* 无入库权的人点入库 → 发申请，不静默失败 */
    askImport: function () {
      var t = tk(), ow = t.members.filter(function (m) { return m.role === 'owner'; })[0];
      t.req.push({ by: D.me, at: now(), to: ow ? ow.id : '' });
      save(); paint();
      if (global.WB) WB.say('sys', '系统', '入库申请已发给 <b>' + esc(ow ? user(ow.id).nm : '负责人') +
        '</b>。审批通过后我会把 F3 打开给你，写操作计划不变。');
    },
    approve: function (k) {
      var t = tk(), r = t.req[k]; if (!r) return;
      var m = mem(r.by); if (m) m.canImport = 1;
      t.req.splice(k, 1); save(); paint();
      if (global.WB) WB.say('sys', '系统', '已授予 <b>' + esc(user(r.by).nm) + '</b> 本任务入库权（只对本任务生效）。');
    },
    deny: function (k) { var t = tk(); t.req.splice(k, 1); save(); paint(); },
    reqs: function () { return tk().req; },

    /* 问题卡上的「指派给」浮层 */
    assignUI: function (qid, ev) {
      if (ev) { ev.stopPropagation(); ev.preventDefault(); }
      var old = document.getElementById('shAssign'); if (old) old.remove();
      if (!SH.can('share.manage') && !SH.can('q.answer')) return;
      var box = document.createElement('div');
      box.id = 'shAssign'; box.className = 'sh-menu';
      var t = tk(), cur = t.assign[qid], load = {};
      if (global.WB && WB.raws) WB.raws().forEach(function (q) {
        if (S_ans(q.id)) return; var k = t.assign[q.id] || ''; load[k] = (load[k] || 0) + 1;
      });
      var rows = [{ id: '', nm: '不指派', ini: '', role: '', ic: 'fa-circle-o' }];
      if (!mem(D.me) || D.me !== cur) rows.push({ id: D.me, nm: '指派给我', ini: user(D.me).ini, role: '', ic: '' });
      t.members.forEach(function (m) {
        if (m.id === D.me) return;
        var u = user(m.id);
        rows.push({ id: m.id, nm: u.nm, ini: u.ini, role: ROLE[m.role].ti, ic: '' });
      });
      box.innerHTML = '<div class="shmt">指派这条问题</div>' + rows.map(function (r) {
        var on = (r.id || '') === (cur || '');
        return '<div class="shmi' + (on ? ' on' : '') + '" onclick="SH.assign(\'' + qid + '\',\'' + r.id + '\')">' +
          (r.ic ? '<i class="fa ' + r.ic + '"></i>' : '<span class="av sm">' + esc(r.ini) + '</span>') +
          esc(r.nm) + (r.role ? '<small>' + r.role + '</small>' : '') +
          (r.id && load[r.id] ? '<b class="ld">' + load[r.id] + ' 待处理</b>' : '') + '</div>';
      }).join('');
      var r = ev && ev.target ? ev.target.getBoundingClientRect() : { left: 300, bottom: 200 };
      box.style.left = Math.min(r.left, window.innerWidth - 210) + 'px';
      box.style.top = (r.bottom + 6) + 'px';
      document.body.appendChild(box);
      setTimeout(function () { document.addEventListener('click', function () {
        var e = document.getElementById('shAssign'); if (e) e.remove();
      }, { once: true }); }, 0);
    },
    who: function (qid) { var t = tk(); return t.assign[qid] ? user(t.assign[qid]).nm : ''; },
    mine: function (qid) { return tk().assign[qid] === D.me; },
    ini: function (qid) { var u = tk().assign[qid]; return u ? user(u).ini : ''; },
    open: function () { var m = document.getElementById('shMask'); if (m) m.classList.add('show'); panel(); },
    close: function () { var m = document.getElementById('shMask'); if (m) m.classList.remove('show'); },
    menu: function (i, ev) {
      if (ev) { ev.stopPropagation(); ev.preventDefault(); }
      var m = document.getElementById('shMenu');
      if (m && m.getAttribute('data-i') === String(i)) { m.remove(); return; }
      if (m) m.remove();
      var t = (global.TS ? TS.all()[i] : null) || {};
      var box = document.createElement('div');
      box.id = 'shMenu'; box.className = 'sh-menu';
      box.innerHTML = '<div class="shmi" onclick="SH.pick(' + i + ',1)"><i class="fa fa-user-plus"></i>邀请成员</div>' +
        '<div class="shmi" onclick="SH.pick(' + i + ',2)"><i class="fa fa-link"></i>复制任务链接</div>' +
        '<div class="shmi" onclick="SH.pick(' + i + ',3)"><i class="fa fa-exchange"></i>转交负责人</div>' +
        '<div class="shmi dim" onclick="SH.pick(' + i + ',4)"><i class="fa fa-inbox"></i>归档任务</div>';
      var r = ev && ev.target ? ev.target.getBoundingClientRect() : { left: 200, bottom: 120 };
      box.style.left = Math.min(r.left, window.innerWidth - 220) + 'px';
      box.style.top = (r.bottom + 6) + 'px';
      document.body.appendChild(box);
      setTimeout(function () { document.addEventListener('click', close, { once: true }); }, 0);
      function close() { var e = document.getElementById('shMenu'); if (e) e.remove(); }
    },
    pick: function (i, k) {
      var e = document.getElementById('shMenu'); if (e) e.remove();
      if (global.TS && TS.idx() !== i) TS.pick(i);
      if (k === 1 || k === 3) SH.open();
      if (k === 2 && global.WB) WB.say('sys', '系统', '任务链接已复制：<code>' +
        location.origin + location.pathname + '?task=' + i + '</code> · 同租户成员点开即进本任务。');
      if (k === 4 && global.WB) WB.say('sys', '系统', '归档不影响已入库数据，只从任务列表收起。');
    }
  };
  function now() {
    var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; };
    return z(d.getHours()) + ':' + z(d.getMinutes());
  }

  /* ── 顶栏：头像堆 + 邀请 + 身份切换（原型用） ── */
  function bar() {
    var el = document.getElementById('peerBar'); if (!el) return;
    var ms = SH.members();
    el.innerHTML = '<span class="peers">' + ms.slice(0, 4).map(function (m) {
      var u = user(m.id);
      return '<span class="peer' + (m.id === D.me ? ' me' : '') + (m.role === 'owner' ? ' own' : '') +
        '" title="' + esc(u.nm + ' · ' + ROLE[m.role].ti + (m.canImport ? ' · 可入库' : '')) + '">' + esc(u.ini) + '</span>';
    }).join('') + (ms.length > 4 ? '<span class="peer more">+' + (ms.length - 4) + '</span>' : '') + '</span>' +
      '<span class="shbtn" onclick="SH.open()"><i class="fa fa-user-plus"></i>邀请</span>' +
      '<select class="meSel" onchange="SH.switchMe(this.value)" title="原型：切换身份看权限差异">' +
      USERS.map(function (u) {
        return '<option value="' + u.id + '"' + (u.id === D.me ? ' selected' : '') + '>' + esc(u.nm) + '（' +
          esc(ROLE[myRole()].ti) + '）</option>';
      }).join('') + '</select>';
  }

  function panel() {
    var el = document.getElementById('shBody'); if (!el) return;
    var t = tk(), me = mem(D.me), isOwner = me && me.role === 'owner';
    var rows = t.members.map(function (m, i) {
      var u = user(m.id);
      return '<div class="shm"><span class="av">' + esc(u.ini) + '</span>' +
        '<span class="nm">' + esc(u.nm) + (m.id === D.me ? '<em>（你）</em>' : '') + '<small>' + esc(u.dept) + '</small></span>' +
        (isOwner && m.role !== 'owner'
          ? '<span class="rl"><select onchange="SH.setRole(\'' + m.id + '\',this.value)">' +
            Object.keys(ROLE).filter(function (k) { return k !== 'owner'; }).map(function (k) {
              return '<option value="' + k + '"' + (m.role === k ? ' selected' : '') + '>' + ROLE[k].ti + '</option>';
            }).join('') + '</select>' +
            '<label class="imp"><input type="checkbox" ' + (m.canImport ? 'checked' : '') +
            ' onchange="SH.setImport(\'' + m.id + '\',this.checked)" />可入库</label>' +
            '<span class="rm" onclick="SH.remove(\'' + m.id + '\')"><i class="fa fa-times"></i></span></span>'
          : '<span class="rl"><b>' + ROLE[m.role].ti + '</b>' + (m.canImport ? '<i class="ok">可入库</i>' : '') + '</span>');
    }).join('');
    var rest = USERS.filter(function (u) { return !mem(u.id); });
    var out = '<div class="shsec">本任务成员<span class="n">' + t.members.length + '</span></div>' + rows +
      (isOwner ? '<div class="shsec">邀请同租户成员</div>' +
        (rest.length ? rest.map(function (u) {
          return '<div class="shi"><span class="av">' + esc(u.ini) + '</span><span class="nm">' + esc(u.nm) +
            '<small>' + esc(u.dept) + '</small></span>' +
            '<button class="btn-outline xs" onclick="SH.invite(\'' + u.id + '\',\'editor\',0)">拆解执行</button>' +
            '<button class="btn-outline xs" onclick="SH.invite(\'' + u.id + '\',\'reviewer\',0)">校稿专家</button></div>';
        }).join('') : '<div class="shnone">同租户成员都已在任务里</div>') +
        '<div class="shnote"><i class="fa fa-info-circle"></i>私有化与云部署都只在同租户内共享，本版不做跨租户链接；' +
        '跨客户只共享标准库的元数据与拆解成果，不共享文件本体。</div>' : '') +
      (t.req.length ? '<div class="shsec">待你审批<span class="n">' + t.req.length + '</span></div>' +
        t.req.map(function (r, k) {
          return '<div class="shr"><span>' + esc(user(r.by).nm) + ' 申请本任务入库权</span><small>' + esc(r.at) + '</small>' +
            '<button class="btn-save xs" onclick="SH.approve(' + k + ')">同意</button>' +
            '<button class="btn-outline xs" onclick="SH.deny(' + k + ')">拒绝</button></div>';
        }).join('') : '') +
      (me && me.role === 'owner' ? '<div class="shsec">转交负责人</div>' +
        '<div class="shi">' + t.members.filter(function (m) { return m.role !== 'owner'; }).map(function (m) {
          return '<button class="btn-outline xs" onclick="SH.handover(\'' + m.id + '\')">转交给 ' + esc(user(m.id).nm) + '</button>';
        }).join('') + '</div>' : '');
    el.innerHTML = out;
    var h = document.getElementById('shTitle');
    if (h) h.innerHTML = (global.TS ? esc(TS.sel().code) : '本任务') + ' · 协作与权限' +
      '<span class="me">' + esc(user(D.me).nm) + ' · ' + ROLE[myRole()].ti + '</span>';
  }
  function paint() {
    bar();
    var m = document.getElementById('shMask');
    if (m && m.classList.contains('show')) panel();
  }

  /* 顶栏右侧挂载：邀请按钮与身份切换由 SH 自己渲染，避免动 HTML 结构 */
  SH.paint = paint;
  SH.panel = panel;
  global.SH = SH;
})(window);
