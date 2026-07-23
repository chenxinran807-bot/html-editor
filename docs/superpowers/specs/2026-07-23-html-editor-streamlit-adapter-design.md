# HTML Editor Streamlit Adapter 设计

日期：2026-07-23

## 1. 背景与目标

现有 HTML Editor 为 `prd-demo` 生成的静态 HTML 注入可视化标注层，形成“生成 Demo → 点选或框选 → 导出结构化修改意见 → Agent 精准回改”的闭环。

本次新增 Streamlit Adapter，使用户可以对任意现成的 Streamlit 应用启用相同的标注闭环。用户不需要修改 Python 源码，也不需要学习额外的包装启动命令。

支持两种入口：

1. 用户已经运行 Streamlit，向 Agent 提供页面或项目并要求启用 HTML Editor。
2. 用户上传或指定完整 Streamlit 项目文件夹或 ZIP，并要求启用 HTML Editor。Agent 自动识别、启动、打开并注入标注层。

## 2. 范围

### 2.1 第一版包含

- 任意现成 Streamlit 项目的浏览器运行时注入。
- 单文件和完整项目结构，包括多页面项目及本地资源。
- 常见 Streamlit 组件的点选、框选、批注、持久化与导出。
- Streamlit rerun、DOM 替换和页面切换后的标注恢复。
- 复合元素指纹及 Python 源码定位辅助信息。
- 项目版本指纹与旧标注保护。
- 原 HTML Editor 的完整回归保护。

### 2.2 第一版不包含

- 修改 Streamlit 安装包。
- 向用户项目永久写入标注代码或包装组件。
- 保证第三方 iframe、canvas 或封闭 Shadow DOM 内部元素可被逐项标注。
- 保证任意 DOM 元素都能 100% 自动映射到唯一 Python 源码行。
- 将 Streamlit 替换为 HTML Editor 的主输出格式。

## 3. 方案选择

### 3.1 采用方案：浏览器注入 Adapter

Agent 正常启动或连接 Streamlit，在浏览器运行时注入 Streamlit 标注层。用户无需执行额外命令；浏览器或应用停止后，注入层自然消失。

选择理由：

- 不修改用户源码。
- 同时兼容已运行页面和上传项目。
- 用户体验符合“说一句启用 HTML Editor 即可开始标注”。
- 与现有静态 HTML Adapter 隔离，降低回归风险。

### 3.2 未采用方案

本地反向代理可以提供持久标注 URL，但需要完整代理 Streamlit WebSocket、上传和下载链路，第一版兼容风险较高。

临时修改项目源码可以改善源码映射，但会引入项目污染、恢复失败和代码结构适配问题，不符合无侵入目标。

## 4. 总体架构

```text
html-editor
├── 现有 HTML Adapter
│   ├── scripts/wrap_annotator.py
│   └── assets/annotator-inject.js
├── 共享标注协议
└── Streamlit Adapter
    ├── 项目识别与安全启动
    ├── 浏览器注入与重注入
    ├── Streamlit 元素复合指纹
    ├── 标注持久化与导出
    └── Python 源码定位辅助
```

隔离原则：

- 现有 `wrap_annotator.py` 与 `annotator-inject.js` 的既有行为不变。
- Streamlit Adapter 使用独立文件和独立入口。
- 共享层只定义协议和兼容规则，不要求旧 HTML 标注数据迁移。
- 没有 `adapter` 字段的旧导出默认按 `html` 处理。

## 5. 用户工作流

### 5.1 已运行应用

1. 用户要求为当前 Streamlit 应用启用 HTML Editor。
2. Agent 识别当前页面或用户提供的本地地址。
3. Agent 打开页面并注入 Streamlit 标注层。
4. 用户点选或框选、填写要求并完成标注。
5. 用户将导出内容发送给 Agent。
6. Agent 校验项目指纹，结合元素复合指纹定位 Python 源码并修改。
7. Streamlit 热更新或重启后，Adapter 自动恢复，供用户复核。

### 5.2 上传项目

1. 用户上传或指定项目文件夹或 ZIP。
2. Agent 识别入口、依赖文件、多页面结构和资源目录。
3. Agent 使用项目已有环境启动 Streamlit。
4. 若缺少依赖，Agent 报告缺失项，并按正常授权流程处理安装；不擅自修改依赖清单。
5. Agent 打开应用并注入标注层，后续流程与已运行应用一致。

## 6. 元素定位

Streamlit DOM 会随 rerun 改变，因此 Adapter 不把 CSS selector 作为唯一主键。每条标注生成复合指纹：

```json
{
  "adapter": "streamlit",
  "page": "商品详情",
  "componentType": "button",
  "visibleText": "收藏",
  "testId": "stBaseButton-secondary",
  "accessibleName": "收藏",
  "widgetKey": null,
  "containerPath": ["main", "column:2", "container:商品信息"],
  "neighborText": ["商品标题", "立即购买"],
  "domSelector": "main ... button",
  "intent": "按钮改成黑色",
  "changes": []
}
```

匹配优先级：

