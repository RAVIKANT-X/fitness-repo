"""
Tests for POST /api/v1/sessions, GET /api/v1/sessions/{id}, GET /api/v1/sessions.

Verifies:
  - session creation stores record in database
  - session retrieval returns the correct record
  - session listing returns newest first
  - validation failures return 422
  - 404 on missing session
"""

import pytest
from fastapi.testclient import TestClient

# ── Helpers ───────────────────────────────────────────────────────────────────

VALID_PAYLOAD = {
    "exercise_id": "squat",
    "exercise_name": "Squat",
    "reps": 5,
    "form_status": "GOOD",
    "deviations": [],
    "started_at": "2025-01-01T10:00:00Z",
    "completed_at": "2025-01-01T10:05:00Z",
}

SHALLOW_SQUAT_PAYLOAD = {
    "exercise_id": "squat",
    "exercise_name": "Squat",
    "reps": 3,
    "form_status": "WARNING",
    "deviations": [
        {
            "id": "DEPTH_TOO_SHALLOW",
            "severity": "WARNING",
            "angleName": "avgKneeAngle",
            "observed": 128.0,
            "threshold": 115.0,
        }
    ],
    "started_at": "2025-01-01T11:00:00Z",
    "completed_at": "2025-01-01T11:03:00Z",
}


# ── POST /api/v1/sessions ─────────────────────────────────────────────────────

class TestCreateSession:
    def test_creates_session_and_returns_201(self, client: TestClient):
        """Happy path: POST creates a record and returns 201 with the saved data."""
        resp = client.post("/api/v1/sessions", json=VALID_PAYLOAD)
        assert resp.status_code == 201

        data = resp.json()
        assert data["exercise_id"] == "squat"
        assert data["reps"] == 5
        assert data["form_status"] == "GOOD"
        assert data["deviations"] == []
        assert "id" in data
        assert "created_at" in data

    def test_persists_deviations_as_json(self, client: TestClient):
        """Deviations list is persisted and returned correctly."""
        resp = client.post("/api/v1/sessions", json=SHALLOW_SQUAT_PAYLOAD)
        assert resp.status_code == 201

        data = resp.json()
        assert data["reps"] == 3
        assert data["form_status"] == "WARNING"
        assert len(data["deviations"]) == 1
        dev = data["deviations"][0]
        assert dev["id"] == "DEPTH_TOO_SHALLOW"
        assert dev["severity"] == "WARNING"
        assert dev["observed"] == 128.0
        assert dev["threshold"] == 115.0

    def test_returns_422_for_negative_reps(self, client: TestClient):
        """Validation failure: reps must be >= 0."""
        payload = {**VALID_PAYLOAD, "reps": -1}
        resp = client.post("/api/v1/sessions", json=payload)
        assert resp.status_code == 422

    def test_returns_422_for_invalid_form_status(self, client: TestClient):
        """Validation failure: form_status must be GOOD, WARNING, or INVALID."""
        payload = {**VALID_PAYLOAD, "form_status": "UNKNOWN"}
        resp = client.post("/api/v1/sessions", json=payload)
        assert resp.status_code == 422

    def test_returns_422_for_missing_exercise_id(self, client: TestClient):
        """Validation failure: exercise_id is required."""
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "exercise_id"}
        resp = client.post("/api/v1/sessions", json=payload)
        assert resp.status_code == 422


# ── GET /api/v1/sessions/{id} ─────────────────────────────────────────────────

class TestGetSession:
    def test_retrieves_created_session(self, client: TestClient):
        """Create then retrieve — verifies persistence round-trip."""
        create_resp = client.post("/api/v1/sessions", json=VALID_PAYLOAD)
        assert create_resp.status_code == 201
        session_id = create_resp.json()["id"]

        get_resp = client.get(f"/api/v1/sessions/{session_id}")
        assert get_resp.status_code == 200

        data = get_resp.json()
        assert data["id"] == session_id
        assert data["exercise_id"] == "squat"
        assert data["reps"] == 5

    def test_retrieves_deviations_correctly(self, client: TestClient):
        """Deviation data survives the round-trip through JSONB storage."""
        create_resp = client.post("/api/v1/sessions", json=SHALLOW_SQUAT_PAYLOAD)
        session_id = create_resp.json()["id"]

        get_resp = client.get(f"/api/v1/sessions/{session_id}")
        data = get_resp.json()

        assert len(data["deviations"]) == 1
        assert data["deviations"][0]["id"] == "DEPTH_TOO_SHALLOW"

    def test_returns_404_for_missing_session(self, client: TestClient):
        """Non-existent session id returns 404."""
        resp = client.get("/api/v1/sessions/99999")
        assert resp.status_code == 404


# ── GET /api/v1/sessions ──────────────────────────────────────────────────────

class TestListSessions:
    def test_returns_empty_list_initially(self, client: TestClient):
        """No sessions → empty list."""
        resp = client.get("/api/v1/sessions")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_created_sessions(self, client: TestClient):
        """Sessions created before listing are returned."""
        client.post("/api/v1/sessions", json=VALID_PAYLOAD)
        client.post("/api/v1/sessions", json=SHALLOW_SQUAT_PAYLOAD)

        resp = client.get("/api/v1/sessions")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_newest_first_ordering(self, client: TestClient):
        """Sessions are returned newest first (by created_at)."""
        r1 = client.post("/api/v1/sessions", json=VALID_PAYLOAD).json()
        r2 = client.post("/api/v1/sessions", json=SHALLOW_SQUAT_PAYLOAD).json()

        resp = client.get("/api/v1/sessions")
        data = resp.json()
        # Most recently created should be first
        assert data[0]["id"] == r2["id"]
        assert data[1]["id"] == r1["id"]
