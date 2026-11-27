/**
 * 标准成果库共享存储：工作台（F1/F2/F3）与库页面读写同一份数据。
 * 拆解成果是复利来源，所以它必须是被两边共同维护的活数据，不是静态展示。
 * 约定：改种子必须同步升 STORAGE_KEY 版本号。
 */
(function (global) {
  'use strict';
  var STORAGE_KEY = 'lims.stdlib.v2';
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  /* 种子 = DS 稿件 51_试验依据 抽出的真实标准清单 */
  var SEED = global.STD_SEED || [];

  function now() { return new Date().toLocaleString('zh-CN', { hour12: false }); }
  function blank(x) {
    return {
      code: x.code, disp: x.disp, title: x.title, prefix: x.prefix, year: x.year,
      status: x.status, role: x.role, clauses: x.clauses || [], refs: x.refs || 0,
      textQuality: x.text_quality, pages: x.pages,
      blob: { file: x.disp.replace(/ /g, '') + '.pdf', hash: hash(x.code), owner: '张工（迈特诺检测中心）', at: '2026-10-12 14:22' },
      versions: x.derived ? [{ v: 'v3-final', state: 'final', at: '2026-10-12 18:05', by: '李工（业务专家）',
        cover: '2 个样品 / 8 个型号 / 16 个试验项 / 166 个参数 / 42 条判定条件',
        precheck: '真缺陷 0 · 阻断 0', open: 93 }] : [],
      scopeQA: x.derived ? [
        { q: '型号挂在哪个样品下？', a: '每个样品各自一套型号，同名互不隶属' },
        { q: '环刚度 2 套配置 vs 4 个型号怎么对齐？', a: '按型号各拆一条，多余配置丢弃' },
        { q: '802.1 要不要单独建任务？', a: '不建，只建分类节点' },
        { q: '落锤冲击的计数对象按试样还是样段？', a: '样段（样段数=10 与标准统计对象一致）' }
      ] : [],
      reuse: x.derived ? [
        { tenant: '迈特诺技术股份有限公司检测中心', deploy: '云部署', ver: 'v3-final', at: '2026-10-12', how: '首次拆解' }
      ] : [],
      log: [
        { at: '2026-10-12 14:22', who: '张工', what: '上传文件本体，正文识别出编号 ' + x.disp }
      ]
    };
  }
  function hash(code) {
    var h = 0, s = 'std:' + code;
    for (var i = 0; i < s.length; i++) h = (h * 131 + s.charCodeAt(i)) >>> 0;
    return h.toString(16).slice(0, 8) + (h % 97).toString(16).padStart(2, '0');
  }
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { }
    if (raw) { try { return JSON.parse(raw); } catch (e) { } }
    var m = {};
    SEED.forEach(function (x) { m[x.code] = blank(x); });
    return m;
  }
  var DB = load();
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); } catch (e) { } }
  function key(code) {   // 标准号写法千变万化（空格 / 全半角破折号），比对前先归一
    return String(code || '').replace(/\s+/g, '').replace(/[\u2014\u2013]/g, '-');
  }
  function touch(code, patch) {
    var k = key(code), rec = null;
    Object.keys(DB).forEach(function (c) { if (key(c) === k) rec = DB[c]; });
    if (!rec) return null;
    Object.keys(patch || {}).forEach(function (f) { rec[f] = patch[f]; });
    save(); return rec;
  }

  var STDLib = {
    all: function () { return Object.keys(DB).map(function (k) { return DB[k]; })
      .sort(function (a, b) { return (b.versions.length - a.versions.length) || a.code.localeCompare(b.code); }); },
    get: function (code) {
      var k = key(code), rec = null;
      Object.keys(DB).forEach(function (c) { if (key(c) === k) rec = DB[c]; });
      return rec;
    },
    derived: function (code) { var r = STDLib.get(code); return (r && r.versions.length) ? r : null; },
    /* ── 工作台回写的三个动作 ── */
    onDraft: function (code, stat) {
      var rec = touch(code); if (!rec) return null;
      rec.versions.unshift({ v: stat.ver, state: 'draft', at: now(), by: 'AI 助手',
        cover: stat.cover, precheck: stat.precheck, open: stat.open });
      rec.log.unshift({ at: now(), who: 'AI 助手', what: '拆解产出 ' + stat.ver + '（' + stat.open + ' 条待定项）' });
      rec.recent = 'draft'; save(); return rec;
    },
    onFinalize: function (code, stat) {
      var rec = touch(code); if (!rec) return null;
      var cur = rec.versions[0];
      if (cur) { cur.v = stat.ver; cur.state = 'final'; cur.at = now(); cur.by = stat.by; cur.precheck = stat.precheck; }
      // 问答是资产，只能累积不能覆盖：同问题以最新答案替换，其余保留
      var qa = (rec.scopeQA || []).slice();
      (stat.qa || []).forEach(function (nq) {
        var at = -1;
        for (var i = 0; i < qa.length; i++) if (qa[i].q.slice(0, 18) === nq.q.slice(0, 18)) { at = i; break; }
        if (at >= 0) qa[at] = nq; else qa.push(nq);
      });
      rec.scopeQA = qa;
      rec.log.unshift({ at: now(), who: stat.by, what: '定稿 ' + stat.ver + '，锁定不可变；范围级问答 ' + rec.scopeQA.length + ' 条已沉淀' });
      rec.recent = 'final'; save(); return rec;
    },
    onImport: function (code, stat) {
      var rec = touch(code); if (!rec) return null;
      rec.reuse.unshift({ tenant: stat.tenant, deploy: stat.deploy, ver: stat.ver, at: (now() || '').slice(0, 10), how: stat.how });
      rec.log.unshift({ at: now(), who: '系统', what: '入库 ' + stat.blocks + ' 个样品块 · ' + stat.rows + ' 行数据' });
      rec.recent = 'import'; save(); return rec;
    },
    /* 供演示：把当前会话的拆解结果整体写进库 */
    syncFromWorkbench: function (code, info) {
      var rec = touch(code); if (!rec) return null;
      rec.cover = info.cover; rec.stats = info.stats;
      save(); return rec;
    },
    clear: function () { try { localStorage.removeItem(STORAGE_KEY); } catch (e) { } DB = load(); save(); },
    esc: esc
  };
  global.STDLib = STDLib;
})(window);
