/* 弹窗可拖动（全局）
 * 按住弹窗标题栏拖动，双击标题栏复位到居中；拖动范围限制在视口内，不会被拖丢。
 * 兼容仓库里两种弹窗写法：
 *   A. <div id="xxModal" class="fixed inset-0 hidden items-center justify-center …">
 *        <div class="w-[480px] … bg-white"> <div class="flex … border-b"><h3>标题</h3> …
 *   B. <div class="modal-mask"><div class="modal-box"><div class="modal-head">…
 * 需求文档舞台是等比缩放的（:root --pa-scale），位移按缩放比例反算，鼠标移动多少弹窗就走多少。
 * 依赖：无。
 */
(function (global) {
  var doc = global.document;
  var STYLE_ID = 'md-styles';
  var HANDLE_ATTR = 'data-md-handle';
  var offs = new Map();

  var css = [
    '.' + 'md-handle { cursor: grab; }',
    '.md-handle:active { cursor: grabbing; }',
    'html.md-dragging, html.md-dragging * { cursor: grabbing !important; user-select: none !important; }'
  ].join('\n');

  function ensureStyle() {
    if (doc.getElementById(STYLE_ID)) return;
    var st = doc.createElement('style');
    st.id = STYLE_ID; st.textContent = css; doc.head.appendChild(st);
  }

  function scale() {
    var v = '';
    try { v = global.getComputedStyle(doc.documentElement).getPropertyValue('--pa-scale'); } catch (e) {}
    var n = parseFloat(v);
    return (n > 0.01 && n <= 4) ? n : 1;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /** 弹窗卡片：遮罩的第一个元素子节点（A 类是白底圆角 div，B 类是 .modal-box） */
  function panelOf(mask) {
    var box = mask.querySelector('.modal-box');
    if (box) return box;
    return [].slice.call(mask.children).filter(function (el) {
      return el.nodeType === 1 && el.tagName === 'DIV';
    })[0] || null;
  }

  /** 标题栏：优先 .modal-head，否则取标题元素所在的那一行（必须是卡片的直接子元素，避免抓到整块 body） */
  function handleOf(panel) {
    var h = panel.querySelector('.modal-head');
    if (h) return h;
    var heading = panel.querySelector('h2, h3, h4, .modal-title');
    if (!heading) return null;
    var p = heading.parentElement;
    return (p && p.parentElement === panel) ? p : heading;
  }

  function isVisible(mask) {
    var cs = global.getComputedStyle(mask);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    return !mask.classList.contains('hidden');
  }

  /** 未位移时的矩形：临时清掉 transform 量一次再恢复 */
  function baseRect(panel) {
    var keep = panel.style.transform;
    panel.style.transform = '';
    var r = panel.getBoundingClientRect();
    panel.style.transform = keep;
    return r;
  }

  function apply(panel) {
    var o = offs.get(panel) || { x: 0, y: 0 };
    panel.style.transform = (o.x || o.y) ? ('translate(' + o.x + 'px,' + o.y + 'px)') : '';
  }

  function bind(handle, panel) {
    if (handle.hasAttribute(HANDLE_ATTR)) return;
    handle.setAttribute(HANDLE_ATTR, '1');
    handle.classList.add('md-handle');
    if (!handle.title) handle.title = '按住标题栏可拖动弹窗，双击复位';

    handle.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      var t = e.target;
      // 关闭按钮、表单控件、链接、缩略图上的点击不当作拖动
      if (t.closest && t.closest('button,input,select,textarea,a,label,[data-img-src]')) return;
      var s = scale();
      var start = offs.get(panel) || { x: 0, y: 0 };
      var base = baseRect(panel);
      var vw = global.innerWidth, vh = global.innerHeight;
      var minX = (8 - base.left) / s, maxX = (vw - 8 - (base.left + base.width)) / s;
      var minY = (8 - base.top) / s, maxY = (vh - 8 - (base.top + base.height)) / s;
      if (maxX < minX) { maxX = minX; }
      if (maxY < minY) { minY = 0; maxY = 0; }
      var sx = e.clientX, sy = e.clientY;
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
      doc.documentElement.classList.add('md-dragging');
      var moved = false;

      function move(ev) {
        var dx = (ev.clientX - sx) / s, dy = (ev.clientY - sy) / s;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
        offs.set(panel, { x: clamp(start.x + dx, minX, maxX), y: clamp(start.y + dy, minY, maxY) });
        apply(panel);
      }
      function up() {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        doc.documentElement.classList.remove('md-dragging');
      }
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
      e.preventDefault();
    });

    handle.addEventListener('dblclick', function () {
      offs.set(panel, { x: 0, y: 0 });
      apply(panel);
    });
  }

  function scan() {
    ensureStyle();
    var seen = doc.querySelectorAll('.modal-mask, [id$="Modal"], [id$="modal"], [class*="modal-mask"]');
    [].slice.call(seen).forEach(function (mask) {
      if (!isVisible(mask)) return;                       // 没打开的弹窗不绑，等 MutationObserver 再扫
      var panel = panelOf(mask);
      if (!panel) return;
      var handle = handleOf(panel);
      if (handle) bind(handle, panel);
    });
  }

  function boot() {
    scan();
    if (!global.MutationObserver) return;
    var raf = 0;
    new MutationObserver(function () {
      if (raf) return;
      raf = global.requestAnimationFrame(function () { raf = 0; scan(); });
    }).observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.ModalDrag = { scan: scan, reset: function (panel) { offs.set(panel, { x: 0, y: 0 }); apply(panel); } };
})(window);
