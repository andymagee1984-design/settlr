// src/components/ActivityDetailPanel.tsx
//
// Slide-out panel for viewing and editing any activity.
// Opens when any activity row is clicked — Activities page, Sale panel, Dashboard.

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getActivity, updateActivity, completeActivity } from '../api/activities'
import type { Activity } from '../api/activities'
import client from '../api/client'

// ── Re-use the same OrgUser type from LogActivityForm ────────────────────────
interface OrgUser {
  id: string
  full_name: string
  email: string
}

async function fetchOrgUsers(): Promise<OrgUser[]> {
  const { data } = await client.get('/org-users/')
  return Array.isArray(data) ? data : (data as any).results ?? []
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  activityId: string
  onClose:    () => void
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  call:       { label: 'Call',       icon: 'ti-phone',       color: '#185FA5', bg: '#E6F1FB' },
  email:      { label: 'Email',      icon: 'ti-mail',        color: '#534AB7', bg: '#EEEDFE' },
  meeting:    { label: 'Meeting',    icon: 'ti-calendar',    color: '#185FA5', bg: '#E6F1FB' },
  inspection: { label: 'Inspection', icon: 'ti-home-search', color: '#0F6E56', bg: '#E1F5EE' },
  task:       { label: 'Task',       icon: 'ti-checkbox',    color: '#BA7517', bg: '#FAEEDA' },
  note:       { label: 'Note',       icon: 'ti-notes',       color: '#5F5E5A', bg: '#F1EFE8' },
}

const TYPE_OPTIONS = ['call', 'email', 'meeting', 'inspection', 'task', 'note']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
  boxSizing: 'border-box', background: '#fff',
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#9ca3af', marginBottom: 4, display: 'block',
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{value || '—'}</div>
    </div>
  )
}

