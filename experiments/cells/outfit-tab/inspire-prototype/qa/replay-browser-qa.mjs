// Run inside the Codex Browser Node environment after obtaining a documented `tab` binding.
// Usage: await (await import(new URL('./qa/replay-browser-qa.mjs', import.meta.url))).run(tab, cellQaDir)
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

export async function run(tab, outDir) {
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
  const result = { startedAt: new Date().toISOString(), tasks: [] };
  const click = async (locator, descriptor) => {
    const count = await locator.count();
    const before = await observe(`before ${descriptor}`);
    if (count === 1) await locator.click();
    const after = await observe(`after ${descriptor}`);
    return { locator: { ...descriptor, count }, before, after,
      stateChanged: before.url !== after.url || before.domTextSha256 !== after.domTextSha256 };
  };

  const category = await click(tab.playwright.getByRole('button', { name: '场景适配', exact: true }), { role: 'button', name: '场景适配' });
  result.tasks.push({ id: 'switch-category', ...category, passed: category.stateChanged && category.after.domText.includes('西装+长裤，办公友好') });
  await fs.writeFile(`${outDir}/02-category-scene.png`, await tab.screenshot({ fullPage: false }));

  const card = await click(tab.playwright.getByText('西装+长裤，办公友好', { exact: true }), { text: '西装+长裤，办公友好' });
  result.tasks.push({ id: 'open-reason-card', ...card, passed: card.after.url.includes('/detail?id=5') });
  const guidance = await observe('detail guidance');
  result.tasks.push({ id: 'read-guidance', state: guidance, observed: {
    suitability: guidance.domText.includes('适合人群'), formula: guidance.domText.includes('配色公式'),
    avoidance: /避雷|避免|不适合/.test(guidance.domText), size: /尺码/.test(guidance.domText), fabric: /面料/.test(guidance.domText),
  }, partial: true, passed: false });
  await fs.writeFile(`${outDir}/03-detail-guidance.png`, await tab.screenshot({ fullPage: false }));

  const purchase = await click(tab.playwright.getByText('购买', { exact: true }), { text: '购买' });
  result.tasks.push({ id: 'open-product-or-alternative', ...purchase, passed: false });
  const tryOn = await click(tab.playwright.getByText('试穿', { exact: true }), { text: '试穿' });
  const styling = await click(tab.playwright.getByText('保留牛仔外套，换一套更日常的搭法', { exact: true }), { text: '保留牛仔外套，换一套更日常的搭法' });
  result.tasks.push({ id: 'enter-ai-styling-or-try-on', tryOn, styling, passed: false });
  await fs.writeFile(`${outDir}/04-product-ai-actions.png`, await tab.screenshot({ fullPage: false }));
  result.console = await tab.dev.logs({ levels: ['error', 'warning', 'warn'], limit: 100 });
  result.pageErrors = { available: false, reason: 'Selected browser API exposes console logs but no separate pageerror stream.' };
  result.finishedAt = new Date().toISOString();
  await fs.writeFile(`${outDir}/browser-qa.raw.json`, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}
