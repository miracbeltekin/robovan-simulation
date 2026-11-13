'use strict';
/* Girdi doğrulama. Engelleyici hata (errors) varsa hesap yapılmaz; warnings bilgi içindir. */
const { isNum } = require('./geo');
const { CATEGORIES, MAX_VEHICLES, MIN_VEHICLES } = require('./defaults');

const LABEL = {
  days: 'Çalışma günü', demand: 'Günlük toplam sefer', stops: 'Sefer başına durak', loadMin: 'Durak başına yükleme süresi',
  loadPct: 'Yük doluluğu', rate: 'Sermaye maliyeti', horizon: 'Değerlendirme süresi', fleet: 'Robovan sayısı',
  price: 'Araç alış bedeli', infra: 'Altyapı', residual: 'Kalıntı değer', life: 'Ekonomik ömür', eng: 'Mühendislik bedeli',
  l100: 'Yakıt tüketimi', fuel: 'Yakıt fiyatı', kwh100: 'Elektrik tüketimi', elec: 'Elektrik fiyatı', eff: 'Şarj verimi',
  chargeKw: 'Şarj gücü', range: 'Menzil', maint: 'Bakım', tire: 'Lastik', ins: 'Sigorta', tax: 'Vergi', lic: 'Lisans',
  driver: 'Sürücü maliyeti', operator: 'Operatör maliyeti', ratio: 'Operatör başına araç', shiftH: 'Vardiya süresi',
  payload: 'Azami yük', speed: 'Ortalama hız', hours: 'Günlük çalışma süresi',
};
/* [min, max, minDahilMi] — min dahil değilse (>) olmalı */
const SCENARIO_RULES = {
  days: [1, 366, true], demand: [0, 100000, true], stops: [0, 1000, true], loadMin: [0, 1440, true], loadPct: [0, 100, true],
  rate: [0, 100, true], horizon: [0, 50, true], fleet: [0, 100000, true],
};
const BIG = 1e9; /* makul üst sınır: taşmayı engeller */
const VEHICLE_RULES = {
  price: [0, BIG, true], infra: [0, BIG, true], residual: [0, 100, true], life: [0, 60, false], eng: [0, BIG, true],
  l100: [0, BIG, true], fuel: [0, BIG, true], kwh100: [0, BIG, true], elec: [0, BIG, true], eff: [0, 100, false],
  chargeKw: [0, BIG, false], range: [0, BIG, false], maint: [0, BIG, true], tire: [0, BIG, true],
  ins: [0, BIG, true], tax: [0, BIG, true], lic: [0, BIG, true], driver: [0, BIG, true], operator: [0, BIG, true],
  ratio: [0, BIG, false], shiftH: [0, 24, false], payload: [0, BIG, true], speed: [0, BIG, false], hours: [0, 24, false],
};
const REQUIRED = {
  robovan: ['price', 'infra', 'residual', 'life', 'eng', 'kwh100', 'elec', 'eff', 'chargeKw', 'range', 'maint', 'tire', 'ins', 'tax', 'lic', 'operator', 'ratio', 'shiftH', 'payload', 'speed', 'hours'],
  conventional: ['price', 'infra', 'residual', 'life', 'l100', 'fuel', 'maint', 'tire', 'ins', 'tax', 'driver', 'shiftH', 'payload', 'speed', 'hours'],
};

function checkField(value, rule, label, errors, scope) {
  if (!isNum(value)) { errors.push(`${scope}${label}: geçerli bir sayı girin.`); return; }
  const [min, max, inc] = rule;
  if (inc ? value < min : value <= min) errors.push(`${scope}${label}: ${inc ? min + ' veya daha büyük' : min + "'dan büyük"} olmalı.`);
  else if (value > max) errors.push(`${scope}${label}: en fazla ${max} olabilir.`);
}

function validateConfig(cfg) {
  const errors = [], warnings = [];
  const sc = cfg.scenario || {};
  Object.keys(SCENARIO_RULES).forEach((k) => checkField(sc[k], SCENARIO_RULES[k], LABEL[k], errors, ''));
  if (!isNum(sc.roadFactor) || sc.roadFactor < 1) errors.push('Yol katsayısı: en az 1 olmalı.');
  if (typeof sc.roundTrip !== 'boolean') errors.push('Sefer türü geçersiz.');
  if (isNum(sc.fleet) && sc.fleet !== Math.floor(sc.fleet)) errors.push('Robovan sayısı: tam sayı olmalı.');

  const fleet = Array.isArray(cfg.fleet) ? cfg.fleet : null;
  if (!fleet) { errors.push('Araç listesi eksik.'); return { ok: false, errors, warnings }; }
  if (fleet.length < MIN_VEHICLES) errors.push(`En az ${MIN_VEHICLES} araç gerekli.`);
  if (fleet.length > MAX_VEHICLES) errors.push(`En fazla ${MAX_VEHICLES} araç eklenebilir.`);
  const ids = {};
  fleet.forEach((v, i) => {
    if (!v || typeof v !== 'object') { errors.push(`Araç ${i + 1}: okunamadı.`); return; }
    const nm = typeof v.name === 'string' && v.name.trim() ? v.name.trim() : `Araç ${i + 1}`;
    if (typeof v.id !== 'string' || !/^[a-z0-9_]{1,24}$/.test(v.id)) errors.push(`${nm}: kimlik geçersiz.`);
    else if (ids[v.id]) errors.push(`${nm}: kimlik ${v.id} tekrar ediyor.`); else ids[v.id] = true;
    if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 40) errors.push(`Araç ${i + 1}: ad boş olmamalı ve en fazla 40 karakter olmalı.`);
    if (v.model !== undefined && (typeof v.model !== 'string' || v.model.length > 60)) errors.push(`${nm}: model en fazla 60 karakter olabilir.`);
    if (!CATEGORIES[v.category]) { errors.push(`${nm}: araç kategorisi geçersiz.`); return; }
    const pr = v.params || {};
    REQUIRED[v.category].forEach((f) => checkField(pr[f], VEHICLE_RULES[f], LABEL[f], errors, nm + ' · '));
    if (isNum(pr.hours) && isNum(pr.shiftH) && pr.hours > 0 && pr.shiftH > pr.hours * 3) warnings.push(`${nm}: vardiya süresi günlük çalışma süresinden çok uzun görünüyor.`);
  });
  const cmp = cfg.compare || {};
  if (!ids[cmp.a] || !ids[cmp.b]) errors.push('Karşılaştırılacak araçlar seçilmeli.');
  else if (cmp.a === cmp.b) errors.push('Karşılaştırma için iki farklı araç seçin.');
  return { ok: errors.length === 0, errors, warnings };
}

module.exports = { validateConfig, LABEL, REQUIRED };
