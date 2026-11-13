/* Harita ve servisler: MapLibre GL JS (dosyaya gömülü) + OpenFreeMap karoları (OpenStreetMap verisi).
   Anahtar gerekmez. Dış servisler: tiles.openfreemap.org (harita), router.project-osrm.org ve routing.openstreetmap.de (rota),
   photon.komoot.io (adres arama). İstekler sınırlıdır: tek istek hattı, ≥1,1 sn aralık, önceki istek iptal, önbellek.
   Servisler çalışmazsa uygulama (hesap, grafikler, elle mesafe) çalışmaya devam eder. */
(function (root) {
'use strict';
var STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';   /* yalnızca OpenFreeMap koyu stil */
var ROUTE_BASES = [['OSRM', 'https://router.project-osrm.org/route/v1/driving/'], ['FOSSGIS OSRM', 'https://routing.openstreetmap.de/routed-car/route/v1/driving/']];
var PHOTON = 'https://photon.komoot.io/api/';
var ATTR = 'Rota: OSRM · Adres: Photon';
var TEAL = '#1FC2AE';
var MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia && matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900);

var M = { map: null, ready: false, state: 'idle', cb: {}, markers: [], labels: {}, van: null, rdata: null, wps: [], addMode: false,
  follow: false, followB: 0, followZ: 15, tl: null, park: null, hdg: {}, vehicles: [], pos: {}, errCount: 0, styleCache: null };

/* ---------- yardımcılar ---------- */
function hav(a, b) { var R = 6371000, r = Math.PI / 180, dLa = (b[1] - a[1]) * r, dLo = (b[0] - a[0]) * r; var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2); return 2 * R * Math.asin(Math.min(1, Math.sqrt(x))); }
function bearing(a, b) { var r = Math.PI / 180, y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r), x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r); return (Math.atan2(y, x) / r + 360) % 360; }
function angDiff(a, b) { return ((b - a + 540) % 360) - 180; }
function setState(s, msg) { M.state = s; if (M.cb.onState) M.cb.onState(s, msg || ''); }

