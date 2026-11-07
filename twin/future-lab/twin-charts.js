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
      ink1: tv('--tw-ink-1') || '#0F2740', ink3: tv('--tw-ink-3') || '#5B6B7D',
      fsLabel: parseFloat(tv('--tw-fs-label')) || 11.5, fsBody: parseFloat(tv('--tw-fs-body')) || 12.5
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
    const cx = opt.cx == null ? .5 : opt.cx, cy = opt.cy == null ? .5 : opt.cy, rx = opt.rx || .34, ry = rx * (opt.flat || .55), dep = rx * .16, ir = opt.inner || .5;
    let a = -Math.PI / 2; const poly = [];
    items.forEach(d => {
      const v = Math.max(0, d.v); if (!v) return;
      const a1 = a + v / total * TAU, f = faces(d.c);
      poly.push({ pts: [...arc(cx, cy - dep, rx, ry, a, a1, 26), ...arc(cx, cy - dep, rx * ir, ry * ir, a1, a, 26)], c: f.top });
      poly.push({ pts: [...arc(cx, cy, rx, ry, a, a1, 26).reverse(), ...arc(cx, cy - dep, rx, ry, a, a1, 26)], c: f.front });
      poly.push({ pts: [...arc(cx, cy, rx * ir, ry * ir, a, a1, 26), ...arc(cx, cy - dep, rx * ir, ry * ir, a, a1, 26).reverse()], c: f.side });
      a = a1;
    });
    return { poly, total, dep, rx };
  }
  function ribbonFaces(values, color) {
    const n = values.length; if (n < 2) return { poly: [], pts: [], color };
    const lo = Math.min.apply(null, values), hi = Math.max.apply(null, values), span = (hi - lo) || 1;
    /* 每条序列各自归一到 [0.12,0.88]：温度(℃)与湿度(%RH)量纲不同，同图里只能比趋势；
       绝对值一律写进端点标签，不靠轴读数——这是诚实口径，不是省事。 */
    const y = v => .12 + (v - lo) / span * .76, dx = .012, dy = .05, th = .035, poly = [], pts = [];
    for (let i = 0; i < n; i++) pts.push({ x: i / (n - 1), y: y(values[i]), v: values[i] });
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1], f = faces(color);
      poly.push({ pts: [[a.x, a.y], [b.x, b.y], [b.x, b.y - th], [a.x, a.y - th]], c: f.front });
      poly.push({ pts: [[a.x, a.y], [b.x, b.y], [b.x + dx, b.y + dy], [a.x + dx, a.y + dy]], c: f.top });
    }
    return { poly, pts, color };
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
    /** 3D 环形：构成占比（类别少才用；类别多请回表格） */
    donut(el, name, items, o) {
      o = o || {}; const p = palette();
      const data = items.filter(d => d.v > 0).map((d, i) => ({ k: d.k, v: d.v, c: d.c || [p.working, p.ready, p.warn, p.idle][i % 4] }));
      return draw(el, name, 'donut', JSON.stringify(data), () => {
        const g = ringFaces(data, o), h = o.height || 96;
        /* 百分比贴在扇区中角外侧：位置+颜色双通道指认扇区，比在 176px 宽里排一列文字可读 */
        /* 图例放环下方，按列数折行：一行排 5 项在 352px 里必然互相叠字（实测「118·4控制电缆样品」糊成一串），
           类别多于 2 个就按 cols 换行；环也往上抬，给图例让出真实高度。 */
        const cols = o.cols || (o.wide ? 3 : 2), lw = o.lw || .48;
        const legend = data.map((d, i) => ({ x: .02 + (i % cols) * lw, y: (o.ly == null ? .78 : o.ly) + Math.floor(i / cols) * .13,
          t: d.k + ' ' + d.v + '·' + Math.round(d.v / g.total * 100) + '%', c: d.c }));
        return {
          __h: h, type: 'view', children: [
            { type: 'polygon', data: g.poly, encode: { x: d => d.pts.map(q => q[0]), y: d => d.pts.map(q => q[1]) }, style: { fill: d => d.c, inset: 0 } },
            { type: 'text', data: [{ x: (o.cx == null ? .5 : o.cx), y: (o.cy == null ? .5 : o.cy) - g.dep * .5, t: String(g.total) }], encode: { x: 'x', y: 'y', text: 't' }, style: { fontSize: p.fsBody * 1.2, fontWeight: 800, fill: p.ink1, textAlign: 'center' } },
            { type: 'text', data: legend, encode: { x: 'x', y: 'y', text: 't' }, style: { fontSize: p.fsLabel, fontWeight: 700, fill: d => d.c, textAlign: d => d.anchor } }
          ],
          scale: { x: { type: 'linear', domain: [0, 1], nice: false }, y: { type: 'linear', domain: [.98, .02], nice: false } }
        };
      });
    },
    /** 3D 折线带：时序趋势（温湿度这类双量纲序列，各自归一、绝对值进端点标签） */
    ribbon(el, name, series, o) {
      o = o || {}; const p = palette();
      return draw(el, name, 'ribbon', JSON.stringify(series), () => {
        const h = o.height || 76, kids = [], ends = [];
        series.forEach((s, i) => {
          const c = s.c || (i ? p.ready : p.working), r = ribbonFaces(s.values, c);
          kids.push({ type: 'polygon', data: r.poly, encode: { x: d => d.pts.map(q => q[0]), y: d => d.pts.map(q => q[1]) }, style: { fill: d => d.c, inset: 0 } });
          kids.push({ type: 'point', data: r.pts, encode: { x: 'x', y: 'y' }, style: { fill: c, size: 2.4 } });
          const last = r.pts[r.pts.length - 1];
          ends.push({ x: 1.03, y: last ? last.y : .5, t: s.name + ' ' + s.values[s.values.length - 1] + (s.unit || ''), c });

        });
        /* 端点标签按 y 排序后强制最小间距：两条序列的最后一点常常落在同一高度，直接叠成一行糊字（实测「温度46.9%RH」） */
        ends.sort((a, b) => a.y - b.y);
        /* 最小间距按像素换算：图高 62px、y 域跨度 1.18 → 一行标签(≈15px)要 .28 个数据单位才真让得开；
           原来用 .1（≈5px）等于没让，两条端点标签还是叠成"温度46.9%RH"（实测）。 */
        const gap = Math.max(.28, .17 * (76 / Math.max(40, h)));
        for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < gap) ends[i].y = ends[i - 1].y + gap;
        ends.forEach(d => { d.y = Math.max(-.10, Math.min(1.00, d.y)); });
        kids.push({ type: 'text', data: ends, encode: { x: 'x', y: 'y', text: 't' }, style: { fontSize: p.fsLabel, fontWeight: 700, fill: d => d.c, textAlign: 'start' } });
        if (o.xLabels) kids.push({ type: 'text', data: o.xLabels.map((t, i) => ({ x: i / (o.xLabels.length - 1), y: -.09, t })), encode: { x: 'x', y: 'y', text: 't' }, style: { fontSize: p.fsLabel, fill: p.ink3, textAlign: 'center' } });
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
