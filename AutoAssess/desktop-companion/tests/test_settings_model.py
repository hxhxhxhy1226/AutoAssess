from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from settings_model import SettingsError, checked_settings, default_settings
from bridge_server import BridgeState, BridgeError
from main import SettingsDraft


def connected(settings=None):
    state = BridgeState()
    payload = {"clientId": "settings-test", "tab": {"id": 7, "title": "配置样例"}, "version": "0.5.1"}
    if settings is not None:
        payload["settings"] = settings
    state.connect(payload)
    return state


def exchange(settings=None, **kwargs):
    value = {"clientId": "settings-test", "snapshot": {"mode": "manual", "dwellSec": 5}, **kwargs}
    if settings is not None:
        value["settings"] = settings
    return value


class SettingsValidationTests(unittest.TestCase):
    def test_defaults_are_complete_independent_values(self):
        one = checked_settings({})
        self.assertEqual(one, default_settings())
        self.assertEqual(set(one["selectors"]), {"question", "stem", "option", "next", "pairItem", "pairMost", "pairLeast"})
        one["selectors"]["question"] = "changed"
        self.assertEqual(default_settings()["selectors"]["question"], "")

    def test_full_configuration_preserves_unicode_rules_and_all_fields(self):
        value = {**default_settings(), "mode": "auto", "dwellSec": 20, "autoNext": False,
                 "personalityPreset": "custom", "personalityStrategy": "strict", "personalityTraits": {"E": 1, "C": 5},
                 "personalityRanking": "善于沟通\n有计划", "personalityAnswers": "题干 => 选项",
                 "selectors": {"question": ".题组", "pairMost": "[data-role=most]"}}
        result = checked_settings(value)
        self.assertEqual(result["personalityAnswers"], value["personalityAnswers"])
        self.assertEqual(result["selectors"]["stem"], "")
        self.assertEqual(result["personalityTraits"], {"E": 1, "C": 5})

    def test_partial_settings_do_not_reset_omitted_preferences(self):
        self.assertEqual(checked_settings({"mode": "auto"}, partial=True), {"mode": "auto"})
        self.assertEqual(checked_settings({"selectors": {"next": "button.next"}}, partial=True), {"selectors": {"next": "button.next"}})
        with self.assertRaises(SettingsError):
            checked_settings({}, partial=True)

    def test_unknown_fields_and_wrong_types_are_rejected(self):
        cases = [{"apiKey": "secret"}, {"mode": []}, {"dwellSec": True}, {"dwellSec": 121}, {"autoNext": 1},
                 {"personalityPreset": "none"}, {"personalityStrategy": False}, {"personalityTraits": {"X": 3}},
                 {"personalityTraits": {"E": 1.5}}, {"personalityTraits": {"E": True}}, {"selectors": {"script": "x"}},
                 {"selectors": {"question": 1}}, {"personalityAnswers": "\ud800"}, {"\ud800": "invalid field"}]
        for value in cases:
            with self.subTest(value=value), self.assertRaises(SettingsError):
                checked_settings(value)

        try:
            checked_settings({"\ud800": "invalid field"})
        except SettingsError as error:
            str(error).encode("utf-8")

    def test_rule_and_selector_lengths_are_bounded(self):
        for value in [{"personalityRanking": "x" * 20001}, {"personalityAnswers": "x" * 30001}, {"selectors": {"next": "x" * 2001}}]:
            with self.assertRaises(SettingsError):
                checked_settings(value)


