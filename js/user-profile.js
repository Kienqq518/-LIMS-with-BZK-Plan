/**
 * 顶栏「个人信息」气泡
 * 数据唯一来源：js/current-user.js 的 LimsCurrentUser.profile —— 顶栏头像、气泡里的昵称/账号/部门
 * 都读同一份，不会出现头像一个名字、气泡另一个名字。
 *
 * 外壳由 index.html 提供、画布内是它的克隆件，所以这里只认 class（.pa-user-chip），
 * 绑定状态用 WeakSet 记（克隆件是新对象，会重新绑一次，不会被外壳的标记骗过去）。
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'pa-user-style';
  var bound = new WeakSet();
  var pops = [];

  var CSS = [
    '.pa-user-wrap { position: relative; }',
    '.pa-user-chip { cursor: pointer; border: 0; background: none; padding: 2px; border-radius: 8px; }',
    '.pa-user-chip:hover { background: #f1f5f9; }',
    '.pa-user-pop {',
    '  position: absolute; right: 0; top: calc(100% + 12px); width: 486px; display: none; gap: 16px;',
    '  padding: 16px; border-radius: 14px; border: 1px solid #dbe4ff;',
    '  background: linear-gradient(135deg, #eef2ff 0%, #f6f9ff 42%, #eaf1ff 100%);',
    '  box-shadow: 0 16px 40px rgba(30, 41, 59, .18); z-index: 130; text-align: left; font-size: 13px; color: #334155; }',
    '.pa-user-pop.open { display: flex; }',
    '.pa-user-pop::before { content: ""; position: absolute; right: 18px; top: -6px; width: 12px; height: 12px;',
    '  background: #f0f4ff; border-left: 1px solid #dbe4ff; border-top: 1px solid #dbe4ff; transform: rotate(45deg); }',
    '.pa-user-left { width: 148px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; }',
    '.pa-user-avatar { width: 116px; height: 92px; border-radius: 10px; object-fit: cover; background: #fff;',
    '  border: 1px solid #e2e8f0; }',
    '.pa-user-name { margin-top: 8px; font-size: 17px; font-weight: 700; color: #0f172a; max-width: 148px;',
    '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.pa-user-kicker { margin-top: 6px; font-size: 12px; color: #64748b; }',
    '.pa-user-sign { margin-top: 4px; width: 116px; height: 62px; background: #fff; border: 1px solid #e2e8f0;',
    '  border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; }',
    '.pa-user-sign img { width: 100%; height: 100%; object-fit: contain; }',
    '.pa-user-right { flex: 1; min-width: 0; }',
    '.pa-user-row { display: flex; align-items: baseline; gap: 10px; padding: 5px 0; border-bottom: 1px dashed rgba(148,163,184,.22); }',
    '.pa-user-row:last-of-type { border-bottom: 0; }',
    '.pa-user-row span { width: 74px; flex-shrink: 0; text-align: right; color: #94a3b8; }',
    '.pa-user-row b { font-weight: 500; color: #1e293b; word-break: break-all; }',
    '.pa-user-logout { margin-top: 12px; width: 100%; border: 0; border-radius: 8px; background: #3b82f6;',
    '  color: #fff; font-size: 14px; padding: 9px 0; cursor: pointer; }',
    '.pa-user-logout:hover { background: #2563eb; }',
    '.pa-user-mask { position: fixed; inset: 0; z-index: 9998; display: none; align-items: center; justify-content: center;',
    '  background: rgba(15,23,42,.42); padding: 16px; }',
    '.pa-user-mask.open { display: flex; }',
    '.pa-user-confirm { width: 344px; max-width: 100%; background: #fff; border-radius: 10px; padding: 18px 20px;',
    '  box-shadow: 0 18px 44px rgba(15,23,42,.24); font-size: 13px; color: #334155; }',
    '.pa-user-confirm h4 { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 6px; }',
    '.pa-user-confirm p { line-height: 1.6; color: #64748b; }',
    '.pa-user-confirm .btns { margin-top: 16px; display: flex; justify-content: flex-end; gap: 8px; }',
    '.pa-user-confirm button { border-radius: 6px; padding: 6px 16px; font-size: 13px; cursor: pointer; border: 1px solid #cbd5e1; background: #fff; color: #475569; }',
    '.pa-user-confirm button.ok { background: #3b82f6; border-color: #3b82f6; color: #fff; }',
    '.pa-user-confirm button:hover { filter: brightness(.97); }'
  ].join('\n');

  function injectStyle() {
    var doc = global.document;
    if (doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    doc.head.appendChild(st);
  }

  function profile() {
    var u = global.LimsCurrentUser || {};
    var p = u.profile || {};
    function v(x) { return (x === undefined || x === null || x === '') ? '/' : String(x); }
    return {
      nickname: v(p.nickname || u.name), account: v(p.account || u.name), gender: v(p.gender),
      dept: v(p.dept || u.dept), phone: v(p.phone), email: v(p.email), createTime: v(p.createTime),
      avatar: p.avatar || '', avatarSmall: p.avatar || '', signature: p.signature || ''
    };
  }

  function fill(root) {
    var p = profile();
    [].slice.call(root.querySelectorAll('[data-up]')).forEach(function (el) {
      var k = el.getAttribute('data-up');
      if (k === 'logout') { el.addEventListener('click', askLogout); return; }
      if (k === 'label') { el.textContent = p.nickname === '/' ? '管理员' : p.nickname; return; }
      if (k === 'avatar' || k === 'avatarBig') { if (p.avatar) el.setAttribute('src', p.avatar); return; }
      if (k === 'signature') { if (p.signature) el.setAttribute('src', p.signature); return; }
      if (p[k] !== undefined) el.textContent = p[k];
    });
  }

  /* ---------------- 退出登录 ---------------- */
  var mask = null;
  function ensureMask(doc) {
    if (mask && mask.ownerDocument === doc) return mask;
    mask = doc.createElement('div');
    mask.className = 'pa-user-mask';
    mask.innerHTML = '<div class="pa-user-confirm">' +
      '<h4>确认退出登录？</h4>' +
      '<p>退出后回到 TestOS 实验室数智化系统首页，需要重新登录才能回到 LIMS。原型不会真的清掉你在这台浏览器里的列配置、已读状态等本地数据。</p>' +
      '<div class="btns"><button type="button" data-act="cancel">取 消</button>' +
      '<button type="button" class="ok" data-act="ok">退 出</button></div></div>';
    doc.body.appendChild(mask);
    mask.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (b && b.getAttribute('data-act') === 'ok') {
        mask.classList.remove('open');
        try { (global.top || global).location.href = 'testos.html'; }
        catch (err) { global.location.href = 'testos.html'; }
        return;
      }
      if (!b || b.getAttribute('data-act') === 'cancel' || e.target === mask) mask.classList.remove('open');
    });
    return mask;
  }
  function askLogout(e) {
    e.preventDefault();
    e.stopPropagation();
    closeAll();
    var m = ensureMask(global.document);
    m.classList.add('open');
  }

  /* ---------------- 气泡开合 ---------------- */
  function closeAll() { pops.forEach(function (p) { p.close(); }); }

  function makeChip(chip) {
    var wrap = chip.closest('.pa-user-wrap') || chip.parentElement;
    var pop = wrap.querySelector('.pa-user-pop');
    if (!pop) return;
    fill(wrap);
    var timer = null;

    function open() {
      clearTimeout(timer);
      pops.forEach(function (o) { if (o !== api) o.close(); });
      pop.classList.add('open');
      chip.setAttribute('aria-expanded', 'true');
    }
    function close() { pop.classList.remove('open'); chip.setAttribute('aria-expanded', 'false'); }
    function later() { clearTimeout(timer); timer = setTimeout(close, 160); }

    wrap.addEventListener('mouseenter', open);
    wrap.addEventListener('mouseleave', later);
    pop.addEventListener('mouseenter', function () { clearTimeout(timer); });
    chip.addEventListener('click', function (e) {
      e.stopPropagation();
      if (pop.classList.contains('open')) close(); else open();
    });
    pop.addEventListener('click', function (e) { e.stopPropagation(); });

    var api = { close: close, open: open };
    pops.push(api);
  }

  function bindAll() {
    injectStyle();
    var doc = global.document;
    [].slice.call(doc.querySelectorAll('.pa-user-chip')).forEach(function (chip) {
      if (bound.has(chip)) {
        // 克隆件里可能带着外壳的展开态，重新填一遍数据即可
        var w = chip.closest('.pa-user-wrap');
        if (w) { var pp = w.querySelector('.pa-user-pop'); if (pp) pp.classList.remove('open'); fill(w); }
        return;
      }
      bound.add(chip);
      makeChip(chip);
    });
  }

  doc_click();
  function doc_click() {
    global.document.addEventListener('click', function () { closeAll(); });
  }
  global.document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAll();
  });

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', bindAll);
  } else { bindAll(); }
  new MutationObserver(function () { bindAll(); }).observe(global.document.documentElement, { childList: true, subtree: true });

  global.LimsUserProfile = { bind: bindAll, fill: fill, profile: profile };
})(window);
