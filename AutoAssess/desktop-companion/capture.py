"""Checked Windows capture affinity for this process's own top-level window."""
from __future__ import annotations

from dataclasses import dataclass
import sys

WDA_NONE = 0
WDA_EXCLUDEFROMCAPTURE = 0x11
MIN_EXCLUSION_BUILD = 19041


@dataclass(frozen=True)
class CaptureResult:
    requested: bool
    verified: bool
    error: str = ""
    hwnd: int = 0
    affinity: int | None = None

    def public(self) -> dict:
        return {"requested": self.requested, "verified": self.verified, "error": self.error}


class WindowsAffinityAPI:
    def __init__(self):
        import ctypes
        from ctypes import wintypes
        self.ctypes = ctypes
        self.wintypes = wintypes
        self.user32 = ctypes.WinDLL("user32", use_last_error=True)
        self.user32.GetAncestor.argtypes = [wintypes.HWND, wintypes.UINT]
        self.user32.GetAncestor.restype = wintypes.HWND
        self.user32.SetWindowDisplayAffinity.argtypes = [wintypes.HWND, wintypes.DWORD]
        self.user32.SetWindowDisplayAffinity.restype = wintypes.BOOL
        self.user32.GetWindowDisplayAffinity.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
        self.user32.GetWindowDisplayAffinity.restype = wintypes.BOOL

    def root_window(self, window_id: int) -> int:
        self.ctypes.set_last_error(0)
        return int(self.user32.GetAncestor(window_id, 2) or 0)

    def set_affinity(self, hwnd: int, value: int) -> bool:
        self.ctypes.set_last_error(0)
        return bool(self.user32.SetWindowDisplayAffinity(hwnd, value))

    def get_affinity(self, hwnd: int) -> int | None:
        result = self.wintypes.DWORD()
        self.ctypes.set_last_error(0)
        if not self.user32.GetWindowDisplayAffinity(hwnd, self.ctypes.byref(result)):
            return None
        return int(result.value)

    def last_error(self) -> int:
        return self.ctypes.get_last_error()


class CaptureController:
    def __init__(self, *, api=None, platform=None, build=None):
        self.platform = sys.platform if platform is None else platform
        self.build = (sys.getwindowsversion().build if self.platform == "win32" and hasattr(sys, "getwindowsversion") else 0) if build is None else build
        self.api = api

    def apply(self, window_id: int, enabled: bool) -> CaptureResult:
        enabled = bool(enabled)
        if self.platform != "win32":
            return CaptureResult(enabled, False, "当前系统不支持 Windows 窗口采集排除")
        if enabled and self.build < MIN_EXCLUSION_BUILD:
            return CaptureResult(True, False, "需要 Windows 10 2004（内部版本 19041）或更高版本")
        try:
            api = self.api or WindowsAffinityAPI()
            self.api = api
            hwnd = api.root_window(int(window_id))
            if not hwnd:
                return CaptureResult(enabled, False, f"无法取得桌面窗口句柄，Windows 错误 {api.last_error()}")
            expected = WDA_EXCLUDEFROMCAPTURE if enabled else WDA_NONE
            if not api.set_affinity(hwnd, expected):
                return CaptureResult(enabled, False, f"设置窗口采集属性失败，Windows 错误 {api.last_error()}", hwnd)
            actual = api.get_affinity(hwnd)
            if actual is None:
                return CaptureResult(enabled, False, f"回读窗口采集属性失败，Windows 错误 {api.last_error()}", hwnd)
            if actual != expected:
                return CaptureResult(enabled, False, f"窗口采集属性未匹配：期望 {expected:#x}，实际 {actual:#x}", hwnd, actual)
            return CaptureResult(enabled, True, "", hwnd, actual)
        except (OSError, AttributeError, TypeError, ValueError) as error:
            return CaptureResult(enabled, False, f"窗口采集属性不可用：{error}")
