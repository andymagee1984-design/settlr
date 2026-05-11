import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getSale } from '../../api/sales'
import { getActivities, createActivity, completeActivity } from '../../api/activities'
import type { Sale } from '../../api/sales'
import type { Activity } from '../../api/activities'

interface Props {
  saleId: string
  onClose: () => void
}

const STATUS_COLOURS: Record<string, { bg: string; color: string; label: string }> = {
  on_hold:         { bg: '#fef9c3', color: '#854d0e', label: 'On Hold' },
  pending:         { bg: '#dbeafe', color: '#1e40af', label: 'Pending Approval' },
  declined:        { bg: '#fee2e2', color: '#991b1b', label: 'Declined' },
  reserved:        { bg: '#ede9fe', color: '#5b21b6', label: 'Reserved' },
  contract_issued: { bg: '#ffedd5', color: '#9a3412', label: 'Contract Issued' },
  exchanged:       { bg: '#d1fae5', color: '#065f46', label: 'Exchanged' },
  settled:         { bg: '#f0fdf4', color: '#166534', label: 'Settled' },
  fallen_over:     { bg: '#f3f4f6', color: '#6b7280', label: 'Fallen Over' },
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  call:       { label: 'Call',       icon: 'ti-phone',       color: '#3b82f6' },
  email:      { label: 'Email',      icon: 'ti-mail',        color: '#8b5cf6' },
  meeting:    { label: 'Meeting',    icon: 'ti-calendar',    color: '#f59e0b' },
  inspection: { label: 'Inspection', icon: 'ti-home-search', color: '#06b6d4' },
  task:       { label: 'Task',       icon: 'ti-checkbox',    color: '#111827' },
  note:       { label: 'Note',       icon: 'ti-note',        color: '#6b7280' },
}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#6b7280',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function LogActivityForm({ saleId, primaryBuyerId, onSaved }: {
  saleId: string
  primaryBuyerId: string
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    activity_type: 'note',
    subject: '',
    description: '',
    activity_date: new Date().toISOString().slice(0, 16),
    due_date: '',
  })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => createActivity({
      activity_type: form.activity_type,
      subject: form.subject,
      description: form.description,
      activity_date: form.activity_date,
      sale: saleId,
      contact_type: 'Buyer',
      contact_id: primaryBuyerId,
      ...(form.activity_type === 'task' && form.due_date && { due_date: form.due_date }),
    }),
    onSuccess: () => {
      setOpen(false)
      setForm({ activity_type: 'note', subject: '', description: '', activity_date: new Date().toISOString().slice(0, 16), due_date: '' })
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
      <div>
        <label style={labelStyle}>Subject *</label>
        <input style={inputStyle} value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="e.g. Called buyer to confirm settlement date" />
      </div>
      <div>
        <label style={labelStyle}>Notes</label>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
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

export default function SaleDetailPanel({ saleId, onClose }: Props) {
  const { data: sale, isLoading: loadingSale } = useQuery<Sale>({
    queryKey: ['sale', saleId],
    queryFn: () => getSale(saleId),
  })

  const { data: activities = [], refetch: refetchActivities } = useQuery<Activity[]>({
    queryKey: ['activities', 'sale', saleId],
    queryFn: () => getActivities({ sale: saleId }),
  })

  const completeMutation = useMutation({
    mutationFn: completeActivity,
    onSuccess: () => refetchActivities(),
  })

  const sc = sale ? (STATUS_COLOURS[sale.status] ?? { bg: '#f3f4f6', color: '#6b7280', label: sale.status }) : null

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
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            {sale && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                  Lot {sale.lot_number} — {sale.project_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  {sc && (
                    <span style={{
                      background: sc.bg, color: sc.color,
                      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                    }}>
                      {sc.label}
                    </span>
                  )}
                  {sale.sale_price && (
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      ${Number(sale.sale_price).toLocaleString()}
                    </span>
                  )}
                </div>
              </>
            )}
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
          {loadingSale ? (
            <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</div>
          ) : sale ? (
            <>
              <Section title="Buyer">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Name" value={sale.primary_buyer_name} />
                  <Field label="Sale price" value={sale.sale_price ? `$${Number(sale.sale_price).toLocaleString()}` : null} />
                </div>
              </Section>

              <Section title="Sale details">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Status" value={sc?.label} />
                  <Field label="Created" value={new Date(sale.created_at).toLocaleDateString('en-AU')} />
                  <Field label="Cooling off" value={sale.cooling_off_waived ? 'Waived' : sale.cooling_off_expiry ? `Expires ${new Date(sale.cooling_off_expiry).toLocaleDateString('en-AU')}` : '—'} />
                  <Field label="Finance" value={sale.subject_to_finance ? `Due ${sale.finance_due_date ? new Date(sale.finance_due_date).toLocaleDateString('en-AU') : 'TBC'}` : 'Not applicable'} />
                  {sale.approved_at && <Field label="Approved" value={new Date(sale.approved_at).toLocaleDateString('en-AU')} />}
                  {sale.settled_at && <Field label="Settled" value={new Date(sale.settled_at).toLocaleDateString('en-AU')} />}
                  {sale.fallen_over_at && <Field label="Fallen over" value={new Date(sale.fallen_over_at).toLocaleDateString('en-AU')} />}
                  {sale.fallen_over_reason && <Field label="Reason" value={sale.fallen_over_reason} />}
                </div>
              </Section>

              {sale.on_hold_expiry && sale.status === 'on_hold' && (
                <Section title="On Hold Timer">
                  <div style={{ fontSize: 13, color: '#854d0e', background: '#fef9c3', padding: '10px 12px', borderRadius: 6 }}>
                    <i className="ti ti-clock" style={{ marginRight: 6 }} />
                    Expires {new Date(sale.on_hold_expiry).toLocaleString('en-AU')}
                  </div>
                </Section>
              )}

              <Section title="Activity Log">
                <LogActivityForm
                  saleId={saleId}
                  primaryBuyerId={sale.primary_buyer}
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
            </>
          ) : (
            <div style={{ color: '#9ca3af', fontSize: 14 }}>Sale not found.</div>
          )}
        </div>
      </div>
    </>
  )
}