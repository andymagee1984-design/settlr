// src/features/contacts/AgenciesPage.tsx

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAgents, createAgency } from '../../api/contacts'
import { useAuthStore } from '../../store/authStore'
import client from '../../api/client'
import type { Agent } from '../../api/contacts'
import AddressAutocomplete from '../../components/AddressAutocomplete'

interface Agency {
  id: string
  name: string
  address: string
  phone: string
  email: string
  default_commission_type: string
  default_commission_rate: number | null
  agent_count: number
}

const getAgencies = () =>
  client.get<any>('/agencies/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

const updateAgency = (id: string, data: Record<string, any>) =>
  client.patch<Agency>(`/agencies/${id}/`, data).then((r) => r.data)

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d4ccc5', fontSize: 13, color: '#2c2420',
  boxSizing: 'border-box' as const, background: '#fff', outline: 'none',
}

const labelStyle = {
  fontSize: 12, fontWeight: 500 as const,
  color: '#7a6e68', marginBottom: 4, display: 'block',
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Agency Modal
// ─────────────────────────────────────────────────────────────────────────────

function AddAgencyModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => createAgency(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['agencies'] }); onClose() },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Something went wrong.'),
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(44,36,32,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 440, boxShadow: '0 20px 60px rgba(44,36,32,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0ebe6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#2c2420' }}>Add Agency</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a89e98', fontSize: 20, padding: 0 }}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Agency name *</label>
            <input style={inputStyle} type="text" placeholder="e.g. Ray White Canberra"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Address</label>
            <AddressAutocomplete
              value={form.address}
              onChange={(address) => setForm({ ...form, address })}
              inputStyle={inputStyle}
              placeholder="Start typing an address…"
            />
          </div>
          {error && <div style={{ padding: '10px 12px', background: '#fdf0ee', borderRadius: 6, fontSize: 13, color: '#882010', border: '1px solid #f5c4bb' }}>{error}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0ebe6', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer', background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', fontWeight: 500, fontFamily: 'var(--font-body)' }}>
            Cancel
          </button>
          <button onClick={() => {
            if (!form.name.trim()) { setError('Agency name is required.'); return }
            setError(null); mutation.mutate()
          }} disabled={mutation.isPending} style={{
            padding: '8px 20px', borderRadius: 6, fontSize: 13, fontWeight: 500,
            background: '#3d4a5c', color: '#fff', border: 'none', cursor: 'pointer',
            opacity: mutation.isPending ? 0.6 : 1, fontFamily: 'var(--font-body)',
          }}>
            {mutation.isPending ? 'Saving…' : 'Add Agency'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Commission rate editor
// ─────────────────────────────────────────────────────────────────────────────

function CommissionRateEditor({ agency, onSaved }: { agency: Agency; onSaved: () => void }) {
  const [type,  setType]  = useState(agency.default_commission_type ?? '')
  const [rate,  setRate]  = useState(agency.default_commission_rate?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: () => updateAgency(agency.id, {
      default_commission_type: type || null,
      default_commission_rate: rate ? parseFloat(rate) : null,
    }),
    onSuccess: () => onSaved(),
    onError:   (e: any) => setError(e?.response?.data?.detail ?? 'Save failed'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Commission type</label>
          <select style={inputStyle} value={type} onChange={e => setType(e.target.value)}>
            <option value="">Not set</option>
            <option value="percentage">Percentage (%)</option>
            <option value="flat">Flat amount ($)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>{type === 'flat' ? 'Amount ($)' : 'Rate (%)'}</label>
          <input style={inputStyle} type="number" step="0.01" min="0"
            value={rate} placeholder={type === 'flat' ? 'e.g. 5000' : 'e.g. 2.5'}
            onChange={e => setRate(e.target.value)} />
        </div>
      </div>
      {error && <div style={{ fontSize: 12, color: '#882010' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => mutate()} disabled={isPending} style={{
          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: '#3d4a5c', color: '#fff', border: 'none', cursor: 'pointer',
          opacity: isPending ? 0.6 : 1, fontFamily: 'var(--font-body)',
        }}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onSaved} style={{
          padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
          background: '#f2f0ee', color: '#2c2420', border: '1px solid #e8e2dd', cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Agency detail panel
// ─────────────────────────────────────────────────────────────────────────────

function AgencyDetail({ agency, agents, canManageCommissions, onCommissionSaved }: {
  agency: Agency
  agents: Agent[]
  canManageCommissions: boolean
  onCommissionSaved: () => void
}) {
  const [editingCommission, setEditingCommission] = useState(false)
  const agentsForAgency = agents.filter(a => a.agency_name === agency.name)

  const commissionLabel = () => {
    if (!agency.default_commission_type || agency.default_commission_rate == null) return 'Not set'
    if (agency.default_commission_type === 'percentage') return `${agency.default_commission_rate}%`
    return `$${Number(agency.default_commission_rate).toLocaleString()} flat`
  }

  return (
    <div>
      {/* Commission rate */}
      <div style={{ background: '#fff', border: '1px solid #e8e2dd', borderRadius: 8, padding: '16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#7a6e68', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }}>
            Default commission rate
          </div>
          {canManageCommissions && !editingCommission && (
            <button onClick={() => setEditingCommission(true)} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 4,
              background: '#f2f0ee', color: '#2c2420', border: 'none', cursor: 'pointer',
            }}>
              Edit
            </button>
          )}
        </div>
        {editingCommission ? (
          <CommissionRateEditor
            agency={agency}
            onSaved={() => { setEditingCommission(false); onCommissionSaved() }}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: '#a89e98', marginBottom: 2 }}>Type</div>
              <div style={{ fontSize: 13, color: '#2c2420', fontWeight: 500 }}>
                {agency.default_commission_type
                  ? agency.default_commission_type === 'percentage' ? 'Percentage' : 'Flat amount'
                  : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#a89e98', marginBottom: 2 }}>Default rate</div>
              <div style={{ fontSize: 13, color: '#2c2420', fontWeight: 500 }}>{commissionLabel()}</div>
            </div>
          </div>
        )}
        {!editingCommission && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#a89e98' }}>
            Applied automatically when a sale by an agent from this agency reaches Exchanged.
          </div>
        )}
      </div>

      {/* Agents */}
      <div style={{ fontSize: 11, fontWeight: 600, color: '#7a6e68', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 10 }}>
        Agents ({agentsForAgency.length})
      </div>
      {agentsForAgency.length === 0 ? (
        <div style={{ color: '#a89e98', fontSize: 14 }}>No agents for this agency.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {agentsForAgency.map((agent) => (
            <div key={agent.id} style={{ background: '#fff', border: '1px solid #e8e2dd', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2420' }}>{agent.first_name} {agent.last_name}</div>
                  <div style={{ fontSize: 12, color: '#7a6e68', marginTop: 2 }}>{agent.email || '—'}</div>
                  {agent.phone && <div style={{ fontSize: 11, color: '#a89e98', marginTop: 2 }}>{agent.phone}</div>}
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                  background: agent.is_active ? '#eef7f0' : '#f2f0ee',
                  color:      agent.is_active ? '#1a5c2e' : '#7a6e68',
                  border:     `1px solid ${agent.is_active ? '#b8dfc3' : '#ddd7d2'}`,
                }}>
                  {agent.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AgenciesPage() {
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const canManageCommissions = user?.role?.permissions?.some(p => p.code === 'sale.approve') ?? false

  const { data: agencies = [], isLoading } = useQuery<Agency[]>({
    queryKey:  ['agencies'],
    queryFn:   getAgencies,
    staleTime: 60_000,
  })

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey:  ['agents'],
    queryFn:   getAgents,
    staleTime: 60_000,
  })

  const handleCommissionSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['agencies'] })
  }

  const selectedAgencyFresh = agencies.find(a => a.id === selectedAgency?.id) ?? selectedAgency

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, background: '#f9f6f4', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2c2420', margin: 0 }}>Agencies</h1>
          <div style={{ fontSize: 13, color: '#7a6e68', marginTop: 4 }}>Real estate agencies, agents and commission rates</div>
        </div>
        <button onClick={() => setShowAddModal(true)} style={{
          padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
          background: '#3d4a5c', color: '#fff', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-body)',
        }}>
          <i className="ti ti-plus" style={{ marginRight: 6 }} />
          Add Agency
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedAgency ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Agency list */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#7a6e68', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 12 }}>
            Agencies ({agencies.length})
          </div>
          {isLoading ? (
            <div style={{ color: '#a89e98', fontSize: 14 }}>Loading…</div>
          ) : agencies.length === 0 ? (
            <div style={{ color: '#a89e98', fontSize: 14 }}>No agencies found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agencies.map((agency: Agency) => {
                const hasRate = agency.default_commission_type && agency.default_commission_rate != null
                const rateLabel = hasRate
                  ? agency.default_commission_type === 'percentage'
                    ? `${agency.default_commission_rate}% commission`
                    : `$${Number(agency.default_commission_rate).toLocaleString()} flat commission`
                  : canManageCommissions ? 'No commission rate set' : null
                const isSelected = selectedAgency?.id === agency.id

                return (
                  <div
                    key={agency.id}
                    onClick={() => setSelectedAgency(isSelected ? null : agency)}
                    style={{
                      background: isSelected ? '#f7ece9' : '#fff',
                      border: `1px solid ${isSelected ? '#e8c4bb' : '#e8e2dd'}`,
                      borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
                      transition: 'background 0.1s, border-color 0.1s',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#faf8f7' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2420' }}>{agency.name}</div>
                        {agency.email && <div style={{ fontSize: 12, color: '#7a6e68', marginTop: 2 }}>{agency.email}</div>}
                        {agency.address && <div style={{ fontSize: 11, color: '#a89e98', marginTop: 2 }}>{agency.address}</div>}
                        {rateLabel && (
                          <div style={{ fontSize: 11, color: hasRate ? '#1a5c2e' : '#a89e98', marginTop: 4 }}>
                            {rateLabel}
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#a89e98' }}>
                        {agency.agent_count} agent{agency.agent_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Agency detail */}
        {selectedAgencyFresh && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#7a6e68', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 12 }}>
              {selectedAgencyFresh.name}
            </div>
            <AgencyDetail
              agency={selectedAgencyFresh}
              agents={agents}
              canManageCommissions={canManageCommissions}
              onCommissionSaved={handleCommissionSaved}
            />
          </div>
        )}
      </div>

      {showAddModal && <AddAgencyModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}