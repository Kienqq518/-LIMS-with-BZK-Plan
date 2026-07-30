/**
 * 实验室运行模式（原型）
 * compliance = 合规版；practical = 实务版
 * 整套系统一套；localStorage 跨页共享
 *
 * 历史视角角色：business = 业务人员；admin = 管理员
 */
(function (global) {
  var KEY = 'lims_lab_run_mode_v1';
  var ROLE_KEY = 'lims_history_role_v1'; // business | admin

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

  function getHistoryRole() {
    var r = localStorage.getItem(ROLE_KEY);
    // 兼容旧值 quality → admin
    if (r === 'quality' || r === 'admin') return 'admin';
    return 'business';
  }

  function setHistoryRole(role) {
    localStorage.setItem(ROLE_KEY, role === 'admin' ? 'admin' : 'business');
  }

  function isAdmin() {
    return getHistoryRole() === 'admin';
  }

  /** 操作列是否显示「查看历史」 */
  function canShowHistoryButton() {
    // 合规版：仅 admin 可见；业务人员不展示按钮
    if (isCompliance()) return isAdmin();
    // 实务版：有历史权限的角色均可（原型：业务与 admin 都显示）
    return true;
  }

  function canShowAdvancedMajors() {
    // 实务版：admin 可看旧主版本；合规版：admin 仍只看主版本列表（无次版本）
    return isAdmin();
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

  /**
   * 过滤历史版本列表（原型）
   * versions: [{ major, minor, label, source, ... }]
   * currentMajor: number
   */
  function filterHistory(versions, currentMajor) {
    var list = versions.slice();
    var compliance = isCompliance();
    var admin = isAdmin();

    if (compliance) {
      // 合规版：仅 admin 能打开历史；内容只含系统主版本
      if (!admin) return [];
      return list.filter(function (v) { return Number(v.minor) === 0; });
    }

    // 实务版：业务只看当前 major；admin 看全链
    if (!admin) {
      list = list.filter(function (v) { return Number(v.major) === Number(currentMajor); });
    }
    return list;
  }

  global.LimsLabRunMode = {
    getState: getState,
    isCompliance: isCompliance,
    isAdmin: isAdmin,
    canManualEdit: canManualEdit,
    canShowHistoryButton: canShowHistoryButton,
    canShowAdvancedMajors: canShowAdvancedMajors,
    switchMode: switchMode,
    setFlexibility: setFlexibility,
    getHistoryRole: getHistoryRole,
    setHistoryRole: setHistoryRole,
    filterHistory: filterHistory,
    DEFAULTS: DEFAULTS
  };
})(window);
