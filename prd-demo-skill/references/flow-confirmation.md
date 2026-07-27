# 用户动线确认

完整原型前只保留一个“用户动线图”确认面，不再另做页面故事板。

## `flow.json`

```json
{
  "schemaVersion": "1.0",
  "presentation": {
    "type": "visual-flow",
    "artifact": "flow/flow.html",
    "layout": "left-to-right"
  },
  "nodes": [{
    "id": "home",
    "title": "首页",
    "thumbnail": "flow/home.png",
    "prdClauses": ["PRD-1"],
    "confirmation": "pending",
    "visualBindings": [{
      "target": "page-shell",
      "reference": "references/home.png",
      "mode": "strict"
    }]
  }],
  "edges": [{"from": "home", "action": "点击商品", "to": "detail"}],
  "confirmationEvents": []
}
```

- 生成并展示 `flow/flow.html`（或同等可打开的 PNG），把页面、关键状态、分支、进入/返回路径放入同一张横向可视化动线；**不得只展示表格或文字清单**。
- 把页面/区域/组件对应的 `visualBindings` 直接放进节点；**不得另建** `visual-bindings.json`。
- 每次只让用户确认当前最关键的一个节点或分支。收到确认后只执行一次轻量命令：

  ```bash
  python3 scripts/prototype_pipeline.py confirm-flow flow.json \
    --node <nodeId> --message-id <userMessageId>
  ```

  命令会原子写入一个 `confirmationEvents` 事件，并在标准输出的 `nextNode` 返回下一待确认节点。直接用这份结果组织下一条确认消息；**不得重新读完整 Skill、不得手工编辑 `flow.json`、不得额外调用通用文件写入工具**。
- **一条用户消息只能确认一个节点**。即使用户说“全部确认”或 Agent 处于验收模式，也不得循环确认剩余节点；必须逐个展示、逐个等待确认。
- 所有纳入 `pageScope` 的节点**确认前不得生成完整原型**。
- 最后一个节点确认后只执行：

  ```bash
  python3 scripts/prototype_pipeline.py validate-flow flow.json
  ```

  输出 `OK` 后才可生成完整原型；不要再通过 Python import 绕行调用 `validate_flow`。
- 展示动线时保存真实可重新打开的 URL。最终交付前把它与原型 URL 写入 delivery 对象并调用 `validate_delivery`；`flowUrl` 缺失、为 `#` 或不可解析时必须重新上传，不能交付占位链接。
