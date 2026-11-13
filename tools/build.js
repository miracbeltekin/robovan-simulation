'use strict';
/* src/ modüllerini tek dosyaya (IIFE) toplar: dist/engine.bundle.js. Aşama 4'te bu paket index.html içine gömülecek. */
const fs = require('fs'), path = require('path');
const order = ['defaults', 'geo', 'validate', 'engine', 'live', 'migrate', 'index'];
let out = "/* Robovan hesap motoru — otomatik üretildi, elle düzenlemeyin */\n(function (root) {\n'use strict';\nconst __mods = {}; const __defs = {};\nfunction __req(n) { n = n.replace(/^\\.\\//, ''); if (!__mods[n]) { const m = { exports: {} }; __defs[n](m, m.exports, __req); __mods[n] = m; } return __mods[n].exports; }\n";
order.forEach((n) => { const src = fs.readFileSync(path.join(__dirname, '../src', n + '.js'), 'utf8').replace(/^'use strict';\n/, '');
  out += `__defs[${JSON.stringify(n)}] = function (module, exports, require) {\n${src}\n};\n`; });
out += "const api = __req('index');\nif (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RobovanEngine = api;\n})(typeof window !== 'undefined' ? window : globalThis);\n";
fs.mkdirSync(path.join(__dirname, '../dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../dist/engine.bundle.js'), out);
console.log('dist/engine.bundle.js', out.length, 'bayt');
