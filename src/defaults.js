'use strict';
/* Varsayılan senaryo ve araç değerleri. YALNIZCA ÖRNEK değerlerdir (gerçek teklif değildir).
   Araç kategorisi yalnızca iki tanedir: Robovan (elektrikli, L4 otonom, uzaktan operatör) ve
   Geleneksel Van (dizel, sürücülü). Kullanıcı aynı kategorilerde farklı marka/model ekleyebilir (en çok 6 araç). */
const SCENARIO_DEFAULTS = Object.freeze({
  days: 300, demand: 8, stops: 4, loadMin: 10, loadPct: 70, rate: 8, horizon: 5, fleet: 0,
  roadFactor: 1.3, roundTrip: true,
});

const ROUTE_DEFAULTS = Object.freeze({
  mode: 'route', manualKm: 4,
  waypoints: [
    { n: 'Gebze', lat: 40.8028, lon: 29.4307 },
    { n: 'İzmit (Kocaeli)', lat: 40.7654, lon: 29.9408 },
  ],
});

const CATEGORIES = Object.freeze({
  robovan: { label: 'Robovan', model: 'L4 otonom lojistik aracı (örnek)', kind: 'robo', energy: 'electric', mode: 'autonomous' },
  conventional: { label: 'Geleneksel Van', model: 'Dizel panelvan / kamyonet (örnek)', kind: 'ice', energy: 'diesel', mode: 'driver' },
});

/* Kategori başına parametre alanları ve varsayılanlar */
const PARAM_DEFAULTS = Object.freeze({
  robovan: { price: 85000, infra: 5000, residual: 20, life: 8, eng: 15000, kwh100: 18, elec: 0.15, eff: 90, chargeKw: 22, range: 230, maint: 0.05, tire: 0.01, ins: 2500, tax: 0, lic: 250, operator: 1800, ratio: 5, shiftH: 8, payload: 1800, speed: 40, hours: 20 },
  conventional: { price: 38000, infra: 0, residual: 25, life: 8, l100: 9, fuel: 1.5, maint: 0.08, tire: 0.02, ins: 2200, tax: 500, driver: 1500, shiftH: 8, payload: 1500, speed: 45, hours: 8 },
});

const MAX_VEHICLES = 6;
const MIN_VEHICLES = 2;
/* Aynı kategorideki modellere sırayla atanan renkler: Robovan turkuaz-yeşil ailesi, geleneksel turuncu-kahve ailesi */
const PALETTE = Object.freeze({
  robovan: ['#1FC2AE', '#5BD6F2', '#8BE0A8', '#2E9BC6'],
  conventional: ['#E2803F', '#E0B040', '#C9604B', '#B07A52'],
});

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function makeVehicle(category, id, name, model, color, params) {
  const base = clone(PARAM_DEFAULTS[category]);
  /* count: araç sayısı; 0 = otomatik (günlük sefere göre hesaplanır), >0 = elle sabitlenmiş */
  return { id, name, model: model === undefined ? CATEGORIES[category].model : model, category, color: color || PALETTE[category][0], count: 0, params: Object.assign(base, params || {}) };
}

function defaultFleet() {
  return [makeVehicle('robovan', 'robovan', 'Robovan'), makeVehicle('conventional', 'conventional', 'Geleneksel Van')];
}

function defaultConfig() {
  return { scenario: clone(SCENARIO_DEFAULTS), route: clone(ROUTE_DEFAULTS), fleet: defaultFleet(), compare: { a: 'robovan', b: 'conventional' } };
}

module.exports = { SCENARIO_DEFAULTS, ROUTE_DEFAULTS, CATEGORIES, PARAM_DEFAULTS, PALETTE, MAX_VEHICLES, MIN_VEHICLES, clone, makeVehicle, defaultFleet, defaultConfig };
