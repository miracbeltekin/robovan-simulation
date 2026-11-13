const { chromium } = require('playwright'); const H = require('./helpers');
(async () => { const b = await chromium.launch({ args: H.ARGS });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ctx); const p = await ctx.newPage(); await p.goto('file://' + process.argv[2]); await H.waitMap(p); await H.waitPlan(p);
  await p.click('#tcSkip'); 
  await p.evaluate(() => { window.__app.setSim(40); const pos = window.RobovanMap.debug().pos; const a = pos.robovan; window.RobovanMap.map.jumpTo({ center: [a.lng, a.lat], zoom: 17.2, pitch: 64, bearing: a.brg - 25 }); });
  await p.waitForTimeout(9000); await p.screenshot({ path: '/tmp/claude-0/s4/d7-closeup.png' });
  await p.evaluate(() => { window.__app.setSim(0); const a = window.RobovanMap.debug().pos.robovan; window.RobovanMap.map.jumpTo({ center: [a.lng, a.lat], zoom: 18.6, pitch: 62, bearing: a.brg + 150 }); });
  await p.waitForTimeout(9000); await p.screenshot({ path: '/tmp/claude-0/s4/d8-start-two-vans.png' });
  await b.close(); })();
