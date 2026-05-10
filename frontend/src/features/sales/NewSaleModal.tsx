import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { searchBuyers, createBuyer, createSale } from '../../api/sales'
import { getAgents } from '../../api/contacts'
import type { Buyer } from '../../api/sales'
import type { Lot } from '../../api/projects'

interface Props {
  lot: Lot
  onClose: () => void
}

type Step = 'buyer' | 'details' | 'confirm'

const STEPS: { key: Step; label: string }[] = [
  { key: 'buyer',   label: 'Buyer' },
  { key: 'details', label: 'Details' },
  { key: 'confirm', label: 'Confirm' },
]

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
  boxSizing: 'border-box' as const, outline: 'none',
}

const labelStyle = {
  fontSize: 12, fontWeight: 500 as const, color: '#374151', marginBottom: 4, display: 'block',
}

export default function NewSaleModal({ lot, onClose }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('buyer')

  // Buyer step state
  const [buyerMode, setBuyerMode] = useState<'search' | 'new'>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBuyer, setSelectedBuyer] = useState<Buyer | null>(null)
  const [newBuyer, setNewBuyer] = useState({
    buyer_type: 'individual',
    first_name: '', last_name: '', email: '', phone: '',
    address: '', date_of_birth: '', entity_name: '', abn: '', trustee_name: '',
    id_verified: false,
  })

  // Details step state
  const [details, setDetails] = useState({
    agent_id: '',
    cooling_off_waived: false,
    subject_to_finance: false,
    finance_due_date: '',
  })

  const [error, setError] = useState<string | null>(null)

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['buyer-search', searchQuery],
    queryFn: () => searchBuyers(searchQuery),
    enabled: searchQuery.length >= 2,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
  })

  const createBuyerMutation = useMutation({ mutationFn: createBuyer })
  const createSaleMutation = useMutation({ mutationFn: createSale })

  const handleNext = async () => {
    setError(null)
    if (step === 'buyer') {
      if (!selectedBuyer && buyerMode === 'search') {
        setError('Please select a buyer.')
        return
      }
      if (buyerMode === 'new') {
        if (!newBuyer.first_name || !newBuyer.last_name || !newBuyer.email) {
          setError('First name, last name, and email are required.')
          return
        }
      }
      setStep('details')
    } else if (step === 'details') {
      setStep('confirm')
    }
  }

  const handleSubmit = async () => {
    setError(null)
    try {
      let buyerId = selectedBuyer?.id
      if (buyerMode === 'new') {
        const created = await createBuyerMutation.mutateAsync(
          newBuyer.buyer_type === 'individual'
            ? { buyer_type: 'individual', first_name: newBuyer.first_name, last_name: newBuyer.last_name, email: newBuyer.email, phone: newBuyer.phone, address: newBuyer.address, date_of_birth: newBuyer.date_of_birth || null, id_verified: newBuyer.id_verified }
            : newBuyer.buyer_type === 'company'
            ? { buyer_type: 'company', entity_name: newBuyer.entity_name, abn: newBuyer.abn, email: newBuyer.email, phone: newBuyer.phone, address: newBuyer.address }
            : { buyer_type: 'trust', entity_name: newBuyer.entity_name, abn: newBuyer.abn, trustee_name: newBuyer.trustee_name, email: newBuyer.email, phone: newBuyer.phone, address: newBuyer.address }
        )
        buyerId = created.id
      }

      await createSaleMutation.mutateAsync({
        lot_id: lot.id,
        primary_buyer_id: buyerId,
        ...(details.agent_id && { agent_id: details.agent_id }),
        cooling_off_waived: details.cooling_off_waived,
        subject_to_finance: details.subject_to_finance,
        ...(details.subject_to_finance && details.finance_due_date && { finance_due_date: details.finance_due_date }),
      })

      queryClient.invalidateQueries({ queryKey: ['lots'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Something went wrong. Please try again.')
    }
  }

  const currentStepIndex = STEPS.findIndex((s) => s.key === step)
  const isLoading = createBuyerMutation.isPending || createSaleMutation.isPending

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 520, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>
                Register Sale
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Lot {lot.lot_number} — {lot.project_name}
                {lot.current_price && ` — $${Number(lot.current_price).toLocaleString()}`}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, padding: 0 }}>
              <i className="ti ti-x" />
            </button>
          </div>

          {/* Step indicators */}
          <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
            {STEPS.map((s, i) => (
              <div key={s.key} style={{
                padding: '8px 16px', fontSize: 12, fontWeight: 500, cursor: 'default',
                borderBottom: step === s.key ? '2px solid #111827' : '2px solid transparent',
                color: i <= currentStepIndex ? '#111827' : '#9ca3af',
              }}>
                {i + 1}. {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* Step 1 — Buyer */}
          {step === 'buyer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['search', 'new'] as const).map((m) => (
                  <button key={m} onClick={() => { setBuyerMode(m); setSelectedBuyer(null); setSearchQuery('') }}
                    style={{
                      padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500,
                      background: buyerMode === m ? '#111827' : '#f3f4f6',
                      color: buyerMode === m ? '#fff' : '#374151', border: 'none',
                    }}>
                    {m === 'search' ? 'Existing buyer' : 'New buyer'}
                  </button>
                ))}
              </div>

              {buyerMode === 'search' && (
                <div>
                  <label style={labelStyle}>Search by name, email or phone</label>
                  <input
                    style={inputStyle} placeholder="Start typing…" value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searching && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Searching…</div>}
                  {searchResults.length > 0 && (
                    <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                      {searchResults.map((b: Buyer) => (
                        <div key={b.id} onClick={() => setSelectedBuyer(b)}
                          style={{
                            padding: '10px 12px', fontSize: 13, cursor: 'pointer',
                            background: selectedBuyer?.id === b.id ? '#f0f9ff' : '#fff',
                            borderBottom: '1px solid #f3f4f6',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}>
                          <div>
                            <div style={{ fontWeight: 500, color: '#111827' }}>{b.display_name}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{b.email}</div>
                          </div>
                          {selectedBuyer?.id === b.id && <i className="ti ti-check" style={{ color: '#16a34a' }} />}
                        </div>
                      ))}
                    </div>
                  )}
                  {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                      No buyers found. <button onClick={() => setBuyerMode('new')} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12, padding: 0 }}>Create new buyer</button>
                    </div>
                  )}
                </div>
              )}

              {buyerMode === 'new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Buyer type</label>
                    <select style={inputStyle} value={newBuyer.buyer_type}
                      onChange={(e) => setNewBuyer({ ...newBuyer, buyer_type: e.target.value })}>
                      <option value="individual">Individual</option>
                      <option value="company">Company</option>
                      <option value="trust">Trust</option>
                    </select>
                  </div>

                  {newBuyer.buyer_type === 'individual' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={labelStyle}>First name *</label>
                          <input style={inputStyle} value={newBuyer.first_name}
                            onChange={(e) => setNewBuyer({ ...newBuyer, first_name: e.target.value })} />
                        </div>
                        <div>
                          <label style={labelStyle}>Last name *</label>
                          <input style={inputStyle} value={newBuyer.last_name}
                            onChange={(e) => setNewBuyer({ ...newBuyer, last_name: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label style={labelStyle}>Date of birth</label>
                        <input style={inputStyle} type="date" value={newBuyer.date_of_birth}
                          onChange={(e) => setNewBuyer({ ...newBuyer, date_of_birth: e.target.value })} />
                      </div>
                    </>
                  )}

                  {(newBuyer.buyer_type === 'company' || newBuyer.buyer_type === 'trust') && (
                    <>
                      <div>
                        <label style={labelStyle}>Entity name *</label>
                        <input style={inputStyle} value={newBuyer.entity_name}
                          onChange={(e) => setNewBuyer({ ...newBuyer, entity_name: e.target.value })} />
                      </div>
                      <div>
                        <label style={labelStyle}>ABN</label>
                        <input style={inputStyle} value={newBuyer.abn}
                          onChange={(e) => setNewBuyer({ ...newBuyer, abn: e.target.value })} />
                      </div>
                      {newBuyer.buyer_type === 'trust' && (
                        <div>
                          <label style={labelStyle}>Trustee name</label>
                          <input style={inputStyle} value={newBuyer.trustee_name}
                            onChange={(e) => setNewBuyer({ ...newBuyer, trustee_name: e.target.value })} />
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label style={labelStyle}>Email *</label>
                    <input style={inputStyle} type="email" value={newBuyer.email}
                      onChange={(e) => setNewBuyer({ ...newBuyer, email: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Phone</label>
                      <input style={inputStyle} value={newBuyer.phone}
                        onChange={(e) => setNewBuyer({ ...newBuyer, phone: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Address</label>
                      <input style={inputStyle} value={newBuyer.address}
                        onChange={(e) => setNewBuyer({ ...newBuyer, address: e.target.value })} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    <input type="checkbox" checked={newBuyer.id_verified}
                      onChange={(e) => setNewBuyer({ ...newBuyer, id_verified: e.target.checked })} />
                    ID verified
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Details */}
          {step === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Agent (optional)</label>
                <select style={inputStyle} value={details.agent_id}
                  onChange={(e) => setDetails({ ...details, agent_id: e.target.value })}>
                  <option value="">No agent</option>
                  {agents.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.first_name} {a.last_name} — {a.agency_name}</option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={details.cooling_off_waived}
                  onChange={(e) => setDetails({ ...details, cooling_off_waived: e.target.checked })} />
                Cooling off waived
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={details.subject_to_finance}
                  onChange={(e) => setDetails({ ...details, subject_to_finance: e.target.checked })} />
                Subject to finance
              </label>
              {details.subject_to_finance && (
                <div>
                  <label style={labelStyle}>Finance due date</label>
                  <input style={inputStyle} type="date" value={details.finance_due_date}
                    onChange={(e) => setDetails({ ...details, finance_due_date: e.target.value })} />
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Confirm */}
          {step === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Sale Summary</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Lot', `Lot ${lot.lot_number} — ${lot.project_name}`],
                    ['Price', lot.current_price ? `$${Number(lot.current_price).toLocaleString()}` : '—'],
                    ['Buyer', selectedBuyer ? selectedBuyer.display_name : `${newBuyer.first_name} ${newBuyer.last_name}`.trim() || newBuyer.entity_name],
                    ['Cooling off', details.cooling_off_waived ? 'Waived' : 'Applies'],
                    ['Finance', details.subject_to_finance ? `Yes — due ${details.finance_due_date || 'TBC'}` : 'No'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span style={{ color: '#6b7280' }}>{label}</span>
                      <span style={{ color: '#111827', fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', background: '#fef9c3', padding: '10px 12px', borderRadius: 6 }}>
                <i className="ti ti-clock" style={{ marginRight: 6 }} />
                Submitting will place this lot On Hold for 24 hours. You must submit for approval before the timer expires.
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#fef2f2', borderRadius: 6, fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <button
            onClick={step === 'buyer' ? onClose : () => setStep(step === 'confirm' ? 'details' : 'buyer')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}
          >
            {step === 'buyer' ? 'Cancel' : '← Back'}
          </button>
          <button
            onClick={step === 'confirm' ? handleSubmit : handleNext}
            disabled={isLoading}
            style={{
              padding: '8px 20px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Saving…' : step === 'confirm' ? 'Place On Hold' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}