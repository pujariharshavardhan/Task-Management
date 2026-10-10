from datetime import date, timedelta

from conftest import login

API = "/api/v1"
TODAY = date.today()


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


# ---------- auth ----------
def test_register_login_me(client):
    r = client.post(f"{API}/auth/register", json={"name": "Nisha", "email": "nisha@apms.edu", "password": "secret12"})
    assert r.status_code == 201
    token = r.json()["accessToken"]
    me = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    assert me["email"] == "nisha@apms.edu" and me["role"] == "Project Owner"
    assert client.post(f"{API}/auth/register", json={"name": "x", "email": "nisha@apms.edu", "password": "secret12"}).status_code == 409
    assert client.post(f"{API}/auth/login", json={"email": "nisha@apms.edu", "password": "wrong!!"}).status_code == 401
    assert client.post(f"{API}/auth/token", data={"username": "nisha@apms.edu", "password": "secret12"}).status_code == 200


def test_requires_auth(client):
    assert client.get(f"{API}/projects").status_code == 401
    assert client.get(f"{API}/projects", headers={"Authorization": "Bearer junk"}).status_code == 401


def test_new_user_sees_no_projects(client):
    h = login(client, "nisha@apms.edu", "secret12")
    assert client.get(f"{API}/projects", headers=h).json() == []


# ---------- dashboard / projects ----------
def test_dashboard(client, harsha):
    d = client.get(f"{API}/dashboard", headers=harsha).json()
    assert d["stats"]["totalProjects"] == 8
    assert d["stats"]["completedProjects"] == 3
    assert sum(d["taskStatusCounts"].values()) == 23
    assert d["activeProjects"] and d["upcomingDeadlines"] and d["recentActivity"]


def test_project_filters(client, harsha):
    get = lambda **p: client.get(f"{API}/projects", headers=harsha, params=p).json()
    assert len(get(filter="archived")) == 1
    assert all(p["status"] == "Completed" for p in get(filter="completed"))
    assert len(get(q="chatbot")) == 1
    p = get(q="APMS-2026-001")[0]
    assert p["myRole"] == "Project Owner" and p["taskCount"] == 8 and p["owner"]["name"] == "Harsha"


def test_project_crud_and_members(client, harsha, rahul, ids):
    priya = ids["users"]["priya@apms.edu"]
    body = {"name": "Smart Canteen", "projectType": "Mini Project", "description": "Order food from class.",
            "startDate": str(TODAY), "endDate": str(TODAY + timedelta(days=60)), "priority": "High",
            "techStack": ["React", "FastAPI"], "members": [{"userId": priya, "role": "Developer"}]}
    r = client.post(f"{API}/projects", headers=harsha, json=body)
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["projectCode"].startswith(f"APMS-{TODAY.year}-") and p["members"][0]["user"]["name"] == "Priya"

    # bad dates / bad enum
    assert client.post(f"{API}/projects", headers=harsha, json={**body, "endDate": str(TODAY - timedelta(days=1))}).status_code == 422
    assert client.post(f"{API}/projects", headers=harsha, json={**body, "priority": "Urgent"}).status_code == 422

    pid = p["id"]
    rahul_id = ids["users"]["rahul@apms.edu"]
    # rahul can't see it until added
    assert client.get(f"{API}/projects/{pid}", headers=rahul).status_code == 404
    assert client.post(f"{API}/projects/{pid}/members", headers=harsha, json={"userId": rahul_id, "role": "Viewer"}).status_code == 201
    assert client.get(f"{API}/projects/{pid}", headers=rahul).json()["myRole"] == "Viewer"
    assert client.patch(f"{API}/projects/{pid}", headers=rahul, json={"name": "hack"}).status_code == 403
    # owner changes role -> rahul becomes manager
    assert client.patch(f"{API}/projects/{pid}/members/{rahul_id}", headers=harsha, json={"role": "Project Manager"}).json()["role"] == "Project Manager"
    assert client.patch(f"{API}/projects/{pid}", headers=rahul, json={"status": "In Progress"}).status_code == 200
    # only owner archives / deletes
    assert client.patch(f"{API}/projects/{pid}", headers=rahul, json={"isArchived": True}).status_code == 403
    assert client.delete(f"{API}/projects/{pid}", headers=rahul).status_code == 403
    assert client.patch(f"{API}/projects/{pid}", headers=harsha, json={"status": "Completed"}).json()["actualCompletionDate"] == str(TODAY)
    assert client.delete(f"{API}/projects/{pid}/members/{p['ownerId']}", headers=harsha).status_code == 400
    assert client.delete(f"{API}/projects/{pid}", headers=harsha).status_code == 204
    assert client.get(f"{API}/projects/{pid}", headers=harsha).status_code == 404


