"""
pytest configuration for the backend test suite.

Sets up an in-memory SQLite database for tests so they run without Docker/Postgres.
Creates all tables before each test and tears them down after.

Key design decisions:
  1. StaticPool ensures all SQLAlchemy connections share the same in-memory
     SQLite database (otherwise each new connection gets a fresh empty DB).
  2. JSONB columns are patched to JSON before create_all() so SQLite's DDL
     compiler can handle them. The production model is unchanged.
"""

import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, JSON
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.postgresql import JSONB

from app.db.session import Base
from app.models.session import WorkoutSession  # noqa: F401 — register model
from app.main import app
from app.api.v1.sessions import get_db

# ── In-memory SQLite engine with shared connection pool ───────────────────────
#
# StaticPool reuses the same underlying connection for every checkout,
# so Base.metadata.create_all() and subsequent queries all see the same DB.

SQLALCHEMY_TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    json_serializer=json.dumps,
    json_deserializer=json.loads,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── JSONB → JSON patch for SQLite ─────────────────────────────────────────────

def _patch_jsonb_for_sqlite() -> None:
    """
    SQLite does not support the PostgreSQL JSONB dialect type.
    Patch any JSONB columns in the metadata to use plain JSON so that
    SQLite can compile the CREATE TABLE statement.

    This only affects the in-memory schema used during testing.
    The production ORM model definition is not modified.
    """
    for table in Base.metadata.tables.values():
        for col in table.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test, drop them after."""
    _patch_jsonb_for_sqlite()
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    """Yield a fresh DB session bound to the test engine."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    """
    FastAPI TestClient with get_db overridden to use the in-memory test session.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
