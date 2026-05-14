// src/features/contacts/ContactsPage.tsx

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBuyers, getAgents, getSolicitors, getReferrers } from '../../api/contacts'
import type { Buyer, Agent, Solicitor, Referrer } from '../../api/contacts'
import ContactDetailPanel from './ContactDetailPanel'
import LogActivityForm from '../../components/LogActivityForm'

type Tab = 'prospects' | 'agents' | 'solicitors' | 'referrers'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'prospects',  label: 'Prospects',  icon: 'ti-users'    },
  { key: 'agents',     label: 'Agents',     icon: 'ti-briefcase'},
  { key: 'solicitors', label: 'Solicitors', icon: 'ti-scale'    },
  { key: 'referrers',  label: 'Referrers',  icon: 'ti-link'     },
]

// Maps contact tab to the contact_type string the API expects
const CONTACT_TYPE_MAP: Record<Tab, string> = {
  prospects:  'Buyer',
  agents:     'Agent',
  solicitors: 'Solicitor',
  referrers:  'Referrer',
}

const cellStyle = { padding: '10px 12px', fontSize: 13, color: '#374151' }
const headStyle = {
  padding: '10px 12px', fontSize: 11, fontWeight: 600,
  color: '#6b7280', textAlign: 'left' as const,
  textTransform: 'uppercase' as const, letterSpacing: '0.05em',
  background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
}

// ─── Inline activity log form for a specific contact ─────────────────────────

function ContactActivityFormRow({
  contactId,
  contactType,
  onClose,
}: {
  contactId:   string
  contactType: string
  onClose:     () => void
}) {
  const queryClient = useQueryClient()
  return (
    <tr>
      <td colSpan={99} style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
        <LogActivityForm
          contactId={contactId}
          contactType={contactType}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['activities'] })
            onClose()
          }}
          onCancel={onClose}
        />
      </td>
    </tr>
  )
}

// ─── Table with inline activity form support ──────────────────────────────────

