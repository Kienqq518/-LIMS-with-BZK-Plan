# -*- coding: utf-8 -*-
WHITE, BLUE, LIME = "#FFFFFF", "#0055A4", "#DCF4A2"

def tw(s, fs):
    v = 0
    for ch in s:
        v += fs * (1.0 if ord(ch) > 0x2E80 else (0.32 if ch == " " else 0.62))
    return v

class Board:
    def __init__(self, w, h):
        self.w, self.h, self.parts, self.warn = w, h, [], []
        self.parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">')
        self.parts.append(f'<rect x="0" y="0" width="{w}" height="{h}" fill="{WHITE}"/>')
        self.parts.append('<defs><marker id="arrow" markerWidth="12" markerHeight="12" refX="9" refY="4" '
                          'orient="auto" markerUnits="strokeWidth"><path d="M0 0 L10 4 L0 8 z" fill="#0055A4"/></marker></defs>')
    def txt(self, x, y, s, fs=20, color=BLUE, bold=False, anchor="start", check=None):
        if check and tw(s, fs) > check: self.warn.append(f"OVERFLOW {s!r} {tw(s,fs):.0f}>{check} fs{fs}")
        w = ' font-weight="700"' if bold else ''
        a = f' text-anchor="{anchor}"' if anchor != "start" else ""
        self.parts.append(f'<text x="{x}" y="{y}" font-size="{fs}" fill="{color}"{w}{a}>{s}</text>')
    def rect(self, x, y, w, h, fill, rx=6, stroke=None, sw=0):
        s = f' fill="{fill}" rx="{rx}"'
        if stroke: s += f' stroke="{stroke}" stroke-width="{sw}"'
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}"{s}/>')
    def disc(self, cx, cy, r, fill, label, fs=20, color=WHITE):
        self.parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}"/>')
        self.txt(cx, cy + fs*0.36, label, fs, color, bold=True, anchor="middle")
    def arrow(self, x1, y1, x2, y2):
        self.parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{BLUE}" stroke-width="3" marker-end="url(#arrow)"/>')
    def elbow(self, pts):
        self.parts.append('<polyline points="' + " ".join(f"{a},{b}" for a, b in pts) +
                          f'" fill="none" stroke="{BLUE}" stroke-width="3" marker-end="url(#arrow)"/>')
    def title(self, x, y, s, fs=42):
        self.txt(x, y, s, fs, BLUE, bold=True)
        self.rect(x, y + 18, min(300, tw(s, fs) * 0.55), 4, LIME, rx=0)
    def band(self, x, y, w, h, lead, rest=None, lead_color=LIME, rest_color=WHITE, lead_fs=24, rest_fs=21, fill=BLUE):
        self.rect(x, y, w, h, fill, rx=6)
        self.txt(x + 26, y + h/2 + lead_fs*0.36, lead, lead_fs, lead_color, bold=True)
        if rest:
            self.txt(x + 26 + tw(lead, lead_fs) + 34, y + h/2 + rest_fs*0.36, rest, rest_fs, rest_color,
                     check=w - tw(lead, lead_fs) - 100)
    def card(self, x, y, w, h, head, items, head_fs=22, it_fs=19, numbered=None, body_on_white=True):
        """white card w/ blue border + lime header strip"""
        self.rect(x, y, w, h, WHITE, rx=6, stroke=BLUE, sw=2)
        self.rect(x, y, w, 46, LIME, rx=6)
        hx = x + 18
        if numbered is not None:
            self.disc(x + 30, y + 23, 18, BLUE, str(numbered), 18)
            hx = x + 58
        self.txt(hx, y + 31, head, head_fs, BLUE, bold=True, check=w - (hx - x) - 18)
        for j, it in enumerate(items):
            by = y + 84 + j * 40
            self.txt(x + 18, by, ("· " if body_on_white else "") + it, it_fs, BLUE, check=w - 34)
            if j < len(items) - 1:
                self.rect(x + 16, by + 13, w - 32, 2, LIME, rx=0)

    def save(self, path):
        self.parts.append('</svg>')
        svg = "\n".join(self.parts) + "\n"
        open(path, "w", encoding="utf-8").write(svg)
        print(f"{path}: {self.w}x{self.h} | warnings={len(self.warn)}")
        for w in self.warn: print("   ", w)
