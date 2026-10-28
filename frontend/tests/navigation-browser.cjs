/* Optional dependency-free Chrome/CDP smoke test. Only synthetic API responses. */
const { spawn } = require('node:child_process');
const { mkdtempSync, existsSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const chromePath = process.env.BYB_TEST_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(chromePath)) throw new Error('Set BYB_TEST_CHROME to a Chrome executable');
const port = Number(process.env.BYB_TEST_PORT || 3163);
const debugPort = port + 1;
const origin = `http://127.0.0.1:${port}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, message) {
  for (let attempt = 0; attempt < 100; attempt++) { try { if (await test()) return; } catch { /* DOM may be navigating. */ } await delay(75); }
  throw new Error(`Timed out: ${message}`);
}
const children = [];
let ws;
const requests = [];
(async () => {
  const server = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: join(__dirname, '..'), env: { ...process.env, NEXT_PUBLIC_API_URL: 'https://api.example.invalid' }, stdio: 'ignore',
  });
  children.push(server);
  await until(async () => { try { return (await fetch(origin)).ok; } catch { return false; } }, 'Next server');
  const chrome = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'byb-f3-browser-'))}`, 'about:blank'], { stdio: 'ignore' });
  children.push(chrome);
  let target;
  await until(async () => {
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page'); return Boolean(target); }
    catch { return false; }
  }, 'Chrome target');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  const pending = new Map(); let id = 0;
  function call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`CDP timeout ${method}`)); }, 10000);
      pending.set(requestId, { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } });
      ws.send(JSON.stringify({ id: requestId, method, params }));
    });
  }
  let failOnce = true;
  const stamp = '2026-10-21T12:00:00.000Z';
  ws.onmessage = async event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id); pending.delete(message.id);
      if (request) message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
      return;
    }
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params;
    const url = new URL(request.url);
    let body = {}; let status = 200;
    if (request.method !== 'OPTIONS') {
      requests.push(url.pathname + url.search);
      if (url.pathname === '/api/search/options') body = {
        merchants: [{ code: 'ebay', name: 'eBay' }, { code: 'aliexpress', name: 'AliExpress' }],
        categories: [{ id: '00000000-0000-4000-8000-000000000003', slug: 'headphones', name: 'Headphones', parentId: null }], currencies: ['USD', 'GEL'],
      };
      else if (url.pathname === '/api/search/suggestions') {
        const q = url.searchParams.get('q');
        if (q === 'So') await delay(350);
        body = { suggestions: [`${q} catalog model`, `${q} alternate model`] };
      } else if (url.pathname === '/api/search') {
        const q = url.searchParams.get('q');
        if (q === 'Old') await delay(600);
        if (q === 'Fail' && failOnce) { failOnce = false; status = 503; body = { message: 'Synthetic failure' }; }
        else body = { products: [{ id: '00000000-0000-4000-8000-000000000001', slug: 'synthetic', name: `Result for ${q}`, brand: null, model: null,
          description: null, categoryId: null, attributes: { condition: 'Used' }, imageUrl: null, isActive: true, createdAt: stamp, updatedAt: stamp,
          offers: [{ id: '00000000-0000-4000-8000-000000000002', productId: '00000000-0000-4000-8000-000000000001', merchantId: 'ebay', marketId: 'ge', externalProductId: 'synthetic',
            merchant: { id: 'ebay', code: 'ebay', name: 'eBay', logoUrl: null }, priceAmount: 1999, currencyCode: 'USD', availability: 'unknown', shippingInfo: {}, affiliateMetadata: {},
            destinationUrl: 'https://merchant.example.test/item', lastCheckedAt: stamp, createdAt: stamp, updatedAt: stamp, isActive: true }] }],
          total: 3, totalPages: 3, page: Number(url.searchParams.get('page') || '1'), limit: 20, query: Object.fromEntries(url.searchParams) };
      }
    }
    try { await call('Fetch.fulfillRequest', { requestId, responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin },
        { name: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS' }, { name: 'Access-Control-Allow-Headers', value: 'content-type' }],
      body: Buffer.from(JSON.stringify(body)).toString('base64') }); } catch { /* Aborted requests may no longer exist. */ }
  };
  await call('Page.enable'); await call('Runtime.enable');
  await call('Fetch.enable', { patterns: [{ urlPattern: 'https://api.example.invalid/*', requestStage: 'Request' }] });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitText = text => until(() => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), text);
  const hasParam = (key, value) => until(() => evaluate(`new URL(location.href).searchParams.get(${JSON.stringify(key)}) === ${JSON.stringify(value)}`), `${key}=${value}`);
  const input = async (selector, value) => {
    await evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)}); input.focus(); input.select();})()`);
    await call('Input.insertText', { text: value });
  };
  const key = async name => {
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, ...(name === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}), windowsVirtualKeyCode: { Enter: 13, ArrowDown: 40, Escape: 27 }[name] });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name });
  };
  const select = (label, value) => evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(label=>label.textContent.trim().startsWith(${JSON.stringify(label)})); const select=label.querySelector('select'); select.value=${JSON.stringify(value)}; select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const check = async (condition, message) => assert.equal(await evaluate(condition), true, message);

  const screenshot = async name => {
    const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(tmpdir(), `byb-nav1-${name}.png`), Buffer.from(shot.data, 'base64'));
  };
  const overflow = () => check('document.documentElement.scrollWidth <= innerWidth', 'no horizontal overflow');
  const click = async selector => {
    const rect = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...rect });
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...rect });
  };
  for (const width of [390, 768, 1440]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    for (const theme of ['dark', 'light']) {
      await call('Page.navigate', { url: `${origin}/about?market=AM` }); await waitText('Better purchase decisions');
      await until(() => evaluate(`document.querySelector('.header-utilities select').value==='2'`), 'market hydration');
      await select('Theme', theme); await until(() => evaluate(`document.documentElement.dataset.theme==='${theme}'`), 'theme applied');
      await overflow(); await screenshot(`${width}-${theme}-about`);
      if (width === 1440) {
        await evaluate(`document.querySelector('[aria-controls="nav-discover"]').focus()`); await key('Enter');
        await until(() => evaluate(`!document.querySelector('#nav-discover').hidden`), 'Enter opens Discover');
        await key('Escape'); await check(`document.querySelector('#nav-discover').hidden && document.activeElement.getAttribute('aria-controls')==='nav-discover'`, 'Escape restores focus');
        await click('[aria-controls="nav-discover"]'); await click('[aria-controls="nav-discover"]'); await check(`document.querySelector('#nav-discover').hidden`, 'toggle Discover');
        await evaluate(`document.querySelector('[aria-controls="nav-categories"]').focus()`); await key('ArrowDown');
        await until(() => evaluate(`document.activeElement.closest('#nav-categories')!==null`), 'ArrowDown enters categories');
        await overflow(); await screenshot(`${width}-${theme}-mega`);
        await call('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, x: 850, y: 850 });
        await call('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, x: 850, y: 850 });
        await check(`document.querySelector('#nav-categories').hidden`, 'outside click closes categories');
        await click('[aria-controls="nav-categories"]'); await key('Escape');
        await check(`document.querySelector('#nav-categories').hidden`, 'Escape closes categories');
        await input('#header-search-input', 'headphones'); await key('Enter'); await hasParam('q', 'headphones'); await hasParam('market', 'AM');
      } else {
        await evaluate(`document.querySelector('[aria-controls="nav-mobile"]').focus()`); await key('Enter');
        await until(() => evaluate(`!document.querySelector('#nav-mobile').hidden`), 'mobile menu opens');
        await click('#nav-mobile nav > details:nth-child(2) > summary');
        await click('#nav-mobile nav > details:nth-child(2) details > summary');
        await overflow(); await screenshot(`${width}-${theme}-mobile`);
        await check(`document.querySelector('#nav-mobile a[href*="q=phone"]').href.includes('market=AM')`, 'mobile category preserves market');
        await key('Escape'); await check(`document.querySelector('#nav-mobile').hidden && document.activeElement.getAttribute('aria-controls')==='nav-mobile'`, 'mobile Escape focus');
        await click('[aria-controls="nav-mobile"]'); await click('[aria-controls="nav-mobile"]');
        await check(`document.querySelector('#nav-mobile').hidden`, 'mobile toggle');
      }
      for (const route of ['how-it-works', 'partners', 'affiliate-disclosure', 'contact']) {
        await call('Page.navigate', { url: `${origin}/${route}?market=AM` });
        await until(() => evaluate(`location.pathname==='/${route}' && Boolean(document.querySelector('.information-page h1'))`), route);
        await overflow(); await screenshot(`${width}-${theme}-${route}`);
      }
      await call('Page.navigate', { url: `${origin}/?market=AZ` }); await waitText('Find your next good find.');
      await until(() => evaluate(`document.querySelector('.header-utilities select').value==='3'`), 'homepage market preservation');
      await check(`document.querySelector('.home-categories').compareDocumentPosition(document.querySelector('#discovery')) & Node.DOCUMENT_POSITION_FOLLOWING ? true : false`, 'homepage category first');
      await overflow(); await screenshot(`${width}-${theme}-home`);
    }
  }
  await call('Page.navigate', { url: `${origin}/about` }); await waitText('Better purchase decisions');
  await select('Select market', '2');
  await check(`document.querySelector('input[name=market]').value==='AM'`, 'market selector works');
  await select('Theme', 'dark'); await check(`document.documentElement.dataset.theme==='dark'`, 'theme selector works');
  await select('Select language', 'ka'); await until(() => evaluate(`document.documentElement.lang==='ka'`), 'language selector works');
  console.log(JSON.stringify({ passed: true, widths: [390,768,1440], themes: ['dark','light'], checks: ['Discover toggles','mega menu','Enter/ArrowDown/Escape','focus return','outside click','mobile nested categories','market preservation','search submission','preferences','public pages','category-first home','no overflow'], screenshots: '/tmp/byb-nav1-*.png' }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  ws?.close(); children.reverse().forEach(child => child.kill('SIGTERM'));
});
