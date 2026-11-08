/* =============================================================================
 * 数字孪生大屏 · 3D 图表层（G2 v5）
 *
 * 为什么是「等轴挤出」而不是透视 3D：
 *   大屏的读数要能直接比大小。透视 3D 会让近处的柱子看起来比远处的高（同一数值不同高度），
 *   在售前投影与运维读屏两种场景里都是错的。这里数据面保持正交（y 仍是线性可比刻度），
 *   只给每根柱/每片环/每条折线挤出顶面与侧面厚度 —— 立体感来自几何，不来自欺骗。
 *
 * 实现口径：
 *   · G2 v5 Spec Mode（type/encode/scale/style），不用已废弃的链式 API；
 *   · 立体几何用 type:'polygon'（每面一组点）。不注册自定义 shape：v5 的 shape 注册没有公开文档，版本一升就碎；
 *   · 面颜色走 style.fill 回调，**不走 encode.color**：把 hex 塞进数据当类别色会被序数色板重新分配
 *     （实测把蓝红两组染成紫绿），图例也会变成一堆没语义的色块；
 *   · 颜色与字号全部从 twin-tokens.css 读，图表和浮层是同一套视觉语言；
 *   · 深度用数据单位表达但相对值固定（dy = yMax × 5.5%），像素深度恒等于绘图高度的 5.5%，
 *     换数据范围不会变胖变瘦，也不需要知道绘图区的像素尺寸。
 * 降级：G2 走本地 vendor（不依赖 CDN，展厅断网也能开）；加载失败或容器隐藏时数字表格照常显示——
 *   图表是读数的一种呈现，不是读数的唯一来源。
 * ========================================================================== */
