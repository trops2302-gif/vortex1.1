import { useEffect, useRef } from "react";

const PASS = new Set(["F11", "F12"]);

// Keyboard + mouse (pointer lock) + touch-trackpad → remote PC
export default function useRemoteInput({ send, enabled, mode, surfaceRef, videoRef }) {
  const touch = useRef({});

  useEffect(() => {
    if (!enabled) return undefined;
    const key = (down) => (e) => {
      if (PASS.has(e.code) || e.target.tagName === "INPUT" || e.repeat) return;
      e.preventDefault();
      send({ t: "k", code: e.code, down });
    };
    const kd = key(true);
    const ku = key(false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [enabled, send]);

  useEffect(() => {
    const el = surfaceRef.current;
    if (!enabled || !el || mode !== "mouse") return undefined;
    const rel = (e) => {
      const v = videoRef.current;
      const r = v.getBoundingClientRect();
      const vw = v.videoWidth || 16;
      const vh = v.videoHeight || 9;
      const s = Math.min(r.width / vw, r.height / vh);
      const ox = r.left + (r.width - vw * s) / 2;
      const oy = r.top + (r.height - vh * s) / 2;
      return { x: (e.clientX - ox) / (vw * s), y: (e.clientY - oy) / (vh * s) };
    };
    const locked = () => document.pointerLockElement === el;
    const move = (e) => {
      if (e.pointerType === "touch") return;
      if (locked()) send({ t: "mm", dx: e.movementX, dy: e.movementY });
      else send({ t: "ma", ...rel(e) });
    };
    const btn = (down) => (e) => {
      if (e.pointerType === "touch") return;
      if (down && e.button === 0 && !locked() && e.detail === 2) el.requestPointerLock?.();
      send({ t: "mb", b: e.button, down });
    };
    const wheel = (e) => { e.preventDefault(); send({ t: "mw", dy: e.deltaY }); };
    const ctx = (e) => e.preventDefault();
    const md = btn(true);
    const mu = btn(false);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", md);
    el.addEventListener("pointerup", mu);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("contextmenu", ctx);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", md);
      el.removeEventListener("pointerup", mu);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("contextmenu", ctx);
    };
  }, [enabled, mode, send, surfaceRef, videoRef]);

  // touchpad: 1 finger drag = move, tap = left click, 2-finger tap = right click
  useEffect(() => {
    const el = surfaceRef.current;
    if (!enabled || !el || mode !== "touchpad") return undefined;
    const start = (e) => {
      const t = e.touches;
      touch.current = { x: t[0].clientX, y: t[0].clientY, at: Date.now(), moved: 0, fingers: t.length };
    };
    const move = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const c = touch.current;
      const dx = (t.clientX - c.x) * 1.8;
      const dy = (t.clientY - c.y) * 1.8;
      c.x = t.clientX;
      c.y = t.clientY;
      c.moved += Math.abs(dx) + Math.abs(dy);
      if (e.touches.length === 1) send({ t: "mm", dx: Math.round(dx), dy: Math.round(dy) });
      else send({ t: "mw", dy: -dy * 3 });
    };
    const end = (e) => {
      const c = touch.current;
      if (e.touches.length || Date.now() - c.at > 250 || c.moved > 12) return;
      const b = c.fingers >= 2 ? 2 : 0;
      send({ t: "mb", b, down: true });
      setTimeout(() => send({ t: "mb", b, down: false }), 40);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
    };
  }, [enabled, mode, send, surfaceRef]);
}
