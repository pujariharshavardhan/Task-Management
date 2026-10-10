"""File storage: local disk (default) or S3 / MinIO (STORAGE_BACKEND=s3)."""
import uuid
from pathlib import Path

from .config import get_settings


def _safe_name(name: str) -> str:
    keep = "".join(c if c.isalnum() or c in "._- " else "_" for c in name).strip()
    return keep or "file"


def make_key(project_id: int, filename: str) -> str:
    return f"projects/{project_id}/{uuid.uuid4().hex[:12]}_{_safe_name(filename)}"


def _s3():
    import boto3

    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint_url,
        aws_access_key_id=s.s3_access_key or None,
        aws_secret_access_key=s.s3_secret_key or None,
        region_name=s.s3_region,
    )


def save(key: str, data: bytes, content_type: str | None = None) -> None:
    s = get_settings()
    if s.storage_backend == "s3":
        _s3().put_object(Bucket=s.s3_bucket, Key=key, Body=data, ContentType=content_type or "application/octet-stream")
        return
    path = Path(s.upload_dir) / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def delete(key: str | None) -> None:
    if not key:
        return
    s = get_settings()
    if s.storage_backend == "s3":
        _s3().delete_object(Bucket=s.s3_bucket, Key=key)
        return
    (Path(s.upload_dir) / key).unlink(missing_ok=True)


def local_path(key: str) -> Path | None:
    path = Path(get_settings().upload_dir) / key
    return path if path.is_file() else None


def presigned_url(key: str, filename: str, expires: int = 300) -> str:
    s = get_settings()
    return _s3().generate_presigned_url(
        "get_object",
        Params={"Bucket": s.s3_bucket, "Key": key, "ResponseContentDisposition": f'attachment; filename="{filename}"'},
        ExpiresIn=expires,
    )
