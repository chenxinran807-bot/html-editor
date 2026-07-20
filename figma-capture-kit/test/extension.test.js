const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFigmaSelection, shouldCapture, createClipboardManifest, copyAsPngKeyEvents, captureStem, interactionModeMigration, waitForPng } = require('../chrome-extension/core');

test('parseFigmaSelection extracts file key and normalized node id', () => {
  assert.deepEqual(parseFigmaSelection('https://www.figma.com/design/abc/File?node-id=12-34&p=f'), { fileKey: 'abc', nodeId: '12:34' });
});

test('parseFigmaSelection rejects non-design and page-only URLs', () => {
  assert.equal(parseFigmaSelection('https://www.figma.com/files/'), null);
  assert.equal(parseFigmaSelection('https://www.figma.com/design/abc/File'), null);
  assert.equal(parseFigmaSelection('https://www.figma.com/design/abc/File?node-id=0-1'), null);
});

test('shouldCapture ignores disabled and duplicate selections', () => {
  const selection = { fileKey: 'abc', nodeId: '12:34' };
  assert.equal(shouldCapture({ enabled: false, lastKey: '' }, selection), false);
  assert.equal(shouldCapture({ enabled: true, lastKey: 'abc/12:34' }, selection), false);
  assert.equal(shouldCapture({ enabled: true, lastKey: '' }, selection), true);
});

test('createClipboardManifest emits unified png-only protocol honestly', () => {
  const manifest = createClipboardManifest({ fileKey: 'abc', nodeId: '12:34', file: 'abc-12-34.png', width: 750, height: 1624, capturedAt: '2026-07-18T10:00:00.000Z', url: 'https://www.figma.com/design/abc/File?node-id=12-34', editableRegions: ['content-area'], exporterVersion: '1.2.1' });
  assert.equal(manifest.schemaVersion, '1.0');
  assert.deepEqual(manifest.exporter, { type: 'chrome-extension', version: '1.2.1', capabilities: ['frame-png'] });
  assert.deepEqual(manifest.source, { fileKey: 'abc', fileName: null, url: 'https://www.figma.com/design/abc/File?node-id=12-34', exportedAt: '2026-07-18T10:00:00.000Z' });
  assert.deepEqual(manifest.pages, [{ id: 'page-12-34', nodeId: '12:34', layerName: null, png: 'abc-12-34.png', width: 750, height: 1624, scale: null, role: 'page-reference', fidelity: 'strict' }]);
  assert.deepEqual(manifest.assets, []);
  assert.deepEqual(manifest.tokens, {});
  assert.deepEqual(manifest.constraints, { prohibited: ['redraw-provided-assets'], lockedRegions: [], editableRegions: ['content-area'] });
  assert.equal('captureMethod' in manifest, false);
  assert.equal('file' in manifest, false);
});

test('copy shortcut uses valid macOS virtual key codes and modifier mask', () => {
  const events = copyAsPngKeyEvents();
  assert.equal(events[0].windowsVirtualKeyCode, 16);
  assert.equal(events[1].windowsVirtualKeyCode, 91);
  assert.equal(events[2].windowsVirtualKeyCode, 67);
  assert.equal(events[2].modifiers, 12);
});

test('captureStem makes repeated downloads collision-free and deterministic', () => {
  assert.equal(captureStem({ fileKey: 'abc', nodeId: '12:34' }, '2026-07-18T15:37:43.354Z'), 'abc-12-34-20260718-153743-354');
});

test('interaction migration disables previously enabled continuous capture once', () => {
  assert.deepEqual(interactionModeMigration({ enabled: true }, 2), { enabled: false, lastKey: '', interactionModeVersion: 2 });
  assert.equal(interactionModeMigration({ enabled: true, interactionModeVersion: 2 }, 2), null);
});

test('waitForPng keeps polling while Figma is still rendering', async () => {
  let reads = 0;
  let waits = 0;
  const png = await waitForPng(
    async () => {
      reads += 1;
      if (reads < 3) throw new Error('Figma 没有把 PNG 写入剪贴板');
      return { width: 1125, height: 2436, dataUrl: 'data:image/png;base64,ok' };
    },
    async () => { waits += 1; },
    { attempts: 5, intervalMs: 250 }
  );

  assert.equal(reads, 3);
  assert.equal(waits, 2);
  assert.equal(png.width, 1125);
});

test('waitForPng rejects a stale PNG left by the previous capture', async () => {
  const stale = 'data:image/png;base64,old';
  let reads = 0;
  const png = await waitForPng(
    async () => {
      reads += 1;
      return reads < 3
        ? { width: 10, height: 10, dataUrl: stale }
        : { width: 20, height: 20, dataUrl: 'data:image/png;base64,new' };
    },
    async () => {},
    { attempts: 4, intervalMs: 250, previousDataUrl: stale }
  );

  assert.equal(reads, 3);
  assert.equal(png.dataUrl, 'data:image/png;base64,new');
});
