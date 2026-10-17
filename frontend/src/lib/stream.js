import api from "@/lib/api";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const AGENT_URL = "ws://127.0.0.1:8765";
export const AGENT_FILES = ["vortex_agent.py", "requirements.txt", "iniciar_agente.bat"].map((f) => ({
  name: f,
  url: `${BACKEND_URL}/api/host/agent/${f}`,
}));

export function signalUrl(role) {
  const token = encodeURIComponent(localStorage.getItem("vx_token") || "");
  return `${BACKEND_URL.replace(/^http/, "ws")}/api/ws/stream?role=${role}&token=${token}`;
}

export async function getIce() {
  const { data } = await api.get("/webrtc/ice");
  return data;
}

export const QUALITY = {
  ultra: { label: "1080p · 60fps · 35 Mbps", bitrate: 35_000_000, scale: 1 },
  high: { label: "1080p · 60fps · 20 Mbps", bitrate: 20_000_000, scale: 1 },
  medium: { label: "720p · 60fps · 10 Mbps", bitrate: 10_000_000, scale: 1.5 },
  low: { label: "540p · 60fps · 4 Mbps", bitrate: 4_000_000, scale: 2 },
};

export async function applyQuality(sender, preset) {
  const q = QUALITY[preset] || QUALITY.high;
  const p = sender.getParameters();
  if (!p.encodings || !p.encodings.length) p.encodings = [{}];
  p.encodings[0].maxBitrate = q.bitrate;
  p.encodings[0].maxFramerate = 60;
  p.encodings[0].scaleResolutionDownBy = q.scale;
  p.degradationPreference = "maintain-framerate";
  try { await sender.setParameters(p); } catch { /* unsupported param on this browser */ }
}

export function preferCodecs(transceiver) {
  const caps = window.RTCRtpSender?.getCapabilities?.("video");
  if (!caps || !transceiver.setCodecPreferences) return;
  const rank = (c) => ["video/H264", "video/VP9", "video/VP8", "video/AV1"].indexOf(c.mimeType);
  const sorted = [...caps.codecs].sort((a, b) => {
    const ra = rank(a) < 0 ? 9 : rank(a);
    const rb = rank(b) < 0 ? 9 : rank(b);
    return ra - rb;
  });
  try { transceiver.setCodecPreferences(sorted); } catch { /* ignore */ }
}

export function joinPath(folder, exe) {
  if (!exe) return "";
  if (!folder || /^[a-zA-Z]:/.test(exe) || exe.startsWith("\\\\") || exe.startsWith("/")) return exe;
  const sep = folder.includes("\\") || /^[a-zA-Z]:/.test(folder) ? "\\" : "/";
  return folder.replace(/[\\/]+$/, "") + sep + exe.replace(/^[\\/]+/, "");
}

export function gamePath(game, settings) {
  const folder = game.folder_index < 2 ? settings?.game_folders?.[game.folder_index] : "";
  return joinPath(folder, game.exe);
}

export async function readStats(pc, prev) {
  const report = await pc.getStats();
  const out = { fps: 0, mbps: 0, rtt: 0, lost: 0, res: "—", codec: "—", relay: false, jitter: 0 };
  let bytes = 0;
  let ts = 0;
  const codecs = {};
  let localId = null;
  report.forEach((s) => { if (s.type === "codec") codecs[s.id] = s.mimeType; });
  report.forEach((s) => {
    if (s.type === "inbound-rtp" && s.kind === "video") {
      out.fps = Math.round(s.framesPerSecond || 0);
      out.lost = s.packetsLost || 0;
      out.res = s.frameWidth ? `${s.frameWidth}×${s.frameHeight}` : "—";
      out.codec = (codecs[s.codecId] || "—").replace("video/", "");
      if (s.jitterBufferEmittedCount) out.jitter = Math.round((s.jitterBufferDelay / s.jitterBufferEmittedCount) * 1000);
      bytes = s.bytesReceived;
      ts = s.timestamp;
    }
    if (s.type === "candidate-pair" && (s.nominated || s.selected) && s.state === "succeeded") {
      out.rtt = Math.round((s.currentRoundTripTime || 0) * 1000);
      localId = s.localCandidateId;
    }
  });
  if (localId) out.relay = report.get(localId)?.candidateType === "relay";
  if (prev?.bytes && ts > prev.ts) out.mbps = +(((bytes - prev.bytes) * 8) / ((ts - prev.ts) * 1000)).toFixed(1);
  return { stats: out, snap: { bytes, ts } };
}
