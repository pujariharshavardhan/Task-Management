"""Alembic environment for APMS.

The database URL comes from the application settings (DATABASE_URL env var or
backend/.env), never from alembic.ini, so the same migrations run against the
local SQLite file and Neon PostgreSQL.
"""

from logging.config import fileConfig

from alembic import context

from app import models  # noqa: F401  (registers all tables on Base.metadata)
from app.database import DATABASE_URL, IS_SQLITE, Base, engine

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _configure_kwargs() -> dict:
    return {
        "target_metadata": target_metadata,
        "compare_type": True,
        "compare_server_default": True,
        # SQLite cannot ALTER most things in place; batch mode recreates tables.
        "render_as_batch": IS_SQLITE,
    }


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **_configure_kwargs(),
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    with engine.connect() as connection:
        context.configure(connection=connection, **_configure_kwargs())
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
