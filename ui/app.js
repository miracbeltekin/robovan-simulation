/* Uygulama: durum, formlar, KPI, canlı simülasyon, harita ve grafik bağlantıları. Hesap yalnızca RobovanEngine ile yapılır. */
(function () {
'use strict';
var E = window.RobovanEngine, D = window.RobovanUIData, M = window.RobovanMap, C = window.RobovanCharts;
var KEY = 'robovan-sim-ui-v3', OLD_KEY = 'robovan-sim-ui-v2';
var $ = function (id) { return document.getElementById(id); };
var cfg, ui, raw, mapState = 'idle', live = null;
var routeInfo = { kind: 'none' }, routeSeq = 0, last = null, lastA = null;
var sim = { t: 0, playing: false, speed: 1, ts: 0, raf: 0, frames: [] };
var CAT = E.CATEGORIES, FIELDS = {};
D.SCHEMA.forEach(function (g) { g.f.forEach(function (f) { FIELDS[f[0]] = f; }); });

/* ---------- durum ---------- */
function freshUi() { return { cur: '$', tip: 0, tipDone: false, param: 'demand', metric: 'perKm', routeOpen: null, bm: 'live', tab: 'sum', wi: { fuel: false, driver: false, ratio: false, price: false } }; }
var fieldErr = {}, shTab = 'ops';
function reset() { cfg = E.defaultConfig(); ui = freshUi(); raw = {}; sim.t = 0; sim.playing = false; }
reset();
function veh(id) { return cfg.fleet.filter(function (v) { return v.id === id; })[0]; }
function pairVehicles() { return [veh(cfg.compare.a), veh(cfg.compare.b)].filter(Boolean); }
/* 'p.<alan>': karşılaştırılan iki araçtan o alana sahip olanlar; 'v.<id>.<alan>': tek araç */
function targets(p) { var a = p.split('.'); if (a[0] === 'p') return pairVehicles().filter(function (v) { return Object.prototype.hasOwnProperty.call(v.params, a[1]); }); return []; }
function getPath(p) { var a = p.split('.'); if (a[0] === 's') return cfg.scenario[a[1]]; if (a[0] === 'r') return cfg.route[a[1]]; if (a[0] === 'v') { var v = veh(a[1]); return v ? v.params[a[2]] : NaN; } if (a[0] === 'p') { var t = targets(p); return t.length ? t[0].params[a[1]] : NaN; } }
function setPath(p, x) { var a = p.split('.'); if (a[0] === 's') cfg.scenario[a[1]] = x; else if (a[0] === 'r') cfg.route[a[1]] = x; else if (a[0] === 'v') { var v = veh(a[1]); if (v) v.params[a[2]] = x; } else if (a[0] === 'p') targets(p).forEach(function (v) { v.params[a[1]] = x; }); }
function slider(id) { return D.SLIDERS.filter(function (s) { return s.id === id; })[0]; }
function readId(id) { var s = slider(id); return s ? getPath(s.paths[0]) : getPath(id); }

/* ---------- biçim ---------- */
/* ---------- biçim ---------- */
function parse(s) { s = String(s).trim().replace(/\s/g, ''); if (s === '') return NaN; if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.'); return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN; }
function fmtIn(v) { return Number.isFinite(v) ? String(+v.toFixed(6)).replace('.', ',') : ''; }
function nf(x, d) { return Number.isFinite(x) ? x.toLocaleString('tr-TR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : '—'; }
function money(x, d) { if (x === null || !Number.isFinite(x)) return '—'; var neg = x < 0 && Math.round(Math.abs(x) * Math.pow(10, d || 0)) > 0; return (neg ? '−' : '') + ui.cur + nf(Math.abs(x), d || 0); }
function pct(x) { return Number.isFinite(x) ? (x < 0 ? '−' : '') + '%' + nf(Math.abs(x), 0) : '—'; }
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function unit(u) { return u.replace(/\$/g, ui.cur); }
function hm(min) { if (!Number.isFinite(min)) return '0:00'; var m = Math.round(min); return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
function clockStr(simMin) { return E.formatClock(E.START_MIN + (Number.isFinite(simMin) ? simMin : 0)); }
function elapsedStr(simMin) { var m = Math.floor(Number.isFinite(simMin) ? simMin : 0); return Math.floor(m / 60) + ' sa ' + ('0' + (m % 60)).slice(-2) + ' dk'; }
function moneyD(x) { return money(x, 2); }
var PHASE = { wait: 'bekliyor', drive: 'sürüşte', dwell: 'durakta (yükleme)', charge: 'şarjda', done: 'gün tamam' };
var carSel = null, toastAt = 0;
function vlabel(v) { return v.model ? v.name + ' · ' + v.model : v.name; }

/* ---------- form kurulumu ---------- */
function fld(id, label, u, desc) { return '<div class="fld"><label for="' + id + '">' + esc(label) + '</label><div class="inp"><input id="' + id + '" data-f="' + id + '" inputmode="decimal" autocomplete="off" aria-describedby="e-' + id + '"><span class="u" data-u="' + esc(u) + '">' + esc(unit(u)) + '</span></div>' + (desc ? '<div class="hint">' + esc(desc) + '</div>' : '') + '<div class="ferr" id="e-' + id + '" data-e="' + id + '" hidden></div></div>'; }
function buildStatic() {
  $('sliders').innerHTML = D.SLIDERS.map(function (s) {
    return '<div class="slider" data-sl="' + s.id + '"><div class="row"><label for="' + s.id + '">' + esc(s.label) + '</label><div class="val"><input id="' + s.id + '" data-f="' + s.id + '" inputmode="decimal" autocomplete="off"><span data-u="' + esc(s.unit) + '">' + esc(unit(s.unit)) + '</span></div></div><input type="range" data-r="' + s.id + '" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" aria-label="' + esc(s.label) + ' kaydırıcı"><div class="shared" data-shared="' + s.id + '" hidden>Karşılaştırılan araçlarda farklı değerler var</div><div class="shared na" data-na="' + s.id + '" hidden>Seçili araçlarda bu alan yok</div></div>';
  }).join('');
  $('scFields').innerHTML = D.SCENARIO_OPS.map(function (f) { return fld('s.' + f[0], f[1], f[2], D.DESC[f[0]]); }).join('');
  $('advFields').innerHTML = D.SCENARIO_ADV.map(function (f) { return fld('s.' + f[0], f[1], f[2], D.DESC[f[0]]); }).join('');
  $('cityPick').innerHTML = D.CITIES.map(function (c) { return '<option>' + esc(c.n) + '</option>'; }).join('');
  $('presets').innerHTML = D.PRESETS.map(function (p, i) { return '<button data-preset="' + i + '">' + esc(p[0]) + '</button>'; }).join('');
  $('sensParam').innerHTML = C.PARAMS.map(function (p) { return '<option value="' + p.id + '">' + esc(p.label) + '</option>'; }).join('');
  $('sensMetric').innerHTML = C.METRICS.map(function (m) { return '<option value="' + m.id + '">' + esc(m.label) + '</option>'; }).join('');
}
/* araç kartları: yalnızca araç eklenir/silinir/çoğaltılır/ad değişir ise yeniden kurulur (yazma sırasında odak kaybolmasın) */
var openCards = {};
function vHead(v, withNames) {
  var cat = CAT[v.category];
  var h = '<div class="vc-h"><span class="vc-dot"></span><div class="vc-t">' + (withNames ? '<input class="vc-name" data-name="' + v.id + '" value="' + esc(v.name) + '" maxlength="40" aria-label="Araç adı"><input class="vc-model" data-model="' + v.id + '" value="' + esc(v.model || '') + '" maxlength="60" placeholder="Marka / model" aria-label="Marka ve model">' : '<b>' + esc(v.name) + '</b>') + '</div></div>';
  return h + '<div class="vc-cat">' + esc(cat.label) + ' kategorisi · ' + (cat.energy === 'electric' ? 'elektrikli' : 'dizel') + ' · ' + (cat.mode === 'autonomous' ? 'L4 otonom, uzaktan operatör' : 'sürücülü') + '</div><div class="vsum" id="vsum-' + v.id + '"></div>';
}
function vFields(v, advanced) {
  var core = D.CORE[v.category], out = [];
  D.SCHEMA.forEach(function (g) { g.f.forEach(function (f) { if (f[3] && f[3].split(',').indexOf(v.category) < 0) return; var isCore = core.indexOf(f[0]) > -1; if (isCore !== !advanced) return; out.push(fld('v.' + v.id + '.' + f[0], f[1], f[2], D.DESC[f[0]])); }); });
  return '<div class="fields">' + out.join('') + '</div>';
}
function buildFleet() {
  ['robovan', 'conventional'].forEach(function (cat) {
    $('vl-' + cat).innerHTML = cfg.fleet.filter(function (v) { return v.category === cat; }).map(function (v) {
      return '<div class="vcard" data-vid="' + v.id + '" style="--c:' + v.color + '">' + vHead(v, true) + vFields(v, false) + '<div class="vc-act"><button class="mini" data-dup="' + v.id + '">Çoğalt</button><button class="mini danger" data-rm="' + v.id + '"' + (cfg.fleet.length <= E.MIN_VEHICLES ? ' disabled' : '') + '>Sil</button></div></div>';
    }).join('');
  });
  $('vl-adv').innerHTML = cfg.fleet.map(function (v) { return '<details class="vcard adv" data-g="' + v.id + '" style="--c:' + v.color + '"' + (openCards[v.id] ? ' open' : '') + '><summary><span class="vc-dot"></span>' + esc(v.name) + '<span class="muted small"> · ' + esc(CAT[v.category].label) + '</span></summary>' + vFields(v, true) + '</details>'; }).join('');
  $('fleetCount').textContent = cfg.fleet.length + ' / ' + E.MAX_VEHICLES + ' araç';
  var full = cfg.fleet.length >= E.MAX_VEHICLES; $('addRobo').disabled = full; $('addConv').disabled = full;
  fillPair();
}
function fillPair() {
  ['selA', 'selB'].forEach(function (id) {
    var sel = $(id), cur = id === 'selA' ? cfg.compare.a : cfg.compare.b;
    sel.innerHTML = cfg.fleet.map(function (v) { return '<option value="' + v.id + '">' + esc(v.name) + '</option>'; }).join(''); sel.value = cur;
  });
}
function nextId(cat) { var n = 1, id; do { n++; id = cat + '_' + n; } while (veh(id)); return id; }
function nextName(cat) { var base = CAT[cat].label, n = 2, nm; do { nm = base + ' ' + n; n++; } while (cfg.fleet.some(function (v) { return v.name === nm; })); return nm; }
function colorFor(cat) { var used = cfg.fleet.filter(function (v) { return v.category === cat; }).map(function (v) { return v.color; }); var p = E.PALETTE[cat].filter(function (c) { return used.indexOf(c) < 0; }); return p.length ? p[0] : E.PALETTE[cat][used.length % E.PALETTE[cat].length]; }
function addVehicle(cat, src) {
  if (cfg.fleet.length >= E.MAX_VEHICLES) { toast('En fazla ' + E.MAX_VEHICLES + ' araç eklenebilir.'); return; }
  var id = nextId(cat), nm = src ? (src.name + ' (kopya)').slice(0, 40) : nextName(cat);
  var v = E.makeVehicle(cat, id, nm, src ? src.model : '', colorFor(cat), src ? JSON.parse(JSON.stringify(src.params)) : undefined);
  cfg.fleet.push(v); buildFleet(); update(); toast('"' + nm + '" eklendi.');
}
function removeVehicle(id) {
  if (cfg.fleet.length <= E.MIN_VEHICLES) { toast('En az ' + E.MIN_VEHICLES + ' araç kalmalı.'); return; }
  var v = veh(id); if (!v) return;
  cfg.fleet = cfg.fleet.filter(function (x) { return x.id !== id; });
  Object.keys(raw).forEach(function (k) { if (k.indexOf('v.' + id + '.') === 0) delete raw[k]; });
  var ids = cfg.fleet.map(function (x) { return x.id; });
  if (ids.indexOf(cfg.compare.a) < 0) cfg.compare.a = ids.filter(function (x) { return x !== cfg.compare.b; })[0];
  if (ids.indexOf(cfg.compare.b) < 0) cfg.compare.b = ids.filter(function (x) { return x !== cfg.compare.a; })[0];
  buildFleet(); update(); toast('"' + v.name + '" silindi.');
}
function showValue(id) { var v = readId(id), r = raw[id]; return (r !== undefined && ((Number.isNaN(v) && Number.isNaN(parse(r))) || parse(r) === v)) ? r : fmtIn(v); }
function setSeg(id, on) { $(id).setAttribute('aria-pressed', on ? 'true' : 'false'); }
function syncInputs() {
  document.querySelectorAll('[data-f]').forEach(function (el) { var id = el.dataset.f, v = readId(id); if (document.activeElement !== el) el.value = showValue(id); el.setAttribute('aria-invalid', Number.isFinite(v) ? 'false' : 'true'); });
  D.SLIDERS.forEach(function (s) {
    var r = document.querySelector('[data-r="' + s.id + '"]'), t = targets(s.paths[0]), na = !t.length && s.paths[0].charAt(0) === 'p', v = getPath(s.paths[0]);
    r.disabled = na; r.value = Number.isFinite(v) ? Math.min(s.max, Math.max(s.min, v)) : s.min;
    var vals = t.map(function (x) { return x.params[s.paths[0].split('.')[1]]; });
    document.querySelector('[data-shared="' + s.id + '"]').hidden = !vals.some(function (x) { return x !== vals[0]; });
    document.querySelector('[data-na="' + s.id + '"]').hidden = !na;
    var inp = $(s.id); if (inp) inp.disabled = na;
  });
  $('cur').value = ui.cur; $('roundTrip').value = cfg.scenario.roundTrip ? '1' : '0';
  $('selA').value = cfg.compare.a; $('selB').value = cfg.compare.b;
  document.querySelectorAll('[data-bm]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-bm') === ui.bm ? 'true' : 'false'); });
  setSeg('modeRoute', cfg.route.mode === 'route'); setSeg('modeManual', cfg.route.mode === 'manual');
  $('routeBody').hidden = cfg.route.mode !== 'route'; $('manualBox').hidden = cfg.route.mode !== 'manual'; $('rfBox').hidden = cfg.route.mode !== 'route';
  $('sensParam').value = ui.param; $('sensMetric').value = ui.metric;
  document.querySelectorAll('[data-e]').forEach(function (e) { var id = e.dataset.e, v = readId(id), m = !Number.isFinite(v) ? 'Geçerli bir sayı girin.' : (fieldErr[id] || ''); e.hidden = !m; e.textContent = m; });
  document.querySelectorAll('[data-tab]').forEach(function (b) { var on = b.dataset.tab === ui.tab; b.setAttribute('aria-selected', on ? 'true' : 'false'); $('pn-' + b.dataset.tab).hidden = !on; });
  document.querySelectorAll('[data-st]').forEach(function (b) { var on = b.dataset.st === shTab; b.setAttribute('aria-selected', on ? 'true' : 'false'); $('sp-' + b.dataset.st).hidden = !on; });
  document.querySelectorAll('[data-u]').forEach(function (e) { e.textContent = unit(e.getAttribute('data-u')); });
  applyRouteOpen();
}

function routeOpen() { if (typeof ui.routeOpen === 'boolean') return ui.routeOpen; return mq.matches ? false : mapState === 'error'; }
function applyRouteOpen() { var o = routeOpen(), rc = $('routecard'); rc.classList.toggle('collapsed', !o); $('rcToggle').setAttribute('aria-expanded', o ? 'true' : 'false'); $('rcToggleTxt').textContent = o ? 'Daralt' : 'Genişlet'; }
$('rcToggle').onclick = function () { ui.routeOpen = !routeOpen(); applyRouteOpen(); save(); };

/* ---------- olaylar ---------- */
function onField(id, text) {
  raw[id] = text; var v = parse(text), s = slider(id);
  if (s) s.paths.forEach(function (p) { setPath(p, v); raw[p] = text; }); else setPath(id, v);
  update();
}
document.addEventListener('input', function (e) {
  var t = e.target; if (!t.dataset) return;
  if (t.dataset.f) onField(t.dataset.f, t.value);
  else if (t.dataset.r) onField(t.dataset.r, String(+Number(t.value).toFixed(6)).replace('.', ','));
  else if (t.dataset.name) { var v = veh(t.dataset.name); if (v) { v.name = t.value.slice(0, 40); update(); } }
  else if (t.dataset.model) { var w = veh(t.dataset.model); if (w) { w.model = t.value.slice(0, 60); update(); } }
});
document.addEventListener('focusout', function (e) { var t = e.target; if (t.dataset && t.dataset.name && !String(t.value).trim()) { var v = veh(t.dataset.name); if (v) { v.name = CAT[v.category].label; t.value = v.name; fillPair(); update(); } } if (t.dataset && (t.dataset.name || t.dataset.model)) fillPair(); });
document.addEventListener('toggle', function (e) { var d = e.target; if (d && d.dataset && d.dataset.g) openCards[d.dataset.g] = d.open; }, true);
document.addEventListener('click', function (e) { var t = e.target.closest('[data-tab]'), st = e.target.closest('[data-st]'); if (t) { ui.tab = t.dataset.tab; update(); } else if (st) { shTab = st.dataset.st; syncInputs(); } });
$('goAnalysis').onclick = function () { $('analysis').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
$('cur').addEventListener('change', function (e) { ui.cur = e.target.value; update(); });
$('selA').addEventListener('change', function (e) { setPair('a', e.target.value); }); $('selB').addEventListener('change', function (e) { setPair('b', e.target.value); });
function setPair(which, id) { var o = which === 'a' ? 'b' : 'a'; if (cfg.compare[o] === id) cfg.compare[o] = cfg.compare[which]; cfg.compare[which] = id; update(); }
document.querySelectorAll('[data-bm]').forEach(function (b) { b.onclick = function () { ui.bm = b.getAttribute('data-bm'); update(); }; });
$('sheet').addEventListener('click', function (e) { var d = e.target.closest('[data-dup]'), r = e.target.closest('[data-rm]'); if (d) { var v = veh(d.getAttribute('data-dup')); if (v) addVehicle(v.category, v); } else if (r && !r.disabled) removeVehicle(r.getAttribute('data-rm')); });
$('addRobo').onclick = function () { addVehicle('robovan'); }; $('addConv').onclick = function () { addVehicle('conventional'); };
$('modeRoute').onclick = function () { cfg.route.mode = 'route'; routeChanged(); }; $('modeManual').onclick = function () { cfg.route.mode = 'manual'; update(); };
$('roundTrip').addEventListener('change', function (e) { cfg.scenario.roundTrip = e.target.value === '1'; update(); });
$('reset').onclick = function () { reset(); buildFleet(); renderWps(); routeChanged(); simReset(); };
$('copy').onclick = copySummary;
$('sensParam').addEventListener('change', function (e) { ui.param = e.target.value; update(); }); $('sensMetric').addEventListener('change', function (e) { ui.metric = e.target.value; update(); });
['myNums', 'myNums3'].forEach(function (id) { $(id).onclick = openSheet; });
function openSheet() { $('sheet').hidden = false; $('scrim').hidden = false; $('sheetClose').focus(); }
function closeSheet() { $('sheet').hidden = true; $('scrim').hidden = true; }
$('sheetClose').onclick = closeSheet; $('sheetDone').onclick = closeSheet; $('scrim').onclick = closeSheet;
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });

/* ilk kullanım ipucu */
function renderTip() {
  var c = $('tipcard'); if (ui.tipDone) { c.hidden = true; return; } c.hidden = false;
  var t = D.TIPS[ui.tip]; $('tcStep').textContent = 'Adım ' + (ui.tip + 1) + ' / ' + D.TIPS.length; $('tcTitle').textContent = t[0]; $('tcText').textContent = t[1];
  $('tcDots').innerHTML = D.TIPS.map(function (_, i) { return '<i class="' + (i === ui.tip ? 'on' : '') + '"></i>'; }).join(''); $('tcNext').textContent = ui.tip === D.TIPS.length - 1 ? 'Bitir' : 'İleri';
}
$('tcNext').onclick = function () { if (ui.tip >= D.TIPS.length - 1) ui.tipDone = true; else ui.tip++; renderTip(); save(); };
$('tcSkip').onclick = function () { ui.tipDone = true; renderTip(); save(); };

/* ---------- rota ve duraklar ---------- */
function city(n) { return D.CITIES.filter(function (c) { return c.n === n; })[0]; }
function cityWps(names) { return names.map(function (n) { var c = city(n); return { n: c.n, lat: c.lat, lon: c.lon }; }); }
function renderWps() {
  var w = cfg.route.waypoints;
  $('wps').innerHTML = w.map(function (x, i) { return '<div class="wp"><b>' + String.fromCharCode(65 + i % 26) + '</b><span title="' + esc(x.n) + '">' + esc(x.n) + '</span>' + (i > 0 ? '<button data-up="' + i + '" aria-label="Yukarı al">↑</button>' : '') + '<button data-del="' + i + '" aria-label="Durağı sil">×</button></div>'; }).join('') || '<p class="small muted">Durak yok. Şehir ekleyin, adres arayın ya da haritaya tıklayın.</p>';
  $('routeChip').textContent = w.length >= 2 ? w[0].n + ' → ' + w[w.length - 1].n + (w.length > 2 ? ' (+' + (w.length - 2) + ' durak)' : '') : 'Rota seçilmedi';
}
$('wps').addEventListener('click', function (e) {
  var d = e.target.closest('[data-del]'), u = e.target.closest('[data-up]'), w = cfg.route.waypoints;
  if (d) { w.splice(+d.getAttribute('data-del'), 1); routeChanged(); }
  else if (u) { var i = +u.getAttribute('data-up'); if (i > 0) { var x = w[i]; w[i] = w[i - 1]; w[i - 1] = x; routeChanged(); } }
});
$('cityAdd').onclick = function () { var c = city($('cityPick').value); addWp({ n: c.n, lat: c.lat, lon: c.lon }); };
$('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-preset]'); if (!b) return; cfg.route.waypoints = cityWps(D.PRESETS[+b.getAttribute('data-preset')][1]); routeChanged(); });
function addWp(w) { if (cfg.route.waypoints.length >= 25) { toast('En fazla 25 durak eklenebilir.'); return; } cfg.route.waypoints.push(w); routeChanged(); }
$('addrGo').onclick = function () {
  var q = $('addr').value.trim(), box = $('sugg'); if (!q) return;
  if (q.length < 3) { box.innerHTML = '<p class="small muted">En az 3 harf yazın.</p>'; return; }
  box.innerHTML = '<p class="small muted">Aranıyor…</p>';
  var wp = cfg.route.waypoints, near = M.center() || (wp.length ? [wp[0].lon, wp[0].lat] : null);
  M.geocode(q, near).then(function (r) {
    if (!r.length) { box.innerHTML = '<p class="small muted">Sonuç bulunamadı. Daha açık bir adres yazın.</p>'; return; }
    box.innerHTML = r.map(function (x, i) { return '<button class="opt" data-s="' + i + '">' + esc(x.n) + '</button>'; }).join('');
    box.onclick = function (e) { var b = e.target.closest('[data-s]'); if (!b) return; addWp(r[+b.getAttribute('data-s')]); box.innerHTML = ''; $('addr').value = ''; };
  }).catch(function (err) { if (err.name === 'AbortError') return; box.innerHTML = '<p class="small" style="color:var(--bad)">' + esc(err.message) + '</p>'; });
};
$('addr').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('addrGo').click(); });
var tipTimer; function toast(msg) { var t = $('maptip'); t.textContent = msg; t.hidden = false; clearTimeout(tipTimer); tipTimer = setTimeout(function () { t.hidden = true; }, 3600); }

