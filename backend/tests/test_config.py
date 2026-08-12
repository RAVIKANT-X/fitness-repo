"""
Tests for Settings.parse_cors_origins validator in app/core/config.py.

Verifies that CORS_ORIGINS can be supplied as:
  1. A Python list (pydantic-settings default)
  2. A JSON-encoded string  e.g. '["https://a.com"]'
  3. A comma-separated string  e.g. "https://a.com,https://b.com"
  4. A single bare URL string   e.g. "https://a.com"

Also verifies that the production Vercel origin is present in the default list.
"""

import pytest
from app.core.config import Settings


def make_settings(**kwargs) -> Settings:
    """Construct a Settings instance with overrides, bypassing .env loading."""
    return Settings.model_validate(
        {"database_url": "postgresql://user:pass@localhost/db", **kwargs}
    )


class TestCorsOriginsValidator:
    def test_default_includes_local_dev_origins(self):
        """Default list must include both localhost Vite dev-server origins."""
        s = make_settings()
        assert "http://localhost:5173" in s.cors_origins
        assert "http://127.0.0.1:5173" in s.cors_origins

    def test_default_includes_production_vercel_origin(self):
        """Default list must include the deployed Vercel frontend origin."""
        s = make_settings()
        assert "https://posture-fitness.vercel.app" in s.cors_origins

    def test_list_passthrough(self):
        """A Python list is accepted unchanged."""
        origins = ["https://a.com", "https://b.com"]
        s = make_settings(cors_origins=origins)
        assert s.cors_origins == origins

    def test_json_array_string(self):
        """A JSON-encoded array string is deserialised correctly."""
        s = make_settings(cors_origins='["https://a.com", "https://b.com"]')
        assert s.cors_origins == ["https://a.com", "https://b.com"]

    def test_json_array_single_element(self):
        """A single-element JSON array is deserialised to a one-item list."""
        s = make_settings(cors_origins='["https://posture-fitness.vercel.app"]')
        assert s.cors_origins == ["https://posture-fitness.vercel.app"]

    def test_comma_separated_string(self):
        """A comma-separated string is split into a list."""
        s = make_settings(cors_origins="https://a.com,https://b.com")
        assert s.cors_origins == ["https://a.com", "https://b.com"]

    def test_comma_separated_with_spaces(self):
        """Whitespace around entries in a comma-separated string is stripped."""
        s = make_settings(cors_origins="https://a.com , https://b.com")
        assert s.cors_origins == ["https://a.com", "https://b.com"]

    def test_single_bare_url(self):
        """A single bare URL (no brackets, no comma) becomes a one-item list."""
        s = make_settings(cors_origins="https://posture-fitness.vercel.app")
        assert s.cors_origins == ["https://posture-fitness.vercel.app"]

    def test_shell_stripped_brackets(self):
        """
        PowerShell/shell environments may strip inner quotes from a JSON array,
        producing '[https://a.com]' instead of '["https://a.com"]'.
        The validator must still produce the correct list without the brackets.
        """
        s = make_settings(cors_origins="[https://posture-fitness.vercel.app]")
        assert s.cors_origins == ["https://posture-fitness.vercel.app"]

    def test_shell_stripped_brackets_multiple(self):
        """Multiple origins with shell-stripped brackets are parsed correctly."""
        s = make_settings(cors_origins="[https://a.com,https://b.com]")
        assert s.cors_origins == ["https://a.com", "https://b.com"]
