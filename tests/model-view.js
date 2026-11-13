/* 3D modelleri harita olmadan, farklı açılardan çizer (model doğrulaması). */
const { chromium } = require('playwright'); const H = require('./helpers'); const fs = require('fs');
(async () => { const b = await chromium.launch({ args: H.ARGS }); const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.setContent('<body style="margin:0;background:#cfd3d8"><canvas id=c width=1200 height=800></canvas></body>');
  await p.addScriptTag({ content: fs.readFileSync('vendor/three.min.js', 'utf8') }); await p.addScriptTag({ content: fs.readFileSync('ui/van3d.js', 'utf8') });
  const res = await p.evaluate(({ type, color }) => { const T = THREE, r = new T.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true }); r.setSize(1200, 800);
    const out = {}; window.__draw = (type, color, simple, az, el, dist) => { const sc = new T.Scene(); sc.background = new T.Color(0x14161b); sc.add(new T.AmbientLight(0xffffff, .7)); const d = new T.DirectionalLight(0xffffff, .95); d.position.set(.6, -.4, 1); sc.add(d); const d2 = new T.DirectionalLight(0xbcd0ff, .35); d2.position.set(-.7, .5, .4); sc.add(d2);
      const g = window.RobovanVan3D.buildVan(T, type, color, simple); g.rotation.x = -Math.PI / 2; sc.add(g); const cam = new T.PerspectiveCamera(32, 1.5, .1, 100); const a = az * Math.PI / 180, e = el * Math.PI / 180; cam.position.set(Math.sin(a) * Math.cos(e) * dist, Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist); cam.lookAt(0, 1.4, 0); r.render(sc, cam); return document.getElementById('c').toDataURL('image/png'); }; return true; }, {});
  const views = [['front-right', 35, 14], ['side-right', 90, 6], ['rear-left', 215, 16], ['top', 60, 62]];
  for (const type of ['robovan', 'conventional']) for (const [n, az, el] of views) { const url = await p.evaluate(([t, c, az, el]) => window.__draw(t, c, false, az, el, 16.5), [type, type === 'robovan' ? '#1FC2AE' : '#E2803F', az, el]); fs.writeFileSync(`/tmp/claude-0/model/${type}-${n}.png`, Buffer.from(url.split(',')[1], 'base64')); }
  console.log('errors', errs); await b.close(); })();
