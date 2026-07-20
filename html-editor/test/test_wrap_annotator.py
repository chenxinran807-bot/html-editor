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
            '<style data-annotator="true">old</style>'
            '<script data-annotator="true">old</script>'
        )
        clean, count = wrap.strip_injected(old)
        self.assertEqual(count, 2)
        self.assertNotIn("data-annotator", clean)


if __name__ == "__main__":
    unittest.main()
