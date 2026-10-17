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


# ---------------------------------------------------------------- servidor local
def allowed_path(path, folders):
    full = os.path.normcase(os.path.abspath(path))
    return any(full.startswith(os.path.normcase(os.path.abspath(f)) + os.sep) for f in folders if f)


def launch(path, args, folders):
    if not allowed_path(path, folders):
        return {"t": "launch-result", "ok": False, "error": "Caminho fora das pastas permitidas"}
    if not os.path.isfile(path):
        return {"t": "launch-result", "ok": False, "error": f"Arquivo não encontrado: {path}"}
    subprocess.Popen([path] + (args.split() if args else []), cwd=os.path.dirname(path))
    return {"t": "launch-result", "ok": True}


def handle(msg, folders):
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
    elif t == "release":
        for p in pads.values():
            p.reset()
            p.update()
    return None


async def main():
    ap = argparse.ArgumentParser(description="Vortex Host Agent")
    ap.add_argument("--folders", nargs="*", default=[], help="Pastas de jogos permitidas")
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--pin", default=os.environ.get("VORTEX_PIN") or f"{secrets.randbelow(10**6):06d}")
    a = ap.parse_args()

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
                                      "platform": sys.platform, "folders": a.folders}))
            print("[ok] navegador host conectado")
            async for raw in ws:
                res = handle(json.loads(raw), a.folders)
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
    print(f"  Controle Xbox virtual: {'ATIVO' if vg else 'indisponível'}")
    print("=" * 52)
    async with websockets.serve(serve, "127.0.0.1", a.port, max_size=2**16):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
