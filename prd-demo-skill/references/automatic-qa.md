# 自动三层 QA

仅在完整原型生成后读取。QA 在后台执行，不把工具面板或长报告塞进原型页面。

## 固定比较条件

使用同一视口、同一页面、同一状态、同一滚动位置；等待字体和图片稳定，暂停动画，隐藏 html-editor，按 `flow.json` 的绑定区域裁切后比较。

完整原型生成前先对计划使用的浏览器执行一次快速探测：

```bash
python3 scripts/prototype_pipeline.py check-browser \
  --executable <已有 Chromium/Chrome 可执行文件>
```

优先使用 Agent 已提供的浏览器控制能力；只有要在 shell 内启动浏览器时才运行以上命令。探测失败后立即把 QA 标为 `blocked` 并报告运行环境原因，**不得临时安装** Chromium、Playwright、系统库或其他依赖，也不得连续尝试多个浏览器变体。`jsdom`、静态 DOM、Schema 与代码检查可以作为辅助诊断，但不能代替真实浏览器截图和交互证据，不能据此把 QA 标为通过。

必须真实渲染完整原型并保存实现截图，再与当前节点 `visualBindings` 绑定的参考图或已选视觉方案比较。用户确认视觉方向时，立即记录参考图 SHA-256 与对应用户消息 ID；此后参考图视为冻结。发现参考图自身有问题时必须重新请用户确认，禁止覆盖参考图、重生成参考图或用实现截图反向生成参考图来通过 QA。

不得用 DOM 结构检查、代码检查或“肉眼看起来一致”的文字自述代替截图证据。把环境与每组比较写入 `qa/qa-result.json`：

```json
{
  "schemaVersion": "1.0",
  "environment": {
    "viewport": {"width": 390, "height": 844},
    "page": "home",
    "state": "default",
    "scroll": {"x": 0, "y": 0},
    "fontsReady": true,
    "imagesReady": true,
    "animationsPaused": true,
    "editorHidden": true
  },
  "comparisons": [{
    "target": "home-shell",
    "reference": "visual-options/A.png",
    "referenceSha256": "当前参考图的 64 位 SHA-256",
    "confirmedReferenceSha256": "用户确认时记录的同一 SHA-256",
    "confirmedByUserMessageId": "msg-visual-a",
    "actualScreenshot": "qa/evidence/home.png",
    "method": "rendered-screenshot"
  }],
  "postInjection": {
    "editorInjected": true,
    "interactionRetested": true,
    "coreActionsPassed": true,
    "evidenceScreenshot": "qa/evidence/post-injection.png"
  },
  "findings": []
}
```

写完后必须调用 `validate_qa_report`；门禁失败时不得声称视觉 QA 已通过。html-editor 注入完成后，必须在标注工具可见的真实交付状态重新执行核心交互；不得只复跑 Schema、DOM 或依赖检查。

## 三层检查

- `visual-fidelity`：字体、间距、颜色、图标、尺寸和绑定视觉基准。
- `requirements-fidelity`：PRD 条款、内容和状态是否忠实；PRD 明确替换设计文案时不得误判。
- `interaction-flow`：进入、操作、成功/失败、返回与分支是否可完成。

每条 finding 必须包含：`target`、`reference`、`layer`、`severity`、`issue`、`expected`、`actual`、`action`。证据写入 `qa/qa-result.json`。

## 严重程度

- P0：页面结构、核心流程或关键需求错误，阻断。
- P1：明显破坏视觉基准或设计语言，阻断。
- P2：局部视觉差异，原则上修复。
- P3：主观优化建议，不阻断。

严重程度按对用户任务和绑定基准的影响判断，不按像素差异大小判断。

## 修复与停止

每轮先汇总再批量修复，不逐条来回改。**最多 3 轮**；问题签名重复或一轮后无改善时提前停止。第三轮后仍有 P0/P1，状态为 `blocked` 并向用户报告；只有 P2/P3 时允许带备注交付。

默认只保存 `qa/qa-result.json`，**不默认生成** `qa/design-qa.md`。仅用户要求人读摘要时再生成。
