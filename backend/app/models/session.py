"""
WorkoutSession ORM model.

Represents a single completed workout session.
Persists reps, form quality, and per-rep deviation data to PostgreSQL.

Design notes:
- deviations is stored as JSONB to avoid a separate table for the MVP.
  Each element is a JSON-serialised Deviation object from the frontend
  analysis engine.  Schema: [{id, severity, angleName?, observed, threshold}]
- Timestamps are stored as UTC (timezone=True).
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Which exercise this session recorded
    exercise_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    exercise_name: Mapped[str] = mapped_column(String(128), nullable=False)

    # Rep and form summary
    reps: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    form_status: Mapped[str] = mapped_column(String(16), nullable=False, default="GOOD")

    # Deviation list from the last completed rep (JSONB array)
    deviations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    # Session timing
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    completed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Record creation timestamp
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
