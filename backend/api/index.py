# Vercel Python serverless entry point.
#
# Vercel's Python runtime discovers this file because it lives at api/index.py
# relative to the project root (which is set to "backend/" in vercel.json).
#
# The ONLY job of this file is to import the existing FastAPI application
# object and make it available as `app`. All business logic, routes, models,
# services, and middleware stay exactly where they are in app/.
#
# Do NOT duplicate any application logic here.

from app.main import app  # noqa: F401  — re-exported as the ASGI handler

# Vercel looks for a top-level `app` or `handler` name in this module.
# Importing `app` above is sufficient — no wrapper or extra configuration needed.
