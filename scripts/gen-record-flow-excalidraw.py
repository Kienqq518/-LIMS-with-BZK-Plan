#!/usr/bin/env python3
"""Generate Excalidraw for 原始记录单: config / resolve / export / render / version."""
import json
import random
import time
import uuid
from pathlib import Path

NOW = int(time.time() * 1000)
rng = random.Random(11)
W = 2120


def nid():
    return uuid.uuid4().hex[:20]


def seed():
    return rng.randint(1, 2**31 - 1)


def base(**kw):
    d = {
        "version": 1,
        "versionNonce": rng.randint(1, 2**31 - 1),
        "isDeleted": False,
        "id": nid(),
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "angle": 0,
        "seed": seed(),
        "groupIds": [],
        "frameId": None,
        "roundness": {"type": 3},
        "boundElements": [],
        "updated": NOW,
        "link": None,
        "locked": False,
    }
    d.update(kw)
    return d


def text(x, y, content, *, fontSize=16, color="#0f172a", width=None, align="left"):
    lines = content.count("\n") + 1
    w = width or max(len(line) for line in content.split("\n")) * fontSize * 0.62
    h = lines * fontSize * 1.25
    return base(
        type="text",
        x=x,
        y=y,
        width=w,
        height=h,
        strokeWidth=1,
        roughness=0,
        roundness=None,
        fontSize=fontSize,
        fontFamily=1,
        text=content,
        originalText=content,
        textAlign=align,
        verticalAlign="top",
        containerId=None,
        baseline=fontSize,
        lineHeight=1.25,
        strokeColor=color,
        backgroundColor="transparent",
    )


def rect(x, y, w, h, *, bg="#ffffff", stroke="#334155", sw=2, rough=1):
    return base(
        type="rectangle",
        x=x,
        y=y,
        width=w,
        height=h,
        strokeWidth=sw,
        roughness=rough,
        backgroundColor=bg,
        strokeColor=stroke,
    )


def diamond(x, y, w, h, *, bg="#fff7ed", stroke="#ea580c"):
    return base(
        type="diamond",
        x=x,
        y=y,
        width=w,
        height=h,
        backgroundColor=bg,
        strokeColor=stroke,
        roundness=None,
    )


def arrow(x, y, points, *, color="#334155", sw=2, style="solid"):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return base(
        type="arrow",
        x=x,
        y=y,
        width=max(xs) - min(xs),
        height=max(ys) - min(ys),
        strokeWidth=sw,
        strokeStyle=style,
        roundness={"type": 2},
        startBinding=None,
        endBinding=None,
        lastCommittedPoint=None,
        startArrowhead=None,
        endArrowhead="arrow",
        points=points,
        strokeColor=color,
        backgroundColor="transparent",
    )


def h_arrow(x1, y, x2, *, color="#334155", style="solid"):
    return arrow(x1, y, [[0, 0], [x2 - x1, 0]], color=color, style=style)


def v_arrow(x, y1, y2, *, color="#334155", style="solid"):
    return arrow(x, y1, [[0, 0], [0, y2 - y1]], color=color, style=style)


def box(x, y, w, h, label, *, bg="#ffffff", stroke="#334155", fontSize=13, tcolor="#0f172a"):
    r = rect(x, y, w, h, bg=bg, stroke=stroke)
    tw = min(w - 16, max(len(line) for line in label.split("\n")) * fontSize * 0.62 + 8)
    lines = label.count("\n") + 1
    th = lines * fontSize * 1.25
    t = text(
        x + (w - tw) / 2,
        y + (h - th) / 2,
        label,
        fontSize=fontSize,
        color=tcolor,
        width=tw,
        align="center",
    )
    return [r, t]


def diamond_label(x, y, w, h, label, *, bg="#fff7ed", stroke="#ea580c", tcolor="#9a3412"):
    d = diamond(x, y, w, h, bg=bg, stroke=stroke)
    tw = min(w - 40, max(len(line) for line in label.split("\n")) * 13 * 0.62 + 8)
    lines = label.count("\n") + 1
    th = lines * 13 * 1.25
    t = text(
        x + (w - tw) / 2,
        y + (h - th) / 2,
        label,
        fontSize=13,
        color=tcolor,
        width=tw,
        align="center",
    )
    return [d, t]


