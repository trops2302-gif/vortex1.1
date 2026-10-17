import React, { useState } from "react";
import { X, Save } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiError } from "@/lib/api";
import { gamePath } from "@/lib/stream";
import CoverSearch from "@/components/CoverSearch";
import KeyMapEditor from "@/components/KeyMapEditor";

const EMPTY = { title: "", folder_index: 0, exe: "", args: "", cover: "", hero: "", genre: "", key_map: null };

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded bg-black/40 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-cyan-500";

export default function MyGameForm({ initial, settings, onClose, onSaved }) {
  const [f, setF] = useState({ ...EMPTY, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: k === "folder_index" ? Number(e.target.value) : e.target.value });
  const folders = settings?.game_folders || ["", ""];

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = initial?.id ? await api.put(`/mygames/${initial.id}`, f) : await api.post("/mygames", f);
      toast.success(initial?.id ? "Jogo atualizado" : "Jogo adicionado à biblioteca");
      onSaved(data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" data-testid="mygame-form-dialog">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <form onSubmit={submit} className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-[#16181B] p-6 sm:rounded-lg">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-bold">{initial?.id ? "Editar jogo" : "Adicionar jogo do PC"}</h3>
          <button type="button" onClick={onClose} data-testid="mygame-form-close"><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <div className="space-y-4">
          <Field label="Nome do jogo"><input required data-testid="mygame-title-input" value={f.title} onChange={set("title")} className={inputCls} placeholder="Ex.: Hollow Knight" /></Field>
          <div className="grid grid-cols-[1fr_1.4fr] gap-3">
            <Field label="Pasta">
              <select data-testid="mygame-folder-select" value={f.folder_index} onChange={set("folder_index")} className={inputCls}>
                <option value={0}>Pasta 1 {folders[0] ? `(${folders[0]})` : ""}</option>
                <option value={1}>Pasta 2 {folders[1] ? `(${folders[1]})` : ""}</option>
                <option value={2}>Caminho completo</option>
              </select>
            </Field>
            <Field label="Executável"><input required data-testid="mygame-exe-input" value={f.exe} onChange={set("exe")} className={inputCls} placeholder={f.folder_index === 2 ? "D:\\Jogos\\Celeste\\Celeste.exe" : "Celeste\\Celeste.exe"} /></Field>
          </div>
          <p className="rounded bg-black/30 px-3 py-2 font-mono-vx text-[11px] text-slate-400" data-testid="mygame-path-preview">Caminho no PC: {gamePath(f, settings) || "—"}</p>
          <Field label="Argumentos (opcional)"><input data-testid="mygame-args-input" value={f.args} onChange={set("args")} className={inputCls} placeholder="-fullscreen" /></Field>
          <Field label="Gênero (opcional)"><input data-testid="mygame-genre-input" value={f.genre} onChange={set("genre")} className={inputCls} placeholder="Metroidvania" /></Field>
          <CoverSearch title={f.title} current={f.cover} onPick={(r) => setF({ ...f, cover: r.cover, hero: r.hero })} />
          <Field label="Capa vertical (URL da imagem)" hint="Dica: capas em steamgriddb.com · formato retrato 600×900"><input data-testid="mygame-cover-input" value={f.cover} onChange={set("cover")} className={inputCls} placeholder="https://…" /></Field>
          <Field label="Banner horizontal (URL, opcional)"><input data-testid="mygame-hero-input" value={f.hero} onChange={set("hero")} className={inputCls} placeholder="https://…" /></Field>
          <KeyMapEditor value={f.key_map} onChange={(km) => setF({ ...f, key_map: km })} />
        </div>
        <button disabled={saving} data-testid="mygame-save-button" className="vx-btn vx-btn-primary mt-6 w-full py-3"><Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}</button>
      </form>
    </div>
  );
}
