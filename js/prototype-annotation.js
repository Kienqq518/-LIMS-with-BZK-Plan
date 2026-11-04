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
        '<strong>展示规则：</strong>表头最后一列（操作）右侧固定一个 ☰ 入口。<strong>「序号」「委托编号」「操作」是固定列</strong>：横向滚动时不动（表头带勾选列的话勾选列一起钉在左侧），面板里这三列显示「固定」标记，<strong>不可隐藏、不可调序</strong>（开关置灰、↑↓ 禁用、拖拽手柄变锁），历史草稿里若曾隐藏过这三列，打开面板或保存时会自动恢复。点开为「列配置」面板：顶部搜索框（按字段名过滤条目），每行依次是拖拽手柄 ≡、字段名、上移/下移按钮、是否展示开关，底部为「重 置」「保 存」。关闭的字段在表头与表体一起不展示，不留空列；空态行的跨列宽度同步修正。横向滚动时<strong>前两列与最后一列冻结</strong>，中间列滚动；可见列不足 5 列时不冻结，避免左右两块重叠。冻结边界仅在真正滚动后显示分隔投影。<br>' +
        '<strong>交互逻辑：</strong>面板内改动即时预览但不落库；点「保存」写入 localStorage（按页面分别记忆），刷新、重进、跳转回来都保持；点 × 或面板外区域关闭则丢弃未保存的草稿；「重 置」恢复该页默认顺序与全部展示。拖拽或 ↑↓ 调整顺序后，冻结列、序号列编号、入口按钮位置都会跟着重算；列表被页面重绘或窗口尺寸变化时自动重新套用。列身份默认取表头文字，<strong>只改列名时给表头加 <code>data-col-key</code> 钉住旧列名</strong>，各人已保存的顺序与显隐不会因改名失效（例：样品收样的「客户要求完成日期」改名为「要求检测完成天数」）。',
      tag: '列表通用'
    },
    {
      id: 'modal-drag',
      selector: '[data-md-handle]',
      position: 'top-right',
      title: '弹窗可拖动（按住标题栏）',
      wide: true,
      content: '<strong>需求逻辑：</strong>弹窗里要边看边对着列表核对（选人、收样、退样、配置项都很长），' +
        '固定居中会挡住背后的列表，需要能随手挪开。<br>' +
        '<strong>展示规则：</strong>弹窗标题栏是拖动手柄（鼠标变抓取手势，悬停提示「按住标题栏可拖动弹窗，双击复位」）；' +
        '标题栏上的关闭按钮、输入框、下拉、链接不触发拖动，照常点击；' +
        '弹窗只能在视口内移动，不会被拖出屏幕找不回来。<br>' +
        '<strong>交互逻辑：</strong>按住拖动即时跟手；<strong>双击标题栏复位</strong>到居中；' +
        '位置只影响本次浏览，不做持久化，刷新后回到默认居中；需求文档舞台缩放时拖动距离与鼠标一致。',
      tag: '全局交互'
    }
  ];
  var focusScopeEl = null;
  var docShowAll = false;   // 弹窗打开时，用户手动切回「看页面全部需求」
  var docQuery = '';        // 需求文档搜索词

  /* 外壳导航尺寸：侧边栏 w-48、顶栏 h-14（css 字符串里要用，必须先于 css 定义） */
  var SIDE_W = 192;
  var HEAD_H = 56;

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
    ':root { --pa-doc-w: 400px; --pa-scale: 1; --pa-inv: 1; --pa-design-h: 900px; }',
    /* 原型不再靠 body 收窄重排，而是进固定宽高比舞台；开关让位给舞台 */
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
    /* ===== 原型舞台：需求文档打开时，左侧原型收进固定宽高比画布，等比缩放不重排 ===== */
    '#pa-stage { position: fixed; z-index: 9998; display: none; overflow: hidden; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 18px 48px rgba(15,23,42,.16); }',
    'html.pa-doc-open #pa-stage { display: block; }',
    '.pa-stage-bar { position: absolute; top: 0; left: 0; right: 0; height: 36px; display: flex; align-items: center; gap: 10px; padding: 0 10px 0 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; z-index: 2; }',
    '.pa-stage-name { font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
    '.pa-stage-meta { flex-shrink: 0; color: #94a3b8; font-variant-numeric: tabular-nums; }',
    '.pa-stage-acts { margin-left: auto; display: flex; gap: 6px; flex-shrink: 0; }',
    '.pa-stage-btn { border: 1px solid #e2e8f0; background: #fff; color: #475569; border-radius: 5px; padding: 2px 8px; font-size: 12px; cursor: pointer; transition: all .18s; }',
    '.pa-stage-btn:hover { border-color: #fb923c; color: #c2410c; }',
    '.pa-stage-btn:focus-visible { outline: 2px solid #1e40af; outline-offset: 1px; }',
    '.pa-stage-btn.is-active { border-color: #fb923c; background: #ffedd5; color: #c2410c; font-weight: 600; }',
    /* 外壳导航（侧边栏 + 顶栏）克隆进画布：菜单栏属于原型的一部分 */
    '.pa-chrome { position: absolute; inset: 0; z-index: 2; pointer-events: none; }',
    '.pa-chrome > * { pointer-events: auto; }',
    '.pa-chrome-head { position: absolute; left: 0; right: 0; top: 0; }',
    '.pa-chrome-side { position: absolute; left: 0; top: ' + HEAD_H + 'px; bottom: 0; width: ' + SIDE_W + 'px; }',
    '.pa-chrome-side > aside { height: 100%; }',
    '.pa-chrome .submenu { max-height: 0; overflow: hidden; transition: max-height .3s ease; }',
    '.pa-chrome .submenu.open { max-height: 500px; }',
    '.pa-chrome .menu-arrow { transition: transform .3s ease; }',
    '.pa-chrome .menu-arrow.open { transform: rotate(90deg); }',
    '.pa-stage-view { position: absolute; top: 36px; left: 0; right: 0; bottom: 0; overflow: auto; background: #eef2f7; }',
    /* canvas = 固定尺寸的可视视口，本身不滚动，弹窗等 fixed 层才能钉在框内 */
    '#pa-canvas { position: absolute; top: 0; left: 0; width: 1440px; height: 900px; transform-origin: 0 0; transform: scale(var(--pa-scale)); overflow: hidden; background: #fff; box-shadow: 0 0 0 1px rgba(15,23,42,.06); }',
    '#pa-scroll { position: absolute; top: 0; left: 0; width: 1440px; height: 900px; overflow: auto; }',
    '#pa-scroll:focus-visible { outline: 2px solid #1e40af; outline-offset: -2px; }',
    /* vh 依赖换算成设计视口，避免 min-h-screen 被真实窗口高度撑破 */
    '#pa-scroll .min-h-screen { min-height: var(--pa-design-h) !important; }',
    '#pa-scroll .h-screen { height: var(--pa-design-h) !important; }',
    /* 批注层挂在 canvas 上（不受滚动裁剪），再用位移跟随内容滚动 */
    '#prototype-annotation-root { transform: translate(calc(-1 * var(--pa-sl, 0px)), calc(-1 * var(--pa-st, 0px))); }',
    /* 批注层搬进画布后反向缩放：画布缩到多小，圆点与卡片都保持可读尺寸 */
    '#pa-canvas .pa-marker { transform-origin: 0 0; transform: scale(var(--pa-inv)); }',
    '#pa-canvas .pa-marker:hover { transform: scale(calc(var(--pa-inv) * 1.1)); }',
    '#pa-canvas .pa-card { transform-origin: 0 0; transform: scale(var(--pa-inv)); max-height: calc(var(--pa-design-h) - 100px); max-width: calc(var(--pa-design-w) - 24px); }',
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
        sub.innerHTML = (docShowAll
          ? '全部需求（含弹窗） · ' + total + ' 条'
          : '弹窗需求：' + t + ' · ' + cnt + ' 条') +
          '<span class="pa-doc-scope" onclick="PrototypeAnnotation._toggleScope()">' +
          (docShowAll ? '只看「' + t + '」需求' : '看全部需求') + '</span>';
      }
      if (hint) {
        if (docShowAll) {
          hint.className = 'pa-doc-focus warn';
          hint.innerHTML = '已切回全部需求（含其他弹窗）。<span class="pa-doc-scope" onclick="PrototypeAnnotation._toggleScope()">只看「' + t + '」弹窗需求</span>';
          hint.style.display = '';
        } else if (cnt) {
          hint.className = 'pa-doc-focus';
          hint.innerHTML = '当前弹窗：<strong>' + t + '</strong> · 已切换为该弹窗的 ' + cnt + ' 条需求' +
            '<span class="pa-doc-scope" onclick="PrototypeAnnotation._toggleScope()">看全部需求</span>';
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
    // 弹窗此前被隐藏祖先挡住而未提升，此刻可见了，补一次提升，否则会跟着滚动层跑
    if (focusScopeEl && enabled) { var _sc = scrollerEl(); if (_sc) liftFixedInside(_sc); }
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
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
    }
    var host = annotationHost();
    if (root.parentNode !== host) host.appendChild(root);
    raiseRoot(root);
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
    var cv = canvasEl();
    if (cv && enabled) {
      var cr = cv.getBoundingClientRect();
      var s = stage.scale;
      var si = scrollInfo();
      return { left: (viewLeft - cr.left) / s + si.sl, top: (viewTop - cr.top) / s + si.st };
    }
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

  /* ===================== 原型舞台（固定宽高比画布） ===================== */
  var STAGE_ID = 'pa-stage';
  var CANVAS_ID = 'pa-canvas';
  var RATIO_KEY = 'lims-prototype-stage-ratio';
  var DESIGN_W = 1440;
  var BAR_H = 36;
  var PAD = 14;
  // 舞台只提供三个固定宽高比，缩放一律自适应画布（不再要「适应 / 1:1」开关）
  var RATIO_ORDER = ['4/3', '16/9', '16/10'];
  var RATIOS = { '16/10': [16, 10], '16/9': [16, 9], '4/3': [4, 3] };
  var stage = { scale: 1, ratio: '16/10', designH: 900, moving: false, hasChrome: false };

  try {
    var _r = localStorage.getItem(RATIO_KEY);
    if (_r && RATIOS[_r]) stage.ratio = _r;
  } catch (e) { /* ignore */ }

  function stageEl() { return document.getElementById(STAGE_ID); }
  function canvasEl() { return document.getElementById(CANVAS_ID); }
  function scrollerEl() { return document.getElementById('pa-scroll'); }
  // 内容滚动发生在 #pa-scroll：视口尺寸与滚动偏移都以它为准
  function scrollInfo() {
    var sc = scrollerEl();
    if (!sc) {
      var s0 = getPageScroll();
      return { sl: s0.x, st: s0.y, w: window.innerWidth, h: window.innerHeight, originLeft: s0.x, originTop: s0.y };
    }
    return { sl: sc.scrollLeft, st: sc.scrollTop, w: sc.clientWidth, h: sc.clientHeight };
  }
  function syncScrollVars() {
    var sc = scrollerEl();
    if (!sc) return;
    var root = document.documentElement;
    root.style.setProperty('--pa-sl', sc.scrollLeft + 'px');
    root.style.setProperty('--pa-st', sc.scrollTop + 'px');
  }
  function currentScale() { return stage.scale || 1; }
  function invScale() { return 1 / (stage.scale || 1); }
  function docWidth() {
    var w = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--pa-doc-w'), 10);
    return isNaN(w) ? 400 : w;
  }

  // 元素矩形 → 画布内容坐标（未缩放的设计像素），舞台未开启时退回旧的文档坐标
  function localRect(el) {
    var r = el.getBoundingClientRect();
    var cv = canvasEl();
    if (!cv || !enabled) {
      var sc = getPageScroll();
      return { left: r.left + sc.x, top: r.top + sc.y, right: r.right + sc.x, bottom: r.bottom + sc.y, width: r.width, height: r.height };
    }
    var cr = cv.getBoundingClientRect();
    var s = stage.scale;
    var si = scrollInfo();
    return {
      left: (r.left - cr.left) / s + si.sl,
      top: (r.top - cr.top) / s + si.st,
      right: (r.right - cr.left) / s + si.sl,
      bottom: (r.bottom - cr.top) / s + si.st,
      width: r.width / s,
      height: r.height / s
    };
  }

  // 当前可见视口 → 画布内容坐标
  function localViewport() {
    var cv = canvasEl();
    if (!cv || !enabled) {
      var sc = getPageScroll();
      return { left: sc.x, top: sc.y, width: window.innerWidth, height: window.innerHeight };
    }
    var si = scrollInfo();
    return { left: si.sl, top: si.st, width: si.w, height: si.h };
  }

  function annotationHost() {
    return enabled ? ensureStage() : document.body;
  }

  // 批注层始终排在 canvas 最后，保证圆点/卡片压在弹窗之上
  function raiseRoot(root) {
    var cv = canvasEl();
    if (cv && root.parentNode === cv) cv.appendChild(root);
  }

  // 嵌套 fixed 层的原位还原记录（body 级节点用整条原始顺序还原，更可靠）
  function snapshot(node) {
    return { node: node, parent: node.parentNode, next: node.nextSibling };
  }

  // 内容里嵌套的 fixed 层要提到 canvas，否则会跟着滚动层跑；
  // 但被隐藏祖先包住的不能提——一提就脱离 display:none 显形糊住画布。
  function liftFixedInside(sc) {
    var cv = canvasEl();
    if (!cv || !sc) return;
    [].slice.call(sc.querySelectorAll('*')).forEach(function (node) {
      if (node.nodeType !== 1) return;
      if (node.id === ROOT_ID) return;
      if (cv.contains(node.parentElement)) return;
      if (window.getComputedStyle(node).position !== 'fixed') return;
      var n = node.parentElement, hidden = false;
      while (n && n !== sc) {
        if (window.getComputedStyle(n).display === 'none') { hidden = true; break; }
        n = n.parentElement;
      }
      if (hidden) return;
      stage.lifts.push(snapshot(node));
      cv.appendChild(node);
    });
  }

  function stripIds(node) {
    if (node.removeAttribute) node.removeAttribute('id');
    [].slice.call(node.querySelectorAll('[id]')).forEach(function (n) { n.removeAttribute('id'); });
    return node;
  }

  /** 把外壳（index.html）的侧边栏 + 顶栏克隆进画布；同源拿不到（例如直接打开单页）时原样跳过 */
  function buildChrome(cv) {
    if (cv.querySelector('.pa-chrome')) return true;
    var shellDoc = null;
    try {
      shellDoc = (window.parent && window.parent !== window) ? window.parent.document : null;
    } catch (e) { return false; }
    if (!shellDoc) return false;
    var side = shellDoc.querySelector('aside');
    var head = shellDoc.querySelector('header');
    if (!side || !head) return false;

    var wrap = document.createElement('div');
    wrap.className = 'pa-chrome';
    var headBox = document.createElement('div');
    headBox.className = 'pa-chrome-head';
    var sideBox = document.createElement('div');
    sideBox.className = 'pa-chrome-side';
    headBox.appendChild(stripIds(head.cloneNode(true)));
    sideBox.appendChild(stripIds(side.cloneNode(true)));
    wrap.appendChild(headBox);
    wrap.appendChild(sideBox);
    cv.insertBefore(wrap, cv.firstChild);
    wireChrome(wrap);
    return true;
  }

  function chromeNav(href) {
    if (!href) return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'lims-pa-nav', href: href }, '*');
        return;
      }
    } catch (e) { /* 跨域时退回本页跳转 */ }
    window.location.href = href;
  }

  function wireChrome(wrap) {
    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var title = wrap.querySelector('#pageTitle, .pa-chrome-head span');
    if (title) title.textContent = docPageName();
    wrap.querySelectorAll('.menu-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sub = btn.nextElementSibling, arrow = btn.querySelector('.menu-arrow');
        if (sub) sub.classList.toggle('open');
        if (arrow) arrow.classList.toggle('open');
      });
    });
    wrap.querySelectorAll('a').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      // 「返回实验室数智化系统」这类 _top 链接保持原语义，不改走画布内换页
      if (a.getAttribute('target') === '_top') return;
      var file = (href.split('?')[0].split('/').pop() || '').toLowerCase();
      if (file === here) {
        a.classList.add('bg-slate-700', 'text-white');
        var grp = a.closest('.menu-group');
        if (grp) {
          var sub = grp.querySelector('.submenu'), arrow = grp.querySelector('.menu-arrow');
          if (sub) sub.classList.add('open');
          if (arrow) arrow.classList.add('open');
        }
      }
      a.addEventListener('click', function (ev) {
        if (!href || href.charAt(0) === '#') return;
        ev.preventDefault();
        chromeNav(href);
      });
    });
  }

  // 舞台开启时让外壳收起自己的导航，避免画布内外各一份
  function notifyShellChrome(hidden) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'lims-pa-chrome', hidden: !!hidden }, '*');
      }
    } catch (e) { /* 忽略 */ }
  }

  function ensureStage() {
    var cv = canvasEl();
    if (cv) return cv;
    var anchorNode = document.createComment('pa-stage');
    document.body.insertBefore(anchorNode, document.body.firstChild);
    window._paStageAnchor = anchorNode;

    var host = document.createElement('div');
    host.id = STAGE_ID;
    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', '原型预览画布（可用鼠标滚轮或方向键滚动）');
    host.innerHTML =
      '<div class="pa-stage-bar">' +
        '<span class="pa-stage-name"></span>' +
        '<span class="pa-stage-meta"></span>' +
        '<span class="pa-stage-acts">' +
          RATIO_ORDER.map(function (k) {
            return '<button type="button" class="pa-stage-btn" data-ratio="' + k + '">' +
              k.replace('/', ':') + '</button>';
          }).join('') +
        '</span>' +
      '</div>' +
      '<div class="pa-stage-view"><div id="' + CANVAS_ID + '" class="pa-canvas">' +
        '<div id="pa-scroll" class="pa-scroll" tabindex="0"></div></div></div>';
    document.body.insertBefore(host, anchorNode.nextSibling);
    cv = host.querySelector('#' + CANVAS_ID);
    var sc = host.querySelector('#pa-scroll');

    // 记下打开前的 body 顺序，关闭时按这条顺序重排，保证 DOM 与打开前完全一致
    stage.originalOrder = [].slice.call(document.body.children).filter(function (n) {
      return n !== host && n !== anchorNode;
    });
    stage.lifts = [];
    stage.moving = true;
    [].slice.call(document.body.children).forEach(function (node) {
      if (node === host || node === anchorNode) return;
      if (node.id === 'pa-doc' || node.id === STAGE_ID || node.id === 'pa-scroll') return;
      if (node.classList && node.classList.contains('pa-toggle')) return;
      if (/^(SCRIPT|LINK|META|TITLE|BASE)$/.test(node.tagName)) return;
      // 批注层留在 canvas（配 --pa-sl/--pa-st 位移跟随内容），既不撑大滚动层，也压在弹窗上
      if (node.id === ROOT_ID) cv.appendChild(node);
      // fixed 层（弹窗/抽屉/通栏条）留在 canvas，才能钉在可视框里；普通内容进滚动层
      else if (window.getComputedStyle(node).position === 'fixed') cv.appendChild(node);
      else sc.appendChild(node);
    });
    liftFixedInside(sc);
    stage.hasChrome = buildChrome(cv);
    if (stage.hasChrome) notifyShellChrome(true);
    // body 上的背景/内边距等表现类搬到滚动层，保持页面观感一致
    if (document.body.className) sc.className = 'pa-scroll ' + document.body.className;
    stage.moving = false;

    host.querySelector('.pa-stage-acts').addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('.pa-stage-btn') : null;
      if (!btn) return;
      var ratio = btn.getAttribute('data-ratio');
      if (ratio) setStageRatio(ratio);
    });
    if (!window._paFitHandler) {
      window._paFitHandler = function () { if (canvasEl()) fitStage(); };
    }
    window.addEventListener('resize', window._paFitHandler);
    // 页面脚本偶尔把节点追加到 body（复制用的 textarea、浮层等），搬进画布免得掉在舞台外
    if (!window._paStageObserver) {
      window._paStageObserver = new MutationObserver(function (muts) {
        if (stage.moving || !canvasEl()) return;
        var cv2 = canvasEl();
        var sc2 = scrollerEl();
        muts.forEach(function (m) {
          [].slice.call(m.addedNodes).forEach(function (node) {
            if (node.nodeType !== 1 || cv2.contains(node)) return;
            if (node.id === STAGE_ID || node.id === 'pa-doc' || node.id === 'prototype-annotation-root') return;
            if (node.classList && node.classList.contains('pa-toggle')) return;
            if (/^(SCRIPT|LINK|META|TITLE|BASE)$/.test(node.tagName)) return;
            if (window.getComputedStyle(node).position === 'fixed') cv2.appendChild(node);
            else if (sc2) sc2.appendChild(node);
          });
        });
      });
      window._paStageObserver.observe(document.body, { childList: true });
    }
    return cv;
  }

  function teardownStage() {
    var host = stageEl();
    if (!host) return;
    if (stage.hasChrome) notifyShellChrome(false);
    var cv = canvasEl();
    var sc = scrollerEl();
    var anchorNode = window._paStageAnchor;
    var lifts = stage.lifts || [];
    var orig = stage.originalOrder || [];
    stage.moving = true;
    // 1) 嵌套提升的 fixed 层先回原位（此时滚动层子树完整，兄弟节点还能定位）
    lifts.forEach(function (rec) {
      if (!rec.parent) return;
      if (rec.next && rec.next.parentNode === rec.parent) rec.parent.insertBefore(rec.node, rec.next);
      else rec.parent.appendChild(rec.node);
    });
    stage.lifts = [];
    // 2) 画布与滚动层里的节点全部搬回 body（外壳导航的克隆是临时借来的，直接丢掉）
    var chrome = cv && cv.querySelector('.pa-chrome');
    if (chrome && chrome.parentNode) chrome.parentNode.removeChild(chrome);
    [sc, cv].forEach(function (layer) {
      if (!layer) return;
      [].slice.call(layer.children).forEach(function (n) {
        if (n.id === 'pa-scroll' || n.id === CANVAS_ID) return;
        if (n.classList && n.classList.contains('pa-chrome')) return;
        document.body.appendChild(n);
      });
    });
    // 3) 按打开前的顺序重排，消除移动造成的顺序漂移
    orig.forEach(function (n) { if (n.parentNode === document.body) document.body.appendChild(n); });
    stage.originalOrder = [];
    if (sc) sc.className = 'pa-scroll';
    if (window._paStageObserver) window._paStageObserver.disconnect();
    if (window._paFitHandler) window.removeEventListener('resize', window._paFitHandler);
    if (anchorNode && anchorNode.parentNode) anchorNode.parentNode.removeChild(anchorNode);
    if (host.parentNode) host.parentNode.removeChild(host);
    window._paStageAnchor = null;
    window._paStageObserver = null;
    window._paFitHandler = null;
    stage.scale = 1;
    document.documentElement.style.setProperty('--pa-scale', '1');
    document.documentElement.style.setProperty('--pa-inv', '1');
    document.documentElement.style.setProperty('--pa-sl', '0px');
    document.documentElement.style.setProperty('--pa-st', '0px');
    stage.moving = false;
    stage.hasChrome = false;
  }

  function fitStage() {
    var host = stageEl();
    var cv = canvasEl();
    if (!host || !cv) return;
    var r = RATIOS[stage.ratio] || RATIOS['16/10'];
    stage.designH = Math.round(DESIGN_W * r[1] / r[0]);
    var dw = docWidth();
    var availW = Math.max(320, window.innerWidth - dw - PAD * 2);
    var availH = Math.max(240, window.innerHeight - PAD * 2);
    var sw = availW;
    var sh = Math.round(sw * r[1] / r[0]);
    if (sh > availH) { sh = availH; sw = Math.round(sh * r[0] / r[1]); }
    host.style.width = sw + 'px';
    host.style.height = sh + 'px';
    host.style.left = Math.round((window.innerWidth - dw - sw) / 2) + 'px';
    host.style.top = Math.round((window.innerHeight - sh) / 2) + 'px';

    var viewW = sw;
    var viewH = sh - BAR_H;
    var chromeOn = stage.hasChrome && host.querySelector('.pa-chrome');
    var sideW = chromeOn ? SIDE_W : 0;
    var headH = chromeOn ? HEAD_H : 0;
    cv.style.width = DESIGN_W + 'px';
    cv.style.height = stage.designH + 'px';
    var sc = scrollerEl();
    if (sc) {
      sc.style.left = sideW + 'px';
      sc.style.top = headH + 'px';
      sc.style.width = (DESIGN_W - sideW) + 'px';
      sc.style.height = (stage.designH - headH) + 'px';
    }
    var s = Math.min(1, viewW / DESIGN_W, viewH / stage.designH);   // 只有自适应一种缩放
    stage.scale = s;
    var root = document.documentElement;
    root.style.setProperty('--pa-scale', String(s));
    root.style.setProperty('--pa-inv', String(1 / s));
    root.style.setProperty('--pa-design-h', (stage.designH - headH) + 'px');
    root.style.setProperty('--pa-design-w', DESIGN_W + 'px');
    var name = host.querySelector('.pa-stage-name');
    if (name) name.textContent = docPageName();
    var meta = host.querySelector('.pa-stage-meta');
    if (meta) meta.textContent = DESIGN_W + '×' + stage.designH + ' · ' + Math.round(s * 100) + '%';
    host.querySelectorAll('.pa-stage-btn').forEach(function (btn) {
      var k = btn.getAttribute('data-ratio');
      var rr = RATIOS[k] || [0, 0];
      var on = k === stage.ratio;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('title', '画布宽高比 ' + rr[0] + ':' + rr[1] +
        '（设计尺寸 ' + DESIGN_W + '×' + Math.round(DESIGN_W * rr[1] / rr[0]) + '，等比自适应）' +
        (on ? '，当前使用中' : '，点击切换'));
    });
    syncScrollVars();
    scheduleRefreshPositions();
  }

  function setStageRatio(ratio) {
    if (!RATIOS[ratio]) return;
    stage.ratio = ratio;
    try { localStorage.setItem(RATIO_KEY, ratio); } catch (e) {}
    fitStage();
  }

  function scheduleRefreshPositions() {
    if (window._paScrollRaf) return;
    window._paScrollRaf = window.requestAnimationFrame(function () {
      window._paScrollRaf = null;
      syncScrollVars();
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
    var rect = localRect(target);
    if (!rect.width && !rect.height) {
      marker.style.display = 'none';
      return;
    }
    marker.style.display = '';
    position = position || 'top-right';
    var size = 22;
    var vp = localViewport();
    var inv = enabled ? invScale() : 1;
    // 圆点反向缩放后占据 size*inv 的设计像素，判定贴边时要按放大后的实际占位算
    var sizeEff = size * inv;
    var nearRight = rect.right > vp.left + vp.width * 0.72;
    var nearBottom = rect.bottom > vp.top + vp.height * 0.72;
    var point;

    if (position === 'left' || (position === 'bottom-left' && nearRight)) {
      point = { left: rect.left - sizeEff - 4, top: rect.top + rect.height / 2 - sizeEff / 2 };
    } else if (position === 'top-right') {
      // 锚在目标右上角外侧，避免与相邻按钮左上角打点重叠
      point = { left: rect.right - 2, top: rect.top - sizeEff * 0.4 };
    } else if (position === 'top-left') {
      point = { left: rect.left - sizeEff / 2, top: rect.top - sizeEff * 0.4 };
    } else if (position === 'bottom-right') {
      point = { left: rect.right - sizeEff * 0.5, top: rect.bottom - sizeEff * 0.7 };
    } else if (position === 'bottom-left') {
      point = {
        left: nearRight ? rect.left - sizeEff - 4 : rect.left - sizeEff * 0.5,
        top: nearBottom ? rect.top - sizeEff - 4 : rect.bottom - sizeEff * 0.7
      };
    } else {
      point = { left: rect.right + 4, top: rect.top + rect.height / 2 - sizeEff / 2 };
    }

    marker.style.top = Math.round(point.top) + 'px';
    marker.style.left = Math.round(point.left) + 'px';
  }

  function positionCard(card, marker, item) {
    card.classList.add('visible');
    var inv = enabled ? invScale() : 1;
    var layoutW = card.offsetWidth || (item.wide ? 400 : 340);
    var layoutH = card.offsetHeight || 160;
    // 卡片反向缩放，换算回画布内容坐标里的实际占位
    var cardW = layoutW * inv;
    var cardH = layoutH * inv;
    var mRect = localRect(marker);
    var vp = localViewport();
    var pad = 12 * inv;
    var bottomReserve = 88 * inv;
    var nearRight = mRect.left > vp.left + vp.width * 0.55;
    var nearBottom = mRect.top > vp.top + vp.height * 0.55;
    var viewLeft;
    var viewTop;

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

    if (viewTop + cardH > vp.top + vp.height - bottomReserve) {
      viewTop = mRect.top - cardH - 8;
    }
    if (viewTop < vp.top + pad) viewTop = vp.top + pad;
    if (viewLeft + cardW > vp.left + vp.width - pad) {
      viewLeft = vp.left + vp.width - cardW - pad;
    }
    if (viewLeft < vp.left + pad) {
      viewLeft = vp.left + pad;
      if (mRect.right + cardW + 16 < vp.left + vp.width - pad) {
        viewLeft = mRect.right + 8;
      }
    }

    card.style.top = Math.round(viewTop) + 'px';
    card.style.left = Math.round(viewLeft) + 'px';
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
      fitStage();
      scheduleRefreshPositions();
    }
    function up(e) {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      var w = parseInt(getComputedStyle(root).getPropertyValue('--pa-doc-w'), 10) || 400;
      try { localStorage.setItem(DOC_W_KEY, String(w)); } catch (err) {}
      fitStage();
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
    if (item._target.scrollIntoView) item._target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
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
    createToggle();
    if (enabled) ensureStage();
    ensureRoot();

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
      // 圆点只有数字，读屏需要说清这是第几条、讲的是哪块
      marker.setAttribute('aria-label', '批注 ' + num + '：' + item.title);
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
    if (enabled) {
      applyDocWidth();
      ensureStage();
      fitStage();
      buildDocPanel();
    } else {
      teardownStage();
    }
    applyFocusScope();
    if (!enabled) {
      document.querySelectorAll('.pa-marker').forEach(function (m) { m.classList.remove('visible'); });
      document.querySelectorAll('.pa-card').forEach(function (c) { c.classList.remove('visible'); });
      document.querySelectorAll('.pa-highlight').forEach(function (el) { el.classList.remove('pa-highlight'); });
    }
    scheduleRefreshPositions();
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
    setStageRatio: setStageRatio,
    stageInfo: function () {
      var cv = canvasEl();
      return { ratio: stage.ratio, scale: stage.scale, designW: DESIGN_W, designH: stage.designH,
        stageOn: !!cv, scrollTop: cv && scrollerEl() ? scrollerEl().scrollTop : 0 };
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
