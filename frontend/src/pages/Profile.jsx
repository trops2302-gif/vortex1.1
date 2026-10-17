import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Check, Gamepad2, Monitor, Volume2, Clock, Library, Cloud } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const TIERS = [
  { name: "Free Trial", price: "R$ 0", color: "border-white/10", features: ["1080p · 60 FPS", "1h de sessão", "1 servidor"] },
  { name: "Pro Pass", price: "R$ 39/mês", color: "border-cyan-400", highlight: true, features: ["1440p · 120 FPS", "6h de sessão", "Todos os servidores", "Saves ilimitados"] },
  { name: "Ultra Rig", price: "R$ 79/mês", color: "border-violet-500", features: ["4K HDR · 120 FPS", "Sessão ilimitada", "RTX 4090 prioritário", "Codec AV1"] },
];

export default function Profile() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [codec, setCodec] = useState("AV1");
  const [gamepad, setGamepad] = useState("Automático");

  useEffect(() => {
    api.get("/stats").then(({ data }) => setStats(data));
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">Perfil</h1>
        <p className="text-sm text-slate-400">Conta, assinatura e preferências de streaming</p>
      </div>

      {/* profile card */}
      <div className="flex flex-col items-start gap-4 rounded-md border border-white/8 bg-[#1C1F23] p-6 sm:flex-row sm:items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-md bg-gradient-to-br from-cyan-500 to-violet-600 font-display text-3xl font-black">
          {(user?.name || "U")[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <h2 className="font-display text-2xl font-bold">{user?.name}</h2>
          <p className="text-sm text-slate-400">{user?.email}</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-3 py-1.5 font-mono-vx text-sm font-bold text-cyan-400">
          <Zap className="h-4 w-4" /> {user?.plan}
        </span>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Library, label: "Jogos", value: stats?.games_in_library ?? "—", c: "text-cyan-400" },
          { icon: Clock, label: "Horas", value: stats?.total_hours ?? "—", c: "text-amber-400" },
          { icon: Cloud, label: "Saves", value: stats?.cloud_saves ?? "—", c: "text-violet-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-white/8 bg-[#1C1F23] p-4 text-center">
            <s.icon className={`mx-auto mb-1 h-5 w-5 ${s.c}`} />
            <p className="font-display text-2xl font-black">{s.value}</p>
            <p className="text-xs text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* settings */}
      <section>
        <h3 className="mb-4 font-display text-2xl font-extrabold tracking-tight">Preferências de streaming</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-white/8 bg-[#1C1F23] p-5">
            <p className="mb-3 flex items-center gap-2 font-semibold"><Monitor className="h-4 w-4 text-cyan-400" /> Codec de vídeo</p>
            <div className="flex gap-2">
              {["AV1", "H.265", "H.264"].map((c) => (
                <button
                  key={c}
                  data-testid={`codec-${c}`}
                  onClick={() => setCodec(c)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${codec === c ? "bg-cyan-600 text-white" : "border border-white/10 text-slate-400"}`}
                >
                  {c} {codec === c && <Check className="ml-1 inline h-3 w-3" />}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-white/8 bg-[#1C1F23] p-5">
            <p className="mb-3 flex items-center gap-2 font-semibold"><Gamepad2 className="h-4 w-4 text-cyan-400" /> Controle</p>
            <div className="flex gap-2">
              {["Automático", "Xbox", "DualSense"].map((g) => (
                <button
                  key={g}
                  data-testid={`gamepad-${g}`}
                  onClick={() => setGamepad(g)}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${gamepad === g ? "bg-cyan-600 text-white" : "border border-white/10 text-slate-400"}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* tiers */}
      <section>
        <h3 className="mb-4 font-display text-2xl font-extrabold tracking-tight">Planos</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {TIERS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`relative rounded-md border bg-[#1C1F23] p-6 ${t.color} ${t.highlight ? "shadow-[0_0_25px_rgba(0,240,255,0.15)]" : ""}`}
              data-testid={`plan-${t.name}`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-cyan-600 px-3 py-0.5 text-[10px] font-bold text-white">Popular</span>
              )}
              <h4 className="font-display text-xl font-bold">{t.name}</h4>
              <p className="mt-1 font-display text-3xl font-black">{t.price}</p>
              <ul className="mt-4 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <Check className="h-4 w-4 text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
              <button
                disabled={user?.plan === t.name}
                className={`mt-5 w-full rounded-xl py-2.5 font-bold transition-all ${
                  user?.plan === t.name ? "border border-white/10 text-slate-500" : "bg-cyan-600 text-white hover:bg-cyan-500"
                }`}
              >
                {user?.plan === t.name ? "Plano atual" : "Escolher"}
              </button>
            </motion.div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-slate-500">Planos demonstrativos — nenhuma cobrança é realizada.</p>
      </section>
    </div>
  );
}
