#!/usr/bin/env python3
"""Insert Story202607-03-02 编号规则「更改记录」2026-08-05 条目 into Feishu docx (idempotent)."""

from __future__ import annotations

import json
import os
import sys
import uuid
import urllib.error
import urllib.request

OPEN_API = "https://open.feishu.cn/open-apis"
CHANGELOG_HEADING_ID = "X1G4dPLY7oKOAWxPNZ3cfLePncf"
MARKER_BEGIN = "【编号规则更改记录 2026-08-05 开始】"
MARKER_END = "【编号规则更改记录 2026-08-05 结束】"

MARKDOWN = r'''
###### 变更记录（2026-08-05 原型对齐）
- 日期令牌：年改为与月/日一致的「输出格式」选择（`YYYY` / `YY`）；月、日输出格式增加 `/` 分隔样式（如 `YYYY/MM`、`YY/MM`、`YYYY/MM/DD`、`YY/MM/DD`、`MM/DD`）。
- 编辑弹窗顶部增加「推荐搭配」：按规则类型一键套用常见组合，套用后仍可微调。
- 原始记录单编号规则：推荐搭配新增「引用样品编号」（样品编号 + `-` + 自增 3 位）。
- 样品编号规则：推荐搭配新增「SC-年序-分类」——`SC-` + 年 2 位 + 当年报告份数 4 位 + `-` + 分类编号（格式 `SC-xxNNNN-AA`；图示前缀 `NJYN-WZ-` 以 `SC-` 代替；`xx`=年、`NNNN`=当年该类物资报告份数、`AA`=物资类别/分类编号）。
- 试样编号规则：推荐搭配新增「SC-年序-分类-试样类」——在样品格式基础上再拼 `-` + 试样类别代码（格式 `SC-xxNNNN-AA-aa`；`aa`=制备样品类别/试样类别代码）。
- 生成预览 Mock：各大类试样类别代码示例改为占位风格——电力物资 `aa`、安全工器具 `bb`、环境检测 `cc`、工程检测 `dd`。
- 其它令牌交互对齐：自增序号位数支持 2/3/4/5；去除「固定拼接符号」入口，分隔符改由「自定义」填写且不允许空格；引用编号仍为委托编号 / 样品编号（不含试样编号引用）。
'''


