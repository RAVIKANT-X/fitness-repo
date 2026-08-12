import json

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_cors(value: object) -> list[str]:
    """
    Parse CORS_ORIGINS from any of four env-var formats:
      1. Already a list   — returned as-is.
      2. Valid JSON array — '["https://a.com","https://b.com"]'
      3. Comma-separated  — "https://a.com,https://b.com"
      4. Shell-mangled    — "[https://a.com]"  (quotes stripped by shell)
      5. Single bare URL  — "https://a.com"

    Declared as a plain function (not a validator) so that pydantic-settings
    never tries to JSON-parse the raw env-var string before we see it.
    The field is typed `str` to prevent pydantic-settings' automatic list
    coercion, and the property `cors_origins_list` exposes the parsed result.
    """
    if isinstance(value, list):
        return [str(v) for v in value]
    if not isinstance(value, str):
        return []
    s = value.strip()
    if s.startswith("["):
        try:
            parsed = json.loads(s)
            if isinstance(parsed, list):
                return [str(v) for v in parsed]
        except json.JSONDecodeError:
            # Shell stripped inner quotes: "[https://a.com]" → strip brackets
            s = s[1:-1] if s.endswith("]") else s[1:]
    return [o.strip() for o in s.split(",") if o.strip()]


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
    # Raw env-var value.  Typed as `str` so pydantic-settings never
    # attempts automatic JSON-list coercion before we can handle it.
    # The env-var name is CORS_ORIGINS (via the Field alias).
    #
    # Accepted formats in production (Railway env var CORS_ORIGINS):
    #   https://posture-fitness.vercel.app
    #   ["https://posture-fitness.vercel.app"]
    #   https://a.com,https://b.com
    #
    # When CORS_ORIGINS is not set the comma-separated default is used.
    cors_origins_raw: str = Field(
        default=(
            "http://localhost:5173,"
            "http://127.0.0.1:5173,"
            "https://posture-fitness.vercel.app"
        ),
        alias="cors_origins",
    )

    @property
    def cors_origins(self) -> list[str]:  # type: ignore[override]
        """Return the parsed list of allowed origins."""
        return _parse_cors(self.cors_origins_raw)


settings = Settings()
