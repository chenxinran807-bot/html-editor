const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
const { homedir } = require('node:os');
const { createAuthService } = require('./auth');
const { createUploaderService } = require('./uploader-service');
const { createLarkCliAdapter } = require('../uploader/lark-cli');

const execFileAsync = promisify(execFile);
let window;
let tray;
let uploader;
let currentState = { phase: 'starting' };
let pendingDeviceCode = null;

function resourcePath(...parts) {
  const root = app.isPackaged ? process.resourcesPath : join(__dirname, '..');
  return join(root, ...parts);
}

function larkEntryPath() {
  return app.isPackaged
    ? resourcePath('lark-cli', 'scripts', 'run.js')
    : resourcePath('node_modules', '@larksuite', 'cli', 'scripts', 'run.js');
}

async function runLark(args, options = {}) {
  const { stdout } = await execFileAsync(process.execPath, [larkEntryPath(), ...args], {
    cwd: options.cwd,
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
      LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1'
    }
  });
  try { return JSON.parse(stdout); }
  catch { return { stdout }; }
}

function updateState(next) {
  currentState = { ...currentState, ...next };
  if (window && !window.isDestroyed()) window.webContents.send('state:changed', currentState);
  if (tray) tray.setToolTip(`Figma 采集助手：${currentState.phase}`);
}

function createWindow() {
  window = new BrowserWindow({
    width: 440,
    height: 620,
    resizable: false,
    show: false,
    title: 'Figma 采集助手',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.loadFile(join(__dirname, 'renderer', 'index.html'));
  window.on('close', event => {
    if (!app.isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(bytedance\.larkoffice\.com|open\.feishu\.cn)\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('F');
  tray.setToolTip('Figma 采集助手');
  tray.on('click', () => { window.show(); window.focus(); });
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开 Figma 采集助手', click: () => { window.show(); window.focus(); } },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
}

async function initialize() {
  const qrPath = join(app.getPath('userData'), 'lark-login-qr.png');
  const auth = createAuthService({ runner: runLark, qrPath });
  const authState = await auth.status();
  updateState(authState);

  ipcMain.handle('state:get', () => currentState);
  ipcMain.handle('auth:begin', async () => {
    try {
      updateState({ phase: 'authorizing', message: null, canRetryAuth: false });
      const result = await auth.beginLogin();
      pendingDeviceCode = result.deviceCode;
      const qrData = `data:image/png;base64,${(await readFile(result.qrPath)).toString('base64')}`;
      updateState({ phase: 'awaiting-scan', qrData, verificationUrl: result.verificationUrl });
    } catch (error) {
      updateState({ phase: 'error', message: `授权二维码生成失败：${error.message}`, canRetryAuth: true });
    }
    return currentState;
  });
  ipcMain.handle('auth:finish', async (_event, deviceCode) => {
    try {
      const result = await auth.finishLogin(deviceCode || pendingDeviceCode);
      updateState({ ...result, qrData: null, verificationUrl: null, message: null, canRetryAuth: false });
      startUploader();
      app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
    } catch (error) {
      updateState({ phase: 'error', message: `授权未完成：${error.message}`, canRetryAuth: true });
    }
    return currentState;
  });
  ipcMain.handle('plugin:open-folder', () => shell.openPath(resourcePath('figma-plugin')));
  ipcMain.handle('drive:open-folder', () => shell.openExternal('https://bytedance.larkoffice.com/drive/my-space'));
  ipcMain.handle('uploader:retry', async () => uploader?.scanOnce());
  ipcMain.handle('app:quit', () => { app.isQuitting = true; app.quit(); });

  if (authState.phase === 'ready') startUploader();
  else window.show();
}

function startUploader() {
  if (uploader) return;
  const adapter = createLarkCliAdapter({
    binary: process.execPath,
    prefixArgs: [larkEntryPath()],
    env: { ELECTRON_RUN_AS_NODE: '1' }
  });
  uploader = createUploaderService({
    downloads: app.getPath('downloads'),
    staging: join(homedir(), 'Library', 'Application Support', 'Figma Capture Uploader'),
    adapter
  });
  uploader.on('state', updateState);
  uploader.start();
}

app.whenReady().then(async () => {
  createWindow();
  createTray();
  await initialize();
});

app.on('window-all-closed', event => event?.preventDefault?.());
app.on('before-quit', () => { app.isQuitting = true; uploader?.stop(); });

module.exports = { runLark, resourcePath };
