const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.QA_URL || 'http://127.0.0.1:5173/';
const chrome = process.env.QA_BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = __dirname;

test.use({ viewport: { width: 1280, height: 900 }, launchOptions: { executablePath: chrome } });

test('camera-upload fixed task contract', async ({ page, browserName }) => {
  const startedAt = new Date().toISOString();
  const steps = [];
  const consoleEvents = [];
  const pageErrors = [];
  const record = async (taskId, selector, expected, observed) => {
    steps.push({ taskId, selector, expected, observed, passed: JSON.stringify(expected) === JSON.stringify(observed), at: new Date().toISOString() });
  };
  page.on('console', message => consoleEvents.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => pageErrors.push({ name: error.name, message: error.message }));

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(out, '01-entry.png'), fullPage: true });

  await page.locator('#upload-photo').click();
  await expect(page.locator('#choose-camera')).toBeVisible();
  await expect(page.locator('#choose-album')).toBeVisible();
  await record('open-upload-choices', '#upload-photo → #choose-camera + #choose-album', true, await page.locator('#choose-camera').isVisible() && await page.locator('#choose-album').isVisible());
  await page.screenshot({ path: path.join(out, '02-upload-choices.png'), fullPage: true });

  await page.locator('#choose-camera').click();
  await expect(page.locator('.device')).toHaveClass(/screen-camera/);
  await record('enter-camera', '#choose-camera → .screen-camera', true, await page.locator('.device').evaluate(el => el.classList.contains('screen-camera')));
  await page.screenshot({ path: path.join(out, '03-camera.png'), fullPage: true });

  await page.locator('#flip-camera').click();
  await expect(page.locator('.device')).toHaveAttribute('data-facing', 'front');
  await record('flip-camera', '#flip-camera → [data-facing]', 'front', await page.locator('.device').getAttribute('data-facing'));

  await page.locator('#open-album').click();
  await expect(page.locator('.device')).toHaveClass(/screen-album/);
  await record('open-album', '#open-album → .screen-album', true, await page.locator('.device').evaluate(el => el.classList.contains('screen-album')));
  await page.screenshot({ path: path.join(out, '04-album.png'), fullPage: true });
  await page.locator('#album-photo').click();
  await page.locator('#retake').click();

  await page.locator('#close-camera').click();
  await expect(page.locator('#choose-camera')).toBeVisible();
  await record('close-camera', '#close-camera → #choose-camera', true, await page.locator('#choose-camera').isVisible());

  await page.locator('#choose-camera').click();
  await page.locator('#shutter').click();
  await expect(page.locator('.device')).toHaveClass(/screen-confirm/);
  await record('shutter', '#shutter → .screen-confirm', true, await page.locator('.device').evaluate(el => el.classList.contains('screen-confirm')));
  await page.screenshot({ path: path.join(out, '05-confirm.png'), fullPage: true });

  await page.locator('#retake').click();
  await expect(page.locator('.device')).toHaveClass(/screen-camera/);
  await record('retake', '#retake → .screen-camera', true, await page.locator('.device').evaluate(el => el.classList.contains('screen-camera')));
  await expect(page.locator('.device')).toHaveAttribute('data-facing', 'front');

  await page.locator('#shutter').click();
  await page.locator('#use-photo').click();
  await expect(page.locator('.device')).toHaveClass(/screen-reviewing/);
  await record('use-photo', '#use-photo → .screen-reviewing', true, await page.locator('.device').evaluate(el => el.classList.contains('screen-reviewing')));
  await page.screenshot({ path: path.join(out, '06-reviewing.png'), fullPage: true });

  await expect(page.locator('.device')).toHaveClass(/screen-failed/, { timeout: 3000 });
  await expect(page.getByText('照片内容不符合规范')).toBeVisible();
  await record('review-failure', '.screen-reviewing → .screen-failed', true, await page.locator('.device').evaluate(el => el.classList.contains('screen-failed')));
  await page.screenshot({ path: path.join(out, '07-review-failure.png'), fullPage: true });

  await page.locator('#retry').click();
  await expect(page.locator('#choose-camera')).toBeVisible();
  await record('retry', '#retry → #choose-camera', true, await page.locator('#choose-camera').isVisible());

  const raw = {
    startedAt,
    finishedAt: new Date().toISOString(),
    url: page.url(),
    browser: { name: browserName, userAgent: await page.evaluate(() => navigator.userAgent), viewport: page.viewportSize(), executable: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
    steps,
    taskPassCount: steps.filter(step => step.passed).length,
    consoleEvents,
    pageErrors,
  };
  fs.writeFileSync(path.join(out, 'browser-qa-raw.json'), JSON.stringify(raw, null, 2));
  expect(raw.taskPassCount).toBe(10);
  expect(consoleEvents.filter(event => event.type === 'error')).toEqual([]);
  expect(pageErrors).toEqual([]);
});
