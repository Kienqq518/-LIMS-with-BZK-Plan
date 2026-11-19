# -*- coding: utf-8 -*-
"""将「品类专属」规则从审核规则表迁到品类规则绑定表。

口径：
  - 审核规则 sheet：只保留适用领域=通用 / 是否通用=通用
  - 品类规则绑定 sheet：承载特定领域专属规则（按品类绑定行）
  - 绑定表新增「领域」列，插在「品类名称」之前（视图列序）；其余列相对顺序不变
  - 级别/类别/所需字段/备注 改为存储列（不再 Lookup/Formula 回指审核规则）
  - 补「判定式」「严重度」存储列（专属规则定义落在绑定表）

用法：
  python3 docs/feishu/lims-ai-review/migrate_specialty_to_binding.py
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
RULE = "tblwz7D6MQVvm3Da"  # 审核规则
BIND = cm["bind_table"]
VERSION = "v0.7.0"

CAT_DOMAIN = {
    "CAT-BOLT": "电网物资",
    "CAT-CABLE": "电网物资",
    "CAT-CONDUIT": "电网物资",
    "CAT-CON-WIRE": "电网物资",
    "CAT-GLOVE": "安全工器具",
    "CAT-HARNESS": "安全工器具",
}

# 默认表格视图：在 品类名称 前插入 领域；其余相对顺序不变；末尾追加 判定式/严重度
VIEW_MAIN = "vewYx86nhQ"
VIEW_BY_CAT = "vewtTNFEkF"
VISIBLE_MAIN = [
    "绑定ID",
    "category_code",
    "领域",
    "品类名称",
    "rule_id",
    "启用",
    "级别",
    "类别",
    "所需字段",
    "参数覆盖",
    "备注",
    "标准依据",
    "状态",
    "版本",
    "判定式",
    "严重度",
]
VISIBLE_BY_CAT = [
    "绑定ID",
    "领域",
    "品类名称",
    "参数覆盖",
    "级别",
    "类别",
    "所需字段",
    "备注",
    "标准依据",
    "启用",
    "状态",
    "判定式",
    "严重度",
]


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


def fields_by_name(table_id: str) -> dict[str, dict]:
    out = run(["lark-cli", "base", "+field-list", "--base-token", BASE, "--table-id", table_id, "--as", "user"])
    return {f["name"]: f for f in out["data"]["fields"]}


def delete_field_if_exists(name: str, have: dict[str, dict]) -> None:
    if name not in have:
        return
    out = run(
        [
            "lark-cli", "base", "+field-delete",
            "--base-token", BASE, "--table-id", BIND,
            "--field-id", name, "--as", "user", "--yes",
        ]
    )
    print("delete field", name, out.get("ok"), out.get("error") or "")


def create_field(spec: dict) -> None:
    out = run(
        [
            "lark-cli", "base", "+field-create",
            "--base-token", BASE, "--table-id", BIND,
            "--json", json.dumps(spec, ensure_ascii=False),
            "--as", "user", "--i-have-read-guide",
        ]
    )
    print("create field", spec["name"], out.get("ok"), out.get("error") or "")


def ensure_stored_fields() -> None:
    """领域 + 将 lookup/formula 改为存储列；补判定式/严重度。"""
    have = fields_by_name(BIND)

    # 1) 领域（select）
    if "领域" not in have:
        create_field(
            {
                "name": "领域",
                "type": "select",
                "multiple": False,
                "description": "品类所属业务领域（电网物资 / 安全工器具）；插在品类名称前展示",
                "options": [{"name": "电网物资"}, {"name": "安全工器具"}],
            }
        )
    else:
        print("skip 领域")

    # 2) 级别 / 类别 / 所需字段 / 备注：若仍是 lookup/formula，删后重建为存储列
    recreate = []
    have = fields_by_name(BIND)
    for name, want_type, extra in [
        ("级别", "select", {"multiple": False, "options": [
            {"name": "L1 基础形式"}, {"name": "L2 数据逻辑"},
            {"name": "L3 合规对齐"}, {"name": "L4 溯源验证"},
        ]}),
        ("类别", "select", {"multiple": False, "options": [
            {"name": "编号"}, {"name": "签名"}, {"name": "字段齐全"}, {"name": "单位与格式"},
            {"name": "日期链"}, {"name": "委托项↔结果"}, {"name": "设备校准覆盖"}, {"name": "内部勾稽"},
            {"name": "标准现行有效"}, {"name": "限值符合"}, {"name": "方法完整性"}, {"name": "项目完整性"},
            {"name": "原始记录哈希/时间戳"}, {"name": "人员资质"}, {"name": "CMA 范围"}, {"name": "透明度溯源码"},
        ]}),
        ("所需字段", "text", {}),
        ("备注", "text", {}),
    ]:
        cur = have.get(name)
        if cur and cur.get("type") == want_type:
            print("skip stored", name, want_type)
            continue
        if cur:
            delete_field_if_exists(name, have)
        recreate.append((name, want_type, extra))
        have = fields_by_name(BIND)

    for name, want_type, extra in recreate:
        spec = {"name": name, "type": want_type, "description": "专属规则定义（存于绑定表，不再回指审核规则）", **extra}
        create_field(spec)

    have = fields_by_name(BIND)
    if "判定式" not in have:
        create_field({"name": "判定式", "type": "text", "description": "专属规则判定式（定义落在绑定表）"})
    else:
        print("skip 判定式")
    if "严重度" not in have:
        create_field(
            {
                "name": "严重度",
                "type": "select",
                "multiple": False,
                "options": [{"name": "严重"}, {"name": "一般"}, {"name": "轻微"}],
                "description": "专属规则严重度（定义落在绑定表）",
            }
        )
    else:
        print("skip 严重度")


def set_view_order() -> None:
    for vid, fields in [(VIEW_MAIN, VISIBLE_MAIN), (VIEW_BY_CAT, VISIBLE_BY_CAT)]:
        out = run(
            [
                "lark-cli", "base", "+view-set-visible-fields",
                "--base-token", BASE, "--table-id", BIND, "--view-id", vid,
                "--json", json.dumps({"visible_fields": fields}, ensure_ascii=False),
                "--as", "user",
            ]
        )
        print("view order", vid, out.get("ok"), out.get("error") or "")


def split_seeds() -> tuple[list[dict], list[dict]]:
    ledger = json.loads((DIR / "ledger_seed.json").read_text(encoding="utf-8"))["create_records"]
    univ = [r for r in ledger if r.get("是否通用") == "通用"]
    spec = [r for r in ledger if r.get("是否通用") == "品类专属"]
    (DIR / "universal_seed.json").write_text(
        json.dumps({"create_records": univ, "policy": "审核规则表仅含通用领域规则"}, ensure_ascii=False, indent=1)
        + "\n",
        encoding="utf-8",
    )
    (DIR / "specialty_seed.json").write_text(
        json.dumps(
            {
                "create_records": spec,
                "policy": "品类专属规则定义落在品类规则绑定表；按领域×品类绑定",
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    print("wrote universal_seed", len(univ), "specialty_seed", len(spec))
    return univ, spec


def delete_specialty_from_rules(spec_ids: set[str]) -> None:
    rows = list_records(RULE)
    to_del = []
    for r in rows:
        rid = r.get("规则ID")
        univ = r.get("是否通用")
        if isinstance(univ, list):
            univ = univ[0] if univ else ""
        domains = r.get("适用领域") or []
        if isinstance(domains, str):
            domains = [domains]
        # 非「通用」标记，或适用领域不是纯通用 → 删
        if univ == "品类专属" or rid in spec_ids or (domains and domains != ["通用"]):
            to_del.append(r["record_id"])
    print("delete specialty from 审核规则", len(to_del))
    for i in range(0, len(to_del), 50):
        chunk = to_del[i : i + 50]
        args = [
            "lark-cli", "base", "+record-delete",
            "--base-token", BASE, "--table-id", RULE, "--as", "user", "--yes",
        ]
        for rid in chunk:
            args += ["--record-id", rid]
        out = run(args)
        print("  batch", i // 50 + 1, out.get("ok"), out.get("error") or "")


def backfill_binding_defs(spec: list[dict]) -> None:
    by_id = {r["规则ID"]: r for r in spec}
    rows = list_records(BIND)
    updates = {}
    for r in rows:
        rid = r.get("rule_id")
        cc = r.get("category_code")
        rule = by_id.get(rid)
        if not rule:
            print("WARN binding rule missing in specialty_seed", r.get("绑定ID"), rid)
            continue
        domain = CAT_DOMAIN.get(cc) or (rule.get("适用领域") or [None])[0]
        fields = rule.get("所需字段") or []
        if isinstance(fields, list):
            fields_txt = "、".join(fields)
        else:
            fields_txt = str(fields)
        updates[r["record_id"]] = {
            "领域": [domain] if domain else [],
            "级别": [rule["级别"]] if not isinstance(rule["级别"], list) else rule["级别"],
            "类别": [rule["类别"]] if not isinstance(rule["类别"], list) else rule["类别"],
            "所需字段": fields_txt,
            "备注": rule.get("备注") or "",
            "判定式": rule.get("判定式") or "",
            "严重度": [rule["严重度"]] if not isinstance(rule["严重度"], list) else rule["严重度"],
            "版本": VERSION,
        }
    print("backfill binding defs", len(updates))
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
        print("  batch", i // 20 + 1, out.get("ok"), out.get("error") or out.get("data"))


def update_meta(univ: list[dict], spec: list[dict]) -> None:
    cm["UNIV"] = [r["规则ID"] for r in univ]
    cm["SPEC"] = [r["规则ID"] for r in spec]
    cm["split_policy"] = {
        "version": VERSION,
        "审核规则": "仅通用领域（是否通用=通用，适用领域=通用）",
        "品类规则绑定": "特定领域专属规则定义 + 品类绑定；含领域列（在品类名称前）",
        "L2-d-9": "适用领域空，MVP 不建绑定行，仅存 specialty_seed",
    }
    cm["bind_enrichment"] = {
        "领域": "select 存于绑定表（品类名称前）",
        "品类名称": "lookup←品类.品类名称 via category_code",
        "级别/类别/所需字段/备注/判定式/严重度": "专属规则定义存于绑定表（不再回指审核规则）",
    }
    (DIR / "category_meta.json").write_text(
        json.dumps(cm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def main() -> None:
    univ, spec = split_seeds()
    ensure_stored_fields()
    set_view_order()
    delete_specialty_from_rules({r["规则ID"] for r in spec})
    backfill_binding_defs(spec)
    update_meta(univ, spec)
    # 回填参数覆盖（保留品类方法标准依据）
    subprocess.check_call([sys.executable, str(DIR / "fill_binding_params.py")], env=ENV, cwd=ROOT)
    print("done", VERSION)


if __name__ == "__main__":
    main()
