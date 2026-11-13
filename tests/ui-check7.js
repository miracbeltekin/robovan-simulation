/* Araç sayısı: karar kartında [−] sayı [+], otomatik/elle, yetersizse uyarı, kalıcılık, taşıma, mobil. */
const { chromium, devices } = require('playwright'); const H = require('./helpers');
const url = /^https?:/.test(process.argv[2]) ? process.argv[2] : 'file://' + process.argv[2];
const out = []; const ok = (n, c, x) => out.push((c ? 'GEÇTİ ' : 'KALDI ') + n + (x ? ' — ' + x : ''));
(async () => {
  const b = await chromium.launch({ args: H.ARGS }); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ctx);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  await p.goto(url); await H.waitMap(p); await H.waitPlan(p); await p.click('#tcSkip').catch(() => {});
  const ns = () => p.$$eval('#fleetRow .fl output', o => o.map(x => +x.textContent));
  const info = () => p.evaluate(() => { const r = window.__last, v = window.__app.cfg().fleet; return { n: r.order.map(id => r.vehicles[id].n), counts: v.map(x => x.count), fleet: r.order.map(id => Math.round(r.vehicles[id].fleet)), cars: window.__app.live().cars.length, mapCars: window.RobovanMap.debug().van.vehicles.length, warns: document.getElementById('warns').innerText, big: document.getElementById('rBig').textContent }; });
  ok('C1 Karar kartında her aracın yanında [−] sayı [+] ve "otomatik" yazısı (Robovan 2, Geleneksel Van 4)', JSON.stringify(await ns()) === '[2,4]' && (await p.locator('#fleetRow .fl-m').allTextContents()).join() === 'otomatik,otomatik' && (await p.locator('#fleetRow .fl button').count()) === 4);
  const f0 = await info();
  await p.click('[data-fl="conventional"][data-d="1"]'); await p.waitForTimeout(500);
  let s = await info();
  ok('C2 Geleneksel Van [+]: 5 araç, "otomatiğe dön (4)", motor sonucu değişir, harita ve gün defteri 2+5 araç', s.n.join() === '2,5' && s.counts.join() === '0,5' && (await p.textContent('#fleetRow .fl-auto')).includes('(4)') && s.fleet[1] !== f0.fleet[1] && s.cars === 7 && s.mapCars === 7, JSON.stringify(s));
  ok('C3 Düğmeye bastıktan sonra odak aynı düğmede kalır (klavye ile ardı ardına basılabilir)', await p.evaluate(() => document.activeElement && document.activeElement.dataset.fl === 'conventional' && document.activeElement.dataset.d === '1'));
  ok('C4 HUD ve etiket yeni sayıyı gösterir (Geleneksel Van ×5)', (await p.textContent('#hudRows')).includes('Geleneksel Van ×5'));
  for (let i = 0; i < 4; i++) await p.click('[data-fl="conventional"][data-d="-1"]'); await p.waitForTimeout(500); s = await info();
  ok('C5 [−] ile 1 araca iner; 1\'de [−] pasif; "yetmiyor, gereken 4" uyarısı kartta ve uyarı listesinde, hesap sürer', s.n[1] === 1 && (await p.isDisabled('[data-fl="conventional"][data-d="-1"]')) && (await p.textContent('#fleetRow')).includes('yetmiyor, gereken 4') && s.warns.includes('yetmiyor') && /\$[\d.]+/.test(s.big), JSON.stringify(s).slice(0, 220));
  await p.click('[data-fl-auto="conventional"]'); await p.waitForTimeout(500); s = await info(); ok('C6 "Otomatiğe dön" sayıyı günlük sefere göre geri getirir (4) ve elle işaretini kaldırır', s.n.join() === '2,4' && s.counts.join() === '0,0' && (await p.locator('#fleetRow .fl-m').count()) === 2);
  /* motorla birebir: elle 6 */
  for (let i = 0; i < 2; i++) await p.click('[data-fl="conventional"][data-d="1"]'); await p.waitForTimeout(400);
  const eng = await p.evaluate(() => { const c = JSON.parse(JSON.stringify(window.__app.cfg())); const e = window.RobovanEngine.analyze(c, { roadKm: window.__app.routeInfo().km }); return [Math.round(e.vehicles.conventional.fleet), e.vehicles.conventional.n]; }); s = await info();
  ok('C7 Elle 6 araç: ekrandaki sonuç = motor (yıllık filo maliyeti)', s.n[1] === 6 && s.fleet[1] === eng[0], JSON.stringify([s.fleet, eng]));
  await p.evaluate(() => window.__app.setSim(window.__app.sim().end)); await p.waitForTimeout(300);
  const end = await p.evaluate(() => { const r = window.__last, dt = (id) => (r.vehicles[id].fleet / r.config.scenario.days).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return [dt('robovan'), dt('conventional'), document.getElementById('hudRows').innerText.replace(/\n/g, ' ')]; });
  ok('C8 Elle sayıyla gün sonu toplamı = motorun günlük filo maliyeti', end[2].includes('$' + end[0]) && end[2].includes('$' + end[1]), end.join(' | '));
  /* 12 araç: haritada en çok 8, not görünür */
  for (let i = 0; i < 6; i++) await p.click('[data-fl="conventional"][data-d="1"]'); await p.waitForTimeout(600); s = await info();
  ok('C9 12 araçta haritada en çok 8 (tür başına), hesap tüm 12 araçla; açıklama notu görünür', s.n[1] === 12 && s.mapCars === 2 + 8 && s.cars === 2 + 12 && (await p.isVisible('#cmpNote')), JSON.stringify([s.n, s.cars, s.mapCars]));
  /* kalıcılık */
  await p.waitForTimeout(400); await p.reload(); await p.waitForTimeout(900); ok('C10 Yenilemeden sonra elle sayılar korunur', JSON.stringify(await ns()) === '[2,12]' && (await info()).counts.join() === '0,12');
  /* karşılaştırma çifti değişince sayaçlar yeni çifti gösterir; Rakamlarım'da yinelenen alan yok */
  await p.click('#myNums'); await p.click('[data-st="adv"]'); ok('C11 Rakamlarım > Gelişmiş\'te eski "Robovan sayısını sabitle" alanı yok (araç sayısı tek yerde)', (await p.locator('#sp-adv [data-f="s.fleet"]').count()) === 0 && !(await p.textContent('#sp-adv')).includes('sabitle')); await p.keyboard.press('Escape');
  const sz = await p.evaluate(() => [...document.querySelectorAll('#fleetRow .fl button')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })); ok('C12 Düğmeler dokunmaya uygun (≥ 40 px)', sz.every(x => x[0] >= 40 && x[1] >= 40), JSON.stringify(sz));
  ok('C13 Sayfa hatası yok', errs.length === 0, errs.join(';')); await ctx.close();
  /* eski kayıt: scenario.fleet → Robovan sayısı */
  const mc = await b.newContext({ viewport: { width: 1440, height: 900 } }); if (/^https?:/.test(url)) await H.stubServices(mc); else await H.blockAllExternal(mc); const q = await mc.newPage();
  await q.addInitScript(() => { try { const E = null; localStorage.setItem('robovan-sim-ui-v3', JSON.stringify({ cfg: { scenario: { days: 300, demand: 8, stops: 4, loadMin: 10, loadPct: 70, rate: 8, horizon: 5, fleet: 3, roadFactor: 1.3, roundTrip: true }, fleet: [{ id: 'robovan', name: 'Robovan', model: '', category: 'robovan', color: '#1FC2AE', params: {} }, { id: 'conventional', name: 'Geleneksel Van', model: '', category: 'conventional', color: '#E2803F', params: {} }], route: { mode: 'manual', manualKm: 10, waypoints: [] }, compare: { a: 'robovan', b: 'conventional' } }, ui: {}, raw: {} })); } catch (e) {} });
  await q.goto(url); await q.waitForTimeout(1500);
  const mig = await q.evaluate(() => ({ n: window.__last.order.map(id => window.__last.vehicles[id].n), c: window.__app.cfg().fleet.map(v => v.count), f: window.__app.cfg().scenario.fleet })); ok('C14 Eski kayıttaki "Robovan sayısını sabitle: 3" araç sayısına taşınır (Robovan 3, elle)', mig.n[0] === 3 && mig.c[0] === 3 && mig.f === 0, JSON.stringify(mig)); await mc.close();
  /* mobil */
  const phone = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 664 } }); await H.stubServices(phone); const m = await phone.newPage(); await m.goto(url); await H.waitMap(m); await H.waitPlan(m); await m.click('#tcSkip').catch(() => {});
  await m.evaluate(() => document.getElementById('sumBar').click()); await m.waitForTimeout(700); await m.evaluate(() => document.getElementById('fleetRow').scrollIntoView()); await m.waitForTimeout(300);
  const geo = await m.evaluate(() => { const g = document.getElementById('fleetRow').getBoundingClientRect(), bs = [...document.querySelectorAll('#fleetRow .fl button')].map(x => x.getBoundingClientRect()); return { over: document.documentElement.scrollWidth - innerWidth, inside: bs.every(r => r.left >= g.left - 1 && r.right <= g.right + 1), n: bs.length }; });
  ok('C15 Mobilde sayaçlar kartın içinde, yatay taşma yok', geo.over <= 1 && geo.inside && geo.n === 4, JSON.stringify(geo));
  await m.click('[data-fl="robovan"][data-d="1"]'); await m.waitForTimeout(500); ok('C16 Mobilde dokununca Robovan 3 araç olur', (await m.$$eval('#fleetRow .fl output', o => o.map(x => +x.textContent))).join() === '3,4');
  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('KALDI')).length; console.log(out.length + ' kontrol, ' + bad + ' kalan'); await b.close(); process.exit(bad ? 1 : 0);
})();