elements = []

# ========== TITLE ==========
elements.append(text(60, 28, "原始记录单 · 生成 / 解析 / 渲染 / 版本管理整体流程", fontSize=32, color="#0f172a", width=1400))
elements.append(
    text(
        60,
        74,
        "对齐参考：单据文件-生成渲染及版本管理整体流程　　键：raw_record / HF=record　　粒度由「记录单设置」4 种生成模式决定",
        fontSize=15,
        color="#64748b",
        width=1900,
    )
)
elements.append(
    text(
        60,
        98,
        "共用骨架：记录单设置(生成模式) → 记录单模版(组合/试验项/公共引用) → 试验检测导出抽屉预览执行 → 委托详情版本与批量导出",
        fontSize=14,
        color="#64748b",
        width=1900,
    )
)

# ========== ① SHARED CONFIG ==========
Y1 = 140
elements.append(rect(40, Y1, W - 60, 155, bg="#f8fafc", stroke="#94a3b8", sw=1, rough=0))
elements.append(text(60, Y1 + 10, "① 共用配置层", fontSize=20, color="#0f172a", width=220))
elements.append(
    text(
        220,
        Y1 + 16,
        "system-params.html（记录单设置 / 页眉页脚 / 编号）  ·  template-config.html（记录单模版）",
        fontSize=13,
        color="#64748b",
        width=1100,
    )
)

cfg = [
    (60, 300, "记录单设置\n4 种生成模式绑定\n操作员不可覆盖"),
    (400, 300, "记录单模版\n组合(样品/型号层)\n+ 试验项单模版"),
    (740, 300, "公共模版\n组合 / 试验项\n活引用 refPublicId"),
    (1080, 300, "页眉页脚 HF=record\n编号规则\n原始记录单编号"),
    (1420, 300, "落款角色可配\n检测 / 记录 / 核校\n核校→数据审核人"),
    (1760, 280, "委托详情\n原始记录单区\n版本 / 批量下载"),
]
for x, w, label in cfg:
    elements.extend(box(x, Y1 + 45, w, 90, label, bg="#dbeafe", stroke="#2563eb", fontSize=12))
for x1, x2 in [(360, 400), (700, 740), (1040, 1080), (1380, 1420), (1720, 1760)]:
    elements.append(h_arrow(x1, Y1 + 90, x2, color="#2563eb"))

# ========== ② TIMELINE ==========
Y2 = 330
elements.append(rect(40, Y2, W - 60, 300, bg="#ecfdf5", stroke="#86efac", sw=1, rough=0))
elements.append(text(60, Y2 + 10, "② 业务时间线 · 何时就绪 / 生成 / 落款 / 消费", fontSize=20, color="#14532d", width=700))
elements.append(
    text(
        760,
        Y2 + 16,
        "绿=试验完成就绪　　蓝=导出生成　　橙=核校落款　　紫=委托详情消费　　灰=前置不生成",
        fontSize=13,
        color="#64748b",
        width=1200,
    )
)

stages = [
    (50, "试样分发"),
    (230, "试验检测"),
    (450, "导出记录单"),
    (680, "数据审核"),
    (900, "申请还样"),
    (1100, "报告编制"),
    (1300, "委托详情"),
    (1520, "批量导出"),
    (1740, "文件浏览"),
]
for x, name in stages:
    elements.append(text(x, Y2 + 48, name, fontSize=12, color="#78716c", width=140, align="center"))
elements.append(rect(50, Y2 + 72, 1900, 4, bg="#e7e5e4", stroke="#e7e5e4", sw=0, rough=0))

