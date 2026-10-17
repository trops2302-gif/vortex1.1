import React from "react";
import { useNavigate } from "react-router-dom";
import { X, Play, MonitorSmartphone, Pencil, Trash2 } from "lucide-react";
import { gamePath } from "@/lib/stream";

export function GameArt({ game, className = "", wide = false }) {
  const src = wide ? game.hero || game.cover : game.cover;
  if (src) return <img src={src} alt={game.title} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`flex h-full w-full items-end bg-gradient-to-br from-[#1f3a1f] via-[#16181B] to-[#0E1012] p-3 ${className}`}>
      <span className="font-display text-lg font-extrabold leading-tight text-white/90">{game.title}</span>
    </div>
  );
}

export default function MyGameSheet({ game, settings, hostOnline, isAdmin, onClose, onEdit, onDelete }) {
  const navigate = useNavigate();
  const moonlightHost = settings?.moonlight_host;
  const isAndroid = /Android/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center" data-testid="mygame-sheet">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-t-lg bg-[#16181B] sm:rounded-lg">
        <div className="relative h-48">
          <GameArt game={game} wide />
          <div className="absolute inset-0 bg-gradient-to-t from-[#16181B] to-transparent" />
          <button onClick={onClose} data-testid="mygame-sheet-close" className="absolute right-3 top-3 rounded-full bg-black/60 p-2"><X className="h-4 w-4" /></button>
          <div className="absolute bottom-3 left-5">
            <p className="text-xs font-semibold text-cyan-400">{game.genre || "Jogo do PC"}</p>
            <h3 className="font-display text-3xl font-extrabold">{game.title}</h3>
          </div>
        </div>
        <div className="space-y-3 p-5">
          {isAdmin && <p className="break-all font-mono-vx text-[11px] text-slate-500">{gamePath(game, settings)}</p>}
          <button data-testid="mygame-play-browser" onClick={() => navigate(`/stream?game=${game.id}`)} className="vx-btn vx-btn-primary w-full py-3.5 text-base">
            <Play className="h-5 w-5 fill-white" /> Jogar no navegador
          </button>
          {!hostOnline && <p className="text-center text-xs text-amber-400" data-testid="mygame-host-offline">{isAdmin ? "Seu PC está offline: abra “Host do PC” no computador antes." : "O PC servidor está offline no momento."}</p>}
          <div className="rounded bg-black/30 p-4" data-testid="mygame-moonlight-box">
            <p className="flex items-center gap-2 text-sm font-semibold"><MonitorSmartphone className="h-4 w-4 text-cyan-400" /> Abrir no Moonlight (menor latência)</p>
            <p className="mt-1 text-xs text-slate-400">
              {isAdmin ? "Sincronize com o Sunshine (Host do PC), depois no" : "No"} app Moonlight escolha {moonlightHost ? <b className="text-slate-200">{moonlightHost}</b> : "seu PC"} → <b className="text-slate-200">{game.title}</b>.
            </p>
            {isAndroid && (
              <a href="intent://#Intent;package=com.limelight;end" data-testid="mygame-open-moonlight" className="vx-btn vx-btn-ghost mt-3 w-full py-2.5 text-sm">Abrir app Moonlight</a>
            )}
          </div>
          {isAdmin && <div className="flex gap-2">
            <button data-testid="mygame-edit-button" onClick={onEdit} className="vx-btn vx-btn-ghost flex-1 py-2.5 text-sm"><Pencil className="h-4 w-4" /> Editar</button>
            <button data-testid="mygame-delete-button" onClick={onDelete} className="vx-btn flex-1 bg-red-500/10 py-2.5 text-sm text-red-400 hover:bg-red-500/20"><Trash2 className="h-4 w-4" /> Remover</button>
          </div>}
        </div>
      </div>
    </div>
  );
}
