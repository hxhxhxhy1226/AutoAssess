import http.client
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from bridge_server import BridgeError, BridgeState, DesktopBridge, MAX_BODY
from settings_model import default_settings


class Clock:
    def __init__(self):
        self.mono = 10.0
        self.wall = 1000.0


def connection(identity="fixture-client"):
    return {"clientId": identity, "tab": {"id": 7, "title": "本地性格样例"}, "version": "0.5.0"}


def exchange(identity="fixture-client", **extra):
    return {"clientId": identity, "snapshot": {"status": "已就绪", "mode": "manual", "dwellSec": 5}, "acknowledgements": [], **extra}


class StateTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()
        self.state = BridgeState(monotonic=lambda: self.clock.mono, wall_clock=lambda: self.clock.wall)

    def test_connection_is_explicit_and_does_not_enqueue_start(self):
        self.assertFalse(self.state.health()["connected"])
        self.state.connect(connection())
        self.assertTrue(self.state.health()["connected"])
        self.assertEqual(self.state.view()["commands"], [])
        self.assertEqual(self.state.view()["snapshot"], {})

    def test_single_client_binding_rejects_another_until_lease_expires(self):
        self.state.connect(connection())
        with self.assertRaises(BridgeError) as error:
            self.state.connect(connection("other"))
        self.assertEqual(error.exception.status, 409)
        self.clock.mono += 6.01
        self.state.connect(connection("other"))
        self.assertTrue(self.state.health()["connected"])
        with self.assertRaises(BridgeError):
            self.state.exchange(exchange())

    def test_timeout_clears_question_and_pending_commands(self):
        self.state.connect(connection())
        self.state.exchange(exchange(snapshot={"question": "不可保存的样例题文"}))
        self.state.queue_command("start")
        self.clock.mono += 6.01
        view = self.state.view()
        self.assertFalse(view["connected"])
        self.assertEqual(view["snapshot"], {})
        self.assertEqual(view["commands"], [])

    def test_commands_replay_identically_until_ack_then_disappear(self):
        self.state.connect(connection())
        command = self.state.queue_command("pause")
        one = self.state.exchange(exchange())
        two = self.state.exchange(exchange())
        self.assertEqual(one["commands"], [command])
        self.assertEqual(two["commands"], [command])
        done = self.state.exchange(exchange(acknowledgements=[{"id": command["id"], "ok": True}]))
        self.assertEqual(done["commands"], [])
        self.assertEqual(self.state.view()["last_ack"]["action"], "pause")
        duplicate = self.state.exchange(exchange(acknowledgements=[{"id": command["id"], "ok": True}]))
        self.assertEqual(duplicate["commands"], [])

    def test_failed_ack_surfaces_error_and_is_not_replayed(self):
        self.state.connect(connection())
        command = self.state.queue_command("apply")
        self.state.exchange(exchange(acknowledgements=[{"id": command["id"], "ok": False, "error": "题目已变化"}]))
        self.assertEqual(self.state.view()["commands"], [])
        self.assertEqual(self.state.view()["last_ack"]["error"], "题目已变化")

    def test_command_expiry_prevents_late_execution_and_surfaces_timeout(self):
        self.state.connect(connection())
        command = self.state.queue_command("start")
        self.clock.wall += 16
        response = self.state.exchange(exchange())
        self.assertEqual(response["commands"], [])
        self.assertFalse(self.state.view()["last_ack"]["ok"])
        self.assertEqual(self.state.view()["last_ack"]["id"], command["id"])

    def test_queue_is_bounded_and_stop_replaces_pending_work(self):
        self.state.connect(connection())
        for _ in range(16):
            self.state.queue_command("pause")
        with self.assertRaises(BridgeError):
            self.state.queue_command("start")
        stop = self.state.queue_command("stop")
        self.assertEqual(self.state.view()["commands"], [stop])

    def test_only_whitelisted_commands_and_valid_configuration_are_accepted(self):
        self.state.connect(connection())
        for action, payload in [("exec", {}), ("start", {"code": "x"}), ("configure", {"mode": "other", "dwellSec": 5}),
                                ("configure", {"mode": "manual", "dwellSec": True}), ("configure", {"mode": [], "dwellSec": 5}),
                                ("configure", {"mode": "auto", "dwellSec": 12, "unused": 1})]:
            with self.subTest(action=action, payload=payload), self.assertRaises(BridgeError):
                self.state.queue_command(action, payload)
        result = self.state.queue_command("configure", {"mode": "auto", "dwellSec": 12})
        self.assertEqual(result["payload"], {"mode": "auto", "dwellSec": 12})

    def test_invalid_snapshots_do_not_refresh_lease_or_replace_prior_state(self):
        self.state.connect(connection())
        self.state.exchange(exchange())
        old = self.state.view()["snapshot"]
        for snapshot in [{"running": "true"}, {"mode": []}, {"count": True}, {"dwellSec": 0}, {"question": "x" * 20001}, {"question": "\ud800"}]:
            with self.subTest(snapshot_keys=list(snapshot)), self.assertRaises(BridgeError):
                self.state.exchange(exchange(snapshot=snapshot))
            self.assertEqual(self.state.view()["snapshot"], old)

    def test_disconnect_and_same_client_reconnect_clear_old_data(self):
        self.state.connect(connection())
        self.state.exchange(exchange(snapshot={"question": "样例"}))
        self.state.queue_command("start")
        self.state.connect(connection())
        self.assertEqual(self.state.view()["snapshot"], {})
        self.assertEqual(self.state.view()["commands"], [])
        self.state.disconnect({"clientId": "fixture-client"})
        self.assertFalse(self.state.health()["connected"])

    def test_identity_and_tab_validation_rejects_invalid_fields(self):
        for change in [{"clientId": ""}, {"clientId": "含中文"}, {"clientId": "line\nbreak"}, {"tab": {"id": True, "title": "x"}}]:
            with self.subTest(change=change), self.assertRaises(BridgeError):
                self.state.connect({**connection(), **change})


