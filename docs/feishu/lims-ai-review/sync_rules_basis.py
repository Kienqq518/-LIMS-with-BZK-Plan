# -*- coding: utf-8 -*-
"""校正 50 条规则的所需字段/标准依据/备注，并生成标准原文附录。

用法：
  python3 docs/feishu/lims-ai-review/sync_rules_basis.py
  python3 docs/feishu/lims-ai-review/sync_rules_basis.py --push-feishu
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
ROOT = DIR.parents[2]  # repo root: docs/feishu/lims-ai-review -> ../..
ENV = {
    **os.environ,
    "LARKSUITE_CLI_NO_UPDATE_NOTIFIER": "1",
    "LARKSUITE_CLI_NO_SKILLS_NOTIFIER": "1",
}
VERSION = "v0.5.4"

# ---------------------------------------------------------------------------
# 条款原文摘录（CNAS-CL01:2018 ≡ ISO/IEC 17025:2017；另附 CMA 相关）
# ---------------------------------------------------------------------------
CLAUSES: dict[str, dict] = {
    "CL01-6.2": {
        "cite": "CNAS-CL01:2018 6.2 / ISO/IEC 17025:2017 6.2",
        "title": "人员",
        "text": (
            "6.2.1 所有可能影响实验室活动的人员，无论是内部人员还是外部人员，应行为公正、有能力并按照实验室管理体系要求工作。\n"
            "6.2.3 实验室应确保人员具备其负责的实验室活动的能力……\n"
            "6.2.5 实验室应有以下活动的程序，并保存相关记录：（含）确定能力要求；人员选择；培训；监督；授权；能力监控。"
        ),
    },
    "CL01-6.4": {
        "cite": "CNAS-CL01:2018 6.4 / ISO/IEC 17025:2017 6.4",
        "title": "设备",
        "text": (
            "6.4.5 用于测量的设备应能达到所需的测量准确度和（或）测量不确定度，以提供有效结果。\n"
            "6.4.6 在下列情况下，测量设备应进行校准：……\n"
            "6.4.7 实验室应制定校准方案，并应进行复核和必要的调整，以保持对校准状态的信心。\n"
            "6.4.8 所有需要校准或具有规定有效期的设备应使用标签、编码或以其他方式标识，以使使用者便于识别校准状态或有效期。\n"
            "6.4.13 实验室应保存对实验室活动有影响的设备记录。适用时，记录应包括：……e) 校准日期、校准结果、……下次校准的预定日期或校准周期；……"
        ),
    },
    "CL01-6.5": {
        "cite": "CNAS-CL01:2018 6.5 / ISO/IEC 17025:2017 6.5",
        "title": "计量溯源性",
        "text": (
            "6.5.1 实验室应通过形成文件的不间断的校准链，将测量结果与适当的参考对象相关联，建立并保持测量结果的计量溯源性……"
        ),
    },
    "CL01-7.1": {
        "cite": "CNAS-CL01:2018 7.1 / ISO/IEC 17025:2017 7.1",
        "title": "要求、标书和合同评审",
        "text": (
            "7.1.1 实验室应有要求、标书和合同评审程序。该程序应确保：\n"
            "a) 要求应予充分规定，形成文件，并易于理解；\n"
            "b) 实验室有能力和资源满足这些要求；\n"
            "c) 在采用外部供应商时，满足本准则 6.6 的要求；且选择了适当的方法，并能满足客户的要求。\n"
            "7.1.3 当客户要求针对检测或校准作出与规范或标准符合性的声明时……应清晰定义判定规则，并与客户沟通并征得其同意……"
        ),
    },
    "CL01-7.2": {
        "cite": "CNAS-CL01:2018 7.2 / ISO/IEC 17025:2017 7.2",
        "title": "方法的选择、验证和确认",
        "text": (
            "7.2.1.1 实验室应使用适当的方法和程序开展所有实验室活动……\n"
            "7.2.1.3 实验室应确保使用最新有效版本的方法，除非不合适或不可能做到……\n"
            "7.2.1.4 当客户未指定所用的方法时，实验室应选择适当的方法并通知客户……\n"
            "7.2.1.5 实验室在引入方法前，应验证能够正确地运用该方法……\n"
            "7.2.2.1 实验室应对非标准方法、实验室开发的方法、超出预定范围使用的标准方法……进行确认。"
        ),
    },
    "CL01-7.3": {
        "cite": "CNAS-CL01:2018 7.3 / ISO/IEC 17025:2017 7.3",
        "title": "抽样",
        "text": (
            "7.3.3 实验室应将抽样数据作为检测或校准工作记录的一部分予以保存。相关时，这些记录应包括：……b) 抽样日期和时间；……"
        ),
    },
    "CL01-7.4": {
        "cite": "CNAS-CL01:2018 7.4 / ISO/IEC 17025:2017 7.4",
        "title": "检测或校准物品的处置",
        "text": (
            "7.4.1 实验室应有运输、接收、处置、保护、存储、保留、处理或归还检测或校准物品的程序，包括为保护检测或校准物品的完整性……需要的所有规定。\n"
            "7.4.2 实验室应有清晰标识检测或校准物品的系统。物品在实验室负责的期间内应保留该标识。标识系统应确保物品在实物上、在记录和其他文件中不会被混淆……\n"
            "7.4.3 接收检测或校准物品时，应记录与规定条件的偏离。当对物品是否适于检测或校准有疑问……应在开始工作前咨询客户……"
        ),
    },
    "CL01-7.5": {
        "cite": "CNAS-CL01:2018 7.5 / ISO/IEC 17025:2017 7.5",
        "title": "技术记录",
        "text": (
            "7.5.1 实验室应确保每一项实验室活动的技术记录包含结果、报告和足够的信息，以便在可能时识别影响测量结果及其测量不确定度的因素，并确保能在尽可能接近原条件的情况下重复该实验室活动。"
            "技术记录应包括每项实验室活动以及审查数据结果的日期和责任人。原始的观察结果、数据和计算应在观察或获得时予以记录……\n"
            "7.5.2 实验室应确保技术记录的修改可以追溯到前一个版本或原始观察结果。应保存原始的以及修改后的数据和文档，包括修改的日期、标识修改的内容和负责修改的人员。"
        ),
    },
    "CL01-7.7": {
        "cite": "CNAS-CL01:2018 7.7 / ISO/IEC 17025:2017 7.7",
        "title": "确保结果有效性",
        "text": (
            "7.7.1 实验室应有监控结果有效性的程序。记录结果数据的方式应便于发现其发展趋势，如可行，应采用统计技术审查结果。"
            "实验室应对监控进行策划和审查，适当时应包括但不限于：……使用标准物质或质量控制物质；……功能核查；……中间核查；……重复检测或校准；……比对；……盲样检测……"
        ),
    },
    "CL01-7.11": {
        "cite": "CNAS-CL01:2018 7.11.6 / ISO/IEC 17025:2017 7.11.6",
        "title": "数据控制和信息管理——计算检查",
        "text": "7.11.6 应对计算和数据传送进行适当和系统地检查。",
    },
    "CL01-7.8.1": {
        "cite": "CNAS-CL01:2018 7.8.1 / ISO/IEC 17025:2017 7.8.1",
        "title": "报告结果——总则",
        "text": (
            "7.8.1.1 结果在发出前应经过审查和批准。\n"
            "7.8.1.2 实验室应准确、清晰、明确和客观地出具结果，并且应包括客户同意的、解释结果所必需的以及所用方法要求的全部信息。"
            "实验室通常以报告的形式提供结果……所有发出的报告应作为技术记录予以保存。"
        ),
    },
    "CL01-7.8.2": {
        "cite": "CNAS-CL01:2018 7.8.2.1 / ISO/IEC 17025:2017 7.8.2.1",
        "title": "报告通用要求（必备信息）",
        "text": (
            "7.8.2.1 除非实验室有有效的理由，每份报告应至少包括下列信息……：\n"
            "d) 将报告中所有部分标记为完整报告一部分的唯一性标识，以及表明报告结束的清晰标识；\n"
            "e) 客户的名称和联络信息；\n"
            "f) 所用方法的识别；\n"
            "g) 物品的描述、明确的标识，以及必要时，物品的状态；\n"
            "h) 检测或校准物品的接收日期，以及对结果的有效性和应用至关重要的抽样日期；\n"
            "i) 实施实验室活动的日期；\n"
            "j) 报告的发布日期；\n"
            "m) 结果，适当时，带有测量单位；\n"
            "o) 报告批准人的识别；\n"
            "7.8.2.2 实验室对报告中的所有信息负责，客户提供的信息除外……"
        ),
    },
    "CL01-7.8.3": {
        "cite": "CNAS-CL01:2018 7.8.3 / ISO/IEC 17025:2017 7.8.3",
        "title": "检测报告的特定要求",
        "text": (
            "7.8.3.1 除 7.8.2 所列要求之外，当解释检测结果需要时，检测报告还应包含以下信息：\n"
            "a) 特定的检测条件信息，如环境条件；\n"
            "b) 相关时，与要求或规范的符合性声明（见 7.8.6）；\n"
            "……\n"
            "e) 特定方法、法定管理机构或客户要求的其他信息。"
        ),
    },
    "CL01-7.8.5": {
        "cite": "CNAS-CL01:2018 7.8.5 / ISO/IEC 17025:2017 7.8.5",
        "title": "报告抽样——特定要求",
        "text": (
            "如果实验室负责抽样活动，除 7.8.2 中的要求外，当解释结果需要时，报告还应包含以下信息：\n"
            "a) 抽样日期；\n"
            "b) 抽取的物品或物质的唯一性标识……；\n"
            "c) 抽样位置……；\n"
            "d) 抽样计划和抽样方法；……"
        ),
    },
    "CL01-7.8.6": {
        "cite": "CNAS-CL01:2018 7.8.6 / ISO/IEC 17025:2017 7.8.6",
        "title": "报告符合性声明",
        "text": (
            "7.8.6.1 当作出与规范或标准符合性声明时，实验室应考虑与所用判定规则相关的风险水平……将所使用的判定规则形成文件，并应用判定规则。\n"
            "7.8.6.2 实验室在报告符合性声明时应清晰标示：\n"
            "a) 符合性声明适用的结果；\n"
            "b) 满足或不满足的规范、标准或其中条款；\n"
            "c) 应用的判定规则（除非规范或标准中已包含）。"
        ),
    },
    "CL01-8.3": {
        "cite": "CNAS-CL01:2018 8.3 / ISO/IEC 17025:2017 8.3",
        "title": "管理体系文件的控制",
        "text": (
            "8.3.1 实验室应控制与满足本准则要求有关的内部和外部文件。\n"
            "8.3.2 实验室应确保：a) 文件发布前由授权人员审查其充分性并批准；b) 定期审查文件，必要时更新；"
            "c) 识别文件更改和当前修订状态；d) 在使用地点应可获得适用文件的相关版本……；e) 对文件进行唯一性标识；"
            "f) 防止误用作废文件……"
        ),
    },
    "CL01-8.4": {
        "cite": "CNAS-CL01:2018 8.4 / ISO/IEC 17025:2017 8.4",
        "title": "记录控制",
        "text": (
            "8.4.1 实验室应建立和保存清晰的记录以证明满足本准则的要求。\n"
            "8.4.2 实验室应对记录的标识、存储、保护、备份、归档、检索、保存期和处置实施所需的控制……\n"
            "注：对技术记录的其他要求见 7.5。"
        ),
    },
    "GBT-8170": {
        "cite": "GB/T 8170《数值修约规则与极限数值的表示和判定》",
        "title": "数值修约与极限数值",
        "text": (
            "规定数值修约规则、极限数值的表示和判定方法；检测报告中的有效数字、修约及与限值比较时应遵循该标准（及所用方法标准中的相关规定）。"
        ),
    },
    "CMA-RB214": {
        "cite": "RB/T 214-2017《检验检测机构资质认定能力评价 检验检测机构通用要求》；《检验检测机构资质认定管理办法》",
        "title": "CMA 资质认定通用要求（范围/标志 + 与 17025 对应章）",
        "text": (
            "RB/T 214-2017 条款结构与 ISO/IEC 17025 / CNAS-CL01 基本对应（如 6.2 人员、6.4 设备、6.5 计量溯源、"
            "7.1 合同评审、7.2 方法、7.4 样品处置、7.5 技术记录、7.7 结果有效性、7.8 报告结果、8.3 文件控制、8.4 记录控制）。\n"
            "《检验检测机构资质认定管理办法》规范资质认定及 CMA 标志使用；检验检测活动应在批准的能力范围（证书附表）内开展。"
            "细则以现行有效版本及证书附表为准。"
        ),
    },
    "METHOD-MVP": {
        "cite": "方法标准 / 行业规范（如 DL/T 976、GB/T 17622 等，以报告引用标准为准）",
        "title": "方法/行业限值条款",
        "text": (
            "具体限值、试验条件、判定规则以报告所引用的现行有效方法标准/产品标准条款为准；"
            "CNAS-CL01 7.8.6 要求符合性声明与判定规则一致、不得误导。"
        ),
    },
    "LAB-QM-SEAL": {
        "cite": "实验室质量手册/报告控制程序；资质认定对检验检测专用章及 CMA 标志的使用要求",
        "title": "报告签章控制（实验室程序）",
        "text": (
            "CNAS-CL01 未逐条强制“骑缝章”版式；国内检验检测机构通常由质量手册规定公章/检验检测专用章、骑缝章及 CMA 标志加盖位置与完整性。"
            "本规则按实验室受控报告模板与资质认定用章要求核验。"
        ),
    },
}

# ---------------------------------------------------------------------------
# 50 条规则校正：fields / basis / note / clause_keys
# row 元组兼容 make_records.pack：(id, expr, fields, basis, sev, domains, univ, note)
# ---------------------------------------------------------------------------
# fmt: off
RULES = [
  # L1-a
  ["L1-a-1", "nonempty(sample_no) && match(sample_no, 编号规则)",
   ["样品编号"],
   "CNAS-CL01:2018 7.4.2（物品清晰标识系统）；7.8.2.1 g（物品明确标识）；ISO/IEC 17025:2017 同款",
   "严重", ["通用"], "通用",
   "样品在实验室期间及报告中的标识唯一、可追溯，符合编码规则",
   ["CL01-7.4", "CL01-7.8.2"]],
  ["L1-a-2", "nonempty(report_no) && match(report_no, 编号规则)",
   ["报告编号"],
   "CNAS-CL01:2018 7.8.2.1 d（报告唯一性标识）；ISO/IEC 17025:2017 7.8.2.1 d",
   "严重", ["通用"], "通用",
   "报告具备唯一性标识（报告编号），各页可识别为同一完整报告",
   ["CL01-7.8.2"]],
  # L1-b
  ["L1-b-1", "nonempty(tester, reviewer, approver)",
   ["签名位"],
   "CNAS-CL01:2018 7.8.1.1（发出前审查和批准）；7.8.2.1 o（报告批准人识别）；实验室多级审核/授权签字程序",
   "严重", ["通用"], "通用",
   "结果发出前完成审查与批准；报告至少识别批准人；检测/审核/批准签按实验室程序齐全",
   ["CL01-7.8.1", "CL01-7.8.2"]],
  ["L1-b-2", "seal_position_ok(template) && cross_page_seal_ok(template)",
   ["签章与骑缝章", "模板格式参数"],
   "实验室质量手册报告签章控制（CL01 未单列骑缝章）",
   "严重", ["通用"], "通用",
   "公章/检验检测专用章、骑缝章及受控模板规定的签章位置完整、无错位遗漏",
   ["LAB-QM-SEAL", "CMA-RB214"]],
  # L1-c
  ["L1-c-1", "nonempty(client)",
   ["委托方信息"],
   "CNAS-CL01:2018 7.8.2.1 e（客户的名称和联络信息）；ISO/IEC 17025:2017 7.8.2.1 e",
   "严重", ["通用"], "通用",
   "报告含客户（委托方）名称及联络信息",
   ["CL01-7.8.2"]],
  ["L1-c-2", "nonempty(inspected_party)",
   ["受检方信息"],
   "CNAS-CL01:2018 7.8.1.2（客户同意的、解释结果所必需的信息）；7.8.2.1 g（物品描述，必要时）；行业/委托常见受检单位栏目",
   "一般", ["通用"], "通用",
   "受检方/受检单位信息完整（解释结果或委托约定需要时；非 7.8.2 通用强制项）",
   ["CL01-7.8.1", "CL01-7.8.2"]],
  ["L1-c-3", "section_present(样品信息) && order_ok(报告章节结构)",
   ["样品信息章节", "报告章节结构"],
   "CNAS-CL01:2018 7.8.2.1 g（物品的描述、明确的标识，必要时状态）；ISO/IEC 17025:2017 7.8.2.1 g",
   "严重", ["通用"], "通用",
   "报告含样品/物品描述与明确标识（样品信息）",
   ["CL01-7.8.2"]],
  ["L1-c-4", "section_present(检测依据)",
   ["检测依据章节", "报告章节结构"],
   "CNAS-CL01:2018 7.8.2.1 f（所用方法的识别）；ISO/IEC 17025:2017 7.8.2.1 f",
   "严重", ["通用"], "通用",
   "报告识别所用方法/检测依据",
   ["CL01-7.8.2"]],
  ["L1-c-5", "section_present(检测设备)",
   ["检测设备章节", "报告章节结构"],
   "CNAS-CL01:2018 7.8.1.2（解释结果所必需或方法/客户要求的信息）；6.4.13 / 7.5（设备记录可追溯）。注：7.8.2 未将设备列为报告通用强制项",
   "一般", ["通用"], "通用",
   "报告列明所用检测设备（方法、客户或实验室模板要求时；支撑技术记录追溯）",
   ["CL01-7.8.1", "CL01-6.4", "CL01-7.5"]],
  ["L1-c-6", "section_present(测试结果)",
   ["测试结果章节", "报告章节结构"],
   "CNAS-CL01:2018 7.8.2.1 m（结果，适当时带测量单位）；ISO/IEC 17025:2017 7.8.2.1 m",
   "严重", ["通用"], "通用",
   "报告含检测结果",
   ["CL01-7.8.2"]],
  ["L1-c-7", "section_present(结论)",
   ["结论章节", "报告章节结构"],
   "CNAS-CL01:2018 7.8.3.1 b / 7.8.6（相关时符合性声明）；7.1.3（判定规则）。无符合性声明需求时可不强制“结论”章",
   "一般", ["通用"], "通用",
   "作出符合性判定时，结论/符合性声明章节齐全且可对应判定规则",
   ["CL01-7.8.3", "CL01-7.8.6", "CL01-7.1"]],
  ["L1-c-8", "dates_present(receive, activity, report) && sampling_date_if_critical(...) && date_format_unified(...)",
   ["接收日期", "抽样日期", "检测日期", "报告日期"],
   "CNAS-CL01:2018 7.8.2.1 h/i/j；必要时 7.8.5 a / 7.3.3 b；ISO/IEC 17025:2017 同款",
   "严重", ["通用"], "通用",
   "报告含接收日期、活动实施日期、发布日期；结果有效性或应用至关重要（或实验室负责抽样且解释需要）时含抽样日期，格式统一",
   ["CL01-7.8.2", "CL01-7.8.5", "CL01-7.3"]],
  ["L1-c-9", "no_missing_or_duplicate_sections(报告章节结构)",
   ["报告章节结构", "模板格式参数"],
   "CNAS-CL01:2018 7.8.1.2（准确、清晰、明确、客观）；8.3（报告模板等文件受控）",
   "一般", ["通用"], "通用",
   "报告结构完整清晰，受控模板章节无缺失、错序或重复",
   ["CL01-7.8.1", "CL01-8.3"]],
  ["L1-c-10", "remark_slot_available(备注)",
   ["备注章节"],
   "CNAS-CL01:2018 7.8.3.1 e（方法/法规/客户要求的其他信息）；非 7.8.2 通用强制项",
   "轻微", ["通用"], "通用",
   "备注等辅助信息位可用（按方法、法规或客户要求；非通用强制）",
   ["CL01-7.8.3"]],
  # L1-d
  ["L1-d-1", "unit_matches_param(实测结果, 计量单位)",
   ["计量单位", "实测结果"],
   "CNAS-CL01:2018 7.8.2.1 m（结果，适当时带有测量单位）；ISO/IEC 17025:2017 7.8.2.1 m",
   "严重", ["通用"], "通用",
   "结果表述带正确测量单位，并与参数匹配",
   ["CL01-7.8.2"]],
  ["L1-d-2", "sig_figs_and_rounding_ok(实测结果)",
   ["实测结果", "计量单位"],
   "GB/T 8170；CNAS-CL01:2018 7.8.1.2（准确、清晰）；所用方法标准对修约的规定",
   "一般", ["通用"], "通用",
   "有效数字与数值修约符合 GB/T 8170 及方法标准",
   ["GBT-8170", "CL01-7.8.1"]],
  ["L1-d-3", "decimals_consistent_in_table(实测结果)",
   ["实测结果"],
   "CNAS-CL01:2018 7.8.1.2（清晰、明确、客观，避免误解）",
   "轻微", ["通用"], "通用",
   "同一结果表内小数位等表述一致，避免歧义",
   ["CL01-7.8.1"]],
  ["L1-d-4", "template_format_match(字体, 字号, 行距)",
   ["模板格式参数"],
   "CNAS-CL01:2018 8.3（受控文件/报告模板的适用版本）",
   "轻微", ["通用"], "通用",
   "版式（字体/字号/行距等）与现行受控报告模板一致",
   ["CL01-8.3"]],
  ["L1-d-5", "no_basic_text_errors(正文文本)",
   ["正文文本"],
   "CNAS-CL01:2018 7.8.1.2（准确、清晰、明确、客观）",
   "轻微", ["通用"], "通用",
   "正文无明显错别字、标点错误或重复段落，避免误解误用",
   ["CL01-7.8.1"]],
  # L2-a
  ["L2-a-1", "sampling_date <= receive_date <= test_date <= report_date",
   ["抽样日期", "接收日期", "检测日期", "报告日期"],
   "CNAS-CL01:2018 7.8.2.1 h/i/j（日期类信息）；7.5.1（技术记录含活动日期）。时间先后合理性审查",
   "严重", ["通用"], "通用",
   "抽样/接收/检测（活动）/报告发布日期逻辑先后正确",
   ["CL01-7.8.2", "CL01-7.5"]],
  ["L2-a-2", "(test_date - receive_date) <= allowed_period",
   ["接收日期", "检测日期"],
   "CNAS-CL01:2018 7.1.1（合同/要求规定的时限与能力）；7.4.1（样品处置程序）。允许周期以合同或方法为准",
   "一般", ["通用"], "通用",
   "自接收至完成检测未超出合同/方法允许周期",
   ["CL01-7.1", "CL01-7.4"]],
  ["L2-a-3", "report_date >= raw_record_timestamp",
   ["报告日期", "原始记录时间戳"],
   "CNAS-CL01:2018 7.5.1（技术记录含日期）；7.8.1.1 / 7.8.2.1 j（审查批准后发布）",
   "严重", ["通用"], "通用",
   "报告发布日期不早于对应原始/技术记录时间",
   ["CL01-7.5", "CL01-7.8.1", "CL01-7.8.2"]],
  # L2-b
  ["L2-b-1", "set(委托检测项目) ⊆ set(实测结果.params)",
   ["委托检测项目", "实测结果"],
   "CNAS-CL01:2018 7.1.1（满足合同/客户要求）；7.8.1.2（报告含约定及方法要求的全部信息）",
   "严重", ["通用"], "通用",
   "委托约定检测项目均有对应结果，无漏项",
   ["CL01-7.1", "CL01-7.8.1"]],
  # L2-c
  ["L2-c-1", "calib_from <= test_date <= calib_to",
   ["设备校准有效期", "检测日期"],
   "CNAS-CL01:2018 6.4.6 / 6.4.7 / 6.4.8（校准与校准状态标识）；6.5（计量溯源）",
   "严重", ["通用"], "通用",
   "所用测量设备在检测当日处于有效校准状态",
   ["CL01-6.4", "CL01-6.5"]],
  ["L2-c-2", "nonempty(校准证书编号) && cert_valid_on(test_date)",
   ["校准证书编号", "设备校准有效期", "检测日期"],
   "CNAS-CL01:2018 6.4.13 e（校准日期/结果/下次校准）；6.5（溯源）",
   "严重", ["通用"], "通用",
   "校准证书可追溯且覆盖检测日期",
   ["CL01-6.4", "CL01-6.5"]],
  # L2-d
  ["L2-d-1", "parallel_deviation_within_control(平行测定值)",
   ["平行/重复测定值", "实测结果"],
   "CNAS-CL01:2018 7.7.1（监控结果有效性，含重复检测等）",
   "严重", ["电网物资"], "品类专属",
   "多样本/多试件测定偏差在方法允许范围内（电网物资等；非所有品类都有平行样概念，须绑定启用）",
   ["CL01-7.7"]],
  ["L2-d-2", "no_abnormal_spike(实测结果, threshold=0.5)",
   ["实测结果"],
   "CNAS-CL01:2018 7.7.1（监控结果有效性，便于发现趋势/异常）",
   "一般", ["通用"], "通用",
   "结果无明显异常跳变",
   ["CL01-7.7"]],
  ["L2-d-3", "verify_mean_and_sum(衍生计算值, 实测结果)",
   ["衍生计算值", "实测结果"],
   "CNAS-CL01:2018 7.11.6（计算和数据传送应适当和系统地检查）；7.8.1.2（结果准确）",
   "严重", ["通用"], "通用",
   "汇总/平均值等计算正确",
   ["CL01-7.8.1", "CL01-7.11"]],
  ["L2-d-4", "verify_rsd_or_error_metrics(衍生计算值, 平行测定值)",
   ["衍生计算值", "平行/重复测定值"],
   "CNAS-CL01:2018 7.7.1（精密度/重复性等监控）；7.11.6（计算检查）",
   "一般", ["电网物资"], "品类专属",
   "RSD/重复性等误差指标计算正确（依赖多样本；须品类绑定，工器具逐只试验通常不适用）",
   ["CL01-7.7", "CL01-7.11"]],
  ["L2-d-5", "spec_matches_test_items(规格型号, 委托检测项目)",
   ["规格型号", "委托检测项目"],
   "CNAS-CL01:2018 7.2.1.1（方法适当）；7.4.3（物品是否适于检测有疑问时咨询客户）",
   "一般", ["电网物资", "安全工器具"], "品类专属",
   "规格/型号与所检项目匹配（匹配表依品类方法包，须绑定）",
   ["CL01-7.2", "CL01-7.4"]],
  ["L2-d-6", "device_range_covers_result(设备量程, 实测结果)",
   ["设备量程", "实测结果"],
   "CNAS-CL01:2018 6.4.5（设备达到所需测量准确度/不确定度以提供有效结果）",
   "严重", ["通用"], "通用",
   "设备量程/能力覆盖实测值",
   ["CL01-6.4"]],
  ["L2-d-7", "conclusion_consistent_with_results(实测结果, 标准限值, 判定结论)",
   ["实测结果", "标准限值", "判定结论"],
   "CNAS-CL01:2018 7.8.6（符合性声明与判定规则一致、表述清晰）",
   "严重", ["通用"], "通用",
   "判定结论与实测结果及限值逻辑一致",
   ["CL01-7.8.6"]],
  ["L2-d-8", "value_in_plausible_range(实测结果, 规格型号)",
   ["实测结果", "规格型号"],
   "CNAS-CL01:2018 7.7.1（结果有效性监控与异常识别）",
   "一般", ["电网物资", "安全工器具"], "品类专属",
   "实测值处于该类样品合理范围（范围表依品类，须绑定）",
   ["CL01-7.7"]],
  ["L2-d-9", "lod_loq_derivation_ok(衍生计算值)",
   ["衍生计算值", "实测结果"],
   "CNAS-CL01:2018 7.2.2（方法确认/特性）；7.7.1（有效性监控）",
   "一般", [], "品类专属",
   "检出限/定量限推导（化学/痕量分析概念；当前电网物资与安全工器具 MVP 品类均不绑定，待化学类品类上线再挂）",
   ["CL01-7.2", "CL01-7.7"]],
  ["L2-d-10", "cited_device == used_device",
   ["检测设备章节", "实测结果"],
   "CNAS-CL01:2018 7.5（技术记录足以复现）；7.8.2.2（实验室对报告信息负责）",
   "严重", ["通用"], "通用",
   "报告所列设备与实际使用设备一致",
   ["CL01-7.5", "CL01-7.8.2"]],
  ["L2-d-11", "industry_pack_crosscheck(实测结果, 规格型号)",
   ["实测结果", "规格型号", "判定结论"],
   "CNAS-CL01:2018 7.7.1；具体勾稽以引用方法/产品标准为准（MVP：电网/工器具等）",
   "一般", ["电网物资", "安全工器具"], "品类专属",
   "行业特有内部勾稽（进包；MVP）",
   ["CL01-7.7", "METHOD-MVP"]],
  # L3-a
  ["L3-a-1", "nonempty(cited_standard) && has_year(cited_standard)",
   ["引用标准号", "标准年号版本"],
   "CNAS-CL01:2018 7.2.1.3（使用最新有效版本的方法，除非不合适或不可能）",
   "严重", ["通用"], "通用",
   "引用方法/标准可识别且含年号版本，指向现行有效文本",
   ["CL01-7.2"]],
  ["L3-a-2", "cited_standard == test_standard",
   ["引用标准号", "检测依据章节"],
   "CNAS-CL01:2018 7.2.1（方法选择）；7.8.2.1 f（报告所用方法识别须与实际一致）",
   "严重", ["通用"], "通用",
   "报告所载方法/标准与实际检测所用一致",
   ["CL01-7.2", "CL01-7.8.2"]],
  ["L3-a-3", "sample_type_in_standard_scope(样品信息, 标准适用范围)",
   ["标准适用范围", "样品信息章节", "引用标准号"],
   "CNAS-CL01:2018 7.2.1.1（使用适当的方法）",
   "严重", ["通用"], "通用",
   "样品类型落在所用方法/标准适用范围内",
   ["CL01-7.2", "CMA-RB214"]],
  # L3-b
  ["L3-b-1", "limit_judgment_correct(实测结果, 标准限值, 判定结论)",
   ["实测结果", "标准限值", "判定结论"],
   "CNAS-CL01:2018 7.1.3 / 7.8.6（判定规则与符合性声明）",
   "严重", ["通用"], "通用",
   "按约定判定规则，实测对比限值的符合性判定正确",
   ["CL01-7.1", "CL01-7.8.6"]],
  ["L3-b-2", "within_allowed_tolerance(实测结果, 标准限值, 平行测定值)",
   ["实测结果", "标准限值", "平行/重复测定值"],
   "CNAS-CL01:2018 7.8.6；所用方法标准允许偏差/重复性条款",
   "一般", ["电网物资"], "品类专属",
   "结果在方法标准允许偏差/重复性内（依赖多样本或方法偏差条款；须品类绑定）",
   ["CL01-7.8.6", "METHOD-MVP"]],
  ["L3-b-3", "exceedance_marked_fail(实测结果, 标准限值, 判定结论)",
   ["实测结果", "标准限值", "判定结论"],
   "CNAS-CL01:2018 7.8.6.2（符合性声明清晰标示满足/不满足，不得误导）",
   "严重", ["通用"], "通用",
   "超标须判不符合并标明；禁止将超标判为符合",
   ["CL01-7.8.6"]],
  ["L3-b-4", "tool_voltage_leak_hold_ok(实测结果, 标准限值, 规格型号)",
   ["实测结果", "标准限值", "规格型号"],
   "DL/T 976 / GB/T 17622 等（以引用标准为准）；CNAS-CL01:2018 7.8.6",
   "严重", ["安全工器具"], "品类专属",
   "安全工器具耐压/泄漏/保持时间等限值符合引用标准（MVP）",
   ["METHOD-MVP", "CL01-7.8.6"]],
  ["L3-b-5", "material_strength_or_dimension_limit_ok(实测结果, 标准限值, 规格型号)",
   ["实测结果", "标准限值", "规格型号"],
   "相关 GB/T 等产品/方法限值条款（以引用标准为准）；CNAS-CL01:2018 7.8.6",
   "严重", ["电网物资"], "品类专属",
   "材料强度/尺寸等限值符合引用标准（MVP 电网）",
   ["METHOD-MVP", "CL01-7.8.6"]],
  # L3-c/d
  ["L3-c-1", "method_used == method_of(cited_standard)",
   ["检测方法", "引用标准号"],
   "CNAS-CL01:2018 7.2.1（选用并正确运用适当方法）；7.8.2.1 f",
   "一般", ["通用"], "通用",
   "实际采用方法与标准指定/报告识别方法一致（占位/浅做）",
   ["CL01-7.2", "CL01-7.8.2"]],
  ["L3-d-1", "mandatory_items(standard_or_entrust) ⊆ report_items",
   ["强制检测项清单", "委托检测项目", "实测结果"],
   "CNAS-CL01:2018 7.1.1（满足合同要求）；7.2.1（方法要求的项目）；7.8.1.2",
   "严重", ["电网物资", "安全工器具"], "品类专属",
   "标准/合同强制检测项无遗漏（强制项清单依品类方法包，须绑定）",
   ["CL01-7.1", "CL01-7.2", "CL01-7.8.1"]],
  # L4
  ["L4-a-1", "hash(report_values) == hash(raw_record) && timestamp_ok",
   ["原始记录哈希", "原始记录时间戳", "实测结果"],
   "CNAS-CL01:2018 7.5（技术记录完整可复现、修改可追溯）；8.4（记录控制）",
   "严重", ["通用"], "通用",
   "报告数据与原始技术记录一致、防篡改可核验（预留）",
   ["CL01-7.5", "CL01-8.4"]],
  ["L4-b-1", "tester in qualified_personnel(委托检测项目)",
   ["人员资质", "委托检测项目", "签名位"],
   "CNAS-CL01:2018 6.2（人员能力与授权）",
   "严重", ["通用"], "通用",
   "检测/授权签字人员具备对应项目能力与授权（预留）",
   ["CL01-6.2", "CMA-RB214"]],
  ["L4-c-1", "items_within_CMA_scope(委托检测项目, 检测方法)",
   ["CMA资质范围", "委托检测项目", "检测方法"],
   "资质认定证书能力附表（批准范围）",
   "严重", ["通用"], "通用",
   "检测项目与方法均在 CMA 批准能力范围内",
   ["CMA-RB214"]],
  ["L4-d-1", "nonempty(trace_code) && verify(trace_code)",
   ["透明度溯源码"],
   "CNAS-CL01:2018 7.5 / 8.4（记录可追溯）；实验室报告透明度/溯源管理程序",
   "一般", ["通用"], "通用",
   "报告溯源码可核验（实验室程序；预留）",
   ["CL01-7.5", "CL01-8.4"]],
]
# fmt: on


def _rbt_chapters(keys: list[str], rid: str) -> list[str]:
    """Map CL01 clause keys -> RB/T 214 chapter numbers (structure对齐 17025)."""
    order = []
    seen = set()
    key_map = {
        "CL01-6.2": "6.2",
        "CL01-6.4": "6.4",
        "CL01-6.5": "6.5",
        "CL01-7.1": "7.1",
        "CL01-7.2": "7.2",
        "CL01-7.3": "7.3",
        "CL01-7.4": "7.4",
        "CL01-7.5": "7.5",
        "CL01-7.7": "7.7",
        "CL01-7.8.1": "7.8",
        "CL01-7.8.2": "7.8",
        "CL01-7.8.3": "7.8",
        "CL01-7.8.5": "7.8",
        "CL01-7.8.6": "7.8",
        "CL01-7.11": "7.11",
        "CL01-8.3": "8.3",
        "CL01-8.4": "8.4",
        "LAB-QM-SEAL": "7.8",
        "METHOD-MVP": "7.8",
        "GBT-8170": "7.8",
    }
    for k in keys:
        ch = key_map.get(k)
        if ch and ch not in seen:
            seen.add(ch)
            order.append(ch)
    if rid == "L4-c-1" and not order:
        return []  # 范围专条，尾注单独写
    if not order:
        order = ["7.8"]
    return order


def _cma_tail(rid: str, keys: list[str]) -> str:
    chapters = _rbt_chapters(keys, rid)
    if rid == "L4-c-1":
        return "CMA：RB/T 214-2017；《检验检测机构资质认定管理办法》及证书能力附表（范围）"
    if rid == "L1-b-2":
        return "CMA：RB/T 214-2017 7.8；《检验检测机构资质认定管理办法》（CMA 标志/专用章）"
    ch = "、".join(chapters) if chapters else "（通则）"
    # 范围/标志：多数规则适用时提示；范围专检仍以 L4-c 为主
    return f"CMA：RB/T 214-2017 {ch}；《检验检测机构资质认定管理办法》（范围/标志，适用时）"


def _strip_old_cma(basis: str) -> str:
    # drop previous appended CMA： tails / mid-line RB-only clutter already cleaned in source
    if "；CMA：" in basis:
        basis = basis.split("；CMA：")[0]
    if basis.startswith("CMA："):
        return ""
    return basis.rstrip("；。 ")


# 统一在标准依据末尾追加 CMA 对应章 + 管理办法；附录 keys 确保含 CMA-RB214
_PROCESSED = []
_APPENDIX_KEYS = []
for _row in RULES:
    _keys = list(_row[8])
    if "CMA-RB214" not in _keys:
        _keys.append("CMA-RB214")
    _basis = _strip_old_cma(_row[3])
    _tail = _cma_tail(_row[0], _row[8])
    if _basis:
        _basis = f"{_basis}；{_tail}"
    else:
        _basis = _tail
    _PROCESSED.append([_row[0], _row[1], _row[2], _basis, _row[4], _row[5], _row[6], _row[7]])
    _APPENDIX_KEYS.append(_keys)

APPENDIX_KEYS = _APPENDIX_KEYS
RULE_ROWS = _PROCESSED
assert len(RULE_ROWS) == 50 and len(APPENDIX_KEYS) == 50


def rewrite_make_records() -> None:
    path = DIR / "make_records.py"
    src = path.read_text(encoding="utf-8")
    # dump RULES literal
    lit = "RULES = [\n"
    for row in RULE_ROWS:
        rid, expr, fields, basis, sev, domains, univ, note = row
        lit += "  [\n"
        lit += f"    {json.dumps(rid, ensure_ascii=False)},\n"
        lit += f"    {json.dumps(expr, ensure_ascii=False)},\n"
        lit += f"    {json.dumps(fields, ensure_ascii=False)},\n"
        lit += f"    {json.dumps(basis, ensure_ascii=False)},\n"
        lit += f"    {json.dumps(sev, ensure_ascii=False)},\n"
        lit += f"    {json.dumps(domains, ensure_ascii=False)},\n"
        lit += f"    {json.dumps(univ, ensure_ascii=False)},\n"
        lit += f"    {json.dumps(note, ensure_ascii=False)},\n"
        lit += "  ],\n"
    lit += "]\n"
    # replace RULES = [...] block (tolerant of blank lines before def sort_key)
    new, n = re.subn(
        r"RULES\s*=\s*\[.*?\]\s*\n+(?=def sort_key)",
        lit + "\n",
        src,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise SystemExit(f"failed to rewrite RULES block (n={n})")
    new = re.sub(r'"版本": "v0\.5\.\d+"', f'"版本": "{VERSION}"', new)
    # soften header: 备注不再强调 §2.3 权威
    new = re.sub(
        r"字段口径：\n.*?规则ID：Ln-x-n",
        "字段口径：\n"
        "  - 所需字段 / 判定式 / 严重度 / 适用领域：以可执行检查点为准\n"
        "  - 标准依据：CNAS-CL01 / ISO/IEC 17025 为主；末尾统一附 CMA：RB/T 214 对应章 + 管理办法（范围/标志）\n"
        "  - 备注：检查意图说明（可偏离旧「审什么」表述）\n"
        "  - 规则ID：Ln-x-n",
        new,
        count=1,
        flags=re.S,
    )
    path.write_text(new, encoding="utf-8")


def write_appendix() -> Path:
    out = DIR / "appendix-rule-standard-basis.md"
    lines = [
        "# 附录：审核规则 × 所需字段 × 标准出处与原文",
        "",
        "> 依据主源：**CNAS-CL01:2018**（等同采用 **ISO/IEC 17025:2017**）。",
        "> 每条台账「标准依据」末尾统一附：**CMA：RB/T 214-2017 对应章** + **《检验检测机构资质认定管理办法》（范围/标志，适用时）**。",
        "> 方法限值类以报告引用的现行有效方法/产品标准为准。",
        ">",
        f"> 与规则台账版本 **{VERSION}** 对齐；备注列表达检查意图，不以内部 §2.3 为权威依据。",
        "",
        "## 使用说明",
        "",
        "- **所需字段**须能支撑判定式，并在下列「标准出处」中找得到对应要求（或明确标注为实验室程序/非 7.8.2 强制项）。",
        "- RB/T 214 章条号与 CL01/17025 基本对应；CMA **范围**与 **标志**以管理办法及证书附表为准。",
        "- 条款原文为摘录，实施以正式出版文本为准。",
        "",
        "---",
        "",
    ]
    for row, keys in zip(RULE_ROWS, APPENDIX_KEYS):
        rid, expr, fields, basis, sev, domains, univ, note = row
        lines += [
            f"## {rid}",
            "",
            f"- **检查意图（备注）**：{note}",
            f"- **所需字段**：{'、'.join(fields)}",
            f"- **判定式**：`{expr}`",
            f"- **严重度 / 适用**：{sev}；{univ}；{', '.join(domains)}",
            f"- **标准依据（台账列）**：{basis}",
            "",
            "### 对应原文",
            "",
        ]
        for k in keys:
            c = CLAUSES[k]
            lines += [
                f"#### {c['cite']} — {c['title']}",
                "",
                "```",
                c["text"],
                "```",
                "",
            ]
        lines.append("---\n")
    # clause index
    lines += ["## 条款原文索引（去重）", ""]
    for k, c in CLAUSES.items():
        lines += [f"### {k}: {c['cite']} — {c['title']}", "", "```", c["text"], "```", ""]
    out.write_text("\n".join(lines), encoding="utf-8")
    return out


def write_seed_via_make_records() -> None:
    subprocess.check_call([sys.executable, str(DIR / "make_records.py")], cwd=ROOT)


def push_feishu() -> None:
    meta = json.loads((DIR / "base.json").read_text(encoding="utf-8"))
    base = meta["base"]["base_token"]
    table = meta["table"]["id"]
    # list records
    p = subprocess.run(
        ["lark-cli", "base", "+record-list", "--base-token", base, "--table-id", table,
         "--page-size", "100", "--as", "user"],
        capture_output=True, text=True, env=ENV, cwd=ROOT,
    )
    manifest = json.loads(p.stdout)
    path = Path(manifest["record_file"])
    id_by_rid = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        f = r.get("fields") or r
        id_by_rid[f.get("规则ID")] = r.get("record_id")
    for leftover in ROOT.glob("tblwz7D6MQVvm3Da_*"):
        leftover.unlink(missing_ok=True)

    # ensure 所需字段 options contain all used fields
    used = sorted({f for row in RULE_ROWS for f in row[2]})
    fg = subprocess.run(
        ["lark-cli", "base", "+field-get", "--base-token", base, "--table-id", table,
         "--field-id", "所需字段", "--as", "user"],
        capture_output=True, text=True, env=ENV,
    )
    field = json.loads(fg.stdout)["data"]["field"]
    opts = []
    seen = set()
    for o in field["options"]:
        if o["name"] in seen:
            continue
        seen.add(o["name"])
        item = {"name": o["name"]}
        if o.get("hue"):
            item["hue"] = o["hue"]
        if o.get("lightness"):
            item["lightness"] = o["lightness"]
        opts.append(item)
    hues = ["Blue", "Wathet", "Turquoise", "Green", "Lime", "Yellow", "Orange", "Red", "Carmine", "Purple", "Gray"]
    for i, name in enumerate(used):
        if name not in seen:
            opts.append({"name": name, "hue": hues[i % len(hues)], "lightness": "Lighter"})
            seen.add(name)
    payload = {
        "name": field["name"],
        "type": "select",
        "multiple": True,
        "description": "支撑判定式的数据项；须能在标准依据中找到对应要求（见附录）",
        "options": opts,
    }
    up = subprocess.run(
        ["lark-cli", "base", "+field-update", "--base-token", base, "--table-id", table,
         "--field-id", "所需字段", "--json", json.dumps(payload, ensure_ascii=False),
         "--as", "user", "--yes"],
        capture_output=True, text=True, env=ENV,
    )
    print("field-update", json.loads(up.stdout).get("ok"))

    update_records = {}
    skipped_specialty = []
    for row in RULE_ROWS:
        rid, expr, fields, basis, sev, domains, univ, note = row
        # 审核规则表只保留通用领域；品类专属改由绑定表承载
        if univ != "通用" or domains != ["通用"]:
            skipped_specialty.append(rid)
            continue
        rec_id = id_by_rid.get(rid)
        if not rec_id:
            print("MISSING record", rid)
            continue
        update_records[rec_id] = {
            "判定式": expr,
            "所需字段": fields,
            "标准依据": basis,
            "严重度": [sev],
            "适用领域": domains,
            "是否通用": [univ],
            "备注": note,
            "版本": VERSION,
        }
    if skipped_specialty:
        print("skip specialty (bound table owns defs)", skipped_specialty)
    # batch in chunks of 20
    items = list(update_records.items())
    for i in range(0, len(items), 20):
        chunk = dict(items[i : i + 20])
        ru = subprocess.run(
            ["lark-cli", "base", "+record-batch-update", "--base-token", base, "--table-id", table,
             "--json", json.dumps({"update_records": chunk}, ensure_ascii=False), "--as", "user"],
            capture_output=True, text=True, env=ENV,
        )
        out = json.loads(ru.stdout)
        print(f"batch {i//20+1}", out.get("ok"), out.get("data") or out.get("error"))


def update_base_md() -> None:
    md = DIR / "base.md"
    text = md.read_text(encoding="utf-8")
    tip = (
        f"- 标准对照附录：[`appendix-rule-standard-basis.md`](./appendix-rule-standard-basis.md)"
        f"（审什么/所需字段/出处/原文，对齐 {VERSION}）\n"
    )
    if "appendix-rule-standard-basis.md" not in text:
        text = text.rstrip() + "\n\n" + tip
    else:
        text = re.sub(r"- 标准对照附录：.*\n", tip, text)
    md.write_text(text, encoding="utf-8")


def main() -> None:
    assert len(RULE_ROWS) == 50, len(RULE_ROWS)
    rewrite_make_records()
    app = write_appendix()
    write_seed_via_make_records()
    update_base_md()
    # also dump machine-readable
    dump = {
        "version": VERSION,
        "rules": [
            {
                "规则ID": r[0],
                "判定式": r[1],
                "所需字段": r[2],
                "标准依据": r[3],
                "严重度": r[4],
                "适用领域": r[5],
                "是否通用": r[6],
                "备注": r[7],
                "clause_keys": keys,
            }
            for r, keys in zip(RULE_ROWS, APPENDIX_KEYS)
        ],
        "clauses": CLAUSES,
    }
    (DIR / "rule_standard_appendix.json").write_text(
        json.dumps(dump, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print("appendix", app)
    if "--push-feishu" in sys.argv:
        push_feishu()


if __name__ == "__main__":
    main()
