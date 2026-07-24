#!/usr/bin/env python3
"""Patch seminar deck: core caps, Wuhai/Jialian tables, contrast, edit/save."""
from pathlib import Path
import re

path = Path("/workspace/ppt/index.html")
text = path.read_text()

# ---------- CSS: projection contrast + edit toolbar ----------
CSS = r'''
  /* ===== Projection contrast: avoid washed-out white text ===== */
  body.proj-safe .slide.dark,
  body.proj-safe .slide.accent{
    background:var(--paper)!important;color:var(--ink)!important;
  }
  body.proj-safe .slide.dark .canvas-card,
  body.proj-safe .slide.accent .canvas-card{
    background:var(--paper)!important;color:var(--ink)!important;
  }
  body.proj-safe .slide.dark .chrome-min,
  body.proj-safe .slide.accent .chrome-min,
  body.proj-safe .slide.dark .t-meta,
  body.proj-safe .slide.accent .t-meta,
  body.proj-safe .slide.dark .t-cat,
  body.proj-safe .slide.accent .t-cat{
    color:var(--text-helper)!important;
  }
  body.proj-safe .slide.dark .h-statement,
  body.proj-safe .slide.accent h1,
  body.proj-safe .slide.accent h2,
  body.proj-safe .slide.dark h1,
  body.proj-safe .slide.dark h2{
    color:var(--ink)!important;
  }
  body.proj-safe .slide.dark p,
  body.proj-safe .slide.accent p,
  body.proj-safe .slide.dark .lead,
  body.proj-safe .slide.accent .lead{
    color:var(--text-secondary)!important;
  }
  body.proj-safe .hero-ink-col{
    background:var(--grey-1)!important;color:var(--ink)!important;border:1px solid var(--border-subtle);
  }
  body.proj-safe .hero-ink-col .t-cat,
  body.proj-safe .hero-ink-col h2,
  body.proj-safe .hero-ink-col p{color:var(--ink)!important}
  body.proj-safe .hero-ink-col p{color:var(--text-secondary)!important}
  body.proj-safe .ink-banner-full{
    background:var(--grey-1)!important;color:var(--ink)!important;border-top:2px solid var(--accent);
  }
  body.proj-safe .ink-banner-full div{color:var(--ink)!important}
  body.proj-safe .card-accent,
  body.proj-safe .brief-card.is-accent,
  body.proj-safe .sub-card.card-accent,
  body.proj-safe .tag-pill.pick,
  body.proj-safe .pm-cell.pick{
    background:rgba(var(--accent-rgb),.08)!important;
    color:var(--ink)!important;
    border:1px solid rgba(var(--accent-rgb),.35)!important;
  }
  body.proj-safe .card-accent .force-num,
  body.proj-safe .card-accent h4,
  body.proj-safe .card-accent p,
  body.proj-safe .brief-card.is-accent .bc-main,
  body.proj-safe .brief-card.is-accent .bc-note,
  body.proj-safe .sub-card.card-accent .big-num,
  body.proj-safe .sub-card.card-accent h4,
  body.proj-safe .sub-card.card-accent p,
  body.proj-safe .pm-cell.pick span{
    color:var(--ink)!important;
  }
  body.proj-safe .half.b-accent{
    background:var(--grey-1)!important;color:var(--ink)!important;
  }
  body.proj-safe .half.b-accent .t-meta,
  body.proj-safe .half.b-accent h2,
  body.proj-safe .half.b-accent div{color:var(--ink)!important}
  body.proj-safe .ascii-bg{opacity:.12!important;filter:none!important}
  body.proj-safe .swiss-tbl th{background:var(--ink);color:#fff} /* header stays dark block */

  /* denser tables for gap slides */
  .swiss-tbl.dense{font-size:max(13px,.82vw)}
  .swiss-tbl.dense th{padding:.7vh .7vw}
  .swiss-tbl.dense td{padding:.55vh .7vw;line-height:1.35}
  .swiss-tbl .st-ok{color:#0a5c2e;font-weight:600}
  .swiss-tbl .st-part{color:#7a5c1a;font-weight:600}
  .swiss-tbl .st-miss{color:#8b3030;font-weight:600}
  .swiss-tbl .stars{letter-spacing:.06em;font-weight:600;color:var(--ink)}
  .call-note{margin-top:1vh;padding:1.2vh 1.2vw;background:var(--grey-1);border-left:3px solid var(--accent);font-size:max(14px,.9vw);line-height:1.45;color:var(--text-secondary)}
  .call-note b{color:var(--ink);font-weight:600}

  /* ===== Edit / Save toolbar ===== */
  #edit-bar{
    position:fixed;top:12px;left:50%;transform:translateX(-50%);
    z-index:9999;display:flex;gap:8px;align-items:center;
    background:rgba(250,250,248,.96);border:1px solid #d4d4d2;
    padding:8px 12px;box-shadow:0 4px 18px rgba(0,0,0,.08);
    font-family:var(--sans),var(--sans-zh);font-size:13px;font-weight:500;
  }
  #edit-bar button{
    border:1px solid #d4d4d2;background:#fff;color:#0a0a0a;
    padding:6px 12px;cursor:pointer;font:inherit;letter-spacing:.02em;
  }
  #edit-bar button:hover{border-color:#002FA7;color:#002FA7}
  #edit-bar button.on{background:#002FA7;color:#fff;border-color:#002FA7}
  #edit-bar .sep{width:1px;height:18px;background:#d4d4d2}
  #edit-bar .hint{color:#737373;font-size:12px;max-width:28vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  body.editing [contenteditable="true"]{
    outline:1px dashed rgba(0,47,167,.35);outline-offset:2px;cursor:text;
  }
  body.editing [contenteditable="true"]:focus{
    outline:2px solid #002FA7;background:rgba(0,47,167,.04);
  }
  @media print{#edit-bar{display:none!important}}
'''

