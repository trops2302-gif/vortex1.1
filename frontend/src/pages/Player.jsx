import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Maximize, Volume2, VolumeX, Settings2, Loader2, MonitorOff, Gamepad2, MousePointer2, Hand, Ban, Lock, X, Keyboard } from "lucide-react";
import { toast } from "sonner";
import api, { API } from "@/lib/api";
import { createKeymapper, DEFAULT_KEYMAP } from "@/lib/keymap";
import { QUALITY } from "@/lib/stream";
import useViewerEngine from "@/hooks/useViewerEngine";
import useRemoteInput from "@/hooks/useRemoteInput";
import usePhysicalGamepads from "@/hooks/usePhysicalGamepads";
import VirtualGamepad from "@/components/VirtualGamepad";

const IS_TOUCH = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
const MODES = [
  { id: "gamepad", label: "Controle na tela", icon: Gamepad2 },
  { id: "touchpad", label: "Touchpad (mouse)", icon: Hand },
  { id: "mouse", label: "Mouse e teclado", icon: MousePointer2 },
  { id: "none", label: "Só assistir", icon: Ban },
];

function Hud({ stats }) {
  if (!stats) return null;
  const tone = stats.rtt < 40 ? "text-cyan-400" : stats.rtt < 90 ? "text-amber-400" : "text-red-400";
  const items = [["FPS", stats.fps, "hud-fps"], ["PING", `${stats.rtt}ms`, "hud-ping", tone], ["Mbps", stats.mbps, "hud-bitrate"], ["RES", stats.res, "hud-res"], ["BUF", `${stats.jitter}ms`, "hud-buffer"], ["", stats.codec + (stats.relay ? " · TURN" : " · P2P"), "hud-codec"]];
  return (
    <div className="flex flex-wrap gap-1.5 font-mono-vx text-[11px]">
      {items.map(([l, v, id, c]) => (
        <span key={id} data-testid={id} className="rounded bg-black/60 px-2 py-1 text-slate-300 backdrop-blur">
          {l && <span className="mr-1 text-slate-500">{l}</span>}<b className={c || "text-white"}>{v}</b>
        </span>
      ))}
    </div>
  );
}

function Menu({ mode, setMode, quality, setQuality, onLock, onClose, keys, setKeys }) {
  return (
    <div className="absolute right-3 top-14 z-40 w-72 rounded-md border border-white/10 bg-[#16181B]/95 p-3 backdrop-blur-xl" data-testid="player-menu">
      <div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold">Controles</p><button onClick={onClose} data-testid="player-menu-close"><X className="h-4 w-4 text-slate-400" /></button></div>
      {MODES.map((m) => (
        <button key={m.id} data-testid={`player-mode-${m.id}`} onClick={() => setMode(m.id)} className={`flex w-full items-center gap-2 rounded px-3 py-2 text-sm ${mode === m.id ? "bg-cyan-600 text-white" : "text-slate-300 hover:bg-white/5"}`}>
          <m.icon className="h-4 w-4" /> {m.label}
        </button>
      ))}
      {mode === "mouse" && (
        <button data-testid="player-lock-mouse" onClick={onLock} className="mt-1 flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-slate-300 hover:bg-white/5"><Lock className="h-4 w-4" /> Capturar mouse (jogos FPS) · Esc solta</button>
      )}
      <button data-testid="player-keymap-toggle" onClick={() => setKeys(!keys)} className="mt-1 flex w-full items-center justify-between rounded px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
        <span className="flex items-center gap-2"><Keyboard className="h-4 w-4" /> Controle vira teclado</span>
        <span className={`font-mono-vx text-xs ${keys ? "text-cyan-400" : "text-slate-500"}`}>{keys ? "ON" : "OFF"}</span>
      </button>
      <p className="mb-1 mt-3 text-sm font-bold">Qualidade</p>
      {Object.entries(QUALITY).map(([k, q]) => (
        <button key={k} data-testid={`player-quality-${k}`} onClick={() => setQuality(k)} className={`w-full rounded px-3 py-2 text-left text-sm ${quality === k ? "bg-white/15 font-semibold text-white" : "text-slate-400 hover:bg-white/5"}`}>{q.label}</button>
      ))}
    </div>
  );
}

