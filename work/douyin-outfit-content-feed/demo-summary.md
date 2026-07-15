# 穿搭内容流原型交付说明

原型覆盖“按场景、适合我、博主推荐”三个平行频道，以及真人穿搭、主题合集、商品搭配三类详情。频道、筛选与滚动位置会在详情返回后恢复。

状态菜单可切换加载、空内容、加载失败、图片失败和正常内容；清除筛选、重新加载、不感兴趣撤销等恢复路径均可操作。喜欢、收藏、关注和查看搭配单品仅改变本地演示状态，不产生真实交易或推荐效果。

右下角“编辑原型”进入编辑模式。选择带虚线框的元素后，可修改文字、颜色、本地图片、显隐、禁用和预览跳转；支持撤销、重做、浏览器本地持久化、修改 JSON 导出及元素级 Agent 评论导出。切回预览后编辑控件隐藏且不可操作，页面恢复正常浏览交互。

边界：无真实商品、库存、价格、登录、交易、作者或推荐服务；素材均为本地抽象 SVG。

## Task 6 最终 QA（2026-07-15）

结论：`DONE`。首次截图审查发现隐藏的 `#status` 仍参与布局并产生约 1600px 异常空白；产品修复 `90bc2614d73d9d1e9adfee04a524ecb4a9be3fea` 增加 `.status[hidden] { display:none }` 后，已重新执行全量浏览器验收、替换全部截图并人工复核。异常空白在两个视口均已消失，视觉门禁通过。

浏览器验收：使用仓库外的 bundled Playwright，从 `index.html` 入口 UI 在 390×844 与 320×700 两个视口分别独立执行完整交互套件。最终结果为 `114 browser checks passed`、退出码 0；两个视口均验证 `#status` 隐藏、计算样式为 `display:none` 且布局高度为 0。每个视口都覆盖三个频道及其全部筛选、三类卡片详情与返回上下文、喜欢/收藏/关注/不感兴趣/撤销、状态菜单的加载/空/失败/图片失败/正常及清除筛选和重试、按卡片类型保持图片失败占比、编辑标题/应用/撤销/预览隐藏且 inert、快速切换 latest-wins、加载中打开详情不被覆盖，以及横向溢出、固定栏空间、图片 natural dimensions、页面错误和控制台错误。

Task 1–5 自动测试：`node --test qa/outfit-content-feed-state.test.mjs qa/outfit-content-feed-contract.test.mjs`，31/31 通过，0 失败，退出码 0。

已安装 Skill 门禁（`/Users/bytedance/.codex/skills/prd-to-editable-demo`）：

- `npm test`：152/152 通过，0 失败，退出码 0。
- `npm run benchmark`：顶层 `passed: true`，7/7 用例 `passed: true`，退出码 0。
- `npm run smoke`：受限沙箱首次退出码 1，精确环境错误为 `EPERM: operation not permitted, mkdir '/Users/bytedance/.codex/work'`；授权 Skill 写入其预期输出目录后原命令复跑退出码 0，产物为 `/Users/bytedance/.codex/work/prd-to-editable-demo-smoke/index.html`。最终门禁通过，但保留首次环境失败记录。

截图证据：

- `qa/evidence/outfit-content-feed/feed-390x844.png`
- `qa/evidence/outfit-content-feed/detail-390x844.png`
- `qa/evidence/outfit-content-feed/feed-320x700.png`
- `qa/evidence/outfit-content-feed/detail-320x700.png`

视觉审查：修复后截图中频道、筛选、主题头图、灵感合集、推荐卡片连续呈现，无异常空白；信息层级清楚，双列密度、留白节奏和内容露出符合移动内容流。图标、44px 触控目标、固定底部导航、卡片与详情表达接近原生移动电商；390px 与 320px 视口均具备可评审的层级、密度和原生感，视觉门禁通过。
