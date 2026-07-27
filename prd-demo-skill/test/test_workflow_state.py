import json
import pathlib
import re
import sys
import tempfile
import unittest


ROOT = pathlib.Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from workflow_state import (  # noqa: E402
    Conflict,
    WorkflowState,
    build_receipt,
    fingerprint_prd,
    new_session_id,
)


class WorkflowStateTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temporary.name)

    def tearDown(self):
        self.temporary.cleanup()

    def new_state(self):
        return WorkflowState.create("session-1", "task-1", fingerprint_prd("PRD A"))

    def fully_confirmed_state(self):
        state = self.new_state()
        state.confirm("pageScope", ["home"])
        state.confirm("primaryFlow", "home > detail")
        state.confirm(
            "frameBindings",
            [{"nodeId": "71:4909", "usage": "strict"}],
        )
        return state

    def ready_to_generate_state(self):
        state = self.fully_confirmed_state()
        state.confirm_visual_direction("reference-led", {"reference": "home.png"})
        state.confirm_flow(
            {
                "schemaVersion": "1.0",
                "presentation": {
                    "type": "visual-flow",
                    "artifact": "flow/flow.html",
                    "layout": "left-to-right",
                },
                "nodes": [
                    {
                        "id": "home",
                        "title": "首页",
                        "thumbnail": "flow/home.png",
                        "confirmation": "confirmed",
                        "visualBindings": [
                            {"target": "page-shell", "reference": "home.png"}
                        ],
                    }
                ],
                "edges": [],
                "confirmationEvents": [
                    {"nodeId": "home", "userMessageId": "message-1"}
                ],
            }
        )
        return state

    def test_prd_fingerprint_is_stable_across_line_endings_and_trailing_space(self):
        windows = "标题\r\n正文  \r\n"
        unix = "标题\n正文\n"
        self.assertEqual(fingerprint_prd(windows), fingerprint_prd(unix))
        self.assertRegex(fingerprint_prd(unix), r"^sha256:[0-9a-f]{64}$")

    def test_session_id_is_uuid_v4(self):
        self.assertRegex(
            new_session_id(),
            r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
        )

    def test_fake_prd_fingerprint_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "prdFingerprint"):
            WorkflowState.create("session-1", "task-1", "sha256:prd-a")
        state = self.new_state()
        with self.assertRaisesRegex(ValueError, "prdFingerprint"):
            state.change_prd("sha256:prd-b", affected=["primaryFlow"])

    def test_questions_are_sequential_and_resume_from_disk(self):
        state = self.new_state()
        self.assertEqual("pageScope", state.next_question())
        state.confirm("pageScope", ["home", "detail"])
        state.confirm("primaryFlow", "home > detail")
        loaded = WorkflowState.load(state.save(self.root))
        self.assertEqual("frameBindings", loaded.next_question())
        self.assertEqual("confirming", loaded.phase)

    def test_three_core_questions_cannot_be_skipped(self):
        state = self.new_state()
        with self.assertRaisesRegex(ValueError, "pageScope"):
            state.confirm("primaryFlow", "home > detail")

    def test_conflicting_answer_requires_explicit_replace(self):
        state = self.new_state()
        state.confirm("pageScope", ["home"])
        with self.assertRaises(Conflict):
            state.confirm("pageScope", ["detail"])
        state.confirm("pageScope", ["detail"], replace=True)
        self.assertEqual(["detail"], state.answers["pageScope"])

    def test_additional_question_runs_after_three_core_questions(self):
        state = self.new_state()
        state.add_question("emptyState", "空状态用哪一种？", "PRD 与 Frame 冲突")
        state.confirm("pageScope", ["home"])
        state.confirm("primaryFlow", "home > detail")
        state.confirm("frameBindings", [])
        self.assertEqual("emptyState", state.next_question())
        state.confirm("emptyState", "采用设计稿")
        self.assertEqual("ready-for-visual", state.phase)

    def test_visual_direction_and_confirmed_flow_are_generation_gates(self):
        state = self.fully_confirmed_state()
        self.assertEqual("ready-for-visual", state.phase)
        with self.assertRaisesRegex(ValueError, "视觉方向"):
            state.mark_generated()
        state.confirm_visual_direction("reference-led", {"reference": "home.png"})
        self.assertEqual("ready-for-flow", state.phase)
        with self.assertRaisesRegex(ValueError, "用户动线"):
            state.mark_generated()
        with self.assertRaisesRegex(ValueError, "尚未确认"):
            state.confirm_flow(
                {
                    "schemaVersion": "1.0",
                    "presentation": {
                        "type": "visual-flow",
                        "artifact": "flow/flow.html",
                        "layout": "left-to-right",
                    },
                    "nodes": [
                        {
                            "id": "home",
                            "thumbnail": "flow/home.png",
                            "confirmation": "pending",
                            "visualBindings": [{"target": "page", "reference": "home.png"}],
                        }
                    ],
                    "edges": [],
                    "confirmationEvents": [],
                }
            )
        ready = self.ready_to_generate_state()
        self.assertEqual("ready-to-generate", ready.phase)

    def test_prd_change_invalidates_only_declared_decisions(self):
        state = self.fully_confirmed_state()
        state.change_prd(fingerprint_prd("PRD B"), affected=["primaryFlow"])
        self.assertEqual("primaryFlow", state.next_question())
        self.assertEqual(["home"], state.answers["pageScope"])
        self.assertIn("frameBindings", state.answers)

    def test_unknown_affected_decision_is_rejected(self):
        state = self.fully_confirmed_state()
        with self.assertRaisesRegex(ValueError, "未知受影响决策"):
            state.change_prd(fingerprint_prd("PRD B"), affected=["madeUpQuestion"])

    def test_unsafe_session_id_cannot_escape_state_directory(self):
        state = WorkflowState.create("../outside", "task-1", fingerprint_prd("PRD A"))
        with self.assertRaisesRegex(ValueError, "sessionId"):
            state.save(self.root)

    def test_cannot_generate_before_all_confirmations(self):
        state = self.new_state()
        with self.assertRaisesRegex(ValueError, "未完成"):
            state.mark_generated()

    def test_receipt_requires_generated_state_and_preserves_decisions(self):
        state = self.ready_to_generate_state()
        with self.assertRaisesRegex(ValueError, "尚未生成"):
            build_receipt(
                state,
                "ou_agent",
                {"status": "completed"},
                "2026-07-21T10:20:00Z",
            )
        state.mark_generated()
        receipt = build_receipt(
            state,
            "ou_agent",
            {"status": "completed", "artifact": "demo/index.html"},
            "2026-07-21T10:20:00Z",
        )
        self.assertEqual(state.sessionId, receipt["sessionId"])
        self.assertEqual(state.prdFingerprint, receipt["prdFingerprint"])
        self.assertEqual(state.answers["frameBindings"], receipt["decisions"]["frameBindings"])
        self.assertEqual("reference-led", receipt["decisions"]["visualDirection"]["strategy"])
        self.assertEqual("home", receipt["decisions"]["flow"]["nodes"][0]["id"])
        state.mark_receipt_written()
        self.assertEqual("receipt-written", state.phase)


if __name__ == "__main__":
    unittest.main()
