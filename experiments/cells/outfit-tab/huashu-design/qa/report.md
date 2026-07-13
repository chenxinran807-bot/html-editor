# QA report · Huashu native outfit directions

## 实际执行范围

- QA 脚本使用相对路径解析 `../artifact/index.html`，可通过本地 Chrome CDP 复跑。
- 实际只操作主版第一台手机，路径为：切换「出游」→ 打开理由卡 → 检查适配/公式/避雷 → 打开 Mock 平替 → 打开 AI 试穿入口。
- 该路径的固定 5 项断言通过；记录 `pageerror=0`、console error `=0`。
- 保存了入口、详情、商品、AI 入口及三个方向截图。

## 未验证范围

- 未点击或断言 like/dislike。
- 未验证其余三台手机各自的状态独立性和完整交互。
- 未遍历日常、通勤、出游、小个子、梨形、黄黑皮全部六类。
- 未验证返回导航、搜索响应、disabled tabs/底栏的每个状态。
- AI 仅验证试穿入口，未验证「保留外套继续搭」入口。
- 截图证明三个页面可渲染，但不能证明三方向达到充分结构独立。

## 校准评分

| 维度 | 分数 | 校准依据 |
|---|---:|---|
| Fidelity | 16/20 | 使用冻结真图和自包含 HTML，但仅部分移植 `ios_frame.jsx`，不是完整真实组件使用；部分文案无依据。 |
| Flow coverage | 13/15 | 固定五步主路径存在，但六分类只有三类真实数据，其余 fallback。 |
| Interaction | 17/20 | 主路径可点；like/dislike、四机、返回、全部分类及两个 AI 入口未完整验证。 |
| Visual hierarchy | 11/15 | 有三份方向和主版，但结构共享较多，独立方向不足。 |
| Edge states | 6/10 | disabled 和 Mock 处理部分存在；S–XL 与适配内容未全部标 Mock，失败/隐私态不足。 |
| Stability | 10/10 | 已执行路径 pageerror 与 console error 均为 0。 |
| Handoff | 8/10 | 有构建脚本、相对 QA、截图与报告，但 QA 覆盖和组件来源声明此前过度。 |

总分：**81/100**，状态：**PASS_WITH_CONCERNS**。
