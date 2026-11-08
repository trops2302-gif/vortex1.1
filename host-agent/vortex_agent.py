"""Vortex Host Agent: recebe controles do navegador (localhost) e injeta no Windows."""
import argparse
import asyncio
import json
import os
import secrets
import subprocess
import sys

import websockets

IS_WIN = sys.platform == "win32"

# ---------------------------------------------------------------- teclado/mouse
if IS_WIN:
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    ULONG_PTR = ctypes.c_size_t

    class MOUSEINPUT(ctypes.Structure):
        _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG), ("mouseData", wintypes.DWORD),
                    ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD), ("dwExtraInfo", ULONG_PTR)]

    class KEYBDINPUT(ctypes.Structure):
        _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD), ("dwFlags", wintypes.DWORD),
                    ("time", wintypes.DWORD), ("dwExtraInfo", ULONG_PTR)]

    class _U(ctypes.Union):
        _fields_ = [("mi", MOUSEINPUT), ("ki", KEYBDINPUT)]

    class INPUT(ctypes.Structure):
        _fields_ = [("type", wintypes.DWORD), ("u", _U)]

    def _send(inp):
        user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))

    # KeyboardEvent.code -> (scancode, extended)
    SC = {"Escape": 1, "Digit1": 2, "Digit2": 3, "Digit3": 4, "Digit4": 5, "Digit5": 6, "Digit6": 7,
          "Digit7": 8, "Digit8": 9, "Digit9": 10, "Digit0": 11, "Minus": 12, "Equal": 13, "Backspace": 14,
          "Tab": 15, "KeyQ": 16, "KeyW": 17, "KeyE": 18, "KeyR": 19, "KeyT": 20, "KeyY": 21, "KeyU": 22,
          "KeyI": 23, "KeyO": 24, "KeyP": 25, "BracketLeft": 26, "BracketRight": 27, "Enter": 28,
          "ControlLeft": 29, "KeyA": 30, "KeyS": 31, "KeyD": 32, "KeyF": 33, "KeyG": 34, "KeyH": 35,
          "KeyJ": 36, "KeyK": 37, "KeyL": 38, "Semicolon": 39, "Quote": 40, "Backquote": 41,
          "ShiftLeft": 42, "Backslash": 43, "KeyZ": 44, "KeyX": 45, "KeyC": 46, "KeyV": 47, "KeyB": 48,
          "KeyN": 49, "KeyM": 50, "Comma": 51, "Period": 52, "Slash": 53, "ShiftRight": 54,
          "NumpadMultiply": 55, "AltLeft": 56, "Space": 57, "CapsLock": 58, "F1": 59, "F2": 60, "F3": 61,
          "F4": 62, "F5": 63, "F6": 64, "F7": 65, "F8": 66, "F9": 67, "F10": 68, "F11": 87, "F12": 88,
          "Numpad7": 71, "Numpad8": 72, "Numpad9": 73, "NumpadSubtract": 74, "Numpad4": 75, "Numpad5": 76,
          "Numpad6": 77, "NumpadAdd": 78, "Numpad1": 79, "Numpad2": 80, "Numpad3": 81, "Numpad0": 82,
          "NumpadDecimal": 83, "IntlBackslash": 86}
    SC_EXT = {"ControlRight": 29, "AltRight": 56, "ArrowUp": 72, "ArrowDown": 80, "ArrowLeft": 75,
              "ArrowRight": 77, "Insert": 82, "Delete": 83, "Home": 71, "End": 79, "PageUp": 73,
              "PageDown": 81, "NumpadEnter": 28, "NumpadDivide": 53, "MetaLeft": 91, "MetaRight": 92}

    def key(code, down):
        ext = code in SC_EXT
        sc = SC_EXT.get(code) or SC.get(code)
        if not sc:
            return
        flags = 0x0008 | (0 if down else 0x0002) | (0x0001 if ext else 0)
        _send(INPUT(type=1, u=_U(ki=KEYBDINPUT(0, sc, flags, 0, 0))))

    def mouse_move(dx, dy):
        _send(INPUT(type=0, u=_U(mi=MOUSEINPUT(int(dx), int(dy), 0, 0x0001, 0, 0))))

    def mouse_abs(x, y):
        nx, ny = int(max(0, min(1, x)) * 65535), int(max(0, min(1, y)) * 65535)
        _send(INPUT(type=0, u=_U(mi=MOUSEINPUT(nx, ny, 0, 0x0001 | 0x8000 | 0x4000, 0, 0))))

    BTN = {0: (0x0002, 0x0004), 1: (0x0020, 0x0040), 2: (0x0008, 0x0010)}

    def mouse_button(b, down):
        f = BTN.get(b)
        if f:
            _send(INPUT(type=0, u=_U(mi=MOUSEINPUT(0, 0, 0, f[0] if down else f[1], 0, 0))))

    def mouse_wheel(dy):
        _send(INPUT(type=0, u=_U(mi=MOUSEINPUT(0, 0, ctypes.c_ulong(int(-dy)).value, 0x0800, 0, 0))))
