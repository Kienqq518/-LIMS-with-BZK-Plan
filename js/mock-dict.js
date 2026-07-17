(function (global) {
  var STORAGE_KEY = 'lims.dictTypes';

  function item(id, label, value, sort, remark) {
    return { id: id, label: label, value: value, sort: sort, status: '正常', time: '2026-07-15 08:00:00', remark: remark || '' };
  }

  var DEFAULT_DICT_TYPES = [
    { id: 1, name: '任务类型', type: 'lims_task_type', status: '正常', time: '2026-07-15 08:00:00', remark: '委托任务类型', expanded: false,
      items: [
        item(1, '电气（输配电类）', 'electrical', 1, ''),
        item(2, '委托检测', 'entrust', 2, '')
      ]
    },
    { id: 2, name: '优先等级', type: 'lims_priority', status: '正常', time: '2026-07-15 08:00:00', remark: '委托优先等级', expanded: false,
      items: [
        item(1, '常规', 'normal', 1, ''),
        item(2, '加急', 'urgent', 2, '')
      ]
    },
    { id: 3, name: '检测类型', type: 'lims_detect_type', status: '正常', time: '2026-07-15 08:00:00', remark: '检测类型', expanded: false,
      items: [ item(1, '常规', 'normal', 1, '') ]
    },
    { id: 4, name: '检测类别', type: 'lims_detect_category', status: '正常', time: '2026-07-15 08:00:00', remark: '检测类别', expanded: false,
      items: [ item(1, '例行试验', 'routine', 1, '') ]
    },
    { id: 5, name: '付款方式', type: 'lims_pay_method', status: '正常', time: '2026-07-15 08:00:00', remark: '付款方式', expanded: false,
      items: [
        item(1, '电汇', 'wire', 1, ''),
        item(2, '对公转账', 'transfer', 2, '')
      ]
    },
    { id: 6, name: '报告交付方式', type: 'lims_report_delivery', status: '正常', time: '2026-07-15 08:00:00', remark: '报告传送/交付方式', expanded: false,
      items: [
        item(1, '邮寄', 'mail', 1, ''),
        item(2, '自取', 'pickup', 2, '')
      ]
    },
    { id: 7, name: '报告资质', type: 'lims_report_qual', status: '正常', time: '2026-07-15 08:00:00', remark: '报告资质', expanded: false,
      items: [ item(1, 'CNAS CMA', 'cnas_cma', 1, '') ]
    },
    { id: 8, name: '报告说明', type: 'lims_report_desc', status: '正常', time: '2026-07-15 08:00:00', remark: '报告描述/说明', expanded: false,
      items: [ item(1, '全部生成一份', 'single', 1, '') ]
    },
    { id: 9, name: '结果格式', type: 'lims_result_format', status: '正常', time: '2026-07-15 08:00:00', remark: '结果方式/格式', expanded: false,
      items: [ item(1, '判定', 'judgment', 1, '') ]
    },
    { id: 10, name: '用户性别', type: 'sys_user_sex', status: '正常', time: '2022-04-26 19:50:45', remark: '用户性别列表', expanded: false,
      items: [
        item(1, '男', '0', 1, '性别男'),
        item(2, '女', '1', 2, '性别女'),
        item(3, '未知', '2', 3, '性别未知')
      ]
    },
    { id: 11, name: '菜单状态', type: 'sys_show_hide', status: '正常', time: '2022-04-26 19:50:45', remark: '菜单状态列表', expanded: false, items: [] },
    { id: 12, name: '系统开关', type: 'sys_normal_disable', status: '正常', time: '2022-04-26 19:50:45', remark: '系统开关列表', expanded: false, items: [] },
    { id: 13, name: '任务状态', type: 'sys_job_status', status: '正常', time: '2022-04-26 19:50:45', remark: '任务状态列表', expanded: false, items: [] },
    { id: 14, name: '任务分组', type: 'sys_job_group', status: '正常', time: '2022-04-26 19:50:45', remark: '任务分组列表', expanded: false, items: [] },
    { id: 15, name: '系统是否', type: 'sys_yes_no', status: '正常', time: '2022-04-26 19:50:45', remark: '系统是否列表', expanded: false, items: [] },
    { id: 16, name: '通知类型', type: 'sys_notice_type', status: '正常', time: '2022-04-26 19:50:45', remark: '通知类型列表', expanded: false, items: [] },
    { id: 17, name: '通知状态', type: 'sys_notice_status', status: '正常', time: '2022-04-26 19:50:45', remark: '通知状态列表', expanded: false, items: [] },
    { id: 18, name: '操作类型', type: 'sys_oper_type', status: '正常', time: '2022-04-26 19:50:45', remark: '操作类型列表', expanded: false, items: [] }
  ];

  function cloneDictTypes(list) {
    return JSON.parse(JSON.stringify(list));
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return cloneDictTypes(DEFAULT_DICT_TYPES);
  }

  function save(dictTypes) {
    if (global.localStorage) {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(dictTypes));
    }
  }

  function reset() {
    if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY);
    return cloneDictTypes(DEFAULT_DICT_TYPES);
  }

  function findByType(dictTypes, type) {
    return dictTypes.find(function (d) { return d.type === type; });
  }

  function syncDictName(dictTypes, type, name) {
    var d = findByType(dictTypes, type);
    if (d) d.name = name;
  }

  function getActiveItems(dictTypes, type) {
    var d = findByType(dictTypes, type);
    if (!d || !d.items) return [];
    return d.items.filter(function (it) { return it.status === '正常'; })
      .sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  }

  global.MockDictStore = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_DICT_TYPES: DEFAULT_DICT_TYPES,
    cloneDictTypes: cloneDictTypes,
    load: load,
    save: save,
    reset: reset,
    findByType: findByType,
    syncDictName: syncDictName,
    getActiveItems: getActiveItems
  };
})(window);
