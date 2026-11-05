/**
 * 设备台账 Mock Store（设备管理 + 样品试验「检测设备」共用）
 */
(function (global) {
  var STORAGE_KEY = 'lims-equip-store-v4';

  var DEPTS = ['材料检测组', '应敏科技1', '电气检测组', '力学检测组', '数蚕智能'];
  var AREAS = ['力学检测室1', '电气检测室', '老化试验室', '综合检测区', '无人化试验室'];

  function defaultSeed() {
    return [
      {
        /* 数字孪生 107 材料试验区·箭头点名设备，信息按真系统设备管理弹窗录入（2026-11-05） */
        id: 'eq_qj36',
        code: '2411020108',
        name: '智能型数字电桥',
        model: 'QJ-36',
        dept: '数蚕智能',
        area: '无人化试验室',
        certNo: '',
        accuracy: '全量程优于0.1uΩ或0.1%',
        info: '',
        remark: '',
        needCalib: true,
        lastCalib: '',
        cycleY: 1, cycleM: 0, cycleD: 0,
        nextCalib: '',
        agency: '',
        warnDays: 30,
        maxError: '',
        calibStatus: '正常',
        enabled: true,
        files: [],
        linkedTests: [],
        history: [],
        maintain: []
      },
      {
        id: 'eq_yfg150',
        code: 'YFG-150A',
        name: '绝缘安全工器具试验装置',
        model: 'YFG-150A',
        dept: '电气检测组',
        area: '电气检测室',
        certNo: 'CERT-YFG-001',
        accuracy: '±1%',
        info: '带电作业工器具耐压试验',
        remark: '',
        needCalib: true,
        lastCalib: '2025-06-01',
        cycleY: 1, cycleM: 0, cycleD: 0,
        nextCalib: '2026-06-01',
        agency: '省计量院',
        warnDays: 30,
        maxError: '1%',
        calibStatus: '正常',
        enabled: true,
        files: [
          { name: 'YFG验收报告.pdf', type: 'pdf' },
          { name: '设备说明书.docx', type: 'doc' }
        ],
        linkedTests: [
          { path: '安全工器具类 - DLT 976-2017 - 绝缘操作杆 - 交流耐压试验', sample: '绝缘操作杆', model: '-', test: '交流耐压试验' }
        ],
        history: [
          { id: 'h1', event: '设备校准', date: '2025-06-01', remark: '按周期送检', report: '校准报告_20250601.pdf' },
          { id: 'h2', event: '设备校准', date: '2024-06-05', remark: '', report: '校准报告_20240605.pdf' },
          { id: 'h1b', event: '设备校准', date: '2023-06-10', remark: '', report: '校准报告_20230610.pdf' },
          { id: 'h1c', event: '设备校准', date: '2022-06-12', remark: '', report: '校准报告_20220612.pdf' }
        ],
        maintain: [
          { id: 'm1', type: '维修', date: '2026-06-15', content: '更换升压变压器散热风扇，复测输出电压正常', by: '厂家工程师', result: '已修复', file: '维修单_20260615.pdf' },
          { id: 'm2', type: '期间核查', date: '2026-05-20', content: '水槽密封与接地电阻复测', by: '周强', result: '正常', file: '' },
          { id: 'm3', type: '日常保养', date: '2026-02-18', content: '电极清洗 / 绝缘检查', by: '周强', result: '正常', file: '' }
        ]
      },
      {
        id: 'eq_ybkc02',
        code: 'YBKC-02',
        name: '数显卡尺',
        model: '(0~300)mm/0.01mm',
        dept: '材料检测组',
        area: '力学检测室1',
        certNo: '',
        accuracy: '0.01mm',
        info: '',
        remark: '',
        needCalib: true,
        lastCalib: '2025-02-25',
        cycleY: 1, cycleM: 0, cycleD: 0,
        nextCalib: '2026-02-25',
        agency: '市计量所',
        warnDays: 10,
        maxError: '0.02mm',
        calibStatus: '正常',
        enabled: true,
        files: [
          { name: '卡尺检定证书.pdf', type: 'pdf' }
        ],
        linkedTests: [
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-C - 尺寸检查', sample: 'PVC-C', model: 'DS实壁类', test: '尺寸检查' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-C - 环刚度', sample: 'PVC-C', model: 'DS实壁类', test: '环刚度' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-C - 压扁试验', sample: 'PVC-C', model: 'DS实壁类', test: '压扁试验' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-C - 落锤冲击', sample: 'PVC-C', model: 'DS实壁类', test: '落锤冲击' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-C - 维卡软化温度', sample: 'PVC-C', model: 'DS实壁类', test: '维卡软化温度' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-U - 尺寸检查', sample: 'PVC-U', model: 'DS实壁类', test: '尺寸检查' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-U - 环刚度', sample: 'PVC-U', model: 'DS实壁类', test: '环刚度' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-M - 尺寸检查', sample: 'PVC-M', model: 'DS实壁类', test: '尺寸检查' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-M - 压扁试验', sample: 'PVC-M', model: 'DS实壁类', test: '压扁试验' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-H - 尺寸检查', sample: 'PVC-H', model: 'DS实壁类', test: '尺寸检查' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-H - 环刚度', sample: 'PVC-H', model: 'DS实壁类', test: '环刚度' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-H - 压扁试验', sample: 'PVC-H', model: 'DS实壁类', test: '压扁试验' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-H - 落锤冲击', sample: 'PVC-H', model: 'DS实壁类', test: '落锤冲击' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-H - 维卡软化温度', sample: 'PVC-H', model: 'DS实壁类', test: '维卡软化温度' }
        ],
        history: [
          { id: 'h3', event: '设备校准', date: '2025-02-25', remark: '', report: '校准报告_YBKC02_20250225.pdf' },
          { id: 'h4', event: '设备校准', date: '2024-08-29', remark: '', report: '校准报告_YBKC02_20240829.pdf' }
        ],
        maintain: [
          { id: 'm4', type: '日常保养', date: '2026-03-10', content: '量爪清洁、零位校对', by: '李强', result: '正常', file: '' }
        ]
      },
      {
        id: 'eq_ybkc03',
        code: 'YBKC-03',
        name: '数显卡尺',
        model: '(0~300)mm/0.01mm',
        dept: '材料检测组',
        area: '力学检测室1',
        certNo: 'CERT-03',
        accuracy: '0.01mm',
        info: '',
        remark: '',
        needCalib: true,
        lastCalib: '2025-01-10',
        cycleY: 1, cycleM: 0, cycleD: 0,
        nextCalib: '2026-01-10',
        agency: '市计量所',
        warnDays: 10,
        maxError: '0.02mm',
        calibStatus: '预警期',
        enabled: true,
        files: [],
        linkedTests: [
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-U - 尺寸检查', sample: 'PVC-U', model: 'DS实壁类', test: '尺寸检查' },
          { path: 'WZ电网物资 - 02电力电缆导管 - DS实壁类塑料电缆导管 - PVC-M - 尺寸检查', sample: 'PVC-M', model: 'DS实壁类', test: '尺寸检查' }
        ],
        history: [
          { id: 'h5', event: '设备校准', date: '2025-01-10', remark: '', report: '校准报告_YBKC03.pdf' }
        ]
      },
      {
        id: 'eq_dl09',
        code: 'DL-09',
        name: '空气老化试验箱',
        model: '300DU',
        dept: '应敏科技1',
        area: '力学检测室1',
        certNo: '001',
        accuracy: '003',
        info: '',
        remark: '004',
        needCalib: true,
        lastCalib: '2026-01-07',
        cycleY: 1, cycleM: 0, cycleD: 0,
        nextCalib: '2027-01-07',
        agency: '省计量院',
        warnDays: 15,
        maxError: '±2℃',
        calibStatus: '正常',
        enabled: true,
        files: [
          { name: 'ceshi.png', type: 'img' },
          { name: '3c1f385852cda31fe01c7466a8ed097c.jpg', type: 'img' },
          { name: '用户导入模版_1755850907556.xlsx', type: 'xls' },
          { name: '验收会议优化点需求整理.docx', type: 'doc' }
        ],
        linkedTests: [],
        history: [
          { id: 'h6', event: '设备校准', date: '2026-01-07', remark: '', report: '空气老化箱校准报告.pdf' }
        ]
      },
      {
        id: 'eq_lx05',
        code: 'LX-05',
        name: '微机控制电子万能试验机',
        model: 'LD26504',
        dept: '力学检测组',
        area: '力学检测室1',
        certNo: 'CERT-LX05',
        accuracy: '0.5级',
        info: '',
        remark: '',
        needCalib: true,
        lastCalib: '2024-12-01',
        cycleY: 1, cycleM: 0, cycleD: 0,
        nextCalib: '2025-12-01',
        agency: '省计量院',
        warnDays: 20,
        maxError: '1%',
        calibStatus: '已过期',
        enabled: true,
        files: [{ name: '万能机说明书.pdf', type: 'pdf' }],
        linkedTests: [
          { path: '安全工器具类 - DLT 976-2017 - 绝缘操作杆 - 挠度载荷', sample: '绝缘操作杆', model: '-', test: '挠度载荷' }
        ],
        history: [
          { id: 'h7', event: '设备校准', date: '2024-12-01', remark: '', report: '校准报告_LX05.pdf' }
        ]
      },
      {
        id: 'eq_off01',
        code: 'OFF-01',
        name: '停用示例设备',
        model: 'DEMO',
        dept: '材料检测组',
        area: '综合检测区',
        certNo: '',
        accuracy: '',
        info: '',
        remark: '已停用，不出现在检测设备下拉',
        needCalib: false,
        lastCalib: '',
        cycleY: 0, cycleM: 0, cycleD: 0,
        nextCalib: '',
        agency: '',
        warnDays: 0,
        maxError: '',
        calibStatus: '正常',
        enabled: false,
        files: [],
        linkedTests: [],
        history: []
      }
    ];
  }

  /** 关联试验左侧树：样品 → 型号 → 试验项 */
  var TEST_TREE = [
    {
      id: 'wz', label: 'WZ电网物资', children: [
        {
          id: 'cable', label: '02电力电缆导管', children: [
            {
              id: 'ds', label: 'DS实壁类塑料电缆导管', children: [
                {
                  id: 'pvc-c', label: 'PVC-C', children: [
                    { id: 't_c_size', label: '尺寸检查', leaf: true },
                    { id: 't_c_ring', label: '环刚度', leaf: true },
                    { id: 't_c_flat', label: '压扁试验', leaf: true },
                    { id: 't_c_drop', label: '落锤冲击', leaf: true },
                    { id: 't_c_vicat', label: '维卡软化温度', leaf: true }
                  ]
                },
                {
                  id: 'pvc-u', label: 'PVC-U', children: [
                    { id: 't_u_size', label: '尺寸检查', leaf: true },
                    { id: 't_u_ring', label: '环刚度', leaf: true },
                    { id: 't_u_flat', label: '压扁试验', leaf: true }
                  ]
                },
                {
                  id: 'pvc-m', label: 'PVC-M', children: [
                    { id: 't_m_size', label: '尺寸检查', leaf: true },
                    { id: 't_m_flat', label: '压扁试验', leaf: true }
                  ]
                },
                {
                  id: 'pvc-h', label: 'PVC-H', children: [
                    { id: 't_h_size', label: '尺寸检查', leaf: true },
                    { id: 't_h_ring', label: '环刚度', leaf: true },
                    { id: 't_h_flat', label: '压扁试验', leaf: true },
                    { id: 't_h_drop', label: '落锤冲击', leaf: true },
                    { id: 't_h_vicat', label: '维卡软化温度', leaf: true }
                  ]
                }
              ]
            },
            { id: 'dw', label: 'DW波纹类塑料电缆导管', children: [
              { id: 't_dw_size', label: '接头密封性能', leaf: true }
            ]}
          ]
        }
      ]
    },
    {
      id: 'aq', label: '安全工器具类', children: [
        {
          id: 'dlt976', label: 'DLT 976-2017', children: [
            {
              id: 'rod', label: '绝缘操作杆', children: [
                { id: 't_rod_ac', label: '交流耐压试验', leaf: true },
                { id: 't_rod_look', label: '外观及尺寸', leaf: true },
                { id: 't_rod_bend', label: '挠度载荷', leaf: true }
              ]
            }
          ]
        }
      ]
    }
  ];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function normalizeHistory(list) {
    var changed = false;
    (list || []).forEach(function (dev) {
      (dev.history || []).forEach(function (h) {
        if (!h.date && (h.end || h.start)) {
          h.date = h.end || h.start || '';
          changed = true;
        }
        if (h.start != null || h.end != null) {
          delete h.start;
          delete h.end;
          changed = true;
        }
      });
    });
    return changed;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          if (normalizeHistory(parsed)) save(parsed);
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }
    var seed = defaultSeed();
    save(seed);
    return seed;
  }

  function save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
  }

  function listAll() { return load(); }

  function listEnabled() {
    return load().filter(function (d) { return !!d.enabled; });
  }

  function findById(id) {
    return load().find(function (d) { return d.id === id; }) || null;
  }

  function upsert(row) {
    var list = load();
    var idx = list.findIndex(function (d) { return d.id === row.id; });
    if (idx >= 0) list[idx] = row;
    else list.push(row);
    save(list);
    return row;
  }

  function remove(id) {
    var list = load().filter(function (d) { return d.id !== id; });
    save(list);
  }

  function displayLabel(d) {
    if (!d) return '';
    return '[' + d.code + '] ' + d.name;
  }

  function pathFromTrail(trail) {
    return trail.join(' - ');
  }

  function collectLeaves(nodes, trail, out) {
    (nodes || []).forEach(function (n) {
      var next = trail.concat(n.label);
      if (n.leaf) {
        out.push({ id: n.id, label: n.label, path: pathFromTrail(next), trail: next.slice() });
      } else if (n.children) {
        collectLeaves(n.children, next, out);
      }
    });
  }

  function allTestLeaves() {
    var out = [];
    collectLeaves(TEST_TREE, [], out);
    return out;
  }

  global.EquipStore = {
    DEPTS: DEPTS,
    AREAS: AREAS,
    TEST_TREE: TEST_TREE,
    load: load,
    save: save,
    listAll: listAll,
    listEnabled: listEnabled,
    findById: findById,
    upsert: upsert,
    remove: remove,
    displayLabel: displayLabel,
    allTestLeaves: allTestLeaves,
    clone: clone,
    reset: function () { var s = defaultSeed(); save(s); return s; }
  };
})(window);
