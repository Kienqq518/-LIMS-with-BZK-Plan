# -*- coding: utf-8 -*-
"""数字孪生关键页面 · HTML 生成器（视觉语言提取 V1 / design-tokens.ts）"""
import json, math, os
from proto_layer import PROTO, JS, HOOKS

ROOT = "/Users/a1-6/.codex/worktrees/9fb6/-LIMS with BZK-Plan"
OUT  = "/tmp/twfig/pages"

CAD  = json.load(open(os.path.join(ROOT, "twin/future-lab/cad_geometry.json"), encoding="utf-8"))
V106 = json.load(open(os.path.join(ROOT, "twin/future-lab/visual_106.json"), encoding="utf-8"))

ROOMS = [r for r in CAD["rooms"] if r["id"] in [str(i) for i in range(101, 111)]]
EQ    = CAD["equipment"]
MINX  = min(min(p[0] for p in r["points"]) for r in ROOMS)
MINY  = min(min(p[1] for p in r["points"]) for r in ROOMS)

def room_rect(rid):
    r = next(x for x in ROOMS if x["id"] == rid)
    xs = [p[0] - MINX for p in r["points"]]; ys = [p[1] - MINY for p in r["points"]]
    return min(xs), min(ys), max(xs), max(ys), r["name"]

def room_boxes():
    return [(rid,) + room_rect(rid) for rid in [str(i) for i in range(101, 111)]]

def eq_boxes(rid):
    out = []
    for e in EQ:
        if e["roomId"] != rid: continue
        b = e["rotatedBBox"]
        out.append((e["id"], e["nameIfReadable"], b[0] - MINX, b[1] - MINY, b[2] - MINX, b[3] - MINY, e["category"]))
    return out

# ---------- 轴测投影：俯视 30°（正交），u→右下，v→左下 ----------
COS30, SIN30 = math.cos(math.radians(30)), 0.5
class Iso:
    def __init__(self, k=0.86, ox=0, oy=0, wall=16):
        self.k, self.ox, self.oy, self.wall = k, ox, oy, wall
    def p(self, u, v, z=0):
        return ((u - v) * COS30 * self.k + self.ox, (u + v) * SIN30 * self.k - z * self.k + self.oy)
    def pts(self, seq):
        return " ".join("%.1f,%.1f" % xy for xy in seq)

def iso_room(iso, u1, v1, u2, v2, h, top, left, right, stroke=None, sw=1, cls="", opacity=1.0):
    """返回一个房间的三面（顶/左前面/右前面）SVG"""
    a, b, c, d = iso.p(u1, v1, h), iso.p(u2, v1, h), iso.p(u2, v2, h), iso.p(u1, v2, h)
    a0, b0, c0, d0 = iso.p(u1, v1, 0), iso.p(u2, v1, 0), iso.p(u2, v2, 0), iso.p(u1, v2, 0)
    st = ' stroke="%s" stroke-width="%s" stroke-linejoin="round"' % (stroke, sw) if stroke else ""
    o  = ' opacity="%s"' % opacity if opacity != 1 else ""
    return (
        f'<polygon class="f-r{cls}" points="{iso.pts([b, c, c0, b0])}" fill="{right}"{st}{o}/>'
        f'<polygon class="f-l{cls}" points="{iso.pts([c, d, d0, c0])}" fill="{left}"{st}{o}/>'
        f'<polygon class="f-t{cls}" points="{iso.pts([a, b, c, d])}" fill="{top}"{st}{o}/>'
    )

def iso_box(iso, u1, v1, u2, v2, h, top="#FFFFFF", left="#E8EBEF", right="#DFE4EA", stroke=None, sw=1, cls="", opacity=1.0):
    return iso_room(iso, u1, v1, u2, v2, h, top, left, right, stroke, sw, cls, opacity)

def guide_line(iso, u1, v1, u2, v2, color="#E8D77A", w=2.2, dash=None, op=0.95):
    a, b = iso.p(u1, v1, 0.2), iso.p(u2, v2, 0.2)
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{color}" stroke-width="{w}" stroke-linecap="round"{d} opacity="{op}"/>'

def path_line(iso, pts, color="#2878FF", w=2.4, dash="7 6", fill=None, op=1, cls=""):
    s = " ".join("%.1f,%.1f" % iso.p(u, v, z) for u, v, z in pts)
    f = f' fill="{fill}"' if fill else ' fill="none"'
    d = f' stroke-dasharray="{dash}"' if dash else ""
    return f'<polyline class="{cls}" points="{s}" stroke="{color}" stroke-width="{w}"{f} stroke-linecap="round" stroke-linejoin="round"{d} opacity="{op}"/>'