function Overlay({ phase, game, onBack }) {
  const text = {
    connecting: ["Conectando…", "Procurando seu PC"],
    negotiating: ["Conectando ao PC…", "Negociando vídeo e controles"],
    "no-host": ["Seu PC está offline", "Abra Host do PC no computador e clique em Iniciar transmissão. Esta tela conecta sozinha quando ele ficar online."],
    failed: ["Não foi possível conectar", "A rede bloqueou a conexão direta. Tente outra rede ou configure um TURN próprio."],
  }[phase];
  if (!text) return null;
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#0E1012] px-6 text-center" data-testid="player-overlay">
      {game?.hero || game?.cover ? <img src={game.hero || game.cover} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" /> : null}
      <div className="relative flex flex-col items-center gap-3">
        {phase === "no-host" || phase === "failed" ? <MonitorOff className="h-10 w-10 text-slate-400" /> : <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />}
        {game && <p className="text-sm text-slate-400">{game.title}</p>}
        <p className="font-display text-2xl font-extrabold" data-testid="player-phase">{text[0]}</p>
        <p className="max-w-md text-sm text-slate-400">{text[1]}</p>
        <button onClick={onBack} data-testid="player-overlay-back" className="vx-btn vx-btn-ghost mt-2 px-5 py-2.5 text-sm">Voltar</button>
      </div>
    </div>
  );
}

// Records the real session (duration + average quality) for the History page
function useStreamRecord(live, gameId, stats) {
  const sid = useRef(null);
  const latest = useRef(stats);
  latest.current = stats;
  useEffect(() => {
    if (!live || sid.current) return;
    api.post("/streams/start", { game_id: gameId }).then(({ data }) => { sid.current = data.id; });
  }, [live, gameId]);
  useEffect(() => {
    const push = () => {
      const s = latest.current;
      if (sid.current && s) api.post(`/streams/${sid.current}/stats`, { fps: s.fps, rtt: s.rtt, mbps: s.mbps, res: s.res }).catch(() => {});
    };
    const t = setInterval(push, 10000);
    const end = () => {
      if (!sid.current) return;
      fetch(`${API}/streams/${sid.current}/end`, { method: "POST", keepalive: true, credentials: "include", headers: { Authorization: `Bearer ${localStorage.getItem("vx_token")}` } });
      sid.current = null;
    };
    window.addEventListener("pagehide", end);
    return () => { clearInterval(t); window.removeEventListener("pagehide", end); push(); end(); };
  }, []);
}

