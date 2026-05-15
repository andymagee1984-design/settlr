// src/features/prospects/ProspectsPage.tsx
// Route: /prospects

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, X, AlertCircle, Flame, Thermometer, Snowflake,
  Phone, Mail, User, ArrowRight, RefreshCw,
} from 'lucide-react'
import client from '../../api/client'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ProspectStatus  = 'active' | 'converted' | 'lost'
type ProspectSource  = 'website_form' | 'portal' | 'walk_in' | 'phone' | 'referral' | 'other'

interface ReturningSummary {
  project_name: string
  lot_number: string
  status: string
  sale_price: string | null
  created_at: string
}

interface Prospect {
  id: string
  full_name: string
  first_name: string
  last_name: string
  email: string
  phone: string
  source: ProspectSource
  status: ProspectStatus
  lost_reason: string
  project: string | null
  project_name: string | null
  lot: string | null
  lot_number: string | null
  assigned_to: string | null
  assigned_to_name: string | null
  notes: string
  is_returning_buyer: boolean
  buyer: string | null
  returning_buyer_summary: ReturningSummary | null
  engagement_level: string
  converted_at: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProspects(params: Record<string, string>): Promise<Prospect[]> {
  const { data } = await client.get<any>('/prospects/', { params })
  return Array.isArray(data) ? data : (data.results ?? [])
}

async function fetchProspect(id: string): Promise<Prospect> {
  const { data } = await client.get<Prospect>(`/prospects/${id}/`)
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  active:    { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', label: 'Active' },
  converted: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe', label: 'Converted' },
  lost:      { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', label: 'Lost' },
}

const SOURCE_LABELS: Record<string, string> = {
  website_form: 'Web form',
  portal:       'Portal',
  walk_in:      'Walk-in',
  phone:        'Phone',
  referral:     'Referral',
  other:        'Other',
}

const ENGAGEMENT_CONFIG: Record<string, { icon: React.ReactNode; bg: string; color: string; border: string; label: string }> = {
  hot:  { icon: <Flame size={11} />,       bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Hot' },
  warm: { icon: <Thermometer size={11} />, bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'Warm' },
  cold: { icon: <Snowflake size={11} />,   bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd', label: 'Cold' },
}

function EngagementBadge({ level }: { level: string }) {
  const config = ENGAGEMENT_CONFIG[level] ?? ENGAGEMENT_CONFIG.cold
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: config.bg, color: config.color, border: `1px solid ${config.border}`,
      borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 500,
    }}>
      {config.icon}{config.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.active
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 500,
    }}>
      {s.label}
    </span>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Prospect modal
// ─────────────────────────────────────────────────────────────────────────────

function AddProspectModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    source: 'walk_in', notes: '',
  })
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: async () => { await client.post('/prospects/', form) },
    onSuccess: () => { onSuccess(); onClose() },
    onError: (err: any) => setError(err?.response?.data?.detail ?? 'Failed to create prospect.'),
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '8px 10px', fontSize: 13, color: '#111827', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 4,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>Add prospect</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>First name *</label>
              <input style={inputStyle} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="John" />
            </div>
            <div>
              <label style={labelStyle}>Last name *</label>
              <input style={inputStyle} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Smith" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="0400 000 000" />
          </div>
          <div>
            <label style={labelStyle}>Source</label>
            <select style={inputStyle} value={form.source} onChange={e => set('source', e.target.value)}>
              <option value="walk_in">Walk-in</option>
              <option value="phone">Phone enquiry</option>
              <option value="referral">Referral</option>
              <option value="website_form">Website form</option>
              <option value="portal">Portal (Domain / REA)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any initial notes about this prospect…" />
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
              <AlertCircle size={13} color="#dc2626" />
              <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{error}</p>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
          <button onClick={onClose} style={{ borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#6b7280', cursor: 'pointer', background: '#fff' }}>Cancel</button>
          <button onClick={() => mutate()} disabled={isPending || !form.first_name || !form.last_name || !form.email}
            style={{ borderRadius: 8, background: '#111827', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer', border: 'none', opacity: (isPending || !form.first_name || !form.last_name || !form.email) ? 0.4 : 1 }}>
            {isPending ? 'Creating…' : 'Create prospect'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Prospect detail panel
// ─────────────────────────────────────────────────────────────────────────────

function ProspectDetailPanel({ prospectId, onClose }: { prospectId: string; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [lostReason, setLostReason]     = useState('')
  const [showLostForm, setShowLostForm] = useState(false)
  const [actionError, setActionError]   = useState<string | null>(null)

  const { data: prospect, isLoading } = useQuery({
    queryKey: ['prospect-detail', prospectId],
    queryFn: () => fetchProspect(prospectId),
    staleTime: 0,
  })

  const { mutate: markLost, isPending: isLosing } = useMutation({
    mutationFn: async () => { await client.post(`/prospects/${prospectId}/lose/`, { lost_reason: lostReason }) },
    onSuccess: () => {
      setShowLostForm(false); setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      queryClient.invalidateQueries({ queryKey: ['prospect-detail', prospectId] })
    },
    onError: (err: any) => setActionError(err?.response?.data?.detail ?? 'Failed to mark as lost.'),
  })

  const { mutate: reactivate, isPending: isReactivating } = useMutation({
    mutationFn: async () => { await client.post(`/prospects/${prospectId}/reactivate/`) },
    onSuccess: () => {
      setActionError(null)
      queryClient.invalidateQueries({ queryKey: ['prospects'] })
      queryClient.invalidateQueries({ queryKey: ['prospect-detail', prospectId] })
    },
    onError: (err: any) => setActionError(err?.response?.data?.detail ?? 'Failed to reactivate.'),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{ width: 440, background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>Prospect</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
        </div>

        {isLoading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 48, background: '#f1f5f9', borderRadius: 8 }} />)}
          </div>
        ) : !prospect ? (
          <div style={{ padding: 24, color: '#9ca3af', fontSize: 13 }}>Prospect not found.</div>
        ) : (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {prospect.is_returning_buyer && prospect.returning_buyer_summary && (
              <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <RefreshCw size={13} color="#7c3aed" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed' }}>Returning buyer</span>
                </div>
                <p style={{ fontSize: 12, color: '#6b21a8', margin: 0 }}>
                  Previously purchased Lot {prospect.returning_buyer_summary.lot_number} at {prospect.returning_buyer_summary.project_name}
                  {prospect.returning_buyer_summary.sale_price && ` · $${Number(prospect.returning_buyer_summary.sale_price).toLocaleString()}`}
                  {' · '}{prospect.returning_buyer_summary.status.replace(/_/g, ' ')}
                </p>
              </div>
            )}

            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                  {prospect.first_name?.[0] ?? '?'}{prospect.last_name?.[0] ?? ''}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{prospect.full_name}</p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <StatusBadge status={prospect.status} />
                    <EngagementBadge level={prospect.engagement_level} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <a href={`mailto:${prospect.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>
                  <Mail size={13} color="#9ca3af" />{prospect.email}
                </a>
                {prospect.phone && (
                  <a href={`tel:${prospect.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', textDecoration: 'none' }}>
                    <Phone size={13} color="#9ca3af" />{prospect.phone}
                  </a>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'Source',           value: SOURCE_LABELS[prospect.source] ?? prospect.source },
                { label: 'Project interest', value: prospect.project_name ?? '—' },
                { label: 'Lot interest',     value: prospect.lot_number ? `Lot ${prospect.lot_number}` : '—' },
                { label: 'Assigned to',      value: prospect.assigned_to_name ?? '—' },
                { label: 'Created',          value: formatDate(prospect.created_at) },
                ...(prospect.status === 'converted' && prospect.converted_at
                  ? [{ label: 'Converted', value: formatDate(prospect.converted_at) }]
                  : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '8px 0', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>{label}</span>
                  <span style={{ color: '#111827' }}>{value}</span>
                </div>
              ))}
            </div>

            {prospect.notes && (
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Notes</p>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{prospect.notes}</p>
              </div>
            )}

            {prospect.status === 'lost' && prospect.lost_reason && (
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Lost reason</p>
                <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{prospect.lost_reason}</p>
              </div>
            )}

            {actionError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca' }}>
                <AlertCircle size={13} color="#dc2626" />
                <p style={{ fontSize: 12, color: '#dc2626', margin: 0 }}>{actionError}</p>
              </div>
            )}

            {prospect.status === 'active' && (
              <div>
                {!showLostForm ? (
                  <button onClick={() => setShowLostForm(true)}
                    style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 12px', cursor: 'pointer' }}>
                    Mark as lost
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea placeholder="Reason for losing this prospect…" value={lostReason} onChange={e => setLostReason(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', minHeight: 72, outline: 'none' }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => markLost()} disabled={!lostReason.trim() || isLosing}
                        style={{ borderRadius: 7, background: '#111827', padding: '6px 14px', fontSize: 12, fontWeight: 500, color: '#fff', cursor: 'pointer', border: 'none', opacity: (!lostReason.trim() || isLosing) ? 0.4 : 1 }}>
                        {isLosing ? 'Saving…' : 'Confirm lost'}
                      </button>
                      <button onClick={() => { setShowLostForm(false); setLostReason('') }}
                        style={{ borderRadius: 7, border: '1px solid #e2e8f0', padding: '6px 12px', fontSize: 12, color: '#6b7280', cursor: 'pointer', background: '#fff' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {prospect.status === 'lost' && (
              <button onClick={() => reactivate()} disabled={isReactivating}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#2563eb', background: 'none', border: '1px solid #bfdbfe', borderRadius: 7, padding: '6px 12px', cursor: 'pointer', opacity: isReactivating ? 0.5 : 1 }}>
                <RefreshCw size={12} /> Reactivate prospect
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Prospect row
// ─────────────────────────────────────────────────────────────────────────────

function ProspectRow({ prospect, onClick }: { prospect: Prospect; onClick: () => void }) {
  return (
    <div onClick={onClick}
      style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 100px 80px 36px', padding: '14px 20px', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#3730a3', flexShrink: 0 }}>
          {prospect.first_name?.[0] ?? '?'}{prospect.last_name?.[0] ?? ''}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{prospect.full_name}</span>
            {prospect.is_returning_buyer && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
                <RefreshCw size={9} /> Returning
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{prospect.email}</span>
        </div>
      </div>
      <span style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prospect.project_name ?? '—'}</span>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{SOURCE_LABELS[prospect.source] ?? prospect.source}</span>
      <EngagementBadge level={prospect.engagement_level} />
      <StatusBadge status={prospect.status} />
      <ArrowRight size={14} color="#d1d5db" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProspectsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [sourceFilter, setSourceFilter] = useState('')
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [showAdd, setShowAdd]           = useState(false)

  const params: Record<string, string> = {}
  if (statusFilter) params.status = statusFilter
  if (sourceFilter) params.source = sourceFilter
  if (search)       params.q      = search

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['prospects', statusFilter, sourceFilter, search],
    queryFn: () => fetchProspects(params),
    staleTime: 0,
  })

  const filterBtn = (label: string, value: string, current: string, setter: (v: string) => void) => (
    <button key={value} onClick={() => setter(current === value ? '' : value)} style={{
      padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: 'pointer',
      background: current === value ? '#111827' : '#f8fafc',
      color: current === value ? '#fff' : '#6b7280',
      border: `1px solid ${current === value ? '#111827' : '#e2e8f0'}`,
      transition: 'all 0.15s',
    }}>
      {label}
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Prospects</h1>
            <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>
              {isLoading ? '—' : `${prospects.length} prospect${prospects.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#111827', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <Plus size={14} /> Add prospect
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
            <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email or phone…"
              style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 32, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', color: '#111827' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {filterBtn('Active', 'active', statusFilter, setStatusFilter)}
            {filterBtn('Converted', 'converted', statusFilter, setStatusFilter)}
            {filterBtn('Lost', 'lost', statusFilter, setStatusFilter)}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {filterBtn('Walk-in', 'walk_in', sourceFilter, setSourceFilter)}
            {filterBtn('Phone', 'phone', sourceFilter, setSourceFilter)}
            {filterBtn('Web form', 'website_form', sourceFilter, setSourceFilter)}
            {filterBtn('Portal', 'portal', sourceFilter, setSourceFilter)}
            {filterBtn('Referral', 'referral', sourceFilter, setSourceFilter)}
          </div>
        </div>
      </div>

      <div style={{ padding: 24 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px 100px 80px 36px', padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            {['Prospect', 'Project', 'Source', 'Engagement', 'Status', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>
          {isLoading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ height: 52, background: '#f1f5f9', borderRadius: 8 }} />)}
            </div>
          ) : prospects.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <User size={32} color="#e2e8f0" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>No prospects found.</p>
              <p style={{ fontSize: 12, color: '#d1d5db', marginTop: 4 }}>
                {statusFilter === 'active' ? 'Add a prospect or adjust your filters.' : 'Try changing your status filter.'}
              </p>
            </div>
          ) : (
            prospects.map(p => <ProspectRow key={p.id} prospect={p} onClick={() => setSelectedId(p.id)} />)
          )}
        </div>
      </div>

      {selectedId && <ProspectDetailPanel prospectId={selectedId} onClose={() => setSelectedId(null)} />}
      {showAdd && <AddProspectModal onClose={() => setShowAdd(false)} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['prospects'] })} />}
    </div>
  )
}