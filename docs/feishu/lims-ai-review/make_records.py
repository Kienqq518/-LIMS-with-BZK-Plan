# -*- coding: utf-8 -*-
"""规则台账种子写入。

表设计（飞书 §2.3「审什么」）：
  - 级别：L1 基础形式 / L2 数据逻辑 / L3 合规对齐 / L4 溯源验证
  - 规则组：Ln-a/b/c/d
  - 类别：审什么主题名，与规则组一一对应
  - 规则ID：Ln-x-n（如 L1-a-1），不再使用 A01-1 / B01-1 / C02-5

注意：对已有 Base 重复执行会新增记录，勿盲目重跑（加 --push 才会写库）。
"""
import json, subprocess, os, sys
ENV = {**os.environ, "LARKSUITE_CLI_NO_UPDATE_NOTIFIER":"1", "LARKSUITE_CLI_NO_SKILLS_NOTIFIER":"1"}
meta = json.load(open("docs/feishu/lims-ai-review/base.json", encoding="utf-8"))
BASE = meta["base"]["base_token"]; TABLE = meta["table"]["id"]
LEVEL_MAP = json.load(open("docs/feishu/lims-ai-review/level_map.json", encoding="utf-8"))
THEME = LEVEL_MAP["theme"]; LEVEL_OF = LEVEL_MAP["level_of"]
G = "通用"; W = "电网物资"; T = "安全工器具"

