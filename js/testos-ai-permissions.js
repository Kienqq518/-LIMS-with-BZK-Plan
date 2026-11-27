/**
 * AI 助手模块 · 操作权限清单（挂在「实验室物资业务管理系统」应用下）
 *
 * 两层权限取交集：
 *   RBAC（这里配的）= 你能不能做这类事
 *   任务邀请（建模工作台里配的）= 在这一个任务里你是什么身份
 * 编码规范：ai:{页面}:{资源}:{动作}
 */
(function (global) {
  function item(object, perms, opts) {
    opts = opts || {};
    var checked = opts.checked;
    if (!checked) checked = perms.map(function () { return opts.defaultChecked !== false; });
    var row = { type: 'item', object: object, perms: perms, checked: checked };
    if (opts.conditional) row.conditional = true;
    if (opts.nested && opts.nested.length) row.nested = opts.nested;
    return row;
  }
  function group(name, opts) {
    opts = opts || {};
    return { type: 'group', name: name, collapsed: !!opts.collapsed };
  }
  function nested(object, perms, checked) {
    return { object: object, perms: perms, checked: checked || perms.map(function () { return true; }) };
  }

  var AI_PERMISSION_ROWS = [
    group('AI助手'),

    /* ── 检测标准建模：标准成果库 + 建模工作台 ── */
    item('检测标准建模', ['查看', '使用'], {
      nested: [
        nested('标准成果库', [
          '查看', '搜索', '上传文件本体', '查看元数据与代替关系',
          '新增标准族', '编辑层级角色', '维护替代与废止关系',
          '查看成果版本', '下载稿件', '查看范围级问答沉淀', '查看引用与复用记录',
          '发起拆解', '以此拆解新任务', '对比成果版本'
        ], [true, true, true, true, true, false, false,
            true, true, true, true, true, true, false]),
        nested('建模工作台 · 任务', [
          '查看任务列表', '查看任务详情', '新建任务', '重命名', '归档', '转交 Owner'
        ]),
        nested('建模工作台 · 输入与拆解 F1', [
          '上传输入文件', '发起拆解', '查看拆解进度', '回答范围级问题',
          '回答字段级问题', '跳过字段级问题', '批量指令', '下载初版稿件'
        ]),
        nested('建模工作台 · 校稿与定稿 F2', [
          '查看稿件表格', '编辑单元格', '下载稿件', '上传线下稿件',
          '对比上一版稿件', '一键确认差异', '回退为上一版', '定稿'
        ]),
        nested('建模工作台 · 预检与入库 F3', [
          '查看预检结果', '查看写操作计划', '发起入库', '授权变更与停用',
          '重放已入库块', '回滚入库块'
        ], [true, true, false, false, false, false]),
        nested('任务协作与共享', [
          '邀请成员', '变更成员角色', '移除成员', '指派问题',
          '申请入库审批', '查看待我处理', '批注'
        ]),
        nested('编排与留痕', [
          '发起跨阶段编排', '查看编排留痕', '撤销编排', '查看 AI 自决清单'
        ]),
        nested('公司基线', [
          '查看公司基线成果', '回流拆解成果到公司基线', '回流前脱敏预览'
        ], [true, false, false])
      ]
    }),

    /* ── AI 报告审核面板 ── */
    item('AI报告审核', ['查看', '使用'], {
      nested: [
        nested('审核面板', [
          '查看', '切换日期范围', '查看审核任务量走势', '查看三态结论分布',
          '查看规则命中不通过 TOP', '查看不通过严重度分布', '查看过程中待处理',
          '查看审核异常', '查看已归档数据', '查看排队中任务', '去处置'
        ]),
        nested('报告审核工作台', [
          '查看报告', '查看审核结论', '查看规则执行清单', '人工重跑审核',
          '采纳AI结论', '驳回AI结论', '修改判定结论', '提交复核'
        ], [true, true, true, false, true, true, false, false]),
        nested('审核规则库', [
          '查看规则', '新增规则', '编辑规则', '启用停用规则', '规则组管理',
          '品类规则绑定', '品类字典镜像', '试跑规则'
        ], [true, false, false, false, false, false, true, false]),
        nested('审核快照', [
          '查看快照', '按轮次查看', '查看规则执行清单', '报告预览',
          '快照哈希校验', '导出快照'
        ]),
        nested('归档名单', [
          '查看名单', '按状态筛选', '查看已删除', '导出名单'
        ])
      ]
    }),

    /* ── AI 助手 · 会话与档位 ── */
    item('AI 助手 · 会话', ['发起对话', '上传附件与截图', '查看历史会话', '清空会话', '选择模型', '查看引用出处', '反馈答案质量']),
    item('运行档位', ['内部档', '客户档'], { checked: [true, true], conditional: true }),
    item('数据可见范围', ['查看本客户数据', '查看公司基线数据'], { checked: [true, false], conditional: true })
  ];

  global.TestOSAiPermissions = {
    moduleName: 'AI助手',
    rows: AI_PERMISSION_ROWS,
    clone: function () { return JSON.parse(JSON.stringify(AI_PERMISSION_ROWS)); }
  };
})(window);
