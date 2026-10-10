from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import schemas as S
from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..hardening import auth_throttle, limiter
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])


def _token(user: User) -> S.TokenOut:
    return S.TokenOut(access_token=create_access_token(user.id), user=S.UserOut.model_validate(user))


def _authenticate(request: Request, db: Session, email: str, password: str) -> User:
    key = auth_throttle(request, email)
    user = db.query(User).filter(User.email == email.lower()).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Account is disabled")
    limiter.reset(key)
    return user


@router.post("/register", response_model=S.TokenOut, status_code=201)
def register(body: S.RegisterIn, request: Request, db: Session = Depends(get_db)):
    auth_throttle(request, body.email)
    email = body.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    # Self-registered users manage their own projects
    user = User(name=body.name.strip(), email=email, password_hash=hash_password(body.password), role="Project Owner", title="Project Manager")
    db.add(user)
    db.commit()
    db.refresh(user)
    return _token(user)


@router.post("/login", response_model=S.TokenOut)
def login(body: S.LoginIn, request: Request, db: Session = Depends(get_db)):
    return _token(_authenticate(request, db, body.email, body.password))


@router.post("/token", response_model=S.TokenOut, summary="OAuth2 form login (used by the Swagger Authorize button)")
def token(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    return _token(_authenticate(request, db, form.username, form.password))


@router.get("/me", response_model=S.UserOut)
def me(user: User = Depends(get_current_user)):
    return user
