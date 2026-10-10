from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import schemas as S
from ..database import get_db
from ..deps import accessible_project_ids, can_manage, get_current_user, project_role, require_project
from ..models import Milestone, User
from ..services import commit, log_activity, notify, project_member_ids

router = APIRouter(tags=["Milestones"])


def _derive_status(progress: int) -> str:
    return "Completed" if progress >= 100 else "In Progress" if progress > 0 else "Pending"


def _get(db: Session, milestone_id: int, user: User, manage: bool = False) -> Milestone:
    m = db.get(Milestone, milestone_id)
    role = project_role(m.project, user) if m else None
    if not m or role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Milestone not found")
    if manage and not can_manage(role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Your role ({role}) cannot update milestones")
    return m


@router.get("/milestones", response_model=list[S.MilestoneOut], summary="All milestones across my projects")
def list_all_milestones(project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pids = accessible_project_ids(db, user)
    if project_id is not None:
        pids = [p for p in pids if p == project_id]
    return db.query(Milestone).filter(Milestone.project_id.in_(pids)).order_by(Milestone.start_date, Milestone.id).all()


@router.get("/projects/{project_id}/milestones", response_model=list[S.MilestoneOut])
def list_milestones(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, project_id, user)
    return sorted(project.milestones, key=lambda m: (m.start_date is None, m.start_date, m.id))


@router.post("/projects/{project_id}/milestones", response_model=S.MilestoneOut, status_code=201)
def create_milestone(project_id: int, body: S.MilestoneCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, project_id, user, can_manage, "create milestones")
    if body.start_date and body.due_date and body.due_date < body.start_date:
        raise HTTPException(422, "Due date must be after start date")
    data = body.model_dump()
    data["status"] = data["status"] or _derive_status(body.progress)
    m = Milestone(project_id=project.id, **data)
    db.add(m)
    log_activity(db, user, "created", f"milestone {m.name}", project.id)
    commit(db)
    db.refresh(m)
    return m


@router.patch("/milestones/{milestone_id}", response_model=S.MilestoneOut)
def update_milestone(milestone_id: int, body: S.MilestoneUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = _get(db, milestone_id, user, manage=True)
    changes = body.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(m, k, v)
    if "progress" in changes and "status" not in changes:
        m.status = _derive_status(m.progress)
    if m.start_date and m.due_date and m.due_date < m.start_date:
        raise HTTPException(422, "Due date must be after start date")
    text = f"{m.name} milestone updated to {m.progress}%" if "progress" in changes else f"{m.name} milestone updated"
    log_activity(db, user, "updated", f"{m.name} milestone to {m.progress}%", m.project_id)
    notify(db, project_member_ids(m.project), text, "milestone", m.project_id, exclude=user.id)
    commit(db)
    db.refresh(m)
    return m


@router.delete("/milestones/{milestone_id}", status_code=204)
def delete_milestone(milestone_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    m = _get(db, milestone_id, user, manage=True)
    log_activity(db, user, "deleted", f"milestone {m.name}", m.project_id)
    db.delete(m)
    commit(db)
    return Response(status_code=204)
