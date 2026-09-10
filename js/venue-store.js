/**
 * 场地管理 Mock Store（基础数据 · 场地）
 * 列表与设备管理「所在区域」共用场地名称。
 */
(function (global) {
  var STORAGE_KEY = 'lims.venues.v1';

  var DEFAULT_VENUES = [
    { id: 'v1', name: '力学检测室2', location: '二楼202', remark: '' },
    { id: 'v2', name: '电气检测室1', location: '一楼110', remark: '' },
    { id: 'v3', name: '力学检测室1', location: '二楼201', remark: '' },
    { id: 'v4', name: '电气检测室', location: '一楼109', remark: '' },
    { id: 'v5', name: '老化试验室', location: '一楼108', remark: '' },
    { id: 'v6', name: '综合检测区', location: '一楼大厅', remark: '' },
    { id: 'v7', name: '无人机实验室', location: '三楼301', remark: '' },
    { id: 'v8', name: '样品制备室', location: '二楼205', remark: '场地备注' },
    { id: 'v9', name: '标准室', location: '三楼310', remark: '示例数据' }
  ];

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return clone(fallback);
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return clone(fallback);
      return parsed;
    } catch (e) {
      return clone(fallback);
    }
  }

  function writeJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  }

  function load() {
    return readJson(STORAGE_KEY, DEFAULT_VENUES);
  }

  function save(list) {
    writeJson(STORAGE_KEY, list);
  }

  function newId() {
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function findById(list, id) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function isNameTaken(list, name, excludeId) {
    var key = (name || '').trim();
    for (var i = 0; i < list.length; i++) {
      if (excludeId && list[i].id === excludeId) continue;
      if ((list[i].name || '').trim() === key) return true;
    }
    return false;
  }

  function names(list) {
    var src = list || load();
    return src.map(function (v) { return v.name; }).filter(Boolean);
  }

  global.VenueStore = {
    load: load,
    save: save,
    newId: newId,
    findById: findById,
    isNameTaken: isNameTaken,
    names: names,
    clone: clone,
    reset: function () { var s = clone(DEFAULT_VENUES); save(s); return s; }
  };
})(window);
