/**
 * 实验室运行模式（原型）
 * compliance = 合规版；practical = 实务版
 * 整套系统一套；localStorage 跨页共享
 */
(function (global) {
  var KEY = 'lims_lab_run_mode_v1';
  var ROLE_KEY = 'lims_history_role_v1'; // business | quality（原型视角）

  var DEFAULTS = {
    mode: 'practical',
    allowReportEditAfterIssue: false,
    switchedAt: null,
    switchedBy: null,
    reason: ''
  };

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function write(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      global.dispatchEvent(new CustomEvent('lims-run-mode-change', { detail: state }));
    } catch (e) { /* ignore */ }
  }

  function getState() {
    return read();
  }

  function isCompliance() {
    return read().mode === 'compliance';
  }

  function canManualEdit(docType, reportIssued) {
    if (isCompliance()) return false;
    if (docType === 'report' && reportIssued) {
      return !!read().allowReportEditAfterIssue;
    }
    return true;
  }

  function canShowMinorsInHistory() {
    return !isCompliance();
  }

  function canShowAdvancedMajors() {
    // 实务版：质量负责人可看旧主版本；合规版：所有人只看主版本列表（无次版本）
    return getHistoryRole() === 'quality';
  }

  function switchMode(nextMode, meta) {
    var s = read();
    var from = s.mode;
    s.mode = nextMode === 'compliance' ? 'compliance' : 'practical';
    s.switchedAt = new Date().toISOString();
    s.switchedBy = (meta && meta.by) || 'admin';
    s.reason = (meta && meta.reason) || '';
    write(s);
    return { from: from, to: s.mode, state: s };
  }

  function setFlexibility(partial) {
    var s = read();
    if (typeof partial.allowReportEditAfterIssue === 'boolean') {
      s.allowReportEditAfterIssue = partial.allowReportEditAfterIssue;
    }
    write(s);
    return s;
  }

  function getHistoryRole() {
    return localStorage.getItem(ROLE_KEY) === 'quality' ? 'quality' : 'business';
  }

  function setHistoryRole(role) {
    localStorage.setItem(ROLE_KEY, role === 'quality' ? 'quality' : 'business');
  }

  /**
   * 过滤历史版本列表（原型）
   * versions: [{ major, minor, label, source, ... }]
   * currentMajor: number
   */
  function filterHistory(versions, currentMajor) {
    var list = versions.slice();
    var compliance = isCompliance();
    var role = getHistoryRole();

    if (compliance) {
      list = list.filter(function (v) { return Number(v.minor) === 0; });
      // 合规版：所有人可见各主版本（迎检看系统谱系）；不再按业务只限当前 major
      return list;
    }

    // 实务版
    if (role === 'business') {
      list = list.filter(function (v) { return Number(v.major) === Number(currentMajor); });
    }
    // quality：全链
    return list;
  }

  global.LimsLabRunMode = {
    getState: getState,
    isCompliance: isCompliance,
    canManualEdit: canManualEdit,
    canShowMinorsInHistory: canShowMinorsInHistory,
    canShowAdvancedMajors: canShowAdvancedMajors,
    switchMode: switchMode,
    setFlexibility: setFlexibility,
    getHistoryRole: getHistoryRole,
    setHistoryRole: setHistoryRole,
    filterHistory: filterHistory,
    DEFAULTS: DEFAULTS
  };
})(window);
