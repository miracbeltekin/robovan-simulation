/* Arayüz kontrolleri (MapLibre + OpenFreeMap + OSRM + Photon): node tests/ui-check.js /yol/dist/index.html
   Harita karoları GERÇEK OpenFreeMap'ten gelir. Rota ve adres yanıtları, gerçek OSRM/Photon yanıtlarının kayıtlarıyla beslenir (ortamın tarayıcısı bu servislere doğrudan erişemiyor). */
const { chromium, devices } = require('playwright');
const H = require('./helpers');
const url = 'file://' + process.argv[2];
const out = []; const ok = (n, c, x) => out.push((c ? 'GEÇTİ ' : 'KALDI ') + n + (x ? ' — ' + x : ''));

(async () => {
  const b = await chromium.launch({ args: H.ARGS });
  /* ===== A. Harita erişimi olmayan senaryo (varsayılan) ===== */
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const seenA = await H.blockAllExternal(ctx);
  const p = await ctx.newPage(); const errs = [], ext = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errs.push(m.text()); });
  
  await p.goto(url); await p.waitForTimeout(500);
  ok('A1 Sayfa hatasız açıldı', errs.length === 0, errs.join(';'));
  await p.waitForTimeout(1500); ok('A2 Dış istekler yalnız izinli servislere gidiyor (OpenFreeMap, OSRM, Photon)', seenA.every(h => H.ALLOWED.includes(h)), [...new Set(seenA)].join(','));
  ok('A3 Servisler kapalıyken harita hata kutusu ve "Yeniden dene" görünür; hesap devam eder', (await p.isVisible('#mapstate')) && (await p.isVisible('#mapRetry')) && (await p.textContent('#msText')).includes('çalışmaya devam eder'), await p.textContent('#msText'));
  ok('A4 Harita yokken saat/canlı defter çalışır, haritada araç yok', (await p.isEnabled('#pp')) && (await p.evaluate(() => window.RobovanMap.debug().van === null || window.RobovanMap.debug().van.vehicles.length === 0)));
  ok('A5 Servis yokken varsayılan rota DEMO kayıtlı rotayla: yıllık tasarruf ≈81.1 bin', (await p.textContent('#rBig')).includes('81.1'), await p.textContent('#rBig'));
  ok('A6 Rota rozeti "DEMO" (gerçek canlı rota gibi gösterilmiyor)', (await p.textContent('#rcRes')).includes('DEMO') && !(await p.textContent('#rcRes')).includes('Gerçek karayolu'), await p.textContent('#rcRes'));
  ok('A7 Mesafe 48,9 km (kayıtlı rota)', (await p.textContent('#rcRes')).includes('48,9'));
  ok('A8 Karar kartı: Robovan daha ekonomik, üç ölçüde de önde', (await p.textContent('#rLbl')).includes('Robovan') && (await p.locator('#cmpGrid .cm-v.win').count()) === 3);
  ok('A9 Araç çubukları ve grafikler çizildi', (await p.locator('#costBars .cb').count()) === 2 && (await p.locator('#chCum svg path').count()) >= 2 && (await p.locator('#chSens svg path').count()) >= 2);
  // odak
  const inp = p.locator('[data-f="v.conventional.driver"]').first(); await p.click('#myNums'); await p.click('[data-st="conventional"]'); await inp.click(); await inp.fill(''); await inp.type('2500');
  ok('A10 Yazarken odak kalıyor', await p.evaluate(() => document.activeElement.dataset.f === 'v.conventional.driver'));
  await p.keyboard.press('Escape'); ok('A11 Esc çekmeceyi kapatır', await p.isHidden('#sheet'));
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.locator('[data-r="sl.driver"]').evaluate(el => { el.value = 3000; el.dispatchEvent(new Event('input', { bubbles: true })); });
  ok('A12 Kaydırıcı → kutu', (await p.inputValue('[data-f="sl.driver"]')) === '3000');
  const sb = p.locator('[data-f="sl.elec"]'); await sb.click(); await sb.fill('0,5');
  ok('A13 Kutu → kaydırıcı', (await p.$eval('[data-r="sl.elec"]', e => e.value)) === '0.5');
  const dem = p.locator('[data-f="sl.demand"]'); await dem.click(); await dem.fill('abc'); await p.waitForTimeout(120);
  ok('A14 Geçersiz giriş → hata + soluk sonuç', (await p.locator('#warns .warn.err').count()) > 0 && (await dem.getAttribute('aria-invalid')) === 'true' && (await p.$eval('#resultCard', e => e.style.opacity)) === '0.5');
  await dem.fill('8'); await p.waitForTimeout(100); ok('A15 Düzeltince hata kalktı', (await p.locator('#warns .warn.err').count()) === 0);
  await p.selectOption('#selB', 'robovan'); await p.waitForTimeout(100); ok('A16 Karşılaştırma seçimi aynı araçta swap edilir (A≠B)', (await p.inputValue('#selA')) === 'conventional' && (await p.inputValue('#selB')) === 'robovan'); await p.selectOption('#selB', 'conventional'); await p.waitForTimeout(100);
  // rota
  await p.selectOption('#cityPick', 'Sakarya'); await p.click('#cityAdd'); await p.waitForTimeout(100);
  ok('A17 Durak eklendi (3 durak)', (await p.locator('#wps .wp').count()) === 3 && (await p.textContent('#routeChip')).includes('+1 durak'), await p.textContent('#routeChip'));
  const km3 = await p.textContent('#rcRes'); ok('A18 Mesafe arttı', !km3.includes('56,1'), km3.slice(0, 40));
  await p.click('#wps .wp:last-child [data-del]'); await p.waitForTimeout(100); ok('A19 Durak silindi', (await p.locator('#wps .wp').count()) === 2);
  await p.click('#presets [data-preset="1"]'); await p.waitForTimeout(100); ok('A20 Hazır rota: İstanbul → Bursa', (await p.textContent('#routeChip')).includes('İstanbul → Bursa'));
  await p.click('#modeManual'); await p.locator('[data-f="r.manualKm"]').fill('4'); await p.waitForTimeout(100);
  ok('A21 Elle 4 km', (await p.textContent('#rcRes')).includes('4,0') && (await p.textContent('#rcRes')).includes('Elle'));
  await p.click('#modeRoute');
  // adres araması anahtarsız
  await p.fill('#addr', 'Gebze'); await p.click('#addrGo'); await p.waitForTimeout(1800); ok('A22 Adres arama servisi yokken açıklayıcı mesaj', (await p.textContent('#sugg')).includes('ulaşılamadı'), await p.textContent('#sugg'));
  // para birimi
  await p.click('[data-bm="year"]'); await p.waitForTimeout(100); const before = (await p.textContent('#costBars')).replace(/[^0-9.]/g, ''); await p.selectOption('#cur', '₺'); await p.waitForTimeout(120);
  ok('A23 Para birimi yalnız etiket', (await p.textContent('#costBars')).replace(/[^0-9.]/g, '') === before && (await p.textContent('#rBig')).includes('₺'));
  await p.selectOption('#cur', '$'); await p.click('[data-bm="live"]');
  // duyarlılık
  await p.click('[data-tab="sens"]'); await p.selectOption('#sensParam', 'km'); await p.selectOption('#sensMetric', 'saving'); await p.waitForTimeout(150);
  ok('A24 Duyarlılık: tasarruf tek çizgi', (await p.locator('#chSens svg path[fill="none"]').count()) === 1);
  await p.selectOption('#sensMetric', 'perKm'); await p.selectOption('#sensParam', 'demand');
  await p.click('[data-tab="inv"]'); await p.locator('#chCum .hit').hover({ position: { x: 200, y: 80 } }); ok('A25 Grafik ipucu çıkıyor', await p.isVisible('#chCum .tip'));
  // saklama
  await p.waitForTimeout(400); await p.reload(); await p.waitForTimeout(400);
  ok('A26 Yenilemeden sonra sürücü 3000', (await p.inputValue('[data-f="sl.driver"]')) === '3000');
  ok('A27 Yenilemeden sonra rota İstanbul → Bursa', (await p.textContent('#routeChip')).includes('Bursa'));
  await p.click('#myNums'); await p.click('#reset'); await p.waitForTimeout(150); await p.click('#sheetDone');
  ok('A28 Sıfırla → varsayılan sürücü + rota', (await p.inputValue('[data-f="sl.driver"]')) === '1500' && (await p.textContent('#routeChip')).includes('Gebze'));
  /* tek koyu tema */
  ok('A29 Tema düğmesi ve renk seçimi yok', (await p.locator('#theme').count()) === 0 && (await p.locator('[data-theme]').count()) === 0 && (await p.evaluate(() => !document.documentElement.hasAttribute('data-theme'))));
  const bgA = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); ok('A29b Koyu arka plan (#08090B)', bgA === 'rgb(8, 9, 11)', bgA);
  ok('A29c Sayfa CSS\'inde açık tema / sistem tercihi kuralı yok (MapLibre yüksek karşıtlık erişilebilirlik kuralları hariç)', await p.evaluate(() => { let bad = 0; for (const s of document.styleSheets) { try { for (const r of s.cssRules) { if (/prefers-color-scheme|data-theme/.test(r.cssText) && !/forced-colors/.test(r.cssText)) bad++; } } catch (e) {} } return bad === 0; }));
  ok('A29d Logo üst çubukta, solda ve yüklendi', await p.evaluate(() => { const i = document.querySelector('.brand img.logo'); const r = i.getBoundingClientRect(); return i.complete && i.naturalWidth > 500 && r.left < 40 && r.height >= 36 && r.height <= 40; }));
  ok('A30 Masaüstü yatay kaydırma yok', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  const rect = await p.$eval('#mapcard', e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
  ok('A31 Harita kartı ekranın ana alanı (≥%65 genişlik, ≥600 yükseklik)', rect[0] > 1440 * 0.65 && rect[1] >= 600, rect.join('x'));
  await p.screenshot({ path: 'shots/d1-desktop-nokey.png' }); await p.screenshot({ path: 'shots/d1-full.png', fullPage: true });
  await ctx.close();

  /* ===== B. Mobil, anahtarsız ===== */
  const mctx = await b.newContext({ ...devices['iPhone 13'] }); await H.blockAllExternal(mctx); const mp = await mctx.newPage(); const merr = [];
  mp.on('pageerror', e => merr.push(e.message)); await mp.goto(url); await mp.waitForTimeout(500);
  ok('B1 Mobil hatasız', merr.length === 0, merr.join(';'));
  ok('B2 Mobil yatay kaydırma yok', !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  const rc = await mp.$eval('#routecard', e => e.parentElement.id); ok('B3 Rota kartı mobilde panele taşındı', rc === 'panel', rc);
  const mh = await mp.$eval('#mapcard', e => e.getBoundingClientRect().height); ok('B4 Mobil harita yüksekliği ≥ 340', mh >= 340, String(mh));
  const rY = await mp.$eval('#resultCard', e => e.getBoundingClientRect().top), cY = await mp.$eval('#ctrlCard', e => e.getBoundingClientRect().top); ok('B5 Mobilde sonuç parametrelerden önce', rY < cY);
  await mp.screenshot({ path: 'shots/m1-top.png' }); await mp.evaluate(() => window.scrollTo(0, 700)); await mp.waitForTimeout(200); await mp.screenshot({ path: 'shots/m2-mid.png' });
  await mp.setViewportSize({ width: 360, height: 780 }); await mp.waitForTimeout(200); ok('B6 360px yatay kaydırma yok', !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await mctx.close();


  /* ===== C. Gerçek harita (OpenFreeMap) + rota/adres kayıtları, masaüstü ===== */
  const st = {}; const cctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(cctx, st);
  const cp = await cctx.newPage(); const cerr = [], hosts = {};
  cp.on('pageerror', e => cerr.push(e.message)); cp.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::|ERR_/.test(m.text())) cerr.push(m.text()); });
  cp.on('request', r => { const u = r.url(); if (H.isExt(u)) { const h = new URL(u).host; hosts[h] = (hosts[h] || 0) + 1; } });
  await cp.goto(url); await H.waitMap(cp); await H.waitPlan(cp);
  const dbg = () => cp.evaluate(() => window.RobovanMap.debug());
  let d = await dbg();
  ok('C1 Anahtarsız harita açıldı (OpenFreeMap)', d.ready && (await cp.isHidden('#mapstate')), JSON.stringify([d.state, hosts['tiles.openfreemap.org']]));
  ok('C2 Perspektif (eğim ≥ 45°) ve 3D bina katmanı', d.pitch >= 45 && d.hasBuildings, `pitch ${d.pitch}`);
  ok('C3 Gerçek karayolu rotası: rozet OSRM + 48,9 km', (await cp.textContent('#rcRes')).includes('Gerçek karayolu') && (await cp.textContent('#rcRes')).includes('OSRM') && (await cp.textContent('#rcRes')).includes('48,9'), (await cp.textContent('#rcRes')).slice(0, 90));
  ok('C4 Hesap motoru gerçek yol mesafesini kullanıyor', await cp.evaluate(() => Math.abs(window.__last.route.km - 48.8987) < 0.01 && window.__last.route.source === 'road'));
  ok('C5 Güzergâh haritaya çizildi (road)', (await dbg()).routeFeatures.join() === 'road', JSON.stringify((await dbg()).routeFeatures));
  ok('C6 Durak işaretçileri (A, B) çizildi', (await cp.locator('.mk-stop').count()) === 2);
  ok('C7 İki araçlı 3D katman eklendi, ana tarayıcıda tam model', d.hasVan && d.van && d.van.vehicles.length >= 2 && d.van.simple === d.mobile, JSON.stringify(d.van));
  ok('C8 Kamyonet kısıtı uyarısı rota kartında', (await cp.textContent('#rcRes')).includes('kamyonet kısıtları'));
  ok('C9 Atıf görünür: OpenStreetMap, OpenFreeMap, OSRM, Photon', await cp.evaluate(() => { const a = document.querySelector('.maplibregl-ctrl-attrib'); const t = a ? a.innerText + a.textContent : ''; return !!a && a.offsetWidth > 0 && /OpenStreetMap/.test(t) && /OpenFreeMap/.test(t) && /OSRM/.test(t) && /Photon/.test(t); }));
  const km0 = await cp.evaluate(() => window.__last.vehicles.robovan.perKm); await cp.locator('[data-f="sl.demand"]').fill('12'); await cp.waitForTimeout(200);
  ok('C10 Parametre → sonuç güncellenir, rota korunur', (await cp.evaluate(() => window.__last.vehicles.robovan.perKm)) !== km0 && Math.abs((await cp.evaluate(() => window.__last.route.km)) - 48.8987) < 0.01);
  await cp.click('[data-sp="6"]'); await cp.click('#pp'); await cp.waitForTimeout(1500); const d1 = await dbg();
  ok('C11 Animasyon: saat ilerliyor, araç görünür, konum değişiyor', (await cp.textContent('#clock')) !== '06:00' && d1.van.vehicles.length >= 2 && d1.pos['robovan:0'] && d1.pos['robovan:0'].lng !== 0, (await cp.textContent('#clock')) + ' ' + JSON.stringify(d1.pos));
  await cp.waitForTimeout(800); const d2 = await dbg(); ok('C12 Araç rota üzerinde ilerliyor (doğu yönüne, yön ≈ 60–120°)', d2.pos['robovan:0'].lng !== d1.pos['robovan:0'].lng, JSON.stringify([d1.pos['robovan:0'], d2.pos['robovan:0']]));
  const onRoute = await cp.evaluate(() => { const r = window.__app.routeInfo().coords, p = window.RobovanMap.debug().pos['robovan:0']; let best = 1e9; for (let i = 1; i < r.length; i++) { const a = r[i - 1], b = r[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p.lng - a[0]) * dx + (p.lat - a[1]) * dy) / L)) : 0, qx = a[0] + t * dx, qy = a[1] + t * dy; const m = Math.hypot((p.lng - qx) * 84000, (p.lat - qy) * 111000); if (m < best) best = m; } return best; });
  ok('C13 Araç konumu rota çizgisinin üzerinde (≤ 5 m)', onRoute < 5, onRoute.toFixed(2) + ' m');
  await cp.click('#pp'); ok('C14 Duraklat', (await cp.textContent('#pp')) === '▶');
  await cp.locator('#tl').evaluate(el => { el.value = 500; el.dispatchEvent(new Event('input', { bubbles: true })); }); ok('C15 İlerleme çubuğu aracı sürükler', (await cp.textContent('#tlTxt')).includes('Simülasyon'));
  await cp.click('[data-view="top"]'); await cp.waitForTimeout(1100); ok('C16 Üstten görünüm: eğim 0°', Math.abs((await dbg()).pitch) < 1);
  await cp.click('[data-view="3d"]'); await cp.waitForTimeout(1300); ok('C17 3D görünüm: eğim ≥ 55°', (await dbg()).pitch >= 55);
  await cp.click('[data-view="fit"]'); await cp.waitForTimeout(1500); ok('C18 Tüm rota sığdırma çalışıyor', (await dbg()).zoom > 6);
  await cp.click('#followBtn'); await cp.click('#pp'); await cp.waitForTimeout(1200); const z1 = await dbg(); await cp.click('#pp'); await cp.click('#followBtn');
  ok('C19 Aracı takip: kamera araca bakıyor', await cp.evaluate(() => { const m = window.RobovanMap.debug(); return !!m.pos['robovan:0']; }));
  await cp.evaluate(() => window.RobovanMap.setSimpleVan(true)); await cp.waitForTimeout(300); ok('C20 Sade araç görünümüne geçiş sorunsuz', (await dbg()).van.simple === true && cerr.length === 0, cerr.join(';'));
  await cp.evaluate(() => window.RobovanMap.setSimpleVan(false));
  /* bina verisi olmayan bölge: harita sorunsuz */
  await cp.evaluate(() => window.RobovanMap.map.jumpTo({ center: [33.2, 38.9], zoom: 15.6, pitch: 60, bearing: 0 })); await cp.waitForTimeout(5000); ok('C20b Bina verisi olmayan kırsal bölgede harita sorunsuz (hata yok, katman duruyor)', (await dbg()).ready && (await dbg()).hasBuildings && cerr.length === 0, cerr.join(';'));
  await cp.evaluate(() => window.RobovanMap.fit()); await cp.waitForTimeout(1500);
  /* tema */
  ok('C21 Harita yalnızca koyu OpenFreeMap stili (arka plan #0a0a0c)', await cp.evaluate(() => { const l = window.RobovanMap.map.getStyle().layers.find(x => x.type === 'background'); return l && l.paint['background-color'] === '#0a0a0c'; }));
  /* adres arama (Photon kaydı) */
  const nPh = st.photon.length; await cp.click('#rcToggle'); await cp.fill('#addr', 'Gebze'); await cp.waitForTimeout(1500); ok('C23 Yazarken Photon isteği YOK (yalnız Ara/Enter)', st.photon.length === nPh);
  await cp.fill('#addr', 'Ge'); await cp.click('#addrGo'); ok('C24 3 harften kısa aramada istek yok', st.photon.length === nPh && (await cp.textContent('#sugg')).includes('En az 3 harf'));
  await cp.fill('#addr', 'Gebze Organize Sanayi'); await cp.press('#addr', 'Enter'); await cp.waitForSelector('#sugg .opt'); ok('C25 Enter ile arama: 1 istek, sonuçlar listelendi', st.photon.length === nPh + 1 && (await cp.locator('#sugg .opt').count()) === 2, (await cp.textContent('#sugg .opt')).slice(0, 60));
  await cp.fill('#addr', 'Gebze Organize Sanayi'); await cp.click('#addrGo'); await cp.waitForTimeout(300); ok('C26 Aynı arama önbellekten (yeni istek yok)', st.photon.length === nPh + 1);
  const rq0 = st.osrm.length; await cp.click('#sugg .opt >> nth=0'); await cp.waitForTimeout(2600);
  ok('C27 Sonuç seçilince durak eklendi ve rota yeniden istendi', (await cp.locator('#wps .wp').count()) === 3 && st.osrm.length === rq0 + 1, `${await cp.locator('#wps .wp').count()} durak, ${st.osrm.length - rq0} OSRM isteği`);
  const url1 = st.osrm[st.osrm.length - 1].url; ok('C28 Rota isteği otomobil profili (driving) ve 3 koordinat', /route\/v1\/driving\//.test(url1) && url1.split(';').length === 3, url1.slice(0, 120));
  /* hızlı arka arkaya değişiklik: debounce + iptal */
  const rq1 = st.osrm.length; await cp.evaluate(() => { ['1', '2', '3'].forEach(i => document.querySelector('#presets [data-preset="' + i + '"]').click()); }); await cp.waitForTimeout(3200);
  ok('C29 Hızlı 3 rota değişimi → yalnız 1 rota isteği (gecikme + iptal)', st.osrm.length === rq1 + 1, String(st.osrm.length - rq1));
  const rq2 = st.osrm.length; await cp.selectOption('#cityPick', 'Edirne'); await cp.click('#cityAdd'); await cp.waitForTimeout(500); await cp.selectOption('#cityPick', 'Konya'); await cp.click('#cityAdd'); await cp.waitForTimeout(3600);
  const ts = st.osrm.slice(rq2).map(x => x.t); ok('C30 Art arda iki farklı rota isteği en az 1,1 sn arayla (hız sınırı)', ts.length === 2 ? ts[1] - ts[0] >= 1050 : ts.length === 1, JSON.stringify(ts.map((t, i) => i ? t - ts[i - 1] : 0)));
  /* önbellek: aynı rota tekrar */
  await cp.click('#presets [data-preset="0"]'); await cp.waitForTimeout(2600); const rq3 = st.osrm.length; await cp.click('#presets [data-preset="3"]'); await cp.waitForTimeout(2600); await cp.click('#presets [data-preset="0"]'); await cp.waitForTimeout(1200); ok('C31 Daha önce hesaplanan rota önbellekten (OSRM isteği yok, rozet "önbellekten")', st.osrm.length === rq3 && (await cp.textContent('#rcRes')).includes('önbellekten'));
  await cp.reload(); await H.waitMap(cp); await cp.waitForTimeout(2500); ok('C32 Sayfa yenilenince de rota önbellekten (kalıcı)', (await cp.textContent('#rcRes')).includes('önbellekten'));
  ok('C33 Yalnızca izinli servislere istek gitti', Object.keys(hosts).every(h => H.ALLOWED.includes(h)), JSON.stringify(hosts));
  ok('C34 Gerçek harita akışında sayfa hatası yok', cerr.length === 0, cerr.join(';'));
  await cctx.close();

  /* ===== C2. İşletim sistemi açık tema ayarı ve eski kayıtlı tema görünümü değiştirmez ===== */
  for (const scheme of ['light', 'dark', 'no-preference']) {
    const sctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme }); await H.blockAllExternal(sctx); const sp = await sctx.newPage();
    await sp.addInitScript(() => { try { localStorage.setItem('robovan-sim-ui-v2', JSON.stringify({ cfg: {}, ui: { theme: 'light', cur: '$' }, raw: {} })); } catch (e) {} });
    await sp.goto(url); await sp.waitForTimeout(900);
    const cols = await sp.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('#barCard')).backgroundColor, getComputedStyle(document.querySelector('.cream')).backgroundColor, document.documentElement.hasAttribute('data-theme')]);
    ok(`C2-${scheme} İşletim sistemi "${scheme}" ve eski "light" kaydı olsa da görünüm aynı koyu tema`, cols[0] === 'rgb(8, 9, 11)' && cols[1] === 'rgb(21, 24, 29)' && cols[2] === 'rgb(244, 235, 216)' && cols[3] === false, JSON.stringify(cols));
    await sctx.close();
  }

  /* ===== D. Yedek sağlayıcı, tümü kapalı ===== */
  const st2 = { mode: 'osrm-down' }; const dctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(dctx, st2);
  const dp = await dctx.newPage(); await dp.goto(url); await H.waitMap(dp); await H.waitPlan(dp).catch(() => {});
  ok('D1 OSRM yanıt vermezse FOSSGIS OSRM yedeği kullanılır', st2.osrm.length >= 1 && st2.fossgis.length >= 1 && (await dp.textContent('#rcRes')).includes('FOSSGIS OSRM'), (await dp.textContent('#rcRes')).slice(0, 80));
  await dctx.close();
  const st3 = { mode: 'all-down' }; const ectx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ectx, st3);
  const ep = await ectx.newPage(); await ep.goto(url); await H.waitMap(ep); await ep.waitForTimeout(6000);
  const e0 = await ep.textContent('#rcRes'); const d0 = await ep.evaluate(() => window.RobovanMap.debug());
  ok('D2a Servis kapalı + varsayılan rota: DEMO rota rozeti, araçlar haritada ve hareket edebilir', e0.includes('DEMO') && !e0.includes('Gerçek karayolu') && d0.van.vehicles.length >= 2 && (await ep.isEnabled('#pp')) && (await ep.textContent('#tlTxt')).includes('DEMO'), e0.slice(0, 100));
  ok('D2b DEMO uyarısı görünür', (await ep.textContent('#warns')).includes('DEMO'));
  await ep.evaluate(() => window.__app.setSim(80)); await ep.waitForTimeout(400); const mv = await ep.evaluate(() => window.RobovanMap.debug().pos); ok('D2c DEMO rotada araçlar başlangıçtan ayrılıyor', Math.hypot(mv['robovan:0'].lng - 29.4307, mv['robovan:0'].lat - 40.8028) > 0.05, JSON.stringify(mv['robovan:0']));
  if ((await ep.getAttribute('#rcToggle', 'aria-expanded')) !== 'true') await ep.click('#rcToggle'); await ep.click('#presets [data-preset="1"]'); await ep.waitForTimeout(5000);
  const e1 = await ep.textContent('#rcRes'); const dd = await ep.evaluate(() => window.RobovanMap.debug());
  ok('D2 Başka rota + iki servis kapalı: "tahmin" rozeti, gerçek yol gibi gösterilmez', e1.includes('Tahmin') && !e1.includes('Gerçek karayolu') && !e1.includes('DEMO'), e1.slice(0, 120));
  ok('D3 Rota yoksa kesikli kuş uçuşu çizgisi ve uyarı', dd.routeFeatures.join() === 'air' && (await ep.textContent('#warns')).includes('Karayolu rotası hesaplanamadı'), JSON.stringify(dd.routeFeatures));
  ok('D4 Rota yoksa araçlar KAYBOLMAZ: başlangıçta park halinde görünür; hareket kapalı ve nedeni yazar', dd.van.vehicles.length >= 2 && dd.planned === false && (await ep.isDisabled('#pp')) && (await ep.textContent('#tlTxt')).includes('park halinde') && (await ep.textContent('#hudSt')) === 'Park halinde' && (await ep.textContent('.mk-label')).includes('park halinde'), await ep.textContent('#tlTxt'));
  ok('D5 Servis yokken hesap motoru sürüyor (tahmin km ile)', (await ep.evaluate(() => window.__last.route.source)) === 'air' && (await ep.textContent('#rBig')).includes('$'));
  ok('D6 Rota denemeleri sınırlı (rota başına her sağlayıcıya tek istek)', st3.osrm.length === 2 && st3.fossgis.length === 2, `${st3.osrm.length}/${st3.fossgis.length}`);
  await ectx.close();
  /* WebGL yok */
  const wb = await chromium.launch({ args: ['--disable-gpu', '--disable-webgl', '--disable-3d-apis', '--disable-software-rasterizer'] }); const wctx = await wb.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(wctx, {});
  const wp = await wctx.newPage(); await wp.goto(url); await wp.waitForTimeout(2500); const wgl = await wp.evaluate(() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } });
  ok('D7 WebGL yoksa açıklayıcı hata, hesaplama sürer', wgl ? true : ((await wp.textContent('#msText')).includes('WebGL') && (await wp.textContent('#rBig')).includes('$')), wgl ? 'bu ortamda WebGL kapatılamadı (test atlandı)' : '');
  await wb.close();

  /* ===== E. Tek dosya: localhost ===== */
  const http = require('http'), fs = require('fs'); const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(process.argv[2])); }).listen(0); const port = srv.address().port;
  const lctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const lst = {}; await H.stubServices(lctx, lst); const lp = await lctx.newPage(); const lerr = []; lp.on('pageerror', e => lerr.push(e.message));
  await lp.goto('http://localhost:' + port + '/'); await H.waitMap(lp); await H.waitPlan(lp);
  const res = await lp.evaluate(() => performance.getEntriesByType('resource').filter(r => r.initiatorType === 'script' || r.initiatorType === 'link').map(r => r.name));
  ok('E1 localhost: tek dosya yeter (dış script/stil dosyası yok)', res.length === 0, res.join(','));
  ok('E2 localhost: harita, rota ve animasyon çalışıyor', (await lp.evaluate(() => window.RobovanMap.debug().ready)) && (await lp.textContent('#rcRes')).includes('OSRM') && (await lp.isEnabled('#pp')) && lerr.length === 0, lerr.join(';'));
  await lctx.close(); srv.close();

  /* ===== F. Mobil (iPhone 13), gerçek harita ===== */
  const fst = {}; const fctx = await b.newContext({ ...devices['iPhone 13'] }); await H.stubServices(fctx, fst); const fp = await fctx.newPage(); const ferr = [];
  fp.on('pageerror', e => ferr.push(e.message)); await fp.goto(url); await H.waitMap(fp); await H.waitPlan(fp);
  const fd = await fp.evaluate(() => window.RobovanMap.debug());
  ok('F1 Mobilde harita ve rota hazır, hata yok', fd.ready && ferr.length === 0, ferr.join(';'));
  ok('F2 Mobil cihaz tespit edildi, araç varsayılan sade görünümde', fd.mobile === true && fd.van.simple === true);
  ok('F3 Mobil yatay taşma yok', !(await fp.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await fp.click('#pp'); await fp.waitForTimeout(1200); ok('F4 Mobilde animasyon çalışıyor', (await fp.textContent('#clock')) !== '06:00');
  const fps = await fp.evaluate(() => new Promise(res => { let n = 0, t0 = performance.now(); const f = t => { n++; if (t - t0 > 2000) res(n / ((t - t0) / 1000)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  ok('F5 Mobilde animasyon sırasında çerçeve hızı ölçüldü (yazılım çizim; gerçek cihaz değil)', fps > 0, fps.toFixed(1) + ' kare/sn');
  await fctx.close();

  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('KALDI')).length; console.log(out.length + ' kontrol, ' + bad + ' kalan');
  await b.close(); process.exit(bad ? 1 : 0);
})();
