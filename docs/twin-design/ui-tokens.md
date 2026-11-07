# 数字孪生 · 视觉 token 表（twin-tokens.css）

唯一事实源：`twin/future-lab/twin-tokens.css`。宿主页 `twin-scene-v2.html` 与三维场景页 `tour-space-v3-1.html` **都加载它**——
跨 iframe 不继承 CSS 变量，所以场景内注入的实体信息气泡、房间标签、物联节点标记只有在这里定义才吃得到同一套值。
3D 侧（光点/描色/热力/行进线路）不写十六进制，开机时从 CSS 变量读进 `TWIN_TOKEN`（QA 可读 `window.__twinTokensForQA`）。

**纪律**：组件里不许再出现裸 hex / 裸 `blur(Npx)` / 裸 `font-size:Npx` / 裸 `z-index:N` / 裸 `border-radius:Npx`；
JS 生成 DOM 时也不许写内联 `style="font-size:…"`（本轮就在 `twin-scene-v2.js` 抓到两处 9.5px 内联死角）。
守这条纪律的是 `tests/twin/uiconcheck.mjs`（12 项，已挂进 run-all）。

| 校准依据（ui-ux-pro-max 设计库） | 落到本屏的口径 |
|---|---|
| glassmorphism：blur 10–20px、1px 浅描边、层级深度、文字对比 4.5:1 | `--tw-blur:blur(14px)` 全站一档；描边统一 `--tw-glass-border` |
| data-dense-dashboard：小字 12px 档、行高 36px、卡片 padding 12px、hover 行高亮 | 字号七档、地板 10.5px；数据行 hover 高亮补齐 |
| accessible-and-ethical：焦点环 2–4px、cursor:pointer、reduced-motion | `--tw-focus-ring:2px`；可点元素三态齐；场景页也吃 reduced-motion |
| 实时流图型：不许只靠颜色表达状态 | 状态一律「色 + 文字」双通道（A/B/C 字母、在测/就绪/异常词、LIMS 角标） |
| 库推荐的深色 + Orbitron/Exo2 | **有意不采用**：白底 CAD 运行镜像 + 中文界面（这两个字体无中文字形），PRD 决策基准已定 |
| 库的玻璃透明度 .10–.30 | **有意提高**到 .46/.72/.82：画面接近纯白，低透明度下小字对比掉到 4.5:1 以下 |

## token 清单

### 品牌与中性色

| token | 值 |
|---|---|
| `--tw-color-brand` | `#2878FF` |
| `--tw-color-brand-strong` | `#0B4FBF` |
| `--tw-color-brand-glow` | `#63A4FF` |
| `--tw-color-brand-soft` | `#EAF1FF` |
| `--tw-color-brand-line` | `#D7E4FF` |
| `--tw-color-textPrimary` | `#0F2740` |
| `--tw-color-textSecondary` | `#5B6B7D` |
| `--tw-color-textMuted` | `#8A97A7` |
| `--tw-color-cardBg` | `#fff` |
| `--tw-color-cardBorder` | `#E3E9F2` |
| `--tw-ink-1` | `#0F2740` |
| `--tw-ink-2` | `#3C4D61` |
| `--tw-ink-3` | `#5B6B7D` |
| `--tw-ink-4` | `#8A97A7` |

### 状态语义色

| token | 值 |
|---|---|
| `--tw-st-working` | `var(--tw-color-brand)` |
| `--tw-st-ready` | `var(--tw-color-okGreen)` |
| `--tw-st-alarm` | `var(--tw-color-alertRed)` |
| `--tw-st-warn` | `var(--tw-color-warnAmber)` |
| `--tw-st-bottleneck` | `var(--tw-color-bottleneckOrange)` |
| `--tw-st-idle` | `#94A3B8` |
| `--tw-st-done` | `#7E8C9B` |
| `--tw-st-na` | `#C3CCD6` |
| `--tw-st-cat` | `#7C6CF0` |
| `--tw-st-route` | `#E8D77A` |
| `--tw-color-okGreen` | `#16A34A` |
| `--tw-color-alertRed` | `#E5484D` |
| `--tw-color-warnAmber` | `#F59E0B` |
| `--tw-color-bottleneckOrange` | `#F76B15` |

### 玻璃与描边

| token | 值 |
|---|---|
| `--tw-blur` | `blur(14px)` |
| `--tw-sat` | `saturate(1.25)` |
| `--tw-glass-panel` | `rgba(255,255,255,.46)` |
| `--tw-glass-inner` | `rgba(255,255,255,.72)` |
| `--tw-glass-float` | `rgba(255,255,255,.82)` |
| `--tw-glass-head` | `rgba(244,248,253,.5)` |
| `--tw-glass-chip` | `rgba(255,255,255,.9)` |
| `--tw-glass-border` | `rgba(255,255,255,.88)` |
| `--tw-glass-on` | `rgba(255,255,255,.78)` |
| `--tw-glass-hover` | `rgba(255,255,255,.55)` |
| `--tw-hairline` | `#EDF1F7` |
| `--tw-hairline-soft` | `#F2F5FA` |
| `--tw-hairline-strong` | `#E6EDF6` |

### 圆角/阴影/垫底

