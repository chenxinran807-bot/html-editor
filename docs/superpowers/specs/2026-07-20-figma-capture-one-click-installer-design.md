# Figma 采集助手 MVP v2.0.0 一键安装版设计

## 目标

将已经通过真实端到端验收的 M1（Figma 多选批量导出）和 M2（本机校验并上传飞书）冻结为 macOS 内部交付包。目标用户是普通设计师：不安装 Node.js、不执行终端命令、不理解任务协议。

本版本为 macOS 未签名内部版。首次启动允许用户通过右键“打开”绕过 Gatekeeper，并通过二维码授权个人飞书云空间。

## 用户体验

### 首次安装

1. 解压安装包，将 `Figma采集助手.app` 拖入“应用程序”。
2. 右键打开 App，确认 macOS 未签名应用提示。
3. App 检查飞书登录态；未登录时展示二维码并等待扫码授权。
4. App 展示 Figma 插件安装引导，并提供插件 manifest 的明确位置。
5. 用户在 Figma Desktop 中执行一次 `Plugins → Development → Import plugin from manifest…`。
6. App 注册当前用户级后台监听并显示“等待采集”。

Figma 开发插件的导入必须由用户在 Figma 中确认，安装器不模拟点击，也不修改 Figma 私有配置。

### 日常使用

1. 用户在有编辑权限的个人 Draft 中多选目标 Frame，运行 `Figma Capture Kit — Batch`，点击“采集所选 Frame”。
2. 插件生成一个 `figma-task-<taskId>.zip` 到下载目录。
3. 本机助手自动校验任务协议与逐文件 SHA-256，上传至飞书 `/prd-demo-tasks/<taskId>/`，最后上传 `_COMPLETE.json`。
4. 用户在 Aime 中要求 prd-demo Skill 使用刚采集的任务生成 Demo。

## 组件边界

### Figma 插件

- 读取当前多选 Frame。
- 导出页面 PNG、整页 SVG、可复用 SVG 素材、图层文本与能力声明。
- 生成 unified manifest v2.0.0、`task.json` 和单一任务 ZIP。
- 不持有飞书凭证，不直接上传外部服务。

### Figma 采集助手 App

- 内置运行所需依赖，不要求系统安装 Node.js。
- 监听 `~/Downloads/figma-task-*.zip`。
- 校验路径安全、协议形状、任务 ID 和 SHA-256。
- 使用用户身份登录飞书并上传任务。
- 保证 `_COMPLETE.json` 最后上传。
- 保存最小本机状态，仅记录已处理任务和最近结果，不保存 App Secret。
- 提供等待、上传中、成功、失败、需登录五种状态。

### Chrome 扩展

只作为无法复制到个人 Draft、只能查看只读文件时的高级兜底工具。它不进入普通用户安装主流程，也不承担多 Frame、Token 或图层素材采集。

## 交付结构

```text
Figma采集助手-MVP-v2.0.0/
├── Figma采集助手.app
├── Figma插件/
│   ├── manifest.json
│   ├── code.js
│   ├── ui.html
│   └── 必需运行文件
├── 高级兜底工具/
│   └── Chrome扩展/
├── 安装说明.md
├── 使用说明.md
├── 常见问题.md
├── MVP验收报告.md
├── 版本说明.md
└── 后续迭代方向.md
```

最终同时提供 ZIP 交付包和 SHA-256 摘要。ZIP 不包含开发依赖、源码测试目录、缓存、历史包或用户凭证。

## 错误处理

- ZIP 未写完：等待文件稳定后再处理。
- 协议或哈希失败：不上传、不写 `_COMPLETE.json`，在 App 中显示可读错误。
- 飞书登录过期：暂停上传并提示重新扫码；本地 ZIP 保留，下次自动重试。
- 网络中断：任务保持未完成状态；恢复后重试。
- 同一 ZIP 重复出现：依据本机状态与 taskId 幂等跳过。
- 远端已有同 taskId：复用任务目录，仍以最后成功写入 `_COMPLETE.json` 为可消费标准。

## 安全与隐私

- 首次说明将上传 Figma PNG、SVG、图层文本和素材到用户个人飞书云空间。
- 用户明确授权后才启用上传。
- App 不上传原始 `.fig` 文件。
- App 不保存飞书 App Secret；使用用户身份登录态。
- 未通过本地完整性校验的任务不得上传。

## MVP 冻结范围

冻结版本为 v2.0.0，已验证：

- 3 个真实 Frame 一次选择并绑定为一个任务；
- 3 份 PNG、3 份整页 SVG、91 份 SVG 素材；
- 98 条任务文件哈希校验通过；
- 飞书任务目录、`task.json`、manifest、pages、assets 均存在；
- `_COMPLETE.json` 最后上传；
- 消费侧能够识别并生成 Demo。

以下进入 v2.0.1+，不阻塞 MVP：补充采集状态、fileKey/设计版本溯源、注释文字过滤、asset 哈希直出、计数口径澄清、自动选最新任务和消费回执。

## 验收标准

1. 在未安装 Node.js 的测试账户中，用户可以通过 App 完成登录、监听和上传。
2. App 首次启动提供清晰的未签名放行说明和 Figma 插件导入说明。
3. 设计师无需终端即可完成日常采集。
4. 同一批多选 Frame 只生成一个 taskId。
5. 任何校验失败均不会产生远端 `_COMPLETE.json`。
6. 成功任务的 `_COMPLETE.json` 创建时间晚于 payload 文件。
7. 安装包不含登录凭证、用户任务数据和开发依赖。
8. 文档同时覆盖安装、使用、常见问题、验收结论和迭代方向。

