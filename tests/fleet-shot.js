const { chromium, devices } = require('playwright'); const H = require('./helpers');
(async () => { const b = await chromium.launch({ args: H.ARGS });
  for (const [n, o] of [['d', { viewport: { width: 1440, height: 900 } }], ['m', { ...devices['iPhone 13'], viewport: { width: 390, height: 664 } }]]) {
    const ctx = await b.newContext(o); await H.stubServices(ctx); const p = await ctx.newPage(); await p.goto('file://' + process.argv[2]); await H.waitMap(p); await H.waitPlan(p); await p.click('#tcSkip').catch(() => {});
    await p.click('[data-fl="conventional"][data-d="-1"]'); await p.click('[data-fl="conventional"][data-d="-1"]'); await p.click('[data-fl="robovan"][data-d="1"]'); await p.waitForTimeout(1500);
    await p.evaluate(() => document.getElementById('resultCard').scrollIntoView({ block: 'start' })); await p.waitForTimeout(500); await p.screenshot({ path: process.argv[3] + '/fleet-' + n + '.png' }); await ctx.close(); }
  await b.close(); })();
