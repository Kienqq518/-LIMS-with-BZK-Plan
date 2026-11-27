/**
 * LIMS 检测标准库 · 操作权限清单（TestOS 角色管理 mock）
 * 功能名：检测标准建模 = 标准成果库 + 建模工作台 + AI报告审核面板
 * 编码规范：stdmodel:{页面}:{资源}:{动作}
 *
 * 两层权限取交集：
 *   RBAC（这里配的）= 你能不能做这类事
 *   任务邀请（工作台里配的）= 在这一个任务里你是什么身份
 * 任何动作要两边都允许才放行；「授权变更与停用」「入库」是独立权限点，
 * 因为它们改的是已在流转的业务数据。
 */
(function (global) {
  function item(object, perms, opts) {
    opts = opts || {};
    var checked = opts.checked;
    if (!checked) checked = perms.map(function () { return opts.defaultChecked !== false; });
    return { type: 'item', object: object, perms: perms, checked: checked,
      conditional: !!opts.conditional, phase2: !!opts.phase2 };
  }
  function group(name, opts) {
    opts = opts || {};
    return { type: 'group', name: name, collapsed: !!opts.collapsed, phase2: !!opts.phase2 };
  }

  var AI_PERMISSION_ROWS = [
    group('检测标准建模 · 标准库'),
    item('标准文件', ['查看', '搜索', '上传文件本体', '查看元数据与代替关系', '下载文件本体'],
      { checked: [true, true, true, true, false] }),
    item('拆解成果', ['查看成果版本', '下载稿件', '查看范围级问答沉淀', '查看引用与复用记录']),
    item('标准族结构', ['查看', '新增标准族', '编辑层级角色', '维护替代与废止关系'],
      { checked: [true, true, false, false] }),
    item('公司基线', ['查看公司基线成果', '回流拆解成果到公司基线', '回流前脱敏预览'],
      { checked: [true, false, false], conditional: true }),

    group('检测标准建模 · 建模工作台'),
    item('任务', ['查看任务列表', '查看任务详情', '新建任务', '重命名', '归档', '转交 Owner']),
    item('输入与拆解 F1', ['上传输入文件', '发起拆解', '查看拆解进度', '回答范围级问题',
      '回答字段级问题', '跳过字段级问题', '批量指令']),
    item('校稿与定稿 F2', ['查看稿件表格', '编辑单元格', '下载稿件', '上传线下稿件',
      '三方对比', '合并线下改动', '定稿']),
    item('预检与入库 F3', ['查看预检结果', '发起入库', '授权变更与停用', '重放已入库块', '回滚入库块'],
      { checked: [true, false, false, false, false], conditional: true }),
    item('编排与留痕', ['发起跨阶段编排', '查看编排留痕', '撤销编排', '查看 AI 自决清单']),

    group('任务协作与共享'),
    item('成员管理', ['邀请成员', '变更成员角色', '移除成员', '转交 Owner']),
    item('任务内协作', ['查看待我处理', '指派问题', '批注', '申请入库审批']),
    item('数据可见范围', ['查看本客户任务', '查看公司基线任务'],
      { checked: [true, false], conditional: true }),

    group('AI 助手 · 会话'),
    item('对话', ['发起对话', '上传附件与截图', '查看历史会话', '清空会话']),
    item('模型与出处', ['选择模型', '查看引用出处', '反馈答案质量']),

    group('运行档位'),
    item('档位', ['内部档', '客户档'], { checked: [true, true] })
  ];

  global.TestOSAiPermissions = {
    moduleName: 'LIMS检测标准库',
    rows: AI_PERMISSION_ROWS,
    clone: function () { return JSON.parse(JSON.stringify(AI_PERMISSION_ROWS)); }
  };
})(window);
