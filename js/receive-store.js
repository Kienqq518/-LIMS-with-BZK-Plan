/* 收样记录共享存储（Story202611-01-05 样品收样支持单类样品收样）
 * 一条记录 = 一次收样提交，可包含多类样品（勾选几行就是几类），共用本次收样信息；
 * 每一类样品有自己的规格取值与收样图片。
 */
(function (global) {
  var KEY = 'lims.receiveRecords';
  var doc = global.document;

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
    try {
      global.localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      // 收样图片以压缩后的 dataURL 存库，可能撑爆 localStorage：
      // 退化方案是只保留图片名，保证收样记录本身不丢
      try {
        var light = JSON.parse(JSON.stringify(list));
        light.forEach(function (r) {
          (r.lines || []).forEach(function (ln) {
            ln.images = (ln.images || []).map(function (im) {
              return { name: imName(im), url: '' };
            });
          });
        });
        global.localStorage.setItem(KEY, JSON.stringify(light));
      } catch (e2) { /* 原型忽略 */ }
    }
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

  /* 演示种子：让「部分样品已收样」的委托开箱即见。
   * 幂等且只补不删：已收过的样品行不会被重复写入，也不覆盖手工收样记录。
   */
  var demoSeq = 0;
  function plusDaysLocal(str, n) {
    var p = String(str || '').split('-');
    var d = new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1);
    d.setDate(d.getDate() + n);
    var mo = d.getMonth() + 1, dd = d.getDate(), z = function (v) { return (v < 10 ? '0' : '') + v; };
    return d.getFullYear() + '-' + z(mo) + '-' + z(dd);
  }

  /* 演示种子（带 demo 标记）的收样日一律跟着委托受理日走。
   * 委托受理日期已按全年铺排，写死在种子里的日期会与之脱节（同一单在收样页看到 8 月、
   * 在详情页看到 11 月）；这里按「收样日 = 受理日 + 1，第二批 +3、第三批再 +3」重算。
   * 手工收样产生的记录没有 demo 标记，一律不动。 */
  function normalizeDemoDates() {
    var list = load(), seq = {}, changed = false;
    list.forEach(function (r) {
      if (!r || !r.demo) return;
      var m = (global.EntrustMock && global.EntrustMock.get) ? global.EntrustMock.get(r.entrustCode) : null;
      var base = m && m.receiveDate;
      if (!base) return;
      var n = seq[r.entrustCode] || 0;
      seq[r.entrustCode] = n + 1;
      var want = plusDaysLocal(base, n * 3);
      if (r.receiveDate !== want) { r.receiveDate = want; changed = true; }
    });
    if (changed) save(list);
  }

  function seedDemo(records) {
    normalizeDemoDates();
    var cur = load();
    var have = {};
    cur.forEach(function (r) {
      (r.lines || []).forEach(function (ln) { if (ln && ln.sampleKey) have[ln.sampleKey] = 1; });
    });
    var added = 0;
    (records || []).forEach(function (r) {
      var lines = (r.lines || []).filter(function (ln) { return ln && !have[ln.sampleKey]; });
      if (!lines.length) return;
      lines.forEach(function (ln) { have[ln.sampleKey] = 1; });
      var rec = JSON.parse(JSON.stringify(r));
      rec.lines = lines;
      rec.demo = true;
      rec.id = 'DEMO' + (++demoSeq) + '-' + Date.now();
      cur.push(rec);
      added++;
    });
    if (added) save(cur);
    return added;
  }

  // 图片既可能是字符串（素材库 URL / dataURL），也可能是 { name, url }
  function imName(im) {
    if (!im) return '';
    if (typeof im === 'object') return im.name || '';
    return String(im).split('/').pop();
  }
  function imSrc(im) {
    if (!im) return '';
    return typeof im === 'object' ? (im.url || '') : String(im);
  }
  function imCount(list) { return (list || []).filter(function (im) { return !!imSrc(im); }).length; }

  // 选中的图片压缩后再入库：最长边 900px、JPEG 0.72，避免 localStorage 超限
  function shrinkImage(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 900, w = img.width || max, h = img.height || max;
        if (w > max || h > max) {
          var k = Math.min(max / w, max / h);
          w = Math.round(w * k); h = Math.round(h * k);
        }
        var cv = doc.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        var out = fr.result;
        try { out = cv.toDataURL('image/jpeg', 0.72); } catch (e) { /* 保留原 dataURL */ }
        cb({ name: file.name, url: out });
      };
      img.onerror = function () { cb({ name: file.name, url: '' }); };
      img.src = fr.result;
    };
    fr.onerror = function () { cb(null); };
    fr.readAsDataURL(file);
  }

  global.ReceiveStore = {
    imName: imName, imSrc: imSrc, imCount: imCount, shrinkImage: shrinkImage,
    KEY: KEY, PHOTO_LIBRARY: PHOTO_LIBRARY,
    load: load, addRecord: addRecord, recordsOf: recordsOf,
    receivedMap: receivedMap, isAllReceived: isAllReceived, reset: reset, seedDemo: seedDemo,
    normalizeDemoDates: normalizeDemoDates
  };
})(window);