/* ---------- servis katmanı: tek hat, aralık, iptal, zaman aşımı, önbellek ---------- */
var lanes = { route: { last: 0, ctl: null }, geo: { last: 0, ctl: null } };
var MIN_GAP = 1100, TIMEOUT = 9000;
function lane(name, fn) {                       /* önceki isteği iptal et, aralığı koru */
  var L = lanes[name]; if (L.ctl) { try { L.ctl.abort(); } catch (e) {} }
  var ctl = new AbortController(); L.ctl = ctl;
  var wait = Math.max(0, L.last + MIN_GAP - Date.now());
  return new Promise(function (res) { setTimeout(res, wait); }).then(function () {
    if (ctl.signal.aborted) { var e = new Error('iptal'); e.name = 'AbortError'; throw e; }
    L.last = Date.now(); return fn(ctl);
  });
}
function fetchJson(url, ctl) {
  var timer = setTimeout(function () { try { ctl.abort(); ctl.timedOut = true; } catch (e) {} }, TIMEOUT);
  return fetch(url, { signal: ctl.signal }).then(function (r) { clearTimeout(timer); if (!r.ok) { var e = new Error('HTTP ' + r.status); e.status = r.status; throw e; } return r.json(); })
    .catch(function (e) { clearTimeout(timer); if (e.name === 'AbortError' && ctl.timedOut) { var t = new Error('zaman aşımı'); t.name = 'TimeoutError'; throw t; } throw e; });
}
var CKEY = 'robovan-sim-route-cache', routeMem = {};
function ckey(wps) { return wps.map(function (w) { return w.lon.toFixed(4) + ',' + w.lat.toFixed(4); }).join(';'); }
function cacheGet(k) {
  if (routeMem[k]) return routeMem[k];
  try { var o = JSON.parse(localStorage.getItem(CKEY) || '{}'), e = o[k]; if (e && Date.now() - e.t < 14 * 864e5) { routeMem[k] = e.v; return e.v; } } catch (er) {}
  return null;
}
function cachePut(k, v) {
  routeMem[k] = v;
  try { var o = JSON.parse(localStorage.getItem(CKEY) || '{}'); o[k] = { t: Date.now(), v: v };
    var keys = Object.keys(o).sort(function (a, b) { return o[b].t - o[a].t; }); keys.slice(12).forEach(function (x) { delete o[x]; });
    localStorage.setItem(CKEY, JSON.stringify(o)); } catch (er) { /* kota dolu: yalnız bellekte tut */ }
}
/* Karayolu rotası: OSRM → yedek FOSSGIS OSRM. Otomobil profili. Başarısızsa reject (çağıran "tahmin" gösterir). */
M.route = function (wps) {
  if (wps.length < 2) return Promise.reject(new Error('En az iki durak gerekli.'));
  if (wps.length > 25) return Promise.reject(new Error('En fazla 25 durak desteklenir.'));
  var k = ckey(wps), hit = cacheGet(k);
  if (hit) return Promise.resolve(Object.assign({}, hit, { cached: true }));
  var coords = wps.map(function (w) { return w.lon.toFixed(6) + ',' + w.lat.toFixed(6); }).join(';');
  return lane('route', function (ctl) {
    var errs = [];
    function attempt(i) {
      if (i >= ROUTE_BASES.length) { var e = new Error('Karayolu rotası servislerine ulaşılamadı (' + errs.join('; ') + ').'); e.name = 'ServiceError'; throw e; }
      return fetchJson(ROUTE_BASES[i][1] + coords + '?overview=full&geometries=geojson&steps=false', ctl).then(function (j) {
        if (j.code === 'NoRoute') { var ne = new Error('Bu duraklar arasında karayolu rotası bulunamadı.'); ne.name = 'NoRoute'; throw ne; }
        var r = j.routes && j.routes[0]; if (!r) throw new Error('boş yanıt');
        var v = { km: r.distance / 1000, minutes: r.duration / 60, coords: r.geometry.coordinates, legKm: (r.legs || []).map(function (l) { return l.distance / 1000; }), provider: ROUTE_BASES[i][0] };
        if (!(v.km >= 0) || v.coords.length < 2) throw new Error('geçersiz rota');
        cachePut(k, v); return v;
      }).catch(function (e) { if (e.name === 'AbortError' && !ctl.timedOut) throw e; if (e.name === 'NoRoute') throw e; errs.push(ROUTE_BASES[i][0] + ': ' + e.message); return attempt(i + 1); });
    }
    return attempt(0);
  });
};
/* Adres arama (Photon). Yalnızca Ara/Enter ile çağrılır. */
var geoMem = {};
M.geocode = function (q, near) {
  q = String(q || '').trim(); if (q.length < 3) return Promise.reject(new Error('En az 3 harf yazın.'));
  var key = q.toLowerCase(); if (geoMem[key]) return Promise.resolve(geoMem[key]);
  var url = PHOTON + '?q=' + encodeURIComponent(q) + '&limit=5' + (near ? '&lon=' + near[0].toFixed(3) + '&lat=' + near[1].toFixed(3) : '');
  return lane('geo', function (ctl) {
    return fetchJson(url, ctl).then(function (j) {
      var out = (j.features || []).map(function (f) { var p = f.properties || {}, parts = [p.name, p.street && (p.street + (p.housenumber ? ' ' + p.housenumber : '')), p.district || p.city || p.county, p.state, p.country];
        var seen = {}, n = parts.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }).join(', ');
        return { n: n || q, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }; });
      geoMem[key] = out; return out;
    }).catch(function (e) { if (e.name === 'AbortError' && !ctl.timedOut) throw e; var er = new Error('Adres arama servisine ulaşılamadı. Daha sonra tekrar deneyin.'); er.name = 'ServiceError'; throw er; });
  });
};

