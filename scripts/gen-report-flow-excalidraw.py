#!/usr/bin/env python3
"""Generate Excalidraw for 报告模版 / 报告文件: config / generate / render / version."""
import json
import random
import time
import uuid
from pathlib import Path

NOW = int(time.time() * 1000)
rng = random.Random(13)
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
elements.append(text(60, 28, "报告模版 · 配置 / 生成 / 渲染 / 版本管理整体流程", fontSize=32, color="#0f172a", width=1400))
elements.append(
    text(
        60,
        74,
        "对齐参考：单据文件-生成渲染及版本管理整体流程　　覆盖：报告模版变体 + 公共模版(头/尾/正文) + 报告设置 + 报告编制生成",
        fontSize=15,
        color="#64748b",
        width=1950,
    )
)
elements.append(
    text(
        60,
        98,
        "共用骨架：报告设置(默认导出模式) → 报告模版(默认变体/引用公共) → 编制员确认可改 → 生成 Word → 审核签发消费与版本",
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
        "template-config.html（报告模版 / 公共模版）  ·  system-params.html（报告设置 / 页眉页脚 / 编号 / 骑缝章）",
        fontSize=13,
        color="#64748b",
        width=1200,
    )
)

cfg = [
    (60, 300, "报告设置\n默认导出模式绑定\n型号>分类>兜底"),
    (400, 300, "报告模版变体\n同型号 N 变体\n1 个 isDefault"),
    (740, 300, "公共模版\n头 / 尾 / 正文\n无关联绑定"),
    (1080, 300, "组装规则全局\n骑缝章阶段\n收样图/换页符"),
    (1420, 300, "页眉页脚 HF=report\n编号规则·报告\n签名与印章"),
    (1760, 280, "报告编制页\n生成确认弹窗\n报告文件区"),
]
for x, w, label in cfg:
    elements.extend(box(x, Y1 + 45, w, 90, label, bg="#e0e7ff", stroke="#4f46e5", fontSize=12))
for x1, x2 in [(360, 400), (700, 740), (1040, 1080), (1380, 1420), (1720, 1760)]:
    elements.append(h_arrow(x1, Y1 + 90, x2, color="#4f46e5"))

# ========== ② TIMELINE ==========
Y2 = 330
elements.append(rect(40, Y2, W - 60, 300, bg="#eef2ff", stroke="#a5b4fc", sw=1, rough=0))
elements.append(text(60, Y2 + 10, "② 业务时间线 · 模版就绪 → 生成 → 编制 → 审核签发 → 消费", fontSize=20, color="#312e81", width=900))
elements.append(
    text(
        960,
        Y2 + 16,
        "靛=模版配置　　蓝=生成　　绿=编制后处理　　橙=审核签发　　紫=详情/导出消费",
        fontSize=13,
        color="#64748b",
        width=1000,
    )
)

stages = [
    (50, "模版管理"),
    (230, "报告设置"),
    (420, "数据审核后"),
    (620, "报告编制"),
    (840, "生成确认"),
    (1040, "报告文件"),
    (1240, "报告审核"),
    (1440, "报告签发"),
    (1640, "报告发放"),
    (1840, "委托详情"),
]
for x, name in stages:
    elements.append(text(x, Y2 + 48, name, fontSize=12, color="#78716c", width=150, align="center"))
elements.append(rect(50, Y2 + 72, 1950, 4, bg="#e7e5e4", stroke="#e7e5e4", sw=0, rough=0))

