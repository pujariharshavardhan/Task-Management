import { useMemo, useRef, useState } from 'react'
import { Upload, Search, FileText, Image, Presentation, File, FolderOpen, Folder, Download, Trash2, FileSpreadsheet } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { usePageMeta } from '../lib/seo'
import { Avatar, Badge, Button, Card, ConfirmDialog, Empty, Field, IconBlob, Input, Modal, PageHeader, Select, Stagger } from '../components/ui'
import { DOC_FOLDERS } from '../data/constants'
import { cx, fmtDate } from '../lib/utils'

const FOLDER_TONE = { Requirements: 'primary', Design: 'pink', Reports: 'mint', Presentations: 'peach', Other: 'sky' }

export function FileIcon({ type, size = 44 }) {
  const map = { PDF: [FileText, 'rose'], DOCX: [FileText, 'sky'], PNG: [Image, 'pink'], JPG: [Image, 'pink'], FIG: [Image, 'primary'], PPTX: [Presentation, 'peach'], XLSX: [FileSpreadsheet, 'mint'], CSV: [FileSpreadsheet, 'mint'] }
  const [icon, tone] = map[type] || [File, 'muted']
  return <IconBlob icon={icon} tone={tone} size={size} soft />
}

// Same allowlist and size limit as the server (backend/app/config.py)
const MAX_MB = 25
const ALLOWED_EXT = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'md', 'rtf', 'odt', 'ods', 'odp', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'fig', 'zip', 'rar', '7z', 'json', 'xml', 'py', 'ipynb', 'sql']

const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

export function UploadModal({ open, onClose, projectId: fixedProject }) {
  const { projects, uploadDocument } = useApp()
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)
  const [projectId, setProjectId] = useState(fixedProject || '')
  const [folder, setFolder] = useState('Requirements')
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  const [fileError, setFileError] = useState('')
  const pick = (f) => {
    if (!f) return
    const ext = f.name.includes('.') ? f.name.split('.').pop().toLowerCase() : ''
    if (!ALLOWED_EXT.includes(ext)) { setFile(null); setFileError(`.${ext || '?'} files are not allowed. Use PDF, Office, images, text, code or archives.`); return }
    if (f.size > MAX_MB * 1048576) { setFile(null); setFileError(`This file is ${fmtSize(f.size)}. The limit is ${MAX_MB} MB.`); return }
    if (f.size === 0) { setFile(null); setFileError('This file is empty.'); return }
    setFileError('')
    setFile(f)
  }
  const submit = async () => {
    setBusy(true)
    const ok = await uploadDocument(file, fixedProject || projectId, folder)
    setBusy(false)
    if (!ok) return
    setFile(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload Document"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon={Upload} disabled={busy || !file || !(fixedProject || projectId)} onClick={submit}>{busy ? 'Uploading…' : 'Upload'}</Button></>}>
      <div className="flex flex-col gap-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]) }}
          onClick={() => inputRef.current.click()}
          className={cx('clay-inset flex cursor-pointer flex-col items-center gap-3 p-8 text-center transition', drag && 'ring-4 ring-accent-soft')}
        >
          <IconBlob icon={Upload} tone="primary" size={56} />
          {file ? (
            <div><div className="font-black text-ink">{file.name}</div><div className="text-xs font-bold text-muted">{fmtSize(file.size)}</div></div>
          ) : (
            <div><div className="font-black text-ink">Drop a file here or click to browse</div><div className="text-xs font-bold text-muted">PDF, Office, images, text, code or archives · up to 25 MB</div></div>
          )}
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => pick(e.target.files[0])} />
        </div>
        {fileError && <p className="-mt-2 text-xs font-bold text-rose" role="alert">{fileError}</p>}
        {!fixedProject && (
          <Field label="Project" required><Select value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="Select project" options={projects.map((p) => ({ value: p.id, label: p.name }))} /></Field>
        )}
        <Field label="Folder"><Select value={folder} onChange={(e) => setFolder(e.target.value)} options={DOC_FOLDERS} /></Field>
      </div>
    </Modal>
  )
}

