import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging
import random
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, BeforeValidator, ConfigDict

# ----------------------------------------------------------------------------
# DB
# ----------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Vortex Cloud Gaming API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
logger = logging.getLogger("vortex")
logging.basicConfig(level=logging.INFO)

PyObjectId = Annotated[str, BeforeValidator(str)]


# ----------------------------------------------------------------------------
# Auth helpers
# ----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class StartSessionInput(BaseModel):
    game_id: str
    node_id: str


class CreateSaveInput(BaseModel):
    game_id: str
    label: Optional[str] = None
    session_id: Optional[str] = None


# ----------------------------------------------------------------------------
# Seed data
# ----------------------------------------------------------------------------
GAMES_SEED = [
    {"id": "elden-ring", "title": "Elden Ring", "genre": "RPG de Ação", "studio": "FromSoftware",
     "rating": 96, "size_gb": 60, "year": 2022, "hdr": True, "featured": True,
     "tags": ["Mundo Aberto", "Souls", "Fantasia Sombria"],
     "description": "Erga-se, Maculado, e seja guiado pela graça para brandir o poder do Anel Prístino e tornar-se um Lorde Prístino nas Terras Intermédias.",
     "cover": "https://images.unsplash.com/photo-1640903581708-8d491706515b?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1696027944149-c1c074b01b03?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "gow-ragnarok", "title": "God of War Ragnarök", "genre": "Ação / Aventura", "studio": "Santa Monica",
     "rating": 94, "size_gb": 90, "year": 2022, "hdr": True, "featured": True,
     "tags": ["Nórdico", "Narrativa", "Cinematográfico"],
     "description": "Kratos e Atreus embarcam numa jornada mítica em busca de respostas enquanto o Ragnarök se aproxima dos Nove Reinos.",
     "cover": "https://images.unsplash.com/photo-1675345842723-841fd8153628?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1629794332921-5c3648de80cc?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "cyberpunk-2077", "title": "Cyberpunk 2077", "genre": "RPG de Ação", "studio": "CD Projekt Red",
     "rating": 86, "size_gb": 70, "year": 2020, "hdr": True, "featured": True,
     "tags": ["Cyberpunk", "Mundo Aberto", "Sci-Fi"],
     "description": "Torne-se um mercenário cibernético em Night City, uma megalópole obcecada por poder, glamour e modificações corporais.",
     "cover": "https://images.unsplash.com/photo-1672872476232-da16b45c9001?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1600998837340-4887228e311f?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "black-myth-wukong", "title": "Black Myth: Wukong", "genre": "RPG de Ação", "studio": "Game Science",
     "rating": 82, "size_gb": 130, "year": 2024, "hdr": True, "featured": False,
     "tags": ["Mitologia", "Souls", "Chinês"],
     "description": "Embarque numa épica jornada baseada em 'Jornada ao Oeste', encarnando o Destinado para desvendar a verdade por trás de um passado glorioso.",
     "cover": "https://images.unsplash.com/photo-1692124483246-c7f2a8085034?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1686700529666-a5358f4a2c98?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "starfield", "title": "Starfield", "genre": "RPG Espacial", "studio": "Bethesda",
     "rating": 83, "size_gb": 125, "year": 2023, "hdr": True, "featured": False,
     "tags": ["Espaço", "Exploração", "Sci-Fi"],
     "description": "Crie qualquer personagem e explore com liberdade sem precedentes num universo com mais de mil planetas.",
     "cover": "https://images.unsplash.com/photo-1688407832489-cc9db90773f5?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1761212625300-e37d470be2ed?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "witcher-3", "title": "The Witcher 3: Wild Hunt", "genre": "RPG de Ação", "studio": "CD Projekt Red",
     "rating": 93, "size_gb": 50, "year": 2015, "hdr": True, "featured": False,
     "tags": ["Fantasia", "Mundo Aberto", "Narrativa"],
     "description": "Geralt de Rívia, caçador de monstros, parte numa busca para encontrar a criança da profecia num vasto mundo aberto.",
     "cover": "https://images.unsplash.com/photo-1460194436988-671f763436b7?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1599721765154-0f596e632cba?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "horizon-fw", "title": "Horizon Forbidden West", "genre": "Ação / Aventura", "studio": "Guerrilla Games",
     "rating": 88, "size_gb": 100, "year": 2022, "hdr": True, "featured": False,
     "tags": ["Pós-apocalíptico", "Mundo Aberto", "Robôs"],
     "description": "Junte-se a Aloy enquanto ela desbrava fronteiras perigosas para desvendar os mistérios por trás de pragas que ameaçam a vida.",
     "cover": "https://images.unsplash.com/photo-1711319551836-f7ca9764a898?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1599721765154-0f596e632cba?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "spiderman-2", "title": "Marvel's Spider-Man 2", "genre": "Ação / Aventura", "studio": "Insomniac",
     "rating": 90, "size_gb": 98, "year": 2023, "hdr": True, "featured": False,
     "tags": ["Super-herói", "Mundo Aberto", "Marvel"],
     "description": "Peter Parker e Miles Morales enfrentam a ameaça definitiva de Venom numa Nova York maior e mais vibrante.",
     "cover": "https://images.unsplash.com/photo-1586968272237-a3d597214887?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1624075250557-9e020cecaaf6?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "hogwarts-legacy", "title": "Hogwarts Legacy", "genre": "RPG de Ação", "studio": "Avalanche",
     "rating": 84, "size_gb": 85, "year": 2023, "hdr": True, "featured": False,
     "tags": ["Magia", "Mundo Aberto", "Fantasia"],
     "description": "Viva uma aventura inédita no mundo mágico dos anos 1800, frequentando Hogwarts e dominando feitiços e poções.",
     "cover": "https://images.unsplash.com/photo-1599937054672-14f207a40120?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1696027944149-c1c074b01b03?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "baldurs-gate-3", "title": "Baldur's Gate 3", "genre": "RPG", "studio": "Larian Studios",
     "rating": 96, "size_gb": 122, "year": 2023, "hdr": True, "featured": True,
     "tags": ["D&D", "Turnos", "Narrativa"],
     "description": "Reúna seu grupo e retorne aos Reinos Esquecidos numa história de companheirismo, traição e sobrevivência.",
     "cover": "https://images.unsplash.com/photo-1686700529666-a5358f4a2c98?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1692124483246-c7f2a8085034?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "alan-wake-2", "title": "Alan Wake 2", "genre": "Survival Horror", "studio": "Remedy",
     "rating": 89, "size_gb": 90, "year": 2023, "hdr": True, "featured": False,
     "tags": ["Terror", "Narrativa", "Suspense"],
     "description": "Um escritor preso num pesadelo e uma agente do FBI investigam assassinatos rituais numa cidade assombrada.",
     "cover": "https://images.unsplash.com/photo-1600998837340-4887228e311f?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1672872476232-da16b45c9001?crop=entropy&cs=srgb&fm=jpg&q=85"},
    {"id": "red-dead-2", "title": "Red Dead Redemption 2", "genre": "Ação / Aventura", "studio": "Rockstar",
     "rating": 97, "size_gb": 120, "year": 2018, "hdr": True, "featured": True,
     "tags": ["Faroeste", "Mundo Aberto", "Narrativa"],
     "description": "América, 1899. Arthur Morgan e a gangue Van der Linde fogem enquanto a era dos fora-da-lei chega ao fim.",
     "cover": "https://images.unsplash.com/photo-1599721765154-0f596e632cba?crop=entropy&cs=srgb&fm=jpg&q=85",
     "hero": "https://images.unsplash.com/photo-1711319551836-f7ca9764a898?crop=entropy&cs=srgb&fm=jpg&q=85"},
]

