"""Loopback-only authenticated bridge. No shell, file, or evaluation endpoints."""
from __future__ import annotations

import copy
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import secrets
import threading
import time
import uuid
from settings_model import SettingsError, checked_settings

MAX_BODY = 512 * 1024
LEASE_SECONDS = 6.0
COMMAND_TTL_SECONDS = 15.0
ORIGIN_RE = re.compile(r"(?:chrome|edge)-extension://[a-p]{32}\Z")
ACTIONS = {"start", "pause", "resume", "stop", "apply", "configure"}


class BridgeError(Exception):
    def __init__(self, status: int, message: str):
        self.status = status
        super().__init__(message)


def client_id(value):
    if not isinstance(value, str) or not value or len(value) > 80 or not value.isascii() or any(ord(c) < 33 or ord(c) > 126 for c in value):
        raise BridgeError(400, "clientId 无效")
    return value


def integer(value, low, high):
    return type(value) is int and low <= value <= high


def valid_text(value, limit):
    if not isinstance(value, str) or len(value) > limit:
        return False
    try:
        value.encode("utf-8")
    except UnicodeError:
        return False
    return True


def checked_snapshot(value):
    if not isinstance(value, dict):
        raise BridgeError(400, "snapshot 必须为对象")
    result = {}
    for key, limit in {"status": 2048, "countdown": 64, "question": 20000, "questionType": 128,
                       "answer": 8192, "explanation": 20000, "basis": 128}.items():
        item = value.get(key, "")
        if not valid_text(item, limit):
            raise BridgeError(400, f"snapshot.{key} 无效或过长")
        result[key] = item
    for key in ["running", "paused", "canApply"]:
        item = value.get(key, False)
        if type(item) is not bool:
            raise BridgeError(400, f"snapshot.{key} 必须为布尔值")
        result[key] = item
    count = value.get("count", 0)
    dwell = value.get("dwellSec", 5)
    mode = value.get("mode", "manual")
    if not integer(count, 0, 100000000) or not integer(dwell, 1, 120) or not isinstance(mode, str) or mode not in {"auto", "manual"}:
        raise BridgeError(400, "snapshot 的计数或运行设置无效")
    result.update(count=count, dwellSec=dwell, mode=mode)
    return result


