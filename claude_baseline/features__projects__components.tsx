// src/features/projects/components.tsx
//
// Small shared components used by both ProjectsPage and ProjectDetail.
// Keep these co-located — they're not generic enough for src/components/.

import type { LotCounts, LotStatus, LotSummary, ProjectStatus } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Project status badge
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ProjectStatus, { label: string; className: string }> = {
  active:    { label: 'Active',    className: 'crm-badge crm-badge-reserved' },
  draft:     { label: 'Draft',     className: 'crm-badge crm-badge-draft' },
  completed: { label: 'Completed', className: 'crm-badge crm-badge-settled' },
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = STATUS_BADGE[status] ?? STATUS_BADGE.draft
  return (
    <span className={className}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot status bar (proportional segments)
// ─────────────────────────────────────────────────────────────────────────────

const SEGMENT_CLASS: Record<string, string> = {
  available: 'crm-seg-available',
  on_hold:   'crm-seg-on_hold',
  reserved:  'crm-seg-reserved',
  settled:   'crm-seg-settled',
  draft:     'crm-seg-draft',
}

export function LotStatusBar({ counts }: { counts: LotCounts }) {
  const { total, available, on_hold, reserved, settled, draft } = counts
  if (total === 0) return (
    <div style={{ height: 6, borderRadius: 9999, background: 'var(--crm-border)' }} />
  )

  const segments = [
    { key: 'available', value: available },
    { key: 'on_hold',   value: on_hold },
    { key: 'reserved',  value: reserved },
    { key: 'settled',   value: settled },
    { key: 'draft',     value: draft },
  ].filter(s => s.value > 0)

  return (
    <div style={{ display: 'flex', height: 6, width: '100%', overflow: 'hidden', borderRadius: 9999, gap: 1 }}>
      {segments.map(({ key, value }) => (
        <div
          key={key}
          className={SEGMENT_CLASS[key]}
          style={{ width: `${(value / total) * 100}%`, height: '100%' }}
          title={`${value} ${key.replace('_', ' ')}`}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot tile (used in the stage grid on ProjectDetail)
// ─────────────────────────────────────────────────────────────────────────────

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

export function LotTile({ lot, onClick }: { lot: LotSummary; onClick?: () => void }) {
  const status = lot.status as LotStatus

  return (
    <button
      onClick={onClick}
      className={`crm-lot-tile crm-lot-tile-${status}`}
      style={{
        width: '100%',
        border: 'none',
        fontFamily: 'var(--font-body)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>
        {lot.lot_number}
      </div>
      <div className={`crm-lot-price-${status}`} style={{ marginTop: 2, fontSize: 10, lineHeight: 1.2 }}>
        {formatPrice(lot.current_price)}
      </div>
      <div style={{ marginTop: 2, fontSize: 9, lineHeight: 1.2, opacity: 0.65 }}>
        {LOT_TYPE_LABELS[lot.lot_type] ?? lot.lot_type}
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status legend
// ─────────────────────────────────────────────────────────────────────────────

const LEGEND_ITEMS: { label: string; segClass: string }[] = [
  { label: 'Available', segClass: 'crm-seg-available' },
  { label: 'On hold',   segClass: 'crm-seg-on_hold' },
  { label: 'Reserved+', segClass: 'crm-seg-reserved' },
  { label: 'Settled',   segClass: 'crm-seg-settled' },
  { label: 'Draft',     segClass: 'crm-seg-draft' },
]

export function LotStatusLegend() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {LEGEND_ITEMS.map(({ label, segClass }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className={segClass} style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--crm-text-muted)' }}>{label}</span>
        </div>
      ))}
    </div>
  )
}