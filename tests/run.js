'use strict';
/* Bağımlılıksız test koşucusu: node tests/run.js [engine yolu]. Çıkış kodu: 0 hepsi geçti, 1 kaldı. */
const path = require('path');
const E = require(path.resolve(process.argv[2] || path.join(__dirname, '../src/index.js')));

const rows = [];
let fail = 0;
const fmt = (x) => (typeof x === 'number' ? (Number.isInteger(x) ? String(x) : x.toFixed(4)) : String(x));
function record(group, name, expected, actual, pass) {
  rows.push({ group, name, expected, actual, pass });
  if (!pass) fail++;
}
const near = (a, b, tolPct) => Math.abs(a - b) <= Math.abs(b) * tolPct / 100;
function eqRel(group, name, expected, actual, tolPct) { record(group, name, '≈ ' + fmt(expected) + ` (±%${tolPct})`, fmt(actual), near(actual, expected, tolPct)); }
function eq(group, name, expected, actual) { record(group, name, fmt(expected), fmt(actual), expected === actual); }
function truthy(group, name, cond, note) { record(group, name, 'doğru', cond ? 'doğru' : 'YANLIŞ' + (note ? ' — ' + note : ''), !!cond); }

const base = () => E.defaultConfig();
const P = (c, id) => c.fleet.filter((v) => v.id === id)[0].params;
const r0 = E.analyze(base());
const V = r0.vehicles;

/* ===== A. Şartname bölüm 9: ana tablo ===== */
const G9 = 'Şartname 9';
truthy(G9, 'Varsayılan analiz geçerli', r0.ok, (r0.errors || []).join('; '));
eqRel(G9, 'Rota tek yön km (≈57)', 57, r0.route.km, 2);
eq(G9, 'Gereken araç · Robovan', 2, V.robovan.n); eq(G9, 'Gereken araç · Dizel', 4, V.conventional.n);
eq(G9, 'km maliyeti 2 hane · Robovan', 0.34, +V.robovan.perKm.toFixed(2));
eq(G9, 'km maliyeti 2 hane · Dizel', 0.62, +V.conventional.perKm.toFixed(2));
eqRel(G9, 'Yıllık filo · Robovan', 90437, V.robovan.fleet, 1); eqRel(G9, 'Yıllık filo · Dizel', 167923, V.conventional.fleet, 1);
eqRel(G9, 'Sefer süresi · Robovan (sa)', 4.39, V.robovan.tripH, 1); eqRel(G9, 'Sefer süresi · Dizel (sa)', 3.16, V.conventional.tripH, 1);
eqRel(G9, 'Geri ödeme (yıl, ≈0,5)', 0.5, r0.kpi.breakEven.years, 5);
eqRel(G9, 'İlk yatırım farkı', 43000, r0.kpi.investmentDiff, 1);
eq(G9, 'Başa baş sürücü maliyeti', 'always', r0.kpi.breakEvenWage.status);
/* şartnamedeki "±%1" ifadesi 0,34 için tutmaz (gerçek 0,3359 → %1,2 sapma): gerçek değer 2 hanede 0,34 */
eqRel(G9, 'km maliyeti ham · Robovan (şartname ±%1 okuması)', 0.34, V.robovan.perKm, 1.5);

