/**
 * 原型批注模式
 * 开启后在页面元素旁显示编号锚点与批注卡片，用于说明功能整改点
 */
(function (global) {
  var STYLE_ID = 'prototype-annotation-styles';
  var ROOT_ID = 'prototype-annotation-root';
  var enabled = false;
  var config = { annotations: [] };

  var css = [
    '#prototype-annotation-root { position: fixed; inset: 0; pointer-events: none; z-index: 9990; overflow: hidden; }',
    '#prototype-annotation-root * { pointer-events: auto; }',
    '.pa-toggle { position: fixed; right: 20px; bottom: 20px; z-index: 9999; display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; font-size: 13px; font-weight: 500; box-shadow: 0 4px 14px rgba(15,23,42,.18); cursor: pointer; border: none; transition: all .2s; }',
    '.pa-toggle.off { background: #fff; color: #475569; }',
    '.pa-toggle.on { background: #f97316; color: #fff; }',
    '.pa-marker { position: absolute; z-index: 9990; width: 22px; height: 22px; border-radius: 50%; background: #f97316; color: #fff; font-size: 12px; font-weight: 700; display: none; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(249,115,22,.45); cursor: pointer; border: 2px solid #fff; }',
    '.pa-marker.visible { display: flex; }',
    '.pa-marker:hover { transform: scale(1.1); }',
    '.pa-card { position: fixed; z-index: 9998; width: 340px; max-width: calc(100vw - 40px); background: #fffbeb; border: 1px solid #fcd34d; border-left: 4px solid #f97316; border-radius: 8px; padding: 12px 14px; box-shadow: 0 8px 24px rgba(15,23,42,.12); display: none; font-size: 13px; color: #334155; line-height: 1.6; }',
    '.pa-card.wide { width: 400px; }',
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

    if (position === 'top-right') {
      marker.style.top = (rect.top - 8) + 'px';
      marker.style.left = (rect.left + rect.width - 8) + 'px';
    } else if (position === 'top-left') {
      marker.style.top = (rect.top - 8) + 'px';
      marker.style.left = (rect.left - 8) + 'px';
    } else if (position === 'bottom-right') {
      marker.style.top = (rect.top + rect.height - 14) + 'px';
      marker.style.left = (rect.left + rect.width - 8) + 'px';
    } else {
      marker.style.top = (rect.top + rect.height / 2 - 11) + 'px';
      marker.style.left = (rect.left + rect.width + 4) + 'px';
    }
  }

  function showCard(item, marker) {
    var root = ensureRoot();
    root.querySelectorAll('.pa-card').forEach(function (c) { c.classList.remove('visible'); });
    document.querySelectorAll('.pa-highlight').forEach(function (el) { el.classList.remove('pa-highlight'); });

    var card = document.getElementById('pa-card-' + item.id);
    if (!card) return;

    var target = document.querySelector(item.selector);
    if (target) target.classList.add('pa-highlight');

    var mRect = marker.getBoundingClientRect();
    var cardTop = mRect.bottom + 8;
    var cardLeft = Math.min(mRect.left, window.innerWidth - 320);
    if (cardTop + 180 > window.innerHeight) cardTop = mRect.top - 160;

    card.style.top = cardTop + 'px';
    card.style.left = Math.max(12, cardLeft) + 'px';
    card.classList.add('visible');
  }

  function buildUI() {
    injectStyles();
    ensureRoot();
    if (!document.querySelector('.pa-toggle')) createToggle();

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
      card.style.position = 'fixed';
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
    enabled = on;
    var btn = document.querySelector('.pa-toggle');
    if (btn) {
      btn.classList.toggle('on', on);
      btn.classList.toggle('off', !on);
      btn.querySelector('span').textContent = on ? '批注模式：开' : '原型批注模式';
    }
    document.querySelectorAll('.pa-marker').forEach(function (m) {
      m.classList.toggle('visible', on);
    });
    if (!on) {
      document.querySelectorAll('.pa-card').forEach(function (c) { c.classList.remove('visible'); });
      document.querySelectorAll('.pa-highlight').forEach(function (el) { el.classList.remove('pa-highlight'); });
    }
  }

  function init(options) {
    config = options || { annotations: [] };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        buildUI();
        if (options && options.defaultOn) setEnabled(true);
      });
    } else {
      buildUI();
      if (options && options.defaultOn) setEnabled(true);
    }
    window.addEventListener('resize', function () {
      config.annotations.forEach(function (item) {
        if (item._marker && item._target) positionMarker(item._marker, item._target, item.position);
      });
    });
  }

  global.PrototypeAnnotation = {
    init: init,
    setEnabled: setEnabled,
    refresh: buildUI
  };
})(window);
