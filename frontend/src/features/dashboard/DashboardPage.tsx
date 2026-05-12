// src/features/dashboard/DashboardPage.tsx
// Route: / (default landing page)

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Building2, FileText, Clock, TrendingUp, CheckSquare,
  Activity, ChevronRight, AlertCircle, ArrowRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import client from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import type { Sale } from '../../api/sales'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardData {
  user: { first_name: string; last_name: string; role_name: string | null }
  metrics: {
    total_lots: number
    on_market: number
    settled_lots: number
    active_sales: number
    expiring_soon: number
  }
  pipeline: Record<string, number>
  projects: Array<{
    id: string; name: string; status: string
    total_lots: number; settled_lots: number; active_sales: number; stage_count: number
  }>
  pending_approvals: Array<{
    id: string; buyer_name: string; buyer_initials: string
    lot_number: string; project_name: string; sale_price: string | null
  }>
  recent_activities: Array<{
    id: string; activity_type: string; subject: string; sale_id: string | null
    assigned_to_name: string | null; created_at: string
    completed_at: string | null; due_date: string | null
  }>
  my_tasks: Array<{
    id: string; subject: string; due_date: string | null
    sale_id: string | null; lot_number: string | null; project_name: string | null
  }>
  this_month: { new_sales: number; fallen_over: number; settled: number; revenue_settled: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await client.get<DashboardData>('/dashboard/')
  return data
}

async function fetchSales(): Promise<Sale[]> {
  const { data } = await client.get<any>('/sales/')
  return Array.isArray(data) ? data : (data.results ?? [])
}

function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboard, staleTime: 60_000 })
}

