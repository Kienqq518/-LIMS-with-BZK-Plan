# -*- coding: utf-8 -*-
import sys; sys.path.insert(0,'/tmp/twfig')
from gen_lib import *

K=0.82; SCX,SCY=1396,656
OX,OY = 762, 66
iso=Iso(k=K, ox=OX, oy=OY, wall=14)
ALARM={'106':('2','A×1 · B×1'),'108':('1','C×1')}
ZSTAT={'106':'focus','108':'alarm'}

def room_svg():
    out=[]
    order=sorted(room_boxes(), key=lambda r:(r[1]+r[3]))  # 远→近
    for rid,u1,v1,u2,v2,nm in order:
        focus = ZSTAT.get(rid)=='focus'; alarm = rid in ALARM
        top = '#FFFFFF' if not focus else '#F2F7FF'
        stroke = ('#2878FF',2) if focus else (('#E5484D',1.6) if alarm else ('#DCE3EC',1))
        h = 16 if focus else 14
        out.append(f'<g data-room="{rid}">{iso_room(iso,u1,v1,u2,v2,h,top,"#EDF0F4","#E3E8EF",stroke[0],stroke[1])}')
        for eid,enm,a,b,c,d,cat in eq_boxes(rid):
            if cat not in ('equipment','furniture'): continue
            hh = 9 if (c-a)>18 else 6
            sel = ' stroke="#E5484D" stroke-width="1.6"' if (rid=='106' and eid=='106-06') else ''
            out.append(iso_box(iso,a,b,c,d,hh,'#FFFFFF','#E8EBEF','#DDE2E8',('#C9D2DC',0.8),1,'',1))
        out.append('</g>')
    return ''.join(out)

def guides():
    g=[guide_line(iso,372,150,372,588,w=2.4),guide_line(iso,180,584,544,584,w=2.4),
       guide_line(iso,150,352,176,352,w=2),guide_line(iso,180,180,368,180,w=1.8,dash='6 7',op=.7),
       guide_line(iso,180,540,368,540,w=1.8,dash='6 7',op=.7)]
    return '<g opacity=".9">'+''.join(g)+'</g>'

def zone_labels():
    out=[]
    for rid,u1,v1,u2,v2,nm in room_boxes():
        cu,cv=(u1+u2)/2,(v1+v2)/2
        badge=ALARM.get(rid)
        cls='zfocus' if ZSTAT.get(rid)=='focus' else ('zalarm' if badge else '')
        jump = {"106": " data-goto='zone106'", "108": " data-goto='alarm'"}.get(rid, " data-todo='%s：V1 只做 S1 总览与 S2 的 106 机位'" % nm)
        html=f'''<div class="zone {cls}"{jump}><b class="num">{rid}</b><span>{nm}</span>'''
        if badge: html+=f'<i class="zb num">{badge[0]} 告警</i>'
        html+='</div>'
        out.append(at(iso,cu,cv,20,html,'zl '+cls))
    return ''.join(out)

