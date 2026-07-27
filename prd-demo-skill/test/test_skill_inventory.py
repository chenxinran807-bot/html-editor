import pathlib
import unittest


ROOT = pathlib.Path(__file__).parents[1]


class SkillInventoryTest(unittest.TestCase):
    def test_required_files_exist(self):
        required = {
            "SKILL.md",
            "agents/openai.yaml",
            "references/clarification.md",
            "references/figma-materials.md",
            "references/figma-task-handoff.md",
            "references/iteration-handoff.md",
            "references/visual-exploration.md",
            "references/flow-confirmation.md",
            "references/automatic-qa.md",
            "scripts/prototype_pipeline.py",
            "scripts/validate_prototype.py",
        }
        missing = sorted(str(path) for path in required if not (ROOT / path).is_file())
        self.assertEqual([], missing)

    def test_agent_metadata_matches_workflow_entry(self):
        metadata = (ROOT / "agents/openai.yaml").read_text(encoding="utf-8")
        self.assertIn('display_name: "PRD 高保真交互 Demo"', metadata)
        self.assertIn("$prd-demo", metadata)
        self.assertIn("视觉方向", metadata)
        self.assertIn("自动 QA", metadata)


if __name__ == "__main__":
    unittest.main()
