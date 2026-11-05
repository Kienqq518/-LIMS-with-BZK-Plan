/**
 * 通知公告 Mock Store（工作台「快讯中心」与「基础配置 › 通知公告」共用同一份数据）
 *
 * 日期一律按「距今天多少天前」生成，不写死日历日期——
 * 写死的话过两个月就又变成陈年旧闻，快讯中心看着像没人维护。
 * 新增/编辑/删除落在 localStorage（lims-notice-store-v1），刷新保留。
 */
(function (global) {
  'use strict';

  var STORE_KEY = 'lims-notice-store-v1';

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** n 天前的 date + 时间串 */
  function ago(n, hm) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + hm;
  }
  function day(n) { return ago(n, '00:00:00').slice(0, 10); }

  /** 演示数据：正常公告/通知 + 一条停用（停用的不进快讯中心，列表页能看到） */
  function seed() {
    return [
      { id: 12, title: '实验室AI助手已升级', type: '公告', status: '正常', operator: 'admin', createTime: ago(0, '09:12:30'),
        body: '实验室AI助手已升级到 V2.1：原始记录拍照识别（OCR）支持手写体修正，设备直连采集增加断连自动续传。\n升级窗口内采集数据不会丢失，识别结果仍需检测员确认后提交。\n遇到问题请在「日志管理 › 操作日志」里带上时间戳反馈给信息组。' },
      { id: 11, title: '本周六 22:00 系统例行维护', type: '通知', status: '正常', operator: 'admin', createTime: ago(1, '16:40:05'),
        body: '维护时间：本周六 22:00 至次日 02:00，期间 LIMS 与移动端 App 均不可登录。\n请提前保存未提交的检测记录与报告草稿，维护窗口内提交的记录会被丢弃。\n样品收发、留样查看等库房门禁不受影响。' },
      { id: 10, title: '11 月设备集中校准安排', type: '通知', status: '正常', operator: 'admin', createTime: ago(2, '10:05:18'),
        body: '数显卡尺 YBKC-02 / YBKC-03、微机控制电子万能试验机 LX-05 已到期或进入预警期，本周送省计量院集中校准。\n校准期间相关试验项请在「设备管理」里改选同类型可用设备，或在任务单上备注顺延。\n回来后可在设备台账的「历史记录」里上传校准报告。' },
      { id: 9, title: 'CMA 资质复审资料准备提醒', type: '公告', status: '正常', operator: '潘哲宁', createTime: ago(3, '14:22:47'),
        body: '复审组预计下月中旬进场，请各检测组在本周内提交：在用设备清单与检定证书、原始记录抽样、人员资质证书复印件。\n质量手册、程序文件按现行版本准备，不再单独打印，评审现场直接看系统。' },
      { id: 8, title: '检测报告及时率考核口径调整', type: '公告', status: '正常', operator: 'admin', createTime: ago(5, '11:03:12'),
        body: '从本月起，及时率分母只统计「报告已签发及之后」的委托，在制单不进分母。\n及时 = 已到报告发放 / 任务归档 / 任务完成，或仍在签发~收费审批但未过要求完成时间；其余计为未及时。\n工作台「检测报告及时率统计」已按新口径重算，历史月份数据不回溯。' },
      { id: 7, title: '新版样品标签模版上线', type: '公告', status: '正常', operator: 'admin', createTime: ago(7, '09:35:26'),
        body: '标签与合格证模版的「型号规格」统一改为「型号/分类」+ 空格 + 「规格」拼接，规格段多个取值用空格分隔。\n旧标签自本通知起作废，作废标签在「扫码追溯」里会显示「已作废」，请重新打印后再贴。\n模版配置入口：检测管理 › 模板管理 › 样品标签。' },
      { id: 6, title: '样品库年终盘点安排', type: '通知', status: '正常', operator: 'admin', createTime: ago(9, '15:48:33'),
        body: '盘点范围：在库样品、留样、已申请退样未取的样品。盘点期间暂停还样确认与发样操作。\n各委托的待退样品清单以「申请退样」页为准，请委托方在盘点前完成自取或确认快递地址。' },
      { id: 5, title: '实链智慧实验室流程图更新', type: '公告', status: '正常', operator: '潘哲宁', createTime: ago(12, '10:16:08'),
        body: '工作台底部流程图已替换为真系统导出的最新版本：新增「申请退样」分支，还样确认与样品退样拆成两个节点。\n流程环节对应的功能入口，直接用上方「数据概览」的 19 张卡片跳转。' },
      { id: 4, title: '实验室安全生产月活动总结', type: '公告', status: '正常', operator: 'admin', createTime: ago(16, '17:02:55'),
        body: '活动期间共完成 3 次应急演练、检查在用设备 42 台，发现并整改隐患 5 项（接地不良 2 项、标识缺失 3 项）。\n未整改项已挂到「设备管理」的备注里，请相关责任人本月内闭环。' },
      { id: 3, title: '委托单旧模版停用说明', type: '公告', status: '停用', operator: 'admin', createTime: ago(21, '13:26:41'),
        body: '2024 版委托单模版已停用，历史委托仍可导出当时的 PDF 存档，新委托一律走现行模版。\n本条状态为「停用」，因此不会出现在工作台快讯中心，仅在通知公告列表可见。' }
    ];
  }

  function load() {
    var data = null;
    try {
      var raw = global.localStorage.getItem(STORE_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) { data = null; }
    if (!data || Object.prototype.toString.call(data) !== '[object Array]' || !data.length) {
      data = seed();
      save(data);
    }
    return data;
  }

  function save(data) {
    try { global.localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* 存不下就用内存值 */ }
  }

  function sorted(data) {
    return data.slice().sort(function (a, b) {
      return a.createTime < b.createTime ? 1 : (a.createTime > b.createTime ? -1 : b.id - a.id);
    });
  }

  global.NoticeStore = {
    TYPES: ['公告', '通知'],
    STATUSES: ['正常', '停用'],
    list: function () { return sorted(load()); },
    /** 快讯中心用：只取正常，按创建时间倒序 */
    latest: function (n) {
      return sorted(load()).filter(function (r) { return r.status === '正常'; }).slice(0, n || 8);
    },
    get: function (id) {
      var hit = null;
      load().forEach(function (r) { if (String(r.id) === String(id)) hit = r; });
      return hit;
    },
    upsert: function (row) {
      var data = load(), i, found = false;
      for (i = 0; i < data.length; i++) {
        if (String(data[i].id) === String(row.id)) { data[i] = row; found = true; break; }
      }
      if (!found) {
        var max = 0;
        data.forEach(function (r) { if (r.id > max) max = r.id; });
        row.id = max + 1;
        data.push(row);
      }
      save(data);
      return row.id;
    },
    remove: function (id) {
      var data = load().filter(function (r) { return String(r.id) !== String(id); });
      save(data);
      return data.length;
    },
    /** 列表页展示用的短日期（YYYY-MM-DD） */
    day: function (createTime) { return String(createTime || '').slice(0, 10); },
    today: function () { return day(0); },
    reset: function () { var d = seed(); save(d); return d; }
  };
})(window);