/* Rota değişti: karayolu rotasını OSRM'den iste (kısa gecikmeyle, önceki istek iptal). Hesaplanamazsa "tahmin" olarak işaretle, gerçek gibi gösterme. */
var routeTimer;
function routeChanged() {
  renderWps(); M.setWaypoints(cfg.route.waypoints);
  routeInfo = { kind: 'none' }; M.setRoute(null); simPause(); sim.t = 0;
  clearTimeout(routeTimer); var seq = ++routeSeq, w = cfg.route.waypoints;
  if (cfg.route.mode === 'route' && w.length >= 2) { routeInfo = { kind: 'loading' }; routeTimer = setTimeout(function () { fetchRoute(seq); }, 350); }
  update();
}
/* Varsayılan Gebze → İzmit rotası mı? (yalnız bu durumda, servis yanıt vermezse kayıtlı DEMO rota kullanılır) */
function isDefaultRoute() {
  var w = cfg.route.waypoints, d = E.defaultConfig().route.waypoints; if (w.length !== d.length) return false;
  return w.every(function (x, i) { return Math.abs(x.lat - d[i].lat) < 1e-4 && Math.abs(x.lon - d[i].lon) < 1e-4; });
}
function fetchRoute(seq) {
  M.route(cfg.route.waypoints.slice()).then(function (r) {
    if (seq !== routeSeq) return;
    routeInfo = { kind: 'road', km: r.km, min: r.minutes, coords: r.coords, legKm: r.legKm, provider: r.provider, cached: !!r.cached };
    M.setRoute({ kind: 'road', coords: r.coords }); M.fit(); update();
  }).catch(function (err) {
    if (err.name === 'AbortError' || seq !== routeSeq) return;
    var dm = window.RobovanDemoRoute;
    if (dm && isDefaultRoute() && cfg.route.mode === 'route') {   /* DEMO: kayıtlı gerçek OSRM geometrisi; gerçek canlı rota DEĞİLDİR, rozetle belirtilir */
      routeInfo = { kind: 'demo', km: dm.km, min: dm.minutes, coords: dm.coords, legKm: dm.legKm, provider: dm.source, error: err.message };
      M.setRoute({ kind: 'road', coords: dm.coords }); M.fit(); update(); return;
    }
    routeInfo = { kind: 'air', error: err.message }; update();
  });
}
$('addBtn').onclick = function () { var on = $('addBtn').getAttribute('aria-pressed') !== 'true'; $('addBtn').setAttribute('aria-pressed', on ? 'true' : 'false'); M.setAddMode(on); toast(on ? 'Haritaya tıklayarak durak ekleyin.' : 'Durak ekleme kapatıldı.'); };
$('followBtn').onclick = function () { var on = $('followBtn').getAttribute('aria-pressed') !== 'true'; $('followBtn').setAttribute('aria-pressed', on ? 'true' : 'false'); M.setFollow(on); };
document.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { M.view(b.getAttribute('data-view')); }; });
/* ---------- harita durumu ---------- */
function startMap() {
  M.init({ container: 'map', cb: {
    onState: onMapState, onNotice: toast,
    onMapClick: function (p) { addWp({ n: 'Nokta (' + p.lat.toFixed(3) + ', ' + p.lon.toFixed(3) + ')', lat: p.lat, lon: p.lon }); },
    onStopDrag: function (i, p) { var w = cfg.route.waypoints[i]; w.lat = p.lat; w.lon = p.lon; w.n = 'Nokta (' + p.lat.toFixed(3) + ', ' + p.lon.toFixed(3) + ')'; routeChanged(); },
    onCarClick: openCar,
    onFollow: function (on) { $('followBtn').setAttribute('aria-pressed', on ? 'true' : 'false'); },
    } });
}
function onMapState(s, msg) {
  mapState = s; var box = $('mapstate'), t = $('msTitle'), x = $('msText');
  box.hidden = s === 'ready'; $('mapRetry').hidden = s !== 'error';
  if (s === 'loading') { t.textContent = 'Harita yükleniyor'; x.textContent = 'OpenStreetMap haritası (OpenFreeMap) indiriliyor…'; }
  else if (s === 'error') { t.textContent = 'Harita açılamadı'; x.textContent = msg + ' Hesaplama, grafikler ve elle mesafe/şehir listesi çalışmaya devam eder.'; }
  if (s === 'ready') { M.setWaypoints(cfg.route.waypoints); if (routeInfo.kind === 'road' || routeInfo.kind === 'demo') { M.setRoute({ kind: 'road', coords: routeInfo.coords }); } M.fit(); renderLive(); }
  ['addBtn', 'followBtn'].forEach(function (id) { $(id).disabled = s !== 'ready'; }); document.querySelectorAll('[data-view]').forEach(function (b) { b.disabled = s !== 'ready'; });
  update();
}
$('mapRetry').onclick = function () { startMap(); };

