#!/usr/bin/env python3
"""Consolidate capability→gap cluster; rewrite STATUS GAP per fig2."""
from pathlib import Path
import re

path = Path("/workspace/ppt/index.html")
text = path.read_text()

secs = list(re.finditer(r"<section\b[^>]*class=\"[^\"]*\bslide\b[^\"]*\"[^>]*>[\s\S]*?</section>", text))
print("input slides", len(secs))

def title_of(html: str) -> str:
    m = re.search(r"<h[12][^>]*>([\s\S]*?)</h[12]>", html)
    return re.sub(r"<[^>]+>", "", m.group(1)).replace("\n", " ").strip() if m else ""

titles = [title_of(m.group(0)) for m in secs]
for i, t in enumerate(titles, 1):
    print(f"{i:02d}", t[:50])

# indices 0-based
# 05 status = index 4
# 06 capabilities = 5 ... 17 共同刚需 = 16
# 08 dilemma = 7, 09 opportunity = 8
# 18 decision = 17

status = secs[4].group(0)
dilemma = secs[7].group(0)
opportunity = secs[8].group(0)

# --- rewrite STATUS GAP ---
NEW_GAP_COL = '''        <div class="col" style="display:flex;flex-direction:column;gap:1.0vh;padding-left:2vw">
          <span class="t-cat">GAP · 不够用（结构性）</span>
          <h3 style="font-weight:300;font-size:min(2.05vw,3.3vh);line-height:1.25">对照乌海 / 家联，缺口落在三层</h3>
          <div style="display:flex;flex-direction:column;gap:.85vh">
            <div>
              <div style="font-size:max(14px,.95vw);font-weight:600;color:var(--ink)">① 数据源与外部连接层 <span class="mk-miss">差距最大 · 投入最重</span></div>
              <p style="font-size:max(13px,.82vw);line-height:1.38;color:var(--text-secondary);margin-top:.25vh">仪器数采/互联；ERP·MES·PLM·大宗物流·仓库集成；移动端（PDA/平板）。乌海「仪器互联」单项约 125 人天 / 25 万。</p>
            </div>
            <div>
              <div style="font-size:max(14px,.95vw);font-weight:600;color:var(--ink)">② 实验室资源与质量体系深度 <span class="mk-part">家联重 · 现系统几乎空白</span></div>
              <p style="font-size:max(13px,.82vw);line-height:1.38;color:var(--text-secondary);margin-top:.25vh">人员能力/上岗证；标物·试剂耗材；危化品与危废；设备全生命周期（点检/维保/维修/报废/现场仪器出入库）；CNAS 全套流程；合规电子签章。</p>
            </div>
            <div>
              <div style="font-size:max(14px,.95vw);font-weight:600;color:var(--ink)">③ 智能化与决策层 <span class="mk-part">两项目都要 · 现系统偏弱</span></div>
              <p style="font-size:max(13px,.82vw);line-height:1.38;color:var(--text-secondary);margin-top:.25vh">检验方案链式建模；智能采样/制样/留样；任务自动调度；多级预警；异常复测 OCAP 闭环；SPC/CPK；全链路追溯；供应链协作门户。</p>
            </div>
          </div>
        </div>'''

# replace right column in status slide
col_pat = re.compile(
    r'<div class="col"[^>]*>\s*<span class="t-cat">GAP · 不够用（结构性）</span>[\s\S]*?</div>\s*(?=</div>\s*</div>\s*</div>\s*</section>)',
    re.M,
)
# more robust: find GAP col by walking divs
gs = status.find('<span class="t-cat">GAP · 不够用（结构性）</span>')
if gs < 0:
    raise SystemExit("GAP marker missing in status")
col_start = status.rfind('<div class="col"', 0, gs)
j = col_start + 4
depth = 1
while j < len(status) and depth:
    o = status.find("<div", j)
    c = status.find("</div>", j)
    if c < 0:
        break
    if o >= 0 and o < c:
        depth += 1
        j = o + 4
    else:
        depth -= 1
        j = c + len("</div>")
status = status[:col_start] + NEW_GAP_COL + status[j:]
print("status GAP rewritten")

A = r'''<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="已具备核心能力">
  <div class="canvas-card">
    <div class="chrome-min"><div class="l">数蚕智能 · 产品定位研讨会</div><div class="r">CAPABILITY</div></div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr auto;gap:1.2vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.5vh">
        <div class="t-meta">04 · CORE CAPABILITY</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.6vw,6.4vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">已具备的核心能力（电力检测验证）</h2>
        <p style="font-size:max(15px,.95vw);color:var(--text-secondary);line-height:1.4">委托→样品→检测→报告主线成熟；业务运营层最强，资源合规与决策层仍薄</p>
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
            <tr><td>可视化</td><td>基础业务统计与驾驶舱底子（深度 SPC / 决策仍弱）</td><td class="stars">★★★</td></tr>
          </tbody>
        </table>
      </div>
      <div class="call-note"><b>基线：</b>设备 / 文件 / 用户多为「台账级」——能登记能查，缺全生命周期与合规流程深度。</div>
    </div>
  </div>
</section>'''