else:
    try:
        from pynput import keyboard as _kb, mouse as _ms
        _k, _m = _kb.Controller(), _ms.Controller()
    except Exception as e:  # sem display gráfico
        print(f"[aviso] teclado/mouse desativados ({e})")
        _kb = _ms = _k = _m = None

    def _pk(code):
        if code.startswith("Key"):
            return code[3:].lower()
        if code.startswith("Digit"):
            return code[5:]
        special = {"Space": "space", "Enter": "enter", "Escape": "esc", "Tab": "tab", "Backspace": "backspace",
                   "ShiftLeft": "shift", "ShiftRight": "shift_r", "ControlLeft": "ctrl", "ControlRight": "ctrl_r",
                   "AltLeft": "alt", "AltRight": "alt_r", "ArrowUp": "up", "ArrowDown": "down",
                   "ArrowLeft": "left", "ArrowRight": "right"}
        name = special.get(code) or (code.lower() if code.startswith("F") and code[1:].isdigit() else None)
        return getattr(_kb.Key, name) if name else None

    def key(code, down):
        if not _k:
            return
        k = _pk(code)
        if k is not None:
            (_k.press if down else _k.release)(k)

    def mouse_move(dx, dy):
        if _m:
            _m.move(int(dx), int(dy))

    def mouse_abs(x, y):
        pass

    def mouse_button(b, down):
        if not _m:
            return
        btn = {0: _ms.Button.left, 1: _ms.Button.middle, 2: _ms.Button.right}.get(b)
        if btn:
            (_m.press if down else _m.release)(btn)

    def mouse_wheel(dy):
        if _m:
            _m.scroll(0, -1 if dy > 0 else 1)

# ---------------------------------------------------------------- controle Xbox virtual
pads = {}
try:
    import vgamepad as vg

    XB = vg.XUSB_BUTTON
    GP_MAP = {0: XB.XUSB_GAMEPAD_A, 1: XB.XUSB_GAMEPAD_B, 2: XB.XUSB_GAMEPAD_X, 3: XB.XUSB_GAMEPAD_Y,
              4: XB.XUSB_GAMEPAD_LEFT_SHOULDER, 5: XB.XUSB_GAMEPAD_RIGHT_SHOULDER, 8: XB.XUSB_GAMEPAD_BACK,
              9: XB.XUSB_GAMEPAD_START, 10: XB.XUSB_GAMEPAD_LEFT_THUMB, 11: XB.XUSB_GAMEPAD_RIGHT_THUMB,
              12: XB.XUSB_GAMEPAD_DPAD_UP, 13: XB.XUSB_GAMEPAD_DPAD_DOWN, 14: XB.XUSB_GAMEPAD_DPAD_LEFT,
              15: XB.XUSB_GAMEPAD_DPAD_RIGHT, 16: XB.XUSB_GAMEPAD_GUIDE}
except Exception as e:  # ViGEmBus ausente ou SO sem suporte
    vg = None
    print(f"[aviso] controle virtual desativado ({e}). Instale ViGEmBus + 'pip install vgamepad'.")


def gamepad(slot, b, axes, lt, rt):
    if not vg:
        return
    pad = pads.get(slot)
    if pad is None:
        pad = pads[slot] = vg.VX360Gamepad()
    for idx, xb in GP_MAP.items():
        (pad.press_button if b & (1 << idx) else pad.release_button)(button=xb)
    lx, ly, rx, ry = (axes + [0, 0, 0, 0])[:4]
    pad.left_joystick_float(x_value_float=lx, y_value_float=-ly)
    pad.right_joystick_float(x_value_float=rx, y_value_float=-ry)
    pad.left_trigger_float(value_float=lt)
    pad.right_trigger_float(value_float=rt)
    pad.update()


