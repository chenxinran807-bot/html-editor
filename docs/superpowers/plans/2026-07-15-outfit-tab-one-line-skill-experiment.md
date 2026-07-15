# 穿搭 Tab 单句输入 Skill 横向实验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用同一句自然语言真实运行市场调研表中的 10 个原型 Skill，验证产物并以截图和可点击链接回填飞书表格。

**Architecture:** 在 `experiments/one-line-outfit-tab/` 下建立互相隔离的实验单元，统一结果契约只规范证据与状态，不规范各 Skill 的技术栈或产物。原生托管链接优先，本地 HTML 通过同一个静态展示项目发布；最终看板和飞书表格只聚合经过浏览器验证的真实证据。

**Tech Stack:** 各 Skill 原生 CLI/工作流、Node.js、HTML/CSS/JavaScript、Playwright、静态托管、Lark CLI。

---

## 文件结构

- `experiments/one-line-outfit-tab/manifest.json`：固定输入、10 个实验对象、终态和结果路径。
- `experiments/one-line-outfit-tab/contracts/result.schema.json`：统一结果契约。
- `experiments/one-line-outfit-tab/cells/<skill-id>/input.txt`：每个单元唯一允许的业务输入。
- `experiments/one-line-outfit-tab/cells/<skill-id>/run/`：原生执行记录、问题、错误和偏离项。
- `experiments/one-line-outfit-tab/cells/<skill-id>/artifact/`：该 Skill 的原生产物。
- `experiments/one-line-outfit-tab/cells/<skill-id>/qa/`：截图、浏览器日志和交互验证。
- `experiments/one-line-outfit-tab/cells/<skill-id>/result.json`：终态、截图、链接和原因。
- `scripts/one-line-experiment/init.mjs`：创建并校验 10 个隔离单元。
- `scripts/one-line-experiment/validate.mjs`：校验结果契约、固定输入和证据文件。
- `scripts/one-line-experiment/build-gallery.mjs`：从结果生成静态对比页。
- `comparison/one-line-outfit-tab/`：统一托管目录及对比看板。
- `docs/superpowers/specs/2026-07-15-outfit-tab-one-line-skill-experiment-design.md`：已批准设计。

### Task 1: 建立固定输入和实验契约

**Files:**
- Create: `experiments/one-line-outfit-tab/manifest.json`
- Create: `experiments/one-line-outfit-tab/contracts/result.schema.json`
- Create: `scripts/one-line-experiment/init.mjs`
- Create: `scripts/one-line-experiment/validate.mjs`
- Test: `qa/one-line-experiment-contract.test.mjs`

- [ ] **Step 1: 写契约测试**

