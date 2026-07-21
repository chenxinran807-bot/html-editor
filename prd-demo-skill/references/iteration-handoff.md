# 精修闭环（v2 §7）

阶段③：由用户显式发起的标注驱动精修。目标——**改一个元素只动目标、不误伤其他页面**，且改动同步回合同、可回归。三方分工清晰、接力到底：

- **html-editor**：只负责圈选元素、填写批注、导出标注 JSON，**不修改业务原型**（声明式引导，不穿透调用其脚本/MCP）。
- **prd-demo**：解析标注、定位并更新合同、编排回归。
- **宿主模型**：根据更新后的合同**修改原型 HTML/UI 代码**，并执行质量门禁回归。

## 标注产物格式

由 html-editor 在预览页导出的 JSON 必须绑定原生成任务和会话：

```jsonc
{
  "schemaVersion": "1.0",
  "taskId": "9c5ba2e8-9e68-4bcb-82fc-bb47b61cc0ce",
  "sessionId": "f20df784-f5cf-4db1-99bd-f79a1d954f08",
  "prdFingerprint": "sha256:...",
  "annotations": []
}
```

`taskId`、`sessionId` 或 prdFingerprint 与当前生成会话不一致时停止，不得把标注应用到“看起来相似”的 Demo。

每条标注结构：

```jsonc
{
  "annId": "ann-2",
  "targetClauseId": "cl-014",          // 优先带；缺失时由 selector 反查
  "targetNodeSelector": "[data-prd-action=add-cart]",
  "action": "modify",                  // modify | add | remove
  "scope": "target-only",
  "intent": "加购后角标要有数字动画，并把 toast 文案改为“已加入购物车”",
  "newValue": "已加入购物车"            // 可选，具体新值
}
```

## 执行流程（固定顺序）

| 环节 | 执行方 | 定义 |
|---|---|---|
| 1. 解析标注 / 条款定位 | prd-demo | 解析标注 JSON；优先用 `targetClauseId`，无则由 `targetNodeSelector` 反查节点 `data-prd-clause` 得到条款 |
| 2. 更新合同 | prd-demo | 改对应 clause：`version+1`，`changelog` 记一条（annId + 原因） |
| 3. 改 HTML/UI | 宿主模型 | 按新合同改对应 DOM 节点，保持 `data-prd-clause`/`data-prd-asset-id` 回指一致 |
| 4. 回归 | 宿主模型 | 仅对受影响 clause 重跑其 `verify.method`（见 [quality-gates.md](quality-gates.md)）；受保护素材哈希复校 |

分工要点：**prd-demo 解析标注、定位并更新合同、编排回归；宿主模型按新合同改 HTML/UI 并执行门禁**。合同与 HTML 的 version 号同步 +1，二者始终一致。标注缺失或未提交时不回写、也不阻塞已交付产物。

## target-only 保护范围

`scope=target-only` 时只允许修改 `targetClauseId` 指向的条款和它声明的直接依赖。执行前后必须：

1. 记录所有未受影响页面的规范化 HTML 或稳定哈希。
2. 修改目标条款并运行其回归。
3. 再次计算未受影响页面；任何变化都视为误伤并撤销本次修改。
4. 没有 `targetClauseId` 时可以用 selector 反查；反查不唯一就停下询问，不能猜第一个节点。

## html-editor 缺失兜底

- 未安装 html-editor：把安装链接发给用户，一次安装长期复用——
  `https://mira.bytedance.com/app-link/customize?page=skills%2Fdetail&skill_key=html-annotator&type=market&source=market`
- 用户暂不安装时降级为**文本坐标标注**：让用户按"页面 + 区块描述 + 修改意图"逐条口述，模型据此走同样的"改合同→改 HTML→回归"流程，仍回写合同。

## 无合同的既有原型：先 bootstrap

"已有原型直接进③"**仅在其带合同或可 bootstrap 出合同时成立**，否则回到阶段①。

- 原型带 `data-prd-*`：扫描 HTML 的 `data-prd-page/module/clause/field/action/asset-id/state/copy`，**反向生成合同骨架**（clauses 的 clauseId、category、region、assertion 占位 + assets 登记），再据此精修。
- 原型无 `data-prd-*`：无法可靠定位条款，提示用户需先经阶段①/② 补出合同，不强行精修。

## 与职责边界一致

prd-demo 负责解析标注、定位并更新合同、编排回归；**prd-demo 不实现标注 UI，业务原型的 HTML/UI 代码修改由宿主模型执行**。html-editor 负责标注圈选与导出，不修改业务原型；lark-drive 负责云空间读写（见 [figma-task-handoff.md](figma-task-handoff.md)）。