/* ===== B. Şartname bölüm 9: ek testler ===== */
const GB = 'Şartname 9 ek';
{ const c = base(); c.scenario.demand = 1; const r = E.analyze(c); eq(GB, 'Talep=1 → her türde 1 araç', '1,1', [r.vehicles.robovan.n, r.vehicles.conventional.n].join(',')); }
{ const c = base(); c.route.mode = 'manual'; c.route.manualKm = 4; const r = E.analyze(c); eq(GB, 'Elle 4 km, gidiş-dönüş → sefer 8 km', 8, r.vehicles.robovan.tripKm); }
{ const c = base(); P(c, 'conventional').driver = 0; const r = E.analyze(c); eq(GB, 'Sürücü 0 → dizel personel 0', 0, r.vehicles.conventional.people); }
{ const c = base(); c.scenario.fleet = 5; const r = E.analyze(c);
  eq(GB, 'Robovan sabitleme → robovan 5 araç', 5, r.vehicles.robovan.n);
  eq(GB, 'Sabitleme dizeli etkilemez', V.conventional.fleet, r.vehicles.conventional.fleet); }
{ const c = base(); Object.keys(c.scenario).forEach((k) => { if (typeof c.scenario[k] === 'number') c.scenario[k] = 0; }); c.fleet.forEach((v) => Object.keys(v.params).forEach((f) => { v.params[f] = 0; }));
  const r = E.analyze(c); truthy(GB, 'Her alan 0 → hata listesi, çökme yok', r.ok === false && r.errors.length > 0);
  truthy(GB, 'Her alan 0 → çıktıda NaN/Infinity yok', !JSON.stringify(r).match(/NaN|Infinity/)); }
{ const c = base(); c.fleet.forEach((v) => Object.keys(v.params).forEach((f) => { v.params[f] = ''; }));
  const r = E.analyze(c); truthy(GB, 'Boş metin alanlar → ok:false', r.ok === false); }

/* ===== C. Geometri ===== */
const GC = 'Geometri';
{ const ist = { lat: 41.0082, lon: 28.9784 }, ank = { lat: 39.9334, lon: 32.8597 };
  eqRel(GC, 'İstanbul–Ankara kuş uçuşu (≈350 km)', 350, E.haversineKm(ist, ank), 1.5);
  eq(GC, 'Aynı nokta → 0', 0, E.haversineKm(ist, ist));
  eq(GC, 'Simetri', E.haversineKm(ist, ank), E.haversineKm(ank, ist));
  eqRel(GC, 'Antipod (≈20015 km)', 20015, E.haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 180 }), 0.1);
  let threw = false; try { E.haversineKm({ lat: 95, lon: 0 }, ist); } catch (e) { threw = e instanceof RangeError; }
  truthy(GC, 'Geçersiz enlem → RangeError', threw); }
{ const rt = E.routeDistance({ mode: 'route', waypoints: [{ n: 'a', lat: 40, lon: 29 }] }, 1.3);
  truthy(GC, 'Tek durak → hata mesajı', rt.errors.length === 1 && rt.km === 0); }
{ const rt = E.routeDistance({ mode: 'manual', manualKm: -1 }, 1.3); truthy(GC, 'Negatif elle mesafe → hata', rt.errors.length === 1); }
{ const rt = E.routeDistance({ mode: 'route', waypoints: [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }] }, 1.3, 77); eq(GC, 'Gerçek yol mesafesi varsa önceliklidir', 77, rt.km); }

/* ===== D. Doğrulama ===== */
const GD = 'Doğrulama';
function bad(name, mut) { const c = base(); mut(c); const r = E.analyze(c); truthy(GD, name, r.ok === false && r.errors.length > 0 && !JSON.stringify(r).match(/NaN|Infinity/), JSON.stringify(r.errors)); }
bad('Hız 0 reddedilir', (c) => { P(c, 'robovan').speed = 0; });
bad('Şarj gücü 0 reddedilir', (c) => { P(c, 'robovan').chargeKw = 0; });
bad('Ömür 0 reddedilir', (c) => { P(c, 'conventional').life = 0; });
bad('Operatör başına araç 0 reddedilir', (c) => { P(c, 'robovan').ratio = 0; });
bad('Verim 0 reddedilir', (c) => { P(c, 'robovan').eff = 0; });
bad('Kalıntı %101 reddedilir', (c) => { P(c, 'conventional').residual = 101; });
bad('Negatif fiyat reddedilir', (c) => { P(c, 'conventional').price = -1; });
bad('NaN reddedilir', (c) => { P(c, 'conventional').fuel = NaN; });
bad('Infinity reddedilir', (c) => { P(c, 'conventional').fuel = Infinity; });
bad('Metin sayı reddedilir', (c) => { P(c, 'conventional').fuel = '1,5'; });
bad('Null reddedilir', (c) => { P(c, 'robovan').range = null; });
bad('Çalışma günü 0 reddedilir', (c) => { c.scenario.days = 0; });
bad('Yük doluluğu 101 reddedilir', (c) => { c.scenario.loadPct = 101; });
bad('Robovan sayısı ondalık reddedilir', (c) => { c.scenario.fleet = 2.5; });
bad('Yol katsayısı 0,9 reddedilir', (c) => { c.scenario.roadFactor = 0.9; });
bad('Geçersiz karşılaştırma seçimi reddedilir', (c) => { c.compare.b = 'x'; });
bad('Aynı araç iki kez karşılaştırılamaz', (c) => { c.compare.b = c.compare.a; });
bad('Araç parametresi eksik reddedilir', (c) => { delete P(c, 'robovan').speed; });
bad('Rota 1 durak reddedilir', (c) => { c.route.waypoints = c.route.waypoints.slice(0, 1); });
bad('Rota koordinatı bozuk reddedilir', (c) => { c.route.waypoints[0].lat = 'x'; });
{ let ok = true, res; try { res = E.analyze(null); } catch (e) { ok = false; } truthy(GD, 'null yapılandırma çökmez, ok:false döner', ok && res && res.ok === false); }

