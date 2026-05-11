// src/features/projects/ProjectDetailPage.tsx
// Route: /projects/:id

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, MapPin, CalendarDays, Globe, Layers,
  Building2, FileText, Image, Download, ExternalLink, Upload, X, Plus,
} from 'lucide-react'
import client from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import LotDetailPanel from './LotDetailPanel'
import ProjectReportsTab from './ProjectReportsTab'
import type { LotSummary, LotStatus, ProjectDetail, Stage } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProjectDetail(id: string): Promise<ProjectDetail> {
  const { data } = await client.get<ProjectDetail>(`/projects/${id}/`)
  return data
}

function useProjectDetail(id: string | null) {
  return useQuery({
    queryKey: ['projects', 'detail', id],
    queryFn:  () => fetchProjectDetail(id!),
    enabled:  !!id,
    staleTime: 60_000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// GR formatter
// ─────────────────────────────────────────────────────────────────────────────

function formatGR(totalGr: string | null | undefined): string {
  if (!totalGr) return '—'
  const n = Number(totalGr)
  if (isNaN(n) || n === 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n.toLocaleString()}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Project status badge
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  active:    { label: 'Active',    className: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
  draft:     { label: 'Draft',     className: 'bg-gray-100 text-gray-500 border border-gray-200' },
  completed: { label: 'Completed', className: 'bg-blue-50 text-blue-800 border border-blue-200' },
} as const

function ProjectStatusBadge({ status }: { status: keyof typeof STATUS_BADGE }) {
  const { label, className } = STATUS_BADGE[status] ?? STATUS_BADGE.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot tile
// ─────────────────────────────────────────────────────────────────────────────

const LOT_TILE_STYLE: Record<LotStatus, string> = {
  available: 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  on_hold:   'bg-amber-50 text-amber-900 hover:bg-amber-100',
  reserved:  'bg-blue-50 text-blue-900 hover:bg-blue-100',
  settled:   'bg-gray-100 text-gray-500',
  draft:     'bg-gray-50 text-gray-400 border border-dashed border-gray-200',
}

const LOT_PRICE_STYLE: Record<LotStatus, string> = {
  available: 'text-emerald-600',
  on_hold:   'text-amber-600',
  reserved:  'text-blue-600',
  settled:   'text-gray-400',
  draft:     'text-gray-300',
}

const LOT_TYPE_LABELS: Record<string, string> = {
  land:           'Land',
  house_and_land: 'H&L',
  apartment:      'Apt',
  townhouse:      'Twnh',
  commercial:     'Comm',
}

function formatPrice(price: number | null): string {
  if (price === null) return '—'
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}m`
  if (price >= 1_000)     return `$${Math.round(price / 1_000)}k`
  return `$${price}`
}

function LotTile({ lot, onClick }: { lot: LotSummary; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-md px-2 py-2 text-center cursor-pointer ${LOT_TILE_STYLE[lot.status] ?? LOT_TILE_STYLE.draft}`}
    >
      <div className="text-xs font-medium leading-tight">{lot.lot_number}</div>
      <div className={`mt-0.5 text-[10px] leading-tight ${LOT_PRICE_STYLE[lot.status] ?? LOT_PRICE_STYLE.draft}`}>
        {formatPrice(lot.current_price)}
      </div>
      <div className="mt-0.5 text-[9px] leading-tight opacity-60">
        {LOT_TYPE_LABELS[lot.lot_type] ?? lot.lot_type}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lots & Stages tab
// ─────────────────────────────────────────────────────────────────────────────

function LotStatusLegend() {
  const items = [
    { label: 'Available', colour: 'bg-emerald-500' },
    { label: 'On hold',   colour: 'bg-amber-400' },
    { label: 'Reserved+', colour: 'bg-blue-500' },
    { label: 'Settled',   colour: 'bg-gray-400' },
    { label: 'Draft',     colour: 'bg-gray-200 border border-gray-300' },
  ]
  return (
    <div className="flex flex-wrap gap-3 pt-2">
      {items.map(({ label, colour }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${colour}`} />
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      ))}
    </div>
  )
}

function StageSection({ stage, onLotClick }: { stage: Stage; onLotClick: (id: string) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-medium text-gray-900">{stage.name}</h3>
        <span className="text-xs text-gray-400">
          {stage.lot_count} lot{stage.lot_count !== 1 ? 's' : ''}
          {stage.expected_release ? ` · Release ${stage.expected_release}` : ''}
        </span>
      </div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))' }}>
        {stage.lots.map(lot => (
          <LotTile key={lot.id} lot={lot} onClick={() => onLotClick(lot.id)} />
        ))}
      </div>
    </div>
  )
}

function LotsTab({ project, onLotClick }: { project: ProjectDetail; onLotClick: (id: string) => void }) {
  const c = project.lot_counts
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-6 gap-2.5">
        {[
          { value: c.total,     label: 'Total',     colour: 'text-gray-900' },
          { value: c.available, label: 'Available', colour: 'text-emerald-600' },
          { value: c.on_hold,   label: 'On hold',   colour: 'text-amber-600' },
          { value: c.reserved,  label: 'Reserved+', colour: 'text-blue-600' },
          { value: c.settled,   label: 'Settled',   colour: 'text-gray-400' },
        ].map(({ value, label, colour }) => (
          <div key={label} className="rounded-lg bg-gray-50 px-3 py-3 text-center">
            <p className={`text-xl font-medium ${colour}`}>{value}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{label}</p>
          </div>
        ))}
        <div className="rounded-lg bg-indigo-50 px-3 py-3 text-center">
          <p className="text-xl font-medium text-indigo-600">{formatGR(c.total_gr)}</p>
          <p className="mt-0.5 text-[11px] text-indigo-400">Gross revenue</p>
        </div>
      </div>

      {project.stages
        .slice()
        .sort((a, b) => a.stage_number - b.stage_number)
        .map(stage => (
          <StageSection key={stage.id} stage={stage} onLotClick={onLotClick} />
        ))}

      <LotStatusLegend />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Info tab
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-2 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900">{value ?? '—'}</span>
    </div>
  )
}

function InfoTab({ project }: { project: ProjectDetail }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">About this project</h3>
          {project.description
            ? <p className="text-sm leading-relaxed text-gray-600">{project.description}</p>
            : <p className="text-sm italic text-gray-400">No description added yet.</p>
          }
          {project.website_url && (
            <a href={project.website_url} target="_blank" rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
              {project.website_url.replace(/^https?:\/\//, '')}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Vendor solicitor</h3>
          {project.solicitor ? (
            <>
              <InfoRow label="Name"  value={project.solicitor.full_name} />
              <InfoRow label="Firm"  value={project.solicitor.firm_name} />
              <InfoRow label="Email" value={
                <a href={`mailto:${project.solicitor.email}`} className="text-blue-600 hover:underline">
                  {project.solicitor.email}
                </a>
              } />
              <InfoRow label="Phone" value={project.solicitor.phone} />
            </>
          ) : (
            <p className="text-sm italic text-gray-400">No solicitor assigned to this project.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 h-fit">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Billing</h3>
        <InfoRow label="Status"       value={project.billing_status} />
        <InfoRow label="Billing lots" value={project.billing_lot_count} />
        <InfoRow label="Start date"   value={project.billing_start_date} />
        <InfoRow label="End date"     value={project.billing_end_date ?? 'Active'} />
        <InfoRow label="Stages"       value={project.stages.length} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload form
// ─────────────────────────────────────────────────────────────────────────────

type UploadCategory = 'hero' | 'gallery' | 'brochure' | 'site_map' | 'floor_plan' | 'other'
type UploadMediaType = 'image' | 'document'

const CATEGORY_OPTIONS: { value: UploadCategory; label: string; type: UploadMediaType }[] = [
  { value: 'hero',       label: 'Hero image',  type: 'image' },
  { value: 'gallery',    label: 'Gallery',     type: 'image' },
  { value: 'brochure',   label: 'Brochure',    type: 'document' },
  { value: 'site_map',   label: 'Site map',    type: 'document' },
  { value: 'floor_plan', label: 'Floor plan',  type: 'document' },
  { value: 'other',      label: 'Other',       type: 'document' },
]

function UploadForm({ projectId, onSuccess, onCancel }: {
  projectId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const [title, setTitle]       = useState('')
  const [category, setCategory] = useState<UploadCategory>('hero')
  const [file, setFile]         = useState<File | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const mediaType = CATEGORY_OPTIONS.find(o => o.value === category)?.type ?? 'image'

  const { mutate: upload, isPending } = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Please select a file')
      const form = new FormData()
      form.append('title', title.trim() || file.name.replace(/\.[^.]+$/, ''))
      form.append('category', category)
      form.append('media_type', mediaType)
      form.append('file', file)
      form.append('sort_order', '0')
      await client.post(`/projects/${projectId}/media/`, form)
    },
    onSuccess: () => onSuccess(),
    onError: (err: any) => {
      setError(err?.response?.data?.detail ?? err.message ?? 'Upload failed')
    },
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Upload media</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as UploadCategory)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none">
            {CATEGORY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Title <span className="text-gray-300">(optional)</span>
          </label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder={category === 'hero' ? 'e.g. Hero — aerial view' : 'Display name'}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-300 focus:border-gray-400 focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">File</label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-600">
            <Upload className="h-4 w-4 shrink-0" />
            {file ? <span className="truncate text-gray-700">{file.name}</span> : <span>Click to choose a file</span>}
            <input type="file" className="hidden"
              accept={mediaType === 'image' ? 'image/*' : '.pdf,.doc,.docx'}
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => upload()} disabled={isPending || !file}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-gray-700">
            {isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Media & Collateral tab
// ─────────────────────────────────────────────────────────────────────────────

function MediaTab({ project }: { project: ProjectDetail }) {
  const user        = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)

  const canUpload = user?.role?.permissions?.some(p => p.code === 'project.manage_media') ?? false

  const images = [...project.media.hero, ...project.media.gallery]
  const docs   = [...project.media.brochure, ...project.media.site_map, ...project.media.floor_plan, ...project.media.other]

  const handleUploadSuccess = () => {
    setShowUpload(false)
    queryClient.invalidateQueries({ queryKey: ['projects', 'detail', project.id] })
  }

  return (
    <div className="space-y-5">
      {canUpload && !showUpload && (
        <div className="flex justify-end">
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700">
            <Plus className="h-3.5 w-3.5" />
            Upload media
          </button>
        </div>
      )}

      {canUpload && showUpload && (
        <UploadForm
          projectId={project.id}
          onSuccess={handleUploadSuccess}
          onCancel={() => setShowUpload(false)}
        />
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">Images</h3>
          {images.length === 0 ? (
            <p className="text-sm italic text-gray-400">No images uploaded.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {images.map(img => (
                <div key={img.id} className="overflow-hidden rounded-lg border border-gray-100">
                  {img.file_url ? (
                    <img src={img.file_url} alt={img.title} className="h-20 w-full object-cover" />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center bg-gray-50">
                      <Image className="h-6 w-6 text-gray-300" />
                    </div>
                  )}
                  <div className="px-2 py-1.5">
                    <p className="truncate text-[11px] text-gray-600">{img.title}</p>
                    <p className="text-[10px] capitalize text-gray-400">{img.category.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">Documents &amp; collateral</h3>
          {docs.length === 0 ? (
            <p className="text-sm italic text-gray-400">No documents uploaded.</p>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <a key={doc.id} href={doc.file_url ?? '#'} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 transition-colors hover:bg-gray-50">
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-700">{doc.title}</p>
                    <p className="text-[10px] capitalize text-gray-400">{doc.category.replace('_', ' ')}</p>
                  </div>
                  <Download className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'lots' | 'info' | 'media' | 'reports'

const TABS: { value: Tab; label: string }[] = [
  { value: 'lots',    label: 'Lots & stages' },
  { value: 'info',    label: 'Project info' },
  { value: 'media',   label: 'Media & collateral' },
  { value: 'reports', label: 'Reports' },
]

export default function ProjectDetailPage() {
  const { id }       = useParams<{ id: string }>()
  const navigate     = useNavigate()
  const [activeTab, setActiveTab]         = useState<Tab>('lots')
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)

  const { data: project, isLoading, isError } = useProjectDetail(id ?? null)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-28 animate-pulse bg-gray-100" />
        <div className="p-6 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      </div>
    )
  }

  if (isError || !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-gray-400">
        <Building2 className="h-10 w-10" />
        <p className="text-sm">Project not found.</p>
        <button onClick={() => navigate('/projects')} className="text-sm text-blue-600 hover:underline">
          Back to projects
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <button onClick={() => navigate('/projects')}
          className="mb-2 flex items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600">
          <ArrowLeft className="h-3.5 w-3.5" />
          All projects
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium text-gray-900">{project.name}</h1>
          <ProjectStatusBadge status={project.status} />
        </div>
        <div className="mt-2 flex flex-wrap gap-4">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <MapPin className="h-3.5 w-3.5" />{project.address}
          </span>
          {project.billing_start_date && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <CalendarDays className="h-3.5 w-3.5" />Active since {project.billing_start_date}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Layers className="h-3.5 w-3.5" />
            {project.lot_counts.total} lots · {project.stages.length} stage{project.stages.length !== 1 ? 's' : ''}
          </span>
          {project.lot_counts.total_gr && (
            <span className="flex items-center gap-1 text-xs font-medium text-indigo-600">
              GR {formatGR(project.lot_counts.total_gr)}
            </span>
          )}
          {project.website_url && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Globe className="h-3.5 w-3.5" />{project.website_url.replace(/^https?:\/\//, '')}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        {TABS.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.value
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === 'lots'    && <LotsTab    project={project} onLotClick={setSelectedLotId} />}
        {activeTab === 'info'    && <InfoTab    project={project} />}
        {activeTab === 'media'   && <MediaTab   project={project} />}
        {activeTab === 'reports' && <ProjectReportsTab project={project} />}
      </div>

      {/* Lot detail panel */}
      {selectedLotId && (
        <LotDetailPanel
          lotId={selectedLotId}
          onClose={() => setSelectedLotId(null)}
        />
      )}
    </div>
  )
}