import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAgents, createAgency } from '../../api/contacts'
import client from '../../api/client'
import type { Agency, Agent } from '../../api/contacts'

const getAgencies = () =>
  client.get<any>('/agencies/').then((r) =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

const inputStyle = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
  boxSizing: 'border-box' as const,
}

const labelStyle = {
  fontSize: 12, fontWeight: 500 as const,
  color: '#374151', marginBottom: 4, display: 'block',
}

function AddAgencyModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => createAgency(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agencies'] })
      onClose()
    },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Something went wrong.'),
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Add Agency</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, padding: 0 }}>
            <i className="ti ti-x" />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Agency name *</label>
            <input style={inputStyle} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Ray White Canberra" />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label style={labelStyle}>Address</label>
            <input style={inputStyle} value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          {error && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', borderRadius: 6, fontSize: 13, color: '#dc2626' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
            background: '#f3f4f6', color: '#374151', border: 'none', fontWeight: 500,
          }}>
            Cancel
          </button>
          <button
            onClick={() => {
              if (!form.name.trim()) { setError('Agency name is required.'); return }
              setError(null)
              mutation.mutate()
            }}
            disabled={mutation.isPending}
            style={{
              padding: '8px 20px', borderRadius: 6, fontSize: 13, fontWeight: 500,
              background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
              opacity: mutation.isPending ? 0.6 : 1,
            }}
          >
            {mutation.isPending ? 'Saving…' : 'Add Agency'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgenciesPage() {
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const { data: agencies = [], isLoading } = useQuery<Agency[]>({
    queryKey: ['agencies'],
    queryFn: getAgencies,
  })

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: getAgents,
  })

  const agentsForAgency = selectedAgency
    ? agents.filter((a) => a.agency_name === selectedAgency.name)
    : []

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Agencies</h1>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Real estate agencies and their agents
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
            background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          <i className="ti ti-plus" style={{ marginRight: 6 }} />
          Add Agency
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedAgency ? '1fr 1fr' : '1fr', gap: 20 }}>

        {/* Agency list */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Agencies ({agencies.length})
          </div>
          {isLoading ? (
            <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</div>
          ) : agencies.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 14 }}>No agencies found.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agencies.map((agency: Agency) => (
                <div
                  key={agency.id}
                  onClick={() => setSelectedAgency(selectedAgency?.id === agency.id ? null : agency)}
                  style={{
                    background: '#fff',
                    border: selectedAgency?.id === agency.id ? '1px solid #111827' : '1px solid #e5e7eb',
                    borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{agency.name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {agency.email || '—'}
                      {agency.phone && ` · ${agency.phone}`}
                    </div>
                    {agency.address && (
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{agency.address}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 500, color: '#6b7280',
                      background: '#f3f4f6', padding: '2px 8px', borderRadius: 20,
                    }}>
                      {agents.filter((a) => a.agency_name === agency.name).length} agents
                    </span>
                    <i className="ti ti-chevron-right" style={{ color: '#9ca3af', fontSize: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent list for selected agency */}
        {selectedAgency && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Agents — {selectedAgency.name}
            </div>
            {agentsForAgency.length === 0 ? (
              <div style={{ color: '#9ca3af', fontSize: 14 }}>No agents found for this agency.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {agentsForAgency.map((agent: Agent) => (
                  <div key={agent.id} style={{
                    background: '#fff', border: '1px solid #e5e7eb',
                    borderRadius: 8, padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                          {agent.first_name} {agent.last_name}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{agent.email || '—'}</div>
                        {agent.phone && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{agent.phone}</div>}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                        background: agent.is_active ? '#dcfce7' : '#f3f4f6',
                        color: agent.is_active ? '#166534' : '#6b7280',
                      }}>
                        {agent.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddModal && <AddAgencyModal onClose={() => setShowAddModal(false)} />}
    </div>
  )
}