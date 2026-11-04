/* 标签 / 合格证打印的样品清单（统一数据源）
 * 背景：样品标签预览、合格证单张、合格证批量、合格打印四个页面各自写了一份样品表，
 *      同一张委托点「样品标签」和点「合格证」看到的样品并不一样
 *      （例：SC2026/0073 一边写安全带、一边写验电器，而委托详情里其实是绝缘操作杆）。
 * 口径：① 委托下有哪些样品 = js/entrust-mock.js，与委托详情 / 样品收样 / 变更记录同源；
 *      ② 被删除的样品（变更删除、退回登记后删除）不进打印清单，但它占用的样品编号不回收，
 *         后面的样品顺延占位（编号 = 委托号 + 两位组号 + '01'）；
 *      ③ 判定不合格的演示单在 JUDGMENT_BY_ENTRUST 里按委托号配置，其余一律「合格」。
 */
(function (global) {
  var JUDGMENT_BY_ENTRUST = { 'SC2026/0074': '不合格' };   // 不合格禁止打证的演示单

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function noOf(code, group) { return code + pad2(group) + '01'; }
  /** 样品编号 → 组号（末 4 位的前两位） */
  function groupOfNo(sampleNo) {
    var m = /(\d{4})$/.exec(String(sampleNo || '').replace(/\s/g, ''));
    return m ? Number(m[1].slice(0, 2)) : 0;
  }
  /** 样品编号 → 委托号（去掉末 4 位组号 + 试样号） */
  function codeOfNo(sampleNo) {
    var s = String(sampleNo || '').trim();
    return s.length > 4 ? s.slice(0, s.length - 4) : s;
  }
  function deletedOf(code) {
    var map = (global.ReceiveHistory && global.ReceiveHistory.DELETED_SAMPLES) || {};
    return map[code] || [];
  }
  /** 大类：先按样品名解析样品数据的大类，解析不到（写成规格式样品名时）按叶子节点的类目归口 */
  function catOf(sm) {
    var st = global.SampleDataStore;
    var c = (st && st.catKeyOfName) ? st.catKeyOfName(sm.name) : '';
    if (!c && sm.leafId && st && st.getSample) {
      var master = st.getSample(sm.leafId);
      var cc = (master && master.category) || '';
      if (/电力电缆|电缆保护管|导管|金具/.test(cc)) c = 'dlwz';
      else if (/安全工器具/.test(cc)) c = 'aqgqj';
      else if (/工程检测|水泥/.test(cc)) c = 'gcjc';
      else if (/环境/.test(cc)) c = 'hjjc';
    }
    return c || 'aqgqj';
  }
  /** 模版绑定用的样品主数据 id：先按标签合格证模块的名称表，再退回委托 mock 的叶子 id */
  function masterOf(sm) {
    var byName = (global.LabelCertConfig && LabelCertConfig.masterIdFromName)
      ? LabelCertConfig.masterIdFromName(sm.name) : '';
    return byName || sm.leafId || '';
  }
  /** 检测状态按流程阶段推导，避免再写一份和流程无关的假数据 */
  function detectOf(status) {
    var order = (global.FlowStages && global.FlowStages.FLOW_ORDER) || [];
    var i = order.indexOf(status);
    if (i < 0) return '未检测';
    var send = order.indexOf('样品发样'), report = order.indexOf('报告编制');
    if (i <= send) return '未检测';
    if (i < report) return '检测中';
    return '已检测';
  }
  /** 复检日期 = 检测日期 + 1 年 - 1 天（沿用原演示口径） */
  function plusYear(date) {
    var p = String(date || '').split('-');
    if (p.length !== 3) return '';
    var d = new Date(Number(p[0]) + 1, Number(p[1]) - 1, Number(p[2]) - 1);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function row(code, group, sm, m) {
    var receive = m.receiveDate || m.acceptDate || '';
    var no = noOf(code, group);
    return {
      sampleNo: no, specimenNo: no,
      entrustNo: code, entrust: code, orderNo: code,
      name: sm.name, sampleName: sm.name, alias: sm.alias || sm.name,
      qty: sm.qty, unit: sm.unit,
      spec: sm.spec || '', model: sm.modelCode || '',
      masterId: masterOf(sm), cat: catOf(sm),
      clientName: m.customer, customer: m.customer, client: m.customer,
      contract: '/', editor: m.editor, salesman: m.salesman,
      sendDate: receive, acceptDate: m.acceptDate, requireDate: m.customerDate,
      receiveDate: receive, inspectDate: receive, reinspectDate: plusYear(receive),
      detectStatus: detectOf(m.status), status: m.status || '',
      judgment: JUDGMENT_BY_ENTRUST[code] || '合格',
      _checked: true
    };
  }

  /**
   * 一张委托下要打印的样品清单。
   * @returns 数组；EntrustMock 缺失时返回 null（让页面用自己的兜底数据）
   */
  function of(code) {
    var EM = global.EntrustMock;
    if (!EM) return null;
    code = String(code || '').trim() || EM.DEFAULT_CODE;
    var m = EM.get(code);
    if (!m || !m.samples || !m.samples.length) return null;
    var dels = deletedOf(code), used = {};
    dels.forEach(function (d) { var g = groupOfNo(d.sampleNo); if (g) used[g] = 1; });
    var out = [], g = 1;
    m.samples.forEach(function (sm) {
      if (dels.some(function (d) { return d.name === sm.name; })) return;
      while (used[g]) g++;
      used[g] = 1;
      out.push(row(code, g, sm, m));
      g++;
    });
    return out;
  }

  function ofCodes(codes) {
    var out = [];
    (codes || []).forEach(function (c) {
      var list = of(String(c || '').trim());
      if (list && list.length) out = out.concat(list);
    });
    return out;
  }

  /** 按样品编号取行（合格打印列表用 nos= 传给合格证批量页） */
  function byNo(sampleNo) {
    var want = String(sampleNo || '').trim();
    var list = of(codeOfNo(want)) || [];
    var hit = null;
    for (var i = 0; i < list.length; i++) { if (list[i].sampleNo === want) hit = list[i]; }
    if (!hit && list.length) {
      hit = list[0];
      hit.sampleNo = want; hit.specimenNo = want;   // 旧链接里的编号：按请求的编号打印
    }
    return hit;
  }
  function byNos(nos) {
    var out = [];
    (nos || []).forEach(function (n) { var r = byNo(n); if (r) out.push(r); });
    return out;
  }

  global.LabelCertSamples = {
    of: of, ofCodes: ofCodes, byNo: byNo, byNos: byNos,
    noOf: noOf, codeOfNo: codeOfNo, groupOfNo: groupOfNo,
    JUDGMENT_BY_ENTRUST: JUDGMENT_BY_ENTRUST
  };
})(window);
