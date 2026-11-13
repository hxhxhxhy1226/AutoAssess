"""Generate the local IPIP preference-practice bank from pinned source literals.

Run from assessment-plugin:
    python -B -X utf8 question-bank/import_personality_open.py

The source TypeScript is parsed as constrained data; it is never imported or
executed. This script preserves source wording and choices, adapts only the
displayed response labels, and generates the append-only runtime metadata from
the resulting JSON bank. It does not modify personality-data.js or questions.json.
"""
from __future__ import annotations

import argparse
import ast
from collections import Counter
import hashlib
import json
from pathlib import Path
import re


BANK_DIR = Path(__file__).resolve().parent
PLUGIN = BANK_DIR.parent
WORKSPACE = PLUGIN.parent
REPOSITORY = "https://github.com/rubynor/bigfive-web"
COMMIT = "e8f3caca49edafb9bc6b927eff7fbc1264312c24"
RAW_BASE = f"https://raw.githubusercontent.com/rubynor/bigfive-web/{COMMIT}/"
QUESTION_PATH = "packages/questions/src/data/zh-cn/questions.ts"
CHOICES_PATH = "packages/questions/src/data/zh-cn/choices.ts"
PINNED = {
    QUESTION_PATH: "b0c9c6847f99e9c16ada3a11a30181eaf6576848958f1b384436ec12e87bed78",
    CHOICES_PATH: "2e81707f541403a677617b764b3b8e16e6233af634d82d5a39d1a641f0b2a0a9",
    "LICENSE": "6e569c7596b65e56abf12d4494a26b582c0c966c29f2437a13bf16415cda6ca8",
}
LABELS = ["非常不符合", "不符合", "一般", "符合", "非常符合"]
AXIS_NAMES = {"E": "外向沟通", "A": "合作体谅", "C": "条理尽责", "S": "情绪稳定", "O": "开放探索"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".part")
    temporary.write_bytes(data)
    temporary.replace(path)


