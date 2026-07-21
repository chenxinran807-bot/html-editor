#!/usr/bin/env python3
"""Build a deterministic, credential-free prd-demo Skill archive."""

import argparse
import hashlib
import pathlib
import re
import zipfile


ALLOWED_ROOTS = ("agents", "references", "scripts")
EXCLUDED_NAMES = {"build_release.py", ".DS_Store"}
FIXED_TIMESTAMP = (2026, 1, 1, 0, 0, 0)


def release_files(skill_root):
    root = pathlib.Path(skill_root)
    files = [root / "SKILL.md"]
    for name in ALLOWED_ROOTS:
        directory = root / name
        if not directory.is_dir():
            continue
        files.extend(
            path
            for path in directory.rglob("*")
            if path.is_file()
            and path.name not in EXCLUDED_NAMES
            and "__pycache__" not in path.parts
        )
    return sorted(files, key=lambda path: path.relative_to(root).as_posix())


def assert_safe_text(relative, data):
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return
    forbidden_literals = ("/" + "Users/", "access" + "_token", "app" + "_secret")
    for forbidden in forbidden_literals:
        if forbidden.lower() in text.lower():
            raise ValueError(f"发布文件包含敏感或本机信息: {relative}: {forbidden}")
    if re.search(r"\bou_[A-Za-z0-9]{10,}\b", text):
        raise ValueError(f"发布文件包含疑似真实 ownerOpenId: {relative}")


def build_release(skill_root, output_path):
    root = pathlib.Path(skill_root).resolve()
    output = pathlib.Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    files = release_files(root)
    if not files or files[0].name != "SKILL.md":
        raise ValueError("Skill 发布缺少 SKILL.md")
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            relative = path.relative_to(root).as_posix()
            data = path.read_bytes()
            assert_safe_text(relative, data)
            info = zipfile.ZipInfo(relative, FIXED_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o755 if relative.startswith("scripts/") else 0o644) << 16
            archive.writestr(info, data)
    return {
        "path": str(output),
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "fileCount": len(files),
    }


def main():
    parser = argparse.ArgumentParser(description="打包 prd-demo Skill")
    parser.add_argument("--root", default=str(pathlib.Path(__file__).parents[1]))
    parser.add_argument("--output")
    args = parser.parse_args()
    root = pathlib.Path(args.root)
    output = pathlib.Path(args.output) if args.output else root / "dist" / "prd-demo-workflow.zip"
    result = build_release(root, output)
    checksum = output.with_suffix(output.suffix + ".sha256")
    checksum.write_text(f"{result['sha256']}  {output.name}\n", encoding="utf-8")
    print(f"{output}\n{checksum}\n{result['sha256']}")


if __name__ == "__main__":
    main()
