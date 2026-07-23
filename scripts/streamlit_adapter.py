#!/usr/bin/env python3
"""Inspect and launch Streamlit projects without modifying them."""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import pathlib
import shutil
import socket
import stat
import subprocess
import sys
import tempfile
import unicodedata
import zipfile


ENTRY_NAMES = ("app.py", "streamlit_app.py", "main.py")
HASH_SUFFIXES = {".py", ".toml", ".txt", ".md", ".json", ".yaml", ".yml"}
IGNORED_DIRECTORIES = {
    ".git",
    ".venv",
    "venv",
    ".env",
    "env",
    "virtualenv",
    "node_modules",
    "__pycache__",
}
MAX_HASH_FILE_SIZE = 5 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 2000
MAX_ARCHIVE_FILE_SIZE = 10 * 1024 * 1024
MAX_ARCHIVE_TOTAL_SIZE = 100 * 1024 * 1024
MAX_COMPRESSION_RATIO = 100
MAX_RUNTIME_IDENTITY_FILES = 5000
MAX_RUNTIME_IDENTITY_BYTES = 256 * 1024 * 1024
DEPENDENCY_NAMES = {
    "requirements.txt",
    "pyproject.toml",
    "Pipfile",
    "Pipfile.lock",
    "poetry.lock",
    "uv.lock",
}
PYTHON_CANDIDATES = (
    pathlib.Path(".venv/bin/python"),
    pathlib.Path("venv/bin/python"),
    pathlib.Path(".venv/Scripts/python.exe"),
    pathlib.Path("venv/Scripts/python.exe"),
)
WINDOWS_RESERVED_NAMES = {
    "con",
    "prn",
    "aux",
    "nul",
    *(f"com{number}" for number in range(1, 10)),
    *(f"lpt{number}" for number in range(1, 10)),
}


def _is_archive(project: pathlib.Path) -> bool:
    return project.is_file() and project.suffix.lower() == ".zip"


def _portable_archive_key(path: pathlib.PurePosixPath) -> str:
    key_parts = []
    for component in path.parts:
        normalized = unicodedata.normalize("NFC", component)
        if (
            ":" in normalized
            or normalized.endswith((".", " "))
            or any(unicodedata.category(character) == "Cc" for character in normalized)
        ):
            raise ValueError(f"ZIP entry has an unsafe component: {component}")
        device_name = normalized.split(".", 1)[0].casefold()
        if device_name in WINDOWS_RESERVED_NAMES:
            raise ValueError(f"ZIP entry uses a reserved device name: {component}")
        key_parts.append(normalized.casefold())
    return "/".join(key_parts)


def _archive_member_is_directory(member: zipfile.ZipInfo, mode: int) -> bool:
    return member.is_dir() or stat.S_IFMT(mode) == stat.S_IFDIR


def _validated_archive_members(
    archive: zipfile.ZipFile,
) -> list[tuple[zipfile.ZipInfo, pathlib.PurePosixPath, int]]:
    members = archive.infolist()
    if len(members) > MAX_ARCHIVE_ENTRIES:
        raise ValueError(f"ZIP has more than {MAX_ARCHIVE_ENTRIES} entries")

    validated = []
    canonical_names = set()
    total_size = 0
    for member in members:
        original = member.orig_filename
        if "\0" in original:
            raise ValueError("ZIP entry contains a NUL byte")
        if "\\" in original:
            raise ValueError(f"ZIP entry uses unsafe backslashes: {original}")
        path = pathlib.PurePosixPath(original)
        if not original or path.is_absolute() or any(
            part == ".." for part in path.parts
        ):
            raise ValueError(f"ZIP entry has an unsafe path: {original}")
        canonical = pathlib.PurePosixPath(
            *(part for part in path.parts if part not in ("", "."))
        )
        canonical_name = canonical.as_posix().rstrip("/")
        if not canonical_name:
            continue
        portable_key = _portable_archive_key(canonical)
        if portable_key in canonical_names:
            raise ValueError(f"ZIP contains duplicate path: {canonical_name}")
        canonical_names.add(portable_key)

        mode = member.external_attr >> 16
        file_type = stat.S_IFMT(mode)
        if file_type not in (0, stat.S_IFREG, stat.S_IFDIR):
            raise ValueError(f"ZIP contains a non-regular entry: {original}")
        if member.file_size > MAX_ARCHIVE_FILE_SIZE:
            raise ValueError(f"ZIP entry is larger than 10 MiB: {original}")
        total_size += member.file_size
        if total_size > MAX_ARCHIVE_TOTAL_SIZE:
            raise ValueError("ZIP uncompressed content is larger than 100 MiB")
        if member.file_size and (
            member.compress_size == 0
            or member.file_size / member.compress_size > MAX_COMPRESSION_RATIO
        ):
            raise ValueError(f"ZIP entry has an extreme compression ratio: {original}")
        validated.append((member, canonical, mode))
    return validated


