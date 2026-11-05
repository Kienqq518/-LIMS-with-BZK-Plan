# -*- coding: utf-8 -*-
import sys, math; sys.path.insert(0,'/tmp/twfig')
from gen_lib import *
from gen_scene106 import scene106, EXTRA

svg,ov = scene106(k=1.85, ox=842, oy=-284)

# ---- 实时数据曲线（SVG 折线，双序列）----
def chart():
    W,Hh=388,176; px0,py0,px1,py1=44,14,W-14,Hh-26
    def y(v): return py1-(v-9.0)/(14.0-9.0)*(py1-py0)
    def x(i,n): return px0+i*(px1-px0)/(n-1)
    s1=[11.2,11.5,11.4,11.9,12.2,12.0,12.4,12.7,12.5,12.9,12.6,12.4,12.8,13.1,12.9,12.4]
    s2=[0.86,0.84,0.83,0.80,0.78,0.77,0.75,0.74,0.73,0.72,0.71,0.71,0.70,0.71,0.71,0.71]
    grid=''.join('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#EDF1F6"/>'%(px0,y(v),px1,y(v)) for v in [9,10,11,12,13,14])
    lbl=''.join('<text x="34" y="%.1f" text-anchor="end" font-size="10" fill="#8A97A7" font-family="Fira Code">%s</text>'%(y(v)+3,v) for v in [9,11,13])
    labels=['13:32','13:47','14:02','14:17','14:32']
    xl=''.join('<text x="%.1f" y="%d" text-anchor="middle" font-size="10" fill="#8A97A7" font-family="Fira Code">%s</text>'%(px0+i*(px1-px0)/(len(labels)-1),Hh-8,t)
               for i,t in enumerate(labels))
    p1=' '.join('%.1f,%.1f'%(x(i+1,len(s1)),y(v)) for i,v in enumerate(s1))
    p2=' '.join('%.1f,%.1f'%(x(i+1,len(s2)),py0+(v-0.68)/(0.90-0.68)*(py1-py0)*0.62+18) for i,v in enumerate(s2))
    area='<polygon points="%s %.1f,%.1f %.1f,%.1f" fill="rgba(40,120,255,.10)"/>'%(p1,x(len(s1),len(s1)),py1,x(1,len(s1)),py1)
    lim='<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="#E5484D" stroke-width="1.6" stroke-dasharray="5 4"/>'%(px0,y(10.0),px1,y(10.0))
    dot='<circle cx="%.1f" cy="%.1f" r="4.5" fill="#2878FF" stroke="#fff" stroke-width="2"/>'%(x(len(s1),len(s1)),y(s1[-1]))
    return ('<svg width="%d" height="%d">%s%s%s%s<polyline points="%s" fill="none" stroke="#2878FF" stroke-width="2.2" stroke-linejoin="round"/>'
            '<polyline points="%s" fill="none" stroke="#8B5CF6" stroke-width="2.2" stroke-dasharray="0"/>'
            '<circle cx="%.1f" cy="%.1f" r="4.5" fill="#8B5CF6" stroke="#fff" stroke-width="2"/></svg>'
            %(W,Hh,grid,lbl,xl,area+lim+dot,p1,p2,x(len(s2),len(s2)),py0+(s2[-1]-0.68)/(0.90-0.68)*(py1-py0)*0.62+18))

KV=[('设备编号','EQ-106-05'),('设备名称','机械性能无人化检测工位'),('型号 / 厂家','UTM-200 · 国产（外形待厂家确认）'),
    ('所属区域','106 无人化电缆试验区 · A 区'),('设备类别','检测设备（1:1 绑定数采分系统）'),('责任人','检测四组 · 王工'),
    ('启用日期','2025-03-18'),('下次校准','2026-12-20 · 剩余 45 天')]
kv=''.join(f'<dt>{k}</dt><dd>{v}</dd>' for k,v in KV)

TASK=[('任务编号','TK-2026-1105-018'),('样品','SPL-2611-0342 · 电缆样品（中压交联）'),
      ('当前工位','检测 Z-106-TEST · 68%'),('判定规则','机械性能 V3 · 抗拉强度 ≥ 10.0 N/mm²')]
task=''.join(f'<dt>{k}</dt><dd>{v}</dd>' for k,v in TASK)

DAQ=[('g','分系统在线','DAQ-SUB-106-05 · 心跳 1.4s'),('b','上位机握手','已获取任务与参数（E7）'),
     ('g','数据推送','最近上报 14:32:06 · 2s 前'),('a','条码衔接','扫码触发正常 · 1 次待重试')]
daq=''.join(f'<div class="arow"><span class="dot {c}"></span><span style="color:var(--t1)">{t}</span><span style="margin-left:auto;font-size:11px;color:var(--t3)">{d}</span></div>' for c,t,d in DAQ)

REC=[('A','绝缘层厚度 0.71mm 低于下限','14:31','未处置'),('B','待检样品 6 件 · 队列瓶颈','14:22','处理中'),
     ('C','夹具气压波动 0.52MPa','11:08','已处置')]
