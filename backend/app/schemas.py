"""Pydantic request/response models.

JSON is camelCase (matches the React frontend); snake_case is also accepted on input.
"""
from datetime import date, datetime, timezone
from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_serializer
from pydantic.alias_generators import to_camel

from . import constants as C


def one_of(options: list[str]):
    def check(v: str | None):
        if v is not None and v not in options:
            raise ValueError(f"must be one of: {', '.join(options)}")
        return v
    return AfterValidator(check)


ProjectType = Annotated[str, one_of(C.PROJECT_TYPES)]
ProjectStatus = Annotated[str, one_of(C.PROJECT_STATUSES)]
Priority = Annotated[str, one_of(C.PRIORITIES)]
TaskStatus = Annotated[str, one_of(C.TASK_STATUSES)]
TaskType = Annotated[str, one_of(C.TASK_TYPES)]
MilestoneStatus = Annotated[str, one_of(C.MILESTONE_STATUSES)]
Role = Annotated[str, one_of(C.ROLES)]
ReviewStage = Annotated[str, one_of(C.REVIEW_STAGES)]
Folder = Annotated[str, one_of(C.DOC_FOLDERS)]
EventType = Annotated[str, one_of(C.EVENT_TYPES)]
Score = Annotated[int, Field(ge=0, le=20)]


class Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    @field_serializer("*", mode="wrap")
    def _utc(self, value, handler):
        # Timestamps are stored in UTC; some drivers (SQLite) drop the offset. Always send it,
        # otherwise browsers read the value as local time ("5h ago" for something just created).
        if isinstance(value, datetime) and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return handler(value)


# ---------- Users / auth ----------
class UserBrief(Schema):
    id: int
    name: str
    email: str
    role: str
    title: str | None = None
    avatar_tone: str = "primary"
    profile_image: str | None = None


class UserOut(UserBrief):
    is_active: bool = True
    notification_prefs: dict[str, Any] | None = None
    created_at: datetime | None = None


def strong_password(v: str) -> str:
    if len(v) < 8 or not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
        raise ValueError("must be at least 8 characters and include a letter and a number")
    return v


Password = Annotated[str, Field(max_length=128), AfterValidator(strong_password)]


class RegisterIn(Schema):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: Password


class LoginIn(Schema):
    email: EmailStr
    password: str


class TokenOut(Schema):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(Schema):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    title: str | None = None
    avatar_tone: str | None = None
    profile_image: str | None = None
    notification_prefs: dict[str, Any] | None = None


class PasswordChange(Schema):
    current_password: str
    new_password: Password


class InviteIn(Schema):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    title: str | None = None
    role: Role = "Student"
    project_id: int | None = None
    project_role: Role | None = None


class InviteOut(Schema):
    user: UserOut
    temporary_password: str | None = None


class TeamMemberOut(Schema):
    user: UserBrief
    roles: list[str]
    project_ids: list[int]
    project_codes: list[str]
    total_tasks: int
    done_tasks: int
    open_tasks: int
    progress: int


# ---------- Projects ----------
class MemberIn(Schema):
    user_id: int
    role: Role = "Developer"


class MemberUpdate(Schema):
    role: Role


class MemberOut(Schema):
    id: int
    user_id: int
    role: str
    joined_at: datetime | None = None
    user: UserBrief


class ProjectBase(Schema):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1)
    project_type: ProjectType
    college: str | None = None
    department: str | None = None
    academic_year: str | None = None
    semester: str | None = None
    batch: str | None = None
    course: str | None = None
    guide_id: int | None = None
    start_date: date
    end_date: date
    actual_completion_date: date | None = None
    priority: Priority = "Medium"
    status: ProjectStatus = "Planning"
    tech_stack: list[str] = []


class ProjectCreate(ProjectBase):
    project_code: str | None = Field(default=None, max_length=40)  # auto-generated when omitted
    members: list[MemberIn] = []


