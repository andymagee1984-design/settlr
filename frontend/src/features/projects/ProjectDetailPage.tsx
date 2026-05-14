// src/features/projects/ProjectDetailPage.tsx
// Route: /projects/:id
// Two tabs: Lots & Availability | Project Info

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, MapPin, CalendarDays, Globe, Layers,
  Building2, FileText, Download, ExternalLink,
  BedDouble, Bath, Car, ChevronLeft, ChevronRight,
} from 'lucide-react'
import client from '../../api/client'
import type { LotSummary, LotStatus, ProjectDetail, Stage } from './types'
import LotDetailPanel from './LotDetailPanel'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AmenityDefinition {
  code:  string
  label: string
  icon:  string
}

interface ProjectDetailWithAmenities extends ProjectDetail {
  amenities: AmenityDefinition[]
  lot_counts: ProjectDetail['lot_counts'] & { sold: number }
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProjectDetail(id: string): Promise<ProjectDetailWithAmenities> {
  const { data } = await client.get<ProjectDetailWithAmenities>(`/projects/${id}/`)
  return data
}

function useProjectDetail(id: string | null) {
  return useQuery({
    queryKey:  ['projects', 'detail', id],
    queryFn:   () => fetchProjectDetail(id!),
    enabled:   !!id,
    staleTime: 60_000,
  })
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
  settled:   'bg-gray-100 text-gray-500 hover:bg-gray-200',
  draft:     'bg-gray-50 text-gray-400 border border-dashed border-gray-200 hover:bg-gray-100',
}

const LOT_PRICE_STYLE: Record<LotStatus, string> = {
  available: 'text-emerald-600',
  on_hold:   'text-amber-600',
  reserved:  'text-blue-600',
  settled:   'text-gray-400',
  draft:     'text-gray-300',
}

const LOT_VITAL_STYLE: Record<LotStatus, string> = {
  available: 'text-emerald-500',
  on_hold:   'text-amber-500',
  reserved:  'text-blue-500',
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
  const hasVitals = lot.bedrooms || lot.bathrooms || lot.car_spaces
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-md px-3 py-3 text-center cursor-pointer transition-colors ${LOT_TILE_STYLE[lot.status] ?? LOT_TILE_STYLE.draft}`}
    >
      <div className="text-sm font-semibold leading-tight">{lot.lot_number}</div>
      <div className={`mt-1 text-xs font-medium leading-tight ${LOT_PRICE_STYLE[lot.status] ?? LOT_PRICE_STYLE.draft}`}>
        {formatPrice(lot.current_price)}
      </div>
      <div className="mt-1 text-[10px] leading-tight opacity-60">
        {LOT_TYPE_LABELS[lot.lot_type] ?? lot.lot_type}
      </div>
      {hasVitals && (
        <div className={`mt-2 flex items-center justify-center gap-2 ${LOT_VITAL_STYLE[lot.status] ?? LOT_VITAL_STYLE.draft}`}>
          {lot.bedrooms != null && (
            <span className="flex items-center gap-0.5">
              <BedDouble className="h-4 w-4" />
              <span className="text-xs">{lot.bedrooms}</span>
            </span>
          )}
          {lot.bathrooms != null && (
            <span className="flex items-center gap-0.5">
              <Bath className="h-4 w-4" />
              <span className="text-xs">{lot.bathrooms}</span>
            </span>
          )}
          {lot.car_spaces != null && (
            <span className="flex items-center gap-0.5">
              <Car className="h-4 w-4" />
              <span className="text-xs">{lot.car_spaces}</span>
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lots & Availability tab
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

function StageSection({ stage, onLotClick }: { stage: Stage; onLotClick: (lotId: string) => void }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <h3 className="text-sm font-medium text-gray-900">{stage.name}</h3>
        <span className="text-xs text-gray-400">
          {stage.lot_count} lot{stage.lot_count !== 1 ? 's' : ''}
          {stage.expected_release ? ` · Release ${stage.expected_release}` : ''}
        </span>
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(216px, 1fr))' }}
      >
        {stage.lots.map(lot => (
          <LotTile key={lot.id} lot={lot} onClick={() => onLotClick(lot.id)} />
        ))}
      </div>
    </div>
  )
}

function LotsTab({ project, onLotClick }: { project: ProjectDetailWithAmenities; onLotClick: (lotId: string) => void }) {
  const c = project.lot_counts
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-2.5">
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
// Project Info tab — sub-components
// ─────────────────────────────────────────────────────────────────────────────

// 1. Key stats card

function KeyStatsCard({ counts }: { counts: ProjectDetailWithAmenities['lot_counts'] }) {
  const stats = [
    { value: counts.total,     label: 'Total lots', colour: 'text-gray-900' },
    { value: counts.available, label: 'Available',  colour: 'text-emerald-600' },
    { value: counts.sold,      label: 'Sold',       colour: 'text-blue-600' },
    { value: counts.settled,   label: 'Settled',    colour: 'text-gray-400' },
  ]
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">Key stats</h3>
      <div className="grid grid-cols-4 gap-3">
        {stats.map(({ value, label, colour }) => (
          <div key={label} className="rounded-lg bg-gray-50 px-3 py-3 text-center">
            <p className={`text-2xl font-medium ${colour}`}>{value}</p>
            <p className="mt-0.5 text-[11px] text-gray-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// 2. Amenities card

function AmenitiesCard({ amenities }: { amenities: AmenityDefinition[] }) {
  if (amenities.length === 0) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">Amenities</h3>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
        {amenities.map(({ code, label, icon }) => (
          <div key={code} className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-center">
            <i className={`ti ${icon} text-gray-400`} style={{ fontSize: 22 }} aria-hidden="true" />
            <span className="text-[11px] font-medium text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 3. Slideshow gallery — half width

function ImageSlideshow({ project }: { project: ProjectDetailWithAmenities }) {
  const images = [...project.media.hero, ...project.media.gallery]
  const [current, setCurrent] = useState(0)
  const [paused, setPaused]   = useState(false)

  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length])

  useEffect(() => {
    if (paused || images.length <= 1) return
    const timer = setInterval(next, 5000)
    return () => clearInterval(timer)
  }, [paused, next, images.length])

  if (images.length === 0) return null
  const img = images[current]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">Images</h3>
      <div
        className="relative overflow-hidden rounded-lg bg-gray-100 flex-1"
        style={{ minHeight: 0 }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {img.file_url ? (
          <img
            key={img.id}
            src={img.file_url}
            alt={img.title}
            className="w-full h-full object-cover"
            style={{ minHeight: 220 }}
          />
        ) : (
          <div className="flex items-center justify-center bg-gray-50" style={{ minHeight: 220 }}>
            <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <p className="text-sm font-medium text-white drop-shadow">{img.title}</p>
          <p className="text-xs capitalize text-white/70">{img.category.replace('_', ' ')} · {current + 1} of {images.length}</p>
        </div>
        {images.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/50" aria-label="Previous image">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-1.5 text-white backdrop-blur-sm transition hover:bg-black/50" aria-label="Next image">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {images.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${i === current ? 'w-6 bg-gray-700' : 'w-1.5 bg-gray-300 hover:bg-gray-400'}`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 4. Info row helper

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-2 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value ?? '—'}</span>
    </div>
  )
}

