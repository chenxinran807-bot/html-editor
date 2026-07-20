# Figma Capture One-Click Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an unsigned Apple Silicon macOS menu-bar app that bundles the validated uploader and Lark CLI runtime, guides first-time Lark authorization and Figma plugin import, watches Downloads, and ships with end-user documentation as MVP v2.0.0.

**Architecture:** Electron supplies a bundled Node runtime and a small native-feeling menu-bar UI. The existing uploader remains the single implementation of validation and Drive upload; the app invokes the bundled Lark CLI through Electron's `ELECTRON_RUN_AS_NODE=1` mode, so the target Mac needs no Node.js or terminal setup. The Figma development plugin stays a separate folder because Figma requires the user to confirm its import once.

**Tech Stack:** Electron, Node.js CommonJS, existing JSZip validator/uploader, bundled `@larksuite/cli`, macOS Login Items, Node test runner, ZIP + SHA-256 release artifact.

---

## File map

- Create `figma-capture-kit/desktop-app/main.js`: Electron lifecycle, menu-bar window, login item and uploader controller.
- Create `figma-capture-kit/desktop-app/preload.js`: narrow IPC bridge for renderer actions.
- Create `figma-capture-kit/desktop-app/renderer/index.html`: first-run, status and help UI.
- Create `figma-capture-kit/desktop-app/renderer/app.js`: renderer state transitions.
- Create `figma-capture-kit/desktop-app/auth.js`: Lark status/device-flow/QR orchestration.
- Create `figma-capture-kit/desktop-app/uploader-service.js`: start/stop uploader and normalize progress events.
- Create `figma-capture-kit/desktop-app/release.js`: clean release-folder assembly and ZIP hashing.
- Create `figma-capture-kit/test/desktop-auth.test.js`: device-flow parsing tests.
- Create `figma-capture-kit/test/desktop-uploader.test.js`: watcher status tests.
- Create `figma-capture-kit/test/release-package.test.js`: package-content and secret-leak tests.
- Modify `figma-capture-kit/uploader/lark-cli.js`: support executable prefix args and environment overrides.
- Modify `figma-capture-kit/package.json`: Electron dev dependency and desktop build/release scripts.
- Replace `figma-capture-kit/README.md`: frozen MVP developer overview, clearly separate main and fallback paths.
- Create `figma-capture-kit/release-docs/*.md`: installation, usage, FAQ, acceptance, release notes and roadmap.

### Task 1: Make the Lark CLI adapter portable inside Electron

**Files:**
- Modify: `figma-capture-kit/uploader/lark-cli.js`
- Modify: `figma-capture-kit/test/upload-task.test.js`
- Create: `figma-capture-kit/test/lark-cli-adapter.test.js`

- [ ] **Step 1: Write the failing adapter test**

Add a test that injects `binary`, `prefixArgs`, `env`, and a fake `execFile` implementation, then asserts the effective command begins with the bundled CLI entry point and includes `ELECTRON_RUN_AS_NODE=1`.

```js
test('adapter prepends bundled cli entry and electron node mode', async () => {
  const calls = [];
  const adapter = createLarkCliAdapter({
    binary: '/App/MacOS/Figma Capture Helper',
    prefixArgs: ['/App/Resources/lark-cli/scripts/run.js'],
    env: { ELECTRON_RUN_AS_NODE: '1' },
    execFile: async (binary, args, options) => {
      calls.push({ binary, args, options });
      return { stdout: JSON.stringify({ identities: { user: { available: true, openId: 'ou_test', userName: 'Test' } } }) };
    }
  });
  await adapter.currentUser();
  assert.equal(calls[0].binary, '/App/MacOS/Figma Capture Helper');
  assert.equal(calls[0].args[0], '/App/Resources/lark-cli/scripts/run.js');
  assert.equal(calls[0].options.env.ELECTRON_RUN_AS_NODE, '1');
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test test/lark-cli-adapter.test.js`

Expected: FAIL because `prefixArgs`, `env`, and `execFile` injection are not implemented.

- [ ] **Step 3: Implement portable command construction**

Update `createLarkCliAdapter` so every call uses:

