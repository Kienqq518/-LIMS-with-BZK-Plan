import json, subprocess, sys, os
ENV = {**os.environ, "LARKSUITE_CLI_NO_UPDATE_NOTIFIER": "1", "LARKSUITE_CLI_NO_SKILLS_NOTIFIER": "1"}
def run(args):
    p = subprocess.run(args, capture_output=True, text=True, env=ENV)
    if p.returncode != 0: sys.exit("FAIL: " + (p.stderr or p.stdout)[:400])
    return json.loads(p.stdout)

REQ_FIELDS = ["抽样单号","炉（批）号","规格型号","封样状态","试验设备编号与量程","环境温湿度","检测人员",
              "平行测定值组数","CRM或标准块核查","设备校准有效期","上次预防性试验日期","复检仲裁时效",
              "实测值","标准限值","资质认定范围表","检测方法","报告模板版本","标准号年号","签名位"]
GROUPS = [f"L{n}-{s}" for n in (1,2,3,4) for s in "abcd"]
THEMES = [
  "编号","签名","字段齐全","单位与格式",
  "日期链","委托项↔结果","设备校准覆盖","内部勾稽",
  "标准现行有效","限值符合","方法完整性","项目完整性",
  "原始记录哈希/时间戳","人员资质","CMA 范围","透明度溯源码",
]
LEVELS = ["L1 基础形式","L2 数据逻辑","L3 合规对齐","L4 溯源验证"]
fields = [
 {"type":"text","name":"规则ID","description":"稳定键 Ln-x-n（如 L1-a-1）；引擎/绑定用。浏览维度看「级别 / 规则组 / 类别」"},
 {"type":"select","name":"级别","multiple":False,"description":"四级审核范围（飞书 §2.3）",
  "options":[{"name":n} for n in LEVELS]},
 {"type":"select","name":"规则组","multiple":False,"description":"Ln-a/b/c/d：级别下「审什么」各类别的规则组编码",
  "options":[{"name":n} for n in GROUPS]},
 {"type":"select","name":"类别","multiple":False,"description":"由飞书 §2.3「审什么」总结的检查主题；与规则组一一对应",
  "options":[{"name":n} for n in THEMES]},
 {"type":"text","name":"判定式","description":"确定性 if-then 表达式（伪代码）"},
 {"type":"select","name":"所需字段","multiple":True,"options":[{"name":n} for n in REQ_FIELDS],"description":"对应 3.7 字段依赖清单"},
 {"type":"text","name":"标准依据","description":"GB/T、DL/T 等条款或限值出处"},
 {"type":"select","name":"严重度","multiple":False,"options":[{"name":"严重","hue":"Red","lightness":"Light"},{"name":"一般","hue":"Orange"},{"name":"轻微","hue":"Yellow"},{"name":"提示","hue":"Gray"}]},
 {"type":"select","name":"适用领域","multiple":True,"options":[{"name":"电网物资"},{"name":"安全工器具"},{"name":"通用"}]},
 {"type":"select","name":"状态","multiple":False,"default_value":["待审核员确认"],
  "options":[{"name":"待审核员确认","hue":"Orange"},{"name":"已确认","hue":"Blue"},{"name":"已上线","hue":"Green","lightness":"Light"},{"name":"停用","hue":"Gray"}]},
 {"type":"text","name":"版本","default_value":"v0.3"},
 {"type":"text","name":"负责人","description":"按角色填写，不填人名"},
 {"type":"text","name":"备注"},
]
r = run(["lark-cli","base","+base-create","--name","LIMS-AI Review 规则台账","--time-zone","Asia/Shanghai",
         "--table-name","审核规则","--fields",json.dumps(fields,ensure_ascii=False),"--as","user"])
data = r.get("data", {})
print(json.dumps({k:v for k,v in data.items() if k in ("base_token","app_token","table_id","url","name")}, ensure_ascii=False))
open("docs/feishu/lims-ai-review/base.json","w",encoding="utf-8").write(json.dumps(data,ensure_ascii=False,indent=1))
