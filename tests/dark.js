const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:1440,height:900},colorScheme:'dark'})).newPage();
await p.goto('file://'+process.argv[2]);await p.waitForTimeout(800);
await p.screenshot({path:'shots/desktop-dark.png'});
await p.evaluate(()=>document.querySelector('#results').scrollIntoView());await p.waitForTimeout(300);
await p.screenshot({path:'shots/desktop-dark2.png'});await b.close();})();
