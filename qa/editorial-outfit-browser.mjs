import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = new URL('../', import.meta.url).pathname;
const evidenceDir = new URL('./evidence/editorial-outfit/', import.meta.url).pathname;
const mime = new Map([['.html', 'text/html'], ['.mjs', 'text/javascript'], ['.css', 'text/css'], ['.svg', 'image/svg+xml']]);

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const relative = pathname === '/' ? 'work/editorial-outfit-tab/index.html' : pathname.slice(1);
  const file = normalize(join(root, relative));
  if (!file.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  const stream = createReadStream(file);
  stream.on('error', () => response.writeHead(404).end('Not found'));
  response.setHeader('Content-Type', mime.get(extname(file)) ?? 'application/octet-stream');
  stream.pipe(response);
});

const listen = () => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});
const closeServer = () => new Promise((resolve) => server.close(resolve));
const visible = async (locator, message) => assert.equal(await locator.isVisible(), true, message);
const noOverflow = async (page, label) => {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `${label} overflows: ${JSON.stringify(dimensions)}`);
};

async function normalJourney(page, width) {
  await page.goto(`${page.baseURL}/work/editorial-outfit-tab/index.html`);
  await visible(page.locator('#feed-screen'), `${width}: feed is visible`);
  assert.ok(await page.locator('.story-card').count() >= 1, `${width}: feed has cards`);
  await noOverflow(page, `${width} feed`);

  const commute = page.getByRole('tab', { name: '通勤' });
  await commute.click();
  assert.equal(await commute.getAttribute('aria-selected'), 'true');
  await page.screenshot({ path: join(evidenceDir, `feed-${width}.png`), fullPage: true });

  await page.evaluate(() => window.scrollTo({ top: 120, behavior: 'auto' }));
  const beforeStory = await page.evaluate(() => window.scrollY);
  await page.locator('[data-action="open-story"]').first().evaluate((element) => element.click());
  await visible(page.locator('#detail-screen'), `${width}: detail is visible`);
  await visible(page.getByRole('tab', { name: '穿搭故事' }), `${width}: story tab`);
  await visible(page.getByRole('tab', { name: '整套商品' }), `${width}: products tab`);
  await visible(page.locator('#detail-screen [data-action="toggle-save"]'), `${width}: save control`);
  await noOverflow(page, `${width} story`);
  if (width === 390) await page.screenshot({ path: join(evidenceDir, 'story-390.png'), fullPage: true });

  await page.getByRole('tab', { name: '整套商品' }).click();
  assert.equal(await page.getByRole('tab', { name: '整套商品' }).getAttribute('aria-selected'), 'true');
  for (const button of await page.locator('[data-action="choose-spec"]').all()) await button.click();
  const checkout = page.locator('[data-action="buy-selection"]');
  assert.equal(await checkout.isEnabled(), true, `${width}: checkout enabled after specs`);
  if (width === 390) await page.screenshot({ path: join(evidenceDir, 'products-390.png'), fullPage: true });
  const firstSelected = page.locator('[data-action="toggle-product"]:checked').first();
  await firstSelected.click();
  assert.match(await checkout.textContent(), /购买已选/);
  await checkout.click();
  await visible(page.locator('#toast'), `${width}: purchase feedback`);
  assert.match(await page.locator('#toast').textContent(), /已确认购买已选商品（原型）/);
  await page.locator('[data-action="close-story"]').click();
  assert.equal(await page.getByRole('tab', { name: '通勤' }).getAttribute('aria-selected'), 'true');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const restored = await page.evaluate(() => ({ y: window.scrollY, max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight) }));
  assert.ok(Number.isFinite(restored.y) && restored.y >= 0 && restored.y <= restored.max, `${width}: feed scroll is reasonable after returning: ${JSON.stringify(restored)} (before ${beforeStory})`);
  await noOverflow(page, `${width} restored feed`);
}

async function edgeStates(page) {
  await page.locator('details').evaluate((element) => { element.open = true; });
  const select = page.locator('[data-action="set-prototype-state"]');
  await select.selectOption('loading');
  await visible(page.locator('[aria-busy="true"]').first(), 'loading skeleton');
  await select.selectOption('empty');
  await visible(page.getByText('当前频道暂无内容'), 'empty state');
  assert.equal(await page.locator('[data-action="return-featured"]').isEnabled(), true);
  await select.selectOption('error');
  await visible(page.getByText('内容暂时无法加载'), 'error state');
  assert.equal(await page.locator('[data-action="retry-feed"]').isEnabled(), true);
  await select.selectOption('broken-image');
  await page.locator('.image-fallback').first().waitFor({ state: 'visible' });
  await select.selectOption('partial-sold-out');
  await visible(page.getByText('已售罄').first(), 'partial sold-out label');
  assert.equal(await page.locator('[data-action="buy-selection"]').isDisabled(), true, 'partial fixture awaits spec');
  await select.selectOption('all-unavailable');
  assert.ok(await page.getByText('已失效').count() >= 1, 'all-unavailable labels');
  assert.equal(await page.locator('[data-action="buy-selection"]').isDisabled(), true, 'all-unavailable checkout disabled');
  assert.match(await page.locator('[data-action="buy-selection"]').textContent(), /请选择商品/);
}

let browser;
try {
  await mkdir(evidenceDir, { recursive: true });
  const port = await listen();
  browser = await chromium.launch({ headless: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 720 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.baseURL = `http://127.0.0.1:${port}`;
    const errors = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      // The broken-image fixture intentionally requests missing local files to exercise fallback UI.
      if (message.type() === 'error' && !message.text().includes('Failed to load resource: the server responded with a status of 404')) {
        errors.push(`console: ${message.text()}`);
      }
    });
    await normalJourney(page, viewport.width);
    if (viewport.width === 390) await edgeStates(page);
    assert.deepEqual(errors, [], `${viewport.width}: browser errors`);
    await context.close();
  }
  console.log('Editorial outfit browser QA passed at 390x844 and 320x720.');
} finally {
  if (browser) await browser.close();
  if (server.listening) await closeServer();
}
