/**
 * 实验室运行模式（原型）
 * compliance = 合规版；practical = 实务版
 *
 * 【本期】强制实务版：不安排运行模式切换开发；切换 UI 已隐藏。
 * 合规版逻辑与切换能力保留在代码/设计里，后续再启用 FORCE_PRACTICAL。
 *
 * 历史视角角色：business = 业务人员；admin = 管理员
 */
(function (global) {
  var KEY = 'lims_lab_run_mode_v1';
  var ROLE_KEY = 'lims_history_role_v1'; // business | admin

  /** 为 true 时忽略 localStorage 中的 mode，一律按实务版运行 */
  var FORCE_PRACTICAL = true;

  var DEFAULTS = {
    mode: 'practical',
    allowReportEditAfterIssue: true, // 实务版原型：签发后默认可编（配置入口暂隐藏）
    switchedAt: null,
    switchedBy: null,
    reason: ''
  };

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var state = raw ? Object.assign({}, DEFAULTS, JSON.parse(raw)) : Object.assign({}, DEFAULTS);
      if (FORCE_PRACTICAL) state.mode = 'practical';
      return state;
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function write(state) {
    if (FORCE_PRACTICAL) state.mode = 'practical';
    localStorage.setItem(KEY, JSON.stringify(state));
    try {
      global.dispatchEvent(new CustomEvent('lims-run-mode-change', { detail: state }));
    } catch (e) { /* ignore */ }
  }

  function getState() {
    return read();
  }

  function isCompliance() {
    if (FORCE_PRACTICAL) return false;
    return read().mode === 'compliance';
  }

  function canManualEdit(docType, reportIssued) {
    if (isCompliance()) return false;
    if (docType === 'fee_notice') return false; // PDF，无 PageOffice 编辑
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
    // 本期未开放切换：强制保持实务版
    if (FORCE_PRACTICAL) {
      var frozen = read();
      write(frozen);
      return { from: 'practical', to: 'practical', state: frozen, forced: true };
    }
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
   * 实务版：所有人看到的历史一致，含全部系统主版本 + 人工次版本
   * 合规版（未启用）：仅 admin，且只含系统主版本
   */
  function filterHistory(versions, currentMajor) {
    var list = versions.slice();
    if (isCompliance()) {
      if (!isAdmin()) return [];
      return list.filter(function (v) { return Number(v.minor) === 0; });
    }
    // 实务版：不做角色过滤，系统主版本全部展示
    return list;
  }

  global.LimsLabRunMode = {
    FORCE_PRACTICAL: FORCE_PRACTICAL,
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
