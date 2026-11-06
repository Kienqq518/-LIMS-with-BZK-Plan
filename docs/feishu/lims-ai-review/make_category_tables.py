# -*- coding: utf-8 -*-
import json, os, subprocess, sys
ENV={**os.environ,"LARKSUITE_CLI_NO_UPDATE_NOTIFIER":"1","LARKSUITE_CLI_NO_SKILLS_NOTIFIER":"1"}
meta=json.load(open("docs/feishu/lims-ai-review/base.json",encoding="utf-8"))
BASE=meta["base"]["base_token"]; RULE_TBL=meta["table"]["id"]
def run(args, inp=None):
    p=subprocess.run(args,capture_output=True,text=True,env=ENV)
    try: d=json.loads(p.stdout)
    except Exception: return {"ok":False,"raw":(p.stdout or p.stderr)[:300]}
    if not d.get("ok"): print("  !!", args[2], str(d.get("error"))[:200])
    return d
def T(name, fields):
    return run(["lark-cli","base","+table-create","--base-token",BASE,"--name",name,
                "--fields",json.dumps(fields,ensure_ascii=False),"--as","user"])
SEL=lambda n,opts,m=False:{"type":"select","name":n,"multiple":m,"options":[{"name":o} for o in opts]}
TXT=lambda n:{"type":"text","name":n}

# ---- 1. 品类表 ----
cat=T("品类",[TXT("category_code"),TXT("品类名称"),SEL("来源",["LIMS"]),TXT("父级编码"),
             SEL("是否已配绑定",["是","否"]),TXT("同步时间"),TXT("备注")])
CAT_ID=cat.get("data",{}).get("table",{}).get("id") or cat.get("data",{}).get("table_id")
cats=[("CAT-BOLT","高强度螺栓连接副","是"),("CAT-GLOVE","绝缘手套","是"),("CAT-CABLE","电力电缆","是"),
      ("CAT-CONDUIT","电缆保护管","否"),("CAT-HARNESS","安全带","否"),("CAT-CON-WIRE","导线 / 金具","否")]
run(["lark-cli","base","+record-batch-create","--base-token",BASE,"--table-id",CAT_ID,"--as","user","--json",
     json.dumps({"create_records":[{"category_code":c,"品类名称":n,"来源":"LIMS","是否已配绑定":b,
       "同步时间":"2026-11-06","备注":"编码为占位，待 Week 1 用 LIMS 实际物料分类码替换" if b=="否" else "编码为占位，待 Week 1 用 LIMS 实际物料分类码替换"} for c,n,b in cats]},ensure_ascii=False)])

# ---- 2. 品类规则绑定表 ----
UNIV=[f"A01-{i}" for i in range(1,7)]+[f"A02-{i}" for i in range(1,5)]+["A03-1"]+[f"B01-{i}" for i in (1,2,4,5)]+\
     [f"B03-{i}" for i in range(1,5)]+[f"C01-{i}" for i in (1,3,4,5)]+[f"C02-{i}" for i in range(1,6)]
SPEC=["A02-5","A03-2","A03-3","A03-4","A03-5","A03-6","B01-3"]+[f"B02-{i}" for i in range(1,10)]+["C01-2"]
assert len(UNIV)==28 and len(SPEC)==17, (len(UNIV),len(SPEC))
PARAM={"A02-5":'{"sensitive_items":"list"}',"A03-2":'{"parallel_count":"int","std_max":"float"}',
 "A03-3":'{"tensile_specimens":"int"}',"A03-4":'{"traceability_field":"enum(heat_no|reel_no|batch_no|segment_no)"}',
 "A03-5":'{"crm_types":"list"}',"A03-6":'{"recheck_rule":"enum(double_sample|stop_and_scrap)"}',
 "B01-3":'{"cycle_months":"int"}',"B02-1":'{"limit_ref":"enum"}',"B02-3":'{"t_min":"float","t_max":"float","std_max":"float"}',
 "B02-4":'{"p_min_map":"map(grade,spec)"}',"B02-5":'{"hrc_band":"map(grade)"}',
 "B02-6":'{"voltage":"float","leak_limit":"map(type)","hold_min":"int"}',"B02-7":'{"lower_map":"map(param)","points":"int"}',
 "B02-8":'{"rate_band":"map(method)"}',"B02-9":'{"formula":"enum(stress|resistance_corr)"}',"C01-2":'{"interval_map":"map(param)"}'}
