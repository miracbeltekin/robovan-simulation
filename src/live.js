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

module.exports = { START_MIN, buildSchedule, stateAt, buildLive, formatClock, consumption, round };
