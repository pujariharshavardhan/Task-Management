from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BASE_DIR / ".env", extra="ignore")

    app_name: str = "APMS API"
    # Neon: postgresql+psycopg://USER:PASSWORD@ep-xxx.region.aws.neon.tech/DBNAME?sslmode=require
    # Local fallback: SQLite file (handy for development and tests)
    database_url: str = f"sqlite:///{(BASE_DIR / 'apms.db').as_posix()}"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # --- Deployment / security ---
    # "production" turns on the startup checks below; FORCE_HTTPS redirects http -> https and sends HSTS.
    environment: str = "development"
    force_https: bool = False
    # Host names this server answers for (e.g. ["apms.example.com"]); "*" = any (development).
    allowed_hosts: list[str] = ["*"]
    # Built React app (npm run build) served by this API so one HTTPS deployment covers site + API.
    frontend_dist: str = str(BASE_DIR.parent / "frontend" / "dist")
    # Sign-in / sign-up attempts allowed per client per window
    auth_rate_limit: int = 10
    auth_rate_window_seconds: int = 15 * 60
    # Upload allowlist (lower-case extensions)
    allowed_upload_extensions: list[str] = [
        "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "md", "rtf", "odt", "ods", "odp",
        "png", "jpg", "jpeg", "gif", "webp", "svg", "fig", "zip", "rar", "7z", "json", "xml", "py", "ipynb", "sql",
    ]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    # File storage: "local" (saved under upload_dir) or "s3" (AWS S3 / MinIO)
    storage_backend: str = "local"
    upload_dir: str = str(BASE_DIR / "uploads")
    max_upload_mb: int = 25
    s3_bucket: str = ""
    s3_endpoint_url: str | None = None  # set for MinIO, e.g. http://localhost:9000
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_region: str = "us-east-1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
