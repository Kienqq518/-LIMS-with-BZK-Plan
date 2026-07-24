#!/usr/bin/env python3
"""Insert full existing-vs-Wuhai/Jialian gap analysis slides from the comparison brief."""
from pathlib import Path
import re

path = Path("/workspace/ppt/index.html")
text = path.read_text()

CSS = r'''
  /* ===== Gap analysis extras ===== */
  .gap-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.2vh 1.2vw;flex:1;min-height:0}
  .gap-card{background:var(--grey-1);border:1px solid var(--border-subtle);padding:1.6vh 1.2vw;display:flex;flex-direction:column;gap:.8vh;min-height:0}
  .gap-card h4{font-size:max(16px,1.05vw);font-weight:600;color:var(--ink);letter-spacing:-.01em}
  .gap-card p,.gap-card li{font-size:max(14px,.88vw);line-height:1.4;color:var(--text-secondary);font-weight:400}
  .gap-card ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.55vh}
  .gap-card li{padding-left:0.9vw;position:relative}
  .gap-card li::before{content:"";position:absolute;left:0;top:.55em;width:5px;height:5px;background:var(--accent)}
  .gap-card.emphasis{background:rgba(var(--accent-rgb),.06);border-color:rgba(var(--accent-rgb),.35)}
  .legend-row{display:flex;gap:1.6vw;align-items:center;font-size:max(13px,.82vw);color:var(--text-helper);font-weight:500}
  .legend-row span b{font-weight:700;color:var(--ink);margin-right:.3vw}
  .mk-ok{color:#0a5c2e;font-weight:700}
  .mk-part{color:#7a5c1a;font-weight:700}
  .mk-miss{color:#8b3030;font-weight:700}
  .swiss-tbl.gap-mx td,.swiss-tbl.gap-mx th{font-size:max(12px,.78vw);padding:.45vh .55vw;line-height:1.3}
  .swiss-tbl.gap-mx th{white-space:nowrap}
  .swiss-tbl.gap-mx .c{text-align:center;font-weight:700}
  .two-col-gap{display:grid;grid-template-columns:1fr 1fr;gap:1.4vh 1.6vw;flex:1;min-height:0}
  .base-block{border:1px solid var(--border-subtle);padding:1.4vh 1.2vw;background:var(--paper);display:flex;flex-direction:column;gap:.6vh}
  .base-block h4{font-size:max(15px,.98vw);font-weight:600;color:var(--ink)}
  .base-block p{font-size:max(13px,.84vw);line-height:1.4;color:var(--text-secondary)}
'''

if "Gap analysis extras" not in text:
    marker = "  /* ===== Projection contrast"
    if marker in text:
        text = text.replace(marker, CSS + "\n" + marker, 1)
    else:
        text = text.replace("</style>", CSS + "\n</style>", 1)

