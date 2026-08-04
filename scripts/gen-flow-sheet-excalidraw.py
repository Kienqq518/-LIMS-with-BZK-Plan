#!/usr/bin/env python3
"""Generate Excalidraw diagram for 检测任务及流转单 overall flow."""
import json
import random
import time
import uuid

NOW = int(time.time() * 1000)
rng = random.Random(42)


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
    tx = x + (w - tw) / 2
    ty = y + (h - th) / 2
    t = text(tx, ty, label, fontSize=fontSize, color=tcolor, width=tw, align="center")
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
elements.append(text(60, 30, "检测任务及流转单 · 系统生成 / 回填 / 渲染整体流程", fontSize=32, color="#0f172a", width=1100))
elements.append(
    text(
        60,
        78,
        "表号 QD088-2022  ·  模版类型 task_flow  ·  单据键 flow_sheet  ·  委托维度一单一份（区别于检测任务单一人一单）",
        fontSize=15,
        color="#64748b",
        width=1200,
    )
)

# ========== ① CONFIG ==========
Y1 = 130
elements.append(rect(40, Y1, 1520, 175, bg="#f8fafc", stroke="#94a3b8", sw=1, rough=0))
elements.append(text(60, Y1 + 12, "① 配置层（前置）", fontSize=20, color="#0f172a", width=280))
elements.append(text(260, Y1 + 18, "template-config.html  /  system-params.html", fontSize=13, color="#64748b", width=480))

cfg = [
    (70, "模版管理\n上传 检测任务及流转单_QD088.docx\ncardEnabled「系统生成」开关"),
    (400, "字段分流绑定\nresolveDocTemplateForEntrust\nbuckets / __default__"),
    (730, "页眉页脚配置\nfileTypes.task_flow\n可选图片页眉 / 页脚"),
    (1060, "占位符字段\n样品号/名称/规格/数量\n要求日期/项目/标准"),
]
for x, label in cfg:
    elements.extend(box(x, Y1 + 55, 290, 95, label, bg="#e0f2fe", stroke="#0284c7", fontSize=13))
elements.append(h_arrow(360, Y1 + 102, 400, color="#0284c7"))
elements.append(h_arrow(690, Y1 + 102, 730, color="#0284c7"))
elements.append(h_arrow(1020, Y1 + 102, 1060, color="#0284c7"))

# ========== ② GENERATE ==========
Y2 = 345
elements.append(rect(40, Y2, 1520, 210, bg="#f0fdf4", stroke="#86efac", sw=1, rough=0))
elements.append(text(60, Y2 + 12, "② 首次生成（样品收样完成触发）", fontSize=20, color="#166534", width=480))
elements.append(
    text(500, Y2 + 18, "origin=generate · SYSTEM · V1.0 · 流程表为空骨架", fontSize=13, color="#64748b", width=520)
)

gen = [
    (70, 210, "样品收样\nsample-receive\n确认收样"),
    (330, 230, "模版解析\n品类 + 检测任务及流转单\n+ 委托字段分流"),
    (610, 230, "字段合并渲染\n表头元数据写入 Word\n流程表保留空行骨架"),
    (890, 250, "落库文档版本\n…-检测任务及样品流转单.docx\nDocumentVersion V1.0"),
    (1190, 230, "委托详情可见\n单据列表 flow_sheet\n可查看 / 编辑 / 历史"),
]
for x, w, label in gen:
    elements.extend(box(x, Y2 + 55, w, 110, label, bg="#dcfce7", stroke="#16a34a", fontSize=13))
elements.append(h_arrow(280, Y2 + 110, 330, color="#16a34a"))
elements.append(h_arrow(560, Y2 + 110, 610, color="#16a34a"))
elements.append(h_arrow(840, Y2 + 110, 890, color="#16a34a"))
elements.append(h_arrow(1140, Y2 + 110, 1190, color="#16a34a"))
elements.append(
    text(
        70,
        Y2 + 175,
        "门禁：cardEnabled=false 时不自动生成；模版解析失败则不落文件",
        fontSize=12,
        color="#64748b",
        width=700,
    )
)

# ========== ③ WRITEBACK ==========
Y3 = 595
elements.append(rect(40, Y3, 1520, 430, bg="#fffbeb", stroke="#fcd34d", sw=1, rough=0))
elements.append(
    text(
        60,
        Y3 + 12,
        "③ 业务节点渐进回填（完成节点 → 追加流程表一行 → SYSTEM major 升版）",
        fontSize=20,
        color="#92400e",
        width=1100,
    )
)
elements.append(
    text(
        60,
        Y3 + 42,
        "流程表列：检测流程 | 样品交接人签名/日期 | 样品数量 | 备注　　· origin=node_backfill　· 无内容变化则不升版　· 流程回退改写行 → workflow_rollback",
        fontSize=13,
        color="#64748b",
        width=1400,
    )
)