NODES_SEED = [
    {"id": "sao-paulo", "name": "São Paulo", "country": "Brasil", "flag": "🇧🇷", "gpu": "RTX 4090",
     "base_ping": 12, "region": "América do Sul"},
    {"id": "virginia", "name": "Virgínia", "country": "EUA", "flag": "🇺🇸", "gpu": "RTX 4090",
     "base_ping": 128, "region": "América do Norte"},
    {"id": "frankfurt", "name": "Frankfurt", "country": "Alemanha", "flag": "🇩🇪", "gpu": "RTX 4080",
     "base_ping": 210, "region": "Europa"},
    {"id": "tokyo", "name": "Tóquio", "country": "Japão", "flag": "🇯🇵", "gpu": "RTX 4090",
     "base_ping": 265, "region": "Ásia"},
    {"id": "santiago", "name": "Santiago", "country": "Chile", "flag": "🇨🇱", "gpu": "RTX 4070 Ti",
     "base_ping": 38, "region": "América do Sul"},
]


# ----------------------------------------------------------------------------
# Auth endpoints
# ----------------------------------------------------------------------------
def _public_user(doc: dict) -> dict:
    return {"id": str(doc["_id"]), "name": doc.get("name"), "email": doc.get("email"),
            "role": doc.get("role", "user"), "plan": doc.get("plan", "Free Trial"),
            "created_at": doc.get("created_at")}


