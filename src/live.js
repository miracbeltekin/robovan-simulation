'use strict';
/* Canlı simülasyon defteri. Motorun hesapladığı değerlerden TEK BİR SEFERİN zaman çizelgesini ve birikimli maliyetini üretir.
   Hız çarpanı (×1/×3/×6) yalnızca simülasyon saatinin ilerleme hızını değiştirir; toplam maliyet değişmez.
   Birikim kuralı (motor toplamıyla birebir uzlaşır):
   - mesafeye bağlı kalemler (enerji + bakım/lastik): kat edilen yola orantılı,
   - zamana bağlı kalemler (sigorta, vergi, lisans, personel, amortisman, finansman): sefer süresine orantılı.
   Sefer sonunda toplam = motorun "sefer başına maliyet" değeridir (yıllık filo maliyeti ile karıştırılmaz). */
const START_MIN = 6 * 60; /* 06:00 */

function round(x) { return Math.round(x * 1e9) / 1e9; }

/* c: engine.analyze vehicles[id]; roundTrip: bool; stops: durak sayısı; loadMin: durak bekleme dk */
function buildSchedule(c, sc) {
  const tripKm = c.tripKm;
  const driveMin = c.driveH * 60;
  const stops = Math.max(0, Math.floor(sc.stops));
  const dwell = sc.loadMin;
  const segs = []; /* {type:'drive'|'dwell'|'charge', min, km} */
  const legs = stops + 1;
  for (let i = 0; i < legs; i++) {
    segs.push({ type: 'drive', min: driveMin / legs, km: tripKm / legs });
    if (i < stops && dwell > 0) segs.push({ type: 'dwell', min: dwell, km: 0 });
  }
  if (c.chargeH > 0) segs.push({ type: 'charge', min: c.chargeH * 60, km: 0 });
  const totalMin = segs.reduce((s, x) => s + x.min, 0);
  return { segs, totalMin, tripKm };
}

/* t: seferin başlangıcından geçen dakika (sim). Konum oranı 0..1, kat edilen km, aşama ve birikimli değerler. */
function stateAt(c, sc, sched, t) {
  const tt = Math.min(Math.max(t, 0), sched.totalMin);
  let acc = 0, km = 0, phase = 'drive';
  for (let i = 0; i < sched.segs.length; i++) {
    const s = sched.segs[i];
    if (tt <= acc + s.min + 1e-12) {
      const f = s.min > 0 ? (tt - acc) / s.min : 1;
      km += s.km * f; phase = s.type; acc = tt; break;
    }
    acc += s.min; km += s.km;
  }
  km = Math.min(km, sched.tripKm);
  const done = tt >= sched.totalMin - 1e-9;
  if (done) { km = sched.tripKm; phase = 'done'; }
  const trips = c.tpv * sc.days;
  const kmFrac = sched.tripKm > 0 ? km / sched.tripKm : 1;
  const timeFrac = sched.totalMin > 0 ? tt / sched.totalMin : 1;
  const per = (x) => (trips > 0 ? x / trips : 0);
  /* mesafeye bağlı */
  const energy = per(c.energy) * kmFrac;
  const maint = per(c.maint) * kmFrac;
  /* zamana bağlı */
  const fixed = per(c.fixed) * timeFrac, people = per(c.people) * timeFrac;
  const dep = per(c.dep) * timeFrac, fin = per(c.fin) * timeFrac;
  const total = energy + maint + fixed + people + dep + fin;
  return {
    t: tt, done, phase, km, posFrac: kmFrac, progress: timeFrac,
    energyQty: c.kind === 'robo' ? 0 : 0, /* aşağıda doldurulur */
    energy, maint, fixed, people, dep, fin, total,
  };
}

/* Birim tüketim: elektrik kWh veya dizel litre (vc: araç parametreleri) */
function consumption(kind, vc, km) {
  return kind === 'robo' ? (km * vc.kwh100) / 100 / (vc.eff / 100) : (km * vc.l100) / 100;
}

