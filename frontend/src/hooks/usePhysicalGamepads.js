import { useEffect, useState } from "react";

const dz = (v) => (Math.abs(v) < 0.08 ? 0 : Math.round(v * 100) / 100);

function readPad(g) {
  let b = 0;
  g.buttons.forEach((bt, i) => {
    if (i !== 6 && i !== 7 && bt.pressed) b |= 1 << i;
  });
  return {
    b,
    axes: [0, 1, 2, 3].map((i) => dz(g.axes[i] || 0)),
    lt: Math.round((g.buttons[6]?.value || 0) * 100) / 100,
    rt: Math.round((g.buttons[7]?.value || 0) * 100) / 100,
  };
}

// Bluetooth/USB controllers via the browser Gamepad API
export default function usePhysicalGamepads(send, enabled) {
  const [pads, setPads] = useState([]);

  useEffect(() => {
    const update = () =>
      setPads(Array.from(navigator.getGamepads?.() || []).filter(Boolean).map((g) => ({ index: g.index, id: g.id })));
    window.addEventListener("gamepadconnected", update);
    window.addEventListener("gamepaddisconnected", update);
    update();
    return () => {
      window.removeEventListener("gamepadconnected", update);
      window.removeEventListener("gamepaddisconnected", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled || !pads.length) return undefined;
    const last = {};
    let raf;
    const loop = () => {
      for (const g of navigator.getGamepads()) {
        if (!g) continue;
        const st = readPad(g);
        const key = JSON.stringify(st);
        if (last[g.index] !== key) {
          last[g.index] = key;
          send({ t: "gp", slot: g.index + 1, ...st });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled, pads.length, send]);

  return pads;
}