function useSales() {
  return useQuery({ queryKey: ['sales', 'all'], queryFn: fetchSales, staleTime: 60_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared card style
// ─────────────────────────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06)',
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatPrice(val: string | number | null): string {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`
  return `$${n.toLocaleString()}`
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

function formatDueDate(iso: string | null): { label: string; overdue: boolean } {
  if (!iso) return { label: 'No due date', overdue: false }
  const due = new Date(iso)
  const diffDays = Math.floor((due.getTime() - Date.now()) / 86_400_000)
  if (diffDays < 0)  return { label: 'Overdue', overdue: true }
  if (diffDays === 0) return { label: 'Today', overdue: true }
  if (diffDays === 1) return { label: 'Tomorrow', overdue: false }
  return { label: due.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }), overdue: false }
}

const ACTIVITY_ICON: Record<string, { icon: string; color: string; bg: string }> = {
  call:       { icon: 'ti-phone',    color: '#185FA5', bg: '#E6F1FB' },
  email:      { icon: 'ti-mail',     color: '#534AB7', bg: '#EEEDFE' },
  meeting:    { icon: 'ti-users',    color: '#185FA5', bg: '#E6F1FB' },
  inspection: { icon: 'ti-building', color: '#0F6E56', bg: '#E1F5EE' },
  task:       { icon: 'ti-checkbox', color: '#BA7517', bg: '#FAEEDA' },
  note:       { icon: 'ti-notes',    color: '#5F5E5A', bg: '#F1EFE8' },
}

const PIPELINE_STAGES = [
  { key: 'on_hold',         label: 'On hold',         color: '#FAC775' },
  { key: 'pending',         label: 'Pending',         color: '#EF9F27' },
  { key: 'reserved',        label: 'Reserved',        color: '#85B7EB' },
  { key: 'contract_issued', label: 'Contract issued', color: '#378ADD' },
  { key: 'exchanged',       label: 'Exchanged',       color: '#185FA5' },
  { key: 'settled',         label: 'Settled',         color: '#888780' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Chart data builder
// ─────────────────────────────────────────────────────────────────────────────

type ChartPeriod = 'daily' | 'weekly'

interface ChartBucket { label: string; reserved: number; exchanged: number; settled: number }

function buildChartData(sales: Sale[], period: ChartPeriod): ChartBucket[] {
  const now = new Date()
  const buckets = new Map<string, ChartBucket>()

  if (period === 'daily') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
      buckets.set(key, { label, reserved: 0, exchanged: 0, settled: 0 })
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i * 7)
      const day = d.getDay()
      d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
      buckets.set(key, { label, reserved: 0, exchanged: 0, settled: 0 })
    }
  }

  const keys = Array.from(buckets.keys()).sort()
  const earliest = keys[0]

  function getBucketKey(isoDate: string): string | null {
    if (!isoDate || isoDate < earliest) return null
    if (period === 'daily') return buckets.has(isoDate.slice(0, 10)) ? isoDate.slice(0, 10) : null
    const d = new Date(isoDate.slice(0, 10))
    const day = d.getDay()
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
    const weekKey = d.toISOString().slice(0, 10)
    return buckets.has(weekKey) ? weekKey : null
  }

  sales.forEach(sale => {
    const entries: Array<{ status: string; field: keyof ChartBucket; date: string | null }> = [
      { status: 'reserved',        field: 'reserved',  date: (sale as any).approved_at  ?? sale.created_at },
      { status: 'contract_issued', field: 'exchanged', date: (sale as any).exchange_date ?? sale.created_at },
      { status: 'exchanged',       field: 'exchanged', date: (sale as any).exchange_date ?? sale.created_at },
      { status: 'settled',         field: 'settled',   date: (sale as any).settled_at   ?? sale.created_at },
    ]
    entries.forEach(({ status, field, date }) => {
      if (sale.status === status && date) {
        const key = getBucketKey(date)
        if (key) (buckets.get(key)![field] as number)++
      }
    })
  })

  return keys.map(k => buckets.get(k)!)
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart tooltip
// ─────────────────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
  if (total === 0) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#374151', marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, flexShrink: 0 }} />
          {p.name}: <span style={{ fontWeight: 600, marginLeft: 2 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales over time chart
// ─────────────────────────────────────────────────────────────────────────────

function SalesOverTimeChart({ sales }: { sales: Sale[] }) {
  const [period, setPeriod] = useState<ChartPeriod>('weekly')
  const chartData = useMemo(() => buildChartData(sales, period), [sales, period])
  const hasData = chartData.some(b => b.reserved + b.exchanged + b.settled > 0)

  return (
    <div style={{ ...CARD_STYLE, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, color: '#111827' }}>
          <TrendingUp size={15} color="#6b7280" />
          Sales over time
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['daily', 'weekly'] as ChartPeriod[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              cursor: 'pointer', border: 'none',
              background: period === p ? '#111827' : '#f1f5f9',
              color: period === p ? '#fff' : '#6b7280',
              transition: 'all 0.15s',
            }}>
              {p === 'daily' ? 'Daily' : 'Weekly'}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
          No sales data in this period.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={chartData}
            barSize={period === 'daily' ? 8 : 18}
            barGap={2}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
              interval={period === 'daily' ? 4 : 1}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <Legend
              iconType="square"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingTop: 8 }}
            />
            <Bar dataKey="reserved"  name="Reserved"  fill="#85B7EB" radius={[3,3,0,0]} />
            <Bar dataKey="exchanged" name="Exchanged" fill="#185FA5" radius={[3,3,0,0]} />
            <Bar dataKey="settled"   name="Settled"   fill="#0F6E56" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Slide-out panel
// ─────────────────────────────────────────────────────────────────────────────

function SlidePanel({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode
}) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40,
        opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 220ms ease',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 440,
        background: '#fff', zIndex: 50, display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: open ? '-8px 0 32px rgba(0,0,0,0.12)' : 'none',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '0.5px solid #e5e7eb', flexShrink: 0,
        }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{title}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#6b7280' }}>
            <i className="ti ti-x" style={{ fontSize: 18 }} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>{children}</div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, valueColor, icon, alert }: {
  label: string; value: string | number; sub?: string
  valueColor?: string; icon: React.ReactNode; alert?: boolean
}) {
  return (
    <div style={{
      ...CARD_STYLE,
      padding: '14px 16px',
      background: alert ? '#FFF7ED' : '#ffffff',
      border: alert ? '1px solid #FED7AA' : '1px solid #e2e8f0',
      boxShadow: alert ? '0 1px 3px rgba(251,146,60,0.12), 0 4px 12px rgba(251,146,60,0.08)' : CARD_STYLE.boxShadow,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ color: '#6b7280', display: 'flex' }}>{icon}</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, color: valueColor ?? '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ ...CARD_STYLE, padding: '16px 20px', ...style }}>{children}</div>
}

function CardHeader({ title, icon, action, onAction }: {
  title: string; icon: React.ReactNode; action?: string; onAction?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 500, color: '#111827' }}>
        <span style={{ color: '#6b7280', display: 'flex' }}>{icon}</span>
        {title}
      </div>
      {action && (
        <button onClick={onAction} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3, padding: 0,
        }}>
          {action} <ArrowRight size={11} />
        </button>
      )}
    </div>
  )
}

function Divider() {
  return <div style={{ height: '0.5px', background: '#f3f4f6', margin: '0 -20px' }} />
}

function Initials({ text, size = 28 }: { text: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#EFF6FF', color: '#1D4ED8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 500, flexShrink: 0,
    }}>
      {text}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)
  const { data, isLoading, isError } = useDashboard()
  const { data: sales = [] } = useSales()

  const [panel, setPanel] = useState<null | 'pipeline' | 'activities' | 'tasks'>(null)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1,2,3].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: '#f3f4f6' }} />)}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#9ca3af' }}>
        <AlertCircle size={32} />
        <p style={{ fontSize: 14 }}>Could not load dashboard. Please refresh.</p>
      </div>
    )
  }

  const m = data.metrics
  const totalPipeline = Object.values(data.pipeline).reduce((a, b) => a + b, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>

      {/* Header */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '20px 24px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, color: '#111827' }}>
              {greeting}, {user?.first_name}
            </h1>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>
              Here's what's happening across your portfolio
            </p>
          </div>
          <div style={{
            fontSize: 12, color: '#6b7280', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Clock size={13} />
            {today}
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
          <MetricCard
            label="Lots on market" value={m.on_market}
            sub={`of ${m.total_lots} total · ${m.settled_lots} settled`}
            icon={<Building2 size={14} />}
          />
          <MetricCard
            label="Active sales" value={m.active_sales}
            sub={`${data.pending_approvals.length} pending approval`}
            valueColor={m.active_sales > 0 ? '#B45309' : '#111827'}
            icon={<FileText size={14} />}
          />
          <MetricCard
            label="New this month" value={`+${data.this_month.new_sales}`}
            sub={`${data.this_month.fallen_over} fallen over`}
            valueColor="#0F6E56"
            icon={<TrendingUp size={14} />}
          />
          <MetricCard
            label="On hold expiring" value={m.expiring_soon}
            sub="within 4 hours"
            valueColor={m.expiring_soon > 0 ? '#B91C1C' : '#111827'}
            alert={m.expiring_soon > 0}
            icon={<Clock size={14} />}
          />
        </div>

        {/* ── Sales over time chart ── */}
        <SalesOverTimeChart sales={sales} />

        {/* Main two-column */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Pipeline + Pending approvals */}
          <SectionCard>
            <CardHeader
              title="Sales pipeline" icon={<Activity size={15} />}
              action="View all" onAction={() => navigate('/sales')}
            />
            {totalPipeline > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 3, height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                  {PIPELINE_STAGES.map(({ key, color }) => {
                    const count = data.pipeline[key] ?? 0
                    return count > 0 ? <div key={key} style={{ flex: count, background: color, minWidth: 4 }} /> : null
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginBottom: 14 }}>
                  {PIPELINE_STAGES.map(({ key, label, color }) => {
                    const count = data.pipeline[key] ?? 0
                    return count > 0 ? (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        {label} ({count})
                      </div>
                    ) : null
                  })}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>No active sales.</p>
            )}

            {data.pending_approvals.length > 0 && (
              <>
                <Divider />
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Pending approval
                  </p>
                  {data.pending_approvals.map(sale => (
                    <div key={sale.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #f3f4f6' }}>
                      <Initials text={sale.buyer_initials} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sale.buyer_name}
                        </p>
                        <p style={{ fontSize: 11, color: '#6b7280' }}>
                          Lot {sale.lot_number} · {formatPrice(sale.sale_price)} · {sale.project_name}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(`/sales?highlight=${sale.id}`)}
                        style={{
                          fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 6,
                          background: '#EAF3DE', color: '#3B6D11', border: '0.5px solid #C0DD97',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        Review
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          {/* Recent activity */}
          <SectionCard>
            <CardHeader
              title="Recent activity" icon={<Activity size={15} />}
              action="View all" onAction={() => navigate('/activities')}
            />
            {data.recent_activities.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No recent activity.</p>
            ) : (
              data.recent_activities.map((a, i) => {
                const actStyle = ACTIVITY_ICON[a.activity_type] ?? ACTIVITY_ICON.note
                return (
                  <div key={a.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0',
                    borderBottom: i < data.recent_activities.length - 1 ? '0.5px solid #f3f4f6' : 'none',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: actStyle.bg, color: actStyle.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <i className={`ti ${actStyle.icon}`} style={{ fontSize: 13 }} aria-hidden="true" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.subject}
                      </p>
                      {a.assigned_to_name && <p style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{a.assigned_to_name}</p>}
                    </div>
                    <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeAgo(a.created_at)}
                    </span>
                  </div>
                )
              })
            )}
          </SectionCard>
        </div>

        {/* Bottom three-column */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

          {/* Projects */}
          <SectionCard>
            <CardHeader title="Projects" icon={<Building2 size={15} />} action="View all" onAction={() => navigate('/projects')} />
            {data.projects.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No active projects.</p>
            ) : (
              data.projects.map((p, i) => (
                <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer',
                  borderBottom: i < data.projects.length - 1 ? '0.5px solid #f3f4f6' : 'none',
                }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Building2 size={16} color="#9ca3af" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#111827' }}>{p.name}</p>
                    <p style={{ fontSize: 11, color: '#6b7280' }}>{p.total_lots} lots · {p.stage_count} stage{p.stage_count !== 1 ? 's' : ''}</p>
                    <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: '#378ADD', width: `${Math.round((p.settled_lots / Math.max(p.total_lots, 1)) * 100)}%` }} />
                    </div>
                  </div>
                  <ChevronRight size={14} color="#d1d5db" />
                </div>
              ))
            )}
          </SectionCard>

          {/* My tasks */}
          <SectionCard>
            <CardHeader
              title="My tasks" icon={<CheckSquare size={15} />}
              action={data.my_tasks.length > 0 ? `${data.my_tasks.length} open` : undefined}
              onAction={() => navigate('/activities')}
            />
            {data.my_tasks.length === 0 ? (
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No open tasks.</p>
            ) : (
              data.my_tasks.map((t, i) => {
                const { label, overdue } = formatDueDate(t.due_date)
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < data.my_tasks.length - 1 ? '0.5px solid #f3f4f6' : 'none' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid #d1d5db', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</p>
                      {t.lot_number && <p style={{ fontSize: 11, color: '#9ca3af' }}>Lot {t.lot_number} · {t.project_name}</p>}
                    </div>
                    <span style={{ fontSize: 11, color: overdue ? '#B91C1C' : '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
                  </div>
                )
              })
            )}
          </SectionCard>

          {/* This month */}
          <SectionCard>
            <CardHeader title="This month" icon={<TrendingUp size={15} />} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'New sales',       value: `+${data.this_month.new_sales}`,              color: '#0F6E56' },
                { label: 'Fallen over',     value: data.this_month.fallen_over,                  color: data.this_month.fallen_over > 0 ? '#B91C1C' : '#111827' },
                { label: 'Settled',         value: data.this_month.settled,                      color: '#111827' },
                { label: 'Revenue settled', value: formatPrice(data.this_month.revenue_settled), color: '#185FA5' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9',
                }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
                  <span style={{ fontSize: 15, fontWeight: 500, color }}>{value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <SlidePanel open={panel !== null} onClose={() => setPanel(null)} title="Details">
        <p style={{ fontSize: 13, color: '#6b7280' }}>Detail view coming soon.</p>
      </SlidePanel>
    </div>
  )
}