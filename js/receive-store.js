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
    receivedMap: receivedMap, isAllReceived: isAllReceived, reset: reset
  };
})(window);
