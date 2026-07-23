import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "wrap_annotator", ROOT / "scripts" / "wrap_annotator.py"
)
wrap = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(wrap)


class WrapAnnotatorTest(unittest.TestCase):
    def test_injects_before_body_and_is_idempotent(self):
        snippet = wrap.build_snippet("console.log('ann')")
        first, mode = wrap.inject(
            "<html><body><main>demo</main></body></html>", snippet
        )
        second, second_mode = wrap.inject(first, snippet)
        self.assertEqual(mode, "before-body")
        self.assertEqual(second_mode, "already-injected")
        self.assertEqual(second.count(wrap.MARKER), 1)

    def test_force_strip_removes_old_script_and_style(self):
        old = (
            '<meta name="prd-demo-workflow" data-task-id="old">'
            '<style data-annotator="true">old</style>'
            '<script data-annotator="true">old</script>'
        )
        clean, count = wrap.strip_injected(old)
        self.assertEqual(count, 3)
        self.assertNotIn("data-annotator", clean)
        self.assertNotIn("prd-demo-workflow", clean)

    def test_workflow_metadata_is_escaped_and_injected_once(self):
        workflow = wrap.build_workflow_meta(
            "task-123",
            "session-456",
            "sha256:" + "a" * 64,
        )
        snippet = wrap.build_snippet("console.log('ann')", workflow)
        result, mode = wrap.inject("<html><body>demo</body></html>", snippet)
        self.assertEqual("before-body", mode)
        self.assertIn('name="prd-demo-workflow"', result)
        self.assertIn('data-task-id="task-123"', result)
        self.assertIn('data-session-id="session-456"', result)
        self.assertIn('data-prd-fingerprint="sha256:' + "a" * 64 + '"', result)
        self.assertEqual(1, result.count('name="prd-demo-workflow"'))

    def test_workflow_metadata_rejects_control_characters(self):
        with self.assertRaisesRegex(ValueError, "控制字符"):
            wrap.build_workflow_meta("task\n123", "session-456", "sha256:" + "a" * 64)


if __name__ == "__main__":
    unittest.main()
