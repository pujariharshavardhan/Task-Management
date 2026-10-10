"""Seed the APMS database with the demo data from frontend/src/data/mock.js.

Usage (from the backend/ directory):
    python seed.py           # migrate to head, then seed if the users table is empty
    python seed.py --reset   # drop every table, re-run migrations, then seed

All demo users log in with the password "password".
Mock timestamps are treated as India Standard Time (the demo college is in
Hyderabad) and stored as UTC.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import func, inspect, select, text

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    ActivityLog,
    Comment,
    DiscussionMessage,
    DiscussionThread,
    Document,
    Event,
    Milestone,
    Notification,
    Project,
    ProjectMember,
    Review,
    Task,
    TaskChecklist,
    TaskTag,
    User,
)
from app.security import hash_password  # noqa: E402

IST = timezone(timedelta(hours=5, minutes=30))
DEMO_PASSWORD = "password"

# --------------------------------------------------------------------------- mock data (mirrors mock.js)

USERS = [
    ("u1", "Harsha", "harsha@apms.edu", "Project Owner", "Project Manager", "primary"),
    ("u2", "Rahul", "rahul@apms.edu", "Developer", "Backend Developer", "mint"),
    ("u3", "Priya", "priya@apms.edu", "Developer", "Frontend Developer", "pink"),
    ("u4", "Sai", "sai@apms.edu", "Developer", "ML Developer", "sky"),
    ("u5", "Ananya", "ananya@apms.edu", "Designer", "UI/UX Designer", "peach"),
    ("u6", "Kiran", "kiran@apms.edu", "Tester", "QA Tester", "sun"),
    ("u7", "Dr. Meena Rao", "meena.rao@apms.edu", "Mentor", "Project Guide", "primary"),
    ("u8", "Vikram", "vikram@apms.edu", "Researcher", "Research Analyst", "mint"),
]

ACADEMIC = {
    "college": "JNTU Hyderabad",
    "department": "Computer Science & Engineering",
    "academic_year": "2026-27",
    "semester": "VII",
    "batch": "2023-2027",
    "course": "B.Tech",
}

PROJECTS = [
    dict(id="p1", name="AI-Based Academic Management System", code="APMS-2026-001", type="Final Year Project",
         description="An intelligent platform that helps colleges manage academic projects, student teams, deadlines and mentor reviews, with AI-generated progress summaries.",
         start="2026-09-01", end="2026-10-20", done=None, priority="High", status="In Progress", progress=72, archived=False,
         tech=["Python", "FastAPI", "React", "PostgreSQL"],
         members=[("u1", "Project Manager"), ("u2", "Developer"), ("u3", "Developer"), ("u4", "Developer"), ("u6", "Tester"), ("u7", "Mentor")]),
    dict(id="p2", name="College LMS", code="CLMS-2026-002", type="Major Project",
         description="Learning management system with courses, assignments, quizzes and grade books for faculty and students.",
         start="2026-08-15", end="2026-10-20", done=None, priority="Medium", status="In Progress", progress=64, archived=False,
         tech=["React", "Tailwind CSS", "FastAPI", "PostgreSQL", "Docker"],
         members=[("u1", "Project Owner"), ("u3", "Developer"), ("u5", "Designer"), ("u2", "Developer")]),
    dict(id="p3", name="AI Chatbot", code="AICB-2026-003", type="Mini Project",
         description="Campus help-desk chatbot answering admission, fee and timetable questions using retrieval-augmented generation.",
         start="2026-09-10", end="2026-11-05", done=None, priority="Critical", status="In Progress", progress=45, archived=False,
         tech=["Python", "AI", "Machine Learning", "React"],
         members=[("u1", "Project Owner"), ("u4", "Team Lead"), ("u8", "Researcher"), ("u3", "Developer")]),
    dict(id="p4", name="Attendance System", code="ATTS-2026-004", type="Mini Project",
         description="Face-recognition based classroom attendance with daily reports for faculty.",
         start="2026-08-01", end="2026-09-30", done="2026-09-28", priority="Medium", status="Completed", progress=100, archived=False,
         tech=["Python", "Machine Learning", "MySQL"],
         members=[("u1", "Project Owner"), ("u4", "Developer"), ("u6", "Tester")]),
    dict(id="p5", name="Voice Agent", code="VOAG-2026-005", type="Research Project",
         description="Real-time voice assistant for lab bookings using speech-to-text, LLM reasoning and text-to-speech over WebRTC.",
         start="2026-09-20", end="2026-12-15", done=None, priority="High", status="In Progress", progress=30, archived=False,
         tech=["Python", "AI", "FastAPI", "JavaScript"],
         members=[("u1", "Project Owner"), ("u4", "Team Lead"), ("u2", "Developer"), ("u8", "Researcher")]),
    dict(id="p6", name="E-Library Portal", code="ELIB-2026-006", type="Academic Project",
         description="Digital library catalog with e-book lending, reservations and reading analytics.",
         start="2026-10-01", end="2026-12-30", done=None, priority="Low", status="Planning", progress=10, archived=False,
         tech=["React", "MongoDB", "JavaScript"],
         members=[("u1", "Project Owner"), ("u5", "Designer")]),
    dict(id="p7", name="Smart Parking IoT", code="SPIO-2026-007", type="Hackathon Project",
         description="IoT sensors and a mobile dashboard to show free campus parking slots in real time.",
         start="2026-08-01", end="2026-08-30", done="2026-08-29", priority="High", status="Completed", progress=100, archived=False,
         tech=["Python", "AWS", "React"],
         members=[("u1", "Project Owner"), ("u2", "Developer"), ("u5", "Designer")]),
    dict(id="p8", name="Hostel Management", code="HSTM-2025-008", type="Academic Project",
         description="Room allocation, mess billing and complaint tracking for campus hostels.",
         start="2025-07-01", end="2025-11-30", done="2025-11-25", priority="Low", status="Completed", progress=100, archived=True,
         tech=["HTML", "CSS", "Bootstrap", "MySQL"], academic_year="2025-26",
         members=[("u1", "Project Owner"), ("u3", "Developer")]),
]
for _p in PROJECTS:
    _p.setdefault("guide", "u7")
    _p.setdefault("owner", "u1")


def _t(key, project, title, assignee, status, priority, start, due, **extra):
    data = dict(key=key, project=project, title=title, assignee=assignee, status=status, priority=priority,
                start=start, due=due, description="", type="Development", est=8, act=0, tags=[], checklist=[],
                comments=[], created_by="u1")
    data.update(extra)
    return data


TASKS = [
    _t("TASK-101", "p1", "Login UI", "u3", "Done", "Medium", "2026-09-06", "2026-09-12", type="Design", est=10, act=9, tags=["frontend", "auth"], description="Clay-styled login and register screens with validation."),
    _t("TASK-102", "p1", "Database Schema", "u2", "Done", "High", "2026-09-06", "2026-09-14", est=12, act=14, tags=["backend", "db"], description="Design PostgreSQL tables for users, projects, tasks and reviews."),
    _t("TASK-103", "p1", "Research", "u8", "Done", "Low", "2026-09-01", "2026-09-05", type="Research", est=6, act=6, tags=["analysis"]),
    _t("TASK-104", "p1", "API", "u2", "In Progress", "High", "2026-09-15", "2026-10-06", est=24, act=15, tags=["backend", "fastapi"],
       description="Build REST endpoints for projects, tasks and milestones with JWT auth.",
       checklist=[("Create API", True), ("Add validation", True), ("Test API", False), ("Update documentation", False)],
       comments=[("u1", "Please add pagination on the task list endpoint.", "2026-10-01T10:20:00"),
                 ("u2", "Done — using limit/offset. Validation is next.", "2026-10-02T09:05:00")]),
    _t("TASK-105", "p1", "Chat UI", "u3", "Review", "Medium", "2026-09-20", "2026-10-04", tags=["frontend"], est=10, act=11),
    _t("TASK-106", "p1", "Dashboard", "u3", "In Progress", "High", "2026-09-25", "2026-10-08", tags=["frontend", "charts"], est=16, act=7),
    _t("TASK-107", "p1", "Testing", "u6", "Todo", "High", "2026-10-05", "2026-10-12", type="Testing", tags=["qa"], est=14),
    _t("TASK-108", "p1", "Final Report", "u1", "Todo", "Medium", "2026-10-10", "2026-10-18", type="Documentation", tags=["docs"]),
    _t("TASK-109", "p5", "Voice STT", "u4", "Todo", "High", "2026-10-01", "2026-10-09", tags=["ml", "voice"]),
    _t("TASK-110", "p5", "Implement STT", "u4", "In Progress", "High", "2026-09-22", "2026-10-05", tags=["voice"]),
    _t("TASK-111", "p5", "Implement TTS", "u2", "Todo", "Medium", "2026-10-06", "2026-10-20", tags=["voice"]),
    _t("TASK-112", "p5", "WebRTC Integration", "u2", "Todo", "Critical", "2026-10-10", "2026-10-30", tags=["realtime"]),
    _t("TASK-113", "p3", "Intent Classifier", "u4", "In Progress", "Critical", "2026-09-15", "2026-10-01", type="Research", tags=["ml"], est=20, act=18),
    _t("TASK-114", "p3", "Knowledge Base Ingestion", "u8", "Review", "High", "2026-09-18", "2026-10-03", type="Research", tags=["rag"]),
    _t("TASK-115", "p3", "Chat Widget", "u3", "Todo", "Medium", "2026-10-04", "2026-10-15", tags=["frontend"]),
    _t("TASK-116", "p2", "Course Module", "u2", "Done", "High", "2026-08-20", "2026-09-10", est=18, act=20),
    _t("TASK-117", "p2", "Quiz Engine", "u2", "In Progress", "High", "2026-09-12", "2026-10-07", est=20, act=12),
    _t("TASK-118", "p2", "Gradebook UI", "u5", "Review", "Medium", "2026-09-15", "2026-10-05", type="Design"),
    _t("TASK-119", "p2", "Assignment Upload", "u3", "Todo", "Medium", "2026-10-01", "2026-10-14"),
    _t("TASK-120", "p6", "Book Catalog Schema", "u1", "Todo", "Low", "2026-10-02", "2026-10-16", type="Design"),
    _t("TASK-121", "p6", "Wireframes", "u5", "In Progress", "Medium", "2026-10-01", "2026-10-10", type="Design"),
    _t("TASK-122", "p4", "Face Dataset", "u4", "Done", "High", "2026-08-02", "2026-08-20", type="Research", est=16, act=15),
    _t("TASK-123", "p4", "Attendance Reports", "u6", "Done", "Medium", "2026-09-01", "2026-09-25", est=10, act=12),
]

MILESTONES = [
    ("p1", "Requirement Analysis", "Gather requirements and write the SRS.", "2026-09-01", "2026-09-05", 100),
    ("p1", "UI/UX Design", "Wireframes, design system and clickable prototype.", "2026-09-06", "2026-09-12", 100),
    ("p1", "Backend Development", "FastAPI services, auth and database.", "2026-09-13", "2026-09-25", 60),
    ("p1", "Testing", "Unit, integration and user-acceptance testing.", "2026-09-26", "2026-10-05", 0),
    ("p1", "Final Submission", "Report, presentation and demo.", "2026-10-06", "2026-10-10", 0),
    ("p3", "Model Prototype", "Baseline intent model with 80% accuracy.", "2026-09-10", "2026-10-01", 70),
    ("p3", "Campus Pilot", "Pilot with 50 students.", "2026-10-10", "2026-10-28", 0),
    ("p2", "Core LMS Release", "Courses, assignments and quizzes live.", "2026-08-15", "2026-10-07", 75),
    ("p5", "Voice Pipeline", "STT → LLM → TTS round trip under 1.5s.", "2026-09-20", "2026-10-25", 25),
]

DOCUMENTS = [
    ("p1", "Requirements", "SRS.pdf", "PDF", "1.2 MB", "u1", "2026-09-05", 2),
    ("p1", "Requirements", "Requirements.docx", "DOCX", "320 KB", "u8", "2026-09-04", 1),
    ("p1", "Design", "Architecture.png", "PNG", "860 KB", "u2", "2026-09-12", 3),
    ("p1", "Design", "ER-Diagram.png", "PNG", "540 KB", "u2", "2026-09-13", 1),
    ("p1", "Reports", "Weekly Report.pdf", "PDF", "410 KB", "u1", "2026-09-29", 4),
    ("p4", "Reports", "Final Report.pdf", "PDF", "2.4 MB", "u1", "2026-09-28", 1),
    ("p4", "Presentations", "Final-Presentation.pptx", "PPTX", "5.8 MB", "u4", "2026-09-27", 2),
    ("p5", "Design", "Voice Architecture.pdf", "PDF", "980 KB", "u4", "2026-09-24", 1),
    ("p3", "Other", "Dataset Notes.txt", "TXT", "12 KB", "u8", "2026-09-21", 1),
    ("p2", "Design", "UI Design.fig", "FIG", "3.1 MB", "u5", "2026-10-02", 5),
]

# scores order: technical, documentation, innovation, presentation, team
REVIEWS = [
    ("p1", "Review 1", "u7", "2026-09-10", (15, 17, 16, 15, 18), "Strong requirement analysis. Tighten the scope of the AI features.", ["Finalize ER diagram", "Reduce AI scope for MVP"]),
    ("p1", "Review 2", "u7", "2026-09-28", (17, 16, 17, 16, 18), "Good backend progress. Dashboard needs real data before Review 3.", ["Connect dashboard to API", "Add test cases"]),
    ("p4", "Final Review", "u7", "2026-09-29", (18, 17, 15, 18, 19), "Excellent delivery and clean demo.", []),
    ("p3", "Review 1", "u7", "2026-09-25", (12, 11, 18, 13, 14), "Innovative idea, but accuracy is below target. Documentation is thin.", ["Improve classifier accuracy", "Write model card"]),
]

# (type, message, project, task_key, read, at) -- all for Harsha (u1)
NOTIFICATIONS = [
    ("deadline", 'Task "Chat UI" is due tomorrow', "p1", "TASK-105", False, "2026-10-03T08:00:00"),
    ("assigned", 'You were assigned "Final Report"', "p1", "TASK-108", False, "2026-10-02T17:30:00"),
    ("project_deadline", "College LMS deadline is in 17 days", "p2", None, False, "2026-10-02T09:00:00"),
    ("comment", 'Rahul commented on "API"', "p1", "TASK-104", False, "2026-10-02T09:05:00"),
    ("completed", 'Rahul completed "Database Schema"', "p1", "TASK-102", True, "2026-10-01T15:12:00"),
    ("milestone", "Backend Development milestone updated to 60%", "p1", None, True, "2026-10-01T11:00:00"),
    ("document", 'Ananya uploaded "UI Design.fig"', "p2", None, True, "2026-10-02T12:40:00"),
    ("review", "Review 3 scheduled for AI-Based Academic Management System", "p1", None, True, "2026-09-30T10:00:00"),
]

ACTIVITIES = [
    ("u2", "completed", "Login API", "p1", "2026-10-03T09:40:00"),
    ("u3", "uploaded", "UI Design", "p2", "2026-10-02T12:40:00"),
    ("u1", "assigned", "Testing API to Sai", "p1", "2026-10-02T11:10:00"),
    ("u1", "updated", "Backend Development milestone to 60%", "p1", "2026-10-01T11:00:00"),
    ("u8", "uploaded", "Dataset Notes.txt", "p3", "2026-10-01T08:15:00"),
    ("u7", "reviewed", "AI-Based Academic Management System (Review 2)", "p1", "2026-09-28T16:00:00"),
    ("u4", "moved", "Implement STT to In Progress", "p5", "2026-09-27T14:22:00"),
    ("u6", "completed", "Attendance Reports", "p4", "2026-09-25T18:05:00"),
]

EVENTS = [
    ("Weekly stand-up", "meeting", "2026-10-05", "10:00", "p1"),
    ("Review 3", "review", "2026-10-08", "14:00", "p1"),
    ("Design sync", "meeting", "2026-10-06", "16:00", "p2"),
    ("Final report submission", "submission", "2026-10-18", "17:00", "p1"),
    ("Chatbot Review 2", "review", "2026-10-14", "11:00", "p3"),
    ("Weekly stand-up", "meeting", "2026-10-12", "10:00", "p1"),
    ("LMS demo submission", "submission", "2026-10-20", "12:00", "p2"),
    ("Mentor meeting", "meeting", "2026-10-03", "15:30", "p3"),
]

DISCUSSIONS = [
    ("p1", "API versioning approach", "u2", "2026-10-01T09:00:00", [
        ("u2", "Should we prefix routes with /api/v1 from day one?", "2026-10-01T09:00:00"),
        ("u1", "Yes — it keeps the mobile app safe when we change payloads later.", "2026-10-01T09:20:00"),
        ("u3", "Works for me. I will point Axios baseURL at /api/v1.", "2026-10-01T10:02:00"),
    ]),
    ("p3", "Dataset for intent classifier", "u8", "2026-09-29T14:00:00", [
        ("u8", "We have 1,200 labelled questions. Is that enough for the pilot?", "2026-09-29T14:00:00"),
        ("u4", "Let’s augment to ~3k with paraphrasing before Review 2.", "2026-09-29T15:10:00"),
    ]),
    ("p2", "Gradebook colour scheme", "u5", "2026-10-02T11:00:00", [
        ("u5", "Uploaded new gradebook mockups — feedback welcome!", "2026-10-02T11:00:00"),
    ]),
]

# --------------------------------------------------------------------------- helpers


def d(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def ts(value: str) -> datetime:
    """Naive mock timestamp (IST) -> aware UTC datetime."""
    return datetime.fromisoformat(value).replace(tzinfo=IST).astimezone(timezone.utc)


def at_ist(day: str, hh: int = 9, mm: int = 0) -> datetime:
    return datetime.combine(date.fromisoformat(day), time(hh, mm), tzinfo=IST).astimezone(timezone.utc)


def size_to_bytes(size: str) -> int:
    number, unit = size.split()
    factor = {"B": 1, "KB": 1024, "MB": 1024**2, "GB": 1024**3}[unit.upper()]
    return int(float(number) * factor)


def milestone_status(progress: int) -> str:
    if progress >= 100:
        return "Completed"
    return "In Progress" if progress > 0 else "Pending"


def alembic_config() -> Config:
    cfg = Config(str(BASE_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BASE_DIR / "alembic"))
    return cfg


def reset_schema() -> None:
    Base.metadata.drop_all(engine)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS alembic_version"))


def migrate() -> None:
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    if "users" in tables and "alembic_version" not in tables:
        # Schema created outside Alembic (e.g. metadata.create_all) - adopt it.
        command.stamp(alembic_config(), "head")
    else:
        command.upgrade(alembic_config(), "head")


# --------------------------------------------------------------------------- seeding


def seed() -> None:
    with SessionLocal() as db:
        pw = hash_password(DEMO_PASSWORD)  # one hash reused: bcrypt is slow
        users: dict[str, User] = {}
        for key, name, email, role, title, tone in USERS:
            users[key] = User(name=name, email=email, password_hash=pw, role=role, title=title, avatar_tone=tone,
                              is_active=True)
        db.add_all(users.values())
        db.flush()

        projects: dict[str, Project] = {}
        for p in PROJECTS:
            created = at_ist(p["start"])
            academic = {**ACADEMIC, **({"academic_year": p["academic_year"]} if "academic_year" in p else {})}
            project = Project(
                name=p["name"], project_code=p["code"], description=p["description"], project_type=p["type"],
                **academic,
                guide=users[p["guide"]], owner=users[p["owner"]],
                start_date=d(p["start"]), end_date=d(p["end"]), actual_completion_date=d(p["done"]),
                priority=p["priority"], status=p["status"], progress=p["progress"], tech_stack=list(p["tech"]),
                is_archived=p["archived"], created_at=created, updated_at=created,
            )
            project.members = [ProjectMember(user=users[u], role=role, joined_at=created) for u, role in p["members"]]
            projects[p["id"]] = project
        db.add_all(projects.values())
        db.flush()

        tasks: dict[str, Task] = {}
        positions: dict[tuple[str, str], int] = {}
        for t in TASKS:
            pos = positions.get((t["project"], t["status"]), 0)
            positions[(t["project"], t["status"])] = pos + 1
            created = at_ist(t["start"])
            task = Task(
                task_key=t["key"], project=projects[t["project"]], title=t["title"],
                description=t["description"] or None, task_type=t["type"], assignee=users[t["assignee"]],
                status=t["status"], priority=t["priority"], start_date=d(t["start"]), due_date=d(t["due"]),
                estimated_hours=float(t["est"]), actual_hours=float(t["act"]), position=pos,
                creator=users[t["created_by"]], created_at=created, updated_at=created,
            )
            task.checklist = [TaskChecklist(item=item, is_completed=done, position=i)
                              for i, (item, done) in enumerate(t["checklist"])]
            task.tags = [TaskTag(tag=tag) for tag in t["tags"]]
            task.comments = [Comment(user=users[u], comment=body, created_at=ts(when), updated_at=ts(when))
                             for u, body, when in t["comments"]]
            tasks[t["key"]] = task
        db.add_all(tasks.values())

        for pid, name, desc, start, due, progress in MILESTONES:
            created = at_ist(start)
            db.add(Milestone(project=projects[pid], name=name, description=desc, start_date=d(start), due_date=d(due),
                             status=milestone_status(progress), progress=progress, created_at=created,
                             updated_at=created))

        for pid, folder, name, ftype, size, uploader, day, version in DOCUMENTS:
            db.add(Document(project=projects[pid], folder=folder, file_name=name, file_type=ftype,
                            file_size=size_to_bytes(size), file_url=f"/uploads/demo/{name}", storage_key=None,
                            version=version, uploader=users[uploader], uploaded_at=at_ist(day, 12)))

        for pid, stage, reviewer, day, scores, feedback, actions in REVIEWS:
            tech, doc, innov, pres, team = scores
            db.add(Review(project=projects[pid], reviewer=users[reviewer], review_stage=stage, review_date=d(day),
                          technical_implementation_score=tech, documentation_score=doc, innovation_score=innov,
                          presentation_score=pres, team_contribution_score=team, score=sum(scores),
                          feedback=feedback, action_items=list(actions), created_at=at_ist(day, 17)))

        for ntype, message, pid, task_key, read, when in NOTIFICATIONS:
            db.add(Notification(user=users["u1"], message=message, notification_type=ntype,
                                project=projects[pid], task=tasks[task_key] if task_key else None,
                                is_read=read, created_at=ts(when)))

        for uid, action, obj, pid, when in ACTIVITIES:
            db.add(ActivityLog(user=users[uid], project=projects[pid], action=action, description=obj,
                               created_at=ts(when)))

        for title, etype, day, hhmm, pid in EVENTS:
            db.add(Event(project=projects[pid], title=title, event_type=etype, event_date=d(day), event_time=hhmm,
                         created_by=users[PROJECTS_BY_ID[pid]["owner"]].id))

        for pid, title, author, created, messages in DISCUSSIONS:
            thread = DiscussionThread(project=projects[pid], title=title, author=users[author],
                                      created_at=ts(created), updated_at=ts(messages[-1][2]))
            thread.messages = [DiscussionMessage(user=users[u], message=body, created_at=ts(when))
                               for u, body, when in messages]
            db.add(thread)

        db.commit()


PROJECTS_BY_ID = {p["id"]: p for p in PROJECTS}


def print_summary() -> None:
    with SessionLocal() as db:
        print(f"{'table':<22}rows")
        for table in Base.metadata.sorted_tables:
            count = db.scalar(select(func.count()).select_from(table))
            print(f"{table.name:<22}{count}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the APMS database with demo data.")
    parser.add_argument("--reset", action="store_true", help="drop all tables and recreate them before seeding")
    args = parser.parse_args()

    print(f"Database: {engine.url.render_as_string(hide_password=True)}")
    if args.reset:
        print("Resetting schema (drop all tables) ...")
        reset_schema()
    migrate()

    with SessionLocal() as db:
        existing = db.scalar(select(func.count()).select_from(User))
    if existing and not args.reset:
        print(f"users table already has {existing} rows - skipping seed (use --reset to reseed).")
    else:
        seed()
        print(f"Seeded demo data. Log in as any demo user (e.g. harsha@apms.edu) with password '{DEMO_PASSWORD}'.")
    print_summary()


if __name__ == "__main__":
    main()
