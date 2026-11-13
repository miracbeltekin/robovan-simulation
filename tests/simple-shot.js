const { chromium, devices } = require('playwright'); const H = require('./helpers');
(async () => { const b = await chromium.launch({ args: H.ARGS }); const dir = process.argv[3];
  let ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 664 } }); await H.stubServices(ctx); let p = await ctx.newPage(); await p.goto('file://' + process.argv[2]); await H.waitMap(p); await H.waitPlan(p); await p.click('#tcSkip', { force: true }).catch(() => {}); await p.waitForTimeout(2500);
  await p.screenshot({ path: dir + '/s-m-closed.png' });
  await p.click('#moreBtn'); await p.waitForTimeout(600); await p.screenshot({ path: dir + '/s-m-more.png' }); await p.click('#moreBtn');
  await p.click('#sumBar'); await p.waitForTimeout(900); await p.screenshot({ path: dir + '/s-m-open.png' }); await ctx.close();
  ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ctx); p = await ctx.newPage(); await p.goto('file://' + process.argv[2]); await H.waitMap(p); await H.waitPlan(p); await p.click('#tcSkip').catch(() => {}); await p.waitForTimeout(2500); await p.screenshot({ path: dir + '/s-d.png' }); await p.screenshot({ path: dir + '/s-d-full.png', fullPage: true }); await b.close(); })();
