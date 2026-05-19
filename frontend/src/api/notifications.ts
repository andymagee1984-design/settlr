// src/api/notifications.ts
import client from './client'

export interface Notification {
  id: string
  notif_type:
    | 'sale_pending'
    | 'sale_approved'
    | 'sale_declined'
    | 'on_hold_expiry'
    | 'da_lapse_warning'
    | 'da_condition_due_soon'
    | 'da_condition_overdue'
    | 'da_milestone_overdue'
  title: string
  message: string
  sale_id: string | null
  project_id: string | null
  lot_number: string | null
  project_name: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export const getNotifications = () =>
  client.get<any>('/notifications/').then(r =>
    Array.isArray(r.data) ? r.data : (r.data.results ?? [])
  )

export const markAllRead = () =>
  client.post('/notifications/mark_read/').then(r => r.data)

export const markOneRead = (id: string) =>
  client.post(`/notifications/${id}/read/`).then(r => r.data)