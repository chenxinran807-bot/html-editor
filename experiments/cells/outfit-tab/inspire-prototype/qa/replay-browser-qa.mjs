// Run inside the Codex Browser Node environment. This module creates its own browser/tab binding.
// See README.md for the required documentation-read step between connect() and runFromPreview().
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const BROWSER_CLIENT = '/Users/bytedance/.codex/plugins/cache/openai-bundled/browser/26.707.62119/scripts/browser-client.mjs';

export async function connect(previewUrl) {
  if (globalThis.agent?.browsers == null) {
    const { setupBrowserRuntime } = await import(BROWSER_CLIENT);
    await setupBrowserRuntime({ globals: globalThis });
  }
  const browser = await globalThis.agent.browsers.getForUrl(previewUrl);
  return { browser, previewUrl, documentation: await browser.documentation() };
}

export async function runFromPreview(session, outDir) {
  await session.browser.nameSession('🧥 Inspire outfit QA replay');
  const tab = await session.browser.tabs.new();
  await tab.goto(session.previewUrl);
  await tab.playwright.waitForTimeout(3000);
  await tab.reload();
  await tab.playwright.waitForTimeout(3000);
  try {
    return await run(tab, outDir, session.previewUrl);
  } finally {
    await session.browser.tabs.finalize({ keep: [{ tab, status: 'deliverable' }] });
  }
}

export async function run(tab, outDir, previewUrl) {
  previewUrl ||= await tab.url();
  const classify = (passed, partial = false) => passed ? 'PASS' : partial ? 'PARTIAL' : 'FAIL';
  const observe = async (label) => {
    const state = await tab.playwright.evaluate(() => ({
      url: location.href,
      text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 12000),
    }));
    return {
      label,
      url: state.url,
      domTextSha256: crypto.createHash('sha256').update(state.text).digest('hex'),
      domText: state.text,
    };
  };
  const result = { previewUrl, startedAt: new Date().toISOString(), tasks: [] };
  const click = async (locator, descriptor) => {
    const count = await locator.count();
    const before = await observe(`before ${descriptor}`);
    if (count === 1) await locator.click();
    const after = await observe(`after ${descriptor}`);
    return { locator: { ...descriptor, count }, before, after,
      stateChanged: before.url !== after.url || before.domTextSha256 !== after.domTextSha256 };
  };

  await fs.writeFile(`${outDir}/01-entry.png`, await tab.screenshot({ fullPage: false }));
  const category = await click(tab.playwright.getByRole('button', { name: '场景适配', exact: true }), { role: 'button', name: '场景适配' });
  const categoryPassed = category.locator.count === 1 && category.stateChanged;
  result.tasks.push({ id: 'switch-category', ...category, passed: categoryPassed, partial: false, status: classify(categoryPassed) });
  await fs.writeFile(`${outDir}/02-category-scene.png`, await tab.screenshot({ fullPage: false }));

  const card = await click(tab.playwright.getByText('西装+长裤，办公友好', { exact: true }), { text: '西装+长裤，办公友好' });
  const cardPassed = card.locator.count === 1 && card.stateChanged && card.after.url.includes('/detail');
  result.tasks.push({ id: 'open-reason-card', ...card, passed: cardPassed, partial: false, status: classify(cardPassed) });
  const guidance = await observe('detail guidance');
  const guidanceObserved = {
    suitability: guidance.domText.includes('适合人群'), formula: guidance.domText.includes('配色公式'),
    avoidance: /避雷|避免|不适合/.test(guidance.domText), size: /尺码/.test(guidance.domText), fabric: /面料/.test(guidance.domText),
  };
  const guidancePassed = guidanceObserved.suitability && guidanceObserved.formula && guidanceObserved.avoidance;
  const guidancePartial = !guidancePassed && Object.values(guidanceObserved).some(Boolean);
  const guidanceCount = Number(guidanceObserved.suitability) + Number(guidanceObserved.formula) + Number(guidanceObserved.avoidance);
  result.tasks.push({ id: 'read-guidance', locator: { description: 'required guidance sections', count: guidanceCount }, before: guidance, after: guidance, stateChanged: false, observed: guidanceObserved,
    partial: guidancePartial, passed: guidancePassed, status: classify(guidancePassed, guidancePartial) });
  await fs.writeFile(`${outDir}/03-detail-guidance.png`, await tab.screenshot({ fullPage: false }));

  const purchase = await click(tab.playwright.getByText('购买', { exact: true }), { text: '购买' });
  const productInfoVisible = /复古牛仔短外套/.test(purchase.after.domText) && /¥358/.test(purchase.after.domText);
  const purchasePassed = purchase.locator.count === 1 && purchase.stateChanged && productInfoVisible;
  result.tasks.push({ id: 'open-product-or-alternative', ...purchase, productInfoVisible,
    passed: purchasePassed, partial: false, status: classify(purchasePassed) });
  const tryOn = await click(tab.playwright.getByText('试穿', { exact: true }), { text: '试穿' });
  const styling = await click(tab.playwright.getByText('保留牛仔外套，换一套更日常的搭法', { exact: true }), { text: '保留牛仔外套，换一套更日常的搭法' });
  const aiPassed = (tryOn.locator.count === 1 && tryOn.stateChanged) || (styling.locator.count === 1 && styling.stateChanged);
  result.tasks.push({ id: 'enter-ai-styling-or-try-on', tryOn, styling,
    passed: aiPassed, partial: false, status: classify(aiPassed) });
  await fs.writeFile(`${outDir}/04-product-ai-actions.png`, await tab.screenshot({ fullPage: false }));
  result.console = await tab.dev.logs({ levels: ['error', 'warning', 'warn'], limit: 100 });
  result.pageErrors = { available: false, reason: 'Selected browser API exposes console logs but no separate pageerror stream.' };
  result.finishedAt = new Date().toISOString();
  await fs.writeFile(`${outDir}/browser-qa.raw.json`, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
