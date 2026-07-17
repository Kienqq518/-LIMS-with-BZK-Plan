(function (global) {
  var STORAGE_KEY = 'lims.fieldConfig';

  var FORM_FIELD_MAP = {
    contractNo: 'f_contractCode',
    contractName: 'f_contractName',
    signTime: 'f_signDate',
    servicePeriod: 'f_serviceYears',
    bidPrice: 'f_bidPrice',
    contractSample: 'f_contractSample',
    entrustNo: 'f_code',
    taskType: 'f_taskType',
    priority: 'f_priority',
    detectType: 'f_testType',
    detectNature: 'f_testCategory',
    clientUnit: 'f_customer',
    address: 'f_address',
    zipCode: 'f_zip',
    contact: 'f_contact',
    contactPhone: 'f_phone',
    salesman: 'f_salesman',
    signPlace: 'f_signPlace',
    testCenter: 'f_lab',
    acceptDate: 'f_acceptDate',
    requireDate: 'f_requireDate',
    requireDays: 'f_days',
    compiler: 'f_editor',
    agentUnit: 'f_agent',
    agentPhone: 'f_agentPhone',
    entrustRemark: 'f_remark',
    totalPrice: 'f_totalPrice',
    actualCost: 'f_actualFee',
    discount: 'f_discount',
    payerUnit: 'f_payer',
    payMethod: 'f_payMethod',
    bizRemark: 'f_feeRemark',
    reportDelivery: 'f_reportDelivery',
    reportQual: 'f_reportQual',
    reportDesc: 'f_reportDesc',
    reportQty: 'f_reportCount',
    resultFormat: 'f_resultType'
  };

  var DEFAULT_FIELD_SECTIONS = [
    {
      title: '合同信息', id: 'contract', checked: true,
      fields: [
        { id: 'contractNo', label: '合同编号', placeholder: '合同编号', fieldType: 'select', dictType: null, locked: true, checked: true },
        { id: 'contractName', label: '合同名称', placeholder: '合同名称', fieldType: 'text', dictType: null, checked: true },
        { id: 'signTime', label: '合同签订时间', placeholder: '合同签订时间', fieldType: 'text', dictType: null, checked: true },
        { id: 'servicePeriod', label: '合同服务期限', placeholder: '合同服务期限', fieldType: 'text', dictType: null, checked: true },
        { id: 'bidPrice', label: '合同招标价款', placeholder: '合同招标价款', fieldType: 'text', dictType: null, checked: true },
        { id: 'contractSample', label: '合同样品', placeholder: '合同样品', fieldType: 'text', dictType: null, checked: true }
      ]
    },
    {
      title: '委托信息', id: 'entrustInfo', checked: true,
      fields: [
        { id: 'entrustNo', label: '委托编号', placeholder: '委托编号', fieldType: 'text', dictType: null, locked: true, checked: true },
        { id: 'taskType', label: '任务类型', placeholder: '任务类型', fieldType: 'select', dictType: 'lims_task_type', locked: true, checked: true },
        { id: 'priority', label: '优先等级', placeholder: '优先等级', fieldType: 'select', dictType: 'lims_priority', locked: true, checked: true },
        { id: 'detectType', label: '检测类型', placeholder: '检测类型', fieldType: 'select', dictType: 'lims_detect_type', checked: true },
        { id: 'detectNature', label: '检测类别', placeholder: '检测类别', fieldType: 'select', dictType: 'lims_detect_category', checked: true },
        { id: 'clientUnit', label: '委托单位', placeholder: '委托单位', fieldType: 'select', dictType: null, locked: true, checked: true },
        { id: 'address', label: '地址', placeholder: '地址', fieldType: 'text', dictType: null, checked: true },
        { id: 'zipCode', label: '邮编', placeholder: '邮编', fieldType: 'text', dictType: null, checked: true },
        { id: 'contact', label: '联系人', placeholder: '联系人', fieldType: 'select', dictType: null, locked: true, checked: true },
        { id: 'contactPhone', label: '联系方式', placeholder: '联系方式', fieldType: 'text', dictType: null, locked: true, checked: true },
        { id: 'salesman', label: '业务负责人', placeholder: '业务员', fieldType: 'select', dictType: null, checked: true, removable: true, annotate: 'salesman-field' },
        { id: 'signPlace', label: '签订地点', placeholder: '签订地点', fieldType: 'select', dictType: null, checked: true },
        { id: 'testCenter', label: '检测中心', placeholder: '检测中心', fieldType: 'select', dictType: null, locked: true, checked: true },
        { id: 'acceptDate', label: '受理日期', placeholder: '受理日期', fieldType: 'text', dictType: null, locked: true, checked: true },
        { id: 'requireDate', label: '客户要求完成日期', placeholder: '客户要求完成日期', fieldType: 'text', dictType: null, checked: true },
        { id: 'requireDays', label: '要求检测完成天数', placeholder: '要求检测完成天数', fieldType: 'text', dictType: null, locked: true, checked: true, help: true },
        { id: 'compiler', label: '编制人', placeholder: '编制人', fieldType: 'text', dictType: null, locked: true, checked: true },
        { id: 'agentUnit', label: '代检单位', placeholder: '代检单位', fieldType: 'select', dictType: null, checked: true },
        { id: 'agentPhone', label: '代检联系方式', placeholder: '代检联系方式', fieldType: 'text', dictType: null, checked: true },
        { id: 'entrustRemark', label: '委托备注', placeholder: '委托备注', fieldType: 'text', dictType: null, checked: true }
      ]
    },
    {
      title: '付款信息', id: 'payment', checked: true,
      fields: [
        { id: 'totalPrice', label: '样品检测总价格', placeholder: '样品检测总价格', fieldType: 'text', dictType: null, locked: true, checked: true },
        { id: 'actualCost', label: '实际费用', placeholder: '实际费用', fieldType: 'text', dictType: null, locked: true, checked: true },
        { id: 'discount', label: '折扣率', placeholder: '折扣率', fieldType: 'text', dictType: null, locked: true, checked: true },
        { id: 'payerUnit', label: '付款单位', placeholder: '付款单位', fieldType: 'text', dictType: null, checked: true },
        { id: 'payMethod', label: '付款方式', placeholder: '付款方式', fieldType: 'select', dictType: 'lims_pay_method', checked: true },
        { id: 'bizRemark', label: '业务备注', placeholder: '业务备注', fieldType: 'text', dictType: null, checked: true }
      ]
    },
    {
      title: '报告信息', id: 'reportInfo', checked: true,
      fields: [
        { id: 'reportDelivery', label: '报告交付方式', placeholder: '报告交付方式', fieldType: 'select', dictType: 'lims_report_delivery', checked: true },
        { id: 'reportQual', label: '报告资质', placeholder: '报告资质', fieldType: 'select', dictType: 'lims_report_qual', locked: true, checked: true },
        { id: 'reportDesc', label: '报告说明', placeholder: '报告说明', fieldType: 'select', dictType: 'lims_report_desc', checked: true },
        { id: 'reportQty', label: '报告数量', placeholder: '报告数量', fieldType: 'text', dictType: null, checked: true },
        { id: 'resultFormat', label: '结果格式', placeholder: '结果格式', fieldType: 'select', dictType: 'lims_result_format', checked: true }
      ]
    }
  ];

  function cloneSections(sections) {
    return JSON.parse(JSON.stringify(sections));
  }

  function load() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return cloneSections(DEFAULT_FIELD_SECTIONS);
  }

  function save(sections) {
    if (global.localStorage) {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
    }
  }

  function reset() {
    if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY);
    return cloneSections(DEFAULT_FIELD_SECTIONS);
  }

  function findField(sections, id) {
    for (var i = 0; i < sections.length; i++) {
      for (var j = 0; j < sections[i].fields.length; j++) {
        if (sections[i].fields[j].id === id) return sections[i].fields[j];
      }
    }
    return null;
  }

  function getBoundFieldByDictType(sections, dictType, excludeFieldId) {
    var found = null;
    sections.forEach(function (sec) {
      sec.fields.forEach(function (f) {
        if (f.dictType === dictType && f.id !== excludeFieldId) found = f;
      });
    });
    return found;
  }

  function syncBoundDictNames(sections, dictTypes) {
    sections.forEach(function (sec) {
      sec.fields.forEach(function (f) {
        if (f.dictType && f.placeholder && global.MockDictStore) {
          global.MockDictStore.syncDictName(dictTypes, f.dictType, f.placeholder);
        }
      });
    });
    return dictTypes;
  }

  function resetDictNamesToDefault(dictTypes) {
    DEFAULT_FIELD_SECTIONS.forEach(function (sec) {
      sec.fields.forEach(function (f) {
        if (f.dictType && global.MockDictStore) {
          global.MockDictStore.syncDictName(dictTypes, f.dictType, f.placeholder);
        }
      });
    });
    return dictTypes;
  }

  function populateSelectFromDict(selectEl, dictType, dictTypes, keepEmpty) {
    if (!selectEl || !dictType || !global.MockDictStore) return false;
    var items = global.MockDictStore.getActiveItems(dictTypes, dictType);
    if (!items.length) return false;
    var current = selectEl.value;
    var html = keepEmpty ? '<option value="">请选择</option>' : '';
    items.forEach(function (it) {
      html += '<option value="' + it.value + '">' + it.label + '</option>';
    });
    selectEl.innerHTML = html;
    if (current) selectEl.value = current;
    else if (items.length && !keepEmpty) selectEl.selectedIndex = 0;
    return true;
  }

  function applyToForm(sections, dictTypes) {
    sections.forEach(function (sec) {
      sec.fields.forEach(function (f) {
        var formId = FORM_FIELD_MAP[f.id];
        if (!formId) return;
        var el = document.getElementById(formId);
        if (!el) return;
        var formItem = el.closest('.form-item');
        if (formItem) {
          formItem.style.display = f.checked ? '' : 'none';
          formItem.setAttribute('data-field-id', f.id);
        }
        var labelEl = formItem && formItem.querySelector('label');
        if (labelEl) {
          var req = labelEl.querySelector('.req');
          var reqHtml = req ? req.outerHTML + ' ' : '';
          labelEl.innerHTML = reqHtml + f.placeholder;
        }
        if (f.fieldType === 'select' && f.dictType && el.tagName === 'SELECT') {
          var needsEmpty = el.querySelector('option[value=""]') !== null;
          populateSelectFromDict(el, f.dictType, dictTypes, needsEmpty);
        }
      });
    });
  }

  global.EntrustFieldConfig = {
    STORAGE_KEY: STORAGE_KEY,
    FORM_FIELD_MAP: FORM_FIELD_MAP,
    DEFAULT_FIELD_SECTIONS: DEFAULT_FIELD_SECTIONS,
    cloneSections: cloneSections,
    load: load,
    save: save,
    reset: reset,
    findField: findField,
    getBoundFieldByDictType: getBoundFieldByDictType,
    syncBoundDictNames: syncBoundDictNames,
    resetDictNamesToDefault: resetDictNamesToDefault,
    populateSelectFromDict: populateSelectFromDict,
    applyToForm: applyToForm
  };
})(window);