1. 稳定 widget key 或可访问标识。
2. 页面名称、组件类型和可见文本。
3. Streamlit `data-testid` 和容器路径。
4. 邻近文字和 DOM selector。

匹配状态：

- `matched`：唯一高置信度匹配，可以恢复 pin。
- `ambiguous`：存在多个合理候选，不自动绑定，要求重新确认。
- `missing`：没有合理候选，保留标注但显示目标已变化。

第三方 iframe、canvas 或不可访问内部 DOM 的组件仅标注外层区域，并将定位置信度设为低。

## 7. 导出协议

导出保持现有“用户可读摘要 + fenced JSON”模式。Streamlit 数据新增顶层适配信息：

```json
{
  "schemaVersion": "1.1",
  "adapter": "streamlit",
  "projectFingerprint": "sha256:...",
  "annotations": []
}
```

兼容规则：

- 旧 HTML 导出格式和字段保持不变。
- 消费端通过 `adapter` 区分 HTML 与 Streamlit。
- 缺少 `adapter` 时默认值为 `html`。
- `changes[]` 保存能够确定的文本、颜色、间距等修改值；自然语言保留在 `intent`。
- 无法可靠映射的标注必须输出 `confidence: "low"`，消费 Agent 必须结合源码确认。
- `projectFingerprint` 不一致时阻止自动回改，除非用户明确确认使用旧标注。

## 8. 重渲染与持久化

- 使用 `MutationObserver` 监听 Streamlit 主内容区域，不使用持续轮询。
- rerun 导致 DOM 替换后重新计算元素指纹并恢复 pin。
- 页面切换时按页面身份隔离标注，避免同名按钮跨页面误绑定。
- 标注数据保存在浏览器本地存储中，并以应用地址及项目指纹隔离。
- 标注层 DOM、样式与存储 key 使用独立前缀，避免和现有应用冲突。
- 工具栏与面板使用独立高层级，不继承 Streamlit 的业务样式。

## 9. 项目启动与安全

- 入口识别优先参考 Streamlit 配置、README、常用入口名称及包含 Streamlit import 的 Python 文件。
- 多个入口无法判定时，Agent 列出候选并结合项目内容判断；仍不明确时才询问用户。
- 使用项目现有虚拟环境和依赖声明，不自动覆盖依赖文件。
- 自动选择空闲本地端口，避免影响已运行服务。
- 启动失败时保留原始错误摘要，不注入、不改源码。
- Adapter 只连接用户明确提供或由当前项目启动的本地 Streamlit 应用。

## 10. 异常与降级

- 找不到入口：报告候选入口和判断依据。
- 缺少依赖：报告缺失包；安装动作遵守既有授权规则。
- 端口冲突：选择新的空闲端口。
- 浏览器注入失败：保留应用地址，说明失败阶段，不宣称已启用。
- rerun 后多候选：标记 `ambiguous`，不猜测目标。
- 项目版本不一致：阻止自动回改。
- 第三方封闭组件：降级到外层区域标注。
- 浏览器存储不可用：当前会话继续工作，明确提示刷新后不会保留。

## 11. 测试设计

### 11.1 原能力回归

运行现有 HTML Editor 全量测试，验证静态 HTML 注入、交互、协议、旧版升级和发布包均保持兼容。

### 11.2 单元测试

- Streamlit 组件类型识别。
- 复合元素指纹生成。
- 唯一匹配、歧义匹配和缺失匹配。
- Streamlit 协议序列化与旧 HTML 协议兼容。
- 项目指纹生成及不一致保护。
- 项目入口识别与端口选择。

### 11.3 DOM 重渲染测试

使用 jsdom 验证：

- DOM 替换后工具栏重新出现。
- 唯一目标 pin 恢复。
- 同名目标不跨页面错误恢复。
- 多候选进入 `ambiguous`。
- 目标消失进入 `missing`。

### 11.4 浏览器端测试

使用最小 Streamlit fixtures 覆盖：

- 单文件项目启动和注入。
- 多页面项目切换。
- widget 交互触发 rerun 后重新注入。
- 标注创建、持久化和导出。
- Adapter 退出后项目源码无变化。

## 12. 第一版验收标准

- 现有 HTML Editor 全量测试通过。
- 被测 Streamlit 项目源码和依赖文件没有变化。
- 单文件及多页面 fixtures 均可由 Agent 自动启动并启用标注。
- 已运行的本地 Streamlit 应用可直接注入。
- rerun 后工具栏和唯一匹配的标注 pin 能恢复。
- 导出包含项目指纹及复合元素指纹。
- 常见 Streamlit 组件可被标注和定位。
- 第三方 iframe 等不支持目标明确降级，不产生虚假的精准定位声明。

## 13. 实施约束

- 新功能采用测试驱动开发，每项生产行为先编写并验证失败测试。
- 不覆盖或重置工作树中已有的用户修改。
- 优先新增文件；修改共享文件时保持最小变更并先建立回归测试。
- 完成前运行 HTML Editor 全量测试、Streamlit Adapter 测试和统一工作流契约测试。
