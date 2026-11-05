/**
 * 顶栏「个人信息」气泡
 *
 * 数据唯一来源：js/current-user.js 的 LimsCurrentUser.profile —— 顶栏头像、气泡昵称、部门都读同一份。
 * 电子签名是「本人可维护」的一项，单独落在 localStorage（lims-user-signature-v1）：
 *   没写过 → 用内置签名 assets/profile/signature-admin.svg
 *   写成空 → 已删除，格子里换成上传入口
 *   上传过 → 存 dataURL + 文件名 + 大小 + 上传时间
 * 放大查看自带遮罩，不依赖 js/image-viewer.js（那个只在部分页面加载，顶栏是全站都有的）。
 *
 * 外壳由 index.html 提供、画布内是它的克隆件，所以只认 class，绑定状态用 WeakSet 记。
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'pa-user-style';
  var SIG_KEY = 'lims-user-signature-v1';
  var MAX_SIZE = 2 * 1024 * 1024;          // 2MB，与「系统参数 › 签名与印章」一致
  var bound = new WeakSet();
  var pops = [];
  var doc = global.document;

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
    '.pa-user-sign { position: relative; margin-top: 4px; width: 116px; height: 62px; background: #fff;',
    '  border: 1px solid #e2e8f0; border-radius: 8px; overflow: visible; }',
    '.pa-user-sign img { width: 100%; height: 100%; object-fit: contain; border-radius: 7px; }',
    '.pa-user-zoom { position: absolute; inset: 0; display: none; align-items: center; justify-content: center;',
    '  border-radius: 7px; background: rgba(100, 116, 139, .42); color: #fff; font-size: 17px; cursor: zoom-in; border: 0; }',
    '.pa-user-sign.has:hover .pa-user-zoom { display: flex; }',
    '.pa-user-del { position: absolute; right: -7px; top: -7px; width: 20px; height: 20px; border-radius: 50%;',
    '  border: 0; background: #1e293b; color: #fff; font-size: 11px; line-height: 20px; cursor: pointer; display: none; }',
    '.pa-user-sign.has:hover .pa-user-del { display: block; }',
    '.pa-user-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;',
    '  justify-content: center; gap: 3px; border: 1px dashed #cbd5e1; border-radius: 7px; background: #fff;',
    '  color: #94a3b8; font-size: 11px; cursor: pointer; }',
    '.pa-user-empty:hover { border-color: #3b82f6; color: #2563eb; }',
    '.pa-user-signnote { margin-top: 5px; font-size: 11px; color: #94a3b8; width: 116px; line-height: 1.45; text-align: center; }',
    '.pa-user-reset { border: 0; background: none; color: #2563eb; font-size: 11px; cursor: pointer; padding: 0; text-decoration: underline; }',
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
    '.pa-user-confirm button.danger { background: #ef4444; border-color: #ef4444; color: #fff; }',
    '.pa-user-confirm button:hover { filter: brightness(.97); }',
    '.pa-user-view { display: flex; flex-direction: column; align-items: center; gap: 10px; max-width: min(860px, 92vw); }',
    '.pa-user-view img { max-width: 100%; max-height: 68vh; background: #fff; border-radius: 10px; padding: 18px;',
    '  box-shadow: 0 18px 44px rgba(0,0,0,.35); }',
    '.pa-user-view .cap { color: #e2e8f0; font-size: 12px; display: flex; gap: 12px; align-items: center; }',
    '.pa-user-view .x { position: absolute; right: 18px; top: 14px; width: 34px; height: 34px; border-radius: 50%;',
    '  border: 1px solid rgba(255,255,255,.5); background: rgba(255,255,255,.12); color: #fff; cursor: pointer; font-size: 15px; }',
    '.pa-user-toast { position: fixed; left: 50%; bottom: 34px; transform: translateX(-50%); z-index: 10000;',
    '  background: rgba(15,23,42,.86); color: #fff; padding: 8px 20px; border-radius: 6px; font-size: 13px;',
    '  opacity: 0; transition: opacity .2s; pointer-events: none; white-space: nowrap; }',
    '.pa-user-toast.show { opacity: 1; }'
  ].join('\n');

  function injectStyle() { if (!doc.getElementById(STYLE_ID)) { var st = doc.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; doc.head.appendChild(st); } }
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function toast(msg) {
    var t = doc.querySelector('.pa-user-toast');
    if (!t) { t = doc.createElement('div'); t.className = 'pa-user-toast'; doc.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 1900);
  }

  /* ---------------- 签名存储 ---------------- */
  function defaultSig() {
    var p = (global.LimsCurrentUser && LimsCurrentUser.profile) || {};
    return p.signature ? { src: p.signature, name: p.signature.split('/').pop(), size: 0, at: '', builtin: true } : null;
  }
  function sigGet() {
    var raw = null;
    try { raw = global.localStorage.getItem(SIG_KEY); } catch (e) { var d = defaultSig(); return d || { src: '', name: '', size: 0, at: '' }; }
    if (raw === null) { var d2 = defaultSig(); return d2 || { src: '', name: '', size: 0, at: '' }; }
    if (raw === '') return { src: '', name: '', size: 0, at: '' };
    try { return JSON.parse(raw) || { src: '', name: '', size: 0, at: '' }; } catch (e) { return { src: '', name: '', size: 0, at: '' }; }
  }
  function sigSet(val) {
    try { global.localStorage.setItem(SIG_KEY, val === null ? '' : JSON.stringify(val)); } catch (e) { toast('本机存储不可用，签名只在当前页面生效'); }
    renderAll();
  }
  function kb(n) { return n > 1024 ? Math.round(n / 102.4) / 10 + ' KB' : n + ' B'; }

  function renderSign(box) {
    var sig = sigGet();
    box.className = 'pa-user-sign' + (sig.src ? ' has' : '');
    box.innerHTML = sig.src
      ? '<img src="' + esc(sig.src) + '" alt="电子签名" />' +
        '<button type="button" class="pa-user-zoom" data-act="zoom" title="放大查看电子签名"><i class="fa fa-search-plus"></i></button>' +
        '<button type="button" class="pa-user-del" data-act="del" title="删除电子签名">&times;</button>'
      : '<button type="button" class="pa-user-empty" data-act="pick"><i class="fa fa-plus-circle text-base"></i><span>上传电子签名</span></button>';
    var note = box.parentNode.querySelector('.pa-user-signnote');
    if (!note) {
      note = doc.createElement('p');
      note.className = 'pa-user-signnote';
      box.parentNode.insertBefore(note, box.nextSibling);
    }
    if (sig.src) {
      note.textContent = sig.builtin ? '内置签名 · 悬停可放大/删除' : (sig.name || '签名图') + ' · ' + kb(sig.size || 0);
    } else {
      note.innerHTML = '已删除，点格子重新上传<br><button type="button" class="pa-user-reset" data-act="reset">恢复内置签名</button>';
    }
  }
  function renderAll() { [].slice.call(doc.querySelectorAll('.pa-user-sign')).forEach(renderSign); }

  /* ---------------- 通用确认框 / 放大层 ---------------- */
  function askConfirm(opt) {
    var mask = doc.createElement('div');
    mask.className = 'pa-user-mask open';
    mask.innerHTML = '<div class="pa-user-confirm"><h4>' + esc(opt.title) + '</h4><p>' + opt.text + '</p>' +
      '<div class="btns"><button type="button" data-act="cancel">取 消</button>' +
      '<button type="button" class="' + (opt.danger ? 'danger' : 'ok') + '" data-act="ok">' + esc(opt.ok || '确 定') + '</button></div></div>';
    doc.body.appendChild(mask);
    mask.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (b && b.getAttribute('data-act') === 'ok') { mask.remove(); opt.onOk(); return; }
      if (!b || e.target === mask) mask.remove();
    });
  }

  function zoom(src, name, size, builtin) {
    var mask = doc.createElement('div');
    mask.className = 'pa-user-mask open';
    mask.innerHTML = '<div class="pa-user-view"><button type="button" class="x" data-act="close" aria-label="关闭放大查看">&times;</button>' +
      '<img src="' + esc(src) + '" alt="电子签名放大查看" />' +
      '<p class="cap"><span>' + esc(name || '电子签名') + '</span>' +
      '<span>' + (size ? kb(size) + ' · ' : '') + (builtin ? '内置签名' : '本人上传') + '</span>' +
      '<span>按 Esc 或点空白关闭</span></p></div>';
    doc.body.appendChild(mask);
    mask.addEventListener('click', function (e) {
      if (e.target === mask || (e.target.closest && e.target.closest('[data-act="close"]'))) mask.remove();
    });
    doc.addEventListener('keydown', function h(e) { if (e.key === 'Escape') { mask.remove(); doc.removeEventListener('keydown', h); } });
  }

  /* ---------------- 上传 ---------------- */
  var picker = null;
  function openPicker() {
    if (!picker) {
      picker = doc.createElement('input');
      picker.type = 'file';
      picker.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
      picker.style.display = 'none';
      doc.body.appendChild(picker);
      picker.addEventListener('change', function () {
        var f = picker.files && picker.files[0];
        if (!f) return;
        if (!/^image\//.test(f.type || '')) { toast('只能上传图片文件（PNG / JPG / GIF / WebP / SVG）'); picker.value = ''; return; }
        if (f.size > MAX_SIZE) { toast('图片超过 2MB（当前 ' + kb(f.size) + '），请压缩后再上传'); picker.value = ''; return; }
        var fr = new FileReader();
        fr.onload = function () {
          var d = new Date(), p2 = function (n) { return (n < 10 ? '0' : '') + n; };
          sigSet({ src: String(fr.result), name: f.name, size: f.size, builtin: false,
            at: d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) });
          toast('电子签名已更新：' + f.name);
        };
        fr.onerror = function () { toast('读取文件失败，请换一张图片再试'); };
        fr.readAsDataURL(f);
        picker.value = '';
      });
    }
    picker.click();
  }

  /* ---------------- 气泡绑定 ---------------- */
  function profile() {
    var u = global.LimsCurrentUser || {};
    var p = u.profile || {};
    function v(x) { return (x === undefined || x === null || x === '') ? '/' : String(x); }
    return { nickname: v(p.nickname || u.name), account: v(p.account || u.name), gender: v(p.gender),
      dept: v(p.dept || u.dept), phone: v(p.phone), email: v(p.email), createTime: v(p.createTime),
      avatar: p.avatar || '' };
  }

  function fill(root) {
    var p = profile();
    [].slice.call(root.querySelectorAll('[data-up]')).forEach(function (el) {
      var k = el.getAttribute('data-up');
      if (k === 'logout') { if (!el.getAttribute('data-wired')) { el.setAttribute('data-wired', '1'); el.addEventListener('click', askLogout); } return; }
      if (k === 'label') { el.textContent = p.nickname === '/' ? '管理员' : p.nickname; return; }
      if (k === 'avatar' || k === 'avatarBig') { if (p.avatar) el.setAttribute('src', p.avatar); return; }
      if (k === 'signBox') { renderSign(el); return; }
      if (p[k] !== undefined) el.textContent = p[k];
    });
  }

  function onPopClick(e) {
    var b = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!b) return;
    var act = b.getAttribute('data-act');
    var sig = sigGet();
    if (act === 'zoom') { e.stopPropagation(); zoom(sig.src, sig.name, sig.size, sig.builtin); }
    else if (act === 'del') {
      e.stopPropagation();
      askConfirm({ title: '确认删除电子签名？', danger: true, ok: '删 除',
        text: '删除后气泡里的签名格子会换成上传入口，需要重新上传才恢复。此操作只影响本机浏览器里保存的签名，不动内置演示图。',
        onOk: function () { sigSet(null); toast('电子签名已删除，可点格子重新上传'); } });
    } else if (act === 'pick') { e.stopPropagation(); openPicker(); }
    else if (act === 'reset') {
      e.stopPropagation();
      try { global.localStorage.removeItem(SIG_KEY); } catch (err) { toast('本机存储不可用，已在本页恢复内置签名'); }
      renderAll();
      toast('已恢复内置演示签名');
    }
  }

  function askLogout(e) {
    e.preventDefault(); e.stopPropagation();
    closeAll();
    askConfirm({ title: '确认退出登录？', ok: '退 出',
      text: '退出后回到 TestOS 实验室数智化系统首页，需要重新登录才能回到 LIMS。原型不会清掉这台浏览器里的列配置、已读状态、已上传的签名等本地数据。',
      onOk: function () { try { (global.top || global).location.href = 'testos.html'; } catch (err) { global.location.href = 'testos.html'; } } });
  }

  function closeAll() { pops.forEach(function (p) { p.close(); }); }

  function makeChip(chip) {
    var wrap = chip.closest('.pa-user-wrap') || chip.parentElement;
    var pop = wrap.querySelector('.pa-user-pop');
    if (!pop) return;
    fill(wrap);
    var timer = null;
    function open() { clearTimeout(timer); pops.forEach(function (o) { if (o !== api) o.close(); }); fill(wrap); pop.classList.add('open'); chip.setAttribute('aria-expanded', 'true'); }
    function close() { pop.classList.remove('open'); chip.setAttribute('aria-expanded', 'false'); }
    function later() { clearTimeout(timer); timer = setTimeout(close, 160); }
    wrap.addEventListener('mouseenter', open);
    wrap.addEventListener('mouseleave', later);
    pop.addEventListener('mouseenter', function () { clearTimeout(timer); });
    chip.addEventListener('click', function (e) { e.stopPropagation(); if (pop.classList.contains('open')) close(); else open(); });
    pop.addEventListener('click', function (e) { e.stopPropagation(); onPopClick(e); });
    var api = { close: close, open: open };
    pops.push(api);
  }

  function bindAll() {
    injectStyle();
    [].slice.call(doc.querySelectorAll('.pa-user-chip')).forEach(function (chip) {
      // fill() 会改 DOM，观察器会因为自己的改动反复回调，已绑过的必须直接返回，否则死循环
      if (bound.has(chip)) return;
      bound.add(chip);
      makeChip(chip);
    });
  }

  doc.addEventListener('click', function () { closeAll(); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

  if (doc.readyState === 'loading') { doc.addEventListener('DOMContentLoaded', bindAll); } else { bindAll(); }
  new MutationObserver(function () { bindAll(); }).observe(doc.documentElement, { childList: true, subtree: true });

  global.LimsUserProfile = { bind: bindAll, signature: sigGet, setSignature: sigSet, render: renderAll };
})(window);
