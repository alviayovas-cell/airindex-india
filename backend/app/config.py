"""Application configuration, loaded from environment variables / backend/.env."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---- App ----
    app_name: str = "AIRINDEX API"
    app_env: str = "development"
    api_prefix: str = "/api"
    # Local dev port (Render/production sets $PORT and uses its own start command).
    app_port: int = 8010

    # ---- MongoDB ----
    mongodb_uri: str = "mongodb://localhost:27017"
    database_name: str = "airfare_index"
    # Generous enough for Atlas SRV lookups on slower networks; the ping result
    # is cached so this cost is only paid occasionally.
    mongo_server_selection_timeout_ms: int = 8000
    mongo_connect_timeout_ms: int = 10000

    # ---- Auth ----
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    demo_user_email: str = "analyst@airindex.dev"
    demo_user_password: str = "airindex123"

    # ---- Amadeus ----
    amadeus_client_id: str = ""
    amadeus_client_secret: str = ""
    amadeus_base_url: str = "https://test.api.amadeus.com"

    # ---- Collection scheduler ----
    collection_interval_minutes: int = 60
    collection_enabled: bool = False

    # ---- CORS ----
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def amadeus_configured(self) -> bool:
        return bool(self.amadeus_client_id and self.amadeus_client_secret)

    @property
    def mongodb_uri_safe(self) -> str:
        """The URI with any credentials masked, safe for logs / error messages."""
        uri = self.mongodb_uri
        if "@" in uri and "://" in uri:
            scheme, rest = uri.split("://", 1)
            _, host = rest.split("@", 1)
            return f"{scheme}://***:***@{host}"
        return uri


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
