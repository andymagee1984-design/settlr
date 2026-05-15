// src/features/reports/ReportsPage.tsx
// Route: /reports
// Org-level reporting dashboard — all projects rollup + per-project breakdown.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Home, DollarSign, AlertTriangle, ChevronRight } from 'lucide-react'
import client from '../../api/client'
import type { Sale } from '../../api/sales'
import type { ProjectListItem } from '../projects/types'

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchProjects(): Promise<ProjectListItem[]> {
  const { data } = await client.get<{ results: ProjectListItem[] }>('/projects/')
  return data.results
}

async function fetchSales(): Promise<Sale[]> {
  const { data } = await client.get<any>('/sales/')
  return Array.isArray(data) ? data : (data.results ?? [])
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}k`
  return `$${n}`
}

const ACTIVE_STATUSES     = ['on_hold', 'pending', 'declined', 'reserved', 'contract_issued', 'exchanged']
const CONTRACTED_STATUSES = ['reserved', 'contract_issued', 'exchanged']

interface ProjectMetrics {
  project: ProjectListItem
  totalGR: number
  contractedGR: number
  settledGR: number
  activeSales: number
  settledCount: number
  fallenOverCount: number
  fallOverRate: number
  avgSalePrice: number
  sales: Sale[]
}

function computeProjectMetrics(project: ProjectListItem, allSales: Sale[]): ProjectMetrics {
  const sales = allSales.filter(s => s.project_name === project.name)

  const activeSales     = sales.filter(s => ACTIVE_STATUSES.includes(s.status))
  const contractedSales = sales.filter(s => CONTRACTED_STATUSES.includes(s.status))
  const settledSales    = sales.filter(s => s.status === 'settled')
  const fallenSales     = sales.filter(s => s.status === 'fallen_over')
  const completedSales  = [...settledSales, ...fallenSales]

  const contractedGR = contractedSales.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0)
  const settledGR    = settledSales.reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0)
  const fallOverRate = completedSales.length > 0
    ? Math.round((fallenSales.length / completedSales.length) * 100)
    : 0

  const priced = settledSales.filter(s => s.sale_price)
  const avgSalePrice = priced.length > 0
    ? priced.reduce((sum, s) => sum + Number(s.sale_price), 0) / priced.length
    : 0

  const totalGR = contractedGR + settledGR

  return {
    project, totalGR, contractedGR, settledGR,
    activeSales: activeSales.length,
    settledCount: settledSales.length,
    fallenOverCount: fallenSales.length,
    fallOverRate, avgSalePrice, sales,
  }
}

// Shared card shadow
const CARD_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e8e2dd',
  borderRadius: 12,
  boxShadow: '0 1px 2px rgba(44,36,32,0.06), 0 2px 8px rgba(44,36,32,0.06)',
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, colour }: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  colour: string
}) {
  return (
    <div style={{
      ...CARD_STYLE,
      padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#7a6e68' }}>{label}</div>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: colour + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} color={colour} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 700, color: '#2c2420', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: '#a89e98', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline funnel bar
// ─────────────────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'on_hold',         label: 'On Hold',         colour: '#d4920e' },
  { key: 'pending',         label: 'Pending',         colour: '#4a72c4' },
  { key: 'reserved',        label: 'Reserved',        colour: '#7a5ca0' },
  { key: 'contract_issued', label: 'Contract Issued', colour: '#c0533a' },
  { key: 'exchanged',       label: 'Exchanged',       colour: '#52a96e' },
  { key: 'settled',         label: 'Settled',         colour: '#237a3d' },
]

function PipelineFunnel({ sales }: { sales: Sale[] }) {
  const counts = PIPELINE_STAGES.map(stage => ({
    ...stage,
    count: sales.filter(s => s.status === stage.key).length,
    value: sales.filter(s => s.status === stage.key).reduce((sum, s) => sum + (Number(s.sale_price) || 0), 0),
  }))
  const max = Math.max(...counts.map(c => c.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {counts.map(({ key, label, colour, count, value }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 100, fontSize: 12, color: '#7a6e68', textAlign: 'right' as const, flexShrink: 0 }}>
            {label}
          </div>
          <div style={{ flex: 1, height: 28, background: '#f0ebe6', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(count / max) * 100}%`,
              background: colour, borderRadius: 6, minWidth: count > 0 ? 28 : 0,
              display: 'flex', alignItems: 'center', paddingLeft: 8,
              transition: 'width 0.3s',
            }}>
              {count > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{count}</span>
              )}
            </div>
          </div>
          <div style={{ width: 80, fontSize: 12, color: '#a89e98', textAlign: 'right' as const, flexShrink: 0 }}>
            {value > 0 ? fmt(value) : '—'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot availability bar
// ─────────────────────────────────────────────────────────────────────────────

function AvailabilityBar({ counts }: { counts: ProjectListItem['lot_counts'] }) {
  const { total, available, on_hold, reserved, settled, draft } = counts
  if (total === 0) return <div style={{ height: 8, background: '#f0ebe6', borderRadius: 4 }} />
  const segments = [
    { key: 'available', value: available, colour: '#52a96e' },
    { key: 'on_hold',   value: on_hold,   colour: '#d4920e' },
    { key: 'reserved',  value: reserved,  colour: '#4a72c4' },
    { key: 'settled',   value: settled,   colour: '#8a8280' },
    { key: 'draft',     value: draft,     colour: '#ddd7d2' },
  ].filter(s => s.value > 0)

  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
      {segments.map(({ key, value, colour }) => (
        <div key={key} style={{
          height: '100%', background: colour,
          width: `${(value / total) * 100}%`,
        }} />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-project row
// ─────────────────────────────────────────────────────────────────────────────

function ProjectRow({ metrics, onClick }: { metrics: ProjectMetrics; onClick: () => void }) {
  const { project: p, contractedGR, settledGR, activeSales, settledCount, fallenOverCount, fallOverRate } = metrics
  const c = p.lot_counts
  const onMarket = c.available + c.on_hold + c.reserved

  return (
    <tr
      onClick={onClick}
      style={{ borderBottom: '1px solid #f0ebe6', cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f9f6f4')}
      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
    >
      <td style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2420' }}>{p.name}</div>
        <div style={{ fontSize: 11, color: '#a89e98', marginTop: 2 }}>{p.address}</div>
        <div style={{ marginTop: 6, width: 160 }}>
          <AvailabilityBar counts={c} />
        </div>
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'center' as const }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2420' }}>{c.total}</div>
        <div style={{ fontSize: 11, color: '#a89e98' }}>{onMarket} on market</div>
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'center' as const }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2420' }}>{activeSales}</div>
        <div style={{ fontSize: 11, color: '#a89e98' }}>{settledCount} settled</div>
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'right' as const }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#c0533a' }}>
          {metrics.project.lot_counts.total_gr ? fmt(parseFloat(metrics.project.lot_counts.total_gr)) : '—'}
        </div>
        <div style={{ fontSize: 11, color: '#a89e98' }}>project GR</div>
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'right' as const }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2420' }}>
          {contractedGR > 0 ? fmt(contractedGR) : '—'}
        </div>
        <div style={{ fontSize: 11, color: '#a89e98' }}>contracted</div>
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'right' as const }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#237a3d' }}>
          {settledGR > 0 ? fmt(settledGR) : '—'}
        </div>
        <div style={{ fontSize: 11, color: '#a89e98' }}>settled GR</div>
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'center' as const }}>
        {fallenOverCount > 0 ? (
          <span style={{
            fontSize: 12, fontWeight: 500,
            color: fallOverRate > 20 ? '#882010' : '#7a6e68',
            background: fallOverRate > 20 ? '#fdf0ee' : '#f2f0ee',
            padding: '2px 8px', borderRadius: 20,
          }}>
            {fallOverRate}% ({fallenOverCount})
          </span>
        ) : (
          <span style={{ fontSize: 12, color: '#a89e98' }}>—</span>
        )}
      </td>
      <td style={{ padding: '14px 16px', textAlign: 'center' as const }}>
        <ChevronRight size={16} color="#d4ccc5" />
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: fetchProjects,
    staleTime: 60_000,
  })

  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['sales'],
    queryFn: fetchSales,
    staleTime: 60_000,
  })

  const isLoading = loadingProjects || loadingSales

  const filteredProjects = useMemo(() =>
    statusFilter === 'active'
      ? projects.filter(p => p.status === 'active')
      : projects,
    [projects, statusFilter]
  )

  const allMetrics = useMemo(() =>
    filteredProjects.map(p => computeProjectMetrics(p, sales)),
    [filteredProjects, sales]
  )

  const orgMetrics = useMemo(() => {
    const totalLots         = allMetrics.reduce((s, m) => s + m.project.lot_counts.total, 0)
    const totalAvailable    = allMetrics.reduce((s, m) => s + m.project.lot_counts.available, 0)
    const totalActiveSales  = allMetrics.reduce((s, m) => s + m.activeSales, 0)
    const totalSettledGR    = allMetrics.reduce((s, m) => s + m.settledGR, 0)
    const totalContractedGR = allMetrics.reduce((s, m) => s + m.contractedGR, 0)
    const totalFallenOver   = allMetrics.reduce((s, m) => s + m.fallenOverCount, 0)
    const totalSettled      = allMetrics.reduce((s, m) => s + m.settledCount, 0)
    const fallOverRate      = (totalFallenOver + totalSettled) > 0
      ? Math.round((totalFallenOver / (totalFallenOver + totalSettled)) * 100)
      : 0
    const totalProjectGR    = allMetrics.reduce((s, m) => {
      const gr = m.project.lot_counts.total_gr
      return s + (gr ? parseFloat(gr) : 0)
    }, 0)
    return { totalLots, totalAvailable, totalActiveSales, totalSettledGR, totalContractedGR, totalFallenOver, fallOverRate, totalProjectGR }
  }, [allMetrics])

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400, background: '#f9f6f4', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2c2420', margin: 0 }}>Reports</h1>
          <div style={{ fontSize: 13, color: '#7a6e68', marginTop: 4 }}>
            Organisation performance overview
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['active', 'all'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              cursor: 'pointer', border: 'none',
              background: statusFilter === f ? '#3d4a5c' : '#e8e2dd',
              color: statusFilter === f ? '#fff' : '#5a4e48',
              fontFamily: 'var(--font-body)',
            }}>
              {f === 'active' ? 'Active projects' : 'All projects'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div style={{ color: '#a89e98', fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          {/* Org KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <KpiCard
              label="Total lots"
              value={String(orgMetrics.totalLots)}
              sub={`${orgMetrics.totalAvailable} available`}
              icon={Home}
              colour="#4a72c4"
            />
            <KpiCard
              label="Active sales"
              value={String(orgMetrics.totalActiveSales)}
              sub={`${allMetrics.reduce((s, m) => s + m.settledCount, 0)} settled`}
              icon={TrendingUp}
              colour="#52a96e"
            />
            <KpiCard
              label="Contracted GR"
              value={fmt(orgMetrics.totalContractedGR)}
              sub={`${fmt(orgMetrics.totalSettledGR)} settled`}
              icon={DollarSign}
              colour="#d4920e"
            />
            <KpiCard
              label="Project GR"
              value={fmt(orgMetrics.totalProjectGR)}
              sub="all lots at current prices"
              icon={DollarSign}
              colour="#c0533a"
            />
            <KpiCard
              label="Fall-over rate"
              value={`${orgMetrics.fallOverRate}%`}
              sub={`${orgMetrics.totalFallenOver} fallen over`}
              icon={AlertTriangle}
              colour={orgMetrics.fallOverRate > 20 ? '#882010' : '#8a8280'}
            />
          </div>

          {/* Pipeline funnel */}
          <div style={{ ...CARD_STYLE, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2420', marginBottom: 16 }}>
              Sales pipeline — all projects
            </div>
            <PipelineFunnel sales={sales} />
          </div>

          {/* Per-project table */}
          <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0ebe6' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#2c2420' }}>
                Project breakdown
              </div>
            </div>
            {allMetrics.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#a89e98', fontSize: 14 }}>
                No projects found.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9f6f4', borderBottom: '1px solid #e8e2dd' }}>
                    {['Project', 'Lots', 'Sales', 'Project GR', 'Contracted GR', 'Settled GR', 'Fall-over', ''].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', fontSize: 11, fontWeight: 600,
                        color: '#7a6e68', textAlign: h === 'Project' ? 'left' as const : 'center' as const,
                        textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allMetrics.map(metrics => (
                    <ProjectRow
                      key={metrics.project.id}
                      metrics={metrics}
                      onClick={() => navigate(`/projects/${metrics.project.id}`)}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f9f6f4', borderTop: '2px solid #e8e2dd' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#2c2420' }}>
                      Total ({filteredProjects.length} projects)
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' as const, fontSize: 12, fontWeight: 700, color: '#2c2420' }}>
                      {orgMetrics.totalLots}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' as const, fontSize: 12, fontWeight: 700, color: '#2c2420' }}>
                      {orgMetrics.totalActiveSales}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' as const, fontSize: 12, fontWeight: 700, color: '#c0533a' }}>
                      {fmt(orgMetrics.totalProjectGR)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' as const, fontSize: 12, fontWeight: 700, color: '#2c2420' }}>
                      {fmt(orgMetrics.totalContractedGR)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' as const, fontSize: 12, fontWeight: 700, color: '#237a3d' }}>
                      {fmt(orgMetrics.totalSettledGR)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' as const, fontSize: 12, fontWeight: 700, color: '#2c2420' }}>
                      {orgMetrics.fallOverRate}%
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}