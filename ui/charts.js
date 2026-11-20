/* Veriye bağlı SVG grafikler. Tüm değerler hesap motorundan (RobovanEngine.analyze) gelir. Dış kütüphane yok. */
(function (root) {
'use strict';
var nf = function (x, d) { return Number.isFinite(x) ? x.toLocaleString('tr-TR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : '—'; };
function niceMax(v) { if (!(v > 0)) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function niceStep(v) { if (!(v > 0)) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function short(v, cur) { var a = Math.abs(v), s = v < 0 ? '−' : ''; if (a >= 1e6) return s + cur + nf(a / 1e6, a >= 1e7 ? 0 : 1) + ' mn'; if (a >= 1e3) return s + cur + nf(a / 1e3, a >= 1e4 ? 0 : 1) + ' bin'; return s + cur + nf(a, a < 10 ? 2 : 0); }
function tip(el) { var t = el.querySelector('.tip'); if (!t) { t = document.createElement('div'); t.className = 'tip'; t.hidden = true; el.appendChild(t); } return t; }

/* ---- 1) Araç başına maliyet çubukları: kalem kalem yığılı. Veri doğrudan motordan veya canlı defterden gelir. ----
   items: [{id,name,model,color,seg:[enerji,bakım,personel,sermaye,sabit],total,sub}]; fmt: tutar biçimleyici; max: ortak ölçek (verilmezse en büyük toplam) */
var COMPS = [['energy', 'Enerji / yakıt', '--c-energy'], ['maint', 'Bakım ve lastik', '--c-maint'], ['people', 'Sürücü / operatör', '--c-people'], ['cap', 'Araç bedeli (değer kaybı + faiz)', '--c-capital'], ['fixed', 'Sigorta ve vergiler', '--c-fixed']];
function esc(x) { return String(x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function costBars(el, items, fmt, max) {
  var mx = max || Math.max.apply(null, items.map(function (r) { return r.total || 0; }).concat([0]));
  var h = '';
  items.forEach(function (r) {
    var tot = r.seg.reduce(function (p, q) { return p + q; }, 0);
    var scale = mx > 0 ? 100 / mx : 0;
    h += '<div class="cb" data-id="' + esc(r.id) + '"><div class="cb-h"><span class="cb-n"><i style="background:' + esc(r.color) + '"></i>' + esc(r.name) + '</span><b class="cb-t">' + fmt(r.total) + '</b></div><div class="cb-bar" title="' + esc(r.name) + '">';
    r.seg.forEach(function (v, i) { var w = v * scale; if (w > 0) h += '<span class="sg" style="width:' + w.toFixed(3) + '%;background:var(' + COMPS[i][2] + ')" title="' + COMPS[i][1] + ': ' + esc(fmt(v)) + '"></span>'; });
    h += '</div>' + (r.sub ? '<div class="cb-s">' + esc(r.sub) + '</div>' : '') + '</div>';
  });
  el.innerHTML = h;
  return COMPS.map(function (c) { return '<span><i style="background:var(' + c[2] + ')"></i>' + c[1] + '</span>'; }).join('');
}

/* ---- yardımcı: çizgi grafik + imleç ipucu ---- */
function lineChart(el, o) {
  var W = o.W || 640, H = o.H || 300, L = 62, R = 18, T = 16, B = 40, pw = W - L - R, ph = H - T - B;
  var all = []; o.series.forEach(function (se) { se.pts.forEach(function (p) { if (Number.isFinite(p[1])) all.push(p[1]); }); });
  var lo = Math.min(0, Math.min.apply(null, all)), hi = Math.max.apply(null, all.concat([0]));
  var span = hi - lo || 1, step = niceStep(span / 4), ymax = Math.ceil(hi / step) * step, ymin = Math.floor(lo / step) * step; if (ymax === ymin) ymax = ymin + step;
  var X = function (x) { return L + (x - o.x0) / (o.x1 - o.x0) * pw; }, Y = function (y) { return T + ph - (y - ymin) / (ymax - ymin) * ph; };
  var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + o.label + '">';
  var n = Math.round((ymax - ymin) / step);
  for (var i = 0; i <= n; i++) { var v = ymin + step * i, y = Y(v); s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" class="' + (Math.abs(v) < 1e-9 ? 'zero' : 'grid') + '"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + o.yfmt(v) + '</text>'; }
  o.xticks.forEach(function (t) { s += '<text x="' + X(t) + '" y="' + (H - 20) + '" text-anchor="middle">' + o.xfmt(t) + '</text>'; });
  s += '<text x="' + (L + pw / 2) + '" y="' + (H - 3) + '" text-anchor="middle" class="axl">' + o.xlabel + '</text>';
  if (o.vline !== undefined && o.vline >= o.x0 && o.vline <= o.x1) s += '<line x1="' + X(o.vline) + '" x2="' + X(o.vline) + '" y1="' + T + '" y2="' + (T + ph) + '" class="vline"/>';
  o.series.forEach(function (se) {
    var d = se.pts.filter(function (p) { return Number.isFinite(p[1]); }).map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join('');
    s += '<path d="' + d + '" fill="none" stroke="' + se.color + '" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>';
  });
  (o.marks || []).forEach(function (m) { s += '<circle cx="' + X(m.x) + '" cy="' + Y(m.y) + '" r="5.5" class="mark"><title>' + m.t + '</title></circle>'; });
  s += '<line class="cross" x1="0" x2="0" y1="' + T + '" y2="' + (T + ph) + '" hidden/><rect class="hit" x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '" fill="transparent"/></svg>';
  el.innerHTML = s; var t = tip(el);
  var svg = el.querySelector('svg'), cross = svg.querySelector('.cross'), hit = svg.querySelector('.hit');
  hit.addEventListener('pointermove', function (e) {
    var r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, xv = o.x0 + (px - L) / pw * (o.x1 - o.x0);
    var best = null; o.series[0].pts.forEach(function (p) { if (best === null || Math.abs(p[0] - xv) < Math.abs(best - xv)) best = p[0]; });
    var lines = ['<b>' + o.xfmt(best) + '</b>']; o.series.forEach(function (se) { var p = se.pts.filter(function (q) { return q[0] === best; })[0]; if (p && Number.isFinite(p[1])) lines.push('<span><i style="background:' + se.color + '"></i>' + se.name + ' ' + o.yfmt(p[1], 1) + '</span>'); });
    cross.removeAttribute('hidden'); cross.setAttribute('x1', X(best)); cross.setAttribute('x2', X(best));
    t.innerHTML = lines.join(''); t.hidden = false; var left = (X(best) / W) * r.width + 12; t.style.left = Math.min(left, r.width - 190) + 'px'; t.style.top = '8px';
  });
  hit.addEventListener('pointerleave', function () { cross.setAttribute('hidden', ''); t.hidden = true; });
}

/* ---- 2) birikimli maliyet ve başa baş ---- */
function cumulative(el, a, cur, E) {
  var V = a.vehicles, ys = []; for (var t = 0; t <= 10; t += 0.5) ys.push(t);
  var series = a.order.map(function (id) { return { name: V[id].name, color: V[id].color, pts: ys.map(function (t) { return [t, V[id].cumulative(t)]; }) }; });
  var marks = [], A = V[a.kpi.a], B = V[a.kpi.b], be = E.breakEven(A, B);
  if (be.years !== null && be.years > 0 && be.years <= 10) marks.push({ x: be.years, y: A.cumulative(be.years), t: A.name + ' / ' + B.name + ' başa baş: ' + nf(be.years, 1) + ' yıl' });
  lineChart(el, { label: 'Birikimli maliyet', series: series, x0: 0, x1: 10, xticks: [0, 2, 4, 6, 8, 10], xfmt: function (x) { return nf(x, x % 1 ? 1 : 0) + ' yıl'; }, yfmt: function (v) { return short(v, cur); }, xlabel: 'yıl', vline: a.config.scenario.horizon, marks: marks });
  return marks.map(function (m) { return m.t; });
}

/* ---- 3) duyarlılık ---- */
function setCat(c, cat, f, v) { c.fleet.forEach(function (x) { if (x.category === cat) x.params[f] = v; }); }
function getCat(a, cat, f) { var x = a.config.fleet.filter(function (q) { return q.category === cat; })[0]; return x ? x.params[f] : NaN; }
var PARAMS = [
  { id: 'demand', label: 'Günlük toplam sefer', min: 1, max: 40, n: 40, unit: 'sefer/gün', set: function (c, v) { c.scenario.demand = v; }, get: function (a) { return a.config.scenario.demand; } },
  { id: 'driver', label: 'Sürücü aylık maliyeti', min: 0, max: 8000, n: 40, unit: '/ay', money: true, set: function (c, v) { setCat(c, 'conventional', 'driver', v); }, get: function (a) { return getCat(a, 'conventional', 'driver'); } },
  { id: 'operator', label: 'Robovan operatör aylık maliyeti', min: 0, max: 8000, n: 40, unit: '/ay', money: true, set: function (c, v) { setCat(c, 'robovan', 'operator', v); }, get: function (a) { return getCat(a, 'robovan', 'operator'); } },
  { id: 'elec', label: 'Elektrik fiyatı', min: 0.01, max: 1, n: 40, unit: '/kWh', money: true, dec: 2, set: function (c, v) { setCat(c, 'robovan', 'elec', v); }, get: function (a) { return getCat(a, 'robovan', 'elec'); } },
  { id: 'fuel', label: 'Dizel yakıt fiyatı', min: 0.3, max: 4, n: 40, unit: '/L', money: true, dec: 2, set: function (c, v) { setCat(c, 'conventional', 'fuel', v); }, get: function (a) { return getCat(a, 'conventional', 'fuel'); } },
  { id: 'km', label: 'Tek yön mesafe', min: 1, max: 200, n: 40, unit: 'km', set: function (c, v) { c.route.mode = 'manual'; c.route.manualKm = v; }, get: function (a) { return a.route.km; } }
];
var METRICS = [{ id: 'perKm', label: 'km başına maliyet' }, { id: 'fleet', label: 'Yıllık filo maliyeti' }, { id: 'saving', label: 'Yıllık fark (seçili iki araç)' }];
function sensitivity(el, a, cur, opt, run) {
  var P = PARAMS.filter(function (p) { return p.id === opt.param; })[0], M = opt.metric, V0 = a.vehicles;
  var xs = []; for (var i = 0; i <= P.n; i++) xs.push(P.min + (P.max - P.min) * i / P.n);
  if (P.id === 'demand') xs = xs.map(Math.round).filter(function (x, i, arr) { return arr.indexOf(x) === i; });
  var rows = xs.map(function (x) { var c = JSON.parse(JSON.stringify(a.config)); P.set(c, x); var r = run(c); return { x: x, r: r.ok ? r : null }; });
  var series, marks = [], note = '';
  function val(r, k) { return !r ? NaN : (M === 'perKm' ? r.vehicles[k].perKm : r.vehicles[k].fleet); }
  if (M === 'saving') {
    series = [{ name: 'Fark: ' + V0[a.kpi.b].name + ' − ' + V0[a.kpi.a].name, color: V0[a.kpi.a].color, pts: rows.map(function (q) { return [q.x, q.r ? q.r.kpi.annualSaving : NaN]; }) }];
    for (var j = 1; j < series[0].pts.length; j++) { var p0 = series[0].pts[j - 1], p1 = series[0].pts[j]; if (Number.isFinite(p0[1]) && Number.isFinite(p1[1]) && p0[1] * p1[1] < 0) { var f = p0[1] / (p0[1] - p1[1]), xz = p0[0] + (p1[0] - p0[0]) * f; marks.push({ x: xz, y: 0, t: 'Tasarrufun sıfırlandığı değer ≈ ' + nf(xz, P.dec || 0) }); note = 'Tasarruf ≈ ' + nf(xz, P.dec || 0) + ' ' + (P.money ? cur : '') + P.unit + ' değerinde sıfırlanır.'; } }
  } else series = a.order.map(function (k) { return { name: V0[k].name, color: V0[k].color, pts: rows.map(function (q) { return [q.x, val(q.r, k)]; }) }; });
  var cv = P.get(a);
  lineChart(el, { label: 'Duyarlılık', series: series, x0: P.min, x1: P.max, xticks: [0, 1, 2, 3, 4].map(function (i) { return P.min + (P.max - P.min) * i / 4; }),
    xfmt: function (x) { return (P.money ? cur : '') + nf(x, P.dec || 0) + ' ' + (P.money ? '' : '') + P.unit.replace('/', P.money ? '/' : '/'); }, yfmt: function (v, d) { return M === 'perKm' ? cur + nf(v, 2) : short(v, cur); }, xlabel: P.label, vline: cv, marks: marks, W: 1100, H: 330 });
  return note;
}

root.RobovanCharts = { costBars: costBars, COMPS: COMPS, cumulative: cumulative, sensitivity: sensitivity, PARAMS: PARAMS, METRICS: METRICS };
})(window);
