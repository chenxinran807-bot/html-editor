const test = require('node:test');
const assert = require('node:assert/strict');
const { collectAssetCandidates, collectDesignReferences, createTokenSet } = require('../shared/figma-extraction');

test('collectAssetCandidates selects named compact vector assets and deduplicates ids', () => {
  const tree = {
    id: 'root', name: 'page', type: 'FRAME', width: 375, height: 812, children: [
      { id: '1:2', name: 'icon/cart', type: 'VECTOR', width: 24, height: 24 },
      { id: '1:3', name: '背景', type: 'VECTOR', width: 375, height: 812 },
      { id: '1:2', name: 'icon/cart', type: 'VECTOR', width: 24, height: 24 }
    ]
  };
  assert.deepEqual(collectAssetCandidates([tree]).map(node => node.id), ['1:2']);
});

test('collectDesignReferences finds variable and style ids throughout descendants', () => {
  const tree = {
    id: 'root', type: 'FRAME', boundVariables: { fills: [{ id: 'VariableID:1' }] }, fillStyleId: 'StyleID:1', children: [
      { id: 'child', type: 'TEXT', boundVariables: { fontSize: { id: 'VariableID:2' } }, textStyleId: 'StyleID:2' }
    ]
  };
  const refs = collectDesignReferences([tree]);
  assert.deepEqual([...refs.variableIds].sort(), ['VariableID:1', 'VariableID:2']);
  assert.deepEqual([...refs.styleIds].sort(), ['StyleID:1', 'StyleID:2']);
});

test('createTokenSet keeps only explicit variable and style sources', () => {
  const tokens = createTokenSet({
    variables: [{ id: 'v1', name: 'brand/primary', resolvedType: 'COLOR', value: { r: 1, g: 0, b: 0, a: 1 } }],
    styles: [{ id: 's1', name: 'title', type: 'TEXT', description: '' }]
  });
  assert.equal(tokens.variables[0].source, 'variable');
  assert.equal(tokens.styles[0].source, 'style');
  assert.deepEqual(tokens.observed, []);
});
