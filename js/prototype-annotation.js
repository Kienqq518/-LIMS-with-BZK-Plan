/**
 * 原型批注模式（全局：localStorage 持久化，跨页面保持开启状态）
 */
(function (global) {
  var STYLE_ID = 'prototype-annotation-styles';
  var ROOT_ID = 'prototype-annotation-root';
  var STORAGE_KEY = 'lims-prototype-annotation-enabled';
  var enabled = false;
  var config = { annotations: [] };

  /* 引擎内置批注：不依赖各页面手写，凡是接入该能力的页面自动带上 */
  var BUILTIN_ANNOTATIONS = [
    {
      id: 'column-config',
      selector: '#cc-trigger',
      position: 'top-left',
      title: '列配置（排序 / 是否展示）与冻结列',
      wide: true,
      content: '<strong>需求逻辑：</strong>主查询列表字段多、不同角色关注的列不一样，需要按页面自定义列；配置属于个人视图，必须刷新后仍然保留，不能影响他人。<br>' +
        '<strong>展示规则：</strong>表头最后一列（操作）右侧固定一个 ☰ 入口。点开为「列配置」面板：顶部搜索框（按字段名过滤条目），每行依次是拖拽手柄 ≡、字段名、上移/下移按钮、是否展示开关，底部为「重 置」「保 存」。关闭的字段在表头与表体一起不展示，不留空列；空态行的跨列宽度同步修正。横向滚动时<strong>前两列与最后一列冻结</strong>，中间列滚动；可见列不足 5 列时不冻结，避免左右两块重叠。冻结边界仅在真正滚动后显示分隔投影。<br>' +
        '<strong>交互逻辑：</strong>面板内改动即时预览但不落库；点「保存」写入 localStorage（按页面分别记忆），刷新、重进、跳转回来都保持；点 × 或面板外区域关闭则丢弃未保存的草稿；「重 置」恢复该页默认顺序与全部展示。拖拽或 ↑↓ 调整顺序后，冻结列、序号列编号、入口按钮位置都会跟着重算；列表被页面重绘或窗口尺寸变化时自动重新套用。',
      tag: '列表通用'
    }
  ];
  var focusScopeEl = null;
  var docShowAll = false;   // 弹窗打开时，用户手动切回「看页面全部需求」
  var docQuery = '';        // 需求文档搜索词

  var css = [
    'html { position: relative; }',
    '#prototype-annotation-root { position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 9990; overflow: visible; }',
    '#prototype-annotation-root * { pointer-events: auto; }',
    '.pa-toggle { position: fixed; right: 20px; bottom: 20px; z-index: 10001; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; font-size: 13px; font-weight: 500; box-shadow: 0 4px 14px rgba(15,23,42,.18); cursor: pointer; border: none; transition: all .2s; }',
    /* 弹窗打开时移到左下，避免遮挡右下角取消/保存等操作按钮 */
    '.pa-toggle.pa-modal-open { right: auto; left: 20px; }',
    '.pa-toggle.off { background: #fff; color: #475569; }',
    '.pa-toggle.on { background: #f97316; color: #fff; }',
    '.pa-marker { position: absolute; z-index: 9995; width: 22px; height: 22px; border-radius: 50%; background: #f97316; color: #fff; font-size: 12px; font-weight: 700; display: none; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(249,115,22,.45); cursor: pointer; border: 2px solid #fff; }',
    '.pa-marker.visible { display: flex; }',
    '.pa-marker.pa-dimmed { display: none !important; }',
    '.pa-marker:hover { transform: scale(1.1); }',
    '.pa-card { position: absolute; z-index: 10000; width: 340px; max-width: calc(100vw - 24px); max-height: calc(100vh - 100px); overflow-y: auto; background: #fffbeb; border: 1px solid #fcd34d; border-left: 4px solid #f97316; border-radius: 8px; padding: 12px 14px; box-shadow: 0 8px 24px rgba(15,23,42,.12); display: none; font-size: 13px; color: #334155; line-height: 1.6; }',
    '.pa-card.wide { width: 400px; max-width: calc(100vw - 24px); }',
    '.pa-card.visible { display: block; }',
    '.pa-card.pa-dimmed { display: none !important; }',
    '.pa-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px; }',
    '.pa-card-num { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: #f97316; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }',
    '.pa-card-title { font-weight: 600; color: #c2410c; flex: 1; }',
    '.pa-card-close { color: #94a3b8; cursor: pointer; font-size: 14px; line-height: 1; }',
    '.pa-card-close:hover { color: #64748b; }',
    '.pa-card-body { color: #475569; }',
    '.pa-card-tag { display: inline-block; margin-top: 8px; padding: 2px 8px; border-radius: 4px; background: #ffedd5; color: #c2410c; font-size: 11px; }',
    '.pa-highlight { outline: 2px dashed #f97316 !important; outline-offset: 3px; border-radius: 4px; }',
    /* ===== 需求文档侧栏：左原型 + 右文档，批注点双向联动 ===== */
    ':root { --pa-doc-w: 400px; }',
    'html.pa-doc-open body { padding-right: var(--pa-doc-w); }',
    /* 通栏固定条与全屏遮罩弹窗跟随收窄，避免被面板压住 */
    'html.pa-doc-open body > .fixed[class*="bottom-0"], html.pa-doc-open body > .fixed[class*="inset-x-0"] { right: var(--pa-doc-w) !important; }',
    'html.pa-doc-open .fixed.inset-0 { right: var(--pa-doc-w) !important; }',
    'html.pa-doc-open .pa-toggle { right: calc(var(--pa-doc-w) + 20px); }',
    /* 弹窗打开时悬浮球回到左下角；上面那条 right 规则优先级更高，这里必须同等优先级复位，
       否则 left+right 同时生效会把胶囊横向拉伸，重新压住弹窗底部的确定按钮 */
    'html.pa-doc-open .pa-toggle.pa-modal-open { right: auto; left: 20px; }',
    '#pa-doc { position: fixed; top: 0; right: 0; bottom: 0; width: var(--pa-doc-w); z-index: 10002; background: #fff; border-left: 1px solid #e2e8f0; box-shadow: -6px 0 18px rgba(15,23,42,.06); display: none; flex-direction: column; font-size: 13px; color: #334155; }',
    'html.pa-doc-open #pa-doc { display: flex; }',
    '.pa-doc-head { flex-shrink: 0; padding: 12px 14px 10px; border-bottom: 1px solid #eef2f7; background: #fff7ed; }',
    '.pa-doc-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #9a3412; }',
    '.pa-doc-sub { margin-top: 3px; font-size: 12px; color: #b45309; }',
    '.pa-doc-collapse { margin-left: auto; border: 1px solid #fdba74; background: #fff; color: #9a3412; border-radius: 4px; padding: 1px 7px; font-size: 12px; cursor: pointer; }',
    '.pa-doc-tools { flex-shrink: 0; padding: 8px 14px; border-bottom: 1px solid #eef2f7; }',
    '.pa-doc-tools input { width: 100%; border: 1px solid #e2e8f0; border-radius: 5px; padding: 5px 9px; font-size: 12px; outline: none; background: #f8fafc; }',
    '.pa-doc-tools input:focus { border-color: #fb923c; background: #fff; }',
    '.pa-doc-body { flex: 1; overflow-y: auto; padding: 10px 14px 28px; }',
    '.pa-doc-item { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 10px; background: #fff; scroll-margin-top: 12px; }',
    '.pa-doc-item.is-active { border-color: #f97316; box-shadow: 0 0 0 2px rgba(249,115,22,.15); }',
    '.pa-doc-item.is-dim { opacity: .38; }',
    '.pa-doc-item.is-hidden { display: none; }',
    '.pa-doc-itemhead { display: flex; align-items: center; gap: 7px; padding: 8px 10px; cursor: pointer; background: #f8fafc; border-bottom: 1px solid #eef2f7; border-radius: 8px 8px 0 0; }',
    '.pa-doc-itemhead:hover { background: #f1f5f9; }',
    '.pa-doc-num { flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; background: #f97316; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }',
    '.pa-doc-name { font-weight: 600; color: #1e293b; }',
    '.pa-doc-tag { margin-left: auto; flex-shrink: 0; padding: 1px 7px; border-radius: 999px; background: #ffedd5; color: #c2410c; font-size: 11px; }',
    '.pa-doc-secs { padding: 8px 10px 10px; }',
    '.pa-doc-sec { display: flex; gap: 8px; margin-bottom: 7px; }',
    '.pa-doc-sec:last-child { margin-bottom: 0; }',
    '.pa-doc-k { flex-shrink: 0; width: 62px; text-align: right; color: #0f766e; font-weight: 600; }',
    '.pa-doc-v { flex: 1; min-width: 0; line-height: 1.7; color: #334155; word-break: break-word; }',
    '.pa-doc-v ol, .pa-doc-v ul { padding-left: 18px; margin: 2px 0; }',
    '.pa-doc-todo { color: #cbd5e1; }',
    '.pa-doc-empty { padding: 26px 12px; text-align: center; color: #94a3b8; line-height: 1.8; }',
    '.pa-doc-focus { margin-bottom: 8px; padding: 5px 9px; border-radius: 5px; background: #eff6ff; color: #1d4ed8; font-size: 12px; }',
    '.pa-doc-focus.warn { background: #fffbeb; color: #92400e; }',
    '.pa-doc-scope { margin-left: 6px; color: #1d4ed8; text-decoration: underline; cursor: pointer; white-space: nowrap; }',
    '.pa-doc-sub .pa-doc-scope { margin-left: 4px; }',
    '.pa-doc-resizer { position: absolute; left: -3px; top: 0; bottom: 0; width: 7px; cursor: col-resize; z-index: 1; }',
    '.pa-doc-resizer:hover { background: rgba(249,115,22,.35); }',
    '@media (max-width: 1100px) { :root { --pa-doc-w: 320px; } }'
  ].join('\n');

  function detectFocusScope() {
    // 取最后一个匹配：嵌套弹窗（如关联试验内的同步、履历内的表单）通常后挂载且 z-index 更高
    var list = [].slice.call(document.querySelectorAll('.modal-mask.open, .lc-modal-mask.open, .po-mask.open, .drawer-mask.open, .drawer.open, .bind-popover-mask.open, #numberingModal.flex, #addModal.flex, #copyModal.flex'));
    // 兜底：任何全屏遮罩型弹窗（fixed + inset-0 + 当前可见 + z-index>=40）都算焦点弹窗。
    // 白名单靠逐页补容易漏，漏掉的弹窗会出现「悬浮球压住弹窗底部按钮、点击被吃掉」的问题
    // （例如委托登记「添加样品」弹窗的确定按钮）。
    [].slice.call(document.querySelectorAll('.fixed.inset-0')).forEach(function (el) {
      if (list.indexOf(el) >= 0) return;
      var st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') return;
      if ((parseInt(st.zIndex, 10) || 0) < 40) return;
      list.push(el);
    });
    if (!list.length) return null;
    list.sort(function (x, y) {
      var zx = parseInt(window.getComputedStyle(x).zIndex, 10) || 0;
      var zy = parseInt(window.getComputedStyle(y).zIndex, 10) || 0;
      return zx - zy;
    });
    return list[list.length - 1];
  }

  var MODAL_SEL = '.fixed.inset-0, .modal-mask, .lc-modal-mask, .po-mask, .drawer-mask, .drawer, .bind-popover-mask';
  function modalAncestor(el) {
    if (!el || !el.closest) return null;
    var host = el.closest(MODAL_SEL);
    if (!host) return null;
    // 右侧需求文档面板本身不是弹窗
    if (host.id === 'pa-doc' || host.classList.contains('pa-doc')) return null;
    return host;
  }

  function isInFocusScope(el) {
    if (!focusScopeEl) return true;
    if (!el) return false;
    return focusScopeEl.contains(el);
  }

  function modalTitleOf(el) {
    if (!el) return '';
    var h = el.querySelector('h3, h2, .pa-doc-title, .modal-title');
    var t = h ? (h.textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (!t) {
      // 有些弹窗标题在带标题样式的 div 里
      var cand = el.querySelectorAll('div,span');
      for (var i = 0; i < cand.length && i < 12; i++) {
        var txt = (cand[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (txt && txt.length <= 22 && cand[i].children.length === 0) { t = txt; break; }
      }
    }
    return t || '弹窗';
  }

  function inScopeCount() {
    var n = 0;
    config.annotations.forEach(function (item) {
      if (item._target && isInFocusScope(item._target)) n++;
    });
    return n;
  }

  // 弹窗打开 → 右侧需求文档只列该弹窗内的需求（并重新编号）；无子需求时自动回退列页面需求
  function applyDocVisibility() {
    var n = 0;
    config.annotations.forEach(function (item) {
      if (!item._target) return;
      var inScope;
      if (docShowAll) inScope = true;
      else if (focusScopeEl) inScope = isInFocusScope(item._target);
      else inScope = !item._inModal;   // 弹窗内的需求只在弹窗打开时列出
      var hay = (item.title + ' ' + (item.tag || '') + ' ' + item.content).toLowerCase();
      var match = !docQuery || hay.indexOf(docQuery) >= 0;
      var show = inScope && match;
      item._visible = show;
      if (show) n++;
      if (item._entry) item._entry.classList.toggle('is-hidden', !show);
      if (item._entryNum) item._entryNum.textContent = show ? String(n) : '';
      if (item._marker) {
        item._marker.textContent = show ? String(n) : '';
        item._marker.classList.toggle('pa-dimmed', !inScope);
        if (!inScope) item._marker.classList.remove('visible');
      }
      if (item._cardNum) item._cardNum.textContent = show ? String(n) : '';
      if (item._card && !inScope) {
        item._card.classList.remove('visible');
        if (item._target) item._target.classList.remove('pa-highlight');
      }
    });
    return n;
  }

  function updateDocHeader(visibleCount) {
    var panel = document.getElementById('pa-doc');
    if (!panel) return;
    var sub = panel.querySelector('.pa-doc-sub');
    var hint = document.getElementById('pa-doc-focus');
    var total = config.annotations.filter(function (i) { return !!i._target; }).length;
    if (focusScopeEl) {
      var t = modalTitleOf(focusScopeEl);
      var cnt = inScopeCount();
      if (sub) {
        sub.innerHTML = docPageName() + ' · 页面 ' + total + ' 条' +
          '<span class="pa-doc-scope" onclick="PrototypeAnnotation._toggleScope()">' +
          (docShowAll ? '只看「' + t + '」需求' : '看全部页面需求') + '</span>';
      }
      if (hint) {
        if (docShowAll) {
          hint.className = 'pa-doc-focus warn';
          hint.innerHTML = '已切回页面全部需求。<span class="pa-doc-scope" onclick="PrototypeAnnotation._toggleScope()">只看「' + t + '」弹窗需求</span>';
          hint.style.display = '';
        } else if (cnt) {
          hint.className = 'pa-doc-focus';
          hint.innerHTML = '当前弹窗：<strong>' + t + '</strong> · 已切换为该弹窗的 ' + cnt + ' 条需求' +
            '<span class="pa-doc-scope" onclick="PrototypeAnnotation._toggleScope()">看页面需求</span>';
          hint.style.display = '';
        } else {
          hint.className = 'pa-doc-focus warn';
          hint.innerHTML = '「' + t + '」弹窗暂未挂需求批注，先显示页面需求。' +
            '<span class="pa-doc-scope" onclick="PrototypeAnnotation._toggleScope()">知道了</span>';
          hint.style.display = '';
        }
      }
    } else {
      docShowAll = false;
      if (sub) sub.textContent = docPageName() + ' · 共 ' + visibleCount + ' 条页面需求（弹窗需求点开弹窗查看）';
      if (hint) hint.style.display = 'none';
    }
  }

  var OBS_OPTS = { attributes: true, attributeFilter: ['class', 'style'], subtree: true };
  var rebinding = false;

  // 有些锚点是页面脚本重绘后才出现的（例如列表行里按条件生成的链接），
  // init 时 querySelector 拿不到就被整条丢掉；这里在 DOM 变化后补挂一次。
  function hasNewTargets() {
    var missing = false;
    config.annotations.forEach(function (item) {
      if (item._target) return;
      missing = true;
    });
    if (!missing) return false;
    return config.annotations.some(function (item) {
      return !item._target && !!document.querySelector(item.selector);
    });
  }

  function applyFocusScope() {
    // 执行期间暂停观察器：本函数会修改 marker/card 及目标元素（如高亮）的 class，
    // 这些改动位于被观察的 document.body 子树内，若不暂停会反复触发观察器，
    // 形成死循环导致页面卡死（点击弹窗等场景会明显卡死）。
    var obs = window._paModalObserver;
    if (obs) obs.disconnect();
    if (!rebinding && hasNewTargets()) {
      rebinding = true;
      try { buildUI(); } finally { rebinding = false; }
      if (obs) obs.observe(document.body, OBS_OPTS);
      return;
    }
    focusScopeEl = detectFocusScope();
    var toggle = document.querySelector('.pa-toggle');
    if (toggle) toggle.classList.toggle('pa-modal-open', !!focusScopeEl);
    // 弹窗内一条需求都没有时不切换，避免右侧突然空掉
    if (focusScopeEl && !docShowAll && !inScopeCount()) {
      var scopedEl = focusScopeEl;
      focusScopeEl = null;
      var n0 = applyDocVisibility();
      focusScopeEl = scopedEl;
      updateDocHeader(n0);
    } else {
      var n1 = applyDocVisibility();
      updateDocHeader(n1);
    }
    if (enabled) {
      // 只有「当前作用域内且命中搜索」的批注才显示编号点
      config.annotations.forEach(function (item) {
        if (item._marker) item._marker.classList.toggle('visible', !!item._visible);
      });
      refreshPositions();
    }
    if (obs) obs.observe(document.body, OBS_OPTS);
  }

  function loadEnabled() {
    // 默认「开」：整个原型以「左原型 + 右需求文档」双栏为基线布局，
    // 只有用户点过「收起」才记住关闭
    try { return localStorage.getItem(STORAGE_KEY) !== '0'; } catch (e) { return true; }
  }

  function saveEnabled(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function ensureRoot() {
    var root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement('div');
    root.id = ROOT_ID;
    document.body.appendChild(root);
    return root;
  }

  function createToggle() {
    if (document.querySelector('.pa-toggle')) return document.querySelector('.pa-toggle');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pa-toggle off';
    btn.innerHTML = '<i class="fa fa-file-text-o"></i><span>需求文档</span>';
    btn.addEventListener('click', function () {
      setEnabled(!enabled);
    });
    document.body.appendChild(btn);
    return btn;
  }

  function getPageScroll() {
    return {
      x: window.pageXOffset || document.documentElement.scrollLeft || 0,
      y: window.pageYOffset || document.documentElement.scrollTop || 0
    };
  }

  function toDocPoint(viewLeft, viewTop) {
    var scroll = getPageScroll();
    return { left: scroll.x + viewLeft, top: scroll.y + viewTop };
  }

  function getScrollParents(el) {
    var parents = [];
    var node = el && el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      var style = window.getComputedStyle(node);
      if (/(auto|scroll|overlay)/.test(style.overflow + style.overflowY + style.overflowX)) {
        parents.push(node);
      }
      node = node.parentElement;
    }
    return parents;
  }

  function scheduleRefreshPositions() {
    if (window._paScrollRaf) return;
    window._paScrollRaf = window.requestAnimationFrame(function () {
      window._paScrollRaf = null;
      refreshPositions();
    });
  }

  function bindScrollListeners() {
    if (!window._paScrollHandler) {
      window._paScrollHandler = scheduleRefreshPositions;
      window.addEventListener('scroll', window._paScrollHandler, true);
      document.addEventListener('scroll', window._paScrollHandler, true);
      window.addEventListener('resize', window._paScrollHandler);
    }
    if (window._paScrollParents) {
      window._paScrollParents.forEach(function (parent) {
        parent.removeEventListener('scroll', window._paScrollHandler);
      });
    }
    window._paScrollParents = [];
    config.annotations.forEach(function (item) {
      if (!item._target) return;
      getScrollParents(item._target).forEach(function (parent) {
        if (window._paScrollParents.indexOf(parent) < 0) {
          window._paScrollParents.push(parent);
          parent.addEventListener('scroll', window._paScrollHandler, { passive: true });
        }
      });
    });
  }

  function positionMarker(marker, target, position) {
    var rect = target.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      marker.style.display = 'none';
      return;
    }
    marker.style.display = '';
    position = position || 'top-right';
    var size = 22;
    var nearRight = rect.right > window.innerWidth * 0.72;
    var nearBottom = rect.bottom > window.innerHeight * 0.72;
    var point;

    if (position === 'left' || (position === 'bottom-left' && nearRight)) {
      point = toDocPoint(rect.left - size - 4, rect.top + rect.height / 2 - 11);
    } else if (position === 'top-right') {
      // 锚在目标右上角外侧，避免与相邻按钮左上角打点重叠
      point = toDocPoint(rect.right - 2, rect.top - 8);
    } else if (position === 'top-left') {
      point = toDocPoint(rect.left - 12, rect.top - 8);
    } else if (position === 'bottom-right') {
      point = toDocPoint(rect.right - 10, rect.bottom - 14);
    } else if (position === 'bottom-left') {
      point = toDocPoint(
        nearRight ? rect.left - size - 4 : rect.left - 10,
        nearBottom ? rect.top - size - 4 : rect.bottom - 14
      );
    } else {
      point = toDocPoint(rect.right + 4, rect.top + rect.height / 2 - 11);
    }

    marker.style.top = point.top + 'px';
    marker.style.left = point.left + 'px';
  }

  function positionCard(card, marker, item) {
    card.classList.add('visible');
    var cardW = card.offsetWidth || (item.wide ? 400 : 340);
    var cardH = card.offsetHeight || 160;
    var mRect = marker.getBoundingClientRect();
    var scroll = getPageScroll();
    var pad = 12;
    var bottomReserve = 88;
    var viewLeft;
    var viewTop;
    var nearRight = mRect.left > window.innerWidth * 0.55;
    var nearBottom = mRect.top > window.innerHeight * 0.55;

    if (item.position === 'top-left') {
      viewLeft = mRect.left - cardW + 20;
      viewTop = mRect.top - 8;
    } else if (item.position === 'bottom-left') {
      viewLeft = nearRight ? (mRect.left - cardW - 8) : (mRect.left - cardW + 20);
      viewTop = nearBottom ? (mRect.top - cardH - 8) : (mRect.bottom + 8);
    } else if (item.position === 'bottom-right') {
      viewLeft = mRect.right - cardW;
      viewTop = mRect.bottom + 8;
    } else if (item.position === 'left') {
      viewLeft = mRect.left - cardW - 8;
      viewTop = mRect.top + mRect.height / 2 - cardH / 2;
    } else {
      viewLeft = mRect.right - 20;
      viewTop = mRect.bottom + 8;
    }

    if (viewTop + cardH > window.innerHeight - bottomReserve) {
      viewTop = mRect.top - cardH - 8;
    }
    if (viewTop < pad) viewTop = pad;
    if (viewLeft + cardW > window.innerWidth - pad) {
      viewLeft = window.innerWidth - cardW - pad;
    }
    if (viewLeft < pad) {
      viewLeft = pad;
      if (mRect.right + cardW + 16 < window.innerWidth - pad) {
        viewLeft = mRect.right + 8;
      }
    }

    card.style.top = (scroll.y + viewTop) + 'px';
    card.style.left = (scroll.x + viewLeft) + 'px';
  }

  function showCard(item, marker) {
    if (focusScopeEl && !isInFocusScope(item._target)) return;
    ensureRoot();
    document.querySelectorAll('.pa-card').forEach(function (c) { c.classList.remove('visible'); });
    document.querySelectorAll('.pa-highlight').forEach(function (el) { el.classList.remove('pa-highlight'); });

    var card = document.getElementById('pa-card-' + item.id);
    if (!card || card.classList.contains('pa-dimmed')) return;

    var target = document.querySelector(item.selector);
    if (target) target.classList.add('pa-highlight');

    card.style.visibility = 'hidden';
    card.classList.add('visible');
    positionCard(card, marker, item);
    card.style.visibility = '';
  }

  /* ===== 需求文档面板 ===== */
  var DOC_W_KEY = 'lims-prototype-doc-width';
  var CANON = ['需求逻辑', '展示规则', '交互逻辑'];
  var EXTRA_ORDER = ['校验规则', '边界与异常', '权限与角色', '数据与取值', '非目标', '范围', '状态', '说明', '列集', '取值'];
  // 同义标签归一，保证文档结构统一
  var LABEL_ALIAS = {
    '列集': '展示规则', '展示条件': '展示规则', '弹窗列': '展示规则', '页面展示': '展示规则',
    '展示信息': '展示规则', '取值': '数据与取值', '校验范围': '校验规则',
    '描述': '需求逻辑', '逻辑': '需求逻辑', '交互': '交互逻辑', '校验': '校验规则', '边界': '边界与异常'
  };
  // 分段标签形如 <strong>需求逻辑：</strong>；冒号必须存在，避免把行内加粗误判成分段
  var LABEL_RE = /<strong>\s*([^<：:]{2,12})\s*[：:]\s*<\/strong>/g;

  // 把 <strong>需求逻辑：</strong>…<br><strong>展示规则：</strong>… 这类内容切成结构化分段
  function parseContent(html) {
    var text = String(html || '');
    var marks = [], m;
    LABEL_RE.lastIndex = 0;
    while ((m = LABEL_RE.exec(text))) {
      marks.push({ label: m[1].trim(), start: m.index, bodyStart: m.index + m[0].length });
    }
    if (!marks.length) {
      return text.trim() ? [{ label: '需求逻辑', body: text }] : [];
    }
    var parts = [];
    if (marks[0].start > 0) {
      var lead = text.slice(0, marks[0].start).replace(/<br\s*\/?>/g, '').trim();
      if (lead) parts.push({ label: '需求逻辑', body: lead });
    }
    marks.forEach(function (mk, i) {
      var end = i + 1 < marks.length ? marks[i + 1].start : text.length;
      var label = LABEL_ALIAS[mk.label] || mk.label;
      parts.push({ label: label, body: text.slice(mk.bodyStart, end).replace(/<\/?p[^>]*>/g, '') });
    });
    // 同一标签合并成一段
    var merged = {};
    var ordered = [];
    parts.forEach(function (p) {
      if (merged[p.label]) { merged[p.label].body += '<br>' + p.body; return; }
      merged[p.label] = { label: p.label, body: p.body };
      ordered.push(merged[p.label]);
    });
    parts = ordered;
    // 已知段落按规范顺序排，未知段落保持原顺序跟在后面
    function rank(label) {
      var i = CANON.indexOf(label);
      if (i >= 0) return i;
      var j = EXTRA_ORDER.indexOf(label);
      return j >= 0 ? CANON.length + j : CANON.length + EXTRA_ORDER.length;
    }
    return parts.sort(function (a, b) { return rank(a.label) - rank(b.label); });
  }

  function docSectionsHtml(item) {
    var parts = parseContent(item.content);
    var seen = {};
    var html = parts.map(function (p) {
      seen[p.label] = 1;
      return '<div class="pa-doc-sec"><span class="pa-doc-k">' + p.label + '</span>' +
        '<div class="pa-doc-v">' + (p.body || '—') + '</div></div>';
    }).join('');
    CANON.forEach(function (k) {
      if (!seen[k]) html += '<div class="pa-doc-sec"><span class="pa-doc-k">' + k + '</span>' +
        '<div class="pa-doc-v pa-doc-todo">待补充</div></div>';
    });
    return html;
  }

  function buildDocPanel() {
    var panel = document.getElementById('pa-doc');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'pa-doc';
      document.body.appendChild(panel);
    }
    var total = config.annotations.length;
    panel.innerHTML =
      '<div class="pa-doc-resizer" onmousedown="PrototypeAnnotation._startResize(event)"></div>' +
      '<div class="pa-doc-head">' +
        '<div class="pa-doc-title"><i class="fa fa-file-text-o"></i><span>需求文档</span>' +
          '<button type="button" class="pa-doc-collapse" onclick="PrototypeAnnotation.setEnabled(false)" title="收起文档与批注">收起</button>' +
        '</div>' +
        '<div class="pa-doc-sub">' + docPageName() + ' · 共 ' + total + ' 条需求</div>' +
      '</div>' +
      (total ? '<div class="pa-doc-tools"><input type="text" placeholder="搜索需求关键词" oninput="PrototypeAnnotation._filter(this.value)" /></div>' : '') +
      '<div class="pa-doc-body" id="pa-doc-body"></div>';
    var body = panel.querySelector('#pa-doc-body');
    if (!total) {
      body.innerHTML = '<div class="pa-doc-empty">本页面暂未挂需求批注。<br>可在页面脚本的 PrototypeAnnotation.init 中补充。</div>';
      return;
    }
    body.innerHTML = '<div class="pa-doc-focus" id="pa-doc-focus" style="display:none"></div>' +
      config.annotations.map(function (item, index) {
        if (!item._target) return '';
        return '<div class="pa-doc-item" id="pa-doc-' + item.id + '" data-id="' + item.id + '">' +
          '<div class="pa-doc-itemhead" onclick="PrototypeAnnotation._fromDoc(\'' + item.id + '\')">' +
            '<span class="pa-doc-num">' + (index + 1) + '</span>' +
            '<span class="pa-doc-name">' + item.title + '</span>' +
            (item.tag ? '<span class="pa-doc-tag">' + item.tag + '</span>' : '') +
          '</div>' +
          '<div class="pa-doc-secs">' + docSectionsHtml(item) + '</div>' +
        '</div>';
      }).join('');
    // 条目节点已生成，缓存引用供作用域切换时快速显隐/重编号
    config.annotations.forEach(function (item) {
      item._entry = document.getElementById('pa-doc-' + item.id);
      item._entryNum = item._entry ? item._entry.querySelector('.pa-doc-num') : null;
    });
    applyDocWidth();
  }

  function docPageName() {
    return String(document.title || '').replace(/\s*[-–]\s*智慧实验室\s*$/, '') || location.pathname.split('/').pop();
  }

  function applyDocWidth() {
    var w = 400;
    try { w = parseInt(localStorage.getItem(DOC_W_KEY), 10) || 400; } catch (e) {}
    document.documentElement.style.setProperty('--pa-doc-w', Math.min(680, Math.max(300, w)) + 'px');
  }

  function startResize(ev) {
    ev.preventDefault();
    var startX = ev.clientX;
    var root = document.documentElement;
    var startW = parseInt(getComputedStyle(root).getPropertyValue('--pa-doc-w'), 10) || 400;
    function move(e) {
      var w = Math.min(680, Math.max(300, startW + (startX - e.clientX)));
      root.style.setProperty('--pa-doc-w', w + 'px');
      scheduleRefreshPositions();
    }
    function up(e) {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      var w = parseInt(getComputedStyle(root).getPropertyValue('--pa-doc-w'), 10) || 400;
      try { localStorage.setItem(DOC_W_KEY, String(w)); } catch (err) {}
      scheduleRefreshPositions();
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }

  // 点批注点 → 定位到文档对应条目
  function focusDocEntry(item) {
    var entry = document.getElementById('pa-doc-' + item.id);
    if (!entry) return;
    entry.classList.remove('is-hidden');
    document.querySelectorAll('.pa-doc-item.is-active').forEach(function (el) { el.classList.remove('is-active'); });
    entry.classList.add('is-active');
    if (entry.scrollIntoView) entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelectorAll('.pa-card').forEach(function (c) { c.classList.remove('visible'); });
    if (item._target) item._target.classList.add('pa-highlight');
  }

  // 点文档条目 → 回到原型里高亮对应区域
  function fromDocEntry(id) {
    var item = null;
    config.annotations.forEach(function (a) { if (a.id === id) item = a; });
    if (!item || !item._target) return;
    document.querySelectorAll('.pa-doc-item.is-active').forEach(function (el) { el.classList.remove('is-active'); });
    var entry = document.getElementById('pa-doc-' + id);
    if (entry) entry.classList.add('is-active');
    document.querySelectorAll('.pa-highlight').forEach(function (el) { el.classList.remove('pa-highlight'); });
    item._target.classList.add('pa-highlight');
    if (item._target.scrollIntoView) item._target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    scheduleRefreshPositions();
    window.setTimeout(function () { item._target.classList.remove('pa-highlight'); }, 2600);
  }

  function filterDoc(kw) {
    docQuery = String(kw || '').trim().toLowerCase();
    var n = applyDocVisibility();
    updateDocHeader(n);
    if (enabled) refreshPositions();
  }

  function toggleScope() {
    docShowAll = !docShowAll;
    var n = applyDocVisibility();
    updateDocHeader(n);
    if (enabled) refreshPositions();
  }

  function refreshPositions() {
    config.annotations.forEach(function (item) {
      if (!item._marker || !item._target) return;
      // 目标不可见（弹窗未打开、display:none、position:fixed 但被隐藏）时不定位
      if (!item._visible || !item._target.getClientRects().length) {
        item._marker.classList.remove('visible');
        item._marker.style.display = 'none';
        return;
      }
      item._marker.style.display = '';
      positionMarker(item._marker, item._target, item.position);
    });
  }

  function buildUI() {
    injectStyles();
    ensureRoot();
    createToggle();

    var root = document.getElementById(ROOT_ID);
    root.innerHTML = '';

    config.annotations.forEach(function (item, index) {
      var num = index + 1;
      var target = document.querySelector(item.selector);
      if (!target) return;

      var marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'pa-marker';
      marker.textContent = String(num);
      marker.title = item.title;
      marker.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!enabled) setEnabled(true);
        focusDocEntry(item);
      });
      root.appendChild(marker);
      positionMarker(marker, target, item.position);

      var card = document.createElement('div');
      card.id = 'pa-card-' + item.id;
      card.className = 'pa-card' + (item.wide ? ' wide' : '');
      card.innerHTML =
        '<div class="pa-card-head">' +
          '<span class="pa-card-num">' + num + '</span>' +
          '<span class="pa-card-title">' + item.title + '</span>' +
          '<span class="pa-card-close"><i class="fa fa-times"></i></span>' +
        '</div>' +
        '<div class="pa-card-body">' + item.content + '</div>' +
        (item.tag ? '<span class="pa-card-tag">' + item.tag + '</span>' : '');
      card.querySelector('.pa-card-close').addEventListener('click', function () {
        card.classList.remove('visible');
        if (target) target.classList.remove('pa-highlight');
      });
      root.appendChild(card);

      item._inModal = !!modalAncestor(target);
      item._marker = marker;
      item._card = card;
      item._cardNum = card.querySelector('.pa-card-num');
      item._target = target;
    });

    buildDocPanel();
    bindScrollListeners();
    // 可见性（含「弹窗内需求只在弹窗打开时列出/显示」）统一由 applyFocusScope → applyDocVisibility 决定
    applyFocusScope();
  }

  function setEnabled(on) {
    enabled = !!on;
    saveEnabled(enabled);
    var btn = document.querySelector('.pa-toggle');
    if (btn) {
      btn.classList.toggle('on', enabled);
      btn.classList.toggle('off', !enabled);
      btn.querySelector('span').textContent = enabled ? '需求文档：开' : '需求文档';
    }
    document.documentElement.classList.toggle('pa-doc-open', enabled);
    if (enabled) { buildDocPanel(); }
    applyFocusScope();
    if (!enabled) {
      document.querySelectorAll('.pa-marker').forEach(function (m) { m.classList.remove('visible'); });
      document.querySelectorAll('.pa-card').forEach(function (c) { c.classList.remove('visible'); });
      document.querySelectorAll('.pa-highlight').forEach(function (el) { el.classList.remove('pa-highlight'); });
    }
  }

  function mergeBuiltin(list) {
    var arr = (list || []).slice();
    BUILTIN_ANNOTATIONS.forEach(function (b) {
      if (!arr.some(function (a) { return a.id === b.id; })) arr.push(b);
    });
    return arr;
  }

  function init(options) {
    config = options || { annotations: [] };
    config.annotations = mergeBuiltin(config.annotations);
    function boot() {
      buildUI();
      if (options && options.defaultOn) {
        setEnabled(true);
      } else {
        setEnabled(loadEnabled());
      }
      if (!window._paModalObserver) {
        window._paModalObserver = new MutationObserver(function () {
          if (window._paScopeRaf) return;
          window._paScopeRaf = window.requestAnimationFrame(function () {
            window._paScopeRaf = 0;
            applyFocusScope();
          });
        });
        window._paModalObserver.observe(document.body, OBS_OPTS);
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }
  window.addEventListener('load', autoBoot);

  // 未被页面显式 init 时，自动兜底启动一次：没有批注的页面也给出统一的文档侧栏与空态提示
  function autoBoot() {
    if (window._paBooted) return;
    window._paBooted = true;
    init({ annotations: [] });
  }

  global.PrototypeAnnotation = {
    init: function (options) {
      window._paBooted = true;
      init(options);
    },
    _startResize: startResize,
    _filter: filterDoc,
    _toggleScope: toggleScope,
    _fromDoc: fromDocEntry,
    setEnabled: setEnabled,
    refresh: buildUI,
    applyFocusScope: applyFocusScope,
    isEnabled: function () { return enabled; }
  };
})(window);
