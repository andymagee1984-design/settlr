// src/features/sales/SaleDetailPanel.tsx

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getSale } from '../../api/sales'
import { getActivities, completeActivity } from '../../api/activities'
import { useAuthStore } from '../../store/authStore'
import client from '../../api/client'
import LogActivityForm from '../../components/LogActivityForm'
import ActivityDetailPanel from '../../components/ActivityDetailPanel'
import type { Sale } from '../../api/sales'
import type { Activity } from '../../api/activities'

interface Props {
  saleId:  string
  onClose: () => void
}

const STATUS_COLOURS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  on_hold:         { bg: '#fef6ec', color: '#7a4a00', border: '#fcd9a0', label: 'On Hold'          },
  pending:         { bg: '#eef2fb', color: '#1e3a7a', border: '#c5d3f0', label: 'Pending Approval' },
  declined:        { bg: '#fdf0ee', color: '#882010', border: '#f5c4bb', label: 'Declined'         },
  reserved:        { bg: '#f5f0fb', color: '#5b2d8a', border: '#d9c5f5', label: 'Reserved'         },
  contract_issued: { bg: '#fef6ec', color: '#9a5f00', border: '#fcd9a0', label: 'Contract Issued'  },
  exchanged:       { bg: '#eef7f0', color: '#1a5c2e', border: '#b8dfc3', label: 'Exchanged'        },
  settled:         { bg: '#eef7f0', color: '#1a5c2e', border: '#b8dfc3', label: 'Settled'          },
  fallen_over:     { bg: '#f2f0ee', color: '#7a6e68', border: '#ddd7d2', label: 'Fallen Over'      },
}

