# Huashu camera experiment · Run Log

## Runtime 与隔离策略

- Runtime：Codex，按 Huashu weak-runtime fallback 串行执行，不声称使用了 subagent。
- 三轮均只读取共同 `design-spec.md` 与 PRD 原始素材；每轮先确定独立 anchor，再生成一个独立、自包含 HTML。
- 每个 HTML 都内嵌固定版本 React 18.2.0、ReactDOM 18.2.0、Babel 7.24.7、PRD 图片 Base64，以及官方 `assets/ios_frame.jsx` 完整源代码。
- 三份文件不互相引用，不共享运行时状态、组件或 CSS；`design-demos/` 下文件数应为 3。

## 串行三轮

1. A · 系统底部动作
   - Anchor：iOS action sheet。
   - 隔离结构：左侧纵向屏幕概览 + 右侧设备；来源选择使用底部浮层。
   - 选择理由：最贴近 PRD，作为最终关键路径验证方向。
2. B · 拍摄教练
   - Anchor：健康类相机的拍摄前指导。
   - 隔离结构：顶部横向旅程 + 右侧设备；先完成三项准备，取景器内显示实时教练卡。
   - 选择理由：直接回应「用户难以感知清晰度/正脸要求」。
3. C · 任务轨道
   - Anchor：线下 kiosk 阶段任务。
   - 隔离结构：左侧阶段轨道 + 中间设备 + 右侧解释；首屏直接二分拍照/相册，不使用浮层。
   - 选择理由：回应 PRD 的线下市场演示场景。

## 方向选择

- 选中 A 作为 fixed-task 主验证方向，因为它与 PRD 交互描述最一致，降低把探索性设计误当成确定需求的风险。
- B、C 作为可见且可运行的探索方向，各自执行关键路径，不宣称已获得用户最终选择。

## 验证命令

```sh
node experiments/cells/camera-upload/huashu-design/run/qa-cdp.mjs
```

该脚本通过 Chrome DevTools Protocol 在页面外监听 `Runtime.consoleAPICalled` 与 `Runtime.exceptionThrown`，而不是读取页面内硬编码数组；逐方向点击并由 `Page.captureScreenshot` 保存截图。

Chrome stderr 中可能出现 macOS `task_policy_set`、语音能力注册、GCM deprecated endpoint 等浏览器环境噪声。它们与页面 console/pageerror 分开保存，不被当作页面通过证据；页面错误判定只使用 CDP 事件监听结果。
