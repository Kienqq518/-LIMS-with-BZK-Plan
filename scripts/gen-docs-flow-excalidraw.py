#!/usr/bin/env python3
"""Generate Excalidraw for all 6 entrust document types: generate / writeback / render."""
import json
import random
import time
import uuid
from pathlib import Path

NOW = int(time.time() * 1000)
rng = random.Random(7)


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
    t = text(x + (w - tw) / 2, y + (h - th) / 2, label, fontSize=fontSize, color=tcolor, width=tw, align="center")
    return [r, t]


def diamond_label(x, y, w, h, label, *, bg="#fff7ed", stroke="#ea580c", tcolor="#9a3412"):
    d = diamond(x, y, w, h, bg=bg, stroke=stroke)
    tw = min(w - 40, max(len(line) for line in label.split("\n")) * 13 * 0.62 + 8)
    lines = label.count("\n") + 1
    th = lines * 13 * 1.25
    t = text(x + (w - tw) / 2, y + (h - th) / 2, label, fontSize=13, color=tcolor, width=tw, align="center")
    return [d, t]


elements = []

# ========== TITLE ==========
elements.append(text(60, 28, "六种委托单据 · 生成 / 回填 / 渲染整体流程", fontSize=32, color="#0f172a", width=1100))
elements.append(
    text(
        60,
        74,
        "模版侧栏 DOC_TYPES：检测委托书 · 收费通知单 · 检测任务单 · 检测任务及流转单 · 还样退库确认表 · 退样申请表",
        fontSize=15,
        color="#64748b",
        width=1400,
    )
)
elements.append(
    text(
        60,
        98,
        "共用骨架：template-config（cardEnabled / 字段分流）→ 业务节点触发 SYSTEM 生成 → entrust-detail 查看/编辑/历史 → 批量 ZIP 导出最新版",
        fontSize=14,
        color="#64748b",
        width=1450,
    )
)

# ========== ① SHARED CONFIG ==========
Y1 = 140
elements.append(rect(40, Y1, 1680, 155, bg="#f8fafc", stroke="#94a3b8", sw=1, rough=0))
elements.append(text(60, Y1 + 10, "① 共用配置层", fontSize=20, color="#0f172a", width=220))
elements.append(
    text(220, Y1 + 16, "template-config.html  /  system-params.html（页眉页脚）", fontSize=13, color="#64748b", width=560)
)

cfg = [
    (60, 250, "模版卡片\ncardEnabled 系统生成开关\n关闭 →「已关闭生成」"),
    (340, 280, "字段分流绑定\nbindFieldId + buckets\n仅委托书(电力物资)默认按任务类型"),
    (650, 280, "resolveDocTemplate\n品类×单据×委托字段\n→ 桶模版 / __default__"),
    (960, 280, "页眉页脚 HF\nentrust / fee_notice / task\ntask_flow / return_*"),
    (1270, 280, "版本 / 导出键\nDocumentVersion Vn.m\nbatch export 英文 key"),
    (1580, 120, "实例粒度\n1 份 or N 份\n见各单据卡片"),
]
for x, w, label in cfg:
    elements.extend(box(x, Y1 + 45, w, 90, label, bg="#e0f2fe", stroke="#0284c7", fontSize=12))
for x1, x2 in [(310, 340), (620, 650), (930, 960), (1240, 1270), (1550, 1580)]:
    elements.append(h_arrow(x1, Y1 + 90, x2, color="#0284c7"))

# ========== ② TIMELINE ==========
Y2 = 330
elements.append(rect(40, Y2, 1680, 280, bg="#fffbeb", stroke="#fcd34d", sw=1, rough=0))
elements.append(text(60, Y2 + 10, "② 业务时间线 · 何时落版 / 回填", fontSize=20, color="#92400e", width=480))
elements.append(
    text(
        520,
        Y2 + 16,
        "色块 = 首次 SYSTEM 生成　　虚线箭头 = 后续回填 / 升版　　灰框 = 不落该单据",
        fontSize=13,
        color="#64748b",
        width=900,
    )
)

