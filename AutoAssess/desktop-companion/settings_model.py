"""Strict data-only configuration shared by the desktop form and HTTP bridge."""
from __future__ import annotations

import copy

PRESETS = {
    "outgoing_engineer": ("沟通外向 · 嵌入式工程师", {"E": 4, "A": 4, "C": 5, "S": 4, "O": 4}),
    "careful": ("沉稳严谨", {"E": 2, "A": 4, "C": 5, "S": 4, "O": 3}),
    "balanced": ("均衡协作", {"E": 3, "A": 4, "C": 4, "S": 3, "O": 3}),
    "custom": ("自定义偏好", {"E": 4, "A": 4, "C": 5, "S": 4, "O": 4}),
}
STRATEGIES = {"positive": "积极策略", "balanced": "平衡策略", "random": "随机策略", "strict": "严格匹配"}
TRAITS = {"E": "外向沟通", "A": "合作体谅", "C": "条理尽责", "S": "情绪稳定", "O": "开放探索"}
SELECTORS = {"question": "题目容器", "stem": "容器内题干", "option": "可点击选项", "next": "下一题按钮",
             "pairItem": "迫选描述行 / 卡片", "pairMost": "最符合控件", "pairLeast": "最不符合控件"}
DEFAULTS = {"mode": "manual", "dwellSec": 5, "autoNext": True, "personalityPreset": "outgoing_engineer",
            "personalityStrategy": "positive", "personalityTraits": {}, "personalityRanking": "",
            "personalityAnswers": "", "selectors": {key: "" for key in SELECTORS}}
LABELS = {"mode": "填写方式", "dwellSec": "停留时间", "autoNext": "自动继续", "personalityPreset": "性格预设",
          "personalityStrategy": "答题策略", "personalityTraits": "五项倾向", "personalityRanking": "描述排序",
          "personalityAnswers": "个人答案", "selectors": "页面适配"}


class SettingsError(ValueError):
    pass


def default_settings():
    return copy.deepcopy(DEFAULTS)


def checked_text(value, limit, label):
    if not isinstance(value, str) or len(value) > limit:
        raise SettingsError(f"{label}须为不超过 {limit} 字符的文字")
    try:
        value.encode("utf-8")
    except UnicodeError:
        raise SettingsError(f"{label}包含无效字符") from None
    return value


def checked_settings(payload, partial=False):
    if not isinstance(payload, dict):
        raise SettingsError("配置须为对象")
    unknown = set(payload) - set(DEFAULTS)
    if unknown:
        # repr also escapes invalid surrogate field names before an HTTP error
        # response is encoded as UTF-8.
        raise SettingsError("配置包含不支持的字段：" + "、".join(sorted(repr(key)[:80] for key in unknown)))
    if partial and not payload:
        raise SettingsError("请至少提供一项配置")
    result = {} if partial else default_settings()
    for key, value in payload.items():
        label = LABELS[key]
        if key == "mode":
            if not isinstance(value, str) or value not in {"manual", "auto"}:
                raise SettingsError("填写方式须为手动辅助或自动填写")
        elif key == "dwellSec":
            if type(value) is not int or not 1 <= value <= 120:
                raise SettingsError("停留时间须为 1–120 秒整数")
        elif key == "autoNext":
            if type(value) is not bool:
                raise SettingsError("自动继续须为布尔值")
        elif key in {"personalityPreset", "personalityStrategy"}:
            choices = PRESETS if key == "personalityPreset" else STRATEGIES
            if not isinstance(value, str) or value not in choices:
                raise SettingsError(f"{label}无效")
        elif key == "personalityTraits":
            if not isinstance(value, dict) or set(value) - set(TRAITS):
                raise SettingsError("五项倾向只允许 E、A、C、S、O")
            for axis, level in value.items():
                if type(level) is not int or not 1 <= level <= 5:
                    raise SettingsError(f"{TRAITS[axis]}须为 1–5 整数")
            value = dict(value)
        elif key in {"personalityRanking", "personalityAnswers"}:
            value = checked_text(value, 20000 if key == "personalityRanking" else 30000, label)
        elif key == "selectors":
            if not isinstance(value, dict) or set(value) - set(SELECTORS):
                raise SettingsError("页面适配包含不支持的字段")
            value = {name: checked_text(selector, 2000, SELECTORS[name]) for name, selector in value.items()}
            if not partial:
                value = {**DEFAULTS["selectors"], **value}
        result[key] = copy.deepcopy(value)
    return result


def should_load_settings(*, connected, dirty, revision, loaded_revision, binding_changed=False, confirmed=False):
    """A live update never overwrites a draft; explicit acknowledgement can clear it."""
    return bool(connected and (binding_changed or confirmed or (not dirty and revision != loaded_revision)))
