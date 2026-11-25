/**
 * 新增 / 编辑试验项抽屉（样品数据页 · 试验项区块）
 *
 * 对齐 LIMS 检测标准库 V1.0 PRD §3.4.1「试验信息 Tab」与真实系统截图。
 * 本轮只做第一个 Tab（试验信息）；试验参数 / 标称值 / 结果判定 / 采集配置 留占位，
 * 等 Excel 契约定下来后按迭代计划补齐——那四个 Tab 的字段就是 Excel 的列，不能先猜。
 *
 * 宿主页面需提供：currentSample() / currentModel() / CAT_META / TREES / findNode / state
 */
(function (global) {
  'use strict';

  /* ── 字典（真实系统由【数据管理-数据字典】驱动，原型内先内置一份） ───────────── */
  var DICT = {
    category: ['例行试验', '抽样试验', '委托检测', '出厂检验', '型式检验'],
    quality: ['A', 'B', 'C'],
    coreMode: ['随机选一芯', '每芯（包括复合线）', '每芯（只检测主线）', '整缆'],
    standards: [
      'GBT 3956-2008 电缆的导体',
      'GBT 12706.1-2020 额定电压1kV(Um=1.2kV)到35kV(Um=40.5kV)挤包绝缘电力电缆及附件 第1部分',
      'GBT 12706.2-2020 额定电压1kV(Um1.2kV)到35kV(Um40.5kV)挤包绝缘电力电缆及附件 第2部分',
      'GBT 12706.3-2020 额定电压1kV(Um=1.2kV)到35kV(Um=40.5kV)挤包绝缘电力电缆及附件 第3部分',
      'GBT 2951.11-2008 电缆和光缆绝缘和护套材料通用试验方法 第11部分',
      'GBT 2951.12-2008 电缆和光缆绝缘和护套材料通用试验方法 第12部分',
      'GBT 2951.21-2008 电缆和光缆绝缘和护套材料通用试验方法 第21部分',
      'GBT 3048.4-2025 电线电缆电性能试验方法 第4部分：导体直流电阻试验',
      'GBT 3048.5-2007 电线电缆电性能试验方法 第5部分：绝缘电阻试验',
      'GBT 3048.8-2025 电线电缆电性能试验方法 第8部分：交流电压试验',
      'GBT 3048.12-2007 电线电缆电性能试验方法 第12部分：局部放电试验',
      'GBT 18380.12-2022 电缆和光缆在火焰条件下的燃烧试验 第12部分',
      'DLT 802.1-2023 电力电缆导管技术条件 第1部分：总则',
      'DLT 802.3-2023 电力电缆导管技术条件 第3部分：实壁类塑料电缆导管'
    ],
    devices: [
      '2411020108 智能型数字电桥【QJ-36】',
      '2412030104 电缆保护管力学性能试验机【YWDW-100】',
      '2412060102 中高端高低温试验箱【YRD-150A】',
      '2426801 电缆机械性能检测终端【YMWJ-XL4】',
      '3236 水银温度计【(0~100)°C】',
      '33225991 数显千分尺【(0~25)mm/0.001mm】',
      'CS0001 测试同步设备【ococo】',
      'DF291968 台式测厚仪【(0~12.7)mm/0.001mm】',
      'YM-WRH-01 电缆直流电阻快速测量系统-无人化版【YWZL-G 100】'
    ]
  };

  /* ── 原型演示数据：按试验名命中，未命中走通用默认 ─────────────────────── */
  var PRESET = {
    '导体直流电阻': {
      code: 'dcdz', fee: '0', quality: '',
      categories: ['例行试验', '型式检验', '抽样试验'],
      basis: [{ std: 'GBT 3956-2008 电缆的导体', clause: '' },
              { std: 'GBT 12706.2-2020 额定电压1kV(Um1.2kV)到35kV(Um40.5kV)挤包绝缘电力电缆及附件 第2部分', clause: '16.2' }],
      deviceMode: '设备', devices: ['YM-WRH-01 电缆直流电阻快速测量系统-无人化版【YWZL-G 100】', '2411020108 智能型数字电桥【QJ-36】'],
      process: '取三相试样各 1m，用直流电桥法测量每根导体在 20℃ 下的电阻值并换算至 1km 长度。',
      req: '每根导体在20℃下1km长度的直流电阻（R₂₀）不超过GB/T 3956表1/表2规定的相应最大值',
      remark: '', hasSubItems: false, subItems: [],
      makeSample: true, sampleSegments: 1, segFlag: true, specimenQty: 1, specimenCode: '',
      coreMode: '每芯（只检测主线）'
    },
    '结构尺寸检查': {
      code: 'jgcc1', fee: '0', quality: '',
      categories: ['型式检验', '抽样试验'],
      basis: [{ std: 'GBT 12706.2-2020 额定电压1kV(Um1.2kV)到35kV(Um40.5kV)挤包绝缘电力电缆及附件 第2部分', clause: '16.4、16.5' }],
      deviceMode: '设备', devices: ['DF291968 台式测厚仪【(0~12.7)mm/0.001mm】', '33225991 数显千分尺【(0~25)mm/0.001mm】'],
      process: '', req: '绝缘厚度、外护套厚度等符合标准', remark: '',
      hasSubItems: true,
      subItems: [
        { name: '导体', code: 'jgcc1_cond', req: '符合GB/T 3956规定；' },
        { name: '绝缘厚度测量', code: 'jgcc1_t', req: '最小厚度≥标称值×90%-0.1mm【第17.5.2节式(4)】；偏心率(t_max-t_min)/t_max≤0.15【式(5)】' },
        { name: '金属屏蔽', code: 'jgcc1_p', req: '铜带屏蔽：搭盖率平均值≥15%且每处≥5%；铜带厚度最小值≥标称值×90%；' }
      ],
      makeSample: true, sampleSegments: 1, segFlag: true, specimenQty: 1, specimenCode: '',
      coreMode: '每芯（只检测主线）'
    }
  };

  var DEFAULTS = {
    code: '', fee: '0', quality: '', categories: [],
    basis: [{ std: '', clause: '' }],
    deviceMode: '目测', devices: [],
    process: '', req: '', remark: '',
    hasSubItems: false, subItems: [],
    makeSample: false, sampleSegments: 1, segFlag: true, specimenQty: 1, specimenCode: '',
    coreMode: ''
  };

  var TID = { state: null, testIdx: -1, tab: 'info' };
  global.TID = TID;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ── 从宿主页面取上下文 ─────────────────────────────────────────── */
  function context() {
    var out = { catName: '-', path: '-', sampleName: '-', modelName: '-', tests: [], sample: null, model: null };
    try {
      var sample = global.currentSample();
      var pageState = global.state;
      out.sample = sample;
      out.tests = sample.tests || [];
      var meta = global.CAT_META && pageState ? global.CAT_META[pageState.cat] : null;
      out.catName = meta ? meta.name : '-';
      if (pageState && global.TREES && global.findNode) {
        var node = global.findNode(global.TREES[pageState.cat], pageState.selectedId);
        var labels = [];
        (function walk(nodes, trail) {
          for (var i = 0; i < (nodes || []).length; i++) {
            var n = nodes[i], t = trail.concat([n.label]);
            if (n.id === pageState.selectedId) { labels = t; return true; }
            if (walk(n.children, t)) return true;
          }
          return false;
        })(global.TREES[pageState.cat], []);
        if (labels.length > 1) labels.pop();   // 叶子就是样品本身，路径只到父级
        out.path = labels.length ? labels.join('/') : (node ? node.label : '-');
      }
      out.sampleName = sample.name || '-';
      var diffYes = sample.diffModel === '是' && sample.models && sample.models.length;
      if (diffYes) {
        var model = global.currentModel(sample);
        out.model = model;
        out.tests = (model && model.tests) || [];
        out.modelName = model ? (model.code + (model.name ? '（' + model.name + '）' : '')) : '-';
      } else {
        out.modelName = '—（该样品不区分型号）';
      }
    } catch (e) { /* 宿主未就绪时保持占位 */ }
    return out;
  }

  function currentTests() {
    var ctx = TID.ctx;
    return ctx.model ? (ctx.model.tests = ctx.model.tests || []) : (ctx.sample.tests = ctx.sample.tests || []);
  }

  function loadState(idx) {
    var tests = idx >= 0 ? currentTests() : [];
    var t = tests[idx];
    var base = clone(DEFAULTS);
    if (t && PRESET[t.name]) base = clone(PRESET[t.name]);
    base.name = t ? t.name : '';
    if (t) {
      if (!base.code) base.code = '';
      if (t.quality) base.quality = t.quality;
      if (t.category && !base.categories.length) {
        base.categories = String(t.category).split(/[、,]/).filter(function (x) { return x; });
      }
      var hit = !!PRESET[t.name];
      if (!hit || !base.basis.length) base.basis = [{ std: t.basis || '', clause: '' }];
      if (!hit && t.req) base.req = t.req;
      if (t.price != null) base.fee = String(t.price);
      base.enabled = t.on !== false;
    } else {
      base.enabled = true;
    }
    if (!base.coreMode) {
      var s = TID.ctx.sample || {};
      base.coreMode = (s.isCable && s.cableStruct === '多芯') ? '每芯（只检测主线）' : '';
    }
    return base;
  }

  /* ── 渲染 ───────────────────────────────────────────────────────── */
  function ensureShell() {
    if ($('tidMask')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="tid-mask" id="tidMask" data-annotate="test-item-drawer">' +
      '  <div class="tid-drawer" role="dialog" aria-modal="true" aria-labelledby="tidTitle">' +
      '    <div class="tid-head"><h3 id="tidTitle">编辑试验</h3>' +
      '      <button type="button" class="tid-close" onclick="TID.close()" aria-label="关闭">✕</button></div>' +
      '    <div class="tid-context" id="tidCtx"></div>' +
      '    <div class="tid-tabs" id="tidTabs"></div>' +
      '    <div class="tid-body" id="tidBody"></div>' +
      '    <div class="tid-foot">' +
      '      <button type="button" class="btn-outline" onclick="TID.close()">取 消</button>' +
      '      <button type="button" class="btn-save" onclick="TID.submit()">提 交</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';
    document.body.appendChild(wrap);
    $('tidMask').addEventListener('mousedown', function (e) { if (e.target === $('tidMask')) TID.close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('tidMask').classList.contains('open')) TID.close(); });
  }

  var TABS = [['info', '试验信息'], ['param', '试验参数'], ['nominal', '标称值'], ['judge', '结果判定'], ['collect', '采集配置']];

  function renderTabs() {
    $('tidTabs').innerHTML = TABS.map(function (t) {
      return '<div class="tid-tab' + (TID.tab === t[0] ? ' active' : '') + '" onclick="TID.switchTab(\'' + t[0] + '\')">' + t[1] + '</div>';
    }).join('');
  }

  function renderCtx() {
    var c = TID.ctx;
    $('tidCtx').innerHTML =
      '<div class="ttl"><i class="fa fa-info-circle"></i>基本信息</div>' +
      '<div><span class="kv">样品分类：<b>' + esc(c.path) + '</b></span>' +
      '<span class="kv">样品名称：<b>' + esc(c.sampleName) + '</b></span>' +
      '<span class="kv">型号：<b>' + esc(c.modelName) + '</b></span></div>' +
      '<div><span class="kv">试验项：<b>' + esc(TID.state.name || '新增试验') + '</b></span></div>';
  }

  function lab(text, req) {
    return '<div class="lab">' + (req ? '<span class="req">*</span>' : '') + text + '：</div>';
  }
  function item(label, req, ctlHtml, full) {
    return '<div class="tid-item' + (full ? ' tid-full' : '') + '">' + lab(label, req) + '<div class="ctl">' + ctlHtml + '</div></div>';
  }
  function clearable(id, val, ph, onchange) {
    return '<div class="tid-clearable"><input type="text" id="' + id + '" value="' + esc(val) + '" placeholder="' + (ph || '请输入') + '"' +
      (onchange ? ' oninput="' + onchange + '"' : '') + ' />' +
      '<button type="button" class="clr" title="清除" onclick="TID.clearInput(\'' + id + '\')">✕</button></div>';
  }
  function radios(name, opts, cur, handler, disabledOne) {
    return '<div class="tid-radios">' + opts.map(function (o) {
      var dis = disabledOne && disabledOne.indexOf(o) >= 0;
      return '<label' + (dis ? ' class="disabled"' : '') + '><input type="radio" name="' + name + '" value="' + esc(o) + '"' +
        (String(o) === String(cur) ? ' checked' : '') + (dis ? ' disabled' : '') +
        ' onchange="' + handler + '(\'' + esc(o) + '\')" />' + esc(o) + '</label>';
    }).join('') + '</div>';
  }

  /* 多选：检测类别 / 检测设备 */
  function msel(id, selected, options, placeholder) {
    var tags = (selected || []).map(function (v) {
      return '<span class="tid-tag"><span title="' + esc(v) + '">' + esc(v) + '</span><i class="fa fa-times" onclick="event.stopPropagation();TID.msRemove(\'' + id + '\',\'' + esc(v) + '\')"></i></span>';
    }).join('');
    return '<div class="tid-msel" id="' + id + '" onclick="TID.msToggle(\'' + id + '\')">' +
      (tags || '<span class="ph">' + (placeholder || '请选择') + '</span>') +
      '<i class="fa fa-angle-down caret"></i>' +
      '<div class="tid-pop" id="' + id + '_pop" onclick="event.stopPropagation()">' +
      options.map(function (o) {
        var sel = (selected || []).indexOf(o) >= 0;
        return '<div class="tid-opt' + (sel ? ' sel' : '') + '" onclick="TID.msPick(\'' + id + '\',\'' + esc(o) + '\')">' +
          '<span>' + esc(o) + '</span><i class="fa fa-check ck"></i></div>';
      }).join('') + '</div></div>';
  }
  function refreshMsel(id) {
    var box = $(id);
    if (!box) return;
    var key = id === 'tidCategories' ? 'categories' : 'devices';
    var opts = id === 'tidCategories' ? DICT.category : DICT.devices;
    var ph = id === 'tidCategories' ? '请选择' : '请选择检测设备';
    var popOpen = box.classList.contains('open');
    box.outerHTML = msel(id, TID.state[key], opts, ph);
    if (popOpen) { $(id).classList.add('open'); $(id + '_pop').classList.add('open'); }
  }

  function basisTable() {
    var rows = TID.state.basis.map(function (b, i) {
      return '<tr><td><select onchange="TID.editBasis(' + i + ',\'std\',this.value)">' +
        '<option value="">请选择标准文件</option>' +
        DICT.standards.map(function (s) { return '<option value="' + esc(s) + '"' + (s === b.std ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
        (b.std && DICT.standards.indexOf(b.std) < 0 ? '<option value="' + esc(b.std) + '" selected>' + esc(b.std) + '</option>' : '') +
        '</select></td>' +
        '<td style="width:22%"><input type="text" value="' + esc(b.clause) + '" placeholder="请输入" oninput="TID.editBasis(' + i + ',\'clause\',this.value)" /></td>' +
        '<td style="width:64px"><span class="op-del" title="移除" onclick="TID.delBasis(' + i + ')">−</span></td></tr>';
    }).join('');
    return '<div class="tid-sub" data-annotate="test-basis"><table><thead><tr>' +
      '<th>标准文件</th><th>章节</th>' +
      '<th style="width:64px">操作<span class="op-add" title="添加" onclick="TID.addBasis()">＋</span></th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="3" class="tid-locked">暂无试验依据，点右上 ＋ 添加</td></tr>') +
      '</tbody></table></div>';
  }

  function subItemTable() {
    var rows = TID.state.subItems.map(function (s, i) {
      return '<tr><td style="width:20%"><input type="text" value="' + esc(s.name) + '" placeholder="请输入" oninput="TID.editSub(' + i + ',\'name\',this.value)" /></td>' +
        '<td style="width:20%"><input type="text" value="' + esc(s.code) + '" placeholder="请输入" oninput="TID.editSub(' + i + ',\'code\',this.value)" /></td>' +
        '<td class="cell-long" title="' + esc(s.req) + '"><input type="text" value="' + esc(s.req) + '" placeholder="请输入" oninput="TID.editSub(' + i + ',\'req\',this.value)" /></td>' +
        '<td style="width:64px"><span class="op-del" title="移除" onclick="TID.delSub(' + i + ')">−</span></td></tr>';
    }).join('');
    return '<div class="tid-sub" data-annotate="test-subitems"><table><thead><tr>' +
      '<th><span class="req">*</span>试验子项</th><th><span class="req">*</span>试验编码</th><th>标准要求</th>' +
      '<th style="width:64px">操作<span class="op-add" title="添加" onclick="TID.addSub()">＋</span></th>' +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="4" class="tid-locked">暂无试验子项</td></tr>') + '</tbody></table></div>';
  }

  function stepper(id, val, min, handler) {
    return '<span class="tid-step"><button type="button" onclick="TID.step(\'' + id + '\',-1,' + min + ')">−</button>' +
      '<input type="text" id="' + id + '" value="' + val + '" oninput="' + handler + '(this.value)" />' +
      '<button type="button" onclick="TID.step(\'' + id + '\',1,' + min + ')">＋</button></span>';
  }

  function coreModeRow() {
    var s = TID.ctx.sample || {};
    // 联动：仅当样品「是否电缆=是」且「电缆结构=多芯」时出现（截图 图9/图10 → 图12 单芯时隐藏）
    if (!(s.isCable && s.cableStruct === '多芯')) return '';
    return item('多芯电缆试验线芯数', true, radios('tidCore', DICT.coreMode, TID.state.coreMode, 'TID.setCore'), true);
  }

  function makeSampleRows() {
    var st = TID.state;
    if (!st.makeSample) {
      return item('试样类别代码', false, '<input type="text" value="' + esc(st.specimenCode) + '" placeholder="请输入" oninput="TID.set(\'specimenCode\',this.value)" />');
    }
    return '<div class="tid-item"><div class="lab">样段：</div><div class="ctl"><div class="tid-inline">' +
      stepper('tidSeg', st.sampleSegments, 1, 'TID.setSeg') +
      '<input type="checkbox" class="flag" title="启用样段" ' + (st.segFlag ? 'checked' : '') + ' onchange="TID.set(\'segFlag\',this.checked)" />' +
      '</div></div></div>' +
      item('试样数量', true, stepper('tidQty', st.specimenQty, 1, 'TID.setQty')) +
      item('试样类别代码', false, '<input type="text" value="' + esc(st.specimenCode) + '" placeholder="请输入" oninput="TID.set(\'specimenCode\',this.value)" />');
  }

  function renderInfo() {
    var st = TID.state;
    var html = '<div class="tid-grid">' +
      item('试验名称', true, clearable('tidName', st.name, '请输入', 'TID.set(\'name\',this.value)')) +
      item('试验编码', true, clearable('tidCode', st.code, '请输入', 'TID.set(\'code\',this.value)')) +
      item('检测费用(元)', false, clearable('tidFee', st.fee, '0', 'TID.set(\'fee\',this.value)')) +
      item('质量特性', false, '<select onchange="TID.set(\'quality\',this.value)"><option value="">请选择</option>' +
        DICT.quality.map(function (q) { return '<option' + (q === st.quality ? ' selected' : '') + '>' + q + '</option>'; }).join('') + '</select>') +
      item('检测类别', true, msel('tidCategories', st.categories, DICT.category, '请选择')) +
      item('状态', true, radios('tidEnabled', ['启用', '禁用'], st.enabled ? '启用' : '禁用', 'TID.setEnabled')) +
      '<div class="tid-item tid-full"><div class="lab">试验依据：</div><div class="ctl">' + basisTable() + '</div></div>' +
      item('检测设备', false,
        '<div class="tid-inline"><div class="tid-radios" style="margin-right:10px;flex:0 0 auto">' +
        ['目测', '设备'].map(function (m) {
          return '<label><input type="radio" name="tidDev" value="' + m + '"' + (st.deviceMode === m ? ' checked' : '') + ' onchange="TID.set(\'deviceMode\',this.value)" />' + m + '</label>';
        }).join('') + '</div>' +
        (st.deviceMode === '设备' ? '<div style="flex:1 1 320px;min-width:0">' + msel('tidDevices', st.devices, DICT.devices, '请选择检测设备') + '</div>' : '') +
        '</div>', true) +
      item('试验过程', false, '<textarea placeholder="请输入" oninput="TID.set(\'process\',this.value)">' + esc(st.process) + '</textarea>', true) +
      item('标准要求', false, '<textarea placeholder="请输入" oninput="TID.set(\'req\',this.value)">' + esc(st.req) + '</textarea>', true) +
      item('备注', false, '<textarea placeholder="请输入" oninput="TID.set(\'remark\',this.value)">' + esc(st.remark) + '</textarea>', true) +
      item('添加试验子项', true, radios('tidSub', ['是', '否'], st.hasSubItems ? '是' : '否', 'TID.setHasSub')) +
      (st.hasSubItems ? '<div class="tid-item tid-full"><div class="lab"></div><div class="ctl">' + subItemTable() + '</div></div>' : '') +
      item('是否制样', true, radios('tidMake', ['是', '否'], st.makeSample ? '是' : '否', 'TID.setMake')) +
      coreModeRow() +
      makeSampleRows() +
      '</div>' +
      '<div class="tid-hint"><b>联动说明（原型内已生效）：</b>检测设备选「目测」时收起设备多选；' +
      '添加试验子项=是 时展开子项表格，参数须挂到具体子项下；是否制样=否 时隐藏样段与试样数量；' +
      '「多芯电缆试验线芯数」只在样品的「是否电缆=是 且 电缆结构=多芯」时出现。</div>';
    $('tidBody').innerHTML = html;
  }

  function renderTabBody() {
    if (TID.tab === 'info') { renderInfo(); return; }
    var names = { param: '试验参数', nominal: '标称值', judge: '结果判定', collect: '采集配置' };
    var why = {
      param: '控制参数（含 5 类动态映射引擎）、测量参数、计算参数（含绑定层级）——字段即 Excel 列，待抽屉定稿后补。',
      nominal: '单行 / 多行映射、6 种标称值形态、自变量固定值与区间——是「标称值多行映射」入库的关键。',
      judge: '系统判定 / 人工判定、模式 A 判定对比与模式 B 试验参数对比、IF-THEN-ELSE 逻辑树与结论映射。',
      collect: '参数编码、计算顺序、是否覆盖 LIMS 参数——下游数采的执行协议，也是唯一性校验的落点。'
    };
    $('tidBody').innerHTML = '<div class="tid-soon"><i class="fa fa-flask"></i><b>' + names[TID.tab] + ' Tab 待补齐</b>' + why[TID.tab] + '</div>';
  }

  function render() { renderCtx(); renderTabs(); renderTabBody(); }

  /* ── 对外动作 ───────────────────────────────────────────────────── */
  TID.open = function (idx) {
    ensureShell();
    TID.ctx = context();
    TID.testIdx = typeof idx === 'number' ? idx : -1;
    TID.tab = 'info';
    TID.state = loadState(TID.testIdx);
    $('tidTitle').textContent = TID.testIdx >= 0 ? '编辑试验' : '新增试验';
    render();
    $('tidMask').classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  TID.close = function () {
    $('tidMask').classList.remove('open');
    document.body.style.overflow = '';
  };

  TID.switchTab = function (t) { TID.tab = t; renderTabs(); renderTabBody(); };

  TID.set = function (k, v) { TID.state[k] = v; if (k === 'name') renderCtx(); };
  TID.clearInput = function (id) {
    var el = $(id); if (!el) return;
    el.value = '';
    var fn = el.getAttribute('oninput');
    if (fn) new Function('event', fn.replace(/this\.value/g, "''")).call(el, { target: el });
    el.focus();
  };
  TID.setEnabled = function (v) { TID.state.enabled = v === '启用'; };
  TID.setCore = function (v) { TID.state.coreMode = v; };
  TID.setHasSub = function (v) {
    TID.state.hasSubItems = v === '是';
    if (TID.state.hasSubItems && !TID.state.subItems.length) TID.state.subItems = [{ name: '', code: '', req: '' }];
    renderTabBody();
  };
  TID.setMake = function (v) { TID.state.makeSample = v === '是'; renderTabBody(); };

  TID.msToggle = function (id) {
    var box = $(id), pop = $(id + '_pop');
    var open = pop.classList.contains('open');
    document.querySelectorAll('.tid-pop.open').forEach(function (p) { p.classList.remove('open'); });
    document.querySelectorAll('.tid-msel.open').forEach(function (p) { p.classList.remove('open'); });
    if (!open) { pop.classList.add('open'); box.classList.add('open'); }
  };
  TID.msPick = function (id, v) {
    var key = id === 'tidCategories' ? 'categories' : 'devices';
    var arr = TID.state[key] = TID.state[key] || [];
    var i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1); else arr.push(v);
    refreshMsel(id);
    $(id + '_pop').classList.add('open');
    $(id).classList.add('open');
  };
  TID.msRemove = function (id, v) {
    var key = id === 'tidCategories' ? 'categories' : 'devices';
    TID.state[key] = (TID.state[key] || []).filter(function (x) { return x !== v; });
    refreshMsel(id);
  };
  document.addEventListener('mousedown', function (e) {
    if (!e.target.closest || !e.target.closest('.tid-msel')) {
      document.querySelectorAll('.tid-pop.open').forEach(function (p) { p.classList.remove('open'); });
      document.querySelectorAll('.tid-msel.open').forEach(function (p) { p.classList.remove('open'); });
    }
  });

  TID.addBasis = function () { TID.state.basis.push({ std: '', clause: '' }); renderTabBody(); };
  TID.delBasis = function (i) { TID.state.basis.splice(i, 1); renderTabBody(); };
  TID.editBasis = function (i, k, v) { TID.state.basis[i][k] = v; if (k === 'std') renderTabBody(); };
  TID.addSub = function () { TID.state.subItems.push({ name: '', code: '', req: '' }); renderTabBody(); };
  TID.delSub = function (i) { TID.state.subItems.splice(i, 1); renderTabBody(); };
  TID.editSub = function (i, k, v) { TID.state.subItems[i][k] = v; };

  TID.step = function (id, d, min) {
    var el = $(id); if (!el) return;
    var v = Math.max(min, parseInt(el.value, 10) || min);
    v = Math.max(min, v + d);
    el.value = String(v);
    if (id === 'tidSeg') TID.state.sampleSegments = v; else TID.state.specimenQty = v;
  };
  TID.setSeg = function (v) { TID.state.sampleSegments = parseInt(v, 10) || 1; };
  TID.setQty = function (v) { TID.state.specimenQty = parseInt(v, 10) || 1; };

  TID.submit = function () {
    var st = TID.state;
    var miss = [];
    if (!st.name) miss.push('试验名称');
    if (!st.code) miss.push('试验编码');
    if (!st.categories || !st.categories.length) miss.push('检测类别');
    if (st.hasSubItems) {
      st.subItems.forEach(function (s, i) {
        if (!s.name) miss.push('第 ' + (i + 1) + ' 行试验子项名称');
        if (!s.code) miss.push('第 ' + (i + 1) + ' 行试验子项编码');
      });
    }
    if (miss.length) { (global.toast || alert)(('缺少必填项：' + miss.join('、'))); return; }
    var tests = currentTests();
    var row = {
      name: st.name, quality: st.quality,
      category: st.categories.join('、'),
      basis: (st.basis[0] && st.basis[0].std ? String(st.basis[0].std).split(' ')[0] : '') +
              (st.basis.length > 1 ? ' 等 ' + st.basis.length + ' 项' : ''),
      req: st.req, price: st.fee, on: st.enabled
    };
    if (TID.testIdx >= 0) tests[TID.testIdx] = row; else tests.push(row);
    TID.close();
    if (global.renderSharedPanels) global.renderSharedPanels(global.currentSample());
    if (global.renderTree) global.renderTree();
    (global.toast || alert)('试验项已保存（原型）：' + st.name + '，检测类别 ' + st.categories.join('、'));
  };
})(typeof window !== 'undefined' ? window : globalThis);
