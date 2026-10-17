import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Cpu, Activity, Users, RefreshCw, Gauge } from "lucide-react";
import api from "@/lib/api";

function LoadBar({ value, color }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/40">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.6 }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

export default function ServerStatus() {
  const [nodes, setNodes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data } = await api.get("/nodes");
    setNodes(data);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Servidores</h1>
          <p className="text-sm text-slate-400">Status em tempo real dos nós de streaming</p>
        </div>
        <button
          data-testid="refresh-nodes-button"
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {nodes.map((n, i) => {
          const pingColor = n.ping < 40 ? "text-emerald-400" : n.ping < 150 ? "text-amber-400" : "text-red-400";
          const loadColor = n.load < 70 ? "bg-emerald-400" : n.load < 90 ? "bg-amber-400" : "bg-red-400";
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-md border border-white/8 bg-[#1C1F23] p-5"
              data-testid={`server-node-${n.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{n.flag}</span>
                  <div>
                    <h3 className="font-display text-xl font-bold">{n.name}</h3>
                    <p className="text-xs text-slate-400">{n.region}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="font-mono-vx text-[10px] tracking-wider text-emerald-400">
                    {n.status === "online" ? "Online" : "Degradado"}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-black/20 p-2.5">
                  <Activity className={`mx-auto mb-1 h-4 w-4 ${pingColor}`} />
                  <p className={`font-mono-vx text-lg font-bold ${pingColor}`}>{n.ping}ms</p>
                  <p className="text-[10px] text-slate-500">Ping</p>
                </div>
                <div className="rounded-lg bg-black/20 p-2.5">
                  <Cpu className="mx-auto mb-1 h-4 w-4 text-cyan-400" />
                  <p className="font-mono-vx text-lg font-bold text-cyan-400">{n.gpu_util}%</p>
                  <p className="text-[10px] text-slate-500">GPU</p>
                </div>
                <div className="rounded-lg bg-black/20 p-2.5">
                  <Users className="mx-auto mb-1 h-4 w-4 text-violet-400" />
                  <p className="font-mono-vx text-lg font-bold text-violet-400">{n.queue}</p>
                  <p className="text-[10px] text-slate-500">Fila</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-slate-400"><Gauge className="h-3.5 w-3.5" /> Carga · {n.gpu}</span>
                  <span className="font-mono-vx font-bold">{n.load}%</span>
                </div>
                <LoadBar value={n.load} color={loadColor} />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