elements.extend(box(40, Y2 + 95, 170, 55, "变体+公共\n多版单启用", bg="#c7d2fe", stroke="#4f46e5", fontSize=11))
elements.extend(box(230, Y2 + 95, 160, 55, "默认导出模式\n预填可被覆盖", bg="#c7d2fe", stroke="#4f46e5", fontSize=11))
elements.extend(box(420, Y2 + 95, 160, 55, "进入编制前提\n试验数据已审", bg="#f1f5f9", stroke="#94a3b8", fontSize=11))
elements.extend(box(620, Y2 + 95, 180, 55, "勾选试样\n点「生成报告」", bg="#93c5fd", stroke="#1d4ed8", fontSize=11))
elements.extend(box(840, Y2 + 95, 170, 55, "导出方式+变体\n确认→生成 V1.0", bg="#60a5fa", stroke="#1d4ed8", fontSize=11))
elements.extend(box(1040, Y2 + 95, 160, 55, "添加报告图片\n导出 PDF", bg="#bbf7d0", stroke="#16a34a", fontSize=11))
elements.extend(box(1240, Y2 + 95, 160, 55, "审核(可双人)\n骑缝章?阶段", bg="#fed7aa", stroke="#ea580c", fontSize=11))
elements.extend(box(1440, Y2 + 95, 160, 55, "签发\n签发后编辑可配", bg="#fed7aa", stroke="#ea580c", fontSize=11))
elements.extend(box(1640, Y2 + 95, 160, 55, "发放/归档\n业务表留痕", bg="#fed7aa", stroke="#ea580c", fontSize=11))
elements.extend(box(1840, Y2 + 95, 160, 55, "报告文件区\n批量下载最新", bg="#e9d5ff", stroke="#9333ea", fontSize=11))

elements.append(h_arrow(210, Y2 + 122, 230, color="#4f46e5"))
elements.append(h_arrow(390, Y2 + 122, 420, color="#4f46e5", style="dashed"))
elements.append(h_arrow(580, Y2 + 122, 620, color="#94a3b8", style="dashed"))
elements.append(h_arrow(800, Y2 + 122, 840, color="#1d4ed8"))
elements.append(h_arrow(1010, Y2 + 122, 1040, color="#1d4ed8"))
elements.append(h_arrow(1200, Y2 + 122, 1240, color="#16a34a", style="dashed"))
elements.append(h_arrow(1400, Y2 + 122, 1440, color="#ea580c"))
elements.append(h_arrow(1600, Y2 + 122, 1640, color="#ea580c"))
elements.append(h_arrow(1800, Y2 + 122, 1840, color="#9333ea", style="dashed"))

elements.append(
    text(
        50,
        Y2 + 175,
        "与记录单关键差异：编制员在生成确认弹窗可改「导出方式」与「模版变体」（预填管理员默认）；"
        "记录单导出抽屉则锁定生成模式。缺模版在确认生成时阻断，提示「×× 缺少报告模版！」。",
        fontSize=12,
        color="#312e81",
        width=2000,
    )
)
elements.append(
    text(
        50,
        Y2 + 220,
        "入口：报告管理 › 报告编制 ›「报告生成」→ report-compile-edit（检测信息 tab）。"
        "生成结果写入「报告文件」列表（报告编号 / 试样编号 / 文件 / 生成·修改时间）。",
        fontSize=12,
        color="#312e81",
        width=2000,
    )
)

# ========== ③ TEMPLATE + EXPORT MODE CARDS ==========
Y3 = 670
elements.append(text(60, Y3, "③ 报告模版 / 公共模版 / 导出模式卡片", fontSize=20, color="#0f172a", width=800))
elements.append(
    text(
        60,
        Y3 + 32,
        "配置优先级：报告设置（默认导出模式） + 报告模版（默认变体）──预填──→ 生成确认弹窗（均可改）──确认──→ 生成文件",
        fontSize=13,
        color="#64748b",
        width=1800,
    )
)

