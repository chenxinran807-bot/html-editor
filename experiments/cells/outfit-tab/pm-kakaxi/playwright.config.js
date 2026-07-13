const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './qa', timeout: 30000, retries: 0, workers: 1,
  use: { viewport: { width: 430, height: 932 }, screenshot: 'only-on-failure' },
  reporter: [['line'], ['json', { outputFile: 'qa/playwright-report.json' }]]
});
