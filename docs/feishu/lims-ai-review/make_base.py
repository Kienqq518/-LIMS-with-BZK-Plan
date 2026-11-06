import json, subprocess, sys, os
ENV = {**os.environ, "LARKSUITE_CLI_NO_UPDATE_NOTIFIER": "1", "LARKSUITE_CLI_NO_SKILLS_NOTIFIER": "1"}
def run(args):
    p = subprocess.run(args, capture_output=True, text=True, env=ENV)
    if p.returncode != 0: sys.exit("FAIL: " + (p.stderr or p.stdout)[:400])
    return json.loads(p.stdout)

REQ_FIELDS = ["抽样单号","炉（批）号","规格型号","封样状态","试验设备编号与量程","环境温湿度","检测人员",
              "平行测定值组数","CRM或标准块核查","设备校准有效期","上次预防性试验日期","复检仲裁时效",
              "实测值","标准限值","资质认定范围表","检测方法","报告模板版本","标准号年号","签名位"]
fields = [
 {"type":"text","name":"规则ID","description":"如 A01-1，与 3.2.1 规则组对应"},
 {"type":"select","name":"规则组","multiple":False,"options":[{"name":n} for n in ["A01","A02","A03","B01","B02","B03","C01","C02"]]},
 {"type":"select","name":"类别","multiple":False,"options":[{"name":"A 数据完整性"},{"name":"B 逻辑一致性"},{"name":"C 格式规范性"}]},
 {"type":"text","name":"判定式","description":"确定性 if-then 表达式（伪代码）"},
 {"type":"select","name":"所需字段","multiple":True,"options":[{"name":n} for n in REQ_FIELDS],"description":"对应 3.7 字段依赖清单"},
 {"type":"text","name":"标准依据","description":"GB/T、DL/T 等条款或限值出处"},
 {"type":"select","name":"严重度","multiple":False,"options":[{"name":"严重","hue":"Red","lightness":"Light"},{"name":"一般","hue":"Orange"},{"name":"轻微","hue":"Yellow"},{"name":"提示","hue":"Gray"}]},
 {"type":"select","name":"适用领域","multiple":True,"options":[{"name":"电网物资"},{"name":"安全工器具"},{"name":"通用"}]},
 {"type":"select","name":"状态","multiple":False,"default_value":["待审核员确认"],
  "options":[{"name":"待审核员确认","hue":"Orange"},{"name":"已确认","hue":"Blue"},{"name":"已上线","hue":"Green","lightness":"Light"},{"name":"停用","hue":"Gray"}]},
 {"type":"text","name":"版本","default_value":"v0.1"},
 {"type":"text","name":"负责人","description":"按角色填写，不填人名"},
 {"type":"text","name":"备注"},
]
r = run(["lark-cli","base","+base-create","--name","LIMS-AI Review 规则台账","--time-zone","Asia/Shanghai",
         "--table-name","审核规则","--fields",json.dumps(fields,ensure_ascii=False),"--as","user"])
data = r.get("data", {})
print(json.dumps({k:v for k,v in data.items() if k in ("base_token","app_token","table_id","url","name")}, ensure_ascii=False))
open("docs/feishu/lims-ai-review/base.json","w",encoding="utf-8").write(json.dumps(data,ensure_ascii=False,indent=1))
