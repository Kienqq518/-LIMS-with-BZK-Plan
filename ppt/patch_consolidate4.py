#!/usr/bin/env python3
"""Consolidate capability/gap block into 4 slides; ensure status GAP matches fig2."""
from pathlib import Path
import re

path = Path("/workspace/ppt/index.html")
text = path.read_text()

# --- 1) Ensure status GAP column matches fig2 (full wording) ---
STATUS_GAP = '''
        <div class="col" style="display:flex;flex-direction:column;gap:1.0vh;padding-left:2vw">
          <span class="t-cat">GAP · 不够用（结构性）</span>
          <h3 style="font-weight:300;font-size:min(2.0vw,3.2vh);line-height:1.25">对照乌海 / 家联，缺口落在三层</h3>
          <div style="display:flex;flex-direction:column;gap:.8vh;overflow:auto">
            <div>
              <div style="font-size:max(14px,.92vw);font-weight:600;color:var(--ink)">① 数据源与外部连接层 <span class="mk-miss">差距最大 · 投入最重</span></div>
              <p style="font-size:max(12px,.78vw);line-height:1.35;color:var(--text-secondary);margin-top:.2vh">仪器数采/互联；ERP/MES/PLM/大宗物流/仓库集成；移动端（PDA/平板）。乌海报价里「仪器互联」单项约 125 人天 / 25 万，是所有条目里最贵的一项。</p>
            </div>
            <div>
              <div style="font-size:max(14px,.92vw);font-weight:600;color:var(--ink)">② 实验室资源与质量体系深度 <span class="mk-part">家联重 · 现系统几乎空白</span></div>
              <p style="font-size:max(12px,.78vw);line-height:1.35;color:var(--text-secondary);margin-top:.2vh">人员能力/上岗证；标准物质、试剂耗材、危化品与危废；设备全生命周期（点检/维保/维修/报废/现场仪器出入库）；CNAS 体系全套流程（内审/管评/不符合项/纠正/监督/质控计划）；CNAS 合规电子签章。</p>
            </div>
            <div>
              <div style="font-size:max(14px,.92vw);font-weight:600;color:var(--ink)">③ 智能化与决策层 <span class="mk-part">两项目都要 · 现系统偏弱</span></div>
              <p style="font-size:max(12px,.78vw);line-height:1.35;color:var(--text-secondary);margin-top:.2vh">检验方案链式建模；智能采样/制样/留样；任务自动调度；多级预警；异常复测 OCAP 闭环；SPC/CPK 统计；全链路追溯；供应链协作门户。</p>
            </div>
          </div>
        </div>'''

text = re.sub(
    r'<div class="col" style="display:flex;flex-direction:column;gap:1\.0vh;padding-left:2vw">[\s\S]*?</div>\s*</div>\s*</div>\s*</div>\s*</section>\s*\n\s*\n<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="已具备核心能力">',
    STATUS_GAP + '''
      </div>
    </div>
  </div>
</section>


<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="已具备核心能力">''',
    text,
    count=1,
)

# --- 2) Replace block from 已具备核心能力 through 差距结论与分项目 with 4 slides ---
# Keep 增长困境 + 商机 in between? Current order: 已具备, 困境, 商机, 家联乌海, 矩阵, 结论合并
# Target: 困境, 商机, then 4 pages: 基线, 矩阵, 结论, 按项目

