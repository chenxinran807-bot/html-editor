import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = 'work/douyin-outfit-content-feed';

test('freezes the accepted outfit content feed requirements', async () => {
  const [prd, semanticRequirementsSource] = await Promise.all([
    readFile(`${root}/prd.md`, 'utf8'),
    readFile(`${root}/semantic-requirements.json`, 'utf8'),
  ]);
  const requirements = JSON.parse(semanticRequirementsSource);

  assert.equal(requirements.extractionMode, 'model-semantic');
  assert.deepEqual(requirements.screens, [
    '穿搭内容流',
    '真人穿搭详情',
    '主题合集详情',
    '商品搭配详情',
  ]);

  const objectNames = requirements.businessObjects.map(({ name }) => name);
  assert.ok(objectNames.includes('真人穿搭'));
  assert.ok(objectNames.includes('主题合集'));
  assert.ok(objectNames.includes('商品搭配'));

  for (const item of requirements.evidence) {
    assert.ok(prd.includes(item.quote), `evidence quote not found verbatim: ${item.quote}`);
  }

  assert.ok(requirements.assumptions.some((item) => item.includes('演示内容')));
  assert.ok(requirements.gaps.some((item) => item.includes('真实商品')));
});
