from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bridge_server import BridgeState
from capture import CaptureResult
from main import initial_geometry, stop_if_capture_failed, can_hide_to_tray


class PanelLogicTests(unittest.TestCase):
    def connected_state(self, *, running=False):
        state = BridgeState()
        state.connect({"clientId": "fixture", "tab": {"id": 7, "title": "test"}, "version": "0.5.0"})
        state.exchange({"clientId": "fixture", "snapshot": {"running": running}})
        return state

    def test_requested_protection_failure_queues_stop_for_running_task(self):
        state = self.connected_state(running=True)
        result = CaptureResult(True, False, "fixture failure")
        self.assertTrue(stop_if_capture_failed(state, result))
        self.assertEqual([item["action"] for item in state.view()["commands"]], ["stop"])
        self.assertFalse(stop_if_capture_failed(state, result))
        self.assertEqual(len(state.view()["commands"]), 1)

    def test_failure_replaces_pending_start_or_apply_before_they_execute(self):
        for action in ["start", "resume", "apply"]:
            with self.subTest(action=action):
                state = self.connected_state()
                state.queue_command(action)
                self.assertTrue(stop_if_capture_failed(state, CaptureResult(True, False, "failed")))
                self.assertEqual([item["action"] for item in state.view()["commands"]], ["stop"])

    def test_verified_protection_or_explicitly_disabled_protection_does_not_stop(self):
        for result in [CaptureResult(True, True), CaptureResult(False, True), CaptureResult(False, False, "unsupported")]:
            state = self.connected_state(running=True)
            self.assertFalse(stop_if_capture_failed(state, result))
            self.assertEqual(state.view()["commands"], [])

    def test_failure_with_no_connected_work_does_not_queue_actions(self):
        for state in [BridgeState(), self.connected_state()]:
            self.assertFalse(stop_if_capture_failed(state, CaptureResult(True, False, "failed")))
            self.assertEqual(state.view()["commands"], [])

    def test_initial_height_fits_common_small_screen_with_bottom_controls(self):
        self.assertEqual(initial_geometry(1920, 1080), (540, 780))
        self.assertEqual(initial_geometry(1366, 768), (540, 668))
        self.assertEqual(initial_geometry(800, 600), (540, 500))

    def test_window_can_only_hide_when_a_working_tray_entry_exists(self):
        self.assertTrue(can_hide_to_tray(True))
        self.assertFalse(can_hide_to_tray(False))
        self.assertFalse(can_hide_to_tray(True, closing=True))


if __name__ == "__main__":
    unittest.main()