# ---------------------------------------------------------------- janelas (Windows)
if IS_WIN:
    EnumWindowsProc = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)

    def list_windows():
        out = []

        def cb(hwnd, _):
            if not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd):
                return True
            n = user32.GetWindowTextLengthW(hwnd)
            if not n:
                return True
            buf = ctypes.create_unicode_buffer(n + 1)
            user32.GetWindowTextW(hwnd, buf, n + 1)
            r = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(r))
            out.append((hwnd, buf.value, r.right - r.left, r.bottom - r.top))
            return True

        user32.EnumWindows(EnumWindowsProc(cb), 0)
        return out

    def window_title(hwnd):
        n = user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, buf, n + 1)
        return buf.value

    def window_alive(hwnd):
        return bool(user32.IsWindow(hwnd))

    def focus(hwnd):
        user32.keybd_event(0x12, 0, 0, 0)
        user32.keybd_event(0x12, 0, 0x0002, 0)
        user32.ShowWindow(hwnd, 9)
        user32.SetForegroundWindow(hwnd)
else:
    def list_windows():
        return []

    def window_title(hwnd):
        return ""

    def window_alive(hwnd):
        return False

    def focus(hwnd):
        pass


IGNORE_TITLES = ("steam", "vortex", "chrome", "edge", "program manager", "configurações", "settings")


def find_browser(custom=""):
    cands = [custom] if custom else []
    for env in ("PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"):
        base = os.environ.get(env, "")
        cands += [os.path.join(base, "Google", "Chrome", "Application", "chrome.exe"),
                  os.path.join(base, "Microsoft", "Edge", "Application", "msedge.exe")]
    return next((c for c in cands if c and os.path.isfile(c)), None)


class Session:
    """Abre o jogo, espera a janela e transmite SOMENTE ela num Chrome dedicado."""

    def __init__(self):
        self.game_id = None
        self.browser = None

    @property
    def busy(self):
        return self.game_id is not None

    def run(self, m, cfg, status):
        self.game_id = m["game_id"]
        try:
            self._run(m, cfg, status)
        except Exception as e:
            status("error", f"Erro no PC: {e}")
        finally:
            self._kill_browser()
            self.game_id = None

    def _kill_browser(self):
        if self.browser and self.browser.poll() is None:
            if IS_WIN:
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(self.browser.pid)], capture_output=True)
            else:
                self.browser.terminate()
        self.browser = None

    def _run(self, m, cfg, status):
        import time
        title, path = m["title"], m["path"]
        res = launch(path, m.get("args", ""), cfg["folders"], snapshot=True)
        if not res["ok"]:
            return status("error", res["error"])
        before = res["before"]
        status("launching", f"Abrindo {title} no PC…")
        hwnd, deadline = None, time.time() + cfg["wait"]
        while time.time() < deadline and not hwnd:
            time.sleep(1.5)
            new = [w for w in list_windows() if w[0] not in before and w[2] >= 640 and w[3] >= 360
                   and not any(t in w[1].lower() for t in IGNORE_TITLES)]
            if new:
                hwnd = max(new, key=lambda w: w[2] * w[3])[0]
        if not hwnd:
            return status("error", "A janela do jogo não apareceu. Ele abriu no PC?")
        status("launching", "Jogo aberto, aguardando carregar…")
        time.sleep(5)
        win_title = window_title(hwnd) or title
        source = "Entire screen" if cfg["capture"] == "tela" else win_title
        browser = find_browser(cfg["browser"])
        if not browser:
            return status("error", "Chrome ou Edge não encontrado no PC.")
        from urllib.parse import urlencode
        q = urlencode({"token": cfg["token"], "game": m["game_id"], "pin": cfg["pin"],
                       "audio": cfg["audio"], "mode": cfg["capture"]})
        profile = os.path.join(os.environ.get("LOCALAPPDATA", os.path.expanduser("~")), "VortexHost", "browser")
        status("capturing", "Iniciando transmissão só da janela do jogo…" if cfg["capture"] != "tela" else "Iniciando transmissão…")
        self.browser = subprocess.Popen([
            browser, f"--user-data-dir={profile}", f"--app={cfg['site']}/host-auto?{q}", "--lang=en-US",
            f"--auto-select-desktop-capture-source={source}", "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
            "--no-first-run", "--no-default-browser-check", "--window-size=420,300", "--window-position=0,0",
        ])
        time.sleep(6)
        focus(hwnd)
        while window_alive(hwnd) and self.browser.poll() is None:
            time.sleep(2)
        status("ended", f"{title} foi fechado no PC.")


session = Session()


# ---------------------------------------------------------------- Sunshine
import base64
import ssl
import urllib.request
from pathlib import Path

COVERS = Path(__file__).with_name("covers")