def _set_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


@api_router.post("/auth/register")
async def register(payload: RegisterInput, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Este e-mail já está cadastrado")
    doc = {"name": payload.name, "email": email, "password_hash": hash_password(payload.password),
           "role": "user", "plan": "Free Trial", "created_at": datetime.now(timezone.utc).isoformat()}
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    token = create_access_token(str(res.inserted_id), email)
    _set_cookie(response, token)
    return {"user": _public_user(doc), "token": token}


@api_router.post("/auth/login")
async def login(payload: LoginInput, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    token = create_access_token(str(user["_id"]), email)
    _set_cookie(response, token)
    return {"user": _public_user(user), "token": token}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": {"id": user["_id"], "name": user.get("name"), "email": user.get("email"),
                     "role": user.get("role", "user"), "plan": user.get("plan", "Free Trial"),
                     "created_at": user.get("created_at")}}


# ----------------------------------------------------------------------------
# Games
# ----------------------------------------------------------------------------
@api_router.get("/games")
async def list_games():
    games = await db.games.find({}, {"_id": 0}).to_list(1000)
    return games


@api_router.get("/games/{game_id}")
async def get_game(game_id: str):
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    return game


# ----------------------------------------------------------------------------
# Nodes (with dynamic live-ish metrics)
# ----------------------------------------------------------------------------
@api_router.get("/nodes")
async def list_nodes():
    nodes = await db.nodes.find({}, {"_id": 0}).to_list(1000)
    out = []
    for n in nodes:
        jitter = random.randint(-4, 6)
        load = random.randint(35, 92)
        queue = 0 if load < 85 else random.randint(1, 4)
        out.append({**n, "ping": max(5, n["base_ping"] + jitter), "load": load,
                    "gpu_util": random.randint(40, 98), "queue": queue,
                    "status": "online" if load < 97 else "degraded"})
    return out


# ----------------------------------------------------------------------------
# Library
# ----------------------------------------------------------------------------
@api_router.get("/library")
async def get_library(user: dict = Depends(get_current_user)):
    items = await db.library.find({"user_id": user["_id"]}, {"_id": 0}).to_list(1000)
    games_by_id = {g["id"]: g for g in await db.games.find({}, {"_id": 0}).to_list(1000)}
    result = []
    for it in items:
        g = games_by_id.get(it["game_id"])
        if g:
            result.append({**g, "hours_played": it.get("hours_played", 0),
                           "favorite": it.get("favorite", False),
                           "added_at": it.get("added_at"),
                           "last_played": it.get("last_played")})
    return result


