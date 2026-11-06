#!/usr/bin/env python3
"""飞书文档改造校验器：把「文档是否改对」变成可跑断言。
用法: check_doc.py --doc <token> --case all|<name>
checks.tsv 列: case <TAB> mode <TAB> pattern   (mode: forbid|require|tablecheck)
"""
import argparse, html, re, subprocess, sys, collections

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

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--doc", required=True)
    ap.add_argument("--case", default="all")
    a = ap.parse_args()
    here = __import__("pathlib").Path(__file__).parent
    rows = [l.split("\t") for l in (here / "checks.tsv").read_text(encoding="utf-8").splitlines()
            if l.strip() and not l.startswith("#")]
    xml = fetch(a.doc); text = normalize(xml)
    fails = []
    for case, mode, pattern in rows:
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
        elif mode == "require":
            n = len(re.findall(pattern, text))
            print(f"[{case}] require {pattern!r} -> {n} {'OK' if n else 'FAIL'}")
            if not n: fails.append(case)
    print("----", "ALL PASS" if not fails else f"{len(fails)} FAILED: {sorted(set(fails))}")
    sys.exit(1 if fails else 0)

main()