# Row 1: main path
RY1 = Y3 + 85
elements.extend(box(60, RY1, 140, 90, "V1.0 已生成\n（收样）", bg="#fef3c7", stroke="#d97706", fontSize=12))
elements.extend(diamond_label(240, RY1 - 5, 150, 100, "是否\n制备？"))
elements.extend(
    box(430, RY1, 180, 90, "① 样品制备\nsample-prepare\n制备员签 + 数量", bg="#fde68a", stroke="#b45309", fontSize=12)
)
elements.extend(
    box(650, RY1, 180, 90, "② 领样\nsample-dispatch\n领样人签 + 发样数", bg="#fde68a", stroke="#b45309", fontSize=12)
)
elements.extend(
    box(870, RY1, 200, 90, "试样分发\ntest-distribute\n只生成检测任务单", bg="#f1f5f9", stroke="#64748b", fontSize=12)
)
elements.extend(
    box(1110, RY1, 200, 90, "③ 接收试样\ntest-detect\n检测员签 + 数量", bg="#fde68a", stroke="#b45309", fontSize=12)
)
elements.extend(
    box(1350, RY1, 180, 90, "∥ 任务单签收\n（并行，非替代）", bg="#fce7f3", stroke="#db2777", fontSize=12)
)

elements.append(h_arrow(200, RY1 + 45, 240, color="#d97706"))
elements.append(h_arrow(390, RY1 + 45, 430, color="#d97706"))
elements.append(text(395, RY1 + 20, "是", fontSize=12, color="#ea580c", width=30))
elements.append(h_arrow(610, RY1 + 45, 650, color="#d97706"))
elements.append(h_arrow(830, RY1 + 45, 870, color="#64748b"))
elements.append(h_arrow(1070, RY1 + 45, 1110, color="#d97706"))
elements.append(h_arrow(1310, RY1 + 45, 1350, color="#db2777", style="dashed"))

# skip prepare: from diamond bottom to 领样
elements.append(arrow(315, RY1 + 95, [[0, 0], [0, 35], [425, 35]], color="#ea580c", style="dashed"))
elements.append(text(420, RY1 + 108, "否 · 跳过制备", fontSize=12, color="#ea580c", width=120))

# Row 2: return path
RY2 = Y3 + 250
elements.append(v_arrow(1210, RY1 + 90, RY2, color="#d97706"))
elements.extend(
    box(
        700,
        RY2,
        220,
        90,
        "④ 还样确认\nsample-return-confirm\n还样人签（可多行）",
        bg="#fde68a",
        stroke="#b45309",
        fontSize=12,
    )
)
elements.append(arrow(1210, RY2 + 45, [[0, 0], [-290, 0]], color="#d97706"))

elements.extend(diamond_label(970, RY2 - 5, 150, 100, "是否\n退样？"))
elements.append(h_arrow(920, RY2 + 45, 970, color="#d97706"))

elements.extend(
    box(
        1170,
        RY2,
        220,
        90,
        "⑤ 退样\nsample-return-client\n自取签收 / 快递退回",
        bg="#fde68a",
        stroke="#b45309",
        fontSize=12,
    )
)
elements.append(h_arrow(1120, RY2 + 45, 1170, color="#d97706"))
elements.append(text(1125, RY2 + 20, "是", fontSize=12, color="#ea580c", width=30))

# no return
elements.append(v_arrow(1045, RY2 + 95, RY2 + 135, color="#ea580c", style="dashed"))
elements.extend(box(970, RY2 + 135, 150, 45, "结束流转行", bg="#f1f5f9", stroke="#64748b", fontSize=13))
elements.append(text(1055, RY2 + 105, "否", fontSize=12, color="#ea580c", width=30))

# notes — left side under row1, clear of row2 boxes
elements.append(
    text(
        60,
        RY2,
        "关键点：\n"
        "· 试样分发不写流转单，只产出 N 份检测任务单\n"
        "· 「接收试样」同时：流转单追加行 + 任务单签收\n"
        "· 制备 / 接收 / 还样可多行\n"
        "· 退样二选一：委托单位取回 OR 快递退回",
        fontSize=12,
        color="#78716c",
        width=520,
    )
)

# ========== ④ RENDER ==========
Y4 = 1065
elements.append(rect(40, Y4, 1520, 210, bg="#eff6ff", stroke="#93c5fd", sw=1, rough=0))
elements.append(text(60, Y4 + 12, "④ 渲染与消费（委托详情入口）", fontSize=20, color="#1e40af", width=480))
elements.append(
    text(
        500,
        Y4 + 18,
        "entrust-detail.html  ·  HTML 预览 / PageOffice / 打印 / 批量导出",
        fontSize=13,
        color="#64748b",
        width=700,
    )
)

