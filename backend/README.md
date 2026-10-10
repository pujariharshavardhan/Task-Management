# APMS Backend (FastAPI)

REST API for the Academic Project Management System — FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL (Neon) · JWT.

## Run locally

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

- API docs (Swagger): http://localhost:8001/docs — click **Authorize** and sign in with your account
- The React app (`frontend/`) talks to `http://localhost:8001/api/v1` by default; override with `VITE_API_URL`.

### Accounts

There is no demo data. Create or reset an account straight in the database:

```bash
python create_user.py --name Harsha --email harsha@gmail.com --password "harsha@123"
python create_user.py ... --reset     # wipes ALL data first (fresh, empty database)
```

Anyone can also sign up from the app's **Sign Up** page; team members you invite get a one-time password.
(`seed.py` still exists, but only the automated tests use it.)

## Use Neon (PostgreSQL)

1. Create a project at https://console.neon.tech and copy the **pooled** connection string.
2. `copy .env.example .env` and set
   `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require`
   plus a long random `JWT_SECRET`.
3. `alembic upgrade head` then `python create_user.py ...` to add your first account.

## Tests

```bash
pytest tests -q                                                      # SQLite
set TEST_DATABASE_URL=postgresql://postgres@localhost:5432/apms_test  # PostgreSQL (schema is reset!)
pytest tests -q
```

## API overview (`/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/token` (form), `GET /auth/me` |
| Users & team | `GET /users`, `PATCH /users/me`, `POST /users/me/password`, `POST /users/invite`, `GET /team`, `GET /meta/options` |
| Projects | `GET/POST /projects`, `GET/PATCH/DELETE /projects/{id}`, `GET/POST /projects/{id}/members`, `PATCH/DELETE /projects/{id}/members/{userId}` |
| Tasks | `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/{id}`, `POST /tasks/{id}/move` (Kanban), checklist `POST/PATCH/DELETE /tasks/{id}/checklist[/{itemId}]`, comments `GET/POST /tasks/{id}/comments`, `PATCH/DELETE /comments/{id}` |
| Milestones | `GET/POST /projects/{id}/milestones`, `PATCH/DELETE /milestones/{id}` |
| Calendar | `GET /calendar?start&end&project_id&types`, `GET/POST /events`, `PATCH/DELETE /events/{id}` |
| Documents | `GET/POST /documents` (multipart, auto-versioning), `GET /documents/folders`, `GET /documents/{id}/download`, `DELETE /documents/{id}` |
| Reviews | `GET/POST /reviews`, `GET /reviews/summary`, `GET/PATCH/DELETE /reviews/{id}` |
| Discussions | `GET/POST /discussions`, `GET/DELETE /discussions/{id}`, `POST /discussions/{id}/messages` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{id}/read`, `POST /notifications/read-all`, `DELETE /notifications/{id}`, WebSocket `/ws/notifications?token=` |
| Dashboard etc. | `GET /dashboard`, `GET /activity`, `GET /search?q=` |
| Reports | `GET /reports`, `GET /reports/{type}`, `GET /reports/{type}/export?format=csv\|xlsx\|pdf`, `GET /insights/risks` |

JSON bodies/responses are **camelCase**; query parameters are snake_case.

## Permissions (per project)

| Role | Can |
|---|---|
| Project Owner | everything, incl. delete/archive project and change member roles |
| Project Manager, Team Lead | manage tasks, members, milestones, events |
| Developer, Designer, Researcher, Tester, Student | update tasks assigned to them, upload files, comment, discuss |
| Mentor (or project guide) | view, comment, discuss, schedule events, create academic reviews |
| Viewer | read-only |

## Background jobs & storage

- Deadline alerts ("task due tomorrow", "project deadline approaching") run hourly in-process; trigger manually with `POST /notifications/run-deadline-check`.
- Files are stored on local disk (`uploads/`) by default; set `STORAGE_BACKEND=s3` + `S3_*` for AWS S3 or MinIO.
