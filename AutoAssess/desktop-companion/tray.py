"""Normal Windows notification-area icon for this application.

Importing this module creates no windows. Windows decides whether the icon is in
the visible notification area or its overflow; this module never changes that
preference. All native callbacks run on a dedicated thread and only queue events.
"""
from __future__ import annotations

import ctypes
from ctypes import wintypes
import os
from pathlib import Path
import queue
import sys
import threading


DWORD = ctypes.c_uint32
UINT = ctypes.c_uint32
BOOL = ctypes.c_int32
LONG = ctypes.c_int32
WPARAM = ctypes.c_size_t
LPARAM = ctypes.c_ssize_t
LRESULT = ctypes.c_ssize_t
HWND = ctypes.c_void_p
HANDLE = ctypes.c_void_p
WNDPROC = getattr(ctypes, "WINFUNCTYPE", ctypes.CFUNCTYPE)(LRESULT, HWND, UINT, WPARAM, LPARAM)

NIM_ADD, NIM_MODIFY, NIM_DELETE, NIM_SETVERSION = 0, 1, 2, 4
NIF_MESSAGE, NIF_ICON, NIF_TIP, NIF_SHOWTIP = 1, 2, 4, 0x80
NOTIFYICON_VERSION_4 = 4
ICON_ID = 1
WM_TRAY = 0x8000 + 55
WM_NULL, WM_DESTROY, WM_CLOSE = 0, 2, 16
WM_CONTEXTMENU, WM_LBUTTONDBLCLK, WM_RBUTTONUP = 0x7B, 0x203, 0x205
NIN_SELECT, NIN_KEYSELECT = 0x400, 0x401
MENU_ACTIONS = {1001: "show", 1002: "stop", 1003: "exit"}
WS_EX_TOOLWINDOW, WS_EX_APPWINDOW = 0x80, 0x40000
GWL_EXSTYLE = -20
FRAME_REFRESH = 0x0001 | 0x0002 | 0x0004 | 0x0010 | 0x0020


class GUID(ctypes.Structure):
    _fields_ = [("Data1", DWORD), ("Data2", ctypes.c_uint16),
                ("Data3", ctypes.c_uint16), ("Data4", ctypes.c_ubyte * 8)]


class NotificationVersion(ctypes.Union):
    _fields_ = [("uTimeout", UINT), ("uVersion", UINT)]


class NOTIFYICONDATAW(ctypes.Structure):
    _anonymous_ = ("version",)
    _fields_ = [
        ("cbSize", DWORD), ("hWnd", HWND), ("uID", UINT), ("uFlags", UINT),
        ("uCallbackMessage", UINT), ("hIcon", HANDLE), ("szTip", ctypes.c_wchar * 128),
        ("dwState", DWORD), ("dwStateMask", DWORD), ("szInfo", ctypes.c_wchar * 256),
        ("version", NotificationVersion), ("szInfoTitle", ctypes.c_wchar * 64),
        ("dwInfoFlags", DWORD), ("guidItem", GUID), ("hBalloonIcon", HANDLE),
    ]


class WNDCLASSW(ctypes.Structure):
    _fields_ = [("style", UINT), ("lpfnWndProc", WNDPROC),
                ("cbClsExtra", ctypes.c_int), ("cbWndExtra", ctypes.c_int),
                ("hInstance", HANDLE), ("hIcon", HANDLE), ("hCursor", HANDLE),
                ("hbrBackground", HANDLE), ("lpszMenuName", ctypes.c_wchar_p),
                ("lpszClassName", ctypes.c_wchar_p)]


class POINT(ctypes.Structure):
    _fields_ = [("x", LONG), ("y", LONG)]


class MSG(ctypes.Structure):
    _fields_ = [("hwnd", HWND), ("message", UINT), ("wParam", WPARAM),
                ("lParam", LPARAM), ("time", DWORD), ("pt", POINT), ("lPrivate", DWORD)]


def notification_event(lparam: int) -> str | None:
    """Interpret both legacy and version-4 notification callback encodings."""
    value = int(lparam)
    icon_id = (value >> 16) & 0xFFFF
    if icon_id not in (0, ICON_ID):
        return None
    event = value & 0xFFFF
    if event in (WM_LBUTTONDBLCLK, NIN_SELECT, NIN_KEYSELECT):
        return "show"
    if event in (WM_RBUTTONUP, WM_CONTEXTMENU):
        return "menu"
    return None


def _signature(function, result, *arguments):
    function.restype = result
    function.argtypes = list(arguments)
    return function


