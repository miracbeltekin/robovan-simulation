/* Nihai kararlar: iki araç, araç ekleme/karşılaştırma, saat/hız, eşzamanlı hareket, canlı maliyet, taşıma, yazı tipi. */
const { chromium } = require('playwright');
const H = require('./helpers');
const url = 'file://' + process.argv[2];
const out = []; const ok = (n, c, x) => out.push((c ? 'GEÇTİ ' : 'KALDI ') + n + (x ? ' — ' + x : ''));
(async () => {
  const b = await chromium.launch({ args: H.ARGS });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ctx);
  const p = await ctx.newPage(); const errs = [], ext = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  p.on('request', r => { const u = r.url(); if (H.isExt(u)) ext.push(new URL(u).host); });
  await p.goto(url); await H.waitMap(p); await H.waitPlan(p);
  const sim = () => p.evaluate(() => window.__app.sim());
  const dbg = () => p.evaluate(() => window.RobovanMap.debug());
  /* ---- 1. yalnız iki araç ---- */
  ok('K1 Başlangıçta yalnızca iki araç: Robovan ve Geleneksel Van', await p.evaluate(() => { const f = window.__app.cfg().fleet; return f.length === 2 && f[0].name === 'Robovan' && f[1].name === 'Geleneksel Van'; }) && (await p.locator('#selA option').count()) === 2 && (await p.locator('#vl-robovan .vcard').count()) === 1 && (await p.locator('#vl-conventional .vcard').count()) === 1);
  ok('K2 "Elektrikli Van" hiçbir yerde yok (arayüz metni, seçenekler, motor)', !(await p.evaluate(() => document.body.innerText + document.documentElement.innerHTML.slice(0, 400000))).match(/Elektrikli Van|Elektrikli van|baseEv/));
  ok('K3 Araçlar farklı kategori: elektrikli/L4 otonom ve dizel/sürücülü', await p.evaluate(() => { const t = document.getElementById('vl-robovan').innerText + document.getElementById('vl-conventional').innerText; return /Robovan kategorisi · elektrikli · L4 otonom, uzaktan operatör/.test(t) && /Geleneksel Van kategorisi · dizel · sürücülü/.test(t); }));
  /* ---- 2. saat, hız çarpanları ---- */
  ok('K4 Simülasyon saati 06:00 ve süre 0 ile başlar', (await p.textContent('#clock')) === '06:00' && (await p.textContent('#elapsed')) === '0 sa 00 dk' && (await p.textContent('#hudClock')) === '06:00');
  const rate = async (sp) => { await p.evaluate(() => window.__app.reset()); await p.click(`[data-sp="${sp}"]`); await p.click('#pp'); await p.waitForTimeout(3000); const t = (await sim()).t; await p.click('#pp'); return t; };
  const t1 = await rate(1), t3 = await rate(3), t6 = await rate(6);
  ok('K5 ×1/×3/×6 hız oranı ≈ 1:3:6 (yalnız zamanın akışı)', t1 > 0 && Math.abs(t3 / t1 - 3) < 0.9 && Math.abs(t6 / t1 - 6) < 1.8, JSON.stringify([t1, t3, t6].map(x => +x.toFixed(2))));
  await p.evaluate(() => window.__app.reset()); await p.click('[data-sp="3"]'); await p.click('#pp'); await p.waitForTimeout(1200); await p.click('#pp'); const tp = (await sim()).t; await p.waitForTimeout(800);
  ok('K6 Duraklat: zaman donar', Math.abs((await sim()).t - tp) < 1e-9 && tp > 0 && (await p.textContent('#pp')) === '▶');
  await p.click('#pp'); await p.waitForTimeout(1200); await p.click('#pp'); ok('K7 Devam: kaldığı yerden sürer', (await sim()).t > tp);
  await p.click('#rs'); ok('K8 Sıfırla: 06:00, sayaçlar 0, duruyor', (await sim()).t === 0 && !(await sim()).playing && (await p.textContent('#clock')) === '06:00' && (await p.textContent('#hudRows')).includes('0,0 km'));
  await p.evaluate(() => window.__app.setSim(60)); ok('K9 Simülasyon saati 06:00 + geçen süre (60 dk → 07:00)', (await p.textContent('#clock')) === '07:00' && (await p.textContent('#elapsed')) === '1 sa 00 dk');
  /* ---- 3. iki araç eşzamanlı, görünür ve ayrı ---- */
  await p.evaluate(() => window.__app.reset()); await p.click('[data-sp="6"]'); await p.click('#pp'); await p.waitForTimeout(1500); const s1 = await dbg(); await p.waitForTimeout(2000); const s2 = await dbg(); await p.click('#pp');
  const pa = s1.pos['robovan:0'], pb = s1.pos['conventional:0'], pa2 = s2.pos['robovan:0'], pb2 = s2.pos['conventional:0'];
  ok('K10 İki türün ilk araçları aynı anda hareket ediyor', pa && pb && (pa2.lng !== pa.lng || pa2.lat !== pa.lat) && (pb2.lng !== pb.lng || pb2.lat !== pb.lat), JSON.stringify([pa, pa2, pb, pb2]));
  ok('K11 Araçların kendi hızı var: aynı anda farklı konumda (Robovan 40, Dizel 45 km/sa)', Math.hypot(pa2.lng - pb2.lng, pa2.lat - pb2.lat) > 1e-4, JSON.stringify([pa2, pb2]));
  const labels = await p.$$eval('.mk-label', ls => ls.filter(l => l.style.display !== 'none').map(l => { const r = l.getBoundingClientRect(); return { t: l.textContent, c: getComputedStyle(l.firstChild).backgroundColor, l: r.left, tp: r.top, r: r.right, b: r.bottom }; }));
  const ov = labels.some((x, i) => labels.some((y, j) => j > i && !(x.r <= y.l || y.r <= x.l || x.b <= y.tp || y.b <= x.tp)));
  ok('K12 Etiketler görünür (her etikette canlı $ tutar), iki ayrı renk, üst üste binmiyor', labels.length >= 2 && new Set(labels.map(x => x.c)).size >= 2 && labels.every(x => /\$[\d.]+,\d\d/.test(x.t)) && !ov, JSON.stringify(labels.map(x => x.t)));
  const v3 = (await dbg()).van.vehicles; ok('K13 3D katmanda iki ayrı model (Robovan + Geleneksel Van), ayrı renk, yanal ayrım (görsel)', v3.length >= 2 && v3.some(v => v.type === 'robovan') && v3.some(v => v.type === 'conventional') && new Set(v3.map(v => v.color)).size === 2 && new Set(v3.map(v => v.off + '/' + v.offY + '/' + v.lng)).size === v3.length, JSON.stringify(v3.map(v => [v.id, v.off, v.offY])));
  /* başlangıçta aynı noktadayken de gizlenmiyor */
  await p.evaluate(() => window.__app.setSim(0)); await p.waitForTimeout(300); const v0 = (await dbg()).van.vehicles; ok('K14 Başlangıçta (aynı nokta) her araç ayrı yanal konumda: biri diğerini örtmez', v0.length >= 2 && new Set(v0.map(x => x.off + '/' + x.offY)).size === v0.length, JSON.stringify(v0.map(x => [x.off, x.offY])));
  /* ---- 4. canlı değerler motorla tutarlı (tüm gün, filo) ---- */
  const chk = await p.evaluate(() => { const r = window.__last, L = window.__app.live(), res = []; const end = L.endMin;
    [0.13, 0.5, 0.97, 1.01].forEach(f => { window.__app.setSim(end * f); const ms = L.modelsAt(Math.min(end, end * f)); ms.forEach(m => { const v = r.vehicles[m.id], day = v.fleet / r.config.scenario.days; res.push([f, m.id, Math.abs(m.total - (m.cost.energy + m.cost.maint + m.cost.fixed + m.cost.people + m.cost.dep + m.cost.fin)) < 1e-9, m.total <= day + 1e-9, f < 1 || Math.abs(m.total - day) < 1e-6 * day]); }); });
    return res; });
  ok('K15 Canlı kalem toplamı = filo maliyeti; gün sonunda = motorun günlük filo maliyeti (yıllık ÷ gün), 4 zaman noktası', chk.every(r => r[2] && r[3] && r[4]), JSON.stringify(chk.filter(r => !(r[2] && r[3] && r[4]))));
  await p.evaluate(() => window.__app.setSim(window.__app.sim().end)); await p.waitForTimeout(250);
  const hudEnd = await p.textContent('#hudRows'), dayTot = await p.evaluate(() => ['robovan', 'conventional'].map(k => (window.__last.vehicles[k].fleet / window.__last.config.scenario.days).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })));
  ok('K16 Gün sonunda harita paneli = motorun günlük filo maliyeti (ekranda)', dayTot.every(v => hudEnd.includes('$' + v)), hudEnd.replace(/\n/g, ' ') + ' | ' + dayTot);
  const kmEnd = await p.evaluate(() => { const r = window.__last, sc = r.config.scenario; return ['robovan', 'conventional'].map(k => (r.vehicles[k].tripKm * sc.demand).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })); }); ok('K17 Gün sonunda km = günlük sefer × sefer mesafesi', kmEnd.every(k => hudEnd.includes(k + ' km')), kmEnd.join());
  const diffEnd = await p.textContent('#liveDiff'); ok('K18 "Gün sonu fark" = iki aracın motor günlük filo maliyeti farkı', await p.evaluate((t) => { const r = window.__last, d = (r.vehicles[r.kpi.b].fleet - r.vehicles[r.kpi.a].fleet) / r.config.scenario.days; return t.includes('$' + d.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }, diffEnd), diffEnd.replace(/\n/g, ' '));
  ok('K19 Bugünkü birikim ve yıllık filo ayrı etiketli ("Canlı sefer", "Yıllık filo")', (await p.textContent('#barCard')).includes('Canlı sefer') && (await p.textContent('#barCard')).includes('Yıllık filo') && (await p.evaluate(() => { document.querySelector('[data-bm="live"]').click(); return document.getElementById('barNote').textContent; })).includes('yıllık filo maliyeti değildir'));
  /* hız çarpanı toplamı değiştirmez */
  const tot = async (sp) => { await p.click(`[data-sp="${sp}"]`); await p.evaluate(() => window.__app.setSim(window.__app.sim().end)); return p.evaluate(() => window.__app.live().modelsAt(window.__app.sim().end).map(s => s.total)); };
  const a1 = await tot(1), a6 = await tot(6); ok('K20 Hız çarpanı toplam maliyeti değiştirmez', JSON.stringify(a1) === JSON.stringify(a6));
  await p.click('[data-sp="1"]');
  /* ---- 5. çubuk grafik: 3 görünüm, motor verisi, parametreye canlı tepki ---- */
  ok('K21 7 günlük grafik yok; araç maliyet çubukları ve 3 görünüm var', (await p.locator('#barCard [data-bm]').count()) === 3 && !(await p.evaluate(() => /7 gün|Son 7/i.test(document.body.innerText))));
  await p.click('[data-bm="year"]'); const e0 = await p.$eval('#costBars .cb:first-child .cb-bar .sg', e => e.getBoundingClientRect().width);
  await p.keyboard.press('Escape').catch(() => {}); await p.locator('[data-f="sl.elec"]').fill('0,6'); await p.waitForTimeout(250); const e1 = await p.$eval('#costBars .cb:first-child .cb-bar .sg', e => e.getBoundingClientRect().width);
  ok('K22 Elektrik fiyatı değişince Robovan enerji dilimi anında büyür (canlı)', e1 > e0 * 1.5, `${e0.toFixed(1)} → ${e1.toFixed(1)} px`); await p.locator('[data-f="sl.elec"]').fill('0,15'); await p.click('[data-bm="live"]');
  /* ---- 6. araç ekleme / çoğaltma / silme / karşılaştırma / limit ---- */
  await p.click('#myNums'); await p.click('[data-st="robovan"]'); await p.click('#addRobo'); await p.waitForTimeout(150);
  ok('K23 Robovan modeli eklendi: 3 araç, ayrı parametre seti, yeni renk', await p.evaluate(() => { const f = window.__app.cfg().fleet; return f.length === 3 && f[2].category === 'robovan' && f[2].id !== 'robovan' && f[2].color !== f[0].color && f[2].params !== f[0].params; }) && (await p.locator('#vl-robovan .vcard').count()) === 2);
  const nid = await p.evaluate(() => window.__app.cfg().fleet[2].id);
  await p.fill(`[data-name="${nid}"]`, 'Robovan Pro'); await p.fill(`[data-model="${nid}"]`, 'Marka X · Model 2'); await p.locator(`[data-f="v.${nid}.price"]`).fill('120000'); await p.click('[data-st="adv"]'); await p.evaluate(() => document.querySelectorAll('#vl-adv details').forEach(d => { d.open = true; })); await p.locator(`[data-f="v.${nid}.speed"]`).fill('55'); await p.click('[data-st="robovan"]');
  ok('K24 Yeni modelin değerleri yalnız kendisini değiştirir (ana Robovan 85.000 kalır)', await p.evaluate((id) => { const f = window.__app.cfg().fleet; return f[0].params.price === 85000 && f[2].params.price === 120000 && f[2].params.speed === 55 && f[2].name === 'Robovan Pro'; }, nid));
  await p.keyboard.press('Escape'); await p.selectOption('#selA', nid); await p.waitForTimeout(250);
  ok('K25 Farklı model karşılaştırılabilir: Robovan Pro ↔ Geleneksel Van; sonuç motorla aynı', await p.evaluate((id) => { const r = window.__last; return r.kpi.a === id && r.kpi.b === 'conventional' && Math.abs(r.kpi.annualSaving - (r.vehicles.conventional.fleet - r.vehicles[id].fleet)) < 1e-6; }, nid) && (await p.textContent('#rLbl')).includes('Robovan Pro'));
  ok('K26 Çubuklar, sıralama, grafik 3 aracı gösteriyor', (await p.locator('#costBars .cb').count()) === 3 && (await p.locator('#cmpGrid .cm-h').count()) === 3 && (await p.locator('#chCum svg path[fill="none"]').count()) >= 3 && (await p.locator('#table thead th').count()) === 4);
  await p.waitForTimeout(500); const vm = (await dbg()).van.vehicles; ok('K27 Haritada tüm filo (3 model, her biri kendi araç sayısıyla) ayrı renk ve ayrımla', vm.length === (await p.evaluate(() => window.__last.order.reduce((a, id) => a + window.__last.vehicles[id].n, 0))) && new Set(vm.map(v => v.color)).size === 3 && new Set(vm.map(v => v.off + '/' + v.offY + '/' + v.lng)).size === vm.length, JSON.stringify(vm.map(v => [v.id, v.color, v.off])));
  await p.click('#myNums'); await p.click('[data-st="conventional"]'); await p.click('#addConv'); await p.click('[data-st="robovan"]'); await p.click(`[data-dup="${nid}"]`); await p.waitForTimeout(100);
  ok('K28 Çoğalt + ekle: 5 araç; "(kopya)" adı ve aynı değerler', await p.evaluate(() => { const f = window.__app.cfg().fleet; return f.length === 5 && /kopya/.test(f[4].name) && f[4].params.price === 120000; }));
  await p.click('#addRobo'); await p.waitForTimeout(100); await p.click('[data-st="conventional"]'); ok('K29 6 araca çıkılır, sonra ekleme düğmeleri kapanır', (await p.evaluate(() => window.__app.cfg().fleet.length)) === 6 && (await p.isDisabled('#addRobo')) && (await p.isDisabled('#addConv')) && (await p.evaluate(() => document.getElementById('fleetCount').textContent)).trim() === '6 / 6 araç');
  ok('K30 6 araçla analiz geçerli, hata yok', await p.evaluate(() => window.__last.ok && window.__last.order.length === 6) && errs.length === 0, errs.join(';'));
  await p.click('[data-st="robovan"]'); await p.click(`[data-rm="${nid}"]`); await p.waitForTimeout(150);
  ok('K31 Karşılaştırmadaki araç silinince seçim otomatik düzelir (A≠B, ikisi de mevcut)', await p.evaluate(() => { const c = window.__app.cfg(), ids = c.fleet.map(v => v.id); return c.fleet.length === 5 && ids.includes(c.compare.a) && ids.includes(c.compare.b) && c.compare.a !== c.compare.b && window.__last.ok; }));
  /* ---- 7. kalıcılık ---- */
  await p.waitForTimeout(500); const before = await p.evaluate(() => JSON.stringify(window.__app.cfg().fleet.map(v => [v.id, v.name, v.model, v.color, v.params.price])));
  await p.reload(); await p.waitForTimeout(700); const after = await p.evaluate(() => JSON.stringify(window.__app.cfg().fleet.map(v => [v.id, v.name, v.model, v.color, v.params.price])));
  ok('K32 Yenileme sonrası tüm araçlar ve özel değerler korunur', before === after && JSON.parse(after).length === 5, after.slice(0, 160));
  /* ---- 8. v2 → v3 taşıma ---- */
  const mk = async (ev) => { const c2 = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.blockAllExternal(c2); const q = await c2.newPage(); const cfg = { scenario: { days: 280, demand: 10, stops: 4, loadMin: 10, loadPct: 70, rate: 8, horizon: 5, fleet: 0, roadFactor: 1.3, roundTrip: true }, vehicles: { robo: { price: 91000, infra: 5000, residual: 20, life: 8, eng: 15000, kwh100: 18, elec: 0.15, eff: 90, chargeKw: 22, range: 230, maint: 0.05, tire: 0.01, ins: 2500, tax: 0, lic: 250, operator: 1800, ratio: 5, shiftH: 8, payload: 1800, speed: 40, hours: 20 }, ice: { price: 38000, infra: 0, residual: 25, life: 8, l100: 9, fuel: 1.8, maint: 0.08, tire: 0.02, ins: 2200, tax: 500, driver: 1500, shiftH: 8, payload: 1500, speed: 45, hours: 8 }, ev }, route: { mode: 'manual', manualKm: 20, waypoints: [] }, base: 'ev' };
    await q.addInitScript((c) => { try { if (!localStorage.getItem('robovan-sim-ui-v3')) localStorage.setItem('robovan-sim-ui-v2', JSON.stringify({ cfg: c, ui: { cur: '€' }, raw: {} })); } catch (e) {} }, cfg); await q.goto(url); await q.waitForTimeout(1500); const r = await q.evaluate(() => ({ f: window.__app.cfg().fleet.map(v => [v.id, v.name, v.params.price, v.params.fuel]), d: window.__app.cfg().scenario.demand, days: window.__app.cfg().scenario.days, mode: window.__app.cfg().route.mode, cur: document.getElementById('cur').value, ok: window.__last && window.__last.ok })); await c2.close(); return r; };
  const OLD_EV = { price: 55000, infra: 3000, residual: 22, life: 8, kwh100: 20, elec: 0.15, eff: 90, chargeKw: 11, range: 200, maint: 0.05, tire: 0.02, ins: 2300, tax: 300, driver: 1500, shiftH: 8, payload: 1200, speed: 45, hours: 8 };
  const m1 = await mk(OLD_EV); ok('K33 Eski kayıt (dokunulmamış Elektrikli Van): 2 araç, kullanıcı değişiklikleri (91.000 / 1,8 / 10 sefer / 280 gün / elle 20 km / €) korunur', m1.f.length === 2 && m1.f[0][2] === 91000 && m1.f[1][3] === 1.8 && m1.d === 10 && m1.days === 280 && m1.mode === 'manual' && m1.cur === '€' && m1.ok, JSON.stringify(m1));
  const m2 = await mk({ ...OLD_EV, price: 60000 }); ok('K34 Eski kayıt (değiştirilmiş Elektrikli Van): veri kaybı yok, özel araç olarak korunur', m2.f.length === 3 && m2.f[2][2] === 60000 && /Özel Van/.test(m2.f[2][1]) && m2.ok, JSON.stringify(m2.f));
  /* ---- 9. yazı tipi ---- */
  const fonts = await p.evaluate(async () => { await document.fonts.ready; return { body: getComputedStyle(document.body).fontFamily, load500: document.fonts.check("500 14px 'Inter Tight'"), faces: [...document.fonts].filter(f => f.family.replace(/"/g, '') === 'Inter Tight').map(f => f.weight + ':' + f.status), tr: document.fonts.check("400 14px 'Inter Tight'", 'ğüşıİöç') }; });
  ok('K35 Yazı tipi Inter Tight, dosyaya gömülü; yalnız 400/500/600; Türkçe karakterler yüklü', /^"?Inter Tight/.test(fonts.body) && fonts.faces.length === 6 && fonts.load500 && fonts.tr && fonts.faces.every(x => /^(400|500|600):/.test(x)), JSON.stringify(fonts));
  ok('K36 Yazı tipi için dış istek yok (yalnız izinli harita/rota servisleri)', ext.every(h => H.ALLOWED.includes(h)), [...new Set(ext)].join(','));
  ok('K37 Tüm akışta sayfa hatası yok', errs.length === 0, errs.join(';'));
  await ctx.close();
  /* ---- 10. harita/servis çökse de hesap + saat çalışır ---- */
  const c3 = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.blockAllExternal(c3); const q = await c3.newPage(); await q.goto(url); await q.waitForTimeout(2500);
  await q.click('[data-sp="6"]'); await q.click('#pp'); await q.waitForTimeout(1500); await q.click('#pp'); const tq = await q.evaluate(() => window.__app.sim().t);
  ok('K38 Harita açılamazsa: hesap, saat ve canlı maliyet çalışır', tq > 0 && (await q.textContent('#hudRows')).includes('$') && (await q.textContent('#tlTxt')).includes('harita açılamadı'));
  await c3.close();
  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('KALDI')).length; console.log(out.length + ' kontrol, ' + bad + ' kalan'); await b.close(); process.exit(bad ? 1 : 0);
})();
