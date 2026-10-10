"""SQLAlchemy ORM models for APMS.

Portable across PostgreSQL (Neon) and SQLite:
* list-valued columns use ``sa.JSON``;
* booleans / numbers / strings carry both a Python default and a server default
  (``sa.true()`` / ``sa.false()`` for booleans) so raw SQL inserts behave too;
* timestamps are ``DateTime(timezone=True)`` with ``server_default=func.now()``.
  Note: SQLite does not store tz info, so values read back from SQLite are naive
  (and UTC, because SQLite's CURRENT_TIMESTAMP is UTC).
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

TZDateTime = sa.DateTime(timezone=True)


def _created_at() -> Mapped[datetime]:
    return mapped_column(TZDateTime, server_default=func.now(), nullable=False)


def _updated_at() -> Mapped[datetime]:
    return mapped_column(TZDateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


def _bool(default: bool) -> Mapped[bool]:
    return mapped_column(
        sa.Boolean, default=default, server_default=sa.true() if default else sa.false(), nullable=False
    )


def _int(default: int = 0) -> Mapped[int]:
    return mapped_column(sa.Integer, default=default, server_default=sa.text(str(default)), nullable=False)


def _str(length: int, default: str) -> Mapped[str]:
    return mapped_column(String(length), default=default, server_default=default, nullable=False)


# --------------------------------------------------------------------------- users


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = _str(50, "Student")
    title: Mapped[str | None] = mapped_column(String(120))
    avatar_tone: Mapped[str] = _str(20, "primary")
    profile_image: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = _bool(True)
    notification_prefs: Mapped[dict[str, Any] | None] = mapped_column(sa.JSON)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    memberships: Mapped[list[ProjectMember]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<User {self.id} {self.email}>"


# --------------------------------------------------------------------------- projects


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    project_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    project_type: Mapped[str] = mapped_column(String(50), nullable=False)
    college: Mapped[str | None] = mapped_column(String(200))
    department: Mapped[str | None] = mapped_column(String(200))
    academic_year: Mapped[str | None] = mapped_column(String(20))
    semester: Mapped[str | None] = mapped_column(String(20))
    batch: Mapped[str | None] = mapped_column(String(20))
    course: Mapped[str | None] = mapped_column(String(100))
    guide_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    start_date: Mapped[date] = mapped_column(sa.Date, nullable=False)
    end_date: Mapped[date] = mapped_column(sa.Date, nullable=False, index=True)
    actual_completion_date: Mapped[date | None] = mapped_column(sa.Date)
    priority: Mapped[str] = _str(20, "Medium")
    status: Mapped[str] = mapped_column(
        String(30), default="Planning", server_default="Planning", nullable=False, index=True
    )
    progress: Mapped[int] = _int(0)
    tech_stack: Mapped[list[str]] = mapped_column(sa.JSON, default=list, nullable=False)
    is_archived: Mapped[bool] = mapped_column(
        sa.Boolean, default=False, server_default=sa.false(), nullable=False, index=True
    )
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True, nullable=False)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    owner: Mapped[User] = relationship(foreign_keys=[owner_id])
    guide: Mapped[User | None] = relationship(foreign_keys=[guide_id])

    members: Mapped[list[ProjectMember]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )
    tasks: Mapped[list[Task]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )
    milestones: Mapped[list[Milestone]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )
    documents: Mapped[list[Document]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )
    reviews: Mapped[list[Review]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )
    events: Mapped[list[Event]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )
    threads: Mapped[list[DiscussionThread]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )
    activities: Mapped[list[ActivityLog]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )

    def __repr__(self) -> str:
        return f"<Project {self.id} {self.project_code}>"


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    role: Mapped[str] = _str(50, "Student")
    joined_at: Mapped[datetime] = _created_at()

    project: Mapped[Project] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


# --------------------------------------------------------------------------- tasks


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_key: Mapped[str] = mapped_column(String(30), unique=True, index=True, nullable=False)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    task_type: Mapped[str] = _str(30, "Development")
    assigned_to: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="Todo", server_default="Todo", nullable=False, index=True)
    priority: Mapped[str] = _str(20, "Medium")
    start_date: Mapped[date | None] = mapped_column(sa.Date)
    due_date: Mapped[date | None] = mapped_column(sa.Date, index=True)
    estimated_hours: Mapped[float] = mapped_column(sa.Float, default=0, server_default=sa.text("0"), nullable=False)
    actual_hours: Mapped[float] = mapped_column(sa.Float, default=0, server_default=sa.text("0"), nullable=False)
    position: Mapped[int] = _int(0)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    project: Mapped[Project] = relationship(back_populates="tasks")
    assignee: Mapped[User | None] = relationship(foreign_keys=[assigned_to])
    creator: Mapped[User | None] = relationship(foreign_keys=[created_by])
    checklist: Mapped[list[TaskChecklist]] = relationship(
        back_populates="task",
        order_by="TaskChecklist.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    tags: Mapped[list[TaskTag]] = relationship(
        back_populates="task", cascade="all, delete-orphan", passive_deletes=True,
        order_by="TaskTag.id",  # keep the order the tags were entered in
    )
    comments: Mapped[list[Comment]] = relationship(
        back_populates="task",
        order_by="Comment.created_at",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    # Documents attached to this task. No delete cascade: the FK is SET NULL,
    # so deleting a task keeps the files in the project.
    attachments: Mapped[list[Document]] = relationship(back_populates="task", passive_deletes=True)

    def __repr__(self) -> str:
        return f"<Task {self.id} {self.task_key}>"


class TaskChecklist(Base):
    __tablename__ = "task_checklists"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True, nullable=False)
    item: Mapped[str] = mapped_column(String(300), nullable=False)
    is_completed: Mapped[bool] = _bool(False)
    position: Mapped[int] = _int(0)

    task: Mapped[Task] = relationship(back_populates="checklist")


class TaskTag(Base):
    __tablename__ = "task_tags"
    __table_args__ = (UniqueConstraint("task_id", "tag"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True, nullable=False)
    tag: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    task: Mapped[Task] = relationship(back_populates="tags")


class Milestone(Base):
    __tablename__ = "milestones"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date | None] = mapped_column(sa.Date)
    due_date: Mapped[date | None] = mapped_column(sa.Date, index=True)
    status: Mapped[str] = mapped_column(
        String(30), default="Pending", server_default="Pending", nullable=False, index=True
    )
    progress: Mapped[int] = _int(0)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    project: Mapped[Project] = relationship(back_populates="milestones")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    task: Mapped[Task] = relationship(back_populates="comments")
    user: Mapped[User] = relationship()


# --------------------------------------------------------------------------- documents / reviews


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), index=True)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    folder: Mapped[str] = _str(30, "Other")
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    file_size: Mapped[int] = mapped_column(sa.BigInteger, default=0, server_default=sa.text("0"), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    storage_key: Mapped[str | None] = mapped_column(String(500))
    version: Mapped[int] = _int(1)
    uploaded_at: Mapped[datetime] = _created_at()

    project: Mapped[Project] = relationship(back_populates="documents")
    task: Mapped[Task | None] = relationship(back_populates="attachments")
    uploader: Mapped[User | None] = relationship()


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    review_stage: Mapped[str] = mapped_column(String(30), nullable=False)
    review_date: Mapped[date] = mapped_column(sa.Date, nullable=False)
    technical_implementation_score: Mapped[int] = _int(0)
    documentation_score: Mapped[int] = _int(0)
    innovation_score: Mapped[int] = _int(0)
    presentation_score: Mapped[int] = _int(0)
    team_contribution_score: Mapped[int] = _int(0)
    score: Mapped[int] = _int(0)  # total out of 100
    feedback: Mapped[str | None] = mapped_column(Text)
    comments: Mapped[str | None] = mapped_column(Text)
    action_items: Mapped[list[str]] = mapped_column(sa.JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = _created_at()

    project: Mapped[Project] = relationship(back_populates="reviews")
    reviewer: Mapped[User | None] = relationship()


# --------------------------------------------------------------------------- notifications / activity


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_id_is_read", "user_id", "is_read"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    message: Mapped[str] = mapped_column(String(500), nullable=False)
    notification_type: Mapped[str] = mapped_column(String(30), nullable=False)
    related_project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"), index=True)
    related_task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), index=True)
    is_read: Mapped[bool] = _bool(False)
    created_at: Mapped[datetime] = _created_at()

    user: Mapped[User] = relationship()
    project: Mapped[Project | None] = relationship()
    task: Mapped[Task | None] = relationship()


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(TZDateTime, server_default=func.now(), nullable=False, index=True)

    user: Mapped[User | None] = relationship()
    project: Mapped[Project | None] = relationship(back_populates="activities")


# --------------------------------------------------------------------------- calendar / discussions


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    event_type: Mapped[str] = mapped_column(String(20), nullable=False)
    event_date: Mapped[date] = mapped_column(sa.Date, nullable=False, index=True)
    event_time: Mapped[str | None] = mapped_column(String(5))  # "HH:MM"
    description: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = _created_at()

    project: Mapped[Project] = relationship(back_populates="events")


class DiscussionThread(Base):
    __tablename__ = "discussion_threads"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    project: Mapped[Project] = relationship(back_populates="threads")
    author: Mapped[User | None] = relationship()
    messages: Mapped[list[DiscussionMessage]] = relationship(
        back_populates="thread",
        order_by="DiscussionMessage.created_at",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class DiscussionMessage(Base):
    __tablename__ = "discussion_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    thread_id: Mapped[int] = mapped_column(
        ForeignKey("discussion_threads.id", ondelete="CASCADE"), index=True, nullable=False
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = _created_at()

    thread: Mapped[DiscussionThread] = relationship(back_populates="messages")
    user: Mapped[User | None] = relationship()


class Testimonial(Base):
    """A public user review of APMS (the "User Reviews" page). One per user; the author can edit or delete it."""

    __tablename__ = "testimonials"
    __table_args__ = (sa.CheckConstraint("rating BETWEEN 1 AND 5", name="rating_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    rating: Mapped[int] = mapped_column(nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    is_published: Mapped[bool] = _bool(True)
    created_at: Mapped[datetime] = _created_at()
    updated_at: Mapped[datetime] = _updated_at()

    user: Mapped[User] = relationship()
