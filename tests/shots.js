const { chromium, devices } = require('playwright');
const url = 'file://' + process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const w = async (p, ms = 500) => p.waitForTimeout(ms);
  let c = await b.newContext({ viewport: { width: 1440, height: 900 } }); let p = await c.newPage(); await p.goto(url); await w(p);
  await p.screenshot({ path: 'shots/s1-desktop-dark.png' });
  await p.click('#tcSkip'); await w(p, 300);
  await p.evaluate(() => document.getElementById('analysis').scrollIntoView()); await w(p, 400); await p.screenshot({ path: 'shots/s2-desktop-analysis.png' });
  await p.click('#myNums'); await w(p, 600); await p.screenshot({ path: 'shots/s4-sheet.png' });
  await c.close();
  c = await b.newContext({ ...devices['iPhone 13'] }); p = await c.newPage(); await p.goto(url); await w(p, 700);
  await p.screenshot({ path: 'shots/s5-mobile-top.png' });
  await p.evaluate(() => window.scrollTo(0, 650)); await w(p, 400); await p.screenshot({ path: 'shots/s6-mobile-mid.png' });
  await p.evaluate(() => document.getElementById('analysis').scrollIntoView()); await w(p, 400); await p.screenshot({ path: 'shots/s7-mobile-charts.png' });
  await b.close();
})();