# stage headers
stages = [
    (60, "委托登记"),
    (220, "样品收样"),
    (400, "委托确认"),
    (620, "费用审核"),
    (780, "制备/发样"),
    (980, "试样分发"),
    (1180, "试验检测"),
    (1380, "还样确认"),
    (1560, "样品退样"),
]
for x, name in stages:
    elements.append(text(x, Y2 + 48, name, fontSize=12, color="#78716c", width=120, align="center"))

# baseline
elements.append(rect(60, Y2 + 72, 1600, 4, bg="#e7e5e4", stroke="#e7e5e4", sw=0, rough=0))

# chips on timeline rows
# Row A: entrust + fee
elements.extend(box(400, Y2 + 90, 180, 55, "委托书 V1.0\n+ 收费通知单 V1.0", bg="#dbeafe", stroke="#2563eb", fontSize=11))
elements.append(text(160, Y2 + 105, "预览委托单\n（不落版）", fontSize=11, color="#94a3b8", width=100, align="center"))

# Row B: flow
elements.extend(box(200, Y2 + 155, 150, 50, "流转单 V1.0\n表头+空流程表", bg="#fde68a", stroke="#b45309", fontSize=11))
elements.extend(box(780, Y2 + 155, 160, 50, "流转单回填\n制备? → 领样", bg="#fef3c7", stroke="#d97706", fontSize=11))
elements.append(h_arrow(350, Y2 + 180, 780, color="#d97706", style="dashed"))
elements.extend(box(1180, Y2 + 155, 150, 50, "流转单\n「接收试样」", bg="#fef3c7", stroke="#d97706", fontSize=11))
elements.append(h_arrow(940, Y2 + 180, 1180, color="#d97706", style="dashed"))
elements.extend(box(1380, Y2 + 155, 130, 50, "流转单\n「还样」", bg="#fef3c7", stroke="#d97706", fontSize=11))
elements.append(h_arrow(1330, Y2 + 180, 1380, color="#d97706", style="dashed"))
elements.extend(box(1560, Y2 + 155, 130, 50, "流转单\n退样行?", bg="#fef3c7", stroke="#d97706", fontSize=11))
elements.append(h_arrow(1510, Y2 + 180, 1560, color="#d97706", style="dashed"))

# Row C: task
elements.extend(box(980, Y2 + 215, 160, 50, "任务单 × N\n一人一单 V1.0", bg="#dcfce7", stroke="#16a34a", fontSize=11))
elements.extend(box(1180, Y2 + 215, 160, 50, "任务单签收\nreceiver + date", bg="#bbf7d0", stroke="#15803d", fontSize=11))
elements.append(h_arrow(1140, Y2 + 240, 1180, color="#16a34a", style="dashed"))

# Row D: return docs
elements.extend(box(1320, Y2 + 90, 170, 55, "还样退库确认表\n申请归还时生成", bg="#fce7f3", stroke="#db2777", fontSize=11))
elements.extend(box(1560, Y2 + 90, 140, 55, "退样申请表?\n默认关闭生成", bg="#f1f5f9", stroke="#64748b", fontSize=11))

# fee audit note
elements.extend(box(620, Y2 + 215, 120, 50, "费用审核\n无单据落版", bg="#f1f5f9", stroke="#94a3b8", fontSize=11))

# ========== ③ SIX DOC CARDS ==========
Y3 = 650
elements.append(text(60, Y3, "③ 六种单据卡片（键名 · 触发 · 回填 · 渲染）", fontSize=20, color="#0f172a", width=700))

