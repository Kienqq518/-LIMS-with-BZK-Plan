/* 收样记录共享存储（Story202611-01-05 样品收样支持单类样品收样）
 * 一条记录 = 一次收样提交，可包含多类样品（勾选几行就是几类），共用本次收样信息；
 * 每一类样品有自己的规格取值与收样图片。
 */
(function (global) {
  var KEY = 'lims.receiveRecords';

  // 收样图片候选：复用仓库里已有的收样实拍素材
  var PHOTO_LIBRARY = [
    { url: 'assets/report-trace/photo-receive-front.png', name: '收样正面' },
    { url: 'assets/report-trace/photo-receive-side.png', name: '收样侧面' },
    { url: 'assets/report-trace/photo-01-bench.jpg', name: '试验台' },
    { url: 'assets/report-trace/photo-03-field.jpg', name: '现场' },
    { url: 'assets/report-trace/photo-05-bend.jpg', name: '抗弯试验' },
    { url: 'assets/report-trace/photo-07-sign.jpg', name: '标识' }
  ];

  function load() {
    try { return JSON.parse(global.localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function save(list) {
    try { global.localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 原型忽略 */ }
  }
  function addRecord(rec) {
    var list = load();
    rec.id = 'RC' + Date.now();
    rec.createdAt = new Date().toISOString();
    list.push(rec);
    save(list);
    return rec;
  }
  function recordsOf(code) {
    return load().filter(function (r) { return r.entrustCode === code; });
  }
  // 某委托下已收样的样品行：{ sampleKey: { record, line } }
  function receivedMap(code) {
    var map = {};
    recordsOf(code).forEach(function (r) {
      (r.lines || []).forEach(function (ln) { map[ln.sampleKey] = { record: r, line: ln }; });
    });
    return map;
  }
  function isAllReceived(code, sampleKeys) {
    if (!sampleKeys.length) return false;
    var got = receivedMap(code);
    return sampleKeys.every(function (k) { return !!got[k]; });
  }
  function reset() { save([]); }

  global.ReceiveStore = {
    KEY: KEY, PHOTO_LIBRARY: PHOTO_LIBRARY,
    load: load, addRecord: addRecord, recordsOf: recordsOf,
    receivedMap: receivedMap, isAllReceived: isAllReceived, reset: reset
  };
})(window);
