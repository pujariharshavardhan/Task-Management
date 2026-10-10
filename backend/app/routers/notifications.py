from fastapi import APIRouter, Depends, HTTPException, Query, Response, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session, selectinload

from .. import schemas as S
from ..database import SessionLocal, get_db
from ..deps import get_current_user
from ..models import Notification, User
from ..realtime import hub
from ..security import decode_access_token
from ..services import generate_deadline_alerts, notification_out

router = APIRouter(tags=["Notifications"])


def _mine(db: Session, notification_id: int, user: User) -> Notification:
    n = db.get(Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    return n


@router.get("/notifications", response_model=list[S.NotificationOut])
def list_notifications(unread_only: bool = False, limit: int = Query(50, le=200), offset: int = 0, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Notification).options(selectinload(Notification.project)).filter(Notification.user_id == user.id)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    return [notification_out(n) for n in q.order_by(Notification.created_at.desc(), Notification.id.desc()).offset(offset).limit(limit)]


@router.get("/notifications/unread-count")
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"count": db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False)).count()}


@router.patch("/notifications/{notification_id}/read", response_model=S.NotificationOut)
def mark_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = _mine(db, notification_id, user)
    n.is_read = True
    db.commit()
    db.refresh(n)
    return notification_out(n)


@router.post("/notifications/read-all", response_model=S.Message)
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    updated = db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read.is_(False)).update({"is_read": True})
    db.commit()
    return {"detail": f"{updated} marked as read"}


@router.delete("/notifications/{notification_id}", status_code=204)
def delete_notification(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(_mine(db, notification_id, user))
    db.commit()
    return Response(status_code=204)


@router.post("/notifications/run-deadline-check", response_model=S.Message, summary="Generate deadline alerts now (also runs hourly)")
def run_deadline_check(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return {"detail": f"{generate_deadline_alerts(db)} notifications created"}


@router.websocket("/ws/notifications")
async def notifications_ws(ws: WebSocket, token: str = Query(...)):
    """Real-time notifications. Connect with ws://host/api/v1/ws/notifications?token=<JWT>."""
    user_id = decode_access_token(token)
    with SessionLocal() as db:
        user = db.get(User, user_id) if user_id else None
    if not user:
        await ws.close(code=4401)
        return
    await hub.connect(user.id, ws)
    try:
        while True:
            await ws.receive_text()  # keep-alive; clients may send "ping"
    except WebSocketDisconnect:
        hub.disconnect(user.id, ws)