def at(iso, u, v, z, html, cls="", anchor="center"):
    x, y = iso.p(u, v, z)
    tf = {"center": "translate(-50%,-50%)", "bottom": "translate(-50%,-100%)", "top": "translate(-50%,0)", "left": "translate(-100%,-50%)", "right": "translate(0,-50%)"}[anchor]
    return f'<div class="ov {cls}" style="left:{x:.1f}px;top:{y:.1f}px;transform:{tf}">{html}</div>'

# ---------- 页面骨架 ----------
CSS = """
:root{
  --bg0:#F3F5F8; --bg1:#FFFFFF; --floor:#FAFBFC; --gold:#E8D77A;
  --white:#FFFFFF; --grey:#E8EBEF; --panel:#2A2F36; --screen:#111418;
  --blue:#2878FF; --blue-soft:#BCD6FF; --red:#E5484D; --red-fill:rgba(229,72,77,.08); --red-ring:rgba(229,72,77,.10);
  --orange:#F76B15; --amber:#F59E0B; --green:#16A34A; --purple:#8B5CF6; --mint:#10B981;
  --t1:#0F2740; --t2:#5B6B7D; --t3:#8A97A7; --line:#E3E9F2; --chip:#EAF1FF; --chip-line:#D7E4FF; --icon:#F1F5FB;
  --card:0 14px 40px rgba(15,40,80,.14); --pill:0 4px 14px rgba(15,40,80,.06);
  --ease:cubic-bezier(.2,.8,.2,1);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden}
body{font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Source Han Sans SC",system-ui,sans-serif;
  color:var(--t1);background:linear-gradient(160deg,var(--bg0) 0%,var(--bg1) 62%,#FFFFFF 100%);
  -webkit-font-smoothing:antialiased;position:relative}
.num{font-family:"Fira Code",ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums}
/* ---------- 顶部导航 ---------- */
.nav{position:absolute;left:0;top:0;width:1920px;height:64px;background:#fff;border-bottom:1px solid var(--line);
  display:flex;align-items:center;padding:0 24px;z-index:9}
.logo{width:34px;height:34px;border-radius:10px;background:var(--blue);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.logo i{width:14px;height:14px;background:rgba(255,255,255,.95);border-radius:3px;transform:rotate(45deg)}
.brand{margin-left:12px;line-height:1.25}
.brand b{font-size:15px;font-weight:700;letter-spacing:.2px}
.brand span{display:block;font-size:10px;color:var(--t3);letter-spacing:1.1px;font-family:"Fira Code",monospace}
.sep{width:1px;height:28px;background:var(--line);margin:0 20px 0 22px}
.tabs{display:flex;gap:4px}
.tab{height:64px;padding:0 22px;display:flex;align-items:center;font-size:14px;color:var(--t2);position:relative;cursor:pointer}
.tab.on{color:var(--blue);font-weight:700}
.tab.on:after{content:"";position:absolute;left:50%;bottom:0;width:24px;height:3px;margin-left:-12px;border-radius:2px;background:var(--blue)}
.nav-r{margin-left:auto;display:flex;align-items:center;gap:14px}
.nav-r .src{font-size:12px;color:var(--t2)}
.nav-r .src b{color:var(--green);font-weight:600}
.av{width:30px;height:30px;border-radius:50%;background:var(--chip);border:1px solid var(--chip-line);
  display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--blue);font-weight:600}
/* ---------- 通用容器 ---------- */
.scene{position:absolute;overflow:visible}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:var(--card)}
.card h3{font-size:14px;font-weight:700;letter-spacing:.2px}
.card .sub{font-size:11px;color:var(--t3)}
.hair{height:1px;background:var(--line)}
.pill{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:600}
.pill.blue{background:var(--blue);color:#fff}.pill.red{background:var(--red);color:#fff}
.pill.org{background:var(--orange);color:#fff}.pill.amb{background:var(--amber);color:#fff}
.pill.ghost{background:#fff;border:1px solid var(--line);color:var(--t2);font-weight:500}
.pill.soft{background:var(--chip);border:1px solid var(--chip-line);color:var(--blue);font-weight:500}
.pill.off{background:#fff;border:1px solid var(--line);color:var(--t3);opacity:.55}
.dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;position:relative}
.dot:after{content:"";position:absolute;inset:-4px;border-radius:50%;background:currentColor;opacity:.16}
.dot.g{background:var(--green);color:var(--green)}.dot.b{background:var(--blue);color:var(--blue)}
.dot.r{background:var(--red);color:var(--red)}.dot.a{background:var(--amber);color:var(--amber)}
.dot.o{background:var(--orange);color:var(--orange)}.dot.m{background:var(--t3);color:var(--t3)}
.btn{height:28px;padding:0 14px;border-radius:999px;font-size:12px;display:inline-flex;align-items:center;gap:6px}
.btn.pri{background:var(--blue);color:#fff}.btn.gho{background:#fff;border:1px solid var(--line);color:var(--t2)}
.btn.dan{background:var(--red);color:#fff}.btn.sec{background:var(--chip);color:var(--blue);border:1px solid var(--chip-line)}
.seg{display:flex;align-items:center;gap:2px;padding:3px;border-radius:999px;background:var(--icon);border:1px solid var(--line)}
.seg i{font-style:normal;height:26px;padding:0 16px;border-radius:999px;display:flex;align-items:center;font-size:12px;color:var(--t3);font-family:"Fira Code",monospace}
.seg i.on{background:var(--blue);color:#fff;box-shadow:var(--pill)}
/* ---------- 5M1E ---------- */
.dim{position:absolute;display:flex;gap:8px;z-index:8}
.dim i{font-style:normal;height:32px;padding:0 14px;border-radius:999px;background:#fff;border:1px solid var(--line);
  box-shadow:var(--pill);display:flex;align-items:center;font-size:12px;color:var(--t2)}
.dim i.on{background:var(--blue);border-color:var(--blue);color:#fff;font-weight:600}
/* ---------- Beats 卡 ---------- */
.beats{width:176px;padding:10px 14px 12px;border-radius:14px;background:#fff;border:1px solid var(--line);box-shadow:var(--card);position:relative}
.beats .k{font-size:11px;color:var(--t3)}.beats .v{font-size:26px;font-weight:700;letter-spacing:-.5px;margin-top:2px}
.beats .u{font-size:11px;color:var(--t3);margin-left:4px;font-weight:400}
.beats .sp{display:flex;align-items:flex-end;gap:5px;height:34px;margin-top:8px}
.beats .sp b{display:block;width:6px;border-radius:2px}
.beats .flag{position:absolute;right:12px;top:10px;font-size:11px;color:var(--t3);background:var(--icon);border:1px solid var(--line);border-radius:999px;padding:2px 8px}
.beats .stem{position:absolute;left:50%;top:100%;width:2px;height:34px;background:currentColor;opacity:.5}
/* ---------- Grade 贴地 ---------- */
.gnd{position:absolute;pointer-events:none}
/* ---------- 机器人 / P 点 ---------- */
.rob{display:flex;align-items:center;gap:8px}
.rob .halo{width:34px;height:34px;border-radius:50%;background:radial-gradient(circle,rgba(40,120,255,.55) 0 28%,rgba(40,120,255,.18) 45%,rgba(40,120,255,0) 72%);
  display:flex;align-items:center;justify-content:center}
.rob .halo b{width:12px;height:12px;border-radius:50%;background:var(--blue);box-shadow:0 0 0 5px rgba(40,120,255,.22)}
.rob .cap{height:26px;padding:0 10px;border-radius:999px;background:#fff;border:1px solid var(--line);box-shadow:var(--pill);
  display:flex;align-items:center;font-size:11px;color:var(--t2);white-space:nowrap}
.ppt{width:26px;height:26px;border-radius:50% 50% 50% 4px;background:var(--green);transform:rotate(-45deg);
  box-shadow:0 0 0 8px rgba(22,163,74,.16);display:flex;align-items:center;justify-content:center}
.ppt b{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.92);transform:rotate(45deg)}
/* ---------- 表格 ---------- */
.tbl{width:100%;border-collapse:collapse}
.tbl th{font-size:11px;color:var(--t3);font-weight:500;text-align:left;padding:0 12px 8px;letter-spacing:.2px}
.tbl td{font-size:12px;color:var(--t2);padding:9px 12px;border-top:1px solid var(--line);white-space:nowrap}
.tbl tr td:first-child{color:var(--t1)}
.tbl .id{font-family:"Fira Code",monospace;color:var(--t1)}
.bar{height:6px;border-radius:999px;background:var(--grey);overflow:hidden;width:104px}
.bar i{display:block;height:100%;background:var(--blue);border-radius:999px}
/* ---------- 弹层 ---------- */
.scrim{position:absolute;inset:0;background:rgba(15,39,64,.42);backdrop-filter:blur(2px);z-index:20}
.modal{position:absolute;width:1160px;border-radius:20px;background:#fff;box-shadow:0 24px 64px rgba(15,40,80,.24);z-index:21;overflow:hidden}
.mh{display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid var(--line)}
.mh .x{margin-left:auto;width:30px;height:30px;border-radius:10px;background:var(--icon);display:flex;align-items:center;justify-content:center;color:var(--t2);font-size:16px}
.kv{display:grid;grid-template-columns:96px 1fr;row-gap:11px;font-size:12px}
.kv dt{color:var(--t3)}.kv dd{color:var(--t1)}
.row{display:flex;align-items:center;gap:10px}
/* ---------- 标注 ---------- */
.note{position:absolute;font-size:11px;color:var(--t3);letter-spacing:.2px}
.ov{position:absolute}
.clickable{cursor:pointer}
[data-role=chart][data-state=offline] .plot,[data-role=chart][data-state=missing] .plot{filter:grayscale(1);opacity:.5}
[data-role=chart][data-state=maintain] .plot{opacity:.35}
body[data-devstate=offline] [data-role=dev-cta]{opacity:.5}

/* ---------- 共享布局 ---------- */
.rail{position:absolute;right:22px;top:86px;width:458px;display:flex;flex-direction:column;gap:16px;align-items:flex-start;z-index:6}
.rail>*{width:458px;flex:0 0 auto}
.pnl{padding:16px}
.pnl .hd{display:flex;align-items:center;margin-bottom:12px}
.pnl .hd .sub{margin-left:auto;font-size:11px;color:var(--t3)}
.arow{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:12px;color:var(--t2)}
.arow .id{font-family:"Fira Code",monospace;color:var(--t1);width:34px}
.arow .t{margin-left:auto;font-family:"Fira Code",monospace;font-size:11px;color:var(--t3)}
.kpi{padding:14px 16px 12px;border-radius:14px;background:#fff;border:1px solid var(--line);box-shadow:var(--pill);width:206px}
.kpi .k{font-size:11px;color:var(--t3)}
.kpi .v{font-size:26px;font-weight:800;letter-spacing:-.6px;margin-top:3px;font-family:"Fira Code",monospace}
.kpi .u{font-size:11px;color:var(--t3);font-weight:400;margin-left:4px;font-family:"PingFang SC",sans-serif}
.kpi .d{font-size:12px;margin-left:8px;font-weight:600}
.kpi .s{font-size:10px;color:var(--t3);margin-top:6px}
.up{color:var(--green)}.dn{color:var(--blue)}.rd{color:var(--red)}
.legend{position:absolute;left:18px;bottom:16px;display:flex;gap:14px;align-items:center;font-size:11px;color:var(--t2);
  background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:999px;padding:7px 14px;box-shadow:var(--pill);z-index:6}
.legend i{width:10px;height:10px;border-radius:3px;display:inline-block;margin-right:5px;vertical-align:-1px}
.camchip{position:absolute;right:18px;bottom:16px;display:flex;gap:10px;align-items:center;font-size:11px;color:var(--t3);
  background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:999px;padding:7px 14px;box-shadow:var(--pill);z-index:6}
"""

