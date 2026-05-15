// src/features/projects/ProjectDetailPage.tsx
// Route: /projects/:id

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, MapPin, CalendarDays, Globe, Layers,
  Building2, FileText, Image, Download, ExternalLink, Upload, X, Plus,
  BedDouble, Bath, Car, BarChart2,
} from 'lucide-react'
import client from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import LotDetailPanel from './LotDetailPanel'
import ProjectReportsTab from './ProjectReportsTab'
import NewSaleModal from '../sales/NewSaleModal'
import type { LotSummary, LotStatus, ProjectDetail, Stage } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Shared card style
// ─────────────────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e8e2dd',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(44,36,32,0.06), 0 2px 8px rgba(44,36,32,0.06)',
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
  active:    { label: 'Active',    bg: '#eef7f0', color: '#1a5c2e', border: '#b8dfc3' },
  draft:     { label: 'Draft',     bg: '#f2f0ee', color: '#7a6e68', border: '#ddd7d2' },
  completed: { label: 'Completed', bg: '#eef2fb', color: '#1e3a7a', border: '#c5d3f0' },
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
  available: { bg: '#eef7f0', text: '#1a5c2e', subtext: '#237a3d', border: '#b8dfc3', hover: '#e0f0e3' },
  on_hold:   { bg: '#fef6ec', text: '#7a4a00', subtext: '#9a5f00', border: '#fcd9a0', hover: '#fdeedd' },
  reserved:  { bg: '#eef2fb', text: '#1e3a7a', subtext: '#2649a0', border: '#c5d3f0', hover: '#e3eaf8' },
  settled:   { bg: '#f2f0ee', text: '#6b6460', subtext: '#8a8280', border: '#ddd7d2', hover: '#ebe8e5' },
  draft:     { bg: '#faf8f7', text: '#a89e98', subtext: '#c4bab5', border: '#ddd7d2', hover: '#f2f0ee' },
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

