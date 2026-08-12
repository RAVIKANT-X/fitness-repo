from fastapi import APIRouter

router = APIRouter()


@router.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    """
    Versioned health-check at /api/v1/health.
    The primary /health endpoint is registered directly on the FastAPI app
    in main.py per the project specification.
    """
    return {"status": "ok"}
