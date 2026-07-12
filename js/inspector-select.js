/**
 * 检验人员 Tag 选择器（单行布局，对齐系统 UI）
 */
(function (global) {
  var STYLE_ID = 'inspector-select-styles';

  var css = [
    '.inspector-combobox { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; min-height: 32px; padding: 3px 8px; border: 1px solid #dcdfe6; border-radius: 4px; background: #fff; box-sizing: border-box; }',
    '.inspector-combobox:focus-within { border-color: #409eff; }',
    '.inspector-combobox .inspector-tag { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 6px; border-radius: 3px; background: #ecf5ff; color: #409eff; font-size: 12px; line-height: 22px; white-space: nowrap; }',
    '.inspector-combobox .inspector-tag .fa-times { font-size: 10px; cursor: pointer; opacity: .7; }',
    '.inspector-combobox .inspector-tag .fa-times:hover { opacity: 1; }',
    '.inspector-combobox .inspector-add { flex: 1; min-width: 80px; height: 24px; border: none; outline: none; background: transparent; font-size: 12px; color: #606266; cursor: pointer; appearance: none; padding: 0 4px; }',
    '.inspector-combobox .inspector-add option { color: #303133; }',
    '.inspector-combobox--cell { min-height: 28px; padding: 2px 6px; }',
    '.inspector-combobox--modal { min-height: 36px; padding: 4px 8px; }'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  /**
   * @param {object} opts
   * @param {string[]} opts.inspectors
   * @param {string[]} opts.options
   * @param {string} [opts.mode] 'cell' | 'modal'
   * @param {string} [opts.prefix] data attribute prefix for idx
   * @param {number|string} [opts.idx]
   */
  function renderHTML(opts) {
    injectStyles();
    var inspectors = opts.inspectors || [];
    var options = opts.options || [];
    var mode = opts.mode === 'modal' ? 'inspector-combobox--modal' : 'inspector-combobox--cell';
    var idx = opts.idx != null ? opts.idx : '';
    var prefix = opts.prefix || 'insp';

    var maxCount = opts.maxCount || 0;
    var tags = inspectors.map(function (name) {
      return '<span class="inspector-tag" data-value="' + name + '">' + name +
        ' <i class="fa fa-times" data-action="remove" data-name="' + name + '" data-idx="' + idx + '"></i></span>';
    }).join('');

    var avail = options.filter(function (o) { return inspectors.indexOf(o) === -1; });
    var atMax = maxCount > 0 && inspectors.length >= maxCount;
    var select = atMax ? '' : (
      '<select class="inspector-add" data-action="add" data-idx="' + idx + '" data-prefix="' + prefix + '"' +
        (maxCount ? ' data-max="' + maxCount + '"' : '') + '>' +
        '<option value="">' + (mode.indexOf('modal') !== -1 ? '添加检验人员' : '') + '</option>' +
        avail.map(function (o) { return '<option value="' + o + '">' + o + '</option>'; }).join('') +
      '</select>'
    );

    return '<div class="inspector-combobox ' + mode + '" data-inspector-box="' + prefix + '-' + idx + '">' + tags + select + '</div>';
  }

  /**
   * 绑定容器内所有 combobox 的事件
   * @param {HTMLElement|string} root
   * @param {{ onAdd: Function, onRemove: Function }} handlers - (idx, name) => void
   */
  function bind(root, handlers) {
    injectStyles();
    if (typeof root === 'string') root = document.querySelector(root);
    if (!root) return;

    root.addEventListener('change', function (e) {
      var sel = e.target;
      if (!sel.matches('.inspector-add')) return;
      var val = sel.value;
      if (!val) return;
      var idx = sel.getAttribute('data-idx');
      if (handlers.onAdd) handlers.onAdd(idx === '' ? null : Number(idx), val);
      sel.value = '';
    });

    root.addEventListener('click', function (e) {
      var icon = e.target.closest('[data-action="remove"]');
      if (!icon) return;
      e.stopPropagation();
      var idx = icon.getAttribute('data-idx');
      var name = icon.getAttribute('data-name');
      if (handlers.onRemove) handlers.onRemove(idx === '' ? null : Number(idx), name);
    });
  }

  global.InspectorSelect = {
    renderHTML: renderHTML,
    bind: bind,
    injectStyles: injectStyles
  };
})(window);