# ---------- tasks ----------
def test_task_lifecycle(client, harsha, rahul, ids):
    apms = ids["projects"]["APMS-2026-001"]
    rahul_id = ids["users"]["rahul@apms.edu"]
    r = client.post(f"{API}/tasks", headers=harsha, json={
        "projectId": apms["id"], "title": "Seed script", "assignedTo": rahul_id, "priority": "High",
        "dueDate": str(TODAY + timedelta(days=3)), "tags": ["#Backend", "db", "db"], "checklist": ["Write", "Test"]})
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["taskKey"].startswith("TASK-") and t["tags"] == ["backend", "db"] and len(t["checklist"]) == 2

    # rahul got an "assigned" notification
    notes = client.get(f"{API}/notifications", headers=rahul).json()
    assert any(n["notificationType"] == "assigned" and n["relatedTaskId"] == t["id"] for n in notes)

    # assignee may move status, tick checklist, log hours, comment — but not retitle
    assert client.patch(f"{API}/tasks/{t['id']}", headers=rahul, json={"title": "x"}).status_code == 403
    assert client.post(f"{API}/tasks/{t['id']}/move", headers=rahul, json={"status": "In Progress", "position": 0}).json()["status"] == "In Progress"
    item = t["checklist"][0]["id"]
    assert client.patch(f"{API}/tasks/{t['id']}/checklist/{item}", headers=rahul, json={"isCompleted": True}).json()["isCompleted"]
    assert client.patch(f"{API}/tasks/{t['id']}", headers=rahul, json={"actualHours": 2.5}).json()["actualHours"] == 2.5
    c = client.post(f"{API}/tasks/{t['id']}/comments", headers=rahul, json={"comment": "Started"}).json()
    assert c["user"]["name"] == "Rahul"
    assert client.patch(f"{API}/comments/{c['id']}", headers=harsha, json={"comment": "edit"}).status_code == 403

    # completing a task notifies the owner and recomputes project progress
    before = client.get(f"{API}/projects/{apms['id']}", headers=harsha).json()
    client.patch(f"{API}/tasks/{t['id']}", headers=rahul, json={"status": "Done"})
    after = client.get(f"{API}/projects/{apms['id']}", headers=harsha).json()
    assert after["doneCount"] == before["doneCount"] + 1
    assert after["progress"] == round(after["doneCount"] * 100 / after["taskCount"])
    assert any(n["notificationType"] == "completed" for n in client.get(f"{API}/notifications", headers=harsha).json())

    detail = client.get(f"{API}/tasks/{t['id']}", headers=harsha).json()
    assert detail["commentCount"] == 1 and detail["comments"][0]["comment"] == "Started"
    assert client.delete(f"{API}/tasks/{t['id']}", headers=rahul).status_code == 403
    assert client.delete(f"{API}/tasks/{t['id']}", headers=harsha).status_code == 204


def test_task_filters(client, harsha):
    get = lambda **p: client.get(f"{API}/tasks", headers=harsha, params=p).json()
    assert all(t["isOverdue"] for t in get(overdue=True))
    assert all(t["status"] == "Review" for t in get(status="Review"))
    assert any(t["title"] == "API" for t in get(q="fastapi"))  # tag search
    assert client.post(f"{API}/tasks", headers=harsha, json={"projectId": 1, "title": "x", "assignedTo": 99999}).status_code == 422


