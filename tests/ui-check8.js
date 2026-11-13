/* Sadeleştirme: ana ekran 2 bölüm, yıllık çubuk, gizli karşılaştırma seçici, mobil açılır alt panel + özet çubuğu + ⋯ menüsü. */
const { chromium, devices } = require('playwright'); const H = require('./helpers');
const url = /^https?:/.test(process.argv[2]) ? process.argv[2] : 'file://' + process.argv[2];
const out = []; const ok = (n, c, x) => out.push((c ? 'GEÇTİ ' : 'KALDI ') + n + (x ? ' — ' + x : ''));
(async () => {
  const b = await chromium.launch({ args: H.ARGS });
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ctx); let p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await H.waitMap(p); await H.waitPlan(p);
  const cards = await p.evaluate(() => [...document.querySelectorAll('#panel > .card, #panel > details')].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id));
  ok('S1 Ana ekran (masaüstü) panelinde yalnızca: karar, yıllık maliyet, "Neyi değiştirebilirim?", katlı "Neden bu sonuç?"', cards.join() === 'resultCard,yearCard,ctrlCard,whyCard', cards.join());
  ok('S2 "Neden bu sonuç?" ve analiz kapalı gelir; "Detaylı analiz" düğmesi var', !(await p.evaluate(() => document.getElementById('whyCard').open)) && await p.isVisible('#goAnalysis'));
  ok('S3 Karşılaştırma seçici (A ile B) iki modelde gizli; araç sayısı düğmeleri görünür', (await p.isHidden('#pair')) && (await p.locator('#fleetRow .fl').count()) === 2);
  const yb = await p.evaluate(() => ({ n: document.querySelectorAll('#yearBars .cb').length, t: [...document.querySelectorAll('#yearBars .cb-t')].map(x => x.textContent.replace(/[^0-9]/g, '')), e: window.__last.order.map(id => String(Math.round(window.__last.vehicles[id].fleet))) }));
  ok('S4 Ana ekranda tek çubuk görünümü: yıllık filo (2 çubuk = motor değerleri); bugün/sefer başı seçenekleri ana panelde yok', yb.n === 2 && yb.t.join() === yb.e.join() && (await p.locator('#panel [data-bm]').count()) === 0, JSON.stringify(yb));
  ok('S5 Bugün / sefer başı / yıllık seçenekleri Detaylı Analiz > Özet içinde', (await p.locator('#pn-sum [data-bm]').count()) === 3);
  ok('S6 Çiplerin "Neyi değiştirebilirim?" kartında (tek yerde)', (await p.locator('#ctrlCard [data-wi]').count()) === 4 && (await p.locator('#wiCard').count()) === 0);
  ok('S7 İpucu kartı artık görünmez', await p.isHidden('#tipcard')); ok('S8 Mobil özet çubuğu ve ⋯ masaüstünde gizli', (await p.isHidden('#sumBar')) && (await p.isHidden('#moreBtn')));
  await ctx.close();
  /* mobil */
  ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 664 } }); await H.stubServices(ctx); p = await ctx.newPage(); await p.goto(url); await H.waitMap(p); await H.waitPlan(p); await p.waitForTimeout(800);
  const g = await p.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(), vh = innerHeight; return { map: r('#mapcard').height / vh, sbT: document.getElementById('sbT').textContent, sbV: document.getElementById('sbV').textContent, barTop: r('#sumBar').top, vh, over: document.documentElement.scrollWidth - innerWidth, mapbar: getComputedStyle(document.getElementById('mapbar')).display, panelVis: getComputedStyle(document.getElementById('ctrlCard')).visibility }; });
  ok('M1 Mobil: harita ekranın ~%75\'inden fazlası; alt panel kapalı, yalnızca özet çubuğu ("Robovan %51 daha ekonomik · $…/yıl")', g.map > 0.7 && /ekonomik/.test(g.sbT) && /\$[\d.]+\/yıl/.test(g.sbV) && g.vh - g.barTop <= 90 && g.over <= 1, JSON.stringify(g));
  ok('M2 Kapalı panelin içeriği gizli (tab ile odaklanmaz); harita düğmeleri ⋯ arkasında', g.panelVis === 'hidden' && g.mapbar === 'none');
  await p.click('#moreBtn'); await p.waitForTimeout(300); ok('M3 ⋯ ile 3D/Üstten/Tüm rota/Takip düğmeleri açılır ve tekrar kapanır', (await p.isVisible('[data-view="3d"]')) && (await (async () => { await p.click('#moreBtn'); await p.waitForTimeout(200); return p.isHidden('[data-view="3d"]'); })()));
  await p.click('#sumBar'); await p.waitForTimeout(700); const o = await p.evaluate(() => ({ exp: document.getElementById('sumBar').getAttribute('aria-expanded'), top: document.getElementById('panel').getBoundingClientRect().top, vh: innerHeight, fleet: getComputedStyle(document.getElementById('fleetRow')).visibility, h: document.getElementById('panel').getBoundingClientRect().height }));
  ok('M4 Özet çubuğuna dokununca panel açılır (ekranın ≤%88\'i), içerik görünür, aria-expanded=true', o.exp === 'true' && o.top < o.vh * 0.5 && o.h <= o.vh * 0.9 && o.fleet === 'visible', JSON.stringify(o));
  await p.click('#fleetRow [data-fl="robovan"][data-d="1"]'); await p.waitForTimeout(400); ok('M5 Açık panelde araç sayısı [+] çalışır (Robovan 3)', (await p.$$eval('#fleetRow .fl output', x => x.map(y => +y.textContent))).join() === '3,4');
  ok('M6 Açık panelde yatay taşma yok', (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1 && (await p.evaluate(() => document.getElementById('panel').scrollWidth <= document.getElementById('panel').clientWidth + 1)));
  await p.click('#goAnalysis'); await p.waitForTimeout(900); ok('M7 "Detaylı analiz" paneli kapatır ve analiz bölümüne kaydırır', (await p.getAttribute('#sumBar', 'aria-expanded')) === 'false' && (await p.evaluate(() => document.getElementById('analysis').getBoundingClientRect().top < innerHeight * 0.6)));
  await p.evaluate(() => window.scrollTo(0, 0)); await p.click('#sumBar'); await p.click('#sumBar'); ok('M8 Özet çubuğu aç/kapa döngüsü', (await p.getAttribute('#sumBar', 'aria-expanded')) === 'false');
  const fnt = await p.evaluate(() => ({ foot: getComputedStyle(document.querySelector('.foot')).paddingBottom })); ok('M9 Sayfa sonunda altta sabit çubuk için boşluk bırakılmış', parseFloat(fnt.foot) >= 90, JSON.stringify(fnt));
  ok('M10 Sayfa hatası yok', errs.length === 0, errs.join(';')); await ctx.close();
  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('KALDI')).length; console.log(out.length + ' kontrol, ' + bad + ' kalan'); await b.close(); process.exit(bad ? 1 : 0);
})();