elements.extend(box(50, Y2 + 95, 150, 55, "分发任务\n不生成记录单", bg="#f1f5f9", stroke="#94a3b8", fontSize=11))
elements.extend(box(230, Y2 + 95, 180, 55, "试验项完成\n按模式判就绪", bg="#bbf7d0", stroke="#16a34a", fontSize=11))
elements.extend(box(450, Y2 + 95, 190, 55, "导出抽屉确认\n→ Word V1.0", bg="#93c5fd", stroke="#1d4ed8", fontSize=11))
elements.extend(box(680, Y2 + 95, 180, 55, "核校落款回填\n升 major(若需)", bg="#fed7aa", stroke="#ea580c", fontSize=11))
elements.extend(box(900, Y2 + 95, 160, 55, "申请还样自动\n不改记录单", bg="#f1f5f9", stroke="#94a3b8", fontSize=11))
elements.extend(box(1100, Y2 + 95, 160, 55, "报告侧独立\n不驱动记录单", bg="#f1f5f9", stroke="#94a3b8", fontSize=11))
elements.extend(box(1300, Y2 + 95, 180, 55, "原始记录单区\n查看/编辑/历史", bg="#e9d5ff", stroke="#9333ea", fontSize=11))
elements.extend(box(1520, Y2 + 95, 170, 55, "批量 ZIP\n仅最新版本", bg="#e9d5ff", stroke="#9333ea", fontSize=11))
elements.extend(box(1740, Y2 + 95, 170, 55, "日志浏览\n类型=原始记录单", bg="#e9d5ff", stroke="#9333ea", fontSize=11))

elements.append(h_arrow(200, Y2 + 122, 230, color="#94a3b8", style="dashed"))
elements.append(h_arrow(410, Y2 + 122, 450, color="#16a34a"))
elements.append(h_arrow(640, Y2 + 122, 680, color="#1d4ed8"))
elements.append(h_arrow(860, Y2 + 122, 900, color="#ea580c", style="dashed"))
elements.append(h_arrow(1280, Y2 + 122, 1300, color="#9333ea", style="dashed"))
elements.append(h_arrow(1480, Y2 + 122, 1520, color="#9333ea"))
elements.append(h_arrow(1690, Y2 + 122, 1740, color="#9333ea", style="dashed"))

elements.append(
    text(
        50,
        Y2 + 175,
        "就绪规则：合并类(模式1/3)须范围内全部试验项完成且模版齐全；切分类(模式2/4)按已完成试验项逐文件就绪。"
        "操作员在导出抽屉不可改生成模式。落款槽位在业务流程可配；需要核校时取数据审核节点审核人。",
        fontSize=12,
        color="#14532d",
        width=2000,
    )
)
elements.append(
    text(
        50,
        Y2 + 220,
        "入口：试验检测编辑页 ›「导出原始记录单」→ 记录单导出详情抽屉（预览文件列表 → 单行/批量导出）。"
        "生成后落入委托详情「原始记录单」区块；≥2 份时显示区域内「批量下载」。",
        fontSize=12,
        color="#14532d",
        width=2000,
    )
)

# ========== ③ FOUR MODE CARDS ==========
Y3 = 670
elements.append(text(60, Y3, "③ 四种生成模式卡片（记录单设置 · 切分规则 · 模版来源 · 就绪条件）", fontSize=20, color="#0f172a", width=1100))
elements.append(
    text(
        60,
        Y3 + 32,
        "配置优先级：记录单设置（生成模式） > 记录单模版（组合 + 单试验项） > 导出抽屉（仅预览与执行）",
        fontSize=13,
        color="#64748b",
        width=1400,
    )
)

