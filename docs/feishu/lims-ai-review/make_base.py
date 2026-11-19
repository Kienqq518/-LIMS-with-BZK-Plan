import json, subprocess, sys, os
ENV = {**os.environ, "LARKSUITE_CLI_NO_UPDATE_NOTIFIER": "1", "LARKSUITE_CLI_NO_SKILLS_NOTIFIER": "1"}
def run(args):
    p = subprocess.run(args, capture_output=True, text=True, env=ENV)
    if p.returncode != 0: sys.exit("FAIL: " + (p.stderr or p.stdout)[:400])
    return json.loads(p.stdout)

# 对齐飞书 §2.3「审什么」（与 make_records.FIELD_OPTS 一致）
REQ_FIELDS = [
  "样品编号","报告编号","签名位","签章与骑缝章","委托方信息","受检方信息",
  "接收日期","采样日期","检测日期","报告日期","报告章节结构","样品信息章节","检测依据章节","检测设备章节",
  "测试结果章节","结论章节","备注章节","计量单位","模板格式参数","正文文本",
  "委托检测项目","实测结果","平行/重复测定值","设备校准有效期","设备量程","规格型号","衍生计算值","判定结论",
  "引用标准号","标准年号版本","标准适用范围","标准限值","检测方法","强制检测项清单",
  "原始记录哈希","原始记录时间戳","人员资质","CMA资质范围","透明度溯源码","校准证书编号",
]
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
 {"type":"select","name":"所需字段","multiple":True,"options":[{"name":n} for n in REQ_FIELDS],"description":"对齐飞书 §2.3「审什么」检查点所需数据项"},
 {"type":"text","name":"标准依据","description":"§2.3 审什么依据 + GB/T、DL/T 等条款"},
 {"type":"select","name":"严重度","multiple":False,"options":[{"name":"严重","hue":"Red","lightness":"Light"},{"name":"一般","hue":"Orange"},{"name":"轻微","hue":"Yellow"},{"name":"提示","hue":"Gray"}]},
 {"type":"select","name":"适用领域","multiple":True,"options":[{"name":"通用"},{"name":"电网物资"},{"name":"安全工器具"}]},
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
