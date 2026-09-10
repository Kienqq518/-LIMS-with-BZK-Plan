/**
 * TestOS 平台顶部导航栏（含设置下拉菜单）
 * 用法：页面需包含 <div id="testosHeader"></div>
 * 可选：document.body.dataset.testosActive = 'settings' 高亮设置图标
 */
(function () {
  var SETTINGS_ITEMS = [
    { label: '用户管理', href: '#', demo: true },
    { label: '部门管理', href: '#', demo: true },
    { label: '角色管理', href: 'testos-role-mgmt.html' },
    { label: '菜单管理', href: '#', demo: true },
    { label: '平台管理', href: '#', demo: true }
  ];

  function rootPrefix() {
    var raw = (document.body && document.body.dataset.testosRoot) || '';
    if (!raw) return '';
    return raw.slice(-1) === '/' ? raw : raw + '/';
  }

  function withRoot(href) {
    if (!href || href === '#' || /^(https?:|mailto:|javascript:)/i.test(href)) return href;
    if (href.charAt(0) === '/') return href;
    return rootPrefix() + href;
  }

  function renderHeader(container) {
    if (!container) return;
    var homeHref = withRoot('testos.html');

    container.innerHTML =
      '<header class="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">' +
        '<div class="flex items-center gap-3">' +
          '<a href="' + homeHref + '" class="flex items-center gap-1.5">' +
            '<span class="text-xl font-bold tracking-tight">' +
              '<span class="text-blue-600">Test</span><span class="text-slate-800">OS</span>' +
            '</span>' +
          '</a>' +
          '<span class="text-xs text-slate-400">版本号：V2.0.0</span>' +
        '</div>' +
        '<div class="flex items-center gap-4">' +
          '<div class="relative" id="testosSettingsWrap">' +
            '<button type="button" id="testosSettingsBtn" class="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600" title="设置">' +
              '<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">' +
                '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/>' +
                '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>' +
              '</svg>' +
            '</button>' +
            '<div id="testosSettingsMenu" class="absolute right-0 top-full z-50 mt-2 hidden w-36 rounded-md border border-slate-100 bg-white py-1 shadow-lg">' +
              '<div class="absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t border-slate-100 bg-white"></div>' +
              SETTINGS_ITEMS.map(function (item) {
                return '<a href="' + withRoot(item.href) + '"' +
                  (item.demo ? ' onclick="event.preventDefault();alert(\'原型演示：' + item.label + '\')"' : '') +
                  ' class="block px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600">' +
                  item.label + '</a>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50">' +
            '<img src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=64&h=64&fit=crop" alt="admin" class="h-8 w-8 rounded-full object-cover ring-2 ring-slate-100" />' +
            '<span class="text-sm text-slate-700">admin</span>' +
            '<i class="fa fa-angle-down text-xs text-slate-400"></i>' +
          '</div>' +
        '</div>' +
      '</header>';

    bindSettingsDropdown();
  }

  function bindSettingsDropdown() {
    var btn = document.getElementById('testosSettingsBtn');
    var menu = document.getElementById('testosSettingsMenu');
    var wrap = document.getElementById('testosSettingsWrap');
    if (!btn || !menu) return;

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });

    document.addEventListener('click', function (e) {
      if (wrap && !wrap.contains(e.target)) {
        menu.classList.add('hidden');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var container = document.getElementById('testosHeader');
    renderHeader(container);
  });
})();