/* ---------- simülasyon saati (06:00'da başlar; ×1 = 1 sim. dakika / gerçek saniye) ---------- */
function liveReady() { return !!(live && lastA); }
/* hareket (araç animasyonu) şartı: harita hazır ve karayolu (veya DEMO) rota geometrisi var; harita hiç açılamadıysa yalnız saat/canlı defter çalışır */
function movePossible() { if (!liveReady()) return false; if (mapState === 'error' || mapState === 'idle' && !M.map) return true; return mapState === 'ready' && M.hasRoute(); }
function moveWhy() {
  if (!liveReady()) return 'Simülasyon için geçerli girdi gerekir.';
  if (mapState === 'loading' || mapState === 'idle') return 'Harita yükleniyor…';
  if (mapState === 'ready' && !M.hasRoute()) {
    if (routeInfo.kind === 'loading') return 'Karayolu rotası hesaplanıyor; araçlar başlangıçta park halinde, rota gelince hareket başlayabilir.';
    if (cfg.route.mode === 'manual') return 'Elle mesafe modunda yol geometrisi yoktur: araçlar başlangıçta park halinde. Hareket için "Rotadan" moduna geçin.';
    if (cfg.route.waypoints.length < 2) return 'Hareket için en az iki durak gerekir; araçlar başlangıçta park halinde.';
    return 'Karayolu rotası servisinden yanıt alınamadı: araçlar başlangıçta park halinde, hareket başlatılamıyor. Daha sonra tekrar deneyin veya rotayı değiştirin.';
  }
  return '';
}
function simEnd() { return live ? live.endMin : 0; }
function setSim(t) { sim.t = Math.max(0, Math.min(t, simEnd())); renderLive(); }
function simFrame(ts) {
  if (!sim.playing) return;
  var dt = Math.min((ts - sim.ts) / 1000, 0.1); sim.ts = ts;
  sim.frames.push(dt * 1000); if (sim.frames.length > 40) sim.frames.shift();
  if (mapState === 'ready' && !M.isSimpleVan() && sim.frames.length === 40 && sim.frames.reduce(function (a, b) { return a + b; }, 0) / 40 > 50) { M.setSimpleVan(true); toast('Cihaz yavaş: araçlar sade görünüme geçirildi.'); }
  var t0 = sim.t; sim.t += dt * sim.speed;   /* hız çarpanı yalnızca zamanın akış hızıdır; maliyet motorundan gelir, çarpanla değişmez */
  if (sim.t >= simEnd()) { sim.t = simEnd(); sim.playing = false; tripEvents(t0, sim.t); renderLive(); syncControls(); return; }
  tripEvents(t0, sim.t);
  renderLive(); sim.raf = requestAnimationFrame(simFrame);
}
function simPlay() { if (!movePossible()) return; if (sim.t >= simEnd()) sim.t = 0; sim.playing = true; sim.frames = []; sim.ts = performance.now(); cancelAnimationFrame(sim.raf); sim.raf = requestAnimationFrame(simFrame); syncControls(); }
function simPause() { sim.playing = false; cancelAnimationFrame(sim.raf); syncControls(); }
function simReset() { simPause(); sim.t = 0; renderLive(); }
$('pp').onclick = function () { if (sim.playing) simPause(); else simPlay(); };
$('rs').onclick = simReset;
document.querySelectorAll('.sp').forEach(function (b) { b.onclick = function () { sim.speed = +b.getAttribute('data-sp'); syncControls(); }; });
$('tl').addEventListener('input', function (e) { if (!movePossible()) return; simPause(); setSim(+e.target.value / 1000 * simEnd()); });
function syncControls() {
  var ok = movePossible(), why = moveWhy();
  $('pp').textContent = sim.playing ? '⏸' : '▶'; $('pp').setAttribute('aria-label', sim.playing ? 'Duraklat' : (sim.t > 0 && sim.t < simEnd() ? 'Devam et' : 'Oynat'));
  $('pp').disabled = !ok; $('rs').disabled = !liveReady(); $('tl').disabled = !ok; document.querySelectorAll('.sp').forEach(function (b) { b.disabled = !liveReady(); b.setAttribute('aria-pressed', +b.getAttribute('data-sp') === sim.speed ? 'true' : 'false'); });
  $('timeline').classList.toggle('blocked', !ok);
  $('tlTxt').textContent = ok ? 'Simülasyon ' + clockStr(sim.t) + ' · geçen ' + elapsedStr(sim.t) + ' / ' + elapsedStr(simEnd()) + (mapState === 'error' ? ' · harita açılamadı, yalnız saat ve canlı maliyet çalışır' : '') + (routeInfo.kind === 'demo' ? ' · DEMO rota' : '') : why;
  $('pp').title = ok ? 'Oynat / duraklat / devam' : why;
}
/* sefer sonu bildirimi (haritanın üstünde): biten seferin maliyeti ve karşı modelin aynı sefer maliyeti */
function tripEvents(t0, t1) {
  if (!live || !lastA || t1 - t0 > 40) return;
  var ev = live.events(t0, t1); if (!ev.length || performance.now() - toastAt < 1500) return; toastAt = performance.now();
  var e = ev[ev.length - 1], r = lastA, V = r.vehicles, other = e.modelId === r.kpi.a ? r.kpi.b : r.kpi.a, d = V[other].perTrip - e.cost;
  toast(e.carName + ' · ' + e.tripNo + '/' + e.tripsTotal + '. sefer tamam: ' + moneyD(e.cost) + ' · ' + V[other].name + ' aynı seferde ' + moneyD(V[other].perTrip) + (Math.abs(d) < 0.005 ? '' : ' (' + moneyD(Math.abs(d)) + (d > 0 ? ' daha ucuz' : ' daha pahalı') + ')'));
}
/* canlı değerler: yalnızca motorun günlük defterinden (süs/rastgele sayaç yok). Her araç kendi seferlerini art arda yapar; tutarlar 06:00'dan şimdiye birikimdir. */
function renderLive() {
  var r = lastA;
  $('clock').textContent = clockStr(sim.t); $('elapsed').textContent = elapsedStr(sim.t); $('hudClock').textContent = clockStr(sim.t); $('hudEl').textContent = elapsedStr(sim.t);
  if (live && r) {
    var cars = live.at(sim.t), models = live.modelsAt(sim.t), byM = {}; models.forEach(function (m) { byM[m.id] = m; });
    var V = r.vehicles, pair = [r.kpi.a, r.kpi.b], allDone = cars.every(function (c) { return c.done; });
    $('hudSt').textContent = !movePossible() ? 'Park halinde' : allDone ? 'Gün tamam' : sim.playing ? 'Çalışıyor' : sim.t > 0 ? 'Duraklatıldı' : 'Hazır';
    $('hudRows').innerHTML = pair.map(function (id) { var m = byM[id]; return '<div class="hr" style="--c:' + esc(m.color) + '"><div class="hr-n"><i></i><b>' + esc(m.name) + ' ×' + m.n + '</b><span>sefer ' + m.tripsDone + '/' + m.tripsTotal + '</span></div><div class="hr-v"><span>' + nf(m.km, 1) + ' km</span><span>' + nf(m.energyQty, 1) + ' ' + m.unit + '</span><b>' + moneyD(m.total) + '</b></div><div class="hr-p"><i style="width:' + (m.progress * 100).toFixed(1) + '%"></i></div></div>'; }).join('');
    var a = byM[r.kpi.a], b = byM[r.kpi.b], dNow = b.total - a.total, dDay = b.dayTotal - a.dayTotal;
    $('hudDiff').innerHTML = 'Bugün şu ana kadar maliyet farkı <b class="' + (dNow < 0 ? 'bad' : 'good') + '">' + moneyD(dNow) + '</b>';
    $('liveDiff').innerHTML = '<div><span>Bugün şu ana kadar fark (' + esc(b.name) + ' − ' + esc(a.name) + ')</span><b class="' + (dNow < 0 ? 'bad' : 'good') + '">' + moneyD(dNow) + '</b></div><div><span>Gün sonu fark (tam gün)</span><b class="' + (dDay < 0 ? 'bad' : 'good') + '">' + moneyD(dDay) + '</b></div>';
    if (ui.bm === 'live') renderBars(r, models);
    if (mapState === 'ready') {
      var moving = M.hasRoute(), perKm = {}; models.forEach(function (m) { perKm[m.id] = m.km > 0 ? m.total / m.km : null; });
      var other = function (id) { return id === pair[0] ? pair[1] : id === pair[1] ? pair[0] : null; }, slot = 0;
      M.setVehicles(cars.map(function (c) {
        var o = other(c.modelId), tone = '', mine = perKm[c.modelId], theirs = o ? perKm[o] : null;
        if (mine !== null && theirs !== null && Math.abs(mine - theirs) > 1e-9) tone = mine < theirs ? 'good' : 'bad';
        var firstOfModel = c.idx === 0, show = ((!c.parkedStart && !c.done) || firstOfModel || carSel === c.id), st = moving ? PHASE[c.phase] + (c.tripNo ? ' · ' + c.tripNo + '/' + c.tripsTotal : '') : 'park halinde';
        return { id: c.id, type: c.category, color: c.color, spin: moving ? c.km * 1000 / 0.5 : 0, name: c.name, value: moneyD(c.total), status: st, tone: tone, show: show, slot: show ? (slot++) % 4 : 0, selected: carSel === c.id, bump: c.tripsDone + (c.done ? 'd' : ''), parked: c.parkedStart || c.done, follow: c.idx === 0 && pair.indexOf(c.modelId) > -1, frac: moving ? c.posFrac : 0, rev: c.rev, roundTrip: r.config.scenario.roundTrip };
      }));
    }
    renderCar(cars, models, r);
  }
  if (live && Number.isFinite(simEnd()) && simEnd() > 0) $('tl').value = Math.round(sim.t / simEnd() * 1000);
  syncControls();
}
/* araca tıklayınca ayrıntı kartı: o aracın bugünkü birikimi ve kalemleri */
function openCar(id) { carSel = carSel === id ? null : id; renderLive(); }
function renderCar(cars, models, r) {
  var box = $('carcard'); $('mapcard').classList.toggle('car-open', !!carSel); if (!carSel) { box.hidden = true; return; }
  var c = cars.filter(function (x) { return x.id === carSel; })[0]; if (!c) { carSel = null; box.hidden = true; return; }
  var V = r.vehicles, vm = veh(c.modelId), m = models.filter(function (x) { return x.id === c.modelId; })[0], v = V[c.modelId], pair = [r.kpi.a, r.kpi.b], o = c.modelId === pair[0] ? pair[1] : c.modelId === pair[1] ? pair[0] : null;
  box.hidden = false; box.style.setProperty('--c', c.color);
  $('ccName').textContent = c.name; $('ccSub').textContent = (vm && vm.model ? vm.model + ' · ' : '') + CAT[c.category].label + ' · ' + PHASE[c.phase] + (c.tripNo ? ' · sefer ' + c.tripNo + '/' + c.tripsTotal : '');
  $('ccBig').innerHTML = moneyD(c.total) + '<small>bugün (06:00\'dan şimdiye)</small>';
  var kmNow = c.km > 0 ? c.total / c.km : null, kmO = o ? V[o].perKm : null;
  $('ccGrid').innerHTML = [['Yol', nf(c.km, 1) + ' km'], [c.unit === 'kWh' ? 'Elektrik' : 'Dizel', nf(c.energyQty, 1) + ' ' + c.unit], ['km başına (bugün)', kmNow === null ? '—' : money(kmNow, 2)], ['Sefer başına (motor)', moneyD(v.perTrip)], ['Ortalama hız', nf(c.speed, 0) + ' km/sa'], [o ? V[o].name + ' km başına' : 'Araç sayısı', o ? money(kmO, 2) : String(v.n)]].map(function (x) { return '<div><span>' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('');
  var items = [['Enerji / yakıt', c.cost.energy, '--c-energy'], ['Bakım + lastik', c.cost.maint, '--c-maint'], ['Personel', c.cost.people, '--c-people'], ['Amortisman + finansman', c.cost.dep + c.cost.fin, '--c-capital'], ['Sigorta, vergi, lisans', c.cost.fixed, '--c-fixed']], tot = Math.max(c.total, 1e-9);
  $('ccItems').innerHTML = items.map(function (x) { return '<div class="ci"><span><i style="background:var(' + x[2] + ')"></i>' + esc(x[0]) + '</span><b>' + moneyD(x[1]) + '</b><u style="width:' + (x[1] / tot * 100).toFixed(1) + '%;background:var(' + x[2] + ')"></u></div>'; }).join('');
}
$('ccClose').onclick = function () { carSel = null; renderLive(); };
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && carSel && $('sheet').hidden) { carSel = null; renderLive(); } });

