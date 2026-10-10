"""HTTP hardening: HTTPS enforcement, security headers and sign-in rate limiting."""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse

from .config import get_settings

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}

# Content Security Policy for the web app (HTML). Motion/inline style attributes need 'unsafe-inline'
# for styles only; scripts are restricted to our own files.
APP_CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


class HTTPSRedirectMiddleware(BaseHTTPMiddleware):
    """With FORCE_HTTPS on, any plain-http request is redirected (308) to https.

    Behind a proxy/load balancer run uvicorn with --proxy-headers so X-Forwarded-Proto is honoured.
    Local requests (localhost) are left alone so development keeps working.
    """

    async def dispatch(self, request: Request, call_next):
        s = get_settings()
        host = (request.url.hostname or "").lower()
        if s.force_https and request.url.scheme == "http" and host not in LOCAL_HOSTS:
            return RedirectResponse(str(request.url.replace(scheme="https")), status_code=308)
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        s = get_settings()
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        h.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()")
        h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if s.force_https or request.url.scheme == "https":
            h.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        # Swagger UI (/docs, /redoc) loads its own CDN assets, so the strict policy applies to the app only
        path = request.url.path
        if response.headers.get("content-type", "").startswith("text/html") and not path.startswith(("/docs", "/redoc")):
            csp = APP_CSP + ("; upgrade-insecure-requests" if s.force_https else "")
            h.setdefault("Content-Security-Policy", csp)
        return response


class RateLimiter:
    """In-memory sliding window (per process). Use a shared store such as Redis when running several instances."""

    def __init__(self):
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = Lock()

    def check(self, key: str, limit: int, window: int) -> None:
        now = time.monotonic()
        with self.lock:
            q = self.hits[key]
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                retry = int(window - (now - q[0])) + 1
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    f"Too many attempts. Try again in {max(1, retry // 60)} minute(s).",
                    headers={"Retry-After": str(retry)},
                )
            q.append(now)

    def reset(self, key: str) -> None:
        with self.lock:
            self.hits.pop(key, None)


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def auth_throttle(request: Request, email: str) -> str:
    """Limit sign-in/sign-up attempts per IP + email. Returns the key so a success can clear it."""
    s = get_settings()
    key = f"{client_ip(request)}|{email.lower()}"
    limiter.check(key, s.auth_rate_limit, s.auth_rate_window_seconds)
    # a looser per-IP cap stops one client cycling through many emails
    limiter.check(f"ip|{client_ip(request)}", s.auth_rate_limit * 5, s.auth_rate_window_seconds)
    return key
