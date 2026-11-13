"""Run current, non-GUI project checks without historical releases or local paths."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time

from project_checks import DESKTOP, PLUGIN, ROOT, require_python, validate_banks


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def run_check(name: str, command: list[str], directory: Path) -> dict:
    started = time.monotonic()
    env = {**os.environ, "PYTHONUTF8": "1", "PYTHONDONTWRITEBYTECODE": "1"}
    completed = subprocess.run(command, cwd=ROOT, env=env, capture_output=True,
                               text=True, encoding="utf-8", errors="replace", timeout=180)
    (directory / f"{name}.stdout.log").write_text(completed.stdout, encoding="utf-8")
    (directory / f"{name}.stderr.log").write_text(completed.stderr, encoding="utf-8")
    output = completed.stdout + completed.stderr
    count = re.search(r"(?:\btests |\bRan )(\d+)", output)
    record = {"name": name, "status": "passed" if completed.returncode == 0 else "failed",
              "exit_code": completed.returncode, "seconds": round(time.monotonic() - started, 3)}
    if count:
        record["tests"] = int(count.group(1))
    print(f"{'PASS' if completed.returncode == 0 else 'FAIL'} {name}"
          + (f" ({record['tests']} tests)" if "tests" in record else ""), flush=True)
    if completed.returncode:
        print(output, end="" if output.endswith("\n") else "\n", file=sys.stderr)
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--skip-desktop-tests", action="store_true",
                        help="Run core checks only; omit Python desktop tests that import tkinter.")
    parser.add_argument("--report-dir", type=Path, default=ROOT / "build" / "verification",
                        help="Directory for ignored local verification logs.")
    args = parser.parse_args()
    require_python()
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js 20 or newer is required; 'node' was not found on PATH.")
    version = subprocess.run([node, "--version"], check=True, capture_output=True,
                             text=True, encoding="utf-8", timeout=10).stdout.strip()
    match = re.match(r"v(\d+)\.", version)
    if not match or int(match.group(1)) < 20:
        raise RuntimeError(f"Node.js 20 or newer is required (found {version!r}).")
    if not args.skip_desktop_tests:
        try:
            import tkinter  # noqa: F401 — importing creates no window.
        except ImportError as error:
            raise RuntimeError("Full desktop tests require Python with Tcl/Tk support. "
                               "Use --skip-desktop-tests only when intentionally running core checks.") from error

    directory = args.report_dir.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    results = []
    report = {"scope": "core" if args.skip_desktop_tests else "full-non-gui",
              "native_gui_executed": False, "results": results, "passed": False}

    def save() -> None:
        (directory / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2)
                                               + "\n", encoding="utf-8")

    node_files = sorted((PLUGIN / "tests").glob("*.test.js"))
    if not node_files:
        raise RuntimeError("No current extension tests were found.")
    commands = [("javascript", [node, "--test", *[relative(path) for path in node_files]])]
    if not args.skip_desktop_tests:
        commands.append(("desktop-python", [sys.executable, "-B", "-X", "utf8", "-m", "unittest",
                                             "discover", "-s", relative(DESKTOP / "tests"), "-v"]))
    else:
        print("SKIP desktop-python (explicit core-only scope)", flush=True)
    commands.append(("loopback", [sys.executable, "-B", "-X", "utf8", "tools/test_wire.py",
                                  "--report", str(directory / "loopback.json")]))
    save()
    for name, command in commands:
        record = run_check(name, command, directory)
        results.append(record)
        save()
        if record["exit_code"]:
            return record["exit_code"]
    banks = validate_banks()
    report["question_banks"] = banks
    results.append({"name": "question-banks", "status": "passed", "questions": banks["total"]})
    report["passed"] = True
    save()
    print(f"PASS question-banks ({banks['total']} questions)")
    print(f"PASS {report['scope']} verification; no browser, native window, or tray was launched.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print(f"Verification failed: {error}", file=sys.stderr)
        raise SystemExit(1)
