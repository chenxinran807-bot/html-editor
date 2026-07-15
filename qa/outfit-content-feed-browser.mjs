import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdir, access } from 'node:fs/promises';
import { delimiter, extname, join, normalize } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

async function loadPlaywright() {
  const moduleRoots = [
    process.env.CODEX_NODE_MODULES,
    ...(process.env.NODE_PATH || '').split(delimiter),
    join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'),
  ].filter(Boolean);
  for (const moduleRoot of moduleRoots) {
    const entry = join(moduleRoot, 'playwright/index.mjs');
    try {
      await access(entry);
      return import(pathToFileURL(entry).href);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Bundled Playwright was not found. Set CODEX_NODE_MODULES or NODE_PATH to the directory containing playwright (checked: ${moduleRoots.join(', ') || 'no candidates'}).`);
}

const { chromium } = await loadPlaywright();

const root = new URL('../work/douyin-outfit-content-feed/', import.meta.url).pathname;
const evidence = new URL('./evidence/outfit-content-feed/', import.meta.url).pathname;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.json': 'application/json' };
const checks = [];

function check(name, condition, detail = '') {
  assert.ok(condition, `${name}${detail ? `: ${detail}` : ''}`);
  checks.push(name);
  console.log(`PASS ${name}`);
}

async function startServer() {
  const server = http.createServer(async (request, response) => {
    try {
      const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
      const path = normalize(join(root, relative));
      if (!path.startsWith(root)) throw new Error('outside root');
      response.setHeader('Content-Type', mime[extname(path)] || 'application/octet-stream');
      response.end(await readFile(path));
    } catch {
      response.statusCode = 404;
      response.end('not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

async function waitReady(page) {
  await page.locator('#feed[data-feed-state="ready"] .card').first().waitFor();
}

async function waitForCanonicalLayout(page, stableLocator) {
  await page.locator('#toast').waitFor({ state: 'detached' });
  await stableLocator.waitFor({ state: 'visible' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function assertSelected(page, selector, value) {
  const selected = page.locator(`${selector}[aria-selected="true"]`);
  check(`selected state: ${value}`, await selected.textContent() === value);
}

async function assertNoRuntimeProblems(page, errors, label) {
  const metrics = await page.evaluate(() => {
    const images = [...document.images];
    const app = document.querySelector('#app');
    const bottom = document.querySelector('.bottom');
    const last = [...document.querySelectorAll('#main .card, #main .detail-block, #main .state-panel')].at(-1);
    const appRect = app.getBoundingClientRect();
    const bottomRect = bottom.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      broken: images.filter(image => image.naturalWidth === 0 || image.naturalHeight === 0).map(image => image.src),
      appWithinViewport: appRect.left >= -0.5 && appRect.right <= innerWidth + 0.5,
      bottomWithinViewport: bottomRect.left >= -0.5 && bottomRect.right <= innerWidth + 0.5 && bottomRect.bottom <= innerHeight + 0.5,
      bottomPadding: parseFloat(getComputedStyle(app).paddingBottom),
      bottomHeight: bottomRect.height,
      lastBottom: last?.getBoundingClientRect().bottom ?? 0,
    };
  });
  check(`${label}: no horizontal overflow`, metrics.overflow <= 0, JSON.stringify(metrics));
  check(`${label}: fixed bars contained`, metrics.appWithinViewport && metrics.bottomWithinViewport, JSON.stringify(metrics));
  check(`${label}: bottom bar content reserve`, metrics.bottomPadding >= metrics.bottomHeight, JSON.stringify(metrics));
  check(`${label}: no broken images`, metrics.broken.length === 0, metrics.broken.join(', '));
  check(`${label}: no page or console errors`, errors.length === 0, errors.join(' | '));
}

async function exerciseViewport(browser, url, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await waitReady(page);

  check(`${viewport.width}: entered through index UI`, await page.locator('h2').first().isVisible());
  check(`${viewport.width}: inactive status panel removed from layout`, await page.locator('#status').evaluate(node => node.hidden && getComputedStyle(node).display === 'none' && node.getBoundingClientRect().height === 0));
  const channelFilters = {
    '按场景': ['推荐', '日常', '通勤', '约会', '出游', '运动', '校园'],
    '适合我': ['不限性别', '男生', '女生', '小个子', '高个子', '梨形', '宽肩', '暖肤色', '冷肤色'],
    '博主推荐': ['精选', '关注', '新锐', '男生穿搭', '女生穿搭'],
  };
  for (const [channel, filterNames] of Object.entries(channelFilters)) {
    await page.getByRole('tab', { name: channel, exact: true }).click();
    await assertSelected(page, '.channel', channel);
    for (const filter of filterNames) {
      await page.getByRole('tab', { name: filter, exact: true }).click();
      await assertSelected(page, '.filter', filter);
    }
  }
  await page.getByRole('tab', { name: '按场景', exact: true }).click();
  await page.getByRole('tab', { name: '推荐', exact: true }).click();
  await waitReady(page);

  const first = page.locator('#feed .card').first();
    const id = await first.getAttribute('data-id');
    const like = first.getByRole('button', { name: '喜欢' });
    const collect = first.getByRole('button', { name: '收藏' });
    await like.click();
    check('like visibly and semantically toggles', await like.getAttribute('aria-pressed') === 'true' && await like.evaluate(node => node.classList.contains('on')));
    await collect.click();
    check('collect visibly and semantically toggles', await collect.getAttribute('aria-pressed') === 'true' && await collect.evaluate(node => node.classList.contains('on')));
    const follow = first.locator('[data-follow]');
    await follow.click();
    check('follow visibly and semantically toggles', await follow.getAttribute('aria-pressed') === 'true' && await follow.textContent() === '已关注');
    await first.getByRole('button', { name: '不感兴趣' }).click();
    check('hide removes card and exposes undo', await page.locator(`[data-id="${id}"]`).count() === 0 && await page.getByRole('button', { name: '撤销' }).isVisible());
    await page.getByRole('button', { name: '撤销' }).click();
    check('undo restores hidden card and its reactions', await page.locator(`[data-id="${id}"]`).count() === 1 && await page.locator(`[data-id="${id}"] [aria-label="喜欢"]`).getAttribute('aria-pressed') === 'true');

    check('state menu computed hidden initially', await page.locator('#state-menu').evaluate(node => node.hidden && getComputedStyle(node).display === 'none'));
    await page.getByRole('button', { name: '原型状态菜单' }).click();
    check('state menu toggles visibly', await page.locator('#state-menu').isVisible() && await page.getByRole('button', { name: '原型状态菜单' }).getAttribute('aria-expanded') === 'true');
    await page.getByRole('button', { name: '加载', exact: true }).click();
    check('loading state reachable', await page.locator('[aria-label="内容加载中"]').isVisible());
    for (const [button, state] of [['空内容', 'empty'], ['失败', 'error']]) {
      await page.getByRole('button', { name: '原型状态菜单' }).click();
      await page.getByRole('button', { name: button, exact: true }).click();
      check(`${state} state reachable`, await page.locator(`#feed[data-feed-state="${state}"]`).count() === 1);
      if (state === 'empty') {
        await page.getByRole('button', { name: '清除筛选' }).click();
        check('clear-filter restores ready content', await page.locator('#feed[data-feed-state="ready"] .card').count() > 0);
      } else {
        await page.getByRole('button', { name: '重新加载' }).click();
        await waitReady(page);
        check('retry restores explicit ready content', await page.locator('#feed').getAttribute('data-feed-state') === 'ready' && await page.locator('#status').evaluate(node => node.hidden && getComputedStyle(node).display === 'none') && await page.locator('#feed .card:visible').count() > 0);
      }
    }
    await page.getByRole('button', { name: '原型状态菜单' }).click();
    await page.getByRole('button', { name: '图片失败' }).click();
    const ratios = await page.locator('#feed .card').evaluateAll(cards => cards.map(card => {
      const failure = card.querySelector('.image-failure');
      const type = card.dataset.cardType;
      const expected = type === 'collection' ? 1 : type === 'outfit' ? 4 / 5 : 3 / 4;
      return { type, actual: failure.getBoundingClientRect().width / failure.getBoundingClientRect().height, expected };
    }));
    check('image-failure state preserves type ratios', ratios.every(({ actual, expected }) => Math.abs(actual - expected) < 0.03), JSON.stringify(ratios));
    await page.getByRole('button', { name: '原型状态菜单' }).click();
    await page.getByRole('button', { name: '正常' }).click();
    check('ready state reachable', await page.locator('#feed[data-feed-state="ready"] .card').count() > 0);

    await page.getByRole('button', { name: '编辑原型' }).click();
    await page.locator('[data-proto-key="featured-title"]').click({ position: { x: 8, y: 8 } });
    check('edit mode selects a title', await page.locator('#selected-key').textContent() === 'featured-title');
    await page.locator('#edit-text').fill('穿搭灵感');
    await page.getByRole('button', { name: '应用修改' }).click();
    check('edit changes selected title', await page.locator('[data-proto-key="featured-title"]').textContent() === '穿搭灵感');
    await page.getByRole('button', { name: '撤销' }).click();
    check('edit undo restores title', await page.locator('[data-proto-key="featured-title"]').textContent() === '从城市到自然，找到轻松的穿法');
    await page.getByRole('button', { name: '预览' }).click();
    check('preview hides and inerts author controls', await page.locator('#authoring-controls').evaluate(node => node.hidden && node.inert && getComputedStyle(node).display === 'none'));

    await page.getByRole('tab', { name: '适合我', exact: true }).click();
    await page.getByRole('tab', { name: '博主推荐', exact: true }).click();
    await page.getByRole('tab', { name: '按场景', exact: true }).click();
    await waitReady(page);
    check('rapid switching latest request wins', await page.locator('.channel[aria-selected="true"]').textContent() === '按场景' && await page.locator('.filter[aria-selected="true"]').textContent() === '推荐');

    await page.getByRole('tab', { name: '日常', exact: true }).click();
    await page.locator('#strip [data-strip-id]').first().click();
    await page.waitForTimeout(350);
    check('detail opened during load is not overwritten', await page.locator('.collection-detail').isVisible() && await page.locator('#feed').count() === 0);
    await page.getByRole('button', { name: '返回内容流' }).click();
    await page.getByRole('tab', { name: '推荐', exact: true }).click();
    await waitReady(page);

    for (const type of ['creator', 'collection', 'outfit']) {
      const card = page.locator(`#feed [data-card-type="${type}"]`).first();
      await card.scrollIntoViewIfNeeded();
      const savedScroll = await page.evaluate(() => scrollY);
      const cardId = await card.getAttribute('data-id');
      const expectedClass = `${type}-detail`;
      await card.locator('.open-card').click();
      check(`${type} card opens correct detail`, await page.locator(`.${expectedClass}`).isVisible());
      await page.getByRole('button', { name: '返回内容流' }).click();
      await page.waitForTimeout(40);
      check(`${type} back restores channel/filter/scroll`, await page.locator('.channel[aria-selected="true"]').textContent() === '按场景' && await page.locator('.filter[aria-selected="true"]').textContent() === '推荐' && Math.abs((await page.evaluate(() => scrollY)) - savedScroll) < 3, cardId);
    }

  await page.reload({ waitUntil: 'networkidle' });
  await waitReady(page);
  await waitForCanonicalLayout(page, page.locator('#feed[data-feed-state="ready"] .card').first());
  await page.screenshot({ path: join(evidence, `feed-${viewport.width}x${viewport.height}.png`), fullPage: true });
  await page.locator('#strip [data-strip-id]').first().click();
  await waitForCanonicalLayout(page, page.locator('.collection-detail'));
  await page.screenshot({ path: join(evidence, `detail-${viewport.width}x${viewport.height}.png`), fullPage: true });
  await page.getByRole('button', { name: '返回内容流' }).click();
  await assertNoRuntimeProblems(page, errors, `${viewport.width}x${viewport.height}`);
  await context.close();
}

await mkdir(evidence, { recursive: true });
const { server, url } = await startServer();
let browser;
try {
  browser = await chromium.launch({ headless: true });
  await exerciseViewport(browser, url, { width: 390, height: 844 });
  await exerciseViewport(browser, url, { width: 320, height: 700 });
  console.log(`RESULT ${checks.length} browser checks passed`);
} catch (error) {
  console.error(`FAIL ${error.stack || error}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