测试必须断言 10 个 `input.txt` 的 UTF-8 内容逐字等于固定句子，并要求每个 `result.json` 包含 `skillId`、`status`、`screenshot`、`demoUrl`、`reason`、`interactionVerified` 和 `nativeOutputType`；成功项必须有截图、URL 和 `interactionVerified: true`，非成功项必须有截图和非空原因。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test qa/one-line-experiment-contract.test.mjs`

Expected: FAIL，因为清单、初始化器和校验器尚不存在。

- [ ] **Step 3: 实现最小清单、Schema、初始化器和校验器**

清单中的 Skill ID 固定为：`prd-to-editable-demo-v020`、`figma-flow-to-html-demo`、`traemi-business-to-demo`、`ecommerce-design-language`、`inspire-prototype`、`prototype-builder`、`prd-generator`、`pm-kakaxi-skills`、`aime-prototype`、`huashu-design`；终态仅允许 `PASS`、`NEEDS_INPUT`、`NOT_APPLICABLE`、`BLOCKED`。

- [ ] **Step 4: 初始化并验证**

Run: `node scripts/one-line-experiment/init.mjs && node --test qa/one-line-experiment-contract.test.mjs`

Expected: 10 个隔离单元存在，固定输入哈希一致，契约测试 PASS。

- [ ] **Step 5: 提交**

Run: `git add experiments/one-line-outfit-tab scripts/one-line-experiment qa/one-line-experiment-contract.test.mjs && git commit -m "test: add one-line prototype experiment harness"`

### Task 2: 运行输入门槛明确的 4 个实验

**Files:**
- Modify: `experiments/one-line-outfit-tab/cells/figma-flow-to-html-demo/**`
- Modify: `experiments/one-line-outfit-tab/cells/traemi-business-to-demo/**`
- Modify: `experiments/one-line-outfit-tab/cells/ecommerce-design-language/**`
- Modify: `experiments/one-line-outfit-tab/cells/aime-prototype/**`

- [ ] **Step 1: 完整读取四项已安装说明或安装包正文**

分别读取 `figma-flow-to-html-demo`、`skill-downloads/traemi.md`、`ecommerce-design-language` 以及 Aime 安装包的完整入口规则；记录版本、前置条件和真实调用入口，不从表格简介推测能力。

- [ ] **Step 2: 严格提交固定输入**

每项只提交对应 `input.txt`，不提供流程图、页面清单、设计资产或补充回答；把澄清问题、缺失输入或真实阻断原样写入 `run/native-run.md`。

- [ ] **Step 3: 为每项生成真实终态证据**

成功时保留原生产物；要求额外输入时制作仅包含真实状态和原因的证据页并截图，状态使用 `NEEDS_INPUT`；无法访问运行入口时使用 `BLOCKED`，不得转用其他 Skill。

- [ ] **Step 4: 校验四项结果**

Run: `node scripts/one-line-experiment/validate.mjs figma-flow-to-html-demo traemi-business-to-demo ecommerce-design-language aime-prototype`

Expected: 四项均有明确终态、截图和可核查运行记录。

### Task 3: 运行 6 个可直接生成原型的实验

**Files:**
- Modify: `experiments/one-line-outfit-tab/cells/prd-to-editable-demo-v020/**`
- Modify: `experiments/one-line-outfit-tab/cells/inspire-prototype/**`
- Modify: `experiments/one-line-outfit-tab/cells/prototype-builder/**`
- Modify: `experiments/one-line-outfit-tab/cells/prd-generator/**`
- Modify: `experiments/one-line-outfit-tab/cells/pm-kakaxi-skills/**`
- Modify: `experiments/one-line-outfit-tab/cells/huashu-design/**`

- [ ] **Step 1: 逐项完整读取原生 Skill 及其路由引用**

每项执行前读取完整 `SKILL.md`；仅继续读取该固定输入实际触发的引用文件。若 Skill 有设计确认硬门禁，将固定句之外无法回答的问题记录为 `NEEDS_INPUT`，不替用户补充偏好。

- [ ] **Step 2: 从干净单元执行固定输入**

每个 Skill 只能访问自身单元、自己的 Skill 资源和通用运行依赖；禁止读取其他单元的 HTML、截图、设计决策或运行记录。

- [ ] **Step 3: 保留原生产物和原生链接**

平台型产物记录真实资产 ID 与预览 URL；本地型产物原样保存在 `artifact/`，不重写视觉、交互或文案。

- [ ] **Step 4: 浏览器验证**

每个成功项以移动端 viewport 打开入口，至少点击一个可见核心控件并确认可见反馈，记录页面错误与控制台阻断错误，然后保存代表截图。

- [ ] **Step 5: 校验六项结果**

Run: `node scripts/one-line-experiment/validate.mjs prd-to-editable-demo-v020 inspire-prototype prototype-builder prd-generator pm-kakaxi-skills huashu-design`

Expected: 六项均有明确终态；成功项具有实际截图、可运行入口和交互验证记录。

### Task 4: 构建并发布统一对比页

**Files:**
- Create: `scripts/one-line-experiment/build-gallery.mjs`
- Create: `comparison/one-line-outfit-tab/index.html`
- Create: `comparison/one-line-outfit-tab/data.json`
- Create: `comparison/one-line-outfit-tab/demos/<skill-id>/**`
- Test: `qa/one-line-gallery.test.mjs`

- [ ] **Step 1: 写失败测试**

测试必须检查 10 张结果卡、成功项截图、失败原因、所有本地 Demo 相对入口和外部原生 URL 都存在，且看板不把失败项展示为成功。

- [ ] **Step 2: 构建最小对比页**

构建器只复制本地原生产物和读取 `result.json`；不得修改 Demo 文件。看板按 Skill 表格顺序展示状态、截图、“查看可交互 Demo”或“未生成 Demo”。

- [ ] **Step 3: 本地验证链接**

Run: `node scripts/one-line-experiment/build-gallery.mjs && node --test qa/one-line-gallery.test.mjs`

Expected: PASS，全部本地相对链接可解析，全部远程 URL 合法。

- [ ] **Step 4: 发布静态内容**

优先使用当前环境已授权的静态托管能力；发布后逐项打开线上 URL。托管只复制字节，不执行格式化或构建重写；平台原生 URL 保持不变。

- [ ] **Step 5: 记录公开入口**

将线上对比页和各本地 Demo 的最终 URL 写回对应 `result.json`，再次运行全部校验。

### Task 5: 回填飞书“生成demo：穿搭tab”列

**Files:**
- Modify external document: `https://bytedance.larkoffice.com/wiki/Krcbwrgkdiuz8jk6LmecyLC7n9b`

- [ ] **Step 1: 读取飞书编辑规范和目标表格最新 revision**

读取 `lark-doc` 的 shared、XML、style、update 和 update-workflow 指南，再以 `full` 模式读取目标表格；确认 10 个目标单元格的当前 block ID。

- [ ] **Step 2: 逐项插入代表截图和链接**

成功项写入截图及“查看可交互 Demo”链接；非成功项写入状态截图及一句话原因。只替换“生成demo：穿搭tab”单元格内的空段落或已有实验内容，不触碰其他列。

- [ ] **Step 3: 回读验证**

重新读取整张表，核对 10 项均已填充，所有链接目标与 `result.json` 一致，原有 Skill 来源、安装附件和 v0.2.0 已有图片均保留。

- [ ] **Step 4: 提交本地实验记录**

Run: `git add experiments/one-line-outfit-tab comparison/one-line-outfit-tab scripts/one-line-experiment qa && git commit -m "test: publish one-line outfit tab skill comparison"`

Expected: 本地证据可复现，飞书表格 revision 增加且目标列完整。

### Task 6: 最终核验与交付

- [ ] **Step 1: 运行全部契约和看板测试**

Run: `node --test qa/one-line-experiment-contract.test.mjs qa/one-line-gallery.test.mjs && node scripts/one-line-experiment/validate.mjs`

Expected: 全部 PASS，10 个实验都有终态。

- [ ] **Step 2: 人工浏览器抽查**

打开对比页，并抽查每个成功 Demo 的首屏与一个核心交互；确认截图对应实际页面。

- [ ] **Step 3: 交付**

向用户提供飞书表格链接、可视化对比页链接、成功/未生成数量和最关键的实验限制，不用 Skill 宣称替代真实运行结果。
