# AI Fitness & Posture Coach

A mobile-first web application that uses **MediaPipe Pose Landmarker** for real-time posture and exercise analysis, with an AI coaching engine that delivers voice and visual feedback during workouts.

> **Current Phase: Phase 1 — Foundation**

---

## Project Overview

This application guides users through exercises by analysing their body posture in real time using the device camera. The system detects joints and angles, tracks repetitions, identifies form deviations, and provides coaching feedback — all without sending video frames to a server.

The real-time pose loop runs entirely on the client. The backend stores session events, exercise history, and progress data.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Python 3.11, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL 16 |
| Computer Vision | MediaPipe Pose Landmarker (client-side, Phase 2+) |
| Infrastructure | Docker, Docker Compose |

---

## Architecture

```
┌─────────────────────────── Client (Browser) ───────────────────────────┐
│                                                                          │
│  Camera → MediaPipe → Landmarks → Biomechanics → Form Analysis          │
│                                                    ↓                    │
│                              Rep Tracker → Coaching Layer               │
│                                                    ↓                    │
│                              Voice Feedback    Session Events           │
└────────────────────────────────────────────────────┬────────────────────┘
                                                     │ HTTP (events only)
┌────────────────────────── Backend (FastAPI) ────────▼────────────────────┐
│                                                                           │
│  POST /api/v1/sessions    POST /api/v1/events    GET /api/v1/progress    │
│                                    ↓                                      │
│                             PostgreSQL DB                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

**Key principle:** The real-time pose detection loop never calls the backend. Only discrete events (session start, rep completed, deviation detected) are sent — these tolerate network latency.

---

## Folder Structure

```
project-root/
├── frontend/                  # React + TypeScript + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── ui/            # Button, Card
│       │   └── layout/        # Layout, BottomNav
│       ├── pages/             # One file per screen
│       ├── services/          # Backend API calls (Phase 6+)
│       ├── hooks/             # Custom React hooks
│       ├── types/             # Shared TypeScript interfaces
│       └── utils/             # Pure helper functions
│
├── backend/                   # Python + FastAPI
│   └── app/
│       ├── api/v1/            # Route handlers
│       ├── core/              # Config, settings
│       ├── db/                # SQLAlchemy engine + session
│       ├── models/            # ORM models (Phase 6+)
│       ├── schemas/           # Pydantic schemas (Phase 6+)
│       └── services/          # Business logic (future phases)
│
├── database/                  # DB init scripts (if needed)
├── docker-compose.yml
├── .env.example               # Safe placeholder — commit this
├── .env                       # Real credentials — never commit
├── .gitignore
└── README.md
```

---

## Environment Setup

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set a secure `POSTGRES_PASSWORD`.

3. Never commit `.env`. It is listed in `.gitignore`.

`.env.example` documents all required variables with safe placeholder values and is the file committed to version control.

---

## Docker Setup

### Start the full stack

```bash
docker compose up --build
```

This starts three services:
- **frontend** — Vite dev server on `http://localhost:5173`
- **backend** — FastAPI + Uvicorn on `http://localhost:8001`
- **postgres** — PostgreSQL 16 on `localhost:5432`

### Stop

```bash
docker compose down
```

### Stop and remove volumes (wipes database)

```bash
docker compose down -v
```

---

## Frontend

Access the application at:

```
http://localhost:5173
```

Available routes (Phase 1 placeholders):

| Route | Page |
|---|---|
| `/` | Home / Dashboard |
| `/exercises` | Exercise Selection |
| `/workout` | Live Workout |
| `/session-summary` | Session Summary |
| `/progress` | Progress & History |
| `/profile` | Profile & Settings |

---

## Backend

FastAPI runs at:

```
http://localhost:8001
```

### Health check

```bash
curl http://localhost:8001/health
```

Expected response:

```json
{"status": "ok"}
```

### API Documentation (auto-generated)

```
http://localhost:8001/docs       ← Swagger UI
http://localhost:8001/redoc      ← ReDoc
```

---

## PostgreSQL

The database runs inside Docker.

Connect using a local client (e.g. psql, TablePlus, DBeaver):

```
Host:     localhost
Port:     5432
Database: fitness_db
User:     postgres
Password: (value from your .env)
```

Or connect inside the running container:

```bash
docker compose exec postgres psql -U postgres -d fitness_db
```

---

## Alembic (Database Migrations)

Alembic is configured and connected to the database. No migrations exist yet in Phase 1 — the schema is empty until Phase 6 when `Session`, `Exercise`, and `Event` models are defined.

### Run migrations (when they exist)

```bash
docker compose exec backend alembic upgrade head
```

### Create a new migration

```bash
docker compose exec backend alembic revision --autogenerate -m "describe change"
```

### Check current migration state

```bash
docker compose exec backend alembic current
```

---

## Development Roadmap

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Foundation — scaffolding, routing, Docker, DB | ✅ **CURRENT** |
| Phase 2 | Camera + MediaPipe Pose Landmarker | ⏳ Pending |
| Phase 3 | Biomechanics + Exercise Definitions | ⏳ Pending |
| Phase 4 | Form Analysis + Rep Tracking | ⏳ Pending |
| Phase 5 | Coaching Layer (rule-based) | ⏳ Pending |
| Phase 6 | Session + Backend Events | ⏳ Pending |
| Phase 7 | Progress + History | ⏳ Pending |
| Phase 8 | Polish + AI Integration | ⏳ Pending |

---

## Development Notes

- Business logic lives in `modules/` (frontend) and `services/` (backend), not in UI components.
- The real-time pose loop will never be blocked by an API call.
- No external APIs are used in Phase 1.
- When an AI API is integrated (Phase 8), credentials will be stored only in `.env` and never hard-coded.
