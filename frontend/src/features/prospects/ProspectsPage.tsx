// src/features/prospects/ProspectsPage.tsx
// Route: /prospects

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, X, AlertCircle, Flame, Thermometer, Snowflake,
  Phone, Mail, User, ArrowRight, RefreshCw, Pencil, Check,
} from 'lucide-react'
import client from '../../api/client'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ProspectStatus  = 'active' | 'converted' | 'lost'
type ProspectSource  = 'website_form' | 'portal' | 'walk_in' | 'phone' | 'referral' | 'other'
type EngagementLevel = 'cold' | 'warm' | 'hot'

interface ReturningSummary {
  project_name: string
  lot_number:   string
  status:       string
  sale_price:   string | null
  created_at:   string
}

interface Prospect {
  id:                      string
  full_name:               string
  first_name:              string
  last_name:               string
  email:                   string
  phone:                   string
  source:                  ProspectSource
  status:                  ProspectStatus
  lost_reason:             string
  project:                 string | null
  project_name:            string | null
  lot:                     string | null
  lot_number:              string | null
  budget_min:              number | null
  budget_max:              number | null
  assigned_to:             string | null
  assigned_to_name:        string | null
  notes:                   string
  is_returning_buyer:      boolean
  buyer:                   string | null
  returning_buyer_summary: ReturningSummary | null
  engagement_level:        EngagementLevel
  purchase_intent:         'investor' | 'owner_occupier' | 'undecided' | ''
  converted_at:            string | null
  created_at:              string
}

interface OrgUser { id: string; full_name: string }
interface ProjectOption { id: string; name: string }

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

async function fetchOrgUsers(): Promise<OrgUser[]> {
  const { data } = await client.get('/org-users/')
  return Array.isArray(data) ? data : (data as any).results ?? []
}

