"""
Session service — database operations for WorkoutSession.

Keeps SQL logic out of the route handlers.
All functions accept a SQLAlchemy Session and return ORM objects.
"""

from sqlalchemy.orm import Session

from app.models.session import WorkoutSession
from app.schemas.session import SessionCreate


def create_session(db: Session, payload: SessionCreate) -> WorkoutSession:
    """
    Persist a new WorkoutSession to the database.
    Returns the created ORM instance with its generated id and created_at.
    """
    record = WorkoutSession(
        exercise_id=payload.exercise_id,
        exercise_name=payload.exercise_name,
        reps=payload.reps,
        form_status=payload.form_status,
        # Serialise Pydantic deviation objects to plain dicts for JSONB storage
        deviations=[d.model_dump() for d in payload.deviations],
        started_at=payload.started_at,
        completed_at=payload.completed_at,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_session_by_id(db: Session, session_id: int) -> WorkoutSession | None:
    """Retrieve a single session by primary key. Returns None if not found."""
    return db.get(WorkoutSession, session_id)


def list_sessions(db: Session, limit: int = 50) -> list[WorkoutSession]:
    """Return the most recent sessions, newest first."""
    return (
        db.query(WorkoutSession)
        .order_by(WorkoutSession.created_at.desc())
        .limit(limit)
        .all()
    )