// 5. Project details column — About, Solicitor, Billing, Project details stacked

function ProjectDetailsColumn({ project }: { project: ProjectDetailWithAmenities }) {
  return (
    <div className="flex flex-col gap-5">
      {/* About */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">About this project</h3>
        {project.description ? (
          <p className="text-sm leading-relaxed text-gray-600">{project.description}</p>
        ) : (
          <p className="text-sm italic text-gray-400">No description added yet.</p>
        )}
        {project.website_url && (
          <a href={project.website_url} target="_blank" rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
            {project.website_url.replace(/^https?:\/\//, '')}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Solicitor */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Solicitor</h3>
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

      {/* Billing */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Billing</h3>
        <InfoRow label="Status"       value={project.billing_status} />
        <InfoRow label="Billing lots" value={project.billing_lot_count} />
        <InfoRow label="Start date"   value={project.billing_start_date} />
        <InfoRow label="End date"     value={project.billing_end_date ?? 'Active'} />
      </div>

      {/* Project details */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Project details</h3>
        <InfoRow label="Stages" value={project.stages.length} />
      </div>
    </div>
  )
}

// 6. Documents — full width

function DocumentsCard({ project }: { project: ProjectDetailWithAmenities }) {
  const docs = [
    ...project.media.brochure,
    ...project.media.site_map,
    ...project.media.floor_plan,
    ...project.media.other,
  ]
  if (docs.length === 0) return null

  const CATEGORY_LABELS: Record<string, string> = {
    brochure: 'Brochure', site_map: 'Site map', floor_plan: 'Floor plan', other: 'Document',
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-gray-400">Documents &amp; collateral</h3>
      <div className="divide-y divide-gray-100">
        {docs.map(doc => (
          <a key={doc.id} href={doc.file_url ?? '#'} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 py-2.5 transition-colors hover:text-blue-600 first:pt-0 last:pb-0">
            <FileText className="h-4 w-4 shrink-0 text-gray-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-gray-700">{doc.title}</p>
              <p className="text-[10px] text-gray-400">{CATEGORY_LABELS[doc.category] ?? 'Document'} · PDF</p>
            </div>
            <Download className="h-3.5 w-3.5 shrink-0 text-gray-300" />
          </a>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Info tab — composed
// Layout:
//   1. Key stats          — full width
//   2. Amenities          — full width (hidden if none)
//   3. Gallery + Details  — two columns side by side
//   4. Documents          — full width (hidden if none)
// ─────────────────────────────────────────────────────────────────────────────

function InfoTab({ project }: { project: ProjectDetailWithAmenities }) {
  const hasImages = project.media.hero.length > 0 || project.media.gallery.length > 0

  return (
    <div className="space-y-5">
      {/* 1. Key stats */}
      <KeyStatsCard counts={project.lot_counts} />

      {/* 2. Amenities */}
      <AmenitiesCard amenities={project.amenities ?? []} />

      {/* 3. Gallery + Project details side by side */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Left — slideshow (only if images exist, otherwise details go full width) */}
        {hasImages && <ImageSlideshow project={project} />}

        {/* Right — all detail cards stacked */}
        <ProjectDetailsColumn project={project} />
      </div>

      {/* 4. Documents */}
      <DocumentsCard project={project} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'lots' | 'info'

const TABS: { value: Tab; label: string }[] = [
  { value: 'lots', label: 'Lots & availability' },
  { value: 'info', label: 'Project info' },
]

export default function ProjectDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab]         = useState<Tab>('lots')
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)

  const { data: project, isLoading, isError } = useProjectDetail(id ?? null)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-48 animate-pulse bg-gray-100" />
        <div className="space-y-4 p-6">
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

  const heroUrl = project.media.hero[0]?.file_url ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="border-b border-gray-200 bg-white">
        {heroUrl && (
          <div className="relative h-48 w-full overflow-hidden">
            <img src={heroUrl} alt={project.name} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}
        <div className="px-6 py-4">
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
            {project.website_url && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Globe className="h-3.5 w-3.5" />{project.website_url.replace(/^https?:\/\//, '')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-200 bg-white px-6">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="p-6">
        {activeTab === 'lots' && <LotsTab project={project} onLotClick={setSelectedLotId} />}
        {activeTab === 'info' && <InfoTab project={project} />}
      </div>

      {/* ── Lot detail panel ── */}
      {selectedLotId && (
        <LotDetailPanel lotId={selectedLotId} onClose={() => setSelectedLotId(null)} />
      )}
    </div>
  )
}