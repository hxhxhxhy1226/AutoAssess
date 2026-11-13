"""Read-only question-bank validation, including optional reviewed answers."""
import argparse
from collections import Counter
import json
import hashlib
from pathlib import Path
import re


def validate(path):
    path = Path(path).resolve()
    payload = json.loads(path.read_text(encoding="utf-8"))
    errors, warnings, seen, signatures = [], [], set(), Counter()
    if not isinstance(payload, dict) or not isinstance(payload.get("questions"), list):
        return {"errors": ["顶层必须包含 questions 数组"], "warnings": [], "count": 0}
    questions = payload["questions"]
    types = Counter()
    image_count = reviewed = references = usable_references = 0
    categories, file_hashes = Counter(), {}
    for i, q in enumerate(questions):
        if not isinstance(q, dict): errors.append(f"第 {i + 1} 题必须是对象"); continue
        qid = q.get("qid")
        if not isinstance(qid, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,120}", qid):
            errors.append(f"第 {i + 1} 题 qid 无效"); continue
        if qid in seen: errors.append(f"重复 qid：{qid}")
        seen.add(qid)
        if not isinstance(q.get("stem"), str): errors.append(f"{qid} 题干必须是字符串")
        if not q.get("type") and not q.get("expected_type"): errors.append(f"{qid} 缺少题型")
        types[q.get("type") or q.get("expected_type")] += 1
        categories[q.get('category', 'original')] += 1
        opts = q.get("options")
        if not isinstance(opts, list): errors.append(f"{qid} options 必须是数组"); continue
        keys = []
        media = list(q['stimuli']) if isinstance(q.get('stimuli'), list) else [q.get("stimulus")]
        if q.get('stimuli') is not None and not isinstance(q['stimuli'], list): errors.append(f"{qid} stimuli 必须是数组")
        if q.get('stimulus') and isinstance(q.get('stimuli'), list) and (not q['stimuli'] or q['stimulus'] != q['stimuli'][0]): errors.append(f"{qid} 首图兼容字段不一致")
        for o in opts:
            if not isinstance(o, dict) or not isinstance(o.get("key"), str) or not o["key"]:
                errors.append(f"{qid} 的选项 key 无效"); continue
            keys.append(o["key"]); media.append(o.get("media"))
        if len(keys) != len(set(keys)): errors.append(f"{qid} 选项 key 重复")
        media = [m for m in media if m]
        image_count += bool(media)
        for m in media:
            if not isinstance(m, dict): errors.append(f"{qid} 图片字段无效"); continue
            src = m.get("src", "")
            if m.get("kind") != "image" or not isinstance(src, str) or not re.fullmatch(r"assets/(?:[\w-]+/)*[\w.-]+\.(?:png|jpe?g|webp|gif)", src, re.I) or ".." in src:
                errors.append(f"{qid} 图片路径无效：{src!r}"); continue
            target = (path.parent / src).resolve()
            if not target.is_relative_to(path.parent) or not target.is_file(): errors.append(f"{qid} 图片不存在：{src}")
            digest = m.get('sha256')
            if digest and digest != 'synthetic-self-made':
                if not isinstance(digest, str) or not re.fullmatch(r'[a-fA-F0-9]{64}', digest): errors.append(f"{qid} 图片哈希无效：{src}")
                elif target.is_file():
                    if target not in file_hashes: file_hashes[target] = hashlib.sha256(target.read_bytes()).hexdigest()
                    if file_hashes[target] != digest.lower(): errors.append(f"{qid} 图片内容哈希不符：{src}")
            if not isinstance(m.get("alt"), str) or not m["alt"].strip(): errors.append(f"{qid} 图片缺少说明")
        answer = q.get("answer")
        if answer is not None:
            reference = isinstance(answer, dict) and answer.get('kind') == 'reference'
            unavailable = reference and answer.get('usable') is False and q.get('quality', {}).get('usable') is False
            if reference:
                references += 1
                if answer.get('verified') is not False: errors.append(f"{qid} 来源参考答案不能标为人工核对")
                if unavailable: warnings.append(f"{qid} 来源资料待补全，已停用自动匹配")
            if not isinstance(answer, dict) or not isinstance(answer.get("keys"), list) or not answer["keys"]:
                errors.append(f"{qid} answer 需要非空 keys 数组")
            elif not unavailable and (any(k not in keys for k in answer["keys"]) or len(answer["keys"]) != len(set(answer["keys"]))):
                errors.append(f"{qid} answer 包含无效或重复选项")
            elif q.get("type") != "multi_choice" and len(answer["keys"]) != 1:
                errors.append(f"{qid} 单选题不能有多个答案")
            elif answer.get("verified") is True:
                reviewed += 1
                if not answer.get("explanation"): warnings.append(f"{qid} 已核对答案缺少解析")
            elif reference and answer.get('usable') is True:
                usable_references += 1
                if not q.get('stem', '').strip() or len(opts) < 2 or q.get('quality', {}).get('usable') is False: errors.append(f"{qid} 不完整记录不能标为可用")
        signatures[json.dumps([q.get("stem"), media, opts], ensure_ascii=False, sort_keys=True)] += 1
    return {"count": len(questions), "types": dict(types), "image_questions": image_count, "reviewed_answers": reviewed,
            "reference_answers": references, "usable_reference_answers": usable_references, "categories": dict(categories),
            "duplicate_content": sum(n - 1 for n in signatures.values() if n > 1), "errors": errors, "warnings": warnings}


def main():
    parser = argparse.ArgumentParser(description="只读校验题库结构、图片、重复记录和已核对答案")
    parser.add_argument("path", nargs="?", default=str(Path(__file__).with_name("questions.json")))
    args = parser.parse_args()
    path = Path(args.path)
    if not path.is_absolute() and not path.exists(): path = Path(__file__).parent / path
    result = validate(path)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    print("RESULT:", "FAIL" if result["errors"] else "PASS")
    raise SystemExit(bool(result["errors"]))


if __name__ == "__main__": main()
