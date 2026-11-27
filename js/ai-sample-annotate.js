/**
 * 批注模式：把"这个按钮是干什么的"直接标在界面上。
 * 开关在顶栏。开启后每个可操作位置出现编号，悬停看说明，点一下钉住。
 * 只读层，不改任何交互逻辑，也不参与真实系统。
 */
(function (global) {
  'use strict';
  var ITEMS = [
    { s: '.wb-badge', ti: '运行档位',
      x: '内部档=我方实施/专家用，可现推新标准族并把定稿回流成公司资产；客户档=客户实验室用，成果只进自己环境。两档功能一样，差别只在数据往哪儿沉淀。' },
    { s: '#peerBar .peers', ti: '任务成员',
      x: '这个任务里的人。描边的是负责人，蓝底的是你。悬停看角色和有没有入库权。共享只在同租户内，不做跨客户。' },
    { s: '#peerBar .shbtn', ti: '邀请',
      x: '打开协作面板：邀请同租户成员、改角色、单独授予入库权、转交负责人、处理入库申请。' },
    { s: '#peerBar .meSel', ti: '切换身份',
      x: '原型演示用：换成"拆解执行"或"校稿专家"，就能看同一个人在不同身份下能点什么、点了会怎样。' },
    { s: '.an-btn', ti: '批注开关', x: '就是当前这个按钮。关掉后界面恢复干净。' },
    { s: '#wbDoc', ti: '稿件状态',
      x: '当前选中任务的稿件走到哪一步了：未生成 / v1-draft 已生成 / vN-final 已定稿 / 已入库。切换任务它跟着变。' },
    { s: '#wbStats .wb-prog', ti: '处置进度',
      x: '问题处置进度 = 已处置条数 / 总条数。范围级问题不答完，这条线不会满。' },
    { s: '.wb-tasks-h button:first-child', ti: '新建',
      x: '新建一个拆解任务。一个任务只处理一份标准文件，一次上传多份标准会拆成多个任务。' },
    { s: '.wb-tasks-h button:last-child', ti: '重置',
      x: '清掉本地演示数据（任务、问答、稿件、成员），回到初始四个任务。' },
    { s: '.wb-task .bar', ti: '任务阶段',
      x: '三格分别是 拆解 / 校稿 / 入库：实心=已过，蓝点=当前，空心=未到。' },
    { s: '.wb-task .tmore', ti: '任务菜单',
      x: '邀请成员、复制任务链接、转交负责人、归档。归档不删已入库数据，只从列表收起。' },
    { s: '.wb-arts-h', ti: '任务进度',
      x: '当前任务的五个节点：上传料 → 拆解生成 → 问题处置 → 校稿定稿 → 预检入库。点任意节点直接打开对应产物。' },
    { s: '#sideTabs', ti: '文件 / 预览',
      x: '文件=这个任务的输入料与产出稿件；预览=把当前展开的产物放大到这里看。' },
    { s: '.padd', ti: '添加文件',
      x: '给当前选中的任务补料。注意挂在哪个任务上——切错任务料就进错地方了。' },
    { s: '.po .odl', ti: '下载稿件',
      x: '下载这个任务当前版本的 xlsx，可以线下改完再传回来。' },
    { s: '.wb-att i:first-child', ti: '上传附件',
      x: '给对话加文件（能力表、标准 PDF、报告、记录单）。先挂到输入框，随下一条消息一起发出。' },
    { s: '.wb-att i:last-child', ti: '上传图片',
      x: '贴截图或照片，比如判定条件截图、仪器面板。AI 会读图后比对现有配置。' },
    { s: '#wbBatch', ti: '直接说',
      x: '不点快捷按钮也能用：说"把环刚度下限改成 95 并入库"，AI 会识别成先改稿件再重放入库两步执行，不会直接改库。' },
    { s: '.wb-adoptall', ti: '全部采纳默认值',
      x: '把所有问题的第一项（AI 推荐值）一次落定。范围级问题不适用，它们必须逐条回答。' },
    { s: '.qk', ti: '三个快捷功能',
      x: '生成初版稿件（F1）/ 校稿与定稿（F2）/ 预检入库（F3）。可以只用其中一个，不必从头走到尾。' },
    { s: '.wb-must', ti: '必答 · 不可跳过',
      x: '范围级问题决定拆解结构本身，不答不能出稿，所以没有跳过按钮。' },
    { s: '.wb-skipbtn', ti: '跳过',
      x: '字段级问题可以先跳过：不阻塞出稿也不阻塞定稿，但入库前会再问一次；仍跳过就由 AI 按自己的理解落库并通知你。' },
    { s: '.wb-undo', ti: '撤销',
      x: '撤回这条处置，恢复未答状态。' },
    { s: '.wb-asg', ti: '指派',
      x: '把这个问题交给任务里的某个人。被指派者左栏会出现"待我 N"。' },
    { s: '.wb-loc', ti: '定位到表格',
      x: '跳到稿件对应 sheet 的具体格子并高亮，改值和看问题是同一个地方。' },
    { s: '.wb-merge', ti: '同因合并',
      x: '同一个原因造成的多条问题合起来问一次，展开可以看涉及哪几行哪几列。' },
    { s: '.wb-conf', ti: '来源色标',
      x: '已验证=已在检测依据标准文件核对；冲突=与标准条款不一致必须人裁决；未验证=有来源没核对；AI推断=输入里没有；无来源=空着待问。' },
    { s: '#f2Body .stickr .wb-loc', ti: '溯源',
      x: '这一行的出处：来自哪份文件、解析路径、权威校验做没做、属于哪个试验项、全字段一览。' },
    { s: '.f2-gate .btn-save', ti: '定稿',
      x: '未处置清零才能按。跳过不算未处置。定稿后版本不可变，再改自动开新版本。' },
    { s: '.wchip', ti: '写操作分布',
      x: '这次入库会执行的动作：新建 / 挂载 / 复用不动已有数据；变更和停用会动到在流转的检测任务，必须逐条授权。' },
    { s: '.wauth', ti: '逐条授权',
      x: '勾上表示你确认这些变更和停用影响可接受。不勾入库按钮不放行；没有授权权限的人会转成向负责人申请。' },
    { s: '#btnImport', ti: '拆解入库',
      x: '系统数据唯一的写入口。按样品分块，一块一事务，失败只回滚本块。' }
  ];
  var ON = false, PIN = -1;
  var layer, tip;

  function boot() {
    layer = document.createElement('div'); layer.id = 'anLayer'; layer.className = 'an-layer';
    (document.querySelector('.wb-main') || document.body).appendChild(layer);
    tip = document.createElement('div'); tip.id = 'anTip'; tip.className = 'an-tip';
    document.body.appendChild(tip);
    document.addEventListener('mouseover', function (e) {
      var b = e.target.closest ? e.target.closest('.an') : null;
      if (b) show(+b.getAttribute('data-i'), b);
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.an') : null;
      if (!b) return;
      e.stopPropagation(); e.preventDefault();
      var i = +b.getAttribute('data-i');
      PIN = (PIN === i ? -1 : i);
      show(i, b);
    }, true);
    window.addEventListener('resize', refresh);
    var sc = document.querySelector('.wb-body');
    if (sc) sc.addEventListener('scroll', refresh);
    document.addEventListener('scroll', refresh, true);
    if (window.MutationObserver) {
      var t = null;
      new MutationObserver(function () {
        if (!ON) return;
        if (t) clearTimeout(t); t = setTimeout(refresh, 180);
      }).observe(document.body, { childList: true, subtree: true, attributes: true });
    }
  }
  function show(i, b) {
    var it = ITEMS[i]; if (!it || !tip) return;
    tip.innerHTML = '<b>' + (i + 1) + ' · ' + it.ti + '</b><p>' + it.x + '</p>';
    tip.classList.add('show');
    var r = b.getBoundingClientRect();
    var w = 320, left = Math.min(Math.max(12, r.left - w / 2), window.innerWidth - w - 12);
    var top = r.bottom + 12;
    if (top + 150 > window.innerHeight) top = Math.max(12, r.top - 150);
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  function refresh() {
    if (!ON || !layer) return;
    var host = layer.parentNode, hb = host.getBoundingClientRect();
    var html = '', seen = [];
    ITEMS.forEach(function (it, i) {
      var el = document.querySelector(it.s);
      if (!el) return;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      if (r.bottom < hb.top - 4 || r.top > hb.bottom + 4) return;
      var x = Math.min(Math.max(r.right - hb.left + 3, 0), hb.width - 20);
      var y = Math.max(0, r.top - hb.top - 6);
      if (y < -6) return;
      html += '<span class="an' + (PIN === i ? ' pin' : '') + '" data-i="' + i + '" style="left:' +
        Math.round(x) + 'px;top:' + Math.round(y) + 'px">' + (i + 1) + '</span>';
      seen.push(el);
    });
    layer.innerHTML = html;
    ITEMS.forEach(function (it) {
      var el = document.querySelector(it.s);
      if (el) el.classList.remove('an-hi');
    });
    seen.forEach(function (el) { el.classList.add('an-hi'); });
    if (PIN < 0) { if (tip) tip.classList.remove('show'); }
    else { var b = layer.querySelector('.an[data-i="' + PIN + '"]'); if (b) show(PIN, b); }
  }
  var AN = {
    boot: boot,
    items: ITEMS,
    toggle: function () {
      ON = !ON; PIN = -1;
      document.body.classList.toggle('anno-on', ON);
      var btn = document.getElementById('btnAnno');
      if (btn) btn.classList.toggle('on', ON);
      if (ON) refresh();
      else { layer.innerHTML = ''; tip.classList.remove('show');
        ITEMS.forEach(function (it) { var e = document.querySelector(it.s); if (e) e.classList.remove('an-hi'); }); }
    },
    refresh: refresh,
    isOn: function () { return ON; }
  };
  global.AN = AN;
})(window);
