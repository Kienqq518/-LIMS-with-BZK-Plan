# -*- coding: utf-8 -*-
import sys; sys.path.insert(0,'/tmp/twfig')
from gen_lib import *
from gen_scene106 import scene106, EXTRA

svg,ov = scene106(k=1.85, ox=842, oy=-284)

DEV=[('106-05','机械性能无人化检测工位','g','运行中'),('106-06','绝缘层厚度检测工位','r','告警'),
     ('106-07','热延伸试验智能检测系统','g','运行中'),('106-04','热收缩检测工位','g','运行中'),
     ('106-01','哑铃样制工位','g','运行中'),('106-02','径向样制工位','b','待机'),
     ('106-03','热收缩样制工位','a','维护'),('106-08','复合机器人 1','g','前往检测台'),
     ('106-09','复合机器人 2','b','充电 62%'),('106-11','尺寸测量小工位','m','离线'),
     ('106-12','AGV 上料试验桌','g','已就位'),('106-13','检测上下料试验桌','g','载料'),
     ('106-14','载具存储货架','b','12/20'),('106-10','智能砝码库','b','待机')]
chips=''.join(f'<span class="dchip{" sel" if i==0 else ""}"><span class="dot {c}"></span><span class="num">{d}</span>{n}</span>' for i,(d,n,c,s) in enumerate(DEV))

STEPS=[('done','预处理','Z-106-PREP 哑铃样制工位','14:06 完成'),
       ('done','制样','Z-106-SAMP 径向样制工位','14:18 完成'),
       ('now','检测','Z-106-TEST 机械性能无人化检测工位','进行中 · 68%'),
       ('err','测量','Z-106-MEAS 尺寸测量小工位','离线 · 待恢复')]
steps=''.join(f'<div class="step {cls}"><div class="no">{"✓" if cls=="done" else ("!" if cls=="err" else "3" if cls=="now" else "4")}</div>'
              f'<div class="tx"><b>{t} <span style="font-weight:400;color:var(--t3)">· {dev}</span></b><span>{tm}</span></div></div>'
              for cls,t,dev,tm in STEPS)

PARAMS=[('抗拉强度','12.4','N/mm²','≥ 10.0','ok'),('拉断伸长率','9.8','%','≥ 8.0','ok'),
        ('热延伸（150℃/15min）','86','%','≤ 100','ok'),('绝缘层厚度','0.71','mm','≥ 0.70','bad')]
def prow(p):
    n,v,u,lim,st=p
    c='var(--green)' if st=='ok' else 'var(--red)'
    return (f'<div class="prow"><span>{n}</span><span class="num" style="color:{c};font-weight:600">{v}<em>{u}</em></span>'
            f'<span class="lim">限值 {lim}</span><span class="pill {"ghost" if st=="ok" else "red"}">{"合格" if st=="ok" else "超限"}</span></div>')

ALARMS=[('A','绝缘层厚度检测工位','读数 0.71mm 低于下限','14:31','未处置'),
        ('B','机械性能无人化检测工位','待检样品 6 件 · 等待 18min','14:22','处理中')]
def arow(a):
    lv,dv,rs,tm,st=a
    col={'A':'red','B':'org','C':'amb'}[lv]
    return (f'<div class="arow2"><span class="pill {col}">Grade {lv}</span><div class="t2"><b>{dv}</b><span>{rs}</span></div>'
            f'<span class="num tm">{tm}</span><span class="btn {"pri" if st=="未处置" else "gho"}">{"立即处置" if st=="未处置" else "查看进度"}</span></div>')

