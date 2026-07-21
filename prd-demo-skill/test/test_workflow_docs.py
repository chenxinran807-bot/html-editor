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
            "3–5 行",
            "html-editor",
            "consumption/{sessionId}.json",
        ]
        positions = [text.index(value) for value in ordered]
        self.assertEqual(positions, sorted(positions))

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
