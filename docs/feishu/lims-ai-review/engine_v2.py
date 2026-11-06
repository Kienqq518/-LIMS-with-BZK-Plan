# ============================================================
# 审核规则引擎 - 核心架构设计
# ============================================================

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Optional, Any, Callable
from datetime import datetime
import json

# ------ 基础数据模型 ------

class Severity(Enum):
    """问题严重程度"""
    CRITICAL = "critical"      # 严重：必须修改，阻止报告发出
    MAJOR = "major"            # 一般：需要修改，但不阻止流程
    MINOR = "minor"            # 轻微：建议修改
    INFO = "info"              # 提示：供参考

class ReviewStatus(Enum):
    """审核状态"""
    PASS = "pass"              # 通过
    FAIL = "fail"              # 不通过
    WARNING = "warning"        # 警告(需人工确认)
    SKIP = "skip"              # 跳过(规则不适用)

class RuleCategory(Enum):
    """规则类别"""
    DATA_COMPLETENESS = "data_completeness"      # 数据完整性
    LOGIC_CONSISTENCY = "logic_consistency"       # 逻辑一致性
    FORMAT_COMPLIANCE = "format_compliance"       # 格式规范性
    STANDARD_LIMIT = "standard_limit"            # 标准限值
    QC_CHECK = "qc_check"                        # 质控检查


@dataclass
class ReviewIssue:
    """单个审核问题"""
    rule_id: str                    # 规则ID
    rule_name: str                  # 规则名称
    category: RuleCategory          # 规则类别
    severity: Severity              # 严重程度
    status: ReviewStatus            # 审核状态
    message: str                    # 问题描述
    location: str                   # 问题定位(如"样品信息-采样日期")
    expected_value: Optional[str] = None    # 期望值
    actual_value: Optional[str] = None      # 实际值
    suggestion: Optional[str] = None        # 修改建议
    confidence: float = 1.0                 # 置信度(规则引擎默认1.0)
    metadata: Dict = field(default_factory=dict)


@dataclass
class ReviewResult:
    """审核结果汇总"""
    report_id: str                          # 报告ID
    review_time: datetime                   # 审核时间
    total_rules_executed: int               # 执行的规则总数
    total_rules_passed: int                 # 通过的规则数
    total_rules_failed: int                 # 不通过的规则数
    total_rules_warning: int                # 警告的规则数
    overall_status: ReviewStatus            # 总体审核状态
    overall_score: float                    # 总体评分(0-100)
    issues: List[ReviewIssue]               # 问题列表
    critical_count: int = 0
    major_count: int = 0
    minor_count: int = 0
    review_duration_ms: int = 0             # 审核耗时(毫秒)
    engine_version: str = "1.0.0"

    @property
    def summary(self) -> str:
        return (f"审核完成: 执行{self.total_rules_executed}条规则, "
                f"通过{self.total_rules_passed}, "
                f"不通过{self.total_rules_failed}, "
                f"警告{self.total_rules_warning}, "
                f"评分{self.overall_score:.1f}")


# ------ 规则基类 ------

