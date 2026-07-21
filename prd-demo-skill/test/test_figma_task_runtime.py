import hashlib
import json
import pathlib
import sys
import tempfile
import unittest
import uuid


ROOT = pathlib.Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from figma_task_runtime import (  # noqa: E402
    AmbiguousRoot,
    InvalidTask,
    select_latest_task,
    select_root,
    validate_task,
)


def digest(data):
    return hashlib.sha256(data).hexdigest()


class FigmaTaskRuntimeTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temporary.name)
        self.owner = "ou_current"

    def tearDown(self):
        self.temporary.cleanup()

    def write_json(self, path, value):
        data = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return data

    def make_task(
        self,
        label,
        *,
        created_at="2026-07-21T10:00:00Z",
        completed_at="2026-07-21T10:01:00Z",
        owner=None,
        include_complete=True,
        png_path="pages/frame.png",
    ):
        task_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"prd-demo-test:{label}"))
        task_dir = self.root / task_id
        task_dir.mkdir()
        png_bytes = b"fixture-png"
        png_file = task_dir / "pages" / "frame.png"
        png_file.parent.mkdir()
        png_file.write_bytes(png_bytes)
        manifest = {
            "schemaVersion": "1.0",
            "exporter": {
                "type": "figma-plugin",
                "version": "2.0.0",
                "capabilities": ["frame-png"],
            },
            "pages": [
                {
                    "id": "page-frame",
                    "nodeId": "71:4909",
                    "png": png_path,
                    "width": 750,
                    "height": 1624,
                }
            ],
            "assets": [],
            "tokens": {},
            "constraints": {"editableRegions": ["content-area"]},
        }
        manifest_bytes = self.write_json(task_dir / "figma-export.manifest.json", manifest)
        files = [
            {
                "path": "figma-export.manifest.json",
                "bytes": len(manifest_bytes),
                "sha256": digest(manifest_bytes),
            },
            {
                "path": "pages/frame.png",
                "bytes": len(png_bytes),
                "sha256": digest(png_bytes),
            },
        ]
        self.write_json(
            task_dir / "task.json",
            {
                "taskSchemaVersion": "1.0",
                "taskId": task_id,
                "createdAt": created_at,
                "ownerOpenId": owner or self.owner,
                "figma": {"fileKey": "QhZYIMcaZ2Idd0uDTMZ1Kg", "nodeIds": ["71:4909"]},
                "files": files,
            },
        )
        if include_complete:
            self.write_json(
                task_dir / "_COMPLETE.json",
                {
                    "completionSchemaVersion": "1.0",
                    "taskId": task_id,
                    "completedAt": completed_at,
                    "manifestSha256": digest(manifest_bytes),
                    "fileCount": len(files) + 1,
                },
            )
        return task_dir

    def make_root_marker(self, name, owner=None):
        folder = self.root / name
        folder.mkdir()
        marker = folder / "_PRD_DEMO_ROOT.json"
        self.write_json(
            marker,
            {
                "rootSchemaVersion": "1.0",
                "kind": "prd-demo-task-root",
                "ownerOpenId": owner or self.owner,
                "createdBy": "figma-capture-helper",
            },
        )
        return marker

    def test_latest_uses_completed_at_not_created_at(self):
        older = self.make_task(
            "a",
            created_at="2026-07-21T10:10:00Z",
            completed_at="2026-07-21T10:12:00Z",
        )
        newer = self.make_task(
            "b",
            created_at="2026-07-21T10:00:00Z",
            completed_at="2026-07-21T10:13:00Z",
        )
        self.assertEqual(newer.name, select_latest_task([older, newer], self.owner)["taskId"])

    def test_missing_complete_is_ignored(self):
        partial = self.make_task("partial", include_complete=False)
        self.assertIsNone(select_latest_task([partial], self.owner))

    def test_wrong_owner_is_rejected(self):
        task = self.make_task("wrong", owner="ou_other")
        with self.assertRaisesRegex(InvalidTask, "ownerOpenId"):
            validate_task(task, self.owner)

    def test_tampered_payload_is_rejected(self):
        task = self.make_task("tampered")
        (task / "pages" / "frame.png").write_bytes(b"changed")
        with self.assertRaisesRegex(InvalidTask, "SHA-256|文件字节数"):
            validate_task(task, self.owner)

    def test_unsafe_manifest_path_is_rejected(self):
        task = self.make_task("unsafe", png_path="../secret.png")
        with self.assertRaisesRegex(InvalidTask, "相对路径"):
            validate_task(task, self.owner)

    def test_duplicate_valid_roots_are_ambiguous(self):
        first = self.make_root_marker("root-a")
        second = self.make_root_marker("root-b")
        with self.assertRaises(AmbiguousRoot):
            select_root([first, second], self.owner)

    def test_completed_but_corrupt_latest_does_not_silently_fallback(self):
        valid = self.make_task("valid", completed_at="2026-07-21T10:12:00Z")
        corrupt = self.make_task("corrupt", completed_at="2026-07-21T10:13:00Z")
        (corrupt / "pages" / "frame.png").write_bytes(b"changed")
        with self.assertRaises(InvalidTask):
            select_latest_task([valid, corrupt], self.owner)


if __name__ == "__main__":
    unittest.main()
