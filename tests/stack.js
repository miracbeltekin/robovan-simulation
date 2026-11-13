const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();p.on('pageerror',e=>console.log(e.stack.split('\n').slice(0,4).join('\n')));await p.goto('file://'+process.argv[2]);await p.waitForTimeout(500);await b.close();})();