FOUR = r'''
<section class="slide light" data-layout="S17" data-animate="system-diagram" data-title="现有系统能力基线">
  <div class="canvas-card">
    <div class="chrome-min"><div class="l">数蚕智能 · 产品定位研讨会</div><div class="r">BASELINE · 01</div></div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr auto;gap:1.2vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.45vh">
        <div class="t-meta">06 · 现有系统能力基线</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.4vw,6.2vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">一张图看清：三层架构已覆盖什么</h2>
        <p style="font-size:max(14px,.92vw);color:var(--text-secondary);line-height:1.4">合同/样品/试验/检测/报告/文件/基础数据 + 系统管理 + 工作台/可视化 —— 送检→检测→报告主流程可直接复用</p>
      </div>
      <div class="arch-stack">
        <div class="arch-layer">
          <div class="arch-hd"><b>03 · 数据分析层</b><span>工作台 · 可视化驾驶舱 · ★★★</span></div>
          <div class="arch-bd cols-2">
            <div class="mod"><b>工作台</b><span>数据概览 / 任务总览 / 委托统计 / 待办 / 趋势占比</span></div>
            <div class="mod"><b>数字可视化</b><span>业务/客户/样品/财务/时效/经营驾驶舱（深度 SPC 仍弱）</span></div>
          </div>
        </div>
        <div class="arch-layer accent">
          <div class="arch-hd"><b>02 · 业务运营层（最强）</b><span>委托→样品→试验→报告 · ★★★★</span></div>
          <div class="arch-bd cols-4">
            <div class="mod"><b>合同 · 委托</b><span>登记 / 确认 / 费用 / 变更</span></div>
            <div class="mod"><b>样品 · 试验</b><span>收制备发还 / 分发检测审核</span></div>
            <div class="mod"><b>检测 · 报告</b><span>判定 / 编制签发 / 发放归档</span></div>
            <div class="mod"><b>文件 · 基础数据</b><span>标准文件 / 客户场地 / 设备台账</span></div>
          </div>
        </div>
        <div class="arch-layer">
          <div class="arch-hd"><b>01 · 系统管理层</b><span>平台底座 · ★★★★</span></div>
          <div class="arch-bd cols-3">
            <div class="mod"><b>平台管理</b><span>菜单 / 角色 / 部门 / 用户</span></div>
            <div class="mod"><b>日志 · 审计</b><span>登录 / 操作 / 浏览</span></div>
            <div class="mod"><b>基础配置</b><span>流程 / 参数 / 字典 / 微信</span></div>
          </div>
        </div>
      </div>
      <div class="call-note"><b>对照两项目：</b>乌海报价「标准模块」、家联「检测业务流程管理」——核心送检→检测→报告主流程<b>基本可直接复用</b>。设备/文件/用户多为台账级，缺生命周期与合规深度。</div>
    </div>
  </div>
</section>

<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="差距总表24">
  <div class="canvas-card">
    <div class="chrome-min"><div class="l">数蚕智能 · 产品定位研讨会</div><div class="r">MATRIX · 02</div></div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto auto 1fr;gap:.55vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.2vh">
        <div class="t-meta">06 · 差距总表（能力矩阵）</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(2.9vw,5.2vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">现有系统 × 乌海 × 家联 · 24 项一张看清</h2>
      </div>
      <div class="legend-row">
        <span><b class="mk-ok">✅</b>已有</span>
        <span><b class="mk-part">🟡</b>部分</span>
        <span><b class="mk-miss">❌</b>缺失</span>
        <span>「-」未强诉求</span>
      </div>
      <div class="tbl-wrap">
        <table class="swiss-tbl dense gap-mx">
          <thead><tr><th style="width:4%">#</th><th>能力项</th><th style="width:8%">现有</th><th style="width:8%">乌海</th><th style="width:8%">家联</th><th style="width:14%">差距</th></tr></thead>
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
            <tr><td>13</td><td>SPC / CPK 统计分析</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">缺失</td></tr>
            <tr><td>14</td><td>移动端（PDA/平板）</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">缺失</td></tr>
            <tr><td>15</td><td>系统集成（ERP/MES/PLM）</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>16</td><td>全链路追溯</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">缺失</td></tr>
            <tr><td>17</td><td>供应链协作门户</td><td class="c mk-miss">❌</td><td class="c mk-ok">✅</td><td class="c">-</td><td class="mk-miss">缺失</td></tr>
            <tr><td>18</td><td>人员管理（能力授权）</td><td class="c mk-miss">❌</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>19</td><td>标准物质管理</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>20</td><td>试剂 / 耗材管理</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>21</td><td>危化品 / 危废管理</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>22</td><td>设备全生命周期</td><td class="c mk-part">🟡</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>23</td><td>质量体系 CNAS 流程</td><td class="c mk-part">🟡</td><td class="c mk-part">🟡</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
            <tr><td>24</td><td>样品标准交付量配置</td><td class="c mk-miss">❌</td><td class="c">-</td><td class="c mk-ok">✅</td><td class="mk-miss">缺失</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</section>

<section class="slide light" data-layout="S19" data-animate="four-cards" data-title="差距结论三类">
  <div class="canvas-card">
    <div class="chrome-min"><div class="l">数蚕智能 · 产品定位研讨会</div><div class="r">CONCLUSION · 03</div></div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto auto 1fr;gap:1.1vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.4vh">
        <div style="width:80px;height:3px;background:var(--accent)"></div>
        <div class="t-meta">06 · 结论</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.0vw,5.4vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">主流程已覆盖 · 真正缺失集中在三类</h2>
      </div>
      <div class="call-note" style="margin:0">对照现有系统（合同/样品/试验/检测/报告/文件/基础数据 + 系统管理 + 工作台/可视化三层架构），两个项目要求的核心「送检→检测→报告」主流程已覆盖——乌海报价「标准模块」、家联「检测业务流程管理」基本可直接复用。</div>
      <div class="gap-3">
        <div class="gap-card emphasis">
          <h4>① 数据源与外部连接层</h4>
          <p style="font-size:max(13px,.84vw)"><b>差距最大、投入最重。</b>仪器数采/互联；ERP/MES/PLM/大宗物流/仓库集成；移动端（PDA/平板）。乌海报价里「仪器互联」单项就占 <b>125 人天 / 25 万</b>，是所有条目里最贵的一项。</p>
        </div>
        <div class="gap-card">
          <h4>② 实验室资源与质量体系深度</h4>
          <p style="font-size:max(13px,.84vw)"><b>家联重、现系统几乎空白。</b>人员能力/上岗证；标准物质、试剂耗材、危化品与危废；设备全生命周期（点检/维保/维修/报废/现场仪器出入库）；CNAS 体系全套流程（内审/管评/不符合项/纠正/监督/质控计划）；CNAS 合规电子签章。</p>
        </div>
        <div class="gap-card">
          <h4>③ 智能化与决策层</h4>
          <p style="font-size:max(13px,.84vw)"><b>两个项目都要、现系统偏弱。</b>检验方案链式建模；智能采样/制样/留样；任务自动调度；多级预警；异常复测 OCAP 闭环；SPC/CPK 统计；全链路追溯；供应链协作门户。</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="slide light" data-layout="S08" data-animate="duo-mirror" data-title="按项目归纳">
  <div class="canvas-card">
    <div class="chrome-min"><div class="l">数蚕智能 · 产品定位研讨会</div><div class="r">BY PROJECT · 04</div></div>
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto auto 1fr;gap:1.3vh;min-height:0">
      <div data-anim="head" style="display:grid;gap:.45vh">
        <div class="t-meta">06 · 按项目归纳</div>
        <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(3.4vw,6.2vh);line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">互补性很强：一个偏追溯，一个偏合规</h2>
      </div>
      <div class="call-note" style="margin:0"><b>共同刚需（优先）：</b>仪器互联、系统集成中间件、移动端支持、留样管理、任务排程、电子签章。</div>
      <div class="duo-compare" style="align-items:stretch;margin-top:0!important">
        <div class="col" style="display:flex;flex-direction:column;gap:1.1vh;padding-right:1.6vw">
          <span class="t-cat">乌海 · 煤焦化 · 偏数据与追溯</span>
          <h3 style="font-weight:300;font-size:min(2.2vw,3.5vh);line-height:1.25;color:var(--ink)">原料→成品全链路 + 数采重投入</h3>
          <ul class="clean-list">
            <li>仪器互联单项 25 万 / 125 人天（最重）</li>
            <li>DCS/PLC、智能化采样、送货单识别</li>
            <li>SPC/CPK、多级预警、OCAP 失控闭环</li>
            <li>供应链协作门户与质量数据平台</li>
            <li>报价约 76.8 万 · ~1,280 人天 · 行业专属重</li>
          </ul>
          <div class="tag-pill avoid">复用低 · 原则不接</div>
        </div>
        <span class="vrule"></span>
        <div class="col" style="display:flex;flex-direction:column;gap:1.1vh;padding-left:1.6vw">
          <span class="t-cat" style="color:var(--accent)">家联 · 制造 QC · 偏管理与合规</span>
          <h3 style="font-weight:300;font-size:min(2.2vw,3.5vh);line-height:1.25;color:var(--ink)">实验室资源 + CNAS 体系深度</h3>
          <ul class="clean-list">
            <li>人 / 机 / 料 / 危废全资源管理（现系统几乎空白）</li>
            <li>CNAS 全套流程 + 合规电子签章</li>
            <li>设备全生命周期、标物/耗材、标准交付量配置</li>
            <li>MES/PLM 对接；约 1000 检测参数配置</li>
            <li>明确模块约 34 万 · 全量约 15–20 人月</li>
          </ul>
          <div class="tag-pill pick">可沉淀高阶合规模块 · 共创优先</div>
        </div>
      </div>
    </div>
  </div>
</section>
'''