def json_bytes(data: object) -> bytes:
    return (json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def pinned_source(directory: Path, relative: str) -> bytes:
    filename = "rubynor__bigfive-web__" + relative.replace("/", "__")
    path = directory / filename
    content = path.read_bytes()
    if sha256(content) != PINNED[relative]:
        raise ValueError(f"Source snapshot does not match pinned commit/hash: {path}")
    return content


def parse_questions(source: str) -> list[dict]:
    literal = r"('(?:\\.|[^'\\])*')"
    pattern = (r"\{\s*id:\s*" + literal + r",\s*text:\s*" + literal
               + r",\s*keyed:\s*'(plus|minus)',\s*domain:\s*'([NEOAC])',\s*facet:\s*([1-6])\s*\}")
    matches = re.findall(pattern, source)
    if len(matches) != 120 or len(matches) != len(re.findall(r"\bid:", source)):
        raise ValueError("Expected exactly 120 complete, recognized source item literals")
    items = [{"id": ast.literal_eval(identifier), "text": ast.literal_eval(text),
              "keyed": keyed, "domain": domain, "facet": int(facet)}
             for identifier, text, keyed, domain, facet in matches]
    if len({item["id"] for item in items}) != 120 or len({item["text"] for item in items}) != 120:
        raise ValueError("Source item IDs or text are duplicated")
    if Counter(item["domain"] for item in items) != Counter({axis: 24 for axis in "NEOAC"}):
        raise ValueError("Unexpected source domain distribution")
    if any(count != 4 for count in Counter((item["domain"], item["facet"]) for item in items).values()):
        raise ValueError("Expected four items per source domain/facet")
    return items


def parse_choices(source: str) -> dict[str, list[dict]]:
    result = {}
    for keyed, body in re.findall(r"(plus|minus):\s*\[([\s\S]*?)\]", source):
        rows = re.findall(r"\{\s*text:\s*('(?:\\.|[^'\\])*'),\s*score:\s*([1-5]),\s*color:\s*([1-5])\s*\}", body)
        result[keyed] = [{"text": ast.literal_eval(text), "score": int(score), "color": int(color)}
                         for text, score, color in rows]
    if set(result) != {"plus", "minus"} or any(len(rows) != 5 for rows in result.values()):
        raise ValueError("Expected both five-choice source score directions")
    for keyed, scores in (("plus", [1, 2, 3, 4, 5]), ("minus", [5, 4, 3, 2, 1])):
        if [row["score"] for row in result[keyed]] != scores:
            raise ValueError("Unexpected source response score direction")
        if [row["color"] for row in result[keyed]] != [1, 2, 3, 4, 5]:
            raise ValueError("Unexpected source response order")
    return result


def make_bank(items: list[dict], choices: dict[str, list[dict]]) -> dict:
    questions = []
    for number, item in enumerate(items, 1):
        axis = "S" if item["domain"] == "N" else item["domain"]
        positive = (item["keyed"] == "minus") if item["domain"] == "N" else (item["keyed"] == "plus")
        source_options = choices[item["keyed"]]
        # For every possible response, the mapped axis direction must equal
        # the original score (or 6-score for N -> emotional stability).
        for response, source_choice in enumerate(source_options, 1):
            mapped = response if positive else 6 - response
            expected = 6 - source_choice["score"] if item["domain"] == "N" else source_choice["score"]
            if mapped != expected:
                raise ValueError("Axis direction disagrees with source keyed scores: " + item["id"])
        questions.append({
            "qid": "ipip-neo-" + item["id"],
            "bankId": "ipip-neo-120",
            "category": "personality",
            "type": "likert",
            "title": f"IPIP 自评 {number:03d} · {AXIS_NAMES[axis]}",
            "stem": item["text"],
            "options": [{"key": chr(65 + index), "text": label} for index, label in enumerate(LABELS)],
            "sourceOptions": [dict(choice) for choice in source_options],
            "personalityRule": {"axis": axis, "positive": positive},
            "sourceQuestionId": item["id"],
            "sourceDomain": item["domain"],
            "keyed": item["keyed"],
            "facet": item["facet"],
            "provenance": {
                "repository": REPOSITORY,
                "commit": COMMIT,
                "sourceUrl": RAW_BASE + QUESTION_PATH,
                "sourceSha256": PINNED[QUESTION_PATH],
                "choicesSourceUrl": RAW_BASE + CHOICES_PATH,
                "choicesSha256": PINNED[CHOICES_PATH],
                "license": "MIT",
                "licenseFile": "vendor/bigfive-LICENSE",
                "translationCredit": "Roy Jia (credited by the source package README)",
                "adaptation": "保留中文题文与原始sourceOptions；将显示选项改为五级符合程度，仅用于偏好练习。N反向映射为情绪稳定S，不提供原版计分诊断或标准正确答案。",
            },
        })
    return {
        "bankId": "ipip-neo-120",
        "site": "local-personality-practice",
        "schema_version": 2,
        "source": {
            "name": "IPIP-NEO-120 中文 · 离线偏好练习",
            "kind": "adapted-open-personality-items",
            "repository": REPOSITORY,
            "commit": COMMIT,
            "license": "MIT",
            "copyright": "Copyright (c) 2024 B5 Holding AS",
            "licenseFile": "vendor/bigfive-LICENSE",
            "ipipPermissionUrl": "https://ipip.ori.org/newPermission.htm",
            "adaptation": "题目原文保持不变；本机使用五级符合程度选项，原标签、分数和次序保留在sourceOptions。记录反映用户设定的偏好，不代表标准正确答案，不输出原版量表诊断或招聘结论。",
            "domainMapping": {"N": "S", "E": "E", "O": "O", "A": "A", "C": "C"},
            "directionMapping": "For N, positive iff keyed=minus; for E/O/A/C, positive iff keyed=plus.",
        },
        "questions": questions,
    }


def metadata_script(bank_path: Path) -> bytes:
    # Read the emitted bank, so runtime metadata is generated from the same
    # artifact as the local practice page rather than a second hand-edited list.
    bank = json.loads(bank_path.read_text(encoding="utf-8"))
    rows = [{"qid": question["qid"], "stem": question["stem"], **question["personalityRule"]}
            for question in bank["questions"]]
    serialized = json.dumps(rows, ensure_ascii=False, indent=2).replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    source = """// Generated from question-bank/personality-open.json by import_personality_open.py.
// MIT source attribution: vendor/bigfive-LICENSE. These are preference rules,
// not correct-answer keys. Existing metadata is preserved; repeated loads are safe.
(function (root) {
  'use strict';
  const additions = __ROWS__;
  const existing = Array.isArray(root.AssessmentPersonalityData) ? root.AssessmentPersonalityData : [];
  const byId = new Map(existing.map(row => [row.qid, row]));
  const appended = [];
  for (const row of additions) {
    const previous = byId.get(row.qid);
    if (previous) {
      if (previous.stem !== row.stem || previous.axis !== row.axis || previous.positive !== row.positive) {
        throw Error('Conflicting IPIP preference metadata: ' + row.qid);
      }
      continue;
    }
    byId.set(row.qid, row);
    appended.push(row);
  }
  root.AssessmentPersonalityData = [...existing, ...appended];
})(globalThis);
""".replace("__ROWS__", serialized)
    return source.encode("utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=PLUGIN / "vendor" / "bigfive-source")
    args = parser.parse_args()
    raw_questions = pinned_source(args.sources, QUESTION_PATH)
    raw_choices = pinned_source(args.sources, CHOICES_PATH)
    license_bytes = pinned_source(args.sources, "LICENSE")
    items = parse_questions(raw_questions.decode("utf-8"))
    choices = parse_choices(raw_choices.decode("utf-8"))
    bank = make_bank(items, choices)
    bank_path = BANK_DIR / "personality-open.json"
    js_path = PLUGIN / "personality-open-data.js"
    license_path = PLUGIN / "vendor" / "bigfive-LICENSE"
    atomic_write(bank_path, json_bytes(bank))
    atomic_write(js_path, metadata_script(bank_path))
    atomic_write(license_path, license_bytes)
    questions = bank["questions"]
    assert len(questions) == 120 and all("answer" not in question for question in questions)
    assert all(question["stem"] == item["text"] for question, item in zip(questions, items))
    report = {
        "repository": REPOSITORY, "commit": COMMIT,
        "questions": len(questions), "source_domains": dict(Counter(item["domain"] for item in items)),
        "source_keyed": dict(Counter(item["keyed"] for item in items)),
        "local_axes": dict(Counter(question["personalityRule"]["axis"] for question in questions)),
        "local_positive": dict(Counter(str(question["personalityRule"]["positive"]).lower() for question in questions)),
        "source_score_direction_checks": len(questions) * 5,
        "standard_answer_fields": 0,
        "artifacts": [{"path": str(path), "sha256": sha256(path.read_bytes()), "bytes": path.stat().st_size}
                      for path in (bank_path, js_path, license_path)],
        "preserved_files": ["question-bank/questions.json", "personality-data.js"],
    }
    atomic_write(WORKSPACE / "build" / "personality-open" / "conversion-report.json", json_bytes(report))
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
