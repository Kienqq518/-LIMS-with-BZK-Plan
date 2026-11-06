#!/usr/bin/env python3
"""飞书文档改造校验器：把「文档是否改对」变成可跑断言。
用法: check_doc.py --doc <token> --case all|<name>
checks.tsv 列: case <TAB> mode <TAB> pattern   (mode: forbid|require|tablecheck)
"""
import argparse, html, json, os, pathlib, re, subprocess, sys

def fetch(doc):
    out = subprocess.run(["lark-cli", "docs", "+fetch", "--doc", doc, "--scope", "full",
                          "--detail", "with-ids", "--jq", ".data.document.content"],
                         capture_output=True, text=True,
                         env={**__import__("os").environ,
                              "LARKSUITE_CLI_NO_UPDATE_NOTIFIER": "1",
                              "LARKSUITE_CLI_NO_SKILLS_NOTIFIER": "1"})
    if out.returncode != 0:
        sys.exit("fetch failed: " + out.stderr[:300])
    return out.stdout

def normalize(xml):
    t = re.sub(r"<whiteboard[^>]*>.*?</whiteboard>", "[画板]", xml, flags=re.S)
    t = re.sub(r"<whiteboard[^>]*/>", "[画板]", t)
    # 资源块的标题在属性里，保留可见文字，否则断言读不到
    t = re.sub(r'<bookmark\b[^>]*?\bname="([^"]*)"[^>]*>', r" \1 ", t)
    t = re.sub(r'<img\b[^>]*?\bcaption="([^"]*)"[^>]*>', r" \1 ", t)
    t = re.sub(r"<pre[^>]*>.*?</pre>", "[代码块]", t, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    return re.sub(r"\s+", " ", t)

def tablecheck(xml):
    bad = []
    for m in re.finditer(r'<table id="([^"]+)"[^>]*>(.*?)</table>', xml, re.S):
        tid, body = m.group(1), m.group(2)
        heads = re.findall(r"<th[^>]*>(.*?)</th>", body, re.S)
        heads = [re.sub(r"<[^>]+>", "", h).strip() for h in heads]
        empty = sum(1 for h in heads if not h)
        rows = re.findall(r"<tr>(.*?)</tr>", body, re.S)
        counts = [len(re.findall(r"<t[dh]", r)) for r in rows]
        if empty:
            bad.append(f"{tid[:10]} 空表头 x{empty}")
        if counts and max(counts) > len(heads):
            bad.append(f"{tid[:10]} 幻影列 cells{max(counts)}>heads{len(heads)}")
    dbl = len(re.findall(r"amp;(?:gt|lt);", xml))
    if dbl:
        bad.append(f"双重转义 &amp;gt;/&amp;lt; x{dbl}")
    return bad

def sections(xml):
    """[(level, title, slice_text_normalized)] 按标题切段"""
    hs = [(m.start(), int(m.group(2)), re.sub(r"<[^>]+>", "", m.group(3)).strip())
          for m in re.finditer(r"<(h)([1-3])[^>]*>(.*?)</h\2>", xml, re.S)]
    out = []
    for i, (pos, lv, title) in enumerate(hs):
        end = len(xml)
        for j in range(i + 1, len(hs)):
            if hs[j][1] <= lv:
                end = hs[j][0]; break
        out.append((lv, title, normalize(xml[pos:end])))
    return out

def labeled(xml, pattern, marker, section_prefix, window=40):
    bad = []
    for lv, title, txt in sections(xml):
        if not title.startswith(section_prefix):
            continue
        for m in re.finditer(pattern, txt):
            back = txt[max(0, m.start() - window):m.start()]
            if marker not in back:
                bad.append(f"{title}:{txt[max(0,m.start()-18):m.end()+8]}")
    return bad

def countcheck(name, expected):
    import pathlib
    meta = json.loads(pathlib.Path(__file__).with_name("base.json").read_text(encoding="utf-8"))
    base = meta["base"]["base_token"]
    env = {**os.environ, "LARKSUITE_CLI_NO_UPDATE_NOTIFIER": "1", "LARKSUITE_CLI_NO_SKILLS_NOTIFIER": "1"}
    p = subprocess.run(["lark-cli","base","+table-list","--base-token",base,"--as","user"],
                       capture_output=True, text=True, env=env)
    tables = json.loads(p.stdout).get("data", {}).get("tables", [])
    tid = next((t.get("table_id") or t.get("id") for t in tables
                if (t.get("name") or "") == name), None)
    if not tid:
        return [f"找不到表 {name}"]
    p2 = subprocess.run(["lark-cli","base","+record-list","--base-token",base,"--table-id",tid,
                         "--page-size","200","--format","json","--as","user"], capture_output=True, text=True, env=env)
    rows = json.loads(p2.stdout).get("data", {}).get("data", [])
    return [] if len(rows) == int(expected) else [f"{name} 实际 {len(rows)} 行，期望 {expected}"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--doc", required=True)
    ap.add_argument("--case", default="all")
    a = ap.parse_args()
    here = __import__("pathlib").Path(__file__).parent
    rows = [(l.split("\t") + [""] * 5)[:5] for l in (here / "checks.tsv").read_text(encoding="utf-8").splitlines()
            if l.strip() and not l.startswith("#")]
    xml = fetch(a.doc); text = normalize(xml)
    fails = []
    for row in rows:
        row = (row + [""] * 5)[:5]
        case, mode, pattern = row[0], row[1], row[2]
        if a.case != "all" and case != a.case:
            continue
        if mode == "tablecheck":
            bad = tablecheck(xml)
            print(f"[{case}] tablecheck -> {'OK' if not bad else 'FAIL ' + '; '.join(bad)}")
            if bad: fails.append(case)
        elif mode == "forbid":
            n = len(re.findall(pattern, text))
            print(f"[{case}] forbid {pattern!r} -> {n} {'OK' if n == 0 else 'FAIL'}")
            if n: fails.append(case)
        elif mode == "labeled":
            bad = labeled(xml, pattern, row[3], row[4])
            print(f"[{case}] labeled {pattern!r} 须靠近 {row[3]!r}（段 {row[4]}）-> {'OK' if not bad else 'FAIL ' + '; '.join(bad[:3])}")
            if bad: fails.append(case)
        elif mode == "countcheck":
            bad = countcheck(pattern, row[3])
            print(f"[{case}] countcheck {pattern} = {row[3]} -> {'OK' if not bad else 'FAIL ' + bad[0]}")
            if bad: fails.append(case)
        elif mode == "require":
            n = len(re.findall(pattern, text))
            print(f"[{case}] require {pattern!r} -> {n} {'OK' if n else 'FAIL'}")
            if not n: fails.append(case)
    print("----", "ALL PASS" if not fails else f"{len(fails)} FAILED: {sorted(set(fails))}")
    sys.exit(1 if fails else 0)

main()
