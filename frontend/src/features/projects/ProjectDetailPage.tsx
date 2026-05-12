// src/features/projects/ProjectDetailPage.tsx
// Route: /projects/:id

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, MapPin, CalendarDays, Globe, Layers,
  Building2, FileText, Image, Download, ExternalLink, Upload, X, Plus,
  BedDouble, Bath, Car,
} from 'lucide-react'
import client from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import LotDetailPanel from './LotDetailPanel'
import ProjectReportsTab from './ProjectReportsTab'
import type { LotSummary, LotStatus, ProjectDetail, Stage } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared card style
// ─────────────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06)',
}

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
// Project status badge — two variants (dark bg for hero, light bg for plain)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_BADGE = {
  active:    { label: 'Active',    bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  draft:     { label: 'Draft',     bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  completed: { label: 'Completed', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
} as const

function ProjectStatusBadge({
  status,
  onHero = false,
}: {
  status: keyof typeof STATUS_BADGE
  onHero?: boolean
}) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.draft
  if (onHero) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        borderRadius: 99, padding: '3px 12px',
        fontSize: 11, fontWeight: 600,
        background: 'rgba(255,255,255,0.18)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.35)',
        backdropFilter: 'blur(4px)',
      }}>
        {s.label}
      </span>
    )
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      borderRadius: 99, padding: '2px 10px',
      fontSize: 11, fontWeight: 500,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot status colours
// ─────────────────────────────────────────────────────────────────────────────

const LOT_STATUS_COLOURS: Record<LotStatus, { bg: string; text: string; subtext: string; border: string; hover: string }> = {
  available: { bg: '#f0fdf4', text: '#14532d', subtext: '#16a34a', border: '#bbf7d0', hover: '#dcfce7' },
  on_hold:   { bg: '#fffbeb', text: '#78350f', subtext: '#d97706', border: '#fde68a', hover: '#fef3c7' },
  reserved:  { bg: '#eff6ff', text: '#1e3a5f', subtext: '#2563eb', border: '#bfdbfe', hover: '#dbeafe' },
  settled:   { bg: '#f9fafb', text: '#6b7280', subtext: '#9ca3af', border: '#e5e7eb', hover: '#f3f4f6' },
  draft:     { bg: '#f9fafb', text: '#9ca3af', subtext: '#d1d5db', border: '#e5e7eb', hover: '#f3f4f6' },
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

// ─────────────────────────────────────────────────────────────────────────────
// Lot card
// ─────────────────────────────────────────────────────────────────────────────

function LotCard({ lot, onClick }: { lot: LotSummary; onClick: () => void }) {
  const c = LOT_STATUS_COLOURS[lot.status] ?? LOT_STATUS_COLOURS.draft
  const hasVitals = lot.bedrooms != null || lot.bathrooms != null || lot.car_spaces != null

  return (
    <div
      onClick={onClick}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'background 0.12s, box-shadow 0.12s, transform 0.12s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 110,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.background = c.hover
        el.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.08)'
        el.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.background = c.bg
        el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06), 0 4px 10px rgba(0,0,0,0.06)'
        el.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: c.text, lineHeight: 1 }}>
          {lot.lot_number}
        </span>
        <span style={{ fontSize: 10, color: c.subtext, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
          {LOT_TYPE_LABELS[lot.lot_type] ?? lot.lot_type}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: c.subtext, lineHeight: 1 }}>
        {formatPrice(lot.current_price)}
      </div>
      {hasVitals && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
          {lot.bedrooms != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: c.text, opacity: 0.75, fontWeight: 500 }}>
              <BedDouble size={11} />{lot.bedrooms}
            </span>
          )}
          {lot.bathrooms != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: c.text, opacity: 0.75, fontWeight: 500 }}>
              <Bath size={11} />{lot.bathrooms}
            </span>
          )}
          {lot.car_spaces != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: c.text, opacity: 0.75, fontWeight: 500 }}>
              <Car size={11} />{lot.car_spaces}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lots & Stages tab
