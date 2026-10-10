from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session, selectinload

from .. import schemas as S
from ..database import get_db
from ..deps import accessible_project_ids, can_review, get_current_user, project_role, require_project
from ..models import Review, User
from ..services import commit, log_activity, notify, project_member_ids, review_out

router = APIRouter(prefix="/reviews", tags=["Academic Reviews"])

SCORE_FIELDS = ["technical_implementation_score", "documentation_score", "innovation_score", "presentation_score", "team_contribution_score"]


def _total(r: Review) -> int:
    return sum(getattr(r, f) or 0 for f in SCORE_FIELDS)


def _get(db: Session, review_id: int, user: User, edit: bool = False) -> Review:
    r = db.get(Review, review_id)
    role = project_role(r.project, user) if r else None
    if not r or role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if edit and r.reviewer_id != user.id and role != "Project Owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the reviewer or project owner can change this review")
    return r


@router.get("", response_model=list[S.ReviewOut])
def list_reviews(project_id: int | None = None, stage: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pids = accessible_project_ids(db, user)
    if project_id is not None:
        pids = [p for p in pids if p == project_id]
    query = db.query(Review).filter(Review.project_id.in_(pids)).options(selectinload(Review.project), selectinload(Review.reviewer))
    if stage:
        query = query.filter(Review.review_stage == stage)
    return [review_out(r) for r in query.order_by(Review.review_date.desc(), Review.id.desc()).all()]


@router.get("/summary", summary="Totals and averages for the reviews page")
def review_summary(project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    reviews = list_reviews(project_id, None, db, user)
    scores = [r.score for r in reviews]
    best = max(reviews, key=lambda r: r.score, default=None)
    return {
        "totalReviews": len(reviews),
        "averageScore": round(sum(scores) / len(scores)) if scores else 0,
        "topScore": best.score if best else None,
        "topReviewId": best.id if best else None,
    }


@router.post("", response_model=S.ReviewOut, status_code=201)
def create_review(body: S.ReviewCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, _ = require_project(db, body.project_id, user, can_review, "create academic reviews")
    reviewer_id = body.reviewer_id or user.id
    if not db.get(User, reviewer_id):
        raise HTTPException(422, "Reviewer not found")
    r = Review(**body.model_dump(exclude={"reviewer_id"}), reviewer_id=reviewer_id)
    r.score = _total(r)
    db.add(r)
    db.flush()
    log_activity(db, user, "reviewed", f"{project.name} ({r.review_stage}) – {r.score}/100", project.id)
    notify(db, project_member_ids(project), f"{r.review_stage} results for {project.name}: {r.score}/100", "review", project.id, exclude=user.id)
    commit(db)
    db.refresh(r)
    return review_out(r)


@router.get("/{review_id}", response_model=S.ReviewOut)
def get_review(review_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return review_out(_get(db, review_id, user))


@router.patch("/{review_id}", response_model=S.ReviewOut)
def update_review(review_id: int, body: S.ReviewUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = _get(db, review_id, user, edit=True)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    r.score = _total(r)
    db.commit()
    db.refresh(r)
    return review_out(r)


@router.delete("/{review_id}", status_code=204)
def delete_review(review_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    r = _get(db, review_id, user, edit=True)
    db.delete(r)
    db.commit()
    return Response(status_code=204)