cards = [
    # row1
    {
        "x": 40,
        "y": Y3 + 40,
        "bg": "#eff6ff",
        "stroke": "#2563eb",
        "title": "1. 检测委托书",
        "body": "键：entrust_form / HF=entrust\n粒度：委托 1 份\n生成：委托确认 → V1.0\n分流：电力物资默认按任务类型\n回填：基本信息变更审批通过 → major\n渲染：委托详情 Word+PDF\n　　　创建/编辑/历史；批量 entrust_form\n备注：登记页「预览委托单」不落版",
    },
    {
        "x": 600,
        "y": Y3 + 40,
        "bg": "#f0f9ff",
        "stroke": "#0284c7",
        "title": "2. 收费通知单",
        "body": "键：fee_notice / HF=fee_notice\n粒度：委托 1 份\n生成：委托确认 → V1.0（与委托书同节点）\n分流：默认统一模版\n回填：原型无节点渐进回填\n渲染：详情以 PDF 为主\n　　　查看/编辑/历史；批量 fee_notice\n备注：HF 可配专用页眉覆盖",
    },
    {
        "x": 1160,
        "y": Y3 + 40,
        "bg": "#f0fdf4",
        "stroke": "#16a34a",
        "title": "3. 检测任务单  SL/ZJ15-01",
        "body": "键：task_sheet / HF=task\n粒度：检测员 N 份（一人一单）\n生成：试样分发「发放」→ 各员 V1.0\n分流：默认统一；同员重发可合并\n回填：试验检测「确认接收」签收 → major\n渲染：HTML 模态+打印 / PageOffice\n　　　详情列含检测员·接收时间；批量全员最新\n备注：分发前详情为空态",
    },
    # row2
    {
        "x": 40,
        "y": Y3 + 310,
        "bg": "#fffbeb",
        "stroke": "#d97706",
        "title": "4. 检测任务及流转单  QD088-2022",
        "body": "键：flow_sheet / HF=task_flow\n粒度：委托 1 份\n生成：样品收样 → V1.0（表头填好，流程表空）\n分流：默认统一模版\n回填：制备?→领样→接收→还样→退样?\n　　　每节点追加流程表一行 → major\n渲染：HTML 模态+打印 / PageOffice / 历史\n　　　批量 flow_sheet（仅当前最新）\n备注：分发不写流转单；与任务单仅在接收交汇",
    },
    {
        "x": 600,
        "y": Y3 + 310,
        "bg": "#fdf2f8",
        "stroke": "#db2777",
        "title": "5. 还样退库确认表  2024版",
        "body": "键：return_confirm / HF=return_confirm\n粒度：按还样记录行\n生成：检测员申请归还样品库时出现\n分流：默认统一；种子开启生成\n回填：还样确认侧样品员签字确认\n　　　同时流转单追加「还样」行\n渲染：委托详情「还样记录」区链接\n　　　导出 / 批量 return_confirm\n备注：不在主单据区，版本 UI 较薄",
    },
    {
        "x": 1160,
        "y": Y3 + 310,
        "bg": "#f8fafc",
        "stroke": "#64748b",
        "title": "6. 退样申请表  2024版（默认关）",
        "body": "键：return_apply / HF=return_apply\n粒度：按退样记录行\n生成：样品退样节点；需委托需要退样\n分流：cardEnabled 默认 false\n　　　侧栏显示「已关闭生成」\n回填：退样确定主要写流转单退样行\n渲染：待退样列表可查看/生成(PageOffice)\n　　　批量 return_apply（无文件则灰显）\n备注：六种中唯一默认关闭的单据",
    },
]

for c in cards:
    elements.append(rect(c["x"], c["y"], 520, 250, bg=c["bg"], stroke=c["stroke"], sw=2, rough=1))
    elements.append(text(c["x"] + 16, c["y"] + 12, c["title"], fontSize=16, color="#0f172a", width=480))
    elements.append(text(c["x"] + 16, c["y"] + 42, c["body"], fontSize=12, color="#334155", width=490))

# ========== ④ FLOW SHEET DETAIL (keep the progressive path) ==========
Y4 = Y3 + 600
elements.append(rect(40, Y4, 1680, 310, bg="#fffbeb", stroke="#fcd34d", sw=1, rough=0))
elements.append(
    text(
        60,
        Y4 + 12,
        "④ 流转单渐进回填详图（其余单据多为「一次生成 + 有限回填」）",
        fontSize=20,
        color="#92400e",
        width=900,
    )
)
elements.append(
    text(
        60,
        Y4 + 42,
        "流程表列：检测流程 | 样品交接人签名/日期 | 样品数量 | 备注　　origin=node_backfill；无内容变化不升版",
        fontSize=13,
        color="#64748b",
        width=1200,
    )
)

