#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate Excalidraw scene for 3 short-link deployment schemes."""
import json
import time
import uuid
import shutil
from pathlib import Path


def nid():
    return uuid.uuid4().hex[:20]


def rect(x, y, w, h, bg, stroke="#334155"):
    return {
        "type": "rectangle",
        "version": 1,
        "versionNonce": abs(hash((x, y, w, h))) % 10_000_000,
        "isDeleted": False,
        "id": nid(),
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "angle": 0,
        "x": x,
        "y": y,
        "width": w,
        "height": h,
        "seed": abs(hash((bg, x, y))) % 10_000_000,
        "groupIds": [],
        "frameId": None,
        "roundness": {"type": 3},
        "boundElements": [],
        "updated": int(time.time() * 1000),
        "link": None,
        "locked": False,
        "backgroundColor": bg,
        "strokeColor": stroke,
    }


def txt(x, y, content, font_size=18, color="#0f172a", width=None):
    lines = content.count("\n") + 1
    longest = max(len(line) for line in content.split("\n"))
    w = width if width is not None else max(40, int(longest * font_size * 0.6))
    return {
        "type": "text",
        "version": 1,
        "versionNonce": abs(hash(content + str(x))) % 10_000_000,
        "isDeleted": False,
        "id": nid(),
        "fillStyle": "solid",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 0,
        "opacity": 100,
        "angle": 0,
        "x": x,
        "y": y,
        "width": w,
        "height": round(font_size * 1.35 * lines, 2),
        "seed": abs(hash(content)) % 10_000_000,
        "groupIds": [],
        "frameId": None,
        "roundness": None,
        "boundElements": [],
        "updated": int(time.time() * 1000),
        "link": None,
        "locked": False,
        "fontSize": font_size,
        "fontFamily": 1,
        "text": content,
        "originalText": content,
        "textAlign": "left",
        "verticalAlign": "top",
        "containerId": None,
        "baseline": font_size,
        "lineHeight": 1.25,
        "strokeColor": color,
        "backgroundColor": "transparent",
    }


def labeled_box(x, y, w, h, content, bg, stroke="#334155", font_size=16):
    r = rect(x, y, w, h, bg, stroke)
    t = txt(x + 12, y + 14, content, font_size, "#0f172a", w - 24)
    t["textAlign"] = "center"
    return [r, t]


def arrow(x1, y1, x2, y2, label="", color="#334155"):
    els = [{
        "type": "arrow",
        "version": 1,
        "versionNonce": abs(hash((x1, y1, x2, y2))) % 10_000_000,
        "isDeleted": False,
        "id": nid(),
        "fillStyle": "solid",
        "strokeWidth": 2,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "angle": 0,
        "x": x1,
        "y": y1,
        "width": abs(x2 - x1),
        "height": abs(y2 - y1),   # 与 Excalidraw 保存口径一致：宽高取正，方向由 points 表达
        "seed": abs(hash((x1, x2, label))) % 10_000_000,
        "groupIds": [],
        "frameId": None,
        "roundness": {"type": 2},
        "boundElements": [],
        "updated": int(time.time() * 1000),
        "link": None,
        "locked": False,
        "startBinding": None,
        "endBinding": None,
        "lastCommittedPoint": None,
        "startArrowhead": None,
        "endArrowhead": "arrow",
        "points": [[0, 0], [x2 - x1, y2 - y1]],
        "strokeColor": color,
        "backgroundColor": "transparent",
    }]
    if label:
        els.append(txt((x1 + x2) / 2 - 28, (y1 + y2) / 2 - 20, label, 14, color, 80))
    return els


