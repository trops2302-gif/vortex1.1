import React, { useState } from "react";
import { Cpu, MonitorUp, Radio, Download, Square, Smartphone, ShieldCheck, Gamepad2, Wifi, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import useHostEngine from "@/hooks/useHostEngine";
import { AGENT_FILES } from "@/lib/stream";

function StatusRow({ icon: Icon, label, value, tone, testid }) {
  const tones = { ok: "text-cyan-400", warn: "text-amber-400", off: "text-slate-500" };
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-3 last:border-0" data-testid={testid}>
      <span className="flex items-center gap-3 text-sm text-slate-300"><Icon className="h-4 w-4 text-slate-500" />{label}</span>
      <span className={`text-sm font-semibold ${tones[tone]}`}>{value}</span>
    </div>
  );
}

function AgentCard({ agent, connectAgent, syncSunshine }) {
  const [pin, setPin] = useState(localStorage.getItem("vx_agent_pin") || "");
  return (
    <div className="rounded-md bg-[#1C1F23] p-5">
      <h3 className="font-display text-lg font-bold">Agente do PC</h3>
      <p className="mt-1 text-sm text-slate-400">Programa leve que transforma toques, teclado e controle em comandos reais no Windows e abre os jogos.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {AGENT_FILES.map((f) => (
          <a key={f.name} href={f.url} download data-testid={`agent-download-${f.name}`} className="vx-btn vx-btn-ghost px-3 py-2 text-xs">
            <Download className="h-3.5 w-3.5" /> {f.name}
          </a>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          data-testid="agent-pin-input"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="PIN de 6 dígitos"
          className="w-40 rounded bg-black/40 px-3 py-2.5 font-mono-vx tracking-[0.3em] text-white outline-none ring-1 ring-white/10 focus:ring-cyan-500"
        />
        <button data-testid="agent-connect-button" onClick={() => pin.length === 6 ? connectAgent(pin) : toast.error("Digite o PIN mostrado no agente")} className="vx-btn vx-btn-primary px-4 py-2.5 text-sm">
          {agent.state === "connecting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Parear
        </button>
      </div>
      {agent.state === "badpin" && <p className="mt-2 text-xs text-red-400" data-testid="agent-badpin">PIN incorreto (após 5 erros o agente bloqueia por 60 s).</p>}
      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="text-sm font-semibold">Sunshine / Moonlight</p>
        <p className="mt-1 text-xs text-slate-400">Cadastra (ou atualiza) todos os jogos de Meus Jogos no Sunshine, com capa. Preencha SUNSHINE_USER e SUNSHINE_PASS no iniciar_agente.bat.</p>
        <button data-testid="sunshine-sync-button" onClick={syncSunshine} disabled={agent.state !== "ok"} className="vx-btn vx-btn-ghost mt-3 px-4 py-2.5 text-sm disabled:opacity-40">
          <RefreshCw className="h-4 w-4" /> Sincronizar com Sunshine {agent.state === "ok" && !agent.sunshine ? "(credenciais ausentes)" : ""}
        </button>
      </div>
    </div>
  );
}

const STEPS = [
  "Instale o Python 3 no PC (marque “Add to PATH”).",
  "Baixe os 3 arquivos do agente numa pasta. Edite o iniciar_agente.bat com suas duas pastas de jogos (e usuário/senha do Sunshine) e dê dois cliques nele.",
  "Copie o PIN que aparece na janela preta e clique em Parear aqui.",
  "Clique em Iniciar transmissão → escolha “Tela inteira” e marque “Compartilhar áudio do sistema”.",
  "No celular, entre com a mesma conta → Meus Jogos → escolha o jogo → Jogar no navegador.",
];

export default function Host() {
  const h = useHostEngine();
  const agentTone = h.agent.state === "ok" ? "ok" : h.agent.state === "badpin" ? "warn" : "off";

  const start = async () => {
    try { await h.startCapture(); } catch { toast.error("Captura cancelada ou bloqueada pelo navegador"); }
  };

  return (
    <div className="space-y-8" data-testid="host-page">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-400">Host do PC</p>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Seu PC como servidor de jogos</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">Abra esta página no PC onde os jogos estão instalados. Ela captura a tela, envia o vídeo por WebRTC e recebe os controles do celular.</p>
        </div>
        {h.capturing ? (
          <button data-testid="host-stop-button" onClick={h.stopCapture} className="vx-btn bg-red-600 px-5 py-3 text-white hover:bg-red-500"><Square className="h-4 w-4" /> Parar transmissão</button>
        ) : (
          <button data-testid="host-start-button" onClick={start} className="vx-btn vx-btn-primary px-6 py-3"><MonitorUp className="h-5 w-5" /> Iniciar transmissão</button>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-md bg-black">
          {h.capturing ? (
            <video ref={h.previewRef} autoPlay muted playsInline className="aspect-video w-full" data-testid="host-preview" />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 text-slate-500">
              <MonitorUp className="h-10 w-10" />
              <p className="text-sm">A prévia da sua tela aparece aqui</p>
            </div>
          )}
        </div>
        <div className="rounded-md bg-[#1C1F23] px-5 py-2">
          <StatusRow testid="host-status-agent" icon={Cpu} label="Agente do PC" value={{ ok: "Pareado", connecting: "Conectando…", badpin: "PIN incorreto", off: "Desconectado" }[h.agent.state]} tone={agentTone} />
          <StatusRow testid="host-status-gamepad" icon={Gamepad2} label="Controle Xbox virtual" value={h.agent.state === "ok" ? (h.agent.gamepad ? "Ativo" : "Instale ViGEmBus") : "—"} tone={h.agent.gamepad ? "ok" : "off"} />
          <StatusRow testid="host-status-capture" icon={MonitorUp} label="Captura de tela" value={h.capturing ? "Transmitindo" : "Parada"} tone={h.capturing ? "ok" : "off"} />
          <StatusRow testid="host-status-signal" icon={Radio} label="Visível para o celular" value={{ online: "Online", connecting: "Conectando…", replaced: "Outra aba", off: "Offline" }[h.signal]} tone={h.signal === "online" ? "ok" : "off"} />
          <StatusRow testid="host-status-turn" icon={Wifi} label="Servidor TURN" value={{ "free-test": "Gratuito (teste)", custom: "Próprio", none: "Indisponível", "": "—" }[h.turn]} tone={h.turn ? "ok" : "off"} />
          <div className="py-3">
            <p className="mb-2 flex items-center gap-2 text-sm text-slate-300"><Smartphone className="h-4 w-4 text-slate-500" /> Dispositivos ({h.viewers.length})</p>
            {h.viewers.map((v) => (
              <div key={v.id} className="flex justify-between font-mono-vx text-xs text-slate-400" data-testid={`host-viewer-${v.id}`}>
                <span>{v.id} · {v.state}</span><span>{v.rtt ? `${v.rtt}ms` : ""}{v.relay ? " · TURN" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AgentCard agent={h.agent} connectAgent={h.connectAgent} syncSunshine={h.syncSunshine} />
        <div className="rounded-md bg-[#1C1F23] p-5">
          <h3 className="font-display text-lg font-bold">Como configurar (uma vez)</h3>
          <ol className="mt-3 space-y-2.5">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">{i + 1}</span>{s}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-slate-500">Dica: deixe esta aba aberta (pode minimizar) e desative a “Economia de memória” do Chrome para ela.</p>
        </div>
      </div>

      {h.log.length > 0 && (
        <div className="rounded-md bg-black/40 p-4 font-mono-vx text-xs text-slate-400" data-testid="host-log">
          {h.log.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      )}
    </div>
  );
}