elements.extend(
    box(
        70,
        Y4 + 55,
        240,
        130,
        "流转单文档对象\nWord（主） + PDF（附）\n当前最新版本\n表头字段 + 流程表行",
        bg="#bfdbfe",
        stroke="#2563eb",
        fontSize=13,
    )
)

consume = [
    (370, "查看\nHTML 预览模态\n或 PageOffice 只读"),
    (600, "编辑\nPageOffice 打开\n关闭 → MANUAL minor"),
    (830, "查看历史\n版本链 V1.0→Vn.m\n可内容回滚"),
    (1060, "打印\n套用 task_flow\n页眉页脚图片"),
    (1290, "批量导出 ZIP\n类型 flow_sheet\n仅当前最新"),
]
for x, label in consume:
    elements.extend(box(x, Y4 + 70, 200, 100, label, bg="#dbeafe", stroke="#2563eb", fontSize=12))
    elements.append(h_arrow(310, Y4 + 120, x, color="#2563eb"))

# ========== ⑤ VERSION + ⑥ SIBLING ==========
Y5 = 1315
elements.append(rect(40, Y5, 920, 200, bg="#faf5ff", stroke="#d8b4fe", sw=1, rough=0))
elements.append(text(60, Y5 + 12, "⑤ 版本规则", fontSize=20, color="#6b21a8", width=200))
elements.extend(
    box(
        70,
        Y5 + 50,
        420,
        125,
        "SYSTEM · major 升版\n· generate　首次生成\n· node_backfill　节点回填有内容变化\n· workflow_rollback　流程回退改写行",
        bg="#f3e8ff",
        stroke="#9333ea",
        fontSize=13,
    )
)
elements.extend(
    box(
        520,
        Y5 + 50,
        400,
        125,
        "MANUAL · minor 升版\n· edit_close　人工编辑关闭\n· content_rollback　内容回滚\n同版本可挂 Word + PDF",
        bg="#f3e8ff",
        stroke="#9333ea",
        fontSize=13,
    )
)

elements.append(rect(1000, Y5, 560, 200, bg="#fdf2f8", stroke="#f9a8d4", sw=1, rough=0))
elements.append(text(1020, Y5 + 12, "⑥ 与「检测任务单」关系", fontSize=20, color="#9d174d", width=400))
elements.append(
    text(
        1020,
        Y5 + 50,
        "流转单：委托 1 份，收样生成，全程交接留痕\n"
        "任务单：检测员 N 份，分发时生成\n\n"
        "交汇点仅在「接收试样」：\n"
        "任务单签收 ∥ 流转单追加「接收试样」行\n"
        "独立版本、独立模版（SL/ZJ15-01 vs QD088）",
        fontSize=13,
        color="#831843",
        width=520,
    )
)

# ========== DOC STRUCTURE ==========
Y6 = 1555
elements.append(rect(40, Y6, 1520, 155, bg="#ffffff", stroke="#cbd5e1", sw=1, rough=0))
elements.append(text(60, Y6 + 12, "⑦ 单据结构（渲染结果）", fontSize=20, color="#0f172a", width=360))
parts = [
    (70, 200, "页眉元数据\nQD088-2022", "#f1f5f9", "#475569"),
    (300, 260, "标题\n检测任务及流转单", "#f1f5f9", "#475569"),
    (590, 360, "表头字段区\n样品号/名称/类别/规格\n数量/日期/项目/标准", "#f1f5f9", "#475569"),
    (980, 540, "流程表（动态行 · 节点回填区）\n检测流程 | 签名/日期 | 数量 | 备注", "#fef3c7", "#d97706"),
]
for x, w, label, bg, st in parts:
    elements.extend(box(x, Y6 + 50, w, 80, label, bg=bg, stroke=st, fontSize=12))
elements.append(h_arrow(270, Y6 + 90, 300, color="#64748b"))
elements.append(h_arrow(560, Y6 + 90, 590, color="#64748b"))
elements.append(h_arrow(950, Y6 + 90, 980, color="#64748b"))

elements.append(
    text(
        60,
        Y6 + 170,
        "页面链路：sample-receive → sample-prepare → sample-dispatch-edit → test-distribute-edit → test-detect → sample-return-confirm → sample-return-client → entrust-detail",
        fontSize=12,
        color="#94a3b8",
        width=1450,
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

out = "/workspace/docs/feishu/检测任务及流转单-生成渲染整体流程.excalidraw"
with open(out, "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=2)
print("wrote", out)
print("elements", len(elements))