```js
const execute = options.execFile || execFileAsync;
const prefixArgs = options.prefixArgs || [];
const extraEnv = options.env || {};
const { stdout } = await execute(binary, [...prefixArgs, ...args], {
  cwd: runOptions.cwd,
  maxBuffer: 20 * 1024 * 1024,
  env: {
    ...process.env,
    ...extraEnv,
    LARKSUITE_CLI_NO_UPDATE_NOTIFIER: '1',
    LARKSUITE_CLI_NO_SKILLS_NOTIFIER: '1'
  }
});
```

- [ ] **Step 4: Run uploader tests**

Run: `node --test test/lark-cli-adapter.test.js test/upload-task.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit adapter support**

```bash
git add figma-capture-kit/uploader/lark-cli.js figma-capture-kit/test/lark-cli-adapter.test.js figma-capture-kit/test/upload-task.test.js
git commit -m "feat: support bundled lark cli runtime"
```

### Task 2: Add first-run Lark authorization orchestration

**Files:**
- Create: `figma-capture-kit/desktop-app/auth.js`
- Create: `figma-capture-kit/test/desktop-auth.test.js`

- [ ] **Step 1: Write failing device-flow tests**

Cover three concrete cases: an existing user session returns `ready`; a missing session returns a QR path and device code; polling success returns the authorized user.

```js
test('beginLogin returns a QR image generated from verification URL', async () => {
  const runner = fakeRunner([
    { verification_uri_complete: 'https://open.feishu.cn/device?code=ABCD', device_code: 'device-1' },
    { ok: true }
  ]);
  const auth = createAuthService({ runner, qrPath: '/tmp/figma-helper/qr.png' });
  const result = await auth.beginLogin();
  assert.equal(result.deviceCode, 'device-1');
  assert.equal(result.qrPath, '/tmp/figma-helper/qr.png');
  assert.deepEqual(runner.calls[1], ['auth', 'qrcode', 'https://open.feishu.cn/device?code=ABCD', '--output', 'qr.png']);
});
```

- [ ] **Step 2: Verify the test fails**

Run: `node --test test/desktop-auth.test.js`

Expected: FAIL with missing `desktop-app/auth.js`.

- [ ] **Step 3: Implement auth service**

Export `createAuthService({runner, qrPath})` with `status()`, `beginLogin()`, and `finishLogin(deviceCode)`. `beginLogin()` runs `auth login --domain drive --no-wait --json`, extracts `verification_uri_complete || verification_uri`, generates a PNG via `auth qrcode`, and returns only renderer-safe fields. `finishLogin()` runs `auth login --device-code <code> --json`, then rechecks `auth status --json`.

- [ ] **Step 4: Run auth tests**

Run: `node --test test/desktop-auth.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit auth service**

```bash
git add figma-capture-kit/desktop-app/auth.js figma-capture-kit/test/desktop-auth.test.js
git commit -m "feat: add lark device login flow"
```

### Task 3: Build the menu-bar app and uploader service

**Files:**
- Create: `figma-capture-kit/desktop-app/main.js`
- Create: `figma-capture-kit/desktop-app/preload.js`
- Create: `figma-capture-kit/desktop-app/uploader-service.js`
- Create: `figma-capture-kit/desktop-app/renderer/index.html`
- Create: `figma-capture-kit/desktop-app/renderer/app.js`
- Create: `figma-capture-kit/test/desktop-uploader.test.js`

- [ ] **Step 1: Write failing uploader-service tests**

Test idle startup, progress parsing for `正在上传`, success parsing for `已完成任务`, and retryable failure state without losing the ZIP.

```js
test('service emits completed task id', async () => {
  const service = createUploaderService({ runOnce: async () => ({ taskId: 'task-1' }) });
  const states = [];
  service.on('state', state => states.push(state));
  await service.scanOnce();
  assert.deepEqual(states.at(-1), { phase: 'success', taskId: 'task-1' });
});
```

- [ ] **Step 2: Verify the test fails**

Run: `node --test test/desktop-uploader.test.js`

Expected: FAIL with missing service module.

- [ ] **Step 3: Implement uploader service**

Reuse `findCandidateArchives`, `loadState`, `saveState`, and `processArchive`. Run one scan every three seconds only after auth is ready. Emit `{phase:'idle'|'uploading'|'success'|'error'|'auth-required'}`. Preserve failed archives by appending to `processed` only after successful upload.

- [ ] **Step 4: Implement Electron main and IPC bridge**

