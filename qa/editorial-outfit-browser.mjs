import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url).pathname;
const evidenceDir = new URL('./evidence/editorial-outfit/', import.meta.url).pathname;
const moduleRoots = [
  process.env.CODEX_WORKSPACE_NODE_MODULES,
  join(root, 'node_modules'),
  join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'),
].filter(Boolean);
const playwrightPath = moduleRoots.flatMap((moduleRoot) => [
  join(moduleRoot, 'playwright-core'),
  join(moduleRoot, 'playwright'),
]).find(existsSync);
if (!playwrightPath) throw new Error(`Playwright was not found. Checked: ${moduleRoots.join(', ')}`);
const { chromium } = require(playwrightPath);
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
const waitForImages = async (page) => page.waitForFunction(() => [...document.images]
  .filter((image) => image.offsetParent !== null)
  .every((image) => image.complete && image.naturalWidth > 0));
const capture = async (page, filename) => {
  await waitForImages(page);
  const path = join(evidenceDir, filename);
  await page.screenshot({ path, fullPage: false });
  assert.ok((await stat(path)).size > 10_000, `${filename} must contain rendered pixels`);
};
const noOverflow = async (page, label) => {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(dimensions.scrollWidth <= dimensions.clientWidth, `${label} overflows: ${JSON.stringify(dimensions)}`);
};

async function normalJourney(page, width) {
  await page.goto(`${page.baseURL}/work/editorial-outfit-tab/index.html`);
  const visualFoundation = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const button = getComputedStyle(document.querySelector('.search-action'));
    const card = getComputedStyle(document.querySelector('.story-card'));
    const feed = getComputedStyle(document.querySelector('.feed'));
    const nav = getComputedStyle(document.querySelector('.bottom-nav'));
    return {
      styleRuleCount: [...document.styleSheets].reduce((total, sheet) => total + sheet.cssRules.length, 0),
      bodyFontSize: body.fontSize,
      buttonFontSize: button.fontSize,
      cardRadius: card.borderRadius,
      feedColumns: feed.columnCount,
      navPosition: nav.position,
    };
  });
  assert.ok(visualFoundation.styleRuleCount > 30, `${width}: stylesheets loaded`);
  assert.equal(visualFoundation.bodyFontSize, '14px');
  assert.equal(visualFoundation.buttonFontSize, '12px');
  assert.equal(visualFoundation.cardRadius, '8px');
  assert.equal(visualFoundation.feedColumns, '2');
  assert.equal(visualFoundation.navPosition, 'fixed');
  await visible(page.locator('#feed-screen'), `${width}: feed is visible`);
  assert.ok(await page.locator('.story-card').count() >= 1, `${width}: feed has cards`);
  await noOverflow(page, `${width} feed`);

  const commute = page.getByRole('tab', { name: '通勤' });
  await commute.click();
  assert.equal(await commute.getAttribute('aria-selected'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.channel), '通勤', `${width}: selected channel keeps focus`);
  await capture(page, `feed-${width}.png`);

  const feedSave = page.locator('#feed-screen [data-action="toggle-save"]').first();
  const feedSaveStoryId = await feedSave.getAttribute('data-story-id');
  await feedSave.click();
  await page.waitForFunction((storyId) => document.activeElement?.dataset.action === 'toggle-save'
    && document.activeElement?.dataset.storyId === storyId, feedSaveStoryId);
  assert.deepEqual(await page.evaluate(() => ({
    action: document.activeElement?.dataset.action,
    storyId: document.activeElement?.dataset.storyId,
  })), { action: 'toggle-save', storyId: feedSaveStoryId }, `${width}: feed save keeps focus`);
  await page.keyboard.press('Shift+Tab');
  assert.deepEqual(await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    action: document.activeElement?.dataset.action,
    storyId: document.activeElement?.dataset.storyId,
  })), { tag: 'A', action: 'open-story', storyId: feedSaveStoryId }, `${width}: card main link is keyboard focusable`);
  await page.keyboard.press('Enter');
  await visible(page.locator('#detail-screen'), `${width}: Enter opens focused card`);
  await page.locator('[data-action="close-story"]').click();
  await visible(page.locator('#feed-screen'), `${width}: keyboard journey returns to feed`);

  await page.evaluate(() => window.scrollTo({ top: 280, behavior: 'auto' }));
  const beforeStory = await page.evaluate(() => window.scrollY);
  assert.ok(beforeStory > 0, `${width}: feed must be scrolled before opening a story`);
  const cardTitle = page.locator('.story-card__title').first();
  assert.equal(await cardTitle.locator('xpath=ancestor::a').getAttribute('data-action'), 'open-story');
  await cardTitle.click();
  await visible(page.locator('#detail-screen'), `${width}: detail is visible`);
  await visible(page.getByRole('tab', { name: '穿搭故事' }), `${width}: story tab`);
  await visible(page.getByRole('tab', { name: '整套商品' }), `${width}: products tab`);
  await visible(page.locator('#detail-screen [data-action="toggle-save"]'), `${width}: save control`);
  const detailSave = page.locator('#detail-screen [data-action="toggle-save"]');
  const detailSaveStoryId = await detailSave.getAttribute('data-story-id');
  await detailSave.click();
  await page.waitForFunction((storyId) => document.activeElement?.dataset.action === 'toggle-save'
    && document.activeElement?.dataset.storyId === storyId, detailSaveStoryId);
  assert.deepEqual(await page.evaluate(() => ({
    action: document.activeElement?.dataset.action,
    storyId: document.activeElement?.dataset.storyId,
  })), { action: 'toggle-save', storyId: detailSaveStoryId }, `${width}: detail save keeps focus`);
  await page.waitForFunction(() => window.scrollY === 0);
  await noOverflow(page, `${width} story`);
  const storyPanelStyle = await page.locator('.story-detail__body').evaluate((element) => {
    const style = getComputedStyle(element);
    return { paddingLeft: style.paddingLeft, introFont: getComputedStyle(element.querySelector('.story-detail__intro')).fontSize };
  });
  assert.equal(storyPanelStyle.paddingLeft, '16px');
  assert.equal(storyPanelStyle.introFont, '16px');
  if (width === 390) {
    await page.locator('.story-detail__title').scrollIntoViewIfNeeded();
    await capture(page, 'story-390.png');
  }

  await page.getByRole('tab', { name: '整套商品' }).click();
  assert.equal(await page.getByRole('tab', { name: '整套商品' }).getAttribute('aria-selected'), 'true');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  for (const button of await page.locator('[data-action="choose-spec"]').all()) await button.click();
  const checkout = page.locator('[data-action="buy-selection"]');
  assert.equal(await checkout.isEnabled(), true, `${width}: checkout enabled after specs`);
  const ctaStyle = await checkout.evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, appearance: style.appearance, radius: style.borderRadius };
  });
  assert.equal(ctaStyle.background, 'rgb(255, 0, 60)');
  assert.equal(ctaStyle.appearance, 'none');
  assert.equal(ctaStyle.radius, '20px');
  if (width === 390) await capture(page, 'products-390.png');
  const firstSelected = page.locator('[data-action="toggle-product"]:checked').first();
  await firstSelected.click();
  assert.match(await checkout.textContent(), /购买已选/);
  await checkout.click();
  await visible(page.locator('#toast'), `${width}: purchase feedback`);
  assert.match(await page.locator('#toast').textContent(), /已确认购买已选商品（原型）/);
  await page.locator('[data-action="close-story"]').click();
  assert.equal(await page.getByRole('tab', { name: '通勤' }).getAttribute('aria-selected'), 'true');
  await page.waitForFunction((expected) => Math.abs(window.scrollY - expected) <= 8, beforeStory);
  const restored = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(restored - beforeStory) <= 8, `${width}: feed scroll restored ${beforeStory} -> ${restored}`);
  await noOverflow(page, `${width} restored feed`);
}

