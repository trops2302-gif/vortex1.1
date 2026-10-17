import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Server, Save, Radio, History as HistoryIcon } from "lucide-react";
import api from "@/lib/api";

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/sessions/history").then(({ data }) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  const fmtDuration = (s) => {
    if (s < 60) return `${s}s`;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };
  const fmtDate = (iso) =>
    new Date(iso).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });

  const totalSeconds = items.reduce((s, i) => s + (i.duration_seconds || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Histórico de Sessões</h1>
        <p className="text-sm text-slate-400">
          {items.length} partidas · {fmtDuration(totalSeconds)} de tempo total em streaming
        </p>
      </div>

      {loading ? (
        <p className="py-16 text-center text-slate-500">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-white/10 py-20 text-center">
          <HistoryIcon className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-slate-400">Nenhuma sessão ainda. Inicie um jogo para registrar seu histórico.</p>
        </div>
      ) : (
        <div className="relative space-y-4 pl-6">
          {/* timeline line */}
          <div className="absolute bottom-2 left-[9px] top-2 w-px bg-gradient-to-b from-cyan-500/60 via-white/10 to-transparent" />
          {items.map((it, i) => (
            <motion.div
              key={it.id}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative"
              data-testid={`history-item-${it.id}`}
            >
              {/* dot */}
              <span
                className={`absolute -left-[22px] top-5 h-3.5 w-3.5 rounded-full border-2 ${
                  it.active ? "border-red-400 bg-red-500" : "border-cyan-400 bg-[#0E1012]"
                }`}
              />
              <div className="flex gap-4 overflow-hidden rounded-md border border-white/8 bg-[#1C1F23] p-3">
                {it.game && (
                  <img src={it.game.cover} alt={it.game.title} className="h-24 w-16 flex-shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-display text-lg font-bold leading-tight">
                      {it.game?.title || "Jogo"}
                    </h3>
                    {it.active ? (
                      <span className="flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                        <Radio className="h-3 w-3" /> ao vivo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono-vx text-[11px] font-bold text-cyan-400">
                        <Clock className="h-3 w-3" /> {fmtDuration(it.duration_seconds)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{fmtDate(it.started_at)}</p>
                  {it.node && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-300">
                      <Server className="h-3.5 w-3.5 text-cyan-400" />
                      {it.node.flag} {it.node.name} · {it.node.gpu}
                    </p>
                  )}
                  {it.saves.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {it.saves.map((s) => (
                        <span
                          key={s.id}
                          className="flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] text-violet-300"
                        >
                          <Save className="h-3 w-3" /> {s.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
