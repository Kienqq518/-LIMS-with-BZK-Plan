#!/bin/sh
# 重新生成四页并同步到部署目录 proto/（Vercel 发布路径）
set -e
cd "$(dirname "$0")"
for p in gen_p1 gen_p2 gen_p3 gen_p4; do python3 "$p.py" >/dev/null; done
ROOT="$(cd ../.. && pwd)"
for f in 01-overview 02-zone-106 03-device-detail 04-alarm-review; do
  cp "pages/$f.html" "$ROOT/proto/$f.html"
done
echo "已同步四页到 $ROOT/proto/（proto/index.html 为启动页，不在此脚本生成）"
