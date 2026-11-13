import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from capture import CaptureController, WDA_EXCLUDEFROMCAPTURE, WDA_NONE


class FakeAPI:
    def __init__(self, *, root=900, set_ok=True, actual=None, read_ok=True):
        self.root = root
        self.set_ok = set_ok
        self.actual = actual
        self.read_ok = read_ok
        self.calls = []
        self.expected = None

    def root_window(self, hwnd):
        self.calls.append(("root", hwnd))
        return self.root

    def set_affinity(self, hwnd, value):
        self.calls.append(("set", hwnd, value))
        self.expected = value
        return self.set_ok

    def get_affinity(self, hwnd):
        self.calls.append(("get", hwnd))
        if not self.read_ok:
            return None
        return self.expected if self.actual is None else self.actual

    def last_error(self):
        return 87


class CaptureTests(unittest.TestCase):
    def test_exclusion_uses_real_root_handle_and_requires_matching_readback(self):
        api = FakeAPI()
        result = CaptureController(api=api, platform="win32", build=19041).apply(123, True)
        self.assertTrue(result.verified)
        self.assertEqual(result.affinity, WDA_EXCLUDEFROMCAPTURE)
        self.assertEqual(api.calls, [("root", 123), ("set", 900, 0x11), ("get", 900)])
        self.assertEqual(result.public(), {"requested": True, "verified": True, "error": ""})

    def test_disable_restores_none_and_verifies_it(self):
        api = FakeAPI()
        result = CaptureController(api=api, platform="win32", build=19041).apply(123, False)
        self.assertTrue(result.verified)
        self.assertFalse(result.requested)
        self.assertEqual(result.affinity, WDA_NONE)

    def test_unsupported_system_and_old_windows_do_not_call_native_api(self):
        for platform, build in [("linux", 99999), ("win32", 18362)]:
            with self.subTest(platform=platform, build=build):
                api = FakeAPI()
                result = CaptureController(api=api, platform=platform, build=build).apply(123, True)
                self.assertFalse(result.verified)
                self.assertTrue(result.error)
                self.assertEqual(api.calls, [])

    def test_native_failures_and_mismatched_readback_never_report_verified(self):
        for api in [FakeAPI(root=0), FakeAPI(set_ok=False), FakeAPI(read_ok=False), FakeAPI(actual=0)]:
            with self.subTest(api=api.__dict__):
                result = CaptureController(api=api, platform="win32", build=22631).apply(123, True)
                self.assertFalse(result.verified)
                self.assertTrue(result.error)

    def test_reshown_window_receives_new_top_level_handle(self):
        api = FakeAPI()
        controller = CaptureController(api=api, platform="win32", build=22631)
        self.assertTrue(controller.apply(123, True).verified)
        api.root = 901
        self.assertTrue(controller.apply(456, True).verified)
        self.assertIn(("set", 901, 0x11), api.calls)


if __name__ == "__main__":
    unittest.main()
