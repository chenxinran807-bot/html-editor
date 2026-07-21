# Figma 采集助手

面向内部设计师的 Figma 批量采集与飞书任务上传工具。当前安装包版本为 `2.0.2`。

## 用户主路径

安装包内包含：

- `Figma采集助手.app`：菜单栏常驻，首次扫码授权，自动校验并上传；
- `Figma插件/`：在 Figma 内一次导出多个选中 Frame；
- 六份中文安装、使用、验收与迭代文档；
- `高级兜底工具/Chrome扩展`：只读文件无法复制到 Drafts 时使用，不是推荐主路径。

日常只有两步：

1. 在有编辑权限的 Figma 文件或个人 Drafts 副本中，多选参考 Frame，运行插件并批量导出。
2. 在 Mira、Aime 或其他兼容 Agent 中，要求 `prd-demo` 使用刚采集的 Figma 任务生成高还原交互 Demo。

同一次导出的 Frame 共用 taskId。本机助手完成全量 SHA-256 校验后上传飞书，并最后写入 `_COMPLETE.json`；消费侧只读取完成任务。Agent 若能以当前用户身份搜索飞书云空间，日常保持两步；只能读取链接时多粘贴一次任务文件夹链接；没有飞书能力时上传任务 ZIP。

## 开发与验证

```bash
npm install
npm test
npm run check
npm run build:plugin
```

本机启动菜单栏应用：

```bash
npm run desktop:start
```

构建 macOS Apple 芯片内部未签名安装包：

```bash
npm run release:mvp
```

产物位于 `dist/Figma采集助手-MVP-v2.0.2-arm64.zip`，并同时生成 SHA-256 校验文件。

## 架构分工

- Figma 插件：读取 selection，通过 `exportAsync()` 导出 PNG、SVG、文字和节点信息；
- 菜单栏助手：监听 ZIP、校验任务、以用户身份上传飞书；
- prd-demo Skill：按 unified manifest 与 capabilities 消费任务，不把“未采集”误判为“设计中不存在”。

详细用户操作以发布包内《安装说明》和《使用说明》为准。
