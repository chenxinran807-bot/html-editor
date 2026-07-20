importScripts('core.js');

const timers = new Map();
const running = new Set();
const INTERACTION_MODE_VERSION = 2;
const DEFAULTS = { enabled: false, delayMs: 800, role: 'page-reference', fidelity: 'strict', editableRegions: ['content-area'], reference: ['layout','spacing','typography','color'], lastKey: '' };

async function migrateInteractionMode() {
  const state = await chrome.storage.local.get(['enabled', 'lastKey', 'interactionModeVersion']);
  const patch = CaptureCore.interactionModeMigration(state, INTERACTION_MODE_VERSION);
  if (patch) await chrome.storage.local.set(patch);
}
const migrationPromise = migrateInteractionMode();
async function settings() { await migrationPromise; return { ...DEFAULTS, ...(await chrome.storage.local.get(DEFAULTS)) }; }
async function badge(tabId, text, color) { await chrome.action.setBadgeBackgroundColor({ tabId, color }); await chrome.action.setBadgeText({ tabId, text }); }

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [chrome.runtime.getURL('offscreen.html')] });
  if (!contexts.length) await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['CLIPBOARD'], justification: 'Read the PNG copied by the user-selected Figma frame.' });
}

async function copyAsPng(tabId) {
  await chrome.debugger.attach({ tabId }, '1.3');
  try {
    for (const event of CaptureCore.copyAsPngKeyEvents()) {
      await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchKeyEvent', event);
    }
  } finally { await chrome.debugger.detach({ tabId }).catch(() => {}); }
}

async function readClipboardPng() {
  await ensureOffscreen();
  const result = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'read-png' });
  if (!result || result.error) throw new Error(result?.error || '剪贴板没有 PNG');
  return result;
}

async function capture(tabId, url, selection) {
  if (running.has(tabId)) return;
  running.add(tabId);
  try {
    await badge(tabId, '…', '#0d99ff');
    const previousPng = await readClipboardPng().catch(() => null);
    await copyAsPng(tabId);
    const png = await CaptureCore.waitForPng(
      readClipboardPng,
      delayMs => new Promise(resolve => setTimeout(resolve, delayMs)),
      { attempts: 20, intervalMs: 500, previousDataUrl: previousPng?.dataUrl }
    );
    const cfg = await settings();
    const capturedAt = new Date().toISOString();
    const stem = CaptureCore.captureStem(selection, capturedAt);
    const file = `${stem}.png`;
    const manifest = CaptureCore.createClipboardManifest({ ...selection, file, width: png.width, height: png.height, url, role: cfg.role, fidelity: cfg.fidelity, reference: cfg.reference, editableRegions: cfg.editableRegions, capturedAt, exporterVersion: chrome.runtime.getManifest().version });
    const base = `figma_export/incoming/${stem}`;
    await chrome.downloads.download({ url: png.dataUrl, filename: `${base}.png`, saveAs: false });
    const jsonUrl = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(manifest, null, 2))}`;
    await chrome.downloads.download({ url: jsonUrl, filename: `${base}.manifest.json`, saveAs: false });
    await chrome.storage.local.set({ lastKey: CaptureCore.selectionKey(selection), lastCapture: { file, at: manifest.source.exportedAt, width: png.width, height: png.height }, lastError: '' });
    await badge(tabId, '✓', '#14ae5c');
  } catch (error) {
    await chrome.storage.local.set({ lastError: String(error?.message || error) });
    await badge(tabId, '!', '#e5484d');
  } finally { running.delete(tabId); }
}

function consider(details) {
  if (details.frameId !== 0) return;
  const selection = CaptureCore.parseFigmaSelection(details.url);
  if (!selection) return;
  clearTimeout(timers.get(details.tabId));
  settings().then(cfg => {
    timers.set(details.tabId, setTimeout(async () => {
      const latest = await settings();
      if (CaptureCore.shouldCapture(latest, selection)) await capture(details.tabId, details.url, selection);
    }, cfg.delayMs));
  });
}

chrome.webNavigation.onHistoryStateUpdated.addListener(consider, { url: [{ hostSuffix: 'figma.com', pathPrefix: '/design/' }] });
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => { if (changeInfo.url) consider({ tabId, frameId: 0, url: changeInfo.url }); else if (changeInfo.status === 'complete' && tab.url) consider({ tabId, frameId: 0, url: tab.url }); });
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'schedule-capture') {
    chrome.tabs.get(msg.tabId).then(tab => {
      const selection = CaptureCore.parseFigmaSelection(tab.url);
      if (!selection) throw new Error('请先在 Figma 选中一个 Frame');
      setTimeout(() => capture(tab.id, tab.url, selection), 800);
      return { scheduled: true };
    }).then(sendResponse).catch(error => sendResponse({ lastError: error.message }));
    return true;
  }
});