@contextlib.contextmanager
def _materialize_project(project: pathlib.Path):
    source = pathlib.Path(project).expanduser().resolve()
    if not _is_archive(source):
        yield source, None
        return

    with tempfile.TemporaryDirectory(prefix="html-editor-streamlit-") as directory:
        extraction_root = pathlib.Path(directory)
        with zipfile.ZipFile(source) as archive:
            members = _validated_archive_members(archive)
            for member, relative, mode in members:
                target = extraction_root.joinpath(*relative.parts)
                is_directory = _archive_member_is_directory(member, mode)
                if is_directory:
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source_file, target.open("wb") as target_file:
                    shutil.copyfileobj(source_file, target_file)
                permissions = mode & 0o777
                if permissions:
                    target.chmod(permissions)

        file_paths = [
            relative
            for member, relative, mode in members
            if not _archive_member_is_directory(member, mode)
        ]
        first_parts = {path.parts[0] for path in file_paths if path.parts}
        wrapped = (
            len(first_parts) == 1
            and bool(file_paths)
            and all(len(path.parts) > 1 for path in file_paths)
        )
        root = extraction_root / next(iter(first_parts)) if wrapped else extraction_root
        yield root.resolve(), source


def _project_and_file(project: pathlib.Path) -> tuple[pathlib.Path, pathlib.Path | None]:
    candidate = pathlib.Path(project).expanduser().resolve()
    if candidate.is_file():
        if candidate.suffix != ".py":
            raise ValueError(f"Streamlit entry must be a Python file: {candidate}")
        return candidate.parent, candidate
    if not candidate.is_dir():
        raise FileNotFoundError(f"Project does not exist: {candidate}")
    return candidate, None


def _imports_streamlit(path: pathlib.Path) -> bool:
    try:
        source = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return False
    return any(
        line.lstrip().startswith(("import streamlit", "from streamlit"))
        for line in source.splitlines()
    )


def discover_entries(project: pathlib.Path) -> list[pathlib.Path]:
    """Return Streamlit root entries in preference order."""
    root, supplied_file = _project_and_file(pathlib.Path(project))
    if supplied_file is not None:
        return [supplied_file]

    root_python = [
        path.resolve()
        for path in root.iterdir()
        if path.is_file()
        and path.suffix == ".py"
        and (path.name in ENTRY_NAMES or _imports_streamlit(path))
    ]
    rank = {name: index for index, name in enumerate(ENTRY_NAMES)}
    return sorted(root_python, key=lambda path: (rank.get(path.name, len(rank)), path.name))


def _fingerprint_files(project: pathlib.Path):
    for directory, directory_names, file_names in os.walk(project):
        directory_names[:] = sorted(
            name for name in directory_names if name not in IGNORED_DIRECTORIES
        )
        current = pathlib.Path(directory)
        for name in sorted(file_names):
            path = current / name
            relative = path.relative_to(project)
            if relative == pathlib.Path(".streamlit/secrets.toml"):
                continue
            if path.suffix.lower() not in HASH_SUFFIXES:
                continue
            try:
                if path.stat().st_size > MAX_HASH_FILE_SIZE:
                    continue
            except OSError:
                continue
            yield relative, path


