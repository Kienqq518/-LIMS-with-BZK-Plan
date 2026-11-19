/**
 * 实验室物资业务管理系统 · 操作权限清单（TestOS 角色管理 mock）
 * 默认收起只展示一级权限；展开后露出带子权限的明细。
 */
(function (global) {
  function item(object, perms, opts) {
    opts = opts || {};
    var checked = opts.checked;
    if (!checked) {
      checked = perms.map(function () { return true; });
    }
    var row = {
      type: 'item',
      object: object,
      perms: perms,
      checked: checked
    };
    if (opts.nested && opts.nested.length) row.nested = opts.nested;
    return row;
  }

  function nested(object, perms, checked) {
    return {
      object: object,
      perms: perms,
      checked: checked || perms.map(function () { return true; })
    };
  }

  var WUZI_PERMISSION_ROWS = [
    item('工作台', [
      '全年各类型销售情况统计',
      '年、月度个人业绩统计',
      '各类型检测报告数量统计',
      '人员检测报告统计',
      '年度检测报告及时率统计',
      '年度检测报告及时率统计导出'
    ]),
    item('合同管理', [
      '委托预览', '框架合同', '委托登记', '委托确认',
      '费用审核', '变更申请', '变更审批', '变更记录'
    ], {
      nested: [
        nested('委托预览', [
          '报告下载', '查看', '新增', '查看报告', '收费开票', '编辑',
          '系统日志', '删除', '重新签章', '导出业务数据统计表',
          '报告发放记录', '报告记录表', '已检样品处理记录',
          '检测任务单编制', '编制报告'
        ]),
        nested('框架合同', ['查看', '新增', '编辑', '删除']),
        nested('变更申请', ['特殊申请'])
      ]
    }),
    item('样品管理', [
      '样品收样', '样品制备', '样品发样', '还样确认',
      '申请退样', '样品退样', '样品台账', '合格打印'
    ], { checked: [true, true, true, true, true, true, true, false] }),
    item('试验管理', [
      '试样分发', '试验检测', '组内审核', '数据审核', '申请还样', '标签打印'
    ], {
      nested: [
        nested('试验检测', ['一键粘贴'])
      ]
    }),
    item('报告管理', [
      '报告编制', '报告审核', '报告签发', '报告处理',
      '收费审批', '报告发放', '任务归档', '任务完成', '原始记录'
    ], {
      nested: [
        nested('报告编制', ['查看', '在线编辑', '原始记录'])
      ]
    }),
    item('检测管理', [
      '大类管理', '样品分类', '样品数据', '判定规则', '报告判定', '模板管理'
    ], {
      nested: [
        nested('模板管理', [
          '模板配置新增', '模板配置查询', '模板配置编辑',
          '模板配置删除', '模板配置查看模板'
        ])
      ]
    }),
    item('财务管理', [
      '收费记录', '收费关联', '收费确认', '开票管理', '发票发放'
    ], {
      nested: [
        nested('收费记录', ['查看表格', '收费管理'])
      ]
    }),
    item('基础数据', [
      '代理管理', '客户管理', '场地管理', '设备管理', '岗位管理'
    ], {
      checked: [true, true, true, false, true],
      nested: [
        nested('代理管理', ['导入', '导出']),
        nested('客户管理', ['导入', '导出']),
        nested('场地管理', ['查看', '新增', '编辑', '删除']),
        nested('设备管理', [
          '设备查询通知', '设备查看', '导入', '导出'
        ], [true, true, false, true]),
        nested('岗位管理', [
          '岗位查询', '岗位新增', '生成管理', '导入代码',
          '生成修改', '生成删除', '预览代码', '生成代码',
          '岗位修改', '岗位删除', '岗位导出'
        ])
      ]
    }),
    item('文件管理', [
      '标准管理', '作业指导书', '程序文件', '质量手册', '制度文件'
    ], {
      nested: [
        nested('标准管理', ['新增标准']),
        nested('制度文件', ['制度文件管理'])
      ]
    }),
    item('基础配置', [
      '业务流程配置', '微信设置', '参数设置', '通知公告', '字典管理'
    ], {
      checked: [true, true, true, false, true],
      nested: [
        nested('业务流程配置', ['记录单设置新增', '记录单设置编辑', '流程设置']),
        nested('参数设置', [
          '参数查询', '参数新增', '参数修改', '参数删除', '参数预览', '参数导出'
        ]),
        nested('字典管理', [
          '字典查询', '字典新增', '字典修改', '字典预览', '字典删除', '字典导出'
        ])
      ]
    }),
    item('日志管理', ['登录日志', '操作日志', '浏览记录'])
  ];

  global.TestOSWuziPermissions = {
    moduleName: '实验室物资业务管理系统',
    rows: WUZI_PERMISSION_ROWS,
    clone: function () {
      return JSON.parse(JSON.stringify(WUZI_PERMISSION_ROWS));
    }
  };
})(window);