class ProjectUpdate(Schema):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    project_code: str | None = Field(default=None, max_length=40)
    description: str | None = None
    project_type: ProjectType | None = None
    college: str | None = None
    department: str | None = None
    academic_year: str | None = None
    semester: str | None = None
    batch: str | None = None
    course: str | None = None
    guide_id: int | None = None
    start_date: date | None = None
    end_date: date | None = None
    actual_completion_date: date | None = None
    priority: Priority | None = None
    status: ProjectStatus | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    tech_stack: list[str] | None = None
    is_archived: bool | None = None


class ProjectOut(ProjectBase):
    id: int
    project_code: str
    progress: int
    is_archived: bool
    owner_id: int
    owner: UserBrief
    guide: UserBrief | None = None
    members: list[MemberOut] = []
    task_count: int = 0
    done_count: int = 0
    overdue_count: int = 0
    at_risk: bool = False
    my_role: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- Tasks ----------
class ChecklistIn(Schema):
    item: str = Field(min_length=1, max_length=300)
    is_completed: bool = False


class ChecklistUpdate(Schema):
    item: str | None = Field(default=None, min_length=1, max_length=300)
    is_completed: bool | None = None
    position: int | None = None


class ChecklistOut(Schema):
    id: int
    item: str
    is_completed: bool
    position: int


class CommentIn(Schema):
    comment: str = Field(min_length=1, max_length=5000)


class CommentOut(Schema):
    id: int
    task_id: int
    comment: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    user: UserBrief


class TaskCreate(Schema):
    project_id: int
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    task_type: TaskType = "Development"
    assigned_to: int | None = None
    status: TaskStatus = "Todo"
    priority: Priority = "Medium"
    start_date: date | None = None
    due_date: date | None = None
    estimated_hours: float = Field(default=0, ge=0)
    tags: list[str] = []
    checklist: list[str] = []


class TaskUpdate(Schema):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    task_type: TaskType | None = None
    assigned_to: int | None = None
    status: TaskStatus | None = None
    priority: Priority | None = None
    start_date: date | None = None
    due_date: date | None = None
    estimated_hours: float | None = Field(default=None, ge=0)
    actual_hours: float | None = Field(default=None, ge=0)
    position: int | None = None
    tags: list[str] | None = None


class TaskMove(Schema):
    status: TaskStatus
    position: int | None = None


class TaskOut(Schema):
    id: int
    task_key: str
    project_id: int
    project_name: str
    title: str
    description: str | None
    task_type: str
    assigned_to: int | None
    assignee: UserBrief | None
    status: str
    priority: str
    start_date: date | None
    due_date: date | None
    estimated_hours: float
    actual_hours: float
    position: int
    tags: list[str]
    checklist: list[ChecklistOut]
    comment_count: int
    created_by: int | None
    is_overdue: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TaskDetailOut(TaskOut):
    comments: list[CommentOut] = []
    creator: UserBrief | None = None


# ---------- Milestones ----------
class MilestoneCreate(Schema):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    progress: int = Field(default=0, ge=0, le=100)
    status: MilestoneStatus | None = None


class MilestoneUpdate(Schema):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    start_date: date | None = None
    due_date: date | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    status: MilestoneStatus | None = None


class MilestoneOut(Schema):
    id: int
    project_id: int
    name: str
    description: str | None
    start_date: date | None
    due_date: date | None
    status: str
    progress: int
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------- Documents ----------
class DocumentOut(Schema):
    id: int
    project_id: int
    project_name: str
    task_id: int | None
    folder: str
    file_name: str
    file_type: str
    file_size: int
    file_url: str
    download_url: str
    version: int
    uploaded_at: datetime | None
    uploader: UserBrief | None


# ---------- Reviews ----------
class ReviewCreate(Schema):
    project_id: int
    review_stage: ReviewStage
    reviewer_id: int | None = None  # defaults to current user
    review_date: date
    technical_implementation_score: Score = 0
    documentation_score: Score = 0
    innovation_score: Score = 0
    presentation_score: Score = 0
    team_contribution_score: Score = 0
    feedback: str | None = None
    comments: str | None = None
    action_items: list[str] = []