const COMMISSION_STATUS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending:  { bg: '#fef6ec', color: '#7a4a00', border: '#fcd9a0', label: 'Pending'  },
  approved: { bg: '#eef2fb', color: '#1e3a7a', border: '#c5d3f0', label: 'Approved' },
  paid:     { bg: '#eef7f0', color: '#1a5c2e', border: '#b8dfc3', label: 'Paid'     },
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  call:       { label: 'Call',       icon: 'ti-phone',       color: '#2649a0', bg: '#eef2fb' },
  email:      { label: 'Email',      icon: 'ti-mail',        color: '#5b2d8a', bg: '#f5f0fb' },
  meeting:    { label: 'Meeting',    icon: 'ti-calendar',    color: '#9a5f00', bg: '#fef6ec' },
  inspection: { label: 'Inspection', icon: 'ti-home-search', color: '#1a5c2e', bg: '#eef7f0' },
  task:       { label: 'Task',       icon: 'ti-checkbox',    color: '#3d4a5c', bg: '#f2f0ee' },
  note:       { label: 'Note',       icon: 'ti-note',        color: '#7a6e68', bg: '#f2f0ee' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d4ccc5', fontSize: 13, color: '#2c2420',
  boxSizing: 'border-box', background: '#fff', outline: 'none',
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#a89e98', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#2c2420', fontWeight: 500 }}>{value || '—'}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#a89e98',
        textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 12,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Documents section
// ─────────────────────────────────────────────────────────────────────────────

function DocumentsSection({ sale }: { sale: Sale }) {
  const s = sale as any

  const rows = [
    {
      label:     'Sales Advice',
      dateLabel: 'Approved',
      date:      s.approved_at,
      url:       s.sales_advice_document_url,
      gate:      ['reserved', 'contract_issued', 'exchanged', 'settled', 'fallen_over'],
    },
    {
      label:     'Contract',
      dateLabel: 'Contract Issued',
      date:      s.contract_issued_date,
      url:       s.contract_document_url,
      gate:      ['contract_issued', 'exchanged', 'settled'],
    },
    {
      label:     'Signed Contract',
      dateLabel: 'Exchange Date',
      date:      s.exchange_date,
      url:       s.signed_contract_url,
      gate:      ['exchanged', 'settled'],
    },
    {
      label:     'Settlement Statement',
      dateLabel: 'Settlement Date',
      date:      s.settlement_date,
      url:       s.settlement_statement_url,
      gate:      ['settled'],
    },
  ]

  const visibleRows = rows.filter(r => r.gate.includes(sale.status))

  if (visibleRows.length === 0) {
    return (
      <div style={{ padding: '12px 14px', background: '#f9f6f4', borderRadius: 8, border: '1px solid #e8e2dd', fontSize: 13, color: '#a89e98' }}>
        Documents will appear here as the sale progresses.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visibleRows.map(row => (
        <div key={row.label} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: '#ffffff',
          border: '1px solid #e8e2dd', borderRadius: 8,
          boxShadow: '0 1px 2px rgba(44,36,32,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
              background: row.url ? '#f7ece9' : '#f9f6f4',
              border: `1px solid ${row.url ? '#e8c4bb' : '#e8e2dd'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={row.url ? '#c0533a' : '#a89e98'} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#2c2420', margin: 0 }}>{row.label}</p>
              {row.date && (
                <p style={{ fontSize: 11, color: '#7a6e68', margin: '2px 0 0' }}>
                  {row.dateLabel}: {new Date(row.date).toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {row.url ? (
              <>
                <span style={{
                  fontSize: 11, fontWeight: 500, color: '#1a5c2e',
                  background: '#eef7f0', border: '1px solid #b8dfc3',
                  borderRadius: 99, padding: '2px 8px',
                }}>Uploaded</span>
                <a href={row.url} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 500, color: '#c0533a',
                  textDecoration: 'none', padding: '4px 10px',
                  border: '1px solid #e8c4bb', borderRadius: 6, background: '#f7ece9',
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  View
                </a>
              </>
            ) : (
              <span style={{
                fontSize: 11, fontWeight: 500, color: '#a89e98',
                background: '#f9f6f4', border: '1px solid #e8e2dd',
                borderRadius: 99, padding: '2px 8px',
              }}>Not uploaded</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Commission section
// ─────────────────────────────────────────────────────────────────────────────

function CommissionSection({ sale, refetch }: { sale: Sale; refetch: () => void }) {
  const user = useAuthStore(s => s.user)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ commission_type: '', rate: '', flat_amount: '', incentive_amount: '', incentive_notes: '' })
  const [error, setError] = useState<string | null>(null)

  const canManage  = user?.role?.permissions?.some(p => p.code === 'sale.approve') ?? false
  const commission = (sale as any).commission

  const { mutate: approve,  isPending: approving  } = useMutation({ mutationFn: () => client.post(`/commissions/${commission.id}/approve/`).then(r => r.data),   onSuccess: () => refetch(), onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed') })
  const { mutate: markPaid, isPending: markingPaid } = useMutation({ mutationFn: () => client.post(`/commissions/${commission.id}/mark_paid/`).then(r => r.data), onSuccess: () => refetch(), onError: (e: any) => setError(e?.response?.data?.detail ?? 'Failed') })
  const { mutate: save,     isPending: saving      } = useMutation({
    mutationFn: () => client.patch(`/commissions/${commission.id}/`, {
      commission_type:  form.commission_type  || undefined,
      rate:             form.rate             ? parseFloat(form.rate)             : null,
      flat_amount:      form.flat_amount      ? parseFloat(form.flat_amount)      : null,
      incentive_amount: form.incentive_amount ? parseFloat(form.incentive_amount) : null,
      incentive_notes:  form.incentive_notes  || '',
    }).then(r => r.data),
    onSuccess: () => { setEditing(false); refetch() },
    onError:   (e: any) => setError(e?.response?.data?.detail ?? 'Save failed'),
  })

  if (!commission) return (
    <div style={{ fontSize: 13, color: '#a89e98' }}>Commission will be created when the sale reaches Exchanged.</div>
  )

  const cs = COMMISSION_STATUS[commission.status] ?? COMMISSION_STATUS.pending
  const commissionAmount = () => {
    if (commission.calculated_amount) return `$${Number(commission.calculated_amount).toLocaleString()}`
    if (commission.commission_type === 'percentage' && commission.rate && (sale as any).sale_price)
      return `$${(Number((sale as any).sale_price) * Number(commission.rate) / 100).toLocaleString()} (${commission.rate}%)`
    if (commission.commission_type === 'flat' && commission.flat_amount)
      return `$${Number(commission.flat_amount).toLocaleString()}`
    return 'Not yet calculated'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#f9f6f4', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e8e2dd' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2c2420' }}>{commissionAmount()}</div>
          {commission.incentive_amount && (
            <div style={{ fontSize: 12, color: '#7a6e68', marginTop: 2 }}>
              + ${Number(commission.incentive_amount).toLocaleString()} incentive
            </div>
          )}
        </div>
        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
          {cs.label}
        </span>
      </div>

      {!editing && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Agent"         value={(sale as any).agent_name} />
          <Field label="Type"          value={commission.commission_type === 'percentage' ? 'Percentage' : commission.commission_type === 'flat' ? 'Flat amount' : '—'} />
          <Field label="Rate / amount" value={commission.commission_type === 'percentage' ? `${commission.rate}%` : commission.flat_amount ? `$${Number(commission.flat_amount).toLocaleString()}` : '—'} />
          <Field label="Approved"      value={commission.approved_at ? new Date(commission.approved_at).toLocaleDateString('en-AU') : '—'} />
          <Field label="Paid"          value={commission.paid_at ? new Date(commission.paid_at).toLocaleDateString('en-AU') : '—'} />
          {commission.incentive_notes && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: '#a89e98', marginBottom: 2 }}>Incentive notes</div>
              <div style={{ fontSize: 13, color: '#2c2420' }}>{commission.incentive_notes}</div>
            </div>
          )}
        </div>
      )}

      {editing && canManage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: '#7a6e68', display: 'block', marginBottom: 3 }}>Type</label>
              <select style={inputStyle} value={form.commission_type} onChange={e => setForm({ ...form, commission_type: e.target.value })}>
                <option value="">Select…</option>
                <option value="percentage">Percentage</option>
                <option value="flat">Flat amount</option>
              </select>
            </div>
            {form.commission_type === 'percentage' && (
              <div>
                <label style={{ fontSize: 11, color: '#7a6e68', display: 'block', marginBottom: 3 }}>Rate (%)</label>
                <input style={inputStyle} type="number" step="0.01" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
              </div>
            )}
            {form.commission_type === 'flat' && (
              <div>
                <label style={{ fontSize: 11, color: '#7a6e68', display: 'block', marginBottom: 3 }}>Amount ($)</label>
                <input style={inputStyle} type="number" value={form.flat_amount} onChange={e => setForm({ ...form, flat_amount: e.target.value })} />
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, color: '#7a6e68', display: 'block', marginBottom: 3 }}>Incentive ($)</label>
              <input style={inputStyle} type="number" value={form.incentive_amount} onChange={e => setForm({ ...form, incentive_amount: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, color: '#7a6e68', display: 'block', marginBottom: 3 }}>Incentive notes</label>
              <input style={inputStyle} type="text" value={form.incentive_notes} onChange={e => setForm({ ...form, incentive_notes: e.target.value })} />
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: '#882010' }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => save()} disabled={saving} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#3d4a5c', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'var(--font-body)' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {canManage && !editing && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {commission.status === 'pending' && (
            <>
              <button onClick={() => {
                setForm({ commission_type: commission.commission_type ?? '', rate: commission.rate?.toString() ?? '', flat_amount: commission.flat_amount?.toString() ?? '', incentive_amount: commission.incentive_amount?.toString() ?? '', incentive_notes: commission.incentive_notes ?? '' })
                setEditing(true)
              }} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Edit details
              </button>
              <button onClick={() => approve()} disabled={approving} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#eef2fb', color: '#1e3a7a', border: '1px solid #c5d3f0', cursor: 'pointer', opacity: approving ? 0.6 : 1, fontFamily: 'var(--font-body)' }}>
                {approving ? 'Approving…' : 'Approve'}
              </button>
            </>
          )}
          {commission.status === 'approved' && (
            <button onClick={() => markPaid()} disabled={markingPaid} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: '#eef7f0', color: '#1a5c2e', border: '1px solid #b8dfc3', cursor: 'pointer', opacity: markingPaid ? 0.6 : 1, fontFamily: 'var(--font-body)' }}>
              {markingPaid ? 'Saving…' : 'Mark as paid'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export default function SaleDetailPanel({ saleId, onClose }: Props) {
  const [visible,          setVisible]          = useState(false)
  const [showActivityForm, setShowActivityForm] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = () => { setVisible(false); setTimeout(onClose, 240) }

  const { data: sale, isLoading: loadingSale, refetch } = useQuery<Sale>({
    queryKey: ['sale', saleId],
    queryFn:  () => getSale(saleId),
    staleTime: 30_000,
  })

  const { data: activities = [], refetch: refetchActivities } = useQuery<Activity[]>({
    queryKey: ['activities', 'sale', saleId],
    queryFn:  () => getActivities({ sale: saleId }),
    staleTime: 30_000,
  })

  const completeMutation = useMutation({
    mutationFn: completeActivity,
    onSuccess:  () => refetchActivities(),
  })

  const sc = sale ? (STATUS_COLOURS[sale.status] ?? { bg: '#f2f0ee', color: '#7a6e68', border: '#ddd7d2', label: sale.status }) : null

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, background: 'rgba(44,36,32,0.3)', zIndex: 900, opacity: visible ? 1 : 0, transition: 'opacity 240ms ease' }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
        background: '#fff', zIndex: 901, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(44,36,32,0.10)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0ebe6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            {sale && (
              <>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#2c2420' }}>
                  Lot {sale.lot_number} — {sale.project_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                  {sc && (
                    <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>
                      {sc.label}
                    </span>
                  )}
                  {(sale as any).sale_price && (
                    <span style={{ fontSize: 13, color: '#7a6e68', fontWeight: 500 }}>
                      ${Number((sale as any).sale_price).toLocaleString()}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a89e98', fontSize: 20, padding: 0 }}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loadingSale ? (
            <div style={{ color: '#a89e98', fontSize: 14 }}>Loading…</div>
          ) : sale ? (
            <>
              <Section title="Buyer">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Name"       value={sale.primary_buyer_name} />
                  <Field label="Sale price" value={(sale as any).sale_price ? `$${Number((sale as any).sale_price).toLocaleString()}` : null} />
                </div>
              </Section>

              <Section title="Sale details">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Status"      value={sc?.label} />
                  <Field label="Created"     value={new Date(sale.created_at).toLocaleDateString('en-AU')} />
                  <Field label="Cooling off" value={(sale as any).cooling_off_waived ? 'Waived' : (sale as any).cooling_off_expiry ? `Expires ${new Date((sale as any).cooling_off_expiry).toLocaleDateString('en-AU')}` : '—'} />
                  <Field label="Finance"     value={(sale as any).subject_to_finance ? `Due ${(sale as any).finance_due_date ? new Date((sale as any).finance_due_date).toLocaleDateString('en-AU') : 'TBC'}` : 'Not applicable'} />
                  {(sale as any).approved_at    && <Field label="Approved"    value={new Date((sale as any).approved_at).toLocaleDateString('en-AU')} />}
                  {(sale as any).settled_at     && <Field label="Settled"     value={new Date((sale as any).settled_at).toLocaleDateString('en-AU')} />}
                  {(sale as any).fallen_over_at && <Field label="Fallen over" value={new Date((sale as any).fallen_over_at).toLocaleDateString('en-AU')} />}
                  {(sale as any).fallen_over_reason && <Field label="Reason"  value={(sale as any).fallen_over_reason} />}
                </div>
              </Section>

              <Section title="Documents">
                <DocumentsSection sale={sale} />
              </Section>

              {(sale as any).agent && (
                <Section title="Commission">
                  <CommissionSection sale={sale} refetch={() => refetch()} />
                </Section>
              )}

              {(sale as any).on_hold_expiry && sale.status === 'on_hold' && (
                <Section title="On Hold Timer">
                  <div style={{ fontSize: 13, color: '#7a4a00', background: '#fef6ec', padding: '10px 12px', borderRadius: 6, border: '1px solid #fcd9a0' }}>
                    <i className="ti ti-clock" style={{ marginRight: 6 }} />
                    Expires {new Date((sale as any).on_hold_expiry).toLocaleString('en-AU')}
                  </div>
                </Section>
              )}

              <Section title="Activity Log">
                {!showActivityForm ? (
                  <button
                    onClick={() => setShowActivityForm(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                      background: '#3d4a5c', color: '#fff', border: 'none', cursor: 'pointer',
                      marginBottom: 12, fontFamily: 'var(--font-body)',
                    }}
                  >
                    <i className="ti ti-plus" style={{ marginRight: 3 }} />Log Activity
                  </button>
                ) : (
                  <div style={{ marginBottom: 16 }}>
                    <LogActivityForm
                      saleId={saleId}
                      contactType="Buyer"
                      contactId={sale.primary_buyer}
                      onSaved={() => { setShowActivityForm(false); refetchActivities() }}
                      onCancel={() => setShowActivityForm(false)}
                    />
                  </div>
                )}

                {activities.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#a89e98' }}>No activities logged.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activities.map((a) => {
                      const tc = TYPE_CONFIG[a.activity_type] ?? { label: a.activity_type, icon: 'ti-circle', color: '#7a6e68', bg: '#f2f0ee' }
                      const isTask = a.activity_type === 'task'
                      return (
                        <div
                          key={a.id}
                          onClick={() => setSelectedActivity(a.id)}
                          style={{
                            background: '#f9f6f4', borderRadius: 8, padding: '10px 12px',
                            opacity: a.is_complete ? 0.55 : 1,
                            display: 'flex', gap: 10, alignItems: 'flex-start',
                            cursor: 'pointer', border: '1px solid #f0ebe6',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f2f0ee')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#f9f6f4')}
                        >
                          <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className={`ti ${tc.icon}`} style={{ color: tc.color, fontSize: 13 }} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#2c2420', textDecoration: a.is_complete ? 'line-through' : 'none' }}>
                              {a.subject}
                            </div>
                            {a.description && (
                              <div style={{ fontSize: 11, color: '#7a6e68', marginTop: 2 }}>{a.description}</div>
                            )}
                            <div style={{ fontSize: 10, color: '#a89e98', marginTop: 3 }}>
                              {new Date(a.activity_date).toLocaleDateString('en-AU')}
                              {a.due_date         && ` · Due ${new Date(a.due_date).toLocaleDateString('en-AU')}`}
                              {a.assigned_to_name && ` · ${a.assigned_to_name}`}
                            </div>
                            {isTask && !a.is_complete && (
                              <button
                                onClick={(e) => { e.stopPropagation(); completeMutation.mutate(a.id) }}
                                style={{ marginTop: 6, padding: '3px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500, background: '#eef7f0', color: '#1a5c2e', border: '1px solid #b8dfc3', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                              >
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
            <div style={{ color: '#a89e98', fontSize: 14 }}>Sale not found.</div>
          )}
        </div>
      </div>

      {selectedActivity && (
        <ActivityDetailPanel
          activityId={selectedActivity}
          onClose={() => { setSelectedActivity(null); refetchActivities() }}
        />
      )}
    </>
  )
}