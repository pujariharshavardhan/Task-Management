import asyncio
import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import get_settings
from .database import SessionLocal, engine
from .hardening import HTTPSRedirectMiddleware, SecurityHeadersMiddleware
from .routers import auth, calendar, dashboard, discussions, documents, milestones, notifications, projects, reports, reviews, tasks, testimonials, users
from .services import generate_deadline_alerts

log = logging.getLogger("apms")
settings = get_settings()

if settings.is_production:
    # Refuse to boot with unsafe defaults in production
    if settings.jwt_secret == "change-me-in-production" or len(settings.jwt_secret) < 32:
        raise RuntimeError("Set a long random JWT_SECRET (32+ characters) before running in production.")
    if settings.database_url.startswith("sqlite"):
        raise RuntimeError("Set DATABASE_URL to PostgreSQL (Neon) before running in production.")


async def deadline_loop():
    """Hourly: create 'due tomorrow' and 'project deadline approaching' notifications."""
    while True:
        try:
            with SessionLocal() as db:
                n = await asyncio.to_thread(generate_deadline_alerts, db)
                if n:
                    log.info("deadline alerts created: %s", n)
        except Exception:  # never let the background job kill the app
            log.exception("deadline alert job failed")
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    job = asyncio.create_task(deadline_loop())
    yield
    job.cancel()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="REST API for the Academic Project Management System. Use **Authorize** and log in with your account.",
    lifespan=lifespan,
)
# Middleware runs bottom-up: the last added wraps all the others.
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"], expose_headers=["Content-Disposition"])
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.add_middleware(HTTPSRedirectMiddleware)

API = "/api/v1"
for r in (auth, users, projects, tasks, milestones, documents, reviews, calendar, discussions, notifications, dashboard, reports, testimonials):
    app.include_router(r.router, prefix=API)


@app.api_route("/health", methods=["GET", "HEAD"], tags=["Health"])
def health():
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok", "database": engine.dialect.name}


@app.api_route(API + "/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def api_not_found(path: str):
    """Unknown API paths return JSON, never the web app."""
    return JSONResponse({"detail": f"Not found: /api/v1/{path}"}, status_code=404)


# ---------- web app (built React SPA) ----------
DIST = Path(settings.frontend_dist)
# Routes the React app knows; anything else gets the app's 404 page with a real 404 status.
SPA_ROUTES = [re.compile(p) for p in (
    r"^/$", r"^/login$", r"^/register$", r"^/privacy$", r"^/terms$", r"^/testimonials$", r"^/dashboard$", r"^/projects$",
    r"^/projects/new$", r"^/projects/\d+$", r"^/tasks$", r"^/calendar$", r"^/team$", r"^/documents$", r"^/reviews$",
    r"^/reports$", r"^/notifications$", r"^/discussions$", r"^/settings$",
)]
LONG_CACHE = "public, max-age=31536000, immutable"  # Vite file names carry a content hash

if (DIST / "index.html").is_file():
    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def web_app(path: str, request: Request):
        file = (DIST / path).resolve()
        if path and file.is_file() and DIST.resolve() in file.parents:
            cache = LONG_CACHE if path.startswith("assets/") else "public, max-age=3600"
            return FileResponse(file, headers={"Cache-Control": cache})
        known = any(rx.match("/" + path.rstrip("/") if path else "/") for rx in SPA_ROUTES)
        return FileResponse(DIST / "index.html", status_code=200 if known else 404, headers={"Cache-Control": "no-cache"})
else:
    log.info("frontend build not found at %s — serving the API only", DIST)
