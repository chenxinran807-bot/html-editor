const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.QA_URL || 'http://127.0.0.1:4183/';
const OUT = __dirname;

const CHROME = process.env.QA_BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
test.use({ viewport: { width: 390, height: 844 }, launchOptions: { executablePath: CHROME } });

test('camera upload contract and recovery states', async ({ page, browserName }) => {
  const startedAt = new Date().toISOString();
  const consoleEvents = [];
  const pageErrors = [];
  const steps = [];
  const record = (taskId, selector, expected, observed) => {
    steps.push({ taskId, selector, expected, observed, passed: expected === observed });
  };
  page.on('console', message => consoleEvents.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => pageErrors.push({ name: error.name, message: error.message }));

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  record('entry', BASE_URL, BASE_URL, page.url());
  await page.screenshot({ path: path.join(OUT, '01-entry.png') });

  await page.locator('#menu').click();
  await expect(page.locator('#toast')).toContainText('菜单已打开');
  record('visible-control-menu', '#menu', true, await page.locator('#toast').isVisible());
  await page.locator('#search').click();
  await expect(page.locator('#toast')).toContainText('搜索已响应');
  record('visible-control-search', '#search', true, await page.locator('#toast').isVisible());

  await page.locator('#create').click();
  await expect(page.locator('#creator')).toHaveClass(/show/);
  record('visible-control-create', '#create → #creator.show', true, await page.locator('#creator').evaluate(el => el.classList.contains('show')));
  await page.locator('#closeCreator').click();
  await expect(page.locator('#creator')).not.toHaveClass(/show/);
  record('visible-control-close-creator', '#closeCreator → #creator:not(.show)', false, await page.locator('#creator').evaluate(el => el.classList.contains('show')));
  await page.locator('#create').click();
  await page.locator('#upload').click();
  await expect(page.locator('#source')).toHaveClass(/show/);
  record('open-upload-choices', '#upload → #source.show', true, await page.locator('#source').evaluate(el => el.classList.contains('show')));
  await page.screenshot({ path: path.join(OUT, '02-upload-choices.png') });

  await page.locator('#chooseAlbum').click();
  await expect(page.locator('#album')).toHaveClass(/show/);
  record('visible-control-choose-album', '#chooseAlbum → #album.show', true, await page.locator('#album').evaluate(el => el.classList.contains('show')));
  await page.locator('#albumClose').click();
  await expect(page.locator('#album')).not.toHaveClass(/show/);
  record('visible-control-album-close', '#albumClose → #album:not(.show)', false, await page.locator('#album').evaluate(el => el.classList.contains('show')));
  await page.locator('#albumButton').click();
  await page.locator('#albumPhoto').click();
  await expect(page.locator('#confirm')).toHaveClass(/active/);
  record('visible-control-album-photo-1', '#albumPhoto → #confirm.active', true, await page.locator('#confirm').evaluate(el => el.classList.contains('active')));
  await page.locator('#retake').click();
  await page.locator('#albumButton').click();
  await page.locator('#albumPhoto3').click();
  await expect(page.locator('#confirm')).toHaveClass(/active/);
  record('visible-control-album-photo-3', '#albumPhoto3 → #confirm.active', true, await page.locator('#confirm').evaluate(el => el.classList.contains('active')));
  await page.locator('#retake').click();
  await page.locator('#closeCamera').click();

  await page.locator('#chooseCamera').click();
  await expect(page.locator('#camera')).toHaveClass(/active/);
  record('enter-camera', '#chooseCamera → #camera.active', true, await page.locator('#camera').evaluate(el => el.classList.contains('active')));
  await page.screenshot({ path: path.join(OUT, '03-camera.png') });

  await page.locator('#flip').click();
  await expect(page.locator('#camera')).toHaveAttribute('data-facing', 'front');
  record('flip-camera', '#flip → [data-facing]', 'front', await page.locator('#camera').getAttribute('data-facing'));

  await page.locator('#albumButton').click();
  await expect(page.locator('#album')).toHaveClass(/show/);
  record('open-album', '#albumButton → #album.show', true, await page.locator('#album').evaluate(el => el.classList.contains('show')));
  await page.screenshot({ path: path.join(OUT, '04-album.png') });
  await page.locator('#albumPhoto2').click();
  await expect(page.locator('#confirm')).toHaveClass(/active/);
  record('album-thumbnail', '#albumPhoto2 → #confirm.active', true, await page.locator('#confirm').evaluate(el => el.classList.contains('active')));

  await page.locator('#retake').click();
  await page.locator('#closeCamera').click();
  await expect(page.locator('#source')).toHaveClass(/show/);
  record('close-camera', '#closeCamera → #source.show', true, await page.locator('#source').evaluate(el => el.classList.contains('show')));

  await page.locator('#chooseCamera').click();
  await page.locator('#shutter').click();
  await expect(page.locator('#confirm')).toHaveClass(/active/);
  record('shutter', '#shutter → #confirm.active', true, await page.locator('#confirm').evaluate(el => el.classList.contains('active')));
  await page.screenshot({ path: path.join(OUT, '05-confirm.png') });

  await page.locator('#retake').click();
  await expect(page.locator('#camera')).toHaveAttribute('data-facing', 'front');
  record('retake', '#retake → facing preserved', 'front', await page.locator('#camera').getAttribute('data-facing'));

  await page.locator('#shutter').click();
  await page.locator('#usePhoto').click();
  await expect(page.locator('#reviewing')).toHaveClass(/active/);
  record('use-photo', '#usePhoto → #reviewing.active', true, await page.locator('#reviewing').evaluate(el => el.classList.contains('active')));
  await page.screenshot({ path: path.join(OUT, '06-loading.png') });
  await expect(page.locator('#failed')).toHaveClass(/active/, { timeout: 3000 });
  record('review-failure', '#reviewing → #failed.active', true, await page.locator('#failed').evaluate(el => el.classList.contains('active')));
  await page.screenshot({ path: path.join(OUT, '07-review-failure.png') });

  await page.locator('#simulateTimeout').click();
  await expect(page.locator('#serviceError')).toHaveClass(/active/);
  record('service-timeout', '#simulateTimeout → #serviceError.active', true, await page.locator('#serviceError').evaluate(el => el.classList.contains('active')));
  await page.screenshot({ path: path.join(OUT, '08-service-timeout.png') });
  await page.locator('#backSources').click();
  await expect(page.locator('#source')).toHaveClass(/show/);
  record('service-back-sources', '#backSources → #source.show', true, await page.locator('#source').evaluate(el => el.classList.contains('show')));
  await page.locator('#chooseCamera').click();
  await page.locator('#shutter').click();
  await page.locator('#usePhoto').click();
  await expect(page.locator('#failed')).toHaveClass(/active/, { timeout: 3000 });
  await page.locator('#simulateTimeout').click();
  await page.locator('#retryReview').click();
  await expect(page.locator('#reviewing')).toHaveClass(/active/);
  record('service-retry', '#retryReview → #reviewing.active', true, await page.locator('#reviewing').evaluate(el => el.classList.contains('active')));
  await expect(page.locator('#failed')).toHaveClass(/active/, { timeout: 3000 });
  await page.locator('#retry').click();
  await expect(page.locator('#source')).toHaveClass(/show/);
  record('retry', '#retry → #source.show', true, await page.locator('#source').evaluate(el => el.classList.contains('show')));

  const raw = {
    startedAt,
    finishedAt: new Date().toISOString(),
    url: page.url(),
    browser: {
      name: browserName,
      userAgent: await page.evaluate(() => navigator.userAgent),
      viewport: page.viewportSize(),
      executable: CHROME
    },
    steps,
    taskPassCount: steps.filter(step => step.passed && !step.taskId.startsWith('visible-control') && !step.taskId.startsWith('service-') && step.taskId !== 'entry' && step.taskId !== 'album-thumbnail').length,
    consoleEvents,
    pageErrors
  };
  fs.writeFileSync(path.join(OUT, 'browser-qa-raw.json'), JSON.stringify(raw, null, 2));
  expect(raw.taskPassCount).toBe(10);
  expect(consoleEvents.filter(event => event.type === 'error')).toEqual([]);
  expect(pageErrors).toEqual([]);
});