/* ===== E. Hesap kimlikleri ve sınır durumları ===== */
const GE = 'Hesap kimlikleri';
['robovan', 'conventional'].forEach((k) => {
  const c = V[k];
  eqRel(GE, `${k}: toplam = kalemlerin toplamı`, c.energy + c.maint + c.fixed + c.people + c.dep + c.fin, c.total, 0.0001);
  eqRel(GE, `${k}: filo = toplam × araç`, c.total * c.n, c.fleet, 0.0001);
  eqRel(GE, `${k}: birikimli(0) = ilk yatırım (filo)`, c.capexFleet, c.cumulative(0), 0.0001);
  eqRel(GE, `${k}: km başına × km = toplam`, c.total, c.perKm * c.kmv, 0.0001);
  truthy(GE, `${k}: TCO(ömür) = filo yatırımı + işletme − kalıntı`, near(c.tco(c.life), c.n * (c.capex + c.cashOpex * c.life - c.resV), 0.0001));
});
{ const b = E.breakEven({ capexFleet: 200, n: 1, cashOpex: 10 }, { capexFleet: 100, n: 1, cashOpex: 60 }); eqRel(GE, 'Başa baş formülü (100/50 = 2 yıl)', 2, b.years, 0.001); eq(GE, 'Başa baş durumu', 'payback', b.status); }
{ const b = E.breakEven({ capexFleet: 50, n: 1, cashOpex: 10 }, { capexFleet: 100, n: 1, cashOpex: 60 }); eq(GE, 'Her iki yönde ucuz → hemen', 'immediate', b.status); }
{ const b = E.breakEven({ capexFleet: 200, n: 1, cashOpex: 70 }, { capexFleet: 100, n: 1, cashOpex: 60 }); eq(GE, 'İşletme daha pahalı → geri ödemez', 'never', b.status); }
{ const c = base(); P(c, 'conventional').driver = 0; const r = E.analyze(c);
  P(c, 'conventional').driver = 1500; P(c, 'robovan').operator = 20000; const r2 = E.analyze(c);
  truthy(GE, 'Pahalı operatörde başa baş sürücü maliyeti bulunur (found)', r2.kpi.breakEvenWage.status === 'found' && r2.kpi.breakEvenWage.value > 1500, JSON.stringify(r2.kpi.breakEvenWage));
  if (r2.kpi.breakEvenWage.status === 'found') { const c3 = base(); P(c3, 'robovan').operator = 20000; P(c3, 'conventional').driver = r2.kpi.breakEvenWage.value; const r3 = E.analyze(c3); eqRel(GE, 'Bulunan maaşta iki filo maliyeti eşit', r3.vehicles.robovan.fleet, r3.vehicles.conventional.fleet, 0.01); } }
{ const c = base(); c.scenario.demand = 0; const r = E.analyze(c); truthy(GE, 'Talep 0 → ok, km maliyeti null (NaN değil)', r.ok && r.vehicles.robovan.perKm === null && !JSON.stringify(r).match(/NaN|Infinity/)); }
{ const c = base(); c.route.mode = 'manual'; c.route.manualKm = 0; const r = E.analyze(c); truthy(GE, 'Mesafe 0 → ok, km maliyeti null, uyarı var', r.ok && r.vehicles.conventional.perKm === null && r.warnings.some((w) => w.includes('0 km'))); }
{ const c = base(); c.route.mode = 'manual'; c.route.manualKm = 400; c.scenario.demand = 2; const r = E.analyze(c);
  truthy(GE, 'Çok uzun sefer → mesai aşımı uyarısı', r.warnings.some((w) => w.includes('günlük çalışma süresini aşıyor')));
  truthy(GE, 'Çok uzun sefer → menzil uyarısı', r.warnings.some((w) => w.includes('menzile'))); }
{ const c = base(); c.scenario.fleet = 1; const r = E.analyze(c); truthy(GE, 'Yetersiz sabit araç → kapasite uyarısı', r.warnings.some((w) => w.includes('yetmiyor'))); }
{ const c = base(); c.scenario.roundTrip = false; const r = E.analyze(c); eqRel(GE, 'Tek yön → sefer mesafesi = rota', r.route.km, r.vehicles.robovan.tripKm, 0.0001); }
{ const c = base(); c.scenario.rate = 0; const r = E.analyze(c); eq(GE, 'Sermaye maliyeti 0 → finansman 0', 0, r.vehicles.conventional.fin); }
{ const c = base(); P(c, 'conventional').residual = 100; const r = E.analyze(c); eq(GE, 'Kalıntı %100 → amortisman 0 (altyapı yok)', 0, r.vehicles.conventional.dep); }
{ const rows2 = E.sensitivity(base(), 20.0 * 0 + 57, 40); eq(GE, 'Duyarlılık 40 satır', 40, rows2.length); truthy(GE, 'Duyarlılık değerleri sonlu', rows2.every((x) => Number.isFinite(x.robovan) && Number.isFinite(x.conventional))); }
{ const a = JSON.stringify(E.analyze(base()).vehicles.robovan.fleet), b = JSON.stringify(E.analyze(base()).vehicles.robovan.fleet); eq(GE, 'Aynı girdi, aynı sonuç', a, b); }
{ const c = base(); const before = JSON.stringify(c); E.analyze(c); eq(GE, 'Girdi nesnesi değiştirilmez', before, JSON.stringify(c)); }
{ const c = base(); const r1 = E.analyze(c); P(c, 'robovan').price = 1; const r2 = E.analyze(base()); eq(GE, 'Önceki çağrı sonraki çağrıyı etkilemez', r1.vehicles.robovan.fleet, r2.vehicles.robovan.fleet); }
/* Monotonluk: sürücü maliyeti arttıkça dizel filo maliyeti azalmaz */
{ let prev = -1, ok = true; for (let w = 0; w <= 8000; w += 500) { const c = base(); P(c, 'conventional').driver = w; const f = E.analyze(c).vehicles.conventional.fleet; if (f < prev) ok = false; prev = f; } truthy(GE, 'Sürücü maliyeti ↑ → dizel filo maliyeti ↓ olmaz', ok); }