B = r'''<section class="slide light" data-layout="S08" data-animate="duo-mirror" data-title="家联乌海项目对照">
  <div class="canvas-card">
    <div class="chrome-min"><div class="l">数蚕智能 · 产品定位研讨会</div><div class="r">COMPARE · PROJECTS</div></div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:1.4vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.5vh">
        <div class="t-meta">06 · 商机对照</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.6vw,6.4vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">家联 vs 乌海：两类代表性项目</h2>
        <p style="font-size:max(15px,.95vw);color:var(--text-secondary)">主流程两边都能接；差别在缺口类型、投入量级与可复用度</p>
      </div>
      <div class="duo-compare" style="align-items:stretch;margin-top:0!important">
        <div class="col" style="display:flex;flex-direction:column;gap:1vh;padding-right:1.4vw">
          <span class="t-cat" style="color:var(--accent)">家联 · 离散制造 QC</span>
          <h3 style="font-weight:300;font-size:min(2.2vw,3.5vh);line-height:1.25">明确模块约 34 万<br/>全量约 15–20 人月</h3>
          <ul class="clean-list compact">
            <li>偏<strong>管理与合规</strong>：人机料危废、CNAS 体系、设备全生命周期</li>
            <li>新建重点多可沉淀为「高阶合规模块」</li>
            <li>MES/PLM 对接；约 1000 检测参数配置量</li>
            <li>不含数采清单与 CNAS 签章选配</li>
          </ul>
          <div class="tag-pill pick">倾向：接 · 共创标杆</div>
        </div>
        <span class="vrule"></span>
        <div class="col" style="display:flex;flex-direction:column;gap:1vh;padding-left:1.4vw">
          <span class="t-cat">乌海 · 焦化 QMS</span>
          <h3 style="font-weight:300;font-size:min(2.2vw,3.5vh);line-height:1.25">报价 76.8 万<br/>约 1,280 人天 ≈ 5 人年</h3>
          <ul class="clean-list compact">
            <li>偏<strong>数据与追溯</strong>：仪器互联 25 万 / 125 人天（单项最重）</li>
            <li>本质＝集团化工 QMS + MES + 数采平台 + SPC</li>
            <li>全链路追溯、移动端、供应链门户、OCAP</li>
            <li>行业专属重，定制沉淀难复用</li>
          </ul>
          <div class="tag-pill avoid">倾向：不接 · 护栏外</div>
        </div>
      </div>
    </div>
  </div>
</section>'''

C = r'''<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="差距总表24">
  <div class="canvas-card">
    <div class="chrome-min"><div class="l">数蚕智能 · 产品定位研讨会</div><div class="r">GAP · MATRIX</div></div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto auto 1fr;gap:.65vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.25vh">
        <div class="t-meta">06 · 差距总表（能力矩阵）</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.0vw,5.4vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">现有系统 × 乌海 × 家联 · 24 项</h2>
      </div>
      <div class="legend-row">
        <span><b class="mk-ok">✅</b>已有</span>
        <span><b class="mk-part">🟡</b>部分 / 需加强</span>
        <span><b class="mk-miss">❌</b>缺失</span>
        <span>「-」= 该项目未强诉求</span>
      </div>
      <div class="tbl-wrap">
        <table class="swiss-tbl dense gap-mx">
          <thead><tr><th style="width:4%">#</th><th>能力项</th><th style="width:9%">现有</th><th style="width:9%">乌海</th><th style="width:9%">家联</th><th style="width:16%">差距</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>检验方案链式建模</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">核心缺失</td></tr>
            <tr><td>2</td><td>标准方法库（多态）</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-part">需加强</td></tr>
            <tr><td>3</td><td>方法拆解（自动规则）</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-part">部分</td></tr>
            <tr><td>4</td><td>智能化采样（PDA/OCR）</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">缺失</td></tr>
            <tr><td>5</td><td>批量制备管理</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-part">部分</td></tr>
            <tr><td>6</td><td>留样管理（自动任务）</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>7</td><td>任务自动排程</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>8</td><td>待检任务池（紧急/复测）</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-part">部分</td></tr>
            <tr><td>9</td><td>多级预警（逻辑校验）</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-part">🟡</td><td class="mk-miss">缺失</td></tr>
            <tr><td>10</td><td>异常 OCAP 闭环</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">缺失</td></tr>
            <tr class="row-pick"><td>11</td><td><b>仪器互联（IoT 数采）</b></td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-miss"><b>最重缺口</b></td></tr>
            <tr><td>12</td><td>报告合规（电子签/CNAS）</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-part">部分</td></tr>
            <tr><td>13</td><td>SPC/CPK 统计分析</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">缺失</td></tr>
            <tr><td>14</td><td>移动端（PDA/平板）</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">缺失</td></tr>
            <tr><td>15</td><td>系统集成（ERP/MES/PLM）</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>16</td><td>全链路追溯</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">缺失</td></tr>
            <tr><td>17</td><td>供应链协作门户</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">缺失</td></tr>
            <tr><td>18</td><td>人员管理（能力授权）</td><td class="c mk-miss">❌</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>19</td><td>标准物质管理</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>20</td><td>试剂/耗材管理</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>21</td><td>危化品/危废管理</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>22</td><td>设备全生命周期</td><td class="c mk-part">🟡台账</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>23</td><td>质量体系 CNAS 流程</td><td class="c mk-part">🟡文件</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>24</td><td>样品标准交付量配置</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>'''