modes = [
    {
        "x": 40,
        "y": Y3 + 60,
        "bg": "#eff6ff",
        "stroke": "#2563eb",
        "title": "1. 单种样品所有试验 · 一份文件",
        "body": "key：model-all　　聚合：样品名称(型号)\n切分：全部试验合并 → 同型号 1 个文件\n模版：组合优先(型号>样品) → 试验项拼接\n就绪：全部试验项完成 + 模版齐全\n缺一：状态「试验未完成」/「缺模版」阻断\n示例：…_绝缘操作杆-10kV_记录单.docx",
    },
    {
        "x": 600,
        "y": Y3 + 60,
        "bg": "#f0f9ff",
        "stroke": "#0284c7",
        "title": "2. 单种样品单种试验 · 各一份",
        "body": "key：model-each　　聚合：样品名称(型号)\n切分：按试验项 → 每已完成项 1 文件\n模版：始终试验项单模版（忽略组合）\n就绪：该试验项已完成 + 有启用模版\n系统默认兜底：未命中规则时用本模式\n示例：…_交流耐压试验记录单.docx",
    },
    {
        "x": 1160,
        "y": Y3 + 60,
        "bg": "#ecfdf5",
        "stroke": "#16a34a",
        "title": "3. 单个样品所有试验 · 每实例一份",
        "body": "key：specimen-all　　聚合：样品实例\n切分：全部试验合并 → 每试样 1 文件\n模版：组合优先 → 试验项拼接\n就绪：该试样全部试验完成 + 模版齐全\n列表试样编号列显示具体编号\n示例：SC…-0101_…_记录单.docx",
    },
    {
        "x": 40,
        "y": Y3 + 310,
        "bg": "#fffbeb",
        "stroke": "#d97706",
        "title": "4. 单个样品单种试验 · 每实例×项",
        "body": "key：specimen-each　　聚合：样品实例\n切分：按试验项 → 每试样×每完成项 1 文件\n模版：始终试验项单模版（忽略组合）\n就绪：该试样该试验项完成 + 有启用模版\n粒度最细；批量导出勾选就绪行\n示例：SC…-0101_…_交流耐压….docx",
    },
    {
        "x": 600,
        "y": Y3 + 310,
        "bg": "#faf5ff",
        "stroke": "#9333ea",
        "title": "规则匹配优先级",
        "body": "1) 样品名称(型号) 精确匹配\n2) 样品分类匹配（取层级最近）\n3) 系统默认 → model-each\n保存时不做模版完整性预检\n同范围不可重复配置\n种子示例：电力物资/安工/环境/工程可分套",
    },
    {
        "x": 1160,
        "y": Y3 + 310,
        "bg": "#fdf2f8",
        "stroke": "#db2777",
        "title": "与单据六类的差异要点",
        "body": "· 非流程节点自动生成，由检测员主动导出\n· 生成份数/粒度由管理员策略锁定\n· 组合模版仅服务合并类模式\n· 活引用公共模版，版本随公共启用文件\n· 落款角色可配（非固定签字栏）\n· 导出 key：raw_record",
    },
]

for c in modes:
    elements.append(rect(c["x"], c["y"], 520, 230, bg=c["bg"], stroke=c["stroke"], sw=2, rough=1))
    elements.append(text(c["x"] + 16, c["y"] + 12, c["title"], fontSize=15, color="#0f172a", width=490))
    elements.append(text(c["x"] + 16, c["y"] + 42, c["body"], fontSize=12, color="#334155", width=490))

# ========== ④ TEMPLATE RESOLVE ==========
Y4 = Y3 + 580
elements.append(rect(40, Y4, W - 60, 320, bg="#fffbeb", stroke="#fcd34d", sw=1, rough=0))
elements.append(text(60, Y4 + 12, "④ 模版解析详图（导出运行时 · UI 不展示继承态）", fontSize=20, color="#92400e", width=900))
elements.append(
    text(
        60,
        Y4 + 42,
        "组合绑定：样品层 + 型号层可上传；分类层仅汇总展示不可上传　　·　　是否已配置=本节点实际上传启用文件（继承不算）",
        fontSize=13,
        color="#64748b",
        width=1800,
    )
)

RY = Y4 + 80
elements.extend(box(50, RY, 160, 80, "打开导出抽屉\n按委托算文件预览", bg="#fef3c7", stroke="#d97706", fontSize=12))
elements.extend(box(250, RY, 150, 80, "resolveRecordRule\n型号>分类>默认", bg="#fde68a", stroke="#b45309", fontSize=12))
elements.extend(diamond_label(440, RY - 5, 150, 90, "合并类\n模式?"))
elements.extend(box(640, RY, 170, 80, "resolveCombined\n型号层 > 样品层", bg="#fde68a", stroke="#b45309", fontSize=11))
elements.extend(diamond_label(850, RY - 5, 140, 90, "有组合\n模版?"))
elements.extend(box(1030, RY, 160, 80, "用组合 Word\n填试验数据", bg="#bbf7d0", stroke="#16a34a", fontSize=12))
elements.extend(box(1230, RY, 170, 80, "试验项模版\n按序动态拼接", bg="#dbeafe", stroke="#2563eb", fontSize=12))
elements.extend(box(1450, RY, 170, 80, "切分类模式\n始终单试验项模版", bg="#dbeafe", stroke="#2563eb", fontSize=11))
elements.extend(box(1670, RY, 180, 80, "校验就绪\n导出 Word+PDF?", bg="#e9d5ff", stroke="#9333ea", fontSize=12))

