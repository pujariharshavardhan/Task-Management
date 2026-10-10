"""Create (or update) an account directly in the database.

    python create_user.py --name Harsha --email harsha@gmail.com --password "harsha@123"
    python create_user.py ... --reset   # wipe ALL data first, then create the user

Runs the Alembic migrations first, so it also works on an empty database.
"""
import argparse

from app.constants import ROLES
from app.database import SessionLocal
from app.models import User
from app.security import hash_password
from seed import migrate, reset_schema


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", default="Project Owner", choices=ROLES)
    parser.add_argument("--title", help="job title shown in the app (defaults to the role)")
    parser.add_argument("--reset", action="store_true", help="drop every table and start from an empty database")
    args = parser.parse_args()

    if args.reset:
        reset_schema()
    migrate()

    email = args.email.strip().lower()
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        created = user is None
        if created:
            user = User(email=email)
            db.add(user)
        user.name = args.name.strip()
        user.role = args.role
        user.title = args.title or user.title or args.role
        user.password_hash = hash_password(args.password)
        user.is_active = True
        db.commit()
        print(f"{'Created' if created else 'Updated'} user #{user.id}: {user.name} <{user.email}> ({user.role})")


if __name__ == "__main__":
    main()