SLIDES = r'''
<section class="slide light" data-layout="S19" data-animate="four-cards" data-title="差距结论速览">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">数蚕智能 · 产品定位研讨会</div>
      <div class="r">GAP · OVERVIEW</div>
    </div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:1.6vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.6vh">
        <div style="width:80px;height:3px;background:var(--accent)"></div>
        <div class="t-meta">06 · 现有模块 × 乌海 / 家联</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.6vw,6.4vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">一、结论速览</h2>
        <p style="font-size:max(15px,.98vw);color:var(--text-secondary);line-height:1.45">现有核心模块（合同 / 样品 / 试验 / 报告 / 归档 / 基础数据）可覆盖两项目主流程；差距集中在三类能力</p>
      </div>
      <div class="gap-3">
        <div class="gap-card emphasis">
          <h4>① 数采与外部对接（高投入）</h4>
          <ul>
            <li>缺仪器数采（IoT）、ERP / MES / PLM 集成、移动端（PDA / 平板）</li>
            <li>乌海「仪器互联」单项约 <b style="color:var(--ink)">125 人天</b>，是最重缺口</li>
          </ul>
        </div>
        <div class="gap-card">
          <h4>② 实验室资源与质量体系深度</h4>
          <ul>
            <li>人员能力、标物、耗材、危化品、设备全生命周期深度不足</li>
            <li>缺完整 CNAS（ISO17025）合规流程与电子签章</li>
            <li>现有设备 / 文件 / 用户管理多为「台账级」</li>
          </ul>
        </div>
        <div class="gap-card">
          <h4>③ 智能化与决策支持</h4>
          <ul>
            <li>缺检验方案链式建模、智能排程</li>
            <li>缺多级预警、OCAP 失控闭环</li>
            <li>缺 SPC / CPK 统计分析与质量决策</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="slide light" data-layout="S16" data-animate="field-notes" data-title="现有系统能力基线">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">数蚕智能 · 产品定位研讨会</div>
      <div class="r">GAP · BASELINE</div>
    </div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr auto;gap:1.4vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.5vh">
        <div class="t-meta">06 · 现有系统能力基线</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.6vw,6.4vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">二、我们现在有什么</h2>
        <p style="font-size:max(15px,.95vw);color:var(--text-secondary)">业务层主线可用；系统层底座齐全；分析层偏展示；关键观察：台账有了，生命周期与合规深度没有</p>
      </div>
      <div class="two-col-gap">
        <div class="base-block">
          <h4>业务层</h4>
          <p>完整合同 / 委托流程；样品台账（无子样深度）；试验流程含审核规则；报告编制 / 签发 / 归档（基础文件管理）；基础设备 / 客户数据。</p>
        </div>
        <div class="base-block">
          <h4>系统层</h4>
          <p>标准 RBAC（角色权限）；日志；流程配置；微信对接；字典与参数管理。</p>
        </div>
        <div class="base-block">
          <h4>分析层</h4>
          <p>基础工作台、驾驶舱、检测时效监控——偏展示，缺 SPC / CPK 与质量决策闭环。</p>
        </div>
        <div class="base-block emphasis" style="background:rgba(var(--accent-rgb),.06);border-color:rgba(var(--accent-rgb),.35)">
          <h4>关键观察</h4>
          <p>设备、文件、用户管理目前多为「台账级」：能登记、能查，但缺全生命周期跟踪与合规流程深度——这正是开放市场客户要补的一层。</p>
        </div>
      </div>
      <div class="call-note"><b>基线结论：</b>主流程能承接两项目「从委托到报告」；真正拉开差距的是数采对接、资源合规整层、智能化决策三类能力。</div>
    </div>
  </div>
</section>

<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="差距总表上">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">数蚕智能 · 产品定位研讨会</div>
      <div class="r">GAP · MATRIX 01</div>
    </div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto auto 1fr;gap:1vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.4vh">
        <div class="t-meta">06 · 三、差距总表（能力矩阵）· 1/2</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.2vw,5.8vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">现有系统 × 乌海 × 家联（能力 01–12）</h2>
      </div>
      <div class="legend-row">
        <span><b class="mk-ok">✅</b>已有</span>
        <span><b class="mk-part">🟡</b>部分 / 需加强</span>
        <span><b class="mk-miss">❌</b>缺失</span>
        <span>「-」= 该项目未强诉求</span>
      </div>
      <div class="tbl-wrap">
        <table class="swiss-tbl dense gap-mx">
          <thead>
            <tr>
              <th style="width:5%">#</th>
              <th>能力项</th>
              <th style="width:10%">现有</th>
              <th style="width:10%">乌海</th>
              <th style="width:10%">家联</th>
              <th style="width:22%">差距状态</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>1</td><td>检验方案链式建模</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">❌ 核心缺失</td></tr>
            <tr><td>2</td><td>标准方法库（多态）</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-part">🟡 需加强</td></tr>
            <tr><td>3</td><td>方法拆解（自动规则）</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-part">🟡 部分</td></tr>
            <tr><td>4</td><td>智能化采样（PDA / OCR）</td><td class="c mk-part">🟡 标签</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>5</td><td>批量制备管理</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-part">🟡 部分</td></tr>
            <tr><td>6</td><td>留样管理（自动任务）</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>7</td><td>任务自动排程</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>8</td><td>待检任务池（紧急 / 复测）</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-part">🟡 部分</td></tr>
            <tr><td>9</td><td>多级预警（逻辑校验）</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-part">🟡</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>10</td><td>异常 OCAP 闭环</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr class="row-pick"><td>11</td><td><b>仪器互联（IoT 数采）</b></td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ <b>最重缺口</b></td></tr>
            <tr><td>12</td><td>报告合规（电子签 / CNAS）</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-part">🟡 部分</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>

<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="差距总表下">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">数蚕智能 · 产品定位研讨会</div>
      <div class="r">GAP · MATRIX 02</div>
    </div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto auto 1fr auto;gap:1vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.4vh">
        <div class="t-meta">06 · 三、差距总表（能力矩阵）· 2/2</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.2vw,5.8vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">现有系统 × 乌海 × 家联（能力 13–24）</h2>
      </div>
      <div class="legend-row">
        <span><b class="mk-ok">✅</b>已有</span>
        <span><b class="mk-part">🟡</b>部分 / 需加强</span>
        <span><b class="mk-miss">❌</b>缺失</span>
      </div>
      <div class="tbl-wrap">
        <table class="swiss-tbl dense gap-mx">
          <thead>
            <tr>
              <th style="width:5%">#</th>
              <th>能力项</th>
              <th style="width:10%">现有</th>
              <th style="width:10%">乌海</th>
              <th style="width:10%">家联</th>
              <th style="width:22%">差距状态</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>13</td><td>SPC / CPK 统计分析</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>14</td><td>移动端（PDA / 平板）</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>15</td><td>系统集成（ERP / MES / PLM）</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>16</td><td>全链路追溯</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>17</td><td>供应链协作门户</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>18</td><td>人员管理（能力授权）</td><td class="c mk-miss">❌</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>19</td><td>标准物质管理</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>20</td><td>试剂 / 耗材管理</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>21</td><td>危化品 / 危废管理</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>22</td><td>设备全生命周期（点检 / 保养）</td><td class="c mk-part">🟡 台账</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>23</td><td>质量体系 CNAS 流程</td><td class="c mk-part">🟡 文件</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ 缺失</td></tr>
            <tr><td>24</td><td>样品标准交付量配置</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">❌ 缺失</td></tr>
          </tbody>
        </table>
      </div>
      <div class="call-note"><b>读矩阵：</b>乌海侧缺口偏「数据与追溯」；家联侧缺口偏「资源与合规」；仪器互联 + 系统集成是两项目共同最重项。</div>
    </div>
  </div>
</section>

<section class="slide light" data-layout="S08" data-animate="duo-mirror" data-title="按项目归纳">
  <div class="canvas-card">
    <div class="chrome-min">
      <div class="l">数蚕智能 · 产品定位研讨会</div>
      <div class="r">GAP · BY PROJECT</div>
    </div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto auto 1fr;gap:1.4vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.5vh">
        <div class="t-meta">06 · 四、按项目归纳</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.4vw,6.2vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">共同刚需 · 乌海侧重点 · 家联侧重点</h2>
      </div>
      <div class="call-note" style="margin:0"><b>共同刚需（优先）：</b>仪器互联、系统集成中间件、移动端支持、留样管理、任务排程、电子签章。</div>
      <div class="duo-compare" style="align-items:stretch;margin-top:0!important">
        <div class="col" style="display:flex;flex-direction:column;gap:1.2vh;padding-right:1.6vw">
          <span class="t-cat">乌海 · 煤焦化 · 偏数据与追溯</span>
          <h3 style="font-weight:300;font-size:min(2.2vw,3.6vh);line-height:1.25;color:var(--ink)">从原料到成品的全链路追溯</h3>
          <ul class="clean-list">
            <li>DCS / PLC 对接与仪器互联（数采重）</li>
            <li>送货单图像识别 / 智能化采样</li>
            <li>SPC / CPK、多级预警、OCAP 失控闭环</li>
            <li>供应链协作门户与质量数据平台</li>
          </ul>
          <div class="tag-pill avoid">投入重 · 行业专属 · 复用低</div>
        </div>
        <span class="vrule"></span>
        <div class="col" style="display:flex;flex-direction:column;gap:1.2vh;padding-left:1.6vw">
          <span class="t-cat" style="color:var(--accent)">家联 · 新材料 / 制造 QC · 偏管理与合规</span>
          <h3 style="font-weight:300;font-size:min(2.2vw,3.6vh);line-height:1.25;color:var(--ink)">实验室资源 + CNAS 体系深度</h3>
          <ul class="clean-list">
            <li>人 / 机 / 料 / 危废全资源管理</li>
            <li>CNAS 质量体系流程（内审 / 不符合 / 纠正）</li>
            <li>MES / PLM 对接；约 1000 检测参数配置量</li>
            <li>设备全生命周期、标物 / 耗材、标准交付量配置</li>
          </ul>
          <div class="tag-pill pick">可沉淀为高阶合规模块 · 共创优先</div>
        </div>
      </div>
    </div>
  </div>
</section>
'''

