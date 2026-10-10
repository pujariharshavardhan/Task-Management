"""Public "User Reviews" page: anyone can read published reviews; signed-in users write one each."""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, selectinload

from .. import schemas as S
from ..database import get_db
from ..deps import get_current_user
from ..models import Testimonial, User

router = APIRouter(prefix="/testimonials", tags=["User Reviews"])


def _out(t: Testimonial) -> S.TestimonialOut:
    return S.TestimonialOut(
        id=t.id, rating=t.rating, title=t.title, comment=t.comment, author_name=t.user.name,
        author_title=t.user.title, author_tone=t.user.avatar_tone or "primary", created_at=t.created_at, updated_at=t.updated_at,
    )


@router.get("", response_model=S.TestimonialSummary, summary="Published reviews + rating summary (public, no sign-in)")
def list_reviews(limit: int = Query(100, le=500), db: Session = Depends(get_db)):
    rows = (
        db.query(Testimonial).filter(Testimonial.is_published.is_(True)).options(selectinload(Testimonial.user))
        .order_by(Testimonial.created_at.desc(), Testimonial.id.desc()).limit(limit).all()
    )
    dist = {n: 0 for n in range(5, 0, -1)}
    for r in rows:
        dist[r.rating] += 1
    avg = round(sum(r.rating for r in rows) / len(rows), 2) if rows else 0.0
    return S.TestimonialSummary(count=len(rows), average=avg, distribution=dist, reviews=[_out(r) for r in rows])


@router.get("/mine", response_model=S.TestimonialOut | None)
def my_review(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(Testimonial).filter(Testimonial.user_id == user.id).first()
    return _out(t) if t else None


@router.put("/mine", response_model=S.TestimonialOut, summary="Create or update your review")
def save_my_review(body: S.TestimonialIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(Testimonial).filter(Testimonial.user_id == user.id).first()
    if not t:
        t = Testimonial(user_id=user.id)
        db.add(t)
    t.rating, t.title, t.comment = body.rating, body.title.strip(), body.comment.strip()
    db.commit()
    db.refresh(t)
    return _out(t)


@router.delete("/mine", status_code=204)
def delete_my_review(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.query(Testimonial).filter(Testimonial.user_id == user.id).first()
    if not t:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You have not written a review")
    db.delete(t)
    db.commit()
    return Response(status_code=204)
