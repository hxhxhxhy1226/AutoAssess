"""Shared, repository-relative checks for AutoAssess developer tools."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "assessment-plugin"
DESKTOP = ROOT / "desktop-companion"
BANK_FILES = ("questions.json", "personality-open.json")


def require_python() -> None:
    if sys.version_info < (3, 10):
        raise RuntimeError("Python 3.10 or newer is required.")


def manifest() -> dict:
    value = json.loads((PLUGIN / "manifest.json").read_text(encoding="utf-8"))
    version = value.get("version", "")
    if value.get("manifest_version") != 3:
        raise ValueError("The release builder expects a Manifest V3 extension.")
    if not isinstance(version, str) or not re.fullmatch(r"\d+(?:\.\d+){0,3}", version):
        raise ValueError("manifest.json must contain a numeric Chrome extension version.")
    if any(int(part) > 65535 for part in version.split(".")):
        raise ValueError("Manifest version components must not exceed 65535.")
    return value


def validate_banks() -> dict:
    validator_path = PLUGIN / "question-bank" / "_validate.py"
    spec = importlib.util.spec_from_file_location("autoassess_bank_validator", validator_path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Cannot load the question-bank validator.")
    validator = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(validator)
    results = {}
    all_ids = set()
    for filename in BANK_FILES:
        path = PLUGIN / "question-bank" / filename
        result = validator.validate(path)
        if result["errors"]:
            raise ValueError(f"{filename}: " + "; ".join(result["errors"]))
        payload = json.loads(path.read_text(encoding="utf-8"))
        for question in payload["questions"]:
            identity = question["qid"]
            if identity in all_ids:
                raise ValueError(f"Question ID appears in more than one bank: {identity}")
            all_ids.add(identity)
            if question.get("category") in {"verbal", "data", "graph"}:
                raise ValueError(f"Retired objective-question category in {filename}: {identity}")
        results[filename] = result
    return {"total": sum(result["count"] for result in results.values()), "banks": results}
