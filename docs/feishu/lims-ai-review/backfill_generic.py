# -*- coding: utf-8 -*-
import json, os, subprocess
ENV={**os.environ,"LARKSUITE_CLI_NO_UPDATE_NOTIFIER":"1","LARKSUITE_CLI_NO_SKILLS_NOTIFIER":"1"}
meta=json.load(open("docs/feishu/lims-ai-review/base.json",encoding="utf-8"))
cm=json.load(open("docs/feishu/lims-ai-review/category_meta.json",encoding="utf-8"))
BASE=meta["base"]["base_token"]; RULE=meta["table"]["id"]; BIND=cm["bind_table"]; CAT=cm["cat_table"]
SPEC=set(cm["SPEC"]); PARAM=cm["PARAM"]
PARAM.update({"C01-1":'{"sigfig_map":"map(param)"}',"C01-4":'{"unit_set":"map(param)"}',"B03-4":'{"limit_version":"enum"}'})
def run(a):
    p=subprocess.run(a,capture_output=True,text=True,env=ENV)
    try: d=json.loads(p.stdout)
    except Exception: return {"ok":False,"raw":(p.stdout or p.stderr)[:250]}
    if not d.get("ok"): print("  !!",a[2],str(d.get("error"))[:180])
    return d
d=run(["lark-cli","base","+record-list","--base-token",BASE,"--table-id",RULE,"--page-size","200","--format","json","--as","user"])
data=d["data"]; cols=data["fields"]; ids=data["record_id_list"]; rows=data["data"]
i_id=cols.index("规则ID")
upd={}
for rid_v,rec in zip([r[i_id] for r in rows], ids):
    tag = "品类专属" if rid_v in SPEC else "通用"
    upd[rec]={"是否通用":[tag]}
    if rid_v in PARAM: upd[rec]["param_schema"]=PARAM[rid_v]
run(["lark-cli","base","+record-batch-update","--base-token",BASE,"--table-id",RULE,"--format","json","--as","user",
     "--json",json.dumps({"update_records":upd},ensure_ascii=False)])
print("backfilled:",len(upd))
# 视图
v=run(["lark-cli","base","+view-create","--base-token",BASE,"--table-id",BIND,"--as","user",
       "--json",json.dumps({"type":"grid","name":"按品类看启用"},ensure_ascii=False)])
run(["lark-cli","base","+view-set-group","--base-token",BASE,"--table-id",BIND,"--view-id","按品类看启用","--as","user",
     "--json",'{"group_config":[{"field":"category_code","desc":false}]}'])
run(["lark-cli","base","+view-create","--base-token",BASE,"--table-id",CAT,"--as","user",
     "--json",json.dumps({"type":"grid","name":"未配置品类"},ensure_ascii=False)])
run(["lark-cli","base","+view-set-filter","--base-token",BASE,"--table-id",CAT,"--view-id","未配置品类","--as","user",
     "--json",'{"logic":"and","conditions":[["是否已配绑定","==","否"]]}'])
# 复核分组计数
for tbl,name in [(RULE,"审核规则"),(BIND,"品类规则绑定"),(CAT,"品类")]:
    dd=run(["lark-cli","base","+record-list","--base-token",BASE,"--table-id",tbl,"--page-size","200","--format","json","--as","user"])
    print(name,"rows:",len(dd["data"]["data"]))
c=run(["lark-cli","base","+record-list","--base-token",BASE,"--table-id",RULE,"--page-size","200","--format","json","--as","user"])
cl=c["data"]["fields"]; vals=[r[cl.index("是否通用")] for r in c["data"]["data"]]
from collections import Counter
print("是否通用分布:",Counter(tuple(v) if isinstance(v,list) else v for v in vals))