EXTRA_CSS="""
.zone{display:flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:12px;background:rgba(255,255,255,.92);
  border:1px solid var(--line);box-shadow:var(--pill);white-space:nowrap;backdrop-filter:blur(6px)}
.zone b{font-size:13px;font-weight:700;color:var(--t1)}
.zone span{font-size:11px;color:var(--t2)}
.zone .zb{margin-left:2px;font-style:normal;font-size:11px;height:20px;line-height:20px;padding:0 8px;border-radius:999px;background:var(--red);color:#fff}
.zone.zfocus{border-color:var(--blue);box-shadow:0 0 0 4px rgba(40,120,255,.12),var(--pill)}
.zone.zfocus b{color:var(--blue)}
.zone.zalarm{border-color:rgba(229,72,77,.6)}
.zl{z-index:4}
.dimhint{position:absolute;right:22px;top:56px;z-index:7;font-size:11px;color:var(--t3);background:rgba(255,255,255,.9);border:1px solid var(--line);border-radius:999px;padding:5px 12px}
.bt-anchor{position:absolute;z-index:5}
.bt-anchor:after{content:"";position:absolute;left:88px;top:104px;width:2px;height:56px;background:#B7C4D2}
.bt-anchor .beats{color:#8B5CF6}
.legend{position:absolute;left:22px;bottom:18px;display:flex;gap:14px;align-items:center;font-size:11px;color:var(--t2);
  background:rgba(255,255,255,.9);border:1px solid var(--line);border-radius:999px;padding:7px 14px;box-shadow:var(--pill);z-index:6}
.legend i{width:10px;height:10px;border-radius:3px;display:inline-block;margin-right:5px;vertical-align:-1px}
.camchip{position:absolute;right:22px;bottom:18px;display:flex;gap:10px;align-items:center;font-size:11px;color:var(--t3);
  background:rgba(255,255,255,.9);border:1px solid var(--line);border-radius:999px;padding:7px 14px;box-shadow:var(--pill);z-index:6}
.kpi{padding:14px 16px 12px;border-radius:14px;background:#fff;border:1px solid var(--line);box-shadow:var(--pill);width:206px}
.kpi .k{font-size:11px;color:var(--t3)}
.kpi .v{font-size:26px;font-weight:800;letter-spacing:-.6px;margin-top:3px;font-family:"Fira Code",monospace}
.kpi .u{font-size:11px;color:var(--t3);font-weight:400;margin-left:4px;font-family:"PingFang SC",sans-serif}
.kpi .d{font-size:12px;margin-left:8px;font-weight:600}
.kpi .s{font-size:10px;color:var(--t3);margin-top:6px}
.up{color:var(--green)}.dn{color:var(--blue)}.rd{color:var(--red)}
.rail{position:absolute;right:22px;top:86px;width:458px;display:flex;flex-direction:column;gap:16px}
.pnl{padding:16px}
.pnl .hd{display:flex;align-items:center;margin-bottom:12px}
.pnl .hd .sub{margin-left:auto;font-size:11px;color:var(--t3)}
.arow{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:12px;color:var(--t2)}
.arow .id{font-family:"Fira Code",monospace;color:var(--t1);width:34px}
.arow .t{margin-left:auto;font-family:"Fira Code",monospace;font-size:11px;color:var(--t3)}
.btm{position:absolute;left:22px;bottom:22px;width:1396px;height:294px;padding:0 0 12px}
.btm .tabs2{display:flex;gap:6px;padding:14px 16px 10px}
.tabs2 i{font-style:normal;height:28px;padding:0 14px;border-radius:999px;display:flex;align-items:center;font-size:12px;color:var(--t2);border:1px solid var(--line);background:#fff}
.tabs2 i.on{background:var(--blue);color:#fff;border-color:var(--blue);font-weight:600}
.tabs2 .cnt{margin-left:auto;font-style:normal;font-size:11px;color:var(--t3);display:flex;align-items:center}
"""

TASKS=[("TK-2026-1105-018","SPL-2611-0342","106","机械性能无人化检测工位","运行中","g",68,"14:32","LIMS"),
       ("TK-2026-1105-017","SPL-2611-0341","106","热延伸试验智能检测系统","运行中","g",41,"14:31","LIMS"),
       ("TK-2026-1105-016","SPL-2611-0338","109","电缆径向全自动制样机","待上料","a",100,"14:20","工位"),
       ("TK-2026-1105-015","SPL-2611-0336","107","电子万能试验机","运行中","g",77,"14:08","LIMS"),
       ("TK-2026-1105-013","SPL-2611-0327","105","150kV 智慧工频耐压系统","告警","r",23,"13:41","LIMS")]