class BridgeState:
    def __init__(self, *, monotonic=time.monotonic, wall_clock=time.time):
        self.lock = threading.RLock()
        self.monotonic = monotonic
        self.wall_clock = wall_clock
        self.client = None
        self.tab = None
        self.version = ""
        self.last_seen = 0.0
        self.snapshot = {}
        self.commands = []
        self.last_ack = None
        self.ack_serial = 0
        self.capture = {"requested": True, "verified": False, "error": "等待桌面窗口初始化"}
        self.settings = None
        self.settings_revision = 0
        self.binding_serial = 0

    def _clear(self):
        self.client = None
        self.tab = None
        self.version = ""
        self.snapshot = {}
        self.commands = []
        self.last_ack = None
        self.settings = None

    def _set_settings(self, value):
        if value != self.settings:
            self.settings = copy.deepcopy(value)
            self.settings_revision += 1

    def _expire(self):
        if self.client is not None and self.monotonic() - self.last_seen > LEASE_SECONDS:
            self._clear()
        now_ms = int(self.wall_clock() * 1000)
        expired = [item for item in self.commands if item["expiresAt"] <= now_ms]
        if expired:
            self.ack_serial += 1
            item = expired[-1]
            self.last_ack = {"id": item["id"], "action": item["action"], "ok": False, "error": "命令等待超时，请核对浏览器状态后重试", "serial": self.ack_serial}
        self.commands = [item for item in self.commands if item["expiresAt"] > now_ms]

    def _require(self, identity):
        self._expire()
        if self.client is None or identity != self.client:
            raise BridgeError(409, "桌面连接已失效，请重新连接")

    def set_capture(self, value):
        with self.lock:
            self.capture = {"requested": bool(value["requested"]), "verified": bool(value["verified"]), "error": str(value.get("error", ""))[:2048]}

    def health(self):
        with self.lock:
            self._expire()
            return {"ok": True, "protocol": 1, "app": "assessment-desktop", "appVersion": "0.5.1",
                    "capabilities": {"settings": True, "tray": True},
                    "capture": copy.deepcopy(self.capture), "connected": self.client is not None}

    def connect(self, payload):
        identity = client_id(payload.get("clientId"))
        tab = payload.get("tab")
        version = payload.get("version", "")
        if not isinstance(tab, dict) or not integer(tab.get("id"), 0, 2147483647) or not valid_text(tab.get("title"), 240):
            raise BridgeError(400, "tab 无效")
        if not valid_text(version, 40):
            raise BridgeError(400, "version 无效")
        try:
            settings = checked_settings(payload["settings"]) if "settings" in payload else None
        except SettingsError as error:
            raise BridgeError(400, str(error)) from None
        with self.lock:
            self._expire()
            if self.client is not None and self.client != identity:
                raise BridgeError(409, "已有浏览器连接，请先断开原连接")
            self._clear()
            self.binding_serial += 1
            self.client = identity
            self.tab = {"id": tab["id"], "title": tab["title"]}
            self.version = version
            self.last_seen = self.monotonic()
            if settings is not None:
                self._set_settings(settings)
            return {"ok": True, "protocol": 1, "appVersion": "0.5.1", "capabilities": {"settings": True, "tray": True}, "capture": copy.deepcopy(self.capture)}

    def exchange(self, payload):
        identity = client_id(payload.get("clientId"))
        snapshot = checked_snapshot(payload.get("snapshot"))
        try:
            settings = checked_settings(payload["settings"]) if "settings" in payload else None
        except SettingsError as error:
            raise BridgeError(400, str(error)) from None
        acknowledgements = payload.get("acknowledgements", [])
        if not isinstance(acknowledgements, list) or len(acknowledgements) > 32:
            raise BridgeError(400, "acknowledgements 无效")
        acks = []
        for ack in acknowledgements:
            if not isinstance(ack, dict) or not isinstance(ack.get("id"), str) or len(ack["id"]) > 80 or type(ack.get("ok")) is not bool:
                raise BridgeError(400, "命令回执无效")
            error = ack.get("error", "")
            if not valid_text(error, 2048):
                raise BridgeError(400, "命令回执错误描述无效")
            acks.append({"id": ack["id"], "ok": ack["ok"], "error": error})
        with self.lock:
            self._require(identity)
            self.last_seen = self.monotonic()
            self.snapshot = snapshot
            if settings is not None:
                self._set_settings(settings)
            for ack in acks:
                match = next((item for item in self.commands if item["id"] == ack["id"]), None)
                if match is not None:
                    self.commands.remove(match)
                    self.ack_serial += 1
                    self.last_ack = {**ack, "action": match["action"], "serial": self.ack_serial}
            return {"ok": True, "commands": copy.deepcopy(self.commands), "capture": copy.deepcopy(self.capture)}

    def disconnect(self, payload):
        identity = client_id(payload.get("clientId"))
        with self.lock:
            self._expire()
            if self.client is not None and self.client != identity:
                raise BridgeError(409, "连接身份不匹配")
            self._clear()
            return {"ok": True}

    def queue_command(self, action, payload=None):
        if not isinstance(action, str) or action not in ACTIONS:
            raise BridgeError(400, "不支持的桌面命令")
        if action == "configure":
            try:
                payload = checked_settings(payload, partial=True)
            except SettingsError as error:
                raise BridgeError(400, str(error)) from None
        elif payload is not None:
            raise BridgeError(400, "此命令不接受参数")
        with self.lock:
            self._expire()
            if self.client is None:
                raise BridgeError(409, "浏览器未连接")
            if action == "configure" and self.snapshot.get("running"):
                raise BridgeError(409, "请先停止运行，再保存配置")
            if action == "stop":
                self.commands.clear()
            if len(self.commands) >= 16:
                raise BridgeError(409, "待处理命令过多，请稍后重试")
            command = {"id": uuid.uuid4().hex, "action": action, "expiresAt": int((self.wall_clock() + COMMAND_TTL_SECONDS) * 1000)}
            if payload is not None:
                command["payload"] = payload
            self.commands.append(command)
            return copy.deepcopy(command)

    def view(self):
        with self.lock:
            self._expire()
            return {"connected": self.client is not None, "tab": copy.deepcopy(self.tab), "version": self.version,
                    "snapshot": copy.deepcopy(self.snapshot), "commands": copy.deepcopy(self.commands),
                    "last_ack": copy.deepcopy(self.last_ack), "capture": copy.deepcopy(self.capture),
                    "settings": copy.deepcopy(self.settings), "settings_revision": self.settings_revision,
                    "binding_serial": self.binding_serial}


class LoopbackHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, state, token):
        self.state = state
        self.token = token
        super().__init__(("127.0.0.1", 0), BridgeHandler)


class BridgeHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "AssessmentDesktop/1"
    sys_version = ""

    def setup(self):
        super().setup()
        self.connection.settimeout(4)

    def log_message(self, *_args):
        pass

    def _check_origin_host(self):
        if self.headers.get("Host") != f"127.0.0.1:{self.server.server_port}":
            raise BridgeError(403, "Host 不允许")
        origin = self.headers.get("Origin")
        if origin is not None and not ORIGIN_RE.fullmatch(origin):
            raise BridgeError(403, "Origin 不允许")
        return origin

    def _authorize(self):
        self._check_origin_host()
        auth = self.headers.get("Authorization", "")
        if len(auth) > 512 or not auth.isascii() or not secrets.compare_digest(auth, "Bearer " + self.server.token):
            raise BridgeError(401, "配对码无效或已过期")
        if self.path not in {"/health", "/connect", "/exchange", "/disconnect"}:
            raise BridgeError(404, "接口不存在")

    def _json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        origin = self.headers.get("Origin")
        if origin and ORIGIN_RE.fullmatch(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(data)

    def _error(self, error):
        self.close_connection = True
        try:
            self._json(error.status, {"ok": False, "error": str(error)})
        except (ConnectionError, OSError):
            pass

    def do_OPTIONS(self):
        try:
            origin = self._check_origin_host()
            if not origin or self.path not in {"/health", "/connect", "/exchange", "/disconnect"}:
                raise BridgeError(403, "预检来源或接口不允许")
            if self.headers.get("Access-Control-Request-Method") not in {"GET", "POST"}:
                raise BridgeError(403, "预检方法不允许")
            headers = {item.strip().lower() for item in self.headers.get("Access-Control-Request-Headers", "").split(",") if item.strip()}
            if not headers <= {"authorization", "content-type", "x-assessment-bridge"}:
                raise BridgeError(403, "预检请求头不允许")
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST")
            self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Assessment-Bridge")
            if self.headers.get("Access-Control-Request-Private-Network") == "true":
                self.send_header("Access-Control-Allow-Private-Network", "true")
            self.send_header("Content-Length", "0")
            self.end_headers()
        except BridgeError as error:
            self._error(error)

    def do_GET(self):
        try:
            self._authorize()
            if self.headers.get("Transfer-Encoding") or self.headers.get("Content-Length", "0") != "0":
                raise BridgeError(400, "GET 不接受请求体")
            if self.path != "/health":
                raise BridgeError(405, "此接口需要 POST")
            self._json(200, self.server.state.health())
        except BridgeError as error:
            self._error(error)
        except (ConnectionError, OSError):
            self.close_connection = True

    def do_POST(self):
        try:
            self._authorize()
            if self.headers.get("Transfer-Encoding"):
                raise BridgeError(400, "不支持分块请求")
            length_text = self.headers.get("Content-Length")
            if length_text is None or not length_text.isdigit():
                raise BridgeError(411, "需要有效 Content-Length")
            if len(length_text) > 9:
                raise BridgeError(413, "请求体过大")
            length = int(length_text)
            if length > MAX_BODY:
                raise BridgeError(413, "请求体过大")
            if self.headers.get_content_type() != "application/json":
                raise BridgeError(415, "需要 application/json")
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise BridgeError(400, "请求体不完整")
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeError, json.JSONDecodeError, RecursionError):
                raise BridgeError(400, "JSON 无效") from None
            if not isinstance(payload, dict):
                raise BridgeError(400, "请求体必须为对象")
            method = {"/connect": self.server.state.connect, "/exchange": self.server.state.exchange,
                      "/disconnect": self.server.state.disconnect}.get(self.path)
            if method is None:
                raise BridgeError(405, "此接口需要 GET")
            self._json(200, method(payload))
        except BridgeError as error:
            self._error(error)
        except (ConnectionError, OSError):
            self.close_connection = True


class DesktopBridge:
    def __init__(self, state=None):
        self.state = state or BridgeState()
        self.token = secrets.token_urlsafe(24)
        self.server = LoopbackHTTPServer(self.state, self.token)
        self.thread = None

    @property
    def port(self):
        return self.server.server_port

    @property
    def pairing_code(self):
        return f"{self.port}.{self.token}"

    def start(self):
        if self.thread is None:
            self.thread = threading.Thread(target=self.server.serve_forever, name="desktop-loopback", daemon=True)
            self.thread.start()

    def close(self):
        if self.thread is not None:
            self.server.shutdown()
            self.thread.join(timeout=2)
        self.server.server_close()
