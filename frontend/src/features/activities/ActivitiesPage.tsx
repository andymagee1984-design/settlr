// src/features/activities/ActivitiesPage.tsx

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getActivities, completeActivity } from '../../api/activities'
import ActivityDetailPanel from '../../components/ActivityDetailPanel'
import LogActivityForm from '../../components/LogActivityForm'
import type { Activity } from '../../api/activities'

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  call:       { label: 'Call',       icon: 'ti-phone',       color: '#3b82f6' },
  email:      { label: 'Email',      icon: 'ti-mail',        color: '#8b5cf6' },
  meeting:    { label: 'Meeting',    icon: 'ti-calendar',    color: '#f59e0b' },
  inspection: { label: 'Inspection', icon: 'ti-home-search', color: '#06b6d4' },
  task:       { label: 'Task',       icon: 'ti-checkbox',    color: '#111827' },
  note:       { label: 'Note',       icon: 'ti-note',        color: '#6b7280' },
}

function ActivityRow({ activity, onComplete, onClick }: {
  activity:   Activity
  onComplete: (id: string) => void
  onClick:    (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const tc = TYPE_CONFIG[activity.activity_type] ?? { label: activity.activity_type, icon: 'ti-circle', color: '#6b7280' }
  const isTask    = activity.activity_type === 'task'
  const isOverdue = isTask && !activity.is_complete && activity.due_date && new Date(activity.due_date) < new Date()

  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
      padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start',
      opacity: activity.is_complete ? 0.6 : 1,
      cursor: 'pointer',
    }}
      onClick={() => onClick(activity.id)}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: tc.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`ti ${tc.icon}`} style={{ color: tc.color, fontSize: 15 }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
              style={{
                fontSize: 13, fontWeight: 600, color: '#111827',
                textDecoration: activity.is_complete ? 'line-through' : 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {activity.subject}
              <i className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'}`}
                style={{ fontSize: 10, color: '#9ca3af' }} />
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
              <span style={{
                background: tc.color + '15', color: tc.color,
                fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 10, marginRight: 6,
              }}>
                {tc.label}
              </span>
              {activity.assigned_to_name && `Assigned to ${activity.assigned_to_name}`}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              {new Date(activity.activity_date).toLocaleDateString('en-AU')}
            </div>
            {isTask && activity.due_date && (
              <div style={{ fontSize: 11, color: isOverdue ? '#dc2626' : '#6b7280', marginTop: 2 }}>
                {isOverdue ? '⚠ ' : ''}Due {new Date(activity.due_date).toLocaleDateString('en-AU')}
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <div onClick={e => e.stopPropagation()} style={{
            marginTop: 10, padding: '10px 12px', background: '#f9fafb',
            borderRadius: 6, border: '1px solid #f3f4f6',
          }}>
            {activity.description
              ? <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{activity.description}</div>
              : <div style={{ fontSize: 12, color: '#9ca3af' }}>No notes.</div>}
          </div>
        )}

        {isTask && !activity.is_complete && (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(activity.id) }}
            style={{
              marginTop: 8, padding: '4px 10px', borderRadius: 5, fontSize: 11,
              fontWeight: 500, background: '#f0fdf4', color: '#16a34a',
              border: '1px solid #bbf7d0', cursor: 'pointer',
            }}
          >
            <i className="ti ti-check" style={{ marginRight: 4 }} />
            Mark complete
          </button>
        )}
      </div>
    </div>
  )
}

export default function ActivitiesPage() {
  const queryClient  = useQueryClient()
  const [typeFilter,     setTypeFilter]     = useState('')
  const [showIncomplete, setShowIncomplete] = useState(false)
  const [showForm,       setShowForm]       = useState(false)
  const [selectedId,     setSelectedId]     = useState<string | null>(null)

  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ['activities', typeFilter, showIncomplete],
    queryFn:  () => getActivities({
      ...(typeFilter     && { activity_type: typeFilter }),
      ...(showIncomplete && { incomplete_tasks: 'true' }),
    }),
  })

  const completeMutation = useMutation({
    mutationFn: completeActivity,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['activities'] }),
  })

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Activities</h1>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Calls, emails, meetings, tasks and notes</div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 500,
            background: showForm ? '#f3f4f6' : '#111827',
            color: showForm ? '#374151' : '#fff',
            border: 'none', cursor: 'pointer',
          }}
        >
          <i className={`ti ${showForm ? 'ti-x' : 'ti-plus'}`} />
          {showForm ? 'Cancel' : 'Log Activity'}
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div style={{ marginBottom: 20 }}>
          <LogActivityForm
            onSaved={() => {
              setShowForm(false)
              queryClient.invalidateQueries({ queryKey: ['activities'] })
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setTypeFilter('')} style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: 'none', fontWeight: 500,
          background: typeFilter === '' ? '#111827' : '#f3f4f6',
          color:      typeFilter === '' ? '#fff'    : '#374151',
        }}>All</button>
        {Object.entries(TYPE_CONFIG).map(([k, v]) => (
          <button key={k} onClick={() => setTypeFilter(k === typeFilter ? '' : k)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 500,
            background: typeFilter === k ? v.color + '20' : '#f3f4f6',
            color:      typeFilter === k ? v.color        : '#374151',
            border:     typeFilter === k ? `1px solid ${v.color}` : '1px solid transparent',
          }}>
            <i className={`ti ${v.icon}`} style={{ marginRight: 4 }} />{v.label}
          </button>
        ))}
        <button onClick={() => setShowIncomplete(!showIncomplete)} style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: 500,
          background: showIncomplete ? '#fef9c3' : '#f3f4f6',
          color:      showIncomplete ? '#854d0e' : '#374151',
          border:     showIncomplete ? '1px solid #fcd34d' : '1px solid transparent',
          marginLeft: 'auto',
        }}>
          <i className="ti ti-clock" style={{ marginRight: 4 }} />Incomplete tasks
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading activities…</div>
      ) : activities.length === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: 14 }}>No activities found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activities.map((a) => (
            <ActivityRow
              key={a.id}
              activity={a}
              onComplete={(id) => completeMutation.mutate(id)}
              onClick={(id) => setSelectedId(id)}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedId && (
        <ActivityDetailPanel
          activityId={selectedId}
          onClose={() => {
            setSelectedId(null)
            queryClient.invalidateQueries({ queryKey: ['activities'] })
          }}
        />
      )}
    </div>
  )
}