// src/features/sales/NewSaleModal.tsx

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createSale } from '../../api/sales'
import { getAgents } from '../../api/contacts'
import type { Lot } from '../../api/projects'
import client from '../../api/client'

interface Props {
  lot: Lot
  onClose: () => void
}

type Step = 'prospect' | 'details' | 'confirm'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProspectResult {
  id: string
  full_name: string
  first_name: string
  last_name: string
  email: string
  phone: string
  status: string
  engagement_level: string
  project_name: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function searchProspects(q: string): Promise<ProspectResult[]> {
  const { data } = await client.get<any>('/prospects/', { params: { q, status: 'active' } })
  return Array.isArray(data) ? data : (data.results ?? [])
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
  boxSizing: 'border-box' as const, outline: 'none',
}

const labelStyle = {
  fontSize: 12, fontWeight: 500 as const, color: '#374151', marginBottom: 4, display: 'block',
}

const ENGAGEMENT_COLOURS: Record<string, string> = {
  hot: '#dc2626', warm: '#d97706', cold: '#6b7280',
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────

export default function NewSaleModal({ lot, onClose }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('prospect')

  // Prospect step state
  const [searchQuery, setSearchQuery]         = useState('')
  const [selectedProspect, setSelectedProspect] = useState<ProspectResult | null>(null)

  // Details step state
  const [details, setDetails] = useState({
    agent_id: '',
    cooling_off_waived: false,
    subject_to_finance: false,
    finance_due_date: '',
  })

  const [error, setError] = useState<string | null>(null)

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['prospect-search', searchQuery],
    queryFn: () => searchProspects(searchQuery),
    enabled: searchQuery.length >= 2,
  })

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: getAgents,
  })

  const createSaleMutation = useMutation({ mutationFn: createSale })

  const handleNext = () => {
    setError(null)
    if (step === 'prospect') {
      if (!selectedProspect) {
        setError('Please select a prospect to continue.')
        return
      }
      setStep('details')
    } else if (step === 'details') {
      setStep('confirm')
    }
  }

  const handleSubmit = async () => {
    setError(null)
    try {
      await createSaleMutation.mutateAsync({
        lot_id: lot.id,
        prospect_id: selectedProspect!.id,
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

  const STEPS = [
    { key: 'prospect', label: 'Prospect' },
    { key: 'details',  label: 'Details' },
    { key: 'confirm',  label: 'Confirm' },
  ]
  const currentStepIndex = STEPS.findIndex((s) => s.key === step)
  const isLoading = createSaleMutation.isPending

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
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Register Sale</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Lot {lot.lot_number} – {lot.project_name}
                {lot.current_price && ` – $${Number(lot.current_price).toLocaleString()}`}
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
                padding: '8px 16px', fontSize: 12, fontWeight: 500,
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

          {/* ── Step 1 — Prospect search ── */}
          {step === 'prospect' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Search prospects by name, email or phone</label>
                <input
                  style={inputStyle}
                  placeholder="Start typing…"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setSelectedProspect(null) }}
                  autoFocus
                />
              </div>

              {searching && (
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Searching…</div>
              )}

              {searchResults.length > 0 && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                  {searchResults.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setSelectedProspect(p)}
                      style={{
                        padding: '12px 14px', cursor: 'pointer',
                        background: selectedProspect?.id === p.id ? '#f0f9ff' : '#fff',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                      onMouseEnter={e => { if (selectedProspect?.id !== p.id) e.currentTarget.style.background = '#f9fafb' }}
                      onMouseLeave={e => { if (selectedProspect?.id !== p.id) e.currentTarget.style.background = '#fff' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#3730a3', flexShrink: 0 }}>
                          {p.first_name?.[0] ?? '?'}{p.last_name?.[0] ?? ''}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: '#111827', fontSize: 13 }}>{p.full_name}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{p.email}{p.phone ? ` · ${p.phone}` : ''}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {p.engagement_level && (
                          <span style={{ fontSize: 11, fontWeight: 500, color: ENGAGEMENT_COLOURS[p.engagement_level] ?? '#6b7280' }}>
                            {p.engagement_level.charAt(0).toUpperCase() + p.engagement_level.slice(1)}
                          </span>
                        )}
                        {selectedProspect?.id === p.id && (
                          <i className="ti ti-check" style={{ color: '#16a34a', fontSize: 16 }} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                  No active prospects found for "{searchQuery}".
                  <br />
                  <span style={{ fontSize: 12 }}>Add them as a prospect first before registering a sale.</span>
                </div>
              )}

              {/* Selected prospect summary */}
              {selectedProspect && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Selected prospect
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{selectedProspect.full_name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {selectedProspect.email}{selectedProspect.phone ? ` · ${selectedProspect.phone}` : ''}
                    {selectedProspect.project_name ? ` · Interested in ${selectedProspect.project_name}` : ''}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2 — Details ── */}
          {step === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Agent (optional)</label>
                <select style={inputStyle} value={details.agent_id}
                  onChange={(e) => setDetails({ ...details, agent_id: e.target.value })}>
                  <option value="">No agent</option>
                  {(agents as any[]).map((a) => (
                    <option key={a.id} value={a.id}>{a.first_name} {a.last_name} – {a.agency_name}</option>
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

          {/* ── Step 3 — Confirm ── */}
          {step === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f9fafb', borderRadius: 8, padding: '16px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                  Sale Summary
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    ['Lot',      `Lot ${lot.lot_number} – ${lot.project_name}`],
                    ['Price',    lot.current_price ? `$${Number(lot.current_price).toLocaleString()}` : '—'],
                    ['Prospect', selectedProspect?.full_name ?? '—'],
                    ['Email',    selectedProspect?.email ?? '—'],
                    ['Cooling off', details.cooling_off_waived ? 'Waived' : 'Applies'],
                    ['Finance',  details.subject_to_finance ? `Yes – due ${details.finance_due_date || 'TBC'}` : 'No'],
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
            onClick={step === 'prospect' ? onClose : () => setStep(step === 'confirm' ? 'details' : 'prospect')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#6b7280' }}
          >
            {step === 'prospect' ? 'Cancel' : '← Back'}
          </button>
          {step === 'confirm' ? (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              style={{
                background: '#111827', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? 'Submitting…' : 'Register sale'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              style={{
                background: '#111827', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}