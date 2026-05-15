// src/features/contacts/ContactDetailPanel.tsx

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBuyer, getAgent, getSolicitor, getReferrer, updateBuyer } from '../../api/contacts'
import { getActivities, createActivity, completeActivity } from '../../api/activities'
import { getSalesByBuyer } from '../../api/sales'
import type { Activity } from '../../api/activities'
import type { Buyer } from '../../api/contacts'

interface Props {
  contactId: string
  contactType: 'Buyer' | 'Agent' | 'Solicitor' | 'Referrer'
  onClose: () => void
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  call:       { label: 'Call',       icon: 'ti-phone',       color: '#3b82f6' },
  email:      { label: 'Email',      icon: 'ti-mail',        color: '#8b5cf6' },
  meeting:    { label: 'Meeting',    icon: 'ti-calendar',    color: '#f59e0b' },
  inspection: { label: 'Inspection', icon: 'ti-home-search', color: '#06b6d4' },
  task:       { label: 'Task',       icon: 'ti-checkbox',    color: '#111827' },
  note:       { label: 'Note',       icon: 'ti-note',        color: '#6b7280' },
}

const INTEREST_COLOURS: Record<string, string> = {
  hot:  '#dc2626',
  warm: '#f59e0b',
  cold: '#3b82f6',
}

const SOURCE_LABELS: Record<string, string> = {
  agent:    'Agent referral',
  website:  'Website enquiry',
  display:  'Display suite',
  referral: 'Personal referral',
  social:   'Social media',
  other:    'Other',
}

const LOT_TYPE_OPTIONS = [
  { value: '',               label: 'Any' },
  { value: 'land',           label: 'Land' },
  { value: 'house_and_land', label: 'House & Land' },
  { value: 'apartment',      label: 'Apartment' },
  { value: 'townhouse',      label: 'Townhouse' },
  { value: 'commercial',     label: 'Commercial' },
]

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
  boxSizing: 'border-box' as const,
}

const labelStyle = {
  fontSize: 12, fontWeight: 500 as const,
  color: '#374151', marginBottom: 4, display: 'block',
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{value || '—'}</div>
    </div>
  )
}

function Section({ title, children, action }: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#6b7280',
          textTransform: 'uppercase' as const, letterSpacing: '0.08em',
        }}>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '2px 8px',
      borderRadius: 20, background: color + '20', color,
    }}>
      {label}
    </span>
  )
}

