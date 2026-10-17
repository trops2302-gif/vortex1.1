# PRD — Vortex Cloud Gaming

## Problema original
Usuário (PT-BR) quer um "cloud gaming" com servidor próprio para jogar jogos de PC (Elden Ring, God of War Ragnarök) pelo celular, dependendo só de internet, com o jogo rodando num servidor potente e sendo salvo.

## Escopo acordado (via ask_human)
- Plataforma/painel web FUNCIONAL de cloud gaming; o streaming de vídeo em si é SIMULADO/MOCKADO.
- Nomes reais de jogos usados apenas como placeholders de catálogo.
- Login e-mail + senha (JWT).
- Sem planos pagos (planos são apenas demonstrativos).
- Visual gaming escuro/vibrante (definido pelo E1): "Tactical Obsidian" + ciano/âmbar/violeta, fontes Barlow Condensed + Inter.

## Arquitetura
- Backend: FastAPI + MongoDB (motor). Auth JWT (Bearer no body + cookie httpOnly). Seed de 12 jogos, 5 nós de servidor e admin no startup.
- Frontend: React + Tailwind + framer-motion + lucide-react + sonner. AuthContext (localStorage vx_token), LaunchContext (diálogo de lançamento), páginas protegidas.

## Implementado (2026-06)
- Landing pública com hero, features e disclaimer de "como funciona".
- Auth: register, login, logout, me (JWT). Rotas protegidas com redirect.
- Dashboard: stats, jogo em destaque, melhor servidor, recentes e recomendados.
- Catálogo: busca, filtro por gênero, modal de detalhes, adicionar à biblioteca.
- Biblioteca: horas jogadas, favoritar, remover, jogar.
- Sessão de stream (/play): overlay de conexão, superfície de vídeo mockada com scanlines, HUD animado (FPS/ping/bitrate/resolução/perda), seletor de qualidade, gamepad virtual (mobile), save rápido, encerrar sessão.
- Status de servidores: 5 nós com ping/GPU/fila/carga, auto-refresh 5s.
- Saves na nuvem: listar, criar (modal), restaurar (mock), excluir.
- Perfil: dados, stats, preferências (codec/controle), planos demonstrativos.
- Testado via testing_agent: backend 100% (16/16), frontend 100%, sem bugs.

## MOCKADO / Limitações
- O vídeo do jogo é SIMULADO (imagem estática + métricas sintéticas). Não há GPU/stream real nem jogos reais licenciados — inviável tecnicamente/legalmente neste ambiente.

## Backlog / próximos passos
- Histórico de Sessões (FEITO 2026-06): timeline com jogo, servidor, duração e saves criados (/app/history, GET /api/sessions/history).
- Protótipo WebRTC real (FEITO 2026-06): /app/webrtc — screen share P2P de verdade (getDisplayMedia + RTCPeerConnection + sinalização WebSocket /api/ws/signal/{room} + STUN). Host = navegador deste PC; viewer = celular via link. Falta TURN para NATs difíceis.
- P1: Watch party / co-op, conquistas.
- P1: Teste real de ping do navegador até os nós.
- P2: CORS explícito por origem + brute-force lockout no login para produção.
- P2: Adicionar servidor TURN (coturn) ao demo WebRTC; integrar Moonlight/Sunshine ou GPU cloud (AWS g4/g5, Paperspace) para rodar jogos reais.

## Sessão 2026-06 (continuação)
- Projeto clonado de github t2536985-glitch/vortex1 e rodando (JWT_SECRET/ADMIN no backend/.env).
- Player WebRTC real: /app/host (PC captura tela + sinalização autenticada /api/ws/stream) e /stream?game=ID (celular). STUN + TURN gratuito de teste (turn.elixir-webrtc.org via /api/webrtc/ice; TURN_URLS/USERNAME/CREDENTIAL no .env substituem).
- Controle remoto: teclado, mouse (pointer lock), touchpad, gamepad virtual Xbox, controle Bluetooth (Gamepad API) → DataChannel → host → agente local ws://127.0.0.1:8765.
- Agente do PC: /app/host-agent (vortex_agent.py, SendInput scancodes, vgamepad/ViGEmBus, launch restrito às pastas, PIN com lockout). Download via /api/host/agent/{arquivo}.
- Meus Jogos (/app/mygames): cadastro manual, 2 pastas configuráveis, exportar apps para Sunshine, opção Moonlight.
- Visual estilo Game Pass (verde #107C10, Archivo/Figtree, top nav, hero carrossel, tiles retrato).
- Usuário pediu: NÃO chamar testing agent nem outros agentes; ele testa.
## Backlog
- Sync automático com API do Sunshine; capas automáticas; histórico das sessões reais; mapeamento de teclas → controle.
