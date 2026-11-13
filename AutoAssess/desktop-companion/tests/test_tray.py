"""Tray lifecycle and message tests with fake native APIs; never creates GUI."""
import ctypes
import os
from pathlib import Path
import sys
import threading
from types import SimpleNamespace
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import tray

ICON = Path(__file__).resolve().parents[1] / "assets" / "gear.ico"


class FakeThreadAPI:
    def __init__(self, *, gate=None, error=None):
        self.gate, self.error = gate, error
        self.run_count = self.cleanup_count = self.stop_count = 0
        self.worker_thread = None
        self.report = None
        self.emit = None
        self.ready = None

    def run(self, icon, tooltip, ready, emit, report, stop_event):
        self.run_count += 1
        self.worker_thread = threading.get_ident()
        self.emit, self.report, self.ready = emit, report, ready
        try:
            if self.gate:
                self.gate.wait(timeout=2)
            if self.error:
                raise self.error
            ready()
            stop_event.wait(timeout=3)
        finally:
            self.cleanup_count += 1

    def request_stop(self):
        self.stop_count += 1


class TrayLifecycleTests(unittest.TestCase):
    def test_construction_does_not_call_native_api_or_start_thread(self):
        calls = []
        item = tray.TrayIcon(ICON, _api_factory=lambda: calls.append(True))
        self.assertEqual(calls, [])
        self.assertIsNone(item._thread)
        self.assertFalse(item.available)

    def test_native_work_stays_on_worker_and_events_are_drained_in_order(self):
        api = FakeThreadAPI()
        item = tray.TrayIcon(ICON, _api_factory=lambda: api)
        self.addCleanup(item.close)
        self.assertTrue(item.start())
        self.assertNotEqual(api.worker_thread, threading.get_ident())
        for action in ["show", "stop", "not-an-action", "exit"]:
            api.emit(action)
        self.assertEqual(item.drain(), ["show", "stop", "exit"])
        self.assertEqual(item.drain(), [])

    def test_start_and_close_are_idempotent_and_cleanup_completes(self):
        api = FakeThreadAPI()
        item = tray.TrayIcon(ICON, _api_factory=lambda: api)
        self.assertTrue(item.start())
        self.assertTrue(item.start())
        self.assertEqual(api.run_count, 1)
        item.close()
        item.close()
        self.assertFalse(item.available)
        self.assertEqual(api.cleanup_count, 1)
        self.assertFalse(item._thread.is_alive())
        self.assertFalse(item.start())
        api.emit("show")
        self.assertEqual(item.drain(), [])

    def test_startup_failure_is_returned_without_hiding_application_window(self):
        api = FakeThreadAPI(error=OSError("fixture registration failed"))
        item = tray.TrayIcon(ICON, _api_factory=lambda: api)
        self.addCleanup(item.close)
        self.assertFalse(item.start())
        self.assertIn("fixture registration failed", item.error)
        self.assertFalse(item.available)
        self.assertEqual(api.cleanup_count, 1)

    def test_startup_timeout_cancels_and_late_ready_cannot_claim_success(self):
        gate = threading.Event()
        api = FakeThreadAPI(gate=gate)
        item = tray.TrayIcon(ICON, _api_factory=lambda: api, _start_timeout=.01)
        try:
            self.assertFalse(item.start())
            self.assertIn("超时", item.error)
            gate.set()
            item.close()
            self.assertFalse(item.available)
            self.assertFalse(item._thread.is_alive())
        finally:
            gate.set()
            item.close()

    def test_missing_icon_reports_failure_without_starting_api(self):
        item = tray.TrayIcon(ICON.with_name("missing.ico"), _api_factory=lambda: self.fail("API must not start"))
        self.assertFalse(item.start())
        self.assertIn("不存在", item.error)

    def test_runtime_icon_loss_can_be_reported_to_the_tk_owner(self):
        api = FakeThreadAPI()
        item = tray.TrayIcon(ICON, _api_factory=lambda: api)
        self.addCleanup(item.close)
        self.assertTrue(item.start())
        api.report("Explorer rebuild failed", unavailable=True)
        self.assertFalse(item.available)
        self.assertIn("Explorer", item.error)
        api.ready()
        self.assertTrue(item.available)
        self.assertEqual(item.error, "")


