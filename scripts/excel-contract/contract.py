#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Excel 配置包契约 v0.2 的参考实现：
  convert <docx> <out.xlsx>   人工参数配置文档 → 契约格式 Excel
  check   <in.xlsx> [<md>]    跑 D0 全部校验规则（V01–V23），产出预检报告
  blank   <out.xlsx>          生成空白模板（含 _meta 与 D0 规则表）

契约定义见 docs/standard-library-excel-contract-v0.2.md
"""
import sys, os, re, json, datetime
from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

CONTRACT = "v0.2"
TASK = "DLT 802.3-2023"

# sheet 顺序 = 导入拓扑顺序
SHEETS = [
    ("00_包信息", ["项", "值", "备注"]),
    ("10_分类路径", ["任务键", "分类路径键", "上级路径键", "层级", "分类名称", "分类编号", "节点类型", "标准文件编号", "状态"]),
    ("20_样品", ["任务键", "样品键", "分类路径键", "名称", "样品代码", "标准号", "排序", "最大检测周期(月)", "单位",
               "备注", "区分型号", "是否电缆", "电缆结构", "线芯颜色", "芯数", "相别", "产品标记开关", "产品标记规则"]),
    ("30_规格参数", ["规格键", "样品键", "序号", "名称", "符号", "单位", "是否主规格", "备注"]),
    ("40_型号", ["型号键", "样品键", "型号", "名称", "排序", "最大检测周期(月)", "描述"]),
    ("41_型号规格赋值", ["型号键", "规格键", "是否参与", "赋值方式", "可选项"]),
    ("50_试验项", ["任务键", "试验项键", "归属类型", "归属键", "试验名称", "试验编码", "质量特性", "检测类别",
                "是否制样", "多芯电缆试验线芯数", "样段", "启用样段", "试样数量", "试样类别代码",
                "试验过程", "标准要求", "检测费用(元)", "检测设备", "状态", "排序"]),
    ("51_试验依据", ["试验项键", "序号", "标准文件编号", "标准文件名称", "章节"]),
    ("52_试验子项", ["子项键", "试验项键", "试验子项", "标准要求", "排序"]),
    ("60_控制参数", ["参数键", "试验项键", "子项键", "名称", "符号", "单位", "是否开启映射", "映射类型",
                 "超出范围处理", "固定值", "试验检测显示", "排序", "备注"]),
    ("61_映射明细", ["归属类型", "归属键", "行号", "自变量序号", "自变量类型", "自变量键", "自变量形态",
                 "自变量值", "自变量下限", "自变量上限", "区间下限符号", "区间上限符号",
                 "因变量1", "因变量2", "因变量3", "因变量1符号", "因变量2符号"]),
    ("62_条件规则", ["规则键", "归属类型", "归属键", "规则序号", "逻辑组合", "条件序号", "条件变量类型",
                 "条件变量键", "对比符号", "目标值", "Then取值方式", "Then固定值", "Then公式",
                 "Then修约方式", "Then修约精度", "分支类型", "分支序号", "区", "连接词"]),
    ("70_测量参数", ["参数键", "试验项键", "子项键", "名称", "编码", "符号", "类型", "单位", "测量次数",
                 "修约方式", "修约精度", "条件修约", "排序"]),
    ("71_参数可选项", ["参数键", "序号", "数据标签", "是否默认"]),
    ("80_计算参数", ["参数键", "试验项键", "子项键", "名称", "编码", "符号", "单位", "绑定层级", "计算类型",
                 "数据源参数键", "统计类型", "公式", "公式库键", "公式绑定", "修约方式", "修约精度", "条件修约", "排序"]),
    ("90_标称值", ["任务键", "标称值键", "试验项键", "子项键", "标称值名称", "符号", "单位", "多行映射",
               "标称值类型", "单值", "负偏差", "正偏差", "最小值", "最小值符号", "最大值", "最大值符号",
               "公式", "公式库键", "修约方式", "修约精度", "备注"]),
    ("A0_判定配置", ["试验项键", "判定参数名", "判定参数类型", "可选项", "判定方式", "判断层级", "判定模式"]),
    ("A1_判定条件", ["试验项键", "条件序号", "条件类型", "对比参数键", "修饰符百分比", "修饰符符号", "修饰符常量",
                 "对比符号", "报告展开式", "被对比标称值键", "被对比参数键", "自定义数值", "子项结论来源"]),
    ("A2_结论映射", ["试验项键", "结论序号", "结论值", "逻辑"]),
    ("B0_采集配置", ["参数键", "类型", "参数编码", "计算顺序", "是否覆盖LIMS参数"]),
    ("C0_待定项", ["问题ID", "任务键", "问题层级", "目标sheet", "目标行键", "目标列", "状态", "置信度",
               "问题文本", "候选项", "人工回答", "回答来源", "依据出处"]),
    ("D0_校验规则", ["规则ID", "目标sheet", "目标列", "规则说明", "严重级", "失败提示", "触发时机"]),
]
COLS = {n: c for n, c in SHEETS}

# ── D0 规则清单（与契约编号一致）──
RULES = [
    ("V01", "20_样品", "分类路径键", "样品必须能追溯到一条 节点类型=标准文件 的祖先", "阻断", "缺少标准文件父节点，无法新增样品", "F3预检"),
    ("V02", "20_样品", "区分型号", "区分型号=是 ⇒ 40_型号≥1行；=否 ⇒ 40_型号必须为空", "阻断", "区分型号与型号数据不一致", "F3预检"),
    ("V03", "20_样品", "产品标记规则", "规则内引用的每个 [规格参数.x.值] 必须存在于 30_规格参数", "阻断", "产品标记引用了不存在的规格参数", "F3预检"),
    ("V04", "41_型号规格赋值", "可选项", "赋值方式=用户选择 ⇒ 可选项非空", "阻断", "用户选择型规格参数缺少可选项", "F3预检"),
    ("V05", "50_试验项", "试验编码", "匹配 ^[a-z][a-z0-9_]*$ 且在大类内绝对唯一", "阻断", "试验编码格式非法或大类内重号", "F3预检"),
    ("V06", "50_试验项", "检测类别", "每个值命中字典，或在 C0 挂着「新增字典选项」问题", "阻断", "检测类别既不在字典也无待确认问题", "F3预检"),
    ("V07", "60_控制参数", "映射类型", "组合映射 ⇒ 61 里该参数≥2个自变量", "阻断", "组合映射自变量不足2个", "F3预检"),
    ("V08", "60_控制参数", "映射类型", "条件映射 ⇒ 62 必须有规则且If三要素齐全", "阻断", "条件映射缺少规则", "F3预检"),
    ("V09", "90_标称值", "标称值类型", "公式 ⇒ 61 不得有该归属的行", "阻断", "公式类型不允许多行映射", "F3预检"),
    ("V10", "62_条件规则", "对比符号", "is null / is not null ⇒ 目标值必须为空", "阻断", "空值判断不应填目标值", "F3预检"),
    ("V10b", "62_条件规则", "分支类型", "IF恰好一条且排首；ELSE至多一条且排尾；每个IF/ELSE IF≥1条件；每分支≥1 THEN", "阻断", "判断条件树结构非法", "F3预检"),
    ("V10c", "62_条件规则", "对比符号", "判断条件 THEN 侧同样受 V19 的「满足」推导约束", "阻断", "THEN 侧修饰符/符号违规", "F3预检"),
    ("V11", "70_测量参数", "类型", "下拉选项 ⇒ 71 有可选项且默认值在列内", "阻断", "下拉选项参数缺可选项或默认值越界", "F3预检"),
    ("V12", "70_测量参数", "修约方式", "直接取值 ⇒ 不写修约精度", "告警", "直接取值形态下修约精度不生效", "F3预检"),
    ("V13", "80_计算参数", "公式", "每个 {参数名称|符号} 在同一样品/型号内可唯一解析；括号闭合", "阻断", "公式变量无法解析", "F3预检"),
    ("V14", "80_计算参数", "公式绑定", "绑定实测值测量次数 ⇒ 公式内实测值测量次数一致", "阻断", "数组运算的测量次数不一致", "F3预检"),
    ("V15", "90_标称值", "最小值/最大值", "范围 ⇒ 最小值与最大值必须成对", "阻断", "范围类型未成对", "F3预检"),
    ("V16", "90_标称值", "多行映射", "多行映射=开 且 类型=公式 ⇒ 拒绝（V09镜像）", "阻断", "公式与多行映射互斥", "F3预检"),
    ("V17", "A0_判定配置", "判定方式", "系统判定 ⇒ A1 至少一条规则", "阻断", "系统判定未配置任何判定规则", "F3预检"),
    ("V18", "A0_判定配置", "判断层级", "样段⇒所属试验项 是否制样=是；线芯⇒样品 是否电缆=是", "阻断", "判断层级与样品属性冲突", "F3预检"),
    ("V19", "A1_判定条件", "对比符号", "符号由标称值类型推导：非单值⇒必须「满足」且无修饰符；单值⇒必须 ∈ = != < ≤ > ≥ 且禁「满足」", "阻断", "对比符号与标称值类型推导结果不符", "F3预检"),
    ("V19b", "A1_判定条件", "对比符号", "被对比标称值键为空⇒对比符号必须留空（禁选态，不允许先填符号）", "阻断", "标称值未定时填了对比符号", "F3预检"),
    ("V19c", "A1_判定条件", "报告展开式", "符号=满足⇒报告展开式必填且须由标称值类型与取值推出", "告警", "报告展开式与标称值配置不一致", "F3预检"),
    ("V20", "A2_结论映射", "结论值", "同试验项不得出现两条相同结论", "告警", "存在重复结论，建议合并", "F3预检"),
    ("V21", "90_标称值", "标称值键", "被 A1 引用的标称值不得删除", "阻断", "标称值被判定引用，需先解除绑定", "F2重算"),
    ("V22", "B0_采集配置", "计算顺序", "必须构成拓扑序：公式引用者序号 > 被引用者序号", "阻断", "计算顺序违反依赖关系", "F3预检"),
    ("V23", "B0_采集配置", "计算顺序", "从1连续、无重复、覆盖全部参数", "阻断", "采集配置缺参数或序号断裂", "F3预检"),
]
DICT_CATEGORY = ["例行试验", "型式试验", "抽样试验", "委托检测", "出厂检验"]
NOM_SINGLE = "单值"
CMP_NUM = ["=", "!=", "<", "≤", ">", "≥"]
CMP_CONFORM = "满足"


def is_on(v):
    return str(v or "").strip() in ("是", "开", "true", "TRUE", "Y", "1")


def nom_report_expr(nom_row, n_map_rows=0):
    """「满足」在报告里展开成的实际数学式：配置语言防错，报告语言仍是标准语言。"""
    t = g(0, "标称值类型", nom_row) or NOM_SINGLE
    u = (g(0, "单位", nom_row) or "").strip()
    sfx = (" " + u) if u else ""
    if is_on(g(0, "多行映射", nom_row)):
        return "按 %d 行映射逐行展开" % n_map_rows if n_map_rows else "按多行映射逐行展开"
    if t == "公式":
        return "按公式 %s 计算后判定" % (g(0, "公式", nom_row) or "…")
    if t == "单值":
        return (g(0, "单值", nom_row) or "…") + sfx
    if t == "公差":
        pos, neg = g(0, "正偏差", nom_row), g(0, "负偏差", nom_row)
        base = g(0, "单值", nom_row) or "…"
        if pos and neg:
            return base + ("±%s" % pos if pos == neg else "+%s/-%s" % (pos, neg)) + sfx
        return base + (("+%s" % pos) if pos else (("-%s" % neg) if neg else "…")) + sfx
    if t == "最小值":
        return (g(0, "最小值符号", nom_row) or "≥") + (g(0, "最小值", nom_row) or "…") + sfx
    if t == "最大值":
        return (g(0, "最大值符号", nom_row) or "≤") + (g(0, "最大值", nom_row) or "…") + sfx
    if t == "范围":
        lo = "[" if (g(0, "最小值符号", nom_row) or "≥") != ">" else "("
        hi = "]" if (g(0, "最大值符号", nom_row) or "≤") != "<" else ")"
        return "∈%s%s, %s%s%s" % (lo, g(0, "最小值", nom_row) or "…", g(0, "最大值", nom_row) or "…", hi, sfx)
    return ""


ROUND_ONLY = re.compile(r"^(四舍五入|四舍六入五成双|全进位|全舍弃|直接取值)[，,、]?\s*(?:保留(\d+)位小数)?$")


def round_only(expr):
    """Word 里有些「计算公式」单元格其实只写了修约规则。剥出来填进修约两列，公式列留空。"""
    e = (expr or "").strip()
    m = ROUND_ONLY.match(e)
    if not m:
        return e, "", ""
    return "", m.group(1), (m.group(2) or "")


def finalize_codes(P):
    """试验编码：格式归一 + 大类内去重。冲突加 _2/_3（口径已定，不用流水号）。"""
    seen = {}
    for r in P.rows["50_试验项"]:
        d = dict(zip(COLS["50_试验项"], r))
        raw = str(d.get("试验编码") or "")
        base = re.sub(r"[^a-z0-9_]", "", raw.lower()) or ""
        if not base:
            base = "t%02d" % (len(P.rows["50_试验项"]) + 1)
        code, k = base, 2
        while code in seen:
            code = "%s_%d" % (base, k); k += 1
        seen[code] = d["试验项键"]
        if code != raw:
            r[COLS["50_试验项"].index("试验编码")] = code
            if raw:
                P.notes.append("试验编码 %s：「%s」→「%s」（大类内去重 / 格式归一）" % (d["试验项键"], raw, code))


def finalize_b0(P):
    """B0 = 采集配置 Tab 的参数顺序 + 全局连续计算顺序。
    口径（已拍板）：跨类型顺序以 B0 为准；顺序由依赖拓扑推出，
    Word 采集配置里显式给出的顺序、以及同类型内的原有顺序，只作为拓扑的先后偏好。"""
    P.rows["B0_采集配置"] = []
    params = []
    for sheet, typ, keycol, in (("60_控制参数", "控制参数", "参数键"),
                                ("70_测量参数", "测量参数", "参数键"),
                                ("80_计算参数", "计算参数", "参数键"),
                                ("90_标称值", "标称值", "标称值键")):
        for r in P.rows[sheet]:
            d = dict(zip(COLS[sheet], r))
            k = d.get(keycol) or ""
            if not k:
                continue
            params.append({"key": k, "tkey": d.get("试验项键", ""), "type": typ,
                           "name": d.get("名称") or d.get("标称值名称") or "",
                           "code": d.get("编码", ""), "sort": int(d.get("排序") or 0)})
    by_key = {p["key"]: p for p in params}
    # 引用索引：同试验项内按 名称 / 符号 / 编码 命中
    idx = {}
    for pr in params:
        for f in ("name", "code", "key"):
            v = (pr[f] or "").strip()
            if v:
                idx.setdefault((pr["tkey"], v), pr["key"])
    sym_idx = {}
    for sheet, keycol in (("60_控制参数", "参数键"), ("70_测量参数", "参数键"),
                          ("80_计算参数", "参数键"), ("90_标称值", "标称值键")):
        for r in P.rows[sheet]:
            d = dict(zip(COLS[sheet], r))
            k = d.get(keycol) or ""
            for f in ("符号", "名称", "编码", "标称值名称"):
                v = (d.get(f) or "").strip()
                if v:
                    sym_idx.setdefault(v, []).append(k)

    def refs(text, tkey):
        out = set()
        if not text:
            return out
        for m in re.finditer(r"\{([^}|]+)(?:|[^}]*)\}", text):
            v = m.group(1).strip()
            k = idx.get((tkey, v)) or (sym_idx.get(v) or [None])[0]
            if k:
                out.add(k)
        for v, k in sym_idx.items():
            if len(v) >= 2 and re.search(r"(?<![0-9A-Za-z_])" + re.escape(v) + r"(?![0-9A-Za-z_])", text):
                for cand in k:
                    if by_key[cand]["tkey"] == tkey:
                        out.add(cand)
        return out

    deps = {}
    expr_of = {}
    for sheet, keycol, exprcols in (("80_计算参数", "参数键", ("公式",)),
                                    ("90_标称值", "标称值键", ("公式",)),
                                    ("62_条件规则", "", ())):
        for r in P.rows[sheet]:
            d = dict(zip(COLS[sheet], r))
            k = d.get(keycol) or ""
            if not k:
                continue
            expr_of.setdefault(k, []).extend(d.get(c, "") for c in exprcols)
    for r in P.rows["62_条件规则"]:
        d = dict(zip(COLS["62_条件规则"], r))
        owner = d.get("归属键") or ""
        if owner in by_key:
            expr_of.setdefault(owner, []).append(d.get("Then公式", ""))
    for k, es in expr_of.items():
        tkey = by_key[k]["tkey"]
        deps[k] = {x for e in es for x in refs(e, tkey)} - {k}

    indeg = {p["key"]: 0 for p in params}
    adj = {p["key"]: [] for p in params}
    for k, ds in deps.items():
        for d in ds:
            if d in indeg:
                adj[d].append(k); indeg[k] += 1

    def pref(k):
        p = by_key[k]
        h = P.b0_hint.get((p["tkey"], p["code"])) or P.b0_hint.get((p["tkey"], p["name"]))
        return (p["tkey"], h[0] if h else 9999, p["sort"], k)

    import heapq
    order, heap = [], [pref(k) + (k,) for k, v in indeg.items() if v == 0]
    heapq.heapify(heap)
    seen = set()
    while heap:
        pr = heapq.heappop(heap)
        k = pr[-1]
        if k in seen:
            continue
        seen.add(k); order.append(k)
        for nx in adj[k]:
            indeg[nx] -= 1
            if indeg[nx] == 0:
                heapq.heappush(heap, pref(nx) + (nx,))
    if len(order) < len(params):
        cyc = [p["key"] for p in params if p["key"] not in seen]
        P.open_issue("字段", "B0_采集配置", cyc[0], "计算顺序", "AI推断", 0.3,
                     "参数之间存在循环引用或依赖无法解析，无法给出连续计算顺序：%s" % "、".join(cyc[:6]),
                     "人工指定顺序、拆开公式、确认确实存在循环", "x.4 试验参数 / x.6 结果判定")
        for t in sorted({by_key[c]["tkey"] for c in cyc}):
            order += sorted([c for c in cyc if by_key[c]["tkey"] == t], key=pref)
    for n, k in enumerate(order, 1):
        p = by_key[k]
        h = P.b0_hint.get((p["tkey"], p["code"])) or P.b0_hint.get((p["tkey"], p["name"]))
        P.add("B0_采集配置", 参数键=k, 类型=p["type"], 参数编码=p["code"] or p["name"],
              计算顺序=n, 是否覆盖LIMS参数=h[2] if h else "开")


def blocks(doc):
    for ch in doc.element.body.iterchildren():
        if ch.tag.endswith('}p'):
            yield Paragraph(ch, doc)
        elif ch.tag.endswith('}tbl'):
            yield Table(ch, doc)


def grid(tbl):
    out = []
    for r in tbl.rows:
        row = []
        for c in r.cells:
            v = c.text.strip()
            if not row or row[-1] != v:
                row.append(v)
        out.append(row)
    return out


def kv(tbl):
    g = grid(tbl)
    d = {}
    for r in g[1:]:
        if len(r) >= 2:
            d[r[0]] = r[1]
    return d


def pad(g, n):
    w = max([len(r) for r in g] + [1]) if g else 1
    return [r + [""] * (w - len(r)) for r in g]


def norm_std(s):
    return re.sub(r"\s+", "", (s or "").replace("—", "-").replace("–", "-")).upper()


class Pack:
    def __init__(self):
        self.rows = {n: [] for n, _ in SHEETS}
        self.notes = []
        self.b0_hint = {}   # (试验项键, 参数编码/名称) → (Word 采集配置里的顺序, 是否覆盖LIMS)

    ALIAS = {"最大检测周期月": "最大检测周期(月)", "检测费用元": "检测费用(元)"}

    def add(self, sheet, **kw):
        kw = {self.ALIAS.get(k, k): v for k, v in kw.items()}
        cols = COLS[sheet]
        self.rows[sheet].append([kw.get(c, "") for c in cols])

    def open_issue(self, level, sheet, rowkey, col, state, conf, q, cand, src):
        oid = "Q%03d" % (len(self.rows["C0_待定项"]) + 1)
        self.add("C0_待定项", 问题ID=oid, 任务键=TASK, 问题层级=level, 目标sheet=sheet, 目标行键=rowkey,
                 目标列=col, 状态=state, 置信度=conf, 问题文本=q, 候选项=cand, 人工回答="",
                 回答来源="", 依据出处=src)
        return oid


# ══════════════ convert ══════════════
def convert(src, dst):
    P = Pack()
    doc = Document(src)
    SPEC0 = "S01-SP"
    items = list(blocks(doc))

    # ---- 10_分类路径 / 20_样品：从「样品基本信息」的 样品分类路径 拆 ----
    samples = []           # (label, kvdict)
    cur_sample = None
    specs_global = []
    models = []            # (型号标题, grid)
    tests = []             # list of dict per 试验项
    cur_test = None
    section = None
    mark_rule = ""
    path_str = ""
    pending_note = []

    for it in items:
        if isinstance(it, Paragraph):
            t = it.text.strip()
            st = it.style.name or ""
            if not t:
                continue
            if t.startswith("📝") or t.startswith("产品标记"):
                if "产品标记" in t or t.startswith("DS {") or t.startswith("📝 示例"):
                    mark_rule = mark_rule or t
            m = re.match(r"^型号[:：]\s*([A-Za-z0-9\-/]+)（(.+)）", t)
            if m and st.startswith("Heading"):
                models.append({"code": m.group(1), "name": m.group(2), "grid": None})
                section = "model"
                continue
            m = re.match(r"^试验项\s*(\d+)[:：]\s*(.+)$", t)
            if m and st.startswith("Heading"):
                cur_test = {"no": int(m.group(1)), "name": m.group(2).strip(), "info": [], "subs": None,
                            "ctrl": None, "meas": None, "calc": None, "nom": None, "judge": None, "collect": None}
                tests.append(cur_test)
                section = "test"
                continue
            m = re.match(r"^(\d+)\.(\d+)\s*(.+)$", t)
            if m and st.startswith("Heading") and cur_test is not None:
                sub = m.group(3)
                if "试验信息" in sub:
                    section = "info"
                elif "试验子项" in sub:
                    section = "subs"
                elif "控制参数" in sub or "预设值" in sub:
                    section = "ctrl"
                elif "测量参数" in sub or "实测值" in sub:
                    section = "meas"
                elif "计算参数" in sub or "计算值" in sub:
                    section = "calc"
                elif "标称值" in sub:
                    section = "nom"
                elif "结果判定" in sub:
                    section = "judge"
                elif "采集配置" in sub:
                    section = "collect"
                else:
                    section = None
                continue
            if st == "Heading 1":
                if "样品基本信息" in t:
                    section = "sampleinfo"
                elif "规格参数" in t and "全局定义" in t:
                    section = "specs"
                elif "型号列表" in t:
                    section = "model"
                elif "C级试验项" in t:
                    section = "test"
                elif "报告判定" in t or "型号配置汇总" in t:
                    section = "skip"
                    if "型号配置汇总" in t:
                        P.notes.append("「七、型号配置汇总对比」整表丢弃（契约第六节：人工核对用汇总表，不是数据）")
                else:
                    section = None
                continue
            if re.match(r"^样品\s*[A-Za-z０-９A-Za-z]\s*[:：]", t) and st == "Normal" \
                    and "|" not in t and "｜" not in t \
                    and len(re.findall(r"样品\s*[A-Za-z０-９A-Za-z]\s*[:：]", t)) == 1:
                samples.append({"label": t, "info": None})
        else:
            g = grid(it)
            heads = [str(g[k][0] or "") for k in (0, 1) if len(g) > k and g[k]]
            d0 = kv(it) if "字段" in heads else {}
            if "样品名称" in d0:
                # 两种文档形状都要能吃：12706 用「样品A：」标签分段，DS 每个样品自带一章
                if samples and samples[-1]["info"] is None:
                    samples[-1]["info"] = d0
                else:
                    samples.append({"label": "样品 %d：%s" % (len(samples) + 1, d0.get("样品名称", "")),
                                    "info": d0})
            elif section == "specs":
                specs_global.append(g)
            elif section == "model" and models and models[-1]["grid"] is None:
                models[-1]["grid"] = g
            elif cur_test is not None:
                slot = {"info": "info", "subs": "subs", "ctrl": "ctrl", "meas": "meas",
                        "calc": "calc", "nom": "nom", "judge": "judge", "collect": "collect"}.get(section)
                if slot:
                    cur_test[slot] = (cur_test.get(slot) or []) + [g]

    # ---- 样品 / 分类路径 ----
    path_keys = {}
    for si, s in enumerate(samples, 1):
        info = s["info"] or {}
        path_str = info.get("样品分类路径") or ""
        if not path_str:
            for k, v in info.items():
                if "分类" in k and ">" in str(v):
                    path_str = v
        parts = [x.strip() for x in re.split(r"[>＞]", str(path_str)) if x.strip()]
        parent = ""
        for li, name in enumerate(parts, 1):
            if name in path_keys:                      # 同一条分类链只建一次，样品共用叶子节点
                parent = path_keys[name]
                continue
            pk = "P%02d" % (len(path_keys) + 1)
            node = re.match(r"^(.*?)([A-Z]{2,4}?\s*/\s*\d{4}|\d{4})?$", name)
            is_std = bool(re.search(r"(GB|DL|IEC|EN|JB)", name)) and bool(re.search(r"\d{4}", name))
            P.add("10_分类路径", 任务键=TASK, 分类路径键=pk, 上级路径键=parent, 层级=li, 分类名称=name,
                  分类编号="" if not is_std else norm_std(name).split("-")[0][:4],
                  节点类型="标准文件" if is_std else "业务分类",
                  标准文件编号=norm_std(name) if is_std else "", 状态="启用")
            path_keys[name] = pk
            parent = pk
        leaf = parent
        skey = "S%02d" % si
        diff = info.get("区分型号", "否")
        iscable = "是" in info.get("是否电缆", "否")
        P.add("20_样品", 任务键=TASK, 样品键=skey, 分类路径键=leaf, 名称=info.get("样品名称", ""),
              样品代码=info.get("样品代码", ""), 标准号=norm_std(info.get("标准号", "")), 排序=si,
              最大检测周期月="", 单位="根", 备注=info.get("备注", ""),
              区分型号="是" if diff.startswith("是") else "否", 是否电缆="开" if iscable else "关",
              电缆结构="", 线芯颜色="", 芯数="", 相别="", 产品标记开关="开" if mark_rule else "关",
              产品标记规则="")
        if not info.get("最大检测周期(月)"):
            P.open_issue("字段", "20_样品", skey, "最大检测周期(月)", "无来源", 0,
                         "样品「%s」的最大检测周期是多少个月？" % info.get("样品名称", ""),
                         "3、5、6、12", "输入文件不含该字段")
        if mark_rule:
            segs = re.findall(r"\{([^}]+)\}", mark_rule)
            P.open_issue("字段", "20_样品", skey, "产品标记规则", "AI推断", 0.4,
                         "Word 里的产品标记是自然语言模板「%s」，系统规则要求 [数据段] 语法。按哪套拼？" % mark_rule[:60],
                         "按规格参数顺序自动转 [ ] 语法、人工重写、先不启用产品标记", "三、产品标记")
        if not iscable:
            P.notes.append("样品 %s 是否电缆=否 ⇒ 50 的「多芯电缆试验线芯数」按口径留空" % skey)

    if len(samples) > 1 and models:
        P.open_issue("范围", "40_型号", "S01", "样品键", "AI推断", 0.3,
                     "文档里有 %d 个样品，但型号只在「四、型号列表」里出现一次（%s）。"
                     "这些型号是三个样品共用一套，还是每个样品各自一套？"
                     % (len(samples), " / ".join(str(m.get("code") or m.get("name") or "") for m in models[:6])),
                     "三个样品共用、每个样品各自一套、只有部分样品区分型号", "四、型号列表")
        P.notes.append("型号暂全部挂 S01，待「范围级」问题确认后由 F2 重排")
    if len(samples) > 1:
        P.open_issue("范围", "20_样品", "S02", "试验项归属", "AI推断", 0.3,
                     "文档里 %d 个样品共用同一套试验项配置（五、C级试验项只出现一次）。"
                     "试验项是三个样品各自复制一份，还是只挂在一个样品下？" % len(samples),
                     "各自复制一份、只挂主样品、人工指定", "五、C级试验项配置")
    SAMP = ["S%02d" % i for i in range(1, max(1, len(samples)) + 1)] or ["S01"]
    MODEL0 = (SAMP[0] + "-M01") if SAMP else "S01-M01"

    # ---- 30 规格参数 ----
    for g in specs_global:
        for r in g[1:]:
            if len(r) < 3 or not r[0]:
                continue
            key = SPEC0 + "%02d" % int(re.sub(r"\D", "", r[0]) or 0)
            P.add("30_规格参数", 规格键=key, 样品键=SAMP[0], 序号=int(re.sub(r"\D", "", r[0]) or 0),
                  名称=r[1], 符号=r[2], 单位=r[3] if len(r) > 3 else "",
                  是否主规格="是" if "主规格" in (r[4] if len(r) > 4 else "") else "否",
                  备注=r[4] if len(r) > 4 else "")

    # ---- 40 型号 / 41 赋值 ----
    for mi, m in enumerate(models, 1):
        mkey = "%s-M%02d" % (SAMP[0], mi)
        P.add("40_型号", 型号键=mkey, 样品键="S01", 型号=m["code"], 名称=m["name"], 排序=mi,
              最大检测周期月="", 描述="")
        g = m["grid"]
        if not g:
            continue
        for r in g[1:]:
            if len(r) < 3 or not r[0]:
                continue
            sp = next((c for c in P.rows["30_规格参数"] if r[0].startswith(str(c[3]))), None)
            way = "用户选择" if "选择" in r[1] else "用户输入"
            opts = r[2]
            P.add("41_型号规格赋值", 型号键=mkey, 规格键=(sp[0] if sp else ""),
                  是否参与="是", 赋值方式=way, 可选项=opts if way == "用户选择" else "")
            if way == "用户选择":
                lst = re.split(r"[ /、,，]+", opts)
                lst = [x for x in lst if re.match(r"^[A-Za-z0-9.]{1,10}$", x.strip())]
                if not lst:
                    P.open_issue("字段", "41_型号规格赋值", mkey + "|" + (sp[0] if sp else "?"), "可选项",
                                 "未验证", 0.3,
                                 "「%s」在 %s 型号的可选项是自然语言表格（DN×SN→eₙ 对应关系），不是纯值列表。怎么拆？"
                                 % (r[0], m["code"]),
                                 "只取可选值列表、按对应关系拆成多行映射、人工补录", "四、型号列表与规格参数赋值配置")
                elif len(lst) < len([x for x in re.split(r"[ /、,，]+", opts) if x.strip()]):
                    P.notes.append("41 可选项从自然语言里只抽到 %d 个纯值（%s / %s），其余是分档说明" % (len(lst), m["code"], r[0]))

    # ---- 50/51/52/60/70/80/90/A0/A1/A2/B0 ----
    for t in tests:
        infos = t.get("info") or []
        if not infos:
            continue
        for vi, ig in enumerate(infos):
            d = {}
            for r in ig[1:]:
                if len(r) >= 2:
                    d[r[0]] = r[1]
            tname = d.get("试验名称", t["name"])
            tcode = d.get("试验编码", "")
            tkey = "S01-M01-T%02d" % (len(P.rows["50_试验项"]) + 1)
            cats = [x.strip() for x in re.split(r"[ /、,，]+", d.get("检测类别", "")) if x.strip()]
            bad = [c for c in cats if c not in DICT_CATEGORY]
            P.add("50_试验项", 任务键=TASK, 试验项键=tkey, 归属类型="型号", 归属键=MODEL0,
                  试验名称=tname, 试验编码=tcode, 质量特性=d.get("质量特性", ""),
                  检测类别="、".join(cats), 是否制样="是", 多芯电缆试验线芯数="", 样段=1, 启用样段="是",
                  试样数量=1, 试样类别代码="", 试验过程="", 标准要求=d.get("标准要求", ""),
                  检测费用元="", 检测设备="", 状态="启用", 排序=len(P.rows["50_试验项"]) + 1)
            if len(infos) > 1:
                P.open_issue("范围", "50_试验项", tkey, "试验项键", "AI推断", 0.5,
                             "「试验项 %d：%s」在 Word 里是一个试验项、却有 %d 套试验信息（不同型号用不同配置）。"
                             "系统里试验项挂在型号下，必须拆成多条。按哪种方式拆？"
                             % (t["no"], t["name"], len(infos)),
                             "按型号各拆一条、合并成一条并用条件映射区分、先只保留其中一套", "五、C级试验项配置")
            for c in bad:
                P.open_issue("字段", "50_试验项", tkey, "检测类别", "AI推断", 0.5,
                             "检测类别「%s」不在字典里。新增字典选项还是归到现有项？" % c,
                             "新增「%s」、归到「型式试验」、归到「抽样试验」" % c, "字典 lims_detect_category")
            if not tcode:
                P.open_issue("字段", "50_试验项", tkey, "试验编码", "无来源", 0,
                             "「%s」的试验编码按规则应该是？" % tname, "", "wz_ + dldl + … 规则")
            # 51
            basis = d.get("试验依据", "")
            for bi, b in enumerate(re.split(r"[;；]", basis) if basis else [], 1):
                mm = re.search(r"([A-Za-z]{2,4}[/ ?T]*\s*[\d.]+\s*[-—–]\s*\d{4})", b)
                P.add("51_试验依据", 试验项键=tkey, 序号=bi,
                      标准文件编号=norm_std(mm.group(1)) if mm else "", 标准文件名称=b.strip()[:120],
                      章节=(re.search(r"第([\d.]+)节", b).group(0) if re.search(r"第([\d.]+)节", b) else ""))
            # 52
            for sg in (t.get("subs") or []):
                for r in sg[1:]:
                    if len(r) < 2 or not r[0]:
                        continue
                    subkey = tkey + "-SUB%d" % (len(P.rows["52_试验子项"]) + 1)
                    P.add("52_试验子项", 子项键=subkey, 试验项键=tkey, 试验子项=r[0],
                          标准要求=r[1] if len(r) > 1 else "", 排序=len(P.rows["52_试验子项"]) + 1)
            # 60 控制参数
            for cg in (t.get("ctrl") or []):
                hdr = cg[0] if cg else []
                if "映射类型" not in hdr:
                    continue
                for r in cg[1:]:
                    if len(r) < 5 or not r[0]:
                        continue
                    pk = tkey + "-C%02d" % (len(P.rows["60_控制参数"]) + 1)
                    mt = r[4]
                    fixed = "" if "映射" in mt and mt != "固定值" else r[5] if len(r) > 5 else ""
                    P.add("60_控制参数", 参数键=pk, 试验项键=tkey, 子项键="", 名称=r[0], 符号=r[2],
                          单位=r[3], 是否开启映射="否" if mt == "固定值" else "是",
                          映射类型=("离散映射" if (mt and "映射" in mt and mt != "固定值") else ""),
                          超出范围处理="", 固定值=fixed, 试验检测显示="开",
                          排序=len(P.rows["60_控制参数"]) + 1, 备注=r[5] if len(r) > 5 else "")
            # 70 测量参数
            for mg in (t.get("meas") or []):
                hdr = mg[0]
                if "测量次数" not in hdr:
                    continue
                mg = pad(mg, len(hdr))
                for r in mg[1:]:
                    if len(r) < 6 or not r[0]:
                        continue
                    i = {n: k for k, n in enumerate(hdr)}
                    g = pad(g, len(hdr))
                    pk = tkey + "-M%02d" % (len(P.rows["70_测量参数"]) + 1)
                    times = re.sub(r"\D", "", r[i["测量次数"]] or "") or "1"
                    rnd = r[i["修约规则"]] if "修约规则" in i else ""
                    mode = next((m for m in ["四舍五入", "四舍六入五成双", "全进位（向上取整）",
                                             "全舍弃（向零取整/截断）", "指定间隔修约", "直接取值"] if m in rnd), "")
                    dg = re.search(r"保留(\d+)位", rnd)
                    P.add("70_测量参数", 参数键=pk, 试验项键=tkey, 子项键="", 名称=r[i["参数名称"]],
                          编码=r[i["编码"]] if "编码" in i else "", 符号=r[i["符号"]] if "符号" in i else "",
                          类型=r[i["类型"]] if "类型" in i else "数值",
                          单位=r[i["单位"]] if "单位" in i else "", 测量次数=int(times),
                          修约方式=mode, 修约精度=(dg.group(1) if dg else ""),
                          条件修约="否", 排序=len(P.rows["70_测量参数"]) + 1)
                    if (r[i["类型"]] if "类型" in i else "") == "下拉选项":
                        P.open_issue("字段", "70_测量参数", pk, "可选项", "无来源", 0,
                                     "「%s」是下拉选项型参数，Word 里没写可选项。检测员实际能选哪些？" % r[i["参数名称"]],
                                     "合格 / 不合格、通过 / 未通过、破裂 / 无破裂、人工填写", "x.4 试验参数")
                    if mode == "" and rnd:
                        P.open_issue("字段", "70_测量参数", pk, "修约方式", "未验证", 0.4,
                                     "「%s」的修约规则写的是「%s」，不在系统六种算法之内。映射到哪个？" % (r[0], rnd[:40]),
                                     "四舍五入、四舍六入五成双、指定间隔修约、直接取值", "PRD §3.4.2.3")
            # 80 计算参数
            for gg in (t.get("calc") or []):
                hdr = gg[0]
                if "绑定层级" not in hdr:
                    continue
                i = {n: k for k, n in enumerate(hdr)}
                g = pad(g, len(hdr))
                gg = pad(gg, len(hdr))
                for r in gg[1:]:
                    if len(r) < 5 or not r[0]:
                        continue
                    pk = tkey + "-K%02d" % (len(P.rows["80_计算参数"]) + 1)
                    way = r[i["计算方式"]] if "计算方式" in i else ""
                    ctype = "汇总统计型" if "汇总" in way else "算术表达式型"
                    expr = re.sub(r"\s+", " ", way.split("：", 1)[-1]) if "：" in way else way
                    P.add("80_计算参数", 参数键=pk, 试验项键=tkey, 子项键="", 名称=r[i["参数名称"]],
                          编码=r[i["编码"]] if "编码" in i else "", 符号=r[i["符号"]] if "符号" in i else "",
                          单位=r[i["单位"]] if "单位" in i else "",
                          绑定层级=r[i["绑定层级"]] if "绑定层级" in i else "试验",
                          计算类型=ctype, 数据源参数键="", 统计类型="",
                          公式=round_only(expr)[0] if ctype == "算术表达式型" else "",
                          公式绑定="绑定计算参数层级",
                          修约方式=round_only(expr)[1] if ctype == "算术表达式型" else "",
                          修约精度=round_only(expr)[2] if ctype == "算术表达式型" else "",
                          条件修约="否", 排序=len(P.rows["80_计算参数"]) + 1)
                    if ctype == "算术表达式型" and not round_only(expr)[0]:
                        P.rows["80_计算参数"][-1][COLS["80_计算参数"].index("计算类型")] = ""
                        P.open_issue("字段", "80_计算参数", pk, "公式", "冲突", 0.35,
                                     "「%s」的计算方式只写了修约规则「%s」，没有公式。它是实测值直通（只需修约），还是漏了公式？"
                                     % (r[i["参数名称"]], expr[:40]),
                                     "实测值直通、补公式、按名称匹配已有参数", "x.4 试验参数")
                    if ctype == "算术表达式型" and re.search(r"[A-Za-z]{2,}\d*_?[A-Za-z0-9_]*\[", expr):
                        P.open_issue("字段", "80_计算参数", pk, "公式", "AI推断", 0.35,
                                     "「%s」的公式用的是编码+试样下标（%s），契约要求 {参数名称|符号} 且不写编码。"
                                     "下标 [a]/[b]/[c] 在契约里没有承载位。" % (r[0], expr[:50]),
                                     "改成 {名称|符号} 并去掉下标、新增「试样下标」列、下标改由绑定层级表达",
                                     "PRD §3.4.2.2 / 契约 80")
            # 90 标称值
            for ng in (t.get("nom") or []):
                hdr = ng[0]
                if "标称值名称" not in hdr:
                    continue
                i = {n: k for k, n in enumerate(hdr)}
                g = pad(g, len(hdr))
                ng = pad(ng, len(hdr))
                for r in ng[1:]:
                    if len(r) < 3 or not r[0]:
                        continue
                    nk = tkey + "-N%02d" % (len(P.rows["90_标称值"]) + 1)
                    typ_raw = r[i.get("标称值类型", 2)]
                    typ = ("最大值" if typ_raw.startswith("最大值") else "最小值" if typ_raw.startswith("最小值")
                           else "范围" if typ_raw.startswith("范围") else "公差" if typ_raw.startswith("公差")
                           else "公式" if typ_raw.startswith("公式") else "单值")
                    multi = "开" in (r[i.get("多行映射", 3)] or "")
                    ck = i.get("各型号配置", i.get("配置说明", len(r) - 1))
                    conf_raw = r[ck] if ck < len(r) else ""
                    P.add("90_标称值", 任务键=TASK, 标称值键=nk, 试验项键=tkey, 子项键="",
                          标称值名称=r[i.get("标称值名称", 0)], 符号=r[i.get("符号", 1)],
                          单位=(re.search(r"\(([^)]+)\)", typ_raw).group(1) if re.search(r"\(([^)]+)\)", typ_raw) else ""),
                          多行映射=("是" if multi else "否"), 标称值类型=typ,
                          单值="", 负偏差="", 正偏差="", 最小值="", 最小值符号="≥", 最大值="", 最大值符号="≤",
                          公式="", 修约方式="", 修约精度="", 备注=conf_raw[:200])
                    vals = re.findall(r"([≤≥<>]=?)\s*([\d.]+)", conf_raw)
                    if typ == "最大值" and vals:
                        P.rows["90_标称值"][-1][COLS["90_标称值"].index("最大值")] = vals[0][1]
                    elif typ == "最小值" and vals:
                        P.rows["90_标称值"][-1][COLS["90_标称值"].index("最小值")] = vals[0][1]
                    elif typ == "单值":
                        m2 = re.search(r"[:：]\s*([\d.]+)", conf_raw)
                        P.rows["90_标称值"][-1][COLS["90_标称值"].index("单值")] = m2.group(1) if m2 else ""
                    if multi:
                        rows = re.findall(r"([A-Za-z0-9.]+)\s*(?:→|->)\s*([\d.]+)", conf_raw)
                        if rows:
                            for idx, (a, b) in enumerate(rows, 1):
                                P.add("61_映射明细", 归属类型="标称值", 归属键=nk, 行号=idx, 自变量序号=1,
                                      自变量类型="规格参数", 自变量键=SPEC0 + "04", 自变量形态="固定值", 自变量值=a,
                                      自变量下限="", 自变量上限="", 区间下限符号="", 区间上限符号="",
                                      因变量1=b, 因变量2="", 因变量3="", 因变量1符号="", 因变量2符号="")
                            P.open_issue("字段", "61_映射明细", nk, "自变量键", "AI推断", 0.3,
                                         "「%s」多行映射的自变量在 Word 里没写明规格键，按上下文猜是 SN 等级。对吗？"
                                         % r[0], "环刚度等级SN、公称内径、公称壁厚", "4.5 标称值配置")
                        else:
                            P.open_issue("字段", "61_映射明细", nk, "自变量值/因变量1", "无来源", 0,
                                         "「%s」标了多行映射=开，但配置说明是自然语言，无法解析成数据行。人工补录还是重新解析？"
                                         % r[0], "人工补录、按型号各建一条单行标称值", "4.5 标称值配置")
            # A0/A1/A2 结果判定
            for jg in (t.get("judge") or []):
                hdr = jg[0]
                if "判定方式" not in hdr:
                    continue
                i = {n: k for k, n in enumerate(hdr)}
                g = pad(g, len(hdr))
                jg = pad(jg, len(hdr))
                for r in jg[1:]:
                    if len(r) < 3 or not r[0]:
                        continue
                    cond = r[i.get("判定条件", 2)]
                    P.add("A0_判定配置", 试验项键=tkey, 判定参数名=r[i.get("判定参数", 0)],
                          判定参数类型="下拉选项", 可选项="合格、不合格",
                          判定方式="系统判定" if "系统" in r[i.get("判定方式", 1)] else "人工判定",
                          判断层级="试验", 判定模式="试验参数对比")
                    for ci, blk in enumerate(re.split(r"AND|且(?=【)", cond), 1):
                        side = "标称值对比" if "标称值对比" in blk else "非标称值对比"
                        P.add("A1_判定条件", 试验项键=tkey, 条件序号=ci, 条件类型=side,
                              对比参数键="", 修饰符百分比="", 修饰符符号="", 修饰符常量="",
                              对比符号="", 被对比标称值键="", 被对比参数键="", 自定义数值="",
                              子项结论来源="", 报告展开式="")
                    P.add("A2_结论映射", 试验项键=tkey, 结论序号=1, 结论值="合格", 逻辑="当满足所有条件时")
                    P.add("A2_结论映射", 试验项键=tkey, 结论序号=2, 结论值="不合格", 逻辑="不满足任一条件时")
                    P.open_issue("字段", "A1_判定条件", tkey, "对比参数键/被对比标称值键", "AI推断", 0.25,
                                 "「%s」的判定条件是自然语言（%s），契约要求引用到具体的参数键与标称值键。"
                                 % (tname, cond[:50]),
                                 "按名称自动匹配键、人工指定、先按文本存着入库前再补", "x.6 结果判定")
            # B0 采集配置
            for kg in (t.get("collect") or []):
                hdr = kg[0]
                if "计算顺序" not in hdr:
                    continue
                i = {n: k for k, n in enumerate(hdr)}
                g = pad(g, len(hdr))
                kg = pad(kg, len(hdr))
                for r in kg[1:]:
                    if len(r) < 4 or not r[0]:
                        continue
                    typ = r[i["类型"]]
                    tmap = {"实测值": "测量参数", "预设值": "控制参数", "计算值": "计算参数", "标称值": "标称值"}
                    code = r[i["参数编码"]] if "参数编码" in i else ""
                    name = r[i["参数名称"]] if "参数名称" in i else ""
                    ordv = int(re.sub(r"\D", "", str(r[i["计算顺序"]] or "")) or 0)
                    cover = "开" if "开" in (r[i["覆盖LIMS参数"]] if "覆盖LIMS参数" in i else "") else "关"
                    for kk in filter(None, (code, name)):
                        P.b0_hint[(tkey, kk)] = (ordv, tmap.get(typ, typ), cover)

    finalize_codes(P)
    finalize_b0(P)
    P.add("00_包信息", 项="契约版本", 值=CONTRACT, 备注="")
    P.add("00_包信息", 项="任务列表", 值=TASK, 备注="一行一个任务：任务键|标准文件编号|名称|目标大类|状态")
    P.add("00_包信息", 项="目标大类", 值="电力物资类", 备注="")
    P.add("00_包信息", 项="稿件版本", 值="v1-draft", 备注="F1 产出，待专家复核")
    P.add("00_包信息", 项="生成时间", 值=datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), 备注="")
    P.add("00_包信息", 项="来源文件", 值=os.path.basename(src), 备注="人工参数配置文档")
    P.add("00_包信息", 项="因变量语义表", 值=json.dumps(
        {"单值": ["因变量1"], "公差": ["因变量1=基准单值", "因变量2=(-)负偏差", "因变量3=(+)正偏差"],
         "范围": ["因变量1=最小值", "因变量2=最大值"], "最大值": ["因变量1"], "最小值": ["因变量1"],
         "控制参数": ["因变量1"]}, ensure_ascii=False), 备注="")
    for r in RULES:
        P.add("D0_校验规则", 规则ID=r[0], 目标sheet=r[1], 目标列=r[2], 规则说明=r[3], 严重级=r[4],
              失败提示=r[5], 触发时机=r[6])

    write_xlsx(P, dst)
    return P


def write_xlsx(P, dst):
    wb = Workbook()
    wb.remove(wb.active)
    hf = PatternFill("solid", fgColor="F1F5F9")
    for name, cols in SHEETS:
        ws = wb.create_sheet(name[:31])
        ws.append(cols)
        for c in ws[1]:
            c.font = Font(bold=True, size=10)
            c.fill = hf
            c.alignment = Alignment(horizontal="center", vertical="center")
        for row in P.rows[name]:
            ws.append(row)
        for i, cn in enumerate(cols, 1):
            ws.column_dimensions[get_column_letter(i)].width = min(42, max(11, len(cn) * 2.4))
        ws.freeze_panes = "A2"
    wb.save(dst)


def check(path, out=None):
    wb = load_workbook(path, data_only=True)
    data = {}
    for name, cols in SHEETS:
        if name not in wb.sheetnames:
            data[name] = []
            continue
        ws = wb[name]
        rows = list(ws.iter_rows(values_only=True))
        hdr = [str(x) if x is not None else "" for x in rows[0]]
        data[name] = [dict(zip(hdr, ["" if v is None else v for v in r])) for r in rows[1:]]
    res = []
    def R(rid, lvl, obj, msg):
        res.append((rid, lvl, obj, msg))
    def g(sheet, col, row):
        v = row.get(col, "")
        return str(v).strip() if v is not None else ""

    std_nodes = {r["分类路径键"] for r in data["10_分类路径"] if g(0, "节点类型", r) == "标准文件"}
    bykey = {r["分类路径键"]: r for r in data["10_分类路径"]}
    parent_of = {r["分类路径键"]: r["上级路径键"] for r in data["10_分类路径"]}
    for r in data["20_样品"]:
        pk = g(0, "分类路径键", r)
        cur, ok = pk, False
        while cur:
            if cur in std_nodes:
                ok = True
                break
            cur = parent_of.get(cur, "")
        if not ok:
            R("V01", "阻断", r["样品键"], "样品分类路径上没有标准文件节点")
        diff = g(0, "区分型号", r)
        n = sum(1 for m in data["40_型号"] if m["样品键"] == r["样品键"])
        if diff == "是" and n == 0:
            R("V02", "阻断", r["样品键"], "区分型号=是 但没有任何型号")
        if diff == "否" and n > 0:
            R("V02", "阻断", r["样品键"], "区分型号=否 却存在 %d 个型号" % n)
        rule = g(0, "产品标记规则", r)
        if rule:
            for seg in re.findall(r"\[规格参数\.([^\.\]]+)\.值\]", rule):
                if not any(x["名称"] == seg for x in data["30_规格参数"]):
                    R("V03", "阻断", r["样品键"], "产品标记引用了不存在的规格参数 %s" % seg)

    for r in data["41_型号规格赋值"]:
        if g(0, "赋值方式", r) == "用户选择" and not g(0, "可选项", r):
            R("V04", "阻断", "%s|%s" % (r["型号键"], r["规格键"]), "用户选择型规格参数可选项为空")

    codes = {}
    for r in data["50_试验项"]:
        c = g(0, "试验编码", r)
        if not re.match(r"^[a-z][a-z0-9_]*$", c or ""):
            R("V05", "阻断", r["试验项键"], "试验编码格式非法：%r" % c)
        elif c in codes:
            R("V05", "阻断", r["试验项键"], "试验编码大类内重号：%s（与 %s 冲突）" % (c, codes[c]))
        else:
            codes[c] = r["试验项键"]
        openq = {(q["目标行键"], q["目标列"]) for q in data["C0_待定项"]}
        for cat in [x for x in re.split("、", g(0, "检测类别", r)) if x]:
            if cat not in DICT_CATEGORY and (r["试验项键"], "检测类别") not in openq:
                R("V06", "阻断", r["试验项键"], "检测类别「%s」既不在字典也无待确认问题" % cat)

    mrows = {}
    for r in data["61_映射明细"]:
        mrows.setdefault(r["归属键"], set()).add(r["自变量键"])
    for r in data["60_控制参数"]:
        if g(0, "映射类型", r) == "组合映射" and len(mrows.get(r["参数键"], set())) < 2:
            R("V07", "阻断", r["参数键"], "组合映射自变量不足 2 个")
        if g(0, "映射类型", r) == "条件映射" and not any(q["归属键"] == r["参数键"] for q in data["62_条件规则"]):
            R("V08", "阻断", r["参数键"], "条件映射缺少规则")

    nomtype = {r["标称值键"]: r["标称值类型"] for r in data["90_标称值"]}
    for r in data["90_标称值"]:
        if g(0, "标称值类型", r) == "公式" and r["标称值键"] in mrows:
            R("V09", "阻断", r["标称值键"], "公式类型不允许开启多行映射")
        if g(0, "标称值类型", r) == "范围":
            if not (g(0, "最小值", r) and g(0, "最大值", r)):
                R("V15", "阻断", r["标称值键"], "范围类型最小值与最大值必须成对")
        if g(0, "标称值类型", r) == "公式" and g(0, "多行映射", r) == "是":
            R("V16", "阻断", r["标称值键"], "公式与多行映射互斥")

    for r in data["70_测量参数"]:
        if g(0, "类型", r) == "下拉选项":
            opts = [o for o in data["71_参数可选项"] if o["参数键"] == r["参数键"]]
            if not opts:
                R("V11", "阻断", r["参数键"], "下拉选项参数没有可选项")
            else:
                d = [o for o in opts if str(o["是否默认"]) in ("1", "是", "True", "true")]
                if d and d[0]["数据标签"] not in [o["数据标签"] for o in opts]:
                    R("V11", "阻断", r["参数键"], "默认值不在可选项之内")
        if g(0, "修约方式", r) == "直接取值" and g(0, "修约精度", r):
            R("V12", "告警", r["参数键"], "直接取值形态下修约精度不生效")

    allnames = {}
    for sheet, col in (("60_控制参数", "名称"), ("70_测量参数", "名称"), ("80_计算参数", "名称")):
        for r in data[sheet]:
            allnames.setdefault(r["试验项键"], set()).add(g(0, "名称", r))
    for r in data["80_计算参数"]:
        f = g(0, "公式", r)
        if g(0, "计算类型", r) == "算术表达式型" and not f:
            R("V13", "阻断", r["参数键"], "算术表达式型公式为空")
        for var in re.findall(r"\{([^}]+)\}", f or ""):
            nm = var.split("|")[0].strip()
            if nm not in allnames.get(r["试验项键"], set()):
                R("V13", "阻断", r["参数键"], "公式变量 {%s} 在同一样品/型号下解析不到" % nm)
        if f and f.count("(") != f.count(")"):
            R("V13", "阻断", r["参数键"], "公式括号不闭合")

    for r in data["A0_判定配置"]:
        if g(0, "判定方式", r) == "系统判定" and not any(c["试验项键"] == r["试验项键"] for c in data["A1_判定条件"]):
            R("V17", "阻断", r["试验项键"], "系统判定未配置任何判定规则")
        lvl = g(0, "判断层级", r)
        t = next((x for x in data["50_试验项"] if x["试验项键"] == r["试验项键"]), None)
        if lvl == "样段" and t and g(0, "是否制样", t) != "是":
            R("V18", "阻断", r["试验项键"], "判断层级=样段 但试验项 是否制样=否")
        if lvl == "线芯":
            s = next((x for x in data["20_样品"] if t and x["样品键"] == "S01"), None)
            if s and g(0, "是否电缆", s) != "开":
                R("V18", "阻断", r["试验项键"], "判断层级=线芯 但样品 是否电缆=否")

    map_rows = {}
    for m in data["61_映射明细"]:
        map_rows[m["归属键"]] = map_rows.get(m["归属键"], 0) + 1
    for r in data["A1_判定条件"]:
        if g(0, "条件类型", r) == "标称值对比":
            key = r["被对比标称值键"]
            sym = g(0, "对比符号", r)
            has_mod = any(g(0, c, r) for c in ("修饰符百分比", "修饰符符号", "修饰符常量"))
            if not key:
                if sym:
                    R("V19b", "阻断", r["试验项键"], "被对比标称值未定时对比符号必须留空（禁选态），当前填了「%s」" % sym)
                continue
            nt = nomtype.get(key, "单值")
            nom_row = next((x for x in data["90_标称值"] if x["标称值键"] == key), None)
            if nt != NOM_SINGLE:
                if sym != CMP_CONFORM:
                    R("V19", "阻断", r["试验项键"], "被对比标称值类型为「%s」，对比符号由类型推导为「%s」，当前为「%s」" % (nt, CMP_CONFORM, sym or "空"))
                if has_mod:
                    R("V19", "阻断", r["试验项键"], "被对比标称值类型为「%s」时不配置修饰符" % nt)
                if nom_row is not None:
                    want = nom_report_expr(nom_row, map_rows.get(key, 0))
                    got = g(0, "报告展开式", r)
                    if not got:
                        R("V19c", "告警", r["试验项键"], "符号为「满足」但缺报告展开式，应为「%s」" % want)
                    elif want and got != want:
                        R("V19c", "告警", r["试验项键"], "报告展开式「%s」与标称值配置推导结果「%s」不一致" % (got, want))
            else:
                if sym == CMP_CONFORM:
                    R("V19", "阻断", r["试验项键"], "被对比标称值为单值时不得选「满足」，请用 = != < ≤ > ≥")
                elif sym and sym not in CMP_NUM:
                    R("V19", "阻断", r["试验项键"], "单值标称值的对比符号「%s」不在词表内" % sym)
        if g(0, "对比符号", r) in ("is null", "is not null") and g(0, "自定义数值", r):
            R("V10", "阻断", r["试验项键"], "空值判断不应填目标值")

    seen = {}
    for r in data["A2_结论映射"]:
        k = (r["试验项键"], r["结论值"])
        if k in seen:
            R("V20", "告警", r["试验项键"], "存在两条相同结论「%s」，建议合并" % r["结论值"])
        seen[k] = 1

    used = {c["被对比标称值键"] for c in data["A1_判定条件"]}
    orders = sorted(int(g(0, "计算顺序", r) or 0) for r in data["B0_采集配置"])
    if orders:
        if orders != list(range(1, len(orders) + 1)):
            R("V23", "阻断", "B0", "计算顺序不是从1开始的连续整数或有重复：%s" % orders[:12])
        covered = {r["参数键"] for r in data["B0_采集配置"]}
        allp = {r["参数键"] for s in ("60_控制参数", "70_测量参数", "80_计算参数") for r in data[s]}
        allp |= {r["标称值键"] for r in data["90_标称值"]}
        miss = allp - covered
        if miss:
            R("V23", "阻断", "B0", "采集配置缺 %d 个参数：%s" % (len(miss), sorted(miss)[:6]))
    for r in data["80_计算参数"]:
        for var in re.findall(r"\{([^}]+)\}", g(0, "公式", r) or ""):
            nm = var.split("|")[0].strip()
            dep = next((x for x in data["80_计算参数"] if x["名称"] == nm), None)
            if dep:
                a = int(g(0, "计算顺序", next((b for b in data["B0_采集配置"] if b["参数键"] == r["参数键"]), {})) or 0)
                bo = int(g(0, "计算顺序", next((b for b in data["B0_采集配置"] if b["参数键"] == dep["参数键"]), {})) or 0)
                if a and bo and a <= bo:
                    R("V22", "阻断", r["参数键"], "计算顺序违反依赖：%s(%d) 应大于被引用的 %s(%d)" % (r["名称"], a, nm, bo))

    # 阻断分两类：有未回答待定项兜底（F2 答完即消除）/ 无兜底（转换或契约缺陷，必须改代码）
    rule_sheet = {r[0]: r[1] for r in RULES}
    open_q = set()
    for q in data["C0_待定项"]:
        if str(q.get("人工回答", "") or "").strip():
            continue
        open_q.add((str(q.get("目标sheet", "") or ""), str(q.get("目标行键", "") or "")))
    deferred, hard = [], []
    for rid, lvl, obj, msg in res:
        if lvl != "阻断":
            continue
        (deferred if (rule_sheet.get(rid, ""), obj) in open_q else hard).append((rid, lvl, obj, msg))
    lines = ["# 预检报告 · %s" % os.path.basename(path), ""]
    lines.append("- 契约版本：%s" % CONTRACT)
    lines.append("- 校验规则：%d 条（D0）" % len(RULES))
    lines.append("- **阻断 %d 项 = 回答待定项即可消除 %d + 真缺陷 %d**；告警 %d 项" % (
        len(hard) + len(deferred), len(deferred), len(hard), sum(1 for x in res if x[1] == "告警")))
    lines.append("- C0 待定项：%d 条（范围级 %d / 字段级 %d）" % (
        len(data["C0_待定项"]), sum(1 for q in data["C0_待定项"] if q["问题层级"] == "范围"),
        sum(1 for q in data["C0_待定项"] if q["问题层级"] == "字段")))
    lines.append("")
    lines.append("## 各 sheet 行数")
    lines.append("")
    lines.append("| sheet | 行数 |")
    lines.append("|---|---|")
    for name, _ in SHEETS:
        lines.append("| %s | %d |" % (name, len(data[name])))
    lines.append("")
    lines.append("> 「可消除」= 该阻断已有对应的**未回答待定项**，F2 专家回答后重跑预检即通过；")
    lines.append("> 「真缺陷」= 没有任何待定项兜底，属于转换逻辑或契约本身的问题，必须改代码 / 改契约。")
    lines.append("")
    lines.append("## 阻断 · 真缺陷（%d）" % len(hard))
    lines.append("")
    if not hard:
        lines.append("- 无")
    for rid, lvl, obj, msg in hard:
        lines.append("- **%s**（%s）`%s`：%s" % (rid, lvl, obj, msg))
    lines.append("")
    lines.append("## 阻断 · 回答待定项即可消除（%d）" % len(deferred))
    lines.append("")
    if not deferred:
        lines.append("- 无")
    for rid, lvl, obj, msg in deferred:
        lines.append("- **%s**（%s）`%s`：%s" % (rid, lvl, obj, msg))
    lines.append("")
    lines.append("## 告警（%d）" % sum(1 for x in res if x[1] == "告警"))
    lines.append("")
    for rid, lvl, obj, msg in res:
        if lvl == "告警":
            lines.append("- **%s**（%s）`%s`：%s" % (rid, lvl, obj, msg))
    lines.append("")
    lines.append("## 转换期记录")
    for n in P_NOTES:
        lines.append("- %s" % n)
    txt = "\n".join(lines)
    if out:
        open(out, "w", encoding="utf-8").write(txt)
    print(txt)
    return 0 if not any(x[1] == "阻断" for x in res) else 1


P_NOTES = []
if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "convert":
        P = convert(sys.argv[2], sys.argv[3])
        P_NOTES.extend(P.notes)
        print("已生成 %s" % sys.argv[3])
        for k, v in ((n, len(P.rows[n])) for n, _ in SHEETS):
            print("  %-14s %d" % (k, v))
    elif cmd == "check":
        sys.exit(check(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
    elif cmd == "blank":
        P = Pack()
        for r in RULES:
            P.add("D0_校验规则", 规则ID=r[0], 目标sheet=r[1], 目标列=r[2], 规则说明=r[3], 严重级=r[4],
                  失败提示=r[5], 触发时机=r[6])
        P.add("00_包信息", 项="契约版本", 值=CONTRACT, 备注="必填，F3 遇到不认识的版本直接拒绝")
        P.add("00_包信息", 项="任务列表", 值="", 备注="任务键|标准文件编号|标准文件名称|目标大类|状态，一行一个")
        P.add("00_包信息", 项="因变量语义表", 值=json.dumps(
            {"单值": ["因变量1"], "公差": ["因变量1=基准单值", "因变量2=(-)负偏差", "因变量3=(+)正偏差"],
             "范围": ["因变量1=最小值", "因变量2=最大值"], "最大值": ["因变量1"], "最小值": ["因变量1"],
             "控制参数": ["因变量1"]}, ensure_ascii=False), 备注="61_映射明细 的因变量列含义")
        write_xlsx(P, sys.argv[2])
        print("已生成空白模板 %s（%d 张 sheet）" % (sys.argv[2], len(SHEETS)))
