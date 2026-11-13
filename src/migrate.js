'use strict';
/* Eski kayıtların (v2: cfg.vehicles{robo,ice,ev}) yeni yapıya (v3: cfg.fleet[]) güvenli taşınması.
   Kullanıcının değiştirdiği değerler korunur. Dokunulmamış eski "Elektrikli Van" varsayılanı kaldırılır;
   kullanıcı onu değiştirmişse özel Geleneksel Van olarak (veri kaybı olmadan) saklanır. */
const { clone, makeVehicle, defaultConfig, PARAM_DEFAULTS, PALETTE, MAX_VEHICLES } = require('./defaults');

const OLD_EV = { price: 55000, infra: 3000, residual: 22, life: 8, kwh100: 20, elec: 0.15, eff: 90, chargeKw: 11, range: 200, maint: 0.05, tire: 0.02, ins: 2300, tax: 300, driver: 1500, shiftH: 8, payload: 1200, speed: 45, hours: 8 };

function sameAs(p, ref) { return Object.keys(ref).every((k) => p && p[k] === ref[k]); }

function migrate(old) {
  const base = defaultConfig();
  if (!old || typeof old !== 'object') return { cfg: base, notes: [] };
  if (Array.isArray(old.fleet)) return { cfg: old, notes: [] }; /* zaten v3 */
  const notes = [];
  const cfg = base;
  if (old.scenario && typeof old.scenario === 'object') Object.assign(cfg.scenario, old.scenario);
  if (old.route && typeof old.route === 'object') cfg.route = Object.assign(cfg.route, old.route);
  const ov = old.vehicles || {};
  if (ov.robo && typeof ov.robo === 'object') Object.assign(cfg.fleet[0].params, ov.robo);
  if (ov.ice && typeof ov.ice === 'object') Object.assign(cfg.fleet[1].params, ov.ice);
  if (ov.ev && typeof ov.ev === 'object') {
    const p = ov.ev;
    if (sameAs(p, OLD_EV)) notes.push('Eski "Elektrikli Van" varsayılanı kaldırıldı.');
    else if (cfg.fleet.length < MAX_VEHICLES) {
      const keep = Object.assign({}, PARAM_DEFAULTS.conventional);
      Object.keys(keep).forEach((k) => { if (typeof p[k] === 'number') keep[k] = p[k]; });
      /* elektrikli parametreler geleneksel kategoride yer almaz; özel kayıt dizel alanlarıyla saklanır, notla bildirilir */
      const v = makeVehicle('conventional', 'custom_ev', 'Özel Van (eski kayıt)', 'Eski Elektrikli Van ayarlarından taşındı', PALETTE.conventional[1], keep);
      cfg.fleet.push(v);
      notes.push('Eski "Elektrikli Van" ayarlarınız değiştirilmişti; ortak alanlar "Özel Van (eski kayıt)" olarak korundu.');
    }
  }
  return { cfg: clone(cfg), notes };
}

module.exports = { migrate, OLD_EV };
