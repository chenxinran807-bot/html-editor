const ASSET_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'INSTANCE', 'COMPONENT']);
const STYLE_KEYS = ['fillStyleId', 'strokeStyleId', 'textStyleId', 'effectStyleId', 'gridStyleId'];

function walk(nodes, visit) {
  for (const node of nodes || []) {
    visit(node);
    if (Array.isArray(node.children)) walk(node.children, visit);
  }
}

function collectAssetCandidates(nodes) {
  const result = [];
  const seen = new Set();
  walk(nodes, node => {
    const width = Number(node.width) || 0;
    const height = Number(node.height) || 0;
    const namedAsset = /(^|[\s/_-])(icon|ic|图标|logo)([\s/_-]|$)/i.test(node.name || '');
    const compactVector = width > 0 && height > 0 && width <= 64 && height <= 64;
    if (!ASSET_TYPES.has(node.type) || width > 256 || height > 256 || (!namedAsset && !compactVector) || seen.has(node.id)) return;
    seen.add(node.id);
    result.push(node);
  });
  return result;
}

function collectVariableIds(value, output) {
  if (!value) return;
  if (Array.isArray(value)) return value.forEach(item => collectVariableIds(item, output));
  if (typeof value !== 'object') return;
  if (typeof value.id === 'string' && /variable/i.test(value.id)) output.add(value.id);
  for (const child of Object.values(value)) collectVariableIds(child, output);
}

function collectDesignReferences(nodes) {
  const variableIds = new Set();
  const styleIds = new Set();
  walk(nodes, node => {
    collectVariableIds(node.boundVariables, variableIds);
    for (const key of STYLE_KEYS) {
      if (typeof node[key] === 'string' && node[key]) styleIds.add(node[key]);
    }
  });
  return { variableIds, styleIds };
}

function createTokenSet(input) {
  return {
    variables: (input.variables || []).map(item => ({ ...item, source: 'variable' })),
    styles: (input.styles || []).map(item => ({ ...item, source: 'style' })),
    observed: []
  };
}

module.exports = { walk, collectAssetCandidates, collectDesignReferences, createTokenSet };
