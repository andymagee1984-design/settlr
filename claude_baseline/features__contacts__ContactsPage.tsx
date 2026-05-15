// src/features/contacts/ContactsPage.tsx

import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAgents, getSolicitors, getReferrers, getBuyers } from '../../api/contacts'
import type { Agent, Solicitor, Referrer, Buyer } from '../../api/contacts'
import ContactDetailPanel from './ContactDetailPanel'
import LogActivityForm from '../../components/LogActivityForm'
import client from '../../api/client'
import { Flame, Thermometer, Snowflake, RefreshCw } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Prospect types (mirrors ProspectsPage)
// ─────────────────────────────────────────────────────────────────────────────

type ProspectStatus = 'active' | 'converted' | 'lost'
type ProspectSource = 'website_form' | 'portal' | 'walk_in' | 'phone' | 'referral' | 'other'

interface Prospect {
  id: string
  full_name: string
  first_name: string
  last_name: string
  email: string
  phone: string
  source: ProspectSource
  status: ProspectStatus
  project_name: string | null
  engagement_level: string
  is_returning_buyer: boolean
  converted_at: string | null
  created_at: string
}

async function fetchProspects(): Promise<Prospect[]> {
  const { data } = await client.get<any>('/prospects/')
  return Array.isArray(data) ? data : (data.results ?? [])
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'prospects' | 'buyers' | 'agents' | 'solicitors' | 'referrers'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'prospects',  label: 'Prospects',  icon: 'ti-users'        },
  { key: 'buyers',     label: 'Buyers',     icon: 'ti-home-dollar'  },
  { key: 'agents',     label: 'Agents',     icon: 'ti-briefcase'    },
  { key: 'solicitors', label: 'Solicitors', icon: 'ti-scale'        },
  { key: 'referrers',  label: 'Referrers',  icon: 'ti-link'         },
]