@api_router.post("/library/{game_id}")
async def add_to_library(game_id: str, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    existing = await db.library.find_one({"user_id": user["_id"], "game_id": game_id})
    if existing:
        return {"ok": True, "already": True}
    await db.library.insert_one({"user_id": user["_id"], "game_id": game_id,
                                 "hours_played": 0, "favorite": False,
                                 "added_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True}


@api_router.delete("/library/{game_id}")
async def remove_from_library(game_id: str, user: dict = Depends(get_current_user)):
    await db.library.delete_one({"user_id": user["_id"], "game_id": game_id})
    return {"ok": True}


@api_router.post("/library/{game_id}/favorite")
async def toggle_favorite(game_id: str, user: dict = Depends(get_current_user)):
    item = await db.library.find_one({"user_id": user["_id"], "game_id": game_id})
    if not item:
        raise HTTPException(status_code=404, detail="Jogo não está na biblioteca")
    new_val = not item.get("favorite", False)
    await db.library.update_one({"_id": item["_id"]}, {"$set": {"favorite": new_val}})
    return {"ok": True, "favorite": new_val}


# ----------------------------------------------------------------------------
# Sessions
# ----------------------------------------------------------------------------
@api_router.post("/sessions/start")
async def start_session(payload: StartSessionInput, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"id": payload.game_id}, {"_id": 0})
    node = await db.nodes.find_one({"id": payload.node_id}, {"_id": 0})
    if not game or not node:
        raise HTTPException(status_code=404, detail="Jogo ou servidor inválido")
    # auto-add to library
    if not await db.library.find_one({"user_id": user["_id"], "game_id": payload.game_id}):
        await db.library.insert_one({"user_id": user["_id"], "game_id": payload.game_id,
                                     "hours_played": 0, "favorite": False,
                                     "added_at": datetime.now(timezone.utc).isoformat()})
    # end previous active sessions
    await db.sessions.update_many({"user_id": user["_id"], "active": True},
                                  {"$set": {"active": False, "ended_at": datetime.now(timezone.utc).isoformat()}})
    sess_id = secrets.token_hex(8)
    queue = node.get("base_ping", 0) and random.choice([0, 0, 0, 1])
    doc = {"id": sess_id, "user_id": user["_id"], "game_id": payload.game_id,
           "node_id": payload.node_id, "active": True, "queue_position": queue,
           "started_at": datetime.now(timezone.utc).isoformat()}
    await db.sessions.insert_one(doc)
    await db.library.update_one({"user_id": user["_id"], "game_id": payload.game_id},
                                {"$set": {"last_played": datetime.now(timezone.utc).isoformat()}})
    return {"session": {k: v for k, v in doc.items() if k != "_id"}, "game": game, "node": node}


@api_router.get("/sessions/active")
async def active_session(user: dict = Depends(get_current_user)):
    doc = await db.sessions.find_one({"user_id": user["_id"], "active": True}, {"_id": 0})
    if not doc:
        return {"session": None}
    game = await db.games.find_one({"id": doc["game_id"]}, {"_id": 0})
    node = await db.nodes.find_one({"id": doc["node_id"]}, {"_id": 0})
    return {"session": doc, "game": game, "node": node}


@api_router.get("/sessions/{session_id}/metrics")
async def session_metrics(session_id: str, user: dict = Depends(get_current_user)):
    doc = await db.sessions.find_one({"id": session_id, "user_id": user["_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    node = await db.nodes.find_one({"id": doc["node_id"]}, {"_id": 0})
    base = node.get("base_ping", 20) if node else 20
    fps = random.choice([60, 90, 120, 120, 120, 118, 116])
    return {"fps": fps, "ping": max(5, base + random.randint(-3, 8)),
            "bitrate": random.randint(38, 55), "resolution": "4K HDR",
            "packet_loss": round(random.uniform(0, 0.4), 2),
            "codec": random.choice(["AV1", "H.265"])}


@api_router.post("/sessions/{session_id}/end")
async def end_session(session_id: str, user: dict = Depends(get_current_user)):
    doc = await db.sessions.find_one({"id": session_id, "user_id": user["_id"]})
    if doc:
        await db.sessions.update_one({"_id": doc["_id"]},
                                     {"$set": {"active": False, "ended_at": datetime.now(timezone.utc).isoformat()}})
        # accrue some play time
        started = datetime.fromisoformat(doc["started_at"])
        mins = (datetime.now(timezone.utc) - started).total_seconds() / 3600
        await db.library.update_one({"user_id": user["_id"], "game_id": doc["game_id"]},
                                    {"$inc": {"hours_played": round(mins, 2)}})
    return {"ok": True}


@api_router.get("/sessions/history")
async def sessions_history(user: dict = Depends(get_current_user)):
    docs = await db.sessions.find({"user_id": user["_id"]}, {"_id": 0}).sort("started_at", -1).to_list(500)
    games_by_id = {g["id"]: g for g in await db.games.find({}, {"_id": 0}).to_list(1000)}
    nodes_by_id = {n["id"]: n for n in await db.nodes.find({}, {"_id": 0}).to_list(1000)}
    out = []
    for d in docs:
        g = games_by_id.get(d["game_id"])
        n = nodes_by_id.get(d["node_id"])
        start = datetime.fromisoformat(d["started_at"])
        end = datetime.fromisoformat(d["ended_at"]) if d.get("ended_at") else datetime.now(timezone.utc)
        duration = int((end - start).total_seconds())
        saves = await db.saves.find({"user_id": user["_id"], "session_id": d["id"]}, {"_id": 0}).to_list(100)
        out.append({
            "id": d["id"],
            "active": d.get("active", False),
            "started_at": d["started_at"],
            "ended_at": d.get("ended_at"),
            "duration_seconds": duration,
            "game": {"id": g["id"], "title": g["title"], "cover": g["cover"]} if g else None,
            "node": {"id": n["id"], "name": n["name"], "flag": n["flag"], "gpu": n["gpu"]} if n else None,
            "saves": [{"id": s["id"], "label": s["label"]} for s in saves],
        })
    return out


# ----------------------------------------------------------------------------
# Cloud Saves
# ----------------------------------------------------------------------------
@api_router.get("/saves")
async def list_saves(game_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["_id"]}
    if game_id:
        q["game_id"] = game_id
    saves = await db.saves.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    games_by_id = {g["id"]: g for g in await db.games.find({}, {"_id": 0}).to_list(1000)}
    for s in saves:
        g = games_by_id.get(s["game_id"])
        if g:
            s["game_title"] = g["title"]
            s["game_cover"] = g["cover"]
    return saves


@api_router.post("/saves")
async def create_save(payload: CreateSaveInput, user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"id": payload.game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    count = await db.saves.count_documents({"user_id": user["_id"], "game_id": payload.game_id})
    doc = {"id": secrets.token_hex(8), "user_id": user["_id"], "game_id": payload.game_id,
           "label": payload.label or f"Slot {count + 1}",
           "size_mb": random.randint(8, 240),
           "thumbnail": game["hero"],
           "sync_status": "synced",
           "session_id": payload.session_id,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.saves.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@api_router.delete("/saves/{save_id}")
async def delete_save(save_id: str, user: dict = Depends(get_current_user)):
    await db.saves.delete_one({"id": save_id, "user_id": user["_id"]})
    return {"ok": True}


@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    lib_count = await db.library.count_documents({"user_id": user["_id"]})
    saves_count = await db.saves.count_documents({"user_id": user["_id"]})
    items = await db.library.find({"user_id": user["_id"]}, {"_id": 0}).to_list(1000)
    total_hours = round(sum(i.get("hours_played", 0) for i in items), 1)
    return {"games_in_library": lib_count, "cloud_saves": saves_count,
            "total_hours": total_hours, "plan": user.get("plan", "Free Trial")}


# ----------------------------------------------------------------------------
# Startup
# ----------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    # seed games
    for g in GAMES_SEED:
        await db.games.update_one({"id": g["id"]}, {"$set": g}, upsert=True)
    for n in NODES_SEED:
        await db.nodes.update_one({"id": n["id"]}, {"$set": n}, upsert=True)
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@vortex.gg")
    admin_password = os.environ.get("ADMIN_PASSWORD", "vortex123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"name": "Vortex Admin", "email": admin_email,
                                   "password_hash": hash_password(admin_password), "role": "admin",
                                   "plan": "Ultra Rig", "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})
    logger.info("Vortex seed complete")


# ----------------------------------------------------------------------------
# WebRTC Signaling (real peer-to-peer screen stream demo)
# ----------------------------------------------------------------------------
class SignalRooms:
    def __init__(self):
        self.rooms: dict = {}

    async def join(self, room: str, ws: WebSocket):
        self.rooms.setdefault(room, set()).add(ws)

    def leave(self, room: str, ws: WebSocket):
        if room in self.rooms:
            self.rooms[room].discard(ws)
            if not self.rooms[room]:
                self.rooms.pop(room, None)

    async def broadcast(self, room: str, sender: WebSocket, message: str):
        for peer in list(self.rooms.get(room, set())):
            if peer is not sender:
                try:
                    await peer.send_text(message)
                except Exception:
                    pass

    def count(self, room: str) -> int:
        return len(self.rooms.get(room, set()))


signal_rooms = SignalRooms()


@api_router.websocket("/ws/signal/{room}")
async def signal_ws(websocket: WebSocket, room: str):
    await websocket.accept()
    await signal_rooms.join(room, websocket)
    # tell the newcomer how many peers are already here and notify others
    await websocket.send_text(f'{{"type":"joined","peers":{signal_rooms.count(room)}}}')
    await signal_rooms.broadcast(room, websocket, '{"type":"peer-joined"}')
    try:
        while True:
            data = await websocket.receive_text()
            await signal_rooms.broadcast(room, websocket, data)
    except WebSocketDisconnect:
        pass
    finally:
        signal_rooms.leave(room, websocket)
        await signal_rooms.broadcast(room, websocket, '{"type":"peer-left"}')


# ----------------------------------------------------------------------------
# PC Host: my games, settings, ICE, authenticated stream signaling
# ----------------------------------------------------------------------------
import json
import httpx
from fastapi.responses import FileResponse

AGENT_DIR = ROOT_DIR.parent / "host-agent"


class MyGameInput(BaseModel):
    title: str
    folder_index: int = 0
    exe: str
    args: str = ""
    cover: str = ""
    hero: str = ""
    genre: str = ""


class SettingsInput(BaseModel):
    game_folders: List[str] = ["", ""]
    moonlight_host: str = ""
    pc_name: str = "Meu PC"


def _settings_of(user: dict) -> dict:
    s = user.get("settings") or {}
    folders = (s.get("game_folders") or ["", ""]) + ["", ""]
    return {"game_folders": folders[:2], "moonlight_host": s.get("moonlight_host", ""),
            "pc_name": s.get("pc_name", "Meu PC")}


@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    return _settings_of(user)


@api_router.put("/settings")
async def put_settings(payload: SettingsInput, user: dict = Depends(get_current_user)):
    data = payload.model_dump()
    data["game_folders"] = (data["game_folders"] + ["", ""])[:2]
    await db.users.update_one({"_id": ObjectId(user["_id"])}, {"$set": {"settings": data}})
    return data


@api_router.get("/mygames")
async def list_mygames(user: dict = Depends(get_current_user)):
    return await db.mygames.find({"user_id": user["_id"]}, {"_id": 0, "user_id": 0}).sort("created_at", -1).to_list(1000)


@api_router.post("/mygames")
async def create_mygame(payload: MyGameInput, user: dict = Depends(get_current_user)):
    if not payload.title.strip() or not payload.exe.strip():
        raise HTTPException(status_code=400, detail="Nome e executável são obrigatórios")
    doc = {**payload.model_dump(), "id": secrets.token_hex(6), "user_id": user["_id"],
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.mygames.insert_one(doc)
    return {k: v for k, v in doc.items() if k not in ("_id", "user_id")}


@api_router.put("/mygames/{game_id}")
async def update_mygame(game_id: str, payload: MyGameInput, user: dict = Depends(get_current_user)):
    res = await db.mygames.update_one({"id": game_id, "user_id": user["_id"]}, {"$set": payload.model_dump()})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Jogo não encontrado")
    return await db.mygames.find_one({"id": game_id}, {"_id": 0, "user_id": 0})


@api_router.delete("/mygames/{game_id}")
async def delete_mygame(game_id: str, user: dict = Depends(get_current_user)):
    await db.mygames.delete_one({"id": game_id, "user_id": user["_id"]})
    return {"ok": True}


def _join_path(folder: str, exe: str) -> str:
    if not folder or ":" in exe[:3] or exe.startswith(("\\\\", "/")):
        return exe
    sep = "\\" if "\\" in folder or ":" in folder[:3] else "/"
    return folder.rstrip("\\/") + sep + exe.lstrip("\\/")


@api_router.get("/mygames/sunshine/export")
async def sunshine_export(user: dict = Depends(get_current_user)):
    folders = _settings_of(user)["game_folders"]
    games = await db.mygames.find({"user_id": user["_id"]}, {"_id": 0}).to_list(1000)
    apps = []
    for g in games:
        full = _join_path(folders[g.get("folder_index", 0)] if g.get("folder_index", 0) < 2 else "", g["exe"])
        wd = full.rsplit("\\", 1)[0] if "\\" in full else full.rsplit("/", 1)[0]
        cmd = f'"{full}" {g.get("args", "")}'.strip()
        apps.append({"name": g["title"], "cmd": cmd, "working-dir": wd, "auto-detach": "true"})
    return {"apps": apps}


@api_router.get("/webrtc/ice")
async def ice_servers(user: dict = Depends(get_current_user)):
    servers = [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]
    urls = os.environ.get("TURN_URLS")
    if urls:
        servers.append({"urls": urls.split(","), "username": os.environ.get("TURN_USERNAME", ""),
                        "credential": os.environ.get("TURN_CREDENTIAL", "")})
        return {"iceServers": servers, "turn": "custom"}
    try:
        async with httpx.AsyncClient(timeout=6) as c:
            r = await c.post(f"https://turn.elixir-webrtc.org/?service=turn&username=vx{user['_id'][-6:]}")
            d = r.json()
        uris = d["uris"] + [u.replace("udp", "tcp") for u in d["uris"] if "udp" in u]
        servers.append({"urls": uris, "username": d["username"], "credential": d["password"]})
        return {"iceServers": servers, "turn": "free-test"}
    except Exception as e:
        logger.warning(f"TURN fetch failed: {e}")
        return {"iceServers": servers, "turn": "none"}


@api_router.get("/host/agent/{name}")
async def download_agent(name: str):
    allowed = {"vortex_agent.py", "requirements.txt", "iniciar_agente.bat"}
    if name not in allowed:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    return FileResponse(AGENT_DIR / name, filename=name)


class StreamRooms:
    def __init__(self):
        self.rooms: dict = {}

    def room(self, uid: str) -> dict:
        return self.rooms.setdefault(uid, {"host": None, "viewers": {}})


stream_rooms = StreamRooms()


async def _ws_user(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        return str(user["_id"]) if user else None
    except Exception:
        return None


async def _send(ws: Optional[WebSocket], obj: dict):
    if ws:
        try:
            await ws.send_text(json.dumps(obj))
        except Exception:
            pass


@api_router.get("/host/status")
async def host_status(user: dict = Depends(get_current_user)):
    r = stream_rooms.rooms.get(user["_id"]) or {"host": None, "viewers": {}}
    return {"online": r["host"] is not None, "viewers": len(r["viewers"])}


@api_router.websocket("/ws/stream")
async def stream_ws(websocket: WebSocket, token: str = "", role: str = "viewer"):
    uid = await _ws_user(token)
    await websocket.accept()
    if not uid or role not in ("host", "viewer"):
        await websocket.close(code=4401)
        return
    room = stream_rooms.room(uid)
    peer_id = secrets.token_hex(4)
    if role == "host":
        if room["host"]:
            await _send(room["host"], {"type": "replaced"})
            try:
                await room["host"].close()
            except Exception:
                pass
        room["host"] = websocket
        await _send(websocket, {"type": "welcome", "id": peer_id, "viewers": list(room["viewers"].keys())})
        for vid, vws in room["viewers"].items():
            await _send(vws, {"type": "host-online"})
    else:
        room["viewers"][peer_id] = websocket
        await _send(websocket, {"type": "welcome", "id": peer_id, "host": room["host"] is not None})
        await _send(room["host"], {"type": "viewer-joined", "id": peer_id})
    try:
        while True:
            msg = json.loads(await websocket.receive_text())
            if role == "host":
                await _send(room["viewers"].get(msg.get("to")), {**msg, "from": "host"})
            else:
                await _send(room["host"], {**msg, "from": peer_id})
    except (WebSocketDisconnect, json.JSONDecodeError, RuntimeError):
        pass
    finally:
        if role == "host" and room["host"] is websocket:
            room["host"] = None
            for vws in room["viewers"].values():
                await _send(vws, {"type": "host-offline"})
        elif role == "viewer":
            room["viewers"].pop(peer_id, None)
            await _send(room["host"], {"type": "viewer-left", "id": peer_id})


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
