"""PC Host features: settings, mygames CRUD, sunshine export, ICE/TURN, host agent downloads, WS stream signaling."""
import asyncio
import json
import os
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
WS = BASE_URL.replace("http", "ws", 1) + "/api/ws/stream"


def _register():
    email = f"TEST_{uuid.uuid4().hex[:8]}@vortex.gg"
    r = requests.post(f"{API}/auth/register", json={"name": "PC Host", "email": email, "password": "test12345"})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="module")
def token():
    return _register()


@pytest.fixture(scope="module")
def h(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def h2():
    return {"Authorization": f"Bearer {_register()}"}


# ---- Settings ----
class TestSettings:
    def test_default_settings(self, h):
        r = requests.get(f"{API}/settings", headers=h)
        assert r.status_code == 200
        d = r.json()
        assert d["game_folders"] == ["", ""]
        assert d["pc_name"] == "Meu PC"

    def test_put_and_get_settings(self, h):
        p = {"game_folders": ["D:\\Jogos", "E:\\Games"], "moonlight_host": "192.168.0.10", "pc_name": "PC Sala"}
        r = requests.put(f"{API}/settings", json=p, headers=h)
        assert r.status_code == 200
        g = requests.get(f"{API}/settings", headers=h).json()
        assert g == p

    def test_settings_requires_auth(self):
        assert requests.get(f"{API}/settings").status_code == 401


# ---- My games CRUD + export ----
class TestMyGames:
    def test_crud_and_scope(self, h, h2):
        r = requests.post(f"{API}/mygames", json={"title": "TEST_Hades", "folder_index": 0, "exe": "Hades\\Hades.exe", "args": "-fs"}, headers=h)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["title"] == "TEST_Hades" and isinstance(g["id"], str) and "_id" not in g and "user_id" not in g
        gid = g["id"]
        lst = requests.get(f"{API}/mygames", headers=h).json()
        assert any(x["id"] == gid for x in lst)
        # other user cannot see/edit
        assert all(x["id"] != gid for x in requests.get(f"{API}/mygames", headers=h2).json())
        assert requests.put(f"{API}/mygames/{gid}", json={"title": "x", "exe": "y.exe"}, headers=h2).status_code == 404
        # update
        u = requests.put(f"{API}/mygames/{gid}", json={"title": "TEST_Hades2", "folder_index": 1, "exe": "Hades2\\Hades2.exe"}, headers=h)
        assert u.status_code == 200 and u.json()["title"] == "TEST_Hades2" and u.json()["folder_index"] == 1
        # export
        ex = requests.get(f"{API}/mygames/sunshine/export", headers=h)
        assert ex.status_code == 200
        apps = ex.json()["apps"]
        a = next(x for x in apps if x["name"] == "TEST_Hades2")
        assert a["cmd"].startswith('"E:\\Games\\Hades2\\Hades2.exe"'), a
        assert a["working-dir"] == "E:\\Games\\Hades2"
        # delete
        assert requests.delete(f"{API}/mygames/{gid}", headers=h).status_code == 200
        assert all(x["id"] != gid for x in requests.get(f"{API}/mygames", headers=h).json())
        assert requests.put(f"{API}/mygames/{gid}", json={"title": "x", "exe": "y.exe"}, headers=h).status_code == 404

    def test_create_validation(self, h):
        assert requests.post(f"{API}/mygames", json={"title": "  ", "exe": "a.exe"}, headers=h).status_code == 400
        assert requests.post(f"{API}/mygames", json={"title": "a"}, headers=h).status_code == 422

    def test_absolute_exe_not_joined(self, h):
        g = requests.post(f"{API}/mygames", json={"title": "TEST_Abs", "exe": "C:\\X\\x.exe"}, headers=h).json()
        apps = requests.get(f"{API}/mygames/sunshine/export", headers=h).json()["apps"]
        a = next(x for x in apps if x["name"] == "TEST_Abs")
        assert a["cmd"] == '"C:\\X\\x.exe"'
        requests.delete(f"{API}/mygames/{g['id']}", headers=h)

    def test_folder_index_out_of_range(self, h):
        r = requests.post(f"{API}/mygames", json={"title": "TEST_Neg", "exe": "n.exe", "folder_index": -1}, headers=h)
        print("folder_index=-1 ->", r.status_code)
        if r.status_code == 200:
            requests.delete(f"{API}/mygames/{r.json()['id']}", headers=h)


# ---- ICE / host / agent ----
class TestHostMisc:
    def test_ice(self, h):
        r = requests.get(f"{API}/webrtc/ice", headers=h, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert any("stun:" in u for s in d["iceServers"] for u in s["urls"])
        assert d["turn"] == "free-test", d
        turn = d["iceServers"][-1]
        assert turn["username"] and turn["credential"] and any(u.startswith("turn") for u in turn["urls"])

    def test_host_status_offline(self, h):
        r = requests.get(f"{API}/host/status", headers=h)
        assert r.status_code == 200 and r.json() == {"online": False, "viewers": 0}

    @pytest.mark.parametrize("name", ["vortex_agent.py", "requirements.txt", "iniciar_agente.bat"])
    def test_agent_download(self, name):
        r = requests.get(f"{API}/host/agent/{name}")
        assert r.status_code == 200 and len(r.content) > 10
        assert name in r.headers.get("content-disposition", "")

    @pytest.mark.parametrize("name", ["server.py", "..%2Fbackend%2F.env", "x.txt"])
    def test_agent_download_forbidden(self, name):
        assert requests.get(f"{API}/host/agent/{name}").status_code == 404


# ---- WS stream signaling ----
class TestStreamWS:
    def test_bad_token_rejected(self):
        async def run():
            async with websockets.connect(f"{WS}?role=host&token=bad") as ws:
                try:
                    await asyncio.wait_for(ws.recv(), 5)
                except websockets.ConnectionClosed as e:
                    return e.code
            return None
        assert asyncio.run(run()) == 4401

    def test_relay(self, token, h):
        async def run():
            host = await websockets.connect(f"{WS}?role=host&token={token}")
            w = json.loads(await host.recv())
            assert w["type"] == "welcome" and w["viewers"] == []
            st = requests.get(f"{API}/host/status", headers=h).json()
            assert st["online"] is True
            v = await websockets.connect(f"{WS}?role=viewer&token={token}")
            vw = json.loads(await v.recv())
            assert vw["type"] == "welcome" and vw["host"] is True
            j = json.loads(await asyncio.wait_for(host.recv(), 5))
            assert j == {"type": "viewer-joined", "id": vw["id"]}
            await v.send(json.dumps({"type": "answer", "sdp": "x"}))
            m = json.loads(await asyncio.wait_for(host.recv(), 5))
            assert m["from"] == vw["id"] and m["sdp"] == "x"
            await host.send(json.dumps({"type": "offer", "to": vw["id"], "sdp": "o"}))
            m = json.loads(await asyncio.wait_for(v.recv(), 5))
            assert m["from"] == "host" and m["sdp"] == "o"
            assert requests.get(f"{API}/host/status", headers=h).json()["viewers"] == 1
            await host.close()
            m = json.loads(await asyncio.wait_for(v.recv(), 5))
            assert m["type"] == "host-offline"
            await v.close()
        asyncio.run(run())
