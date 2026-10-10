import os
import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

_tmp = Path(tempfile.mkdtemp(prefix="apms-test-"))
# Set TEST_DATABASE_URL to run the suite against PostgreSQL (the schema is dropped and recreated!)
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{(_tmp / 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(_tmp / "uploads")
os.environ["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256-signing"

from fastapi.testclient import TestClient  # noqa: E402

import seed  # noqa: E402
from app.main import app  # noqa: E402

seed.reset_schema()
seed.migrate()
seed.seed()


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def login(client, email, password="password"):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['accessToken']}"}


@pytest.fixture(scope="session")
def harsha(client):
    return login(client, "harsha@apms.edu")


@pytest.fixture(scope="session")
def rahul(client):
    return login(client, "rahul@apms.edu")


@pytest.fixture(scope="session")
def mentor(client):
    return login(client, "meena.rao@apms.edu")


@pytest.fixture(scope="session")
def ids(client, harsha):
    projects = {p["projectCode"]: p for p in client.get("/api/v1/projects", headers=harsha).json()}
    users = {u["email"]: u["id"] for u in client.get("/api/v1/users", headers=harsha).json()}
    return {"projects": projects, "users": users}
