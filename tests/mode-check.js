/* 3D araç görünürlüğü: 3D / Üstten / Tüm rota / Aracı takip et modlarında iki araç da gerçek 3D geometriyle çiziliyor mu?
   Yöntem: araçlar gizlenip gizlenmeden alınan iki gerçek ekran görüntüsü arasındaki piksel farkı, aracın ekrandaki konumu çevresinde ölçülür. */
const { chromium, devices } = require('playwright'); const H = require('./helpers'); const fs = require('fs');
const url = /^https?:/.test(process.argv[2]) ? process.argv[2] : 'file://' + process.argv[2], dir = process.argv[3] || '/tmp/mode'; fs.mkdirSync(dir, { recursive: true });
const out = []; const ok = (n, c, x) => out.push((c ? 'GEÇTİ ' : 'KALDI ') + n + (x ? ' — ' + x : ''));
async function diffCount(px, a, b, boxes) {
  return px.evaluate(async ({ a, b, boxes }) => { const load = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, c.width, c.height); };
    const A = await load(a), B = await load(b), W = A.width, S = A.width / (window.__vw || A.width); return boxes.map(bx => { let n = 0; const x0 = Math.max(0, Math.round(bx.x0 * S)), x1 = Math.min(W - 1, Math.round(bx.x1 * S)), y0 = Math.max(0, Math.round(bx.y0 * S)), y1 = Math.min(A.height - 1, Math.round(bx.y1 * S)); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 60) n++; } return n; }); }, { a, b, boxes });
}
(async () => {
  const b = await chromium.launch({ args: H.ARGS });
  for (const dev of [{ n: 'masaustu', o: { viewport: { width: 1440, height: 900 } } }, { n: 'mobil', o: { ...devices['iPhone 13'], viewport: { width: 390, height: 664 } } }]) {
    const ctx = await b.newContext(dev.o); await H.stubServices(ctx); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
    await p.goto(url); await H.waitMap(p); await H.waitPlan(p); const px = await ctx.newPage(); await px.goto('about:blank');
    await p.click('#tcSkip').catch(() => {}); await p.evaluate(() => window.scrollTo(0, 0));
    const mobile = dev.n === 'mobil';
    const modes = [['3d', async () => { await p.click('[data-view="3d"]'); }], ['ustten', async () => { await p.click('[data-view="top"]'); }], ['tum-rota', async () => { await p.click('[data-view="fit"]'); }], ['takip', async () => { await p.click('#followBtn'); }]];
    await p.evaluate(() => window.__app.setSim(70));
    for (const [name, act] of modes) {
      await act(); await p.waitForTimeout(mobile ? 9000 : 8000);
      if (name === 'takip') { await p.evaluate(() => window.__app.setSim(72)); await p.waitForTimeout(5000); }
      const info = await p.evaluate(() => { const m = window.RobovanMap.map, r = m.getContainer().getBoundingClientRect(), pos = window.RobovanMap.debug().pos, st = window.RobovanMap.van.state().vehicles; const pr = (k) => { const q = m.project([pos[k + ':0'].lng, pos[k + ':0'].lat]); return { x: r.left + q.x, y: r.top + q.y }; }; const len = (id) => (st.filter(v => v.id === id + ':0')[0] || {}).lenPx; return { zoom: m.getZoom(), pitch: m.getPitch(), r: pr('robovan'), c: pr('conventional'), vs: st.length, lr: len('robovan'), lc: len('conventional'), brg: pos['robovan:0'].brg }; });
      const box = (q, l) => { const R = Math.max(34, (l || 40) * 1.1); return { x0: q.x - R, x1: q.x + R, y0: q.y - R - 16, y1: q.y + R }; };
      const A = (await p.screenshot()).toString('base64'); fs.writeFileSync(`${dir}/${dev.n}-${name}.png`, Buffer.from(A, 'base64'));
      const only = async (id) => { await p.evaluate((id) => { const all = window.__all || (window.__all = window.RobovanMap.van.state().vehicles); window.RobovanMap.van.setAll(all.filter(v => v.id.indexOf(id + ':') !== 0)); window.RobovanMap.map.triggerRepaint(); }, id); await p.waitForTimeout(1800); const sh = (await p.screenshot()).toString('base64'); await p.evaluate(() => { window.RobovanMap.van.setAll(window.__all); window.__all = null; window.RobovanMap.map.triggerRepaint(); }); await p.waitForTimeout(900); return sh; };
      const Bno = await only('robovan'), Cno = await only('conventional');
      await px.evaluate((w) => { window.__vw = w; }, dev.o.viewport.width);
      const dR = (await diffCount(px, A, Bno, [box(info.r, info.lr)]))[0], dC = (await diffCount(px, A, Cno, [box(info.c, info.lc)]))[0];
      const clear = await p.evaluate((pts) => { const rs = ['#hud', '#routecard', '#mapbar', '#mapctl', '#timeline', '#pill'].map(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; }).filter(Boolean); const m = document.getElementById('mapcard').getBoundingClientRect(); return pts.map(q => { const inMap = q.x > m.left + 8 && q.x < m.right - 8 && q.y > m.top + 8 && q.y < m.bottom - 8; const hid = rs.some(r => q.x > r.left && q.x < r.right && q.y > r.top && q.y < r.bottom); return inMap && !hid; }); }, [info.r, info.c]);
      ok(`${dev.n} · ${name}: araç merkezleri harita içinde ve kontrol/paneller tarafından örtülmüyor`, clear[0] && clear[1], JSON.stringify([info.r, info.c].map(q => [Math.round(q.x), Math.round(q.y)])));
      const bnd = mobile ? [24, 120] : [30, 130];
      ok(`${dev.n} · ${name}: iki araç da gerçek 3D model olarak çiziliyor; ekranda okunur boyutta (zoom ${info.zoom.toFixed(1)}, eğim ${Math.round(info.pitch)}°)`, info.vs >= 2 && dR > 150 && dC > 150 && info.lr >= bnd[0] && info.lr <= bnd[1] && info.lc >= bnd[0] && info.lc <= bnd[1], `Robovan ${dR} px (${Math.round(info.lr)} px uzun), Geleneksel ${dC} px (${Math.round(info.lc)} px uzun)`);
      await p.evaluate(() => { window.__app.setSim(window.__app.sim().t + 0.01); });   /* araçları geri yerleştir */
      await p.waitForTimeout(800);
      if (name === 'takip') await p.click('#followBtn');
    }
    /* yakın görünüm: 3D detayları (siyah çerçeveli kapaklar, sensörler, tekerlekler) seçilebilmeli; üstten ve açılı */
    for (const [cn, pitch, bearOff] of [['yakin-ustten', 0, 0], ['yakin-acili', 60, 150]]) {
      await p.evaluate(({ pitch, bearOff }) => { window.__app.setSim(30); const a = window.RobovanMap.debug().pos['robovan:0'], c = window.RobovanMap.debug().pos['conventional:0']; window.RobovanMap.map.jumpTo({ center: [(a.lng + c.lng) / 2, (a.lat + c.lat) / 2], zoom: 18.9, pitch, bearing: a.brg + bearOff }); }, { pitch, bearOff });
      await p.waitForTimeout(mobile ? 10000 : 9000);
      const inf = await p.evaluate(() => { const m = window.RobovanMap.map, r = m.getContainer().getBoundingClientRect(), pos = window.RobovanMap.debug().pos, st = window.RobovanMap.van.state().vehicles; const pr = (k) => { const q = m.project([pos[k + ':0'].lng, pos[k + ':0'].lat]); return { x: r.left + q.x, y: r.top + q.y }; }; return { r: pr('robovan'), c: pr('conventional'), lr: st.filter(v => v.id === 'robovan:0')[0].lenPx, lc: st.filter(v => v.id === 'conventional:0')[0].lenPx, zoom: m.getZoom() }; });
      const Aimg = (await p.screenshot()).toString('base64'); fs.writeFileSync(`${dir}/${dev.n}-${cn}.png`, Buffer.from(Aimg, 'base64'));
      const R = Math.max(40, inf.lr * 0.8), clip = { x: Math.max(0, inf.r.x - R), y: Math.max(0, inf.r.y - R), width: Math.min(2 * R, dev.o.viewport.width - Math.max(0, inf.r.x - R)), height: Math.min(2 * R, 600) };
      const cls = await px.evaluate(async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let white = 0, dark = 0, teal = 0, grey = 0; for (let k = 0; k < d.length; k += 4) { const r = d[k], gg = d[k + 1], b = d[k + 2]; if (r > 200 && gg > 200 && b > 200) white++; else if (r < 30 && gg < 32 && b < 36) dark++; else if (gg > 150 && b > 140 && r < 90) teal++; else if (Math.abs(r - gg) < 12 && Math.abs(gg - b) < 12 && r > 60 && r < 190) grey++; } return { white, dark, teal, grey }; }, (await p.screenshot({ clip })).toString('base64'));
      ok(`${dev.n} · ${cn}: yakın görünümde 3D detaylar seçilebiliyor (beyaz gövde, siyah çerçeve/şasi, gri tekerlek/sensör; araç ${Math.round(inf.lr)} px)`, inf.lr >= (mobile ? 60 : 80) && cls.white > 800 && cls.dark > 150 && cls.grey > 40, JSON.stringify(cls));
    }
    /* oynat / duraklat / sıfırla / mod değişimi: araçlar kaybolmuyor */
    await p.click('[data-view="3d"]'); await p.click('#pp'); await p.waitForTimeout(2000); const v1 = await p.evaluate(() => window.RobovanMap.debug().van.vehicles.length);
    await p.click('[data-view="top"]'); await p.waitForTimeout(1500); const v2 = await p.evaluate(() => window.RobovanMap.debug().van.vehicles.length); await p.click('#pp'); const v3 = await p.evaluate(() => window.RobovanMap.debug().van.vehicles.length);
    await p.click('#rs'); await p.waitForTimeout(800); const v4 = await p.evaluate(() => window.RobovanMap.debug().van.vehicles.length);
    ok(`${dev.n}: oynat → görünüm değiştir → duraklat → sıfırla sırasında araçlar kaybolmuyor`, [v1, v2, v3, v4].every(x => x >= 2), [v1, v2, v3, v4].join(','));
    ok(`${dev.n}: WebGL/sayfa hatası yok`, errs.length === 0, errs.join(';'));
    await ctx.close();
  }
  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('KALDI')).length; console.log(out.length + ' kontrol, ' + bad + ' kalan'); await b.close(); process.exit(bad ? 1 : 0);
})();