(function (global) {
  const G2_SRC = 'vendor/g2.min.js';
  let loading = null;
  const registry = new Map();
  const state = { ready: false, failed: false, errors: [], rendered: 0, updated: 0 };
  global.__twinCharts = { state, registry, list: () => [...registry.values()].map(r => ({ name: r.name, kind: r.kind, sig: r.sig, pending: !!r.pending })) };

  function load() {
    if (global.G2) { state.ready = true; return Promise.resolve(); }
    if (state.failed) return Promise.reject(new Error('g2 已加载失败'));
    if (!loading) loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = G2_SRC; s.async = true;
      s.onload = () => { state.ready = true; res(); };
      s.onerror = () => { state.failed = true; rej(new Error('vendor/g2.min.js 加载失败')); };
      document.head.append(s);
    });
    return loading;
  }

  /* ---------- token 读取：图表不许自带一套颜色 ---------- */
  const tv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function palette() {
    return {
      brand: tv('--tw-color-brand') || '#2878FF',
      working: tv('--tw-st-working') || '#2878FF', ready: tv('--tw-st-ready') || '#16A34A',
      alarm: tv('--tw-st-alarm') || '#E5484D', warn: tv('--tw-st-warn') || '#F59E0B',
      idle: tv('--tw-st-idle') || '#94A3B8', done: tv('--tw-st-done') || '#7E8C9B', na: tv('--tw-st-na') || '#C3CCD6',
      ink1: tv('--tw-ink-1') || '#0F2740', ink3: tv('--tw-ink-3') || '#5B6B7D', ink4: tv('--tw-ink-4') || '#8D9AAB',
      fsLabel: parseFloat(tv('--tw-fs-label')) || 11.5, fsBody: parseFloat(tv('--tw-fs-body')) || 12.5,
      fsMicro: parseFloat(tv('--tw-fs-micro')) || 10.5
    };
  }
  const toRgb = h => { const s = h.replace('#', ''); const n = parseInt(s.length === 3 ? s.split('').map(c => c + c).join('') : s, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (hex, target, k) => toHex(toRgb(hex).map((v, i) => v + (target[i] - v) * k));
  const lighten = (hex, k) => mix(hex, [255, 255, 255], k);
  const darken = (hex, k) => mix(hex, [12, 24, 40], k);
  const faces = hex => ({ front: hex, top: lighten(hex, .42), side: darken(hex, .30) });

  /* ---------- 几何 ---------- */
  function barFaces(items, opt) {
    const dx = opt.dx || .24, ymax = Math.max(1, opt.max || Math.max.apply(null, items.map(d => d.v))), dy = ymax * .055;
    const poly = [], lab = [];
    items.forEach((d, i) => {
      const f = faces(d.c), v = Math.max(0, d.v);
      poly.push({ pts: [[i, 0], [i + 1 - dx, 0], [i + 1 - dx, v], [i, v]], c: f.front });
      if (v > 0) {
        poly.push({ pts: [[i, v], [i + 1 - dx, v], [i + 1, v + dy], [i + dx, v + dy]], c: f.top });
        poly.push({ pts: [[i + 1 - dx, 0], [i + 1 - dx, v], [i + 1, v + dy], [i + 1, dy]], c: f.side });
      }
      lab.push({ x: i + .42, y: v, t: String(d.v), k: d.k });
    });
    return { poly, lab, dy, ymax };
  }
  function groupFaces(groups) {
    const ymax = Math.max(1, Math.max.apply(null, groups.map(g => Math.max.apply(null, g.s.map(s => s.v))))), dy = ymax * .05, dx = .16, pw = .34;
    const poly = [], lab = [];
    groups.forEach((g, i) => g.s.forEach((s, j) => {
      const f = faces(s.c), x = i + .1 + j * (pw + .06), v = Math.max(0, s.v);
      poly.push({ pts: [[x, 0], [x + pw, 0], [x + pw, v], [x, v]], c: f.front });
      poly.push({ pts: [[x, v], [x + pw, v], [x + pw + dx, v + dy], [x + dx, v + dy]], c: f.top });
      poly.push({ pts: [[x + pw, 0], [x + pw, v], [x + pw + dx, v + dy], [x + pw + dx, dy]], c: f.side });
      if (j === g.s.length - 1) lab.push({ x: x + pw / 2 + dx / 2, y: -ymax * .1, t: g.k, head: 1 });
      lab.push({ x: x + pw / 2 + (j ? dx : 0) / 2, y: v + dy * 1.8, t: String(s.v) });
    }));
    return { poly, lab, dy, ymax };
  }
  const TAU = Math.PI * 2;
  function arc(cx, cy, rx, ry, a0, a1, n) {
    const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p;
  }
  function ringFaces(items, opt) {
    const total = items.reduce((s, d) => s + Math.max(0, d.v), 0) || 1;
    /* cx 可偏左：左栏只有 200px 宽，环居中再把图例塞在下面会糊成一团；环靠左、图例靠右才读得开 */
    const cx = opt.cx == null ? .5 : opt.cx, cy = opt.cy == null ? .5 : opt.cy, rx = opt.rx || .34, ry = rx * (opt.flat || .55);
    const dep = rx * (opt.depth == null ? .16 : opt.depth), ir = opt.inner || .5;
    /* 扇区分隔角（2026-11-08 产品负责人「环形图很丑」）：
       原来四档挤成一条连续环，运行中(蓝)与待机(灰)明度又接近，读起来是一坨色带而不是"分布"。
       两档以上时每档两端各让开半个缝，成为独立挤出块——和场景里"物件"的语言一致；
       同时把侧面压暗的幅度收小（.30→.18）、顶面提亮（.42→.50）并描一根极淡白边，立体感在但不脏。 */
    const nz = items.filter(d => d.v > 0).length;
    const pad = nz > 1 ? (opt.padDeg == null ? 5 : opt.padDeg) * Math.PI / 180 : 0;
    let a = -Math.PI / 2; const poly = [];
    items.forEach(d => {
      const v = Math.max(0, d.v); if (!v) return;
      const a1 = a + v / total * TAU;
      const s0 = a + pad / 2, s1 = a1 - pad / 2;
      const top = lighten(d.c, .5), side = darken(d.c, .18);
      if (s1 > s0) {
        poly.push({ pts: [...arc(cx, cy - dep, rx, ry, s0, s1, 30), ...arc(cx, cy - dep, rx * ir, ry * ir, s1, s0, 30)], c: top, cap: 1 });
        poly.push({ pts: [...arc(cx, cy, rx, ry, s0, s1, 30).reverse(), ...arc(cx, cy - dep, rx, ry, s0, s1, 30)], c: d.c });
        poly.push({ pts: [...arc(cx, cy, rx * ir, ry * ir, s0, s1, 30), ...arc(cx, cy - dep, rx * ir, ry * ir, s0, s1, 30).reverse()], c: side });
      }
      a = a1;
    });
    return { poly, total, dep, rx };
  }
  /* 折线带：连续平滑曲线，不画点（2026-11-07 反馈：点状折线太碎、不好看）。
     Catmull-Rom 每段再采 6 个点，环带的上下两条边都用同一组平滑点，
     所以挤出厚度与曲线本身严格贴合——用 G2 的 smooth shape 就没法让侧面跟着弯。 */
  function smooth(pts) {
    if (pts.length < 3) return pts.slice();
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (var j = 0; j < 6; j++) {
        var t = j / 6, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
        ]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  }
  function ribbonFaces(values, color, top, times, band) {
    var n = values.length; if (n < 2) return { poly: [], pts: [], color: color };
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values), span = (hi - lo) || 1;
    /* 顶部留白由调用方给：图内画标题时线必须整体下移，否则 64px 高的图里标题直接压在线上（实测踩过） */
    var b0 = band ? band[0] : .06, b1 = band ? band[1] : (top == null ? .88 : top);
    /* 序列在自己的横向带内归一：温度(℃)与湿度(%RH)量纲不同，同一条带里各自拉伸就会频繁交叉
       （2026-11-08 产品负责人圈图：湿度数值本来就比温度高一倍，交叉线看着像"湿度有时低于温度"，是错的）。
       带由 ribbon() 按均值大小分配，绝对值一律写进端点标签与 tooltip，不靠轴读数。 */
    var raw = [], dx = .012, dy = .05, th = .035, poly = [];
    for (var i = 0; i < n; i++) raw.push([i / (n - 1), b0 + (values[i] - lo) / span * (b1 - b0)]);
    /* 平滑后点数比原始点多，但 tooltip 必须报"实际那一个采样"的数：按 x 反查最近的原始点，
       把真实值与真实时刻一起挂在 datum 上。归一化坐标只是画图用的内部量，
       绝不能进 tooltip——上一版没挂，hover 出来是 0.6777777… 和 y 0.662994…（产品负责人圈出来的）。 */
    var pts = smooth(raw).map(function (q) {
      var idx = Math.max(0, Math.min(n - 1, Math.round(q[0] * (n - 1))));
      return { x: q[0], y: q[1], i: idx, v: values[idx], t: times ? times[idx] : null };
    });
    for (var k = 0; k < pts.length - 1; k++) {
      var a = pts[k], c = pts[k + 1], fc = faces(color);
      poly.push({ pts: [[a.x, a.y], [c.x, c.y], [c.x, c.y - th], [a.x, a.y - th]], c: fc.front });
      poly.push({ pts: [[a.x, a.y], [c.x, c.y], [c.x + dx, c.y + dy], [a.x + dx, a.y + dy]], c: fc.top });
    }
    return { poly: poly, pts: pts, color: color };
  }

  /* ---------- 渲染底座 ---------- */
  function sizeOf(el) {
    if (!el || !el.isConnected) return 0;
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return 0;
    const r = el.getBoundingClientRect();
    return r.width < 40 || r.height < 20 ? 0 : Math.round(r.width);
  }
  function draw(el, name, kind, sig, specOf) {
    const w = sizeOf(el);
    if (!w) { registry.set(name, { name, kind, sig: 'pending', pending: true, el }); return false; }
    let rec = registry.get(name);
    /* 身份 = 名字 + 容器元素：106 的 #chartZoneStats 与 103 的 #chartZoneItems 都叫 zstats，
       只按名字复用时，切房间会把更新打到上一个（现已隐藏的）容器上，新容器永远画不出 canvas。 */
    if (rec && rec.el && rec.el !== el) { if (rec.chart) { try { rec.chart.destroy(); } catch (e) { } } registry.delete(name); rec = null; }
    if (rec && !rec.pending && rec.sig === sig && rec.w === w) return true;
    let spec; try { spec = specOf(); } catch (e) { state.errors.push(name + ' spec: ' + e.message); return false; }
    const h = spec.__h; delete spec.__h;
    try {
      /* 数据变了就走「增量更新」而不是 destroy+重建：设备状态、队列 shown、温湿度读数每拍都可能动，
         重建会先清空 canvas 再画，大屏上就是每 2 秒闪一下白（实测 rendered 计数一路涨到 19）。
         G2 v5 的 chart.options() 是深合并 + diff 重绘，正好是这条路径。 */
      let c = rec && rec.chart && rec.kind === kind && rec.w === w ? rec.chart : null;
      if (c) { c.options(spec); c.render(); state.updated++; }
      else {
        c = new global.G2.Chart({ container: el, width: w, height: h, autoFit: false });
        c.options(spec); c.axis(false); c.legend(false); c.render();
        state.rendered++;
      }
      registry.set(name, { name, kind, sig, chart: c, w, el });
      return true;
    } catch (e) { state.errors.push(name + ': ' + e.message); registry.delete(name); return false; }
  }

  const Charts = {
    /** 3D 柱状：量级比较（状态计数、分段数量） */
    bar(el, name, items, o) {
      o = o || {}; const p = palette();
      const data = items.map((d, i) => ({ k: d.k, v: d.v, c: d.c || [p.working, p.ready, p.alarm, p.idle, p.done, p.na][i % 6] }));
      return draw(el, name, 'bar', JSON.stringify(data), () => {
        const g = barFaces(data, o), h = o.height || 92;
        return {
          /* children 里不许留 null：G2 拿到 null 子节点会整张图不渲染（实测把 cap 改成条件元素后，
             圆环直接消失、注册表里查不到 devices）。所以统一 .filter(Boolean)。 */
          __h: h, type: 'view', children: [
            { type: 'polygon', data: g.poly, encode: { x: d => d.pts.map(q => q[0]), y: d => d.pts.map(q => q[1]) }, style: { fill: d => d.c, inset: 0 } },
            { type: 'text', data: g.lab, encode: { x: 'x', y: d => d.y + g.dy * 2.6, text: 't' }, style: { fontSize: p.fsBody, fontWeight: 700, fill: p.ink1, textAlign: 'center' } },
            { type: 'text', data: g.lab, encode: { x: 'x', y: () => -g.ymax * .16, text: 'k' }, style: { fontSize: p.fsLabel, fill: p.ink3, textAlign: 'center' } }
          ],
          scale: { x: { type: 'linear', domain: [-.62, data.length - .38], nice: false }, y: { type: 'linear', domain: [-g.ymax * .22, g.ymax * 1.18], nice: false } }
        };
      });
    },
    /** 3D 分组柱：同一分类两个口径（今日 / 未解除） */
    group(el, name, groups, o) {
      o = o || {}; const p = palette();
      const data = groups.map(g => ({ k: g.k, s: g.s.map((s, i) => ({ v: s.v, c: s.c || (i ? p.alarm : p.working) })) }));
      return draw(el, name, 'group', JSON.stringify(data), () => {
        const g = groupFaces(data), h = o.height || 100;
        return {
          __h: h, type: 'view', children: [
            { type: 'polygon', data: g.poly, encode: { x: d => d.pts.map(q => q[0]), y: d => d.pts.map(q => q[1]) }, style: { fill: d => d.c, inset: 0 } },
            { type: 'text', data: g.lab, encode: { x: 'x', y: 'y', text: 't' }, style: { fontSize: p.fsLabel, fontWeight: d => d.head ? 400 : 700, fill: d => d.head ? p.ink3 : p.ink1, textAlign: 'center' } }
          ],
          scale: { x: { type: 'linear', domain: [-.08, data.length + .08], nice: false }, y: { type: 'linear', domain: [-g.ymax * .2, g.ymax * 1.22], nice: false } }
        };
      });
    },
    /** 3D 环形：构成占比（类别少才用；类别多请回表格）。
        o.legend===false 时图例交回宿主 HTML（底栏块1 用四行图例带占比，比图上小字更可读）；
        中心恒为合计——不提供 centerTop 副标题：洞是扁的（等轴挤出），两行字必然压到环带上。 */
    donut(el, name, items, o) {
      o = o || {}; const p = palette();
      /* list 必须跟着过这道 filter/map：上一版只搬 k/v/c，hover 卡片拿到的是空清单，
         环上悬停只剩一行「运行 6 台 · 55%」，产品要的名称/编号/分区/型号一条都没出来。 */
      const data = items.filter(d => d.v > 0).map((d, i) => ({ k: d.k, v: d.v, c: d.c || [p.working, p.ready, p.warn, p.idle][i % 4], list: d.list || [] }));
      /* 轨道签名只算档位与台数：设备清单（list）每拍都可能重排，把它算进签名会让圆环
         每 2s 无谓重建（重建会先清屏再画，大屏上就是闪一下白——FR-39 真实踩过）。 */
      return draw(el, name, 'donut', JSON.stringify(data.map(d => ({ k: d.k, v: d.v, c: d.c }))), () => {
        const g = ringFaces(data, o), h = o.height || 96;
        /* 把每档的三条色带（顶/前/侧）与该档设备清单挂到容器上：宿主 hover 读像素比色用，
           图表几何改了也不用同步改命中逻辑。 */
        el.__ring = data.map(d => ({ k: d.k, v: d.v, c: d.c, pc: Math.round(d.v / g.total * 100), list: d.list || [],
          colors: [toRgb(lighten(d.c, .5)), toRgb(d.c), toRgb(darken(d.c, .18))] }));
        /* 百分比贴在扇区中角外侧：位置+颜色双通道指认扇区，比在 176px 宽里排一列文字可读 */
        /* 图例放环下方，按列数折行：一行排 5 项在 352px 里必然互相叠字（实测「118·4控制电缆样品」糊成一串），
           类别多于 2 个就按 cols 换行；环也往上抬，给图例让出真实高度。 */
        const cols = o.cols || (o.wide ? 3 : 2), lw = o.lw || .48;
        const legend = o.legend === false ? [] : data.map((d, i) => ({ x: .02 + (i % cols) * lw, y: (o.ly == null ? .78 : o.ly) + Math.floor(i / cols) * .13,
          t: d.k + ' ' + d.v + '·' + Math.round(d.v / g.total * 100) + '%', c: d.c }));
        return {
          __h: h, type: 'view', children: [
            /* tooltip:false 必须显式关掉：G2 默认 tooltip 会把多边形顶点数组原样列成一长串
               （产品负责人圈图：hover 环时左栏压着一列 57497061409 这种数字）。
               环上该说的是"这一档有哪些设备"，那份清单走宿主自己的像素比色卡片（FR-58）。 */
            { type: 'polygon', data: g.poly, encode: { x: d => d.pts.map(q => q[0]), y: d => d.pts.map(q => q[1]) }, tooltip: false,
              style: { fill: d => d.c, inset: 0, stroke: d => (d.cap ? 'rgba(255,255,255,.7)' : 'transparent'), lineWidth: d => (d.cap ? .6 : 0) } },
            { type: 'text', data: [{ x: (o.cx == null ? .5 : o.cx), y: (o.cy == null ? .5 : o.cy) - g.dep * .5, t: String(g.total) }], encode: { x: 'x', y: 'y', text: 't' }, style: { fontSize: p.fsBody * 1.2, fontWeight: 800, fill: p.ink1, textAlign: 'center' } },
            /* 「台建档」这行小字按 2026-11-08 圈图撤除：中心数字、块标题「设备运行状态」、
               右侧「32 台建档」已经把这件事说了三遍，环上再压一行只会糊住弧线（图二就是这个效果）。
               传了 o.cap 才画，默认不画。 */
            (o.cap ? { type: 'text', data: [{ x: (o.cx == null ? .5 : o.cx), y: (o.cy == null ? .5 : o.cy) - g.dep * .5 - .17, t: o.cap }], encode: { x: 'x', y: 'y', text: 't' }, tooltip: false, style: { fontSize: p.fsMicro, fill: p.ink4, textAlign: 'center' } } : null),
            { type: 'text', data: legend, encode: { x: 'x', y: 'y', text: 't' }, style: { fontSize: p.fsLabel, fontWeight: 700, fill: d => d.c, textAlign: d => d.anchor } }
          ].filter(Boolean),
          scale: { x: { type: 'linear', domain: [0, 1], nice: false }, y: { type: 'linear', domain: [.98, .02], nice: false } }
        };
      });
    },
    /** 3D 折线带：时序趋势（温湿度这类双量纲序列，各自归一、绝对值进端点标签） */
    /** 时序折线（FR-43，2026-11-07 参考图一改版）：细细的平滑线 + 末端一个小圆点 + 端点绝对值。
        原来那条等轴挤出的厚带被否掉——两条带子交叉时糊成一团，读不出趋势，也压掉了图内的标题。
        纪律不变：两条序列各自归一，只比趋势；绝对值一律写进端点标签，不靠轴读数。 */
    ribbon(el, name, series, o) {
      o = o || {}; const p = palette();
      return draw(el, name, 'ribbon', JSON.stringify(series), () => {
        const h = o.height || 76, kids = [], ends = [];
        /* 分带：图内标题占掉顶部一行，剩下的画区按序列条数等分成带，带之间留 gap。
           带的位置按**均值大小**分配——数值大的在上，数值小的在下，与"湿度(%RH) 比 温度(℃) 高"
           这个直觉一致；每条序列仍在本带内归一，所以各自的趋势幅度一点没被压掉。
           这里没有共享 y 轴（draw() 里 c.axis(false)），所以分带不谎报量级，绝对值看端点标签与 tooltip。 */
        /* 带间距按"平滑线会不会过冲到对带"来定：Catmull-Rom 会略微过冲，实测 .07（≈3.8px）时
           两条线最近只隔 2px，读起来还是贴在一起；放到 .12（≈6.5px）才真的分得开，
           代价是每条带矮 0.015（≈0.8px），趋势幅度基本没丢。 */
        const yTop = o.title ? .70 : .88, yBot = .06, bandGap = .12;
        const k = series.length, bandH = Math.max(.05, (yTop - yBot - bandGap * (k - 1)) / k);
        const means = series.map(s => (s.values || []).reduce((a, b) => a + b, 0) / Math.max(1, (s.values || []).length));
        const bands = new Array(k);
        means.map((m, i) => [m, i]).sort((a, b) => a[0] - b[0]).forEach((x, bi) => {
          bands[x[1]] = [yBot + bi * (bandH + bandGap), yBot + bi * (bandH + bandGap) + bandH];
        });
        /* 一条极淡的基线：没有底板之后，细线需要一条参照，否则像飘在空中的头发 */
        kids.push({ type: 'line', data: [{ x: 0, y: yBot - .03 }, { x: 1, y: yBot - .03 }], encode: { x: 'x', y: 'y' }, tooltip: false, style: { stroke: p.ink4, lineWidth: 1, lineDash: [3, 3], strokeOpacity: .5 } });
        series.forEach((s, i) => {
          const c = s.c || (i ? p.ready : p.working), r = ribbonFaces(s.values, c, null, o.times, bands[i]);
          /* tooltip 只挂在序列线上：标题=真实时刻，值=原始读数（带单位），颜色跟线一致。
             两条序列各自一条 item，合在同一个 tooltip 里读——这正是"只比趋势、绝对值另标"那条纪律的补位：
             趋势看图，具体数看这里。 */
          kids.push({ type: 'line', data: r.pts, encode: { x: 'x', y: 'y' },
            tooltip: { title: (d) => (d.t == null ? '' : d.t), items: [{ field: 'v', name: s.name, color: c, valueFormatter: (v) => v + (s.unit || '') }] },
            style: { stroke: c, lineWidth: 1.5, lineAppendWidth: 3, strokeOpacity: .95 } });
          const last = r.pts[r.pts.length - 1];
          if (last) kids.push({ type: 'point', data: [last], encode: { x: 'x', y: 'y' }, tooltip: false, style: { fill: c, r: 2.6, stroke: '#fff', lineWidth: .8 } });
          ends.push({ x: 1.03, y: last ? last.y : .5, t: s.name + ' ' + s.values[s.values.length - 1] + (s.unit || ''), c });
        });
        /* 端点标签按 y 排序后强制最小间距：两条序列的最后一点常常落在同一高度，直接叠成一行糊字（实测「温度46.9%RH」） */
        ends.sort((a, b) => a.y - b.y);
        /* 最小间距按像素换算：图高 62px、y 域跨度 1.18 → 一行标签(≈15px)要 .28 个数据单位才真让得开；
           原来用 .1（≈5px）等于没让，两条端点标签还是叠成"温度46.9%RH"（实测）。 */
        const gap = Math.max(.28, .17 * (76 / Math.max(40, h)));
        for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < gap) ends[i].y = ends[i - 1].y + gap;
        ends.forEach(d => { d.y = Math.max(-.10, Math.min(1.00, d.y)); });
        kids.push({ type: 'text', data: ends, encode: { x: 'x', y: 'y', text: 't' }, tooltip: false, style: { fontSize: p.fsLabel, fontWeight: 700, fill: d => d.c, textAlign: 'start' } });
        /* x 轴刻度：优先用调用方给的 xLabels；没给但有 times（真实时刻序列）时，按 4 档均匀取实际时刻。
           取的是采样点自己的下标，不是"把 0~1 四等分"——16 个点时 0/5/10/15 才真的是首、中、中、末的时刻。 */
        const xTicks = o.xLabels ? o.xLabels.map((t, i) => ({ x: i / (o.xLabels.length - 1), y: -.09, t }))
          : (o.times ? (function (k) { const n = o.times.length, out = []; for (let i = 0; i < k; i++) out.push({ x: Math.round(i * (n - 1) / (k - 1)) / (n - 1), y: -.09, t: o.times[Math.round(i * (n - 1) / (k - 1))] }); return out; })(Math.min(4, o.times.length)) : null);
        if (xTicks) kids.push({ type: 'text', data: xTicks, encode: { x: 'x', y: 'y', text: 't' }, tooltip: false, style: { fontSize: p.fsLabel, fill: p.ink3, textAlign: 'center' } });
        /* 标题画在图内左上角：产品要求撤掉图下方那行说明文本，但"这是谁的、什么的时序"必须还能读出来 */
        if (o.title) kids.push({ type: 'text', data: [{ x: .005, y: 1.0, t: o.title }], encode: { x: 'x', y: 'y', text: 't' }, tooltip: false, style: { fontSize: p.fsLabel, fontWeight: 700, fill: p.ink3, textAlign: 'start' } });
        return {
          __h: h, type: 'view', children: kids, animate: false,
          scale: { x: { type: 'linear', domain: [-.02, 1.42], nice: false }, y: { type: 'linear', domain: [-.16, 1.02], nice: false } }
        };
      });
    },
    async boot() { try { await load(); return true; } catch (e) { state.errors.push(String(e && e.message || e)); return false; } },
    has(name) { const r = registry.get(name); return !!(r && !r.pending); }
  };
  global.TwinCharts = Charts;
})(window);
