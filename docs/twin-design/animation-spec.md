# 动效规格 V1（animation-spec.md）

> 输入：《视觉语言提取 V1.md》§5；方法：ui-designer 状态动效原则（短、有目的、不打断读数据）+ graphics 事件驱动 VFX 原则
> 全局：所有时长/缓动取自 `design-tokens.ts` 的 `motion`；`prefers-reduced-motion: reduce` 时仅保留状态色切换。

## 1. 相机动画曲线
| 场景 | 触发 | 曲线 | 参数 |
|---|---|---|---|
| 入场 | 页面加载完成 | `cubic-bezier(.25,.8,.35,1)` | 1200ms：从全景 1.25× 距离落到 S1 默认机位（轻微推进感） |
| 飞行定位 | `?focus=` 深链/点击房间 | 同上 | 900ms，先平移后 zoom（两段各 55%/45% 时长）；到位后目标脉冲一次 400ms |
| 巡航 idle | 60s 无交互 | linear 环绕 ≤2°/s + zoom 呼吸 ±2%（20s 周期） | 任何 pointerdown/wheel/keydown 立即接管并重置计时 |
| S2 巡检 | 手动「106 巡检」 | ease-in-out 关键帧链 | 入口→输送线→检测台1→2→机器人位，每站停留 3s，段间 1500ms |

## 2. 告警闪烁/脉冲
- 频率：**1.2s / ease-in-out / infinite**（OutlinePass `pulsePeriod:1.2` 与 CSS glow 同步）。
- 幅度：光晕 4px→12px、描边 alpha 1→0.55；**不做整块红白闪**（防癫痫风险，亮度变化 <20%）。
- 并发：同屏脉冲对象 ≤3，其余告警静态描边；超出进抽屉列表。
- 声音：V1 无（非目标）；预留 `intent:alarm-audio` 事件位。

## 3. 卡片/浮层动效
- 浮现：`opacity 0→1 + translateY 8px→0`，300ms `cubic-bezier(.2,.8,.2,1)`，多卡级联 60ms/张（按告警等级排序：A 最先）。
- 消失：150ms 仅 opacity（不缩放、不上浮，消失要"安静"）。
- 数值滚动：count-up 200ms，等宽数字容器防位移；sparkline 新采样 300ms tween 左移一格。
- 安灯操作反馈：按钮 pressed 缩放 0.97；成功后卡片降饱和并显示处理状态，**不由前端直接删除**（状态来自数据源）。

## 4. AGV/机器人路径动画
- 路径线：蓝色 `#2878FF` 虚线 dash-offset 流动，**2.4s/周期 linear infinite**；底色 `#BCD6FF` 静态实线 6px 垫底（参考图4的双层线）。
- 机器人本体：沿 `CatmullRomCurve3` 移动，巡航速度 0.8 m/s（three-world-m），转角自动降速（曲率>阈值时 0.4）；朝向切线对齐，yaw 平滑 200ms。
- 光晕：脚下蓝色径向渐变圆盘半径 1.2m，脉冲环 1.6s（与告警 1.2s 错开避免频闪叠加）。
- 到站：P 目标点 pop-in 300ms（scale 0.6→1 回弹 `cubic-bezier(.34,1.56,.64,1)`），随后工单卡浮现（§3 级联）。
- 数据驱动：位置来自调度系统位置流（1–5s 间隔），前端**插值不跳点**；断流>3 个周期 → 停走 + `stale` 灰化（诚实降级，路径线保留最后一段）。

## 5. 维度切换（5M1E）
- 切层：旧叠加层 150ms 淡出 → 新层 200ms 淡入 + 60ms 级联；相机不动（防晕）。
- 被过滤对象降透明度至 0.35 而非移除（保持空间锚定）。

## 6. 验收
- 任意动效在 1080p/Chrome 下综合帧时间 <16.7ms（profile 面板）；
- reduced-motion 全关循环类；
- 所有时长/缓动与 design-tokens.motion 一致，代码内不得出现魔法数字。