rec=''.join('<div class="arow"><span class="pill %s">Grade %s</span><span>%s</span><span class="t">%s</span><span class="btn %s" style="margin-left:10px">%s</span></div>'
            %({'A':'red','B':'org','C':'amb'}[lv],lv,d,tm,('pri' if st=='未处置' else 'gho'),st) for lv,d,tm,st in REC)

body = nav("总览") + f"""<style>{EXTRA}
.modal{{left:380px;top:104px}}
.mh h2{{font-size:16px;font-weight:700}}
.mbody{{display:flex;gap:20px;padding:16px 22px 0}}
.mcol{{display:flex;flex-direction:column;gap:16px}}
.blk{{border:1px solid var(--line);border-radius:14px;padding:13px 16px}}
.blk .kv{{row-gap:8px}}
.blk h4{{font-size:13px;font-weight:700;margin-bottom:10px;display:flex;align-items:center}}
.blk h4 .r{{margin-left:auto;font-size:11px;color:var(--t3);font-weight:400}}
.legend2{{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;color:var(--t3);margin-top:10px}}.legend2 span{{white-space:nowrap}}
.legend2 i{{width:14px;height:3px;border-radius:2px;display:inline-block;vertical-align:3px;margin-right:5px}}
.mfoot{{display:flex;align-items:center;gap:10px;padding:16px 22px;border-top:1px solid var(--line);margin-top:18px}}
.mfoot .hint{{font-size:11px;color:var(--t3);margin-left:auto}}
.lims{{width:420px}}
</style>
<div class="scene card" style="left:22px;top:86px;width:1396px;height:656px;overflow:hidden;opacity:.55">{svg}</div>
<div class="rail" style="top:86px;opacity:.55">
  <div class="card pnl"><div class="hd"><h3>当前实验任务</h3><span class="sub">调度系统</span></div>
    <div class="row" style="gap:8px"><span class="pill soft">LIMS 下发</span><span class="num" style="font-size:13px;font-weight:600">TK-2026-1105-018</span></div></div>
</div>
<div class="scrim"></div>
<div class="modal">
  <div class="mh"><span class="pill ghost" style="height:26px">106 · A 区</span>
    <h2>机械性能无人化检测工位</h2><span class="num" style="color:var(--t3);font-size:12px">EQ-106-05 · Z-106-TEST</span>
    <span class="dot g" style="margin-left:6px"></span><span style="font-size:12px;color:var(--t2)">运行中</span>
    <span class="seg" style="margin-left:18px"><i class="on">运行</i><i>告警</i><i>离线</i><i>维护</i></span>
    <span class="x">✕</span></div>
  <div class="mbody">
    <div class="mcol" style="width:420px;flex:0 0 auto">
      <div class="blk"><h4>基本信息<span class="r">设备台账 · equip-mgmt</span></h4><dl class="kv">{kv}</dl></div>
      <div class="blk"><h4>当前任务<span class="r">调度系统 · 任务编排</span></h4><dl class="kv">{task}</dl>
        <div class="row" style="margin-top:12px"><div class="bar" style="width:100%"><i style="width:68%"></i></div><span class="num" style="font-size:11px;color:var(--t2)">68%</span></div></div>
      <div class="blk"><h4>所属 LIMS 任务<span class="r">二期深链 · 当前灰态</span></h4>
        <div class="row" style="gap:8px;flex-wrap:wrap"><span class="pill soft">委托 WT-2026-1105-006</span><span class="pill soft">报告 BJ-2026-1105-011</span>
        <span class="pill off">跳转 LIMS 详情</span></div>
        <div style="font-size:11px;color:var(--t3);margin-top:9px;line-height:1.7">V1 仅呈现孪生侧任务对象与来源标记（source=LIMS / WORKSTATION），深链跳转列为二期。</div></div>
    </div>
    <div class="mcol lims">
      <div class="blk"><h4>实时数据曲线<span class="r">采控主系统 · 2s 采样</span>
        </h4><div class="row" style="margin-bottom:8px"><span class="seg"><i>1h</i><i>6h</i><i class="on">24h</i></span>
        <span class="pill ghost" style="margin-left:auto">窗口 13:32–14:32</span></div>
        {chart()}
        <div class="legend2"><span><i style="background:#2878FF"></i>抗拉强度 N/mm²</span><span><i style="background:#8B5CF6"></i>绝缘层厚度 mm</span>
        <span><i style="background:#E5484D"></i>下限 10.0</span><span style="margin-left:auto" class="num">stale 0 · missing 0</span></div></div>
      <div class="blk"><h4>数采分系统状态<span class="r">与检测设备 1:1</span></h4>{daq}</div>
      <div class="blk"><h4>最近告警<span class="r">24h 回溯</span></h4>{rec}</div>
    </div>
  </div>
  <div class="mfoot"><span class="btn pri">安灯呼叫</span><span class="btn sec">查看原始记录</span><span class="btn gho">忽略</span>
    <span class="btn dan">立即停机</span><span class="hint">关闭后状态回落数据源，不做前端本地隐藏</span><span class="btn gho" style="margin-left:14px">关闭</span></div>
</div>"""
print(write("03-device-detail.html", page("device", body, "设备详情弹层")))
