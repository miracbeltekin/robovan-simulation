'use strict';
const { chromium } = require('playwright'); const H = require('./helpers');
(async () => {
  const b = await chromium.launch({ args: H.ARGS });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ctx);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGE ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  await p.goto('file://' + process.argv[2]); await H.waitMap(p).catch(e => errs.push('map ' + e.message)); await H.waitPlan(p).catch(e => errs.push('plan ' + e.message));
  console.log('errs', errs);
  console.log(await p.evaluate(() => ({ clock: document.getElementById('clock').textContent, fleet: window.__app.cfg().fleet.map(v => v.id), live: window.__app.sim() })));
  await p.evaluate(() => { window.__app.setSim(100); });
  await p.waitForTimeout(500);
  console.log(await p.evaluate(() => ({ hud: document.getElementById('hudRows').innerText, diff: document.getElementById('hudDiff').innerText, van: window.RobovanMap.debug().van })));
  await p.screenshot({ path: '/tmp/claude-0/smoke1.png' });
  await b.close();
})();
