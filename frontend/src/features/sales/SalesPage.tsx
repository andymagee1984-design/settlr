import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSales } from '../../api/sales'
import type { Sale } from '../../api/sales'

const STATUS_COLOURS: Record<string, { bg: string; color: string; label: string }> = {
  on_hold:         { bg: '#fef9c3', color: '#854d0e', label: 'On Hold' },
  pending:         { bg: '#dbeafe', color: '#1e40af', label: 'Pending Approval' },
  declined:        { bg: '#fee2e2', color: '#991b1b', label: 'Declined' },
  reserved:        { bg: '#ede9fe', color: '#5b21b6', label: 'Reserved' },
  contract_issued: { bg: '#ffedd5', color: '#9a3412', label: 'Contract Issued' },
  exchanged:       { bg: '#d1fae5', color: '#065f46', label: 'Exchanged' },
  settled:         { bg: '#f0fdf4', color: '#166534', label: 'Settled' },
  fallen_over:     { bg: '#f3f4f6', color: '#6b7280', label: 'Fallen Over' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLOURS[status] ?? { bg: '#f3f4f6', color: '#6b7280', label: status }
  return (
    <span style={{
      background: s.bg, color: s.color, fontSize: 11, fontWeight: 500,
      padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function OnHoldTimer({ expiry }: { expiry: string }) {
  const expires = new Date(expiry)
  const now = new Date()
  const diffMs = expires.getTime() - now.getTime()
  const diffHrs = Math.floor(diffMs / 1000 / 60 / 60)
  const diffMins = Math.floor((diffMs / 1000 / 60) % 60)

  if (diffMs <= 0) return <span style={{ fontSize: 11, color: '#dc2626' }}>Expired</span>

  const urgent = diffHrs < 2
  return (
    <span style={{ fontSize: 11, color: urgent ? '#dc2626' : '#854d0e', fontWeight: urgent ? 600 : 400 }}>
      <i className="ti ti-clock" style={{ marginRight: 3 }} />
      {diffHrs}h {diffMins}m remaining
    </span>
  )
}

export default function SalesPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')

  const { data: sales = [], isLoading } = useQuery<Sale[]>({
    queryKey: ['sales'],
    queryFn: getSales,
  })

  const filtered = statusFilter
    ? sales.filter((s) => s.status === statusFilter)
    : sales.filter((s) => s.status !== 'fallen_over')

  const statusCounts = sales.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1
    return acc
  }, {})

  const activeStatuses = ['on_hold', 'pending', 'declined', 'reserved', 'contract_issued', 'exchanged']

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Sales</h1>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Active sales pipeline
        </div>
      </div>

      {/* Status filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={() => setStatusFilter('')}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            background: statusFilter === '' ? '#111827' : '#f3f4f6',
            color: statusFilter === '' ? '#fff' : '#374151',
            border: 'none', fontWeight: 500,
          }}
        >
          Active ({sales.filter(s => activeStatuses.includes(s.status)).length})
        </button>
        {activeStatuses.filter(s => statusCounts[s]).map((s) => {
          const sc = STATUS_COLOURS[s]
          return (
            <button key={s} onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: statusFilter === s ? sc?.bg ?? '#f3f4f6' : '#f3f4f6',
                color: statusFilter === s ? sc?.color ?? '#374151' : '#374151',
                border: statusFilter === s ? `1px solid ${sc?.color ?? '#374151'}` : '1px solid transparent',
                fontWeight: 500,
              }}
            >
              {sc?.label ?? s} ({statusCounts[s]})
            </button>
          )
        })}
        <button
          onClick={() => setStatusFilter(statusFilter === 'fallen_over' ? '' : 'fallen_over')}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            background: statusFilter === 'fallen_over' ? '#f3f4f6' : '#f3f4f6',
            color: '#6b7280', border: '1px solid transparent', fontWeight: 500,
            marginLeft: 'auto',
          }}
        >
          Fallen Over ({statusCounts['fallen_over'] ?? 0})
        </button>
      </div>

      {/* Sales list */}
      {isLoading ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading sales…</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>No sales found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((sale) => (
            <SaleCard key={sale.id} sale={sale} />
          ))}
        </div>
      )}
    </div>
  )
}

function SaleCard({ sale }: { sale: Sale }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      {/* Lot + project */}
      <div style={{ minWidth: 140 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
          Lot {sale.lot_number}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
          {sale.project_name}
        </div>
      </div>

      {/* Buyer */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>
          {sale.primary_buyer_name}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
          {sale.sale_price ? `$${Number(sale.sale_price).toLocaleString()}` : 'Price TBC'}
        </div>
      </div>

      {/* Timer for on hold */}
      <div style={{ minWidth: 120 }}>
        {sale.status === 'on_hold' && sale.on_hold_expiry && (
          <OnHoldTimer expiry={sale.on_hold_expiry} />
        )}
      </div>

      {/* Status */}
      <div>
        <StatusBadge status={sale.status} />
      </div>

      {/* Created date */}
      <div style={{ fontSize: 11, color: '#9ca3af', minWidth: 80, textAlign: 'right' }}>
        {new Date(sale.created_at).toLocaleDateString('en-AU')}
      </div>
    </div>
  )
}