"""Alembic environment — online migrations only.

The DATABASE_URL is read from the environment (set in .env / Docker Compose).
All ORM models must be imported here before autogenerate can detect them.
"""

import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ── Import application Base so Alembic can see metadata ─────────────────────
# Import all ORM models here so Alembic autogenerate can detect them.
from app.db.session import Base  # noqa: F401 — metadata needed by autogenerate
from app.models.session import WorkoutSession  # noqa: F401

# ── Alembic Config object ────────────────────────────────────────────────────
config = context.config

# Override the sqlalchemy.url from the environment variable.
# This ensures credentials are never stored in alembic.ini.
database_url = os.environ.get("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_online() -> None:
    """Run migrations in 'online' mode against a live database connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
