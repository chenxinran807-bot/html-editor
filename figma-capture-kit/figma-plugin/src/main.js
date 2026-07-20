const {
  EXPORTABLE_TYPES,
  createTaskId,
  createExportModel,
  createUnifiedManifest
} = require('../../shared/task-protocol');
const { collectAssetCandidates, collectDesignReferences, createTokenSet } = require('../../shared/figma-extraction');

const PLUGIN_VERSION = '2.0.0';
figma.showUI(__html__, { width: 360, height: 480 });

function selection() {
  return (figma.currentPage.selection || []).filter(node => EXPORTABLE_TYPES.has(node.type));
}

function selectionInfo() {
  return selection().map(node => ({
    id: node.id,
    name: node.name,
    type: node.type,
    width: Math.round(node.width),
    height: Math.round(node.height)
  }));
}

function pushSelection() {
  figma.ui.postMessage({ type: 'selection', items: selectionInfo() });
}

function bytesToBase64(bytes) {
  if (figma.base64Encode) return figma.base64Encode(bytes);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function serializeLayers(node, depth = 0) {
  if (depth > 5) return undefined;
  const result = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible !== false,
    width: Math.round(node.width || 0),
    height: Math.round(node.height || 0)
  };
  if (node.type === 'TEXT') {
    result.text = {
      characters: node.characters,
      fontSize: node.fontSize === figma.mixed ? null : node.fontSize,
      fontName: node.fontName === figma.mixed ? null : node.fontName,
      fontWeight: node.fontWeight === figma.mixed ? null : node.fontWeight,
      lineHeight: node.lineHeight === figma.mixed ? null : node.lineHeight,
      letterSpacing: node.letterSpacing === figma.mixed ? null : node.letterSpacing,
      textAlignHorizontal: node.textAlignHorizontal,
      textAlignVertical: node.textAlignVertical
    };
  }
  if ('children' in node && node.children?.length) {
    result.children = node.children.map(child => serializeLayers(child, depth + 1)).filter(Boolean);
  }
  return result;
}

async function exportSelection(scale) {
  const nodes = selection();
  if (!nodes.length) throw new Error('请先在 Figma 中选中一个或多个 Frame。');
  const createdAt = new Date().toISOString();
  const taskId = createTaskId();
  const models = createExportModel(nodes, { scale });
  const files = [];
  const pages = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const model = models[index];
    figma.ui.postMessage({ type: 'progress', current: index + 1, total: nodes.length, name: node.name });
    const pngBytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } });
    files.push({ path: model.png, kind: 'page-png', nodeId: node.id, b64: bytesToBase64(pngBytes) });

    let svg;
    try {
      const svgBytes = await node.exportAsync({ format: 'SVG', svgOutlineText: false, svgIdAttribute: true });
      svg = model.svg;
      files.push({ path: svg, kind: 'page-svg', nodeId: node.id, b64: bytesToBase64(svgBytes) });
    } catch {
      // SVG 是增强能力；PNG 成功即可保留该页面，manifest 会按实际结果声明能力。
    }
    pages.push({ ...model, ...(svg ? { svg } : {}), children: serializeLayers(node) });
  }

  const assets = [];
  for (const assetNode of collectAssetCandidates(nodes)) {
    try {
      const bytes = await assetNode.exportAsync({ format: 'SVG', svgOutlineText: false, svgIdAttribute: true });
      const path = `assets/${assetNode.id.replace(/[^a-zA-Z0-9_-]/g, '-')}.svg`;
      files.push({ path, kind: 'asset-svg', nodeId: assetNode.id, b64: bytesToBase64(bytes) });
      assets.push({
        id: assetNode.id,
        name: assetNode.name,
        file: path,
        type: 'svg',
        source: 'figma-node',
        usage: 'reference-directly'
      });
    } catch {
      // 单个候选素材无法导出时不虚报 svg-assets，页面任务仍可继续。
    }
  }

  const references = collectDesignReferences(nodes);
  const variables = [];
  for (const id of references.variableIds) {
    try {
      const variable = await figma.variables.getVariableByIdAsync(id);
      if (!variable) continue;
      const firstMode = Object.keys(variable.valuesByMode || {})[0];
      variables.push({
        id: variable.id,
        name: variable.name,
        resolvedType: variable.resolvedType,
        value: firstMode ? variable.valuesByMode[firstMode] : null,
        collectionId: variable.variableCollectionId
      });
    } catch {}
  }
  const styles = [];
  for (const id of references.styleIds) {
    try {
      const style = await figma.getStyleByIdAsync(id);
      if (!style) continue;
      styles.push({ id: style.id, name: style.name, type: style.type, description: style.description || '' });
    } catch {}
  }
  const tokens = variables.length || styles.length ? createTokenSet({ variables, styles }) : null;

  const source = {
    fileKey: figma.fileKey || null,
    fileName: figma.root.name,
    pageName: figma.currentPage.name,
    exportedAt: createdAt
  };
  const manifest = createUnifiedManifest({
    exporterVersion: PLUGIN_VERSION,
    source,
    pages,
    assets,
    tokens,
    hasLayerMetadata: true
  });
  return {
    taskId,
    createdAt,
    figma: { fileKey: source.fileKey, fileName: source.fileName, pageName: source.pageName },
    manifest,
    files
  };
}

figma.on('selectionchange', pushSelection);
pushSelection();

figma.ui.onmessage = async message => {
  if (message.type === 'refresh') return pushSelection();
  if (message.type !== 'export-task') return;
  try {
    const payload = await exportSelection(Number(message.scale) || 2);
    figma.ui.postMessage({ type: 'export-ready', payload });
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: String(error?.message || error) });
  }
};
