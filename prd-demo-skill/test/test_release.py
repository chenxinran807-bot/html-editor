import hashlib
import pathlib
import sys
import tempfile
import unittest
import zipfile


ROOT = pathlib.Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_release import build_release  # noqa: E402


class ReleaseTest(unittest.TestCase):
    def test_release_is_complete_clean_and_deterministic(self):
        with tempfile.TemporaryDirectory() as temporary:
            first = pathlib.Path(temporary) / "first.zip"
            second = pathlib.Path(temporary) / "second.zip"
            build_release(ROOT, first)
            build_release(ROOT, second)
            self.assertEqual(
                hashlib.sha256(first.read_bytes()).hexdigest(),
                hashlib.sha256(second.read_bytes()).hexdigest(),
            )
            with zipfile.ZipFile(first) as archive:
                names = sorted(archive.namelist())
                self.assertIn("SKILL.md", names)
                self.assertIn("agents/openai.yaml", names)
                self.assertIn("scripts/figma_task_runtime.py", names)
                self.assertIn("scripts/workflow_state.py", names)
                self.assertIn("references/unified-workflow.md", names)
                self.assertFalse(any(name.startswith(("test/", "dist/")) for name in names))
                self.assertFalse(any("__pycache__" in name or name.endswith(".DS_Store") for name in names))
                combined = b"\n".join(archive.read(name) for name in names).decode("utf-8")
                for forbidden in ("/Users/", "access_token", "app_secret"):
                    self.assertNotIn(forbidden, combined)


if __name__ == "__main__":
    unittest.main()