def _fingerprint_root(root: pathlib.Path, runtime_digest: str | None = None) -> str:
    digest = hashlib.sha256()
    for relative, path in _fingerprint_files(root):
        digest.update(relative.as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    if runtime_digest is None:
        _, _, runtime_digest, _ = _runtime_identity(root)
    digest.update(b"runtime\0")
    digest.update(runtime_digest.encode("ascii"))
    return f"sha256:{digest.hexdigest()}"


def project_fingerprint(project: pathlib.Path) -> str:
    """Hash relevant project-relative paths and file contents."""
    with _materialize_project(pathlib.Path(project)) as (materialized, _):
        root, _ = _project_and_file(materialized)
        _, _, runtime_digest, _ = _runtime_identity(root)
        return _fingerprint_root(root, runtime_digest)


def _python_selection(
    project_root: pathlib.Path,
) -> tuple[pathlib.Path, str, pathlib.Path | None]:
    root = pathlib.Path(project_root).expanduser().resolve()
    for relative in PYTHON_CANDIDATES:
        candidate = root / relative
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return candidate.resolve(), "project-venv", candidate
    return pathlib.Path(sys.executable), "current-interpreter", None


def resolve_python(project_root: pathlib.Path) -> pathlib.Path:
    """Select an executable project virtualenv Python, or this interpreter."""
    python, _, _ = _python_selection(project_root)
    return python


def _hash_runtime_file(
    digest,
    path: pathlib.Path,
    label: str,
    limits: list[int],
) -> None:
    try:
        size = path.stat().st_size
    except OSError as error:
        raise ValueError(f"Cannot inspect runtime file {path}: {error}") from error
    if (
        limits[0] + 1 > MAX_RUNTIME_IDENTITY_FILES
        or limits[1] + size > MAX_RUNTIME_IDENTITY_BYTES
    ):
        raise ValueError(
            "Streamlit runtime identity limit exceeded "
            f"({MAX_RUNTIME_IDENTITY_FILES} files, "
            f"{MAX_RUNTIME_IDENTITY_BYTES} bytes)"
        )
    limits[0] += 1
    limits[1] += size
    digest.update(b"file\0")
    digest.update(label.encode("utf-8"))
    digest.update(b"\0")
    actual_size = 0
    try:
        with path.open("rb") as runtime_file:
            for chunk in iter(lambda: runtime_file.read(1024 * 1024), b""):
                actual_size += len(chunk)
                if limits[1] - size + actual_size > MAX_RUNTIME_IDENTITY_BYTES:
                    raise ValueError(
                        "Streamlit runtime identity limit exceeded while reading "
                        f"{path}"
                    )
                digest.update(chunk)
    except OSError as error:
        raise ValueError(f"Cannot fingerprint runtime file {path}: {error}") from error
    limits[1] += actual_size - size
    digest.update(b"\0")


def _streamlit_runtime_files(
    venv_root: pathlib.Path,
) -> tuple[list[pathlib.Path], list[pathlib.Path]]:
    site_packages = []
    unix_library = venv_root / "lib"
    if unix_library.is_dir():
        site_packages.extend(
            path
            for path in unix_library.glob("python*/site-packages")
            if path.is_dir()
        )
    windows_site = venv_root / "Lib/site-packages"
    if windows_site.is_dir():
        site_packages.append(windows_site)

    runtime_roots = []
    for site in sorted(set(site_packages)):
        package = site / "streamlit"
        if package.is_dir():
            runtime_roots.append(package)
        try:
            children = sorted(site.iterdir())
        except OSError as error:
            raise ValueError(
                f"Cannot inspect Streamlit site-packages {site}: {error}"
            ) from error
        runtime_roots.extend(
            child
            for child in children
            if child.is_dir()
            and child.name.casefold().startswith("streamlit-")
            and child.name.casefold().endswith(".dist-info")
        )

    files = []
    for runtime_root in sorted(set(runtime_roots)):
        try:
            descendants = runtime_root.rglob("*")
            files.extend(
                path
                for path in descendants
                if path.is_file()
                and "__pycache__" not in path.parts
                and path.suffix.casefold() != ".pyc"
            )
        except OSError as error:
            raise ValueError(
                f"Cannot inspect Streamlit runtime files in {runtime_root}: {error}"
            ) from error
    return sorted(set(runtime_roots)), sorted(set(files))


def _runtime_identity(
    project_root: pathlib.Path,
) -> tuple[pathlib.Path, str, str, str]:
    root = pathlib.Path(project_root).expanduser().resolve()
    python, source, candidate = _python_selection(root)
    resolved_python = python.resolve()
    digest = hashlib.sha256()
    limits = [0, 0]
    if candidate is None:
        logical_name = str(pathlib.Path(sys.executable))
        symlink_target = ""
        venv_root = None
        runtime_scope = "interpreter-only"
    else:
        logical_name = candidate.relative_to(root).as_posix()
        venv_root = root / candidate.relative_to(root).parts[0]
        runtime_scope = "project-venv-streamlit"
        try:
            symlink_target = os.readlink(candidate) if candidate.is_symlink() else ""
        except OSError as error:
            raise ValueError(
                f"Cannot inspect Python interpreter symlink {candidate}: {error}"
            ) from error
    try:
        resolved_name = resolved_python.relative_to(root).as_posix()
    except ValueError:
        resolved_name = str(resolved_python)
    digest.update(logical_name.encode("utf-8"))
    digest.update(b"\0")
    digest.update(symlink_target.encode("utf-8"))
    digest.update(b"\0")
    digest.update(resolved_name.encode("utf-8"))
    digest.update(b"\0")
    _hash_runtime_file(digest, resolved_python, "interpreter", limits)

    if venv_root is not None:
        config = venv_root / "pyvenv.cfg"
        if config.is_file():
            digest.update(b"pyvenv-config-present\0")
            _hash_runtime_file(digest, config, "pyvenv.cfg", limits)
        else:
            digest.update(b"pyvenv-config-absent\0")

        runtime_roots, runtime_files = _streamlit_runtime_files(venv_root)
        if runtime_roots:
            digest.update(b"streamlit-runtime-present\0")
            for runtime_root in runtime_roots:
                digest.update(runtime_root.relative_to(venv_root).as_posix().encode())
                digest.update(b"\0")
            for runtime_file in runtime_files:
                _hash_runtime_file(
                    digest,
                    runtime_file,
                    runtime_file.relative_to(venv_root).as_posix(),
                    limits,
                )
        else:
            digest.update(b"streamlit-runtime-absent\0")
    return python, source, f"sha256:{digest.hexdigest()}", runtime_scope


def _inspect_materialized(
    project: pathlib.Path, entry: pathlib.Path | None = None
) -> dict:
    """Return normalized metadata for a Streamlit file or project directory."""
    root, supplied_file = _project_and_file(pathlib.Path(project))
    if entry is not None:
        selected = pathlib.Path(entry).expanduser()
        if not selected.is_absolute():
            selected = root / selected
        selected = selected.resolve()
        if not selected.is_file() or selected.suffix != ".py":
            raise FileNotFoundError(f"Entry does not exist: {selected}")
    elif supplied_file is not None:
        selected = supplied_file
    else:
        entries = discover_entries(root)
        if not entries:
            raise ValueError(f"No Streamlit entry found in {root}")
        selected = entries[0]

    try:
        selected.relative_to(root)
    except ValueError:
        raise ValueError(f"Entry is outside project: {selected}") from None

    pages_directory = root / "pages"
    pages = (
        sorted(path.resolve() for path in pages_directory.glob("*.py") if path.is_file())
        if pages_directory.is_dir()
        else []
    )
    dependencies = sorted(
        path.resolve()
        for path in root.iterdir()
        if path.is_file()
        and (path.name in DEPENDENCY_NAMES or path.name.startswith("requirements"))
        and (path.name in DEPENDENCY_NAMES or path.suffix == ".txt")
    )
    python, python_source, runtime_digest, runtime_scope = _runtime_identity(root)
    return {
        "project": str(root),
        "entry": str(selected),
        "entries": [str(path) for path in discover_entries(root)],
        "pages": [str(path) for path in pages],
        "dependencies": [str(path) for path in dependencies],
        "projectFingerprint": _fingerprint_root(root, runtime_digest),
        "pythonExecutable": str(python),
        "pythonSource": python_source,
        "runtimeDigest": runtime_digest,
        "runtimeScope": runtime_scope,
    }


def _archive_info(info: dict, archive: pathlib.Path) -> dict:
    root = pathlib.Path(info["project"])
    result = dict(info)
    for key in ("entry", "pythonExecutable"):
        path = pathlib.Path(info[key])
        if key == "pythonExecutable" and info["pythonSource"] == "current-interpreter":
            continue
        result[key] = path.relative_to(root).as_posix()
    for key in ("entries", "pages", "dependencies"):
        result[key] = [
            pathlib.Path(path).relative_to(root).as_posix() for path in info[key]
        ]
    result.pop("project")
    result["sourceArchive"] = str(archive)
    result["temporaryProject"] = True
    return result


def inspect_project(
    project: pathlib.Path, entry: pathlib.Path | None = None
) -> dict:
    with _materialize_project(pathlib.Path(project)) as (materialized, archive):
        info = _inspect_materialized(materialized, entry)
        return _archive_info(info, archive) if archive else info


def choose_port() -> int:
    """Ask the operating system for an available localhost TCP port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def build_launch_command(
    entry: str, port: int, python_executable: str | None = None
) -> list[str]:
    return [
        python_executable or sys.executable,
        "-m",
        "streamlit",
        "run",
        entry,
        "--server.address",
        "127.0.0.1",
        "--server.port",
        str(port),
        "--server.headless=true",
    ]


def launch(project: str, entry: str | None = None, port: int | None = None) -> int:
    with _materialize_project(pathlib.Path(project)) as (materialized, archive):
        info = _inspect_materialized(
            materialized, pathlib.Path(entry) if entry else None
        )
        selected_port = choose_port() if port is None else port
        command = build_launch_command(
            info["entry"], selected_port, info["pythonExecutable"]
        )
        display = _archive_info(info, archive) if archive else info
        readiness = {
            "url": f"http://127.0.0.1:{selected_port}",
            "entry": display["entry"],
            "projectFingerprint": info["projectFingerprint"],
            "pythonExecutable": info["pythonExecutable"],
            "pythonSource": info["pythonSource"],
            "runtimeDigest": info["runtimeDigest"],
            "runtimeScope": info["runtimeScope"],
            "command": command,
        }
        print(json.dumps(readiness, ensure_ascii=False), flush=True)
        completed = subprocess.run(command, cwd=info["project"])
        return completed.returncode


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    inspect_parser = commands.add_parser("inspect")
    inspect_parser.add_argument("project")
    launch_parser = commands.add_parser("launch")
    launch_parser.add_argument("project")
    launch_parser.add_argument("--entry")
    launch_parser.add_argument("--port", type=int)
    return parser


def main() -> int:
    arguments = _parser().parse_args()
    if arguments.command == "inspect":
        print(json.dumps(inspect_project(pathlib.Path(arguments.project)), ensure_ascii=False))
        return 0
    return launch(arguments.project, arguments.entry, arguments.port)


if __name__ == "__main__":
    raise SystemExit(main())