class BaseRule(ABC):
    """审核规则基类"""

    def __init__(self, rule_id: str, rule_name: str,
                 category: RuleCategory, severity: Severity,
                 description: str = "",
                 applicable_domains: List[str] = None,
                 applicable_categories: List[str] = None,
                 universal: bool = True,
                 enabled: bool = True):
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.category = category
        self.severity = severity
        self.description = description
        self.applicable_domains = applicable_domains or ["ALL"]
        # 品类绑定：空列表表示该规则属通用集，任何品类都跑
        self.applicable_categories = applicable_categories or []
        # universal=False 即「品类专属」：未配置绑定的品类不跑
        self.universal = universal
        self.enabled = enabled

    def param(self, context: Dict, key: str, default=None):
        """取当前品类的参数覆盖（绑定表 overrides），缺省回落到规则默认值"""
        return (context.get("overrides") or {}).get(self.rule_id, {}).get(key, default)

    def is_applicable(self, context: Dict) -> bool:
        """判断规则是否适用于当前报告：品类优先、领域兜底"""
        if not self.enabled:
            return False
        bindings = context.get("bindings") or {}
        if self.rule_id in bindings:          # 绑定表显式决定跑不跑
            return bool(bindings[self.rule_id].get("enabled", True))
        if context.get("universal_only") and not self.universal:
            return False                      # 未配置品类：品类专属一律不跑
        if self.applicable_categories:        # 品类专属规则
            cat = context.get("category", "")
            if cat and cat not in self.applicable_categories:
                return False
        if "ALL" in self.applicable_domains:
            return True
        return context.get("domain", "") in self.applicable_domains

    @abstractmethod
    def execute(self, report_data: Dict, context: Dict) -> ReviewIssue:
        """执行审核规则"""
        pass

    def _pass(self, message: str = "检查通过") -> ReviewIssue:
        return ReviewIssue(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            category=self.category,
            severity=self.severity,
            status=ReviewStatus.PASS,
            message=message,
            location=""
        )

    def _fail(self, message: str, location: str = "",
              expected: str = None, actual: str = None,
              suggestion: str = None) -> ReviewIssue:
        return ReviewIssue(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            category=self.category,
            severity=self.severity,
            status=ReviewStatus.FAIL,
            message=message,
            location=location,
            expected_value=expected,
            actual_value=actual,
            suggestion=suggestion
        )

    def _warning(self, message: str, location: str = "",
                 suggestion: str = None) -> ReviewIssue:
        return ReviewIssue(
            rule_id=self.rule_id,
            rule_name=self.rule_name,
            category=self.category,
            severity=self.severity,
            status=ReviewStatus.WARNING,
            message=message,
            location=location,
            suggestion=suggestion
        )


# ------ 具体规则实现示例 ------

class SampleInfoCompletenessRule(BaseRule):
    """A01: 样品信息完整性检查"""

    REQUIRED_FIELDS = [
        ("sample_id", "样品编号"),
        ("sample_name", "样品名称"),
        ("client_name", "委托单位"),
        ("receive_date", "收样日期"),
        ("sample_status", "样品状态"),
        ("test_standard", "检测依据"),
    ]

    def __init__(self):
        super().__init__(
            rule_id="A01",
            rule_name="样品信息完整性检查",
            category=RuleCategory.DATA_COMPLETENESS,
            severity=Severity.CRITICAL,
            description="检查样品基本信息是否完整填写"
        )

    def execute(self, report_data: Dict, context: Dict) -> ReviewIssue:
        sample_info = report_data.get("sample_info", {})
        missing_fields = []

        for field_key, field_name in self.REQUIRED_FIELDS:
            value = sample_info.get(field_key)
            if value is None or (isinstance(value, str) and value.strip() == ""):
                missing_fields.append(field_name)

        if missing_fields:
            return self._fail(
                message=f"样品信息缺少以下必填项: {', '.join(missing_fields)}",
                location="样品信息",
                expected="所有必填字段均已填写",
                actual=f"缺少 {len(missing_fields)} 个必填字段",
                suggestion=f"请补充填写: {', '.join(missing_fields)}"
            )
        return self._pass("样品信息完整性检查通过")


