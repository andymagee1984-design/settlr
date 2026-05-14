// src/features/projects/ProjectDetailPage.tsx
// Route: /projects/:id
//
// Layout:
//   - Hero header
//   - Lot availability (always visible)
//   - Two tabs: Project Info | Reports
//     Project Info = amenities > gallery+about > billing > agencies (with lot grid) > solicitor > documents

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, MapPin, CalendarDays, Globe, Layers, Building2,
  FileText, Download, ExternalLink, Upload, X, Plus,
  BedDouble, Bath, Car, Users, Trash2, AlertCircle,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, BarChart3, Lock,
} from 'lucide-react'
import client from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import LotDetailPanel from './LotDetailPanel'
import ProjectReportsTab from './ProjectReportsTab'
import type { LotSummary, LotStatus, ProjectDetail, ProjectMedia, Stage } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Local types
// ─────────────────────────────────────────────────────────────────────────────

interface Amenity { code: string; label: string; icon: string }

interface ProjectDetailWithAmenities extends ProjectDetail {
  amenities?: Amenity[]
}

interface ProjectAgency {
  id: string
  agency_id: string
  agency_name: string
  assigned_by_name: string | null
  assigned_at: string
}

interface AgencyOption { id: string; name: string }

interface LotAssignment {
  lot_id: string
  agency_id: string
  agency_name: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatGR(v: string | null | undefined): string {
  if (!v) return '—'
  const n = Number(v)
  if (isNaN(n) || n === 0) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n.toLocaleString()}`
}

function formatPrice(price: number | null): string {
  if (price === null) return '—'
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}m`
  if (price >= 1_000) return `$${Math.round(price / 1_000)}k`
  return `$${price}`
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
    queryKey: ['projects', 'detail', id],
    queryFn: () => fetchProjectDetail(id!),
    enabled: !!id,
    staleTime: 60_000,
  })
}

async function fetchProjectAgencies(projectId: string): Promise<ProjectAgency[]> {
  const { data } = await client.get<ProjectAgency[]>(`/projects/${projectId}/agencies/`)
  return data
}

async function fetchAllAgencies(): Promise<AgencyOption[]> {
  const { data } = await client.get<any>('/agencies/')
  return Array.isArray(data) ? data : (data.results ?? [])
}

// Fetch all exclusive lot assignments for an entire project in one batch
async function fetchProjectLotAssignments(allLots: LotSummary[]): Promise<LotAssignment[]> {
  const results = await Promise.all(
    allLots.map(async lot => {
      try {
        const { data } = await client.get<any>(`/lots/${lot.id}/assign-agency/`)
        if (data && data.agency_id) {
          return { lot_id: lot.id, agency_id: data.agency_id, agency_name: data.agency_name }
        }
        return null
      } catch {
        return null
      }
    })
  )
  return results.filter(Boolean) as LotAssignment[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot colours
// ─────────────────────────────────────────────────────────────────────────────

const LOT_COLOURS: Record<LotStatus, { bg: string; text: string; subtext: string; border: string; hover: string }> = {
  available: { bg: '#f0fdf4', text: '#14532d', subtext: '#16a34a', border: '#bbf7d0', hover: '#dcfce7' },
  on_hold:   { bg: '#fffbeb', text: '#78350f', subtext: '#d97706', border: '#fde68a', hover: '#fef3c7' },
  reserved:  { bg: '#eff6ff', text: '#1e3a5f', subtext: '#2563eb', border: '#bfdbfe', hover: '#dbeafe' },
  settled:   { bg: '#f9fafb', text: '#6b7280', subtext: '#9ca3af', border: '#e5e7eb', hover: '#f3f4f6' },
  draft:     { bg: '#f9fafb', text: '#9ca3af', subtext: '#d1d5db', border: '#e5e7eb', hover: '#f3f4f6' },
}

const LOT_TYPE_LABELS: Record<string, string> = {
  land: 'Land', house_and_land: 'H&L', apartment: 'Apt', townhouse: 'Twnh', commercial: 'Comm',
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard lot card (used in availability grid)
// ─────────────────────────────────────────────────────────────────────────────

function LotCard({ lot, onClick }: { lot: LotSummary; onClick: () => void }) {
  const c = LOT_COLOURS[lot.status] ?? LOT_COLOURS.draft
  const hasVitals = lot.bedrooms != null || lot.bathrooms != null || lot.car_spaces != null
  return (
    <div
      onClick={onClick}
      style={{
        background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12,
        padding: '14px 16px', cursor: 'pointer', minHeight: 110,
        display: 'flex', flexDirection: 'column', gap: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'background 0.12s, box-shadow 0.12s, transform 0.12s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.background = c.hover
        el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
        el.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.background = c.bg
        el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
        el.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: c.text }}>{lot.lot_number}</span>
        <span style={{ fontSize: 10, color: c.subtext, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500, opacity: 0.8 }}>
          {LOT_TYPE_LABELS[lot.lot_type] ?? lot.lot_type}
        </span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: c.subtext }}>{formatPrice(lot.current_price)}</div>
      {hasVitals && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lot.bedrooms != null && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: c.text, opacity: 0.75, fontWeight: 500 }}><BedDouble size={11} />{lot.bedrooms}</span>}
          {lot.bathrooms != null && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: c.text, opacity: 0.75, fontWeight: 500 }}><Bath size={11} />{lot.bathrooms}</span>}
          {lot.car_spaces != null && <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: c.text, opacity: 0.75, fontWeight: 500 }}><Car size={11} />{lot.car_spaces}</span>}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot selection card (used in agency exclusivity grid)