async function fetchProjects(): Promise<ProjectOption[]> {
  const { data } = await client.get<any>('/projects/')
  return Array.isArray(data) ? data : (data.results ?? [])
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ProspectStatus, { bg: string; color: string; border: string; label: string }> = {
  active:    { bg: '#eef7f0', color: '#1a5c2e', border: '#b8dfc3', label: 'Active'    },
  converted: { bg: '#eef2fb', color: '#1e3a7a', border: '#c5d3f0', label: 'Converted' },
  lost:      { bg: '#f2f0ee', color: '#7a6e68', border: '#ddd7d2', label: 'Lost'      },
}

const SOURCE_LABELS: Record<string, string> = {
  website_form: 'Web form',
  portal:       'Portal',
  walk_in:      'Walk-in',
  phone:        'Phone',
  referral:     'Referral',
  other:        'Other',
}

const ENGAGEMENT_CONFIG = {
  hot:  { icon: <Flame size={11} />,       bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Hot'  },
  warm: { icon: <Thermometer size={11} />, bg: '#fef6ec', color: '#9a5f00', border: '#fcd9a0', label: 'Warm' },
  cold: { icon: <Snowflake size={11} />,   bg: '#eef2fb', color: '#2649a0', border: '#c5d3f0', label: 'Cold' },
}

function EngagementBadge({ level }: { level: string }) {
  const config = ENGAGEMENT_CONFIG[level as EngagementLevel] ?? ENGAGEMENT_CONFIG.cold
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
  const s = STATUS_STYLES[status as ProspectStatus] ?? STATUS_STYLES.lost
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

function fmt(n: number | null | undefined): string {
  if (!n) return ''
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #d4ccc5', borderRadius: 6,
  padding: '7px 10px', fontSize: 13, color: '#2c2420',
  background: '#fff', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 500, color: '#7a6e68', marginBottom: 3,
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Prospect modal
// ─────────────────────────────────────────────────────────────────────────────

function AddProspectModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    first_name:       '',
    last_name:        '',
    email:            '',
    phone:            '',
    source:           'walk_in',
    engagement_level: 'cold',
    purchase_intent:  'undecided',
    project:          '',
    budget_min:       '',
    budget_max:       '',
    assigned_to:      '',
    notes:            '',
  })
  const [error, setError] = useState<string | null>(null)

  const { data: orgUsers = [] } = useQuery<OrgUser[]>({
    queryKey: ['org-users'],
    queryFn:  fetchOrgUsers,
    staleTime: 10 * 60 * 1000,
  })

  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ['projects', 'list'],
    queryFn:  fetchProjects,
    staleTime: 60_000,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      await client.post('/prospects/', {
        first_name:       form.first_name,
        last_name:        form.last_name,
        email:            form.email,
        phone:            form.phone || '',
        source:           form.source,
        engagement_level: form.engagement_level,
        purchase_intent:  form.purchase_intent || 'undecided',
        project:          form.project || null,
        budget_min:       form.budget_min ? parseFloat(form.budget_min) : null,
        budget_max:       form.budget_max ? parseFloat(form.budget_max) : null,
        assigned_to:      form.assigned_to || null,
        notes:            form.notes,
      })
    },
    onSuccess: () => { onSuccess(); onClose() },
    onError:   (err: any) => setError(err?.response?.data?.detail ?? 'Failed to create prospect.'),
  })

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,32,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, maxHeight: '90vh', boxShadow: '0 20px 60px rgba(44,36,32,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #f0ebe6', flexShrink: 0 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#2c2420', margin: 0 }}>Add prospect</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a89e98' }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Engagement</label>
              <select style={inputStyle} value={form.engagement_level} onChange={e => set('engagement_level', e.target.value)}>
                <option value="cold">Cold</option>
                <option value="warm">Warm</option>
                <option value="hot">Hot</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Purchase intent</label>
              <select style={inputStyle} value={form.purchase_intent} onChange={e => set('purchase_intent', e.target.value)}>
                <option value="undecided">Not set</option>
                <option value="owner_occupier">Owner occupier</option>
                <option value="investor">Investor</option>
              </select>
            </div>
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
            <label style={labelStyle}>Project interest</label>
            <select style={inputStyle} value={form.project} onChange={e => set('project', e.target.value)}>
              <option value="">No project selected</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Budget min</label>
              <input style={inputStyle} type="number" placeholder="e.g. 400000" value={form.budget_min}
                onChange={e => set('budget_min', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Budget max</label>
              <input style={inputStyle} type="number" placeholder="e.g. 600000" value={form.budget_max}
                onChange={e => set('budget_max', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Assigned to</label>
            <select style={inputStyle} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}>
              <option value="">Unassigned</option>
              {orgUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }} value={form.notes}
              onChange={e => set('notes', e.target.value)} placeholder="Any initial notes about this prospect…" />
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#fdf0ee', borderRadius: 8, border: '1px solid #f5c4bb' }}>
              <AlertCircle size={13} color="#882010" />
              <p style={{ fontSize: 12, color: '#882010', margin: 0 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid #f0ebe6', flexShrink: 0 }}>
          <button onClick={onClose} style={{ borderRadius: 8, border: '1px solid #e8e2dd', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#7a6e68', cursor: 'pointer', background: '#fff', fontFamily: 'var(--font-body)' }}>
            Cancel
          </button>
          <button
            onClick={() => mutate()}
            disabled={isPending || !form.first_name || !form.last_name || !form.email}
            style={{ borderRadius: 8, background: '#3d4a5c', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#fff', cursor: 'pointer', border: 'none', opacity: (isPending || !form.first_name || !form.last_name || !form.email) ? 0.4 : 1, fontFamily: 'var(--font-body)' }}>
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
  const [editing,      setEditing]      = useState(false)
  const [lostReason,   setLostReason]   = useState('')
  const [showLostForm, setShowLostForm] = useState(false)
  const [actionError,  setActionError]  = useState<string | null>(null)
  const [editError,    setEditError]    = useState<string | null>(null)
  const [form, setForm] = useState({
    first_name:       '',
    last_name:        '',
    email:            '',
    phone:            '',
    engagement_level: 'cold',
    purchase_intent:  'undecided',
    source:           'walk_in',
    project:          '',
    budget_min:       '',
    budget_max:       '',
    assigned_to:      '',
    notes:            '',
  })

  const { data: prospect, isLoading } = useQuery({
    queryKey: ['prospect-detail', prospectId],
    queryFn:  () => fetchProspect(prospectId),
    staleTime: 0,
  })

  const { data: orgUsers = [] } = useQuery<OrgUser[]>({
    queryKey: ['org-users'],
    queryFn:  fetchOrgUsers,
    staleTime: 10 * 60 * 1000,
  })

  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ['projects', 'list'],
    queryFn:  fetchProjects,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (prospect) {
      setForm({
        first_name:       prospect.first_name,
        last_name:        prospect.last_name,
        email:            prospect.email,
        phone:            prospect.phone ?? '',
        engagement_level: prospect.engagement_level,
        purchase_intent:  prospect.purchase_intent ?? 'undecided',
        source:           prospect.source,
        project:          prospect.project ?? '',
        budget_min:       prospect.budget_min?.toString() ?? '',
        budget_max:       prospect.budget_max?.toString() ?? '',
        assigned_to:      prospect.assigned_to ?? '',
        notes:            prospect.notes ?? '',
      })
    }
  }, [prospect])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['prospect-detail', prospectId] })
    queryClient.invalidateQueries({ queryKey: ['prospects'] })
  }

  const { mutate: saveEdit, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      await client.patch(`/prospects/${prospectId}/`, {
        first_name:       form.first_name,
        last_name:        form.last_name,
        email:            form.email,
        phone:            form.phone || '',
        engagement_level: form.engagement_level,
        purchase_intent:  form.purchase_intent || 'undecided',
        source:           form.source,
        project:          form.project || null,
        budget_min:       form.budget_min ? parseFloat(form.budget_min) : null,
        budget_max:       form.budget_max ? parseFloat(form.budget_max) : null,
        assigned_to:      form.assigned_to || null,
        notes:            form.notes,
      })
    },
    onSuccess: () => { setEditing(false); setEditError(null); invalidate() },
    onError:   (err: any) => setEditError(err?.response?.data?.detail ?? 'Failed to save.'),
  })

  const { mutate: markLost, isPending: isLosing } = useMutation({
    mutationFn: async () => { await client.post(`/prospects/${prospectId}/lose/`, { lost_reason: lostReason }) },
    onSuccess:  () => { setShowLostForm(false); setActionError(null); invalidate() },
    onError:    (err: any) => setActionError(err?.response?.data?.detail ?? 'Failed to mark as lost.'),
  })

  const { mutate: reactivate, isPending: isReactivating } = useMutation({
    mutationFn: async () => { await client.post(`/prospects/${prospectId}/reactivate/`) },
    onSuccess:  () => { setActionError(null); invalidate() },
    onError:    (err: any) => setActionError(err?.response?.data?.detail ?? 'Failed to reactivate.'),
  })

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f0ebe6', padding: '8px 0', fontSize: 13, gap: 12 }}>
      <span style={{ color: '#7a6e68', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#2c2420', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(44,36,32,0.3)' }} />
      <div style={{ width: 480, background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(44,36,32,0.10)', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f0ebe6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#2c2420', margin: 0 }}>
            {editing ? 'Edit prospect' : 'Prospect'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!editing && prospect?.status === 'active' && (
              <button
                onClick={() => setEditing(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                <Pencil size={12} /> Edit
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a89e98' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height: 48, background: '#f2f0ee', borderRadius: 8 }} />)}
          </div>
        ) : !prospect ? (
          <div style={{ padding: 24, color: '#a89e98', fontSize: 13 }}>Prospect not found.</div>
        ) : editing ? (

          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>First name *</label>
                <input style={inputStyle} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Last name *</label>
                <input style={inputStyle} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0400 000 000" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Engagement</label>
                <select style={inputStyle} value={form.engagement_level} onChange={e => setForm(f => ({ ...f, engagement_level: e.target.value }))}>
                  <option value="cold">Cold</option>
                  <option value="warm">Warm</option>
                  <option value="hot">Hot</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Purchase intent</label>
                <select style={inputStyle} value={form.purchase_intent} onChange={e => setForm(f => ({ ...f, purchase_intent: e.target.value }))}>
                  <option value="undecided">Not set</option>
                  <option value="owner_occupier">Owner occupier</option>
                  <option value="investor">Investor</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Source</label>
              <select style={inputStyle} value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <option value="walk_in">Walk-in</option>
                <option value="phone">Phone</option>
                <option value="referral">Referral</option>
                <option value="website_form">Web form</option>
                <option value="portal">Portal</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Project interest</label>
              <select style={inputStyle} value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))}>
                <option value="">No project selected</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Budget min</label>
                <input style={inputStyle} type="number" placeholder="e.g. 400000" value={form.budget_min}
                  onChange={e => setForm(f => ({ ...f, budget_min: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Budget max</label>
                <input style={inputStyle} type="number" placeholder="e.g. 600000" value={form.budget_max}
                  onChange={e => setForm(f => ({ ...f, budget_max: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Assigned to</label>
              <select style={inputStyle} value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">Unassigned</option>
                {orgUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: 96 }} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Notes about this prospect…" />
            </div>
            {editError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#fdf0ee', borderRadius: 8, border: '1px solid #f5c4bb' }}>
                <AlertCircle size={13} color="#882010" />
                <p style={{ fontSize: 12, color: '#882010', margin: 0 }}>{editError}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
              <button onClick={() => {
                if (!form.first_name || !form.last_name || !form.email) { setEditError('First name, last name and email are required.'); return }
                setEditError(null); saveEdit()
              }} disabled={isSaving} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                background: '#3d4a5c', color: '#fff', border: 'none', cursor: 'pointer',
                opacity: isSaving ? 0.6 : 1, fontFamily: 'var(--font-body)',
              }}>
                <Check size={13} /> {isSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button onClick={() => { setEditing(false); setEditError(null) }} style={{
                padding: '8px 14px', borderRadius: 7, fontSize: 13, fontWeight: 500,
                background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}>
                Cancel
              </button>
            </div>
          </div>

        ) : (

          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>

            {prospect.is_returning_buyer && prospect.returning_buyer_summary && (
              <div style={{ background: '#f5f0fb', border: '1px solid #d9c5f5', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <RefreshCw size={13} color="#5b2d8a" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#5b2d8a' }}>Returning buyer</span>
                </div>
                <p style={{ fontSize: 12, color: '#5b2d8a', margin: 0 }}>
                  Previously purchased Lot {prospect.returning_buyer_summary.lot_number} at {prospect.returning_buyer_summary.project_name}
                  {prospect.returning_buyer_summary.sale_price && ` · $${Number(prospect.returning_buyer_summary.sale_price).toLocaleString()}`}
                  {' · '}{prospect.returning_buyer_summary.status.replace(/_/g, ' ')}
                </p>
              </div>
            )}

            <div style={{ background: '#f9f6f4', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#c0533a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                  {prospect.first_name?.[0]}{prospect.last_name?.[0]}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#2c2420', margin: 0 }}>{prospect.full_name}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                    <StatusBadge status={prospect.status} />
                    <EngagementBadge level={prospect.engagement_level} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <a href={`mailto:${prospect.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#c0533a', textDecoration: 'none' }}>
                  <Mail size={13} color="#a89e98" />{prospect.email}
                </a>
                {prospect.phone && (
                  <a href={`tel:${prospect.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#2c2420', textDecoration: 'none' }}>
                    <Phone size={13} color="#a89e98" />{prospect.phone}
                  </a>
                )}
              </div>
            </div>

            <div>
              <Row label="Source"           value={SOURCE_LABELS[prospect.source] ?? prospect.source} />
              <Row label="Engagement"       value={<EngagementBadge level={prospect.engagement_level} />} />
              <Row label="Purchase intent"  value={
                prospect.purchase_intent === 'investor'       ? 'Investor' :
                prospect.purchase_intent === 'owner_occupier' ? 'Owner occupier' : '—'
              } />
              <Row label="Project interest" value={prospect.project_name ?? '—'} />
              <Row label="Lot interest"     value={prospect.lot_number ? `Lot ${prospect.lot_number}` : '—'} />
              <Row label="Budget"           value={
                (prospect.budget_min || prospect.budget_max)
                  ? `${fmt(prospect.budget_min) || '—'} – ${fmt(prospect.budget_max) || '—'}`
                  : '—'
              } />
              <Row label="Assigned to"      value={prospect.assigned_to_name ?? '—'} />
              <Row label="Created"          value={formatDate(prospect.created_at)} />
              {prospect.status === 'converted' && prospect.converted_at && (
                <Row label="Converted" value={formatDate(prospect.converted_at)} />
              )}
            </div>

            {prospect.notes && (
              <div style={{ background: '#f9f6f4', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#a89e98', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Notes</p>
                <p style={{ fontSize: 13, color: '#2c2420', lineHeight: 1.6, margin: 0 }}>{prospect.notes}</p>
              </div>
            )}

            {prospect.status === 'lost' && prospect.lost_reason && (
              <div style={{ background: '#fdf0ee', border: '1px solid #f5c4bb', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#a89e98', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Lost reason</p>
                <p style={{ fontSize: 13, color: '#882010', lineHeight: 1.6, margin: 0 }}>{prospect.lost_reason}</p>
              </div>
            )}

            {actionError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#fdf0ee', borderRadius: 8, border: '1px solid #f5c4bb' }}>
                <AlertCircle size={13} color="#882010" />
                <p style={{ fontSize: 12, color: '#882010', margin: 0 }}>{actionError}</p>
              </div>
            )}

            {prospect.status === 'active' && (
              <div>
                {!showLostForm ? (
                  <button onClick={() => setShowLostForm(true)} style={{
                    fontSize: 12, color: '#7a6e68', background: 'none',
                    border: '1px solid #e8e2dd', borderRadius: 7, padding: '6px 12px', cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                  }}>
                    Mark as lost
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      placeholder="Reason for losing this prospect…"
                      value={lostReason}
                      onChange={e => setLostReason(e.target.value)}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => markLost()} disabled={!lostReason.trim() || isLosing}
                        style={{ borderRadius: 7, background: '#3d4a5c', padding: '6px 14px', fontSize: 12, fontWeight: 500, color: '#fff', cursor: 'pointer', border: 'none', opacity: (!lostReason.trim() || isLosing) ? 0.4 : 1, fontFamily: 'var(--font-body)' }}>
                        {isLosing ? 'Saving…' : 'Confirm lost'}
                      </button>
                      <button onClick={() => { setShowLostForm(false); setLostReason('') }}
                        style={{ borderRadius: 7, border: '1px solid #e8e2dd', padding: '6px 12px', fontSize: 12, color: '#7a6e68', cursor: 'pointer', background: '#fff', fontFamily: 'var(--font-body)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {prospect.status === 'lost' && (
              <button onClick={() => reactivate()} disabled={isReactivating} style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                color: '#1a5c2e', background: '#eef7f0', border: '1px solid #b8dfc3',
                borderRadius: 7, padding: '6px 12px', cursor: 'pointer',
                opacity: isReactivating ? 0.5 : 1, fontFamily: 'var(--font-body)',
              }}>
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
  const intentLabel =
    prospect.purchase_intent === 'investor'       ? 'Investor' :
    prospect.purchase_intent === 'owner_occupier' ? 'Owner occ.' : '—'

  const budgetLabel =
    (prospect.budget_min || prospect.budget_max)
      ? `${fmt(prospect.budget_min) || '—'} – ${fmt(prospect.budget_max) || '—'}`
      : '—'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 100px 110px 120px 120px 90px 36px',
        padding: '12px 20px', alignItems: 'center', cursor: 'pointer',
        borderBottom: '1px solid #f0ebe6', transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#faf8f7')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f7ece9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#c0533a', flexShrink: 0 }}>
          {prospect.first_name?.[0]}{prospect.last_name?.[0]}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#2c2420', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{prospect.full_name}</span>
            {prospect.is_returning_buyer && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#f5f0fb', color: '#5b2d8a', border: '1px solid #d9c5f5', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                <RefreshCw size={9} /> Returning
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: '#a89e98', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{prospect.email}</span>
        </div>
      </div>
      <span style={{ fontSize: 12, color: '#7a6e68', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {prospect.project_name ?? '—'}
      </span>
      <span style={{ fontSize: 12, color: '#7a6e68' }}>{SOURCE_LABELS[prospect.source] ?? prospect.source}</span>
      <EngagementBadge level={prospect.engagement_level} />
      <span style={{ fontSize: 12, color: intentLabel === '—' ? '#d4ccc5' : '#2c2420' }}>{intentLabel}</span>
      <span style={{ fontSize: 12, color: budgetLabel === '—' ? '#d4ccc5' : '#2c2420' }}>{budgetLabel}</span>
      <StatusBadge status={prospect.status} />
      <ArrowRight size={14} color="#d4ccc5" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProspectsPage() {
  const queryClient = useQueryClient()
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [sourceFilter, setSourceFilter] = useState('')
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [showAdd,      setShowAdd]      = useState(false)

  const params: Record<string, string> = {}
  if (statusFilter) params.status = statusFilter
  if (sourceFilter) params.source = sourceFilter
  if (search)       params.q      = search

  const { data: prospects = [], isLoading } = useQuery({
    queryKey:  ['prospects', params],
    queryFn:   () => fetchProspects(params),
    staleTime: 30_000,
  })

  const filterBtn = (label: string, value: string, current: string, setter: (v: string) => void) => (
    <button key={value} onClick={() => setter(current === value ? '' : value)} style={{
      padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500, cursor: 'pointer',
      background: current === value ? '#3d4a5c' : '#f2f0ee',
      color:      current === value ? '#fff'    : '#7a6e68',
      border:     `1px solid ${current === value ? '#3d4a5c' : 'transparent'}`,
      transition: 'all 0.15s', fontFamily: 'var(--font-body)',
    }}>
      {label}
    </button>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f9f6f4' }}>

      <div style={{ background: '#fff', borderBottom: '1px solid #e8e2dd', padding: '20px 24px', boxShadow: '0 1px 2px rgba(44,36,32,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#2c2420', margin: 0 }}>Prospects</h1>
            <p style={{ fontSize: 13, color: '#a89e98', marginTop: 3 }}>
              {isLoading ? '—' : `${prospects.length} prospect${prospects.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={() => setShowAdd(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#c0533a', color: '#fff',
            border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}>
            <Plus size={14} /> Add prospect
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
            <Search size={14} color="#a89e98" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or phone…"
              style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 32, paddingRight: 10, paddingTop: 8, paddingBottom: 8, border: '1px solid #e8e2dd', borderRadius: 8, fontSize: 13, outline: 'none', color: '#2c2420', background: '#fff' }} />
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
        <div style={{ background: '#fff', border: '1px solid #e8e2dd', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 2px rgba(44,36,32,0.06)' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '260px 1fr 100px 110px 120px 120px 90px 36px',
            padding: '10px 20px', background: '#f9f6f4', borderBottom: '1px solid #f0ebe6',
          }}>
            {['Prospect', 'Project', 'Source', 'Engagement', 'Intent', 'Budget', 'Status', ''].map((h, i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 600, color: '#a89e98', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {isLoading ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3,4,5].map(i => <div key={i} style={{ height: 52, background: '#f2f0ee', borderRadius: 8 }} />)}
            </div>
          ) : prospects.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <User size={32} color="#d4ccc5" style={{ marginBottom: 12 }} />
              <p style={{ fontSize: 14, color: '#a89e98', margin: 0 }}>No prospects found.</p>
              <p style={{ fontSize: 12, color: '#d4ccc5', marginTop: 4 }}>
                {statusFilter === 'active' ? 'Add a prospect or adjust your filters.' : 'Try changing your status filter.'}
              </p>
            </div>
          ) : (
            prospects.map(p => (
              <ProspectRow key={p.id} prospect={p} onClick={() => setSelectedId(p.id)} />
            ))
          )}
        </div>
      </div>

      {selectedId && (
        <ProspectDetailPanel prospectId={selectedId} onClose={() => setSelectedId(null)} />
      )}

      {showAdd && (
        <AddProspectModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['prospects'] })}
        />
      )}
    </div>
  )
}