class DateLogicRule(BaseRule):
    """B01: 时间逻辑检查"""

    def __init__(self):
        super().__init__(
            rule_id="B01",
            rule_name="时间逻辑一致性检查",
            category=RuleCategory.LOGIC_CONSISTENCY,
            severity=Severity.CRITICAL,
            description="检查各时间节点的逻辑顺序是否正确"
        )

    def execute(self, report_data: Dict, context: Dict) -> ReviewIssue:
        sample_info = report_data.get("sample_info", {})
        issues = []

        sampling_date = sample_info.get("sampling_date")
        receive_date = sample_info.get("receive_date")
        test_date = sample_info.get("test_date")
        report_date = sample_info.get("report_date")

        # 解析日期
        def parse_date(date_str):
            if isinstance(date_str, datetime):
                return date_str
            if isinstance(date_str, str):
                try:
                    return datetime.strptime(date_str, "%Y-%m-%d")
                except ValueError:
                    return None
            return None

        dates = {
            "采样日期": parse_date(sampling_date),
            "收样日期": parse_date(receive_date),
            "检测日期": parse_date(test_date),
            "报告日期": parse_date(report_date),
        }

        # 检查时间顺序
        if dates["采样日期"] and dates["收样日期"]:
            if dates["采样日期"] > dates["收样日期"]:
                issues.append("采样日期晚于收样日期")

        if dates["收样日期"] and dates["检测日期"]:
            if dates["收样日期"] > dates["检测日期"]:
                issues.append("收样日期晚于检测日期")

        if dates["检测日期"] and dates["报告日期"]:
            if dates["检测日期"] > dates["报告日期"]:
                issues.append("检测日期晚于报告日期")

        # 检查日期合理性(不能是未来日期)
        now = datetime.now()
        for name, d in dates.items():
            if d and d > now:
                issues.append(f"{name}为未来日期({d.strftime('%Y-%m-%d')})")

        if issues:
            return self._fail(
                message=f"时间逻辑异常: {'; '.join(issues)}",
                location="日期信息",
                suggestion="请检查并修正日期信息"
            )
        return self._pass("时间逻辑检查通过")


class ParallelSampleDeviationRule(BaseRule):
    """A03-2: 平行试样组数与相对偏差检查（品类参数化）"""

    def __init__(self, max_deviation: float = 20.0, universal: bool = False):
        super().__init__(
            universal=universal,
            rule_id="A03-2",
            rule_name="平行样相对偏差检查",
            category=RuleCategory.QC_CHECK,
            severity=Severity.MAJOR,
            description="检查平行样测定结果的相对偏差是否在允许范围内"
        )
        self.max_deviation = max_deviation

    def execute(self, report_data: Dict, context: Dict) -> ReviewIssue:
        qc_data = report_data.get("qc_data", {})
        parallel_samples = qc_data.get("parallel_samples", [])

        required = self.param(context, "parallel_count")   # 品类参数：如螺栓 8 套
        if required and 0 < len(parallel_samples) < required:
            return self._fail(
                message=f"平行测定组数 {len(parallel_samples)} 少于该品类要求 {required}",
                location="质控数据-平行样",
                expected=f"不少于 {required} 组", actual=f"{len(parallel_samples)} 组",
                suggestion="按所引标准补足试样后重新判定")

        if not parallel_samples:
            # 检查是否需要做平行样
            if context.get("requires_parallel", False):
                return self._fail(
                    message="需要平行样数据但未找到",
                    location="质控数据-平行样",
                    suggestion="请补充平行样检测数据"
                )
            return ReviewIssue(
                rule_id=self.rule_id, rule_name=self.rule_name,
                category=self.category, severity=self.severity,
                status=ReviewStatus.SKIP,
                message="无平行样数据,规则跳过",
                location="质控数据"
            )

        failed_items = []
        for ps in parallel_samples:
            param_name = ps.get("parameter", "未知参数")
            val1 = ps.get("value1")
            val2 = ps.get("value2")

            if val1 is not None and val2 is not None:
                avg = (val1 + val2) / 2
                if avg != 0:
                    deviation = abs(val1 - val2) / avg * 100
                    max_dev = ps.get("max_deviation",
                                    self.param(context, "max_deviation", self.max_deviation))
                    if deviation > max_dev:
                        failed_items.append(
                            f"{param_name}: 偏差{deviation:.1f}% > {max_dev}%"
                        )

        if failed_items:
            return self._fail(
                message=f"平行样偏差超限: {'; '.join(failed_items)}",
                location="质控数据-平行样",
                expected=f"相对偏差 ≤ {self.max_deviation}%",
                actual='; '.join(failed_items),
                suggestion="请检查平行样数据,必要时重新检测"
            )
        return self._pass("平行样偏差检查通过")


