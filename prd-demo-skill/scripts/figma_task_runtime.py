#!/usr/bin/env python3
"""Validate downloaded Figma task folders before prd-demo consumes them."""

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path


class InvalidTask(ValueError):
    """A completed task violates the immutable handoff contract."""


class AmbiguousRoot(ValueError):
    """More than one current-user task root is valid."""


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise InvalidTask(f"JSON 无法读取: {path}: {error}") from error


def safe_join(root, relative_path):
    root = Path(root).resolve()
    value = str(relative_path or "").replace("\\", "/")
    value_path = Path(value)
    if (
        not value
        or value.startswith("/")
        or value_path.is_absolute()
        or ".." in value_path.parts
        or "" in value.split("/")
    ):
        raise InvalidTask(f"不是安全相对路径: {relative_path}")
    resolved = (root / value_path).resolve()
    if root != resolved and root not in resolved.parents:
        raise InvalidTask(f"路径逃逸任务目录: {relative_path}")
    return resolved


def parse_time(value):
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as error:
        raise InvalidTask(f"completedAt 非法: {value}") from error
    if parsed.tzinfo is None:
        raise InvalidTask(f"completedAt 必须包含时区: {value}")
    return parsed


def _assert_unified_manifest(manifest):
    exporter = manifest.get("exporter")
    pages = manifest.get("pages")
    if (
        manifest.get("schemaVersion") != "1.0"
        or not isinstance(exporter, dict)
        or not isinstance(exporter.get("capabilities"), list)
        or not isinstance(pages, list)
        or not pages
    ):
        raise InvalidTask("manifest 不是 exporter + pages unified 结构")
    return exporter, pages


def validate_task(task_dir, expected_owner):
    root = Path(task_dir).resolve()
    task_path = root / "task.json"
    completion_path = root / "_COMPLETE.json"
    manifest_path = root / "figma-export.manifest.json"
    for required in (task_path, completion_path, manifest_path):
        if not required.is_file():
            raise InvalidTask(f"缺少任务文件: {required.name}")

    task = load_json(task_path)
    completion = load_json(completion_path)
    manifest = load_json(manifest_path)
    task_id = task.get("taskId")
    if not task_id or root.name != task_id or completion.get("taskId") != task_id:
        raise InvalidTask("目录名、task.json 与 _COMPLETE.json 的 taskId 不一致")
    if task.get("ownerOpenId") != expected_owner:
        raise InvalidTask("ownerOpenId 与当前用户不一致")
    if task.get("taskSchemaVersion") != "1.0":
        raise InvalidTask("不支持的 taskSchemaVersion")
    if completion.get("completionSchemaVersion") != "1.0":
        raise InvalidTask("不支持的 completionSchemaVersion")

    exporter, pages = _assert_unified_manifest(manifest)
    entries = task.get("files")
    if not isinstance(entries, list) or not entries:
        raise InvalidTask("task.files 为空或格式错误")
    registered = set()
    for entry in entries:
        relative = entry.get("path")
        if relative in registered:
            raise InvalidTask(f"task.files 路径重复: {relative}")
        registered.add(relative)
        path = safe_join(root, relative)
        if not path.is_file():
            raise InvalidTask(f"任务文件不存在: {relative}")
        if path.stat().st_size != entry.get("bytes"):
            raise InvalidTask(f"文件字节数不一致: {relative}")
        if sha256_file(path) != entry.get("sha256"):
            raise InvalidTask(f"SHA-256 不一致: {relative}")

    if "figma-export.manifest.json" not in registered:
        raise InvalidTask("task.files 未登记 manifest")
    for page in pages:
        for key in ("png", "svg"):
            if page.get(key):
                safe_join(root, page[key])
                if page[key] not in registered:
                    raise InvalidTask(f"manifest 引用未登记文件: {page[key]}")

    if sha256_file(manifest_path) != completion.get("manifestSha256"):
        raise InvalidTask("manifestSha256 不一致")
    if completion.get("fileCount") != len(entries) + 1:
        raise InvalidTask("_COMPLETE.json fileCount 口径不一致")
    completed_at = completion.get("completedAt")
    parse_time(completed_at)
    return {
        "taskId": task_id,
        "completedAt": completed_at,
        "ownerOpenId": task["ownerOpenId"],
        "manifestPath": str(manifest_path),
        "capabilities": exporter["capabilities"],
        "taskDir": str(root),
        "fileKey": (task.get("figma") or {}).get("fileKey"),
        "nodeIds": (task.get("figma") or {}).get("nodeIds", []),
    }


def select_latest_task(task_dirs, expected_owner):
    completed = []
    for directory in map(Path, task_dirs):
        marker = directory / "_COMPLETE.json"
        if marker.is_file():
            completion = load_json(marker)
            completed.append((parse_time(completion.get("completedAt")), directory))
    if not completed:
        return None
    completed.sort(key=lambda item: item[0], reverse=True)
    return validate_task(completed[0][1], expected_owner)


def select_root(marker_paths, expected_owner):
    valid = []
    for marker_path in map(Path, marker_paths):
        marker = load_json(marker_path)
        if marker.get("ownerOpenId") != expected_owner:
            continue
        expected = {
            "rootSchemaVersion": "1.0",
            "kind": "prd-demo-task-root",
            "ownerOpenId": expected_owner,
            "createdBy": "figma-capture-helper",
        }
        if marker != expected:
            raise InvalidTask(f"任务根标记格式错误: {marker_path}")
        valid.append(marker_path.parent.resolve())
    if len(valid) > 1:
        raise AmbiguousRoot("发现多个属于当前用户的 prd-demo 任务根目录")
    return str(valid[0]) if valid else None


def main():
    parser = argparse.ArgumentParser(description="选择并校验最新 Figma 任务")
    parser.add_argument("--owner", required=True, help="当前飞书用户 openId")
    parser.add_argument("task_dirs", nargs="+", help="已下载的候选任务目录")
    args = parser.parse_args()
    result = select_latest_task(args.task_dirs, args.owner)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
