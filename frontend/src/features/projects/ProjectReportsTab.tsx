// src/features/projects/ProjectReportsTab.tsx
// Used as the Reports tab inside ProjectDetailPage.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, TrendingUp, Home, AlertTriangle } from 'lucide-react'
import client from '../../api/client'
import type { Sale } from '../../api/sales'
import type { ProjectDetail } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// API — fetch sales for this project
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProjectSales(projectId: string): Promise<Sale[]> {
  const { data } = await client.get<any>('/sales/', { params: { project: projectId } })
  return Array.isArray(data) ? data : (data.results ?? [])
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, colour }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; colour: string
}) {
  return (
    <div style={{
      background: '#f9fafb', borderRadius: 10, padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: '#6b7280' }}>{label}</div>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: colour + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} color={colour} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline funnel
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'on_hold',         label: 'On Hold',         colour: '#f59e0b' },
  { key: 'pending',         label: 'Pending',         colour: '#3b82f6' },
  { key: 'reserved',        label: 'Reserved',        colour: '#8b5cf6' },
  { key: 'contract_issued', label: 'Contract Issued', colour: '#f97316' },
  { key: 'exchanged',       label: 'Exchanged',       colour: '#10b981' },
  { key: 'settled',         label: 'Settled',         colour: '#059669' },
]

