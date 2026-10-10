"""Auth + project-level permission helpers.

Permission model (from the spec):
  Project Owner            – everything, incl. delete project and change member roles
  Project Manager/Team Lead – manage tasks, members, milestones, events; view reports
  Developer/Designer/Researcher/Tester/Student – view, update *assigned* tasks, upload, comment, discuss
  Mentor (or project guide) – view, comment, discuss, create academic reviews
  Viewer                    – read-only
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .constants import MANAGER_ROLES
from .database import get_db
from .models import Project, ProjectMember, Task, User
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


def get_current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", headers={"WWW-Authenticate": "Bearer"})
    user_id = decode_access_token(token)
    user = db.get(User, user_id) if user_id else None
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    return user


def project_role(project: Project, user: User) -> str | None:
    """The user's effective role on a project, or None when they have no access."""
    if project.owner_id == user.id:
        return "Project Owner"
    for m in project.members:
        if m.user_id == user.id:
            return m.role
    if project.guide_id == user.id:
        return "Mentor"
    return None


def can_manage(role: str | None) -> bool:
    return role in MANAGER_ROLES


def can_contribute(role: str | None) -> bool:
    """Upload files, comment, post in discussions."""
    return role is not None and role != "Viewer"


def can_review(role: str | None) -> bool:
    return role in MANAGER_ROLES or role == "Mentor"


def get_project_or_404(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


def require_project(db: Session, project_id: int, user: User, check=None, action: str = "do this") -> tuple[Project, str]:
    """Load a project, ensure the user can see it, and optionally run a permission check."""
    project = get_project_or_404(db, project_id)
    role = project_role(project, user)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if check and not check(role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, f"Your role ({role}) cannot {action}")
    return project, role


def get_task_or_404(db: Session, task_id: int, user: User) -> tuple[Task, str]:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    role = project_role(task.project, user)
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task, role


def accessible_project_ids(db: Session, user: User) -> list[int]:
    owned = db.query(Project.id).filter((Project.owner_id == user.id) | (Project.guide_id == user.id))
    member = db.query(ProjectMember.project_id).filter(ProjectMember.user_id == user.id)
    return sorted({pid for (pid,) in owned.union(member).all()})