/* ---------- harita stili: OpenFreeMap + yol/bina ayarı ---------- */
function paint(style, id, prop, val) { var l = style.layers.filter(function (x) { return x.id === id; })[0]; if (l) { l.paint = l.paint || {}; l.paint[prop] = val; } }
function patchStyle(style) {
  {
    paint(style, 'background', 'background-color', '#0a0a0c'); paint(style, 'water', 'fill-color', '#0f1116'); paint(style, 'waterway', 'line-color', '#0f1116');
    paint(style, 'landuse_residential', 'fill-color', '#0f0f11'); paint(style, 'landuse_park', 'fill-color', '#0d120f'); paint(style, 'landcover_wood', 'fill-color', '#0c110e');
    paint(style, 'building', 'fill-color', '#1a1917');
    paint(style, 'highway_path', 'line-color', '#3b372f'); paint(style, 'highway_minor', 'line-color', '#5a5447');
    paint(style, 'highway_major_casing', 'line-color', '#14120f'); paint(style, 'highway_major_inner', 'line-color', '#8e8672'); paint(style, 'highway_major_subtle', 'line-color', '#5a5447');
    paint(style, 'highway_motorway_casing', 'line-color', '#14120f'); paint(style, 'highway_motorway_inner', 'line-color', ['interpolate', ['linear'], ['zoom'], 5.8, 'rgba(190,178,150,0.55)', 6, '#b9ad92']);
    paint(style, 'highway_motorway_subtle', 'line-color', '#5a5447');
    paint(style, 'railway', 'line-color', '#3b372f'); paint(style, 'railway_minor', 'line-color', '#3b372f'); paint(style, 'railway_transit', 'line-color', '#3b372f');
    paint(style, 'boundary_state', 'line-color', '#35322b'); paint(style, 'boundary_country_z0-4', 'line-color', '#3d3a31'); paint(style, 'boundary_country_z5-', 'line-color', '#3d3a31');
  }
  return style;
}
function loadStyle() {
  if (M.styleCache) return Promise.resolve(JSON.parse(JSON.stringify(M.styleCache)));
  return fetch(STYLE_URL).then(function (r) { if (!r.ok) throw new Error('Harita stili alınamadı (HTTP ' + r.status + ').'); return r.json(); })
    .then(function (s) { M.styleCache = s; return JSON.parse(JSON.stringify(s)); });
}
function webglOk() { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }

/* ---------- harita ---------- */
M.init = function (opts) {
  M.cb = opts.cb || M.cb; M.container = opts.container || M.container;
  if (!root.maplibregl) { setState('error', 'Harita kütüphanesi başlatılamadı.'); return Promise.resolve(false); }
  if (!webglOk()) { setState('error', 'Bu tarayıcıda WebGL desteklenmiyor; 3D harita çizilemez.'); return Promise.resolve(false); }
  setState('loading'); M.errCount = 0;
  return loadStyle().then(function (style) {
    patchStyle(style);
    if (M.map) { try { M.map.remove(); } catch (e) {} M.map = null; M.ready = false; }
    var el = document.getElementById(M.container); el.innerHTML = '';
    var map = new root.maplibregl.Map({ container: el, style: style, center: [29.7, 40.8], zoom: 8.6, pitch: 58, bearing: -18, maxPitch: 75, antialias: !MOBILE, attributionControl: false, hash: false, fadeDuration: MOBILE ? 0 : 200 });
    M.map = map;
    map.addControl(new root.maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new root.maplibregl.AttributionControl({ compact: MOBILE || window.innerWidth < 900, customAttribution: ATTR }), 'bottom-right');
    if (MOBILE || window.innerWidth < 900) setTimeout(function () { var e = document.querySelector('#' + M.container + ' .maplibregl-ctrl-attrib'); if (e) e.classList.remove('maplibregl-compact-show'); }, 6000);   /* telefonda atıf 6 sn açık kalır, sonra ⓘ simgesine küçülür */
    var first = true;
    map.on('style.load', function () {
      M.ready = true; addLayers(); drawAll();
      if (first) { first = false; setState('ready'); }
    });
    map.on('error', function (e) {
      var msg = (e && e.error && e.error.message) || '';
      if (/AbortError/.test(msg)) return;
      M.errCount++;
      if (!M.ready) { if (M.errCount >= 3) setState('error', 'Harita karoları alınamadı. İnternet bağlantısını kontrol edin.'); }
      else if (M.errCount === 3 && M.cb.onNotice) M.cb.onNotice('Bazı harita karoları yüklenemedi. Bağlantı yavaş veya servis meşgul olabilir.');
    });
    map.on('click', function (e) { if (M.addMode && M.cb.onMapClick) M.cb.onMapClick({ lon: e.lngLat.lng, lat: e.lngLat.lat }); });
    map.on('dragstart', function () { if (M.follow) { M.follow = false; if (M.cb.onFollow) M.cb.onFollow(false); } });
    return true;
  }).catch(function (err) { setState('error', err.message || 'Harita açılamadı.'); return false; });
};