def request(method: str, url: str, token: str, body: dict | None = None) -> dict:
    data = json.dumps(body, ensure_ascii=False).encode() if body is not None else None
    headers = {"Content-Type": "application/json; charset=utf-8"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        return {"code": exc.code, "msg": exc.read().decode()}


def get_token(app_id: str, app_secret: str) -> str:
    result = request(
        "POST",
        f"{OPEN_API}/auth/v3/tenant_access_token/internal",
        "",
        {"app_id": app_id, "app_secret": app_secret},
    )
    if result.get("code") != 0:
        raise RuntimeError(f"Auth failed: {result}")
    return result["tenant_access_token"]


def list_all_blocks(token: str, doc_id: str) -> list[dict]:
    page_token = ""
    items: list[dict] = []
    while True:
        url = (
            f"{OPEN_API}/docx/v1/documents/{doc_id}/blocks"
            f"?page_size=500&document_revision_id=-1"
        )
        if page_token:
            url += f"&page_token={page_token}"
        result = request("GET", url, token)
        if result.get("code") != 0:
            raise RuntimeError(f"List blocks failed: {result}")
        items.extend(result["data"].get("items", []))
        if not result["data"].get("has_more"):
            break
        page_token = result["data"].get("page_token", "")
    return items


def block_text(block: dict) -> str:
    texts: list[str] = []

    def walk(o):
        if isinstance(o, dict):
            tr = o.get("text_run")
            if isinstance(tr, dict) and "content" in tr:
                texts.append(tr["content"])
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(block)
    return "".join(texts)


def delete_block(token: str, doc_id: str, block_id: str) -> None:
    result = request(
        "DELETE",
        f"{OPEN_API}/docx/v1/documents/{doc_id}/blocks/{block_id}",
        token,
    )
    if result.get("code") not in (0, None):
        if "not found" in str(result).lower() or result.get("code") == 1770002:
            return
        raise RuntimeError(f"Delete block {block_id} failed: {result}")


def convert_markdown(token: str, markdown: str) -> tuple[list[dict], list[str]]:
    result = request(
        "POST",
        f"{OPEN_API}/docx/v1/documents/blocks/convert",
        token,
        {"content_type": "markdown", "content": markdown},
    )
    if result.get("code") != 0:
        raise RuntimeError(f"Convert failed: {result}")
    return result["data"].get("blocks", []), result["data"].get("first_level_block_ids", [])


def to_text(block_id: str, text: str) -> dict:
    return {
        "block_id": block_id,
        "block_type": 2,
        "text": {
            "elements": [{"text_run": {"content": text, "text_element_style": {}}}],
            "style": {},
        },
    }


def wrap_markers(blocks: list[dict], first_ids: list[str]) -> tuple[list[dict], list[str]]:
    begin_id, end_id = str(uuid.uuid4()), str(uuid.uuid4())
    begin, end = to_text(begin_id, MARKER_BEGIN), to_text(end_id, MARKER_END)
    return [begin, *blocks, end], [begin_id, *first_ids, end_id]


def find_marker_range(children: list[str], by_id: dict) -> tuple[int | None, int | None]:
    begin_idx = end_idx = None
    for i, cid in enumerate(children):
        t = block_text(by_id[cid])
        if t == MARKER_BEGIN:
            begin_idx = i
        if t == MARKER_END and begin_idx is not None:
            end_idx = i
            break
    return begin_idx, end_idx


def insert_descendants(
    token: str, doc_id: str, parent_id: str, index: int, blocks: list[dict], first_ids: list[str]
) -> None:
    result = request(
        "POST",
        f"{OPEN_API}/docx/v1/documents/{doc_id}/blocks/{parent_id}/descendant",
        token,
        {"children_id": first_ids, "descendants": blocks, "index": index},
    )
    if result.get("code") != 0:
        raise RuntimeError(f"Insert descendants failed: {result}")


def main() -> int:
    app_id = os.environ.get("FEISHU_APP_ID")
    app_secret = os.environ.get("FEISHU_APP_SECRET")
    doc_id = os.environ.get("FEISHU_DOCUMENT_ID")
    if not app_id or not app_secret or not doc_id:
        print("Missing FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_DOCUMENT_ID", file=sys.stderr)
        return 1

    token = get_token(app_id, app_secret)
    blocks = list_all_blocks(token, doc_id)
    by_id = {b["block_id"]: b for b in blocks}
    page = next(b for b in blocks if b.get("block_type") == 1)
    page_id = page["block_id"]
    children = page.get("children", [])

    if CHANGELOG_HEADING_ID not in children:
        print("编号规则「更改记录」标题未找到", file=sys.stderr)
        return 1

    begin_idx, end_idx = find_marker_range(children, by_id)
    if begin_idx is not None and end_idx is not None:
        for bid in children[begin_idx : end_idx + 1]:
            delete_block(token, doc_id, bid)
        blocks = list_all_blocks(token, doc_id)
        by_id = {b["block_id"]: b for b in blocks}
        page = next(b for b in blocks if b.get("block_type") == 1)
        page_id = page["block_id"]
        children = page.get("children", [])

    insert_at = children.index(CHANGELOG_HEADING_ID) + 1
    converted, first_ids = convert_markdown(token, MARKDOWN.strip() + "\n")
    converted, first_ids = wrap_markers(converted, first_ids)
    insert_descendants(token, doc_id, page_id, insert_at, converted, first_ids)
    print(f"OK: numbering changelog synced at index {insert_at}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
