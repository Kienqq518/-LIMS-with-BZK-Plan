/**
 * 原型批注模式（全局：localStorage 持久化，跨页面保持开启状态）
 */
(function (global) {
  var STYLE_ID = 'prototype-annotation-styles';
  var ROOT_ID = 'prototype-annotation-root';
  var STORAGE_KEY = 'lims-prototype-annotation-enabled';
  var enabled = false;
  var config = { annotations: [] };

  var css = [
    '#prototype-annotation-root { position: fixed; inset: 0; pointer-events: none; z-index: 9990; overflow: visible; }',
    '#prototype-annotation-root * { pointer-events: auto; }',
    '.pa-toggle { position: fixed; right: 20px; bottom: 20px; z-index: 10001; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; font-size: 13px; font-weight: 500; box-shadow: 0 4px 14px rgba(15,23,42,.18); cursor: pointer; border: none; transition: all .2s; }',
    '.pa-toggle.off { background: #fff; color: #475569; }',
    '.pa-toggle.on { background: #f97316; color: #fff; }',
    '.pa-marker { position: fixed; z-index: 9995; width: 22px; height: 22px; border-radius: 50%; background: #f97316; color: #fff; font-size: 12px; font-weight: 700; display: none; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(249,115,22,.45); cursor: pointer; border: 2px solid #fff; }',
    '.pa-marker.visible { display: flex; }',
    '.pa-marker:hover { transform: scale(1.1); }',
    '.pa-card { position: fixed; z-index: 10000; width: 340px; max-width: calc(100vw - 24px); max-height: calc(100vh - 100px); overflow-y: auto; background: #fffbeb; border: 1px solid #fcd34d; border-left: 4px solid #f97316; border-radius: 8px; padding: 12px 14px; box-shadow: 0 8px 24px rgba(15,23,42,.12); display: none; font-size: 13px; color: #334155; line-height: 1.6; }',
    '.pa-card.wide { width: 400px; max-width: calc(100vw - 24px); }',
    '.pa-card.visible { display: block; }',
    '.pa-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 6px; }',
    '.pa-card-num { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: #f97316; color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }',
    '.pa-card-title { font-weight: 600; color: #c2410c; flex: 1; }',
    '.pa-card-close { color: #94a3b8; cursor: pointer; font-size: 14px; line-height: 1; }',
    '.pa-card-close:hover { color: #64748b; }',
    '.pa-card-body { color: #475569; }',
    '.pa-card-tag { display: inline-block; margin-top: 8px; padding: 2px 8px; border-radius: 4px; background: #ffedd5; color: #c2410c; font-size: 11px; }',
    '.pa-highlight { outline: 2px dashed #f97316 !important; outline-offset: 3px; border-radius: 4px; }'
  ].join('\n');

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

    if (position === 'left' || (position === 'bottom-left' && nearRight)) {
      marker.style.top = Math.min(window.innerHeight - size - 80, Math.max(4, rect.top + rect.height / 2 - 11)) + 'px';
      marker.style.left = Math.max(4, rect.left - size - 4) + 'px';
    } else if (position === 'top-right') {
      marker.style.top = Math.max(4, rect.top - 6) + 'px';
      marker.style.left = Math.min(window.innerWidth - size - 4, rect.right - 10) + 'px';
    } else if (position === 'top-left') {
      marker.style.top = Math.max(4, rect.top - 6) + 'px';
      marker.style.left = Math.max(4, rect.left - 10) + 'px';
    } else if (position === 'bottom-right') {
      marker.style.top = Math.min(window.innerHeight - size - 80, rect.bottom - 14) + 'px';
      marker.style.left = Math.min(window.innerWidth - size - 4, rect.right - 10) + 'px';
    } else if (position === 'bottom-left') {
      marker.style.top = Math.min(window.innerHeight - size - 80, nearBottom ? rect.top - size - 4 : rect.bottom - 14) + 'px';
      marker.style.left = Math.max(4, nearRight ? rect.left - size - 4 : rect.left - 10) + 'px';
    } else {
      marker.style.top = (rect.top + rect.height / 2 - 11) + 'px';
      marker.style.left = Math.min(window.innerWidth - size - 4, rect.right + 4) + 'px';
    }
  }

  function positionCard(card, marker, item) {
    card.classList.add('visible');
    var cardW = card.offsetWidth || (item.wide ? 400 : 340);
    var cardH = card.offsetHeight || 160;
    var mRect = marker.getBoundingClientRect();
    var pad = 12;
    var bottomReserve = 88;
    var left, top;
    var nearRight = mRect.left > window.innerWidth * 0.55;
    var nearBottom = mRect.top > window.innerHeight * 0.55;

    if (item.position === 'top-left') {
      left = mRect.left - cardW + 20;
      top = mRect.top - 8;
    } else if (item.position === 'bottom-left') {
      left = nearRight ? (mRect.left - cardW - 8) : (mRect.left - cardW + 20);
      top = nearBottom ? (mRect.top - cardH - 8) : (mRect.bottom + 8);
    } else if (item.position === 'bottom-right') {
      left = mRect.right - cardW;
      top = mRect.bottom + 8;
    } else if (item.position === 'left') {
      left = mRect.left - cardW - 8;
      top = mRect.top + mRect.height / 2 - cardH / 2;
    } else {
      left = mRect.right - 20;
      top = mRect.bottom + 8;
    }

    if (top + cardH > window.innerHeight - bottomReserve) {
      top = mRect.top - cardH - 8;
    }
    if (top < pad) top = pad;
    if (left + cardW > window.innerWidth - pad) {
      left = window.innerWidth - cardW - pad;
    }
    if (left < pad) {
      left = pad;
      if (mRect.right + cardW + 16 < window.innerWidth - pad) {
        left = mRect.right + 8;
      }
    }

    card.style.top = top + 'px';
    card.style.left = left + 'px';
  }

  function showCard(item, marker) {
    ensureRoot();
    document.querySelectorAll('.pa-card').forEach(function (c) { c.classList.remove('visible'); });
    document.querySelectorAll('.pa-highlight').forEach(function (el) { el.classList.remove('pa-highlight'); });

    var card = document.getElementById('pa-card-' + item.id);
    if (!card) return;

    var target = document.querySelector(item.selector);
    if (target) target.classList.add('pa-highlight');

    card.style.visibility = 'hidden';
    card.classList.add('visible');
    positionCard(card, marker, item);
    card.style.visibility = '';
  }

  function refreshPositions() {
    config.annotations.forEach(function (item) {
      if (item._marker && item._target) positionMarker(item._marker, item._target, item.position);
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
      if (enabled) marker.classList.add('visible');

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
      item._target = target;
    });
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
    document.querySelectorAll('.pa-marker').forEach(function (m) {
      m.classList.toggle('visible', enabled);
    });
    if (!enabled) {
      document.querySelectorAll('.pa-card').forEach(function (c) { c.classList.remove('visible'); });
      document.querySelectorAll('.pa-highlight').forEach(function (el) { el.classList.remove('pa-highlight'); });
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
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
    if (!window._paGlobalListeners) {
      window._paGlobalListeners = true;
      window.addEventListener('resize', refreshPositions);
      window.addEventListener('scroll', refreshPositions, true);
    }
  }

  global.PrototypeAnnotation = {
    init: init,
    setEnabled: setEnabled,
    refresh: buildUI,
    isEnabled: function () { return enabled; }
  };
})(window);