# ---------- milestones / calendar / events ----------
def test_milestones_and_calendar(client, harsha, mentor, ids):
    pid = ids["projects"]["APMS-2026-001"]["id"]
    ms = client.get(f"{API}/projects/{pid}/milestones", headers=harsha).json()
    assert [m["name"] for m in ms][:2] == ["Requirement Analysis", "UI/UX Design"]
    testing = next(m for m in ms if m["name"] == "Testing")
    assert client.patch(f"{API}/milestones/{testing['id']}", headers=harsha, json={"progress": 40}).json()["status"] == "In Progress"
    assert client.patch(f"{API}/milestones/{testing['id']}", headers=mentor, json={"progress": 50}).status_code == 403

    ev = client.post(f"{API}/events", headers=mentor, json={"projectId": pid, "title": "Review 3", "eventType": "review", "eventDate": str(TODAY + timedelta(days=2)), "eventTime": "14:00"})
    assert ev.status_code == 201
    assert client.post(f"{API}/events", headers=mentor, json={"projectId": pid, "title": "x", "eventType": "party", "eventDate": str(TODAY)}).status_code == 422

    cal = client.get(f"{API}/calendar", headers=harsha, params={"start": str(TODAY - timedelta(days=40)), "end": str(TODAY + timedelta(days=60))}).json()
    assert {"deadline", "milestone", "meeting", "review", "submission"} <= {i["type"] for i in cal}
    only = client.get(f"{API}/calendar", headers=harsha, params={"types": "meeting", "project_id": pid}).json()
    assert only and all(i["type"] == "meeting" and i["projectId"] == pid for i in only)


# ---------- documents ----------
def test_document_upload_versions_download(client, harsha, rahul, ids):
    pid = ids["projects"]["APMS-2026-001"]["id"]
    up = lambda h, content=b"%PDF-1.4 demo": client.post(f"{API}/documents", headers=h, data={"project_id": pid, "folder": "Reports"}, files={"file": ("Weekly Report 5.pdf", content, "application/pdf")})
    d1 = up(harsha).json()
    d2 = up(rahul, b"%PDF-1.4 v2").json()
    assert d1["version"] == 1 and d2["version"] == 2 and d2["fileType"] == "PDF"
    dl = client.get(d2["downloadUrl"], headers=harsha)
    assert dl.status_code == 200 and dl.content == b"%PDF-1.4 v2"
    assert client.post(f"{API}/documents", headers=harsha, data={"project_id": pid, "folder": "Nope"}, files={"file": ("a.txt", b"x")}).status_code == 422
    assert client.get(f"{API}/documents/folders", headers=harsha, params={"project_id": pid}).json()["Reports"] >= 3
    assert client.delete(f"{API}/documents/{d1['id']}", headers=rahul).status_code == 403  # not uploader, not manager
    assert client.delete(f"{API}/documents/{d2['id']}", headers=rahul).status_code == 204


# ---------- reviews ----------
def test_reviews(client, harsha, mentor, rahul, ids):
    pid = ids["projects"]["APMS-2026-001"]["id"]
    body = {"projectId": pid, "reviewStage": "Review 3", "reviewDate": str(TODAY), "technicalImplementationScore": 18,
            "documentationScore": 16, "innovationScore": 17, "presentationScore": 15, "teamContributionScore": 19,
            "feedback": "Solid", "actionItems": ["Add tests"]}
    r = client.post(f"{API}/reviews", headers=mentor, json=body)
    assert r.status_code == 201 and r.json()["score"] == 85
    assert client.post(f"{API}/reviews", headers=rahul, json=body).status_code == 403  # developers can't review
    assert client.post(f"{API}/reviews", headers=mentor, json={**body, "innovationScore": 25}).status_code == 422
    assert client.patch(f"{API}/reviews/{r.json()['id']}", headers=mentor, json={"presentationScore": 20}).json()["score"] == 90
    summary = client.get(f"{API}/reviews/summary", headers=harsha).json()
    assert summary["totalReviews"] == 5 and summary["topScore"] == 90


