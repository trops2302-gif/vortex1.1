import { useCallback, useEffect, useRef, useState } from "react";
import { getIce, readStats, signalUrl } from "@/lib/stream";

// Viewer side: receives the PC stream and sends input over a DataChannel
export default function useViewerEngine({ onHostMsg }) {
  const [phase, setPhase] = useState("connecting"); // connecting | no-host | negotiating | live | failed
  const [stats, setStats] = useState(null);
  const videoRef = useRef(null);
  const pc = useRef(null);
  const dc = useRef(null);
  const ws = useRef(null);
  const pending = useRef([]);
  const hostMsg = useRef(onHostMsg);
  hostMsg.current = onHostMsg;

  const send = useCallback((m) => {
    if (dc.current?.readyState === "open") dc.current.send(JSON.stringify(m));
  }, []);

  useEffect(() => {
    let alive = true;
    let ice;
    const resetPeer = () => {
      try { pc.current?.close(); } catch { /* noop */ }
      pc.current = null;
      dc.current = null;
      pending.current = [];
    };
    const sig = (o) => ws.current?.readyState === 1 && ws.current.send(JSON.stringify(o));

    const onOffer = async (sdp) => {
      resetPeer();
      setPhase("negotiating");
      const p = new RTCPeerConnection({ iceServers: ice.iceServers });
      pc.current = p;
      p.ontrack = (e) => {
        try { e.receiver.jitterBufferTarget = 0; } catch { /* noop */ }
        try { e.receiver.playoutDelayHint = 0; } catch { /* noop */ }
        const v = videoRef.current;
        if (v && v.srcObject !== e.streams[0]) {
          v.srcObject = e.streams[0];
          v.play?.().catch(() => {});
        }
      };
      p.ondatachannel = (e) => {
        dc.current = e.channel;
        e.channel.onmessage = (ev) => hostMsg.current?.(JSON.parse(ev.data));
        e.channel.onopen = () => hostMsg.current?.({ t: "channel-open" });
      };
      p.onicecandidate = (e) => e.candidate && sig({ type: "ice", candidate: e.candidate });
      p.onconnectionstatechange = () => {
        if (p.connectionState === "connected") setPhase("live");
        if (p.connectionState === "failed") setPhase("failed");
      };
      await p.setRemoteDescription(sdp);
      for (const c of pending.current) await p.addIceCandidate(c).catch(() => {});
      pending.current = [];
      const ans = await p.createAnswer();
      await p.setLocalDescription(ans);
      sig({ type: "answer", sdp: p.localDescription });
    };

    (async () => {
      ice = await getIce();
      if (!alive) return;
      const s = new WebSocket(signalUrl("viewer"));
      ws.current = s;
      s.onmessage = async (ev) => {
        const m = JSON.parse(ev.data);
        if (m.type === "welcome") setPhase(m.host ? "negotiating" : "no-host");
        else if (m.type === "host-offline") { resetPeer(); setPhase("no-host"); }
        else if (m.type === "host-online") setPhase("negotiating");
        else if (m.type === "offer") onOffer(m.sdp);
        else if (m.type === "ice") {
          if (pc.current?.remoteDescription) await pc.current.addIceCandidate(m.candidate).catch(() => {});
          else pending.current.push(m.candidate);
        }
      };
      s.onclose = () => alive && setPhase((ph) => (ph === "live" ? ph : "failed"));
    })().catch(() => setPhase("failed"));

    return () => {
      alive = false;
      resetPeer();
      try { ws.current?.close(); } catch { /* noop */ }
    };
  }, []);

  useEffect(() => {
    if (phase !== "live") return undefined;
    let snap = null;
    const t = setInterval(async () => {
      if (!pc.current) return;
      const r = await readStats(pc.current, snap);
      snap = r.snap;
      setStats(r.stats);
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  return { phase, stats, videoRef, send };
}
