import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Play, Star, HardDrive, Calendar, Plus, Check } from "lucide-react";
import api from "@/lib/api";
import GameCard from "@/components/GameCard";
import { useLaunch } from "@/context/LaunchContext";
import { toast } from "sonner";

export default function Catalog() {
  const [games, setGames] = useState([]);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("Todos");
  const [detail, setDetail] = useState(null);
  const [library, setLibrary] = useState([]);
  const { openLaunch } = useLaunch();

  const refresh = () => api.get("/library").then(({ data }) => setLibrary(data.map((g) => g.id)));

  useEffect(() => {
    api.get("/games").then(({ data }) => setGames(data));
    refresh();
  }, []);

  const genres = useMemo(() => {
    const set = new Set(games.map((g) => g.genre));
    return ["Todos", ...Array.from(set)];
  }, [games]);

  const filtered = games.filter((g) => {
    const matchQuery = g.title.toLowerCase().includes(query.toLowerCase());
    const matchGenre = genre === "Todos" || g.genre === genre;
    return matchQuery && matchGenre;
  });

  const addToLibrary = async (g) => {
    await api.post(`/library/${g.id}`);
    toast.success(`${g.title} adicionado à biblioteca`);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Catálogo</h1>
        <p className="text-sm text-slate-400">{games.length} jogos disponíveis para streaming instantâneo</p>
      </div>

      {/* search + filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            data-testid="catalog-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar jogo..."
            className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => (
            <button
              key={g}
              data-testid={`catalog-genre-${g}`}
              onClick={() => setGenre(g)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                genre === g ? "bg-cyan-600 text-white" : "border border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-slate-500">Nenhum jogo encontrado.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filtered.map((g, i) => (
            <GameCard key={g.id} game={g} index={i} onInfo={setDetail} />
          ))}
        </div>
      )}

      {/* detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center sm:p-6"
            data-testid="game-detail-modal"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDetail(null)} />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-t-2xl border border-white/10 bg-[#16181B] sm:rounded-md"
            >
              <div className="relative h-52 sm:h-64">
                <img src={detail.hero} alt={detail.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#16181B] to-transparent" />
                <button
                  onClick={() => setDetail(null)}
                  data-testid="game-detail-close"
                  className="absolute right-3 top-3 rounded-full bg-black/50 p-2 hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-3xl font-black">{detail.title}</h2>
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 font-mono-vx text-xs font-bold text-amber-400">
                    <Star className="h-3 w-3 fill-amber-400" /> {detail.rating}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400">{detail.studio} · {detail.genre}</p>
                <p className="mt-4 text-sm text-slate-300">{detail.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {detail.tags?.map((t) => (
                    <span key={t} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{t}</span>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-5 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><HardDrive className="h-4 w-4" /> {detail.size_gb} GB</span>
                  <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {detail.year}</span>
                  {detail.hdr && <span className="font-mono-vx font-bold text-cyan-400">4K HDR</span>}
                </div>
                <div className="mt-6 flex gap-3">
                  <button
                    data-testid="detail-play-button"
                    onClick={() => { const g = detail; setDetail(null); openLaunch(g); }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 font-display text-lg font-bold text-white hover:bg-cyan-500"
                  >
                    <Play className="h-5 w-5 fill-black" /> Jogar
                  </button>
                  {library.includes(detail.id) ? (
                    <button disabled className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 px-5 py-3 font-semibold text-emerald-400">
                      <Check className="h-5 w-5" /> Na biblioteca
                    </button>
                  ) : (
                    <button
                      data-testid="detail-add-library-button"
                      onClick={() => addToLibrary(detail)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold hover:bg-white/5"
                    >
                      <Plus className="h-5 w-5" /> Biblioteca
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