function LotCard({
  lot,
  onClick,
  compareMode = false,
  isCompared = false,
}: {
  lot: LotSummary
  onClick: () => void
  compareMode?: boolean
  isCompared?: boolean
}) {
  const c = LOT_STATUS_COLOURS[lot.status] ?? LOT_STATUS_COLOURS.draft
  const hasVitals = lot.bedrooms != null || lot.bathrooms != null || lot.car_spaces != null
  const canCompare = compareMode && lot.status !== 'settled' && lot.status !== 'draft'

  return (
    <div
      onClick={onClick}
      style={{
        background: isCompared ? '#eef2fb' : c.bg,
        border: isCompared ? '2px solid #4a72c4' : `1px solid ${c.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'background 0.12s, box-shadow 0.12s, transform 0.12s',
        boxShadow: isCompared
          ? '0 0 0 3px rgba(74,114,196,0.15)'
          : '0 1px 2px rgba(44,36,32,0.06), 0 2px 8px rgba(44,36,32,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 110,
        position: 'relative',
        opacity: compareMode && !canCompare && !isCompared ? 0.45 : 1,
      }}
      onMouseEnter={e => {
        if (!isCompared) {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = c.hover
          el.style.boxShadow = '0 4px 8px rgba(44,36,32,0.10), 0 8px 20px rgba(44,36,32,0.08)'
          el.style.transform = 'translateY(-1px)'
        }
      }}
      onMouseLeave={e => {
        if (!isCompared) {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = c.bg
          el.style.boxShadow = '0 1px 2px rgba(44,36,32,0.06), 0 2px 8px rgba(44,36,32,0.06)'
          el.style.transform = 'translateY(0)'
        }
      }}
    >
      {/* Compare checkbox indicator */}
      {compareMode && canCompare && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          width: 18, height: 18, borderRadius: 4,
          background: isCompared ? '#4a72c4' : '#fff',
          border: isCompared ? '2px solid #4a72c4' : '1.5px solid #d4ccc5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isCompared && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1, fontWeight: 700 }}>✓</span>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: compareMode && canCompare ? 22 : 0 }}>
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
// Lot Compare Panel
// ─────────────────────────────────────────────────────────────────────────────

function pct(val: number, arr: number[]): number {
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  return max === min ? 60 : Math.round(((val - min) / (max - min)) * 65 + 20)
}

function LotComparePanel({
  lots,
  onRemove,
  onRegisterSale,
  onClose,
}: {
  lots: LotSummary[]
  onRemove: (id: string) => void
  onRegisterSale: (lot: LotSummary) => void
  onClose: () => void
}) {
  const prices  = lots.map(l => l.current_price ?? 0)
  const sizes   = lots.map(l => (l as any).floor_area ?? (l as any).land_area ?? 0)
  const levels  = lots.map(l => (l as any).level ?? 0)

  const rows: { label: string; vals: string[]; bars?: number[]; bestIdx?: number }[] = [
    {
      label: 'Price',
      vals: lots.map(l => formatPrice(l.current_price)),
      bars: lots.map(l => pct(l.current_price ?? 0, prices)),
      bestIdx: prices.reduce((bi, v, i, a) => v < a[bi] && v > 0 ? i : bi, 0),
    },
    {
      label: 'Internal size',
      vals: lots.map(l => (l as any).floor_area ? `${(l as any).floor_area}m²` : '—'),
      bars: sizes.some(s => s > 0) ? lots.map(l => pct((l as any).floor_area ?? 0, sizes)) : undefined,
      bestIdx: sizes.reduce((bi, v, i, a) => v > a[bi] ? i : bi, 0),
    },
    {
      label: 'Land area',
      vals: lots.map(l => (l as any).land_area ? `${(l as any).land_area}m²` : '—'),
    },
    {
      label: 'Bedrooms',
      vals: lots.map(l => l.bedrooms != null ? String(l.bedrooms) : '—'),
    },
    {
      label: 'Bathrooms',
      vals: lots.map(l => l.bathrooms != null ? String(l.bathrooms) : '—'),
    },
    {
      label: 'Car spaces',
      vals: lots.map(l => l.car_spaces != null ? String(l.car_spaces) : '—'),
    },
    {
      label: 'Level',
      vals: lots.map(l => (l as any).level != null ? `Level ${(l as any).level}` : '—'),
      bars: levels.some(l => l > 0) ? lots.map(l => pct((l as any).level ?? 0, levels)) : undefined,
      bestIdx: levels.reduce((bi, v, i, a) => v > a[bi] ? i : bi, 0),
    },
    {
      label: 'Aspect',
      vals: lots.map(l => (l as any).aspect ?? '—'),
    },
    {
      label: 'Type',
      vals: lots.map(l => LOT_TYPE_LABELS[l.lot_type] ?? l.lot_type),
    },
    {
      label: 'Inclusions',
      vals: lots.map(l => (l as any).inclusions ?? '—'),
    },
  ]

  const STATUS_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
    available: { bg: '#eef7f0', text: '#1a5c2e', border: '#b8dfc3' },
    on_hold:   { bg: '#fef6ec', text: '#7a4a00', border: '#fcd9a0' },
    reserved:  { bg: '#eef2fb', text: '#1e3a7a', border: '#c5d3f0' },
    settled:   { bg: '#f2f0ee', text: '#6b6460', border: '#ddd7d2' },
    draft:     { bg: '#faf8f7', text: '#a89e98', border: '#ddd7d2' },
  }

  return (
    <div style={{ ...CARD, overflow: 'hidden', marginTop: 8 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid #e8e2dd',
        background: '#f9f6f4',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart2 size={15} color="#c0533a" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#2c2420' }}>
            Comparing {lots.length} lot{lots.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a89e98', padding: 4 }}>
          <X size={15} />
        </button>
      </div>

      {/* Lot headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `160px ${lots.map(() => '1fr').join(' ')}`,
        borderBottom: '1px solid #e8e2dd',
      }}>
        <div style={{ padding: '14px 16px' }} />
        {lots.map(lot => {
          const sc = STATUS_COLOURS[lot.status] ?? STATUS_COLOURS.draft
          return (
            <div key={lot.id} style={{ padding: '14px 16px', borderLeft: '1px solid #e8e2dd' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#2c2420' }}>{lot.lot_number}</div>
                  <div style={{ fontSize: 11, color: '#a89e98', marginTop: 2 }}>
                    {LOT_TYPE_LABELS[lot.lot_type] ?? lot.lot_type}
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', marginTop: 6,
                    borderRadius: 99, padding: '2px 8px', fontSize: 10, fontWeight: 500,
                    background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`,
                  }}>
                    {lot.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                </div>
                <button
                  onClick={() => onRemove(lot.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d4ccc5', padding: 2, flexShrink: 0 }}
                  title="Remove from comparison"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Comparison rows */}
      {rows.map((row, ri) => {
        const allDash = row.vals.every(v => v === '—')
        if (allDash) return null
        return (
          <div key={row.label} style={{
            display: 'grid',
            gridTemplateColumns: `160px ${lots.map(() => '1fr').join(' ')}`,
            borderBottom: ri < rows.length - 1 ? '1px solid #f0ebe6' : 'none',
            background: ri % 2 === 0 ? '#ffffff' : '#faf8f7',
          }}>
            <div style={{ padding: '10px 16px', fontSize: 12, color: '#7a6e68', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
              {row.label}
            </div>
            {row.vals.map((val, i) => {
              const isBest = row.bestIdx === i && val !== '—' && row.vals.filter(v => v !== '—').length > 1
              return (
                <div key={i} style={{ padding: '10px 16px', borderLeft: '1px solid #f0ebe6' }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: isBest ? 600 : 400,
                    color: isBest ? '#237a3d' : val === '—' ? '#d4ccc5' : '#2c2420',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {val}
                    {isBest && <span style={{ fontSize: 10, color: '#237a3d', background: '#eef7f0', border: '1px solid #b8dfc3', borderRadius: 99, padding: '1px 6px' }}>best</span>}
                  </div>
                  {row.bars && val !== '—' && (
                    <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: '#f0ebe6', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 2,
                        background: isBest ? '#52a96e' : '#4a72c4',
                        width: `${row.bars[i]}%`,
                        transition: 'width 0.3s',
                      }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Action row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `160px ${lots.map(() => '1fr').join(' ')}`,
        borderTop: '1px solid #e8e2dd',
        background: '#f9f6f4',
      }}>
        <div style={{ padding: '12px 16px', fontSize: 12, color: '#7a6e68', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
          Action
        </div>
        {lots.map(lot => (
          <div key={lot.id} style={{ padding: '12px 16px', borderLeft: '1px solid #e8e2dd' }}>
            {lot.status === 'available' ? (
              <button
                onClick={() => onRegisterSale(lot)}
                style={{
                  width: '100%', padding: '7px 12px', borderRadius: 6,
                  background: '#c0533a', color: '#fff', border: 'none',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Register sale
              </button>
            ) : (
              <span style={{ fontSize: 12, color: '#a89e98' }}>
                {lot.status === 'on_hold' ? 'On hold' : lot.status === 'reserved' ? 'Reserved' : 'Not available'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lots & Stages section
// ─────────────────────────────────────────────────────────────────────────────

function LotStatusLegend() {
  const items = [
    { label: 'Available', colour: '#52a96e' },
    { label: 'On hold',   colour: '#d4920e' },
    { label: 'Reserved+', colour: '#4a72c4' },
    { label: 'Settled',   colour: '#b0a8a2' },
    { label: 'Draft',     colour: '#ddd7d2', border: '#c4bab5' },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', paddingTop: 8 }}>
      {items.map(({ label, colour, border }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: colour, border: border ? `1px solid ${border}` : 'none' }} />
          <span style={{ fontSize: 11, color: '#a89e98' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

function StageSection({
  stage,
  compareMode,
  compareIds,
  onLotClick,
  onToggleCompare,
}: {
  stage: Stage
  compareMode: boolean
  compareIds: string[]
  onLotClick: (id: string) => void
  onToggleCompare: (id: string) => void
}) {
  return (
    <div style={{ ...CARD, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#2c2420' }}>{stage.name}</h3>
        <span style={{ fontSize: 11, color: '#a89e98' }}>
          {stage.lot_count} lot{stage.lot_count !== 1 ? 's' : ''}
          {stage.expected_release ? ` · Release ${stage.expected_release}` : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))' }}>
        {stage.lots.map(lot => (
          <LotCard
            key={lot.id}
            lot={lot}
            compareMode={compareMode}
            isCompared={compareIds.includes(lot.id)}
            onClick={() => compareMode ? onToggleCompare(lot.id) : onLotClick(lot.id)}
          />
        ))}
      </div>
    </div>
  )
}

function LotsSection({
  project,
  onLotClick,
  onRegisterSale,
}: {
  project: ProjectDetail
  onLotClick: (id: string) => void
  onRegisterSale: (lot: LotSummary) => void
}) {
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds]   = useState<string[]>([])

  const allLots = project.stages.flatMap(s => s.lots)
  const compareLots = compareIds.map(id => allLots.find(l => l.id === id)).filter(Boolean) as LotSummary[]

  const toggleCompare = (id: string) => {
    setCompareIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 3 ? [...prev, id] : prev
    )
  }

  const exitCompare = () => {
    setCompareMode(false)
    setCompareIds([])
  }

  const c = project.lot_counts
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {[
          { value: c.total,     label: 'Total',     colour: '#2c2420', bg: '#f9f6f4' },
          { value: c.available, label: 'Available', colour: '#237a3d', bg: '#eef7f0' },
          { value: c.on_hold,   label: 'On hold',   colour: '#9a5f00', bg: '#fef6ec' },
          { value: c.reserved,  label: 'Reserved+', colour: '#2649a0', bg: '#eef2fb' },
          { value: c.settled,   label: 'Settled',   colour: '#8a8280', bg: '#f2f0ee' },
        ].map(({ value, label, colour, bg }) => (
          <div key={label} style={{ ...CARD, background: bg, padding: '12px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 22, fontWeight: 600, color: colour, lineHeight: 1 }}>{value}</p>
            <p style={{ marginTop: 4, fontSize: 11, color: '#a89e98' }}>{label}</p>
          </div>
        ))}
        <div style={{ ...CARD, background: '#f7ece9', border: '1px solid #e8c4bb', padding: '12px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 22, fontWeight: 600, color: '#c0533a', lineHeight: 1 }}>{formatGR(c.total_gr)}</p>
          <p style={{ marginTop: 4, fontSize: 11, color: '#d4907c' }}>Gross revenue</p>
        </div>
      </div>

      {/* Compare toggle bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#a89e98' }}>
          {compareMode
            ? compareIds.length === 0
              ? 'Click lots to add to comparison (up to 3)'
              : `${compareIds.length} of 3 lots selected`
            : ''}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {compareMode && compareIds.length > 0 && (
            <button
              onClick={() => setCompareIds([])}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'transparent', color: '#7a6e68',
                border: '1px solid #e8e2dd', cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}
            >
              Clear selection
            </button>
          )}
          <button
            onClick={() => compareMode ? exitCompare() : setCompareMode(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: compareMode ? '#3d4a5c' : '#c0533a',
              color: '#fff',
              border: 'none',
              cursor: 'pointer', fontFamily: 'var(--font-body)',
              boxShadow: compareMode ? 'none' : '0 2px 6px rgba(192,83,58,0.30)',
            }}
          >
            <BarChart2 size={14} />
            {compareMode ? 'Exit compare' : 'Compare lots'}
          </button>
        </div>
      </div>

      {/* Compare panel — above stage grids */}
      {compareMode && compareLots.length >= 2 && (
        <LotComparePanel
          lots={compareLots}
          onRemove={id => setCompareIds(prev => prev.filter(x => x !== id))}
          onRegisterSale={lot => { exitCompare(); onRegisterSale(lot) }}
          onClose={exitCompare}
        />
      )}

      {compareMode && compareLots.length < 2 && compareLots.length > 0 && (
        <div style={{ textAlign: 'center', padding: '16px', fontSize: 12, color: '#a89e98', background: '#f9f6f4', borderRadius: 8 }}>
          Select one more lot to start comparing
        </div>
      )}

      {/* Stage grids */}
      {project.stages
        .slice()
        .sort((a, b) => a.stage_number - b.stage_number)
        .map(stage => (
          <StageSection
            key={stage.id}
            stage={stage}
            compareMode={compareMode}
            compareIds={compareIds}
            onLotClick={onLotClick}
            onToggleCompare={toggleCompare}
          />
        ))}

      <LotStatusLegend />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Info & Availability tab — 2-column layout
// Left col:  About, Solicitor, Billing
// Right col: Gallery images, Documents
// Below:     Lot availability (stat tiles + stage grids)
// ─────────────────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0ebe6', padding: '8px 0', fontSize: 13 }}>
      <span style={{ color: '#7a6e68' }}>{label}</span>
      <span style={{ color: '#2c2420' }}>{value ?? '—'}</span>
    </div>
  )
}

function ProjectInfoTab({ project, onLotClick, onRegisterSale }: { project: ProjectDetail; onLotClick: (id: string) => void; onRegisterSale: (lot: LotSummary) => void }) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Two-column: left = info cards, right = media ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* LEFT — About, Solicitor, Billing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* About */}
          <div style={{ ...CARD, padding: 20 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a89e98', marginBottom: 12 }}>
              About this project
            </h3>
            {project.description
              ? <p style={{ fontSize: 13, lineHeight: 1.7, color: '#2c2420' }}>{project.description}</p>
              : <p style={{ fontSize: 13, fontStyle: 'italic', color: '#a89e98' }}>No description added yet.</p>
            }
            {project.website_url && (
              <a href={project.website_url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 12, fontSize: 13, color: '#c0533a' }}>
                {project.website_url.replace(/^https?:\/\//, '')}
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          {/* Solicitor */}
          <div style={{ ...CARD, padding: 20 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a89e98', marginBottom: 12 }}>
              Vendor solicitor
            </h3>
            {project.solicitor ? (
              <>
                <InfoRow label="Name"  value={project.solicitor.full_name} />
                <InfoRow label="Firm"  value={project.solicitor.firm_name} />
                <InfoRow label="Email" value={
                  <a href={`mailto:${project.solicitor.email}`} style={{ color: '#c0533a' }}>{project.solicitor.email}</a>
                } />
                <InfoRow label="Phone" value={project.solicitor.phone} />
              </>
            ) : (
              <p style={{ fontSize: 13, fontStyle: 'italic', color: '#a89e98' }}>No solicitor assigned to this project.</p>
            )}
          </div>

          {/* Billing */}
          <div style={{ ...CARD, padding: 20 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a89e98', marginBottom: 12 }}>
              Billing
            </h3>
            <InfoRow label="Status"       value={project.billing_status} />
            <InfoRow label="Billing lots" value={project.billing_lot_count} />
            <InfoRow label="Start date"   value={project.billing_start_date} />
            <InfoRow label="End date"     value={project.billing_end_date ?? 'Active'} />
            <InfoRow label="Stages"       value={project.stages.length} />
          </div>
        </div>

        {/* RIGHT — Images + Documents */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Upload button */}
          {canUpload && !showUpload && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUpload(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#3d4a5c', color: '#fff', border: 'none',
                borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>
                <Plus size={13} /> Upload media
              </button>
            </div>
          )}
          {canUpload && showUpload && (
            <UploadForm projectId={project.id} onSuccess={handleUploadSuccess} onCancel={() => setShowUpload(false)} />
          )}

          {/* Images */}
          <div style={{ ...CARD, padding: 20 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a89e98', marginBottom: 16 }}>
              Images
            </h3>
            {images.length === 0 ? (
              <p style={{ fontSize: 13, fontStyle: 'italic', color: '#a89e98' }}>No images uploaded.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {images.map(img => (
                  <div key={img.id} style={{ borderRadius: 8, border: '1px solid #f0ebe6', overflow: 'hidden' }}>
                    {img.file_url
                      ? <img src={img.file_url} alt={img.title} style={{ height: 100, width: '100%', objectFit: 'cover', display: 'block' }} />
                      : <div style={{ height: 100, background: '#f9f6f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Image size={24} color="#d4ccc5" /></div>
                    }
                    <div style={{ padding: '6px 8px' }}>
                      <p style={{ fontSize: 11, color: '#2c2420', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.title}</p>
                      <p style={{ fontSize: 10, color: '#a89e98', textTransform: 'capitalize' }}>{img.category.replace('_', ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents */}
          <div style={{ ...CARD, padding: 20 }}>
            <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a89e98', marginBottom: 16 }}>
              Documents &amp; collateral
            </h3>
            {docs.length === 0 ? (
              <p style={{ fontSize: 13, fontStyle: 'italic', color: '#a89e98' }}>No documents uploaded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {docs.map(doc => (
                  <a key={doc.id} href={doc.file_url ?? '#'} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #f0ebe6', borderRadius: 8, padding: '8px 12px', textDecoration: 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9f6f4')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <FileText size={15} color="#a89e98" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: '#2c2420', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</p>
                      <p style={{ fontSize: 10, color: '#a89e98', textTransform: 'capitalize' }}>{doc.category.replace('_', ' ')}</p>
                    </div>
                    <Download size={13} color="#d4ccc5" style={{ flexShrink: 0 }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Lot availability — below info ── */}
      <div>
        <h3 style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#a89e98', marginBottom: 14 }}>
          Lot availability
        </h3>
        <LotsSection project={project} onLotClick={onLotClick} onRegisterSale={onRegisterSale} />
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
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#2c2420' }}>Upload media</h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a89e98' }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#7a6e68', marginBottom: 4 }}>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value as UploadCategory)}
            style={{ width: '100%', borderRadius: 8, border: '1px solid #e8e2dd', padding: '6px 10px', fontSize: 13, color: '#2c2420' }}>
            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#7a6e68', marginBottom: 4 }}>
            Title <span style={{ color: '#c4bab5' }}>(optional)</span>
          </label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder={category === 'hero' ? 'e.g. Hero — aerial view' : 'Display name'}
            style={{ width: '100%', borderRadius: 8, border: '1px solid #e8e2dd', padding: '6px 10px', fontSize: 13, color: '#2c2420', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: '#7a6e68', marginBottom: 4 }}>File</label>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '1px dashed #d4ccc5', borderRadius: 8, padding: '10px 12px',
            cursor: 'pointer', fontSize: 13, color: '#a89e98',
          }}>
            <Upload size={14} />
            {file ? <span style={{ color: '#2c2420' }}>{file.name}</span> : <span>Click to choose a file</span>}
            <input type="file" style={{ display: 'none' }}
              accept={mediaType === 'image' ? 'image/*' : '.pdf,.doc,.docx'}
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        {error && <p style={{ fontSize: 12, color: '#882010' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
          <button onClick={onCancel} style={{
            borderRadius: 8, border: '1px solid #e8e2dd', padding: '6px 14px',
            fontSize: 12, fontWeight: 500, color: '#7a6e68', cursor: 'pointer', background: '#fff',
          }}>Cancel</button>
          <button onClick={() => upload()} disabled={isPending || !file} style={{
            borderRadius: 8, background: '#3d4a5c', padding: '6px 14px',
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
// Page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'info' | 'reports'

const TABS: { value: Tab; label: string }[] = [
  { value: 'info',    label: 'Project info & availability' },
  { value: 'reports', label: 'Reports' },
]

export default function ProjectDetailPage() {
  const { id }       = useParams<{ id: string }>()
  const navigate     = useNavigate()
  const [activeTab, setActiveTab]               = useState<Tab>('info')
  const [selectedLotId, setSelectedLotId]       = useState<string | null>(null)
  const [saleTargetLot, setSaleTargetLot]       = useState<LotSummary | null>(null)

  const { data: project, isLoading, isError } = useProjectDetail(id ?? null)

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9f6f4', padding: 24 }}>
        <div style={{ height: 140, borderRadius: 12, background: '#e8e2dd', marginBottom: 12 }} />
        {[1,2,3].map(i => <div key={i} style={{ height: 60, borderRadius: 12, background: '#e8e2dd', marginBottom: 8 }} />)}
      </div>
    )
  }

  if (isError || !project) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#a89e98' }}>
        <Building2 size={40} />
        <p style={{ fontSize: 14 }}>Project not found.</p>
        <button onClick={() => navigate('/projects')} style={{ fontSize: 13, color: '#c0533a', background: 'none', border: 'none', cursor: 'pointer' }}>
          Back to projects
        </button>
      </div>
    )
  }

  const heroImage = project.media?.hero?.[0]?.file_url ?? null
  const hasHero   = !!heroImage

  return (
    <div style={{ minHeight: '100vh', background: '#f9f6f4' }}>

      {/* ── Header — hero image if available, clean white if not ── */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        background: hasHero ? '#3d4a5c' : '#fff',
        borderBottom: '1px solid #e8e2dd',
        boxShadow: '0 1px 2px rgba(44,36,32,0.04)',
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
            color: hasHero ? 'rgba(255,255,255,0.75)' : '#a89e98',
          }}>
            <ArrowLeft size={13} /> All projects
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <h1 style={{
              fontSize: 22, fontWeight: 700, lineHeight: 1.2,
              color: hasHero ? '#fff' : '#2c2420',
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
                  ? (item!.highlight ? '#f0d5cc' : 'rgba(255,255,255,0.75)')
                  : (item!.highlight ? '#c0533a' : '#a89e98'),
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
        borderBottom: '1px solid #e8e2dd',
        background: '#fff',
        paddingLeft: 24,
        boxShadow: '0 1px 2px rgba(44,36,32,0.04)',
      }}>
        {TABS.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)} style={{
            padding: '12px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: 'none', border: 'none', borderBottom: '2px solid',
            borderBottomColor: activeTab === tab.value ? '#c0533a' : 'transparent',
            color: activeTab === tab.value ? '#2c2420' : '#a89e98',
            transition: 'color 0.15s, border-color 0.15s',
            fontFamily: 'var(--font-body)',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 24 }}>
        {activeTab === 'info' && (
          <ProjectInfoTab
            project={project}
            onLotClick={setSelectedLotId}
            onRegisterSale={setSaleTargetLot}
          />
        )}
        {activeTab === 'reports' && <ProjectReportsTab project={project} />}
      </div>

      {/* Lot detail panel */}
      {selectedLotId && (
        <LotDetailPanel lotId={selectedLotId} onClose={() => setSelectedLotId(null)} />
      )}

      {/* New sale modal — triggered from compare panel */}
      {saleTargetLot && (
        <NewSaleModal
          lot={saleTargetLot as any}
          onClose={() => setSaleTargetLot(null)}
        />
      )}
    </div>
  )
}