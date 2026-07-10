/**
 * 页签栏交互：点击「工作台」跳转、点击当前页签关闭按钮返回工作台
 */
(function () {
  var tabBar = document.getElementById('pageTabs');
  if (!tabBar) return;

  var closeTarget = tabBar.getAttribute('data-close-target') || 'dashboard.html';

  // 工作台页签：跳转到工作台
  var workbenchTab = tabBar.querySelector('.tab-workbench');
  if (workbenchTab) {
    workbenchTab.addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = 'dashboard.html';
    });
  }

  // 关闭当前页签：返回工作台或指定页面
  var closeBtn = tabBar.querySelector('.tab-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      window.location.href = closeTarget;
    });
  }
})();
