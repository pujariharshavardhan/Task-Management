from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, selectinload

from .. import schemas as S
from ..database import get_db
from ..deps import accessible_project_ids, can_manage, get_current_user, project_role, require_project
from ..models import Event, Milestone, Task, User
from ..services import commit, log_activity, notify, project_member_ids

router = APIRouter(tags=["Calendar"])

ALL_TYPES = {"deadline", "milestone", "meeting", "review", "submission"}


@router.get("/calendar", response_model=list[S.CalendarItem], summary="Task deadlines + milestones + meetings/reviews/submissions")
def calendar(
    start: date | None = None,
    end: date | None = None,
    project_id: int | None = None,
    types: str | None = Query(None, description="Comma separated: deadline,milestone,meeting,review,submission"),
    include_done: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    start = start or date.today().replace(day=1) - timedelta(days=7)
    end = end or start + timedelta(days=45)
    wanted = {t.strip() for t in types.split(",")} & ALL_TYPES if types else ALL_TYPES
    pids = accessible_project_ids(db, user)
    if project_id is not None:
        pids = [p for p in pids if p == project_id]
    items: list[S.CalendarItem] = []

    if "deadline" in wanted:
        q = db.query(Task).options(selectinload(Task.project)).filter(Task.project_id.in_(pids), Task.due_date.between(start, end))
        if not include_done:
            q = q.filter(Task.status != "Done")
        items += [S.CalendarItem(id=f"deadline-{t.id}", source_id=t.id, title=t.title, type="deadline", date=t.due_date, project_id=t.project_id, project_name=t.project.name, task_id=t.id) for t in q]
    if "milestone" in wanted:
        q = db.query(Milestone).options(selectinload(Milestone.project)).filter(Milestone.project_id.in_(pids), Milestone.due_date.between(start, end))
        items += [S.CalendarItem(id=f"milestone-{m.id}", source_id=m.id, title=m.name, type="milestone", date=m.due_date, project_id=m.project_id, project_name=m.project.name) for m in q]
    event_types = wanted & {"meeting", "review", "submission"}
    if event_types:
        q = db.query(Event).options(selectinload(Event.project)).filter(Event.project_id.in_(pids), Event.event_date.between(start, end), Event.event_type.in_(event_types))
        items += [S.CalendarItem(id=f"{e.event_type}-{e.id}", source_id=e.id, title=e.title, type=e.event_type, date=e.event_date, time=e.event_time, project_id=e.project_id, project_name=e.project.name) for e in q]
    return sorted(items, key=lambda i: (i.date, i.time or "", i.title))


def _get_event(db: Session, event_id: int, user: User) -> Event:
    e = db.get(Event, event_id)
    role = project_role(e.project, user) if e else None
    if not e or role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if not can_manage(role) and e.created_by != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot change this event")
    return e


@router.get("/events", response_model=list[S.EventOut])
def list_events(project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pids = accessible_project_ids(db, user)
    if project_id is not None:
        pids = [p for p in pids if p == project_id]
    return db.query(Event).filter(Event.project_id.in_(pids)).order_by(Event.event_date, Event.event_time).all()


@router.post("/events", response_model=S.EventOut, status_code=201)
def create_event(body: S.EventCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, body.project_id, user, lambda r: can_manage(r) or r == "Mentor", "schedule events")
    e = Event(**body.model_dump(), created_by=user.id)
    db.add(e)
    log_activity(db, user, "scheduled", f"{body.event_type} “{body.title}” on {body.event_date:%b %d}", project.id)
    if body.event_type == "review":
        notify(db, project_member_ids(project), f"{body.title} scheduled for {project.name} on {body.event_date:%b %d}", "review", project.id, exclude=user.id)
    commit(db)
    db.refresh(e)
    return e


@router.patch("/events/{event_id}", response_model=S.EventOut)
def update_event(event_id: int, body: S.EventUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = _get_event(db, event_id, user)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(e, k, v)
    db.commit()
    db.refresh(e)
    return e


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    e = _get_event(db, event_id, user)
    db.delete(e)
    db.commit()
    return Response(status_code=204)