class SignificantFiguresRule(BaseRule):
    """C01-1: 有效数字位数检查"""

    def __init__(self):
        super().__init__(
            rule_id="C01-1",
            rule_name="有效数字位数检查",
            category=RuleCategory.FORMAT_COMPLIANCE,
            severity=Severity.MINOR,
            description="检查检测结果的有效数字位数是否符合标准要求"
        )

    def execute(self, report_data: Dict, context: Dict) -> ReviewIssue:
        test_results = report_data.get("test_results", [])
        issues = []

        for result in test_results:
            param_name = result.get("parameter", "")
            value = result.get("value")
            required_sf = result.get("significant_figures")  # 标准要求的有效数字位数

            if value is not None and required_sf is not None:
                actual_sf = self._count_significant_figures(str(value))
                if actual_sf != required_sf:
                    issues.append(
                        f"{param_name}: 实际{actual_sf}位, 要求{required_sf}位"
                    )

        if issues:
            return self._fail(
                message=f"有效数字位数不符: {'; '.join(issues[:5])}",
                location="检测结果",
                suggestion="请按标准要求修正有效数字位数"
            )
        return self._pass("有效数字位数检查通过")

    @staticmethod
    def _count_significant_figures(value_str: str) -> int:
        """计算有效数字位数"""
        value_str = value_str.strip()
        if 'e' in value_str.lower():
            mantissa = value_str.lower().split('e')[0]
            return len(mantissa.replace('.', '').replace('-', '').lstrip('0'))

        value_str = value_str.replace('-', '')
        if '.' in value_str:
            integer_part, decimal_part = value_str.split('.')
            if integer_part.lstrip('0') == '' or integer_part == '0':
                return len(decimal_part.lstrip('0'))
            else:
                return len(integer_part.lstrip('0')) + len(decimal_part)
        else:
            return len(value_str.strip('0')) if value_str != '0' else 1


class StandardLimitCheckRule(BaseRule):
    """D01: 标准限值自动判定（属 M2 的 D 类，不在 M1 台账 45 条内）"""

    def __init__(self):
        super().__init__(
            rule_id="D01",
            rule_name="标准限值合格判定",
            category=RuleCategory.STANDARD_LIMIT,
            severity=Severity.CRITICAL,
            description="将检测结果与标准限值进行比对,自动判定合格/不合格"
        )

    def execute(self, report_data: Dict, context: Dict) -> ReviewIssue:
        test_results = report_data.get("test_results", [])
        standard_limits = context.get("standard_limits", {})
        misjudgments = []

        for result in test_results:
            param = result.get("parameter", "")
            value = result.get("value")
            reported_judgment = result.get("judgment", "")  # 报告中的判定
            
            limit_info = standard_limits.get(param)
            if not limit_info or value is None:
                continue

            # 计算应有的判定结果
            correct_judgment = self._judge(value, limit_info)
            
            if reported_judgment and reported_judgment != correct_judgment:
                misjudgments.append(
                    f"{param}: 检测值{value}, 限值{limit_info}, "
                    f"报告判定'{reported_judgment}', 应为'{correct_judgment}'"
                )

        if misjudgments:
            return self._fail(
                message=f"合格判定可能有误: {'; '.join(misjudgments)}",
                location="检测结果-合格判定",
                suggestion="请核实检测结果与标准限值的比对判定"
            )
        return self._pass("标准限值判定检查通过")

    @staticmethod
    def _judge(value: float, limit_info: Dict) -> str:
        """根据限值信息判定合格/不合格"""
        limit_type = limit_info.get("type", "max")  # max/min/range
        
        if limit_type == "max":
            limit_val = limit_info.get("max_value")
            return "合格" if value <= limit_val else "不合格"
        elif limit_type == "min":
            limit_val = limit_info.get("min_value")
            return "合格" if value >= limit_val else "不合格"
        elif limit_type == "range":
            min_val = limit_info.get("min_value")
            max_val = limit_info.get("max_value")
            return "合格" if min_val <= value <= max_val else "不合格"
        return "无法判定"


# ------ 审核引擎 ------

