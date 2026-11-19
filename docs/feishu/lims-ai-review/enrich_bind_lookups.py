# -*- coding: utf-8 -*-
"""为「品类规则绑定」表补齐关联展示列（幂等）。

v0.7+：专属规则定义已落在绑定表；审核规则表仅含通用。
本脚本只保证：
  - 品类名称：Lookup ← 品类.品类名称（按 category_code）

级别/类别/所需字段/备注/判定式/严重度/领域 均为绑定表存储列，
由 migrate_specialty_to_binding.py / rebuild_bindings.py 写入。

用法：
  python3 docs/feishu/lims-ai-review/enrich_bind_lookups.py
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
BIND = cm["bind_table"]


def run(args: list[str]) -> dict:
    p = subprocess.run(args, capture_output=True, text=True, env=ENV, cwd=ROOT)
    try:
        return json.loads(p.stdout)
    except Exception:
        print("RAW", p.stdout[:500], p.stderr[:300], file=sys.stderr)
        raise


def existing_fields() -> dict[str, dict]:
    out = run(["lark-cli", "base", "+field-list", "--base-token", BASE, "--table-id", BIND, "--as", "user"])
    return {f["name"]: f for f in out["data"]["fields"]}


LOOKUPS = [
    {
        "name": "品类名称",
        "type": "lookup",
        "description": "按 category_code 关联「品类」表",
        "from": "品类",
        "select": "品类名称",
        "where": {
            "logic": "and",
            "conditions": [["category_code", "==", {"type": "field_ref", "field": "category_code"}]],
        },
        "aggregate": "raw_value",
    },
]


def ensure_field(spec: dict, have: dict[str, dict]) -> None:
    name = spec["name"]
    if name in have and have[name].get("type") == spec["type"]:
        print("skip", name, have[name]["type"])
        return
    if name in have and have[name].get("type") != spec["type"]:
        print("recreate", name, have[name]["type"], "->", spec["type"])
        run(
            [
                "lark-cli", "base", "+field-delete",
                "--base-token", BASE, "--table-id", BIND,
                "--field-id", name, "--as", "user", "--yes",
            ]
        )
    out = run(
        [
            "lark-cli", "base", "+field-create",
            "--base-token", BASE, "--table-id", BIND,
            "--json", json.dumps(spec, ensure_ascii=False),
            "--as", "user", "--i-have-read-guide",
        ]
    )
    print("create", name, out.get("ok"), out.get("error") or "")


def main() -> None:
    have = existing_fields()
    for spec in LOOKUPS:
        ensure_field(spec, have)
        have = existing_fields()
    cm["bind_enrichment"] = {
        "领域": "select 存于绑定表（视图中位于品类名称前）",
        "品类名称": "lookup←品类.品类名称 via category_code",
        "级别/类别/所需字段/备注/判定式/严重度": "专属规则定义存于绑定表（不再回指审核规则）",
    }
    (DIR / "category_meta.json").write_text(
        json.dumps(cm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("updated category_meta.json bind_enrichment")


if __name__ == "__main__":
    main()
