/**
 * 实验室数据采集系统 · 移动端 App 操作权限清单
 * 用途：TestOS 角色管理原型 · 检测员侧平板 App
 * 编码规范：app:{模块}:{子模块}:{资源}:{动作}
 */
(function (global) {
  function item(object, perms, opts) {
    opts = opts || {};
    var checked = opts.checked;
    if (!checked) {
      checked = perms.map(function () {
        return opts.defaultChecked !== false;
      });
    }
    return {
      type: 'item',
      object: object,
      perms: perms,
      checked: checked,
      conditional: !!opts.conditional,
      phase2: !!opts.phase2
    };
  }

  function group(name, opts) {
    opts = opts || {};
    return {
      type: 'group',
      name: name,
      collapsed: !!opts.collapsed,
      phase2: !!opts.phase2
    };
  }

  var APP_PERMISSION_ROWS = [
    group('登录认证'),
    item('登录会话', ['登录', '退出登录']),
    item('账号密码', ['修改密码']),

    group('首页'),
    item('消息通知入口', ['查看', '进入通知中心']),
    item('今日工作概览', ['查看逾期任务', '查看 3 日内到期', '查看退回复测', '进入对应聚焦页']),
    item('快捷入口', ['查看待检', '查看检测中', '查看已检', '进入对应页面']),
    item('个人检测统计', ['查看', '切换时间区间（本年/本季/本月）']),

    group('检测模块'),
    item('模块导航', ['查看', '切换按设备/按任务模式', '选择工位', '清除工位']),
    item('L1 设备列表', ['查看', '搜索过滤', '采集方式筛选', '展开/收起非工位设备区', '进入 L2']),
    item('L2 委托任务列表', ['查看', '搜索过滤', '样品扫码进 L3', '任务排序', '进入 L3', '查看设备摘要']),
    item('L3 样品与试验项', ['查看任务摘要', '查看样品列表', '切换样品', '查看样品全名', '查看试验项列表', '进入 L4 采集', 'L3 搜索过滤', '查看样品标签二维码']),

    group('采集详情（L4）'),
    item('基础信息与流程', ['查看基础信息', '查看样品标签二维码', '查看试验时间', '记录开始时间', '覆盖开始时间'], { conditional: true }),
    item('设备信息', ['查看/切换设备（单试验项）', '指派/切换/移除设备（多子项）'], { conditional: true }),
    item('环境信息', ['查看环境温湿度', '刷新']),
    item('试验数据录入 · 设备直连 auto', ['查看', '上传', '重置'], { conditional: true }),
    item('试验数据录入 · 拍照识别 ocr', ['查看', '拍照', '编辑', '上传', '重置', '删除参照图'], { conditional: true }),
    item('试验数据录入 · 蓝牙 ble', ['查看', '连接', '手输', '上传', '重置'], { conditional: true }),
    item('试验数据录入 · 外部程序 external', ['查看', '手输', '上传', '重置'], { conditional: true }),
    item('试验数据录入 · 手工录入 manual', ['查看', '编辑', '上传', '重置'], { conditional: true }),
    item('试验数据录入 · 通用', ['编辑室温/湿度（条件）', '单条上传', '批量上传', '全部上传', '重置全部'], { conditional: true }),

    group('已检任务'),
    item('时间范围切换', ['查看', '切换（近 7 天/近 30 天/近 90 天/本年）']),
    item('已检任务列表', ['查看', '进入 L3 复核']),
    item('已检 L3 样品与试验项', ['查看', '进入 L4 复核']),
    item('已检 L4 历史数据', ['查看', '编辑', '重新上传'], { conditional: true }),
    item('历史数据提示', ['查看']),
    item('样品标签二维码', ['查看']),

    group('消息通知'),
    item('通知列表', ['查看']),
    item('全部已读', ['标记全部已读']),
    item('通知详情', ['查看']),
    item('退回复测·去处理', ['深链到退回复测 L3']),

    group('我的'),
    item('用户信息', ['查看用户信息头', '编辑头像（演示）', '查看部门/手机/邮箱/机构（只读）', '查看角色标签（只读）']),
    item('设置', ['查看/编辑 IP 连接', '相机方向锁定', '消息推送开关', '清除缓存（演示）']),
    item('其他', ['修改密码', '帮助与反馈', '意见反馈邮箱（只读）', '隐私政策', '服务协议', '关于我们', '退出登录'])
  ];

  global.TestOSAppPermissions = {
    moduleName: '实验室数据采集系统 · 移动端 App',
    rows: APP_PERMISSION_ROWS,
    clone: function () {
      return JSON.parse(JSON.stringify(APP_PERMISSION_ROWS));
    }
  };
})(window);
