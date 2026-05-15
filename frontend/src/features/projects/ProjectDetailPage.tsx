// src/features/projects/ProjectDetailPage.tsx
// Route: /projects/:id

import { useState, useEffect } from 'react'
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
// Lightbox
// ─────────────────────────────────────────────────────────────────────────────

function Lightbox({ images, startIndex, onClose }: {
  images: { id: string; file_url: string | null; title: string; category: string }[]
  startIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(startIndex)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, images.length - 1))
      if (e.key === 'ArrowLeft')  setIndex(i => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [images.length, onClose])

  const img = images[index]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(20,16,14,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Close */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
          width: 36, height: 36, cursor: 'pointer', color: '#fff', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Close"
      >
        <X size={18} />
      </button>

      {/* Prev */}
      {index > 0 && (
        <button
          onClick={e => { e.stopPropagation(); setIndex(i => i - 1) }}
          style={{
            position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
            width: 40, height: 40, cursor: 'pointer', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="Previous"
        >
          <ArrowLeft size={18} />
        </button>
      )}

      {/* Image */}
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        {img.file_url ? (
          <img
            src={img.file_url}
            alt={img.title}
            style={{ maxWidth: '90vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 8 }}
          />
        ) : (
          <div style={{ width: 400, height: 300, background: '#2c2420', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Image size={48} color="#7a6e68" />
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: '#fff', fontWeight: 500, margin: 0 }}>{img.title}</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, textTransform: 'capitalize' }}>
            {img.category.replace('_', ' ')} · {index + 1} of {images.length}
          </p>
        </div>
      </div>

      {/* Next */}
      {index < images.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); setIndex(i => i + 1) }}
          style={{
            position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%',
            width: 40, height: 40, cursor: 'pointer', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          aria-label="Next"
        >
          <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}
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
  const [showUpload, setShowUpload]       = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

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
                {images.map((img, i) => (
                  <div
                    key={img.id}
                    onClick={() => img.file_url ? setLightboxIndex(i) : undefined}
                    style={{
                      borderRadius: 8, border: '1px solid #f0ebe6', overflow: 'hidden',
                      cursor: img.file_url ? 'zoom-in' : 'default',
                      transition: 'transform 0.12s, box-shadow 0.12s',
                    }}
                    onMouseEnter={e => { if (img.file_url) { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(44,36,32,0.12)' }}}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none' }}
                  >
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

      {/* Lightbox */}
      {lightboxIndex !== null && images.length > 0 && (
        <Lightbox
          images={images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
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

type Tab = 'info' | 'reports' | 'planning'

const TABS: { value: Tab; label: string }[] = [
  { value: 'info',     label: 'Project info & availability' },
  { value: 'planning', label: 'DA & Planning'               },
  { value: 'reports',  label: 'Reports'                     },
]

// ─────────────────────────────────────────────────────────────────────────────
// DA & Planning Tab
// ─────────────────────────────────────────────────────────────────────────────

interface DA {
  id: string
  project: string
  stage: string | null
  stage_name: string | null
  reference_number: string
  authority: string
  status: string
  lodgement_date: string | null
  approval_date: string | null
  lapse_date: string | null
  commencement_confirmed: boolean
  commencement_date: string | null
  notes: string
  is_lapsing_soon: boolean
  days_until_lapse: number | null
  open_conditions: number
  total_conditions: number
  conditions: DACondition[]
  milestones: DAMilestone[]
}

interface DACondition {
  id: string
  da: string
  condition_number: string
  category: string
  description: string
  status: string
  responsible_party: string | null
  responsible_party_name: string | null
  due_date: string | null
  completed_date: string | null
  notes: string
  is_overdue: boolean
}

interface DAMilestone {
  id: string
  da: string
  milestone_type: string
  label: string
  display_label: string
  planned_date: string | null
  actual_date: string | null
  notes: string
  is_overdue: boolean
}

const DA_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pre_lodgement:     { label: 'Pre-lodgement',    bg: '#f2f0ee', color: '#7a6e68', border: '#ddd7d2' },
  lodged:            { label: 'Lodged',           bg: '#eef2fb', color: '#2649a0', border: '#c5d3f0' },
  under_assessment:  { label: 'Under Assessment', bg: '#fef6ec', color: '#7a4a00', border: '#fcd9a0' },
  approved:          { label: 'Approved',         bg: '#eef7f0', color: '#1a5c2e', border: '#b8dfc3' },
  conditions_issued: { label: 'Conditions Issued',bg: '#f5f0fb', color: '#5b2d8a', border: '#d9c5f5' },
  operational_works: { label: 'Operational Works',bg: '#eef7f0', color: '#1a5c2e', border: '#b8dfc3' },
}

const CONDITION_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  open:        { label: 'Open',        bg: '#fef6ec', color: '#7a4a00', border: '#fcd9a0' },
  in_progress: { label: 'In Progress', bg: '#eef2fb', color: '#2649a0', border: '#c5d3f0' },
  complete:    { label: 'Complete',    bg: '#eef7f0', color: '#1a5c2e', border: '#b8dfc3' },
  waived:      { label: 'Waived',     bg: '#f2f0ee', color: '#7a6e68', border: '#ddd7d2' },
}

const CATEGORY_LABELS: Record<string, string> = {
  pre_construction:  'Pre-construction',
  construction:      'Construction',
  post_construction: 'Post-construction',
  ongoing:           'Ongoing',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DAStatusBadge({ status }: { status: string }) {
  const c = DA_STATUS_CONFIG[status] ?? DA_STATUS_CONFIG.pre_lodgement
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  )
}

function ConditionStatusBadge({ status }: { status: string }) {
  const c = CONDITION_STATUS_CONFIG[status] ?? CONDITION_STATUS_CONFIG.open
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 99, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  )
}

function DACard({ da, canManage, projectId, stages, onUpdated }: {
  da: DA
  canManage: boolean
  projectId: string
  stages: Stage[]
  onUpdated: () => void
}) {
  const queryClient = useQueryClient()
  const [expanded,    setExpanded]    = useState(false)
  const [editingDA,   setEditingDA]   = useState(false)
  const [addingCond,  setAddingCond]  = useState(false)
  const [addingMile,  setAddingMile]  = useState(false)
  const [condFilter,  setCondFilter]  = useState('')
  const [daForm, setDaForm] = useState({
    reference_number: da.reference_number,
    authority: da.authority,
    status: da.status,
    lodgement_date: da.lodgement_date ?? '',
    approval_date: da.approval_date ?? '',
    lapse_date: da.lapse_date ?? '',
    commencement_confirmed: da.commencement_confirmed,
    commencement_date: da.commencement_date ?? '',
    notes: da.notes,
    stage: da.stage ?? '',
  })
  const [condForm, setCondForm] = useState({ condition_number: '', category: 'pre_construction', description: '', status: 'open', due_date: '', notes: '' })
  const [mileForm, setMileForm] = useState({ milestone_type: 'commencement', label: '', planned_date: '', actual_date: '', notes: '' })

  const iStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d4ccc5', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: '#2c2420', background: '#fff', outline: 'none' }
  const lStyle: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 600, color: '#a89e98', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }

  const { mutate: saveDA, isPending: savingDA } = useMutation({
    mutationFn: () => client.patch(`/development-applications/${da.id}/`, {
      ...daForm,
      stage: daForm.stage || null,
      lodgement_date: daForm.lodgement_date || null,
      approval_date: daForm.approval_date || null,
      lapse_date: daForm.lapse_date || null,
      commencement_date: daForm.commencement_date || null,
    }),
    onSuccess: () => { setEditingDA(false); onUpdated() },
  })

  const { mutate: saveCond, isPending: savingCond } = useMutation({
    mutationFn: () => client.post(`/da-conditions/`, { ...condForm, da: da.id, due_date: condForm.due_date || null }),
    onSuccess: () => { setAddingCond(false); setCondForm({ condition_number: '', category: 'pre_construction', description: '', status: 'open', due_date: '', notes: '' }); onUpdated() },
  })

  const { mutate: saveMile, isPending: savingMile } = useMutation({
    mutationFn: () => client.post(`/da-milestones/`, { ...mileForm, da: da.id, planned_date: mileForm.planned_date || null, actual_date: mileForm.actual_date || null }),
    onSuccess: () => { setAddingMile(false); setMileForm({ milestone_type: 'commencement', label: '', planned_date: '', actual_date: '', notes: '' }); onUpdated() },
  })

  const { mutate: updateCond } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => client.patch(`/da-conditions/${id}/`, { status }),
    onSuccess: () => onUpdated(),
  })

  const filteredConditions = condFilter
    ? da.conditions.filter(c => c.status === condFilter)
    : da.conditions

  const openCount = da.conditions.filter(c => !['complete', 'waived'].includes(c.status)).length

  return (
    <div style={{ ...CARD, overflow: 'hidden' }}>
      {/* DA header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <DAStatusBadge status={da.status} />
            {da.reference_number && (
              <span style={{ fontSize: 12, color: '#7a6e68', fontWeight: 500 }}>{da.reference_number}</span>
            )}
            {da.stage_name && (
              <span style={{ fontSize: 11, color: '#a89e98', background: '#f2f0ee', padding: '1px 8px', borderRadius: 99, border: '1px solid #e8e2dd' }}>{da.stage_name}</span>
            )}
            {da.is_lapsing_soon && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#882010', background: '#fdf0ee', padding: '1px 8px', borderRadius: 99, border: '1px solid #f5c4bb' }}>
                ⚠ Lapses in {da.days_until_lapse}d
              </span>
            )}
          </div>
          {da.authority && <p style={{ fontSize: 12, color: '#a89e98', margin: '4px 0 0' }}>{da.authority}</p>}
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            {da.lodgement_date && <span style={{ fontSize: 11, color: '#7a6e68' }}>Lodged {fmtDate(da.lodgement_date)}</span>}
            {da.approval_date  && <span style={{ fontSize: 11, color: '#1a5c2e' }}>Approved {fmtDate(da.approval_date)}</span>}
            {da.lapse_date     && <span style={{ fontSize: 11, color: da.is_lapsing_soon ? '#882010' : '#7a6e68' }}>Lapses {fmtDate(da.lapse_date)}</span>}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: '#a89e98' }}>{openCount} open condition{openCount !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: 11, color: '#a89e98' }}>{da.milestones.length} milestone{da.milestones.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {canManage && (
            <button
              onClick={e => { e.stopPropagation(); setEditingDA(true); setExpanded(true) }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              Edit
            </button>
          )}
          <span style={{ color: '#a89e98', fontSize: 16 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f0ebe6', padding: '20px' }}>

          {/* Edit DA form */}
          {editingDA && canManage ? (
            <div style={{ background: '#f9f6f4', borderRadius: 10, padding: 16, marginBottom: 20, border: '1px solid #e8e2dd' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#2c2420', margin: '0 0 12px' }}>Edit Development Application</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={lStyle}>Reference number</label><input style={iStyle} value={daForm.reference_number} onChange={e => setDaForm(f => ({ ...f, reference_number: e.target.value }))} /></div>
                <div><label style={lStyle}>Authority</label><input style={iStyle} value={daForm.authority} onChange={e => setDaForm(f => ({ ...f, authority: e.target.value }))} placeholder="e.g. Gold Coast City Council" /></div>
                <div><label style={lStyle}>Status</label>
                  <select style={iStyle} value={daForm.status} onChange={e => setDaForm(f => ({ ...f, status: e.target.value }))}>
                    {Object.entries(DA_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div><label style={lStyle}>Stage (optional)</label>
                  <select style={iStyle} value={daForm.stage} onChange={e => setDaForm(f => ({ ...f, stage: e.target.value }))}>
                    <option value="">Project-level DA</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div><label style={lStyle}>Lodgement date</label><input style={iStyle} type="date" value={daForm.lodgement_date} onChange={e => setDaForm(f => ({ ...f, lodgement_date: e.target.value }))} /></div>
                <div><label style={lStyle}>Approval date</label><input style={iStyle} type="date" value={daForm.approval_date} onChange={e => setDaForm(f => ({ ...f, approval_date: e.target.value }))} /></div>
                <div><label style={lStyle}>Lapse date</label><input style={iStyle} type="date" value={daForm.lapse_date} onChange={e => setDaForm(f => ({ ...f, lapse_date: e.target.value }))} /></div>
                <div><label style={lStyle}>Commencement date</label><input style={iStyle} type="date" value={daForm.commencement_date} onChange={e => setDaForm(f => ({ ...f, commencement_date: e.target.value }))} /></div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#2c2420', cursor: 'pointer' }}>
                    <input type="checkbox" checked={daForm.commencement_confirmed} onChange={e => setDaForm(f => ({ ...f, commencement_confirmed: e.target.checked }))} />
                    Commencement of works confirmed
                  </label>
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={lStyle}>Notes</label><textarea style={{ ...iStyle, minHeight: 64, resize: 'vertical' }} value={daForm.notes} onChange={e => setDaForm(f => ({ ...f, notes: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => saveDA()} disabled={savingDA} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#3d4a5c', color: '#fff', border: 'none', cursor: 'pointer', opacity: savingDA ? 0.6 : 1, fontFamily: 'var(--font-body)' }}>
                  {savingDA ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditingDA(false)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : da.notes ? (
            <div style={{ background: '#f9f6f4', borderRadius: 8, padding: '10px 14px', marginBottom: 16, border: '1px solid #f0ebe6' }}>
              <p style={{ fontSize: 12, color: '#2c2420', margin: 0, lineHeight: 1.6 }}>{da.notes}</p>
            </div>
          ) : null}

          {/* Milestones */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: '#a89e98', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Milestones</h4>
              {canManage && (
                <button onClick={() => setAddingMile(true)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                  + Add
                </button>
              )}
            </div>

            {addingMile && (
              <div style={{ background: '#f9f6f4', borderRadius: 8, padding: 12, marginBottom: 10, border: '1px solid #e8e2dd' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><label style={lStyle}>Type</label>
                    <select style={iStyle} value={mileForm.milestone_type} onChange={e => setMileForm(f => ({ ...f, milestone_type: e.target.value }))}>
                      <option value="commencement">Commencement of Works</option>
                      <option value="practical_completion">Practical Completion</option>
                      <option value="occupation_cert">Occupation Certificate</option>
                      <option value="defects_liability_end">Defects Liability End</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  {mileForm.milestone_type === 'custom' && (
                    <div><label style={lStyle}>Label</label><input style={iStyle} value={mileForm.label} onChange={e => setMileForm(f => ({ ...f, label: e.target.value }))} placeholder="Milestone name" /></div>
                  )}
                  <div><label style={lStyle}>Planned date</label><input style={iStyle} type="date" value={mileForm.planned_date} onChange={e => setMileForm(f => ({ ...f, planned_date: e.target.value }))} /></div>
                  <div><label style={lStyle}>Actual date</label><input style={iStyle} type="date" value={mileForm.actual_date} onChange={e => setMileForm(f => ({ ...f, actual_date: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => saveMile()} disabled={savingMile} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#3d4a5c', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    {savingMile ? 'Saving…' : 'Add milestone'}
                  </button>
                  <button onClick={() => setAddingMile(false)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
                </div>
              </div>
            )}

            {da.milestones.length === 0 ? (
              <p style={{ fontSize: 12, color: '#a89e98', fontStyle: 'italic' }}>No milestones added.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {da.milestones.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#fff', borderRadius: 8, border: '1px solid #f0ebe6' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: m.actual_date ? '#52a96e' : m.is_overdue ? '#c0533a' : '#d4ccc5' }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#2c2420' }}>{m.display_label}</span>
                      {m.is_overdue && !m.actual_date && (
                        <span style={{ fontSize: 10, color: '#882010', marginLeft: 8, fontWeight: 600 }}>OVERDUE</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11 }}>
                      {m.planned_date && <div style={{ color: '#7a6e68' }}>Planned: {fmtDate(m.planned_date)}</div>}
                      {m.actual_date  && <div style={{ color: '#1a5c2e', fontWeight: 500 }}>Actual: {fmtDate(m.actual_date)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Conditions */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <h4 style={{ fontSize: 11, fontWeight: 600, color: '#a89e98', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Conditions ({openCount} open)
              </h4>
              <div style={{ display: 'flex', gap: 6 }}>
                {['', 'open', 'in_progress', 'complete', 'waived'].map(s => (
                  <button key={s} onClick={() => setCondFilter(s)} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font-body)',
                    background: condFilter === s ? '#3d4a5c' : '#f2f0ee',
                    color: condFilter === s ? '#fff' : '#7a6e68',
                    border: `1px solid ${condFilter === s ? '#3d4a5c' : 'transparent'}`,
                  }}>
                    {s === '' ? 'All' : CONDITION_STATUS_CONFIG[s]?.label}
                  </button>
                ))}
                {canManage && (
                  <button onClick={() => setAddingCond(true)} style={{ fontSize: 11, padding: '2px 10px', borderRadius: 6, background: '#c0533a', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    + Add
                  </button>
                )}
              </div>
            </div>

            {addingCond && (
              <div style={{ background: '#f9f6f4', borderRadius: 8, padding: 12, marginBottom: 10, border: '1px solid #e8e2dd' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><label style={lStyle}>Condition no.</label><input style={iStyle} value={condForm.condition_number} onChange={e => setCondForm(f => ({ ...f, condition_number: e.target.value }))} placeholder="e.g. C1" /></div>
                  <div><label style={lStyle}>Category</label>
                    <select style={iStyle} value={condForm.category} onChange={e => setCondForm(f => ({ ...f, category: e.target.value }))}>
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}><label style={lStyle}>Description *</label><textarea style={{ ...iStyle, minHeight: 56, resize: 'vertical' }} value={condForm.description} onChange={e => setCondForm(f => ({ ...f, description: e.target.value }))} /></div>
                  <div><label style={lStyle}>Due date</label><input style={iStyle} type="date" value={condForm.due_date} onChange={e => setCondForm(f => ({ ...f, due_date: e.target.value }))} /></div>
                  <div><label style={lStyle}>Notes</label><input style={iStyle} value={condForm.notes} onChange={e => setCondForm(f => ({ ...f, notes: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button onClick={() => saveCond()} disabled={savingCond || !condForm.description.trim()} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#c0533a', color: '#fff', border: 'none', cursor: 'pointer', opacity: (!condForm.description.trim() || savingCond) ? 0.4 : 1, fontFamily: 'var(--font-body)' }}>
                    {savingCond ? 'Saving…' : 'Add condition'}
                  </button>
                  <button onClick={() => setAddingCond(false)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
                </div>
              </div>
            )}

            {filteredConditions.length === 0 ? (
              <p style={{ fontSize: 12, color: '#a89e98', fontStyle: 'italic' }}>No conditions {condFilter ? 'matching this filter' : 'added'}.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredConditions.map(c => (
                  <div key={c.id} style={{ padding: '10px 14px', background: c.is_overdue ? '#fdf9f8' : '#fff', borderRadius: 8, border: `1px solid ${c.is_overdue ? '#f5c4bb' : '#f0ebe6'}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                          {c.condition_number && <span style={{ fontSize: 11, fontWeight: 700, color: '#7a6e68' }}>{c.condition_number}</span>}
                          <span style={{ fontSize: 10, color: '#a89e98', background: '#f2f0ee', padding: '1px 6px', borderRadius: 99 }}>{CATEGORY_LABELS[c.category] ?? c.category}</span>
                          <ConditionStatusBadge status={c.status} />
                          {c.is_overdue && <span style={{ fontSize: 10, fontWeight: 700, color: '#882010' }}>OVERDUE</span>}
                        </div>
                        <p style={{ fontSize: 13, color: '#2c2420', margin: 0, lineHeight: 1.5 }}>{c.description}</p>
                        {(c.due_date || c.responsible_party_name) && (
                          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                            {c.due_date && <span style={{ fontSize: 11, color: c.is_overdue ? '#882010' : '#7a6e68' }}>Due: {fmtDate(c.due_date)}</span>}
                            {c.responsible_party_name && <span style={{ fontSize: 11, color: '#7a6e68' }}>→ {c.responsible_party_name}</span>}
                          </div>
                        )}
                        {c.notes && <p style={{ fontSize: 11, color: '#a89e98', margin: '4px 0 0', fontStyle: 'italic' }}>{c.notes}</p>}
                      </div>
                      {canManage && c.status !== 'complete' && c.status !== 'waived' && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {c.status === 'open' && (
                            <button onClick={() => updateCond({ id: c.id, status: 'in_progress' })} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: '#eef2fb', color: '#2649a0', border: '1px solid #c5d3f0', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                              Start
                            </button>
                          )}
                          <button onClick={() => updateCond({ id: c.id, status: 'complete' })} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, background: '#eef7f0', color: '#1a5c2e', border: '1px solid #b8dfc3', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            Complete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectPlanningTab({ project }: { project: ProjectDetail }) {
  const user = useAuthStore(s => s.user)
  const canManage = user?.role?.permissions?.some(p => p.code === 'da.manage') ?? false
  const queryClient = useQueryClient()
  const [showAddDA, setShowAddDA] = useState(false)
  const [addDAForm, setAddDAForm] = useState({ reference_number: '', authority: '', status: 'pre_lodgement', stage: '' })

  const { data: das = [], isLoading } = useQuery<DA[]>({
    queryKey: ['development-applications', project.id],
    queryFn:  async () => {
      const { data } = await client.get(`/development-applications/`, { params: { project: project.id } })
      return Array.isArray(data) ? data : (data.results ?? [])
    },
    staleTime: 30_000,
  })

  const { mutate: createDA, isPending: creatingDA } = useMutation({
    mutationFn: () => client.post(`/development-applications/`, { ...addDAForm, project: project.id, stage: addDAForm.stage || null }),
    onSuccess:  () => { setShowAddDA(false); setAddDAForm({ reference_number: '', authority: '', status: 'pre_lodgement', stage: '' }); queryClient.invalidateQueries({ queryKey: ['development-applications', project.id] }) },
  })

  const onUpdated = () => queryClient.invalidateQueries({ queryKey: ['development-applications', project.id] })

  const iStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #d4ccc5', borderRadius: 6, padding: '7px 10px', fontSize: 13, color: '#2c2420', background: '#fff', outline: 'none' }
  const lStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: '#7a6e68', marginBottom: 4 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#2c2420', margin: 0 }}>DA & Planning</h2>
          <p style={{ fontSize: 12, color: '#a89e98', margin: '3px 0 0' }}>
            {das.length} development application{das.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowAddDA(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#c0533a', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(192,83,58,0.30)', fontFamily: 'var(--font-body)' }}
          >
            <Plus size={14} /> Add DA
          </button>
        )}
      </div>

      {/* Add DA form */}
      {showAddDA && (
        <div style={{ ...CARD, padding: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#2c2420', margin: '0 0 14px' }}>New Development Application</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label style={lStyle}>Reference number</label><input style={iStyle} value={addDAForm.reference_number} onChange={e => setAddDAForm(f => ({ ...f, reference_number: e.target.value }))} placeholder="e.g. DA/2024/001234" /></div>
            <div><label style={lStyle}>Authority</label><input style={iStyle} value={addDAForm.authority} onChange={e => setAddDAForm(f => ({ ...f, authority: e.target.value }))} placeholder="e.g. Brisbane City Council" /></div>
            <div><label style={lStyle}>Status</label>
              <select style={iStyle} value={addDAForm.status} onChange={e => setAddDAForm(f => ({ ...f, status: e.target.value }))}>
                {Object.entries(DA_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><label style={lStyle}>Stage (optional)</label>
              <select style={iStyle} value={addDAForm.stage} onChange={e => setAddDAForm(f => ({ ...f, stage: e.target.value }))}>
                <option value="">Project-level DA</option>
                {project.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => createDA()} disabled={creatingDA} style={{ padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 500, background: '#3d4a5c', color: '#fff', border: 'none', cursor: 'pointer', opacity: creatingDA ? 0.6 : 1, fontFamily: 'var(--font-body)' }}>
              {creatingDA ? 'Creating…' : 'Create DA'}
            </button>
            <button onClick={() => setShowAddDA(false)} style={{ padding: '8px 14px', borderRadius: 7, fontSize: 13, background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* DA list */}
      {isLoading ? (
        <div style={{ color: '#a89e98', fontSize: 13 }}>Loading…</div>
      ) : das.length === 0 ? (
        <div style={{ ...CARD, padding: '40px 24px', textAlign: 'center' }}>
          <FileText size={32} color="#d4ccc5" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: '#a89e98', margin: 0 }}>No development applications yet.</p>
          {canManage && <p style={{ fontSize: 12, color: '#d4ccc5', marginTop: 4 }}>Click "Add DA" to get started.</p>}
        </div>
      ) : (
        das.map(da => (
          <DACard
            key={da.id}
            da={da}
            canManage={canManage}
            projectId={project.id}
            stages={project.stages}
            onUpdated={onUpdated}
          />
        ))
      )}
    </div>
  )
}

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
        {activeTab === 'planning' && <ProjectPlanningTab project={project} />}
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