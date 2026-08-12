"""
Pydantic schemas for WorkoutSession API.

Separation of concerns:
- DeviationSchema mirrors the Deviation type from the frontend analysis engine.
- SessionCreate is the request body for POST /api/v1/sessions.
- SessionResponse is the response body for GET and POST responses.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DeviationSchema(BaseModel):
    """
    Mirrors frontend Deviation type from analysisTypes.ts.
    All fields must match the frontend payload structure exactly.
    """

    id: str
    severity: str  # 'INFO' | 'WARNING' | 'ERROR'
    angleName: Optional[str] = None
    observed: float
    threshold: float


class SessionCreate(BaseModel):
    """Request body for POST /api/v1/sessions."""

    exercise_id: str = Field(..., min_length=1, max_length=64)
    exercise_name: str = Field(..., min_length=1, max_length=128)
    reps: int = Field(..., ge=0)
    form_status: str = Field(..., pattern=r"^(GOOD|WARNING|INVALID)$")
    deviations: list[DeviationSchema] = Field(default_factory=list)
    started_at: datetime
    completed_at: datetime


class SessionResponse(BaseModel):
    """Response body for session endpoints."""

    id: int
    exercise_id: str
    exercise_name: str
    reps: int
    form_status: str
    deviations: list[DeviationSchema]
    started_at: datetime
    completed_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}
