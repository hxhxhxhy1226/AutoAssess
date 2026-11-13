"""Build a checked AutoAssess runtime ZIP from the current source tree."""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import hashlib
import json
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import unquote, urlsplit
import zipfile

from project_checks import BANK_FILES, DESKTOP, PLUGIN, ROOT, manifest, require_python, validate_banks

DESKTOP_FILES = ("main.py", "bridge_server.py", "capture.py", "launch.py", "settings_model.py",
                 "tray.py", "启动桌面助手.cmd", "start.ps1", "README.md")
PLUGIN_CORE = ("shared.js", "personality.js", "personality-data.js", "personality-open-data.js",
               "adapter.js", "pair-adapter.js", "personality-shl-adapter.js",
               "personality-disc-adapter.js", "personality-matrix-adapter.js", "desktop-bridge.js",
               "desktop-settings.js", "content.js", "loader.js")
ROOT_DOCUMENTS = ("README.md", "LICENSE", "LICENSE.md", "LICENSE.txt", "NOTICE", "NOTICE.md",
                  "THIRD_PARTY_NOTICES.md")


class References(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {"src", "href"} and value:
                self.values.append(value)


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def collect_files() -> dict[str, Path]:
    files = {}

    def add(path: Path) -> None:
        if not path.is_file():
            raise FileNotFoundError(f"Missing release file: {path.relative_to(ROOT)}")
        if not path.resolve().is_relative_to(ROOT.resolve()):
            raise ValueError(f"Release file resolves outside the repository: {path.relative_to(ROOT)}")
        files[path.relative_to(ROOT).as_posix()] = path

    for path in PLUGIN.iterdir():
        if path.is_file() and path.suffix in {".js", ".html", ".css"}:
            add(path)
    add(PLUGIN / "manifest.json")
    for name in ("README.md", "THIRD_PARTY_NOTICES.md", "QUESTION_BANK_SCHEMA.md"):
        if (PLUGIN / name).is_file():
            add(PLUGIN / name)
    for filename in BANK_FILES:
        add(PLUGIN / "question-bank" / filename)
    for filename in ("bigfive-LICENSE", "beisen-LICENSE"):
        add(PLUGIN / "vendor" / filename)
    for folder in ("icons", "question-bank/assets"):
        base = PLUGIN / folder
        if base.is_dir():
            for path in sorted(base.rglob("*")):
                if path.is_file() and not any(part.startswith(".") or part == "__pycache__"
                                              for part in path.relative_to(base).parts):
                    allowed = {".png", ".ico"} if folder == "icons" else {".png", ".jpg", ".jpeg", ".webp", ".gif"}
                    if path.suffix.lower() not in allowed:
                        continue
                    add(path)
    for filename in DESKTOP_FILES:
        add(DESKTOP / filename)
    for path in sorted((DESKTOP / "assets").rglob("*")):
        if path.is_file() and path.suffix.lower() in {".ico", ".png"}:
            add(path)
    for filename in ROOT_DOCUMENTS:
        if (ROOT / filename).is_file():
            add(ROOT / filename)
    for path in sorted((ROOT / "docs").rglob("*")) if (ROOT / "docs").is_dir() else []:
        if path.is_file() and path.suffix.lower() in {".md", ".svg", ".png", ".jpg", ".webp"}:
            add(path)
    return files


def check_references(files: dict[str, Path], metadata: dict) -> None:
    required = {"assessment-plugin/" + filename for filename in PLUGIN_CORE}
    required.update({"desktop-companion/assets/gear.ico", "assessment-plugin/vendor/bigfive-LICENSE",
                     "assessment-plugin/vendor/beisen-LICENSE"})

    def add_manifest(value) -> None:
        if isinstance(value, str):
            required.add("assessment-plugin/" + value)
        elif isinstance(value, dict):
            for entry in value.values():
                add_manifest(entry)

    add_manifest(metadata.get("icons", {}))
    action = metadata.get("action", {})
    add_manifest(action.get("default_icon", {}))
    add_manifest(action.get("default_popup"))
    add_manifest(metadata.get("background", {}).get("service_worker"))
    add_manifest(metadata.get("options_ui", {}).get("page"))
    for content in metadata.get("content_scripts", []):
        for value in content.get("js", []) + content.get("css", []):
            add_manifest(value)

    def check_local(path: Path, value: str) -> None:
        parsed = urlsplit(value)
        if parsed.scheme or parsed.netloc or not parsed.path:
            return
        relative = unquote(parsed.path)
        target = ((PLUGIN / relative.lstrip("/")) if relative.startswith("/") else path.parent / relative).resolve()
        if not target.is_relative_to(PLUGIN.resolve()):
            raise ValueError(f"Resource escapes extension directory: {path.name}: {value}")
        required.add(target.relative_to(ROOT.resolve()).as_posix())

    for name, path in files.items():
        if not name.startswith("assessment-plugin/"):
            continue
        if path.suffix == ".html":
            parser = References()
            parser.feed(path.read_text(encoding="utf-8"))
            for value in parser.values:
                check_local(path, value)
        elif path.suffix == ".css":
            for value in re.findall(r"url\(\s*['\"]?([^)'\"]+)['\"]?\s*\)", path.read_text(encoding="utf-8")):
                check_local(path, value.strip())
        elif path.suffix == ".js":
            for call in re.findall(r"importScripts\(([^)]*)\)", path.read_text(encoding="utf-8")):
                for value in re.findall(r"['\"]([^'\"]+)['\"]", call):
                    check_local(path, value)
    missing = sorted(required - files.keys())
    if missing:
        raise ValueError("Missing packaged resources: " + ", ".join(missing))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist")
    args = parser.parse_args()
    require_python()
    metadata = manifest()
    banks = validate_banks()
    files = collect_files()
    check_references(files, metadata)
    output = args.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    archive_path = output / f"autoassess-v{metadata['version']}.zip"
    contents = {name: path.read_bytes() for name, path in sorted(files.items())}
    with tempfile.NamedTemporaryFile(prefix=".autoassess-", suffix=".zip", dir=output, delete=False) as staging:
        staging_path = Path(staging.name).resolve()
    if staging_path.parent != output or archive_path.resolve().parent != output:
        raise ValueError("Invalid release output path.")
    try:
        with zipfile.ZipFile(staging_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name, content in contents.items():
                info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, content, compresslevel=9)
        with zipfile.ZipFile(staging_path) as archive:
            if archive.testzip() is not None or set(archive.namelist()) != contents.keys():
                raise ValueError("ZIP integrity check failed.")
            for name, content in contents.items():
                if archive.read(name) != content:
                    raise ValueError(f"Bundled bytes differ from source: {name}")
            forbidden = (".archive/", ".review/", "__pycache__/", "/tests/", "node_modules/")
            if any(any(part in name for part in forbidden) or name.endswith((".log", ".pyc"))
                   for name in archive.namelist()):
                raise ValueError("A non-runtime file entered the release archive.")
        # Replace a prior release only once its replacement has been checked.
        staging_path.replace(archive_path)
    finally:
        if staging_path.exists():
            staging_path.unlink()
    report = {"project": "AutoAssess", "version": metadata["version"], "files": len(contents),
              "bytes": archive_path.stat().st_size, "sha256": digest(archive_path.read_bytes()),
              "question_count": banks["total"], "integrity": "passed",
              "file_sha256": {name: digest(content) for name, content in contents.items()}}
    report_path = archive_path.with_suffix(".json")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Built {archive_path.name}: {len(contents)} files, {banks['total']} questions, {report['bytes']} bytes")
    print(f"SHA-256 {report['sha256']}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, zipfile.BadZipFile) as error:
        print(f"Build failed: {error}", file=sys.stderr)
        raise SystemExit(1)