RY1 = Y4 + 80
elements.extend(box(60, RY1, 130, 80, "V1.0\n收样生成", bg="#fef3c7", stroke="#d97706", fontSize=12))
elements.extend(diamond_label(220, RY1 - 5, 140, 90, "是否\n制备？"))
elements.extend(box(390, RY1, 160, 80, "① 样品制备\n制备员签+数量", bg="#fde68a", stroke="#b45309", fontSize=12))
elements.extend(box(580, RY1, 160, 80, "② 领样\n领样人签+发样数", bg="#fde68a", stroke="#b45309", fontSize=12))
elements.extend(box(770, RY1, 170, 80, "试样分发\n不写流转单", bg="#f1f5f9", stroke="#64748b", fontSize=12))
elements.extend(box(970, RY1, 170, 80, "③ 接收试样\n检测员签+数量", bg="#fde68a", stroke="#b45309", fontSize=12))
elements.extend(box(1170, RY1, 160, 80, "∥ 任务单签收\n并行非替代", bg="#dcfce7", stroke="#16a34a", fontSize=12))
elements.extend(box(1360, RY1, 160, 80, "④ 还样确认\n还样人签可多行", bg="#fde68a", stroke="#b45309", fontSize=12))
elements.extend(diamond_label(1550, RY1 - 5, 140, 90, "是否\n退样？"))

elements.append(h_arrow(190, RY1 + 40, 220, color="#d97706"))
elements.append(h_arrow(360, RY1 + 40, 390, color="#d97706"))
elements.append(text(365, RY1 + 16, "是", fontSize=12, color="#ea580c", width=24))
elements.append(h_arrow(550, RY1 + 40, 580, color="#d97706"))
elements.append(h_arrow(740, RY1 + 40, 770, color="#64748b"))
elements.append(h_arrow(940, RY1 + 40, 970, color="#d97706"))
elements.append(h_arrow(1140, RY1 + 40, 1170, color="#16a34a", style="dashed"))
elements.append(h_arrow(1330, RY1 + 40, 1360, color="#d97706"))
elements.append(h_arrow(1520, RY1 + 40, 1550, color="#d97706"))

# skip prepare
elements.append(arrow(290, RY1 + 85, [[0, 0], [0, 30], [370, 30]], color="#ea580c", style="dashed"))
elements.append(text(360, RY1 + 95, "否·跳过", fontSize=11, color="#ea580c", width=80))

# return branch under
RY2 = Y4 + 200
elements.extend(box(1360, RY2, 180, 70, "⑤ 退样\n自取签收 / 快递退回", bg="#fde68a", stroke="#b45309", fontSize=12))
elements.append(v_arrow(1620, RY1 + 85, RY2 + 35, color="#d97706"))
elements.append(arrow(1620, RY2 + 35, [[0, 0], [-80, 0]], color="#d97706"))
elements.append(text(1630, RY1 + 100, "是", fontSize=12, color="#ea580c", width=24))
elements.extend(box(1550, RY2, 140, 50, "结束流转行", bg="#f1f5f9", stroke="#64748b", fontSize=12))
elements.append(text(1630, RY2 - 20, "否", fontSize=12, color="#ea580c", width=24))
elements.append(
    text(
        60,
        RY2,
        "单据结构：页眉 QD088-2022 → 标题「检测任务及流转单」→ 表头字段区 → 动态流程表\n"
        "页面：sample-receive → prepare → dispatch → distribute → detect → return-confirm → return-client → entrust-detail",
        fontSize=12,
        color="#78716c",
        width=1100,
    )
)

# ========== ⑤ CONSUME ==========
Y5 = Y4 + 350
elements.append(rect(40, Y5, 1680, 200, bg="#eff6ff", stroke="#93c5fd", sw=1, rough=0))
elements.append(text(60, Y5 + 12, "⑤ 渲染与消费（委托详情 + 批量导出）", fontSize=20, color="#1e40af", width=560))

elements.extend(
    box(
        60,
        Y5 + 50,
        220,
        120,
        "entrust-detail\n按区块列出最新文件名\n委托单文件 / 收费通知单\n任务单 / 流转单 / 还样记录",
        bg="#bfdbfe",
        stroke="#2563eb",
        fontSize=12,
    )
)