if "Projection contrast: avoid washed-out white text" not in text:
    # insert before last seminar extras or before </style> preceding slides
    marker = "  /* ===== Seminar extras"
    if marker in text:
        text = text.replace(marker, CSS + "\n" + marker, 1)
    else:
        idx = text.find("</style>")
        text = text[:idx] + CSS + "\n" + text[idx:]

# Enable proj-safe by default on body
text = text.replace("<body>", '<body class="proj-safe">', 1)
if 'class="proj-safe"' not in text and "<body" in text:
    text = re.sub(r"<body([^>]*)>", r'<body\1 class="proj-safe">', text, count=1)
    text = text.replace('class="proj-safe" class="proj-safe"', 'class="proj-safe"')

# ---------- New slides HTML ----------
CAP_SLIDE = r'''
<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="已具备核心能力">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">数蚕智能 · 产品定位研讨会</div>
      <div class="r">CAPABILITY</div>
    </div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr auto;gap:1.4vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.6vh">
        <div class="t-meta">04 · CORE CAPABILITY</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.8vw,6.8vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">已具备的核心能力（电力检测验证）</h2>
        <p style="font-size:max(15px,.98vw);color:var(--text-secondary);line-height:1.45">委托→样品→检测→报告主线在电力场景已验证；可视化与跨行业资源合规仍是短板</p>
      </div>
      <div class="tbl-wrap">
        <table class="swiss-tbl dense">
          <thead><tr><th style="width:14%">模块域</th><th>已有能力</th><th style="width:12%">成熟度</th></tr></thead>
          <tbody>
            <tr><td>委托与任务</td><td>委托登记、任务计划、委托确认、任务撤销 / 批量导入</td><td class="stars">★★★★</td></tr>
            <tr><td>样品流转</td><td>收样、发样、试样分发、还样 / 退样、留样管理</td><td class="stars">★★★★</td></tr>
            <tr><td>检测执行</td><td>试验检测、原始记录在线填写、自动计算判定</td><td class="stars">★★★★</td></tr>
            <tr><td>审核报告</td><td>组内审核 → 数据审核 → 报告编制 / 审核 / 签发 / 发放 / 归档</td><td class="stars">★★★★</td></tr>
            <tr><td>基础管理</td><td>角色 / 用户 / 部门 / 菜单 / 日志 / 工作流引擎 / 通知公告</td><td class="stars">★★★★</td></tr>
            <tr><td>主数据</td><td>样品数据、检测标准、模板、客户、场地、编号规则、字典</td><td class="stars">★★★★</td></tr>
            <tr><td>设备对接</td><td>与应敏检测装备 / 上位机的数据采集对接（电力场景）</td><td class="stars">★★★★</td></tr>
            <tr><td>可视化</td><td>基础业务统计（驾驶舱有底子，深度 SPC / 决策仍弱）</td><td class="stars">★★★</td></tr>
          </tbody>
        </table>
      </div>
      <div class="call-note"><b>读法：</b>主线流程与平台底座够用；缺口集中在「实验室资源与质量合规整层 + 统计决策深度」——见后续家联 / 乌海对照。</div>
    </div>
  </div>
</section>
'''

