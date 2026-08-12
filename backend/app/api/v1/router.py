from fastapi import APIRouter

from app.api.v1.health import router as health_router

# ── v1 router ────────────────────────────────────────────────────────────────
# Add new route modules here as each phase introduces new endpoints.
api_router = APIRouter()

api_router.include_router(health_router, tags=["health"])