/* ---------- what-if çipleri: seçilen senaryo değerlerin üstüne geçici uygulanır, girdiğiniz değerler değişmez ---------- */
var WI = { fuel: ['Dizel yakıt +%20', function (c) { c.fleet.forEach(function (v) { if (v.category === 'conventional') v.params.fuel *= 1.2; }); }],
  driver: ['Sürücü maliyeti +%30', function (c) { c.fleet.forEach(function (v) { if (v.category === 'conventional') v.params.driver *= 1.3; }); }],
  ratio: ['Operatör başına 10 araç', function (c) { c.fleet.forEach(function (v) { if (v.category === 'robovan') v.params.ratio = 10; }); }],
  price: ['Robovan fiyatı −%10', function (c) { c.fleet.forEach(function (v) { if (v.category === 'robovan') v.params.price *= 0.9; }); }] };
function wiActive() { return Object.keys(WI).some(function (k) { return ui.wi[k]; }); }
function effCfg() { if (!wiActive()) return cfg; var c = JSON.parse(JSON.stringify(cfg)); Object.keys(WI).forEach(function (k) { if (ui.wi[k]) WI[k][1](c); }); return c; }
document.addEventListener('click', function (e) { var b = e.target.closest('[data-wi]'); if (!b) return; ui.wi[b.dataset.wi] = !ui.wi[b.dataset.wi]; update(); });
function renderWhatIf(r, on) {
  document.querySelectorAll('[data-wi]').forEach(function (b) { b.setAttribute('aria-pressed', ui.wi[b.dataset.wi] ? 'true' : 'false'); });
  var el = $('wiRes'); if (!on) { el.innerHTML = 'Bir senaryo seçin: sonuç, çubuklar ve geri ödeme anında güncellenir. Girdiğiniz değerler değişmez.'; return; }
  var b0 = E.analyze(cfg, analyzeOpts()); if (!b0.ok) { el.textContent = ''; return; }
  var K = r.kpi, K0 = b0.kpi, A = r.vehicles[K.a].name;
  el.innerHTML = '<div><span>Bu senaryoda yıllık fark</span><b class="' + (K.annualSaving >= 0 ? 'good' : 'bad') + '">' + money(K.annualSaving) + '</b></div><div><span>Ana senaryoda</span><b>' + money(K0.annualSaving) + '</b></div><div><span>Geri ödeme (' + esc(A) + ')</span><b>' + esc(K.breakEven.label) + '</b></div><div><span>Ana senaryoda geri ödeme</span><b>' + esc(K0.breakEven.label) + '</b></div>';
}
/* "Neden bu sonuç?": km başına maliyet farkının hangi kalemden geldiği */
function renderWhy(r) {
  var V = r.vehicles, K = r.kpi, A = V[K.a], B = V[K.b], names = ['Enerji / yakıt', 'Bakım + lastik', 'Personel', 'Amortisman + finansman', 'Sigorta, vergi, lisans'];
  var per = function (c) { var f = c.kmv > 0 ? 1 / c.kmv : 0; return segsOf(c, f); }, pa = per(A), pb = per(B), win = A.perKm !== null && B.perKm !== null && A.perKm <= B.perKm ? A : B, los = win === A ? B : A;
  var rows = names.map(function (n, i) { return { n: n, d: pa[i] - pb[i] }; }).sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); }).slice(0, 3);
  var adv = names.map(function (n, i) { return { n: n, v: (win === A ? pb[i] - pa[i] : pa[i] - pb[i]) }; }).sort(function (x, y) { return y.v - x.v; })[0];
  $('whyHead').textContent = A.perKm === null || B.perKm === null ? 'km başına maliyet için rota mesafesi gerekir.' : win.name + ' km başına ' + money(Math.abs(A.perKm - B.perKm), 2) + ' daha ucuz; en büyük fark "' + adv.n + '" kaleminde (' + money(Math.max(0, adv.v), 3) + '/km).';
  $('whyItems').innerHTML = rows.map(function (x) { var good = x.d < 0; return '<div class="wy"><span>' + esc(x.n) + '</span><b class="' + (Math.abs(x.d) < 5e-4 ? '' : good ? 'good' : 'bad') + '">' + esc(A.name) + (x.d < 0 ? ' ' + money(-x.d, 3) + ' daha az' : x.d > 0 ? ' ' + money(x.d, 3) + ' daha çok' : ' aynı') + '</b></div>'; }).join('');
  var rank = r.order.slice().sort(function (x, y) { var a1 = V[x].perKm, b1 = V[y].perKm; return (a1 === null ? Infinity : a1) - (b1 === null ? Infinity : b1); });
  $('whyRank').innerHTML = rank.map(function (id, i) { var c = V[id]; return '<span class="rk"><i style="background:' + esc(c.color) + '">' + (i + 1) + '</i>' + esc(c.name) + ' <b>' + (c.perKm === null ? '—' : money(c.perKm, 2)) + '/km</b></span>'; }).join('');
}

