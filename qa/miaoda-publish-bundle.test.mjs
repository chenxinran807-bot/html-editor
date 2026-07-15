import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('work/douyin-outfit-content-feed-publish/index.html', 'utf8');

test('妙搭发布包不依赖 ES module 运行时导入', () => {
  assert.doesNotMatch(html, /<script\s+type=["']module["']/i);
  assert.doesNotMatch(html, /\bimport\s*\{/);
  assert.match(html, /function createCatalog\s*\(/);
  assert.match(html, /function createState\s*\(/);
  assert.match(html, /renderFeed\s*\(/);
});

