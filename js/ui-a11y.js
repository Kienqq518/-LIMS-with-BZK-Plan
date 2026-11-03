/**
 * 全站无障碍补丁（与 css/ui-baseline.css 配套）
 * 只做机械可判定的修复，不改业务 DOM 语义：
 *  1) 装饰性图标 aria-hidden；图标即按钮的补可访问名
 *  2) 只有 title 没有名字的控件，用 title 兜底成 aria-label
 *  3) 实际横向溢出的表格包一层滚动容器，并让它可键盘滚动
 *  4) 带 onclick 的非交互元素升级为 role=button + 键盘可触发
 * 规则依据：ui-ux-pro-max ux/ARIA Labels（High）、icons/icon-context-accessibility、
 *          ux/Table Handling（High）、checklist「No emojis as icons / cursor-pointer」
 */
(function (global) {
  'use strict';

  var ICON_LABELS = [
    ['fa-times-circle', '关闭'], ['fa-times', '关闭'], ['fa-remove', '删除'], ['fa-trash', '删除'],
    ['fa-plus-circle', '新增'], ['fa-plus', '新增'], ['fa-minus', '收起'], ['fa-edit', '编辑'],
    ['fa-pencil', '编辑'], ['fa-search', '搜索'], ['fa-filter', '筛选'], ['fa-refresh', '刷新'],
    ['fa-download', '下载'], ['fa-upload', '上传'], ['fa-print', '打印'], ['fa-file-excel-o', '导出 Excel'],
    ['fa-file-pdf-o', '导出 PDF'], ['fa-file-word-o', '导出 Word'], ['fa-paperclip', '附件'],
    ['fa-eye', '查看'], ['fa-eye-slash', '隐藏'], ['fa-check', '确认'], ['fa-check-circle', '通过'],
    ['fa-exclamation-triangle', '警告'], ['fa-info-circle', '说明'], ['fa-question-circle', '帮助'],
    ['fa-chevron-down', '展开'], ['fa-chevron-up', '收起'], ['fa-chevron-left', '上一页'],
    ['fa-chevron-right', '下一页'], ['fa-angle-down', '展开'], ['fa-angle-right', '前进'],
    ['fa-ellipsis-h', '更多操作'], ['fa-cog', '设置'], ['fa-calendar', '日期'], ['fa-user', '人员'],
    ['fa-users', '人员'], ['fa-bell', '通知'], ['fa-link', '链接'], ['fa-copy', '复制'],
    ['fa-external-link', '新窗口打开'], ['fa-camera', '拍照'], ['fa-image', '图片'],
    ['fa-map-marker', '地点'], ['fa-save', '保存'], ['fa-sign-out', '退出'], ['fa-bars', '菜单'],
    ['fa-list', '列表'], ['fa-tag', '标签'], ['fa-qrcode', '二维码'], ['fa-barcode', '条码'],
    ['fa-flask', '试验'], ['fa-cube', '样品'], ['fa-file-text-o', '文档'], ['fa-folder-open-o', '打开']
  ];

  function labelForIcon(el) {
    var cls = ' ' + (el.className || '') + ' ';
    for (var i = 0; i < ICON_LABELS.length; i++) {
      if (cls.indexOf(' ' + ICON_LABELS[i][0] + ' ') >= 0 || cls.indexOf(ICON_LABELS[i][0]) >= 0) {
        return ICON_LABELS[i][1];
      }
    }
    return '';
  }

  function controlOf(el) {
    var n = el.parentElement, depth = 0;
    while (n && depth < 5) {
      var t = n.tagName;
      if (t === 'BUTTON' || t === 'A' || t === 'LABEL' || n.getAttribute('role') === 'button' || n.onclick) return n;
      n = n.parentElement; depth++;
    }
    return null;
  }

  function hasOwnText(ctrl, icon) {
    // 图标字体本身不产生文本节点，所以 textContent 就是可见文字
    var txt = (ctrl.textContent || '').replace(/\s+/g, '');
    return txt.length > 0;
  }

  function fixIcons(root) {
    var icons = root.querySelectorAll('i.fa, i.fas, i.far, i.fab, i[class^="fa-"], i[class*=" fa-"]');
    [].forEach.call(icons, function (ic) {
      if (ic.hasAttribute('aria-hidden') || ic.getAttribute('role')) return;
      var ctrl = controlOf(ic);
      if (!ctrl) {
        // 独立图标：有相邻文字就当地位装饰，没有就当图形读出来
        var sib = (ic.parentElement && (ic.parentElement.textContent || '').replace(/\s+/g, '')) || '';
        if (sib) ic.setAttribute('aria-hidden', 'true');
        else { ic.setAttribute('role', 'img'); ic.setAttribute('aria-label', labelForIcon(ic) || '图标'); }
        return;
      }
      if (hasOwnText(ctrl, ic)) { ic.setAttribute('aria-hidden', 'true'); return; }
      if (ctrl.hasAttribute('aria-label')) { ic.setAttribute('aria-hidden', 'true'); return; }
      var name = (ctrl.getAttribute('title') || labelForIcon(ic) || '').trim();
      if (name) { ctrl.setAttribute('aria-label', name); ic.setAttribute('aria-hidden', 'true'); }
      else ic.setAttribute('aria-hidden', 'true');
    });
  }

  function fixTitleOnly(root) {
    var els = root.querySelectorAll('[title]');
    [].forEach.call(els, function (el) {
      var tag = el.tagName;
      if (tag !== 'BUTTON' && tag !== 'A' && el.getAttribute('role') !== 'button') return;
      if (el.getAttribute('aria-label') || (el.textContent || '').replace(/\s+/g, '')) return;
      el.setAttribute('aria-label', el.getAttribute('title'));
    });
  }

  function scrollableAncestor(el) {
    var n = el.parentElement;
    while (n && n !== document.body) {
      var st = window.getComputedStyle(n);
      if (/(auto|scroll|overlay)/.test(st.overflowX + st.overflowY)) return n;
      n = n.parentElement;
    }
    return null;
  }

  // 表格在窄容器里被裁掉而不是可滚动，是这批后台页最常见的响应式问题
  function fixTables(root) {
    var tables = root.querySelectorAll('table');
    [].forEach.call(tables, function (tb) {
      if (tb.dataset.uiTableDone) return;
      tb.dataset.uiTableDone = '1';
      var holder = tb.parentElement;
      if (!holder || holder.classList.contains('ui-table-scroll')) return;
      if (scrollableAncestor(tb)) return;
      if (tb.scrollWidth <= holder.clientWidth + 2) return;
      var wrap = document.createElement('div');
      wrap.className = 'ui-table-scroll';
      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-label', '可横向滚动的表格');
      wrap.setAttribute('tabindex', '0');
      holder.insertBefore(wrap, tb);
      wrap.appendChild(tb);
    });
  }

  // 只有 onclick 的 div/span：键盘完全点不到
  function fixClickable(root) {
    var els = root.querySelectorAll('div[onclick], span[onclick], td[onclick], i[onclick]');
    [].forEach.call(els, function (el) {
      if (el.getAttribute('role') || el.getAttribute('tabindex')) return;
      var st = window.getComputedStyle(el);
      if (st.cursor !== 'pointer') return;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
          ev.preventDefault();
          el.click();
        }
      });
    });
  }

  function process(root) {
    if (!root || !root.querySelectorAll) return;
    try { fixIcons(root); fixTitleOnly(root); fixTables(root); fixClickable(root); } catch (e) { /* 原型页，静默 */ }
  }

  function boot() {
    process(document);
    if (window.MutationObserver && !global.__uiA11yObserver) {
      global.__uiA11yObserver = new MutationObserver(function (muts) {
        for (var i = 0; i < muts.length; i++) {
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++) {
            if (added[j].nodeType === 1) process(added[j]);
          }
        }
      });
      global.__uiA11yObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.UIA11y = { process: process, iconLabels: ICON_LABELS };
})(window);
