import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Plus, MonitorUp, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { GameArt } from "@/components/MyGameSheet";

function Row({ title, action, onAction, children, testid }) {
  return (
    <section data-testid={testid}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {action && <button onClick={onAction} className="flex items-center text-sm font-semibold text-slate-400 hover:text-white">{action}<ChevronRight className="h-4 w-4" /></button>}
      </div>
      <div className="vx-row">{children}</div>
    </section>
  );
}

function Hero({ slides, index, setIndex }) {
  const s = slides[index];
  if (!s) return null;
  return (
    <div className="relative -mx-4 h-[340px] overflow-hidden sm:mx-0 sm:h-[460px] sm:rounded-md" data-testid="home-hero">
      <AnimatePresence mode="wait">
        <motion.div key={s.key} initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }} className="absolute inset-0">
          {s.image ? <img src={s.image} alt={s.title} className="h-full w-full object-cover" /> : <GameArt game={s.game} wide />}
        </motion.div>
      </AnimatePresence>
      <div className="vx-hero-fade absolute inset-0" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12">
        <p className="text-sm font-semibold text-cyan-400">{s.eyebrow}</p>
        <h1 className="mt-1 max-w-xl font-display text-4xl font-extrabold leading-[0.95] sm:text-6xl" data-testid="home-hero-title">{s.title}</h1>
        <p className="mt-3 max-w-md text-sm text-slate-300 line-clamp-2">{s.text}</p>
        <div className="mt-5 flex gap-2">
          <button data-testid="home-hero-primary" onClick={s.onPrimary} className="vx-btn vx-btn-primary px-6 py-3"><Play className="h-4 w-4 fill-white" /> {s.primary}</button>
          {s.secondary && <button data-testid="home-hero-secondary" onClick={s.onSecondary} className="vx-btn vx-btn-ghost px-5 py-3">{s.secondary}</button>}
        </div>
      </div>
      <div className="absolute bottom-5 right-6 flex gap-1.5">
        {slides.map((x, i) => (
          <button key={x.key} data-testid={`home-hero-dot-${i}`} onClick={() => setIndex(i)} className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-3 bg-white/40"}`} />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState([]);
  const [host, setHost] = useState({ online: false });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    api.get("/mygames").then(({ data }) => setMine(data));
    api.get("/host/status").then(({ data }) => setHost(data)).catch(() => {});
  }, []);

  const playMine = (g) => navigate(`/stream?game=${g.id}`);
  const slides = [
    ...mine.slice(0, 5).map((g) => ({ key: `m-${g.id}`, game: g, image: g.hero || g.cover, eyebrow: "Do seu PC", title: g.title, text: g.genre || "Instalado no seu computador · jogue pelo navegador ou Moonlight", primary: "Jogar", onPrimary: () => playMine(g), secondary: "Meus Jogos", onSecondary: () => navigate("/app/mygames") })),
  ];

  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setTimeout(() => setIndex((i) => (i + 1) % slides.length), 7000);
    return () => clearTimeout(t);
  }, [index, slides.length]);

  const tileW = "w-[38vw] flex-shrink-0 sm:w-44 lg:w-48";

  return (
    <div className="space-y-10">
      <Hero slides={slides} index={Math.min(index, Math.max(slides.length - 1, 0))} setIndex={setIndex} />

      <div className="flex flex-col justify-between gap-3 rounded-md bg-[#1C1F23] p-4 sm:flex-row sm:items-center" data-testid="home-host-banner">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${host.online ? "bg-cyan-400" : "bg-slate-600"}`} />
          <p className="text-sm"><b>{user?.name?.split(" ")[0]}</b>, o PC servidor está <b className={host.online ? "text-cyan-400" : "text-slate-400"}>{host.online ? "online e pronto" : "offline"}</b>{host.viewers ? ` · ${host.viewers} dispositivo(s)` : ""}</p>
        </div>
        {user?.role === "admin" && <button data-testid="home-host-button" onClick={() => navigate("/app/host")} className="vx-btn vx-btn-ghost px-4 py-2 text-sm"><MonitorUp className="h-4 w-4" /> Host do PC</button>}
      </div>

      <Row title="Seus jogos do PC" action="Ver todos" onAction={() => navigate("/app/mygames")} testid="row-mygames">
        {mine.map((g) => (
          <div key={g.id} className={tileW}>
            <button data-testid={`home-mygame-${g.id}`} onClick={() => playMine(g)} className="vx-tile block aspect-[2/3] w-full"><GameArt game={g} /></button>
            <p className="mt-2 truncate text-sm text-slate-300">{g.title}</p>
          </div>
        ))}
        {user?.role === "admin" && <button data-testid="home-add-mygame" onClick={() => navigate("/app/mygames")} className={`${tileW} vx-tile flex aspect-[2/3] flex-col items-center justify-center gap-2 border border-dashed border-white/15 bg-transparent text-sm text-slate-400`}>
          <Plus className="h-6 w-6" /> Adicionar jogo
        </button>}
      </Row>

    </div>
  );
}
