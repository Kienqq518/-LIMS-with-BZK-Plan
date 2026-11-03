/* 收样信息历史 mock（详情页专用）
 * 规则：节点在「样品收样」之后的委托，详情页「收样信息」必须有内容；
 *      仍停留在样品收样节点的委托（PENDING_RECEIVE）不生成，保持
 *      「该委托尚无收样提交记录」，这样样品收样页的待收列表不会被吃掉。
 * 生成走 ReceiveStore.seedDemo —— 幂等、只补缺、不覆盖手工收样记录。
 */
(function (global) {
  // 与「样品管理 › 样品收样」列表一致：这些委托还停在收样节点
  var PENDING_RECEIVE = [
    'SC2026/0080', 'SC2026/0067', 'SC2026/0065', 'SC2026/0063', 'SC2026/0061', 'SC2026/0059',
    'SC2026/0057', 'SC2026/0055', 'SC2026/0053', 'SC2026/0051', 'SC2026/0049', 'SC2026/0047',
    'SC2026/0045', 'SC2026/0043', 'SC2026/0041', 'SC2026/0039'
  ];

  var PHOTOS = [
    'assets/report-trace/photo-receive-front.png',
    'assets/report-trace/photo-receive-side.png',
    'assets/report-trace/photo-03-field.jpg',
    'assets/report-trace/photo-05-bend.jpg'
  ];

  /* 部分样品已收样的演示种子：样品收样页与委托详情页共用这一份，避免两个页面口径不一致。
   * 这些委托仍停在收样节点（还有未收的样品），所以只播种已收的那几行。 */
  var PARTIAL_RECEIVED = [
      {
        entrustCode: 'SC2026/0055', receiver: 'admin', status: '完好', receiveDate: '2026-10-27',
        delivery: '送样', sender: '李工', senderPhone: '13900000000', remark: '样品外观完好，随货单齐全',
        lines: [{ sampleKey: 'SC2026/0055|绝缘毯', name: '绝缘毯', qty: '3', unit: '块', leafId: 'blanket', modelCode: '', specValues: [], mark: '绝缘毯 DLT 976-2017',
          images: ['assets/report-trace/photo-receive-front.png', 'assets/report-trace/photo-receive-side.png'] }]
      },
      {
        entrustCode: 'SC2026/0051', receiver: '张三', status: '完好', receiveDate: '2026-10-26',
        delivery: '上门', sender: '王师傅', senderPhone: '13800001111', remark: '',
        lines: [{ sampleKey: 'SC2026/0051|遮蔽罩', name: '遮蔽罩', qty: '1', unit: '件', leafId: 'shield', modelCode: '', specValues: [], mark: '遮蔽罩 DLT 976-2017', images: [] }]
      },
      {
        entrustCode: 'SC2026/0043', receiver: 'admin', status: '异常', receiveDate: '2026-10-25',
        delivery: '送样', sender: '赵工', senderPhone: '13700002222', remark: '其中 1 顶帽壳有划痕，已拍照留证',
        lines: [{ sampleKey: 'SC2026/0043|安全帽', name: '安全帽', qty: '3', unit: '顶', leafId: 'helmet', modelCode: '', specValues: [],
          mark: '安全帽 DLT 1476-2023', images: ['assets/report-trace/photo-01-bench.jpg', 'assets/report-trace/photo-03-field.jpg'] }]
      },
      {
        entrustCode: 'SC2026/0041', receiver: '李四', status: '完好', receiveDate: '2026-10-28',
        delivery: '送样', sender: '孙工', senderPhone: '13600003333', remark: '规格参数已在收样时补填',
        lines: [{ sampleKey: 'SC2026/0041|10kV3芯电力电缆', name: '10kV3芯电力电缆', qty: '3', unit: '根', leafId: 'cu6-3c', modelCode: 'YJV22',
          specValues: ['95', '8.7/10'], mark: 'YJV22 - 8.7/10 3X95 GBT 12706.2-2020', images: ['assets/report-trace/photo-05-bend.jpg'] }]
      },
      {
        entrustCode: 'SC2026/0039', receiver: 'admin', status: '完好', receiveDate: '2026-10-24',
        delivery: '送样', sender: '', senderPhone: '', remark: '',
        lines: [{ sampleKey: 'SC2026/0039|验电器', name: '验电器', qty: '2', unit: '支', leafId: 'detector', modelCode: '', specValues: [], mark: '验电器 DLT 976-2017', images: [] }]
      },
      {
        // 规格参数只填了一部分：产品标记里缺的那段渲染成「/」，一眼看出公称内径还没填
        entrustCode: 'SC2026/0045', receiver: 'admin', status: '完好', receiveDate: '2026-10-23',
        delivery: '快递', sender: '周师傅', senderPhone: '13500004444', remark: '导管已收，电缆待厂家补送；公称内径待补填',
        lines: [{ sampleKey: 'SC2026/0045|DS实壁类塑料电缆导管_直管', name: 'DS实壁类塑料电缆导管_直管', qty: '4', unit: '根', leafId: 'ds-s', modelCode: 'PVC-C',
          specValues: ['SN8', '3000', '', '3.0'], mark: 'PVC-C - / DLT 802.3-2023',
          images: ['assets/report-trace/photo-receive-front.png'] }]
      }
    ];


  /* ===== 委托确认退回委托登记、变更委托信息后重新往下流转的三种演示委托 =====
   * kept    ：上次已收样、本次仍保留的样品 → 收样信息原样保留，不重复收
   * added   ：变更新增的样品          → 待收
   * removed ：变更删掉的样品          → 不走收样，要走退样；各处置灰并标「已删除」
   * 场景1 = 0033 只增加样品；场景2 = 0031 只减少样品（跳过收样，直接到委托确认）；
   * 场景3 = 0029 既减少又增加（回到收样页，只收新增的那件）。
   */
  var RETURN_REDO = [
    {
      code: 'SC2026/0033', scene: '增加样品', status: '样品收样', contract: '/',
      customer: '杭州数蚕智能科技有限公司', sendDate: '2026-10-27', requireDate: '2026-11-20',
      acceptDate: '2026-10-20', prepaid: '否', priority: '常规', editor: 'admin', salesman: '梁倩',
      recv: { receiver: 'admin', status: '完好', receiveDate: '2026-10-21', delivery: '送样',
              sender: '李工', senderPhone: '13900000000', remark: '委托确认退回登记后，保留上次收样信息' },
      kept: [{ name: '绝缘操作杆', qty: '1', unit: '根', leafId: 'rod',
               imgs: ['assets/report-trace/photo-receive-front.png', 'assets/report-trace/photo-receive-side.png'] }],
      added: [{ name: '绝缘杆', qty: '2', unit: '根', leafId: 'pole' }],
      removed: []
    },
    {
      code: 'SC2026/0031', scene: '减少样品', status: '委托确认', contract: '/',
      customer: '东集西造有限公司', sendDate: '2026-10-19', requireDate: '2026-11-18',
      acceptDate: '2026-10-18', prepaid: '否', priority: '常规', editor: 'admin', salesman: '业务员A',
      recv: { receiver: '张三', status: '完好', receiveDate: '2026-10-19', delivery: '快递',
              sender: '周师傅', senderPhone: '13500004444', remark: '安全帽已退回委托方，本单不再检测' },
      kept: [{ name: '遮蔽罩', qty: '1', unit: '件', leafId: 'shield',
               imgs: ['assets/report-trace/photo-receive-front.png'] }],
      added: [],
      removed: [{ name: '安全帽', qty: '3', unit: '顶', leafId: 'helmet', deleted: true,
                  imgs: ['assets/report-trace/photo-01-bench.jpg', 'assets/report-trace/photo-03-field.jpg'] }]
    },
    {
      code: 'SC2026/0029', scene: '既减少又增加', status: '样品收样', contract: '/',
      customer: '宇宙设想有限公司', sendDate: '2026-10-17', requireDate: '2026-11-16',
      acceptDate: '2026-10-16', prepaid: '否', priority: '加急', editor: 'admin', salesman: '梁倩',
      recv: { receiver: '李四', status: '完好', receiveDate: '2026-10-17', delivery: '送样',
              sender: '孙工', senderPhone: '13600003333', remark: '验电器由客户补送；绝缘毯维持原收样记录' },
      kept: [{ name: '绝缘毯', qty: '2', unit: '块', leafId: 'blanket',
               imgs: ['assets/report-trace/photo-receive-side.png'] }],
      added: [{ name: '验电器', qty: '2', unit: '支', leafId: 'detector' }],
      removed: [{ name: '绝缘硬梯', qty: '1', unit: '把', leafId: 'hardladder', deleted: true,
                  imgs: ['assets/report-trace/photo-05-bend.jpg'] }]
    }
  ];

  /* 上次那一次收样提交 = 一条记录：保留的样品与被删的样品都在里面（被删的带 deleted 标记） */
  function redoRecords() {
    return RETURN_REDO.map(function (e) {
      var lines = (e.kept || []).concat(e.removed || []).map(function (sn) {
        return { sampleKey: e.code + '|' + sn.name, name: sn.name, qty: sn.qty, unit: sn.unit,
                 leafId: sn.leafId || '', modelCode: sn.modelCode || '', specValues: sn.specs || [],
                 mark: '', images: (sn.imgs || []).slice(), deleted: !!sn.deleted };
      });
      return { entrustCode: e.code, receiver: e.recv.receiver, status: e.recv.status,
               receiveDate: e.recv.receiveDate, delivery: e.recv.delivery, sender: e.recv.sender,
               senderPhone: e.recv.senderPhone, remark: e.recv.remark, lines: lines };
    });
  }

  /* 收样列表用的行：保留 + 新增 + 被删（被删的带 deleted，行内置灰标「已删除」） */
  function redoReceiveRows() {
    return RETURN_REDO.filter(function (e) { return e.status === '样品收样'; }).map(function (e) {
      return {
        code: e.code, contract: e.contract, customer: e.customer,
        sample: e.kept.concat(e.added).map(function (sn) { return sn.name; }).join('、'),
        sendDate: e.sendDate, requireDate: e.requireDate, acceptDate: e.acceptDate,
        prepaid: e.prepaid, priority: e.priority, status: '样品收样', editor: e.editor, salesman: e.salesman,
        samples: e.kept.concat(e.added).concat(e.removed).map(function (sn) {
          return { name: sn.name, qty: sn.qty, unit: sn.unit, leafId: sn.leafId, deleted: !!sn.deleted };
        })
      };
    });
  }

  /* 委托确认列表用的行：变更删掉样品后跳过收样、直接回到委托确认的委托 */
  function redoConfirmRows() {
    return RETURN_REDO.filter(function (e) { return e.status === '委托确认'; }).map(function (e) {
      return {
        code: e.code, contract: e.contract, customer: e.customer,
        sample: e.kept.map(function (sn) { return sn.name; }).join('、'),
        sendDate: e.sendDate, requireDate: e.requireDate, acceptDate: e.acceptDate,
        editor: e.editor, salesman: e.salesman
      };
    });
  }

  /* 还样记录行：被删的样品没有还样动作，还样人/日期/确认表都是「/」，图片沿用收样时上传的 */
  function redoReturnRecords(e) {
    var rows = (e.kept || []).map(function (sn) {
      return { name: sn.name + '(' + sn.qty + ')', returner: e.recv.receiver, returnDate: e.recv.receiveDate,
               doc: e.code.replace('/', '-') + '还样退库确认表.docx', confirmed: false };
    });
    (e.removed || []).forEach(function (sn) {
      rows.push({ name: sn.name + '(' + sn.qty + ')', deleted: true, images: (sn.imgs || []).slice() });
    });
    return rows;
  }

  function S(name, qty, unit, leafId, o) {
    o = o || {};
    return { name: name, qty: qty, unit: unit, leafId: leafId || '',
             modelCode: o.model || '', specs: o.specs || [], spec: o.spec || '',
             imgs: o.imgs === undefined ? 1 : o.imgs };
  }

  // 样品名称/数量/单位与「委托预览」列表里的样品名称列保持一致；accept = 委托受理日期
  var ENTRUSTS = {
    'SC2026/0073': { accept: '2026-07-08', samples: [S('绝缘操作杆', '1', '根', 'rod', { spec: '300', imgs: 2 })] },
    'SC2026/0212': { accept: '2026-07-08', samples: [S('绝缘操作杆', '1', '根', 'rod', { spec: '300', imgs: 2 })] },
    'SC2026/0211': { accept: '2026-07-07', samples: [S('绝缘操作杆', '1', '根', 'rod', { spec: '300', imgs: 1 })] },
    'SC2026/0210': { accept: '2026-07-07', samples: [S('绝缘毯', '2', '块', '', { spec: '10kV 二级', imgs: 2 }),
                                                     S('安全带', '1', '条', 'belt976', { imgs: 1 })] },
    'SC2026/0208': { accept: '2026-06-15', batches: 2, samples: [S('绝缘操作杆', '2', '根', 'rod', { spec: '10kV 300', imgs: 1 }),
                                                     S('绝缘杆', '2', '根', '', { spec: '110kV 3000', imgs: 0 })] },
    'SC2026/0207': { accept: '2026-06-11', samples: [S('遮蔽罩', '1', '件', '', { spec: '10kV', imgs: 1 }),
                                                     S('安全带', '1', '条', 'belt976', { imgs: 1 })] },
    'SC2026/0206': { accept: '2026-06-16', samples: [S('安全帽', '5', '顶', 'helmet', { imgs: 2 })] },
    'SC2026/0205': { accept: '2026-06-11', samples: [S('绝缘操作杆', '1', '根', 'rod', { spec: '35kV 400', imgs: 1 })] },
    'SC2026/0204': { accept: '2026-06-10', status: '异常', remark: '杆体运输磕碰一处，已现场拍照留证，与客户确认可检',
                     samples: [S('绝缘杆', '2', '根', '', { spec: '35kV 2000', imgs: 2 })] },
    'SC2026/0203': { accept: '2026-06-10', samples: [S('电线电缆', '3', '米', '', { spec: 'YJV22-8.7/15kV 3×95', imgs: 1 })] },
    'SC2026/0202': { accept: '2026-06-10', samples: [S('绝缘操作杆', '1', '根', 'rod', { spec: '10kV 300', imgs: 0 })] },
    'SC2026/0201': { accept: '2026-06-10', samples: [S('绝缘毯', '2', '块', '', { spec: '10kV 一级', imgs: 1 }),
                                                     S('安全带', '1', '条', 'belt976', { imgs: 1 })] },
    'SC2026/0200': { accept: '2026-06-10', samples: [S('绝缘操作杆', '1', '根', 'rod', { spec: '300', imgs: 1 })] }
  };

  // 收样人 / 送样方式 / 送样人：按委托号轮转，保证同一委托每次刷新结果一致
  var CREW = [
    ['admin', '送样', '安可', '17835503262'],
    ['张三', '上门', '王师傅', '13800001111'],
    ['李四', '送样', '赵工', '13700002222'],
    ['王五', '快递', '周师傅', '13500004444']
  ];

  function hashCode(s) {
    var h = 0;
    for (var i = 0; i < String(s || '').length; i++) h = (h * 31 + String(s).charCodeAt(i)) % 100000;
    return h;
  }

  // 受理日期 + n 天 = 收样日期（不依赖 Date，避免每次刷新漂移）
  function plusDays(accept, n) {
    var p = String(accept || '2026-07-01').split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n);
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function markOf(ln) {
    var st = global.SampleDataStore;
    if (!st || !ln.leafId) return '';
    try { return st.markOf(ln.leafId, ln.modelCode, ln.specValues || []) || ''; } catch (e) { return ''; }
  }

  function buildLine(code, s, photoSeed) {
    var images = [];
    for (var i = 0; i < (s.imgs || 0); i++) images.push(PHOTOS[(photoSeed + i) % PHOTOS.length]);
    var ln = {
      sampleKey: code + '|' + s.name,
      name: s.name, qty: s.qty, unit: s.unit,
      leafId: s.leafId || '', modelCode: s.modelCode || '',
      specValues: (s.specs || []).slice(), spec: s.spec || '', images: images
    };
    ln.mark = markOf(ln);
    return ln;
  }

  /**
   * 为「已过收样节点」的委托补一条/两条收样记录。
   * @param code     委托编号
   * @param fallback 详情页自身展示的样品（未知编号时用它，保证与「检测信息」一致）
   * @returns 新增记录条数（0 = 无需生成或已存在）
   */
  function ensure(code, fallback) {
    var RS = global.ReceiveStore;
    if (!RS || !code) return 0;
    RS.seedDemo(PARTIAL_RECEIVED);                             // 先补「部分已收样」种子（幂等）
    // 节点判定优先看流程阶段（EntrustMock + FlowStages），拿不到时退回样品收样页名单
    var past = (global.EntrustMock && global.EntrustMock.isPastReceive)
      ? global.EntrustMock.isPastReceive(code)
      : PENDING_RECEIVE.indexOf(code) < 0;
    if (!past) return 0;                                       // 尚未过收样节点：只可能有部分收样
    if (RS.recordsOf(code).length) return 0;                   // 已有记录（手工收过或已播种）
    var ent = ENTRUSTS[code];
    var accept, samples;
    if (ent) {
      accept = ent.accept; samples = ent.samples;
    } else {
      samples = ((fallback && (fallback.samples || fallback)) || []).map(function (s) {
        // 兼容两种写法：mock 里用 specs 存规格取值，收样记录字段名是 specValues
        if (s && s.specs && !s.specValues) { s.specValues = s.specs; }
        return s;
      });
      if (!samples.length) return 0;
      accept = (fallback && fallback.accept) || '2026-07-08';
    }
    var h = hashCode(code), crew = CREW[h % CREW.length];
    // 显式声明 batches=2，或样品 ≥3 类时拆成两次收样，演示「分次收样 + 每次各自的图片」
    var batches = samples.length >= 3
      ? [samples.slice(0, 2), samples.slice(2)]
      : (ent && ent.batches === 2 && samples.length === 2 ? [[samples[0]], [samples[1]]] : [samples]);
    var recs = batches.map(function (group, n) {
      return {
        entrustCode: code,
        receiver: crew[0],
        status: (n === 1 ? '完好' : (ent && ent.status) || '完好'),
        receiveDate: plusDays(accept, 1 + n * 3),
        delivery: crew[1], sender: crew[2], senderPhone: crew[3],
        remark: (n === 1 ? '剩余样品由客户补送' : (ent && ent.remark) || ''),
        lines: group.map(function (s, i) { return buildLine(code, s, (h + i) % PHOTOS.length); })
      };
    });
    return RS.seedDemo(recs);
  }

  global.ReceiveHistory = {
    ensure: ensure,
    PARTIAL_RECEIVED: PARTIAL_RECEIVED,
    PENDING_RECEIVE: PENDING_RECEIVE,
    ENTRUSTS: ENTRUSTS,
    RETURN_REDO: RETURN_REDO,
    redoRecords: redoRecords,
    redoReceiveRows: redoReceiveRows,
    redoConfirmRows: redoConfirmRows,
    redoReturnRecords: redoReturnRecords
  };
})(window);
