# -*- coding: utf-8 -*-
import sys; sys.path.insert(0,'/tmp/twfig')
from gen_lib import *

# 106 场景：真实设备轮廓（cad_geometry rotatedBBox），放大机位
U1,V1,U2,V2 = (lambda r:(r[1],r[2],r[3],r[4]))(next(r for r in room_boxes() if r[0]=='106'))
NEIGH=[r for r in room_boxes() if r[0] in ('105','107','109','110','103','104')]
H={'106-01':22,'106-02':22,'106-03':22,'106-04':22,'106-05':24,'106-06':20,'106-07':22,'106-08':14,'106-09':14,
   '106-10':18,'106-11':14,'106-12':9,'106-13':9,'106-14':28,'106-15':28,'106-16':2,'106-17':2,'106-18':8,'106-19':8,
   '106-20':5,'106-21':5}
ALARMED={'106-06':('A','#E5484D'),'106-05':('B','#F76B15')}
RUNNING={'106-07','106-04','106-01','106-13','106-12'}
OFFLINE={'106-11'}
MAINT={'106-03'}
def box_of(eid):
    return next(e for e in eq_boxes('106') if e[0]==eid)

def scene106(k=1.72, ox=700, oy=60, w=1396, h=656, with_overlay=True, dim=False):
    iso=Iso(k=k,ox=ox,oy=oy,wall=18)
    s=[f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="position:absolute;inset:0">']
    # 相邻区域（淡化）
    for rid,a,b,c,d,nm in NEIGH:
        s.append(f'<g opacity=".34">{iso_room(iso,a,b,c,d,10,"#F7F9FC","#EEF1F5","#E7EBF0","#DDE3EA",1)}</g>')
    # 106 底板
    s.append(iso_room(iso,U1,V1,U2,V2,18,'#FBFCFE','#E9EDF2','#DFE5EC','#C9D2DC',1))
    # 地面浅金引导线（通道）
    for a,b,c,d in [(U1+8,V1+10,U2-8,V1+10),(U1+8,V2-14,U2-8,V2-14),(U1+14,V1+10,U1+14,V2-14),(U2-16,V1+10,U2-16,V2-14)]:
        s.append(guide_line(iso,a,b,c,d,w=2.6,op=.85))
    # 设备（远→近）
    eqs=sorted(eq_boxes('106'), key=lambda e:(e[3]+e[5]))
    for eid,enm,a,b,c,d,cat in eqs:
        hh=H.get(eid,10)
        al=ALARMED.get(eid); run=eid in RUNNING
        stroke=(al[1],2.4) if al else (('#2878FF',1.8) if run else ('#C9D2DC',1))
        top='#FFFFFF'
        if eid in OFFLINE: top='#EEF1F5'
        s.append(f'<g data-eq="{eid}">{iso_box(iso,a,b,c,d,hh,top,"#E4E9EF" if not al else "#F6DEDE","#D9DFE6",stroke[0],stroke[1],"",.92 if eid in OFFLINE else 1)}')
        # 深色面板/观察窗（设备细节：只在前脸加一条）
        p1,p2=iso.p(a+ (c-a)*0.18, d+0.1, hh*0.72), iso.p(a+(c-a)*0.55, d+0.1, hh*0.72)
        s.append(f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" stroke="#2A2F36" stroke-width="{max(2,hh*0.28):.1f}" stroke-linecap="round" opacity=".72"/>')
        s.append('</g>')
    # 告警贴地色块
    for eid,(lv,col) in ALARMED.items():
        _,_,a,b,c,d,_=box_of(eid)
        pa,pb,pc,pd=iso.p(a-3,b-3,0),iso.p(c+3,b-3,0),iso.p(c+3,d+3,0),iso.p(a-3,d+3,0)
        s.append(f'<polygon points="{iso.pts([pa,pb,pc,pd])}" fill="{col}" opacity=".10" stroke="{col}" stroke-width="2"/>')
    # AMR 路径（双层：浅蓝底 + 蓝虚线流动）
    route=[(U1+22,V2-26,1),(U1+22,V1+70,1),(U1+60,V1+70,1),(U1+60,V1+34,1),(U2-30,V1+34,1),(U2-30,V1+70,1),(U2-30,V2-26,1)]
    s.append(path_line(iso,route,'#BCD6FF',7,None,op=.95))
    s.append(path_line(iso,route,'#2878FF',2.6,'9 8'))
    # 机器人 / P 点
    rx,ry=U1+22,V1+120
    s.append('</svg>')
    svg=''.join(s)
    if not with_overlay: return svg,''
    ov=[]
    ov.append(at(iso,rx,ry,2,f'<div class="rob"><div class="halo"><b></b></div><div class="cap">复合机器人 RB-C-01 · 前往 检测台 1</div></div>','robpos'))
    px,py=U1+60,V1+34
    ov.append(at(iso,px,py,0,'<div class="ppt"><b></b></div>','ppos'))
    # Beats 卡（固定浮位 + SVG 引线锚定设备）
    def beats(label,value,unit,rgb,hs,flag=None):
        bars="".join('<b style="height:%dpx;background:rgba(%s,%.2f)"></b>'%(h,rgb,.30+i*.058) for i,h in enumerate(hs))
        fl='<div class="flag">%s</div>'%flag if flag else ''
        return ('<div class="beats" style="color:rgb(%s)"><div class="k">%s</div><div class="v">%s<span class="u">%s</span></div>'
                '<div class="sp">%s</div>%s</div>')%(rgb,label,value,unit,bars,fl)
    A=[10,14,12,18,22,17,24,20,28,25,31,27]; B=[26,24,25,22,20,21,18,17,15,14,12,11]; C=[12,15,13,19,17,22,20,24,22,26,24,28]
    spec=[('106-06', beats('绝缘层厚度 · 106-06','0.71','mm','229,72,77',B,'数据超限'),  642, 50),
          ('106-05', beats('抗拉强度 · 106-05','12.4','N/mm²','247,107,21',A),            318, 172),
          ('106-07', beats('热延伸 · 150℃ 载荷','86','%','139,92,246',C),                 856, 150)]
    lead=[]
    for eid,card,cx,cy in spec:
        _,_,a,b,c,d,_=box_of(eid)
        tx,ty=iso.p((a+c)/2,(b+d)/2,H.get(eid,12)+2)
        lead.append('<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f" stroke="#B7C4D2" stroke-width="1.4" fill="none" stroke-dasharray="4 4"/>'
                    %(tx,ty,(tx+cx+88)/2,ty,cx+88,cy+104))
        ov.append('<div class="beats-wrap" style="left:%dpx;top:%dpx">%s</div>'%(cx,cy,card))
    s2=svg.replace('</svg>',''.join(lead)+'</svg>')
    # Andon 卡（Grade A）
    ov.append('<div class="andon-pos"><div class="card andon"><div class="ai">A</div><div class="ab">'
      '<b>绝缘层厚度检测工位 · 数据超限</b><span class="reason"><i class="dot r"></i>读数 0.71mm 低于下限 0.70mm，已暂停上料</span>'
      '<div class="row" style="gap:8px;margin-top:9px"><span class="btn pri">安灯呼叫</span><span class="btn gho">忽略</span><span class="pill ghost">派发：主任台 + 运维队列</span></div>'
      '</div></div></div>')
    return s2,''.join(ov)

EXTRA="""
.robpos{position:absolute;z-index:5}.ppos{position:absolute;z-index:3}
.beats-wrap{position:absolute;z-index:4}
.beats .stem{left:50%}
.andon-pos{position:absolute;left:18px;bottom:64px;z-index:5}
.andon{display:flex;gap:12px;padding:14px;width:392px}
.andon .ai{width:34px;height:34px;border-radius:10px;background:var(--red);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:14px;flex:0 0 auto}
.andon .ab{flex:1;min-width:0}
.andon b{font-size:14px;display:block}
.andon .reason{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--t2);margin-top:6px}
.step{display:flex;align-items:flex-start;gap:10px}
.step .no{width:22px;height:22px;border-radius:50%;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:700;flex:0 0 auto}
.step.done .no{background:var(--green);color:#fff}.step.now .no{background:var(--blue);color:#fff;box-shadow:0 0 0 4px rgba(40,120,255,.16)}
.step.todo .no{background:var(--icon);color:var(--t3);border:1px solid var(--line)}.step.err .no{background:var(--red);color:#fff}
.step .tx b{font-size:12px;display:block;color:var(--t1)}.step .tx span{font-size:11px;color:var(--t3)}
.step .ln{width:2px;flex:1;min-height:22px;background:var(--line);margin:2px 0 0 10px}
.dchip{display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 12px;border-radius:10px;background:#fff;border:1px solid var(--line);font-size:12px;color:var(--t2)}
.dchip .num{color:var(--t1);font-size:11px}
.dchip.sel{border-color:var(--blue);box-shadow:0 0 0 3px rgba(40,120,255,.12)}
"""
