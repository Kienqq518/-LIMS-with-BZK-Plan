#!/usr/bin/env python3
"""Build Swiss IKB seminar deck slides and splice into template."""
from pathlib import Path

TOTAL = 26
DECK = "数蚕智能 · 产品定位研讨会"
DATE = "26.07.27"

def chrome(n, right=""):
    r = right or f"SS · {DATE} · {n:02d} / {TOTAL:02d}"
    return f'''    <div class="chrome-min">
      <div class="l">{DECK}</div>
      <div class="r">{r}</div>
    </div>'''

def head(kicker, title, sub=None, size="min(4.6vw,8.2vh)"):
    sub_html = ""
    if sub:
        sub_html = f'''\n      <p data-anim="lead" style="margin-top:1.2vh;max-width:68ch;font-size:max(16px,1.05vw);line-height:1.5;font-weight:400;color:var(--text-secondary)">{sub}</p>'''
    return f'''    <div data-anim="head" style="display:grid;gap:1vh">
      <div class="t-meta">{kicker}</div>
      <h2 style="font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:{size};line-height:1.05;letter-spacing:-.03em;color:var(--text-primary)">{title}</h2>{sub_html}
    </div>'''

slides = []

# 01 Cover
slides.append(f'''
<section class="slide accent" data-layout="S01" data-animate="hero">
  <div class="canvas-card">
    <canvas class="ascii-bg" aria-hidden="true"></canvas>
{chrome(1, f"SS · {DATE} · 01 / {TOTAL:02d}")}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr auto;gap:2.6vh">
      <div data-anim="kicker" class="t-meta" style="color:rgba(255,255,255,.78);letter-spacing:.22em">PRODUCT STRATEGY · SEMINAR</div>
      <h1 data-anim="title" style="align-self:center;font-family:var(--sans),var(--sans-zh);font-weight:200;font-size:min(5.8vw,10.2vh);line-height:.98;letter-spacing:-.025em;color:#fff">数蚕智能 · 产品定位<br/>与未来发展<span style="font-style:italic;font-weight:300">方向</span></h1>
      <div data-anim="bottom" style="display:grid;grid-template-rows:auto auto;gap:1.6vh;border-top:1px solid rgba(255,255,255,.22);padding-top:2vh">
        <div data-anim="lead" class="lead" style="max-width:56ch;color:rgba(255,255,255,.86);font-weight:300">明确产品边界 · 锚定核心差异 · 确立市场策略</div>
        <div style="display:flex;justify-content:space-between;align-items:end">
          <div class="t-meta" style="color:rgba(255,255,255,.6)">专题研讨会 · 2026 年 7 月 27 日</div>
          <div class="t-meta" style="color:rgba(255,255,255,.6)">→ swipe / arrow keys</div>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 02 Meeting purpose
slides.append(f'''
<section class="slide light" data-layout="S08" data-animate="duo-mirror">
  <div class="canvas-card">
{chrome(2)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:3vh">
{head("02 · PURPOSE", "会议目的", "今天必须对齐的一件事，以及可以超出预期的收获")}
      <div class="duo-compare" style="align-items:stretch">
        <div class="duo-half" style="display:flex;flex-direction:column;gap:2vh;padding-right:2vw">
          <span class="t-cat">MUST · 务必完成</span>
          <h3 style="font-weight:300;font-size:min(2.6vw,4.2vh);line-height:1.25;letter-spacing:-.02em">讨论清楚 LIMS<br/>后续要拓展的<span style="color:var(--accent)">行业</span></h3>
          <p style="font-size:max(16px,1.05vw);line-height:1.55;color:var(--text-secondary);font-weight:400">这决定了数蚕后续主营业务的走向——不是功能清单讨论，而是赛道选择。</p>
        </div>
        <span class="vrule"></span>
        <div class="duo-half" style="display:flex;flex-direction:column;gap:2vh;padding-left:2vw">
          <span class="t-cat">BONUS · 超出预期</span>
          <h3 style="font-weight:300;font-size:min(2.6vw,4.2vh);line-height:1.25;letter-spacing:-.02em">给予各业务线<br/>功能 / 优化 / 经营建议</h3>
          <p style="font-size:max(16px,1.05vw);line-height:1.55;color:var(--text-secondary);font-weight:400">在主议题之上，开放对产品边界、交付方式与经营护栏的补充意见。</p>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 03 Agenda
slides.append(f'''
<section class="slide light" data-layout="S05" data-animate="sub-stack">
  <div class="canvas-card">
{chrome(3)}
    <div class="grid-2-9" style="flex:1;min-height:0">
      <div class="lead-col" style="display:flex;flex-direction:column;gap:2vh;justify-content:center">
        <span class="t-cat">03 · AGENDA</span>
        <h2 class="h-xl" style="font-size:min(4.8vw,8.4vh);font-weight:200;line-height:1.05">会议议程<br/>三环节</h2>
        <p style="font-size:max(16px,1.05vw);line-height:1.5;color:var(--text-secondary);max-width:28ch">第一环节输入事实与推断；第二环节碰撞行业；第三环节补定位与重心。</p>
      </div>
      <div class="sub-card-stack">
        <article class="card-fill sub-card">
          <span class="big-num">01</span>
          <h4>第一环节 · 15–30 min</h4>
          <p>同步数蚕产品现状与后续规划：全部现状、市场研判、策略推断、商机分析</p>
        </article>
        <article class="card-accent sub-card">
          <span class="big-num">02</span>
          <h4>第二环节 · 45–60 min</h4>
          <p>一起碰撞讨论主营产品 LIMS 的行业拓展，以及新增功能建议</p>
        </article>
        <article class="card-fill sub-card">
          <span class="big-num">03</span>
          <h4>第三环节 · 后续占位</h4>
          <p>一起探讨数蚕的产品定位、规划和工作重心</p>
        </article>
      </div>
    </div>
  </div>
</section>
''')

# 04 Section divider - 第一环节
slides.append(f'''
<section class="slide dark" data-layout="S09" data-animate="matrix-statement">
  <div class="canvas-card">
{chrome(4, "SECTION · 01")}
    <span class="ring-mat" style="left:5vw;bottom:8vh;width:16vw;height:16vw"></span>
    <span class="dot-mat" style="right:0;top:8vh;width:32vw;height:32vw"></span>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:2.4vh;position:relative;z-index:1">
      <div class="t-meta" style="color:rgba(255,255,255,.65)">第一环节 · 15–30 MIN</div>
      <h1 class="h-statement" style="font-size:min(5.2vw,9.2vh);color:#fff;font-weight:200">现状 · 市场 · 策略 · 商机</h1>
      <p style="max-width:48ch;font-size:max(16px,1.1vw);color:rgba(255,255,255,.72);font-weight:400;line-height:1.55">先把能力边界、增长困境与两条战略方向摊开，再决定行业与接单标准。</p>
    </div>
  </div>
</section>
''')

# 05 Status 够用/不够用
slides.append(f'''
<section class="slide light" data-layout="S08" data-animate="duo-mirror">
  <div class="canvas-card">
{chrome(5)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:2.4vh">
{head("04 · STATUS", "现状盘点：能力与边界", "够用的是流程闭环；不够用的是从流程系统到平台的结构性差距")}
      <div class="duo-compare" style="align-items:stretch">
        <div class="duo-half" style="display:flex;flex-direction:column;gap:1.6vh;padding-right:2vw">
          <span class="t-cat" style="color:var(--accent)">ENOUGH · 够用</span>
          <h3 style="font-weight:300;font-size:min(2.4vw,3.8vh);line-height:1.3">电力检测<br/>「委托 → 报告」闭环成熟</h3>
          <p style="font-size:max(16px,1.02vw);line-height:1.5;color:var(--text-secondary)">合同 / 样品 / 试验 / 报告主线可用；配置化与可视化有底子；与应敏数采有协同基础。</p>
        </div>
        <span class="vrule"></span>
        <div class="duo-half" style="display:flex;flex-direction:column;gap:1.6vh;padding-left:2vw">
          <span class="t-cat">GAP · 不够用（结构性）</span>
          <h3 style="font-weight:300;font-size:min(2.4vw,3.8vh);line-height:1.3">缺「实验室资源与<br/>质量合规」整层 + 统计决策</h3>
          <p style="font-size:max(16px,1.02vw);line-height:1.5;color:var(--text-secondary)">设备全生命周期 / 标物 / 耗材 / 危化品 / 人员上岗证 / CNAS 体系 —— 是「流程系统 → 平台」的差距，不是几个功能补丁。</p>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 06 Architecture 插图2 + 困境阵痛
slides.append(f'''
<section class="slide light" data-layout="S17" data-animate="system-diagram">
  <div class="canvas-card">
{chrome(6)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:2vh;min-height:0">
{head("04 · ARCHITECTURE · 插图2", "现有 LIMS · 三层模块架构", "系统管理层 · 业务运营层 · 数据分析层 —— 主线在业务层，资源合规与深度决策仍薄")}
      <div class="arch-stack">
        <div class="arch-layer">
          <div class="arch-hd"><b>03 · 数据分析层</b><span>工作台 · 数字可视化驾驶舱</span></div>
          <div class="arch-bd cols-2">
            <div class="mod"><b>工作台</b><span>数据概览 / 任务总览 / 委托统计 / 待办 / 趋势与占比</span></div>
            <div class="mod"><b>数字可视化</b><span>业务 / 客户 / 样品 / 财务 / 时效 / 经营驾驶舱</span></div>
          </div>
        </div>
        <div class="arch-layer accent">
          <div class="arch-hd"><b>02 · 业务运营层</b><span>委托→样品→试验→报告 主线成熟</span></div>
          <div class="arch-bd cols-4">
            <div class="mod"><b>合同·样品·试验</b><span>登记确认 / 收制备发还 / 分发检测审核</span></div>
            <div class="mod"><b>检测·报告</b><span>判定规则 / 编制签发 / 发放归档</span></div>
            <div class="mod"><b>文件·基础数据</b><span>标准文件 / 客户场地 / 设备台账</span></div>
            <div class="mod gap"><b>结构性缺口</b><span>资源合规整层 + 统计决策深度不足</span></div>
          </div>
        </div>
        <div class="arch-layer">
          <div class="arch-hd"><b>01 · 系统管理层</b><span>平台运行、权限与基础配置</span></div>
          <div class="arch-bd cols-3">
            <div class="mod"><b>平台管理</b><span>菜单 / 角色 / 部门 / 用户</span></div>
            <div class="mod"><b>日志管理</b><span>登录 / 操作 / 浏览</span></div>
            <div class="mod"><b>基础配置</b><span>流程 / 参数 / 字典 / 微信</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 07 困境 + 阵痛
slides.append(f'''
<section class="slide light" data-layout="S13" data-animate="three-forces">
  <div class="canvas-card">
{chrome(7)}
    <div class="three-forces" style="flex:1;min-height:0">
      <div class="hero-ink-col">
        <span class="t-cat" style="color:rgba(255,255,255,.7)">05 · CONSTRAINT</span>
        <h2 style="font-weight:200;font-size:min(3.8vw,6.8vh);line-height:1.1;color:#fff;margin-top:2vh">增长困境<br/>与转型阵痛</h2>
        <p style="margin-top:2vh;font-size:max(15px,1vw);line-height:1.5;color:rgba(255,255,255,.72);max-width:22ch">电网指定供应商 → 电力盘子销路封顶。开放市场则带来确定性丧失与定制碎片化。</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:1.4vh;min-height:0">
        <article class="card-fill force-card">
          <div class="force-num">01</div>
          <div>
            <h4>困境 · 销路封顶</h4>
            <p>电网指定供应商格局下，电力检测订单确定性高但增量有限——功能够用，增长却到顶。</p>
          </div>
        </article>
        <article class="card-fill force-card">
          <div class="force-num">02</div>
          <div>
            <h4>阵痛 · 确定性丧失</h4>
            <p>进入开放市场后，需求高压、标准多样；不再有“指定供应商”的天然保障。</p>
          </div>
        </article>
        <article class="card-accent force-card">
          <div class="force-num">03</div>
          <div>
            <h4>风险 · 研发碎片化</h4>
            <p>逐单定制会摊薄研发、沉淀不下通用产品——这正是后面接单护栏要拦住的事。</p>
          </div>
        </article>
      </div>
    </div>
  </div>
</section>
''')

# 08 商机两难 intro
slides.append(f'''
<section class="slide dark" data-layout="S03" data-animate="statement-rise">
  <div class="canvas-card">
{chrome(8, "OPPORTUNITY")}
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:3vh">
      <div class="t-meta" style="color:rgba(255,255,255,.65)">06 · 商机现状</div>
      <h1 class="h-statement" style="font-size:min(4.8vw,8.6vh);color:#fff;font-weight:200">
        <span>应敏销售已有线索</span><br>
        <span>现有 LIMS <em style="font-style:italic;font-weight:300">不够覆盖</em></span>
      </h1>
      <p style="max-width:52ch;font-size:max(16px,1.1vw);color:rgba(255,255,255,.72);line-height:1.55">普遍需要高度定制 —— 典型两难。家联与乌海，正是两类代表性项目。</p>
    </div>
  </div>
</section>
''')

# 09 家联 vs 乌海 插图3/4
slides.append(f'''
<section class="slide light" data-layout="S08" data-animate="duo-mirror">
  <div class="canvas-card">
{chrome(9)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:2vh;min-height:0">
{head("06 · 插图3 / 插图4", "家联 vs 乌海：两类代表性项目", "左边能沉淀成通用模块；右边是重定制红海样本")}
      <div class="duo-compare" style="align-items:stretch;gap:0">
        <div class="duo-half" style="display:flex;flex-direction:column;gap:1.2vh;padding-right:1.6vw">
          <span class="t-cat" style="color:var(--accent)">家联科技 · 制造 QC · 插图3</span>
          <h3 style="font-weight:300;font-size:min(2.2vw,3.6vh)">基础层 + 业务层 + 扩展层</h3>
          <ul class="clean-list">
            <li>检测主流程清晰，需求聚焦约 34 万模块</li>
            <li>新建重点：设备 / 标物 / 耗材 / 危化品 / 人员证 / CNAS</li>
            <li>多为可复用“高阶合规模块”，试水成本可控</li>
          </ul>
          <div class="tag-pill pick">倾向：接 · 共创标杆</div>
        </div>
        <span class="vrule"></span>
        <div class="duo-half" style="display:flex;flex-direction:column;gap:1.2vh;padding-left:1.6vw">
          <span class="t-cat">乌海 · 焦化 QMS · 插图4</span>
          <h3 style="font-weight:300;font-size:min(2.2vw,3.6vh)">方法拆解 + 智能采样 + MES</h3>
          <ul class="clean-list">
            <li>行业专属重：标准拆解、智能化采样制样、OCAP</li>
            <li>扩展层含数采平台、ERP/MES、供应链门户</li>
            <li>定制沉淀难复用，投入挤占产品化节奏</li>
          </ul>
          <div class="tag-pill avoid">倾向：不接 · 护栏外</div>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 10 接还是不接 + 两条方向
slides.append(f'''
<section class="slide light" data-layout="S05" data-animate="sub-stack">
  <div class="canvas-card">
{chrome(10)}
    <div class="grid-2-9" style="flex:1;min-height:0">
      <div class="lead-col" style="display:flex;flex-direction:column;gap:2vh;justify-content:center">
        <span class="t-cat">07 · DECISION</span>
        <h2 class="h-xl" style="font-size:min(4.2vw,7.6vh);font-weight:200;line-height:1.08">接还是不接？<br/>标准是什么</h2>
        <p style="font-size:max(16px,1.05vw);line-height:1.5;color:var(--text-secondary);max-width:28ch">根据现状，先立两条战略方向，再用评分表做接单裁决。</p>
      </div>
      <div class="sub-card-stack">
        <article class="card-accent sub-card">
          <span class="big-num">A</span>
          <h4>战略方向一 · 重新定义产品</h4>
          <p>不做「传统 LIMS 定制版」，做软硬一体的「透明检测系统」——轻量、通用、低成本、入口级。</p>
        </article>
        <article class="card-fill sub-card">
          <span class="big-num">B</span>
          <h4>战略方向二 · 锚定行业共创</h4>
          <p>先锚定一个行业试水；与标杆客户共创缺失能力；把一次性定制转化为可复用资产。</p>
        </article>
        <article class="card-fill sub-card">
          <span class="big-num">C</span>
          <h4>接单硬标准（预告）</h4>
          <p>可复用度（最高权重）· 认可价值主张 · 属锚定行业 · 毛利/人天 · 交付挤占。</p>
        </article>
      </div>
    </div>
  </div>
</section>
''')

# 11 Direction 1 + positioning matrix
slides.append(f'''
<section class="slide light" data-layout="S15" data-animate="matrix-fill">
  <div class="canvas-card">
{chrome(11)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto auto 1fr auto;gap:2vh;min-height:0">
{head("07 · DIRECTION 01", "重新定义：透明检测系统", "拒绝低价定制红海；融合软件 + 物联网传感器的入口级解决方案")}
      <div class="matrix-fill" style="grid-template-columns:repeat(4,1fr);gap:1.2vh">
        <div class="matrix-cell card-fill"><div class="mc-t">拒绝</div><div class="mc-d">不以低价卷入定制化红海；不把自己定义为「传统 LIMS 的定制版」</div></div>
        <div class="matrix-cell card-accent"><div class="mc-t">重新定义</div><div class="mc-d">软件 + IoT · 轻量化 · 通用性 · 低成本 · 入口级 = 透明检测系统</div></div>
        <div class="matrix-cell card-fill"><div class="mc-t">核心价值</div><div class="mc-d">帮客户从「无系统」快速跨越到「有系统」，而非全面替代重系统</div></div>
        <div class="matrix-cell card-fill"><div class="mc-t">生态协同</div><div class="mc-d">结合「安全管家」，形成纯软件玩家给不了的差异化可信溢价</div></div>
      </div>
      <div class="pos-matrix">
        <div class="pm-y">高投入</div>
        <div class="pm-grid">
          <div class="pm-cell">全面定制<br/><span>高投入</span></div>
          <div class="pm-cell">重平台<br/><span>高投入</span></div>
          <div class="pm-cell muted">廉价定制<br/><span>低投入红海</span></div>
          <div class="pm-cell pick">★ 透明检测系统<br/><span>轻量入口 · 低成本</span></div>
        </div>
        <div class="pm-x"><span>轻量入口</span><span>全面定制</span></div>
      </div>
      <p style="font-size:max(14px,.95vw);color:var(--text-helper);font-weight:500">客户策略：主动筛选认可价值主张的群体，拒绝当「陪跑者」。</p>
    </div>
  </div>
</section>
''')

# 12 Direction 2 path
slides.append(f'''
<section class="slide light" data-layout="S11" data-animate="timeline-walk">
  <div class="canvas-card">
{chrome(12)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr auto;gap:3vh">
{head("07 · DIRECTION 02", "锚定行业 · 合作共创", "先打透一个行业；定价看战略意义；把定制投入变成可复用产品资产")}
      <div class="timeline-h" style="align-self:center">
        <span class="tl-h-axis"></span>
        <div class="tl-h-node"><span class="num">01</span><span class="dot"></span><span class="lbl">选定行业</span></div>
        <div class="tl-h-node"><span class="num">02</span><span class="dot"></span><span class="lbl">标杆共创</span></div>
        <div class="tl-h-node"><span class="num">03</span><span class="dot"></span><span class="lbl">沉淀模块</span></div>
        <div class="tl-h-node"><span class="num">04</span><span class="dot"></span><span class="lbl">复制推广</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1.6vh">
        <div class="card-fill" style="padding:2vh 1.6vw">
          <div class="t-meta">打法</div>
          <p style="margin-top:1vh;font-size:max(16px,1.05vw);line-height:1.45;color:var(--text-secondary)">集中资源打透一个行业，不广撒网。</p>
        </div>
        <div class="card-fill" style="padding:2vh 1.6vw">
          <div class="t-meta">定价逻辑</div>
          <p style="margin-top:1vh;font-size:max(16px,1.05vw);line-height:1.45;color:var(--text-secondary)">不只看成本，更看战略意义——可复用度够高时允许战略性亏损。</p>
        </div>
        <div class="card-accent" style="padding:2vh 1.6vw">
          <div class="t-meta" style="color:var(--accent-on)">目标</div>
          <p style="margin-top:1vh;font-size:max(16px,1.05vw);line-height:1.45;color:var(--accent-on)">一次性定制 → 可复用产品资产</p>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 13 Which industry divider
slides.append(f'''
<section class="slide accent" data-layout="S09" data-animate="matrix-statement">
  <div class="canvas-card">
    <canvas class="ascii-bg" aria-hidden="true"></canvas>
{chrome(13, "INDUSTRY")}
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:2.4vh;position:relative;z-index:1">
      <div class="t-meta" style="color:rgba(255,255,255,.75)">08 · 锚定哪个行业</div>
      <h1 style="font-weight:200;font-size:min(5.2vw,9.2vh);line-height:1.05;color:#fff;letter-spacing:-.03em">三报告交叉筛选</h1>
      <p style="max-width:54ch;font-size:max(16px,1.1vw);color:rgba(255,255,255,.8);line-height:1.55">筛选轴：无系统客户密度 · 未被巨头深度领跑 · 透明/数采价值感知强 · 有在手线索 · 合规可承受</p>
    </div>
  </div>
</section>
''')

# 14 Industry table 插图5
slides.append(f'''
<section class="slide light" data-layout="S21" data-animate="tech-spec">
  <div class="canvas-card">
{chrome(14)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr auto;gap:1.8vh;min-height:0">
{head("08 · 插图5", "候选行业交叉筛选", "来源：竞争格局报告 × SaaS 报告 × 检验检测统计简报")}
      <div class="tbl-wrap">
        <table class="swiss-tbl">
          <thead>
            <tr><th>候选</th><th>无系统池</th><th>巨头锁定</th><th>透明检测价值</th><th>结论</th></tr>
          </thead>
          <tbody>
            <tr class="row-pick">
              <td>制造 QC<br/><span class="sub">电子电器/机械/材料 + 区域小型第三方</span></td>
              <td>中高<br/><span class="sub">新兴上升、方法更新快</span></td>
              <td>巨头攻头部集团<br/><span class="sub">中小内检空白</span></td>
              <td>高<br/><span class="sub">对下游/品牌举证与数采强</span></td>
              <td class="pick">★★ 首锚</td>
            </tr>
            <tr>
              <td>机动车检验</td>
              <td>极高<br/><span class="sub">14,880 / 25.2%</span></td>
              <td>金现代 / 网星广泛</td>
              <td>中高<br/><span class="sub">造假痛点，但诉求单一、工位数采壁垒</span></td>
              <td class="warn">观察 · 第二波</td>
            </tr>
            <tr>
              <td>建筑工程 / 环境</td>
              <td>极高但白热化<br/><span class="sub">退回 Excel、降本压力大</span></td>
              <td>金现代 / 网星深度领跑</td>
              <td>低<br/><span class="sub">价格血战，溢价难被接受</span></td>
              <td class="avoid">△ / ×</td>
            </tr>
            <tr>
              <td>化工 / 药品 / 疾控 / 采矿</td>
              <td>—</td>
              <td>创腾 / 网星 / 三维天地<br/><span class="sub">强壁垒</span></td>
              <td>—</td>
              <td class="avoid">× 避</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style="font-size:max(15px,1vw);color:var(--text-secondary);font-weight:500">→ 首锚「制造业质检（内检 QC + 区域小型第三方检测）」</p>
    </div>
  </div>
</section>
''')

# 15 Three decisive facts
slides.append(f'''
<section class="slide light" data-layout="S18" data-animate="why-now">
  <div class="canvas-card">
{chrome(15)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:2.4vh">
{head("09 · FACTS", "三条决定性事实", "来自 LIMS 竞争格局报告与轻量化 SaaS 报告的交叉结论")}
      <div class="why-now-grid">
        <div class="why-col">
          <span class="t-cat">FACT 01</span>
          <h3>市场够大、增长、被专业化割据</h3>
          <p>全球 28.8 亿$→51.9 亿，CAGR 12.5%。五家各据重赛道：三维天地 / 金现代 / 创腾 / 网星 / 白码。</p>
          <div class="why-num-bottom">12.5%</div>
        </div>
        <div class="why-col">
          <span class="t-cat">FACT 02</span>
          <h3>我们竞争在错误的轴上</h3>
          <p>头部武器＝低代码 + 数采 99% + 不限用户 + 三合一/MDM + AI。我们＝简单 + 高度定制 → 双输。</p>
          <div class="why-num-bottom">双输</div>
        </div>
        <div class="why-col accent">
          <span class="t-cat">FACT 03</span>
          <h3>低端蓝海已被量化证实</h3>
          <p>96.43% 是 100 人以下小微；超 5 万家无系统；规上 13.43% 拿走 78.68% 营收。入口价千元级。</p>
          <div class="why-num-bottom accent">5万+</div>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 16 Manufacturing first
slides.append(f'''
<section class="slide light" data-layout="S19" data-animate="four-cards">
  <div class="canvas-card">
{chrome(16)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:2.4vh">
      <div>
        <div style="width:80px;height:3px;background:var(--accent);margin-bottom:2vh"></div>
{head("10 · FIRST ANCHOR", "首选制造业质检", "筛选逻辑：轻量入口级 + IoT + 无系统客户多 + 现有在手线索")}
      </div>
      <div class="four-cards">
        <div class="fc-col">
          <div class="t-meta">— 01 / BLUE OCEAN</div>
          <h3>最大无系统蓝海</h3>
          <p>大量制造企业内部 QC 落在 54,340 家 CMA 统计口径之外，正是「无系统→有系统」的主战场。</p>
        </div>
        <div class="fc-col">
          <div class="t-meta">— 02 / PREMIUM</div>
          <h3>避开价格血战</h3>
          <p>机动车 / 建工 / 环境池子更大，但纯软件已白热化。制造 QC 对「数采 / 透明 / 质量举证」价值感知强，能支撑软硬一体溢价。</p>
        </div>
        <div class="fc-col">
          <div class="t-meta">— 03 / LEAD</div>
          <h3>家联可谈共创</h3>
          <p>真实潜在共创对象，需求聚焦约 34 万明确模块；不像乌海那样重，试水成本显著更低。</p>
        </div>
        <div class="fc-col">
          <div class="t-meta">— 04 / FIT</div>
          <h3>差异点正好对口</h3>
          <p>制造 QC 场景天然需要过程可信与数采闭环，正好展示应敏软硬一体的不可替代点。</p>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 17 SaaS screening 插图6
slides.append(f'''
<section class="slide light" data-layout="S16" data-animate="field-notes">
  <div class="canvas-card">
{chrome(17)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:2vh">
{head("11 · 插图6 · SaaS 报告", "四维筛查：密度 · 锁定 · 价格 · 合规", "回答：够不够多无系统客户？是否又是封闭市场？入口价能否养活？合规会不会反噬轻量定位？")}
      <div class="brief-grid">
        <div class="brief-card card-fill">
          <div class="bc-main">客户密度 ✓</div>
          <div class="bc-note">5 万+小微、民营 33,892 家无系统；制造相关新兴领域上升（2024 新兴收入 984.8 亿 / +4.24% / 占 20.20%）</div>
        </div>
        <div class="brief-card card-fill">
          <div class="bc-main">在位锁定弱 ✓</div>
          <div class="bc-note">五家旗舰攻头部集团；中小制造内检＝空白。低端真正对手是 SmarterLab / 白码（纯软件）</div>
        </div>
        <div class="brief-card card-fill">
          <div class="bc-main">付费意愿 ⚠</div>
          <div class="bc-note">入口千元级、纯软件白热化 → 不能拼 3,000 元 Excel 难民；要靠软硬一体卖给「需要可信举证」的客户</div>
        </div>
        <div class="brief-card card-fill">
          <div class="bc-main">合规反噬 ⚠</div>
          <div class="bc-note">头号风险 → 必须用「隐形合规底座 + 按需激活高阶模块 + 预配置 ISO17025 模板」破局</div>
        </div>
        <div class="brief-card is-accent">
          <div class="bc-main">最关键判断</div>
          <div class="bc-note">不做最便宜的软件 SaaS；做制造/小型第三方里需要举证「检测真做、数据真实」的透明检测入口级系统</div>
        </div>
        <div class="brief-card card-fill">
          <div class="bc-main">护城河</div>
          <div class="bc-note">应敏「安全管家 IoT + 过程录像 + 数采」形成纯软件玩家给不了的可信溢价</div>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 18 Best strategy manifesto
slides.append(f'''
<section class="slide dark" data-layout="S12" data-animate="manifesto">
  <div class="canvas-card">
{chrome(18)}
    <div class="manifesto-top">
      <div>
        <span class="t-cat" style="color:rgba(255,255,255,.7)">12 · STRATEGY</span>
        <h2 style="margin-top:2vh;font-weight:200;font-size:min(3.6vw,6.4vh);line-height:1.12;color:#fff;letter-spacing:-.025em">最适合数蚕的策略</h2>
      </div>
      <p style="font-size:max(16px,1.05vw);line-height:1.55;color:rgba(255,255,255,.78);max-width:42ch;align-self:start;padding-top:1.2vw">以「透明检测系统」为纲，锚定制造业质检，以家联为首个共创标杆；乌海式重定制一律走护栏、原则不接。</p>
    </div>
    <div class="ink-banner-full">
      <div style="font-weight:200;font-size:min(2.8vw,4.8vh);line-height:1.25;color:#fff;max-width:70ch">
        做「制造质检的透明检测入口级系统」——<span style="font-style:italic;font-weight:300">不做第 6 家通用 LIMS，也不做最便宜的软件 SaaS</span>
      </div>
    </div>
  </div>
</section>
''')

# 19 Why this strategy
slides.append(f'''
<section class="slide light" data-layout="S16" data-animate="field-notes">
  <div class="canvas-card">
{chrome(19)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:2vh">
{head("12 · WHY", "为什么是这条路", "产品形态＝低门槛入口（软件+安全管家选配）+ 按需订阅高阶模块 + CMA/CNAS 资质咨询交叉销售")}
      <div class="brief-grid">
        <div class="brief-card card-fill"><div class="bc-main">避开双输轴</div><div class="bc-note">不拼低代码规模/平台（报告证明必输），改拼软硬一体 + 过程可信（五家没有、应敏独有）</div></div>
        <div class="brief-card card-fill"><div class="bc-main">踩中量化蓝海</div><div class="bc-note">5 万+小微无系统、中大型已普及；制造新兴领域上升</div></div>
        <div class="brief-card card-fill"><div class="bc-main">绕开价格血战</div><div class="bc-note">纯软件轻量已被卷到约 3,000 元；数蚕靠「可信举证」卖给愿付溢价的制造 QC / 小型第三方</div></div>
        <div class="brief-card is-accent"><div class="bc-main">把定制变资产</div><div class="bc-note">家联新建约 24 万模块（设备/标物/耗材/危化品/CNAS/集成）几乎全通用 → 做成按需激活高阶合规模块</div></div>
        <div class="brief-card card-fill"><div class="bc-main">合规有破局</div><div class="bc-note">隐形合规底座 + 按需模块 + 预配置模板，正解合规反噬</div></div>
        <div class="brief-card card-fill"><div class="bc-main">接单纪律</div><div class="bc-note">乌海式重定制项目一律走护栏、原则不接；只买可复用资产</div></div>
      </div>
    </div>
  </div>
</section>
''')

# 20 Path + guardrails
slides.append(f'''
<section class="slide light" data-layout="S11" data-animate="timeline-walk">
  <div class="canvas-card">
{chrome(20)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto auto 1fr;gap:2vh;min-height:0">
{head("13 · PLAYBOOK", "落地打法与护栏", None, "min(4.2vw,7.4vh)")}
      <div class="timeline-h">
        <span class="tl-h-axis"></span>
        <div class="tl-h-node"><span class="num">1</span><span class="dot"></span><span class="lbl">家联共创</span></div>
        <div class="tl-h-node"><span class="num">2</span><span class="dot"></span><span class="lbl">高阶模块库</span></div>
        <div class="tl-h-node"><span class="num">3</span><span class="dot"></span><span class="lbl">制造标准版</span></div>
        <div class="tl-h-node"><span class="num">4</span><span class="dot"></span><span class="lbl">入口获客</span></div>
        <div class="tl-h-node"><span class="num">5</span><span class="dot"></span><span class="lbl">复制推广</span></div>
      </div>
      <div style="display:grid;grid-template-columns:1.1fr 1fr;gap:1.6vh;min-height:0">
        <div class="card-fill" style="padding:2vh 1.6vw;display:flex;flex-direction:column;gap:1vh">
          <div class="t-meta">接单评分表（硬约束）</div>
          <ul class="clean-list compact">
            <li>① 可复用度 <b>权重最高</b></li>
            <li>② 客户认可价值主张</li>
            <li>③ 属锚定行业 / 标杆</li>
            <li>④ 毛利 / 人天比</li>
            <li>⑤ 交付挤占</li>
            <li>战略性亏损仅当 ① 高且 ② 通过时豁免</li>
          </ul>
        </div>
        <div class="card-fill" style="padding:2vh 1.6vw;display:flex;flex-direction:column;gap:1vh">
          <div class="t-meta">禁区与红线</div>
          <ul class="clean-list compact">
            <li>乌海式重定制原则不接</li>
            <li>合规＝隐形底座 + 按需模块 + 预配置模板</li>
            <li>CAC 目标 ≤ 3 万；线下培训另收费</li>
            <li>禁区：药品 / 环境 / 化工 / 疾控 / 采矿 / 机动车</li>
            <li>不当陪跑者、不打纯软件价格战</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 21 Risks
slides.append(f'''
<section class="slide light" data-layout="S16" data-animate="field-notes">
  <div class="canvas-card">
{chrome(21)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:2vh">
{head("13 · RISKS", "主要风险", "最大风险是商业模式肌肉切换；其余风险可用护栏与产品形态对冲")}
      <div class="brief-grid">
        <div class="brief-card is-accent"><div class="bc-main">① 肌肉切换难</div><div class="bc-note">从「派人定制」到「产品化 + 零线下交付」是两套能力；中期建不起线上交付 → CAC 破 5 万</div></div>
        <div class="brief-card card-fill"><div class="bc-main">② 合规反噬</div><div class="bc-note">不做隐形底座 + 按需模块，就会被拖回重系统</div></div>
        <div class="brief-card card-fill"><div class="bc-main">③ 软硬成本张力</div><div class="bc-note">定「软件低价入口 + 硬件选配 + 高阶模块/咨询变现」，别用硬件去打纯软件价格战</div></div>
        <div class="brief-card card-fill"><div class="bc-main">④ 定制惯性</div><div class="bc-note">销售继续接高定制单 → 用评分表 + 护栏强约束</div></div>
        <div class="brief-card card-fill"><div class="bc-main">⑤ 双向挤压</div><div class="bc-note">巨头低代码下探 + SmarterLab 低价 → 靠过程可信差异化，不正面拼低代码或最低价</div></div>
        <div class="brief-card card-fill"><div class="bc-main">⑥ 共创与协同</div><div class="bc-note">家联偏单一要抽象通用模块；数采/安全管家依赖母公司排期 → 定内部 SLA</div></div>
      </div>
    </div>
  </div>
</section>
''')

# 22 Segment 2 discussion
slides.append(f'''
<section class="slide dark" data-layout="S03" data-animate="statement-rise">
  <div class="canvas-card">
{chrome(22, "SEGMENT 02")}
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:2.8vh">
      <div class="t-meta" style="color:rgba(255,255,255,.65)">第二环节 · 45–60 MIN</div>
      <h1 class="h-statement" style="font-size:min(4.4vw,7.8vh);color:#fff;font-weight:200">
        一起碰撞讨论<br/>LIMS 的<span style="font-style:italic;font-weight:300">行业拓展</span>
      </h1>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2vw;max-width:70ch">
        <p style="font-size:max(16px,1.1vw);color:rgba(255,255,255,.78);line-height:1.55">哪些行业值得投入？哪些行业尽量避免？</p>
        <p style="font-size:max(16px,1.1vw);color:rgba(255,255,255,.78);line-height:1.55">以及：新增功能建议、业务建议、经营建议</p>
      </div>
    </div>
  </div>
</section>
''')

# 23 Segment 3 intro
slides.append(f'''
<section class="slide light" data-layout="S05" data-animate="sub-stack">
  <div class="canvas-card">
{chrome(23)}
    <div class="grid-2-9" style="flex:1;min-height:0">
      <div class="lead-col" style="display:flex;flex-direction:column;gap:2vh;justify-content:center">
        <span class="t-cat">14 · SEGMENT 03</span>
        <h2 class="h-xl" style="font-size:min(4.2vw,7.6vh);font-weight:200;line-height:1.08">第三环节<br/>定位 · 规划 · 重心</h2>
        <p style="font-size:max(16px,1.05vw);line-height:1.5;color:var(--text-secondary);max-width:28ch">以下三点各占一页，聚焦透明检测与应敏软硬协同的不可替代价值。</p>
      </div>
      <div class="sub-card-stack">
        <article class="card-fill sub-card"><span class="big-num">01</span><h4>标准库与透明实验室规划</h4><p>LIMS 标准库现状 / 未来，以及透明实验室产品规划</p></article>
        <article class="card-fill sub-card"><span class="big-num">02</span><h4>安全管家的不可替代作用</h4><p>物联网软件 + 硬件 + 平台，在可联网实验室中的位置</p></article>
        <article class="card-accent sub-card"><span class="big-num">03</span><h4>数采协议标准化价值</h4><p>数据采集 + 上位机整体接口协议，给项目实施带来的确定性</p></article>
      </div>
    </div>
  </div>
</section>
''')

# 24 Transparent lab planning
slides.append(f'''
<section class="slide light" data-layout="S19" data-animate="four-cards">
  <div class="canvas-card">
{chrome(24)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:2.2vh">
      <div>
        <div style="width:80px;height:3px;background:var(--accent);margin-bottom:2vh"></div>
{head("14.1 · TRANSPARENT LAB", "标准库现状与透明实验室规划", "从交付「报告」转向交付「过程」——一报一码承载八大维度证据链")}
      </div>
      <div class="four-cards">
        <div class="fc-col">
          <div class="t-meta">— 01 / NOW</div>
          <h3>标准库现状</h3>
          <p>电力检测场景方法/模板沉淀较深；跨行业标准库与检验方案建模仍薄，需按制造业质检优先补齐。</p>
        </div>
        <div class="fc-col">
          <div class="t-meta">— 02 / SHIFT</div>
          <h3>理念跃迁</h3>
          <p>透明检测把黑箱变成玻璃房：人机料法环 + 流程 + 过程录像 + 原生数据，构成不可抵赖证据链。</p>
        </div>
        <div class="fc-col">
          <div class="t-meta">— 03 / PRODUCT</div>
          <h3>产品形态</h3>
          <p>入口级软件 + 安全管家选配 + 按需高阶合规模块；制造标准版作为首个可复制 SKU。</p>
        </div>
        <div class="fc-col">
          <div class="t-meta">— 04 / ROAD</div>
          <h3>规划重心</h3>
          <p>先抽象家联共创中的通用标准/模板/合规模块，再以「一报一码」完成对外可信交付。</p>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# 25 Safety steward
slides.append(f'''
<section class="slide light" data-layout="S13" data-animate="three-forces">
  <div class="canvas-card">
{chrome(25)}
    <div class="three-forces" style="flex:1;min-height:0">
      <div class="hero-ink-col">
        <span class="t-cat" style="color:rgba(255,255,255,.7)">14.2 · SAFETY STEWARD</span>
        <h2 style="font-weight:200;font-size:min(3.4vw,6.2vh);line-height:1.12;color:#fff;margin-top:2vh">安全管家的<br/>不可替代作用</h2>
        <p style="margin-top:2vh;font-size:max(15px,1vw);line-height:1.5;color:rgba(255,255,255,.72);max-width:24ch">物联网软件 + 硬件 + 平台，把实验室从「人防」推向「技防」。</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:1.4vh">
        <article class="card-fill force-card">
          <div class="force-num">01</div>
          <div>
            <h4>全维感知矩阵</h4>
            <p>温湿度 / 烟雾 / 可燃气体 / 水浸 / 人体 / 视觉节点 7×24 采集，环境、设备、人员行为同时透明。</p>
          </div>
        </article>
        <article class="card-fill force-card">
          <div class="force-num">02</div>
          <div>
            <h4>视觉证据链</h4>
            <p>关键操作节点拍照/录像，直接回答客户「实验是否真做」——这是纯软件 SaaS 无法给出的证据。</p>
          </div>
        </article>
        <article class="card-accent force-card">
          <div class="force-num">03</div>
          <div>
            <h4>与 LIMS 生态融合</h4>
            <p>开放 API 把过程数据自动灌入 LIMS，支撑「一报一码」；没有这条链路，透明检测只是口号。</p>
          </div>
        </article>
      </div>
    </div>
  </div>
</section>
''')

# 26 Protocol standardization + closing-ish content, then closing
slides.append(f'''
<section class="slide light" data-layout="S08" data-animate="duo-mirror">
  <div class="canvas-card">
{chrome(26)}
    <div style="flex:1;padding:0;display:grid;grid-template-rows:auto 1fr;gap:2.4vh">
{head("14.3 · PROTOCOL", "数采 + 上位机接口协议标准化", "把「每项目重写对接」变成「按标准接入」，缩短实施、降低联调风险")}
      <div class="duo-compare" style="align-items:stretch">
        <div class="duo-half" style="display:flex;flex-direction:column;gap:1.6vh;padding-right:2vw">
          <span class="t-cat">价值 01</span>
          <h3 style="font-weight:300;font-size:min(2.4vw,3.8vh);line-height:1.3">一次定义，多项目复用</h3>
          <p style="font-size:max(16px,1.05vw);line-height:1.55;color:var(--text-secondary)">统一传感器上报、HTTP 查询与上位机读取约定后，新项目只需按设备清单对表接入，不必每次从零摸协议。</p>
        </div>
        <span class="vrule"></span>
        <div class="duo-half" style="display:flex;flex-direction:column;gap:1.6vh;padding-left:2vw">
          <span class="t-cat">价值 02</span>
          <h3 style="font-weight:300;font-size:min(2.4vw,3.8vh);line-height:1.3">联调可预期，交付更稳</h3>
          <p style="font-size:max(16px,1.05vw);line-height:1.55;color:var(--text-secondary)">验收指标、数据字段与异常处理前置写清，实施现场少「黑盒扯皮」，也更利于安全管家与 LIMS 稳定协同。</p>
        </div>
      </div>
    </div>
  </div>
</section>
''')

# Actually we have 26 content slides but need a closing. Let me adjust TOTAL - I'll replace slide 26 with protocol and add closing as 27, updating TOTAL to 27.

assert len(slides) == 26

# Change: make last one closing split that includes protocol takeaways? Better bump to 27.
# We'll append closing and update TOTAL in a second pass.

slides.append(f'''
<section class="slide split" data-layout="S10" data-animate="split-statement">
  <div class="canvas-card">
    <div class="split-half">
      <div class="half b-accent" style="padding:5.6vh 3.6vw 4.4vh;justify-content:space-between;position:relative;overflow:hidden">
        <canvas class="ascii-bg" aria-hidden="true"></canvas>
        <div class="chrome-min" style="margin-bottom:0;position:relative;z-index:1">
          <div class="l">27 / 27</div>
          <div class="r">CLOSING</div>
        </div>
        <div data-anim="manifesto" style="display:flex;flex-direction:column;gap:2vh;position:relative;z-index:1">
          <div class="t-meta" style="color:rgba(255,255,255,.78);letter-spacing:.22em;margin-bottom:1.6vh">MANIFESTO</div>
          <h2 style="font-family:var(--sans),var(--sans-zh);font-size:min(4.6vw,8.2vh);line-height:.98;letter-spacing:-.025em;font-weight:200;color:#fff">家联进<br/>乌海退<br/><span style="font-style:italic;font-weight:300">透明检测</span></h2>
          <div style="font-family:var(--sans),var(--sans-zh);font-size:max(14px,1vw);line-height:1.6;color:rgba(255,255,255,.82);font-weight:400;max-width:34ch;margin-top:1.4vh">制造质检入口级系统 · 软硬一体可信溢价 · 定制变资产</div>
        </div>
        <div data-anim="signature" style="display:flex;justify-content:space-between;align-items:end;border-top:1px solid rgba(255,255,255,.22);padding-top:2vh;position:relative;z-index:1">
          <div class="t-meta" style="color:rgba(255,255,255,.62)">数蚕智能 · 专题研讨</div>
          <div class="t-meta" style="color:rgba(255,255,255,.62)">2026.07.27</div>
        </div>
      </div>
      <div class="half" style="padding:5.6vh 3.6vw 4.4vh;justify-content:space-between">
        <div class="chrome-min">
          <div class="l">TAKEAWAYS</div>
          <div class="r">03 RULES</div>
        </div>
        <div data-anim="rules" style="display:flex;flex-direction:column;gap:0">
          <div style="display:grid;grid-template-columns:auto 1fr;gap:2vw;align-items:start;padding:2.4vh 0;border-top:1px solid var(--border-subtle)">
            <div style="font-family:var(--sans);font-weight:200;font-size:min(3.6vw,6.4vh);line-height:.9;color:var(--text-primary)">01</div>
            <div>
              <h3 style="font-family:var(--sans),var(--sans-zh);font-weight:400;font-size:max(18px,1.6vw);line-height:1.2;letter-spacing:-.015em;color:var(--text-primary);margin-bottom:1vh">纲：透明检测系统</h3>
              <p style="font-family:var(--sans),var(--sans-zh);font-size:max(16px,.94vw);line-height:1.55;color:var(--text-secondary);font-weight:400">轻量入口 + 安全管家选配，不拼最便宜纯软件。</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:2vw;align-items:start;padding:2.4vh 0;border-top:1px solid var(--border-subtle)">
            <div style="font-family:var(--sans);font-weight:200;font-size:min(3.6vw,6.4vh);line-height:.9;color:var(--text-primary)">02</div>
            <div>
              <h3 style="font-family:var(--sans),var(--sans-zh);font-weight:400;font-size:max(18px,1.6vw);line-height:1.2;letter-spacing:-.015em;color:var(--text-primary);margin-bottom:1vh">路：制造业质检首锚</h3>
              <p style="font-family:var(--sans),var(--sans-zh);font-size:max(16px,.94vw);line-height:1.55;color:var(--text-secondary);font-weight:400">以内检 QC + 区域小型第三方为战场，家联共创打样。</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:2vw;align-items:start;padding:2.4vh 0;border-top:1px solid var(--border-subtle);border-bottom:2px solid var(--accent)">
            <div style="font-family:var(--sans);font-weight:200;font-size:min(3.6vw,6.4vh);line-height:.9;color:var(--accent)">03</div>
            <div>
              <h3 style="font-family:var(--sans),var(--sans-zh);font-weight:400;font-size:max(18px,1.6vw);line-height:1.2;letter-spacing:-.015em;color:var(--accent);margin-bottom:1vh">纪：护栏强约束</h3>
              <p style="font-family:var(--sans),var(--sans-zh);font-size:max(16px,.94vw);line-height:1.55;color:var(--text-secondary);font-weight:400">可复用度优先；乌海式重定制原则不接。</p>
            </div>
          </div>
        </div>
        <div data-anim="foot" class="t-meta" style="color:var(--text-helper);text-align:right">→ 完 · END OF SEMINAR</div>
      </div>
    </div>
  </div>
</section>
''')

TOTAL = 27
# rewrite chrome page numbers in already-built strings for 01-26
body = "\n".join(slides)
# Fix TOTAL references in chrome that used 26
body = body.replace(f"/ {26:02d}", f"/ {TOTAL:02d}")
# Fix closing already has 27/27

CUSTOM_CSS = '''
  /* ===== Seminar extras (architecture / tables / tags) ===== */
  .arch-stack{display:flex;flex-direction:column;gap:1vh;min-height:0;flex:1}
  .arch-layer{border:1px solid var(--border-subtle);background:var(--grey-1);display:flex;flex-direction:column;min-height:0}
  .arch-layer.accent{background:rgba(var(--accent-rgb),.06);border-color:rgba(var(--accent-rgb),.35)}
  .arch-hd{display:flex;justify-content:space-between;align-items:baseline;gap:1vw;padding:1.1vh 1.2vw;border-bottom:1px solid var(--border-subtle)}
  .arch-hd b{font-weight:500;font-size:max(14px,.95vw);color:var(--text-primary)}
  .arch-hd span{font-size:max(13px,.85vw);color:var(--text-helper);font-weight:500}
  .arch-bd{display:grid;gap:.8vh;padding:1vh 1.2vw 1.2vh}
  .arch-bd.cols-2{grid-template-columns:1fr 1fr}
  .arch-bd.cols-3{grid-template-columns:1fr 1fr 1fr}
  .arch-bd.cols-4{grid-template-columns:repeat(4,1fr)}
  .arch-bd .mod{background:var(--paper);border:1px solid var(--border-subtle);padding:1vh 1vw}
  .arch-bd .mod b{display:block;font-size:max(14px,.92vw);font-weight:500;color:var(--text-primary);margin-bottom:.4vh}
  .arch-bd .mod span{font-size:max(13px,.82vw);line-height:1.4;color:var(--text-secondary);font-weight:400}
  .arch-bd .mod.gap{border-color:rgba(var(--accent-rgb),.45);background:rgba(var(--accent-rgb),.08)}
  .clean-list{list-style:none;display:flex;flex-direction:column;gap:.8vh;margin:0;padding:0}
  .clean-list li{position:relative;padding-left:1.1vw;font-size:max(15px,.98vw);line-height:1.45;color:var(--text-secondary);font-weight:400}
  .clean-list li::before{content:"";position:absolute;left:0;top:.55em;width:6px;height:6px;background:var(--accent)}
  .clean-list.compact li{font-size:max(14px,.92vw);line-height:1.4}
  .clean-list b{color:var(--text-primary);font-weight:600}
  .tag-pill{display:inline-flex;align-self:flex-start;margin-top:auto;padding:.6vh 1vw;font-size:max(13px,.85vw);font-weight:600;letter-spacing:.04em}
  .tag-pill.pick{background:var(--accent);color:var(--accent-on)}
  .tag-pill.avoid{background:var(--ink);color:#fff}
  .pos-matrix{display:grid;grid-template-columns:auto 1fr;grid-template-rows:1fr auto;gap:1vh 1.2vw;min-height:22vh}
  .pm-y{writing-mode:vertical-rl;transform:rotate(180deg);font-size:max(13px,.85vw);font-weight:600;color:var(--text-helper);letter-spacing:.12em;text-align:center}
  .pm-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:1vh;min-height:0}
  .pm-cell{border:1px solid var(--border-subtle);background:var(--grey-1);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:max(15px,1vw);font-weight:500;color:var(--text-primary);line-height:1.35;padding:1vh}
  .pm-cell span{display:block;margin-top:.4vh;font-size:max(13px,.85vw);font-weight:400;color:var(--text-helper)}
  .pm-cell.muted{opacity:.55}
  .pm-cell.pick{background:var(--accent);color:var(--accent-on);border-color:var(--accent)}
  .pm-cell.pick span{color:rgba(255,255,255,.8)}
  .pm-x{grid-column:2;display:flex;justify-content:space-between;font-size:max(13px,.85vw);font-weight:600;color:var(--text-helper);letter-spacing:.06em}
  .matrix-cell .mc-t{font-size:max(15px,1.05vw);font-weight:500;color:inherit;margin-bottom:.8vh}
  .matrix-cell .mc-d{font-size:max(14px,.9vw);line-height:1.4;font-weight:400;color:inherit;opacity:.85}
  .matrix-cell.card-accent .mc-d{opacity:.92}
  .tbl-wrap{border:1px solid var(--border-subtle);overflow:auto;min-height:0}
  .swiss-tbl{width:100%;border-collapse:collapse;font-size:max(14px,.9vw)}
  .swiss-tbl th{background:var(--ink);color:#fff;font-weight:600;text-align:left;padding:1.1vh 1vw;border-bottom:1px solid var(--border-subtle)}
  .swiss-tbl td{padding:1.1vh 1vw;border-bottom:1px solid var(--border-subtle);vertical-align:top;color:var(--text-primary);font-weight:400;line-height:1.4}
  .swiss-tbl tr:last-child td{border-bottom:none}
  .swiss-tbl .sub{display:block;color:var(--text-helper);font-size:max(12px,.78vw);font-weight:500;margin-top:.25vh}
  .swiss-tbl .pick{color:var(--accent);font-weight:700}
  .swiss-tbl .avoid{color:#8B3030;font-weight:700}
  .swiss-tbl .warn{color:#7A5C1A;font-weight:700}
  .swiss-tbl tr.row-pick td{background:rgba(var(--accent-rgb),.06)}
  .brief-card .bc-main{font-size:max(16px,1.1vw);font-weight:500;color:inherit;margin-bottom:1vh}
  .brief-card .bc-note{font-size:max(14px,.9vw);line-height:1.45;font-weight:400;color:inherit;opacity:.85}
  .brief-card.is-accent .bc-note{opacity:.92}
  .why-col h3{font-weight:400;font-size:max(18px,1.35vw);line-height:1.25;margin:1vh 0;letter-spacing:-.02em}
  .why-col p{font-size:max(15px,.98vw);line-height:1.45;color:var(--text-secondary);font-weight:400}
  .why-col.accent .why-num-bottom,.why-num-bottom.accent{color:var(--accent)}
  .fc-col h3{font-weight:400;font-size:max(18px,1.4vw);line-height:1.25;margin:1.2vh 0;letter-spacing:-.02em}
  .fc-col p{font-size:max(15px,.98vw);line-height:1.45;color:var(--text-secondary);font-weight:400}
  .force-card h4{font-weight:500;font-size:max(17px,1.2vw);margin-bottom:.8vh}
  .force-card p{font-size:max(15px,.95vw);line-height:1.45;color:var(--text-secondary)}
  .card-accent .force-card p,.card-accent.force-card p{color:rgba(255,255,255,.85)}
  .sub-card h4{font-weight:500;font-size:max(17px,1.2vw);margin-bottom:.8vh}
  .sub-card p{font-size:max(15px,.95vw);line-height:1.45}
'''

def main():
    path = Path("/workspace/ppt/index.html")
    text = path.read_text()
    # inject CSS before last </style> in head - find first large style close is tricky; inject before </style> closest to SLIDES
    style_close = text.rfind("</style>", 0, text.index("<!-- SLIDES_HERE"))
    text = text[:style_close] + CUSTOM_CSS + "\n" + text[style_close:]

    start = text.index("<!-- SLIDES_HERE")
    end = text.index("</div>\n\n<div id=\"nav\">")
    new_slides = "<!-- SLIDES_HERE · 数蚕智能产品定位研讨会 · Swiss IKB -->\n" + body + "\n"
    text = text[:start] + new_slides + text[end:]

    # title
    text = text.replace(
        "<title>[必填] 替换为 PPT 标题 · Deck Title</title>",
        "<title>数蚕智能 · 产品定位与未来发展方向 专题研讨会</title>",
    )
    path.write_text(text)
    print(f"Wrote {TOTAL} slides into {path}")
    # sanity
    assert "[必填]" not in path.read_text() or path.read_text().count("[必填]") == 0
    print("no 必填 left:", "[必填]" not in path.read_text())
    print("slide count:", path.read_text().count('<section class="slide'))

if __name__ == "__main__":
    main()