export default function Player() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const gameId = params.get("game");
  const [game, setGame] = useState(null);
  const [mode, setMode] = useState(IS_TOUCH ? "gamepad" : "mouse");
  const [quality, setQuality] = useState("high");
  const [muted, setMuted] = useState(true);
  const [menu, setMenu] = useState(false);
  const [chrome, setChrome] = useState(true);
  const surfaceRef = useRef(null);
  const containerRef = useRef(null);
  const launched = useRef(false);
  const [keys, setKeys] = useState(false);

  useEffect(() => {
    if (gameId) api.get("/mygames").then(({ data }) => {
      const g = data.find((x) => x.id === gameId) || null;
      setGame(g);
      if (g?.key_map?.enabled) setKeys(true);
    });
  }, [gameId]);

  const onHostMsg = useCallback((m) => {
    if (m.t === "channel-open" && gameId && !launched.current) {
      launched.current = true;
      dcSend.current({ t: "launch", game_id: gameId });
    }
    if (m.t === "agent" && !m.ok) toast.warning("O agente do PC não está pareado: você verá a tela, mas os controles não funcionarão.");
    if (m.t === "launch-result") m.ok ? toast.success("Jogo iniciado no seu PC") : toast.error(m.error);
  }, [gameId]);

  const { phase, stats, videoRef, send } = useViewerEngine({ onHostMsg });
  const dcSend = useRef(send);
  dcSend.current = send;
  const live = phase === "live";
  const mapper = useMemo(() => (keys ? createKeymapper(game?.key_map?.enabled ? game.key_map : DEFAULT_KEYMAP, send) : null), [keys, game, send]);
  useEffect(() => () => mapper?.dispose(), [mapper]);
  const padSend = useCallback((m) => (mapper && m.t === "gp" ? mapper.handle(m) : send(m)), [mapper, send]);
  const pads = usePhysicalGamepads(padSend, live);
  useStreamRecord(live, gameId, stats);
  useRemoteInput({ send, enabled: live && mode !== "none", mode, surfaceRef, videoRef });

  useEffect(() => { if (live) send({ t: "quality", preset: quality }); }, [quality, live, send]);
  useEffect(() => { if (pads.length) toast.success(`Controle conectado: ${pads[pads.length - 1].id.split("(")[0]}`); }, [pads]);
  useEffect(() => {
    if (!live || menu) return undefined;
    const t = setTimeout(() => setChrome(false), 3500);
    return () => clearTimeout(t);
  }, [live, menu, chrome]);

  const fullscreen = async () => {
    try {
      await containerRef.current.requestFullscreen?.();
      await window.screen.orientation?.lock?.("landscape");
    } catch { /* not supported */ }
  };
  const toggleSound = () => {
    const v = videoRef.current;
    v.muted = !muted;
    v.play?.().catch(() => {});
    setMuted(!muted);
  };
  const back = () => navigate("/app/mygames");
  const showPad = live && mode === "gamepad" && pads.length === 0;

  return (
    <div ref={containerRef} className="relative h-[100dvh] w-full overflow-hidden bg-black" data-testid="player-page" onPointerDown={() => setChrome(true)}>
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-contain" data-testid="player-video" />
      <div ref={surfaceRef} className="absolute inset-0 z-10" style={{ touchAction: "none", cursor: mode === "mouse" ? "crosshair" : "default" }} data-testid="player-surface" />

      {showPad && <VirtualGamepad send={padSend} />}

      <div className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-3 transition-opacity duration-300 ${chrome || !live ? "opacity-100" : "opacity-30 hover:opacity-100"}`}>
        <div className="pointer-events-auto flex items-start gap-2">
          <button onClick={back} data-testid="player-back" className="vx-btn bg-black/60 p-2.5 text-white backdrop-blur"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            {game && <p className="mb-1 text-sm font-semibold text-white drop-shadow">{game.title}</p>}
            <Hud stats={stats} />
          </div>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <button onClick={toggleSound} data-testid="player-sound" className="vx-btn bg-black/60 p-2.5 text-white backdrop-blur">{muted ? <VolumeX className="h-5 w-5 text-amber-400" /> : <Volume2 className="h-5 w-5" />}</button>
          <button onClick={() => setMenu((m) => !m)} data-testid="player-menu-button" className="vx-btn bg-black/60 p-2.5 text-white backdrop-blur"><Settings2 className="h-5 w-5" /></button>
          <button onClick={fullscreen} data-testid="player-fullscreen" className="vx-btn bg-black/60 p-2.5 text-white backdrop-blur"><Maximize className="h-5 w-5" /></button>
        </div>
      </div>

      {menu && <Menu keys={keys} setKeys={setKeys} mode={mode} setMode={setMode} quality={quality} setQuality={setQuality} onClose={() => setMenu(false)} onLock={() => { surfaceRef.current.requestPointerLock?.(); setMenu(false); }} />}
      {live && muted && (
        <button onClick={toggleSound} data-testid="player-unmute-hint" className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/70 px-4 py-2 text-xs text-white backdrop-blur" style={{ display: showPad ? "none" : undefined }}>Toque para ativar o som</button>
      )}
      <Overlay phase={phase} game={game} onBack={back} />
    </div>
  );
}