export default function ActivityDetailPanel({ activityId, onClose }: Props) {
  const [visible,  setVisible]  = useState(false)
  const [editing,  setEditing]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [form,     setForm]     = useState({
    activity_type: '',
    subject:       '',
    description:   '',
    activity_date: '',
    due_date:      '',
    assigned_to:   '',
  })

  const queryClient = useQueryClient()

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 240)
  }

  const { data: activity, isLoading } = useQuery<Activity>({
    queryKey: ['activity', activityId],
    queryFn:  () => getActivity(activityId),
  })

  const { data: users = [] } = useQuery<OrgUser[]>({
    queryKey:  ['org-users'],
    queryFn:   fetchOrgUsers,
    staleTime: 5 * 60 * 1000,
  })

  // Populate form when activity loads
  useEffect(() => {
    if (activity) {
      setForm({
        activity_type: activity.activity_type,
        subject:       activity.subject,
        description:   activity.description ?? '',
        activity_date: activity.activity_date?.slice(0, 16) ?? '',
        due_date:      activity.due_date?.slice(0, 10) ?? '',
        assigned_to:   activity.assigned_to ?? '',
      })
    }
  }, [activity])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['activity', activityId] })
    queryClient.invalidateQueries({ queryKey: ['activities'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        activity_type: form.activity_type,
        subject:       form.subject,
        description:   form.description,
        activity_date: form.activity_date,
      }
      if (form.assigned_to) payload.assigned_to = form.assigned_to
      if (form.due_date)    payload.due_date     = form.due_date
      else                  payload.due_date     = null
      return updateActivity(activityId, payload)
    },
    onSuccess: () => { setEditing(false); setError(null); invalidate() },
    onError:   (e: any) => setError(e?.response?.data?.detail ?? 'Save failed.'),
  })

  const { mutate: markComplete, isPending: completing } = useMutation({
    mutationFn: () => completeActivity(activityId),
    onSuccess:  () => { invalidate(); handleClose() },
    onError:    (e: any) => setError(e?.response?.data?.detail ?? 'Failed to complete.'),
  })

  const tc = activity ? (TYPE_CONFIG[activity.activity_type] ?? TYPE_CONFIG.note) : TYPE_CONFIG.note

  return (
    <>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 900,
        opacity: visible ? 1 : 0, transition: 'opacity 240ms ease',
      }} />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: '#fff', zIndex: 901,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.12)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 240ms cubic-bezier(0.4, 0, 0.2, 1)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: tc.bg, color: tc.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <i className={`ti ${tc.icon}`} style={{ fontSize: 16 }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
                {activity?.subject ?? '…'}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {tc.label}
                {activity?.is_complete && (
                  <span style={{
                    marginLeft: 8, fontSize: 11, fontWeight: 500,
                    color: '#15803d', background: '#f0fdf4',
                    border: '1px solid #bbf7d0', borderRadius: 99, padding: '1px 7px',
                  }}>
                    Completed
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 20, padding: 0 }}>
            <i className="ti ti-x" />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {isLoading ? (
            <div style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</div>
          ) : activity ? (
            <>
              {!editing ? (
                /* ── View mode ── */
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                    <Field label="Type"        value={tc.label} />
                    <Field label="Date"        value={new Date(activity.activity_date).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />
                    <Field label="Assigned to" value={activity.assigned_to_name ?? '—'} />
                    <Field label="Created by"  value={activity.created_by_name ?? '—'} />
                    {activity.due_date && (
                      <Field label="Due date" value={new Date(activity.due_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} />
                    )}
                    {activity.completed_at && (
                      <Field label="Completed" value={new Date(activity.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} />
                    )}
                  </div>

                  {activity.description && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={labelStyle}>Notes</div>
                      <div style={{
                        fontSize: 13, color: '#374151', lineHeight: 1.6,
                        background: '#f9fafb', borderRadius: 8, padding: '12px 14px',
                        border: '1px solid #e5e7eb',
                      }}>
                        {activity.description}
                      </div>
                    </div>
                  )}

                  {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{error}</div>}

                  {/* Actions */}
                  {!activity.is_complete && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => setEditing(true)} style={{
                        padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
                      }}>
                        <i className="ti ti-pencil" style={{ marginRight: 5 }} />Edit
                      </button>
                      {activity.activity_type === 'task' && (
                        <button onClick={() => markComplete()} disabled={completing} style={{
                          padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                          background: '#f0fdf4', color: '#16a34a',
                          border: '1px solid #bbf7d0', cursor: 'pointer',
                          opacity: completing ? 0.6 : 1,
                        }}>
                          <i className="ti ti-check" style={{ marginRight: 5 }} />
                          {completing ? 'Saving…' : 'Mark complete'}
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                /* ── Edit mode ── */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select style={inputStyle} value={form.activity_type}
                        onChange={e => setForm({ ...form, activity_type: e.target.value })}>
                        {TYPE_OPTIONS.map(t => (
                          <option key={t} value={t}>{TYPE_CONFIG[t]?.label ?? t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Date & time</label>
                      <input style={inputStyle} type="datetime-local" value={form.activity_date}
                        onChange={e => setForm({ ...form, activity_date: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Subject *</label>
                    <input style={inputStyle} value={form.subject}
                      onChange={e => setForm({ ...form, subject: e.target.value })} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Due date (optional)</label>
                      <input style={inputStyle} type="date" value={form.due_date}
                        onChange={e => setForm({ ...form, due_date: e.target.value })} />
                    </div>
                    <div>
                      <label style={labelStyle}>Assign to</label>
                      <select style={inputStyle} value={form.assigned_to}
                        onChange={e => setForm({ ...form, assigned_to: e.target.value })}>
                        <option value="">Unassigned</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Notes</label>
                    <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>

                  {error && <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>}

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => {
                      if (!form.subject.trim()) { setError('Subject is required.'); return }
                      setError(null); save()
                    }} disabled={saving} style={{
                      padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                      background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
                      opacity: saving ? 0.6 : 1,
                    }}>
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                    <button onClick={() => { setEditing(false); setError(null) }} style={{
                      padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                      background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
                    }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#9ca3af', fontSize: 14 }}>Activity not found.</div>
          )}
        </div>
      </div>
    </>
  )
}