# -*- coding: utf-8 -*-
from timeline_wb import *
W, H = 1700, 830
b = Board(W, H)
LX = 64
weeks = [
    ("Week 1", "Day 1–5", "需求分析 + 架构设计", [
        ("Day 1–2", "需求调研", ["访谈 3–5 位资深审核员，收集高频问题", "统计近 3 个月退回原因 TOP20", "梳理现有审核 SOP 与检查清单", "确定首批接入领域（1–2 个高频）"]),
        ("Day 3–4", "规则梳理与优先级排序", ["审核检查项转化为可量化规则", "按频率 × 影响度排序，定 50 条", "定义规则输入 / 输出 / 判定逻辑", "与审核员确认规则逻辑", "品类字典镜像 + 首批 3 个品类绑定"]),
        ("Day 5", "技术架构设计", ["确定与 LIMS 系统的集成方式", "确定规则引擎技术方案", "数据库 schema 设计", "API 接口定义"]),
    ]),
    ("Week 2", "Day 6–10", "核心开发", [
        ("Day 6–7", "规则引擎框架开发", ["BaseRule 基类实现", "ReviewEngine 核心逻辑", "规则注册 / 发现 / 执行机制", "结果聚合与评分算法"]),
        ("Day 8–9", "具体规则实现", ["Category A 数据完整性 17 条", "Category B 逻辑一致性 18 条", "Category C 格式规范性 10 条", "绑定表与品类参数注入开发"]),
        ("Day 10", "数据接口开发", ["LIMS 数据提取适配器", "报告数据结构化处理", "标准限值数据接口"]),
    ]),
    ("Week 3", "Day 11–15", "界面开发 + 集成", [
        ("Day 11–12", "审核结果展示界面", ["审核结果总览页面", "问题清单详情组件", "审核评分雷达图", "审核员操作按钮（同意/不同意/备注）"]),
        ("Day 13–14", "LIMS 系统集成", ["工作流触发点配置", "审核结果嵌入审核页面", "审核员反馈数据保存", "基础统计接口"]),
        ("Day 15", "集成测试", ["端到端流程测试", "规则准确性验证", "性能测试"]),
    ]),
    ("Week 4", "Day 16–20", "测试 + 试运行 + 优化", [
        ("Day 16–17", "UAT 测试", ["选取 50 份历史报告回归测试", "审核员参与验证 AI 审核结果", "收集误判 / 漏判案例", "修复发现的问题", "通过线：误报 0 条、漏报 ≤ 2 条"]),
        ("Day 18–19", "小范围试运行", ["选择 1–2 个检测组试用", "AI 审核与人工审核并行运行", "收集审核员使用反馈", "统计准确率与效率提升"]),
        ("Day 20", "总结与规划", ["M1 成果总结报告", "规则准确率分析", "收集的反馈整理", "M2 详细计划制定", "未达通过线：M1 不出口，Day 18–19 顺延"]),
    ]),
]
b.title(LX, 82, "M1 详细排期 · 20 个工作日")
# ---- timeline spine ----
sy = 150
cw = (1636 - LX - 3*24) / 4          # card width
xs = [LX + i*(cw + 24) for i in range(4)]
b.arrow(LX, sy, 1636, sy)
for i, (wk, days, theme, pkgs) in enumerate(weeks):
    x = xs[i]
    b.rect(x, sy - 24, cw, 48, BLUE, rx=6)
    b.txt(x + 18, sy + 6, wk, 22, LIME, bold=True)
    b.txt(x + cw - 18, sy + 6, days, 18, WHITE, anchor="end")
    b.arrow(x + cw/2, sy + 26, x + cw/2, sy + 46)     # short vertical link
# ---- cards ----
cy = sy + 50
maxlines = max(sum(1 + len(p[2]) for p in pkgs) for _, _, _, pkgs in weeks)
ch = 46 + 3*10 + maxlines*24 + 22
for i, (wk, days, theme, pkgs) in enumerate(weeks):
    x = xs[i]
    b.rect(x, cy, cw, ch, WHITE, rx=6, stroke=BLUE, sw=2)
    b.rect(x, cy, cw, 40, LIME, rx=6)
    b.txt(x + 16, cy + 27, f"{wk} · {theme}", 18, BLUE, bold=True, check=cw - 32)
    yy = cy + 40
    for (dr, name, items) in pkgs:
        yy += 28
        b.txt(x + 16, yy, dr, 15, BLUE, bold=True)
        b.txt(x + 16 + tw(dr, 15) + 8, yy, name, 16, BLUE, bold=True,
              check=cw - 32 - tw(dr, 15) - 8)
        for it in items:
            yy += 24
            b.txt(x + 22, yy, "· " + it, 15, BLUE, check=cw - 40)
b.rect(LX, cy + ch + 26, 1636 - LX, 52, BLUE, rx=6)
b.txt(LX + 24, cy + ch + 59, "M1 出口", 20, LIME, bold=True)
b.txt(LX + 130, cy + ch + 59, "≥ 50 条确定性规则上线 · 审核员看到 AI 预审结果 · 规则精确率 ≥ 99% · 单份审核 &lt; 5 秒", 19, WHITE,
      check=1636 - LX - 170)
b.save("b33.svg")
print("card h", ch, "canvas h needed", cy + ch + 90, "of", H)
