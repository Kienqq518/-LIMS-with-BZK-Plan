/**
 * 标准文件库：三层结构（元数据 / 文件本体 / 拆解成果）的管理界面
 * 依据 docs/standard-file-library-design-v0.1.md 第四节。
 * 数据 = DS 实壁类塑料电缆导管稿件 51_试验依据 抽出的真实标准清单。
 */
(function (global) {
  'use strict';
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var TABS = ['元数据', '文件本体', '拆解成果', '引用与复用', '变更记录'];
  var ST = { list: [], q: '', fs: '全部', ft: '全部', sel: 0, tab: 0 };

  function hash(code) {
    var h = 0, s = 'std:' + code;
    for (var i = 0; i < s.length; i++) h = (h * 131 + s.charCodeAt(i)) >>> 0;
    return h.toString(16).slice(0, 8) + (h % 97).toString(16).padStart(2, '0');
  }
  function norm(code) {   // 规范化：全角破折号→半角，机构前缀补空格
    return String(code).replace(/[—–]/g, '-').replace(/／/g, '/')
      .replace(/^([A-Z]{2,4})\s*\/\s*([A-Z])/, '$1/$2').replace(/([A-Z/]{2,6})(\d)/, '$1 $2');
  }

  function filtered() {
    return ST.list.filter(function (x) {
      if (ST.fs !== '全部' && x.status !== ST.fs) return false;
      if (ST.ft === '已拆解' && !x.derived) return false;
      if (ST.ft === '未拆解' && x.derived) return false;
      if (ST.ft !== '全部' && ST.ft !== '已拆解' && ST.ft !== '未拆解' && x.prefix.indexOf(ST.ft) < 0) return false;
      if (ST.q) {
        var q = ST.q.toLowerCase();
        if (x.disp.toLowerCase().indexOf(q) < 0 && x.title.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function renderList() {
    var f = filtered();
    document.getElementById('slCount').innerHTML =
      '共 <b>' + ST.list.length + '</b> 份 · 已拆解 <b class="ok">' +
      ST.list.filter(function (x) { return x.derived; }).length + '</b> 份 · 本次筛选 <b>' + f.length + '</b>';
    document.getElementById('slList').innerHTML = f.map(function (x, i) {
      var real = ST.list.indexOf(x);
      return '<div class="sl-i' + (real === ST.sel ? ' on' : '') + '" onclick="SL.sel(' + real + ')">' +
        '<div class="c">' + esc(x.disp) + '</div><div class="t">' + esc(x.title) + '</div>' +
        '<div class="m"><span class="rl ' + (x.role === '总标准' ? 'g' : x.role === '子标准' ? 'z' : 'f') + '">' + esc(x.role) + '</span>' +
        '<span class="st">' + esc(x.status) + '</span>' +
        '<span class="dv">' + (x.derived ? '已拆解 v3-final' : '未拆解') + '</span>' +
        '<span class="rf">' + x.refs + ' 引用</span></div></div>';
    }).join('') || '<div class="sl-e">没有命中。换个关键词，或点右上「上传标准文件」新增一份。</div>';
  }

  /* ── 详情 ── */
  function renderDetail() {
    var x = ST.list[ST.sel];
    document.getElementById('slTabs').innerHTML = TABS.map(function (t, i) {
      return '<span class="' + (i === ST.tab ? 'on' : '') + '" onclick="SL.tab(' + i + ')">' + t +
        (i === 2 && x.derived ? '<small>有成果</small>' : '') + '</span>';
    }).join('');
    var el = document.getElementById('slBody');
    el.innerHTML = [meta, blob, derived, reuse, changelog][ST.tab](x);
    el.scrollTop = 0;
  }
  function kv(k, v, note) {
    return '<div class="kv"><span>' + k + '</span><b>' + v + '</b>' + (note ? '<i>' + note + '</i>' : '') + '</div>';
  }
  function meta(x) {
    return '<div class="sec"><h5>身份键（从正文识别，不用文件名，不用正则猜文件名）</h5>' +
      kv('规范化编号', '<code>' + esc(norm(x.code)) + '</code>') +
      kv('机构前缀 / 序号 / 年号', '<code>' + esc(x.prefix) + '</code> / <code>' +
        esc((x.code.match(/[\d.]+/) || [''])[0]) + '</code> / <code>' + esc(x.year || '—') + '</code>') +
      kv('标准名称', esc(x.title)) +
      kv('层级角色', esc(x.role), x.role === '总标准' ? '集合型：只建分类节点，不直接产数据' : '') +
      kv('状态', esc(x.status)) + '</div>' +
      '<div class="sec"><h5>代替关系</h5><div class="tl">' +
      (x.derived ? '<div class="ti cur"><b>' + esc(x.disp) + '</b><span>现行 · 本库已存档并拆解</span></div>' +
        '<div class="ti"><b>' + esc(x.disp.replace(/\d{4}$/, '—')) + '旧版</b><span>被代替 · 废止标准仍可选作检测依据（样品按旧标准生产时）</span></div>'
        : '<div class="ti cur"><b>' + esc(x.disp) + '</b><span>现行</span></div>' +
          '<div class="ti warn"><b>代替关系未确认</b><span>正文未写明，且未经官方目录核对 ⇒ 留空不猜。' +
          '需要时点「去核对」，确认后写入元数据并留痕。</span></div>') +
      '</div><button class="btn-outline" onclick="SL.toast(\'已生成元数据核对任务，指派给实施侧（原型演示）\')">去核对代替关系</button></div>' +
      '<div class="sec"><h5>被引用条款</h5><div class="cls">' +
      (x.clauses.length ? x.clauses.map(function (c) { return '<code>' + esc(c) + '</code>'; }).join('') : '<span class="mut">稿件未记录条款号</span>') +
      '</span></div></div>';
  }
  function blob(x) {
    return '<div class="sec"><h5>本客户可见的文件本体</h5>' +
      kv('文件名', '<code>' + esc(x.disp.replace(/ /g, '') + '.pdf') + '</code>') +
      kv('内容 hash', '<code>' + esc(hash(x.code)) + '…</code>', 'hash 相同直接判定同一份，跳过正文识别') +
      kv('页数 / 文本层质量', x.pages + ' 页 · <b class="' + (x.text_quality > 0.9 ? 'ok' : 'warn') + '">' +
        Math.round(x.text_quality * 100) + '%</b>', x.text_quality > 0.9 ? '可直接解析' : '扫描件置信度低，值降级为未验证') +
      kv('上传人 / 时间', '张工（迈特诺检测中心） · 2026-10-12 14:22') + '</div>' +
      '<div class="sec warnbox"><h5><i class="fa fa-lock"></i> 共享边界</h5>' +
      '<div class="r">元数据与拆解成果 <b>全局共享</b>；<b>文件本体按客户隔离</b>——别人命中这份标准时看到的是：</div>' +
      '<div class="quote">库里已有 ' + esc(x.disp) + '（元数据 + 拆解成果 v3-final）。' +
      '请上传你自己的副本，或申请获取。</div>' +
      '<div class="r">去重收益的大头来自元数据 + 拆解成果，不是那几 MB PDF，所以这样几乎不损失什么，却把跨客户看原文的合规风险摘干净了。</div></div>';
  }
  function derived(x) {
    if (!x.derived) {
      return '<div class="sec"><h5>拆解成果</h5><div class="empty">' +
        '这份标准还没被拆解过。<br>它是<b>方法标准</b>，通常不单独产生样品数据任务——' +
        '它作为试验项的「试验依据」挂在产品标准的试验项上。<br><br>' +
        '<button class="btn-save" onclick="SL.toast(\'已发起拆解任务（原型演示）\')">发起拆解</button></div></div>';
    }
    return '<div class="sec"><h5>拆解成果 <span class="v">v3-final</span><span class="lock"><i class="fa fa-lock"></i> 定稿不可变</span></h5>' +
      kv('稿件', '<code>DLT-802.3-2023_v3-final.xlsx</code> · 22 张 sheet') +
      kv('覆盖', '2 个样品 / 8 个型号 / 16 个试验项 / 166 个参数 / 42 条判定条件') +
      kv('定稿人 / 时间', '李工（业务专家） · 2026-10-12 18:05') +
      kv('预检', '真缺陷 0 · 阻断 0 · 告警 36') + '</div>' +
      '<div class="sec"><h5>校稿时问答过的范围级问题（下次直接跳过）</h5>' +
      '<div class="qa"><div><b>型号挂在哪个样品下？</b><span>答：每个样品各自一套型号，同名互不隶属</span></div>' +
      '<div><b>环刚度 2 套配置 vs 4 个型号怎么对齐？</b><span>答：按型号各拆一条，多余配置丢弃</span></div>' +
      '<div><b>802.1 要不要单独建任务？</b><span>答：不建，只建分类节点</span></div></div></div>' +
      '<div class="sec"><h5>版本</h5><div class="vers">' +
      ['v3-final · 定稿 · 2 处计数型判定待第 8 项迭代后重拆', 'v2-review · 校稿中快照', 'v1-draft · AI 初稿（89 条待定项）'].map(function (t, i) {
        return '<div class="vr' + (i === 0 ? ' cur' : '') + '"><i class="fa fa-circle-dot"></i><span>' + esc(t) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="acts"><button class="btn-save" onclick="SL.toast(\'已以此成果发起新任务（复用拆解成果，只重算你们实验室的能力裁剪）\')">以此拆解新任务</button>' +
      '<button class="btn-outline" onclick="SL.toast(\'打开两个稿件版本的差异对比（原型演示）\')">对比版本</button>' +
      '<button class="btn-outline" onclick="SL.toast(\'已下载 v3-final 稿件（22 sheet）\')">下载稿件</button></div></div>';
  }
  function reuse(x) {
    var rows = x.derived ? [
      ['迈特诺技术股份有限公司检测中心', '云部署', 'v3-final', '2026-10-12', '首次拆解'],
      ['某省级电力物资检测中心', '云部署', 'v3-final', '2026-11-03', '复用成果，仅裁剪量程'],
      ['某电缆集团实验室', '私有化', 'v3-final', '2026-11-18', '复用成果 + 2 处人工改动']
    ] : [[x.prefix + ' 相关客户', '—', '—', '—', '尚无引用']];
    return '<div class="sec"><h5>引用与复用</h5>' +
      '<table class="sl-tbl"><tr><th>客户 / 环境</th><th>部署</th><th>引用成果版本</th><th>时间</th><th>方式</th></tr>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</table></div>' +
      '<div class="sec"><h5>复利指标</h5>' +
      kv('标准族复用命中次数', '<b class="ok">' + (x.derived ? 2 : 0) + '</b>', '这个产品能不能形成复利的唯一指标') +
      kv('第二次拆解节省', x.derived ? '约 85%（跳过 OCR 与结构拆解，只做能力裁剪）' : '—') + '</div>';
  }
  function changelog(x) {
    var items = [['2026-10-12 14:22', '张工', '上传文件本体，正文识别出编号 ' + x.disp],
      ['2026-10-12 15:40', 'AI 助手', '拆解产出 v1-draft，89 条待定项'],
    ];
    if (x.derived) items.push(['2026-10-12 18:05', '李工', '定稿 v3-final，锁定']);
    items.push(['2026-11-03 09:12', '系统', '被「某省级电力物资检测中心」复用（命中元数据 + 成果）']);
    return '<div class="sec"><h5>变更记录</h5><div class="log">' +
      items.map(function (r) {
        return '<div class="lg"><code>' + esc(r[0]) + '</code><b>' + esc(r[1]) + '</b><span>' + esc(r[2]) + '</span></div>';
      }).join('') + '</div></div>' +
      '<div class="sec"><h5>治理规则</h5><div class="r">' +
      '① 定稿成果不可变，改动 = 新版本；引用方显示所引用的具体版本号。<br>' +
      '② 编号与年号来自正文识别，人工改动会留痕并触发重新比对。<br>' +
      '③ 客户上传的"同一标准"若内容 hash 不同（删减版/翻译版）⇒ 不合并文件本体，只共享元数据，' +
      '复用时提示逐条对比。<br>' +
      '④ 废止标准不限制被选作检测依据，只在选中时给非阻断提示并记录确认人。</div></div>';
  }

  var SL = {
    init: function (list) {
      ST.list = list.map(function (x) {
        x.disp = norm(x.code); x.clauses = x.clauses || []; return x;
      });
      ST.list.sort(function (a, b) { return (b.derived - a.derived) || a.code.localeCompare(b.code); });
      renderList(); renderDetail();
    },
    sel: function (i) { ST.sel = i; ST.tab = 0; renderList(); renderDetail(); },
    tab: function (i) { ST.tab = i; renderDetail(); },
    search: function (v) { ST.q = v; renderList(); },
    filt: function (kind, v) { if (kind === 's') ST.fs = v; else ST.ft = v; renderList(); },
    toast: function (m) {
      var t = document.getElementById('slToast');
      t.textContent = m; t.classList.add('show');
      clearTimeout(SL._t); SL._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
    }
  };
  global.SL = SL;
})(window);
