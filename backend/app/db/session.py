from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# ── Engine ────────────────────────────────────────────────────────────────────
engine = create_engine(
    settings.database_url,
    # pool_pre_ping keeps connections healthy across container restarts
    pool_pre_ping=True,
)

# ── Session factory ────────────────────────────────────────────────────────────
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)


# ── Declarative base ───────────────────────────────────────────────────────────
# All ORM models will inherit from this Base.
# Alembic's env.py imports Base.metadata to auto-generate migrations.
class Base(DeclarativeBase):
    pass
