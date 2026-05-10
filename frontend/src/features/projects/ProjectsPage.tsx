import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getProjects, getLots } from '../../api/projects'
import type { Lot, Project } from '../../api/projects'
import NewSaleModal from '../sales/NewSaleModal'

const STATUS_COLOURS: Record<string, { bg: string; color: string; label: string }> = {
  draft:           { bg: '#f3f4f6', color: '#6b7280', label: 'Draft' },
  available:       { bg: '#dcfce7', color: '#166534', label: 'Available' },
  on_hold:         { bg: '#fef9c3', color: '#854d0e', label: 'On Hold' },
  reserved:        { bg: '#dbeafe', color: '#1e40af', label: 'Reserved' },
  contract_issued: { bg: '#ede9fe', color: '#5b21b6', label: 'Contract Issued' },
  exchanged:       { bg: '#ffedd5', color: '#9a3412', label: 'Exchanged' },
  settled:         { bg: '#d1fae5', color: '#065f46', label: 'Settled' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLOURS[status] ?? { bg: '#f3f4f6', color: '#6b7280', label: status }
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 500,
      padding: '2px 8px', borderRadius: 20,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function LotCard({ lot, onRegister }: { lot: Lot; onRegister?: () => void }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
      padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Lot {lot.lot_number}</div>
        <StatusBadge status={lot.status} />
      </div>
      <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>
        {lot.lot_type.replace(/_/g, ' ')}
      </div>
      {lot.current_price && (
        <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
          ${Number(lot.current_price).toLocaleString()}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6b7280' }}>
        {lot.bedrooms != null && <span><i className="ti ti-bed" /> {lot.bedrooms}</span>}
        {lot.bathrooms != null && <span><i className="ti ti-bath" /> {lot.bathrooms}</span>}
        {lot.car_spaces != null && <span><i className="ti ti-car" /> {lot.car_spaces}</span>}
        {lot.land_area != null && <span>{lot.land_area}m²</span>}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>{lot.stage_name}</div>
      {lot.status === 'available' && onRegister && (
        <button onClick={onRegister} style={{
          marginTop: 4, padding: '6px 0', borderRadius: 6, fontSize: 12,
          fontWeight: 500, background: '#111827', color: '#fff',
          border: 'none', cursor: 'pointer', width: '100%',
        }}>
          Register Sale
        </button>
      )}
    </div>
  )
}

function LotRow({ lot, onRegister }: { lot: Lot; onRegister?: () => void }) {
  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500, color: '#111827' }}>
        Lot {lot.lot_number}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>
        {lot.lot_type.replace(/_/g, ' ')}
      </td>
      <td style={{ padding: '10px 12px' }}><StatusBadge status={lot.status} /></td>
      <td style={{ padding: '10px 12px', fontSize: 13, color: '#111827' }}>
        {lot.current_price ? `$${Number(lot.current_price).toLocaleString()}` : '—'}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>
        {([
          lot.bedrooms != null && `${lot.bedrooms}bd`,
          lot.bathrooms != null && `${lot.bathrooms}ba`,
          lot.car_spaces != null && `${lot.car_spaces}car`,
        ] as (string | false)[]).filter((x): x is string => Boolean(x)).join(' · ') || '—'}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280' }}>
        {lot.land_area ? `${lot.land_area}m²` : '—'}
      </td>
      <td style={{ padding: '10px 12px', fontSize: 12, color: '#9ca3af' }}>{lot.stage_name}</td>
      <td style={{ padding: '10px 12px' }}>
        {lot.status === 'available' && onRegister && (
          <button onClick={onRegister} style={{
            padding: '4px 10px', borderRadius: 5, fontSize: 11, fontWeight: 500,
            background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            Register
          </button>
        )}
      </td>
    </tr>
  )
}

export default function ProjectsPage() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [view, setView] = useState<'grid' | 'table'>('grid')
  const [saleTarget, setSaleTarget] = useState<Lot | null>(null)

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: getProjects,
  })

  const { data: lots = [], isLoading } = useQuery<Lot[]>({
    queryKey: ['lots', selectedProject, statusFilter],
    queryFn: () => getLots({ ...(statusFilter && { status: statusFilter }) }),
  })

  const filteredLots: Lot[] = selectedProject
    ? lots.filter((l: Lot) => l.project_name === projects.find((p: Project) => p.id === selectedProject)?.name)
    : lots

  const statusCounts = lots.reduce<Record<string, number>>((acc, l: Lot) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1400 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Projects</h1>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Lot availability across all active projects
        </div>
      </div>

      {/* Project tabs */}
      {projects.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedProject(null)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              background: selectedProject === null ? '#111827' : '#f3f4f6',
              color: selectedProject === null ? '#fff' : '#374151',
              border: 'none', fontWeight: 500,
            }}
          >
            All projects
          </button>
          {projects.map((p: Project) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p.id)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                background: selectedProject === p.id ? '#111827' : '#f3f4f6',
                color: selectedProject === p.id ? '#fff' : '#374151',
                border: 'none', fontWeight: 500,
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Status filter pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => setStatusFilter('')}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
            background: statusFilter === '' ? '#111827' : '#f3f4f6',
            color: statusFilter === '' ? '#fff' : '#374151',
            border: 'none', fontWeight: 500,
          }}
        >
          All ({lots.length})
        </button>
        {Object.entries(statusCounts).map(([s, count]) => {
          const sc = STATUS_COLOURS[s]
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? '' : s)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: statusFilter === s ? sc?.bg ?? '#f3f4f6' : '#f3f4f6',
                color: statusFilter === s ? sc?.color ?? '#374151' : '#374151',
                border: statusFilter === s ? `1px solid ${sc?.color ?? '#374151'}` : '1px solid transparent',
                fontWeight: 500,
              }}
            >
              {sc?.label ?? s} ({count})
            </button>
          )
        })}
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        <button
          onClick={() => setView('grid')}
          style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb',
            background: view === 'grid' ? '#111827' : '#fff',
            color: view === 'grid' ? '#fff' : '#6b7280',
            cursor: 'pointer',
          }}
        >
          <i className="ti ti-layout-grid" />
        </button>
        <button
          onClick={() => setView('table')}
          style={{
            padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb',
            background: view === 'table' ? '#111827' : '#fff',
            color: view === 'table' ? '#fff' : '#6b7280',
            cursor: 'pointer',
          }}
        >
          <i className="ti ti-table" />
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading lots…</div>
      ) : filteredLots.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>No lots found.</div>
      ) : view === 'grid' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {filteredLots.map((lot: Lot) => (
            <LotCard key={lot.id} lot={lot} onRegister={() => setSaleTarget(lot)} />
          ))}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Lot', 'Type', 'Status', 'Price', 'Specs', 'Land', 'Stage', ''].map((h) => (
                  <th key={h} style={{
                    padding: '10px 12px', fontSize: 11, fontWeight: 600,
                    color: '#6b7280', textAlign: 'left', textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredLots.map((lot: Lot) => (
                <LotRow key={lot.id} lot={lot} onRegister={() => setSaleTarget(lot)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {saleTarget && (
        <NewSaleModal lot={saleTarget} onClose={() => setSaleTarget(null)} />
      )}
    </div>
  )
}