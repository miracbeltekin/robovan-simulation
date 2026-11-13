'use strict';
/* Mesafe: Haversine, durak dizisi, mesafe kaynağı seçimi. Saf fonksiyonlar. */
const EARTH_KM = 6371;
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

function validPoint(p) {
  return !!p && isNum(p.lat) && isNum(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

function haversineKm(a, b) {
  if (!validPoint(a) || !validPoint(b)) throw new RangeError('Geçersiz koordinat');
  const r = Math.PI / 180;
  const dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(x)));
}

function pathAirKm(wps) {
  let t = 0;
  for (let i = 1; i < wps.length; i++) t += haversineKm(wps[i - 1], wps[i]);
  return t;
}

/* Tek yön mesafe (km) ve kaynağı. roadKm: harita servisinden gelen gerçek karayolu mesafesi (isteğe bağlı). */
function routeDistance(route, roadFactor, roadKm) {
  const errors = [];
  if (route.mode === 'manual') {
    if (!isNum(route.manualKm) || route.manualKm < 0) {
      return { km: 0, source: 'manual', errors: ['Elle girilen mesafe 0 veya daha büyük bir sayı olmalı.'] };
    }
    return { km: route.manualKm, source: 'manual', errors };
  }
  const wps = route.waypoints || [];
  if (wps.length < 2) return { km: 0, source: 'none', errors: ['Rota için en az iki durak gerekli.'] };
  if (!wps.every(validPoint)) return { km: 0, source: 'none', errors: ['Duraklardan birinin koordinatı geçersiz.'] };
  if (isNum(roadKm) && roadKm >= 0) return { km: roadKm, source: 'road', errors };
  if (!isNum(roadFactor) || roadFactor < 1) return { km: 0, source: 'air', errors: ['Yol katsayısı en az 1 olmalı.'] };
  return { km: pathAirKm(wps) * roadFactor, source: 'air', errors };
}

module.exports = { haversineKm, pathAirKm, routeDistance, validPoint, isNum };
