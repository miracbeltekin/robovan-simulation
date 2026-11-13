'use strict';
/* Hesap motoru. Saf fonksiyonlar: global durum yok, DOM yok, ağ yok.
   Formüller şartname bölüm 5 ile birebir aynıdır. */
const { routeDistance, isNum } = require('./geo');
const { validateConfig } = require('./validate');
const { CATEGORIES, clone } = require('./defaults');

const EPS = 1e-9;
const finiteOrNull = (x) => (Number.isFinite(x) ? x : null);
const div = (a, b) => (b > 0 ? a / b : null);

function allFinite(vehicles) {
  return Object.keys(vehicles).every((k) => Object.values(vehicles[k]).every((x) => typeof x !== 'number' || Number.isFinite(x)));
}

/* Tek araç için hesap. kind: 'robo' (Robovan kategorisi: elektrikli, otonom) veya 'ice' (Geleneksel Van: dizel, sürücülü). tripKm: sefer mesafesi (gidiş-dönüş uygulanmış). */
function calcVehicle(kind, vc, sc, tripKm, demand, fleetOverride) {
  const isEv = kind === 'robo';
  const driveH = tripKm / vc.speed;
  const loadH = (sc.stops * sc.loadMin) / 60;
  const tripKwh = isEv ? (tripKm * vc.kwh100) / 100 : 0;
  const chargeH = isEv ? tripKwh / vc.chargeKw : 0;
  const tripH = Math.max(driveH + loadH + chargeH, 0.01);
  const overtime = tripH > vc.hours + EPS;
  const maxTrips = Math.max(1, Math.floor(vc.hours / tripH + EPS));
  const autoN = Math.max(1, Math.ceil(demand / maxTrips - EPS));
  const n = fleetOverride > 0 ? fleetOverride : autoN;
  const tpv = demand / n;
  const usedH = tpv * tripH;
  const overCapacity = fleetOverride > 0 && n < autoN;
  const shifts = Math.max(1, Math.ceil(usedH / vc.shiftH - EPS));
  const kmv = tpv * tripKm * sc.days;

  const energy = isEv ? ((kmv * vc.kwh100) / 100 / (vc.eff / 100)) * vc.elec : ((kmv * vc.l100) / 100) * vc.fuel;
  const maint = kmv * (vc.maint + vc.tire);
  const fixed = vc.ins + vc.tax + (kind === 'robo' ? vc.lic * 12 : 0);
  const people = kind === 'robo' ? (vc.operator * 12 * shifts) / vc.ratio : vc.driver * 12 * shifts;
  const eng = kind === 'robo' ? vc.eng / n : 0;
  const capex = vc.price + vc.infra + eng;
  const resV = (vc.price * vc.residual) / 100;
  const dep = (capex - resV) / vc.life;
  const fin = ((capex + resV) / 2) * (sc.rate / 100);
  const cashOpex = energy + maint + fixed + people;
  const total = cashOpex + dep + fin;
  const trips = tpv * sc.days;
  const tonkm = (kmv * vc.payload * sc.loadPct) / 100 / 1000;

  return {
    kind, n, autoN, tpv, tripKm, tripH, driveH, loadH, chargeH, usedH, shifts, maxTrips, overtime, overCapacity,
    rangeFail: isEv && tripKm > vc.range * 0.95,
    kmv, energy, maint, fixed, people, dep, fin, cashOpex, total, fleet: total * n,
    perKm: div(total, kmv), perTrip: div(total, trips), perTonKm: div(total, tonkm),
    capex, capexFleet: capex * n, resV, life: vc.life, price: vc.price,
    /* birikimli nakit maliyet (filo): yatırım + işletme */
    cumulative(t) { return n * (capex + cashOpex * t); },
    /* toplam sahip olma maliyeti: kalıntı değer düşülmüş (kalıntı ömür boyunca doğrusal azalır) */
    tco(t) {
      const r = resV + (vc.price - resV) * (1 - Math.min(t, vc.life) / vc.life);
      return n * (capex + cashOpex * t) - n * r;
    },
  };
}


