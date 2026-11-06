# -*- coding: utf-8 -*-
import json, subprocess, os, sys
ENV = {**os.environ, "LARKSUITE_CLI_NO_UPDATE_NOTIFIER":"1", "LARKSUITE_CLI_NO_SKILLS_NOTIFIER":"1"}
meta = json.load(open("docs/feishu/lims-ai-review/base.json", encoding="utf-8"))
BASE = meta["base"]["base_token"]; TABLE = meta["table"]["id"]
G = "通用"; W = "电网物资"; T = "安全工器具"
R = [  # (id, 组, 类别, 判定式, 所需字段, 标准依据, 严重度, 领域, 负责人)
 ("A01-1","A01","A 数据完整性","nonempty(sample_id) && match(sample_id, 编号规则)",["抽样单号"],"LIMS 编号规则 / 抽检细则","严重",G,"产品"),
 ("A01-2","A01","A 数据完整性","nonempty(sample_name) && nonempty(spec_model)",["规格型号"],"GB/T 1231 规格标记 / 委托单","严重",W+","+T,"产品"),
 ("A01-3","A01","A 数据完整性","nonempty(client) && nonempty(manufacturer) && nonempty(batch_no)",["炉（批）号"],"抽检细则","一般",G,"产品"),
 ("A01-4","A01","A 数据完整性","nonempty(sampling_date, receive_date, sample_ticket, heat_no)",["抽样单号","炉（批）号"],"抽检细则","严重",G,"产品"),
 ("A01-5","A01","A 数据完整性","nonempty(sample_status) && nonempty(seal_state)",["封样状态"],"抽检细则","一般",W,"产品"),
 ("A01-6","A01","A 数据完整性","nonempty(test_standard) && has_year(test_standard)",["标准号年号"],"GB/T / DL/T 标准清单","严重",G,"产品"),
 ("A02-1","A02","A 数据完整性","set(entrust_items) ⊆ set(result.params)",["实测值"],"委托单","严重",G,"后端"),
 ("A02-2","A02","A 数据完整性","nonempty(raw_record)",["实测值"],"CMA 资质认定评审要求","严重",G,"后端"),
 ("A02-3","A02","A 数据完整性","nonempty(device_no, device_range)",["试验设备编号与量程"],"GB/T 228.1 / GB/T 1231","一般",W,"后端"),
 ("A02-4","A02","A 数据完整性","nonempty(test_date, tester)",["检测人员"],"CMA 资质认定评审要求","一般",G,"后端"),
 ("A02-5","A02","A 数据完整性","if sensitive(items) then nonempty(temp, humidity)",["环境温湿度"],"GB/T 228.1 室温要求","轻微",W,"后端"),
 ("A03-1","A03","A 数据完整性","cert_expire(device) >= test_date",["设备校准有效期"],"计量法 / JJG 检定规程","严重",G,"领域顾问"),
 ("A03-2","A03","A 数据完整性","count(torque_samples) >= 8",["平行测定值组数"],"GB/T 1231-2010","严重",W,"领域顾问"),
 ("A03-3","A03","A 数据完整性","count(tensile_specimens) >= 2",["平行测定值组数"],"GB/T 228.1-2021","一般",W,"领域顾问"),
 ("A03-4","A03","A 数据完整性","nonempty(heat_no, sampling_position)",["炉（批）号"],"GB/T 228.1 取样位置","一般",W,"领域顾问"),
 ("A03-5","A03","A 数据完整性","exists(crm_check)  # 硬度块 / 扭矩标准件 / 成分 CRM",["CRM或标准块核查"],"GB/T 3098.1 / CNAS-CL01 7.7","一般",W,"领域顾问"),
 ("A03-6","A03","A 数据完整性","if deviation_exceeded then exists(recheck) && nonempty(disposition)",["复检仲裁时效"],"GB/T 1231 / 抽检细则","提示",W+","+G,"领域顾问"),
 ("B01-1","B01","B 逻辑一致性","sampling_date <= receive_date <= test_date <= report_date",["抽样单号"],"抽检细则","严重",G,"领域顾问"),
 ("B01-2","B01","B 逻辑一致性","calib_from <= test_date <= calib_to",["设备校准有效期"],"计量法","严重",G,"领域顾问"),
 ("B01-3","B01","B 逻辑一致性","months(last_test_date, now) <= cycle(type)  # 手套/靴 6，杆/验电器 12",["上次预防性试验日期"],"DL/T 976-2017 / 企业工器具管理规定","严重",T,"领域顾问"),
 ("B01-4","B01","B 逻辑一致性","(test_date - receive_date) <= limit_period",["复检仲裁时效"],"抽检细则","一般",G,"领域顾问"),
 ("B01-5","B01","B 逻辑一致性","report_date >= raw_record_date",["报告模板版本"],"CMA 评审要求","一般",G,"领域顾问"),
 ("B02-1","B02","B 逻辑一致性","Rm >= limit_min(Rm) && Rm > Rp0.2",["实测值","标准限值"],"GB/T 3098.1 / GB/T 228.1","严重",W,"领域顾问"),
 ("B02-2","B02","B 逻辑一致性","A、Z in grade_band(强度等级)",["实测值","规格型号"],"GB/T 228.1","提示",W,"领域顾问"),
 ("B02-3","B02","B 逻辑一致性","0.110 <= mean(T) <= 0.150 && std(T) <= 0.0074",["实测值","标准限值","平行测定值组数"],"GB/T 1231-2010","严重",W,"领域顾问"),
 ("B02-4","B02","B 逻辑一致性","P >= P_min(grade, spec)",["实测值","标准限值","规格型号"],"GB/T 1231-2010","严重",W,"领域顾问"),
 ("B02-5","B02","B 逻辑一致性","HRC in band(Rm)  # 硬度-强度换算区间",["实测值"],"GB/T 3098.1","一般",W,"领域顾问"),
 ("B02-6","B02","B 逻辑一致性","no_breakdown && I_leak <= limit(type) && hold_time >= 60s",["实测值","标准限值","规格型号"],"DL/T 976-2017 / GB/T 17622","严重",T,"领域顾问"),
 ("B02-7","B02","B 逻辑一致性","min(measure_points) >= lower_limit  # 镀层/尺寸/形位",["实测值","标准限值"],"GB/T 12346 / GB/T 9793","一般",W,"领域顾问"),
 ("B02-8","B02","B 逻辑一致性","loading_rate in allowed_band(method)",["试验设备编号与量程"],"GB/T 228.1","一般",W,"领域顾问"),
 ("B02-9","B02","B 逻辑一致性","verify(stress == force / nominal_area)",["实测值"],"GB/T 228.1","严重",W,"领域顾问"),
 ("B03-1","B03","B 逻辑一致性","cited_std == test_standard",["标准号年号"],"报告模板","一般",G,"领域顾问"),
 ("B03-2","B03","B 逻辑一致性","cited_device == used_device",["试验设备编号与量程"],"原始记录","一般",G,"领域顾问"),
 ("B03-3","B03","B 逻辑一致性","method in CMA_scope",["资质认定范围表","检测方法"],"CMA 资质认定附表","严重",G,"领域顾问"),
 ("B03-4","B03","B 逻辑一致性","judgment uses limit_of(cited_version)",["标准号年号","标准限值"],"GB/T / DL/T 标准清单","严重",G,"领域顾问"),
 ("C01-1","C01","C 格式规范性","sig_figs(value) == required_sig_figs(param)",["实测值"],"GB/T 8170-2008","轻微",G,"产品"),
 ("C01-2","C01","C 格式规范性","rounding_interval(value) == standard_interval(param)",["实测值"],"GB/T 8170 / GB/T 228.1","轻微",W,"产品"),
 ("C01-3","C01","C 格式规范性","decimals(values) consistent within one table",["实测值"],"报告模板","提示",G,"产品"),
 ("C01-4","C01","C 格式规范性","unit in {MPa,kN,HRC,μm,kV,mA} && unit matches param",["实测值"],"报告模板","一般",G,"产品"),
 ("C01-5","C01","C 格式规范性","round_mode == GB8170",["实测值"],"GB/T 8170-2008","轻微",G,"产品"),
 ("C02-1","C02","C 格式规范性","match(report_id, 编号规则)",["报告模板版本"],"LIMS 编号规则","一般",G,"产品"),
 ("C02-2","C02","C 格式规范性","all_required_sections_present(照片, 抽样单, 原始记录)",["报告模板版本"],"报告模板","一般",W,"产品"),
 ("C02-3","C02","C 格式规范性","logo_used && signatory in authorized_scope",["资质认定范围表"],"CNAS-CL01 7.8 / CMA","严重",G,"产品"),
 ("C02-4","C02","C 格式规范性","pages == 1..N continuous",["报告模板版本"],"报告模板","提示",G,"产品"),
 ("C02-5","C02","C 格式规范性","nonempty(tester, reviewer, approver)",["签名位"],"CNAS-CL01 7.8","严重",G,"产品"),
]
assert len(R) == 45, len(R)
recs = [{"规则ID":i,"规则组":g,"类别":c,"判定式":f,"所需字段":fl,"标准依据":st,
         "严重度":sv,"适用领域":d.split(","),"状态":"待审核员确认","版本":"v0.1","负责人":o,
         "备注":"判定式由 3.2.1 描述推导，待领域顾问校准"} for i,g,c,f,fl,st,sv,d,o in R]
json.dump({"create_records":recs}, open("docs/feishu/lims-ai-review/ledger_seed.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
p = subprocess.run(["lark-cli","base","+record-batch-create","--base-token",BASE,"--table-id",TABLE,
                    "--json",json.dumps({"create_records":recs},ensure_ascii=False),"--as","user"],
                   capture_output=True, text=True, env=ENV)
out = json.loads(p.stdout) if p.stdout.strip() else {}
print("created:", len(out.get("data",{}).get("records",[]) or out.get("data",{}).get("record_id_list",[]) or []),
      "| ok:", out.get("ok"), "| err:", str(out.get("error"))[:200], p.stderr[:200])
print("BASE", BASE, "TABLE", TABLE)
