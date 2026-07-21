# Figma Capture Helper Root Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Agent 能唯一识别当前用户的任务根目录，并让用户在采集助手里看到任务已经可被任何兼容 Agent 消费。

**Architecture:** 不改 Figma 插件和任务 ZIP；只在上传器首次使用根目录时确保一个不可变 marker，并把成功状态的 taskId、完成时间和云盘入口传给桌面 UI。marker 在任何任务前写入，任务仍以 `_COMPLETE.json` 最后上传保持原子完成。

**Tech Stack:** Node.js CommonJS、现有 Lark CLI adapter、Electron renderer、Node test runner。

---

### Task 1: Add an immutable root marker

**Files:**
- Modify: `figma-capture-kit/uploader/lark-cli.js`
- Modify: `figma-capture-kit/uploader/upload-task.js`
- Modify: `figma-capture-kit/test/lark-cli-adapter.test.js`
- Modify: `figma-capture-kit/test/upload-task.test.js`

- [ ] **Step 1: Add failing adapter tests**

Require these methods:

```javascript
adapter.findFile(name, folderToken)
adapter.downloadJson(fileToken)
```

Mock Lark responses and assert exact-name search does not accept similarly named files.

- [ ] **Step 2: Add failing upload tests**

Assert first upload writes this before `task.json`:

```json
{
  "rootSchemaVersion": "1.0",
  "kind": "prd-demo-task-root",
  "ownerOpenId": "ou_test",
  "createdBy": "figma-capture-helper"
}
```

Assert an existing matching marker is reused, an owner mismatch throws before creating a task folder, and `_COMPLETE.json` remains the final upload.

- [ ] **Step 3: Verify failure**

Run: `cd figma-capture-kit && node --test test/lark-cli-adapter.test.js test/upload-task.test.js`

Expected: FAIL on missing file lookup/download and marker upload.

- [ ] **Step 4: Implement marker validation**

Add `ensureRootMarker(adapter, root, user)` to `upload-task.js`. Exact behavior:

1. `findFile('_PRD_DEMO_ROOT.json', root)`.
2. If absent, upload marker bytes once.
3. If present, download and validate all four fields.
4. Reject mismatched owner/kind/version; never overwrite the marker.
5. Only then create `{taskId}` folder and upload task contents.

- [ ] **Step 5: Run tests**

Run: `cd figma-capture-kit && npm test`

Expected: all existing tests and marker tests pass.

- [ ] **Step 6: Commit**

```bash
git add figma-capture-kit/uploader figma-capture-kit/test
git commit -m "feat: mark figma task roots by owner"
```

### Task 2: Make successful handoff understandable in the desktop app

**Files:**
- Modify: `figma-capture-kit/desktop-app/uploader-service.js`
- Modify: `figma-capture-kit/desktop-app/renderer/app.js`
- Modify: `figma-capture-kit/desktop-app/renderer/index.html`
- Modify: `figma-capture-kit/test/desktop-uploader.test.js`

- [ ] **Step 1: Add failing state tests**

Assert the success state contains:

```javascript
{
  phase: 'success',
  taskId: '9c5ba2e8-9e68-4bcb-82fc-bb47b61cc0ce',
  completedAt: '2026-07-21T10:13:00.000Z',
  message: '已上传 3 个页面，可回到 Agent 生成 Demo'
}
```

The page count comes from validated manifest pages, not ZIP file count.

- [ ] **Step 2: Verify failure**

Run: `cd figma-capture-kit && node --test test/desktop-uploader.test.js`

Expected: FAIL on missing `completedAt` and page-count message.

- [ ] **Step 3: Pass upload summary through the service**

Return `pageCount` from archive processing, propagate `completion.completedAt`, and emit the exact success message. Do not expose file tokens, owner IDs, or local paths in renderer state.

- [ ] **Step 4: Simplify the success UI**

Show only:

- title: `采集完成`
- message: `3 个页面已安全上传。现在回到 Agent，说“根据当前 PRD 和刚采集的设计生成 Demo”。`
- secondary action: `查看任务文件夹`

Hide the raw task ID under a disclosure labelled `技术信息` instead of making it the primary content.

- [ ] **Step 5: Run tests and renderer smoke check**

Run: `cd figma-capture-kit && npm test && npm run check`

Expected: all tests pass and syntax checks exit 0.

- [ ] **Step 6: Commit**

```bash
git add figma-capture-kit/desktop-app figma-capture-kit/test
git commit -m "feat: clarify capture handoff status"
```

### Task 3: Release the updated helper

**Files:**
- Modify: `figma-capture-kit/package.json`
- Modify: `figma-capture-kit/release-docs/使用说明.md`
- Modify: `figma-capture-kit/release-docs/版本说明.md`
- Modify: `figma-capture-kit/test/release-package.test.js`

- [ ] **Step 1: Update release expectations**

Test that the package includes marker-capable uploader code and the two-step user wording, and excludes auth caches, QR images, tokens, `.DS_Store`, tests, and source maps.

- [ ] **Step 2: Bump the patch version and docs**

Set the helper version to `2.0.2`. Document one-time setup separately from daily two-step use; state that compatible Agents require Lark Drive access and otherwise accept a task folder link or ZIP.

- [ ] **Step 3: Build and verify**

Run:

```bash
cd figma-capture-kit
npm test
npm run check
npm run release:mvp
```

Expected: `dist/Figma采集助手-MVP-v2.0.2-arm64.zip` and `.sha256` exist; release tests pass.

- [ ] **Step 4: Commit**

```bash
git add figma-capture-kit
git commit -m "build: release figma capture helper 2.0.2"
```
