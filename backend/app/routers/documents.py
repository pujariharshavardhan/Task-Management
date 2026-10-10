import mimetypes
from pathlib import PurePath

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from .. import constants as C
from .. import schemas as S
from .. import storage
from ..config import get_settings
from ..database import get_db
from ..deps import accessible_project_ids, can_contribute, can_manage, get_current_user, project_role, require_project
from ..models import Document, Task, User
from ..services import commit, document_out, log_activity, notify, project_member_ids

router = APIRouter(prefix="/documents", tags=["Documents"])


def _get(db: Session, doc_id: int, user: User) -> tuple[Document, str]:
    d = db.get(Document, doc_id)
    role = project_role(d.project, user) if d else None
    if not d or role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return d, role


@router.get("", response_model=list[S.DocumentOut])
def list_documents(
    project_id: int | None = None,
    folder: str | None = None,
    task_id: int | None = None,
    q: str | None = None,
    limit: int = Query(200, le=1000),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    pids = accessible_project_ids(db, user)
    if project_id is not None:
        pids = [p for p in pids if p == project_id]
    query = db.query(Document).filter(Document.project_id.in_(pids)).options(selectinload(Document.project), selectinload(Document.uploader))
    if folder:
        query = query.filter(Document.folder == folder)
    if task_id:
        query = query.filter(Document.task_id == task_id)
    if q:
        query = query.filter(Document.file_name.ilike(f"%{q}%"))
    return [document_out(d) for d in query.order_by(Document.uploaded_at.desc(), Document.id.desc()).offset(offset).limit(limit).all()]


@router.get("/folders", summary="File counts per folder")
def folder_counts(project_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    pids = accessible_project_ids(db, user)
    if project_id is not None:
        pids = [p for p in pids if p == project_id]
    rows = dict(db.query(Document.folder, func.count(Document.id)).filter(Document.project_id.in_(pids)).group_by(Document.folder).all())
    return {f: rows.get(f, 0) for f in C.DOC_FOLDERS}


@router.post("", response_model=S.DocumentOut, status_code=201, summary="Upload a file (multipart). Same name in a project = new version")
async def upload_document(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    folder: str = Form("Other"),
    task_id: int | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project, _ = require_project(db, project_id, user, can_contribute, "upload files")
    if folder not in C.DOC_FOLDERS:
        raise HTTPException(422, f"folder must be one of: {', '.join(C.DOC_FOLDERS)}")
    if task_id is not None:
        task = db.get(Task, task_id)
        if not task or task.project_id != project.id:
            raise HTTPException(422, "Task does not belong to this project")

    data = await file.read()
    limit = get_settings().max_upload_mb * 1024 * 1024
    if len(data) > limit:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"File exceeds {get_settings().max_upload_mb} MB")
    if not data:
        raise HTTPException(422, "File is empty")

    name = PurePath(file.filename or "file").name
    ext = PurePath(name).suffix.lstrip(".").lower()
    if ext not in get_settings().allowed_upload_extensions:
        raise HTTPException(415, f"Files of type .{ext or '?'} are not allowed. Allowed: {', '.join(get_settings().allowed_upload_extensions)}")
    version = (db.query(func.max(Document.version)).filter(Document.project_id == project.id, Document.file_name == name).scalar() or 0) + 1
    key = storage.make_key(project.id, name)
    storage.save(key, data, file.content_type)

    doc = Document(
        project_id=project.id, task_id=task_id, uploaded_by=user.id, folder=folder, file_name=name,
        file_type=(PurePath(name).suffix.lstrip(".").upper() or "FILE")[:20], file_size=len(data),
        file_url="", storage_key=key, version=version,
    )
    db.add(doc)
    db.flush()
    doc.file_url = f"/api/v1/documents/{doc.id}/download"
    log_activity(db, user, "uploaded", name if version == 1 else f"{name} (v{version})", project.id, task_id)
    notify(db, project_member_ids(project), f'{user.name} uploaded "{name}"', "document", project.id, task_id, exclude=user.id)
    commit(db)
    db.refresh(doc)
    return document_out(doc)


@router.get("/{doc_id}", response_model=S.DocumentOut)
def get_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    d, _ = _get(db, doc_id, user)
    return document_out(d)


@router.get("/{doc_id}/download", summary="Download the file (local) or redirect to a presigned S3/MinIO URL")
def download_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    d, _ = _get(db, doc_id, user)
    if not d.storage_key:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This document has no stored file (demo data)")
    if get_settings().storage_backend == "s3":
        return RedirectResponse(storage.presigned_url(d.storage_key, d.file_name))
    path = storage.local_path(d.storage_key)
    if not path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File is missing from storage")
    return FileResponse(path, filename=d.file_name, media_type=mimetypes.guess_type(d.file_name)[0] or "application/octet-stream")


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    d, role = _get(db, doc_id, user)
    if d.uploaded_by != user.id and not can_manage(role):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the uploader or a manager can delete this file")
    storage.delete(d.storage_key)
    log_activity(db, user, "deleted", d.file_name, d.project_id)
    db.delete(d)
    commit(db)
    return Response(status_code=204)
