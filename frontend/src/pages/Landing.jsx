import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Gamepad2, Wifi, Server, Cloud, Smartphone, ArrowRight, Play } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const FEATURES = [
  { icon: Wifi, title: "Stream direto", desc: "Vídeo WebRTC do PC para o seu aparelho, sem intermediários." },
  { icon: Gamepad2, title: "Controle Xbox", desc: "Controle na tela, Bluetooth ou teclado e mouse." },
  { icon: Smartphone, title: "Jogue no Celular", desc: "Só precisa de internet. O jogo roda no PC." },
  { icon: Cloud, title: "Moonlight também", desc: "Jogos sincronizados com o Sunshine para menor latência." },
];

export default function Landing() {
  const [games, setGames] = useState([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/games").then(({ data }) => setGames(data.slice(0, 6)));
  }, []);

  const goApp = () => navigate(user ? "/app" : "/register");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0E1012] text-slate-100">
      {/* bg */}
      <div className="pointer-events-none absolute inset-0 vx-grid-bg opacity-60" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-cyan-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[120px]" />

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 vx-glow-border">
            <Zap className="h-5 w-5 text-cyan-400" strokeWidth={2.5} />
          </div>
          <span className="font-display text-2xl font-black tracking-tight">Vortex</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link to="/login" data-testid="landing-login-link" className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white">
            Entrar
          </Link>
          <Link
            to="/register"
            data-testid="landing-register-link"
            className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-105"
          >
            Começar grátis
          </Link>
        </div>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-10 pt-12 sm:px-8 sm:pt-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="font-mono-vx text-xs tracking-widest text-cyan-300">Seu PC · seus jogos</span>
            </div>
            <h1 className="font-display text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Jogos de <span className="text-cyan-400">PC</span> no seu <span className=" text-cyan-400">celular</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-300">
              Os jogos instalados no PC rodam lá e chegam ao seu celular ou navegador em vídeo ao vivo.
              Você só precisa de internet.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={goApp}
                data-testid="landing-cta-button"
                className="flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3.5 font-display text-lg font-bold tracking-wide text-white transition-transform hover:scale-105"
              >
                <Play className="h-5 w-5 fill-black" /> Jogar agora
              </button>
              <Link
                to="/login"
                className="flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 font-display text-lg font-bold tracking-wide text-white hover:bg-white/5"
              >
                Já tenho conta <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <div className="grid grid-cols-3 gap-3">
              {games.map((g, i) => (
                <div
                  key={g.id}
                  className={`overflow-hidden rounded-xl border border-white/10 ${i % 2 ? "translate-y-5" : ""} vx-float`}
                  style={{ animationDelay: `${i * 0.4}s` }}
                >
                  <img src={g.cover} alt={g.title} className="aspect-[3/4] w-full object-cover" />
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* features */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-md border border-white/8 bg-[#16181B] p-6"
            >
              <f.icon className="mb-4 h-8 w-8 text-cyan-400" />
              <h3 className="font-display text-xl font-bold tracking-wide">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-400">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* disclaimer / how it works */}
      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-20 sm:px-8">
        <div className="rounded-md border border-amber-500/20 bg-amber-950/10 p-6 text-sm text-amber-200/80">
          <Server className="mb-2 inline h-5 w-5 text-amber-400" />{" "}
          <strong className="text-amber-300">Como funciona:</strong> o jogo é executado no PC servidor e
          transmitido em vídeo para o seu aparelho. Os controles voltam para o PC em tempo real.
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/5 py-6 text-center text-xs text-slate-500">
        Vortex Cloud Gaming — Demo de plataforma de cloud gaming.
      </footer>
    </div>
  );
}
