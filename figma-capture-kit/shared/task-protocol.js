const EXPORTABLE_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP', 'SECTION']);

function safeNodeId(nodeId) {
  return String(nodeId || 'node').replace(/[^a-zA-Z0-9_-]/g, '-');
}

function assertRelativeTaskPath(value) {
  const path = String(value || '').replace(/\\/g, '/');
  const parts = path.split('/');
  if (!path || path.startsWith('/') || /^[a-zA-Z]:\//.test(path) || parts.some(part => part === '..' || part === '')) {
    throw new Error(`不安全的任务路径: ${value}`);
  }
  return path;
}

function createTaskId(randomUUID) {
  if (typeof randomUUID === 'function') return randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createExportModel(nodes, options = {}) {
  const scale = Number(options.scale) || 2;
  return (nodes || []).filter(node => EXPORTABLE_TYPES.has(node.type)).map(node => ({
    nodeId: node.id,
    name: node.name,
    type: node.type,
    png: `pages/${safeNodeId(node.id)}.png`,
    svg: `pages/${safeNodeId(node.id)}.svg`,
    width: Math.round(node.width * scale),
    height: Math.round(node.height * scale),
    scale
  }));
}

function createUnifiedManifest(input) {
  const capabilities = ['frame-png'];
  if ((input.assets || []).length || (input.pages || []).some(page => page.svg)) capabilities.push('svg-assets');
  if (input.tokens) capabilities.push('tokens');
  if (input.hasLayerMetadata) capabilities.push('layer-metadata');
  return {
    schemaVersion: '1.0',
    exporter: { type: 'figma-plugin', version: input.exporterVersion, capabilities },
    source: input.source,
    pages: (input.pages || []).map((page, index) => ({
      id: `page-${safeNodeId(page.nodeId)}`,
      nodeId: page.nodeId,
      layerName: page.name,
      png: assertRelativeTaskPath(page.png),
      ...(page.svg ? { svg: assertRelativeTaskPath(page.svg) } : {}),
      width: page.width,
      height: page.height,
      scale: page.scale ?? null,
      role: page.role || 'page-reference',
      fidelity: page.fidelity || 'strict',
      order: index,
      ...(page.children ? { children: page.children } : {})
    })),
    assets: input.assets || [],
    tokens: input.tokens || {},
    constraints: input.constraints || {
      prohibited: ['redraw-provided-assets'],
      lockedRegions: [],
      editableRegions: ['content-area']
    }
  };
}

function createTaskEnvelope(input) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.taskId || '')) {
    throw new Error('taskId 必须是 UUIDv4');
  }
  const seen = new Set();
  const files = (input.files || []).map(file => {
    const path = assertRelativeTaskPath(file.path);
    if (seen.has(path)) throw new Error(`任务文件路径重复: ${path}`);
    seen.add(path);
    if (!/^[0-9a-f]{64}$/i.test(file.sha256 || '')) throw new Error(`SHA-256 非法: ${path}`);
    return { ...file, path };
  });
  return {
    taskSchemaVersion: '1.0',
    taskId: input.taskId,
    createdAt: input.createdAt,
    figma: input.figma,
    files
  };
}

module.exports = {
  EXPORTABLE_TYPES,
  safeNodeId,
  assertRelativeTaskPath,
  createTaskId,
  createExportModel,
  createUnifiedManifest,
  createTaskEnvelope
};
