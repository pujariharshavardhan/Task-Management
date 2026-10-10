"""Shared domain logic: serializers, activity logging, notifications, progress."""
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import schemas as S
from .models import ActivityLog, DiscussionThread, Document, Notification, Project, Task, User
from .realtime import hub

INACTIVE_STATUSES = {"Completed", "Cancelled"}


def is_active_project(p: Project) -> bool:
    return not p.is_archived and p.status not in INACTIVE_STATUSES


def is_at_risk(p: Project, today: date | None = None) -> bool:
    today = today or date.today()
    return is_active_project(p) and p.end_date is not None and (p.end_date - today).days <= 40 and p.progress < 50


def task_overdue(t: Task, today: date | None = None) -> bool:
    return t.status != "Done" and t.due_date is not None and t.due_date < (today or date.today())


# ---------- serializers ----------
def user_brief(u: User | None) -> S.UserBrief | None:
    return S.UserBrief.model_validate(u) if u else None


def project_out(p: Project, user: User | None = None) -> S.ProjectOut:
    from .deps import project_role

    today = date.today()
    tasks = p.tasks
    data = {c: getattr(p, c) for c in S.ProjectOut.model_fields if hasattr(p, c) and c not in {"members", "owner", "guide"}}
    data.update(
        owner=user_brief(p.owner),
        guide=user_brief(p.guide),
        members=[S.MemberOut.model_validate(m) for m in p.members],
        tech_stack=p.tech_stack or [],
        task_count=len(tasks),
        done_count=sum(t.status == "Done" for t in tasks),
        overdue_count=sum(task_overdue(t, today) for t in tasks),
        at_risk=is_at_risk(p, today),
        my_role=project_role(p, user) if user else None,
    )
    return S.ProjectOut.model_validate(data)


def task_out(t: Task, detail: bool = False):
    data = dict(
        id=t.id, task_key=t.task_key, project_id=t.project_id, project_name=t.project.name, title=t.title,
        description=t.description, task_type=t.task_type, assigned_to=t.assigned_to, assignee=user_brief(t.assignee),
        status=t.status, priority=t.priority, start_date=t.start_date, due_date=t.due_date,
        estimated_hours=t.estimated_hours or 0, actual_hours=t.actual_hours or 0, position=t.position or 0,
        tags=[x.tag for x in t.tags], checklist=[S.ChecklistOut.model_validate(c) for c in t.checklist],
        comment_count=len(t.comments), created_by=t.created_by, is_overdue=task_overdue(t),
        created_at=t.created_at, updated_at=t.updated_at,
    )
    if detail:
        data.update(comments=[comment_out(c) for c in t.comments], creator=user_brief(t.creator))
        return S.TaskDetailOut.model_validate(data)
    return S.TaskOut.model_validate(data)


def comment_out(c) -> S.CommentOut:
    return S.CommentOut(id=c.id, task_id=c.task_id, comment=c.comment, created_at=c.created_at, updated_at=c.updated_at, user=user_brief(c.user))


def document_out(d: Document) -> S.DocumentOut:
    return S.DocumentOut(
        id=d.id, project_id=d.project_id, project_name=d.project.name, task_id=d.task_id, folder=d.folder,
        file_name=d.file_name, file_type=d.file_type, file_size=d.file_size or 0, file_url=d.file_url,
        download_url=f"/api/v1/documents/{d.id}/download", version=d.version, uploaded_at=d.uploaded_at,
        uploader=user_brief(d.uploader),
    )


def review_out(r) -> S.ReviewOut:
    return S.ReviewOut(
        id=r.id, project_id=r.project_id, project_name=r.project.name, review_stage=r.review_stage, review_date=r.review_date,
        reviewer=user_brief(r.reviewer), technical_implementation_score=r.technical_implementation_score,
        documentation_score=r.documentation_score, innovation_score=r.innovation_score, presentation_score=r.presentation_score,
        team_contribution_score=r.team_contribution_score, score=r.score, feedback=r.feedback, comments=r.comments,
        action_items=r.action_items or [], created_at=r.created_at,
    )


def notification_out(n: Notification) -> S.NotificationOut:
    return S.NotificationOut(
        id=n.id, message=n.message, notification_type=n.notification_type, related_project_id=n.related_project_id,
        related_task_id=n.related_task_id, project_name=n.project.name if n.project else None, is_read=n.is_read, created_at=n.created_at,
    )


def activity_out(a: ActivityLog) -> S.ActivityOut:
    return S.ActivityOut(
        id=a.id, user=user_brief(a.user), action=a.action, description=a.description, project_id=a.project_id,
        project_name=a.project.name if a.project else None, task_id=a.task_id, created_at=a.created_at,
    )