def main():
    els = []
    els.append(txt(80, 36, "合格证短链 QR · 三种部署实现方案", 32, "#0f172a", 720))
    els.append(txt(80, 82, "共性链路：扫码 → 短链 URL → 查表 → HTTP 302 → 验真 H5", 16, "#64748b", 640))

    # Scheme 1
    y0 = 130
    els.append(txt(80, y0, "方案 1 · 局域网部署（仅内网扫码，外网不需要验真）", 22, "#166534", 720))
    els.append(rect(60, y0 + 40, 1180, 210, "#f0fdf4", "#16a34a"))
    els += labeled_box(80, y0 + 90, 180, 70, "手机/扫码枪\n实验室 WiFi", "#fde68a", "#854d0e")
    els += labeled_box(320, y0 + 90, 200, 70, "内网 DNS / Nginx\nlims.local 或 10.x", "#bfdbfe", "#1e40af")
    els += labeled_box(580, y0 + 90, 200, 70, "短链服务\n/l/{code}", "#93c5fd", "#1e40af")
    els += labeled_box(840, y0 + 90, 200, 70, "验真 H5\nLIMS 内网", "#86efac", "#166534")
    els += arrow(260, y0 + 125, 320, y0 + 125, "扫码", "#166534")
    els += arrow(520, y0 + 125, 580, y0 + 125, "", "#166534")
    els += arrow(780, y0 + 125, 840, y0 + 125, "HTTP 302", "#166534")
    els.append(rect(80, y0 + 175, 1000, 55, "#fff3bf", "#e67700"))
    els.append(txt(
        94, y0 + 188,
        "要点：QR 编码 http://lims.local/l/Ab3K9（或内网 IP）。无需公网出口；适合日常打印、完全隔离内网。",
        15, "#7c2d12", 970,
    ))

    # Scheme 2
    y1 = 400
    els.append(txt(80, y1, "方案 2 · 局域网部署 + 对外发放标签（内外都能扫）", 22, "#9a3412", 720))
    els.append(rect(60, y1 + 40, 1180, 310, "#fff7ed", "#ea580c"))
    els.append(txt(80, y1 + 55, "内网日常打印路径", 16, "#1d4ed8", 200))
    els += labeled_box(80, y1 + 85, 150, 60, "内网手机\n实验室 WiFi", "#fde68a", "#854d0e")
    els += labeled_box(280, y1 + 85, 200, 60, "内网短链\nlims.local/l/{code}", "#bfdbfe", "#1e40af")
    els += labeled_box(530, y1 + 85, 160, 60, "内网验真 H5", "#86efac", "#166534")
    els += arrow(230, y1 + 115, 280, y1 + 115, "", "#1d4ed8")
    els += arrow(480, y1 + 115, 530, y1 + 115, "302", "#1d4ed8")

    els += labeled_box(780, y1 + 150, 230, 75, "同一 code 映射表\ncode ↔ sample_no", "#fdba74", "#c2410c")

    els.append(txt(80, y1 + 175, "对外发放标签路径", 16, "#b91c1c", 200))
    els += labeled_box(80, y1 + 205, 150, 60, "外网手机\n4G / 5G", "#fecaca", "#9a3412")
    els += labeled_box(280, y1 + 205, 250, 60, "公网短链边缘 / DMZ\nlab.example.com/l/{code}", "#fdba74", "#9a3412")
    els += labeled_box(560, y1 + 205, 200, 60, "公网验真 H5\n(可读内网 API)", "#fca5a5", "#9a3412")
    els += arrow(230, y1 + 235, 280, y1 + 235, "", "#b91c1c")
    els += arrow(530, y1 + 235, 560, y1 + 235, "302", "#b91c1c")
    els += arrow(690, y1 + 115, 780, y1 + 170, "查表", "#9a3412")
    els += arrow(760, y1 + 235, 780, y1 + 210, "查表", "#9a3412")

    els.append(rect(80, y1 + 285, 1120, 50, "#fff3bf", "#e67700"))
    els.append(txt(
        94, y1 + 297,
        "要点：内网日常用内网 Base；对外发放标签用公网 Base；可共用同一 code。外网不能直连内网 IP，必须有公网边缘。",
        15, "#7c2d12", 1090,
    ))

    # Scheme 3
    y2 = 770
    els.append(txt(80, y2, "方案 3 · 公网部署（内外任意网络可扫）", 22, "#5b21b6", 720))
    els.append(rect(60, y2 + 40, 1180, 210, "#f5f3ff", "#7c3aed"))
    els += labeled_box(80, y2 + 90, 180, 70, "任意手机\n4G / WiFi", "#fde68a", "#854d0e")
    # 公网短链框：URL 变长后单独加宽并把「域名 / 路径」拆成两行，后续框整体右移
    els += labeled_box(320, y2 + 81, 360, 88,
                       "公网短链\nhttps://lims-with-bzk-plan.vercel.app\n/l/Ab3K9", "#ddd6fe", "#5b21b6")
    els += labeled_box(740, y2 + 90, 200, 70, "短链服务\n查表 /l/{code}", "#c4b5fd", "#5b21b6")
    els += labeled_box(1000, y2 + 90, 220, 70, "公网验真 H5/API\nLIMS 云或公网", "#a78bfa", "#5b21b6")
    els += arrow(260, y2 + 125, 320, y2 + 125, "扫码", "#5b21b6")
    els += arrow(680, y2 + 125, 740, y2 + 125, "", "#5b21b6")
    els += arrow(940, y2 + 125, 1000, y2 + 125, "HTTP 302", "#5b21b6")
    els.append(rect(80, y2 + 185, 1140, 55, "#fff3bf", "#e67700"))
    els.append(txt(
        94, y2 + 198,
        "要点：架构与方案1相同，仅域名换成公网可达地址。内外都能扫；纯隔离内网需另建内网入口或改用方案1/2。",
        15, "#7c2d12", 1110,
    ))

    els.append(txt(
        80, 1040,
        "图例：黄=扫码端 · 蓝=内网组件 · 橙=公网边缘/映射 · 绿/紫=验真页 · 302=短链跳转",
        14, "#64748b", 900,
    ))
    els.append(txt(
        80, 1070,
        "打开：https://excalidraw.com → 菜单 Open → 选择本 .excalidraw 文件",
        14, "#64748b", 800,
    ))

    doc = {
        "type": "excalidraw",
        "version": 2,
        "source": "https://excalidraw.com",
        "elements": els,
        "appState": {"gridSize": 20, "viewBackgroundColor": "#ffffff"},
        "files": {},
    }

    # 输出到仓库内 docs/feishu/，脚本可从任意工作目录运行
    repo = Path(__file__).resolve().parents[1]
    out = repo / "docs" / "feishu" / "合格证短链-三种部署方案.excalidraw"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", out, "elements=", len(els))


if __name__ == "__main__":
    main()