def _trow(t):
    idn,spl,zone,dev,st,cl,pct,tm,src=t
    color={'g':'var(--green)','a':'var(--amber)','m':'var(--t3)','r':'var(--red)'}[cl]
    return (f'<tr><td class="id">{idn}</td><td><span class="pill {"soft" if src=="LIMS" else "ghost"}">{src}</span></td>'
            f'<td class="id">{spl}</td><td class="num">{zone}</td><td>{dev}</td>'
            f'<td><span class="dot {cl}"></span> {st}</td>'
            f'<td><div class="bar"><i style="width:{pct}%;background:{color}"></i></div></td>'
            f'<td class="num">{pct}%</td><td class="num">{tm}</td></tr>')

FLOW=[("14:31","A","106-06 绝缘层厚度检测工位","读数 0.71mm 低于下限 0.70mm","未处置","r"),
       ("14:22","B","106-05 机械性能无人化检测工位","待检样品 6 件 · 等待 18min","处理中","o"),
       ("13:58","C","108 环境试验区","相对湿度 58%RH 接近上限 60%RH","已处置","m"),
       ("11:08","C","106-03 热收缩样制工位","夹具气压波动 0.52MPa","已处置","m"),
       ("10:12","A","106-11 尺寸测量小工位","数采分系统离线 · 无上报","处理中","r")]
def frow(f):
    tm,lv,obj,desc,st,cl=f
    col={"A":"red","B":"org","C":"amb"}[lv]
    act="立即处置" if st=="未处置" else "查看回溯"
    return (f'<tr><td class="id">{tm}</td><td><span class="pill {col}">Grade {lv}</span></td><td>{obj}</td>'
            f'<td>{desc}</td><td><span class="dot {cl}"></span> {st}</td>'
            f'<td><span class="btn pri" data-goto="alarm">{act}</span></td></tr>')
FLOWROWS="".join(frow(f) for f in FLOW)