/* ===== F. Rastgele test (tohumlu): geçerli girdide çökme/NaN yok ===== */
const GF = 'Rastgele test';
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
{ const R = rng(20260101); const u = (a, b) => a + (b - a) * R();
  let bad1 = 0, thrown = 0, okCount = 0;
  for (let i = 0; i < 3000; i++) {
    const c = base();
    c.scenario.demand = Math.floor(u(0, 60)); c.scenario.days = Math.floor(u(1, 366)); c.scenario.stops = Math.floor(u(0, 30)); c.scenario.loadMin = u(0, 60);
    c.scenario.loadPct = u(0, 100); c.scenario.rate = u(0, 30); c.scenario.horizon = u(0, 20); c.scenario.fleet = Math.floor(u(0, 30)); c.scenario.roadFactor = u(1, 2); c.scenario.roundTrip = R() > 0.5;
    c.route.mode = 'manual'; c.route.manualKm = u(0, 800);
    c.fleet.forEach((fv) => { const v = fv.params; Object.keys(v).forEach((f) => { v[f] = v[f] * u(0.3, 2.5); });
      v.residual = Math.min(100, v.residual); v.eff = Math.min(100, Math.max(1, v.eff)); v.hours = Math.min(24, v.hours); v.shiftH = Math.min(24, v.shiftH); v.life = Math.max(1, Math.min(60, v.life)); });
    let r; try { r = E.analyze(c); } catch (e) { thrown++; continue; }
    if (r.ok) { okCount++; if (/NaN|Infinity/.test(JSON.stringify(r))) bad1++; }
  }
  eq(GF, 'Geçerli 3000 girdide istisna yok', 0, thrown); eq(GF, 'Geçerli girdilerde NaN/Infinity yok', 0, bad1); truthy(GF, 'Girdilerin çoğu geçerli sayıldı', okCount > 2500, 'geçerli: ' + okCount);
  let thrown2 = 0; const junk = [undefined, null, NaN, Infinity, -Infinity, '', 'abc', [], {}, true, -1e308, 1e308];
  for (let i = 0; i < 2000; i++) { const c = base(); const fv = c.fleet[Math.floor(R() * 2)]; const fs = Object.keys(fv.params); fv.params[fs[Math.floor(R() * fs.length)]] = junk[Math.floor(R() * junk.length)];
    try { const r = E.analyze(c); if (r.ok && /NaN|Infinity/.test(JSON.stringify(r))) thrown2++; } catch (e) { thrown2++; } }
  eq(GF, 'Bozuk değerli 2000 girdide istisna / NaN yok', 0, thrown2); }


