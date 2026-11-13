/* Karşılaştırma ekran görüntüleri: masaüstü 1440×900 ve mobil iPhone 13 (390×664 görünüm), referansla aynı boyutlar. */
const { chromium, devices } = require('playwright'); const H = require('./helpers'); const fs = require('fs');
const url = 'file://' + process.argv[2], dir = process.argv[3]; fs.mkdirSync(dir, { recursive: true });
(async () => { const b = await chromium.launch({ args: H.ARGS });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ctx); const p = await ctx.newPage(); await p.goto(url); await H.waitMap(p); await H.waitPlan(p);
  await p.click('#tcSkip'); await p.waitForTimeout(500);
  await p.evaluate(() => window.__app.setSim(95)); await p.waitForTimeout(3500); await p.screenshot({ path: dir + '/d1-overview-0735.png' });
  await p.click('#followBtn'); await p.evaluate(() => window.__app.setSim(130)); await p.waitForTimeout(6000); await p.screenshot({ path: dir + '/d2-follow-3d.png' }); await p.click('#followBtn');
  await p.evaluate(() => window.__app.setSim(window.__app.sim().end)); await p.click('[data-view="fit"]'); await p.waitForTimeout(2500); await p.screenshot({ path: dir + '/d3-end-of-trip.png' });
  await p.click('#myNums'); await p.waitForTimeout(300); await p.screenshot({ path: dir + '/d4-sheet-operasyon.png' });
  await p.click('[data-st="robovan"]'); await p.waitForTimeout(200); await p.screenshot({ path: dir + '/d4b-sheet-robovan.png' }); await p.click('[data-st="adv"]'); await p.waitForTimeout(200); await p.screenshot({ path: dir + '/d4c-sheet-gelismis.png' }); await p.click('[data-st="robovan"]');
  await p.click('#addRobo'); await p.waitForTimeout(200); await p.screenshot({ path: dir + '/d5-fleet-3.png' }); await p.keyboard.press('Escape');
  await p.screenshot({ path: dir + '/d6-full.png', fullPage: true });
  await ctx.close();
  const mc = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 664 } }); await H.stubServices(mc); const m = await mc.newPage(); await m.goto(url); await H.waitMap(m); await H.waitPlan(m);
  await m.click('#tcSkip'); await m.evaluate(() => { window.scrollTo(0, 0); window.__app.setSim(110); }); await m.waitForTimeout(8000); await m.screenshot({ path: dir + '/m1-map-hud.png' });
  await m.evaluate(() => window.scrollTo(0, 330)); await m.waitForTimeout(300); await m.screenshot({ path: dir + '/m2-sheet-result.png' });
  await m.evaluate(() => window.scrollTo(0, 900)); await m.waitForTimeout(300); await m.screenshot({ path: dir + '/m3-live-bars.png' });
  await b.close(); })();
