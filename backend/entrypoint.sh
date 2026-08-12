#!/bin/sh
# entrypoint.sh — run Alembic migrations then start FastAPI.
#
# Used by the production Dockerfile CMD.
# Also suitable for Railway container deployments.
#
# Requirements:
#   - DATABASE_URL must be set in the environment.
#   - Alembic must be installed (it is in requirements.txt).
#   - This script exits non-zero if the migration fails,
#     preventing the application from starting against a stale schema.
#
# PostgreSQL availability:
#   Railway starts the database as a separate service. The database is
#   already available over the network before this container starts
#   (Railway handles service ordering). A brief retry loop guards against
#   the small window where the TCP port is open but PostgreSQL is not yet
#   accepting connections.

set -e

echo "Running Alembic migrations..."

# Retry up to 10 times with a 2-second pause between attempts.
# This tolerates the short window where PostgreSQL is starting up
# (e.g. local Docker Compose first run) without needing a separate
# wait-for-it script.
RETRIES=10
until alembic upgrade head; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -eq 0 ]; then
    echo "ERROR: Alembic migration failed after all retries. Aborting startup."
    exit 1
  fi
  echo "Migration attempt failed. Retrying in 2 seconds... ($RETRIES attempts left)"
  sleep 2
done

echo "Migrations complete. Starting FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