elements.append(h_arrow(210, RY + 40, 250, color="#d97706"))
elements.append(h_arrow(400, RY + 40, 440, color="#d97706"))
elements.append(h_arrow(590, RY + 40, 640, color="#d97706"))
elements.append(text(600, RY + 14, "是", fontSize=12, color="#ea580c", width=24))
elements.append(h_arrow(810, RY + 40, 850, color="#d97706"))
elements.append(h_arrow(990, RY + 40, 1030, color="#16a34a"))
elements.append(text(1000, RY + 14, "是", fontSize=12, color="#16a34a", width=24))
elements.append(h_arrow(1190, RY + 40, 1230, color="#2563eb", style="dashed"))
elements.append(text(1195, RY + 58, "否", fontSize=12, color="#2563eb", width=24))
elements.append(h_arrow(1400, RY + 40, 1450, color="#2563eb"))
elements.append(h_arrow(1620, RY + 40, 1670, color="#9333ea"))

# skip merge → split path
elements.append(arrow(515, RY + 85, [[0, 0], [0, 55], [935, 55]], color="#ea580c", style="dashed"))
elements.append(text(540, RY + 100, "否 · 走切分类", fontSize=12, color="#ea580c", width=140))
elements.append(v_arrow(1520, RY + 80, RY + 140, color="#2563eb", style="dashed"))
elements.append(h_arrow(1520, RY + 140, 1670, color="#2563eb", style="dashed"))

elements.append(
    text(
        50,
        RY + 175,
        "引用语义：业务行可「上传 / 复制 / 引用」公共模版；引用为活引用，列表「当前启用」跟随公共侧启用文件。"
        "引用行「版本」打开公共版本弹窗；本地行打开本行版本（多版单启用）。已被引用的公共模版禁止改内容样式。",
        fontSize=12,
        color="#78716c",
        width=2000,
    )
)
elements.append(
    text(
        50,
        RY + 215,
        "拼接顺序：与左侧树 / 试验项标准排序一致（用户不可选）。"
        "缺模版仅在导出时阻断该文件行，不在受理/分配/设置保存时预检。",
        fontSize=12,
        color="#78716c",
        width=2000,
    )
)

# ========== ⑤ CONSUME ==========
Y5 = Y4 + 360
elements.append(rect(40, Y5, W - 60, 200, bg="#eff6ff", stroke="#93c5fd", sw=1, rough=0))
elements.append(text(60, Y5 + 12, "⑤ 渲染与消费（试验检测抽屉 + 委托详情 + 批量）", fontSize=20, color="#1e40af", width=800))

elements.extend(
    box(
        60,
        Y5 + 50,
        240,
        120,
        "test-detect-edit\n记录单导出详情抽屉\n预览文件名/试样/试验项\n状态：就绪·未完成·缺模版",
        bg="#bfdbfe",
        stroke="#2563eb",
        fontSize=12,
    )
)

ops = [
    (340, "单行导出\n仅就绪行可点\n写入委托文件"),
    (560, "批量导出抽屉内\n跳过未就绪行\n全不可导→toast"),
    (780, "委托详情区块\n原始记录名称列表\n查看 / 编辑 / 历史"),
    (1000, "PageOffice\n关闭→MANUAL minor\n套用 HF=record"),
    (1220, "区域内批量下载\n文件数≥2 显示\n仅当前最新版"),
    (1440, "委托批量导出 ZIP\n勾选 raw_record\n无文件则灰显"),
    (1660, "落款渲染\n检测/记录/核校\n按配置槽位填入"),
]
for x, label in ops:
    elements.extend(box(x, Y5 + 55, 200, 110, label, bg="#dbeafe", stroke="#2563eb", fontSize=11))