GOTO={"总览":"overview","设备":"zone106","任务":None,"系统":None,"告警":"alarm"}
TODO={"任务":"任务看板：V1 未覆盖（PRD 只锁 S1/S2/S3）","系统":"系统交互视图：二期，当前只在告警页关联对象里出现"}

def nav(active, src="3/3 已接入", right_extra=""):
    tabs = ["总览", "设备", "任务", "系统", "告警"]
    def tab(t):
        if t==active: return f'<div class="tab on">{t}</div>'
        if GOTO.get(t): return f'<div class="tab" data-goto="{GOTO[t]}">{t}</div>'
        return f'<div class="tab" data-todo="{TODO.get(t,"本期未覆盖")}">{t}</div>'
    return f"""<header class="nav">
  <div class="logo"><i></i></div>
  <div class="brand"><b>未来实验室数字孪生</b><span>FUTURE LAB · DIGITAL TWIN</span></div>
  <div class="sep"></div>
  <div class="tabs">{''.join(tab(t) for t in tabs)}</div>
  <div class="nav-r">{right_extra}<span class="src">数据源 <b>{src}</b></span>
    <span class="num" style="font-size:12px;color:var(--t3)">2026-11-05 14:32:08</span><div class="av">李</div></div>
</header>"""

def page(name, body, title, **kw):
    extra = "".join(' %s="%s"' % (k, v) for k, v in kw.items())
    return (f"""<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>{title}</title><style>{CSS}</style>"""
            f"""<style>{PROTO}</style></head><body data-page="{name}"{extra}>{body}<script>{JS}</script></body></html>""")

def write(fn, html):
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, fn), "w", encoding="utf-8").write(html)
    return os.path.join(OUT, fn)