def _sunshine(cfg, method, path, body=None):
    req = urllib.request.Request(cfg["url"].rstrip("/") + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    tok = base64.b64encode(f"{cfg['user']}:{cfg['password']}".encode()).decode()
    req.add_header("Authorization", f"Basic {tok}")
    req.add_header("Content-Type", "application/json")
    ctx = ssl.create_default_context()
    ctx.check_hostname, ctx.verify_mode = False, ssl.CERT_NONE
    with urllib.request.urlopen(req, context=ctx, timeout=10) as r:
        raw = r.read()
        return json.loads(raw) if raw else {}


def _cover_png(name, url):
    if not url:
        return ""
    try:
        from PIL import Image
        COVERS.mkdir(exist_ok=True)
        jpg = COVERS / "tmp.img"
        urllib.request.urlretrieve(url, jpg)
        png = COVERS / ("".join(c for c in name if c.isalnum()) + ".png")
        Image.open(jpg).convert("RGB").save(png)
        return str(png)
    except Exception as e:
        print(f"[capa] {name}: {e}")
        return ""


def sunshine_sync(apps, cfg):
    if not cfg.get("user"):
        return {"t": "sunshine-result", "ok": False, "error": "Inicie o agente com --sunshine-user e --sunshine-pass"}
    try:
        current = _sunshine(cfg, "GET", "/api/apps").get("apps", [])
        names = {a.get("name"): i for i, a in enumerate(current)}
        added = updated = 0
        for app in apps:
            idx = names.get(app["name"], -1)
            body = {"name": app["name"], "output": "", "cmd": app["cmd"], "working-dir": app.get("working-dir", ""),
                    "index": idx, "exclude-global-prep-cmd": False, "elevated": False, "auto-detach": True,
                    "wait-all": True, "exit-timeout": 5, "prep-cmd": [], "detached": [],
                    "image-path": _cover_png(app["name"], app.get("cover"))}
            _sunshine(cfg, "POST", "/api/apps", body)
            if idx < 0:
                added += 1
            else:
                updated += 1
        return {"t": "sunshine-result", "ok": True, "added": added, "updated": updated}
    except Exception as e:
        return {"t": "sunshine-result", "ok": False, "error": f"Sunshine: {e}"}


# ---------------------------------------------------------------- servidor local
def allowed_path(path, folders):
    full = os.path.normcase(os.path.abspath(path))
    return any(full.startswith(os.path.normcase(os.path.abspath(f)) + os.sep) for f in folders if f)


def launch(path, args, folders, snapshot=False):
    if not allowed_path(path, folders):
        return {"t": "launch-result", "ok": False, "error": f"Caminho fora das pastas permitidas: {path}"}
    if not os.path.isfile(path):
        return {"t": "launch-result", "ok": False, "error": f"Arquivo não encontrado: {path}"}
    before = {w[0] for w in list_windows()} if snapshot else None
    subprocess.Popen([path] + (args.split() if args else []), cwd=os.path.dirname(path))
    return {"t": "launch-result", "ok": True, "before": before} if snapshot else {"t": "launch-result", "ok": True}


def handle(msg, folders, sun=None):
    t = msg.get("t")
    if t == "k":
        key(msg["code"], msg["down"])
    elif t == "mm":
        mouse_move(msg["dx"], msg["dy"])
    elif t == "ma":
        mouse_abs(msg["x"], msg["y"])
    elif t == "mb":
        mouse_button(msg["b"], msg["down"])
    elif t == "mw":
        mouse_wheel(msg["dy"])
    elif t == "gp":
        gamepad(msg.get("slot", 0), msg["b"], msg["axes"], msg.get("lt", 0), msg.get("rt", 0))
    elif t == "launch":
        return launch(msg["path"], msg.get("args", ""), folders)
    elif t == "sunshine-sync":
        return sunshine_sync(msg.get("apps", []), sun or {})
    elif t == "release":
        for p in pads.values():
            p.reset()
            p.update()
    return None


def cloud_login(site, email, password):
    req = urllib.request.Request(site.rstrip("/") + "/api/auth/login", method="POST",
                                 data=json.dumps({"email": email, "password": password}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())["token"]


async def cloud(cfg):
    """Mantém o PC 'online' no site e abre jogos sob demanda."""
    import threading
    from urllib.parse import quote
    loop = asyncio.get_running_loop()
    while True:
        try:
            cfg["token"] = await asyncio.to_thread(cloud_login, cfg["site"], cfg["email"], cfg["password"])
            url = cfg["site"].replace("http", "ws", 1).rstrip("/") + f"/api/ws/stream?role=agent&token={quote(cfg['token'])}"
            async with websockets.connect(url, ping_interval=20) as ws:
                print("[ok] conectado ao site: o PC aparece ONLINE para os jogadores")

                def status(state, text):
                    print(f"[sessão] {text}")
                    asyncio.run_coroutine_threadsafe(ws.send(json.dumps({"type": "status", "state": state, "text": text})), loop)

                async for raw in ws:
                    m = json.loads(raw)
                    if m.get("type") != "launch":
                        continue
                    if session.busy:
                        if session.game_id != m["game_id"]:
                            status("error", "Outro jogo já está aberto no PC. Feche-o primeiro.")
                        continue
                    threading.Thread(target=session.run, args=(m, cfg, status), daemon=True).start()
        except Exception as e:
            print(f"[site] desconectado ({e}). Tentando de novo em 5 s…")
            await asyncio.sleep(5)


async def main():
    ap = argparse.ArgumentParser(description="Vortex Host Agent")
    ap.add_argument("--folders", nargs="*", default=[], help="Pastas de jogos permitidas")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--sunshine-url", default="https://localhost:47990")
    ap.add_argument("--sunshine-user", default=os.environ.get("SUNSHINE_USER", ""))
    ap.add_argument("--sunshine-pass", default=os.environ.get("SUNSHINE_PASS", ""))
    ap.add_argument("--site", default=os.environ.get("VORTEX_SITE", ""), help="Endereço do site Vortex")
    ap.add_argument("--email", default=os.environ.get("VORTEX_EMAIL", ""))
    ap.add_argument("--password", default=os.environ.get("VORTEX_PASS", ""))
    ap.add_argument("--capture", default=os.environ.get("VORTEX_CAPTURA", "janela"), choices=["janela", "tela"])
    ap.add_argument("--audio", default=os.environ.get("VORTEX_AUDIO", ""), help="Dispositivo de áudio (ex.: Mixagem estéreo)")
    ap.add_argument("--browser", default=os.environ.get("VORTEX_BROWSER", ""))
    ap.add_argument("--wait", type=int, default=120, help="Segundos esperando a janela do jogo")
    ap.add_argument("--pin", default=os.environ.get("VORTEX_PIN") or f"{secrets.randbelow(10**6):06d}")
    a = ap.parse_args()
    sun = {"url": a.sunshine_url, "user": a.sunshine_user, "password": a.sunshine_pass}

    fails = {"n": 0, "until": 0.0}

    async def serve(ws):
        loop = asyncio.get_running_loop()
        try:
            hello = json.loads(await asyncio.wait_for(ws.recv(), 10))
            if loop.time() < fails["until"] or hello.get("pin") != a.pin:
                fails["n"] += 1
                if fails["n"] >= 5:
                    fails["n"], fails["until"] = 0, loop.time() + 60
                await ws.send(json.dumps({"t": "auth", "ok": False}))
                return
            fails["n"] = 0
            await ws.send(json.dumps({"t": "auth", "ok": True, "gamepad": vg is not None,
                                      "platform": sys.platform, "folders": a.folders,
                                      "sunshine": bool(a.sunshine_user)}))
            print("[ok] navegador host conectado")
            async for raw in ws:
                msg = json.loads(raw)
                res = await asyncio.to_thread(handle, msg, a.folders, sun) if msg.get("t") == "sunshine-sync" else handle(msg, a.folders)
                if res:
                    await ws.send(json.dumps(res))
        except Exception as e:
            print(f"[conexão encerrada] {e}")
        finally:
            handle({"t": "release"}, a.folders)

    print("=" * 52)
    print(f"  Vortex Host Agent  ·  ws://127.0.0.1:{a.port}")
    print(f"  PIN de pareamento: {a.pin}")
    print(f"  Pastas permitidas: {a.folders or '(nenhuma - lançamento desativado)'}")
    print(f"  Sunshine: {'configurado' if a.sunshine_user else 'não configurado'} ({a.sunshine_url})")
    print(f"  Controle Xbox virtual: {'ATIVO' if vg else 'indisponível'}")
    print("=" * 52)
    print(f"  Site: {a.site or '(não configurado: modo manual)'}  ·  captura: {a.capture}")
    cfg = {"site": a.site.rstrip("/"), "email": a.email, "password": a.password, "capture": a.capture,
           "audio": a.audio, "browser": a.browser, "wait": a.wait, "pin": a.pin, "folders": a.folders}
    async with websockets.serve(serve, "127.0.0.1", a.port, max_size=2**16):
        if a.site and a.email:
            await cloud(cfg)
        else:
            await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
