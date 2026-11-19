# -*- coding: utf-8 -*-
"""拆分「导线/金具」、清洗标准依据、按领域重排绑定表视图。

- CAT-CON-WIRE → CAT-WIRE（导线）+ CAT-FITTING（金具）
- 绑定表增加「排序号」：电网物资在前，安全工器具在后；品类内按固定顺序
- 视图：按「领域」分组 + 按「排序号」排序
- 标准依据：去掉「待顾问确认*」展示文案（经 fill_binding_params）

用法：
  python3 docs/feishu/lims-ai-review/reorder_bindings_view.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
ROOT = DIR.parents[2]
ENV = {
    **os.environ,
    "LARKSUITE_CLI_NO_UPDATE_NOTIFIER": "1",
    "LARKSUITE_CLI_NO_SKILLS_NOTIFIER": "1",
}

meta = json.loads((DIR / "base.json").read_text(encoding="utf-8"))
cm = json.loads((DIR / "category_meta.json").read_text(encoding="utf-8"))
BASE = meta["base"]["base_token"]
CAT = cm["cat_table"]
BIND = cm["bind_table"]
VERSION = "v0.7.1"

# 品类展示顺序（电网物资 → 安全工器具）
CAT_ORDER = [
    ("CAT-BOLT", "高强度螺栓连接副", "电网物资", 10),
    ("CAT-CABLE", "电力电缆", "电网物资", 20),
    ("CAT-CONDUIT", "电缆保护管", "电网物资", 30),
    ("CAT-WIRE", "导线", "电网物资", 40),
    ("CAT-FITTING", "金具", "电网物资", 50),
    ("CAT-GLOVE", "绝缘手套", "安全工器具", 60),
    ("CAT-HARNESS", "安全带", "安全工器具", 70),
]
CAT_DOMAIN = {c: d for c, _, d, _ in CAT_ORDER}
CAT_SORT = {c: s for c, _, _, s in CAT_ORDER}
CAT_NAME = {c: n for c, n, _, _ in CAT_ORDER}

VIEW_MAIN = "vewYx86nhQ"
VIEW_BY_CAT = "vewtTNFEkF"


def run(args: list[str]) -> dict:
    p = subprocess.run(args, capture_output=True, text=True, env=ENV, cwd=ROOT)
    try:
        return json.loads(p.stdout)
    except Exception:
        print("RAW", (p.stdout or "")[:800], (p.stderr or "")[:400], file=sys.stderr)
        raise


def list_records(table_id: str) -> list[dict]:
    out = run(
        [
            "lark-cli", "base", "+record-list",
            "--base-token", BASE, "--table-id", table_id,
            "--page-size", "500", "--as", "user",
        ]
    )
    path = Path(out["record_file"])
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    for leftover in ROOT.glob(f"{table_id}_*"):
        leftover.unlink(missing_ok=True)
    return rows


def ensure_sort_field() -> None:
    fields = run(["lark-cli", "base", "+field-list", "--base-token", BASE, "--table-id", BIND, "--as", "user"])
    names = {f["name"] for f in fields["data"]["fields"]}
    if "排序号" in names:
        print("skip 排序号 field")
        return
    out = run(
        [
            "lark-cli", "base", "+field-create",
            "--base-token", BASE, "--table-id", BIND,
            "--json", json.dumps(
                {
                    "name": "排序号",
                    "type": "number",
                    "description": "视图排序：电网物资(10–50) → 安全工器具(60–70)；品类内再按 rule 序号",
                },
                ensure_ascii=False,
            ),
            "--as", "user", "--i-have-read-guide",
        ]
    )
    print("create 排序号", out.get("ok"), out.get("error") or "")


def ensure_domain_option_order() -> None:
    """领域选项：电网物资在前。"""
    out = run(
        [
            "lark-cli", "base", "+field-get",
            "--base-token", BASE, "--table-id", BIND,
            "--field-id", "领域", "--as", "user",
        ]
    )
    field = out["data"]["field"]
    payload = {
        "name": "领域",
        "type": "select",
        "multiple": False,
        "description": field.get("description") or "品类所属业务领域",
        "options": [{"name": "电网物资"}, {"name": "安全工器具"}],
    }
    up = run(
        [
            "lark-cli", "base", "+field-update",
            "--base-token", BASE, "--table-id", BIND,
            "--field-id", "领域",
            "--json", json.dumps(payload, ensure_ascii=False),
            "--as", "user", "--yes",
        ]
    )
    print("领域 options order", up.get("ok"), up.get("error") or "")


def split_categories() -> None:
    cats = list_records(CAT)
    by_code = {c.get("category_code"): c for c in cats}
    # 更新或创建目标品类
    creates = []
    updates = {}
    for code, name, _domain, _sort in CAT_ORDER:
        if code in by_code:
            rid = by_code[code]["record_id"]
            cur_name = by_code[code].get("品类名称")
            if cur_name != name:
                updates[rid] = {"品类名称": name, "是否已配绑定": ["是"]}
            else:
                updates[rid] = {"是否已配绑定": ["是"]}
        else:
            creates.append(
                {
                    "category_code": code,
                    "品类名称": name,
                    "来源": "LIMS",
                    "是否已配绑定": "是",
                    "同步时间": "2026-11-19",
                    "备注": "由 CAT-CON-WIRE 拆分" if code in ("CAT-WIRE", "CAT-FITTING") else "编码为占位",
                }
            )
    # 删除旧合并品类
    if "CAT-CON-WIRE" in by_code:
        old = by_code["CAT-CON-WIRE"]
        out = run(
            [
                "lark-cli", "base", "+record-delete",
                "--base-token", BASE, "--table-id", CAT,
                "--record-id", old["record_id"], "--as", "user", "--yes",
            ]
        )
        print("delete CAT-CON-WIRE", out.get("ok"), out.get("error") or "")

    if creates:
        out = run(
            [
                "lark-cli", "base", "+record-batch-create",
                "--base-token", BASE, "--table-id", CAT, "--as", "user",
                "--json", json.dumps({"create_records": creates}, ensure_ascii=False),
            ]
        )
        print("create cats", [c["category_code"] for c in creates], out.get("ok"), out.get("error") or "")
    if updates:
        out = run(
            [
                "lark-cli", "base", "+record-batch-update",
                "--base-token", BASE, "--table-id", CAT, "--as", "user",
                "--json", json.dumps({"update_records": updates}, ensure_ascii=False),
            ]
        )
        print("update cats", len(updates), out.get("ok"), out.get("error") or "")


# 品类内规则稳定顺序（避免 L2-d-1 与 L3-d-1 序号碰撞）
RULE_ORD = [
    "L2-d-1", "L2-d-4", "L2-d-5", "L2-d-8", "L2-d-11",
    "L3-b-2", "L3-b-4", "L3-b-5", "L3-d-1",
]
RULE_SEQ = {r: i + 1 for i, r in enumerate(RULE_ORD)}


def rule_seq(rid: str) -> int:
    return RULE_SEQ.get(str(rid), 99)


def rebuild_bindings() -> None:
    """全量重洗绑定行（含拆分后的导线/金具）。"""
    # delete all
    rows = list_records(BIND)
    ids = [r["record_id"] for r in rows if r.get("record_id")]
    print("delete bindings", len(ids))
    for i in range(0, len(ids), 50):
        chunk = ids[i : i + 50]
        args = [
            "lark-cli", "base", "+record-delete",
            "--base-token", BASE, "--table-id", BIND, "--as", "user", "--yes",
        ]
        for rid in chunk:
            args += ["--record-id", rid]
        out = run(args)
        print("  del batch", i // 50 + 1, out.get("ok"), out.get("error") or "")

    spec_path = DIR / "specialty_seed.json"
    if spec_path.exists():
        spec = json.loads(spec_path.read_text(encoding="utf-8"))["create_records"]
    else:
        ledger = json.loads((DIR / "ledger_seed.json").read_text(encoding="utf-8"))["create_records"]
        spec = [r for r in ledger if r.get("是否通用") == "品类专属"]

    create_rows = []
    for code, _name, domain, cat_sort in CAT_ORDER:
        for rule in spec:
            domains = rule.get("适用领域") or []
            if domain not in domains and "通用" not in domains:
                continue
            rid = rule["规则ID"]
            fields = rule.get("所需字段") or []
            fields_txt = "、".join(fields) if isinstance(fields, list) else str(fields)
            sort_no = cat_sort * 100 + rule_seq(rid)
            group = rule.get("规则组") or rid.rsplit("-", 1)[0]
            create_rows.append(
                {
                    "绑定ID": f"BLT-{code}-{rid}",
                    "category_code": code,
                    "领域": domain,
                    "规则组": group,
                    "rule_id": rid,
                    "启用": "是",
                    "级别": rule.get("级别"),
                    "类别": rule.get("类别"),
                    "所需字段": fields_txt,
                    "备注": rule.get("备注") or "",
                    "判定式": rule.get("判定式") or "",
                    "严重度": rule.get("严重度"),
                    "参数覆盖": "",
                    "标准依据": "",
                    "状态": "待审核员确认",
                    "版本": VERSION,
                    "排序号": sort_no,
                }
            )

    print("create bindings", len(create_rows))
    for i in range(0, len(create_rows), 20):
        chunk = create_rows[i : i + 20]
        out = run(
            [
                "lark-cli", "base", "+record-batch-create",
                "--base-token", BASE, "--table-id", BIND, "--as", "user",
                "--json", json.dumps({"create_records": chunk}, ensure_ascii=False),
            ]
        )
        print("  create batch", i // 20 + 1, out.get("ok"), out.get("error") or out.get("data"))

    cm["CAT_ORDER"] = [
        {"code": c, "name": n, "domain": d, "sort": s} for c, n, d, s in CAT_ORDER
    ]
    cm["bind_policy"] = {
        **(cm.get("bind_policy") or {}),
        "version": VERSION,
        "view_group": "领域",
        "view_sort": "排序号",
        "category_split": "CAT-CON-WIRE → CAT-WIRE + CAT-FITTING",
        "row_count": len(create_rows),
    }
    (DIR / "category_meta.json").write_text(
        json.dumps(cm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def set_view_group_sort() -> None:
    for vid in (VIEW_MAIN, VIEW_BY_CAT):
        g = run(
            [
                "lark-cli", "base", "+view-set-group",
                "--base-token", BASE, "--table-id", BIND, "--view-id", vid,
                "--json", json.dumps({"group_config": [{"field": "领域", "desc": False}]}, ensure_ascii=False),
                "--as", "user",
            ]
        )
        s = run(
            [
                "lark-cli", "base", "+view-set-sort",
                "--base-token", BASE, "--table-id", BIND, "--view-id", vid,
                "--json", json.dumps({"sort_config": [{"field": "排序号", "desc": False}]}, ensure_ascii=False),
                "--as", "user",
            ]
        )
        print("view", vid, "group", g.get("ok"), "sort", s.get("ok"), g.get("error") or "", s.get("error") or "")

    # 主视图列序：不改动既有相对顺序；排序号置末（可隐藏感）
    vis = run(
        [
            "lark-cli", "base", "+view-get-visible-fields",
            "--base-token", BASE, "--table-id", BIND, "--view-id", VIEW_MAIN, "--as", "user",
        ]
    )["data"]["visible_fields"]
    if "排序号" not in vis:
        vis = list(vis) + ["排序号"]
        out = run(
            [
                "lark-cli", "base", "+view-set-visible-fields",
                "--base-token", BASE, "--table-id", BIND, "--view-id", VIEW_MAIN,
                "--json", json.dumps({"visible_fields": vis}, ensure_ascii=False),
                "--as", "user",
            ]
        )
        print("append 排序号 to view", out.get("ok"), out.get("error") or "")


def patch_rebuild_cat_domain() -> None:
    """同步 rebuild_bindings.py 内 CAT_DOMAIN 常量（简单替换文件片段由外层负责也可）。"""
    pass


def main() -> None:
    ensure_sort_field()
    ensure_domain_option_order()
    split_categories()
    rebuild_bindings()
    subprocess.check_call([sys.executable, str(DIR / "fill_binding_params.py")], env=ENV, cwd=ROOT)
    # 回填排序号（fill 不写排序号；重建时已写入，若 fill 未动则可再扫一遍）
    rows = list_records(BIND)
    updates = {}
    for r in rows:
        cc = r.get("category_code")
        rid = r.get("rule_id")
        if cc not in CAT_SORT:
            continue
        want = CAT_SORT[cc] * 100 + rule_seq(rid)
        cur = r.get("排序号")
        if cur != want:
            updates[r["record_id"]] = {"排序号": want, "领域": [CAT_DOMAIN[cc]]}
    if updates:
        keys = list(updates.keys())
        for i in range(0, len(keys), 20):
            chunk = {k: updates[k] for k in keys[i : i + 20]}
            out = run(
                [
                    "lark-cli", "base", "+record-batch-update",
                    "--base-token", BASE, "--table-id", BIND, "--as", "user",
                    "--json", json.dumps({"update_records": chunk}, ensure_ascii=False),
                ]
            )
            print("sort backfill", i // 20 + 1, out.get("ok"), out.get("error") or "")
    else:
        print("sort numbers already set")
    set_view_group_sort()
    print("done", VERSION)


if __name__ == "__main__":
    main()