cards = [
    {
        "x": 40,
        "y": Y3 + 60,
        "bg": "#eef2ff",
        "stroke": "#4f46e5",
        "title": "A. 报告模版变体（业务 Tab）",
        "body": "维度：样品名称(型号) × 变体名\n同型号 N 变体，恰好 1 个 isDefault\n每变体多版本、同时仅启用 1 个\n正文来源：上传 / 复制 / 引用公共正文\n头尾：变体层勾选引用公共模版头/尾\n操作：编辑·版本·配置·预览·设默认·删除\n与试验项解耦：占位全量，缺项不渲染",
    },
    {
        "x": 600,
        "y": Y3 + 60,
        "bg": "#faf5ff",
        "stroke": "#9333ea",
        "title": "B. 公共模版（库 Tab）",
        "body": "内容样式：模板头 | 模板尾 | 正文\n无关联绑定列（不做分类/型号绑定）\n由报告模版侧直接引用\n多版单启用；file=当前启用文件名\n已被引用 → 禁止更改内容样式\n正文不做「公共正文再嵌套头尾」\n批量下载：仅当前启用版本",
    },
    {
        "x": 1160,
        "y": Y3 + 60,
        "bg": "#eff6ff",
        "stroke": "#2563eb",
        "title": "C. 默认导出模式（报告设置）",
        "body": "model-batch　单种样品一份报告\n　　勾选试样合并 → 1 份\nspecimen-each　单个样品一份报告\n　　每勾选试样 → 各 1 份\n匹配：型号精确 > 分类最近 > 兜底 batch\n保存不做模版预检\n种子：电力物资常 specimen-each\n　　　安工/环境/工程常 model-batch",
    },
    {
        "x": 40,
        "y": Y3 + 330,
        "bg": "#ecfdf5",
        "stroke": "#16a34a",
        "title": "D. 活引用语义",
        "body": "变体存 refPublicId 指向公共正文\n列表「当前启用版本」跟随公共启用文件\n公共正文换启用版 → 引用展示同步变\n本地变体「版本」=本变体版本弹窗\n引用变体「版本」=打开公共侧版本\n可从引用切换回上传/复制转本地\n编辑弹窗不改文件实体（走版本）",
    },
    {
        "x": 600,
        "y": Y3 + 330,
        "bg": "#fffbeb",
        "stroke": "#d97706",
        "title": "E. 组装规则（全局 · 报告设置）",
        "body": "骑缝章生成阶段：\n　报告审核 / 报告签发 / 报告发放\n报告中是否添加收样图片：是/否\n头部—内容是否加换页符\n内容—尾部是否加换页符\n与「默认导出模式」表格分开保存\n页眉页脚图片叠加 ≠ Word 公共头尾",
    },
    {
        "x": 1160,
        "y": Y3 + 330,
        "bg": "#fdf2f8",
        "stroke": "#db2777",
        "title": "F. 与记录单配置流对照",
        "body": "· 策略默认：报告设置 vs 记录单设置\n· 操作员改策略：报告可改 / 记录单否\n· 勾选：报告勾试样 / 记录单只读预览\n· 模版：选变体 vs 按试验项组合/拼接\n· 公共库样式：头尾正文 vs 组合/试验项\n· 导出 key：report（HF）/ 报告文件区",
    },
]

for c in cards:
    elements.append(rect(c["x"], c["y"], 520, 250, bg=c["bg"], stroke=c["stroke"], sw=2, rough=1))
    elements.append(text(c["x"] + 16, c["y"] + 12, c["title"], fontSize=15, color="#0f172a", width=490))
    elements.append(text(c["x"] + 16, c["y"] + 42, c["body"], fontSize=12, color="#334155", width=490))

# ========== ④ GENERATE DETAIL ==========
Y4 = Y3 + 620
elements.append(rect(40, Y4, W - 60, 330, bg="#eff6ff", stroke="#93c5fd", sw=1, rough=0))
elements.append(text(60, Y4 + 12, "④ 报告生成确认详图（编制员可覆盖默认）", fontSize=20, color="#1e40af", width=800))
elements.append(
    text(
        60,
        Y4 + 42,
        "单型号：一行模版选择　　·　　多型号：按型号分组各选变体（各预填各自 isDefault）　　·　　底部实时预览将生成份数",
        fontSize=13,
        color="#64748b",
        width=1800,
    )
)