ops = [
    (320, "查看\nHTML 模态(任务/流转)\n或 PageOffice / alert"),
    (540, "编辑\nPageOffice\n关闭 → MANUAL minor"),
    (760, "查看历史\nVn.m 版本链\n可内容回滚(设计)"),
    (980, "打印\n套用对应 HF\n页眉页脚图片"),
    (1200, "批量导出 ZIP\n勾选类型英文 key\n仅打包当前最新"),
    (1420, "未生成类型\n复选框灰显\n如退样申请表默认空"),
]
for x, label in ops:
    elements.extend(box(x, Y5 + 60, 190, 100, label, bg="#dbeafe", stroke="#2563eb", fontSize=11))
    elements.append(h_arrow(280, Y5 + 110, x, color="#2563eb"))

# ========== ⑥ VERSION + RELATIONSHIPS ==========
Y6 = Y5 + 240
elements.append(rect(40, Y6, 820, 210, bg="#faf5ff", stroke="#d8b4fe", sw=1, rough=0))
elements.append(text(60, Y6 + 12, "⑥ 版本规则（共用）", fontSize=20, color="#6b21a8", width=280))
elements.extend(
    box(
        60,
        Y6 + 50,
        380,
        140,
        "SYSTEM · major\n· generate　首次生成\n· node_backfill　节点回填有变化\n· workflow_rollback　流程回退改写\n任务单按检测员实例各自成链",
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
        140,
        "MANUAL · minor\n· edit_close　人工编辑关闭\n· content_rollback　内容回滚\n列表始终只显示最新文件名\n同版本可挂 Word + PDF",
        bg="#f3e8ff",
        stroke="#9333ea",
        fontSize=12,
    )
)

elements.append(rect(900, Y6, 820, 210, bg="#fdf2f8", stroke="#f9a8d4", sw=1, rough=0))
elements.append(text(920, Y6 + 12, "⑦ 单据关系要点", fontSize=20, color="#9d174d", width=280))
elements.append(
    text(
        920,
        Y6 + 50,
        "· 委托书 ∥ 收费通知单：同在「委托确认」首次生成\n"
        "· 流转单 @ 收样  vs  任务单 @ 分发：时间与粒度不同\n"
        "· 交汇点「接收试样」：任务单签收 ∥ 流转单追加行\n"
        "· 还样退库确认表 → 内部库房交接；退样申请表 → 退委托方\n"
        "· 还样/退样完成时，同时回写流转单对应流程行\n"
        "· 基本信息变更审批通过 → 仅再生「检测委托书」major\n"
        "· 退样申请表默认 cardEnabled=false，其余五种默认开",
        fontSize=13,
        color="#831843",
        width=760,
    )
)

# ========== KEY MAP ==========
Y7 = Y6 + 250
elements.append(rect(40, Y7, 1680, 150, bg="#ffffff", stroke="#cbd5e1", sw=1, rough=0))
elements.append(text(60, Y7 + 12, "⑧ 键名速查", fontSize=20, color="#0f172a", width=200))
elements.append(
    text(
        60,
        Y7 + 48,
        "显示名                  导出 key           HF key           表号/版次           详情落点\n"
        "检测委托书              entrust_form       entrust          （委托单编号规则）   委托单文件\n"
        "收费通知单              fee_notice         fee_notice       —                   收费通知单\n"
        "检测任务单              task_sheet         task             SL/ZJ15-01          检测任务单（含检测员列）\n"
        "检测任务及流转单        flow_sheet         task_flow        QD088-2022          检测任务及样品流转单\n"
        "还样退库确认表          return_confirm     return_confirm   2024版              还样记录\n"
        "退样申请表              return_apply       return_apply     2024版              还样记录 / 待退样列表",
        fontSize=12,
        color="#334155",
        width=1600,
    )
)

elements.append(
    text(
        60,
        Y7 + 165,
        "主文件：docs/feishu/六种委托单据-生成渲染整体流程.excalidraw　　生成脚本：scripts/gen-docs-flow-excalidraw.py",
        fontSize=12,
        color="#94a3b8",
        width=1200,
    )
)

doc = {
    "type": "excalidraw",
    "version": 2,
    "source": "https://excalidraw.com",
    "elements": elements,
    "appState": {"gridSize": 20, "viewBackgroundColor": "#ffffff"},
    "files": {},
}

out = Path("/workspace/docs/feishu/六种委托单据-生成渲染整体流程.excalidraw")
out.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote", out)
print("elements", len(elements))
