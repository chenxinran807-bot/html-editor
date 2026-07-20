# Figma Capture 本机上传器

上传器监听 `~/Downloads/figma-task-*.zip`，校验任务协议与逐文件 SHA-256，然后上传到当前飞书用户的 `/prd-demo-tasks/<taskId>/`。`_COMPLETE.json` 永远最后上传。

## 首次准备

1. 安装 Node.js 20+ 与 `lark-cli`。
2. 使用用户身份登录并授予最小 Drive 权限：文件夹创建、文件上传、目录读取和用户身份读取。
3. 在本目录运行 `npm install`。

## 手动跑一次

```bash
node uploader/cli.js --once
```

如果 `/prd-demo-tasks` 已经由管理员创建，可传其父目录 token：

```bash
node uploader/cli.js --once --folder-token <PARENT_FOLDER_TOKEN>
```

## 常驻监听

```bash
node uploader/cli.js --watch
```

上传器不保存 access token 或 App Secret；它只调用本机现有的 `lark-cli --as user` 登录态。失败任务不会写 `_COMPLETE.json`，下次运行会继续重试。