D = r'''<section class="slide light" data-layout="S19" data-animate="four-cards" data-title="差距结论与分项目">
  <div class="canvas-card">
    <div class="chrome-min"><div class="l">数蚕智能 · 产品定位研讨会</div><div class="r">GAP · TAKEAWAY</div></div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto auto 1fr;gap:1.1vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.4vh">
        <div style="width:80px;height:3px;background:var(--accent)"></div>
        <div class="t-meta">06 · 差距结论与分项目重点</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.2vw,5.8vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">三类缺口 · 共同刚需 · 项目侧重</h2>
      </div>
      <div class="call-note" style="margin:0"><b>共同刚需（优先）：</b>仪器互联、系统集成中间件、移动端、留样管理、任务排程、电子签章。</div>
      <div style="display:grid;grid-template-rows:auto 1fr;gap:1.1vh;min-height:0">
        <div class="gap-3">
          <div class="gap-card emphasis">
            <h4>① 数据源与外部连接</h4>
            <p>差距最大、投入最重。乌海仪器互联单项约 125 人天 / 25 万；另含 ERP/MES/PLM、移动端。</p>
          </div>
          <div class="gap-card">
            <h4>② 资源与质量体系</h4>
            <p><b>家联重。</b>人员证、标物/耗材、危化品、设备全生命周期、CNAS 全套流程与合规签章——现系统几乎空白，但可沉淀为高阶合规模块。</p>
          </div>
          <div class="gap-card">
            <h4>③ 智能化与决策</h4>
            <p><b>两项目都要。</b>链式建模、智能采样制样留样、自动调度、多级预警、OCAP、SPC/CPK、全链路追溯、供应链门户——现系统偏弱。</p>
          </div>
        </div>
        <div class="two-col-gap">
          <div class="gap-card">
            <h4>乌海侧重 · 数据与追溯</h4>
            <p>原料→成品全链路；DCS/PLC；送货单识别；SPC/CPK 与 OCAP；供应链门户。行业专属重 → 原则不接。</p>
          </div>
          <div class="gap-card emphasis">
            <h4>家联侧重 · 管理与合规</h4>
            <p>实验室资源（人机料危废）+ CNAS 深度流程 + MES/PLM + 大规模方法参数配置。缺口可复用 → <b>共创优先</b>，把定制做成高阶合规模块库。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>'''

# Rebuild slide list:
# 0-3 keep (cover..section)
# 4 = status (rewritten)
# then A, dilemma, opportunity, B, C, D
# then 17..end (原 18+)
new_secs = [m.group(0) for m in secs[:4]]
new_secs.append(status)
new_secs.extend([A, dilemma, opportunity, B, C, D])
new_secs.extend(m.group(0) for m in secs[17:])  # from 接还是不接

print("output slides", len(new_secs))

# stitch into document: replace from first section to last section
first = secs[0].start()
last = secs[-1].end()
body = "\n\n".join(new_secs) + "\n"
text = text[:first] + body + text[last:]

# bump cache key
text = re.sub(r"const KEY = 'shucan-seminar-deck-v\d+';", "const KEY = 'shucan-seminar-deck-v4';", text)

# renumber
secs2 = list(re.finditer(r"<section\b[^>]*class=\"[^\"]*\bslide\b[^\"]*\"[^>]*>[\s\S]*?</section>", text))
TOTAL = len(secs2)
parts = []
prev = 0
for i, m in enumerate(secs2, 1):
    block = m.group(0)
    block = re.sub(
        r"(SS · 26\.07\.27 · )\d{2} / \d{2}",
        lambda mm, i=i: f"{mm.group(1)}{i:02d} / {TOTAL:02d}",
        block,
    )
    block = re.sub(r">\s*\d{2} / \d{2}\s*<", f"> {i:02d} / {TOTAL:02d} <", block, count=1)
    parts.append(text[prev:m.start()])
    parts.append(block)
    prev = m.end()
parts.append(text[prev:])
text = "".join(parts)

path.write_text(text)
print("saved", path)
for i, m in enumerate(secs2, 1):
    print(f"{i:02d}", title_of(m.group(0))[:55])
print("fig2", "数据源与外部连接层" in path.read_text())
print("matrix24", "样品标准交付量配置" in path.read_text())
print("三层架构 removed", "现有 LIMS · 三层模块架构" not in path.read_text())
print("旧乌海明细 removed", "约 1,280 人天 · 低复用高投入" not in path.read_text())