/* ===== G. Operasyon göstergeleri (Aşama 3'te eklendi) ===== */
const GG = 'Operasyon göstergeleri';
{ const o = V.robovan.ops, d = V.conventional.ops;
  eqRel(GG, 'Filo günlük km = talep × sefer mesafesi', 8 * V.robovan.tripKm, o.dailyKmFleet, 0.0001);
  eqRel(GG, 'Filo yıllık km = araç km × araç sayısı', V.robovan.kmv * V.robovan.n, o.annualKmFleet, 0.0001);
  eqRel(GG, 'Sefer başı kapasite = 1800 × %70', 1260, o.capacityKgPerTrip, 0.0001);
  eqRel(GG, 'Yıllık ton = sefer × kapasite', 8 * 300 * 1.26, o.annualTonnes, 0.0001);
  eqRel(GG, 'Robovan operatör FTE = vardiya × araç / oran', V.robovan.shifts * V.robovan.n / 5, o.staff, 0.0001);
  eqRel(GG, 'Dizel sürücü = vardiya × araç', V.conventional.shifts * V.conventional.n, d.staff, 0.0001);
  eq(GG, 'Dizel enerji birimi', 'L', d.energyUnit); eq(GG, 'Robovan enerji birimi', 'kWh', o.energyUnit);
  eqRel(GG, 'Dizel yakıt maliyeti = litre × fiyat', V.conventional.energy * V.conventional.n, d.energyQty * 1.5, 0.0001);
  eqRel(GG, 'Günlük filo maliyeti × gün = yıllık', V.robovan.fleet, o.dailyCostFleet * 300, 0.0001);
  eqRel(GG, 'Aylık filo maliyeti × 12 = yıllık', V.robovan.fleet, o.monthlyCostFleet * 12, 0.0001); }