class _WindowsTrayAPI:
    def __init__(self):
        if sys.platform != "win32":
            raise OSError("系统托盘仅支持 Windows")
        self.user32 = ctypes.WinDLL("user32", use_last_error=True)
        self.shell32 = ctypes.WinDLL("shell32", use_last_error=True)
        self.kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        self.window = 0
        self.icon = 0
        self.instance = 0
        self.class_registered = False
        self.icon_added = False
        self.class_name = f"AssessmentDesktopTray_{os.getpid()}_{id(self):x}"
        self.tooltip = "离线性格助手"
        self.emit = lambda _action: None
        self.report_error = lambda _message: None
        self.taskbar_created = 0
        self.thread_id = 0
        self.ready = lambda: None
        self._bind()
        self._callback = WNDPROC(self._window_proc)

    def _bind(self):
        u = self.user32
        _signature(self.kernel32.GetModuleHandleW, HANDLE, ctypes.c_wchar_p)
        _signature(self.kernel32.GetCurrentThreadId, DWORD)
        _signature(u.RegisterClassW, ctypes.c_uint16, ctypes.POINTER(WNDCLASSW))
        _signature(u.UnregisterClassW, BOOL, ctypes.c_wchar_p, HANDLE)
        _signature(u.RegisterWindowMessageW, UINT, ctypes.c_wchar_p)
        _signature(u.CreateWindowExW, HWND, DWORD, ctypes.c_wchar_p, ctypes.c_wchar_p, DWORD,
                   ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, HWND, HANDLE, HANDLE, ctypes.c_void_p)
        _signature(u.DefWindowProcW, LRESULT, HWND, UINT, WPARAM, LPARAM)
        _signature(u.DestroyWindow, BOOL, HWND)
        _signature(u.PostMessageW, BOOL, HWND, UINT, WPARAM, LPARAM)
        _signature(u.PostThreadMessageW, BOOL, DWORD, UINT, WPARAM, LPARAM)
        _signature(u.PostQuitMessage, None, ctypes.c_int)
        _signature(u.GetMessageW, ctypes.c_int, ctypes.POINTER(MSG), HWND, UINT, UINT)
        _signature(u.TranslateMessage, BOOL, ctypes.POINTER(MSG))
        _signature(u.DispatchMessageW, LRESULT, ctypes.POINTER(MSG))
        _signature(u.LoadImageW, HANDLE, HANDLE, ctypes.c_wchar_p, UINT, ctypes.c_int, ctypes.c_int, UINT)
        _signature(u.DestroyIcon, BOOL, HANDLE)
        _signature(u.CreatePopupMenu, HANDLE)
        _signature(u.AppendMenuW, BOOL, HANDLE, UINT, ctypes.c_size_t, ctypes.c_wchar_p)
        _signature(u.DestroyMenu, BOOL, HANDLE)
        _signature(u.GetCursorPos, BOOL, ctypes.POINTER(POINT))
        _signature(u.SetForegroundWindow, BOOL, HWND)
        _signature(u.TrackPopupMenu, UINT, HANDLE, UINT, ctypes.c_int, ctypes.c_int, ctypes.c_int, HWND, ctypes.c_void_p)
        _signature(self.shell32.Shell_NotifyIconW, BOOL, DWORD, ctypes.POINTER(NOTIFYICONDATAW))

    @staticmethod
    def _failure(message):
        return OSError(f"{message}（Windows 错误 {ctypes.get_last_error()}）")

    def _data(self):
        data = NOTIFYICONDATAW()
        data.cbSize = ctypes.sizeof(NOTIFYICONDATAW)
        data.hWnd = self.window
        data.uID = ICON_ID
        data.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP
        data.uCallbackMessage = WM_TRAY
        data.hIcon = self.icon
        data.szTip = self.tooltip[:127]
        return data

    def _add_icon(self):
        data = self._data()
        if not self.shell32.Shell_NotifyIconW(NIM_ADD, ctypes.byref(data)):
            raise self._failure("无法添加系统托盘图标")
        self.icon_added = True
        data.uVersion = NOTIFYICON_VERSION_4
        if not self.shell32.Shell_NotifyIconW(NIM_SETVERSION, ctypes.byref(data)):
            # Legacy callback parsing remains supported; the icon is usable.
            self.report_error("托盘版本协商未成功，已使用兼容事件格式")

    def _remove_icon(self):
        if self.icon_added:
            data = self._data()
            self.shell32.Shell_NotifyIconW(NIM_DELETE, ctypes.byref(data))
            self.icon_added = False

    def _menu(self):
        menu = self.user32.CreatePopupMenu()
        if not menu:
            raise self._failure("无法打开托盘菜单")
        try:
            for flags, identifier, label in [(0, 1001, "打开窗口"), (0, 1002, "停止本次运行"),
                                             (0x800, 0, None), (0, 1003, "退出")]:
                if not self.user32.AppendMenuW(menu, flags, identifier, label):
                    raise self._failure("无法创建托盘菜单项")
            point = POINT()
            if not self.user32.GetCursorPos(ctypes.byref(point)):
                raise self._failure("无法读取菜单位置")
            self.user32.SetForegroundWindow(self.window)
            selected = int(self.user32.TrackPopupMenu(menu, 0x0100 | 0x0080 | 0x0002,
                                                      point.x, point.y, 0, self.window, None))
            self.user32.PostMessageW(self.window, WM_NULL, 0, 0)
            action = MENU_ACTIONS.get(selected)
            if action:
                self.emit(action)
        finally:
            self.user32.DestroyMenu(menu)

    def _window_proc(self, hwnd, message, wparam, lparam):
        try:
            if message == WM_TRAY:
                action = notification_event(lparam)
                if action == "menu":
                    self._menu()
                elif action:
                    self.emit(action)
                return 0
            if self.taskbar_created and message == self.taskbar_created:
                self.icon_added = False  # Explorer discarded its notification area.
                try:
                    self._add_icon()
                    self.ready()
                except Exception as error:
                    self.report_error(str(error), unavailable=True)
                return 0
            if message == WM_CLOSE:
                self._remove_icon()
                self.user32.DestroyWindow(hwnd)
                return 0
            if message == WM_DESTROY:
                self._remove_icon()
                self.window = 0
                self.user32.PostQuitMessage(0)
                return 0
        except Exception as error:
            # Exceptions must never escape a ctypes window procedure.
            self.report_error(str(error))
        return self.user32.DefWindowProcW(hwnd, message, wparam, lparam)

    def run(self, icon_path, tooltip, ready, emit, report_error, stop_event):
        self.tooltip, self.emit, self.report_error, self.ready = tooltip, emit, report_error, ready
        try:
            self.thread_id = int(self.kernel32.GetCurrentThreadId())
            self.instance = self.kernel32.GetModuleHandleW(None)
            if not self.instance:
                raise self._failure("无法取得托盘模块句柄")
            window_class = WNDCLASSW()
            window_class.lpfnWndProc = self._callback
            window_class.hInstance = self.instance
            window_class.lpszClassName = self.class_name
            if not self.user32.RegisterClassW(ctypes.byref(window_class)):
                raise self._failure("无法注册托盘消息窗口")
            self.class_registered = True
            self.taskbar_created = int(self.user32.RegisterWindowMessageW("TaskbarCreated"))
            if not self.taskbar_created:
                raise self._failure("无法注册托盘重建消息")
            # An unshown top-level window receives Explorer's TaskbarCreated
            # broadcast; a message-only HWND would not receive this broadcast.
            self.window = self.user32.CreateWindowExW(0, self.class_name, "离线性格助手托盘",
                                                      0, 0, 0, 0, 0, None, None, self.instance, None)
            if not self.window:
                raise self._failure("无法创建托盘消息窗口")
            self.icon = self.user32.LoadImageW(None, str(icon_path), 1, 32, 32, 0x0010)
            if not self.icon:
                raise self._failure("无法载入托盘图标")
            if stop_event.is_set():
                return
            self._add_icon()
            ready()
            if stop_event.is_set():
                return
            message = MSG()
            while True:
                result = self.user32.GetMessageW(ctypes.byref(message), None, 0, 0)
                if result == 0:
                    break
                if result < 0:
                    raise self._failure("托盘消息循环失败")
                self.user32.TranslateMessage(ctypes.byref(message))
                self.user32.DispatchMessageW(ctypes.byref(message))
        finally:
            self.cleanup()

    def request_stop(self):
        window = self.window
        if window and self.user32.PostMessageW(window, WM_CLOSE, 0, 0):
            return
        if self.thread_id:
            self.user32.PostThreadMessageW(self.thread_id, 0x0012, 0, 0)

    def cleanup(self):
        self._remove_icon()
        if self.window:
            window, self.window = self.window, 0
            self.user32.DestroyWindow(window)
        if self.icon:
            icon, self.icon = self.icon, 0
            self.user32.DestroyIcon(icon)
        if self.class_registered:
            self.user32.UnregisterClassW(self.class_name, self.instance)
            self.class_registered = False


