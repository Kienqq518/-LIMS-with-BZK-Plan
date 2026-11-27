/**
 * 极简 XLSX 写出器（零依赖）：store 模式 zip + inline string + 样式表 + 列宽 + 冻结首行 + 筛选。
 * 产物是真实可被 Excel / WPS / openpyxl 打开的 .xlsx，且带界面上同一套置信度色标。
 */
(function (global) {
  'use strict';
  var CRC_T = (function () {
    var t = [], c, k;
    for (k = 0; k < 256; k++) { c = k; for (var j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[k] = c >>> 0; }
    return t;
  })();
  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function rawBytes(s) { var o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 0xFF; return o; }
  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var out = [], c;
    for (var i = 0; i < s.length; i++) {
      c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0xD800 || c >= 0xE000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else { i++; c = 0x10000 + ((c & 0x3FF) << 10) + (s.charCodeAt(i) & 0x3FF);
        out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return new Uint8Array(out);
  }
  function le(n, w) { var a = []; for (var i = 0; i < w; i++) { a.push(n & 0xFF); n = n >>> 8; } return a; }
  function col(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }

  /* 样式索引：0 默认 1 表头 2 键列等宽 3-7 置信度五色 8 长文本换行 9 粗体 10-14 换行+置信度 */
  var FONTS = [
    '<sz val="10.5"/><color rgb="FF1B1D21"/><name val="Calibri"/>',
    '<b/><sz val="10.5"/><color rgb="FFFFFFFF"/><name val="Calibri"/>',
    '<sz val="10"/><color rgb="FF143C9A"/><name val="Consolas"/>',
    '<sz val="10.5"/><color rgb="FF12A150"/><name val="Calibri"/>',
    '<sz val="10.5"/><color rgb="FFDB4437"/><name val="Calibri"/>',
    '<sz val="10.5"/><color rgb="FFB45309"/><name val="Calibri"/>',
    '<sz val="10.5"/><color rgb="FF143C9A"/><name val="Calibri"/>',
    '<sz val="10.5"/><color rgb="FF6E7481"/><name val="Calibri"/>',
    '<b/><sz val="10.5"/><color rgb="FF1B1D21"/><name val="Calibri"/>'
  ];
  var FILLS = ['none', 'gray125', 'FF143C9A', 'FFEDFAF2', 'FFFDF0EF', 'FFFEF7EA', 'FFF0F4FB', 'FFF5F6F8'];
  /* 每个样式显式声明 font / fill / border / align，缺项就不加对应 apply* 属性 */
  function xf(font, fill, border, align) { return { font: font || 0, fill: fill || 0, border: border || 0, align: align || '' }; }
  var XF = [
    xf(0), xf(1, 2, 1, ' vertical="center" wrapText="1"'), xf(2),
    xf(3, 3), xf(4, 4), xf(5, 5), xf(6, 6), xf(7, 7),
    xf(0, 0, 0, ' vertical="top" wrapText="1"'), xf(8),
    xf(5, 5, 0, ' vertical="top" wrapText="1"'), xf(6, 6, 0, ' vertical="top" wrapText="1"'),
    xf(4, 4, 0, ' vertical="top" wrapText="1"'), xf(3, 3, 0, ' vertical="top" wrapText="1"'),
    xf(7, 7, 0, ' vertical="top" wrapText="1"')
  ];
  var CONF_STYLE = { '已验证': 3, '冲突': 4, '未验证': 5, 'AI推断': 6, '无来源': 7 };
  var CONF_WRAP = { '已验证': 13, '冲突': 12, '未验证': 10, 'AI推断': 11, '无来源': 14 };
  var WIDE = /问题文本|原文|说明|备注|要求|过程|条件|候选|依据|表达式|标签|名称$/;

  function stylesXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="' + FONTS.length + '">' + FONTS.map(function (f) { return '<font>' + f + '</font>'; }).join('') + '</fonts>' +
      '<fills count="' + FILLS.length + '">' + FILLS.map(function (f, i) {
        return i < 2 ? '<fill><patternFill patternType="' + f + '"/></fill>'
          : '<fill><patternFill patternType="solid"><fgColor rgb="' + f + '"/><bgColor indexed="64"/></patternFill></fill>';
      }).join('') + '</fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
      '<border><left/><right/><top/><bottom style="thin"><color rgb="FFE5E7EB"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + XF.length + '">' + XF.map(function (x) {
        var a = x.align ? '<alignment' + x.align + '/>' : '';
        return '<xf numFmtId="0" fontId="' + x.font + '" fillId="' + x.fill + '" borderId="' + x.border +
          '" xfId="0"' + (x.font ? ' applyFont="1"' : '') + (x.fill ? ' applyFill="1"' : '') +
          (x.border ? ' applyBorder="1"' : '') + (a ? ' applyAlignment="1"' : '') + '>' + a + '</xf>';
      }).join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }

  function zip(files) {
    var parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var nm = rawBytes(f.name), data = f.data, crc = crc32(data);
      var lh = new Uint8Array([].concat(le(0x04034b50, 4), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0, 2),
        le(crc, 4), le(data.length, 4), le(data.length, 4), le(nm.length, 2), le(0, 2)));
      parts.push(lh, nm, data);
      central.push(new Uint8Array([].concat(le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0, 2),
        le(crc, 4), le(data.length, 4), le(data.length, 4), le(nm.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2),
        le(0, 4), le(off, 4))), nm);
      off += lh.length + nm.length + data.length;
    });
    var csz = 0; central.forEach(function (c) { csz += c.length; });
    var end = new Uint8Array([].concat(le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2),
      le(csz, 4), le(off, 4), le(0, 2)));
    var all = parts.concat(central, [end]), len = 0;
    all.forEach(function (a) { len += a.length; });
    var out = new Uint8Array(len), p = 0;
    all.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  }

  function sheetXml(sheet) {
    var rows = sheet.rows, n = 0;
    rows.forEach(function (r) { n = Math.max(n, r.length); });
    var heads = (rows[0] || []).map(function (h) { return String(h && h.v != null ? h.v : (h == null ? '' : h)); });
    var w = [];
    for (var c = 0; c < n; c++) {
      var mx = 8;
      rows.slice(1).forEach(function (r) {
        var v = r[c]; v = (v && typeof v === 'object') ? v.v : v;
        mx = Math.max(mx, String(v == null ? '' : v).length);
      });
      w.push(WIDE.test(heads[c] || '') ? 44 : Math.min(32, Math.max(9, Math.round(mx * 1.12) + 2)));
    }
    var s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="16.5"/>' +
      '<cols>' + w.map(function (x, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + x + '" customWidth="1"/>';
      }).join('') + '</cols><sheetData>';
    rows.forEach(function (r, ri) {
      s += '<row r="' + (ri + 1) + '" ht="' + (ri === 0 ? 24 : 15.5) + '" customHeight="1">';
      r.forEach(function (cell, ci) {
        var o = (cell && typeof cell === 'object' && cell.v !== undefined) ? cell : { v: cell };
        var v = o.v == null ? '' : String(o.v);
        if (v === '' && o.s == null) return;
        var st = o.s != null ? o.s : (ri === 0 ? 1 : (ci === 0 ? 2 : (WIDE.test(heads[ci] || '') ? 8 : 0)));
        var ref = col(ci) + (ri + 1);
        if (/^-?\d+(\.\d+)?$/.test(v)) s += '<c r="' + ref + '" s="' + st + '"><v>' + v + '</v></c>';
        else s += '<c r="' + ref + '" s="' + st + '" t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      });
      s += '</row>';
    });
    s += '</sheetData>';
    if (rows.length > 1) s += '<autoFilter ref="A1:' + col(n - 1) + rows.length + '"/>';
    return s + '</worksheet>';
  }

  /* sheets: [{name, rows:[[值 | {v,s}]]}] */
  function build(sheets) {
    var files = [];
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    sheets.forEach(function (x, i) {
      ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    });
    ct += '</Types>';
    files.push({ name: '[Content_Types].xml', data: utf8(ct) });
    files.push({ name: '_rels/.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') });
    files.push({ name: 'xl/workbook.xml', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map(function (x, i) { return '<sheet name="' + esc(x.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
      '</sheets></workbook>') });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: utf8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (x, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') });
    files.push({ name: 'xl/styles.xml', data: utf8(stylesXml()) });
    sheets.forEach(function (x, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: utf8(sheetXml(x)) }); });
    return zip(files);
  }

  global.XLSX = {
    build: build,
    CONF: CONF_STYLE,
    styleFor: function (state, wrap) {
      if (!state) return wrap ? 8 : 0;
      return wrap ? (CONF_WRAP[state] != null ? CONF_WRAP[state] : 8) : (CONF_STYLE[state] != null ? CONF_STYLE[state] : 0);
    },
    download: function (sheets, filename) {
      var blob = new Blob([build(sheets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
      return blob.size;
    }
  };
})(window);