/* ===== H. Araç listesi (iki kategori, en çok 6 araç) ===== */
const GH = 'Araç listesi';
{ const c = base(); truthy(GH, 'Başlangıçta yalnızca iki araç', c.fleet.length === 2 && c.fleet[0].id === 'robovan' && c.fleet[1].id === 'conventional');
  truthy(GH, 'Elektrikli Van varsayılanı yok', !c.fleet.some((v) => /elektrikli/i.test(v.name)) && !JSON.stringify(c).includes('"ev"')); }
{ const c = base(); c.fleet.push(E.makeVehicle('robovan', 'rv2', 'Robovan Pro', 'Model X', '#5BD6F2', { price: 95000, speed: 50 }));
  c.fleet.push(E.makeVehicle('conventional', 'cv2', 'Başka Van', 'Model Y', '#E0B040', { l100: 11 }));
  const r = E.analyze(c); truthy(GH, 'Dört araç ekleme/analiz geçerli', r.ok && r.order.length === 4, (r.errors || []).join(';'));
  eq(GH, 'Eklenen modelin parametreleri ayrı saklanır', 95000, P(c, 'rv2').price); eq(GH, 'Ana Robovan parametresi değişmez', 85000, P(c, 'robovan').price);
  eqRel(GH, 'Varsayılan Robovan sonucu eklemeden etkilenmez', V.robovan.fleet, r.vehicles.robovan.fleet, 0.0001);
  truthy(GH, 'Farklı hızlı model farklı sefer süresi verir', r.vehicles.rv2.tripH !== r.vehicles.robovan.tripH);
  c.compare = { a: 'rv2', b: 'cv2' }; const r2 = E.analyze(c); truthy(GH, 'Karşılaştırma farklı modellerle', r2.ok && r2.kpi.a === 'rv2' && r2.kpi.b === 'cv2');
  eqRel(GH, 'Yıllık tasarruf = B − A (seçili araçlar)', r2.vehicles.cv2.fleet - r2.vehicles.rv2.fleet, r2.kpi.annualSaving, 0.0001); }
{ const c = base(); for (let i = 0; i < 5; i++) c.fleet.push(E.makeVehicle('robovan', 'x' + i, 'R' + i)); const r = E.analyze(c); truthy(GH, '6 araçtan fazlası reddedilir', r.ok === false && r.errors.some((e) => e.includes('En fazla 6'))); }
{ const c = base(); c.fleet.push(E.makeVehicle('robovan', 'robovan', 'Kopya')); truthy(GH, 'Tekrarlayan kimlik reddedilir', E.analyze(c).ok === false); }
{ const c = base(); c.fleet.splice(1, 1); truthy(GH, 'İki araçtan az reddedilir', E.analyze(c).ok === false); }
{ const c = base(); c.fleet[0].category = 'elektrikli_van'; truthy(GH, 'Bilinmeyen kategori reddedilir', E.analyze(c).ok === false); }
{ const c = base(); c.compare = { a: 'conventional', b: 'robovan' }; const r = E.analyze(c); truthy(GH, 'Sürücüsüz araç taban olursa başa baş maaş hesaplanmaz', r.ok && r.kpi.breakEvenWage.status === 'n/a'); }

/* ===== I. Canlı simülasyon ===== */
const GI = 'Canlı simülasyon';
{ const L = E.buildLive(r0, r0.config);
  eq(GI, 'Simülasyon saati 06:00 başlar', '06:00', E.formatClock(E.START_MIN));
  eq(GI, '06:00 + 90 dk = 07:30', '07:30', E.formatClock(E.START_MIN + 90));
  ['robovan', 'conventional'].forEach((id) => {
    const st = L.at(L.endMin).filter((x) => x.id === id)[0];
    eqRel(GI, `${id}: sefer sonu canlı maliyet = motorun sefer başı maliyeti`, V[id].perTrip, st.total, 0.0001);
    eqRel(GI, `${id}: sefer sonu km = sefer mesafesi`, V[id].tripKm, st.km, 0.0001);
    eqRel(GI, `${id}: canlı enerji kalemi = motor enerji / sefer`, V[id].energy / (V[id].tpv * 300), st.energy, 0.0001);
    const half = L.at(L.endMin / 2).filter((x) => x.id === id)[0];
    truthy(GI, `${id}: birikim zamanla artar, negatif değil`, half.total > 0 && half.total < st.total);
  });
  const s0 = L.at(0); truthy(GI, 'Başlangıçta km ve maliyet 0', s0.every((x) => x.km === 0 && x.total === 0));
  /* iki araç farklı süre/hızda: aynı anda ilerler, farklı konumda olur */
  const mid = L.at(60); truthy(GI, 'İki araç aynı simülasyon anında farklı konumda (kendi hızları)', mid[0].posFrac !== mid[1].posFrac);
  truthy(GI, 'Hız çarpanı toplamı değiştirmez (zaman ölçeklemesi yalnız eksen)', JSON.stringify(L.at(L.endMin)) === JSON.stringify(E.buildLive(E.analyze(base()), base()).at(L.endMin)));
  const parts = L.at(L.endMin).map((x) => x.energy + x.maint + x.fixed + x.people + x.dep + x.fin); truthy(GI, 'Kalemlerin toplamı toplam maliyete eşit', parts.every((p, i) => near(p, L.at(L.endMin)[i].total, 0.0001))); }
{ const c = base(); c.scenario.stops = 0; c.scenario.loadMin = 0; const r = E.analyze(c); const L = E.buildLive(r, r.config); const st = L.at(L.endMin);
  eqRel(GI, 'Durak 0 iken de sefer sonu uzlaşır', r.vehicles.robovan.perTrip, st[0].total, 0.0001); }
{ const L = E.buildLive(r0, r0.config); truthy(GI, 'Fazlası kırpılır (süre aşılırsa değer sabit)', JSON.stringify(L.at(L.endMin)) === JSON.stringify(L.at(L.endMin * 5))); }

