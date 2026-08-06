#!/usr/bin/env python3
"""Sync Story202607-04-01 §3 可视化配置能力 / §7 验收要点 into Feishu docx (idempotent)."""

from __future__ import annotations

import json
import os
import sys
import uuid
import urllib.error
import urllib.request

OPEN_API = "https://open.feishu.cn/open-apis"

HEADING_3 = "3. 可视化配置能力（对应 44）"
HEADING_4 = "4. 样品标签与合格证字段"
HEADING_7 = "7. 验收要点"
HEADING_8 = "8.更改记录"

MARKER_3_BEGIN = "【04-01 §3 可视化配置 2026-08-06 开始】"
MARKER_3_END = "【04-01 §3 可视化配置 2026-08-06 结束】"
MARKER_7_BEGIN = "【04-01 §7 验收要点 2026-08-06 开始】"
MARKER_7_END = "【04-01 §7 验收要点 2026-08-06 结束】"

SECTION_3_MD = r'''
**仅自由设计**（不做布局预设 / 双模式）。入口：模板管理 → 标签与合格证模版。

编辑路径：

1. **定纸张**：宽高 mm（尺寸快捷或自定义）；改尺寸时画布元素等比缩放。
2. **布局**：从三层元件库投放元素，在画布拖拽定位、缩放、旋转、设层级与锁定。
3. **内容**：右侧「内容」面板逐个调整文案、字段样式、透明度、日期格式等。

编辑器结构：左元件库 / 中实时预览+编辑覆盖 / 右「布局 | 内容」双面板（可随时切换）。

**元件三层分区**

- **背景层**：仅静态文本。
- **内容层**：单位名称、标题、Logo（各最多 1）；业务字段行（同一 fieldId 最多 1）；静态文本；二维码（最多 1）；分割线；悬挂孔。
- **水印层**：检测章、文本水印（可多枚）。

可重复元件：点名称循环选中，右侧「+」新增。预览左上角三层小眼睛可单独显隐该层（仅编辑辅助，不写入模版）。被挡元素可用 Alt+点击或「选中下层」穿透。

**新建模版**

- **空白创建**：名称 + 纸张 → 空画布，从元件库自由摆放。
- **复制已有模版**：仅当前大类 × 当前类型；深拷贝纸张与元素；清空样品绑定；结果一律为个性化模版。
- **不提供**系统布局预设 / 一键骨架。

**其它**

- 实时预览（样例数据）与打印同源渲染（`paper + elements[]`）。
- 材质 / 安装方式 / 赋码打印方式：模版元信息，列表展示，不直接渲染到证面。
- Logo：系统 / 上传 / 隐藏；检测章：系统公章或上传自定义；文本水印可设透明度与平铺。
- 日期类字段（本次/下次检测、有效期、收样等）支持常见日期格式点选。
- 合格证字段池含试样名称、规格型号、试样编号、检查员、日期类、送检单位等（不含合格证编号）；样品标签字段池为建议 6 项 + 流转二维码。
'''

