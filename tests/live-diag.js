const { chromium } = require('playwright'); const H = require('./helpers');
(async () => { const b = await chromium.launch({ args: H.ARGS }); const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const fails = []; p.on('requestfailed', r => fails.push(r.url().slice(0, 80) + ' ' + (r.failure() || {}).errorText)); p.on('response', r => { if (r.status() >= 400) fails.push(r.status() + ' ' + r.url().slice(0, 80)); });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(process.argv[2], { timeout: 45000 }).catch(e => console.log('goto', e.message)); await p.waitForTimeout(15000);
  console.log(await p.evaluate(() => ({ map: window.RobovanMap && window.RobovanMap.debug(), rc: (document.getElementById('rcRes') || {}).innerText && document.getElementById('rcRes').innerText.slice(0, 160), ms: document.getElementById('msText').innerText.slice(0, 120) })));
  console.log('fails', [...new Set(fails)].slice(0, 12), errs); await p.screenshot({ path: '/tmp/claude-0/live.png' }); await b.close(); })();