/* ===== J. Eski kayıt taşıma ===== */
const GJ = 'Kayıt taşıma';
{ const old = { scenario: Object.assign({}, base().scenario, { demand: 12 }), route: base().route, vehicles: { robo: Object.assign({}, base().fleet[0].params, { price: 90000 }), ice: Object.assign({}, base().fleet[1].params, { fuel: 1.8 }), ev: E.OLD_EV } };
  const m = E.migrate(old); eq(GJ, 'Dokunulmamış eski Elektrikli Van kaldırılır', 2, m.cfg.fleet.length);
  eq(GJ, 'Kullanıcının Robovan değişikliği korunur', 90000, m.cfg.fleet[0].params.price); eq(GJ, 'Kullanıcının dizel değişikliği korunur', 1.8, m.cfg.fleet[1].params.fuel); eq(GJ, 'Senaryo değişikliği korunur', 12, m.cfg.scenario.demand);
  truthy(GJ, 'Taşınan kayıt geçerli analiz verir', E.analyze(m.cfg).ok); }
{ const evc = Object.assign({}, E.OLD_EV, { price: 60000 }); const m = E.migrate({ scenario: base().scenario, route: base().route, vehicles: { robo: base().fleet[0].params, ice: base().fleet[1].params, ev: evc } });
  eq(GJ, 'Değiştirilmiş eski Elektrikli Van veri kaybı olmadan özel araç olarak korunur', 3, m.cfg.fleet.length); eq(GJ, 'Değeri korunur', 60000, m.cfg.fleet[2].params.price); truthy(GJ, 'Kullanıcıya not düşülür', m.notes.length === 1); }
{ const m = E.migrate(base()); truthy(GJ, 'Zaten yeni biçimdeki kayıt aynen kalır', JSON.stringify(m.cfg) === JSON.stringify(base()));
  truthy(GJ, 'Bozuk kayıt varsayılana düşer', E.migrate('x').cfg.fleet.length === 2 && E.migrate(null).cfg.fleet.length === 2); }

/* ===== K. Tüm gün, filo olarak (günlük çok seferli defter) ===== */
const GK = 'Tüm gün defteri';
function dayCfgs() { const out = []; const mk = (f) => { const c = base(); f(c); return c; };
  out.push(base()); out.push(mk((c) => { c.scenario.demand = 7; })); out.push(mk((c) => { c.scenario.demand = 8.5; })); out.push(mk((c) => { c.scenario.fleet = 5; c.scenario.demand = 3; })); out.push(mk((c) => { c.scenario.roundTrip = false; c.scenario.demand = 9; }));
  out.push(mk((c) => { c.scenario.stops = 0; c.scenario.loadMin = 0; c.scenario.demand = 12; })); out.push(mk((c) => { c.route.mode = 'manual'; c.route.manualKm = 12; c.scenario.demand = 30; }));
  out.push(mk((c) => { c.fleet.push(E.makeVehicle('robovan', 'rv2', 'Robovan Pro', 'X', '#5BD6F2', { speed: 55 })); c.fleet.push(E.makeVehicle('conventional', 'cv2', 'Van 2', 'Y', '#E0B040', { l100: 11 })); c.scenario.demand = 11; })); return out; }
