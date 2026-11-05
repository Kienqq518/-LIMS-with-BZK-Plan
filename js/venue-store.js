/**
 * 场地管理 Mock Store（基础数据 · 场地）
 * 列表与设备管理「所在区域」共用场地名称。
 */
(function (global) {
  var STORAGE_KEY = 'lims.venues.v2';

  var DEFAULT_VENUES = [
    { id: 'v1', name: '控制室', location: '104', remark: '' },
    { id: 'v2', name: '智能力学室', location: '103', remark: '' },
    { id: 'v3', name: '材料试验区', location: '107', remark: '' },
    { id: 'v4', name: '智能高压室', location: '105', remark: '' },
    { id: 'v5', name: '智能样品室', location: '102', remark: '' },
    { id: 'v6', name: '数智化电气试验区', location: '110', remark: '' },
    { id: 'v7', name: '无人化电缆试验区', location: '106', remark: '' },
    { id: 'v8', name: '环境试验区', location: '108', remark: '' },
    { id: 'v9', name: '综合试验区', location: '109', remark: '' }
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
