# 给 Skill 同事的交接说明

Chrome 扩展从 1.2.0 起输出统一协议；当前版本为 1.2.2。1.2.1 起默认使用手动采集，升级后会关闭此前保存的连续采集状态，用户仍可主动开启连续采集；1.2.2 起会轮询等待复杂 Frame 完成 PNG 渲染，并拒绝上一轮残留的旧 PNG。扩展不再生产顶层 `captureMethod/file/dimensions/source.nodeId` 的扁平结构，而是输出统一 Figma Capture Manifest：`exporter.type="chrome-extension"`、`exporter.version` 取扩展运行时版本、`exporter.capabilities=["frame-png"]`；当前 Frame 写入 `pages[0]`，其中包含 `nodeId/png/width/height/scale/role/fidelity`；顶层固定输出 `assets=[]`、`tokens={}` 和 `constraints`。Chrome 通道没有 Token、SVG 和图层元数据能力，请勿从空字段推断为“原设计没有”，而应根据 capabilities 判定为“未采集/未知”。

请在 Skill 消费端实现双结构形状探测：存在 `exporter` 且 `pages` 时按统一协议解析；不存在 `exporter`、但存在顶层 `captureMethod` 时按 1.1.4 legacy 扁平结构只读兼容。素材路径统一以 manifest 文件所在目录为基准解析，例如 `resolve(dirname(manifestPath), pages[0].png)`。不要改动现有 PRD、普通截图和其他输入流程。

接入时请落实以下能力降级：有 `frame-png` 才能把 PNG 作为页面骨架与视觉基准；缺少 `svg-assets` 时不得声称获得了正式图标；缺少 `tokens` 时必须标记 Token 未知，不能补成原设计值；只有 `source=variable/style` 的 Token 才能进入设计合同 locked，`source=observed` 只能作为观测参考。`constraints.prohibited` 应写入生成守则，提供的 SVG/PNG 素材必须直接引用，不得重画。

联调基准位于 `samples/chrome-readonly.manifest.json`。请同时使用完整能力、只读 PNG、PNG+SVG 无 Token 三类 fixture 回归，并验证旧扁平 manifest 仍可读取。Chrome 1.2.0 的自动/手动采集、剪贴板和时间戳去重逻辑没有改动；协议迁移单元测试已覆盖输出形状、能力声明、页面绑定和 legacy 字段不再生产。