def message_out(m) -> S.MessageOut:
    return S.MessageOut(id=m.id, message=m.message, created_at=m.created_at, user=user_brief(m.user))


def thread_out(th: DiscussionThread, detail: bool = False):
    msgs = th.messages
    seen, participants = set(), []
    for m in msgs:
        if m.user and m.user_id not in seen:
            seen.add(m.user_id)
            participants.append(user_brief(m.user))
    data = dict(
        id=th.id, project_id=th.project_id, project_name=th.project.name, title=th.title, author=user_brief(th.author),
        message_count=len(msgs), last_message=message_out(msgs[-1]) if msgs else None, participants=participants,
        created_at=th.created_at, updated_at=th.updated_at,
    )
    if detail:
        return S.ThreadDetailOut(**data, messages=[message_out(m) for m in msgs])
    return S.ThreadOut(**data)


# ---------- side effects ----------
def log_activity(db: Session, user: User | None, action: str, description: str, project_id: int | None = None, task_id: int | None = None):
    db.add(ActivityLog(user_id=user.id if user else None, action=action, description=description[:500], project_id=project_id, task_id=task_id))


def notify(db: Session, user_ids, message: str, ntype: str, project_id: int | None = None, task_id: int | None = None, exclude: int | None = None):
    """Create notifications (respecting in-app prefs) and push them over WebSocket after commit."""
    created = []
    for uid in {u for u in user_ids if u and u != exclude}:
        user = db.get(User, uid)
        prefs = (user.notification_prefs or {}).get(ntype, {}) if user else {}
        if user is None or prefs.get("app") is False:
            continue
        n = Notification(user_id=uid, message=message[:500], notification_type=ntype, related_project_id=project_id, related_task_id=task_id)
        db.add(n)
        created.append(n)
    if created:
        db.flush()
        pending = db.info.setdefault("pending_push", [])
        pending.extend(created)
    return created


def flush_pushes(db: Session):
    """Call after a successful commit to deliver queued real-time notifications."""
    for n in db.info.pop("pending_push", []):
        hub.push(n.user_id, {"type": "notification", "data": notification_out(n).model_dump(mode="json", by_alias=True)})


def commit(db: Session):
    db.commit()
    flush_pushes(db)


def project_manager_ids(p: Project) -> list[int]:
    from .constants import MANAGER_ROLES

    return [p.owner_id] + [m.user_id for m in p.members if m.role in MANAGER_ROLES]


def project_member_ids(p: Project) -> list[int]:
    return [p.owner_id] + [m.user_id for m in p.members] + ([p.guide_id] if p.guide_id else [])


def recompute_progress(db: Session, project: Project):
    """Project progress = share of completed tasks (kept as-is when the project has no tasks)."""
    db.flush()
    total, done = db.execute(
        select(func.count(Task.id), func.count(Task.id).filter(Task.status == "Done")).where(Task.project_id == project.id)
    ).one()
    if total:
        project.progress = round(done * 100 / total)


def next_task_key(db: Session) -> str:
    keys = db.scalars(select(Task.task_key)).all()
    nums = [int(k.split("-")[-1]) for k in keys if k and k.split("-")[-1].isdigit()]
    return f"TASK-{max(nums, default=100) + 1}"


def generate_deadline_alerts(db: Session) -> int:
    """Create 'deadline' (task due tomorrow) and 'project_deadline' (project due within 7 days) notifications once per day."""
    today = date.today()
    day_start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)
    count = 0

    def already(uid, ntype, project_id=None, task_id=None):
        q = db.query(Notification).filter(Notification.user_id == uid, Notification.notification_type == ntype, Notification.created_at >= day_start)
        q = q.filter(Notification.related_task_id == task_id) if task_id else q.filter(Notification.related_project_id == project_id)
        return db.query(q.exists()).scalar()

    for t in db.query(Task).filter(Task.status != "Done", Task.due_date == today + timedelta(days=1), Task.assigned_to.isnot(None)):
        if not already(t.assigned_to, "deadline", task_id=t.id):
            count += len(notify(db, [t.assigned_to], f'Task "{t.title}" is due tomorrow', "deadline", t.project_id, t.id))

    for p in db.query(Project).filter(Project.is_archived.is_(False), Project.status.notin_(INACTIVE_STATUSES), Project.end_date.between(today, today + timedelta(days=7))):
        days = (p.end_date - today).days
        for uid in set(project_manager_ids(p)):
            if not already(uid, "project_deadline", project_id=p.id):
                count += len(notify(db, [uid], f"{p.name} deadline is in {days} day{'s' if days != 1 else ''}", "project_deadline", p.id))
    commit(db)
    return count