def native_fixture():
    api = object.__new__(tray._WindowsTrayAPI)
    calls, events, errors, ready = [], [], [], []
    api.window, api.icon, api.instance = 100, 200, 300
    api.class_name = "FixtureTray"
    api.class_registered = True
    api.icon_added = False
    api.tooltip = "离线性格助手"
    api.taskbar_created = 0xC123
    api.thread_id = 400
    api.emit = events.append
    api.report_error = lambda value, **kwargs: errors.append((str(value), kwargs))
    api.ready = lambda: ready.append(True)
    controls = {"shell_success": True, "menu_result": 1002, "post_success": True}

    def notify(operation, pointer):
        value = ctypes.cast(pointer, ctypes.POINTER(tray.NOTIFYICONDATAW)).contents
        calls.append(("notify", operation, int(value.cbSize), value.hWnd, value.uID,
                      value.uFlags, value.uCallbackMessage, value.hIcon, value.szTip, value.uVersion))
        return controls["shell_success"]

    def cursor(pointer):
        point = ctypes.cast(pointer, ctypes.POINTER(tray.POINT)).contents
        point.x, point.y = 321, 123
        return True

    api.shell32 = SimpleNamespace(Shell_NotifyIconW=notify)
    api.user32 = SimpleNamespace(
        DefWindowProcW=lambda *args: calls.append(("default", *args)) or 0,
        DestroyWindow=lambda hwnd: calls.append(("destroy_window", hwnd)) or True,
        DestroyIcon=lambda icon: calls.append(("destroy_icon", icon)) or True,
        UnregisterClassW=lambda *args: calls.append(("unregister", *args)) or True,
        PostQuitMessage=lambda code: calls.append(("quit", code)),
        PostMessageW=lambda *args: calls.append(("post", *args)) or controls["post_success"],
        PostThreadMessageW=lambda *args: calls.append(("post_thread", *args)) or True,
        CreatePopupMenu=lambda: 500,
        AppendMenuW=lambda *args: calls.append(("append_menu", *args)) or True,
        DestroyMenu=lambda menu: calls.append(("destroy_menu", menu)) or True,
        GetCursorPos=cursor,
        SetForegroundWindow=lambda hwnd: calls.append(("foreground", hwnd)) or True,
        TrackPopupMenu=lambda *args: calls.append(("track_menu", *args)) or controls["menu_result"],
    )
    return api, calls, events, errors, ready, controls


class NativeMessageTests(unittest.TestCase):
    def test_callback_decodes_low_word_and_rejects_another_icon_id(self):
        self.assertEqual(tray.notification_event(tray.WM_LBUTTONDBLCLK), "show")
        self.assertEqual(tray.notification_event((1 << 16) | tray.NIN_KEYSELECT), "show")
        self.assertEqual(tray.notification_event((1 << 16) | tray.WM_CONTEXTMENU), "menu")
        self.assertIsNone(tray.notification_event((2 << 16) | tray.NIN_SELECT))
        self.assertIsNone(tray.notification_event((1 << 16) | 0x200))

    def test_notify_icon_data_contains_correct_flags_identity_and_version(self):
        api, calls, *_ = native_fixture()
        api._add_icon()
        added, version = calls
        self.assertEqual(added[:2], ("notify", tray.NIM_ADD))
        self.assertEqual(added[2:9], (ctypes.sizeof(tray.NOTIFYICONDATAW), 100, 1, 135, tray.WM_TRAY, 200, "离线性格助手"))
        self.assertEqual(version[1], tray.NIM_SETVERSION)
        self.assertEqual(version[-1], 4)
        self.assertTrue(api.icon_added)

    def test_explorer_restart_readds_icon_and_negotiates_version(self):
        api, calls, events, errors, ready, controls = native_fixture()
        api.icon_added = True
        api._window_proc(100, api.taskbar_created, 0, 0)
        self.assertEqual([item[1] for item in calls if item[0] == "notify"], [tray.NIM_ADD, tray.NIM_SETVERSION])
        self.assertEqual(ready, [True])
        self.assertEqual(events, [])
        self.assertEqual(errors, [])

    def test_explorer_rebuild_failure_marks_icon_unavailable(self):
        api, _, _, errors, ready, controls = native_fixture()
        controls["shell_success"] = False
        api._window_proc(100, api.taskbar_created, 0, 0)
        self.assertEqual(ready, [])
        self.assertTrue(errors[-1][1]["unavailable"])
        self.assertFalse(api.icon_added)

    def test_context_menu_has_explicit_actions_and_releases_menu(self):
        api, calls, events, errors, *_ = native_fixture()
        api._window_proc(100, tray.WM_TRAY, 0, (1 << 16) | tray.WM_CONTEXTMENU)
        labels = [item[-1] for item in calls if item[0] == "append_menu"]
        self.assertEqual(labels, ["打开窗口", "停止本次运行", None, "退出"])
        self.assertEqual(events, ["stop"])
        self.assertIn(("destroy_menu", 500), calls)
        self.assertEqual(errors, [])

    def test_double_click_only_queues_show(self):
        api, _, events, *_ = native_fixture()
        api._window_proc(100, tray.WM_TRAY, 0, (1 << 16) | tray.WM_LBUTTONDBLCLK)
        self.assertEqual(events, ["show"])

    def test_cleanup_deletes_icon_and_releases_native_resources_once(self):
        api, calls, *_ = native_fixture()
        api.icon_added = True
        api.cleanup()
        api.cleanup()
        self.assertEqual([item[1] for item in calls if item[0] == "notify"], [tray.NIM_DELETE])
        self.assertEqual(calls.count(("destroy_window", 100)), 1)
        self.assertEqual(calls.count(("destroy_icon", 200)), 1)
        self.assertEqual(calls.count(("unregister", "FixtureTray", 300)), 1)

    def test_close_removes_icon_before_destroy_and_destroy_quits_loop(self):
        api, calls, *_ = native_fixture()
        api.icon_added = True
        api._window_proc(100, tray.WM_CLOSE, 0, 0)
        self.assertEqual(calls[0][0:2], ("notify", tray.NIM_DELETE))
        self.assertEqual(calls[1], ("destroy_window", 100))
        api._window_proc(100, tray.WM_DESTROY, 0, 0)
        self.assertEqual(api.window, 0)
        self.assertEqual(calls[-1], ("quit", 0))

    def test_stop_has_thread_quit_fallback_if_window_post_fails(self):
        api, calls, _, _, _, controls = native_fixture()
        controls["post_success"] = False
        api.request_stop()
        self.assertIn(("post_thread", 400, 0x12, 0, 0), calls)

    @unittest.skipUnless(sys.platform == "win32", "Windows WCHAR and pointer ABI")
    def test_windows_structures_match_32_or_64_bit_abi(self):
        pointer_size = ctypes.sizeof(ctypes.c_void_p)
        self.assertEqual(ctypes.sizeof(tray.WPARAM), pointer_size)
        self.assertEqual(ctypes.sizeof(tray.LPARAM), pointer_size)
        self.assertEqual(ctypes.sizeof(tray.NOTIFYICONDATAW), 976 if pointer_size == 8 else 956)
        self.assertEqual(ctypes.sizeof(tray.MSG), 48 if pointer_size == 8 else 32)


