import React, { useCallback, useRef } from "react";

const BIT = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15, GUIDE: 16 };
const FACE = { A: "#5FC63F", B: "#E5484D", X: "#3E8EED", Y: "#F2B63D" };

function buzz() {
  navigator.vibrate?.(8);
}

function Stick({ onMove, testid }) {
  const base = useRef(null);
  const knob = useRef(null);
  const active = useRef(null);

  const update = (e) => {
    const r = base.current.getBoundingClientRect();
    const rad = r.width / 2;
    let dx = e.clientX - (r.left + rad);
    let dy = e.clientY - (r.top + rad);
    const d = Math.hypot(dx, dy);
    if (d > rad) { dx = (dx / d) * rad; dy = (dy / d) * rad; }
    knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    onMove(Math.round((dx / rad) * 100) / 100, Math.round((dy / rad) * 100) / 100);
  };
  const down = (e) => {
    active.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    update(e);
  };
  const move = (e) => active.current === e.pointerId && update(e);
  const up = (e) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    knob.current.style.transform = "translate(0,0)";
    onMove(0, 0);
  };

  return (
    <div
      ref={base}
      data-testid={testid}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className="vx-pad-btn relative flex h-32 w-32 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-sm"
    >
      <div ref={knob} className="pointer-events-none h-14 w-14 rounded-full border border-white/25 bg-white/20 shadow-lg transition-transform duration-75" />
    </div>
  );
}

function PadButton({ id, label, onPress, className = "", style }) {
  const handle = (down) => (e) => {
    e.preventDefault();
    if (down) { e.currentTarget.setPointerCapture?.(e.pointerId); buzz(); }
    e.currentTarget.dataset.on = down ? "1" : "";
    onPress(id, down);
  };
  return (
    <button
      type="button"
      data-testid={`vpad-${id.toLowerCase()}`}
      onPointerDown={handle(true)}
      onPointerUp={handle(false)}
      onPointerCancel={handle(false)}
      onContextMenu={(e) => e.preventDefault()}
      style={style}
      className={`vx-pad-btn flex items-center justify-center border border-white/15 bg-black/35 text-sm font-bold text-white/90 backdrop-blur-sm data-[on=1]:scale-90 data-[on=1]:bg-white/30 ${className}`}
    >
      {label}
    </button>
  );
}

export default function VirtualGamepad({ send }) {
  const st = useRef({ b: 0, axes: [0, 0, 0, 0], lt: 0, rt: 0 });
  const emit = useCallback(() => send({ t: "gp", slot: 0, ...st.current, axes: [...st.current.axes] }), [send]);

  const press = useCallback((id, down) => {
    if (id === "LT" || id === "RT") st.current[id.toLowerCase()] = down ? 1 : 0;
    else st.current.b = down ? st.current.b | (1 << BIT[id]) : st.current.b & ~(1 << BIT[id]);
    emit();
  }, [emit]);

  const stick = (i) => (x, y) => {
    st.current.axes[i] = x;
    st.current.axes[i + 1] = y;
    emit();
  };

  const face = (id, pos) => (
    <PadButton id={id} label={id} onPress={press} className={`absolute h-14 w-14 rounded-full ${pos}`} style={{ color: FACE[id], borderColor: `${FACE[id]}66` }} />
  );
  const dir = (id, pos, label) => <PadButton id={id} label={label} onPress={press} className={`absolute h-11 w-11 rounded-md ${pos}`} />;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none" data-testid="virtual-gamepad">
      {/* shoulders */}
      <div className="pointer-events-auto absolute left-4 top-16 flex gap-2">
        <PadButton id="LT" label="LT" onPress={press} className="h-11 w-16 rounded-t-xl rounded-b-md" />
        <PadButton id="LB" label="LB" onPress={press} className="h-11 w-16 rounded-md" />
      </div>
      <div className="pointer-events-auto absolute right-4 top-16 flex gap-2">
        <PadButton id="RB" label="RB" onPress={press} className="h-11 w-16 rounded-md" />
        <PadButton id="RT" label="RT" onPress={press} className="h-11 w-16 rounded-t-xl rounded-b-md" />
      </div>

      {/* left cluster */}
      <div className="pointer-events-auto absolute bottom-6 left-6 flex items-end gap-6">
        <div className="flex flex-col items-center gap-2">
          <Stick onMove={stick(0)} testid="vpad-left-stick" />
          <PadButton id="LS" label="L3" onPress={press} className="h-8 w-12 rounded-full text-xs" />
        </div>
        <div className="relative mb-2 h-36 w-36">
          {dir("UP", "left-1/2 top-0 -translate-x-1/2", "▲")}
          {dir("DOWN", "bottom-0 left-1/2 -translate-x-1/2", "▼")}
          {dir("LEFT", "left-0 top-1/2 -translate-y-1/2", "◀")}
          {dir("RIGHT", "right-0 top-1/2 -translate-y-1/2", "▶")}
        </div>
      </div>

      {/* center */}
      <div className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3">
        <PadButton id="VIEW" label="⧉" onPress={press} className="h-9 w-9 rounded-full" />
        <PadButton id="GUIDE" label="X" onPress={press} className="h-11 w-11 rounded-full border-cyan-400/60 text-cyan-300" />
        <PadButton id="MENU" label="≡" onPress={press} className="h-9 w-9 rounded-full" />
      </div>

      {/* right cluster */}
      <div className="pointer-events-auto absolute bottom-6 right-6 flex items-end gap-6">
        <div className="flex flex-col items-center gap-2">
          <Stick onMove={stick(2)} testid="vpad-right-stick" />
          <PadButton id="RS" label="R3" onPress={press} className="h-8 w-12 rounded-full text-xs" />
        </div>
        <div className="relative order-first mb-2 h-40 w-40">
          {face("Y", "left-1/2 top-0 -translate-x-1/2")}
          {face("A", "bottom-0 left-1/2 -translate-x-1/2")}
          {face("X", "left-0 top-1/2 -translate-y-1/2")}
          {face("B", "right-0 top-1/2 -translate-y-1/2")}
        </div>
      </div>
    </div>
  );
}
