# -*- coding: utf-8 -*-
import sys; sys.path.insert(0,'/tmp/twfig')
from gen_lib import *
from gen_scene106 import scene106, EXTRA, box_of, H

svg,_ = scene106(k=1.40, ox=584, oy=-211, w=950, h=520, with_overlay=False)

LIST=[('A','106-06 绝缘层厚度检测工位','读数 0.71mm 低于下限 0.70mm','14:31','未处置','sel'),
      ('B','106-05 机械性能无人化检测工位','待检样品 6 件 · 等待 18min','14:22','处理中',''),
      ('C','108 环境试验区','相对湿度 58%RH 接近上限 60%RH','13:58','已处置',''),
      ('C','106-03 热收缩样制工位','夹具气压波动 0.52MPa','11:08','已处置',''),
      ('B','105 智能高压室','150kV 耐压系统 通讯中断 12s','10:41','已处置',''),
      ('A','106-11 尺寸测量小工位','数采分系统离线 · 无上报','10:12','处理中',''),
      ('C','102 智能样品室','RFID 读写失败 2 次','09:36','已处置',''),
      ('B','110 数智化电气试验区','金具温升工位 温度 78K 接近限值','08:52','已处置','')]
def lrow(a):
    lv,dv,rs,tm,st,sel=a
    col={'A':'red','B':'org','C':'amb'}[lv]
    return (f'<div class="al {sel}"><span class="pill {col}">{lv}</span><div class="b"><b>{dv}</b><span>{rs}</span>'
            f'<div class="m"><span class="num">{tm}</span><span class="st {"un" if st=="未处置" else ("ing" if st=="处理中" else "ok")}">{st}</span>'
            f'<span class="num" style="margin-left:auto">影响 1 样品 · 1 任务</span></div></div></div>')

STEPS=[('触发','14:31:04','绝缘层厚度 0.71mm < 0.70mm（判定规则 V3）','g'),
       ('自动处置','14:31:05','调度系统暂停上料 · 设备转待机','b'),
       ('派发','14:31:06','Grade A → 主任台 + 手机 App；运维队列 #1','b'),
       ('现场复核','14:36:20','待复核：样品 SPL-2611-0342 复测','a'),
       ('恢复','—','未恢复 · 已持续 1min','m')]
def step(s):
    t,tm,d,c=s
    return (f'<div class="tl"><span class="no {c}"></span><div class="tx"><b>{t} <span class="num">{tm}</span></b><span>{d}</span></div></div>')

SNAP=[('14:31:04','0.71','mm','12.4','N/mm²','0.52','MPa'),
      ('14:30:56','0.72','mm','12.4','N/mm²','0.55','MPa'),
      ('14:30:48','0.73','mm','12.3','N/mm²','0.54','MPa')]
snap=''.join(f'<tr><td class="id">{t}</td><td class="num" style="color:var(--red);font-weight:600">{v1} {u1}</td><td class="num">{v2} {u2}</td><td class="num">{v3} {u3}</td></tr>' for t,v1,u1,v2,u2,v3,u3 in SNAP)

