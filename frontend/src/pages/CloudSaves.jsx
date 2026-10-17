import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Plus, Trash2, RefreshCw, HardDrive, X, Check } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

export default function CloudSaves() {
  const [saves, setSaves] = useState([]);
  const [games, setGames] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [selectedGame, setSelectedGame] = useState("");
  const [label, setLabel] = useState("");

  const load = () => api.get("/saves").then(({ data }) => setSaves(data));
  useEffect(() => {
    load();
    api.get("/library").then(({ data }) => setGames(data.length ? data : []));
    api.get("/games").then(({ data }) => setGames((prev) => (prev.length ? prev : data)));
  }, []);

  const createSave = async () => {
    if (!selectedGame) return toast.error("Escolha um jogo");
    await api.post("/saves", { game_id: selectedGame, label: label || null });
    toast.success("Save criado e sincronizado");
    setShowNew(false);
    setLabel("");
    setSelectedGame("");
    load();
  };

  const del = async (s) => {
    await api.delete(`/saves/${s.id}`);
    toast.success("Save excluído");
    load();
  };

  const fmtDate = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Saves na Nuvem</h1>
          <p className="text-sm text-slate-400">{saves.length} saves sincronizados · continue em qualquer aparelho</p>
        </div>
        <button
          data-testid="new-save-button"
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-500"
        >
          <Plus className="h-4 w-4" /> Novo save
        </button>
      </div>

      {saves.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-white/10 py-20 text-center">
          <Cloud className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-slate-400">Nenhum save na nuvem ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {saves.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="overflow-hidden rounded-md border border-white/8 bg-[#1C1F23]"
              data-testid={`cloud-save-item-${s.id}`}
            >
              <div className="relative h-28">
                <img src={s.game_cover} alt={s.game_title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1C1F23] to-transparent" />
                <div className="absolute bottom-2 left-3">
                  <p className="font-display text-base font-bold leading-tight">{s.game_title}</p>
                  <p className="text-xs text-cyan-300">{s.label}</p>
                </div>
                <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5">
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="font-mono-vx text-[10px] text-emerald-400">sync</span>
                </div>
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="text-xs text-slate-400">
                  <p>{fmtDate(s.created_at)}</p>
                  <p className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {s.size_mb} MB</p>
                </div>
                <div className="flex gap-2">
                  <button
                    data-testid={`restore-save-${s.id}`}
                    onClick={() => toast.success(`Restaurando "${s.label}"...`)}
                    className="rounded-lg border border-white/10 p-2 text-cyan-400 hover:bg-white/5"
                    title="Restaurar"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    data-testid={`delete-save-${s.id}`}
                    onClick={() => del(s)}
                    className="rounded-lg border border-white/10 p-2 text-slate-400 hover:border-red-500/40 hover:text-red-400"
                    title="Excluir"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* new save modal */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-center justify-center p-4"
            data-testid="new-save-modal"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowNew(false)} />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-md border border-white/10 bg-[#16181B] p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xl font-bold">Novo save na nuvem</h3>
                <button onClick={() => setShowNew(false)}><X className="h-5 w-5 text-slate-400" /></button>
              </div>
              <label className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-400">Jogo</label>
              <select
                data-testid="new-save-game-select"
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
                className="mb-4 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="">Selecione...</option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
              <label className="mb-1.5 block text-xs font-semibold tracking-wide text-slate-400">Nome do save (opcional)</label>
              <input
                data-testid="new-save-label-input"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Antes do chefe final"
                className="mb-5 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
              <button
                data-testid="new-save-confirm-button"
                onClick={createSave}
                className="w-full rounded-xl bg-cyan-600 py-3 font-display text-lg font-bold text-white hover:bg-cyan-500"
              >
                Salvar na nuvem
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
