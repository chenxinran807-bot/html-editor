# QA report · Huashu native outfit directions

## 可复跑路径

1. 用任意 Chrome 启动本地 CDP 端口，例如 `--remote-debugging-port=9335 about:blank`。
2. 在 cell 目录或仓库根目录执行 `CDP_PORT=9335 node qa/browser-qa.mjs`。脚本通过 `import.meta.url` 解析 `../artifact/index.html`，不含工作区绝对路径。
3. `run/build-artifacts.mjs` 可从冻结 input 重建 4 个 base64 自包含 HTML。

## 浏览器证据

- 1440×1100 Chrome；固定 5 项任务均通过真实 DOM 点击。
- 切到「出游」后 active 分类与理由型 feed 同步变化。
- 卡片进入详情；适合人群、配色公式与避雷完整可见。
- 平替 sheet 显示 `Mock ¥189`、尺码和 Mock 声明。
- AI 试穿入口状态打开，明确不上传照片、不伪造结果。
- `pageerror=0`，console error `=0`。
- 三个方向独立截图：`direction-1.png`、`direction-2.png`、`direction-3.png`；主流程证据：`01-entry.png` 至 `04-ai-entry.png`。

## 评分

| 维度 | 分数 | 证据 |
|---|---:|---|
| Fidelity | 20/20 | 冻结真图 base64、自包含；真实 IosFrame 组件结构；3 个独立方向；4 屏主版。 |
| Flow coverage | 15/15 | 固定五项任务全覆盖；3 场景 + 3 条件完整。 |
| Interaction | 20/20 | 分类、卡片、like/dislike、商品、AI、返回均响应；未覆盖入口 disabled。 |
| Visual hierarchy | 15/15 | 三方向有明确结构差异，主版按发现→解释→商品→AI 排布。 |
| Edge states | 8/10 | Mock 与 AI 限制透明、disabled 入口明确；生产网络/隐私授权失败仍不在固定范围。 |
| Stability | 10/10 | clean Chrome pageerror 与 console 均为 0。 |
| Handoff | 10/10 | 相对 QA、重建脚本、四个自包含 HTML、规格、选择证据齐全。 |

总分：**98/100**。
