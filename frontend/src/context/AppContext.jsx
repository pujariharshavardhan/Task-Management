import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, downloadFile, setUnauthorizedHandler, token, wsUrl } from '../lib/api'

// All data lives in the database and is loaded through the REST API (backend/app).
// API payloads are mapped to the shapes the pages use.
const AppContext = createContext(null)

const fmtBytes = (b = 0) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

// ---------- API → UI mappers ----------
const mapUser = (u) => u && ({ id: u.id, name: u.name, email: u.email, role: u.role, title: u.title, tone: u.avatarTone || 'primary', notificationPrefs: u.notificationPrefs || null })
const mapProject = (p) => ({
  id: p.id, name: p.name, code: p.projectCode, type: p.projectType, description: p.description,
  college: p.college, department: p.department, academicYear: p.academicYear, semester: p.semester, batch: p.batch, course: p.course,
  guideId: p.guideId, startDate: p.startDate, endDate: p.endDate, actualCompletionDate: p.actualCompletionDate,
  priority: p.priority, status: p.status, progress: p.progress, ownerId: p.ownerId, archived: p.isArchived, tech: p.techStack || [],
  members: (p.members || []).map((m) => ({ userId: m.userId, role: m.role })), myRole: p.myRole,
})
const mapComment = (c) => ({ id: c.id, userId: c.user?.id, text: c.comment, at: c.createdAt })
const mapTask = (t) => ({
  id: t.id, key: t.taskKey, projectId: t.projectId, title: t.title, description: t.description || '', type: t.taskType,
  assignedTo: t.assignedTo, status: t.status, priority: t.priority, startDate: t.startDate, dueDate: t.dueDate,
  estimatedHours: t.estimatedHours, actualHours: t.actualHours, position: t.position, tags: t.tags || [],
  checklist: (t.checklist || []).map((c) => ({ id: c.id, item: c.item, done: c.isCompleted })),
  comments: t.comments ? t.comments.map(mapComment) : null, commentCount: t.commentCount ?? 0, createdBy: t.createdBy,
})
const mapMilestone = (m) => ({ id: m.id, projectId: m.projectId, name: m.name, description: m.description, startDate: m.startDate, dueDate: m.dueDate, status: m.status, progress: m.progress })
const mapDocument = (d) => ({
  id: d.id, projectId: d.projectId, taskId: d.taskId, folder: d.folder, name: d.fileName, type: d.fileType, size: fmtBytes(d.fileSize),
  uploadedBy: d.uploader?.id, uploadedAt: d.uploadedAt, version: d.version,
})
const mapReview = (r) => ({
  id: r.id, projectId: r.projectId, stage: r.reviewStage, reviewerId: r.reviewer?.id, date: r.reviewDate,
  scores: { technical: r.technicalImplementationScore, documentation: r.documentationScore, innovation: r.innovationScore, presentation: r.presentationScore, team: r.teamContributionScore },
  feedback: r.feedback, actionItems: r.actionItems || [],
})
const mapNotification = (n) => ({ id: n.id, type: n.notificationType, message: n.message, projectId: n.relatedProjectId, taskId: n.relatedTaskId, read: n.isRead, at: n.createdAt })
const mapActivity = (a) => ({ id: a.id, userId: a.user?.id, action: a.action, object: a.description, projectId: a.projectId, taskId: a.taskId, at: a.createdAt })
const mapEvent = (e) => ({ id: e.id, title: e.title, type: e.eventType, date: e.eventDate, time: e.eventTime, projectId: e.projectId })
const mapMessage = (m) => ({ id: m.id, userId: m.user?.id, text: m.message, at: m.createdAt })
const mapThread = (th) => ({
  id: th.id, projectId: th.projectId, title: th.title, authorId: th.author?.id, createdAt: th.createdAt, updatedAt: th.updatedAt,
  messageCount: th.messageCount, participants: (th.participants || []).map((u) => u.id), last: th.lastMessage ? mapMessage(th.lastMessage) : null,
  messages: th.messages ? th.messages.map(mapMessage) : null,
})

