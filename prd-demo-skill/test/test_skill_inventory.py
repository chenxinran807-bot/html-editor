import pathlib
import unittest


ROOT = pathlib.Path(__file__).parents[1]


class SkillInventoryTest(unittest.TestCase):
    def test_required_files_exist(self):
        required = {
            "SKILL.md",
            "references/clarification.md",
            "references/figma-materials.md",
            "references/figma-task-handoff.md",
            "references/iteration-handoff.md",
            "scripts/validate_prototype.py",
        }
        missing = sorted(str(path) for path in required if not (ROOT / path).is_file())
        self.assertEqual([], missing)


if __name__ == "__main__":
    unittest.main()