# Insert after 家联缺口 slide (data-title="家联需求差距"), before 接还是不接
if 'data-title="差距结论速览"' in text:
    print("already inserted")
else:
    m = re.search(
        r'(data-title="家联需求差距"[\s\S]*?</section>)\s*(<section class="slide light" data-layout="S05")',
        text,
    )
    if not m:
        # fallback: search by title text
        m = re.search(
            r'(离散制造 QC · 明确模块约 34 万[\s\S]*?</section>)\s*(<section class="slide light" data-layout="S05")',
            text,
        )
    if not m:
        raise SystemExit("insert anchor not found")
    text = text[: m.end(1)] + "\n\n" + SLIDES + "\n\n" + text[m.start(2) :]
    print("inserted gap slides")

# Renumber
secs = list(re.finditer(r'<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>[\s\S]*?</section>', text))
TOTAL = len(secs)
print("total", TOTAL)

parts = []
last = 0
for i, m in enumerate(secs, 1):
    block = m.group(0)
    block = re.sub(
        r'(SS · 26\.07\.27 · )\d{2} / \d{2}',
        lambda mm, i=i: f'{mm.group(1)}{i:02d} / {TOTAL:02d}',
        block,
    )
    block = re.sub(r'>\s*\d{2} / \d{2}\s*<', f'> {i:02d} / {TOTAL:02d} <', block, count=1)
    parts.append(text[last:m.start()])
    parts.append(block)
    last = m.end()
parts.append(text[last:])
text = "".join(parts)

# fix base-block.emphasis if used
if ".base-block.emphasis" not in text:
    text = text.replace(
        ".base-block p{font-size:max(13px,.84vw);line-height:1.4;color:var(--text-secondary)}",
        ".base-block p{font-size:max(13px,.84vw);line-height:1.4;color:var(--text-secondary)}\n  .base-block.emphasis{background:rgba(var(--accent-rgb),.06);border-color:rgba(var(--accent-rgb),.35)}",
    )

path.write_text(text)
print("done")
for i, s in enumerate(re.finditer(r'<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>[\s\S]*?</section>', path.read_text()), 1):
    mm = re.search(r'<h[12][^>]*>([\s\S]*?)</h[12]>', s.group(0))
    title = re.sub(r'<[^>]+>', '', mm.group(1)).replace('\n', ' ').strip()[:50] if mm else '?'
    if i >= 10 and i <= 20:
        print(f'{i:02d}', title)
