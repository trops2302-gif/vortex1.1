import React, { useEffect, useState } from "react";
import { Plus, FolderOpen, Upload, Circle } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import MyGameForm from "@/components/MyGameForm";
import MyGameSheet, { GameArt } from "@/components/MyGameSheet";

function FolderSettings({ settings, onSaved }) {
  const [s, setS] = useState(settings);
  useEffect(() => setS(settings), [settings]);
  if (!s) return null;
  const setFolder = (i) => (e) => {
    const f = [...s.game_folders];
    f[i] = e.target.value;
    setS({ ...s, game_folders: f });
  };
  const save = async () => {
    const { data } = await api.put("/settings", s);
    onSaved(data);
    toast.success("Pastas salvas");
  };
  const cls = "w-full rounded bg-black/40 px-3 py-2.5 font-mono-vx text-sm text-white outline-none ring-1 ring-white/10 focus:ring-cyan-500";
  return (
    <div className="rounded-md bg-[#1C1F23] p-5" data-testid="folder-settings">
      <p className="flex items-center gap-2 font-display text-lg font-bold"><FolderOpen className="h-5 w-5 text-cyan-400" /> Pastas de jogos no PC</p>
      <p className="mt-1 text-sm text-slate-400">Os executáveis dos jogos são relativos a estas pastas. Use as mesmas no iniciar_agente.bat (só jogos dentro delas podem ser abertos remotamente).</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input data-testid="folder-1-input" value={s.game_folders[0]} onChange={setFolder(0)} placeholder="D:\Jogos" className={cls} />
        <input data-testid="folder-2-input" value={s.game_folders[1]} onChange={setFolder(1)} placeholder="E:\Jogos" className={cls} />
        <input data-testid="moonlight-host-input" value={s.moonlight_host} onChange={(e) => setS({ ...s, moonlight_host: e.target.value })} placeholder="Nome do PC no Moonlight" className={cls} />
      </div>
      <button data-testid="folder-save-button" onClick={save} className="vx-btn vx-btn-primary mt-3 px-5 py-2.5 text-sm">Salvar pastas</button>
    </div>
  );
}

export default function MyGames() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [games, setGames] = useState(null);
  const [settings, setSettings] = useState(null);
  const [host, setHost] = useState({ online: false });
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);

  const load = () => api.get("/mygames").then(({ data }) => setGames(data));
  useEffect(() => {
    load();
    api.get("/settings").then(({ data }) => setSettings(data));
    const poll = () => api.get("/host/status").then(({ data }) => setHost(data)).catch(() => {});
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  const exportSunshine = async () => {
    const { data } = await api.get("/mygames/sunshine/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vortex-sunshine-apps.json";
    a.click();
    toast.success("Arquivo baixado. No Sunshine: Applications → adicione cada jogo com o comando do arquivo.");
  };

  const remove = async (g) => {
    await api.delete(`/mygames/${g.id}`);
    setOpen(null);
    toast.success("Jogo removido");
    load();
  };

  return (
    <div className="space-y-8" data-testid="mygames-page">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold" data-testid="host-online-indicator">
            <Circle className={`h-2.5 w-2.5 ${host.online ? "fill-cyan-400 text-cyan-400" : "fill-slate-600 text-slate-600"}`} />
            <span className={host.online ? "text-cyan-400" : "text-slate-500"}>{host.online ? "PC servidor online" : "PC servidor offline"}</span>
          </p>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Meus Jogos</h1>
          <p className="text-sm text-slate-400">{isAdmin ? "Jogos instalados no seu PC, prontos para jogar pelo navegador ou Moonlight." : "Jogos disponíveis no PC servidor. Toque para jogar."}</p>
        </div>
        {isAdmin && <div className="flex gap-2">
          <button data-testid="sunshine-export-button" onClick={exportSunshine} className="vx-btn vx-btn-ghost px-4 py-2.5 text-sm"><Upload className="h-4 w-4" /> Exportar para Sunshine</button>
          <button data-testid="mygame-add-button" onClick={() => setEditing({})} className="vx-btn vx-btn-primary px-5 py-2.5 text-sm"><Plus className="h-4 w-4" /> Adicionar jogo</button>
        </div>}
      </header>

      {games && games.length === 0 && (
        <div className="rounded-md border border-dashed border-white/10 p-10 text-center" data-testid="mygames-empty">
          <p className="font-display text-xl font-bold">Sua biblioteca do PC está vazia</p>
          <p className="mt-1 text-sm text-slate-400">{isAdmin ? "Configure as pastas abaixo e adicione o primeiro jogo informando o executável (.exe)." : "O administrador ainda não adicionou jogos."}</p>
        </div>
      )}

      {games && games.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
          {games.map((g) => (
            <button key={g.id} data-testid={`mygame-tile-${g.id}`} onClick={() => setOpen(g)} className="vx-tile aspect-[2/3] text-left">
              <GameArt game={g} />
            </button>
          ))}
        </div>
      )}

      {isAdmin && <FolderSettings settings={settings} onSaved={setSettings} />}

      {open && (
        <MyGameSheet game={open} settings={settings} hostOnline={host.online} isAdmin={isAdmin} onClose={() => setOpen(null)}
          onEdit={() => { setEditing(open); setOpen(null); }} onDelete={() => remove(open)} />
      )}
      {isAdmin && editing && (
        <MyGameForm initial={editing} settings={settings} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </div>
  );
}
