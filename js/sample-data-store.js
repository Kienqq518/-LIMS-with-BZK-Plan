/* 样品数据模块共享数据源
 *  - 样品分类树（对应「样品数据」左侧树：大类 › 类别 › 额定电压 › 标准 › 材质 › 样品）
 *  - 样品 Mock（型号/分类、规格参数、试验项、判定方案）
 * 由 sample-data-detail.html 抽出为单一数据源；委托登记「添加样品」弹窗同源复用，
 * 保证「样品数据里维护的型号与试验项」= 「委托登记添加样品时带出的内容」。
 */
(function (global) {
    var TREE_DLWZ = [
      { id: 'dldl', label: 'DLDL电力电缆类', open: true, children: [
        { id: 'v1', label: '额定电压 1kV 和 3kV', open: true, children: [
          { id: 'gbt1', label: 'GBT 12706.1-2020', open: true, children: [
            { id: 'cu1', label: '铜芯', children: [] },
            { id: 'al1', label: '铝芯', children: [] }
          ]}
        ]},
        { id: 'v6', label: '额定电压 6kV-30kV', open: true, children: [
          { id: 'gbt2', label: 'GBT 12706.2-2020', open: true, children: [
            { id: 'cu6', label: '铜芯', open: true, children: [
              { id: 'cu6-3c', label: '10kV3芯电力电缆', leaf: true },
              { id: 'cu6-1c', label: '10kV单芯电力电缆', leaf: true },
              { id: 'cu6-20s', label: '20kV单芯电力电缆', leaf: true },
              { id: 'cu6-30', label: '30kV电力电缆', leaf: true },
              { id: 'cu6-40', label: '40kV电力电缆', leaf: true }
            ]},
            { id: 'al6', label: '铝芯', children: [] }
          ]}
        ]},
        { id: 'v35', label: '额定电压 35kV', open: true, children: [
          { id: 'gbt3', label: 'GB_T 12706.3-2020', open: true, children: [
            { id: 'cu35', label: '铜芯', children: [] },
            { id: 'al35', label: '铝芯', children: [] }
          ]}
        ]}
      ]},
      { id: 'bhg', label: 'BHG电缆保护管', open: true, children: [
        { id: 'dlt801', label: 'DLT 802.1-2023', open: true, children: [
          { id: 'ds', label: 'DS实壁类塑料电缆导管', open: true, children: [
            { id: 'dlt803', label: 'DLT 802.3-2023', open: true, children: [
              { id: 'ds-s', label: 'DS实壁类塑料电缆导管_直管', leaf: true },
              { id: 'ds-k', label: 'DS实壁类塑料电缆导管_带承口', leaf: true }
            ]}
          ]}
        ]}
      ]}
    ];

    var TREE_AQGQJ = [
      { id: 'dlt976', label: 'DLT 976-2017', open: true, children: [
        { id: 'rod', label: '绝缘操作杆', leaf: true },
        { id: 'ladder', label: '绝缘软梯', leaf: true },
        { id: 'hardladder', label: '绝缘硬梯', leaf: true },
        { id: 'pole', label: '绝缘杆', leaf: true },
        { id: 'blanket', label: '绝缘毯', leaf: true },
        { id: 'shield', label: '遮蔽罩', leaf: true },
        { id: 'suit', label: '10kV带电作业用绝缘服', leaf: true },
        { id: 'detector', label: '验电器', leaf: true },
        { id: 'hook', label: '吊钩（环）t', leaf: true },
        { id: 'bucket', label: '绝缘斗臂车-t', leaf: true },
        { id: 'bypass', label: '10kV旁路作业设备', leaf: true },
        { id: 'belt976', label: '安全带', leaf: true }
      ]},
      { id: 'dlt1476', label: 'DLT 1476-2023', open: true, children: [
        { id: 'rope1476', label: '安全绳', leaf: true },
        { id: 'helmet', label: '安全帽', leaf: true }
      ]}
    ];

    var TREE_GCJC = [
      { id: 'cement', label: '通用硅酸盐水泥', open: true, children: [
        { id: 'gb175', label: 'GB 175-2023', open: true, children: [
          { id: 'p', label: '硅酸盐水泥', leaf: true },
          { id: 'po', label: '普通硅酸盐水泥', leaf: true }
        ]}
      ]}
    ];
    var TREE_HJJC = [];
    var TREES = { dlwz: TREE_DLWZ, aqgqj: TREE_AQGQJ, hjjc: TREE_HJJC, gcjc: TREE_GCJC };

    var SAMPLE_MOCK = {
      'cu6-3c': {
        name: '10kV3芯电力电缆',
        code: '',
        sort: 1,
        category: '电力电缆类 / 额定电压 6kV-30kV',
        standard: 'GBT 12706.2-2020',
        fee: '',
        cycle: 5,
        diffModel: '是',
        unit: '根',
        remark: 'YJV、YJY、YJV22、YJV23',
        isCable: true,
        cableStruct: '多芯',
        cores: '3芯',
        coreColor: '绝缘分色',
        phases: ['红', '黄', '绿'],
        sampleSpecs: [
          { name: '导体标称截面积', symbol: 'S', unit: 'mm²' },
          { name: '额定电压', symbol: 'Uo/U(Um)', unit: 'kV' }
        ],
        markRule: '[型号信息.型号][ - ][规格参数.额定电压.值][空格][样品信息.是否电缆.芯数][X][规格参数.导体标称截面积.值][空格][样品信息.标准号]',
        models: [
          {
            code: 'YJV',
            name: '交联聚乙烯绝缘聚氯乙烯护套电力电缆',
            sort: 1,
            cycle: 5,
            desc: '铜带屏蔽，无铠装层。',
            specs: [
              {
                title: '规格参数1:导体标称截面积S (mm²)',
                type: '用户选择',
                options: ['25','35','50','70','95','120','150','185','240','300','400','500','630','800','1000']
              },
              {
                title: '规格参数2:额定电压Uo/U(Um) (kV)',
                type: '用户选择',
                options: ['8.7/10']
              }
            ],
            tests: [
              { name: '导体直流电阻', quality: '', category: '抽样试验', basis: 'GBT 3956-2008', req: '20℃时，导体直流电阻应符合标准要求', on: true },
              { name: '结构尺寸检查', quality: '', category: '型式试验', basis: 'GBT 12706.2-2020', req: '绝缘厚度、外护套厚度等符合标准', on: true },
              { name: '老化前绝缘的机械性能', quality: '', category: '型式试验', basis: 'GBT 2951.11-2008', req: '老化前：抗张强度中间值≥12.5 N/mm²', on: true },
              { name: '非金属护套老化前机械性能', quality: '', category: '型式试验', basis: 'GBT 2951.11-2008', req: '抗张强度中间值≥12.5 N/mm²；断裂伸长率中间值≥150%', on: true },
              { name: 'XLPE绝缘的热延伸试验', quality: '', category: '型式试验', basis: 'GBT 2951.21-2008', req: '负荷下伸长率 ≤ 175%；冷却后永久伸长率 ≤ 15%', on: true },
              { name: '结构尺寸检查（铜带屏蔽）', quality: '', category: '抽样试验', basis: 'GBT 12706.2-2020', req: '铜带屏蔽：搭盖率平均值≥15%', on: true },
              { name: '局部放电试验', quality: '', category: '型式试验', basis: 'GBT 3048.12-2007', req: '在规定电压下局部放电量不超过标准限值', on: true },
              { name: '4h电压试验', quality: '', category: '型式试验', basis: 'GBT 12706.2-2020', req: '施加规定电压 4h 不击穿', on: true }
            ],
            judges: [
              { category: '例行试验', scheme: '规则判定方案-简单合格/不合格判定' },
              { category: '出厂检验', scheme: '规则判定方案-简单合格/不合格判定' },
              { category: '抽样试验', scheme: '规则判定方案-简单合格/不合格判定' },
              { category: '型式试验', scheme: '规则判定方案-简单合格/不合格判定' }
            ]
          },
          {
            code: 'YJV22',
            name: '交联聚乙烯绝缘钢带铠装聚氯乙烯护套电力电缆',
            sort: 2,
            cycle: 5,
            desc: '铜带屏蔽，钢带铠装。',
            specs: [
              {
                title: '规格参数1:导体标称截面积S (mm²)',
                type: '用户选择',
                options: ['25','35','50','70','95','120','150','185','240','300','400']
              },
              {
                title: '规格参数2:额定电压Uo/U(Um) (kV)',
                type: '用户选择',
                options: ['8.7/10']
              }
            ],
            tests: [
              { name: '导体直流电阻', quality: '', category: '抽样试验', basis: 'GBT 3956-2008', req: '20℃时，导体直流电阻应符合标准要求', on: true },
              { name: '结构尺寸检查', quality: '', category: '型式试验', basis: 'GBT 12706.2-2020', req: '铠装层、护套厚度符合标准', on: true }
            ],
            judges: [
              { category: '例行试验', scheme: '规则判定方案-简单合格/不合格判定' },
              { category: '抽样试验', scheme: '规则判定方案-简单合格/不合格判定' },
              { category: '型式试验', scheme: '规则判定方案-简单合格/不合格判定' }
            ]
          }
        ]
      },
      'cu6-1c': {
        name: '10kV单芯电力电缆', code: '', sort: 2, category: '电力电缆类 / 额定电压 6kV-30kV',
        standard: 'GBT 12706.2-2020', fee: '', cycle: 5, diffModel: '是', unit: '米', remark: '',
        isCable: true, cableStruct: '单芯', cores: '1芯', coreColor: '绝缘分色', phases: [],
        sampleSpecs: [
          { name: '导体标称截面积', symbol: 'S', unit: 'mm²' },
          { name: '额定电压', symbol: 'Uo/U(Um)', unit: 'kV' }
        ],
        markRule: '[型号信息.型号][ - ][规格参数.额定电压.值][空格][样品信息.是否电缆.芯数][X][规格参数.导体标称截面积.值][空格][样品信息.标准号]',
        models: [
          {
            code: 'YJY', name: '交联聚乙烯绝缘聚乙烯护套电力电缆', sort: 1, cycle: 5,
            desc: '单芯无铠装，适用于固定敷设的 10kV 线路。',
            specs: [
              { title: '规格参数1:导体标称截面积S (mm²)', options: ['25', '35', '50', '70', '95', '120', '150', '185', '240', '300', '400'] },
              { title: '规格参数2:额定电压Uo/U(Um) (kV)', options: ['8.7/10'] }
            ],
            tests: [
              { name: '交流耐压试验', quality: '', category: '例行试验', basis: 'GBT 12706.2-2020', req: '2.5U0 电压耐压 30min，无击穿、无闪络', qty: 1, price: 120, on: true },
              { name: '局部放电试验', quality: '', category: '例行试验', basis: 'GBT 12706.2-2020', req: '1.73U0 下放电量不大于 10pC', qty: 1, price: 150, on: true },
              { name: '导体直流电阻测量', quality: '', category: '例行试验', basis: 'GBT 12706.2-2020', req: '20℃ 直流电阻不超过标准规定值', qty: 1, price: 60, on: true },
              { name: '绝缘电阻测量', quality: '', category: '例行试验', basis: 'GBT 12706.2-2020', req: '换算至 20℃ 不小于 1000MΩ·km', qty: 1, price: 60, on: true },
              { name: '结构尺寸检查', quality: '', category: '型式试验', basis: 'GBT 12706.2-2020', req: '绝缘厚度、护套厚度等符合标准', qty: 1, price: 80, on: true }
            ],
            judges: [{ category: '例行试验', scheme: '规则判定方案-简单合格/不合格判定' }]
          },
          {
            code: 'YJV22', name: '交联聚乙烯绝缘钢带铠装聚氯乙烯护套电力电缆', sort: 2, cycle: 5,
            desc: '单芯钢带铠装，可承受一定的机械外力。',
            specs: [
              { title: '规格参数1:导体标称截面积S (mm²)', options: ['25', '35', '50', '70', '95', '120', '150', '185', '240', '300', '400'] },
              { title: '规格参数2:额定电压Uo/U(Um) (kV)', options: ['8.7/10'] }
            ],
            tests: [
              { name: '交流耐压试验', quality: '', category: '例行试验', basis: 'GBT 12706.2-2020', req: '2.5U0 电压耐压 30min，无击穿、无闪络', qty: 1, price: 120, on: true },
              { name: '局部放电试验', quality: '', category: '例行试验', basis: 'GBT 12706.2-2020', req: '1.73U0 下放电量不大于 10pC', qty: 1, price: 150, on: true },
              { name: '导体直流电阻测量', quality: '', category: '例行试验', basis: 'GBT 12706.2-2020', req: '20℃ 直流电阻不超过标准规定值', qty: 1, price: 60, on: true },
              { name: '铠装层连续性试验', quality: '', category: '例行试验', basis: 'GBT 12706.2-2020', req: '铠装层导通良好，无断点', qty: 1, price: 70, on: true }
            ],
            judges: [{ category: '例行试验', scheme: '规则判定方案-简单合格/不合格判定' }]
          }
        ],
        tests: [], judges: []
      },
    };

  // DS 实壁类塑料电缆导管（图二的第 2 行样品）：型号 PVC-C，规格参数四项：环刚度等级 / 公称长度 / 公称内径 / 公称壁厚
  function conduitSample(id, name, sort, spigot) {
    SAMPLE_MOCK[id] = {
      name: name, code: '', sort: sort, category: 'BHG电缆保护管 / DS实壁类塑料电缆导管',
      standard: 'DLT 802.3-2023', fee: '', cycle: 3, diffModel: '是', unit: '根',
      remark: 'PVC-C 氯化聚氯乙烯实壁电力电缆导管', isCable: false,
      cableStruct: '', cores: '', coreColor: '', phases: [], sampleSpecs: [],
      markRule: '[型号信息.型号][ - ][规格参数.公称内径.值][空格][样品信息.标准号]',
      models: [{
        code: 'PVC-C', name: '氯化聚氯乙烯实壁电力电缆导管', sort: 1, cycle: 3,
        desc: spigot ? '承插口连接。' : '直管，平口连接。',
        specs: [
          { name: '环刚度等级', unit: '', options: ['SN4', 'SN8', 'SN12.5', 'SN16'] },
          { name: '公称长度', unit: 'mm', options: ['2000', '3000', '4000', '6000'] },
          { name: '公称内径', unit: 'mm', options: ['50', '75', '110', '160', '200'] },
          { name: '公称壁厚', unit: 'mm', options: ['2.0', '2.5', '3.0', '3.5', '4.0'] }
        ],
        tests: [
          { name: '环刚度试验', quality: '', category: '型式试验', basis: 'DLT 802.3-2023', req: '环刚度不低于标称等级', qty: 3, price: 0, on: true },
          { name: '扁平试验', quality: '', category: '型式试验', basis: 'DLT 802.3-2023', req: '压至外径 1/2 无破裂', qty: 3, price: 0, on: true },
          { name: '冲击试验', quality: '', category: '抽样试验', basis: 'DLT 802.3-2023', req: '常温冲击，通过率≥90%', qty: 5, price: 0, on: true },
          { name: '热变形试验', quality: '', category: '型式试验', basis: 'DLT 802.3-2023', req: '加热后无气泡、裂纹', qty: 2, price: 0, on: true }
        ],
        judges: [{ category: '例行试验', scheme: '规则判定方案-简单合格/不合格判定' }]
      }]
    };
  }
  conduitSample('ds-s', 'DS实壁类塑料电缆导管_直管', 1, false);
  conduitSample('ds-k', 'DS实壁类塑料电缆导管_带承口', 2, true);

  // 安全工器具类：试验项原先散落在委托登记弹窗的 mock 里，现并入样品数据共享源（数据不变）
  function tests976(standard) {
    return [
      { name: '交流耐压试验', quality: '', category: '例行试验', basis: standard, req: '{bcz}/{sj}，应无击穿、无闪络', qty: 1, price: 40, on: true },
      { name: '外观及尺寸', quality: '', category: '例行试验', basis: standard, req: '试品应光滑洁净，无气泡、无裂纹、无明显杂质', qty: 1, price: 40, on: true },
      { name: '抗弯动负荷试验', quality: '', category: '例行试验', basis: standard, req: '在{bcz}下操作3次，要求无损伤、无变形', qty: 1, price: 40, on: true },
      { name: '抗弯静负荷试验', quality: '', category: '例行试验', basis: standard, req: '应在{bcz}下持续1min无损伤、无变形', qty: 1, price: 40, on: true }
    ];
  }
  function aqgqjSample(id, name, sort, standard) {
    SAMPLE_MOCK[id] = {
      name: name, code: '', sort: sort, category: '安全工器具类', standard: standard,
      fee: '', cycle: 5, diffModel: '否', unit: '', remark: '', isCable: false,
      cableStruct: '', cores: '', coreColor: '', phases: [], sampleSpecs: [],
      markRule: '[样品信息.样品名称][空格][样品信息.标准号]',
      models: [], tests: tests976(standard), judges: []
    };
  }
  /* 扩展：不同安全工器具的预防性试验项差别很大（耐压 / 启动电压 / 静负荷 / 泄漏电流…），
   * 不能都套绝缘操作杆那 4 项，否则详情页与原始记录的试验项就是错的。 */
  function t(name, category, standard, req, qty, price) {
    return { name: name, quality: '', category: category, basis: standard, req: req, qty: qty, price: price, on: true };
  }
  function aqSample(id, name, sort, standard, unit, tests) {
    SAMPLE_MOCK[id] = {
      name: name, code: '', sort: sort, category: '安全工器具类', standard: standard,
      fee: '', cycle: 5, diffModel: '否', unit: unit, remark: '', isCable: false,
      cableStruct: '', cores: '', coreColor: '', phases: [], sampleSpecs: [],
      markRule: '[样品信息.样品名称][空格][样品信息.标准号]',
      models: [], tests: tests, judges: []
    };
  }
  var S976 = 'DLT 976-2017';
  aqSample('blanket', '绝缘毯', 6, S976, '块', [
    t('外观检查', '例行试验', S976, '表面光滑、无气泡/裂纹/杂质', 1, 40),
    t('工频耐压试验', '例行试验', S976, '按标称电压等级耐压 1min，无击穿、无闪络', 1, 80),
    t('穿刺耐压试验', '抽样试验', S976, '穿刺点耐压通过，无贯穿性击穿', 1, 80)
  ]);
  aqSample('shield', '遮蔽罩', 7, S976, '件', [
    t('外观检查', '例行试验', S976, '无裂纹、无穿孔、表面清洁', 1, 40),
    t('工频耐压试验', '例行试验', S976, '10kV 等级耐压 1min，无击穿、无闪络', 1, 80)
  ]);
  aqSample('suit', '10kV带电作业用绝缘服', 8, S976, '套', [
    t('外观检查', '例行试验', S976, '无破损、无老化、接缝完好', 1, 40),
    t('工频耐压试验', '例行试验', S976, '12kV 耐压 1min，无击穿、无闪络', 1, 100),
    t('泄漏电流试验', '例行试验', S976, '泄漏电流不大于 0.5mA', 1, 100)
  ]);
  aqSample('detector', '验电器', 9, S976, '支', [
    t('外观检查', '例行试验', S976, '指示部分完好，绝缘杆无裂纹', 1, 40),
    t('启动电压试验', '例行试验', S976, '启动电压应在额定电压的 15%~40% 之间', 1, 80),
    t('绝缘杆工频耐压试验', '例行试验', S976, '按等级耐压 1min，无击穿、无闪络', 1, 80)
  ]);
  aqSample('pole', '绝缘杆', 10, S976, '根', [
    t('外观及尺寸', '例行试验', S976, '表面光滑洁净，长度与截面符合标称', 1, 40),
    t('工频耐压试验', '例行试验', S976, '按额定电压耐压 1min，无击穿、无闪络', 1, 80)
  ]);
  aqSample('hardladder', '绝缘硬梯', 11, S976, '架', [
    t('外观检查', '例行试验', S976, '梯梁梯级无裂纹、无变形、连接牢固', 1, 40),
    t('静负荷试验', '例行试验', S976, '施加标称负荷 1min，无损伤、无永久变形', 2, 120),
    t('工频耐压试验', '例行试验', S976, '按等级耐压 1min，无击穿、无闪络', 1, 80)
  ]);
  aqSample('hook', '吊钩（环）t', 12, S976, '只', [
    t('外观检查', '例行试验', S976, '无裂纹、无磨损、防脱卡有效', 1, 40),
    t('静负荷试验', '例行试验', S976, '2.5 倍额定载荷保持 1min，无永久变形、无裂纹', 2, 150)
  ]);
  aqSample('bucket', '绝缘斗臂车-t', 13, S976, '台', [
    t('外观检查', '例行试验', S976, '斗体绝缘层无破损，金属件无变形', 1, 60),
    t('臂件静负荷试验', '例行试验', S976, '额定载荷 1.5 倍保持 1min，无永久变形', 1, 200),
    t('工频耐压试验', '例行试验', S976, '10kV 等级耐压 1min，无击穿、无闪络', 1, 150)
  ]);
  aqSample('bypass', '10kV旁路作业设备', 14, S976, '套', [
    t('外观检查', '例行试验', S976, '屏蔽与绝缘部件完好，接头无损伤', 1, 60),
    t('工频耐压试验', '例行试验', S976, '10kV 等级耐压 1min，无击穿、无闪络', 1, 200),
    t('温升试验', '型式试验', S976, '额定电流下温升不超过标准限值', 1, 260)
  ]);
  aqgqjSample('rod', '绝缘操作杆', 1, 'DLT 976-2017');
  aqSample('ladder', '绝缘软梯', 2, S976, '架', [
    t('外观检查', '例行试验', S976, '梯绳无断股、磨损，挂钩完好', 1, 40),
    t('静负荷试验', '例行试验', S976, '施加 2205N 静负荷 5min，无滑脱、无断股', 1, 120),
    t('工频耐压试验', '例行试验', S976, '按等级耐压 1min，无击穿、无闪络', 1, 80)
  ]);
  aqSample('belt976', '安全带', 3, S976, '条', [
    t('外观检查', '例行试验', S976, '带体无裂纹、无烧灼，缝线无脱线，配件完整', 1, 40),
    t('围杆带静负荷试验', '例行试验', S976, '施加 4.5kN 静负荷 5min，无滑脱、无断裂', 1, 120),
    t('整体冲击试验', '抽样试验', S976, '100kg 自由坠落冲击，带体与挂点无破损', 1, 150)
  ]);
  aqSample('rope1476', '安全绳', 4, 'DLT 1476-2023', '条', [
    t('外观检查', '例行试验', 'DLT 1476-2023', '绳体无磨损、无断股，端头固定可靠', 1, 40),
    t('静负荷试验', '例行试验', 'DLT 1476-2023', '施加标称负荷 5min，无滑移、无断裂', 1, 120)
  ]);
  aqSample('helmet', '安全帽', 5, 'DLT 1476-2023', '顶', [
    t('外观检查', '例行试验', 'DLT 1476-2023', '帽壳无裂纹、无穿孔，内衬与下颏带完好', 1, 40),
    t('冲击性能试验', '例行试验', 'DLT 1476-2023', '5kg 钢锤自 1m 冲击，头模受力不超过标准限值', 2, 120),
    t('电绝缘性能试验', '例行试验', 'DLT 1476-2023', '12kV 耐压 1min，泄漏电流不大于 1.2mA', 2, 100)
  ]);

  // 铜芯新增 3 个样品：沿用 GBT 12706.2-2020 同组型号与试验项，仅改额定电压与芯数（原型 Mock）
  function deriveCableSample(id, name, cores, voltage, sort) {
    var base = SAMPLE_MOCK['cu6-3c'];
    var copy = JSON.parse(JSON.stringify(base));
    copy.name = name; copy.sort = sort; copy.cores = cores;
    copy.models.forEach(function (m) {
      (m.specs || []).forEach(function (sp) {
        if (sp.title.indexOf('额定电压') >= 0) sp.options = [voltage];
      });
    });
    SAMPLE_MOCK[id] = copy;
  }
  deriveCableSample('cu6-20s', '20kV单芯电力电缆', '1芯', '12/20', 3);
  deriveCableSample('cu6-30', '30kV电力电缆', '3芯', '18/30', 4);
  deriveCableSample('cu6-40', '40kV电力电缆', '3芯', '24/35', 5);

  var CAT_LABELS = { dlwz: '电力物资类', aqgqj: '安全工器具类', hjjc: '环境检测', gcjc: '工程检测' };

  function walk(nodes, fn, parent) {
    (nodes || []).forEach(function (n) {
      if (fn(n, parent || null) === false) return;
      walk(n.children, fn, n);
    });
  }
  function findNode(nodes, id) {
    var hit = null;
    walk(nodes, function (n) { if (n.id === id) { hit = n; return false; } });
    return hit;
  }
  function getTree(cat) { return TREES[cat] || []; }
  function getSample(id) { return id ? (SAMPLE_MOCK[id] || null) : null; }
  function leafLabel(cat, id) {
    var n = findNode(getTree(cat), id);
    return n ? n.label : (getSample(id) || {}).name || '';
  }
  // 型号列表：label = 型号-名称（与系统「型号/分类」下拉一致）
  function modelsOf(sample) {
    return ((sample && sample.models) || []).map(function (m, i) {
      return { index: i, code: m.code, name: m.name,
               label: m.code + '-' + m.name, specs: m.specs || [], tests: m.tests || [] };
    });
  }
  function modelOf(sample, code) {
    var list = ((sample && sample.models) || []);
    for (var i = 0; i < list.length; i++) { if (list[i].code === code) return list[i]; }
    return null;
  }
  function testsOf(sample, code) {
    var m = modelOf(sample, code);
    if (m) return m.tests || [];
    return (sample && sample.tests) || [];
  }
  function sampleSpecsOf(sample) { return (sample && sample.sampleSpecs) || []; }

  // 产品标记：按样品数据里维护的「产品标记规则」实时拼装
  // 规则示例：[型号信息.型号][ - ][规格参数.额定电压.值][空格][样品信息.是否电缆.芯数][X][规格参数.导体标称截面积.值][空格][样品信息.标准号]
  // 取不到值的「数据段」渲染成 /，让没填的段一眼可见（YJV22 - / 3X/ GBT 12706.2-2020）；
  // 字面量分隔符（[空格]、[ - ]、X 等）不参与占位，原样保留。
  var MARK_EMPTY = '/';
  function buildMark(sample, modelCode, specValues) {
    if (!sample || !sample.markRule) return '';
    var model = modelOf(sample, modelCode);
    function resolve(raw) {
      var t = String(raw).trim();
      if (t === '空格') return ' ';
      var v = null; // null = 不是数据段，按字面量分隔符处理
      if (t.indexOf('规格参数.') === 0) {
        var name = t.split('.')[1] || '';
        var specs = (model && model.specs) || [];
        v = '';
        for (var i = 0; i < specs.length; i++) {
          var title = String(specs[i].name || specs[i].title || '');
          if (title.indexOf(name) >= 0) { v = (specValues && specValues[i]) || ''; break; }
        }
      } else if (t === '型号信息.型号') v = model ? (model.code || '') : '';
      else if (t === '型号信息.名称') v = model ? (model.name || '') : '';
      else if (t.indexOf('芯数') >= 0) v = String(sample.cores || '').replace(/芯$/, '');
      else if (t === '样品信息.标准号') v = sample.standard || '';
      else if (t === '样品信息.样品名称') v = sample.name || '';
      else if (t === '样品信息.是否电缆') v = sample.isCable ? '是' : '否';
      if (v === null) return raw;
      return String(v).trim() === '' ? MARK_EMPTY : v;
    }
    var rule = sample.markRule, out = '', re = /\[([^\]]*)\]/g, m, last = 0;
    while ((m = re.exec(rule))) {
      out += rule.slice(last, m.index) + resolve(m[1]);
      last = m.index + m[0].length;
    }
    return out + rule.slice(last);
  }

  /* ===== 产品标记开关（图2）=====
   * 关闭：不需要配置产品标记，LIMS 其它页面也不展示「产品标记」字段；
   * 开启：必须配置产品标记规则，且所有涉及样品信息的地方，在「样品名称」与「型号/分类」之间展示「产品标记」。
   * 默认值 = 该样品是否配过规则；在样品数据页拨动开关后按叶节点持久化。
   */
  var MARK_FLAG_KEY = 'lims.sampleMarkFlags';
  function markFlags() {
    try { return JSON.parse(global.localStorage.getItem(MARK_FLAG_KEY) || '{}'); } catch (e) { return {}; }
  }
  function isMarkEnabled(id) {
    if (!id) return false;
    var f = markFlags();
    if (Object.prototype.hasOwnProperty.call(f, id)) return !!f[id];
    var sample = SAMPLE_MOCK[id];
    return !!(sample && sample.markRule);
  }
  function setMarkEnabled(id, on) {
    if (!id) return;
    var f = markFlags();
    f[id] = !!on;
    try { global.localStorage.setItem(MARK_FLAG_KEY, JSON.stringify(f)); } catch (e) { /* 原型忽略 */ }
  }
  // 统一入口：未开启返回空串，页面据此决定是否展示该字段
  function markOf(id, modelCode, specValues) {
    if (!isMarkEnabled(id)) return '';
    return buildMark(SAMPLE_MOCK[id], modelCode, specValues);
  }

  // 样品名 → 样品大类：优先在样品数据树里精确命中叶节点，命中不了按关键词兜底（原型 mock 数据用）
  var CAT_KEYWORDS = [
    ['dlwz', ['电缆', '导管', '保护管', '铜芯', '铝芯', '电力']],
    ['aqgqj', ['绝缘', '安全', '遮蔽罩', '验电器', '斗臂车', '旁路', '接地线', '安全帽', '安全带', '绝缘服',
      '吊钩', '吊环', '吊带', '脚扣', '紧线器', '滑车', '梯', '绳索', '屏蔽衣']],
    ['hjjc', ['水质', '环境', '噪声', '土壤', '废气', '废水']],
    ['gcjc', ['水泥', '混凝土', '砂浆', '骨料', '钢筋']]
  ];
  function catKeyOfName(name) {
    if (!name) return '';
    var cats = Object.keys(TREES);
    for (var i = 0; i < cats.length; i++) {
      var hit = false;
      (function walk(nodes) {
        (nodes || []).forEach(function (n) {
          if (!hit && n.leaf && n.label === name) hit = true;
          walk(n.children);
        });
      })(TREES[cats[i]]);
      if (hit) return cats[i];
    }
    for (var k = 0; k < CAT_KEYWORDS.length; k++) {
      var words = CAT_KEYWORDS[k][1];
      for (var w = 0; w < words.length; w++) { if (name.indexOf(words[w]) >= 0) return CAT_KEYWORDS[k][0]; }
    }
    return '';
  }
  // 一行里可能是「绝缘毯、安全带」多个样品名，取第一个能判定出大类的
  function catLabelOfNames(text) {
    var parts = String(text || '').split(/[、,，\\/]/);
    for (var i = 0; i < parts.length; i++) {
      var key = catKeyOfName(parts[i].trim());
      if (key) return CAT_LABELS[key];
    }
    return '';
  }

  global.SampleDataStore = {
    catKeyOfName: catKeyOfName, catLabelOfNames: catLabelOfNames,
    isMarkEnabled: isMarkEnabled, setMarkEnabled: setMarkEnabled, markOf: markOf,
    MARK_FLAG_KEY: MARK_FLAG_KEY,
    TREES: TREES, SAMPLE_MOCK: SAMPLE_MOCK, CAT_LABELS: CAT_LABELS,
    getTree: getTree, getSample: getSample, findNode: findNode, leafLabel: leafLabel,
    modelsOf: modelsOf, modelOf: modelOf, testsOf: testsOf, sampleSpecsOf: sampleSpecsOf,
    buildMark: buildMark
  };
})(window);