# ---------- discussions ----------
def test_discussions(client, harsha, rahul, ids):
    pid = ids["projects"]["APMS-2026-001"]["id"]
    th = client.post(f"{API}/discussions", headers=harsha, json={"projectId": pid, "title": "Deploy plan", "message": "Docker or VM?"}).json()
    assert th["messageCount"] == 1
    client.post(f"{API}/discussions/{th['id']}/messages", headers=rahul, json={"message": "Docker"})
    full = client.get(f"{API}/discussions/{th['id']}", headers=harsha).json()
    assert [m["message"] for m in full["messages"]] == ["Docker or VM?", "Docker"]
    assert len(full["participants"]) == 2
    assert client.get(f"{API}/discussions", headers=harsha).json()[0]["id"] == th["id"]  # newest activity first


# ---------- notifications ----------
def test_notifications(client, harsha):
    count = client.get(f"{API}/notifications/unread-count", headers=harsha).json()["count"]
    assert count > 0
    first = client.get(f"{API}/notifications", headers=harsha, params={"unread_only": True}).json()[0]
    assert client.patch(f"{API}/notifications/{first['id']}/read", headers=harsha).json()["isRead"]
    client.post(f"{API}/notifications/read-all", headers=harsha)
    assert client.get(f"{API}/notifications/unread-count", headers=harsha).json()["count"] == 0
    assert client.post(f"{API}/notifications/run-deadline-check", headers=harsha).status_code == 200


def test_websocket_push(client, harsha, rahul, ids):
    token = rahul["Authorization"].split()[1]
    pid = ids["projects"]["APMS-2026-001"]["id"]
    with client.websocket_connect(f"{API}/ws/notifications?token={token}") as ws:
        client.post(f"{API}/tasks", headers=harsha, json={"projectId": pid, "title": "Realtime check", "assignedTo": ids["users"]["rahul@apms.edu"]})
        msg = ws.receive_json()
        assert msg["type"] == "notification" and "Realtime check" in msg["data"]["message"]


# ---------- team / users / search ----------
def test_team_and_invite(client, harsha, rahul, ids):
    team = client.get(f"{API}/team", headers=harsha).json()
    sai = next(m for m in team if m["user"]["name"] == "Sai")
    assert sai["totalTasks"] == 4 and "Developer" in sai["roles"]
    pid = ids["projects"]["ELIB-2026-006"]["id"]
    inv = client.post(f"{API}/users/invite", headers=harsha, json={"name": "Kavya", "email": "kavya@apms.edu", "projectId": pid, "projectRole": "Student"})
    assert inv.status_code == 201 and inv.json()["temporaryPassword"]
    kavya = login(client, "kavya@apms.edu", inv.json()["temporaryPassword"])
    assert [p["projectCode"] for p in client.get(f"{API}/projects", headers=kavya).json()] == ["ELIB-2026-006"]
    assert client.post(f"{API}/users/invite", headers=rahul, json={"name": "x", "email": "x@apms.edu", "projectId": pid}).status_code == 404


def test_profile_and_password(client):
    h = login(client, "kiran@apms.edu")
    assert client.patch(f"{API}/users/me", headers=h, json={"title": "QA Lead", "avatarTone": "mint"}).json()["title"] == "QA Lead"
    assert client.post(f"{API}/users/me/password", headers=h, json={"currentPassword": "nope", "newPassword": "newpass1"}).status_code == 400
    assert client.post(f"{API}/users/me/password", headers=h, json={"currentPassword": "password", "newPassword": "newpass1"}).status_code == 200
    login(client, "kiran@apms.edu", "newpass1")


def test_search(client, harsha):
    s = client.get(f"{API}/search", headers=harsha, params={"q": "voice"}).json()
    assert [p["label"] for p in s["projects"]] == ["Voice Agent"]
    assert {"Implement STT", "Implement TTS"} <= {t["label"] for t in s["tasks"]}
    assert any(d["label"] == "Voice Architecture.pdf" for d in s["documents"])


def test_activity(client, harsha):
    acts = client.get(f"{API}/activity", headers=harsha, params={"limit": 5}).json()
    assert len(acts) == 5 and acts[0]["createdAt"] >= acts[-1]["createdAt"]