// Three states: mine (purple), locked (grey disabled), available (normal + clickable)
// ─────────────────────────────────────────────────────────────────────────────

function LotSelectCard({
  lot,
  state,
  lockedToAgencyName,
  onClick,
  isPending,
}: {
  lot: LotSummary
  state: 'mine' | 'locked' | 'available' | 'settled'
  lockedToAgencyName?: string
  onClick?: () => void
  isPending?: boolean
}) {
  const isClickable = state === 'mine' || state === 'available'

  const colours = {
    mine:      { bg: '#faf5ff', border: '#7c3aed', text: '#4c1d95', subtext: '#7c3aed' },
    locked:    { bg: '#f9fafb', border: '#e5e7eb', text: '#d1d5db', subtext: '#e5e7eb' },
    available: { bg: '#f8fafc', border: '#e2e8f0', text: '#374151', subtext: '#9ca3af' },
    settled:   { bg: '#f9fafb', border: '#e5e7eb', text: '#d1d5db', subtext: '#e5e7eb' },
  }

  const c = colours[state]

  return (
    <div
      onClick={isClickable && !isPending ? onClick : undefined}
      style={{
        background: c.bg,
        border: `2px solid ${state === 'mine' ? c.border : c.border}`,
        borderRadius: 10,
        padding: '10px 12px',
        cursor: isClickable ? 'pointer' : 'default',
        opacity: isPending ? 0.5 : 1,
        position: 'relative',
        transition: 'border-color 0.12s, box-shadow 0.12s',
        boxShadow: state === 'mine' ? '0 0 0 1px #ddd6fe' : 'none',
      }}
      onMouseEnter={e => {
        if (!isClickable || isPending) return
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = state === 'mine'
          ? '0 0 0 2px #c4b5fd'
          : '0 2px 8px rgba(0,0,0,0.1)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement
        el.style.boxShadow = state === 'mine' ? '0 0 0 1px #ddd6fe' : 'none'
      }}
      title={
        state === 'locked' ? `Locked to ${lockedToAgencyName}` :
        state === 'settled' ? 'Settled — cannot be allocated' :
        state === 'mine' ? 'Click to remove exclusive allocation' :
        'Click to exclusively allocate to this agency'
      }
    >
      {/* Lock icon for mine state */}
      {state === 'mine' && (
        <div style={{ position: 'absolute', top: 6, right: 6 }}>
          <Lock size={10} color="#7c3aed" />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{lot.lot_number}</span>
        <span style={{ fontSize: 9, color: c.subtext, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
          {LOT_TYPE_LABELS[lot.lot_type] ?? lot.lot_type}
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: c.subtext }}>
        {formatPrice(lot.current_price)}
      </div>
      {state === 'locked' && lockedToAgencyName && (
        <div style={{ fontSize: 9, color: '#d1d5db', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lockedToAgencyName}
        </div>
      )}
      {state === 'mine' && (
        <div style={{ fontSize: 9, color: '#a78bfa', marginTop: 3 }}>Tap to release</div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot exclusivity grid — shown when an agency row is expanded
// ─────────────────────────────────────────────────────────────────────────────

function LotExclusivityGrid({
  agency,
  project,
}: {
  agency: ProjectAgency
  project: ProjectDetailWithAmenities
}) {
  const queryClient = useQueryClient()
  const [pendingLotId, setPendingLotId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allLots: LotSummary[] = project.stages.flatMap(s => s.lots)

  // Fetch all exclusive assignments for this project
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['lot-assignments', project.id],
    queryFn: () => fetchProjectLotAssignments(allLots),
    staleTime: 30_000,
  })

  // Build lookup maps
  const assignmentMap = new Map(assignments.map(a => [a.lot_id, a]))
  const myLotIds = new Set(assignments.filter(a => a.agency_id === agency.agency_id).map(a => a.lot_id))
  const lockedToOtherIds = new Set(assignments.filter(a => a.agency_id !== agency.agency_id).map(a => a.lot_id))

  const { mutate: assignLot } = useMutation({
    mutationFn: async (lotId: string) => {
      setPendingLotId(lotId)
      await client.post(`/lots/${lotId}/assign-agency/`, { agency_id: agency.agency_id })
    },
    onSuccess: () => {
      setPendingLotId(null)
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['lot-assignments', project.id] })
    },
    onError: (err: any) => {
      setPendingLotId(null)
      setError(err?.response?.data?.detail ?? 'Failed to assign lot.')
    },
  })

  const { mutate: releaseLot } = useMutation({
    mutationFn: async (lotId: string) => {
      setPendingLotId(lotId)
      await client.delete(`/lots/${lotId}/assign-agency/`)
    },
    onSuccess: () => {
      setPendingLotId(null)
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['lot-assignments', project.id] })
    },
    onError: (err: any) => {
      setPendingLotId(null)
      setError(err?.response?.data?.detail ?? 'Failed to release lot.')
    },
  })

  const handleLotClick = (lot: LotSummary) => {
    if (pendingLotId) return
    setError(null)
    if (myLotIds.has(lot.id)) {
      releaseLot(lot.id)
    } else {
      assignLot(lot.id)
    }
  }

  const myCount = myLotIds.size

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
          Exclusive lot allocation
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {myCount > 0 && (
            <span style={{ fontSize: 11, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 99, padding: '2px 8px', fontWeight: 600 }}>
              {myCount} allocated
            </span>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { colour: '#7c3aed', label: 'Allocated to this agency' },
              { colour: '#e5e7eb', label: 'Locked to another agency', border: '#d1d5db' },
              { colour: '#f0fdf4', label: 'Available to allocate', border: '#bbf7d0' },
            ].map(({ colour, label, border }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: colour, border: border ? `1px solid ${border}` : 'none' }} />
                <span style={{ fontSize: 10, color: '#9ca3af' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
          {allLots.slice(0, 6).map(lot => (
            <div key={lot.id} style={{ height: 70, background: '#f1f5f9', borderRadius: 10 }} />
          ))}
        </div>
      ) : (
        <>
          {project.stages
            .slice()
            .sort((a, b) => a.stage_number - b.stage_number)
            .map(stage => (
              <div key={stage.id} style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, margin: '0 0 6px' }}>{stage.name}</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                  {stage.lots.map(lot => {
                    const state = myLotIds.has(lot.id)
                      ? 'mine'
                      : lockedToOtherIds.has(lot.id)
                      ? 'locked'
                      : lot.status === 'settled'
                      ? 'settled'
                      : 'available'

                    const assignment = assignmentMap.get(lot.id)

                    return (
                      <LotSelectCard
                        key={lot.id}
                        lot={lot}
                        state={state}
                        lockedToAgencyName={state === 'locked' ? assignment?.agency_name : undefined}
                        onClick={() => handleLotClick(lot)}
                        isPending={pendingLotId === lot.id}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
        </>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
          <AlertCircle size={12} color="#dc2626" />
          <p style={{ fontSize: 11, color: '#dc2626', margin: 0 }}>{error}</p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot availability section — always visible
// ─────────────────────────────────────────────────────────────────────────────

function LotStatusLegend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', paddingTop: 4 }}>
      {[
        { label: 'Available', colour: '#10b981' },
        { label: 'On hold',   colour: '#f59e0b' },
        { label: 'Reserved+', colour: '#3b82f6' },
        { label: 'Settled',   colour: '#9ca3af' },
        { label: 'Draft',     colour: '#e5e7eb', border: '#d1d5db' },
      ].map(({ label, colour, border }) => (
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
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
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

function LotAvailability({ project, onLotClick }: { project: ProjectDetailWithAmenities; onLotClick: (id: string) => void }) {
  const c = project.lot_counts
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { value: c.total,     label: 'Total',     colour: '#111827', bg: '#f8fafc' },
          { value: c.available, label: 'Available', colour: '#059669', bg: '#f0fdf4' },
          { value: c.on_hold,   label: 'On hold',   colour: '#d97706', bg: '#fffbeb' },
          { value: c.reserved,  label: 'Reserved+', colour: '#2563eb', bg: '#eff6ff' },
          { value: c.settled,   label: 'Settled',   colour: '#9ca3af', bg: '#f9fafb' },
        ].map(({ value, label, colour, bg }) => (
          <div key={label} style={{ background: bg, border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 22, fontWeight: 600, color: colour, lineHeight: 1 }}>{value}</p>
            <p style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>{label}</p>
          </div>
        ))}
        <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: '12px 16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: 22, fontWeight: 600, color: '#7c3aed', lineHeight: 1 }}>{formatGR(c.total_gr)}</p>
          <p style={{ marginTop: 4, fontSize: 11, color: '#a78bfa' }}>Gross revenue</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {project.stages.slice().sort((a, b) => a.stage_number - b.stage_number).map(stage => (
          <StageSection key={stage.id} stage={stage} onLotClick={onLotClick} />
        ))}
      </div>
      <div style={{ marginTop: 12 }}><LotStatusLegend /></div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Image slideshow
// ─────────────────────────────────────────────────────────────────────────────

function ImageSlideshow({ images }: { images: ProjectMedia[] }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused]   = useState(false)
  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length])

  useEffect(() => {
    if (paused || images.length <= 1) return
    const t = setInterval(next, 5000)
    return () => clearInterval(t)
  }, [paused, next, images.length])

  if (images.length === 0) return null
  const img = images[current]

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', position: 'relative', height: 320, background: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <img key={img.id} src={img.file_url ?? ''} alt={img.title}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.9 }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {img.title && <p style={{ fontSize: 13, fontWeight: 600, color: '#fff', margin: 0 }}>{img.title}</p>}
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0, textTransform: 'capitalize' }}>
              {img.category.replace('_', ' ')} · {current + 1} of {images.length}
            </p>
          </div>
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {images.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} style={{ width: i === current ? 20 : 6, height: 6, borderRadius: 99, background: i === current ? '#fff' : 'rgba(255,255,255,0.4)', border: 'none', cursor: 'pointer', padding: 0, transition: 'width 0.2s' }} />
              ))}
            </div>
          )}
        </div>
      </div>
      {images.length > 1 && (
        <>
          <button onClick={prev} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <ChevronLeft size={18} />
          </button>
          <button onClick={next} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <ChevronRight size={18} />
          </button>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Info row
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '8px 0', fontSize: 13 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: '#111827' }}>{value ?? '—'}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Agencies section with expandable lot grid
// ─────────────────────────────────────────────────────────────────────────────

function AgenciesSection({ project }: { project: ProjectDetailWithAmenities }) {
  const user        = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd]               = useState(false)
  const [selectedId, setSelectedId]         = useState('')
  const [error, setError]                   = useState<string | null>(null)
  const [removeError, setRemoveError]       = useState<string | null>(null)
  const [expandedAgency, setExpandedAgency] = useState<string | null>(null)
  const isInternalUser = !(user as any)?.agent

  const { data: assigned = [], isLoading } = useQuery({
    queryKey: ['projects', project.id, 'agencies'],
    queryFn: () => fetchProjectAgencies(project.id),
    staleTime: 30_000,
  })

  const { data: allAgencies = [] } = useQuery({
    queryKey: ['agencies', 'list'],
    queryFn: fetchAllAgencies,
    enabled: isInternalUser && showAdd,
    staleTime: 60_000,
  })

  const assignedIds = new Set(assigned.map(a => a.agency_id))
  const available   = allAgencies.filter(a => !assignedIds.has(a.id))

  const { mutate: assignAgency, isPending: isAssigning } = useMutation({
    mutationFn: async (agencyId: string) => {
      await client.post(`/projects/${project.id}/agencies/`, { agency_id: agencyId })
    },
    onSuccess: () => {
      setShowAdd(false); setSelectedId(''); setError(null)
      queryClient.invalidateQueries({ queryKey: ['projects', project.id, 'agencies'] })
    },
    onError: (err: any) => setError(err?.response?.data?.detail ?? 'Failed to assign agency.'),
  })

  const { mutate: removeAgency, isPending: isRemoving } = useMutation({
    mutationFn: async (agencyId: string) => {
      await client.delete(`/projects/${project.id}/agencies/${agencyId}/`)
    },
    onSuccess: () => {
      setRemoveError(null)
      queryClient.invalidateQueries({ queryKey: ['projects', project.id, 'agencies'] })
    },
    onError: (err: any) => setRemoveError(err?.response?.data?.detail ?? 'Failed to remove agency.'),
  })

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', margin: 0 }}>Agency access</h3>
          {isInternalUser && assigned.length > 0 && (
            <p style={{ fontSize: 11, color: '#d1d5db', margin: '3px 0 0', fontStyle: 'italic' }}>
              Expand an agency to manage exclusive lot allocations
            </p>
          )}
        </div>
        {isInternalUser && !showAdd && (
          <button onClick={() => { setShowAdd(true); setError(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 500, color: '#374151', cursor: 'pointer' }}>
            <Plus size={11} /> Add agency
          </button>
        )}
      </div>

      {/* Add form */}
      {isInternalUser && showAdd && (
        <div style={{ background: '#f8fafc', borderRadius: 8, padding: 14, marginBottom: 14, border: '1px solid #e2e8f0' }}>
          {available.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', margin: 0 }}>All agencies are already assigned.</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                style={{ flex: 1, borderRadius: 7, border: '1px solid #e2e8f0', padding: '6px 8px', fontSize: 12, color: '#111827' }}>
                <option value="">Choose an agency…</option>
                {available.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button onClick={() => selectedId && assignAgency(selectedId)} disabled={!selectedId || isAssigning}
                style={{ borderRadius: 7, background: '#111827', padding: '6px 14px', fontSize: 12, fontWeight: 500, color: '#fff', cursor: 'pointer', border: 'none', opacity: (!selectedId || isAssigning) ? 0.4 : 1, whiteSpace: 'nowrap' }}>
                {isAssigning ? 'Assigning…' : 'Assign'}
              </button>
              <button onClick={() => { setShowAdd(false); setError(null) }}
                style={{ borderRadius: 7, border: '1px solid #e2e8f0', padding: '6px 10px', fontSize: 12, color: '#6b7280', cursor: 'pointer', background: '#fff' }}>
                <X size={13} />
              </button>
            </div>
          )}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 10px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
              <AlertCircle size={12} color="#dc2626" />
              <p style={{ fontSize: 11, color: '#dc2626', margin: 0 }}>{error}</p>
            </div>
          )}
        </div>
      )}

      {removeError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 10px', background: '#fef2f2', borderRadius: 6, border: '1px solid #fecaca' }}>
          <AlertCircle size={12} color="#dc2626" />
          <p style={{ fontSize: 11, color: '#dc2626', margin: 0 }}>{removeError}</p>
        </div>
      )}

      {/* Agency list */}
      {isLoading ? (
        <div style={{ height: 40, background: '#f1f5f9', borderRadius: 8 }} />
      ) : assigned.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Users size={22} color="#e2e8f0" style={{ marginBottom: 6 }} />
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>No agencies assigned yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {assigned.map(pa => {
            const isExpanded = expandedAgency === pa.agency_id
            return (
              <div key={pa.id} style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden', background: isExpanded ? '#fafaf9' : '#f8fafc' }}>
                {/* Agency header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={13} color="#9ca3af" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{pa.agency_name}</p>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                      Assigned {new Date(pa.assigned_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {pa.assigned_by_name ? ` by ${pa.assigned_by_name}` : ''}
                    </p>
                  </div>
                  {isInternalUser && (
                    <>
                      {/* Expand/collapse lot allocation */}
                      <button
                        onClick={() => setExpandedAgency(isExpanded ? null : pa.agency_id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: isExpanded ? '#f5f3ff' : 'none', border: `1px solid ${isExpanded ? '#ddd6fe' : '#e2e8f0'}`, borderRadius: 6, padding: '4px 8px', fontSize: 11, color: isExpanded ? '#7c3aed' : '#6b7280', cursor: 'pointer', transition: 'all 0.15s' }}>
                        <Lock size={11} />
                        Lots
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      {/* Remove agency */}
                      <button onClick={() => { setRemoveError(null); removeAgency(pa.agency_id) }} disabled={isRemoving}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 4, borderRadius: 6, flexShrink: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
                        title="Remove agency access">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>

                {/* Expanded lot grid */}
                {isExpanded && isInternalUser && (
                  <div style={{ padding: '0 12px 14px' }}>
                    <LotExclusivityGrid agency={pa} project={project} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!isInternalUser && assigned.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', marginTop: 10, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
          <AlertCircle size={13} color="#0284c7" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 11, color: '#0369a1', margin: 0 }}>Contact the developer to update agency access for this project.</p>
        </div>
      )}
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

function UploadForm({ projectId, onSuccess, onCancel }: { projectId: string; onSuccess: () => void; onCancel: () => void }) {
  const [title, setTitle]       = useState('')
  const [category, setCategory] = useState<UploadCategory>('gallery')
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
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Upload media</h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={16} /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as UploadCategory)}
            style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '6px 10px', fontSize: 13 }}>
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>
            Title <span style={{ color: '#d1d5db' }}>(optional)</span>
          </label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Display name"
            style={{ width: '100%', borderRadius: 8, border: '1px solid #e2e8f0', padding: '6px 10px', fontSize: 13, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 4 }}>File</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px dashed #d1d5db', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: '#9ca3af' }}>
            <Upload size={14} />
            {file ? <span style={{ color: '#111827' }}>{file.name}</span> : <span>Click to choose a file</span>}
            <input type="file" style={{ display: 'none' }} accept={mediaType === 'image' ? 'image/*' : '.pdf,.doc,.docx'}
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <p style={{ fontSize: 12, color: '#dc2626' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={{ borderRadius: 8, border: '1px solid #e2e8f0', padding: '6px 14px', fontSize: 12, fontWeight: 500, color: '#6b7280', cursor: 'pointer', background: '#fff' }}>Cancel</button>
          <button onClick={() => upload()} disabled={isPending || !file} style={{ borderRadius: 8, background: '#111827', padding: '6px 14px', fontSize: 12, fontWeight: 500, color: '#fff', cursor: 'pointer', border: 'none', opacity: (!file || isPending) ? 0.4 : 1 }}>
            {isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Info tab
// Order: amenities > gallery+about > billing > agencies > solicitor > documents
// ─────────────────────────────────────────────────────────────────────────────

function ProjectInfoTab({ project }: { project: ProjectDetailWithAmenities }) {
  const user        = useAuthStore(s => s.user)
  const queryClient = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const canUpload = (user as any)?.role?.permissions?.some((p: any) => p.code === 'project.manage_media') ?? false
  const images = [...(project.media.hero ?? []), ...(project.media.gallery ?? [])]
  const docs   = [...(project.media.brochure ?? []), ...(project.media.site_map ?? []), ...(project.media.floor_plan ?? []), ...(project.media.other ?? [])]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* 1. Amenities */}
      {project.amenities && project.amenities.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 12 }}>Amenities</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {project.amenities.map(a => (
              <div key={a.code} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 99, padding: '5px 12px', fontSize: 12, color: '#374151', fontWeight: 500 }}>
                <i className={a.icon} style={{ fontSize: 13, color: '#6b7280' }} />
                {a.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Gallery + About */}
      <div style={{ display: 'grid', gridTemplateColumns: images.length > 0 ? '1fr 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
        {images.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ImageSlideshow images={images} />
            {canUpload && !showUpload && (
              <button onClick={() => setShowUpload(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#374151', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', alignSelf: 'flex-start' }}>
                <Upload size={12} /> Upload media
              </button>
            )}
            {canUpload && showUpload && (
              <UploadForm projectId={project.id}
                onSuccess={() => { setShowUpload(false); queryClient.invalidateQueries({ queryKey: ['projects', 'detail', project.id] }) }}
                onCancel={() => setShowUpload(false)} />
            )}
          </div>
        )}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 10 }}>About this project</h3>
          {project.description
            ? <p style={{ fontSize: 13, lineHeight: 1.7, color: '#374151' }}>{project.description}</p>
            : <p style={{ fontSize: 13, fontStyle: 'italic', color: '#9ca3af' }}>No description added yet.</p>
          }
          {project.website_url && (
            <a href={project.website_url} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10, fontSize: 13, color: '#2563eb' }}>
              {project.website_url.replace(/^https?:\/\//, '')}
              <ExternalLink size={12} />
            </a>
          )}
          {images.length === 0 && canUpload && !showUpload && (
            <button onClick={() => setShowUpload(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#374151', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              <Upload size={12} /> Upload media
            </button>
          )}
          {images.length === 0 && canUpload && showUpload && (
            <div style={{ marginTop: 14 }}>
              <UploadForm projectId={project.id}
                onSuccess={() => { setShowUpload(false); queryClient.invalidateQueries({ queryKey: ['projects', 'detail', project.id] }) }}
                onCancel={() => setShowUpload(false)} />
            </div>
          )}
        </div>
      </div>

      {/* 3. Billing */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 10 }}>Billing</h3>
        <InfoRow label="Status"       value={project.billing_status} />
        <InfoRow label="Billing lots" value={project.billing_lot_count} />
        <InfoRow label="Start date"   value={project.billing_start_date} />
        <InfoRow label="End date"     value={project.billing_end_date ?? 'Active'} />
        <InfoRow label="Stages"       value={project.stages.length} />
      </div>

      {/* 4. Agency access */}
      <AgenciesSection project={project} />

      {/* 5. Vendor solicitor */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 10 }}>Vendor solicitor</h3>
        {project.solicitor ? (
          <>
            <InfoRow label="Name"  value={project.solicitor.full_name} />
            <InfoRow label="Firm"  value={project.solicitor.firm_name} />
            <InfoRow label="Email" value={<a href={`mailto:${project.solicitor.email}`} style={{ color: '#2563eb' }}>{project.solicitor.email}</a>} />
            <InfoRow label="Phone" value={project.solicitor.phone} />
          </>
        ) : (
          <p style={{ fontSize: 13, fontStyle: 'italic', color: '#9ca3af' }}>No solicitor assigned.</p>
        )}
      </div>

      {/* 6. Documents */}
      {docs.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 14 }}>Documents &amp; collateral</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
            {docs.map(doc => (
              <a key={doc.id} href={doc.file_url ?? '#'} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #f1f5f9', borderRadius: 8, padding: '8px 12px', textDecoration: 'none' }}
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
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'info' | 'reports'

const TABS: { value: Tab; label: string }[] = [
  { value: 'info',    label: 'Project info' },
  { value: 'reports', label: 'Reports' },
]

const STATUS_BADGE = {
  active:    { label: 'Active',    bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
  draft:     { label: 'Draft',     bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  completed: { label: 'Completed', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
} as const

export default function ProjectDetailPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const [activeTab, setActiveTab]         = useState<Tab>('info')
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)

  const { data: project, isLoading, isError } = useProjectDetail(id ?? null)

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: 24 }}>
        <div style={{ height: 160, borderRadius: 12, background: '#e2e8f0', marginBottom: 12 }} />
        {[1, 2, 3].map(i => <div key={i} style={{ height: 60, borderRadius: 12, background: '#e2e8f0', marginBottom: 8 }} />)}
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
  const s = STATUS_BADGE[project.status] ?? STATUS_BADGE.draft

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

      {/* ── Hero header ── */}
      <div style={{ position: 'relative', overflow: 'hidden', background: hasHero ? '#111827' : '#fff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', minHeight: hasHero ? 180 : 'auto' }}>
        {hasHero && (
          <>
            <img src={heroImage!} alt={project.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.5 }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.65) 100%)' }} />
          </>
        )}
        <div style={{ position: 'relative', padding: '16px 24px 22px' }}>
          <button onClick={() => navigate('/projects')} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: hasHero ? 'rgba(255,255,255,0.7)' : '#9ca3af' }}>
            <ArrowLeft size={13} /> All projects
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: hasHero ? '#fff' : '#111827' }}>{project.name}</h1>
            {hasHero
              ? <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 99, padding: '3px 12px', fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', backdropFilter: 'blur(4px)' }}>{s.label}</span>
              : <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 500, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
            }
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
            {[
              { icon: <MapPin size={12} />, text: project.address },
              project.billing_start_date ? { icon: <CalendarDays size={12} />, text: `Active since ${project.billing_start_date}` } : null,
              { icon: <Layers size={12} />, text: `${project.lot_counts.total} lots · ${project.stages.length} stage${project.stages.length !== 1 ? 's' : ''}` },
              project.lot_counts.total_gr ? { icon: null, text: `GR ${formatGR(project.lot_counts.total_gr)}`, highlight: true } : null,
              project.website_url ? { icon: <Globe size={12} />, text: project.website_url.replace(/^https?:\/\//, '') } : null,
            ].filter(Boolean).map((item, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: hasHero ? (item!.highlight ? '#c4b5fd' : 'rgba(255,255,255,0.75)') : (item!.highlight ? '#7c3aed' : '#9ca3af'), fontWeight: item!.highlight ? 600 : 400 }}>
                {item!.icon}{item!.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lot availability ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 24px' }}>
        <h2 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 14 }}>Lot availability</h2>
        <LotAvailability project={project} onLotClick={setSelectedLotId} />
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#fff', paddingLeft: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {TABS.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '12px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: 'none', border: 'none', borderBottom: '2px solid',
            borderBottomColor: activeTab === tab.value ? '#111827' : 'transparent',
            color: activeTab === tab.value ? '#111827' : '#9ca3af',
            transition: 'color 0.15s, border-color 0.15s',
          }}>
            {tab.value === 'reports' && <BarChart3 size={13} />}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: 24 }}>
        {activeTab === 'info'    && <ProjectInfoTab project={project} />}
        {activeTab === 'reports' && <ProjectReportsTab project={project} />}
      </div>

      {/* ── Lot detail panel ── */}
      {selectedLotId && (
        <LotDetailPanel lotId={selectedLotId} onClose={() => setSelectedLotId(null)} />
      )}
    </div>
  )
}