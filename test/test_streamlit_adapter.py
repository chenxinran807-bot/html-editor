import contextlib
import importlib.util
import io
import json
import os
import pathlib
import socket
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile
from unittest import mock


SCRIPT = pathlib.Path(__file__).parents[1] / "scripts" / "streamlit_adapter.py"
FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "streamlit-project"


def load_adapter():
    spec = importlib.util.spec_from_file_location("streamlit_adapter", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class StreamlitAdapterTest(unittest.TestCase):
    def setUp(self):
        self.adapter = load_adapter()

    def _make_project_venv(self, project):
        app = project / "app.py"
        app.write_text("import streamlit\n")
        python = project / ".venv/bin/python"
        python.parent.mkdir(parents=True)
        python.write_bytes(b"fixture-python")
        python.chmod(0o755)
        config = project / ".venv/pyvenv.cfg"
        config.write_text("home = /python-one\n")
        site_packages = project / ".venv/lib/python3.11/site-packages"
        package = site_packages / "streamlit"
        distribution = site_packages / "streamlit-1.40.0.dist-info"
        package.mkdir(parents=True)
        distribution.mkdir()
        (package / "__init__.py").write_text("__version__ = '1.40.0'\n")
        (package / "__pycache__").mkdir()
        (package / "__pycache__/ignored.pyc").write_bytes(b"ignored")
        (distribution / "METADATA").write_text("Name: streamlit\nVersion: 1.40.0\n")
        (distribution / "RECORD").write_text("streamlit/__init__.py,,\n")
        return app, config, package, distribution

    def test_discovery_prefers_conventional_root_entry_and_lists_pages(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            (project / "pages").mkdir()
            (project / "other.py").write_text("from streamlit import title\n")
            (project / "main.py").write_text("import streamlit\n")
            (project / "streamlit_app.py").write_text("import streamlit as st\n")
            (project / "app.py").write_text("import streamlit as st\n")
            (project / "plain.py").write_text("print('not streamlit')\n")
            (project / "pages" / "01_Page.py").write_text("import streamlit as st\n")

            entries = self.adapter.discover_entries(project)
            info = self.adapter.inspect_project(project)

            self.assertEqual(entries[0], (project / "app.py").resolve())
            self.assertEqual(
                entries,
                [
                    (project / "app.py").resolve(),
                    (project / "streamlit_app.py").resolve(),
                    (project / "main.py").resolve(),
                    (project / "other.py").resolve(),
                ],
            )
            self.assertEqual(info["entry"], str((project / "app.py").resolve()))
            self.assertEqual(info["pages"], [str((project / "pages" / "01_Page.py").resolve())])

    def test_discovery_includes_conventional_entries_without_detectable_imports(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            (project / "other.py").write_text("import streamlit as st\n")
            (project / "main.py").write_text("# imports an app factory indirectly\n")
            (project / "streamlit_app.py").write_text("exec(open('ui.py').read())\n")
            (project / "app.py").write_text("from ui import render\nrender()\n")

            self.assertEqual(
                self.adapter.discover_entries(project),
                [
                    (project / "app.py").resolve(),
                    (project / "streamlit_app.py").resolve(),
                    (project / "main.py").resolve(),
                    (project / "other.py").resolve(),
                ],
            )

    def test_file_input_is_accepted_and_paths_are_absolute(self):
        info = self.adapter.inspect_project(FIXTURE / "app.py")
        self.assertEqual(info["project"], str(FIXTURE.resolve()))
        self.assertEqual(info["entry"], str((FIXTURE / "app.py").resolve()))
        self.assertEqual(info["dependencies"], [str((FIXTURE / "requirements.txt").resolve())])

    def test_explicit_entry_cannot_escape_project_root(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = pathlib.Path(directory)
            project = workspace / "project"
            project.mkdir()
            (project / "app.py").write_text("import streamlit\n")
            outside = workspace / "outside.py"
            outside.write_text("import streamlit\n")
            symlink = project / "linked.py"
            symlink.symlink_to(outside)

            escaped_entries = [
                outside,
                pathlib.Path("..") / "outside.py",
                symlink,
            ]
            for escaped in escaped_entries:
                with self.subTest(entry=escaped):
                    with self.assertRaisesRegex(ValueError, "outside project"):
                        self.adapter.inspect_project(project, escaped)

    def test_auto_discovered_entry_cannot_be_symlink_outside_project(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = pathlib.Path(directory)
            project = workspace / "project"
            project.mkdir()
            outside = workspace / "outside.py"
            outside.write_text("import streamlit\n")
            (project / "app.py").symlink_to(outside)

            with self.assertRaisesRegex(ValueError, "outside project"):
                self.adapter.inspect_project(project)

    def test_fingerprint_changes_with_relevant_content(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            app = project / "app.py"
            app.write_text("import streamlit\n")
            before = self.adapter.project_fingerprint(project)
            app.write_text("import streamlit\n# changed\n")
            after = self.adapter.project_fingerprint(project)
            self.assertRegex(before, r"^sha256:[0-9a-f]{64}$")
            self.assertNotEqual(before, after)

    def test_fingerprint_ignores_runtime_secret_and_large_files(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            (project / "app.py").write_text("import streamlit\n")
            ignored = [
                project / ".git" / "state.txt",
                project / "venv" / "state.py",
                project / ".venv" / "state.py",
                project / "node_modules" / "state.json",
                project / "__pycache__" / "state.py",
                project / ".streamlit" / "secrets.toml",
            ]
            for path in ignored:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("first")
            large = project / "large.txt"
            large.write_bytes(b"x" * (5 * 1024 * 1024 + 1))
            before = self.adapter.project_fingerprint(project)
            for path in ignored:
                path.write_text("second")
            large.write_bytes(b"y" * (5 * 1024 * 1024 + 1))
            self.assertEqual(before, self.adapter.project_fingerprint(project))

    def test_build_launch_command_is_exact(self):
        command = self.adapter.build_launch_command("/tmp/app.py", 8765)
        self.assertEqual(
            command,
            [
                sys.executable, "-m", "streamlit", "run", "/tmp/app.py",
                "--server.address", "127.0.0.1", "--server.port", "8765",
                "--server.headless=true",
            ],
        )

    def test_resolve_python_prefers_project_virtual_environments(self):
        candidates = [
            pathlib.Path(".venv/bin/python"),
            pathlib.Path("venv/bin/python"),
            pathlib.Path(".venv/Scripts/python.exe"),
            pathlib.Path("venv/Scripts/python.exe"),
        ]
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory) / "project with spaces"
            project.mkdir()
            for candidate in reversed(candidates):
                path = project / candidate
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("#!python\n")
                path.chmod(path.stat().st_mode | stat.S_IXUSR)
            (project / "app.py").write_text("import streamlit\n")

            self.assertEqual(
                self.adapter.resolve_python(project),
                (project / candidates[0]).resolve(),
            )
            info = self.adapter.inspect_project(project)
            self.assertEqual(
                info["pythonExecutable"], str((project / candidates[0]).resolve())
            )
            self.assertEqual(info["pythonSource"], "project-venv")

            fallback = self.adapter.inspect_project(FIXTURE)
            self.assertEqual(fallback["pythonExecutable"], sys.executable)
            self.assertEqual(fallback["pythonSource"], "current-interpreter")

    def test_resolve_python_skips_non_executable_candidates_and_falls_back(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            candidate = project / ".venv/bin/python"
            candidate.parent.mkdir(parents=True)
            candidate.write_text("#!python\n")
            self.assertEqual(self.adapter.resolve_python(project), pathlib.Path(sys.executable))

    def test_fingerprint_changes_when_selected_project_interpreter_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            app = project / "app.py"
            app.write_text("import streamlit\n")
            python = project / ".venv/bin/python"
            python.parent.mkdir(parents=True)
            python.write_bytes(b"runtime-one")
            python.chmod(0o755)
            source_before = app.read_bytes()

            before = self.adapter.inspect_project(project)
            python.write_bytes(b"runtime-two")
            python.chmod(0o755)
            after = self.adapter.inspect_project(project)

            self.assertEqual(app.read_bytes(), source_before)
            self.assertNotEqual(before["runtimeDigest"], after["runtimeDigest"])
            self.assertNotEqual(
                before["projectFingerprint"], after["projectFingerprint"]
            )
            self.assertRegex(after["runtimeDigest"], r"^sha256:[0-9a-f]{64}$")

    def test_fingerprint_changes_when_project_interpreter_symlink_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            (project / "app.py").write_text("import streamlit\n")
            runtimes = project / "runtimes"
            runtimes.mkdir()
            first_runtime = runtimes / "python-one"
            second_runtime = runtimes / "python-two"
            for runtime in (first_runtime, second_runtime):
                runtime.write_bytes(b"same-runtime-bytes")
                runtime.chmod(0o755)
            python = project / ".venv/bin/python"
            python.parent.mkdir(parents=True)
            python.symlink_to(first_runtime)
            before = self.adapter.inspect_project(project)
            python.unlink()
            python.symlink_to(second_runtime)
            after = self.adapter.inspect_project(project)

            self.assertNotEqual(before["runtimeDigest"], after["runtimeDigest"])
            self.assertNotEqual(
                before["projectFingerprint"], after["projectFingerprint"]
            )

    def test_fingerprint_changes_when_higher_priority_interpreter_appears(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            (project / "app.py").write_text("import streamlit\n")
            lower = project / "venv/bin/python"
            lower.parent.mkdir(parents=True)
            lower.write_bytes(b"same-runtime")
            lower.chmod(0o755)
            before = self.adapter.inspect_project(project)

            higher = project / ".venv/bin/python"
            higher.parent.mkdir(parents=True)
            higher.write_bytes(b"same-runtime")
            higher.chmod(0o755)
            after = self.adapter.inspect_project(project)

            self.assertEqual(after["pythonExecutable"], str(higher.resolve()))
            self.assertNotEqual(before["runtimeDigest"], after["runtimeDigest"])
            self.assertNotEqual(
                before["projectFingerprint"], after["projectFingerprint"]
            )

    def test_project_venv_fingerprint_includes_pyvenv_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            app, config, _, _ = self._make_project_venv(project)
            source_before = app.read_bytes()
            before = self.adapter.inspect_project(project)

            config.write_text("home = /python-two\n")
            after = self.adapter.inspect_project(project)

            self.assertEqual(app.read_bytes(), source_before)
            self.assertEqual(before["runtimeScope"], "project-venv-streamlit")
            self.assertNotEqual(before["runtimeDigest"], after["runtimeDigest"])
            self.assertNotEqual(
                before["projectFingerprint"], after["projectFingerprint"]
            )

    def test_project_venv_fingerprint_includes_streamlit_package_and_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            app, _, package, distribution = self._make_project_venv(project)
            source_before = app.read_bytes()
            before = self.adapter.inspect_project(project)

            (package / "__pycache__/ignored.pyc").write_bytes(b"still-ignored")
            ignored_cache_changed = self.adapter.inspect_project(project)
            (package / "__init__.py").write_text("__version__ = '1.40.1'\n")
            package_changed = self.adapter.inspect_project(project)
            (distribution / "METADATA").write_text(
                "Name: streamlit\nVersion: 1.40.1\n"
            )
            metadata_changed = self.adapter.inspect_project(project)

            self.assertEqual(app.read_bytes(), source_before)
            self.assertEqual(
                before["runtimeDigest"], ignored_cache_changed["runtimeDigest"]
            )
            self.assertNotEqual(
                before["runtimeDigest"], package_changed["runtimeDigest"]
            )
            self.assertNotEqual(
                package_changed["runtimeDigest"],
                metadata_changed["runtimeDigest"],
            )
            self.assertNotEqual(
                before["projectFingerprint"],
                metadata_changed["projectFingerprint"],
            )

    def test_project_venv_runtime_hash_fails_when_bounded_limits_are_exceeded(self):
        with tempfile.TemporaryDirectory() as directory:
            project = pathlib.Path(directory)
            self._make_project_venv(project)

            with mock.patch.object(self.adapter, "MAX_RUNTIME_IDENTITY_FILES", 2):
                with self.assertRaisesRegex(ValueError, "runtime identity limit"):
                    self.adapter.inspect_project(project)

    def test_build_launch_command_accepts_python_path_with_spaces(self):
        python = "/tmp/project with spaces/.venv/bin/python"
        command = self.adapter.build_launch_command("/tmp/app.py", 8765, python)
        self.assertEqual(command[0], python)
        self.assertEqual(command[1:], self.adapter.build_launch_command("/tmp/app.py", 8765)[1:])

    def test_choose_port_returns_bindable_localhost_port(self):
        port = self.adapter.choose_port()
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", port))

    def test_cli_inspect_prints_one_json_record(self):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "inspect", str(FIXTURE)],
            check=True, capture_output=True, text=True,
        )
        records = result.stdout.splitlines()
        self.assertEqual(len(records), 1)
        info = json.loads(records[0])
        self.assertEqual(info["entry"], str((FIXTURE / "app.py").resolve()))
        self.assertEqual(info["pages"], [str((FIXTURE / "pages" / "01_Detail.py").resolve())])
        self.assertEqual(result.stderr, "")

    def test_launch_prints_readiness_and_never_writes_project(self):
        before = {
            path.relative_to(FIXTURE): path.read_bytes()
            for path in FIXTURE.rglob("*") if path.is_file()
        }
        inspected = self.adapter.inspect_project(FIXTURE)
        output = io.StringIO()
        with mock.patch.object(self.adapter.subprocess, "run") as run:
            run.return_value.returncode = 23
            with contextlib.redirect_stdout(output):
                code = self.adapter.launch(str(FIXTURE), port=8765)
        after = {
            path.relative_to(FIXTURE): path.read_bytes()
            for path in FIXTURE.rglob("*") if path.is_file()
        }
        readiness = json.loads(output.getvalue())
        self.assertEqual(code, 23)
        self.assertEqual(before, after)
        self.assertEqual(readiness["url"], "http://127.0.0.1:8765")
        self.assertEqual(readiness["entry"], str((FIXTURE / "app.py").resolve()))
        self.assertRegex(readiness["projectFingerprint"], r"^sha256:[0-9a-f]{64}$")
        self.assertEqual(readiness["command"], self.adapter.build_launch_command(readiness["entry"], 8765))
        for field in (
            "pythonExecutable",
            "pythonSource",
            "runtimeDigest",
            "runtimeScope",
        ):
            self.assertEqual(readiness[field], inspected[field])
        run.assert_called_once_with(readiness["command"], cwd=str(FIXTURE.resolve()))


class StreamlitArchiveAdapterTest(unittest.TestCase):
    def setUp(self):
        self.adapter = load_adapter()

    def _write_zip(self, archive, members, compression=zipfile.ZIP_DEFLATED):
        with zipfile.ZipFile(archive, "w", compression=compression) as bundle:
            for name, content in members:
                bundle.writestr(name, content)

    def test_inspect_zip_with_wrapper_is_stable_and_does_not_modify_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = pathlib.Path(directory) / "project.zip"
            self._write_zip(
                archive,
                [
                    ("wrapped/app.py", "import streamlit as st\n"),
                    ("wrapped/pages/01_Detail.py", "import streamlit as st\n"),
                    ("wrapped/requirements.txt", "streamlit>=1.40\n"),
                ],
            )
            before = archive.read_bytes()
            temp_pattern = pathlib.Path(tempfile.gettempdir()).glob("html-editor-streamlit-*")
            temporary_directories_before = set(temp_pattern)

            first = self.adapter.inspect_project(archive)
            second = self.adapter.inspect_project(archive)
            cli = subprocess.run(
                [sys.executable, str(SCRIPT), "inspect", str(archive)],
                check=True, capture_output=True, text=True,
            )
            cli_info = json.loads(cli.stdout)

            self.assertEqual(archive.read_bytes(), before)
            self.assertEqual(first["entry"], "app.py")
            self.assertEqual(first["pages"], ["pages/01_Detail.py"])
            self.assertEqual(first["dependencies"], ["requirements.txt"])
            self.assertEqual(first["projectFingerprint"], second["projectFingerprint"])
            self.assertEqual(first["entry"], second["entry"])
            self.assertEqual(first["sourceArchive"], str(archive.resolve()))
            self.assertTrue(first["temporaryProject"])
            self.assertNotIn("project", first)
            self.assertEqual(cli_info["entry"], first["entry"])
            self.assertEqual(cli_info["projectFingerprint"], first["projectFingerprint"])
            self.assertEqual(
                set(pathlib.Path(tempfile.gettempdir()).glob("html-editor-streamlit-*")),
                temporary_directories_before,
            )

    def test_zip_rejects_unsafe_paths_duplicates_and_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            unsafe = {
                "parent": [("../escape.py", "x")],
                "absolute": [("/escape.py", "x")],
                "backslash": [(r"..\escape.py", "x")],
                "duplicate": [("app.py", "x"), ("./app.py", "y")],
            }
            for label, members in unsafe.items():
                archive = root / f"{label}.zip"
                self._write_zip(archive, members)
                with self.subTest(label=label):
                    with self.assertRaises(ValueError):
                        self.adapter.inspect_project(archive)

            symlink_archive = root / "symlink.zip"
            with zipfile.ZipFile(symlink_archive, "w") as bundle:
                entry = zipfile.ZipInfo("app.py")
                entry.create_system = 3
                entry.external_attr = (stat.S_IFLNK | 0o777) << 16
                bundle.writestr(entry, "../outside.py")
            with self.assertRaises(ValueError):
                self.adapter.inspect_project(symlink_archive)

    def test_zip_rejects_portability_aliases_and_unsafe_components(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            unsafe = {
                "case-alias": [("app.py", "x"), ("APP.py", "y")],
                "unicode-alias": [("café.py", "x"), ("cafe\u0301.py", "y")],
                "ads": [("folder/file:stream.py", "x")],
                "reserved": [("folder/aux.txt", "x")],
                "reserved-numbered": [("folder/COM9.log", "x")],
                "trailing-dot": [("folder./app.py", "x")],
                "trailing-space": [("folder /app.py", "x")],
                "control": [("folder/bad\u0001.py", "x")],
            }
            for label, members in unsafe.items():
                archive = root / f"{label}.zip"
                self._write_zip(archive, members, zipfile.ZIP_STORED)
                with self.subTest(label=label):
                    with self.assertRaisesRegex(ValueError, "ZIP"):
                        self.adapter.inspect_project(archive)

    def test_unix_directory_without_trailing_slash_supports_common_wrapper(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = pathlib.Path(directory) / "wrapped.zip"
            with zipfile.ZipFile(archive, "w") as bundle:
                wrapper = zipfile.ZipInfo("wrapped")
                wrapper.create_system = 3
                wrapper.external_attr = (stat.S_IFDIR | 0o755) << 16
                bundle.writestr(wrapper, b"")
                bundle.writestr("wrapped/app.py", "import streamlit\n")
                bundle.writestr(
                    "wrapped/pages/01_Detail.py", "import streamlit\n"
                )

            info = self.adapter.inspect_project(archive)
            self.assertEqual(info["entry"], "app.py")
            self.assertEqual(info["pages"], ["pages/01_Detail.py"])

    def test_zip_rejects_entry_count_size_total_and_compression_ratio(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            too_many = root / "too-many.zip"
            self._write_zip(too_many, [(f"files/{index}.txt", "") for index in range(2001)])
            with self.assertRaises(ValueError):
                self.adapter.inspect_project(too_many)

            too_large = root / "too-large.zip"
            self._write_zip(too_large, [("app.py", "x" * (10 * 1024 * 1024 + 1))], zipfile.ZIP_STORED)
            with self.assertRaises(ValueError):
                self.adapter.inspect_project(too_large)

            excessive_total = root / "total.zip"
            self._write_zip(excessive_total, [("app.py", "12345"), ("more.txt", "67890")], zipfile.ZIP_STORED)
            with mock.patch.object(self.adapter, "MAX_ARCHIVE_TOTAL_SIZE", 9):
                with self.assertRaises(ValueError):
                    self.adapter.inspect_project(excessive_total)

            ratio = root / "ratio.zip"
            self._write_zip(ratio, [("app.py", "x" * 100_000)])
            with self.assertRaises(ValueError):
                self.adapter.inspect_project(ratio)

    def test_launch_zip_uses_project_python_and_cleans_up_after_child_error(self):
        with tempfile.TemporaryDirectory() as directory:
            archive = pathlib.Path(directory) / "project.zip"
            with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_STORED) as bundle:
                bundle.writestr("app.py", "import streamlit\n")
                python_entry = zipfile.ZipInfo(".venv/bin/python")
                python_entry.create_system = 3
                python_entry.external_attr = (stat.S_IFREG | 0o755) << 16
                bundle.writestr(python_entry, "#!python\n")
            captured = {}
            inspected = self.adapter.inspect_project(archive)
            readiness_output = io.StringIO()

            def fail_child(command, cwd):
                captured["command"] = command
                captured["cwd"] = pathlib.Path(cwd)
                self.assertTrue(captured["cwd"].exists())
                emitted = json.loads(readiness_output.getvalue())
                self.assertEqual(emitted["pythonExecutable"], command[0])
                self.assertTrue(pathlib.Path(emitted["pythonExecutable"]).exists())
                raise RuntimeError("child failed")

            with mock.patch.object(self.adapter.subprocess, "run", side_effect=fail_child):
                with contextlib.redirect_stdout(readiness_output):
                    with self.assertRaisesRegex(RuntimeError, "child failed"):
                        self.adapter.launch(str(archive), port=8765)

            readiness = json.loads(readiness_output.getvalue())
            self.assertFalse(captured["cwd"].exists())
            self.assertIn(".venv/bin/python", captured["command"][0])
            self.assertEqual(readiness["entry"], inspected["entry"])
            self.assertEqual(
                readiness["projectFingerprint"], inspected["projectFingerprint"]
            )
            for field in ("pythonSource", "runtimeDigest", "runtimeScope"):
                self.assertEqual(readiness[field], inspected[field])


if __name__ == "__main__":
    unittest.main()