class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bridge = DesktopBridge()
        cls.bridge.start()

    @classmethod
    def tearDownClass(cls):
        cls.bridge.close()

    def setUp(self):
        with self.bridge.state.lock:
            self.bridge.state._clear()

    def request(self, method, path, payload=None, *, headers=None, raw=None, auth=True):
        client = http.client.HTTPConnection("127.0.0.1", self.bridge.port, timeout=3)
        request_headers = {"Content-Type": "application/json"}
        if auth:
            request_headers["Authorization"] = "Bearer " + self.bridge.token
        request_headers.update(headers or {})
        body = raw if raw is not None else json.dumps(payload).encode() if payload is not None else None
        try:
            client.request(method, path, body=body, headers=request_headers)
            response = client.getresponse()
            data = response.read()
            return response.status, dict(response.getheaders()), json.loads(data) if data else None
        finally:
            client.close()

    def test_service_binds_only_ipv4_loopback_and_uses_ephemeral_secret(self):
        self.assertEqual(self.bridge.server.server_address[0], "127.0.0.1")
        self.assertGreater(self.bridge.port, 0)
        self.assertGreaterEqual(len(self.bridge.token), 32)
        self.assertEqual(self.bridge.pairing_code, f"{self.bridge.port}.{self.bridge.token}")

    def test_authentication_required_and_token_is_not_returned_by_health(self):
        for headers, auth in [({}, False), ({"Authorization": "Bearer wrong"}, True), ({"Authorization": "Bearer \xff"}, True)]:
            with self.subTest(headers=headers):
                status, _, body = self.request("GET", "/health", headers=headers, auth=auth)
                self.assertEqual(status, 401)
                self.assertFalse(body["ok"])
        status, _, body = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(body["protocol"], 1)
        self.assertNotIn(self.bridge.token, json.dumps(body))

    def test_origin_and_host_validation_reject_web_pages_and_dns_rebinding_names(self):
        for headers in [{"Origin": "https://example.com"}, {"Origin": "null"}, {"Origin": "chrome-extension://invalid"},
                        {"Host": f"localhost:{self.bridge.port}"}, {"Host": "attacker.invalid"}]:
            with self.subTest(headers=headers):
                status, _, _ = self.request("GET", "/health", headers=headers)
                self.assertEqual(status, 403)

    def test_valid_extension_origin_is_echoed_without_wildcard(self):
        origin = "chrome-extension://" + "a" * 32
        status, headers, _ = self.request("GET", "/health", headers={"Origin": origin})
        self.assertEqual(status, 200)
        self.assertEqual(headers["Access-Control-Allow-Origin"], origin)
        self.assertEqual(headers["Cache-Control"], "no-store")

    def test_preflight_allows_only_extension_origin_and_known_headers(self):
        origin = "chrome-extension://" + "b" * 32
        headers = {"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization, content-type"}
        status, response, _ = self.request("OPTIONS", "/exchange", auth=False, headers=headers)
        self.assertEqual(status, 204)
        self.assertEqual(response["Access-Control-Allow-Origin"], origin)
        for changed in [{"Origin": "https://example.com"}, {"Access-Control-Request-Headers": "x-unknown"}, {"Access-Control-Request-Method": "DELETE"}]:
            status, _, _ = self.request("OPTIONS", "/exchange", auth=False, headers={**headers, **changed})
            self.assertEqual(status, 403)

    def test_connect_exchange_ack_disconnect_round_trip_uses_real_http(self):
        status, _, body = self.request("POST", "/connect", connection())
        self.assertEqual(status, 200)
        self.assertEqual(body["protocol"], 1)
        command = self.bridge.state.queue_command("configure", {"mode": "auto", "dwellSec": 3})
        status, _, body = self.request("POST", "/exchange", exchange())
        self.assertEqual(status, 200)
        self.assertEqual(body["commands"], [command])
        status, _, body = self.request("POST", "/exchange", exchange(acknowledgements=[{"id": command["id"], "ok": True}]))
        self.assertEqual(body["commands"], [])
        status, _, _ = self.request("POST", "/disconnect", {"clientId": "fixture-client"})
        self.assertEqual(status, 200)
        self.assertFalse(self.bridge.state.view()["connected"])

    def test_full_settings_round_trip_over_http_is_confirmed_by_browser_echo(self):
        original = {**default_settings(), "personalityPreset": "custom", "personalityTraits": {"E": 2, "C": 5},
                    "personalityAnswers": "完整题干 => 选项文字", "selectors": {**default_settings()["selectors"], "question": ".field"}}
        status, _, response = self.request("POST", "/connect", {**connection(), "settings": original})
        self.assertEqual(status, 200)
        self.assertEqual(response["appVersion"], "0.5.1")
        self.assertTrue(response["capabilities"]["settings"])
        self.assertEqual(self.bridge.state.view()["settings"], original)
        revision = self.bridge.state.view()["settings_revision"]
        self.request("POST", "/exchange", exchange(settings=original))
        self.assertEqual(self.bridge.state.view()["settings_revision"], revision)
        command = self.bridge.state.queue_command("configure", {"autoNext": False, "personalityStrategy": "strict"})
        status, _, response = self.request("POST", "/exchange", exchange())
        self.assertEqual(response["commands"], [command])
        updated = {**original, **command["payload"]}
        status, _, response = self.request("POST", "/exchange", exchange(settings=updated, acknowledgements=[{"id": command["id"], "ok": True}]))
        self.assertEqual(status, 200)
        self.assertEqual(response["commands"], [])
        self.assertEqual(self.bridge.state.view()["settings"], updated)
        self.assertEqual(self.bridge.state.view()["settings_revision"], revision + 1)

    def test_unknown_configuration_is_rejected_by_http_without_overwriting_state(self):
        self.request("POST", "/connect", {**connection(), "settings": default_settings()})
        status, _, body = self.request("POST", "/exchange", exchange(settings={"apiKey": "not-a-supported-field"}))
        self.assertEqual(status, 400)
        self.assertIn("不支持", body["error"])
        self.assertEqual(self.bridge.state.view()["settings"], default_settings())

    def test_body_limits_and_json_types_are_enforced(self):
        cases = [(b"x" * (MAX_BODY + 1), {}, 413), (b"not-json", {}, 400), (b"[]", {}, 400),
                 (b"{}", {"Content-Type": "text/plain"}, 415), (b'{"snapshot":{"mode":[]},"clientId":"x"}', {}, 400)]
        for raw, headers, expected in cases:
            with self.subTest(expected=expected, size=len(raw)):
                status, _, _ = self.request("POST", "/exchange", raw=raw, headers=headers)
                self.assertEqual(status, expected)

    def test_unknown_endpoints_and_cross_client_actions_are_rejected(self):
        status, _, _ = self.request("POST", "/exec", {"command": "anything"})
        self.assertEqual(status, 404)
        self.request("POST", "/connect", connection())
        for path, body in [("/connect", connection("other")), ("/exchange", exchange("other")), ("/disconnect", {"clientId": "other"})]:
            status, _, _ = self.request("POST", path, body)
            self.assertEqual(status, 409)


if __name__ == "__main__":
    unittest.main()
