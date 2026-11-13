'use strict';
/* index.html üretir: motor + veri + harita + grafikler + uygulama + css tek dosyada. Harita kütüphanesi ve Three.js gömülüdür; açılışta yalnız harita/rota servislerine istek gider. */
const fs = require('fs'), path = require('path');
const r = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
require('./build.js');
let html = r('ui/index.template.html');
const swap = (k, v) => { html = html.split(k).join('\n' + v.replace(/<\/script>/g, '<\\/script>') + '\n'); };
swap('/*__CSS__*/', r('ui/styles.css')); swap('/*__ENGINE__*/', r('dist/engine.bundle.js')); swap('/*__DATA__*/', r('ui/data.js')); swap('/*__DEMO__*/', r('ui/demoRoute.js'));
swap('/*__MAPLIBRE__*/', r('vendor/maplibre-gl.js')); swap('/*__MAPLIBRE_CSS__*/', r('vendor/maplibre-gl.css')); swap('/*__THREE__*/', r('vendor/three.min.js')); swap('/*__VAN3D__*/', r('ui/van3d.js')); swap('/*__MAP__*/', r('ui/map.js')); swap('/*__CHARTS__*/', r('ui/charts.js')); swap('/*__APP__*/', r('ui/app.js'));
const font = (sub, w, range) => `@font-face{font-family:'Inter Tight';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(__dirname, '../vendor/fonts/inter-tight-' + sub + '-' + w + '-normal.woff2')).toString('base64')}) format('woff2');unicode-range:${range}}`;
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATINEXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
const FONTS = [400, 500, 600].map((w) => font('latin-ext', w, LATINEXT) + '\n' + font('latin', w, LATIN)).join('\n');
html = html.split('/*__FONTS__*/').join(FONTS);
const b64 = (p) => fs.readFileSync(path.join(__dirname, '..', p)).toString('base64');
html = html.split('/*__LOGO__*/').join('data:image/png;base64,' + b64('assets/tripy-robovan-logo.png')).split('/*__FAVICON__*/').join('data:image/png;base64,' + b64('assets/favicon.png'));
fs.writeFileSync(path.join(__dirname, '../dist/index.html'), html);
console.log('dist/index.html', html.length, 'bayt');
