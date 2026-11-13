/* Yeni gereksinimler: araçlar her koşulda görünür (park/demo/yavaş servis), gerçek WebGL piksel kanıtı, 3D model, UX düzeni, form, responsive. */
const { chromium, devices } = require('playwright');
const H = require('./helpers'); const fs = require('fs');
const url = 'file://' + process.argv[2];
const out = []; const ok = (n, c, x) => out.push((c ? 'GEÇTİ ' : 'KALDI ') + n + (x ? ' — ' + x : ''));
(async () => {
  const b = await chromium.launch({ args: H.ARGS });
  /* ---- 1. gerçek WebGL piksel kanıtı: araçlar çiziliyor (oynat'a basmadan) ---- */
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.stubServices(ctx);
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errs.push(m.text()); });
  await p.goto(url); await H.waitMap(p); await H.waitPlan(p);
  ok('N1 Oynat\'a basmadan araçlar haritada (iki tür) (başlangıç noktasında, hareketsiz)', await p.evaluate(() => { const s = window.RobovanMap.debug(); return s.van.vehicles.length >= 2 && window.__app.sim().t === 0 && !window.__app.sim().playing; }));
  const shot = async (id, zoom, pitch, rel) => {
    await p.evaluate(({ id, zoom, pitch }) => { const a = window.RobovanMap.debug().pos[id + ':0']; window.RobovanMap.map.jumpTo({ center: [a.lng, a.lat], zoom, pitch, bearing: a.brg + 160 }); }, { id, zoom, pitch });
    await p.waitForTimeout(9000);
    const pt = await p.evaluate((id) => { const m = window.RobovanMap.map, a = window.RobovanMap.debug().pos[id + ':0'], q = m.project([a.lng, a.lat]), r = m.getContainer().getBoundingClientRect(); return { x: r.left + q.x, y: r.top + q.y }; }, id);
    const clip = { x: Math.max(0, pt.x - 120), y: Math.max(0, pt.y - 140), width: 240, height: 200 };
    const buf = await p.screenshot({ clip }); const c = await px.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, cv.width, cv.height).data; let white = 0, orange = 0, teal = 0; for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], bb = d[i + 2]; if (r > 190 && gg > 190 && bb > 190) white++; else if (r > 190 && gg > 100 && gg < 170 && bb < 110) orange++; else if (gg > 150 && bb > 140 && r < 90) teal++; } return { white, orange, teal }; }, buf.toString('base64'));
    fs.writeFileSync(`/tmp/claude-0/s6/${rel}.png`, await p.screenshot()); return c;
  };
  fs.mkdirSync('/tmp/claude-0/s6', { recursive: true });
  const px = await ctx.newPage(); await px.goto('about:blank');
  const rb = await shot('robovan', 19, 58, 'px-robovan');
  ok('N2 GERÇEK ekran görüntüsünde Robovan çizilmiş: beyaz gövde pikselleri (WebGL)', rb.white > 1500, JSON.stringify(rb));
  const cv = await shot('conventional', 19, 58, 'px-conventional');
  ok('N3 GERÇEK ekran görüntüsünde Geleneksel Van çizilmiş: turuncu kargo kutusu pikselleri', cv.orange > 1200, JSON.stringify(cv));
  /* ---- 2. hareket + tekerlek dönüşü ---- */
  await p.evaluate(() => { window.__app.setSim(30); }); const sp1 = (await p.evaluate(() => window.RobovanMap.debug().van.vehicles.map(v => v.spin))); await p.evaluate(() => { window.__app.setSim(60); }); const sp2 = (await p.evaluate(() => window.RobovanMap.debug().van.vehicles.map(v => v.spin)));
  ok('N4 Tekerlek dönüşü hareketle senkron (yol uzadıkça artar; km × 1000 / 0,5 m yarıçap)', sp1[0] > 0 && sp2.every((x, i) => x >= sp1[i]) && sp2[0] > sp1[0] && await p.evaluate(() => { const s = window.__app.live().at(60)[0]; const v = window.RobovanMap.debug().van.vehicles.filter(q => q.id === s.id)[0]; return Math.abs(v.spin - s.km * 2000) < 1e-3; }), JSON.stringify([sp1, sp2]));
  /* yön: dönüşlerde yol doğrultusu (iki ardışık konum arası yön ile aracın yönü) */
  const hd = await p.evaluate(() => { const out = []; for (let t = 20; t < 120; t += 4) { window.__app.setSim(t); const a = window.RobovanMap.debug().pos['robovan:0']; out.push(a.brg); } return out; });
  const jumps = hd.slice(1).map((x, i) => Math.abs(((x - hd[i] + 540) % 360) - 180)).filter(d => d > 60);
  ok('N5 Yön geçişleri yumuşak: yalnızca rota sonundaki dönüşte (U dönüşü) büyük değişim, başka ani sıçrama yok', jumps.length <= 1, hd.map(x => Math.round(x)).join(','));
  /* ---- 3. 3D model: gerçek geometri (sprite/panoya dayanmıyor) ---- */
  const mp = await (await b.newContext({ viewport: { width: 600, height: 400 } })).newPage(); await mp.setContent('<canvas id=c></canvas>'); await mp.addScriptTag({ content: fs.readFileSync('vendor/three.min.js', 'utf8') }); await mp.addScriptTag({ content: fs.readFileSync('ui/van3d.js', 'utf8') });
  const mdl = await mp.evaluate(() => { const T = THREE, res = {}; ['robovan', 'conventional'].forEach(t => { const g = window.RobovanVan3D.buildVan(T, t, '#1FC2AE', false), s = window.RobovanVan3D.buildVan(T, t, '#1FC2AE', true); let mesh = 0, tri = 0, sprite = 0, tex = 0, ext = 0; g.traverse(o => { if (o.isMesh) { mesh++; tri += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; if (o.geometry.type === 'ExtrudeGeometry') ext++; if (o.material.map) tex++; } if (o.isSprite) sprite++; }); let sm = 0; s.traverse(o => { if (o.isMesh) sm++; }); const bb = new T.Box3().setFromObject(g), sz = bb.getSize(new T.Vector3()); res[t] = { mesh, tri: Math.round(tri), sprite, tex, ext, wheels: g.userData.wheels.length, simpleMesh: sm, size: [sz.x, sz.y, sz.z].map(x => +x.toFixed(2)) }; }); return res; });
  ok('N6 Robovan modeli gerçek 3D geometri: yuvarlatılmış gövde (Extrude), 80+ parça, 4 tekerlek; sprite/doku yok', mdl.robovan.ext >= 1 && mdl.robovan.mesh >= 80 && mdl.robovan.wheels === 4 && mdl.robovan.sprite === 0 && mdl.robovan.tex === 0, JSON.stringify(mdl.robovan));
  ok('N7 Geleneksel Van ayrı model (kabinli, kendi geometri): 4 tekerlek, sprite yok', mdl.conventional.ext >= 2 && mdl.conventional.wheels === 4 && mdl.conventional.sprite === 0 && mdl.conventional.size[1] > 4.5, JSON.stringify(mdl.conventional));
  ok('N8 Mobil sade model: daha az parça', mdl.robovan.simpleMesh < mdl.robovan.mesh * 0.8, `${mdl.robovan.simpleMesh} < ${mdl.robovan.mesh}`);
  /* ---- 4. ana ekran: üç soru ---- */
  await p.evaluate(() => window.scrollTo(0, 0)); await p.click('#tcSkip').catch(() => {});
  const main = await p.evaluate(() => ({ verdict: document.getElementById('rLbl').innerText, big: document.getElementById('rBig').innerText, sub: document.getElementById('rSub').innerText, cmp: document.getElementById('cmpGrid').innerText, sliders: document.querySelectorAll('#sliders .slider').length, params: document.querySelectorAll('#panel [data-f]').length }));
  ok('N9 Ana ekran: kim ekonomik (başlık), tahmini fark (büyük rakam), yüzde, iki aracın km/sefer maliyeti', /ekonomik/.test(main.verdict) && /%\d+/.test(main.verdict) && /\$[\d.]+/.test(main.big) && /km başına/.test(main.cmp) && /Sefer başına/.test(main.cmp), JSON.stringify(main).slice(0, 200));
  ok('N10 Ana ekranda yalnızca 5 ana parametre (kaydırıcı); teknik alanlar ana ekranda yok', main.sliders === 5 && main.params === 5, `${main.sliders} / ${main.params}`);
  ok('N11 Rota kartı başlangıçta kompakt (daraltılmış)', (await p.getAttribute('#rcToggle', 'aria-expanded')) === 'false' && (await p.$eval('#routecard', e => e.getBoundingClientRect().height)) < 140);
  ok('N12 Araçlar rota kartının altında kalmıyor: kart haritanın üst yarısında, araç alanı açık', await p.evaluate(() => { const r = document.getElementById('routecard').getBoundingClientRect(), m = document.getElementById('mapcard').getBoundingClientRect(); return r.bottom < m.top + m.height * 0.35; }));
  /* ---- 5. Rakamlarım: 4 grup, alan tekrarı yok, açıklama, hata ---- */
  await p.click('#myNums');
  const tabs = await p.$$eval('#shTabs [role=tab]', t => t.map(x => x.textContent));
  ok('N13 Rakamlarım grupları: Operasyon · Robovan · Geleneksel Van · Gelişmiş', tabs.join('|') === 'Operasyon|Robovan|Geleneksel Van|Gelişmiş', tabs.join('|'));
  const dup = await p.evaluate(() => { const ids = [...document.querySelectorAll('[data-f]')].map(e => e.dataset.f), seen = {}; ids.forEach(i => { seen[i] = (seen[i] || 0) + 1; }); return Object.keys(seen).filter(k => seen[k] > 1 && !k.startsWith('sl.')); });
  ok('N14 Aynı giriş birden çok yerde tekrar etmiyor (kaydırıcılar hızlı kontrol olarak ortak veriye bağlı)', dup.length === 0, dup.join(','));
  const noHint = await p.evaluate(() => [...document.querySelectorAll('#sheet .fld')].filter(f => f.querySelector('input') && !f.querySelector('.hint')).length); ok('N15 Her alanın etiketi, birimi ve açıklaması var', noHint === 0 && (await p.locator('#sheet .fld .u').count()) > 20, 'açıklamasız: ' + noHint);
  const group = await p.evaluate(() => { const g = (k) => [...document.querySelectorAll('#sp-' + k + ' [data-f]')].map(e => e.dataset.f.split('.').pop()); return { ops: g('ops'), robo: g('robovan'), conv: g('conventional'), adv: g('adv') }; });
  ok('N16 Temel alanlar grupta: Operasyon (sefer, gün), Robovan (alış, elektrik, bakım, operatör), Geleneksel (alış, dizel, bakım, sürücü); finansman/amortisman Gelişmiş\'te', group.ops.includes('demand') && group.ops.includes('days') && ['price', 'elec', 'maint', 'operator'].every(x => group.robo.includes(x)) && ['price', 'fuel', 'maint', 'driver'].every(x => group.conv.includes(x)) && group.adv.includes('rate') && group.adv.includes('life') && group.adv.includes('residual'), JSON.stringify(group).slice(0, 300));
  const inp = p.locator('#sp-ops [data-f="s.demand"]'); await inp.click(); await inp.fill(''); await p.waitForTimeout(150);
  ok('N17 Hatalı girişte mesaj ilgili alanın hemen altında, odak kaybolmuyor', (await p.isVisible('#e-s\\.demand')) && (await p.textContent('#e-s\\.demand')).length > 3 && await p.evaluate(() => document.activeElement.dataset.f === 's.demand'));
  await inp.fill('8'); await p.click('[data-st="conventional"]'); const sp = p.locator('#sp-conventional [data-f="v.conventional.speed"]'); await p.click('[data-st="adv"]'); await p.evaluate(() => document.querySelectorAll('#vl-adv details').forEach(d => d.open = true)); const spd = p.locator('#vl-adv [data-f="v.conventional.speed"]'); await spd.fill('0'); await p.waitForTimeout(200);
  ok('N18 Motor doğrulama hatası ilgili alana bağlanır (Geleneksel Van hız = 0)', (await p.textContent('#e-v\\.conventional\\.speed')).includes('büyük'), await p.textContent('#e-v\\.conventional\\.speed')); await spd.fill('45');
  const hts = await p.evaluate(() => { const h = (s) => Math.round(document.querySelector(s).getBoundingClientRect().height); return { inp: h('#sp-adv .inp input'), btn: h('#sheetDone'), tab: h('#shTabs button'), sel: h('#selA') }; });
  await p.keyboard.press('Escape');
  ok('N19 Giriş alanları ve temel düğmeler 44 px ve üzeri', hts.inp >= 44 && hts.btn >= 44 && hts.tab >= 44, JSON.stringify(hts));
  /* ---- 6. detaylı analiz: 4 bölüm ---- */
  const anTabs = await p.$$eval('#anTabs [role=tab]', t => t.map(x => x.textContent)); ok('N20 Detaylı Analiz bölümleri: Özet · Maliyet Dağılımı · Yatırım ve Geri Ödeme · Duyarlılık', anTabs.join('|') === 'Özet|Maliyet Dağılımı|Yatırım ve Geri Ödeme|Duyarlılık', anTabs.join('|'));
  const seen = {}; for (const t of ['sum', 'dist', 'inv', 'sens']) { await p.click(`[data-tab="${t}"]`); seen[t] = await p.evaluate((t) => { const v = [...document.querySelectorAll('.tabpanel')].filter(e => !e.hidden).map(e => e.id); return v.join() + '|' + document.getElementById('pn-' + t).innerText.length; }, t); }
  ok('N21 Her sekme yalnızca kendi bölümünü gösterir; içerik dolu', Object.keys(seen).every(k => seen[k].startsWith('pn-' + k + '|') && +seen[k].split('|')[1] > 150), JSON.stringify(seen));
  ok('N22 Maliyet Dağılımı: enerji/bakım/personel/sermaye/sabit çubukları; Yatırım: geri ödeme, TCO, birikimli grafik; Duyarlılık: grafik', await p.evaluate(() => { const t = (id) => document.getElementById(id).innerText; return /Enerji/.test(t('pn-dist')) && /Sigorta/.test(t('pn-dist')) && /Geri ödeme/.test(t('pn-inv')) && /toplam fark|sahip olma/.test(t('pn-inv') + t('pn-sum')) && !!document.querySelector('#chCum svg') && !!document.querySelector('#chSens svg'); }));
  await p.click('#goAnalysis'); await p.waitForTimeout(800); ok('N23 "Detaylı analiz" düğmesi analiz bölümüne götürür', (await p.evaluate(() => Math.abs(document.getElementById('analysis').getBoundingClientRect().top) < 200)));
  /* ---- 7. ilk kullanım ipucu kapatılınca geri gelmez ---- */
  await p.evaluate(() => window.scrollTo(0, 0)); await p.click('#tcSkip').catch(() => {}); await p.waitForTimeout(400); await p.reload(); await p.waitForTimeout(700);
  ok('N24 İpucu kapatılınca yenilemede tekrar görünmez', await p.isHidden('#tipcard'));
  ok('N25 Sayfa hatası yok', errs.length === 0, errs.join(';')); await ctx.close();
  /* ---- 8. yavaş rota servisi: araçlar kaybolmaz ---- */
  const sctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const sst = await H.stubServices(sctx, {});
  await sctx.route(/router\.project-osrm\.org\/route/, async r => { await new Promise(x => setTimeout(x, 7000)); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: H.OSRM }); });
  const slowP = await sctx.newPage(); await slowP.goto(url); await H.waitMap(slowP); await slowP.waitForTimeout(2500);
  const early = await slowP.evaluate(() => ({ v: window.RobovanMap.debug().van.vehicles.length, t: document.getElementById('tlTxt').textContent, pp: document.getElementById('pp').disabled, lbl: document.querySelector('.mk-label') && document.querySelector('.mk-label').textContent }));
  ok('N26 Rota servisi geç yanıt verirken araçlar görünür (park halinde); hareketin neden başlamadığı yazılır', early.v >= 2 && early.pp && /hesaplanıyor|park halinde/.test(early.t) && /park halinde/.test(early.lbl || ''), JSON.stringify(early));
  await H.waitPlan(slowP, 25000); ok('N27 Rota gelince hareket kullanılabilir olur, araçlar yerinde', await slowP.evaluate(() => window.RobovanMap.debug().van.vehicles.length >= 2 && !document.getElementById('pp').disabled)); await sctx.close();
  /* ---- 9. responsive: yedi genişlik ---- */
  for (const w of [375, 390, 430, 768, 1024, 1280, 1440]) {
    const c = await b.newContext({ viewport: { width: w, height: w < 900 ? 800 : 900 }, deviceScaleFactor: 1 }); await H.stubServices(c, {}); const q = await c.newPage(); await q.goto(url); await H.waitMap(q); await H.waitPlan(q); await q.waitForTimeout(600);
    const m = await q.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; }; return { over: document.documentElement.scrollWidth - innerWidth, map: r('#mapcard'), panel: r('#panel'), hud: r('#hud'), ctl: r(innerWidth <= 900 ? '#mapctl' : '#pill'), bar: r('#mapbar'), tl: r('#timeline'), panelOv: getComputedStyle(document.getElementById('panel')).overflowY, big: parseFloat(getComputedStyle(document.getElementById('rBig')).fontSize), body: parseFloat(getComputedStyle(document.body).fontSize), vw: innerWidth, vh: innerHeight }; });
    const hit = (a, b2) => a && b2 && !(a.r <= b2.l + 1 || b2.r <= a.l + 1 || a.b <= b2.t + 1 || b2.b <= a.t + 1);
    ok(`R${w}-1 Yatay taşma yok`, m.over <= 1, 'taşma=' + m.over);
    ok(`R${w}-2 Kontroller, harita düğmeleri ve canlı panel birbirine binmiyor`, !hit(m.ctl, m.bar) && !hit(m.bar, m.hud) && !hit(m.ctl, m.hud) && (!m.tl || m.tl.w === 0 || !hit(m.hud, m.tl)), JSON.stringify([m.ctl, m.bar, m.hud]).slice(0, 200));
    if (w >= 900) ok(`R${w}-3 İç içe scroll yok (panel kendi içinde kaymaz)`, m.panelOv === 'visible', m.panelOv); else ok(`R${w}-3 Mobil: alt panel kapalıyken yalnız özet çubuğu görünür (panel ekranın altında)`, m.panel.t >= m.vh - 100 && m.panel.t <= m.vh - 60, JSON.stringify([m.panel.t, m.vh]));
    if (w >= 1024) ok(`R${w}-4 Harita %${Math.round(m.map.w / m.vw * 100)} (hedef %65–72; 1024'te panel 340 px kalır) ve sağ panel ${Math.round(m.panel.w)} px (hedef 340–420)`, m.map.w / m.vw >= (w < 1280 ? 0.6 : 0.64) && m.map.w / m.vw <= 0.74 && m.panel.w >= 338 && m.panel.w <= 422, `${Math.round(m.map.w)} / ${Math.round(m.panel.w)}`);
    else ok(`R${w}-4 Mobil: harita üstte, sonuçlar hemen altında`, m.map.t < m.panel.t && m.panel.t - m.map.b < 100 && m.map.h >= 380, `${Math.round(m.map.h)} / ${Math.round(m.panel.t - m.map.b)}`);
    ok(`R${w}-5 Yazı ölçüsü: gövde 15 px, ana KPI 28–36 px`, m.body === 15 && m.big >= 28 && m.big <= 36, `${m.body}/${m.big}`);
    if (w === 390 || w === 1440 || w === 768) await q.screenshot({ path: `/tmp/claude-0/s6/r${w}.png` });
    await c.close();
  }
  /* %200 yakınlaştırma (1440 → 720 css px) */
  const zc = await b.newContext({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2 }); await H.stubServices(zc, {}); const zq = await zc.newPage(); await zq.goto(url); await H.waitMap(zq); await H.waitPlan(zq); await zq.waitForTimeout(500);
  ok('R200 %200 yakınlaştırmada yatay taşma yok, temel kontroller tıklanabilir', (await zq.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1 && await zq.evaluate(() => ['pp', 'rs', 'myNums3', 'goAnalysis'].every(id => { const e = document.getElementById(id); return e && e.getBoundingClientRect().height >= 36; })) && (await zq.isEnabled('#pp'))); await zc.close();
  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('KALDI')).length; console.log(out.length + ' kontrol, ' + bad + ' kalan'); await b.close(); process.exit(bad ? 1 : 0);
})();
