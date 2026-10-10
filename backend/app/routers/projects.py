from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from .. import schemas as S
from ..database import get_db
from ..deps import accessible_project_ids, can_manage, get_current_user, require_project
from ..models import Project, ProjectMember, User
from ..services import INACTIVE_STATUSES, commit, log_activity, notify, project_out

router = APIRouter(prefix="/projects", tags=["Projects"])


def _owner_only(role: str | None) -> bool:
    return role == "Project Owner"


def _check_user(db: Session, user_id: int | None, label: str):
    if user_id is not None and not db.get(User, user_id):
        raise HTTPException(422, f"{label} user {user_id} does not exist")


def _generate_code(db: Session, year: int) -> str:
    prefix = f"APMS-{year}-"
    n = db.query(func.count(Project.id)).filter(Project.project_code.like(f"{prefix}%")).scalar() + 1
    while db.query(Project.id).filter(Project.project_code == f"{prefix}{n:03d}").first():
        n += 1
    return f"{prefix}{n:03d}"


@router.get("", response_model=list[S.ProjectOut])
def list_projects(
    filter: str = Query("all", pattern="^(all|active|completed|archived)$"),
    q: str | None = None,
    priority: str | None = None,
    project_type: str | None = Query(None, alias="type"),
    status_: str | None = Query(None, alias="status"),
    sort: str = Query("deadline", pattern="^(deadline|progress|name|created)$"),
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pids = accessible_project_ids(db, user)
    query = db.query(Project).filter(Project.id.in_(pids)).options(
        selectinload(Project.members).selectinload(ProjectMember.user), selectinload(Project.tasks), selectinload(Project.owner), selectinload(Project.guide)
    )
    if filter == "archived":
        query = query.filter(Project.is_archived.is_(True))
    else:
        query = query.filter(Project.is_archived.is_(False))
        if filter == "active":
            query = query.filter(Project.status.notin_(INACTIVE_STATUSES))
        elif filter == "completed":
            query = query.filter(Project.status == "Completed")
    if q:
        query = query.filter(or_(Project.name.ilike(f"%{q}%"), Project.project_code.ilike(f"%{q}%")))
    if priority:
        query = query.filter(Project.priority == priority)
    if project_type:
        query = query.filter(Project.project_type == project_type)
    if status_:
        query = query.filter(Project.status == status_)
    order = {"deadline": Project.end_date.asc(), "progress": Project.progress.desc(), "name": Project.name.asc(), "created": Project.created_at.desc()}[sort]
    return [project_out(p, user) for p in query.order_by(order, Project.id).offset(offset).limit(limit).all()]


@router.post("", response_model=S.ProjectOut, status_code=201)
def create_project(body: S.ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.end_date < body.start_date:
        raise HTTPException(422, "End date must be after start date")
    code = (body.project_code or "").strip() or _generate_code(db, body.start_date.year)
    if db.query(Project.id).filter(Project.project_code == code).first():
        raise HTTPException(status.HTTP_409_CONFLICT, f"Project code {code} is already in use")
    _check_user(db, body.guide_id, "Guide")

    data = body.model_dump(exclude={"members", "project_code"})
    project = Project(**data, project_code=code, owner_id=user.id)
    seen = set()
    for m in body.members:
        _check_user(db, m.user_id, "Member")
        if m.user_id not in seen:
            seen.add(m.user_id)
            project.members.append(ProjectMember(user_id=m.user_id, role=m.role))
    db.add(project)
    db.flush()
    log_activity(db, user, "created", f"project {project.name}", project.id)
    notify(db, [m.user_id for m in project.members], f"You were added to {project.name}", "assigned", project.id, exclude=user.id)
    commit(db)
    db.refresh(project)
    return project_out(project, user)


@router.get("/{project_id}", response_model=S.ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, project_id, user)
    return project_out(project, user)


@router.patch("/{project_id}", response_model=S.ProjectOut)
def update_project(project_id: int, body: S.ProjectUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, role = require_project(db, project_id, user, can_manage, "edit this project")
    changes = body.model_dump(exclude_unset=True)
    if "is_archived" in changes and role != "Project Owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the project owner can archive or restore")
    if "project_code" in changes and changes["project_code"] != project.project_code:
        if db.query(Project.id).filter(Project.project_code == changes["project_code"]).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "Project code already in use")
    if "guide_id" in changes:
        _check_user(db, changes["guide_id"], "Guide")
    start, end = changes.get("start_date", project.start_date), changes.get("end_date", project.end_date)
    if start and end and end < start:
        raise HTTPException(422, "End date must be after start date")

    old_status = project.status
    for k, v in changes.items():
        setattr(project, k, v)
    if changes.get("status") == "Completed" and not project.actual_completion_date:
        project.actual_completion_date = date.today()

    if "is_archived" in changes:
        log_activity(db, user, "archived" if project.is_archived else "restored", f"project {project.name}", project.id)
    elif "status" in changes and old_status != project.status:
        log_activity(db, user, "updated", f"project status to {project.status}", project.id)
    else:
        log_activity(db, user, "updated", f"project {project.name}", project.id)
    commit(db)
    db.refresh(project)
    return project_out(project, user)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, project_id, user, _owner_only, "delete this project")
    from .. import storage

    for d in project.documents:
        storage.delete(d.storage_key)
    db.delete(project)
    db.commit()
    return Response(status_code=204)


# ---------- members ----------
@router.get("/{project_id}/members", response_model=list[S.MemberOut])
def list_members(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, project_id, user)
    return project.members


@router.post("/{project_id}/members", response_model=S.MemberOut, status_code=201)
def add_member(project_id: int, body: S.MemberIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, project_id, user, can_manage, "add members")
    target = db.get(User, body.user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if any(m.user_id == body.user_id for m in project.members):
        raise HTTPException(status.HTTP_409_CONFLICT, f"{target.name} is already a member")
    member = ProjectMember(user_id=body.user_id, role=body.role)
    project.members.append(member)
    log_activity(db, user, "added", f"{target.name} as {body.role}", project.id)
    notify(db, [target.id], f"You were added to {project.name} as {body.role}", "assigned", project.id, exclude=user.id)
    commit(db)
    db.refresh(member)
    return member


@router.patch("/{project_id}/members/{user_id}", response_model=S.MemberOut, summary="Change a member's role (owner only)")
def update_member(project_id: int, user_id: int, body: S.MemberUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, project_id, user, _owner_only, "manage permissions")
    member = next((m for m in project.members if m.user_id == user_id), None)
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    member.role = body.role
    log_activity(db, user, "updated", f"{member.user.name}'s role to {body.role}", project.id)
    commit(db)
    db.refresh(member)
    return member


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(project_id: int, user_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, project_id, user, can_manage, "remove members")
    if user_id == project.owner_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The project owner cannot be removed")
    member = next((m for m in project.members if m.user_id == user_id), None)
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    name = member.user.name
    project.members.remove(member)
    log_activity(db, user, "removed", f"{name} from the team", project.id)
    commit(db)
    return Response(status_code=204)