function addLayers() {
  var map = M.map, ML = root.maplibregl;
  try {
    if (map.getSource('openmaptiles') && !map.getLayer('rv-3d-buildings')) {
      var before; (map.getStyle().layers || []).some(function (l) { if (l.type === 'symbol') { before = l.id; return true; } return false; });
      map.addLayer({ id: 'rv-3d-buildings', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14,
        paint: { 'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 6], 0, '#2b2a27', 40, '#403e38', 150, '#5a574d'],
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-opacity': 0.92 } }, before);
    }
  } catch (e) { /* bina verisi yoksa harita yine çalışır */ }
  var empty = { type: 'FeatureCollection', features: [] };
  if (!map.getSource('rv-route')) {
    map.addSource('rv-route', { type: 'geojson', data: empty });
    map.addLayer({ id: 'rv-route-glow', type: 'line', source: 'rv-route', filter: ['==', ['get', 'kind'], 'road'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': TEAL, 'line-width': 16, 'line-blur': 12, 'line-opacity': 0.5 } });
    map.addLayer({ id: 'rv-route-line', type: 'line', source: 'rv-route', filter: ['==', ['get', 'kind'], 'road'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': TEAL, 'line-width': 4 } });
    map.addLayer({ id: 'rv-route-air', type: 'line', source: 'rv-route', filter: ['==', ['get', 'kind'], 'air'], paint: { 'line-color': '#9AA0AC', 'line-width': 3, 'line-dasharray': [1.5, 2] } });
  }
  if (!map.getSource('rv-van-pt')) {
    map.addSource('rv-van-pt', { type: 'geojson', data: empty });
    map.addLayer({ id: 'rv-van-ring', type: 'circle', source: 'rv-van-pt', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 17, 38], 'circle-color': ['coalesce', ['get', 'color'], TEAL], 'circle-opacity': 0.22, 'circle-blur': 0.7, 'circle-pitch-alignment': 'map' } });
  }
  if (root.THREE && root.RobovanVan3D) {
    if (!M.van) M.van = root.RobovanVan3D.create({ simple: MOBILE });
    if (!map.getLayer('rv-van')) map.addLayer(M.van.layer);
  }
}
function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstChild; }
function drawAll() { drawStops(); drawRoute(); showVehicle(); }

function drawStops() {
  if (!M.map || !M.ready) return;
  M.markers.forEach(function (m) { m.remove(); }); M.markers = [];
  M.wps.forEach(function (w, i) {
    var n = el('<div class="mk-stop" title="' + String(w.n).replace(/"/g, '&quot;') + '">' + String.fromCharCode(65 + i % 26) + '</div>');
    var m = new root.maplibregl.Marker({ element: n, draggable: true }).setLngLat([w.lon, w.lat]).addTo(M.map);
    m.on('dragend', function () { var p = m.getLngLat(); if (M.cb.onStopDrag) M.cb.onStopDrag(i, { lon: p.lng, lat: p.lat }); });
    M.markers.push(m);
  });
}
function drawRoute() {
  if (!M.map || !M.ready) return; var src = M.map.getSource('rv-route'); if (!src) return;
  var f = [];
  if (M.rdata && M.rdata.kind === 'road') f.push({ type: 'Feature', properties: { kind: 'road' }, geometry: { type: 'LineString', coordinates: M.rdata.coords } });
  else if (M.wps.length > 1) f.push({ type: 'Feature', properties: { kind: 'air' }, geometry: { type: 'LineString', coordinates: M.wps.map(function (w) { return [w.lon, w.lat]; }) } });
  src.setData({ type: 'FeatureCollection', features: f });
}
/* araçlar yalnızca gerçek karayolu rotası varsa gösterilir */
function showVehicle() { if (!M.map || !M.ready) return; placeVehicles(); }
M.setWaypoints = function (wps) { M.wps = wps; M.park = wps.length ? { at: [wps[0].lon, wps[0].lat], brg: wps.length > 1 ? bearing([wps[0].lon, wps[0].lat], [wps[1].lon, wps[1].lat]) : 0 } : null; drawStops(); if (!M.tl) placeVehicles(); if (!M.rdata || M.rdata.kind !== 'road') drawRoute(); };
M.setRoute = function (r) { M.rdata = r; M.tl = r && r.kind === 'road' && r.coords && r.coords.length > 1 ? buildGeom(r.coords) : null; drawRoute(); placeVehicles(); };
M.resize = function () { if (M.map) M.map.resize(); };
M.setAddMode = function (on) { M.addMode = on; if (M.map) M.map.getCanvas().style.cursor = on ? 'crosshair' : ''; };
M.setFollow = function (on) { M.follow = on; if (on && M.tl && M.map) { M.followB = M.map.getBearing(); var c = followCenter(); M.map.easeTo({ center: c.center, zoom: c.zoom, pitch: 62, duration: 900 }); M.followZ = c.zoom; } };
M.center = function () { if (!M.map) return null; var c = M.map.getCenter(); return [c.lng, c.lat]; };
M.fit = function () {
  if (!M.map || !M.ready) return; var pts = (M.rdata && M.rdata.kind === 'road') ? M.rdata.coords : M.wps.map(function (w) { return [w.lon, w.lat]; });
  if (!pts.length) return; var b = new root.maplibregl.LngLatBounds(pts[0], pts[0]); pts.forEach(function (p) { b.extend(p); });
  var mobile = window.innerWidth < 900;
  M.map.fitBounds(b, { padding: mobile ? { top: 110, bottom: 90, left: 70, right: 70 } : { top: 90, bottom: 150, left: 380, right: 70 }, pitch: M.map.getPitch(), bearing: M.map.getBearing(), maxZoom: 15, duration: 1200 });
};
M.view = function (mode) {
  if (!M.map || !M.ready) return;
  if (mode === '3d') M.map.easeTo({ pitch: 62, bearing: -22, duration: 1100 });
  else if (mode === 'top') M.map.easeTo({ pitch: 0, bearing: 0, duration: 900 });
  else if (mode === 'fit') M.fit();
};

/* ---------- araçlar: konum, yön, yanal ayrım, etiket (zamanı uygulama yönetir; harita yalnızca çizer) ---------- */
function buildGeom(c) { var cum = [0], i; for (i = 1; i < c.length; i++) cum.push(cum[i - 1] + hav(c[i - 1], c[i])); return { coords: c, cum: cum, total: cum[cum.length - 1] }; }
function lerpPos(tl, d) {
  var cum = tl.cum, coords = tl.coords, lo = 0, hi = cum.length - 1; d = Math.max(0, Math.min(tl.total, d));
  while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
  var a = coords[lo], b = coords[Math.min(lo + 1, coords.length - 1)], span = cum[Math.min(lo + 1, cum.length - 1)] - cum[lo], f = span > 0 ? (d - cum[lo]) / span : 0;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
function headingAt(tl, d, dir) {   /* 25 m ileriye bak: pürüzsüz yön */
  var a = lerpPos(tl, d), b = lerpPos(tl, d + dir * 25);
  if (a[0] === b[0] && a[1] === b[1]) { b = lerpPos(tl, d - dir * 25); dir = -dir; }
  return bearing(a, b);
}
function clearVehicles() {
  if (M.van) M.van.hide(); M.hdg = {};
  Object.keys(M.labels).forEach(function (k) { M.labels[k].remove(); }); M.labels = {}; M.pos = {};
  if (M.map && M.ready) { var s = M.map.getSource('rv-van-pt'); if (s) s.setData({ type: 'FeatureCollection', features: [] }); }
}
/* vehicles: [{id,type,color,label,frac(0..1 sefer mesafe oranı),roundTrip}] — frac: sefer boyunca kat edilen yol oranı */
M.setVehicles = function (vs) { M.vehicles = vs || []; placeVehicles(); };
function placeVehicles() {
  if (!M.map || !M.ready) return;
  if (!M.vehicles.length || (!M.tl && !M.park)) { clearVehicles(); return; }
  var tl = M.tl, n = M.vehicles.length, feats = [], list = [], keep = {};
  M.vehicles.forEach(function (v, i) {
    var p, b, d, dir, off = (i - (n - 1) / 2) * 4.4;   /* yalnız görsel yanal ayrım (m, model ölçeğinde); gerçek mesafe değişmez */
    if (tl) {
      var f = Math.max(0, Math.min(1, v.frac));
      if (v.roundTrip) { if (f < 0.5) { d = 2 * f * tl.total; dir = 1; } else { d = (2 - 2 * f) * tl.total; dir = -1; } } else { d = f * tl.total; dir = 1; }
      p = lerpPos(tl, d); b = headingAt(tl, d, dir);
    } else { p = M.park.at; b = M.park.brg; }              /* rota yok: araçlar başlangıç noktasında park halinde (hareket yok) */
    var prev = M.hdg[v.id]; if (prev === undefined) prev = b; var dd = angDiff(prev, b); prev = Math.abs(dd) > 100 ? b : prev + dd * 0.35; M.hdg[v.id] = prev; b = (prev + 360) % 360;   /* dönüşlerde yumuşak yön geçişi */
    M.pos[v.id] = { lng: p[0], lat: p[1], brg: b };
    list.push({ id: v.id, type: v.type, color: v.color, lng: p[0], lat: p[1], brg: b, off: off, spin: v.spin || 0 });
    feats.push({ type: 'Feature', properties: { color: v.color }, geometry: { type: 'Point', coordinates: p } });
    keep[v.id] = 1;
    var lb = M.labels[v.id];
    if (!lb) { var e = el('<div class="mk-label"><i></i><span></span></div>'); lb = M.labels[v.id] = new root.maplibregl.Marker({ element: e, anchor: 'bottom', offset: [0, -34 - i * 24] }).setLngLat(p).addTo(M.map); }
    lb.setLngLat(p); var e2 = lb.getElement(); e2.firstChild.style.background = v.color; e2.lastChild.textContent = v.label;
  });
  Object.keys(M.labels).forEach(function (k) { if (!keep[k]) { M.labels[k].remove(); delete M.labels[k]; delete M.pos[k]; delete M.hdg[k]; } });
  if (M.van) M.van.setAll(list);
  var src = M.map.getSource('rv-van-pt'); if (src) src.setData({ type: 'FeatureCollection', features: feats });
  if (M.follow && tl) followStep();
}
function followCenter() {
  var ps = M.vehicles.map(function (v) { return M.pos[v.id]; }).filter(Boolean);
  if (!ps.length) { var c = M.tl.coords[0]; return { center: c, zoom: 15 }; }
  var lo = ps[0].lng, hi = ps[0].lng, la = ps[0].lat, lb = ps[0].lat; ps.forEach(function (p) { lo = Math.min(lo, p.lng); hi = Math.max(hi, p.lng); la = Math.min(la, p.lat); lb = Math.max(lb, p.lat); });
  var sep = hav([lo, la], [hi, lb]);
  return { center: [(lo + hi) / 2, (la + lb) / 2], zoom: Math.max(11.5, Math.min(16.6, 16.8 - Math.log2(Math.max(sep, 120) / 120))) };
}
function followStep() {
  var c = followCenter(), lead = M.pos[M.vehicles[0].id], b = lead ? lead.brg : M.followB;
  M.followB += angDiff(M.followB, b) * 0.08; M.followZ += (c.zoom - M.followZ) * 0.08;
  M.map.jumpTo({ center: c.center, bearing: M.followB, zoom: M.followZ });
}
M.setSimpleVan = function (v) { if (M.van) M.van.setSimple(v); };
M.isSimpleVan = function () { return M.van ? M.van.isSimple() : false; };
M.hasRoute = function () { return !!M.tl; };
M.hasVehicles = function () { return !!(M.van && M.van.state().vehicles.length); };
M.debug = function () { var m = M.map; return { state: M.state, ready: M.ready, mobile: MOBILE, zoom: m ? m.getZoom() : null, pitch: m ? m.getPitch() : null, bearing: m ? m.getBearing() : null,
  hasBuildings: !!(m && m.getLayer('rv-3d-buildings')), hasVan: !!(m && m.getLayer('rv-van')), routeFeatures: (function () { try { var s = m.getSource('rv-route'); var d = s && s.serialize().data; return d && d.features ? d.features.map(function (f) { return f.properties.kind; }) : []; } catch (e) { return []; } })(), van: M.van ? M.van.state() : null, pos: M.pos || null, planned: !!M.tl, errCount: M.errCount }; };

root.RobovanMap = M;
})(window);
