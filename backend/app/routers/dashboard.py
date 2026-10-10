from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from .. import schemas as S
from ..constants import TASK_STATUSES
from ..database import get_db
from ..deps import accessible_project_ids, get_current_user
from ..models import ActivityLog, Comment, Document, Milestone, Project, ProjectMember, Task, TaskTag, User
from ..services import INACTIVE_STATUSES, activity_out, is_at_risk, project_out, task_out

router = APIRouter(tags=["Dashboard, Activity & Search"])


@router.get("/dashboard", response_model=S.DashboardOut)
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pids = accessible_project_ids(db, user)
    projects = db.query(Project).filter(Project.id.in_(pids)).options(selectinload(Project.tasks), selectinload(Project.members).selectinload(ProjectMember.user)).all()
    tasks = db.query(Task).filter(Task.project_id.in_(pids)).options(selectinload(Task.project), selectinload(Task.assignee), selectinload(Task.tags), selectinload(Task.checklist), selectinload(Task.comments)).all()
    today = date.today()
    active = [p for p in projects if not p.is_archived and p.status not in INACTIVE_STATUSES]
    pending = [t for t in tasks if t.status != "Done"]
    upcoming = sorted([t for t in pending if t.due_date], key=lambda t: t.due_date)[:8]
    activity = db.query(ActivityLog).filter(ActivityLog.project_id.in_(pids)).options(selectinload(ActivityLog.user), selectinload(ActivityLog.project)).order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc()).limit(10).all()
    return S.DashboardOut(
        stats={
            "totalProjects": len(projects),
            "archivedProjects": sum(p.is_archived for p in projects),
            "activeProjects": len(active),
            "atRiskProjects": sum(is_at_risk(p, today) for p in active),
            "pendingTasks": len(pending),
            "overdueTasks": sum(1 for t in pending if t.due_date and t.due_date < today),
            "completedProjects": sum(p.status == "Completed" for p in projects),
            "myOpenTasks": sum(1 for t in pending if t.assigned_to == user.id),
        },
        task_status_counts={s: sum(t.status == s for t in tasks) for s in TASK_STATUSES},
        active_projects=[project_out(p, user) for p in sorted(active, key=lambda p: p.end_date)[:6]],
        upcoming_deadlines=[task_out(t) for t in upcoming],
        recent_activity=[activity_out(a) for a in activity],
    )


@router.get("/activity", response_model=list[S.ActivityOut], summary="Audit-style activity timeline")
def activity(project_id: int | None = None, user_id: int | None = None, limit: int = Query(50, le=200), offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pids = accessible_project_ids(db, user)
    if project_id is not None:
        pids = [p for p in pids if p == project_id]
    q = db.query(ActivityLog).filter(ActivityLog.project_id.in_(pids)).options(selectinload(ActivityLog.user), selectinload(ActivityLog.project))
    if user_id is not None:
        q = q.filter(ActivityLog.user_id == user_id)
    return [activity_out(a) for a in q.order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc()).offset(offset).limit(limit)]


@router.get("/search", response_model=S.SearchOut, summary="Global search across projects, tasks, members, documents, milestones, comments")
def search(q: str = Query(..., min_length=1), limit: int = Query(5, le=20), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pids = accessible_project_ids(db, user)
    like = f"%{q.strip()}%"
    projects = db.query(Project).filter(Project.id.in_(pids), or_(Project.name.ilike(like), Project.project_code.ilike(like), Project.description.ilike(like))).limit(limit)
    tasks = (
        db.query(Task).join(Project).filter(Task.project_id.in_(pids), or_(Task.title.ilike(like), Task.task_key.ilike(like), Task.description.ilike(like), Task.tags.any(TaskTag.tag.ilike(like)), Project.name.ilike(like)))
        .order_by(Task.title.ilike(like).desc(), Task.due_date).limit(limit)
    )
    member_ids = {m for (m,) in db.query(ProjectMember.user_id).filter(ProjectMember.project_id.in_(pids))} | {o for (o,) in db.query(Project.owner_id).filter(Project.id.in_(pids))}
    members = db.query(User).filter(User.id.in_(member_ids), or_(User.name.ilike(like), User.email.ilike(like))).limit(limit)
    docs = db.query(Document).filter(Document.project_id.in_(pids), Document.file_name.ilike(like)).limit(limit)
    milestones = db.query(Milestone).filter(Milestone.project_id.in_(pids), Milestone.name.ilike(like)).limit(limit)
    comments = db.query(Comment).join(Task).filter(Task.project_id.in_(pids), Comment.comment.ilike(like)).limit(limit)
    return S.SearchOut(
        query=q,
        projects=[S.SearchHit(id=p.id, label=p.name, sub=p.project_code, project_id=p.id) for p in projects],
        tasks=[S.SearchHit(id=t.id, label=t.title, sub=t.task_key, project_id=t.project_id) for t in tasks],
        members=[S.SearchHit(id=u.id, label=u.name, sub=u.title or u.role) for u in members],
        documents=[S.SearchHit(id=d.id, label=d.file_name, sub=d.folder, project_id=d.project_id) for d in docs],
        milestones=[S.SearchHit(id=m.id, label=m.name, sub="Milestone", project_id=m.project_id) for m in milestones],
        comments=[S.SearchHit(id=c.id, label=c.comment[:80], sub=c.task.title, project_id=c.task.project_id) for c in comments],
    )
