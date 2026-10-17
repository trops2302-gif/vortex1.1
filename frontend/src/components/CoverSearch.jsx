import React, { useState } from "react";
import { Search, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

export default function CoverSearch({ title, current, onPick }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!title.trim()) return toast.error("Digite o nome do jogo primeiro");
    setLoading(true);
    try {
      const { data } = await api.get("/covers/search", { params: { q: title } });
      setResults(data);
      if (!data.length) toast.info("Nenhuma capa encontrada, tente outro nome");
    } catch {
      toast.error("Busca de capas indisponível agora");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="cover-search">
      <button type="button" onClick={search} data-testid="cover-search-button" className="vx-btn vx-btn-ghost w-full py-2.5 text-sm">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar capa e banner automaticamente
      </button>
      {results?.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {results.map((r) => (
            <button type="button" key={r.appid} data-testid={`cover-result-${r.appid}`} onClick={() => onPick(r)} title={r.name} className="vx-tile relative aspect-[2/3]">
              <img src={r.cover} alt={r.name} className="h-full w-full object-cover" />
              {current === r.cover && <span className="absolute inset-0 flex items-center justify-center bg-black/50"><Check className="h-6 w-6 text-cyan-400" /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
