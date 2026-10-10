import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import constants as C
from .. import schemas as S
from ..database import get_db
from ..deps import accessible_project_ids, can_manage, get_current_user, require_project
from ..models import Project, ProjectMember, Task, User
from ..security import hash_password, verify_password
from ..services import commit, log_activity, notify

router = APIRouter(tags=["Users & Team"])


def _temp_password() -> str:
    """One-time password that always satisfies the password policy (letters + digits, 12 chars)."""
    while True:
        pw = secrets.token_urlsafe(9)
        if any(c.isalpha() for c in pw) and any(c.isdigit() for c in pw):
            return pw


@router.get("/meta/options", summary="Dropdown options (statuses, priorities, roles, ...)")
def options():
    return {
        "projectTypes": C.PROJECT_TYPES, "projectStatuses": C.PROJECT_STATUSES, "priorities": C.PRIORITIES,
        "taskStatuses": C.TASK_STATUSES, "taskTypes": C.TASK_TYPES, "milestoneStatuses": C.MILESTONE_STATUSES,
        "roles": C.ROLES, "reviewStages": C.REVIEW_STAGES, "docFolders": C.DOC_FOLDERS, "eventTypes": C.EVENT_TYPES,
        "notificationTypes": C.NOTIFICATION_TYPES, "techOptions": C.TECH_OPTIONS,
    }


@router.get("/users", response_model=list[S.UserBrief], summary="Directory for member / assignee pickers")
def list_users(q: str | None = None, role: str | None = None, limit: int = Query(100, le=500), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    query = db.query(User).filter(User.is_active.is_(True))
    if q:
        like = f"%{q}%"
        query = query.filter(or_(User.name.ilike(like), User.email.ilike(like)))
    if role:
        query = query.filter(User.role == role)
    return query.order_by(User.name).limit(limit).all()


@router.patch("/users/me", response_model=S.UserOut)
def update_me(body: S.UserUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/me/password", response_model=S.Message)
def change_password(body: S.PasswordChange, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"detail": "Password updated"}


@router.get("/users/{user_id}", response_model=S.UserBrief)
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return user


@router.post("/users/invite", response_model=S.InviteOut, status_code=201, summary="Invite a person (optionally straight into a project)")
def invite(body: S.InviteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = None
    if body.project_id:
        project, _ = require_project(db, body.project_id, user, can_manage, "add members")
    elif user.role not in C.MANAGER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only project owners/managers can invite people")

    email = body.email.lower()
    target = db.query(User).filter(User.email == email).first()
    temp = None
    if not target:
        temp = _temp_password()
        target = User(name=body.name.strip(), email=email, title=body.title, role=body.role, password_hash=hash_password(temp))
        db.add(target)
        db.flush()
    if project and project.owner_id != target.id and not any(m.user_id == target.id for m in project.members):
        project.members.append(ProjectMember(user_id=target.id, role=body.project_role or body.role))
        log_activity(db, user, "added", f"{target.name} to the team", project.id)
        notify(db, [target.id], f"You were added to {project.name}", "assigned", project.id, exclude=user.id)
    commit(db)
    db.refresh(target)
    # In production, email the temporary password to the invitee instead of returning it.
    return S.InviteOut(user=S.UserOut.model_validate(target), temporary_password=temp)


@router.get("/team", response_model=list[S.TeamMemberOut], summary="Everyone across my projects with workload stats")
def team(q: str | None = None, role: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pids = accessible_project_ids(db, user)
    projects = db.query(Project).filter(Project.id.in_(pids)).all() if pids else []
    people: dict[int, dict] = {}

    def add(u: User | None, r: str, p: Project):
        if not u:
            return
        e = people.setdefault(u.id, {"user": u, "roles": set(), "projects": {}})
        e["roles"].add(r)
        e["projects"][p.id] = p.project_code

    for p in projects:
        add(p.owner, "Project Owner", p)
        for m in p.members:
            add(m.user, m.role, p)
        if p.guide:
            add(p.guide, "Mentor", p)

    tasks = db.query(Task.assigned_to, Task.status).filter(Task.project_id.in_(pids)).all() if pids else []
    out = []
    for uid, e in people.items():
        u = e["user"]
        if q and q.lower() not in (u.name + u.email).lower():
            continue
        if role and role not in e["roles"]:
            continue
        mine = [s for a, s in tasks if a == uid]
        done = sum(s == "Done" for s in mine)
        out.append(S.TeamMemberOut(
            user=S.UserBrief.model_validate(u), roles=sorted(e["roles"]), project_ids=list(e["projects"]),
            project_codes=list(e["projects"].values()), total_tasks=len(mine), done_tasks=done, open_tasks=len(mine) - done,
            progress=round(done * 100 / len(mine)) if mine else 0,
        ))
    return sorted(out, key=lambda x: x.user.name)