# (规则ID, 判定式, 所需字段, 标准依据, 严重度, 领域, 负责人)
R = [
 ("L1-a-1","nonempty(sample_id) && match(sample_id, 编号规则)",["抽样单号"],"LIMS 编号规则 / 抽检细则","严重",G,"产品"),
 ("L1-a-2","match(report_id, 编号规则)",["报告模板版本"],"LIMS 编号规则","一般",G,"产品"),
 ("L1-b-1","nonempty(tester, reviewer, approver)",["签名位"],"CNAS-CL01 7.8","严重",G,"产品"),
 ("L1-b-2","logo_used && signatory in authorized_scope",["资质认定范围表"],"CNAS-CL01 7.8 / CMA","严重",G,"产品"),
 ("L1-c-1","nonempty(sample_name) && nonempty(spec_model)",["规格型号"],"GB/T 1231 规格标记 / 委托单","严重",W+","+T,"产品"),
 ("L1-c-2","nonempty(client) && nonempty(manufacturer) && nonempty(batch_no)",["炉（批）号"],"抽检细则","一般",G,"产品"),
 ("L1-c-3","nonempty(sampling_date, receive_date, sample_ticket, heat_no)",["抽样单号","炉（批）号"],"抽检细则","严重",G,"产品"),
 ("L1-c-4","nonempty(sample_status) && nonempty(seal_state)",["封样状态"],"抽检细则","一般",W,"产品"),
 ("L1-c-5","nonempty(raw_record)",["实测值"],"CMA 资质认定评审要求","严重",G,"后端"),
 ("L1-c-6","nonempty(device_no, device_range)",["试验设备编号与量程"],"GB/T 228.1 / GB/T 1231","一般",W,"后端"),
 ("L1-c-7","nonempty(test_date, tester)",["检测人员"],"CMA 资质认定评审要求","一般",G,"后端"),
 ("L1-c-8","if sensitive(items) then nonempty(temp, humidity)",["环境温湿度"],"GB/T 228.1 室温要求","轻微",W,"后端"),
 ("L1-c-9","all_required_sections_present(照片, 抽样单, 原始记录)",["报告模板版本"],"报告模板","一般",W,"产品"),
 ("L1-c-10","pages == 1..N continuous",["报告模板版本"],"报告模板","提示",G,"产品"),
 ("L1-d-1","sig_figs(value) == required_sig_figs(param)",["实测值"],"GB/T 8170-2008","轻微",G,"产品"),
 ("L1-d-2","rounding_interval(value) == standard_interval(param)",["实测值"],"GB/T 8170 / GB/T 228.1","轻微",W,"产品"),
 ("L1-d-3","decimals(values) consistent within one table",["实测值"],"报告模板","提示",G,"产品"),
 ("L1-d-4","unit in {MPa,kN,HRC,μm,kV,mA} && unit matches param",["实测值"],"报告模板","一般",G,"产品"),
 ("L1-d-5","round_mode == GB8170",["实测值"],"GB/T 8170-2008","轻微",G,"产品"),
 ("L2-a-1","sampling_date <= receive_date <= test_date <= report_date",["抽样单号"],"抽检细则","严重",G,"领域顾问"),
 ("L2-a-2","(test_date - receive_date) <= limit_period",["复检仲裁时效"],"抽检细则","一般",G,"领域顾问"),
 ("L2-a-3","report_date >= raw_record_date",["报告模板版本"],"CMA 评审要求","一般",G,"领域顾问"),
 ("L2-b-1","set(entrust_items) ⊆ set(result.params)",["实测值"],"委托单","严重",G,"后端"),
 ("L2-c-1","calib_from <= test_date <= calib_to",["设备校准有效期"],"计量法","严重",G,"领域顾问"),
 ("L2-c-2","cert_expire(device) >= test_date",["设备校准有效期"],"计量法 / JJG 检定规程","严重",G,"领域顾问"),
 ("L2-d-1","count(torque_samples) >= 8",["平行测定值组数"],"GB/T 1231-2010","严重",W,"领域顾问"),
 ("L2-d-2","count(tensile_specimens) >= 2",["平行测定值组数"],"GB/T 228.1-2021","一般",W,"领域顾问"),
 ("L2-d-3","nonempty(heat_no, sampling_position)",["炉（批）号"],"GB/T 228.1 取样位置","一般",W,"领域顾问"),
 ("L2-d-4","exists(crm_check)  # 硬度块 / 扭矩标准件 / 成分 CRM",["CRM或标准块核查"],"GB/T 3098.1 / CNAS-CL01 7.7","一般",W,"领域顾问"),
 ("L2-d-5","if deviation_exceeded then exists(recheck) && nonempty(disposition)",["复检仲裁时效"],"GB/T 1231 / 抽检细则","提示",W+","+G,"领域顾问"),
 ("L2-d-6","months(last_test_date, now) <= cycle(type)  # 手套/靴 6，杆/验电器 12",["上次预防性试验日期"],"DL/T 976-2017 / 企业工器具管理规定","严重",T,"领域顾问"),
 ("L2-d-7","A、Z in grade_band(强度等级)",["实测值","规格型号"],"GB/T 228.1","提示",W,"领域顾问"),
 ("L2-d-8","HRC in band(Rm)  # 硬度-强度换算区间",["实测值"],"GB/T 3098.1","一般",W,"领域顾问"),
 ("L2-d-9","loading_rate in allowed_band(method)",["试验设备编号与量程"],"GB/T 228.1","一般",W,"领域顾问"),
 ("L2-d-10","verify(stress == force / nominal_area)",["实测值"],"GB/T 228.1","严重",W,"领域顾问"),
 ("L2-d-11","cited_device == used_device",["试验设备编号与量程"],"原始记录","一般",G,"领域顾问"),
 ("L3-a-1","nonempty(test_standard) && has_year(test_standard)",["标准号年号"],"GB/T / DL/T 标准清单","严重",G,"产品"),
 ("L3-a-2","cited_std == test_standard",["标准号年号"],"报告模板","一般",G,"领域顾问"),
 ("L3-a-3","judgment uses limit_of(cited_version)",["标准号年号","标准限值"],"GB/T / DL/T 标准清单","严重",G,"领域顾问"),
 ("L3-b-1","Rm >= limit_min(Rm) && Rm > Rp0.2",["实测值","标准限值"],"GB/T 3098.1 / GB/T 228.1","严重",W,"领域顾问"),
 ("L3-b-2","0.110 <= mean(T) <= 0.150 && std(T) <= 0.0074",["实测值","标准限值","平行测定值组数"],"GB/T 1231-2010","严重",W,"领域顾问"),
 ("L3-b-3","P >= P_min(grade, spec)",["实测值","标准限值","规格型号"],"GB/T 1231-2010","严重",W,"领域顾问"),
 ("L3-b-4","no_breakdown && I_leak <= limit(type) && hold_time >= 60s",["实测值","标准限值","规格型号"],"DL/T 976-2017 / GB/T 17622","严重",T,"领域顾问"),
 ("L3-b-5","min(measure_points) >= lower_limit  # 镀层/尺寸/形位",["实测值","标准限值"],"GB/T 12346 / GB/T 9793","一般",W,"领域顾问"),
]

