'use strict';
/* Rastgele geçerli yapılandırmalar (2–6 araç) için motor ve canlı defter çıktısını JSON yazar (bağımsız Python doğrulaması için). */
const E = require('../src');
let s = 12345; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; const u = (a, b) => a + (b - a) * R();
const out = [];
for (let i = 0; i < 400; i++) {
  const c = E.defaultConfig();
  Object.assign(c.scenario, { demand: Math.floor(u(1, 50)), days: Math.floor(u(100, 366)), stops: Math.floor(u(0, 12)), loadMin: u(0, 40), loadPct: u(10, 100), rate: u(0, 20), horizon: u(1, 10), fleet: R() > 0.8 ? Math.floor(u(1, 12)) : 0, roadFactor: u(1, 1.8), roundTrip: R() > 0.4 });
  c.route.mode = 'manual'; c.route.manualKm = u(1, 150);
  const extra = Math.floor(u(0, 5));
  for (let k = 0; k < extra; k++) c.fleet.push(E.makeVehicle(R() > 0.5 ? 'robovan' : 'conventional', 'x' + k, 'Araç ' + k));
  c.fleet.forEach((v) => { Object.keys(v.params).forEach((f) => { v.params[f] *= u(0.5, 1.8); }); const p = v.params; p.residual = Math.min(p.residual, 90); if (p.eff) p.eff = Math.min(100, p.eff); p.hours = Math.min(24, p.hours); p.shiftH = Math.min(24, p.shiftH); p.life = Math.max(1, p.life); });
  const ids = c.fleet.map((v) => v.id); const a = ids[Math.floor(R() * ids.length)]; let b = ids[Math.floor(R() * ids.length)]; if (a === b) b = ids[(ids.indexOf(a) + 1) % ids.length]; c.compare = { a, b };
  const r = E.analyze(c); if (!r.ok) continue;
  const L = E.buildLive(r, r.config); const frac = u(0.05, 1.2);
  const o = { cfg: c, res: {}, live: {} };
  const mid = L.at(L.endMin * frac), end = L.at(L.endMin);
  c.fleet.forEach((fv, j) => { const v = r.vehicles[fv.id]; o.res[fv.id] = { n: v.n, tripH: v.tripH, kmv: v.kmv, energy: v.energy, maint: v.maint, fixed: v.fixed, people: v.people, dep: v.dep, fin: v.fin, total: v.total, fleet: v.fleet, perKm: v.perKm, perTrip: v.perTrip, perTonKm: v.perTonKm, tco: v.tco(c.scenario.horizon), cum5: v.cumulative(5), staff: v.ops.staff, energyQty: v.ops.energyQty };
    o.live[fv.id] = { frac, midTotal: mid[j].total, midKm: mid[j].km, endTotal: end[j].total, endKm: end[j].km, midQty: mid[j].energyQty, endMin: L.items[j].sched.totalMin }; });
  o.kpi = { saving: r.kpi.annualSaving, be: r.kpi.breakEven.years, tcoSaving: r.kpi.tcoSaving, a, b };
  out.push(o);
}
console.log(JSON.stringify(out));