const CONTACT_TYPE_MAP: Record<Tab, string> = {
  prospects:  'Buyer',
  buyers:     'Buyer',
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

// ─────────────────────────────────────────────────────────────────────────────
// Prospect-specific badges
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  active:    { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', label: 'Active' },
  converted: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe', label: 'Converted' },
  lost:      { bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb', label: 'Lost' },
}

const SOURCE_LABELS: Record<string, string> = {
  website_form: 'Web form',
  portal:       'Portal',
  walk_in:      'Walk-in',
  phone:        'Phone',
  referral:     'Referral',
  other:        'Other',
}

const ENGAGEMENT_CONFIG: Record<string, { icon: React.ReactNode; bg: string; color: string; border: string; label: string }> = {
  hot:  { icon: <Flame size={11} />,       bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Hot' },
  warm: { icon: <Thermometer size={11} />, bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'Warm' },
  cold: { icon: <Snowflake size={11} />,   bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd', label: 'Cold' },
}

function EngagementBadge({ level }: { level: string }) {
  const config = ENGAGEMENT_CONFIG[level] ?? ENGAGEMENT_CONFIG.cold
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
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.active
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

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20, background: color + '20', color }}>
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline activity log form
// ─────────────────────────────────────────────────────────────────────────────

function ContactActivityFormRow({ contactId, contactType, onClose }: {
  contactId: string; contactType: string; onClose: () => void
}) {
  const queryClient = useQueryClient()
  return (
    <tr>
      <td colSpan={99} style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
        <LogActivityForm
          contactId={contactId}
          contactType={contactType}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['activities'] }); onClose() }}
          onCancel={onClose}
        />
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic table (agents / solicitors / referrers)
// ─────────────────────────────────────────────────────────────────────────────

function Table({ headers, rows, contacts, tab, onRowClick }: {
  headers: string[]
  rows: (string | React.ReactElement)[][]
  contacts: { id: string }[]
  tab: Tab
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
                <td style={{ ...cellStyle, padding: '6px 10px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setActiveActivityRow(activeActivityRow === i ? null : i)}
                    style={{
                      padding: '4px 8px', borderRadius: 5, fontSize: 11, fontWeight: 500,
                      background: activeActivityRow === i ? '#111827' : '#f3f4f6',
                      color: activeActivityRow === i ? '#fff' : '#6b7280',
                      border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    <i className="ti ti-plus" style={{ marginRight: 3 }} />Task
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

// ─────────────────────────────────────────────────────────────────────────────
// Prospects table (uses Prospect model, not Buyer)
// ─────────────────────────────────────────────────────────────────────────────

function ProspectsTable({ prospects, onRowClick }: {
  prospects: Prospect[]
  onRowClick: (p: Prospect) => void
}) {
  const headers = ['Name', 'Status', 'Engagement', 'Project', 'Source', 'Email', 'Phone']

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{headers.map(h => <th key={h} style={headStyle}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {prospects.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{ ...cellStyle, color: '#9ca3af', textAlign: 'center', padding: '24px' }}>
                No prospects found.
              </td>
            </tr>
          ) : prospects.map(p => (
            <tr key={p.id}
              style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
              onClick={() => onRowClick(p)}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={cellStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#3730a3', flexShrink: 0 }}>
                    {p.first_name?.[0] ?? '?'}{p.last_name?.[0] ?? ''}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500, color: '#111827' }}>{p.full_name}</span>
                      {p.is_returning_buyer && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
                          <RefreshCw size={9} /> Returning
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td style={cellStyle}><StatusBadge status={p.status} /></td>
              <td style={cellStyle}><EngagementBadge level={p.engagement_level} /></td>
              <td style={{ ...cellStyle, color: p.project_name ? '#374151' : '#9ca3af' }}>{p.project_name ?? '—'}</td>
              <td style={cellStyle}>{SOURCE_LABELS[p.source] ?? p.source}</td>
              <td style={cellStyle}>{p.email || '—'}</td>
              <td style={cellStyle}>{p.phone || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const [tab,    setTab]    = useState<Tab>('prospects')
  const [search, setSearch] = useState('')
  const [selectedContact, setSelectedContact] = useState<{ id: string; type: 'Buyer' | 'Agent' | 'Solicitor' | 'Referrer' } | null>(null)
  const [selectedProspectId, setSelectedProspectId] = useState<string | null>(null)

  const { data: prospects   = [], isLoading: loadingProspects   } = useQuery<Prospect[]>({ queryKey: ['prospects'],   queryFn: fetchProspects, enabled: tab === 'prospects'  })
  const { data: buyers      = [], isLoading: loadingBuyers      } = useQuery<Buyer[]>({    queryKey: ['buyers'],      queryFn: getBuyers,      enabled: tab === 'buyers'     })
  const { data: agents      = [], isLoading: loadingAgents      } = useQuery<Agent[]>({    queryKey: ['agents'],      queryFn: getAgents,      enabled: tab === 'agents'     })
  const { data: solicitors  = [], isLoading: loadingSolicitors  } = useQuery<Solicitor[]>({ queryKey: ['solicitors'], queryFn: getSolicitors,  enabled: tab === 'solicitors' })
  const { data: referrers   = [], isLoading: loadingReferrers   } = useQuery<Referrer[]>({ queryKey: ['referrers'],   queryFn: getReferrers,   enabled: tab === 'referrers'  })

  const isLoading = loadingProspects || loadingBuyers || loadingAgents || loadingSolicitors || loadingReferrers
  const q = search.toLowerCase()

  const filteredProspects  = prospects.filter(p => !q || p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q))
  const filteredBuyers     = buyers.filter(b => !q || b.display_name?.toLowerCase().includes(q) || b.email?.toLowerCase().includes(q))
  const filteredAgents     = agents.filter(a => !q || `${a.first_name} ${a.last_name}`.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q))
  const filteredSolicitors = solicitors.filter(s => !q || `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || s.firm_name?.toLowerCase().includes(q))
  const filteredReferrers  = referrers.filter(r => !q || `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) || r.company_name?.toLowerCase().includes(q))

  const activeProspects    = filteredProspects.filter(p => p.status === 'active')
  const convertedProspects = filteredProspects.filter(p => p.status === 'converted')

  const buyerRows = filteredBuyers.map(b => [
    <div>
      <div style={{ fontWeight: 500, color: '#111827' }}>{b.display_name}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
        {b.buyer_type === 'individual' ? 'Individual' : b.buyer_type === 'company' ? 'Company' : 'Trust'}
      </div>
    </div>,
    b.email || '—',
    b.phone || '—',
    b.address || '—',
    (b as any).converted_at
      ? <Badge label="Purchased" color="#059669" />
      : <Badge label="Active" color="#2563eb" />,
  ])
  const agentRows = filteredAgents.map(a => [
    <span style={{ fontWeight: 500, color: '#111827' }}>{a.first_name} {a.last_name}</span>,
    a.agency_name || '—', a.email || '—', a.phone || '—',
    a.is_active ? <Badge label="Active" color="#16a34a" /> : <Badge label="Inactive" color="#6b7280" />,
  ])
  const solicitorRows = filteredSolicitors.map(s => [
    <span style={{ fontWeight: 500, color: '#111827' }}>{s.first_name} {s.last_name}</span>,
    s.firm_name || '—', s.email || '—', s.phone || '—', s.address || '—',
  ])
  const referrerRows = filteredReferrers.map(r => [
    <span style={{ fontWeight: 500, color: '#111827' }}>{r.first_name} {r.last_name}</span>,
    r.company_name || '—', r.email || '—', r.phone || '—',
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
              {t.key === 'prospects' && prospects.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 6px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280' }}>
                  {activeProspects.length} active · {convertedProspects.length} converted
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
        <ProspectsTable
          prospects={filteredProspects}
          onRowClick={(p) => setSelectedProspectId(p.id)}
        />
      ) : tab === 'buyers' ? (
        <Table headers={['Name', 'Email', 'Phone', 'Address', 'Status']} rows={buyerRows} contacts={filteredBuyers} tab={tab}
          onRowClick={(i) => setSelectedContact({ id: filteredBuyers[i].id, type: 'Buyer' })} />
      ) : tab === 'agents' ? (
        <Table headers={['Name', 'Agency', 'Email', 'Phone', 'Status']} rows={agentRows} contacts={filteredAgents} tab={tab}
          onRowClick={(i) => setSelectedContact({ id: filteredAgents[i].id, type: 'Agent' })} />
      ) : tab === 'solicitors' ? (
        <Table headers={['Name', 'Firm', 'Email', 'Phone', 'Address']} rows={solicitorRows} contacts={filteredSolicitors} tab={tab}
          onRowClick={(i) => setSelectedContact({ id: filteredSolicitors[i].id, type: 'Solicitor' })} />
      ) : (
        <Table headers={['Name', 'Company', 'Email', 'Phone']} rows={referrerRows} contacts={filteredReferrers} tab={tab}
          onRowClick={(i) => setSelectedContact({ id: filteredReferrers[i].id, type: 'Referrer' })} />
      )}

      {/* Contact detail panel (agents / solicitors / referrers) */}
      {selectedContact && (
        <ContactDetailPanel
          contactId={selectedContact.id}
          contactType={selectedContact.type}
          onClose={() => setSelectedContact(null)}
        />
      )}

      {/* Prospect detail panel — navigates to ProspectsPage with pre-selected prospect */}
      {selectedProspectId && (
        <ProspectSidePanel prospectId={selectedProspectId} onClose={() => setSelectedProspectId(null)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline prospect side panel (mirrors ProspectDetailPanel from ProspectsPage)
// ─────────────────────────────────────────────────────────────────────────────

function ProspectSidePanel({ prospectId, onClose }: { prospectId: string; onClose: () => void }) {
  const { data: prospect, isLoading } = useQuery({
    queryKey: ['prospect-detail', prospectId],
    queryFn: async () => {
      const { data } = await client.get<Prospect>(`/prospects/${prospectId}/`)
      return data
    },
    staleTime: 0,
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{ width: 420, background: '#fff', height: '100vh', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>Prospect</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18 }}>×</button>
        </div>

        {isLoading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1,2,3].map(i => <div key={i} style={{ height: 48, background: '#f1f5f9', borderRadius: 8 }} />)}
          </div>
        ) : !prospect ? (
          <div style={{ padding: 24, color: '#9ca3af', fontSize: 13 }}>Prospect not found.</div>
        ) : (
          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: '#3730a3', flexShrink: 0 }}>
                {prospect.first_name?.[0] ?? '?'}{prospect.last_name?.[0] ?? ''}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{prospect.full_name}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <StatusBadge status={prospect.status} />
                  <EngagementBadge level={prospect.engagement_level} />
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {prospect.email && <a href={`mailto:${prospect.email}`} style={{ fontSize: 13, color: '#2563eb', textDecoration: 'none' }}>{prospect.email}</a>}
              {prospect.phone && <a href={`tel:${prospect.phone}`} style={{ fontSize: 13, color: '#374151', textDecoration: 'none' }}>{prospect.phone}</a>}
            </div>

            {/* Details */}
            <div>
              {[
                { label: 'Source',   value: SOURCE_LABELS[prospect.source] ?? prospect.source },
                { label: 'Project',  value: prospect.project_name ?? '—' },
                { label: 'Created',  value: new Date(prospect.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) },
                ...(prospect.converted_at ? [{ label: 'Converted', value: new Date(prospect.converted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', padding: '7px 0', fontSize: 13 }}>
                  <span style={{ color: '#6b7280' }}>{label}</span>
                  <span style={{ color: '#111827' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}