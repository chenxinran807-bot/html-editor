# prd-demo Skill 发布顺序

唯一权威发布页：

`https://skills.bytedance.net/skill/skills:skills.byted.org/AI/Recommend/prd-demo?fromSpaceId=skills.byted.org%2FAI%2FRecommend&fromSpaceName=skills.byted.org%2FAI%2FRecommend`

每次更新必须按以下顺序执行，不得只更新 Mira：

1. 运行 `prd-demo-skill/test/` 全量测试和 Skill 规范校验。
2. 生成 `prd-demo-skill/dist/prd-demo-workflow.zip` 并记录 SHA-256。
3. 在上述 Skills 平台页面点击“发布版本”，上传该 ZIP。
4. 核对平台新版本号、更新时间、`SKILL.md` 和新增文件均已生效。
5. 在 Mira 的 `Skills & Bots → My Skill → prd-demo → Replace` 上传同一 ZIP。
6. 新建 Mira 会话回归；旧会话不用于判断新 Skill 是否生效。

当前已验证平台版本：`1.0.13`（2026-07-23）。

当前待发布包 SHA-256：`9626fc6016ab7b7689c808f960ac5eba742756761a1c1505edb081a7a1c63be3`。