# ---------- reports ----------
def test_reports_and_exports(client, harsha):
    kinds = [r["key"] for r in client.get(f"{API}/reports", headers=harsha).json()]
    assert len(kinds) == 8
    for k in kinds:
        rep = client.get(f"{API}/reports/{k}", headers=harsha)
        assert rep.status_code == 200, k
        assert set(rep.json()["metrics"]) == {"overallProgress", "totalTasks", "completedTasks", "pendingTasks", "onTimeTasks", "delayedTasks"}
    csv_ = client.get(f"{API}/reports/team-workload/export", headers=harsha, params={"format": "csv"})
    assert csv_.status_code == 200 and "Member" in csv_.text
    xlsx = client.get(f"{API}/reports/project-progress/export", headers=harsha, params={"format": "xlsx"})
    assert xlsx.content[:2] == b"PK"
    pdf = client.get(f"{API}/reports/delayed-tasks/export", headers=harsha, params={"format": "pdf"})
    assert pdf.content[:4] == b"%PDF"
    risks = client.get(f"{API}/insights/risks", headers=harsha).json()
    assert any(f["kind"] == "overdue_task" for f in risks["findings"])


# ---------- hardening (Step 1: security) ----------
def test_security_headers(client):
    h = client.get("/health").headers
    assert h["x-content-type-options"] == "nosniff" and h["x-frame-options"] == "DENY"
    assert "strict-origin" in h["referrer-policy"] and "camera=()" in h["permissions-policy"]


def test_https_redirect_and_hsts(client):
    from app.config import get_settings

    s = get_settings()
    s.force_https = True
    try:
        r = client.get("http://apms.example.com/health", follow_redirects=False)
        assert r.status_code == 308 and r.headers["location"].startswith("https://apms.example.com/health")
        r = client.get("https://apms.example.com/health")
        assert r.status_code == 200 and "max-age=" in r.headers["strict-transport-security"]
        assert client.get("http://localhost/health").status_code == 200  # local dev is never redirected
    finally:
        s.force_https = False


def test_unknown_api_route_is_json_404(client):
    r = client.get(f"{API}/nope")
    assert r.status_code == 404 and r.json()["detail"].startswith("Not found")


def test_password_policy(client):
    weak = client.post(f"{API}/auth/register", json={"name": "Weak", "email": "weak@apms.edu", "password": "abcdefgh"})
    assert weak.status_code == 422 and "letter and a number" in weak.text


def test_upload_type_allowlist(client, harsha, ids):
    pid = ids["projects"]["APMS-2026-001"]["id"]
    r = client.post(f"{API}/documents", headers=harsha, data={"project_id": pid, "folder": "Other"}, files={"file": ("tool.exe", b"MZ")})
    assert r.status_code == 415


def test_login_rate_limit(client):
    from app.hardening import limiter

    codes = [client.post(f"{API}/auth/login", json={"email": "brute@apms.edu", "password": "wrong-123"}).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10 and codes[10] == 429
    limiter.hits.clear()


# ---------- public user reviews (Step 2.8) ----------
def test_testimonials(client, harsha, rahul):
    assert client.get(f"{API}/testimonials").json()["count"] == 0  # public, no token
    assert client.put(f"{API}/testimonials/mine", json={"rating": 5, "title": "Great", "comment": "too short"}).status_code == 401
    assert client.put(f"{API}/testimonials/mine", headers=harsha, json={"rating": 6, "title": "Great", "comment": "Plenty long comment"}).status_code == 422
    assert client.put(f"{API}/testimonials/mine", headers=harsha, json={"rating": 5, "title": "Great tool", "comment": "Keeps our final-year project on track."}).status_code == 200
    client.put(f"{API}/testimonials/mine", headers=rahul, json={"rating": 4, "title": "Useful", "comment": "Kanban and reviews in one place."})
    # editing replaces, never duplicates
    client.put(f"{API}/testimonials/mine", headers=harsha, json={"rating": 4, "title": "Great tool", "comment": "Keeps our final-year project on track."})
    s = client.get(f"{API}/testimonials").json()
    assert s["count"] == 2 and s["average"] == 4.0 and s["distribution"]["4"] == 2
    assert {r["authorName"] for r in s["reviews"]} == {"Harsha", "Rahul"}
    assert client.delete(f"{API}/testimonials/mine", headers=rahul).status_code == 204
    assert client.get(f"{API}/testimonials").json()["count"] == 1
