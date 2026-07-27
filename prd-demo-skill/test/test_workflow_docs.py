import pathlib
import re
import unittest


ROOT = pathlib.Path(__file__).parents[1]


class WorkflowDocsTest(unittest.TestCase):
    def read(self, relative):
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_stale_handoff_rules_are_absent(self):
        text = self.read("references/figma-task-handoff.md")
        for stale in (
            "{userId}__{taskId}",
            "回写 `consumedAt`",
            "按 `createdAt`",
            "status=completed",
            "AIME_CURRENT_USER",
        ):
            self.assertNotIn(stale, text)

    def test_main_skill_contains_the_fixed_workflow_order(self):
        text = self.read("SKILL.md")
        ordered = [
            "_COMPLETE.json.completedAt",
            "ownerOpenId",
            "pageScope",
            "primaryFlow",
            "frameBindings",
            "### 4. 确定视觉方向",
            "### 5. 生成并确认用户动线图",
            "3–5 行",
            "### 7. 自动执行三层 QA",
            "### 8. 自动注入标注层",
            "consumption/{sessionId}.json",
        ]
        positions = [text.index(value) for value in ordered]
        self.assertEqual(positions, sorted(positions))

    def test_visual_exploration_is_conditional_and_exactly_three(self):
        text = self.read("references/visual-exploration.md")
        self.assertIn("明确视觉目标", text)
        self.assertIn("不得强制探索", text)
        self.assertIn("恰好 3 个", text)
        self.assertIn("全部校验通过", text)
        self.assertIn("不得凭声明尺寸", text)
        self.assertIn("validate-visual", text)

    def test_flow_is_single_confirmation_surface_with_embedded_bindings(self):
        text = self.read("references/flow-confirmation.md")
        for required in (
            "flow.json",
            "visualBindings",
            "不得另建",
            "确认前不得生成完整原型",
            "visual-flow",
            "flow/flow.html",
            "不得只展示表格",
            "confirmationEvents",
            "一条用户消息只能确认一个节点",
            "confirm-flow",
            "validate-flow",
            "nextNode",
        ):
            self.assertIn(required, text)

    def test_qa_is_three_layered_bounded_and_hidden_from_default_ui(self):
        text = self.read("references/automatic-qa.md")
        for required in (
            "visual-fidelity",
            "requirements-fidelity",
            "interaction-flow",
            "最多 3 轮",
            "P0",
            "P1",
            "qa/qa-result.json",
            "不默认生成",
            "check-browser",
            "不得临时安装",
            "jsdom",
        ):
            self.assertIn(required, text)

    def test_user_facing_messages_hide_internal_implementation_names(self):
        text = self.read("SKILL.md")
        for required in (
            "对用户隐藏内部实现",
            "不得展示脚本名",
            "不得展示命令名",
            "不得展示内部状态键",
            "只说用户正在确认什么、系统正在完成什么、下一步需要什么",
        ):
            self.assertIn(required, text)

    def test_confirmation_phase_cannot_preflight_later_qa_runtime(self):
        text = self.read("SKILL.md")
        for required in (
            "确认阶段禁止提前准备后续环节",
            "不得检查浏览器",
            "不得探测 QA 环境",
            "不得读取生成、验收或标注阶段的实现文件",
            "先提出当前唯一需要用户确认的问题",
        ):
            self.assertIn(required, text)

    def test_missing_visual_target_cannot_offer_to_skip_exploration(self):
        text = self.read("SKILL.md")
        for required in (
            "没有明确视觉目标时不得提供跳过三个视觉方向的选项",
            "只确认三个方向采用哪一个或如何组合",
        ):
            self.assertIn(required, text)

    def test_browser_probe_is_single_attempt_and_cannot_search_for_variants(self):
        text = self.read("SKILL.md")
        for required in (
            "浏览器探测只允许一次",
            "不得继续寻找其他 Chromium",
            "不得尝试 LD_LIBRARY_PATH",
            "不得搜索已有系统库",
            "立即停止验收并报告环境不可用",
        ):
            self.assertIn(required, text)

    def test_three_core_questions_are_always_confirmed_one_at_a_time(self):
        text = self.read("references/clarification.md")
        for key in ("pageScope", "primaryFlow", "frameBindings"):
            self.assertIn(key, text)
        self.assertIn("一次只问一个", text)
        self.assertIn("不可跳过", text)
        self.assertNotIn("已在材料中写清的不问", text)

    def test_handoff_uses_root_marker_and_immutable_receipt(self):
        text = self.read("references/figma-task-handoff.md")
        for required in (
            "/prd-demo-tasks/{taskId}/",
            "_PRD_DEMO_ROOT.json",
            "_COMPLETE.json",
            "completedAt",
            "ownerOpenId",
            "manifestSha256",
            "consumption/{sessionId}.json",
            "不得修改 `task.json`",
        ):
            self.assertIn(required, text)

    def test_cross_agent_degradation_is_explicit(self):
        text = self.read("references/unified-workflow.md")
        self.assertIn("完整自动模式", text)
        self.assertIn("任务文件夹链接", text)
        self.assertIn("本地 ZIP", text)
        self.assertIn("不得声称已经自动读取", text)

    def test_annotation_reentry_is_bound_and_scope_protected(self):
        text = self.read("references/iteration-handoff.md")
        for required in (
            "taskId",
            "sessionId",
            "targetClauseId",
            "target-only",
            "未受影响页面",
        ):
            self.assertIn(required, text)

    def test_frontmatter_has_only_name_and_description(self):
        text = self.read("SKILL.md")
        match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
        self.assertIsNotNone(match)
        top_level_keys = re.findall(r"^([a-zA-Z][a-zA-Z0-9_-]*):", match.group(1), re.MULTILINE)
        self.assertEqual(["name", "description"], top_level_keys)


if __name__ == "__main__":
    unittest.main()
