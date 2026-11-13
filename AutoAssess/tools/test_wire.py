"""Test real authenticated Python/JavaScript loopback transport without a GUI."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import queue
import shutil
import subprocess
import sys
import threading

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "desktop-companion"))
from bridge_server import DesktopBridge


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, help="Optional path for a local, non-secret result report.")
    args = parser.parse_args()
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js 20 or newer is required.")
    bridge = DesktopBridge()
    # Transport-only fixture: no window is created and this is not native capture verification.
    bridge.state.set_capture({"requested": True, "verified": True, "error": ""})
    process = None
    records = []
    errors = []
    try:
        bridge.start()
        process = subprocess.Popen([node, str(Path(__file__).with_name("wire_client.cjs"))], cwd=ROOT,
                                   stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, encoding="utf-8")
        events = queue.Queue()

        def read_output():
            for line in process.stdout:
                events.put(line)
            events.put(None)

        def read_errors():
            for line in process.stderr:
                errors.append(line)

        output_thread = threading.Thread(target=read_output, daemon=True)
        error_thread = threading.Thread(target=read_errors, daemon=True)
        output_thread.start()
        error_thread.start()

        def send(value):
            process.stdin.write(json.dumps(value) + "\n")
            process.stdin.flush()

        def receive():
            line = events.get(timeout=10)
            if line is None:
                raise RuntimeError("Wire client closed unexpectedly. " + "".join(errors))
            value = json.loads(line)
            records.append(value)
            return value

        # The temporary pairing secret travels only through stdin, never CLI arguments or logs.
        send({"code": bridge.pairing_code})
        assert receive()["connected"] is True
        assert bridge.state.view()["settings"]["personalityTraits"]["E"] == 2
        bridge.state.queue_command("configure", {"mode": "auto", "dwellSec": 3,
                                   "personalityStrategy": "strict", "autoNext": False,
                                   "personalityTraits": {"E": 5}, "selectors": {"question": ".question"}})
        bridge.state.queue_command("start")
        bridge.state.queue_command("pause")
        send({"op": "pulse"})
        result = receive()
        assert result["connected"] and result["page"]["running"] and result["page"]["paused"]
        assert result["page"]["mode"] == "auto" and result["page"]["dwellSec"] == 3
        send({"op": "pulse"})
        receive()
        assert bridge.state.view()["commands"] == []
        echoed = bridge.state.view()["settings"]
        assert echoed["personalityStrategy"] == "strict" and echoed["autoNext"] is False
        assert echoed["personalityTraits"]["E"] == 5 and echoed["selectors"]["question"] == ".question"
        bridge.state.queue_command("stop")
        send({"op": "pulse"})
        assert receive()["page"]["running"] is False
        send({"op": "pulse"})
        receive()
        send({"op": "disconnect"})
        result = receive()
        assert result["phase"] == "disconnected" and result["page"]["desktop"] is False
        process.stdin.close()
        process.wait(timeout=10)
        output_thread.join(timeout=1)
        error_thread.join(timeout=1)
        stderr = "".join(errors)
        assert process.returncode == 0, stderr
        assert bridge.state.health()["connected"] is False
        report = {"passed": True, "transport": "real HTTP on 127.0.0.1 with extension Origin and Bearer token",
                  "capture_property": "simulated; no native window or screenshot test", "records": records,
                  "exit_code": process.returncode, "stderr": stderr}
        if args.report:
            path = args.report.resolve()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("PASS real Python/JavaScript loopback pairing, settings, commands, acknowledgements and disconnect.")
        return 0
    finally:
        if process is not None:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=5)
            for stream in (process.stdin, process.stdout, process.stderr):
                if stream and not stream.closed:
                    stream.close()
        bridge.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, OSError, RuntimeError, ValueError, queue.Empty, subprocess.SubprocessError) as error:
        print(f"Loopback check failed: {error}", file=sys.stderr)
        raise SystemExit(1)