WUHAI_SLIDE = r'''
<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="乌海需求差距">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">数蚕智能 · 产品定位研讨会</div>
      <div class="r">WUHAI · GAP</div>
    </div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr auto;gap:1.2vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.5vh">
        <div class="t-meta">06 · 乌海项目 · 需求与功能差距</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.4vw,6.2vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">报价 76.8 万 · 约 1,280 人天 · 低复用高投入</h2>
        <p style="font-size:max(14px,.92vw);color:var(--text-secondary);line-height:1.4">本质不是标准 LIMS，而是「集团化工 QMS + MES 对接 + 数采平台 + SPC」组合拳；数采单项约占报价 1/3</p>
      </div>
      <div class="tbl-wrap">
        <table class="swiss-tbl dense">
          <thead><tr><th>模块</th><th style="width:11%">报价</th><th style="width:12%">数蚕现状</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td>基础资源与标准管理</td><td>6.0 万</td><td class="st-part">部分</td><td>有标准库，缺「物料—抽样—指标—限值」深度关联</td></tr>
            <tr><td>实验业务流管理</td><td>11.0 万</td><td class="st-ok">大部分有</td><td>收样 / 制样 / 任务分配主线成熟</td></tr>
            <tr><td>数据录入与分析管理</td><td>5.2 万</td><td class="st-part">部分</td><td>需补多级预警、异常复测</td></tr>
            <tr><td>仪器互联 / 自动数采</td><td><b>25.0 万</b></td><td class="st-miss">缺</td><td>~50 台老旧设备（DCU/RS232/Modbus）；强依赖应敏数采 · 约 125 人天</td></tr>
            <tr><td>数据审核与报告管理</td><td>4.2 万</td><td class="st-ok">大部分有</td><td>—</td></tr>
            <tr><td>统计分析 / 质量决策（SPC·CPK）</td><td>5.0 万</td><td class="st-miss">缺</td><td>—</td></tr>
            <tr><td>移动端 + ERP/MES 对接</td><td>5.6 万</td><td class="st-miss">缺</td><td>—</td></tr>
            <tr><td>质量数据平台（全链路 / 供应商门户）</td><td>3.4 万</td><td class="st-miss">缺</td><td>—</td></tr>
            <tr><td>标准模块</td><td>5.0 万</td><td class="st-part">部分有</td><td>—</td></tr>
            <tr><td>通用工作（UI/测试/实施/质保）</td><td>6.4 万</td><td>—</td><td>通用</td></tr>
            <tr class="row-pick"><td><b>合计</b></td><td><b>76.8 万</b></td><td>—</td><td><b>~1,280 人天 ≈ 5 人年</b></td></tr>
          </tbody>
        </table>
      </div>
      <div class="call-note"><b>结论：</b>可复用度低、行业专属重 → 走护栏，<b>原则不接</b>。</div>
    </div>
  </div>
</section>
'''

