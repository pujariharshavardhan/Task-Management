from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from .. import schemas as S
from ..database import get_db
from ..deps import accessible_project_ids, can_contribute, can_manage, get_current_user, get_task_or_404, project_role, require_project
from ..models import Comment, Task, TaskChecklist, TaskTag, User
from ..services import comment_out, commit, log_activity, next_task_key, notify, project_manager_ids, recompute_progress, task_out

router = APIRouter(tags=["Tasks"])

ASSIGNEE_FIELDS = {"status", "actual_hours", "position"}  # what a non-manager may change on their own task


def _clean_tags(tags: list[str]) -> list[str]:
    out = []
    for t in tags:
        t = t.strip().lstrip("#").lower()[:50]
        if t and t not in out:
            out.append(t)
    return out


def _validate_assignee(db: Session, project, user_id: int | None):
    if user_id is None:
        return
    target = db.get(User, user_id)
    if not target or project_role(project, target) is None:
        raise HTTPException(422, "Assignee must be a member of the project")


def _can_edit_task(task: Task, role: str, user: User) -> bool:
    return can_manage(role) or (task.assigned_to == user.id and role != "Viewer")


def _on_status_change(db: Session, task: Task, old: str, user: User):
    if task.status == old:
        return
    if task.status == "Done":
        log_activity(db, user, "completed", task.title, task.project_id, task.id)
        notify(db, project_manager_ids(task.project), f'{user.name} completed "{task.title}"', "completed", task.project_id, task.id, exclude=user.id)
    else:
        log_activity(db, user, "moved", f"{task.title} to {task.status}", task.project_id, task.id)
    recompute_progress(db, task.project)


