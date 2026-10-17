import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { AGENT_URL, applyQuality, gamePath, getIce, preferCodecs, signalUrl } from "@/lib/stream";

// Everything the PC host does: capture, local agent bridge, one RTCPeerConnection per viewer
export default function useHostEngine() {
  const [agent, setAgent] = useState({ state: "off" }); // off | connecting | ok | badpin
  const [capturing, setCapturing] = useState(false);
  const [signal, setSignal] = useState("off");
  const [viewers, setViewers] = useState([]);
  const [turn, setTurn] = useState("");
  const [log, setLog] = useState([]);

  const agentWs = useRef(null);
  const sigWs = useRef(null);
  const stream = useRef(null);
  const peers = useRef(new Map());
  const ice = useRef(null);
  const lib = useRef({ games: [], settings: null });
  const previewRef = useRef(null);

  const note = useCallback((m) => setLog((l) => [`${new Date().toLocaleTimeString()} · ${m}`, ...l].slice(0, 30)), []);
  const refreshViewers = () => setViewers([...peers.current.entries()].map(([id, p]) => ({ id, state: p.state, rtt: p.rtt, relay: p.relay })));

  const toAgent = (msg) => {
    if (agentWs.current?.readyState === 1) agentWs.current.send(JSON.stringify(msg));
  };
  const toViewers = (msg) => peers.current.forEach((p) => p.dc?.readyState === "open" && p.dc.send(JSON.stringify(msg)));

  const connectAgent = useCallback((pin) => {
    try { agentWs.current?.close(); } catch { /* noop */ }
    setAgent({ state: "connecting" });
    const ws = new WebSocket(AGENT_URL);
    agentWs.current = ws;
    ws.onopen = () => ws.send(JSON.stringify({ pin }));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === "auth") {
        if (m.ok) {
          localStorage.setItem("vx_agent_pin", pin);
          setAgent({ state: "ok", gamepad: m.gamepad, folders: m.folders, platform: m.platform });
          note("Agente local conectado");
          toViewers({ t: "agent", ok: true });
        } else setAgent({ state: "badpin" });
      } else if (m.t === "launch-result") {
        note(m.ok ? "Jogo iniciado no PC" : `Falha ao iniciar: ${m.error}`);
        toViewers(m);
      }
    };
    ws.onclose = () => setAgent((a) => (a.state === "badpin" ? a : { state: "off" }));
  }, [note]);

  const handleViewerMsg = useCallback((id, m) => {
    const p = peers.current.get(id);
    if (m.t === "quality" && p?.videoSender) {
      applyQuality(p.videoSender, m.preset);
      note(`Qualidade alterada: ${m.preset}`);
    } else if (m.t === "launch") {
      const g = lib.current.games.find((x) => x.id === m.game_id);
      if (!g) return p?.dc?.send(JSON.stringify({ t: "launch-result", ok: false, error: "Jogo não encontrado" }));
      if (agentWs.current?.readyState !== 1) return p?.dc?.send(JSON.stringify({ t: "launch-result", ok: false, error: "Agente do PC desconectado" }));
      note(`Iniciando ${g.title}`);
      toAgent({ t: "launch", path: gamePath(g, lib.current.settings), args: g.args });
    } else {
      toAgent(m);
    }
  }, [note]);

  const sendSig = (o) => sigWs.current?.readyState === 1 && sigWs.current.send(JSON.stringify(o));

  const closePeer = (id) => {
    const p = peers.current.get(id);
    try { p?.pc.close(); } catch { /* noop */ }
    peers.current.delete(id);
    toAgent({ t: "release" });
    refreshViewers();
  };

  const createPeer = useCallback(async (id) => {
    if (!stream.current) return;
    closePeer(id);
    const pc = new RTCPeerConnection({ iceServers: ice.current.iceServers });
    const entry = { pc, dc: null, videoSender: null, state: "conectando", pending: [] };
    peers.current.set(id, entry);
    const s = stream.current;
    s.getVideoTracks().forEach((t) => {
      const tr = pc.addTransceiver(t, { direction: "sendonly", streams: [s] });
      preferCodecs(tr);
      entry.videoSender = tr.sender;
    });
    s.getAudioTracks().forEach((t) => pc.addTrack(t, s));
    const dc = pc.createDataChannel("input", { ordered: true });
    dc.onopen = () => dc.send(JSON.stringify({ t: "agent", ok: agentWs.current?.readyState === 1 }));
    dc.onmessage = (e) => handleViewerMsg(id, JSON.parse(e.data));
    entry.dc = dc;
    pc.onicecandidate = (e) => e.candidate && sendSig({ type: "ice", to: id, candidate: e.candidate });
    pc.onconnectionstatechange = () => {
      entry.state = pc.connectionState;
      if (pc.connectionState === "connected") note(`Dispositivo ${id} conectado`);
      if (pc.connectionState === "failed") note(`Conexão com ${id} falhou (rede/NAT)`);
      refreshViewers();
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await applyQuality(entry.videoSender, "high");
    sendSig({ type: "offer", to: id, sdp: pc.localDescription });
    refreshViewers();
  }, [handleViewerMsg, note]);

  const connectSignal = useCallback(() => {
    const ws = new WebSocket(signalUrl("host"));
    sigWs.current = ws;
    setSignal("connecting");
    ws.onmessage = async (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === "welcome") { setSignal("online"); m.viewers.forEach(createPeer); }
      else if (m.type === "viewer-joined") { note(`Novo dispositivo: ${m.id}`); createPeer(m.id); }
      else if (m.type === "viewer-left") closePeer(m.from || m.id);
      else if (m.type === "replaced") { note("Outra aba assumiu como host"); setSignal("replaced"); }
      else if (m.type === "answer") {
        const p = peers.current.get(m.from);
        if (p) {
          await p.pc.setRemoteDescription(m.sdp);
          for (const c of p.pending) await p.pc.addIceCandidate(c).catch(() => {});
          p.pending = [];
        }
      } else if (m.type === "ice") {
        const p = peers.current.get(m.from);
        if (!p) return;
        if (p.pc.remoteDescription) await p.pc.addIceCandidate(m.candidate).catch(() => {});
        else p.pending.push(m.candidate);
      }
    };
    ws.onclose = () => setSignal((s) => (s === "replaced" ? s : "off"));
  }, [createPeer, note]);

  const stopCapture = useCallback(() => {
    peers.current.forEach((_, id) => closePeer(id));
    try { sigWs.current?.close(); } catch { /* noop */ }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCapturing(false);
    setSignal("off");
  }, []);

  const startCapture = useCallback(async () => {
    const [iceData, games, settings] = await Promise.all([getIce(), api.get("/mygames"), api.get("/settings")]);
    ice.current = iceData;
    lib.current = { games: games.data, settings: settings.data };
    setTurn(iceData.turn);
    const s = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 60, max: 60 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      systemAudio: "include",
      selfBrowserSurface: "exclude",
    });
    s.getVideoTracks().forEach((t) => { t.contentHint = "motion"; t.onended = () => { note("Captura encerrada"); stopCapture(); }; });
    stream.current = s;
    if (previewRef.current) previewRef.current.srcObject = s;
    setCapturing(true);
    note(`Captura iniciada${s.getAudioTracks().length ? " (com áudio)" : " (sem áudio)"}`);
    connectSignal();
  }, [connectSignal, note, stopCapture]);

  // viewer latency stats
  useEffect(() => {
    const t = setInterval(async () => {
      for (const p of peers.current.values()) {
        try {
          const r = await p.pc.getStats();
          r.forEach((s) => {
            if (s.type === "candidate-pair" && s.nominated && s.state === "succeeded") {
              p.rtt = Math.round((s.currentRoundTripTime || 0) * 1000);
              p.relay = r.get(s.localCandidateId)?.candidateType === "relay";
            }
          });
        } catch { /* closed */ }
      }
      if (peers.current.size) refreshViewers();
    }, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const pin = localStorage.getItem("vx_agent_pin");
    if (pin) connectAgent(pin);
    return () => { stopCapture(); try { agentWs.current?.close(); } catch { /* noop */ } };
  }, [connectAgent, stopCapture]);

  useEffect(() => {
    if (capturing && previewRef.current && stream.current) previewRef.current.srcObject = stream.current;
  }, [capturing]);

  return { agent, capturing, signal, viewers, turn, log, previewRef, connectAgent, startCapture, stopCapture };
}