body = nav("总览") + f"""<style>{EXTRA}
.focusbar{{position:absolute;left:0;top:64px;width:1920px;height:46px;display:flex;align-items:center;gap:12px;padding:0 22px;
  background:rgba(255,255,255,.86);border-bottom:1px solid var(--line);backdrop-filter:blur(8px);z-index:8}}
.focusbar .back{{height:30px;padding:0 14px;border-radius:999px;border:1px solid var(--line);display:flex;align-items:center;color:var(--t2);font-size:12px}}
.focusbar h2{{font-size:15px;font-weight:700}}
.focusbar .zh{{font-size:11px;color:var(--t3)}}
.btm2{{position:absolute;left:22px;bottom:22px;display:flex;gap:16px}}
.prow{{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:12px;color:var(--t2)}}
.prow em{{font-style:normal;font-size:11px;color:var(--t3);margin-left:4px}}
.prow .lim{{margin-left:auto;font-size:11px;color:var(--t3)}}
.arow2{{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--line)}}
.arow2 .t2{{flex:1;min-width:0}}.arow2 .t2 b{{display:block;font-size:12px;color:var(--t1)}}
.arow2 .t2 span{{font-size:11px;color:var(--t3)}}.arow2 .tm{{font-size:11px;color:var(--t3)}}
.batt{{height:6px;width:88px;border-radius:999px;background:var(--grey);overflow:hidden}}.batt i{{display:block;height:100%;background:var(--blue)}}
</style>
<div class="focusbar"><span class="back">← 返回全景</span><h2>106 · 无人化电缆试验区</h2>
  <span class="zh">S2 重点监控 · 14 台在册设备 · 3 条数据流</span>
  <span class="pill soft" style="margin-left:8px">任务编排：调度系统</span><span class="pill ghost">上下料握手：E9</span>
  <span style="margin-left:auto" class="seg"><i class="on">实时</i><i>回放</i></span></div>

<div class="scene card" style="left:22px;top:120px;width:1396px;height:656px;overflow:hidden">
  <div style="position:absolute;left:16px;top:14px;z-index:7;font-size:13px;font-weight:700">106 实时轴测
    <span style="font-weight:400;color:var(--t3);font-size:11px"> · 高亮运行设备 / AMR 路径 / 复合机器人</span></div>
  <div class="dim" style="right:16px;top:12px;z-index:8"><i>人 Man</i><i class="on">机 Machine</i><i>料 Material</i><i>法 Method</i><i>环 Environment</i></div>
  {svg}{ov}
  <div class="camchip" style="right:16px;bottom:16px"><span class="num">S2 机位</span><span>俯角 42° · zoom 1.9× · 允许 ±8° 环绕</span>
    <span class="pill ghost">背景区域已淡化</span></div>
</div>

<div class="rail" style="top:120px;align-items:flex-start">
  <div class="card pnl">
    <div class="hd"><h3>当前实验任务</h3><span class="sub">调度系统 · 任务编排</span></div>
    <div class="row" style="gap:8px;margin-bottom:10px"><span class="pill soft">LIMS 下发</span>
      <span class="num" style="font-size:13px;font-weight:600">TK-2026-1105-018</span><span class="pill red" style="margin-left:auto">Grade A ×1</span></div>
    <div class="kv" style="grid-template-columns:72px 1fr;row-gap:8px;margin-bottom:14px">
      <dt>样品</dt><dd class="num">SPL-2611-0342 · 电缆样品（中压交联）</dd>
      <dt>类型</dt><dd>机械性能 + 绝缘层厚度</dd><dt>受理</dt><dd>WT-2026-1105-006 · 委托单</dd></div>
    <div style="font-size:11px;color:var(--t3);margin-bottom:8px">流程进度 · 4 工位链路</div>
    {steps}
    <div style="font-size:11px;color:var(--t3);margin:14px 0 2px">关键参数（判定规则 V3）</div>
    {''.join(prow(p) for p in PARAMS)}
    <div class="row" style="margin-top:12px;gap:8px"><span class="btn pri">暂停上料</span><span class="btn gho">转人工</span>
      <span class="pill ghost" style="margin-left:auto">下一步：测量工位待恢复</span></div>
  </div>
  <div class="card pnl">
    <div class="hd"><h3>机器人在场</h3><span class="sub">机器人调度系统</span></div>
    <div class="arow"><span class="dot g"></span><span style="color:var(--t1)">复合机器人 1</span><span class="num" style="color:var(--t3);font-size:11px">RB-C-01</span>
      <span style="margin-left:auto;font-size:11px;color:var(--blue)">前往 检测台 1</span><span class="batt"><i style="width:84%"></i></span><span class="num" style="font-size:11px">84%</span></div>
    <div class="arow"><span class="dot b"></span><span style="color:var(--t1)">复合机器人 2</span><span class="num" style="color:var(--t3);font-size:11px">RB-C-02</span>
      <span style="margin-left:auto;font-size:11px;color:var(--t2)">充电位 1</span><span class="batt"><i style="width:62%"></i></span><span class="num" style="font-size:11px">62%</span></div>
    <div class="arow"><span class="dot g"></span><span style="color:var(--t1)">AMR 上料</span><span class="num" style="color:var(--t3);font-size:11px">RB-A-01</span>
      <span style="margin-left:auto;font-size:11px;color:var(--t2)">载货 3 件 · 102→106</span><span class="batt"><i style="width:71%"></i></span><span class="num" style="font-size:11px">71%</span></div>
  </div>
</div>

<div class="btm2">
  <div class="card pnl" style="width:884px">
    <div class="hd"><h3>设备状态条</h3><span class="sub">14 台在册 · 运行 6 / 待机 4 / 告警 1 / 维护 1 / 离线 1</span></div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">{chips}</div>
  </div>
  <div class="card pnl" style="width:496px">
    <div class="hd"><h3>告警区</h3><span class="sub">24h 内 5 条 · 未处置 1</span></div>
    {''.join(arow(a) for a in ALARMS)}
    <div style="text-align:right;margin-top:10px"><span class="btn sec">查看全部告警</span></div>
  </div>
</div>"""
print(write("02-zone-106.html", page("zone106", body, "S2 · 106 重点区监控")))
