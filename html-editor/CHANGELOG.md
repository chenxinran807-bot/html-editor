# Changelog

## 1.2.0 — Workflow Handoff

- 包装器新增 taskId、sessionId 和 prdFingerprint 三项可选绑定参数。
- 导出同时包含普通用户摘要与 `prd-demo-annotations` 结构化 JSON。
- 带 `data-prd-clause` 的节点优先输出稳定 `targetClauseId`；旧页面不伪造条款 ID。
- 所有修改请求明确为 `target-only`，供消费 Agent 做未受影响页面回归。
- 强制升级会同时移除旧 workflow meta，避免一个 HTML 绑定多个生成会话。
- 标注层继续只记录意图，不修改任何业务页面 DOM。

## 1.1.0 — macOS Overlay

- 将原有 emoji 密集工具条升级为 macOS 原生 Inspector 风格的 HTML 浮层。
- 用户主流程统一为“标记修改 → 我的修改 → 完成标注”。
- 修改面板使用“修改文字、更换图片、调整位置或大小、参考其他样式”等普通用户语言。
- 图标全部改为内联 SVG；字体使用系统字体；运行时不需要 UI 框架、图标库、字体文件或网络。
- 增加移动端底部面板、键盘退出、旧位置失效提示和复制失败兜底。
- CSS 选择器、HTML 片段和参考图数据继续保留在机器可读交付内容中，但不在用户界面展示。
- 保持原有点选、框选、参考图、localStorage、多页面 pin 和导出协议兼容。

### 升级旧页面

```bash
python3 scripts/wrap_annotator.py <old.html> -o <old.html> --force
```

`--force` 会移除旧标注脚本并注入 1.1.0，不会改写原页面业务结构。

### 后续方向

可选增加外部图标库、组件案例、字体排版预设和参考图库；这些能力只用于提供设计参考，不能成为标注工具正常运行的前置条件。
