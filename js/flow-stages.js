/**
 * LIMS 流程阶段常量（与系统参数-流程设置对齐）
 */
(function (global) {
  /** 完整流程顺序 */
  var FLOW_ORDER = [
    '委托登记', '样品收样', '委托确认', '费用审核', '样品制备', '样品发样', '试样分发',
    '试验检测', '组内审核', '数据审核', '报告编制', '报告审核', '报告签发',
    '报告处理', '收费审批', '报告发放', '任务归档', '任务完成'
  ];

  /** 报告签发及后续流程（含报告签发） */
  var POST_SIGN_STAGES = [
    '报告签发', '报告处理', '收费审批', '报告发放', '任务归档', '任务完成'
  ];

  /** 报告签发之前的流程 */
  var PRE_SIGN_STAGES = FLOW_ORDER.filter(function (s) {
    return POST_SIGN_STAGES.indexOf(s) === -1;
  });

  function isPostReportSign(status) {
    return POST_SIGN_STAGES.indexOf(status) !== -1;
  }

  /** 样品是否判定合格（未提供 judgment 时兼容旧数据：默认视为合格） */
  function isJudgmentPassed(item) {
    if (!item) return false;
    if (item.judgment == null || item.judgment === '') return true;
    return item.judgment === '合格' || item.judgment === 'pass' || item.judgment === true;
  }

  /** 是否展示/允许打印合格证：报告签发及后续 + 判定合格 + 短链未作废 */
  function canShowCert(item) {
    if (!item || !isPostReportSign(item.status)) return false;
    if (item.certRevoked) return false;
    if (!isJudgmentPassed(item)) return false;
    return true;
  }

  global.FlowStages = {
    FLOW_ORDER: FLOW_ORDER,
    POST_SIGN_STAGES: POST_SIGN_STAGES,
    PRE_SIGN_STAGES: PRE_SIGN_STAGES,
    isPostReportSign: isPostReportSign,
    isJudgmentPassed: isJudgmentPassed,
    canShowCert: canShowCert
  };
})(window);
