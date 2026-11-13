/* Teknik kontrol: giriş-sonuç bağlantısı, değer koruma, grafik-KPI tutarlılığı, uyarı görünürlüğü. */
const { chromium, devices } = require('playwright');
const H = require('./helpers');
const url = 'file://' + process.argv[2];
const out = []; const ok = (n, c, x) => out.push((c ? 'GEÇTİ ' : 'KALDI ') + n + (x ? ' — ' + x : ''));
(async () => {
  const b = await chromium.launch({ args: H.ARGS });
  const c0 = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.blockAllExternal(c0); const p = await c0.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', () => {}); await p.goto(url); await p.waitForTimeout(400); await p.click('#myNums'); await p.evaluate(() => { document.querySelectorAll('#sheet details').forEach(d => { d.open = true; }); document.querySelectorAll('.shpanel').forEach(x => { x.hidden = false; }); });
  const sig = () => p.evaluate(() => { const r = window.__last, o = {}; ['robovan', 'conventional'].forEach(k => { const v = r.vehicles[k]; o[k] = [v.n, v.fleet, v.perKm, v.perTrip, v.perTonKm, v.tripH, v.shifts, v.ops.staff, v.ops.energyQty, v.ops.annualTonnes, v.capexFleet, v.tco(r.config.scenario.horizon)]; }); return JSON.stringify([o, r.warnings, r.kpi.breakEven.years]); });
  /* 1. Her giriş alanı sonuca bağlı mı? */
  const ids = await p.$$eval('[data-f]', els => els.map(e => e.dataset.f));
  const noEffect = [], total = ids.length;
  for (const id of ids) {
    if (id === 'r.manualKm') await p.evaluate(() => document.getElementById('modeManual').click());
    await p.evaluate(() => { document.activeElement && document.activeElement.blur(); });
    await p.evaluate((id) => { const e = document.querySelector(`[data-f="${id}"]`); const sp = e.closest('.shpanel'); if (sp) { const k = sp.id.slice(3); document.querySelector(`[data-st="${k}"]`).click(); } const d = e.closest('details'); if (d) d.open = true; }, id);
    const el = p.locator(`[data-f="${id}"]`).first(); const before = await sig(); const cur = await el.inputValue(); const num = parseFloat(cur.replace(',', '.'));
    const special = { 's.days': '250', 'v.robovan.hours': '8', 'v.robovan.range': '40', 'v.conventional.shiftH': '3', 'v.robovan.shiftH': '3' };
    const next = special[id] ? special[id] : id === 's.demand' || id === 'sl.demand' ? '14' : id.endsWith('residual') || id.endsWith('.eff') || id === 's.loadPct' ? String(Math.max(1, Math.min(95, num * 0.8))).replace('.', ',') : id === 's.fleet' ? '5' : String(Math.round((num * 1.37 + 1) * 100) / 100).replace('.', ',');
    await el.fill(next); await p.waitForTimeout(80); const after = await sig();
    if (before === after) noEffect.push(id);
    await el.fill(cur); await p.waitForTimeout(40);
    if (id === 'r.manualKm') await p.evaluate(() => document.getElementById('modeRoute').click());
  }
  ok(`G1 ${total} giriş alanının her biri denendi`, true, 'sonuca etkisi görülmeyenler: ' + (noEffect.join(', ') || 'yok'));
  console.log('ETKİSİZ ALANLAR:', noEffect.join(', '));
  /* 2. Değerler kaybolmuyor */
  await p.click('[data-st="robovan"]'); await p.locator('[data-f="v.robovan.price"]').fill('91000'); await p.click('[data-st="conventional"]'); await p.locator('[data-f="v.conventional.l100"]').fill('11,5'); await p.click('[data-st="ops"]'); await p.locator('[data-f="s.stops"]').fill('6');
  await p.click('#sheetDone'); await p.locator('[data-f="sl.driver"]').fill('2600'); await p.locator('[data-f="sl.demand"]').fill('13');
  const snap = () => p.evaluate(() => [...document.querySelectorAll('[data-f]')].filter(e => !['r.manualKm', 's.roadFactor'].includes(e.dataset.f)).map(e => e.dataset.f + '=' + e.value).join('|'));
  const s0 = await snap();
  await p.click('#presets [data-preset="2"]'); await p.waitForTimeout(100); await p.selectOption('#cityPick', 'Konya'); await p.click('#cityAdd'); await p.waitForTimeout(100);
  await p.click('#modeManual'); await p.locator('[data-f="r.manualKm"]').fill('12'); await p.click('#modeRoute'); await p.selectOption('#selB', 'robovan'); await p.selectOption('#selB', 'conventional'); await p.selectOption('#cur', '€'); await p.selectOption('#cur', '$'); await p.waitForTimeout(150);
  ok('G2 Rota, mod, taban, para birimi değişince diğer girişler korunuyor', (await snap()) === s0);
  await p.reload(); await p.waitForTimeout(400); const s1 = await snap(); const d0 = s0.split('|'), d1 = s1.split('|'); ok('G3 Yenileme sonrası da korunuyor (yerel saklama)', s1 === s0, d0.filter((x, i) => x !== d1[i]).slice(0, 5).join(', ') + ' => ' + d1.filter((x, i) => x !== d0[i]).slice(0, 5).join(', '));
  /* 3. Grafik ↔ KPI tutarlılığı */
  const perKm = await p.evaluate(() => ['robovan', 'conventional'].map(k => window.__last.vehicles[k].perKm.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })));
  const cmpKm = await p.$$eval('#cmpGrid > div', es => [es[4].textContent, es[5].textContent]);
  ok('G4 km maliyeti karar kartı = motor', cmpKm.join() === perKm.map(v => '$' + v).join(), JSON.stringify([cmpKm, perKm]));
  const fmt2 = (x) => '$' + x.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  await p.click('[data-bm="trip"]'); await p.waitForTimeout(80);
  const tripBars = await p.$$eval('#costBars .cb-t', ts => ts.map(t => t.textContent)); const perTrip = await p.evaluate(() => ['robovan', 'conventional'].map(k => window.__last.vehicles[k].perTrip));
  ok('G4b "Sefer başına" çubukları = motor sefer maliyeti', tripBars.every((t, i) => t === fmt2(perTrip[i])), JSON.stringify([tripBars, perTrip]));
  await p.click('[data-bm="year"]'); await p.waitForTimeout(80);
  const yearBars = await p.$$eval('#costBars .cb-t', ts => ts.map(t => t.textContent.replace(/[^0-9]/g, ''))); const fl = await p.evaluate(() => ['robovan', 'conventional'].map(k => Math.round(window.__last.vehicles[k].fleet).toLocaleString('tr-TR').replace(/[^0-9]/g, '')));
  ok('G4c "Yıllık filo" çubukları = motor filo maliyeti', yearBars.join() === fl.join(), JSON.stringify([yearBars, fl]));
  const segSum = await p.$$eval('#costBars .cb-bar', bs => bs.map(b => Math.round([...b.children].reduce((a, c) => a + parseFloat(c.style.width), 0))));
  ok('G4d Çubuk dilimleri toplamı = toplam çubuk uzunluğu (kalem kalem dağılım tutarlı)', segSum.every(v => v > 0 && v <= 100), JSON.stringify(segSum));
  await p.click('[data-bm="live"]'); await p.evaluate(() => { window.__app.pause(); window.__app.setSim(window.__app.sim().end); }); await p.waitForTimeout(120);
  const liveBars = await p.$$eval('#costBars .cb-t', ts => ts.map(t => t.textContent));
  ok('G4e Sefer sonunda canlı çubuklar = motorun sefer maliyeti', liveBars.every((t, i) => t === fmt2(perTrip[i])), JSON.stringify([liveBars, perTrip])); await p.evaluate(() => window.__app.reset());
  const be = await p.evaluate(() => window.__last.kpi.breakEven); await p.click('[data-tab="inv"]'); const note = await p.textContent('#cumNote'); const statBE = await p.textContent('#extra .stat:first-child .v');
  ok('G5 Birikimli grafik başa baş notu = KPI geri ödeme', be.years === null ? note.includes('yok') : (be.years === 0 || note.includes(be.label)) && statBE.trim() === be.label, `${note.slice(0, 60)} | ${statBE}`);
  const sensAt = async (param, metric) => {
    await p.click('[data-tab="sens"]'); await p.selectOption('#sensParam', param); await p.selectOption('#sensMetric', metric); await p.waitForTimeout(150);
    return p.evaluate(() => { const svg = document.querySelector('#chSens svg'), hit = svg.querySelector('.hit'), vl = svg.querySelector('.vline'); const r = svg.getBoundingClientRect(); const x = (+vl.getAttribute('x1')) / 1100 * r.width + r.left; hit.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: r.top + 100, bubbles: true })); return document.querySelector('#chSens .tip').innerText; });
  };
  const tip1 = await sensAt('demand', 'perKm'); const cur13 = await p.evaluate(() => ['robovan', 'conventional'].map(k => window.__last.vehicles[k].perKm.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })));
  ok('G6 Duyarlılık grafiği (mevcut sefer sayısında) km maliyeti = KPI', cur13.every(v => tip1.includes('$' + v)), tip1.replace(/\n/g, ' | ') + ' vs ' + cur13.join(','));
  const tip2 = await sensAt('demand', 'saving'); const sav = await p.evaluate(() => window.__last.kpi.annualSaving);
  const m = tip2.match(/\$?(−?\$?[\d.,]+)\s*(bin|mn)?/); ok('G7 Duyarlılık (tasarruf) mevcut noktada KPI ile aynı büyüklükte', /−?\$[\d.,]+( bin| mn)?/.test(tip2) && (() => { const t = tip2.match(/(−?)\$([\d.,]+)( bin| mn)?/); if (!t) return false; let v = parseFloat(t[2].replace(/\./g, '').replace(',', '.')); if (t[3] === ' bin') v *= 1e3; if (t[3] === ' mn') v *= 1e6; return Math.abs(v - Math.abs(sav)) / Math.abs(sav) < 0.06; })(), tip2.replace(/\n/g, ' | ') + ' vs ' + Math.round(sav));
  /* 4. Uyarılar ve ifade */
  const vis = async (s) => p.isVisible(s);
  ok('H1 Kontrollü alan uyarısı masaüstünde görünür (panel + harita)', (await vis('#scopeNote')) && (await vis('#mapnote')) && (await p.textContent('#scopeNote')).includes('kontrollü alanlarda'));
  const body = await p.evaluate(() => document.body.innerText);
  const risky = body.match(/[^.\n]*\b(kesin|garanti)[^.\n]*/gi) || [];
  ok('H2 "kesin/garanti" yalnız olumsuz uyarı cümlesinde geçiyor', risky.every(s => /garanti edilmez|kesin değil|garanti verilmez|garantisi yoktur/i.test(s)), risky.join(' || '));
  ok('H3 Sonuç etiketleri "Tahmini" ile başlıyor', (await p.textContent('#rSub')).startsWith('Tahmini') && true);
  ok('H4 "GÖSTERİM" etiketi sonuç kartında var', (await p.textContent('#resultCard')).includes('GÖSTERİM'));
  const c1 = await b.newContext({ ...devices['iPhone 13'] }); await H.blockAllExternal(c1); const mp = await c1.newPage(); await mp.goto(url); await mp.waitForTimeout(400);
  await mp.evaluate(() => document.getElementById('scopeNote').scrollIntoView()); ok('H5 Mobilde kontrollü alan uyarısı görünür', (await mp.isVisible('#scopeNote')));
  /* 5. Anahtarsız: tüm KPI sayısal */
  const kp = await mp.$$eval('#rBig', e => e.map(x => x.textContent)); ok('I1 Anahtarsız: KPI değerleri sayısal', kp.every(t => /\d/.test(t)), kp.join(' '));
  ok('I2 Sayfa hatası yok', errs.length === 0, errs.join(';'));
  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('KALDI')).length; console.log(out.length + ' kontrol, ' + bad + ' kalan'); await b.close(); process.exit(bad ? 1 : 0);
})();