class TrayIcon:
    """Dedicated native tray thread, with a queue consumed by the Tk main thread."""
    def __init__(self, icon_path, tooltip="离线性格助手", *, _api_factory=None, _start_timeout=2.0):
        self.icon_path = Path(icon_path).resolve()
        self.tooltip = str(tooltip)[:127]
        self.available = False
        self.error = ""
        self._api_factory = _api_factory or _WindowsTrayAPI
        self._start_timeout = max(0.01, min(float(_start_timeout), 5.0))
        self._events = queue.Queue()
        self._ready = threading.Event()
        self._stop = threading.Event()
        self._thread = None
        self._api = None

    def _report_error(self, value, *, unavailable=False):
        self.error = str(value)[:500]
        if unavailable:
            self.available = False

    def _emit(self, action):
        if action in {"show", "stop", "exit"} and not self._stop.is_set():
            self._events.put(action)

    def _mark_ready(self):
        if not self._stop.is_set():
            self.available = True
            self.error = ""
        self._ready.set()

    def _worker(self):
        try:
            self._api = self._api_factory()
            self._api.run(self.icon_path, self.tooltip, self._mark_ready, self._emit,
                          self._report_error, self._stop)
        except Exception as error:
            self._report_error(error)
        finally:
            self.available = False
            self._ready.set()

    def start(self) -> bool:
        if self._stop.is_set():
            return False
        if self._thread is None:
            if not self.icon_path.is_file():
                self.error = "托盘图标文件不存在"
                return False
            self._thread = threading.Thread(target=self._worker, name="assessment-tray", daemon=True)
            self._thread.start()
        if not self._ready.wait(self._start_timeout):
            self.error = "系统托盘初始化超时，窗口将保持可见"
            self._stop.set()
            if self._api:
                self._api.request_stop()
            return False
        return self.available

    def drain(self) -> list[str]:
        result = []
        while True:
            try:
                result.append(self._events.get_nowait())
            except queue.Empty:
                return result

    def close(self):
        self._stop.set()
        self.available = False
        if self._api:
            self._api.request_stop()
        if self._thread and threading.current_thread() is not self._thread:
            self._thread.join(timeout=2.0)