/* Türetilmiş operasyon göstergeleri (yalnız okuma; maliyet formüllerine dokunmaz). */
function operationMetrics(c, vc, sc) {
  const isEv = c.kind === 'robo';
  const fleetKm = c.kmv * c.n;
  return {
    dailyKmFleet: sc.days > 0 ? fleetKm / sc.days : 0,
    annualKmFleet: fleetKm,
    capacityKgPerTrip: (vc.payload * sc.loadPct) / 100,
    annualTonnes: (c.tpv * c.n * sc.days * vc.payload * sc.loadPct) / 100 / 1000,
    staff: c.kind === 'robo' ? (c.shifts * c.n) / vc.ratio : c.shifts * c.n,
    staffKind: c.kind === 'robo' ? 'operator' : 'driver',
    energyQty: isEv ? (fleetKm * vc.kwh100) / 100 / (vc.eff / 100) : (fleetKm * vc.l100) / 100,
    energyUnit: isEv ? 'kWh' : 'L',
    dailyCostFleet: sc.days > 0 ? c.fleet / sc.days : 0,
    monthlyCostFleet: c.fleet / 12,
  };
}

/* aracın sabitlenmiş sayısı: kendi alanı (count > 0); yoksa eski senaryo alanı yalnız Robovan türünde; 0 = otomatik */
function fleetOf(v, kind, scFleet) { return isNum(v.count) && v.count > 0 ? v.count : (kind === 'robo' ? scFleet : 0); }

function calcFleet(cfg, oneWayKm, demand, fleetOverride) {
  const sc = cfg.scenario;
  const tripKm = oneWayKm * (sc.roundTrip ? 2 : 1);
  const out = {};
  cfg.fleet.forEach((v) => {
    const kind = CATEGORIES[v.category].kind;
    const r = calcVehicle(kind, v.params, sc, tripKm, demand, fleetOf(v, kind, fleetOverride));
    out[v.id] = Object.assign(r, { id: v.id, name: v.name, model: v.model, category: v.category, color: v.color });
  });
  return out;
}

/* a: karşılaştırılan araç (genelde Robovan), b: taban. Yıllık işletme = nakit işletme (amortisman ve finansman hariç). */
function breakEven(a, b) {
  const a0 = a.capexFleet, a1 = a.n * a.cashOpex, b0 = b.capexFleet, b1 = b.n * b.cashOpex;
  if (a0 <= b0 && a1 <= b1) return { years: 0, status: 'immediate', label: 'İlk günden ucuz' };
  if (a1 >= b1) return { years: null, status: 'never', label: 'Geri ödemez' };
  if (a0 <= b0) return { years: 0, status: 'immediate', label: 'İlk günden ucuz' };
  const t = (a0 - b0) / (b1 - a1);
  return { years: t, status: 'payback', label: `${t.toFixed(1).replace('.', ',')} yıl` };
}

const vehicleById = (cfg, id) => cfg.fleet.filter((v) => v.id === id)[0];

/* B (karşılaştırma tabanı) sürücülü ise: B'nin aylık sürücü maliyeti hangi değerde yıllık filo maliyetini A ile eşitler (ikiye bölme).
   B sürücülü değilse hesaplanamaz (status 'n/a'). */