# Find and replace: from 已具备核心能力 through 差距结论与分项目 inclusive,
# but PRESERVE 增长困境 and 商机 slides that sit between them.
#
# Strategy: extract 困境 + 商机, then replace the whole span 已具备...结论合并 with:
#   困境 + 商机 + FOUR

m_start = re.search(r'<section class="slide light" data-layout="S21" data-animate="tech-spec" data-title="已具备核心能力">', text)
m_end = re.search(r'<section class="slide light" data-layout="S19" data-animate="four-cards" data-title="差距结论与分项目">[\s\S]*?</section>', text)
if not m_start or not m_end:
    # try alternate titles
    m_start = re.search(r'data-title="已具备核心能力"[\s\S]*?<section', text)
    raise SystemExit(f'anchors not found start={bool(m_start)} end={bool(m_end)}')

block = text[m_start.start(): m_end.end()]

# Extract dilemma + opportunity if present
dil = re.search(r'<section class="slide light" data-layout="S13"[\s\S]*?</section>', block)
opp = re.search(r'<section class="slide light" data-layout="S03"[\s\S]*?</section>', block)
kept = []
if dil:
    kept.append(dil.group(0))
if opp:
    kept.append(opp.group(0))

replacement = ("\n\n".join(kept) + ("\n\n" if kept else "") + FOUR.strip() + "\n")
text = text[:m_start.start()] + replacement + text[m_end.end():]
print("replaced capability/gap block; kept", len(kept), "narrative slides")