| token | 值 |
|---|---|
| `--tw-radius-bar` | `3px` |
| `--tw-radius-badge` | `6px` |
| `--tw-radius-chip` | `8px` |
| `--tw-radius-card` | `14px` |
| `--tw-radius-pill` | `999px` |
| `--tw-shadow-card` | `0 16px 44px rgba(15,40,80,.13)` |
| `--tw-shadow-pill` | `0 4px 14px rgba(15,40,80,.06)` |
| `--tw-shadow-row` | `0 6px 18px rgba(40,120,255,.10)` |
| `--tw-press-ring` | `inset 0 0 0 1px rgba(40,120,255,.28)` |
| `--tw-text-plate` | `0 1px 0 rgba(255,255,255,.85),0 3px 12px rgba(255,25` |

### 字号与排版

| token | 值 |
|---|---|
| `--tw-fs-micro` | `10.5px` |
| `--tw-fs-label` | `11.5px` |
| `--tw-fs-body` | `12.5px` |
| `--tw-fs-strong` | `13.5px` |
| `--tw-fs-num` | `17px` |
| `--tw-fs-kpi` | `22px` |
| `--tw-fs-hero` | `26px` |
| `--tw-font-familyUI` | `"PingFang SC","Hiragino Sans GB","Microsoft YaHei",s` |
| `--tw-lh-tight` | `1.15` |
| `--tw-lh-body` | `1.5` |

### 动效

| token | 值 |
|---|---|
| `--tw-dur-1` | `.16s` |
| `--tw-dur-2` | `.24s` |
| `--tw-dur-3` | `.42s` |
| `--tw-dur-4` | `.6s` |
| `--tw-motion-easeOut` | `cubic-bezier(.2,.8,.2,1)` |

### 层级与几何

| token | 值 |
|---|---|
| `--tw-z-dock` | `9` |
| `--tw-z-panel` | `12` |
| `--tw-z-card` | `16` |
| `--tw-z-detail` | `24` |
| `--tw-z-top` | `30` |
| `--tw-rail-w` | `224px` |
| `--tw-stream-w` | `296px` |
| `--tw-panel-w` | `352px` |
| `--tw-float-gap` | `16px` |

### 浅底族

| token | 值 |
|---|---|
| `--tw-track` | `#EDF1F7` |
| `--tw-track-soft` | `#E4EAF1` |
| `--tw-tint-run-fg` | `var(--tw-color-brand-strong)` |
| `--tw-tint-run-bg` | `#E3EFFF` |
| `--tw-tint-ok-fg` | `#0B6B33` |
| `--tw-tint-ok-bg` | `#E4F6EA` |
| `--tw-tint-warn-fg` | `#8A5A0B` |
| `--tw-tint-warn-bg` | `#FBF0DC` |
| `--tw-tint-abn-fg` | `#8B2A2E` |
| `--tw-tint-abn-bg` | `#FDECEC` |
| `--tw-tint-abn-line` | `#F3C6C8` |
| `--tw-tint-cat-fg` | `var(--tw-st-cat)` |
| `--tw-tint-cat-bg` | `#F0EDFE` |
| `--tw-tint-cat-line` | `#E0DAFB` |
| `--tw-tint-alarm-line` | `#C7DBFF` |
| `--tw-tint-brand-line` | `#CFE0FF` |
| `--tw-surface-neutral` | `#EEF2F6` |
| `--tw-surface-line` | `#C6D2E0` |
| `--tw-track-line` | `#E6ECF3` |
| `--tw-plate-inverse` | `rgba(15,39,64,.86)` |

### 其他

| token | 值 |
|---|---|
| `--tw-on-color` | `#fff` |
| `--tw-scene-bg-a` | `#F3F5F8` |
| `--tw-scene-bg-b` | `#EDF2F8` |
| `--tw-focus-ring` | `2px solid var(--tw-color-brand)` |

## 玻璃四档怎么用

- **A `--tw-glass-panel`（.46）**：悬浮在三维画面上的大面板主体——**只剩区域面板与底栏四块**。
  ~~左栏、告警流~~ 在 2026-11-07 圈图后连这层底板也撤了（FR-40）：内容直接浮在画面上，
  可读性改由 `--tw-text-plate` 白垫底 + B 档行卡承担；顶栏那条先例（FR-33）就是这么走的。
- **B `--tw-glass-inner`（.72）**：面板内的次级块——告警分区卡、统计格、行。比外壳高一档才读得清。
- **C `--tw-glass-float`（.82）**：文字密集的独立浮层——实体信息气泡、右侧详情。
- **D `--tw-glass-head`（.5 偏冷白）**：表头与分组条。
- 顶栏**不属于任何一档**：它没有底色、没有边框、没有毛玻璃（FR-33），只有文字垫底 `--tw-text-plate`。

## 动效档位

`--tw-dur-1 .16s` 微反馈（hover/按下/小片切换）｜`--tw-dur-2 .24s` 状态变化｜`--tw-dur-3 .42s` 面板进出（进 420 / 出 240，exit faster than enter）｜`--tw-dur-4 .6s` 数据条生长。
**相机补间不吃这套**：切近 720ms、下钻 760ms 是空间连续性的量，见 `animation-spec.md` §20/§23；
滚动与呼吸的节奏（26s / 22s / 1.2s / 1.6s）是内容时间常数，改它们要连同循环剧本一起评估。