class ReviewEngine:
    """审核规则引擎"""

    def __init__(self):
        self.rules: List[BaseRule] = []
        self.version = "1.0.0"

    def register_rule(self, rule: BaseRule):
        """注册审核规则"""
        self.rules.append(rule)
        # 按优先级排序: CRITICAL > MAJOR > MINOR > INFO
        priority = {Severity.CRITICAL: 0, Severity.MAJOR: 1,
                    Severity.MINOR: 2, Severity.INFO: 3}
        self.rules.sort(key=lambda r: priority.get(r.severity, 99))

    def register_rules(self, rules: List[BaseRule]):
        for rule in rules:
            self.register_rule(rule)

    def execute_review(self, report_data: Dict, context: Dict = None) -> ReviewResult:
        """执行完整的审核流程"""
        import time
        start_time = time.time()
        
        context = context or {}
        issues: List[ReviewIssue] = []

        # 品类解析：绑定表决定启用与参数；未配置品类只跑通用集并给出可见提示
        category = (report_data.get("sample_info") or {}).get("category_code", "")
        context["category"] = category
        context.setdefault("bindings", {})
        if category and not context["bindings"]:
            issues.append(ReviewIssue(
                rule_id="CAT-UNCAT-01", rule_name="品类未配置规则绑定",
                category=RuleCategory.DATA_COMPLETENESS, severity=Severity.INFO,
                status=ReviewStatus.WARNING,
                message=f"品类 {category} 未配置专属规则，本次仅执行通用集 28 条",
                location="品类绑定",
                suggestion="在规则台账为该品类补 17 行品类专属绑定"))
            context["universal_only"] = True
        else:
            context["overrides"] = {rid: b.get("overrides", {})
                                    for rid, b in context["bindings"].items()}
        passed = 0
        failed = 0
        warnings = 0
        skipped = 0

        for rule in self.rules:
            # 检查规则是否适用
            if not rule.is_applicable(context):
                skipped += 1
                continue

            try:
                issue = rule.execute(report_data, context)
                issues.append(issue)

                if issue.status == ReviewStatus.PASS:
                    passed += 1
                elif issue.status == ReviewStatus.FAIL:
                    failed += 1
                elif issue.status == ReviewStatus.WARNING:
                    warnings += 1
                elif issue.status == ReviewStatus.SKIP:
                    skipped += 1

            except Exception as e:
                # 规则执行异常,记录但不阻断
                issues.append(ReviewIssue(
                    rule_id=rule.rule_id,
                    rule_name=rule.rule_name,
                    category=rule.category,
                    severity=Severity.INFO,
                    status=ReviewStatus.WARNING,
                    message=f"规则执行异常: {str(e)}",
                    location="系统",
                    suggestion="请联系系统管理员"
                ))
                warnings += 1

        # 计算总体结果
        executed = passed + failed + warnings
        critical_count = sum(1 for i in issues
                           if i.status == ReviewStatus.FAIL
                           and i.severity == Severity.CRITICAL)
        major_count = sum(1 for i in issues
                         if i.status == ReviewStatus.FAIL
                         and i.severity == Severity.MAJOR)
        minor_count = sum(1 for i in issues
                         if i.status == ReviewStatus.FAIL
                         and i.severity == Severity.MINOR)

        # 总体状态判定
        if critical_count > 0:
            overall_status = ReviewStatus.FAIL
        elif major_count > 0 or warnings > 0:
            overall_status = ReviewStatus.WARNING
        else:
            overall_status = ReviewStatus.PASS

        # 评分计算 (100分制)
        score = 100.0
        score -= critical_count * 20  # 每个严重问题扣20分
        score -= major_count * 10     # 每个一般问题扣10分
        score -= minor_count * 3      # 每个轻微问题扣3分
        score = max(0, score)

        elapsed_ms = int((time.time() - start_time) * 1000)

        return ReviewResult(
            report_id=report_data.get("report_id", "unknown"),
            review_time=datetime.now(),
            total_rules_executed=executed,
            total_rules_passed=passed,
            total_rules_failed=failed,
            total_rules_warning=warnings,
            overall_status=overall_status,
            overall_score=score,
            issues=[i for i in issues if i.status != ReviewStatus.PASS],  # 只返回有问题的
            critical_count=critical_count,
            major_count=major_count,
            minor_count=minor_count,
            review_duration_ms=elapsed_ms,
            engine_version=self.version
        )