function formatClock(simMin) {
  const m = Math.floor(simMin) % (24 * 60);
  const h = Math.floor(m / 60), mm = m % 60;
  return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

/* Tüm filo için simülasyon: her aracın kendi çizelgesi vardır, hepsi aynı anda (06:00) başlar. */
function buildLive(result, cfg) {
  const sc = cfg.scenario;
  const items = cfg.fleet.map((v) => {
    const c = result.vehicles[v.id];
    return { v, c, sched: buildSchedule(c, sc) };
  });
  const endMin = Math.max.apply(null, items.map((x) => x.sched.totalMin));
  return {
    startMin: START_MIN, endMin, items,
    at(simElapsedMin) {
      return items.map((it) => {
        const s = stateAt(it.c, sc, it.sched, simElapsedMin);
        s.energyQty = consumption(it.c.kind, it.v.params, s.km);
        s.id = it.v.id; s.name = it.v.name; s.category = it.v.category; s.color = it.v.color; s.unit = it.c.kind === 'robo' ? 'kWh' : 'L';
        return s;
      });
    },
  };
}


/* ===== Tüm gün, filo olarak: her araç kendi seferlerini art arda yapar (06:00'dan başlayarak) =====
   Dağıtım: toplam günlük sefer D araçlar arasında bölünür (tam sefer sayıları; ondalık kalan son araçta kısmi sefer olur).
   Her seferin maliyeti, tek sefer defteriyle aynı kuraldır; gün sonunda araç maliyetlerinin toplamı = motorun günlük filo maliyeti
   (yıllık filo ÷ çalışma günü), yani Σ(sefer × sefer başına maliyet). Park halindeki (henüz başlamamış / bitirmiş) araç maliyet biriktirmez. */
const STAGGER_MIN = 20, STAGGER_MAX = 240;
const COST_KEYS = ['energy', 'maint', 'fixed', 'people', 'dep', 'fin', 'total'];

function buildDay(result, cfg) {
  const sc = cfg.scenario, cars = [];
  cfg.fleet.forEach((v) => {
    const c = result.vehicles[v.id], sched = buildSchedule(c, sc), n = c.n, D = sc.demand;
    const whole = Math.floor(D + 1e-9), frac = D - whole, per = Math.floor(whole / n), extra = whole % n;
    for (let k = 0; k < n; k++) {
      const count = per + (k < extra ? 1 : 0), trips = [];
      for (let i = 0; i < count; i++) trips.push(1);
      if (frac > 1e-9 && k === extra % n) trips.push(frac);              /* ondalık talep: kısmi sefer */
      const start = Math.min(k * STAGGER_MIN, STAGGER_MAX), dur = trips.reduce((a, w) => a + w * sched.totalMin, 0);
      cars.push({ id: v.id + ':' + k, modelId: v.id, idx: k, n, name: v.name + (n > 1 ? ' ' + (k + 1) : ''), color: v.color, category: v.category, kind: c.kind, params: v.params, c, sched, trips, start, end: start + dur });
    }
  });
  const endMin = Math.max.apply(null, cars.map((x) => x.end).concat([0]));
  const zero = () => { const o = {}; COST_KEYS.forEach((k) => { o[k] = 0; }); return o; };

  function carAt(car, t) {
    const c = car.c, sc2 = sc, T = car.sched.totalMin, o = zero();
    let km = 0, done = 0, phase = 'wait', posFrac = 0, rev = false, tripNo = 0, progressTrip = 0;
    const el = t - car.start;
    if (el > 0 || car.trips.length === 0) {
      let acc = 0, running = false;
      for (let i = 0; i < car.trips.length; i++) {
        const w = car.trips[i], d = w * T;
        if (el >= acc + d - 1e-9) {                                           /* tamamlanmış sefer */
          COST_KEYS.forEach((k) => { o[k] += stateAt(c, sc2, car.sched, T)[k] * w; }); km += car.sched.tripKm * w; done++; acc += d; continue;
        }
        const st = stateAt(c, sc2, car.sched, (el - acc) / w);              /* sürmekte olan sefer */
        COST_KEYS.forEach((k) => { o[k] += st[k] * w; }); km += st.km * w; phase = st.phase; posFrac = st.posFrac; progressTrip = st.progress; tripNo = i + 1; rev = !sc2.roundTrip && i % 2 === 1; running = true; break;
      }
      if (!running) { phase = 'done'; tripNo = car.trips.length; posFrac = sc2.roundTrip ? 1 : 1; rev = !sc2.roundTrip && (car.trips.length - 1) % 2 === 1; }
    }
    if (phase === 'wait') { tripNo = 0; }
    return { id: car.id, modelId: car.modelId, idx: car.idx, name: car.name, color: car.color, category: car.category, phase, tripNo, tripsDone: done, tripsTotal: car.trips.length, posFrac, rev, progressTrip,
      km, energyQty: consumption(car.kind, car.params, km), unit: car.kind === 'robo' ? 'kWh' : 'L', cost: o, total: o.total, speed: car.params.speed, parkedStart: phase === 'wait', done: phase === 'done' };
  }
  function at(t) { return cars.map((car) => carAt(car, t)); }
  /* model (araç türü) bazında filo toplamı */
  function modelsAt(t) {
    const st = at(t), by = {};
    cfg.fleet.forEach((v) => { const c = result.vehicles[v.id]; by[v.id] = { id: v.id, name: v.name, color: v.color, category: v.category, n: c.n, unit: c.kind === 'robo' ? 'kWh' : 'L', cost: zero(), total: 0, km: 0, energyQty: 0, tripsDone: 0, tripsTotal: 0, dayTotal: c.fleet / sc.days, perTrip: c.perTrip }; });
    st.forEach((s) => { const m = by[s.modelId]; COST_KEYS.forEach((k) => { m.cost[k] += s.cost[k]; }); m.km += s.km; m.energyQty += s.energyQty; m.tripsDone += s.tripsDone; m.tripsTotal += s.tripsTotal; });
    return cfg.fleet.map((v) => { const m = by[v.id]; m.total = m.cost.total; m.tripsTotal = cars.filter((x) => x.modelId === v.id).reduce((a, x) => a + x.trips.length, 0); m.progress = m.dayTotal > 0 ? Math.min(1, m.total / m.dayTotal) : 1; return m; });
  }
  /* (t0, t1] aralığında biten seferler (zaman sırasıyla) */
  function events(t0, t1) {
    const out = [];
    cars.forEach((car) => { let acc = car.start; car.trips.forEach((w, i) => { acc += w * car.sched.totalMin; if (acc > t0 + 1e-9 && acc <= t1 + 1e-9) out.push({ at: acc, carId: car.id, carName: car.name, modelId: car.modelId, tripNo: i + 1, tripsTotal: car.trips.length, cost: car.c.perTrip * w }); }); });
    return out.sort((a, b) => a.at - b.at);
  }
  return { startMin: START_MIN, endMin, cars, at, modelsAt, events };
}

module.exports = { buildDay, STAGGER_MIN, START_MIN, buildSchedule, stateAt, buildLive, formatClock, consumption, round };
