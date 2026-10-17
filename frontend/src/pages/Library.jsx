import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Play, Star, Clock, Trash2, Gamepad2 } from "lucide-react";
import api from "@/lib/api";
import { useLaunch } from "@/context/LaunchContext";
import { toast } from "sonner";

export default function Library() {
  const [games, setGames] = useState([]);
  const [filter, setFilter] = useState("all");
  const { openLaunch } = useLaunch();
  const navigate = useNavigate();

  const load = () => api.get("/library").then(({ data }) => setGames(data));
  useEffect(() => { load(); }, []);

  const toggleFav = async (g) => {
    await api.post(`/library/${g.id}/favorite`);
    load();
  };
  const remove = async (g) => {
    await api.delete(`/library/${g.id}`);
    toast.success(`${g.title} removido`);
    load();
  };

  const shown = filter === "fav" ? games.filter((g) => g.favorite) : games;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Minha Biblioteca</h1>
        <p className="text-sm text-slate-400">{games.length} jogos · {games.reduce((s, g) => s + (g.hours_played || 0), 0).toFixed(1)}h jogadas</p>
      </div>

      <div className="flex gap-2">
        {[["all", "Todos"], ["fav", "Favoritos"]].map(([k, label]) => (
          <button
            key={k}
            data-testid={`library-filter-${k}`}
            onClick={() => setFilter(k)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              filter === k ? "bg-cyan-600 text-white" : "border border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-white/10 py-20 text-center">
          <Gamepad2 className="mb-3 h-10 w-10 text-slate-600" />
          <p className="text-slate-400">Sua biblioteca está vazia.</p>
          <button onClick={() => navigate("/app/catalog")} className="mt-4 rounded-xl bg-cyan-600 px-5 py-2.5 font-bold text-white hover:bg-cyan-500">
            Explorar catálogo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((g, i) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group flex gap-4 overflow-hidden rounded-md border border-white/8 bg-[#1C1F23] p-3"
              data-testid={`library-item-${g.id}`}
            >
              <img src={g.cover} alt={g.title} className="h-28 w-20 flex-shrink-0 rounded-lg object-cover" />
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate font-display text-lg font-bold leading-tight">{g.title}</h3>
                  <button data-testid={`library-fav-${g.id}`} onClick={() => toggleFav(g)}>
                    <Star className={`h-5 w-5 ${g.favorite ? "fill-amber-400 text-amber-400" : "text-slate-500"}`} />
                  </button>
                </div>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3 w-3" /> {(g.hours_played || 0).toFixed(1)}h jogadas
                </p>
                <div className="mt-auto flex gap-2 pt-3">
                  <button
                    data-testid={`library-play-${g.id}`}
                    onClick={() => openLaunch(g)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan-600 py-2 text-sm font-bold text-white hover:bg-cyan-500"
                  >
                    <Play className="h-4 w-4 fill-black" /> Jogar
                  </button>
                  <button
                    data-testid={`library-remove-${g.id}`}
                    onClick={() => remove(g)}
                    className="rounded-lg border border-white/10 px-3 text-slate-400 hover:border-red-500/40 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