JIALIAN_SLIDE = r'''
<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="家联需求差距">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">数蚕智能 · 产品定位研讨会</div>
      <div class="r">JIALIAN · GAP</div>
    </div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr auto;gap:1vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.4vh">
        <div class="t-meta">06 · 家联项目 · 功能缺口对照</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.2vw,5.8vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">离散制造 QC · 明确模块约 34 万（不含数采 / CNAS 签章选配）</h2>
        <p style="font-size:max(14px,.9vw);color:var(--text-secondary);line-height:1.35">需求聚焦、轻于乌海；缺口多可沉淀为通用「高阶合规模块」· 全量交付约 15–20 人月</p>
      </div>
      <div class="tbl-wrap">
        <table class="swiss-tbl dense">
          <thead>
            <tr>
              <th style="width:13%">功能模块</th>
              <th>家联需求要点</th>
              <th style="width:9%">现状</th>
              <th style="width:8%">缺口</th>
              <th style="width:16%">开发预估</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>系统管理</td><td>角色、用户、部门、菜单、日志、工作流、公告</td><td class="st-part">部分</td><td>低</td><td>1 人 · 2–3 周</td></tr>
            <tr><td>数据管理</td><td>★ 样品标准交付量配置（新建）</td><td class="st-miss">无</td><td>中</td><td>1 人 · 3–4 周</td></tr>
            <tr><td>检测流程</td><td>任务计划自动导入、委托复制、批量导入</td><td class="st-part">部分</td><td>中</td><td>1–2 人 · 4–6 周</td></tr>
            <tr><td>样品管理</td><td>制备 / 还样 / 留样 / 处置全链</td><td class="st-part">部分</td><td>中</td><td>1 人 · 3–4 周</td></tr>
            <tr><td>人员管理</td><td>上岗证、能力授权、到期提醒</td><td class="st-miss">无/弱</td><td>中</td><td>1 人 · 3 周</td></tr>
            <tr><td>设备管理</td><td>★ 台账、点检、保养、现场仪器出入库、维修、报废</td><td class="st-part">部分</td><td class="st-miss">高</td><td>2 人 · 6–8 周</td></tr>
            <tr><td>标准物质</td><td>登记、领用、出库、库存、效期预警</td><td class="st-miss">无</td><td>中</td><td>1 人 · 3–4 周</td></tr>
            <tr><td>试剂耗材</td><td>登记、出库、库存、报废</td><td class="st-miss">无/弱</td><td>中</td><td>1 人 · 3 周</td></tr>
            <tr><td>危化品</td><td>名录、登记、审批、归还、危废处置、台账</td><td class="st-miss">无</td><td class="st-miss">高</td><td>2 人 · 6–8 周</td></tr>
            <tr><td>统计分析</td><td>业务数据表、处置记录等</td><td class="st-part">弱</td><td>低</td><td>1 人 · 2 周</td></tr>
            <tr><td>CNAS 质量体系</td><td>文件、质控计划、内审、管理评审、不符合 / 纠正</td><td class="st-miss">无</td><td class="st-miss">高</td><td>2–3 人 · 8–12 周</td></tr>
            <tr><td>可视化大屏</td><td>排名、合同量、部门检测量、合格率</td><td class="st-miss">无</td><td>中</td><td>1 人 · 4 周</td></tr>
            <tr><td>设备集成</td><td>数采按设备清单计</td><td class="st-ok">有(电力)</td><td>中</td><td>按清单</td></tr>
            <tr><td>系统集成</td><td>PLM / MES 对接</td><td class="st-miss">无</td><td>中</td><td>1–2 人 · 4–6 周</td></tr>
            <tr><td>CNAS 签章</td><td>CA 对接、报告签发、骑缝章（选配）</td><td class="st-miss">无</td><td class="st-miss">高</td><td>1 人 · 4 周</td></tr>
          </tbody>
        </table>
      </div>
      <div class="call-note"><b>战略读法：</b>设备全生命周期 / 危化品 / CNAS 体系等高缺口项跨行业可复用 → <b>倾向接 · 共创标杆</b>，把定制变成高阶合规模块库。</div>
    </div>
  </div>
</section>
'''

