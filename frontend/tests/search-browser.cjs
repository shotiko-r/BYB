/* Optional dependency-free Chrome/CDP smoke test. Only synthetic API responses. */
const { spawn } = require('node:child_process');
const { mkdtempSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const chromePath = process.env.BYB_TEST_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(chromePath)) throw new Error('Set BYB_TEST_CHROME to a Chrome executable');
const port = Number(process.env.BYB_TEST_PORT || 3113);
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
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: { Enter: 13, ArrowDown: 40, Escape: 27 }[name] });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name });
  };
  const select = (label, value) => evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(label=>label.textContent.trim().startsWith(${JSON.stringify(label)})); const select=label.querySelector('select'); select.value=${JSON.stringify(value)}; select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const check = async (condition, message) => assert.equal(await evaluate(condition), true, message);

  await call('Page.navigate', { url: `${origin}/search?q=Sony&market=GE&page=2&sort=newest&merchant=ebay&currency=USD&minPrice=29&maxPrice=1999` });
  await waitText('Result for Sony');
  await check(`document.querySelector('main input[type=search]').value==='Sony' && document.querySelector('#sort').value==='newest'`, 'URL hydration');
  await check(`document.querySelector('input[name=min]').value==='0.29' && document.querySelector('input[name=max]').value==='19.99'`, 'major-unit price hydration');
  await evaluate(`[...document.querySelectorAll('fieldset label')].find(label=>label.textContent.includes('AliExpress')).querySelector('input').click()`);
  await hasParam('merchant', 'aliexpress,ebay'); await hasParam('page', null);
  await evaluate('history.back()'); await hasParam('page', '2'); await hasParam('merchant', 'ebay');
  await until(() => evaluate(`![...document.querySelectorAll('fieldset label')].find(label=>label.textContent.includes('AliExpress')).querySelector('input').checked`), 'Back restored merchant control');
  await evaluate('history.forward()'); await hasParam('merchant', 'aliexpress,ebay');
  await select('Category', 'headphones'); await hasParam('category', 'headphones');
  await waitText('Category: Headphones');
  await select('Currency', ''); await hasParam('currency', null);
  const before = requests.filter(url => url.startsWith('/api/search?')).length;
  await select('Sort by:', 'price_asc'); await hasParam('sort', 'price_asc'); await waitText('Choose a currency to sort or filter by price.');
  await delay(150); assert.equal(requests.filter(url => url.startsWith('/api/search?')).length, before, 'No price request without currency');
  await select('Currency', 'USD'); await hasParam('currency', 'USD'); await waitText('Result for Sony');
  await input('input[name=min]', '0.29'); await input('input[name=max]', '19.99');
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='Apply price range').click()`);
  await hasParam('minPrice', '29'); await hasParam('maxPrice', '1999');
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='Clear all filters').click()`);
  await hasParam('currency', null); await hasParam('merchant', null); await hasParam('sort', 'relevance');
  await call('Page.reload'); await waitText('Result for Sony'); await check(`document.querySelector('main input[type=search]').value==='Sony'`, 'reload retains query');

  await input('main input[type=search]', 'So'); await delay(225); await input('main input[type=search]', 'Sony');
  await until(() => evaluate(`document.querySelector('[role=listbox]')?.innerText.includes('Sony catalog model')`), 'latest suggestions');
  await delay(400); await check(`!document.querySelector('[role=listbox]').innerText.includes('So catalog model')`, 'stale suggestion ignored');
  await key('ArrowDown'); await check(`Boolean(document.querySelector('[aria-activedescendant]'))`, 'active option accessibility');
  await key('Enter'); await hasParam('q', 'Sony catalog model'); await waitText('Result for Sony catalog model');
  await input('main input[type=search]', 'Bose'); await until(() => evaluate(`Boolean(document.querySelector('[role=listbox]'))`), 'Bose suggestions');
  await key('Escape'); await check(`document.querySelector('[role=combobox]').getAttribute('aria-expanded')==='false'`, 'Escape closes list');
  await input('main input[type=search]', 'Old'); await key('Enter'); await hasParam('q', 'Old');
  await input('main input[type=search]', 'New'); await key('Enter'); await hasParam('q', 'New'); await waitText('Result for New');
  await delay(750); await check(`!document.body.innerText.includes('Result for Old')`, 'late response cannot replace new results');
  await input('main input[type=search]', 'Fail'); await key('Enter'); await waitText('Search could not be completed. Please try again.');
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='Retry').click()`); await waitText('Result for Fail');
  const blankBefore = requests.filter(url => url.startsWith('/api/search?')).length;
  await call('Page.navigate', { url: `${origin}/search` }); await waitText('Search listings'); await delay(250);
  assert.equal(requests.filter(url => url.startsWith('/api/search?')).length, blankBefore, 'blank q does not fetch search');
  console.log(JSON.stringify({ passed: true, checks: ['URL hydration', 'Back/Forward', 'page reset', 'controlled category', 'explicit currency', 'exact money', 'clear filters', 'reload', 'autocomplete race/keyboard/Escape', 'search race', 'retry', 'blank query'], syntheticSearchRequests: requests.filter(url => url.startsWith('/api/search?')).length }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  ws?.close(); children.reverse().forEach(child => child.kill('SIGTERM'));
});