class ReviewUpdate(Schema):
    review_stage: ReviewStage | None = None
    review_date: date | None = None
    technical_implementation_score: Score | None = None
    documentation_score: Score | None = None
    innovation_score: Score | None = None
    presentation_score: Score | None = None
    team_contribution_score: Score | None = None
    feedback: str | None = None
    comments: str | None = None
    action_items: list[str] | None = None


class ReviewOut(Schema):
    id: int
    project_id: int
    project_name: str
    review_stage: str
    review_date: date
    reviewer: UserBrief | None
    technical_implementation_score: int
    documentation_score: int
    innovation_score: int
    presentation_score: int
    team_contribution_score: int
    score: int
    feedback: str | None
    comments: str | None
    action_items: list[str]
    created_at: datetime | None = None


# ---------- Notifications / activity ----------
class NotificationOut(Schema):
    id: int
    message: str
    notification_type: str
    related_project_id: int | None
    related_task_id: int | None
    project_name: str | None = None
    is_read: bool
    created_at: datetime | None


class ActivityOut(Schema):
    id: int
    user: UserBrief | None
    action: str
    description: str
    project_id: int | None
    project_name: str | None = None
    task_id: int | None
    created_at: datetime | None


# ---------- Calendar ----------
class EventCreate(Schema):
    project_id: int
    title: str = Field(min_length=1, max_length=200)
    event_type: EventType
    event_date: date
    event_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    description: str | None = None


class EventUpdate(Schema):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    event_type: EventType | None = None
    event_date: date | None = None
    event_time: str | None = Field(default=None, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    description: str | None = None


class EventOut(Schema):
    id: int
    project_id: int
    title: str
    event_type: str
    event_date: date
    event_time: str | None
    description: str | None
    created_at: datetime | None = None


class CalendarItem(Schema):
    id: str  # "<type>-<id>" so ids are unique across sources
    source_id: int
    title: str
    type: str  # deadline | milestone | meeting | review | submission
    date: date
    time: str | None = None
    project_id: int
    project_name: str
    task_id: int | None = None


# ---------- Discussions ----------
class ThreadCreate(Schema):
    project_id: int
    title: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=5000)


class MessageCreate(Schema):
    message: str = Field(min_length=1, max_length=5000)


class MessageOut(Schema):
    id: int
    message: str
    created_at: datetime | None
    user: UserBrief | None


class ThreadOut(Schema):
    id: int
    project_id: int
    project_name: str
    title: str
    author: UserBrief | None
    message_count: int
    last_message: MessageOut | None
    participants: list[UserBrief]
    created_at: datetime | None
    updated_at: datetime | None


class ThreadDetailOut(ThreadOut):
    messages: list[MessageOut]


# ---------- Dashboard / search ----------
class DashboardOut(Schema):
    stats: dict[str, int]
    task_status_counts: dict[str, int]
    active_projects: list[ProjectOut]
    upcoming_deadlines: list[TaskOut]
    recent_activity: list[ActivityOut]


class SearchHit(Schema):
    id: int
    label: str
    sub: str | None = None
    project_id: int | None = None


class SearchOut(Schema):
    query: str
    projects: list[SearchHit] = []
    tasks: list[SearchHit] = []
    members: list[SearchHit] = []
    documents: list[SearchHit] = []
    milestones: list[SearchHit] = []
    comments: list[SearchHit] = []


class Message(Schema):
    detail: str


# ---------- Public user reviews (testimonials) ----------
class TestimonialIn(Schema):
    rating: int = Field(ge=1, le=5)
    title: str = Field(min_length=3, max_length=120)
    comment: str = Field(min_length=10, max_length=2000)


class TestimonialOut(Schema):
    id: int
    rating: int
    title: str
    comment: str
    author_name: str
    author_title: str | None
    author_tone: str
    created_at: datetime | None
    updated_at: datetime | None


class TestimonialSummary(Schema):
    count: int
    average: float
    distribution: dict[int, int]
    reviews: list[TestimonialOut]