# Insert CAP after status slide (after 能力与边界 section ends, before architecture)
anchor_after_status = '</section>\n\n\n<section class="slide light" data-layout="S17" data-animate="system-diagram">'
if "data-title=\"已具备核心能力\"" not in text:
    if anchor_after_status not in text:
        raise SystemExit("anchor for CAP slide not found")
    text = text.replace(
        anchor_after_status,
        "</section>\n\n" + CAP_SLIDE + "\n<section class=\"slide light\" data-layout=\"S17\" data-animate=\"system-diagram\">",
        1,
    )

# Insert Wuhai + Jialian after 家联 vs 乌海 overview
anchor_after_cmp = None
m = re.search(
    r'(家联 vs 乌海：两类代表性项目[\s\S]*?</section>)\s*(<section class="slide light" data-layout="S05")',
    text,
)
if not m:
    raise SystemExit("anchor for Wuhai/Jialian insert not found")
if 'data-title="乌海需求差距"' not in text:
    text = text[: m.end(1)] + "\n\n" + WUHAI_SLIDE + "\n" + JIALIAN_SLIDE + "\n\n" + text[m.start(2) :]

# ---------- Fix inline white text on dark/accent slides for proj-safe fallback ----------
# Also convert segment-2 style slides to light with dark ink so they never wash out
replacements = [
    # Section divider slide 04
    (
        '''<section class="slide dark" data-layout="S09" data-animate="matrix-statement">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">数蚕智能 · 产品定位研讨会</div>
      <div class="r">SECTION · 01</div>
    </div>
    <span class="ring-mat" style="left:5vw;bottom:8vh;width:16vw;height:16vw"></span>
    <span class="dot-mat" style="right:0;top:8vh;width:32vw;height:32vw"></span>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:2.4vh;position:relative;z-index:1">
      <div class="t-meta" style="color:rgba(255,255,255,.65)">第一环节 · 15–30 MIN</div>
      <h1 class="h-statement" style="font-size:min(5.2vw,9.2vh);color:#fff;font-weight:200">现状 · 市场 · 策略 · 商机</h1>
      <p style="max-width:48ch;font-size:max(16px,1.1vw);color:rgba(255,255,255,.72);font-weight:400;line-height:1.55">先把能力边界、增长困境与两条战略方向摊开，再决定行业与接单标准。</p>
    </div>
  </div>
</section>''',
        '''<section class="slide light" data-layout="S09" data-animate="matrix-statement">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">数蚕智能 · 产品定位研讨会</div>
      <div class="r">SECTION · 01</div>
    </div>
    <span class="ring-mat" style="left:5vw;bottom:8vh;width:16vw;height:16vw;opacity:.35"></span>
    <span class="dot-mat" style="right:0;top:8vh;width:32vw;height:32vw;opacity:.25"></span>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:2.4vh;position:relative;z-index:1">
      <div class="t-meta" style="color:var(--text-helper)">第一环节 · 15–30 MIN</div>
      <h1 class="h-statement" style="font-size:min(5.2vw,9.2vh);color:var(--ink);font-weight:200">现状 · 市场 · 策略 · 商机</h1>
      <p style="max-width:48ch;font-size:max(16px,1.1vw);color:var(--text-secondary);font-weight:400;line-height:1.55">先把能力边界、增长困境与两条战略方向摊开，再决定行业与接单标准。</p>
    </div>
  </div>
</section>''',
    ),
]

for old, new in replacements:
    if old in text:
        text = text.replace(old, new, 1)
    else:
        print("WARN: section divider block not exact-matched, applying generic dark->light text fix")

