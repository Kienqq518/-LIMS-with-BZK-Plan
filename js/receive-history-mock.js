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
        lines: [{ sampleKey: 'SC2026/0055|绝缘毯', name: '绝缘毯', qty: '3', unit: '块', leafId: '', modelCode: '', specValues: [], mark: '',
          images: ['assets/report-trace/photo-receive-front.png', 'assets/report-trace/photo-receive-side.png'] }]
      },
      {
        entrustCode: 'SC2026/0051', receiver: '张三', status: '完好', receiveDate: '2026-10-26',
        delivery: '上门', sender: '王师傅', senderPhone: '13800001111', remark: '',
        lines: [{ sampleKey: 'SC2026/0051|遮蔽罩', name: '遮蔽罩', qty: '1', unit: '件', leafId: '', modelCode: '', specValues: [], mark: '', images: [] }]
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
        lines: [{ sampleKey: 'SC2026/0039|验电器', name: '验电器', qty: '2', unit: '支', leafId: '', modelCode: '', specValues: [], mark: '', images: [] }]
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
    ENTRUSTS: ENTRUSTS
  };
})(window);