# Bump edit cache key
text = re.sub(r"const KEY = 'shucan-seminar-deck-v\d+';", "const KEY = 'shucan-seminar-deck-v4';", text)

# Renumber
secs = list(re.finditer(r'<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>[\s\S]*?</section>', text))
TOTAL = len(secs)
parts = []
last = 0
for i, m in enumerate(secs, 1):
    b = m.group(0)
    b = re.sub(r'(SS · 26\.07\.27 · )\d{2} / \d{2}', lambda mm, i=i: f'{mm.group(1)}{i:02d} / {TOTAL:02d}', b)
    b = re.sub(r'>\s*\d{2} / \d{2}\s*<', f'> {i:02d} / {TOTAL:02d} <', b, count=1)
    parts.append(text[last:m.start()])
    parts.append(b)
    last = m.end()
parts.append(text[last:])
text = "".join(parts)

path.write_text(text)
print("total slides", TOTAL)
for i, s in enumerate(re.finditer(r'<section\b[^>]*class="[^"]*\bslide\b[^"]*"[^>]*>[\s\S]*?</section>', path.read_text()), 1):
    mm = re.search(r'<h[12][^>]*>([\s\S]*?)</h[12]>', s.group(0))
    title = re.sub(r'<[^>]+>', '', mm.group(1)).replace('\n', ' ').strip()[:55] if mm else '?'
    if i <= 14:
        print(f'{i:02d}', title)