function fmt(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Prospect edit form
// ─────────────────────────────────────────────────────────────────────────────

function ProspectEditForm({ buyer, onSave, onCancel }: {
  buyer: Buyer
  onSave: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    interest_level:     buyer.interest_level ?? '',
    budget_min:         buyer.budget_min?.toString() ?? '',
    budget_max:         buyer.budget_max?.toString() ?? '',
    preferred_lot_type: buyer.preferred_lot_type ?? '',
    source:             buyer.source ?? '',
    notes:              buyer.notes ?? '',
    investment_intent:  buyer.investment_intent ?? false,
    marketing_opt_in:   buyer.marketing_opt_in ?? false,
  })
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => updateBuyer(buyer.id, {
      interest_level:     form.interest_level || undefined,
      budget_min:         form.budget_min ? parseFloat(form.budget_min) : null,
      budget_max:         form.budget_max ? parseFloat(form.budget_max) : null,
      preferred_lot_type: form.preferred_lot_type || '',
      source:             form.source || undefined,
      notes:              form.notes,
      investment_intent:  form.investment_intent,
      marketing_opt_in:   form.marketing_opt_in,
    } as any),
    onSuccess: () => onSave(),
    onError:   (e: any) => setError(e?.response?.data?.detail ?? 'Save failed'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Interest level</label>
          <select style={inputStyle} value={form.interest_level}
            onChange={e => setForm({ ...form, interest_level: e.target.value })}>
            <option value="">Not set</option>
            <option value="hot">Hot</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Source</label>
          <select style={inputStyle} value={form.source}
            onChange={e => setForm({ ...form, source: e.target.value })}>
            <option value="">Not set</option>
            <option value="agent">Agent referral</option>
            <option value="website">Website enquiry</option>
            <option value="display">Display suite</option>
            <option value="referral">Personal referral</option>
            <option value="social">Social media</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Budget min</label>
          <input style={inputStyle} type="number" placeholder="e.g. 500000"
            value={form.budget_min}
            onChange={e => setForm({ ...form, budget_min: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Budget max</label>
          <input style={inputStyle} type="number" placeholder="e.g. 750000"
            value={form.budget_max}
            onChange={e => setForm({ ...form, budget_max: e.target.value })} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>Preferred lot type</label>
        <select style={inputStyle} value={form.preferred_lot_type}
          onChange={e => setForm({ ...form, preferred_lot_type: e.target.value })}>
          {LOT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, minHeight: 72, resize: 'vertical' as const }}
          value={form.notes}
          placeholder="Internal notes on this prospect…"
          onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.investment_intent}
            onChange={e => setForm({ ...form, investment_intent: e.target.checked })} />
          Investment purchase
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.marketing_opt_in}
            onChange={e => setForm({ ...form, marketing_opt_in: e.target.checked })} />
          Marketing opt-in
        </label>
      </div>
      {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => mutate()} disabled={isPending} style={{
          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} style={{
          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity log form
// ─────────────────────────────────────────────────────────────────────────────

function LogActivityForm({ contactId, contactType, onSaved }: {
  contactId: string
  contactType: string
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    activity_type: 'note',
    subject: '',
    description: '',
    activity_date: new Date().toISOString().slice(0, 16),
    due_date: '',
    sale_id: '',
  })
  const [error, setError] = useState<string | null>(null)

  const { data: buyerSales = [] } = useQuery({
    queryKey: ['sales', 'buyer', contactId],
    queryFn: () => getSalesByBuyer(contactId),
    enabled: open && contactType === 'Buyer',
  })

  const mutation = useMutation({
    mutationFn: () => createActivity({
      activity_type: form.activity_type,
      subject: form.subject,
      description: form.description,
      activity_date: form.activity_date,
      contact_type: contactType,
      contact_id: contactId,
      ...(form.sale_id && { sale: form.sale_id }),
      ...(form.activity_type === 'task' && form.due_date && { due_date: form.due_date }),
    }),
    onSuccess: () => {
      setOpen(false)
      setForm({ activity_type: 'note', subject: '', description: '', activity_date: new Date().toISOString().slice(0, 16), due_date: '', sale_id: '' })
      onSaved()
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Something went wrong.'),
  })

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
      }}>
        <i className="ti ti-plus" style={{ marginRight: 5 }} />
        Log Activity
      </button>
    )
  }

  return (
    <div style={{ background: '#f9fafb', borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select style={inputStyle} value={form.activity_type}
            onChange={(e) => setForm({ ...form, activity_type: e.target.value })}>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Date & time</label>
          <input style={inputStyle} type="datetime-local" value={form.activity_date}
            onChange={(e) => setForm({ ...form, activity_date: e.target.value })} />
        </div>
      </div>
      {contactType === 'Buyer' && buyerSales.length > 0 && (
        <div>
          <label style={labelStyle}>Link to sale (optional)</label>
          <select style={inputStyle} value={form.sale_id}
            onChange={(e) => setForm({ ...form, sale_id: e.target.value })}>
            <option value="">No sale</option>
            {buyerSales.map((s: any) => (
              <option key={s.id} value={s.id}>
                Lot {s.lot_number} — {s.project_name} ({s.status.replace(/_/g, ' ')})
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label style={labelStyle}>Subject *</label>
        <input style={inputStyle} value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="e.g. Called prospect to discuss budget" />
      </div>
      <div>
        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      {form.activity_type === 'task' && (
        <div>
          <label style={labelStyle}>Due date</label>
          <input style={inputStyle} type="date" value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => {
          if (!form.subject.trim()) { setError('Subject is required.'); return }
          setError(null)
          mutation.mutate()
        }} disabled={mutation.isPending} style={{
          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
          opacity: mutation.isPending ? 0.6 : 1,
        }}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setOpen(false)} style={{
          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact info sections
// ─────────────────────────────────────────────────────────────────────────────

function ProspectInfo({ contactId }: { contactId: string }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const { data: buyer } = useQuery({
    queryKey: ['buyer', contactId],
    queryFn:  () => getBuyer(contactId),
  })

  if (!buyer) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</div>

  const handleSave = () => {
    setEditing(false)
    queryClient.invalidateQueries({ queryKey: ['buyer', contactId] })
    queryClient.invalidateQueries({ queryKey: ['buyers'] })
  }

  return (
    <>
      {/* Conversion status banner */}
      {buyer.is_converted ? (
        <div style={{
          background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
          padding: '10px 14px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#15803d',
        }}>
          <i className="ti ti-check" />
          <span>
            <strong>Purchased</strong> — converted{' '}
            {buyer.converted_at ? new Date(buyer.converted_at).toLocaleDateString('en-AU') : ''}
          </span>
        </div>
      ) : (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
          padding: '10px 14px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#92400e',
        }}>
          <i className="ti ti-user" />
          <span>Active prospect — not yet converted to purchaser</span>
        </div>
      )}

      {/* Contact details */}
      <Section title="Contact details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Name"  value={buyer.display_name} />
          <Field label="Type"  value={buyer.buyer_type} />
          <Field label="Email" value={buyer.email} />
          <Field label="Phone" value={buyer.phone} />
          {buyer.address && <Field label="Address" value={buyer.address} />}
          {buyer.date_of_birth && (
            <Field label="Date of birth" value={new Date(buyer.date_of_birth).toLocaleDateString('en-AU')} />
          )}
          <Field label="ID verified" value={buyer.id_verified ? 'Yes' : 'No'} />
        </div>
      </Section>

      {/* Prospect profile */}
      <Section
        title="Prospect profile"
        action={!editing ? (
          <button onClick={() => setEditing(true)} style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 4,
            background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
          }}>
            Edit
          </button>
        ) : undefined}
      >
        {editing ? (
          <ProspectEditForm
            buyer={buyer}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Interest level</div>
              {buyer.interest_level
                ? <Badge label={buyer.interest_level.charAt(0).toUpperCase() + buyer.interest_level.slice(1)} color={INTEREST_COLOURS[buyer.interest_level] ?? '#6b7280'} />
                : <span style={{ fontSize: 13, color: '#9ca3af' }}>—</span>
              }
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Source</div>
              <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>
                {buyer.source ? SOURCE_LABELS[buyer.source] ?? buyer.source : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Budget</div>
              <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>
                {(buyer.budget_min || buyer.budget_max)
                  ? `${fmt(buyer.budget_min)} – ${fmt(buyer.budget_max)}`
                  : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Preferred type</div>
              <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>
                {buyer.preferred_lot_type
                  ? buyer.preferred_lot_type.replace(/_/g, ' ')
                  : '—'}
              </div>
            </div>
            {buyer.notes && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Notes</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{buyer.notes}</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Investment</div>
              <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>
                {buyer.investment_intent ? 'Yes' : 'No'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>Marketing opt-in</div>
              <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>
                {buyer.marketing_opt_in ? 'Yes' : 'No'}
              </div>
            </div>
          </div>
        )}
      </Section>
    </>
  )
}

function AgentInfo({ contactId }: { contactId: string }) {
  const { data: agent } = useQuery({
    queryKey: ['agent', contactId],
    queryFn:  () => getAgent(contactId),
  })
  if (!agent) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</div>
  return (
    <Section title="Agent details">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Name"   value={`${agent.first_name} ${agent.last_name}`} />
        <Field label="Agency" value={agent.agency_name} />
        <Field label="Email"  value={agent.email} />
        <Field label="Phone"  value={agent.phone} />
        <Field label="Status" value={agent.is_active ? 'Active' : 'Inactive'} />
      </div>
    </Section>
  )
}

function SolicitorInfo({ contactId }: { contactId: string }) {
  const { data: solicitor } = useQuery({
    queryKey: ['solicitor', contactId],
    queryFn:  () => getSolicitor(contactId),
  })
  if (!solicitor) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</div>
  return (
    <Section title="Solicitor details">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Name"    value={`${solicitor.first_name} ${solicitor.last_name}`} />
        <Field label="Firm"    value={solicitor.firm_name} />
        <Field label="Email"   value={solicitor.email} />
        <Field label="Phone"   value={solicitor.phone} />
        <Field label="Address" value={solicitor.address} />
      </div>
    </Section>
  )
}

function ReferrerInfo({ contactId }: { contactId: string }) {
  const { data: referrer } = useQuery({
    queryKey: ['referrer', contactId],
    queryFn:  () => getReferrer(contactId),
  })
  if (!referrer) return <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</div>
  return (
    <Section title="Referrer details">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Name"    value={`${referrer.first_name} ${referrer.last_name}`} />
        <Field label="Company" value={referrer.company_name} />
        <Field label="Email"   value={referrer.email} />
        <Field label="Phone"   value={referrer.phone} />
      </div>
    </Section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export default function ContactDetailPanel({ contactId, contactType, onClose }: Props) {
  const { data: activities = [], refetch: refetchActivities } = useQuery<Activity[]>({
    queryKey: ['activities', 'contact', contactId],
    queryFn:  () => getActivities({ contact_type: contactType, contact_id: contactId }),
  })

  const completeMutation = useMutation({
    mutationFn: completeActivity,
    onSuccess:  () => refetchActivities(),
  })

  const panelTitle = contactType === 'Buyer' ? 'Prospect' : contactType

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 900,
      }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
        background: '#fff', zIndex: 901, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{panelTitle}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Contact record</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', fontSize: 20, padding: 0,
          }}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {contactType === 'Buyer'     && <ProspectInfo   contactId={contactId} />}
          {contactType === 'Agent'     && <AgentInfo      contactId={contactId} />}
          {contactType === 'Solicitor' && <SolicitorInfo  contactId={contactId} />}
          {contactType === 'Referrer'  && <ReferrerInfo   contactId={contactId} />}

          <Section title="Activity Log">
            <LogActivityForm
              contactId={contactId}
              contactType={contactType}
              onSaved={() => refetchActivities()}
            />
            {activities.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 12 }}>No activities logged.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {activities.map((a) => {
                  const tc = TYPE_CONFIG[a.activity_type] ?? { label: a.activity_type, icon: 'ti-circle', color: '#6b7280' }
                  const isTask = a.activity_type === 'task'
                  return (
                    <div key={a.id} style={{
                      background: '#f9fafb', borderRadius: 8, padding: '10px 12px',
                      opacity: a.is_complete ? 0.6 : 1,
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        background: tc.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className={`ti ${tc.icon}`} style={{ color: tc.color, fontSize: 13 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600, color: '#111827',
                          textDecoration: a.is_complete ? 'line-through' : 'none',
                        }}>
                          {a.subject}
                        </div>
                        {a.description && (
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{a.description}</div>
                        )}
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>
                          {new Date(a.activity_date).toLocaleDateString('en-AU')}
                          {a.due_date && ` · Due ${new Date(a.due_date).toLocaleDateString('en-AU')}`}
                        </div>
                        {isTask && !a.is_complete && (
                          <button onClick={() => completeMutation.mutate(a.id)} style={{
                            marginTop: 6, padding: '3px 8px', borderRadius: 4, fontSize: 10,
                            fontWeight: 500, background: '#f0fdf4', color: '#16a34a',
                            border: '1px solid #bbf7d0', cursor: 'pointer',
                          }}>
                            Mark complete
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  )
}