# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** LIMS Prototype
**Generated:** 2026-11-03 09:21:23
**Category:** Analytics Dashboard
**Design Dials:** Motion 2/10 (Subtle) | Density 8/10 (Dense / Dashboard)

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1E40AF` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#3B82F6` | `--color-secondary` |
| On Secondary | `#000000` | `--color-on-secondary` |
| Accent/CTA | `#D97706` | `--color-accent` |
| On Accent/CTA | `#000000` | `--color-on-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#1E3A8A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#1E3A8A` | `--color-card-foreground` |
| Muted | `#E9EEF6` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#DBEAFE` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#1E40AF` | `--color-ring` |

**Color Notes:** Blue data + amber highlights [Accent adjusted from #F59E0B]

### Typography

- **Heading Font:** Fira Code
- **Body Font:** Fira Sans
- **Mood:** dashboard, data, analytics, code, technical, precise
- **Google Fonts:** [Fira Code + Fira Sans](https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap');
```

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #D97706;
  color: #000000;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #1E40AF;
  border: 2px solid #1E40AF;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #F8FAFC;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #1E40AF;
  outline: none;
  box-shadow: 0 0 0 3px #1E40AF20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Data-Dense Dashboard

**Keywords:** Multiple charts/widgets, data tables, KPI cards, minimal padding, grid layout, space-efficient, maximum data visibility

**Best For:** Business intelligence dashboards, financial analytics, enterprise reporting, operational dashboards, data warehousing

**Key Effects:** Hover tooltips, chart zoom on click, row highlighting on hover, smooth filter animations, data loading spinners

### Page Pattern

**Pattern Name:** Enterprise Gateway

- **Conversion Strategy:** Path selection (I am a...). Mega menu navigation. Trust signals prominent. Provide pause/stop for video and rotating logos; stop on focus and reduced motion. Logo carousel controls must be keyboard operable; pause moving media offscreen/hidden and render a static final state under reduced motion.
- **CTA Placement:** Contact Sales (Primary) + Login (Secondary)
- **Section Order:** Hero (Video/Mission) > Solutions by Industry > Solutions by Role > Client Logos > Contact Sales

---

## Motion

**Scroll Reveal** (Subtle) — Trigger: scroll (viewport enter) | Duration: 300-400ms | Easing: `power1.out`

```js
gsap.from(el, { opacity: 0, y: 12, duration: 0.35, ease: 'power1.out', scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none reverse' } });
```

**Framework notes:** Requires the ScrollTrigger plugin registered once via gsap.registerPlugin(ScrollTrigger); Use matchMedia('(prefers-reduced-motion: reduce)') to skip non-essential motion and render the final state immediately

- ✅ Keep the y offset small (8-16px) so it reads as a fade, not a slide
- ❌ Don't reveal below-the-fold content needed for SEO/crawlers as invisible-by-default without a no-JS fallback
- ⚡ toggleActions 'play none none reverse' avoids re-triggering on every scroll direction change

---

## Anti-Patterns (Do NOT Use)

- ❌ Ornate design
- ❌ No filtering

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

## 本项目修正（2026-11-03，Codex）

> 上面是 ui-ux-pro-max 数据库生成的原始方案。以下几条是按本仓库实际情况（中文界面 + 数据密集型 LIMS 后台）做的修正，**优先级高于上方生成结果**。

### 1. 字体：生成结果不可直接用

- 库给出的 `Fira Code / Fira Sans` 全是拉丁字体，**不含中文字形**，中文标题会静默回退到系统字体，等于没设计。
- 中文正文/标题：`var(--font-ui)` = PingFang SC / 思源黑体 / 微软雅黑 系统栈（原型阶段不引 Web Font，避免 CDN 抖动）。
- `Fira Code` **只用于数据列**：委托编号、样品编号、标准号（DL/T 976-2017）、日期、检测数值、金额。这是 LIMS 的辨识度所在——编号位数对齐、审核时逐位比对不跳。
- 所有数字列加 `font-variant-numeric: tabular-nums`。

### 2. 颜色：语义分层，不做花活

| 用途 | 值 | 说明 |
|------|-----|------|
| 正文 | `#1e293b` | 生成方案的 `#1E3A8A` 深蓝只用于标题/关键标识，正文用它会累 |
| 次级说明 | `#475569` | ≥7:1 |
| 弱提示下限 | `#64748b` | 4.7:1，**禁止 `#94a3b8`/`#cbd5e1` 当正文色**（2.8:1 / 1.9:1，全站曾误用 448 处） |
| 主色 | `#1e40af` | 链接、主按钮、焦点环 |
| 强调 | `#d97706` | 仅用于「失效 / 待处理 / 重新生成」这类需要预警的状态 |
| 危险 | `#dc2626` | 删除、校验不通过 |

### 3. 尺寸底线

- 最小字号 **11px**（中文 10px 在 1080p 屏上不可读）；打印模板与演示 deck 例外，按纸张实际尺寸走。
- 触控/点击热区：桌面端图标按钮 ≥24×24，行内操作按钮间距 ≥8px。
- 焦点环：`2px solid #1e40af` + `outline-offset: 2px`，`:focus-visible`，全站已在 `css/ui-baseline.css` 落地。

### 4. 图标

- 目标态：SVG（Phosphor 优先，Heroicons 兜底），装饰性图标 `aria-hidden="true"`，图标即按钮必须给 `aria-label`。
- 现状：FontAwesome 4.7 图标字体（690 处），属**待迁移项**，迁移前由 `js/ui-a11y.js` 机械补齐可访问名。

### 5. 原型舞台（需求文档双栏）

- 打开需求文档时，左侧原型进入固定宽高比画布：默认 **1440×900（16:10）**，等比缩放，**不重排**。
- 画布内 `position: fixed` 层（弹窗 / 抽屉 / 通栏条）钉在可视框内；内容在画布内部滚动。
- 批注圆点与卡片反向缩放，画布缩到 55% 时仍保持可读可点。
- 宽高比（16:10 / 16:9 / 4:3）与缩放（适应 / 1:1）由舞台栏切换，写入 localStorage。

### 6. 反模式（本项目明确不要）

奶油底 `#F4F1EA` + 陶土橙强调；纯黑底 + 荧光绿；所有卡片同一圆角同一灰阴影；每个标题上方的全大写 eyebrow 标签；`A · B · C` 中间点元信息；链接文案尾部挂 `→`。