# Generic: convert remaining dark statement slides to light + dark text
def convert_dark_statement(html: str) -> str:
    def repl(m):
        block = m.group(0)
        block = block.replace('class="slide dark"', 'class="slide light"', 1)
        block = re.sub(r'color:rgba\(255,255,255,[^)]+\)', 'color:var(--text-secondary)', block)
        block = re.sub(r'color:#fff\b', 'color:var(--ink)', block)
        block = re.sub(r'color:#ffffff\b', 'color:var(--ink)', block)
        return block
    return re.sub(
        r'<section class="slide dark"[\s\S]*?</section>',
        repl,
        html,
    )

text = convert_dark_statement(text)

# Convert accent full-bleed slides (cover + industry divider) to light with dark text for projection
def convert_accent_slides(html: str) -> str:
    def repl(m):
        block = m.group(0)
        # keep closing split accent half handled by proj-safe CSS; convert standalone accent slides
        if 'class="slide split"' in block or 'data-layout="SWISS-CLOSING' in block:
            return block
        block = block.replace('class="slide accent"', 'class="slide light"', 1)
        block = re.sub(r'color:rgba\(255,255,255,[^)]+\)', 'color:var(--text-secondary)', block)
        block = re.sub(r'color:#fff\b', 'color:var(--ink)', block)
        # cover title specifically
        block = block.replace('color:var(--ink)">数蚕智能', 'color:var(--ink)">数蚕智能')
        return block
    return re.sub(
        r'<section class="slide accent"[\s\S]*?</section>',
        repl,
        html,
    )

text = convert_accent_slides(text)

# hero-ink-col and ink-banner inline whites → dark-friendly (proj-safe CSS also covers)
text = text.replace(
    'style="color:rgba(255,255,255,.7)">05 · CONSTRAINT',
    'style="color:var(--text-helper)">05 · CONSTRAINT',
)
text = text.replace(
    'style="font-weight:200;font-size:min(3.8vw,6.8vh);line-height:1.1;color:#fff;margin-top:2vh">增长困境',
    'style="font-weight:200;font-size:min(3.8vw,6.8vh);line-height:1.1;color:var(--ink);margin-top:2vh">增长困境',
)
text = text.replace(
    'style="margin-top:2vh;font-size:max(15px,1vw);line-height:1.5;color:rgba(255,255,255,.72);max-width:22ch">电网指定供应商',
    'style="margin-top:2vh;font-size:max(15px,1vw);line-height:1.5;color:var(--text-secondary);max-width:22ch">电网指定供应商',
)
text = text.replace(
    'style="color:rgba(255,255,255,.7)">14.2 · SAFETY STEWARD',
    'style="color:var(--text-helper)">14.2 · SAFETY STEWARD',
)
text = text.replace(
    'style="font-weight:200;font-size:min(3.4vw,6.2vh);line-height:1.12;color:#fff;margin-top:2vh">安全管家的',
    'style="font-weight:200;font-size:min(3.4vw,6.2vh);line-height:1.12;color:var(--ink);margin-top:2vh">安全管家的',
)
text = text.replace(
    'style="margin-top:2vh;font-size:max(15px,1vw);line-height:1.5;color:rgba(255,255,255,.72);max-width:24ch">物联网软件',
    'style="margin-top:2vh;font-size:max(15px,1vw);line-height:1.5;color:var(--text-secondary);max-width:24ch">物联网软件',
)
text = text.replace(
    'style="margin-top:2vh;font-weight:200;font-size:min(3.6vw,6.4vh);line-height:1.12;color:#fff;letter-spacing:-.025em">最适合数蚕的策略',
    'style="margin-top:2vh;font-weight:200;font-size:min(3.6vw,6.4vh);line-height:1.12;color:var(--ink);letter-spacing:-.025em">最适合数蚕的策略',
)
text = text.replace(
    'style="font-size:max(16px,1.05vw);line-height:1.55;color:rgba(255,255,255,.78);max-width:42ch;align-self:start;padding-top:1.2vw"',
    'style="font-size:max(16px,1.05vw);line-height:1.55;color:var(--text-secondary);max-width:42ch;align-self:start;padding-top:1.2vw"',
)
text = text.replace(
    'style="color:rgba(255,255,255,.7)">12 · STRATEGY',
    'style="color:var(--text-helper)">12 · STRATEGY',
)

