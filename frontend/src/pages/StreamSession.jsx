import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Gauge, Wifi, Film, Power, Save, Settings, Gamepad2,
  Loader2, Maximize, X, Signal,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const QUALITIES = ["4K HDR", "1440p", "1080p", "720p"];

function Hud({ metrics }) {
  if (!metrics) return null;
  const pingColor = metrics.ping < 40 ? "text-emerald-400" : metrics.ping < 150 ? "text-amber-400" : "text-red-400";
  const items = [
    { icon: Gauge, label: "FPS", value: metrics.fps, c: "text-cyan-400", test: "hud-fps" },
    { icon: Activity, label: "PING", value: `${metrics.ping}ms`, c: pingColor, test: "hud-ping" },
    { icon: Wifi, label: "BITRATE", value: `${metrics.bitrate}M`, c: "text-violet-400", test: "hud-bitrate" },
    { icon: Film, label: "RES", value: metrics.resolution, c: "text-amber-400", test: "hud-resolution" },
    { icon: Signal, label: "LOSS", value: `${metrics.packet_loss}%`, c: "text-emerald-400", test: "hud-loss" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => (
        <div key={it.label} data-testid={`game-${it.test}-indicator`} className="flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 backdrop-blur">
          <it.icon className={`h-3.5 w-3.5 ${it.c}`} />
          <span className="font-mono-vx text-[10px] text-slate-400">{it.label}</span>
          <span className={`font-mono-vx text-xs font-bold ${it.c}`}>{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function GamepadOverlay() {
  const btns = ["Y", "X", "B", "A"];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-4 lg:hidden">
      {/* dpad */}
      <div className="pointer-events-auto relative h-28 w-28 opacity-80">
        <div className="absolute left-1/2 top-0 h-9 w-9 -translate-x-1/2 rounded-lg bg-white/10 backdrop-blur active:bg-cyan-600/40" />
        <div className="absolute bottom-0 left-1/2 h-9 w-9 -translate-x-1/2 rounded-lg bg-white/10 backdrop-blur active:bg-cyan-600/40" />
        <div className="absolute left-0 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg bg-white/10 backdrop-blur active:bg-cyan-600/40" />
        <div className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 rounded-lg bg-white/10 backdrop-blur active:bg-cyan-600/40" />
      </div>
      {/* action buttons */}
      <div className="pointer-events-auto relative h-28 w-28 opacity-80">
        <span className="absolute left-1/2 top-0 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-yellow-400/30 font-mono-vx text-xs font-bold backdrop-blur active:bg-yellow-400/60">{btns[0]}</span>
        <span className="absolute left-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-blue-400/30 font-mono-vx text-xs font-bold backdrop-blur active:bg-blue-400/60">{btns[1]}</span>
        <span className="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-red-400/30 font-mono-vx text-xs font-bold backdrop-blur active:bg-red-400/60">{btns[2]}</span>
        <span className="absolute bottom-0 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-emerald-400/30 font-mono-vx text-xs font-bold backdrop-blur active:bg-emerald-400/60">{btns[3]}</span>
      </div>
    </div>
  );
}

export default function StreamSession() {
  const navigate = useNavigate();
  const [data, setData] = useState(undefined); // undefined=loading, null=none
  const [metrics, setMetrics] = useState(null);
  const [connecting, setConnecting] = useState(true);
  const [quality, setQuality] = useState("4K HDR");
  const [showSettings, setShowSettings] = useState(false);
  const [showPad, setShowPad] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    api.get("/sessions/active").then(({ data }) => {
      if (!data.session) {
        setData(null);
      } else {
        setData(data);
        setTimeout(() => setConnecting(false), 2200);
      }
    });
  }, []);

  const pollMetrics = useCallback((sessionId) => {
    api.get(`/sessions/${sessionId}/metrics`).then(({ data }) => setMetrics(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (data && data.session && !connecting) {
      pollMetrics(data.session.id);
      const m = setInterval(() => pollMetrics(data.session.id), 1500);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => {
        clearInterval(m);
        clearInterval(timerRef.current);
      };
    }
  }, [data, connecting, pollMetrics]);

  const endSession = async () => {
    if (data?.session) await api.post(`/sessions/${data.session.id}/end`);
    toast.success("Sessão encerrada");
    navigate("/app");
  };

  const quickSave = async () => {
    if (!data?.session) return;
    await api.post("/saves", { game_id: data.session.game_id, label: `Save rápido ${fmtTime(elapsed)}`, session_id: data.session.id });
    toast.success("Progresso salvo na nuvem ☁️");
  };

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (data === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black px-4 text-center">
        <Gamepad2 className="h-12 w-12 text-slate-600" />
        <p className="text-slate-300">Nenhuma sessão ativa no momento.</p>
        <button onClick={() => navigate("/app/catalog")} className="rounded-xl bg-cyan-600 px-6 py-3 font-display font-bold text-white hover:bg-cyan-500">
          Escolher um jogo
        </button>
      </div>
    );
  }

  const { game, node } = data;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black" data-testid="stream-session">
      {/* video surface */}
      <div className="absolute inset-0">
        <img src={game.hero} alt={game.title} className="h-full w-full object-cover opacity-90" />
        <div className="absolute inset-0 vx-scanlines opacity-40" />
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* connecting overlay */}
      <AnimatePresence>
        {connecting && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90"
            data-testid="stream-connecting"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 vx-ping-ring rounded-full border-2 border-cyan-400" />
              <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-cyan-400 bg-cyan-500/10">
                <Activity className="h-8 w-8 text-cyan-400" />
              </div>
            </div>
            <p className="font-display text-2xl font-black tracking-wide">Conectando ao servidor</p>
            <p className="mt-1 font-mono-vx text-sm text-cyan-400">{node.flag} {node.name} · {node.gpu}</p>
            <p className="mt-4 max-w-xs text-center text-xs text-slate-500">
              Alocando GPU · iniciando {game.title} · negociando stream de vídeo...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg bg-black/60 px-3 py-1.5 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span className="font-mono-vx text-xs font-bold text-red-400">AO VIVO</span>
            <span className="font-display text-sm font-bold">{game.title}</span>
            <span className="font-mono-vx text-xs text-slate-400">· {fmtTime(elapsed)}</span>
          </div>
          <Hud metrics={metrics} />
        </div>

        <div className="flex gap-2">
          <button data-testid="stream-settings-button" onClick={() => setShowSettings((s) => !s)} className="rounded-lg bg-black/60 p-2.5 backdrop-blur hover:bg-black/80">
            <Settings className="h-5 w-5 text-slate-200" />
          </button>
          <button data-testid="stream-fullscreen-button" onClick={() => document.documentElement.requestFullscreen?.()} className="rounded-lg bg-black/60 p-2.5 backdrop-blur hover:bg-black/80">
            <Maximize className="h-5 w-5 text-slate-200" />
          </button>
        </div>
      </div>

      {/* settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-4 top-20 z-40 w-64 rounded-md border border-white/10 bg-[#16181B]/95 p-4 backdrop-blur-xl"
            data-testid="stream-settings-panel"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-sm font-bold">Qualidade</p>
              <button onClick={() => setShowSettings(false)}><X className="h-4 w-4 text-slate-400" /></button>
            </div>
            <div className="space-y-1.5">
              {QUALITIES.map((q) => (
                <button
                  key={q}
                  data-testid={`stream-quality-${q}`}
                  onClick={() => { setQuality(q); toast.success(`Qualidade: ${q}`); }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${quality === q ? "bg-cyan-600 font-bold text-white" : "text-slate-300 hover:bg-white/5"}`}
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="mt-3 border-t border-white/10 pt-3">
              <button
                data-testid="toggle-gamepad-button"
                onClick={() => setShowPad((p) => !p)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                <span className="flex items-center gap-2"><Gamepad2 className="h-4 w-4" /> Controle na tela</span>
                <span className={`font-mono-vx text-xs ${showPad ? "text-emerald-400" : "text-slate-500"}`}>{showPad ? "ON" : "OFF"}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* touch gamepad */}
      {showPad && !connecting && <GamepadOverlay />}

      {/* bottom action bar */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3 p-4 lg:justify-center">
        <div className="flex gap-3 rounded-md bg-black/60 p-2 backdrop-blur-xl">
          <button
            data-testid="quick-save-button"
            onClick={quickSave}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20"
          >
            <Save className="h-4 w-4 text-cyan-400" /> Save rápido
          </button>
          <button
            data-testid="end-session-button"
            onClick={endSession}
            className="flex items-center gap-2 rounded-xl bg-red-500/90 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-500"
          >
            <Power className="h-4 w-4" /> Encerrar
          </button>
        </div>
      </div>
    </div>
  );
}
