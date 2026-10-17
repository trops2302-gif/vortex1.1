"""Backend API tests for Vortex Cloud Gaming."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@vortex.gg"
ADMIN_PASSWORD = "vortex123"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def new_user():
    email = f"TEST_{uuid.uuid4().hex[:8]}@vortex.gg"
    r = requests.post(f"{API}/auth/register", json={"name": "Test User", "email": email, "password": "test123456"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"]}


# ------ Auth ------
class TestAuth:
    def test_register_and_login(self, new_user):
        assert new_user["user"]["email"] == new_user["email"].lower()
        assert new_user["user"]["role"] == "user"
        r = requests.post(f"{API}/auth/login", json={"email": new_user["email"], "password": "test123456"})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_register_duplicate_email(self, new_user):
        r = requests.post(f"{API}/auth/register", json={"name": "X", "email": new_user["email"], "password": "x"})
        assert r.status_code == 400

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["user"]["email"] == ADMIN_EMAIL

    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"


# ------ Games ------
class TestGames:
    def test_list_games(self):
        r = requests.get(f"{API}/games")
        assert r.status_code == 200
        games = r.json()
        assert len(games) >= 12
        assert any(g["id"] == "elden-ring" for g in games)

    def test_get_game(self):
        r = requests.get(f"{API}/games/elden-ring")
        assert r.status_code == 200
        assert r.json()["title"] == "Elden Ring"

    def test_get_game_notfound(self):
        r = requests.get(f"{API}/games/does-not-exist")
        assert r.status_code == 404


# ------ Nodes ------
class TestNodes:
    def test_list_nodes(self):
        r = requests.get(f"{API}/nodes")
        assert r.status_code == 200
        nodes = r.json()
        assert len(nodes) == 5
        n = nodes[0]
        for k in ("ping", "load", "gpu_util", "queue", "status"):
            assert k in n


# ------ Library ------
class TestLibrary:
    def test_library_flow(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.get(f"{API}/library", headers=h)
        assert r.status_code == 200
        initial = len(r.json())

        r = requests.post(f"{API}/library/elden-ring", headers=h)
        assert r.status_code == 200

        r = requests.get(f"{API}/library", headers=h)
        assert r.status_code == 200
        assert len(r.json()) == initial + 1

        r = requests.post(f"{API}/library/elden-ring/favorite", headers=h)
        assert r.status_code == 200
        assert r.json()["favorite"] is True

        r = requests.delete(f"{API}/library/elden-ring", headers=h)
        assert r.status_code == 200

    def test_library_requires_auth(self):
        r = requests.get(f"{API}/library")
        assert r.status_code == 401


# ------ Sessions ------
class TestSessions:
    def test_session_start_metrics_end(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.post(f"{API}/sessions/start", headers=h,
                          json={"game_id": "cyberpunk-2077", "node_id": "sao-paulo"})
        assert r.status_code == 200, r.text
        session = r.json()["session"]
        sid = session["id"]
        assert session["active"] is True

        r = requests.get(f"{API}/sessions/active", headers=h)
        assert r.status_code == 200
        assert r.json()["session"]["id"] == sid

        r = requests.get(f"{API}/sessions/{sid}/metrics", headers=h)
        assert r.status_code == 200
        m = r.json()
        for k in ("fps", "ping", "bitrate", "resolution"):
            assert k in m

        r = requests.post(f"{API}/sessions/{sid}/end", headers=h)
        assert r.status_code == 200

        r = requests.get(f"{API}/sessions/active", headers=h)
        assert r.json()["session"] is None

    def test_session_invalid_game(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.post(f"{API}/sessions/start", headers=h,
                          json={"game_id": "bogus", "node_id": "sao-paulo"})
        assert r.status_code == 404


# ------ Saves ------
class TestSaves:
    def test_save_flow(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.post(f"{API}/saves", headers=h, json={"game_id": "gow-ragnarok", "label": "TEST_slot"})
        assert r.status_code == 200
        sid = r.json()["id"]
        assert r.json()["label"] == "TEST_slot"

        r = requests.get(f"{API}/saves", headers=h)
        assert r.status_code == 200
        assert any(s["id"] == sid for s in r.json())

        r = requests.delete(f"{API}/saves/{sid}", headers=h)
        assert r.status_code == 200

        r = requests.get(f"{API}/saves", headers=h)
        assert not any(s["id"] == sid for s in r.json())


# ------ Stats ------
class TestStats:
    def test_stats(self, new_user):
        h = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.get(f"{API}/stats", headers=h)
        assert r.status_code == 200
        d = r.json()
        for k in ("games_in_library", "cloud_saves", "total_hours", "plan"):
            assert k in d