function breakEvenWage(cfg, oneWayKm) {
  const sc = cfg.scenario;
  const A = vehicleById(cfg, cfg.compare.a), B = vehicleById(cfg, cfg.compare.b);
  if (CATEGORIES[B.category].mode !== 'driver') return { value: null, status: 'n/a', label: 'Yalnız sürücülü taban araçta hesaplanır' };
  const tripKm = oneWayKm * (sc.roundTrip ? 2 : 1);
  const kA = CATEGORIES[A.category].kind, kB = CATEGORIES[B.category].kind;
  const a = calcVehicle(kA, A.params, sc, tripKm, sc.demand, fleetOf(A, kA, sc.fleet));
  const f = (w) => calcVehicle(kB, { ...B.params, driver: w }, sc, tripKm, sc.demand, fleetOf(B, kB, sc.fleet)).fleet - a.fleet;
  const HI = 60000;
  if (f(0) > 0) return { value: 0, status: 'always', label: `${A.name} her maaşta daha ucuz` };
  if (f(HI) < 0) return { value: null, status: 'above-range', label: '60.000 üzerinde' };
  let lo = 0, hi = HI;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; }
  return { value: (lo + hi) / 2, status: 'found', label: null };
}

function sensitivity(cfg, oneWayKm, maxDemand) {
  const sc = cfg.scenario;
  const rows = [];
  for (let d = 1; d <= maxDemand; d++) {
    const r = calcFleet(cfg, oneWayKm, d, sc.fleet);
    const row = { demand: d };
    Object.keys(r).forEach((id) => { row[id] = r[id].perKm; });
    rows.push(row);
  }
  return rows;
}

/* Ana giriş. Geçersiz girdide ok:false ve Türkçe hata listesi döner; hiçbir zaman NaN/Infinity üretmez. */
function analyze(cfgIn, opts = {}) {
  if (!cfgIn || typeof cfgIn !== 'object') return { ok: false, errors: ['Yapılandırma okunamadı.'], warnings: [] };
  const cfg = clone(cfgIn);
  const v = validateConfig(cfg);
  const warnings = [...v.warnings];
  if (!v.ok) return { ok: false, errors: v.errors, warnings };
  const route = routeDistance(cfg.route, cfg.scenario.roadFactor, opts.roadKm);
  if (route.errors.length) return { ok: false, errors: route.errors, warnings, route };
  const sc = cfg.scenario;
  const vehicles = calcFleet(cfg, route.km, sc.demand, sc.fleet);
  if (!allFinite(vehicles)) return { ok: false, errors: ['Girilen değerler çok büyük; hesap taştı. Değerleri gözden geçirin.'], warnings, route };
  const order = cfg.fleet.map((x) => x.id);
  order.forEach((id) => {
    const c = vehicles[id], nm = c.name;
    if (c.overtime) warnings.push(`${nm}: tek sefer (${c.tripH.toFixed(1)} sa) günlük çalışma süresini aşıyor.`);
    if (c.rangeFail) warnings.push(`${nm}: tek sefer (${Math.round(c.tripKm)} km) menzile yakın veya fazla; ek şarj gerekebilir.`);
    if (c.overCapacity) warnings.push(`${nm}: sabitlenen araç sayısı (${c.n}) talebi karşılamaya yetmiyor, gereken ${c.autoN}.`);
    c.ops = operationMetrics(c, vehicleById(cfg, id).params, sc);
  });
  if (route.km === 0) warnings.push('Rota mesafesi 0 km; km başına değerler hesaplanamaz.');
  const A = vehicles[cfg.compare.a], B = vehicles[cfg.compare.b];
  const kpi = {
    a: cfg.compare.a, b: cfg.compare.b,
    perKmDeltaPct: A.perKm !== null && B.perKm !== null ? (A.perKm / B.perKm - 1) * 100 : null,
    annualSaving: B.fleet - A.fleet,
    tcoSaving: B.tco(sc.horizon) - A.tco(sc.horizon),
    breakEven: breakEven(A, B),
    breakEvenWage: breakEvenWage(cfg, route.km),
    fleetCounts: Object.fromEntries(order.map((id) => [id, vehicles[id].n])),
    investmentDiff: A.capexFleet - B.capexFleet,
  };
  return { ok: true, errors: [], warnings, route, vehicles, order, kpi, config: cfg };
}

module.exports = { analyze, operationMetrics, calcVehicle, calcFleet, breakEven, breakEvenWage, sensitivity, isNum };
