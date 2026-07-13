const { test, expect } = require('@playwright/test');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '../index.html');
let browserErrors = [];
test.beforeEach(async ({ page }) => {
  browserErrors = [];
  page.on('console', m => { if (m.type() === 'error') browserErrors.push('console: ' + m.text()); });
  page.on('pageerror', e => browserErrors.push('pageerror: ' + e.message));
  await page.goto(url);
});
test.afterEach(async () => { expect(browserErrors, browserErrors.join('\n')).toEqual([]); });
test('switch-category', async ({ page }) => {
  await page.getByRole('button', { name: '场景适配' }).click();
  await expect(page.getByText('西装 + 长裤，办公友好')).toBeVisible();
});
test('open-reason-card', async ({ page }) => {
  await page.locator('[data-card="0"]').click();
  await expect(page.getByRole('heading', { name: /复古牛仔外套叠穿/ })).toBeVisible();
});
test('read-guidance', async ({ page }) => {
  await page.locator('[data-card="0"]').click();
  const g = page.getByTestId('guidance');
  await expect(g.getByRole('heading', { name: '适合人群' })).toBeVisible();
  await expect(g.getByRole('heading', { name: '配色公式' })).toBeVisible();
  await expect(g.getByRole('heading', { name: '避雷提醒' })).toBeVisible();
});
test('open-product-or-alternative', async ({ page }) => {
  await page.locator('[data-card="0"]').click();
  await page.getByRole('button', { name: '看平替' }).click();
  await expect(page.getByRole('heading', { name: '相似风格平替' })).toBeVisible();
  await expect(page.locator('#productSheet').getByText('¥358')).toBeVisible();
});
test('enter-ai-styling-or-try-on', async ({ page }) => {
  await page.locator('[data-card="0"]').click();
  await page.getByRole('button', { name: 'AI 继续帮你搭' }).click();
  await expect(page.getByText('同款延展')).toBeVisible();
  await expect(page.getByText('相似风格', { exact: true })).toBeVisible();
});
test('visual screenshots and edge scenarios', async ({ page }) => {
  await page.screenshot({ path: path.resolve(__dirname, 'feed.png'), fullPage: true });
  await page.locator('[data-card="0"]').click();
  await page.screenshot({ path: path.resolve(__dirname, 'detail.png'), fullPage: true });
  await page.getByRole('button', { name: 'AI 继续帮你搭' }).click();
  await page.screenshot({ path: path.resolve(__dirname, 'ai-entry.png'), fullPage: true });
  await page.locator('#aiSheet .close').click(); await page.getByRole('button', { name: '返回' }).click();
  for (const s of ['空态','加载','错误','边界']) { await page.getByRole('button', { name: s }).click(); await expect(page.locator('#feed')).toBeVisible(); }
});