RY = Y4 + 80
elements.extend(box(50, RY, 150, 80, "勾选试样\n≥1 可生成", bg="#dbeafe", stroke="#2563eb", fontSize=12))
elements.extend(box(230, RY, 150, 80, "生成报告\n打开确认弹窗", bg="#bfdbfe", stroke="#1d4ed8", fontSize=12))
elements.extend(box(410, RY, 170, 80, "预填导出方式\n报告设置解析", bg="#93c5fd", stroke="#1d4ed8", fontSize=11))
elements.extend(box(610, RY, 170, 80, "预填模版变体\nisDefault 启用版", bg="#93c5fd", stroke="#1d4ed8", fontSize=11))
elements.extend(diamond_label(820, RY - 5, 150, 90, "编制员\n是否修改?"))
elements.extend(box(1010, RY, 150, 80, "确认生成\n校验模版", bg="#60a5fa", stroke="#1d4ed8", fontSize=12))
elements.extend(diamond_label(1200, RY - 5, 150, 90, "各型号\n有启用版?"))
elements.extend(box(1390, RY, 170, 80, "生成 Word\n写入报告文件", bg="#bbf7d0", stroke="#16a34a", fontSize=12))
elements.extend(box(1600, RY, 180, 80, "缺模版阻断\n提示型号缺模版", bg="#fecaca", stroke="#dc2626", fontSize=11))
elements.extend(box(1820, RY, 160, 80, "取消\n关闭弹窗", bg="#f1f5f9", stroke="#94a3b8", fontSize=12))

elements.append(h_arrow(200, RY + 40, 230, color="#2563eb"))
elements.append(h_arrow(380, RY + 40, 410, color="#1d4ed8"))
elements.append(h_arrow(580, RY + 40, 610, color="#1d4ed8"))
elements.append(h_arrow(780, RY + 40, 820, color="#1d4ed8"))
elements.append(h_arrow(970, RY + 40, 1010, color="#1d4ed8"))
elements.append(text(980, RY + 14, "确认", fontSize=11, color="#1d4ed8", width=40))
elements.append(h_arrow(1160, RY + 40, 1200, color="#1d4ed8"))
elements.append(h_arrow(1350, RY + 40, 1390, color="#16a34a"))
elements.append(text(1360, RY + 14, "是", fontSize=12, color="#16a34a", width=24))

# no template path
elements.append(arrow(1275, RY + 85, [[0, 0], [0, 50], [325, 50]], color="#dc2626", style="dashed"))
elements.append(text(1300, RY + 95, "否", fontSize=12, color="#dc2626", width=24))

# cancel path
elements.append(v_arrow(895, RY + 85, RY + 150, color="#94a3b8", style="dashed"))
elements.append(text(910, RY + 100, "取消", fontSize=11, color="#64748b", width=40))
elements.append(h_arrow(895, RY + 150, 1820, color="#94a3b8", style="dashed"))

elements.append(
    text(
        50,
        RY + 185,
        "生成内容拼装：启用变体正文（或活引用公共正文）+ 变体引用的公共头/尾 + 委托勾选试样数据；"
        "再按全局组装规则处理换页符/收样图；导出时叠加 HF=report 图片页眉页脚（与 Word 头尾互不影响）。",
        fontSize=12,
        color="#1e3a8a",
        width=2000,
    )
)
elements.append(
    text(
        50,
        RY + 225,
        "示例 PVC-C：设置=单种样品一份 + 模版默认「标准版」→ 勾选 3 试样确认 → 1 份报告；"
        "若改为「单个样品一份 + 英文版」→ 3 份英文版。",
        fontSize=12,
        color="#1e3a8a",
        width=2000,
    )
)

# ========== ⑤ CONSUME ==========
Y5 = Y4 + 370
elements.append(rect(40, Y5, W - 60, 200, bg="#f0fdf4", stroke="#86efac", sw=1, rough=0))
elements.append(text(60, Y5 + 12, "⑤ 渲染与消费（编制页 + 审核签发 + 委托详情）", fontSize=20, color="#14532d", width=800))

elements.extend(
    box(
        60,
        Y5 + 50,
        220,
        120,
        "report-compile-edit\n报告文件列表\n编号/试样/文件名\n生成·修改时间",
        bg="#bbf7d0",
        stroke="#16a34a",
        fontSize=12,
    )
)

ops = [
    (320, "添加报告图片\n生成后·提交前\nPageOffice 粘贴"),
    (540, "导出 PDF\n同 version 挂载\nWord+PDF"),
    (760, "在线查看/编辑\n关闭→MANUAL minor\n签发后受模式约束"),
    (980, "查看历史\nVn.m 版本链\n实务全员一致可见"),
    (1200, "审核 / 签发\n可配单人双人\n骑缝章按阶段盖"),
    (1420, "委托详情\n报告文件批量下载\n仅当前最新版"),
    (1640, "发放记录表\n业务留痕\n不进文件版本体系"),
]
for x, label in ops:
    elements.extend(box(x, Y5 + 55, 200, 110, label, bg="#dcfce7", stroke="#16a34a", fontSize=11))