# ========== ⑥ VERSION + SIGN ==========
Y6 = Y5 + 240
elements.append(rect(40, Y6, 820, 230, bg="#faf5ff", stroke="#d8b4fe", sw=1, rough=0))
elements.append(text(60, Y6 + 12, "⑥ 版本规则（与单据共用语义）", fontSize=20, color="#6b21a8", width=400))
elements.extend(
    box(
        60,
        Y6 + 50,
        380,
        155,
        "SYSTEM · major\n· generate　首次导出生成 V1.0\n· node_backfill　核校/落款回填有变\n· workflow_rollback　回退改写文件\n无内容变化 → 不打版\n同 version 可挂 Word + PDF",
        bg="#f3e8ff",
        stroke="#9333ea",
        fontSize=12,
    )
)
elements.extend(
    box(
        460,
        Y6 + 50,
        360,
        155,
        "MANUAL · minor\n· edit_close　人工编辑关闭\n· content_rollback　同 major 回滚\n列表始终只显示最新文件名\n实务版：历史含主+次版本\n回滚入口按权限（本期实务可关）",
        bg="#f3e8ff",
        stroke="#9333ea",
        fontSize=12,
    )
)

elements.append(rect(900, Y6, 1160, 230, bg="#fff7ed", stroke="#fdba74", sw=1, rough=0))
elements.append(text(920, Y6 + 12, "⑦ 落款 / 核校 / 关系要点", fontSize=20, color="#9a3412", width=400))
elements.append(
    text(
        920,
        Y6 + 50,
        "· 落款槽位可配：检测人员 / 记录人员 / 核校人员（均可配是否需要）\n"
        "· 需要核校 → 取数据审核节点审核人（通常 1 人）写入记录单\n"
        "· 记录单 ≠ 六种委托单据：不在登记/收样/分发节点自动生成\n"
        "· 与报告解耦：记录单导出不驱动报告；报告生成不改写记录单\n"
        "· 批量导出范围含「原始记录单」；开票/发放记录表不在此列\n"
        "· ISO/IEC 17025：原始记录真实及时；SYSTEM/MANUAL 分链留痕",
        fontSize=13,
        color="#9a3412",
        width=1100,
    )
)

# ========== KEY MAP ==========
Y7 = Y6 + 270
elements.append(rect(40, Y7, W - 60, 170, bg="#ffffff", stroke="#cbd5e1", sw=1, rough=0))
elements.append(text(60, Y7 + 12, "⑧ 键名速查 · 生成模式 / 导出 / 配置入口", fontSize=20, color="#0f172a", width=600))
elements.append(
    text(
        60,
        Y7 + 48,
        "显示名 / 概念              key / 入口                         说明\n"
        "原始记录单(导出类型)      raw_record                         委托批量导出勾选项；HF 类型=record\n"
        "生成模式 model-all        记录单设置                         单种样品所有试验 → 1 文件；组合优先\n"
        "生成模式 model-each       记录单设置（系统默认）             单种样品单种试验 → N 文件；单模版\n"
        "生成模式 specimen-all     记录单设置                         单个样品所有试验 → 每实例 1 文件\n"
        "生成模式 specimen-each    记录单设置                         单个样品单种试验 → 最细粒度",
        fontSize=12,
        color="#334155",
        width=2000,
    )
)

elements.append(
    text(
        60,
        Y7 + 185,
        "主文件：docs/feishu/原始记录单-生成渲染及版本管理整体流程.excalidraw　　生成脚本：scripts/gen-record-flow-excalidraw.py　　参考：单据文件-生成渲染及版本管理整体流程.excalidraw",
        fontSize=12,
        color="#94a3b8",
        width=1900,
    )
)

elements = [
    e
    for e in elements
    if not (e.get("type") == "arrow" and e.get("width", 1) == 0 and e.get("height", 1) == 0)
]

doc = {
    "type": "excalidraw",
    "version": 2,
    "source": "https://excalidraw.com",
    "elements": elements,
    "appState": {"gridSize": 20, "viewBackgroundColor": "#ffffff"},
    "files": {},
}

out = Path("/workspace/docs/feishu/原始记录单-生成渲染及版本管理整体流程.excalidraw")
out.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", out)
print("elements", len(elements))
print("arrows", sum(1 for e in elements if e["type"] == "arrow"))
