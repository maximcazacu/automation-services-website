// Browser checks against a clean static build. No messages are sent.
// Usage: NODE_PATH=<bundled modules> node test_browser.cjs <build-directory> <evidence-directory>
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(process.argv[2]);
const evidence = path.resolve(process.argv[3]);
const basePath = (process.argv[4] || '').replace(/\/$/,'');
fs.mkdirSync(evidence, {recursive:true});
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png'};
const server = http.createServer((req,res) => {
  let pathname = new URL(req.url,'http://localhost').pathname;
  if (basePath && !pathname.startsWith(basePath + '/')) {res.writeHead(404);res.end();return;}
  pathname = pathname.slice(basePath.length);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (req.method !== 'GET' || !file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain','Cache-Control':'no-store'});
  res.end(fs.readFileSync(file));
});
const results = [];
let browser;
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = 'http://127.0.0.1:' + server.address().port + basePath;
  browser = await chromium.launch({headless:true, executablePath:process.env.FLUXCLAR_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [], errors = [];
  context.on('request',r => requests.push({url:r.url(), method:r.method()}));
  page.on('pageerror',e => errors.push(e.message));
  const routes = ['/','/fluxclar-ops.html','/prestator.html','/privacy.html','/cookies.html'];
  for (const width of [1440,390,320,720]) {
    await page.setViewportSize({width,height:900});
    for (const route of routes) {
      assert.equal((await page.goto(base + route)).status(),200);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('footer a[href="prestator.html"]').count(),1);
      assert.equal(await page.locator('footer a[href="privacy.html"]').count(),1);
      assert.equal(await page.locator('footer a[href="cookies.html"]').count(),1);
      assert.equal(await page.locator('[data-cookie-settings], #cookie-banner, #booking-link').count(),0);
      const overflow = await page.evaluate(() => ({doc:document.documentElement.scrollWidth, viewport:innerWidth}));
      assert(overflow.doc <= overflow.viewport + 1,JSON.stringify({route,width,overflow}));
      if (width === 390 || width === 1440) await page.screenshot({path:path.join(evidence,`${width}-${route === '/' ? 'index' : route.slice(1,-5)}.png`),fullPage:true});
      if (width === 390 && route === '/') await page.locator('#contact').screenshot({path:path.join(evidence,'390-contact.png')});
    }
  }
  results.push('20 route/viewport checks: 1440, 390, 320, 720 CSS px; legal footer; no overflow');
  await page.setViewportSize({width:1440,height:1000});
  for (const route of routes) {
    await page.goto(base+route);
    await page.evaluate(()=>{document.documentElement.style.zoom='2';});
    const zoomLayout = await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width}))}));
    assert(zoomLayout.scroll<=zoomLayout.width+1,'200% layout overflow: '+route+' '+JSON.stringify(zoomLayout));
  }
  results.push('Five routes at CSS zoom 200%; no horizontal overflow (native browser zoom and screen reader still need staging review)');
  for (const denied of ['/refund-policy.html','/admin','/database/fluxclar.sqlite3','/server.py','/launch.json','/analytics.js','/cookies.js']) assert.equal((await page.request.get(base+denied)).status(),404);
  results.push('Private, draft and optional scripts return 404 from static package');
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/fluxclar-ops.html');
  await page.getByRole('link',{name:'Discută un pilot în 3 magazine'}).first().click();
  assert.equal(await page.locator('#service').inputValue(),'Pilot FluxClar Ops');
  assert.equal(await page.locator('#service option:checked').getAttribute('data-code'),'workflows');
  assert.match(await page.locator('#message').inputValue(),/FluxClar Ops/);
  assert.match(await page.locator('#message-hint').textContent(),/magazine/);
  await page.locator('#inquiry-button').click();
  const mail = new URL(await page.locator('#mail-draft').getAttribute('href'));
  assert.equal(mail.protocol,'mailto:');
  assert.equal(mail.pathname,'maximcazacu0501@mail.com');
  assert.match(mail.searchParams.get('subject'),/Pilot FluxClar Ops/);
  assert.match(mail.searchParams.get('body'),/FluxClar Ops/);
  assert.match(await page.locator('#form-status').textContent(),/Nu a fost trimisă/);
  assert.equal(await page.locator('#mail-draft').evaluate(e=>e===document.activeElement),true);
  results.push('Ops CTA preserves pilot=ops, workflows code, draft subject and focus; mailto encoded correctly');
  await page.locator('#message').fill('   ');
  await page.locator('#inquiry-button').click();
  assert.equal(await page.locator('#message').getAttribute('aria-invalid'),'true');
  assert.equal(await page.locator('#message').evaluate(e=>e===document.activeElement),true);
  assert(await page.locator('#message-error').isVisible());
  await page.locator('#message').fill('Test sintetic: verificare & diacritice șț <script> fără date reale.');
  assert.equal(await page.locator('#message').getAttribute('aria-invalid'),null);
  await page.locator('#inquiry-button').click();
  assert.equal(await page.locator('#form-status').getAttribute('role'),'status');
  await page.evaluate(() => {Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied');}}});});
  await page.locator('#copy-button').click();
  assert.match(await page.locator('#form-status').textContent(),/Ctrl\+C/);
  assert.equal(await page.locator('#copy-draft').evaluate(e=>e===document.activeElement),true);
  results.push('Required message error, correction, aria status, manual copy fallback after clipboard refusal');
  await page.goto(base+'/');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip').evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('main').evaluate(e=>e===document.activeElement),true);
  await page.locator('.menu-toggle').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('.menu-toggle').evaluate(e=>e===document.activeElement),true);
  await page.locator('[data-scenario="remote"]').focus();
  await page.keyboard.press('Enter');
  assert.match(page.url(),/scenariu=lucru-la-distanta/);
  await page.reload();
  assert.equal(await page.locator('[data-scenario="remote"]').getAttribute('aria-pressed'),'true');
  await page.goto(base+'/');
  assert.equal(await page.locator('[data-scenario="invoice"]').getAttribute('aria-pressed'),'true');
  results.push('Keyboard skip, menu Enter/Escape with focus return, demo via Enter, URL recall without persistence');
  assert.deepEqual(await context.cookies(),[]);
  assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
  assert.deepEqual(requests.filter(r=>!r.url.startsWith(base)),[]);
  assert.deepEqual(requests.filter(r=>r.method!=='GET'),[]);
  assert.deepEqual(errors,[]);
  results.push('No cookies, localStorage/sessionStorage, third-party requests, form POST or JavaScript errors');
  const nojs = await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const fallback = await nojs.newPage();
  await fallback.goto(base+'/');
  assert(await fallback.locator('#inquiry-button').isDisabled());
  assert.match(await fallback.locator('#direct-email').getAttribute('href'),/^mailto:/);
  assert(await fallback.locator('#inquiry noscript').isVisible());
  results.push('JavaScript disabled: visible mailto and instructions; form submission disabled');
  await nojs.close();
  // Test legacy local-only JSON contract in the browser using controlled mock responses.
  // This does NOT approve or deploy a public endpoint.
  const api = await browser.newContext();
  await api.route('**/config.js',route => route.fulfill({contentType:'text/javascript',body:'window.AUTOMATION_CONTACT_EMAIL="review@example.org";window.AUTOMATION_INQUIRY_ENDPOINT="/api/inquiries";window.FLUXCLAR_LOCAL_API=true;'}));
  const payloads = [];
  await api.route('**/api/inquiries',route => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({status:payloads.length===1?503:200,contentType:'application/json',body:JSON.stringify({received:payloads.length!==1})});
  });
  const a = await api.newPage();
  await a.goto(base+'/?pilot=ops#contact');
  await a.locator('#reply-email').fill('review@example.org');
  await a.locator('#inquiry-button').click();
  await a.locator('#form-status').filter({hasText:'Nu am putut confirma'}).waitFor();
  await a.locator('#email-fallback').click();
  assert(await a.locator('#draft-panel').isVisible());
  await a.locator('#inquiry-button').click();
  await a.locator('#form-status').filter({hasText:'Cererea a fost primită'}).waitFor();
  assert.equal(payloads.length,2);
  assert.deepEqual(payloads[0],payloads[1]);
  assert.match(payloads[0].request_id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(payloads[0].service,'workflows');
  results.push('LOCAL mock only: 503 preserves data and email fallback; identical UUID v4 retry; confirmation after received:true');
  fs.writeFileSync(path.join(evidence,'browser-results.json'),JSON.stringify({passed:true,results,requests:requests.length,externalRequests:0,errors},null,2));
  console.log(results.join('\n'));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