# ========== ⑥ VERSION + NOTES ==========
Y6 = Y5 + 240
elements.append(rect(40, Y6, 820, 230, bg="#faf5ff", stroke="#d8b4fe", sw=1, rough=0))
elements.append(text(60, Y6 + 12, "⑥ 双层版本规则", fontSize=20, color="#6b21a8", width=280))
elements.extend(
    box(
        60,
        Y6 + 50,
        380,
        155,
        "模版侧（配置资产）\n· 变体 / 公共：多版单启用\n· 启用切换不自动重建已出报告\n· 活引用展示跟随公共启用文件\n· 批量下载只含当前启用版\n· 删除默认变体前须先切换默认",
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
        "报告文件侧（业务实例）\n· SYSTEM major：首次生成/回填/回退\n· MANUAL minor：编辑关闭\n· 签发后编辑：实务可配；合规禁止\n· 列表无版本后缀；历史弹窗查链\n· 报告发放记录 ≠ DocumentVersion",
        bg="#f3e8ff",
        stroke="#9333ea",
        fontSize=12,
    )
)

elements.append(rect(900, Y6, 1160, 230, bg="#fff1f2", stroke="#fda4af", sw=1, rough=0))
elements.append(text(920, Y6 + 12, "⑦ 关系要点 / 审核签字", fontSize=20, color="#9f1239", width=360))
elements.append(
    text(
        920,
        Y6 + 50,
        "· 报告模版变体 = 生成时可选版式；公共模版 = 可复用头/尾/正文库\n"
        "· 默认导出模式与默认变体只负责预填，不锁定编制员\n"
        "· 报告审核可配单人/双人；与原始记录「核校取数据审核人」不同\n"
        "· 骑缝章/CNAS/CMA/检测章属承检方「签名与印章」，按阶段叠印\n"
        "· 图片页眉页脚(HF=report) 与 Word 公共头尾两套互不影响\n"
        "· 与原始记录单解耦：各自生成入口、策略与版本链独立",
        fontSize=13,
        color="#9f1239",
        width=1100,
    )
)

# ========== KEY MAP ==========
Y7 = Y6 + 270
elements.append(rect(40, Y7, W - 60, 180, bg="#ffffff", stroke="#cbd5e1", sw=1, rough=0))
elements.append(text(60, Y7 + 12, "⑧ 键名速查 · 模版 / 导出模式 / 消费入口", fontSize=20, color="#0f172a", width=700))
elements.append(
    text(
        60,
        Y7 + 48,
        "显示名 / 概念                 key / 入口                              说明\n"
        "报告模版变体                  template-config › 报告模版              型号下 N 变体；isDefault 预填生成\n"
        "公共模版 头/尾/正文           template-config › 公共模版              无绑定；变体层引用；活引用正文\n"
        "导出模式 model-batch          报告设置                                单种样品一份报告（系统兜底）\n"
        "导出模式 specimen-each        报告设置                                单个样品一份报告\n"
        "报告文件 / HF                 report / 报告编制·委托详情              业务实例版本链；批量仅最新版\n"
        "骑缝章阶段                    报告设置·组装规则                       审核 / 签发 / 发放 三选一",
        fontSize=12,
        color="#334155",
        width=2000,
    )
)

elements.append(
    text(
        60,
        Y7 + 195,
        "主文件：docs/feishu/报告模版-生成渲染及版本管理整体流程.excalidraw　　生成脚本：scripts/gen-report-flow-excalidraw.py　　参考：单据文件-生成渲染及版本管理整体流程.excalidraw",
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

out = Path("/workspace/docs/feishu/报告模版-生成渲染及版本管理整体流程.excalidraw")
out.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", out)
print("elements", len(elements))
print("arrows", sum(1 for e in elements if e["type"] == "arrow"))
