# -*- coding: utf-8 -*-
"""重洗「品类规则绑定」表。

口径（与产品约定对齐）：
  - 只绑定主表「是否通用=品类专属」的规则；通用规则不进绑定表。
  - 删除「严重度覆盖」：严重度只以审核规则主表为准。
  - 「启用」默认「是」，状态「待审核员确认」——由实验室/客户按实际项目决定是否关掉；
    脚本不按旧矩阵擅自停用。
  - 仅对「已配绑定」品类 × 适用领域匹配的专属规则建行。

用法：
  python3 docs/feishu/lims-ai-review/rebuild_bindings.py
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
VERSION = "v0.6.0"

meta = json.loads((DIR / "base.json").read_text(encoding="utf-8"))
cm = json.loads((DIR / "category_meta.json").read_text(encoding="utf-8"))
BASE = meta["base"]["base_token"]
BIND = cm["bind_table"]
CAT = cm["cat_table"]

# 品类 → 适用领域（与审核规则「适用领域」对齐）
CAT_DOMAIN = {
    "CAT-BOLT": "电网物资",
    "CAT-CABLE": "电网物资",
    "CAT-CONDUIT": "电网物资",
    "CAT-CON-WIRE": "电网物资",
    "CAT-GLOVE": "安全工器具",
    "CAT-HARNESS": "安全工器具",
}


def run(args: list[str]) -> dict:
    p = subprocess.run(args, capture_output=True, text=True, env=ENV, cwd=ROOT)
    try:
        return json.loads(p.stdout)
    except Exception:
        print("RAW", (p.stdout or "")[:500], (p.stderr or "")[:300], file=sys.stderr)
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


def delete_all_bindings() -> None:
    rows = list_records(BIND)
    ids = [r.get("record_id") for r in rows if r.get("record_id")]
    print(f"delete {len(ids)} old bindings")
    for i in range(0, len(ids), 50):
        chunk = ids[i : i + 50]
        args = [
            "lark-cli", "base", "+record-delete",
            "--base-token", BASE, "--table-id", BIND, "--as", "user", "--yes",
        ]
        for rid in chunk:
            args += ["--record-id", rid]
        out = run(args)
        print("  batch", i // 50 + 1, out.get("ok"), out.get("error") or "")


def drop_severity_override() -> None:
    fields = run(
        ["lark-cli", "base", "+field-list", "--base-token", BASE, "--table-id", BIND, "--as", "user"]
    )["data"]["fields"]
    names = {f["name"] for f in fields}
    if "严重度覆盖" not in names:
        print("严重度覆盖 already gone")
        return
    out = run(
        [
            "lark-cli", "base", "+field-delete",
            "--base-token", BASE, "--table-id", BIND,
            "--field-id", "严重度覆盖", "--as", "user", "--yes",
        ]
    )
    print("drop 严重度覆盖", out.get("ok"), out.get("error") or "")


def update_enabled_description() -> None:
    out = run(
        [
            "lark-cli", "base", "+field-get",
            "--base-token", BASE, "--table-id", BIND,
            "--field-id", "启用", "--as", "user",
        ]
    )
    field = out["data"]["field"]
    payload = {
        "name": "启用",
        "type": "select",
        "multiple": False,
        "description": (
            "本品类是否执行该「品类专属」规则。默认「是」；"
            "由实验室/客户按项目与方法实际情况确认后可改为「否」。"
            "通用规则不进本表，始终按主表执行。"
        ),
        "options": field.get("options") or [{"name": "是"}, {"name": "否"}],
    }
    up = run(
        [
            "lark-cli", "base", "+field-update",
            "--base-token", BASE, "--table-id", BIND,
            "--field-id", "启用",
            "--json", json.dumps(payload, ensure_ascii=False),
            "--as", "user", "--yes",
        ]
    )
    print("启用 description", up.get("ok"), up.get("error") or "")


def build_rows() -> list[dict]:
    ledger = json.loads((DIR / "ledger_seed.json").read_text(encoding="utf-8"))["create_records"]
    spec = [r for r in ledger if r.get("是否通用") == "品类专属"]
    cats = list_records(CAT)
    configured = []
    for c in cats:
        code = c.get("category_code")
        flag = c.get("是否已配绑定")
        if isinstance(flag, list):
            flag = flag[0] if flag else ""
        if flag == "是" and code:
            configured.append(code)

    rows = []
    for cc in configured:
        domain = CAT_DOMAIN.get(cc)
        if not domain:
            print("WARN no domain for", cc)
            continue
        for rule in spec:
            domains = rule.get("适用领域") or []
            if domain not in domains and "通用" not in domains:
                continue
            rid = rule["规则ID"]
            rows.append(
                {
                    "绑定ID": f"BLT-{cc}-{rid}",
                    "category_code": cc,
                    "rule_id": rid,
                    "启用": "是",  # 默认开；实验室/客户可关
                    "参数覆盖": "",  # 待顾问按方法标准填写
                    "标准依据": "",  # 品类侧方法依据待填；严重度看主表
                    "状态": "待审核员确认",
                    "版本": VERSION,
                }
            )
    return rows, [r["规则ID"] for r in spec], configured


def create_rows(rows: list[dict]) -> None:
    for i in range(0, len(rows), 20):
        chunk = rows[i : i + 20]
        out = run(
            [
                "lark-cli", "base", "+record-batch-create",
                "--base-token", BASE, "--table-id", BIND, "--as", "user",
                "--json", json.dumps({"create_records": chunk}, ensure_ascii=False),
            ]
        )
        print(f"create batch {i // 20 + 1}", out.get("ok"), out.get("error") or out.get("data"))


def main() -> None:
    drop_severity_override()
    update_enabled_description()
    delete_all_bindings()
    rows, spec_ids, configured = build_rows()
    print("configured cats", configured)
    print("spec rules", spec_ids)
    print("new rows", len(rows))
    for r in rows:
        print(" ", r["绑定ID"])
    create_rows(rows)

    cm["SPEC"] = spec_ids
    cm["UNIV"] = [
        r["规则ID"]
        for r in json.loads((DIR / "ledger_seed.json").read_text(encoding="utf-8"))["create_records"]
        if r.get("是否通用") == "通用"
    ]
    cm["PARAM"] = {}  # 参数改由顾问按品类填写，不再灌旧 A02/B02 矩阵
    cm["bind_policy"] = {
        "version": VERSION,
        "only_specialty": True,
        "severity_from": "审核规则主表（无严重度覆盖列）",
        "enabled_default": "是",
        "enabled_owner": "实验室/客户按项目实际确认",
        "row_count": len(rows),
        "configured_categories": configured,
    }
    (DIR / "category_meta.json").write_text(
        json.dumps(cm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    # local seed snapshot
    seed = {"create_records": rows, "policy": cm["bind_policy"]}
    (DIR / "binding_seed.json").write_text(
        json.dumps(seed, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    print("wrote category_meta.json + binding_seed.json")


if __name__ == "__main__":
    main()