/* ---------- çizim ---------- */
var raf = 0; function update() { syncInputs(); if (!raf) raf = requestAnimationFrame(function () { raf = 0; draw(); }); save(); }
function analyzeOpts() { return routeInfo.kind === 'road' || routeInfo.kind === 'demo' ? { roadKm: routeInfo.km } : {}; }
function segsOf(c, f) { return [c.energy * f, c.maint * f, c.people * f, (c.dep + c.fin) * f, c.fixed * f]; }
function renderBars(r, st) {
  var V = r.vehicles, items, mx, note;
  if (ui.bm === 'live' && st) {
    mx = Math.max.apply(null, st.map(function (m) { return m.dayTotal || 0; }).concat([0]));
    items = st.map(function (m) { return { id: m.id, name: m.name, color: m.color, seg: [m.cost.energy, m.cost.maint, m.cost.people, m.cost.dep + m.cost.fin, m.cost.fixed], total: m.total, sub: m.n + ' araç · sefer ' + m.tripsDone + '/' + m.tripsTotal + ' · %' + nf(m.progress * 100, 0) + ' · gün sonu ' + moneyD(m.dayTotal) }; });
    note = 'Çubuklar bugünkü birikimdir (06:00\'dan şimdiye, tüm araçlar); ölçek günün tam maliyetidir. ' + D.LIVE_NOTE;
  } else if (ui.bm === 'trip') {
    items = r.order.map(function (id) { var c = V[id], t = c.tpv * r.config.scenario.days, f = t > 0 ? 1 / t : 0; return { id: id, name: c.name, color: c.color, seg: segsOf(c, f), total: c.perTrip === null ? 0 : c.perTrip, sub: nf(c.tripKm, 1) + ' km sefer · ' + nf(c.tripH, 2) + ' sa' }; });
    note = 'Bir seferin tam maliyeti (motorun sefer başına değeri).';
  } else {
    items = r.order.map(function (id) { var c = V[id]; return { id: id, name: c.name, color: c.color, seg: segsOf(c, c.n), total: c.fleet, sub: c.n + ' araç · yıllık filo maliyeti' }; });
    note = 'Yıllık filo maliyeti (tüm araçlar, bir yıl). Tek seferle karıştırmayın.';
  }
  var fmt = ui.bm === 'year' ? function (x) { return money(x, 0); } : moneyD;
  $('lgBars').innerHTML = C.costBars($('costBars'), items, fmt, mx);
  $('barNote').textContent = note;
}
/* motor hata iletilerini ilgili alana bağlar: "Araç adı · Etiket: ileti" veya "Etiket: ileti" */
function mapFieldErrors(errors) {
  var m = {}, byLabel = {}; Object.keys(E.LABEL).forEach(function (k) { byLabel[E.LABEL[k]] = k; });
  errors.forEach(function (e) {
    var i = e.indexOf(': '); if (i < 0) return; var head = e.slice(0, i), msg = e.slice(i + 2), vn = null, lab = head, j = head.indexOf(' · ');
    if (j > -1) { vn = head.slice(0, j); lab = head.slice(j + 3); }
    var key = byLabel[lab]; if (!key) return;
    if (vn) { var v = cfg.fleet.filter(function (x) { return x.name === vn; })[0]; if (v) m['v.' + v.id + '.' + key] = msg; } else m['s.' + key] = msg;
  });
  return m;
}
function draw() {
  var wiOn = wiActive(), a = E.analyze(effCfg(), analyzeOpts()), warns = [];
  fieldErr = a.ok ? {} : mapFieldErrors(a.errors);
  if (!a.ok) { a.errors.forEach(function (m) { warns.push(['err', m]); }); if (last) warns.push(['', 'Sonuçlar son geçerli girdilere aittir. Hataları düzeltin.']); $('resultCard').style.opacity = .5; }
  else { $('resultCard').style.opacity = 1; last = a; a.warnings.forEach(function (m) { warns.push(['', m]); }); }
  if (cfg.route.mode === 'route' && routeInfo.kind === 'air' && routeInfo.error) warns.push(['', 'Karayolu rotası hesaplanamadı: ' + routeInfo.error + ' Mesafe kuş uçuşu × yol katsayısıyla tahmin ediliyor.']);
  if (routeInfo.kind === 'demo') warns.push(['', 'DEMO: Karayolu rotası servisine ulaşılamadı (' + routeInfo.error + '). Varsayılan Gebze → İzmit için önceden kaydedilmiş gerçek OSRM rotası gösteriliyor; canlı rota değildir.']);
  $('warns').innerHTML = warns.map(function (w) { return '<div class="warn ' + w[0] + '">' + esc(w[1]) + '</div>'; }).join('');
  syncInputs();
  var r = a.ok ? a : last; if (!r) return; lastA = r;
  live = E.buildDay(r, r.config); if (sim.t > live.endMin) sim.t = live.endMin;
  renderWhy(r); renderWhatIf(r, wiOn);
  var V = r.vehicles, K = r.kpi, A = V[K.a], B = V[K.b], sc = r.config.scenario, rt = r.route;
  renderRoute(r);
  $('anPair').textContent = A.name + ' ile ' + B.name;
  /* karar kartı: kim daha ekonomik, ne kadar, hangi değerlerle */
  var sav = K.annualSaving, red = B.fleet > 0 ? sav / B.fleet * 100 : NaN, win = sav >= 0 ? A : B, lose = sav >= 0 ? B : A, redW = lose.fleet > 0 ? Math.abs(sav) / lose.fleet * 100 : NaN;
  $('rLbl').textContent = Math.abs(sav) < 0.5 ? 'İki araç yaklaşık aynı maliyette' : win.name + ' ' + pct(redW) + ' daha ekonomik';
  var big = $('rBig'); big.textContent = (sav < 0 ? '−' : '') + money(Math.abs(sav)).replace('−', ''); big.className = 'big' + (sav < 0 ? ' bad' : '');
  $('rSub').textContent = (sav >= 0 ? 'Tahmini yıllık tasarruf' : 'Tahmini yıllık ek maliyet') + ' · ' + A.name + ', ' + B.name + ' yerine · ' + sc.demand + ' sefer/gün';
  var cmpRows = [['km başına', function (c) { return c.perKm; }, 2], ['Sefer başına', function (c) { return c.perTrip; }, 2], ['Yıllık filo (' + 'tüm araçlar' + ')', function (c) { return c.fleet; }, 0]];
  $('cmpGrid').innerHTML = '<div class="cm-h"></div>' + [A, B].map(function (c) { return '<div class="cm-h" style="--c:' + esc(c.color) + '"><i></i>' + esc(c.name) + '<span>' + c.n + ' araç</span></div>'; }).join('') +
    cmpRows.map(function (row) { var x = row[1](A), y = row[1](B), ax = x !== null && y !== null && x < y, by = x !== null && y !== null && y < x; return '<div class="cm-l">' + row[0] + '</div><div class="cm-v' + (ax ? ' win' : '') + '">' + money(x, row[2]) + '</div><div class="cm-v' + (by ? ' win' : '') + '">' + money(y, row[2]) + '</div>'; }).join('');
  $('rFoot').textContent = (wiOn ? 'What-if aktif · ' : '') + 'Geri ödeme: ' + K.breakEven.label + ' · ' + nf(rt.km, 1) + ' km tek yön (' + sourceName(rt.source) + ')';
  /* geri ödeme / toplam (Yatırım ve Geri Ödeme sekmesi) */
  var be = K.breakEven, bw = K.breakEvenWage, bsel = veh(K.b);
  $('extra').innerHTML = [
    stat('Geri ödeme (başa baş)', esc(be.label), 'ilk yatırım farkı ' + money(K.investmentDiff), be.status === 'never' ? 'bad' : (be.years !== null && be.years <= sc.horizon ? 'good' : 'warn')),
    stat('Başa baş sürücü maliyeti', esc(bw.label || money(bw.value) + '/ay'), bw.status === 'n/a' ? esc(B.name) + ' sürücüsüz' : 'şu an ' + money(bsel.params.driver) + '/ay', ''),
    stat(nf(sc.horizon, 0) + ' yıllık toplam fark', (K.tcoSaving >= 0 ? '+' : '−') + money(Math.abs(K.tcoSaving)).replace('−', ''), K.tcoSaving >= 0 ? esc(A.name) + ' lehine, kalıntı değer düşülmüş' : esc(A.name) + ' aleyhine', K.tcoSaving >= 0 ? 'good' : 'bad'),
    stat('İlk yatırım (filo)', money(A.capexFleet), esc(B.name) + ': ' + money(B.capexFleet), ''),
    stat(esc(A.name) + ' işletme', money(A.ops.dailyCostFleet) + '/gün', money(A.ops.monthlyCostFleet) + '/ay · yıllık ' + money(A.fleet), '')
  ].join('');
  r.order.forEach(function (k) { var e = $('vsum-' + k); if (e) e.textContent = V[k].n + ' araç · ' + (V[k].perKm === null ? '—' : nf(V[k].perKm, 2)) + ' ' + ui.cur + '/km · yıllık ' + money(V[k].fleet); });
  document.querySelectorAll('[id^="vsum-"]').forEach(function (e) { var id = e.id.slice(5); if (!V[id]) e.textContent = ''; });
  /* araç çubukları (canlı modda renderLive çizer) */
  if (ui.bm !== 'live') renderBars(r, null);
  /* maliyet dağılımı: km başına */
  var distItems = r.order.map(function (id) { var c = V[id], f = c.kmv > 0 ? 1 / c.kmv : 0; return { id: id, name: c.name, color: c.color, seg: segsOf(c, f), total: c.perKm === null ? 0 : c.perKm, sub: c.n + ' araç' }; });
  $('lgDist').innerHTML = C.costBars($('chDist'), distItems, function (x) { return money(x, 3); });
  /* grafikler */
  var marks = C.cumulative($('chCum'), r, ui.cur, E);
  $('cumNote').textContent = marks.length ? marks.join(' · ') + '. Kesikli çizgi değerlendirme süresidir.' : 'Seçili iki araç arasında başa baş noktası 10 yıl içinde yok. Kesikli çizgi değerlendirme süresidir.';
  $('lgVeh').innerHTML = r.order.map(function (k) { return '<span><i style="background:' + esc(V[k].color) + '"></i>' + esc(V[k].name) + '</span>'; }).join('');
  $('lgVeh2').innerHTML = $('lgVeh').innerHTML;
  $('sensNote').textContent = C.sensitivity($('chSens'), r, ui.cur, { param: ui.param, metric: ui.metric }, function (c) { return E.analyze(c, analyzeOpts()); }) || 'Dikey çizgi şu anki değerdir.';
  tables(r);
  var dn = $('distNote'); dn.textContent = 'Mesafe: ' + nf(rt.km, 1) + ' km tek yön (' + sourceName(rt.source) + '). Mesafe haritadaki "Rota ve duraklar" kartından değiştirilir.';
  window.__last = r;
  renderLive();
}
function stat(l, v, d, cls) { return '<div class="stat"><div class="l">' + l + '</div><div class="v ' + cls + '">' + v + '</div><div class="d">' + d + '</div></div>'; }
function sourceName(s) { return { road: routeInfo.kind === 'demo' ? 'DEMO: kayıtlı örnek rota' : 'OSRM karayolu', air: 'kuş uçuşu tahmini', manual: 'elle girilen' }[s] || s; }
function renderRoute(r) {
  var rt = r.route, sc = r.config.scenario, h, demo = routeInfo.kind === 'demo';
  var badge = demo ? '<span class="badge est">DEMO: kayıtlı örnek rota (gerçek OSRM yanıtının kaydı); canlı servise ulaşılamadı</span>' : rt.source === 'road' ? '<span class="badge road">Gerçek karayolu mesafesi (' + esc(routeInfo.provider || 'OSRM') + ', otomobil)' + (routeInfo.cached ? ' · önbellekten' : '') + '</span>' : rt.source === 'manual' ? '<span class="badge man">Elle girilen mesafe</span>' : '<span class="badge est">Tahmin: kuş uçuşu × ' + nf(sc.roadFactor, 2) + ' (gerçek yol değil; hareket yok)</span>';
  h = '<div class="km">' + nf(rt.km, 1) + ' <small>km tek yön' + (sc.roundTrip ? ' · sefer ' + nf(rt.km * 2, 1) + ' km' : '') + '</small></div>' + badge;
  if (routeInfo.kind === 'loading') h += '<p>Karayolu rotası hesaplanıyor…</p>';
  if (rt.source === 'road' && !demo) h += '<p>Rota otomobil profiliyle hesaplanır; <b>kamyonet kısıtları (yükseklik, ağırlık, geçiş ücreti) dikkate alınmaz.</b>' + (routeInfo.min ? ' Yol süresi yaklaşık ' + hmm(routeInfo.min) + ' (trafiksiz); maliyet hesabı her aracın kendi ortalama hızını kullanır.' : '') + '</p>';
  if (demo) h += '<p>Mesafe ve hareket bu kayıtlı rotadan gelir. Rota servisi yanıt verdiğinde sayfayı yenileyin; gerçek rota otomatik kullanılır.</p>';
  if (cfg.route.mode === 'route' && routeInfo.kind === 'air' && routeInfo.error) h += '<p class="err">' + esc(routeInfo.error) + '</p>';
  if (cfg.route.mode === 'route' && routeInfo.kind === 'none' && rt.source === 'air') h += '<p>Gerçek yol mesafesi için en az iki durak gerekir; şimdilik tahmin kullanılıyor.</p>';
  $('rcRes').innerHTML = h;
  var wps = cfg.route.waypoints, nm = wps.length >= 2 ? esc(wps[0].n) + ' → ' + esc(wps[wps.length - 1].n) : 'Rota seçilmedi';
  $('rcSum').innerHTML = '<b>' + nm + '</b><br>' + nf(rt.km, 1) + ' km tek yön · ' + sourceName(rt.source) + (wps.length > 2 ? ' · ' + wps.length + ' durak' : '');
}
function hmm(min) { if (!Number.isFinite(min)) return '0:00'; var m = Math.round(min); return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }
function tables(r) {
  var V = r.vehicles, sc = r.config.scenario;
  var sum = [
    ['sec', 'Maliyet'], ['Yıllık filo maliyeti', function (c) { return money(c.fleet); }, 1], ['km başına', function (c) { return money(c.perKm, 2); }], ['Sefer başına', function (c) { return money(c.perTrip, 2); }], ['Ton-km başına', function (c) { return money(c.perTonKm, 3); }],
    ['sec', 'Filo ve yatırım'], ['Araç sayısı', function (c) { return nf(c.n); }], ['İlk yatırım (filo)', function (c) { return money(c.capexFleet); }], [nf(sc.horizon, 0) + ' yıllık toplam sahip olma maliyeti', function (c) { return money(c.tco(sc.horizon)); }]
  ];
  $('sumTable').innerHTML = tableHtml(sum, r);
  var ops = [
    ['sec', 'Filo ve sefer'], ['Araç başına sefer / gün', function (c) { return nf(c.tpv, 2); }], ['Sefer süresi (saat)', function (c) { return nf(c.tripH, 2); }], ['Günlük kullanılan süre (araç başına, saat)', function (c) { return nf(c.usedH, 1); }],
    ['sec', 'Kilometre ve kapasite'], ['Günlük km (filo)', function (c) { return nf(c.ops.dailyKmFleet); }], ['Yıllık km (filo)', function (c) { return nf(c.ops.annualKmFleet); }], ['Sefer başına taşıma kapasitesi (kg)', function (c) { return nf(c.ops.capacityKgPerTrip); }], ['Yıllık taşınan yük (ton)', function (c) { return nf(c.ops.annualTonnes, 1); }],
    ['sec', 'Personel ve enerji'], ['Vardiya sayısı', function (c) { return nf(c.shifts); }], ['Personel (tam zamanlı eşdeğer)', function (c) { return nf(c.ops.staff, 1) + (c.ops.staffKind === 'operator' ? ' operatör' : ' sürücü'); }], ['Yıllık enerji / yakıt', function (c) { return nf(c.ops.energyQty) + ' ' + c.ops.energyUnit; }]
  ];
  $('opsTable').innerHTML = tableHtml(ops, r);
  var rows = [
    ['sec', 'Yıllık maliyet (araç başına)'], ['Enerji', function (c) { return money(c.energy); }], ['Bakım + lastik', function (c) { return money(c.maint); }], ['Personel', function (c) { return money(c.people); }], ['Sigorta, vergi, lisans', function (c) { return money(c.fixed); }], ['Amortisman', function (c) { return money(c.dep); }], ['Finansman', function (c) { return money(c.fin); }], ['Toplam', function (c) { return money(c.total); }, 1],
    ['sec', 'Filo toplamı'], ['Günlük işletme maliyeti', function (c) { return money(c.ops.dailyCostFleet); }], ['Aylık işletme maliyeti', function (c) { return money(c.ops.monthlyCostFleet); }], ['Yıllık filo maliyeti', function (c) { return money(c.fleet); }, 1]
  ];
  $('table').innerHTML = tableHtml(rows, r);
}
function tableHtml(rows, r) {
  var V = r.vehicles, ids = r.order;
  var t = '<thead><tr><th></th>' + ids.map(function (k) { return '<th><span class="dot" style="background:' + esc(V[k].color) + '"></span>' + esc(V[k].name) + '</th>'; }).join('') + '</tr></thead><tbody>';
  rows.forEach(function (x) { if (x[0] === 'sec') t += '<tr class="sec"><td colspan="' + (ids.length + 1) + '">' + x[1] + '</td></tr>'; else t += '<tr><td>' + esc(x[0]) + '</td>' + ids.map(function (k) { return '<td' + (x[2] ? ' class="strong"' : '') + '>' + x[1](V[k]) + '</td>'; }).join('') + '</tr>'; });
  return t + '</tbody>';
}
function copySummary() {
  var r = window.__last; if (!r) return; var V = r.vehicles, A = V[r.kpi.a], B = V[r.kpi.b];
  var txt = 'Robovan maliyet simülasyonu (örnek varsayımlarla)\nRota: ' + nf(r.route.km, 1) + ' km tek yön (' + sourceName(r.route.source) + '), günlük ' + nf(r.config.scenario.demand) + ' sefer\n' +
    A.name + ': ' + A.n + ' araç, ' + nf(A.perKm, 2) + ' ' + ui.cur + '/km, yıllık ' + money(A.fleet) + '\n' + B.name + ': ' + B.n + ' araç, ' + nf(B.perKm, 2) + ' ' + ui.cur + '/km, yıllık ' + money(B.fleet) + '\nYıllık fark: ' + money(r.kpi.annualSaving) + '\nGeri ödeme: ' + r.kpi.breakEven.label;
  var b = $('copy'); function ok() { b.textContent = 'Kopyalandı'; setTimeout(function () { b.textContent = 'Özeti Kopyala'; }, 1600); }
  function fb() { var ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) {} document.body.removeChild(ta); }
  try { navigator.clipboard.writeText(txt).then(ok, fb); } catch (e) { fb(); }
}

