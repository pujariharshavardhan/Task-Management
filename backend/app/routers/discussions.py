from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from .. import schemas as S
from ..database import get_db
from ..deps import accessible_project_ids, can_contribute, can_manage, get_current_user, project_role, require_project
from ..models import DiscussionMessage, DiscussionThread, User
from ..services import commit, message_out, notify, thread_out

router = APIRouter(prefix="/discussions", tags=["Discussions"])


def _get(db: Session, thread_id: int, user: User) -> tuple[DiscussionThread, str]:
    th = db.get(DiscussionThread, thread_id)
    role = project_role(th.project, user) if th else None
    if not th or role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Thread not found")
    return th, role


@router.get("", response_model=list[S.ThreadOut])
def list_threads(project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pids = accessible_project_ids(db, user)
    if project_id is not None:
        pids = [p for p in pids if p == project_id]
    threads = (
        db.query(DiscussionThread)
        .filter(DiscussionThread.project_id.in_(pids))
        .options(selectinload(DiscussionThread.messages).selectinload(DiscussionMessage.user), selectinload(DiscussionThread.project), selectinload(DiscussionThread.author))
        .order_by(DiscussionThread.updated_at.desc(), DiscussionThread.id.desc())
        .all()
    )
    return [thread_out(t) for t in threads]


@router.post("", response_model=S.ThreadDetailOut, status_code=201)
def create_thread(body: S.ThreadCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, body.project_id, user, can_contribute, "start discussions")
    th = DiscussionThread(project_id=project.id, title=body.title.strip(), author_id=user.id)
    th.messages.append(DiscussionMessage(user_id=user.id, message=body.message.strip()))
    db.add(th)
    db.commit()
    db.refresh(th)
    return thread_out(th, detail=True)


@router.get("/{thread_id}", response_model=S.ThreadDetailOut)
def get_thread(thread_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    th, _ = _get(db, thread_id, user)
    return thread_out(th, detail=True)


@router.post("/{thread_id}/messages", response_model=S.MessageOut, status_code=201)
def reply(thread_id: int, body: S.MessageCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    th, role = _get(db, thread_id, user)
    if not can_contribute(role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Viewers cannot post messages")
    m = DiscussionMessage(user_id=user.id, message=body.message.strip())
    th.messages.append(m)
    th.updated_at = func.now()
    participants = {x.user_id for x in th.messages} | {th.author_id}
    notify(db, participants, f'{user.name} replied in "{th.title}"', "comment", th.project_id, exclude=user.id)
    commit(db)
    db.refresh(m)
    return message_out(m)


@router.delete("/{thread_id}", status_code=204)
def delete_thread(thread_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    th, role = _get(db, thread_id, user)
    if th.author_id != user.id and not can_manage(role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the author or a manager can delete this thread")
    db.delete(th)
    db.commit()
    return Response(status_code=204)
