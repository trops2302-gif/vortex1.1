"""Tests for new features: sessions/history, saves linked to session, WebRTC signaling WS."""
import asyncio
import json
import os
import time
import uuid

import pytest
import requests
import websockets

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"
WS_BASE = BASE_URL.replace("http", "ws", 1)


@pytest.fixture(scope="module")
def user_headers():
    email = f"TEST_{uuid.uuid4().hex[:8]}@vortex.gg"
    r = requests.post(f"{API}/auth/register", json={"name": "Hist User", "email": email, "password": "test12345"})
    assert r.status_code == 200
    token = r.json()["token"]
    return {"Authorization": f"Bearer {token}"}


# ---- Sessions History ----
class TestSessionsHistory:
    def test_history_initially_empty(self, user_headers):
        r = requests.get(f"{API}/sessions/history", headers=user_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert r.json() == []

    def test_history_requires_auth(self):
        r = requests.get(f"{API}/sessions/history")
        assert r.status_code == 401

    def test_history_populated_after_session(self, user_headers):
        # Start a session
        r = requests.post(f"{API}/sessions/start", headers=user_headers,
                          json={"game_id": "elden-ring", "node_id": "sao-paulo"})
        assert r.status_code == 200
        sid = r.json()["session"]["id"]

        # Add a save linked to this session
        r2 = requests.post(f"{API}/saves", headers=user_headers,
                           json={"game_id": "elden-ring", "label": "TEST_history_save", "session_id": sid})
        assert r2.status_code == 200
        save_id = r2.json()["id"]
        assert r2.json().get("session_id") == sid

        # End session
        time.sleep(1)
        r3 = requests.post(f"{API}/sessions/{sid}/end", headers=user_headers)
        assert r3.status_code == 200

        # Verify history includes it
        r4 = requests.get(f"{API}/sessions/history", headers=user_headers)
        assert r4.status_code == 200
        items = r4.json()
        assert len(items) >= 1
        match = next((it for it in items if it["id"] == sid), None)
        assert match is not None, "Session not in history"
        # structure
        assert match["game"]["title"] == "Elden Ring"
        assert "cover" in match["game"]
        assert match["node"]["name"] == "São Paulo"
        assert "flag" in match["node"] and "gpu" in match["node"]
        assert isinstance(match["duration_seconds"], int)
        assert match["duration_seconds"] >= 0
        assert "started_at" in match
        # saves linked
        assert any(s["id"] == save_id and s["label"] == "TEST_history_save" for s in match["saves"])


# ---- WebSocket signaling ----
class TestSignalingWS:
    @pytest.mark.asyncio
    async def test_single_peer_joined(self):
        room = f"TEST{uuid.uuid4().hex[:6].upper()}"
        url = f"{WS_BASE}/api/ws/signal/{room}"
        async with websockets.connect(url) as ws:
            msg = await asyncio.wait_for(ws.recv(), timeout=5)
            data = json.loads(msg)
            assert data["type"] == "joined"
            assert data["peers"] == 1

    @pytest.mark.asyncio
    async def test_two_peers_relay(self):
        room = f"TEST{uuid.uuid4().hex[:6].upper()}"
        url = f"{WS_BASE}/api/ws/signal/{room}"
        async with websockets.connect(url) as ws1:
            m1 = json.loads(await asyncio.wait_for(ws1.recv(), timeout=5))
            assert m1["type"] == "joined" and m1["peers"] == 1
            async with websockets.connect(url) as ws2:
                m2 = json.loads(await asyncio.wait_for(ws2.recv(), timeout=5))
                assert m2["type"] == "joined" and m2["peers"] == 2
                # ws1 should get peer-joined
                m_pj = json.loads(await asyncio.wait_for(ws1.recv(), timeout=5))
                assert m_pj["type"] == "peer-joined"
                # ws1 sends a message -> ws2 receives it
                payload = json.dumps({"type": "offer", "sdp": "fake-sdp"})
                await ws1.send(payload)
                relayed = await asyncio.wait_for(ws2.recv(), timeout=5)
                assert json.loads(relayed) == {"type": "offer", "sdp": "fake-sdp"}
                # ws2 -> ws1
                payload2 = json.dumps({"type": "answer", "sdp": "fake-answer"})
                await ws2.send(payload2)
                relayed2 = await asyncio.wait_for(ws1.recv(), timeout=5)
                assert json.loads(relayed2) == {"type": "answer", "sdp": "fake-answer"}
            # After ws2 closes, ws1 should get peer-left
            try:
                m_pl = json.loads(await asyncio.wait_for(ws1.recv(), timeout=5))
                assert m_pl["type"] == "peer-left"
            except asyncio.TimeoutError:
                pytest.fail("Did not receive peer-left notification")
