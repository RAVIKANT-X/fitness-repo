"""
Session API endpoints — Phase 4.5 MVP.

POST /api/v1/sessions        Create a new workout session
GET  /api/v1/sessions/{id}   Retrieve a session by id
GET  /api/v1/sessions        List recent sessions

Does NOT implement the full Phase 6 event architecture.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.schemas.session import SessionCreate, SessionResponse
from app.services.session_service import (
    create_session,
    get_session_by_id,
    list_sessions,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


# ── Dependency: database session ──────────────────────────────────────────────

def get_db():
    """Yield a SQLAlchemy session; close it on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new workout session",
)
def create_workout_session(
    payload: SessionCreate,
    db: Session = Depends(get_db),
) -> SessionResponse:
    """
    Persist a completed workout session to PostgreSQL.

    Called by the frontend Finish Workout flow after the user ends a session.
    Returns the persisted record including its generated `id` and `created_at`.
    """
    record = create_session(db, payload)
    return record


@router.get(
    "/{session_id}",
    response_model=SessionResponse,
    summary="Retrieve a session by id",
)
def get_workout_session(
    session_id: int,
    db: Session = Depends(get_db),
) -> SessionResponse:
    """Return a single WorkoutSession by primary key."""
    record = get_session_by_id(db, session_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {session_id} not found",
        )
    return record


@router.get(
    "",
    response_model=list[SessionResponse],
    summary="List recent workout sessions",
)
def list_workout_sessions(
    db: Session = Depends(get_db),
) -> list[SessionResponse]:
    """Return the 50 most recent sessions, newest first."""
    return list_sessions(db)
