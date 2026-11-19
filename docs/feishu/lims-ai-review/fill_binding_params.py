# -*- coding: utf-8 -*-
"""为品类规则绑定表回填「参数覆盖」「标准依据」（草案，待审核员确认）。

口径：
  - 标准依据：本品类侧方法/产品标准（可与主表 CNAS 依据并存；主表管通则，本列管品类方法）
  - 参数覆盖：按主表 param_schema 形态填品类初值；无 schema 的规则给 pack/勾稽提示 JSON
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
VERSION = "v0.6.2"

# (参数覆盖 JSON 字符串, 品类标准依据)
FILL: dict[tuple[str, str], tuple[str, str]] = {
    # —— 高强度螺栓连接副 ——
    ("CAT-BOLT", "L2-d-1"): (
        '{"parallel_count":8,"std_max":0.0074,"note":"扭矩系数多样本；以GB/T 1231为准"}',
        "GB/T 1231（扭矩系数样本组数/标准差）；GB/T 228.1（拉伸试件）",
    ),
    ("CAT-BOLT", "L2-d-4"): (
        '{"metric":"std_or_rsd","std_max":0.0074,"note":"扭矩系数样本标准差/RSD"}',
        "GB/T 1231（扭矩系数精密度/样本统计）",
    ),
    ("CAT-BOLT", "L2-d-5"): (
        '{"pack":"grid_fastener","match":["grade_vs_items","size_vs_items"]}',
        "GB/T 3098.1 / GB/T 1231（等级/规格与必检项目对应）",
    ),
    ("CAT-BOLT", "L2-d-8"): (
        '{"pack":"grid_fastener","plausible":{"Rm":"按等级","K":"0.11-0.15典型带","HRC":"按等级"}}',
        "GB/T 3098.1；GB/T 1231（合理值带，异常提示）",
    ),
    ("CAT-BOLT", "L2-d-11"): (
        '{"pack":"grid_fastener","checks":["Rm_vs_grade","torque_coeff_band","hardness_band"]}',
        "GB/T 3098.1；GB/T 1231；GB/T 228.1（螺栓强度/扭矩系数/硬度勾稽）",
    ),
    ("CAT-BOLT", "L3-b-2"): (
        '{"tol_source":"method","note":"方法允许偏差/重复性；多样本时适用"}',
        "GB/T 3098.1 / GB/T 1231 允许偏差与重复性条款",
    ),
    ("CAT-BOLT", "L3-b-5"): (
        '{"lower_map":{"Rm":"按等级","A":"按等级"},"points":3,"hrc_band":"10.9级示例 HRC32-39"}',
        "GB/T 3098.1（机械性能限值）；GB/T 1231（连接副）",
    ),
    ("CAT-BOLT", "L3-d-1"): (
        '{"mandatory":["尺寸","硬度","Rm","扭矩系数"],"note":"连接副型式/出厂检验强制项草案"}',
        "GB/T 1231 / GB/T 3098.1 强制检验项目（待顾问确认清单）",
    ),
    # —— 绝缘手套 ——
    ("CAT-GLOVE", "L2-d-5"): (
        '{"pack":"safety_glove","match":["voltage_class_vs_items"]}',
        "DL/T 976-2017；GB/T 17622（电压等级与试验项目对应）",
    ),
    ("CAT-GLOVE", "L2-d-8"): (
        '{"pack":"safety_glove","plausible":{"leak_mA":"按类型上限带","hold_s":">=60"}}',
        "DL/T 976-2017；GB/T 17622（泄漏/保持时间合理带）",
    ),
    ("CAT-GLOVE", "L2-d-11"): (
        '{"pack":"safety_glove","checks":["voltage_class_vs_type","leak_vs_hold"]}',
        "DL/T 976-2017；GB/T 17622（工器具耐压/泄漏勾稽）",
    ),
    ("CAT-GLOVE", "L3-b-4"): (
        '{"voltage":"按手套类型","leak_limit":"按类型","hold_min":60}',
        "DL/T 976-2017；GB/T 17622（耐压、泄漏电流、保持时间）",
    ),
    ("CAT-GLOVE", "L3-d-1"): (
        '{"mandatory":["外观","工频耐压","泄漏电流"],"note":"预防性试验强制项草案"}',
        "DL/T 976-2017 强制试验项目（待顾问确认清单）",
    ),
    # —— 电力电缆 ——
    ("CAT-CABLE", "L2-d-1"): (
        '{"parallel_count":"按抽样盘数/试样","note":"按批抽样多样本，非化学平行双样"}',
        "GB/T 12706 抽样与试样规定（待顾问确认组数）",
    ),
    ("CAT-CABLE", "L2-d-4"): (
        '{"metric":"multi_specimen","note":"多样本统计/重复性按产品标准"}',
        "GB/T 12706 相关精密度/试样规定（待顾问确认）",
    ),
    ("CAT-CABLE", "L2-d-5"): (
        '{"pack":"power_cable","match":["voltage_class_vs_items","conductor_vs_R20"]}',
        "GB/T 12706；GB/T 3956（规格与试验项目对应）",
    ),
    ("CAT-CABLE", "L2-d-8"): (
        '{"pack":"power_cable","plausible":{"R20":"按截面上限带","绝缘厚度":">=标准最小值"}}',
        "GB/T 12706；GB/T 3956（合理值带）",
    ),
    ("CAT-CABLE", "L2-d-11"): (
        '{"pack":"power_cable","checks":["R20_corr","thickness_min_multi_point"]}',
        "GB/T 12706；GB/T 3956；GB/T 3048.4（电阻换算/厚度勾稽）",
    ),
    ("CAT-CABLE", "L3-b-2"): (
        '{"tol_source":"method","note":"尺寸/电阻等方法允许偏差"}',
        "GB/T 12706 / GB/T 3956 允许偏差条款",
    ),
    ("CAT-CABLE", "L3-b-5"): (
        '{"lower_map":{"绝缘厚度":"标准最小值","护套厚度":"标准最小值"},"points":"多点取最小","ref_temp_C":20}',
        "GB/T 12706（绝缘/护套厚度等限值）；GB/T 3956（导体电阻）",
    ),
    ("CAT-CABLE", "L3-d-1"): (
        '{"mandatory":["导体电阻","绝缘厚度","护套厚度","耐压"],"note":"出厂/型式强制项草案"}',
        "GB/T 12706 强制检验项目（待顾问确认清单）",
    ),
    # —— 电缆保护管 ——
    ("CAT-CONDUIT", "L2-d-1"): (
        '{"parallel_count":"按产品标准试样数","note":"力学性能多样本；待顾问确认"}',
        "相关产品标准试样数量要求（待顾问确认）",
    ),
    ("CAT-CONDUIT", "L2-d-4"): (
        '{"metric":"multi_specimen","note":"环刚度等多样本统计；待顾问确认"}',
        "相关产品标准精密度/试样规定（待顾问确认）",
    ),
    ("CAT-CONDUIT", "L2-d-5"): (
        '{"pack":"cable_conduit","match":["spec_vs_items"]}',
        "相关产品标准（规格与试验项目对应，待顾问确认）",
    ),
    ("CAT-CONDUIT", "L2-d-8"): (
        '{"pack":"cable_conduit","plausible":{"环刚度":"按规格带","壁厚":"按规格带"}}',
        "相关产品标准合理值带（待顾问确认）",
    ),
    ("CAT-CONDUIT", "L2-d-11"): (
        '{"pack":"cable_conduit","checks":["ring_stiffness","impact","dimension"]}',
        "GB/T 9647（环刚度，示例）；相关产品标准（待顾问确认）",
    ),
    ("CAT-CONDUIT", "L3-b-2"): (
        '{"tol_source":"method","note":"尺寸/力学性能允许偏差"}',
        "相关产品标准允许偏差条款（待顾问确认）",
    ),
    ("CAT-CONDUIT", "L3-b-5"): (
        '{"lower_map":{"环刚度":"按规格","壁厚":"按规格"},"points":3}',
        "GB/T 9647 / 产品标准尺寸与力学性能限值（待顾问确认）",
    ),
    ("CAT-CONDUIT", "L3-d-1"): (
        '{"mandatory":["外观","尺寸","环刚度"],"note":"强制项草案"}',
        "相关产品标准强制检验项目（待顾问确认清单）",
    ),
    # —— 安全带 ——
    ("CAT-HARNESS", "L2-d-5"): (
        '{"pack":"safety_harness","match":["model_vs_items"]}',
        "GB 6095 / GB/T 6096（型号与试验项目对应）",
    ),
    ("CAT-HARNESS", "L2-d-8"): (
        '{"pack":"safety_harness","plausible":{"static_load_kN":"按型号下限带"}}',
        "GB 6095 / GB/T 6096（静负荷等合理带）",
    ),
    ("CAT-HARNESS", "L2-d-11"): (
        '{"pack":"safety_harness","checks":["static_load","buckle_strength"]}',
        "GB 6095 / GB/T 6096（安全带，示例；待顾问确认）",
    ),
    ("CAT-HARNESS", "L3-b-4"): (
        '{"voltage":null,"leak_limit":null,"hold_min":null,"static_load_kN":"按型号","note":"安全带以静负荷等为主，耐压参数可空"}',
        "GB 6095 / GB/T 6096（整体静态负荷等；待顾问确认）",
    ),
    ("CAT-HARNESS", "L3-d-1"): (
        '{"mandatory":["外观","整体静态负荷"],"note":"强制项草案"}',
        "GB 6095 / GB/T 6096 强制试验项目（待顾问确认清单）",
    ),
    # —— 导线 / 金具 ——
    ("CAT-CON-WIRE", "L2-d-1"): (
        '{"parallel_count":3,"note":"握着力等常要求多件试样；待顾问确认"}',
        "相关金具/导线试验标准试样数量（待顾问确认）",
    ),
    ("CAT-CON-WIRE", "L2-d-4"): (
        '{"metric":"multi_specimen","note":"多件试样统计；待顾问确认"}',
        "相关金具/导线试验标准精密度条款（待顾问确认）",
    ),
    ("CAT-CON-WIRE", "L2-d-5"): (
        '{"pack":"conductor_fitting","match":["model_vs_items"]}',
        "GB/T 2314 等（型号与试验项目对应，待顾问确认）",
    ),
    ("CAT-CON-WIRE", "L2-d-8"): (
        '{"pack":"conductor_fitting","plausible":{"握着力":"按型号下限带","尺寸":"按图纸带"}}',
        "GB/T 2314 / 图样合理值带（待顾问确认）",
    ),
    ("CAT-CON-WIRE", "L2-d-11"): (
        '{"pack":"conductor_fitting","checks":["grip_strength","dimension"]}',
        "GB/T 2314 等金具/导线相关标准（握着力等勾稽，待顾问确认）",
    ),
    ("CAT-CON-WIRE", "L3-b-2"): (
        '{"tol_source":"method","note":"握着力/尺寸允许偏差"}',
        "相关金具/导线标准允许偏差条款（待顾问确认）",
    ),
    ("CAT-CON-WIRE", "L3-b-5"): (
        '{"lower_map":{"握着力":"按型号","尺寸":"按图纸"},"points":3}',
        "GB/T 2314 / 产品图样限值（待顾问确认）",
    ),
    ("CAT-CON-WIRE", "L3-d-1"): (
        '{"mandatory":["尺寸","握着力"],"note":"强制项草案"}',
        "相关金具/导线标准强制检验项目（待顾问确认清单）",
    ),
    # L2-d-9 LOD/LOQ：当前 MVP 品类均不绑定（适用领域为空）
    # 安全工器具不绑 L2-d-1 / L2-d-4 / L3-b-2（无平行/RSD 组数概念）
}


def run(args: list[str]) -> dict:
    p = subprocess.run(args, capture_output=True, text=True, env=ENV, cwd=ROOT)
    try:
        return json.loads(p.stdout)
    except Exception:
        print("RAW", p.stdout[:500], p.stderr[:300], file=sys.stderr)
        raise


def main() -> None:
    out = run(
        [
            "lark-cli", "base", "+record-list",
            "--base-token", BASE, "--table-id", BIND,
            "--page-size", "200", "--as", "user",
        ]
    )
    path = Path(out["record_file"])
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    for leftover in ROOT.glob(f"{BIND}_*"):
        leftover.unlink(missing_ok=True)

    updates = {}
    seed_rows = []
    missing = []
    for r in rows:
        cc, rid = r.get("category_code"), r.get("rule_id")
        bid = r.get("绑定ID")
        key = (cc, rid)
        if key not in FILL:
            missing.append(bid)
            continue
        params, basis = FILL[key]
        updates[r["record_id"]] = {
            "参数覆盖": params,
            "标准依据": basis,
            "版本": VERSION,
            "状态": ["待审核员确认"],
        }
        seed_rows.append(
            {
                "绑定ID": bid,
                "category_code": cc,
                "rule_id": rid,
                "启用": "是",
                "参数覆盖": params,
                "标准依据": basis,
                "状态": "待审核员确认",
                "版本": VERSION,
            }
        )

    if missing:
        print("WARN no fill map for", missing)
    if not updates:
        print("nothing to update")
        return

    for i in range(0, len(updates), 20):
        keys = list(updates.keys())[i : i + 20]
        chunk = {k: updates[k] for k in keys}
        res = run(
            [
                "lark-cli", "base", "+record-batch-update",
                "--base-token", BASE, "--table-id", BIND, "--as", "user",
                "--json", json.dumps({"update_records": chunk}, ensure_ascii=False),
            ]
        )
        print(f"batch {i // 20 + 1}", res.get("ok"), res.get("error") or res.get("data"))

    cm["PARAM"] = {
        f"{cc}:{rid}": json.loads(params) for (cc, rid), (params, _) in FILL.items()
    }
    cm["bind_policy"] = {
        **(cm.get("bind_policy") or {}),
        "version": VERSION,
        "param_and_basis": "filled by fill_binding_params.py; 待审核员确认",
        "row_count": len(seed_rows),
    }
    (DIR / "category_meta.json").write_text(
        json.dumps(cm, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (DIR / "binding_seed.json").write_text(
        json.dumps(
            {"create_records": seed_rows, "policy": cm["bind_policy"]},
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    print("updated", len(updates), "rows; seed/meta written")


if __name__ == "__main__":
    main()
