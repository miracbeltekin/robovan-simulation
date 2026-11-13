const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await p.goto('file://' + process.argv[2]); await p.waitForTimeout(500); await p.click('#tcSkip'); await p.waitForTimeout(400);
  await p.locator('#resultCard').screenshot({ path: 'shots/c1-result-card.png' });
  await p.locator('#rankCard').screenshot({ path: 'shots/c2-rank-card.png' });
  await p.locator('#ctrlCard').screenshot({ path: 'shots/c3-params-card.png' });
  await p.locator('#statCard').screenshot({ path: 'shots/c4-payback-card.png' });
  await p.locator('#routecard').screenshot({ path: 'shots/c5-route-card.png' });
  await b.close();
})();
