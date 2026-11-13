const { chromium, devices } = require('playwright'); const H = require('./helpers');
(async () => { const b = await chromium.launch({ args: H.ARGS });
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); await H.stubServices(ctx); const p = await ctx.newPage(); await p.goto('file://' + process.argv[2]); await H.waitMap(p); await H.waitPlan(p);
  await p.evaluate(() => window.__app.setSim(120)); await p.waitForTimeout(2500); await p.screenshot({ path: '/tmp/claude-0/m1.png' });
  await p.evaluate(() => window.scrollTo(0, 560)); await p.waitForTimeout(300); await p.screenshot({ path: '/tmp/claude-0/m2.png' }); await b.close(); })();