TICKS="".join("<s style=\"left:%d%%\"></s>"%p for p in [12,26,40,54,68,82,94])
SPARK="".join(("<i class=\"hi\" " if v>26 else "<i ") + "style=\"height:%dpx\"></i>"%v for v in [6,3,4,8,12,9,5,7,18,28,22,10,6,4,9,14])
body = nav("告警") + f"""<style>{EXTRA}
.fbar{{position:absolute;left:0;top:64px;width:1920px;height:48px;display:flex;align-items:center;gap:10px;padding:0 22px;
  background:rgba(255,255,255,.88);border-bottom:1px solid var(--line);backdrop-filter:blur(8px);z-index:8}}
.fbar h2{{font-size:15px;font-weight:700;margin-right:8px}}
.fbar .lbl{{font-size:11px;color:var(--t3);margin-left:8px}}
.al{{display:flex;gap:10px;padding:12px;border-radius:12px;border:1px solid transparent;cursor:default}}
.al.sel{{background:#F5F9FF;border-color:var(--blue);box-shadow:0 0 0 3px rgba(40,120,255,.10)}}
.al+.al{{margin-top:6px}}
.al .b{{flex:1;min-width:0}}.al .b b{{font-size:12px;display:block;color:var(--t1)}}
.al .b>span{{font-size:11px;color:var(--t2);display:block;margin-top:3px}}
.al .m{{display:flex;align-items:center;gap:10px;margin-top:7px;font-size:11px;color:var(--t3)}}
.st{{padding:1px 8px;border-radius:999px;font-size:11px}}.st.un{{background:var(--red);color:#fff}}
.st.ing{{background:var(--chip);color:var(--blue)}}.st.ok{{background:var(--icon);color:var(--t3)}}
.tl{{display:flex;gap:12px;position:relative;padding-bottom:11px}}
.tl:before{{content:"";position:absolute;left:5px;top:13px;bottom:0;width:2px;background:var(--line)}}
.tl:last-child:before{{display:none}}
.tl .no{{width:12px;height:12px;border-radius:50%;margin-top:3px;flex:0 0 auto;box-shadow:0 0 0 3px #fff}}
.no.g{{background:var(--red)}}.no.b{{background:var(--blue)}}.no.a{{background:var(--amber)}}.no.m{{background:var(--t3)}}
.tl .tx b{{font-size:12px;color:var(--t1)}}.tl .tx b span{{color:var(--t3);font-weight:400;margin-left:8px}}
.tl .tx>span{{display:block;font-size:11px;color:var(--t2);margin-top:2px}}
.scrub{{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid var(--line)}}
.track{{flex:1;height:6px;border-radius:999px;background:var(--grey);position:relative}}
.track i{{position:absolute;left:0;top:0;bottom:0;width:62%;border-radius:999px;background:var(--blue)}}
.track b{{position:absolute;left:62%;top:-5px;width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid var(--blue);box-shadow:var(--pill)}}
.track s{{position:absolute;top:-3px;width:2px;height:12px;background:#C9D2DC;text-decoration:none}}
.gcard{{position:absolute;display:flex;flex-direction:column;gap:0}}
.stat{{display:flex;align-items:baseline;gap:8px;padding:10px 0;border-top:1px solid var(--line);font-size:12px;color:var(--t2)}}
.stat b{{font-family:"Fira Code",monospace;font-size:20px;font-weight:700;color:var(--t1);width:52px}}
.spark{{display:flex;align-items:flex-end;gap:4px;height:44px}}
.spark i{{width:12px;border-radius:3px 3px 0 0;background:var(--blue-soft);display:block}}
.spark i.hi{{background:var(--red)}}
</style>
<div class="fbar"><h2>告警回溯</h2><span class="lbl">范围</span><span class="seg"><i class="on">近 24h</i><i>近 7 日</i></span>
  <span class="lbl">等级</span><span class="pill red">A ×2</span><span class="pill org">B ×3</span><span class="pill amb">C ×3</span>
  <span class="lbl">区域</span><span class="pill ghost">106 无人化电缆试验区 ▾</span><span class="pill ghost">状态：全部 ▾</span>
  <span style="margin-left:auto" class="btn gho">导出回溯报告</span></div>

<div class="card" style="position:absolute;left:22px;top:130px;width:430px;height:928px;padding:14px">
  <div class="hd" style="display:flex;align-items:center;margin-bottom:10px"><h3 style="font-size:14px;font-weight:700">告警列表</h3>
    <span class="sub" style="margin-left:auto;font-size:11px;color:var(--t3)">8 条 · 按时间倒序</span></div>
  {''.join(lrow(a) for a in LIST)}
</div>

<div class="card" style="position:absolute;left:468px;top:130px;width:950px;height:600px;overflow:hidden">
  <div style="position:absolute;left:16px;top:12px;z-index:7;font-size:13px;font-weight:700">告警现场 · 106-06 绝缘层厚度检测工位
    <span style="font-weight:400;color:var(--t3);font-size:11px"> · 回放 14:28–14:34</span></div>
  <div style="position:absolute;right:16px;top:12px;z-index:7" class="row"><span class="pill red">Grade A</span><span class="seg"><i class="on">回放</i><i>实时</i></span></div>
  <div style="position:absolute;left:0;top:0">{svg}</div>
  <div style="position:absolute;left:560px;top:232px;z-index:5">
    <div class="beats" style="color:#E5484D;width:186px"><div class="k">绝缘层厚度 · 回放</div><div class="v">0.71<span class="u">mm</span></div>
      <div style="font-size:11px;color:var(--t3);margin-top:6px">下限 0.70 · 判定 V3</div></div></div>
  <div class="scrub" style="position:absolute;left:0;right:0;bottom:0;background:rgba(255,255,255,.94)">
    <span class="btn pri" style="width:34px;justify-content:center">▶</span>
    <span class="num" style="font-size:12px;color:var(--t2)">14:31:04</span>
    <div class="track"><i></i>{TICKS}<b></b></div>
    <span class="num" style="font-size:12px;color:var(--t3)">14:34:00</span>
    <span class="seg"><i>0.5×</i><i class="on">1×</i><i>4×</i></span>
    <span class="pill ghost">关键帧 3</span></div>
</div>

<div class="card" style="position:absolute;left:468px;top:746px;width:950px;height:312px;padding:16px">
  <div style="display:flex;gap:24px;height:100%">
    <div style="width:390px"><div class="hd" style="margin-bottom:12px"><h3 style="font-size:14px;font-weight:700">处置记录</h3>
      <span class="sub" style="margin-left:auto;font-size:11px;color:var(--t3)">来源：调度 / 采控 / 安灯</span></div>
      {''.join(step(s) for s in STEPS)}</div>
    <div style="flex:1"><div class="hd" style="margin-bottom:10px"><h3 style="font-size:14px;font-weight:700">触发时刻数据快照</h3>
      <span class="sub" style="margin-left:auto;font-size:11px;color:var(--t3)">数采分系统 DAQ-SUB-106-06</span></div>
      <table class="tbl"><thead><tr><th>时间</th><th>绝缘层厚度</th><th>抗拉强度</th><th>夹具气压</th></tr></thead><tbody>{snap}</tbody></table>
      <div class="row" style="margin-top:12px;gap:8px"><span class="pill soft">影响样品 SPL-2611-0342</span>
        <span class="pill soft">影响任务 TK-2026-1105-018</span><span class="btn sec" style="margin-left:auto">查看原始记录</span></div></div>
  </div>
</div>

<div class="rail" style="left:1434px;right:auto;top:130px">
  <div class="card pnl"><div class="hd"><h3>分级统计</h3><span class="sub">近 24h</span></div>
    <div class="stat"><b style="color:var(--red)">2</b><span>Grade A · 主任台 + App</span><span style="margin-left:auto;font-size:11px;color:var(--t3)">均值 6min</span></div>
    <div class="stat"><b style="color:var(--orange)">3</b><span>Grade B · 工位屏</span><span style="margin-left:auto;font-size:11px;color:var(--t3)">均值 14min</span></div>
    <div class="stat"><b style="color:var(--amber)">3</b><span>Grade C · 运维队列</span><span style="margin-left:auto;font-size:11px;color:var(--t3)">均值 22min</span></div>
    <div style="font-size:11px;color:var(--t3);margin-top:12px;line-height:1.7">未处置 1 · 处理中 2 · 已处置 5<br>SLA：A ≤ 15min（当前达标 1/2）</div></div>
  <div class="card pnl"><div class="hd"><h3>24h 告警分布</h3><span class="sub">每小时</span></div>
    <div class="spark">{SPARK}</div>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-top:6px" class="num"><span>00:00</span><span>08:00</span><span>14:00</span></div></div>
  <div class="card pnl"><div class="hd"><h3>关联对象</h3><span class="sub">孪生对象模型</span></div>
    <div class="arow"><span class="dot r"></span><span style="color:var(--t1)">设备</span><span class="num" style="margin-left:auto">106-06 绝缘层厚度检测工位</span></div>
    <div class="arow"><span class="dot o"></span><span style="color:var(--t1)">任务</span><span class="num" style="margin-left:auto">TK-2026-1105-018</span></div>
    <div class="arow"><span class="dot a"></span><span style="color:var(--t1)">样品</span><span class="num" style="margin-left:auto">SPL-2611-0342</span></div>
    <div class="arow"><span class="dot g"></span><span style="color:var(--t1)">AMR 上料</span><span class="num" style="margin-left:auto">RB-A-01 · 载货 3 件</span></div>
    <div class="arow"><span class="dot b"></span><span style="color:var(--t1)">复合机器人</span><span class="num" style="margin-left:auto">RB-C-01 · 前往 检测台 1</span></div>
  </div>
</div>"""
print(write("04-alarm-review.html", page("alarm", body, "S3 · 告警回溯")))
