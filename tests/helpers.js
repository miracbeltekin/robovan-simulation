'use strict';
const fs = require('fs'), path = require('path');
const FIX = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');
const OSRM = FIX('osrm-gebze-izmit.json'), PHOTON = FIX('photon-gebze.json');
const CORS = { 'access-control-allow-origin': '*' };
const ALLOWED = ['tiles.openfreemap.org', 'router.project-osrm.org', 'routing.openstreetmap.de', 'photon.komoot.io'];
const isExt = (u) => !u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:') && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u);
/* Rota ve adres servisleri: gerçek OSRM/Photon yanıtları (önceden alındı) ile beslenir. Harita karoları GERÇEK OpenFreeMap'ten gelir. */
async function stubServices(ctx, st = {}) {
  await ctx.addInitScript(() => { window.__rvOpenAnalysis = true; });   /* test: Detaylı analiz açık başlar (üretimde varsayılan kapalı) */
  st.osrm = []; st.fossgis = []; st.photon = []; st.mode = st.mode || 'ok';
  await ctx.route(/router\.project-osrm\.org\/route/, (r) => { st.osrm.push({ t: Date.now(), url: r.request().url() }); if (st.mode === 'osrm-down' || st.mode === 'all-down') return r.abort('failed'); r.fulfill({ contentType: 'application/json', headers: CORS, body: OSRM }); });
  await ctx.route(/routing\.openstreetmap\.de\/routed-car\/route/, (r) => { st.fossgis.push({ t: Date.now(), url: r.request().url() }); if (st.mode === 'all-down') return r.abort('failed'); r.fulfill({ contentType: 'application/json', headers: CORS, body: OSRM }); });
  await ctx.route(/photon\.komoot\.io\/api/, (r) => { st.photon.push({ t: Date.now(), url: r.request().url() }); if (st.mode === 'all-down') return r.abort('failed'); r.fulfill({ contentType: 'application/json', headers: CORS, body: PHOTON }); });
  return st;
}
async function blockAllExternal(ctx, seen = []) { await ctx.addInitScript(() => { window.__rvOpenAnalysis = true; }); await ctx.route('**/*', (r) => { const u = r.request().url(); if (isExt(u)) { try { seen.push(new URL(u).host); } catch (e) {} return r.abort('failed'); } r.continue(); }); return seen; }
async function waitMap(p, state = 'ready', ms = 45000) { await p.waitForFunction((s) => window.RobovanMap && window.RobovanMap.debug().state === s, state, { timeout: ms }); }
/* gerçek karayolu rotası geldi ve araçlar haritaya konuldu */
async function waitPlan(p, ms = 20000) { await p.waitForFunction(() => !document.getElementById('pp').disabled && window.RobovanMap.hasRoute() && window.RobovanMap.debug().van && window.RobovanMap.debug().van.vehicles.length >= 2, null, { timeout: ms }); }
const ARGS = ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
module.exports = { stubServices, blockAllExternal, waitMap, waitPlan, ARGS, ALLOWED, isExt, OSRM, PHOTON };