# (启用, 参数覆盖, 严重度覆盖, 标准依据)
M={"CAT-BOLT":{"A02-5":(1,'{"sensitive_items":["拉伸","扭矩系数"]}',"","GB/T 228.1"),"A03-2":(1,'{"parallel_count":8,"std_max":0.0074}',"","GB/T 1231-2010"),
 "A03-3":(1,'{"tensile_specimens":2}',"","GB/T 228.1-2021"),"A03-4":(1,'{"traceability_field":"heat_no"}',"","抽检细则"),
 "A03-5":(1,'{"crm_types":["标准硬度块","扭矩系数标准件"]}',"","GB/T 3098.1"),"A03-6":(1,'{"recheck_rule":"double_sample"}',"","GB/T 1231"),
 "B01-3":(0,"","",""),"B02-1":(1,'{"limit_ref":"GB/T 3098.1 10.9 级 Rm"}',"","GB/T 3098.1"),"B02-2":(0,"","",""),
 "B02-3":(1,'{"t_min":0.110,"t_max":0.150,"std_max":0.0074}',"","GB/T 1231-2010"),"B02-4":(1,'{"p_min_map":"按等级×规格"}',"","GB/T 1231-2010"),
 "B02-5":(1,'{"hrc_band":"10.9 级 HRC 32–39"}',"","GB/T 3098.1"),"B02-6":(0,"","",""),"B02-7":(1,'{"lower_map":"镀锌层厚度/重量","points":"多点取最小值"}',"","GB/T 12346"),
 "B02-8":(1,'{"rate_band":"GB/T 228.1 应力速率"}',"","GB/T 228.1"),"B02-9":(1,'{"formula":"stress=force/area"}',"","GB/T 228.1"),
 "C01-2":(1,'{"interval_map":"抗拉强度 1 MPa；扭矩系数 3 位小数"}',"","GB/T 8170")},
 "CAT-GLOVE":{"A02-5":(1,'{"sensitive_items":["工频耐压（湿度影响泄漏电流）"]}',"","DL/T 976-2017"),"A03-2":(0,"","","逐只试验，无平行组数概念"),
 "A03-3":(0,"","",""),"A03-4":(1,'{"traceability_field":"batch_no"}',"","工器具台账"),"A03-5":(0,"","",""),
 "A03-6":(0,'{"recheck_rule":"stop_and_scrap"}',"提示","不合格直接停用不复检"),"B01-3":(1,'{"cycle_months":6}','严重',"DL/T 976-2017 / 企业工器具管理规定"),
 "B02-1":(0,"","",""),"B02-2":(0,"","",""),"B02-3":(0,"","",""),"B02-4":(0,"","",""),"B02-5":(0,"","",""),
 "B02-6":(1,'{"voltage":"按类型","leak_limit":"按类型","hold_min":60}','严重',"GB/T 17622 / DL/T 976-2017"),
 "B02-7":(0,"","",""),"B02-8":(0,"","",""),"B02-9":(0,"","",""),"C01-2":(1,'{"interval_map":"kV 1 位小数；mA 整数"}',"","DL/T 976-2017")},
 "CAT-CABLE":{"A02-5":(1,'{"sensitive_items":["导体直流电阻（须记温度换算 20℃）"]}',"","GB/T 3956"),"A03-2":(1,'{"parallel_count":"每批盘数/试样长度"}',"","GB/T 12706 抽样规定"),
 "A03-3":(0,"","",""),"A03-4":(1,'{"traceability_field":"reel_no"}',"","抽检细则"),"A03-5":(0,"","",""),
 "A03-6":(1,'{"recheck_rule":"double_sample"}',"","抽检细则"),"B01-3":(0,"","",""),"B02-1":(0,"","",""),
 "B02-2":(0,"","",""),"B02-3":(0,"","",""),"B02-4":(0,"","",""),"B02-5":(0,"","",""),
 "B02-6":(1,'{"voltage":"按型号","leak_limit":"含局部放电量限值","hold_min":5}','严重',"GB/T 12706 / GB/T 3048.12"),
 "B02-7":(1,'{"lower_map":"绝缘/护套厚度","points":"多点取最小值"}',"","GB/T 12706"),"B02-8":(0,"","",""),
 "B02-9":(1,'{"formula":"resistance_corr_20C"}',"","GB/T 3956 / GB/T 3048.4"),"C01-2":(1,'{"interval_map":"电阻 0.01 Ω；厚度 0.1 mm"}',"","GB/T 8170")}}
rows=[]
for cc in ["CAT-BOLT","CAT-GLOVE","CAT-CABLE"]:
    for rid in SPEC:
        en,ov,sv,ref=M[cc].get(rid,(0,"","",""))
        rows.append({"绑定ID":f"BLT-{cc}-{rid}","category_code":cc,"rule_id":rid,"启用":"是" if en else "否",
                     "参数覆盖":ov,"严重度覆盖":sv or "不覆盖","标准依据":ref,
                     "状态":"待审核员确认","版本":"v0.1"})
assert len(rows)==51, len(rows)
bd=T("品类规则绑定",[TXT("绑定ID"),TXT("category_code"),TXT("rule_id"),SEL("启用",["是","否"]),
   TXT("参数覆盖"),SEL("严重度覆盖",["严重","一般","轻微","提示","不覆盖"]),TXT("标准依据"),
   SEL("状态",["待审核员确认","已确认","已上线","停用"]),TXT("版本")])
BIND_ID=bd.get("data",{}).get("table",{}).get("id") or bd.get("data",{}).get("table_id")
r=run(["lark-cli","base","+record-batch-create","--base-token",BASE,"--table-id",BIND_ID,"--as","user",
       "--json",json.dumps({"create_records":rows},ensure_ascii=False)])
print("bindings created:", r.get("ok"), "| rows:", len(rows))
for f in [TXT("param_schema"),{"type":"select","name":"是否通用","multiple":False,"options":[{"name":"通用","hue":"Gray"},{"name":"品类专属","hue":"Blue"}]}]:
    run(["lark-cli","base","+field-create","--base-token",BASE,"--table-id",RULE_TBL,"--as","user","--json",json.dumps(f,ensure_ascii=False)])
print("SPEC_IDS", json.dumps(SPEC), "UNIV_N", len(UNIV))
json.dump({"cat_table":CAT_ID,"bind_table":BIND_ID,"SPEC":SPEC,"UNIV":UNIV,"PARAM":PARAM},
          open("docs/feishu/lims-ai-review/category_meta.json","w",encoding="utf-8"),ensure_ascii=False)
