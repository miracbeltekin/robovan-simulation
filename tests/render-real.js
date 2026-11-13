/* Gerçek harita görüntüleri: OpenFreeMap karoları (gerçek) + OSRM/Photon kayıtları. Ekran görüntüleri shots/ altına yazılır. */
const { chromium, devices } = require('playwright'); const H = require('./helpers');
const url = 'file://' + process.argv[2];
(async () => {
  const b = await chromium.launch({ args: H.ARGS });
  const shot = async (p, f, ms = 4500) => { await p.waitForTimeout(ms); await p.screenshot({ path: 'shots/' + f }); };
  /* masaüstü koyu */
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ctx); let p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await H.waitMap(p); await H.waitPlan(p); await p.click('#tcSkip'); await shot(p, 'v1-desktop-dark.png', 5000);
  await p.evaluate(() => { const M = window.RobovanMap; M.seek(M.timeline().duration * 0.35); const q = M.debug().pos; M.map.jumpTo({ center: [q.lng, q.lat], zoom: 16.4, pitch: 66, bearing: q.brg }); }); await shot(p, 'v2-van-closeup.png', 6000);
  await p.evaluate(() => { const M = window.RobovanMap; const q = M.debug().pos; M.map.jumpTo({ center: [q.lng, q.lat], zoom: 18.2, pitch: 68, bearing: (q.brg + 25) % 360 }); }); await shot(p, 'v3-van-detail.png', 6000);
  await p.evaluate(() => window.RobovanMap.map.jumpTo({ center: [29.4307, 40.8028], zoom: 15.6, pitch: 64, bearing: 30 })); await shot(p, 'v4-buildings.png', 6000);
  await p.evaluate(() => window.RobovanMap.map.jumpTo({ center: [28.9784, 41.0082], zoom: 15.4, pitch: 62, bearing: -25 })); await shot(p, 'v5-istanbul-3d.png', 6500);
  await p.evaluate(() => { const M = window.RobovanMap; M.fit(); M.seek(0); }); await shot(p, 'v6-desktop-fit.png', 6500);
  console.log('errors', errs); await ctx.close();
  /* mobil */
  for (const [w, h] of [[390, 844], [360, 740]]) {
    ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent }); await H.stubServices(ctx); p = await ctx.newPage();
    await p.goto(url); await H.waitMap(p); await H.waitPlan(p); await p.click('#tcSkip'); await p.evaluate(() => window.scrollTo(0, 0)); await shot(p, `v7-mobile-${w}.png`, 5000);
    await p.evaluate(() => { const M = window.RobovanMap; M.seek(M.timeline().duration * 0.4); const q = M.debug().pos; M.map.jumpTo({ center: [q.lng, q.lat], zoom: 16.2, pitch: 64, bearing: q.brg }); }); await shot(p, `v8-mobile-van-${w}.png`, 5500);
    await ctx.close();
  }
  await b.close();
})();
