import json
from typing import Any

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All secrets must be provided via .env or the container environment —
    never hard-coded here.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Database ──────────────────────────────────────────────────────────
    # No default DATABASE_URL for production — must be supplied via env.
    # The local Docker Compose default is provided in .env / .env.example.
    database_url: str = "postgresql://postgres:change_me_before_use@postgres:5432/fitness_db"

    # ── CORS ──────────────────────────────────────────────────────────────
    # Allowed origins for the CORS middleware.
    #
    # In production set CORS_ORIGINS as a JSON array string:
    #   CORS_ORIGINS='["https://posture-fitness.vercel.app"]'
    #
    # In local Docker development the defaults below are used automatically
    # when CORS_ORIGINS is not set.
    #
    # pydantic-settings can parse a JSON-encoded list natively.
    # The validator below also accepts a plain comma-separated string for
    # convenience (e.g. CORS_ORIGINS="https://a.com,https://b.com").
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://posture-fitness.vercel.app",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> Any:
        """
        Accept four forms for CORS_ORIGINS:
          1. A Python list  (pydantic-settings default or already-parsed)
          2. A valid JSON array string: '["https://a.com","https://b.com"]'
          3. A comma-separated string:  "https://a.com,https://b.com"
          4. A single bare URL:         "https://a.com"

        Falls back gracefully if the JSON parse fails (e.g. shell-stripped
        quotes produce "[https://a.com]" instead of '["https://a.com"]').
        """
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            stripped = v.strip()
            if stripped.startswith("["):
                try:
                    return json.loads(stripped)
                except json.JSONDecodeError:
                    # Strip enclosing brackets and treat as comma-separated
                    stripped = stripped[1:-1] if stripped.endswith("]") else stripped[1:]
            return [origin.strip() for origin in stripped.split(",") if origin.strip()]
        return v


settings = Settings()
