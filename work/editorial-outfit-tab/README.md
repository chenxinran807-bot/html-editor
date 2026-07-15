# Editorial Outfit Tab 原型

这是抖音商城独立端“穿搭”Tab 的本地可交互编辑内容原型。它覆盖穿搭瀑布流、频道筛选、故事详情、收藏、故事/整套商品双视图、商品勾选与原型购买反馈；不会连接生产接口，也不包含真实购物车、库存、支付、登录或推荐能力。

## 启动

在仓库根目录任选一种方式启动静态服务：

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:8000/work/editorial-outfit-tab/`。也可以直接运行下文的浏览器 QA；脚本会在 `127.0.0.1` 随机端口启动并在结束时关闭自己的静态服务。

## 主要交互路径

1. 在“精选 / 通勤 / 约会 / 周末 / 显高”之间切换频道。
2. 打开任一穿搭卡片，在详情页收藏或取消收藏。
3. 在“穿搭故事 / 整套商品”之间切换。
4. 勾选可售商品；若显示“请选择规格”，先选择演示规格。
5. 点击“购买整套”或“购买已选”，查看 aria-live 原型反馈。
6. 返回信息流，频道选择会保留。

## 原型状态

页面顶部“原型状态”折叠区提供七种本地夹具：正常、加载、空态、错误、图片失败、部分售罄、全部不可售。图片失败夹具会故意请求不存在的本地文件，以验证可访问的替代内容；其 404 是浏览器 QA 中唯一明确过滤的已知无害控制台项。

内容图片均为本目录 `assets/` 下的无品牌 SVG 插画：10 张竖向编辑造型、1 张独立专题图、3 张竖向细节特写、6 张方形商品图。所有 catalog 图片路径均为本地路径；商品图片按品类与标题语义映射。

## Soft open questions

- 哪个生产 API 最终提供商品资料、库存和价格？
- 穿搭 Tab 在生产底部导航中的最终位置和正式图标是什么？

两项问题都只影响生产接入或最终导航视觉，不阻塞这个静态原型。

## 设计语言来源

本原型保留以下 11 个 Markdown 来源。以下路径相对 `<ecommerce-design-language skill root>`；当前环境通过 `${CODEX_HOME:-$HOME/.codex}/skills/ecommerce-design-language` 解析，其他环境应使用其实际安装根目录：

- `assets/design-assets/common/md/全局通用规则.md`
- `assets/design-assets/common/md/设计资产目录和映射.md`
- `assets/design-assets/common/md/token/设计 Token.md`
- `assets/design-assets/common/md/组件/标签栏Tab.md`
- `assets/design-assets/common/md/组件/商品卡.md`
- `assets/design-assets/common/md/组件/按钮.md`
- `assets/design-assets/common/md/组件/货币／价格.md`
- `assets/design-assets/common/md/组件元素/布局.md`
- `assets/design-assets/common/md/组件元素/颜色.md`
- `assets/design-assets/common/md/组件元素/文字.md`
- `assets/design-assets/common/md/组件元素/圆角.md`

## 验证

2026-07-15 本地真实结果：

```sh
node --test qa/editorial-outfit-state.test.mjs qa/editorial-outfit-static.test.mjs
# PASS：31/31

CODEX_WORKSPACE_NODE_MODULES="${CODEX_WORKSPACE_NODE_MODULES:-$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules}" node qa/editorial-outfit-browser.mjs
# PASS：390x844 与 320x720；输出 4 张截图

node "${CODEX_HOME:-$HOME/.codex}/skills/ecommerce-design-language/scripts/validate-assets.js" work/editorial-outfit-tab
# PASS：Asset validation passed（上游正式资产仍报告 34 条既有 paired-html warning）

git diff --check
```

浏览器证据位于 `qa/evidence/editorial-outfit/`：`feed-390.png`、`story-390.png`、`products-390.png`、`feed-320.png`。
