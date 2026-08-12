"""
Tests for Settings CORS configuration in app/core/config.py.

The field is cors_origins_raw (str, aliased to env-var CORS_ORIGINS).
The property cors_origins parses it via _parse_cors().

Verifies that CORS_ORIGINS can be supplied as:
  1. A comma-separated string  (default format, always safe in any shell)
  2. A valid JSON array string '["https://a.com"]'
  3. A shell-mangled bracket string '[https://a.com]'
  4. A single bare URL
  5. Multiple comma-separated URLs

Also verifies that the production Vercel origin is present in the default list.
"""

import pytest
from app.core.config import Settings, _parse_cors


def make_settings(cors_origins: str | None = None) -> Settings:
    """Construct a Settings instance, optionally overriding CORS_ORIGINS."""
    overrides: dict = {
        "database_url": "postgresql://user:pass@localhost/db",
    }
    if cors_origins is not None:
        # Use the alias name so pydantic-settings maps it to cors_origins_raw
        overrides["cors_origins"] = cors_origins
    return Settings.model_validate(overrides)


# ── _parse_cors unit tests ────────────────────────────────────────────────────

class TestParseCors:
    def test_list_passthrough(self):
        assert _parse_cors(["https://a.com"]) == ["https://a.com"]

    def test_valid_json_array(self):
        assert _parse_cors('["https://a.com","https://b.com"]') == [
            "https://a.com",
            "https://b.com",
        ]

    def test_valid_json_single(self):
        assert _parse_cors('["https://posture-fitness.vercel.app"]') == [
            "https://posture-fitness.vercel.app"
        ]

    def test_comma_separated(self):
        assert _parse_cors("https://a.com,https://b.com") == [
            "https://a.com",
            "https://b.com",
        ]

    def test_comma_separated_with_spaces(self):
        assert _parse_cors("https://a.com , https://b.com") == [
            "https://a.com",
            "https://b.com",
        ]

    def test_single_bare_url(self):
        assert _parse_cors("https://posture-fitness.vercel.app") == [
            "https://posture-fitness.vercel.app"
        ]

    def test_shell_stripped_brackets_single(self):
        """Shell strips inner quotes: '[https://a.com]' must still parse correctly."""
        assert _parse_cors("[https://posture-fitness.vercel.app]") == [
            "https://posture-fitness.vercel.app"
        ]

    def test_shell_stripped_brackets_multiple(self):
        assert _parse_cors("[https://a.com,https://b.com]") == [
            "https://a.com",
            "https://b.com",
        ]

    def test_non_string_returns_empty(self):
        assert _parse_cors(None) == []
        assert _parse_cors(42) == []


# ── Settings integration tests ────────────────────────────────────────────────

class TestSettingsCorsOrigins:
    def test_default_includes_local_dev_origins(self):
        """Default list must include both localhost Vite dev-server origins."""
        s = make_settings()
        assert "http://localhost:5173" in s.cors_origins
        assert "http://127.0.0.1:5173" in s.cors_origins

    def test_default_includes_production_vercel_origin(self):
        """Default list must include the deployed Vercel frontend origin."""
        s = make_settings()
        assert "https://posture-fitness.vercel.app" in s.cors_origins

    def test_override_single_url(self):
        """A single plain URL overrides the default correctly."""
        s = make_settings("https://posture-fitness.vercel.app")
        assert s.cors_origins == ["https://posture-fitness.vercel.app"]

    def test_override_comma_separated(self):
        s = make_settings("https://a.com,https://b.com")
        assert s.cors_origins == ["https://a.com", "https://b.com"]

    def test_override_shell_stripped_brackets(self):
        """The value Railway stores when shell strips quotes from a JSON array."""
        s = make_settings("[https://posture-fitness.vercel.app]")
        assert s.cors_origins == ["https://posture-fitness.vercel.app"]

    def test_override_valid_json_array(self):
        s = make_settings('["https://posture-fitness.vercel.app"]')
        assert s.cors_origins == ["https://posture-fitness.vercel.app"]
