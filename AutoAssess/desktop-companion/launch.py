"""Console startup check for pythonw; no PowerShell policy changes are needed."""
from pathlib import Path
import subprocess
import sys
import time


def main():
    if sys.platform != "win32":
        raise RuntimeError("The desktop window requires Windows.")
    import tkinter  # Check dependency before the windowed process hides errors.
    root = Path(__file__).resolve().parent
    pythonw = Path(sys.executable).with_name("pythonw.exe")
    entry = root / "main.py"
    if not pythonw.is_file() or not entry.is_file():
        raise RuntimeError("pythonw.exe or main.py is missing.")
    started = time.time()
    child = subprocess.Popen([str(pythonw), "-B", str(entry)], cwd=root,
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        code = child.wait(timeout=1.5)
    except subprocess.TimeoutExpired:
        print("Desktop process started. Copy its connection code into the browser extension.")
        return
    error_log = root / "startup-error.log"
    if error_log.exists() and error_log.stat().st_mtime >= started - 1:
        print(error_log.read_text(encoding="utf-8", errors="replace")[:6000])
    raise RuntimeError(f"Desktop process exited during startup (exit {code}).")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Desktop startup failed: {error}", file=sys.stderr)
        raise SystemExit(1)