/* mobilde rota kartı panele, animasyon kontrolleri haritanın üstüne taşınır */
var mq = window.matchMedia('(max-width: 900px)');
function placeRoute() {
  var rc = $('routecard'), pill = $('pill'), clock = $('clockbox');
  if (mq.matches) { $('panel').insertBefore(rc, $('ctrlCard')); $('mapctl').appendChild(pill); $('mapctl').appendChild(clock); }
  else { $('mapcard').insertBefore(rc, $('hud')); $('mid').appendChild(clock); $('mid').appendChild(pill); }
  applyRouteOpen(); M.resize();
}
mq.addEventListener ? mq.addEventListener('change', placeRoute) : mq.addListener(placeRoute);

/* ---------- saklama ---------- */
var saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(saveNow, 250); }
window.addEventListener('pagehide', saveNow); document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveNow(); });
function saveNow() { clearTimeout(saveT); try { localStorage.setItem(KEY, JSON.stringify({ cfg: { scenario: cfg.scenario, fleet: cfg.fleet, route: cfg.route, compare: cfg.compare }, ui: ui, raw: raw })); } catch (e) {} }
var HEX = /^#[0-9a-fA-F]{6}$/;
function sanitizeFleet(arr, def) {
  if (!Array.isArray(arr) || arr.length < E.MIN_VEHICLES || arr.length > E.MAX_VEHICLES) return null;
  var out = [], ids = {};
  for (var i = 0; i < arr.length; i++) {
    var v = arr[i]; if (!v || typeof v !== 'object' || !CAT[v.category] || typeof v.id !== 'string' || !/^[a-z0-9_]{1,24}$/.test(v.id) || ids[v.id]) return null; ids[v.id] = 1;
    var base = E.PARAM_DEFAULTS[v.category], p = {};
    Object.keys(base).forEach(function (f) { var x = v.params && v.params[f]; p[f] = typeof x === 'number' && Number.isFinite(x) ? x : base[f]; });
    out.push({ id: v.id, name: typeof v.name === 'string' && v.name.trim() ? v.name.slice(0, 40) : CAT[v.category].label, model: typeof v.model === 'string' ? v.model.slice(0, 60) : '', category: v.category, color: typeof v.color === 'string' && HEX.test(v.color) ? v.color : E.PALETTE[v.category][0], params: p });
  }
  return out;
}
function applyLoaded(d, notes) {
  var def = E.defaultConfig();
  Object.keys(def.scenario).forEach(function (k) { var v = d.cfg.scenario && d.cfg.scenario[k]; if (typeof v === typeof def.scenario[k] && (typeof v !== 'number' || Number.isFinite(v))) cfg.scenario[k] = v; });
  var fl = sanitizeFleet(d.cfg.fleet); if (fl) cfg.fleet = fl;
  var ids = cfg.fleet.map(function (v) { return v.id; }), cp = d.cfg.compare;
  if (cp && ids.indexOf(cp.a) > -1 && ids.indexOf(cp.b) > -1 && cp.a !== cp.b) cfg.compare = { a: cp.a, b: cp.b }; else cfg.compare = { a: ids[0], b: ids[1] };
  var rt = d.cfg.route; if (rt) { if (rt.mode === 'route' || rt.mode === 'manual') cfg.route.mode = rt.mode; if (Number.isFinite(rt.manualKm)) cfg.route.manualKm = rt.manualKm;
    if (Array.isArray(rt.waypoints) && rt.waypoints.length <= 25 && rt.waypoints.every(function (w) { return w && typeof w.n === 'string' && Number.isFinite(w.lat) && Number.isFinite(w.lon) && Math.abs(w.lat) <= 90 && Math.abs(w.lon) <= 180; })) cfg.route.waypoints = rt.waypoints.map(function (w) { return { n: w.n, lat: w.lat, lon: w.lon }; }); }
  if (d.ui) { if (['$', '€', '₺'].indexOf(d.ui.cur) > -1) ui.cur = d.ui.cur; if (typeof d.ui.routeOpen === 'boolean') ui.routeOpen = d.ui.routeOpen; if (Number.isInteger(d.ui.tip) && d.ui.tip >= 0 && d.ui.tip < D.TIPS.length) ui.tip = d.ui.tip; ui.tipDone = d.ui.tipDone === true;
    if (C.PARAMS.some(function (p) { return p.id === d.ui.param; })) ui.param = d.ui.param; if (C.METRICS.some(function (m) { return m.id === d.ui.metric; })) ui.metric = d.ui.metric; if (['live', 'trip', 'year'].indexOf(d.ui.bm) > -1) ui.bm = d.ui.bm; if (['sum', 'dist', 'inv', 'sens'].indexOf(d.ui.tab) > -1) ui.tab = d.ui.tab; if (d.ui.wi && typeof d.ui.wi === 'object') Object.keys(WI).forEach(function (k) { ui.wi[k] = d.ui.wi[k] === true; }); }
  if (d.raw && typeof d.raw === 'object') Object.keys(d.raw).forEach(function (id) { if (typeof d.raw[id] === 'string' && Number.isNaN(parse(d.raw[id]))) { var p = id.split('.'); if ((p[0] === 's' && id in {}) || false) return; if (p[0] === 'v' && !veh(p[1])) return; if (p[0] === 'p' || p[0] === 'sl') return; raw[id] = d.raw[id]; if (id.charAt(1) === '.') setPath(id, NaN); } });
  if (notes && notes.length) setTimeout(function () { toast(notes.join(' ')); }, 800);
}
function load() {
  try {
    var d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && d.cfg) { applyLoaded(d); return; }
    /* eski (v2) kayıt: güvenle yeni biçime taşınır; kullanıcının değiştirdiği değerler korunur */
    var o = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
    if (o && o.cfg) { var m = E.migrate(o.cfg); applyLoaded({ cfg: { scenario: m.cfg.scenario, fleet: m.cfg.fleet, route: m.cfg.route, compare: m.cfg.compare }, ui: o.ui }, m.notes); }
  } catch (e) {}
}

/* ---------- başlat ---------- */
buildStatic(); load(); buildFleet();
placeRoute(); renderWps(); renderTip(); onMapState('loading', ''); syncControls();
startMap(); routeChanged();
window.__app = { cfg: function () { return cfg; }, routeInfo: function () { return routeInfo; }, sim: function () { return { t: sim.t, playing: sim.playing, speed: sim.speed, end: simEnd() }; }, setSim: setSim, live: function () { return live; }, play: simPlay, pause: simPause, reset: simReset };
})();
