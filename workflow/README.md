# PRD → Demo 统一工作流验证

这里放跨 `Figma 采集助手`、`prd-demo` 和 `html-editor` 的契约测试。脱敏 fixture 使用三个稳定页面标识：`video-tab`、`outfit-feed-empty-avatar`、`outfit-detail`。

运行：

```bash
node --test workflow/test/contract.e2e.test.mjs
```

测试只调用各组件的真实实现，不复制校验器。私有 Figma 图片和飞书身份不进入仓库。