class _WindowStyleAPI:
    def __init__(self):
        if sys.platform != "win32":
            raise OSError("窗口样式仅支持 Windows")
        self.user32 = ctypes.WinDLL("user32", use_last_error=True)
        _signature(self.user32.GetWindowThreadProcessId, DWORD, HWND, ctypes.POINTER(DWORD))
        getter = self.user32.GetWindowLongPtrW if ctypes.sizeof(ctypes.c_void_p) == 8 else self.user32.GetWindowLongW
        setter = self.user32.SetWindowLongPtrW if ctypes.sizeof(ctypes.c_void_p) == 8 else self.user32.SetWindowLongW
        self.getter = _signature(getter, ctypes.c_ssize_t, HWND, ctypes.c_int)
        self.setter = _signature(setter, ctypes.c_ssize_t, HWND, ctypes.c_int, ctypes.c_ssize_t)
        _signature(self.user32.SetWindowPos, BOOL, HWND, HWND, ctypes.c_int, ctypes.c_int,
                   ctypes.c_int, ctypes.c_int, UINT)

    def owner(self, hwnd):
        pid = DWORD()
        if not self.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid)):
            return None
        return int(pid.value)

    def read(self, hwnd):
        ctypes.set_last_error(0)
        value = self.getter(hwnd, GWL_EXSTYLE)
        return None if value == 0 and ctypes.get_last_error() else int(value)

    def write(self, hwnd, value):
        ctypes.set_last_error(0)
        previous = self.setter(hwnd, GWL_EXSTYLE, value)
        return not (previous == 0 and ctypes.get_last_error())

    def refresh(self, hwnd):
        return bool(self.user32.SetWindowPos(hwnd, None, 0, 0, 0, 0, FRAME_REFRESH))


def set_tool_window(hwnd: int, *, enabled=True, _api=None) -> bool:
    """Adjust only our own top-level window; call only after tray startup succeeds.

    ``enabled=False`` is a recovery path when the tray becomes unavailable.
    This does not force the notification icon into Windows' overflow area.
    """
    try:
        if not int(hwnd):
            return False
        api = _api or _WindowStyleAPI()
        if api.owner(hwnd) != os.getpid():
            return False
        original = api.read(hwnd)
        if original is None:
            return False
        desired = ((original | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW) if enabled else ((original | WS_EX_APPWINDOW) & ~WS_EX_TOOLWINDOW)
        if not api.write(hwnd, desired):
            return False
        if api.refresh(hwnd):
            return True
        api.write(hwnd, original)
        api.refresh(hwnd)
        return False
    except (OSError, AttributeError, TypeError, ValueError):
        return False