# ------ 引擎初始化与使用示例 ------

def create_default_engine() -> ReviewEngine:
    """创建默认规则引擎(含所有标准规则)"""
    engine = ReviewEngine()
    engine.register_rules([
        SampleInfoCompletenessRule(),
        DateLogicRule(),
        ParallelSampleDeviationRule(universal=False),   # A03-2 属品类专属，见 3.9
        SignificantFiguresRule(),
        StandardLimitCheckRule(),
        # ... 更多规则
    ])
    return engine


# 使用示例（示例领域：电网物资——高强度螺栓连接副抽检）
if __name__ == "__main__":
    engine = create_default_engine()

    # 模拟报告数据：输电线路铁塔用钢结构高强度螺栓连接副 10.9级 M20
    report_data = {
        "report_id": "DQ-2026-00871",
        "sample_info": {
            "sample_id": "S-2026-00871",
            "sample_name": "钢结构用高强度大六角头螺栓连接副 10.9级 M20",
            "client_name": "XX电力物资有限公司",
            "receive_date": "2026-10-28",
            "sampling_date": "2026-10-27",
            "test_date": "2026-10-30",
            "report_date": "2026-11-02",
            "sample_status": "正常，封样完好",
            "category_code": "CAT-BOLT",
            "test_standard": "GB/T 1231-2010",
        },
        "test_results": [
            {"parameter": "抗拉强度", "value": 1043.6, "unit": "MPa",
             "judgment": "合格", "significant_figures": 4},
            {"parameter": "扭矩系数", "value": 0.131,
             "judgment": "合格", "significant_figures": 3},
            {"parameter": "硬度", "value": 35.2, "unit": "HRC",
             "judgment": "合格", "significant_figures": 3},
        ],
        "qc_data": {
            "parallel_samples": [
                # 同一批连接副取两组做扭矩系数平行测定
                {"parameter": "扭矩系数", "value1": 0.102, "value2": 0.152,
                 "max_deviation": 10},
            ]
        }
    }

    context = {
        "domain": "grid_material",
        "standard_limits": {
            # 10.9 级：GB/T 3098.1 规定 Rm >= 1000 MPa，硬度 HRC 32~39
            "抗拉强度": {"type": "min", "min_value": 1000},
            "硬度": {"type": "range", "min_value": 32.0, "max_value": 39.0},
            # GB/T 1231 规定扭矩系数平均值 0.110~0.150
            "扭矩系数": {"type": "range", "min_value": 0.110, "max_value": 0.150},
        },
        "requires_parallel": True,
        # 品类绑定（来自 ai_review_category_bindings，见 3.9）
        "bindings": {
            "A03-2": {"enabled": True, "overrides": {"parallel_count": 8, "max_deviation": 10}},
            "A01": {"enabled": True, "overrides": {}},
            "B01": {"enabled": True, "overrides": {}},
            "C01-1": {"enabled": True, "overrides": {}},
            "D01": {"enabled": True, "overrides": {}},
        },
    }

    result = engine.execute_review(report_data, context)
    print(result.summary)
    for issue in result.issues:
        print(f"  [{issue.severity.value}] {issue.rule_name}: {issue.message}")
    # 对照一：未配置绑定的品类（如电缆保护管）只跑通用集，并给出可见提示
    ctx_unbound = dict(context); ctx_unbound["bindings"] = {}
    r2 = engine.execute_review(report_data, ctx_unbound)
    print("\n[未配置品类对照] " + r2.summary)
    for issue in r2.issues:
        print(f"  [{issue.severity.value}] {issue.rule_name}: {issue.message}")

    # 对照二：绝缘手套逐只试验，A03-2 由绑定显式停用
    ctx_glove = dict(context)
    ctx_glove["bindings"] = {"A03-2": {"enabled": False},
                             "B01-3": {"enabled": True, "overrides": {"cycle_months": 6}}}
    r3 = engine.execute_review(report_data, ctx_glove)
    print("\n[绝缘手套对照] " + r3.summary + "  # A03-2 被绑定停用，故只执行 4 条")

