export const PAD_BUTTONS = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "VIEW", "MENU", "UP", "DOWN", "LEFT", "RIGHT", "LS", "RS"];
const BIT = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const STICK_KEYS = {
  wasd: ["KeyW", "KeyS", "KeyA", "KeyD"],
  arrows: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"],
};

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => [`Key${l}`, l]);
const digits = "1234567890".split("").map((d) => [`Digit${d}`, d]);
const fkeys = Array.from({ length: 12 }, (_, i) => [`F${i + 1}`, `F${i + 1}`]);
export const KEY_OPTIONS = [
  ["", "—"], ["MouseLeft", "Clique esquerdo"], ["MouseRight", "Clique direito"], ["Space", "Espaço"], ["Enter", "Enter"],
  ["Escape", "Esc"], ["Tab", "Tab"], ["ShiftLeft", "Shift"], ["ControlLeft", "Ctrl"], ["AltLeft", "Alt"], ["Backspace", "Backspace"],
  ["ArrowUp", "Seta ↑"], ["ArrowDown", "Seta ↓"], ["ArrowLeft", "Seta ←"], ["ArrowRight", "Seta →"],
  ...letters, ...digits, ...fkeys,
];
export const STICK_OPTIONS = [["none", "Nada"], ["wasd", "W A S D"], ["arrows", "Setas"], ["mouse", "Mover o mouse"]];

export const DEFAULT_KEYMAP = {
  enabled: true,
  lstick: "wasd",
  rstick: "mouse",
  buttons: { A: "Space", B: "KeyE", X: "KeyR", Y: "KeyQ", LB: "KeyF", RB: "KeyG", LT: "MouseRight", RT: "MouseLeft", VIEW: "Tab", MENU: "Escape", UP: "Digit1", DOWN: "Digit2", LEFT: "Digit3", RIGHT: "Digit4", LS: "ShiftLeft", RS: "ControlLeft" },
};

// Turns gamepad state messages into keyboard / mouse messages
export function createKeymapper(map, send) {
  const srcOn = {};
  const count = {};
  let mouse = [0, 0];

  const emit = (code, down) => {
    if (code === "MouseLeft" || code === "MouseRight") send({ t: "mb", b: code === "MouseLeft" ? 0 : 2, down });
    else send({ t: "k", code, down });
  };
  const set = (src, code, on) => {
    if (!code || !!srcOn[src] === on) return;
    srcOn[src] = on;
    const before = (count[code] || 0) > 0;
    count[code] = (count[code] || 0) + (on ? 1 : -1);
    if (before !== count[code] > 0) emit(code, count[code] > 0);
  };
  const stick = (src, mode, x, y) => {
    if (mode === "mouse") return void (mouse = [x, y]);
    const keys = STICK_KEYS[mode];
    if (!keys) return;
    set(`${src}u`, keys[0], y < -0.4);
    set(`${src}d`, keys[1], y > 0.4);
    set(`${src}l`, keys[2], x < -0.4);
    set(`${src}r`, keys[3], x > 0.4);
  };

  const timer = setInterval(() => {
    const [x, y] = mouse;
    if (Math.abs(x) > 0.1 || Math.abs(y) > 0.1) send({ t: "mm", dx: Math.round(x * 18), dy: Math.round(y * 18) });
  }, 16);

  return {
    handle(m) {
      const p = `${m.slot || 0}:`;
      Object.entries(BIT).forEach(([name, bit]) => set(p + name, map.buttons?.[name], !!(m.b & (1 << bit))));
      set(`${p}LT`, map.buttons?.LT, m.lt > 0.5);
      set(`${p}RT`, map.buttons?.RT, m.rt > 0.5);
      stick(`${p}L`, map.lstick, m.axes[0], m.axes[1]);
      stick(`${p}R`, map.rstick, m.axes[2], m.axes[3]);
    },
    dispose() {
      clearInterval(timer);
      Object.entries(count).forEach(([code, n]) => n > 0 && emit(code, false));
    },
  };
}