// ---------- UI → API ----------
const projectBody = (d) => {
  const map = {
    name: 'name', code: 'projectCode', type: 'projectType', description: 'description', college: 'college', department: 'department',
    academicYear: 'academicYear', semester: 'semester', batch: 'batch', course: 'course', guideId: 'guideId', startDate: 'startDate',
    endDate: 'endDate', actualCompletionDate: 'actualCompletionDate', priority: 'priority', status: 'status', progress: 'progress',
    tech: 'techStack', archived: 'isArchived',
  }
  const out = {}
  for (const [k, v] of Object.entries(d)) if (k in map) out[map[k]] = v === '' ? null : v
  if (d.members) out.members = d.members.map((m) => ({ userId: m.userId, role: m.role }))
  return out
}
const taskBody = (d) => {
  const map = { projectId: 'projectId', title: 'title', description: 'description', type: 'taskType', assignedTo: 'assignedTo', status: 'status', priority: 'priority', startDate: 'startDate', dueDate: 'dueDate', estimatedHours: 'estimatedHours', actualHours: 'actualHours', position: 'position', tags: 'tags' }
  const out = {}
  for (const [k, v] of Object.entries(d)) if (k in map) out[map[k]] = v === '' ? null : v
  if (out.assignedTo !== undefined && out.assignedTo !== null) out.assignedTo = Number(out.assignedTo)
  if (out.projectId !== undefined) out.projectId = Number(out.projectId)
  return out
}

const sameId = (a, b) => a != null && b != null && String(a) === String(b)
const upsert = (list, item) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list])

let toastSeq = 0

