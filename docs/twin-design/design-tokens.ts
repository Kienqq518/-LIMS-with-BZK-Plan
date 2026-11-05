/**
 * 数字孪生 · 设计令牌 V1（design-tokens.ts）
 * 依据：根目录《视觉语言提取 V1.md》+ 参考图 1–4（华为智慧工厂概念图）
 * 方法：threejs-aaa-graphics-builder / threejs-game-ui-designer 视觉规范框架
 * 用法：Web 端注入 CSS 变量；Three.js 侧直接 import 数值。改值只改本文件。
 */

export const color = {
  // 背景与地面
  bgGradient: ['#F3F5F8', '#FFFFFF'] as const,   // 页面底，160°
  floorBase: '#FAFBFC',
  floorGuideLine: '#E8D77A',                      // 浅金引导线
  floorReflection: 0.15,                          // 反射强度（0~1，弱）

  // 设备
  deviceBody: '#FFFFFF',
  deviceBodyAlt: '#E8EBEF',
  devicePanel: '#2A2F36',
  deviceScreen: '#111418',

  // 语义色（UI 与 3D 高亮共用）
  brand: '#2878FF',                               // 导航高亮/主按钮/轨迹线/机器人光晕
  alertRed: '#E5484D',                            // Grade A、设备告警描边
  alertRedFill: 'rgba(229,72,77,0.08)',
  alertRedRing: 'rgba(229,72,77,0.10)',
  bottleneckOrange: '#F76B15',                    // Grade B、瓶颈告警
  warnAmber: '#F59E0B',                           // Grade C、预警期
  okGreen: '#16A34A',                             // 正常、P 目标点、↑KPI

  // 数据波形分级（Beats 卡 sparkline）
  sparkPurple: '#8B5CF6',
  sparkOrange: '#F59E0B',
  sparkGreen: '#10B981',

  // 文字
  textPrimary: '#0F2740',
  textSecondary: '#5B6B7D',
  textMuted: '#8A97A7',

  // 卡片与描边
  cardBg: '#FFFFFF',
  cardBorder: '#E3E9F2',
  chipBg: '#EAF1FF',
  chipBorder: '#D7E4FF',
} as const;

export const font = {
  familyUI: '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Source Han Sans SC",system-ui,sans-serif',
  familyNum: '"Fira Code",ui-monospace,SFMono-Regular,Menlo,monospace', // 仅数字/编号，tabular-nums
  size: {
    display: 40,   // 左栏英文大标题（≥2560 宽取上限）
    h1: 34,
    kpiNumber: 26, // ↑21% / ↓9%
    beatsValue: 26,
    cardTitle: 14,
    body: 13,
    label: 11,     // 单位 min、KPI 标签、来源胶囊
  },
  weight: { title: 800, value: 800, body: 400 },
  letterSpacing: { display: 0.5 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, pagePad: 22, colLeft: [300, 480] } as const;

export const radius = { card: 16, cardInner: 12, icon: 12, pill: 999, frame: 8 } as const;

export const shadow = {
  card: '0 14px 40px rgba(15,40,80,0.14)',
  pill: '0 4px 14px rgba(15,40,80,0.06)',
  glowBlue: '0 0 0 6px rgba(40,120,255,0.18)',
  glowGreen: '0 0 0 8px rgba(22,163,74,0.18)',
  glowRedRing: '0 0 0 4px rgba(229,72,77,0.10)',
} as const;

export const motion = {
  easeOut: 'cubic-bezier(.2,.8,.2,1)',
  flyTo: 'cubic-bezier(.25,.8,.35,1)',
  cardIn: { duration: 300, stagger: 60, translateY: 8 },
  countUp: 200,
  alarmPulse: { duration: 1200, maxConcurrent: 3 },
  dashFlow: 2400,
  cameraIdleAfter: 60_000,
  cameraOrbitDegPerSec: 2,
} as const;

/** 注入 CSS 变量：document.documentElement.style 或 :root 文本 */
export function toCssVars(t: Record<string, any>, prefix = 'tw', acc: Record<string, string> = {}, path = ''): Record<string, string> {
  for (const [k, v] of Object.entries(t)) {
    const p = path ? `${path}-${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) toCssVars(v, prefix, acc, p);
    else acc[`--${prefix}-${p}`] = String(v);
  }
  return acc;
}
