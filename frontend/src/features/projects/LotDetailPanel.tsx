// src/features/projects/LotDetailPanel.tsx

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import client from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import NewSaleModal from '../sales/NewSaleModal'
import SaleDetailPanel from '../sales/SaleDetailPanel'
import type { Lot } from '../../api/projects'

interface Props {
  lotId: string
  onClose: () => void
}

async function fetchLot(id: string): Promise<Lot> {
  const { data } = await client.get<Lot>(`/lots/${id}/`)
  return data
}

async function fetchActiveSale(lotId: string): Promise<any | null> {
  const { data } = await client.get<any>('/sales/', { params: { lot: lotId } })
  const results = Array.isArray(data) ? data : (data.results ?? [])
  return results.find((s: any) => s.status !== 'fallen_over') ?? null
}

const STATUS_COLOURS: Record<string, { bg: string; color: string; label: string }> = {
  draft:           { bg: '#f3f4f6', color: '#6b7280', label: 'Draft' },
  available:       { bg: '#dcfce7', color: '#166534', label: 'Available' },
  on_hold:         { bg: '#fef9c3', color: '#854d0e', label: 'On Hold' },
  reserved:        { bg: '#dbeafe', color: '#1e40af', label: 'Reserved' },
  contract_issued: { bg: '#ede9fe', color: '#5b21b6', label: 'Contract Issued' },
  exchanged:       { bg: '#ffedd5', color: '#9a3412', label: 'Exchanged' },
  settled:         { bg: '#d1fae5', color: '#065f46', label: 'Settled' },
}

const LOT_TYPE_OPTIONS = [
  { value: 'land',           label: 'Land' },
  { value: 'house_and_land', label: 'House & Land' },
  { value: 'apartment',      label: 'Apartment' },
  { value: 'townhouse',      label: 'Townhouse' },
  { value: 'commercial',     label: 'Commercial' },
]

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLOURS[status] ?? { bg: '#f3f4f6', color: '#6b7280', label: status }
  return (
    <span style={{
      background: s.bg, color: s.color, fontSize: 11, fontWeight: 500,
      padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' as const,
    }}>
      {s.label}
    </span>
  )
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>
        {value != null && value !== '' ? value : '—'}
      </div>
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
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

function formatPrice(price: number | null): string {
  if (!price) return '—'
  return `$${Number(price).toLocaleString()}`
}

const inputStyle = {
  width: '100%', padding: '7px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
  boxSizing: 'border-box' as const,
}

// ─────────────────────────────────────────────────────────────────────────────
// Spec edit form
// ─────────────────────────────────────────────────────────────────────────────