Create one tray item and one 420×560 window. Expose only:

```js
contextBridge.exposeInMainWorld('captureHelper', {
  getState: () => ipcRenderer.invoke('state:get'),
  beginLogin: () => ipcRenderer.invoke('auth:begin'),
  finishLogin: code => ipcRenderer.invoke('auth:finish', code),
  openPluginFolder: () => ipcRenderer.invoke('plugin:open-folder'),
  openTaskFolder: () => ipcRenderer.invoke('drive:open-folder'),
  retry: () => ipcRenderer.invoke('uploader:retry')
});
```

Enable `app.setLoginItemSettings({openAtLogin:true, openAsHidden:true})` after onboarding completes. Keep `contextIsolation:true`, `nodeIntegration:false`, and deny navigation/new windows except explicit external URLs.

- [ ] **Step 5: Implement renderer states**

The single page must show: privacy disclosure; QR login; Figma plugin import path; idle; uploading; success with task ID; error with retry. Do not expose protocol jargon on the primary screen.

- [ ] **Step 6: Run unit and syntax checks**

Run: `node --test test/desktop-uploader.test.js && node --check desktop-app/main.js && node --check desktop-app/preload.js && node --check desktop-app/renderer/app.js`

Expected: PASS and no syntax errors.

- [ ] **Step 7: Commit the desktop app**

```bash
git add figma-capture-kit/desktop-app figma-capture-kit/test/desktop-uploader.test.js
git commit -m "feat: add figma capture menu bar app"
```

### Task 4: Package a self-contained unsigned macOS app

**Files:**
- Modify: `figma-capture-kit/package.json`
- Modify: `figma-capture-kit/package-lock.json`
- Create: `figma-capture-kit/scripts/package-desktop.mjs`
- Create: `figma-capture-kit/test/release-package.test.js`

- [ ] **Step 1: Write failing release-content tests**

The test receives a staging directory and asserts that it contains the `.app`, plugin runtime files, bundled Lark CLI, and release docs; and excludes `node_modules` outside the app, `.git`, `.DS_Store`, auth QR files, access tokens, App Secrets, previous ZIPs, tests and source maps.

```js
test('release excludes credentials and development files', async () => {
  const files = await listFiles(releaseRoot);
  assert(files.includes('Figma采集助手.app/Contents/Resources/app/desktop-app/main.js'));
  assert(files.includes('Figma插件/manifest.json'));
  assert.equal(files.some(path => /auth-qr|\.env|node_modules\/\.cache|test\//.test(path)), false);
});
```

- [ ] **Step 2: Verify failure before packaging**

Run: `node --test test/release-package.test.js`

Expected: FAIL because no release staging folder exists.

- [ ] **Step 3: Add Electron packaging dependencies**

Install `electron` and `@electron/packager` as dev dependencies. Add scripts:

```json
{
  "desktop:start": "electron desktop-app/main.js",
  "desktop:package": "node scripts/package-desktop.mjs",
  "release:mvp": "npm run build:plugin && npm run desktop:package && node desktop-app/release.js"
}
```

- [ ] **Step 4: Implement app packaging**

Package for `darwin-arm64` with product name `Figma采集助手`, bundle identifier `com.bytedance.internal.figma-capture-helper`, version `2.0.0`, no signing, no notarization, and no ASAR for inspectable internal delivery. Copy `/opt/homebrew/lib/node_modules/@larksuite/cli` into `Contents/Resources/lark-cli` during the build and fail with a clear message if the CLI source is unavailable.

- [ ] **Step 5: Run packaging and release tests**

Run: `npm run desktop:package && node --test test/release-package.test.js`

Expected: one arm64 `.app` is created and all release-content assertions PASS.

- [ ] **Step 6: Verify bundled runtime without system Node**

Run the app executable in Node mode with a minimal environment:

```bash
env -i HOME="$HOME" PATH=/usr/bin:/bin ELECTRON_RUN_AS_NODE=1 \
  "dist/Figma采集助手.app/Contents/MacOS/Figma采集助手" \
  "dist/Figma采集助手.app/Contents/Resources/lark-cli/scripts/run.js" auth status --json
```

Expected: valid JSON from the bundled CLI; no `node: command not found` error.

- [ ] **Step 7: Commit packaging**

