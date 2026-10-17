import React, { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wifi, Server, Zap, Loader2, Check } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

const LaunchContext = createContext(null);

export function LaunchProvider({ children }) {
  const [game, setGame] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [launching, setLaunching] = useState(false);
  const navigate = useNavigate();

  const openLaunch = (g) => {
    setGame(g);
    setSelectedNode(null);
  };
  const close = () => {
    if (!launching) setGame(null);
  };

  useEffect(() => {
    if (game) {
      api.get("/nodes").then(({ data }) => {
        const online = data.filter((n) => n.status === "online");
        setNodes(data);
        const best = [...online].sort((a, b) => a.ping - b.ping)[0] || data[0];
        setSelectedNode(best?.id);
      });
    }
  }, [game]);

  const launch = async () => {
    if (!selectedNode) return;
    setLaunching(true);
    try {
      await api.post("/sessions/start", { game_id: game.id, node_id: selectedNode });
      toast.success(`Conectado ao servidor. Iniciando ${game.title}...`);
      setGame(null);
      navigate("/play");
    } catch (e) {
      toast.error("Não foi possível iniciar a sessão");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <LaunchContext.Provider value={{ openLaunch }}>
      {children}
      <AnimatePresence>
        {game && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6"
            data-testid="launch-dialog"
          >
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={close} />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full max-w-lg overflow-hidden rounded-t-2xl border border-white/10 bg-[#16181B] sm:rounded-md"
            >
              <div className="relative h-40 overflow-hidden">
                <img src={game.hero || game.cover} alt={game.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#16181B] via-[#16181B]/40 to-transparent" />
                <button
                  onClick={close}
                  data-testid="launch-dialog-close"
                  className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="absolute bottom-3 left-4">
                  <p className="font-mono-vx text-xs tracking-widest text-cyan-400">Iniciar Stream</p>
                  <h3 className="font-display text-2xl font-black">{game.title}</h3>
                </div>
              </div>

              <div className="p-5">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <Server className="h-4 w-4 text-cyan-400" /> Escolha o servidor
                </p>
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {nodes.map((n) => {
                    const active = selectedNode === n.id;
                    const disabled = n.status !== "online";
                    return (
                      <button
                        key={n.id}
                        disabled={disabled}
                        data-testid={`launch-node-${n.id}`}
                        onClick={() => setSelectedNode(n.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                          active
                            ? "border-cyan-400 bg-cyan-500/10"
                            : "border-white/8 bg-white/[0.02] hover:border-white/20"
                        } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{n.flag}</span>
                          <div>
                            <p className="text-sm font-bold">{n.name}</p>
                            <p className="text-xs text-slate-400">{n.gpu}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p
                              className={`font-mono-vx text-sm font-bold ${
                                n.ping < 40 ? "text-emerald-400" : n.ping < 150 ? "text-amber-400" : "text-red-400"
                              }`}
                            >
                              {n.ping}ms
                            </p>
                            <p className="font-mono-vx text-[10px] text-slate-500">
                              {n.queue > 0 ? `fila ${n.queue}` : "instantâneo"}
                            </p>
                          </div>
                          {active && <Check className="h-4 w-4 text-cyan-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  data-testid="launch-confirm-button"
                  onClick={launch}
                  disabled={launching || !selectedNode}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3.5 font-display text-lg font-bold tracking-wide text-white transition-all hover:bg-cyan-500 disabled:opacity-50"
                >
                  {launching ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Conectando...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5" /> Jogar Agora
                    </>
                  )}
                </button>
                <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-500">
                  <Wifi className="h-3 w-3" /> Stream 4K HDR · 120 FPS · dependendo apenas da sua internet
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LaunchContext.Provider>
  );
}

export function useLaunch() {
  return useContext(LaunchContext);
}
