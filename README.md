# html-editor

为任意静态 HTML 注入轻量、可视化的标注面板，让用户直接点选页面内容、描述修改要求，再把结构化标注交给 Agent 精确回改。

静态 HTML 注入仍是主要流程；Streamlit 支持是增量能力，不替换、不改变既有 HTML 用法。

## 当前版本

`1.4.0`

## 主要能力

- macOS 原生 Inspector 风格，面板尽量避开页面内容；
- 点选元素或拖拽框选区域；
- 文字、颜色、圆角、边框、阴影、图片与间距的可视化调整；
- 页面常用颜色、系统取色器与浏览器屏幕吸色；
- 标注本地持久化、复核、删除和结构化导出；
- 与 `prd-demo` 的任务、会话和需求条款绑定；
- 可无侵入连接已有 Streamlit 应用，支持组件复合指纹、rerun 恢复和结构化导出；
- 零运行时网络依赖。

## 静态 HTML

```bash
python3 scripts/wrap_annotator.py input.html -o output.html
```

更新已经注入旧版标注层的页面：

```bash
python3 scripts/wrap_annotator.py input.html -o input.html --force
```

## Streamlit

`<project>` 可以是项目目录或 `.zip`，两种输入使用相同命令：

```bash
python3 scripts/streamlit_adapter.py inspect <project>
python3 scripts/streamlit_adapter.py launch <project> [--entry <file>] [--port <port>]
```

ZIP 会安全提取到私有临时目录；源归档保持不变，临时目录会在检查结束、进程退出或错误时清理。不要在 Adapter 外手动解压来绕过归档检查。

`launch` 首行输出 launch metadata，包括 URL、`projectFingerprint`、`pythonExecutable`、`pythonSource`、`runtimeDigest` 和 `runtimeScope`，但这不表示服务已经可用。Adapter 会优先使用项目虚拟环境，不执行激活脚本或 shell。

必须先对 URL 做成功的 HTTP probe，并确认页面存在 Streamlit root。紧接注入前重新执行 `inspect`，将新结果中的 `projectFingerprint`、`runtimeDigest`、`runtimeScope` 与 launch metadata 比较；全部一致后才读取 `assets/streamlit-annotator.js`。先检查 `window.__HTML_EDITOR_STREAMLIT__`，设置 `window.__HTML_EDITOR_STREAMLIT_CONFIG__` 后仅注入一次。

此流程不会修改应用源码或依赖声明；缺少依赖时仍需用户批准。

## 验证

```bash
npm test
node scripts/build-release.mjs
```

安装包位于 `dist/html-editor-1.4.0.zip`。