body = nav("总览") + f"""<style>{EXTRA_CSS}</style>
<div class="scene card" style="left:22px;top:86px;width:1396px;height:656px;overflow:hidden;padding:0">
  <div style="position:absolute;left:16px;top:14px;font-size:14px;font-weight:700">实验室总览 <span style="font-weight:400;color:var(--t3);font-size:12px">· 10 个区域 · 实时轴测</span></div>
  <div class="dim" style="right:16px;top:14px" data-switch><i class="on" data-dim data-desc="在场人员与授权">人 Man</i><i data-dim data-desc="设备状态与告警">机 Machine</i><i data-dim data-desc="样品 / 耗材位置">料 Material</i><i data-dim data-desc="执行标准与判定规则">法 Method</i><i data-dim data-desc="环境 / 安防 / 影像">环 Environment</i></div>  <div class="dimhint" data-role="dim-hint">叠加层：人 Man · 在场人员与授权</div>
  <svg width="1396" height="656" viewBox="0 0 1396 656" style="position:absolute;inset:0">{guides()}{room_svg()}</svg>
  {zone_labels()}
  <div class="bt-anchor" style="left:648px;top:126px">
    <div class="beats" style="color:var(--purple)"><div class="k">抗拉强度 · 106-05</div><div class="v">12.4<span class="u">N/mm²</span></div>
      <div class="sp">{''.join(f'<b style="height:{h}px;background:rgba(139,92,246,{0.3+i*0.06})"></b>' for i,h in enumerate([10,14,12,18,22,17,24,20,28,25,31,27]))}</div></div>
  </div>
  <div class="legend"><span><i style="background:#fff;border:1px solid #C9D2DC"></i>区域</span><span><i style="background:var(--blue)"></i>聚焦 / 无人化区</span>
    <span><i style="background:var(--red)"></i>告警</span><span><i style="background:var(--gold)"></i>通道引导线</span><span class="num">60s 无操作自动巡航</span></div>
  <div class="camchip"><span class="num">S1 全景机位</span><span>俯角 38° · 方位 45° · 正交</span><span class="pill ghost">AMR ×2 在线</span></div>
</div>

<div class="rail">
  <div class="card pnl">
    <div class="hd"><h3>实时指标</h3><span class="sub">近 24h · 三源汇聚</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="kpi"><div class="k">在线设备</div><div class="v">42<span class="u">/46 台</span><span class="d up">↑4</span></div><div class="s">采控系统 · 1:1 数采分系统</div></div>
      <div class="kpi"><div class="k">运行任务</div><div class="v">8<span class="u">个</span><span class="d dn">↓2</span></div><div class="s">调度系统 · 任务编排</div></div>
      <div class="kpi"><div class="k">今日完成</div><div class="v">126<span class="u">项</span><span class="d up">↑18</span></div><div class="s">判定规则已出结果</div></div>
      <div class="kpi" data-goto="alarm" style="border-color:rgba(229,72,77,.45)"><div class="k">告警数</div><div class="v rd">3<span class="u">条</span><span class="d rd">↑1</span></div><div class="s">A×1 · B×1 · C×1</div></div>
    </div>
  </div>
  <div class="card pnl">
    <div class="hd"><h3>区域告警</h3><span class="sub">同屏脉冲 ≤3</span></div>
    <div class="arow" data-goto="alarm"><span class="id num">106</span><span>绝缘层厚度检测工位</span><span class="pill red">A</span><span class="t">14:31</span></div>
    <div class="arow" data-goto="alarm"><span class="id num">106</span><span>机械性能无人化检测工位</span><span class="pill org">B</span><span class="t">14:22</span></div>
    <div class="arow" data-goto="alarm"><span class="id num">108</span><span>环境试验区 · 湿度 58%RH</span><span class="pill amb">C</span><span class="t">13:58</span></div>
  </div>
  <div class="card pnl">
    <div class="hd"><h3>机器人与载具</h3><span class="sub">机器人调度系统</span></div>
    <div class="arow" data-goto="zone106"><span class="dot g"></span><span style="color:var(--t1)">复合机器人 1</span><span class="num" style="color:var(--t3);font-size:11px">RB-C-01</span><span style="margin-left:auto;font-size:11px;color:var(--blue)">106 · 前往检测台</span></div>
    <div class="arow" data-goto="zone106"><span class="dot b"></span><span style="color:var(--t1)">复合机器人 2</span><span class="num" style="color:var(--t3);font-size:11px">RB-C-02</span><span style="margin-left:auto;font-size:11px;color:var(--t2)">106 · 充电 62%</span></div>
    <div class="arow" data-goto="zone106"><span class="dot g"></span><span style="color:var(--t1)">AMR 上料</span><span class="num" style="color:var(--t3);font-size:11px">RB-A-01</span><span style="margin-left:auto;font-size:11px;color:var(--t2)">102 → 106 · 3 件</span></div>
    <div class="arow"><span class="dot m"></span><span style="color:var(--t1)">载具周转</span><span style="margin-left:auto;font-size:11px;color:var(--t2)">12 / 20 在用</span></div>
  </div>
</div>

<div class="card btm">
  <div class="tabs2" data-switch><i class="on" data-view="task">今日任务</i><i data-view="alarm">告警流</i>
    <span class="cnt" data-panel-view="task">共 126 项 · 运行 8 · 待上料 3 · 告警 1 · 已完成 114</span>
    <span class="cnt" data-panel-view="alarm" hidden>近 24h 8 条 · 未处置 1 · 处理中 2 · 已处置 5</span></div>
  <div data-panel-view="task">
  <table class="tbl"><thead><tr><th>任务编号</th><th>来源</th><th>样品</th><th>区域</th><th>执行设备</th><th>状态</th><th>进度</th><th>%</th><th>更新</th></tr></thead>
  <tbody>{''.join(_trow(t) for t in TASKS)}</tbody></table></div>
  <div data-panel-view="alarm" hidden>
  <table class="tbl"><thead><tr><th>时间</th><th>等级</th><th>对象</th><th>触发原因</th><th>状态</th><th>动作</th></tr></thead>
  <tbody>{FLOWROWS}</tbody></table></div>
</div>"""
print(write("01-overview.html", page("overview", body, "S1 · 实验室总览")))