function SpecEditForm({ lot, onSave, onCancel }: {
  lot: Lot
  onSave: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    lot_type:      lot.lot_type ?? '',
    bedrooms:      lot.bedrooms?.toString() ?? '',
    bathrooms:     lot.bathrooms?.toString() ?? '',
    car_spaces:    lot.car_spaces?.toString() ?? '',
    land_area:     lot.land_area?.toString() ?? '',
    floor_area:    lot.floor_area?.toString() ?? '',
    aspect:        lot.aspect ?? '',
    level:         lot.level?.toString() ?? '',
    building:      lot.building ?? '',
    inclusions:    (lot as any).inclusions ?? '',
    floor_plan_url: (lot as any).floor_plan_url ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => client.patch(`/lots/${lot.id}/`, {
      lot_type:   form.lot_type,
      bedrooms:   form.bedrooms   ? parseInt(form.bedrooms)   : null,
      bathrooms:  form.bathrooms  ? parseInt(form.bathrooms)  : null,
      car_spaces: form.car_spaces ? parseInt(form.car_spaces) : null,
      land_area:  form.land_area  ? parseFloat(form.land_area)  : null,
      floor_area: form.floor_area ? parseFloat(form.floor_area) : null,
      aspect:     form.aspect     || null,
      level:      form.level      ? parseInt(form.level)      : null,
      building:   form.building   || null,
      inclusions: form.inclusions || '',
      floor_plan_url: form.floor_plan_url || '',
    }),
    onSuccess: () => onSave(),
    onError:   (e: any) => setError(e?.response?.data?.detail ?? 'Save failed'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Lot type</label>
        <select style={inputStyle} value={form.lot_type}
          onChange={e => setForm({ ...form, lot_type: e.target.value })}>
          {LOT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { key: 'bedrooms',   label: 'Bedrooms' },
          { key: 'bathrooms',  label: 'Bathrooms' },
          { key: 'car_spaces', label: 'Car spaces' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{label}</label>
            <input style={inputStyle} type="number" min="0"
              value={(form as any)[key]}
              onChange={e => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { key: 'land_area',  label: 'Land area (m²)' },
          { key: 'floor_area', label: 'Floor area (m²)' },
          { key: 'aspect',     label: 'Aspect' },
          { key: 'level',      label: 'Level' },
          { key: 'building',   label: 'Building' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>{label}</label>
            <input style={inputStyle}
              type={['land_area', 'floor_area', 'level'].includes(key) ? 'number' : 'text'}
              value={(form as any)[key]}
              onChange={e => setForm({ ...form, [key]: e.target.value })} />
          </div>
        ))}
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Inclusions</label>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' as const }}
          value={form.inclusions}
          onChange={e => setForm({ ...form, inclusions: e.target.value })} />
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Floor plan URL</label>
        <input style={inputStyle} type="url" value={form.floor_plan_url}
          onChange={e => setForm({ ...form, floor_plan_url: e.target.value })} />
      </div>

      {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => mutate()} disabled={isPending} style={{
          padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}>
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button onClick={onCancel} style={{
          padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Price change form
// ─────────────────────────────────────────────────────────────────────────────

function PriceChangeForm({ lot, onSave, onCancel }: {
  lot: Lot
  onSave: () => void
  onCancel: () => void
}) {
  const [price, setPrice]     = useState('')
  const [effDate, setEffDate] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason]   = useState('')
  const [error, setError]     = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => client.post(`/lots/${lot.id}/price/`, {
      price:          parseFloat(price),
      effective_date: effDate,
      reason:         reason,
    }),
    onSuccess: () => onSave(),
    onError:   (e: any) => setError(e?.response?.data?.detail ?? 'Save failed'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        background: '#f9fafb', borderRadius: 6, padding: '8px 12px',
        fontSize: 12, color: '#6b7280',
      }}>
        Current price: <strong style={{ color: '#111827' }}>{formatPrice(lot.current_price)}</strong>
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>New price *</label>
        <input style={inputStyle} type="number" min="0" step="1000"
          value={price} placeholder="e.g. 650000"
          onChange={e => setPrice(e.target.value)} />
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Effective date *</label>
        <input style={inputStyle} type="date" value={effDate}
          onChange={e => setEffDate(e.target.value)} />
      </div>

      <div>
        <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 3 }}>Reason (optional)</label>
        <input style={inputStyle} type="text" value={reason}
          placeholder="e.g. Market adjustment"
          onChange={e => setReason(e.target.value)} />
      </div>

      {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => {
          if (!price || isNaN(parseFloat(price))) { setError('Please enter a valid price'); return }
          setError(null)
          mutate()
        }} disabled={isPending} style={{
          padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
          opacity: isPending ? 0.6 : 1,
        }}>
          {isPending ? 'Saving…' : 'Update price'}
        </button>
        <button onClick={onCancel} style={{
          padding: '7px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export default function LotDetailPanel({ lotId, onClose }: Props) {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)

  const [visible, setVisible]         = useState(false)
  const [showSaleModal, setShowSaleModal]   = useState(false)
  const [showSalePanel, setShowSalePanel]   = useState(false)
  const [editingSpec, setEditingSpec]       = useState(false)
  const [editingPrice, setEditingPrice]     = useState(false)

  // Trigger entrance animation on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 240)
  }

  const canEditSpec  = user?.role?.permissions?.some(p => p.code === 'lot.edit')  ?? false
  const canEditPrice = user?.role?.permissions?.some(p => p.code === 'lot.price') ?? false

  const { data: lot, isLoading: lotLoading } = useQuery({
    queryKey: ['lot', lotId],
    queryFn:  () => fetchLot(lotId),
  })

  const { data: activeSale, isLoading: saleLoading } = useQuery({
    queryKey: ['lot-sale', lotId],
    queryFn:  () => fetchActiveSale(lotId),
    enabled:  !!lot,
  })

  const hasActiveSale = !!activeSale

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['lot', lotId] })
    queryClient.invalidateQueries({ queryKey: ['lot-sale', lotId] })
    queryClient.invalidateQueries({ queryKey: ['projects', 'detail'] })
    queryClient.invalidateQueries({ queryKey: ['lots'] })
  }

  const handleSaveSpec  = () => { setEditingSpec(false);  invalidate() }
  const handleSavePrice = () => { setEditingPrice(false); invalidate() }
  const handleSaleCreated = () => { setShowSaleModal(false); invalidate() }

  const isLoading = lotLoading || saleLoading

  return (
    <>
      {/* Backdrop */}
      {!showSalePanel && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 900,
            opacity: visible ? 1 : 0,
            transition: 'opacity 240ms ease',
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: '#fff', zIndex: 901,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
              {lot ? `Lot ${lot.lot_number}` : 'Lot'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {lot ? `${lot.stage_name} — ${lot.project_name}` : 'Loading…'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {lot && <StatusBadge status={lot.status} />}
            <button onClick={handleClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: 20, padding: 0,
            }}>
              <i className="ti ti-x" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {isLoading ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</div>
          ) : !lot ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Lot not found.</div>
          ) : (
            <>
              {/* Pricing */}
              <Section
                title="Pricing"
                action={canEditPrice && !hasActiveSale && !editingPrice && !editingSpec ? (
                  <button onClick={() => setEditingPrice(true)} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4,
                    background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
                  }}>
                    Update price
                  </button>
                ) : undefined}
              >
                {editingPrice ? (
                  <PriceChangeForm
                    lot={lot}
                    onSave={handleSavePrice}
                    onCancel={() => setEditingPrice(false)}
                  />
                ) : (
                  <div style={{
                    background: '#f9fafb', borderRadius: 8, padding: '14px 16px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>
                      {formatPrice(lot.current_price)}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'right' as const }}>
                      <div style={{ textTransform: 'capitalize' as const }}>
                        {lot.lot_type.replace(/_/g, ' ')}
                      </div>
                      {lot.land_area && <div>{lot.land_area}m² land</div>}
                    </div>
                  </div>
                )}
              </Section>

              {/* Specifications */}
              <Section
                title="Specifications"
                action={canEditSpec && !hasActiveSale && !editingSpec && !editingPrice ? (
                  <button onClick={() => setEditingSpec(true)} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 4,
                    background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
                  }}>
                    Edit
                  </button>
                ) : undefined}
              >
                {editingSpec ? (
                  <SpecEditForm
                    lot={lot}
                    onSave={handleSaveSpec}
                    onCancel={() => setEditingSpec(false)}
                  />
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Lot number"  value={lot.lot_number} />
                    <Field label="Type"        value={lot.lot_type.replace(/_/g, ' ')} />
                    {lot.bedrooms   != null && <Field label="Bedrooms"   value={lot.bedrooms} />}
                    {lot.bathrooms  != null && <Field label="Bathrooms"  value={lot.bathrooms} />}
                    {lot.car_spaces != null && <Field label="Car spaces" value={lot.car_spaces} />}
                    {lot.land_area  != null && <Field label="Land area"  value={`${lot.land_area}m²`} />}
                    {lot.floor_area != null && <Field label="Floor area" value={`${lot.floor_area}m²`} />}
                    {lot.aspect     && <Field label="Aspect"     value={lot.aspect} />}
                    {lot.level      != null && <Field label="Level"      value={lot.level} />}
                    {lot.building   && <Field label="Building"   value={lot.building} />}
                  </div>
                )}
              </Section>

              {/* Sale */}
              <Section title="Sale">
                {!activeSale ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {lot.status === 'available' ? (
                      <>
                        <div style={{ fontSize: 13, color: '#6b7280' }}>No active sale. This lot is available.</div>
                        <button onClick={() => setShowSaleModal(true)} style={{
                          padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                          background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
                          alignSelf: 'flex-start' as const,
                        }}>
                          <i className="ti ti-plus" style={{ marginRight: 6 }} />
                          Register Sale
                        </button>
                      </>
                    ) : lot.status === 'draft' ? (
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>
                        This lot has not been released to market yet.
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#9ca3af' }}>No active sale found.</div>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{
                      background: '#f9fafb', borderRadius: 8, padding: '12px 14px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                          {activeSale.primary_buyer_name ?? activeSale.buyer_name}
                        </div>
                        {activeSale.sale_price && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                            {formatPrice(activeSale.sale_price)}
                          </div>
                        )}
                      </div>
                      <StatusBadge status={activeSale.status} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {activeSale.agent_name && <Field label="Agent" value={activeSale.agent_name} />}
                      {activeSale.created_at && (
                        <Field label="Created" value={new Date(activeSale.created_at).toLocaleDateString('en-AU')} />
                      )}
                      {activeSale.cooling_off_waived != null && (
                        <Field label="Cooling off" value={activeSale.cooling_off_waived ? 'Waived' : 'Applies'} />
                      )}
                      {activeSale.subject_to_finance != null && (
                        <Field label="Finance" value={activeSale.subject_to_finance ? 'Yes' : 'No'} />
                      )}
                    </div>

                    {activeSale.status === 'on_hold' && activeSale.on_hold_expiry && (
                      <div style={{
                        fontSize: 12, color: '#854d0e', background: '#fef9c3',
                        padding: '8px 12px', borderRadius: 6,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        <i className="ti ti-clock" />
                        On hold expires {new Date(activeSale.on_hold_expiry).toLocaleString('en-AU')}
                      </div>
                    )}

                    <button onClick={() => setShowSalePanel(true)} style={{
                      padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                      background: '#f3f4f6', color: '#111827', border: 'none', cursor: 'pointer',
                      alignSelf: 'flex-start' as const,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <i className="ti ti-arrow-right" />
                      View full sale
                    </button>
                  </div>
                )}
              </Section>
            </>
          )}
        </div>
      </div>

      {showSaleModal && lot && (
        <NewSaleModal lot={lot} onClose={handleSaleCreated} />
      )}

      {showSalePanel && activeSale && (
        <SaleDetailPanel saleId={activeSale.id} onClose={() => setShowSalePanel(false)} />
      )}
    </>
  )
}