function Table({ headers, rows, contacts, tab, onRowClick }: {
  headers:    string[]
  rows:       (string | React.ReactElement)[][]
  contacts:   { id: string }[]
  tab:        Tab
  onRowClick: (index: number) => void
}) {
  const [activeActivityRow, setActiveActivityRow] = useState<number | null>(null)
  const contactType = CONTACT_TYPE_MAP[tab]

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headers.map((h) => <th key={h} style={headStyle}>{h}</th>)}
            <th style={{ ...headStyle, width: 40 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length + 1} style={{ ...cellStyle, color: '#9ca3af', textAlign: 'center', padding: '24px' }}>
                No records found.
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <React.Fragment key={i}>
              <tr
                style={{ borderBottom: activeActivityRow === i ? 'none' : '1px solid #f3f4f6', cursor: 'pointer' }}
                onClick={() => onRowClick(i)}
              >
                {row.map((cell, j) => <td key={j} style={cellStyle}>{cell}</td>)}
                {/* Log activity button — stops propagation so it doesn't open the detail panel */}
                <td style={{ ...cellStyle, padding: '6px 10px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveActivityRow(activeActivityRow === i ? null : i)}
                    title="Log activity"
                    style={{
                      padding: '4px 8px', borderRadius: 5, fontSize: 11, fontWeight: 500,
                      background: activeActivityRow === i ? '#111827' : '#f3f4f6',
                      color:      activeActivityRow === i ? '#fff'    : '#6b7280',
                      border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <i className="ti ti-plus" style={{ marginRight: 3 }} />
                    Task
                  </button>
                </td>
              </tr>
              {activeActivityRow === i && contacts[i] && (
                <ContactActivityFormRow
                  contactId={contacts[i].id}
                  contactType={contactType}
                  onClose={() => setActiveActivityRow(null)}
                />
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: color + '20', color }}>
      {label}
    </span>
  )
}

const INTEREST_COLOURS: Record<string, string> = { hot: '#dc2626', warm: '#f59e0b', cold: '#3b82f6' }

function fmt(n: number | null | undefined): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}

export default function ContactsPage() {
  const [tab,    setTab]    = useState<Tab>('prospects')
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<{ id: string; type: 'Buyer' | 'Agent' | 'Solicitor' | 'Referrer' } | null>(null)

  const { data: buyers     = [], isLoading: loadingBuyers     } = useQuery<Buyer[]>({    queryKey: ['buyers'],     queryFn: getBuyers,     enabled: tab === 'prospects'  })
  const { data: agents     = [], isLoading: loadingAgents     } = useQuery<Agent[]>({    queryKey: ['agents'],     queryFn: getAgents,     enabled: tab === 'agents'     })
  const { data: solicitors = [], isLoading: loadingSolicitors } = useQuery<Solicitor[]>({ queryKey: ['solicitors'], queryFn: getSolicitors, enabled: tab === 'solicitors' })
  const { data: referrers  = [], isLoading: loadingReferrers  } = useQuery<Referrer[]>({ queryKey: ['referrers'],  queryFn: getReferrers,  enabled: tab === 'referrers'  })

  const isLoading = loadingBuyers || loadingAgents || loadingSolicitors || loadingReferrers
  const q = search.toLowerCase()

  const filteredBuyers     = buyers.filter(b => !q || b.display_name?.toLowerCase().includes(q) || b.email?.toLowerCase().includes(q))
  const filteredAgents     = agents.filter(a => !q || `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q))
  const filteredSolicitors = solicitors.filter(s => !q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || s.firm_name?.toLowerCase().includes(q))
  const filteredReferrers  = referrers.filter(r => !q || `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) || r.company_name?.toLowerCase().includes(q))

  const converted   = filteredBuyers.filter(b => (b as any).converted_at)
  const unconverted = filteredBuyers.filter(b => !(b as any).converted_at)

  const prospectRows = filteredBuyers.map(b => {
    const isConverted   = !!(b as any).converted_at
    const interestLevel = (b as any).interest_level
    const budgetMin     = (b as any).budget_min
    const budgetMax     = (b as any).budget_max
    const source        = (b as any).source
    return [
      <div>
        <div style={{ fontWeight: 500, color: '#111827' }}>{b.display_name}</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
          {b.buyer_type === 'individual' ? 'Individual' : b.buyer_type === 'company' ? 'Company' : 'Trust'}
        </div>
      </div>,
      isConverted
        ? <Badge label="Purchased" color="#059669" />
        : interestLevel
          ? <Badge label={interestLevel.charAt(0).toUpperCase() + interestLevel.slice(1)} color={INTEREST_COLOURS[interestLevel] ?? '#6b7280'} />
          : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>,
      (budgetMin || budgetMax) ? <span style={{ fontSize: 12 }}>{fmt(budgetMin)} – {fmt(budgetMax)}</span> : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>,
      source ? <span style={{ fontSize: 12, textTransform: 'capitalize' as const }}>{source.replace(/_/g, ' ')}</span> : <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>,
      b.email || '—',
      b.phone || '—',
    ]
  })

  const agentRows = filteredAgents.map(a => [
    <span style={{ fontWeight: 500, color: '#111827' }}>{a.first_name} {a.last_name}</span>,
    a.agency_name || '—',
    a.email || '—',
    a.phone || '—',
    a.is_active ? <Badge label="Active" color="#16a34a" /> : <Badge label="Inactive" color="#6b7280" />,
  ])

  const solicitorRows = filteredSolicitors.map(s => [
    <span style={{ fontWeight: 500, color: '#111827' }}>{s.first_name} {s.last_name}</span>,
    s.firm_name || '—',
    s.email || '—',
    s.phone || '—',
    s.address || '—',
  ])

  const referrerRows = filteredReferrers.map(r => [
    <span style={{ fontWeight: 500, color: '#111827' }}>{r.first_name} {r.last_name}</span>,
    r.company_name || '—',
    r.email || '—',
    r.phone || '—',
  ])

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Contacts</h1>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Prospects, agents, solicitors and referrers</div>
      </div>

      {/* Tabs + search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb' }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setSearch('') }} style={{
              padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid #111827' : '2px solid transparent',
              color: tab === t.key ? '#111827' : '#6b7280', marginBottom: -1,
            }}>
              <i className={`ti ${t.icon}`} style={{ marginRight: 6 }} />
              {t.label}
              {t.key === 'prospects' && buyers.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280' }}>
                  {unconverted.length} active · {converted.length} purchased
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: '#111827', outline: 'none', width: 200 }}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</div>
      ) : tab === 'prospects' ? (
        <Table
          headers={['Name', 'Status / Interest', 'Budget', 'Source', 'Email', 'Phone']}
          rows={prospectRows}
          contacts={filteredBuyers}
          tab={tab}
          onRowClick={(i) => setSelectedContact({ id: filteredBuyers[i].id, type: 'Buyer' })}
        />
      ) : tab === 'agents' ? (
        <Table
          headers={['Name', 'Agency', 'Email', 'Phone', 'Status']}
          rows={agentRows}
          contacts={filteredAgents}
          tab={tab}
          onRowClick={(i) => setSelectedContact({ id: filteredAgents[i].id, type: 'Agent' })}
        />
      ) : tab === 'solicitors' ? (
        <Table
          headers={['Name', 'Firm', 'Email', 'Phone', 'Address']}
          rows={solicitorRows}
          contacts={filteredSolicitors}
          tab={tab}
          onRowClick={(i) => setSelectedContact({ id: filteredSolicitors[i].id, type: 'Solicitor' })}
        />
      ) : (
        <Table
          headers={['Name', 'Company', 'Email', 'Phone']}
          rows={referrerRows}
          contacts={filteredReferrers}
          tab={tab}
          onRowClick={(i) => setSelectedContact({ id: filteredReferrers[i].id, type: 'Referrer' })}
        />
      )}

      {selectedContact && (
        <ContactDetailPanel
          contactId={selectedContact.id}
          contactType={selectedContact.type}
          onClose={() => setSelectedContact(null)}
        />
      )}
    </div>
  )
}