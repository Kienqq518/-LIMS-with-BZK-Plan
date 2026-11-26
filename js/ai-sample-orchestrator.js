/**
 * 对话优先：意图识别 + 跨阶段编排（F2 补丁 → D0 预检 → F3 重放）
 * 依据 docs/ai-workbench-page-design-v0.1.md 第九节。
 * 地基：系统数据只能由 F3 从稿件写入；不存在第三条写库路径。
 */
(function (global) {
  'use strict';
  var esc = function (v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var PLANS = {}, seq = 0;

  /* ── 意图分类 ── */
  function classify(t) {
    var s = String(t || '').trim();
    if (/^(上传|拆一下|生成初版|帮我拆)/.test(s) || /能力表|标准文件/.test(s)) return '生成';
    if (/直接改库|别绕了|直接改系统|不走稿件|绕过稿件/.test(s)) return '直改库';
    if (/^(入库|落到系统|可以入库|执行入库|写库)/.test(s) || /入库吧|入库了/.test(s)) return '入库';
    if (/^(这版定了|定稿|锁版本)/.test(s)) return '定稿';
    if (/^(为什么|为何|怎么是|凭什么)/.test(s) || /哪些还没确认|哪些没答/.test(s)) return '查询解释';
    if (/应该用|建议改成|这类都用|以后都按|规则不对|契约/.test(s)) return '契约算法';
    if (/改成|改为|调成|换成|修正|写错了|漏了|补一个|删掉/.test(s)) return /已入库|系统里|落库后|库里的|线上数据/.test(s) ? '改已入库' : '改稿';
    return '其他';
  }

  /* ── 把话术编译成稿件补丁（定位到 sheet · 行键 · 列）── */
  function toPatches(s) {
    var out = [], seed = global.SHEET_SEED;
    if (!seed) return out;
    var m = s.match(/(.+?)(?:的|，|,)(?:标称值|参数|列)?(.{0,10}?)?\s*(?:改成|改为|调成|换成)\s*([^\s，。,]+)/);
    var target = m ? m[1] : '', col = (m && m[2]) || '', val = m ? m[3] : '';
    var rows = seed['90_标称值'].rows;
    var hit = rows.filter(function (r) {
      if (!target) return false;
      return (r['标称值名称'] && target.indexOf(r['标称值名称']) >= 0) ||
        (r['标称值键'] && target.toUpperCase().indexOf(r['标称值键']) >= 0) ||
        (target.indexOf(r['符号'] || '@@') >= 0);
    });
    if (!hit.length && target) {
      hit = rows.filter(function (r) {
        return r['标称值名称'] && (r['标称值名称'].indexOf(target.slice(-4)) >= 0 || target.indexOf(r['标称值名称'].slice(0, 3)) >= 0);
      });
    }
    var multi = 0;
    hit.forEach(function (r) {
      var c = /最小值|下限/.test(col + target) ? '最小值' : /最大值|上限/.test(col + target) ? '最大值' :
        /公差|偏差/.test(col + target) ? '正偏差' : '单值';
      if (String(r['多行映射'] || '') === '是') { multi++; return; }   // 值在 61，不在 90
      if (String(r[c] || '') === String(val)) return;
      out.push({ sheet: '90_标称值', row: r['标称值键'], col: c, from: r[c] || '∅', to: val,
        name: r['标称值名称'], test: r['试验项键'] });
    });
    out.multiHit = multi;
    return out;
  }

  /* ── 编排计划 ── */
  function plan(intent, text) {
    var id = 'P' + (++seq);
    var p = { id: id, intent: intent, text: text, steps: [], patches: [], blocks: [], needConfirm: true, done: false };
    if (intent === '改稿' || intent === '改已入库') {
      p.patches = toPatches(text);
      if (!p.patches.length) {
        p.kind = 'clarify';
        p.why = p.patches.multiHit || 0;
        p.steps = [{ k: '定位', t: p.patches.multiHit
          ? '命中的标称值是「多行映射」，值存在 61_映射明细 的对应行里，不在 90 的标量列'
          : '没能在稿件里定位到这条数据', state: 'blocked' }];
        return p;
      }
      p.blocks = uniq(p.patches.map(function (x) { return String(x.test || '').split('-')[0]; }));
      p.steps = [
        { k: '定位', t: '解析出 ' + p.patches.length + ' 处稿件补丁', state: 'ready' },
        { k: 'F2', t: '写进稿件，生成新版本 v' + (nextVer()) + '-draft（旧版本保留可对比）', state: 'ready' },
        { k: 'D0', t: '重跑 34 条校验；真缺陷≠0 就停住并把冲突转成问题', state: 'ready' },
      ];
      if (intent === '改已入库') {
        p.steps.push({ k: 'F3', t: '只重放受影响的 ' + p.blocks.length + ' 个样品块（' + p.blocks.join(' / ') +
          '），一块一事务，失败回滚本块', state: 'ready' });
      } else {
        p.steps.push({ k: 'F3', t: '数据尚未入库，本次不触发入库', state: 'skip' });
      }
      p.kind = 'patch';
      return p;
    }
    if (intent === '入库') {
      p.steps = [
        { k: 'D0', t: '整包预检（34 条规则）', state: 'ready' },
        { k: 'F3', t: '按样品分块入库，2 块', state: 'ready' }];
      p.kind = 'import';
      return p;
    }
    if (intent === '定稿') {
      p.steps = [{ k: 'F2', t: '锁定当前稿件为 v' + nextVer() + '-final，不可变；再改需开新版本', state: 'ready' }];
      p.kind = 'finalize';
      return p;
    }
    if (intent === '直改库') {
      p.kind = 'refuse'; p.needConfirm = false;
      p.steps = [{ k: '拒绝', t: '不直接写库', state: 'blocked' }];
      return p;
    }
    if (intent === '契约算法') {
      p.kind = 'contract'; p.needConfirm = false;
      p.steps = [{ k: '记录', t: '契约变更建议已记给实施侧评估', state: 'done' }];
      return p;
    }
    if (intent === '查询解释') {
      p.kind = 'read'; p.needConfirm = false;
      p.steps = [{ k: '只读', t: '走溯源，不产生任何写操作', state: 'done' }];
      return p;
    }
    p.kind = 'unknown'; p.needConfirm = false;
    p.steps = [{ k: '澄清', t: '没识别出要做什么', state: 'blocked' }];
    return p;
  }
  function uniq(a) { var m = {}; return a.filter(function (x) { return m[x] ? false : (m[x] = 1); }); }
  function nextVer() { var st = WB.state ? 1 : 1; return (global.ORCver || 1) + 1; }

  /* ── 渲染 ── */
  function renderPlan(p) {
    var rows = p.patches.slice(0, 6).map(function (x) {
      return '<tr><td>' + esc(x.sheet) + '</td><td><code>' + esc(x.row) + '</code></td><td>' + esc(x.col) +
        '</td><td class="old">' + esc(x.from) + '</td><td class="new">' + esc(x.to) + '</td></tr>';
    }).join('');
    return '<div class="orc-plan" id="plan_' + p.id + '">' +
      '<div class="ph"><span class="it">' + esc(p.intent) + '</span>' +
      '<b>' + esc(titleOf(p)) + '</b>' + (p.done ? '<span class="dn">已执行</span>'
        : p.rolled ? '<span class="ro">已回滚</span>'
        : p.needConfirm ? '<span class="cf">需确认</span>' : '<span class="ro">无需确认</span>') + '</div>' +
      p.steps.map(function (s, i) {
        var cls = s.state + (s.res ? ' ok' : s.failed ? ' bad' : '');
        return '<div class="st ' + cls + '" data-i="' + i + '"><span class="ix">' + (i + 1) + '</span>' +
          '<span class="kk">' + esc(s.k) + '</span><span class="tx">' + esc(s.t) + '</span>' +
          '<span class="rs">' + esc(s.res || (s.failed ? '已中止' : '')) + '</span></div>';
      }).join('') +
      (rows ? '<div class="dif"><div class="dh">稿件补丁 ' + p.patches.length + ' 处' +
        (p.patches.length > 6 ? '（显示前 6 条）' : '') + '</div><table><tr><th>sheet</th><th>行键</th><th>列</th><th>现值</th><th>改为</th></tr>' + rows + '</table></div>' : '') +
      actions(p) + '</div>';
  }
  function titleOf(p) {
    if (p.kind === 'patch') return p.intent === '改已入库' ? '改已入库数据：走「稿件补丁 → 预检 → 重放入库」' : '改稿件：写补丁并重跑校验';
    if (p.kind === 'import') return '入库：预检通过后按样品块写入系统';
    if (p.kind === 'finalize') return '定稿：锁定稿件版本';
    if (p.kind === 'refuse') return '这个请求我不能照做';
    if (p.kind === 'contract') return '这是契约层面的建议，不在本次会话里生效';
    if (p.kind === 'read') return '只读解释';
    if (p.kind === 'clarify') return p.why ? '多行映射要指明档位，不能整列覆盖' : '没定位到要改哪条数据';
    return '没识别出要做什么';
  }
  function actions(p) {
    if (p.kind === 'unknown') {
      return '<div class="why">这句话我落不到具体动作上。说清楚<b>改哪条、改成什么</b>，或<b>要不要入库</b>，我就能给你编排计划。</div>' +
        '<div class="ops"><span class="tip">未做任何操作</span></div>';
    }
    if (p.kind === 'refuse') {
      return '<div class="why"><b>唯一真源原则</b>：系统里的样品/型号/试验项数据只能由 F3 从稿件写入。' +
        '直接改库会让稿件和库分叉，下次重新拆解或复用标准成果时，你改的东西会无声消失。<br>' +
        '想省事可以<b>一次确认跑完全程</b>（稿件补丁 → 预检 → 重放），而不是绕过稿件。</div>' +
        '<div class="ops"><button class="btn-save" onclick="ORC.fast(\'' + p.id + '\')">一次确认跑完全程</button>' +
        '<button class="btn-outline" onclick="ORC.drop(\'' + p.id + '\')">算了，不改</button></div>';
    }
    if (p.kind === 'contract') {
      return '<div class="why">已生成契约变更建议（记给实施侧评估）。客户档会话里不直接改拆解规则——' +
        '否则同一个标准在不同客户环境会长出不同的数据结构，复用就废了。</div>' +
        '<div class="ops"><button class="btn-outline" onclick="ORC.drop(\'' + p.id + '\')">知道了</button></div>';
    }
    if (p.kind === 'clarify') {
      return '<div class="why">' + (p.why
        ? '命中的 ' + p.why + ' 条标称值开了<b>多行映射</b>，它们的值在 <code>61_映射明细</code> 的对应数据行里，' +
          '不在 <code>90_标称值</code> 的标量列。直接写 90 会造成两处不一致，F3 重放时会被校验拦下。' +
          '请指明档位，例如「环刚度下限 SN24 改成 25」。'
        : '我可以按名称找，但你这句话里能定位的候选有歧义。告诉我更准的落点，或者直接点「去表格里选」。') + '</div>' +
        '<div class="ops"><button class="btn-outline" onclick="ORC.gotoF2()">去 F2 表格里选</button>' +
        '<button class="btn-outline" onclick="ORC.drop(\'' + p.id + '\')">取消</button></div>';
    }
    if (p.rolled) return '<div class="ops"><span class="tip">已回滚，稿件回到补丁前</span></div>';
    if (p.kind === 'read') return '';
    if (p.done && !p.rolled) return '<div class="ops"><span class="ok2"><i class="fa fa-check-circle"></i> 已执行完成</span>' +
      (p.patches && p.patches.length ? '<button class="btn-outline" onclick="ORC.showDiff(\'' + p.id + '\')">看改动明细</button>' : '') +
      '<button class="btn-outline" onclick="ORC.rollback(\'' + p.id + '\')">回滚这次编排</button></div>';
    return '<div class="ops"><button class="btn-save" onclick="ORC.exec(\'' + p.id + '\')">确认执行</button>' +
      '<button class="btn-outline" onclick="ORC.drop(\'' + p.id + '\')">取消</button>' +
      '<span class="tip">未确认前不落任何写操作</span></div>';
  }

  /* ── 执行 ── */
  function exec(id) {
    var p = PLANS[id]; if (!p || p.running) return;
    p.running = 1;
    var nodes = document.querySelectorAll('#plan_' + id + ' .st');
    var i = 0;
    function step() {
      if (i > 0) mark(p, nodes, i - 1);
      if (i >= p.steps.length) { finish(p); return; }
      nodes[i].classList.add('run');
      if (p.steps[i].k === 'F2' && p.patches.length) { applyPatches(p); if (WB.markGenerated) WB.markGenerated(); }
      if (p.steps[i].k === 'F3' && p.steps[i].state !== 'skip') jump('f3');
      if (p.steps[i].k === 'D0') jump('f2');
      i++; setTimeout(step, 720);
    }
    step();
  }
  function mark(p, nodes, i) {
    var s = p.steps[i], n = nodes[i];
    if (n) n.classList.remove('run');
    if (s.state === 'skip') { s.res = '跳过'; if (n) n.classList.add('skip'); return; }
    s.res = s.k === '定位' ? p.patches.length + ' 处' :
      s.k === 'F2' ? 'v' + (global.ORCver = (global.ORCver || 1) + 1) + '-draft' :
      s.k === 'D0' ? '真缺陷 0 · 通过' : (p.blocks.length || 2) + ' 块已重放';
    if (n) { n.classList.add('ok'); n.querySelector('.rs').textContent = s.res; }
  }
  function applyPatches(p) {
    p.patches.forEach(function (x) {
      var rs = SHEET_SEED[x.sheet].rows;
      for (var i = 0; i < rs.length; i++) {
        if (rs[i][x.sheet === '90_标称值' ? '标称值键' : '试验项键'] === x.row) {
          F2.applyExternal(i, x.col, x.to); break;
        }
      }
    });
  }
  function jump(stage) { if (WB.stage) WB.stage(stage); }
  function finish(p) {
    p.done = 1; p.running = 0;
    // 版本号在最后一步才落定，这里再刷一次顶栏，避免显示成补丁前的版本
    if (WB.markGenerated && (p.kind === 'patch' || p.kind === 'import')) WB.markGenerated();
    // 版本号在最后一步才落定，这里再刷一次顶栏，避免显示成补丁前的版本
    if (WB.markGenerated && (p.kind === 'patch' || p.kind === 'import')) WB.markGenerated();
    // 对话流存的是 HTML 字符串：卡片状态必须回写进那条消息，否则重绘时会退回「需确认」
    var html = '识别意图：<b>' + esc(p.intent) + '</b>' + renderPlan(p);
    if (WB.replaceChat) WB.replaceChat('plan_' + p.id, html);
    WB.say('sys', '系统', traceText(p));
  }
  function traceText(p) {
    if (p.kind === 'import') return '<b>入库完成</b>：预检通过，2 个样品块写入系统，未触发回滚。';
    if (p.kind === 'finalize') return '<b>稿件已定稿</b>，版本不可变；再改会自动开新版本。';
    if (p.intent === '改已入库') {
      return '<b>改已入库数据完成</b>：' + p.patches.length + ' 处补丁写入稿件 → 预检通过 → 重放 ' +
        p.blocks.length + ' 个样品块。全程留痕，可回放可回滚。';
    }
    return '<b>稿件补丁已生效</b>：' + p.patches.length + ' 处写入新版本稿件，预检通过。数据尚未入库，入库时再走 F3。';
  }

  var ORC = {
    ask: function (text) {
      var it = classify(text);
      var p = plan(it, text);
      PLANS[p.id] = p;
      WB.say('me', '你', esc(text));
      WB.say('ai', 'AI 助手', '识别意图：<b>' + esc(it) + '</b>' + (it === '改已入库' ? '（数据已入库，必须走稿件再重放）' : '') + renderPlan(p));
      if (it === '查询解释') explain(text);
      if (it === '其他') {
        WB.say('ai', 'AI 助手', '说具体点我才能动手，比如：<br>「把 环刚度下限 的最小值改成 25」→ 改稿件<br>' +
          '「系统里 SN24 那条是错的，改成 25」→ 改已入库（稿件补丁+重放）<br>「可以入库了」→ 入库<br>「这版定了」→ 定稿');
      }
      return p.id;
    },
    exec: function (id) { exec(id); },
    fast: function (id) {
      var p = PLANS[id];
      p.intent = (WB.state && WB.imported && WB.imported()) ? '改已入库' : '改稿';
      WB.say('ai', 'AI 助手', '那按等价快捷走：一次确认跑完 <b>稿件补丁 → 预检 → 重放</b>，但顺序不能省。' + renderPlan(p));
    },
    drop: function (id) {
      var el = document.getElementById('plan_' + id);
      if (el) el.innerHTML = '<div class="ph"><span class="it">已取消</span><b>未做任何改动</b></div>';
    },
    showDiff: function (id) {
      var p = PLANS[id];
      if (p.patches && p.patches.length) { F2.showExternalDiff(p.patches); jump('f2'); }
      WB.say('sys', '系统', '已在 F2 标出这 ' + (p.patches || []).length + ' 处改动。');
    },
    rollback: function (id) {
      var p = PLANS[id]; if (!p || !p.patches || !p.patches.length) return;
      p.patches.forEach(function (x) {
        var rs = SHEET_SEED[x.sheet].rows;
        for (var i = 0; i < rs.length; i++) {
          if (rs[i][x.sheet === '90_标称值' ? '标称值键' : '试验项键'] === x.row) {
            delete F2.state().edits[x.sheet + '|' + i + '|' + x.col]; break;
          }
        }
      });
      p.done = 0; p.rolled = 1;
      if (WB.replaceChat) WB.replaceChat('plan_' + p.id, '识别意图：<b>' + esc(p.intent) + '</b>' + renderPlan(p));
      WB.say('sys', '系统', '已回滚这次编排的 ' + p.patches.length + ' 处稿件补丁。库内数据未受影响——本来就没有第二条写库路径。');
      if (WB.stage) WB.stage('f2');
    },
    gotoF2: function () { jump('f2'); WB.say('sys', '系统', '已切到 F2 表格，选中一行后可以直接改，改完我会接着走预检。'); },
    quick: function (el) { ORC.ask(el.textContent); },
    classify: classify, plan: plan
  };
  function explain(text) {
    var m = /标灰|灰色|为什么.*(灰|标灰)/.test(text);
    if (m) WB.say('ai', 'AI 助手', '标灰 = <b>已跳过</b>：数据按 AI 当前最优猜测占位，' +
      '不阻塞出稿也不阻塞定稿，但 F3 入库前会再问你一次（V24）。范围级问题不给跳过，因为它决定输出结构。');
    else WB.say('ai', 'AI 助手', '还没确认 ' + (WB.unanswered ? WB.unanswered() : 0) +
      ' 条；其中范围级 ' + (WB.scopeLeft ? WB.scopeLeft() : 0) + ' 条是必答项。点顶部「F1 · 问题收件箱」逐条处理，或用批量指令一次覆盖一类。');
  }
  global.ORC = ORC;
})(window);
