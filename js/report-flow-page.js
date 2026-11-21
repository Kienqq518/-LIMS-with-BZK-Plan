/** 签发后各列表页共用壳：tabs + flow-root + 标准脚本 */
(function (global) {
  global.ReportFlowPage = {
    boot: function (opts) {
      document.title = opts.title + ' - 智慧实验室';
      var tabs = document.getElementById('pageTabs');
      tabs.setAttribute('data-close-target', 'dashboard.html');
      tabs.innerHTML =
        '<a href="dashboard.html" class="tab-workbench cursor-pointer rounded-t px-3 py-1.5 text-slate-500 hover:text-slate-700">工作台</a>' +
        '<span class="tab-active flex items-center gap-2 rounded-t border border-b-0 border-slate-200 bg-white px-3 py-1.5 text-blue-600">' +
        opts.title + ' <i class="tab-close fa fa-times-circle cursor-pointer text-xs text-slate-400 hover:text-slate-600"></i></span>';
      ReportFlowUI.mount({ stage: opts.stage, title: opts.title });
    }
  };
})(window);