// ─────────────────────────────────────────────────────────────────────────────

function LotStatusLegend() {
  const items = [
    { label: 'Available', colour: '#10b981' },
    { label: 'On hold',   colour: '#f59e0b' },
    { label: 'Reserved+', colour: '#3b82f6' },
    { label: 'Settled',   colour: '#9ca3af' },
    { label: 'Draft',     colour: '#e5e7eb', border: '#d1d5db' },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', paddingTop: 8 }}>
      {items.map(({ label, colour, border }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: colour, border: border ? `1px solid ${border}` : 'none' }} />
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

function StageSection({ stage, onLotClick }: { stage: Stage; onLotClick: (id: string) => void }) {
  return (
    <div style={{ ...CARD, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{stage.name}</h3>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>
          {stage.lot_count} lot{stage.lot_count !== 1 ? 's' : ''}
          {stage.expected_release ? ` · Release ${stage.expected_release}` : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))' }}>
        {stage.lots.map(lot => (
          <LotCard key={lot.id} lot={lot} onClick={() => onLotClick(lot.id)} />
        ))}
      </div>
    </div>
  )
}

function LotsTab({ project, onLotClick }: { project: ProjectDetail; onLotClick: (id: string) => void }) {
  const c = project.lot_counts
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {[
          { value: c.total,     label: 'Total',     colour: '#111827', bg: '#f8fafc' },
          { value: c.available, label: 'Available', colour: '#059669', bg: '#f0fdf4' },
          { value: c.on_hold,   label: 'On hold',   colour: '#d97706', bg: '#fffbeb' },
          { value: c.reserved,  label: 'Reserved+', colour: '#2563eb', bg: '#eff6ff' },
          { value: c.settled,   label: 'Settled',   colour: '#9ca3af', bg: '#f9fafb' },
        ].map(({ value, label, colour, bg }) => (
          <div key={label} style={{ ...CARD, background: bg, padding: '12px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 600, color: colour, lineHeight: 1 }}>{value}</p>
            <p style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>{label}</p>
          </div>
        ))}
        <div style={{ ...CARD, background: '#f5f3ff', border: '1px solid #ddd6fe', padding: '12px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 22, fontWeight: 600, color: '#7c3aed', lineHeight: 1 }}>{formatGR(c.total_gr)}</p>
          <p style={{ marginTop: 4, fontSize: 11, color: '#a78bfa' }}>Gross revenue</p>
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
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '8px 0', fontSize: 13 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: '#111827' }}>{value ?? '—'}</span>
    </div>
  )
}

function InfoTab({ project }: { project: ProjectDetail }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      <div style={{ ...CARD, padding: 20, gridColumn: 'span 2' }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 12 }}>
          About this project
        </h3>
        {project.description
          ? <p style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>{project.description}</p>
          : <p style={{ fontSize: 13, fontStyle: 'italic', color: '#9ca3af' }}>No description added yet.</p>
        }
        {project.website_url && (
          <a href={project.website_url} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 13, color: '#2563eb' }}>
            {project.website_url.replace(/^https?:\/\//, '')}
            <ExternalLink size={12} />
          </a>
        )}
      </div>
      <div style={{ ...CARD, padding: 20 }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 12 }}>
          Billing
        </h3>
        <InfoRow label="Status"       value={project.billing_status} />
        <InfoRow label="Billing lots" value={project.billing_lot_count} />
        <InfoRow label="Start date"   value={project.billing_start_date} />
        <InfoRow label="End date"     value={project.billing_end_date ?? 'Active'} />
        <InfoRow label="Stages"       value={project.stages.length} />
      </div>
      <div style={{ ...CARD, padding: 20, gridColumn: 'span 2' }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 12 }}>
          Vendor solicitor
        </h3>
        {project.solicitor ? (
          <>
            <InfoRow label="Name"  value={project.solicitor.full_name} />
            <InfoRow label="Firm"  value={project.solicitor.firm_name} />
            <InfoRow label="Email" value={
              <a href={`mailto:${project.solicitor.email}`} style={{ color: '#2563eb' }}>{project.solicitor.email}</a>
            } />
            <InfoRow label="Phone" value={project.solicitor.phone} />
          </>
        ) : (
          <p style={{ fontSize: 13, fontStyle: 'italic', color: '#9ca3af' }}>No solicitor assigned to this project.</p>
        )}
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
  projectId: string; onSuccess: () => void; onCancel: () => void
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
    onError: (err: any) => setError(err?.response?.data?.detail ?? err.message ?? 'Upload failed'),
  })

  return (
    <div style={{ ...CARD, padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Upload media</h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as UploadCategory)}
            style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '6px 10px', fontSize: 13, color: '#111827' }}>
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>
            Title <span style={{ color: '#d1d5db' }}>(optional)</span>
          </label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder={category === 'hero' ? 'e.g. Hero — aerial view' : 'Display name'}
            style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '6px 10px', fontSize: 13, color: '#111827', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>File</label>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px dashed #d1d5db', borderRadius: 8, padding: '10px 12px',
            cursor: 'pointer', fontSize: 13, color: '#9ca3af',
          }}>
            <Upload size={14} />
            {file ? <span style={{ color: '#111827' }}>{file.name}</span> : <span>Click to choose a file</span>}
            <input type="file" style={{ display: 'none' }}
              accept={mediaType === 'image' ? 'image/*' : '.pdf,.doc,.docx'}
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <p style={{ fontSize: 12, color: '#dc2626' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button onClick={onCancel} style={{
            borderRadius: 8, border: '1px solid #e2e8f0', padding: '6px 14px',
            fontSize: 12, fontWeight: 500, color: '#6b7280', cursor: 'pointer', background: '#fff',
          }}>Cancel</button>
          <button onClick={() => upload()} disabled={isPending || !file} style={{
            borderRadius: 8, background: '#111827', padding: '6px 14px',
            fontSize: 12, fontWeight: 500, color: '#fff', cursor: 'pointer', border: 'none',
            opacity: (!file || isPending) ? 0.4 : 1,
          }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {canUpload && !showUpload && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={() => setShowUpload(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#111827', color: '#fff', border: 'none',
            borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>
            <Plus size={13} /> Upload media
          </button>
        </div>
      )}
      {canUpload && showUpload && (
        <UploadForm projectId={project.id} onSuccess={handleUploadSuccess} onCancel={() => setShowUpload(false)} />
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ ...CARD, padding: 20 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 16 }}>
            Images
          </h3>
          {images.length === 0 ? (
            <p style={{ fontSize: 13, fontStyle: 'italic', color: '#9ca3af' }}>No images uploaded.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {images.map(img => (
                <div key={img.id} style={{ borderRadius: 8, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                  {img.file_url
                    ? <img src={img.file_url} alt={img.title} style={{ height: 80, width: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ height: 80, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={24} color="#d1d5db" /></div>
                  }
                  <div style={{ padding: '6px 8px' }}>
                    <p style={{ fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.title}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'capitalize' }}>{img.category.replace('_', ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ ...CARD, padding: 20 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 16 }}>
            Documents &amp; collateral
          </h3>
          {docs.length === 0 ? (
            <p style={{ fontSize: 13, fontStyle: 'italic', color: '#9ca3af' }}>No documents uploaded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {docs.map(doc => (
                <a key={doc.id} href={doc.file_url ?? '#'} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #f1f5f9', borderRadius: 8, padding: '8px 12px', textDecoration: 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <FileText size={15} color="#9ca3af" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</p>
                    <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'capitalize' }}>{doc.category.replace('_', ' ')}</p>
                  </div>
                  <Download size={13} color="#d1d5db" style={{ flexShrink: 0 }} />
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
      <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: 24 }}>
        <div style={{ height: 140, borderRadius: 12, background: '#e2e8f0', marginBottom: 12 }} />
        {[1,2,3].map(i => <div key={i} style={{ height: 60, borderRadius: 12, background: '#e2e8f0', marginBottom: 8 }} />)}
      </div>
    )
  }

  if (isError || !project) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#9ca3af' }}>
        <Building2 size={40} />
        <p style={{ fontSize: 14 }}>Project not found.</p>
        <button onClick={() => navigate('/projects')} style={{ fontSize: 13, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
          Back to projects
        </button>
      </div>
    )
  }

  const heroImage = project.media?.hero?.[0]?.file_url ?? null
  const hasHero   = !!heroImage

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

      {/* ── Header — hero image if available, clean white if not ── */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        background: hasHero ? '#111827' : '#fff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        minHeight: hasHero ? 160 : 'auto',
      }}>
        {/* Hero image */}
        {hasHero && (
          <>
            <img
              src={heroImage!}
              alt={project.name}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center',
                opacity: 0.55,
              }}
            />
            {/* Gradient overlay — darker at bottom so text is readable */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)',
            }} />
          </>
        )}

        {/* Content — sits above image */}
        <div style={{ position: 'relative', padding: '16px 24px 20px' }}>
          <button onClick={() => navigate('/projects')} style={{
            display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12,
            fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: hasHero ? 'rgba(255,255,255,0.75)' : '#9ca3af',
          }}>
            <ArrowLeft size={13} /> All projects
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h1 style={{
              fontSize: 22, fontWeight: 700, lineHeight: 1.2,
              color: hasHero ? '#fff' : '#111827',
            }}>
              {project.name}
            </h1>
            <ProjectStatusBadge status={project.status} onHero={hasHero} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
            {[
              { icon: <MapPin size={12} />, text: project.address },
              project.billing_start_date
                ? { icon: <CalendarDays size={12} />, text: `Active since ${project.billing_start_date}` }
                : null,
              {
                icon: <Layers size={12} />,
                text: `${project.lot_counts.total} lots · ${project.stages.length} stage${project.stages.length !== 1 ? 's' : ''}`,
              },
              project.lot_counts.total_gr
                ? { icon: null, text: `GR ${formatGR(project.lot_counts.total_gr)}`, highlight: true }
                : null,
              project.website_url
                ? { icon: <Globe size={12} />, text: project.website_url.replace(/^https?:\/\//, '') }
                : null,
            ].filter(Boolean).map((item, i) => (
              <span key={i} style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
                color: hasHero
                  ? (item!.highlight ? '#c4b5fd' : 'rgba(255,255,255,0.75)')
                  : (item!.highlight ? '#7c3aed' : '#9ca3af'),
                fontWeight: item!.highlight ? 600 : 400,
              }}>
                {item!.icon}
                {item!.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e2e8f0',
        background: '#fff',
        paddingLeft: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {TABS.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)} style={{
            padding: '12px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: 'none', border: 'none', borderBottom: '2px solid',
            borderBottomColor: activeTab === tab.value ? '#111827' : 'transparent',
            color: activeTab === tab.value ? '#111827' : '#9ca3af',
            transition: 'color 0.15s, border-color 0.15s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 24 }}>
        {activeTab === 'lots'    && <LotsTab    project={project} onLotClick={setSelectedLotId} />}
        {activeTab === 'info'    && <InfoTab    project={project} />}
        {activeTab === 'media'   && <MediaTab   project={project} />}
        {activeTab === 'reports' && <ProjectReportsTab project={project} />}
      </div>

      {/* Lot detail panel */}
      {selectedLotId && (
        <LotDetailPanel lotId={selectedLotId} onClose={() => setSelectedLotId(null)} />
      )}
    </div>
  )
}