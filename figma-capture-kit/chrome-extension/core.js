(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CaptureCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function parseFigmaSelection(url) {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (!/(^|\.)figma\.com$/.test(parsed.hostname) || parts[0] !== 'design' || !parts[1]) return null;
      const raw = parsed.searchParams.get('node-id');
      if (!raw) return null;
      const nodeId = decodeURIComponent(raw).replace('-', ':');
      if (nodeId === '0:1') return null;
      return { fileKey: parts[1], nodeId };
    } catch { return null; }
  }

  function selectionKey(selection) { return selection ? `${selection.fileKey}/${selection.nodeId}` : ''; }
  function shouldCapture(state, selection) { return Boolean(state.enabled && selection && state.lastKey !== selectionKey(selection)); }
  function interactionModeMigration(state, version) {
    if (state?.interactionModeVersion === version) return null;
    return { enabled: false, lastKey: '', interactionModeVersion: version };
  }
  async function waitForPng(read, wait, options = {}) {
    const attempts = options.attempts || 20;
    const intervalMs = options.intervalMs || 500;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const png = await read();
        if (options.previousDataUrl && png.dataUrl === options.previousDataUrl) {
          throw new Error('Figma 仍在生成新的 PNG');
        }
        return png;
      } catch (error) {
        lastError = error;
        if (attempt < attempts - 1) await wait(intervalMs);
      }
    }
    throw lastError || new Error('等待 Figma PNG 超时');
  }
  function safeStem(selection) { return `${selection.fileKey}-${selection.nodeId.replace(':', '-')}`.replace(/[^a-zA-Z0-9_-]/g, '-'); }
  function captureStem(selection, capturedAt) {
    const stamp = new Date(capturedAt).toISOString().replace(/[-:TZ.]/g, '').replace(/(\d{8})(\d{6})(\d{3})/, '$1-$2-$3');
    return `${safeStem(selection)}-${stamp}`;
  }

  function copyAsPngKeyEvents() {
    return [
      { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 8 },
      { type: 'keyDown', key: 'Meta', code: 'MetaLeft', windowsVirtualKeyCode: 91, modifiers: 12 },
      { type: 'keyDown', key: 'c', code: 'KeyC', windowsVirtualKeyCode: 67, modifiers: 12 },
      { type: 'keyUp', key: 'c', code: 'KeyC', windowsVirtualKeyCode: 67, modifiers: 12 },
      { type: 'keyUp', key: 'Meta', code: 'MetaLeft', windowsVirtualKeyCode: 91, modifiers: 8 },
      { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16, modifiers: 0 }
    ];
  }

  function createClipboardManifest(input) {
    const exportedAt = input.capturedAt || new Date().toISOString();
    return {
      schemaVersion: '1.0',
      exporter: { type: 'chrome-extension', version: input.exporterVersion || '1.2.0', capabilities: ['frame-png'] },
      source: { fileKey: input.fileKey, fileName: null, url: input.url || null, exportedAt },
      pages: [{
        id: `page-${input.nodeId.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
        nodeId: input.nodeId,
        layerName: null,
        png: input.file,
        width: input.width,
        height: input.height,
        scale: null,
        role: input.role || 'page-reference',
        fidelity: input.fidelity || 'strict'
      }],
      assets: [],
      tokens: {},
      constraints: {
        prohibited: ['redraw-provided-assets'],
        lockedRegions: input.lockedRegions || [],
        editableRegions: input.editableRegions || []
      }
    };
  }

  return { parseFigmaSelection, selectionKey, shouldCapture, interactionModeMigration, waitForPng, safeStem, captureStem, copyAsPngKeyEvents, createClipboardManifest };
});