SECTION_7_MD = r'''
1. 大类 × 类型具备默认模版；可空白新建或复制为个性化并绑定样品；复制结果不能成为第二个默认；冲突与启停规则正确。
2. 编辑器为自由画布：无布局预设；元件库分背景 / 内容 / 水印三层；可调布局与内容；字段 / 品牌 / QR 唯一性正确；水印 / 章可多枚并可置底 / 置顶。
3. 分层小眼睛可单独显隐各层（编辑辅助）；Alt+点击或「选中下层」可穿透被挡元素。
4. 检测章可选系统公章或上传自定义；日期字段可切换常见格式并在预览中生效。
5. 样品标签字段池含建议 6 字段，不含检测日 / 下次检测日作为池内主推项。
6. 合格证可配字段含规格型号、送检单位；再检周期文本 / 数值表现符合 42。
7. 列表展示材质 / 安装 / 赋码打印方式；打印页左预览右列表；合格证 QR 为短链形态。
8. 不合格或未到签发后续不可打合格证。
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


def wrap_markers(
    blocks: list[dict], first_ids: list[str], begin: str, end: str
) -> tuple[list[dict], list[str]]:
    begin_id, end_id = str(uuid.uuid4()), str(uuid.uuid4())
    return [to_text(begin_id, begin), *blocks, to_text(end_id, end)], [
        begin_id,
        *first_ids,
        end_id,
    ]


def find_marker_range(
    children: list[str], by_id: dict, begin: str, end: str
) -> tuple[int | None, int | None]:
    begin_idx = end_idx = None
    for i, cid in enumerate(children):
        t = block_text(by_id[cid])
        if t == begin:
            begin_idx = i
        if t == end and begin_idx is not None:
            end_idx = i
            break
    return begin_idx, end_idx


def find_heading_id(blocks: list[dict], title: str) -> str | None:
    for b in blocks:
        if block_text(b).strip() == title:
            return b["block_id"]
    return None


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


def refresh_page(token: str, doc_id: str) -> tuple[dict, dict, list[str]]:
    blocks = list_all_blocks(token, doc_id)
    by_id = {b["block_id"]: b for b in blocks}
    page = next(b for b in blocks if b.get("block_type") == 1)
    return page, by_id, page.get("children", [])


def clear_between(
    token: str,
    doc_id: str,
    children: list[str],
    by_id: dict,
    start_id: str,
    end_id: str,
) -> None:
    """Delete blocks strictly between start_id and end_id (exclusive)."""
    si, ei = children.index(start_id), children.index(end_id)
    for bid in children[si + 1 : ei]:
        delete_block(token, doc_id, bid)


def sync_section(
    token: str,
    doc_id: str,
    heading: str,
    next_heading: str,
    markdown: str,
    marker_begin: str,
    marker_end: str,
) -> None:
    page, by_id, children = refresh_page(token, doc_id)
    hid = find_heading_id(list(by_id.values()), heading)
    nid = find_heading_id(list(by_id.values()), next_heading)
    if not hid or not nid:
        raise RuntimeError(f"Heading not found: {heading!r} / {next_heading!r}")
    if hid not in children or nid not in children:
        raise RuntimeError(f"Headings not under page root: {heading!r}")

    begin_idx, end_idx = find_marker_range(children, by_id, marker_begin, marker_end)
    if begin_idx is not None and end_idx is not None:
        for bid in children[begin_idx : end_idx + 1]:
            delete_block(token, doc_id, bid)
        page, by_id, children = refresh_page(token, doc_id)
        hid = find_heading_id(list(by_id.values()), heading)
        nid = find_heading_id(list(by_id.values()), next_heading)

    # clear empty / stale content between heading and next heading
    clear_between(token, doc_id, children, by_id, hid, nid)
    page, by_id, children = refresh_page(token, doc_id)
    hid = find_heading_id(list(by_id.values()), heading)

    insert_at = children.index(hid) + 1
    converted, first_ids = convert_markdown(token, markdown.strip() + "\n")
    converted, first_ids = wrap_markers(converted, first_ids, marker_begin, marker_end)
    insert_descendants(token, doc_id, page["block_id"], insert_at, converted, first_ids)
    print(f"OK: synced {heading} at index {insert_at}")


def main() -> int:
    app_id = os.environ.get("FEISHU_APP_ID")
    app_secret = os.environ.get("FEISHU_APP_SECRET")
    doc_id = os.environ.get("FEISHU_DOCUMENT_ID")
    if not app_id or not app_secret or not doc_id:
        print("Missing FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_DOCUMENT_ID", file=sys.stderr)
        return 1

    token = get_token(app_id, app_secret)
    sync_section(
        token, doc_id, HEADING_3, HEADING_4, SECTION_3_MD, MARKER_3_BEGIN, MARKER_3_END
    )
    sync_section(
        token, doc_id, HEADING_7, HEADING_8, SECTION_7_MD, MARKER_7_BEGIN, MARKER_7_END
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
