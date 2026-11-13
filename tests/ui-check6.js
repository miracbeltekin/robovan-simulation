/* Referans mantığı (tüm gün, filo; araç etiketinde canlı maliyet + durum; zıplama; sefer sonu bildirimi; araç kartı; neden kartı; what-if). */
const { chromium } = require('playwright'); const H = require('./helpers');
const url = /^https?:/.test(process.argv[2]) ? process.argv[2] : 'file://' + process.argv[2];
const out = []; const ok = (n, c, x) => out.push((c ? 'GEÇTİ ' : 'KALDI ') + n + (x ? ' — ' + x : ''));
(async () => {
  const b = await chromium.launch({ args: H.ARGS }); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ctx);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  await p.goto(url); await H.waitMap(p); await H.waitPlan(p); await p.click('#tcSkip').catch(() => {});
  const labels = () => p.$$eval('.mk-label', ls => ls.filter(l => l.style.display !== 'none').map(l => ({ n: l.querySelector('.ln').textContent, v: l.querySelector('.lv').textContent, s: l.querySelector('.ls').textContent, cls: l.className, nVis: getComputedStyle(l.querySelector('.ln')).display !== 'none', sVis: getComputedStyle(l.querySelector('.ls')).display !== 'none' })));
  ok('L1 Her araç etiketi: ad + canlı maliyet ($) + durum (bekliyor/sürüşte…)', await (async () => { await p.evaluate(() => window.__app.setSim(0)); await p.waitForTimeout(800); const l = await labels(); return l.length >= 2 && l.every(x => /\$[\d.]+,\d\d/.test(x.v) && x.n.length > 2 && x.s.length > 2); })());
  /* gün modeli: filo = Σ araç, her araç kendi seferlerini yapar */
  const fleet = await p.evaluate(() => { const r = window.__last, L = window.__app.live(); return { cars: L.cars.length, n: r.order.reduce((a, id) => a + r.vehicles[id].n, 0), end: L.endMin, trips: L.cars.reduce((a, c) => a + c.trips.length, 0), D: r.config.scenario.demand }; });
  ok('L2 Tüm gün filo: araç sayısı = Σ filo (2 Robovan + 4 Dizel), günlük sefer sayısı = talep × tür, gün 06:00\'dan gece yarısından önce biter', fleet.cars === fleet.n && fleet.trips === fleet.D * 2 && fleet.end > 300 && fleet.end <= 1080, JSON.stringify(fleet));
  /* yakın görünümde ayrıntılı etiket; uzakta kompakt */
  await p.evaluate(() => window.__app.setSim(200)); await p.evaluate(() => { const a = window.RobovanMap.debug().pos['robovan:0']; window.RobovanMap.map.jumpTo({ center: [a.lng, a.lat], zoom: 15.2, pitch: 55 }); }); await p.waitForTimeout(5000);
  const near = await labels(); ok('L3 Yakın görünümde etiketler ad + tutar + durumu gösterir', near.some(x => x.nVis && x.sVis && /sürüşte|şarjda|durakta/.test(x.s)), JSON.stringify(near.slice(0, 2)));
  await p.click('[data-view="fit"]'); await p.waitForTimeout(5000); const far = await labels(); ok('L4 Tüm rota görünümünde etiketler kompakt (yalnız renk noktası + tutar), okunur', far.length >= 2 && far.every(x => !x.nVis && /\$/.test(x.v)), JSON.stringify(far.slice(0, 2)));
  const ovl = await p.$$eval('.mk-label', ls => { const r = ls.filter(l => l.style.display !== 'none').map(l => l.getBoundingClientRect()); return r.some((x, i) => r.some((y, j) => j > i && !(x.right <= y.left + 1 || y.right <= x.left + 1 || x.bottom <= y.top + 1 || y.bottom <= x.top + 1))); });
  ok('L5 Etiketler birbirinin üstüne binmez (altı araç, kümelenmiş)', !ovl);
  /* canlı artış, motorla birebir */
  const g = await p.evaluate(async () => { const out = []; for (const t of [150, 210, 330]) { window.__app.setSim(t); await new Promise(r => setTimeout(r, 400)); const L = window.__app.live(), c = L.at(t).filter(x => x.id === 'robovan:0')[0]; const lab = [...document.querySelectorAll('.mk-label')].filter(l => l.querySelector('.ln').textContent === 'Robovan 1')[0]; out.push([c.total, lab.querySelector('.lv').textContent]); } return out; });
  const fm = (x) => '$' + x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  ok('L6 Etiketteki canlı tutar = motor defteri (3 zaman noktası) ve zamanla artar', g.every(x => x[1] === fm(x[0])) && g[0][0] < g[1][0] && g[1][0] < g[2][0], JSON.stringify(g.map(x => [fm(x[0]), x[1]])));
  const tone = await p.evaluate(() => { const g = (n) => [...document.querySelectorAll('.mk-label')].filter(l => l.querySelector('.ln').textContent.indexOf(n) === 0).map(l => l.className); return { r: g('Robovan'), d: g('Geleneksel') }; });
  ok('L7 Renk: km başına ucuz olan tür yeşil, pahalı olan kırmızı', tone.r.some(c => /\bgood\b/.test(c)) && tone.d.some(c => /\bbad\b/.test(c)), JSON.stringify(tone));
  /* zıplama + sefer sonu bildirimi: ilk biten sefer civarında oynat */
  await p.evaluate(() => { window.__bump = 0; const ob = new MutationObserver(ms => ms.forEach(m => { if (m.target.classList && m.target.classList.contains('bump') && m.attributeName === 'class') window.__bump++; })); document.querySelectorAll('.mk-label').forEach(l => ob.observe(l, { attributes: true, attributeFilter: ['class'] })); window.__ob = ob; const L = window.__app.live(), ev = L.events(-1, L.endMin + 1)[0]; window.__app.setSim(ev.at - 1.2); });
  await p.click('[data-sp="6"]'); await p.click('#pp'); await p.waitForTimeout(3500); await p.click('#pp');
  const bump = await p.evaluate(() => window.__bump), toastTxt = await p.evaluate(() => document.getElementById('maptip').textContent);
  ok('L8 Sefer bitince araç etiketi zıplar (bump)', bump >= 1, 'bump=' + bump);
  ok('L9 Sefer sonu bildirimi haritanın üstünde: araç, sefer no, sefer maliyeti, karşı türün aynı sefer maliyeti', /sefer tamam: \$[\d.]+,\d\d/.test(toastTxt) && /aynı seferde \$[\d.]+,\d\d/.test(toastTxt), toastTxt);
  /* araç kartı */
  await p.evaluate(() => window.__app.setSim(260)); await p.waitForTimeout(800);
  await p.evaluate(() => { [...document.querySelectorAll('.mk-label')].filter(l => l.querySelector('.ln').textContent === 'Robovan 1')[0].click(); }); await p.waitForTimeout(500);
  const card = await p.evaluate(() => { const L = window.__app.live(), c = L.at(260).filter(x => x.id === 'robovan:0')[0]; const items = [...document.querySelectorAll('#ccItems .ci b')].map(e => e.textContent); return { vis: !document.getElementById('carcard').hidden, name: document.getElementById('ccName').textContent, big: document.getElementById('ccBig').textContent, total: c.total, items: items.length, sum: c.cost.energy + c.cost.maint + c.cost.people + c.cost.dep + c.cost.fin + c.cost.fixed, grid: document.getElementById('ccGrid').innerText.replace(/\n/g, ' ') }; });
  ok('L10 Araca tıklayınca ayrıntı kartı açılır: ad, bugünkü maliyet (motorla aynı), 5 kalem, yol/tüketim/km maliyeti', card.vis && card.name === 'Robovan 1' && card.big.startsWith(fm(card.total)) && card.items === 5 && Math.abs(card.sum - card.total) < 1e-9 && /km başına/.test(card.grid) && /kWh/.test(card.grid), JSON.stringify(card).slice(0, 260));
  await p.click('#ccClose'); ok('L11 Kart kapatılır', await p.isHidden('#carcard'));
  await p.evaluate(() => { [...document.querySelectorAll('.mk-label')].filter(l => l.querySelector('.ln').textContent === 'Robovan 1')[0].click(); }); await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(300); ok('L12 Escape kartı kapatır', await p.isHidden('#carcard'));
  /* neden kartı */
  await p.evaluate(() => window.scrollTo(0, 0)); const why = await p.evaluate(() => ({ head: document.getElementById('whyHead').textContent, rows: document.querySelectorAll('#whyItems .wy').length, rank: document.querySelectorAll('#whyRank .rk').length, models: window.__last.order.length, win: window.__last.vehicles[window.__last.order.sort((a, b) => window.__last.vehicles[a].perKm - window.__last.vehicles[b].perKm)[0]].name }));
  ok('L13 "Neden bu sonuç?": kazanan tür, km başına fark, en büyük kalem; 3 kalem satırı; sıralama = tür sayısı', why.head.startsWith(why.win) && /km başına \$/.test(why.head) && /kaleminde/.test(why.head) && why.rows === 3 && why.rank === why.models, JSON.stringify(why).slice(0, 200));
  /* what-if */
  const before = await p.evaluate(() => ({ big: document.getElementById('rBig').textContent, s: window.__last.kpi.annualSaving, fuel: window.__app.cfg().fleet[1].params.fuel }));
  await p.click('[data-wi="fuel"]'); await p.waitForTimeout(500);
  const w1 = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(window.__app.cfg())); c.fleet.forEach(v => { if (v.category === 'conventional') v.params.fuel *= 1.2; }); const e = window.RobovanEngine.analyze(c, { roadKm: window.__app.routeInfo().km }); return { big: document.getElementById('rBig').textContent, s: window.__last.kpi.annualSaving, exp: e.kpi.annualSaving, fuel: window.__app.cfg().fleet[1].params.fuel, res: document.getElementById('wiRes').innerText.replace(/\n/g, ' '), foot: document.getElementById('rFoot').textContent }; });
  ok('L14 What-if "Dizel +%20": sonuç motorla aynı, yıllık fark artar, girdiğiniz değer değişmez, ana senaryo ile karşılaştırma görünür', Math.abs(w1.s - w1.exp) < 1e-6 && w1.s > before.s && w1.fuel === before.fuel && /Ana senaryoda/.test(w1.res) && /What-if aktif/.test(w1.foot), JSON.stringify([before.s, w1.s, w1.res]).slice(0, 220));
  await p.click('[data-wi="ratio"]'); await p.waitForTimeout(400); const w2 = await p.evaluate(() => window.__last.kpi.annualSaving); await p.click('[data-wi="fuel"]'); await p.click('[data-wi="ratio"]'); await p.waitForTimeout(500);
  const w3 = await p.evaluate(() => window.__last.kpi.annualSaving);
  ok('L15 Çipler birlikte çalışır (operatör 1/10 farkı artırır); kapatınca ana sonuca dönülür', w2 > w1.s && Math.abs(w3 - before.s) < 1e-6, JSON.stringify([before.s, w1.s, w2, w3]));
  await p.click('[data-wi="price"]'); await p.waitForTimeout(400); const be = await p.evaluate(() => document.getElementById('rFoot').textContent); ok('L16 "Robovan fiyatı −%10" geri ödeme süresini günceller', /Geri ödeme/.test(be) && /What-if aktif/.test(be), be); await p.click('[data-wi="price"]');
  await p.reload(); await p.waitForTimeout(800); ok('L17 Seçili what-if yenilemede korunur', await (async () => { await p.click('[data-wi="driver"]'); await p.waitForTimeout(500); await p.reload(); await p.waitForTimeout(900); return (await p.getAttribute('[data-wi="driver"]', 'aria-pressed')) === 'true'; })());
  ok('L18 Sayfa hatası yok', errs.length === 0, errs.join(';')); await ctx.close();
  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('KALDI')).length; console.log(out.length + ' kontrol, ' + bad + ' kalan'); await b.close(); process.exit(bad ? 1 : 0);
})();