class FakeStyleAPI:
    def __init__(self, *, owner=None, write_ok=True, refresh_ok=True):
        self.pid = os.getpid() if owner is None else owner
        self.value = tray.WS_EX_APPWINDOW | 8
        self.writes = []
        self.write_ok, self.refresh_ok = write_ok, refresh_ok

    def owner(self, hwnd): return self.pid
    def read(self, hwnd): return self.value
    def write(self, hwnd, value):
        self.writes.append(value)
        if self.write_ok:
            self.value = value
        return self.write_ok
    def refresh(self, hwnd): return self.refresh_ok


class TaskbarStyleTests(unittest.TestCase):
    def test_owned_window_retains_other_flags_and_can_restore_taskbar_presence(self):
        api = FakeStyleAPI()
        self.assertTrue(tray.set_tool_window(10, _api=api))
        self.assertEqual(api.value, tray.WS_EX_TOOLWINDOW | 8)
        self.assertTrue(tray.set_tool_window(10, enabled=False, _api=api))
        self.assertEqual(api.value, tray.WS_EX_APPWINDOW | 8)

    def test_other_process_window_is_never_changed(self):
        api = FakeStyleAPI(owner=os.getpid() + 1)
        self.assertFalse(tray.set_tool_window(10, _api=api))
        self.assertEqual(api.writes, [])

    def test_failed_frame_refresh_restores_original_style(self):
        api = FakeStyleAPI(refresh_ok=False)
        original = api.value
        self.assertFalse(tray.set_tool_window(10, _api=api))
        self.assertEqual(api.writes, [tray.WS_EX_TOOLWINDOW | 8, original])
        self.assertEqual(api.value, original)

    def test_invalid_window_or_failed_style_write_returns_false(self):
        api = FakeStyleAPI(write_ok=False)
        self.assertFalse(tray.set_tool_window(0, _api=api))
        self.assertFalse(tray.set_tool_window(10, _api=api))


class AssetTests(unittest.TestCase):
    def test_icon_exists_and_is_a_multisize_icon_file(self):
        data = ICON.read_bytes()
        self.assertEqual(data[:4], b"\0\0\1\0")
        self.assertEqual(int.from_bytes(data[4:6], "little"), 7)
        self.assertTrue(ICON.with_suffix(".png").is_file())


if __name__ == "__main__":
    unittest.main()
