# Shell: standard

白底 ConsoleLayout 内容壳——通用控制台风格，scaffold 的默认 shell。

## 适用场景

单页 / 配置工具 / 营销 / 简单交互。当意图检测**未**命中 ga/iga/dcdn 等复杂云控制台关键词时使用。

## 覆盖文件（叠加到 scaffold 基础上）

```text
src/
├── pages/HomePage.tsx              # 用 ConsoleLayout 包裹（覆盖基础占位 HomePage）
└── layouts/
    ├── ConsoleLayout.tsx           # 内容壳：pageTitle/breadcrumbs/pageActions/headerToolbar/headerExtra
    └── ConsoleSidebar.tsx          # selectedKeys + collapse 受控
```

## 壳层特征

- 背景：白底 `#fff`，内容区 padding `24px 32px`
- 布局：`ConsoleLayout` 内容壳（标题 + 工具行 + 页面 Tab）
- Sidebar：`selectedKeys` + `collapse` 受控
- 路由：单页为主，页面层按 ui-spec 传 `menus` prop

详见 `references/console-layout.md`。
