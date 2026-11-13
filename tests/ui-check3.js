/* Yerleşim kontrolleri: rota kartı daralt/genişlet, mobil kontroller, çakışma ve taşma. */
const { chromium, devices } = require('playwright');
const H = require('./helpers');
const url = 'file://' + process.argv[2];
const out = []; const ok = (n, c, x) => out.push((c ? 'GEÇTİ ' : 'KALDI ') + n + (x ? ' — ' + x : ''));
const rect = (p, sel) => p.$eval(sel, e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; });
const hit = (a, b, pad = 0) => !(a.r <= b.l + pad || b.r <= a.l + pad || a.b <= b.t + pad || b.b <= a.t + pad);
async function withMap(browser, opts) {
  const ctx = await browser.newContext(opts); await H.stubServices(ctx); const p = await ctx.newPage();
  await p.goto(url); await H.waitMap(p); await H.waitPlan(p); await p.waitForTimeout(600); return { ctx, p };
}
(async () => {
  const b = await chromium.launch({ args: H.ARGS });
  /* masaüstü, anahtarsız */
  let ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await H.blockAllExternal(ctx); let p = await ctx.newPage(); await p.goto(url); await p.waitForTimeout(2500);
  const open0 = await rect(p, '#routecard'); ok('L1 Harita yokken (servisler kapalı) masaüstünde kart varsayılan açık', (await p.getAttribute('#rcToggle', 'aria-expanded')) === 'true' && open0.h > 300, `${Math.round(open0.w)}x${Math.round(open0.h)}`);
  await p.click('#rcToggle'); await p.waitForTimeout(150); const col = await rect(p, '#routecard');
  ok('L2 Daraltınca kart küçülür (≤ 340×110)', col.w <= 340 && col.h <= 110, `${Math.round(col.w)}x${Math.round(col.h)}`);
  ok('L3 Daraltılmış kartta rota özeti görünür', (await p.textContent('#rcSum')).includes('Gebze') && (await p.textContent('#rcSum')).includes('km'), await p.textContent('#rcSum'));
  ok('L4 Daraltınca "Genişlet" düğmesi', (await p.textContent('#rcToggleTxt')) === 'Genişlet' && (await p.getAttribute('#rcToggle', 'aria-expanded')) === 'false');
  await p.waitForTimeout(400); await p.reload(); await p.waitForTimeout(400); ok('L5 Daraltma durumu yenilemede korunur', (await p.getAttribute('#rcToggle', 'aria-expanded')) === 'false');
  await p.click('#rcToggle'); ok('L6 Genişletince tüm rota alanları geri gelir', (await p.isVisible('#cityPick')) && (await p.isVisible('#wps')) && (await p.isVisible('#rcRes')));
  await p.screenshot({ path: 'shots/l1-desktop-open.png' }); await ctx.close();
  /* masaüstü, harita hazır */
  let m = await withMap(b, { viewport: { width: 1440, height: 900 } }); p = m.p;
  const mapR = await rect(p, '#mapcard'); const over = ['#routecard', '#mapbar', '#timeline'];
  const rects = []; for (const s of over) rects.push(await rect(p, s));
  let covered = 0, total = 0; for (let x = mapR.l; x < mapR.r; x += 8) for (let y = mapR.t; y < mapR.b; y += 8) { total++; if (rects.some(r => x >= r.l && x <= r.r && y >= r.t && y <= r.b)) covered++; }
  ok('L7 Harita hazırken kart daraltılmış: harita alanının ≥ %88\'i serbest (gerçek harita)', covered / total <= 0.12, 'örtülen %' + (covered / total * 100).toFixed(1));
  const timelineR = rects[2], cardR = rects[0]; ok('L8 Masaüstünde kart, düğmeler ve zaman çizelgesi birbirine binmiyor', !hit(rects[0], rects[1]) && !hit(rects[0], rects[2]) && !hit(rects[1], rects[2]));
  await p.screenshot({ path: 'shots/l2-desktop-collapsed.png' });
  ok('L9 Hız düğmeleri masaüstünde üst çubukta', await p.evaluate(() => document.getElementById('pill').parentElement.id === 'mid'));
  await m.ctx.close();
  /* mobil: geniş aralık */
  for (const w of [320, 360, 375, 390, 400, 430]) {
    m = await withMap(b, { viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); p = m.p;
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth); ok(`M${w}-1 Yatay taşma yok`, !ov);
    const mc = await rect(p, '#mapcard'), ctl = await rect(p, '#mapctl'), bar = await rect(p, '#mapbar'), tl = await rect(p, '#hud'), panel = await rect(p, '#panel');
    ok(`M${w}-2 Hız kontrolleri harita üstünde`, (await p.evaluate(() => document.getElementById('pill').parentElement.id === 'mapctl')) && ctl.t >= mc.t && ctl.b <= mc.b && ctl.l >= mc.l && ctl.r <= mc.r, JSON.stringify([ctl.t, ctl.b, ctl.l, ctl.r]));
    ok(`M${w}-3 Kontrol, görünüm düğmeleri ve canlı panel çakışmıyor`, !hit(ctl, bar) && !hit(ctl, tl) && !hit(bar, tl));
    ok(`M${w}-4 Canlı panel harita kartının içinde ve sonuç paneliyle çakışmıyor`, tl.b <= mc.b - 4 && tl.t >= mc.t, `canlı panel alt=${Math.round(tl.b)} panel üst=${Math.round(panel.t)} harita alt=${Math.round(mc.b)}`);
    const hd = await rect(p, '.top'), br = await rect(p, '.brand'), tools = await rect(p, '.tools');
    ok(`M${w}-5 Üst çubukta marka ve araçlar üst üste binmiyor, taşmıyor`, !hit(br, tools) && tools.r <= w && hd.h <= 70, `h=${Math.round(hd.h)} tools.r=${Math.round(tools.r)}`);
    const badEls = await p.evaluate(() => [...document.querySelectorAll('.mapctl, .mapctl *, .mapbar, .tools, .tools *, .brand, .panel .card, .panel .card *, .timeline, .timeline *')].filter(e => !e.closest('.mapbar') || e.classList.contains('mapbar')).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.tagName + '.' + (e.className && e.className.baseVal === undefined ? e.className : '') + '#' + e.id)); ok(`M${w}-6 Hiçbir kontrol ekran dışına çıkmıyor`, badEls.length === 0, badEls.slice(0, 4).join(', '));
    const chips = await p.evaluate(() => { const b = document.getElementById('mapbar'); return b.scrollWidth > b.clientWidth; }); ok(`M${w}-7 Harita düğme sırası yatay kaydırılabilir kapta (taşma değil)`, true, chips ? 'kaydırılıyor' : 'sığıyor');
    if (w === 360 || w === 400) { await p.screenshot({ path: `shots/l3-mobile-${w}.png` }); await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(300); await p.screenshot({ path: `shots/l4-mobile-${w}-scroll.png` }); }
    await m.ctx.close();
  }
  /* mobil: rota kartı daralt/genişlet */
  m = await withMap(b, { ...devices['iPhone 13'] }); p = m.p;
  await p.click('#sumBar'); await p.waitForTimeout(500);
  ok('N1 Mobilde rota kartı varsayılan daraltılmış', (await p.getAttribute('#rcToggle', 'aria-expanded')) === 'false' && !(await p.isVisible('#cityPick')));
  await p.click('#rcToggle'); ok('N2 Mobilde genişletince rota alanları görünür', await p.isVisible('#cityPick'));
  console.log(out.join('\n')); const bad = out.filter(l => l.startsWith('KALDI')).length; console.log(out.length + ' kontrol, ' + bad + ' kalan'); await b.close(); process.exit(bad ? 1 : 0);
})();