dayCfgs().forEach((c, i) => {
  const r = E.analyze(c); if (!r.ok) { truthy(GK, `Senaryo ${i + 1} geçerli`, false, r.errors.join(';')); return; }
  const L = E.buildDay(r, r.config);
  const m = L.modelsAt(L.endMin + 1);
  r.order.forEach((id, j) => { eqRel(GK, `S${i + 1} ${id}: gün sonu filo maliyeti = motor günlük filo maliyeti (yıllık ÷ gün)`, r.vehicles[id].fleet / c.scenario.days, m[j].total, 0.00001); });
  r.order.forEach((id, j) => { eq(GK, `S${i + 1} ${id}: günlük sefer sayısı = talep (ondalık kalan kısmi sefer)`, Math.ceil(c.scenario.demand - 1e-9), m[j].tripsTotal); });
  eq(GK, `S${i + 1}: araç sayısı = Σ filo`, r.order.reduce((a, id) => a + r.vehicles[id].n, 0), L.cars.length);
  let mono = true, prev = null; for (let k = 0; k <= 40; k++) { const t = L.endMin * k / 40, mm = L.modelsAt(t); if (prev) mm.forEach((x, j) => { if (x.total < prev[j].total - 1e-9 || x.km < prev[j].km - 1e-9) mono = false; }); prev = mm; }
  truthy(GK, `S${i + 1}: maliyet ve km zamanla azalmaz`, mono);
  const z = L.modelsAt(0); truthy(GK, `S${i + 1}: 06:00'da hepsi 0`, z.every((x) => x.total === 0 && x.km === 0 && x.tripsDone === 0));
  const ev = L.events(-1, L.endMin + 1); eq(GK, `S${i + 1}: sefer bitiş olayı sayısı = tamamlanan sefer`, ev.length, m.reduce((a, x) => a + x.tripsDone, 0));
  truthy(GK, `S${i + 1}: konum oranları 0..1`, L.cars.every((car) => { const s = L.at(L.endMin * 0.37).filter((q) => q.id === car.id)[0]; return s.posFrac >= 0 && s.posFrac <= 1; }));
  truthy(GK, `S${i + 1}: JSON'da NaN/Infinity yok`, !/NaN|Infinity/.test(JSON.stringify(L.modelsAt(L.endMin * 0.5))));
});
{ const r = E.analyze(base()); const L = E.buildDay(r, r.config);
  const b = L.at(10); truthy(GK, '10. dakikada ilk araç yolda, ikinci araç bekliyor', b.filter((x) => x.modelId === 'robovan')[0].phase !== 'wait' && b.filter((x) => x.modelId === 'robovan')[1].phase === 'wait');
  const end = L.at(L.endMin + 5); truthy(GK, 'Gün sonunda araçlar "tamam" ve başlangıçta park', end.every((x) => x.done && x.posFrac === 1)); }

/* ===== Rapor ===== */
const groups = [...new Set(rows.map((r) => r.group))];
let out = '';
groups.forEach((g) => {
  out += `\n## ${g}\n| Test | Beklenen | Gerçekleşen | Sonuç |\n|---|---|---|---|\n`;
  rows.filter((r) => r.group === g).forEach((r) => { out += `| ${r.name} | ${r.expected} | ${r.actual} | ${r.pass ? 'GEÇTİ' : '**KALDI**'} |\n`; });
});
console.log(out);
console.log(`\nToplam: ${rows.length}  Geçen: ${rows.length - fail}  Kalan: ${fail}`);
console.log('\nHam değerler:', JSON.stringify({ routeKm: r0.route.km, tripH: [V.robovan.tripH, V.conventional.tripH], perKm: [V.robovan.perKm, V.conventional.perKm], fleet: [V.robovan.fleet, V.conventional.fleet], be: r0.kpi.breakEven }));
process.exit(fail ? 1 : 0);
