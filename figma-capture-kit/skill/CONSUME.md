# Skill 消费约定：先还原，再设计

每次采集生成一张 PNG 和一个同名 `.manifest.json`。Skill 必须把二者一起读取，不能只把 PNG 当作普通参考图。

## 输入目录

```text
~/Downloads/figma_export/incoming/
├─ <file-key>-<node-id>.png
└─ <file-key>-<node-id>.manifest.json
```

manifest 包含来源 URL、Figma file key、真实 node ID、图片尺寸、采集时间、用途、保真等级和可编辑区域。`exporter=chrome-extension/copy-as-png` 表示图片来自 Figma 自带的 Copy as PNG，不是浏览器截图。

## 消费顺序

1. 读取全部 manifest，建立 PNG → nodeId / role / fidelity 映射。
2. 先识别基础框架：状态栏、导航、页面宽度、栅格、背景、公共组件和底部栏。
3. 对 `fidelity=strict` 且不在 `editableRegions` 的区域做锁定还原。
4. 只在 `editableRegions` 或明确需求指定的业务区域内新增设计。
5. 优先复用输入里已有的图标、文字样式、组件形态和商城设计语言；缺失素材要标注，不凭空仿造品牌图标。
6. 生成后截图，与参考 PNG 做视觉回归，重点比较骨架、间距、字号层级、颜色和公共组件。

## 核心原则

输入不是“灵感图”，而是生成任务的边界和证据：**先还原已有设计的基础框架，再在框架内做业务设计。** 只有文字 Prompt、没有对应设计输入时，不应承诺像素级一致。
