# html-editor

为任意静态 HTML 注入轻量、可视化的标注面板，让用户直接点选页面内容、描述修改要求，再把结构化标注交给 Agent 精确回改。

## 当前版本

`1.3.2`

## 主要能力

- macOS 原生 Inspector 风格，优先停靠页面空白栏，并支持拖动标题栏自由调整位置；
- 点选元素或拖拽框选区域；
- 文字、颜色、圆角、边框、阴影、图片与间距的可视化调整；
- 页面常用颜色、系统取色器与浏览器屏幕吸色；
- 标注本地持久化、复核、删除和结构化导出；
- 与 `prd-demo` 的任务、会话和需求条款绑定；
- 零运行时网络依赖。

## 使用

```bash
python3 scripts/wrap_annotator.py input.html -o output.html
```

更新已经注入旧版标注层的页面：

```bash
python3 scripts/wrap_annotator.py input.html -o input.html --force
```

## 验证

```bash
npm test
node scripts/build-release.mjs
```

安装包位于 `dist/html-editor-1.3.2.zip`。