@router.get("/tasks", response_model=list[S.TaskOut])
def list_tasks(
    project_id: int | None = None,
    assigned_to: int | None = None,
    status_: str | None = Query(None, alias="status"),
    priority: str | None = None,
    q: str | None = None,
    mine: bool = False,
    overdue: bool = False,
    due_before: date | None = None,
    due_after: date | None = None,
    limit: int = Query(500, le=1000),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pids = accessible_project_ids(db, user)
    if project_id is not None:
        pids = [p for p in pids if p == project_id]
    query = db.query(Task).filter(Task.project_id.in_(pids)).options(
        selectinload(Task.project), selectinload(Task.assignee), selectinload(Task.tags), selectinload(Task.checklist), selectinload(Task.comments)
    )
    if assigned_to is not None:
        query = query.filter(Task.assigned_to == assigned_to)
    if mine:
        query = query.filter(Task.assigned_to == user.id)
    if status_:
        query = query.filter(Task.status == status_)
    if priority:
        query = query.filter(Task.priority == priority)
    if q:
        query = query.filter(or_(Task.title.ilike(f"%{q}%"), Task.task_key.ilike(f"%{q}%"), Task.tags.any(TaskTag.tag.ilike(f"%{q.lstrip('#')}%"))))
    if overdue:
        query = query.filter(Task.status != "Done", Task.due_date < date.today())
    if due_before:
        query = query.filter(Task.due_date <= due_before)
    if due_after:
        query = query.filter(Task.due_date >= due_after)
    tasks = query.order_by(Task.position, Task.due_date.is_(None), Task.due_date, Task.id).offset(offset).limit(limit).all()
    return [task_out(t) for t in tasks]


@router.post("/tasks", response_model=S.TaskDetailOut, status_code=201)
def create_task(body: S.TaskCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, body.project_id, user, can_manage, "create tasks")
    _validate_assignee(db, project, body.assigned_to)
    if body.start_date and body.due_date and body.due_date < body.start_date:
        raise HTTPException(422, "Due date must be after start date")
    task = Task(
        task_key=next_task_key(db), created_by=user.id,
        **body.model_dump(exclude={"tags", "checklist"}),
    )
    task.tags = [TaskTag(tag=t) for t in _clean_tags(body.tags)]
    task.checklist = [TaskChecklist(item=i.strip(), position=n) for n, i in enumerate(body.checklist) if i.strip()]
    db.add(task)
    db.flush()
    log_activity(db, user, "created", f"task {task.title}", project.id, task.id)
    if task.assigned_to:
        notify(db, [task.assigned_to], f'You were assigned "{task.title}"', "assigned", project.id, task.id, exclude=user.id)
    recompute_progress(db, project)
    commit(db)
    db.refresh(task)
    return task_out(task, detail=True)


@router.get("/tasks/{task_id}", response_model=S.TaskDetailOut)
def get_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task, _ = get_task_or_404(db, task_id, user)
    return task_out(task, detail=True)


@router.patch("/tasks/{task_id}", response_model=S.TaskDetailOut)
def update_task(task_id: int, body: S.TaskUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task, role = get_task_or_404(db, task_id, user)
    changes = body.model_dump(exclude_unset=True)
    if not can_manage(role):
        if task.assigned_to != user.id or role == "Viewer":
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only update tasks assigned to you")
        if set(changes) - ASSIGNEE_FIELDS:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"You may only change: {', '.join(sorted(ASSIGNEE_FIELDS))}")
    if "assigned_to" in changes:
        _validate_assignee(db, task.project, changes["assigned_to"])

    old_status, old_assignee = task.status, task.assigned_to
    tags = changes.pop("tags", None)
    for k, v in changes.items():
        setattr(task, k, v)
    if tags is not None:
        task.tags = [TaskTag(tag=t) for t in _clean_tags(tags)]
    if task.start_date and task.due_date and task.due_date < task.start_date:
        raise HTTPException(422, "Due date must be after start date")

    if task.assigned_to and task.assigned_to != old_assignee:
        assignee = db.get(User, task.assigned_to)
        log_activity(db, user, "assigned", f"{task.title} to {assignee.name}", task.project_id, task.id)
        notify(db, [task.assigned_to], f'You were assigned "{task.title}"', "assigned", task.project_id, task.id, exclude=user.id)
    _on_status_change(db, task, old_status, user)
    commit(db)
    db.refresh(task)
    return task_out(task, detail=True)


@router.post("/tasks/{task_id}/move", response_model=S.TaskOut, summary="Kanban drag & drop: change status / position")
def move_task(task_id: int, body: S.TaskMove, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task, role = get_task_or_404(db, task_id, user)
    if not _can_edit_task(task, role, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only move tasks assigned to you")
    old = task.status
    task.status = body.status
    if body.position is not None:
        # shift other cards in the target column to make room
        siblings = db.query(Task).filter(Task.project_id == task.project_id, Task.status == body.status, Task.id != task.id).order_by(Task.position, Task.id).all()
        siblings.insert(min(body.position, len(siblings)), task)
        for i, t in enumerate(siblings):
            t.position = i
    _on_status_change(db, task, old, user)
    commit(db)
    db.refresh(task)
    return task_out(task)


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task, role = get_task_or_404(db, task_id, user)
    if not can_manage(role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only managers can delete tasks")
    project = task.project
    log_activity(db, user, "deleted", f"task {task.title}", project.id)
    db.delete(task)
    recompute_progress(db, project)
    commit(db)
    return Response(status_code=204)


# ---------- checklist ----------
def _editable_task(db, task_id, user) -> Task:
    task, role = get_task_or_404(db, task_id, user)
    if not _can_edit_task(task, role, user):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit the checklist of tasks assigned to you")
    return task


@router.post("/tasks/{task_id}/checklist", response_model=S.ChecklistOut, status_code=201)
def add_checklist_item(task_id: int, body: S.ChecklistIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _editable_task(db, task_id, user)
    item = TaskChecklist(item=body.item.strip(), is_completed=body.is_completed, position=len(task.checklist))
    task.checklist.append(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/tasks/{task_id}/checklist/{item_id}", response_model=S.ChecklistOut)
def update_checklist_item(task_id: int, item_id: int, body: S.ChecklistUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _editable_task(db, task_id, user)
    item = next((c for c in task.checklist if c.id == item_id), None)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Checklist item not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/tasks/{task_id}/checklist/{item_id}", status_code=204)
def delete_checklist_item(task_id: int, item_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = _editable_task(db, task_id, user)
    item = next((c for c in task.checklist if c.id == item_id), None)
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Checklist item not found")
    task.checklist.remove(item)
    db.commit()
    return Response(status_code=204)


# ---------- comments ----------
@router.get("/tasks/{task_id}/comments", response_model=list[S.CommentOut])
def list_comments(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task, _ = get_task_or_404(db, task_id, user)
    return [comment_out(c) for c in task.comments]


@router.post("/tasks/{task_id}/comments", response_model=S.CommentOut, status_code=201)
def add_comment(task_id: int, body: S.CommentIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task, role = get_task_or_404(db, task_id, user)
    if not can_contribute(role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Viewers cannot comment")
    c = Comment(task_id=task.id, user_id=user.id, comment=body.comment.strip())
    db.add(c)
    db.flush()
    log_activity(db, user, "commented on", task.title, task.project_id, task.id)
    notify(db, [task.assigned_to, task.created_by], f'{user.name} commented on "{task.title}"', "comment", task.project_id, task.id, exclude=user.id)
    commit(db)
    db.refresh(c)
    return comment_out(c)


@router.patch("/comments/{comment_id}", response_model=S.CommentOut)
def edit_comment(comment_id: int, body: S.CommentIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(Comment, comment_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    get_task_or_404(db, c.task_id, user)
    if c.user_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only edit your own comments")
    c.comment = body.comment.strip()
    db.commit()
    db.refresh(c)
    return comment_out(c)


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(Comment, comment_id)
    if not c:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comment not found")
    _, role = get_task_or_404(db, c.task_id, user)
    if c.user_id != user.id and not can_manage(role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only delete your own comments")
    db.delete(c)
    db.commit()
    return Response(status_code=204)