export function AppProvider({ children }) {
  const [me, setMe] = useState(null)
  const [booting, setBooting] = useState(() => !!token.get())
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [milestones, setMilestones] = useState([])
  const [documents, setDocuments] = useState([])
  const [reviews, setReviews] = useState([])
  const [notifications, setNotifications] = useState([])
  const [activities, setActivities] = useState([])
  const [events, setEvents] = useState([])
  const [discussions, setDiscussions] = useState([])
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, tone = 'mint', ms = 3000) => {
    const id = ++toastSeq
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms)
  }, [])

  /** Run an API call; on failure show the server's message and return null. */
  const run = useCallback(async (fn, okMessage) => {
    try {
      const res = await fn()
      if (okMessage) toast(okMessage)
      return res ?? true
    } catch (e) {
      toast(e.message || 'Something went wrong', 'rose', 4500)
      return null
    }
  }, [toast])

  const clearData = () => {
    setUsers([]); setProjects([]); setTasks([]); setMilestones([]); setDocuments([]); setReviews([])
    setNotifications([]); setActivities([]); setEvents([]); setDiscussions([])
  }

  const logout = useCallback(() => {
    token.clear()
    setMe(null)
    clearData()
  }, [])

  useEffect(() => { setUnauthorizedHandler(logout) }, [logout])

  // ---------- loading ----------
  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [u, active, archived, t, ms, docs, rev, notes, acts, evs, threads] = await Promise.all([
        api.get('/users', { limit: 500 }), api.get('/projects', { filter: 'all', limit: 500 }), api.get('/projects', { filter: 'archived', limit: 500 }),
        api.get('/tasks', { limit: 1000 }), api.get('/milestones'), api.get('/documents', { limit: 1000 }), api.get('/reviews'),
        api.get('/notifications', { limit: 100 }), api.get('/activity', { limit: 100 }), api.get('/events'), api.get('/discussions'),
      ])
      setUsers(u.map(mapUser))
      setProjects([...active, ...archived].map(mapProject))
      setTasks(t.map(mapTask))
      setMilestones(ms.map(mapMilestone))
      setDocuments(docs.map(mapDocument))
      setReviews(rev.map(mapReview))
      setNotifications(notes.map(mapNotification))
      setActivities(acts.map(mapActivity))
      setEvents(evs.map(mapEvent))
      setDiscussions(threads.map(mapThread))
    } catch (e) {
      if (e.status !== 401) toast(e.message, 'rose', 5000)
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Restore the session on page load
  useEffect(() => {
    if (!token.get()) return
    api.get('/auth/me')
      .then((u) => { setMe(mapUser(u)); return loadAll() })
      .catch(() => token.clear())
      .finally(() => setBooting(false))
  }, [loadAll])

  // Light refresh of feeds that the server updates as side effects (activity log, notifications)
  const feedTimer = useRef()
  const refreshFeeds = useCallback(() => {
    clearTimeout(feedTimer.current)
    feedTimer.current = setTimeout(async () => {
      try {
        const [acts, notes] = await Promise.all([api.get('/activity', { limit: 100 }), api.get('/notifications', { limit: 100 })])
        setActivities(acts.map(mapActivity))
        setNotifications(notes.map(mapNotification))
      } catch { /* non-critical */ }
    }, 600)
  }, [])

  const refreshProject = useCallback(async (id) => {
    try { const p = await api.get(`/projects/${id}`); setProjects((ps) => upsert(ps, mapProject(p))) } catch { /* ignore */ }
  }, [])

  // ---------- real-time notifications (WebSocket) ----------
  useEffect(() => {
    if (!me) return
    let ws, retry, closed = false
    const connect = () => {
      ws = new WebSocket(wsUrl(`/ws/notifications?token=${encodeURIComponent(token.get() || '')}`))
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data)
          if (msg.type === 'notification') {
            const n = mapNotification(msg.data)
            setNotifications((ns) => (ns.some((x) => x.id === n.id) ? ns : [n, ...ns]))
            toast(n.message, 'accent', 4000)
          }
        } catch { /* ignore */ }
      }
      ws.onclose = () => { if (!closed) retry = setTimeout(connect, 5000) }
    }
    connect()
    const ping = setInterval(() => ws?.readyState === 1 && ws.send('ping'), 25000)
    return () => { closed = true; clearTimeout(retry); clearInterval(ping); ws?.close() }
  }, [me, toast])

  // ---------- actions ----------
  const milestoneTimers = useRef({})

  const actions = {
    // Auth
    login: async (email, password) => {
      const res = await api.post('/auth/login', { email, password })
      token.set(res.accessToken)
      setMe(mapUser(res.user))
      loadAll()
    },
    register: async (name, email, password) => {
      const res = await api.post('/auth/register', { name, email, password })
      token.set(res.accessToken)
      setMe(mapUser(res.user))
      loadAll()
    },
    logout,
    reload: loadAll,
    updateProfile: (patch) => run(async () => {
      const u = mapUser(await api.patch('/users/me', { name: patch.name, title: patch.title, avatarTone: patch.tone, notificationPrefs: patch.notificationPrefs }))
      setMe(u)
      setUsers((us) => upsert(us, u))
      return u
    }),
    changePassword: (currentPassword, newPassword) => run(() => api.post('/users/me/password', { currentPassword, newPassword }), 'Password updated'),

    // Projects
    addProject: (data) => run(async () => {
      const p = mapProject(await api.post('/projects', projectBody(data)))
      setProjects((ps) => [p, ...ps])
      refreshFeeds()
      return p.id
    }),
    updateProject: (id, patch) => run(async () => {
      const p = mapProject(await api.patch(`/projects/${id}`, projectBody(patch)))
      setProjects((ps) => upsert(ps, p))
      refreshFeeds()
      return p
    }),
    deleteProject: (id) => run(async () => {
      await api.del(`/projects/${id}`)
      setProjects((ps) => ps.filter((p) => p.id !== id))
      setTasks((ts) => ts.filter((t) => t.projectId !== id))
      setMilestones((ms) => ms.filter((m) => m.projectId !== id))
      setDocuments((ds) => ds.filter((d) => d.projectId !== id))
      setReviews((rs) => rs.filter((r) => r.projectId !== id))
      setDiscussions((th) => th.filter((t) => t.projectId !== id))
      setEvents((es) => es.filter((e) => e.projectId !== id))
      return true
    }),
    addMember: (projectId, userId, role) => run(async () => {
      await api.post(`/projects/${projectId}/members`, { userId: Number(userId), role })
      await refreshProject(projectId)
      refreshFeeds()
    }, 'Member added'),
    removeMember: (projectId, userId) => run(async () => {
      await api.del(`/projects/${projectId}/members/${userId}`)
      await refreshProject(projectId)
      refreshFeeds()
    }, 'Member removed'),
    changeMemberRole: (projectId, userId, role) => run(async () => {
      await api.patch(`/projects/${projectId}/members/${userId}`, { role })
      await refreshProject(projectId)
    }, 'Role updated'),
    /** Creates the account (if new) and optionally adds it to a project. Returns { user, temporaryPassword }. */
    inviteUser: ({ name, email, title, role, projectId, projectRole }) => run(async () => {
      const res = await api.post('/users/invite', { name, email, title: title || null, role: role || 'Student', projectId: projectId ? Number(projectId) : null, projectRole: projectRole || null })
      const u = mapUser(res.user)
      setUsers((us) => upsert(us, u))
      if (projectId) await refreshProject(projectId)
      refreshFeeds()
      return { user: u, temporaryPassword: res.temporaryPassword }
    }),

    // Tasks
    addTask: (data) => run(async () => {
      const t = mapTask(await api.post('/tasks', taskBody(data)))
      setTasks((ts) => [t, ...ts])
      refreshProject(t.projectId)
      refreshFeeds()
      return t.id
    }, 'Task created'),
    /** Optimistic update; reverts if the server rejects it. */
    updateTask: async (id, patch) => {
      const before = tasks.find((t) => t.id === id)
      setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      const res = await run(() => api.patch(`/tasks/${id}`, taskBody(patch)))
      if (!res) {
        if (before) setTasks((ts) => ts.map((t) => (t.id === id ? before : t)))
        return null
      }
      const t = mapTask(res)
      setTasks((ts) => ts.map((x) => (x.id === id ? t : x)))
      if (patch.status && before && patch.status !== before.status) refreshProject(t.projectId)
      refreshFeeds()
      return t
    },
    loadTask: async (id) => {
      try {
        const t = mapTask(await api.get(`/tasks/${id}`))
        setTasks((ts) => upsert(ts, t))
        return t
      } catch { return null }
    },
    deleteTask: (id) => run(async () => {
      const t = tasks.find((x) => x.id === id)
      await api.del(`/tasks/${id}`)
      setTasks((ts) => ts.filter((x) => x.id !== id))
      if (t) refreshProject(t.projectId)
      refreshFeeds()
      return true
    }),
    addChecklistItem: (taskId, item) => run(async () => {
      const c = await api.post(`/tasks/${taskId}/checklist`, { item })
      setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, checklist: [...t.checklist, { id: c.id, item: c.item, done: c.isCompleted }] } : t)))
    }),
    toggleChecklistItem: async (taskId, itemId, done) => {
      const flip = (v) => setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, checklist: t.checklist.map((c) => (c.id === itemId ? { ...c, done: v } : c)) } : t)))
      flip(done)
      if (!(await run(() => api.patch(`/tasks/${taskId}/checklist/${itemId}`, { isCompleted: done })))) flip(!done)
    },
    addComment: (taskId, text) => run(async () => {
      const c = mapComment(await api.post(`/tasks/${taskId}/comments`, { comment: text }))
      setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, comments: [...(t.comments || []), c], commentCount: (t.commentCount || 0) + 1 } : t)))
      refreshFeeds()
    }),

    // Milestones
    addMilestone: (data) => run(async () => {
      const m = mapMilestone(await api.post(`/projects/${data.projectId}/milestones`, { name: data.name, description: data.description || null, startDate: data.startDate || null, dueDate: data.dueDate || null }))
      setMilestones((ms) => [...ms, m])
      refreshFeeds()
    }, 'Milestone added'),
    /** Progress sliders fire continuously, so saves are debounced per milestone. */
    updateMilestone: (id, patch) => {
      setMilestones((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)))
      clearTimeout(milestoneTimers.current[id])
      milestoneTimers.current[id] = setTimeout(async () => {
        const res = await run(() => api.patch(`/milestones/${id}`, patch))
        if (res) { setMilestones((ms) => ms.map((m) => (m.id === id ? mapMilestone(res) : m))); refreshFeeds() }
      }, 500)
    },

    // Documents
    uploadDocument: (file, projectId, folder) => run(async () => {
      const form = new FormData()
      form.append('file', file)
      form.append('project_id', projectId)
      form.append('folder', folder)
      const d = mapDocument(await api.upload('/documents', form))
      setDocuments((ds) => [d, ...ds])
      refreshFeeds()
      return d
    }, `${file.name} uploaded`),
    downloadDocument: (doc) => run(() => downloadFile(`/documents/${doc.id}/download`, null, doc.name)),
    deleteDocument: (id) => run(async () => {
      await api.del(`/documents/${id}`)
      setDocuments((ds) => ds.filter((d) => d.id !== id))
    }, 'Document deleted'),

    // Reviews
    addReview: (data) => run(async () => {
      const r = mapReview(await api.post('/reviews', {
        projectId: Number(data.projectId), reviewStage: data.stage, reviewerId: data.reviewerId ? Number(data.reviewerId) : null, reviewDate: data.date,
        technicalImplementationScore: data.scores.technical, documentationScore: data.scores.documentation, innovationScore: data.scores.innovation,
        presentationScore: data.scores.presentation, teamContributionScore: data.scores.team, feedback: data.feedback, actionItems: data.actionItems || [],
      }))
      setReviews((rs) => [r, ...rs])
      refreshFeeds()
    }, 'Review saved'),

    // Notifications
    markRead: (id) => {
      setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)))
      api.patch(`/notifications/${id}/read`).catch(() => {})
    },
    markAllRead: () => {
      setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))
      api.post('/notifications/read-all').catch(() => {})
    },
    deleteNotification: (id) => {
      setNotifications((ns) => ns.filter((n) => n.id !== id))
      api.del(`/notifications/${id}`).catch(() => {})
    },

    // Calendar events
    addEvent: (data) => run(async () => {
      const e = mapEvent(await api.post('/events', { projectId: Number(data.projectId), title: data.title, eventType: data.type, eventDate: data.date, eventTime: data.time || null }))
      setEvents((es) => [...es, e])
      refreshFeeds()
    }, 'Event scheduled'),

    // Discussions
    addThread: (projectId, title, text) => run(async () => {
      const th = mapThread(await api.post('/discussions', { projectId: Number(projectId), title, message: text }))
      setDiscussions((d) => [th, ...d])
      return th.id
    }),
    loadThread: async (id) => {
      try {
        const th = mapThread(await api.get(`/discussions/${id}`))
        setDiscussions((d) => upsert(d, th))
      } catch { /* ignore */ }
    },
    replyThread: (threadId, text) => run(async () => {
      const m = mapMessage(await api.post(`/discussions/${threadId}/messages`, { message: text }))
      setDiscussions((d) => d.map((th) => (th.id === threadId
        ? { ...th, messages: [...(th.messages || []), m], last: m, messageCount: th.messageCount + 1, participants: th.participants.includes(m.userId) ? th.participants : [...th.participants, m.userId], updatedAt: m.at }
        : th)))
    }),

    // Reports (server-side PDF / Excel / CSV)
    exportReport: (kind, format, projectId) => run(() => downloadFile(`/reports/${kind}/export`, { format, project_id: projectId || undefined }, `${kind}.${format}`), 'Report downloaded'),
    toast,
  }

  const lookups = useMemo(() => ({
    userById: (id) => users.find((u) => sameId(u.id, id)) || (me && sameId(me.id, id) ? me : undefined),
    projectById: (id) => projects.find((p) => sameId(p.id, id)),
    taskById: (id) => tasks.find((t) => sameId(t.id, id)),
  }), [users, projects, tasks, me])

  const value = { me, booting, loading, users, projects, tasks, milestones, documents, reviews, notifications, activities, events, discussions, toasts, ...lookups, ...actions }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
