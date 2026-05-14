// src/components/LogActivityForm.tsx

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createActivity } from '../api/activities'
import client from '../api/client'

interface OrgUser {
  id: string
  full_name: string
  email: string
}

interface LogActivityFormProps {
  saleId?:          string
  contactType?:     string
  contactId?:       string
  onSaved:          () => void
  onCancel?:        () => void
  defaultAssignee?: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  call:       { label: 'Call',       icon: 'ti-phone'       },
  email:      { label: 'Email',      icon: 'ti-mail'        },
  meeting:    { label: 'Meeting',    icon: 'ti-calendar'    },
  inspection: { label: 'Inspection', icon: 'ti-home-search' },
  task:       { label: 'Task',       icon: 'ti-checkbox'    },
  note:       { label: 'Note',       icon: 'ti-note'        },
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, color: '#111827',
  boxSizing: 'border-box', background: '#fff',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 4, display: 'block',
}

async function fetchOrgUsers(): Promise<OrgUser[]> {
  const { data } = await client.get('/org-users/')
  return Array.isArray(data) ? data : (data as any).results ?? []
}

export default function LogActivityForm({
  saleId,
  contactType,
  contactId,
  onSaved,
  onCancel,
  defaultAssignee,
}: LogActivityFormProps) {
  const [form, setForm] = useState({
    activity_type: 'note',
    subject:       '',
    description:   '',
    activity_date: new Date().toISOString().slice(0, 16),
    due_date:      '',
    assigned_to:   defaultAssignee ?? '',
  })
  const [error, setError] = useState<string | null>(null)

  const { data: users = [], isError: usersError } = useQuery<OrgUser[]>({
    queryKey:  ['org-users'],
    queryFn:   fetchOrgUsers,
    staleTime: 5 * 60 * 1000,
    retry:     1,
  })

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        activity_type: form.activity_type,
        subject:       form.subject,
        description:   form.description,
        activity_date: form.activity_date,
      }
      if (saleId)                   payload.sale         = saleId
      if (contactType && contactId) { payload.contact_type = contactType; payload.contact_id = contactId }
      if (form.assigned_to)         payload.assigned_to  = form.assigned_to
      if (form.due_date)            payload.due_date     = form.due_date
      return createActivity(payload)
    },
    onSuccess: () => {
      setForm({
        activity_type: 'note',
        subject:       '',
        description:   '',
        activity_date: new Date().toISOString().slice(0, 16),
        due_date:      '',
        assigned_to:   defaultAssignee ?? '',
      })
      setError(null)
      onSaved()
    },
    onError: (e: any) => setError(
      e?.response?.data?.detail ?? JSON.stringify(e?.response?.data) ?? 'Something went wrong.'
    ),
  })

  const handleSubmit = () => {
    if (!form.subject.trim()) { setError('Subject is required.'); return }
    setError(null)
    mutation.mutate()
  }

  return (
    <div style={{
      background: '#f9fafb', borderRadius: 8, padding: 16,
      display: 'flex', flexDirection: 'column', gap: 10,
      border: '1px solid #e5e7eb',
    }}>
      {/* Row 1: Type + Date */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>Type</label>
          <select
            style={inputStyle}
            value={form.activity_type}
            onChange={(e) => setForm({ ...form, activity_type: e.target.value })}
          >
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Date & time</label>
          <input
            style={inputStyle}
            type="datetime-local"
            value={form.activity_date}
            onChange={(e) => setForm({ ...form, activity_date: e.target.value })}
          />
        </div>
      </div>

      {/* Row 2: Subject */}
      <div>
        <label style={labelStyle}>Subject *</label>
        <input
          style={inputStyle}
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder={
            form.activity_type === 'task'    ? 'e.g. Call buyer to confirm finance approval' :
            form.activity_type === 'call'    ? 'e.g. Called buyer — left voicemail' :
            form.activity_type === 'email'   ? 'e.g. Sent contract to solicitor' :
            form.activity_type === 'meeting' ? 'e.g. Site inspection with buyer' :
            'Subject…'
          }
        />
      </div>

      {/* Row 3: Due date + Assignee */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={labelStyle}>
            Due date
            {form.activity_type !== 'task' && (
              <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 4 }}>(optional)</span>
            )}
          </label>
          <input
            style={inputStyle}
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>
        <div>
          <label style={labelStyle}>
            Assign to
            {usersError && (
              <span style={{ fontWeight: 400, color: '#dc2626', marginLeft: 4 }}>(failed to load)</span>
            )}
          </label>
          <select
            style={inputStyle}
            value={form.assigned_to}
            onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label style={labelStyle}>Notes</label>
        <textarea
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional notes…"
        />
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#dc2626' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSubmit}
          disabled={mutation.isPending}
          style={{
            padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
            background: '#111827', color: '#fff', border: 'none', cursor: 'pointer',
            opacity: mutation.isPending ? 0.6 : 1,
          }}
        >
          {mutation.isPending ? 'Saving…' : 'Save activity'}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              background: '#f3f4f6', color: '#374151', border: 'none', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}