class SettingsStateTests(unittest.TestCase):
    def test_connect_and_exchange_keep_full_settings_with_change_only_revision(self):
        state = connected(default_settings())
        initial = state.view()["settings_revision"]
        state.exchange(exchange())
        self.assertEqual(state.view()["settings"], default_settings())
        state.exchange(exchange(default_settings()))
        self.assertEqual(state.view()["settings_revision"], initial)
        changed = {**default_settings(), "dwellSec": 17}
        state.exchange(exchange(changed))
        self.assertEqual(state.view()["settings_revision"], initial + 1)
        self.assertEqual(state.view()["settings"]["dwellSec"], 17)

    def test_bad_settings_do_not_replace_snapshot_or_settings(self):
        state = connected(default_settings())
        state.exchange(exchange())
        before = state.view()
        with self.assertRaises(BridgeError):
            state.exchange(exchange({"dwellSec": False}, snapshot={"status": "must not persist"}))
        self.assertEqual(state.view()["snapshot"], before["snapshot"])
        self.assertEqual(state.view()["settings"], before["settings"])

    def test_configuration_is_queued_until_browser_confirms_and_echoes_settings(self):
        state = connected(default_settings())
        command = state.queue_command("configure", {"personalityPreset": "careful", "autoNext": False})
        self.assertEqual(command["payload"], {"personalityPreset": "careful", "autoNext": False})
        self.assertEqual(state.view()["settings"]["personalityPreset"], "outgoing_engineer")
        changed = {**default_settings(), **command["payload"]}
        state.exchange(exchange(changed, acknowledgements=[{"id": command["id"], "ok": True}]))
        self.assertEqual(state.view()["settings"], changed)
        self.assertEqual(state.view()["commands"], [])

    def test_running_configuration_rejected_and_disconnect_clears_old_preferences(self):
        state = connected({**default_settings(), "personalityAnswers": "旧页 => 答案"})
        state.exchange(exchange(snapshot={"running": True}))
        with self.assertRaises(BridgeError):
            state.queue_command("configure", {"dwellSec": 6})
        state.disconnect({"clientId": "settings-test"})
        self.assertIsNone(state.view()["settings"])

    def test_dirty_form_survives_remote_updates_until_save_confirmation(self):
        state = connected(default_settings())
        draft = SettingsDraft()
        self.assertTrue(draft.observe(state.view()))
        draft.dirty = True
        draft.values["dwellSec"] = 99
        state.exchange(exchange({**default_settings(), "dwellSec": 8}))
        self.assertFalse(draft.observe(state.view()))
        self.assertEqual(draft.values["dwellSec"], 99)
        self.assertTrue(draft.observe(state.view(), confirmed=True))
        self.assertFalse(draft.dirty)
        self.assertEqual(draft.values["dwellSec"], 8)

    def test_disconnect_and_rebind_do_not_show_old_form_as_saved(self):
        state = connected({**default_settings(), "personalityAnswers": "旧页 => 答案"})
        draft = SettingsDraft()
        draft.observe(state.view())
        draft.dirty = True
        state.disconnect({"clientId": "settings-test"})
        self.assertTrue(draft.observe(state.view()))
        self.assertFalse(draft.synced)
        self.assertEqual(draft.values["personalityAnswers"], "")
        state.connect({"clientId": "new", "tab": {"id": 8, "title": "新页面"}, "version": "0.5.1", "settings": default_settings()})
        self.assertTrue(draft.observe(state.view()))
        self.assertTrue(draft.synced)

    def test_legacy_connection_without_settings_is_not_marked_synchronized(self):
        state = connected()
        draft = SettingsDraft()
        draft.observe(state.view())
        self.assertFalse(draft.synced)

    def test_direct_rebind_replaces_dirty_old_tab_even_without_an_intermediate_disconnect_view(self):
        state = connected(default_settings())
        draft = SettingsDraft()
        draft.observe(state.view())
        draft.dirty = True
        draft.values["personalityAnswers"] = "旧草稿 => 不应带到新页"
        state.connect({"clientId": "settings-test", "tab": {"id": 8, "title": "新页面"}, "version": "0.5.1", "settings": {**default_settings(), "dwellSec": 9}})
        self.assertTrue(draft.observe(state.view()))
        self.assertFalse(draft.dirty)
        self.assertEqual(draft.values["personalityAnswers"], "")
        self.assertEqual(draft.values["dwellSec"], 9)


if __name__ == "__main__":
    unittest.main()
