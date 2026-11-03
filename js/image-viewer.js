/* 通用「点缩略图看大图」：页面只要给缩略图带上 data-img-src，本脚本自动接管点击
 *   data-img-src   必填，大图地址（没有该属性视为不可点，例如「仅存名」占位）
 *   data-img-name  选填，显示在标题栏的图片名
 *   data-img-group 选填，同一组的缩略图可以左右切换（默认按所在表格分组）
 * 依赖：无。样式与遮罩在本脚本内注入，可放在任意页面。
 */
(function (global) {
  var doc = global.document;
  var STYLE_ID = 'iv-styles';
  var css = [
    '#iv-mask { position: fixed; inset: 0; z-index: 10090; display: none; align-items: center; justify-content: center;',
    '  background: rgba(15,23,42,.72); padding: 24px; }',
    '#iv-mask.iv-open { display: flex; }',
    '#iv-box { max-width: 92%; max-height: 92%; display: flex; flex-direction: column; gap: 8px;',
    '  background: #fff; border-radius: 10px; padding: 10px 12px; box-shadow: 0 20px 48px rgba(0,0,0,.35); }',
    '#iv-head { display: flex; align-items: center; gap: 12px; font-size: 13px; color: #475569; }',
    '#iv-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '#iv-count { color: #94a3b8; font-variant-numeric: tabular-nums; }',
    '#iv-close { border: 1px solid #cbd5e1; background: #fff; color: #475569; border-radius: 5px;',
    '  padding: 2px 10px; font-size: 12px; cursor: pointer; }',
    '#iv-close:hover { border-color: #2563eb; color: #2563eb; }',
    '#iv-stage { position: relative; display: flex; align-items: center; justify-content: center; min-height: 120px; }',
    '#iv-img { max-height: 74vh; max-width: 100%; display: block; border-radius: 4px; background: #f1f5f9; }',
    '.iv-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 30px; height: 44px;',
    '  border: 1px solid #e2e8f0; background: rgba(255,255,255,.92); color: #334155; border-radius: 6px;',
    '  font-size: 16px; cursor: pointer; }',
    '.iv-nav:hover { border-color: #2563eb; color: #2563eb; }',
    '.iv-nav[hidden] { display: none; }',
    '#iv-prev { left: 4px; }',
    '#iv-next { right: 4px; }',
    '[data-img-src] { cursor: zoom-in; }',
    '[data-img-src]:hover { outline: 2px solid rgba(37,99,235,.45); outline-offset: 1px; }'
  ].join('\n');

  var list = [], idx = 0;

  function ensureUI() {
    if (!doc.getElementById(STYLE_ID)) {
      var st = doc.createElement('style');
      st.id = STYLE_ID; st.textContent = css; doc.head.appendChild(st);
    }
    var mask = doc.getElementById('iv-mask');
    if (mask) return mask;
    mask = doc.createElement('div');
    mask.id = 'iv-mask';
    mask.innerHTML =
      '<div id="iv-box">' +
        '<div id="iv-head"><span id="iv-title"></span><span id="iv-count"></span>' +
          '<button type="button" id="iv-close">关闭</button></div>' +
        '<div id="iv-stage">' +
          '<button type="button" class="iv-nav" id="iv-prev" aria-label="上一张">&#8249;</button>' +
          '<img id="iv-img" alt="大图预览" />' +
          '<button type="button" class="iv-nav" id="iv-next" aria-label="下一张">&#8250;</button>' +
        '</div>' +
      '</div>';
    doc.body.appendChild(mask);
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });
    mask.querySelector('#iv-close').addEventListener('click', close);
    mask.querySelector('#iv-prev').addEventListener('click', function () { step(-1); });
    mask.querySelector('#iv-next').addEventListener('click', function () { step(1); });
    doc.addEventListener('keydown', function (e) {
      if (!mask.classList.contains('iv-open')) return;
      if (e.key === 'Escape') { close(); }
      else if (e.key === 'ArrowLeft') { step(-1); }
      else if (e.key === 'ArrowRight') { step(1); }
    });
    return mask;
  }

  function render() {
    var mask = ensureUI();
    var cur = list[idx];
    if (!cur) return;
    mask.querySelector('#iv-img').src = cur.src;
    mask.querySelector('#iv-title').textContent = cur.name || '图片预览';
    mask.querySelector('#iv-count').textContent = list.length > 1 ? (idx + 1) + ' / ' + list.length : '';
    mask.querySelector('#iv-prev').hidden = list.length < 2;
    mask.querySelector('#iv-next').hidden = list.length < 2;
    mask.classList.add('iv-open');
  }

  function step(d) {
    if (list.length < 2) return;
    idx = (idx + d + list.length) % list.length;
    render();
  }

  function close() {
    var mask = doc.getElementById('iv-mask');
    if (mask) mask.classList.remove('iv-open');
  }

  function openFrom(el) {
    var group = el.getAttribute('data-img-group') || '';
    var scope = el.closest('[data-img-scope]') || doc;
    // 同一样品的多张图算一组，可以左右翻；没分组的就单张看
    var same = group
      ? [].slice.call(scope.querySelectorAll('[data-img-group="' + group.replace(/"/g, '\\"') + '"]'))
      : [];
    if (!same.length) same = [el];
    list = same.map(function (n) {
      return { src: n.getAttribute('data-img-src'), name: n.getAttribute('data-img-name') || n.getAttribute('title') || '' };
    });
    idx = same.indexOf(el);
    if (idx < 0) idx = 0;
    render();
  }

  // 事件委托：静态写死的缩略图和脚本重绘出来的都能用
  doc.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-img-src]') : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    openFrom(el);
  }, true);

  global.ImageViewer = { open: openFrom, close: close };
})(window);
