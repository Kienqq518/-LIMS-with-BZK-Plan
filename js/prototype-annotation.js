/**
 * 原型批注模式（全局：localStorage 持久化，跨页面保持开启状态）
 */
(function (global) {
  var STYLE_ID = 'prototype-annotation-styles';
  var ROOT_ID = 'prototype-annotation-root';
  var STORAGE_KEY = 'lims-prototype-annotation-enabled';
  var enabled = false;
  var config = { annotations: [] };
  var focusScopeEl = null;

  var css = [
    'html { position: relative; }',
    '#prototype-annotation-root { position: absolute; top: 0; left: 0; width: 0; height: 0; pointer-events: none; z-index: 9990; overflow: visible; }',
    '#prototype-annotation-root * { pointer-events: auto; }',
    '.pa-toggle { position: fixed; right: 20px; bottom: 20px; z-index: 10001; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; font-size: 13px; font-weight: 500; box-shadow: 0 4px 14px rgba(15,23,42,.18); cursor: pointer; border: none; transition: all .2s; }',
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
    '.pa-highlight { outline: 2px dashed #f97316 !important; outline-offset: 3px; border-radius: 4px; }'
  ].join('\n');

  function detectFocusScope() {
    // 取最后一个匹配：嵌套弹窗（如关联试验内的同步、履历内的表单）通常后挂载且 z-index 更高
    var openModals = document.querySelectorAll('.modal-mask.open, .lc-modal-mask.open, .po-mask.open, .drawer-mask.open, .bind-popover-mask.open, #numberingModal.flex');
    if (!openModals.length) return null;
    return openModals[openModals.length - 1];
  }

  function isInFocusScope(el) {
    if (!focusScopeEl) return true;
    if (!el) return false;
    return focusScopeEl.contains(el);
  }

  function applyFocusScope() {
    // 执行期间暂停观察器：本函数会修改 marker/card 及目标元素（如高亮）的 class，
    // 这些改动位于被观察的 document.body 子树内，若不暂停会反复触发观察器，
    // 形成死循环导致页面卡死（点击弹窗等场景会明显卡死）。
    var obs = window._paModalObserver;
    if (obs) obs.disconnect();
    focusScopeEl = detectFocusScope();
    config.annotations.forEach(function (item) {
      var inScope = isInFocusScope(item._target);
      if (item._marker) {
        item._marker.classList.toggle('pa-dimmed', !inScope);
        if (!inScope) item._marker.classList.remove('visible');
        else if (enabled) item._marker.classList.add('visible');
      }
      if (item._card) {
        item._card.classList.toggle('pa-dimmed', !inScope);
        if (!inScope) {
          item._card.classList.remove('visible');
          if (item._target) item._target.classList.remove('pa-highlight');
        }
      }
    });
    if (enabled) refreshPositions();
    if (obs) obs.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
  }

  function loadEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
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
    btn.innerHTML = '<i class="fa fa-commenting-o"></i><span>原型批注模式</span>';
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

  function refreshPositions() {
    config.annotations.forEach(function (item) {
      if (!item._marker || !item._target) return;
      if (focusScopeEl && !isInFocusScope(item._target)) {
        item._marker.style.display = 'none';
        return;
      }
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
        showCard(item, marker);
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

      item._marker = marker;
      item._card = card;
      item._target = target;
    });

    bindScrollListeners();
    applyFocusScope();
    if (enabled) {
      config.annotations.forEach(function (item) {
        if (item._marker && isInFocusScope(item._target)) item._marker.classList.add('visible');
      });
    }
  }

  function setEnabled(on) {
    enabled = !!on;
    saveEnabled(enabled);
    var btn = document.querySelector('.pa-toggle');
    if (btn) {
      btn.classList.toggle('on', enabled);
      btn.classList.toggle('off', !enabled);
      btn.querySelector('span').textContent = enabled ? '批注模式：开' : '原型批注模式';
    }
    applyFocusScope();
    if (!enabled) {
      document.querySelectorAll('.pa-marker').forEach(function (m) { m.classList.remove('visible'); });
      document.querySelectorAll('.pa-card').forEach(function (c) { c.classList.remove('visible'); });
      document.querySelectorAll('.pa-highlight').forEach(function (el) { el.classList.remove('pa-highlight'); });
    } else {
      config.annotations.forEach(function (item) {
        if (item._marker && isInFocusScope(item._target)) item._marker.classList.add('visible');
      });
    }
  }

  function init(options) {
    config = options || { annotations: [] };
    function boot() {
      buildUI();
      if (options && options.defaultOn) {
        setEnabled(true);
      } else {
        setEnabled(loadEnabled());
      }
      if (!window._paModalObserver) {
        window._paModalObserver = new MutationObserver(function () {
          applyFocusScope();
        });
        window._paModalObserver.observe(document.body, {
          attributes: true,
          attributeFilter: ['class'],
          subtree: true
        });
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  global.PrototypeAnnotation = {
    init: init,
    setEnabled: setEnabled,
    refresh: buildUI,
    applyFocusScope: applyFocusScope,
    isEnabled: function () { return enabled; }
  };
})(window);