export default function Documents() {
  usePageMeta({ title: 'Documents', description: 'Project files organised by folder: requirements, designs, reports and presentations.' })
  const { documents, projects, userById, projectById, deleteDocument, downloadDocument } = useApp()
  const [folder, setFolder] = useState('')
  const [project, setProject] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(null)

  const list = useMemo(() => documents.filter((d) =>
    (!folder || d.folder === folder) && (!project || String(d.projectId) === String(project)) && (!q || d.name.toLowerCase().includes(q.toLowerCase())),
  ), [documents, folder, project, q])

  return (
    <div>
      <PageHeader title="Documents" subtitle="SRS, designs, reports and presentations for every project." actions={<Button icon={Upload} onClick={() => setOpen(true)}>Upload</Button>} />

      <Stagger fill stagger={0.06} className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {DOC_FOLDERS.map((f) => {
          const count = documents.filter((d) => d.folder === f && (!project || String(d.projectId) === String(project))).length
          const active = folder === f
          return (
            <button key={f} onClick={() => setFolder(active ? '' : f)} className={cx('clay flex cursor-pointer flex-col items-start gap-3 p-5 text-left transition hover:-translate-y-1', active && 'ring-4 ring-accent-soft')}>
              <IconBlob icon={active ? FolderOpen : Folder} tone={FOLDER_TONE[f]} size={48} />
              <div><div className="font-black text-ink">{f}</div><div className="text-xs font-bold text-muted">{count} file{count === 1 ? '' : 's'}</div></div>
            </button>
          )
        })}
      </Stagger>

      <Card className="!p-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-52 flex-1">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-4 z-10 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files" className="!py-2.5 pl-10" />
          </div>
          <Select aria-label="Filter by project" value={project} onChange={(e) => setProject(e.target.value)} placeholder="All projects" options={projects.map((p) => ({ value: p.id, label: p.name }))} className="!w-auto !py-2.5" />
          {folder && <Badge tone={FOLDER_TONE[folder]}>{folder} <button onClick={() => setFolder('')} className="cursor-pointer" aria-label="Clear folder">×</button></Badge>}
        </div>
        {list.length === 0 ? <Empty title="No documents" text="Upload a file to get started." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead><tr className="text-xs font-black tracking-wide text-muted uppercase">{['File Name', 'Project', 'Folder', 'Uploaded By', 'Date', 'Version', ''].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id} className="row-hover">
                    <td className="rounded-l-2xl px-3 py-2.5"><div className="flex items-center gap-3"><FileIcon type={d.type} size={38} /><div><div className="text-sm font-black text-ink">{d.name}</div><div className="text-xs font-semibold text-muted">{d.type} · {d.size}</div></div></div></td>
                    <td className="px-3 py-2.5 text-sm font-bold text-muted">{projectById(d.projectId)?.name}</td>
                    <td className="px-3 py-2.5"><Badge tone={FOLDER_TONE[d.folder]}>{d.folder}</Badge></td>
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Avatar user={userById(d.uploadedBy)} size={26} /><span className="text-sm font-bold">{userById(d.uploadedBy)?.name}</span></div></td>
                    <td className="px-3 py-2.5 text-sm font-bold text-ink">{fmtDate(d.uploadedAt)}</td>
                    <td className="px-3 py-2.5"><Badge tone="muted">v{d.version}</Badge></td>
                    <td className="rounded-r-2xl px-3 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => downloadDocument(d)} className="cursor-pointer p-2 text-muted hover:text-accent" aria-label="Download"><Download size={17} /></button>
                      <button onClick={() => setConfirm(d)} className="cursor-pointer p-2 text-muted hover:text-rose" aria-label="Delete"><Trash2 size={17} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <UploadModal open={open} onClose={() => setOpen(false)} />
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} title="Delete document?" message={`“${confirm?.name}” will be permanently deleted.`} onConfirm={() => deleteDocument(confirm.id)} />
    </div>
  )
}