```bash
git add figma-capture-kit/package.json figma-capture-kit/package-lock.json figma-capture-kit/scripts/package-desktop.mjs figma-capture-kit/test/release-package.test.js
git commit -m "build: package unsigned macOS capture helper"
```

### Task 5: Write the end-user documentation set

**Files:**
- Replace: `figma-capture-kit/README.md`
- Create: `figma-capture-kit/release-docs/安装说明.md`
- Create: `figma-capture-kit/release-docs/使用说明.md`
- Create: `figma-capture-kit/release-docs/常见问题.md`
- Create: `figma-capture-kit/release-docs/MVP验收报告.md`
- Create: `figma-capture-kit/release-docs/版本说明.md`
- Create: `figma-capture-kit/release-docs/后续迭代方向.md`

- [ ] **Step 1: Rewrite the root README for maintainers**

State that the primary path is Figma Plugin + desktop helper; move the Chrome extension to a clearly marked read-only fallback; document exact build/test/release commands and the privacy boundary.

- [ ] **Step 2: Write installation and usage guides**

Installation must use screenshots-free, exact UI labels: right-click App → Open; scan Lark QR; open plugin folder; Figma Desktop → Plugins → Development → Import plugin from manifest. Usage must fit on one screen and contain the two daily actions only.

- [ ] **Step 3: Write FAQ, acceptance report, release notes and roadmap**

FAQ covers Gatekeeper, QR expiry, no download, upload retry, read-only Figma files, and uninstall. Acceptance report records the real task `5e7d001d-a4ce-47c2-85cc-75ab257f84d0`, three node IDs, six page artifacts, 91 SVG assets, 98 task-file hashes, and remote `_COMPLETE.json`. Roadmap separates v2.0.1 data-quality work from M3 automatic selection/receipt work.

- [ ] **Step 4: Scan documentation for stale primary-path claims**

Run:

```bash
rg -n "Chrome.*主路径|先.*npm install|node uploader/cli.js --watch" README.md release-docs
```

Expected: no end-user instruction requires Chrome, npm, Node or terminal.

- [ ] **Step 5: Commit documentation**

```bash
git add figma-capture-kit/README.md figma-capture-kit/release-docs
git commit -m "docs: add figma capture installer guides"
```

### Task 6: Assemble and verify the frozen MVP release

**Files:**
- Create: `figma-capture-kit/desktop-app/release.js`
- Create: `figma-capture-kit/dist/Figma采集助手-MVP-v2.0.0-arm64.zip`
- Create: `figma-capture-kit/dist/Figma采集助手-MVP-v2.0.0-arm64.zip.sha256`

- [ ] **Step 1: Implement deterministic release assembly**

Create staging folder `dist/Figma采集助手-MVP-v2.0.0/`, copy the `.app`, Figma plugin runtime, Chrome fallback and release docs, remove extended development artifacts, ZIP the folder, and write a lowercase SHA-256 line containing hash plus filename.

- [ ] **Step 2: Run full regression**

Run: `npm test && npm run check && npm run build:plugin && npm run release:mvp`

Expected: all existing and new tests PASS, plugin builds, app packages, release ZIP and checksum exist.

- [ ] **Step 3: Verify clean extraction**

Extract the ZIP into a new temporary directory and assert:

- `.app` has `Contents/MacOS`, `Contents/Info.plist`, Electron frameworks, desktop app code and bundled Lark CLI;
- `Figma插件/manifest.json`, `code.js`, `ui.html`, and `ui.bundle.js` exist;
- all six user documents exist;
- no `.DS_Store`, QR, token, secret, source map, test directory or prior ZIP is present.

- [ ] **Step 4: Smoke-test app and plugin**

Launch the unsigned App with explicit user approval, verify the onboarding/status window appears, verify existing Lark login is recognized, open the bundled plugin folder, and import the packaged manifest into Figma Desktop. Run the plugin against a small multi-selection and confirm one task ZIP is produced.

- [ ] **Step 5: Record final artifact metadata**

Record ZIP absolute path, byte size, SHA-256, app version, architecture, test count and known unsigned-app warning in `版本说明.md`.

- [ ] **Step 6: Commit release metadata without committing the binary ZIP**

```bash
git add figma-capture-kit/desktop-app/release.js figma-capture-kit/release-docs/版本说明.md
git commit -m "release: freeze figma capture mvp v2.0.0"
```

