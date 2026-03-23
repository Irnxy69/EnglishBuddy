# EnglishBuddy

AI-driven English conversation training app MVP scaffold, generated from your v1.1 product and engineering spec.

## Monorepo Structure

- `apps/web`: Next.js 14 web MVP (login + session + chat)
- `apps/mobile`: Expo React Native scaffold
- `services/api`: Fastify API service (auth/sessions/scenarios/speech/user plan + WebSocket + LLM routing)
- `services/speech`: FastAPI speech service (iFlyTek/Qwen adapters with mock fallback)
- `packages/design-system`: Shared tokens for web/mobile
- `packages/shared`: Shared TypeScript interfaces

## Quick Start

### 1) Install Node dependencies

```bash
npm install
```

### 2) Start API + Web (recommended)

```bash
npm run dev
```

- Web: http://127.0.0.1:3000
- API: http://127.0.0.1:8001

### 2.1) Start API + Web + Speech together

```bash
npm run dev:all
```

### 2.2) Start Mobile app

```bash
npm run dev:mobile
```

### 3) Start Speech service (optional now)

```bash
cd services/speech
python3 -m pip install -r requirements.txt
npm run dev
```

- Speech: http://127.0.0.1:8002

### 4) Run all checks

```bash
npm run typecheck
```

### 5) Start Postgres/Redis and migrate schema

```bash
docker compose up -d
npm run db:migrate
```

## Implemented MVP APIs

- `POST /api/v1/auth/login`
- `GET /api/v1/scenarios`
- `POST /api/v1/sessions`
- `POST /api/v1/sessions/:id/messages`
- `GET /api/v1/sessions/:id/summary`
- `POST /api/v1/speech/stt`
- `POST /api/v1/speech/score`
- `POST /api/v1/speech/tts`
- `GET /api/v1/users/me/plan`
- `PUT /api/v1/users/me/plan`

## Implemented WebSocket Events

- Endpoint: `GET /api/v1/ws?token=<JWT>`
- client -> server: `message.send`
- server -> client: `reply.chunk`
- server -> client: `reply.done`
- server -> client: `score.result`

## LLM Routing (Phase 2)

- Complexity router: simple input -> Qwen, complex input -> DeepSeek
- Runtime fallback: if provider call fails or key is missing, auto fallback to mock coach response
- Strategy switch: set `LLM_STRATEGY=mock-only` for offline/local demo

### Required provider variables

- `DEEPSEEK_API_KEY`
- `QWEN_API_KEY`

## Speech Provider Routing (Phase 3)

- `SPEECH_PROVIDER_MODE=hybrid`: try iFlyTek/Qwen provider adapters first, fallback to mock
- `SPEECH_PROVIDER_MODE=mock-only`: use local mock only
- New endpoint: `/api/v1/speech/tts`

## Data Store Modes (Phase 3)

- `DATA_STORE_MODE=memory` (default): in-memory repository
- `DATA_STORE_MODE=postgres`: PostgreSQL repository + optional Redis cache bootstrap
- Migration SQL: `services/api/migrations/001_init.sql`

## Mobile + Design System (Phase 3)

- Expo app scaffold in `apps/mobile`
- Shared tokens in `packages/design-system`
- Mobile imports `@englishbuddy/design-system` theme directly

## Next Milestones

1. Replace speech provider placeholders with live iFlyTek/Qwen API request signing and full response parsing.
2. Add persistent users/auth tables and refresh-token flows in PostgreSQL.
3. Add observability dashboards and request-level provider metrics.
4. Implement mobile auth + chat + speech recording screens.
