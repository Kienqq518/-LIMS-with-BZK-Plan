# -*- coding: utf-8 -*-
"""为「品类规则绑定」表补齐关联展示列（幂等）。

- 品类名称：Lookup ← 品类.品类名称（按 category_code）
- 级别 / 类别：Lookup ← 审核规则（按 rule_id = 规则ID）
- 所需字段 / 备注：Formula ← 审核规则（按 rule_id = 规则ID）

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
    {
        "name": "级别",
        "type": "lookup",
        "description": "按 rule_id 关联「审核规则」.规则ID",
        "from": "审核规则",
        "select": "级别",
        "where": {
            "logic": "and",
            "conditions": [["规则ID", "==", {"type": "field_ref", "field": "rule_id"}]],
        },
        "aggregate": "raw_value",
    },
    {
        "name": "类别",
        "type": "lookup",
        "description": "按 rule_id 关联「审核规则」.规则ID",
        "from": "审核规则",
        "select": "类别",
        "where": {
            "logic": "and",
            "conditions": [["规则ID", "==", {"type": "field_ref", "field": "rule_id"}]],
        },
        "aggregate": "raw_value",
    },
]

FORMULAS = [
    {
        "name": "所需字段",
        "type": "formula",
        "description": "按 rule_id 关联审核规则.所需字段",
        "expression": 'ARRAYJOIN([审核规则].FILTER(CurrentValue.[规则ID] = [rule_id]).[所需字段].LISTCOMBINE(), "、")',
    },
    {
        "name": "备注",
        "type": "formula",
        "description": "按 rule_id 关联审核规则.备注（检查意图）",
        "expression": "FIRST([审核规则].FILTER(CurrentValue.[规则ID] = [rule_id]).[备注].LISTCOMBINE())",
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
    for spec in LOOKUPS + FORMULAS:
        ensure_field(spec, have)
        have = existing_fields()  # refresh after create/delete
    cm["bind_enrichment"] = {
        "品类名称": "lookup←品类.品类名称 via category_code",
        "级别": "lookup←审核规则.级别 via rule_id=规则ID",
        "类别": "lookup←审核规则.类别 via rule_id=规则ID",
        "所需字段": "formula←审核规则.所需字段 via rule_id=规则ID",
        "备注": "formula←审核规则.备注 via rule_id=规则ID",
    }
    (DIR / "category_meta.json").write_text(
        json.dumps(cm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("updated category_meta.json bind_enrichment")


if __name__ == "__main__":
    main()
