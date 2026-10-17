import React from "react";
import { DEFAULT_KEYMAP, KEY_OPTIONS, PAD_BUTTONS, STICK_OPTIONS } from "@/lib/keymap";

const sel = "w-full rounded bg-black/40 px-2 py-1.5 text-xs text-white outline-none ring-1 ring-white/10 focus:ring-cyan-500";

export default function KeyMapEditor({ value, onChange }) {
  const km = value || { ...DEFAULT_KEYMAP, enabled: false };
  const set = (patch) => onChange({ ...km, ...patch });
  const setBtn = (b, code) => set({ buttons: { ...km.buttons, [b]: code } });

  return (
    <div className="rounded bg-black/25 p-4" data-testid="keymap-editor">
      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold">Botões do controle viram teclas</span>
          <span className="block text-[11px] text-slate-500">Para jogos sem suporte a controle: o controle na tela (ou Bluetooth) envia teclado e mouse.</span>
        </span>
        <input type="checkbox" data-testid="keymap-enabled-toggle" checked={km.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-5 w-5 accent-[#107C10]" />
      </label>
      {km.enabled && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[["lstick", "Analógico esquerdo"], ["rstick", "Analógico direito"]].map(([k, l]) => (
              <label key={k} className="text-[11px] text-slate-400">{l}
                <select data-testid={`keymap-${k}`} value={km[k]} onChange={(e) => set({ [k]: e.target.value })} className={`${sel} mt-1`}>
                  {STICK_OPTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {PAD_BUTTONS.map((b) => (
              <label key={b} className="text-[11px] font-bold text-slate-400">{b}
                <select data-testid={`keymap-btn-${b.toLowerCase()}`} value={km.buttons?.[b] || ""} onChange={(e) => setBtn(b, e.target.value)} className={`${sel} mt-1`}>
                  {KEY_OPTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button type="button" data-testid="keymap-reset" onClick={() => onChange({ ...DEFAULT_KEYMAP })} className="text-xs font-semibold text-cyan-400 hover:underline">Restaurar padrão (WASD + mouse)</button>
        </div>
      )}
    </div>
  );
}