async function edgeStates(page, browserSignals) {
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
  browserSignals.intentionalBrokenImage = true;
  await select.selectOption('broken-image');
  await page.locator('.image-fallback').first().waitFor({ state: 'visible' });
  await page.waitForTimeout(100);
  browserSignals.intentionalBrokenImage = false;
  await select.selectOption('partial-sold-out');
  await visible(page.getByText('已售罄').first(), 'partial sold-out label');
  assert.equal(await page.locator('[data-action="buy-selection"]').isDisabled(), true, 'partial fixture awaits spec');
  await select.selectOption('all-unavailable');
  assert.ok(await page.getByText('已失效').count() >= 1, 'all-unavailable labels');
  assert.equal(await page.locator('[data-action="buy-selection"]').isDisabled(), true, 'all-unavailable checkout disabled');
  assert.match(await page.locator('[data-action="buy-selection"]').textContent(), /请选择商品/);

  await select.selectOption('normal');
  await page.locator('.story-card__title').first().click();
  const activeStoryId = await page.locator('#detail-screen [data-action="toggle-save"]').getAttribute('data-story-id');
  await select.selectOption('loading');
  await visible(page.locator('[data-detail-state="loading"] [aria-label="穿搭故事加载中"]'), 'detail story skeleton');
  assert.equal(await page.locator('#detail-screen').isVisible(), true, 'story loading stays in detail');
  await select.selectOption('error');
  await visible(page.getByText('穿搭故事暂时无法加载'), 'detail story error');
  await select.selectOption('normal');
  assert.equal(await page.locator('#detail-screen [data-action="toggle-save"]').getAttribute('data-story-id'), activeStoryId, 'normal restores active story');
  await page.getByRole('tab', { name: '整套商品' }).click();
  await select.selectOption('loading');
  await visible(page.locator('[data-detail-state="loading"] [aria-label="整套商品加载中"]'), 'detail products skeleton');
  await select.selectOption('error');
  await visible(page.getByText('商品数据暂时无法加载'), 'detail products error');
  await page.locator('[data-action="retry-detail"]').click();
  assert.equal(await page.getByRole('tab', { name: '整套商品' }).getAttribute('aria-selected'), 'true', 'detail retry preserves products view');
  assert.equal(await page.locator('#products-detail-' + activeStoryId).isVisible(), true, 'detail retry preserves active story');
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
    const browserSignals = { intentionalBrokenImage: false, intentional404Count: 0 };
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('response', (response) => {
      if (response.status() !== 404) return;
      const pathname = new URL(response.url()).pathname;
      const intentionalPath = /\/assets\/missing-(?:image|gallery|product)\.jpg$/.test(pathname);
      if (browserSignals.intentionalBrokenImage && intentionalPath) browserSignals.intentional404Count += 1;
      else errors.push(`unexpected 404: ${response.url()}`);
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const isResource404 = message.text().includes('Failed to load resource: the server responded with a status of 404');
      if (!(browserSignals.intentionalBrokenImage && isResource404)) errors.push(`console: ${message.text()}`);
    });
    await normalJourney(page, viewport.width);
    if (viewport.width === 390) {
      await edgeStates(page, browserSignals);
      assert.ok(browserSignals.intentional404Count >= 1, 'broken image fixture produced exact intentional 404s');
    }
    assert.deepEqual(errors, [], `${viewport.width}: browser errors`);
    await context.close();
  }
  console.log('Editorial outfit browser QA passed at 390x844 and 320x720.');
} finally {
  if (browser) await browser.close();
  if (server.listening) await closeServer();
}
