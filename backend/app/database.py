"""Database engine, session factory and declarative Base.

Production runs on Neon (serverless PostgreSQL) through psycopg 3; local
development and tests default to a SQLite file (see ``app.config``).
"""

from collections.abc import Generator

from sqlalchemy import MetaData, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def normalize_database_url(url: str) -> str:
    """Force the psycopg 3 driver for PostgreSQL URLs (Neon hands out ``postgres://``)."""
    url = url.strip()
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = normalize_database_url(get_settings().database_url)
IS_SQLITE = DATABASE_URL.startswith("sqlite")


def _build_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    # Neon suspends idle compute after ~5 min. Recycling pooled connections after
    # 4 min avoids stale sockets without pool_pre_ping, which would cost an extra
    # network round trip on every request.
    return create_engine(url, pool_recycle=240, pool_size=10, max_overflow=10)


engine = _build_engine(DATABASE_URL)

if IS_SQLITE:

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _connection_record):  # pragma: no cover - trivial
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