# Closing split left: convert white text to dark via proj-safe; also harden inline
text = text.replace(
    'data-layout="SWISS-CLOSING-ASCII"',
    'data-layout="SWISS-CLOSING-ASCII" data-proj="lighten"',
)

# ---------- Renumber chrome page counts ----------
secs = list(re.finditer(r'<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>[\s\S]*?</section>', text))
TOTAL = len(secs)
print("total slides", TOTAL)

def renumber(html: str, total: int) -> str:
    parts = []
    last = 0
    for i, m in enumerate(re.finditer(r'<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>[\s\S]*?</section>', html), 1):
        block = m.group(0)
        # replace patterns like 01 / 27 or 09 / 27 inside chrome-min .r
        block = re.sub(
            r'(SS · 26\.07\.27 · )\d{2} / \d{2}',
            lambda mm: f'{mm.group(1)}{i:02d} / {total:02d}',
            block,
        )
        # closing 27 / 27
        block = re.sub(r'>\s*\d{2} / \d{2}\s*<', f'> {i:02d} / {total:02d} <', block, count=1)
        parts.append(html[last:m.start()])
        parts.append(block)
        last = m.end()
    parts.append(html[last:])
    return "".join(parts)

text = renumber(text, TOTAL)

# ---------- Edit / Save script + toolbar ----------
TOOLBAR = '''
<div id="edit-bar" aria-label="编辑工具条">
  <button type="button" id="btn-edit" title="开启后可直接点选文字修改">编辑</button>
  <button type="button" id="btn-save" title="保存到本机浏览器">保存</button>
  <button type="button" id="btn-download" title="下载整份 HTML">下载 HTML</button>
  <button type="button" id="btn-reset" title="恢复到上次打开时的原始内容">重置</button>
  <span class="sep"></span>
  <button type="button" id="btn-proj" class="on" title="投屏高对比：强制深色字">投屏模式</button>
  <span class="sep"></span>
  <span class="hint" id="edit-hint">提示：点「编辑」后可改文字；「保存」写入浏览器，「下载 HTML」导出文件</span>
</div>
'''