function PipelineFunnel({ sales }: { sales: Sale[] }) {
  const counts = PIPELINE_STAGES.map(stage => ({
    ...stage,
    count: sales.filter(s => s.status === stage.key).length,
    value: sales.filter(s => s.status === stage.key)
      .reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0),
  }))
  const max = Math.max(...counts.map(c => c.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {counts.map(({ key, label, colour, count, value }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 110, fontSize: 12, color: '#6b7280', textAlign: 'right' as const, flexShrink: 0 }}>
            {label}
          </div>
          <div style={{ flex: 1, height: 28, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.max((count / max) * 100, 0)}%`,
              background: colour, borderRadius: 6, minWidth: count > 0 ? 28 : 0,
              display: 'flex', alignItems: 'center', paddingLeft: 8,
            }}>
              {count > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{count}</span>
              )}
            </div>
          </div>
          <div style={{ width: 80, fontSize: 12, color: '#9ca3af', textAlign: 'right' as const, flexShrink: 0 }}>
            {value > 0 ? fmt(value) : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent leaderboard
// ─────────────────────────────────────────────────────────────────────────────

function AgentLeaderboard({ sales }: { sales: Sale[] }) {
  const agentMap = useMemo(() => {
    const map: Record<string, {
      name: string; total: number; settled: number
      fallenOver: number; value: number
    }> = {}

    sales.forEach(s => {
      if (!s.agent) return
      const name = (s as any).agent_name ?? s.agent
      if (!map[s.agent]) {
        map[s.agent] = { name, total: 0, settled: 0, fallenOver: 0, value: 0 }
      }
      map[s.agent].total++
      if (s.status === 'settled') {
        map[s.agent].settled++
        map[s.agent].value += Number(s.sale_price) || 0
      }
      if (s.status === 'fallen_over') map[s.agent].fallenOver++
    })

    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [sales])

  if (agentMap.length === 0) {
    return <div style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>No agent sales recorded.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 90px',
        padding: '8px 12px', gap: 8,
        fontSize: 11, fontWeight: 600, color: '#6b7280',
        textTransform: 'uppercase' as const, letterSpacing: '0.05em',
        borderBottom: '1px solid #f3f4f6',
      }}>
        <div>Agent</div>
        <div style={{ textAlign: 'center' as const }}>Total</div>
        <div style={{ textAlign: 'center' as const }}>Settled</div>
        <div style={{ textAlign: 'center' as const }}>F/O</div>
        <div style={{ textAlign: 'right' as const }}>Settled value</div>
      </div>
      {agentMap.map((agent, i) => (
        <div key={agent.name} style={{
          display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 90px',
          padding: '10px 12px', gap: 8, alignItems: 'center',
          background: i % 2 === 0 ? '#fff' : '#f9fafb',
          borderBottom: '1px solid #f3f4f6',
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{agent.name}</div>
          <div style={{ fontSize: 13, textAlign: 'center' as const, color: '#111827' }}>{agent.total}</div>
          <div style={{ fontSize: 13, textAlign: 'center' as const, color: '#059669', fontWeight: 500 }}>{agent.settled}</div>
          <div style={{ fontSize: 13, textAlign: 'center' as const, color: agent.fallenOver > 0 ? '#dc2626' : '#9ca3af' }}>
            {agent.fallenOver || '—'}
          </div>
          <div style={{ fontSize: 13, textAlign: 'right' as const, color: '#111827' }}>
            {agent.value > 0 ? fmt(agent.value) : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot availability breakdown
// ─────────────────────────────────────────────────────────────────────────────

function AvailabilityBreakdown({ project }: { project: ProjectDetail }) {
  const c = project.lot_counts
  const rows = [
    { label: 'Available',  value: c.available, colour: '#10b981', pct: c.total > 0 ? (c.available / c.total) * 100 : 0 },
    { label: 'On hold',    value: c.on_hold,   colour: '#f59e0b', pct: c.total > 0 ? (c.on_hold / c.total) * 100 : 0 },
    { label: 'Reserved+',  value: c.reserved,  colour: '#3b82f6', pct: c.total > 0 ? (c.reserved / c.total) * 100 : 0 },
    { label: 'Settled',    value: c.settled,   colour: '#6b7280', pct: c.total > 0 ? (c.settled / c.total) * 100 : 0 },
    { label: 'Draft',      value: c.draft,     colour: '#e5e7eb', pct: c.total > 0 ? (c.draft / c.total) * 100 : 0 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(({ label, value, colour, pct }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 80, fontSize: 12, color: '#6b7280', textAlign: 'right' as const, flexShrink: 0 }}>
            {label}
          </div>
          <div style={{ flex: 1, height: 20, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`, background: colour, borderRadius: 4,
              minWidth: value > 0 ? 20 : 0,
            }} />
          </div>
          <div style={{ width: 60, fontSize: 12, color: '#374151', fontWeight: 500, flexShrink: 0 }}>
            {value} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({Math.round(pct)}%)</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main tab component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProjectReportsTab({ project }: { project: ProjectDetail }) {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['project-sales', project.id],
    queryFn: () => fetchProjectSales(project.id),
    staleTime: 60_000,
  })

  const metrics = useMemo(() => {
    const contracted = ['reserved', 'contract_issued', 'exchanged']
    const contractedSales = sales.filter(s => contracted.includes(s.status))
    const settledSales    = sales.filter(s => s.status === 'settled')
    const fallenSales     = sales.filter(s => s.status === 'fallen_over')
    const activeSales     = sales.filter(s =>
      ['on_hold', 'pending', 'declined', 'reserved', 'contract_issued', 'exchanged'].includes(s.status)
    )

    const contractedGR = contractedSales.reduce((s, x) => s + (Number(x.sale_price) || 0), 0)
    const settledGR    = settledSales.reduce((s, x) => s + (Number(x.sale_price) || 0), 0)
    const totalKnownGR = contractedGR + settledGR
    const totalProjectGR = project.lot_counts.total_gr ? parseFloat(project.lot_counts.total_gr) : 0

    const completed    = settledSales.length + fallenSales.length
    const fallOverRate = completed > 0 ? Math.round((fallenSales.length / completed) * 100) : 0

    const priced       = settledSales.filter(s => s.sale_price)
    const avgPrice     = priced.length > 0
      ? priced.reduce((s, x) => s + Number(x.sale_price), 0) / priced.length
      : 0

    return {
      contractedGR, settledGR, totalKnownGR,
      activeSales: activeSales.length,
      settledCount: settledSales.length,
      fallenOverCount: fallenSales.length,
      fallOverRate, avgPrice,
    }
  }, [sales])

  if (isLoading) {
    return <div style={{ color: '#9ca3af', fontSize: 13 }}>Loading…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard
          label="Contracted GR"
          value={fmt(metrics.contractedGR)}
          sub="reserved + later"
          icon={DollarSign}
          colour="#f59e0b"
        />
        <KpiCard
          label="Settled GR"
          value={fmt(metrics.settledGR)}
          sub={`${metrics.settledCount} lots settled`}
          icon={TrendingUp}
          colour="#059669"
        />
        <KpiCard
          label="Active sales"
          value={String(metrics.activeSales)}
          sub={`of ${project.lot_counts.total} total lots`}
          icon={Home}
          colour="#3b82f6"
        />
        <KpiCard
          label="Fall-over rate"
          value={`${metrics.fallOverRate}%`}
          sub={`${metrics.fallenOverCount} fallen over`}
          icon={AlertTriangle}
          colour={metrics.fallOverRate > 20 ? '#dc2626' : '#6b7280'}
        />
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Availability */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 12, padding: '20px 24px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 16 }}>
            Lot availability
          </div>
          <AvailabilityBreakdown project={project} />
          <div style={{
            marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6',
            display: 'flex', justifyContent: 'space-between',
            fontSize: 12, color: '#6b7280',
          }}>
            <span>{project.lot_counts.total} total lots</span>
            <span style={{ color: '#10b981', fontWeight: 500 }}>
              {project.lot_counts.available} available now
            </span>
          </div>
        </div>

        {/* Pipeline */}
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 12, padding: '20px 24px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 16 }}>
            Sales pipeline
          </div>
          {sales.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af' }}>No sales recorded yet.</div>
          ) : (
            <PipelineFunnel sales={sales} />
          )}
        </div>
      </div>

      {/* Agent leaderboard */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Agent performance</div>
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <AgentLeaderboard sales={sales} />
        </div>
      </div>

    </div>
  )
}