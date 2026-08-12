from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(
    title="AI Fitness Coach API",
    description="Backend for the AI Fitness & Posture Coaching application.",
    version="0.1.0",
)

# ── CORS ────────────────────────────────────────────────────────────────────
# Allow the Vite dev server during development.
# In production this should be restricted to the deployed frontend origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")


# ── Root health check (spec requirement: GET /health) ────────────────────────
@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """Primary health-check endpoint. Returns immediately without a DB call."""
    return {"status": "ok"}