EDIT_JS = r'''
<script>
(function(){
  const KEY = 'shucan-seminar-deck-v2';
  const barEdit = document.getElementById('btn-edit');
  const barSave = document.getElementById('btn-save');
  const barDl = document.getElementById('btn-download');
  const barReset = document.getElementById('btn-reset');
  const barProj = document.getElementById('btn-proj');
  const hint = document.getElementById('edit-hint');
  const deck = document.getElementById('deck');
  if(!deck) return;

  // snapshot original deck HTML once
  const ORIGINAL = deck.innerHTML;
  try {
    if(!localStorage.getItem(KEY + ':original')){
      localStorage.setItem(KEY + ':original', ORIGINAL);
    }
  } catch(e){}

  function setHint(msg){ if(hint) hint.textContent = msg; }

  function editableTargets(){
    return deck.querySelectorAll('h1,h2,h3,h4,p,li,td,th,span.t-meta,span.t-cat,.lead,.bc-main,.bc-note,.mc-t,.mc-d,.call-note,.tag-pill,.chrome-min .l,.chrome-min .r,.arch-hd b,.arch-hd span,.mod b,.mod span,.lbl,.name,.yr');
  }

  function setEditing(on){
    document.body.classList.toggle('editing', on);
    barEdit.classList.toggle('on', on);
    editableTargets().forEach(el=>{
      if(on){
        el.setAttribute('contenteditable','true');
        el.setAttribute('spellcheck','false');
      }else{
        el.removeAttribute('contenteditable');
      }
    });
    setHint(on ? '编辑中：点击文字即可修改；改完请点「保存」或「下载 HTML」' : '已退出编辑。可用「保存」写入浏览器本地。');
  }

  function saveLocal(){
    try{
      localStorage.setItem(KEY, deck.innerHTML);
      localStorage.setItem(KEY + ':savedAt', new Date().toISOString());
      setHint('已保存到本机浏览器 · ' + new Date().toLocaleString());
    }catch(e){
      setHint('保存失败：' + e.message);
    }
  }

  function loadLocal(){
    try{
      const html = localStorage.getItem(KEY);
      if(html){
        deck.innerHTML = html;
        setHint('已载入本机保存稿 · ' + (localStorage.getItem(KEY+':savedAt')||''));
        return true;
      }
    }catch(e){}
    return false;
  }

  function downloadHtml(){
    // clone full document with current deck content
    const clone = document.documentElement.cloneNode(true);
    const cloneDeck = clone.querySelector('#deck');
    if(cloneDeck) cloneDeck.innerHTML = deck.innerHTML;
    // strip edit mode attrs in export
    clone.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'));
    clone.querySelector('body')?.classList.remove('editing');
    const html = '<!DOCTYPE html>\n' + clone.outerHTML;
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const a = document.createElement('a');
    const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    a.href = URL.createObjectURL(blob);
    a.download = '数蚕智能-产品定位研讨会-' + ts + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
    setHint('已下载 HTML 文件（含当前编辑内容）');
  }

  function resetDeck(){
    if(!confirm('确定恢复到原始版本？未下载的修改将丢失。')) return;
    try{
      const orig = localStorage.getItem(KEY + ':original') || ORIGINAL;
      deck.innerHTML = orig;
      localStorage.removeItem(KEY);
      setEditing(false);
      setHint('已重置为原始内容');
      // re-init icons if needed
      if(window.lucide && lucide.createIcons) lucide.createIcons();
    }catch(e){ setHint('重置失败：'+e.message); }
  }

  barEdit?.addEventListener('click', ()=> setEditing(!document.body.classList.contains('editing')));
  barSave?.addEventListener('click', saveLocal);
  barDl?.addEventListener('click', downloadHtml);
  barReset?.addEventListener('click', resetDeck);
  barProj?.addEventListener('click', ()=>{
    const on = document.body.classList.toggle('proj-safe');
    barProj.classList.toggle('on', on);
    setHint(on ? '投屏模式开：浅底深字，适合投影' : '投屏模式关：恢复原配色（含深色页）');
  });

  // Ctrl/Cmd+S save
  document.addEventListener('keydown', (e)=>{
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='s'){
      e.preventDefault();
      saveLocal();
    }
  });

  // load saved content after DOM ready (before first paint ideally)
  loadLocal();
})();
</script>
'''

if 'id="edit-bar"' not in text:
    # insert toolbar after <body ...>
    text = re.sub(r'(<body[^>]*>)', r'\1\n' + TOOLBAR, text, count=1)

if 'shucan-seminar-deck-v2' not in text:
    # insert before </body>
    if '</body>' in text:
        text = text.replace('</body>', EDIT_JS + '\n</body>', 1)
    else:
        text += EDIT_JS

# Ensure body has proj-safe
if 'proj-safe' not in re.search(r'<body[^>]*>', text).group(0):
    text = re.sub(r'<body([^>]*)>', r'<body\1 class="proj-safe">', text, count=1)

path.write_text(text)
print("patched", path)
print("slides now", len(list(re.finditer(r'<section\b[^>]*class="[^"]*\bslide\b[^"]*"', path.read_text()))))
print("has cap", '已具备的核心能力' in path.read_text())
print("has wuhai", '乌海项目 · 需求与功能差距' in path.read_text())
print("has jialian", '家联项目 · 功能缺口对照' in path.read_text())
print("has edit", 'id="edit-bar"' in path.read_text())
print("dark slides left", path.read_text().count('class="slide dark"'))
print("accent slides left", path.read_text().count('class="slide accent"'))
