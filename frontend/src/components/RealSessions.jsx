import React, { useEffect, useState } from "react";
import { Monitor, Gauge, Activity, Wifi } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const fmtDur = (s) => (s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}min` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`);

export default function RealSessions() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  useEffect(() => { api.get("/streams/history").then(({ data }) => setItems(data)); }, []);
  if (!items) return null;
  const total = items.reduce((s, i) => s + i.duration_seconds, 0);

  return (
    <section className="space-y-3" data-testid="real-sessions">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">Partidas no seu PC</h2>
        <p className="text-sm text-slate-400" data-testid="real-sessions-summary">{items.length} partidas · {fmtDur(total)}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Nenhuma partida real ainda. Jogue um título de Meus Jogos para registrar aqui.</p>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
            <div key={s.id} className="flex items-center gap-4 rounded-md bg-[#1C1F23] p-3" data-testid={`real-session-${s.id}`}>
              <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded bg-black/40">
                {s.game_cover ? <img src={s.game_cover} alt="" className="h-full w-full object-cover" /> : <Monitor className="m-3 h-6 w-6 text-slate-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{s.game_title} {s.active && <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold text-red-400">AO VIVO</span>}</p>
                <p className="text-xs text-slate-400">
                  {new Date(s.started_at).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })} · {fmtDur(s.duration_seconds)}
                  {user?.role === "admin" && s.user_name ? ` · ${s.user_name}` : ""}
                </p>
              </div>
              <div className="hidden gap-4 font-mono-vx text-xs sm:flex">
                <span className="flex items-center gap-1 text-slate-300"><Gauge className="h-3.5 w-3.5 text-cyan-400" />{s.avg_fps} fps</span>
                <span className="flex items-center gap-1 text-slate-300"><Activity className="h-3.5 w-3.5 text-amber-400" />{s.avg_rtt} ms</span>
                <span className="flex items-center gap-1 text-slate-300"><Wifi className="h-3.5 w-3.5 text-slate-400" />{s.avg_mbps} Mbps</span>
                <span className="text-slate-500">{s.res || "—"}</span>
              </div>
              <p className="font-mono-vx text-[11px] text-slate-400 sm:hidden">{s.avg_fps}fps · {s.avg_rtt}ms</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