PLACEHOLDERS = [
 ("L3-c-1","method_used == method_of(cited_standard)",["检测方法"],"标准指定方法 / 方法库","一般",G,"领域顾问"),
 ("L3-d-1","mandatory_items(standard) ⊆ report_items",["实测值"],"标准强制项清单","严重",G,"领域顾问"),
 ("L4-a-1","hash(report_values) == hash(raw_record) && ts_ok",["实测值"],"原始记录 / 设备日志","严重",G,"后端"),
 ("L4-b-1","tester in qualified_personnel(items)",["检测人员"],"人员资质库","严重",G,"领域顾问"),
 ("L4-c-1","method in CMA_scope",["资质认定范围表","检测方法"],"CMA 资质认定附表","严重",G,"领域顾问"),
 ("L4-d-1","nonempty(trace_code) && verify(trace_code)",["报告模板版本"],"报告透明度 / 溯源码","一般",G,"产品"),
]

def pack(rule_id, expr, fields, std, sev, domain, owner):
  grp = rule_id.rsplit("-", 1)[0]
  # L3-c/d、L4-a/b/d 为空桶占位；L4-c-1 为现行规则
  is_ph = rule_id in ("L3-c-1", "L3-d-1", "L4-a-1", "L4-b-1", "L4-d-1")
  return {
    "规则ID": rule_id,
    "规则组": grp,
    "类别": THEME[grp],
    "级别": LEVEL_OF[grp],
    "判定式": expr,
    "所需字段": fields,
    "标准依据": std,
    "严重度": sev,
    "适用领域": domain.split(","),
    "状态": "待审核员确认",
    "版本": "v0.4",
    "负责人": owner,
    "备注": (
      f"占位：{grp} {THEME[grp]}；MVP 不消费，分期启用"
      if is_ph
      else "判定式由 3.2.1 描述推导，待领域顾问校准；规则 ID = Ln-x-n"
    ),
  }

assert len(R) == 44, len(R)
assert len(PLACEHOLDERS) == 6, len(PLACEHOLDERS)
recs = [pack(*row) for row in R] + [pack(*row) for row in PLACEHOLDERS]
assert len(recs) == 50, len(recs)
# uniqueness
ids = [r["规则ID"] for r in recs]
assert len(ids) == len(set(ids)), "duplicate rule ids"

json.dump({"create_records":recs}, open("docs/feishu/lims-ai-review/ledger_seed.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
print("wrote ledger_seed.json", len(recs), "— dry seed only; live Base 已改 Ln-x-n，勿重复 batch-create")
if "--push" in sys.argv:
  p = subprocess.run(["lark-cli","base","+record-batch-create","--base-token",BASE,"--table-id",TABLE,
                      "--json",json.dumps({"create_records":recs},ensure_ascii=False),"--as","user"],
                     capture_output=True, text=True, env=ENV)
  out = json.loads(p.stdout) if p.stdout.strip() else {}
  print("created:", len(out.get("data",{}).get("records",[]) or out.get("data",{}).get("record_id_list",[]) or []),
        "| ok:", out.get("ok"), "| err:", str(out.get("error"))[:200], p.stderr[:200])
print("BASE", BASE, "TABLE", TABLE)
